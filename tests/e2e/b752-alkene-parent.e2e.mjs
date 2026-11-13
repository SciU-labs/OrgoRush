import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('manually built alkene changes parent without global re-layout and survives undo/redo',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
  await atom(1).click({force:true,timeout:90000});await page.locator('.view-mode-switch button').nth(2).click();
  for(let i=1;i<6;i++)await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
  const double=page.locator('.molecule-bonds-layer [data-bond-a="3"][data-bond-b="4"]');await double.click({force:true});
  assert.equal(await double.getAttribute('data-bond-order'),'2');const stereo=page.locator('.stereochemistry-toggle');assert.ok(await stereo.isEnabled());if(await stereo.getAttribute('aria-checked')!=='true')await stereo.click();await double.click({force:true,modifiers:['Alt']});
  const exportSmiles=async()=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const d=await pending;const s=(await readFile(await d.path(),'utf8')).trim().split(/\s+/)[0];await page.locator('[aria-controls="smiles-interop-panel"]').click();return s;};
  const initial=await exportSmiles(),initialName=await page.locator('.iupac-dock-name').innerText(),identity=structuralIdentity(initial),e=structuralIdentity('CC/C=C/CC'),z=structuralIdentity('CC/C=C\\CC');assert.ok(identity===e||identity===z);
  const points=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const m=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return[n.dataset.atomId,{x:+m[1],y:+m[2]}]})));
  const bonds=async()=>page.locator('.molecule-bonds-layer [data-bond-a]').evaluateAll(nodes=>nodes.map(n=>[+n.dataset.bondA,+n.dataset.bondB,+n.dataset.bondOrder]));
  const out='reports/b752/alkene-parent';await mkdir(out,{recursive:true});const records=[];
  for(const [parent,newId] of [[3,7],[7,8],[8,9]]){
   const before=await points(),beforeBonds=await bonds();await page.locator('.molecule-stage').screenshot({path:`${out}/${newId}-before.png`});
   await page.locator('.view-mode-switch button').nth(0).click();const semiBefore=await points();await page.locator('.view-mode-switch button').nth(2).click();
   await atom(parent).click({force:true});const rejected=[];let chosen;
   for(const direction of ['arriba','derecha','izquierda','abajo']){
    await page.getByRole('button',{name:`Añadir carbono hacia ${direction}`}).click();
    await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n||document.body.innerText.includes('No hay una posición segura en esa dirección.')||document.body.innerText.includes('Ese espacio ya está ocupado'),newId,{timeout:15000});
    if(await page.locator('.molecule-nodes-layer [data-atom-id]').count()===newId){chosen=direction;break;}
    assert.deepEqual(await points(),before);assert.deepEqual(await bonds(),beforeBonds);rejected.push(direction);
   }
   assert.ok(chosen,`all directions rejected when adding ${newId}`);
   const after=await points(),afterBonds=await bonds();for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(after[id].x-p.x,after[id].y-p.y)<1e-6,`atom ${id} moved`);
   for(const bond of beforeBonds)assert.ok(afterBonds.some(b=>JSON.stringify(b)===JSON.stringify(bond)));assert.equal(await double.getAttribute('data-bond-order'),'2');
   const notice=await page.locator('body').innerText();await page.locator('.molecule-stage').screenshot({path:`${out}/${newId}-after.png`});await page.locator('.view-mode-switch button').nth(0).click();const semiAfter=await points();
   const moved=Object.entries(semiBefore).filter(([id,p])=>Math.hypot(semiAfter[id].x-p.x,semiAfter[id].y-p.y)>1e-6).map(([id])=>+id);
   if(moved.length){assert.equal(moved.length,1);assert.ok(notice.includes('Se ajustó un átomo terminal en la vista semidesarrollada'));assert.equal(beforeBonds.filter(([a,b])=>a===moved[0]||b===moved[0]).length,1);}
   await page.locator('.molecule-stage').screenshot({path:`${out}/${newId}-semi.png`});await page.locator('.view-mode-switch button').nth(2).click();
   records.push({parent,newId,chosen,rejected,before,after,semiBefore,semiAfter,beforeBonds,afterBonds,moved});
  }
  assert.ok((await atom(7).getAttribute('class')).includes('on-main-chain'),'the grown branch must enter the nomenclature parent');
  const final=await exportSmiles(),finalName=await page.locator('.iupac-dock-name').innerText(),expected=identity===e?'CC/C(CCC)=C/CC':'CC/C(CCC)=C\\CC';assert.equal(structuralIdentity(final),structuralIdentity(expected));assert.notEqual(finalName,initialName,'the name must reflect the changed graph');
  const finalPoints=await points();await page.getByTitle('Deshacer').first().click();await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===8);assert.deepEqual(await points(),records[2].before);
  await page.locator('.view-mode-switch button').nth(0).click();assert.deepEqual(await points(),records[2].semiBefore);await page.locator('.view-mode-switch button').nth(2).click();
  await page.getByTitle('Rehacer').first().click();await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===9);assert.deepEqual(await points(),finalPoints);
  await page.locator('.view-mode-switch button').nth(0).click();assert.deepEqual(await points(),records[2].semiAfter);await page.locator('.view-mode-switch button').nth(2).click();assert.equal(structuralIdentity(await exportSmiles()),structuralIdentity(expected));
  await writeFile(`${out}/results.json`,JSON.stringify({initial,initialName,final,finalName,expected,records},null,2));
 }finally{await browser?.close();await server.close();}
},{timeout:240000});
