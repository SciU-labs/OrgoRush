import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles } from '../scripts/naming-audit/evaluate.mjs';
import { resolveDerivationConsistency } from '../app/derivation-consistency.ts';
import { reconcileSystematicName, validatedNameTargets } from '../app/validated-name-derivation.ts';
import { buildValidatedPriorityReasoning } from '../app/reasoning-derivation-adapter.ts';
import { verifiedStructuralReasoning } from '../app/verified-structural-reasoning.ts';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';

const { records } = JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json', import.meta.url), 'utf8'));
const cases = [
  { cid: 326, es: '4-(1-metiletil)benzaldehído', en: '4-(1-methylethyl)benzaldehyde', group: 'aldehyde' },
  { cid: 7455, es: '4-metilbenzoato de metilo', en: 'methyl 4-methylbenzoate', group: 'ester' },
];
let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

const edgeKey = ([a, b]) => [a, b].sort((x, y) => x - y).join(':');
const recordFor = cid => records.find(record => record.cid === cid);
const graphFor = cid => {
  const parsed = moleculeFromSmiles(recordFor(cid).smiles);
  assert.equal(parsed.ok, true, parsed.error);
  return parsed.molecule;
};
const resolve = (graph, name, language, currentSourceName) => resolveDerivationConsistency({
  molecule: graph, activeName: name, activeProfile: 'current', language, currentSourceName,
});
const componentById = (proof, id) => {
  const component = proof.components.find(candidate => candidate.id === id);
  assert.ok(component, `proof contains ${id}`);
  return component;
};
const clone = graph => ({ ...graph, atoms: graph.atoms.map(atom => ({ ...atom })),
  bonds: graph.bonds.map(bond => [...bond]) });
const deleteAtom = (graph, id) => ({ ...graph, atoms: graph.atoms.filter(atom => atom.id !== id),
  bonds: graph.bonds.filter(([a, b]) => a !== id && b !== id) });
const union = values => new Set(values.flatMap(value => value));

for (const item of cases) test(`B5.5 CID ${item.cid}: ES and EN names independently reconstruct FULL evidence`, () => {
  const graph = graphFor(item.cid), analyses = analyzeBoth(graph, chemistry.engine);
  const profiles = displayedProfiles(graph, analyses, chemistry.engine);
  assert.equal(profiles['2013-es'].name, item.es);
  assert.equal(profiles['2013-en'].name, item.en);
  const identities = [];
  for (const language of ['es', 'en']) {
    const name = item[language], result = resolve(graph, name, language, item.en);
    assert.equal(result.status, 'verified');
    assert.equal(result.derivation.status, 'FULL');
    assert.equal(result.derivation.name, name, 'localized name is parsed directly as the proof key');
    assert.equal(result.derivation.preferred, false);
    assert.equal(result.derivation.principalGroup, item.group);
    assert.ok(result.otherEvidence === null, 'the Spanish FULL result is independent, not borrowed English evidence');
    assert.ok(result.derivation.components.every(component => name.slice(component.start, component.end) === component.text),
      'all component spans match literal name text');
    const parent = componentById(result.derivation, 'parent');
    const suffix = componentById(result.derivation, 'suffix');
    const prefix = componentById(result.derivation, 'prefix-0');
    if (language === 'es') {
      assert.ok([parent, suffix, prefix].every(component =>
        !/\b(parent|aromatic|substituent|ester oxygen)\b/i.test(component.explanation)),
      'Spanish evidence does not leak English parser terms or internal IDs');
    }
    assert.equal(prefix.locant, 4);
    const ring = graph.rings.find(candidate => candidate.kind === 'aromatic' && candidate.atomIds.length === 6);
    assert.ok(ring);
    const carbonyl = suffix.atomIds.find(id => graph.atoms.find(atom => atom.id === id)?.element === 'C');
    const carbonylOxygen = suffix.atomIds.find(id => graph.atoms.find(atom => atom.id === id)?.element === 'O'
      && graph.bonds.some(([a, b, order]) => (a === id && b === carbonyl || b === id && a === carbonyl) && order === 2));
    assert.ok(carbonyl !== undefined && !ring.atomIds.includes(carbonyl), 'carbonyl carbon is external to aromatic ring');
    assert.ok(carbonylOxygen !== undefined, 'carbonyl oxygen and double bond are explicit');
    const parentRingBondKeys = parent.bondIds.map(edgeKey);
    for (const [a, b] of graph.bonds.filter(([a, b]) => ring.atomIds.includes(a) && ring.atomIds.includes(b)))
      assert.ok(parentRingBondKeys.includes(edgeKey([a, b])), 'parent region contains every aromatic ring bond');
    assert.ok(parent.numbering.some(([atomId, locant]) => ring.atomIds.includes(atomId) && locant === 1));
    assert.ok(parent.numbering.some(([atomId, locant]) => ring.atomIds.includes(atomId) && locant === 4));
    const prefixTarget = validatedNameTargets(result.derivation)['prefix-0'];
    assert.deepEqual(prefixTarget.locants.map(([, locant]) => locant), [4]);

    if (item.cid === 326) {
      assert.equal(parent.atomIds.length, 7, 'benzaldehyde parent contains six ring atoms and the exocyclic aldehyde carbon');
      assert.equal(prefix.atomIds.length, 3, '1-methylethyl is reconstructed as a three-carbon substituent');
      assert.ok(prefix.atomIds.every(id => graph.atoms.find(atom => atom.id === id)?.element === 'C'));
      assert.equal(prefix.bondIds.length, 3, 'two internal branch bonds and the ring attachment are covered');
      assert.ok(prefix.bondIds.some(([a, b]) => ring.atomIds.includes(a) !== ring.atomIds.includes(b)));
      assert.ok(graph.bonds.some(([a, b, order]) => (a === carbonyl && b === carbonylOxygen || b === carbonyl && a === carbonylOxygen) && order === 2));
      assert.ok(graph.bonds.some(([a, b]) => (a === carbonyl && ring.atomIds.includes(b)) || (b === carbonyl && ring.atomIds.includes(a))));
    } else {
      const esterAlcohol = componentById(result.derivation, 'ester-alkyl');
      assert.equal(parent.atomIds.length, 7, 'benzoate parent contains six ring atoms and its exocyclic carbonyl carbon');
      assert.deepEqual(suffix.atomIds.map(id => graph.atoms.find(atom => atom.id === id)?.element).sort(), ['C', 'O', 'O']);
      assert.equal(suffix.bondIds.length, 2, 'ester function contains C=O and C–O');
      assert.equal(prefix.atomIds.length, 1, 'ring methyl is a separate one-carbon region');
      assert.equal(esterAlcohol.atomIds.length, 1, 'alcohol-derived methyl is a separate one-carbon region');
      assert.notEqual(prefix.atomIds[0], esterAlcohol.atomIds[0], 'the two methyl groups have distinct graph atoms');
      const ringMethylBond = prefix.bondIds.find(([a, b]) => ring.atomIds.includes(a) !== ring.atomIds.includes(b));
      const esterO = suffix.atomIds.find(id => graph.atoms.find(atom => atom.id === id)?.element === 'O'
        && id !== carbonylOxygen);
      assert.ok(ringMethylBond && (ring.atomIds.includes(ringMethylBond[0]) ? ringMethylBond[1] : ringMethylBond[0]) === prefix.atomIds[0]);
      assert.ok(esterO !== undefined && graph.bonds.some(([a, b]) => a === esterO && b === esterAlcohol.atomIds[0]
        || b === esterO && a === esterAlcohol.atomIds[0]), 'alcohol-derived methyl is attached through ester oxygen');
      assert.equal(prefix.bondIds.length, 1);
      assert.equal(esterAlcohol.bondIds.length, 1);
    }

    const targets = validatedNameTargets(result.derivation), atomUnion = union(Object.values(targets).map(target => target.atomIds));
    const bondUnion = new Set(Object.values(targets).flatMap(target => target.bondIds.map(edgeKey)));
    assert.equal(atomUnion.size, graph.atoms.length, 'interactive regions cover every molecular atom');
    assert.equal(bondUnion.size, graph.bonds.length, 'interactive regions cover every molecular bond');
    for (const target of Object.values(targets)) for (const [a, b] of target.bondIds)
      assert.ok(graph.bonds.some(edge => edgeKey(edge) === edgeKey([a, b])), 'visual target edges exist in the validated graph');

    const priority = buildValidatedPriorityReasoning({ derivation: result.derivation, graph, language });
    assert.equal(priority.name, name);
    assert.ok(priority.steps.some(step => step.componentIds.includes('parent')));
    assert.ok(priority.steps.some(step => step.componentIds.includes('suffix')));
    assert.ok(priority.steps.some(step => step.componentIds.includes('prefix-0')));
    if (item.cid === 7455) assert.ok(priority.steps.some(step => step.componentIds.includes('ester-alkyl')));
    const structural = verifiedStructuralReasoning({ molecule: graph, derivation: result.derivation,
      consistency: result.status, activeProfile: 'current', language });
    assert.ok(structural.some(explanation => explanation.id === 'full-parent-selection'));
    identities.push(structuralIdentity(moleculeToSmiles(graph).smiles));
  }
  assert.equal(identities[0], identities[1], 'Spanish and English proofs reconstruct the same constitution');
});

test('B5.5 rejects incorrect aldehyde names and aldehyde graphs', () => {
  const graph = graphFor(326), proof = reconcileSystematicName(graph, cases[0].en);
  for (const wrong of [
    '2-(1-metiletil)benzaldehído', '3-(1-metiletil)benzaldehído', '4-etilbenzaldehído',
    '4-(1-metiletil)acetofenona',
  ]) {
    assert.equal(reconcileSystematicName(graph, wrong), null, wrong);
  }
  assert.ok(proof);
  const branch = componentById(proof, 'prefix-0').atomIds;
  const ring = graph.rings.find(candidate => candidate.kind === 'aromatic' && candidate.atomIds.length === 6).atomIds;
  const root = branch.find(id => graph.bonds.filter(([a, b]) => (a === id && ring.includes(b) || b === id && ring.includes(a))).length === 1);
  const internal = graph.bonds.filter(([a, b]) => branch.includes(a) && branch.includes(b));
  const rootEdge = internal.find(([a, b]) => a === root || b === root);
  const moved = clone(graph), [from, to] = rootEdge;
  moved.bonds = moved.bonds.filter(edge => edgeKey(edge) !== edgeKey(rootEdge));
  const other = from === root ? to : from;
  const terminal = branch.find(id => id !== root && id !== other);
  moved.bonds.push([other, terminal, 1]);
  assert.equal(reconcileSystematicName(moved, cases[0].es), null, 'n-propyl connectivity cannot pass as 1-methylethyl');

  const missingAldehyde = deleteAtom(graph, proof.components.find(component => component.id === 'suffix').atomIds[0]);
  assert.equal(reconcileSystematicName(missingAldehyde, cases[0].es), null, 'a missing aldehyde carbon fails identity');
  const ketoneGraph = clone(graph), suffixCarbon = proof.components.find(component => component.id === 'suffix').atomIds
    .find(id => graph.atoms.find(atom => atom.id === id)?.element === 'C');
  const methylId = Math.max(...ketoneGraph.atoms.map(atom => atom.id)) + 1;
  ketoneGraph.atoms.push({ id: methylId, element: 'C', x: 0, y: 0 });
  ketoneGraph.bonds.push([suffixCarbon, methylId, 1]);
  assert.equal(reconcileSystematicName(ketoneGraph, cases[0].es), null, 'adding a second carbon neighbour changes the aldehyde into a ketone');
  const wrongCarbonylParent = clone(graph), carbonyl = proof.components.find(component => component.id === 'suffix').atomIds
    .find(id => graph.atoms.find(atom => atom.id === id)?.element === 'C');
  const ringAtom = ring.find(id => graph.bonds.some(([a, b]) => (a === carbonyl && b === id) || (b === carbonyl && a === id)));
  const alternateRingAtom = ring.find(id => id !== ringAtom && graph.bonds.some(([a, b]) => ring.includes(a) && ring.includes(b))
    && !graph.bonds.some(([a, b]) => (a === carbonyl && b === id) || (b === carbonyl && a === id)));
  wrongCarbonylParent.bonds = wrongCarbonylParent.bonds.filter(edge => edgeKey(edge) !== edgeKey([carbonyl, ringAtom]));
  wrongCarbonylParent.bonds.push([carbonyl, alternateRingAtom, 1]);
  assert.equal(reconcileSystematicName(wrongCarbonylParent, cases[0].es), null, 'aldehyde attached at another ring atom fails the written locants');
});

test('B5.5 rejects wrong benzoate locants, alcohol alkyl, oxygen linkage and acid identity', () => {
  const graph = graphFor(7455);
  for (const wrong of [
    '3-metilbenzoato de metilo', '2-metilbenzoato de metilo', 'benzoato de metilo',
    '4-metilbenzoato de etilo', '4-methylbenzoic acid',
  ]) assert.equal(reconcileSystematicName(graph, wrong), null, wrong);
  const proof = reconcileSystematicName(graph, cases[1].es);
  assert.ok(proof);
  const esterAlcohol = componentById(proof, 'ester-alkyl').atomIds[0];
  const ringMethyl = componentById(proof, 'prefix-0').atomIds[0];
  assert.notEqual(esterAlcohol, ringMethyl, 'the component targets distinguish both methyl groups');
  const esterO = componentById(proof, 'suffix').atomIds.find(id => graph.atoms.find(atom => atom.id === id)?.element === 'O'
    && graph.bonds.filter(([a, b]) => a === id || b === id).length === 2);
  assert.ok(esterO !== undefined);
  const missingEsterO = deleteAtom(graph, esterO);
  assert.equal(reconcileSystematicName(missingEsterO, cases[1].es), null, 'omitting the ester oxygen fails');
  const wrongOxygenLink = clone(graph);
  wrongOxygenLink.bonds = wrongOxygenLink.bonds.filter(edge => edgeKey(edge) !== edgeKey([esterO, esterAlcohol]));
  wrongOxygenLink.bonds.push([ringMethyl, esterAlcohol, 1]);
  assert.equal(reconcileSystematicName(wrongOxygenLink, cases[1].es), null, 'the O–C ester linkage cannot be replaced with a C–C link');
});

test('B5.5 local aromatic derivations are invariant under atom IDs, edge order and SMILES round trips', () => {
  for (const item of cases) {
    const original = graphFor(item.cid), idMap = new Map(original.atoms.map((atom, index) => [atom.id, 1000 + 17 * index]));
    const permuted = { ...original,
      atoms: [...original.atoms].reverse().map(atom => ({ ...atom, id: idMap.get(atom.id), x: -atom.y + 7, y: atom.x - 21 })),
      bonds: [...original.bonds].reverse().map(([a, b, ...rest]) => [idMap.get(b), idMap.get(a), ...rest]),
      rings: original.rings.map(ring => ({ ...ring, atomIds: [...ring.atomIds].reverse().map(id => idMap.get(id)) })),
    };
    const originalExport = moleculeToSmiles(original), permutedExport = moleculeToSmiles(permuted);
    assert.equal(originalExport.ok, true); assert.equal(permutedExport.ok, true);
    assert.equal(structuralIdentity(originalExport.smiles), structuralIdentity(permutedExport.smiles));
    for (const order of [['es', 'en', 'es'], ['en', 'es', 'en']]) {
      for (const language of order) {
        const result = resolve(permuted, item[language], language, item.en);
        assert.equal(result.status, 'verified');
        assert.equal(result.derivation.name, item[language]);
        const selected = new Set(result.derivation.components.flatMap(component => component.atomIds));
        assert.deepEqual(selected, new Set(permuted.atoms.map(atom => atom.id)));
      }
    }
    const reimported = moleculeFromSmiles(permutedExport.smiles);
    assert.equal(reimported.ok, true, reimported.error);
    for (const language of ['es', 'en']) assert.equal(resolve(reimported.molecule, item[language], language).status, 'verified');
  }
});
