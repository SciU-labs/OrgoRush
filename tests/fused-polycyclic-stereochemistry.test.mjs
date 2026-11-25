import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SmilesParser} from 'openchemlib';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {findSaturatedFusedPolycycle,isValidFusedPolycyclicStereochemistry,sanitizeFusedPolycyclicStereochemistry}
  from '../app/fused-polycyclic-stereochemistry.ts';
import {GONANE_REFERENCES,reconcileGonaneStereoName} from '../app/gonane-stereo-grammar.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';

const alpha=GONANE_REFERENCES['5α'].smiles;
const beta=GONANE_REFERENCES['5β'].smiles;
const xi=GONANE_REFERENCES['5ξ'].smiles;

test('recognizes gonane by its full 6–6–6–5 fused graph, three shared bonds and C17H28 formula',()=>{
  for(const smiles of [alpha,beta,xi]){
    const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true);
    const graph=imported.molecule,topology=findSaturatedFusedPolycycle(graph,[5,6,6,6]);
    assert.ok(topology);assert.equal(graph.atoms.length,17);assert.equal(graph.bonds.length,20);
    assert.deepEqual([...topology.ringSizes].sort((a,b)=>a-b),[5,6,6,6]);
    assert.equal(topology.junctions.length,3);
    assert.equal(new Set(topology.junctions.flatMap(j=>j.fusionAtomIds)).size,6);
    for(const junction of topology.junctions)assert.ok(graph.bonds.some(([a,b])=>new Set([a,b]).size===2
      &&[a,b].sort((x,y)=>x-y).join(',')===junction.fusionBond.slice().sort((x,y)=>x-y).join(',')));
    assert.equal(isValidFusedPolycyclicStereochemistry(graph),true);
  }
});

test('5α and 5β references reconcile independently in both languages and remain distinct',()=>{
  const a=moleculeFromSmiles(alpha),b=moleculeFromSmiles(beta);assert.equal(a.ok,true);assert.equal(b.ok,true);
  for(const [graph,descriptor] of [[a.molecule,'5α'],[b.molecule,'5β']]){
    const en=reconcileSystematicName(graph,`${descriptor}-gonane`),es=reconcileSystematicName(graph,`${descriptor}-gonano`);
    assert.equal(en?.status,'FULL');assert.equal(en?.preferred,false);assert.equal(en?.evidence?.language,'en');
    assert.equal(es?.status,'FULL');assert.equal(es?.preferred,false);assert.equal(es?.evidence?.language,'es');
    assert.equal(en?.evidence?.construction,'fused-gonane-stereo');
    assert.deepEqual(en?.components.find(c=>c.id==='gonane-locants')?.numbering.map(x=>x[1]),Array.from({length:17},(_,i)=>i+1));
    assert.deepEqual(en?.components.filter(c=>c.id.startsWith('gonane-fusion-')).map(c=>c.label),[
      'fusion C5–C10','fusion C8–C9','fusion C13–C14']);
  }
  assert.notEqual(a.molecule.fusedPolycyclicStereo.identityCode,b.molecule.fusedPolycyclicStereo.identityCode);
  assert.equal(reconcileGonaneStereoName(a.molecule,'5β-gonane'),null);
  assert.equal(reconcileGonaneStereoName(b.molecule,'5α-gonane'),null);
});

test('unspecified and partially specified gonane never receive a stereospecific FULL name',()=>{
  const unspecified=xi.replace(/\[C[@]H\]|\[C@@H\]/g,'C');
  for(const smiles of [unspecified,xi]){
    const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true);
    assert.notEqual(reconcileSystematicName(imported.molecule,'5α-gonane')?.status,'FULL');
    assert.notEqual(reconcileSystematicName(imported.molecule,'5β-gonane')?.status,'FULL');
  }
  const partial=moleculeFromSmiles(xi);assert.equal(partial.ok,true);
  assert.equal(partial.molecule.fusedPolycyclicStereo.specification,'partial');
  assert.equal(reconcileSystematicName(partial.molecule,'5ξ-gonane')?.status,'FULL',
    'ξ explicitly records the audited unresolved C5 configuration while the other parent stereochemistry is specified');
  assert.equal(reconcileSystematicName(partial.molecule,'5ξ-gonano')?.evidence?.language,'es');
});

test('conventional numbering and 5α/5β identity survive alternative isomeric SMILES atom orders',()=>{
  for(const [smiles,descriptor] of [[alpha,'5α'],[beta,'5β'],[xi,'5ξ']]){
    const parsed=new SmilesParser().parseMolecule(smiles);
    const alternative=parsed.toIsomericSmiles();assert.notEqual(alternative,smiles);
    const reference=moleculeFromSmiles(smiles),reordered=moleculeFromSmiles(alternative);
    assert.equal(reference.ok,true);assert.equal(reordered.ok,true);
    assert.equal(reordered.molecule.fusedPolycyclicStereo.identityCode,reference.molecule.fusedPolycyclicStereo.identityCode);
    const map=reordered.molecule.fusedPolycyclicStereo.locantAtomIds;
    assert.deepEqual(Object.keys(map).sort((a,b)=>Number(a)-Number(b)),Array.from({length:17},(_,i)=>String(i+1)));
    for(const [left,right] of [[5,10],[8,9],[13,14]])assert.ok(reordered.molecule.bonds.some(([a,b])=>
      new Set([a,b]).size===2&&[a,b].sort((x,y)=>x-y).join(',')===[map[String(left)],map[String(right)]].sort((x,y)=>x-y).join(',')));
    for(const members of [[1,2,3,4,5,10],[5,6,7,8,9,10],[8,9,11,12,13,14],[13,14,15,16,17]]){
      const expected=members.map(n=>map[String(n)]);
      assert.ok(reordered.molecule.rings.some(r=>r.atomIds.length===expected.length&&expected.every(id=>r.atomIds.includes(id))));
    }
    assert.equal(reconcileSystematicName(reordered.molecule,`${descriptor}-gonane`)?.status,'FULL');
  }
});

test('numbering and stereo validation do not depend on ring-array order or cycle traversal direction',()=>{
  const imported=moleculeFromSmiles(alpha);assert.equal(imported.ok,true);const graph=imported.molecule;
  const rearranged={...graph,rings:[...graph.rings].reverse().map(ring=>({...ring,atomIds:[...ring.atomIds].reverse()}))};
  assert.equal(isValidFusedPolycyclicStereochemistry(rearranged),true);
  assert.equal(reconcileSystematicName(rearranged,'5α-gonane')?.status,'FULL');
  assert.deepEqual(reconcileSystematicName(rearranged,'5α-gonane').components.find(c=>c.id==='gonane-fusion-1').label,'fusion C5–C10');
});

test('polycyclic metadata rejects edited stereo, forged identities, and broken fusion while preserving coordinate changes',()=>{
  const imported=moleculeFromSmiles(alpha);assert.equal(imported.ok,true);const graph=imported.molecule,metadata=graph.fusedPolycyclicStereo;assert.ok(metadata);
  assert.equal(isValidFusedPolycyclicStereochemistry({...graph,atoms:graph.atoms.map((atom,index)=>index===3?{...atom,tetrahedralParity:'R'}:atom)}),false);
  assert.equal(isValidFusedPolycyclicStereochemistry({...graph,fusedPolycyclicStereo:{...metadata,identityCode:'forged'}}),false);
  assert.equal(sanitizeFusedPolycyclicStereochemistry({...graph,bonds:graph.bonds.slice(1)}).fusedPolycyclicStereo,undefined);
  const moved={...graph,atoms:graph.atoms.map((atom,index)=>({...atom,x:atom.x+index/10,y:atom.y-index/20}))};
  assert.equal(isValidFusedPolycyclicStereochemistry(moved),true);
  const exported=moleculeToSmiles(moved);assert.equal(exported.ok,true);
  const restored=moleculeFromSmiles(exported.smiles);assert.equal(restored.ok,true);
  assert.equal(restored.molecule.fusedPolycyclicStereo.identityCode,metadata.identityCode);
});

test('recognizer rejects wrong ring sizes, unsaturation, heteroatoms, substituents and non-path ring adjacency',()=>{
  const imported=moleculeFromSmiles(alpha);assert.equal(imported.ok,true);const graph=imported.molecule;
  assert.equal(findSaturatedFusedPolycycle(graph,[5,5,6,6]),null);
  assert.equal(findSaturatedFusedPolycycle({...graph,bonds:graph.bonds.map((bond,index)=>index===0?[bond[0],bond[1],2]:bond)},[5,6,6,6]),null);
  assert.equal(findSaturatedFusedPolycycle({...graph,atoms:graph.atoms.map((atom,index)=>index===0?{...atom,element:'O'}:atom)},[5,6,6,6]),null);
  assert.equal(findSaturatedFusedPolycycle({...graph,rings:graph.rings.map((ring,index)=>index===0?{...ring,atomIds:ring.atomIds.slice(1)}:ring)},[5,6,6,6]),null);
  const substituted={...graph,atoms:[...graph.atoms,{id:18,x:0,y:0,element:'C'}],bonds:[...graph.bonds,[1,18,1]]};
  assert.equal(findSaturatedFusedPolycycle(substituted,[5,6,6,6]),null);
});

test('variable-length fusion topology still recognizes a saturated three-ring path',()=>{
  const graph=moleculeFromSmiles('C1CCC2CC3CCCCC3CC2C1');assert.equal(graph.ok,true);
  const path=findSaturatedFusedPolycycle(graph.molecule,[6,6,6]);assert.ok(path);assert.equal(path.junctions.length,2);
});

test('imported gonane coordinates depict three fused six-rings and one fused five-ring without duplicated atoms',()=>{
  const imported=moleculeFromSmiles(alpha);assert.equal(imported.ok,true);const graph=imported.molecule;
  assert.deepEqual(graph.rings.map(r=>r.atomIds.length).sort((a,b)=>a-b),[5,6,6,6]);
  assert.equal(new Set(graph.atoms.map(a=>`${a.x.toFixed(6)},${a.y.toFixed(6)}`)).size,17);
  for(const [a,b] of graph.bonds){const left=graph.atoms.find(atom=>atom.id===a),right=graph.atoms.find(atom=>atom.id===b);
    assert.ok(Math.abs(Math.hypot(left.x-right.x,left.y-right.y)-1)<0.03,`bond ${a}-${b} is normalized in the canvas`);}
  const shared=graph.rings.flatMap((ring,index)=>graph.rings.slice(index+1).map(other=>ring.atomIds.filter(id=>other.atomIds.includes(id)).sort((a,b)=>a-b)))
    .filter(pair=>pair.length===2);
  assert.equal(shared.length,3);assert.equal(new Set(shared.flat().join(',').split(',')).size,6);
});
