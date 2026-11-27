import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { mapStructuralRegions } from "../../app/structural-derivation.ts";

// These frozen SMILES and name spellings are also exercised by the phase-8
// model tests. Expected regions below are traced on those reference graphs.
const cases = [
  { id: "paracetamol", cid: 1983, formula: "C8H9NO2", smiles: "CC(=O)Nc1ccc(O)cc1",
    en: "N-(4-hydroxyphenyl)acetamide", es: "N-(4-hidroxifenil)acetamida", path: "N–C1",
    regions: [
      {id:"suffix",atoms:[2,3,4],bonds:[[2,3],[2,4]],locants:[]},
      {id:"aryl-prefix",atoms:[9],bonds:[[8,9]],locants:[]},
      {id:"aryl",atoms:[5,6,7,8,9,10,11],bonds:[[5,6],[6,7],[7,8],[8,10],[10,11],[11,5],[8,9],[4,5]],locants:[[5,1],[8,4]]},
    ]},
  { id: "fluoxetine", cid: 3386, formula: "C17H18F3NO", smiles: "CNCCC(c1ccccc1)Oc1ccc(C(F)(F)F)cc1",
    en: "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine",
    es: "3-fenil-N-metil-3-[4-(trifluorometil)fenoxi]propan-1-amina", path: "C3–O–C1",
    regions: [
      {id:"phenyl",atoms:[6,7,8,9,10,11],bonds:[[6,7],[7,8],[8,9],[9,10],[10,11],[11,6],[5,6]],locants:[[5,3]]},
      {id:"phenoxy",atoms:[12,13,14,15,16,17,18,19,20,21,22],bonds:[[13,14],[14,15],[15,16],[16,21],[21,22],[22,13],[12,13],[5,12],[16,17],[17,18],[17,19],[17,20]],locants:[[5,3]]},
      {id:"phenoxy-ring-substituent",atoms:[17,18,19,20],bonds:[[17,18],[17,19],[17,20],[16,17]],locants:[[16,4]]},
      {id:"phenoxy-ring-substituent-halogens",atoms:[18,19,20],bonds:[[17,18],[17,19],[17,20]],locants:[]},
      {id:"phenoxy-aryl-core",atoms:[12,13,14,15,16,21,22],bonds:[[13,14],[14,15],[15,16],[16,21],[21,22],[22,13],[12,13],[5,12]],locants:[]},
    ]},
];
const output = resolve(process.env.ORGORUSH_E2E_OUT_DIR ?? "outputs/nested-attachment-pedagogy");
let server, browser, base;
before(async () => {
  if (process.env.ORGORUSH_E2E_BASE_URL) base = process.env.ORGORUSH_E2E_BASE_URL;
  else {
    server = await createServer({configFile:"vite.pages.config.ts",server:{host:"127.0.0.1",port:0}});
    await server.listen();
    base = `http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/en/`;
  }
  browser = await chromium.launch({headless:true,...process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ? {executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE} : {}});
  await mkdir(output,{recursive:true});
}, {timeout:45000});
after(async () => { await browser?.close(); await server?.close(); });
const sorted = values => [...new Set(values)].sort((a,b)=>a-b);
const edgeKey = ([a,b]) => [a,b].sort((a,b)=>a-b).join(":");

for (const f of cases) test(`${f.id} exact nested controls, bilingual rationale and keyboard in both views`, async () => {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [], observations = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped"));
  await page.route("**/*", async route => {
    const url = new URL(route.request().url()), headers = {"access-control-allow-origin":"*"};
    if (url.origin === new URL(base).origin && !url.pathname.includes("/api/")) return route.continue();
    if (url.pathname.endsWith("/cids/JSON")) return route.fulfill({status:200,headers,
      json:{IdentifierList:{CID:[f.cid]}}});
    if (url.pathname.includes("/property/")) return route.fulfill({status:200,headers,
      json:{PropertyTable:{Properties:[{CID:f.cid,IUPACName:f.en,IsomericSMILES:f.smiles,MolecularFormula:f.formula}]}}});
    if (url.pathname.includes("/api/name-to-structure")) return route.fulfill({status:200,headers,
      json:{source:"PubChem",originalName:f.en,interpretedName:f.en,iupacName:f.en,smiles:f.smiles,cid:f.cid,molecularFormula:f.formula,warnings:[]}});
    return route.fulfill({status:200,headers,contentType:url.hostname.includes("googletagmanager")?"application/javascript":"application/json",
      body:url.hostname.includes("googletagmanager")?"":"{}"});
  });
  try {
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.getByRole("button",{name:"English",exact:true}).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(f.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const disclosure = page.locator(".reasoning-visibility-button");
    if (await disclosure.getAttribute("aria-expanded") !== "true") await disclosure.click();
    const panel = page.locator("#iupac-reasoning-content");
    await panel.locator(".reasoning-validated-name").waitFor();
    const imported = await page.locator(".molecule-stage").evaluate(node => ({
      atoms:[...node.querySelectorAll("[data-atom-id]")].map(a=>({id:Number(a.dataset.atomId),element:a.dataset.atomElement,x:0,y:0})),
      bonds:[...node.querySelectorAll("[data-bond-a]")].map(b=>[Number(b.dataset.bondA),Number(b.dataset.bondB),Number(b.dataset.bondOrder)]),
    }));
    const reference = moleculeFromSmiles(f.smiles).molecule;
    const map = mapStructuralRegions(reference,imported,f.regions.map(region=>region.atoms));
    assert.ok(map,"independent reference maps uniquely to imported graph");
    for (const language of ["en","es"]) {
      await page.getByRole("button",{name:language==="en"?"English":"Español",exact:true}).click();
      assert.equal(await panel.locator(".reasoning-validated-name").innerText(),f[language]);
      assert.equal(await panel.getAttribute("data-derivation-support"),"FULL","existing chemical reconciliation");
      const detail = panel.locator("details[data-reasoning-rationale]").filter({hasText:f.path});
      assert.equal(await detail.count(),1,"one advanced attachment explanation");
      if (!(await detail.evaluate(el=>el.open))) await detail.locator("summary").press("Enter");
      assert.ok((await detail.innerText()).includes(f.path));
      assert.match(await detail.innerText(),/4/);
      const stepTitles = await panel.locator("ol > li > div > strong").allTextContents();
      assert.equal(new Set(stepTitles.filter(t=>!t.includes("Nested")&&!t.includes("anidados"))).size,
        stepTitles.filter(t=>!t.includes("Nested")&&!t.includes("anidados")).length,"no repeated explanation stages");
      for (const mode of [0,2]) {
        await page.locator(".view-mode-switch button").nth(mode).click();
        for (const region of f.regions) {
          const control = panel.locator(`[data-name-fragment="${region.id}"]`);
          assert.equal(await control.count(),1,`${region.id} unique control`);
          await page.locator(".reasoning-visual-overlay").waitFor({state:"hidden"});
          const expected = {atoms:sorted(region.atoms.map(id=>map.get(id))),bonds:region.bonds.map(([a,b])=>edgeKey([map.get(a),map.get(b)])).sort()};
          await control.scrollIntoViewIfNeeded();
          const observed = page.waitForFunction(({id,expected}) => {
            const control = document.querySelector(`[data-name-fragment="${id}"]`);
            const overlay = document.querySelector(".reasoning-visual-overlay");
            if (control?.getAttribute("aria-pressed") !== "true" || !overlay) return null;
            const actual = {atoms:[...overlay.querySelectorAll("[data-reasoning-atom]")].map(a=>Number(a.dataset.reasoningAtom)).sort((a,b)=>a-b),
              bonds:[...overlay.querySelectorAll("[data-reasoning-bond]")].map(b=>b.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")).sort(),
              locants:[...overlay.querySelectorAll("[data-reasoning-locant]")].map(a=>[Number(a.dataset.reasoningLocant),a.querySelector("text").textContent]).sort(([a],[b])=>a-b)};
            if (JSON.stringify(actual.atoms)!==JSON.stringify(expected.atoms)||JSON.stringify(actual.bonds)!==JSON.stringify(expected.bonds)) return null;
            return actual;
          },{id:region.id,expected});
          await control.press("Enter");
          const actual = await (await observed).jsonValue();
          const permanent = await page.locator(".molecule-stage [data-atom-id]").evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.atomId,n.querySelector(".number-label")?.textContent])));
          const expectedLocants = region.locants.map(([id,n])=>[map.get(id),String(n)]).filter(([id,n])=>permanent[id]!==n).sort(([a],[b])=>a-b);
          assert.deepEqual(actual.locants,expectedLocants,`${region.id} scoped locants`);
          observations.push({language,mode,semanticId:region.id,...actual});
        }
        await page.screenshot({path:resolve(output,`${f.id}-${language}-${mode}.png`),fullPage:true});
      }
    }
    assert.deepEqual(errors,[]);
    await writeFile(resolve(output,f.id+".json"),JSON.stringify({status:"PASS",observations,errors},null,2));
  } catch (error) {
    await writeFile(resolve(output,f.id+"-failure.txt"),String(error)+"\n"+await page.locator("body").innerText());
    await page.screenshot({path:resolve(output,f.id+"-failure.png"),fullPage:true});
    throw error;
  } finally {await page.close();}
}, {timeout:180000});
