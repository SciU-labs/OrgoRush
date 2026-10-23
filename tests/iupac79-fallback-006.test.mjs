import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {Molecule,SmilesParser} from 'openchemlib';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {verifyLegacyAliphaticFunctionalModel} from '../app/iupac1979-aliphatic-functions.ts';
import {translateLegacyEnglishToSpanish,resolveLegacySpanish} from '../app/iupac1979-english-to-spanish.ts';
import {generateLegacyEnglishName} from '../app/legacy-english-nomenclature.ts';
import {legacyGraphsIdentical} from '../app/iupac1979-name-structure.ts';
import {legacyProfileDisplayName,selectedNomenclatureExportName} from '../app/legacy-profile-display.ts';
import {cyclicVariants} from './helpers/cyclic-audit-003.mjs';
import {assertReasoningIntegrity} from './helpers/reasoning-integrity.mjs';
import {functionalReferences} from './helpers/fallback-006.mjs';
let chemistry,e;
before(async()=>{chemistry=await loadExerciseChemistry();e=chemistry.engine;});
after(async()=>chemistry?.close());
const graph=smiles=>{const r=moleculeFromSmiles(smiles);assert(r.ok,r.error);return r.molecule;};
const observe=g=>e.resolveLegacyNomenclature(g,e.analyzeMolecule(g,[],'iupac-1979-legacy'));
const translate=(g,m)=>translateLegacyEnglishToSpanish({graph:g,model:m,englishName:generateLegacyEnglishName(m).name});

for(const [family,smiles,expected] of functionalReferences)test(`${family}: ${smiles} -> ${expected}, complete graph, numbering and five drawing orders`,()=>{
 for(const [variant,g] of cyclicVariants(graph(smiles))){
  const snapshot=structuredClone(g),r=observe(g),label=`${smiles}/${variant}`,m=r.englishModel;
  assert(verifyLegacyAliphaticFunctionalModel(g,m),label);
  const direct=translate(g,m);assert.equal(direct.status,'TRANSLATED_FROM_LEGACY_EN',label);assert.equal(direct.name,expected,label);
  assert.deepEqual([...direct.numberedAtoms],m.parent.atomIds.map((id,i)=>[id,i+1]));
  assert.equal(r.spanishResolution.name,r.nativeSpanishName!=='-'?r.nativeSpanishName:expected,label);
  assert.equal(r.spanishResolution.status,r.nativeSpanishName!=='-'?'NATIVE_ES':'TRANSLATED_FROM_LEGACY_EN',label);
  assert.equal(resolveLegacySpanish({graph:g,model:m,englishName:r.englishName,nativeSpanishName:'-',chemicallyAvailable:false}).status,'UNSUPPORTED');
  assert.equal(resolveLegacySpanish({graph:g,model:m,englishName:r.englishName,nativeSpanishName:expected,chemicallyAvailable:true}).status,'NATIVE_ES');
  assert.deepEqual(g,snapshot,label);
 }
});

test('all enabled families reject corrupted function metadata, branches, locants and graph information',()=>{
 for(const [,smiles] of functionalReferences){const g=graph(smiles),m=observe(g).englishModel;
  for(const mutate of [m=>m.functionalGroups.pop(),m=>m.functionalGroups[0].carbonIncludedInParent=false,
   m=>m.functionalGroups[0].locant=m.parent.carbonCount+1,m=>m.functionalGroups[0].attachedAlkylName='unknown',
   m=>m.functionalGroups[0].kind='amine',m=>m.parent.atomIds[0]=999,m=>m.parent.carbonCount++,
   m=>m.parent.fallbackName='guess',m=>m.doubleBondLocants=[1],m=>m.tripleBondLocants=[1],m=>m.stereochemicalPrefix='(R)-']){
   const other=structuredClone(m);mutate(other);assert.equal(translate(g,other).status,'UNSUPPORTED',`${smiles}/${mutate}`);
  }
  for(const mutate of [g=>g.atoms[0].charge=1,g=>g.atoms[0].isotope=13,g=>g.atoms[0].tetrahedralParity='R',
   g=>g.atoms[0].tetrahedralBondTo=1,g=>g.bonds[0][3]=true,g=>g.bonds.push([...g.bonds[0]]),
   g=>g.atoms.push({id:999,element:'O'}),g=>g.bonds[0][1]=999]){
   const other=structuredClone(g);mutate(other);assert.equal(translate(other,m).status,'UNSUPPORTED',`${smiles}/${mutate}`);
  }
  assert.equal(translateLegacyEnglishToSpanish({graph:g,model:m,englishName:'unrelated name'}).status,'UNSUPPORTED');
  if(m.substituents.length)for(const mutate of [m=>m.substituents.pop(),m=>m.substituents[0].locant=999,
   m=>m.substituents[0].systematicName='unknown radical']){
   const other=structuredClone(m);mutate(other);assert.equal(translate(g,other).status,'UNSUPPORTED',`${smiles}/${mutate}`);
  }
 }
});

test('baseline audit preserves Legacy references and corrects the demonstrated modern multiplicative elision',()=>{
 const baseline=JSON.parse(readFileSync(new URL('../reports/orgorush-iupac79-fallback-006.baseline.json',import.meta.url),'utf8'));
 // FIX-009 / P-16.7 and RSEQ §§4,6b: preserve this historical observation
 // file; these four modern cells had the same independently confirmed error.
 const correctedModern=new Map([
  ['etan-1,2-diol','etano-1,2-diol'],
  ['propan-1,2,3-triol','propano-1,2,3-triol'],
  ['2-propilpropan-1,3-diol','2-propilpropano-1,3-diol'],
  ['pentan-2,4-diona','pentano-2,4-diona'],
 ]);
 for(const record of baseline){const g=graph(record.smiles),r=observe(g);
  assert.equal(r.englishName,record.legacyEN,record.smiles);
  assert.equal(e.analyzeMolecule(g).name,correctedModern.get(record.current2013)??record.current2013,record.smiles);
  assert.equal(r.nativeSpanishName,record.nativeES,record.smiles);
  assert.equal(r.chemicallyAvailable,record.chemicallyAvailable,record.smiles);
  if(record.status==='NATIVE_ES')assert.equal(r.spanishResolution.name,record.legacyES,record.smiles);
 }
});

test('independently drawn functional graphs include the carbonyl/nitrile carbon and complete ester radical',()=>{
 const fixtures=[
  ['CC(O)CC','2-butanol','C4H10O',[[1,'O',1]]],
  ['CC(=O)CC','2-butanona','C4H8O',[[1,'O',2]]],
  ['CCCC=O','butanal','C4H8O',[[0,'O',2]]],
  ['CCCC(=O)O','ácido butanoico','C4H8O2',[[0,'O',2],[0,'O',1]]],
  ['CCCC(N)=O','butanamida','C4H9NO',[[0,'O',2],[0,'N',1]]],
  ['CCCC#N','butanonitrilo','C4H7N',[[0,'N',3]]],
  ['CCCC(=O)OCC','butanoato de etilo','C6H12O2',[[0,'O',2],[0,'O',1],[5,'C',1],[6,'C',1]]],
 ];
 for(const [smiles,name,formula,attachments] of fixtures){
  const expected={atoms:Array.from({length:4},(_,id)=>({id,element:'C'})),bonds:[[0,1,1],[1,2,1],[2,3,1]]};
  for(const [anchor,element,order] of attachments){const id=expected.atoms.length;expected.atoms.push({id,element});expected.bonds.push([anchor,id,order]);}
  const g=graph(smiles);assert(legacyGraphsIdentical(expected,g),smiles);
  const molecule=new SmilesParser().parseMolecule(smiles);molecule.ensureHelperArrays(Molecule.cHelperRings);
  assert.equal(molecule.getMolecularFormula().formula,formula,smiles);
  assert.equal(translate(g,observe(g).englishModel).name,name,smiles);
 }
});

test('unsupported historical grammars fail closed across atom orders; existing native routes remain unchanged',()=>{
 for(const smiles of ['C=CCO','C#CCO','C=CC(=O)C','C=CC=O','C=CC(=O)O','C=CC(N)=O','C=CC#N','C=CC(=O)OC',
  'CNC(=O)CC','CN(C)C(=O)CC','COC(=O)CCC(=O)OCC','CC(=O)OC(C)C',
  'CC(O)CC(=O)C','CC(O)C(=O)O','NCCO','CCOC','OC1CCCCC1','c1ccccc1C(N)=O',
  'OCC(O)C(O)CO','CC(=O)C(=O)C(=O)C(=O)C','O=CC(C=O)CC=O','C[C@H](O)CC']){
  for(const [variant,g] of cyclicVariants(graph(smiles))){const r=observe(g),m=r.englishModel;
   assert.equal(verifyLegacyAliphaticFunctionalModel(g,m),false,`${smiles}/${variant}`);
   if(m.parent.kind==='chain')assert.equal(translate(g,m).status,'UNSUPPORTED',`${smiles}/${variant}`);
   if(r.nativeSpanishName!=='-')assert.equal(r.spanishResolution.status,'NATIVE_ES');
  }
 }
});

test('zero-valued function carbon IDs retain their actual locants and highlights in every family',()=>{
 for(const [,smiles,expected] of functionalReferences){const g=graph(smiles),m=observe(g).englishModel;
  const anchor=m.parent.atomIds[m.functionalGroups[0].locant-1],ids=new Map(g.atoms.map((a,i)=>[a.id,a.id===anchor?0:100+i]));
  const zero={atoms:g.atoms.map(a=>({...a,id:ids.get(a.id)})).reverse(),bonds:g.bonds.map(([a,b,...tail])=>[ids.get(a),ids.get(b),...tail])};
  const r=observe(zero);assert.equal(translate(zero,r.englishModel).name,expected,smiles);
  // Equivalent ends may reverse after relabeling. Match ID 0 to its actual
  // position in the proven parent, not to the first enumerated function.
  const locant=r.englishModel.parent.atomIds.indexOf(0)+1;
  assert(r.englishModel.functionalGroups.some(g=>g.locant===locant),smiles);
  if(r.spanishResolution.status==='TRANSLATED_FROM_LEGACY_EN')assert.equal(r.spanishAnalysis.numberedAtoms.get(0),locant,smiles);
 }
});

test('complex radical attachment and actual alias spelling determine alphabetical numbering ties',()=>{
 for(const [kind,order,suffix] of [['alcohol',1,'ol'],['ketone',2,'ona']]){
  const g={atoms:Array.from({length:16},(_,id)=>({id,element:id===11?'O':'C'})),
   bonds:[...Array.from({length:10},(_,i)=>[i,i+1,1]),[5,11,order],[3,12,1],[12,13,1],[12,14,1],[7,15,1]]};
  const m={profile:'iupac-1979-legacy-en',parent:{kind:'chain',carbonCount:11,atomIds:Array.from({length:11},(_,i)=>i)},
   doubleBondLocants:[],tripleBondLocants:[],functionalGroups:[{kind,locant:6,carbonIncludedInParent:true}],
   substituents:[{locant:4,systematicName:'isopropil',complex:false},{locant:8,systematicName:'metil',complex:false}]};
  assert.equal(translate(g,m).name,`4-isopropil-8-metil-6-undecan${suffix}`);
  const reflected=structuredClone(m);reflected.parent.atomIds.reverse();reflected.substituents.forEach(s=>s.locant=12-s.locant);
  assert.equal(translate(g,reflected).status,'UNSUPPORTED');
  const systematic=structuredClone(reflected);systematic.substituents[0].systematicName='1-metiletil';systematic.substituents[0].complex=true;
  assert.equal(translate(g,systematic).name,`4-metil-8-(1-metiletil)-6-undecan${suffix}`);
  systematic.substituents[0].complex=false;assert.equal(translate(g,systematic).status,'UNSUPPORTED');
 }
});

test('Spanish selection, export and How derived preserve the proven name and atom links',()=>{
 for(const [,smiles] of functionalReferences){const g=graph(smiles),r=observe(g),name=r.spanishResolution.name;
  assert.equal(legacyProfileDisplayName({language:'es',suggestedName:e.analyzeMolecule(g).name,
   spanish1979Name:name,english1979Name:r.englishName}).available,true);
  assert.equal(selectedNomenclatureExportName({convention:'iupac-1979-es',displayedName:name,copyable:true,canonicalName:'canonical'}),name);
  const reasoning=e.buildActiveIupacReasoning({molecule:g,analyses:{current:e.analyzeMolecule(g),legacy:r.spanishAnalysis},
   language:'es',convention:'iupac-1979-es',displayedName:name,generatedNames:[name],canHighlight:true});
  assertReasoningIntegrity(reasoning,g);assert.equal(reasoning.links.map(l=>l.text).join(''),name);
  assert(reasoning.steps.some(s=>s.explanation.includes(name)));
 }
});

test('functional-group count precedes longest chain; a complete but shorter or reflected parent is rejected',()=>{
 const g=graph('CCCCO'),m=observe(g).englishModel,short=structuredClone(m);
 short.parent.atomIds.pop();short.parent.carbonCount--;short.substituents=[{locant:3,systematicName:'metil',complex:false}];
 assert.equal(translate(g,short).status,'UNSUPPORTED');
 const reflected=structuredClone(m);reflected.parent.atomIds.reverse();reflected.functionalGroups[0].locant=4;
 assert.equal(translate(g,reflected).status,'UNSUPPORTED');
 const poly=observe(graph('OCC(CCC)CO'));assert.equal(poly.englishModel.parent.carbonCount,3);
 assert.equal(poly.spanishResolution.name,'2-propil-1,3-propanodiol');
});
