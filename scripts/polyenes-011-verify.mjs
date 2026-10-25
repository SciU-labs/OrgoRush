import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strictValidationResult } from './validation-008-audit.mjs';
import { emittedJavaScriptSha256 } from './quality-010-diagnostics.mjs';

const affected = new Set(['V008-012','V008-013','V008-069']);

/** Preserve FIX-009 in full except the three explicitly verified ES coverage
 * extensions and their Legacy EN pedagogical projections. No reference edits. */
export function comparePolyenes011(before, after) {
  const counts = {}, extensions = [];
  let preservedPositive = 0;
  const {createdAt: bDate, head: bHead, records: bRecords, ...bMeta} = before;
  const {createdAt: aDate, head: aHead, records: aRecords, ...aMeta} = after;
  assert.deepEqual(aMeta,bMeta);
  assert.equal(aRecords.length,72);
  for (const [i, old] of bRecords.entries()) {
    const fresh = aRecords[i];
    const {variants:bVariants,...bReference} = old, {variants:aVariants,...aReference} = fresh;
    assert.deepEqual(aReference,bReference);
    assert.equal(aVariants.length,2);
    for (const [v,bVariant] of bVariants.entries()) {
      const {profiles:bProfiles,...bGraph} = bVariant, {profiles:aProfiles,...aGraph} = aVariants[v];
      assert.deepEqual(aGraph,bGraph);
      for (const profile of before.profiles) {
        const b=bProfiles[profile],a=aProfiles[profile],label=`${old.id}/${profile}/${v}`;
        if (affected.has(old.id) && profile==='1979-es') {
          assert.equal(b.classification,'UNSUPPORTED');
          assert.equal(a.classification,'PASS',label);
          assert.equal(a.observed,b.expected,label);
          // Unsupported ES had no analysis projection; its new projection
          // must equal the already verified historical English structure.
          assert.deepEqual(a.analysis,bProfiles['1979-en'].analysis,label);
          assert.deepEqual(a.formula,b.formula,label);
          assert.deepEqual(a.issues,[],label);
          assert.ok(a.reasoning,label);
          if(v===0) extensions.push({id:old.id,from:b.classification,to:a.classification,name:a.observed});
        } else if (affected.has(old.id) && profile==='1979-en') {
          const {reasoning:bReasoning,...bChemistry}=b, {reasoning:aReasoning,...aChemistry}=a;
          assert.deepEqual(aChemistry,bChemistry,label);
          assert.ok(aReasoning && bReasoning,label);
        } else assert.deepEqual(a,b,label);
        if(b.classification==='PASS') {
          assert.equal(a.classification,'PASS',label);
          assert.equal(a.observed,b.observed,label);
          if(v===0) preservedPositive++;
        }
        if(v===0) {const status=a.classification??'PENDING-REFERENCE';counts[status]=(counts[status]??0)+1;}
      }
    }
  }
  assert.equal(preservedPositive,195);
  assert.equal(extensions.length,3);
  assert.deepEqual(counts,{PASS:198,UNSUPPORTED:16,'PENDING-REFERENCE':2});
  assert.equal(strictValidationResult(after,true).success,true);
  assert.equal(strictValidationResult(after,false).success,false);
  return {preservedPositive,extensions,counts,otherChemicalAndPedagogicalFieldsUnchanged:true};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const quality=JSON.parse(readFileSync(new URL('../reports/orgorush-quality-010.baseline.json',import.meta.url),'utf8'));
  for(const [path,hash] of Object.entries(quality.emittedJavaScript))
    assert.equal(emittedJavaScriptSha256(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),path),hash,path);
  const before=JSON.parse(readFileSync(new URL('../reports/orgorush-validation-fix-009.matrix.json',import.meta.url),'utf8'));
  const after=JSON.parse(readFileSync(process.argv[2],'utf8'));
  console.log(JSON.stringify(comparePolyenes011(before,after),null,2));
}
