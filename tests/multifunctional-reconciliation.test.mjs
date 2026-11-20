import assert from "node:assert/strict";
import {test} from "node:test";
import {acids,alcohols,synthetic,previous,variants} from "./fixtures/multifunctional-reconciliation.mjs";
import {moleculeFromSmiles} from "../app/openchemlib-adapter.ts";
import {resolveDerivationConsistency as resolve} from "../app/derivation-consistency.ts";
import {reconcileSystematicName as proof,presentValidatedSystematicName as present} from "../app/validated-name-derivation.ts";
import {buildValidatedPriorityReasoning} from "../app/reasoning-derivation-adapter.ts";
import {analyzeStructuralEquivalence} from "../app/structural-derivation.ts";
for(const [name,smiles] of previous)test("Published FULL: "+name,()=>{
  assert.equal(proof(moleculeFromSmiles(smiles).molecule,name)?.status,"FULL");
});
for(const [family,name,smiles] of [...acids,...alcohols,...synthetic])test(family+" — "+name,()=>{
  const imported=moleculeFromSmiles(smiles);assert.ok(imported.ok);
  const graph=imported.molecule, model=proof(graph,name);
  assert.equal(model?.status,"FULL"); assert.equal(model.preferred,false);
  assert.ok(analyzeStructuralEquivalence(model.evidence.reconstructedGraph,graph));
  const es=present(model,"es");assert.ok(es.localized);
  const remap=id=>111+7*id;
  const permuted={atoms:graph.atoms.toReversed().map(a=>({...a,id:remap(a.id)})),bonds:graph.bonds.toReversed().map(([a,b,o])=>[remap(b),remap(a),o])};
  for(const [language,activeName] of [["en",name],["es",es.name]]){
    const p=resolve({molecule:graph,language,activeName,activeProfile:"current"}).derivation;
    assert.equal(p.status,"FULL");assert.ok(p.evidence.numbering.comparison<=0);
    assert.equal(resolve({molecule:graph,language,activeName,activeProfile:"legacy"}).derivation,null);
    const reasoning=buildValidatedPriorityReasoning({derivation:p,graph,language,activeName});
    const order=reasoning.steps.find(step=>step.alphabeticalOrder)?.alphabeticalOrder;
    if(order){
      const roots=p.components.filter(c=>c.role==="substituent"&&c.parentId==="parent").sort((a,b)=>a.start-b.start);
      assert.deepEqual(order.groups.map(g=>g.comparisonName),roots.map(c=>c.citationKey));
    }
    const other=proof(permuted,activeName);assert.ok(other);
    const map=new Map(other.evidence.atomMapping), original=new Map(p.evidence.atomMapping);
    // Compare the whole assignment modulo one graph automorphism, including equivalent termini.
    const symmetry=analyzeStructuralEquivalence(permuted,permuted);
    assert.ok(symmetry.mappings.some(m=>[...original].every(([id,target])=>m.get(remap(target))===map.get(id))));
    for(const c of p.components){
      assert.equal(activeName.slice(c.start,c.end),c.text);
      for(const l of c.writtenLocants??[])assert.equal(activeName.slice(l.start,l.end),String(l.locant));
      assert.ok(c.atomIds.every(id=>graph.atoms.some(a=>a.id===id)));
      assert.ok(c.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
    }
    if(p.principalGroup==="carboxylicAcid"){
      const groups=p.components.filter(c=>c.id.startsWith("carboxyl-"));
      assert.equal(groups.length,name.includes("tricarboxylic")?3:2);
      assert.ok(groups.every(c=>c.atomIds.length===3&&c.bondIds.length===2));
      assert.deepEqual(new Set(groups.flatMap(c=>c.atomIds)),new Set(p.components.find(c=>c.id==="suffix").atomIds));
    }
  }
});
test("Enclosures, profile, parent, locants, missing groups and stereo",()=>{
  const [e,s,v,m]=alcohols;
  for(const [row,bad] of [[e,e[1].replace("1R","1S")],[e,e[1].replace("1-hydroxy-","")],
    [s,s[1].replace("2-(hydroxymethyl)","6-(hydroxymethyl)")],[v,v[1].replace("4-methoxy","3-methoxy")],
    [m,m[1].replace("propan-2-ol","propan-1-ol")],[m,"3-(propan-2-ylamino)-1-[4-(2-methoxyethyl)phenoxy]propan-2-ol"],
    [acids[0],"3-carboxy-3-hydroxypentanedioic acid"],[acids[2],acids[2][1].replace("3R","3S")],
    [acids[5],"3-methylbutanedioic acid"],[acids[1],acids[1][1].replace("(2S)-","")]]){
    assert.equal(proof(moleculeFromSmiles(row[2]).molecule,bad),null,bad);
  }
  const [,name,smiles]=variants[0], g=moleculeFromSmiles(smiles).molecule;
  assert.equal(proof(g,name)?.status,"FULL");
  for(const bad of [name.replace("5-prop","5-(prop"),name.replace("2-yl","1-yl"),name.replace("1-en","2-en")])
    assert.equal(proof(g,bad),null,bad);
  assert.equal(resolve({molecule:g,activeName:name,language:"en",activeProfile:"legacy"}).derivation,null);
  const tntGraph=moleculeFromSmiles(variants[1][2]).molecule,tntProof=proof(tntGraph,variants[1][1]);
  assert.equal(tntProof?.status,"FULL");assert.equal(tntProof?.preferred,false);
  assert.equal(tntProof?.evidence?.construction,"polysubstituted-benzene-prefixes");
  assert.equal(resolve({molecule:tntGraph,activeName:variants[1][1],language:"en",activeProfile:"legacy"}).derivation,null);
});
