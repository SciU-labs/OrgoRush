import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { chromium } from "playwright";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { formatStereochemicalName, getMainChainStereoDescriptors, inspectDoubleBondCipPriorities } from "../../app/double-bond-stereochemistry.ts";
import { getMainChainTetrahedralDescriptors } from "../../app/tetrahedral-stereochemistry.ts";
import { loadExerciseChemistry } from "../helpers/exercise-chemistry.mjs";

const fixtures = [
  { id: "maleic-acid", smiles: "O=C(O)/C=C\\C(=O)O", name: "(2Z)-but-2-enedioic acid" },
  { id: "sorbic-acid", smiles: "C/C=C/C=C/C(=O)O", name: "(2E,4E)-hexa-2,4-dienoic acid" },
  { id: "synthetic-mixed", smiles: "C/C=C/[C@H](O)C" },
];
let server, browser, origin, chemistry;
before(async () => {
  chemistry = await loadExerciseChemistry();
  server = await createServer({ configFile: "vite.pages.config.ts", server: { host: "127.0.0.1", port: 0 } });
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
});
after(async () => { await browser?.close(); await server?.close(); await chemistry?.close(); });

for (const fixture of fixtures) test(`${fixture.id}: E/Z CIP controls select exact branches in both locales and views`, async () => {
  const graph = moleculeFromSmiles(fixture.smiles).molecule;
  const analysis = chemistry.engine.analyzeMolecule(graph);
  const name = fixture.name ?? formatStereochemicalName(graph, analysis.mainChain, analysis.name, { explicitDoubleBonds: true });
  const descriptors = getMainChainStereoDescriptors(graph, analysis.mainChain, true);
  assert.ok(descriptors.length);
  const tetrahedral = getMainChainTetrahedralDescriptors(graph, analysis.mainChain);
  if (fixture.id === "synthetic-mixed") assert.equal(tetrahedral.length, 1);
  const expected = descriptors.flatMap(descriptor => {
    const evidence = inspectDoubleBondCipPriorities(graph, ...descriptor.atomIds);
    assert.equal(evidence.configuration, descriptor.configuration);
    return [
      { id: `stereo:ez:${descriptor.locant}`, atoms: descriptor.atomIds, bonds: [descriptor.atomIds] },
      { id: `stereo:ez:${descriptor.locant}:locant`, atoms: [descriptor.atomIds[0]], bonds: [] },
      ...evidence.sides.flatMap((side, index) => side.flatMap(priority => priority.atomId === null ? [] : [{
        id: `stereo:ez:${descriptor.locant}:C${descriptor.locant + index}:priority${priority.rank}`,
        atoms: [...priority.branchAtomIds, descriptor.atomIds[index]], bonds: priority.branchBondIds,
      }])),
    ];
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped"));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
      if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
        const cid = fixture.id === "maleic-acid" ? 4450 : fixture.id === "sorbic-acid" ? 643460 : 990002;
        const data = url.pathname.includes("/property/")
          ? { PropertyTable: { Properties: [{ CID: cid, IUPACName: name,
            IsomericSMILES: fixture.smiles, CanonicalSMILES: fixture.smiles }] } }
          : url.pathname.includes("/description/") ? { InformationList: { Information: [{ Title: fixture.id }] } }
            : { IdentifierList: { CID: [cid] } };
        return route.fulfill({ json: data, headers: { "access-control-allow-origin": "*" } });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}", headers: { "access-control-allow-origin": "*" } });
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(fixture.smiles);
    await page.locator("#smiles-interop-panel button[type=submit]").click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const panel = page.locator("#iupac-reasoning-content");
    await panel.waitFor({ state: "visible", timeout: 30000 });
    await panel.locator('[data-name-fragment^="stereo:ez:"]').first().waitFor({ state: "attached", timeout: 30000 });
    const toggle = page.locator(".reasoning-visibility-button");
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    for (const language of ["es", "en"]) {
      await page.getByRole("button", { name: language === "es" ? "Español" : "English", exact: true }).click();
      // The visible title is localized by the application; locate its E/Z step by controls.
      const stereoStage = panel.locator("li").filter({ has: page.locator('[data-name-fragment^="stereo:ez:"]') }).first();
      await stereoStage.waitFor({ state: "visible", timeout: 15000 });
      const explanation = await stereoStage.locator("p").allTextContents();
      assert.ok(explanation.join(" ").length > 20);
      if (language === "es") assert.match(explanation.join(" "), /CIP|prioridad|primer punto/i);
      else assert.match(explanation.join(" "), /CIP|priority|first point/i);
      if (fixture.id === "synthetic-mixed") assert.ok(tetrahedral.some(item =>
        explanation.join(" ").includes(language === "es"
          ? `C${item.locant} tiene configuración ${item.configuration}`
          : `C${item.locant} has configuration ${item.configuration}`)));
      for (const [mode, index] of [["semi", 0], ["skeletal", 2]]) {
        await page.locator(".view-mode-switch button").nth(index).click();
        await page.locator(mode === "semi" ? ".semi-developed-view .semi-developed-node" : ".skeletal-view .skeletal-node").first().waitFor({ state: "attached" });
        for (const target of expected) {
          const control = stereoStage.locator(`[data-name-fragment="${target.id}"]`);
          assert.equal(await control.count(), 1, `${language}/${mode}: ${target.id}`);
          const actual = await control.evaluate(button => new Promise((resolve, reject) => {
            const root = document.querySelector(".molecule-stage");
            const read = () => {
              const overlay = root?.querySelector(".reasoning-visual-overlay");
              if (!overlay || button.getAttribute("aria-pressed") !== "true") return;
              observer.disconnect(); clearTimeout(timer);
              resolve({ atoms: [...overlay.querySelectorAll("[data-reasoning-atom]")].map(node => +node.dataset.reasoningAtom).sort((a,b)=>a-b),
                bonds: [...new Set([...overlay.querySelectorAll("[data-reasoning-bond]")].map(node => node.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")))].sort() });
            };
            const observer = new MutationObserver(read); observer.observe(root, { childList: true, subtree: true, attributes: true });
            observer.observe(button, { attributes: true });
            const timer = setTimeout(() => { observer.disconnect(); reject(Error("No alkene CIP overlay")); }, 4000);
            button.click(); read();
          }));
          assert.deepEqual(actual, { atoms: [...target.atoms].sort((a,b)=>a-b),
            bonds: target.bonds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":" )).sort() }, `${language}/${mode}: ${target.id}`);
        }
      }
    }
  } finally { await page.close(); }
});
