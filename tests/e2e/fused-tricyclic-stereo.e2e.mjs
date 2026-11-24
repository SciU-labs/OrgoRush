import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';

const {chromium}=await import(process.env.ORGORUSH_PLAYWRIGHT_MODULE
  ?pathToFileURL(resolve(process.env.ORGORUSH_PLAYWRIGHT_MODULE)).href:'playwright');
const output=resolve('reports/fused-tricyclic-phase4b/playwright');
const cases=[
  {id:'linear-unspecified',smiles:'C1CCC2CC3CCCCC3CC2C1',topology:'linear',configuration:'unspecified',cid:93034,name:'1,2,3,4,4a,5,6,7,8,8a,9,9a,10,10a-tetradecahydroanthracene'},
  {id:'linear-pin',smiles:'C1CC[C@H]2C[C@H]3CCCC[C@H]3C[C@H]2C1',topology:'linear',configuration:'complete',cid:12635295,name:'(4aR,8aR,9aS,10aS)-1,2,3,4,4a,5,6,7,8,8a,9,9a,10,10a-tetradecahydroanthracene'},
  {id:'linear-partial',smiles:'C1CCC2CC3CCCCC3C[C@@H]2C1',topology:'linear',configuration:'partial',cid:141766658,name:'(4aS)-1,2,3,4,4a,5,6,7,8,8a,9,9a,10,10a-tetradecahydroanthracene'},
  {id:'angular-unspecified',smiles:'C1CCC2C(C1)CCC3C2CCCC3',topology:'angular',configuration:'unspecified',cid:21971,name:'1,2,3,4,4a,4b,5,6,7,8,8a,9,10,10a-tetradecahydrophenanthrene'},
  {id:'angular-nist-a',smiles:'C1CC[C@@H]2[C@H](C1)CC[C@H]3[C@@H]2CCCC3',topology:'angular',configuration:'complete',cid:12795911,name:'(4aR,4bS,8aS,10aR)-1,2,3,4,4a,4b,5,6,7,8,8a,9,10,10a-tetradecahydrophenanthrene'},
  {id:'angular-nist-b',smiles:'C1CC[C@@H]2[C@H](C1)CC[C@@H]3[C@H]2CCCC3',topology:'angular',configuration:'complete',cid:12795910,name:'(4aR,4bR,8aR,10aR)-1,2,3,4,4a,4b,5,6,7,8,8a,9,10,10a-tetradecahydrophenanthrene'},
];
const selectedCases=cases.filter(f=>!process.env.ORGORUSH_FUSED_CASE||f.id===process.env.ORGORUSH_FUSED_CASE);
let server,browser,base;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),
    server:{host:'127.0.0.1',port:0,strictPort:false}});
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/en/`;
  const response=await fetch(base,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
  browser=await chromium.launch({headless:true,timeout:15000,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
  await mkdir(output,{recursive:true});
},{timeout:45000});
after(async()=>{await browser?.close();await server?.close();});

async function captureSelection(page,trigger){
  await page.locator('.reasoning-visual-overlay').waitFor({state:'hidden'});
  const [snapshot]=await Promise.all([
    page.waitForFunction(()=>{
      const node=document.querySelector('.reasoning-visual-overlay');if(!node)return null;
      return {atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
        bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond).sort()};
    }),trigger.click(),
  ]);
  const value=await snapshot.jsonValue();await snapshot.dispose();return value;
}

test('six saturated 6-6-6 cases preserve exact junction selections across language and display modes',async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],consoleErrors=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push({text:message.text(),url:message.location().url});});
  page.on('response',response=>{if(response.status()>=400)unexpected.push({status:response.status(),url:response.url()});});
  page.on('requestfailed',request=>unexpected.push(`${request.method()} ${new URL(request.url()).origin}`));
  const observations=[];
  try{
    await page.addInitScript(()=>localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped'));
    let activeFixture=selectedCases[0];
    await page.route('**/*',async route=>{
      const request=route.request(),url=request.url();
      const endpoint=new URL(url),path=decodeURIComponent(endpoint.pathname).toLowerCase();
      const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
      if(url.startsWith(new URL(base).origin)){
        if(path.endsWith('/api/name-to-structure'))return route.fulfill({status:200,headers,body:JSON.stringify({
          source:'PubChem',originalName:request.postDataJSON()?.name,interpretedName:activeFixture.name,
          iupacName:activeFixture.name,smiles:activeFixture.smiles,cid:activeFixture.cid,molecularFormula:'C14H24',warnings:[],
        })});
        return route.continue();
      }
      if(endpoint.hostname==='www.googletagmanager.com'&&endpoint.pathname==='/gtag/js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* deterministic test analytics stub */'});
      if(endpoint.hostname==='fonts.gstatic.com')return route.fulfill({status:204,headers,body:''});
      if(/^(en|es)\.wikipedia\.org$/.test(endpoint.hostname))return route.fulfill({status:200,headers,body:JSON.stringify({query:{pages:{}}})});
      if(endpoint.hostname==='www.wikidata.org')return route.fulfill({status:200,headers,body:JSON.stringify({search:[]})});
      if(endpoint.hostname==='www.ebi.ac.uk'&&path.startsWith('/opsin/ws/'))return route.fulfill({status:200,headers,body:JSON.stringify({status:'FAILURE',message:'No OPSIN fixture; exercise curated local reconciliation'})});
      if(endpoint.hostname==='pubchem.ncbi.nlm.nih.gov'&&path.includes('/cids/json'))
        return route.fulfill({status:200,headers,body:JSON.stringify({IdentifierList:{CID:[activeFixture.cid]}})});
      if(endpoint.hostname==='pubchem.ncbi.nlm.nih.gov'&&path.includes('/property/'))
        return route.fulfill({status:200,headers,body:JSON.stringify({PropertyTable:{Properties:[{
          CID:activeFixture.cid,IUPACName:activeFixture.name,IsomericSMILES:activeFixture.smiles,MolecularFormula:'C14H24',
        }]}})});
      if(endpoint.hostname==='pubchem.ncbi.nlm.nih.gov'&&path.includes('/description/json'))
        return route.fulfill({status:200,headers,body:JSON.stringify({InformationList:{Information:[{CID:activeFixture.cid,Description:''}]}})});
      if(endpoint.hostname==='pubchem.ncbi.nlm.nih.gov'&&path.includes('/synonyms/json'))
        return route.fulfill({status:200,headers,body:JSON.stringify({InformationList:{Information:[{CID:activeFixture.cid,Synonym:[]}]}})});
      unexpected.push({reason:'Unmatched request',method:request.method(),url});
      return route.fulfill({status:200,headers,body:JSON.stringify({})});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    try{await page.locator('.guided-tour-skip').click({timeout:1000});}catch{}
    for(const fixture of selectedCases){
      activeFixture=fixture;
      const reference=moleculeFromSmiles(fixture.smiles);assert.equal(reference.ok,true,fixture.id);
      const expected=reference.molecule.fusedRingSystemStereo;assert.ok(expected,fixture.id);
      assert.equal(expected.topology,fixture.topology);assert.equal(expected.specification,fixture.configuration);
      const importToggle=page.locator('[aria-controls="smiles-interop-panel"]');
      if(await importToggle.getAttribute('aria-expanded')!=='true')await importToggle.click();
      await page.locator('#smiles-text-input').fill(fixture.smiles);
      await page.locator('#smiles-interop-panel button[type="submit"]').click();
      const stage=page.locator('.molecule-stage');await stage.waitFor({state:'visible'});
      if(fixture.configuration!=='partial'){
        const nameToggle=page.locator('[aria-controls="iupac-name-builder"]');
        if(await nameToggle.getAttribute('aria-expanded')!=='true')await nameToggle.click();
        await page.locator('#iupac-name-input').fill(fixture.name);
        await page.locator('#iupac-name-builder button[type="submit"]').click();
        await page.locator('#iupac-name-input').waitFor({state:'hidden',timeout:20000});
        const full=page.locator('[data-derivation-support="FULL"]');await full.first().waitFor({state:'visible',timeout:20000});
        assert.ok((await full.first().innerText()).includes(fixture.name),`${fixture.id} English name remains FULL`);
        const reasoningDisclosure=page.locator('.reasoning-visibility-button');
        if(await reasoningDisclosure.getAttribute('aria-expanded')!=='true')await reasoningDisclosure.click();
        for(let index=0;index<2;index++){
          const control=page.locator(`[data-name-fragment="fusion-junction-${index+1}"]`).first();
          assert.equal(await control.count(),1,`${fixture.id} exposes each independent fusion control once`);
          const selected=await captureSelection(page,control);
          const junction=expected.junctions[index];
          assert.deepEqual(selected.atoms,[...junction.fusionAtomIds].sort((a,b)=>a-b));
          assert.deepEqual(selected.bonds,[junction.fusionBond.slice().sort((a,b)=>a-b).join(':')].map(s=>s.split(':').map(Number).sort((a,b)=>a-b).join(':')));
        }
        const spanish=fixture.name.replace('tetradecahydroanthracene','tetradecahidroantraceno')
          .replace('tetradecahydrophenanthrene','tetradecahidrofenantreno');
        await page.getByRole('button',{name:'Español',exact:true}).click();
        assert.ok((await page.locator('[data-derivation-support="FULL"]').first().innerText()).includes(spanish),`${fixture.id} Spanish name remains FULL independently`);
        await page.getByRole('button',{name:'English',exact:true}).click();
      }else{
        assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0,'partial stereo must not be promoted to FULL');
      }
      const labels=stage.locator('.fused-tricyclic-junction-label');await labels.first().waitFor({state:'visible'});
      assert.equal(await labels.count(),2,fixture.id);
      const readLabels=()=>labels.evaluateAll(nodes=>nodes.map(node=>({
        topology:node.dataset.fusedTricyclicTopology,index:Number(node.dataset.fusedTricyclicJunctionIndex),
        relation:node.dataset.fusedTricyclicJunctionRelation,atoms:node.dataset.fusedTricyclicJunctionAtomIds.split(',').map(Number).sort((a,b)=>a-b),
        bond:node.dataset.fusedTricyclicJunctionBondIds.split(',').map(Number).sort((a,b)=>a-b),label:node.getAttribute('aria-label'),
      })).sort((a,b)=>a.index-b.index));
      const initial=await readLabels();
      assert.deepEqual(initial.map(label=>label.topology),[fixture.topology,fixture.topology]);
      assert.deepEqual(initial.map(label=>label.index),[1,2]);
      assert.deepEqual(initial.map(label=>label.relation),expected.junctions.map(j=>j.relation));
      assert.deepEqual(initial.map(label=>label.atoms),expected.junctions.map(j=>[...j.fusionAtomIds].sort((a,b)=>a-b)));
      assert.deepEqual(initial.map(label=>label.bond),expected.junctions.map(j=>[...j.fusionBond].sort((a,b)=>a-b)));
      for(const viewIndex of [2,0]){
        await page.locator('.view-mode-switch button').nth(viewIndex).click();
        const viewLabels=await readLabels();assert.deepEqual(viewLabels.map(label=>label.atoms),initial.map(label=>label.atoms));
        assert.deepEqual(viewLabels.map(label=>label.bond),initial.map(label=>label.bond));
      }
      for(const [language,labelsExpected] of [['Español',['fusión 1','fusión 2']],['English',['fusion 1','fusion 2']]]){
        await page.getByRole('button',{name:language,exact:true}).click();
        const localized=await readLabels();assert.deepEqual(localized.map(label=>label.label),labelsExpected);
        assert.deepEqual(localized.map(label=>label.atoms),initial.map(label=>label.atoms));
      }
      if(await importToggle.getAttribute('aria-expanded')!=='true')await importToggle.click();
      const [download]=await Promise.all([
        page.waitForEvent('download'),page.getByRole('button',{name:/Export SMILES \(\.smi\)/i}).click(),
      ]);
      const exportedPath=resolve(output,`roundtrip-${fixture.id}.smi`);await download.saveAs(exportedPath);
      const exported=(await readFile(exportedPath,'utf8')).trim();assert.equal(exported,fixture.smiles,`${fixture.id} UI exports the exact isomeric SMILES`);
      await page.locator('#smiles-text-input').fill(exported);
      await page.locator('#smiles-interop-panel button[type="submit"]').click();
      await page.locator('.fused-tricyclic-junction-label').first().waitFor({state:'visible'});
      const roundtrip=await readLabels();assert.deepEqual(roundtrip.map(label=>label.atoms),initial.map(label=>label.atoms));
      assert.deepEqual(roundtrip.map(label=>label.bond),initial.map(label=>label.bond));
      if(['linear-pin','angular-nist-a','angular-nist-b'].includes(fixture.id))
        await page.screenshot({path:resolve(output,`${fixture.id}.png`),fullPage:true,animations:'disabled'});
      observations.push({id:fixture.id,topology:fixture.topology,stereo:fixture.configuration,junctions:initial});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[],JSON.stringify({consoleErrors,unexpected}));assert.deepEqual(unexpected,[]);
    await writeFile(resolve(output,'results.json'),JSON.stringify({cases:observations,errors,consoleErrors,unexpected},null,2));
  }catch(error){
    await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});
    await writeFile(resolve(output,'failure.txt'),await page.locator('body').innerText());throw error;
  }finally{await page.close();}
},{timeout:420000});
