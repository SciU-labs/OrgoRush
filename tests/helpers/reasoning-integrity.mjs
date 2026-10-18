import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moleculeFromSmiles, moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { analyzeBoth, displayedProfiles } from "../../scripts/naming-audit/evaluate.mjs";
import { structuralIdentity } from "./reference-corpus.mjs";

const read = (file) => JSON.parse(readFileSync(new URL(`../../reports/naming-audit/${file}`, import.meta.url)));
export const inventory = read("audit-cases.json").records;
export const findings = read("audit-findings.json").findings;
export function affected(id) {
  const finding = findings.find((item) => item.id === id);
  return [...new Set(finding.affected.map((item) => item.caseId))].map((caseId) => ({
    ...inventory.find((item) => item.id === caseId),
    affectedProfiles: finding.affected.filter((item) => item.caseId === caseId).map((item) => item.profile),
  }));
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
  assert.equal(structuralIdentity(smiles), structuralIdentity(exported.smiles));
  assert.deepEqual(molecule, before);
  return { molecule, analyses, profiles };
}
export function project(engine, observed, key) {
  const { molecule, analyses, profiles } = observed;
  const profile = profiles[key];
  assert.ok(profile.name, `${key} is available`);
  const before = structuredClone({ molecule, analyses });
  const result = engine.buildActiveIupacReasoning({ molecule, analyses, ...profile,
    displayedName: profile.name, generatedNames: Object.values(profiles).map((item) => item.name).filter(Boolean), canHighlight: true });
  assert.strictEqual(result.analysis, key.startsWith("2013") ? analyses.current : analyses.legacy);
  assert.deepEqual({ molecule, analyses }, before, "reasoning does not mutate graph or analyses");
  return result;
}
export const evidence = (model) => Object.entries(model.fragments).flatMap(([stepNumber, item]) =>
  [item, ...(item.additionalFragments ?? [])].map((part) => ({ ...part, stepNumber })));

/** Reusable contracts for the current name, active analysis and actual graph. */
export function assertReasoningIntegrity(model, molecule) {
  const { displayedName: name, analysis, steps, links } = model;
  const stepIds = new Set(steps.map((item) => item.number));
  const atoms = new Set(molecule.atoms.map((item) => item.id));
  assert.equal(stepIds.size, steps.length, "unique navigation destinations");
  assert.equal(links.map((item) => item.text).join(""), name, "exact visible-name reconstruction");
  const seen = new Set();
  for (const item of evidence(model)) {
    const start = item.start ?? name.indexOf(item.text);
    assert.ok(start >= 0 && start + item.text.length <= name.length);
    assert.equal(name.slice(start, start + item.text.length), item.text);
    assert.ok(stepIds.has(item.stepNumber));
    const identity = `${item.stepNumber}:${start}:${start + item.text.length}:${item.kind}:${item.semanticId ?? ""}`;
    assert.equal(seen.has(identity), false, `duplicate evidence ${identity}`);
    seen.add(identity);
    for (const id of item.atomIds ?? []) assert.ok(atoms.has(id), `unknown atom ${id}`);
    for (const pair of item.bondIds ?? []) {
      assert.ok(pair.every((id) => atoms.has(id)));
      const bond = molecule.bonds.find(([a, b]) => a === pair[0] && b === pair[1] || b === pair[0] && a === pair[1]);
      assert.ok(bond, "existing bond");
      if (item.bondType) assert.equal(bond[2] ?? 1, item.bondType === "double" ? 2 : 3);
    }
    if (item.kind === "parent" && item.atomIds) assert.deepEqual(new Set(item.atomIds), new Set(analysis.mainChain));
    for (const origin of item.contributions ?? []) {
      assert.ok(analysis.functionalGroups.some((group) => group.kind === origin.group));
      for (const id of origin.atomIds) assert.ok(atoms.has(id));
    }
    if (item.locant !== undefined && item.kind === "unsaturation") {
      assert.ok((item.bondType === "double" ? analysis.doubleBondLocants : analysis.tripleBondLocants).includes(item.locant));
      assert.ok(item.atomIds.includes(analysis.mainChain[item.locant - 1]));
    }
  }
  for (const link of links) {
    for (const target of [link.stepNumber, ...(link.relatedStepNumbers ?? [])].filter(Boolean)) assert.ok(stepIds.has(target));
    for (const id of link.atomIds ?? []) assert.ok(atoms.has(id));
  }
}
