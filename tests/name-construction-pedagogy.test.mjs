import assert from "node:assert/strict";
import test from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { buildPedagogicalNameInventory } from "../app/pedagogical-name-inventory.ts";
import { completeNameAssemblyDecision, parentStemDecision, scopedNameAssemblyDecision } from "../app/name-construction-pedagogy.ts";
import { auditPedagogicalCoverage } from "../app/pedagogical-decision-model.ts";
import { PROGESTERONE_REFERENCE_SMILES, PROGESTERONE_NAMES } from "../app/progesterone-stereo-grammar.ts";

test("one parent-form rule explains exact steroid and fused aromatic stems in both languages",()=>{
  for(const [smiles,en,es] of [[PROGESTERONE_REFERENCE_SMILES,PROGESTERONE_NAMES.en,PROGESTERONE_NAMES.es],
    ["Oc1ccc2ccccc2c1","naphthalen-2-ol","naftalen-2-ol"]]) {
    const graph=moleculeFromSmiles(smiles).molecule;
    for(const [language,name] of [["en",en],["es",es]]) {
      const derivation=reconcileSystematicName(graph,name),inventory=buildPedagogicalNameInventory(derivation,graph);
      const decision=parentStemDecision(inventory,"verified-parent");
      assert.ok(decision);
      const component=inventory.components.find(c=>c.id==="parent.stem");
      assert.equal(name.slice(component.start,component.end),decision.result);
      assert.deepEqual(decision.atomIds,derivation.components.find(c=>c.id==="parent").atomIds);
      assert.ok(decision.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
      const model=buildValidatedPriorityReasoning({derivation,graph,language,activeName:name});
      assert.ok(model.steps[0].advancedExplanation.includes(decision.explanation[language]));
      assert.equal(model.coverage.componentCoverage.find(c=>c.componentId==="parent.stem").status,"explained");
      assert.equal(derivation.status,"FULL");
    }
  }
});

test("scope composition and complete assembly follow verified component coverage",()=>{
  for(const [smiles,name] of [
    ["CC(=O)Nc1ccc(O)cc1","N-(4-hydroxyphenyl)acetamide"],
    ["CNCCC(c1ccccc1)Oc1ccc(C(F)(F)F)cc1","N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine"],
  ]) {
    const graph=moleculeFromSmiles(smiles).molecule,source=reconcileSystematicName(graph,name);
    const inventory=buildPedagogicalNameInventory(source,graph);
    const decision=scopedNameAssemblyDecision(source,inventory,graph);
    assert.ok(decision);
    assert.equal(decision.rule,"enclosing-prefixes-and-suffix-bearing-parent");
    assert.deepEqual(decision.atomIds,graph.atoms.map(a=>a.id));
    for(const language of ["en","es"]) {
      const activeName=presentValidatedSystematicName(source,language).name;
      const derivation=reconcileSystematicName(graph,activeName)??source;
      const model=buildValidatedPriorityReasoning({derivation,graph,language,activeName});
      const step=model.steps.find(s=>s.decisionIds?.includes("name.scoped-assembly"));
      assert.ok(step?.advancedExplanation);
      if(model.coverage.inventory.components.length) {
        assert.equal(model.coverage.componentCoverage.find(c=>c.componentId==="name.scopes").status,"explained");
        assert.equal(model.coverage.chemicalStatus,"FULL");
        assert.equal(model.coverage.coverage,"complete");
        assert.equal(model.coverage.componentCoverage.length,name.includes("trifluoromethyl")?16:8);
        assert.ok(model.coverage.componentCoverage.every(c=>c.status==="explained"));
        assert.ok(model.coverage.availableDecisions.includes("name.complete-assembly"));
        assert.ok(model.coverage.explainedDecisions.includes("name.complete-assembly"));
        const completeStep=model.steps.find(s=>s.decisionIds?.includes("name.complete-assembly"));
        assert.ok(completeStep?.advancedExplanation?.includes(language==="en"?"already explained intervals":"intervalos ya explicados"));
        const assembly=model.coverage.inventory.components.find(c=>c.id==="name.assembly");
        assert.deepEqual(assembly.dependsOn,model.coverage.inventory.components
          .filter(c=>c.id!=="name.assembly").map(c=>c.id));
      } else {
        assert.equal(model.coverage.coverage,"unverified");
        assert.equal(model.coverage.chemicalStatus,"FULL");
        assert.equal(model.coverage.inventory.limitations.includes("active-name-has-no-verified-component-offsets"),true);
        assert.ok(!model.steps.some(s=>s.decisionIds?.includes("name.complete-assembly")));
      }
      assert.equal(model.coverage.chemicalStatus,"FULL");
      if(language==="es" && name.includes("trifluoromethyl")) {
        const projected=buildValidatedPriorityReasoning({derivation:source,graph,language,activeName});
        assert.ok(projected.steps.find(s=>s.decisionIds?.includes("name.scoped-assembly"))
          .advancedExplanation.includes("3-fenil + N-metil"),"the localized composition uses its own verified citation order");
      }
    }
  }
});

test("complete assembly is withheld for a missing, misbound, or unpresented component decision",()=>{
  const graph=moleculeFromSmiles("CC(=O)Nc1ccc(O)cc1").molecule;
  const derivation=reconcileSystematicName(graph,"N-(4-hydroxyphenyl)acetamide");
  const inventory=buildPedagogicalNameInventory(derivation,graph);
  const components=inventory.components.filter(c=>c.aspect!=="assembly");
  const decisions=components.map(component=>({
    id:`test.${component.id}`,kind:component.aspect==="scope"?"scope-composition":component.aspect==="stem"?"parent-stem":"substituent-recognition",
    family:"test-independent-evidence",rule:"exact-component-evidence",evidenceSource:"verified component structure and interval",
    atomIds:[...component.atomIds],bondIds:component.bondIds.map(([a,b])=>[a,b]),locants:[...component.locants],
    numberingScope:component.numberingScope,result:component.text,explanation:{en:`Evidence for ${component.id}`,es:`Evidencia para ${component.id}`},
    nameFragments:[],componentBindings:[{id:component.id,start:component.start,end:component.end,
      aspect:component.aspect,numberingScope:component.numberingScope}],dependsOn:[],verification:"verified"}));
  const steps=decisions.map(decision=>({explanation:decision.explanation.en,decisionIds:[decision.id]}));
  const complete=completeNameAssemblyDecision(derivation,inventory,graph,decisions,steps);
  assert.ok(complete);
  assert.deepEqual(complete.dependsOn,decisions.map(decision=>decision.id));
  assert.equal(complete.componentBindings[0].id,"name.assembly");

  const omittedId="aryl.attachment-locant";
  const missing=decisions.filter(decision=>decision.id!==`test.${omittedId}`);
  const missingSteps=steps.filter(step=>step.decisionIds[0]!==`test.${omittedId}`);
  assert.equal(completeNameAssemblyDecision(derivation,inventory,graph,missing,missingSteps),null);

  const wrongBinding=decisions.map(decision=>decision.id===`test.${omittedId}`
    ? {...decision,componentBindings:[{...decision.componentBindings[0],start:decision.componentBindings[0].start+1}]} : decision);
  assert.equal(completeNameAssemblyDecision(derivation,inventory,graph,wrongBinding,steps),null);

  const unpresentedSteps=steps.filter(step=>step.decisionIds[0]!==`test.${omittedId}`);
  assert.equal(completeNameAssemblyDecision(derivation,inventory,graph,decisions,unpresentedSteps),null);

  const forcedAssembly={...complete};
  const visibleIds=[...missing.flatMap(decision=>decision.id),forcedAssembly.id];
  const visibleSteps=missing.map(decision=>({title:"Evidence",explanation:decision.explanation.en,
    decisionIds:[decision.id],componentIds:[decision.componentBindings[0].id]}));
  visibleSteps.push({title:"Assembly",explanation:forcedAssembly.explanation.en,
    decisionIds:[forcedAssembly.id],componentIds:["name.assembly"]});
  const audit=auditPedagogicalCoverage({name:inventory.name,chemicalStatus:derivation.status,inventory,
    decisions:[...missing,forcedAssembly],plan:[{id:"test",title:{en:"Test",es:"Prueba"},decisionIds:visibleIds,componentIds:[]}],
    steps:visibleSteps,componentIds:inventory.components.map(component=>component.id)});
  assert.equal(audit.componentCoverage.find(component=>component.componentId===omittedId).status,"unexplained");
  assert.equal(audit.componentCoverage.find(component=>component.componentId==="name.assembly").status,"unexplained");
  assert.equal(audit.coverage,"partial");
  assert.equal(audit.chemicalStatus,"FULL");
});
