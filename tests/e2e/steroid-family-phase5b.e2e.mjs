import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {STEROID_REFERENCES} from '../../app/steroid-family-grammar.ts';

const {chromium}=await import('playwright');
const output=resolve('reports/steroid-estrane-androstane-phase5b/playwright');
const resultPath=resolve(output,process.env.ORGORUSH_STEROID_CASE?`results-${process.env.ORGORUSH_STEROID_CASE}.json`:'results.json');
const cases=[
  {id:'estrane-5alpha',family:'estrane',descriptor:'5α',smiles:STEROID_REFERENCES.estrane['5α'].smiles,en:'5α-estrane',es:'5α-estrano'},
  {id:'estrane-5beta',family:'estrane',descriptor:'5β',smiles:STEROID_REFERENCES.estrane['5β'].smiles,en:'5β-estrane',es:'5β-estrano'},
  {id:'estrane-5xi',family:'estrane',descriptor:'5ξ',smiles:STEROID_REFERENCES.estrane['5ξ'].smiles,en:'5ξ-estrane',es:'5ξ-estrano'},
  {id:'androstane-5alpha',family:'androstane',descriptor:'5α',smiles:STEROID_REFERENCES.androstane['5α'].smiles,en:'5α-androstane',es:'5α-androstano'},
  {id:'androstane-5beta',family:'androstane',descriptor:'5β',smiles:STEROID_REFERENCES.androstane['5β'].smiles,en:'5β-androstane',es:'5β-androstano'},
  {id:'androstane-5xi',family:'androstane',descriptor:'5ξ',smiles:STEROID_REFERENCES.androstane['5ξ'].smiles,en:'5ξ-androstane',es:'5ξ-androstano'},
];
const selectedCases=cases.filter(fixture=>!process.env.ORGORUSH_STEROID_CASE||fixture.id===process.env.ORGORUSH_STEROID_CASE);
let server,browser,base;const results=[];
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/en/`;
  assert.equal((await fetch(base,{signal:AbortSignal.timeout(10000)})).status,200);
  browser=await chromium.launch({headless:true,timeout:15000,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
  await mkdir(output,{recursive:true});
},{timeout:45000});
after(async()=>{await browser?.close();await server?.close();await mkdir(output,{recursive:true});await writeFile(resultPath,JSON.stringify(results,null,2)+'\n');});

async function selectFragment(page,id){
  const control=page.locator(`[data-name-fragment="${id}"]`);assert.equal(await control.count(),1,`one semantic control for ${id}`);
  await page.locator('.reasoning-visual-overlay').waitFor({state:'hidden'});
  const [result]=await Promise.all([page.waitForFunction(()=>{const node=document.querySelector('.reasoning-visual-overlay');if(!node)return null;
    return {atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
      bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond.split(':').map(Number).sort((a,b)=>a-b).join(':')).sort()};}),control.click()]);
  return result.jsonValue();
}
async function enterName(page,name){
  const toggle=page.locator('[aria-controls="iupac-name-builder"]');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await page.locator('#iupac-name-input').fill(name);await page.locator('#iupac-name-builder button[type="submit"]').click();
  await page.locator('#iupac-name-input').waitFor({state:'hidden',timeout:20000});
  const full=page.locator('[data-derivation-support="FULL"]');await full.first().waitFor({state:'visible',timeout:20000});
  assert.ok((await full.first().innerText()).includes(name),`${name} strict FULL`);
}

test('six audited steroid references reconcile in both locales and canvas representations with exact locant selections',async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),pageErrors=[],consoleErrors=[],unexpected=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('request',request=>{const url=new URL(request.url());if(url.origin!==new URL(base).origin
    &&!(url.hostname==='www.googletagmanager.com'&&url.pathname==='/gtag/js')
    &&!(url.hostname==='fonts.gstatic.com')
    &&!(url.hostname==='pubchem.ncbi.nlm.nih.gov'&&/\/rest\/pug\/compound\/smiles\/.*\/cids\/JSON$/i.test(url.pathname))
    &&!(url.hostname.endsWith('wikipedia.org')&&url.pathname==='/w/api.php'))unexpected.push(`${request.method()} ${url.href}`);});
  try{
    await page.addInitScript(()=>localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped'));
    await page.route('**/*',async route=>{const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.hostname==='www.googletagmanager.com'&&url.pathname==='/gtag/js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};'});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      if(url.hostname==='pubchem.ncbi.nlm.nih.gov'&&/\/rest\/pug\/compound\/smiles\/.*\/cids\/JSON$/i.test(url.pathname))return route.fulfill({status:200,contentType:'application/json',body:'{"IdentifierList":{"CID":[]}}'});
      if(url.hostname.endsWith('wikipedia.org')&&url.pathname==='/w/api.php')return route.fulfill({status:200,contentType:'application/json',body:'{"query":{"pages":{}}}'});
      unexpected.push(`${route.request().method()} ${url.href}`);return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});try{await page.locator('.guided-tour-skip').click({timeout:1000});}catch{}
    for(const fixture of selectedCases){
      const reference=moleculeFromSmiles(fixture.smiles);assert.equal(reference.ok,true);
      const locants=reference.molecule.fusedPolycyclicStereo.locantAtomIds;assert.ok(locants);
      const importToggle=page.locator('[aria-controls="smiles-interop-panel"]');if(await importToggle.getAttribute('aria-expanded')!=='true')await importToggle.click();
      await page.locator('#smiles-text-input').fill(fixture.smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();
      await page.locator('.molecule-stage').waitFor({state:'visible'});
      await enterName(page,fixture.en);
      const localize=page.getByRole('button',{name:'Español',exact:true});if(await localize.count())await localize.click();
      await enterName(page,fixture.es);
      for(const [language,name] of [['Español',fixture.es],['English',fixture.en]]){
        if(language==='English')await page.getByRole('button',{name:'English',exact:true}).click();
        assert.ok((await page.locator('[data-derivation-support="FULL"]').first().innerText()).includes(name));
        for(const [viewIndex,representation] of [[2,'skeletal'],[0,'semi-developed']]){
          await page.locator('.view-mode-switch button').nth(viewIndex).click();
          const stage=page.locator('.molecule-stage');assert.equal(await stage.locator('.fused-polycyclic-junction-label').count(),3);
          for(const [index,pair] of [[0,[5,10]],[1,[8,9]],[2,[13,14]]]){
            const actual=await selectFragment(page,`steroid-fusion-${index+1}`),atoms=pair.map(n=>locants[String(n)]).sort((a,b)=>a-b);
            assert.deepEqual(actual.atoms,atoms,`${fixture.id} ${language} ${representation} C${pair.join('-')}`);
            assert.deepEqual(actual.bonds,[atoms.join(':')]);
          }
          const methyl18=await selectFragment(page,'steroid-c18');assert.deepEqual(methyl18.atoms,[locants['18']]);assert.deepEqual(methyl18.bonds,[`${Math.min(locants['13'],locants['18'])}:${Math.max(locants['13'],locants['18'])}`]);
          if(locants['19']){const methyl19=await selectFragment(page,'steroid-c19');assert.deepEqual(methyl19.atoms,[locants['19']]);
            assert.deepEqual(methyl19.bonds,[`${Math.min(locants['10'],locants['19'])}:${Math.max(locants['10'],locants['19'])}`]);}
          if(language==='English'&&representation==='skeletal'){
            for(const [letter,positions] of [['A',[1,2,3,4,5,10]],['B',[5,6,7,8,9,10]],['C',[8,9,11,12,13,14]],['D',[13,14,15,16,17]]]){
              const actual=await selectFragment(page,`steroid-ring-${letter}`);
              assert.deepEqual(actual.atoms,positions.map(n=>locants[String(n)]).sort((a,b)=>a-b),`${fixture.id} ring ${letter}`);
            }
            for(const n of [5,10,13,17]){const actual=await selectFragment(page,`steroid-locant-${n}`);assert.deepEqual(actual.atoms,[locants[String(n)]]);assert.deepEqual(actual.bonds,[]);}
          }
          results.push({case:fixture.id,language,representation,status:'FULL',locants,
            selectedChecks:4+(locants['19']?1:0)+(language==='English'&&representation==='skeletal'?8:0)});
        }
        if(language==='Español')await page.getByRole('button',{name:'English',exact:true}).click();
      }
    }
    assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(unexpected,[]);
  }finally{await page.close();}
},{timeout:600000});
