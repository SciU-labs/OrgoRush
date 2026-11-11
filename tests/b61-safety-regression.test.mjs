import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { analyzeBoth, displayedProfiles } from '../scripts/naming-audit/evaluate.mjs';
import { assessManualName, sameComposition } from '../scripts/b61-evidence.mjs';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/b61-independent-reference.json',import.meta.url)));
let chemistry;
before(async()=>{chemistry=await loadExerciseChemistry()});after(async()=>{await chemistry?.close()});
const parse=smiles=>{const result=moleculeFromSmiles(smiles);assert.ok(result.ok,result.error);return result.molecule};

test('B6.1 formula comparison uses composition, not formatter element order',()=>{
  for(const [a,b] of [['C7H4NF','C7H4FN'],['C9H8O2Cl2','C9H8Cl2O2'],['C4H7OBr','C4H7BrO']])assert.equal(sameComposition(a,b),true);
  assert.equal(sameComposition('C9H18O2','C9H16O2'),false);
});

test('B6.1 a free benzene ring must minimize all origins and both directions before FULL',()=>{
  const graph=parse('COc1ccc(C)cc1');
  for(const wrong of ['2-methoxy-5-methylbenzene','4-methoxy-1-methylbenzene','2-metil-5-metoxibenceno'])
    assert.equal(reconcileSystematicName(graph,wrong),null,wrong);
  assert.equal(reconcileSystematicName(graph,'1-methoxy-4-methylbenzene')?.status,'FULL');
  assert.equal(reconcileSystematicName(graph,'1-metil-4-metoxibenceno')?.status,'FULL');
});

test('B6.1 malformed benzene locants and terminal separators never obtain FULL',()=>{
  const graph=parse('COc1ccc(C)cc1');
  for(const wrong of ['01-methoxy-4-methylbenzene','1-methoxy-04-methylbenzene','1-methoxy-4-methyl-benzene',
    '01-metil-4-metoxibenceno','1-metil-4-metoxi-benceno'])assert.equal(reconcileSystematicName(graph,wrong),null,wrong);
});

for(const cid of [31266,11142,637563])test(`B6.1 generated names preserve side-chain unsaturation or explicitly block CID ${cid}`,()=>{
  const record=corpus.records.find(r=>r.cid===cid),graph=parse(record.smiles);
  const profiles=displayedProfiles(graph,analyzeBoth(graph,chemistry.engine),chemistry.engine);
  for(const language of ['es','en']) {
    const name=profiles[`2013-${language}`].name;
    assert.equal(assessManualName(name,language,record.smiles),null,`${language}: ${name}`);
    assert.ok(name===null||/en|in|vin|ethen|metiliden|methyliden/.test(name),'a name must express the multiple bond');
  }
});

test('B6.1 English prefix order follows English citation while Spanish and numbering stay localized',()=>{
  const record=corpus.records.find(r=>r.cid===10758),graph=parse(record.smiles),snapshot=JSON.stringify(graph);
  const profiles=displayedProfiles(graph,analyzeBoth(graph,chemistry.engine),chemistry.engine);
  const en=profiles['2013-en'].name,es=profiles['2013-es'].name;
  assert.ok(en.indexOf('hydroxy')<en.indexOf('phenyl'),en);
  assert.ok(es.indexOf('fenil')<es.indexOf('hidroxi'),es);
  assert.equal(JSON.stringify(graph),snapshot);
});
