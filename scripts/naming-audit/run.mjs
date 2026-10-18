import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadExerciseChemistry } from "../../tests/helpers/exercise-chemistry.mjs";
import { buildAuditCases, SEED, VERSION } from "./cases.mjs";
import { evaluateCase } from "./evaluate.mjs";

export const directory = new URL("../../reports/naming-audit/", import.meta.url);
const root = fileURLToPath(new URL("../..", import.meta.url));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha = (body) => createHash("sha256").update(body).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
mkdirSync(new URL("batches/", directory), { recursive: true });
const lock = new URL("run.lock", directory);
const lockHandle = openSync(lock, "wx");
writeFileSync(lockHandle, json({ pid: process.pid, startedAt: new Date().toISOString() }));
let chemistry;
try {
  const tracked = git("ls-files", "app", "tests/reference-corpus", "tests/fixtures/reference-corpus-v1-manifest.json",
    "tests/iupac-engine-audit.test.mjs", "tests/iupac-nom002b-polyunsaturated-ketones.test.mjs", "tests/reasoning-nom004-profile.test.mjs").split("\n").filter(Boolean);
  const hashes = Object.fromEntries(tracked.map((path) => [path, sha(readFileSync(new URL(path, new URL("../..", import.meta.url))))]));
  const sourceHash = sha(JSON.stringify(hashes));
  const harnessFiles = ["cases.mjs", "evaluate.mjs", "run.mjs"];
  const harnessHash = sha(harnessFiles.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n"));
  const baselinePath = new URL("baseline.json", directory);
  if (!existsSync(baselinePath)) writeFileSync(baselinePath, json({
    capturedAt: new Date().toISOString(), clientDate: "2026-10-18", head: git("rev-parse", "HEAD"),
    headSubject: git("log", "-1", "--format=%s"), publicBaseline: "812f725", status: git("status", "--short"),
    inventoryInitialStatus: "?? reports/orgorush-aud001-repair.md", inventoryInitialTrackedDiff: "",
    trackedDiff: git("diff", "--stat"), protectedHashes: hashes, sourceHash,
    interfaceProfiles: { es: ["current", "iupac-1979-es"], en: ["current", "iupac-1979-legacy-en"] },
    inventoryRead: ["tests/reference-corpus/README.md", "tests/helpers/reference-corpus.mjs", "tests/helpers/reference-coverage.mjs",
      "tests/iupac-engine-audit.test.mjs", "tests/stress-naming.test.mjs", "tests/stress-smiles.test.mjs", "tests/chemistry-regressions.test.mjs",
      "tests/reasoning-name-fragments.test.mjs", "tests/iupac-nom002b-polyunsaturated-ketones.test.mjs", "scripts/report-reference-corpus.mjs", "scripts/audit-reference-corpus.mjs"],
  }));
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (baseline.sourceHash !== sourceHash) throw new Error("Production/protected inputs changed since baseline; do not mix audit results across baselines");
  const planPath = new URL("audit-cases.json", directory);
  let plan;
  if (existsSync(planPath)) plan = JSON.parse(readFileSync(planPath, "utf8"));
  else {
    plan = buildAuditCases();
    writeFileSync(planPath, json(plan));
    writeFileSync(new URL("audit-exclusions.json", directory), json({ version: VERSION, seed: SEED,
      reasons: "Rejected graph duplicates are not named again; structures outside Practice/Exam remain in the Lab audit.", cases: plan.excluded }));
  }
  const planHash = sha(json(plan)), results = [], startedAt = new Date().toISOString(), started = performance.now();
  chemistry = await loadExerciseChemistry();
  const batchSize = 25;
  for (let start = 0; start < plan.records.length; start += batchSize) {
    const selection = plan.records.slice(start, start + batchSize);
    const path = new URL(`batches/${String(start + 1).padStart(4, "0")}-${String(start + selection.length).padStart(4, "0")}.json`, directory);
    if (existsSync(path)) {
      const batch = JSON.parse(readFileSync(path, "utf8"));
      if (batch.planHash !== planHash || batch.sourceHash !== sourceHash || batch.harnessHash !== harnessHash) {
        throw new Error(`Stale batch ${path.pathname}; preserve it and start an explicitly versioned audit instead of silently mixing data`);
      }
      results.push(...batch.results);
      console.log(`RESUME ${results.length}/${plan.records.length}`);
      continue;
    }
    const batchStarted = performance.now();
    const observations = selection.map((record) => evaluateCase(record, chemistry.engine));
    const batch = { version: VERSION, seed: SEED, planHash, sourceHash, harnessHash, completedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - batchStarted), results: observations };
    writeFileSync(path, json(batch));
    results.push(...observations);
    writeFileSync(new URL("progress.json", directory), json({ version: VERSION, seed: SEED, completed: results.length,
      total: plan.records.length, lastBatch: path.pathname.split("/").at(-1), sourceHash, planHash, harnessHash }));
    console.log(`SAVED ${results.length}/${plan.records.length}; ${observations.filter((r) => r.signals.length).length} cases with diagnostic signals`);
  }
  const report = { schemaVersion: 1, audit: VERSION, seed: SEED, head: baseline.head, sourceHash, harnessHash, planHash,
    startedAt, completedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started),
    sourceAndEvidencePolicy: "Only per-profile reviewed expectations are exact oracles. GENERATED is not conformance. Structural checks use production import/export plus OCL identities, not Practice/Exam admission. Independent OPSIN receipts are separate.",
    records: results };
  writeFileSync(new URL("audit-matrix.json", directory), json(report));
  console.log(json({ records: results.length, imported: results.filter((r) => r.admission.status === "IMPORTED").length,
    namedOutputs: results.flatMap((r) => Object.values(r.profiles)).filter((p) => p.status === "NAMED").length,
    casesWithSignals: results.filter((r) => r.signals.length).length, durationMs: report.durationMs }));
} finally {
  await chemistry?.close();
  closeSync(lockHandle);
  unlinkSync(lock);
}
