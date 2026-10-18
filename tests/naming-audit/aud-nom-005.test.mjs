import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evidenceMap, interpretName, sha256 } from "../../scripts/naming-audit/evidence.mjs";
import {
  AUDIT_VERSION, PROFILES, SAMPLE_QUOTAS, classifyHistoricalDiscrepancy,
  classifyIndependentInterpretation, selectReferenceSample, summarizeCounts,
  validateBatch, validateHistoricalInventory,
} from "../../scripts/naming-audit/aud-nom-005/audit-core.mjs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

test("AUD-NOM-005 reads the exact immutable AUD-NOM-001 IDs and verifies all 440", () => {
  const { records } = readJson("../../reports/naming-audit/audit-matrix.json");
  assert.deepEqual(validateHistoricalInventory(records), {
    count: 440, firstId: "AUDCASE-0001", lastId: "AUDCASE-0440", uniqueIds: 440,
  });
  assert.equal(PROFILES.length, 4);
  assert.throws(() => validateHistoricalInventory(records.slice(1)), /exactly 440/);
  assert.throws(() => validateHistoricalInventory([records[0], records[0]]), /exactly 440/);
});

test("AUD-NOM-005 selects 50 structural cases by fixed family strata, independent of names", () => {
  const { records } = readJson("../../reports/naming-audit/audit-matrix.json");
  const first = selectReferenceSample(records);
  const renamed = records.map((record) => ({ ...record, profiles: Object.fromEntries(Object.keys(record.profiles).map((key) => [key, { name: `changed ${record.id}` }])) }));
  const second = selectReferenceSample(renamed);
  assert.equal(first.audit, AUDIT_VERSION);
  assert.equal(first.namesWereRead, false);
  assert.equal(first.total, 50);
  assert.deepEqual(first, second);
  assert.equal(first.records.length, 50);
  assert.equal(new Set(first.records.map((record) => record.id)).size, 50);
  assert.equal(Object.values(SAMPLE_QUOTAS).reduce((sum, n) => sum + n, 0), 50);
  for (const [family, quota] of Object.entries(SAMPLE_QUOTAS)) {
    assert.equal(first.families[family].quota, quota);
    assert.equal(first.records.filter((record) => record.family === family).length, quota);
  }
});

test("independent interpretation distinguishes constitutional from stereo mismatches", () => {
  assert.deepEqual(classifyIndependentInterpretation({ status: "MATCH", constitutionalMatch: true }), {
    status: "MATCH", constitution: "MATCH", stereochemistry: "MATCH",
  });
  assert.deepEqual(classifyIndependentInterpretation({ status: "MISMATCH", constitutionalMatch: true }), {
    status: "MISMATCH", constitution: "MATCH", stereochemistry: "MISMATCH",
  });
  assert.deepEqual(classifyIndependentInterpretation({ status: "MISMATCH", constitutionalMatch: false }), {
    status: "MISMATCH", constitution: "MISMATCH", stereochemistry: "NOT_ASSESSABLE",
  });
  assert.equal(classifyIndependentInterpretation({ status: "UNVERIFIED" }).status, "UNVERIFIED");
});

test("historical discrepancy classification requires a current receipt or explicit safe rejection", () => {
  assert.equal(classifyHistoricalDiscrepancy({ currentStatus: "NAMED", currentInterpretation: { status: "MATCH" } }), "RESOLVED_MATCH");
  assert.equal(classifyHistoricalDiscrepancy({ currentStatus: "NAMED", currentInterpretation: { status: "MISMATCH" } }), "STILL_MISMATCH");
  assert.equal(classifyHistoricalDiscrepancy({ currentStatus: "NAMED", currentInterpretation: { status: "UNVERIFIED" } }), "UNVERIFIED_CURRENT_OUTPUT");
  assert.equal(classifyHistoricalDiscrepancy({ currentStatus: "UNSUPPORTED", safeRejection: true }), "RESOLVED_SAFE_REJECTION");
  assert.equal(classifyHistoricalDiscrepancy({ currentStatus: "UNSUPPORTED", safeRejection: false }), "NEEDS_MANUAL_REVIEW");
});

test("existing OPSIN receipts are hash-checked and exact English text is interpreted offline", () => {
  const receipts = evidenceMap(readJson("../../reports/naming-audit/opsin-evidence.json"));
  const supplemental = evidenceMap(readJson("../../reports/naming-audit/aud-nom-003-opsin-evidence.json"));
  assert.ok(receipts.size > 0 && supplemental.size > 0);
  const ethanol = interpretName("ethanol", "CCO", receipts);
  assert.equal(ethanol.status, "MATCH");
  assert.equal(ethanol.constitutionalMatch, true);
  assert.equal(interpretName("unreceipted exact text", "CCO", receipts).status, "UNVERIFIED");
  const doc = readJson("../../reports/naming-audit/opsin-evidence.json");
  const corrupt = structuredClone(doc);
  corrupt.responses[0].body += " ";
  assert.notEqual(sha256(corrupt.responses[0].body), corrupt.responses[0].sha256);
  assert.throws(() => evidenceMap(corrupt), /Corrupt or duplicate independent receipt/);
});

test("AUD-NOM-005 preserves the bounded rule-derived English candidates and separates normative from structural evidence", () => {
  const candidates = readJson("../../reports/naming-audit/aud-nom-005/rule-derived-candidate-receipts.json");
  const receipts = evidenceMap(candidates);
  assert.equal(candidates.maximumQueries, 2);
  assert.equal(candidates.evaluated.length, 2);
  assert.deepEqual(candidates.evaluated.map(({ id, text, structuralInterpretation }) => ({
    id, text, status: structuralInterpretation.status, constitutionalMatch: structuralInterpretation.constitutionalMatch,
  })), [
    { id: "AUDCASE-0160", text: "1-chloro-4-ethenylbenzene", status: "MATCH", constitutionalMatch: true },
    { id: "AUDCASE-0337", text: "2-pentyloxyheptane", status: "MATCH", constitutionalMatch: true },
  ]);
  assert.equal(receipts.size, 2);
  const finding = readJson("../../reports/naming-audit/aud-nom-005/findings.json").findings[0];
  assert.equal(finding.id, "AUDNOM-012");
  assert.equal(finding.evidence[0].profiles["2013-en"].expectedRuleDerived, "1-chloro-4-ethenylbenzene");
  assert.equal(finding.evidence[1].profiles["2013-en"].expectedRuleDerived, "2-pentyloxyheptane");
  assert.equal(finding.evidence[0].profiles["1979-en"].expectedRuleDerived, null);
});

test("AUD-NOM-005 historical discrepancy and property totals reconcile with the 440-case rerun", () => {
  const discrepancies = readJson("../../reports/naming-audit/aud-nom-005/historical-discrepancies-51.json");
  assert.equal(discrepancies.records.length, 51);
  assert.deepEqual(discrepancies.counts, {
    RESOLVED_MATCH: 45, RESOLVED_SAFE_REJECTION: 2, STILL_MISMATCH: 0,
    UNVERIFIED_CURRENT_OUTPUT: 0, NEEDS_MANUAL_REVIEW: 4,
  });
  const results = readJson("../../reports/naming-audit/aud-nom-005/current-results.json");
  assert.equal(results.records.length, 440);
  const properties = readJson("../../reports/naming-audit/aud-nom-005/property-summary.json");
  assert.equal(properties.totalStructures, 440);
  assert.deepEqual(properties.properties.importExportIdentity, { PASS: 432, SKIP: 8 });
  assert.deepEqual(properties.properties.graphImmutability, { PASS: 432 });
  assert.equal(properties.profiles["2013-en"].availability.NAMED, 425);
  assert.equal(properties.profiles["2013-en"].exactReference.PASS, 20);
  assert.equal(properties.profiles["1979-en"].exactReference.PASS, 6);
});

test("AUD-NOM-005 rejects stale/mixed batches and totals always reconcile", () => {
  const batch = { audit: AUDIT_VERSION, planHash: "p", sourceHash: "s", harnessHash: "h", records: [{ id: "AUDCASE-0001" }] };
  assert.equal(validateBatch(batch, ["AUDCASE-0001"], { planHash: "p", sourceHash: "s", harnessHash: "h" }), true);
  assert.throws(() => validateBatch(batch, ["AUDCASE-0002"], { planHash: "p", sourceHash: "s", harnessHash: "h" }), /IDs\/order mismatch/);
  assert.throws(() => validateBatch(batch, ["AUDCASE-0001"], { planHash: "wrong", sourceHash: "s", harnessHash: "h" }), /hash\/version mismatch/);
  assert.deepEqual(summarizeCounts([{ state: "MATCH" }, { state: "UNVERIFIED" }], (row) => row.state, ["MATCH", "MISMATCH", "UNVERIFIED"]), {
    MATCH: 1, MISMATCH: 0, UNVERIFIED: 1,
  });
  assert.deepEqual(summarizeCounts([{ state: "UNEXPECTED" }], (row) => row.state, ["MATCH"]), {
    MATCH: 0, UNEXPECTED: 1,
  });
});
