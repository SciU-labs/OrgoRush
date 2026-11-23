import assert from "node:assert/strict";
import test from "node:test";
import { parseFusedTricyclicArene } from "../app/fused-tricyclic-arene-grammar.ts";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../app/validated-name-derivation.ts";
import { nameRetainedFused1979 } from "../app/iupac1979-retained-fused.ts";
import references from "./fixtures/fused-tricyclic-arene-phase2.json" with { type: "json" };
const records = references.cases;
test("twenty PubChem reference structures reconcile independently in English and Spanish", () => {
  assert.equal(records.length, 20);
  for (const { id, en, es, smiles, cid, url } of records) {
    const reference = moleculeFromSmiles(smiles);
    assert.equal(reference.ok, true, `${id} PubChem CID ${cid} ${url}: ${reference.error}`);
    for (const [language, name] of [["en", en], ["es", es]]) {
      const constructed = parseFusedTricyclicArene(name);
      assert.ok(constructed, `${id} ${language}: parser should recognize the complete name`);
      const proof = reconcileSystematicName(reference.molecule, name);
      assert.equal(proof?.status, "FULL", `${id} ${language}: reference graph must reconcile`);
      assert.equal(proof.evidence.language, language, `${id} ${language}: this language needs independent proof`);
      assert.equal(proof.evidence.equivalence, "complete-graph-isomorphism");
      assert.equal(reconcileSystematicName(constructed.graph, name)?.status, "FULL", `${id} ${language}: independent name construction validates`);
      assert.equal(presentValidatedSystematicName(proof, language).name, name);
    }
    assert.equal(reconcileSystematicName(reference.molecule, en).parentAtomIds.length, 14, `${id}: exactly fourteen reference atoms form the tricyclic parent`);
  }
});

test("both topologies have three unique six-membered rings and stable traditional fusion locants", () => {
  for (const [name, expected] of [["anthracene", ["4a", "8a", "9a", "10a"]], ["phenanthrene", ["4a", "4b", "8a", "10a"]]]) {
    const built = buildHydrocarbonFromIupacName(name);
    assert.equal(built.ok, true, built.error);
    assert.equal(built.molecule.atoms.length, 14);
    assert.equal(built.molecule.rings.length, 3);
    assert.ok(built.molecule.rings.every(ring => ring.atomIds.length === 6));
    const centers = built.molecule.rings.map(ring => {
      const atoms=ring.atomIds.map(id=>built.molecule.atoms.find(atom=>atom.id===id));
      return {x:atoms.reduce((sum,atom)=>sum+atom.x/atoms.length,0),y:atoms.reduce((sum,atom)=>sum+atom.y/atoms.length,0)};
    });
    const [a,b,c]=centers, cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    assert.ok(built.molecule.rings.every(ring=>ring.atomIds.every((id,index)=>{
      const left=built.molecule.atoms.find(atom=>atom.id===id),rightId=ring.atomIds[(index+1)%ring.atomIds.length];
      const right=built.molecule.atoms.find(atom=>atom.id===rightId);
      return Math.abs(Math.hypot(left.x-right.x,left.y-right.y)-1)<1e-8;
    })),`${name}: every fused-ring face keeps regular, shared-edge geometry`);
    if(name==="anthracene")assert.ok(Math.abs(cross)<1e-8,"anthracene ring centers are collinear");
    else assert.ok(Math.abs(cross)>1,"phenanthrene ring centers retain the angular arrangement");
    const result = nameRetainedFused1979(built.molecule);
    assert.equal(result.status, "SUPPORTED");
    assert.equal(result.parentId, name);
    assert.deepEqual([...result.locants.values()].filter(value => /[a-z]/.test(value)).sort(), expected.sort());
    assert.equal(result.topology.fusionEdges.length, 2);
  }
});

test("twelve generated graph variations preserve names and exact attachment locants", () => {
  const seeds = ["1-methylanthracene", "2-methylanthracene", "9-methylanthracene", "1,8-dimethylanthracene",
    "1-methylphenanthrene", "2-methylphenanthrene", "3-methylphenanthrene", "9-methylphenanthrene",
    "9,10-dimethylphenanthrene", "9-bromophenanthrene", "2-chlorophenanthrene", "phenanthren-9-ol"];
  for (const name of seeds) {
    const original = parseFusedTricyclicArene(name);
    assert.ok(original, name);
    const remap = new Map(original.graph.atoms.map((atom, i) => [atom.id, atom.id * 37 + 101 + (i % 3)]));
    const permuted = { atoms: [...original.graph.atoms].reverse().map(atom => ({ ...atom, id: remap.get(atom.id), x: -atom.y, y: atom.x })),
      bonds: [...original.graph.bonds].reverse().map(([a, b, order]) => [remap.get(b), remap.get(a), order]),
      rings: original.graph.rings.map(ring => ({ ...ring, atomIds: ring.atomIds.map(id => remap.get(id)) })) };
    const proof = reconcileSystematicName(permuted, name);
    assert.equal(proof?.status, "FULL", name);
    assert.deepEqual(proof.components.find(component => component.id === "parent").numbering.map(([, locant]) => locant),
      original.components.find(component => component.id === "parent").numbering.map(([, locant]) => locant));
  }
  for(const [smiles,name] of [["c1ccc2cc3ccccc3cc2c1","anthracene"],["C1=CC=C2C=C3C=CC=CC3=CC2=C1","anthracene"],
    ["c1ccc2c(c1)ccc1ccccc12","phenanthrene"],["C1=CC=C2C(=C1)C=CC3=CC=CC=C32","phenanthrene"]]){
    const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true,smiles);
    assert.equal(reconcileSystematicName(imported.molecule,name)?.status,"FULL",`${name}: aromatic/Kekule and traversal variation`);
  }
});

test("other fused systems, wrong regiochemistry, omitted groups, and unsupported chemistry fail closed", () => {
  for (const name of ["tetracene", "pyrene", "fluorene", "chrysene", "naphthacene", "9,10-dihydroanthracene",
    "2,7-dihydroxyanthracene", "anthracen-11-ol", "4a-methylanthracene", "1-methyl-9-bromoanthracene",
    "4-methylanthracene", "10-methylphenanthrene", "4b-chlorophenanthrene"]) assert.equal(parseFusedTricyclicArene(name), null, name);
  const alpha = moleculeFromSmiles("CC1=CC=CC2=CC3=CC=CC=C3C=C12");
  assert.equal(alpha.ok, true);
  assert.equal(reconcileSystematicName(alpha.molecule, "2-methylanthracene")?.status ?? null, null);
  assert.equal(reconcileSystematicName(alpha.molecule, "anthracene"), null, "omitted substituents cannot reconcile");
  assert.equal(parseFusedTricyclicArene("4a-methylanthracene"), null, "fusion atoms cannot carry substituent locants");
  assert.equal(reconcileSystematicName(alpha.molecule,"1-methylanthracene")?.status,"FULL","the reference structure carries locant 1");
  assert.equal(reconcileSystematicName(alpha.molecule,"2-methylanthracene"),null,"an incompatible position cannot reconcile");
  assert.equal(reconcileSystematicName(alpha.molecule,"1-methylphenanthrene"),null,"equal formula does not conflate the angular and linear skeletons");
  for(const [smiles,name] of [["c1cc2ccc3cccc4ccc(c1)c2c34","pyrene"],["c1ccc2c(c1)Cc1ccccc1-2","fluorene"]]){
    const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true,smiles);
    assert.equal(reconcileSystematicName(imported.molecule,name),null,`${name} stays outside the strict current profile`);
  }
  const anthracene=buildHydrocarbonFromIupacName("anthracene").molecule;
  const charged=structuredClone(anthracene);charged.atoms[0].charge=1;
  assert.equal(reconcileSystematicName(charged,"anthracene"),null,"charge changes reject the otherwise matching skeleton");
  const overvalent=structuredClone(anthracene);overvalent.atoms.push({id:90,element:"C",x:8,y:8});overvalent.bonds.push([1,90,1]);
  assert.equal(reconcileSystematicName(overvalent,"anthracene"),null,"added connectivity cannot disappear during name reconciliation");
  const partiallyHydrogenated=moleculeFromSmiles("C1=CC=C2C=C3C=CC=CC3CC2=C1");
  if(partiallyHydrogenated.ok)assert.equal(reconcileSystematicName(partiallyHydrogenated.molecule,"anthracene"),null,"hydrogenation state is part of the graph identity");
});
