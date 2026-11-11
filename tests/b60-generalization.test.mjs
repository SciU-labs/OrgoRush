import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generalizationInput } from './fixtures/b60-generalization-input.mjs';
import { moleculeFromSmiles, moleculeToSmiles, inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { parseAdditionalSystematicFamily } from '../app/systematic-family-grammar.ts';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { analyzeStructuralEquivalence } from '../app/structural-derivation.ts';

test('B6 holdout has 24 distinct constructed structures, eight families and explicit provenance',()=>{
  assert.equal(generalizationInput.length,24);
  assert.equal(new Set(generalizationInput.map(r=>r.id)).size,24);
  assert.equal(new Set(generalizationInput.map(r=>structuralIdentity(r.smiles))).size,24);
  assert.equal(new Set(generalizationInput.map(r=>r.family)).size,8);
  for(const row of generalizationInput) {
    assert.equal(row.provenance,'constructed-control');assert.equal(row.stereo,'absent');assert.equal(row.retrievedAt,null);
    assert.equal('cid' in row,false);assert.equal(inspectSmilesStructure(row.smiles).formula,row.formula,row.id);
  }
});
for(const row of generalizationInput)test(`B6 holdout ${row.id} ${row.family}: ES/EN reconstruction against constructed connectivity`,()=>{
  const imported=moleculeFromSmiles(row.smiles);assert.ok(imported.ok,imported.error);
  for(const language of ['es','en']) {
    const name=row[language], proof=reconcileSystematicName(imported.molecule,name);
    assert.equal(proof?.status,row.expectedSupport[language],name);
    assert.equal(proof.name,name);assert.equal(proof.evidence.language,language);assert.equal(proof.preferred,false);
    const rebuilt=moleculeToSmiles(proof.evidence.reconstructedGraph);assert.ok(rebuilt.ok,rebuilt.error);
    assert.equal(inspectSmilesStructure(rebuilt.smiles).formula,row.formula);
    assert.equal(structuralIdentity(rebuilt.smiles),structuralIdentity(row.smiles),'whole connectivity, not formula alone');
    // Every other holdout graph is a negative name/structure pairing. This
    // includes same-formula positional, functional and branching isomers.
    for(const other of generalizationInput.filter(r=>r.id!==row.id)) {
      const wrong=moleculeFromSmiles(other.smiles);assert.ok(wrong.ok);
      assert.equal(reconcileSystematicName(wrong.molecule,name),null,`${row.id} name cannot certify ${other.id}`);
    }
    const permutation=new Map(imported.molecule.atoms.map((a,i)=>[a.id,300+19*i]));
    const transformed={atoms:imported.molecule.atoms.toReversed().map(a=>({...a,id:permutation.get(a.id),x:-a.y,y:a.x})),
      bonds:imported.molecule.bonds.toReversed().map(([a,b,...rest])=>[permutation.get(b),permutation.get(a),...rest])};
    assert.equal(reconcileSystematicName(transformed,name)?.status,'FULL');
  }
});

test('B6 finite grammar rejects unsupported families and malformed names explicitly',()=>{
  for(const name of ['4-nitroaniline','4-cyanobenzamide','N-methylbenzamide','2-aminocyclohexanol',
    'cyclohexane-1,2-diol','cyclohexane-1,3-dione','cyclohex-2,4-dien-1-one','2-methylcyclononanone',
    '(1R)-2-methylcyclohexanol','2-(2-methylethyl)cyclohexanone','2-((1-methylethyl))cyclohexanol',
    '2,3-di(methyl)cyclohexanol','2-methyl-3-methylcyclohexanol','2-metilcyclohexanol'])
    assert.equal(parseAdditionalSystematicFamily(name),null,name);
});

test('B6 distinguishes constitutional isomers with identical formula and normalizes only aromatic resonance',()=>{
  const parse=s=>{const r=moleculeFromSmiles(s);assert.ok(r.ok);return r.molecule};
  assert.equal(analyzeStructuralEquivalence(parse('CCOC(=O)c1cc(C)ccc1'),parse('COC(=O)c1cc(CC)ccc1')),null,
    'acid/alcohol carbon redistribution preserves formula but changes ester connectivity');
  assert.equal(analyzeStructuralEquivalence(parse('Nc1ccc(CCC)cc1'),parse('Nc1ccc(C(C)C)cc1')),null,
    'n-propyl and 1-methylethyl are different trees');
  assert.ok(analyzeStructuralEquivalence(parse('NC(=O)c1cc(C)ccc1'),parse('NC(=O)C1=CC(C)=CC=C1')),
    'equivalent Kekulé and aromatic ring representations agree');
  assert.equal(reconcileSystematicName(parse('CC1CCCCC1=O'),'2-methylcyclohexan-1-one')?.status,'FULL');
  assert.equal(reconcileSystematicName(parse('OC1C(C)CCCC1'),'2-methylcyclohexan-1-ol')?.status,'FULL');
});
