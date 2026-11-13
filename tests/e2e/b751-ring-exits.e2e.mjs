import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('aromatic ring exits are radial and retain the molecular graph',async()=>{
 const mode=process.env.B751_BASELINE?'before':'after',out=`reports/b751/${process.env.B751_OUT??mode}`;await mkdir(out,{recursive:true});
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;const results=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
  const cases=[{id:'benzene',expected:'c1ccccc1'},{id:'fenol',expected:'Oc1ccccc1',group:true},...[1,2,3,4,5,6].map(id=>({id:`c${id}`,expected:'Cc1ccccc1',anchors:[id]})),{id:'para',expected:'Cc1ccc(C)cc1',anchors:[1,4]}];
  for(const item of cases.filter(x=>!process.env.B751_CASE||process.env.B751_CASE.split(',').includes(x.id))){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/'))return route.continue();return route.fulfill({status:200,contentType:'application/json',body:'{}'});});
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
   const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
   await page.locator('.ring-button').click();await page.locator('.aromatic-option').filter({has:page.getByText('Benceno',{exact:true})}).click();await atom(1).click({force:true});
   await page.waitForFunction(()=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===6);
   if(process.env.B751_MIRROR)await page.getByRole('button',{name:'Redibujar la estructura en espejo'}).click();
   if(item.group){await page.locator('.functional-button').click();await page.locator('.functional-option').filter({has:page.getByText('Alcohol',{exact:true})}).click();await atom(1).click({force:true});}
   for(const id of item.anchors??[]){await atom(id).click({force:true});await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();}
   await page.locator('.view-mode-switch button').nth(2).click();
   const coords=await page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const v=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return [n.dataset.atomId,{x:Number(v[1]),y:Number(v[2])}]})));
   const center={x:[1,2,3,4,5,6].reduce((s,id)=>s+coords[id].x,0)/6,y:[1,2,3,4,5,6].reduce((s,id)=>s+coords[id].y,0)/6};
   const links=(item.group?[[1,7]]:(item.anchors??[]).map((id,i)=>[id,7+i])).map(([id,child])=>{const a=coords[id],b=coords[child],r={x:a.x-center.x,y:a.y-center.y},v={x:b.x-a.x,y:b.y-a.y};return {id,child,cosine:(r.x*v.x+r.y*v.y)/(Math.hypot(r.x,r.y)*Math.hypot(v.x,v.y))};});
   if(mode==='after')for(const link of links)assert.ok(link.cosine>0.995,`${item.id}: exit ${link.id} cosine ${link.cosine}`);
   await page.locator('.molecule-stage').screenshot({path:`${out}/${item.id}-skeletal.png`});
   await page.locator('.view-mode-switch button').nth(0).click();await page.locator('.molecule-stage').screenshot({path:`${out}/${item.id}-semi.png`});
   const semi=await page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>{const v=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return [n.dataset.atomId,{x:Number(v[1]),y:Number(v[2])}]})));
   const semiCenter={x:[1,2,3,4,5,6].reduce((s,id)=>s+semi[id].x,0)/6,y:[1,2,3,4,5,6].reduce((s,id)=>s+semi[id].y,0)/6};
   const semiLinks=links.map(({id,child})=>{const a=semi[id],b=semi[child],r={x:a.x-semiCenter.x,y:a.y-semiCenter.y},v={x:b.x-a.x,y:b.y-a.y};return {id,child,cosine:(r.x*v.x+r.y*v.y)/(Math.hypot(r.x,r.y)*Math.hypot(v.x,v.y))};});
   if(mode==='after')for(const link of semiLinks)assert.ok(link.cosine>(link.id===1||link.id===4?0.995:0.8),`${item.id}: semideveloped exit ${link.id} cosine ${link.cosine}`);
   await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await pending;
   const smiles=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];assert.equal(structuralIdentity(smiles),structuralIdentity(item.expected));
   results.push({id:item.id,links,semiLinks,smiles});await page.close();
  }
 }finally{await writeFile(`${out}/results.json`,JSON.stringify({mode,results},null,2)+'\n');await browser?.close();await server.close();}
},{timeout:300000});
