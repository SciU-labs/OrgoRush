import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { CanonizerUtil, Molecule, SmilesParser } from "openchemlib";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { legacyProfileDisplayName } from "../app/legacy-profile-display.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { translateSpanishIupacForDisplay } from "../app/iupac-name-normalization.ts";
import { assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";
import { CYCLIC_REFERENCES, graphFromCyclicReference } from "./fixtures/iupac79-cyclic-audit-003.mjs";

function graphIdentity(smiles) {
  const graph = new SmilesParser().parseMolecule(smiles);
  graph.ensureHelperArrays(Molecule.cHelperCIP);
  return CanonizerUtil.getIDCode(graph, CanonizerUtil.NORMAL);
}

let server;
let page;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)), configFile: false,
    logLevel: "error", appType: "custom", plugins: [react()],
    server: { middlewareMode: true, hmr: false },
  });
  page = await server.ssrLoadModule("/app/page.tsx");
});
after(async () => server?.close());

const fixtures = [
  { smiles: "C", formula: "C₁H₄", es: "metano", en: "methane", chain: 1, locants: [] },
  { smiles: "CC", formula: "C₂H₆", es: "etano", en: "ethane", chain: 2, locants: [] },
  { smiles: "CCC", formula: "C₃H₈", es: "propano", en: "propane", chain: 3, locants: [] },
  { smiles: "CCCC", formula: "C₄H₁₀", es: "butano", en: "butane", chain: 4, locants: [] },
  { smiles: "CCCCC", formula: "C₅H₁₂", es: "pentano", en: "pentane", chain: 5, locants: [] },
  { smiles: "CCCCCC", formula: "C₆H₁₄", es: "hexano", en: "hexane", chain: 6, locants: [] },
  { smiles: "CCCCCCCCCC", formula: "C₁₀H₂₂", es: "decano", en: "decane", chain: 10, locants: [] },
  { smiles: "CC(C)C", formula: "C₄H₁₀", es: "2-metilpropano", en: "2-methylpropane", chain: 3, locants: [2] },
  { smiles: "CC(C)CC", formula: "C₅H₁₂", es: "2-metilbutano", en: "2-methylbutane", chain: 4, locants: [2] },
  { smiles: "CCC(C)CC", formula: "C₆H₁₄", es: "3-metilpentano", en: "3-methylpentane", chain: 5, locants: [3] },
  { smiles: "CC(C)(C)C", formula: "C₅H₁₂", es: "2,2-dimetilpropano", en: "2,2-dimethylpropane", chain: 3, locants: [2, 2] },
  { smiles: "C".repeat(15), formula: "C₁₅H₃₂", es: "pentadecano", en: "pentadecane", chain: 15, locants: [] },
  { smiles: "C".repeat(20), formula: "C₂₀H₄₂", es: "icosano", en: "icosane", chain: 20, locants: [] },
  { smiles: "C".repeat(30), formula: "C₃₀H₆₂", es: "triacontano", en: "triacontane", chain: 30, locants: [] },
];

function observe(smiles) {
  const parsed = moleculeFromSmiles(smiles);
  assert.equal(parsed.ok, true, parsed.ok ? undefined : parsed.error);
  const molecule = parsed.molecule;
  const before = structuredClone(molecule);
  const current = page.analyzeMolecule(molecule);
  const legacy = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
  const legacySpanishInput = page.legacySpanishFormatterInput(legacy, legacy.name);
  const legacyEs = applyNomenclatureConvention(legacySpanishInput, "iupac-1979-es", "es");
  const legacyEn = generateLegacyEnglishName(
    page.buildLegacyEnglishNameModel(molecule, legacy, legacy.name),
  ).name;
  const exported = moleculeToSmiles(molecule);
  assert.equal(exported.ok, true, exported.error);
  assert.equal(graphIdentity(exported.smiles), graphIdentity(smiles), "SMILES round-trip preserves graph identity");
  assert.deepEqual(molecule, before, "both naming profiles preserve the edited graph");
  return { molecule, snapshot: before, current, legacy, legacyEs, legacyEn, exported };
}

test("IUPAC 1979 preserves the supported acyclic alkane names in ES/EN and the visible Legacy routes", () => {
  for (const fixture of fixtures) {
    const result = observe(fixture.smiles);
    const { molecule, current, legacy, legacyEs, legacyEn } = result;
    assert.equal(current.formula, fixture.formula, `${fixture.smiles}: formula`);
    assert.equal(legacy.formula, fixture.formula, `${fixture.smiles}: Legacy formula`);
    assert.equal(current.name, fixture.es, `${fixture.smiles}: current ES name`);
    assert.equal(legacy.name, fixture.es, `${fixture.smiles}: Legacy analysis name`);
    assert.equal(legacy.mainChain.length, fixture.chain, `${fixture.smiles}: parent chain length`);
    assert.deepEqual(legacy.substituents.map((item) => item.locant).sort((a, b) => a - b), fixture.locants,
      `${fixture.smiles}: graph-derived branch locants`);
    assert.equal(legacyEs, fixture.es, `${fixture.smiles}: Spanish 1979 name`);
    assert.equal(legacyEn, fixture.en, `${fixture.smiles}: English Legacy name`);
    assert.equal(translateSpanishIupacForDisplay(current.name), fixture.en, `${fixture.smiles}: current EN name`);

    const shown = {
      es: legacyProfileDisplayName({ language: "es", suggestedName: current.name,
        spanish1979Name: legacyEs, english1979Name: legacyEn }),
      en: legacyProfileDisplayName({ language: "en", suggestedName: translateSpanishIupacForDisplay(current.name),
        spanish1979Name: legacyEs, english1979Name: legacyEn }),
    };
    assert.deepEqual(shown, {
      es: { name: fixture.es, available: true },
      en: { name: fixture.en, available: true },
    }, `${fixture.smiles}: both Legacy display names are available and copyable`);
    assert.ok(Object.values(shown).every(({ name, available }) => available && name !== "-"),
      `${fixture.smiles}: each profile satisfies the UI copyable-name gate`);

    for (const [language, convention, displayedName] of [
      ["es", "iupac-1979-es", shown.es.name],
      ["en", "iupac-1979-legacy-en", shown.en.name],
    ]) {
      const reasoning = page.buildActiveIupacReasoning({
        molecule, analyses: { current, legacy }, convention, language, displayedName,
        generatedNames: [fixture.es, fixture.en], canHighlight: true,
      });
      assert.strictEqual(reasoning.analysis, legacy, `${fixture.smiles}: active Legacy analysis`);
      assertReasoningIntegrity(reasoning, molecule);
      const parentLink = reasoning.links.find((link) => link.atomIds?.length === legacy.mainChain.length
        && legacy.mainChain.every((id) => link.atomIds.includes(id)));
      assert.ok(parentLink, `${fixture.smiles}: parent atoms have interactive name evidence`);
      const parentStep = reasoning.steps.find((step) => step.nameRole === "parent");
      assert.ok(parentStep?.explanation.includes(displayedName), `${fixture.smiles}: explanation names the visible result`);
      if (fixture.locants.length) {
        const substituentStep = reasoning.steps.find((step) => step.nameRole === "substituent");
        assert.ok(substituentStep, `${fixture.smiles}: branch explanation exists`);
        for (const locant of new Set(fixture.locants)) {
          assert.match(substituentStep.explanation,
            language === "es" ? new RegExp(`metil en C${locant}`) : new RegExp(`methyl at C${locant}`));
        }
        assert.ok(reasoning.links.some((link) => link.stepNumber && /metil|methyl/.test(link.text)),
          `${fixture.smiles}: branch fragment navigates to its explanation`);
      }
    }
    assert.deepEqual(molecule, result.snapshot, `${fixture.smiles}: reasoning leaves graph stable`);
  }
});

test("Legacy admits verified cyclic grammar and keeps unsupported polycycles unavailable", () => {
  const ring = observe("C1CCCCC1");
  assert.equal(ring.legacy.name, "ciclohexano");
  assert.equal(ring.legacyEs, "ciclohexano");
  assert.equal(applyNomenclatureConvention("ciclohexano", "iupac-1979-es", "es"), "ciclohexano");
  const graph = graphFromCyclicReference(CYCLIC_REFERENCES.find(row => row.id === "perhydropyrene"));
  const unsupported = page.analyzeMolecule(graph, [], "iupac-1979-legacy");
  assert.equal(page.legacyLocalNameIsUnavailable(graph, unsupported), true);
  const es = applyNomenclatureConvention(page.legacySpanishFormatterInput(unsupported, unsupported.name), "iupac-1979-es", "es");
  const en = generateLegacyEnglishName(page.buildLegacyEnglishNameModel(graph, unsupported)).name;
  assert.equal(es, "-");assert.equal(en, "-");
  assert.deepEqual(legacyProfileDisplayName({ language: "es", suggestedName: "pireno",
    spanish1979Name: es, english1979Name: en }),
  { name: "No disponible para esta estructura", available: false });
});
