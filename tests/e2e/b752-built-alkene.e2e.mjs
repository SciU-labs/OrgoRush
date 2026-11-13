import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('manually built E and Z alkenes keep their geometry after a directed branch',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
  const out='reports/b752/built-alkenes';await mkdir(out,{recursive:true});const seen=new Set();
  for(const toggles of [1,2]){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
   await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});});
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
   const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
   await atom(1).click({force:true,timeout:90000});await page.locator('.view-mode-switch button').nth(2).click();
   for(let i=1;i<6;i++)await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
   const bond=page.locator('.molecule-bonds-layer [data-bond-a="2"][data-bond-b="3"]');await bond.click({force:true});assert.equal(await bond.getAttribute('data-bond-order'),'2');
   const stereo=page.locator('.stereochemistry-toggle');await stereo.waitFor({state:'visible'});
   assert.equal(await stereo.isEnabled(),true,'a stereogenic but unassigned double bond must allow explicit stereochemistry controls');
   if(await stereo.getAttribute('aria-checked')!=='true')await stereo.click();
   const exported=async()=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await pending;const smiles=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];await page.locator('[aria-controls="smiles-interop-panel"]').click();return smiles;};
   assert.equal(structuralIdentity(await exported()),structuralIdentity('CC=CCCC'),'enabling controls must not assign E/Z');
   for(let i=0;i<toggles;i++)await bond.click({force:true,modifiers:['Alt']});
   const beforeSmiles=await exported(),beforeIdentity=structuralIdentity(beforeSmiles);
   const e=structuralIdentity('C/C=C/CCC'),z=structuralIdentity('C/C=C\\CCC');assert.ok(beforeIdentity===e||beforeIdentity===z,`unassigned input ${beforeSmiles}`);seen.add(beforeIdentity);
   const points=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const m=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return[n.dataset.atomId,{x:+m[1],y:+m[2]}]})));
   const before=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/${toggles}-before.png`});await page.locator('.view-mode-switch button').nth(0).click();const semiBefore=await points();await page.locator('.view-mode-switch button').nth(2).click();
   await atom(5).click({force:true});await page.getByRole('button',{name:'Añadir carbono hacia arriba'}).click();await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===7);
   const after=await points();for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(after[id].x-p.x,after[id].y-p.y)<1e-6,`atom ${id} moved`);
   assert.ok(after[7].y<after[5].y);await page.locator('.molecule-stage').screenshot({path:`${out}/${toggles}-after.png`});
   await page.locator('.view-mode-switch button').nth(0).click();const semiAfter=await points();for(const [id,p] of Object.entries(semiBefore))assert.ok(Math.hypot(semiAfter[id].x-p.x,semiAfter[id].y-p.y)<1e-6,`semi atom ${id} moved`);assert.ok(semiAfter[7].y<semiAfter[5].y);await page.locator('.molecule-stage').screenshot({path:`${out}/${toggles}-semi.png`});
   const expected=beforeIdentity===e?'C/C=C/CC(C)C':'C/C=C\\CC(C)C';assert.equal(structuralIdentity(await exported()),structuralIdentity(expected));
   await page.close();
  }
  assert.equal(seen.size,2,'both E and Z must be exercised');
 }finally{await browser?.close();await server.close();}
},{timeout:240000});
