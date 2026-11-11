import {readFileSync,writeFileSync} from 'node:fs';
import {moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
const audit=JSON.parse(readFileSync('reports/b62/blind.json','utf8'));
const rows=audit.rows.filter(r=>r.profiles.es?.internalReconstruction&&r.opsin.smiles).map(r=>{
  const exported=moleculeToSmiles(r.profiles.es.internalReconstruction);
  return {id:r.id,es:r.profiles.es.name,opsin:r.opsin.smiles,internalSmiles:exported.ok?exported.smiles:null,
    result:exported.ok?(structuralIdentity(exported.smiles)===structuralIdentity(r.opsin.smiles)?'EQUIVALENT':'DIFFERENT'):'UNAVAILABLE',
    error:exported.ok?null:exported.error};
});
writeFileSync('reports/b62/spanish-internal.json',JSON.stringify({method:'OrgoRush Spanish reconstruction vs OPSIN English graph, compared with shared OCL; not independent Spanish validation',rows},null,2)+'\n');
console.log(JSON.stringify(rows));
