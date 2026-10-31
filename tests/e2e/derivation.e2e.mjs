import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { generalizationCases, generalizationEdges } from '../fixtures/generalized-derivation.mjs';
import { purineCases } from '../fixtures/purine-derivation.mjs';
import { moleculeFromSmiles } from '../../app/openchemlib-adapter.ts';
import { mapStructuralRegions } from '../../app/structural-derivation.ts';

// Use an installed Playwright package, or the explicit location of an existing
// installation. No browser download or production configuration change.
const { chromium } = await import(process.env.ORGORUSH_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.ORGORUSH_PLAYWRIGHT_MODULE)).href : 'playwright');
const live = process.env.ORGORUSH_E2E_LIVE === '1';
const generalized = process.env.ORGORUSH_E2E_GENERALIZED === '1';
const phase6 = process.env.ORGORUSH_E2E_PHASE6 === '1';
const phase7 = process.env.ORGORUSH_E2E_PHASE7 === '1';
const output = resolve('outputs/derivation-e2e', phase7?'purine':phase6?'symmetry-fused':generalized ? 'generalized' : 'original', live ? 'live' : 'deterministic');
const fusedRecords=JSON.parse(await readFile(new URL('../../reports/fused-reference-records.json',import.meta.url),'utf8'));
const caffeine=fusedRecords.find(f=>f.name==='caffeine');
const phase6Fixtures=[generalizationCases.find(f=>f.common==='3-methylbutanoic acid'),
  {common:'caffeine',name:caffeine.IUPACName,smiles:caffeine.SMILES,cid:caffeine.CID,formula:caffeine.MolecularFormula}];
const originalFixtures = [
  { common:'ibuprofen', name:'2-[4-(2-methylpropyl)phenyl]propanoic acid', smiles:'CC(C)Cc1ccc(cc1)C(C)C(=O)O', cid:3672, formula:'C13H18O2', parent:[11,12,13], prefix:[1,2,3,4], component:'aryl-prefix', bonds:['1:2','2:3','2:4','4:5'] },
  { common:'paracetamol', name:'N-(4-hydroxyphenyl)acetamide', smiles:'CC(=O)Nc1ccc(O)cc1', cid:1983, formula:'C8H9NO2', parent:[1,2,4], prefix:[9], component:'aryl-prefix', bonds:['8:9'] },
  { common:'aspirin', name:'2-acetyloxybenzoic acid', smiles:'CC(=O)Oc1ccccc1C(=O)O', cid:2244, formula:'C9H8O4', parent:[5,6,7,8,9,10,11], prefix:[1,2,3,4], component:'acyloxy', bonds:['1:2','2:3','2:4','4:5'] },
];
const selectedNames=process.env.ORGORUSH_E2E_NAMES?.split('|');
const fixtures = (phase7?purineCases:phase6?phase6Fixtures:generalized ? generalizationCases.filter(f=>f.expected!=='PARTIAL').map(f=>({...f,bonds:generalizationEdges[f.common]})) : originalFixtures)
  .filter(f=>!selectedNames||selectedNames.includes(f.common));
let server, browser, base;
const key = (a,b) => [Number(a),Number(b)].sort((x,y)=>x-y).join(':');
function sameFixtureGraph(left,right){
  const a=moleculeFromSmiles(left),b=moleculeFromSmiles(right);
  return a.ok&&b.ok&&!!mapStructuralRegions(a.molecule,b.molecule,[]);
}
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0,strictPort:false}});
  await server.listen();
  base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/`;
  const response=await fetch(base,{signal:AbortSignal.timeout(10000)});
  assert.equal(response.status,200,'HTTP readiness must succeed before browser testing');
  browser=await chromium.launch({headless:true,timeout:15000,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? {executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE} : {})});
  await mkdir(output,{recursive:true});
}, {timeout:45000});
after(async()=>{ await browser?.close(); await server?.close(); });

async function pageForRun() {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.addInitScript(()=>localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped'));
  page.setDefaultTimeout(15000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const consoleErrors=[]; page.on('console',m=>{ if(m.type()==='error')consoleErrors.push(m.text()); });
  const received=[];
  const network=[];
  if(live)page.on('response',async response=>{
    if(/\/property\/|opsin|\/api\/name-to-structure/.test(response.url()))try {
      const body=await response.json();
      received.push(...(body.PropertyTable?.Properties??[]).map(p=>p.IUPACName).filter(Boolean));
      network.push({url:response.url(),status:response.status(),body});
    }catch { /* Failed transport is diagnosed by the build assertions. */ }
  });
  if (!live) await page.route('**/*',async route=>{
    const req=route.request(), url=req.url();
    if(url.startsWith(new URL(base).origin) && !url.includes('/api/')) return route.continue();
    const headers={'access-control-allow-origin':'*','content-type':'application/json'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const input=decodeURIComponent(url).toLowerCase();
    const nameQuery=/\/name\/([^/]+)\/cids\/json/.exec(input)?.[1];
    const structureQuery=/\/smiles\/([^/]+)\/cids\/json/.exec(input)?.[1];
    const rawStructureQuery=/\/smiles\/([^/]+)\/cids\/json/i.exec(decodeURIComponent(url))?.[1];
    const body=req.postDataJSON?.();
    const f=fixtures.find(f=>nameQuery===f.common||nameQuery===f.name.toLowerCase()||input.includes(`/cid/${f.cid}/`)
      ||phase6&&f.common==='3-methylbutanoic acid'&&['cc(c)cc(o)=o','cc(c)cc(=o)o'].includes(structureQuery)
      ||phase7&&rawStructureQuery&&sameFixtureGraph(rawStructureQuery,f.smiles)
      ||f.common==='aspirin'&&nameQuery==='2-(acetyloxy)benzoic acid'
      ||body?.name===f.common||body?.name===f.name||body?.name==='2-(acetyloxy)benzoic acid'&&f.common==='aspirin');
    if(url.includes('opsin')) return route.fulfill({status:200,headers,body:JSON.stringify({status:'FAILURE',message:'No OPSIN fixture; exercise PubChem fallback'})});
    if(f && url.includes('/cids/JSON'))return route.fulfill({status:200,headers,body:JSON.stringify({IdentifierList:{CID:[f.cid]}})});
    if(f && url.includes('/property/')) {
      received.push(f.name);
      return route.fulfill({status:200,headers,body:JSON.stringify({PropertyTable:{Properties:[{CID:f.cid,IUPACName:f.name,IsomericSMILES:f.smiles,MolecularFormula:f.formula}]}})});
    }
    if(f && url.includes('/api/name-to-structure'))return route.fulfill({status:200,headers,body:JSON.stringify({source:'PubChem',originalName:body.name,interpretedName:f.name,iupacName:f.name,smiles:f.smiles,cid:f.cid,molecularFormula:f.formula,warnings:[]})});
    return route.fulfill({status:200,headers,body:'{}'});
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  const skip=page.locator('.guided-tour-skip');
  try { await skip.waitFor({state:'visible',timeout:3000}); await skip.click(); } catch { /* A returning browser may have dismissed the tour. */ }
  return {page,errors,received,consoleErrors,network};
}
async function build(page, name, support='FULL') {
  await page.locator('[aria-controls="iupac-name-builder"]').click();
  await page.locator('#iupac-name-input').fill(name);
  await page.locator('#iupac-name-builder button[type="submit"]').click();
  await page.locator('#iupac-name-input').waitFor({state:'hidden',timeout:30000});
  const heading=page.locator('.reasoning-visibility-button');
  if(await heading.getAttribute('aria-expanded')!=='true')await heading.click();
  await page.locator(`[data-derivation-support="${support}"]`).waitFor({state:'visible',timeout:live?45000:15000});
}

// Start observing before the native click. Snapshot the transient selection in
// one browser operation so its 2s expiry cannot split presence and data reads.
async function captureRegion(page, trigger) {
  const expectedStep=await trigger.getAttribute('data-name-fragment');
  const [snapshot]=await Promise.all([
    page.waitForFunction(expectedStep=>{
      const node=document.querySelector('.reasoning-visual-overlay');
      if(!node || expectedStep&&node.dataset.reasoningStep!==expectedStep)return null;
      return {
        atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
        bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond),
        locants:[...node.querySelectorAll('[data-reasoning-locant]')].map(n=>n.dataset.reasoningLocant),
        numbering:[...node.querySelectorAll('[data-reasoning-locant]')].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector('text').textContent]),
      };
    },expectedStep),
    trigger.click(),
  ]);
  const value=await snapshot.jsonValue();await snapshot.dispose();return value;
}

if(!phase6&&!phase7)test(`${live?'LIVE':'HTTP FIXTURES'} common names → FULL → exact editor regions → molecule replacement`,async()=>{
  const {page,errors,received,consoleErrors}=await pageForRun();
  try {
    for (const f of fixtures) {
      await build(page,f.common);
      const panel=page.locator('[data-derivation-support="FULL"]');
      assert.ok((await panel.innerText()).includes(f.name));
      assert.equal(await page.locator('.reasoning-visual-overlay').count(),0,'old selection must clear on molecule replacement');
      if(!live) {
        const parent=await page.locator('.molecule-stage .carbon-node.on-main-chain').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.atomId)).sort((a,b)=>a-b));
        assert.deepEqual(parent,f.parent);
      }
      const selection=await captureRegion(page,panel.locator(`[data-name-fragment="${f.component}"]`));
      if(!live) {
        assert.deepEqual(selection.atoms,f.prefix);
        assert.deepEqual(selection.bonds.map(s=>key(...s.split(':'))).sort(),f.bonds.toSorted());
      }
      await panel.locator(`[data-name-fragment="${f.component}"]`).click();
      await page.screenshot({path:resolve(output,`${f.common}.png`),fullPage:true,animations:'disabled'});
      await writeFile(resolve(output,`${f.common}.json`),JSON.stringify({mode:live?'live':'deterministic',namePanel:await panel.innerText(),received,errors,consoleErrors},null,2));
      assert.deepEqual(errors,[],'no uncaught application errors');
    }
    if(!live)assert.ok(received.includes(fixtures.at(-1).name),'provider names must reach the application');
  } catch(error) {
    await page.screenshot({path:resolve(output,'common-failure.png'),fullPage:true});
    await writeFile(resolve(output,'common-failure.txt'),await page.locator('body').innerText());
    await writeFile(resolve(output,'common-failure.json'),JSON.stringify({received,errors,consoleErrors},null,2));
    throw error;
  } finally { await page.close(); }
},{timeout:240000});

if(!live&&!phase6&&!phase7)test('HTTP FIXTURES loading and failure preserve the currently visible molecule',async()=>{
  const {page,errors}=await pageForRun();
  try {
    await build(page,fixtures[0].common);
    const before=await page.locator('.molecule-stage [data-atom-id]').count();
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/opsin/**',async route=>{
      await gate;
      await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({status:'FAILURE'})});
    });
    await page.locator('[aria-controls="iupac-name-builder"]').click();
    await page.locator('#iupac-name-input').fill('unrecognized e2e molecule');
    await page.locator('#iupac-name-builder button[type="submit"]').click();
    assert.equal(await page.locator('#iupac-name-input').isDisabled(),true);
    assert.equal(await page.locator('#iupac-name-builder button[type="submit"]').getAttribute('aria-busy'),'true');
    release();
    await page.locator('.name-builder-feedback.error').waitFor();
    assert.equal(await page.locator('#iupac-name-input').isEnabled(),true);
    assert.equal(await page.locator('.molecule-stage [data-atom-id]').count(),before);
    assert.ok((await page.locator('[data-derivation-support="FULL"]').innerText()).includes(fixtures[0].name));
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
},{timeout:60000});

if(!phase6&&!phase7)test(`${live?'LIVE':'HTTP FIXTURES'} systematic names and parenthesized variant`,async()=>{
  const {page,errors}=await pageForRun();
  try {
    for(const name of [...fixtures.map(f=>f.name),...(generalized?[]:['2-(acetyloxy)benzoic acid'])]) {
      await build(page,name);
      assert.ok((await page.locator('[data-derivation-support="FULL"]').innerText()).includes(name)
        || name==='2-(acetyloxy)benzoic acid');
    }
    assert.deepEqual(errors,[]);
  } catch(error) {
    await page.screenshot({path:resolve(output,'systematic-failure.png'),fullPage:true});
    await writeFile(resolve(output,'systematic-failure.txt'),await page.locator('body').innerText());
    throw error;
  } finally {await page.close();}
},{timeout:240000});

if(phase6)test(`${live?'LIVE':'HTTP FIXTURES'} symmetry choices and safe fused-heterocycle partial import`,async()=>{
  const {page,errors,received,consoleErrors,network}=await pageForRun();
  const parents=()=>page.locator('.molecule-stage .carbon-node.on-main-chain').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.atomId)).sort((a,b)=>a-b));
  try{
    await build(page,'3-methylbutanoic acid');
    await page.locator('[data-derivation-symmetry="equivalent"]').waitFor();
    const first=await parents();assert.equal(first.length,4);
    const toggle=page.locator('[data-symmetry-choice]');assert.ok((await toggle.innerText()).includes('1/2'));
    const parentSelection=await captureRegion(page,page.locator('[data-name-fragment="parent"]'));
    assert.deepEqual(parentSelection.atoms,first);
    await toggle.click();const second=await parents();assert.equal(second.length,4);assert.notDeepEqual(second,first);
    assert.equal(await page.locator('.reasoning-visual-overlay').count(),0,'changing the assignment invalidates the previous highlight');
    if(!live)assert.deepEqual([first,second].sort(),[[1,2,4,5],[2,3,4,5]]);
    await page.locator('[data-name-fragment="prefix-0"]').click();
    await page.screenshot({path:resolve(output,'equivalent-parent.png'),fullPage:true,animations:'disabled'});
    // Rebuild the same chemical identity in a different atom order via the real
    // SMILES editor; source/provider identity must not preserve stale atom IDs.
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill('O=C(O)CC(C)C');
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[data-derivation-symmetry="equivalent"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-symmetry-choice]')?.getAttribute('data-symmetry-choice')==='0');
    if(!live)assert.ok(['2,4,5,6','2,4,5,7'].includes((await parents()).join(',')));
    await build(page,'caffeine','FULL');
    assert.equal(await page.locator('[data-derivation-support="PARTIAL"]').count(),0);
    const stage=page.locator('.molecule-stage');
    assert.equal(await stage.getAttribute('data-import-ring-count'),'2');
    assert.equal(await stage.getAttribute('data-graph-cycle-rank'),'2');
    const g=await stage.evaluate(node=>({
      atoms:[...node.querySelectorAll('[data-atom-id]')].map(n=>({id:Number(n.dataset.atomId),element:n.dataset.atomElement})),
      bonds:[...node.querySelectorAll('[data-bond-a]')].map(n=>[Number(n.dataset.bondA),Number(n.dataset.bondB),Number(n.dataset.bondOrder)]),
    }));
    assert.equal(g.atoms.length,14);assert.equal(new Set(g.atoms.map(a=>a.id)).size,14);assert.equal(g.bonds.length,15);
    assert.equal(g.atoms.filter(a=>a.element==='N').length,4);
    const element=id=>g.atoms.find(a=>a.id===id).element;
    assert.equal(g.bonds.filter(([a,b,o])=>o===2&&(element(a)==='O'||element(b)==='O')).length,2);
    assert.equal(g.atoms.filter(a=>a.element==='C'&&g.bonds.filter(([x,y])=>x===a.id||y===a.id).length===1
      &&g.bonds.some(([x,y,o])=>o===1&&(x===a.id&&element(y)==='N'||y===a.id&&element(x)==='N'))).length,3);
    const ringSelection=await captureRegion(page,page.locator('[data-name-fragment="parent"]'));
    const selected={atoms:ringSelection.atoms.length,bonds:ringSelection.bonds.length,locants:ringSelection.locants.length};
    assert.deepEqual(selected,{atoms:9,bonds:10,locants:9},'phase 7 now proves the complete fused parent and retained locants');
    await page.locator('[data-name-fragment="parent"]').click();
    await page.screenshot({path:resolve(output,'caffeine-full.png'),fullPage:true,animations:'disabled'});
    await writeFile(resolve(output,'phase6.json'),JSON.stringify({mode:live?'live':'deterministic',first,second,selected,graph:g,received,network,errors,consoleErrors},null,2));
    assert.deepEqual(errors,[]);
  }catch(error){await page.screenshot({path:resolve(output,'phase6-failure.png'),fullPage:true});await writeFile(resolve(output,'phase6-failure.txt'),await page.locator('body').innerText());throw error;}
  finally{await page.close();}
},{timeout:180000});

if(phase7)test(`${live?'LIVE':'HTTP FIXTURES'} five purine names → FULL → retained locants, H and exact semantic regions`,async()=>{
  const {page,errors,received,consoleErrors,network}=await pageForRun();
  const evidence=[];
  try{
    for(const f of fixtures){
      await build(page,f.common);
      const panel=page.locator('[data-derivation-support="FULL"]');
      await page.waitForFunction(name=>document.querySelector('[data-derivation-support="FULL"]')?.textContent.includes(name),f.name,{timeout:live?45000:15000});
      assert.ok((await panel.innerText()).includes(f.name),'preserve the systematic name actually supplied');
      assert.equal(await page.locator('.reasoning-visual-overlay').count(),0,'molecule changes clear previous locants and regions');
      const g=await page.locator('.molecule-stage').evaluate(node=>({
        atoms:[...node.querySelectorAll('[data-atom-id]')].map(n=>({id:Number(n.dataset.atomId),element:n.dataset.atomElement,x:0,y:0})),
        bonds:[...node.querySelectorAll('[data-bond-a]')].map(n=>[Number(n.dataset.bondA),Number(n.dataset.bondB),Number(n.dataset.bondOrder)]),
      }));
      const reference=moleculeFromSmiles(f.smiles);assert.equal(reference.ok,true);
      const map=mapStructuralRegions(reference.molecule,g,f.parent.map(id=>[id]));assert.ok(map,'the actual imported graph matches the independent reference');
      const parent=f.parent.map(id=>map.get(id)),sorted=xs=>[...xs].sort((a,b)=>a-b);
      const actualParent=await page.locator('.molecule-stage .on-main-chain[data-atom-id]').evaluateAll(ns=>ns.map(n=>Number(n.dataset.atomId)).sort((a,b)=>a-b));
      assert.deepEqual(actualParent,sorted(parent));
      assert.equal(await page.locator('.molecule-stage .number-circle').count(),0,'retained locants are contextual, not permanent atom badges');
      const wanted=[{id:'parent',atoms:parent,numbering:parent.map((id,i)=>[id,String(i+1)]),
        bonds:reference.molecule.bonds.filter(([a,b])=>f.parent.includes(a)&&f.parent.includes(b)).map(([a,b])=>key(map.get(a),map.get(b)))},
        {id:'purine-nitrogens',atoms:[1,3,7,9].map(p=>parent[p-1]),numbering:[1,3,7,9].map(p=>[parent[p-1],String(p)]),bonds:[]},
        {id:'purine-fusion',atoms:[parent[3],parent[4]],numbering:[[parent[3],'4'],[parent[4],'5']],bonds:[key(parent[3],parent[4])]}];
      if(f.methyl.length)wanted.push({id:'purine-methyl',atoms:f.methyl.map(([,id])=>map.get(id)),numbering:f.methyl.map(([p])=>[parent[p-1],String(p)]),bonds:f.methyl.map(([p,id])=>key(parent[p-1],map.get(id)))});
      for(const [kind,ps] of [['hydro',f.hydro],['indicated',f.indicated]])if(ps)wanted.push({id:`purine-${kind}`,atoms:ps.map(p=>parent[p-1]),numbering:ps.map(p=>[parent[p-1],String(p)]),bonds:[]});
      if(f.oxo.length)wanted.push({id:'purine-oxo',atoms:f.oxo.flatMap(([p,id])=>[parent[p-1],map.get(id)]),numbering:f.oxo.map(([p])=>[parent[p-1],String(p)]),bonds:f.oxo.map(([p,id])=>key(parent[p-1],map.get(id)))});
      const selections=[];
      for(const w of wanted){
        const selected=await captureRegion(page,panel.locator(`[data-name-fragment="${w.id}"]`));
        assert.deepEqual(selected.atoms,sorted(w.atoms),`${f.common}/${w.id} atoms`);
        assert.deepEqual(selected.bonds.map(s=>key(...s.split(':'))).sort(),w.bonds.toSorted(),`${f.common}/${w.id} edges`);
        assert.deepEqual(selected.numbering.sort(([a],[b])=>a-b),w.numbering.toSorted(([a],[b])=>a-b),`${f.common}/${w.id} locants`);
        selections.push({component:w.id,...selected});
      }
      if(f.common==='caffeine'){
        const parentView=await captureRegion(page,panel.locator('[data-name-fragment="parent"]'));
        assert.deepEqual(parentView.atoms,sorted(parent));assert.equal(parentView.numbering.length,9);
        await page.screenshot({path:resolve(output,'caffeine-parent.png'),fullPage:true,animations:'disabled'});
        assert.equal(await page.locator('.view-mode-switch button').nth(1).isDisabled(),true,'the existing cyclic condensed-view boundary remains intact');
        await page.locator('.view-mode-switch button').nth(2).click();
        const skeletal=await captureRegion(page,panel.locator('[data-name-fragment="purine-nitrogens"]'));
        assert.deepEqual(skeletal.atoms,sorted([1,3,7,9].map(p=>parent[p-1])));
        assert.deepEqual(skeletal.numbering.sort(([a],[b])=>a-b),[1,3,7,9].map(p=>[parent[p-1],String(p)]).sort(([a],[b])=>a-b));
        await page.screenshot({path:resolve(output,'caffeine-skeletal.png'),fullPage:true,animations:'disabled'});
        selections.push({component:'purine-nitrogens-skeletal',...skeletal});
        await page.locator('.view-mode-switch button').first().click();
      }
      await page.screenshot({path:resolve(output,`${f.common}.png`),fullPage:true,animations:'disabled'});
      evidence.push({common:f.common,receivedName:f.name,namePanel:await panel.innerText(),graph:g,numbering:parent.map((id,i)=>[id,i+1]),selections});
      assert.deepEqual(errors,[]);
    }
    // A reordered SMILES must discard the previous parent and H assignment.
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill('Cn1c(=O)c2c(ncn2C)n(C)c1=O');
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[data-name-fragment="purine-methyl"]').waitFor();
    assert.equal(await page.locator('.reasoning-visual-overlay').count(),0);
    for(const f of fixtures)assert.ok(received.includes(f.name),`PubChem returned the real systematic name for ${f.common}`);
    assert.deepEqual(errors,[]);
    await writeFile(resolve(output,'phase7.json'),JSON.stringify({mode:live?'live':'deterministic',evidence,received,network,errors,consoleErrors},null,2));
  }catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});await writeFile(resolve(output,'failure.txt'),await page.locator('body').innerText());await writeFile(resolve(output,'failure.json'),JSON.stringify({evidence,received,network,errors,consoleErrors},null,2));throw error;}
  finally{await page.close();}
},{timeout:300000});
