import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {spawnSync} from 'node:child_process';
import {structuralIdentity} from './helpers/reference-corpus.mjs';
let chemistry;before(async()=>{chemistry=await loadExerciseChemistry()});after(async()=>{await chemistry?.close()});
test('heterocyclic carboxylic acids cannot lose their oxygen groups in local names',()=>{
  for(const smiles of ['C1=C(C=NC=C1C(=O)O)C(=O)O','O=C(O)c1ccccn1']) {
    const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);
    const profiles=displayedProfiles(parsed.molecule,analyzeBoth(parsed.molecule,chemistry.engine),chemistry.engine);
    for(const language of ['es','en']) {
      const name=profiles[`2013-${language}`].name;
      assert.ok(name && /carbox/i.test(name), `${language}: the admitted name must represent the carboxyl function`);
    }
    const parsedName=spawnSync('C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe',
      ['-jar','C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar','-osmi'],
      {input:profiles['2013-en'].name+'\n',encoding:'utf8',timeout:30000,windowsHide:true});
    assert.equal(parsedName.status,0,parsedName.stderr);
    assert.ok(parsedName.stdout.trim(),'OPSIN must interpret the corrected English name');
    assert.equal(structuralIdentity(parsedName.stdout.trim()),structuralIdentity(smiles));
  }
  const pyridine=moleculeFromSmiles('c1ccncc1');assert.ok(pyridine.ok);
  const plain=displayedProfiles(pyridine.molecule,analyzeBoth(pyridine.molecule,chemistry.engine),chemistry.engine);
  assert.equal(plain['2013-en'].name,'pyridine');
});
