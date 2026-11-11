import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';

// OPSIN interprets the English name directly. OCL, also used by the application,
// is used only for the comparison, so graph comparison is not fully independent.
const java='C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar='C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const input=JSON.parse(readFileSync('reports/b61/opsin-manifest.json','utf8'));
mkdirSync('reports/b62',{recursive:true});
const rows=[];
for(const job of input.jobs) {
  const process=spawnSync(java,['-jar',jar,'-osmi','-f'],{input:job.name+'\n',encoding:'utf8',timeout:30000,windowsHide:true});
  const smiles=process.stdout?.trim()||null,stderr=process.stderr?.trim()||'';
  let comparison='PENDING',error=null;
  if(process.error || process.status!==0) {comparison='TECHNICAL-FAILURE';error=String(process.error??`exit ${process.status}`)}
  else if(!smiles) comparison='OPSIN-UNRECOGNIZED';
  else try {comparison=structuralIdentity(smiles)===structuralIdentity(job.expectedSmiles)?'EQUIVALENT':'DIFFERENT'}
    catch(e){comparison='COMPARISON-ERROR';error=String(e)}
  rows.push({...job,opsin:{exitCode:process.status,smiles,stderr,error},comparison});
  console.log(`${job.line}/${input.jobs.length} ${job.id}: ${comparison}`);
}
const counts=Object.groupBy(rows,r=>r.comparison);
writeFileSync('reports/b62/historical-opsin.json',JSON.stringify({createdAt:new Date().toISOString(),java,jar,
  interpreter:'OPSIN 2.9.0 CLI, English names directly',comparator:'OpenChemLib CanonizerUtil.NORMAL; shared dependency with OrgoRush',
  counts:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v.length])),rows},null,2)+'\n');
