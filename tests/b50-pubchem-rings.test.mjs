import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {moleculeFromSmiles,moleculeToSmiles,inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {structuralIdentity} from './helpers/reference-corpus.mjs';
import {reconcileSystematicName,presentValidatedSystematicName} from '../app/validated-name-derivation.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json',import.meta.url),'utf8'));
test('PubChem ring corpus has independent, unique offline records',()=>{
  assert.equal(fixture.records.length,15);
  assert.equal(new Set(fixture.records.map(record=>record.cid)).size,15);
  assert.match(fixture.source,/pubchem\.ncbi\.nlm\.nih\.gov/);
  assert.ok(Number.isFinite(Date.parse(fixture.retrievedAt)));
});
for(const record of fixture.records)test(`PubChem ${record.cid}: import preserves formula, ring and graph`,()=>{
  const input=moleculeFromSmiles(record.smiles);assert.equal(input.ok,true,record.smiles);
  assert.ok(input.molecule.rings?.length>0,'a ring is detected');
  assert.equal(inspectSmilesStructure(record.smiles).formula,record.formula);
  const output=moleculeToSmiles(input.molecule);assert.equal(output.ok,true);
  assert.equal(structuralIdentity(output.smiles),structuralIdentity(record.smiles));
  assert.ok(record.iupacName && record.inchiKey && record.synonyms.length);
});

test('ibuprofen external systematic name reconciles with the imported PubChem graph',()=>{
  const record=fixture.records.find(item=>item.cid===3672);
  const imported=moleculeFromSmiles(record.smiles);assert.equal(imported.ok,true);
  const proof=reconcileSystematicName(imported.molecule,record.iupacName);
  assert.ok(proof,'external name is reconciled against the complete molecular graph');
  assert.equal(presentValidatedSystematicName(proof,'en').name,'2-[4-(2-methylpropyl)phenyl]propanoic acid');
  assert.equal(presentValidatedSystematicName(proof,'es').name,'ácido 2-[4-(2-metilpropil)fenil]propanoico');
});
