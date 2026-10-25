import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {POLYENES} from '../tests/fixtures/orgorush-iupac79-polyenes-011.mjs';
import {comparePolyenes011} from './polyenes-011-verify.mjs';
import {emittedJavaScriptSha256} from './quality-010-diagnostics.mjs';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
export function compareUnsaturation013(before,after){
 const {createdAt:bd,head:bh,...b}=before,{createdAt:ad,head:ah,...a}=after;
 // None of the 72 archived structures requires a new current-profile name.
 // Preserve all 198 positive verdicts, names, structures and pedagogy exactly.
 assert.deepEqual(a,b);
 const older=read(new URL('../reports/orgorush-validation-fix-009.matrix.json',import.meta.url));
 const historical=comparePolyenes011(older,after);
 assert.deepEqual(historical.counts,{PASS:198,UNSUPPORTED:16,'PENDING-REFERENCE':2});
 return {preservedPositive:198,counts:historical.counts,allAuditFieldsUnchanged:true};
}

export async function verifyPolyeneFixtureChanges(){
 const original=execFileSync('git',['show','3c47e07:tests/fixtures/orgorush-iupac79-polyenes-011.mjs'],{encoding:'utf8'});
 const {POLYENES:before}=await import(`data:text/javascript,${encodeURIComponent(original)}`);
 const allowed=new Map([
  ['C=CC(CC)=C',['3-metilpent-1-eno','3-metilidenopent-1-eno']],
  ['C=CC(CCCC)=C',['3-metilhept-1-eno','3-metilidenohept-1-eno']],
 ]),changes=[];
 assert.equal(POLYENES.length,before.length);
 for(const [i,old] of before.entries()){
  const fresh=POLYENES[i],pair=allowed.get(old.smiles);
  if(!pair){assert.deepEqual(fresh,old);continue;}
  const {current:bc,...br}=old,{current:ac,...ar}=fresh;
  assert.deepEqual(ar,br);assert.deepEqual([bc,ac],pair);
  changes.push({smiles:old.smiles,profile:'2013-es',before:bc,after:ac});
 }
 assert.equal(changes.length,2);return changes;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const quality=read(new URL('../reports/orgorush-quality-010.baseline.json',import.meta.url));
 for(const [path,hash] of Object.entries(quality.emittedJavaScript))
  assert.equal(emittedJavaScriptSha256(readFileSync(path,'utf8'),path),hash,path);
 console.log(JSON.stringify({...compareUnsaturation013(read(process.argv[2]),read(process.argv[3])),
  authorizedPolyeneFixtureChanges:await verifyPolyeneFixtureChanges(),protectedQualityJavaScriptUnchanged:true},null,2));
}
