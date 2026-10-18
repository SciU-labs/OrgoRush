import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { Molecule } from "openchemlib";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import {
  getTetrahedralStereoCenters,
  getPotentialTetrahedralStereoCenterIds,
  getMainChainTetrahedralDescriptors,
} from "../app/tetrahedral-stereochemistry.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { loadSnapshots } from "./helpers/reference-corpus.mjs";
import { analyzeBoth } from "../scripts/naming-audit/evaluate.mjs";
import { evidenceMap, interpretName, sha256 } from "../scripts/naming-audit/evidence.mjs";

const read = (name) => JSON.parse(readFileSync(new URL(`../reports/naming-audit/${name}`, import.meta.url), "utf8"));
const imported = (smiles) => {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, result.error);
  return result.molecule;
};
let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

test("AUD-NOM-003B: assigned-center queries avoid CIP without stored R/S, including potential centers", () => {
  const molecule = imported("CC(O)CC");
  assert.equal(getPotentialTetrahedralStereoCenterIds(molecule).length, 1);
  // Reading bonds would already mean entering graph construction, even if CIP were cached.
  const noGraph = { atoms: molecule.atoms, get bonds() { throw Error("Unnecessary tetrahedral graph"); } };
  assert.deepEqual(getTetrahedralStereoCenters(noGraph), []);
  assert.deepEqual(getMainChainTetrahedralDescriptors(noGraph, molecule.atoms.map(atom => atom.id)), []);
  assert.equal(getPotentialTetrahedralStereoCenterIds(molecule).length, 1);
});

test("AUD-NOM-003B: stored R/S still invokes CIP and an achiral assignment is rejected", (t) => {
  const valid = imported("C[C@H](O)CC");
  const invalid = imported("CC(O)C");
  invalid.atoms.find(atom => atom.id === invalid.bonds[0][1]).tetrahedralParity = "R";
  const original = Molecule.prototype.ensureHelperArrays;
  let cipCalls = 0;
  t.mock.method(Molecule.prototype, "ensureHelperArrays", function (level) {
    if (level === Molecule.cHelperCIP) cipCalls++;
    return original.call(this, level);
  });
  assert.equal(getTetrahedralStereoCenters(valid).length, 1);
  assert.ok(cipCalls > 0, "configured centers require OCL CIP validation");
  const beforeInvalid = cipCalls;
  assert.deepEqual(getTetrahedralStereoCenters(invalid), []);
  assert.ok(cipCalls > beforeInvalid, "invalid stored assignments are checked, not trusted");
});

test("AUD-NOM-003B: both E/Z-only Legacy English names need neither clock nor entropy", () => {
  for (const [smiles, expected] of [["C/C=C/C", "(2E)-2-butene"], ["C/C=C\\C", "(2Z)-2-butene"]]) {
    const molecule = imported(smiles);
    const { legacy } = analyzeBoth(molecule, chemistry.engine);
    assert.ok(molecule.atoms.every(atom => !atom.tetrahedralParity));
    const now = Date.now, random = Math.random;
    try {
      Date.now = Math.random = () => { throw Error("Unexpected clock or entropy in E/Z naming"); };
      const model = chemistry.engine.buildLegacyEnglishNameModel(molecule, legacy, legacy.name, { stereochemistry: true });
      assert.equal(generateLegacyEnglishName(model).name, expected);
      assert.deepEqual(getTetrahedralStereoCenters(molecule), []);
    } finally { Date.now = now; Math.random = random; }
  }
});

test("AUD-NOM-003B: offline evidence has authentic receipts and covers all 45 repaired outputs", () => {
  const additions = read("aud-nom-003-opsin-evidence.json");
  assert.equal(additions.schemaVersion, 1);
  assert.equal(additions.responses.length, 16);
  const seen = new Set();
  for (const receipt of additions.responses) {
    assert.equal(typeof receipt.name, "string");
    assert.ok(receipt.name.length > 0);
    assert.ok(!seen.has(receipt.name), `duplicate exact query: ${receipt.name}`);
    seen.add(receipt.name);
    assert.equal(receipt.url, `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(receipt.name)}.json`);
    assert.equal(sha256(receipt.body), receipt.sha256);
    assert.equal(receipt.httpStatus, 200);
    assert.equal(new Date(receipt.retrievedAt).toISOString(), receipt.retrievedAt);
    assert.equal(receipt.origin, "AUD-NOM-003-live-independent-OPSIN");
    const body = JSON.parse(receipt.body);
    assert.equal(body.status, "SUCCESS");
    assert.ok(body.smiles);
    assert.equal(body.cml.match(/<name\b[^>]*>([^<]+)<\/name>/)?.[1], receipt.name);
  }
  const receipts = new Map([...loadSnapshots(), ...evidenceMap(read("opsin-evidence.json")), ...evidenceMap(additions)]);
  const results = read("aud-nom-003-results.json");
  assert.equal(results.task, "AUD-NOM-003");
  assert.equal(results.records.length, 47);
  assert.equal(new Set(results.records.map(record => record.id)).size, 47);
  const inventory = read("audit-cases.json").records;
  const findings = read("audit-findings.json").findings;
  let matches = 0, rejections = 0;
  for (const record of results.records) {
    assert.equal(record.smiles, inventory.find(item => item.id === record.id)?.smiles);
    const finding = findings.find(item => item.id === record.finding);
    assert.deepEqual(Object.keys(record.profiles).sort(), finding.affected.filter(item => item.caseId === record.id).map(item => item.profile).sort());
    for (const [profile, output] of Object.entries(record.profiles)) {
      if (output.state === "SAFE_REJECTION") {
        assert.equal(record.finding, "AUDNOM-003");
        assert.equal(output.after, null);
        assert.equal(output.evidence.status, "UNSUPPORTED");
        rejections++;
      } else {
        assert.equal(output.state, "FIXED");
        assert.ok(profile.endsWith("-en"));
        const independent = interpretName(output.after, record.smiles, receipts);
        assert.equal(independent.status, "MATCH");
        assert.deepEqual(independent, output.evidence, `${record.id}: recorded receipt and full identity`);
        matches++;
      }
    }
  }
  assert.equal(matches, 45);
  assert.equal(rejections, 8);
  assert.deepEqual(results.summary.map(item => [item.finding, item.matches, item.safeRejectionOutputs, item.pending, item.mismatches]),
    [["AUDNOM-002", 33, 0, 0, 0], ["AUDNOM-003", 0, 8, 0, 0], ["AUDNOM-004", 6, 0, 0, 0], ["AUDNOM-005", 6, 0, 0, 0]]);
});
