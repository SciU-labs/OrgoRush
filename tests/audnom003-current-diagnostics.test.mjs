// Live regressions for the frozen AUDNOM-002..005 findings. No production-hash
// baseline assertion: those bytes describe the earlier audit, not this repair.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { affected, observe, assertIndependentName, historicalResults } from "./helpers/audnom003-repair.mjs";
import { methylPhenylCases, assertValidatedArylProfiles } from "./helpers/audnom008-aryl.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

for (const [id, expectedCount] of [["AUDNOM-002", 33], ["AUDNOM-004", 6], ["AUDNOM-005", 6]]) {
  test(`${id}: all ${expectedCount} repaired historical English outputs have independent full-identity matches`, () => {
    const records = affected(id);
    assert.equal(records.length, expectedCount);
    for (const record of records) {
      const { profiles } = observe(chemistry.engine, record.smiles);
      assert.ok(profiles["1979-en"].name, record.id);
      assertIndependentName(profiles["1979-en"].name, record.smiles);
      // Previously correct modern English names retain their independent identity.
      assertIndependentName(profiles["2013-en"].name, record.smiles);
      const historical = historicalResults.find((item) => item.id === record.id);
      for (const profile of ["2013-es", "2013-en"]) {
        assert.equal(profiles[profile].name, historical.profiles[profile].name, `${record.id}/${profile}: correct modern output is unchanged`);
      }
    }
  });
}

test("AUDNOM-003: AUD-NOM-008 validates complete modern aryl names and preserves explicit Legacy unavailability", () => {
  for (const record of affected("AUDNOM-003")) {
    const { profiles } = observe(chemistry.engine, record.smiles);
    assertValidatedArylProfiles(profiles, methylPhenylCases.find((item) => item.id === record.id));
  }
});

test("AUD-NOM-003: additional nitrogen and diacid boundary names have independent receipts", () => {
  for (const [smiles, name] of [
    ["CCC(=O)N(C)C", "N,N-dimethylpropanamide"],
    ["CCN(C)CCC", "N-ethyl-N-methyl-1-propanamine"],
    ["CC(C)CC(=O)NC", "N,3-dimethylbutanamide"],
    ["O=C(O)C(C)CC(=O)O", "2-methylbutanedioic acid"],
    ["O=C(O)C(O)CC(=O)O", "2-hydroxybutanedioic acid"],
  ]) {
    assert.equal(observe(chemistry.engine, smiles).profiles["1979-en"].name, name);
    assertIndependentName(name, smiles);
  }
});
