import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { strictValidationResult } from "./validation-008-audit.mjs";
import { emittedJavaScriptSha256 } from "./quality-010-diagnostics.mjs";

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const before = read("../reports/orgorush-validation-fix-009.matrix.json");
const baseline = read("../reports/orgorush-quality-010.baseline.json");
for (const [path, hash] of Object.entries(baseline.emittedJavaScript)) {
  assert.equal(emittedJavaScriptSha256(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), path), hash, path);
}
const after = JSON.parse(readFileSync(process.argv[2] ?? new URL("../outputs/quality-010/reaudit.matrix.json", import.meta.url), "utf8"));
const chemicalRecord = ({ createdAt, head, ...matrix }) => matrix;
// Compare every graph, name, locant, functional group, reasoning step and
// interactive atom/bond mapping, not just the classification counters.
assert.deepEqual(chemicalRecord(after), chemicalRecord(before));
const counts = {};
for (const record of after.records) for (const profile of Object.values(record.variants[0].profiles)) {
  const status = profile.classification ?? (profile.referenceStatus ? "PENDING-REFERENCE" : "UNSUPPORTED");
  counts[status] = (counts[status] ?? 0) + 1;
}
assert.deepEqual(counts, { PASS: 195, UNSUPPORTED: 19, "PENDING-REFERENCE": 2 });
assert.equal(strictValidationResult(after, true).success, true);
assert.equal(strictValidationResult(after, false).success, false);
const sha = value => createHash("sha256").update(JSON.stringify(chemicalRecord(value))).digest("hex");
console.log(JSON.stringify({ structures: after.records.length, observations: 216,
  variantObservations: 432, counts, everyChemicalAndPedagogicalFieldUnchanged: true,
  typeOnlyJavaScriptUnchanged: Object.keys(baseline.emittedJavaScript),
  beforeSha256: sha(before), afterSha256: sha(after), strictBacked: strictValidationResult(after, true) }, null, 2));
