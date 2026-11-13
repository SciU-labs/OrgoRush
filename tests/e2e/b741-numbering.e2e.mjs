import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../../app/validated-name-derivation.ts';
import {buildValidatedVisualNumbering,buildBranchCountingGuides} from '../../app/visual-numbering.ts';

const cases=[
 ['nitro','Cc1ccccc1[N+](=O)[O-]','1-metil-2-nitrobenceno','1-methyl-2-nitrobenzene'],
 ['n-ethyl','CCNC(=O)c1c(Br)cc(C)cc1','2-bromo-N-etil-4-metilbenzamida','2-bromo-N-ethyl-4-methylbenzamide'],
 ['nn-diethyl','CCN(CC)C(=O)c1cc(F)cc(F)c1','N,N-dietil-3,5-difluorobenzamida','N,N-diethyl-3,5-difluorobenzamide'],
 ['ester','COC(=O)c1cc(Br)c(OC)cc1','3-bromo-4-metoxibenzoato de metilo','methyl 3-bromo-4-methoxybenzoate'],
 ['branched','CC(C)CC','2-metilbutano','2-methylbutane'],['alkene','CC=CC','but-2-eno','but-2-ene'],
 ['ketone','O=C1CCC(C)CC1','4-metilciclohexanona','4-methylcyclohexanone'],['alcohol','CCCO','propan-1-ol','propan-1-ol'],
 ['aldehyde','CCC=O','propanal','propanal'],
];
const out=process.env.B741_NUMBERING_OUT_DIR??'reports/b741/numbering-e2e',reports=[];let server,browser,origin;
before(async()=>{await mkdir(out,{recursive:true});server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});});
after(async()=>{await writeFile(`${out}/results.json`,JSON.stringify({browser:browser?.version(),cases:reports},null,2)+'\n');await browser?.close();await server?.close();});
for(const [id,smiles,es,en] of cases)test(`B7.4.1 numbering: ${id}`,async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],report={id,smiles,status:'RUNNING',observations:[],errors};reports.push(report);
 try{
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin&&!u.pathname.startsWith('/api/'))return route.continue();if(u.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});if(u.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});});
  await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.getByText(es,{exact:true}).first().waitFor({timeout:30000});
  await page.getByRole('button',{name:'Abrir configuración'}).click();const numberingToggle=page.getByLabel('Numerar carbonos');await numberingToggle.uncheck({force:true});await numberingToggle.check({force:true});assert.equal(await numberingToggle.isChecked(),true);await page.getByRole('button',{name:'Cerrar configuración'}).last().click();
  const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);const graph=parsed.molecule;
  for(const [language,name] of [['es',es],['en',en],['es',es]]){
   if(language==='en')await page.getByRole('button',{name:'English',exact:true}).click();else if(report.observations.length)await page.getByRole('button',{name:'Español',exact:true}).click();
   await page.getByText(name,{exact:true}).first().waitFor({timeout:30000});const proof=reconcileSystematicName(graph,name),numbering=proof&&buildValidatedVisualNumbering(graph,proof);
   for(const view of ['semi','skeletal']){
    await page.locator('.view-mode-switch button').nth(view==='semi'?0:2).click();
    const labels=await page.locator('.molecule-stage [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.atomId,n.querySelector('.number-label')?.textContent??null])));
    if(numbering)for(const [atom,locant] of numbering)assert.equal(labels[atom],String(locant),`${id} ${language} ${view} atom ${atom}`);
    const file=`${out}/${id}-${language}-${view}.png`;if(language==='es')await page.locator('.molecule-stage').screenshot({path:file});
    report.observations.push({language,view,proof:!!proof,numbering:labels,...(language==='es'?{screenshot:file}:{})});
   }
   if(!graph.rings?.length){await page.locator('.view-mode-switch button').nth(1).click();
    const labels=await page.locator('.molecule-stage .condensed-atom[data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.atomId,n.querySelector('.condensed-locant')?.textContent??null])));
    if(numbering)for(const [atom,locant] of numbering)assert.equal(labels[atom],String(locant),`${id} ${language} condensed atom ${atom}`);
    const file=`${out}/${id}-${language}-condensed.png`;if(language==='es')await page.locator('.molecule-stage').screenshot({path:file});report.observations.push({language,view:'condensed',proof:!!proof,numbering:labels,...(language==='es'?{screenshot:file}:{})});
   }
   if(id==='nn-diethyl'&&language==='es'){
    const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
    const guides=buildBranchCountingGuides(graph,proof);assert.equal(guides.length,2);
    for(const guide of guides){const button=page.locator(`button[data-branch-count="${guide.componentId}"]`).first();assert.equal(await button.count(),1);await button.click();
     const overlay=page.locator('.reasoning-visual-overlay');for(const [atom,locant] of guide.locants)assert.equal(await overlay.locator(`[data-reasoning-locant="${atom}"] text`).textContent(),locant);
     await page.locator('.molecule-stage').screenshot({path:`${out}/${id}-${guide.componentId}.png`});}
   }
  }
  assert.deepEqual(errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e);throw e;}finally{await page.close()}
},{timeout:120000});
