import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {formatIupac1979SpanishName} from '../app/nomenclature-conventions.ts';
const chemistry=await loadExerciseChemistry();
try {
 const records=[];
 const expected=[
  ['CCC(N)CC(CC)CCC','5-etil-3-octanamina'],['CN','metanamina'],['CCN','etanamina'],
  ['CCCN','1-propanamina'],['CC(N)C','2-propanamina'],['CC(C)CN','2-metil-1-propanamina'],
  ['NCCN','1,2-etanodiamina'],['NCC(N)CN','1,2,3-propanotriamina'],
  ['CNCCC','N-metil-1-propanamina'],['CN(C)CCC','N,N-dimetil-1-propanamina'],
  ['CCN(C)CCC','N-etil-N-metil-1-propanamina'],['CC(C)CC(N)C','4-metil-2-pentanamina'],
  ['C=CCN','-'],['CNCCN','-']
 ];
 for(const [smiles,name] of expected) {
  const graph=moleculeFromSmiles(smiles).molecule, e=chemistry.engine;
  const analysis=e.analyzeMolecule(graph,[],'iupac-1979-legacy'), r=e.resolveLegacyNomenclature(graph,analysis);
  records.push({smiles,modern:e.analyzeMolecule(graph).name,formula:analysis.formula,analysis:analysis.name,
   formatterInput:e.legacySpanishFormatterInput(analysis,analysis.name),formatter:formatIupac1979SpanishName(analysis.name),
   chemicallyAvailable:r.chemicallyAvailable,nativeSpanishName:r.nativeSpanishName,englishName:r.englishName,
   englishModel:r.englishModel,spanishResolution:r.spanishResolution});
  assert.equal(r.spanishResolution.name,name,smiles);
  if(smiles===expected[0][0]){
   assert.equal(e.analyzeMolecule(graph).name,'5-etiloctan-3-amina');
   assert.equal(r.englishName,'5-ethyl-3-octanamine');
  }
 }
 mkdirSync('outputs/iupac79-fallback-005',{recursive:true});
 writeFileSync('outputs/iupac79-fallback-005/result.json',JSON.stringify(records,(_,value)=>value instanceof Map?[...value]:value,2));
 console.log(records.map(({smiles,modern,nativeSpanishName,englishName,spanishResolution})=>({smiles,modern,nativeSpanishName,englishName,status:spanishResolution.status,name:spanishResolution.name,reason:spanishResolution.reason})));
} finally {await chemistry.close();}
