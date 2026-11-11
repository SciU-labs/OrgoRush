import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { translateSpanishIupacForDisplay, translateSpanishIupacToOpsin } from '../app/iupac-name-normalization.ts';
import { analyzeBoth, displayedProfiles } from '../scripts/naming-audit/evaluate.mjs';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';

const regioisomers = [
  ['2,3', 'n1c(C(=O)O)c(C(=O)O)ccc1'],
  ['2,4', 'n1c(C(=O)O)cc(C(=O)O)cc1'],
  ['2,5', 'n1c(C(=O)O)ccc(C(=O)O)c1'],
  ['2,6', 'n1c(C(=O)O)cccc1C(=O)O'],
  ['3,4', 'n1cc(C(=O)O)c(C(=O)O)cc1'],
  ['3,5', 'n1cc(C(=O)O)cc(C(=O)O)c1'],
];

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

test('pyridine diacids use the graph-derived suffix locants in Spanish and English', () => {
  for (const [locants, smiles] of regioisomers) {
    const imported = moleculeFromSmiles(smiles);
    assert.ok(imported.ok, imported.error);
    const analysis = chemistry.engine.analyzeMolecule(imported.molecule);
    const profiles = displayedProfiles(imported.molecule, analyzeBoth(imported.molecule, chemistry.engine), chemistry.engine);
    const es = `ácido piridina-${locants}-dicarboxílico`;
    const en = `pyridine-${locants}-dicarboxylic acid`;
    assert.equal(profiles['2013-es'].name, es, smiles);
    assert.equal(profiles['2013-en'].name, en, smiles);
    assert.equal(analysis.primaryFunctionalGroup, 'carboxylicAcid');
    assert.equal(analysis.functionalGroups.length, 2);
    assert.deepEqual(analysis.functionalGroups.map((group) => group.kind), ['carboxylicAcid', 'carboxylicAcid']);
    const acidLocants = analysis.functionalGroups.map((group) => {
      const ringCarbon = imported.molecule.bonds.find(([a, b]) =>
        (a === group.carbonId && analysis.numberedAtoms.has(b))
        || (b === group.carbonId && analysis.numberedAtoms.has(a)));
      assert.ok(ringCarbon, 'carbonyl carbon is directly attached to the numbered pyridine parent');
      const attachment = ringCarbon[0] === group.carbonId ? ringCarbon[1] : ringCarbon[0];
      return analysis.numberedAtoms.get(attachment);
    }).sort((a, b) => a - b);
    assert.equal(acidLocants.join(','), locants);
    assert.deepEqual(analysis.substituents, [], 'carboxyl carbonyls are not carbon substituents');
    assert.equal(reconcileSystematicName(imported.molecule, es), null,
      'the correction supplies no FULL derivation proof and leaves the existing barrier in place');
    assert.equal(reconcileSystematicName(imported.molecule, en), null,
      'the correction supplies no FULL derivation proof and leaves the existing barrier in place');
    assert.equal(translateSpanishIupacToOpsin(es), en);
    assert.equal(translateSpanishIupacForDisplay(es), en);
  }
});

test('pyridine diacid locants survive Kekulé form, graph reordering, and drawing changes', () => {
  const sources = [
    'n1cc(C(=O)O)cc(C(=O)O)c1',
    'C1=C(C=NC=C1C(=O)O)C(=O)O',
    'O=C(O)c1cc(C(=O)O)cnc1',
  ];
  const expected = 'ácido piridina-3,5-dicarboxílico';
  const identities = sources.map((smiles) => {
    const parsed = moleculeFromSmiles(smiles);
    assert.ok(parsed.ok, parsed.error);
    const analysis = chemistry.engine.analyzeMolecule(parsed.molecule);
    assert.equal(analysis.name, expected);
    return structuralIdentity(smiles);
  });
  assert.ok(identities.every((identity) => identity === identities[0]), 'aromatic/Kekulé traversals encode the same graph');

  const original = moleculeFromSmiles(sources[0]).molecule;
  const idMap = new Map(original.atoms.map((atom, index) => [atom.id, 1000 + 17 * index]));
  const reordered = {
    atoms: [...original.atoms].reverse().map((atom) => ({
      ...atom, id: idMap.get(atom.id), x: -atom.y + 11, y: atom.x - 7,
    })),
    bonds: [...original.bonds].reverse().map(([a, b, ...rest]) => [idMap.get(b), idMap.get(a), ...rest]),
    rings: original.rings.map((ring) => ({
      ...ring, atomIds: [...ring.atomIds.slice(2), ...ring.atomIds.slice(0, 2)].reverse().map((id) => idMap.get(id)),
    })),
  };
  const permutedAnalysis = chemistry.engine.analyzeMolecule(reordered);
  assert.equal(permutedAnalysis.name, expected);
  assert.deepEqual(permutedAnalysis.functionalGroups.map((group) => group.kind), ['carboxylicAcid', 'carboxylicAcid']);
});

test('pyridine carboxyl recognition excludes other functions, rings, and added substituents', () => {
  const controls = [
    ['bare pyridine', 'n1ccccc1', /piridina/i, 0],
    ['one pyridine carboxyl', 'O=C(O)c1ccccn1', /ácido piridina-2-carboxílico/i, 1],
    ['true isopropyl substituent', 'CC(C)c1cccnc1', /piridina/i, 0],
    ['pyridine diester', 'COC(=O)c1cc(C(=O)OC)ccn1', /.+/, 0],
    ['pyridine diamide', 'NC(=O)c1cc(C(=O)N)ccn1', /.+/, 0],
    ['pyridine triacid', 'O=C(O)c1c(C(=O)O)cc(C(=O)O)cn1', /.+/, 3],
    ['benzene diacid', 'O=C(O)c1ccc(C(=O)O)cc1', /.+/, 2],
    ['diazine diacid', 'O=C(O)c1cncc(C(=O)O)n1', /.+/, 2],
  ];
  for (const [label, smiles, namePattern, acidCount] of controls) {
    const parsed = moleculeFromSmiles(smiles);
    assert.ok(parsed.ok, `${label}: ${parsed.ok ? '' : parsed.error}`);
    const analysis = chemistry.engine.analyzeMolecule(parsed.molecule);
    const detectedAcidCount = chemistry.oracles.detectFunctionalGroups(parsed.molecule)
      .filter((group) => group.kind === 'carboxylicAcid').length;
    assert.match(analysis.name, namePattern, label);
    assert.equal(detectedAcidCount, acidCount, label);
    assert.doesNotMatch(analysis.name, /piridina-\d+(?:,\d+)*-dicarbox|pyridine-\d+(?:,\d+)*-dicarbox/i, label);
  }
});
