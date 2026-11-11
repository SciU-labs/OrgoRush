import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { moleculeFromSmiles, moleculeToSmiles, inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles } from './naming-audit/evaluate.mjs';
import { loadExerciseChemistry } from '../tests/helpers/exercise-chemistry.mjs';
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';
import { generalizationInput } from '../tests/fixtures/b60-generalization-input.mjs';
import { resolveDerivationConsistency } from '../app/derivation-consistency.ts';
import { deriveStructuralComponents } from '../app/structural-derivation.ts';
import { buildValidatedPriorityReasoning } from '../app/reasoning-derivation-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { sameComposition, assessManualName } from './b61-evidence.mjs';

const stage=process.argv[2];if(!['blind','blind-reviewed','final'].includes(stage))throw new Error('Expected blind, blind-reviewed or final');
const corpusBody=await readFile(new URL('../tests/fixtures/b61-independent-reference.json',import.meta.url),'utf8');
const corpus=JSON.parse(corpusBody),freeze=JSON.parse(await readFile(new URL('../reports/b61/corpus-freeze.json',import.meta.url),'utf8'));
if(createHash('sha256').update(corpusBody).digest('hex')!==freeze.sha256)throw new Error('Frozen corpus changed');
const chemistry=await loadExerciseChemistry();
const sameGraph=(smiles,other)=>structuralIdentity(smiles)===structuralIdentity(other);
const edgeKey=([a,b])=>[a,b].sort((x,y)=>x-y).join(':');
function reasoningChecks(graph,proof,language) {
  if(!proof)return {status:'NO_FULL_CLAIM',problems:[]};
  const problems=[],atoms=new Set(graph.atoms.map(a=>a.id)),edges=new Set(graph.bonds.map(edgeKey));
  const model=buildValidatedPriorityReasoning({derivation:proof,graph,language});
  for(const step of model.steps) {
    for(const target of Object.values(step.fragmentTargets)) {
      if(target.atomIds.some(id=>!atoms.has(id)))problems.push('nonexistent-target-atom');
      if(target.bondIds.some(pair=>!edges.has(edgeKey(pair))))problems.push('nonexistent-target-bond');
    }
    for(const fragment of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]) {
      if(proof.evidence && proof.name.slice(fragment.start,fragment.start+fragment.text.length)!==fragment.text)problems.push('nonliteral-full-fragment');
      if(fragment.language && fragment.language!==language)problems.push('stale-fragment-language');
    }
  }
  return {status:problems.length?'FAIL':'INTERNAL-TARGETS-CONSISTENT',problems,steps:model.steps.length};
}
function auditRecord(record) {
  const imported=moleculeFromSmiles(record.smiles);
  if(!imported.ok)return {id:record.id,cid:record.cid,referenceName:record.referenceName,import:{ok:false,reason:imported.error},
    profiles:Object.fromEntries(['es','en'].map(language=>[language,{name:null,internalSupport:'UNSUPPORTED',audit:'UNSUPPORTED-SAFE',
      nameValidation:{status:'PENDING-EXTERNAL',reason:'Import not admitted; no local name claim'}}]))};
  const graph=imported.molecule,analyses=analyzeBoth(graph,chemistry.engine),profiles=displayedProfiles(graph,analyses,chemistry.engine);
  const exported=moleculeToSmiles(graph),graphRoundTrip=exported.ok&&sameGraph(record.smiles,exported.smiles);
  const sourceFormula=inspectSmilesStructure(record.smiles).formula;
  const output={id:record.id,cid:record.cid??null,referenceName:record.referenceName??record.en,formula:record.formula,
    import:{ok:true,sourceFormula,formulaTextMatches:sourceFormula===record.formula,
      formulaMatches:sameComposition(sourceFormula,record.formula),sourceGraphRoundTrip:graphRoundTrip},profiles:{}};
  for(const language of ['es','en']) {
    const name=profiles[`2013-${language}`].name;
    const result=name?resolveDerivationConsistency({molecule:graph,activeName:name,language,activeProfile:'current'}):null;
    const proof=result?.derivation;
    const internalSupport=!name?'UNSUPPORTED':proof?'FULL':deriveStructuralComponents(graph,name).status;
    const checks=reasoningChecks(graph,proof,language);
    const exactReference=language==='en' && name===output.referenceName;
    const recordBacked=record.cid!==undefined;
    let audit=internalSupport==='FULL'?'FULL-INTERNAL-ONLY':internalSupport==='PARTIAL'?'PARTIAL-SAFE':'UNSUPPORTED-SAFE';
    if(!output.import.formulaMatches||!graphRoundTrip)audit='FAIL-GRAPH';
    if(checks.problems.length)audit='FAIL-REASONING';
    const manualNameEvidence=assessManualName(name,language,record.smiles);
    if(manualNameEvidence)audit=manualNameEvidence.status;
    output.profiles[language]={name,internalSupport,audit,preferred:proof?.preferred??false,proofKey:proof?.name??null,
      nameValidation:{status:manualNameEvidence?'FAIL-NAME':'PENDING-EXTERNAL',manualNameEvidence,reason:language==='es'?'No independent whole-name Spanish oracle; adaptation checks are a separate evidence level':'Local OPSIN toolchain not installed; no name sent to remote parsers',
        localOpsin:{status:'TECHNICAL-UNAVAILABLE',executed:false,parsed:false},
        independentReferenceExactMatch:recordBacked&&exactReference,
        referenceEvidence:recordBacked&&exactReference?'EXACT-EXTERNAL-NAME-STRUCTURE-PAIR; finite corroboration, not a parser run':recordBacked?'NO-EXACT-MATCH; text difference alone is not failure':'CONSTRUCTED-B60-PAIR; not external evidence'},
      reasoning:checks,parentNumbering:proof?.components.find(c=>c.id==='parent')?.numbering??[],
      rules:proof?.evidence?.rules??[]};
  }
  if(record.referenceName)output.referenceNameInternalSupport=reconcileSystematicName(graph,record.referenceName)?.status??'UNVERIFIED';
  return output;
}
try {
  const rows=[];
  for(const record of corpus.records) {
    try{rows.push(auditRecord(record))}catch(error){rows.push({id:record.id,cid:record.cid,referenceName:record.referenceName,
      technicalError:String(error),profiles:Object.fromEntries(['es','en'].map(language=>[language,{name:null,internalSupport:null,audit:'PENDING-EXTERNAL',technicalError:String(error)}]))})}
  }
  const b60Constructed=generalizationInput.map(record=>auditRecord({...record,referenceName:record.en}));
  const historical=JSON.parse(await readFile(new URL('../tests/fixtures/b50-pubchem-rings.json',import.meta.url),'utf8')).records
    .map(record=>auditRecord({...record,id:`B50-CID${record.cid}`,referenceName:record.iupacName}));
  const count=rows=>rows.flatMap(row=>Object.values(row.profiles)).reduce((acc,row)=>(acc[row.audit]=(acc[row.audit]??0)+1,acc),{});
  const result={stage,executedAt:new Date().toISOString(),corpusSha256:freeze.sha256,localOpsinNamesProcessed:0,remoteNameRequests:0,
    independencePolicy:'Only a successful independent reconstruction can promote FULL-INDEPENDENTLY-VERIFIED. Exact PubChem reference pairs are separately recorded finite corroboration; no automatic parser or PIN certification.',
    counts:count(rows),rows,b60Constructed:{counts:count(b60Constructed),rows:b60Constructed},historical:{counts:count(historical),rows:historical}};
  await writeFile(new URL(`../reports/b61/${stage}.json`,import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:stage==='final'?'w':'wx'});
  console.log(JSON.stringify({stage,counts:result.counts,b60:result.b60Constructed.counts,historical:result.historical.counts,
    rows:rows.map(row=>({id:row.id,cid:row.cid,en:row.profiles.en.name,support:[row.profiles.es.internalSupport,row.profiles.en.internalSupport],
      audit:[row.profiles.es.audit,row.profiles.en.audit],exactReference:row.profiles.en.nameValidation?.independentReferenceExactMatch,error:row.technicalError}))},null,2));
}finally{await chemistry.close()}
