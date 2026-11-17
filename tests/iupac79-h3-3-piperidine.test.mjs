import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CanonizerUtil, Molecule, SmilesParser } from 'openchemlib';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { nameLegacyPiperidineComposition, numberLegacyPiperidineRings } from '../app/iupac1979-piperidine-compositions.ts';
import { verifiedPubChemCommonName } from '../app/verified-common-name-equivalences.ts';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';

const cases = [
  { title: 'Fentanyl', cid: 3345, inchiKey: 'PJMPHNIQZUBGLI-UHFFFAOYSA-N', smiles: 'CCC(=O)N(C1CCN(CC1)CCC2=CC=CC=C2)C3=CC=CC=C3', en: 'N-[1-(2-phenylethyl)-4-piperidyl]propionanilide', es: 'N-[1-(2-feniletil)-4-piperidil]propionanilida' },
  { title: 'Haloperidol', cid: 3559, inchiKey: 'LNEPOXFFQSENCJ-UHFFFAOYSA-N', smiles: 'C1CN(CCC1(C2=CC=C(C=C2)Cl)O)CCCC(=O)C3=CC=C(C=C3)F', en: '4-[4-(4-chlorophenyl)-4-hydroxypiperidino]-1-(4-fluorophenyl)-1-butanone', es: '4-[4-(4-clorofenil)-4-hidroxipiperidino]-1-(4-fluorofenil)-1-butanona' },
  { title: 'Piperoxan', cid: 6040, inchiKey: 'LYKMMUBOEFYJQG-UHFFFAOYSA-N', smiles: 'C1CCN(CC1)CC2COC3=CC=CC=C3O2', en: '1-[(2,3-dihydro-1,4-benzodioxin-2-yl)methyl]piperidine', es: '1-[(2,3-dihidro-1,4-benzodioxin-2-il)metil]piperidina' },
];
const graph = smiles => { const result = moleculeFromSmiles(smiles); assert(result.ok, result.error); return result.molecule; };
const identity = smiles => { const molecule = new SmilesParser().parseMolecule(smiles); molecule.ensureHelperArrays(Molecule.cHelperCIP); return CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL); };

test('H3.3 generates local 1979 names in both languages and preserves complete molecular identity', async () => {
  const chemistry = await loadExerciseChemistry();
  try {
    for (const entry of cases) {
      const molecule = graph(entry.smiles);
      const proof = nameLegacyPiperidineComposition(molecule);
      assert.ok(proof, `${entry.title}: graph pattern is recognized`);
      const analysis = chemistry.engine.analyzeMolecule(molecule, [], 'iupac-1979-legacy');
      const resolution = chemistry.engine.resolveLegacyNomenclature(molecule, analysis);
      assert.equal(resolution.chemicallyAvailable, true, `${entry.title}: local chemistry is available`);
      assert.equal(resolution.englishName, entry.en);
      assert.equal(resolution.spanishResolution.status, 'TRANSLATED_FROM_LEGACY_EN');
      assert.equal(resolution.spanishResolution.name, entry.es);
      assert.equal(resolution.spanishResolution.rule, proof.rule);
      assert.equal(/\(\d+[RS]\)|\(\d+[EZ]\)/.test(entry.en), false, 'no undefined stereodescriptors are invented');
      assert.equal(verifiedPubChemCommonName({ cid: entry.cid, inchiKey: entry.inchiKey }, 'en'), entry.title);
      const spanishTitle = entry.title === 'Fentanyl' ? 'Fentanilo' : entry.title === 'Piperoxan' ? 'Piperoxano' : 'Haloperidol';
      assert.equal(verifiedPubChemCommonName({ cid: entry.cid, inchiKey: entry.inchiKey }, 'es'), spanishTitle);
      assert.equal(verifiedPubChemCommonName({ cid: entry.cid + 1, inchiKey: entry.inchiKey }, 'es'), null, 'common title requires exact CID and InChIKey');
      const exported = moleculeToSmiles(molecule); assert(exported.ok, exported.error);
      assert.equal(identity(exported.smiles), identity(entry.smiles), 'SMILES roundtrip preserves full identity');
    }
  } finally { await chemistry.close(); }
});

test('piperidine parent numbering generalizes to off-corpus substitution positions and N-substitution', () => {
  for (const [smiles, carbonLocant, nSubstituted] of [
    ['CC1CCCCN1', '2', false],
    ['CC1CCNCC1', '4', false],
    ['CN1CCCCC1', undefined, true],
  ]) {
    const molecule = graph(smiles), numbered = numberLegacyPiperidineRings(molecule);
    assert.equal(numbered.length, 1);
    const substituent = molecule.bonds.find(([a, b]) => {
      const ring = new Set(numbered[0].ring); return ring.has(a) !== ring.has(b);
    });
    if (carbonLocant) {
      const attachment = substituent[0] && numbered[0].ring.includes(substituent[0]) ? substituent[0] : substituent[1];
      assert.equal(numbered[0].locants.get(attachment), carbonLocant, `${smiles}: lowest locant is selected`);
    } else {
      assert.equal(numbered[0].nitrogen, molecule.atoms.find(atom => atom.element === 'N').id, 'N substituent retains locant 1');
      assert.equal(nSubstituted, true);
    }
  }
});

test('bounded piperidine compositions reject constitutional isomers and unsupported extension chemistry', () => {
  const negatives = [
    'CCC(=O)N(c1ccccc1)C1CCC(CC1)NCCc2ccccc2', // altered fentanyl linkage/connectivity
    'C1CCN(CC1)CC2COC3=CC=CC(Cl)=C3O2', // substituted fused isomer is outside this bounded name grammar
  ];
  for (const smiles of negatives) assert.equal(nameLegacyPiperidineComposition(graph(smiles)), undefined, smiles);
});
