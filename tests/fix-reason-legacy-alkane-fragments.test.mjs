import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { CanonizerUtil, Molecule, SmilesParser } from "openchemlib";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { translateSpanishIupacForDisplay } from "../app/iupac-name-normalization.ts";
import { assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";

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
  { smiles: "CCC", formula: "C₃H₈", es: "propano", en: "propane", parentEs: "propano", parentEn: "propane", chainLength: 3, substituents: [], allProfiles: true },
  { smiles: "CC(C)C", formula: "C₄H₁₀", es: "2-metilpropano", en: "2-methylpropane", parentEs: "propano", parentEn: "propane", chainLength: 3, substituents: [2], allProfiles: true },
  { smiles: "CC(C)(C)C", formula: "C₅H₁₂", es: "2,2-dimetilpropano", en: "2,2-dimethylpropane", parentEs: "propano", parentEn: "propane", chainLength: 3, substituents: [2, 2], allProfiles: true },
  { smiles: "C", formula: "C₁H₄", es: "metano", en: "methane", parentEs: "metano", parentEn: "methane", chainLength: 1, substituents: [] },
  { smiles: "CC", formula: "C₂H₆", es: "etano", en: "ethane", parentEs: "etano", parentEn: "ethane", chainLength: 2, substituents: [] },
  { smiles: "CCCC", formula: "C₄H₁₀", es: "butano", en: "butane", parentEs: "butano", parentEn: "butane", chainLength: 4, substituents: [] },
  { smiles: "CCCCC", formula: "C₅H₁₂", es: "pentano", en: "pentane", parentEs: "pentano", parentEn: "pentane", chainLength: 5, substituents: [] },
  { smiles: "CCCCCC", formula: "C₆H₁₄", es: "hexano", en: "hexane", parentEs: "hexano", parentEn: "hexane", chainLength: 6, substituents: [] },
  { smiles: "CC(C)CC", formula: "C₅H₁₂", es: "2-metilbutano", en: "2-methylbutane", parentEs: "butano", parentEn: "butane", chainLength: 4, substituents: [2] },
  { smiles: "CCC(C)CC", formula: "C₆H₁₄", es: "3-metilpentano", en: "3-methylpentane", parentEs: "pentano", parentEn: "pentane", chainLength: 5, substituents: [3] },
];

function graphIdentity(smiles) {
  const graph = new SmilesParser().parseMolecule(smiles);
  graph.ensureHelperArrays(Molecule.cHelperCIP);
  return CanonizerUtil.getIDCode(graph, CanonizerUtil.NORMAL);
}

function makeProfile(molecule, current, legacy, convention, language, displayedName, generatedNames) {
  return page.buildActiveIupacReasoning({ molecule, analyses: { current, legacy }, convention, language,
    displayedName, generatedNames, canHighlight: true });
}

test("saturated alkane parent spans use the exact visible parent without changing chemistry", () => {
  for (const fixture of fixtures) {
    const imported = moleculeFromSmiles(fixture.smiles);
    assert.equal(imported.ok, true, imported.error);
    const molecule = imported.molecule;
    const graphBefore = structuredClone(molecule);
    const current = page.analyzeMolecule(molecule);
    const legacy = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
    const legacyEs = applyNomenclatureConvention(page.legacySpanishFormatterInput(legacy, legacy.name), "iupac-1979-es", "es");
    const legacyEn = generateLegacyEnglishName(page.buildLegacyEnglishNameModel(molecule, legacy, legacy.name)).name;
    const currentEn = translateSpanishIupacForDisplay(current.name);
    const exported = moleculeToSmiles(molecule);
    assert.equal(exported.ok, true, `${fixture.smiles}: non-isotopic structure still exports`);
    assert.equal(graphIdentity(exported.smiles), graphIdentity(fixture.smiles), `${fixture.smiles}: graph identity is preserved`);
    assert.equal(current.name, fixture.es, `${fixture.smiles}: current Spanish name`);
    assert.equal(legacyEs, fixture.es, `${fixture.smiles}: Legacy Spanish name`);
    assert.equal(currentEn, fixture.en, `${fixture.smiles}: current English name`);
    assert.equal(legacyEn, fixture.en, `${fixture.smiles}: Legacy English name`);
    assert.equal(current.formula, fixture.formula, `${fixture.smiles}: current formula`);
    assert.equal(legacy.formula, fixture.formula, `${fixture.smiles}: Legacy formula`);
    assert.equal(legacy.mainChain.length, fixture.chainLength, `${fixture.smiles}: analyzed parent length`);
    assert.deepEqual(legacy.substituents.map((item) => item.locant).sort((a, b) => a - b), fixture.substituents,
      `${fixture.smiles}: analyzed substituent locants`);

    const profileCases = fixture.allProfiles ? [
      ["current", "es", fixture.es],
      ["iupac-1979-es", "es", fixture.es],
      ["current", "en", fixture.en],
      ["iupac-1979-legacy-en", "en", fixture.en],
    ] : fixture.chainLength > 1 ? [
      ["current", "es", fixture.es],
      ["iupac-1979-es", "es", fixture.es],
    ] : [];
    for (const [convention, language, name] of profileCases) {
      const model = makeProfile(molecule, current, legacy, convention, language, name, [fixture.es, fixture.en]);
      assertReasoningIntegrity(model, molecule);
      const parentStep = model.steps.find((step) => step.nameRole === "parent");
      assert.ok(parentStep, `${fixture.smiles}/${convention}/${language}: parent step exists`);
      const parentEvidence = [model.fragments[parentStep.number],
        ...(model.fragments[parentStep.number]?.additionalFragments ?? [])]
        .filter((item) => item?.kind === "parent" && item.atomIds?.length === legacy.mainChain.length
          && legacy.mainChain.every((id) => item.atomIds.includes(id)));
      const parent = parentEvidence[0];
      const expectedParent = language === "en" ? fixture.parentEn : fixture.parentEs;
      assert.ok(parent, `${fixture.smiles}/${convention}/${language}: evidence targets analyzed parent atoms`);
      assert.equal(parent.text, expectedParent, `${fixture.smiles}/${convention}/${language}: exact parent span`);
      assert.equal(parent.start, name.lastIndexOf(expectedParent), `${fixture.smiles}/${convention}/${language}: exact parent offset`);
      assert.deepEqual(new Set(parent.atomIds), new Set(legacy.mainChain));
      assert.ok(model.links.some((link) => link.stepNumber === parentStep.number && link.text === parent.text
        && link.atomIds?.length === legacy.mainChain.length
        && legacy.mainChain.every((id) => link.atomIds.includes(id))),
      `${fixture.smiles}/${convention}/${language}: parent span has an interactive link`);
      if (fixture.smiles === "CCC") {
        const repeated = makeProfile(molecule, current, legacy, convention, language, name, [fixture.es, fixture.en]);
        assert.deepEqual(repeated.fragments, model.fragments, `${convention}/${language}: fragment projection is deterministic`);
        assert.deepEqual(repeated.links, model.links, `${convention}/${language}: navigation projection is deterministic`);
      }
      if (fixture.substituents.length) {
        const numberingStep = model.steps.find((step) => step.nameRole === "numbering");
        const substituentStep = model.steps.find((step) => step.nameRole === "substituent");
        const evidence = Object.values(model.fragments).flatMap((item) => [item, ...(item.additionalFragments ?? [])]);
        assert.ok(numberingStep, `${fixture.smiles}/${convention}/${language}: numbering step exists`);
        assert.ok(substituentStep, `${fixture.smiles}/${convention}/${language}: substituent step exists`);
        for (const locant of new Set(fixture.substituents)) {
          const locator = evidence.find((item) => item.kind === "numbering" && item.text.split(",").includes(String(locant)));
          assert.ok(locator, `${fixture.smiles}/${convention}/${language}: locant ${locant} has name evidence`);
          if (fixture.substituents.length === 1) {
            const writtenLocant = `${locant}-`;
            assert.ok(model.links.some((link) => link.stepNumber === substituentStep.number
              && link.text.startsWith(writtenLocant)
              || link.text === String(locant) && (link.stepNumber === numberingStep.number
                || link.relatedStepNumbers?.includes(numberingStep.number))),
            `${fixture.smiles}/${convention}/${language}: locant ${locant} remains interactive`);
          }
        }
        assert.ok(evidence.some((item) => item.kind === "substituent"
          && item.text.includes(language === "en" ? "methyl" : "metil")),
        `${fixture.smiles}/${convention}/${language}: substituent has separate name evidence`);
        assert.ok(model.links.some((link) => link.stepNumber
          && link.text.includes(language === "en" ? "methyl" : "metil")),
        `${fixture.smiles}/${convention}/${language}: substituent remains independently linked`);
        assert.ok(!parent.text.includes(language === "en" ? "methyl" : "metil"));
      }
      assert.equal(model.links.map((link) => link.text).join(""), name,
        `${fixture.smiles}/${convention}/${language}: interactive parts reconstruct the name`);
    }
    assert.deepEqual(molecule, graphBefore, `${fixture.smiles}: graph unchanged by projections`);
  }
});
