import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {curatedCommonNameForSmiles} from '../app/curated-common-name-display.ts';

function alias(smiles,language){
  const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true);
  const exported=moleculeToSmiles(imported.molecule);assert.equal(exported.ok,true);
  return curatedCommonNameForSmiles(exported.smiles,language);
}
test('the curated methylanisole alias belongs only to the para graph',()=>{
  for(const smiles of ['CC1=CC=C(C=C1)OC','COc1ccc(C)cc1']){
    assert.equal(alias(smiles,'es'),'4-metilanisol');
    assert.equal(alias(smiles,'en'),'4-methylanisole');
  }
  for(const smiles of ['COc1cccc(C)c1','COc1ccccc1C'])assert.equal(alias(smiles,'es'),null);
});
