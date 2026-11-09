import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'vite';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.ORGORUSH_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.ORGORUSH_PLAYWRIGHT_MODULE)).href : 'playwright');
let server,browser,base;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`;
  browser=await chromium.launch({headless:true,timeout:20000,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ? {executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}: {})});
},{timeout:60000});
after(async()=>{await browser?.close();await server?.close()});
const edge=([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':');
async function capture(page,selector,keyboard=false){
  await page.locator('.reasoning-visual-overlay').waitFor({state:'hidden'});
  const [handle]=await Promise.all([page.waitForFunction(()=>{
    const node=document.querySelector('.reasoning-visual-overlay');if(!node)return null;
    return {atoms:[...node.querySelectorAll('[data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
      bonds:[...node.querySelectorAll('[data-reasoning-bond]')].map(n=>n.dataset.reasoningBond),
      locants:[...node.querySelectorAll('[data-reasoning-locant]')].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector('text').textContent])};
  }),keyboard?selector.press('Space'):selector.click()]);
  const value=await handle.jsonValue();await handle.dispose();return value;
}
const cases=[
  ['O=C(O)C(CCO)CCO',[4,8,9,10],[[4,8],[8,9],[9,10]],[9,10],[2,4,5,6]],
  ['O=C(O)C(CCN)CCC',[4,5,6,7],[[4,5],[5,6],[6,7]],[6,7],[2,4,8,9,10]],
  ['O=C(O)C(CC(=O)C)CCCC',[4,5,6,7,8],[[4,5],[5,6],[6,7],[6,8]],[6,7],[2,4,9,10,11,12]],
  ['O=CC(CCO)CCO',[3,7,8,9],[[3,7],[7,8],[8,9]],[8,9],[2,3,4,5],3,2,[1,2],[5,6]],
  ['O=CC(CCN)CCC',[3,4,5,6],[[3,4],[4,5],[5,6]],[5,6],[2,3,7,8,9],3,2,[1,2]],
  ['CC(=O)C(CCN)CCC',[4,5,6,7],[[4,5],[5,6],[6,7]],[6,7],[1,2,4,8,9,10],4,3,[2,3]],
  ['O=CC(CC(=O)C)CCCC',[3,4,5,6,7],[[3,4],[4,5],[5,6],[5,7]],[5,6],[2,3,8,9,10,11],3,2,[1,2]],
];
for(const [smiles,atoms,bonds,group,parent,anchor=4,parentNumber=2,principal,otherOH] of cases)test(`functionalized branch canvas: ${smiles}`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],networkErrors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>networkErrors.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)networkErrors.push(`${r.status()} ${r.url()}`)});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin&&!url.pathname.includes('/api/'))return route.continue();
    if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
    if(!['pubchem.ncbi.nlm.nih.gov','www.ebi.ac.uk','en.wikipedia.org','es.wikipedia.org','www.wikidata.org',new URL(base).hostname].includes(url.hostname))unexpected.push(url.origin);
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
  });
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    const help=page.locator('.reasoning-visibility-button');
    if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    const complete=page.locator('[data-name-fragment="functionalized:complete"]');
    await complete.waitFor({state:'visible',timeout:20000});
    assert.match(await complete.getAttribute('aria-label'),/Sustituyente completo/);
    assert.match(await page.locator('[data-name-fragment="functionalized:function"]').getAttribute('aria-label'),/Función secundaria/);
    let selection=await capture(page,complete);
    assert.deepEqual(selection.atoms,atoms);assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))).sort(),bonds.map(edge).sort());
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent"]'));
    assert.deepEqual(selection.atoms,parent);
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:attachment"]'));
    assert.deepEqual(selection.atoms,[...bonds[0]].sort((a,b)=>a-b));
    assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(bonds[0])]);
    if(principal){
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:principal"]'));
      assert.deepEqual(selection.atoms,principal);assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(principal)]);
    }
    if(parentNumber===3){
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:principal-locant"]'),true);
      assert.deepEqual(selection.atoms,[2]);
      assert.equal(await page.locator('.molecule-stage [data-atom-id="2"] .number-label').textContent(),'2');
    }
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:function"]'),true);
    assert.deepEqual(selection.atoms,group);assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(group)]);
    if(smiles===cases[0][0]){
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent-function-4"]'));
      assert.deepEqual(selection.atoms,[6,7]);assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),['6:7']);
    }
    if(otherOH){
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent-function-4"]'));
      assert.deepEqual(selection.atoms,otherOH);assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(otherOH)]);
    }
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:local-locant"]'));
    assert.deepEqual(selection.locants,[[group[0],'2']]);
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent-locant"]'));
    assert.deepEqual(selection.atoms,[anchor]);
    // Existing parent badges suppress an identical transient badge.
    assert.equal(await page.locator(`.molecule-stage [data-atom-id="${anchor}"] .number-label`).textContent(),String(parentNumber));
    assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0);
    assert.equal(await page.locator('[data-derivation-support="PARTIAL"]').count(),1);
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.locator('[data-name-fragment="functionalized:complete"]').waitFor({state:'visible'});
    assert.match(await page.locator('[data-name-fragment="functionalized:complete"]').getAttribute('aria-label'),/Complete substituent/);
    assert.match(await page.locator('[data-name-fragment="functionalized:function"]').getAttribute('aria-label'),/Secondary functional group/);
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:function"]'),true);
    assert.deepEqual(selection.atoms,group);assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(group)]);
    assert.deepEqual(errors,[]);assert.deepEqual(networkErrors,[]);assert.deepEqual(unexpected,[]);
  }finally{await page.close()}
},{timeout:90000});

const multipleCases=[
  {smiles:'O=C(O)C(CCO)(CCN)CCC',formula:'C₉H₁₉NO₃',anchor:4,locant:2,
    esName:'ácido 2-(2-aminoetil)-2-(2-hidroxietil)pentanoico',enName:'2-(2-aminoethyl)-2-(2-hydroxyethyl)pentanoic acid',
    parent:[2,4,11,12,13],parentBonds:[[2,4],[4,11],[11,12],[12,13]],principal:[1,2,3],principalBonds:[[1,2],[2,3]],
    branches:[{atoms:[4,8,9,10],bonds:[[4,8],[8,9],[9,10]],function:[9,10]},
      {atoms:[4,5,6,7],bonds:[[4,5],[5,6],[6,7]],function:[6,7]}]},
  {smiles:'O=CC(CCO)(CCN)CCC',formula:'C₉H₁₉NO₂',anchor:3,locant:2,
    esName:'2-(2-aminoetil)-2-(2-hidroxietil)pentanal',enName:'2-(2-aminoethyl)-2-(2-hydroxyethyl)pentanal',
    parent:[2,3,10,11,12],parentBonds:[[2,3],[3,10],[10,11],[11,12]],principal:[1,2],principalBonds:[[1,2]],
    branches:[{atoms:[3,7,8,9],bonds:[[3,7],[7,8],[8,9]],function:[8,9]},
      {atoms:[3,4,5,6],bonds:[[3,4],[4,5],[5,6]],function:[5,6]}]},
  {smiles:'CC(=O)C(CCO)(CCN)CCC',formula:'C₁₀H₂₁NO₂',anchor:4,locant:3,
    esName:'3-(2-aminoetil)-3-(2-hidroxietil)hexan-2-ona',enName:'3-(2-aminoethyl)-3-(2-hydroxyethyl)hexan-2-one',
    parent:[1,2,4,11,12,13],parentBonds:[[1,2],[2,4],[4,11],[11,12],[12,13]],principal:[2,3],principalBonds:[[2,3]],
    branches:[{atoms:[4,8,9,10],bonds:[[4,8],[8,9],[9,10]],function:[9,10]},
      {atoms:[4,5,6,7],bonds:[[4,5],[5,6],[6,7]],function:[6,7]}]},
];
for(const fixture of multipleCases)test(`independent functionalized branches canvas: ${fixture.smiles}`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],networkErrors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>networkErrors.push(r.url()));page.on('response',r=>{if(r.status()>=400)networkErrors.push(`${r.status()} ${r.url()}`)});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin&&!url.pathname.includes('/api/'))return route.continue();
    if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
    if(!['pubchem.ncbi.nlm.nih.gov','www.ebi.ac.uk','en.wikipedia.org','es.wikipedia.org','www.wikidata.org',new URL(base).hostname].includes(url.hostname))unexpected.push(url.origin);
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
  });
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(fixture.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.getByText(fixture.formula,{exact:true}).waitFor({state:'visible'});
    const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0);
    assert.equal(await page.locator('[data-derivation-support="PARTIAL"]').count(),1);
    await page.getByText(fixture.esName,{exact:true}).waitFor({state:'visible'});
    let selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent"]'),true);
    assert.deepEqual(selection.atoms,fixture.parent);
    assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))).sort(),fixture.parentBonds.map(edge).sort());
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:principal"]'));
    assert.deepEqual(selection.atoms,fixture.principal);
    assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))).sort(),fixture.principalBonds.map(edge).sort());
    for(let index=0;index<fixture.branches.length;index++){
      const expected=fixture.branches[index],prefix=`functionalized:branch-${index+1}:`;
      const complete=page.locator(`[data-name-fragment="${prefix}complete"]`),func=page.locator(`[data-name-fragment="${prefix}function"]`);
      assert.equal(await complete.count(),1);assert.equal(await func.count(),1);
      await complete.waitFor({state:'visible',timeout:20000});
      assert.match(await complete.getAttribute('aria-label'),/Sustituyente completo/);
      assert.match(await func.getAttribute('aria-label'),/Función secundaria/);
      let selection=await capture(page,complete,index===1);
      assert.deepEqual(selection.atoms,expected.atoms);
      assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))).sort(),expected.bonds.map(edge).sort());
      selection=await capture(page,func,index===0);
      assert.deepEqual(selection.atoms,expected.function);
      assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(expected.function)]);
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}skeleton"]`));
      assert.deepEqual(selection.atoms,expected.atoms.filter(id=>id!==fixture.anchor&&id!==expected.function[1]));
      assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))).sort(),expected.bonds
        .filter(([a,b])=>a!==fixture.anchor&&b!==fixture.anchor&&a!==expected.function[1]&&b!==expected.function[1]).map(edge).sort());
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}attachment"]`));
      assert.deepEqual(selection.atoms,[...new Set(expected.bonds[0])].sort((a,b)=>a-b));
      assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(expected.bonds[0])]);
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}local-locant"]`));
      assert.deepEqual(selection.locants,[[expected.function[0],'2']]);
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}parent-locant"]`));
      assert.deepEqual(selection.atoms,[fixture.anchor]);
    }
    assert.equal(await page.locator(`.molecule-stage [data-atom-id="${fixture.anchor}"] .number-label`).textContent(),String(fixture.locant));
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.getByText(fixture.enName,{exact:true}).waitFor({state:'visible'});
    for(let index=0;index<fixture.branches.length;index++){
      const prefix=`functionalized:branch-${index+1}:`;
      await page.locator(`[data-name-fragment="${prefix}complete"]`).waitFor({state:'visible'});
      assert.match(await page.locator(`[data-name-fragment="${prefix}complete"]`).getAttribute('aria-label'),/Complete substituent/);
      assert.match(await page.locator(`[data-name-fragment="${prefix}function"]`).getAttribute('aria-label'),/Secondary functional group/);
      const selection=await capture(page,page.locator(`[data-name-fragment="${prefix}function"]`),true);
      assert.deepEqual(selection.atoms,fixture.branches[index].function);
      assert.deepEqual(selection.bonds.map(s=>edge(s.split(':'))),[edge(fixture.branches[index].function)]);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(networkErrors,[]);assert.deepEqual(unexpected,[]);
  }finally{await page.close()}
},{timeout:90000});
