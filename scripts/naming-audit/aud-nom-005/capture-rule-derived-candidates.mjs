import assert from "node:assert/strict";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evidenceMap, interpretName } from "../evidence.mjs";
import { sha256 } from "./audit-core.mjs";

const output = new URL("../../../reports/naming-audit/aud-nom-005/", import.meta.url);
const inventory = JSON.parse(readFileSync(new URL("../../../reports/naming-audit/audit-matrix.json", import.meta.url), "utf8")).records;
const cases = new Map(inventory.map((record) => [record.id, record]));
// Candidate words are derived from the cited IUPAC rules, before comparing them with output.
const candidates = [
  { id: "AUDCASE-0160", text: "1-chloro-4-ethenylbenzene", profiles: ["2013-en", "1979-en"], sources: [
    "https://iupac.qmul.ac.uk/BlueBook/P1.html#P12",
    "https://iupac.qmul.ac.uk/BlueBook/P5.html",
  ], rule: "P-12.3 identifies ethenylbenzene as PIN; apply the halogen prefix and P-14 locant tie-break to the para-substituted ring." },
  { id: "AUDCASE-0337", text: "2-pentyloxyheptane", profiles: ["2013-en", "1979-en"], sources: [
    "https://iupac.qmul.ac.uk/BlueBook/P6.html#P6322",
    "https://iupac.qmul.ac.uk/BlueBook/P6.html#P6324",
  ], rule: "P-63.2.2.1.1 gives the R′-O– prefix by concatenating oxy to the substituent-prefix name and lists pentyloxy; P-63.2.4 permits substitutive ether naming." },
];
for (const candidate of candidates) assert.ok(cases.has(candidate.id), `unknown original case ${candidate.id}`);
const path = new URL("rule-derived-candidate-receipts.json", output);
const existing = new Map();
for (const file of ["opsin-evidence.json", "aud-nom-003-opsin-evidence.json"]) {
  const doc = JSON.parse(readFileSync(new URL(`../../../reports/naming-audit/${file}`, import.meta.url), "utf8"));
  for (const [name, receipt] of evidenceMap(doc)) existing.set(name, receipt);
}
const sample = JSON.parse(readFileSync(new URL("sample-opsin-evidence.json", output), "utf8"));
for (const [name, receipt] of evidenceMap(sample)) existing.set(name, receipt);
for (const candidate of candidates) assert.ok(!existing.has(candidate.text), `candidate already has a protected exact-text receipt: ${candidate.text}`);
const attempts = await Promise.all(candidates.map(async (candidate) => {
  const record = cases.get(candidate.id);
  const url = `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(candidate.text)}.json`;
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    return { candidate, smiles: record.smiles, receipt: { name: candidate.text, url, retrievedAt, httpStatus: response.status,
      statusText: response.statusText, body, sha256: sha256(body), parsedStatus: parsed?.status ?? null } };
  } catch (error) {
    return { candidate, smiles: record.smiles, failure: { name: candidate.text, url, retrievedAt, error: error.message } };
  }
}));
const responses = attempts.filter((attempt) => attempt.receipt).map((attempt) => ({ ...attempt, structuralInterpretation: null }));
const failedRequests = attempts.filter((attempt) => attempt.failure);
const doc = { audit: "AUD-NOM-005-v1", capturedAt: new Date().toISOString(), maximumQueries: 2,
  candidateSelection: "Rule-derived names fixed in this script from cited IUPAC primary sources before comparison with OrgoRush output.",
  responses: responses.map((attempt) => attempt.receipt), failedRequests };
const temp = new URL("rule-derived-candidate-receipts.json.tmp", output);
writeFileSync(temp, `${JSON.stringify(doc, null, 2)}\n`);
renameSync(temp, path);
const map = new Map(responses.map((attempt) => [attempt.candidate.text, attempt.receipt]));
const evaluated = responses.map(({ candidate, smiles }) => ({ ...candidate, inputSmiles: smiles,
  structuralInterpretation: interpretName(candidate.text, smiles, map) }));
doc.evaluated = evaluated;
const finalTemp = new URL("rule-derived-candidate-receipts.json.tmp", output);
writeFileSync(finalTemp, `${JSON.stringify(doc, null, 2)}\n`);
renameSync(finalTemp, path);
console.log(JSON.stringify({ requested: candidates.length, received: responses.length, failed: failedRequests.length,
  evaluations: evaluated.map(({ id, text, structuralInterpretation }) => ({ id, text, status: structuralInterpretation.status, constitutionalMatch: structuralInterpretation.constitutionalMatch })) }));
