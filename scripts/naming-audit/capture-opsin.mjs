// Optional, bounded independent name -> structure capture. Does not edit the
// protected corpus or convert parser acceptance into an exact-name oracle.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { loadSnapshots } from "../../tests/helpers/reference-corpus.mjs";

const directory = new URL("../../reports/naming-audit/", import.meta.url);
const matrix = JSON.parse(readFileSync(new URL("audit-matrix.json", directory), "utf8"));
const maxArgument = process.argv.slice(2).find((arg) => arg.startsWith("--max-new="));
const focus = process.argv.includes("--focus=high-risk");
if (process.argv.slice(2).some((arg) => !/^--max-new=\d+$/.test(arg) && arg !== "--focus=high-risk")) throw new Error("Usage: node scripts/naming-audit/capture-opsin.mjs [--max-new=160] [--focus=high-risk]");
const maxNew = maxArgument ? Number(maxArgument.split("=")[1]) : 160;
if (maxNew < 0 || maxNew > 240) throw new Error("Bound --max-new to 0..240");
const evidencePath = new URL("opsin-evidence.json", directory);
const previous = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, "utf8")) : { responses: [], failedRequests: [] };
const responses = new Map(previous.responses.map((r) => [r.name, r]));
const frozen = loadSnapshots(), requested = new Map();
const sha = (body) => createHash("sha256").update(body).digest("hex");
const add = (name, caseId, profile, reason) => {
  if (!name || !profile.endsWith("-en")) return;
  const item = requested.get(name) ?? { name, uses: [], reasons: [] };
  if (!item.uses.some((u) => u.caseId === caseId && u.profile === profile)) item.uses.push({ caseId, profile });
  if (!item.reasons.includes(reason)) item.reasons.push(reason);
  requested.set(name, item);
};
for (const record of matrix.records) for (const [profile, name] of Object.entries(record.expected)) add(name, record.id, profile, "individually-derived-expectation");
if (focus) for (const record of matrix.records.filter((r) => r.features.includes("N-substitution")
  || Object.values(r.profiles).some((p) => p.analysis?.functionalGroups.filter((g) => g.kind === p.analysis.primaryFunctionalGroup).length > 1))) {
  for (const profile of ["2013-en", "1979-en"]) add(record.profiles[profile]?.name, record.id, profile, "follow-up-N-substitution-or-functional-multiplicity");
}
for (const record of matrix.records.filter((r) => r.signals.some((s) => !s.code.startsWith("EXPLANATION_")))) {
  for (const profile of ["2013-en", "1979-en"]) add(record.profiles[profile]?.name, record.id, profile, "diagnostic-signal");
}
for (const record of matrix.records.filter((r) => r.family === "stereo-polycycles-limits" || r.review)) {
  for (const profile of ["2013-en", "1979-en"]) add(record.profiles[profile]?.name, record.id, profile, "reviewed-or-boundary-case");
}
const families = [...new Set(matrix.records.map((r) => r.family))];
// Round-robin keeps less noisy families represented even when there are many
// suspect names in one family. Receipt reuse does not consume new requests.
for (let index = 0; index < 45; index++) for (const family of families) {
  const record = matrix.records.filter((r) => r.family === family)[index];
  if (record) for (const profile of ["2013-en", "1979-en"]) add(record.profiles[profile]?.name, record.id, profile, "stratified-sample");
}
const queue = [];
for (const request of requested.values()) {
  if (responses.has(request.name)) continue;
  if (frozen.has(request.name)) responses.set(request.name, { ...frozen.get(request.name), origin: "existing-frozen-reference-receipt", uses: request.uses });
  else if (queue.length < maxNew) queue.push(request);
}
const failures = [...previous.failedRequests];
let saveQueue = Promise.resolve();
const save = () => {
  saveQueue = saveQueue.then(async () => {
    const content = `${JSON.stringify({ schemaVersion: 1,
  policy: "Exact English text, no candidate normalization or app resolver. OPSIN proves an interpretation, not preference or historical convention. Raw response hashes are retained; service version not supplied.",
  maxNew, concurrency: 2, requestTimeoutMs: 8000, lastUpdatedAt: new Date().toISOString(),
  selection: [...requested.values()], responses: [...responses.values()].sort((a, b) => a.name.localeCompare(b.name, "en")), failedRequests: failures,
    }, null, 2)}\n`;
    const nextPath = new URL("opsin-evidence.next.json", directory);
    for (let attempt = 0; attempt < 5; attempt++) {
      try { writeFileSync(nextPath, content); renameSync(nextPath, evidencePath); return; }
      catch (error) { if (attempt === 4) throw error; await new Promise((resolve) => setTimeout(resolve, 150)); }
    }
  });
  return saveQueue;
};
await save();
let cursor = 0, done = 0, consecutiveFailures = 0, stop = false;
async function worker() {
  while (!stop && cursor < queue.length) {
    const item = queue[cursor++];
    const url = `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(item.name)}.json`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json", "User-Agent": "OrgoRush-NamingAudit/1.0" } });
      const body = await response.text();
      JSON.parse(body);
      responses.set(item.name, { name: item.name, url, retrievedAt: new Date().toISOString(), httpStatus: response.status,
        sha256: sha(body), body, origin: "live-independent-OPSIN", uses: item.uses, selectionReasons: item.reasons });
      consecutiveFailures = 0;
    } catch (error) {
      failures.push({ name: item.name, url, attemptedAt: new Date().toISOString(), error: error.message });
      consecutiveFailures++;
      if (consecutiveFailures >= 3) { stop = true; console.error("Stopped after three consecutive network/service failures; no unbounded retries."); }
    }
    done++; await save();
    if (done % 10 === 0 || stop) console.log(`OPSIN ${done}/${queue.length}; ${responses.size} retained receipts; ${failures.length} failed requests`);
    if (!stop) await new Promise((resolve) => setTimeout(resolve, 120));
  }
}
await Promise.all([worker(), worker()]);
await save();
console.log(JSON.stringify({ attemptedNew: done, plannedNew: queue.length, receipts: responses.size, failures: failures.length }));
if (stop) process.exitCode = 1;
