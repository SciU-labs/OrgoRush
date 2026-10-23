import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveLegacyParentNamePresentation, deriveReasoningNameFragments } from "../app/reasoning-name-fragments.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { assertReasoningIntegrity, evidence } from "./helpers/reasoning-integrity.mjs";

let chemistry, engine;
before(async () => { chemistry = await loadExerciseChemistry(); engine = chemistry.engine; });
after(async () => chemistry?.close());

// Frozen visible names: this is a presentation correction, not a naming update.
// [SMILES, ES/EN names, ES/EN roots, ES/EN parent spans, ES/EN functional components]
const cases = [
  ["C(=O)OC", ["metanoato de metilo", "methyl methanoate"], ["met", "meth"], ["metan", "methan"], ["metanoato", "methanoate"]],
  ["CC(=O)OC", ["etanoato de metilo", "methyl ethanoate"], ["et", "eth"], ["etan", "ethan"], ["etanoato", "ethanoate"]],
  ["CCC(=O)OC", ["propanoato de metilo", "methyl propanoate"], ["prop", "prop"], ["propan", "propan"], ["propanoato", "propanoate"]],
  ["CCCC(=O)OC", ["butanoato de metilo", "methyl butanoate"], ["but", "but"], ["butan", "butan"], ["butanoato", "butanoate"]],
  ["CC(C)C(=O)OC", ["2-metilpropanoato de metilo", "methyl 2-methylpropanoate"], ["prop", "prop"], ["propan", "propan"], ["propanoato", "propanoate"]],
  ["CC(=O)OCC", ["etanoato de etilo", "ethyl ethanoate"], ["et", "eth"], ["etan", "ethan"], ["etanoato", "ethanoate"]],
  ["CO", ["metanol", "methanol"], ["met", "meth"], ["metan", "methan"], ["metanol", "methanol"]],
  ["CCO", ["etanol", "ethanol"], ["et", "eth"], ["etan", "ethan"], ["etanol", "ethanol"]],
  ["CCC(O)C", ["2-butanol", "2-butanol"], ["but", "but"], ["butan", "butan"], ["2-butanol", "2-butanol"]],
  ["CC(=O)C", ["propanona", "propanone"], ["prop", "prop"], ["propan", "propan"], ["propanona", "propanone"]],
  ["CC(=O)CCC", ["2-pentanona", "2-pentanone"], ["pent", "pent"], ["pentan", "pentan"], ["2-pentanona", "2-pentanone"]],
  ["CC(=O)CCCCCCC", ["2-nonanona", "2-nonanone"], ["non", "non"], ["nonan", "nonan"], ["2-nonanona", "2-nonanone"]],
  ["CN", ["metanamina", "methanamine"], ["met", "meth"], ["metan", "methan"], ["metanamina", "methanamine"]],
  ["CCN", ["etanamina", "ethanamine"], ["et", "eth"], ["etan", "ethan"], ["etanamina", "ethanamine"]],
  ["CCC(N)C", ["2-butanamina", "2-butanamine"], ["but", "but"], ["butan", "butan"], ["2-butanamina", "2-butanamine"]],
  ["CC(=O)CC(=O)C", ["2,4-pentanodiona", "2,4-pentanedione"], ["pent", "pent"], ["pentano", "pentane"], ["2,4-pentanodiona", "2,4-pentanedione"]],
  ["OCCO", ["1,2-etanodiol", "1,2-ethanediol"], ["et", "eth"], ["etano", "ethane"], ["1,2-etanodiol", "1,2-ethanediol"]],
  ["CC=CCC", ["2-penteno", "2-pentene"], ["pent", "pent"], ["pent", "pent"]],
  ["C#CCC", ["1-butino", "1-butyne"], ["but", "but"], ["but", "but"]],
  ["C=CCO", ["2-propen-1-ol", "2-propen-1-ol"], ["prop", "prop"], ["prop", "prop"], ["2-propen-1-ol", "2-propen-1-ol"]],
  ["CC(O)C=CC", ["3-penten-2-ol", "3-penten-2-ol"], ["pent", "pent"], ["pent", "pent"], ["3-penten-2-ol", "3-penten-2-ol"]],
  ["C=CC(=O)C", ["3-buten-2-ona", "3-buten-2-one"], ["but", "but"], ["but", "but"], ["3-buten-2-ona", "3-buten-2-one"]],
  ["CC(=O)CC=CC", ["4-hexen-2-ona", "4-hexen-2-one"], ["hex", "hex"], ["hex", "hex"], ["4-hexen-2-ona", "4-hexen-2-one"]],
  ["CC(=O)N", ["etanamida", "ethanamide"], ["et", "eth"], ["etan", "ethan"], ["etanamida", "ethanamide"]],
  ["CCC#N", ["propanonitrilo", "propanenitrile"], ["prop", "prop"], ["propano", "propane"], ["propanonitrilo", "propanenitrile"]],
  ["CC=O", ["etanal", "ethanal"], ["et", "eth"], ["etan", "ethan"], ["etanal", "ethanal"]],
  ["CC(=O)O", ["ácido etanoico", "ethanoic acid"], ["et", "eth"], ["etan", "ethan"], ["ácido etanoico", "ethanoic acid"]],
];

function permuted(graph) {
  const ids = new Map(graph.atoms.map((atom, i) => [atom.id, 1000 + i * 17]));
  return { ...graph, atoms: graph.atoms.map(atom => ({ ...atom, id: ids.get(atom.id) })).reverse(),
    bonds: graph.bonds.map(([a, b, ...rest]) => [ids.get(b), ids.get(a), ...rest]).reverse() };
}

function modelFor(graph, language) {
  const legacy = engine.analyzeMolecule(graph, [], "iupac-1979-legacy");
  const resolved = engine.resolveLegacyNomenclature(graph, legacy);
  const name = language === "es" ? resolved.spanishResolution.name : resolved.englishName;
  const analysis = language === "es" ? resolved.spanishAnalysis : resolved.englishAnalysis;
  const snapshot = structuredClone({ graph, analysis });
  const model = engine.buildActiveIupacReasoning({ molecule: graph,
    analyses: { current: engine.analyzeMolecule(graph), legacy: analysis }, language,
    convention: language === "es" ? "iupac-1979-es" : "iupac-1979-legacy-en",
    displayedName: name, generatedNames: [name], canHighlight: true });
  assert.deepEqual({ graph, analysis }, snapshot, "graph, numbering and analysis are immutable");
  return model;
}

for (const [smiles, names, roots, parents, components] of cases) {
  test(`REASONING-007 literal parent, root and function: ${names[0]} / ${names[1]}`, () => {
    const parsed = moleculeFromSmiles(smiles); assert.equal(parsed.ok, true);
    for (const graph of [parsed.molecule, permuted(parsed.molecule)]) {
      for (const [index, language] of ["es", "en"].entries()) {
        const model = modelFor(graph, language), name = names[index];
        assert.equal(model.displayedName, name, "chemical name is unchanged");
        assertReasoningIntegrity(model, graph);
        const rows = evidence(model), parent = rows.find(item => item.kind === "parent");
        assert.equal(parent?.text, parents[index]);
        assert.ok(model.links.some(link => link.text === parents[index] && link.stepNumber === parent.stepNumber));
        const presentation = deriveLegacyParentNamePresentation(model.analysis, name, language);
        assert.equal(presentation.numericalRoot, roots[index]);
        assert.equal(presentation.functionalComponent, components?.[index]);
        const explanation = model.steps.find(step => step.nameRole === "parent").explanation;
        assert.ok(explanation.includes(language === "es" ? `raíz numérica es «${roots[index]}-»` : `numerical root is “${roots[index]}-”`));
        assert.doesNotMatch(explanation, /esqueleto carbonado es|carbon scaffold is/);
        const unsaturated = model.analysis.doubleBondLocants.length + model.analysis.tripleBondLocants.length > 0;
        if (unsaturated) {
          assert.equal(presentation.saturatedFragment, undefined);
          assert.doesNotMatch(explanation, /fragmento de cadena saturada|saturated chain fragment/);
          assert.ok(rows.some(item => item.kind === "unsaturation" && item.bondIds?.length));
        } else {
          const stem = `${roots[index]}an`;
          assert.equal(presentation.saturatedFragment, stem);
          assert.ok(explanation.includes(language === "es" ? `fragmento de cadena saturada es «${stem}-»` : `saturated chain fragment is “${stem}-”`));
        }
        if (components) assert.ok(explanation.includes(language === "es" ? `componente funcional completo es «${components[index]}»` : `complete functional component is “${components[index]}”`));
        // Numbering may intentionally share functional locants. Parent morphology
        // must never consume functional or unsaturation evidence, including C#N.
        for (const other of rows.filter(item => ["function", "unsaturation"].includes(item.kind))) {
          assert.ok(parent.start + parent.text.length <= other.start
            || other.start + other.text.length <= parent.start, `${name}: parent overlaps ${other.text}`);
        }
        let cursor = 0;
        for (const link of model.links) {
          assert.equal(name.slice(cursor, cursor + link.text.length), link.text);
          cursor += link.text.length;
        }
        assert.equal(cursor, name.length, "rendered links form a disjoint, lossless partition");
      }
    }
  });
}

test("REASONING-007 unverified names and disabled highlighting never invent spans", () => {
  const graph = moleculeFromSmiles("CC(=O)OC").molecule;
  const model = modelFor(graph, "es");
  const input = { analysis: model.analysis, language: "es", convention: "iupac-1979-es", steps: model.steps,
    displayedName: model.displayedName, generatedNames: [model.displayedName], canHighlight: true };
  assert.deepEqual(deriveReasoningNameFragments({ ...input, canHighlight: false }), {});
  assert.deepEqual(deriveReasoningNameFragments({ ...input, displayedName: "etiqueta sin verificar", generatedNames: [] }), {});
});
