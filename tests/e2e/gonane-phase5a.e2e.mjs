import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {GONANE_REFERENCES} from '../../app/gonane-stereo-grammar.ts';

const {chromium}=await import('playwright');
const output=resolve('reports/steroid-gonane-phase5a/playwright');
const cases=[
  {id:'gonane-5xi',descriptor:'5ξ',smiles:GONANE_REFERENCES['5ξ'].smiles,expected:'5ξ-gonane',expectedEs:'5ξ-gonano'},
  {id:'gonane-5alpha',descriptor:'5α',smiles:GONANE_REFERENCES['5α'].smiles,expected:'5α-gonane',expectedEs:'5α-gonano'},
  {id:'gonane-5beta',descriptor:'5β',smiles:GONANE_REFERENCES['5β'].smiles,expected:'5β-gonane',expectedEs:'5β-gonano'},
];
const selectedCases=cases.filter(f=>!process.env.ORGORUSH_GONANE_CASE||f.id===process.env.ORGORUSH_GONANE_CASE);
let server,browser,base;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/en/`;
  const response=await fetch(base,{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);
  browser=await chromium.launch({headless:true,timeout:15000,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
  await mkdir(output,{recursive:true});
},{timeout:45000});
after(async()=>{await browser?.close();await server?.close();});

async function selectFragment(page,id){
  const control=page.locator(`[data-name-fragment="${id}"]`).first();assert.equal(await control.count(),1,`one semantic control for ${id}`);
  await page.locator('.reasoning-visual-overlay').waitFor({state:'hidden'});
  const [result]=await Promise.all([
    page.waitForFunction(()=>{const node=document.querySelector('.reasoning-visual-overlay');if(!node)return null;
      return {atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
        bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond).sort()};}),control.click(),
  ]);
  return result.jsonValue();
}

test('gonane references reconcile in English and Spanish with exact ring and fusion selections in both canvas modes',async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),pageErrors=[],consoleErrors=[],unexpected=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('request',request=>{if(!request.url().startsWith(new URL(base).origin)
    &&!request.url().startsWith('https://www.googletagmanager.com/gtag/js')
    &&!request.url().startsWith('https://fonts.gstatic.com/')
    &&!(new URL(request.url()).hostname==='pubchem.ncbi.nlm.nih.gov'&&/\/rest\/pug\/compound\/smiles\/.*\/cids\/JSON$/i.test(new URL(request.url()).pathname))
    &&!(new URL(request.url()).hostname.endsWith('wikipedia.org')&&new URL(request.url()).pathname==='/w/api.php'))unexpected.push(`${request.method()} ${request.url()}`);});
  try{
    await page.addInitScript(()=>localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped'));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.hostname==='www.googletagmanager.com'&&url.pathname==='/gtag/js')return route.fulfill({status:200,contentType:'application/javascript',body:'window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};'});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      if(url.hostname==='pubchem.ncbi.nlm.nih.gov'&&/\/rest\/pug\/compound\/smiles\/.*\/cids\/JSON$/i.test(url.pathname))return route.fulfill({status:200,contentType:'application/json',body:'{"IdentifierList":{"CID":[]}}'});
      if(url.hostname.endsWith('wikipedia.org')&&url.pathname==='/w/api.php')return route.fulfill({status:200,contentType:'application/json',body:'{"query":{"pages":{}}}'});
      unexpected.push(`${route.request().method()} ${url.href}`);
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    try{await page.locator('.guided-tour-skip').click({timeout:1000});}catch{}
    for(const fixture of selectedCases){
      const reference=moleculeFromSmiles(fixture.smiles);assert.equal(reference.ok,true);
      const expected=reference.molecule.fusedPolycyclicStereo,locants=expected.locantAtomIds;assert.ok(expected);
      const importToggle=page.locator('[aria-controls="smiles-interop-panel"]');
      if(await importToggle.getAttribute('aria-expanded')!=='true')await importToggle.click();
      await page.locator('#smiles-text-input').fill(fixture.smiles);
      await page.locator('#smiles-interop-panel button[type="submit"]').click();
      await page.locator('.molecule-stage').waitFor({state:'visible'});
      assert.equal(await page.getByText(/Núcleo de androstano reconocido|Androstane nucleus recognized/).count(),0,'gonane must not be labeled androstane');
      assert.ok(await page.getByText(/Gonane nucleus recognized/).count()>0,'the English parent-core status identifies gonane in English');
      const nameToggle=page.locator('[aria-controls="iupac-name-builder"]');
      if(await nameToggle.getAttribute('aria-expanded')!=='true')await nameToggle.click();
      await page.locator('#iupac-name-input').fill(fixture.expected);
      await page.locator('#iupac-name-builder button[type="submit"]').click();
      await page.locator('#iupac-name-input').waitFor({state:'hidden',timeout:20000});
      const full=page.locator('[data-derivation-support="FULL"]');await full.first().waitFor({state:'visible',timeout:20000});
      assert.ok((await full.first().innerText()).includes(fixture.expected),fixture.id);
      const disclosure=page.locator('.reasoning-visibility-button');if(await disclosure.getAttribute('aria-expanded')!=='true')await disclosure.click();
      const expectedFusionLocants=[[5,10],[8,9],[13,14]];
      for(let index=0;index<3;index++){
        const selected=await selectFragment(page,`gonane-fusion-${index+1}`),atoms=expectedFusionLocants[index].map(n=>locants[String(n)]).sort((a,b)=>a-b);
        assert.deepEqual(selected.atoms,atoms,`${fixture.id} fusion ${expectedFusionLocants[index].join('-')} atoms`);
        assert.deepEqual(selected.bonds,[atoms.join(':')],`${fixture.id} shared bond`);
      }
      for(const [letter,members] of [['A',[1,2,3,4,5,10]],['B',[5,6,7,8,9,10]],['C',[8,9,11,12,13,14]],['D',[13,14,15,16,17]]]){
        const selected=await selectFragment(page,`gonane-ring-${letter}`);
        assert.deepEqual(selected.atoms,members.map(n=>locants[String(n)]).sort((a,b)=>a-b),`${fixture.id} ring ${letter}`);
      }
      for(const [language,expectedName] of [['Español',fixture.expectedEs],['English',fixture.expected]]){
        if(language==='Español')await page.getByRole('button',{name:language,exact:true}).click();
        assert.equal(await page.getByText(language==='English'?/Gonane nucleus recognized/:/Núcleo de gonano reconocido/).count(),1,
          `${fixture.id} localizes the gonane core status in ${language}`);
        assert.ok((await page.locator('[data-derivation-support="FULL"]').first().innerText()).includes(expectedName),`${fixture.id} ${language} FULL`);
        for(const [viewIndex,representation] of [[2,'skeletal'],[0,'semi-developed']]){
          await page.locator('.view-mode-switch button').nth(viewIndex).click();
          const stage=page.locator('.molecule-stage');
          assert.equal(await stage.locator('.fused-polycyclic-junction-label').count(),3);
          for(let index=0;index<3;index++){
            const junction=stage.locator('.fused-polycyclic-junction-label').nth(index);
            assert.deepEqual((await junction.getAttribute('data-fused-polycyclic-junction-atom-ids')).split(',').map(Number).sort((a,b)=>a-b),
              expectedFusionLocants[index].map(n=>locants[String(n)]).sort((a,b)=>a-b));
          assert.notEqual(await junction.locator('rect').evaluate(node=>getComputedStyle(node).fill),'rgb(0, 0, 0)',
            'fusion labels remain readable and do not obscure the shared bond');
          }
          if(language==='English')await page.screenshot({path:resolve(output,`${fixture.id}-${representation}.png`),fullPage:false,animations:'disabled'});
        }
        if(language==='Español')await page.getByRole('button',{name:'English',exact:true}).click();
      }
    }
    assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(unexpected,[]);
  }finally{await page.close();}
},{timeout:180000});

test('unspecified stereo, incorrect alpha/beta names, and a branched 6–6–6–5 topology never reconcile FULL',()=>{
  const unspecific=cases[1].smiles.replace(/\[C@H\]|\[C@@H\]/g,'C');
  const graph=moleculeFromSmiles(unspecific);assert.equal(graph.ok,true);
  assert.notEqual(reconcileName(graph.molecule,'5α-gonane'),'FULL');
  const alpha=moleculeFromSmiles(cases[1].smiles),beta=moleculeFromSmiles(cases[2].smiles);assert.equal(alpha.ok,true);assert.equal(beta.ok,true);
  assert.notEqual(reconcileName(alpha.molecule,'5β-gonane'),'FULL');assert.notEqual(reconcileName(beta.molecule,'5α-gonane'),'FULL');
  const star=branchedTetracycle();assert.equal(findSaturatedFusedPolycycle(star,[5,6,6,6]),null);
  assert.notEqual(reconcileName(star,'5α-gonane'),'FULL');
});

import {findSaturatedFusedPolycycle} from '../../app/fused-polycyclic-stereochemistry.ts';
import {reconcileSystematicName} from '../../app/validated-name-derivation.ts';
const reconcileName=(graph,name)=>reconcileSystematicName(graph,name)?.status;
function branchedTetracycle(){
  const ringAtoms=[[1,2,3,4,5,6],[1,2,7,8,9,10],[3,4,11,12,13,14],[5,6,15,16,17]];
  const edges=new Map();for(const ring of ringAtoms)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],key=[a,b].sort((x,y)=>x-y).join(':');edges.set(key,[a,b,1]);}
  return {atoms:Array.from({length:17},(_,i)=>({id:i+1,x:0,y:0,element:'C'})),bonds:[...edges.values()],
    rings:ringAtoms.map((atomIds,index)=>({id:index+1,kind:'cycloalkane',atomIds}))};
}
