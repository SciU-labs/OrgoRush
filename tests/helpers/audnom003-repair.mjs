import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moleculeFromSmiles, moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { analyzeBoth, displayedProfiles } from "../../scripts/naming-audit/evaluate.mjs";
import { structuralIdentity, loadSnapshots } from "./reference-corpus.mjs";
import { evidenceMap, interpretName } from "../../scripts/naming-audit/evidence.mjs";

export const findings = JSON.parse(readFileSync(new URL("../../reports/naming-audit/audit-findings.json", import.meta.url))).findings;
export const inventory = JSON.parse(readFileSync(new URL("../../reports/naming-audit/audit-cases.json", import.meta.url))).records;
export const historicalResults = JSON.parse(readFileSync(new URL("../../reports/naming-audit/audit-matrix.json", import.meta.url))).records;
const receipts = new Map([...loadSnapshots(),
  ...evidenceMap(JSON.parse(readFileSync(new URL("../../reports/naming-audit/opsin-evidence.json", import.meta.url)))),
  ...evidenceMap(JSON.parse(readFileSync(new URL("../../reports/naming-audit/aud-nom-003-opsin-evidence.json", import.meta.url))))]);
export function assertIndependentName(name, smiles) {
  const result = interpretName(name, smiles, receipts);
  assert.equal(result.status, "MATCH", `${name}: ${JSON.stringify(result)}`);
}
export function affected(id) {
  return [...new Set(findings.find((item) => item.id === id).affected.map((item) => item.caseId))]
    .map((caseId) => inventory.find((item) => item.id === caseId));
}
export function observe(engine, smiles) {
  const imported = moleculeFromSmiles(smiles);
  assert.equal(imported.ok, true, imported.error);
  const molecule = imported.molecule;
  const before = structuredClone(molecule);
  const analyses = analyzeBoth(molecule, engine);
  const profiles = displayedProfiles(molecule, analyses, engine);
  const exported = moleculeToSmiles(molecule);
  assert.equal(exported.ok, true, exported.error);
  assert.deepEqual(molecule, before, "naming does not mutate the molecular graph");
  assert.equal(structuralIdentity(exported.smiles), structuralIdentity(smiles), "SMILES retains full identity");
  return { molecule, analyses, profiles, exported: exported.smiles };
}
