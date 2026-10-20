// Audit evidence only: fixed 39 cases, no generators, no network, no historical writes.
// Run under run-bounded.ps1 (external 85-second process-tree deadline).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { SmilesParser } from 'openchemlib';
import { loadExerciseChemistry } from '../../../tests/helpers/exercise-chemistry.mjs';
import { structuralIdentity, loadSnapshots } from '../../../tests/helpers/reference-corpus.mjs';
import { project, assertReasoningIntegrity } from '../../../tests/helpers/reasoning-integrity.mjs';
import { moleculeFromSmiles, moleculeToSmiles } from '../../../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles } from '../../../scripts/naming-audit/evaluate.mjs';
import { evidenceMap, interpretName } from '../../../scripts/naming-audit/evidence.mjs';

const started = performance.now(), root = new URL('./', import.meta.url);
const planText = readFileSync(new URL('sample-plan.json', root), 'utf8');
const plan = JSON.parse(planText);
const receipts = loadSnapshots();
const sources = ['opsin-evidence.json', 'aud-nom-003-opsin-evidence.json',
  'aud-nom-005/sample-opsin-evidence.json', 'aud-nom-005/rule-derived-candidate-receipts.json',
  'aud-nom-008/opsin-receipts.json'];
for (const source of sources) {
  for (const [name, receipt] of evidenceMap(JSON.parse(readFileSync(new URL('../' + source, root), 'utf8')))) {
    receipts.set(name, { ...receipt, auditSource: source });
  }
}
const chemistry = await loadExerciseChemistry(), records = [];
try {
  for (const [id, smiles, family] of plan.cases) {
    const record = { id, smiles, family, profiles: {} };
    records.push(record);
    const imported = moleculeFromSmiles(smiles);
    record.import = imported.ok ? { status: 'ACCEPTED' } : { status: 'REJECTED', error: imported.error,
      producedGraph: Object.hasOwn(imported, 'molecule') };
    record.inputFormula = new SmilesParser().parseMolecule(smiles).getMolecularFormula().formula;
    if (!imported.ok) continue;
    const molecule = imported.molecule, before = structuredClone(molecule);
    const analyses = analyzeBoth(molecule, chemistry.engine);
    record.formula = analyses.current.formula;
    const profiles = displayedProfiles(molecule, analyses, chemistry.engine);
    const exported = moleculeToSmiles(molecule);
    record.export = exported;
    record.identity = exported.ok && structuralIdentity(smiles) === structuralIdentity(exported.smiles) ? 'PASS' : 'FAIL';
    record.inputIDCode = structuralIdentity(smiles);
    record.analysis = Object.fromEntries(Object.entries(analyses).map(([key, a]) => [key, {
      name: a.name, chainName: a.chainName, family: a.family, mainChain: a.mainChain,
      primaryFunctionalGroup: a.primaryFunctionalGroup, doubleBondLocants: a.doubleBondLocants,
      tripleBondLocants: a.tripleBondLocants, substituents: a.substituents,
      functionalGroups: a.functionalGroups } ]));
    for (const [key, profile] of Object.entries(profiles)) {
      const out = record.profiles[key] = { ...profile, availability: profile.name ? 'AVAILABLE' : 'BLOCKED',
        normativeStatus: 'NOT_ADJUDICATED_IN_THIS_AUDIT' };
      out.interpretation = key.endsWith('-en') ? interpretName(profile.name, smiles, receipts)
        : { status: profile.name ? 'UNVERIFIED' : 'UNSUPPORTED', reason: 'English OPSIN receipts do not adjudicate Spanish text' };
      if (!profile.name) continue;
      try {
        const model = project(chemistry.engine, { molecule, analyses, profiles }, key);
        assertReasoningIntegrity(model, molecule);
        out.reasoning = { status: 'PASS', links: model.links, fragments: model.fragments, steps: model.steps };
      } catch (error) { out.reasoning = { status: 'FAIL', error: error.message }; }
    }
    record.graphUnmutated = isDeepStrictEqual(molecule, before);
  }
} finally { await chemistry.close(); }
const result = { audit: 'AUD-NOM-009', head: plan.head, capturedAt: new Date().toISOString(),
  samplePlanSHA256: createHash('sha256').update(planText).digest('hex'), sampleSize: plan.cases.length,
  wallSeconds: (performance.now() - started) / 1000, scope: 'Fixed sample; local UI naming projection, explicit stereo enabled, no external name override. OPSIN interpretation is historical exact-text evidence, not normative preference.',
  receiptSources: ['tests/reference-corpus/opsin-snapshots.json', ...sources], records };
writeFileSync(new URL('smoke-matrix.json', root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ sampleSize: records.length, wallSeconds: result.wallSeconds,
  records: records.map(r => ({ id: r.id, formula: r.formula ?? r.inputFormula, import: r.import,
    identity: r.identity, graphUnmutated: r.graphUnmutated,
    profiles: Object.fromEntries(Object.entries(r.profiles).map(([k, p]) => [k, {
      name: p.name, interpretation: p.interpretation.status, reasoning: p.reasoning?.status,
      error: p.reasoning?.error }])) })) }, null, 2));
