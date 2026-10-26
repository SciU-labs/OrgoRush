import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertCaptureSource,textBytes} from './validation-014-integrity.mjs';
import {isDeepStrictEqual} from 'node:util';
import {Molecule,SmilesParser} from 'openchemlib';
import {VALIDATION_CASES,PROFILES} from '../tests/fixtures/orgorush-validation-014.mjs';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {displayedProfiles,resolvedProfileAnalyses,serializable} from './naming-audit/evaluate.mjs';
import {assertReasoningIntegrity} from '../tests/helpers/reasoning-integrity.mjs';
const dir=new URL('../outputs/validation-014/capture/',import.meta.url),batchDir=new URL('batches/',dir);
const digest=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
export function checkProtected(){return assertCaptureSource().legacyProductionHash;}

function fallback(error){return{name:'-',chainName:'',formula:'',family:'polycyclic',mainChain:[],numberedAtoms:new Map(),substituents:[],functionalGroups:[],doubleBondLocants:[],tripleBondLocants:[],cyclicUnsupported:`AUDIT-ANALYSIS-ERROR:${error}`};}
function capture(engine,graph){
 const graphBefore=structuredClone(graph),analyses={},analysisErrors={};
 for(const [key,args]of [['current',[]],['legacy',[[],'iupac-1979-legacy']]]){
  try{analyses[key]=engine.analyzeMolecule(graph,...args);}catch(e){analysisErrors[key]={message:e.message,stack:e.stack};analyses[key]=fallback(e.message);}
 }
 let profiles,selectionError;
 try{profiles=displayedProfiles(graph,analyses,engine);}catch(e){selectionError={message:e.message,stack:e.stack};profiles={};}
 const values={};
 for(const key of PROFILES){
  const p=profiles[key];
  const result={name:p?.name??null,available:Boolean(p?.name),analysisError:analysisErrors[key.startsWith('2013')?'current':'legacy']??null,selectionError:selectionError??null};
  const analysis=key.startsWith('2013')?analyses.current:analyses.legacy;
  result.rawAnalysis=serializable(analysis);
  if(p?.name){
   try{
    const active=resolvedProfileAnalyses(graph,analyses,p,engine),a=active[p.selected],before=structuredClone({graph,analyses});
    const model=engine.buildActiveIupacReasoning({molecule:graph,analyses:active,...p,displayedName:p.name,
     generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
    result.analysis=serializable(a);result.reasoning=serializable({steps:model.steps,fragments:model.fragments,links:model.links});
    result.reasoningMutatedGraphOrAnalyses=!isDeepStrictEqual(before,{graph,analyses});
    try{assertReasoningIntegrity(model,graph);result.reasoningIntegrity={status:'PASS'};}catch(e){result.reasoningIntegrity={status:'FAIL-REASONING',message:e.message};}
   }catch(e){result.reasoningError={message:e.message,stack:e.stack};}
  }else{
   result.analysis=serializable(analysis);
   if(key.startsWith('1979'))try{const r=engine.resolveLegacyNomenclature(graph,analyses.legacy);result.availabilityDetail={spanishResolution:r.spanishResolution,englishUnavailableReason:r.englishModel?.unavailableReason??null,chemicallyAvailable:r.chemicallyAvailable,englishName:r.englishName};}catch{}
  }
  values[key]=result;
 }
 const exported=moleculeToSmiles(graph);
 return serializable({graph,exported,profiles:values,graphMutated:!isDeepStrictEqual(graph,graphBefore)});
}
function makeVariants(graph,smiles){
 const map=new Map(graph.atoms.map((a,i)=>[a.id,1007+19*i]));
 const reindexed={...structuredClone(graph),atoms:graph.atoms.map(a=>({...a,id:map.get(a.id),...(a.tetrahedralBondTo===undefined?{}:{tetrahedralBondTo:map.get(a.tetrahedralBondTo)})})).reverse(),
  bonds:graph.bonds.map(([a,b,...tail])=>[map.get(b),map.get(a),...tail]).reverse(),
  ...(graph.rings?{rings:graph.rings.map(r=>({...r,atomIds:r.atomIds.map(id=>map.get(id))})).reverse()}:{}),};
 const reflected={...structuredClone(graph),atoms:graph.atoms.map(a=>({...a,x:-a.x+71,y:a.y-11}))};
 const m=new SmilesParser().parseMolecule(smiles);for(let i=0;i<m.getAllAtoms();i++)m.setAtomMapNo(i,i+101,false);
 const alternative=m.toIsomericSmiles({includeMapping:true,kekulizedOutput:true}),parsed=moleculeFromSmiles(alternative);
 return[{label:'stored',graph},{label:'reindexed-reordered',graph:reindexed},{label:'visual-x-reflection',graph:reflected},
  {label:'independently-serialized-mapped-SMILES',sourceSmiles:alternative,graph:parsed.ok?parsed.molecule:null,importError:parsed.ok?null:parsed.error}];
}
export {capture,makeVariants};
export async function reproduce(){
 mkdirSync(dir,{recursive:true});
 mkdirSync(dir,{recursive:true});
 checkProtected();const cases=read(new URL('../reports/orgorush-validation-014.defects.json',import.meta.url)).additionalControls,chemistry=await loadExerciseChemistry(),results=[];
 try{for(const row of cases){const parsed=moleculeFromSmiles(row.smiles);assert.ok(parsed.ok,row.id);const actual=capture(chemistry.engine,parsed.molecule);
  const names=Object.fromEntries(PROFILES.map(p=>[p,actual.profiles[p].name]));assert.deepEqual(names,row.names,`Diagnostic snapshot changed for ${row.id}`);
  results.push({id:row.id,smiles:row.smiles,names,diagnosticReplay:'MATCH',knownDefect:row.id.endsWith('-min')});
 }}finally{await chemistry.close();}
 writeFileSync(new URL('reproduction-replay.json',dir),JSON.stringify({results},null,2)+'\n');checkProtected();console.log(JSON.stringify({reproductions:results.length,snapshotMatches:results.length,meaning:'Known negative outputs reproduced; this does not assert chemical correctness'}));
}
export async function roundtrips(){
 mkdirSync(dir,{recursive:true});
 mkdirSync(dir,{recursive:true});
 checkProtected();const ref=await import('./validation-014-reference.mjs'),records=[];
 const input=Array.from({length:6},(_,i)=>read(new URL(`batch-${i+1}.json`,batchDir)).records).flat();
 const extra=new URL('editor-equivalent.json',dir);if(existsSync(extra))for(const row of read(extra).records)input[input.findIndex(r=>r.id===row.id)]=row;
 for(const row of input){const reference=VALIDATION_CASES.find(r=>r.id===row.id),g=ref.cmlGraph(JSON.parse(ref.receipt(reference.referenceEnglish).body).cml);
  for(const v of row.variants){if(!v.exported?.ok)continue;const parsed=moleculeFromSmiles(v.exported.smiles);
   const mapping=parsed.ok?ref.graphMapping(g,parsed.molecule):null;
   records.push({id:row.id,variant:v.label,smiles:v.exported.smiles,imported:parsed.ok,importError:parsed.ok?null:parsed.error,
    graphStatus:mapping?.status??'UNSUPPORTED',constitution:ref.identity(v.exported.smiles)===ref.identity(reference.smiles),stereo:ref.identity(v.exported.smiles,true)===ref.identity(reference.smiles,true)});
  }
 }
 writeFileSync(new URL('roundtrips.json',dir),JSON.stringify({records},null,2)+'\n');checkProtected();console.log(JSON.stringify({roundtrips:records.length,refused:records.filter(r=>!r.imported).length,changed:records.filter(r=>!r.constitution||!r.stereo).length}));
}
async function editableReferenceInput(row){
 const {cmlGraph,receipt}=await import('./validation-014-reference.mjs');
 const g=cmlGraph(JSON.parse(receipt(row.referenceEnglish).body).cml);
 if(g.components.length!==1||g.atoms.some(a=>a.charge||a.cmlStereo||!['C','N','O','S','F','Cl','Br','I'].includes(a.element))||
   g.kekuleBonds.some(b=>![1,2,3].includes(b[2]))||g.valence.some(a=>!a.valid))return null;
 const ids=new Map(g.atoms.map((a,i)=>[a.id,i+1]));
 return{atoms:g.atoms.map((a,i)=>({id:i+1,element:a.element,x:Math.cos(i*2*Math.PI/g.atoms.length)*5,y:Math.sin(i*2*Math.PI/g.atoms.length)*5})),
  bonds:g.kekuleBonds.map(([a,b,o])=>[ids.get(a),ids.get(b),o])};
}
export async function collect(){
 const productionHash=checkProtected();mkdirSync(batchDir,{recursive:true});
 const fixtureBytes=textBytes(readFileSync(new URL('../tests/fixtures/orgorush-validation-014.mjs',import.meta.url))),collectorBytes=textBytes(readFileSync(new URL(import.meta.url)));
 const fixtureHash=digest(fixtureBytes),collectorHash=digest(collectorBytes);
 for(const [file,bytes]of [['fixture-collected.mjs',fixtureBytes],['collector-used.mjs',collectorBytes]]){
  const path=new URL(file,dir);if(existsSync(path))assert.equal(digest(readFileSync(path)),digest(bytes),'Capture inputs changed; use a fresh capture directory');else writeFileSync(path,bytes);
 }
 writeFileSync(new URL('reference-revision.json',dir),JSON.stringify({reason:'Fresh capture: no reference revision',rawFixtureSha256:fixtureHash,finalFixtureSha256:fixtureHash,engineInputsUnchanged:true,rows:150},null,2)+'\n');
 const chemistry=await loadExerciseChemistry();
 try{
  for(let batch=1;batch<=6;batch++){
   const path=new URL(`batch-${batch}.json`,batchDir),receiptPath=new URL(`batch-${batch}.receipt.json`,batchDir);
   const rows=VALIDATION_CASES.slice((batch-1)*25,batch*25),ids=rows.map(r=>r.id);
   if(existsSync(path)&&existsSync(receiptPath)){
    const r=read(receiptPath);assert.equal(r.status,'COMPLETE');assert.equal(r.productionHash,productionHash);assert.equal(r.fixtureHash,fixtureHash);assert.equal(r.collectorHash,collectorHash);assert.equal(r.bodySha256,digest(readFileSync(path)));assert.deepEqual(r.ids,ids);continue;
   }
   const startedAt=new Date().toISOString(),start=performance.now(),records=[];
   writeFileSync(new URL('progress.json',dir),JSON.stringify({phase:'COLLECTING',batch,ids,completedBatches:batch-1},null,2));
   for(const row of rows){
    const parsed=moleculeFromSmiles(row.smiles),graph=parsed.ok?parsed.molecule:await editableReferenceInput(row);
    const record={id:row.id,imported:parsed.ok,importError:parsed.ok?null:parsed.error,variants:[],...(!parsed.ok&&graph?{primaryInputRoute:'independent CML heavy graph / editable-graph API'}:{})};
    if(graph){for(const variant of makeVariants(graph,row.smiles))record.variants.push(variant.graph?{label:variant.label,sourceSmiles:variant.sourceSmiles??row.smiles,...capture(chemistry.engine,variant.graph)}:{label:variant.label,importError:variant.importError,sourceSmiles:variant.sourceSmiles});}
    records.push(record);console.log(JSON.stringify({phase:'COLLECTED',id:row.id,variants:record.variants.length,imported:parsed.ok}));
   }
   checkProtected();writeFileSync(path,JSON.stringify({batch,ids,records},null,2)+'\n');
   const receipt={status:'COMPLETE',batch,ids,observations:rows.length*4,productionHash,fixtureHash,collectorHash,bodySha256:digest(readFileSync(path)),startedAt,finishedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-start)};
   writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({phase:'BATCH-COMPLETE',batch,observations:100}));
  }
 }finally{await chemistry.close();}
 const batches=Array.from({length:6},(_,i)=>read(new URL(`batch-${i+1}.json`,batchDir)));
 const names=[...new Set(batches.flatMap(b=>b.records.flatMap(r=>r.variants.flatMap(v=>['2013-en','1979-en'].map(p=>v.profiles?.[p]?.name).filter(Boolean)))))];
 writeFileSync(new URL('observed-english-names.json',dir),JSON.stringify(names,null,2)+'\n');
 writeFileSync(new URL('progress.json',dir),JSON.stringify({phase:'COLLECTED-NOT-ADJUDICATED',completedBatches:6,structures:150,observations:600,englishNames:names.length,productionHash,fixtureHash,collectorHash},null,2));
}
