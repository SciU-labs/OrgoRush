import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const {records}=JSON.parse(await readFile(new URL('../fixtures/b50-pubchem-rings.json',import.meta.url),'utf8'));
const cases=[
  {cid:1254,es:'5-metil-2-(1-metiletil)ciclohexanol',en:'5-methyl-2-(1-methylethyl)cyclohexanol',full:true,parentAtoms:6},
  {cid:326,es:'4-(1-metiletil)benzaldehído',en:'4-(1-methylethyl)benzaldehyde',full:true,parentAtoms:7},
  {cid:7439,es:'2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona',en:'2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one',full:true,parentAtoms:6},
  {cid:7455,es:'4-metilbenzoato de metilo',en:'methyl 4-methylbenzoate',full:true,parentAtoms:7},
  {cid:69274,es:'4-metilbenzamida',en:'4-methylbenzamide',full:true,parentAtoms:7},
  {cid:7724,es:'4-metilbenzonitrilo',en:'4-methylbenzonitrile',full:true,parentAtoms:7},
  {cid:7731,es:'1-metil-4-metoxibenceno',en:'1-methoxy-4-methylbenzene',full:true},
  {cid:7473,es:'1-metil-4-nitrobenceno',en:'1-methyl-4-nitrobenzene',full:true},
  {cid:9603,es:'1-fluoro-4-metilbenceno',en:'1-fluoro-4-methylbenzene',full:true},
  {cid:7931,es:'1-cloro-3-metilbenceno',en:'1-chloro-3-methylbenzene',full:true},
  {cid:7236,es:'1-bromo-2-metilbenceno',en:'1-bromo-2-methylbenzene',full:true},
  {cid:12207,es:'1-metil-4-yodobenceno',en:'1-iodo-4-methylbenzene',full:true},
];

async function activate(page,button,keyboard=false){
  await page.locator('.reasoning-visual-overlay').waitFor({state:'hidden'});
  const label=await button.getAttribute('aria-label');
  const resultPromise=page.waitForFunction(()=>{
    const overlays=[...document.querySelectorAll('.reasoning-visual-overlay')];
    const atoms=[...document.querySelectorAll('.reasoning-visual-overlay [data-reasoning-atom]')].map(node=>Number(node.dataset.reasoningAtom));
    const bonds=[...document.querySelectorAll('.reasoning-visual-overlay [data-reasoning-bond]')].map(node=>node.dataset.reasoningBond);
    const locants=[...document.querySelectorAll('.reasoning-visual-overlay [data-reasoning-locant]')].map(node=>Number(node.dataset.reasoningLocant));
    return overlays.length&&atoms.length+bonds.length+locants.length>0?{atoms,bonds,locants}:null;
  });
  if(keyboard) await button.focus().then(()=>button.press('Space')); else await button.click();
  const handle=await resultPromise,result=await handle.jsonValue();
  await handle.dispose();
  assert.equal(await button.getAttribute('aria-pressed'),'true',`selected accessible control: ${label}`);
  return result;
}

for(const fixture of cases)test(`B5.2 real UI reasoning controls and canvas CID ${fixture.cid}`,async()=>{
  const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  let browser,page;const errors=[],network=[];
  try{
    await server.listen();browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('requestfailed',request=>network.push(request.failure()?.errorText));
    await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
    const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.includes('/api/'))return route.continue();
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(records.find(record=>record.cid===fixture.cid).smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.getByText(fixture.es,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    const panel=page.locator('#iupac-reasoning-content');
    if(await page.locator('.reasoning-visibility-button').getAttribute('aria-expanded')!=='true')await page.locator('.reasoning-visibility-button').click();
    await panel.waitFor({state:'visible'});
    if(fixture.full){
      assert.equal(await panel.getAttribute('data-derivation-support'),'FULL','the exact localized profile has a complete graph proof');
      assert.equal(await panel.locator('.reasoning-validated-name').innerText(),fixture.es);
    }else assert.notEqual(await panel.getAttribute('data-derivation-support'),'FULL','local naming alone must not claim fully validated derivation');
    const geometry=()=>page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(node=>[node.getAttribute('data-atom-id'),node.getAttribute('transform')]));
    const before=await geometry();
    for(const kind of ['parent','function','substituent','unsaturation','numbering']){
      const controls=page.locator(`.reasoning-name-fragment--${kind} button`);
      const count=await controls.count();
      for(let index=0;index<count;index++){
        const button=controls.nth(index);
        const label=await button.getAttribute('aria-label');
        assert.ok(label,`${kind} control has an accessible name`);
        const result=await activate(page,button,index%2===1);
        if(kind==='parent')assert.equal(result.atoms.length,fixture.parentAtoms??6,'parent control highlights the validated parent atoms');
        if(kind==='function')assert.ok(result.atoms.length>=2,'function control highlights its connected function atoms');
        if(kind==='numbering')assert.equal(result.atoms.length,1,'locant control highlights one numbered parent atom');
      }
    }
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.getByText(fixture.en,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    await page.waitForFunction(()=>{
      const controls=[...document.querySelectorAll('.reasoning-name-fragment button[aria-label]')];
      return controls.length>0&&controls.every(button=>button.getAttribute('aria-label')?.includes('Highlight in the molecule'));
    },null,{timeout:10000});
    const englishSupport=await panel.getAttribute('data-derivation-support');
    if(fixture.full)assert.equal(englishSupport,'FULL','the independently parsed English profile has a complete graph proof');
    else assert.ok(englishSupport===null||englishSupport==='PARTIAL'||englishSupport==='FULL');
    if(englishSupport==='FULL')assert.equal(await panel.locator('.reasoning-validated-name').innerText(),fixture.en,
      'FULL support is tied to the exact active English name');
    for(const kind of ['parent','function','substituent','unsaturation','numbering']){
      const controls=page.locator(`.reasoning-name-fragment--${kind} button`);
      const count=await controls.count();
      for(let index=0;index<count;index++){
        const button=controls.nth(index),label=await button.getAttribute('aria-label');
        assert.ok(label&&label.includes('Highlight in the molecule'),`English accessible control: ${label}`);
        const result=await activate(page,button,index%2===0);
        if(kind==='numbering')assert.equal(result.atoms.length,1);
      }
    }
    assert.deepEqual(await geometry(),before,'language changes preserve molecular geometry');
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.getByText(fixture.es,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    if(fixture.full){
      assert.equal(await panel.getAttribute('data-derivation-support'),'FULL');
      assert.equal(await panel.locator('.reasoning-validated-name').innerText(),fixture.es,
        'returning to Spanish resolves the localized proof instead of stale English fragments');
      const parent=page.locator('.reasoning-name-fragment--parent button').first();
      const selected=await activate(page,parent,true);
      assert.ok(selected.atoms.length>=(fixture.parentAtoms??6),'the returned Spanish parent control still maps to the current canvas graph');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  }finally{await page?.close();await browser?.close();await server.close()}
},{timeout:120000});
