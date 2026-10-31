import assert from 'node:assert/strict';
import {test} from 'node:test';
import {purineCases,purineReferences,purineOpsin} from './fixtures/purine-derivation.mjs';
import {generalizationCases} from './fixtures/generalized-derivation.mjs';
import {recognizePurineParent,parsePurineSyntax,parsePurineFamily} from '../app/purine-derivation.ts';
import {moleculeFromSmiles,inspectSmilesStructure,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName,validatedNameTargets} from '../app/validated-name-derivation.ts';
import {mapStructuralRegions,deriveStructuralComponents} from '../app/structural-derivation.ts';
const graph=s=>{const r=moleculeFromSmiles(s);assert.equal(r.ok,true,r.error);return r.molecule;};
const sorted=xs=>[...xs].sort((a,b)=>a-b);
const component=(model,id)=>model.components.find(c=>c.id===id);

for(const f of purineCases){
  test(`FULL retained numbering, H and exact semantic regions: ${f.common}`,()=>{
    const g=graph(f.smiles),parent=recognizePurineParent(g),model=reconcileSystematicName(g,f.name);
    assert.equal(model?.status,'FULL');assert.equal(model.name,f.name);assert.equal(model.parentSystem,'purine');
    assert.deepEqual(parent.atomIds,f.parent);assert.deepEqual(model.parentAtomIds,f.parent);
    assert.deepEqual(parent.numbering,f.parent.map((id,i)=>[id,i+1]));
    assert.deepEqual(parent.fusionAtomIds,[f.parent[3],f.parent[4]]);
    assert.deepEqual(parent.nitrogenIds,[1,3,7,9].map(p=>f.parent[p-1]));
    assert.deepEqual(parent.hydrogens.filter(([id,h])=>h&&parent.nitrogenIds.includes(id)).map(([id])=>f.parent.indexOf(id)+1),f.nh);
    const methyl=component(model,'purine-methyl'),oxo=component(model,'purine-oxo');
    assert.deepEqual(sorted(methyl?.atomIds??[]),sorted(f.methyl.map(([,id])=>id)));
    assert.deepEqual(methyl?.numbering??[],f.methyl.map(([p])=>[f.parent[p-1],p]));
    assert.deepEqual(methyl?.bondIds??[],f.methyl.map(([p,id])=>[f.parent[p-1],id]));
    assert.deepEqual(sorted(oxo?.atomIds??[]),sorted(f.oxo.flatMap(([p,id])=>[f.parent[p-1],id])));
    assert.equal(component(model,'parent').bondIds.length,10);
    assert.deepEqual(component(model,'purine-fusion').bondIds,[[f.parent[3],f.parent[4]]]);
    assert.deepEqual(component(model,'purine-nitrogens').atomIds,[1,3,7,9].map(p=>f.parent[p-1]));
    const targets=validatedNameTargets(model);
    for(const c of model.components){
      assert.equal(f.name.slice(c.start,c.end),c.text);
      assert.deepEqual(targets[c.id].atomIds,c.atomIds);assert.deepEqual(targets[c.id].locants,c.numbering);
      for(const [a,b] of c.bondIds)assert.ok(g.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x));
    }
    assert.equal(deriveStructuralComponents(g,f.name).status,'PARTIAL','structural-only evidence never claims full naming');
    assert.equal(inspectSmilesStructure(f.smiles).formula,f.formula);
    const exported=moleculeToSmiles(g);assert.equal(exported.ok,true);
    assert.equal(reconcileSystematicName(graph(exported.smiles),f.name)?.status,'FULL');
  });
  test(`locants survive reversed IDs, storage, edge order and rotated drawing: ${f.common}`,()=>{
    const g=graph(f.smiles),ids=new Map(g.atoms.map((a,i)=>[a.id,1000+(g.atoms.length-i)*37]));
    const defaultCarbon=structuredClone(g);for(const a of defaultCarbon.atoms)if(a.element==='C')delete a.element;
    assert.deepEqual(recognizePurineParent(defaultCarbon).numbering,f.parent.map((id,i)=>[id,i+1]),'omitted element means carbon in the editor graph');
    assert.equal(reconcileSystematicName(defaultCarbon,f.name)?.status,'FULL');
    for(const angle of [0,Math.PI/2,2.17]){
      const changed={atoms:g.atoms.map(a=>({...a,id:ids.get(a.id),x:a.x*Math.cos(angle)-a.y*Math.sin(angle),y:a.x*Math.sin(angle)+a.y*Math.cos(angle)})).reverse(),
        bonds:g.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse(),rings:[]};
      const m=reconcileSystematicName(changed,f.name);assert.equal(m?.status,'FULL');
      assert.deepEqual(m.parentAtomIds,f.parent.map(id=>ids.get(id)));
      assert.deepEqual(recognizePurineParent(changed).numbering,f.parent.map((id,i)=>[ids.get(id),i+1]));
    }
  });
}

for(const f of purineReferences.filter(r=>r.query!=='oxypurinol'))test(`independent PubChem generalization: ${f.query}`,()=>{
  assert.ok(f.SMILES&&f.IUPACName);const g=graph(f.SMILES),model=reconcileSystematicName(g,f.IUPACName);
  assert.equal(model?.status,'FULL');assert.equal(inspectSmilesStructure(f.SMILES).formula,f.MolecularFormula);
});

// A second independent numbered graph from OPSIN CML, retaining explicit H
// counts for comparison. This is reference data, never a production parser.
function cmlReference(cml){
  const atoms=[],expected=[],hydrogens=new Set();
  for(const m of cml.matchAll(/<atom\b([^>]*?)(?:\/>|>([\s\S]*?)<\/atom>)/g)){
    const id=Number(/\bid="a(\d+)"/.exec(m[1])?.[1]),element=/elementType="([A-Za-z]+)"/.exec(m[1])?.[1];
    if(element==='H'){hydrogens.add(id);continue;}
    atoms.push({id,element,x:0,y:0});const p=/<label value="([1-9])"/.exec(m[2]??'');if(p)expected.push([id,Number(p[1])]);
  }
  const all=[...cml.matchAll(/<bond\b[^>]*atomRefs2="a(\d+) a(\d+)" order="([SDT])"/g)].map(m=>[Number(m[1]),Number(m[2]),{S:1,D:2,T:3}[m[3]]]);
  const bonds=all.filter(([a,b])=>!hydrogens.has(a)&&!hydrogens.has(b));
  const nh=expected.filter(([id])=>all.some(([a,b])=>a===id&&hydrogens.has(b)||b===id&&hydrogens.has(a))).map(([id])=>id);
  // OPSIN also numbers each separate methyl fragment from 1. Only the
  // nine multiply connected parent atoms carry the retained ring locants.
  const parentLocants=expected.filter(([id])=>bonds.filter(([a,b])=>a===id||b===id).length>=2).sort((a,b)=>a[1]-b[1]);
  assert.deepEqual(parentLocants.map(([,p])=>p),[1,2,3,4,5,6,7,8,9]);
  return {graph:{atoms,bonds},expected:parentLocants,nh};
}
for(const f of purineOpsin.filter(r=>r.status==='SUCCESS'))test(`OPSIN CML locants, explicit H and graph reconciliation: ${f.name}`,()=>{
  const cml=cmlReference(f.cml),p=recognizePurineParent(cml.graph);
  assert.ok(p);assert.deepEqual(p.numbering,cml.expected);
  assert.deepEqual(p.hydrogens.filter(([id,h])=>h&&p.nitrogenIds.includes(id)).map(([id])=>id).sort(),cml.nh.filter(id=>p.nitrogenIds.includes(id)).sort());
  assert.ok(mapStructuralRegions(cml.graph,graph(f.smiles),[]));
  const m=reconcileSystematicName(cml.graph,f.name);
  if(f.name==='3,7-dihydropurine-2,8-dione')assert.equal(m,null,'implicit indicated-H priority remains outside this finite grammar');
  else assert.equal(m?.status,'FULL');
});

test('wrong methyl positions, missing oxo and conflicting indicated H never reach FULL',()=>{
  const caffeine=graph(purineCases[2].smiles),theophylline=graph(purineCases[4].smiles);
  assert.equal(reconcileSystematicName(theophylline,purineCases[3].name),null);
  assert.equal(reconcileSystematicName(caffeine,'1,3,9-trimethylpurine-2,6-dione'),null);
  assert.equal(reconcileSystematicName(theophylline,'1,3-dimethyl-9H-purine-2,6-dione'),null);
  assert.equal(reconcileSystematicName(graph(purineCases[0].smiles),'9H-purine'),null);
  assert.equal(reconcileSystematicName(caffeine,'1,3,7-trimethylpurine'),null);
  assert.equal(reconcileSystematicName(caffeine,'1,3,7-trimethylpurine-2,8-dione'),null);
});
test('same-formula oxo isomer and nonpurine constitutional isomer are distinguished',()=>{
  const x=purineCases[1],oxo=purineOpsin.find(f=>f.name==='7,9-dihydro-1H-purine-6,8-dione'),other=purineReferences.find(r=>r.query==='oxypurinol');
  for(const smiles of [oxo.smiles,other.SMILES]){
    assert.equal(inspectSmilesStructure(smiles).formula,x.formula);
    assert.equal(reconcileSystematicName(graph(smiles),x.name),null);
  }
  assert.equal(recognizePurineParent(graph(other.SMILES)),null);
});
test('tautomers retain distinct nitrogen H populations even after aromatic normalization',()=>{
  const seven=graph(purineCases[1].smiles),nine=graph(purineOpsin.find(r=>r.name==='3,9-dihydropurine-2,6-dione').smiles);
  assert.equal(mapStructuralRegions(seven,nine,[]),null);
  assert.equal(reconcileSystematicName(nine,purineCases[1].name),null);
  assert.equal(reconcileSystematicName(seven,'3,9-dihydropurine-2,6-dione'),null);
  assert.equal(reconcileSystematicName(graph('Oc1nc(O)c2[nH]cnc2n1'),purineCases[1].name),null);
});
test('incorrect heteroatoms, connectivity, valence, protonation and isotope metadata fail closed',()=>{
  const f=purineCases[0],g=graph(f.smiles),oxygen=structuredClone(g);oxygen.atoms.find(a=>a.id===f.parent[6]).element='O';
  assert.equal(recognizePurineParent(oxygen),null);assert.equal(reconcileSystematicName(oxygen,f.name),null);
  const connected=structuredClone(g);connected.bonds=connected.bonds.filter(([a,b])=>!(a===1&&b===6||a===6&&b===1));connected.bonds.push([1,4,1]);
  assert.equal(recognizePurineParent(connected),null);assert.equal(reconcileSystematicName(connected,f.name),null);
  const invalid=graph(purineCases[2].smiles);invalid.atoms.push({id:100,element:'C',x:0,y:0});invalid.bonds.push([9,100,1]);
  assert.equal(recognizePurineParent(invalid),null);assert.equal(reconcileSystematicName(invalid,purineCases[2].name),null);
  const charged=structuredClone(g);charged.atoms.find(a=>a.id===f.parent[8]).charge=1;
  assert.equal(reconcileSystematicName(charged,f.name),null);
  const isotope=structuredClone(g);isotope.atoms[0].massNumber=13;assert.equal(reconcileSystematicName(isotope,f.name),null);
});
test('multiplicities, locant syntax, ambiguous H and unsupported reduction stay bounded',()=>{
  for(const n of ['1,3-trimethylpurine-2,6-dione','3,3-dimethylpurine-2,6-dione','7,3-dimethylpurine-2,6-dione','3,7-dimethylpurine-2,2-dione','7,7H-purine','2H-purine','3,7-dihydropurine','4-methyl-7H-purine','3,7-dihydropurine-4,6-dione'])assert.equal(parsePurineSyntax(n),null,n);
  assert.equal(parsePurineFamily('purine-2,8-dione'),null,'two distinct H assignments are not resolved by the editor input');
  assert.equal(parsePurineFamily('purine-6,8-dione'),null);
  assert.equal(parsePurineFamily('3,7-dihydropurine-2,8-dione'),null);
});
test('the accumulated acyclic/aromatic FULL bank is untouched by purine numbering',()=>{
  for(const f of generalizationCases){const g=graph(f.smiles);assert.equal(recognizePurineParent(g),null);assert.equal(reconcileSystematicName(g,f.name)?.status,'FULL');}
});
