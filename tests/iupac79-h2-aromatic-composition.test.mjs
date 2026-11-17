import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';

let chemistry, corpus, aromaticProof, functionalProof;
before(async () => {
  chemistry = await loadExerciseChemistry();
  corpus = JSON.parse(await readFile(new URL('./fixtures/orgorush-pubchem-corpus-120.json', import.meta.url), 'utf8'));
  aromaticProof = await chemistry.loadModule('/app/iupac1979-english-to-spanish.ts');
  functionalProof = await chemistry.loadModule('/app/iupac1979-aliphatic-functions.ts');
});
after(async () => chemistry?.close());

const cases = [
  ['Benzophenone', 'diphenylmethanone', 'difenilmetanona', 'ketone'],
  ['Tyramine', '4-(2-aminoethyl)phenol', '4-(2-aminoetil)fenol', 'aromatic'],
  ['Dopamine', '4-(2-aminoethyl)-1,2-benzenediol', '4-(2-aminoetil)-1,2-bencenodiol', 'aromatic'],
  ['Acetaminophen', 'N-(4-hydroxyphenyl)ethanamide', 'N-(4-hidroxifenil)etanamida', 'amide'],
];

function resolve(smiles) {
  const imported = moleculeFromSmiles(smiles);
  assert.equal(imported.ok, true, smiles);
  const snapshot = structuredClone(imported.molecule);
  const analysis = chemistry.engine.analyzeMolecule(imported.molecule, [], 'iupac-1979-legacy');
  const result = chemistry.engine.resolveLegacyNomenclature(imported.molecule, analysis);
  assert.deepEqual(imported.molecule, snapshot, 'naming must preserve the active graph');
  return { graph: imported.molecule, result };
}

test('H2 structural composition generates and proves four distinct aromatic patterns bilingually', () => {
  for (const [title, expectedEn, expectedEs, proof] of cases) {
    const row = corpus.compounds.find(item => item.title === title);
    assert(row, `fixture: ${title}`);
    const { graph, result } = resolve(row.isomeric_smiles_pubchem);
    assert.equal(result.englishName, expectedEn, `${title} English`);
    assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN', `${title} Spanish proof`);
    assert.equal(result.spanishResolution.name, expectedEs, `${title} Spanish`);
    if (title === 'Benzophenone') assert.match(result.spanishResolution.rule, /C-313\.1/);
    if (title === 'Tyramine' || title === 'Dopamine') {
      assert.match(result.spanishResolution.rule, /C-202\.1/);
      assert.match(result.spanishResolution.rule, /C-812\.1/);
    }
    if (title === 'Acetaminophen') assert.match(result.spanishResolution.rule, /C-202\.1/);
    if (proof === 'aromatic') assert.equal(aromaticProof.verifyLegacyAromaticModel(graph, result.englishModel), true, title);
    if (proof === 'amide') assert.equal(functionalProof.verifyLegacyAliphaticFunctionalModel(graph, result.englishModel), true, title);
    if (proof === 'ketone') assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, result.englishModel), true, title);
  }
});

test('functionalized aromatic radicals compose for a new chain length outside the corpus', () => {
  const { graph, result } = resolve('C1=CC(=C(C=C1CCCN)O)O');
  assert.equal(result.englishName, '4-(3-aminopropyl)-1,2-benzenediol');
  assert.equal(result.spanishResolution.name, '4-(3-aminopropil)-1,2-bencenodiol');
  assert.equal(aromaticProof.verifyLegacyAromaticModel(graph, result.englishModel), true);
});

test('halo-phenoxy acid branches compose from ring locants and preserve the full graph', () => {
  const target = corpus.compounds.find(item => item.title === '(2,4-Dichlorophenoxy)Acetic Acid');
  for (const [smiles, expectedEn, expectedEs] of [
    [target.isomeric_smiles_pubchem, '2-(2,4-dichlorophenoxy)ethanoic acid', 'ácido 2-(2,4-diclorofenoxi)etanoico'],
    ['O=C(O)COc1ccccc1Cl', '2-(2-chlorophenoxy)ethanoic acid', 'ácido 2-(2-clorofenoxi)etanoico'],
  ]) {
    const { graph, result } = resolve(smiles);
    assert.equal(result.englishName, expectedEn);
    const translated = aromaticProof.translateLegacyEnglishToSpanish({ graph, model: result.englishModel, englishName: result.englishName });
    assert.equal(translated.status, 'TRANSLATED_FROM_LEGACY_EN');
    assert.equal(translated.name, expectedEs);
    assert.equal(result.spanishResolution.name, expectedEs);
    assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, result.englishModel), true);
    if (smiles === target.isomeric_smiles_pubchem) {
      const wrongPosition = structuredClone(result.englishModel);
      wrongPosition.substituents[0].systematicName = '2,5-diclorofenoxi';
      assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, wrongPosition), false);
    }
  }
});

test('aryl O-acetyl substitution is composed as acetoxy on a benzoic-acid parent', () => {
  const row = corpus.compounds.find(item => item.title === 'Aspirin');
  const { graph, result } = resolve(row.isomeric_smiles_pubchem);
  assert.equal(result.englishName, '2-acetoxybenzoic acid');
  assert.equal(result.spanishResolution.name, 'ácido 2-acetoxibenzoico');
  assert.equal(aromaticProof.verifyLegacyAromaticModel(graph, result.englishModel), true);
  const wrongPosition = structuredClone(result.englishModel);
  wrongPosition.substituents[0].locant = 3;
  assert.equal(aromaticProof.verifyLegacyAromaticModel(graph, wrongPosition), false);
});

test('a branch-substituted aryl radical is numbered from its chain attachment', () => {
  const row = corpus.compounds.find(item => item.title === 'Ibuprofen, (+-)-');
  const { graph, result } = resolve(row.isomeric_smiles_pubchem);
  assert.equal(result.englishName, '2-[4-(2-methylpropyl)phenyl]propanoic acid');
  assert.equal(result.spanishResolution.name, 'ácido 2-[4-(2-metilpropil)fenil]propanoico');
  assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, result.englishModel), true);
});

test('aryl halogen and N-alkylamino fragments compose around a ketone parent', () => {
  const row = corpus.compounds.find(item => item.title === 'Bupropion');
  const { graph, result } = resolve(row.isomeric_smiles_pubchem);
  assert.equal(result.englishName, '1-(3-chlorophenyl)-2-(1,1-dimethylethylamino)-1-propanone');
  assert.equal(result.spanishResolution.name, '1-(3-clorofenil)-2-(1,1-dimetiletilamino)-1-propanona');
  assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, result.englishModel), true);
});

test('N-aryl dimethyl and tertiary dialkylamino fragments compose for lidocaine', () => {
  const row = corpus.compounds.find(item => item.title === 'Lidocaine');
  for (const [smiles, expectedEn, expectedEs] of [
    [row.isomeric_smiles_pubchem, '2-(diethylamino)-N-(2,6-dimethylphenyl)ethanamide', '2-(dietilamino)-N-(2,6-dimetilfenil)etanamida'],
    ['CCN(CC)CC(=O)Nc1c(C)cc(C)cc1', '2-(diethylamino)-N-(2,4-dimethylphenyl)ethanamide', '2-(dietilamino)-N-(2,4-dimetilfenil)etanamida'],
  ]) {
    const { graph, result } = resolve(smiles);
    assert.equal(result.englishName, expectedEn);
    assert.equal(result.spanishResolution.name, expectedEs);
    assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, result.englishModel), true);
  }
});

test('independent aryl rings compose through an N-methyl secondary-amine chain with CF3 phenoxy', () => {
  const row = corpus.compounds.find(item => item.title === 'Fluoxetine');
  for (const [smiles, expectedEn, expectedEs] of [
    [row.isomeric_smiles_pubchem, 'N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]-1-propanamine', '3-fenil-N-metil-3-[4-(trifluorometil)fenoxi]-1-propanamina'],
    ['CCNCCC(c1ccccc1)Oc1cc(C(F)(F)F)ccc1', 'N-ethyl-3-phenyl-3-[3-(trifluoromethyl)phenoxy]-1-propanamine', '3-fenil-N-etil-3-[3-(trifluorometil)fenoxi]-1-propanamina'],
  ]) {
    const { graph, result } = resolve(smiles);
    assert.equal(result.englishName, expectedEn);
    assert.equal(result.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN');
    assert.equal(result.spanishResolution.name, expectedEs);
    assert.equal(result.englishModel.parent.carbonCount, 3, 'C-814.4 selects the senior propyl-side primary amine parent');
    assert.equal(result.englishModel.nitrogenSubstituents[0].systematicName,
      expectedEn.startsWith('N-methyl-') ? 'metil' : 'etil', 'the shorter N-bound radical remains the N-substituent');
    assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, result.englishModel), true);
    assert.equal(graph.atoms.filter(atom => atom.tetrahedralParity !== undefined).length, 0, 'unspecified stereochemistry remains unspecified');
    const wrongRingLocant = structuredClone(result.englishModel);
    wrongRingLocant.substituents.find(item => item.systematicName.includes('fenoxi')).systematicName =
      wrongRingLocant.substituents.find(item => item.systematicName.includes('fenoxi')).systematicName.replace(/\d-/, '2-');
    assert.equal(functionalProof.verifyLegacyExtendedAliphaticFunctionalModel(graph, wrongRingLocant), false);
  }
});

test('stereogenic catecholamine sidechains preserve each configured R/S center', () => {
  for (const [title, expectedEn, expectedEs] of [
    ['Norepinephrine', '4-[(1R)-2-amino-1-hydroxyethyl]-1,2-benzenediol', '4-[(1R)-2-amino-1-hidroxietil]-1,2-bencenodiol'],
    ['Epinephrine', '4-[(1R)-1-hydroxy-2-(methylamino)ethyl]-1,2-benzenediol', '4-[(1R)-1-hidroxi-2-(metilamino)etil]-1,2-bencenodiol'],
  ]) {
    const row = corpus.compounds.find(item => item.title === title);
    const { graph, result } = resolve(row.isomeric_smiles_pubchem);
    assert.equal(result.englishName, expectedEn, title);
    assert.equal(result.spanishResolution.name, expectedEs, title);
    assert.equal(aromaticProof.verifyLegacyAromaticModel(graph, result.englishModel), true, title);
  }
});

test('wrong ring locants or aromatic N-substituent positions fail closed', () => {
  for (const [title, , , proof] of cases.filter(item => item[3] === 'aromatic' || item[3] === 'amide')) {
    const row = corpus.compounds.find(item => item.title === title);
    const { graph, result } = resolve(row.isomeric_smiles_pubchem);
    const altered = structuredClone(result.englishModel);
    if (proof === 'aromatic') altered.substituents[0].locant = altered.substituents[0].locant === 3 ? 4 : 3;
    else altered.nitrogenSubstituents[0].systematicName = '3-hidroxifenil';
    const valid = proof === 'aromatic'
      ? aromaticProof.verifyLegacyAromaticModel(graph, altered)
      : functionalProof.verifyLegacyAliphaticFunctionalModel(graph, altered);
    assert.equal(valid, false, `${title}: incompatible locant must be rejected`);
  }
});
