import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {moleculeFromSmiles, moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth, displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {structuralIdentity} from './helpers/reference-corpus.mjs';

test('B6.4.1: systematic substituent survives atom and bond permutations', async () => {
  const record = JSON.parse(readFileSync('tests/fixtures/b50-pubchem-rings.json', 'utf8')).records.find(r => r.cid === 7439);
  const parsed = moleculeFromSmiles(record.smiles); assert.ok(parsed.ok);
  const original = parsed.molecule;
  const alternate = moleculeFromSmiles('CC=1C(CC(CC1)C(=C)C)=O'); assert.ok(alternate.ok);
  assert.equal(structuralIdentity(record.smiles),structuralIdentity('CC=1C(CC(CC1)C(=C)C)=O'));
  const map = new Map(original.atoms.map((a,i)=>[a.id,1000+i*17]));
  const permuted = {...original, atoms:[...original.atoms].reverse().map(a=>({...a,id:map.get(a.id),x:-a.y,y:a.x})),
    bonds:[...original.bonds].reverse().map(([a,b,...rest])=>[map.get(b),map.get(a),...rest]),
    rings:original.rings.map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>map.get(id))}))};
  const chemistry = await loadExerciseChemistry();
  try {
    const results=[];
    for (const molecule of [original,permuted,alternate.molecule]) {
      const analysis=analyzeBoth(molecule,chemistry.engine), profiles=displayedProfiles(molecule,analysis,chemistry.engine);
      results.push([profiles['2013-es'].name, profiles['2013-en'].name]);
      const before=structuredClone(molecule);
      const exported=moleculeToSmiles(molecule); assert.ok(exported.ok);
      assert.equal(structuralIdentity(exported.smiles),structuralIdentity(record.smiles));
      for (const language of ['es','en','es','en','es']) {
        const name=profiles[`2013-${language}`].name;
        const proof=reconcileSystematicName(molecule,name); assert.equal(proof?.status,'FULL');
        const branch=proof.components.find(c=>c.text.startsWith('prop-1-en-2-'));
        const numbers=new Map(branch.internalNumbering.map(([id,n])=>[n,id]));
        const parent=proof.components.find(c=>c.id==='parent');
        const ring5=parent.numbering.find(([,n])=>n===5)[0];
        assert.equal(branch.atomIds.length,3); assert.equal(new Set(numbers.values()).size,3);
        const edge=(a,b,order)=>molecule.bonds.some(([x,y,o=1])=>o===order && (x===a&&y===b||x===b&&y===a));
        assert.ok(edge(numbers.get(1),numbers.get(2),2)); assert.ok(edge(numbers.get(2),numbers.get(3),1));
        assert.ok(edge(ring5,numbers.get(2),1)); assert.ok(!parent.atomIds.includes(numbers.get(2)));
        const unsat=proof.components.find(c=>c.id.startsWith('branch-unsaturation'));
        assert.deepEqual(new Set(unsat.atomIds),new Set([numbers.get(1),numbers.get(2)]));
        const steps=buildValidatedPriorityReasoning({derivation:proof,graph:molecule,language}).steps;
        const fragments=steps.flatMap(s=>s.fragments?[s.fragments,...s.fragments.additionalFragments??[]]:[]);
        for (const number of [1,2]) {
          const fragment=fragments.find(f=>f.semanticId?.startsWith('branch-locant:')&&f.locant===number);
          assert.equal(fragment?.atomIds[0],numbers.get(number));
          assert.equal(name.slice(fragment.start,fragment.start+fragment.text.length),String(number));
        }
      }
      assert.deepEqual(molecule,before);
    }
    assert.deepEqual(results,Array(3).fill(['2-metil-5-(prop-1-en-2-il)ciclohex-2-en-1-ona','2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one']));
    for(const incorrect of ['2-methyl-5-(prop-1-en-1-yl)cyclohex-2-en-1-one',
      '2-methyl-5-(prop-2-en-1-yl)cyclohex-2-en-1-one',
      '2-methyl-5-(propan-2-yl)cyclohex-2-en-1-one']) assert.equal(reconcileSystematicName(original,incorrect),null);
  } finally {await chemistry.close();}
});

test('B6.4.1: compatible parents and distinct neighbouring groups', async () => {
  const cases=[
    ['C=C(C)C1CCCCC1','(prop-1-en-2-il)ciclohexano'],
    ['C=C(C)C1CCC(=O)CC1','4-(prop-1-en-2-il)ciclohexanona'],
    ['C=C(C)c1ccccc1','(prop-1-en-2-il)benceno'],
    ['C=CC1CCCCC1','vinilciclohexano'],
    ['C=CCC1CCCCC1','(prop-2-en-1-il)ciclohexano'],
    ['CC(C)C1CCCCC1','(1-metiletil)ciclohexano'],
    ['CC=CC1CCCCC1','(prop-1-en-1-il)ciclohexano'],
    ['C=C1CCCCC1','metilidenociclohexano'],
  ];
  const chemistry=await loadExerciseChemistry();
  try {
    for(const [smiles,expected] of cases) {
      const parsed=moleculeFromSmiles(smiles); assert.ok(parsed.ok,smiles);
      const analyses=analyzeBoth(parsed.molecule,chemistry.engine);
      const profiles=displayedProfiles(parsed.molecule,analyses,chemistry.engine);
      assert.equal(profiles['2013-es'].name,expected,smiles);
      const exported=moleculeToSmiles(parsed.molecule);assert.ok(exported.ok);
      const restored=moleculeFromSmiles(exported.smiles);assert.ok(restored.ok);
      const restoredProfiles=displayedProfiles(restored.molecule,analyzeBoth(restored.molecule,chemistry.engine),chemistry.engine);
      assert.equal(restoredProfiles['2013-es'].name,expected,smiles);
    }
    const large=moleculeFromSmiles('C=C(CC)C1CCCCC1');assert.ok(large.ok);
    const analysis=chemistry.engine.analyzeMolecule(large.molecule);
    assert.ok(chemistry.engine.localNamerCannotSafelyName(large.molecule,analysis),'unrepresented double bond remains blocked');
  } finally {await chemistry.close();}
});
