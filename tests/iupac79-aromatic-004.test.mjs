import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {AROMATIC_004_REFERENCES,AROMATIC_004_LIMITS,aromaticGraph} from "./fixtures/iupac79-aromatic-004.mjs";
import {loadExerciseChemistry} from "./helpers/exercise-chemistry.mjs";
import {translateLegacyEnglishToSpanish,resolveLegacySpanish,verifyLegacyAromaticModel} from "../app/iupac1979-english-to-spanish.ts";
import {generateLegacyEnglishName} from "../app/legacy-english-nomenclature.ts";
import {historicalPrefixKey} from "../app/legacy-name-numbering.ts";
import {legacyGraphsIdentical} from "../app/iupac1979-name-structure.ts";
import {nameRetainedFused1979} from "../app/iupac1979-retained-fused.ts";
import {moleculeFromSmiles,moleculeToSmiles} from "../app/openchemlib-adapter.ts";
import {buildHydrocarbonFromIupacName} from "../app/name-to-molecule.ts";
import {assertReasoningIntegrity} from "./helpers/reasoning-integrity.mjs";
import {cyclicVariants} from "./helpers/cyclic-audit-003.mjs";
import {formatStereochemicalName} from "../app/double-bond-stereochemistry.ts";
import {getMainChainTetrahedralDescriptors} from "../app/tetrahedral-stereochemistry.ts";
import {normalizeChemicalNameForParser} from "../app/iupac-name-normalization.ts";

let chemistry,engine;
before(async()=>{chemistry=await loadExerciseChemistry();engine=chemistry.engine;});
after(async()=>chemistry?.close());
const reference=id=>AROMATIC_004_REFERENCES.find(r=>r.id===id);
const observe=graph=>{const analysis=engine.analyzeMolecule(graph,[],"iupac-1979-legacy");return engine.resolveLegacyNomenclature(graph,analysis);};

test("independent aromatic references: bilingual names, complete identity, selected numbering and explanations",()=>{
  for(const ref of AROMATIC_004_REFERENCES) {
    for(const [variant,graph] of cyclicVariants(aromaticGraph(ref))) {
      const snapshot=structuredClone(graph),result=observe(graph);
      assert.equal(result.spanishResolution.name,ref.es,`${ref.id}/${variant}: ${JSON.stringify(result.spanishResolution)}`);
      assert.equal(result.englishName,ref.en,`${ref.id}/${variant}: EN`);
      assert.equal(result.spanishResolution.status,ref.family==="A"||ref.id==="phenylpropene"?"TRANSLATED_FROM_LEGACY_EN":"NATIVE_ES",ref.id);
      if(result.spanishResolution.status==="TRANSLATED_FROM_LEGACY_EN") {
        assert(verifyLegacyAromaticModel(graph,result.spanishResolution.model),ref.id);
        assert.deepEqual([...result.spanishAnalysis.numberedAtoms],[...result.spanishResolution.numberedAtoms]);
      }
      for(const [language,analysis,name] of [["es",result.spanishAnalysis,ref.es],["en",result.englishAnalysis,ref.en]]) {
        const reasoning=engine.buildActiveIupacReasoning({molecule:graph,analyses:{current:analysis,legacy:analysis},language,
          convention:language==="es"?"iupac-1979-es":"iupac-1979-legacy-en",displayedName:name,generatedNames:[name],canHighlight:true});
        assertReasoningIntegrity(reasoning,graph);
        assert(reasoning.steps.some(s=>s.explanation.includes(name)),`${ref.id}/${language}: final explanation`);
        if(["naphthalenol","methyl-naphthol"].includes(ref.id)) {
          assert.equal(analysis.primaryFunctionalGroup,"alcohol");
          assert.equal(analysis.functionalGroups.filter(g=>g.kind==="alcohol").length,1);
          assert(reasoning.steps.some(s=>s.nameRole==="function"&&s.explanation.includes("C-202")),`${ref.id}: OH is retained in functional analysis and explanation`);
        }
      }
      assert.deepEqual(graph,snapshot,ref.id);
    }
  }
});

test("mandatory EN/ES alphabetization changes actual parent atoms, not rendered digits",()=>{
  const graph=aromaticGraph(reference("iodo-methyl-ortho")),r=observe(graph);
  assert.equal(r.englishName,"1-iodo-2-methylbenzene");
  assert.equal(r.spanishResolution.name,"1-metil-2-yodobenceno");
  const iodine=graph.atoms.find(a=>a.element==="I").id;
  const anchor=graph.bonds.find(([a,b])=>a===iodine||b===iodine).find(id=>id!==iodine);
  assert.equal(r.englishAnalysis.numberedAtoms.get(anchor),1);
  assert.equal(r.spanishAnalysis.numberedAtoms.get(anchor),2);
  assert.equal(historicalPrefixKey("1,1-dimethylethyl"),"dimethylethyl");
  assert.equal(historicalPrefixKey("tert-butyl"),"butyl");
});

test("semantic translator rejects incomplete, ambiguous, unknown and structurally false models",()=>{
  const graph=aromaticGraph(reference("iodo-methyl-ortho")),original=observe(graph).englishModel;
  const mutations=[
    m=>m.profile="iupac-2013-pin-en",
    m=>m.substituents.pop(),
    m=>m.substituents[0].locant=7,
    m=>m.substituents[0].locant=0,
    m=>m.substituents[0].systematicName="unobtainium",
    m=>m.parent.fallbackName="unknownene",
    m=>m.parent.kind="heterocycle",
    m=>m.parent.atomIds[1]=m.parent.atomIds[0],
    m=>m.parent.atomIds.reverse(),
    m=>m.functionalGroups.push({kind:"sulfonicAcid",locant:1,carbonIncludedInParent:false}),
    m=>m.functionalGroups=[],
    m=>m.nitrogenSubstituents=[{systematicName:"methyl",atomIds:[999],nitrogenAtomId:998,complex:false}],
    m=>m.stereochemicalPrefix="(1R)-",
  ];
  for(const mutate of mutations){const model=structuredClone(original);mutate(model);
    const result=translateLegacyEnglishToSpanish({graph,model,englishName:generateLegacyEnglishName(model).name});
    assert.equal(result.status,"UNSUPPORTED",String(mutate));}
  for(const englishName of ["-","","iodobenzene","1-iodo-2-methylbenzene-extra"])
    assert.equal(translateLegacyEnglishToSpanish({graph,model:original,englishName}).status,"UNSUPPORTED");
  const wrong=aromaticGraph(reference("iodo-methyl-meta"));
  assert.equal(translateLegacyEnglishToSpanish({graph:wrong,model:original,englishName:generateLegacyEnglishName(original).name}).status,"UNSUPPORTED");
  const stereo=structuredClone(graph);stereo.atoms[0].tetrahedralParity="R";
  assert.equal(translateLegacyEnglishToSpanish({graph:stereo,model:original,englishName:generateLegacyEnglishName(original).name}).status,"UNSUPPORTED");
});

test("graph identity distinguishes bond orders, hidden groups, charge, disconnected and invalid graphs",()=>{
  const graph=aromaticGraph(reference("benzene"));
  for(const mutate of [g=>g.bonds[0][2]=1,g=>g.atoms[0].charge=1,g=>g.atoms.push({id:999,element:"O"}),
    g=>g.bonds.push([...g.bonds[0]]),g=>g.bonds.push([1,999,1])]) {
    const other=structuredClone(graph);mutate(other);assert.equal(legacyGraphsIdentical(graph,other),false);
  }
  const propyl=aromaticGraph({smiles:"CCCc1ccccc1"}),propenyl=aromaticGraph(reference("phenylpropene"));
  assert.equal(legacyGraphsIdentical(propyl,propenyl),false);
});

test("native-first precedence, explicit chemical veto and TNT through the general route",()=>{
  const graph=aromaticGraph(reference("TNT")),result=observe(graph);
  assert.equal(result.nativeSpanishName,"-");
  assert.equal(result.spanishResolution.status,"TRANSLATED_FROM_LEGACY_EN");
  assert.equal(result.spanishResolution.name,reference("TNT").es);
  assert.deepEqual(resolveLegacySpanish({graph,model:result.englishModel,englishName:result.englishName,
    nativeSpanishName:"nombre nativo verificado",chemicallyAvailable:true}),{status:"NATIVE_ES",name:"nombre nativo verificado"});
  assert.equal(resolveLegacySpanish({graph,model:result.englishModel,englishName:result.englishName,
    nativeSpanishName:reference("TNT").es,chemicallyAvailable:false}).status,"UNSUPPORTED");
});

test("verified retained models translate with fixed historical locants and reject fabricated descriptors",()=>{
  for(const id of ["pyrene","fluoranthene","iodo-methyl-fixed-naphthalene","tetralin","methyl-naphthol"]) {
    const ref=reference(id),graph=aromaticGraph(ref),r=observe(graph);
    const translated=translateLegacyEnglishToSpanish({graph,model:r.englishModel,englishName:r.englishName});
    assert.equal(translated.status,"TRANSLATED_FROM_LEGACY_EN",id);
    assert.equal(translated.name,ref.es,id);
    assert.deepEqual([...translated.fixedLocants],[...r.spanishAnalysis.retainedFused.locants]);
    for(const change of [m=>m.profile="iupac-2013-pin-en",m=>m.parent.retained.id="unknown-parent",m=>m.parent.retained.locants[0]="99z",
      m=>m.parent.fallbackName="naphthalene",m=>m.substituents.push({locant:1,systematicName:"methyl",complex:false})]) {
      const model=structuredClone(r.englishModel);change(model);
      assert.equal(translateLegacyEnglishToSpanish({graph,model,englishName:generateLegacyEnglishName(model).name}).status,"UNSUPPORTED",id);
    }
  }
});

test("retained branched aliases and historical complex radicals retain their own grammar",()=>{
  const graph=aromaticGraph({smiles:"CC(C)c1ccccc1"}),result=observe(graph);
  const model=structuredClone(result.englishModel);
  model.substituents[0]={...model.substituents[0],systematicName:"isopropil",complex:false};
  const translated=translateLegacyEnglishToSpanish({graph,model,englishName:generateLegacyEnglishName(model).name});
  assert.equal(translated.name,"isopropilbenceno");
  model.substituents[0]={...model.substituents[0],systematicName:"1-metiletil",complex:true};
  assert.equal(translateLegacyEnglishToSpanish({graph,model,englishName:generateLegacyEnglishName(model).name}).name,"(1-metiletil)benceno");
  model.substituents[0].complex=false;
  assert.equal(translateLegacyEnglishToSpanish({graph,model,englishName:generateLegacyEnglishName(model).name}).status,"UNSUPPORTED");
});

test("bounded grammar keeps uncovered aromatic functions and fused heterocycles explicitly unavailable",()=>{
  for(const ref of AROMATIC_004_LIMITS)for(const [,graph] of cyclicVariants(aromaticGraph(ref))) {
    assert.equal(observe(graph).spanishResolution.status,"UNSUPPORTED",ref.id);
  }
  const ref=reference("methyl-benzoate"),graph=aromaticGraph(ref),model=structuredClone(observe(graph).englishModel);
  model.functionalGroups[0].attachedAlkylName="ethyl";
  assert.equal(translateLegacyEnglishToSpanish({graph,model,englishName:generateLegacyEnglishName(model).name}).status,"UNSUPPORTED");
  const imported=moleculeFromSmiles("C/C=C/c1ccccc1");assert(imported.ok);
  const r=observe(imported.molecule);
  assert.equal(r.spanishResolution.status,"UNSUPPORTED","explicit external E/Z is never silently omitted by translation");
  const polyunsaturated=observe(aromaticGraph({smiles:"C=CC=Cc1ccccc1"}));
  assert.equal(polyunsaturated.englishName,"-","an uncovered diene radical must never be rendered as a saturated radical or Spanish text in EN");
  assert.equal(polyunsaturated.spanishResolution.status,"UNSUPPORTED");
});

test("existing native aromatic-side-chain stereochemistry and SMILES configuration are preserved",()=>{
  const imported=moleculeFromSmiles("C[C@H](O)c1ccccc1");assert(imported.ok);
  const graph=imported.molecule,analysis=engine.analyzeMolecule(graph,[],"iupac-1979-legacy");
  const source=formatStereochemicalName(graph,analysis.mainChain,analysis.name,{explicitDoubleBonds:true});
  const result=engine.resolveLegacyNomenclature(graph,analysis,source,{stereochemistry:true});
  assert.equal(result.spanishResolution.status,"NATIVE_ES");
  assert.equal(result.spanishResolution.name,"(1S)-1-feniletanol");
  assert.equal(result.englishName,"(1S)-1-phenylethanol");
  const exported=moleculeToSmiles(graph);assert(exported.ok);
  const restored=moleculeFromSmiles(exported.smiles);assert(restored.ok);
  assert.deepEqual(getMainChainTetrahedralDescriptors(restored.molecule,
    engine.analyzeMolecule(restored.molecule,[],"iupac-1979-legacy").mainChain).map(s=>[s.locant,s.configuration]),[[1,"S"]]);
});

test("1979 interior pyrene locants and fixed retained numbering survive graph relabeling",()=>{
  for(const [,graph] of cyclicVariants(aromaticGraph(reference("pyrene")))) {
    const result=nameRetainedFused1979(graph);assert.equal(result.status,"SUPPORTED");
    assert.equal(result.locants.size,16);
    assert.deepEqual([...result.locants.values()].filter(l=>/[bc]/.test(l)).sort(),["10b","10c"]);
    assert.equal(graph.bonds.length-graph.atoms.length+1,4);
    const id=loc=>[...result.locants].find(([,l])=>l===loc)[0];
    assert(graph.bonds.some(([a,b])=>a===id("10b")&&b===id("10c")||b===id("10b")&&a===id("10c")));
  }
});

test("new aromatic names preserve import/export constitution and existing name-import coverage",()=>{
  for(const [es,en] of [["2-etilpireno","2-ethylpyrene"],["2-metilfluoranteno","2-methylfluoranthene"],
    ["1-metilbifenileno","1-methylbiphenylene"],["2-metiltrifenileno","2-methyltriphenylene"]])
    assert.equal(normalizeChemicalNameForParser(es),en,"retained parent locants never become alkene bond locants");
  for(const ref of AROMATIC_004_REFERENCES) {
    const imported=moleculeFromSmiles(ref.smiles);assert(imported.ok,ref.id);
    const exported=moleculeToSmiles(imported.molecule);assert(exported.ok,ref.id);
    const roundtrip=moleculeFromSmiles(exported.smiles);assert(roundtrip.ok,ref.id);
    assert(legacyGraphsIdentical(aromaticGraph(ref),roundtrip.molecule),ref.id);
    if(["methylbenzene","ethylbenzene","ortho-xylene","iodo-methyl-ortho","styrene"].includes(ref.id)) {
      const built=buildHydrocarbonFromIupacName(ref.es);assert(built.ok,`${ref.id}: ${built.error}`);
      assert(legacyGraphsIdentical(aromaticGraph(ref),built.molecule),ref.id);
    }
  }
});
