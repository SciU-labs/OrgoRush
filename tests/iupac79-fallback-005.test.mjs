import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {Molecule,SmilesParser} from 'openchemlib';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {legacyGraphsIdentical} from '../app/iupac1979-name-structure.ts';
import {verifyLegacyAliphaticAmineModel} from '../app/iupac1979-aliphatic-amines.ts';
import {translateLegacyEnglishToSpanish,resolveLegacySpanish} from '../app/iupac1979-english-to-spanish.ts';
import {generateLegacyEnglishName} from '../app/legacy-english-nomenclature.ts';
import {formatIupac1979SpanishName} from '../app/nomenclature-conventions.ts';
import {selectedNomenclatureExportName,legacyProfileDisplayName} from '../app/legacy-profile-display.ts';
import {assertReasoningIntegrity} from './helpers/reasoning-integrity.mjs';
import {cyclicVariants} from './helpers/cyclic-audit-003.mjs';

let chemistry,e;
before(async()=>{chemistry=await loadExerciseChemistry();e=chemistry.engine;});
after(async()=>chemistry?.close());
const graph=smiles=>{const r=moleculeFromSmiles(smiles);assert(r.ok,r.error);return r.molecule;};
const observe=g=>{const analysis=e.analyzeMolecule(g,[],'iupac-1979-legacy');return e.resolveLegacyNomenclature(g,analysis);};
const translate=(g,m)=>translateLegacyEnglishToSpanish({graph:g,model:m,englishName:generateLegacyEnglishName(m).name});
const references=[
 ['CN','methanamine','metanamina'],['CCN','ethanamine','etanamina'],
 ['CCCN','1-propanamine','1-propanamina'],['CC(N)C','2-propanamine','2-propanamina'],
 ['CCCCN','1-butanamine','1-butanamina'],['CCC(N)C','2-butanamine','2-butanamina'],
 ['CC(C)CN','2-methyl-1-propanamine','2-metil-1-propanamina'],
 ['CC(C)CC(N)C','4-methyl-2-pentanamine','4-metil-2-pentanamina'],
 ['CCC(N)CC(CC)CCC','5-ethyl-3-octanamine','5-etil-3-octanamina'],
 ['NCCN','1,2-ethanediamine','1,2-etanodiamina'],
 ['NCCCN','1,3-propanediamine','1,3-propanodiamina'],
 ['NCC(N)CN','1,2,3-propanetriamine','1,2,3-propanotriamina'],
 // The C3 parent contains both NH2 groups; a longer C5 path contains only
 // one. Functional-group count must take precedence over chain length.
 ['NCC(CCC)CN','2-propyl-1,3-propanediamine','2-propil-1,3-propanodiamina'],
 ['CNCCC','N-methyl-1-propanamine','N-metil-1-propanamina'],
 ['CN(C)CCC','N,N-dimethyl-1-propanamine','N,N-dimetil-1-propanamina'],
 ['CCN(C)CCC','N-ethyl-N-methyl-1-propanamine','N-etil-N-metil-1-propanamina'],
 ['CC(C)C(NC)C','N,3-dimethyl-2-butanamine','N,3-dimetil-2-butanamina'],
];

test('mandatory regression: independently constructed C8 parent, C3 amino, C5 ethyl and C10H23N',()=>{
 const g=graph('CCC(N)CC(CC)CCC');
 const expected={atoms:Array.from({length:11},(_,i)=>({id:i,element:i===10?'N':'C'})),
  bonds:[...Array.from({length:7},(_,i)=>[i,i+1,1]),[4,8,1],[8,9,1],[2,10,1]]};
 assert(legacyGraphsIdentical(expected,g));
 const independent=new SmilesParser().parseMolecule('CCC(N)CC(CC)CCC');independent.ensureHelperArrays(Molecule.cHelperRings);
 assert.equal(independent.getMolecularFormula().formula,'C10H23N');
 const r=observe(g);
 assert.equal(e.analyzeMolecule(g).name,'5-etiloctan-3-amina');
 assert.equal(r.chemicallyAvailable,true);assert.equal(r.nativeSpanishName,'-');
 assert.equal(r.englishName,'5-ethyl-3-octanamine');
 assert.equal(r.spanishResolution.name,'5-etil-3-octanamina');
 assert.equal(r.spanishResolution.status,'TRANSLATED_FROM_LEGACY_EN');
 assert.equal(r.englishModel.parent.carbonCount,8);
 assert.equal(r.englishModel.functionalGroups[0].locant,3);
 assert.deepEqual(r.englishModel.substituents,[{locant:5,systematicName:'etil',complex:false}]);
 assert.equal(formatIupac1979SpanishName(e.legacySpanishFormatterInput(r.spanishAnalysis,r.spanishAnalysis.name)),undefined);
 const amino=g.atoms.find(a=>a.element==='N').id;
 const anchor=g.bonds.find(([a,b])=>a===amino||b===amino).find(id=>id!==amino);
 assert.equal(r.spanishAnalysis.numberedAtoms.get(anchor),3);
 assert.deepEqual([...r.spanishAnalysis.numberedAtoms],[...r.spanishResolution.numberedAtoms]);
});

test('primary, branched, polyamine and N-alkyl references survive drawing and atom-order permutations',()=>{
 for(const [smiles,en,es] of references)for(const [variant,g] of cyclicVariants(graph(smiles))){
  const snapshot=structuredClone(g),r=observe(g),label=`${smiles}/${variant}`;
  assert.equal(r.englishName,en,label);assert.equal(r.spanishResolution.name,es,label);
  assert(verifyLegacyAliphaticAmineModel(g,r.englishModel),label);
  assert.deepEqual(g,snapshot,label);
  const direct=resolveLegacySpanish({graph:g,model:r.englishModel,englishName:en,nativeSpanishName:'-',chemicallyAvailable:true});
  assert.equal(direct.name,es,label);
  // The native resolver contract takes an already validated ES name. Its
  // precedence is preserved when that upstream route supplies one.
  assert.equal(resolveLegacySpanish({graph:g,model:r.englishModel,englishName:en,nativeSpanishName:es,chemicallyAvailable:true}).status,'NATIVE_ES');
 }
});

test('selected Spanish name, exports, reasoning and carbon/N highlights use the verified resolution',()=>{
 for(const [smiles,,name] of references){const g=graph(smiles),r=observe(g);
  assert.deepEqual(legacyProfileDisplayName({language:'es',suggestedName:e.analyzeMolecule(g).name,
   spanish1979Name:r.spanishResolution.name,english1979Name:r.englishName}),{name,available:true});
  assert.equal(selectedNomenclatureExportName({convention:'iupac-1979-es',displayedName:r.spanishResolution.name,copyable:true,canonicalName:'canonical'}),name);
  const reasoning=e.buildActiveIupacReasoning({molecule:g,analyses:{current:e.analyzeMolecule(g),legacy:r.spanishAnalysis},
   language:'es',convention:'iupac-1979-es',displayedName:name,generatedNames:[name],canHighlight:true});
  assertReasoningIntegrity(reasoning,g);
  assert.equal(reasoning.links.map(l=>l.text).join(''),name);
  assert(reasoning.steps.some(s=>s.explanation.includes(name)));
  if(name.startsWith('N'))assert(reasoning.links.filter(l=>/^N(?:,N)*$/.test(l.text)).some(l=>
   l.atomIds.some(id=>g.atoms.find(a=>a.id===id)?.element==='N')));
 }
});

test('an English candidate does not prove omitted groups, wrong locants, parent or connectivity',()=>{
 const g=graph('CCC(N)CC(CC)CCC'),original=observe(g).englishModel;
 const mutations=[m=>m.functionalGroups=[],m=>m.functionalGroups[0].locant=2,
  m=>m.functionalGroups[0].carbonIncludedInParent=false,m=>m.functionalGroups[0].kind='alcohol',
  m=>m.substituents=[],m=>m.substituents[0].locant=4,m=>m.substituents[0].systematicName='metil',
  m=>m.parent.atomIds.reverse(),m=>m.parent.atomIds[1]=m.parent.atomIds[0],m=>m.parent.carbonCount=7,
  m=>m.parent.fallbackName='octanamine',m=>m.doubleBondLocants=[1],m=>m.tripleBondLocants=[2],
  m=>m.stereochemicalPrefix='(3R)-'];
 for(const mutate of mutations){const m=structuredClone(original);mutate(m);assert.equal(translate(g,m).status,'UNSUPPORTED',String(mutate));}
 for(const mutate of [g=>g.atoms[0].charge=1,g=>g.atoms[0].tetrahedralParity='R',g=>g.atoms[0].tetrahedralBondTo=1,
  g=>g.atoms[0].isotope=13,g=>g.bonds[0][3]=true,g=>g.bonds[0][2]=2,
  g=>g.bonds.push([...g.bonds[0]]),g=>g.atoms.push({id:999,element:'N'}),g=>g.bonds[0][1]=999]){
  const other=structuredClone(g);mutate(other);assert.equal(translate(other,original).status,'UNSUPPORTED',String(mutate));}
 assert.equal(translateLegacyEnglishToSpanish({graph:g,model:original,englishName:'5-ethyl-2-octanamine'}).status,'UNSUPPORTED');
 assert.equal(resolveLegacySpanish({graph:g,model:original,englishName:generateLegacyEnglishName(original).name,nativeSpanishName:'valid',chemicallyAvailable:false}).status,'UNSUPPORTED');
});

test('N-branch atoms and nitrogen anchors cannot be omitted, fabricated or exchanged',()=>{
 const g=graph('CCN(C)CCC'),m=observe(g).englishModel;
 for(const mutate of [m=>m.nitrogenSubstituents.pop(),m=>m.nitrogenSubstituents[0].nitrogenAtomId=999,
  m=>m.nitrogenSubstituents[0].atomIds=[999],m=>m.nitrogenSubstituents[0].systematicName='propil',
  m=>m.nitrogenSubstituents[0].atomIds=m.nitrogenSubstituents[1].atomIds]){
  const other=structuredClone(m);mutate(other);assert.equal(translate(g,other).status,'UNSUPPORTED');}
});

test('bounded complex alkyl radicals retain their attachment, internal locant and parentheses',()=>{
 const g={atoms:Array.from({length:13},(_,id)=>({id,element:id===9?'N':'C'})),
  bonds:[...Array.from({length:8},(_,i)=>[i,i+1,1]),[2,9,1],[4,10,1],[10,11,1],[10,12,1]]};
 const m={profile:'iupac-1979-legacy-en',parent:{kind:'chain',carbonCount:9,atomIds:Array.from({length:9},(_,i)=>i)},
  doubleBondLocants:[],tripleBondLocants:[],functionalGroups:[{kind:'amine',locant:3,carbonIncludedInParent:true}],
  substituents:[{locant:5,systematicName:'1-metiletil',complex:true}]};
 assert.equal(generateLegacyEnglishName(m).name,'5-(1-methylethyl)-3-nonanamine');
 assert.equal(translate(g,m).name,'5-(1-metiletil)-3-nonanamina');
 const wrong=structuredClone(m);wrong.substituents[0].complex=false;
 assert.equal(translate(g,wrong).status,'UNSUPPORTED');
});

test('prefix spelling controls a genuine alphabetical numbering tie without changing connectivity',()=>{
 const g={atoms:Array.from({length:16},(_,id)=>({id,element:id===11?'N':'C'})),
  bonds:[...Array.from({length:10},(_,i)=>[i,i+1,1]),[5,11,1],[3,12,1],[12,13,1],[12,14,1],[7,15,1]]};
 const original={profile:'iupac-1979-legacy-en',parent:{kind:'chain',carbonCount:11,atomIds:Array.from({length:11},(_,i)=>i)},
  doubleBondLocants:[],tripleBondLocants:[],functionalGroups:[{kind:'amine',locant:6,carbonIncludedInParent:true}],
  substituents:[{locant:4,systematicName:'isopropil',complex:false},{locant:8,systematicName:'metil',complex:false}]};
 assert.equal(translate(g,original).name,'4-isopropil-8-metil-6-undecanamina');
 const reflected=structuredClone(original);reflected.parent.atomIds.reverse();reflected.substituents.forEach(s=>s.locant=12-s.locant);
 assert.equal(translate(g,reflected).status,'UNSUPPORTED','isopropyl precedes methyl');
 const systematic=structuredClone(reflected);systematic.substituents[0].systematicName='1-metiletil';systematic.substituents[0].complex=true;
 assert.equal(translate(g,systematic).name,'4-metil-8-(1-metiletil)-6-undecanamina','methyl precedes methylethyl');
 const wrong=structuredClone(original);wrong.substituents[0].systematicName='1-metiletil';wrong.substituents[0].complex=true;
 assert.equal(translate(g,wrong).status,'UNSUPPORTED');
});

test('a complete but shorter or wrongly oriented parent is still rejected',()=>{
 const g=graph('CCCCN');
 const m={profile:'iupac-1979-legacy-en',parent:{kind:'chain',carbonCount:3,atomIds:g.atoms.filter(a=>a.element==='C').slice(1).map(a=>a.id).reverse()},
  doubleBondLocants:[],tripleBondLocants:[],functionalGroups:[{kind:'amine',locant:1,carbonIncludedInParent:true}],
  substituents:[{locant:3,systematicName:'metil',complex:false}]};
 assert.equal(translate(g,m).status,'UNSUPPORTED');
 const octyl=graph('CCC(N)CC(CC)CCC'),reflected=structuredClone(observe(octyl).englishModel);
 reflected.parent.atomIds.reverse();
 reflected.functionalGroups.forEach(group=>group.locant=9-group.locant);
 reflected.substituents.forEach(sub=>sub.locant=9-sub.locant);
 // This name still describes the complete graph; C-15 rejects its larger
 // principal-group locant (C6 rather than C3), independently of identity.
 assert.equal(generateLegacyEnglishName(reflected).name,'4-ethyl-6-octanamine');
 assert.equal(translate(octyl,reflected).status,'UNSUPPORTED');
});

test('zero-valued atom IDs preserve the amino anchor and historical numbering',()=>{
 const g=graph('CCC(N)CC(CC)CCC'),anchor=observe(g).englishModel.parent.atomIds[2];
 const ids=new Map(g.atoms.map((a,i)=>[a.id,a.id===anchor?0:100+i]));
 const zero={atoms:g.atoms.map(a=>({...a,id:ids.get(a.id)})).reverse(),bonds:g.bonds.map(([a,b,...tail])=>[ids.get(a),ids.get(b),...tail])};
 const r=observe(zero);assert.equal(r.spanishResolution.name,'5-etil-3-octanamina');
 assert.equal(r.spanishAnalysis.numberedAtoms.get(0),3);
});

test('unrepresented unsaturation, stereo, mixed functions, cyclic and substituted polyamines remain outside the new route',()=>{
 for(const smiles of ['C=CCN','C#CCN','C[C@H](N)CC','CNCCN','NCCO','CC(=O)N','N1CCCCC1','CNC','CCNCC','CN(C)C','CCN(CC)CC']){
  const g=graph(smiles),r=observe(g);
  const m=e.buildLegacyEnglishNameModel(g,e.analyzeMolecule(g,[],'iupac-1979-legacy'),undefined,{stereochemistry:true});
  assert.equal(verifyLegacyAliphaticAmineModel(g,m),false,smiles);
 }
});
