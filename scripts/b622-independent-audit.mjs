import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generalizationInput } from '../tests/fixtures/b60-generalization-input.mjs';
import { moleculeFromSmiles, inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { translateSpanishIupacToOpsin } from '../app/iupac-name-normalization.ts';
import { resolveDerivationConsistency } from '../app/derivation-consistency.ts';
import { deriveStructuralComponents } from '../app/structural-derivation.ts';
import { analyzeBoth, displayedProfiles } from './naming-audit/evaluate.mjs';
import { loadExerciseChemistry } from '../tests/helpers/exercise-chemistry.mjs';
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const records = (path) => read(path).records;
const java = 'C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar = 'C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const outputDirectory = 'reports/b622';
const frozenFixtures = [
  ['tests/fixtures/b62-independent-reference.json', 'reports/b62/corpus-freeze.json'],
  ['tests/fixtures/b62-supplemental.json', 'reports/b62/supplement-freeze.json'],
].map(([fixturePath, freezePath]) => {
  const bytes = readFileSync(fixturePath);
  const expected = read(freezePath).sha256;
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`Frozen fixture hash mismatch: ${fixturePath}`);
  return { fixturePath, sha256: actual, count: JSON.parse(bytes).records.length };
});

const historicalManifest = read('reports/b62/historical-opsin.json');
const firstBlind = read('reports/b62/blind.json');
const firstPost = read('reports/b62/post.json');
const b61Final = read('reports/b61/final.json');
const b61Blind = read('reports/b61/blind-reviewed.json');
const b61RecheckCids = new Set([10758, 31266, 11142, 637563]);
const b50 = records('tests/fixtures/b50-pubchem-rings.json');
const b61 = records('tests/fixtures/b61-independent-reference.json');
const b62 = records('tests/fixtures/b62-independent-reference.json');
const supplement = records('tests/fixtures/b62-supplemental.json');
const historicalOldById = new Map(historicalManifest.rows.map((row) => [row.id, row]));
const blindOldById = new Map(firstBlind.rows.map((row) => [row.id, row]));
const blindRecheckById = new Map(firstPost.priorCases.map((row) => [row.id, row]));
const b61PriorById = new Map(b61Blind.rows.map((row) => [row.id, row]));
const b61ByCid = new Map(b61.map((row) => [row.cid, row]));

const entries = [
  ...generalizationInput.map((record) => ({ record, cohort: 'B60-constructed-current' })),
  ...b50.map((record) => ({ record: { ...record, id: `B50-CID${record.cid}` }, cohort: 'B50-historical-current' })),
  ...b61.map((record) => ({ record, cohort: 'B61-independent-current' })),
  ...b62.map((record) => ({ record, cohort: 'B62-frozen-original-cohort' })),
  ...supplement.map((record) => ({ record, cohort: 'B62-separately-frozen-supplement' })),
  ...[...b61RecheckCids].map((cid) => ({
    record: b61ByCid.get(cid), cohort: 'B61-targeted-prior-failure-recheck', repeatOfMainCohort: true,
  })),
];
if (entries.some(({ record }) => !record?.smiles || !record.id)) throw new Error('An audit corpus record is incomplete');

const chemistry = await loadExerciseChemistry();
function identity(smiles) {
  try { return structuralIdentity(smiles); } catch { return null; }
}
function statusForEnglish(name, fullInternal, opsinStatus) {
  if (!name) return 'UNSUPPORTED-SAFE';
  if (opsinStatus === 'DIFFERENT') return 'CONTRADICTED';
  if (opsinStatus !== 'EQUIVALENT') return 'INCONCLUSIVE';
  return fullInternal ? 'FULL-OPSIN-CONFIRMED' : 'PARTIAL-VERIFIED';
}
function opsin(name) {
  const process = spawnSync(java, ['-jar', jar, '-osmi', '-f'], {
    input: `${name}\n`, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  const stdoutLines = (process.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const smiles = stdoutLines.at(-1) ?? null;
  const stderr = (process.stderr ?? '').trim();
  const warningLines = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .filter((line) => !line.startsWith('Run the jar using the -h flag for help.'));
  let status;
  if (process.error || process.status !== 0) status = 'TECHNICAL-FAILURE';
  else if (!smiles) status = 'OPSIN-UNRECOGNIZED';
  else status = 'PENDING-COMPARISON';
  return {
    status, exitCode: process.status, smiles, stdout: process.stdout ?? '', stderr,
    warnings: warningLines, error: process.error?.message ?? null,
  };
}

const auditRows = [];
try {
  for (let index = 0; index < entries.length; index += 1) {
    const { record, cohort, repeatOfMainCohort = false } = entries[index];
    const imported = moleculeFromSmiles(record.smiles);
    const row = {
      ordinal: index + 1,
      cohort,
      repeatOfMainCohort,
      id: record.id,
      cid: record.cid ?? null,
      source: record.source ?? null,
      smilesReference: record.smiles,
      formulaReference: record.formula ?? inspectSmilesStructure(record.smiles).formula,
      originalB62EnglishName: historicalOldById.get(record.id)?.name
        ?? blindOldById.get(record.id)?.profiles?.en?.name
        ?? blindRecheckById.get(record.id)?.profiles?.en?.name
        ?? b61PriorById.get(record.id)?.profiles?.en?.name
        ?? null,
      originalB62AuditResult: historicalOldById.get(record.id)?.comparison
        ?? blindOldById.get(record.id)?.opsin?.status
        ?? blindRecheckById.get(record.id)?.opsin?.status
        ?? null,
    };
    if (!imported.ok) {
      row.importStatus = 'IMPORT-BLOCKED';
      row.profiles = {
        es: { name: null, support: 'UNSUPPORTED-SAFE', auditStatus: 'UNSUPPORTED-SAFE' },
        en: { name: null, support: 'UNSUPPORTED-SAFE', auditStatus: 'UNSUPPORTED-SAFE', opsin: { status: 'NOT-RUN-NO-NAME' } },
      };
      auditRows.push(row);
      console.log(`${index + 1}/${entries.length} ${record.id}: IMPORT-BLOCKED; OPSIN not run`);
      continue;
    }

    row.importStatus = 'IMPORTED';
    const molecule = imported.molecule;
    const analyses = analyzeBoth(molecule, chemistry.engine);
    const profiles = displayedProfiles(molecule, analyses, chemistry.engine);
    row.formulaActual = inspectSmilesStructure(record.smiles).formula;
    row.profiles = {};
    for (const language of ['es', 'en']) {
      const name = profiles[`2013-${language}`].name;
      const consistency = name
        ? resolveDerivationConsistency({ molecule, activeName: name, language, activeProfile: 'current' })
        : null;
      const proof = consistency?.derivation ?? null;
      row.profiles[language] = {
        name,
        internalSupport: !name ? 'UNSUPPORTED-SAFE' : proof ? 'FULL-INTERNAL' : 'PARTIAL-CANDIDATE',
        consistencyStatus: consistency?.status ?? 'NAME-UNAVAILABLE',
        structuralEvidence: deriveStructuralComponents(molecule, name ?? '').status,
        SpanishToOpsinCandidate: language === 'es' && name ? translateSpanishIupacToOpsin(name) : undefined,
        fullProof: Boolean(proof),
      };
    }

    const en = row.profiles.en;
    if (!en.name) {
      en.opsin = { status: 'NOT-RUN-NO-NAME', exitCode: null, smiles: null, warnings: [] };
      en.auditStatus = 'UNSUPPORTED-SAFE';
    } else {
      en.opsin = opsin(en.name);
      if (en.opsin.status === 'PENDING-COMPARISON') {
        try {
          en.opsin.referenceIdentity = identity(record.smiles);
          en.opsin.interpretedIdentity = identity(en.opsin.smiles);
          en.opsin.referenceFormula = inspectSmilesStructure(record.smiles).formula;
          en.opsin.interpretedFormula = inspectSmilesStructure(en.opsin.smiles).formula;
          en.opsin.structurallyEquivalent = en.opsin.referenceIdentity !== null
            && en.opsin.referenceIdentity === en.opsin.interpretedIdentity;
          en.opsin.formulaEquivalent = en.opsin.referenceFormula === en.opsin.interpretedFormula;
          en.opsin.status = en.opsin.structurallyEquivalent ? 'EQUIVALENT' : 'DIFFERENT';
        } catch (error) {
          en.opsin.status = 'COMPARISON-ERROR';
          en.opsin.error = String(error);
        }
      }
      en.auditStatus = statusForEnglish(en.name, en.fullProof, en.opsin.status);
    }

    const es = row.profiles.es;
    if (!es.name) es.auditStatus = 'UNSUPPORTED-SAFE';
    else if (es.fullProof) es.auditStatus = 'FULL-INTERNAL';
    else if (es.SpanishToOpsinCandidate && es.SpanishToOpsinCandidate === en.name
      && en.opsin.status === 'EQUIVALENT') es.auditStatus = 'PARTIAL-VERIFIED';
    else if (es.SpanishToOpsinCandidate && es.SpanishToOpsinCandidate === en.name
      && en.opsin.status === 'DIFFERENT') es.auditStatus = 'CONTRADICTED';
    else es.auditStatus = 'INCONCLUSIVE';
    es.independence = es.fullProof
      ? 'Internal reconstruction only; no OPSIN Spanish parser was used.'
      : es.auditStatus === 'PARTIAL-VERIFIED'
        ? 'Compositional Spanish-to-English bridge agrees with the displayed EN name and OPSIN graph; Spanish was not independently parsed.'
        : 'No independent Spanish parser; requires terminology review.';

    auditRows.push(row);
    console.log(`${index + 1}/${entries.length} ${record.id}: ES=${es.auditStatus}; EN=${en.auditStatus}`);
  }
} finally {
  await chemistry.close();
}

const calls = auditRows.filter((row) => row.profiles.en.opsin?.exitCode !== null
  && row.profiles.en.opsin?.status !== 'NOT-RUN-NO-NAME');
const uniqueEnglishNames = [...new Set(calls.map((row) => row.profiles.en.name).filter(Boolean))];
const counts = (values) => Object.fromEntries(Object.entries(Object.groupBy(values, (value) => value ?? 'null'))
  .map(([key, grouped]) => [key, grouped.length]));
const profileRows = auditRows.flatMap((row) => ['es', 'en'].map((language) => ({
  id: row.id, cohort: row.cohort, language, ...row.profiles[language],
})));
const summary = {
  originalB62: {
    invocations: 83, uniqueNames: 66, equivalent: 82, contradicted: 1,
    fullOpsinConfirmed: 47, source: 'reports/b62/README.md and matrix.md',
  },
  currentRun: {
    executedAt: new Date().toISOString(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    interpreter: 'OPSIN 2.9.0 local CLI with Temurin JRE 21.0.13+9',
    comparator: 'OpenChemLib 9.25.0 CanonizerUtil.NORMAL, shared with OrgoRush',
    corpusRecords: auditRows.length,
    repeatRows: auditRows.filter((row) => row.repeatOfMainCohort).length,
    invocationCount: calls.length,
    uniqueEnglishNames: uniqueEnglishNames.length,
    opsinStatuses: counts(calls.map((row) => row.profiles.en.opsin.status)),
    englishAuditStatuses: counts(calls.map((row) => row.profiles.en.auditStatus)),
    spanishAuditStatuses: counts(profileRows.filter((row) => row.language === 'es').map((row) => row.auditStatus)),
    frozenFixtures,
  },
  limitations: [
    'OPSIN directly interprets English only; Spanish is not independently parsed.',
    'Structural equivalence uses OpenChemLib, a dependency shared with OrgoRush.',
    'An OPSIN match does not certify a preferred IUPAC name (PIN).',
  ],
  rows: auditRows,
};

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(`${outputDirectory}/audit.json`, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(summary.currentRun, null, 2));
