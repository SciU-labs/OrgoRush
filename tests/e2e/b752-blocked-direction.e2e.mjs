import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

test('an impossible direction leaves the structure intact and shows a notice',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('.molecule-nodes-layer [data-atom-id="1"]').click({force:true,timeout:90000});await page.locator('.view-mode-switch button').nth(2).click();
  await page.getByTitle('Crear enlace triple').click();await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();await page.getByTitle('Crear enlace simple').click();
  const graph=async()=>page.locator('.molecule-stage [data-bond-a]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.bondA,n.dataset.bondB,n.dataset.bondOrder]));
  const points=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.atomId,n.getAttribute('transform')]));
  const before=await points(),beforeGraph=await graph();assert.deepEqual(beforeGraph,[['1','2','3']]);
  const out='reports/b752/blocked-direction';await mkdir(out,{recursive:true});await page.locator('.molecule-stage').screenshot({path:`${out}/before.png`});
  await page.getByRole('button',{name:'Añadir carbono hacia arriba'}).click();
  await page.getByText('No hay una posición segura en esa dirección. Elige otra dirección.').waitFor({state:'visible'});
  assert.deepEqual(await points(),before);assert.deepEqual(await graph(),beforeGraph);await page.locator('.molecule-stage').screenshot({path:`${out}/after.png`});
  await page.locator('.view-mode-switch button').nth(0).click();assert.equal(await page.locator('.molecule-nodes-layer [data-atom-id]').count(),2);
 }finally{await browser?.close();await server.close();}
},{timeout:180000});
