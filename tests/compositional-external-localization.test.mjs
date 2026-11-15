import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { localizeCompositionalExternalName, parseCompositionalExternalName } from "../app/compositional-external-localization.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { localizeChemicalNameForDisplay } from "../app/iupac-name-normalization.ts";
import { translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";
import { resolveNameWithOpsin } from "../app/opsin-name-resolver.ts";
import { VALIDATION_CASES } from "./fixtures/orgorush-validation-014.mjs";

const opsinReference = JSON.parse(readFileSync(new URL("./fixtures/orgorush-validation-014.opsin.json", import.meta.url), "utf8"));
const opsinByName = new Map(opsinReference.responses.map(row => [row.name, row]));

function graph(smiles) {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, `valid reference SMILES: ${smiles}`);
  return result.molecule;
}

// The four required English examples plus four combinations are fixed as
// bilingual fixtures. Their expected structures are explicit SMILES, so the
// translated name is checked against an independent graph representation.
// Spanish morphemes follow the RSEQ/IUPAC Spanish Brief Guide (prefixes and
// parent nomenclature). The test never queries external services.
const corpus = [
  { en: "3-(1-aminoethyl)-2-methylphenol", es: "3-(1-aminoetil)-2-metilfenol", smiles: "Oc1c(C)c(C(N)C)ccc1" },
  { en: "4-(2-aminoethyl)phenol", es: "4-(2-aminoetil)fenol", smiles: "Oc1ccc(CCN)cc1" },
  { en: "2-(3-aminopropyl)phenol", es: "2-(3-aminopropil)fenol", smiles: "Oc1c(CCCN)cccc1" },
  { en: "2,4-dimethylphenol", es: "2,4-dimetilfenol", smiles: "Oc1c(C)cc(C)cc1" },
  { en: "2-(2-hydroxyethyl)-4-methylphenol", es: "2-(2-hidroxietil)-4-metilfenol", smiles: "Oc1c(CCO)cc(C)cc1" },
  { en: "2-(2-chloroethyl)-4-methylphenol", es: "2-(2-cloroetil)-4-metilfenol", smiles: "Oc1c(CCCl)cc(C)cc1" },
  { en: "2-(3-aminopropyl)-4-methylphenol", es: "2-(3-aminopropil)-4-metilfenol", smiles: "Oc1c(CCCN)cc(C)cc1" },
  { en: "1-amino-2-methylbenzene", es: "1-amino-2-metilbenceno", smiles: "Nc1c(C)cccc1" },
];
const stageTwoCorpus = [
  { en: "2-(2-methylpropyl)-4-methylphenol", es: "2-(2-metilpropil)-4-metilfenol", smiles: "Oc1c(CC(C)C)cc(C)cc1" },
  { en: "3-(prop-2-enyl)-2-methylphenol", es: "3-(prop-2-enil)-2-metilfenol", smiles: "Oc1c(C)c(CC=C)ccc1" },
  { en: "2-(1-amino-2-hydroxyethyl)-4-methylphenol", es: "2-(1-amino-2-hidroxietil)-4-metilfenol", smiles: "Oc1c(C(N)CO)cc(C)cc1" },
  { en: "2-(4-methylphenyl)phenol", es: "2-(4-metilfenil)fenol", smiles: "Oc1c(-c2ccc(C)cc2)cccc1" },
  { en: "2-[2-(1-aminoethyl)phenyl]phenol", es: "2-[2-(1-aminoetil)fenil]fenol", smiles: "Oc1c(-c2c(C(N)C)cccc2)cccc1" },
  { en: "2,6-bis(1-aminoethyl)-4-methylphenol", es: "2,6-bis(1-aminoetil)-4-metilfenol", smiles: "Oc1c(C(N)C)cc(C)cc1C(N)C" },
];
const independentParentCases = [
  ["alkanes", "ALKANE-0003", "2-metilbutano"],
  ["alkanes", "ALKANE-0005", "3-etil-2-metilhexano"],
  ["alkanes", "ALKANE-0004", "2,2-dimetilpropano"],
  ["alkenes", "ALKENE-0010", "4-metilhex-2-eno"],
  ["alkynes", "ALKYNE-0007", "4-metilpent-2-ino"],
  ["alcohols", "ALCOHOL-0011", "4-metilpentan-2-ol"],
  ["aldehydes", "ALDEHYDE-0006", "3-metilbutanal"],
  ["ketones", "KETONE-0006", "4-metilpentan-2-ona"],
  ["rings", "RING-0008", "1-etil-3-metilciclohexano"],
].map(([family, id, es]) => {
  const records = JSON.parse(readFileSync(new URL(`./reference-corpus/${family}.json`, import.meta.url), "utf8"));
  const record = records.find(value => value.id === id);
  assert.ok(record, `independent reference record ${id} exists`);
  return { id, en: record.expected.en, es, smiles: record.smiles };
});

test("compositional external-name corpus translates only after bilingual graph round-trip", () => {
  for (const row of corpus) {
    const actual = graph(row.smiles);
    const localized = localizeCompositionalExternalName(actual, row.en);
    assert.equal(localized, row.es, row.en);
    const spanishParsed = parseCompositionalExternalName(localized, "es");
    assert.ok(spanishParsed, `${row.es} parses as a complete Spanish construction`);
    const canonical = moleculeToSmiles(actual);
    assert.equal(canonical.ok, true);
  }
});

test("the 8-name corpus increases localized coverage from the legacy bridge to the graph-verified grammar", () => {
  const legacyLocalized = corpus.filter(row => localizeChemicalNameForDisplay(row.en, "es", { source: "external" }) !== row.en).length;
  const graphVerified = corpus.filter(row => localizeCompositionalExternalName(graph(row.smiles), row.en) === row.es).length;
  assert.deepEqual({ total: corpus.length, before: legacyLocalized, after: graphVerified }, { total: 8, before: 0, after: 8 });
});

test("stage-two recursive substituent grammar covers branches, unsaturation, multi-locants, aryl groups and multipliers", () => {
  const beforeExpansion = stageTwoCorpus.filter(row => localizeChemicalNameForDisplay(row.en, "es", { source: "external" }) !== row.en).length;
  const afterExpansion = stageTwoCorpus.filter(row => localizeCompositionalExternalName(graph(row.smiles), row.en) === row.es).length;
  assert.deepEqual({ total: stageTwoCorpus.length, beforeExpansion, afterExpansion }, { total: 6, beforeExpansion: 0, afterExpansion: 6 });
  for (const row of stageTwoCorpus) {
    const actual = graph(row.smiles);
    assert.equal(localizeCompositionalExternalName(actual, row.en), row.es, row.en);
    const parsed = parseCompositionalExternalName(row.es, "es");
    assert.ok(parsed, `${row.es} parses completely`);
    assert.equal(moleculeToSmiles(actual).ok, true);
  }
});

test("builder-backed parent grammar localizes independent alkane, unsaturation, functional and cycle references", () => {
  const before = independentParentCases.filter(row => localizeChemicalNameForDisplay(row.en, "es", { source: "external" }) !== row.en).length;
  for (const row of independentParentCases) {
    const actual = graph(row.smiles);
    assert.equal(localizeCompositionalExternalName(actual, row.en), row.es, `${row.id}: ${row.en}`);
  }
  assert.deepEqual({ total: independentParentCases.length, before, after: independentParentCases.length }, { total: 9, before: 0, after: 9 });
});

test("the local constructor verifies acids while other functional parents require matching provider structure", () => {
  assert.equal(localizeCompositionalExternalName(graph("CC(C)CC(=O)O"), "3-methylbutanoic acid"), "ácido 3-metilbutanoico");
  for (const [name, smiles] of [
    ["4-methylpentanenitrile", "CC(C)CCC#N"],
    ["ethyl 2-methylpropanoate", "CCOC(=O)C(C)C"],
    ["N-methylethanamide", "CC(=O)NC"],
    ["aniline", "Nc1ccccc1"],
  ]) assert.equal(localizeCompositionalExternalName(graph(smiles), name), null, name);
});

test("functional parents and stereodescriptors localize against the independent frozen OPSIN corpus", () => {
  const corpus = VALIDATION_CASES.filter(row => {
    const number = Number(row.id.split("-")[1]);
    return number >= 80 && number <= 148;
  });
  let localized = 0;
  let supported = 0;
  let adapterLimits = 0;
  for (const row of corpus) {
    const receipt = opsinByName.get(row.referenceEnglish);
    assert.ok(receipt, `${row.id} has a frozen OPSIN reference`);
    assert.equal(receipt.httpStatus, 200, row.id);
    const payload = JSON.parse(receipt.body);
    assert.equal(payload.status, "SUCCESS", row.id);
    const parsedReference = moleculeFromSmiles(row.smiles);
    const expectedSpanish = row.expected["2013-es"]?.[0] ?? null;
    if (!parsedReference.ok) {
      assert.equal(expectedSpanish, null, `${row.id} is only allowed outside the positive grammar corpus when the adapter cannot represent it`);
      adapterLimits += 1;
      continue;
    }
    const actual = parsedReference.molecule;
    const opsinGraph = graph(payload.smiles);
    assert.equal(moleculeToSmiles(opsinGraph).smiles, moleculeToSmiles(actual).smiles,
      `${row.id} OPSIN reference agrees with the independently recorded structure, including stereo`);

    const candidate = localizeCompositionalExternalName(actual, row.referenceEnglish, { verifiedExternalSmiles: row.smiles });
    if (expectedSpanish) {
      supported += 1;
      assert.equal(candidate, expectedSpanish, `${row.id}: ${row.referenceEnglish}`);
      assert.equal(translateSpanishIupacToOpsin(candidate), row.referenceEnglish,
        `${row.id} compositional morphology reverses to the unchanged source name`);
      const localOnly = localizeCompositionalExternalName(actual, row.referenceEnglish);
      assert.ok(localOnly === null || localOnly === expectedSpanish,
        `${row.id} local-only route either declines or independently proves the expected name`);
      localized += 1;
    } else {
      assert.equal(candidate, null, `${row.id} remains outside the verified grammar`);
    }
  }
  assert.deepEqual({ localized, supported, evaluated: corpus.length, adapterLimits }, { localized: 56, supported: 56, evaluated: 69, adapterLimits: 9 });
});

test("external functional-family localization rejects a mismatched structure receipt and unverified stereo", () => {
  const row = VALIDATION_CASES.find(value => value.id === "V014-133");
  assert.ok(row);
  const actual = graph(row.smiles);
  assert.equal(localizeCompositionalExternalName(actual, row.referenceEnglish), null);
  assert.equal(localizeCompositionalExternalName(actual, row.referenceEnglish, { verifiedExternalSmiles: "C" }), null);
  const opposite = graph("N[C@@H](C(=O)O)C[C@@H](CCC)C");
  assert.equal(localizeCompositionalExternalName(opposite, row.referenceEnglish, { verifiedExternalSmiles: row.smiles }), null);
  const alkene = VALIDATION_CASES.find(value => value.id === "V014-129");
  assert.ok(alkene);
  const alkeneActual = graph(alkene.smiles);
  const wrongGeometricReceipt = alkene.smiles.replace("/C=C/C", "/C=C\\C");
  assert.equal(localizeCompositionalExternalName(alkeneActual, alkene.referenceEnglish,
    { verifiedExternalSmiles: wrongGeometricReceipt }), null, "an E/Z-incompatible external structure is rejected");
});

test("functional-parent grammar rejects out-of-range parent and substituent locants", () => {
  for (const name of [
    "9-methylheptanoic acid", "7-methylbenzoic acid", "6-methylhex-6-enoic acid",
    "8-methylheptan-2-amine", "8-hydroxyheptanamide", "7-methylbenzonitrile",
  ]) {
    const placeholder = graph("CC(=O)O");
    assert.equal(localizeCompositionalExternalName(placeholder, name, { verifiedExternalSmiles: "CC(=O)O" }), null, name);
  }
});

test("the Spanish name-builder route sends translated components to OPSIN and imports the returned graph", async () => {
  let requestedUrl = "";
  const result = await resolveNameWithOpsin("3-(1-aminoetil)-2-metilfenol", {
    fetchImpl: async input => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ status: "SUCCESS", smiles: "Oc1c(C)c(C(N)C)ccc1" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(result.ok, true);
  assert.match(requestedUrl, /3-\(/);
  assert.match(requestedUrl, /aminoethyl/);
  if (!result.ok) return;
  const imported = moleculeFromSmiles(result.value.smiles);
  assert.equal(imported.ok, true);
  assert.equal(localizeCompositionalExternalName(imported.molecule, result.value.interpretedName), "3-(1-aminoetil)-2-metilfenol");
});

test("external localization rejects wrong regioisomers, malformed names, and partial vocabulary", () => {
  const actual = graph("Oc1c(C)c(C(N)C)ccc1");
  for (const name of [
    "4-(1-aminoethyl)-2-methylphenol",
    "3-(2-aminoethyl)-2-methylphenol",
    "3-(1-unknownethyl)-2-methylphenol",
    "3-(1-aminoethyl)-2-methylphenol derivative",
    "3-(1-aminoethyl)-2-methylphenol (R)",
    "7-(1-aminoethyl)-2-methylphenol",
    "2-(3-methylpropyl)-4-methylphenol",
    "2-[2-(1-aminoethyl)phenyl]phenol".replace("2-", "7-"),
    "2,5-bis(1-aminoethyl)-4-methylphenol",
  ]) assert.equal(localizeCompositionalExternalName(actual, name), null, name);
});

test("Spanish/English round-trip retains positional and internal locants", () => {
  const bilingual = [
    ["3-(1-aminoethyl)-2-methylphenol", "3-(1-aminoetil)-2-metilfenol"],
    ["4-(2-aminoethyl)phenol", "4-(2-aminoetil)fenol"],
    ["2-(3-aminopropyl)phenol", "2-(3-aminopropil)fenol"],
  ];
  for (const [english, spanish] of bilingual) {
    const englishAst = parseCompositionalExternalName(english, "en");
    const spanishAst = parseCompositionalExternalName(spanish, "es");
    assert.ok(englishAst);
    assert.ok(spanishAst);
    assert.equal(english.match(/\d+/g)?.length, spanish.match(/\d+/g)?.length);
  }
  const ast = parseCompositionalExternalName("3-(1-aminoethyl)-2-methylphenol", "en");
  assert.equal(ast.parent, "phenol");
  assert.deepEqual(ast.prefixes[0].locants, [3]);
  assert.deepEqual(ast.prefixes[0].substituent, {
    kind: "functionalized-alkyl", sourceName: "1-aminoethyl", root: "eth", carbonCount: 2,
    functional: "amino", internalLocant: 1,
  });
  assert.deepEqual(ast.prefixes[1].locants, [2]);
  assert.equal(ast.prefixes[1].term, "methyl");
});
