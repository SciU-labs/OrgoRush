import assert from 'node:assert/strict';
import test from 'node:test';
import { translateSpanishIupacToOpsin } from '../app/iupac-name-normalization.ts';
import { resolveChemicalName } from '../app/name-structure-resolver.ts';
import { findCommonNameSuggestion } from '../app/name-suggestions.ts';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { carbohydrateCases } from './fixtures/carbohydrate-derivation.mjs';
import { purineCases } from './fixtures/purine-derivation.mjs';

test('Spanish retained carbohydrate names preserve series and anomer through normalization', () => {
  const names = new Map([
    ['α-D-glucopiranosa','alpha-D-glucopyranose'],
    ['β-D-glucopiranosa','beta-D-glucopyranose'],
    ['alfa-D-glucopiranosa','alpha-D-glucopyranose'],
    ['alpha-D-glucofuranosa','alpha-D-glucofuranose'],
    ['beta-D-glucofuranosa','beta-D-glucofuranose'],
    ['D-glucosa','D-glucose'],
    ['L-glucosa','L-glucose'],
    ['alpha-D-glucopyranose','alpha-D-glucopyranose'],
    ['beta-D-glucopyranose','beta-D-glucopyranose'],
  ]);
  for (const [input, expected] of names) assert.equal(translateSpanishIupacToOpsin(input), expected, input);
  assert.equal(translateSpanishIupacToOpsin('cafeína'), 'caffeine');
});

test('caffeine Spanish common name normalizes consistently and generic glucose fails closed', async () => {
  assert.equal(translateSpanishIupacToOpsin('cafeína'), 'caffeine');
  assert.equal(findCommonNameSuggestion('glucosa', 'es'), null);
  assert.equal(findCommonNameSuggestion('glucose', 'en'), null);
  let fetches = 0;
  for (const name of ['glucosa','glucose','D-glucosa','D-glucose','L-glucosa','L-glucose']) {
    const result = await resolveChemicalName(name, {fetchImpl: async () => { fetches++; throw new Error('must not query ambiguous family'); }});
    assert.equal(result.ok, false, name);
    assert.equal(result.ambiguous, true, name);
    assert.match(result.error, /alpha|beta|α|β/i, name);
  }
  assert.equal(fetches, 0);
});

test('FULL sugar and purine component explanations have authored Spanish and English text', () => {
  const sugar=carbohydrateCases.find(f=>f.family==='glucose'&&f.form==='pyranose'&&f.anomer==='beta');
  const caffeine=purineCases.find(f=>f.common==='caffeine');
  for(const [fixture,name] of [[sugar,'beta-D-glucopyranose'],[caffeine,caffeine.name]]) {
    const imported=moleculeFromSmiles(fixture.smiles);assert.equal(imported.ok,true,fixture.common);
    const derivation=reconcileSystematicName(imported.molecule,name);assert.equal(derivation?.status,'FULL',fixture.common);
    assert.ok(derivation.components.length>1);
    for(const component of derivation.components) {
      assert.ok(component.labelEs,`${fixture.common}/${component.id} Spanish label`);
      assert.ok(component.explanationEs,`${fixture.common}/${component.id} Spanish explanation`);
      assert.ok(component.explanation.length>component.explanationEs.length/2,`${fixture.common}/${component.id} English source`);
    }
  }
});
