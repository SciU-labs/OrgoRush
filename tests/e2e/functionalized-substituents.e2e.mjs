import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.ORGORUSH_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.ORGORUSH_PLAYWRIGHT_MODULE)).href : 'playwright');
let server,browser,base;
const diagnosticsRoot=resolve('outputs/functionalized-e2e/deterministic');
before(async()=>{
  await mkdir(diagnosticsRoot,{recursive:true});
  try{
    server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
    await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`;
    browser=await chromium.launch({headless:true,timeout:20000,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
      ? {executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}: {})});
  }catch(error){
    await writeFile(resolve(diagnosticsRoot,'suite-setup-failure.json'),JSON.stringify({case:'suite setup',
      control:'Vite startup or Playwright Chromium launch',expected:'Vite server and headless Chromium available',
      observed:safeMessage(error?.message??String(error)),exception:{name:error?.name??'Error',message:safeMessage(error?.message??error)}},null,2));
    throw error;
  }
},{timeout:60000});
after(async()=>{await browser?.close();await server?.close()});
const edge=([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':');
const safeUrl=value=>{try{const url=new URL(value);return `${url.origin}${url.pathname}`}catch{return '[invalid URL]'}};
const safeMessage=value=>String(value).replace(/https?:\/\/[^\s)]+/g,match=>safeUrl(match))
  .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g,'[user-path-redacted]')
  .replace(/\b(token|password|authorization)=?[^\s&]*/ig,'$1=[redacted]');
async function saveFailureDiagnostics(page,{caseId,control,expected,observed,errors,networkErrors,unexpected},error){
  const payload={case:caseId,control:control??'case setup or interaction',expected:expected??null,observed:observed??null,
    pageErrors:errors.map(safeMessage),networkErrors:networkErrors.map(item=>typeof item==='string'?safeUrl(item):{
      ...item,failure:item.failure?safeMessage(item.failure):item.failure}),
    unexpectedOrigins:[...new Set(unexpected)],exception:{name:error?.name??'Error',message:safeMessage(error?.message??error)}};
  try{await page.screenshot({path:resolve(diagnosticsRoot,`${caseId}-failure.png`),fullPage:true,animations:'disabled'})}catch{}
  try{await writeFile(resolve(diagnosticsRoot,`${caseId}-failure.json`),JSON.stringify(payload,null,2))}catch{}
}
function assertObserved(diagnostics,control,observed,expected){
  diagnostics.control=control;diagnostics.expected=expected;diagnostics.observed=observed;
  assert.deepEqual(observed,expected,`${control}: observed graph/UI evidence differs from fixture`);
}
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
  ['O=C(O)C(C(CO)C)CCCC',[4,5,6,7,8],[[4,5],[5,6],[6,7],[5,8]],[6,7],[2,4,9,10,11,12],4,2,[1,2,3],undefined,{atoms:[5,8],bonds:[[5,8]],locantAtom:5,skeletonAtoms:[5,6],skeletonBonds:[[5,6]]},[[1,2],[2,3]]],
  ['O=CC(C(CN)C)CCCC',[3,4,5,6,7],[[3,4],[4,5],[5,6],[4,7]],[5,6],[2,3,8,9,10,11],3,2,[1,2],undefined,{atoms:[4,7],bonds:[[4,7]],locantAtom:4,skeletonAtoms:[4,5],skeletonBonds:[[4,5]]}],
  ['CC(=O)C(C(CO)C)CCCC',[4,5,6,7,8],[[4,5],[5,6],[6,7],[5,8]],[6,7],[1,2,4,9,10,11,12],4,3,[2,3],undefined,{atoms:[5,8],bonds:[[5,8]],locantAtom:5,skeletonAtoms:[5,6],skeletonBonds:[[5,6]]}],
  ['O=C(O)C(C(C)(C)CO)CCCC',[4,5,6,7,8,9],[[4,5],[5,6],[5,7],[5,8],[8,9]],[8,9],[2,4,10,11,12,13],4,2,[1,2,3],undefined,
    {atoms:[5,6,7],bonds:[[5,6],[5,7]],locantAtom:5,locants:[[5,1],[5,1]],skeletonAtoms:[5,8],skeletonBonds:[[5,8]]},[[1,2],[2,3]]],
  ['O=C(O)C(C(C)C(C)CO)CCCC',[4,5,6,7,8,9,10],[[4,5],[5,6],[5,7],[7,8],[7,9],[9,10]],[9,10],[2,4,11,12,13,14],4,2,[1,2,3],undefined,
    {atoms:[5,6,7,8],bonds:[[5,6],[7,8]],locantAtom:5,locants:[[5,1],[7,2]],skeletonAtoms:[5,7,9],skeletonBonds:[[5,7],[7,9]]},[[1,2],[2,3]],3],
  ['O=CC(C(C)(C)CN)CCCC',[3,4,5,6,7,8],[[3,4],[4,5],[4,6],[4,7],[7,8]],[7,8],[2,3,9,10,11,12],3,2,[1,2],undefined,
    {atoms:[4,5,6],bonds:[[4,5],[4,6]],locantAtom:4,locants:[[4,1],[4,1]],skeletonAtoms:[4,7],skeletonBonds:[[4,7]]}],
];
for(const [caseIndex,[smiles,atoms,bonds,group,parent,anchor=4,parentNumber=2,principal,otherOH,internalBranch,principalEdges,secondaryLocant=2]] of cases.entries())test(`functionalized branch canvas: ${smiles}`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],networkErrors=[],unexpected=[];
  const diagnostics={caseId:`single-${String(caseIndex+1).padStart(2,'0')}`,control:'page setup',expected:null,observed:null};
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>networkErrors.push({url:safeUrl(r.url()),method:r.method(),failure:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)networkErrors.push({url:safeUrl(r.url()),method:r.request().method(),status:r.status()})});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin&&!url.pathname.includes('/api/'))return route.continue();
    if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
    if(/^(en|es)\.wikipedia\.org$/.test(url.hostname)&&url.pathname==='/w/api.php')
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({query:{pages:{}}})});
    if(url.hostname==='www.wikidata.org'&&url.pathname==='/w/api.php')
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({search:[]})});
    if(!['pubchem.ncbi.nlm.nih.gov','www.ebi.ac.uk','en.wikipedia.org','es.wikipedia.org','www.wikidata.org',new URL(base).hostname].includes(url.hostname))unexpected.push(url.origin);
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
  });
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    diagnostics.control='import deterministic SMILES fixture';diagnostics.expected={submitted:smiles,accepted:true};
    await page.locator('#smiles-text-input').fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    const help=page.locator('.reasoning-visibility-button');
    if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    const complete=page.locator('[data-name-fragment="functionalized:complete"]');
    await complete.waitFor({state:'visible',timeout:20000});
    assert.match(await complete.getAttribute('aria-label'),/Sustituyente completo/);
    assert.match(await page.locator('[data-name-fragment="functionalized:function"]').getAttribute('aria-label'),/Función secundaria/);
    diagnostics.control='complete functionalized branch';diagnostics.expected={atoms,bonds:bonds.map(edge).sort()};
    let selection=await capture(page,complete);
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
    diagnostics.control='parent-chain target';diagnostics.expected={atoms:parent};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent"]'));
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms},diagnostics.expected);
    diagnostics.control='branch-to-parent attachment';diagnostics.expected={atoms:[...bonds[0]].sort((a,b)=>a-b),bonds:[edge(bonds[0])]};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:attachment"]'));
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    if(principal){
      diagnostics.control='principal functional group';diagnostics.expected={atoms:principal,bonds:(principalEdges??[principal]).map(edge)};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:principal"]'));
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    }
    if(parentNumber===3){
      diagnostics.control='principal carbonyl locant';diagnostics.expected={atoms:[2]};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:principal-locant"]'),true);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms},diagnostics.expected);
      assert.equal(await page.locator('.molecule-stage [data-atom-id="2"] .number-label').textContent(),'2');
    }
    diagnostics.control='secondary functional group';diagnostics.expected={atoms:group,bonds:[edge(group)]};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:function"]'),true);
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    if(smiles===cases[0][0]){
      diagnostics.control='parent hydroxyl';diagnostics.expected={atoms:[6,7],bonds:['6:7']};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent-function-4"]'));
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    }
    if(otherOH){
      diagnostics.control='other parent hydroxyl';diagnostics.expected={atoms:otherOH,bonds:[edge(otherOH)]};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent-function-4"]'));
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    }
    diagnostics.control='substituent internal locant';diagnostics.expected={locants:[[group[0],String(secondaryLocant)]]};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:local-locant"]'));
    assertObserved(diagnostics,diagnostics.control,{locants:selection.locants},diagnostics.expected);
    diagnostics.control='parent attachment locant';diagnostics.expected={atoms:[anchor]};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent-locant"]'));
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms},diagnostics.expected);
    if(internalBranch){
      const branchLocants=internalBranch.locants??[[internalBranch.locantAtom,1]];
      diagnostics.control='internal carbon branch';diagnostics.expected={atoms:[...internalBranch.atoms].sort((a,b)=>a-b),bonds:internalBranch.bonds.map(edge).sort()};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:internal-branch"]'));
      assert.match(await page.locator('[data-name-fragment="functionalized:internal-branch"]').getAttribute('aria-label'),
        branchLocants.length===1?/Ramificación metilo interna/:/Dos ramificaciones metilo internas/);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
      diagnostics.control='substituent carbon skeleton';diagnostics.expected={atoms:internalBranch.skeletonAtoms,bonds:internalBranch.skeletonBonds.map(edge)};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:skeleton"]'));
      assert.match(await page.locator('[data-name-fragment="functionalized:skeleton"]').getAttribute('aria-label'),/Esqueleto carbonado del sustituyente/);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},
        {atoms:diagnostics.expected.atoms,bonds:[...diagnostics.expected.bonds].sort()});
      const locantControls=page.locator('[data-name-fragment^="functionalized:branch-locant"]');
      diagnostics.control='internal branch locant control count';diagnostics.expected={count:branchLocants.length===2
        &&branchLocants[0][1]!==branchLocants[1][1]?2:1};
      assertObserved(diagnostics,diagnostics.control,{count:await locantControls.count()},diagnostics.expected);
      const expectedLocants=branchLocants.length===2&&branchLocants[0][1]===branchLocants[1][1]
        ?[branchLocants[0]]:branchLocants;
      for(let index=0;index<expectedLocants.length;index++){
        diagnostics.control=`internal branch locant ${index+1} by keyboard`;
        diagnostics.expected={locants:[[expectedLocants[index][0],String(expectedLocants[index][1])]]};
        selection=await capture(page,locantControls.nth(index),true);
        assertObserved(diagnostics,diagnostics.control,{locants:selection.locants},diagnostics.expected);
      }
    }
    // Existing parent badges suppress an identical transient badge.
    assert.equal(await page.locator(`.molecule-stage [data-atom-id="${anchor}"] .number-label`).textContent(),String(parentNumber));
    assert.equal(await page.locator('[data-derivation-support="FULL"]').count(),0);
    assert.equal(await page.locator('[data-derivation-support="PARTIAL"]').count(),1);
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.locator('[data-name-fragment="functionalized:complete"]').waitFor({state:'visible'});
    assert.match(await page.locator('[data-name-fragment="functionalized:complete"]').getAttribute('aria-label'),/Complete substituent/);
    assert.match(await page.locator('[data-name-fragment="functionalized:function"]').getAttribute('aria-label'),/Secondary functional group/);
    if(internalBranch){
      const branchLocants=internalBranch.locants??[[internalBranch.locantAtom,1]];
      assert.match(await page.locator('[data-name-fragment="functionalized:internal-branch"]').getAttribute('aria-label'),
        branchLocants.length===1?/Internal methyl branch/:/Two internal methyl branches/);
      assert.match(await page.locator('[data-name-fragment="functionalized:skeleton"]').getAttribute('aria-label'),/Substituent carbon skeleton/);
      diagnostics.control='internal branch target after language switch';diagnostics.expected={atoms:[...internalBranch.atoms].sort((a,b)=>a-b),bonds:internalBranch.bonds.map(edge).sort()};
      selection=await capture(page,page.locator('[data-name-fragment="functionalized:internal-branch"]'),true);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
    }
    diagnostics.control='secondary function after language switch';diagnostics.expected={atoms:group,bonds:[edge(group)]};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:function"]'),true);
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    diagnostics.control='console, network and external-origin isolation';
    assertObserved(diagnostics,diagnostics.control,{pageErrors:errors,networkErrors,unexpectedOrigins:unexpected},
      {pageErrors:[],networkErrors:[],unexpectedOrigins:[]});
  }catch(error){await saveFailureDiagnostics(page,{...diagnostics,errors,networkErrors,unexpected},error);throw error}
  finally{await page.close()}
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
for(const [fixtureIndex,fixture] of multipleCases.entries())test(`independent functionalized branches canvas: ${fixture.smiles}`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],networkErrors=[],unexpected=[];
  const diagnostics={caseId:`multiple-${['acid','aldehyde','ketone'][fixtureIndex]}`,control:'page setup',expected:null,observed:null};
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>networkErrors.push({url:safeUrl(r.url()),method:r.method(),failure:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)networkErrors.push({url:safeUrl(r.url()),method:r.request().method(),status:r.status()})});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===new URL(base).origin&&!url.pathname.includes('/api/'))return route.continue();
    if(url.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(url.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});
    if(/^(en|es)\.wikipedia\.org$/.test(url.hostname)&&url.pathname==='/w/api.php')
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({query:{pages:{}}})});
    if(url.hostname==='www.wikidata.org'&&url.pathname==='/w/api.php')
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({search:[]})});
    if(!['pubchem.ncbi.nlm.nih.gov','www.ebi.ac.uk','en.wikipedia.org','es.wikipedia.org','www.wikidata.org',new URL(base).hostname].includes(url.hostname))unexpected.push(url.origin);
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
  });
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
    await page.getByRole('button',{name:'Español',exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    diagnostics.control='import deterministic two-branch SMILES';diagnostics.expected={submitted:fixture.smiles,accepted:true};
    await page.locator('#smiles-text-input').fill(fixture.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    diagnostics.control='molecular identity formula';diagnostics.expected={visibleFormulaCount:1};
    diagnostics.observed={visibleFormulaCount:await page.getByText(fixture.formula,{exact:true}).count()};
    await page.getByText(fixture.formula,{exact:true}).waitFor({state:'visible'});
    assertObserved(diagnostics,diagnostics.control,{visibleFormulaCount:await page.getByText(fixture.formula,{exact:true}).count()},diagnostics.expected);
    const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    diagnostics.control='validated reasoning support remains PARTIAL';diagnostics.expected={FULL:0,PARTIAL:1};
    assertObserved(diagnostics,diagnostics.control,{FULL:await page.locator('[data-derivation-support="FULL"]').count(),
      PARTIAL:await page.locator('[data-derivation-support="PARTIAL"]').count()},diagnostics.expected);
    diagnostics.control='Spanish systematic name';diagnostics.expected={visibleName:true};
    const spanishName=page.getByText(fixture.esName,{exact:true}),spanishNameCount=await spanishName.count();
    diagnostics.observed={visibleName:spanishNameCount>0,matchingElements:spanishNameCount};
    await spanishName.first().waitFor({state:'visible'});
    assert.ok(diagnostics.observed.visibleName,`${diagnostics.control} is visible`);
    diagnostics.control='parent chain';diagnostics.expected={atoms:fixture.parent,bonds:fixture.parentBonds.map(edge).sort()};
    let selection=await capture(page,page.locator('[data-name-fragment="functionalized:parent"]'),true);
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
    diagnostics.control='principal functional group';diagnostics.expected={atoms:fixture.principal,bonds:fixture.principalBonds.map(edge).sort()};
    selection=await capture(page,page.locator('[data-name-fragment="functionalized:principal"]'));
    assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
    for(let index=0;index<fixture.branches.length;index++){
      const expected=fixture.branches[index],prefix=`functionalized:branch-${index+1}:`;
      const complete=page.locator(`[data-name-fragment="${prefix}complete"]`),func=page.locator(`[data-name-fragment="${prefix}function"]`);
      diagnostics.control=`branch ${index+1} control multiplicity`;diagnostics.expected={complete:1,function:1};
      assertObserved(diagnostics,diagnostics.control,{complete:await complete.count(),function:await func.count()},diagnostics.expected);
      await complete.waitFor({state:'visible',timeout:20000});
      diagnostics.control=`branch ${index+1} accessible labels`;diagnostics.expected={complete:/Sustituyente completo/.source,function:/Función secundaria/.source};
      diagnostics.observed={complete:await complete.getAttribute('aria-label'),function:await func.getAttribute('aria-label')};
      assert.match(diagnostics.observed.complete,/Sustituyente completo/);assert.match(diagnostics.observed.function,/Función secundaria/);
      diagnostics.control=`branch ${index+1} complete region`;diagnostics.expected={atoms:expected.atoms,bonds:expected.bonds.map(edge).sort()};
      let selection=await capture(page,complete,index===1);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
      diagnostics.control=`branch ${index+1} secondary function`;diagnostics.expected={atoms:expected.function,bonds:[edge(expected.function)]};
      selection=await capture(page,func,index===0);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
      diagnostics.control=`branch ${index+1} carbon skeleton`;diagnostics.expected={
        atoms:expected.atoms.filter(id=>id!==fixture.anchor&&id!==expected.function[1]),
        bonds:expected.bonds.filter(([a,b])=>a!==fixture.anchor&&b!==fixture.anchor&&a!==expected.function[1]&&b!==expected.function[1]).map(edge).sort()};
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}skeleton"]`));
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':'))).sort()},diagnostics.expected);
      diagnostics.control=`branch ${index+1} attachment bond`;diagnostics.expected={atoms:[...new Set(expected.bonds[0])].sort((a,b)=>a-b),bonds:[edge(expected.bonds[0])]};
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}attachment"]`));
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
      diagnostics.control=`branch ${index+1} internal locant`;diagnostics.expected={locants:[[expected.function[0],'2']]};
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}local-locant"]`));
      assertObserved(diagnostics,diagnostics.control,{locants:selection.locants},diagnostics.expected);
      diagnostics.control=`branch ${index+1} parent locant`;diagnostics.expected={atoms:[fixture.anchor]};
      selection=await capture(page,page.locator(`[data-name-fragment="${prefix}parent-locant"]`));
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms},diagnostics.expected);
    }
    diagnostics.control='external branch locant display';diagnostics.expected={atom:fixture.anchor,locant:String(fixture.locant)};
    diagnostics.observed={atom:fixture.anchor,locant:await page.locator(`.molecule-stage [data-atom-id="${fixture.anchor}"] .number-label`).textContent()};
    assertObserved(diagnostics,diagnostics.control,diagnostics.observed,diagnostics.expected);
    await page.getByRole('button',{name:'English',exact:true}).click();
    diagnostics.control='English name after language switch';diagnostics.expected={visibleName:true};
    const englishName=page.getByText(fixture.enName,{exact:true}),englishNameCount=await englishName.count();
    diagnostics.observed={visibleName:englishNameCount>0,matchingElements:englishNameCount};
    await englishName.first().waitFor({state:'visible'});
    assert.ok(diagnostics.observed.visibleName,`${diagnostics.control} is visible`);
    for(let index=0;index<fixture.branches.length;index++){
      const prefix=`functionalized:branch-${index+1}:`;
      await page.locator(`[data-name-fragment="${prefix}complete"]`).waitFor({state:'visible'});
      diagnostics.control=`branch ${index+1} accessible labels in English`;diagnostics.expected={complete:/Complete substituent/.source,function:/Secondary functional group/.source};
      diagnostics.observed={complete:await page.locator(`[data-name-fragment="${prefix}complete"]`).getAttribute('aria-label'),
        function:await page.locator(`[data-name-fragment="${prefix}function"]`).getAttribute('aria-label')};
      assert.match(diagnostics.observed.complete,/Complete substituent/);assert.match(diagnostics.observed.function,/Secondary functional group/);
      assert.match(await page.locator(`[data-name-fragment="${prefix}complete"]`).getAttribute('aria-label'),/Complete substituent/);
      assert.match(await page.locator(`[data-name-fragment="${prefix}function"]`).getAttribute('aria-label'),/Secondary functional group/);
      diagnostics.control=`branch ${index+1} keyboard function target in English`;diagnostics.expected={
        atoms:fixture.branches[index].function,bonds:[edge(fixture.branches[index].function)]};
      const selection=await capture(page,page.locator(`[data-name-fragment="${prefix}function"]`),true);
      assertObserved(diagnostics,diagnostics.control,{atoms:selection.atoms,bonds:selection.bonds.map(s=>edge(s.split(':')))},diagnostics.expected);
    }
    diagnostics.control='console, network and external-origin isolation';
    assertObserved(diagnostics,diagnostics.control,{pageErrors:errors,networkErrors,unexpectedOrigins:unexpected},
      {pageErrors:[],networkErrors:[],unexpectedOrigins:[]});
  }catch(error){await saveFailureDiagnostics(page,{...diagnostics,errors,networkErrors,unexpected},error);throw error}
  finally{await page.close()}
},{timeout:90000});
