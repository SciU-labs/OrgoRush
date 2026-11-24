import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SmilesParser} from 'openchemlib';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {findSaturatedFusedTricycle,isValidFusedTricyclicStereochemistry,sameFusedTricyclicStereoIdentity,sanitizeFusedTricyclicStereochemistry}
  from '../app/fused-tricyclic-stereochemistry.ts';

const fixtures=[
  {name:'tetradecahydroanthracene, PubChem CID 93034',smiles:'C1CCC2CC3CCCCC3CC2C1',topology:'linear'},
  {name:'tetradecahydrophenanthrene, PubChem CID 21971',smiles:'C1CCC2C(C1)CCC3C2CCCC3',topology:'angular'},
];
const stereoFixtures=[
  {name:'Blue Book anthracene PIN (PubChem CID 12635295)',smiles:'C1CC[C@H]2C[C@H]3CCCC[C@H]3C[C@H]2C1',topology:'linear'},
  {name:'NIST cis,syn,cis-perhydrophenanthrene (PubChem CID 12795911)',smiles:'C1CC[C@@H]2[C@H](C1)CC[C@H]3[C@@H]2CCCC3',topology:'angular'},
  {name:'NIST perhydrophenanthrene stereoisomer (PubChem CID 12795910)',smiles:'C1CC[C@@H]2[C@H](C1)CC[C@@H]3[C@H]2CCCC3',topology:'angular'},
  {name:'NIST perhydrophenanthrene stereoisomer (PubChem CID 12795908)',smiles:'C1CC[C@@H]2[C@H](C1)CC[C@H]3[C@H]2CCCC3',topology:'angular'},
];

for(const fixture of fixtures)test(`${fixture.name}: exact saturated tricyclic topology`,()=>{
  const imported=moleculeFromSmiles(fixture.smiles);assert.equal(imported.ok,true);
  const graph=imported.molecule,fusion=findSaturatedFusedTricycle(graph);
  assert.ok(fusion);assert.equal(fusion.topology,fixture.topology);
  assert.equal(graph.atoms.length,14);assert.equal(graph.bonds.length,16);assert.equal(graph.rings.length,3);
  assert.deepEqual(graph.rings.map(ring=>ring.atomIds.length),[6,6,6]);
  assert.equal(fusion.junctions.length,2);
  assert.equal(new Set(fusion.junctions.flatMap(junction=>junction.fusionAtomIds)).size,4);
  for(const junction of fusion.junctions){
    assert.deepEqual([...junction.fusionAtomIds].sort((a,b)=>a-b),[...junction.fusionBond].sort((a,b)=>a-b));
    assert.ok(graph.bonds.some(([a,b])=>[a,b].sort((x,y)=>x-y).join(',')===junction.fusionBond.slice().sort((x,y)=>x-y).join(',')));
  }
  assert.ok(graph.atoms.every(atom=>!atom.tetrahedralParity));
});

test('fused tricycle recognition survives atom order, ring order and cycle direction changes',()=>{
  const imported=moleculeFromSmiles(fixtures[0].smiles);assert.equal(imported.ok,true);
  const graph=imported.molecule;
  const permuted={...graph,atoms:[...graph.atoms].reverse(),bonds:graph.bonds.map(([a,b,o])=>[b,a,o]),rings:[...graph.rings].reverse().map(ring=>({...ring,atomIds:[...ring.atomIds].reverse()}))};
  assert.equal(findSaturatedFusedTricycle(permuted)?.topology,'linear');
});

test('rejects unsaturated, mismatched, or broken-ring graphs and drops stale metadata',()=>{
  const imported=moleculeFromSmiles(fixtures[0].smiles);assert.equal(imported.ok,true);
  const graph=imported.molecule,fusion=findSaturatedFusedTricycle(graph);assert.ok(fusion);
  assert.equal(findSaturatedFusedTricycle({...graph,bonds:graph.bonds.map((bond,index)=>index===0?[bond[0],bond[1],2]:bond)}),null);
  assert.equal(findSaturatedFusedTricycle({...graph,rings:graph.rings.slice(0,2)}),null);
  const metadata=graph.fusedRingSystemStereo;assert.ok(metadata);
  assert.equal(metadata.specification,'unspecified');
  assert.equal(isValidFusedTricyclicStereochemistry(graph),true);
  assert.equal(sanitizeFusedTricyclicStereochemistry(graph).fusedRingSystemStereo,metadata);
  const forged={...graph,fusedRingSystemStereo:{...metadata,identityCode:'verified-code'}};
  assert.equal(isValidFusedTricyclicStereochemistry(forged),false);
  assert.equal(sanitizeFusedTricyclicStereochemistry(forged).fusedRingSystemStereo,undefined);
  const inventedRelation={...graph,fusedRingSystemStereo:{...metadata,junctions:metadata.junctions.map((junction,index)=>index===0
    ?{...junction,relation:'cis'}:junction)}};
  assert.equal(isValidFusedTricyclicStereochemistry(inventedRelation),false);
  const edited={...graph,bonds:graph.bonds.slice(1)};
  assert.equal(sanitizeFusedTricyclicStereochemistry(edited).fusedRingSystemStereo,undefined);
});

test('anthracene and phenanthrene unsaturated controls remain outside the saturated envelope',()=>{
  for(const smiles of ['c1ccc2cc3ccccc3cc2c1','c1ccc2c(c1)ccc1ccccc12']){
    const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true);
    assert.equal(findSaturatedFusedTricycle(imported.molecule),null);
  }
});

test('audited global stereo identities distinguish the two fusion configurations',()=>{
  const molecules=stereoFixtures.map(fixture=>{
    const imported=moleculeFromSmiles(fixture.smiles);assert.equal(imported.ok,true,fixture.name);
    assert.equal(imported.molecule.fusedRingSystemStereo?.topology,fixture.topology,fixture.name);
    assert.equal(imported.molecule.fusedRingSystemStereo?.specification,'complete',fixture.name);
    assert.equal(isValidFusedTricyclicStereochemistry(imported.molecule),true,fixture.name);
    return imported.molecule;
  });
  for(let i=0;i<molecules.length;i++)for(let j=i+1;j<molecules.length;j++)
    assert.equal(sameFusedTricyclicStereoIdentity(molecules[i],molecules[j]),false,`${stereoFixtures[i].name} vs ${stereoFixtures[j].name}`);
});

test('canonical global identity is invariant to an equivalent reordered isomeric SMILES',()=>{
  const reference=moleculeFromSmiles(stereoFixtures[0].smiles);assert.equal(reference.ok,true);
  const parser=new SmilesParser(),alternative=parser.parseMolecule(stereoFixtures[0].smiles).toIsomericSmiles();
  assert.notEqual(alternative,stereoFixtures[0].smiles);
  const reordered=moleculeFromSmiles(alternative);assert.equal(reordered.ok,true);
  assert.equal(sameFusedTricyclicStereoIdentity(reference.molecule,reordered.molecule),true);
});

test('global inversion of the achiral Blue Book anthracene reference is symmetry-equivalent',()=>{
  const listed=moleculeFromSmiles(stereoFixtures[0].smiles);assert.equal(listed.ok,true);
  const inverted=moleculeFromSmiles('C1CC[C@@H]2C[C@@H]3CCCC[C@@H]3C[C@@H]2C1');assert.equal(inverted.ok,true);
  assert.equal(sameFusedTricyclicStereoIdentity(listed.molecule,inverted.molecule),true);
});

test('stereochemistry survives SMILES export, reimport, and coordinate-only changes',()=>{
  for(const fixture of stereoFixtures){
    const imported=moleculeFromSmiles(fixture.smiles);assert.equal(imported.ok,true,fixture.name);
    const exported=moleculeToSmiles(imported.molecule);assert.equal(exported.ok,true,fixture.name);
    const roundtrip=moleculeFromSmiles(exported.smiles);assert.equal(roundtrip.ok,true,fixture.name);
    assert.equal(sameFusedTricyclicStereoIdentity(imported.molecule,roundtrip.molecule),true,fixture.name);
    const moved={...imported.molecule,atoms:imported.molecule.atoms.map((atom,index)=>({...atom,x:atom.x+index*0.125,y:atom.y-index*0.25}))};
    const movedExport=moleculeToSmiles(moved);assert.equal(movedExport.ok,true,fixture.name);
    const movedAgain=moleculeFromSmiles(movedExport.smiles);assert.equal(movedAgain.ok,true,fixture.name);
    assert.equal(sameFusedTricyclicStereoIdentity(imported.molecule,movedAgain.molecule),true,fixture.name);
  }
});

test('structural edits cannot export stale tricyclic stereo metadata',()=>{
  const imported=moleculeFromSmiles(stereoFixtures[0].smiles);assert.equal(imported.ok,true);
  const edited={...imported.molecule,bonds:imported.molecule.bonds.slice(1)};
  const exported=moleculeToSmiles(edited);assert.equal(exported.ok,false);
  const center=imported.molecule.atoms.findIndex(atom=>atom.tetrahedralParity);
  assert.ok(center>=0);
  const current=imported.molecule.atoms[center];
  const stereoEdited={...imported.molecule,atoms:imported.molecule.atoms.map((atom,index)=>index===center
    ?{...atom,tetrahedralParity:atom.tetrahedralParity==='R'?'S':'R'}:atom)};
  assert.equal(moleculeToSmiles(stereoEdited).ok,false);
  assert.ok(current.tetrahedralParity);
});
