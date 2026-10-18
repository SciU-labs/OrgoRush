import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CanonizerUtil, SmilesParser } from "openchemlib";
import { loadExerciseChemistry } from "../../../tests/helpers/exercise-chemistry.mjs";
import { structuralIdentity } from "../../../tests/helpers/reference-corpus.mjs";
import { moleculeFromSmiles, moleculeToSmiles } from "../../../app/openchemlib-adapter.ts";
import { evidenceMap, interpretName } from "../evidence.mjs";
import { analyzeBoth, displayedProfiles, evaluateCase, serializable } from "../evaluate.mjs";
import { AUDIT_VERSION, PROFILES, selectReferenceSample, validateBatch, validateHistoricalInventory } from "./audit-core.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = new URL("../../../reports/naming-audit/aud-nom-005/", import.meta.url);
const historicalMatrixPath = new URL("../../../reports/naming-audit/audit-matrix.json", import.meta.url);
const previousAfterPath = new URL("../../../reports/naming-audit/aud-nom-004-after.json", import.meta.url);
const rootJson = (relativePath) => JSON.parse(readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8"));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const atomicWrite = (path, value) => {
  const temp = new URL(`${path.pathname.split("/").at(-1)}.tmp`, path);
  writeFileSync(temp, json(value));
  renameSync(temp, path);
};
const currentFiles = git("ls-files", "app", "tests/helpers/exercise-chemistry.mjs", "tests/helpers/reference-corpus.mjs",
  "tests/fixtures/reference-corpus-v1-manifest.json").split(/\r?\n/).filter(Boolean);
const protectedInputs = [
  "reports/naming-audit/audit-matrix.json", "reports/naming-audit/audit-cases.json",
  "reports/naming-audit/opsin-evidence.json", "reports/naming-audit/aud-nom-003-opsin-evidence.json",
  "reports/naming-audit/aud-nom-004-before.json", "reports/naming-audit/aud-nom-004-after.json",
  "reports/naming-audit/audit-findings.json", "reports/naming-audit/adjudications.json",
];
const harnessPaths = [
  "scripts/naming-audit/aud-nom-005/audit-core.mjs", "scripts/naming-audit/aud-nom-005/run.mjs",
  "scripts/naming-audit/evaluate.mjs", "scripts/naming-audit/evidence.mjs",
  "tests/helpers/exercise-chemistry.mjs", "tests/helpers/reference-corpus.mjs",
];
const sourceHashes = Object.fromEntries(currentFiles.map((path) => [path, sha(readFileSync(new URL(`../../../${path}`, import.meta.url)))]));
const inputHashes = Object.fromEntries(protectedInputs.map((path) => [path, sha(readFileSync(new URL(`../../../${path}`, import.meta.url)))]));
const sourceHash = sha(JSON.stringify({ sourceHashes, inputHashes }));
const harnessHash = sha(harnessPaths.map((path) => `${path}\0${readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8")}`).join("\n"));
const commit = git("rev-parse", "HEAD");
const lockPath = new URL("run.lock", output);

mkdirSync(output, { recursive: true });
const inventory = rootJson("reports/naming-audit/audit-matrix.json").records;
const inventorySummary = validateHistoricalInventory(inventory);
const priorAfter = JSON.parse(readFileSync(previousAfterPath, "utf8"));
assert.equal(priorAfter.records.length, 440, "AUD-NOM-004 comparison must cover the original 440 IDs");
assert.deepEqual(new Set(priorAfter.records.map((record) => record.id)), new Set(inventory.map((record) => record.id)));

const planPath = new URL("plan.json", output);
const plan = existsSync(planPath) ? JSON.parse(readFileSync(planPath, "utf8")) : {
  audit: AUDIT_VERSION,
  createdAt: new Date().toISOString(),
  historicalInventory: "reports/naming-audit/audit-matrix.json",
  inventoryHash: inputHashes["reports/naming-audit/audit-matrix.json"],
  inventory: inventorySummary,
  batchSize: 25,
  ids: inventory.map((record) => record.id),
  referenceSample: selectReferenceSample(inventory),
};
assert.equal(plan.audit, AUDIT_VERSION);
assert.equal(plan.inventoryHash, inputHashes["reports/naming-audit/audit-matrix.json"], "historical inventory changed; do not mix runs");
assert.deepEqual(plan.ids, inventory.map((record) => record.id));
assert.equal(plan.referenceSample.total, 50);
if (!existsSync(planPath)) atomicWrite(planPath, plan);
const planHash = sha(json(plan));

let lockHandle;
try {
  lockHandle = openSync(lockPath, "wx");
} catch {
  let existing;
  try { existing = JSON.parse(readFileSync(lockPath, "utf8")); } catch { throw new Error("AUD-NOM-005 run.lock exists and is not readable; inspect it before resuming"); }
  try { process.kill(existing.pid, 0); throw new Error(`AUD-NOM-005 is already running as PID ${existing.pid}`); }
  catch (error) { if (error.message.includes("already running")) throw error; }
  unlinkSync(lockPath);
  lockHandle = openSync(lockPath, "wx");
}
writeFileSync(lockHandle, json({ pid: process.pid, audit: AUDIT_VERSION, startedAt: new Date().toISOString() }));

let chemistry;
try {
  const manifestPath = new URL("manifest.json", output);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {
    audit: AUDIT_VERSION,
    startedAt: new Date().toISOString(),
    head: commit,
    branch: git("branch", "--show-current"),
    initialStatus: git("status", "--short"),
    latestWorkflow: { id: 39154680173, status: "completed", conclusion: "success", url: "https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/39154680173" },
    sourceHashes, inputHashes, sourceHash, harnessHash, planHash,
    evidencePolicy: "No network. Interpretations use only SHA-256-validated OPSIN receipts present at start. Generated names do not become exact/normative expectations.",
  };
  assert.equal(manifest.audit, AUDIT_VERSION);
  assert.equal(manifest.head, commit, "HEAD changed during an incomplete audit; start another versioned run");
  assert.equal(manifest.sourceHash, sourceHash, "source/protected input hash changed; preserving partial batches");
  assert.equal(manifest.harnessHash, harnessHash, "audit harness changed; preserving partial batches");
  assert.equal(manifest.planHash, planHash, "audit plan changed; preserving partial batches");
  if (!existsSync(manifestPath)) atomicWrite(manifestPath, manifest);

  const receiptDocuments = [
    rootJson("reports/naming-audit/opsin-evidence.json"),
    rootJson("reports/naming-audit/aud-nom-003-opsin-evidence.json"),
  ];
  const receipts = new Map();
  for (const document of receiptDocuments) {
    const valid = evidenceMap(document);
    for (const [name, receipt] of valid) {
      const prior = receipts.get(name);
      if (prior && prior.sha256 !== receipt.sha256) throw new Error(`Conflicting immutable receipts for exact text ${name}`);
      if (!prior) receipts.set(name, receipt);
    }
  }
  chemistry = await loadExerciseChemistry();
  const resultDirectory = new URL("batches/", output);
  mkdirSync(resultDirectory, { recursive: true });
  const batchSize = plan.batchSize;
  const fullInputId = (smiles) => structuralIdentity(smiles);
  const constitutionId = (smiles) => CanonizerUtil.getIDCode(new SmilesParser().parseMolecule(smiles), CanonizerUtil.NOSTEREO);
  const results = [];

  for (let start = 0; start < inventory.length; start += batchSize) {
    const sourceBatch = inventory.slice(start, start + batchSize);
    const name = `${String(start + 1).padStart(4, "0")}-${String(start + sourceBatch.length).padStart(4, "0")}.json`;
    const batchPath = new URL(name, resultDirectory);
    if (existsSync(batchPath)) {
      const batch = JSON.parse(readFileSync(batchPath, "utf8"));
      validateBatch(batch, sourceBatch.map(({ id }) => id), { planHash, sourceHash, harnessHash });
      results.push(...batch.records);
      console.log(`RESUME ${results.length}/440`);
      continue;
    }
    const observations = [];
    for (const record of sourceBatch) {
      const result = evaluateCase(record, chemistry.engine);
      let independentInputIdentity, independentConstitutionIdentity;
      try {
        independentInputIdentity = fullInputId(record.smiles);
        independentConstitutionIdentity = constitutionId(record.smiles);
      } catch (error) {
        independentInputIdentity = { error: error.message };
        independentConstitutionIdentity = { error: error.message };
      }
      const parsed = moleculeFromSmiles(record.smiles);
      let editable;
      if (!parsed.ok) {
        editable = { status: "REJECTED", reason: parsed.error, exported: null, graph: null };
      } else {
        const molecule = parsed.molecule;
        const exported = moleculeToSmiles(molecule);
        const importedIdentity = exported.ok ? fullInputId(exported.smiles) : null;
        const importedConstitution = exported.ok ? constitutionId(exported.smiles) : null;
        const specifiedStereo = /[@/\\]/.test(record.smiles);
        const isotopePresent = /\[\d+[A-Z]/.test(record.smiles);
        const fullIdentityMatches = importedIdentity === record.identity;
        const constitutionMatches = importedConstitution === independentConstitutionIdentity;
        editable = {
          status: "IMPORTED",
          exported: exported.ok ? exported.smiles : null,
          exportError: exported.ok ? undefined : exported.error,
          fullIdentityMatches,
          constitutionMatches,
          stereo: !specifiedStereo ? "NOT_APPLICABLE" : fullIdentityMatches && constitutionMatches ? "PASS" : constitutionMatches ? "FAIL" : "NOT_ASSESSED",
          isotope: !isotopePresent ? "NOT_APPLICABLE" : molecule.atoms.some((atom) => atom.isotope != null) && fullIdentityMatches ? "PASS" : "FAIL",
          graph: { atoms: molecule.atoms.map(({ id, element, charge, isotope, tetrahedralParity }) => ({ id, element: element ?? "C", charge: charge ?? 0, isotope: isotope ?? null, tetrahedralParity: tetrahedralParity ?? null })),
            bonds: molecule.bonds.map(([a, b, order = 1, stereo]) => ({ atoms: [a, b], order, stereo: Boolean(stereo) })) },
        };
      }
      const interpretations = {};
      for (const profile of PROFILES) {
        const name = result.profiles[profile]?.name ?? null;
        let interpretation = { status: name ? "UNVERIFIED" : "UNSUPPORTED", reason: "Spanish/current exact text has no independent OPSIN receipt" };
        if (name && profile.endsWith("-en")) interpretation = interpretName(name, record.smiles, receipts);
        interpretations[profile] = {
          status: result.profiles[profile]?.status ?? "ERROR",
          name,
          structural: interpretation,
          exactHistoricalExpectation: record.expected?.[profile]
            ? { status: name === record.expected[profile] ? "MATCH" : "MISMATCH", expected: record.expected[profile] }
            : { status: "NO_EXACT_EXPECTATION" },
          normative: { status: "UNADJUDICATED", reason: "OPSIN and generated output do not establish IUPAC preference or Spanish editorial convention" },
        };
      }
      const safeIsotopeRejection = parsed.ok === false && /isótopos explícitos.*no admite/i.test(parsed.error ?? "");
      observations.push({
        id: record.id,
        family: record.family,
        smiles: record.smiles,
        historicalIdentity: record.identity,
        independentInput: { fullIdentity: independentInputIdentity, constitutionIdentity: independentConstitutionIdentity },
        editable,
        safeRejection: safeIsotopeRejection,
        currentEvaluation: result,
        profiles: interpretations,
      });
    }
    const batch = { audit: AUDIT_VERSION, batch: name, planHash, sourceHash, harnessHash, completedAt: new Date().toISOString(), records: observations };
    atomicWrite(batchPath, batch);
    results.push(...observations);
    atomicWrite(new URL("progress.json", output), { audit: AUDIT_VERSION, completed: results.length, total: inventory.length, lastBatch: name, planHash, sourceHash, harnessHash });
    console.log(`SAVED ${results.length}/440; ${observations.filter((record) => record.currentEvaluation.signals.length).length} cases with signals`);
  }

  assert.equal(results.length, 440);
  const fullReport = { audit: AUDIT_VERSION, head: commit, sourceHash, harnessHash, planHash, completedAt: new Date().toISOString(), records: results };
  atomicWrite(new URL("current-results.json", output), fullReport);
  manifest.completedAt = fullReport.completedAt;
  manifest.currentResultsSha256 = sha(json(fullReport));
  atomicWrite(new URL("manifest.json", output), manifest);
  console.log(json({ records: results.length, imported: results.filter((record) => record.editable.status === "IMPORTED").length,
    rejected: results.filter((record) => record.editable.status === "REJECTED").length,
    namedOutputs: results.reduce((sum, record) => sum + Object.values(record.profiles).filter((profile) => profile.status === "NAMED").length, 0),
    signalCases: results.filter((record) => record.currentEvaluation.signals.length).length, selectedReferenceSample: plan.referenceSample.total }));
} finally {
  await chemistry?.close();
  closeSync(lockHandle);
  unlinkSync(lockPath);
}
