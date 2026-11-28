import assert from "node:assert/strict";
import test from "node:test";
import { auditPedagogicalCoverage, renderPedagogicalDecisionPlan } from "../app/pedagogical-decision-model.ts";
import { nameComponentBinding, buildPedagogicalNameInventory } from "../app/pedagogical-name-inventory.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { presentedComponentDecisions } from "../app/component-pedagogy-evidence.ts";
import { completeNameAssemblyDecision } from "../app/name-construction-pedagogy.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";

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

test("N,N locants bind the exact repeated token only when both substituents bond to the amine nitrogen",()=>{
  const graph=moleculeFromSmiles("CN(C)CCc1ccccc1").molecule;
  const derivation=reconcileSystematicName(graph,"N,N-dimethyl-2-phenylethan-1-amine");
  assert.equal(derivation?.evidence?.construction,"acyclic-aryl-amine");
  const inventory=buildPedagogicalNameInventory(derivation,graph);
  const expected=inventory.components.find(c=>c.id==="n-alkyl.locants");
  assert.deepEqual(expected?.locants,["N","N"]);
  assert.equal(derivation.name.slice(expected.start,expected.end),"N,N");
  const steps=[{title:"Substituents",explanation:"The two methyl groups attach to the suffix nitrogen.",componentIds:["n-alkyl"],decisionIds:[]}];
  const decisions=presentedComponentDecisions(derivation,inventory,steps,"en",graph);
  const decision=decisions.find(d=>d.rule==="N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen");
  assert.ok(decision);
  assert.deepEqual(decision.componentBindings,[nameComponentBinding(expected)]);
  assert.equal(decision.bondIds.length,2);
  assert.ok(decision.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
  assert.ok(decision.explanation.en.includes("no numeric locant in the parent map"));
  const result=auditPedagogicalCoverage({name:derivation.name,chemicalStatus:"FULL",decisions,plan:[],steps,componentIds:[],inventory});
  assert.equal(result.componentCoverage.find(c=>c.componentId==="n-alkyl.locants").status,"explained");
  const expectedMultiplier=inventory.components.find(c=>c.id==="n-alkyl.multiplier");
  const multiplicity=decisions.find(d=>d.rule==="multiplier-counts-distinct-branches-attached-to-functional-nitrogen");
  assert.ok(multiplicity);
  assert.deepEqual(multiplicity.componentBindings,[nameComponentBinding(expectedMultiplier)]);
  assert.equal(multiplicity.bondIds.length,2);
  assert.match(multiplicity.explanation.en,/2 distinct methyl branches/);
  const unrelated={...derivation,components:derivation.components.map(c=>c.id==="n-alkyl"?{...c,
    attachmentBonds:[[c.atomIds[0],derivation.components.find(x=>x.id==="parent").atomIds[0]]]}:c)};
  const rejected=presentedComponentDecisions(unrelated,inventory,[{...steps[0],decisionIds:[]}],"en",graph);
  assert.ok(!rejected.some(d=>d.rule==="N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen"));
  assert.ok(!rejected.some(d=>d.rule==="multiplier-counts-distinct-branches-attached-to-functional-nitrogen"));
});

test("amide N attachment binds its parent-scope token without absorbing aryl locants",()=>{
  const graph=moleculeFromSmiles("CC(=O)Nc1ccc(O)cc1").molecule;
  const derivation=reconcileSystematicName(graph,"N-(4-hydroxyphenyl)acetamide");
  const inventory=buildPedagogicalNameInventory(derivation,graph);
  const expected=inventory.components.find(c=>c.id==="aryl.attachment-locant");
  const arylLocants=inventory.components.find(c=>c.id==="aryl.locants");
  assert.equal(expected.numberingScope,"parent");
  assert.deepEqual(expected.locants,["N"]);
  assert.equal(arylLocants.numberingScope,"aryl");
  const steps=[{title:"Substituents",explanation:"The aryl group attaches to the amide nitrogen.",componentIds:["aryl"],decisionIds:[]}];
  const decisions=presentedComponentDecisions(derivation,inventory,steps,"en",graph);
  const decision=decisions.find(d=>d.rule==="N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen");
  assert.ok(decision);
  assert.deepEqual(decision.componentBindings,[nameComponentBinding(expected)]);
  assert.equal(decision.bondIds.length,1);
  assert.ok(decision.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
  assert.ok(!decision.componentBindings.some(binding=>binding.id===arylLocants.id));
  const altered={...derivation,components:derivation.components.map(c=>c.id==="aryl"?{...c,
    bondIds:[c.bondIds.find(([a,b])=>c.atomIds.includes(a)&&c.atomIds.includes(b))]}:c)};
  const rejected=presentedComponentDecisions(altered,inventory,[{...steps[0],decisionIds:[]}],"en",graph);
  assert.ok(!rejected.some(d=>d.rule==="N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen"));
});

test("the same N rules generalize to diphenhydramine and a second N-aryl amide",()=>{
  const cases=[
    ["CN(C)CCOC(c1ccccc1)c1ccccc1","2-(diphenylmethoxy)-N,N-dimethylethan-1-amine","n-alkyl","n-alkyl.locants"],
    ["CCN(CC)CC(=O)Nc1c(C)cccc1C","2-(diethylamino)-N-(2,6-dimethylphenyl)acetamide","branch-17","branch-17.locants"],
  ];
  for(const [smiles,name,groupId,locantId] of cases){
    const graph=moleculeFromSmiles(smiles).molecule,derivation=reconcileSystematicName(graph,name);
    const inventory=buildPedagogicalNameInventory(derivation,graph);
    const expected=inventory.components.find(c=>c.id===locantId);
    const steps=[{title:"Substituents",explanation:"The substituent attachment is identified.",componentIds:[groupId],decisionIds:[]}];
    const decisions=presentedComponentDecisions(derivation,inventory,steps,"en",graph);
    const nDecision=decisions.find(d=>d.rule==="N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen");
    assert.ok(nDecision,name);
    assert.deepEqual(nDecision.componentBindings,[nameComponentBinding(expected)]);
    assert.equal(nDecision.numberingScope,"parent");
    assert.ok(nDecision.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
    if(name.startsWith("2-(diphenyl"))
      assert.ok(decisions.some(d=>d.rule==="multiplier-counts-distinct-branches-attached-to-functional-nitrogen"));
  }
});

test("N-locant and multiplier evidence survives graph atom-ID remapping and edge reordering",()=>{
  const graph=moleculeFromSmiles("CN(C)CCc1ccccc1").molecule;
  const derivation=reconcileSystematicName(graph,"N,N-dimethyl-2-phenylethan-1-amine");
  const remap=new Map(graph.atoms.map(atom=>[atom.id,atom.id*37+1000]));
  const remappedGraph={...graph,atoms:graph.atoms.map(atom=>({...atom,id:remap.get(atom.id)})).reverse(),
    bonds:graph.bonds.map(([a,b])=>[remap.get(b),remap.get(a)]).reverse()};
  const mapIds=ids=>ids.map(id=>remap.get(id));
  const mapBonds=bonds=>bonds.map(([a,b])=>[remap.get(a),remap.get(b)]);
  const remappedDerivation={...derivation,components:derivation.components.map(component=>({...component,
    atomIds:mapIds(component.atomIds),bondIds:mapBonds(component.bondIds),
    attachmentBonds:component.attachmentBonds?mapBonds(component.attachmentBonds):undefined,
    numbering:component.numbering.map(([id,n])=>[remap.get(id),n]),
    internalNumbering:component.internalNumbering?.map(([id,n])=>[remap.get(id),n]),
    writtenLocants:component.writtenLocants?.map(locant=>({...locant,atomId:remap.get(locant.atomId)})),
  }))};
  const inventory=buildPedagogicalNameInventory(derivation,graph),remappedInventory=buildPedagogicalNameInventory(remappedDerivation,remappedGraph);
  const step=[{title:"Substituents",explanation:"The N-bound groups are identified.",componentIds:["n-alkyl"],decisionIds:[]}];
  const original=presentedComponentDecisions(derivation,inventory,step,"en",graph);
  const remapped=presentedComponentDecisions(remappedDerivation,remappedInventory,[{...step[0],decisionIds:[]}],"en",remappedGraph);
  for(const rule of ["N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen","multiplier-counts-distinct-branches-attached-to-functional-nitrogen"]){
    const left=original.find(decision=>decision.rule===rule),right=remapped.find(decision=>decision.rule===rule);
    assert.ok(left&&right,rule);
    assert.deepEqual(right.componentBindings,left.componentBindings);
    assert.equal(right.bondIds.length,left.bondIds.length);
    assert.ok(right.bondIds.every(([a,b])=>remappedGraph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
  }
});

test("tri counts three distinct halogens on one carbon in the nested substituent scope",()=>{
  const graph=moleculeFromSmiles("CNCCC(c1ccccc1)Oc1ccc(C(F)(F)F)cc1").molecule;
  const derivation=reconcileSystematicName(graph,"N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine");
  const inventory=buildPedagogicalNameInventory(derivation,graph);
  const expected=inventory.components.find(c=>c.id==="phenoxy-ring-substituent-halogens.multiplier");
  assert.equal(expected.text,"tri");
  assert.equal(expected.numberingScope,"phenoxy-ring-substituent");
  const steps=[{title:"Substituents",explanation:"The nested halogen fragment is recognized.",componentIds:["phenoxy-ring-substituent-halogens"],decisionIds:[]}];
  const decisions=presentedComponentDecisions(derivation,inventory,steps,"en",graph);
  const decision=decisions.find(d=>d.rule==="multiplier-counts-distinct-halogen-atoms-on-one-carbon");
  assert.ok(decision);
  assert.deepEqual(decision.componentBindings,[nameComponentBinding(expected)]);
  assert.equal(decision.atomIds.filter(id=>expected.atomIds.includes(id)).length,3);
  assert.equal(decision.bondIds.length,3);
  assert.ok(decision.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
  const center=decision.atomIds.find(id=>!expected.atomIds.includes(id));
  assert.equal(graph.atoms.find(atom=>atom.id===center)?.element,"C");
  assert.match(decision.explanation.en,/not mean 3 separate groups on the parent/);
  assert.match(steps[0].advancedExplanation,/3 distinct fluorine atoms/);
  const result=auditPedagogicalCoverage({name:derivation.name,chemicalStatus:"FULL",decisions,plan:[],steps,componentIds:[],inventory});
  assert.equal(result.componentCoverage.find(c=>c.componentId===expected.id).status,"explained");
  const altered={...inventory,components:inventory.components.map(c=>c.id===expected.id?{...c,bondIds:[c.bondIds[0],c.bondIds[0],c.bondIds[2]]}:c)};
  const rejected=presentedComponentDecisions(derivation,altered,[{...steps[0],decisionIds:[]}],"en",graph);
  assert.ok(!rejected.some(d=>d.rule==="multiplier-counts-distinct-halogen-atoms-on-one-carbon"));
});

test("whole-name assembly is explained only after all exact components are independently explained",()=>{
  for(const [smiles,name] of [
    ["CNCCC(c1ccccc1)Oc1ccc(C(F)(F)F)cc1","N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine"],
    ["CC(=O)Nc1ccc(O)cc1","N-(4-hydroxyphenyl)acetamide"],
  ]){
    const graph=moleculeFromSmiles(smiles).molecule;
    const derivation=reconcileSystematicName(graph,name);
    const result=buildValidatedPriorityReasoning({graph,derivation,language:"en",activeName:name});
    assert.equal(result.coverage.coverage,"complete");
    assert.ok(result.coverage.componentCoverage.every(component=>component.status==="explained"));
    const assembly=result.steps.find(step=>step.decisionIds?.includes("name.complete-assembly"));
    assert.ok(assembly);
    assert.match(assembly.advancedExplanation,/exact active name/);
    const inventory=buildPedagogicalNameInventory(derivation,graph);
    assert.equal(completeNameAssemblyDecision(derivation,inventory,graph,[],[]),null);
  }
});
