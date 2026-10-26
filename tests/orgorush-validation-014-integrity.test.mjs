import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {AUDIT_ROOT,INTEGRITY_PATH,loadIntegrityManifest,loadHistoricalSnapshot,assertCaptureSource,compareSourceFiles,textBytes,sha256} from '../scripts/validation-014-integrity.mjs';
import {verifyMatrix,receipt} from '../scripts/validation-014-reference.mjs';

const manifest=loadIntegrityManifest();
const matrix=JSON.parse(readFileSync(new URL('reports/orgorush-validation-014.matrix.json',AUDIT_ROOT)));
const read=path=>readFileSync(path);
const transformed=(bytes,mode)=>{
 const lf=textBytes(bytes).toString();
 if(mode==='lf')return Buffer.from(lf);
 if(mode==='crlf')return Buffer.from(lf.replace(/\n/g,'\r\n'));
 let n=0;return Buffer.from(lf.replace(/\n/g,()=>++n%2?'\r\n':'\n'));
};

test('014 published artifacts accept LF, CRLF and mixed endings without changing JSON strings',()=>{
 const corpus=manifest.artifacts.find(f=>f.key==='corpus'),bytes=read(new URL(corpus.path,AUDIT_ROOT));
 assert.notEqual(sha256(transformed(bytes,'crlf')),corpus.sha256,'The raw checkout hash must expose the Windows representation difference');
 for(const mode of ['lf','crlf','mixed']){
  assert.equal(sha256(textBytes(transformed(bytes,mode))),corpus.sha256,'The corpus/archive identity is canonical LF');
  const snapshot=loadHistoricalSnapshot({read:path=>transformed(read(path),mode)});
  assert.deepEqual(snapshot.matrix.counts,matrix.counts);
  assert.equal(snapshot.references.responses.length,292);
 }
});
test('014 capture guard accepts the mixed CSS representation regression but rejects content edits',()=>{
 // Reduced representation regression: production may evolve after this audit.
 const bytes=Buffer.from('a {\r\n  color: red;\n}\r\n');
 const file={path:'app/globals.css',kind:'utf8-lf',sha256:sha256(textBytes(bytes))};
 for(const mode of ['lf','crlf','mixed'])assert.equal(compareSourceFiles([file],{read:()=>transformed(bytes,mode)}),1);
 assert.throws(()=>compareSourceFiles([file],{read:()=>Buffer.concat([bytes,Buffer.from(' /* changed */')])}),/Capture source changed/);
 assert.throws(()=>compareSourceFiles([file],{read:()=>Buffer.from([0xff,0xfe,0x01])}));
 assert.throws(()=>compareSourceFiles([file],{read:()=>Buffer.from('a\0b')}),/NUL/);
});
test('014 binary capture protection requires exact bytes',()=>{
 const bytes=Buffer.from([0x89,0x50,0x4e,0x47,0,0xff,0x0a,0x0d]);
 const file={path:'image.png',kind:'binary',sha256:sha256(bytes)};
 assert.equal(compareSourceFiles([file],{read:()=>bytes}),1);
 const wrong=Buffer.from(bytes);wrong[Math.floor(wrong.length/2)]^=1;
 assert.throws(()=>compareSourceFiles([file],{read:()=>wrong}),/Capture source changed/);
});
test('014 strict capture retains all 764 originals and refuses a changed source without Git',()=>{
 assert.equal(manifest.sourceFiles.length,764);assert.equal(manifest.baselineCommit,matrix.baseline);
 assert.equal(manifest.legacyProductionHash,matrix.execution.productionHash);
 assert.throws(()=>assertCaptureSource({read:path=>{
  assert.ok(!path.pathname.includes('/.git/'));
  return path.pathname.endsWith('/'+INTEGRITY_PATH)?read(path):Buffer.from('changed production');
 }}),/Capture source changed/);
});
test('014 rejects corruption of every published artifact and of its manifest',()=>{
 for(const file of manifest.artifacts){
  assert.throws(()=>loadHistoricalSnapshot({read:path=>path.pathname.endsWith('/'+file.path)?Buffer.concat([read(path),Buffer.from(' ') ]):read(path)}),/Historical artifact changed/);
 }
 const modified=JSON.parse(read(new URL(INTEGRITY_PATH,AUDIT_ROOT)));modified.sourceFiles.pop();
 assert.throws(()=>loadHistoricalSnapshot({read:path=>path.pathname.endsWith('/'+INTEGRITY_PATH)?Buffer.from(JSON.stringify(modified)):read(path)}),/Historical integrity manifest changed/);
});
test('014 detects tampered external bodies even if their embedded digest is recomputed',()=>{
 const file=manifest.artifacts.find(f=>f.key==='references'),wrong=JSON.parse(read(new URL(file.path,AUDIT_ROOT)));
 wrong.responses[0].body+=' ';wrong.responses[0].sha256=sha256(wrong.responses[0].body);
 assert.throws(()=>loadHistoricalSnapshot({read:path=>path.pathname.endsWith('/'+file.path)?Buffer.from(JSON.stringify(wrong)):read(path)}),/Historical artifact changed/);
 assert.throws(()=>{receipt(wrong.responses[0].name).body='forged';},TypeError);
});
test('014 rejects forged PASS, unsupported evidence, changed reference graphs and incomplete profiles',async()=>{
 const forged=structuredClone(matrix);forged.records.find(r=>r.id==='V014-125').profiles['2013-en'].classification='PASS';
 await assert.rejects(()=>verifyMatrix(forged),/independent replay verdict/);
 const graph=structuredClone(matrix);graph.records[0].smiles='CC';await assert.rejects(()=>verifyMatrix(graph));
 const missing=structuredClone(matrix);delete missing.records[0].profiles['1979-en'];await assert.rejects(()=>verifyMatrix(missing));
 const proof=structuredClone(matrix);proof.records[0].profiles['2013-es'].evidence.name.status='PENDING-REFERENCE';
 await assert.rejects(()=>verifyMatrix(proof),/evidence is not supported by replay/);
});
test('014 rejects changed totals, profile counts, batch IDs and baseline provenance',async()=>{
 const totals=structuredClone(matrix);totals.counts.PASS++;await assert.rejects(()=>verifyMatrix(totals));
 const profile=structuredClone(matrix);profile.byProfile['1979-en'].PASS++;await assert.rejects(()=>verifyMatrix(profile));
 const batch=structuredClone(matrix);batch.execution.batchReceipts[0].ids[0]='V014-150';await assert.rejects(()=>verifyMatrix(batch));
 const baseline=structuredClone(matrix);baseline.baseline='0000000000000000000000000000000000000000';await assert.rejects(()=>verifyMatrix(baseline));
});
test('014 historical CLI works from an artifact-only checkout with no Git, no original production and hostile outputs',()=>{
 const stage=mkdtempSync(join(tmpdir(),'orgorush-ci014-'));
 try{
  const paths=[INTEGRITY_PATH,...manifest.artifacts.map(f=>f.path),'scripts/validation-014-audit.mjs','scripts/validation-014-integrity.mjs','scripts/validation-014-reference.mjs','tests/helpers/validation-008-reference.mjs'];
  for(const path of paths){const target=join(stage,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(new URL(path,AUDIT_ROOT),target);}
  mkdirSync(join(stage,'node_modules'));cpSync(new URL('node_modules/openchemlib/',AUDIT_ROOT),join(stage,'node_modules/openchemlib'),{recursive:true,dereference:true});
  mkdirSync(join(stage,'outputs/validation-014'),{recursive:true});writeFileSync(join(stage,'outputs/validation-014/baseline.json'),'invalid local override');
  mkdirSync(join(stage,'app'));writeFileSync(join(stage,'app/page.tsx'),'invalid future production syntax');
  const run=command=>spawnSync(process.execPath,[join(stage,'scripts/validation-014-audit.mjs'),command],{cwd:stage,env:{...process.env,PATH:'',Path:''},encoding:'utf8',windowsHide:true});
  const verified=run('--verify');assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).observations,600);
  mkdirSync(join(stage,'.git'));writeFileSync(join(stage,'.git/HEAD'),'a later commit without any historical Git objects');
  const replay=run('--replay');assert.equal(replay.status,0,replay.stderr);assert.equal(JSON.parse(replay.stdout).baseObservationsReplayed,600);
  const capture=run('--check-source');assert.notEqual(capture.status,0,'Missing original sources must still block capture');
 }finally{
  assert.equal(dirname(resolve(stage)),resolve(tmpdir()));assert.ok(basename(stage).startsWith('orgorush-ci014-'));
  rmSync(stage,{recursive:true,force:true});
 }
});
