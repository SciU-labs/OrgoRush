import test from "node:test";
import assert from "node:assert/strict";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { PROGESTERONE_CHEBI_SMILES, PROGESTERONE_NAMES, PROGESTERONE_REFERENCE_IDENTITIES,
  PROGESTERONE_REFERENCE_SMILES, buildProgesteroneMoleculeFromName, inspectProgesteroneGraph } from "../app/progesterone-stereo-grammar.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { buildSteroidFamilyMoleculeFromName } from "../app/steroid-family-grammar.ts";
import { auditPedagogicalCoverage } from "../app/pedagogical-decision-model.ts";

const built = buildProgesteroneMoleculeFromName(PROGESTERONE_NAMES.commonEn);
assert.ok(built?.ok, "the audited PubChem reference is importable");
const progesterone = built.molecule;

test("independent progesterone references agree across atom order and explicit-H conventions", () => {
  assert.equal(PROGESTERONE_REFERENCE_IDENTITIES[0], PROGESTERONE_REFERENCE_IDENTITIES[1]);
  const alternate = moleculeFromSmiles(PROGESTERONE_CHEBI_SMILES);
  assert.equal(alternate.ok, true);
  const inspected = inspectProgesteroneGraph(alternate.molecule);
  assert.ok(inspected);
  assert.equal(Object.keys(inspected.locants).length, 21);
  assert.equal(inspected.locants["20"], inspected.c20);
  assert.equal(inspected.locants["21"], inspected.c21);
  assert.equal(inspected.system.ringSizes.join(","), "6,6,6,5");
});

test("strict systematic and common names reconcile independently in English and Spanish", () => {
  for (const [name, language] of [[PROGESTERONE_NAMES.en,"en"],[PROGESTERONE_NAMES.es,"es"],
    [PROGESTERONE_NAMES.commonEn,"en"],[PROGESTERONE_NAMES.commonEs,"es"]]) {
    const proof = reconcileSystematicName(progesterone,name);
    assert.equal(proof?.status,"FULL",name);
    assert.equal(proof?.evidence?.language,language,name);
    assert.equal(proof?.evidence?.equivalence,"complete-graph-isomorphism",name);
  }
  assert.equal(reconcileSystematicName(progesterone,"pregn-4-ene-3-one"),null,"missing C20 ketone must not be FULL");
  assert.equal(reconcileSystematicName(progesterone,"pregn-5-ene-3,20-dione"),null,"wrong alkene locant must not be FULL");
});

test("the same verified decision rules generate concise bilingual causal steps and exact graph targets", () => {
  for (const [language, name] of [["en",PROGESTERONE_NAMES.en],["es",PROGESTERONE_NAMES.es]]) {
    const derivation = reconcileSystematicName(progesterone,name);
    assert.ok(derivation);
    const reasoning = buildValidatedPriorityReasoning({ derivation, graph: progesterone, language, activeName: name });
    assert.equal(reasoning.steps.length,6);
    assert.deepEqual(reasoning.steps.map(step => step.number),["1","2","3","4","5","6"]);
    const fullText = reasoning.steps.map(step => step.explanation).join(" ");
    assert.match(fullText,/C20/);
    assert.match(fullText,/C21/);
    assert.match(fullText,language === "en" ? /C4 and C5|C4=C5/ : /C4 y C5|C4=C5/);
    assert.match(fullText,language === "en" ? /two ketone groups|di-/ : /dos funciones|di-/);
    assert.match(fullText,language === "en" ? /C3 and C20|C3,20/ : /C3 y C20|C3,20/);
    assert.match(fullText,/8S, 9S, 10R, 13S, 14S, 17S/);
    assert.deepEqual(derivation.evidence.steroidPedagogy.stereo.descriptors,["8S","9S","10R","13S","14S","17S"]);
    assert.match(fullText,language === "en" ? /not being parsed as a literal source/ : /no se presenta como fuente literal/);
    assert.doesNotMatch(fullText,/hydroxy|hidroxi|alcohol suffix|sufijo de alcohol/i);
    assert.ok(reasoning.steps.every(step => step.advancedExplanation?.length),"every derived step has advanced causal rationale");
    assert.ok(reasoning.steps.every(step => language === "en" ? /the |is |are |does /i.test(step.advancedExplanation) : /el |la |los |las |se |no /i.test(step.advancedExplanation)),"rationale is localized with the selected language");
    const byId = new Map(derivation.components.map(component => [component.id,component]));
    for (const id of ["steroid-side-chain","steroid-unsaturation-4","steroid-ketone-3","steroid-ketone-20","steroid-stereo"]) {
      const component = byId.get(id);
      assert.ok(component,`missing semantic component ${id}`);
      assert.ok(component.atomIds.length,`${id} must select graph atoms`);
      assert.ok(component.atomIds.every(atomId => progesterone.atoms.some(atom => atom.id === atomId)),`${id} uses real atom IDs`);
      assert.ok(component.bondIds.every(([a,b]) => progesterone.bonds.some(([x,y]) => (x === a && y === b) || (x === b && y === a))),`${id} uses real bonds`);
    }
    assert.deepEqual(byId.get("steroid-side-chain").numbering.map(([,locant]) => locant),[17,20,21]);
    assert.deepEqual(byId.get("steroid-unsaturation-4").numbering.map(([,locant]) => locant),[4,5]);
    assert.deepEqual([byId.get("steroid-ketone-3").numbering[0][1],byId.get("steroid-ketone-20").numbering[0][1]],[3,20]);
  }
});

test("stereo epimers, incomplete stereo, and constitutional edits cannot inherit progesterone FULL", () => {
  const epimer = structuredClone(progesterone);
  const locants = inspectProgesteroneGraph(epimer).locants;
  const c17 = epimer.atoms.find(atom => atom.id === locants["17"]);
  c17.tetrahedralParity = c17.tetrahedralParity === "R" ? "S" : "R";
  assert.equal(reconcileSystematicName(epimer,PROGESTERONE_NAMES.en),null);
  const unspecified = structuredClone(progesterone);
  delete unspecified.atoms.find(atom => atom.id === locants["17"]).tetrahedralParity;
  assert.equal(reconcileSystematicName(unspecified,PROGESTERONE_NAMES.en),null);
  const constitution = structuredClone(progesterone);
  const c3O = inspectProgesteroneGraph(constitution).carbonylOxygens[3];
  const carbonylIndex = constitution.bonds.findIndex(([a,b]) => (a === locants["3"] && b === c3O) || (a === c3O && b === locants["3"]));
  constitution.bonds[carbonylIndex][2] = 1;
  assert.equal(reconcileSystematicName(constitution,PROGESTERONE_NAMES.en),null);
});

test("canonical input aliases construct the same audited graph without depending on SMILES order", () => {
  const alternate = moleculeFromSmiles(PROGESTERONE_CHEBI_SMILES);
  assert.equal(alternate.ok,true);
  for (const language of ["en","es"]) {
    const name = language === "en" ? PROGESTERONE_NAMES["en"] : PROGESTERONE_NAMES["es"];
    assert.equal(reconcileSystematicName(alternate.molecule,name)?.status,"FULL");
  }
  assert.ok(inspectProgesteroneGraph(progesterone));
  assert.ok(inspectProgesteroneGraph(moleculeFromSmiles(PROGESTERONE_REFERENCE_SMILES).molecule));
});

test("the same rule engine is reusable for separately audited estrane and androstane parents", () => {
  for (const [name, family] of [["5α-estrane","estrane"],["5α-androstane","androstane"]]) {
    const builtFamily = buildSteroidFamilyMoleculeFromName(name);
    assert.ok(builtFamily?.ok,name);
    const derivation = reconcileSystematicName(builtFamily.molecule,name);
    assert.equal(derivation?.status,"FULL",name);
    const evidence = derivation.evidence.steroidPedagogy;
    assert.equal(evidence.family,family);
    const reasoning = buildValidatedPriorityReasoning({ derivation, graph: builtFamily.molecule, language: "en", activeName: name });
    assert.equal(reasoning.name,name);
    assert.ok(reasoning.steps.length >= 3);
    assert.ok(reasoning.steps.length < 6,"unneeded unsaturation/function stages are omitted");
    assert.match(reasoning.steps[0].explanation,/6–6–6–5/);
    assert.match(reasoning.steps.at(-1).explanation,/validated steroid grammar/);
  }
});

test("pedagogical coverage is auditable without changing FULL reconciliation", () => {
  const derivation = reconcileSystematicName(progesterone, PROGESTERONE_NAMES.en);
  const reasoning = buildValidatedPriorityReasoning({ derivation, graph: progesterone, language: "en", activeName: PROGESTERONE_NAMES.en });
  assert.equal(derivation.status, "FULL");
  assert.equal(reasoning.coverage?.chemicalStatus, "FULL");
  assert.equal(reasoning.coverage?.name, PROGESTERONE_NAMES.en);
  assert.ok(reasoning.coverage?.availableDecisions.includes("steroid.unsaturation.4"));
  assert.ok(reasoning.coverage?.explainedDecisions.includes("steroid.unsaturation.4"));
  assert.ok(reasoning.coverage?.coveredNameFragments.some(item => item.decisionId === "steroid.name-assembly"));
  assert.equal(reasoning.coverage?.coverage, "complete");
  assert.deepEqual(reasoning.coverage?.unjustifiedComponents, []);
  const partial = auditPedagogicalCoverage({ name: "unreconciled example", chemicalStatus: "PARTIAL",
    decisions: [], plan: [], steps: [], componentIds: ["unexplained-fragment"] });
  assert.equal(partial.chemicalStatus, "PARTIAL");
  assert.equal(partial.coverage, "none");
  assert.deepEqual(partial.unjustifiedComponents.map(item => item.componentId), ["unexplained-fragment"]);
  assert.deepEqual(partial.causes, ["unmapped-components:unexplained-fragment", "no-applicable-pedagogical-decisions"]);
});
