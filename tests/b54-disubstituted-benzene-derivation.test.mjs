import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles } from '../scripts/naming-audit/evaluate.mjs';
import { resolveDerivationConsistency } from '../app/derivation-consistency.ts';
import { reconcileSystematicName, validatedNameTargets } from '../app/validated-name-derivation.ts';
import { buildValidatedPriorityReasoning } from '../app/reasoning-derivation-adapter.ts';
import { parseAdditionalSystematicFamily } from '../app/systematic-family-grammar.ts';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';

const { records } = JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json', import.meta.url), 'utf8'));
const cases = [
  { cid: 7731, es: '1-metil-4-metoxibenceno', en: '1-methoxy-4-methylbenzene', groups: ['methyl', 'methoxy'], locants: { es: [1, 4], en: [1, 4] } },
  { cid: 7473, es: '1-metil-4-nitrobenceno', en: '1-methyl-4-nitrobenzene', groups: ['methyl', 'nitro'], locants: { es: [1, 4], en: [1, 4] } },
  { cid: 9603, es: '1-fluoro-4-metilbenceno', en: '1-fluoro-4-methylbenzene', groups: ['fluoro', 'methyl'], locants: { es: [1, 4], en: [1, 4] } },
  { cid: 7931, es: '1-cloro-3-metilbenceno', en: '1-chloro-3-methylbenzene', groups: ['chloro', 'methyl'], locants: { es: [1, 3], en: [1, 3] } },
  { cid: 7236, es: '1-bromo-2-metilbenceno', en: '1-bromo-2-methylbenzene', groups: ['bromo', 'methyl'], locants: { es: [1, 2], en: [1, 2] } },
  { cid: 12207, es: '1-metil-4-yodobenceno', en: '1-iodo-4-methylbenzene', groups: ['methyl', 'iodo'], locants: { es: [1, 4], en: [1, 4] } },
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
const proofFor = (graph, name, language) => resolveDerivationConsistency({
  molecule: graph, activeName: name, activeProfile: 'current', language,
});

for (const item of cases) {
  test(`B5.4 CID ${item.cid}: both localized names receive independent FULL graph proofs`, () => {
    const graph = graphFor(item.cid), engine = chemistry.engine;
    const analyses = analyzeBoth(graph, engine), profiles = displayedProfiles(graph, analyses, engine);
    assert.equal(profiles['2013-es'].name, item.es);
    assert.equal(profiles['2013-en'].name, item.en);
    for (const language of ['es', 'en']) {
      const name = item[language], result = proofFor(graph, name, language);
      assert.equal(result.status, 'verified', `${language}: exact active profile reconciles`);
      assert.ok(result.derivation, `${language}: FULL proof exists`);
      assert.equal(result.derivation.status, 'FULL');
      assert.equal(result.derivation.name, name);
      assert.equal(result.derivation.preferred, false, 'FULL does not claim PIN status');
      assert.equal(result.derivation.principalGroup, 'none', 'substituted benzene has no suffix group');
      assert.deepEqual(result.derivation.components.map(component => component.id).sort(), ['parent', 'prefix-0', 'prefix-1']);

      const parent = result.derivation.components.find(component => component.id === 'parent');
      assert.equal(parent.atomIds.length, 6);
      assert.deepEqual(parent.numbering.map(([, locant]) => locant), [1, 2, 3, 4, 5, 6]);
      assert.ok(parent.atomIds.every(id => graph.atoms.find(atom => atom.id === id)?.element === 'C'));
      assert.equal(parent.bondIds.length, 6, 'the parent contains exactly its six ring bonds');
      const prefixes = result.derivation.components.filter(component => component.id.startsWith('prefix-'));
      assert.deepEqual(prefixes.map(component => component.locant), item.locants[language]);
      assert.ok(prefixes.every(component => component.parentId === 'parent' && component.numbering.length === 1));
      for (const component of prefixes) {
        const term = /^\d+-(.+)$/.exec(component.text)?.[1];
        const expectedElements = /^(?:methyl|metil)$/.test(term) ? ['C']
          : /^(?:methoxy|metoxi)$/.test(term) ? ['O', 'C']
            : term === 'nitro' ? ['N', 'O', 'O']
              : ({ fluoro: ['F'], cloro: ['Cl'], chloro: ['Cl'], bromo: ['Br'], yodo: ['I'], iodo: ['I'] })[term];
        assert.deepEqual(component.atomIds.map(id => graph.atoms.find(atom => atom.id === id)?.element), expectedElements,
          `${component.text} selects its exact substituent atoms`);
        const internalBonds = expectedElements.length - 1;
        assert.equal(component.bondIds.length, internalBonds + 1, `${component.text} includes only its internal and ring-attachment bonds`);
        const [ringAtom, branchAtom] = component.bondIds.find(([a, b]) =>
          parent.atomIds.includes(a) !== parent.atomIds.includes(b)) ?? [];
        assert.equal(parent.numbering.find(([id]) => id === ringAtom)?.[1], component.locant, `${component.text} attaches at its written ring locant`);
        assert.ok(component.atomIds.includes(branchAtom));
      }
      assert.ok(result.derivation.components.every(component =>
        name.slice(component.start, component.end) === component.text), 'each proof component is a literal name span');

      const reasoning = buildValidatedPriorityReasoning({ derivation: result.derivation, graph, language });
      assert.equal(reasoning.name, name);
      assert.ok(reasoning.steps.some(step => step.componentIds.includes('parent')));
      assert.ok(reasoning.steps.some(step => step.componentIds.includes('prefix-0') && step.componentIds.includes('prefix-1')));
      const numbering = reasoning.steps.find(step => step.title === (language === 'en' ? 'Numbering' : 'Numeración'));
      const publishedLocants = new Set(Object.values(numbering.fragmentTargets).flatMap(target => target.locants.map(([, locant]) => locant)));
      assert.deepEqual([...publishedLocants].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6],
        'the FULL interactive reasoning publishes all six aromatic locants');

      const targets = validatedNameTargets(result.derivation);
      const atomIds = new Set(Object.values(targets).flatMap(target => target.atomIds));
      const bonds = new Set(Object.values(targets).flatMap(target => target.bondIds.map(edgeKey)));
      assert.equal(atomIds.size, graph.atoms.length, 'parent and both substituents cover every atom');
      assert.equal(bonds.size, graph.bonds.length, 'parent and both substituents cover every bond');
      for (const target of Object.values(targets)) for (const bond of target.bondIds)
        assert.ok(graph.bonds.some(candidate => edgeKey(candidate) === edgeKey(bond)), 'every control edge exists in the imported graph');
    }
  });

  test(`B5.4 CID ${item.cid}: name proof survives atom IDs, bond order, geometry and round trip`, () => {
    const original = graphFor(item.cid), idMap = new Map(original.atoms.map((atom, i) => [atom.id, 500 + 13 * i]));
    const permuted = { ...original,
      atoms: [...original.atoms].reverse().map(atom => ({ ...atom, id: idMap.get(atom.id), x: -atom.y + 19, y: atom.x - 8 })),
      bonds: [...original.bonds].reverse().map(([a, b, ...rest]) => [idMap.get(b), idMap.get(a), ...rest]),
      rings: (original.rings ?? []).map(ring => ({ ...ring, atomIds: ring.atomIds.map(id => idMap.get(id)).reverse() })),
    };
    const originalExport = moleculeToSmiles(original), permutedExport = moleculeToSmiles(permuted);
    assert.equal(originalExport.ok, true); assert.equal(permutedExport.ok, true);
    assert.equal(structuralIdentity(originalExport.smiles), structuralIdentity(permutedExport.smiles));
    for (const language of ['es', 'en', 'es']) {
      const proof = proofFor(permuted, item[language], language).derivation;
      assert.ok(proof, `${language}: permuted graph retains the proof`);
      const mappedAtoms = new Set(proof.components.flatMap(component => component.atomIds));
      assert.deepEqual(mappedAtoms, new Set(permuted.atoms.map(atom => atom.id)));
    }
    const reimported = moleculeFromSmiles(permutedExport.smiles);
    assert.equal(reimported.ok, true, reimported.error);
    assert.ok(proofFor(reimported.molecule, item.en, 'en').derivation, 'exported/reimported graph reconciles');
  });
}

test('B5.4 rejects wrong positions, identities, language order, connectivity and incomplete substituents', () => {
  const anisole = graphFor(7731), nitrotoluene = graphFor(7473), fluoro = graphFor(9603), metaChloro = graphFor(7931);
  for (const wrong of [
    '1-methoxy-2-methylbenzene', '1-methoxy-3-methylbenzene',
    '1-methoxy-4-methoxybenzene', '1-methyl-1-methoxybenzene',
    '1-methyl-4-methoxybenzene', '1-metoxi-4-metilbenceno',
  ]) assert.equal(reconcileSystematicName(anisole, wrong), null, `anisole rejects ${wrong}`);
  for (const wrong of ['1-methyl-4-aminobenzene', '1-methyl-4-methylbenzene'])
    assert.equal(reconcileSystematicName(nitrotoluene, wrong), null, `nitro identity rejects ${wrong}`);
  for (const wrong of ['1-chloro-4-methylbenzene', '1-bromo-4-methylbenzene', '1-iodo-4-methylbenzene'])
    assert.equal(reconcileSystematicName(fluoro, wrong), null, `fluoro identity rejects ${wrong}`);
  for (const wrong of ['1-chloro-2-methylbenzene', '1-chloro-4-methylbenzene'])
    assert.equal(reconcileSystematicName(metaChloro, wrong), null, `meta graph rejects regioisomer ${wrong}`);

  const missingMethoxyOxygen = { ...anisole, atoms: anisole.atoms.filter(atom => atom.element !== 'O'),
    bonds: anisole.bonds.filter(([a, b]) => anisole.atoms.find(atom => atom.id === a)?.element !== 'O'
      && anisole.atoms.find(atom => atom.id === b)?.element !== 'O') };
  assert.equal(reconcileSystematicName(missingMethoxyOxygen, '1-methoxy-4-methylbenzene'), null);
  const changedNitroCharge = { ...nitrotoluene, atoms: nitrotoluene.atoms.map(atom => atom.charge ? { ...atom, charge: 0 } : atom) };
  assert.equal(reconcileSystematicName(changedNitroCharge, '1-methyl-4-nitrobenzene'), null);
  const changedAromaticOrder = { ...anisole, bonds: anisole.bonds.map(([a, b, order, ...rest]) =>
    [a, b, order === 2 && a !== 2 && b !== 2 ? 1 : order, ...rest]) };
  assert.equal(reconcileSystematicName(changedAromaticOrder, '1-methoxy-4-methylbenzene'), null);
});

test('B5.4 does not admit unrequested disubstituted benzene families', () => {
  for (const name of [
    '1,4-dimethylbenzene', '1-methyl-4-methylbenzene', '1-chloro-4-nitrobenzene',
    '1-methoxy-4-methoxybenzene', '1-fluoro-4-iodobenzene', '4-methylbenzene',
  ]) assert.equal(parseAdditionalSystematicFamily(name), null, name);
});
