import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles, resolvedProfileAnalyses } from '../scripts/naming-audit/evaluate.mjs';
import { buildReasoningVisualReferences, reasoningFragmentId } from '../app/reasoning-visual-targets.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';

const { records } = JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json', import.meta.url), 'utf8'));
const cases = [
  { cid: 7455, kind: 'ester' },
  { cid: 69274, kind: 'amide' },
  { cid: 7724, kind: 'nitrile' },
];
let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

const edgeKey = ([a, b]) => [a, b].sort((x, y) => x - y).join(':');

for (const item of cases) test(`B5.3 ${item.kind} reasoning projection retains complete exocyclic bonds CID ${item.cid}`, () => {
  const record = records.find(candidate => candidate.cid === item.cid);
  const parsed = moleculeFromSmiles(record.smiles);
  assert.equal(parsed.ok, true, parsed.error);
  const molecule = parsed.molecule, engine = chemistry.engine;
  const analyses = analyzeBoth(molecule, engine), profiles = displayedProfiles(molecule, analyses, engine);
  const profile = profiles['2013-es'];
  assert.ok(profile.name, 'local Spanish name remains available');
  const selected = resolvedProfileAnalyses(molecule, analyses, profile, engine);
  const analysis = selected.current;
  assert.equal(engine.localNamerCannotSafelyName(molecule, analysis), false, 'local name remains admitted');
  const derivation = reconcileSystematicName(molecule, profile.name);
  assert.equal(derivation?.status, 'FULL', 'B5.5/B6 independently reconstruct the active Spanish name');
  assert.equal(derivation.name, profile.name, 'visual completeness alone is never the proof key');
  const model = engine.buildActiveIupacReasoning({ molecule, analyses: selected, ...profile,
    displayedName: profile.name, generatedNames: Object.values(profiles).map(value => value.name).filter(Boolean), canHighlight: true });
  const references = buildReasoningVisualReferences({ molecule, analysis: model.analysis, steps: model.steps,
    fragments: model.fragments, displayedName: profile.name, enabled: true });
  const group = analysis.functionalGroups.find(candidate => candidate.kind === item.kind);
  assert.ok(group, `${item.kind} is detected from the graph`);
  const groupIds = new Set([...(group.atomIds ?? []), group.carbonId, group.alkylCarbonId].filter(Number.isInteger));
  const expectedEdges = molecule.bonds.filter(([a, b]) => groupIds.has(a) && groupIds.has(b)
    || groupIds.has(a) && analysis.mainChain.includes(b)
    || groupIds.has(b) && analysis.mainChain.includes(a));
  const functionStep = model.steps.find(step => step.nameRole === 'function');
  const evidence = model.fragments[functionStep.number];
  assert.ok(evidence, 'function explanation has name evidence');
  const parts = [evidence, ...(evidence.additionalFragments ?? [])].filter(part => part.kind === 'function');
  const targets = parts.map(part => references.fragments[reasoningFragmentId(functionStep.number, part)]);
  assert.ok(targets.every(Boolean), 'each literal function fragment has a canvas target');
  const selectedEdges = new Set(targets.flatMap(target => target.bondIds.map(edgeKey)));
  const selectedAtoms = new Set(targets.flatMap(target => target.atomIds));
  const expectedAtoms = new Set([...groupIds, ...expectedEdges.flatMap(([a, b]) => [a, b])]);
  for (const edge of expectedEdges) assert.ok(selectedEdges.has(edgeKey(edge)), `${item.kind} selection includes graph edge ${edgeKey(edge)}`);
  assert.deepEqual(selectedEdges, new Set(expectedEdges.map(edgeKey)), 'function targets contain only the functional group and its true parent attachment edges');
  assert.deepEqual(selectedAtoms, expectedAtoms, 'function targets select only functional atoms and the attached parent atom');
});
