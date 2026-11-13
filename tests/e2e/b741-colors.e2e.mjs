import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../../app/validated-name-derivation.ts';
import {classifyValidatedStructureColors,structuralBondKey} from '../../app/structural-color-classification.ts';

const cases=[
 ['alcohol','Oc1ccccc1','fenol','phenol'],
 ['cyclic-ketone','O=C1CCC(C)CC1','4-metilciclohexanona','4-methylcyclohexanone'],
 ['acid','O=C(O)c1ccccc1','ácido benzoico','benzoic acid'],
 ['ester','COC(=O)c1cc(Br)c(OC)cc1','3-bromo-4-metoxibenzoato de metilo','methyl 3-bromo-4-methoxybenzoate'],
 ['amide','CCN(CC)C(=O)c1cc(F)cc(F)c1','N,N-dietil-3,5-difluorobenzamida','N,N-diethyl-3,5-difluorobenzamide'],
 ['branched-alkane','CC(C)CC','2-metilbutano','2-methylbutane'],
];
const out='reports/b741/colors-e2e', reports=[];let server,browser,origin;
before(async()=>{await mkdir(out,{recursive:true});server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});});
after(async()=>{await writeFile(`${out}/results.json`,JSON.stringify({browser:browser?.version(),cases:reports},null,2)+'\n');await browser?.close();await server?.close();});
for(const [id,smiles,es,en] of cases)test(`B7.4.1 color renderer: ${id}`,async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),report={id,smiles,status:'RUNNING',observations:[]};reports.push(report);
 try{
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin&&!u.pathname.startsWith('/api/'))return route.continue();if(u.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});if(u.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});});
  await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.getByText(es,{exact:true}).first().waitFor({timeout:30000});
  const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);const proof=reconcileSystematicName(parsed.molecule,es),colors=proof&&classifyValidatedStructureColors(parsed.molecule,proof);
  for(const view of ['Vista semidesarrollada','Vista esquelética o de líneas']){
   await page.getByTitle(view,{exact:true}).click();
   if(colors){for(const [atom,category] of colors.atoms)assert.equal(await page.locator(`.molecule-stage [data-atom-id="${atom}"]`).getAttribute('data-structural-category'),category);
    for(const [a,b] of parsed.molecule.bonds){const actual=page.locator(`.molecule-stage [data-bond-a="${a}"][data-bond-b="${b}"]`);assert.equal(await actual.getAttribute('data-structural-category'),colors.bonds.get(structuralBondKey(a,b)));}
    assert.ok(await page.locator('.stage-legend').innerText().then(s=>s.includes('Función principal')));
   }else assert.equal(await page.locator('.molecule-stage [data-structural-category="functional"]').count(),0);
   const filename=`${out}/${id}-${view.startsWith('Vista semi')?'semi':'skeletal'}.png`;await page.locator('.molecule-stage').screenshot({path:filename});report.observations.push({view,proof:!!proof,screenshot:filename});
  }
  await page.getByRole('button',{name:'English',exact:true}).click();await page.getByText(en,{exact:true}).first().waitFor({timeout:30000});if(colors)assert.match(await page.locator('.stage-legend').innerText(),/Principal function/);
  const englishProof=reconcileSystematicName(parsed.molecule,en),englishColors=englishProof&&classifyValidatedStructureColors(parsed.molecule,englishProof);
  if(englishColors){for(const [atom,category] of englishColors.atoms)assert.equal(await page.locator(`.molecule-stage [data-atom-id="${atom}"]`).getAttribute('data-structural-category'),category);
   assert.match(await page.locator('.stage-legend').innerText(),/Principal function/);
   const swatch=await page.locator('.stage-legend .functional-key').evaluate(n=>getComputedStyle(n).backgroundColor);
   const bond=page.locator('.molecule-stage .functional-bond').first();assert.equal(await bond.evaluate(n=>getComputedStyle(n).stroke),swatch);
  }
  const filename=`${out}/${id}-english-skeletal.png`;await page.locator('.molecule-stage').screenshot({path:filename});report.observations.push({view:'English skeletal',proof:!!englishProof,screenshot:filename});
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e);throw e;}finally{await page.close();}
},{timeout:120000});
