import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { getTetrahedralStereoCenters } from "../app/tetrahedral-stereochemistry.ts";
import { inspectTetrahedralCipPriorities } from "../app/double-bond-stereochemistry.ts";
import { presentValidatedSystematicName, reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { alcohols, acids, variants } from "./fixtures/multifunctional-reconciliation.mjs";

const base = "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine";
const achiralSmiles = "CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F";
function imported(smiles) {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  return result.molecule;
}
function permute(graph, transform) {
  return { ...graph,
    atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: transform(atom.id),
      ...(atom.tetrahedralBondTo !== undefined ? { tetrahedralBondTo: transform(atom.tetrahedralBondTo) } : {}) })),
    bonds: [...graph.bonds].reverse().map(([a,b,order,stereo]) => [transform(b),transform(a),order,stereo]),
    rings: graph.rings?.map(ring => ({ ...ring, atomIds:ring.atomIds.map(transform) })) };
}
function fragmentBySemanticId(step, semanticId) {
  return [step.fragments, ...(step.fragments?.additionalFragments ?? [])].find(fragment => fragment?.semanticId === semanticId);
}

test("fluoxetine unspecified, R and S names reconcile only with matching graph configuration", () => {
  const unspecified = imported(achiralSmiles);
  assert.equal(reconcileSystematicName(unspecified, base)?.status, "FULL");
  const unspecReasoning = buildValidatedPriorityReasoning({ derivation: reconcileSystematicName(unspecified, base),
    graph: unspecified, language: "en", activeName: base });
  const unspecStep = unspecReasoning.steps.find(step => step.title === "Stereochemistry");
  assert.ok(unspecStep);
  assert.match(unspecStep.explanation, /No tetrahedral configuration is specified/);
  assert.doesNotMatch(unspecStep.explanation, /descriptor is included/);

  for (const marker of ["@", "@@"]) {
    const graph = imported(`CNCC[C${marker}H](c1ccccc1)Oc1ccc(cc1)C(F)(F)F`);
    const center = getTetrahedralStereoCenters(graph)[0];
    assert.ok(center, "fluoxetine has one assigned tetrahedral center");
    const name = `(3${center.configuration})-${base}`;
    const proof = reconcileSystematicName(graph, name);
    assert.equal(proof?.status, "FULL", name);
    assert.equal(reconcileSystematicName(graph, `(3${center.configuration === "R" ? "S" : "R"})-${base}`), null);
    assert.equal(reconcileSystematicName(graph, base), null, "a configured graph cannot be reconciled to an unmarked name");
    assert.equal(reconcileSystematicName(graph, `(2${center.configuration})-${base}`), null, "wrong stereogenic locant is rejected");
    const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph, language: "en", activeName: name });
    const step = reasoning.steps.find(item => item.title === "Stereochemistry");
    assert.ok(step);
    assert.match(step.explanation, new RegExp(`configuration is ${center.configuration}`));
    assert.match(step.explanation, /at the first atom where the branches differ/i,
      "the comparison explains which atom gives one branch higher priority");
    assert.doesNotMatch(step.explanation, /sphere [2-9]|atomic number/i,
      "internal sphere indices and atomic-number diagnostics stay out of the learner-facing explanation");
    assert.deepEqual([1,2,3].map(rank => fragmentBySemanticId(step, `stereo-ligand:${center.atomId}:${rank}`)?.atomIds?.length > 0), [true,true,true]);
    assert.deepEqual(fragmentBySemanticId(step, `stereo-center:${center.atomId}`)?.atomIds, [center.atomId]);
    const priorities = inspectTetrahedralCipPriorities(graph, center.atomId);
    assert.deepEqual(priorities?.priorities.map(item => item.rank), [1,2,3,4]);

    const transformed = permute(graph, id => 900 + id * 17);
    const remappedProof = reconcileSystematicName(transformed, name);
    assert.equal(remappedProof?.status, "FULL", "atom IDs and order do not determine absolute configuration");
    const remappedCenter = getTetrahedralStereoCenters(transformed)[0];
    assert.equal(remappedCenter.configuration, center.configuration);
    const remappedReasoning = buildValidatedPriorityReasoning({ derivation: remappedProof, graph: transformed,
      language: "en", activeName: name });
    const remappedStep = remappedReasoning.steps.find(item => item.title === "Stereochemistry");
    assert.deepEqual([...fragmentBySemanticId(remappedStep, `stereo-ligand:${remappedCenter.atomId}:1`).atomIds].sort((a,b)=>a-b),
      fragmentBySemanticId(step, `stereo-ligand:${center.atomId}:1`).atomIds.map(id => 900 + id * 17).sort((a,b)=>a-b));
    const moved = { ...graph, atoms: graph.atoms.map((atom,index) => ({ ...atom, x: index * -91, y: index * 53 })) };
    const movedProof = reconcileSystematicName(moved, name);
    assert.equal(movedProof?.status, "FULL");
    const movedReasoning = buildValidatedPriorityReasoning({ derivation: movedProof, graph: moved, language: "en", activeName: name });
    const movedStep = movedReasoning.steps.find(item => item.title === "Stereochemistry");
    assert.deepEqual(fragmentBySemanticId(movedStep, `stereo-ligand:${center.atomId}:1`).atomIds,
      fragmentBySemanticId(step, `stereo-ligand:${center.atomId}:1`).atomIds);
  }
});

test("the same R/S proof has a bilingual pedagogical explanation", () => {
  const graph = imported("CNCC[C@H](c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  const center = getTetrahedralStereoCenters(graph)[0];
  const name = `(3${center.configuration})-${base}`;
  const derivation = reconcileSystematicName(graph, name);
  assert.equal(derivation?.status, "FULL");
  const reasoning = buildValidatedPriorityReasoning({ derivation, graph, language: "es", activeName: name });
  const step = reasoning.steps.find(item => item.title === "Estereoquímica");
  assert.ok(step);
  assert.match(step.explanation, /prioridades CIP distintas/);
  assert.ok(step.fragments.additionalFragments.some(fragment => fragment.label.startsWith("Seleccionar Prioridad")));
  const localized = presentValidatedSystematicName(derivation, "es").name;
  assert.match(localized, /^\(3[RS]\)-/);
  assert.equal(reconcileSystematicName(graph, localized)?.status, "FULL");
});

test("two-center tartaric acid validates all written configurations and rejects a changed descriptor", () => {
  const name = "(2R,3R)-2,3-dihydroxybutanedioic acid";
  const graph = imported("O=C(O)[C@H](O)[C@@H](O)C(=O)O");
  const proof = reconcileSystematicName(graph, name);
  assert.equal(proof?.status, "FULL");
  assert.equal(proof.components.filter(component => component.id.startsWith("stereo-")).length, 2);
  assert.equal(reconcileSystematicName(graph, "(2S,3R)-2,3-dihydroxybutanedioic acid"), null);
  assert.equal(reconcileSystematicName(imported("O=C(O)C(O)C(O)C(=O)O"), name), null);
});

test("stereochemistry generalizes to the supported multifunctional corpus and a synthetic two-center aminoalcohol", () => {
  const cases = [
    alcohols[0], // adrenaline: nested (1R) descriptor
    alcohols[1], // salbutamol: potentially stereogenic but unspecified
    alcohols[2], // venlafaxine
    alcohols[3], // metoprolol
    acids[1], acids[2], acids[4],
    variants[0], // carvone: stereogenic ring carbon, unspecified
    ["Dopamine", "4-(2-aminoethyl)benzene-1,2-diol", "NCCc1ccc(O)c(O)c1"],
    ["Ibuprofen", "2-[4-(2-methylpropyl)phenyl]propanoic acid", "CC(C)Cc1ccc(C(C)C(=O)O)cc1"],
  ];
  for (const [label, name, smiles] of cases) {
    const graph = imported(smiles), proof = reconcileSystematicName(graph, name);
    assert.equal(proof?.status, "FULL", label);
    const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph, language: "en", activeName: name });
    const step = reasoning.steps.find(item => item.title === "Stereochemistry");
    if (graph.atoms.some(atom => atom.tetrahedralParity)) assert.ok(step, `${label} has a descriptor explanation`);
    if (step && !graph.atoms.some(atom => atom.tetrahedralParity))
      assert.match(step.explanation, /no R\/S descriptor is added/i, label);
  }

  const syntheticSmiles = "CCNC[C@H](O)[C@@H](NC)C";
  const syntheticName = "(2S,3S)-1-(ethylamino)-3-(methylamino)butan-2-ol";
  const synthetic = imported(syntheticSmiles), proof = reconcileSystematicName(synthetic, syntheticName);
  assert.equal(proof?.status, "FULL");
  const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph: synthetic, language: "es", activeName: syntheticName });
  const stereo = reasoning.steps.find(item => item.title === "Estereoquímica");
  assert.ok(stereo);
  assert.match(stereo.explanation, /C2.*C3/);
  assert.equal(reconcileSystematicName(synthetic, "(2R,3S)-1-(ethylamino)-3-(methylamino)butan-2-ol"), null);
});
