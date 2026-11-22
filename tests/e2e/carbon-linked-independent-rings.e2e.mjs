import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";
import { reasoningFragmentId } from "../../app/reasoning-visual-targets.ts";

const cases = [
  { id: "diphenylmethane", cid: 900001, smiles: "c1ccccc1Cc1ccccc1", en: "diphenylmethane", es: "difenilmetano", component: "phenyl-groups" },
  { id: "diphenylmethanol", cid: 900002, smiles: "OC(c1ccccc1)c1ccccc1", en: "diphenylmethanol", es: "difenilmetanol", component: "phenyl-groups" },
  { id: "triphenylmethanol", cid: 900003, smiles: "OC(c1ccccc1)(c1ccccc1)c1ccccc1", en: "triphenylmethanol", es: "trifenilmetanol", component: "phenyl-groups" },
  { id: "bisphenol-a", cid: 900004, smiles: "CC(C)(c1ccc(O)cc1)c1ccc(O)cc1", en: "4-[2-(4-hydroxyphenyl)propan-2-yl]phenol", es: "4-[2-(4-hidroxifenil)propan-2-il]fenol", component: "hydroxyphenyl" },
  { id: "stilbene-e", cid: 900005, smiles: "c1ccccc1/C=C/c1ccccc1", en: "(E)-1,2-diphenylethene", es: "(E)-1,2-difenileteno", component: "geometry-1" },
  { id: "benzilic-acid", cid: 900006, smiles: "O=C(O)C(O)(c1ccccc1)c1ccccc1", en: "2-hydroxy-2,2-diphenylacetic acid", es: "ácido 2-hidroxi-2,2-difenilacético", component: "diphenyl" },
  { id: "cyclohexylbenzene", cid: 900007, smiles: "c1ccccc1C1CCCCC1", en: "cyclohexylbenzene", es: "ciclohexilbenceno", component: "cyclohexyl" },
  { id: "phenylcyclohexanol", cid: 900008, smiles: "OC1(c2ccccc2)CCCCC1", en: "1-phenylcyclohexan-1-ol", es: "1-fenilciclohexan-1-ol", component: "phenyl" },
];
const output = process.env.MULTIRING_E2E_OUT_DIR ?? "reports/multiring-independent-rings/e2e";
let server, browser, origin;
before(async () => {
  server = await createServer({ configFile: fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url)), server: { host: "127.0.0.1", port: 0 } });
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
  await mkdir(output, { recursive: true });
});
after(async () => { await browser?.close(); await server?.close(); });

const sort = xs => [...xs].sort((a, b) => a - b);
const bondKey = ([a, b]) => [Number(a), Number(b)].sort((x, y) => x - y).join(":");

for (const fixture of cases) test(`${fixture.id}: bilingual parent and substituent selections survive both canvas views`, async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const graphResult = moleculeFromSmiles(fixture.smiles);
  assert.equal(graphResult.ok, true);
  const graph = graphResult.molecule;
  try {
    await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped"));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
      if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
        const data = url.pathname.includes("/property/")
          ? { PropertyTable: { Properties: [{ CID: fixture.cid, IUPACName: fixture.en, IsomericSMILES: fixture.smiles, CanonicalSMILES: fixture.smiles }] } }
          : url.pathname.includes("/description/") ? { InformationList: { Information: [{ Title: fixture.en }] } }
            : { IdentifierList: { CID: [fixture.cid] } };
        return route.fulfill({ json: data, headers: { "access-control-allow-origin": "*" } });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}", headers: { "access-control-allow-origin": "*" } });
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator("[aria-controls='smiles-interop-panel']").click();
    await page.locator("#smiles-text-input").fill(fixture.smiles);
    await page.locator("#smiles-interop-panel button[type='submit']").click();
    await page.locator("[aria-controls='smiles-interop-panel']").click();
    const panel = page.locator("#iupac-reasoning-content");
    await page.waitForFunction(() => document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support") === "FULL", null, { timeout: 30000 });
    const proof = reconcileSystematicName(graph, fixture.en);
    assert.equal(proof?.status, "FULL");
    const toggle = page.locator(".reasoning-visibility-button");
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();

    for (const language of ["es", "en"]) {
      await page.getByRole("button", { name: language === "es" ? "Español" : "English", exact: true }).click();
      await page.waitForFunction(name => document.querySelector(".iupac-dock-name")?.textContent?.trim() === name,
        language === "es" ? fixture.es : fixture.en, { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support") === "FULL",
        null, { timeout: 20000 });
      const model = buildValidatedPriorityReasoning({ derivation: proof, graph, language });
      const selected = model.steps.flatMap(step => (step.fragments ? [step.fragments, ...(step.fragments.additionalFragments ?? [])] : []).map(fragment => ({ step, fragment })))
        .find(({ fragment }) => fragment.semanticId?.includes(fixture.component));
      assert.ok(selected, `pedagogical control for ${fixture.component}`);
      const stepSelector = `#iupac-reasoning-step-${selected.step.number} button[data-name-fragment=${JSON.stringify(selected.fragment.semanticId)}]`;
      const target = selected.step.fragmentTargets[reasoningFragmentId(selected.step.number, selected.fragment)];
      assert.ok(target?.atomIds?.length);
      for (const view of ["skeletal", "semi"]) {
        await page.locator(".view-mode-switch button").nth(view === "skeletal" ? 2 : 0).click();
        await page.locator(view === "skeletal" ? ".skeletal-view .skeletal-node" : ".semi-developed-view .semi-developed-node")
          .first().waitFor({ state: "attached", timeout: 10000 });
        const button = page.locator(stepSelector);
        assert.equal(await button.count(), 1, `${language} ${view} ${fixture.component}`);
        if (await button.getAttribute("aria-pressed") === "true") {
          await button.click();
          await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute("aria-pressed") === "false", stepSelector);
        }
        await page.evaluate(() => { window.__multiringSelection = new Promise(resolve => { window.__finishMultiringSelection = resolve; }); });
        await page.evaluate(({ selector, target }) => {
          const done = window.__finishMultiringSelection;
          const snapshot = () => {
            const overlay = document.querySelector(".reasoning-visual-overlay");
            if (!overlay || document.querySelector(selector)?.getAttribute("aria-pressed") !== "true") return;
            const atoms = [...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => Number(node.dataset.reasoningAtom)).sort((a, b) => a - b);
            const bonds = [...overlay.querySelectorAll("[data-reasoning-bond]")].map(node => node.dataset.reasoningBond.split(":").map(Number).sort((a, b) => a - b).join(":")).sort();
            const expectedBonds = target.bondIds.map(([a,b]) => [Number(a),Number(b)].sort((x,y) => x-y).join(":" )).sort();
            if (JSON.stringify(atoms) === JSON.stringify([...target.atomIds].sort((a, b) => a - b)) && JSON.stringify(bonds) === JSON.stringify(expectedBonds)) {
              observer.disconnect(); clearTimeout(timer); done({ atoms, bonds });
            }
          };
          const observer = new MutationObserver(snapshot); observer.observe(document.body, { subtree: true, attributes: true, childList: true });
          const timer = setTimeout(() => {
            const overlay = document.querySelector(".reasoning-visual-overlay");
            const atoms = overlay ? [...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => Number(node.dataset.reasoningAtom)).sort((a,b) => a-b) : [];
            const bonds = overlay ? [...overlay.querySelectorAll("[data-reasoning-bond]")].map(node => node.dataset.reasoningBond).sort() : [];
            observer.disconnect(); done({ timeout: true, pressed: document.querySelector(selector)?.getAttribute("aria-pressed"), atoms, bonds });
          }, 15000);
        }, { selector: stepSelector, target });
        await button.click();
        const highlighted = await page.evaluate(() => window.__multiringSelection);
        assert.ok(highlighted && !highlighted.timeout, `${language} ${view} should highlight the exact source atoms and bonds; observed ${JSON.stringify(highlighted)}`);
        if (language === "es") await page.screenshot({ path: `${output}/${fixture.id}-${view}.png`, fullPage: true });
      }
      const text = await panel.innerText();
      assert.ok(text.length > 100, `${language} derivation should have substantive explanation text`);
      assert.doesNotMatch(text, /candidate rejected|candidato descartado|debug|diagnostic/i);
    }
  } finally { await page.close(); }
});
