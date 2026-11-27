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

const cases = [
  { id:"naphthalene", en:"naphthalene", es:"naftaleno", smiles:"c1ccc2ccccc2c1", atoms:10, locants:[1,2,3,4,"4a",5,6,7,8,"8a"], groupEs:"Hidrocarburo", groupEn:"Hydrocarbon" },
  { id:"1-methyl", en:"1-methylnaphthalene", es:"1-metilnaftaleno", smiles:"Cc1cccc2ccccc12", atoms:11, locants:[1], groupEs:"Hidrocarburo", groupEn:"Hydrocarbon" },
  { id:"1,8-dimethyl", en:"1,8-dimethylnaphthalene", es:"1,8-dimetilnaftaleno", smiles:"Cc1cccc2cccc(C)c12", atoms:12, locants:[1,8], groupEs:"Hidrocarburo", groupEn:"Hydrocarbon" },
  { id:"2-naphthol", en:"naphthalen-2-ol", es:"naftalen-2-ol", smiles:"Oc1ccc2ccccc2c1", atoms:11, locants:[2], groupEs:"Alcohol", groupEn:"Alcohol" },
  { id:"1-naphthol", en:"naphthalen-1-ol", es:"naftalen-1-ol", smiles:"Oc1cccc2ccccc12", atoms:11, locants:[1], groupEs:"Alcohol", groupEn:"Alcohol" },
  { id:"1-5-diol", en:"naphthalene-1,5-diol", es:"naftaleno-1,5-diol", smiles:"Oc1cccc2c(O)cccc12", atoms:12, locants:[1,5], groupEs:"Alcohol", groupEn:"Alcohol" },
  { id:"2-carboxylic-acid", en:"naphthalene-2-carboxylic acid", es:"ácido naftaleno-2-carboxílico", smiles:"O=C(O)c1ccc2ccccc2c1", atoms:13, locants:[2], groupEs:"Ácido carboxílico", groupEn:"Carboxylic acid" },
  { id:"2-methyl-ester", en:"methyl naphthalene-2-carboxylate", es:"metil naftaleno-2-carboxilato", smiles:"COC(=O)c1ccc2ccccc2c1", atoms:14, locants:[2], groupEs:"Éster", groupEn:"Ester" },
];
const selected=process.env.NAPHTHALENE_E2E_CASES?.split(",");
const output=resolve(process.env.NAPHTHALENE_E2E_OUT_DIR??"reports/fused-naphthalene-phase1/e2e");
const key=([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(":");
const sorted=values=>[...new Set(values)].sort((a,b)=>a-b);
async function selectExact(page,button,target,visibleLocants,activation="click"){
  const expected={atoms:sorted(target.atomIds),bonds:target.bondIds.map(key).sort(),
    locants:target.locants.filter(([id,locant])=>visibleLocants[id]!==String(locant))
      .map(([id,locant])=>[Number(id),String(locant)]).sort(([a],[b])=>a-b)};
  const selector=await button.evaluate(node=>`#${node.closest('[id^="iupac-reasoning-step-"]').id} button[data-name-fragment=${JSON.stringify(node.dataset.nameFragment)}]`);
  await button.evaluate(node=>node.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"}));
  await page.evaluate(({expected,selector})=>{
    let finish,observer,timer;const started=performance.now();
    window.__naphthaleneSelection={promise:new Promise(resolve=>{finish=resolve})};
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
  if(activation==="keyboard"){
    await button.focus();
    assert.equal(await button.evaluate(node=>node===document.activeElement),true,"graph control must receive keyboard focus");
    await button.press("Enter");
  }else await button.click();
  const result=await page.evaluate(()=>window.__naphthaleneSelection.promise);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.deepEqual(result.actual,expected);
  return result;
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

test("six naphthalene cases retain exact graph selections across both languages and fused-ring views",async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],unexpected=[],network=[];
  const report={browser:browser.version(),cases:[],errors,unexpected,network};
  try{
    page.setDefaultTimeout(15000);page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.addInitScript(()=>{localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped");localStorage.setItem("hydrocarbon-lab-language","es");});
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(url.hostname==="www.googletagmanager.com")return route.fulfill({status:200,contentType:"application/javascript",body:""});
      if(url.hostname==="fonts.gstatic.com")return route.fulfill({status:204,body:""});
      if(["pubchem.ncbi.nlm.nih.gov","es.wikipedia.org","en.wikipedia.org","www.wikidata.org"].includes(url.hostname)){
        network.push({host:url.hostname,path:url.pathname});
        return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"{}"});
      }
      unexpected.push(url.href);return route.abort();
    });
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"Español",exact:true}).click();
    for(const item of cases.filter(item=>!selected||selected.includes(item.id))){
      await page.getByRole("button",{name:"Español",exact:true}).click();
      await page.waitForFunction(()=>document.documentElement.lang.startsWith("es"));
      const local=buildHydrocarbonFromIupacName(item.es);assert.equal(local.ok,true,item.id);
      await page.locator('[aria-controls="iupac-name-builder"]').click();
      await page.locator("#iupac-name-input").fill(item.es);
      assert.equal(await page.locator("#iupac-name-input").inputValue(),item.es,`${item.id}: exact source input`);
      await page.locator("#iupac-name-builder button[type=submit]").click();
      await page.locator("#iupac-name-input").waitFor({state:"hidden",timeout:30000});
      const summary=page.locator(".reasoning-visibility-button");if(await summary.getAttribute("aria-expanded")!=="true")await summary.click();
      const panel=page.locator("#iupac-reasoning-content");
      await panel.waitFor({state:"visible",timeout:20000});
      await page.waitForFunction(()=>document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support")==="FULL",null,{timeout:20000});
      const graph=local.molecule;
      const core=graph.atoms.filter(atom=>item.id==="naphthalene"?atom.element==="C":atom.element==="C").slice(0,10);
      assert.equal(core.length,10);
      const fusionParent=reconcileSystematicName(graph,item.es);
      assert.equal(fusionParent?.status,"FULL");
      const parentIds=new Set(fusionParent.components.find(component=>component.id==="parent").atomIds);
      const parentEdges=graph.bonds.filter(([a,b])=>parentIds.has(a)&&parentIds.has(b));
      assert.equal(parentEdges.length,11);
      const locants=new Map(fusionParent.components.find(component=>component.id==="parent").numbering.map(([id,locant])=>[String(locant),id]));
      assert.ok(parentEdges.some(([a,b])=>key([a,b])===key([locants.get("4a"),locants.get("8a")])),"fused bond is one exact parent graph edge");
      const observations=[];let keyboardSelectionVerified=false;
      for(const language of ["es","en"]){
        if(language==="en")await page.getByRole("button",{name:"English",exact:true}).click();
        const name=language==="es"?item.es:item.en;
        await panel.locator(".reasoning-validated-name").getByText(name,{exact:true}).waitFor({state:"visible",timeout:10000});
        await page.waitForFunction(()=>!document.querySelector(".reasoning-visual-overlay"));
        assert.equal(await panel.getAttribute("data-derivation-support"),"FULL",`${item.id} ${language}`);
        assert.equal(await panel.locator(".reasoning-validated-name").innerText(),name);
        assert.equal(await page.locator(".analysis-group strong").innerText(),language==="es"?item.groupEs:item.groupEn,`${item.id}: principal group`);
        const proof=reconcileSystematicName(graph,name);assert.equal(proof?.status,"FULL");
        const reasoning=buildValidatedPriorityReasoning({derivation:proof,graph,language});
        for(const mode of ["skeletal","semi-developed"]){
          const modeButton=page.locator(".view-mode-switch button").nth(mode==="skeletal"?2:0);
          await modeButton.click();assert.equal(await modeButton.getAttribute("aria-pressed"),"true");
          await page.waitForFunction(mode=>document.querySelector(`.molecule-stage.${mode==="skeletal"?"skeletal-view":"semi-developed-view"}`),mode);
          for(const step of reasoning.steps){
            if(/alphabetical order|orden alfabético/i.test(step.title))continue;
            const fragments=step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[];
            for(const fragment of fragments){
              if(fragment.kind==="numbering"&&fragment.semanticId.startsWith("locant:parent:")&&!item.locants.includes(fragment.text))continue;
              const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];if(!target)continue;
              const button=panel.locator(`#iupac-reasoning-step-${step.number} button[data-name-fragment=${JSON.stringify(fragment.semanticId)}]`);
              assert.equal(await button.count(),1,`${item.id}/${language}/${mode}/${fragment.semanticId}`);
              const visible=await page.locator(".molecule-stage [data-atom-id]").evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.atomId,node.querySelector(".number-label")?.textContent])));
              const observed=await selectExact(page,button,target,visible,keyboardSelectionVerified?"click":"keyboard");
              keyboardSelectionVerified=true;
              observations.push({language,mode,id:fragment.semanticId,...observed.actual,elapsedMs:observed.elapsedMs});
            }
          }
          if(language==="es"&&mode==="skeletal"&&["naphthalene","1,8-dimethyl","2-carboxylic-acid"].includes(item.id))
            await page.screenshot({path:resolve(output,`${item.id}-es-skeletal.png`),fullPage:true});
        }
      }
      const stageGraph=await page.locator(".molecule-stage").evaluate(node=>({atoms:[...node.querySelectorAll("[data-atom-id]")].map(element=>element.dataset.atomId),
        bonds:[...node.querySelectorAll("[data-bond-a]")].map(element=>[element.dataset.bondA,element.dataset.bondB])}));
      assert.equal(stageGraph.atoms.length,item.atoms,item.id);
      assert.equal(stageGraph.bonds.length,graph.bonds.length,item.id);
      const result={id:item.id,names:{es:item.es,en:item.en},status:"PASS",atoms:stageGraph.atoms.length,bonds:stageGraph.bonds.length,
        fusionEdge:key([locants.get("4a"),locants.get("8a")]),observations};
      report.cases.push(result);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    report.status="PASS";
  }catch(error){report.error=String(error);report.status="FAIL";report.debug=await page.locator("body").innerText().catch(()=>"");await page.screenshot({path:resolve(output,"failure.png"),fullPage:true}).catch(()=>{});throw error}
  finally{await writeFile(resolve(output,"results.json"),JSON.stringify(report,null,2)+"\n");await page.close();}
},{timeout:900000});
