import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { resolveDerivationConsistency } from "../app/derivation-consistency.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { analyzeStructuralEquivalence, deriveStructuralComponents, regionsFormOrbit } from "../app/structural-derivation.ts";
import {cases} from "./fixtures/complex-nitrogen-cases.mjs";
for(const [name,smiles] of cases)test(name+" has bilingual current-profile proofs invariant under ID permutation",()=>{
  const imported=moleculeFromSmiles(smiles);assert.ok(imported.ok);
  const graph=imported.molecule, rename=id=>100+id*11;
  const permuted={atoms:[...graph.atoms].reverse().map(a=>({...a,id:rename(a.id)})),bonds:[...graph.bonds].reverse().map(([a,b,o])=>[rename(b),rename(a),o])};
  const en=reconcileSystematicName(graph,name);assert.equal(en?.status,"FULL",name);
  const es=presentValidatedSystematicName(en,"es");assert.ok(es.localized);
  for(const [language,activeName] of [["en",name],["es",es.name]]){
    const result=resolveDerivationConsistency({molecule:graph,activeName,language,activeProfile:"current"});
    assert.equal(result.derivation?.status,"FULL",activeName);assert.equal(result.derivation.preferred,false);
    assert.equal(result.derivation.evidence.language,language);
    assert.equal(resolveDerivationConsistency({molecule:graph,activeName,language,activeProfile:"legacy"}).derivation,null);
    const other=reconcileSystematicName(permuted,activeName);assert.equal(other?.status,"FULL");
    for(const c of result.derivation.components){
      assert.equal(activeName.slice(c.start,c.end),c.text);
      for(const l of c.writtenLocants??[])assert.equal(activeName.slice(l.start,l.end),String(l.locant));
      const second=other.components.find(x=>x.id===c.id);
      assert.deepEqual(new Set(second.atomIds),new Set(c.atomIds.map(rename)));
      const edges=(bonds,transform)=>new Set(bonds.map(([a,b])=>[transform(a),transform(b)].sort((x,y)=>x-y).join(":")));
      assert.deepEqual(edges(second.bondIds,x=>x),edges(c.bondIds,rename));
    }
    const model=buildValidatedPriorityReasoning({graph,derivation:result.derivation,language,activeName});
    assert.ok(model.steps.some(s=>s.title===(language==="es"?"Construcción del nombre":"Constructing the name")));
    const text=model.steps.map(s=>s.explanation).join(" ");
    assert.doesNotMatch(text,/undefined|NaN/);
  }
});
test("literal names with wrong position, parent, multiplier, citation or grouping fail",()=>{
  for(const [idx,bad] of [[0,"N-methyl-3-phenyl-3-[5-(trifluoromethyl)phenoxy]propan-1-amine"],
    [0,"N-metil-3-fenil-3-[4-(trifluorometil)fenoxi]propan-1-amina"],[1,"2-(diphenylmethoxy)-N-methylethan-1-amine"],
    [1,"N,N-dimethyl-2-(diphenylmethoxy)ethan-1-amine"],[4,"3-(6-chlorophenoxy)propan-1-amine"],
    [10,"2-(diethylamino)-N-(2,5-dimethylphenyl)acetamide"],[10,"N-(2,6-dimethylphenyl)-2-(diethylamino)acetamide"],
    [10,"2-(ethylamino)-N-(2,6-dimethylphenyl)acetamide"],[15,"5-(2-aminoethyl)benzene-1,2-diol"]])
    assert.equal(reconcileSystematicName(moleculeFromSmiles(cases[idx][1]).molecule,bad),null,bad);
  for(const [name,smiles] of [cases[0],cases[10]]) {
    const graph=moleculeFromSmiles(smiles).molecule;
    graph.atoms.find(a=>a.element==="N").charge=1;assert.equal(reconcileSystematicName(graph,name),null);
    graph.atoms.find(a=>a.element==="N").charge=0;graph.atoms[0].tetrahedralParity="R";
    assert.equal(reconcileSystematicName(graph,name),null);
  }
});
test("whole-graph automorphisms distinguish equal-sized and inequivalent regions",()=>{
  const graph=moleculeFromSmiles("CCN(CC)CC(=O)Nc1c(C)cccc1C").molecule;
  const {mappings}=analyzeStructuralEquivalence(graph,graph);
  assert.ok(regionsFormOrbit([[1,2],[4,5]],mappings));
  assert.equal(regionsFormOrbit([[3],[9]],mappings),false);
  assert.equal(regionsFormOrbit([[1],[12]],mappings),false);
});

test("FULL retains the ether bridge from structural reasoning alongside the compound phenoxy target",()=>{
  const [name,smiles]=cases[0], graph=moleculeFromSmiles(smiles).molecule;
  const structuralEvidence=deriveStructuralComponents(graph,"");
  const ether=structuralEvidence.components.find(c=>c.kind==="ether linkage");
  assert.ok(ether);
  const proof=reconcileSystematicName(graph,name);
  const step=buildValidatedPriorityReasoning({graph,derivation:proof,language:"en",activeName:name,structuralEvidence})
    .steps.find(s=>s.title==="Composition of substituents");
  const controls=[step.fragments,...step.fragments.additionalFragments];
  const bridges=controls.filter(c=>c.semanticId===ether.id);
  assert.equal(bridges.length,1);
  assert.deepEqual(new Set(bridges[0].atomIds),new Set([5,12,13]));
  assert.deepEqual(new Set(bridges[0].bondIds.map(([a,b])=>[a,b].sort((x,y)=>x-y).join(":"))),new Set(["5:12","12:13"]));
  assert.ok(controls.find(c=>c.semanticId==="phenoxy").atomIds.length>bridges[0].atomIds.length);
});
