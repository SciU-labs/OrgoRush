// AUD-NOM-009B: filesystem/JSON/Git checks only. No chemistry or browser imports.
// Execute through run-bounded.ps1. Never stages, commits or pushes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const started = performance.now();
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const relative = p => path.relative(repo, p).replaceAll('\\', '/');
const prefix = relative(here) + '/';
const reportPath = 'reports/naming-audit/aud-nom-009-prelaunch-audit.md';
const report = readFileSync(path.join(repo, reportPath), 'utf8');
const read = name => JSON.parse(readFileSync(path.join(here, name), 'utf8'));
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd:repo, encoding:'utf8', timeout:5000, windowsHide:true }).trim();
const initial = read('document-baseline.json');
assert.equal(git('rev-parse', 'HEAD'), initial.head);
assert.equal(git('branch', '--show-current'), initial.branch);
assert.equal(git('diff', '--name-only', 'HEAD'), '', 'No tracked changes permitted');
const corrected = new Set([reportPath, prefix+'issue-register.json', prefix+'browser-checks.json']);
const originalFiles = initial.originalAuditArtifacts.map(f => {
  const currentPath = initial.documentaryRenames?.find(n=>n.originalPath===f.path)?.currentPath ?? f.path;
  const currentHash = hash(path.join(repo, currentPath));
  if (!corrected.has(f.path)) assert.equal(currentHash, f.sha256, 'Original evidence changed: '+f.path);
  return { ...f, currentPath, currentSHA256:currentHash, unchanged:currentHash === f.sha256 };
});
for (const f of initial.unrelatedUntracked) assert.equal(hash(path.join(repo,f.path)), f.sha256, 'Unrelated file changed');
const required = [reportPath, ...['issue-register.json','smoke-matrix.json','sample-plan.json','baseline.json',
  'browser-checks.json','run-bounded.ps1','smoke.mjs','grading-smoke.mjs','summarize.mjs','validate-evidence.mjs'].map(n => prefix+n)];
for (const p of required) assert.ok(existsSync(path.join(repo,p)), p);
for (const n of readdirSync(here).filter(n=>n.endsWith('.json'))) read(n);
const plan = read('sample-plan.json'), matrix = read('smoke-matrix.json'), summary = read('smoke-summary.json');
assert.equal(matrix.samplePlanSHA256, hash(path.join(here,'sample-plan.json')));
assert.equal(plan.head, initial.head); assert.equal(matrix.head, initial.head);
assert.equal(read('baseline.json').head, initial.head);
assert.deepEqual(matrix.records.map(r=>[r.id,r.smiles,r.family]), plan.cases);
assert.equal(new Set(matrix.records.map(r=>r.id)).size, matrix.records.length);
assert.equal(matrix.sampleSize, 39); assert.equal(plan.cases.length, 39);
const profiles = ['2013-es','2013-en','1979-es','1979-en'];
const counts = { sampleSize:matrix.records.length, accepted:0, rejected:0, identities:0, unmutated:0,
  reasoning:{ PASS:0, FAIL:0 }, profiles:{} };
for (const r of matrix.records) {
  if (r.import.status === 'REJECTED') {
    counts.rejected++; assert.equal(r.id,'S38'); assert.equal(r.import.producedGraph,false);
    assert.deepEqual(r.profiles,{}); assert.equal(r.export,undefined); assert.equal(r.identity,undefined);
    continue;
  }
  assert.equal(r.import.status,'ACCEPTED'); counts.accepted++;
  assert.equal(r.identity,'PASS'); counts.identities++;
  assert.equal(r.graphUnmutated,true); counts.unmutated++;
  assert.deepEqual(Object.keys(r.profiles).sort(), [...profiles].sort());
  for (const k of profiles) {
    const p = r.profiles[k];
    const c = counts.profiles[k] ??= { available:0, blocked:0, interpretations:{}, blockedIDs:[] };
    const status = p.interpretation.status;
    c.interpretations[status] = (c.interpretations[status] ?? 0) + 1;
    if (!p.name) {
      c.blocked++; c.blockedIDs.push(r.id);
      assert.equal(p.availability,'BLOCKED'); assert.equal(status,'UNSUPPORTED');
      assert.equal(p.reasoning,undefined, 'Blocked name has no executed reasoning model');
      continue;
    }
    c.available++; assert.equal(p.availability,'AVAILABLE');
    assert.equal(p.reasoning.status,'PASS'); counts.reasoning.PASS++;
    assert.equal(p.reasoning.links.map(l=>l.text).join(''),p.name);
    const steps = new Set(p.reasoning.steps.map(s=>s.number));
    for (const link of p.reasoning.links) for (const target of [link.stepNumber,...(link.relatedStepNumbers??[])].filter(Boolean)) assert.ok(steps.has(target));
  }
}
assert.deepEqual(counts,summary); assert.deepEqual(matrix.summary,summary);
assert.equal(counts.accepted,38); assert.equal(counts.rejected,1); assert.equal(counts.reasoning.PASS,126);
// Compare every literal table row with saved records, without generating names.
const table = report.split(/\r?\n/).filter(line=>/^\| S\d\d /.test(line));
assert.equal(table.length,39);
for (let i=0;i<table.length;i++) {
  const cells = table[i].split('|').slice(1,-1).map(c=>c.trim());
  const r = matrix.records[i];
  assert.equal(cells[0].replaceAll('`',''), r.id+' '+r.smiles); assert.equal(cells[1],r.formula??r.inputFormula);
  assert.deepEqual(cells.slice(2),profiles.map(k=>r.profiles[k]?.name??(r.import.status==='REJECTED'?'Rechazo isotópico':'—')));
}
const issues = read('issue-register.json');
const findingCounts = Object.fromEntries(['P0','P1','P2','P3'].map(k=>[k,issues.findings.filter(f=>f.priority===k).length]));
assert.deepEqual(findingCounts,{P0:0,P1:0,P2:8,P3:2}); assert.deepEqual(issues.counts,findingCounts);
assert.equal(new Set(issues.findings.map(f=>f.id)).size,10);
const evidencePaths = [];
for (const f of issues.findings) {
  for (const k of ['id','priority','title','evidence','steps','reproducibility','confidence','recommendation','blocks','findingNature']) assert.ok(f[k],f.id+': '+k);
  const row = report.split(/\r?\n/).find(line=>line.startsWith('| '+f.id+' |'));
  assert.ok(row?.includes('| '+f.priority+' | '+f.title+' | '+f.category+' |'));
  for (const ref of f.evidence) {
    const [base, recordID] = ref.split('#');
    const line = base.match(/:(\d+)$/); const name = base.replace(/:\d+$/,'');
    const localTarget = path.join(here,name);
    const target = !name.includes('/') && existsSync(localTarget) ? localTarget : path.join(repo,name);
    assert.ok(existsSync(target),'Missing evidence: '+ref);
    if (line) assert.ok(readFileSync(target,'utf8').split(/\r?\n/).length>=Number(line[1]));
    if (recordID) assert.ok(matrix.records.some(r=>r.id===recordID));
    evidencePaths.push({ref,resolved:relative(target)});
  }
}
for (const [key,value] of Object.entries(issues.readiness)) assert.ok(report.includes('| '+key+' | **'+value+'**'));
const grading = read('grading-smoke.json');
assert.equal(grading.status,'PASS'); assert.equal(grading.records.length,6);
for (const r of grading.records) assert.equal(r.result?.correct??r.actual,r.expectedCorrect??r.expected);
const oldValidation = read('validation.json');
assert.equal(oldValidation.sampleCases,39); assert.equal(oldValidation.acceptedIdentities,38);
assert.equal(oldValidation.reasoningModels,126); assert.deepEqual(oldValidation.findingCounts,findingCounts);
const ax = n=>readFileSync(path.join(here,n),'utf8');
assert.match(ax('en-history-ethanol-restored.txt'),/Suggested IUPAC name: butane/);
assert.match(ax('en-history-ethanol-restored.txt'),/C₂H₆O/);
assert.match(ax('en-lab-before-reload.txt'),/link Description: 2-\(2-methylphenyl\)/);
assert.ok(!ax('en-restored-name-no-links.txt').includes('link Description: 2-(2-methylphenyl)'));
const images = readdirSync(here).filter(n=>/\.(png|jpg)$/.test(n)).map(n=>{
  const buf=readFileSync(path.join(here,n));
  let mime, width, height;
  if (buf.subarray(0,8).toString('hex')==='89504e470d0a1a0a') {
    mime='image/png'; width=buf.readUInt32BE(16); height=buf.readUInt32BE(20);
    assert.ok(n.endsWith('.png'));
  } else {
    assert.equal(buf.subarray(0,2).toString('hex'),'ffd8'); mime='image/jpeg';
    for (let pos=2;pos<buf.length;) {
      while (buf[pos]===0xff) pos++;
      const marker=buf[pos++];
      if (marker===0xda||marker===0xd9) break;
      if (marker===0x01||(marker>=0xd0&&marker<=0xd7)) continue;
      const length=buf.readUInt16BE(pos);
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        height=buf.readUInt16BE(pos+3); width=buf.readUInt16BE(pos+5); break;
      }
      pos+=length;
    }
    assert.ok(n.endsWith('.jpg'));
  }
  assert.ok(width>0&&height>0);
  return {path:prefix+n,mime,bytes:buf.length,width,height};
});
const newNames = ['document-integrity.json','commit-files.txt','staging-command.ps1'];
const allPaths = [...new Set([reportPath,...readdirSync(here).filter(n=>statSync(path.join(here,n)).isFile()).map(n=>prefix+n),...newNames.map(n=>prefix+n)])].sort();
assert.ok(allPaths.every(p=>p===reportPath||p.startsWith(prefix)));
assert.ok(!allPaths.some(p=>initial.unrelatedUntracked.some(f=>f.path===p)));
writeFileSync(path.join(here,'commit-files.txt'),allPaths.join('\n')+'\n');
const staging = '# Proposed staging only. AUD-NOM-009B does not execute this file.\n$ErrorActionPreference = \'Stop\'\n$auditFiles = @(\n'+allPaths.map(p=>"  '"+p.replaceAll("'","''")+"'").join(',\n')+'\n)\ngit add -- $auditFiles\n';
writeFileSync(path.join(here,'staging-command.ps1'),staging);
const result = {audit:'AUD-NOM-009B',status:'PASS',capturedAt:new Date().toISOString(),scope:'Documentary verification of already recorded results; no chemistry, grading, suites or browser executed.',
  head:initial.head,branch:initial.branch,matrixReconstructed:false,expectedDeliverables:required.map(p=>({path:p,exists:true,bytes:statSync(path.join(repo,p)).size})),
  counts,profilePositions:{totalFrozen:156,imported:152,available:126,blockedAfterImport:26,notExecutedDueToRejectedInput:4},
  unitDefinitions:{structures:'39 frozen inputs = 38 accepted graphs + one rejected isotope input',reasoning:'126 available case/profile models checked in AUD-NOM-009; not 126 distinct structures or an exact assertion count',grading:'Six saved comparisons, separately counted; not rerun',statuses:'PASS/FAIL: recorded check result; UNSUPPORTED/BLOCKED: unavailable name; UNVERIFIED: insufficient evidence, not FAIL; no SKIP count inferred for absent profile execution'},
  findingCounts,readiness:issues.readiness,gradingComparisons:6,evidencePaths,images,
  originalArtifactChecks:originalFiles,unrelatedUntracked:initial.unrelatedUntracked,
  corrections:originalFiles.filter(f=>!f.unchanged).map(f=>f.path),renamedEvidence:initial.documentaryRenames,
  remainingLimits:['Isotope screenshot shows context, not the error text in its viewport; error text is recorded in matrix/browser-checks and original interaction record.','Persisted browser evidence is agent-controlled automation, not external-user research.','Clipboard/SVG/Saved and other pending checks retain their original uncertainty.'],
  commitPreparation:{paths:allPaths,stagingExecuted:false,commitExecuted:false,pushExecuted:false},
  wallSeconds:(performance.now()-started)/1000};
writeFileSync(path.join(here,'document-integrity.json'),JSON.stringify({...result,status:'PENDING_GIT_CHECKS'},null,2)+'\n');
const known = new Set(git('ls-files','--cached','--others','--exclude-standard','--',reportPath,prefix.slice(0,-1)).split(/\r?\n/));
for (const p of allPaths) assert.ok(known.has(p),'Not Git-addable: '+p);
for (const p of allPaths.filter(p=>/\.(md|mjs|ps1|json)$/.test(p))) {
  const text=readFileSync(path.join(repo,p),'utf8');
  assert.ok(!/[ \t]+$/m.test(text),'Trailing whitespace: '+p);
  const markdown=text.replace(/```[\s\S]*?```/g,'').replace(/`[^`\n]*`/g,'');
  if (p.endsWith('.md')) for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:/.test(match[1])) continue;
    const target=path.resolve(path.dirname(path.join(repo,p)),match[1].split('#')[0]);
    assert.ok(existsSync(target),'Broken document link: '+match[1]);
  }
}
git('diff','--check');
result.gitChecks = { allStagingPathsAddable:true, diffCheck:'PASS', trackedDiff:'EMPTY', stagingExecuted:false };
writeFileSync(path.join(here,'document-integrity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,requiredFound:required.length,totalFilesForStaging:allPaths.length,counts,findings:findingCounts,
  matrixSHA256:hash(path.join(here,'smoke-matrix.json')),unchangedOriginalEvidence:originalFiles.filter(f=>f.unchanged).length,
  corrections:result.corrections,images:images.map(i=>({path:i.path,width:i.width,height:i.height})),stagingExecuted:false,wallSeconds:result.wallSeconds},null,2));
