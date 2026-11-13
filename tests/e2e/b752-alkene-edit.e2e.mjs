import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('E and Z survive a real carbon addition and both projections',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  const points=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const m=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return [n.dataset.atomId,{x:+m[1],y:+m[2]}]})));
  const out='reports/b752/alkenes';await mkdir(out,{recursive:true});
  for(const [label,input,expected] of [['E','C/C=C/CC','C/C=C/CCC'],['Z','C/C=C\\CC','C/C=C\\CCC'],['unassigned','CC=CCC','CC=CCCC']]){
   await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(input);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();
   await page.locator('.view-mode-switch button').nth(2).click();
   const before=await points();assert.equal(Object.keys(before).length,5);
   await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-before.png`});
   await page.locator('.view-mode-switch button').nth(0).click();const semiBefore=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-semi-before.png`});await page.locator('.view-mode-switch button').nth(2).click();
   await page.locator('.molecule-nodes-layer [data-atom-id="5"]').click({force:true});await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===6);
   const after=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-after.png`});
   for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(after[id].x-p.x,after[id].y-p.y)<1e-6,`${label}: atom ${id} moved`);
   await page.locator('.view-mode-switch button').nth(0).click();const semiAfter=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-semi.png`});
   for(const [id,p] of Object.entries(semiBefore))assert.ok(Math.hypot(semiAfter[id].x-p.x,semiAfter[id].y-p.y)<1e-6,`${label}: semi-developed atom ${id} moved`);
   await page.locator('.view-mode-switch button').nth(2).click();
   await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await pending;
   const smiles=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];assert.equal(structuralIdentity(smiles),structuralIdentity(expected),`${label} stereo or connectivity changed`);
   await page.locator('[aria-controls="smiles-interop-panel"]').click();
  }
 }finally{await browser?.close();await server.close();}
},{timeout:240000});
