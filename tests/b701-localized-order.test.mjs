import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';

test('B7.0.1: aromatic suffix prefix citation is localized before rendering',async()=>{
  const corpus=JSON.parse(readFileSync('tests/fixtures/b701-independent-reference.json','utf8'));
  const chemistry=await loadExerciseChemistry();
  try {
    for(const id of ['B701-03','B701-04','B701-05','B701-17']) {
      const ref=corpus.records.find(r=>r.id===id), parsed=moleculeFromSmiles(ref.smiles);assert.ok(parsed.ok);
      const profiles=displayedProfiles(parsed.molecule,analyzeBoth(parsed.molecule,chemistry.engine),chemistry.engine);
      assert.equal(profiles['2013-en'].name,ref.referenceName,id);
      if(id==='B701-17') {
        assert.equal(reconcileSystematicName(parsed.molecule,profiles['2013-en'].name),null);
        assert.equal(reconcileSystematicName(parsed.molecule,profiles['2013-es'].name),null);
      } else {
        assert.equal(reconcileSystematicName(parsed.molecule,profiles['2013-en'].name)?.status,'FULL');
        assert.equal(reconcileSystematicName(parsed.molecule,profiles['2013-es'].name)?.status,'FULL');
      }
    }
    const tie=moleculeFromSmiles('O=Cc1c(OC)cccc1I');assert.ok(tie.ok);
    const result=displayedProfiles(tie.molecule,analyzeBoth(tie.molecule,chemistry.engine),chemistry.engine);
    assert.equal(result['2013-es'].name,'2-metoxi-6-yodobenzaldehído');
    assert.equal(result['2013-en'].name,'2-iodo-6-methoxybenzaldehyde');
    for(const language of ['es','en'])assert.equal(reconcileSystematicName(tie.molecule,result[`2013-${language}`].name)?.status,'FULL');
  } finally {await chemistry.close();}
});
