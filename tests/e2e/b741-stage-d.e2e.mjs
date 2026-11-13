import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../../app/validated-name-derivation.ts';
import {classifyValidatedStructureColors,structuralBondKey} from '../../app/structural-color-classification.ts';

test('condensed structural colors and custom PNG in dark theme',async()=>{
 const out='reports/b741/stage-d-visual-e2e';await mkdir(out,{recursive:true});
 const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
 await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});const errors=[];
 try{
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es');localStorage.setItem('hydrocarbon-theme','dark')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin&&!u.pathname.startsWith('/api/'))return route.continue();if(u.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});if(u.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});});
  await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill('CCC=O');await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.getByText('propanal',{exact:true}).first().waitFor({timeout:30000});await page.locator('[aria-controls="smiles-interop-panel"]').click();
  await page.locator('.view-mode-switch button').nth(1).click();await page.locator('.condensed-renderer').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  const graph=moleculeFromSmiles('CCC=O').molecule,proof=reconcileSystematicName(graph,'propanal');assert.ok(proof);
  const classification=classifyValidatedStructureColors(graph,proof);assert.ok(classification);
  const rendered=await page.locator('.condensed-token[data-atom-id], .condensed-token[data-bond-a]').evaluateAll(nodes=>nodes.map(n=>{const text=n.querySelector('.condensed-atom-text')??(n.dataset.bondA?n.querySelector(':scope > text'):null);return {atom:n.dataset.atomId,a:n.dataset.bondA,b:n.dataset.bondB,classes:n.getAttribute('class'),fill:text?getComputedStyle(text).fill:null}}));
  const legend=await page.locator('.molecule-stage .functional-key').evaluate(n=>getComputedStyle(n).backgroundColor);
  for(const token of rendered){const category=token.atom?classification.atoms.get(Number(token.atom)):classification.bonds.get(structuralBondKey(Number(token.a),Number(token.b)));assert.ok(token.classes.includes(`structural-${category}`));if(category==='functional' && token.fill)assert.equal(token.fill,legend);}
  await page.locator('.molecule-stage').screenshot({path:`${out}/aldehyde-dark.png`});
  await page.locator('.canvas-export-button').click();const dialog=page.locator('.png-export-dialog');await dialog.waitFor();
  await dialog.getByLabel('Elegir color de cadena principal').fill('#0874e8');await dialog.getByLabel('Elegir color de grupo funcional').fill('#ee22aa');await dialog.getByLabel('Elegir color de sustituyentes').fill('#16a060');
  const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Descargar PNG'}).click();const download=await downloadPromise;const file=`${out}/aldehyde-custom.png`;await download.saveAs(file);
  const bytes=await readFile(file);const pixels=await page.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let blue=0,pink=0;for(let i=0;i<d.length;i+=4){if(d[i]===8&&d[i+1]===116&&d[i+2]===232&&d[i+3]>200)blue++;if(d[i]===238&&d[i+1]===34&&d[i+2]===170&&d[i+3]>200)pink++;}return {width:c.width,height:c.height,blue,pink};},bytes.toString('base64'));
  assert.ok(pixels.blue>0 && pixels.pink>0,JSON.stringify(pixels));
  if(await dialog.isVisible())await dialog.getByRole('button',{name:'Cancelar'}).click();
  const load=async smiles=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();};
  await load('CC=CC');await page.getByText('but-2-eno',{exact:true}).first().waitFor({timeout:30000});
  const panel=page.locator('#iupac-reasoning-content'),help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
  const buttons=panel.locator('button[data-name-fragment]');assert.ok(await buttons.count()>0);await buttons.first().click();
  const partial=await page.locator('.molecule-stage').evaluate(stage=>({atoms:[...stage.querySelectorAll('.reasoning-visual-overlay [data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)),bonds:[...stage.querySelectorAll('.reasoning-visual-overlay [data-reasoning-bond]')].map(n=>n.dataset.reasoningBond.split(':').map(Number))}));
  const partialGraph=moleculeFromSmiles('CC=CC').molecule;assert.ok(partial.atoms.length>0);for(const id of partial.atoms)assert.ok(partialGraph.atoms.some(a=>a.id===id));for(const [a,b] of partial.bonds)assert.ok(partialGraph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x));
  const double=partialGraph.bonds.find(([, ,order])=>order===2);assert.ok(double);assert.deepEqual([...new Set(partial.atoms)].sort(),double.slice(0,2).sort());
  assert.deepEqual(partial.bonds.map(pair=>pair.slice().sort().join(':')),[double.slice(0,2).sort().join(':')]);
  await page.screenshot({path:`${out}/partial-alkene.png`,fullPage:true});
  await load('C[C@H](O)CC');await page.locator('.stereochemistry-toggle').waitFor({state:'visible'});const stereo=page.locator('.stereochemistry-toggle');
  assert.equal(await stereo.isEnabled(),true);if(await stereo.getAttribute('aria-checked')!=='true')await stereo.click();
  await page.locator('.view-mode-switch button').nth(2).click();const stereoBond=page.locator('.tetrahedral-wedge,.tetrahedral-hash');await stereoBond.first().waitFor({state:'attached',timeout:30000});
  const stereoKind=await stereoBond.first().getAttribute('class');await page.locator('.molecule-stage').screenshot({path:`${out}/stereobond-dark.png`});assert.deepEqual(errors,[]);
  await writeFile(`${out}/results.json`,JSON.stringify({status:'PASS',browser:browser.version(),theme:'dark',legend,rendered,pixels,partial,stereoKind,errors},null,2)+'\n');
 }finally{await browser.close();await server.close();}
},{timeout:120000});
