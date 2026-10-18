import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { affected, observe } from "./helpers/audnom003-repair.mjs";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

for (const record of affected("AUDNOM-004")) {
  test(`AUDNOM-004: ${record.id} represents both terminal carboxyl carbons`, () => {
    const { molecule, analyses, profiles } = observe(chemistry.engine, record.smiles);
    const model = chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy);
    const groups = model.functionalGroups.filter((item) => item.kind === "carboxylicAcid");
    assert.equal(groups.length, 2);
    assert.ok(groups.every((item) => item.carbonIncludedInParent));
    assert.deepEqual(groups.map((item) => item.locant).sort((a, b) => a - b), [1, model.parent.carbonCount]);
    assert.match(profiles["1979-en"].name, /anedioic acid$/);
    assert.equal(profiles["1979-en"].name, profiles["2013-en"].name);
    const profile = profiles["1979-en"];
    const reasoning = chemistry.engine.buildActiveIupacReasoning({ molecule, analyses, ...profile,
      displayedName: profile.name, generatedNames: Object.values(profiles).map((item) => item.name).filter(Boolean), canHighlight: true });
    const suffix = Object.values(reasoning.fragments).flatMap((item) => [item, ...(item.additionalFragments ?? [])])
      .find((item) => item.kind === "function" && /dioic/.test(item.text));
    assert.ok(suffix, "the diacid suffix has visible functional evidence");
    assert.equal(suffix.contributions.filter((item) => item.group === "carboxylicAcid").length, 2);
    assert.equal(reasoning.links.map((item) => item.text).join(""), profile.name);
    assert.match(reasoning.steps.find((item) => item.nameRole === "function").explanation, /carboxyl|carboxylic/i);
  });
}

test("AUDNOM-004: monoacids, branched/hydroxy diacids, esters and ring acids retain their own suffix grammar", () => {
  for (const [smiles, name] of [
    ["CCCC(=O)O", "butanoic acid"],
    ["CCCCCCCCCC(=O)O", "decanoic acid"],
    ["O=C(O)CC(=O)O", "propanedioic acid"],
    ["O=C(O)C(C)CC(=O)O", "2-methylbutanedioic acid"],
    ["O=C(O)C(O)CC(=O)O", "2-hydroxybutanedioic acid"],
    ["CCOC(=O)CCC", "ethyl butanoate"],
    ["O=C(O)C1CCCCC1", "cyclohexanecarboxylic acid"],
    ["O=C(O)c1ccccc1", "benzoic acid"],
  ]) {
    const { profiles } = observe(chemistry.engine, smiles);
    assert.equal(profiles["1979-en"].name, name, smiles);
  }
});

test("AUDNOM-004: nonterminal or external multiple carboxyl groups cannot be relabelled indiscriminately dioic", () => {
  const { molecule, analyses } = observe(chemistry.engine, "O=C(O)C1CCC(C(=O)O)CC1");
  const model = chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy);
  assert.equal(model.functionalGroups.filter((item) => item.kind === "carboxylicAcid").length, 2);
  assert.equal(generateLegacyEnglishName(model).name, "-");
  const chain = structuredClone(model);
  chain.parent.kind = "chain";
  assert.equal(generateLegacyEnglishName(chain).name, "-");
});
