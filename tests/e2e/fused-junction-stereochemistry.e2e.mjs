import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const cases=[
  {configuration:'cis',smiles:'[H][C@]12CCCC[C@@]1([H])CCCC2',english:'cis-decalin',spanish:'cis-decalina'},
  {configuration:'trans',smiles:'[H][C@]12CCCC[C@]1([H])CCCC2',english:'trans-decalin',spanish:'trans-decalina'},
  {configuration:'unspecified',smiles:'C1CCC2CCCCC2C1',requiresFull:false},
];
const output='reports/fused-junction-phase4a';

for(const language of ['es','en'])for(const fixture of cases)test(`${fixture.configuration} decalin junction in ${language} and both canvas forms`,async()=>{
  const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  let browser;const errors=[],failedRequests=[],externalRequests=[];
  try{
    await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin)externalRequests.push(request.url())});
    page.on('requestfailed',request=>{const failure=request.failure()?.errorText;if(failure&&failure!=='net::ERR_ABORTED')failedRequests.push({url:request.url(),error:failure})});
    await page.addInitScript(locale=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language',locale)},language);
    const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route('**/*',async route=>{const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.includes('/api/'))return route.continue();
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
    });
    await page.goto(`${origin}/OrgoRush/${language}/`,{waitUntil:'domcontentloaded',timeout:90000});
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(fixture.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.getByRole('heading',{name:language==='en'?'How it is derived':'Cómo se obtiene'}).waitFor();
    const show=page.getByRole('button',{name:language==='en'?'Show help':'Mostrar ayuda'});
    if(await show.isVisible())await show.click();
    if(fixture.requiresFull!==false){
      const expectedName=language==='en'?fixture.english:fixture.spanish;
      await page.locator('#iupac-reasoning-content[data-derivation-support="FULL"]').waitFor({timeout:10000});
      const renderedName=await page.locator('.reasoning-validated-name strong').textContent();
      assert.equal(renderedName,expectedName,`localized FULL name; dock=${await page.locator('.iupac-dock-name-stack').innerText()}`);
    }else{
      assert.notEqual(await page.locator('#iupac-reasoning-content').getAttribute('data-derivation-support'),'FULL',
        'unspecified imported stereochemistry must not be upgraded to a specified cis/trans FULL name');
      assert.doesNotMatch((await page.locator('.iupac-dock-name-stack').innerText()).toLowerCase(),/cis|trans/);
    }
    const readJunction=async()=>page.locator('.fused-junction-stereo-label').evaluate(node=>({
      configuration:node.getAttribute('data-fused-junction-configuration'),
      atoms:node.getAttribute('data-fused-junction-atom-ids').split(',').map(Number).sort((a,b)=>a-b),
      bond:node.getAttribute('data-fused-junction-bond-ids').split(',').map(Number).sort((a,b)=>a-b),
      label:node.textContent.trim(),
    }));
    const skeletal=await readJunction();assert.equal(skeletal.configuration,fixture.configuration);
    assert.equal(skeletal.atoms.length,2);assert.equal(skeletal.bond.length,2);
    const atoms=await page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.atomId)));
    assert.ok(skeletal.atoms.every(id=>atoms.includes(id)),'junction atom IDs must resolve to visible graph atoms');
    const bondExists=await page.locator('.molecule-bonds-layer [data-bond-a][data-bond-b]').evaluateAll((nodes,ids)=>nodes.some(node=>{
      const pair=[Number(node.dataset.bondA),Number(node.dataset.bondB)].sort((a,b)=>a-b);return pair[0]===ids[0]&&pair[1]===ids[1];
    }),skeletal.bond);
    assert.ok(bondExists,'shared-edge IDs must resolve to a visible graph bond');
    if(fixture.requiresFull!==false){
      await page.locator('#iupac-reasoning-content').getByText(language==='en'?'Fusion configuration':'Configuración de la fusión',{exact:true}).waitFor();
      const junctionControl=page.locator('[data-name-fragment="fusion-junction"]').first();
      await junctionControl.click();
      const highlighted=await page.locator('.reasoning-visual-overlay[data-reasoning-step="2"]').evaluate(node=>({
        atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(item=>Number(item.getAttribute('data-reasoning-atom'))).sort((a,b)=>a-b),
        bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(item=>item.getAttribute('data-reasoning-bond').split(':').map(Number).sort((a,b)=>a-b)),
      }));
      assert.deepEqual(highlighted.atoms,skeletal.atoms,'pedagogical selection must highlight the exact junction atoms');
      assert.deepEqual(highlighted.bonds,[skeletal.bond],'pedagogical selection must highlight the shared fusion bond');
    }
    await mkdir(output,{recursive:true});
    for(const [mode,index] of [['skeletal',2],['semi-developed',0]]){
      await page.locator('.view-mode-switch button').nth(index).click();
      assert.deepEqual(await readJunction(),skeletal,`${language} ${mode}: fusion atom/bond identity must not change`);
      await page.locator('.molecule-stage').screenshot({path:`${output}/${fixture.configuration}-${language}-${mode}.png`});
    }
    assert.deepEqual(errors,[],`page/console errors: ${errors.join('; ')}`);
    assert.deepEqual(failedRequests,[],`unexpected request failures: ${JSON.stringify(failedRequests)}`);
    assert.ok(externalRequests.every(value=>{
      const url=new URL(value);
      return url.hostname==='www.googletagmanager.com'&&url.pathname==='/gtag/js'
        ||url.hostname==='fonts.gstatic.com'&&url.pathname.endsWith('.woff2')
        ||url.hostname==='pubchem.ncbi.nlm.nih.gov'&&/^\/rest\/pug\/compound\/smiles\/.+\/cids\/JSON$/.test(url.pathname)
        ||['es.wikipedia.org','en.wikipedia.org'].includes(url.hostname)&&url.pathname==='/w/api.php';
    }),
      `unexpected external requests: ${JSON.stringify(externalRequests)}`);
  }finally{await browser?.close();await server.close();}
});
