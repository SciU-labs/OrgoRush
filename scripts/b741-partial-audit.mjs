import {readFileSync,writeFileSync} from 'node:fs';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {evaluateCase,serializable} from './naming-audit/evaluate.mjs';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
const source=JSON.parse(readFileSync('reports/b741/stage-e-matrix.json','utf8'));
const selected=source.rows.filter(row=>['es','en'].some(lang=>row.languages[lang].status==='PARTIAL'));
const runtime=await loadExerciseChemistry(),rows=[];
try{for(const row of selected){const result=evaluateCase({family:row.family,smiles:row.smiles,identity:structuralIdentity(row.smiles),expected:{}},runtime.engine);
 const signals=result.signals.filter(item=>['2013-es','2013-en'].includes(item.profile));
 rows.push({family:row.family,smiles:row.smiles,status:{es:row.languages.es.status,en:row.languages.en.status},profiles:Object.fromEntries(['2013-es','2013-en'].map(k=>[k,result.profiles[k]])),signals});
 console.log(`${row.family}: ${signals.length} signals`);
}}finally{await runtime.close()}
writeFileSync('reports/b741/stage-e-partial.json',JSON.stringify(serializable({scope:'Current local model, not browser; checks are diagnostics, not FULL proof',rows}),null,2)+'\n');
