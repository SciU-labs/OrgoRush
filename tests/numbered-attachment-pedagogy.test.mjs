import assert from "node:assert/strict";
import test from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { presentValidatedSystematicName, reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { adaptNaphthaleneEvidence } from "../app/fused-ring-pedagogy-adapters.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { adaptPurineEvidence } from "../app/purine-pedagogy-adapter.ts";
import { purineCases } from "./fixtures/purine-derivation.mjs";
import { nestedAromaticAttachmentDecisions } from "../app/numbered-attachment-decisions.ts";
import { PROGESTERONE_NAMES, PROGESTERONE_CHEBI_SMILES, PROGESTERONE_REFERENCE_SMILES } from "../app/progesterone-stereo-grammar.ts";
import { TESTOSTERONE_NAMES } from "../app/testosterone-stereo-grammar.ts";
import { TESTOSTERONE_REFERENCE_SMILES } from "../app/testosterone-stereo-structure.ts";
import { auditPedagogicalCoverage } from "../app/pedagogical-decision-model.ts";
import { buildPedagogicalNameInventory } from "../app/pedagogical-name-inventory.ts";

function resolve(smiles, name, language = "en") {
  const graph = moleculeFromSmiles(smiles).molecule;
  const derivation = reconcileSystematicName(graph, name);
  assert.equal(derivation?.status, "FULL", name);
  return { graph, derivation, model: buildValidatedPriorityReasoning({ graph, derivation, activeName: name, language }) };
}

test("the attached oxygen distinguishes adjacent and non-adjacent fusion positions across SMILES orders", () => {
  for (const [smiles, locant, neighbors] of [
    ["Oc1cccc2ccccc12", 1, ["2", "8a"]], ["c1ccc2c(O)cccc2c1", 1, ["2", "8a"]],
    ["Oc1ccc2ccccc2c1", 2, ["1", "3"]],
  ]) {
    const { graph, derivation, model } = resolve(smiles, `naphthalen-${locant}-ol`);
    const { decisions } = adaptNaphthaleneEvidence(graph, derivation);
    const sites = decisions.filter(d => d.kind === "attachment-locants");
    assert.equal(sites.length, 1);
    const [site, oxygen, ...adjacent] = sites[0].atomIds;
    const numbering = new Map(derivation.components[0].numbering);
    assert.equal(Number(numbering.get(site)), locant);
    assert.equal(graph.atoms.find(atom => atom.id === oxygen).element, "O");
    assert.deepEqual(adjacent.map(id => numbering.get(id)), neighbors);
    assert.deepEqual(sites[0].bondIds, [[site, oxygen], ...adjacent.map(id => [site, id])]);
    assert.ok(sites[0].bondIds.every(([a,b]) => graph.bonds.some(([x,y]) => a===x && b===y || a===y && b===x)));
    assert.ok(model.steps.find(s => s.decisionIds?.includes(sites[0].id)).advancedExplanation.includes(sites[0].result));
    const equivalent = locant === 1 ? "4 / 5 / 8" : "3 / 6 / 7";
    assert.ok(model.steps.find(s => s.decisionIds?.includes("naphthalene.numbering")).advancedExplanation.includes(equivalent));
  }
});

test("retained steroid numbering distinguishes a side-chain carbonyl from a hydroxyl on C17", () => {
  for (const [smiles, names, sites] of [
    [PROGESTERONE_REFERENCE_SMILES, PROGESTERONE_NAMES, ["C3=O", "C20=O"]],
    [PROGESTERONE_CHEBI_SMILES, PROGESTERONE_NAMES, ["C3=O", "C20=O"]],
    [TESTOSTERONE_REFERENCE_SMILES, TESTOSTERONE_NAMES, ["C3=O", "C17–O"]],
  ]) for (const lang of ["en","es"]) {
    const {graph, model} = resolve(smiles, names[lang], lang);
    const functions = model.steps.find(s => s.decisionIds.includes("steroid.principal-function"));
    for (const step of model.steps) for (const fragment of [step.fragments, ...step.fragments?.additionalFragments ?? []]) {
      if (fragment) assert.ok(fragment.text.trim(), "every graph control has a readable label");
    }
    for (const site of sites) assert.ok(functions.advancedExplanation.includes(site));
    assert.equal(functions.decisionIds.filter(id => id.includes(".attachment.")).length, 2);
    assert.deepEqual(model.coverage.justifiedLocants.filter(x => x.decisionId.includes(".attachment.")).flatMap(x=>x.locants), sites.map(s=>Number(s.match(/\d+/)[0])));
    const common = lang === "en" ? names.commonEn : names.commonEs;
    const identity = buildValidatedPriorityReasoning({graph, derivation: reconcileSystematicName(graph, common), language: lang, activeName: common});
    assert.deepEqual(identity.coverage.explainedDecisions, ["steroid.common-identity"]);
    assert.deepEqual(identity.coverage.coveredNameFragments[0].fragments, [common]);
  }
});

test("outer amide N or parent C3 stays distinct from internal aryl C4", () => {
  for (const [smiles,name,path,scope] of [
    ["CC(=O)Nc1ccc(O)cc1","N-(4-hydroxyphenyl)acetamide","N–C1","aryl"],
    ["CNCCC(c1ccccc1)Oc1ccc(C(F)(F)F)cc1","N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine","C3–O–C1","phenoxy"],
  ]) for (const lang of ["en", "es"]) {
    const {graph, derivation, model} = resolve(smiles, name, lang);
    const [{decision}] = nestedAromaticAttachmentDecisions(graph, derivation);
    assert.equal(decision.result, path);
    assert.deepEqual(decision.locants, [4]);
    assert.equal(decision.numberingScope, scope);
    assert.ok(decision.bondIds.every(([a,b]) => graph.bonds.some(([x,y]) => a===x && b===y || a===y && b===x)));
    assert.ok(model.steps.find(s => s.decisionIds?.includes(decision.id)).advancedExplanation.includes(path));
    assert.equal(model.coverage.coverage, "complete");
    assert.equal(model.coverage.chemicalStatus, "FULL");
  }
});

test("two suffix sites contribute to the one diol ending and both exact controls", () => {
  for (const [language, name] of [["en","naphthalene-1,5-diol"], ["es","naftaleno-1,5-diol"]]) {
    const { graph, derivation, model } = resolve("Oc1cccc2c(O)cccc12", name, language);
    const decision = adaptNaphthaleneEvidence(graph, derivation).decisions.find(d => d.kind === "functional-multiplicity");
    assert.deepEqual(decision.locants, [1,5]);
    assert.deepEqual(decision.nameFragments, ["diol"]);
    const step = model.steps.find(s => s.decisionIds.includes(decision.id));
    assert.deepEqual(step.componentIds, ["hydroxy-1","hydroxy-5"]);
    assert.equal(new Set(step.target.bondIds.map(([a,b]) => [a,b].sort().join())).size, 2);
    assert.ok(step.explanation.includes("1,5"));
  }
});

test("purine methyl and oxo positions follow the same attachment rule on different elements", () => {
  for (const f of purineCases) for (const language of ["en", "es"]) {
    const { graph, derivation, model } = resolve(f.smiles, f.name, language);
    const { decisions } = adaptPurineEvidence(graph, derivation);
    const sites = decisions.filter(d => d.kind === "attachment-locants");
    const expected = [...f.methyl, ...f.oxo];
    assert.equal(sites.length, expected.length);
    for (const [pos, external] of expected) {
      const site = sites.find(d => d.atomIds[1] === external);
      assert.deepEqual(site.locants, [pos]);
      assert.deepEqual(site.bondIds[0], [f.parent[pos-1], external]);
      assert.ok(model.steps.find(s => s.decisionIds.includes(site.id)).advancedExplanation.includes(site.result));
      assert.ok(site.nameFragments.every(fragment => f.name.includes(fragment)));
    }
    const numbering = model.steps.find(s => s.decisionIds.includes("purine.numbering"));
    assert.ok(numbering.explanation.includes("N9"));
    assert.ok(model.steps.some(s => s.decisionIds.includes("purine.assembly") && s.explanation.includes(f.name)));
    assert.equal(reconcileSystematicName(graph, f.common === "purine" ? "caffeine" : f.common), null);
  }
});

test("semantic attachment decisions survive arbitrary atom IDs and graph storage order", () => {
  const f = purineCases.find(item => item.common === "caffeine");
  const {graph, derivation} = resolve(f.smiles, f.name);
  const ids = new Map(graph.atoms.map((a,i) => [a.id,1000 + (graph.atoms.length-i)*17]));
  const changed = {atoms: graph.atoms.map(a => ({...a,id:ids.get(a.id),x:-a.y,y:a.x})).reverse(),
    bonds: graph.bonds.map(([a,b,o]) => [ids.get(b),ids.get(a),o]).reverse(),rings:[]};
  const proof = reconcileSystematicName(changed, f.name);
  assert.equal(proof?.status, "FULL");
  const first = adaptPurineEvidence(graph, derivation).decisions;
  const second = adaptPurineEvidence(changed, proof).decisions;
  for (const decision of first.filter(d => d.kind === "attachment-locants")) {
    const actual = second.find(d => d.id === decision.id);
    assert.deepEqual(actual.locants, decision.locants);
    assert.equal(actual.result, decision.result);
    assert.deepEqual(actual.explanation, decision.explanation);
    assert.deepEqual(actual.atomIds, decision.atomIds.map(id=>ids.get(id)));
  }
});

test("coverage catches applicable decisions missing from presentation", () => {
  const f = purineCases[2];
  const {graph,derivation} = resolve(f.smiles,f.name);
  const {decisions} = adaptPurineEvidence(graph,derivation);
  const first = decisions[0];
  const coverage = auditPedagogicalCoverage({name:f.name,chemicalStatus:"FULL",decisions,plan:[],
    inventory:buildPedagogicalNameInventory(derivation,graph),
    steps:[{title:"parent",explanation:first.explanation.en,decisionIds:[first.id],componentIds:["parent"]}],
    componentIds:derivation.components.map(c=>c.id)});
  assert.equal(coverage.coverage,"partial");
  assert.equal(coverage.chemicalStatus,"FULL");
  assert.ok(coverage.causes.some(c=>c.startsWith("unexplained-decisions:")));
});

test("verified Spanish presentation preserves nested rationale and unique controls", () => {
  const {graph,derivation} = resolve("CC(=O)Nc1ccc(O)cc1","N-(4-hydroxyphenyl)acetamide");
  const activeName = presentValidatedSystematicName(derivation,"es").name;
  const model = buildValidatedPriorityReasoning({graph,derivation,language:"es",activeName});
  const detail = model.steps.find(step=>step.advancedExplanation?.includes("N–C1"));
  assert.ok(detail,"Spanish presentation retains graph-backed attachment rationale");
  assert.equal(model.coverage.name,activeName);
  for (const step of model.steps) {
    const ids = [step.fragments,...step.fragments?.additionalFragments ?? []].filter(Boolean).map(f=>f.semanticId);
    assert.equal(new Set(ids).size,ids.length,"one semantic control per step");
  }
  const unrelated = buildValidatedPriorityReasoning({graph,derivation,language:"es",activeName:"unverified alias"});
  assert.equal(unrelated.steps.some(s=>s.advancedExplanation?.includes("N–C1")),false,"a different name cannot reuse the projected presentation");
});

test("alphabetical comparison keeps its explanation without repeating substituent controls", () => {
  const {model} = resolve("CNCCC(c1ccccc1)Oc1ccc(C(F)(F)F)cc1",
    "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine");
  const order = model.steps.find(s=>s.alphabeticalOrder);
  assert.ok(order.alphabeticalOrder.paragraphs.length);
  assert.ok(order.target.atomIds.length,"combined step selection remains available");
  assert.equal(order.fragments,undefined);
  assert.deepEqual(order.fragmentTargets,{});
});
