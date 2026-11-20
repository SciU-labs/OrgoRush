import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { presentValidatedSystematicName, reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { resolveDerivationConsistency } from "../app/derivation-consistency.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";

const cases=[
  ["2-methyl-1,3,5-trinitrobenzene","Cc1c([N+](=O)[O-])cc([N+](=O)[O-])cc1[N+](=O)[O-]"],
  ["1-chloro-2,4-dimethyl-5-nitrobenzene","Clc1c(C)cc(C)c([N+](=O)[O-])c1"],
  ["1,3,5-trichloro-2-ethyl-4-methoxybenzene","Clc1c(CC)c(Cl)c(OC)c(Cl)c1"],
  ["1-bromo-2-chloro-4-iodo-5-methylbenzene","Brc1c(Cl)cc(I)c(C)c1"],
  ["1,5-dimethyl-2-nitro-4-(trifluoromethyl)benzene","FC(F)(F)c1c(C)cc(C)c([N+](=O)[O-])c1"],
  ["1-(4-chlorophenoxy)-2-methyl-4-nitrobenzene","Clc1ccc(Oc2c(C)cc([N+](=O)[O-])cc2)cc1"],
];
const remap=id=>100+id*11;
const edgeKey=([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":");

for(const [name,smiles] of cases)test(`${name} reconciles as complete current-profile prefix nomenclature`,()=>{
  const imported=moleculeFromSmiles(smiles);assert.ok(imported.ok);
  const graph=imported.molecule,derivation=reconcileSystematicName(graph,name);
  assert.equal(derivation?.status,"FULL",name);
  assert.equal(derivation?.preferred,false);
  assert.equal(derivation?.evidence?.construction,"polysubstituted-benzene-prefixes");
  assert.equal(derivation?.evidence?.profile,"current");
  assert.equal(resolveDerivationConsistency({molecule:graph,activeName:name,activeProfile:"legacy",language:"en"}).status,"profile-mismatch");
  const permuted={atoms:[...graph.atoms].reverse().map(atom=>({...atom,id:remap(atom.id)})),
    bonds:[...graph.bonds].reverse().map(([a,b,order])=>[remap(b),remap(a),order])};
  const other=reconcileSystematicName(permuted,name);assert.equal(other?.status,"FULL",`${name} under atom permutation`);
  for(const component of derivation.components){
    assert.equal(name.slice(component.start,component.end),component.text,component.id);
    assert.ok(component.atomIds.every(id=>graph.atoms.some(atom=>atom.id===id)),component.id);
    assert.ok(component.bondIds.every(edge=>graph.bonds.some(bond=>edgeKey(bond)===edgeKey(edge))),component.id);
    const mapped=other.components.find(item=>item.id===component.id);assert.ok(mapped,component.id);
    if(!name.includes("trinitro")||!component.id.includes("occurrence"))
      assert.deepEqual(new Set(mapped.atomIds),new Set(component.atomIds.map(remap)),component.id);
  }
  const english=presentValidatedSystematicName(derivation,"en"),spanish=presentValidatedSystematicName(derivation,"es");
  assert.equal(english.name,name);assert.equal(reconcileSystematicName(graph,spanish.name)?.status,"FULL");
  const model=buildValidatedPriorityReasoning({graph,derivation,language:"en",activeName:name});
  const allControls=model.steps.flatMap(step=>[step.fragments,...(step.fragments?.additionalFragments??[])]).filter(Boolean);
  const aggregate=allControls.find(fragment=>fragment.semanticId==="prefix-0");assert.ok(aggregate,name);
  if(name.includes("trinitro")){
    const nitroPrefix=derivation.components.find(component=>component.role==="prefix"&&component.text.includes("trinitro"));
    assert.ok(nitroPrefix);
    assert.equal(nitroPrefix.label,"nitro groups (×3)");
    const nitroOccurrences=derivation.components.filter(component=>component.parentId===nitroPrefix.id&&component.role==="substituent");
    assert.equal(nitroPrefix.atomIds.length,9,"combined trinitro selection contains 3 N and 6 O");
    const individual=[...new Map(allControls.filter(fragment=>nitroOccurrences.some(component=>component.id===fragment.semanticId))
      .map(fragment=>[fragment.semanticId,fragment])).values()];
    assert.equal(individual.length,3);
    for(const fragment of individual){
      assert.equal(fragment.atomIds.length,3);
      assert.equal(fragment.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="N").length,1);
      assert.equal(fragment.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O").length,2);
    }
    const parent=allControls.find(fragment=>fragment.semanticId==="parent");assert.equal(parent.atomIds.length,6);
    const spanishProof=reconcileSystematicName(graph,spanish.name);
    const spanishModel=buildValidatedPriorityReasoning({graph,derivation:spanishProof,language:"es",activeName:spanish.name});
    const spanishNitro=spanishModel.steps.flatMap(step=>[step.fragments,...(step.fragments?.additionalFragments??[])]).filter(fragment=>fragment?.semanticId==="prefix-1");
    assert.ok(spanishNitro.every(fragment=>fragment.label==="Grupos nitro (×3)"));
  }
});

test("TNT rejects incompatible locants, omitted or additional groups, and citation order",()=>{
  const graph=moleculeFromSmiles(cases[0][1]).molecule;
  for(const name of [
    "2-methyl-1,3,4-trinitrobenzene",
    "6-methyl-1,3,5-trinitrobenzene",
    "2-methyl-1,3-dinitrobenzene",
    "2-ethyl-2-methyl-1,3,5-trinitrobenzene",
    "1,3,5-trinitro-2-methylbenzene",
  ])assert.equal(reconcileSystematicName(graph,name),null,name);
});

test("TNT name control has the exact nitro atom and attachment-bond regions",()=>{
  const graph=moleculeFromSmiles(cases[0][1]).molecule,proof=reconcileSystematicName(graph,cases[0][0]);assert.ok(proof);
  const combined=proof.components.find(component=>component.role==="prefix"&&component.text.includes("trinitro"));assert.ok(combined);
  const nitro=proof.components.filter(component=>component.parentId===combined.id&&component.role==="substituent");
  assert.equal(nitro.length,3);
  assert.deepEqual(new Set(nitro.flatMap(component=>component.atomIds)),new Set(combined.atomIds));
  assert.equal(combined.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="N").length,3);
  assert.equal(combined.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O").length,6);
  const attachments=combined.bondIds.filter(([a,b])=>graph.atoms.find(atom=>atom.id===a)?.element==="C"&&graph.atoms.find(atom=>atom.id===b)?.element==="N"
    ||graph.atoms.find(atom=>atom.id===a)?.element==="N"&&graph.atoms.find(atom=>atom.id===b)?.element==="C");
  assert.equal(attachments.length,3);
});
