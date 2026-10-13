import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { legacyProfileDisplayName } from "../app/legacy-profile-display.ts";
import observedResults from "./fixtures/iupac-engine-audit-observed.json" with { type: "json" };
import nom001Expectations from "./fixtures/iupac-engine-audit-nom001-conforming.json" with { type: "json" };
import nom002Expectations from "./fixtures/iupac-engine-nom002-cyclic-ketones.json" with { type: "json" };
import nom003Expectations from "./fixtures/iupac-engine-audit-nom003-conforming.json" with { type: "json" };

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const cases = [
  ["01", "CC(C)CC"], ["02", "CC(Cl)CC(C)C"], ["03", "CC(C)CC=O"],
  ["04", "CC(=O)CC=O"], ["05", "O=CC1CCCCC1"], ["06", "O=C(O)C1CCCCC1"],
  ["07", "CC=CC"], ["08", "CCC#CC"], ["09", "CC(O)CC"], ["10", "CC(=O)CC"],
  ["11", "OCCC=C"], ["12", "CC(O)C=C"], ["13", "CC(=O)C=C"],
  ["14", "CC(O)CC(O)C"], ["15", "C=CCC#C"], ["16", "CC=CC(C)C"],
  ["17", "OC1=CCCCC1"], ["18", "O=C1C=CCCC1"],
  ["19", "C=CC(CCC)CCC"], ["20", "C#CC(CCC)CCC"], ["21", "CC(=O)C(O)C"],
].map(([id, smiles]) => ({ id, smiles }));

let server;
let analyzeMolecule;
let buildLegacyEnglishNameModel;
let legacyEnglishProfileIsSupportedForMolecule;
let legacySpanishFormatterInput;

before(async () => {
  server = await createServer({ root: projectRoot, configFile: false, logLevel: "error", appType: "custom",
    plugins: [react()], server: { middlewareMode: true, hmr: false } });
  ({ analyzeMolecule, buildLegacyEnglishNameModel, legacyEnglishProfileIsSupportedForMolecule,
    legacySpanishFormatterInput } = await server.ssrLoadModule("/app/page.tsx"));
});

after(async () => server?.close());

function evaluate(smiles) {
  const converted = moleculeFromSmiles(smiles);
  assert.equal(converted.ok, true, converted.ok ? undefined : converted.error);
  const molecule = converted.molecule;
  const graphBeforeNaming = {
    atoms: molecule.atoms.map(({ id: atomId, element }) => [atomId, element]),
    bonds: molecule.bonds.map((bond) => [...bond]),
  };
  const analysis = analyzeMolecule(molecule);
  const legacyAnalysis = analyzeMolecule(molecule, [], "iupac-1979-legacy");
  const legacyEnglishSupported = legacyEnglishProfileIsSupportedForMolecule(molecule);
  const legacyEnglish = legacyEnglishSupported
    ? generateLegacyEnglishName(buildLegacyEnglishNameModel(molecule, legacyAnalysis)).name
    : "-";
  const legacySpanishInput = legacySpanishFormatterInput(legacyAnalysis, legacyAnalysis.name);
  const names = {
    "2013-en": translateSpanishIupacToOpsin(analysis.name),
    "2013-es": applyNomenclatureConvention(analysis.name, "current", "es"),
    "1979-en": legacyEnglish,
    "1979-es": applyNomenclatureConvention(legacySpanishInput, "iupac-1979-es", "es"),
  };
  assert.deepEqual({ atoms: molecule.atoms.map(({ id: atomId, element }) => [atomId, element]),
    bonds: molecule.bonds.map((bond) => [...bond]) }, graphBeforeNaming,
  `${smiles} must retain the same graph across all language/profile formatting`);
  return { molecule, analysis, legacyAnalysis, legacyEnglishSupported, names };
}

test("OrgoRush audit: 84 outputs, NOM-001/NOM-002 conformance, historical evidence and unaffected profiles", () => {
  const rows = cases.map(({ id, smiles }) => {
    const first = evaluate(smiles);
    const second = evaluate(smiles);
    assert.deepEqual(first.names, second.names, `${id} must be deterministic`);
    assert.deepEqual(first.molecule.atoms.map(({ id: atomId, element }) => [atomId, element]),
      second.molecule.atoms.map(({ id: atomId, element }) => [atomId, element]), `${id} atom identity`);
    assert.deepEqual(first.molecule.bonds, second.molecule.bonds, `${id} bond identity`);
    return { id, smiles, formula: first.analysis.formula, family: first.analysis.family,
      parentAtoms: first.analysis.mainChain.length, legacyEnglishSupported: first.legacyEnglishSupported,
      ...first.names };
  });

  assert.equal(rows.length * 4, 84);
  const nom001Ids = new Set(nom001Expectations.map(({ id }) => id));
  const changedIds = new Set([...nom001Ids, "18"]);
  const omitLegacySpanish = (row) => Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "1979-es"),
  );
  const omitNom0032013 = (row) => {
    if (row.id !== "19" && row.id !== "20") return row;
    return Object.fromEntries(Object.entries(row).filter(([key]) => (
      key !== "2013-en" && key !== "2013-es" && key !== "parentAtoms"
    )));
  };
  assert.deepEqual(rows.map(omitLegacySpanish).map(omitNom0032013),
    observedResults.map(omitLegacySpanish).map(omitNom0032013),
    "historical outputs remain unchanged except the separately asserted NOM-001/2 and NOM-003 cells");
  assert.deepEqual(rows.filter(({ id }) => !changedIds.has(id) && id !== "19" && id !== "20")
    .map(omitLegacySpanish),
  observedResults.filter(({ id }) => !changedIds.has(id) && id !== "19" && id !== "20")
    .map(omitLegacySpanish),
  "the unaffected audit structures retain historical outputs");
  const historicalAffected = observedResults.filter(({ id }) => nom001Ids.has(id));
  assert.deepEqual(historicalAffected.map(({ id }) => id), nom001Expectations.map(({ id }) => id));
  assert.ok(historicalAffected.every(({ "1979-es": legacySpanishName }) => legacySpanishName === "-"),
    "the preserved fixture records the eight pre-fix unavailable results");
  assert.equal(rows.filter(({ id, "1979-es": legacySpanishName }) => changedIds.has(id) && legacySpanishName === "-").length, 0,
    "all NOM-001 structures produce a Spanish Legacy name");
  for (const expected of nom001Expectations) {
    const row = rows.find(({ id }) => id === expected.id);
    assert.equal(row.smiles, expected.smiles, `${expected.id} fixture identity`);
    assert.equal(row["1979-es"], expected["1979-es"], `${expected.id} Spanish Legacy conformance`);
    assert.deepEqual(legacyProfileDisplayName({ language: "es", suggestedName: row["2013-es"],
      spanish1979Name: row["1979-es"], english1979Name: row["1979-en"] }),
    { name: expected["1979-es"], available: true }, `${expected.id} is available in the displayed profile`);
  }
  const historicalNom002 = observedResults.find(({ id }) => id === "18");
  assert.equal(historicalNom002["1979-es"], "ciclo-2-hexen-1-ona",
    "the preserved historical fixture still records the pre-NOM-002 form");
  assert.equal(rows.find((row) => row.id === "18")["1979-es"],
    nom002Expectations.find(({ id }) => id === "cyclohex-2-en-1-one")["1979-es"],
    "case 18 follows the separate NOM-002 normative expectation");
  for (const expected of nom003Expectations) {
    const row = rows.find(({ id }) => id === expected.id);
    assert.equal(row.smiles, expected.smiles, `${expected.id} NOM-003 fixture identity`);
    assert.equal(row["2013-en"], expected.blueBook2013.en, `${expected.id} Blue Book 2013 English`);
    assert.equal(row["2013-es"], expected.blueBook2013.es, `${expected.id} Blue Book 2013 Spanish`);
    assert.equal(row["1979-en"], expected.legacy1979.en, `${expected.id} Legacy English`);
    assert.equal(row["1979-es"], expected.legacy1979.es, `${expected.id} Legacy Spanish`);
    assert.equal(row.parentAtoms, expected.blueBook2013.parentCarbonCount, `${expected.id} Blue Book parent length`);
    assert.ok(expected.normativeBasis.includes("Blue Book 2013 P-44.3.2"));
    assert.ok(expected.normativeBasis.includes("IUPAC 1979 Rule A-3.4"));
  }
  const enol = evaluate("OC1=CCCCC1");
  const hydroxylCarbon = enol.analysis.functionalGroups.find((group) => group.kind === "alcohol")?.carbonId;
  assert.deepEqual(enol.analysis.doubleBondLocants, [1], "case 17 has C1=C2");
  assert.equal(enol.analysis.numberedAtoms.get(hydroxylCarbon), 1, "case 17 has OH on C1");
  console.log("IUPAC_ENGINE_AUDIT_RESULTS=" + JSON.stringify(rows));
});
