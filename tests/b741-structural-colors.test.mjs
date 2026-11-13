import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {classifyValidatedStructureColors,structuralBondKey} from '../app/structural-color-classification.ts';

const cases=[
 ['Oc1ccccc1','phenol','alcohol'],
 ['Nc1ccccc1','aniline','amine'],
 ['O=C(O)c1ccccc1','benzoic acid','carboxylicAcid'],
 ['O=C1CCC(C)CC1','4-methylcyclohexanone','ketone'],
 ['CCC=O','propanal','aldehyde'],
 ['CCN(CC)C(=O)c1cc(F)cc(F)c1','N,N-diethyl-3,5-difluorobenzamide','amide'],
 ['COC(=O)c1cc(Br)c(OC)cc1','methyl 3-bromo-4-methoxybenzoate','ester'],
 ['N#Cc1ccc(F)c(F)c1','3,4-difluorobenzonitrile','nitrile'],
];
test('verified functional regions receive their own color while preserving parent membership',()=>{
 for(const [smiles,name,group] of cases){const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);const graph=parsed.molecule,proof=reconcileSystematicName(graph,name);assert.ok(proof,name);assert.equal(proof.principalGroup,group);
  const suffix=proof.components.find(c=>c.role==='suffix'),colors=classifyValidatedStructureColors(graph,proof);assert.ok(suffix&&colors);
  for(const id of suffix.atomIds)assert.equal(colors.atoms.get(id),'functional',name);
  for(const [a,b] of suffix.bondIds)assert.equal(colors.bonds.get(structuralBondKey(a,b)),'functional',name);
  if(group==='ester'){const alkyl=proof.components.find(c=>c.parentId==='suffix'&&c.role==='substituent');assert.ok(alkyl);for(const id of alkyl.atomIds)assert.equal(colors.atoms.get(id),'substituent');for(const [a,b] of alkyl.bondIds)assert.equal(colors.bonds.get(structuralBondKey(a,b)),'substituent');}
  for(const id of proof.parentAtomIds.filter(id=>suffix.atomIds.includes(id)))assert.ok(colors.membership.parentAtoms.has(id));
  const moved=structuredClone(graph);for(const a of moved.atoms){const x=a.x;a.x=-a.y;a.y=x+100;}
  assert.deepEqual(classifyValidatedStructureColors(moved,proof),colors);
  const ids=new Map(graph.atoms.map(atom=>[atom.id,atom.id+1000]));
  const remapped={...graph,atoms:graph.atoms.map(a=>({...a,id:ids.get(a.id)})),bonds:graph.bonds.map(([a,b,...rest])=>[ids.get(a),ids.get(b),...rest])};
  const remappedProof={...proof,parentAtomIds:proof.parentAtomIds.map(id=>ids.get(id)),components:proof.components.map(c=>({...c,atomIds:c.atomIds.map(id=>ids.get(id)),bondIds:c.bondIds.map(([a,b])=>[ids.get(a),ids.get(b)])}))};
  const transformed=classifyValidatedStructureColors(remapped,remappedProof);for(const [id,category] of colors.atoms)assert.equal(transformed.atoms.get(ids.get(id)),category);
 }
 assert.equal(classifyValidatedStructureColors({atoms:[],bonds:[]},null),null);
});
test('a verified hydrocarbon with prefixes never receives a functional color',()=>{
 const p=moleculeFromSmiles('Cc1ccc(Cl)cc1'),proof=reconcileSystematicName(p.molecule,'1-chloro-4-methylbenzene');assert.ok(proof);
 const colors=classifyValidatedStructureColors(p.molecule,proof);assert.ok([...colors.atoms.values()].includes('substituent'));
 assert.ok(![...colors.atoms.values(),...colors.bonds.values()].includes('functional'));
 assert.equal(classifyValidatedStructureColors(p.molecule,{...proof,status:'PARTIAL'}),null);
});
