// Validates new audit artifacts only; does not rerun chemistry or existing tests.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const started = performance.now(), here = new URL('./', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, here), 'utf8'));
const planText = readFileSync(new URL('sample-plan.json', here), 'utf8');
const plan = JSON.parse(planText), matrix = read('smoke-matrix.json');
assert.equal(matrix.samplePlanSHA256, createHash('sha256').update(planText).digest('hex'));
assert.equal(plan.cases.length, 39);
assert.deepEqual(matrix.records.map(r => [r.id,r.smiles,r.family]), plan.cases);
assert.equal(matrix.records.filter(r => r.import.status === 'REJECTED').length, 1);
for (const r of matrix.records) {
  if (r.import.status === 'REJECTED') {
    assert.equal(r.id, 'S38'); assert.equal(r.import.producedGraph, false);
    assert.match(r.import.error, /isótopos/); continue;
  }
  assert.equal(r.identity, 'PASS'); assert.equal(r.graphUnmutated, true);
  assert.equal(Object.keys(r.profiles).length, 4);
  for (const p of Object.values(r.profiles)) if (p.name) assert.equal(p.reasoning.status, 'PASS');
}
assert.deepEqual(matrix.summary, read('smoke-summary.json'));
assert.equal(matrix.summary.reasoning.PASS, 126); assert.equal(matrix.summary.reasoning.FAIL, 0);
const issues = read('issue-register.json');
assert.deepEqual(issues.counts, { P0:0,P1:0,P2:8,P3:2 });
for (const priority of ['P0','P1','P2','P3']) assert.equal(issues.findings.filter(f => f.priority === priority).length, issues.counts[priority]);
for (const f of issues.findings) {
  for (const key of ['id','priority','category','module','steps','impact','evidence','confidence','recommendation','cost','blocks']) assert.ok(f[key], f.id+': '+key);
  assert.ok(['bajo','medio','alto'].includes(f.cost));
}
const grading = read('grading-smoke.json'); assert.equal(grading.status, 'PASS'); assert.equal(grading.records.length, 6);
for (const name of readdirSync(here).filter(n => /\.(json|mjs|ps1)$/.test(n))) {
  const text = readFileSync(new URL(name, here), 'utf8');
  if (name.endsWith('.json')) JSON.parse(text);
  assert.ok(!/[ \t]+$/m.test(text), 'Trailing whitespace: '+name);
}
const report = readFileSync(new URL('../aud-nom-009-prelaunch-audit.md', here), 'utf8');
assert.ok(!/[ \t]+$/m.test(report), 'Trailing report whitespace');
for (const section of ['A.','B.','C.','D.','E.','F.','G.','H.']) assert.ok(report.includes('## '+section));
const result = { audit:'AUD-NOM-009', status:'PASS', capturedAt:new Date().toISOString(),
  wallSeconds:(performance.now()-started)/1000, sampleCases:39, acceptedIdentities:38,
  reasoningModels:126, gradingComparisons:6, findingCounts:issues.counts,
  checks:['plan SHA256 unchanged','sample order/SMILES unchanged','safe isotope rejection without graph','38 identity and immutability PASS','126 reasoning PASS','counts and JSON consistent','new source/report whitespace clean'],
  scope:'Audit artifact validation only; not a new production test suite or Pages build.' };
writeFileSync(new URL('validation.json', here), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
