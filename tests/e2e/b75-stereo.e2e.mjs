import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('defined stereochemistry survives view changes and SMILES export and import',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/'))return route.continue();return route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  const input='C[C@H](O)CC', identity=structuralIdentity(input);
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(input);await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.locator('[aria-controls="smiles-interop-panel"]').click();
  const stereo=page.locator('.stereochemistry-toggle');await stereo.waitFor({state:'visible'});if(await stereo.getAttribute('aria-checked')!=='true')await stereo.click();
  await page.locator('.view-mode-switch button').nth(2).click();await page.locator('.tetrahedral-wedge,.tetrahedral-hash').first().waitFor({state:'attached'});
  const wedge=async()=>page.locator('.tetrahedral-wedge,.tetrahedral-hash').first().evaluate(node=>{const bond=node.closest('[data-bond-a][data-bond-b]');return {className:node.getAttribute('class'),a:bond?.getAttribute('data-bond-a'),b:bond?.getAttribute('data-bond-b')}});
  const originalWedge=await wedge();assert.ok(originalWedge.a&&originalWedge.b);
  await page.locator('.view-mode-switch button').nth(0).click();await page.locator('.view-mode-switch button').nth(2).click();assert.deepEqual(await wedge(),originalWedge);
  await mkdir('reports/b75/aromatic',{recursive:true});await page.locator('.molecule-stage').screenshot({path:'reports/b75/aromatic/stereo-skeletal.png'});
  const exportSmiles=async()=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await pending;return (await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0]};
  const first=await exportSmiles();assert.equal(structuralIdentity(first),identity);
  await page.locator('#smiles-text-input').fill(first);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();
  await page.locator('.view-mode-switch button').nth(0).click();await page.locator('.view-mode-switch button').nth(2).click();
  const second=await exportSmiles();assert.equal(structuralIdentity(second),identity);
  assert.notEqual(structuralIdentity(second),structuralIdentity('C[C@@H](O)CC'));
  // Extending one stereochemical ligand changes CIP priorities but must not
  // invert its spatial arrangement. Reimport the original for stable IDs.
  await page.locator('#smiles-text-input').fill(input);await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('.functional-button').click();
  await page.locator('.functional-option').filter({has:page.getByText('Fluoro',{exact:true})}).click();
  await page.locator('.molecule-nodes-layer [data-atom-id="1"]').click({force:true});
  await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===6);
  const edited=await exportSmiles();assert.equal(structuralIdentity(edited),structuralIdentity('FC[C@H](O)CC'),'adding F must preserve spatial stereochemistry');
  await page.locator('#smiles-text-input').fill(edited);await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('.view-mode-switch button').nth(2).click();
  await page.locator('.tetrahedral-wedge,.tetrahedral-hash').first().waitFor({state:'attached'});
  const roundtrip=await exportSmiles();assert.equal(structuralIdentity(roundtrip),structuralIdentity('FC[C@H](O)CC'));
  await page.locator('#smiles-text-input').fill(input);await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('.functional-button').click();
  await page.locator('.functional-option').filter({has:page.getByText('Fluoro',{exact:true})}).click();
  await page.locator('.molecule-nodes-layer [data-atom-id="2"]').click({force:true});
  await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===6);
  const centerEdit=await exportSmiles();assert.equal(structuralIdentity(centerEdit),structuralIdentity('C[C@@](O)(F)CC'),'replacing the implicit hydrogen must retain spatial arrangement');
  await page.locator('#smiles-text-input').fill(centerEdit);await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.locator('#smiles-feedback').waitFor({state:'visible'});
  assert.equal(await page.locator('#smiles-feedback').getAttribute('role'),'status','four-neighbor center must reimport');
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('.view-mode-switch button').nth(2).click();
  await page.locator('.tetrahedral-wedge,.tetrahedral-hash').first().waitFor({state:'attached'});
  assert.equal(structuralIdentity(await exportSmiles()),structuralIdentity('C[C@@](O)(F)CC'));
 }finally{await browser?.close();await server.close();}
},{timeout:180000});
