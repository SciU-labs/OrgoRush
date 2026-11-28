import assert from "node:assert/strict";
import test from "node:test";
import { auditPedagogicalCoverage, renderPedagogicalDecisionPlan } from "../app/pedagogical-decision-model.ts";
import { nameComponentBinding, buildPedagogicalNameInventory } from "../app/pedagogical-name-inventory.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";

function example() {
  // Two equal written groups with distinct graph identities.
  const name = "1-methyl-2-methyl";
  const components = [[2,8,11],[11,17,12]].map(([start,end,atom],i)=>({
    id:"branch-"+i,role:"substituent",aspect:"identity",text:"methyl",start,end,
    numberingScope:"parent",locants:[i+1],dependsOn:[],atomIds:[atom],bondIds:[],evidence:"available",
  }));
  const inventory = {name,sourceName:name,components,syntax:[],limitations:[]};
  const decisions = components.map((component,i)=>({id:"decision-"+i,kind:"substituent-recognition",family:"alkyl",
    rule:"mapped-alkyl-identity",evidenceSource:"reconciled-component",atomIds:component.atomIds,bondIds:[],
    locants:component.locants,result:"methyl",explanation:{en:"One methyl group.",es:"Un grupo metilo."},
    nameFragments:["methyl"],dependsOn:[],verification:"verified",componentBindings:[nameComponentBinding(component)]}));
  const steps = decisions.map(d=>({title:"group",explanation:d.explanation.en,componentIds:[],decisionIds:[d.id]}));
  return {name,chemicalStatus:"FULL",decisions,plan:[],steps,componentIds:[],inventory};
}
const audit = change => {const input=example();change?.(input);return auditPedagogicalCoverage(input);};

test("independent expected components are explained only by their exact presented bindings",()=>{
  const result=audit();
  assert.equal(result.coverage,"complete");
  assert.deepEqual(result.componentCoverage.map(c=>c.status),["explained","explained"]);
});
test("omitting a component decision cannot hide an expected component",()=>{
  const result=audit(i=>{i.decisions.pop();i.steps.pop();});
  assert.equal(result.coverage,"partial");
  assert.equal(result.componentCoverage[1].status,"unexplained");
  assert.equal(result.chemicalStatus,"FULL");
});
test("repeated text assigned to the other graph group does not explain it",()=>{
  const result=audit(i=>{i.decisions[1].atomIds=[11];});
  assert.equal(result.componentCoverage[1].status,"unexplained");
  assert.notEqual(result.coverage,"complete");
});
test("a copied binding cannot transfer an equal fragment to another interval",()=>{
  const result=audit(i=>{i.decisions[1].componentBindings=[{...i.decisions[0].componentBindings[0],id:"branch-1"}];});
  assert.equal(result.componentCoverage[1].status,"unexplained");
});
test("parent and branch locants remain different scopes",()=>{
  const result=audit(i=>{
    const c=i.inventory.components[1];
    Object.assign(c,{aspect:"locants",text:"2",start:9,end:10,numberingScope:"aryl",locants:[2]});
    Object.assign(i.decisions[1],{kind:"attachment-locants",numberingScope:"parent",locants:[2],
      componentBindings:[nameComponentBinding(c)]});
  });
  assert.equal(result.componentCoverage[1].status,"unexplained");
});
test("invalid intervals and a changed active name cannot reuse complete coverage",()=>{
  assert.equal(audit(i=>{i.inventory.components[1].end=100;}).coverage,"unverified");
  const changed=audit(i=>{i.name="2-methyl-1-methyl";});
  assert.equal(changed.coverage,"unverified");
  assert.ok(changed.coveredNameFragments.every(c=>c.fragments.length===0));
});
test("available decisions require presentation, and graph evidence remains a separate requirement",()=>{
  assert.notEqual(audit(i=>{i.steps.pop();}).coverage,"complete");
  const insufficient=audit(i=>{i.inventory.components[1].evidence="insufficient";});
  assert.equal(insufficient.componentCoverage[1].status,"insufficient-evidence");
  assert.notEqual(insufficient.coverage,"complete");
});
test("generated decisions and generic assembly cannot establish coverage without a trustworthy inventory",()=>{
  assert.equal(audit(i=>{delete i.inventory;}).coverage,"unverified");
  const assembly=audit(i=>{i.decisions.forEach(d=>{d.kind="name-assembly";});});
  assert.notEqual(assembly.coverage,"complete");
});
test("an empty explanation cannot inherit presentation from another decision in the same step",()=>{
  const input=example();
  input.decisions[0].explanation.en="";
  input.plan=[{id:"groups",title:{en:"Groups",es:"Grupos"},decisionIds:input.decisions.map(d=>d.id),componentIds:[]}];
  input.steps=renderPedagogicalDecisionPlan(input.decisions,input.plan,"en");
  assert.deepEqual(input.steps[0].decisionIds,["decision-1"]);
  assert.equal(auditPedagogicalCoverage(input).componentCoverage[0].status,"unexplained");
  const blank=example();
  blank.steps.forEach(step=>{step.explanation="";});
  assert.equal(auditPedagogicalCoverage(blank).coverage,"none");
});
test("inventories use reconciled offsets and expose unavailable localized offsets",()=>{
  const graph=moleculeFromSmiles("CC(=O)Nc1ccc(O)cc1").molecule;
  const proof=reconcileSystematicName(graph,"N-(4-hydroxyphenyl)acetamide");
  const original=buildPedagogicalNameInventory(proof,graph);
  assert.ok(original.components.length);
  assert.ok(original.components.every(c=>proof.name.slice(c.start,c.end)===c.text));
  const localized=buildPedagogicalNameInventory(proof,graph,"N-(4-hidroxifenil)acetamida");
  assert.deepEqual(localized.components,[]);
  assert.ok(localized.limitations.includes("active-name-has-no-verified-component-offsets"));
});
