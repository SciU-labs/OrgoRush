import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';

const input=JSON.parse(await readFile('reports/b741/stage-e-matrix.json','utf8'));
const cases=input.rows.filter(row=>['es','en'].some(lang=>row.languages[lang].status==='PARTIAL'));
const out=process.env.B741_PARTIAL_OUT_DIR??'reports/b741/stage-e-partial-browser',reports=[];let server,browser,origin;
before(async()=>{await mkdir(out,{recursive:true});server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});});
after(async()=>{await writeFile(`${out}/results.json`,JSON.stringify({browser:browser?.version(),scope:'Graph membership and applicable typed bond checks only; not FULL',cases:reports},null,2)+'\n');await browser?.close();await server?.close();});
for(const row of cases)test(`PARTIAL controls: ${row.family}`,async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],result={family:row.family,status:'RUNNING',languages:[],errors};reports.push(result);
 try{
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin&&!u.pathname.startsWith('/api/'))return route.continue();if(u.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});if(u.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});});
  await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(row.smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.locator('[aria-controls="smiles-interop-panel"]').click();
  const parsed=moleculeFromSmiles(row.smiles);assert.ok(parsed.ok);const graph=parsed.molecule;
  for(const language of ['es','en']){if(language==='en')await page.getByRole('button',{name:'English',exact:true}).click();if(row.languages[language].status!=='PARTIAL')continue;
   await page.getByText(row.languages[language].name,{exact:true}).first().waitFor({timeout:30000});const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
   assert.match(await page.locator('#iupac-reasoning-content').innerText(),language==='es'?/numeración mostrada procede del análisis local.*orientaciones equivalentes/i:/displayed numbering comes from the local analysis.*equivalent orientations/i);
   if(row.family==='heterocycle')assert.match(await page.locator('#iupac-reasoning-content').innerText(),language==='es'?/6 átomos, de ellos 5 carbonos/:/6 atoms, including 5 carbons/);
   const controls=page.locator('#iupac-reasoning-content button.reasoning-name-fragment-control, #iupac-reasoning-content button.reasoning-step-number[aria-pressed]');const count=await controls.count(),checks=[];
   for(let i=0;i<count;i++){
    const button=controls.nth(i),label=await button.getAttribute('aria-label')??await button.innerText();
    await page.evaluate(index=>{let finish,observer,timer;window.__partialTarget=new Promise(resolve=>finish=resolve);
     const check=()=>{const button=document.querySelectorAll('#iupac-reasoning-content button.reasoning-name-fragment-control, #iupac-reasoning-content button.reasoning-step-number[aria-pressed]')[index],stage=document.querySelector('.molecule-stage');
      if(button?.getAttribute('aria-pressed')!=='true'||!stage?.querySelector('.reasoning-visual-overlay'))return;
      const atoms=[...new Set([...stage.querySelectorAll('.reasoning-visual-overlay [data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)))];
      const bonds=[...new Set([...stage.querySelectorAll('.reasoning-visual-overlay [data-reasoning-bond]')].map(n=>n.dataset.reasoningBond))].map(s=>s.split(':').map(Number));
      if(atoms.length){observer.disconnect();clearTimeout(timer);finish({atoms,bonds});}};
     observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,childList:true,attributes:true});timer=setTimeout(()=>{observer.disconnect();finish({atoms:[],bonds:[]})},30000);
    },i);await button.click({timeout:15000});const target=await page.evaluate(()=>window.__partialTarget);
    assert.ok(target.atoms.length>0,`${row.family} ${language} ${label}: empty selection`);
    for(const id of target.atoms)assert.ok(graph.atoms.some(a=>a.id===id));
    for(const [a,b] of target.bonds)assert.ok(graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x));
    if(row.family==='heterocycle'&&/Paso 3:|Step 3:/i.test(label)){
     const hetero=graph.atoms.filter(atom=>(atom.element??'C')!=='C');assert.equal(hetero.length,1);
     assert.deepEqual(target.atoms,[hetero[0].id]);assert.deepEqual(target.bonds,[]);
    }
    if(/Localizadores de enlaces múltiples|Multiple-bond locants/i.test(label)){
     assert.equal(target.bonds.length,0,label);assert.ok(target.atoms.every(id=>graph.bonds.some(([a,b,o])=>(a===id||b===id)&&o>1)),label);
    }
    if(/Localizador del enlace|(?:Double|Triple) bond locant/i.test(label)){
     assert.equal(target.atoms.length,1,label);assert.equal(target.bonds.length,0,label);
     assert.ok(graph.bonds.some(([a,b,o])=>(a===target.atoms[0]||b===target.atoms[0])&&o===2+(Number(/triple/i.test(label)))),label);
    }
    if(/double bond|enlace doble/i.test(label)&&target.bonds.length)assert.ok(target.bonds.some(([a,b])=>graph.bonds.some(([x,y,o])=>o===2&&(a===x&&b===y||a===y&&b===x))),label);
    if(/triple bond|enlace triple/i.test(label)&&target.bonds.length)assert.ok(target.bonds.some(([a,b])=>graph.bonds.some(([x,y,o])=>o===3&&(a===x&&b===y||a===y&&b===x))),label);
    checks.push({label,...target});
   }
   if(row.family==='heterocycle')assert.ok(checks.some(check=>/Paso 3:|Step 3:/i.test(check.label)),'heteroatom numbering reference is available');
   result.languages.push({language,name:row.languages[language].name,controls:count,checks});
  }
  assert.deepEqual(errors,[]);result.status='PASS';
 }catch(error){result.status='FAIL';result.error=String(error);throw error}finally{await page.close()}
},{timeout:180000});
