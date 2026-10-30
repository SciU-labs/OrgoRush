import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName, validatedNameTargets } from "../app/validated-name-derivation.ts";
import { resolveChemicalName } from "../app/name-structure-resolver.ts";

const imported = s => { const r = moleculeFromSmiles(s); assert.equal(r.ok,true,r.error); return r.molecule; };
const sorted = xs => [...xs].sort((a,b) => a-b);
const fixtures = [
  { name: "2-[4-(2-methylpropyl)phenyl]propanoic acid", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", group: "carboxylicAcid",
    regions: { parent: [11,12,13], suffix: [13,14,15], aryl: [1,2,3,4,5,6,7,8,9,10], "aryl-prefix": [1,2,3,4] },
    locants: [[13,1],[11,2],[12,3]], branchLocant: 2 },
  { name: "N-(4-hydroxyphenyl)acetamide", smiles: "CC(=O)Nc1ccc(O)cc1", group: "amide",
    regions: { parent: [1,2,4], suffix: [2,3,4], aryl: [5,6,7,8,9,10,11], "aryl-prefix": [9] },
    locants: [[2,1],[1,2]], branchLocant: "N" },
  { name: "2-(acetyloxy)benzoic acid", smiles: "CC(=O)Oc1ccccc1C(=O)O", group: "carboxylicAcid",
    regions: { parent: [5,6,7,8,9,10,11], suffix: [11,12,13], acyloxy: [1,2,3,4] },
    locants: [[10,1],[5,2]], branchLocant: 2 },
];
for (const f of fixtures) test(`FULL exact name, parent, nested components and colours: ${f.name}`, () => {
  const graph = imported(f.smiles), model = reconcileSystematicName(graph,f.name);
  assert.equal(model?.status,"FULL"); assert.equal(model.principalGroup,f.group); assert.equal(model.preferred,false);
  const targets = validatedNameTargets(model);
  for (const c of model.components) {
    assert.deepEqual(sorted(c.atomIds),f.regions[c.id]);
    assert.equal(f.name.slice(c.start,c.end),c.text);
    assert.deepEqual(targets[c.id].atomIds,c.atomIds);
    assert.deepEqual(targets[c.id].bondIds,c.bondIds);
    for (const [a,b] of c.bondIds) assert.ok(graph.bonds.some(([x,y]) => x===a && y===b || x===b && y===a));
  }
  assert.deepEqual(model.components.find(c=>c.id==='parent').numbering,f.locants);
  assert.equal(model.components.find(c=>c.role==='substituent').locant,f.branchLocant);
  if (f.regions.aryl) {
    assert.deepEqual(model.components.find(c=>c.id==='aryl').numbering,
      f.group==='amide' ? [[5,1],[8,4]] : [[8,1],[5,4]]);
    assert.equal(model.components.find(c=>c.id==='aryl-prefix').locant,4);
    assert.equal(model.components.find(c=>c.id==='aryl-prefix').parentId,'aryl');
  }
  const ids = new Map(graph.atoms.map(a=>[a.id, 1000+a.id*11]));
  const permuted = { atoms:graph.atoms.map(a=>({...a,id:ids.get(a.id)})).reverse(),
    bonds:graph.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse() };
  const remapped = reconcileSystematicName(permuted,f.name);
  assert.equal(remapped?.status,'FULL');
  for (const c of remapped.components) assert.deepEqual(sorted(c.atomIds),sorted(f.regions[c.id].map(id=>ids.get(id))));
  assert.equal(reconcileSystematicName(graph,f.name.replace(/4-/, '3-')+' unsupported suffix'),null);
});
test('exact attachment edges distinguish nested and principal functions',()=>{
  const ib = reconcileSystematicName(imported(fixtures[0].smiles),fixtures[0].name);
  assert.ok(ib.components.find(c=>c.id==='aryl').bondIds.some(([a,b])=>a===11&&b===8));
  assert.ok(ib.components.find(c=>c.id==='aryl-prefix').bondIds.some(([a,b])=>a===5&&b===4));
  const asp = reconcileSystematicName(imported(fixtures[2].smiles),fixtures[2].name);
  assert.deepEqual(asp.components.find(c=>c.id==='acyloxy').bondIds.map(sorted).sort(),[[1,2],[2,3],[2,4],[4,5]]);
});
test('positional isomers must match the parsed locant, not a familiar name',()=>{
  const para=imported(fixtures[1].smiles);
  assert.equal(reconcileSystematicName(para,'N-(3-hydroxyphenyl)acetamide'),null);
  assert.equal(reconcileSystematicName(para,'N-(2-hydroxyphenyl)acetamide'),null);
  assert.equal(reconcileSystematicName(para,'N-(4-hidroxiphenyl)acetamide'),null);
  const meta=imported('CC(=O)Nc1cccc(O)c1');
  assert.equal(reconcileSystematicName(meta,'N-(3-hydroxyphenyl)acetamide')?.status,'FULL');
  assert.equal(reconcileSystematicName(meta,fixtures[1].name),null);
  assert.equal(reconcileSystematicName(imported(fixtures[2].smiles),'3-(acetyloxy)benzoic acid'),null);
});
test('equivalent SMILES reconcile; unspecified and explicit stereo are not conflated',()=>{
  assert.equal(reconcileSystematicName(imported('O=C(O)c1ccccc1OC(C)=O'),fixtures[2].name)?.status,'FULL');
  assert.equal(reconcileSystematicName(imported('CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O'),fixtures[0].name),null);
  assert.equal(reconcileSystematicName(imported(fixtures[0].smiles),'(2R)-'+fixtures[0].name),null);
  assert.equal(reconcileSystematicName(imported('CCO'),'ethanol'),null);
  assert.equal(reconcileSystematicName(imported(fixtures[0].smiles),'ibuprofen'),null);
});
test('single acyloxy prefix supports paired or omitted parentheses with literal spans',()=>{
  const graph=imported(fixtures[2].smiles);
  for(const name of ['2-acetyloxybenzoic acid','2-(acetyloxy)benzoic acid']) {
    const model=reconcileSystematicName(graph,name);
    assert.equal(model?.status,'FULL');
    assert.deepEqual(sorted(model.components.find(c=>c.id==='acyloxy').atomIds),[1,2,3,4]);
    for(const c of model.components)assert.equal(name.slice(c.start,c.end),c.text);
  }
  for(const name of ['2-(acetyloxybenzoic acid','2-acetyloxy)benzoic acid','2-((acetyloxy))benzoic acid','3-acetyloxybenzoic acid','2-acetyloxybenzoic acid extra'])
    assert.equal(reconcileSystematicName(graph,name),null,name);
  const homolog=imported('CCC(=O)Oc1ccccc1C(=O)O');
  assert.equal(reconcileSystematicName(homolog,'2-propanoyloxybenzoic acid')?.status,'FULL');
  assert.equal(reconcileSystematicName(homolog,'2-(propanoyloxy)benzoic acid')?.status,'FULL');
});
test('graph edits and independent molecules cannot reuse stale cached results',()=>{
  const graph=imported(fixtures[2].smiles);
  assert.equal(reconcileSystematicName(graph,fixtures[2].name)?.status,'FULL');
  assert.equal(reconcileSystematicName(imported('CC(=O)Oc1ccccc1C(=O)OC'),fixtures[2].name),null);
  assert.equal(reconcileSystematicName(imported(fixtures[1].smiles),fixtures[2].name),null);
});

// Transport fixtures are deterministic; construction, import and reconciliation
// use production code. These are not live-service or browser assertions.
for (const [i, aliases, cid, formula] of [
  [0,['ibuprofen'],3672,'C13H18O2'],
  [1,['paracetamol','acetaminophen'],1983,'C8H9NO2'],
  [2,['aspirin','acetylsalicylic acid'],2244,'C9H8O4'],
]) for (const alias of aliases) test(`Build by Name resolver → graph → FULL: ${alias}`, async()=>{
  const f=fixtures[i];
  const result=await resolveChemicalName(alias,{fetchImpl:async input=>{
    const url=String(input);
    if (url.includes('/cids/JSON')) return Response.json({IdentifierList:{CID:[cid]}});
    if (url.includes('/property/')) return Response.json({PropertyTable:{Properties:[{CID:cid,IUPACName:f.name,IsomericSMILES:f.smiles,MolecularFormula:formula}]}});
    return new Response('{}',{status:404});
  }});
  assert.equal(result.ok,true);
  assert.equal(result.value.source,'PubChem');
  const model=reconcileSystematicName(imported(result.value.smiles),result.value.iupacName);
  assert.equal(model?.status,'FULL');
  assert.deepEqual(sorted(model.parentAtomIds),f.regions.parent);
});
