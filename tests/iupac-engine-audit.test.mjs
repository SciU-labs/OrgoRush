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
  const legacyEnglishSupported = legacyEnglishProfileIsSupportedForMolecule(molecule);
  const legacyEnglish = legacyEnglishSupported
    ? generateLegacyEnglishName(buildLegacyEnglishNameModel(molecule, analysis)).name
    : "-";
  const legacySpanishInput = legacySpanishFormatterInput(analysis, analysis.name);
  const names = {
    "2013-en": translateSpanishIupacToOpsin(analysis.name),
    "2013-es": applyNomenclatureConvention(analysis.name, "current", "es"),
    "1979-en": legacyEnglish,
    "1979-es": applyNomenclatureConvention(legacySpanishInput, "iupac-1979-es", "es"),
  };
  assert.deepEqual({ atoms: molecule.atoms.map(({ id: atomId, element }) => [atomId, element]),
    bonds: molecule.bonds.map((bond) => [...bond]) }, graphBeforeNaming,
  `${smiles} must retain the same graph across all language/profile formatting`);
  return { molecule, analysis, legacyEnglishSupported, names };
}

test("OrgoRush audit: 84 outputs, NOM-001 Spanish conformance, historical evidence and unaffected profiles", () => {
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
  const changedIds = new Set(nom001Expectations.map(({ id }) => id));
  const omitLegacySpanish = (row) => {
    const { "1979-es": legacySpanishName, ...unchanged } = row;
    return unchanged;
  };
  assert.deepEqual(rows.map(omitLegacySpanish), observedResults.map(omitLegacySpanish),
    "historical 2013 and English Legacy outputs remain unchanged for all 21 structures");
  assert.deepEqual(rows.filter(({ id }) => !changedIds.has(id)),
    observedResults.filter(({ id }) => !changedIds.has(id)),
    "the remaining 13 audit structures retain all four historical outputs");
  const historicalAffected = observedResults.filter(({ id }) => changedIds.has(id));
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
  assert.equal(rows.find((row) => row.id === "18")["1979-es"], "ciclo-2-hexen-1-ona");
  assert.equal(rows.find((row) => row.id === "19")["2013-en"], "3-propylhex-1-ene");
  assert.equal(rows.find((row) => row.id === "20")["2013-en"], "3-propylhex-1-yne");
  const enol = evaluate("OC1=CCCCC1");
  const hydroxylCarbon = enol.analysis.functionalGroups.find((group) => group.kind === "alcohol")?.carbonId;
  assert.deepEqual(enol.analysis.doubleBondLocants, [1], "case 17 has C1=C2");
  assert.equal(enol.analysis.numberedAtoms.get(hydroxylCarbon), 1, "case 17 has OH on C1");
  console.log("IUPAC_ENGINE_AUDIT_RESULTS=" + JSON.stringify(rows));
});
