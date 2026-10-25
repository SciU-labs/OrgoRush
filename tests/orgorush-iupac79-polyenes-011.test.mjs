import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { POLYENES } from './fixtures/orgorush-iupac79-polyenes-011.mjs';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { referenceGraph, referenceParentCandidates } from './helpers/validation-008-reference.mjs';
import { observe, project, evidence, assertReasoningIntegrity } from './helpers/reasoning-integrity.mjs';
import { formatIupac1979SpanishName } from '../app/nomenclature-conventions.ts';
import { verifyLegacyAcyclicPolyeneModel, translateLegacyEnglishToSpanish } from '../app/iupac1979-english-to-spanish.ts';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles } from '../scripts/naming-audit/evaluate.mjs';

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => chemistry?.close());

for (const row of POLYENES) test(`POLYENES-011 ${row.smiles}: profiles, historical parent and every interactive C=C`, () => {
  const observed = observe(chemistry.engine, row.smiles);
  const { molecule, analyses, profiles } = observed;
  assert.equal(profiles['2013-es'].name, row.current);
  assert.equal(profiles['1979-es'].name, row.es);
  assert.equal(profiles['1979-en'].name, row.en);
  const candidates = referenceParentCandidates(referenceGraph(row.smiles), '1979-en');
  assert.ok(candidates.some(path => path.join(',') === analyses.legacy.mainChain.join(',')), 'independent A-3.4 path oracle');
  const resolution = chemistry.engine.resolveLegacyNomenclature(molecule, analyses.legacy);
  assert.equal(resolution.spanishResolution.status, 'NATIVE_ES');
  assert.equal(verifyLegacyAcyclicPolyeneModel(molecule, resolution.englishModel), true);
  // Relabel, reverse storage order and reflect coordinates without changing the graph.
  const remap = id => 1000 - 7 * id;
  const variant = { ...molecule,
    atoms: molecule.atoms.map(a => ({ ...a, id: remap(a.id), x: -a.x })).reverse(),
    bonds: molecule.bonds.map(([a,b,...rest]) => [remap(b), remap(a), ...rest]).reverse() };
  const variantProfiles = displayedProfiles(variant, analyzeBoth(variant, chemistry.engine), chemistry.engine);
  for (const key of ['2013-es', '1979-es', '1979-en']) assert.equal(variantProfiles[key].name, profiles[key].name);
  for (const key of ['1979-es', '1979-en', '2013-es']) {
    const model = project(chemistry.engine, observed, key);
    assertReasoningIntegrity(model, molecule);
    if (key === '2013-es') continue;
    const doubles = molecule.bonds.filter(b => b[2] === 2);
    const parts = evidence(model).filter(p => p.kind === 'unsaturation');
    for (const [a,b] of doubles) assert.ok(parts.some(p => p.bondIds?.some(([l,r]) => l === a && r === b || l === b && r === a)), `bond ${a}=${b}`);
    const shared = parts.find(p => p.semanticId?.startsWith('unsaturation:double:group:'));
    assert.equal(shared?.bondIds.length, doubles.length, 'shared multiplier highlights every double bond');
    assert.ok(model.links.some(l => l.text.includes(shared.text) && l.bondIds?.length === doubles.length));
  }
});

test('POLYENES-011 butadiene explains C4, root, historical locants and di in both languages', () => {
  const observed = observe(chemistry.engine, 'C=CC=C');
  for (const key of ['1979-es','1979-en']) {
    const model = project(chemistry.engine, observed, key);
    const prose = model.steps.map(s => s.explanation).join(' ');
    assert.match(prose, /4 carbon/);
    assert.match(prose, /but/);
    assert.match(prose, key === '1979-en' ? /butane/ : /butano/);
    assert.match(prose, /A-3\.1/);
    assert.match(prose, /C1=C2/); assert.match(prose, /C3=C4/);
    assert.match(prose, /di/); assert.match(prose, /1979/);
    assert.ok(prose.includes(observed.profiles[key].name));
    assert.equal(evidence(model).find(p => p.semanticId?.startsWith('unsaturation:double:group:'))?.text, 'dien');
  }
});

test('POLYENES-011 rejects incomplete grammar, unknown multiplicities and arbitrary prefix text', () => {
  for (const value of ['buta-1,3-trieno','buta-1,1-dieno','buta-1,4-dieno','buta-3,1-dieno',
    'buta-1,3-2eno','buta-1,3,5,7,9,11,13,15,17-nonaeno', 'fantasmabuta-1,3-dieno',
    '2-metilbuta-1,3-dien-1-ol']) assert.equal(formatIupac1979SpanishName(value), undefined, value);
});

test('POLYENES-011 graph proof rejects disconnected, invalid, functional, cyclic and mismatched structures', () => {
  const { engine } = chemistry;
  const observed = observe(engine, 'C=CC=C');
  const good = engine.resolveLegacyNomenclature(observed.molecule, observed.analyses.legacy).englishModel;
  const rejects = [
    { ...observed.molecule, atoms: [...observed.molecule.atoms, {id:999,x:0,y:0}] },
    { ...observed.molecule, bonds: [...observed.molecule.bonds,[1,3,2]] },
    { ...observed.molecule, bonds: [[1,2,2],[1,3,2],[1,4,1]] },
    { ...observed.molecule, atoms: observed.molecule.atoms.map((a,i) => i ? a : {...a,charge:1}) },
    ...['C=CCC=C','C=CC=CO','C1=CC=CCC1','C=CC#C','C=C(C=C)C=C'].map(s => moleculeFromSmiles(s).molecule),
  ];
  for (const graph of rejects) assert.equal(verifyLegacyAcyclicPolyeneModel(graph, good), false);
  for (const mutation of [ {doubleBondLocants:[1]}, {doubleBondLocants:[1,2]}, {doubleBondLocants:[1,1]},
    {parent:{...good.parent,atomIds:[1,2,4,3]}}, {substituents:[{locant:2,systematicName:'metil',complex:false}]} ])
    assert.equal(verifyLegacyAcyclicPolyeneModel(observed.molecule,{...good,...mutation}),false);
  assert.equal(engine.resolveLegacyNomenclature(observed.molecule,observed.analyses.legacy,'penta-1,4-dieno').spanishResolution.status,'UNSUPPORTED');
  assert.equal(engine.resolveLegacyNomenclature(observed.molecule,observed.analyses.legacy,'(9Z)-buta-1,3-dieno').spanishResolution.status,'UNSUPPORTED');
  for (const smiles of ['CCCC','C=CCC','C1=CC=CCC1','C=CC=CO']) {
    const graph = moleculeFromSmiles(smiles).molecule;
    const analysis = engine.analyzeMolecule(graph, [], 'iupac-1979-legacy');
    assert.equal(engine.resolveLegacyNomenclature(graph,analysis,'buta-1,3-dieno').spanishResolution.status,'UNSUPPORTED',smiles);
  }
  assert.equal(translateLegacyEnglishToSpanish({graph:observed.molecule,model:good,englishName:'1,4-pentadiene'}).status,'UNSUPPORTED');
  for (const smiles of ['C=C(C=C)C=C','C=CC=CC=CC=CC=CC=CC=CC=CC=C']) {
    assert.equal(observe(engine,smiles).profiles['1979-es'].name,null,smiles);
  }
});

test('POLYENES-011 explicit E/Z descriptors survive the scoped native spelling', () => {
  for (const [smiles, descriptors] of [['C/C=C/C=C/C','(2E,4E)'],['C/C=C\\C=C/C','(2Z,4Z)']]) {
    const observed = observe(chemistry.engine, smiles);
    assert.equal(observed.profiles['2013-es'].name, `${descriptors}-hexa-2,4-dieno`);
    assert.equal(observed.profiles['1979-es'].name, `${descriptors}-2,4-hexadieno`);
    assert.equal(observed.profiles['1979-en'].name, `${descriptors}-2,4-hexadiene`);
    for (const key of ['2013-es','1979-es','1979-en']) assertReasoningIntegrity(project(chemistry.engine, observed, key),observed.molecule);
  }
});
