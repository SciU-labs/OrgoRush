import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from './naming-audit/evaluate.mjs';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
const corpus=JSON.parse(readFileSync('tests/fixtures/b74-independent-reference.json','utf8'));
const historical=JSON.parse(readFileSync('tests/fixtures/b61-independent-reference.json','utf8')).records.find(r=>r.id==='B61-I04');
const boundary=JSON.parse(readFileSync('tests/fixtures/b701-independent-reference.json','utf8')).records.find(r=>r.id==='B701-18');
const java='C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe',jar='C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const c=await loadExerciseChemistry(), rows=[];
try {for(const source of [historical,boundary,{id:"B73-H-4M",smiles:"CN(C)C(=O)c1ccc(C)cc1",formula:"C10H13NO"},...corpus.records]) {
  const parsed=moleculeFromSmiles(source.smiles);if(!parsed.ok){rows.push({id:source.id,smiles:source.smiles,admission:'UNSUPPORTED',reason:parsed.error});continue;}
  const molecule=parsed.molecule,analyses=analyzeBoth(molecule,c.engine),profiles=displayedProfiles(molecule,analyses,c.engine),analysis=analyses.current;
  const result={id:source.id,smiles:source.smiles,formula:source.formula,parent:analysis.chainName,function:analysis.primaryFunctionalGroup,
    substituents:analysis.substituents,profiles:{}};
  for(const lang of ['es','en']){const name=profiles[`2013-${lang}`].name,proof=name&&reconcileSystematicName(molecule,name);
    result.profiles[lang]={name,status:name?(proof?'FULL':'PARTIAL'):'UNSUPPORTED',proof:proof??null};}
  const name=result.profiles.en.name;
  if(name){const p=spawnSync(java,['-jar',jar,'-osmi','-f'],{input:`${name}\n`,encoding:'utf8',timeout:30000,windowsHide:true});
    const smiles=p.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);result.opsin={status:p.status,smiles:smiles??null,stderr:p.stderr.trim(),equivalent:!!smiles&&structuralIdentity(smiles)===structuralIdentity(source.smiles)};}
  rows.push(result);
}}finally{await c.close();}
writeFileSync('reports/b74/post-verified.json',JSON.stringify({executedAt:new Date().toISOString(),pageSha256:createHash('sha256').update(readFileSync('app/page.tsx')).digest('hex'),corpusSha256:createHash('sha256').update(readFileSync('tests/fixtures/b74-independent-reference.json')).digest('hex'),opsinVersion:'2.9.0',rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(x=>({id:x.id,es:x.profiles?.es?.status,en:x.profiles?.en?.status,name:x.profiles?.en?.name,opsin:x.opsin?.equivalent}))));
