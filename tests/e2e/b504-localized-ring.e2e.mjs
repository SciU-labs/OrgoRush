import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const {records}=JSON.parse(await readFile(new URL('../fixtures/b50-pubchem-rings.json',import.meta.url),'utf8'));
const edge=([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':');
async function select(page,kind,text,keyboard=false){
  await page.locator('.reasoning-visual-overlay').waitFor({state:'hidden'});
  const step={parent:'01',numbering:'02',substituent:'03'}[kind];
  const control=page.locator(`#iupac-reasoning-step-${step} .reasoning-name-fragment--${kind} button`).filter({hasText:new RegExp(`^${text}$`)});
  assert.equal(await control.count(),1,`${kind}: ${text}`);
  const [handle]=await Promise.all([page.waitForFunction(()=>{
    const node=document.querySelector('.reasoning-visual-overlay');if(!node)return null;
    return {atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
      bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond.split(':').map(Number).sort((a,b)=>a-b).join(':')).sort(),
      locants:[...node.querySelectorAll('[data-reasoning-locant]')].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector('text').textContent])};
  }),keyboard?control.press('Space'):control.click()]);
  const result=await handle.jsonValue();await handle.dispose();return result;
}
const cases=[
  {cid:7731,es:'1-metil-4-metoxibenceno',en:'1-methoxy-4-methylbenzene',esSecond:'4-metoxi',enSecond:'1-methoxy',secondAtoms:[8,9],secondBonds:[[5,8],[8,9]],esReason:'metoxi identifica el sustituyente unido al C4',enReason:'methoxy identifies the ether substituent attached at benzene ring position 1',alias:true},
  {cid:12207,es:'1-metil-4-yodobenceno',en:'1-iodo-4-methylbenzene',esSecond:'4-yodo',enSecond:'1-iodo',secondAtoms:[8],secondBonds:[[5,8]],esReason:'yodo identifica el sustituyente unido al C4',enReason:'iodo identifies the halogen substituent attached at benzene ring position 1'},
];
for(const fixture of cases)test(`localized aromatic name, locants and canvas CID ${fixture.cid}`,async()=>{
  const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  let browser,page;const errors=[],network=[];
  try{
    await server.listen();browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    page.on('requestfailed',r=>network.push(r.failure()?.errorText));
    await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
    const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());if(url.origin===origin&&!url.pathname.includes('/api/'))return route.continue();
      if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
      if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(records.find(item=>item.cid===fixture.cid).smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.getByText(fixture.es,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    assert.ok((await page.locator('#iupac-reasoning-step-03').innerText()).includes(fixture.esReason));
    const alias=page.locator('.iupac-dock-common-name');if(fixture.alias)assert.match(await alias.textContent(),/4-metilanisol/);
    let result=await select(page,'substituent','1-metil');
    assert.deepEqual(result.atoms,[1]);assert.deepEqual(result.bonds,['1:2']);
    result=await select(page,'numbering','4',true);assert.deepEqual(result.atoms,[5]);
    assert.equal(await page.locator('.molecule-stage [data-atom-id="5"] .number-label').textContent(),'4');
    result=await select(page,'substituent',fixture.esSecond);assert.deepEqual(result.atoms,fixture.secondAtoms);
    assert.deepEqual(result.bonds,fixture.secondBonds.map(edge).sort());
    const before=await page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-atom-id'),n.getAttribute('transform')]));
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.getByText(fixture.en,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    assert.ok((await page.locator('#iupac-reasoning-step-03').innerText()).includes(fixture.enReason));
    if(fixture.alias)assert.match(await alias.textContent(),/4-methylanisole/);
    result=await select(page,'numbering','1',true);assert.deepEqual(result.atoms,[5]);
    assert.equal(await page.locator('.molecule-stage [data-atom-id="5"] .number-label').textContent(),'1');
    result=await select(page,'substituent',fixture.enSecond);assert.deepEqual(result.atoms,fixture.secondAtoms);
    assert.deepEqual(result.bonds,fixture.secondBonds.map(edge).sort());
    result=await select(page,'substituent','4-methyl',true);assert.deepEqual(result.atoms,[1]);assert.deepEqual(result.bonds,['1:2']);
    result=await select(page,'parent','benzene');assert.deepEqual(result.atoms,[2,3,4,5,6,7]);
    const after=await page.locator('.molecule-stage .carbon-node').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-atom-id'),n.getAttribute('transform')]));
    assert.deepEqual(after,before,'changing language preserves molecular geometry');
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.getByText(fixture.es,{exact:true}).first().waitFor({state:'visible',timeout:20000});
    assert.ok((await page.locator('#iupac-reasoning-step-03').innerText()).includes(fixture.esReason));
    result=await select(page,'numbering','1');assert.deepEqual(result.atoms,[2]);
    assert.equal(await page.locator('.molecule-stage [data-atom-id="2"] .number-label').textContent(),'1');
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  }catch(error){if(page){await mkdir('outputs/b504-e2e',{recursive:true});await page.screenshot({path:`outputs/b504-e2e/${fixture.cid}.png`,fullPage:true});await writeFile(`outputs/b504-e2e/${fixture.cid}.json`,JSON.stringify({errors,network,error:String(error)},null,2))}throw error}
  finally{await page?.close();await browser?.close();await server.close()}
},{timeout:120000});
