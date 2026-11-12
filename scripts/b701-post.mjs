import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from '../tests/helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from './naming-audit/evaluate.mjs';
import {resolveDerivationConsistency} from '../app/derivation-consistency.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
const freeze=JSON.parse(readFileSync('reports/b701/corpus-freeze.json','utf8'));
const bytes=readFileSync(freeze.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),freeze.sha256);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),freeze.commit);
const fixture=JSON.parse(bytes),chemistry=await loadExerciseChemistry(),rows=[];
try {
  for(const record of fixture.records) {
    const parsed=moleculeFromSmiles(record.smiles);
    if(!parsed.ok){rows.push({id:record.id,cid:record.cid,admission:'UNSUPPORTED',reason:parsed.error,profiles:{}});continue;}
    const molecule=parsed.molecule, analyses=analyzeBoth(molecule,chemistry.engine),profiles=displayedProfiles(molecule,analyses,chemistry.engine);
    const analysis=analyses.current, entry={id:record.id,cid:record.cid,admission:'IMPORTED',formula:analysis.formula,
      function:analysis.primaryFunctionalGroup??null,parent:analysis.chainName,substituents:analysis.substituents.map(s=>({name:s.name,locant:s.locant,atomIds:s.atomIds})),profiles:{}};
    for(const language of ['es','en']) {
      const profile=profiles[`2013-${language}`],name=profile.name;
      if(!name){entry.profiles[language]={name:null,status:'UNSUPPORTED',reason:'No local name admitted'};continue;}
      const result=resolveDerivationConsistency({molecule,activeName:name,activeProfile:'current',language});
      const proof=result.derivation,priority=proof?buildValidatedPriorityReasoning({derivation:proof,graph:molecule,language}):null;
      entry.profiles[language]={name,status:proof?'FULL':'PARTIAL',reason:proof?null:`Reconciliation ${result.status}`,
        proof:proof?{group:proof.principalGroup,parent:proof.parentAtomIds,numbering:proof.evidence?.numbering,
          rules:proof.evidence?.rules,preferred:proof.preferred,components:proof.components,
          controls:priority.steps.flatMap(s=>s.fragments?[s.fragments,...s.fragments.additionalFragments??[]].map(f=>({text:f.text,kind:f.kind,start:f.start,atomIds:f.atomIds,bondIds:f.bondIds})):[])}:null};
    }
    rows.push(entry);
  }
} finally {await chemistry.close();}
writeFileSync('reports/b701/post.json',JSON.stringify({developedOnCorpus:true,executedAt:new Date().toISOString(),commit:freeze.commit,fixtureSha256:freeze.sha256,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(r=>({id:r.id,es:r.profiles.es?.status,en:r.profiles.en?.status,name:r.profiles.en?.name}))));
