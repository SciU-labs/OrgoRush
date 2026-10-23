import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { VALIDATION_CASES, PROFILES } from "./fixtures/orgorush-validation-008.mjs";
import { referenceGraph } from "./helpers/validation-008-reference.mjs";
import { assertReasoningIntegrity, evidence } from "./helpers/reasoning-integrity.mjs";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { analyzeBoth, displayedProfiles, resolvedProfileAnalyses } from "../scripts/naming-audit/evaluate.mjs";
import { strictValidationResult } from "../scripts/validation-008-audit.mjs";
import { compareValidation009 } from "../scripts/validation-fix-009-compare.mjs";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveLegacyParentNamePresentation, deriveReasoningNameFragments, deriveUnsaturationNameContributions } from "../app/reasoning-name-fragments.ts";
import { buildReasoningNameLinkParts } from "../app/reasoning-name-links.ts";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => chemistry?.close());
const baseline = JSON.parse(readFileSync(new URL("../reports/orgorush-validation-008.matrix.json", import.meta.url), "utf8"));
const failures = baseline.records.flatMap(row => PROFILES.filter(profile => row.variants[0].profiles[profile].classification?.startsWith("FAIL-"))
  .map(profile => ({ row: VALIDATION_CASES.find(item => item.id === row.id), profile })));

for (const { row, profile: fixedProfile } of failures) {
  test(`FIX-009 ${row.id}/${fixedProfile}: correct reference, other profiles, graph and interactive evidence`, () => {
    const graph = moleculeFromSmiles(row.smiles).molecule, snapshot = structuredClone(graph);
    const engine = chemistry.engine, analyses = analyzeBoth(graph, engine), profiles = displayedProfiles(graph, analyses, engine);
    const previous = baseline.records.find(item => item.id === row.id).variants[0].profiles;
    for (const profile of PROFILES) {
      const selection = profiles[profile], active = resolvedProfileAnalyses(graph, analyses, selection, engine);
      assert.equal(selection.name, row.expected[profile], `${profile}: original independent reference`);
      if (previous[profile].classification === "PASS") assert.equal(selection.name, previous[profile].observed);
      const model = engine.buildActiveIupacReasoning({ molecule: graph, analyses: active, ...selection,
        displayedName: selection.name, generatedNames: Object.values(profiles).map(item => item.name).filter(Boolean), canHighlight: true });
      assertReasoningIntegrity(model, graph);
      const parent = evidence(model).find(item => item.kind === "parent");
      assert.ok(parent && parent.atomIds.length === row.parentCarbons[profile]);
      for (const fragment of evidence(model).filter(item => ["function", "unsaturation"].includes(item.kind))) {
        const a = parent.start ?? selection.name.indexOf(parent.text), b = fragment.start ?? selection.name.indexOf(fragment.text);
        assert.ok(a + parent.text.length <= b || b + fragment.text.length <= a);
      }
      assert.deepEqual(model.analysis.mainChain, previous[profile].analysis.parentAtomIds);
      assert.deepEqual([...model.analysis.numberedAtoms], previous[profile].analysis.numbering);
      if (row.family === "aromatic") {
        const explanation = model.steps.find(step => step.nameRole === "parent").explanation;
        assert.match(explanation, selection.language === "en" ? /aromatic parent ring.*6 carbons/ : /anillo aromático.*6 carbonos/);
        assert.doesNotMatch(explanation, /hex-|parent chain|cadena principal/);
        assert.equal(parent.text, selection.language === "en" ? "benzene" : "benceno");
        if (profile !== "2013-es") {
          assert.equal(deriveLegacyParentNamePresentation(model.analysis, selection.name, selection.language), undefined);
          const numbering = model.steps.find(step => step.nameRole === "numbering").explanation;
          for (const substituent of previous[profile].analysis.substituents) assert.ok(numbering.includes(`C${substituent.locant}`));
          assert.match(numbering, selection.language === "en" ? /alphabetical.*this language/ : /alfabético.*este idioma/);
        }
      } else {
        const ref = referenceGraph(row.smiles);
        const functional = evidence(model).flatMap(item => item.contributions ?? []).filter(origin => origin.role === "suffix");
        for (const group of ref.groups) assert.ok(functional.some(origin => origin.group === group.kind && origin.atomIds.includes(group.carbonId)));
      }
    }
    assert.deepEqual(graph, snapshot);
  });
}

test("FIX-009 Spanish and English aromatic locants follow each selected Legacy numbering", () => {
  const graph = moleculeFromSmiles("Cc1cccc(I)c1").molecule, engine = chemistry.engine;
  const analyses = analyzeBoth(graph, engine), profiles = displayedProfiles(graph, analyses, engine);
  assert.equal(profiles["1979-es"].name, "1-metil-3-yodobenceno");
  assert.equal(profiles["1979-en"].name, "1-iodo-3-methylbenzene");
  for (const profile of ["1979-es", "1979-en"]) {
    const selected = profiles[profile], active = resolvedProfileAnalyses(graph, analyses, selected, engine);
    const model = engine.buildActiveIupacReasoning({ molecule: graph, analyses: active, ...selected,
      displayedName: selected.name, generatedNames: [selected.name], canHighlight: true });
    assertReasoningIntegrity(model, graph);
    const text = model.steps.find(step => step.nameRole === "numbering").explanation;
    assert.match(text, /C1/); assert.match(text, /C3/);
    assert.ok(text.includes(selected.language === "es" ? "metil en C1" : "methyl at C3"));
    assert.ok(text.includes(selected.language === "es" ? "yodo en C3" : "iodo at C1"));
    const methylCarbon = graph.atoms.find(atom => atom.element === "C" && graph.bonds.filter(bond => bond.slice(0, 2).includes(atom.id)).length === 1).id;
    assert.equal(model.analysis.numberedAtoms.get(graph.bonds.find(bond => bond.slice(0, 2).includes(methylCarbon)).slice(0, 2).find(id => id !== methylCarbon)),
      selected.language === "es" ? 1 : 3, "the methyl-bearing ring atom has the locant selected in this language");
    assert.equal(model.analysis.mainChain.length, 6);
    assert.ok(!model.analysis.mainChain.includes(methylCarbon));
  }
});

test("FIX-009 strict-backed excludes no confirmed defect and never promotes unsupported or historical-pending cases", () => {
  assert.equal(strictValidationResult(baseline, true).success, false);
  const fixed = structuredClone(baseline);
  for (const row of fixed.records) for (const variant of row.variants) for (const profile of Object.values(variant.profiles)) {
    if (profile.classification?.startsWith("FAIL-")) { profile.classification = "PASS"; profile.issues = []; }
  }
  assert.deepEqual(strictValidationResult(fixed, true), { success: true, scope: "supported-and-reference-backed", failures: 0,
    pendingReferences: 4, unsupported: 38, passed: 390 });
  assert.equal(strictValidationResult(fixed).success, false, "full-reference mode still fails for pending history");
  fixed.records[0].variants[0].profiles["2013-es"].classification = "FAIL-STRUCTURE";
  assert.equal(strictValidationResult(fixed, true).success, false, "a new structural failure cannot be excluded");
});

test("FIX-009 independent 008 names and external evidence retain their original byte hashes", () => {
  const sha = file => createHash("sha256").update(readFileSync(new URL(`../${file}`, import.meta.url))).digest("hex");
  assert.equal(sha("tests/fixtures/orgorush-validation-008.mjs"), baseline.referenceValidation.fixtureSha256);
  assert.equal(sha("tests/fixtures/orgorush-validation-008.opsin.json"), baseline.referenceValidation.opsinSha256);
  assert.equal(failures.length, 8);
});

test("FIX-009 all 432 recorded results preserve structural evidence and honest coverage verdicts", () => {
  const reaudit = JSON.parse(readFileSync(new URL("../reports/orgorush-validation-fix-009.matrix.json", import.meta.url), "utf8"));
  assert.equal(compareValidation009(baseline, reaudit).structuralEvidenceUnchanged, true);
  const corrupted = structuredClone(reaudit);
  corrupted.records[0].variants[0].profiles["2013-es"].analysis.parentAtomIds[0] = -1;
  assert.throws(() => compareValidation009(baseline, corrupted), /parent, numbering/);
  const pending = reaudit.records.find(row => row.id === "V008-067").variants[0].profiles["1979-es"];
  pending.classification = "PASS";
  assert.throws(() => compareValidation009(baseline, reaudit), /V008-067/,
    "a pending historical reference cannot silently become PASS");
});

for (const [smiles, spanish, english, bondType] of [
  ["CC(=O)C(C)=CCC(=O)C", "3-metilhept-3-eno-2,6-diona", "3-methyl-3-hepten-2,6-dione", "double"],
  ["CC(O)C#CC(C)C(O)C", "5-metilhept-3-ino-2,6-diol", "5-methyl-3-heptyn-2,6-diol", "triple"],
]) test(`FIX-009 ${bondType}: corrected modern morphology retains disjoint Legacy EN bond evidence`, () => {
  const graph = moleculeFromSmiles(smiles).molecule, engine = chemistry.engine;
  const analysis = engine.analyzeMolecule(graph), names = chemistry.oracles.reference(graph).names;
  assert.deepEqual(names, { es: spanish, en: english });
  const spanishSteps = engine.buildIupacReasoningSteps(graph, analysis);
  for (const language of ["es", "en"]) {
    const steps = language === "es" ? spanishSteps : engine.buildEnglishReasoningSteps(spanishSteps, graph, analysis);
    const fragments = deriveReasoningNameFragments({ analysis, displayedName: names[language], generatedNames: Object.values(names),
      language, steps, canHighlight: true });
    const links = buildReasoningNameLinkParts(names[language], fragments, steps);
    assert.equal(links.map(part => part.text).join(""), names[language]);
    const bondLinks = links.filter(part => part.semanticId === `unsaturation:${bondType}:3`);
    assert.ok(bondLinks.length > 0);
    for (const part of bondLinks)
      assert.deepEqual(new Set(part.atomIds), new Set(analysis.mainChain.slice(2, 4)));
    const parts = Object.values(fragments).flatMap(part => [part, ...(part.additionalFragments ?? [])]);
    const parent = parts.find(part => part.kind === "parent");
    assert.ok(parent, "the parent retains its own interactive evidence");
    assert.deepEqual(new Set(parent.atomIds), new Set(analysis.mainChain));
    const parentStart = parent.start ?? names[language].indexOf(parent.text);
    for (const part of parts.filter(item => item.kind === "unsaturation")) {
      assert.equal(names[language].slice(part.start, part.start + part.text.length), part.text);
      assert.ok(parentStart + parent.text.length <= part.start || part.start + part.text.length <= parentStart,
        "parent and bond morphemes occupy disjoint spans");
    }
  }
  assert.deepEqual(deriveUnsaturationNameContributions(analysis, english, "en"), [], "a supplied name is required");
  for (const forged of [english.replace("3-hept", "4-hept"), english.replace("2,6", "2,5")])
    assert.deepEqual(deriveUnsaturationNameContributions(analysis, forged, "en", [forged]), [], "wrong graph locants cannot borrow the evidence");
  const missingGroup = { ...analysis, functionalGroups: analysis.functionalGroups.slice(1) };
  assert.deepEqual(deriveUnsaturationNameContributions(missingGroup, english, "en", [english]), [], "plural suffix needs the actual groups");
});
