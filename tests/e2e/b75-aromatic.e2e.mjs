import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('manual aromatic structures preserve complete graph through view changes and SMILES roundtrip',async()=>{
 const out=process.env.B75_OUT??'reports/b75/aromatic';await mkdir(out,{recursive:true});
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
  for(const item of [{id:'fenol',expected:'Oc1ccccc1'},{id:'cadena',expected:'CCCc1ccccc1'},{id:'aminoacido',expected:'N[C@@H](Cc1ccc(O)cc1)C(=O)O'}].filter(value=>!process.env.B75_AROMATIC_CASE||value.id===process.env.B75_AROMATIC_CASE)){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/'))return route.continue();return route.fulfill({status:200,contentType:'application/json',body:'{}'});});
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
   const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
   const group=async(label,id)=>{await page.locator('.functional-button').click();await page.locator('.functional-option').filter({has:page.getByText(label,{exact:true})}).click();await atom(id).click({force:true});};
   await page.locator('.ring-button').click();await page.locator('.aromatic-option').filter({has:page.getByText('Benceno',{exact:true})}).click();await atom(1).click({force:true});
   await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===6);
   if(item.id!=='cadena')await group('Alcohol',1);
   if(item.id!=='fenol'){
    await atom(4).click({force:true});for(let i=0;i<3;i++)await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
    if(item.id==='aminoacido'){await group('Amina',9);await group('Ácido carboxílico',10);}
   }
   const exportSmiles=async()=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await promise;const value=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];return value;};
   let expected=item.id==='aminoacido'?'NC(Cc1ccc(O)cc1)C(=O)O':item.expected;
   let actual=await exportSmiles();assert.equal(structuralIdentity(actual),structuralIdentity(expected),`${item.id}: initial graph`);
   await page.locator('[aria-controls="smiles-interop-panel"]').click();
   for(const [view,index] of [['skeletal',2],['semi',0]]){await page.locator('.view-mode-switch button').nth(index).click();await page.locator('.molecule-stage').screenshot({path:`${out}/${item.id}-${view}.png`});}
   if(item.id==='aminoacido'){
    await page.locator('.canvas-export-button').click();const dialog=page.locator('.png-export-dialog');await dialog.waitFor();
    const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Descargar PNG'}).click();const png=await pending;
    await png.saveAs(`${out}/aminoacido-export.png`);const bytes=await readFile(`${out}/aminoacido-export.png`);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   }
   actual=await exportSmiles();assert.equal(structuralIdentity(actual),structuralIdentity(expected),`${item.id}: views`);
   if(item.id==='cadena'){
    await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('.view-mode-switch button').nth(2).click();
    const ringPositions=await page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>nodes.slice(0,6).map(n=>n.getAttribute('transform')));
    await atom(8).click({force:true});await page.getByRole('button',{name:'Añadir carbono hacia arriba'}).click();
    assert.deepEqual(await page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>nodes.slice(0,6).map(n=>n.getAttribute('transform'))),ringPositions);
    await page.locator('.molecule-stage').screenshot({path:`${out}/cadena-rama-skeletal.png`});
    expected='CC(C)Cc1ccccc1';actual=await exportSmiles();assert.equal(structuralIdentity(actual),structuralIdentity(expected),'side branch graph');
   }
   await page.locator('#smiles-text-input').fill(actual);await page.locator('#smiles-interop-panel button[type="submit"]').click();
   await page.waitForTimeout(500);await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();
   const roundtripPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await roundtripPromise;const roundtrip=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];
   assert.equal(structuralIdentity(roundtrip),structuralIdentity(expected),`${item.id}: roundtrip`);
   if(item.id==='cadena'){
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const terminal=await page.evaluate(()=>{const ns=[...document.querySelectorAll('.molecule-nodes-layer [data-atom-id]')],bs=[...document.querySelectorAll('.molecule-bonds-layer [data-bond-a][data-bond-b]')];return ns.find(n=>n.dataset.atomElement==='C'&&bs.filter(b=>b.dataset.bondA===n.dataset.atomId||b.dataset.bondB===n.dataset.atomId).length===1)?.dataset.atomId});
    assert.ok(terminal);const count=await page.locator('.molecule-nodes-layer [data-atom-id]').count();await atom(terminal).click({force:true});
    await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n,count+1);
   }
   await page.close();
  }
 }finally{await browser?.close();await server.close();}
},{timeout:300000});
