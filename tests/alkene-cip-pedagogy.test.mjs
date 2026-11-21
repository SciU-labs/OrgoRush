import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { formatStereochemicalName, inspectDoubleBondCipPriorities, getMainChainStereoDescriptors } from "../app/double-bond-stereochemistry.ts";
import { getMainChainTetrahedralDescriptors } from "../app/tetrahedral-stereochemistry.ts";
import { deriveReasoningNameFragments } from "../app/reasoning-name-fragments.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { observe, project } from "./helpers/reasoning-integrity.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

const references = [
  ["maleic acid", "O=C(O)/C=C\\C(=O)O", "Z", 1],
  ["fumaric acid", "O=C(O)/C=C/C(=O)O", "E", 1],
  ["geraniol", "CC(=CCC/C(=C/CO)/C)C", "E", 1],
  ["nerol", "CC(=CCC/C(=C\\CO)/C)C", "Z", 1],
  ["sorbic acid", "C/C=C/C=C/C(=O)O", "E", 2],
  ["oleic acid", "CCCCCCCC/C=C\\CCCCCCCC(=O)O", "Z", 1],
  ["elaidic acid", "CCCCCCCC/C=C/CCCCCCCC(=O)O", "E", 1],
];

function configuredAlkenes(molecule) {
  return molecule.bonds.filter(bond => (bond[2] ?? 1) === 2 && bond[3] === true)
    .map(([a, b]) => inspectDoubleBondCipPriorities(molecule, a, b))
    .filter(Boolean);
}

test("reference E/Z structures expose exact CIP-ranked branch regions and preserve atom identity under permutation", () => {
  for (const [label, smiles, expected, count] of references) {
    const imported = moleculeFromSmiles(smiles);
    assert.equal(imported.ok, true, `${label}: ${imported.error}`);
    const graph = imported.molecule, alkenes = configuredAlkenes(graph);
    assert.equal(alkenes.length, count, `${label} explicit stereogenic bonds`);
    if (count === 1) assert.equal(alkenes[0].configuration, expected, label);
    else assert.ok(alkenes.every(item => item.configuration === expected), label);
    for (const evidence of alkenes) {
      assert.deepEqual(evidence.sides.map(side => side.map(item => item.rank)), [[1, 2], [1, 2]]);
      assert.ok(evidence.sides.flatMap(side => side).filter(item => item.atomId !== null)
        .every(item => item.branchAtomIds.includes(item.atomId) && item.branchBondIds.length > 0));
    }
    const permutation = id => 1000 + id * 13;
    const permuted = { ...graph,
      atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: permutation(atom.id) })),
      bonds: [...graph.bonds].reverse().map(([a, b, order, explicit]) => [permutation(b), permutation(a), order, explicit]) };
    const permutedEvidence = configuredAlkenes(permuted);
    for (const original of alkenes) {
      const mappedEndpoints = original.atomIds.map(permutation).sort((a,b)=>a-b);
      const mapped = permutedEvidence.find(item => item.atomIds.map(id => id).sort((a,b)=>a-b).join(":") === mappedEndpoints.join(":"));
      assert.ok(mapped, `${label} alkene endpoint mapping`);
      assert.equal(mapped.configuration, original.configuration, `${label} CIP invariant`);
      for (let side = 0; side < 2; side += 1) {
        const mappedCenter = permutation(original.atomIds[side]);
        const mappedSideIndex = mapped.atomIds.indexOf(mappedCenter);
        for (const priority of [1, 2]) {
          const expectedRegion = original.sides[side].find(item => item.rank === priority).branchAtomIds.map(permutation).sort((a,b)=>a-b);
          const actualRegion = mapped.sides[mappedSideIndex].find(item => item.rank === priority).branchAtomIds.sort((a,b)=>a-b);
          assert.deepEqual(actualRegion, expectedRegion, `${label} mapped C=C-end selection priority ${priority}`);
        }
      }
    }
  }
});

test("equivalent ligands and unspecified geometry never create E/Z evidence", () => {
  const equivalent = moleculeFromSmiles("CC=C(C)C").molecule;
  const equivalentBond = equivalent.bonds.find(([a,b,order]) => order === 2);
  assert.equal(inspectDoubleBondCipPriorities(equivalent, equivalentBond[0], equivalentBond[1]), null);
  const unspecified = moleculeFromSmiles("CC=CC").molecule;
  assert.equal(unspecified.bonds.some(bond => bond[3] === true), false);
  assert.deepEqual(configuredAlkenes(unspecified), []);
});

test("an assigned R/S center and E/Z bond are named and reasoned independently", () => {
  const graph = moleculeFromSmiles("C/C=C/[C@H](O)CC").molecule;
  const analysis = chemistry.engine.analyzeMolecule(graph);
  const ez = getMainChainStereoDescriptors(graph, analysis.mainChain, true);
  const rs = getMainChainTetrahedralDescriptors(graph, analysis.mainChain);
  assert.equal(ez.length, 1);
  assert.equal(rs.length, 1);
  const name = formatStereochemicalName(graph, analysis.mainChain, analysis.name, { explicitDoubleBonds: true });
  assert.match(name, new RegExp(`${rs[0].locant}${rs[0].configuration}`));
  assert.match(name, new RegExp(`${ez[0].locant}${ez[0].configuration}`));
  const steps = chemistry.engine.buildIupacReasoningSteps(graph, analysis, [], undefined,
    { profile: "blue-book-2013", displayedName: name, generatedNames: [name] });
  const stereoStep = steps.find(step => step.nameRole === "stereo");
  assert.ok(stereoStep);
  assert.equal(stereoStep.stereoDescriptors.length, 1);
  assert.equal(stereoStep.tetrahedralDescriptors.length, 1);
  const fragments = deriveReasoningNameFragments({ analysis, molecule: graph, displayedName: name,
    generatedNames: [name], language: "en", steps, canHighlight: true });
  const all = Object.values(fragments).flatMap(item => [item, ...(item.additionalFragments ?? [])]);
  assert.ok(all.some(item => item.semanticId === `stereo:ez:${ez[0].locant}`));
  assert.ok(all.some(item => item.semanticId?.startsWith("stereo:ez:") && item.semanticId.endsWith(":priority1")));
  assert.match(steps.find(step => step.nameRole === "stereo").explanation, /primer punto donde difieren|tiene prioridad/i);
});

test("application reasoning maps every E/Z descriptor, parent locant and CIP branch to the source graph", () => {
  for (const [label, smiles, , count] of [references[0], references[4], references[5]]) {
    const observed = observe(chemistry.engine, smiles);
    const model = project(chemistry.engine, observed, "2013-en");
    const step = model.steps.find(item => item.nameRole === "stereo");
    assert.ok(step, `${label} stereochemistry step`);
    const descriptors = getMainChainStereoDescriptors(observed.molecule, model.analysis.mainChain, true);
    assert.equal(descriptors.length, count, `${label} numbered E/Z descriptors`);
    const fragments = [model.fragments[step.number], ...(model.fragments[step.number]?.additionalFragments ?? [])];
    for (const descriptor of descriptors) {
      const bondCard = fragments.find(fragment => fragment.semanticId === `stereo:ez:${descriptor.locant}`);
      assert.ok(bondCard, `${label} descriptor selection`);
      assert.deepEqual(bondCard.atomIds, descriptor.atomIds);
      assert.deepEqual(bondCard.bondIds, [descriptor.atomIds]);
      for (const endpoint of [descriptor.locant, descriptor.locant + 1]) {
        for (const priority of [1, 2]) {
          const branch = fragments.find(fragment => fragment.semanticId === `stereo:ez:${descriptor.locant}:C${endpoint}:priority${priority}`);
          const evidence = inspectDoubleBondCipPriorities(observed.molecule, ...descriptor.atomIds);
          const side = evidence.sides[endpoint - descriptor.locant].find(item => item.rank === priority);
          if (side.atomId === null) assert.equal(branch, undefined, "implicit hydrogen has no invented atom highlight");
          else {
            assert.ok(branch, `${label} C${endpoint} priority ${priority}`);
            assert.deepEqual([...branch.atomIds].sort((a,b)=>a-b), [...side.branchAtomIds].sort((a,b)=>a-b));
            assert.deepEqual(branch.bondIds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":" )).sort(),
              side.branchBondIds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":" )).sort());
          }
        }
      }
    }
  }
});
