// Follow-up to the frozen audit. Only new AUD-NOM-003 artifacts are written.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadExerciseChemistry } from "../../tests/helpers/exercise-chemistry.mjs";
import { loadSnapshots } from "../../tests/helpers/reference-corpus.mjs";
import { observe, affected } from "../../tests/helpers/audnom003-repair.mjs";
import { evidenceMap, interpretName } from "./evidence.mjs";

const directory = new URL("../../reports/naming-audit/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, directory), "utf8"));
const ids = ["AUDNOM-002", "AUDNOM-003", "AUDNOM-004", "AUDNOM-005"];
const findings = read("audit-findings.json").findings;
const historical = read("audit-matrix.json");
const receiptPath = new URL("aud-nom-003-opsin-evidence.json", directory);
const additions = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : { schemaVersion: 1, responses: [] };
const receipts = new Map([...loadSnapshots(), ...evidenceMap(read("opsin-evidence.json")), ...evidenceMap(additions)]);
const chemistry = await loadExerciseChemistry();
const records = [];
try {
  for (const id of ids) for (const record of affected(id)) {
    const observed = observe(chemistry.engine, record.smiles);
    const old = historical.records.find((item) => item.id === record.id);
    const profiles = {};
    for (const { profile } of findings.find((item) => item.id === id).affected.filter((item) => item.caseId === record.id)) {
      const name = observed.profiles[profile].name;
      profiles[profile] = { before: old.profiles[profile].name, after: name,
        state: name === null ? "SAFE_REJECTION" : "FIXED",
        evidence: profile.endsWith("-en") ? interpretName(name, record.smiles, receipts) : { status: name === null ? "UNSUPPORTED" : "UNVERIFIED" } };
    }
    records.push({ finding: id, id: record.id, smiles: record.smiles, profiles });
  }
} finally { await chemistry.close(); }

const names = new Set(records.flatMap((item) => Object.entries(item.profiles)
  .filter(([profile, value]) => profile.endsWith("-en") && value.after).map(([, value]) => value.after)));
// Small set of added boundary fixtures, not a new corpus of preferred names.
for (const name of ["N,N-dimethylpropanamide", "N-ethyl-N-methyl-1-propanamine", "N,3-dimethylbutanamide",
  "2-methylbutanedioic acid", "2-hydroxybutanedioic acid"]) names.add(name);
const missing = [...names].filter((name) => !receipts.has(name));
if (process.argv.includes("--capture")) {
  if (missing.length > 40) throw new Error("Refusing more than 40 targeted new OPSIN requests");
  for (const name of missing) {
    const url = `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(name)}.json`;
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    const body = await response.text();
    JSON.parse(body);
    const receipt = { name, url, retrievedAt: new Date().toISOString(), httpStatus: response.status,
      body, sha256: createHash("sha256").update(body).digest("hex"), origin: "AUD-NOM-003-live-independent-OPSIN" };
    additions.responses.push(receipt);
    receipts.set(name, receipt);
    writeFileSync(receiptPath, `${JSON.stringify(additions, null, 2)}\n`);
  }
}
for (const record of records) for (const [profile, result] of Object.entries(record.profiles)) {
  if (profile.endsWith("-en")) result.evidence = interpretName(result.after, record.smiles, receipts);
}
const summary = ids.map((id) => {
  const rows = records.filter((item) => item.finding === id);
  const outputs = rows.flatMap((item) => Object.values(item.profiles));
  return { finding: id, structures: rows.length, fixedOutputs: outputs.filter((item) => item.state === "FIXED").length,
    safeRejectionOutputs: outputs.filter((item) => item.state === "SAFE_REJECTION").length,
    matches: outputs.filter((item) => item.evidence.status === "MATCH").length,
    pending: outputs.filter((item) => item.after && item.evidence.status === "UNVERIFIED").length,
    mismatches: outputs.filter((item) => ["MISMATCH", "REJECTED"].includes(item.evidence.status)).length };
});
const result = { task: "AUD-NOM-003", historicalHead: historical.head, generatedAt: new Date().toISOString(),
  sourceHashes: Object.fromEntries(["app/page.tsx", "app/legacy-english-nomenclature.ts"].map((path) =>
    [path, createHash("sha256").update(readFileSync(new URL(`../../${path}`, import.meta.url))).digest("hex")])),
  policy: "OPSIN MATCH establishes structural interpretation, not preferred historical spelling. Original audit artifacts are immutable.",
  summary, records };
writeFileSync(new URL("aud-nom-003-results.json", directory), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ summary, newRequestsNeeded: [...names].filter((name) => !receipts.has(name)).length }, null, 2));
if (summary.some((item) => item.mismatches)) process.exitCode = 1;
