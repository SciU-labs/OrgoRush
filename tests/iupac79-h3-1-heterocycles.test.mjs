import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { CanonizerUtil, Molecule, SmilesParser } from 'openchemlib';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { nameLegacyMonocyclicNitrogenHeterocycle } from '../app/iupac1979-monocyclic-heterocycles.ts';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';

const targets = [
  ['Pyrazole', 'C1=CNN=C1', '1H-pirazol', '1H-pyrazole'],
  ['Histamine', 'C1=C(NC=N1)CCN', '2-(1H-imidazol-5-il)etilamina', '2-(1H-imidazol-5-yl)ethylamine'],
  ['Pyrazine-2-carboxylic acid', 'C1=CN=C(C=N1)C(=O)O', 'ácido pirazina-2-carboxílico', 'pyrazine-2-carboxylic acid'],
];
let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => chemistry?.close());

const graph = smiles => { const result = moleculeFromSmiles(smiles); assert(result.ok, result.error); return result.molecule; };
const identity = smiles => {
  const molecule = new SmilesParser().parseMolecule(smiles);
  molecule.ensureHelperArrays(Molecule.cHelperCIP);
  return CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL);
};

for (const [label, smiles, expectedEs, expectedEn] of targets) test(`H3.1 local IUPAC 1979 naming and SMILES identity: ${label}`, () => {
  const molecule = graph(smiles), analysis = chemistry.engine.analyzeMolecule(molecule, [], 'iupac-1979-legacy');
  const result = chemistry.engine.resolveLegacyNomenclature(molecule, analysis);
  assert.equal(result.chemicallyAvailable, true);
  assert.equal(result.englishName, expectedEn);
  assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN');
  assert.equal(result.spanishResolution.name, expectedEs);
  assert.match(result.spanishResolution.rule, /B-[125]|C-812/);
  assert.equal(result.englishModel.parent.kind, 'heterocycle');
  const exported = moleculeToSmiles(molecule); assert(exported.ok, exported.error);
  assert.equal(identity(exported.smiles), identity(smiles), 'SMILES export/import preserves molecular identity');
});

test('positional and constitutional analogs keep the retained diazine parents distinct', () => {
  const parents = [
    ['C1=CN=CC=N1', 'pyrazine'],
    ['C1=CN=CN=C1', 'pyrimidine'],
    ['C1=CC=NN=C1', 'pyridazine'],
  ];
  const results = parents.map(([smiles]) => nameLegacyMonocyclicNitrogenHeterocycle(graph(smiles))?.english);
  assert.deepEqual(results, parents.map(([, parent]) => parent));
  assert.equal(new Set(results).size, 3);
  assert.equal(nameLegacyMonocyclicNitrogenHeterocycle(graph('C1=CC=CC=N1'))?.english, undefined,
    'a monoaza six-member ring is outside this diazine rule');
  assert.equal(nameLegacyMonocyclicNitrogenHeterocycle(graph('c1cc[nH]c1'))?.english, undefined,
    'a one-nitrogen five-member ring is not conflated with a diazole');
});

test('pyrazole and imidazole connectivity are not interchanged', () => {
  assert.equal(nameLegacyMonocyclicNitrogenHeterocycle(graph('C1=CNN=C1'))?.english, '1H-pyrazole');
  assert.equal(nameLegacyMonocyclicNitrogenHeterocycle(graph('C1=CN=CN1'))?.english, 'imidazole');
  assert.equal(nameLegacyMonocyclicNitrogenHeterocycle(graph('C1=CNN=C1CCN'))?.english, undefined,
    'a side chain on the unsupported pyrazole family is rejected safely');
});

test('wrong diazine arrangement and charged forms are rejected', () => {
  const wrongPosition = structuredClone(graph('C1=CN=C(C=N1)C(=O)O'));
  // Reposition one ring nitrogen to make the pyrimidine constitutional isomer;
  // retain the same acid attachment and atom count.
  wrongPosition.atoms.find(atom => atom.id === 5).element = 'N';
  wrongPosition.atoms.find(atom => atom.id === 6).element = 'C';
  assert.notEqual(nameLegacyMonocyclicNitrogenHeterocycle(wrongPosition)?.english, 'pyrazine-2-carboxylic acid');
  const charged = structuredClone(graph('C1=CN=C(C=N1)C(=O)O'));
  charged.atoms.find(atom => atom.element === 'O' && atom.id > 8).charge = -1;
  assert.equal(nameLegacyMonocyclicNitrogenHeterocycle(charged), undefined);
});
