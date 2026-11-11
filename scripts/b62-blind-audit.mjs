import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {resolveDerivationConsistency} from '../app/derivation-consistency.ts';
import {deriveStructuralComponents} from '../app/structural-derivation.ts';
import {analyzeBoth,displayedProfiles} from './naming-audit/evaluate.mjs';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
const supplemental=process.argv[2]==='supplement';
const body=readFileSync(supplemental?'tests/fixtures/b62-supplemental.json':'tests/fixtures/b62-independent-reference.json');
const freeze=JSON.parse(readFileSync(supplemental?'reports/b62/supplement-freeze.json':'reports/b62/corpus-freeze.json'));
if(createHash('sha256').update(body).digest('hex')!==freeze.sha256)throw Error('Frozen fixture changed');
const corpus=JSON.parse(body),prior=JSON.parse(readFileSync('tests/fixtures/b61-independent-reference.json'));
const chemistry=await loadExerciseChemistry();
const java='C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar='C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
function audit(record){
  const imported=moleculeFromSmiles(record.smiles);
  if(!imported.ok)return {id:record.id,cid:record.cid,import:imported,profiles:{},opsin:{status:'NOT-RUN-NO-NAME'}};
  const graph=imported.molecule,profiles=displayedProfiles(graph,analyzeBoth(graph,chemistry.engine),chemistry.engine);
  const result={id:record.id,cid:record.cid,profiles:{},opsin:{status:'NOT-RUN-NO-NAME'}};
  for(const lang of ['es','en']){
    const name=profiles[`2013-${lang}`].name;
    const proof=name?resolveDerivationConsistency({molecule:graph,activeName:name,language:lang,activeProfile:'current'}).derivation:null;
    result.profiles[lang]={name,internalSupport:!name?'UNSUPPORTED':proof?'FULL':deriveStructuralComponents(graph,name).status,
      independentStatus:lang==='es'?'PENDING-SPANISH-INDEPENDENT-REVIEW':'PENDING-OPSIN',internalReconstruction:proof?.evidence?.reconstructedGraph??null};
  }
  const name=result.profiles.en.name;
  if(name){
    const p=spawnSync(java,['-jar',jar,'-osmi','-f'],{input:name+'\n',encoding:'utf8',timeout:30000,windowsHide:true});
    const smiles=p.stdout?.trim()||null;let comparison='PENDING';
    try {comparison=p.error||p.status!==0?'TECHNICAL-FAILURE':!smiles?'OPSIN-UNRECOGNIZED':
      structuralIdentity(smiles)===structuralIdentity(record.smiles)?'EQUIVALENT':'DIFFERENT'}catch{comparison='COMPARISON-ERROR'}
    result.opsin={status:comparison,smiles,stderr:p.stderr,exitCode:p.status,error:p.error?.message??null};
    result.profiles.en.independentStatus=comparison==='EQUIVALENT'&&result.profiles.en.internalSupport==='FULL'?'FULL-OPSIN-CONFIRMED':comparison;
  }
  return result;
}
try{
  const rows=corpus.records.map(audit);
  const priorCases=supplemental?[]:prior.records.filter(r=>[10758,31266,11142,637563].includes(r.cid)).map(audit);
  const destination=supplemental?'reports/b62/supplement.json':process.argv[2]==='post'?'reports/b62/post.json':'reports/b62/blind.json';
  writeFileSync(destination,JSON.stringify({executedAt:new Date().toISOString(),corpusSha256:freeze.sha256,
    interpreter:'local OPSIN 2.9.0',comparator:'OpenChemLib shared with product',rows,priorCases},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({rows:rows.length,priorCases:priorCases.length,opsin:Object.groupBy(rows,r=>r.opsin.status)},null,2));
}finally{await chemistry.close()}
