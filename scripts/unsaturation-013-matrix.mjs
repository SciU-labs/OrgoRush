import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {POLYENES} from '../tests/fixtures/orgorush-iupac79-polyenes-011.mjs';
import {UNSATURATION_013} from '../tests/fixtures/orgorush-iupac2013-unsaturation-013.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {analyzeBoth,displayedProfiles,resolvedProfileAnalyses,serializable} from './naming-audit/evaluate.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),baseline=process.argv[2]??'3c47e07';
const output=resolve(process.argv[3]??'outputs/unsaturation-013/profile-matrix.json');
const changes=new Map([
 ['C=CC(CC)=C',['3-metilidenopent-1-eno','3-methylidenepent-1-ene']],
 ['C=CC(CCCC)=C',['3-metilidenohept-1-eno','3-methylidenehept-1-ene']],
 ['C=CC(CCC)=C',['3-metilidenohex-1-eno','3-methylidenehex-1-ene']],
 ['CCCC(=C)CCC',['4-metilidenoheptano','4-methylideneheptane']],
 ['C/C=C/C(=C)CCC',['(2E)-4-metilidenohept-2-eno','(2E)-4-methylidenehept-2-ene']],
 ['C/C=C\\C(=C)CCC',['(2Z)-4-metilidenohept-2-eno','(2Z)-4-methylidenehept-2-ene']],
 // Explicitly remove two false saturated names outside the verified grammar.
 ['CCCC(=CC)CCCC',[null,null]],['CCC(=C)C(=C)CCC',[null,null]],
]);
const inputs=[...new Set([...POLYENES,...UNSATURATION_013].map(r=>r.smiles).concat([...changes.keys()]))];
const records=inputs.map(smiles=>({smiles}));
const files=new Set(['app/page.tsx','app/iupac-name-normalization.ts']);
for(const old of [true,false]){
 const server=await createServer({root,configFile:false,logLevel:'error',appType:'custom',plugins:[
  ...(old?[{name:'read-only-013-baseline',enforce:'pre',load(id){
   const path=relative(root,id.split('?')[0]).replaceAll('\\','/');
   if(files.has(path))return execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8',maxBuffer:8000000});
  }}]:[]),react()],server:{middlewareMode:true,hmr:false,ws:false}});
 try{
  const engine=await server.ssrLoadModule('/app/page.tsx');
  for(const row of records){
   const molecule=moleculeFromSmiles(row.smiles).molecule,analyses=analyzeBoth(molecule,engine);
   const profiles=displayedProfiles(molecule,analyses,engine),reasoning={};
   for(const key of Object.keys(profiles)){
    const p=profiles[key];if(!p.name)continue;
    reasoning[key]=engine.buildActiveIupacReasoning({molecule,analyses:resolvedProfileAnalyses(molecule,analyses,p,engine),...p,
     displayedName:p.name,generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
   }
   row[old?'before':'after']=serializable({molecule,analyses,profiles,reasoning});
  }
 }finally{await server.close();}
}
for(const row of records){
 const {before:b,after:a}=row;
 assert.deepEqual(a.molecule,b.molecule,row.smiles);
 assert.deepEqual(a.analyses.legacy,b.analyses.legacy,row.smiles);
 for(const key of ['1979-es','1979-en']){
  assert.deepEqual(a.profiles[key],b.profiles[key],row.smiles);
  assert.deepEqual(a.reasoning[key],b.reasoning[key],row.smiles);
 }
 if(!changes.has(row.smiles)){assert.deepEqual(a,b,row.smiles);continue;}
 for(const key of ['mainChain','chainName','numberedAtoms','doubleBondLocants','tripleBondLocants','formula','family','functionalGroups'])
  assert.deepEqual(a.analyses.current[key],b.analyses.current[key],`${row.smiles}/${key}`);
 const expected=changes.get(row.smiles);
 assert.deepEqual([a.profiles['2013-es'].name,a.profiles['2013-en'].name],expected,row.smiles);
 if(expected[0])assert.deepEqual([b.profiles['2013-es'].name,b.profiles['2013-en'].name],
  [expected[0].replace('metilideno','metil'),expected[1].replace('methylidene','methyl')],row.smiles);
 else assert.ok(b.profiles['2013-es'].name,'formerly published an incomplete saturated name');
}
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify({baseline,cases:records.length,allowedCurrentChanges:[...changes].map(([smiles,names])=>({smiles,es:names[0],en:names[1]})),
 legacyNamesAnalysisAndReasoningUnchanged:true,currentParentAndNumberingUnchanged:true,records},null,2)+'\n');
console.log(JSON.stringify({cases:records.length,authorizedCurrentChanges:changes.size,legacyNamesAnalysisAndReasoningUnchanged:true,currentParentAndNumberingUnchanged:true,output},null,2));
