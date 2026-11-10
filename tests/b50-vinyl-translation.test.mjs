import assert from 'node:assert/strict';
import {test} from 'node:test';
import {translateSpanishIupacForDisplay, translateSpanishIupacToOpsin} from '../app/iupac-name-normalization.ts';
import {structuralIdentity} from './helpers/reference-corpus.mjs';

test('branched vinyl substituents are translated as complete English names',()=>{
  const spanish='2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona';
  const english='2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one';
  assert.equal(translateSpanishIupacForDisplay(spanish),english);
  assert.equal(translateSpanishIupacToOpsin(spanish),english);
  assert.equal(translateSpanishIupacForDisplay('1-cloro-4-vinilbenceno'),'1-chloro-4-ethenylbenzene');
});

test('OPSIN interpretation of the translated branched vinyl name preserves carvone connectivity',()=>{
  // OPSIN web service, 2026-11-10: SUCCESS; service version not reported.
  const opsinSmiles='CC=1C(CC(CC1)C(=C)C)=O';
  const pubchemSmiles='CC1=CCC(CC1=O)C(=C)C';
  assert.equal(structuralIdentity(opsinSmiles),structuralIdentity(pubchemSmiles));
});
