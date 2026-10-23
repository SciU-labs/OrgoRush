import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { strictValidationResult } from "./validation-008-audit.mjs";

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const targets = reasoning => Object.values(reasoning?.fragments ?? {}).flatMap(part => [part, ...(part.additionalFragments ?? [])])
  .map(({ kind, atomIds, bondIds, semanticId, locant, bondType, contributions }) =>
    JSON.stringify({ kind, atomIds, bondIds, semanticId, locant, bondType, contributions })).sort();

/** Compare structural evidence and verdicts, without rewriting either audit. */
export function compareValidation009(before, after) {
  assert.equal(before.records.length, 72);
  assert.equal(after.records.length, 72);
  assert.deepEqual(after.referenceValidation, before.referenceValidation);
  assert.deepEqual(after.sources, before.sources);
  assert.deepEqual(after.profiles, before.profiles);
  const corrected = [], counts = {};
  let observations = 0, namesChanged = 0;
  for (const original of before.records) {
    const current = after.records.find(row => row.id === original.id);
    assert.ok(current, original.id);
    const { variants: originalVariants, ...originalReference } = original;
    const { variants: currentVariants, ...currentReference } = current;
    assert.deepEqual(currentReference, originalReference, `${original.id}: reference and graph identity`);
    assert.equal(currentVariants.length, 2);
    for (const [index, variant] of originalVariants.entries()) {
      const changed = currentVariants[index];
      assert.equal(changed.label, variant.label);
      assert.equal(changed.exportedSmiles, variant.exportedSmiles);
      for (const profile of before.profiles) {
        observations++;
        const old = variant.profiles[profile], fresh = changed.profiles[profile];
        const label = `${original.id}/${profile}/${variant.label}`;
        assert.equal(fresh.expected, old.expected, `${label}: original expected name`);
        assert.deepEqual(fresh.analysis, old.analysis, `${label}: parent, numbering, groups, substituents, formula`);
        assert.deepEqual(fresh.formula, old.formula);
        assert.deepEqual(targets(fresh.reasoning), targets(old.reasoning), `${label}: fragment atom/bond provenance`);
        assert.equal(fresh.referenceStatus, old.referenceStatus);
        if (old.classification?.startsWith("FAIL-")) {
          assert.equal(fresh.classification, "PASS", label);
          assert.equal(fresh.observed, old.expected, label);
          assert.deepEqual(fresh.issues, []);
          if (index === 0) corrected.push({ id: original.id, profile, before: old.classification, after: fresh.classification,
            nameBefore: old.observed, nameAfter: fresh.observed });
        } else {
          assert.equal(fresh.classification, old.classification, label);
          assert.equal(fresh.observed, old.observed, `${label}: previously correct/unavailable/pending name`);
        }
        if (fresh.observed !== old.observed) namesChanged++;
        if (index === 0) {
          const verdict = fresh.classification ?? "PENDING-REFERENCE";
          counts[verdict] = (counts[verdict] ?? 0) + 1;
        }
      }
    }
  }
  assert.equal(observations, 432);
  assert.equal(corrected.length, 8);
  assert.equal(namesChanged, 8, "only four modern Spanish names, in two atom orders");
  assert.deepEqual(counts, { PASS: 195, UNSUPPORTED: 19, "PENDING-REFERENCE": 2 });
  const strict = strictValidationResult(after, true);
  assert.equal(strict.success, true);
  assert.equal(strictValidationResult(after).success, false, "two historical references remain unresolved");
  return { cases: 72, uniqueObservations: 216, observationsWithVariants: observations, namesChangedWithVariants: namesChanged,
    counts, corrected, strict, structuralEvidenceUnchanged: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(compareValidation009(read("reports/orgorush-validation-008.matrix.json"),
    read("reports/orgorush-validation-fix-009.matrix.json")), null, 2));
}
