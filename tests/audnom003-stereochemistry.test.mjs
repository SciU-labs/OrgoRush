import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { affected, observe } from "./helpers/audnom003-repair.mjs";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { getMainChainTetrahedralDescriptors } from "../app/tetrahedral-stereochemistry.ts";
import { formatStereochemicalName, getMainChainStereoDescriptors } from "../app/double-bond-stereochemistry.ts";
import { stripStereochemicalDescriptors } from "../app/nomenclature-conventions.ts";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

for (const record of affected("AUDNOM-005")) {
  test(`AUDNOM-005: ${record.id} retains every configured center with the selected parent locants`, () => {
    const { molecule, analyses, profiles } = observe(chemistry.engine, record.smiles);
    const descriptors = getMainChainTetrahedralDescriptors(molecule, analyses.legacy.mainChain);
    assert.ok(descriptors.length);
    const prefix = `(${descriptors.map((item) => `${item.locant}${item.configuration}`).join(",")})-`;
    assert.ok(profiles["1979-en"].name.startsWith(prefix), profiles["1979-en"].name);
    assert.equal((profiles["1979-en"].name.match(/\([^)]*[RS][^)]*\)-/g) ?? []).length, 1);
    const offSource = stripStereochemicalDescriptors(analyses.legacy.name);
    const off = generateLegacyEnglishName(chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy, offSource, { stereochemistry: false })).name;
    assert.doesNotMatch(off, /\([\d,RS]+\)-/);
    assert.equal(stripStereochemicalDescriptors(profiles["1979-en"].name), off);
    // ES -> EN -> Legacy -> 2013 -> EN does not mutate or reuse stale descriptors.
    for (const key of ["2013-es", "2013-en", "1979-es", "1979-en", "2013-en"]) {
      if (profiles[key].name) for (const item of descriptors) assert.ok(profiles[key].name.includes(`${item.locant}${item.configuration}`), key);
    }
    const again = observe(chemistry.engine, record.smiles);
    assert.deepEqual(again.profiles, profiles);
  });
}

test("AUDNOM-005: the butan-2-ol enantiomers have distinct S/R legacy names", () => {
  assert.equal(observe(chemistry.engine, "C[C@H](O)CC").profiles["1979-en"].name, "(2S)-2-butanol");
  assert.equal(observe(chemistry.engine, "C[C@@H](O)CC").profiles["1979-en"].name, "(2R)-2-butanol");
});

test("AUDNOM-005: the explicit stereo option controls output and rejects configured centers outside the supported parent", () => {
  const known = observe(chemistry.engine, "C[C@H](O)CC");
  const on = chemistry.engine.buildLegacyEnglishNameModel(known.molecule, known.analyses.legacy,
    known.analyses.legacy.name, { stereochemistry: true });
  assert.equal(generateLegacyEnglishName(on).name, "(2S)-2-butanol");
  const off = chemistry.engine.buildLegacyEnglishNameModel(known.molecule, known.analyses.legacy,
    "(2R)-stale-text", { stereochemistry: false });
  assert.equal(generateLegacyEnglishName(off).name, "2-butanol");
  const branch = observe(chemistry.engine, "CCCCCC(O)C([C@H](C)CC)CCCCC");
  const unsupported = chemistry.engine.buildLegacyEnglishNameModel(branch.molecule, branch.analyses.legacy,
    branch.analyses.legacy.name, { stereochemistry: true });
  assert.ok(unsupported.unavailableReason);
  assert.equal(generateLegacyEnglishName(unsupported).name, "-");
});

test("AUDNOM-005: unknown and achiral centers never acquire an invented configuration", () => {
  for (const smiles of ["CC(O)CC", "CC(O)C", "CCO"]) {
    const { molecule, analyses, profiles } = observe(chemistry.engine, smiles);
    assert.doesNotMatch(profiles["1979-en"].name, /\([\d,RS]+\)-/);
    const forged = chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy, "(2R)-fake");
    assert.equal(forged.stereochemicalPrefix, undefined);
  }
});

test("AUDNOM-005: simultaneous R/S and explicit E/Z are computed once from the graph", () => {
  const { molecule, analyses } = observe(chemistry.engine, "C/C=C/[C@H](O)C");
  const base = stripStereochemicalDescriptors(analyses.legacy.name);
  const selected = formatStereochemicalName(molecule, analyses.legacy.mainChain, base, { explicitDoubleBonds: true });
  const model = chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy, selected);
  const descriptors = [...getMainChainStereoDescriptors(molecule, analyses.legacy.mainChain, true),
    ...getMainChainTetrahedralDescriptors(molecule, analyses.legacy.mainChain)].sort((a, b) => a.locant - b.locant);
  assert.equal(descriptors.length, 2);
  assert.equal(model.stereochemicalPrefix, `(${descriptors.map((item) => `${item.locant}${item.configuration}`).join(",")})-`);
  const name = generateLegacyEnglishName(model).name;
  assert.equal((name.match(/\([^)]*\)-/g) ?? []).length, 1);
  const duplicatedSource = `${model.stereochemicalPrefix}${selected}`;
  assert.equal(generateLegacyEnglishName(chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy, duplicatedSource)).name, name);
});
