import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { PROGESTERONE_CHEBI_SMILES, PROGESTERONE_NAMES, PROGESTERONE_REFERENCE_SMILES,
  inspectProgesteroneGraph } from "../../app/progesterone-stereo-grammar.ts";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";

const cases = [{ id: "pubchem", smiles: PROGESTERONE_REFERENCE_SMILES }];
const output = resolve("reports/steroid-pedagogy-engine/e2e");
const report = { status: "RUNNING", browser: null, cases: [], errors: [], unexpectedRequests: [] };
let server, browser, base;
before(async () => {
  server = await createServer({ configFile: fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url)), server: { host: "127.0.0.1", port: 0 } });
  await server.listen(); base = `http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/en/`;
  browser = await chromium.launch({ headless: true, ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
  report.browser = browser.version(); await mkdir(output, { recursive: true });
}, { timeout: 45000 });
after(async () => {
  report.status = report.cases.length === cases.length * 4 && report.errors.length === 0 && report.unexpectedRequests.length === 0 ? "PASS" : "FAIL";
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  await browser?.close(); await server?.close();
});

async function setView(page, representation) {
  const index = representation === "semi" ? 0 : 2;
  const button = page.locator(".view-mode-switch button").nth(index);
  await button.evaluate(node => { if (node.getAttribute("aria-pressed") !== "true") node.click(); });
  await page.waitForFunction(index => document.querySelectorAll(".view-mode-switch button")[index]?.getAttribute("aria-pressed") === "true", index);
  await page.locator(representation === "semi" ? ".semi-developed-view .semi-developed-node" : ".skeletal-view .skeletal-node").first().waitFor({ state: "visible" });
}
async function enterName(page, name) {
  const toggle = page.locator('[aria-controls="iupac-name-builder"]');
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await page.locator("#iupac-name-input").fill(name);
  await page.locator("#iupac-name-builder button[type=submit]").click();
  await page.locator("#iupac-name-input").waitFor({ state: "hidden" });
  const panel = page.locator("#iupac-reasoning-content");
  await panel.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support") === "FULL");
  assert.equal((await panel.getAttribute("data-derivation-support")), "FULL", `${name} strict FULL`);
  assert.ok((await panel.innerText()).includes(name), `${name} is displayed in the derivation`);
}
async function selection(page, semanticId, target) {
  const control = page.locator(`[data-name-fragment="${semanticId}"]`);
  assert.equal(await control.count(), 1, `one interactive control for ${semanticId}`);
  const selector = `[data-name-fragment="${semanticId}"]`;
  const expected = { atoms: [...new Set(target.atomIds)].sort((a,b)=>a-b),
    bonds: [...new Set(target.bondIds.map(([a,b])=>[a,b].sort((x,y)=>x-y).join(":")))].sort() };
  const observedPromise = page.waitForFunction(({ selector, expected }) => {
    const control = document.querySelector(selector);
    if (control?.getAttribute("aria-pressed") !== "true") return null;
    const overlay = document.querySelector(".reasoning-visual-overlay");
    if (!overlay || !overlay.getClientRects().length) return null;
    const actual = { atoms: [...new Set([...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => Number(node.dataset.reasoningAtom)))].sort((a,b)=>a-b),
      bonds: [...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")].map(node => node.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")))].sort() };
    return JSON.stringify(actual) === JSON.stringify(expected) ? actual : null;
  }, { selector, expected }, { timeout: 5000 });
  await control.evaluate(node => node.click());
  try { return await (await observedPromise).jsonValue(); }
  catch (error) {
    const state = await page.evaluate(selector => {
      const control = document.querySelector(selector), overlay = document.querySelector(".reasoning-visual-overlay");
      return { pressed: control?.getAttribute("aria-pressed"), overlayExists: Boolean(overlay), overlayVisible: Boolean(overlay?.getClientRects().length),
        atoms: overlay ? [...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => Number(node.dataset.reasoningAtom)).sort((a,b)=>a-b) : [],
        bonds: overlay ? [...overlay.querySelectorAll("[data-reasoning-bond]")].map(node => node.dataset.reasoningBond) : [] };
    }, selector);
    throw new Error(`${semanticId}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(state)}; ${String(error)}`);
  }
}

test("progesterone FULL and exact targets in both locales and canvas representations", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [], consoleErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") return route.fulfill({ status: 200, contentType: "application/javascript", body: "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){};" });
    if (url.hostname === "fonts.gstatic.com") return route.fulfill({ status: 204, body: "" });
    if (url.hostname === "pubchem.ncbi.nlm.nih.gov" && /^\/rest\/pug\/compound\/smiles\/.*\/cids\/JSON$/i.test(url.pathname))
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"IdentifierList":{"CID":[]}}' });
    if (url.hostname.endsWith("wikipedia.org") && url.pathname === "/w/api.php")
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"query":{"pages":{}}}' });
    report.unexpectedRequests.push(`${route.request().method()} ${url.href}`);
    return route.fulfill({ status: 404, body: "" });
  });
  try {
    await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped"));
    await page.goto(base, { waitUntil: "domcontentloaded" });
    try { await page.locator(".guided-tour-skip").click({ timeout: 1000 }); } catch {}
    for (const fixture of cases) {
      const imported = moleculeFromSmiles(fixture.smiles); assert.equal(imported.ok, true);
      const structure = inspectProgesteroneGraph(imported.molecule); assert.ok(structure);
      const toggle = page.locator('[aria-controls="smiles-interop-panel"]');
      if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
      await page.locator("#smiles-text-input").fill(fixture.smiles);
      await page.locator("#smiles-interop-panel button[type=submit]").click();
      await page.locator(".molecule-stage").waitFor({ state: "visible" });
      await enterName(page, PROGESTERONE_NAMES.en);
      await page.getByRole("button", { name: "Español", exact: true }).click();
      await enterName(page, PROGESTERONE_NAMES.es);
      for (const language of ["Español", "English"]) {
        if (language === "English") await page.getByRole("button", { name: "English", exact: true }).click();
        const name = language === "English" ? PROGESTERONE_NAMES.en : PROGESTERONE_NAMES.es;
        const proof = reconcileSystematicName(imported.molecule,name); assert.equal(proof?.status,"FULL");
        for (const representation of ["skeletal", "semi"]) {
          await setView(page,representation);
          const panel = page.locator("#iupac-reasoning-content");
          const text = await panel.innerText();
          assert.match(text,/C20/); assert.match(text,/C21/);
          assert.match(text,language === "English" ? /dione/ : /diona/);
          assert.doesNotMatch(text,language === "English" ? /hydroxy prefix|alcohol suffix/i : /prefijo hidroxi|sufijo de alcohol/i);
          const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph: imported.molecule, language: language === "English" ? "en" : "es", activeName: name });
          assert.equal(await panel.locator("ol > li").count(),6);
          const rationales = panel.locator("details[data-steroid-rationale]");
          assert.equal(await rationales.count(), reasoning.steps.filter(step => step.advancedExplanation).length);
          const rationale = rationales.first();
          const summary = rationale.locator("summary");
          assert.equal(await summary.innerText(),language === "English" ? "Why?" : "¿Por qué?");
          const byId = new Map(proof.components.map(component => [component.id,component]));
          for (const id of ["steroid-side-chain", "steroid-unsaturation-4", "steroid-ketone-3", "steroid-ketone-20", "steroid-stereo"]) {
            const step = reasoning.steps.find(candidate => candidate.componentIds.includes(id)); assert.ok(step, `${id} has a reasoning step`);
            const component = byId.get(id); assert.ok(component);
            const expected = { atomIds: [...new Set(component.atomIds)].sort((a,b)=>a-b),
              bondIds: [...new Set(component.bondIds.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":")))].sort() };
            const actual = await selection(page,id,component);
            assert.deepEqual(actual.atoms,expected.atomIds,`${fixture.id}/${language}/${representation} ${id} atoms`);
            assert.deepEqual(actual.bonds,expected.bondIds,`${fixture.id}/${language}/${representation} ${id} bonds`);
          }
          await summary.focus(); await page.keyboard.press("Enter");
          assert.equal(await rationale.evaluate(node => node.open),true,"advanced explanation opens from keyboard");
          const rationaleText = await rationale.innerText();
          assert.ok(language === "English" ? /verified|mapped|graph|reference/i.test(rationaleText) : /verificad|mapead|grafo|referencia/i.test(rationaleText),"advanced rationale is localized and evidence based");
          await page.keyboard.press("Enter");
          assert.equal(await rationale.evaluate(node => node.open),false,"advanced explanation closes from keyboard");
          if (fixture.id === "pubchem" && ((language === "English" && representation === "skeletal") || (language === "Español" && representation === "semi")))
            await page.screenshot({ path: resolve(output,`progesterone-${language.toLowerCase()}-${representation}.png`), fullPage: true });
          report.cases.push({ id: fixture.id, language, representation, status: "FULL", locants: structure.locants, selections: 5 });
        }
      }
    }
  } catch (error) {
    report.errors.push(String(error)); throw error;
  } finally { await page.close(); }
  assert.deepEqual(pageErrors,[]); assert.deepEqual(consoleErrors,[]); assert.deepEqual(report.unexpectedRequests,[]);
}, { timeout: 600000 });
