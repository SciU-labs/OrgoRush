import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evidenceMap } from "../evidence.mjs";
import { sha256 } from "./audit-core.mjs";

const output = new URL("../../../reports/naming-audit/aud-nom-005/", import.meta.url);
const resultsPath = new URL("current-results.json", output);
const mainEvidencePath = new URL("../../../reports/naming-audit/opsin-evidence.json", import.meta.url);
const supplementalEvidencePath = new URL("../../../reports/naming-audit/aud-nom-003-opsin-evidence.json", import.meta.url);
const receiptsPath = new URL("sample-opsin-evidence.json", output);
const progressPath = new URL("capture-progress.json", output);
const atomic = (path, value) => {
  const temp = new URL(`${path.pathname.split("/").at(-1)}.tmp`, path);
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, path);
};
assert.ok(existsSync(resultsPath), "run the frozen 440-record audit first");
const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const sources = [JSON.parse(readFileSync(mainEvidencePath, "utf8")), JSON.parse(readFileSync(supplementalEvidencePath, "utf8"))];
const existing = new Map();
for (const source of sources) for (const [name, receipt] of evidenceMap(source)) {
  if (existing.has(name) && existing.get(name).sha256 !== receipt.sha256) throw new Error(`Conflicting protected receipts for ${name}`);
  existing.set(name, receipt);
}
const targets = new Map();
for (const candidate of results.records.filter((record) => results.audit === "AUD-NOM-005-v1"
  && JSON.parse(readFileSync(new URL("plan.json", output), "utf8")).referenceSample.records.some((sample) => sample.id === record.id))) {
  for (const profile of ["2013-en", "1979-en"]) {
    const name = candidate.profiles[profile]?.name;
    if (!name || existing.has(name)) continue;
    const references = targets.get(name) ?? [];
    references.push({ id: candidate.id, profile });
    targets.set(name, references);
  }
}
if (targets.size > 50) throw new Error(`Refusing more than 50 new exact-text requests (${targets.size})`);
const inputHash = createHash("sha256").update(readFileSync(resultsPath)).digest("hex");
const current = existsSync(receiptsPath) ? JSON.parse(readFileSync(receiptsPath, "utf8")) : {
  audit: "AUD-NOM-005-v1",
  capturedAt: new Date().toISOString(),
  source: "https://www.ebi.ac.uk/opsin/",
  inputResultsSha256: inputHash,
  selectionMethod: "Exact English profile strings from the frozen 50-structure, structure-only sample. One receipt per distinct exact text; no name was used for sample selection.",
  maximumNewTexts: 50,
  responses: [],
  failedRequests: [],
};
assert.equal(current.inputResultsSha256, inputHash, "sample results changed; refusing to merge receipts across runs");
const alreadyCaptured = new Map(current.responses.map((receipt) => [receipt.name, receipt]));
const pending = [...targets].filter(([name]) => !alreadyCaptured.has(name));
for (let start = 0; start < pending.length; start += 10) {
  const batch = pending.slice(start, start + 10);
  const captured = await Promise.all(batch.map(async ([name, references]) => {
    const url = `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(name)}.json`;
    const retrievedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      const body = await response.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = null; }
      return { name, url, retrievedAt, httpStatus: response.status, statusText: response.statusText,
        body, sha256: sha256(body), parsedStatus: parsed?.status ?? null, references };
    } catch (error) {
      return { failure: { name, url, retrievedAt, error: error.message, references } };
    }
  }));
  for (const receipt of captured) {
    if (receipt.failure) current.failedRequests.push(receipt.failure);
    else current.responses.push(receipt);
  }
  current.completedAt = new Date().toISOString();
  atomic(receiptsPath, current);
  atomic(progressPath, { audit: current.audit, attempted: Math.min(start + batch.length, pending.length), pending: pending.length,
    savedResponses: current.responses.length, failedRequests: current.failedRequests.length, completedAt: current.completedAt });
  console.log(`CAPTURED ${Math.min(start + batch.length, pending.length)}/${pending.length}; saved=${current.responses.length}; failed=${current.failedRequests.length}`);
}
for (const receipt of current.responses) assert.equal(sha256(receipt.body), receipt.sha256, `receipt body/hash mismatch for ${receipt.name}`);
console.log(JSON.stringify({ requested: targets.size, existingReceipts: existing.size, newReceipts: current.responses.length,
  failedRequests: current.failedRequests.length, sha256: inputHash }));
