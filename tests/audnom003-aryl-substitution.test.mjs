import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { affected, observe } from "./helpers/audnom003-repair.mjs";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { methylPhenylCases, assertValidatedArylProfiles } from "./helpers/audnom008-aryl.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

for (const chain of ["CO", "CCO", "CCCO"]) {
  for (const [position, ring] of [["ortho", "c(C)cccc1"], ["meta", "cc(C)ccc1"], ["para", "ccc(C)cc1"]]) {
    const smiles = `c1(${chain})${ring}`;
    test(`AUDNOM-003: ${position}-methyl aryl/${chain} never publishes an unsubstituted phenyl name`, () => {
      const { molecule, analyses, profiles } = observe(chemistry.engine, smiles);
      // AUD-NOM-008 replaces the historical rejection only for the independently
      // validated two-carbon alcohol; other chains and Legacy stay protected.
      if (chain === "CCO") {
        assertValidatedArylProfiles(profiles, methylPhenylCases.find((item) => item.smiles === smiles));
        assert.equal(chemistry.engine.localNamerCannotSafelyName(molecule, analyses.current), false);
      } else {
        assert.ok(Object.values(profiles).every((item) => item.name === null));
        for (const language of ["es", "en"]) {
          assert.match(chemistry.engine.externalCandidateLocalDisplayName(molecule, analyses.current, language), /no disponible|unavailable/);
        }
        assert.equal(chemistry.engine.localNamerCannotSafelyName(molecule, analyses.current), true);
      }
      // The legacy DTO also refuses the incomplete bare-phenyl projection.
      if (analyses.legacy.family === "acyclic") {
        assert.equal(generateLegacyEnglishName(chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy)).name, "-");
      }
    });
  }
}

test("AUDNOM-003: unsubstituted phenyl and methyl on the functional chain remain admitted", () => {
  for (const smiles of ["c1ccccc1CO", "c1ccccc1CCO", "c1ccccc1CCCO", "c1ccccc1C(C)CO"]) {
    const { molecule, analyses, profiles } = observe(chemistry.engine, smiles);
    assert.equal(chemistry.engine.externalCandidateNeedsNeutralLocalName(molecule, analyses.current), false, smiles);
    assert.ok(profiles["2013-en"].name?.includes("phenyl"), smiles);
    assert.ok(profiles["1979-en"].name?.includes("phenyl"), smiles);
  }
});

test("AUDNOM-003/AUD-NOM-008: complete modern aryl names replace the historical rejection while Legacy stays gated", () => {
  const records = affected("AUDNOM-003");
  assert.equal(records.length, 2);
  for (const record of records) {
    assertValidatedArylProfiles(observe(chemistry.engine, record.smiles).profiles,
      methylPhenylCases.find((item) => item.id === record.id));
  }
});
