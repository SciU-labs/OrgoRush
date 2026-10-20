// Six fixed comparisons, no question generation or session sweep.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadExerciseChemistry } from '../../../tests/helpers/exercise-chemistry.mjs';
import { moleculeFromSmiles } from '../../../app/openchemlib-adapter.ts';
import { createStructuralAnswerEvaluator } from '../../../app/practice-structural-answer.ts';
import { matchesHydrocarbonReferenceName } from '../../../app/practice-reference-answer.ts';
const started = performance.now(), records = [];
const chemistry = await loadExerciseChemistry();
const mol = s => { const r = moleculeFromSmiles(s); assert.ok(r.ok); return r.molecule; };
try {
  const evaluate = createStructuralAnswerEvaluator(chemistry.oracles);
  for (const [reference, submission, category, correct] of [
    ['CCCC', 'CCCC', 'alkane', true],
    ['CCCC', 'CC(C)C', 'alkane', false],
    ['C/C=C/C', 'C/C=C/C', 'ez', true],
    ['C/C=C/C', 'C/C=C\\C', 'ez', false],
  ]) {
    const result = evaluate({ referenceMolecule: mol(reference), submittedMolecule: mol(submission), category });
    records.push({ reference, submission, category, expectedCorrect: correct, result });
    assert.equal(result.correct, correct);
    assert.ok(result.checks.referenceValid && result.checks.submissionValid);
  }
  for (const [answer, reference, locale, expected] of [
    [' BUTANO ', 'butano', 'es', true], ['butane', 'butano', 'es', false],
  ]) {
    const actual = matchesHydrocarbonReferenceName(answer, reference, locale);
    records.push({ answer, reference, locale, expected, actual }); assert.equal(actual, expected);
  }
} finally { await chemistry.close(); }
writeFileSync(new URL('grading-smoke.json', import.meta.url), JSON.stringify({
  audit: 'AUD-NOM-009', capturedAt: new Date().toISOString(), wallSeconds: (performance.now()-started)/1000,
  status: 'PASS', records,
  limit: 'Fixed controls only. Naming grading normalizes typography; it is not a general synonym or IUPAC equivalence adjudicator.'
}, null, 2)+'\n');
console.log('PASS: six fixed grading comparisons');
