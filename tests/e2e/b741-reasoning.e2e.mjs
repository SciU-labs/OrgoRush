import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../../app/validated-name-derivation.ts';
import {buildValidatedVisualNumbering,buildBranchCountingGuides} from '../../app/visual-numbering.ts';
import {buildValidatedPriorityReasoning} from '../../app/reasoning-derivation-adapter.ts';
import {reasoningFragmentId} from '../../app/reasoning-visual-targets.ts';
import {classifyValidatedStructureColors,structuralBondKey} from '../../app/structural-color-classification.ts';

const cases=[
 ['nitro','Cc1ccccc1[N+](=O)[O-]','1-metil-2-nitrobenceno','1-methyl-2-nitrobenzene'],
 ['n-ethyl','CCNC(=O)c1c(Br)cc(C)cc1','2-bromo-N-etil-4-metilbenzamida','2-bromo-N-ethyl-4-methylbenzamide'],
 ['nn-diethyl','CCN(CC)C(=O)c1cc(F)cc(F)c1','N,N-dietil-3,5-difluorobenzamida','N,N-diethyl-3,5-difluorobenzamide'],
 ['ester','COC(=O)c1cc(Br)c(OC)cc1','3-bromo-4-metoxibenzoato de metilo','methyl 3-bromo-4-methoxybenzoate'],
 ['branched','CC(C)CC','2-metilbutano','2-methylbutane'],['alkene','CC=CC','but-2-eno','but-2-ene'],
 ['ketone','O=C1CCC(C)CC1','4-metilciclohexanona','4-methylcyclohexanone'],['alcohol','CCCO','propan-1-ol','propan-1-ol'],
 ['aldehyde','CCC=O','propanal','propanal'],
 ['nitrile','N#Cc1ccc(F)c(F)c1','3,4-difluorobenzonitrilo','3,4-difluorobenzonitrile'],
 ['n-benzyl','O=C(NCc1ccccc1)c1ccccc1','N-bencilbenzamida','N-benzylbenzamide'],
 ['aromatic-aldehyde','CCOc1c(Cl)cc(Cl)cc1C=O','3,5-dicloro-2-etoxibenzaldehído','3,5-dichloro-2-ethoxybenzaldehyde'],
 ['pyridine','n1ccccc1','piridina','pyridine'],
];
const out=process.env.B741_REASONING_OUT_DIR??'reports/b741/reasoning-e2e',reports=[];let server,browser,origin;
const ordered=values=>[...new Set(values)].sort((a,b)=>a-b);
const edge=([a,b])=>[Number(a),Number(b)].sort((a,b)=>a-b).join(':');
async function checkSelection(page,button,target){
 const expected={atoms:ordered(target.atomIds),bonds:[...new Set(target.bondIds.map(edge))].sort()};
 const selector=await button.evaluate(node=>`#${node.closest('[id^="iupac-reasoning-step-"]').id} `+(node.dataset.nameFragment?`button[data-name-fragment=${JSON.stringify(node.dataset.nameFragment)}]`:'button.reasoning-step-number'));
 await page.evaluate(({expected,selector})=>{let finish,timer,observer,last=null;window.__b741Selection=new Promise(resolve=>{finish=resolve});
  const done=value=>{clearTimeout(timer);observer?.disconnect();finish(value)};
  const observe=()=>{const stage=document.querySelector('.molecule-stage');if(!stage?.querySelector('.reasoning-visual-overlay'))return;
   const atoms=[...new Set([...stage.querySelectorAll('.reasoning-visual-overlay [data-reasoning-atom]')].map(n=>Number(n.dataset.reasoningAtom)))].sort((a,b)=>a-b);
   const bonds=[...new Set([...stage.querySelectorAll('.reasoning-visual-overlay [data-reasoning-bond]')].map(n=>n.dataset.reasoningBond.split(':').map(Number).sort((a,b)=>a-b).join(':')))].sort();
   const pressed=document.querySelector(selector)?.getAttribute('aria-pressed');last={atoms,bonds,pressed};
   if(pressed==='true' && JSON.stringify({atoms,bonds})===JSON.stringify(expected))done({ok:true});};
  observer=new MutationObserver(observe);observer.observe(document.body,{subtree:true,childList:true,attributes:true});timer=setTimeout(()=>done({ok:false,last,expected,selector}),30000);
 },{expected,selector});
 await button.click({timeout:15000});
 const result=await page.evaluate(()=>window.__b741Selection);assert.equal(result.ok,true,JSON.stringify(result));
}
before(async()=>{await mkdir(out,{recursive:true});server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});});
after(async()=>{await writeFile(`${out}/results.json`,JSON.stringify({browser:browser?.version(),cases:reports},null,2)+'\n');await browser?.close();await server?.close();});
for(const [id,smiles,es,en] of cases)test(`B7.4.1 numbering: ${id}`,async()=>{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],report={id,smiles,status:'RUNNING',observations:[],errors};reports.push(report);
 try{
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin&&!u.pathname.startsWith('/api/'))return route.continue();if(u.hostname==='www.googletagmanager.com')return route.fulfill({status:200,contentType:'application/javascript',body:''});if(u.hostname==='fonts.gstatic.com')return route.fulfill({status:204,body:''});return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});});
  await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[aria-controls="smiles-interop-panel"]').click();await page.locator('#smiles-text-input').fill(smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();await page.getByText(es,{exact:true}).first().waitFor({timeout:30000});
  await page.locator('[aria-controls="smiles-interop-panel"]').click();
  await page.getByRole('button',{name:'Abrir configuración'}).click();const numberingToggle=page.getByLabel('Numerar carbonos');await numberingToggle.uncheck({force:true});await numberingToggle.check({force:true});assert.equal(await numberingToggle.isChecked(),true);await page.getByRole('button',{name:'Cerrar configuración'}).last().click();
  const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);const graph=parsed.molecule;
  for(const [language,name] of [['es',es],['en',en],['es',es]]){
   if(language==='en')await page.getByRole('button',{name:'English',exact:true}).click();else if(report.observations.length)await page.getByRole('button',{name:'Español',exact:true}).click();
   await page.getByText(name,{exact:true}).first().waitFor({timeout:30000});const proof=reconcileSystematicName(graph,name),numbering=proof&&buildValidatedVisualNumbering(graph,proof);
   const help=page.locator('.reasoning-visibility-button');if(await help.getAttribute('aria-expanded')!=='true')await help.click();
   const panel=page.locator('#iupac-reasoning-content');await panel.waitFor({state:'visible'});
   if(proof && report.observations.filter(item=>item.kind==='reasoning').length<2){
    const model=buildValidatedPriorityReasoning({derivation:proof,graph,language,activeName:name});let checks=0,parentLocants=0;const seen=new Set();
    if(model.steps.length)await panel.getByText(model.steps[0].title,{exact:true}).first().waitFor({state:'visible',timeout:30000});
    for(const step of model.steps)for(const fragment of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]){
     const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];if(!target||seen.has(fragment.semanticId))continue;
     if(fragment.semanticId?.startsWith('locant:parent:') && parentLocants++>=2)continue;seen.add(fragment.semanticId);
     const button=panel.locator(`#iupac-reasoning-step-${step.number} button[data-name-fragment=${JSON.stringify(fragment.semanticId)}]`);
     assert.equal(await button.count(),1,`${step.title}: ${fragment.semanticId}`);try{await checkSelection(page,button,target);}catch(e){throw new Error(`${language} ${step.title} ${fragment.semanticId}: ${String(e)}`);}checks++;
    }
    const final=model.steps.find(s=>s.title===(language==='es'?'Construcción del nombre':'Constructing the name'));
    if(final?.target){await checkSelection(page,panel.locator(`#iupac-reasoning-step-${final.number} button.reasoning-step-number`),final.target);checks++;}
    assert.ok(checks>0);report.observations.push({kind:'reasoning',language,checks,proof:true});
    await page.screenshot({path:`${out}/${id}-${language}-reasoning.png`,fullPage:true});
   }else if(!proof){const buttons=panel.locator('button[data-name-fragment]');let activated=false;
    if(await buttons.count()){await buttons.first().click({timeout:5000});activated=await page.locator('.molecule-stage .reasoning-visual-overlay').count()>0;}
    report.observations.push({kind:'reasoning',language,proof:false,controls:await buttons.count(),activated});}
   for(const view of ['semi','skeletal']){
    await page.locator('.view-mode-switch button').nth(view==='semi'?0:2).click();
    const labels=await page.locator('.molecule-stage [data-atom-id]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.atomId,n.querySelector('.number-label')?.textContent??null])));
    if(numbering)for(const [atom,locant] of numbering)assert.equal(labels[atom],String(locant),`${id} ${language} ${view} atom ${atom}`);
    if(proof){const colors=classifyValidatedStructureColors(graph,proof);assert.ok(colors);
     const atoms=await page.locator('.molecule-nodes-layer [data-atom-id]').evaluateAll(nodes=>nodes.map(n=>({id:Number(n.dataset.atomId),classes:[...n.classList]})));
     for(const [atom,category] of colors.atoms)assert.ok(atoms.some(n=>n.id===atom&&n.classes.includes(`structural-${category}`)),`${id} ${language} ${view} color atom ${atom}`);
     const actual=await page.locator('.molecule-bonds-layer [data-bond-a][data-bond-b]').evaluateAll(nodes=>nodes.map(n=>({a:Number(n.dataset.bondA),b:Number(n.dataset.bondB),category:n.dataset.structuralCategory})));
     for(const bond of actual)assert.equal(bond.category,colors.bonds.get(structuralBondKey(bond.a,bond.b)),`${id} ${language} ${view} bond`);
    }
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
    for(const guide of guides){const button=page.locator(`button[data-branch-count="${guide.componentId}"]`).first();assert.equal(await button.count(),1);
     await page.evaluate(locants=>{let finish,observer,timer;window.__b741Guide=new Promise(resolve=>finish=resolve);
      const check=()=>{const root=document.querySelector('.molecule-stage');if(locants.every(([atom,locant])=>root?.querySelector(`[data-reasoning-locant="${atom}"] text`)?.textContent===locant)){observer.disconnect();clearTimeout(timer);finish(true);}};
      observer=new MutationObserver(check);observer.observe(document.body,{subtree:true,childList:true,attributes:true});timer=setTimeout(()=>{observer.disconnect();finish(false)},30000);
     },guide.locants);await button.click();assert.equal(await page.evaluate(()=>window.__b741Guide),true,`${id}: branch guide ${guide.componentId}`);
     await page.locator('.molecule-stage').screenshot({path:`${out}/${id}-${guide.componentId}.png`});}
   }
  }
  assert.deepEqual(errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e);console.error(`B741 ${id}: ${String(e)}`);throw e;}finally{await page.close()}
},{timeout:180000});
