import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { localizeChemicalNameForDisplay } from "../app/iupac-name-normalization.ts";
import { applyNomenclatureConvention, selectableNomenclatureConventions, nomenclatureConventionLabel } from "../app/nomenclature-conventions.ts";
import { legacyProfileDisplayName, selectedNomenclatureExportName } from "../app/legacy-profile-display.ts";
import { verifiedPubChemSystematicDisplayName } from "../app/verified-common-name-equivalences.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";

// Expected terminology checked independently before fixing the expected text:
// IUPAC/RSEQ Spanish Brief Guide, tables 1–3 and sections 5.3/7/9;
// Organon's Spanish product monograph, p. 25: ciclopenta[a]fenantren-3-ona;
// Fisher Scientific / Lipomed 30458294 independently lists this Spanish name.
// This is localization of the supplied record, not a new PIN/graph assignment.
const english = "(8S,9S,10R,13S,14S,17S)-17-acetyl-10,13-dimethyl-1,2,6,7,8,9,11,12,14,15,16,17-dodecahydrocyclopenta[a]phenanthren-3-one";
const spanish = "(8S,9S,10R,13S,14S,17S)-17-acetil-10,13-dimetil-1,2,6,7,8,9,11,12,14,15,16,17-dodecahidrociclopenta[a]fenantren-3-ona";
const external = (name, language = "es") => localizeChemicalNameForDisplay(name, language, { source: "external" });
const pageText = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const page = ts.createSourceFile("page.tsx", pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findNode(predicate, node = page) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => findNode(predicate, child));
}
const variants = findNode(node => ts.isVariableDeclaration(node) && node.name.getText(page) === "nomenclatureVariants");
assert.ok(variants?.initializer);
const variantCode = ts.transpileModule(`result = ${variants.initializer.getText(page)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
function displayedVariants(language, identity, legacy = { spanishResolution: { name: "-" }, englishName: "-" }, molecule = {atoms:[],bonds:[]}) {
  const context = { language, externalNameIsPrimary: true, namingPubChemIdentity: identity, pubChemIupacName: identity.iupacName,
    molecule,reasoningSourceName:null,reconcileSystematicName,
    verifiedPubChemSystematicDisplayName, localizeChemicalNameForDisplay, applyNomenclatureConvention,
    selectableNomenclatureConventions, nomenclatureConventionLabel, legacyProfileDisplayName, legacyResolution: legacy,
    localizedIupac() { throw new Error("external display must not re-enter the local/Legacy translator"); },
  };
  runInNewContext(variantCode, context);
  return JSON.parse(JSON.stringify(context.result));
}

test("LOCALIZATION-012 translates the complete supplied external name", () => {
  assert.equal(external(english), spanish);
});

test("LOCALIZATION-012 preserves all six stereodescriptors, locants, [a] and punctuation", () => {
  const displayed = external(english);
  assert.deepEqual(displayed.match(/\d+[RS]/g), ["8S", "9S", "10R", "13S", "14S", "17S"]);
  assert.deepEqual(displayed.match(/\d+/g), english.match(/\d+/g));
  assert.deepEqual(displayed.match(/\[[^\]]+\]/g), ["[a]"]);
  assert.equal(displayed.replace(/[A-Za-z]/g, ""), english.replace(/[A-Za-z]/g, ""));
  // E/Z in an unrecognized parent is also preserved verbatim, never stripped.
  assert.equal(external("(2E,4Z)-hexa-2,4-diene"), "(2E,4Z)-hexa-2,4-diene");
});

test("LOCALIZATION-012 English bypasses localization, including opaque external text", () => {
  for (const name of [english, spanish, "(R)-17-acetyl-unknown-parent", "  PubChem original text  "])
    assert.equal(external(name, "en"), name);
});

test("LOCALIZATION-012 is idempotent and preserves already Spanish/simple names", () => {
  for (const name of [english, spanish, "metano", "etanol", "butan-2-ona", "2-metilpiridina", "fenantreno", "pireno"])
    assert.equal(external(external(name)), external(name));
  for (const name of [spanish, "metano", "etanol", "butan-2-ona", "2-metilpiridina", "fenantreno", "pireno"])
    assert.equal(external(name), name);
  assert.equal(external("2-methylpyridine"), "2-metilpiridina");
  assert.equal(external("1-methylnaphthalene"), "1-metilnaftaleno");
  assert.equal(external("1,2,3,4-tetrahydronaphthalene"), "1,2,3,4-tetrahidronaftaleno");
});

test("LOCALIZATION-012 localizes components rather than one hardcoded compound name", () => {
  assert.equal(external(english.slice(english.indexOf(")-") + 2)), spanish.slice(spanish.indexOf(")-") + 2));
  // A descriptor is copied from its written span; no particular R/S identity
  // is inferred by this display-only operation.
  assert.equal(external(english.replace("17S)", "17R)")), spanish.replace("17S)", "17R)"));
});

test("LOCALIZATION-012 unknown morphemes and malformed boundaries keep the whole original", () => {
  for (const name of [
    english.replace("acetyl", "ethynyl"), english.replace("acetyl", "acetylamino"),
    english.replace("phenanthren", "phenanthridin"), english.replace("-one", "-amine"),
    english.replace("[a]", "[b]"), english.replace("-10,13-", "10,13-"),
    english.replace("dodecahydro", "undecahydro"), `${english}-unknown`,
    `unknown-${english}`, "3-acetylunknownparent", "foomethylpyridine", "2-methylpyridine derivative",
    "(8S,9S,10R,13S,14S,17S)-17-acetil-10,13-dimethyl-1,2,6,7,8,9,11,12,14,15,16,17-dodecahydrocyclopenta[a]phenanthren-3-one",
  ]) assert.equal(external(name), name, name);
});

test("LOCALIZATION-012 the production profile-selection expression localizes only Current", () => {
  const identity = Object.freeze({ iupacName: english });
  for (const language of ["es", "en"]) {
    const result = displayedVariants(language, identity);
    assert.equal(result.find(item => item.convention === "current").name, language === "es" ? spanish : english);
    const legacy = result.find(item => item.convention !== "current");
    assert.equal(legacy.available, false);
    assert.equal(legacy.name, language === "es" ? "No disponible para esta estructura" : "Not available for this structure");
    const supported = displayedVariants(language, identity, { spanishResolution: { name: "2-butanona" }, englishName: "2-butanone" });
    assert.equal(supported.find(item => item.convention !== "current").name, language === "es" ? "2-butanona" : "2-butanone");
  }
  assert.equal(identity.iupacName, english);
});

test("LOCALIZATION-012 verified identity overrides and canonical export metadata are preserved", () => {
  const tnt = Object.freeze({ cid: 8376, inchiKey: "SPSSULHKWOKEEL-UHFFFAOYSA-N", iupacName: "2-methyl-1,3,5-trinitrobenzene" });
  assert.equal(displayedVariants("es", tnt)[0].name, "2-metil-1,3,5-trinitrobenceno");
  assert.equal(displayedVariants("en", tnt)[0].name, tnt.iupacName);
  assert.equal(selectedNomenclatureExportName({ convention: "current", displayedName: spanish, copyable: true, canonicalName: english }), english);
  const canonical = findNode(node => ts.isVariableDeclaration(node) && node.name.getText(page) === "canonicalIupacName");
  assert.equal(canonical.initializer.getText(page), "nameWithSelectedStereochemistry");
  assert.match(pageText, /compoundLookupNamesRef\.current = \[canonicalIupacName\]/);
});

test("LOCALIZATION-012 a fully reconciled purine name remains literal without enabling Legacy",()=>{
  const parsed=moleculeFromSmiles('CN1C=NC2=C1C(=O)N(C(=O)N2C)C');assert.equal(parsed.ok,true);
  const identity=Object.freeze({iupacName:'1,3,7-trimethylpurine-2,6-dione'});
  const variants=displayedVariants('es',identity,undefined,parsed.molecule);
  assert.equal(variants[0].name,identity.iupacName);
  assert.equal(variants.find(v=>v.convention!=='current').available,false);
});

test("LOCALIZATION-012 the original PubChem name remains available in Current provenance", () => {
  const origin = findNode(node => ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)
    && node.expression.left.getText(page).includes("namingPubChemIdentity.iupacName !== displayedIupacName")
    && node.expression.right.getText(page).includes("Nombre sistemático · PubChem"));
  assert.ok(origin);
  const expression = ts.transpileModule(`result = ${origin.expression.left.getText(page)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { namingPubChemIdentity: Object.freeze({ iupacName: english }), externalNameIsPrimary: true,
    activeNomenclatureConvention: "current", displayedIupacName: spanish };
  runInNewContext(expression, context);
  assert.equal(context.result, true);
  assert.match(origin.expression.right.getText(page), /ChemicalNameText name=\{namingPubChemIdentity\.iupacName\}/);
  context.activeNomenclatureConvention = "iupac-1979-es";
  runInNewContext(expression, context);
  assert.equal(context.result, false, "Legacy provenance condition retains its previous behavior");
});

test("LOCALIZATION-012 the existing local/Legacy display vocabulary is unchanged", () => {
  const fixtures = JSON.parse(readFileSync(new URL("./fixtures/iupac79-fused.json", import.meta.url), "utf8")).cases;
  for (const row of fixtures.filter(item => item.status === "PASS" && item.route !== "von-baeyer"))
    assert.equal(localizeChemicalNameForDisplay(row.en, "es"), row.es, row.id);
  assert.equal(localizeChemicalNameForDisplay("2-metilpyridine", "es"), "2-metilpiridina");
});
