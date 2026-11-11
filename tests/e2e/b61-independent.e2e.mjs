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

const {records}=JSON.parse(await readFile(new URL('../fixtures/b50-pubchem-rings.json',import.meta.url),'utf8'));
const independent=JSON.parse(await readFile(new URL('../fixtures/b61-independent-reference.json',import.meta.url),'utf8')).records;
records.push(...independent);
const cases=[
  [24834,'4-etoxibenzaldehído','4-ethoxybenzaldehyde'],
  [557975,'3-etil-3,5,5-trimetilciclohexanona','3-ethyl-3,5,5-trimethylcyclohexanone'],
  [326,'4-(1-metiletil)benzaldehído','4-(1-methylethyl)benzaldehyde'],
  [7455,'4-metilbenzoato de metilo','methyl 4-methylbenzoate'],
  [7813,'4-metilanilina','4-methylaniline'],[69274,'4-metilbenzamida','4-methylbenzamide'],
  [7724,'4-metilbenzonitrilo','4-methylbenzonitrile'],
  [1254,'5-metil-2-(1-metiletil)ciclohexanol','5-methyl-2-(1-methylethyl)cyclohexanol'],
  [11419,'2-metilciclohexanona','2-methylcyclohexanone'],
  [7439,'2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona','2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one'],
  [7731,'1-metil-4-metoxibenceno','1-methoxy-4-methylbenzene'],
  [7473,'1-metil-4-nitrobenceno','1-methyl-4-nitrobenzene'],
  [9603,'1-fluoro-4-metilbenceno','1-fluoro-4-methylbenzene'],
  [7931,'1-cloro-3-metilbenceno','1-chloro-3-methylbenzene'],
  [7236,'1-bromo-2-metilbenceno','1-bromo-2-methylbenzene'],
  [12207,'1-metil-4-yodobenceno','1-iodo-4-methylbenzene'],
];
const outputDirectory=process.env.B61_E2E_OUT_DIR??'reports/b61/e2e';
const reports=[];
let server,browser,origin;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true});
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

for(const [cid,es,en] of cases)test(`B6.1 Chromium integrated ES/EN controls CID ${cid}`,async()=>{
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
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded'});
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
      for(const [id,n] of proof.components.find(c=>c.id==='parent').numbering) {
        const label=page.locator(`.molecule-stage [data-atom-id="${id}"] .number-label`);
        assert.equal(await label.textContent(),String(n),'canvas uses the same active parent locant map');
      }
      assert.deepEqual(await geometry(),originalGeometry);assert.deepEqual(await bonds(),originalBonds);
      report.languages.push({language,name,support:'FULL',controls:count});report.controls+=count;
    }
    if(cid===7439)assert.equal(graph.bonds.filter(([, ,o])=>o===2).length,3);
    if([24834,557975].includes(cid))await page.screenshot({path:`${outputDirectory}/${cid}.png`,fullPage:true});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(unexpected,[]);
    report.geometryPreserved=true;report.status='PASS';
  }catch(error){report.status='FAIL';report.error=String(error);await writeFile(`${outputDirectory}/${cid}-failure.json`,JSON.stringify(report,null,2));await page.screenshot({path:`${outputDirectory}/${cid}-failure.png`,fullPage:true});throw error}
  finally{await page.close()}
},{timeout:90000});

// The names below are frozen post-fix observations for UI regression only.
// Independent chemical evidence is recorded separately in reports/b61.
for(const [cid,es,en] of [
  [10758,'2-fenil-2-hidroxietanonitrilo','2-hydroxy-2-phenylethanenitrile'],
  [31266,'hexanoato de prop-2-en-1-ilo','prop-2-en-1-yl hexanoate'],
  [11142,'3-(1-metiletil)-6-metilidenociclohex-1-eno','3-(1-methylethyl)-6-methylidenecyclohex-1-ene'],
])test(`B6.1 Chromium corrected PARTIAL name CID ${cid}`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],unexpected=[];
  const report={cid,names:{es,en},status:'RUNNING',languages:[],controls:0,errors,unexpected};reports.push(report);
  try {
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.startsWith('/api/'))return route.continue();
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      if(url.hostname==='pubchem.ncbi.nlm.nih.gov'||['es.wikipedia.org','en.wikipedia.org'].includes(url.hostname))
        return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
      unexpected.push(url.href);return route.abort();
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(independent.find(r=>r.cid===cid).smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.getByText(es,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    const panel=page.locator('#iupac-reasoning-content');await panel.waitFor({state:'visible'});
    const geometry=()=>page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(n=>[n.dataset.atomId,n.getAttribute('transform')]));
    const original=await geometry();
    for(const language of ['es','en','es']) {
      await page.getByRole('button',{name:language==='es'?'Español':'English',exact:true}).click();
      const name=language==='es'?es:en;await page.getByText(name,{exact:true}).first().waitFor({state:'visible'});
      const uiDerivationSupport=await panel.getAttribute('data-derivation-support');
      assert.notEqual(uiDerivationSupport,'FULL','partial observations never acquire a complete proof');
      assert.equal(await panel.locator('.reasoning-validated-name').count(),0,'PARTIAL has no complete verified name');
      assert.equal(await page.locator('.reasoning-visual-overlay').count(),0,'language clears stale selections');
      assert.deepEqual(await geometry(),original);
      report.languages.push({language,name,auditSupport:'PARTIAL-SAFE',uiDerivationSupport});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);report.geometryPreserved=true;report.status='PASS';
    await page.screenshot({path:`${outputDirectory}/${cid}-partial.png`,fullPage:true});
  }catch(error){report.status='FAIL';report.error=String(error);await writeFile(`${outputDirectory}/${cid}-failure.json`,JSON.stringify(report,null,2));throw error}finally{await page.close()}
},{timeout:90000});


