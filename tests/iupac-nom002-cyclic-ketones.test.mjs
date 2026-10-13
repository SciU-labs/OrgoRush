import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import expectations from "./fixtures/iupac-engine-nom002-cyclic-ketones.json" with { type: "json" };

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let server;
let analyzeMolecule;
let buildLegacyEnglishNameModel;
let legacySpanishFormatterInput;

before(async () => {
  server = await createServer({ root: projectRoot, configFile: false, logLevel: "error", appType: "custom",
    plugins: [react()], server: { middlewareMode: true, hmr: false } });
  ({ analyzeMolecule, buildLegacyEnglishNameModel, legacySpanishFormatterInput } = await server.ssrLoadModule("/app/page.tsx"));
});

after(async () => server?.close());

test("NOM-002: cyclic ketones preserve ring names and 1979/2013 conventions", () => {
  const rows = expectations.map((expected) => {
    const parsed = moleculeFromSmiles(expected.smiles);
    assert.equal(parsed.ok, true, expected.id);
    const molecule = parsed.molecule;
    const graphBeforeFormatting = {
      atoms: molecule.atoms.map(({ id, element }) => [id, element]),
      bonds: molecule.bonds.map((bond) => [...bond]),
    };
    const analysis = analyzeMolecule(molecule);
    const spanishInput = legacySpanishFormatterInput(analysis, analysis.name);
    const names = {
      "2013-en": translateSpanishIupacToOpsin(analysis.name),
      "2013-es": applyNomenclatureConvention(analysis.name, "current", "es"),
      "1979-en": generateLegacyEnglishName(buildLegacyEnglishNameModel(molecule, analysis)).name,
      "1979-es": applyNomenclatureConvention(spanishInput, "iupac-1979-es", "es"),
    };
    assert.deepEqual({
      atoms: molecule.atoms.map(({ id, element }) => [id, element]),
      bonds: molecule.bonds.map((bond) => [...bond]),
    }, graphBeforeFormatting, `${expected.id} graph identity after four name formats`);

    assert.equal(analysis.formula, expected.formula, `${expected.id} molecular formula`);
    assert.equal(analysis.mainChain.length, expected.ringSize, `${expected.id} ring is the complete parent`);
    assert.deepEqual(names, {
      "2013-en": expected["2013-en"],
      "2013-es": expected["2013-es"],
      "1979-en": expected["1979-en"],
      "1979-es": expected["1979-es"],
    }, `${expected.id} four nomenclature outputs`);

    const ketone = analysis.functionalGroups.find(({ kind }) => kind === "ketone");
    assert.ok(ketone, `${expected.id} has a ketone group`);
    assert.equal(analysis.numberedAtoms.get(ketone.carbonId), expected.carbonylLocant,
      `${expected.id} carbonyl locant`);
    assert.deepEqual(analysis.doubleBondLocants, expected.doubleBondLocants,
      `${expected.id} double-bond locants`);
    if (expected.substituentLocants) {
      assert.match(analysis.name, /^4-metilciclo/, `${expected.id} methyl substituent is at C4`);
    }
    return { expected, names };
  });

  assert.equal(rows.length, 7);
  assert.equal(rows.filter(({ names }) => /ciclo-\d/.test(names["1979-es"])).length, 0,
    "no Legacy Spanish ring parent is split by a hyphen");
});
