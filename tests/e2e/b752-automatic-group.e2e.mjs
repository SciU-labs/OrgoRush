import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('automatic multi-atom group keeps the existing graph and coordinates',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
  await atom(1).click({force:true,timeout:90000});await page.locator('.view-mode-switch button').nth(2).click();
  for(let i=1;i<6;i++)await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
  const points=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const m=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return[n.dataset.atomId,{x:+m[1],y:+m[2]}]})));
  const before=await points();await page.locator('.view-mode-switch button').nth(0).click();const semiBefore=await points();await page.locator('.view-mode-switch button').nth(2).click();
  const out='reports/b752/automatic-acid';await mkdir(out,{recursive:true});await page.locator('.molecule-stage').screenshot({path:`${out}/before.png`});
  await page.locator('.functional-button').click();await page.locator('.functional-option').filter({has:page.getByText('Ácido carboxílico',{exact:true})}).click();await atom(6).click({force:true});
  await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===8);
  const after=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/after.png`});
  for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(after[id].x-p.x,after[id].y-p.y)<1e-6,`atom ${id} moved`);
  await page.locator('.view-mode-switch button').nth(0).click();const semiAfter=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/semi.png`});
  for(const [id,p] of Object.entries(semiBefore))assert.ok(Math.hypot(semiAfter[id].x-p.x,semiAfter[id].y-p.y)<1e-6,`semi atom ${id} moved`);
  await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await pending;
  const smiles=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];assert.equal(structuralIdentity(smiles),structuralIdentity('CCCCCC(=O)O'));
 }finally{await browser?.close();await server.close();}
},{timeout:180000});
