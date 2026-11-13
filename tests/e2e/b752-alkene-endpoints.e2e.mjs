import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('substitution on both alkene endpoints preserves graph, geometry, and stereo',async()=>{
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
  const out='reports/b752/alkene-endpoints';await mkdir(out,{recursive:true});
  for(const [label,input,expected] of [['E','CC/C=C/CC','CC/C(C)=C(C)/CC'],['Z','CC/C=C\\CC','CC/C(C)=C(C)\\CC'],['unassigned','CCC=CCC','CCC(C)=C(C)CC']]){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
   await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/')?route.continue():route.fulfill({status:200,contentType:'application/json',body:'{}'});});
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
   await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(input);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();
   const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
   const points=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const m=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return[n.dataset.atomId,{x:+m[1],y:+m[2]}]})));
   const bonds=async()=>page.locator('.molecule-bonds-layer [data-bond-a]').evaluateAll(nodes=>nodes.map(n=>[+n.dataset.bondA,+n.dataset.bondB,+n.dataset.bondOrder]));
   const exportSmiles=async()=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const d=await pending;const s=(await readFile(await d.path(),'utf8')).trim().split(/\s+/)[0];await page.locator('[aria-controls="smiles-interop-panel"]').click();return s;};
   const records=[];await page.locator('.view-mode-switch button').nth(2).click();
   for(const [parent,direction,newId] of [[3,'arriba',7],[4,'abajo',8]]){
    let selectedDirection=direction, rejection=null;
    const before=await points(),oldBonds=await bonds();await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-${newId}-before.png`});
    await page.locator('.view-mode-switch button').nth(0).click();const semiBefore=await points();await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-${newId}-semi-before.png`});await page.locator('.view-mode-switch button').nth(2).click();
    await atom(parent).click({force:true});await page.getByRole('button',{name:`Añadir carbono hacia ${direction}`}).click();
    await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n
      || document.body.innerText.includes('No hay una posición segura en esa dirección.')
      || document.body.innerText.includes('Ese espacio ya está ocupado'),newId,{timeout:15000});
    if(await page.locator('.molecule-nodes-layer [data-atom-id]').count()!==newId){
     const notice=(await page.locator('body').innerText()).split('\n').filter(s=>s.includes('posición segura')||s.includes('ocupado'));
     await writeFile(`${out}/${label}-${newId}-rejected.json`,JSON.stringify({before,semiBefore,oldBonds,notice},null,2));
     await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-${newId}-rejected.png`});
     assert.deepEqual(await points(),before,`${label}: rejection moved atoms`);assert.deepEqual(await bonds(),oldBonds,`${label}: rejection changed bonds`);
     const sign=direction==='arriba'?-1:1;
     assert.ok(Object.entries(semiBefore).some(([id,p])=>+id!==parent && Math.abs(p.x-semiBefore[parent].x)<1e-6 && (p.y-semiBefore[parent].y)*sign>0),`${label}: requested semi-developed lane was not obstructed`);
     rejection={direction,notice};selectedDirection=direction==='arriba'?'derecha':'arriba';
     await page.getByRole('button',{name:`Añadir carbono hacia ${selectedDirection}`}).click();
     try { await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n,newId,{timeout:10000}); }
     catch(error){const text=await page.locator('body').innerText();await writeFile(`${out}/${label}-${newId}-retry.json`,JSON.stringify({notice:text.split('\n').filter(s=>s.includes('posición segura')||s.includes('ocupado')),after:await points(),bonds:await bonds()},null,2));throw error;}
    }
    const after=await points(),newBonds=await bonds();for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(after[id].x-p.x,after[id].y-p.y)<1e-6,`${label} atom ${id} moved`);
    const additionNotice=await page.locator('body').innerText();
    const requested=(map)=>selectedDirection==='derecha'?map[newId].x-map[parent].x:(map[newId].y-map[parent].y)*(selectedDirection==='arriba'?-1:1);
    assert.ok(requested(after)>1e-6);
    for(const bond of oldBonds)assert.ok(newBonds.some(b=>JSON.stringify(b)===JSON.stringify(bond)));
    assert.ok(newBonds.some(([a,b,o])=>o===2&&((a===3&&b===4)||(a===4&&b===3))));
    await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-${newId}-after.png`});await page.locator('.view-mode-switch button').nth(0).click();const semiAfter=await points();
    const moved=Object.entries(semiBefore).filter(([id,p])=>Math.hypot(semiAfter[id].x-p.x,semiAfter[id].y-p.y)>=1e-6).map(([id])=>Number(id));
    if(moved.length){
     assert.equal(moved.length,1,`${label}: only one terminal may be adjusted`);
     assert.ok(additionNotice.includes('Se ajustó un átomo terminal en la vista semidesarrollada para evitar una colisión.'));
     const movedId=moved[0];assert.equal(oldBonds.filter(([a,b])=>a===movedId||b===movedId).length,1);
     const from=semiBefore[parent],to=semiAfter[newId],block=semiBefore[movedId];
     const dx=to.x-from.x,dy=to.y-from.y,length2=dx*dx+dy*dy;
     const t=((block.x-from.x)*dx+(block.y-from.y)*dy)/length2;
     const distance=Math.hypot(block.x-(from.x+t*dx),block.y-(from.y+t*dy));
     assert.ok(t>0 && t<=1+1e-6 && distance<1e-5,`${label}: terminal did not obstruct the new bond`);
    }
    assert.ok(requested(semiAfter)>1e-6);
    await page.locator('.molecule-stage').screenshot({path:`${out}/${label}-${newId}-semi.png`});await page.locator('.view-mode-switch button').nth(2).click();records.push({before,after,semiBefore,semiAfter,oldBonds,newBonds,rejection,selectedDirection,moved});
   }
   const result=await exportSmiles();assert.equal(structuralIdentity(result),structuralIdentity(expected),`${label} final isomeric SMILES`);
   await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(result);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();
   assert.equal(structuralIdentity(await exportSmiles()),structuralIdentity(expected),`${label} reimport`);
   await writeFile(`${out}/${label}.json`,JSON.stringify({input,result,expected,records},null,2));await page.close();
  }
 }finally{await browser?.close();await server.close();}
},{timeout:300000});
