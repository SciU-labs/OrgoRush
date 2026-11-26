import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { TESTOSTERONE_CHEBI_SMILES, TESTOSTERONE_REFERENCE_SMILES, EPITESTOSTERONE_REFERENCE_SMILES } from "../../app/testosterone-stereo-structure.ts";
import { TESTOSTERONE_NAMES } from "../../app/testosterone-stereo-grammar.ts";
import { reconcileSystematicName } from "../../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";
import { reasoningFragmentId } from "../../app/reasoning-visual-targets.ts";

const partialC17 = TESTOSTERONE_REFERENCE_SMILES.replace("[C@@H]2O", "C2O");
const allCases = [
  { id: "pubchem-smiles", kind: "smiles", value: TESTOSTERONE_REFERENCE_SMILES, positive: true },
  { id: "english-name", kind: "name", value: TESTOSTERONE_NAMES.en, positive: true },
  { id: "spanish-name", kind: "name", value: TESTOSTERONE_NAMES.es, positive: true },
  { id: "chebi-smiles", kind: "smiles", value: TESTOSTERONE_CHEBI_SMILES, positive: true },
  { id: "epitestosterone", kind: "smiles", value: EPITESTOSTERONE_REFERENCE_SMILES, positive: false },
  { id: "unspecified-c17", kind: "smiles", value: partialC17, positive: false },
];
const requestedCase = process.env.TESTOSTERONE_E2E_CASE;
const cases = requestedCase ? allCases.filter(fixture => fixture.id === requestedCase) : allCases;
if (requestedCase && cases.length !== 1) throw new Error(`Unknown TESTOSTERONE_E2E_CASE: ${requestedCase}`);
const requestedControls = process.env.TESTOSTERONE_E2E_CONTROL?.split(",").map(value=>value.trim()).filter(Boolean);
const outputDirectory = "reports/steroid-testosterone-pedagogy/e2e";
const report = { status: "RUNNING", browser: null, cases: [], errors: [], failedRequests: [], unexpectedRequests: [], optionalRequests: [] };
let server, browser, origin;
before(async () => {
  await mkdir(outputDirectory, { recursive: true });
  server = await createServer({ configFile: fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url)), server: { host: "127.0.0.1", port: 0 } });
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
  report.browser = browser.version();
});
after(async () => {
  report.status = report.cases.length === cases.length && report.cases.every(item=>item.status==="PASS")
    && report.errors.length === 0 && report.failedRequests.length === 0 && report.unexpectedRequests.length === 0 ? "PASS" : "FAIL";
  await writeFile(`${outputDirectory}/results.json`, JSON.stringify(report, null, 2) + "\n");
  await browser?.close(); await server?.close();
});
const sorted = items => [...new Set(items)].sort((a, b) => a - b);
const bondKey = ([a, b]) => [Number(a), Number(b)].sort((x, y) => x - y).join(":");
async function setView(page,mode){
  const index=mode==="semi"?0:2,button=page.locator(".view-mode-switch button").nth(index);
  await button.evaluate(node=>{if(node.getAttribute("aria-pressed")!=="true")node.click();});
  await page.waitForFunction(index=>document.querySelectorAll(".view-mode-switch button")[index]?.getAttribute("aria-pressed")==="true",index);
  await page.locator(mode==="semi"?".semi-developed-view .semi-developed-node":".skeletal-view .skeletal-node")
    .first().waitFor({state:"visible",timeout:20000});
}
async function openDetails(details){
  await details.waitFor({state:"attached",timeout:10000});
  if(!await details.evaluate(node=>node.open)){
    await details.locator("summary").evaluate(node=>node.click());
    assert.equal(await details.evaluate(node=>node.open),true,"advanced details opens from its summary");
  }
}

async function observeSelection(page, button, target, semanticId) {
  const selector = await button.evaluate(node => `#${node.closest('[id^="iupac-reasoning-step-"]').id} button[data-name-fragment=${JSON.stringify(node.dataset.nameFragment)}]`);
  await page.evaluate(({ selector, target, semanticId }) => {
    let finish, observer, timer;
    window.__testosteroneSelection = { promise: new Promise(resolve => { finish = resolve; }) };
    const done = value => { clearTimeout(timer); observer?.disconnect(); finish(value); };
    const check = () => {
      const overlay = document.querySelector(".reasoning-visual-overlay");
      const control = document.querySelector(selector);
      if (!overlay || control?.getAttribute("aria-pressed") !== "true") return;
      const actual = {
        atoms: [...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => +node.dataset.reasoningAtom).sort((a, b) => a - b),
        bonds: [...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")].map(node => node.dataset.reasoningBond.split(":").map(Number).sort((a, b) => a - b).join(":")))].sort(),
      };
      const expected = {
        atoms: [...new Set(target.atomIds)].sort((a, b) => a - b),
        bonds: [...new Set(target.bondIds.map(([a, b]) => [a, b].sort((x, y) => x - y).join(":")))].sort(),
      };
      if (JSON.stringify(actual) === JSON.stringify(expected)) done({ ok: true, actual });
    };
    observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    timer = setTimeout(() => {
      const overlay=document.querySelector(".reasoning-visual-overlay");
      const actual=overlay?{
        atoms:[...overlay.querySelectorAll("[data-reasoning-atom]")].map(node=>+node.dataset.reasoningAtom).sort((a,b)=>a-b),
        bonds:[...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")].map(node=>node.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")))].sort(),
      }:null;
      done({ ok: false, selector, semanticId, pressed: document.querySelector(selector)?.getAttribute("aria-pressed"),actual,expected:{
        atoms:[...new Set(target.atomIds)].sort((a,b)=>a-b),
        bonds:[...new Set(target.bondIds.map(([a,b])=>[a,b].sort((x,y)=>x-y).join(":")))].sort(),
      }});
    }, 7000);
  }, { selector, target, semanticId });
  assert.equal(await button.isVisible(), true, `${semanticId}: control is visible and enabled`);
  assert.equal(await button.isEnabled(), true, `${semanticId}: control is enabled`);
  await button.evaluate(node => node.click());
  const observed = await page.evaluate(() => window.__testosteroneSelection.promise);
  assert.equal(observed.ok, true, `${semanticId}: ${JSON.stringify(observed)}`);
  return observed.actual;
}

for (const fixture of cases) test(`${fixture.id}: EN/ES, skeletal/semi and exact graph selections`, async () => {
  const entry = { id: fixture.id, positive: fixture.positive, combinations: [], controlsChecked: 0, optionalRequests: [] };
  report.cases.push(entry);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [], requestFailures = [], unexpected = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") pageErrors.push(message.text()); });
  page.on("requestfailed", request => { if (request.failure()?.errorText !== "net::ERR_ABORTED") requestFailures.push({ url: request.url(), error: request.failure()?.errorText }); });
  try {
    await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped"));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === "www.googletagmanager.com") {
        entry.optionalRequests.push(url.href);
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      }
      if (url.hostname === "fonts.gstatic.com") {
        entry.optionalRequests.push(url.href);
        return route.fulfill({ status: 204, body: "" });
      }
      if (url.hostname === "pubchem.ncbi.nlm.nih.gov") return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
      if (["es.wikipedia.org", "en.wikipedia.org"].includes(url.hostname)) return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"query":{"pages":{}}}' });
      unexpected.push(url.href); return route.abort();
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    if (fixture.kind === "smiles") {
      await page.locator('[aria-controls="smiles-interop-panel"]').click();
      await page.locator("#smiles-text-input").fill(fixture.value);
      await page.locator('#smiles-interop-panel button[type="submit"]').click();
      await page.locator('[aria-controls="smiles-interop-panel"]').click();
    } else {
      await page.locator('[aria-controls="iupac-name-builder"]').click();
      await page.locator("#iupac-name-input").fill(fixture.value);
      await page.locator('#iupac-name-builder button[type="submit"]').click();
    }
    const panel = page.locator("#iupac-reasoning-content");
    await panel.waitFor({ state: "visible", timeout: 30000 });
    if (fixture.positive) {
      await page.waitForFunction(() => document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support") === "FULL", null, { timeout: 30000 });
      const referenceGraph = moleculeFromSmiles(fixture.kind === "smiles" ? fixture.value : TESTOSTERONE_REFERENCE_SMILES).molecule;
      const proofs = Object.fromEntries([["en", TESTOSTERONE_NAMES.en], ["es", TESTOSTERONE_NAMES.es]].map(([language, name]) => [language, reconcileSystematicName(referenceGraph, name)]));
      assert.equal(proofs.en?.status, "FULL"); assert.equal(proofs.es?.status, "FULL");
      for (const language of ["es", "en"]) {
        if (language === "en") await page.getByRole("button", { name: "English", exact: true }).click();
        await page.waitForFunction(name => document.querySelector(".iupac-dock-name")?.textContent?.trim() === name,
          language === "en" ? TESTOSTERONE_NAMES.en : TESTOSTERONE_NAMES.es, { timeout: 20000 });
        await page.waitForFunction(title=>document.querySelector("#iupac-reasoning-step-1 > div > strong")?.textContent?.trim()===title,
          language==="en"?"Identify the steroid skeleton":"Identificar el esqueleto esteroideo",{timeout:20000});
        assert.equal(await panel.getAttribute("data-derivation-support"), "FULL", `${fixture.id}/${language}`);
        const visibleName = language === "en" ? TESTOSTERONE_NAMES.en : TESTOSTERONE_NAMES.es;
        assert.equal(await panel.locator(".reasoning-validated-name").innerText(), visibleName);
        const model = buildValidatedPriorityReasoning({ derivation: proofs[language], graph: referenceGraph, language, activeName: visibleName });
        const allExpectedIds = ["testosterone-parent", ...["A", "B", "C", "D"].map(x => `testosterone-ring-${x}`), ...["ab", "bc", "cd"].map(x => `testosterone-fusion-${x}`),
          ...Array.from({ length: 19 }, (_, i) => `testosterone-locant-${i + 1}`), "testosterone-unsaturation-4",
          "testosterone-carbonyl-3", "testosterone-hydroxy-17", "testosterone-17beta", "testosterone-global-stereo",
          "testosterone-androstane-core", "testosterone-c18", "testosterone-c19", "testosterone-17beta-bond"];
        const routeControlIds = ["testosterone-parent", "testosterone-locant-4", "testosterone-locant-17",
          "testosterone-locant-18", "testosterone-locant-19", "testosterone-unsaturation-4",
          "testosterone-carbonyl-3", "testosterone-hydroxy-17", "testosterone-17beta", "testosterone-global-stereo",
          "testosterone-androstane-core", "testosterone-c18", "testosterone-c19", "testosterone-17beta-bond"];
        assert.equal(model.steps.length, 6, `${language}: exactly six progressive stages`);
        assert.deepEqual(model.steps.map(step => step.number), ["1", "2", "3", "4", "5", "6"]);
        const renderedSteps = panel.locator("ol[data-testosterone-steps='6'] > li");
        assert.equal(await renderedSteps.count(), 6, `${language}: six rendered stages`);
        for(let index=0;index<6;index++){
          const item=renderedSteps.nth(index);
          assert.equal((await item.evaluate(node=>node.firstElementChild?.textContent?.trim())),String(index+1),`${language}: visible step number is not duplicated`);
          assert.equal(await item.evaluate(node=>getComputedStyle(node).listStyleType),"none",`${language}: list marker does not add a second number`);
        }
        if(language==="es"){
          const advancedDetails=panel.locator("details.testosterone-advanced-controls");
          for(let index=0;index<await advancedDetails.count();index++)assert.equal(await advancedDetails.nth(index).evaluate(node=>node.open),false,`${language}: advanced explanation starts collapsed`);
        }
        const renderedText = await panel.innerText();
        assert.doesNotMatch(renderedText, language === "en" ? /estereoparent|hidroxiandrost/ : /stereoparent|hydroxyandrost/);
        assert.match(renderedText,language==="en"?/C1–C17.*C18.*C13.*C19.*C10.*gonane|Why androstane/s:/C1–C17.*C18.*C13.*C19.*C10.*gonano|¿Por qué androstano\?/s);
        assert.equal(await panel.locator('[data-name-fragment="testosterone-locant-18"]').count(), 1, "C18 appears only in the carbon explorer");
        assert.equal(await panel.locator('[data-name-fragment="testosterone-locant-19"]').count(), 1, "C19 appears only in the carbon explorer");
        assert.equal(await panel.locator("[data-testosterone-name-result]").count(),1);
        assert.equal((await panel.locator("[data-testosterone-name-result]").innerText()).trim(),visibleName,`${language}: rendered and copyable name preserves all hyphens`);
        assert.deepEqual(await panel.locator(".testosterone-name-part code").allTextContents(),language=== "en"
          ?["17β-hydroxy","androst-","4-en-","3-one"]:["17β-hidroxi","androst-","4-en-","3-ona"]);
        for (const mode of ["semi", "skeletal"]) {
          const expectedForMode = fixture.id === "pubchem-smiles" && language === "es" && mode === "semi"
            ? allExpectedIds : routeControlIds;
          const expectedIds=requestedControls?expectedForMode.filter(id=>requestedControls.includes(id)):expectedForMode;
          if(requestedControls&&expectedIds.length!==requestedControls.length)
            throw new Error(`Unknown TESTOSTERONE_E2E_CONTROL: ${requestedControls.filter(id=>!expectedForMode.includes(id)).join(", ")}`);
          await setView(page,mode);
          const viewSelector = mode === "semi" ? ".semi-developed-view .semi-developed-node" : ".skeletal-view .skeletal-node";
          await page.locator(viewSelector).first().waitFor({ state: "visible" });
          if (fixture.id === "pubchem-smiles") await page.screenshot({ path: `${outputDirectory}/testosterone-${language}-${mode}.png`, fullPage: true });
          const locantExplorer = panel.locator("[data-testosterone-locant-explorer]");
          if (fixture.id === "pubchem-smiles" && language === "es" && mode === "semi") {
            if (await locantExplorer.evaluate(node => node.open)) await locantExplorer.locator("summary").click();
            assert.equal(await locantExplorer.evaluate(node => node.open), false, "the 19-carbon explorer starts collapsed");
            const locantSummary = locantExplorer.locator("summary");
            await locantSummary.focus(); await locantSummary.press("Enter");
            assert.equal(await locantExplorer.evaluate(node => node.open), true, "the locator explorer opens with the keyboard");
            assert.equal(await locantExplorer.locator("button[data-name-fragment^='testosterone-locant-']").count(), 19);
            await locantSummary.press("Enter");
            assert.equal(await locantExplorer.evaluate(node => node.open), false, "the locator explorer closes with the keyboard");
            for(const [selector,label] of [["[data-testosterone-skeleton-rationale]","¿Por qué androstano?"],["[data-testosterone-beta-rationale]","¿Por qué β y no α?"]]){
              const details=panel.locator(selector),summary=details.locator("summary");
              assert.equal(await details.evaluate(node=>node.open),false,`${label} starts collapsed`);
              assert.equal(await summary.innerText(),label,`${label} has an accessible summary`);
              await summary.focus();await summary.press("Enter");
              assert.equal(await details.evaluate(node=>node.open),true,`${label} opens with the keyboard`);
              await summary.press("Enter");
              assert.equal(await details.evaluate(node=>node.open),false,`${label} closes with the keyboard`);
            }
          }
          for (const semanticId of expectedIds) {
            const step = model.steps.find(candidate => [candidate.fragments, ...(candidate.fragments?.additionalFragments ?? [])].some(fragment => fragment?.semanticId === semanticId));
            assert.ok(step, `${language}/${mode}: model has ${semanticId}`);
            const fragment = [step.fragments, ...(step.fragments?.additionalFragments ?? [])].find(candidate => candidate?.semanticId === semanticId);
            const target = step.fragmentTargets[reasoningFragmentId(step.number, fragment)];
            assert.ok(target, `${language}/${mode}: target has ${semanticId}`);
            if (semanticId.startsWith("testosterone-ring-") || semanticId.startsWith("testosterone-fusion-")) {
              await openDetails(panel.locator("[data-testosterone-ring-details]"));
            }
            if (semanticId.startsWith("testosterone-locant-")) {
              await openDetails(panel.locator("[data-testosterone-locant-explorer]"));
            }
            if (["testosterone-androstane-core","testosterone-c18","testosterone-c19"].includes(semanticId)) {
              await openDetails(panel.locator("[data-testosterone-skeleton-rationale]"));
            }
            if(semanticId==="testosterone-17beta-bond"){
              await openDetails(panel.locator("[data-testosterone-beta-rationale]"));
            }
            if (semanticId === "testosterone-global-stereo") {
              await openDetails(panel.locator("[data-testosterone-stereo-details]"));
            }
            const control = panel.locator(`#iupac-reasoning-step-${step.number} button[data-name-fragment=${JSON.stringify(semanticId)}]`);
            assert.equal(await control.count(), 1, `${fixture.id}/${language}/${mode}: unique ${semanticId}`);
            const selected = await observeSelection(page, control, target, semanticId);
            assert.deepEqual(selected.atoms, sorted(target.atomIds), `${semanticId} atom IDs`);
            assert.deepEqual(selected.bonds, [...new Set(target.bondIds.map(bondKey))].sort(), `${semanticId} bond IDs`);
            entry.controlsChecked++;
          }
          if(fixture.id==="pubchem-smiles"&&language==="es"&&mode==="semi"){
            const rationale=panel.locator("[data-testosterone-beta-rationale]");await openDetails(rationale);
            assert.match(await rationale.innerText(),/β.*C18.*α\/β.*R\/S.*epímero 17α/s);
            const skeleton=panel.locator("[data-testosterone-skeleton-rationale]");await openDetails(skeleton);
            assert.match(await skeleton.innerText(),/gonano.*estrano.*androstano.*comparación estructural y nomenclatural.*no una secuencia de reacciones/is);
            await page.context().grantPermissions(["clipboard-read","clipboard-write"],{origin});
            await panel.locator("[data-testosterone-name-result]").evaluate(node=>{
              const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(node);selection?.removeAllRanges();selection?.addRange(range);
            });
            await page.keyboard.press("Control+C");
            assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),TESTOSTERONE_NAMES.es,"copied systematic name preserves punctuation");
          }
          entry.combinations.push({ language, mode, support: "FULL" });
        }
      }
      if(fixture.id==="pubchem-smiles"){
        await page.setViewportSize({width:390,height:844});
        const mobileLayout=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,
          overflowing:[...document.querySelectorAll("body *")].filter(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.right>window.innerWidth+1;})
            .slice(0,10).map(node=>({tag:node.tagName,className:typeof node.className==="string"?node.className:"",right:Math.round(node.getBoundingClientRect().right)}))}));
        assert.equal(mobileLayout.document<=mobileLayout.viewport,true,`mobile page width: ${JSON.stringify(mobileLayout)}`);
        assert.deepEqual(mobileLayout.overflowing,[],`mobile controls stay within the viewport: ${JSON.stringify(mobileLayout)}`);
        await page.screenshot({path:`${outputDirectory}/testosterone-mobile-es.png`,fullPage:true});
      }
    } else {
      await page.waitForFunction(() => Boolean(document.querySelector("#iupac-reasoning-content")?.innerText.trim()), null, { timeout: 30000 });
      assert.notEqual(await panel.getAttribute("data-derivation-support"), "FULL", `${fixture.id}: unsupported structure cannot be FULL`);
      for (const language of ["es", "en"]) {
        if (language === "en") await page.getByRole("button", { name: "English", exact: true }).click();
        for (const mode of ["semi", "skeletal"]) {
          await setView(page,mode);
          await page.locator(mode === "semi" ? ".semi-developed-view .semi-developed-node" : ".skeletal-view .skeletal-node").first().waitFor({ state: "attached" });
          const support = await panel.getAttribute("data-derivation-support");
          assert.notEqual(support, "FULL", `${fixture.id}/${language}/${mode} cannot be testosterone FULL`);
          entry.combinations.push({ language, mode, support });
        }
      }
    }
    report.errors.push(...pageErrors.map(error => ({ case: fixture.id, error })));
    report.failedRequests.push(...requestFailures.map(error => ({ case: fixture.id, ...error })));
    report.unexpectedRequests.push(...unexpected.map(url => ({ case: fixture.id, url })));
    report.optionalRequests.push(...entry.optionalRequests);
    assert.deepEqual(pageErrors, [], `${fixture.id}: page and console errors`);
    assert.deepEqual(requestFailures, [], `${fixture.id}: failed requests`);
    assert.deepEqual(unexpected, [], `${fixture.id}: unexpected requests`);
    entry.status = "PASS";
  } catch (error) {
    entry.status = "FAIL"; entry.error = String(error);
    await page.screenshot({ path: `${outputDirectory}/${fixture.id}-failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally { await page.close(); }
}, { timeout: 900000 });
