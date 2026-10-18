// Opt-in diagnostic suite: confirmed defects intentionally fail until repaired.
// Run explicitly; no skip/todo and no changes to existing CI/regression tests.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync } from "node:fs";
import { loadExerciseChemistry } from "../helpers/exercise-chemistry.mjs";
import { loadCorpus, structuralIdentity } from "../helpers/reference-corpus.mjs";
import { buildAuditCases, TARGETS } from "../../scripts/naming-audit/cases.mjs";
import { evaluateCase, PROFILES } from "../../scripts/naming-audit/evaluate.mjs";
import { evidenceMap, interpretName, sha256 } from "../../scripts/naming-audit/evidence.mjs";

const directory = new URL("../../reports/naming-audit/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, directory), "utf8"));
const plan = read("audit-cases.json"), matrix = read("audit-matrix.json"), baseline = read("baseline.json");
const receipts = evidenceMap(read("opsin-evidence.json"));
let chemistry;
const liveCache = new Map();
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });
const live = (id) => {
  if (!liveCache.has(id)) liveCache.set(id, evaluateCase(plan.records.find((r) => r.id === id), chemistry.engine));
  return liveCache.get(id);
};
const interpreted = (id, profile) => {
  const r = live(id), p = r.profiles[profile];
  return { id, profile, name: p.name, status: interpretName(p.name, r.smiles, receipts).status };
};
function requireSameStructure(ids, profiles) {
  const failures = ids.flatMap((id) => profiles.map((p) => interpreted(id, p)))
    .filter((r) => !["MATCH", "UNSUPPORTED"].includes(r.status));
  assert.deepEqual(failures, [], "Every admitted name must retain the original graph, including stereo/isotopes; unavailable is explicit, never a passing name");
}

test("audit infrastructure: deterministic 440-case stratification excludes all protected identities", () => {
  assert.deepEqual(buildAuditCases(), plan);
  assert.equal(plan.records.length, 440);
  assert.equal(new Set(plan.records.map((r) => r.identity)).size, 440);
  const protectedIds = new Set(loadCorpus().map((r) => structuralIdentity(r.smiles)));
  for (const r of plan.records) assert.ok(!protectedIds.has(r.identity), r.id);
  for (const [family, count] of Object.entries(TARGETS)) assert.equal(plan.records.filter((r) => r.family === family).length, count);
});

test("audit infrastructure: production, protected references and historical regression bytes are unchanged", () => {
  for (const [path, hash] of Object.entries(baseline.protectedHashes)) {
    assert.equal(sha256(readFileSync(new URL(`../../${path}`, import.meta.url))), hash, path);
  }
  assert.equal(matrix.head, baseline.head);
  assert.equal(matrix.sourceHash, baseline.sourceHash);
});

test("audit infrastructure: complete records and independent receipt integrity", () => {
  assert.equal(matrix.records.length, 440);
  assert.deepEqual(matrix.records.map((r) => r.id), plan.records.map((r) => r.id));
  assert.ok(receipts.size > 0);
  for (const r of matrix.records) {
    assert.deepEqual(Object.keys(r.profiles), PROFILES);
    for (const [profile, p] of Object.entries(r.profiles)) {
      assert.ok(["NAMED", "UNSUPPORTED"].includes(p.status));
      if (!r.expected[profile]) assert.ok(!p.expected && p.exact !== "PASS", "Generated output cannot establish exact correctness");
    }
  }
});

test("audit evidence: individually derived exact English anchors, checked against live production", () => {
  const failures = [];
  for (const input of plan.records.filter((r) => r.review)) {
    const actual = live(input.id);
    for (const [profile, expected] of Object.entries(input.expected)) {
      assert.ok(profile.endsWith("-en"), "No translated Spanish oracle is introduced");
      assert.equal(interpretName(expected, input.smiles, receipts).status, "MATCH", `${input.id}: expected-name independent graph`);
      if (actual.profiles[profile].name !== expected) failures.push({ id: input.id, profile, expected, actual: actual.profiles[profile].name });
    }
  }
  assert.deepEqual(failures, []);
});

test("audit properties: deterministic projections preserve editable graphs and selected analyses", () => {
  for (const r of matrix.records) {
    if (r.admission.status === "UNSUPPORTED") { assert.ok(r.admission.reason); continue; }
    for (const key of ["determinism", "nameDeterminism", "analysisImmutability", "graphImmutability", "coordinateIndependence", "equivalentRepresentations", "profileLanguageReturn"]) {
      assert.notEqual(r.properties[key]?.status, "FAIL", `${r.id}/${key}`);
    }
    assert.ok(!r.signals.some((s) => s.code === "CRASH"), r.id);
  }
});

test("AUDNOM-001: isotope import rejects explicitly before editable identity can be lost", () => {
  const r = live("AUDCASE-0440");
  assert.equal(r.admission.independentlyParseable, true);
  assert.equal(r.admission.status, "UNSUPPORTED");
  assert.match(r.admission.reason, /isótopos explícitos.*No se importó.*identidad química/);
});

test("AUDNOM-002: Legacy EN retains N-substituted amide and tertiary-amine connectivity", () => {
  requireSameStructure(["AUDCASE-0342", "AUDCASE-0343"], ["1979-en"]);
});

test("AUDNOM-003: admitted functional-chain aryl names retain ring methyl substituents", () => {
  requireSameStructure(["AUDCASE-0171", "AUDCASE-0176"], ["2013-en", "1979-en"]);
});

test("AUDNOM-004: Legacy EN retains both carboxyl groups in diacids", () => {
  requireSameStructure(["AUDCASE-0288", "AUDCASE-0292"], ["1979-en"]);
});

test("AUDNOM-005: explicit R/S survives the enabled Legacy EN stereochemical projection", () => {
  requireSameStructure(["AUDCASE-0417", "AUDCASE-0418", "AUDCASE-0421"], ["1979-en"]);
});

test("AUDNOM-006: Legacy ES adds one E/Z descriptor set, without duplicate prefixes", () => {
  const failures = ["AUDCASE-0411", "AUDCASE-0412", "AUDCASE-0413", "AUDCASE-0414"].flatMap((id) => {
    const name = live(id).profiles["1979-es"].name;
    if (!name) return [];
    const count = [...name.matchAll(/\((?:\d+[EZRS])(?:,\d+[EZRS])*\)-/gi)].length;
    return count === 1 && !name.includes("--") ? [] : [{ id, name, descriptorSets: count }];
  });
  assert.deepEqual(failures, []);
});

test("AUDNOM-007: Legacy non parent evidence precedes and does not overlap its functional suffix", () => {
  const r = live("AUDCASE-0249"), failures = [];
  for (const profile of ["1979-es", "1979-en"]) {
    const p = r.profiles[profile];
    if (!p.name) continue;
    const parent = p.reasoning.fragments.find((f) => f.kind === "parent");
    if (parent.start !== p.name.indexOf("non")) failures.push({ profile, name: p.name, parent });
  }
  assert.deepEqual(failures, []);
});

test("AUDNOM-008: modern acid en evidence does not consume the o of oic/oico", () => {
  const r = live("AUDCASE-0293"), failures = [];
  for (const profile of ["2013-es", "2013-en"]) {
    const p = r.profiles[profile], f = p.reasoning.fragments;
    const unsaturation = f.find((x) => x.kind === "unsaturation"), suffix = f.find((x) => x.kind === "function" && /oic/.test(x.text));
    if (unsaturation.start + unsaturation.text.length > suffix.start) failures.push({ profile, unsaturation, suffix });
  }
  assert.deepEqual(failures, []);
});

test("AUDNOM-009: one written locant span appears once per explanation section", () => {
  const p = live("AUDCASE-0003").profiles["1979-en"];
  const keys = p.reasoning.fragments.map((f) => `${f.stepNumber}:${f.start ?? p.name.indexOf(f.text)}:${f.text}`);
  assert.equal(new Set(keys).size, keys.length, JSON.stringify(keys));
});

test("AUDNOM-010: pyridine explanation does not refer to nonexistent atom position 7", () => {
  const r = live("AUDCASE-0430"), failures = [];
  for (const profile of ["2013-es", "2013-en"]) {
    const p = r.profiles[profile];
    for (const step of p.reasoning.steps) for (const match of step.explanation.matchAll(/C(\d+)[=≡]C(\d+)/g)) {
      if ([match[1], match[2]].some((n) => Number(n) > p.analysis.parentAtomCount)) failures.push({ profile, claim: match[0], parentSize: p.analysis.parentAtomCount });
    }
  }
  assert.deepEqual(failures, []);
});

test("AUDNOM-011: Legacy EN parent explanation localizes amide and ester labels", () => {
  const failures = ["AUDCASE-0342", "AUDCASE-0312"].flatMap((id) => live(id).profiles["1979-en"].reasoning.steps
    .filter((step) => /principal (?:amida|amina|nitrilo|éster|éter)\b/i.test(step.explanation))
    .map((step) => ({ id, text: step.explanation })));
  assert.deepEqual(failures, []);
});
