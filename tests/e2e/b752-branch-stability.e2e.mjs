import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

test('manual branch placement records before and after geometry',async()=>{
 const out=process.env.B752_OUT??'reports/b752/before';await mkdir(out,{recursive:true});
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/'))return route.continue();return route.fulfill({status:200,contentType:'application/json',body:'{}'});});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  const atom=id=>page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
  await atom(1).click({force:true,timeout:90000});await page.locator('.view-mode-switch button').nth(2).click();
  const chainLength=Number(process.env.B752_CHAIN_LENGTH??6);
  for(let i=1;i<chainLength;i++)await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
  const first=Number(process.env.B752_FIRST??2),second=Number(process.env.B752_SECOND??4);
  await atom(first).click({force:true});await page.getByRole('button',{name:'Añadir carbono hacia arriba'}).click();
  const positions=async()=>page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>{const scale=nodes.length<=10?1:nodes.length<=20?.78:nodes.length<=50?.5:.36;return Object.fromEntries(nodes.map(n=>{const v=n.getAttribute('transform').match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return [n.dataset.atomId,{x:Number(v[1])/scale,y:Number(v[2])/scale}]}))});
  const assertDirection=(points,parent,child,dir,view)=>assert.ok((points[child].y-points[parent].y)*(dir==='arriba'?-1:1)>1e-6,`${view}: arrow ${dir} did not place atom ${child} on the requested side`);
  if(process.env.B752_VERIFY_DIRECTIONS){
   assertDirection(await positions(),first,chainLength+1,'arriba','skeletal');
   await page.locator('.view-mode-switch button').nth(0).click();assertDirection(await positions(),first,chainLength+1,'arriba','semi-developed');await page.locator('.view-mode-switch button').nth(2).click();
  }
  if(process.env.B752_EXTEND){
   const prior=await positions();await page.locator('.molecule-stage').screenshot({path:`${out}/before-extra.png`});
   const extraDirection=process.env.B752_EXTRA_DIRECTION??'arriba';
   await atom(Number(process.env.B752_EXTRA_PARENT??chainLength+1)).click({force:true});await page.getByRole('button',{name:`Añadir carbono hacia ${extraDirection}`}).click();
   const added=await positions();for(const [id,p] of Object.entries(prior))assert.ok(Math.hypot(added[id].x-p.x,added[id].y-p.y)<1e-6,`extra addition moved atom ${id}`);
   if(process.env.B752_VERIFY_DIRECTIONS){const p=Number(process.env.B752_EXTRA_PARENT??chainLength+1);assertDirection(added,p,chainLength+2,extraDirection,'skeletal');await page.locator('.view-mode-switch button').nth(0).click();assertDirection(await positions(),p,chainLength+2,extraDirection,'semi-developed');await page.locator('.view-mode-switch button').nth(2).click();}
  }
  const bonds=async()=>page.locator('.molecule-stage [data-bond-a]').evaluateAll(nodes=>nodes.map(n=>[Number(n.dataset.bondA),Number(n.dataset.bondB),Number(n.dataset.bondOrder)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
  const before=await positions(),bondsBefore=await bonds();await page.locator('.molecule-stage').screenshot({path:`${out}/one-branch.png`});
  await page.locator('.view-mode-switch button').nth(0).click();
  const semiBefore=await positions();await page.locator('.molecule-stage').screenshot({path:`${out}/one-branch-semi.png`});
  await page.locator('.view-mode-switch button').nth(2).click();
  await atom(second).click({force:true});await page.getByRole('button',{name:`Añadir carbono hacia ${process.env.B752_SECOND_DIRECTION??'arriba'}`}).click();
  const expectedCount=chainLength+(process.env.B752_EXTEND?3:2);
  await page.waitForFunction(count=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===count,expectedCount);
  const after=await positions(),bondsAfter=await bonds();await page.locator('.molecule-stage').screenshot({path:`${out}/two-branches.png`});
  if(process.env.B752_VERIFY_DIRECTIONS)assertDirection(after,second,expectedCount,process.env.B752_SECOND_DIRECTION??'arriba','skeletal');
  if(process.env.B752_HISTORY){
   await page.getByTitle('Deshacer').first().click();await page.waitForFunction(count=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===count,expectedCount-1);
   const undone=await positions();for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(undone[id].x-p.x,undone[id].y-p.y)<1e-6,`undo moved atom ${id}`);
   await page.getByTitle('Rehacer').first().click();await page.waitForFunction(count=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===count,expectedCount);
   const redone=await positions();for(const [id,p] of Object.entries(after))assert.ok(Math.hypot(redone[id].x-p.x,redone[id].y-p.y)<1e-6,`redo moved atom ${id}`);
  }
  await page.locator('.view-mode-switch button').nth(0).click();const semiAfter=await positions();await page.locator('.molecule-stage').screenshot({path:`${out}/two-branches-semi.png`});
  if(process.env.B752_VERIFY_DIRECTIONS)assertDirection(semiAfter,second,expectedCount,process.env.B752_SECOND_DIRECTION??'arriba','semi-developed');
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);
  const anchor=first===1?2:first-1;
  const branchId=chainLength+1;
  const sideBefore=cross(before[anchor],before[first],before[branchId]),sideAfter=cross(after[anchor],after[first],after[branchId]);
  await writeFile(`${out}/results.json`,JSON.stringify({before,after,semiBefore,semiAfter,bondsBefore,bondsAfter,sideBefore,sideAfter,flipped:sideBefore*sideAfter<0},null,2)+'\n');
  if(process.env.B752_ASSERT){
   assert.ok(sideBefore*sideAfter>0,'the existing branch must remain on its original side');
   for(const [id,p] of Object.entries(before))assert.ok(Math.hypot(after[id].x-p.x,after[id].y-p.y)<1e-6,`existing atom ${id} moved`);
   for(const [id,p] of Object.entries(semiBefore))assert.ok(Math.hypot(semiAfter[id].x-p.x,semiAfter[id].y-p.y)<1e-6,`semi-developed atom ${id} moved`);
   assert.equal(bondsAfter.length,bondsBefore.length+1);
   for(const bond of bondsBefore)assert.ok(bondsAfter.some(next=>JSON.stringify(next)===JSON.stringify(bond)),`bond ${bond} changed`);
   assert.ok(bondsAfter.some(([a,b,order])=>order===1&&((a===second&&b===expectedCount)||(b===second&&a===expectedCount))));
  }
  if(process.env.B752_DRAG_PROBE){
   await page.locator('.view-mode-switch button').nth(2).click();const beforeDrag=await positions();
   const bounds=await atom(branchId).boundingBox();assert.ok(bounds,'branch must be visible');
   await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+70,bounds.y+bounds.height/2-80,{steps:12});await page.mouse.up();
   const afterDrag=await positions();const distance=Math.hypot(afterDrag[branchId].x-beforeDrag[branchId].x,afterDrag[branchId].y-beforeDrag[branchId].y);
   await writeFile(`${out}/drag-probe.json`,JSON.stringify({branchId,before:beforeDrag[branchId],after:afterDrag[branchId],distance},null,2)+'\n');
   await page.locator('.molecule-stage').screenshot({path:`${out}/drag-attempt.png`});
  }
 }finally{await browser?.close();await server.close();}
},{timeout:180000});
