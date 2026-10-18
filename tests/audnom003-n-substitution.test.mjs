import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { affected, observe } from "./helpers/audnom003-repair.mjs";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

for (const [smiles, expected, nCount] of [
  ["CCC(N)=O", "propanamide", 0],
  ["CCNC(=O)CC", "N-ethylpropanamide", 1],
  ["CCC(=O)N(C)C", "N,N-dimethylpropanamide", 2],
  ["CCCN", "1-propanamine", 0],
  ["CNCCC", "N-methyl-1-propanamine", 1],
  ["CN(C)CCC", "N,N-dimethyl-1-propanamine", 2],
  ["CCN(C)CCC", "N-ethyl-N-methyl-1-propanamine", 2],
  ["CC(C)CC(=O)NC", "N,3-dimethylbutanamide", 1],
]) {
  test(`AUDNOM-002: ${smiles} retains N substitution and carbon-parent numbering`, () => {
    const { molecule, analyses, profiles } = observe(chemistry.engine, smiles);
    assert.equal(profiles["1979-en"].name, expected);
    const model = chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy);
    assert.equal(model.nitrogenSubstituents.length, nCount);
    assert.equal(generateLegacyEnglishName(model).name, expected);
    assert.equal(generateLegacyEnglishName(model).reasoning.nitrogenSubstituents.length, nCount);
    for (const item of model.nitrogenSubstituents) {
      assert.equal(molecule.atoms.find((atom) => atom.id === item.nitrogenAtomId).element, "N");
      assert.ok(item.atomIds.every((id) => !model.parent.atomIds.includes(id)));
      assert.ok(molecule.bonds.some(([a, b]) => a === item.nitrogenAtomId && item.atomIds.includes(b)
        || b === item.nitrogenAtomId && item.atomIds.includes(a)));
    }
    for (const profile of Object.values(profiles).filter((item) => item.name)) {
      assert.equal((profile.name.match(/N/g) ?? []).length, nCount);
      if (!nCount) continue;
      const reasoning = chemistry.engine.buildActiveIupacReasoning({ molecule, analyses, ...profile,
        displayedName: profile.name, generatedNames: Object.values(profiles).map((item) => item.name).filter(Boolean), canHighlight: true });
      assert.equal(reasoning.links.map((item) => item.text).join(""), profile.name);
      const links = reasoning.links.filter((item) => /^N(?:,N)*$/.test(item.text));
      assert.ok(links.length, profile.name);
      for (const link of links) {
        assert.ok(link.atomIds.some((id) => molecule.atoms.find((atom) => atom.id === id).element === "N"));
        assert.match(reasoning.steps.find((item) => item.number === link.stepNumber).explanation, /nitrógeno|nitrogen/);
      }
    }
  });
}

test("AUDNOM-002: unsupported N-isopropyl and branched N-alkyl grammar is explicitly unavailable", () => {
  for (const smiles of ["CC(=O)NC(C)C", "CC(=O)NCC(C)C"]) {
    const { molecule, analyses, profiles } = observe(chemistry.engine, smiles);
    assert.equal(chemistry.engine.localNamerCannotSafelyName(molecule, analyses.current), true);
    assert.ok(Object.values(profiles).every((item) => item.name === null));
    assert.equal(generateLegacyEnglishName(chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy)).name, "-");
  }
});

test("AUDNOM-002: all 33 historical cases retain every N branch or explicitly reject local naming", () => {
  const records = affected("AUDNOM-002");
  assert.equal(records.length, 33);
  for (const record of records) {
    const { molecule, analyses, profiles } = observe(chemistry.engine, record.smiles);
    if (profiles["1979-en"].name === null) {
      assert.equal(chemistry.engine.externalCandidateNeedsNeutralLocalName(molecule, analyses.current), true, record.id);
      continue;
    }
    const model = chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy);
    assert.ok(model.nitrogenSubstituents.length > 0, record.id);
    assert.equal((profiles["1979-en"].name.match(/N/g) ?? []).length, model.nitrogenSubstituents.length, record.id);
  }
});
