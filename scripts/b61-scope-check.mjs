import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url),report=new URL('../reports/b61/',import.meta.url);
const initial=JSON.parse(await readFile(new URL('pre-change-hashes.json',report),'utf8'));
const allowed=new Set(['app/page.tsx','app/systematic-family-grammar.ts','app/compositional-name-model.ts']);
const changed=[],missing=[];
for(const item of initial) {
  const path=item.path.replaceAll('\\','/');
  try {
    const actual=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
    if(actual.toUpperCase()!==item.sha256.toUpperCase())changed.push({path,allowed:allowed.has(path),before:item.sha256,after:actual});
  }catch(error){missing.push({path,error:String(error)})}
}
const result={executedAt:new Date().toISOString(),filesChecked:initial.length,changed,missing,
  unexpectedChanges:changed.filter(r=>!r.allowed),status:missing.length||changed.some(r=>!r.allowed)?'FAIL':'PASS',
  note:'Compared with B6.1 entry snapshot, not Git HEAD: preserves already modified B4/B5/B6 files. B6.0 PNGs were never written by B6.1; initial snapshot covers its non-image evidence.'};
await writeFile(new URL('scope-check.json',report),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;
