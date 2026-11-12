import {execFileSync} from 'node:child_process';
import {writeFileSync,unlinkSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {analyzeBoth,displayedProfiles,resolvedProfileAnalyses} from './naming-audit/evaluate.mjs';
import {buildReasoningVisualReferences} from '../app/reasoning-visual-targets.ts';
const temp='app/b701-baseline-temp.tsx';
const original=execFileSync('git',['show','HEAD:app/page.tsx'],{encoding:'utf8'});
writeFileSync(temp,original,{flag:'wx'});
let server;
try {
  server=await loadExerciseChemistry();const engine=await server.loadModule('/app/b701-baseline-temp.tsx');
  const refs=JSON.parse(readFileSync('tests/fixtures/b701-independent-reference.json','utf8')).records;
  const prior=JSON.parse(readFileSync('reports/b701/initial.json','utf8')).rows,rows=[];
  for(const record of refs) {
    const originalRow=prior.find(r=>r.id===record.id);
    if(!['es','en'].some(lang=>originalRow.profiles[lang]?.status==='PARTIAL'))continue;
    const parsed=moleculeFromSmiles(record.smiles);if(!parsed.ok)continue;
    const molecule=parsed.molecule,analyses=analyzeBoth(molecule,engine),profiles=displayedProfiles(molecule,analyses,engine);
    for(const language of ['es','en']) {
      if(originalRow.profiles[language]?.status!=='PARTIAL')continue;
      const profile=profiles[`2013-${language}`];
      if(profile.name!==originalRow.profiles[language].name)throw Error(`Baseline name mismatch ${record.id} ${language}`);
      const selected=resolvedProfileAnalyses(molecule,analyses,profile,engine);
      const model=engine.buildActiveIupacReasoning({molecule,analyses:selected,...profile,displayedName:profile.name,
        generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
      const refsForModel=buildReasoningVisualReferences({molecule,analysis:model.analysis,steps:model.steps,
        fragments:model.fragments,displayedName:profile.name,enabled:true});
      rows.push({id:record.id,language,name:profile.name,fragments:model.fragments,targets:refsForModel.fragments});
    }
  }
  writeFileSync('reports/b701/initial-partial-controls.json',JSON.stringify({baselinePageSha256:createHash('sha256').update(original).digest('hex'),
    note:'Historical HEAD page loaded after measurement; local PARTIAL model, not an independent name proof',rows},null,2)+'\n',{flag:'wx'});
  console.log(`Baseline partial projections: ${rows.length}`);
} finally {await server?.close();unlinkSync(temp);}
