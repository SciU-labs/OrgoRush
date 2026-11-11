import {readFileSync,writeFileSync} from 'node:fs';
import {generalizationInput} from '../tests/fixtures/b60-generalization-input.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {analyzeBoth,displayedProfiles} from './naming-audit/evaluate.mjs';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {resolveDerivationConsistency} from '../app/derivation-consistency.ts';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const b50=read('tests/fixtures/b50-pubchem-rings.json').records.map(r=>({...r,id:`B50-CID${r.cid}`}));
const b61=read('tests/fixtures/b61-independent-reference.json').records;
const historical=read('reports/b61/final.json');
const previous=id=>historical.rows.find(r=>r.id===id)??historical.historical.rows.find(r=>r.id===id)??historical.b60Constructed.rows.find(r=>r.id===id);
const chemistry=await loadExerciseChemistry();
try {
  const rows=[...generalizationInput,...b50,...b61].map(record=>{
    const parsed=moleculeFromSmiles(record.smiles);
    if(!parsed.ok)return {id:record.id,cid:record.cid??null,importError:parsed.error,profiles:{}};
    const profiles=displayedProfiles(parsed.molecule,analyzeBoth(parsed.molecule,chemistry.engine),chemistry.engine);
    const languages=Object.fromEntries(['es','en'].map(language=>{
      const name=profiles[`2013-${language}`].name;
      const proof=name?resolveDerivationConsistency({molecule:parsed.molecule,activeName:name,language,activeProfile:'current'}).derivation:null;
      return [language,{name,full:!!proof,previousName:previous(record.id)?.profiles[language].name??null,
        matchesPrevious:name===(previous(record.id)?.profiles[language].name??null)}];
    }));
    return {id:record.id,cid:record.cid??null,profiles:languages};
  });
  writeFileSync('reports/b62/historical-current.json',JSON.stringify({executedAt:new Date().toISOString(),rows},null,2)+'\n');
  const changed=rows.flatMap(r=>Object.entries(r.profiles).filter(([,p])=>!p.matchesPrevious).map(([language,p])=>({id:r.id,language,...p})));
  console.log(JSON.stringify({records:rows.length,admitted:rows.filter(r=>!r.importError).length,changed},null,2));
}finally{await chemistry.close()}
