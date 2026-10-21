import test from "node:test";
import assert from "node:assert/strict";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { auditCyclicCases, validatedCyclicCases, cyclicVariants } from "./helpers/cyclic-audit-003.mjs";
import { nameBareCyclicParent1979 } from "../app/iupac1979-cyclic-parents.ts";
import { perceiveNamingRings } from "../app/naming-ring-perception.ts";
import { moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { CanonizerUtil, SmilesParser } from "openchemlib";
import { displayedProfiles } from "../scripts/naming-audit/evaluate.mjs";
test("1979 cyclic family matrix: verified names and metadata-independent safety boundaries", async () => {
  const chemistry = await loadExerciseChemistry();
  try {
    for (const row of auditCyclicCases(chemistry.engine)) {
      for (const actual of row.variants) {
        assert.notEqual(actual.status, "FAIL", `${row.id}/${actual.variant}: ${JSON.stringify(actual)}`);
        if (row.target) assert.equal(actual.status, "PASS", `${row.id}/${actual.variant}: ${JSON.stringify(actual)}`);
      }
    }
  } finally { await chemistry.close(); }
});

test("independent identity and A-31/A-41 numbering agree with every bond", () => {
  const edge = (a, b) => [a, b].sort((x, y) => x - y).join(":");
  for (const ref of validatedCyclicCases()) for (const [variant, graph] of cyclicVariants(ref.graph)) {
    const exported = moleculeToSmiles(graph); assert(exported.ok, `${ref.id}/${variant}`);
    assert.equal(CanonizerUtil.getIDCode(new SmilesParser().parseMolecule(exported.smiles), CanonizerUtil.NORMAL), ref.identity);
    const { molecule, topology } = perceiveNamingRings(graph);
    const proof = nameBareCyclicParent1979(molecule, topology, molecule.rings);
    if (!proof || !["bicyclic", "spiro"].includes(proof.family)) continue;
    const n = proof.numbering.length, actual = new Set(graph.bonds.map(([a, b]) => edge(proof.numbering.indexOf(a) + 1, proof.numbering.indexOf(b) + 1)));
    const expected = new Set(), add = (a, b) => expected.add(edge(a, b));
    if (ref.theta) {
      const [a, b, c] = ref.theta, head = a + 2;
      for (let i = 1; i < head; i++)add(i, i + 1);
      if (b) { add(head, head + 1); for (let i = head + 1; i < a + b + 2; i++)add(i, i + 1); add(a + b + 2, 1); } else add(head, 1);
      if (c) { add(1, a + b + 3); for (let i = a + b + 3; i < n; i++)add(i, i + 1); add(n, head); } else add(1, head);
    } else if (ref.spiro) {
      const center = ref.spiro[0] + 1;
      for (let i = 1; i < center; i++)add(i, i + 1); add(center, 1);
      for (let i = center; i < n; i++)add(i, i + 1); add(n, center);
    } else continue;
    assert.deepEqual(actual, expected, `${ref.id}/${variant}: descriptor reconstructs every edge`);
  }
});

test("new constitutional parents never admit decorated or invalid graphs by their core alone", () => {
  for (const ref of validatedCyclicCases().filter(r => r.theta || r.spiro)) {
    const variants = [
      { ...ref.graph, atoms: ref.graph.atoms.map((a, i) => i ? { ...a } : { ...a, charge: 1 }) },
      { ...ref.graph, atoms: ref.graph.atoms.map((a, i) => i ? { ...a } : { ...a, tetrahedralParity: "R" }) },
      { ...ref.graph, bonds: ref.graph.bonds.map((b, i) => i ? [...b] : [b[0], b[1], 2]) },
      { ...ref.graph, atoms: [...ref.graph.atoms, { id: 999, x: 0, y: 0 }], bonds: [...ref.graph.bonds, [ref.graph.atoms[0].id, 999, 1]] },
    ];
    for (const graph of variants) {
      const { molecule, topology } = perceiveNamingRings(graph);
      assert.equal(nameBareCyclicParent1979(molecule, topology, molecule.rings), undefined, ref.id);
    }
  }
});

test("Legacy owns availability, locants and reasoning independently of Modern", async () => {
  const chemistry = await loadExerciseChemistry(), engine = chemistry.engine;
  try {
    for (const id of ["theta-2-2-1", "spiro-4-5", "bicyclohexyl", "morpholine", "dioxolane"]) {
      const ref = validatedCyclicCases().find(r => r.id === id), graph = { ...ref.graph, rings: undefined };
      const before = structuredClone(graph), current = engine.analyzeMolecule(graph), legacy = engine.analyzeMolecule(graph, [], "iupac-1979-legacy");
      assert.equal(current.cyclicParent1979, undefined, id);
      assert.equal(engine.legacyLocalNameIsUnavailable(graph, legacy), false, id);
      if (ref.theta || ref.spiro) assert.equal(engine.externalCandidateNeedsNeutralLocalName(graph, current), true, id);
      const profiles = displayedProfiles(graph, { current, legacy }, engine);
      assert.equal(profiles["1979-es"].name, ref.es, id);
      assert.equal(profiles["1979-en"].name, ref.en, id);
      for (const [language, convention] of [["es", "iupac-1979-es"], ["en", "iupac-1979-legacy-en"]]) {
        const model = engine.buildActiveIupacReasoning({ molecule: graph, analyses: { current, legacy },
          convention, language, displayedName: ref[language], generatedNames: [ref[language]], canHighlight: true });
        assert.strictEqual(model.analysis, legacy);
        assert.equal(model.steps.length, 3, id);
        assert.equal(model.links.map(part => part.text).join(""), ref[language], id);
        assert(model.steps.some(step => step.explanation.includes(legacy.cyclicParent1979.rule)), id);
      }
      if (id === "bicyclohexyl") assert([...engine.displayedAtomLocants(legacy).values()].includes("1'"));
      if (id === "dioxolane") assert.deepEqual(graph.atoms.filter(a => a.element === "O").map(a => legacy.numberedAtoms.get(a.id)).sort(), [1, 3]);
      if (["morpholine", "dioxolane"].includes(id)) assert.equal(engine.principalGroupAnalysisLabel(graph, legacy), "Heterociclo");
      assert.deepEqual(graph, before, id);
    }
    const graph = validatedCyclicCases().find(r => r.id === "mono-6").graph;
    const charged = { ...graph, atoms: graph.atoms.map((a, i) => i ? a : { ...a, charge: 1 }) };
    const analysis = engine.analyzeMolecule(charged, [], "iupac-1979-legacy");
    assert.equal(engine.legacyLocalNameIsUnavailable(charged, analysis), true);
    const oxirane = validatedCyclicCases().find(r => r.id === "oxirane").graph;
    const hydroxylated = { ...oxirane, rings: undefined,
      atoms: [...oxirane.atoms, { id: 999, element: "O", x: 0, y: 0 }],
      bonds: [...oxirane.bonds, [oxirane.atoms.find(a => a.element === "C").id, 999, 1]] };
    assert.equal(engine.heterocycleHasUnrepresentedHydroxylGroups(hydroxylated), true);
    for (const profile of ["blue-book-2013", "iupac-1979-legacy"]) {
      assert.equal(engine.externalCandidateNeedsNeutralLocalName(hydroxylated, engine.analyzeMolecule(hydroxylated, [], profile)), true);
    }
  } finally { await chemistry.close(); }
});
