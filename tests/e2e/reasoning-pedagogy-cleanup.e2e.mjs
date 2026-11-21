import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { buildValidatedPriorityReasoning } from "../../app/reasoning-derivation-adapter.ts";
import { reconcileSystematicName } from "../../app/validated-name-derivation.ts";
import { reasoningFragmentId } from "../../app/reasoning-visual-targets.ts";

const smiles = "CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F";
const systematicName = "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine";
const graph = moleculeFromSmiles(smiles).molecule;
const derivation = reconcileSystematicName(graph, systematicName);
assert.equal(derivation?.status, "FULL");
const reasoning = buildValidatedPriorityReasoning({ derivation, graph, language: "es", activeName: systematicName });
const controls = ["parent", "n-alkyl", "phenoxy"].map(semanticId => {
  const step = reasoning.steps.find(item => [item.fragments, ...(item.fragments?.additionalFragments ?? [])]
    .some(fragment => fragment?.semanticId === semanticId));
  const fragment = [step?.fragments, ...(step?.fragments?.additionalFragments ?? [])]
    .find(item => item?.semanticId === semanticId);
  assert.ok(step && fragment, `${semanticId} is a pedagogical control`);
  const target = step.fragmentTargets[reasoningFragmentId(step.number, fragment)];
  assert.ok(target, `${semanticId} has a graph target`);
  return { semanticId, step: step.number, atoms: [...target.atomIds].sort((a,b)=>a-b),
    bonds: target.bondIds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":")).sort() };
});

let server, browser, origin;
before(async () => {
  server = await createServer({ configFile: "vite.pages.config.ts", server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
});
after(async () => { await browser?.close(); await server?.close(); });

test("fluoxetine reasoning is concise, bilingual and graph-selectable in both canvas views", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped"));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
      if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
        const data = url.pathname.includes("/property/")
          ? { PropertyTable: { Properties: [{ CID: 3386, IUPACName: systematicName,
            IsomericSMILES: smiles, CanonicalSMILES: smiles }] } }
          : url.pathname.includes("/description/") ? { InformationList: { Information: [{ Title: "Fluoxetine" }] } }
            : { IdentifierList: { CID: [3386] } };
        return route.fulfill({ json: data, headers: { "access-control-allow-origin": "*" } });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}",
        headers: { "access-control-allow-origin": "*" } });
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const panel = page.locator("#iupac-reasoning-content");
    await panel.waitFor({ state: "visible", timeout: 30000 });
    await page.waitForFunction(() => document.querySelector("#iupac-reasoning-content")?.getAttribute("data-derivation-support") === "FULL",
      null, { timeout: 30000 });
    assert.equal(await panel.getAttribute("data-derivation-support"), "FULL");
    const help = page.locator(".reasoning-visibility-button");
    if (await help.getAttribute("aria-expanded") !== "true") await help.click();

    for (const language of ["es", "en"]) {
      await page.getByRole("button", { name: language === "es" ? "Español" : "English", exact: true }).click();
      for (const [view, viewIndex] of [["semi", 0], ["skeletal", 2]]) {
        await page.locator(".view-mode-switch button").nth(viewIndex).click();
        await page.locator(view === "semi" ? ".semi-developed-view .semi-developed-node" : ".skeletal-view .skeletal-node")
          .first().waitFor({ state: "attached" });
        const visibleText = await panel.innerText();
        assert.doesNotMatch(visibleText,
          /skeletal atom count|enumerated carbon paths|evaluated; not selected|evaluado; no seleccionado|not compared|sin comparar|candidate regions|regiones candidatas|parent candidates|candidatos a padre|principal-group suffix count|isomorphism|P-\d+|not been reconciled|no se ha conciliado/i,
          `${language}/${view}: internal selector diagnostics must not reach the learner`);
        assert.equal(await panel.locator("[data-parent-candidate]").count(), 0);
        assert.equal(await panel.locator("[data-parent-selection-level]").count(), 0);
        assert.match(visibleText, language === "es" ? /amina|fenil|fenoxi/i : /amine|phenyl|phenoxy/i);
        for (const target of controls) {
          const button = panel.locator(`#iupac-reasoning-step-${target.step} [data-name-fragment="${target.semanticId}"]`);
          assert.equal(await button.count(), 1, `${language}/${view}: ${target.semanticId}`);
          const actual = await button.evaluate(element => new Promise((resolve, reject) => {
            const root = document.querySelector(".molecule-stage");
            const read = () => {
              const overlay = root?.querySelector(".reasoning-visual-overlay");
              if (!overlay || element.getAttribute("aria-pressed") !== "true") return;
              observer.disconnect(); clearTimeout(timer);
              resolve({ atoms: [...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => +node.dataset.reasoningAtom).sort((a,b)=>a-b),
                bonds: [...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")]
                  .map(node => node.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")))].sort() });
            };
            const observer = new MutationObserver(read);
            observer.observe(root, { childList: true, subtree: true, attributes: true });
            observer.observe(element, { attributes: true });
            const timer = setTimeout(() => { observer.disconnect(); reject(Error("No structural selection overlay")); }, 5000);
            element.click(); read();
          }));
          assert.deepEqual(actual, { atoms: target.atoms, bonds: target.bonds }, `${language}/${view}: ${target.semanticId}`);
        }
      }
    }
  } finally { await page.close(); }
});
