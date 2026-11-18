import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { CanonizerUtil, Molecule, SmilesParser } from 'openchemlib';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { nameLegacyFusedIndole } from '../app/iupac1979-fused-indole.ts';
import { verifiedPubChemCommonName } from '../app/verified-common-name-equivalences.ts';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';

const targets = [
  ['Tryptamine', 'C1=CC=C2C(=C1)C(=CN2)CCN', '2-(1H-indol-3-il)etilamina', '2-(1H-indol-3-yl)ethylamine', 1150, 'APJYDQYYACXCRM-UHFFFAOYSA-N'],
  ['Serotonin', 'C1=CC2=C(C=C1O)C(=CN2)CCN', '3-(2-aminoetil)-1H-indol-5-ol', '3-(2-aminoethyl)-1H-indol-5-ol', 5202, 'QZAYGJVTTNCVMB-UHFFFAOYSA-N'],
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

for (const [label, smiles, expectedEs, expectedEn, cid, inchiKey] of targets) test(`H3.2 local 1979 bilingual indole naming: ${label}`, () => {
  const molecule = graph(smiles), analysis = chemistry.engine.analyzeMolecule(molecule, [], 'iupac-1979-legacy');
  const result = chemistry.engine.resolveLegacyNomenclature(molecule, analysis);
  assert.equal(result.chemicallyAvailable, true);
  assert.equal(result.englishName, expectedEn);
  assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN');
  assert.equal(result.spanishResolution.name, expectedEs);
  assert.match(result.spanishResolution.rule, /B-2\.11; B-3\.4; B-5\.11/);
  assert.equal(analysis.retainedFused?.parentId, 'indole');
  assert.deepEqual([...analysis.retainedFused.locants.values()], ['1', '2', '3', '3a', '4', '5', '6', '7', '7a']);
  assert.equal(analysis.retainedFused.atomIds.length, 9, 'all nine fused-parent atoms are numbered exactly once');
  assert.equal(verifiedPubChemCommonName({ cid, inchiKey }, 'es'), label === 'Serotonin' ? 'Serotonina' : 'Triptamina');
  assert.equal(verifiedPubChemCommonName({ cid, inchiKey }, 'en'), label);
  assert.equal(verifiedPubChemCommonName({ cid: cid + 1, inchiKey }, 'en'), null, 'common title requires exact identity');
  const exported = moleculeToSmiles(molecule); assert(exported.ok, exported.error);
  assert.equal(identity(exported.smiles), identity(smiles), 'SMILES export/import preserves the complete molecular identity');
});

test('indole parent and bounded substitution grammar generalize beyond the corpus', () => {
  const analogs = [
    ['c1ccc2[nH]ccc2c1', 'indole'],
    ['Cc1cc2ccccc2[nH]1', '2-methyl-1H-indole'],
    ['Cc1c[nH]c2ccccc12', '3-methyl-1H-indole'],
    ['c1ccc2[nH]c(CCN)cc2c1', '2-(1H-indol-2-yl)ethylamine'],
    ['Oc1ccc2[nH]ccc2c1', undefined],
  ];
  for (const [smiles, expected] of analogs) {
    const proof = nameLegacyFusedIndole(graph(smiles));
    assert.ok(proof?.status === 'SUPPORTED', `recognizes supported indole graph ${smiles}`);
    if (expected) assert.equal(proof.nameEn, expected, `locants and suffix are correct for ${expected}`);
    else assert.match(proof.nameEn, /^1H-indol-\d-ol$/, 'a different aromatic hydroxy position is located compositionally');
  }
});

test('fused heterocycle recognizer rejects a different core topology or unsupported substitution', () => {
  assert.equal(nameLegacyFusedIndole(graph('c1ccc2occc2c1')), undefined, 'benzofuran is not indole');
  assert.equal(nameLegacyFusedIndole(graph('C1C2=CC=CC=C2C=N1')), undefined, '1H-isoindole has a different N position and indicated-H graph');
  assert.equal(nameLegacyFusedIndole(graph('Cn1cc2ccccc2c1')), undefined,
    'a substituent on the indicated N is not silently accepted as ring-carbon substitution');
});
