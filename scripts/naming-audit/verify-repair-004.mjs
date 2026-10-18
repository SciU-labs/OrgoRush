// Current-code snapshots are separate from the immutable AUD-NOM-001 baseline.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadExerciseChemistry } from "../../tests/helpers/exercise-chemistry.mjs";
import { moleculeFromSmiles, moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { analyzeBoth, displayedProfiles, serializable } from "./evaluate.mjs";

const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase), "Usage: node scripts/naming-audit/verify-repair-004.mjs before|after");
const directory = new URL("../../reports/naming-audit/", import.meta.url);
const path = new URL(`aud-nom-004-${phase}.json`, directory);
if (phase === "before") assert.equal(existsSync(path), false, "never overwrite the pre-repair snapshot");
const inventory = JSON.parse(readFileSync(new URL("audit-cases.json", directory))).records;
const hash = (value) => createHash("sha256").update(JSON.stringify(serializable(value))).digest("hex");
const chemistry = await loadExerciseChemistry();
const records = [];
try {
  for (const record of inventory) {
    const result = moleculeFromSmiles(record.smiles);
    if (!result.ok) { records.push({ id: record.id, error: result.error }); continue; }
    const molecule = result.molecule, analyses = analyzeBoth(molecule, chemistry.engine);
    const profiles = displayedProfiles(molecule, analyses, chemistry.engine);
    records.push({ id: record.id, smiles: record.smiles, graphHash: hash(molecule), analysisHash: hash(analyses),
      exported: moleculeToSmiles(molecule), names: Object.fromEntries(Object.entries(profiles).map(([key, item]) => [key, item.name])) });
  }
} finally { await chemistry.close(); }
const differences = [];
if (phase === "after") {
  const before = JSON.parse(readFileSync(new URL("aud-nom-004-before.json", directory)));
  assert.equal(records.length, before.records.length);
  for (const current of records) {
    const previous = before.records.find((item) => item.id === current.id);
    for (const key of ["error", "graphHash", "analysisHash", "exported"]) assert.deepEqual(current[key], previous[key], `${current.id}/${key}`);
    for (const profile of Object.keys(current.names ?? {})) if (current.names[profile] !== previous.names[profile]) {
      differences.push({ id: current.id, profile, before: previous.names[profile], after: current.names[profile] });
      assert.ok(["AUDCASE-0411", "AUDCASE-0412", "AUDCASE-0413", "AUDCASE-0414"].includes(current.id) && profile === "1979-es", "only the four defective duplicated stereo names may change");
    }
  }
  assert.equal(differences.length, 4);
}
writeFileSync(path, `${JSON.stringify({ task: "AUD-NOM-004", phase, generatedAt: new Date().toISOString(), records, differences }, null, 2)}\n`);
console.log(JSON.stringify({ phase, records: records.length, differences }));
