import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { getTetrahedralStereoCenters } from "../../app/tetrahedral-stereochemistry.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";

const baseName = "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine";
const constitution = "CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F";
const fixtures = [
  { id:"fluoxetine-unspecified", smiles:constitution, name:baseName },
  ...["@", "@@"].map(marker => {
    const smiles = `CNCC[C${marker}H](c1ccccc1)Oc1ccc(cc1)C(F)(F)F`;
    const graph = moleculeFromSmiles(smiles).molecule;
    const configuration = getTetrahedralStereoCenters(graph)[0].configuration;
    return { id:`fluoxetine-${configuration}`, smiles, name:`(3${configuration})-${baseName}` };
  }),
];
let server, browser, origin;
before(async () => {
  server = await createServer({ configFile:"vite.pages.config.ts", server:{host:"127.0.0.1",port:0} });
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"});
});
after(async () => { await browser?.close(); await server?.close(); });

for (const fixture of fixtures) test(`${fixture.id}: stereochemical evidence remains selectable in both languages and canvas views`, async () => {
  const graph = moleculeFromSmiles(fixture.smiles).molecule;
  const derivation = reconcileSystematicName(graph, fixture.name);
  assert.equal(derivation?.status, "FULL");
  const en = buildValidatedPriorityReasoning({derivation,graph,language:"en",activeName:fixture.name});
  const es = buildValidatedPriorityReasoning({derivation,graph,language:"es",activeName:fixture.name});
  const enStep = en.steps.find(step=>step.title==="Stereochemistry");
  const esStep = es.steps.find(step=>step.title==="Estereoquímica");
  assert.ok(enStep && esStep);
  const fragments = [enStep.fragments,...enStep.fragments.additionalFragments];
  const expected = fragments.filter(fragment=>fragment.semanticId?.startsWith("stereo-"))
    .map(fragment=>({semanticId:fragment.semanticId,atoms:[...fragment.atomIds].sort((a,b)=>a-b),
      bonds:[...new Set((fragment.bondIds??[]).map(([a,b])=>[a,b].sort((x,y)=>x-y).join(":")))].sort()}));
  assert.ok(expected.some(item=>item.semanticId.startsWith("stereo-center:")));
  assert.ok(expected.some(item=>item.semanticId.startsWith("stereo-ligand:")));

  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  try {
    await page.addInitScript(()=>localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped"));
    await page.route("**/*", async route => {
      const url=new URL(route.request().url());
      if(url.origin===origin && !url.pathname.startsWith("/api/"))return route.continue();
      if(url.hostname==="pubchem.ncbi.nlm.nih.gov") {
        const data=url.pathname.includes("/property/")
          ? {PropertyTable:{Properties:[{CID:990001,IUPACName:fixture.name,IsomericSMILES:fixture.smiles,CanonicalSMILES:fixture.smiles}]}}
          : url.pathname.includes("/description/") ? {InformationList:{Information:[{Title:fixture.id}]}}
            : {IdentifierList:{CID:[990001]}};
        return route.fulfill({json:data,headers:{"access-control-allow-origin":"*"}});
      }
      return route.fulfill({status:200,contentType:"application/json",body:"{}",headers:{"access-control-allow-origin":"*"}});
    });
    await page.goto(`${origin}/OrgoRush/es/`,{waitUntil:"domcontentloaded",timeout:90000});
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(fixture.smiles);
    await page.locator("#smiles-interop-panel button[type=submit]").click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const panel=page.locator("#iupac-reasoning-content");
    await page.waitForFunction(()=>document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support")==="FULL",null,{timeout:30000});
    const toggle=page.locator(".reasoning-visibility-button");
    if(await toggle.getAttribute("aria-expanded")!=="true")await toggle.click();
    for(const language of ["es","en"]) {
      await page.getByRole("button",{name:language==="es"?"Español":"English",exact:true}).click();
      const expectedName=language==="es"?presentValidatedSystematicName(derivation,"es").name:fixture.name;
      await page.waitForFunction(name=>document.querySelector(".iupac-dock-name")?.textContent?.trim()===name,expectedName,{timeout:20000});
      const stage=panel.locator("li").filter({has:page.locator(language==="es"?"strong:text-is('Estereoquímica')":"strong:text-is('Stereochemistry')")});
      assert.equal(await stage.count(),1);
      for(const [mode,index] of [["semi",0],["skeletal",2]]) {
        await page.locator(".view-mode-switch button").nth(index).click();
        await page.locator(mode==="semi"?".semi-developed-view .semi-developed-node":".skeletal-view .skeletal-node").first().waitFor({state:"attached"});
        for(const target of expected) {
          const modelStep=language==="es"?esStep:enStep;
          const fragment=[modelStep.fragments,...modelStep.fragments.additionalFragments].find(item=>item.semanticId===target.semanticId);
          const control=stage.locator(`[data-name-fragment="${fragment.semanticId}"]`);
          assert.equal(await control.count(),1,`${language}/${mode}: ${target.semanticId}`);
          const actual=await control.evaluate(button=>new Promise((resolve,reject)=>{
            const root=document.querySelector(".molecule-stage");
            const read=()=>{
              const overlay=root?.querySelector(".reasoning-visual-overlay");
              if(!overlay||button.getAttribute("aria-pressed")!=="true")return;
              observer.disconnect();clearTimeout(timer);
              resolve({atoms:[...overlay.querySelectorAll("[data-reasoning-atom]")].map(node=>+node.dataset.reasoningAtom).sort((a,b)=>a-b),
                bonds:[...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")].map(node=>node.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")))].sort()});
            };
            const observer=new MutationObserver(read);observer.observe(root,{childList:true,subtree:true,attributes:true});observer.observe(button,{attributes:true});
            const timer=setTimeout(()=>{observer.disconnect();reject(Error("No stereo overlay"));},4000);button.click();read();
          }));
          assert.deepEqual(actual,{atoms:target.atoms,bonds:target.bonds},`${language}/${mode}: ${target.semanticId}`);
        }
      }
    }
  } finally { await page.close(); }
});
