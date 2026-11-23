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
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";

const cases = [
  { id:"anthracene", en:"anthracene", es:"antraceno", smiles:"C1=CC=C2C=C3C=CC=CC3=CC2=C1", parent:"anthracene", locants:["4a","8a","9a","10a"], group:"Hydrocarbon" },
  { id:"anthracene-9-methyl", en:"9-methylanthracene", es:"9-metilantraceno", smiles:"CC1=C2C=CC=CC2=CC3=CC=CC=C13", parent:"anthracene", locants:[9,"4a","8a","9a","10a"], group:"Hydrocarbon" },
  { id:"anthracene-9-ol", en:"anthracen-9-ol", es:"antracen-9-ol", smiles:"C1=CC=C2C(=C1)C=C3C=CC=CC3=C2O", parent:"anthracene", locants:[9,"4a","8a","9a","10a"], group:"Alcohol" },
  { id:"phenanthrene", en:"phenanthrene", es:"fenantreno", smiles:"C1=CC=C2C(=C1)C=CC3=CC=CC=C32", parent:"phenanthrene", locants:["4a","4b","8a","10a"], group:"Hydrocarbon" },
  { id:"phenanthrene-9-methyl", en:"9-methylphenanthrene", es:"9-metilfenantreno", smiles:"CC1=CC2=CC=CC=C2C3=CC=CC=C13", parent:"phenanthrene", locants:[9,"4a","4b","8a","10a"], group:"Hydrocarbon" },
  { id:"phenanthrene-9-ol", en:"phenanthren-9-ol", es:"fenantren-9-ol", smiles:"C1=CC=C2C(=C1)C=C(C3=CC=CC=C23)O", parent:"phenanthrene", locants:[9,"4a","4b","8a","10a"], group:"Alcohol" },
];
const output=resolve(process.env.TRICYCLIC_ARENE_E2E_OUT_DIR??"reports/fused-tricyclic-phase2/e2e");
const selected=process.env.TRICYCLIC_ARENE_E2E_CASES?.split(",");
const key=([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(":");
const sorted=values=>[...new Set(values)].sort((a,b)=>a-b);
async function selectExact(page,button,target,visibleLocants){
  const expected={atoms:sorted(target.atomIds),bonds:target.bondIds.map(key).sort(),
    locants:target.locants.filter(([id,locant])=>visibleLocants[id]!==String(locant))
      .map(([id,locant])=>[Number(id),String(locant)]).sort(([a],[b])=>a-b)};
  const selector=await button.evaluate(node=>`#${node.closest('[id^="iupac-reasoning-step-"]').id} button[data-name-fragment=${JSON.stringify(node.dataset.nameFragment)}]`);
  await button.evaluate(node=>node.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}));
  await page.evaluate(({expected,selector})=>{
    let finish,observer,timer;const started=performance.now();
    window.__tricyclicSelection={promise:new Promise(resolve=>{finish=resolve})};
    const complete=value=>{clearTimeout(timer);observer?.disconnect();finish(value)};
    const snapshot=()=>{
      const node=document.querySelector(".reasoning-visual-overlay");if(!node)return;
      const actual={atoms:[...node.querySelectorAll("[data-reasoning-atom]")].map(n=>Number(n.dataset.reasoningAtom)).sort((a,b)=>a-b),
        bonds:[...node.querySelectorAll("[data-reasoning-bond]")].map(n=>n.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")).sort(),
        locants:[...node.querySelectorAll("[data-reasoning-locant]")].map(n=>[Number(n.dataset.reasoningLocant),n.querySelector("text")?.textContent]).sort(([a],[b])=>a-b)};
      if(document.querySelector(selector)?.getAttribute("aria-pressed")==="true"&&JSON.stringify(actual)===JSON.stringify(expected))
        complete({ok:true,elapsedMs:performance.now()-started,actual});
    };
    observer=new MutationObserver(snapshot);observer.observe(document.body,{subtree:true,attributes:true,childList:true});
    timer=setTimeout(()=>complete({ok:false,selector,pressed:document.querySelector(selector)?.getAttribute("aria-pressed")}),10000);
  },{expected,selector});
  await button.click();
  const result=await page.evaluate(()=>window.__tricyclicSelection.promise);
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

test("six tricyclic fused arenes keep exact bilingual ring, fusion, locant, and substituent selections",async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],unexpected=[],network=[];
  const report={browser:browser.version(),cases:[],errors,unexpected,network};
  try{
    page.setDefaultTimeout(15000);page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.addInitScript(()=>{localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped");localStorage.setItem("hydrocarbon-lab-language","es");});
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
      if(url.hostname==="www.googletagmanager.com")return route.fulfill({status:200,contentType:"application/javascript",body:""});
      if(url.hostname==="fonts.gstatic.com")return route.fulfill({status:204,body:""});
      if(["pubchem.ncbi.nlm.nih.gov","es.wikipedia.org","en.wikipedia.org","www.wikidata.org"].includes(url.hostname)){
        network.push({host:url.hostname,path:url.pathname});return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"{}"});
      }
      unexpected.push(url.href);return route.abort();
    });
    await page.goto(base,{waitUntil:"domcontentloaded"});await page.getByRole("button",{name:"Español",exact:true}).click();
    for(const item of cases.filter(item=>!selected||selected.includes(item.id))){
      await page.getByRole("button",{name:"Español",exact:true}).click();
      await page.waitForFunction(()=>document.documentElement.lang.startsWith("es"));
      const local=buildHydrocarbonFromIupacName(item.es);assert.equal(local.ok,true,item.id);
      await page.locator('[aria-controls="iupac-name-builder"]').click();await page.locator("#iupac-name-input").fill(item.es);
      assert.equal(await page.locator("#iupac-name-input").inputValue(),item.es,`${item.id}: source name`);
      await page.locator("#iupac-name-builder button[type=submit]").click();
      await page.locator("#iupac-name-input").waitFor({state:"hidden",timeout:30000});
      const summary=page.locator(".reasoning-visibility-button");if(await summary.getAttribute("aria-expanded")!=="true")await summary.click();
      const panel=page.locator("#iupac-reasoning-content");await panel.waitFor({state:"visible",timeout:20000});
      await page.waitForFunction(()=>document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support")==="FULL",null,{timeout:20000});
      const graph=local.molecule,proof=reconcileSystematicName(graph,item.es);assert.equal(proof?.status,"FULL");
      const parent=proof.components.find(component=>component.id==="parent"),parentIds=new Set(parent.atomIds);
      assert.equal(parent.atomIds.length,14,`${item.id}: parent atom count`);
      assert.equal(graph.rings.length,3,`${item.id}: ring count`);
      assert.ok(graph.rings.every(ring=>ring.atomIds.length===6),`${item.id}: each ring is six-membered`);
      const fusionEdges=proof.components.find(component=>component.id==="fusion-bonds");assert.equal(fusionEdges.bondIds.length,2);
      const locants=new Map(parent.numbering.map(([id,locant])=>[String(locant),id]));
      for(const locant of item.locants.filter(value=>typeof value==="string"))assert.ok(locants.has(locant),`${item.id}: traditional fusion locant ${locant}`);
      const expectedReferences=moleculeFromSmiles(item.smiles);assert.equal(expectedReferences.ok,true,expectedReferences.error);
      assert.equal(reconcileSystematicName(expectedReferences.molecule,item.es)?.status,"FULL",`${item.id}: independent PubChem structure`);
      const observations=[];
      for(const language of ["es","en"]){
        if(language==="en")await page.getByRole("button",{name:"English",exact:true}).click();
        const name=language==="es"?item.es:item.en;
        await panel.locator(".reasoning-validated-name").getByText(name,{exact:true}).waitFor({state:"visible",timeout:10000});
        await page.waitForFunction(()=>!document.querySelector(".reasoning-visual-overlay"));
        assert.equal(await panel.getAttribute("data-derivation-support"),"FULL");
        assert.equal(await panel.locator(".reasoning-validated-name").innerText(),name);
        assert.equal(await page.locator(".analysis-group strong").innerText(),language==="es"?item.group==="Alcohol"?"Alcohol":"Hidrocarburo":item.group);
        const languageProof=reconcileSystematicName(graph,name);assert.equal(languageProof?.status,"FULL");
        assert.equal(languageProof.evidence.language,language,`${item.id}: independent ${language} reconciliation`);
        const reasoning=buildValidatedPriorityReasoning({derivation:languageProof,graph,language});
        const parentStep=reasoning.steps.find(step=>step.componentIds.includes("parent"));
        assert.ok(parentStep?.componentIds.includes("fused-ring:1"));assert.ok(parentStep.componentIds.includes("fused-ring:2"));
        assert.ok(parentStep.componentIds.includes("fused-ring:3"));assert.ok(parentStep.componentIds.includes("fusion-bonds"));
        for(const mode of ["skeletal","semi-developed"]){
          const modeButton=page.locator(".view-mode-switch button").nth(mode==="skeletal"?2:0);await modeButton.click();
          await page.waitForFunction(mode=>document.querySelector(`.molecule-stage.${mode==="skeletal"?"skeletal-view":"semi-developed-view"}`),mode);
          for(const step of reasoning.steps){
            const fragments=step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[];
            for(const fragment of fragments){
              if(fragment.kind==="numbering"&&fragment.semanticId.startsWith("locant:parent:")&&!item.locants.map(String).includes(fragment.text))continue;
              const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];if(!target)continue;
              const button=panel.locator(`#iupac-reasoning-step-${step.number} button[data-name-fragment=${JSON.stringify(fragment.semanticId)}]`);
              assert.equal(await button.count(),1,`${item.id}/${language}/${mode}/${fragment.semanticId}`);
              const visible=await page.locator(".molecule-stage [data-atom-id]").evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.atomId,node.querySelector(".number-label")?.textContent])));
              const observed=await selectExact(page,button,target,visible);observations.push({language,mode,id:fragment.semanticId,...observed.actual});
            }
          }
          if(language==="es"&&mode==="skeletal"&&["anthracene","anthracene-9-methyl","phenanthrene","phenanthrene-9-ol"].includes(item.id))
            await page.screenshot({path:resolve(output,`${item.id}-es-skeletal.png`),fullPage:true});
        }
      }
      const summaryGraph=await page.locator(".molecule-stage").evaluate(node=>({atoms:[...node.querySelectorAll("[data-atom-id]")].map(e=>e.dataset.atomId),bonds:[...node.querySelectorAll("[data-bond-a]")].map(e=>[e.dataset.bondA,e.dataset.bondB])}));
      assert.equal(summaryGraph.atoms.length,graph.atoms.length,item.id);assert.equal(summaryGraph.bonds.length,graph.bonds.length,item.id);
      report.cases.push({id:item.id,names:{es:item.es,en:item.en},status:"PASS",atoms:summaryGraph.atoms.length,bonds:summaryGraph.bonds.length,
        fusionLocants:item.locants.filter(value=>typeof value==="string"),observations});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);report.status="PASS";
  }catch(error){report.error=String(error);report.status="FAIL";report.debug=await page.locator("body").innerText().catch(()=>"");await page.screenshot({path:resolve(output,"failure.png"),fullPage:true}).catch(()=>{});throw error}
  finally{await writeFile(resolve(output,"results.json"),JSON.stringify(report,null,2)+"\n");await page.close();}
},{timeout:900000});
