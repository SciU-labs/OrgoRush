import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';

let chemistry, engine, corpus;
let functionalProof;
before(async () => {
  chemistry = await loadExerciseChemistry();
  engine = chemistry.engine;
  functionalProof = await chemistry.loadModule('/app/iupac1979-aliphatic-functions.ts');
  corpus = JSON.parse(await readFile(new URL('./fixtures/orgorush-pubchem-corpus-120.json', import.meta.url), 'utf8'));
});
after(async () => chemistry?.close());

const supported = [
  ['Cinnamaldehyde', '(2E)-3-fenil-2-propenal'],
  ['Malic Acid', 'ácido 2-hidroxibutanodioico'],
  ['Linolenic Acid', 'ácido (9Z,12Z,15Z)-9,12,15-octadecatrienoico'],
  ['Isoamyl Acetate', 'etanoato de 3-metilbutilo'],
  ['Phenethylamine', '2-feniletanamina'],
  ['Acrylonitrile', '2-propenonitrilo'],
];

test('H1 compositional Spanish localization proves full graph and stereo for new families', () => {
  for (const [title, expected] of supported) {
    const row = corpus.compounds.find(item => item.title === title);
    assert(row, `fixture: ${title}`);
    const imported = moleculeFromSmiles(row.isomeric_smiles_pubchem);
    assert.equal(imported.ok, true, title);
    const active = structuredClone(imported.molecule);
    const analysis = engine.analyzeMolecule(active, [], 'iupac-1979-legacy');
    const result = engine.resolveLegacyNomenclature(active, analysis);
    assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN', title);
    assert.equal(result.spanishResolution.name, expected, title);
    assert.deepEqual(active, imported.molecule, `${title}: localization preserves molecular graph`);
  }
});

test('C-832.5 moves the ester-priority terminal nitrile out of the parent and names it as cyano', () => {
  const row = corpus.compounds.find(item => item.title === 'Ethyl cyanoacetate');
  const imported = moleculeFromSmiles(row.isomeric_smiles_pubchem);
  assert.equal(imported.ok, true);
  const snapshot = structuredClone(imported.molecule);
  const result = engine.resolveLegacyNomenclature(imported.molecule,
    engine.analyzeMolecule(imported.molecule, [], 'iupac-1979-legacy'));
  assert.equal(result.englishName, 'ethyl 2-cyanoethanoate');
  assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN');
  assert.equal(result.spanishResolution.name, '2-cianoetanoato de etilo');
  assert.match(result.spanishResolution.rule, /C-832\.5/);
  assert.equal(result.englishModel.parent.carbonCount, 2);
  assert.deepEqual(result.englishModel.functionalGroups.map(group => [group.kind, group.locant, group.carbonIncludedInParent]),
    [['ester', 1, true], ['nitrile', 2, false]]);
  assert.deepEqual(result.englishModel.substituents, [{ locant: 2, systematicName: 'ciano', complex: false }]);
  assert.deepEqual(imported.molecule, snapshot, 'name generation must not change connectivity');
});

test('C-402.1 selects a three-carboxyl parent by direct attachments and proves citric acid bilingually', () => {
  const cases = [
    ['C(C(=O)O)C(CC(=O)O)(C(=O)O)O', '2-hydroxypropane-1,2,3-tricarboxylic acid',
      'ácido 2-hidroxipropano-1,2,3-tricarboxílico'],
    ['O=C(O)CC(C(=O)O)CCC(=O)O', 'butane-1,2,4-tricarboxylic acid',
      'ácido butano-1,2,4-tricarboxílico'],
  ];
  for (const [smiles, expectedEn, expectedEs] of cases) {
    const imported = moleculeFromSmiles(smiles);
    assert.equal(imported.ok, true, smiles);
    const snapshot = structuredClone(imported.molecule);
    const analysis = engine.analyzeMolecule(imported.molecule, [], 'iupac-1979-legacy');
    const result = engine.resolveLegacyNomenclature(imported.molecule, analysis);
    assert.equal(result.englishName, expectedEn);
    assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN');
    assert.equal(result.spanishResolution.name, expectedEs);
    assert.match(result.spanishResolution.rule, /C-402\.1/);
    assert.equal(result.englishModel.parent.kind, 'chain');
    assert.equal(result.englishModel.functionalGroups.filter(group => group.kind === 'carboxylicAcid').length, 3);
    assert.ok(result.englishModel.functionalGroups.filter(group => group.kind === 'carboxylicAcid')
      .every(group => group.carbonIncludedInParent === false));
    assert.equal(imported.molecule.atoms.length, snapshot.atoms.length);
    assert.deepEqual(imported.molecule, snapshot, 'naming preserves complete molecular identity');
    const wrongLocant = structuredClone(result.englishModel);
    wrongLocant.functionalGroups[0].locant = wrongLocant.functionalGroups[0].locant === 1 ? 2 : 1;
    assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(imported.molecule, wrongLocant), false,
      'a different acid attachment locant fails the independent graph reconstruction');
  }
});
