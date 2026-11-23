import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildHydrocarbonFromIupacName } from "../../app/name-to-molecule.ts";
import { reconcileSystematicName } from "../../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";
import { reasoningFragmentId } from "../../app/reasoning-visual-targets.ts";

const cases=[
  {id:"indane",en:"2,3-dihydro-1H-indene",es:"2,3-dihidro-1H-indeno",parentAtoms:9,ringSizes:[5,6],groupEs:"Hidrocarburo",groupEn:"Hydrocarbon"},
  {id:"indan-1-ol",en:"2,3-dihydro-1H-inden-1-ol",es:"2,3-dihidro-1H-inden-1-ol",parentAtoms:9,ringSizes:[5,6],groupEs:"Alcohol",groupEn:"Alcohol"},
  {id:"indene",en:"indene",es:"indeno",parentAtoms:9,ringSizes:[5,6],groupEs:"Hidrocarburo",groupEn:"Hydrocarbon"},
  {id:"5-bromoindene",en:"5-bromoindene",es:"5-bromoindeno",parentAtoms:9,ringSizes:[5,6],groupEs:"Bromo",groupEn:"Bromo"},
  {id:"tetralin",en:"1,2,3,4-tetrahydronaphthalene",es:"1,2,3,4-tetrahidronaftaleno",parentAtoms:10,ringSizes:[6,6],groupEs:"Hidrocarburo",groupEn:"Hydrocarbon"},
  {id:"tetralin-1-ol",en:"1,2,3,4-tetrahydronaphthalen-1-ol",es:"1,2,3,4-tetrahidronaftalen-1-ol",parentAtoms:10,ringSizes:[6,6],groupEs:"Alcohol",groupEn:"Alcohol"},
];
const output=resolve(process.env.FUSED_PARTIAL_E2E_OUT_DIR??"reports/fused-partially-saturated-phase3/e2e");
const selectedCases=process.env.FUSED_PARTIAL_E2E_CASES?.split(",");
const selected=cases.filter(item=>!selectedCases||selectedCases.includes(item.id));
const key=([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(":");
const sorted=values=>[...new Set(values)].sort((a,b)=>a-b);
async function selectExact(page,button,target,visibleLocants){
  const expected={atoms:sorted(target.atomIds),bonds:target.bondIds.map(key).sort(),
    locants:target.locants.filter(([id,locant])=>visibleLocants[id]!==String(locant)).map(([id,locant])=>[Number(id),String(locant)]).sort(([a],[b])=>a-b)};
  const selector=await button.evaluate(node=>`#${node.closest('[id^="iupac-reasoning-step-"]').id} button[data-name-fragment=${JSON.stringify(node.dataset.nameFragment)}]`);
  await button.evaluate(node=>node.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}));
  await page.evaluate(({expected,selector})=>{
    let finish,observer,timer,ticker,lastActual;const started=performance.now();window.__fusedSelection={promise:new Promise(resolve=>{finish=resolve})};
    const complete=value=>{clearTimeout(timer);clearInterval(ticker);observer?.disconnect();finish(value)};
    const snapshot=()=>{const nodes=[...document.querySelectorAll(".reasoning-visual-overlay")];if(!nodes.length)return;
      const actuals=nodes.map(node=>({atoms:[...node.querySelectorAll("[data-reasoning-atom]")].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
        bonds:[...node.querySelectorAll("[data-reasoning-bond]")].map(n=>n.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")).sort(),
        locants:[...node.querySelectorAll("[data-reasoning-locant]")].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector("text")?.textContent]).sort(([a],[b])=>a-b)}));
      lastActual=actuals;
      const actual=actuals.find(value=>JSON.stringify(value)===JSON.stringify(expected));
      if(document.querySelector(selector)?.getAttribute("aria-pressed")==="true"&&actual)complete({ok:true,elapsedMs:performance.now()-started,actual});};
    observer=new MutationObserver(snapshot);observer.observe(document.body,{subtree:true,attributes:true,childList:true});
    ticker=setInterval(snapshot,16);snapshot();
    timer=setTimeout(()=>complete({ok:false,selector,pressed:document.querySelector(selector)?.getAttribute("aria-pressed"),expected,actual:lastActual,
      button:document.querySelector(selector)?.outerHTML,overlays:[...document.querySelectorAll(".reasoning-visual-overlay")].map(node=>node.outerHTML.slice(0,1200))}),10000);
  },{expected,selector});
  await button.click();
  const result=await page.evaluate(()=>window.__fusedSelection.promise);
  assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.actual,expected);return result;
}
let server,browser,base;
before(async()=>{
  server=await createServer({configFile:fileURLToPath(new URL("../../vite.pages.config.ts",import.meta.url)),server:{host:"127.0.0.1",port:0}});
  await server.listen();base=`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`;
  const response=await fetch(base,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
  browser=await chromium.launch({headless:true,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
  await mkdir(output,{recursive:true});
},{timeout:60000});
after(async()=>{await browser?.close();await server?.close();});

test("partially saturated fused systems keep strict bilingual derivations and exact canvas selections",async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],unexpected=[],external=[];
  const report={browser:browser.version(),cases:[],errors,unexpected,external};
  try{
    page.setDefaultTimeout(15000);page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.addInitScript(()=>{localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped");localStorage.setItem("hydrocarbon-lab-language","es");});
    await page.route("**/*",async route=>{const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.hostname==="www.googletagmanager.com")return route.fulfill({status:200,contentType:"application/javascript",body:""});
      if(url.hostname==="fonts.gstatic.com")return route.fulfill({status:204,body:""});
      if(url.hostname==="www.ebi.ac.uk"&&url.pathname.startsWith("/opsin/ws/")){external.push({host:url.hostname,path:url.pathname});return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"FAILURE",message:"Deterministic E2E fixture: no external name resolution."})});}
      if(["pubchem.ncbi.nlm.nih.gov","es.wikipedia.org","en.wikipedia.org","www.wikidata.org"].includes(url.hostname)){external.push({host:url.hostname,path:url.pathname});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"{}"});}
      unexpected.push(url.href);return route.abort();
    });
    await page.goto(base,{waitUntil:"domcontentloaded"});
    for(const item of selected){
      await page.getByRole("button",{name:"Español",exact:true}).click();
      await page.waitForFunction(()=>document.documentElement.lang.startsWith("es"));
      const built=buildHydrocarbonFromIupacName(item.es);assert.equal(built.ok,true,`${item.id}: ${built.error}`);
      await page.locator('[aria-controls="iupac-name-builder"]').click();
      await page.locator("#iupac-name-input").fill(item.es);
      await page.locator("#iupac-name-builder button[type=submit]").click();
      await page.locator("#iupac-name-input").waitFor({state:"hidden",timeout:30000});
      const summary=page.locator(".reasoning-visibility-button");if(await summary.getAttribute("aria-expanded")!=="true")await summary.click();
      const panel=page.locator("#iupac-reasoning-content");await panel.waitFor({state:"visible",timeout:20000});
      await page.waitForFunction(()=>document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support")==="FULL",null,{timeout:20000});
      const proof=reconcileSystematicName(built.molecule,item.es);assert.equal(proof?.status,"FULL",item.id);
      const parent=proof.components.find(component=>component.id==="parent");assert.equal(parent.atomIds.length,item.parentAtoms,item.id);
      const rings=built.molecule.rings;assert.deepEqual(rings.map(ring=>ring.atomIds.length).sort((a,b)=>a-b),item.ringSizes,item.id);
      const shared=rings[0].atomIds.filter(id=>rings[1].atomIds.includes(id));assert.equal(shared.length,2,item.id);
      const fusionEdge=built.molecule.bonds.filter(([a,b])=>shared.includes(a)&&shared.includes(b));assert.equal(fusionEdge.length,1,item.id);
      const observations=[];
      for(const language of ["es","en"]){
        if(language==="en"){
          await page.getByRole("button",{name:"English",exact:true}).click();
          await page.waitForFunction(()=>document.documentElement.lang.startsWith("en"));
          await page.locator('[aria-controls="iupac-name-builder"]').click();
          await page.locator("#iupac-name-input").fill(item.en);
          await page.locator("#iupac-name-builder button[type=submit]").click();
          await page.locator("#iupac-name-input").waitFor({state:"hidden",timeout:30000});
          if(await summary.getAttribute("aria-expanded")!=="true")await summary.click();
          await panel.waitFor({state:"visible",timeout:20000});
          await page.waitForFunction(()=>document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support")==="FULL",null,{timeout:20000});
        }
        const displayed=language==="es"?item.es:item.en;
        const localizedParentTitle=language==="es"?"Estructura principal":"Parent structure";
        await page.waitForFunction(({selector,title})=>document.querySelector(selector)?.innerText.includes(title),{selector:"#iupac-reasoning-content",title:localizedParentTitle},{timeout:10000});
        assert((await page.locator("body").innerText()).toLocaleLowerCase().includes(displayed.toLocaleLowerCase()),`${item.id}/${language}: displayed name`);
        assert((await panel.innerText()).includes(localizedParentTitle),`${item.id}/${language}: localized derivation`);
        assert.equal(await panel.getAttribute("data-derivation-support"),"FULL",`${item.id}/${language}`);
        assert.equal(await page.locator(".analysis-group strong").innerText(),language==="es"?item.groupEs:item.groupEn,`${item.id}/${language}: group`);
        const languageProof=reconcileSystematicName(built.molecule,displayed);assert.equal(languageProof?.status,"FULL",`${item.id}/${language}: strict bilingual proof`);
        assert.equal(languageProof?.evidence?.language,language,`${item.id}/${language}: language-specific grammar`);
        const reasoning=buildValidatedPriorityReasoning({derivation:languageProof,graph:built.molecule,language});
        for(const mode of ["skeletal","semi-developed"]){
          const modeButton=page.locator(".view-mode-switch button").nth(mode==="skeletal"?2:0);await modeButton.click();
          assert.equal(await modeButton.getAttribute("aria-pressed"),"true");
          await page.waitForFunction(mode=>document.querySelector(`.molecule-stage.${mode==="skeletal"?"skeletal-view":"semi-developed-view"}`),mode);
          for(const step of reasoning.steps)for(const fragment of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]){
            const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];if(!target)continue;
            const button=panel.locator(`#iupac-reasoning-step-${step.number} button[data-name-fragment=${JSON.stringify(fragment.semanticId)}]`);
            assert.equal(await button.count(),1,`${item.id}/${language}/${mode}/${fragment.semanticId}`);
            const visible=await page.locator(".molecule-stage [data-atom-id]").evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.atomId,node.querySelector(".number-label")?.textContent])));
            const selected=await selectExact(page,button,target,visible);observations.push({language,mode,id:fragment.semanticId,...selected.actual});
          }
          if(language==="es"&&["indane","indene","tetralin"].includes(item.id))await page.screenshot({path:resolve(output,`${item.id}-es-${mode}.png`),fullPage:true});
        }
      }
      const rendered=await page.locator(".molecule-stage").evaluate(node=>({atoms:[...node.querySelectorAll("[data-atom-id]")].map(el=>el.dataset.atomId),bonds:[...node.querySelectorAll("[data-bond-a]")].map(el=>[el.dataset.bondA,el.dataset.bondB])}));
      assert.equal(rendered.atoms.length,built.molecule.atoms.length,item.id);assert.equal(rendered.bonds.length,built.molecule.bonds.length,item.id);
      report.cases.push({id:item.id,names:{en:item.en,es:item.es},status:"FULL",ringSizes:item.ringSizes,sharedAtomIds:shared,fusionBond:fusionEdge[0].slice(0,2),observations});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);report.status="PASS";
  }catch(error){report.error=String(error);report.status="FAIL";report.debug=await page.locator("body").innerText().catch(()=>"");await page.screenshot({path:resolve(output,"failure.png"),fullPage:true}).catch(()=>{});throw error;}
  finally{await writeFile(resolve(output,"results.json"),JSON.stringify(report,null,2)+"\n");await page.close();}
},{timeout:900000});
