import test from "node:test";
import assert from "node:assert/strict";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { parseFusedDecalinName } from "../app/fused-decalin-grammar.ts";
import { buildProgesteroneMoleculeFromName, PROGESTERONE_NAMES } from "../app/progesterone-stereo-grammar.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { adaptDecalinEvidence, adaptNaphthaleneEvidence } from "../app/fused-ring-pedagogy-adapters.ts";
import { renderPedagogicalDecisionPlan } from "../app/pedagogical-decision-model.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";

const graphFor = smiles => {
  const parsed = moleculeFromSmiles(smiles);
  assert.equal(parsed.ok, true, parsed.error);
  return parsed.molecule;
};

test("decalin adapter derives fusion and stereochemistry decisions only from FULL graph evidence", () => {
  for (const [name, configuration] of [["cis-decalin", "cis"], ["trans-decalin", "trans"], ["decalin", "unspecified"]]) {
    const parsed = parseFusedDecalinName(name);
    assert.ok(parsed);
    const derivation = reconcileSystematicName(parsed.graph, name);
    assert.equal(derivation?.status, "FULL");
    const adapted = adaptDecalinEvidence(parsed.graph, derivation);
    assert.ok(adapted);
    const stereo = adapted.decisions.find(decision => decision.id === "decalin.fusion-stereo");
    assert.equal(stereo?.result, configuration);
    assert.equal(stereo?.kind, "relative-stereochemistry");
    assert.ok(stereo.atomIds.every(id => derivation.components.find(component => component.id === "fusion-junction").atomIds.includes(id)));
    if (configuration === "unspecified") {
      assert.equal(adapted.plan.some(step => step.id === "stereo"), false);
      assert.doesNotMatch(adapted.decisions.find(decision => decision.id === "decalin.name-assembly").result, /^(?:cis|trans)-/i);
    } else {
      assert.match(stereo.explanation.en, configuration === "cis" ? /same face/ : /opposite faces/);
      assert.match(stereo.why.en, /not.*drawing|first requires/i);
    }
    const rendered = renderPedagogicalDecisionPlan(adapted.decisions, adapted.plan, "es");
    assert.ok(rendered.length >= 3);
    assert.ok(rendered.every(step => step.explanation && step.title));
    assert.ok(rendered.some(step => step.title === "Identificar el sistema fusionado"));
  }
  const mismatch = parseFusedDecalinName("cis-decalin");
  assert.equal(reconcileSystematicName(parseFusedDecalinName("trans-decalin").graph, "cis-decalin"), null);
  assert.equal(adaptDecalinEvidence(mismatch.graph, null), null);
});

test("naphthalene and substituted naphthalene use common decisions with graph-exact ring and locant controls", () => {
  for (const [smiles, name] of [["c1ccc2ccccc2c1", "naphthalene"], ["Cc1ccc2ccccc2c1", "2-methylnaphthalene"]]) {
    const graph = graphFor(smiles);
    const derivation = reconcileSystematicName(graph, name);
    assert.equal(derivation?.status, "FULL");
    const adapted = adaptNaphthaleneEvidence(graph, derivation);
    assert.ok(adapted);
    assert.ok(adapted.decisions.length >= 3);
    assert.ok(adapted.decisions.every(item => item.family === "naphthalene"));
    const system = adapted.decisions.find(item => item.id === "naphthalene.ring-system");
    assert.equal(system.atomIds.length, 10);
    assert.equal(system.bondIds.length, 11);
    assert.equal(adapted.decisions.find(item => item.id === "naphthalene.numbering").locants.length, 8);
    const reasoning = buildValidatedPriorityReasoning({ derivation, graph, language: "en" });
    assert.equal(reasoning.steps.length, name === "naphthalene" ? 3 : 4);
    assert.match(reasoning.steps[0].explanation, /two fused six-membered aromatic rings/i);
    assert.deepEqual(new Set(reasoning.steps[0].componentIds), new Set(["parent", "fused-ring:1", "fused-ring:2", "fusion-atoms", "fusion-bonds"]));
    if (name !== "naphthalene") assert.match(reasoning.steps[2].title, /substituents/i);
    for (const step of reasoning.steps) {
      assert.ok(step.target?.atomIds.length, `${name}: each stage has an exact graph target`);
      assert.ok(step.target.atomIds.every(id => graph.atoms.some(atom => atom.id === id)));
      assert.ok(step.target.bondIds.every(([a,b]) => graph.bonds.some(([x,y]) => x === a && y === b || x === b && y === a)));
    }
  }
});

test("steroid decisions pass through the same presentation renderer without changing the audited six stages", () => {
  const built = buildProgesteroneMoleculeFromName(PROGESTERONE_NAMES.en);
  assert.ok(built?.ok);
  const graph = built.molecule;
  const derivation = reconcileSystematicName(graph, PROGESTERONE_NAMES.en);
  assert.equal(derivation?.status, "FULL");
  const reasoning = buildValidatedPriorityReasoning({ derivation, graph, language: "en" });
  assert.equal(reasoning.steps.length, 6);
  assert.match(reasoning.steps[0].title, /steroid skeleton/i);
  assert.match(reasoning.steps.at(-1).advancedExplanation, /verified name grammar/i);
  const naphGraph = graphFor("c1ccc2ccccc2c1");
  const naphDerivation = reconcileSystematicName(naphGraph, "naphthalene");
  const naphAdaptation = adaptNaphthaleneEvidence(naphGraph, naphDerivation);
  assert.ok(naphAdaptation);
  const output = renderPedagogicalDecisionPlan(naphAdaptation.decisions, naphAdaptation.plan, "en");
  assert.equal(output.length, 3, "the same presentation renderer serves another family");
});

test("ring-system decisions are invariant to graph array order and remain bilingual", () => {
  const inputs = [
    [parseFusedDecalinName("trans-decalin").graph, "trans-decalin", adaptDecalinEvidence],
    [graphFor("c1ccc2ccccc2c1"), "naphthalene", adaptNaphthaleneEvidence],
  ];
  for (const [source, name, adapt] of inputs) {
    const reordered = structuredClone(source);
    reordered.atoms.reverse();
    reordered.bonds.reverse();
    reordered.rings?.reverse();
    const firstProof = reconcileSystematicName(source, name);
    const reorderedProof = reconcileSystematicName(reordered, name);
    assert.equal(firstProof?.status, "FULL");
    assert.equal(reorderedProof?.status, "FULL");
    const first = adapt(source, firstProof);
    const second = adapt(reordered, reorderedProof);
    assert.ok(first && second);
    const planOrder = new Map(first.plan.flatMap((step,index)=>step.decisionIds.map(id=>[id,index])));
    for (const decision of first.decisions) for (const dependency of decision.dependsOn) {
      assert.ok(planOrder.has(dependency), `${decision.id} dependency is represented in the presentation plan`);
      assert.ok(planOrder.get(dependency) <= planOrder.get(decision.id), `${dependency} precedes ${decision.id}`);
    }
    assert.deepEqual(second.decisions.map(({id,kind,rule,result,locants})=>({id,kind,rule,result,locants})),
      first.decisions.map(({id,kind,rule,result,locants})=>({id,kind,rule,result,locants})));
    for (const language of ["en", "es"]) {
      assert.deepEqual(renderPedagogicalDecisionPlan(second.decisions,second.plan,language).map(item=>[item.title,item.explanation]),
        renderPedagogicalDecisionPlan(first.decisions,first.plan,language).map(item=>[item.title,item.explanation]));
    }
  }
});
