import assert from "node:assert/strict";
import test from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { buildPedagogicalNameInventory } from "../app/pedagogical-name-inventory.ts";
import { parentStemDecision, scopedNameAssemblyDecision } from "../app/name-construction-pedagogy.ts";
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

test("scope composition is reusable while complete assembly waits for missing constituents",()=>{
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
        assert.equal(model.coverage.componentCoverage.find(c=>c.componentId==="name.assembly").status,"unexplained");
        assert.equal(model.coverage.coverage,"partial");
      } else assert.equal(model.coverage.coverage,"unverified");
      assert.equal(model.coverage.chemicalStatus,"FULL");
      if(language==="es" && name.includes("trifluoromethyl")) {
        const projected=buildValidatedPriorityReasoning({derivation:source,graph,language,activeName});
        assert.ok(projected.steps.find(s=>s.decisionIds?.includes("name.scoped-assembly"))
          .advancedExplanation.includes("3-fenil + N-metil"),"the localized composition uses its own verified citation order");
      }
    }
  }
});
