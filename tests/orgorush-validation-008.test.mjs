import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { VALIDATION_CASES, PROFILES } from "./fixtures/orgorush-validation-008.mjs";
import { referenceGraph, referenceParentCandidates } from "./helpers/validation-008-reference.mjs";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { auditProfile, loadOpsin, runValidation, verifyReferences, checkWitness } from "../scripts/validation-008-audit.mjs";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { analyzeBoth, displayedProfiles } from "../scripts/naming-audit/evaluate.mjs";

let chemistry, live;
before(async () => { chemistry = await loadExerciseChemistry(); live = await runValidation(chemistry.engine); });
after(async () => chemistry?.close());

const unsupported = {
  "2013-es": [23, 24, 71, 72], "1979-en": [71, 72],
  "1979-es": [12, 13, 35, 43, 47, 49, 50, 51, 59, 65, 69, 71, 72],
};
function expectedVerdict(index, profile) {
  if (unsupported[profile].includes(index)) return "UNSUPPORTED";
  if (profile === "1979-es" && [67, 68].includes(index)) return null;
  return "PASS";
}

test("VALIDATION-008 references are independent, unique, structurally verified and available offline", () => {
  const result = verifyReferences();
  assert.equal(result.cases, 72);
  const fixture = readFileSync(new URL("./fixtures/orgorush-validation-008.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(fixture, /^import\s/m, "expected-name fixture imports no implementation or generated outputs");
  assert.equal(loadOpsin().size, 106);
  assert.equal(checkWitness("heptane", "CCCCCCC", loadOpsin()).status, "PASS");
  assert.equal(checkWitness("heptane", "CCCCCC", loadOpsin()).status, "FAIL-STRUCTURE");
});

test("VALIDATION-008 independent path oracle distinguishes 2013 and 1979 before querying production", () => {
  const row = VALIDATION_CASES.find(row => row.id === "V008-008"), graph = referenceGraph(row.smiles);
  assert.equal(referenceParentCandidates(graph, "2013-es")[0].length, 7);
  assert.equal(referenceParentCandidates(graph, "1979-en")[0].length, 6);
  const priority = referenceGraph(VALIDATION_CASES.find(row => row.id === "V008-071").smiles);
  assert.equal(referenceParentCandidates(priority, "2013-es")[0].length, 5, "two OH groups outrank the eight-carbon route");
});

// FIX-009 turns the eight confirmed defects into positive regressions against
// the original independent names. The immutable 008 matrix records the before.
// Coverage vetoes and pending historical references keep their classifications.
for (const [i, row] of VALIDATION_CASES.entries()) {
  test(`VALIDATION-008 ${row.id}: reproduce independently adjudicated verdicts, names and highlights`, () => {
    const result = live.records.find(item => item.id === row.id);
    assert.equal(result.variants.length, 2);
    for (const profile of PROFILES) {
      const verdict = expectedVerdict(i + 1, profile);
      for (const variant of result.variants) {
        const observed = variant.profiles[profile];
        assert.equal(observed.classification, verdict, `${row.id}/${profile}: update the audit when a defect is fixed or changes`);
        assert.equal(observed.formula.status, "PASS", "independent molecular formula, even for unsupported names");
        assert.equal(observed.expected, row.expected[profile]);
        if (verdict === "PASS") {
          assert.equal(observed.issues.length, 0);
          assert.ok(observed.observed === row.expected[profile] || observed.nameReview?.verdict === "ACCEPTED_GENERAL_NAME");
          if (profile === "1979-en") assert.equal(observed.nameWitness.status, "PASS");
        } else if (verdict === null) {
          assert.equal(observed.referenceStatus, "INSUFFICIENT_HISTORICAL_REFERENCE");
          assert.ok(observed.issues.some(issue => issue.code === "HISTORICAL_OH_LOCANT_UNRESOLVED"));
        } else {
          assert.equal(observed.observed, null);
          assert.equal(observed.reasoning, null);
        }
      }
      assert.equal(result.variants[0].profiles[profile].observed, result.variants[1].profiles[profile].observed,
        "atom IDs, storage order and canvas reflection do not alter the name");
    }
  });
}

function singleCaseInput() {
  const row = VALIDATION_CASES.find(row => row.id === "V008-063"), graph = moleculeFromSmiles(row.smiles).molecule;
  const analyses = analyzeBoth(graph, chemistry.engine), profiles = displayedProfiles(graph, analyses, chemistry.engine);
  return { row, reference: referenceGraph(row.smiles), variant: { graph, original: id => id }, analyses,
    selection: { ...profiles["2013-es"], all: profiles } };
}

test("VALIDATION-008 grader rejects a wrong molecular formula independently of a correct displayed name", () => {
  const input = singleCaseInput(); input.analyses.current = { ...input.analyses.current, formula: "C999H1" };
  const result = auditProfile(chemistry.engine, input.row, input.reference, input.variant, input.analyses, input.selection, loadOpsin());
  assert.equal(result.classification, "FAIL-STRUCTURE");
  assert.ok(result.issues.some(issue => issue.code === "FORMULA"));
});

test("VALIDATION-008 grader detects an OH target falsely presented as a ketone suffix", () => {
  const input = singleCaseInput(), hydroxyl = input.reference.groups.find(group => group.kind === "alcohol");
  const engine = { ...chemistry.engine, buildActiveIupacReasoning(options) {
    const model = chemistry.engine.buildActiveIupacReasoning(options);
    const fragment = Object.values(model.fragments).find(item => item.kind === "function");
    fragment.contributions[0].atomIds = [...hydroxyl.atomIds];
    return model;
  } };
  const result = auditProfile(engine, input.row, input.reference, input.variant, input.analyses, input.selection, loadOpsin());
  assert.equal(result.classification, "FAIL-REASONING");
  assert.ok(result.issues.some(issue => issue.code === "WRONG_FUNCTIONAL_ATOM_TARGET"));
});

test("VALIDATION-008 reproducibility ledger does not erase defects or pending historical references", () => {
  const matrix = JSON.parse(readFileSync(new URL("../reports/orgorush-validation-008.matrix.json", import.meta.url), "utf8"));
  assert.equal(matrix.referenceValidation.namesAndStructuresSha256, live.referenceValidation.namesAndStructuresSha256);
  assert.equal(matrix.referenceValidation.opsinSha256, live.referenceValidation.opsinSha256);
  for (const row of live.records) for (const profile of PROFILES) {
    const recorded = matrix.records.find(item => item.id === row.id).variants[0].profiles[profile];
    const current = row.variants[0].profiles[profile];
    if (recorded.classification?.startsWith("FAIL-")) {
      assert.equal(current.classification, "PASS", `${row.id}/${profile}: confirmed defect corrected`);
      assert.equal(current.observed, recorded.expected, "independent expected name is unchanged");
    } else {
      assert.equal(recorded.classification, current.classification);
      assert.equal(recorded.observed, current.observed);
    }
  }
});
