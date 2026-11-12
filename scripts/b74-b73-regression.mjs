import {readFileSync,writeFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from './naming-audit/evaluate.mjs';
const records=JSON.parse(readFileSync('tests/fixtures/b73-independent-reference.json','utf8')).records;
const before=JSON.parse(readFileSync('reports/b73/post-final.json','utf8')).rows;
const c=await loadExerciseChemistry(),rows=[];
try{for(const record of records){const prior=before.find(r=>r.id===record.id),p=moleculeFromSmiles(record.smiles);if(!p.ok)throw Error(record.id);
 const profile=displayedProfiles(p.molecule,analyzeBoth(p.molecule,c.engine),c.engine),langs={};
 for(const lang of ['es','en']){const name=profile[`2013-${lang}`].name,proof=name&&reconcileSystematicName(p.molecule,name),status=name?(proof?'FULL':'PARTIAL'):'UNSUPPORTED';
  langs[lang]={before:prior.profiles[lang].status,after:status,name};}
 rows.push({id:record.id,langs});
}}finally{await c.close();}
writeFileSync('reports/b74/b73-regression.json',JSON.stringify({executedAt:new Date().toISOString(),rows},null,2)+'\n');
const changed=rows.filter(r=>Object.values(r.langs).some(x=>x.before!==x.after));
const regressions=rows.filter(r=>Object.values(r.langs).some(x=>x.before==='FULL'&&x.after!=='FULL'
  ||x.before==='PARTIAL'&&x.after!=='PARTIAL' ||x.before==='UNSUPPORTED'&&x.after==='PARTIAL'));
console.log(JSON.stringify({count:rows.length,changed,regressions}));if(regressions.length)process.exitCode=1;
