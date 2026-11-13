import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles,serializable} from './naming-audit/evaluate.mjs';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {classifyValidatedStructureColors,structuralBondKey} from '../app/structural-color-classification.ts';
import {buildValidatedVisualNumbering} from '../app/visual-numbering.ts';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';

const java='C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar='C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const baseline=JSON.parse(readFileSync('reports/b741/transversal-baseline.json','utf8'));
const chemistry=await loadExerciseChemistry(),rows=[];
try{for(const old of baseline.rows){
 const parsed=moleculeFromSmiles(old.smiles);if(!parsed.ok)throw Error(`Invalid corpus graph ${old.family}`);
 const graph=parsed.molecule,analyses=analyzeBoth(graph,chemistry.engine),profiles=displayedProfiles(graph,analyses,chemistry.engine),languages={};
 for(const language of ['es','en']){
  const name=profiles[`2013-${language}`].name,proof=name&&reconcileSystematicName(graph,name),issues=[];
  const status=!name?'UNSUPPORTED':proof?'FULL':'PARTIAL';
  if(proof){const ids=new Set(graph.atoms.map(a=>a.id)),edges=new Set(graph.bonds.map(([a,b])=>structuralBondKey(a,b)));
   const reasoning=buildValidatedPriorityReasoning({derivation:proof,graph,language,activeName:name});
   const colors=classifyValidatedStructureColors(graph,proof),numbering=buildValidatedVisualNumbering(graph,proof);
   for(const step of reasoning.steps)for(const target of [step.target,...Object.values(step.fragmentTargets)].filter(Boolean)){
    if(target.atomIds.some(id=>!ids.has(id))||target.bondIds.some(([a,b])=>!edges.has(structuralBondKey(a,b))))issues.push('target-outside-graph');
   }
   if(!colors||colors.atoms.size!==ids.size||colors.bonds.size!==edges.size)issues.push('incomplete-color-map');
   if([...numbering.keys()].some(id=>!proof.parentAtomIds.includes(id)))issues.push('number-outside-parent');
   languages[language]={name,status,principalGroup:proof.principalGroup,components:proof.components,numbering:[...numbering],reasoningSteps:reasoning.steps.length,issues};
  }else languages[language]={name,status,issues,limitation:name?'No complete independent reconciliation':'No safe local name emitted'};
 }
 const name=languages.en.name;let opsin={status:'NO-NAME'};
 if(name){const process=spawnSync(java,['-jar',jar,'-osmi','-f'],{input:name+'\n',encoding:'utf8',timeout:30000,windowsHide:true});
  const smiles=process.stdout?.trim()||null;let status=process.error||process.status!==0?'TECHNICAL-FAILURE':!smiles?'UNRECOGNIZED':'PENDING';let error=process.error?String(process.error):null;
  if(status==='PENDING')try{status=structuralIdentity(smiles)===structuralIdentity(old.smiles)?'EQUIVALENT':'DIFFERENT';}catch(e){status='COMPARISON-ERROR';error=String(e)}
  opsin={status,smiles,exitCode:process.status,stderr:process.stderr?.trim()||'',error};
 }
 rows.push({family:old.family,smiles:old.smiles,analysis:analyses.current,languages,opsin});console.log(`${old.family}: ES ${languages.es.status}, EN ${languages.en.status}, OPSIN ${opsin.status}`);
}}finally{await chemistry.close()}
const counts=Object.fromEntries(['es','en'].map(lang=>[lang,Object.fromEntries(Object.entries(Object.groupBy(rows,r=>r.languages[lang].status)).map(([k,v])=>[k,v.length]))]));
const opsinCounts=Object.fromEntries(Object.entries(Object.groupBy(rows,r=>r.opsin.status)).map(([k,v])=>[k,v.length]));
writeFileSync('reports/b741/stage-e-matrix.json',JSON.stringify(serializable({createdAt:new Date().toISOString(),source:'transversal-baseline.json',opsin:{version:'2.9.0',jarSha256:createHash('sha256').update(readFileSync(jar)).digest('hex'),comparison:'OpenChemLib structuralIdentity; shared dependency with OrgoRush; not PIN'},counts,opsinCounts,rows}),null,2)+'\n');
console.log(JSON.stringify({counts,opsinCounts}));
