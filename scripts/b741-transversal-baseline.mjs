import {writeFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles,serializable} from './naming-audit/evaluate.mjs';
import {reconcileSystematicName,presentValidatedSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {classifyValidatedStructureColors} from '../app/structural-color-classification.ts';
import {buildValidatedVisualNumbering} from '../app/visual-numbering.ts';

const cases=[
 ['alkane','CCCC'],['branched alkane','CC(C)CC'],['alkene','CC=CC'],['alkyne','CC#CC'],
 ['alcohol','CCCO'],['ether','CCOCC'],['aldehyde','CCC=O'],['ketone','CC(=O)CC'],
 ['acid','CCC(=O)O'],['ester','CC(=O)OC'],['amine','CCN'],['amide','CC(=O)N'],
 ['nitrile','CCC#N'],['halide','CCCCl'],['nitro','Cc1ccccc1[N+](=O)[O-]'],
 ['cycloalkane','C1CCCCC1'],['cycloalkene','C1=CCCCC1'],['aromatic prefixes','Cc1ccc(Cl)cc1'],
 ['benzamide','NC(=O)c1ccccc1'],['N-alkyl benzamide','CCNC(=O)c1c(Br)cc(C)cc1'],
 ['N,N-dialkyl benzamide','CCN(CC)C(=O)c1cc(F)cc(F)c1'],
 ['N-benzyl benzamide','O=C(NCc1ccccc1)c1ccccc1'],['N-alkyl N-benzyl benzamide','CN(Cc1ccccc1)C(=O)c1ccccc1'],
 ['aromatic ester','COC(=O)c1cc(Br)c(OC)cc1'],['aromatic nitrile','N#Cc1ccc(F)c(F)c1'],
 ['aromatic aldehyde','CCOc1c(Cl)cc(Cl)cc1C=O'],['cyclic ketone','O=C1CCC(C)CC1'],
 ['heterocycle','n1ccccc1'],['N-aryl boundary','CCN(c1ccccc1)C(=O)c1ccccc1'],
 ['N,N-dibenzyl boundary','O=C(N(Cc1ccccc1)Cc1ccccc1)c1ccccc1'],
 ['aromatic multi-prefix','Cc1cc(C)c([N+](=O)[O-])c(C)c1[N+](=O)[O-]'],
];
const chemistry=await loadExerciseChemistry(),rows=[];
try {for(const [family,smiles] of cases){
 const parsed=moleculeFromSmiles(smiles);if(!parsed.ok){rows.push({family,smiles,error:parsed.error});continue;}
 const molecule=parsed.molecule,analyses=analyzeBoth(molecule,chemistry.engine),profiles=displayedProfiles(molecule,analyses,chemistry.engine),languages={};
 for(const language of ['es','en']){const name=profiles[`2013-${language}`].name,proof=name&&reconcileSystematicName(molecule,name);
  languages[language]={name,status:name?(proof?'FULL':'PARTIAL'):'UNSUPPORTED',proof:proof??null,
   reasoning:proof?buildValidatedPriorityReasoning({derivation:proof,graph:molecule,language}):null,
   colors:proof?classifyValidatedStructureColors(molecule,proof):null,
   numbering:proof?buildValidatedVisualNumbering(molecule,proof):null};}
 const englishProof=languages.en.proof;
 rows.push({family,smiles,analysis:analyses.current,languages,externalEnglishAsSpanish:englishProof?presentValidatedSystematicName(englishProof,'es'):null});
}}finally{await chemistry.close();}
writeFileSync('reports/b741/transversal-baseline.json',JSON.stringify(serializable({capturedAt:new Date().toISOString(),scope:'Local model snapshots; no browser or external identity loaded',rows}),null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(r=>({family:r.family,es:r.languages?.es?.name,en:r.languages?.en?.name,status:r.languages?.es?.status,externalSpanish:r.externalEnglishAsSpanish})),null,2));
