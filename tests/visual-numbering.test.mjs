import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedVisualNumbering } from "../app/visual-numbering.ts";

const smiles = "CC(=O)Oc1ccccc1C(=O)O";
const names = ["2-acetyloxybenzoic acid", "2-(acetyloxy)benzoic acid"];
const imported = source => {
  const result = moleculeFromSmiles(source);
  assert.equal(result.ok, true, result.error);
  return result.molecule;
};
const edge = (a, b) => `${Math.min(a,b)}:${Math.max(a,b)}`;

function verifyAspirin(graph, name) {
  const derivation = reconcileSystematicName(graph, name);
  assert.equal(derivation?.status, "FULL", name);
  const parent = derivation.components.find(component => component.id === "parent");
  const suffix = derivation.components.find(component => component.id === "suffix");
  const acyloxy = derivation.components.find(component => component.id === "acyloxy");
  const numbering = buildValidatedVisualNumbering(graph, derivation);
  const ring = graph.rings.find(item => item.kind === "aromatic" && item.atomIds.length === 6
    && item.atomIds.every(id => parent.atomIds.includes(id)));
  assert.ok(ring, "the FULL benzoic parent contains a validated aromatic six-member ring");
  const positions = new Map([...ring.atomIds].map(id => [numbering.get(id), id]));
  assert.deepEqual([...positions.keys()].sort((a,b) => a-b), [1,2,3,4,5,6]);
  const ringEdges = graph.bonds.filter(([a,b]) => ring.atomIds.includes(a) && ring.atomIds.includes(b));
  assert.equal(ringEdges.length, 6);
  assert.ok(ringEdges.every(([a,b]) => numbering.has(a) && numbering.has(b)));
  for (let locant=1; locant<=6; locant++) {
    const current=positions.get(locant), next=positions.get(locant===6?1:locant+1);
    assert.ok(ringEdges.some(([a,b]) => edge(a,b)===edge(current,next)), `C${locant} follows the closed ring`);
  }

  const c1=positions.get(1), c2=positions.get(2);
  const carbonyl=parent.atomIds.find(id => graph.atoms.find(atom=>atom.id===id)?.element==="C"
    && graph.bonds.some(([a,b,order]) => order===2 && (a===id && graph.atoms.find(atom=>atom.id===b)?.element==="O"
      || b===id && graph.atoms.find(atom=>atom.id===a)?.element==="O")));
  assert.ok(carbonyl && carbonyl!==c1 && !ring.atomIds.includes(carbonyl), "acid carbonyl is outside aromatic C1");
  assert.ok(graph.bonds.some(([a,b]) => edge(a,b)===edge(c1,carbonyl)), "aromatic C1 is directly bonded to the acid carbonyl carbon");
  const etherO=acyloxy.atomIds.find(id => graph.atoms.find(atom=>atom.id===id)?.element==="O"
    && graph.bonds.some(([a,b])=>edge(a,b)===edge(id,c2)));
  assert.ok(etherO, "aromatic C2 is directly bonded to the acetyloxy oxygen");
  assert.ok(!numbering.has(carbonyl));
  for (const id of acyloxy.atomIds) if (!ring.atomIds.includes(id)) assert.ok(!numbering.has(id), `acyloxy atom ${id} has no ring locant`);
  return { derivation, numbering, ring };
}

test("aspirin FULL names expand the verified aromatic numbering from C1 through C6", () => {
  const graph=imported(smiles);
  for (const name of names) verifyAspirin(graph,name);
});

test("aspirin ring numbering is stable across equivalent SMILES and permuted atom IDs", () => {
  const sources=[smiles,"O=C(O)c1ccccc1OC(C)=O","O=C(O)c1ccccc1OC(=O)C"];
  let reference;
  for(const source of sources) {
    const graph=imported(source);
    const {derivation,numbering,ring}=verifyAspirin(graph,names[1]);
    const signature=ring.atomIds.map(id=>[numbering.get(id),graph.atoms.find(atom=>atom.id===id)?.element]).sort(([a],[b])=>a-b);
    assert.deepEqual(signature,Array.from({length:6},(_,i)=>[i+1,"C"]));
    if(reference) assert.deepEqual(signature,reference);
    reference=signature;

    const idMap=new Map(graph.atoms.map((atom,index)=>[atom.id,900+(graph.atoms.length-index)*17]));
    const permuted={
      atoms:[...graph.atoms].reverse().map(atom=>({...atom,id:idMap.get(atom.id)})),
      bonds:[...graph.bonds].reverse().map(([a,b,order,stereo])=>[idMap.get(b),idMap.get(a),order,stereo]),
      rings:graph.rings.map(item=>({...item,atomIds:[...item.atomIds].reverse().map(id=>idMap.get(id))})),
    };
    const remapped=reconcileSystematicName(permuted,names[1]);
    assert.equal(remapped?.status,"FULL");
    const remappedNumbering=buildValidatedVisualNumbering(permuted,remapped);
    const remappedRing=permuted.rings.find(item=>item.kind==="aromatic"&&item.atomIds.length===6
      &&item.atomIds.every(id=>remapped.components.find(component=>component.id==="parent").atomIds.includes(id)));
    assert.deepEqual(remappedRing.atomIds.map(id=>[remappedNumbering.get(id),permuted.atoms.find(atom=>atom.id===id)?.element])
      .sort(([a],[b])=>a-b),Array.from({length:6},(_,i)=>[i+1,"C"]));
    assert.equal(derivation.status,"FULL");
  }
});

test("visual numbering keeps explicit locants when aromatic-cycle evidence is missing or ambiguous", () => {
  const graph=imported(smiles), derivation=reconcileSystematicName(graph,names[1]);
  const parent=derivation.components.find(component=>component.id==="parent");
  const explicit=new Map(parent.numbering);
  const oneAnchor={...derivation,components:derivation.components.map(component=>component.id==="parent"
    ? {...component,numbering:component.numbering.filter(([,locant])=>locant===1)} : component)};
  assert.deepEqual([...buildValidatedVisualNumbering(graph,oneAnchor)], [...new Map(parent.numbering.filter(([,locant])=>locant===1))]);
  assert.deepEqual([...buildValidatedVisualNumbering({...graph,rings:[]},derivation)], [...explicit]);
  const c1=parent.numbering.find(([,locant])=>locant===1)[0], c2=parent.numbering.find(([,locant])=>locant===2)[0];
  const broken={...graph,bonds:graph.bonds.filter(([a,b])=>edge(a,b)!==edge(c1,c2))};
  assert.deepEqual([...buildValidatedVisualNumbering(broken,derivation)], [...explicit]);
  assert.deepEqual([...buildValidatedVisualNumbering(graph,null)], []);
});

test("aromatic locant expansion does not borrow ring positions for ibuprofen or paracetamol", () => {
  for(const [source,name] of [
    ["CC(C)Cc1ccc(cc1)C(C)C(=O)O","2-[4-(2-methylpropyl)phenyl]propanoic acid"],
    ["CC(=O)Nc1ccc(O)cc1","N-(4-hydroxyphenyl)acetamide"],
    ["c1ccccc1","benzene"],
  ]) {
    const graph=imported(source), derivation=reconcileSystematicName(graph,name);
    if(name==="benzene") {
      assert.equal(derivation,null,"benzene retains its existing non-FULL path");
      assert.deepEqual([...buildValidatedVisualNumbering(graph,derivation)],[]);
      continue;
    }
    assert.equal(derivation?.status,"FULL",name);
    const numbering=buildValidatedVisualNumbering(graph,derivation);
    const parent=derivation.components.find(component=>component.role==="parent");
    for(const [id,locant] of parent.numbering) assert.equal(numbering.get(id),locant);
    if(name==="2-[4-(2-methylpropyl)phenyl]propanoic acid")
      assert.deepEqual([...numbering],parent.numbering);
  }
});
