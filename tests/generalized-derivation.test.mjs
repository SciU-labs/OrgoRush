import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generalizationCases, generalizationEdges } from './fixtures/generalized-derivation.mjs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName, validatedNameTargets } from '../app/validated-name-derivation.ts';
import { deriveStructuralComponents } from '../app/structural-derivation.ts';
import { createCompoundContextResolver } from '../app/compound-context.ts';
import { calculateMolecule2DLayout } from '../app/molecule-2d-layout.ts';
const imported=s=>{const r=moleculeFromSmiles(s);assert.equal(r.ok,true,r.error);return r.molecule;};
const sorted=ids=>[...ids].sort((a,b)=>a-b);
for(const f of generalizationCases)test(`generalization: ${f.common}`,()=>{
  const graph=imported(f.smiles),model=reconcileSystematicName(graph,f.name);
  if(f.expected==='SYMMETRIC_FULL') {
    assert.equal(model?.status,'FULL');
    assert.deepEqual(model.symmetry.assignments.map(a=>sorted(a.parentAtomIds)).sort(),[[1,2,4,5],[2,3,4,5]]);
    for(const a of model.symmetry.assignments)assert.equal(a.parentAtomIds.length,4);
    assert.equal(deriveStructuralComponents(graph,f.name).status,'PARTIAL','structural evidence alone still does not imply full naming');
    return;
  }
  assert.equal(model?.status,'FULL');
  assert.deepEqual(sorted(model.parentAtomIds),f.parent);
  assert.deepEqual(sorted(model.components.find(c=>c.id===f.component).atomIds),f.prefix);
  assert.deepEqual(model.components.find(c=>c.id===f.component).bondIds.map(([a,b])=>sorted([a,b]).join(':')).sort(),generalizationEdges[f.common].toSorted());
  const targets=validatedNameTargets(model);
  for(const c of model.components){
    assert.equal(f.name.slice(c.start,c.end),c.text);
    assert.deepEqual(targets[c.id].atomIds,c.atomIds);assert.deepEqual(targets[c.id].bondIds,c.bondIds);
    for(const [a,b] of c.bondIds)assert.ok(graph.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a));
  }
  const ids=new Map(graph.atoms.map(a=>[a.id,a.id*19+300]));
  const permuted={atoms:graph.atoms.map(a=>({...a,id:ids.get(a.id)})).reverse(),bonds:graph.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse()};
  const other=reconcileSystematicName(permuted,f.name);assert.equal(other?.status,'FULL');
  assert.deepEqual(sorted(other.parentAtomIds),sorted(f.parent.map(id=>ids.get(id))));
  assert.deepEqual(sorted(other.components.find(c=>c.id===f.component).atomIds),sorted(f.prefix.map(id=>ids.get(id))));
});
for(const [name,smiles] of [
  ['3-hydroxybenzoic acid','O=C(O)c1cccc(O)c1'],
  ['4-hydroxybenzoic acid','O=C(O)c1ccc(O)cc1'],
  ['3,4-dihydroxybenzoic acid','O=C(O)c1cc(O)c(O)cc1'],
  ['3,4-dimethoxybenzaldehyde','COc1ccc(C=O)cc1OC'],
  ['2-methoxyphenol','COc1ccccc1O'],
  ['3-(2-methylpropyl)benzoic acid','CC(C)Cc1cccc(C(=O)O)c1'],
  ['N-phenylpropanamide','CCC(=O)Nc1ccccc1'],
  ['ethyl 2-hydroxybenzoate','CCOC(=O)c1ccccc1O'],
  ['methyl 3-aminobenzoate','COC(=O)c1cccc(N)c1'],
  ['1-phenylpropan-1-one','CCC(=O)c1ccccc1'],
  ['3-methylpentanoic acid','CCC(C)CC(=O)O'],
  ['2-hydroxybutanamide','CCC(O)C(=O)N'],
  ['3-aminopropanoic acid','NCCC(=O)O'],
  ['2-hydroxypropanal','CC(O)C=O'],
  ['2-hydroxy-6-methylbenzoic acid','Cc1cccc(O)c1C(=O)O'],
])test(`rule variant: ${name}`,()=>assert.equal(reconcileSystematicName(imported(smiles),name)?.status,'FULL'));
test('wrong isomers, nonminimal locants, unsupported priority and malformed prefixes fail closed',()=>{
  const salicylic=imported('O=C(O)c1ccccc1O');
  for(const name of ['3-hydroxybenzoic acid','4-hydroxybenzoic acid','6-hydroxybenzoic acid','2-hydroxibenzoic acid','2-hydroxy-benzoic acid'])assert.equal(reconcileSystematicName(salicylic,name),null,name);
  assert.equal(reconcileSystematicName(imported('CCOC(=O)c1ccc(N)cc1'),'ethyl 3-aminobenzoate'),null);
  assert.equal(reconcileSystematicName(imported('COc1cc(C=O)ccc1O'),'3-hydroxy-4-methoxybenzaldehyde'),null);
  assert.equal(reconcileSystematicName(imported('O=C(O)C(CC)C'),'2-ethylpropanoic acid'),null,'parent is too short');
  assert.equal(reconcileSystematicName(imported('COc1ccccc1O'),'2-hydroxyanisole'),null,'principal hydroxyl naming is not implemented as this parent');
  assert.equal(reconcileSystematicName(imported('Oc1ccccc1O'),'2-hydroxyphenol'),null,'polyols require their own suffix grammar');
  assert.equal(reconcileSystematicName(imported('C[C@H](O)C(=O)N'),'2-hydroxypropanamide'),null,'explicit stereo cannot be dropped');
  assert.equal(reconcileSystematicName(imported('Cc1cccc(O)c1C(=O)O'),'6-hydroxy-2-methylbenzoic acid'),null,'alphabetical locants break a reflected tie');
});
test('equivalent SMILES and symmetric multiplicative targets retain chemical meaning',()=>{
  assert.equal(reconcileSystematicName(imported('Oc1ccccc1C(=O)O'),'2-hydroxybenzoic acid')?.status,'FULL');
  const model=reconcileSystematicName(imported('c1ccc(C(=O)c2ccccc2)cc1'),'diphenylmethanone');
  assert.equal(model?.status,'FULL');assert.equal(model.components.find(c=>c.id==='diphenyl').atomIds.length,12);
  assert.equal(model.components.filter(c=>c.id==='diphenyl').length,1,'equivalent phenyl rings are one multiplicative region');
});
test('provider identity accepts equivalent aromatic traversals but rejects a different graph',async()=>{
  const resolver=createCompoundContextResolver({fetchImpl:async url=>{
    const path=String(url);
    if(path.includes('/cids/'))return Response.json({IdentifierList:{CID:[1183]}});
    if(path.includes('/property/'))return Response.json({PropertyTable:{Properties:[{CID:1183,IUPACName:'4-hydroxy-3-methoxybenzaldehyde',SMILES:'COC1=C(C=CC(=C1)C=O)O',MolecularFormula:'C8H8O3'}]}});
    return Response.json({});
  }});
  const matched=await resolver.resolve({canonicalSmiles:'COc(cc(C=O)cc1)c1O'},'en');
  assert.equal(matched.pubchemStatus,'verified');assert.equal(matched.pubchem.iupacName,'4-hydroxy-3-methoxybenzaldehyde');
  const rejected=await resolver.resolve({canonicalSmiles:'COc1ccc(C=O)cc1'},'en');
  assert.equal(rejected.pubchemStatus,'identity-mismatch');assert.equal(rejected.pubchem,undefined);
});
test('separate imported aromatic rings retain polygons in semi-developed layout',()=>{
  const graph=imported('O=C(c1ccccc1)c1ccccc1'),snapshot=structuredClone(graph);
  const points=calculateMolecule2DLayout(graph,[2],'semi-developed');
  for(const ring of graph.rings){
    const area=Math.abs(ring.atomIds.reduce((sum,id,i)=>{const a=points.get(id),b=points.get(ring.atomIds[(i+1)%ring.atomIds.length]);return sum+a.x*b.y-b.x*a.y;},0))/2;
    assert.ok(area>10000,'each phenyl is a polygon, not an unplaced-atom row');
    for(const [i,a] of ring.atomIds.entries())for(const b of ring.atomIds.slice(i+1))assert.ok(Math.hypot(points.get(a).x-points.get(b).x,points.get(a).y-points.get(b).y)>70);
  }
  assert.deepEqual(graph,snapshot,'layout must not mutate the molecular graph');
});
