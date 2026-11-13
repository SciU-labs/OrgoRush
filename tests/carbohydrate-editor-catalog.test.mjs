import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const baseline=JSON.parse(read('reports/carbohydrate-editor-baseline.json'));
const hash=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
test('phase 8 preserves every catalog button, category, label and menu layout byte for byte',()=>{
  const source=read('app/page.tsx');
  for(const [name,{startMarker,endMarker,sha256}] of Object.entries(baseline.sections)){
    const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
    assert.ok(start>=0&&end>start);assert.equal(hash(source.slice(start,end)),sha256,name);
  }
  const begin=source.indexOf('const FUNCTIONAL_GROUP_TEMPLATES:'),end=source.indexOf('const PRESETS:',begin);
  const code=ts.transpileModule(source.slice(begin,end)+'\nglobalThis.catalog=FUNCTIONAL_GROUP_TEMPLATES;',
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const context={};vm.runInNewContext(code,context);
  const catalog=JSON.parse(JSON.stringify(context.catalog));
  assert.equal(catalog.length,14);
  assert.deepEqual(catalog.map(t=>[t.id,t.category,t.kind]),[
    ['hydroxyl','oxygen','alcohol'],['ether-methyl','oxygen','ether'],['aldehyde','oxygen','aldehyde'],
    ['ketone','oxygen','ketone'],['carboxylic-acid','oxygen','carboxylicAcid'],['methyl-ester','oxygen','ester'],
    ['amine','nitrogen','amine'],['amide','nitrogen','amide'],['nitrile','nitrogen','nitrile'],['nitro','nitrogen','nitro'],
    ['halo-f','halogen','halogen'],['halo-cl','halogen','halogen'],['halo-br','halogen','halogen'],['halo-i','halogen','halogen'],
  ]);
  assert.ok(!catalog.some(t=>/hemi|pyran|furan|sugar|carbohydrate/i.test(t.id)));
});
test('editor chemistry modules remain unchanged apart from the bounded B7.5 CIP addition reconciler',()=>{
  for(const [file,sha256] of Object.entries(baseline.files)){
    if(file==='app/tetrahedral-stereochemistry.ts')continue;
    assert.equal(hash(read(file)),sha256,file);
  }
  const file='app/tetrahedral-stereochemistry.ts',source=read(file);
  const startMarker='/** Preserve the local tetrahedral arrangement when an automatic addition';
  const endMarker='export function setTetrahedralConfiguration';
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
  assert.ok(start>=0&&end>start,'B7.5 addition reconciler must remain a single bounded insertion');
  assert.equal(hash(source.slice(0,start)+source.slice(end)),baseline.files[file],file);
});
