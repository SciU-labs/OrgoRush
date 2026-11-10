import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {structuralIdentity} from './helpers/reference-corpus.mjs';
import {records,source} from './fixtures/b42-functionalized-branch-opsin.mjs';

test('B4.2 functionalized branch names match frozen independent OPSIN structures',()=>{
  assert.equal(source.service,'https://www.ebi.ac.uk/opsin/ws/');
  assert.match(source.repository,/github\.com\/dan2097\/opsin/);
  assert.ok(Number.isFinite(Date.parse(source.retrievedAt)));
  assert.equal(records.length,3);
  for(const record of records){
    assert.equal(record.status,'SUCCESS',record.name);
    assert.equal(structuralIdentity(record.inputSmiles),structuralIdentity(record.smiles),record.name);
    assert.equal(inspectSmilesStructure(record.inputSmiles).formula,record.formula,record.name);
    assert.equal(inspectSmilesStructure(record.smiles).formula,record.formula,record.name);
  }
});
