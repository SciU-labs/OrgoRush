// Inventory historical literal structures without calling the naming engine.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { Molecule, SmilesParser, CanonizerUtil } from 'openchemlib';
import { generalizationInput } from '../tests/fixtures/b60-generalization-input.mjs';
const key=smiles=>CanonizerUtil.getIDCode(new SmilesParser().parseMolecule(smiles.replace(/@@?/g,'').replace(/[\\/]/g,'')),CanonizerUtil.NORMAL);
const strings=new Map();
const graphIdentities=new Map();
function addGraph(value,path) {
  if(!value||!Array.isArray(value.atoms)||!Array.isArray(value.bonds)||!value.atoms.length)return;
  try {
    const mol=new Molecule(0,0),index=new Map();
    const atomicNumbers={C:6,H:1,N:7,O:8,F:9,P:15,S:16,Cl:17,Br:35,I:53};
    for(const atom of value.atoms) {
      if(!atom||typeof atom!=='object'||!Number.isInteger(atom.id))return;
      const number=atomicNumbers[atom.element??'C'];if(!number)return;
      const id=mol.addAtom(number);index.set(atom.id,id);mol.setAtomCharge(id,atom.charge??0);
    }
    for(const bond of value.bonds) {
      if(!Array.isArray(bond)||!index.has(bond[0])||!index.has(bond[1]))return;
      const order=bond[2]??1;if(![1,2,3].includes(order))return;
      mol.setBondOrder(mol.addBond(index.get(bond[0]),index.get(bond[1])),order);
    }
    mol.ensureHelperArrays(Molecule.cHelperCIP);
    const identity=CanonizerUtil.getIDCode(mol,CanonizerUtil.NORMAL);
    if(!graphIdentities.has(identity))graphIdentities.set(identity,new Set());graphIdentities.get(identity).add(path);
  }catch{}
}
const add=(value,path)=>{
  if(typeof value==='string' && value.length>=2 && value.length<=600
    && /^[A-Za-z0-9@+\-\[\]\\/=#$().:%*]+$/.test(value) && /[CNOScnos\[]/.test(value)) {
    if(!strings.has(value))strings.set(value,[]);strings.get(value).push(path);
  }
};
const jsonStrings=(value,path)=>{if(typeof value==='string')add(value,path);else if(value&&typeof value==='object'){
  addGraph(value,path);for(const child of Object.values(value))jsonStrings(child,path);
}};
function staticValue(node) {
  if(ts.isStringLiteralLike(node))return node.text;
  if(ts.isNumericLiteral(node))return Number(node.text);
  if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken)return -staticValue(node.operand);
  if(ts.isArrayLiteralExpression(node))return node.elements.map(staticValue);
  if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.flatMap(property=>
    ts.isPropertyAssignment(property)&&!ts.isComputedPropertyName(property.name)
      ?[[property.name.text,staticValue(property.initializer)]]:[]));
  return undefined;
}
async function walk(directory) {
  for(const entry of await readdir(new URL(directory,import.meta.url),{withFileTypes:true})) {
    const path=directory+entry.name;
    if(path.includes('/b61')||path.includes('/node_modules'))continue;
    if(entry.isDirectory())await walk(path+'/');
    else if(/\.(json|mjs|ts)$/.test(path)) {
      const source=await readFile(new URL(path,import.meta.url),'utf8');
      if(path.endsWith('.json')){try{jsonStrings(JSON.parse(source),path)}catch{}continue;}
      const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
      const visit=node=>{
        if(ts.isStringLiteralLike(node))add(node.text,path);
        if(ts.isObjectLiteralExpression(node)&&node.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.text==='atoms'))addGraph(staticValue(node),path);
        ts.forEachChild(node,visit);
      };visit(file);
    }
  }
}
await walk('../tests/');await walk('../reports/');
for(const row of generalizationInput)add(row.smiles,'../tests/fixtures/b60-generalization-input.mjs');
const historical=new Map();let parseable=0;
for(const [value,paths] of strings) {
  try {const identity=key(value);parseable++;if(!historical.has(identity))historical.set(identity,new Set());for(const path of paths)historical.get(identity).add(path)}catch{}
}
for(const [identity,paths] of graphIdentities) {
  if(!historical.has(identity))historical.set(identity,new Set());for(const path of paths)historical.get(identity).add(path);
}
const pool=JSON.parse(await readFile(new URL('../reports/b61/reference-pool.json',import.meta.url),'utf8'));
const records=pool.records.map(row=>{
  let identity=null;try{identity=key(row.SMILES)}catch{}
  return {cid:row.CID,name:row.IUPACName,formula:row.MolecularFormula,smiles:row.SMILES,constitutionKey:identity,
    novel:!!identity&&!historical.has(identity),historicalPaths:[...(historical.get(identity)??[])].slice(0,10)};
});
await writeFile(new URL('../reports/b61/novelty-expanded.json',import.meta.url),JSON.stringify({method:'AST/JSON literal SMILES plus statically encoded atom/bond graphs in all pre-B6.1 tests and reports; compare stereo-stripped constitutions',
  candidateStrings:strings.size,parseableStrings:parseable,staticGraphConstitutions:graphIdentities.size,historicalConstitutions:historical.size,records,
  limitation:'Does not enumerate arbitrary procedurally generated molecules absent from archived fixtures and observations'},null,2)+'\n');
console.log(JSON.stringify({inventory:historical.size,records:records.map(r=>({cid:r.cid,novel:r.novel,name:r.name}))},null,2));
