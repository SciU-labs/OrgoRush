import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {functionalReferences} from '../tests/helpers/fallback-006.mjs';
import {translateLegacyEnglishToSpanish} from '../app/iupac1979-english-to-spanish.ts';

export const matrix=[
 ['alcohol','CO'],['alcohol','CCO'],['alcohol','CCCO'],['alcohol','CC(O)C'],
 ['alcohol','CC(C)CO'],['alcohol','CCC(O)CC(CC)CCC'],['alcohol','OCCO'],['alcohol','OCC(O)CO'],['alcohol','OCC(CCC)CO'],
 ['ketone','CC(=O)C'],['ketone','CCC(=O)CC'],['ketone','CC(=O)CC(C)C'],['ketone','CCC(=O)CC(CC)CCC'],['ketone','CC(=O)CC(=O)C'],
 ['aldehyde','C=O'],['aldehyde','CC=O'],['aldehyde','CCC=O'],['aldehyde','CC(C)CC=O'],['aldehyde','O=CCCC=O'],
 ['acid','O=CO'],['acid','CC(=O)O'],['acid','CCC(=O)O'],['acid','CC(C)CC(=O)O'],['acid','O=C(O)CCC(=O)O'],
 ['amide','NC=O'],['amide','CCC(N)=O'],['amide','CC(C)CC(N)=O'],['amide','NC(=O)CCC(N)=O'],['amide','CNC(=O)CC'],
 ['nitrile','CC#N'],['nitrile','CCC#N'],['nitrile','CC(C)CC#N'],['nitrile','N#CCCC#N'],
 ['ester','CC(=O)OC'],['ester','CCC(=O)OCC'],['ester','CC(C)CC(=O)OC'],['ester','COC(=O)CCC(=O)OC'],
 ['unsaturated','C=CCO'],['unsaturated','C=CC(=O)C'],['unsaturated','C=CC=O'],['unsaturated','C=CC(=O)O'],
 ['unsaturated','C=CC(N)=O'],['unsaturated','C=CC#N'],['unsaturated','C=CC(=O)OC'],
 ['mixed','CC(O)CC(=O)C'],['mixed','CC(O)C(=O)O'],['stereo','C[C@H](O)CC'],['cyclic','OC1CCCCC1'],
];

export async function audit(){
 const chemistry=await loadExerciseChemistry();
 const inputs=[...matrix,...functionalReferences.filter(([,smiles])=>!matrix.some(([,s])=>s===smiles))];
 try{return inputs.map(([family,smiles])=>{
  const parsed=moleculeFromSmiles(smiles);if(!parsed.ok)throw Error(parsed.error);
  const e=chemistry.engine,g=parsed.molecule,legacy=e.analyzeMolecule(g,[],'iupac-1979-legacy'),r=e.resolveLegacyNomenclature(g,legacy);
  const direct=translateLegacyEnglishToSpanish({graph:g,model:r.englishModel,englishName:r.englishName});
  return {family,smiles,current2013:e.analyzeMolecule(g).name,formula:legacy.formula,nativeES:r.nativeSpanishName,
   legacyEN:r.englishName,legacyES:r.spanishResolution.name,status:r.spanishResolution.status,reason:r.spanishResolution.reason,
   chemicallyAvailable:r.chemicallyAvailable,directStatus:direct.status,directName:direct.name,model:r.englishModel};
 });}finally{await chemistry.close();}
}
if(process.argv[1]?.endsWith('audit-iupac79-fallback-006.mjs')){
 const records=await audit(),target=process.argv[2]??'outputs/iupac79-fallback-006/audit.json';
 if(process.argv.includes('--verify')){
  const baseline=JSON.parse(readFileSync('reports/orgorush-iupac79-fallback-006.baseline.json','utf8'));
  for(const b of baseline){const r=records.find(r=>r.smiles===b.smiles);
   assert.equal(r.current2013,b.current2013,b.smiles);assert.equal(r.legacyEN,b.legacyEN,b.smiles);
   assert.equal(r.nativeES,b.nativeES,b.smiles);assert.equal(r.chemicallyAvailable,b.chemicallyAvailable,b.smiles);
  }
  for(const [,smiles,es] of functionalReferences){const r=records.find(r=>r.smiles===smiles);
   assert.equal(r.directName,es,smiles);assert.equal(r.directStatus,'TRANSLATED_FROM_LEGACY_EN',smiles);
   assert.equal(r.legacyES,r.nativeES==='-'?es:r.nativeES,smiles);
  }
 }
 mkdirSync('outputs/iupac79-fallback-006',{recursive:true});writeFileSync(target,JSON.stringify(records,null,2));
 console.table(records.map(({family,smiles,current2013,legacyEN,legacyES,status})=>({family,smiles,current2013,legacyEN,legacyES,status})));
}
