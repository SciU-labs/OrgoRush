import {mkdirSync,writeFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from './naming-audit/evaluate.mjs';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';

const cases=[
  ['nitrotoluene','Cc1ccccc1[N+](=O)[O-]'],
  ['n-ethyl-benzamide','CCNC(=O)c1c(Br)cc(C)cc1'],
  ['nn-diethyl-benzamide','CCN(CC)C(=O)c1cc(F)cc(F)c1'],
  ['methyl-benzoate','COC(=O)c1cc(Br)c(OC)cc1'],
];
const chemistry=await loadExerciseChemistry(), rows=[];
try {
  for(const [id,smiles] of cases){
    const parsed=moleculeFromSmiles(smiles); if(!parsed.ok) throw new Error(`${id}: ${parsed.error}`);
    const molecule=parsed.molecule, analyses=analyzeBoth(molecule,chemistry.engine), profiles=displayedProfiles(molecule,analyses,chemistry.engine);
    const languages={};
    for(const language of ['es','en']){
      const name=profiles[`2013-${language}`].name, proof=name&&reconcileSystematicName(molecule,name);
      languages[language]={name,status:name?(proof?'FULL':'PARTIAL'):'UNSUPPORTED',proof:proof??null,
        reasoning:proof?buildValidatedPriorityReasoning({derivation:proof,graph:molecule,language}):null};
    }
    rows.push({id,smiles,molecule,analysis:analyses.current,languages});
  }
} finally {await chemistry.close();}
mkdirSync('reports/b741',{recursive:true});
writeFileSync('reports/b741/baseline.json',JSON.stringify({capturedAt:new Date().toISOString(),scope:'Local generator and independently validated reasoning; browser, external names, colors and active UI remain to be captured.',rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(({id,languages})=>({id,es:languages.es.name,en:languages.en.name,esStatus:languages.es.status,enStatus:languages.en.status})),null,2));
