import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../../app/validated-name-derivation.ts";
import { reasoningFragmentId } from "../../app/reasoning-visual-targets.ts";
import { alcohols } from "../fixtures/multifunctional-reconciliation.mjs";

const cases = [
  { id:"adrenaline", fixture:alcohols[0] },
  { id:"salbutamol", fixture:alcohols[1] },
].map(({id,fixture})=>{
  const [label,name,smiles]=fixture,graph=moleculeFromSmiles(smiles).molecule,derivation=reconcileSystematicName(graph,name);
  assert.equal(derivation?.status,"FULL",label);
  const spanishName=presentValidatedSystematicName(derivation,"es").name;
  const proofs={en:derivation,es:reconcileSystematicName(graph,spanishName)};
  assert.equal(proofs.es?.status,"FULL",`${label}: localized name remains reconciled`);
  const models=Object.fromEntries(["es","en"].map(language=>[language,
    buildValidatedPriorityReasoning({derivation:proofs[language],graph,language,activeName:language==="es"?spanishName:name})]));
  const mapped=Object.fromEntries(Object.entries(models).map(([language,model])=>{
    const componentIds=proofs[language].components.filter(component=>["parent","suffix","substituent","prefix"].includes(component.role)
      &&!component.id.startsWith("stereo-"))
      .map(component=>component.id);
    const stereoIds=model.steps.flatMap(item=>[item.fragments,...item.fragments?.additionalFragments??[]])
      .filter(fragment=>fragment?.semanticId?.startsWith("stereo-")).map(fragment=>fragment.semanticId);
    const selections=[...new Set([...componentIds,...stereoIds])].map(semanticId=>{
      const step=model.steps.find(item=>[item.fragments,...item.fragments?.additionalFragments??[]]
        .some(fragment=>fragment?.semanticId===semanticId));
      const fragment=[step?.fragments,...step?.fragments?.additionalFragments??[]]
        .find(item=>item?.semanticId===semanticId);
      assert.ok(step&&fragment,`${id}/${language}: ${semanticId} is explained`);
      const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];
      assert.ok(target,`${id}/${language}: ${semanticId} maps to graph IDs`);
      return {semanticId,step:step.number,atoms:[...target.atomIds].sort((a,b)=>a-b),
        bonds:[...new Set(target.bondIds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":")))].sort()};
    });
    return [language,selections];
  }));
  return {id,label,name,smiles,graph,derivation,models,mapped,spanishName};
});

let server,browser,origin;
before(async()=>{
  server=await createServer({configFile:"vite.pages.config.ts",server:{host:"127.0.0.1",port:0}});
  await server.listen();origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ?{executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE}:{})});
});
after(async()=>{await browser?.close();await server?.close()});

for(const fixture of cases)test(`${fixture.id}: nested groups and CIP selections match the canvas in both languages and views`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  try{
    await page.addInitScript(()=>localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped"));
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin&&!url.pathname.startsWith("/api/"))return route.continue();
      if(url.hostname==="pubchem.ncbi.nlm.nih.gov"){
        const data=url.pathname.includes("/property/")
          ?{PropertyTable:{Properties:[{CID:778001,IUPACName:fixture.name,IsomericSMILES:fixture.smiles,
            CanonicalSMILES:fixture.smiles}]}}
          :url.pathname.includes("/description/")?{InformationList:{Information:[{Title:fixture.label}]}}
            :{IdentifierList:{CID:[778001]}};
        return route.fulfill({json:data,headers:{"access-control-allow-origin":"*"}});
      }
      return route.fulfill({status:200,contentType:"application/json",body:"{}",
        headers:{"access-control-allow-origin":"*"}});
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:"domcontentloaded",timeout:90000});
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(fixture.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const panel=page.locator("#iupac-reasoning-content");
    await page.waitForFunction(()=>document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support")==="FULL",null,{timeout:30000});
    const toggle=page.locator(".reasoning-visibility-button");
    if(await toggle.getAttribute("aria-expanded")!=="true")await toggle.click();
    for(const language of ["es","en"]){
      await page.getByRole("button",{name:language==="es"?"Español":"English",exact:true}).click();
      await page.waitForFunction(name=>document.querySelector(".iupac-dock-name")?.textContent?.trim()===name,
        language==="es"?fixture.spanishName:fixture.name,{timeout:20000});
      const text=await panel.innerText();
      if(fixture.id==="adrenaline"){
        assert.match(text,language==="en"?/P-41.*same hydroxy-compound class.*P-44\.1\.1.*ring carries 2.*attached carbon chain carries at most 1.*C1.*C2.*methylamino.*clockwise.*nitrogen outranks carbon/is
          :/P-41.*misma clase.*P-44\.1\.1.*anillo aromático lleva 2.*cadena carbonada lateral.*1.*C1.*C2.*metilamino.*horario.*nitrógeno tiene prioridad sobre carbono/is);
        assert.doesNotMatch(text,/heteroatom|el heteroátomo|alkyl group|grupo\(s\) alquilo|numbered skeleton|esqueleto numerado/i);
      }else{
        assert.match(text,language==="en"?/P-41.*same hydroxy-compound class.*P-44\.1\.1.*P-44\.1\.2\.2.*prefers the ring over the chain/is
          :/P-41.*misma clase.*P-44\.1\.1.*P-44\.1\.2\.2.*preferencia al anillo sobre la cadena/is);
        assert.match(text,language==="en"?/C2.*tert-butylamino/is:/C2.*terc-butilamino/is);
        assert.doesNotMatch(text,language==="en"?/methylamino at C2/i:/metilamino en C2/i);
      }
      for(const [view,index] of [["semi",0],["skeletal",2]]){
        const button=page.locator(".view-mode-switch button").nth(index);await button.click();
        await page.locator(view==="semi"?".semi-developed-view .semi-developed-node":".skeletal-view .skeletal-node")
          .first().waitFor({state:"attached"});
        for(const expected of fixture.mapped[language]){
          const control=panel.locator(`#iupac-reasoning-step-${expected.step} [data-name-fragment="${expected.semanticId}"]`);
          assert.equal(await control.count(),1,`${fixture.id}/${language}/${view}: ${expected.semanticId}`);
          const selected=await control.evaluate(button=>new Promise((resolve,reject)=>{
            const stage=document.querySelector(".molecule-stage");
            const read=()=>{const overlay=stage?.querySelector(".reasoning-visual-overlay");
              if(!overlay||button.getAttribute("aria-pressed")!=="true")return;
              observer.disconnect();clearTimeout(timer);
              resolve({atoms:[...overlay.querySelectorAll("[data-reasoning-atom]")].map(node=>+node.dataset.reasoningAtom).sort((a,b)=>a-b),
                bonds:[...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")]
                  .map(node=>node.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")))].sort()});
            };
            const observer=new MutationObserver(read);observer.observe(stage,{childList:true,subtree:true,attributes:true});
            observer.observe(button,{attributes:true});
            const timer=setTimeout(()=>{observer.disconnect();reject(Error(`Missing selection overlay for ${button.dataset.nameFragment}`));},5000);
            button.click();read();
          }));
          assert.deepEqual(selected,{atoms:expected.atoms,bonds:expected.bonds},`${fixture.id}/${language}/${view}: ${expected.semanticId}`);
        }
      }
    }
  }finally{await page.close()}
});
