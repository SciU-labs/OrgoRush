import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { moleculeFromSmiles } from '../../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../../app/validated-name-derivation.ts';
import { buildValidatedPriorityReasoning } from '../../app/reasoning-derivation-adapter.ts';
import { reasoningFragmentId } from '../../app/reasoning-visual-targets.ts';
import { buildValidatedVisualNumbering } from '../../app/visual-numbering.ts';

const {records}=JSON.parse(await readFile(new URL('../fixtures/b50-pubchem-rings.json',import.meta.url),'utf8'));
const independent=JSON.parse(await readFile(new URL('../fixtures/b61-independent-reference.json',import.meta.url),'utf8')).records;
records.push(...independent, ...JSON.parse(await readFile(new URL('../fixtures/b74-independent-reference.json',import.meta.url),'utf8')).records);
const cases=[[527038,"N-bencil-N-metilbenzamida","N-benzyl-N-methylbenzamide"],[306478,"N-bencil-4-cloro-N-metilbenzamida","N-benzyl-4-chloro-N-methylbenzamide"],[3273567,"N-bencil-N-etilbenzamida","N-benzyl-N-ethylbenzamide"]];
const outputDirectory=process.env.B74_E2E_OUT_DIR??'reports/b74/e2e';
const reports=[];
let server,browser,origin;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
  await mkdir(outputDirectory,{recursive:true});
});
after(async()=>{
  await writeFile(`${outputDirectory}/results.json`,JSON.stringify({browser:browser?.version(),cases:reports},null,2)+'\n');
  await browser?.close();await server?.close();
});
const sorted=values=>[...new Set(values)].sort((a,b)=>a-b);
const key=([a,b])=>[Number(a),Number(b)].sort((a,b)=>a-b).join(':');

async function select(page,button,target,keyboard) {
  const visible=await page.locator('.molecule-stage [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.atomId,n.querySelector('.number-label')?.textContent])));
  const expected={atoms:sorted(target.atomIds),
    bonds:target.bondIds.map(key).sort(),locants:target.locants.filter(([id,n])=>visible[id]!==String(n)).map(([id,n])=>[id,String(n)]).sort(([a],[b])=>a-b)};
  const selector=await button.evaluate(node=>`#${node.closest('[id^="iupac-reasoning-step-"]').id} button[data-name-fragment=${JSON.stringify(node.dataset.nameFragment)}]`);
  // Observe before the real input. The production highlight expires after two
  // seconds; a slow protocol round trip must not miss its entire visible life.
  // No timers are paused and no selection/name/proof response is fabricated.
  await page.evaluate(({expected,selector})=>{
    const started=performance.now();let finish,observer,timer;
    window.__b61Selection={promise:new Promise(resolve=>{finish=resolve})};
    const complete=value=>{clearTimeout(timer);observer?.disconnect();finish(value)};
    const snapshot=()=>{
    const overlay=document.querySelector('.reasoning-visual-overlay');if(!overlay)return false;
    const actual={atoms:[...overlay.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
      bonds:[...overlay.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond.split(':').map(Number).sort((a,b)=>a-b).join(':')).sort(),
      locants:[...overlay.querySelectorAll('[data-reasoning-locant]')].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector('text').textContent]).sort(([a],[b])=>a-b)};
      if(document.querySelector(selector)?.getAttribute('aria-pressed')==='true'&&JSON.stringify(actual)===JSON.stringify(expected))
        complete({ok:true,observedAfterMs:performance.now()-started,actual});
    };
    observer=new MutationObserver(snapshot);observer.observe(document.body,{subtree:true,attributes:true,childList:true});
    timer=setTimeout(()=>complete({ok:false,selector,pressed:document.querySelector(selector)?.getAttribute('aria-pressed')}),10000);
  },{expected,selector});
  if(keyboard){await button.focus();await button.press('Space')}else await button.click();
  const observed=await page.evaluate(()=>window.__b61Selection.promise);
  assert.equal(observed.ok,true,JSON.stringify(observed));return observed;
}

for(const [cid,es,en] of cases)test(`B7.4 Chromium integrated ES/EN controls CID ${cid}`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[],failed=[],unexpected=[],requests=[];
  const report={cid,names:{es,en},status:'RUNNING',languages:[],controls:0,errors,failed,unexpected,optionalRequests:requests};
  reports.push(report);
  try {
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
    await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.startsWith('/api/'))return route.continue();
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      // Optional reverse-lookup metadata is empty. Import, naming, FULL and
      // reasoning all run locally, without external name/structure fixtures.
      if(url.hostname==='pubchem.ncbi.nlm.nih.gov') {
        requests.push(url.pathname);return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
      }
      if(['es.wikipedia.org','en.wikipedia.org'].includes(url.hostname) && url.pathname==='/w/api.php') {
        requests.push(`${url.hostname}${url.pathname}`);return route.fulfill({status:200,contentType:'application/json',
          headers:{'access-control-allow-origin':'*'},body:'{"query":{"pages":{}}}'});
      }
      unexpected.push(url.href);return route.abort();
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const record=records.find(r=>r.cid===cid);
    await page.locator('#smiles-text-input').fill(record.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.getByText(es,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    const help=page.locator('.reasoning-visibility-button');
    if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    const panel=page.locator('#iupac-reasoning-content');await panel.waitFor({state:'visible'});
    const geometry=()=>page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(n=>[n.dataset.atomId,n.getAttribute('transform')]));
    const bonds=()=>page.locator('.molecule-stage').evaluate(node=>[...node.querySelectorAll('line,path')].filter(n=>!n.closest('.reasoning-visual-overlay')).map(n=>[n.tagName,n.getAttribute('d'),n.getAttribute('x1'),n.getAttribute('y1'),n.getAttribute('x2'),n.getAttribute('y2')]));
    const originalGeometry=await geometry(), originalBonds=await bonds();
    const graph=moleculeFromSmiles(record.smiles).molecule;
    for(const [iteration,language] of ['es','en','es','en'].entries()) {
      const name=language==='es'?es:en;
      if(iteration) {
        await page.getByRole('button',{name:language==='es'?'Español':'English',exact:true}).click();
        await page.getByText(name,{exact:true}).first().waitFor({state:'visible'});
        await page.waitForFunction(()=>!document.querySelector('.reasoning-visual-overlay'));
        assert.equal(await panel.locator('button[aria-pressed="true"]').count(),0,'language invalidates stale selections');
      }
      assert.equal(await panel.getAttribute('data-derivation-support'),'FULL');
      assert.equal(await panel.locator('.reasoning-validated-name').innerText(),name);
      const proof=reconcileSystematicName(graph,name), model=buildValidatedPriorityReasoning({derivation:proof,graph,language});
      const kinds=new Set();let count=0;
      for(const step of model.steps) {
        if(iteration>1 && !step.componentIds.includes('parent'))continue;
        for(const fragment of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]) {
          const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];if(!target)continue;
          const button=panel.locator(`#iupac-reasoning-step-${step.number} button[data-name-fragment=${JSON.stringify(fragment.semanticId)}]`);
          assert.equal(await button.count(),1,`${step.title}: ${fragment.semanticId}`);
          const label=await button.getAttribute('aria-label');
          assert.ok(label.includes(language==='en'?'Highlight in the molecule':'Resaltar en la molécula'));
          const observation=await select(page,button,target,count%2===0);
          (report.observations??=[]).push({language,semanticId:fragment.semanticId,observedAfterMs:observation.observedAfterMs});
          kinds.add(fragment.kind);count++;
        }
      }
      if(iteration<2)for(const kind of ['parent','substituent','numbering',...(proof.principalGroup==='none'?[]:['function'])])
        assert.ok(kinds.has(kind),`interactive ${kind} in ${language}`);
      const visibleNumbering=buildValidatedVisualNumbering(graph,proof);
      for(const [id,n] of visibleNumbering) {
        const label=page.locator(`.molecule-stage [data-atom-id="${id}"] .number-label`);
        assert.equal(await label.textContent(),String(n),'canvas uses the same active parent locant map');
      }
      for(const [id] of proof.components.find(c=>c.id==='parent').numbering) if(!visibleNumbering.has(id))
        assert.equal(await page.locator(`.molecule-stage [data-atom-id="${id}"] .number-label`).count(),0,
          'ambiguous ring orientation does not gain a visual locant');
      assert.deepEqual(await geometry(),originalGeometry);assert.deepEqual(await bonds(),originalBonds);
      report.languages.push({language,name,support:'FULL',controls:count});report.controls+=count;
    }
    if(cid===7439)assert.equal(graph.bonds.filter(([, ,o])=>o===2).length,3);
    if([24834,557975].includes(cid))await page.screenshot({path:`${outputDirectory}/${cid}.png`,fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(unexpected,[]);
    report.geometryPreserved=true;report.status='PASS';
  }catch(error){report.status='FAIL';report.error=String(error);await writeFile(`${outputDirectory}/${cid}-failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${outputDirectory}/${cid}-failure.png`,fullPage:true});throw error}
  finally{await page.close()}
},{timeout:180000});

test('B7.4 N-ethyl-N-phenyl boundary remains outside FULL in the actual UI',async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  const report={cid:85430,status:'RUNNING',errors};reports.push(report);
  try {
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
    await page.route('**/*',async route=>{const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.startsWith('/api/'))return route.continue();
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(records.find(r=>r.cid===85430).smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.getByText(/Nombre IUPAC local no disponible para esta estructura/).first().waitFor({timeout:30000});
    assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0);
    const geometry=await page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(n=>[n.dataset.atomId,n.getAttribute('transform')]));
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.getByText(/Local IUPAC name unavailable for this structure/).first().waitFor({timeout:30000});
    assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0);
    assert.deepEqual(await page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(n=>[n.dataset.atomId,n.getAttribute('transform')])),geometry);
    assert.deepEqual(errors,[]);report.status='PASS';report.support='UNSUPPORTED';
  }catch(error){report.status='FAIL';report.error=String(error);throw error}finally{await page.close()}
},{timeout:180000});
