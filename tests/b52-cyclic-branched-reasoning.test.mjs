import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles, resolvedProfileAnalyses } from '../scripts/naming-audit/evaluate.mjs';
import { buildReasoningVisualReferences, reasoningFragmentId } from '../app/reasoning-visual-targets.ts';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { assertReasoningIntegrity, evidence } from './helpers/reasoning-integrity.mjs';

const { records } = JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json', import.meta.url), 'utf8'));
const cases = [
  { cid: 1254, es: '5-metil-2-(1-metiletil)ciclohexanol', en: '5-methyl-2-(1-methylethyl)cyclohexanol', function: 'alcohol', subs: [2, 5], unsaturation: [] },
  { cid: 326, es: '4-(1-metiletil)benzaldehído', en: '4-(1-methylethyl)benzaldehyde', function: 'aldehyde', subs: [4], unsaturation: [] },
  { cid: 7439, es: '2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona', en: '2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one', function: 'ketone', subs: [2, 5], unsaturation: [2] },
];
let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

const edge = ([a, b]) => [a, b].sort((x, y) => x - y).join(':');
const edgeSet = (pairs) => pairs.map(edge).sort();
const inducedEdges = (molecule, ids) => molecule.bonds
  .filter(([a, b]) => ids.has(a) && ids.has(b)).map(([a, b]) => [a, b]);
const parts = (model) => evidence(model);

function project(engine, molecule, lang) {
  const analyses = analyzeBoth(molecule, engine), profiles = displayedProfiles(molecule, analyses, engine);
  const profile = profiles[`2013-${lang}`];
  const selected = resolvedProfileAnalyses(molecule, analyses, profile, engine);
  const model = engine.buildActiveIupacReasoning({ molecule, analyses: selected, ...profile,
    displayedName: profile.name, generatedNames: Object.values(profiles).map((item) => item.name).filter(Boolean), canHighlight: true });
  const refs = buildReasoningVisualReferences({ molecule, analysis: model.analysis, steps: model.steps,
    fragments: model.fragments, displayedName: profile.name, enabled: true });
  assertReasoningIntegrity(model, molecule);
  return { analyses, profile, model, refs };
}

function targetFor(refs, step, fragment) {
  return refs.fragments[reasoningFragmentId(step, fragment)];
}

function assertGraphRegion(target, molecule, expectedAtoms, expectedBonds, description) {
  assert.ok(target, `${description} has a projected canvas target`);
  assert.deepEqual(new Set(target.atomIds), new Set(expectedAtoms), `${description} atoms`);
  assert.deepEqual(edgeSet(target.bondIds), edgeSet(expectedBonds), `${description} bonds`);
  for (const pair of target.bondIds) assert.ok(molecule.bonds.some(([a, b]) => edge([a, b]) === edge(pair)), `${description} edge exists`);
}

for (const item of cases) {
  const source = records.find((record) => record.cid === item.cid);
  test(`B5.2 CID ${item.cid}: reproducible local model exposes parent, function and branch evidence`, () => {
    const parsed = moleculeFromSmiles(source.smiles);
    assert.equal(parsed.ok, true, parsed.error);
    const molecule = parsed.molecule, engine = chemistry.engine;
    assert.equal(engine.localNamerCannotSafelyName(molecule, engine.analyzeMolecule(molecule)), false);
    const analyses = analyzeBoth(molecule, engine), initial = displayedProfiles(molecule, analyses, engine);
    assert.equal(initial['2013-es'].name, item.es);
    assert.equal(initial['2013-en'].name, item.en);
    for (const lang of ['es', 'en']) {
      const { model, refs } = project(engine, molecule, lang);
      const available = parts(model);
      // This assertion reproduces B5.1's regression: current code emits no evidence.
      assert.ok(available.length > 0, `${lang}: parenthesized substituents must not suppress every fragment`);
      assert.equal(model.displayedName, item[lang]);

      const parent = available.find((fragment) => fragment.kind === 'parent');
      assert.ok(parent, `${lang}: parent fragment`);
      assertGraphRegion(targetFor(refs, parent.stepNumber, parent), molecule,
        model.analysis.mainChain, inducedEdges(molecule, new Set(model.analysis.mainChain)), `${lang} parent ring`);
      assert.equal(model.analysis.mainChain.length, 6);

      const primary = model.analysis.functionalGroups.filter((group) => group.kind === item.function);
      assert.equal(primary.length, 1, `${lang}: one principal function is attributed`);
      const func = available.find((fragment) => fragment.kind === 'function'
        && fragment.contributions?.some((origin) => origin.group === item.function));
      assert.ok(func, `${lang}: functional-group fragment`);
      const carbonylGroup = item.function === 'aldehyde' || item.function === 'ketone';
      const outsideCarbon = !model.analysis.mainChain.includes(primary[0].carbonId);
      const externalAttachment = item.function === 'aldehyde' && outsideCarbon
        ? molecule.bonds.find(([a, b]) => primary[0].atomIds.includes(a) && model.analysis.mainChain.includes(b)
          || primary[0].atomIds.includes(b) && model.analysis.mainChain.includes(a))
        : undefined;
      const functionAtoms = new Set(primary[0].atomIds);
      if (externalAttachment) {
        functionAtoms.add(externalAttachment[0]); functionAtoms.add(externalAttachment[1]);
      }
      const functionEdges = inducedEdges(molecule, functionAtoms);
      assertGraphRegion(targetFor(refs, func.stepNumber, func), molecule, functionAtoms, functionEdges, `${lang} ${item.function}`);
      if (carbonylGroup) {
        const carbonyl = molecule.bonds.find(([a, b, order]) => order === 2
          && primary[0].atomIds.includes(a) && primary[0].atomIds.includes(b));
        assert.ok(carbonyl, `${lang}: carbonyl double bond exists`);
        assert.ok(functionEdges.some((pair) => edge(pair) === edge(carbonyl)));
      } else {
        const carbonO = molecule.bonds.find(([a, b]) => primary[0].atomIds.includes(a)
          && primary[0].atomIds.includes(b) && molecule.atoms.find((atom) => atom.id === a)?.element === 'O'
          || primary[0].atomIds.includes(a) && primary[0].atomIds.includes(b) && molecule.atoms.find((atom) => atom.id === b)?.element === 'O');
        assert.ok(carbonO, `${lang}: alcohol C–O edge exists`);
      }

      for (const locant of item.subs) {
        const substituent = model.analysis.substituents.find((candidate) => candidate.locant === locant);
        assert.ok(substituent, `${lang}: analyzed substituent at C${locant}`);
        const part = available.find((fragment) => fragment.kind === 'substituent'
          && fragment.atomIds?.length === substituent.atomIds.length
          && substituent.atomIds.every((id) => fragment.atomIds.includes(id)));
        assert.ok(part, `${lang}: substituent C${locant} fragment`);
        const anchor = model.analysis.mainChain[locant - 1], atoms = new Set([...substituent.atomIds, anchor]);
        assertGraphRegion(targetFor(refs, part.stepNumber, part), molecule, atoms, inducedEdges(molecule, atoms), `${lang} substituent C${locant}`);
        const numbering = available.find((fragment) => fragment.kind === 'numbering'
          && fragment.text === String(locant));
        assert.ok(numbering, `${lang}: explicit parent locant C${locant}`);
        const numberTarget = targetFor(refs, numbering.stepNumber, numbering);
        assert.ok(numberTarget, `${lang}: C${locant} number has a canvas target`);
        assert.deepEqual(new Set(numberTarget.atomIds), new Set([anchor]));
        assert.ok(numberTarget.locants.some(([id, value]) => id === anchor && value === locant));
      }

      if (item.unsaturation.length) {
        const locant = item.unsaturation[0], first = model.analysis.mainChain[locant - 1];
        const second = model.analysis.mainChain[locant];
        const ringDouble = molecule.bonds.find(([a, b, order]) => edge([a, b]) === edge([first, second]) && order === 2);
        assert.ok(ringDouble, `${lang}: expected C${locant}=C${locant + 1} in the ring`);
        const ringEvidence = available.filter((fragment) => fragment.kind === 'unsaturation');
        assert.ok(ringEvidence.length > 0, `${lang}: ring unsaturation evidence`);
        assert.ok(ringEvidence.some((fragment) => targetFor(refs, fragment.stepNumber, fragment)?.bondIds
          .some((pair) => edge(pair) === edge(ringDouble))), `${lang}: ring locant maps to its own double bond`);
        const substituent = model.analysis.substituents.find((candidate) => candidate.unsaturatedBonds?.length);
        assert.ok(substituent, `${lang}: unsaturated branch evidence exists`);
        const branch = available.find((fragment) => fragment.kind === 'substituent'
          && fragment.atomIds?.length === substituent.atomIds.length
          && substituent.atomIds.every((id) => fragment.atomIds.includes(id)));
        const branchTarget = targetFor(refs, branch.stepNumber, branch);
        const branchDouble = substituent.unsaturatedBonds.flatMap((bond) => bond.atomIds);
        const branchEdge = molecule.bonds.find(([a, b, order]) => order === 2
          && branchDouble.includes(a) && branchDouble.includes(b));
        assert.ok(branchEdge, `${lang}: branch double bond exists`);
        assert.ok(branchTarget.bondIds.some((pair) => edge(pair) === edge(branchEdge)));
        assert.notEqual(edge(branchEdge), edge(ringDouble), `${lang}: ring and branch unsaturation remain distinct`);
      }
    }
  });

  test(`B5.2 CID ${item.cid}: numbering and graph evidence survive graph permutations and language switches`, () => {
    const parsed = moleculeFromSmiles(source.smiles);
    assert.equal(parsed.ok, true);
    const original = parsed.molecule;
    const idMap = new Map(original.atoms.map((atom, index) => [atom.id, 1000 + (index * 17)]));
    const permuted = { ...original,
      atoms: [...original.atoms].reverse().map((atom) => ({ ...atom, id: idMap.get(atom.id), x: -atom.y + 8, y: atom.x - 3 })),
      bonds: [...original.bonds].reverse().map(([a, b, ...rest]) => [idMap.get(b), idMap.get(a), ...rest]),
      rings: original.rings.map((ring) => ({ ...ring, atomIds: [...ring.atomIds.slice(2), ...ring.atomIds.slice(0, 2)].reverse().map((id) => idMap.get(id)) })),
    };
    for (const graph of [original, permuted]) {
      const before = structuredClone(graph);
      const exportedGraph = moleculeToSmiles(graph);
      assert.equal(exportedGraph.ok, true, exportedGraph.error);
      assert.equal(structuralIdentity(exportedGraph.smiles), structuralIdentity(source.smiles), 'permutation preserves the complete graph');
      for (const lang of ['es', 'en', 'es']) {
        const { profile, model, refs } = project(chemistry.engine, graph, lang);
        assert.equal(profile.name, item[lang]);
        const parent = parts(model).find((fragment) => fragment.kind === 'parent');
        assert.ok(parent && targetFor(refs, parent.stepNumber, parent));
      }
      assert.deepEqual(graph, before, 'analysis and projection never mutate atom order, bonds or geometry');
      const reimported = moleculeFromSmiles(exportedGraph.smiles);
      assert.equal(reimported.ok, true, reimported.error);
      assert.equal(structuralIdentity(moleculeToSmiles(reimported.molecule).smiles), structuralIdentity(source.smiles));
    }
  });
}

test('unmatched or unsupported parentheses do not gain fragment evidence', () => {
  const source = records.find((record) => record.cid === 326), parsed = moleculeFromSmiles(source.smiles);
  const analysis = chemistry.engine.analyzeMolecule(parsed.molecule);
  const model = chemistry.engine.buildActiveIupacReasoning({ molecule: parsed.molecule,
    analyses: { current: analysis, legacy: analysis }, convention: 'current', language: 'en',
    displayedName: '4-(not-analyzed)benzaldehyde', generatedNames: [], canHighlight: true });
  assert.equal(parts(model).length, 0);
});
