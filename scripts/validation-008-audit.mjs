import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { Molecule, SmilesParser, CanonizerUtil } from "openchemlib";
import { VALIDATION_CASES, PROFILES, SOURCES } from "../tests/fixtures/orgorush-validation-008.mjs";
import { NAME_REVIEWS } from "../tests/fixtures/orgorush-validation-008.review.mjs";
import { referenceGraph, referenceParentCandidates, normalizeFormula } from "../tests/helpers/validation-008-reference.mjs";
import { loadExerciseChemistry } from "../tests/helpers/exercise-chemistry.mjs";
import { assertReasoningIntegrity, evidence } from "../tests/helpers/reasoning-integrity.mjs";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { analyzeBoth, displayedProfiles, resolvedProfileAnalyses } from "./naming-audit/evaluate.mjs";

const fixturePath = new URL("../tests/fixtures/orgorush-validation-008.mjs", import.meta.url);
const snapshotPath = new URL("../tests/fixtures/orgorush-validation-008.opsin.json", import.meta.url);
export const digest = text => createHash("sha256").update(text).digest("hex");
export function identity(smiles) {
  const molecule = new SmilesParser().parseMolecule(smiles); molecule.ensureHelperArrays(Molecule.cHelperCIP);
  return CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL);
}
export function loadOpsin() {
  const entries = JSON.parse(readFileSync(snapshotPath, "utf8")).responses;
  for (const item of entries) if (item.body) assert.equal(digest(item.body), item.sha256);
  return new Map(entries.map(item => [item.name, item]));
}
export function checkWitness(name, smiles, snapshots) {
  const entry = snapshots.get(name);
  if (!entry || entry.httpStatus !== 200) return { status: "REFERENCE-PENDING", reason: "No usable independent OPSIN snapshot" };
  const body = JSON.parse(entry.body);
  if (body.status !== "SUCCESS" || !body.smiles) return { status: "REFERENCE-PENDING", reason: body.message ?? body.status };
  return { status: identity(body.smiles) === identity(smiles) ? "PASS" : "FAIL-STRUCTURE", smiles: body.smiles, url: entry.url, sha256: entry.sha256 };
}
export function verifyReferences(snapshots = loadOpsin()) {
  assert.ok(VALIDATION_CASES.length >= 60);
  const identities = new Set();
  for (const row of VALIDATION_CASES) {
    const ref = referenceGraph(row.smiles), id = identity(row.smiles);
    assert.equal(identities.has(id), false, `${row.id}: duplicate constitution`); identities.add(id);
    assert.deepEqual(ref.groupCounts, row.groups, `${row.id}: independently detected groups`);
    const ocl = new SmilesParser().parseMolecule(row.smiles);
    assert.equal(normalizeFormula(ocl.getMolecularFormula().formula), ref.formula, `${row.id}: independent formula readers agree`);
    for (const profile of PROFILES) {
      const candidates = referenceParentCandidates(ref, profile);
      if (candidates) assert.equal(candidates[0].length, row.parentCarbons[profile], `${row.id}/${profile}: independent parent length`);
    }
    for (const name of new Set([row.modernEnglishWitness, row.expected["1979-en"]])) {
      assert.equal(checkWitness(name, row.smiles, snapshots).status, "PASS", `${row.id}: reference name graph: ${name}`);
    }
    for (const key of row.references) assert.ok(SOURCES[key]?.url, `${row.id}: normative source ${key}`);
  }
  return { cases: identities.size, fixtureSha256: digest(readFileSync(fixturePath)),
    namesAndStructuresSha256: digest(JSON.stringify(VALIDATION_CASES.map(row => ({ id: row.id, smiles: row.smiles, expected: row.expected, modernEnglishWitness: row.modernEnglishWitness, parentCarbons: row.parentCarbons, groups: row.groups })))),
    opsinSha256: digest(readFileSync(snapshotPath)) };
}

function variants(graph) {
  const remap = new Map(graph.atoms.map((atom, i) => [atom.id, 1001 + i * 17]));
  return [
    { label: "stored", graph, original: id => id },
    { label: "reindexed-reflected", original: id => [...remap].find(([, value]) => value === id)?.[0],
      graph: { atoms: graph.atoms.map(atom => ({ ...atom, id: remap.get(atom.id), x: -atom.x + 71, y: atom.y - 11 })).reverse(),
        bonds: graph.bonds.map(([a, b, ...rest]) => [remap.get(b), remap.get(a), ...rest]).reverse(),
        rings: graph.rings?.map(ring => ({ ...ring, atomIds: ring.atomIds.map(id => remap.get(id)) })).reverse() } },
  ];
}

export function auditProfile(engine, row, reference, variant, analyses, available, snapshots) {
  const selection = available, name = selection.name, issues = [];
  const add = (classification, code, detail, severity = "P1") => issues.push({ classification, code, detail, severity });
  const profile = selection.convention === "current" ? "2013-es" : selection.language === "es" ? "1979-es" : "1979-en";
  const result = { observed: name, expected: row.expected[profile], classification: null, issues };
  const rawFormula = analyses[selection.selected].formula;
  result.formula = { expected: reference.formula, observed: rawFormula, status: normalizeFormula(rawFormula) === reference.formula ? "PASS" : "FAIL-STRUCTURE" };
  if (result.formula.status !== "PASS") add("FAIL-STRUCTURE", "FORMULA", result.formula, "P0");
  if (!name) return { ...result, classification: issues.length ? "FAIL-STRUCTURE" : "UNSUPPORTED", availability: "Explicit production safety/lexical gate", reasoning: null };
  const active = resolvedProfileAnalyses(variant.graph, analyses, selection, engine);
  const analysis = active[selection.selected];
  const before = structuredClone({ graph: variant.graph, analysis });
  const model = engine.buildActiveIupacReasoning({ molecule: variant.graph, analyses: active, language: selection.language,
    convention: selection.convention, displayedName: name, generatedNames: Object.values(available.all).map(item => item.name).filter(Boolean), canHighlight: true });
  if (!isDeepStrictEqual(before, { graph: variant.graph, analysis })) add("FAIL-STRUCTURE", "REASONING_MUTATION", "Reasoning mutates graph or active analysis", "P0");
  const path = analysis.mainChain.map(variant.original);
  if (path.length !== row.parentCarbons[profile]) add("FAIL-NAME", "PARENT_LENGTH", `Expected ${row.parentCarbons[profile]} parent carbons, observed ${path.length}`);
  const candidates = referenceParentCandidates(reference, profile);
  if (candidates && !candidates.some(candidate => isDeepStrictEqual(candidate, path))) {
    add("FAIL-NAME", "PARENT_SELECTION_OR_NUMBERING", { actualPath: path, independentCandidates: candidates, rule: profile === "2013-es" ? "P-44" : "C-13.11" });
  }
  for (const [id, locant] of analysis.numberedAtoms) {
    if (candidates && path.indexOf(variant.original(id)) + 1 !== locant) add("FAIL-REASONING", "ATOM_LOCANT", { id, locant, path });
  }
  const observedGroups = Object.fromEntries([...new Set(analysis.functionalGroups.map(group => group.kind))].sort()
    .map(kind => [kind, analysis.functionalGroups.filter(group => group.kind === kind).length]));
  if (!isDeepStrictEqual(observedGroups, reference.groupCounts)) add("FAIL-REASONING", "FUNCTIONAL_GROUP_INVENTORY", { expected: reference.groupCounts, observed: observedGroups });
  if (reference.primary && analysis.primaryFunctionalGroup !== reference.primary) add("FAIL-NAME", "FUNCTIONAL_PRIORITY", { expected: reference.primary, observed: analysis.primaryFunctionalGroup });
  if (name !== row.expected[profile]) {
    const review = NAME_REVIEWS[row.id]?.[profile];
    result.nameReview = review ?? null;
    if (review?.observed === name && review.verdict !== "ACCEPTED_GENERAL_NAME") add(review.verdict, review.code, review.reason, review.severity);
    else if (review?.observed !== name) add("REFERENCE-PENDING", "NAME_REVIEW", "Different written name requires independent adjudication; not automatically a chemical error", "P2");
  }
  result.nameWitness = profile === "1979-en" ? checkWitness(name, row.smiles, snapshots) : null;
  if (result.nameWitness?.status === "FAIL-STRUCTURE") add("FAIL-STRUCTURE", "NAME_CONNECTIVITY", result.nameWitness, "P0");
  try { assertReasoningIntegrity(model, variant.graph); }
  catch (error) { add("FAIL-REASONING", "INTERACTIVE_INTEGRITY", error.message); }
  const fragments = evidence(model), parent = fragments.find(item => item.kind === "parent");
  if (["acyclic", "cycloalkane", "aromatic"].includes(analysis.family) && !parent) add("FAIL-REASONING", "MISSING_PARENT_FRAGMENT", "Available name has no interactive parent evidence", "P2");
  for (const fragment of fragments) {
    if (fragment.kind === "parent") for (const other of fragments.filter(item => ["function", "unsaturation"].includes(item.kind))) {
      const a = fragment.start ?? name.indexOf(fragment.text), b = other.start ?? name.indexOf(other.text);
      if (Math.max(a, b) < Math.min(a + fragment.text.length, b + other.text.length)) add("FAIL-REASONING", "PARENT_MORPHEME_OVERLAP", { parent: fragment.text, other: other.text });
    }
    for (const origin of fragment.contributions ?? []) {
      const target = origin.atomIds.map(variant.original);
      if (origin.role !== "ester-alkyl") {
        const matches = reference.groups.some(group => group.kind === origin.group
          && group.atomIds.filter(id => reference.element(id) !== "C").every(id => target.includes(id))
          && target.includes(group.carbonId));
        if (!matches) add("FAIL-REASONING", "WRONG_FUNCTIONAL_ATOM_TARGET", { text: fragment.text, origin, originalAtomIds: target });
      } else {
        const alkylAnchors = reference.groups.filter(group => group.kind === "ester").flatMap(group =>
          group.atomIds.filter(id => reference.element(id) === "O").flatMap(id => reference.neighbors(id)
            .filter(edge => edge.order === 1 && reference.element(edge.id) === "C" && edge.id !== group.carbonId).map(edge => edge.id)));
        if (!target.length || target.some(id => !alkylAnchors.includes(id))) add("FAIL-REASONING", "WRONG_ESTER_ALKYL_TARGET", { text: fragment.text, target, alkylAnchors });
      }
      if (origin.role === "suffix" && candidates && ["alcohol", "ketone", "aldehyde", "nitrile"].includes(origin.group)) {
        const group = reference.groups.find(group => group.kind === origin.group && target.includes(group.carbonId));
        if (group && !path.includes(group.carbonId)) add("FAIL-REASONING", "SUFFIX_HIGHLIGHTS_SIDE_GROUP", { text: fragment.text, group });
      }
    }
  }
  const parentStep = model.steps.find(step => step.nameRole === "parent");
  if (analysis.family === "aromatic" && parentStep && /parent chain|cadena principal|numerical root is “hex-|raíz numérica es «hex-/.test(parentStep.explanation)) {
    add("FAIL-REASONING", "AROMATIC_RING_AS_ALIPHATIC_CHAIN", parentStep.explanation);
  }
  if (!parentStep && analysis.family === "acyclic") add("FAIL-REASONING", "MISSING_PARENT_EXPLANATION", "Available acyclic name has no principal-chain explanation");
  if (parentStep && /(?:esqueleto carbonado es|carbon scaffold is) [«“"](?:met|et|prop|but|pent|hex|hept|oct|non|dec)[»”"]/.test(parentStep.explanation)) {
    add("FAIL-REASONING", "ROOT_AS_SKELETON", parentStep.explanation);
  }
  result.analysis = { family: analysis.family, formula: analysis.formula, parentAtomIds: path,
    numbering: [...analysis.numberedAtoms].map(([id, locant]) => [variant.original(id), locant]), principalGroup: analysis.primaryFunctionalGroup,
    groups: observedGroups, doubleLocants: analysis.doubleBondLocants, tripleLocants: analysis.tripleBondLocants,
    substituents: analysis.substituents.map(item => ({ name: item.name, locant: item.locant, atomIds: item.atomIds?.map(variant.original) })) };
  result.reasoning = { steps: model.steps, fragments: model.fragments, links: model.links };
  const priority = ["FAIL-STRUCTURE", "FAIL-NAME", "FAIL-REASONING", "REFERENCE-PENDING"];
  result.classification = priority.find(kind => issues.some(issue => issue.classification === kind)) ?? "PASS";
  if (result.classification === "REFERENCE-PENDING") {
    result.classification = null;
    result.referenceStatus = "INSUFFICIENT_HISTORICAL_REFERENCE";
  }
  return result;
}

export async function runValidation(engine) {
  const snapshots = loadOpsin(), referenceValidation = verifyReferences(snapshots), records = [];
  for (const row of VALIDATION_CASES) {
    const reference = referenceGraph(row.smiles), imported = moleculeFromSmiles(row.smiles);
    const record = { ...row, formula: reference.formula, inputIdentity: identity(row.smiles), variants: [] };
    if (!imported.ok) {
      record.importError = imported.error;
      // Keep importer rejection visible, and separately exercise the engine on
      // an ordinary editable graph independently constructed from the reference.
      imported.molecule = { atoms: reference.atoms.map((atom, i) => ({ id: atom.id, element: atom.element,
        x: 200 + 80 * Math.cos(i * 2 * Math.PI / reference.atoms.length), y: 200 + 80 * Math.sin(i * 2 * Math.PI / reference.atoms.length) })),
        bonds: reference.bonds.map(bond => [...bond]) };
      record.engineInputRoute = "reference graph / editor-equivalent; SMILES import explicitly rejected";
    } else record.engineInputRoute = "production SMILES importer";
    // Independent token order and heavy-atom connectivity must agree with the
    // editable graph before atom-level reference paths may be used as evidence.
    assert.deepEqual(imported.molecule.atoms.map(atom => [atom.id, atom.element ?? "C"]), reference.atoms.map(atom => [atom.id, atom.element]), `${row.id}: atom identity mapping`);
    const key = bonds => bonds.map(([a,b]) => [Math.min(a,b), Math.max(a,b)].join(":")).sort();
    assert.deepEqual(key(imported.molecule.bonds), key(reference.bonds), `${row.id}: independently read connectivity`);
    for (const variant of variants(imported.molecule)) {
      const exported = moleculeToSmiles(variant.graph);
      assert.ok(exported.ok); assert.equal(identity(exported.smiles), record.inputIdentity, `${row.id}: variant identity`);
      const graphBefore = structuredClone(variant.graph), analyses = analyzeBoth(variant.graph, engine);
      const selected = displayedProfiles(variant.graph, analyses, engine), profiles = {};
      for (const profile of PROFILES) profiles[profile] = auditProfile(engine, row, reference, variant, analyses, { ...selected[profile], all: selected }, snapshots);
      assert.deepEqual(variant.graph, graphBefore, `${row.id}: graph immutable`);
      record.variants.push({ label: variant.label, exportedSmiles: exported.smiles, profiles });
    }
    records.push(record);
  }
  return { schemaVersion: 1, createdAt: new Date().toISOString(), head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), referenceValidation, sources: SOURCES, profiles: PROFILES, records };
}

/** Strictness changes the assessed scope, never the chemical classification.
 * Unavailable coverage and insufficient historical evidence stay visible. */
export function strictValidationResult(matrix, backedOnly = false) {
  const observations = matrix.records.flatMap(row => row.variants.flatMap(variant => Object.values(variant.profiles)));
  const failures = observations.filter(profile => profile.classification?.startsWith("FAIL-"));
  const pending = observations.filter(profile => profile.referenceStatus);
  return { success: failures.length === 0 && (backedOnly || pending.length === 0),
    scope: backedOnly ? "supported-and-reference-backed" : "all-references", failures: failures.length,
    pendingReferences: pending.length, unsupported: observations.filter(profile => profile.classification === "UNSUPPORTED").length,
    passed: observations.filter(profile => profile.classification === "PASS").length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const chemistry = await loadExerciseChemistry();
  try {
    const result = await runValidation(chemistry.engine);
    const outputIndex = process.argv.indexOf("--output");
    const output = outputIndex < 0 ? new URL("../reports/orgorush-validation-008.matrix.json", import.meta.url)
      : resolve(process.argv[outputIndex + 1]);
    writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    const counts = Object.fromEntries(PROFILES.map(profile => [profile, result.records.reduce((sum, row) => {
      const verdict = row.variants[0]?.profiles[profile];
      const status = verdict?.classification ?? (verdict?.referenceStatus ? "PENDING-REFERENCE" : "UNSUPPORTED");
      sum[status] = (sum[status] ?? 0) + 1; return sum;
    }, {})]));
    console.log(JSON.stringify({ cases: result.records.length, counts }, null, 2));
    if (process.argv.includes("--strict") || process.argv.includes("--strict-backed")) {
      const strict = strictValidationResult(result, process.argv.includes("--strict-backed"));
      console.log(JSON.stringify({ strict }, null, 2));
      if (!strict.success) process.exitCode = 1;
    }
  } finally { await chemistry.close(); }
}
