import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
import {inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {sameComposition} from './b61-evidence.mjs';
const freeze=JSON.parse(readFileSync('reports/b701/corpus-freeze.json','utf8'));
const bytes=readFileSync(freeze.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),freeze.sha256);
const refs=JSON.parse(bytes).records,initial=JSON.parse(readFileSync('reports/b701/post.json','utf8'));
const java='C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe',jar='C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const rows=[];
for(const entry of initial.rows) {
  const ref=refs.find(r=>r.id===entry.id), profile=entry.profiles.en;
  if(!profile?.name){rows.push({id:entry.id,name:null,status:'UNSUPPORTED-SAFE'});continue;}
  const p=spawnSync(java,['-jar',jar,'-osmi','-f'],{input:`${profile.name}\n`,encoding:'utf8',timeout:30000,windowsHide:true});
  const smiles=p.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1),stderr=p.stderr.trim();
  let status,formula=null;
  if(p.error||p.status!==0)status='INCONCLUSIVE';
  else if(!smiles) status=profile.status==='FULL'?'FULL-INTERNAL-ONLY':'INCONCLUSIVE';
  else {const info=inspectSmilesStructure(smiles);formula=info.ok?info.formula:null;
    const same=info.ok && sameComposition(formula,ref.formula) && structuralIdentity(smiles)===ref.identity;
    status=!same?'CONTRADICTED':profile.status==='FULL'?'FULL-OPSIN-CONFIRMED':'PARTIAL-VERIFIED';}
  rows.push({id:entry.id,name:profile.name,internal:profile.status,status,smiles:smiles??null,formula,stderr,exitCode:p.status});
}
writeFileSync('reports/b701/opsin-post.json',JSON.stringify({version:'2.9.0',fixtureSha256:freeze.sha256,executedAt:new Date().toISOString(),rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(r=>({id:r.id,status:r.status,name:r.name}))));
