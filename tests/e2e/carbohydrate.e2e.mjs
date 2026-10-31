import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {carbohydrateCases,carbohydrateReferences,carbohydrateControls} from '../fixtures/carbohydrate-derivation.mjs';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {mapStructuralRegions} from '../../app/structural-derivation.ts';
import {reconcileSystematicName} from '../../app/validated-name-derivation.ts';
const {chromium}=await import(process.env.ORGORUSH_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.ORGORUSH_PLAYWRIGHT_MODULE)).href:'playwright');
const live=process.env.ORGORUSH_E2E_LIVE==='1';
const selected=process.env.ORGORUSH_E2E_NAMES?.split('|');
const fixtures=carbohydrateCases.filter(f=>f.priority&&(!selected||selected.includes(f.common)));
const output=resolve('outputs/derivation-e2e/carbohydrate',live?'live':'deterministic');
const sorted=xs=>[...xs].sort((a,b)=>a-b),edge=(a,b)=>[Number(a),Number(b)].sort((a,b)=>a-b).join(':');
const imported=s=>{const r=moleculeFromSmiles(s);assert.equal(r.ok,true,r.error);return r.molecule;};
const same=(a,b)=>!!mapStructuralRegions(imported(a),imported(b),[]);
let server,browser,base;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),
    cacheDir:resolve('.sites-runtime/carbohydrate-e2e-cache',live?'live':'deterministic'),
    server:{host:'127.0.0.1',port:0,strictPort:false}});
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/`;
  assert.equal((await fetch(base)).status,200);
  browser=await chromium.launch({headless:true,timeout:20000,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
  await mkdir(output,{recursive:true});
},{timeout:60000});
after(async()=>{await browser?.close();await server?.close();});

async function createPage(){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(20000);await page.addInitScript(()=>localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped'));
  const errors=[],consoleErrors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push({message:m.text(),url:m.location().url});});
  page.on('response',async response=>{
    if(/opsin|\/property\/|\/api\/name-to-structure/.test(response.url()))try{network.push({url:response.url(),status:response.status(),body:await response.json()});}catch{/* Captured by the subsequent UI identity assertions. */}
  });
  if(!live)await page.route('**/*',async route=>{
    const req=route.request(),url=req.url();if(url.startsWith(new URL(base).origin)&&!url.includes('/api/'))return route.continue();
    const headers={'access-control-allow-origin':'*','content-type':'application/json'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const decoded=decodeURIComponent(url),query=/\/name\/([^/]+)\/cids\/json/i.exec(decoded)?.[1],raw=/\/smiles\/([^/]+)\/cids\/json/i.exec(decoded)?.[1];
    const post=req.method()==='POST'?req.postDataJSON():null;
    const opsinName=/\/opsin\/(?:ws\/)?([^/]+)\.json/.exec(decoded)?.[1];
    const generic=carbohydrateReferences.find(r=>r.query==='glucose'),gp=generic.pubchem.body.PropertyTable.Properties[0];
    const genericQuery=(query??post?.name??opsinName)?.toLowerCase()==='glucose';
    if(genericQuery&&opsinName)return route.fulfill({status:200,headers,body:JSON.stringify({status:'FAILURE',message:'Exercise the actual PubChem unspecified-anomer fallback'})});
    if(genericQuery&&url.includes('/api/'))return route.fulfill({status:200,headers,body:JSON.stringify({source:'PubChem',originalName:'glucose',interpretedName:gp.IUPACName,iupacName:gp.IUPACName,smiles:gp.SMILES??gp.IsomericSMILES,cid:gp.CID,molecularFormula:gp.MolecularFormula,warnings:[]})});
    const genericSmiles=raw&&same(raw,gp.SMILES??gp.IsomericSMILES);
    if(genericQuery&&/\/cids\//i.test(url)||genericSmiles&&/\/cids\//i.test(url))return route.fulfill({status:200,headers,body:JSON.stringify({IdentifierList:{CID:[gp.CID]}})});
    if(decoded.includes(`/cid/${gp.CID}/`))return route.fulfill({status:200,headers,body:JSON.stringify(generic.pubchem.body)});
    const f=carbohydrateCases.find(f=>[query,post?.name,opsinName].some(q=>q?.toLowerCase()===f.common.toLowerCase()||q===f.name)
      ||decoded.includes(`/cid/${f.cid}/`)||raw&&same(raw,f.smiles));
    if(opsinName){
      const ref=carbohydrateReferences.find(r=>r.query.toLowerCase()===opsinName.toLowerCase());
      const control=carbohydrateControls.find(r=>r.name.toLowerCase()===opsinName.toLowerCase());
      return route.fulfill({status:200,headers,body:JSON.stringify(ref?.opsin.body??control??{status:'FAILURE'})});
    }
    if(f&&/\/cids\//i.test(url))return route.fulfill({status:200,headers,body:JSON.stringify({IdentifierList:{CID:[f.cid]}})});
    if(f&&url.includes('/property/'))return route.fulfill({status:200,headers,body:JSON.stringify({PropertyTable:{Properties:[{CID:f.cid,IUPACName:f.name,SMILES:f.smiles,MolecularFormula:f.formula}]}})});
    if(f&&url.includes('/api/'))return route.fulfill({status:200,headers,body:JSON.stringify({source:'OPSIN',originalName:post.name,interpretedName:post.name,smiles:f.smiles,warnings:[]})});
    return route.fulfill({status:200,headers,body:'{}'});
  });
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});return{page,errors,consoleErrors,network};
}
async function build(page,name,support='FULL',expectedName){
  await page.locator('[aria-controls="iupac-name-builder"]').click();await page.locator('#iupac-name-input').fill(name);
  await page.locator('#iupac-name-builder button[type="submit"]').click();await page.locator('#iupac-name-input').waitFor({state:'hidden',timeout:45000});
  const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
  await page.locator(`[data-derivation-support="${support}"]`).waitFor({timeout:45000});
  if(expectedName)await page.waitForFunction(name=>document.querySelector('[data-derivation-support="FULL"]')?.textContent.includes(name),expectedName,{timeout:45000});
}
async function capture(page,trigger){
  const step=await trigger.getAttribute('data-name-fragment');
  const [handle]=await Promise.all([page.waitForFunction(step=>{
    const n=document.querySelector('.reasoning-visual-overlay');if(!n||step&&n.dataset.reasoningStep!==step)return null;
    return{atoms:[...n.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
      bonds:[...n.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond).sort(),
      numbering:[...n.querySelectorAll('[data-reasoning-locant]')].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector('text').textContent]).sort(([a],[b])=>a-b)};
  },step),trigger.click()]);const result=await handle.jsonValue();await handle.dispose();return result;
}
async function canvasGraph(page){return page.locator('.molecule-stage').evaluate(n=>({
  atoms:[...n.querySelectorAll('[data-atom-id]')].map(a=>({id:Number(a.dataset.atomId),element:a.dataset.atomElement,tetrahedralParity:a.dataset.atomConfiguration,x:0,y:0})),
  bonds:[...n.querySelectorAll('[data-bond-a]')].map(b=>[Number(b.dataset.bondA),Number(b.dataset.bondB),Number(b.dataset.bondOrder)]),
}));}
test(`${live?'LIVE':'HTTP FIXTURES'} carbohydrates: common/systematic names, actual stereo, exact shared regions and safe uncertainty`,async()=>{
  const {page,errors,consoleErrors,network}=await createPage(),evidence=[];
  try{
    for(const f of fixtures){
      await build(page,f.common,'FULL',f.name);const panel=page.locator('[data-derivation-support="FULL"]');
      assert.equal(await page.locator('.reasoning-visual-overlay').count(),0,'replacement clears old regions');
      const actual=await canvasGraph(page),reference=imported(f.smiles);
      const mapping=mapStructuralRegions(reference,actual,f.reference.numbering.map(([id])=>[id]));assert.ok(mapping,'complete real graph, explicit R/S and reference locants agree');
      const expected=reconcileSystematicName(reference,f.name);assert.equal(expected?.status,'FULL');
      const selections=[];
      for(const c of expected.components){
        const actualSelection=await capture(page,panel.locator(`[data-name-fragment="${c.id}"]`));
        assert.deepEqual(actualSelection.atoms,sorted(c.atomIds.map(id=>mapping.get(id))),`${f.common}/${c.id} atoms`);
        assert.deepEqual(actualSelection.bonds.map(s=>edge(...s.split(':'))).sort(),c.bondIds.map(([a,b])=>edge(mapping.get(a),mapping.get(b))).sort(),`${f.common}/${c.id} bonds`);
        assert.deepEqual(actualSelection.numbering,c.numbering.map(([id,p])=>[mapping.get(id),String(p)]).sort(([a],[b])=>a-b),`${f.common}/${c.id} locants`);
        selections.push({component:c.id,...actualSelection});
      }
      const chain=selections.find(c=>c.component==='sugar-chain');assert.deepEqual(chain.numbering,f.reference.numbering.map(([id,p])=>[mapping.get(id),String(p)]).sort(([a],[b])=>a-b));
      const exocyclic=f.exocyclicLocants.map(p=>f.reference.numbering[p-1][0]);
      const prefixIds=f.form==='open'?f.reference.hydroxylIds:[...exocyclic,...f.reference.hydroxylIds.filter(o=>
        f.reference.bonds.some(([a,b])=>a===o&&exocyclic.includes(b)||b===o&&exocyclic.includes(a)))];
      assert.deepEqual(selections.find(c=>c.component==='sugar-decoration').atoms,sorted(prefixIds.map(id=>mapping.get(id))),'literal prefix independently matches CML substituent atoms');
      const writtenLocants=f.name.slice(f.name.indexOf(')-')+2).match(/^([\d,]+)-/)[1].split(',').map(Number);
      assert.deepEqual(selections.find(c=>c.component==='sugar-decoration').numbering,writtenLocants.map(p=>
        [mapping.get(f.reference.numbering[(f.form==='open'?p:f.carbonylPosition+p-2)-1][0]),String(p)]).sort(([a],[b])=>a-b),'literal prefix locants independently match the CML reference in the written namespace');
      const referenceSelection=selections.find(c=>c.component==='sugar-reference');assert.deepEqual(referenceSelection.atoms,[mapping.get(f.reference.numbering.at(-2)[0])]);
      if(f.reference.ringOxygenId){
        assert.deepEqual(selections.find(c=>c.component==='sugar-ring-oxygen').atoms,[mapping.get(f.reference.ringOxygenId)]);
        const anomeric=mapping.get(f.reference.numbering[f.carbonylPosition-1][0]);
        assert.ok(selections.find(c=>c.component==='sugar-hemiacetal').atoms.includes(anomeric));
      }
      assert.equal(await page.locator('.molecule-stage .number-circle').count(),0,'contextual locants avoid ring/chain namespace confusion');
      await capture(page,panel.locator('[data-name-fragment="sugar-chain"]'));
      await page.screenshot({path:resolve(output,`${f.common}.png`),fullPage:true,animations:'disabled'});
      if(f.common==='aldehydo-D-glucose'||f.common==='alpha-D-glucopyranose'){
        await capture(page,panel.locator('[data-name-fragment="sugar-decoration"]'));
        await page.screenshot({path:resolve(output,`${f.common}-literal-prefix.png`),fullPage:true,animations:'disabled'});
      }
      if(f.common==='alpha-D-glucopyranose'){
        assert.equal(await page.locator('.view-mode-switch button').nth(1).isDisabled(),true,'existing condensed cyclic boundary');
        await page.locator('.view-mode-switch button').nth(2).click();
        await capture(page,panel.locator('[data-name-fragment="sugar-hemiacetal"]'));
        await page.screenshot({path:resolve(output,'alpha-D-glucopyranose-skeletal.png'),fullPage:true,animations:'disabled'});
        await page.locator('.view-mode-switch button').first().click();
      }
      evidence.push({input:f.common,receivedName:f.name,graph:actual,numbering:chain.numbering,panel:await panel.innerText(),selections});
    }
    for(const f of [carbohydrateCases[0],carbohydrateCases[4]]){
      await build(page,f.name,'FULL',f.name);assert.ok(mapStructuralRegions(imported(f.smiles),await canvasGraph(page),[]));
    }
    // A specific retained aldose name remains a separate derivation, including
    // literal D and alpha fragments, when metadata is not being substituted.
    if(!live){
      // A fresh page has no verified PubChem identity cached from the earlier
      // pass. Disable metadata before the first build on this isolated page.
      const isolated=await createPage(),p2=isolated.page,f=carbohydrateCases[2];
      try{
        await p2.route('**/property/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
        await build(p2,f.common,'FULL',f.common);
        const p=p2.locator('[data-derivation-support="FULL"]');
        assert.equal((await capture(p2,p.locator('[data-name-fragment="sugar-anomer"]'))).atoms.length,3);
        assert.equal((await capture(p2,p.locator('[data-name-fragment="sugar-series"]'))).atoms.length,1);
        await p2.screenshot({path:resolve(output,'retained-alpha-D-glucopyranose.png'),fullPage:true,animations:'disabled'});
        assert.deepEqual(isolated.errors,[]);assert.deepEqual(isolated.consoleErrors,[]);
        network.push(...isolated.network);
      }finally{await p2.close();}
      await build(page,'glucose','PARTIAL');assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0);
      const partial=page.locator('[data-derivation-support="PARTIAL"]');assert.ok((await partial.innerText()).includes('PARTIAL'));
      const ref=partial.locator('[data-structural-kind="anomeric centre"] button');
      await capture(page,ref);await page.screenshot({path:resolve(output,'unspecified-anomer-partial.png'),fullPage:true,animations:'disabled'});
    }
    assert.deepEqual(errors,[]);
    // The existing resolver intentionally tries spelling/translation candidates.
    // A recorded OPSIN 404/FAILURE is an expected name miss only when its exact
    // resource URL caused the console entry AND a later OPSIN result succeeded.
    // Preserve all entries in evidence; never suppress unrelated console errors.
    const expectedOpsinMisses=network.filter((r,i)=>r.status===404&&r.body.status==='FAILURE'
      &&r.url.startsWith('https://www.ebi.ac.uk/opsin/ws/')
      &&network.slice(i+1).some(next=>next.body.status==='SUCCESS'&&next.body.smiles
        &&next.url.startsWith('https://www.ebi.ac.uk/opsin/ws/')));
    const unexpectedConsoleErrors=consoleErrors.filter(c=>!(/^Failed to load resource:.*404/.test(c.message)
      &&expectedOpsinMisses.some(r=>r.url===c.url)));
    assert.deepEqual(unexpectedConsoleErrors,[]);
    await writeFile(resolve(output,'phase8.json'),JSON.stringify({mode:live?'live':'deterministic',evidence,network,errors,consoleErrors,expectedOpsinMisses,unexpectedConsoleErrors},null,2));
  }catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});await writeFile(resolve(output,'failure.txt'),await page.locator('body').innerText());await writeFile(resolve(output,'failure.json'),JSON.stringify({evidence,network,errors,consoleErrors},null,2));throw error;}
  finally{await page.close();}
},{timeout:600000});
