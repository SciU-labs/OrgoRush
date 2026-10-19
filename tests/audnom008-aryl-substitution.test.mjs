import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { structuralIdentity } from "./helpers/reference-corpus.mjs";
import { analyzeBoth, displayedProfiles } from "../scripts/naming-audit/evaluate.mjs";
import { project, evidence, assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { legacyProfileDisplayName } from "../app/legacy-profile-display.ts";
import { interpretName } from "../scripts/naming-audit/evidence.mjs";
import { methylPhenylCases, arylReceiptDocument, arylReceipts, assertValidatedArylProfiles } from "./helpers/audnom008-aryl.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

const plain = { id: "unsubstituted-control", smiles: "c1(CCO)ccccc1", kekule: "C1(CCO)=CC=CC=C1",
  es: "2-feniletan-1-ol", en: "2-phenylethan-1-ol" };
const imported = (smiles) => {
  const parsed = moleculeFromSmiles(smiles);
  assert.equal(parsed.ok, true, parsed.error);
  return parsed.molecule;
};
function permute(molecule, remap) {
  const ids = new Map(molecule.atoms.map((atom, index) => [atom.id, remap ? 1000 + (molecule.atoms.length - index) * 17 : atom.id]));
  return { ...molecule,
    atoms: molecule.atoms.map((atom, index) => ({ ...atom, id: ids.get(atom.id), x: -index * 37, y: index % 3 * 99 })).reverse(),
    bonds: molecule.bonds.map(([a, b, ...tail]) => [ids.get(b), ids.get(a), ...tail]).reverse(),
    rings: molecule.rings?.map((ring) => ({ ...ring, atomIds: ring.atomIds.map((id) => ids.get(id)).sort((a, b) => b - a) })),
  };
}
const sameAtoms = (actual, expected) => assert.deepEqual(new Set(actual), new Set(expected));

test("AUD-NOM-008 receipts keep raw bodies, exact English queries and distinct complete positional identities", () => {
  assert.equal(arylReceiptDocument.responses.length, 3);
  const identities = new Set();
  for (const fixture of methylPhenylCases) {
    const receipt = arylReceipts.get(fixture.en);
    assert.equal(receipt.httpStatus, 200);
    assert.ok(Number.isFinite(Date.parse(receipt.retrievedAt)));
    assert.equal(JSON.parse(receipt.body).status, "SUCCESS");
    assert.equal(interpretName(fixture.en, fixture.smiles, arylReceipts).status, "MATCH");
    identities.add(structuralIdentity(fixture.smiles));
  }
  assert.equal(identities.size, 3, "formula identity does not merge ortho, meta and para graphs");
  const inventory = JSON.parse(readFileSync(new URL("../reports/naming-audit/aud-nom-008/profile-inventory.json", import.meta.url)));
  assert.equal(inventory.records.length, 2);
  for (const record of inventory.records) {
    const fixture = methylPhenylCases.find((item) => item.id === record.id);
    assert.equal(record.identity, structuralIdentity(fixture.smiles));
    assert.equal(record.profiles["2013-es"].name, fixture.es);
    assert.equal(record.profiles["2013-en"].name, fixture.en);
    assert.equal(record.profiles["2013-en"].receiptSha256, arylReceipts.get(fixture.en).sha256);
    for (const key of ["2013-es", "2013-en"]) assert.equal(record.profiles[key].state, "VALIDATED_NAME");
    for (const key of ["1979-es", "1979-en"]) {
      assert.equal(record.profiles[key].name, null);
      assert.equal(record.profiles[key].state, "SAFE_REJECTION");
      assert.equal(record.profiles[key].normativeStatus, "PENDING_NORMATIVE_ADJUDICATION");
    }
  }
});

for (const fixture of [plain, ...methylPhenylCases]) {
  test(`AUD-NOM-008 ${fixture.id}: complete aryl graph, independent locants and exact profile evidence survive permutations`, () => {
    const original = imported(fixture.smiles);
    assert.equal(structuralIdentity(fixture.smiles), structuralIdentity(fixture.kekule), "equivalent Kekule input");
    for (const molecule of [original, permute(original, false), permute(original, true), imported(fixture.kekule)]) {
      const snapshot = structuredClone(molecule);
      const analyses = analyzeBoth(molecule, chemistry.engine);
      const profiles = displayedProfiles(molecule, analyses, chemistry.engine);
      const observed = { molecule, analyses, profiles };
      const analysis = analyses.current;
      assert.equal(analysis.formula, fixture.ringLocant ? "C₉H₁₂O" : "C₈H₁₀O");
      assert.equal(analyses.legacy.formula, analysis.formula);
      assert.equal(analysis.mainChain.length, 2);
      assert.equal(analysis.primaryFunctionalGroup, "alcohol");
      const alcohol = analysis.functionalGroups.find((group) => group.kind === "alcohol");
      assert.equal(analysis.numberedAtoms.get(alcohol.carbonId), 1);
      assert.ok(molecule.bonds.some(([a, b, order]) => order === 1
        && (a === alcohol.carbonId && b === alcohol.heteroAtomId || b === alcohol.carbonId && a === alcohol.heteroAtomId)));
      assert.equal(chemistry.engine.externalCandidateNeedsNeutralLocalName(molecule, analysis), false);
      if (fixture.ringLocant) {
        assertValidatedArylProfiles(profiles, fixture);
        const substituent = analysis.substituents.find((item) => item.aryl);
        const aryl = substituent.aryl;
        assert.equal(substituent.locant, 2, "chain aryl attachment locant");
        assert.equal(aryl.ringAtomIds[0], aryl.attachmentAtomId, "aryl C1 is the free-valence atom");
        assert.equal(aryl.methyl.locant, fixture.ringLocant);
        assert.equal(aryl.ringAtomIds[fixture.ringLocant - 1], aryl.methyl.ringAtomId);
        assert.equal(analysis.numberedAtoms.has(aryl.attachmentAtomId), false, "ring numbers are not chain numbers");
        assert.equal(analysis.mainChain[1], aryl.parentAttachmentAtomId);
        assert.equal(aryl.atomIds.length, 7);
        sameAtoms(substituent.atomIds, [...aryl.ringAtomIds, aryl.methyl.atomId]);
        for (const [a, b] of aryl.bondIds) {
          assert.ok(molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a));
        }
        assert.equal(molecule.bonds.filter(([a, b]) => a === aryl.methyl.atomId || b === aryl.methyl.atomId).length, 1);
        assert.equal(generateLegacyEnglishName(chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy)).name, "-");
      } else {
        assert.deepEqual(Object.fromEntries(Object.entries(profiles).map(([key, profile]) => [key, profile.name])), {
          "2013-es": fixture.es, "2013-en": fixture.en,
          "1979-es": "2-feniletanol", "1979-en": "2-phenylethanol",
        });
      }

      // Same sequence as the UI: change language, visit Legacy, then return to 2013.
      for (const key of ["2013-es", "2013-en", "1979-es", "1979-en", "2013-es"]) {
        const profile = profiles[key];
        if (!profile.name) {
          const shown = legacyProfileDisplayName({ language: profile.language,
            suggestedName: profile.language === "es" ? fixture.es : fixture.en,
            spanish1979Name: profiles["1979-es"].name ?? "-", english1979Name: profiles["1979-en"].name ?? "-" });
          assert.equal(shown.available, false, "pending Legacy is not copyable");
          const projection = chemistry.engine.buildActiveIupacReasoning({ molecule, analyses,
            ...profile, displayedName: shown.name, generatedNames: [fixture.es, fixture.en], canHighlight: false });
          assert.ok(projection.links.every((part) => !part.stepNumber), "unavailable name has no borrowed interactions");
          continue;
        }
        const model = project(chemistry.engine, observed, key);
        assertReasoningIntegrity(model, molecule);
        assert.ok(model.links.some((part) => part.stepNumber), "safe visible name remains interactive and copyable");
        if (!fixture.ringLocant || !key.startsWith("2013")) continue;
        const aryl = analysis.substituents.find((item) => item.aryl).aryl;
        const inner = `${fixture.ringLocant}-${profile.language === "es" ? "metilfenil" : "methylphenyl"}`;
        const link = model.links.find((part) => part.text === `2-(${inner})`);
        assert.ok(link?.stepNumber);
        sameAtoms(link.atomIds, aryl.atomIds);
        const step = model.steps.find((item) => item.number === link.stepNumber);
        assert.equal(step.nameRole, "substituent");
        assert.ok(step.explanation.includes(inner));
        assert.match(step.explanation, profile.language === "es" ? /C1 del anillo/ : /ring C1/);
        assert.match(step.explanation, profile.language === "es" ? /independientes/ : /independent/);
        assert.ok(!evidence(model).some((part) => part.kind === "numbering" && part.start === 3),
          "the inner ring locant must not become a chain-numbering target");
        assert.match(model.steps.find((item) => item.nameRole === "function").explanation, /–OH/);
        assert.match(model.steps.find((item) => item.nameRole === "parent").explanation,
          profile.language === "es" ? /función principal alcohol/ : /principal alcohol function/);
      }
      const exported = moleculeToSmiles(molecule);
      assert.equal(exported.ok, true, exported.error);
      assert.equal(structuralIdentity(exported.smiles), structuralIdentity(fixture.smiles));
      assert.deepEqual(molecule, snapshot, "all profile and language changes preserve the graph");
    }
  });
}

test("AUD-NOM-008 keeps the safety gate for incomplete proofs and out-of-scope aryl substitutions", () => {
  const molecule = imported(methylPhenylCases[0].smiles);
  const original = chemistry.engine.analyzeMolecule(molecule);
  for (const corrupt of [
    (analysis) => { analysis.name = "2-feniletan-1-ol"; },
    (analysis) => { analysis.substituents[0].atomIds.pop(); },
    (analysis) => { analysis.substituents[0].atomIds.shift(); delete analysis.substituents[0].aryl; },
    (analysis) => { delete analysis.substituents[0].aryl; },
    (analysis) => { analysis.substituents[0].aryl.methyl.locant = 4; },
  ]) {
    const analysis = structuredClone(original);
    corrupt(analysis);
    assert.equal(chemistry.engine.localNamerCannotSafelyName(molecule, analysis), true);
    assert.equal(chemistry.engine.externalCandidateNeedsNeutralLocalName(molecule, analysis), true);
  }
  for (const smiles of ["c1(CO)c(C)cccc1", "c1(CCCO)c(C)cccc1", "c1(CCN)c(C)cccc1",
    "c1(CCO)c(CC)cccc1", "c1(CCO)c(C)cc(C)cc1", "c1(CCO)c(O)cccc1", "CC(O)c1c(C)cccc1"]) {
    const graph = imported(smiles), snapshot = structuredClone(graph);
    const analyses = analyzeBoth(graph, chemistry.engine);
    assert.ok(Object.values(displayedProfiles(graph, analyses, chemistry.engine)).every((profile) => profile.name === null), smiles);
    const exported = moleculeToSmiles(graph);
    assert.equal(exported.ok, true, exported.error);
    assert.equal(structuralIdentity(exported.smiles), structuralIdentity(smiles));
    assert.deepEqual(graph, snapshot);
  }
});

test("AUD-NOM-008 neighboring benzene, phenol, alkylbenzene and acyclic alcohol names remain supported", () => {
  for (const [smiles, es, en] of [
    ["c1ccccc1", "benceno", "benzene"], ["Cc1ccccc1", "metilbenceno", "methylbenzene"],
    ["CCc1ccccc1", "etilbenceno", "ethylbenzene"], ["Oc1ccccc1", "fenol", "phenol"],
    ["Oc1c(C)cccc1", "2-metilfenol", "2-methylphenol"], ["Oc1cc(C)ccc1", "3-metilfenol", "3-methylphenol"],
    ["Oc1ccc(C)cc1", "4-metilfenol", "4-methylphenol"], ["CO", "metanol", "methanol"],
    ["CCO", "etanol", "ethanol"], ["CCCO", "propan-1-ol", "propan-1-ol"], ["CC(O)C", "propan-2-ol", "propan-2-ol"],
  ]) {
    const graph = imported(smiles);
    const profiles = displayedProfiles(graph, analyzeBoth(graph, chemistry.engine), chemistry.engine);
    assert.equal(profiles["2013-es"].name, es);
    assert.equal(profiles["2013-en"].name, en);
  }
});
