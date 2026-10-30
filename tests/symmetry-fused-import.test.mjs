import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {moleculeFromSmiles,moleculeToSmiles,inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {analyzeStructuralEquivalence,mapStructuralRegions,deriveStructuralComponents,structuralVisualTargets} from '../app/structural-derivation.ts';
import {reconcileSystematicName,selectEquivalentAssignment,validatedNameTargets} from '../app/validated-name-derivation.ts';
import {calculateMolecule2DLayout} from '../app/molecule-2d-layout.ts';
const records=JSON.parse(readFileSync(new URL('../reports/fused-reference-records.json',import.meta.url),'utf8'));
const graph=s=>{const r=moleculeFromSmiles(s);assert.equal(r.ok,true,r.error);return r.molecule;};
const sorted=xs=>[...xs].sort((a,b)=>a-b);

for(const [name,smiles,choices] of [
  ['3-methylbutanoic acid','CC(C)CC(=O)O',2],
  ['2,2-dimethylpropanoic acid','CC(C)(C)C(=O)O',3],
  ['2-methylbutanoic acid','CCC(C)C(=O)O',1],
  ['3-methylpentanoic acid','CCC(C)CC(=O)O',1],
  ['4-methylpentanoic acid','CC(C)CCC(=O)O',2],
])test(`symmetry-aware whole assignments: ${name}`,()=>{
  const g=graph(smiles),model=reconcileSystematicName(g,name);assert.equal(model?.status,'FULL');
  assert.equal(model.symmetry?.assignments.length??1,choices);
  const assignments=model.symmetry?.assignments??[model];
  for(const [i,a] of assignments.entries()){
    const selected=selectEquivalentAssignment(model,i),targets=validatedNameTargets(selected);
    assert.deepEqual(selected.parentAtomIds,a.parentAtomIds);
    const parent=selected.components.find(c=>c.id==='parent');
    assert.deepEqual(parent.numbering.map(([,n])=>n),Array.from({length:parent.numbering.length},(_,j)=>j+1));
    const branch=selected.components.find(c=>c.id==='prefix-0');
    assert.ok(branch.atomIds.every(id=>!selected.parentAtomIds.includes(id)));
    assert.deepEqual(targets['prefix-0'].atomIds,branch.atomIds);
    for(const [x,y] of targets['prefix-0'].bondIds)assert.ok(g.bonds.some(([a,b])=>a===x&&b===y||a===y&&b===x));
  }
  const ids=new Map(g.atoms.map(a=>[a.id,300+a.id*23]));
  const reordered={atoms:g.atoms.map(a=>({...a,id:ids.get(a.id)})).reverse(),bonds:g.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse()};
  const other=reconcileSystematicName(reordered,name);assert.equal(other?.status,'FULL');
  const actual=(other.symmetry?.assignments??[other]).map(a=>sorted(a.parentAtomIds).join(',')).sort();
  const expected=assignments.map(a=>sorted(a.parentAtomIds.map(id=>ids.get(id))).join(',')).sort();
  assert.deepEqual(actual,expected,'the set of valid parent choices is independent of input order');
});
test('acid 3 methyl alternatives are exact, not a union or an arbitrary chemically preferred chain',()=>{
  const model=reconcileSystematicName(graph('CC(C)CC(=O)O'),'3-methylbutanoic acid');
  assert.deepEqual(model.symmetry.atomOrbits,[[1,3]]);
  assert.deepEqual(model.symmetry.assignments.map(a=>sorted(a.parentAtomIds)).sort(),[[1,2,4,5],[2,3,4,5]]);
  assert.deepEqual(model.symmetry.assignments.map(a=>a.components.find(c=>c.id==='prefix-0').atomIds).sort(),[[1],[3]]);
  assert.equal(reconcileSystematicName(graph('O=C(O)CC(C)C'),'3-methylbutanoic acid')?.symmetry.assignments.length,2);
  const pivalic=reconcileSystematicName(graph('CC(C)(C)C(=O)O'),'2,2-dimethylpropanoic acid');
  assert.deepEqual(pivalic.symmetry.assignments.map(a=>sorted(a.parentAtomIds)).sort(),[[1,2,5],[2,3,5],[2,4,5]]);
  assert.deepEqual(pivalic.symmetry.assignments.map(a=>sorted(a.components.find(c=>c.id==='prefix-0').atomIds)).sort(),[[1,3],[1,4],[3,4]]);
});
test('real ambiguities, locant changes, unsupported isotopes and stereo do not become equivalent',()=>{
  assert.equal(reconcileSystematicName(graph('CC(C)CC(=O)O'),'2-methylbutanoic acid'),null);
  assert.equal(reconcileSystematicName(graph('CCC(C(=O)O)C(C)C'),'2-ethyl-3-methylbutanoic acid'),null,'nonautomorphic longest-parent tie');
  assert.equal(mapStructuralRegions(graph('CC(C)CC(=O)O'),graph('CCC(C)C(=O)O'),[]),null);
  assert.equal(analyzeStructuralEquivalence(graph('C[C@H](O)C(=O)O'),graph('C[C@@H](O)C(=O)O')),null);
  const isotope=graph('CC(C)CC(=O)O');isotope.atoms[0].massNumber=13;
  assert.equal(reconcileSystematicName(isotope,'3-methylbutanoic acid'),null);
  const edited=graph('CC(C)CC(=O)O');
  assert.equal(reconcileSystematicName(edited,'3-methylbutanoic acid')?.status,'FULL');
  edited.atoms[0].massNumber=13;
  assert.equal(reconcileSystematicName(edited,'3-methylbutanoic acid'),null,'a cached proof cannot erase a newly introduced isotope');
  delete edited.atoms[0].massNumber; edited.atoms[1].tetrahedralParity='R';
  assert.equal(reconcileSystematicName(edited,'3-methylbutanoic acid'),null,'a cached proof cannot erase explicit stereo');
  assert.equal(moleculeFromSmiles('[13CH3]C(C)CC(=O)O').ok,false);
  assert.equal(reconcileSystematicName(graph('CC[C@H](C)C(=O)O'),'2-methylbutanoic acid'),null);
});

for(const f of records)test(`neutral fused import, graph identity and honest partial analysis: ${f.name}`,()=>{
  const g=graph(f.SMILES),inspection=inspectSmilesStructure(f.SMILES);
  assert.equal(inspection.ok,true);assert.equal(inspection.formula,f.MolecularFormula);
  assert.equal(g.rings.length,2);assert.deepEqual(g.rings.map(r=>r.atomIds.length).sort(),[5,6]);
  assert.equal(g.rings[0].atomIds.filter(id=>g.rings[1].atomIds.includes(id)).length,2);
  assert.equal(g.atoms.filter(a=>a.element==='N').length,4);
  const exported=moleculeToSmiles(g);assert.equal(exported.ok,true);
  const reimported=graph(exported.smiles);assert.ok(mapStructuralRegions(g,reimported,[]));
  assert.equal(inspectSmilesStructure(exported.smiles).formula,f.MolecularFormula);
  const partial=deriveStructuralComponents(g,f.IUPACName);assert.equal(partial.status,'PARTIAL');
  assert.equal(reconcileSystematicName(g,f.IUPACName),null,'import does not create purine numbering or full nomenclature');
  const ring=partial.components.find(c=>c.kind==='ringSystem');assert.equal(ring.atomIds.length,9);
  assert.deepEqual(structuralVisualTargets(partial)[ring.id].atomIds,ring.atomIds);
  const positions=calculateMolecule2DLayout(g,[],'semi-developed');
  for(const r of g.rings){const area=Math.abs(r.atomIds.reduce((n,id,i)=>{const a=positions.get(id),b=positions.get(r.atomIds[(i+1)%r.atomIds.length]);return n+a.x*b.y-b.x*a.y;},0))/2;assert.ok(area>10000);}
});
test('caffeine exact N-methyl, carbonyl and fusion regions',()=>{
  const g=graph(records.find(f=>f.name==='caffeine').SMILES),partial=deriveStructuralComponents(g,'caffeine');
  assert.equal(g.atoms.length,14);assert.equal(g.bonds.length,15);
  assert.deepEqual(partial.components.filter(c=>c.kind==='N-bound methyl').map(c=>sorted(c.atomIds)).sort(),[[1,2],[9,14],[12,13]].sort());
  assert.deepEqual(g.bonds.filter(([a,b,o])=>o===2&&(g.atoms.find(x=>x.id===a).element==='O'||g.atoms.find(x=>x.id===b).element==='O')).map(([a,b])=>sorted([a,b])).sort(),[[7,8],[10,11]].sort());
  const aromatic=graph('Cn1c(=O)c2c(ncn2C)n(C)c1=O');assert.ok(mapStructuralRegions(g,aromatic,[]));
});
test('invalid valence, broken closure, unsupported charges and isotope loss stay rejected',()=>{
  for(const s of ['C1CC','CO(C)C','CN1C=NC2=C1C(=O)N(C(=O)N2C)(C)C','C[N](C)(C)C','[13CH3]N1C=NC2=C1C(=O)N(C(=O)N2C)C'])assert.equal(moleculeFromSmiles(s).ok,false,s);
});
test('tautomers and methylation isomers are not silently normalized together',()=>{
  assert.equal(mapStructuralRegions(graph(records.find(f=>f.name==='theobromine').SMILES),graph(records.find(f=>f.name==='theophylline').SMILES),[]),null);
  const keto=graph(records.find(f=>f.name==='xanthine').SMILES),enol=graph('Oc1nc(O)c2[nH]cnc2n1');
  assert.equal(mapStructuralRegions(keto,enol,[]),null);
});
