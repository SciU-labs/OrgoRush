import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const smiles = "C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O";
const spanishSystematic = "(3R,4S,5S,6R)-6-(hidroximetil)oxano-2,3,4,5-tetrol";
let server, browser, origin;

before(async () => {
  server = await createServer({ configFile: fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url)), server: { host: "localhost", port: 0 } });
  await server.listen();
  origin = `http://localhost:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
});

after(async () => { await browser?.close(); await server?.close(); });

test("verified common title, systematic profiles and source-only synonyms stay distinct across locales", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped");
    localStorage.setItem("hydrocarbon-lab-language", "es");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
      if (url.pathname.includes("/smiles/") && url.pathname.includes("/cids/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ IdentifierList: { CID: [5793] } }) });
      }
      if (url.pathname.includes("/property/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ PropertyTable: { Properties: [{
          CID: 5793,
          IUPACName: "(3R,4S,5S,6R)-6-(hydroxymethyl)oxane-2,3,4,5-tetrol",
          IsomericSMILES: smiles,
          CanonicalSMILES: smiles,
          InChIKey: "WQZGKKKJIJFFOK-GASJEMHNSA-N",
          MolecularFormula: "C6H12O6",
        }] } }) });
      }
      if (url.pathname.includes("/description/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ InformationList: { Information: [{
          Title: "D-Glucose", Description: "D-Glucose is a monosaccharide.",
        }] } }) });
      }
      if (url.pathname.includes("/synonyms/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ InformationList: { Information: [{
          Synonym: ["D-glucose", "dextrose", "50-99-7", "CID 5793", "C6H12O6"],
        }] } }) });
      }
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  try {
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(smiles);
    await page.locator("#smiles-interop-panel button[type=submit]").click();

    await page.getByText(spanishSystematic, { exact: true }).first().waitFor({ state: "visible", timeout: 20_000 });
    const commonTitle = page.locator(".iupac-dock-common-title");
    assert.equal((await commonTitle.innerText()).replace(/\s+/g, " ").trim(), "Nombre común · identidad verificada en PubChem: D-glucosa");
    assert.equal(await commonTitle.getAttribute("data-name-category"), "common");
    assert.match(await page.locator(".iupac-dock-systematic-label").innerText(), /sistemático.*2013/i);

    await page.locator(".iupac-dock-expand").click();
    const synonyms = page.locator(".iupac-dock-synonyms");
    await synonyms.waitFor({ state: "visible", timeout: 10_000 });
    assert.match(await synonyms.innerText(), /idioma de origen no clasificado/i);
    assert.match(await synonyms.innerText(), /D-glucose.*dextrose/i);
    assert.doesNotMatch(await synonyms.innerText(), /50-99-7|CID 5793|C6H12O6/);
    const captureDirectory = resolve(process.cwd(), "reports", "iupac-name-hierarchy-2026-11-16");
    await mkdir(captureDirectory, { recursive: true });
    await page.screenshot({ path: resolve(captureDirectory, "spanish.png"), fullPage: true });

    await page.getByRole("button", { name: "Ocultar", exact: true }).click();
    await commonTitle.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Mostrar", exact: true }).click();
    await commonTitle.waitFor({ state: "visible" });

    await page.locator(".iupac-dock-profile").selectOption("iupac-1979-es");
    assert.match(await page.locator(".iupac-dock-systematic-label").innerText(), /perfil de 1979/i);
    await page.getByRole("button", { name: "English", exact: true }).click();
    assert.match(await page.locator(".iupac-dock-systematic-label").innerText(), /1979 profile/i);
    assert.equal((await commonTitle.innerText()).replace(/\s+/g, " ").trim(), "Common name · PubChem identity verified: D-Glucose");
    await page.locator(".iupac-dock-profile").selectOption("current");
    assert.match(await page.locator(".iupac-dock-systematic-label").innerText(), /2013\+ profile/i);
    await page.screenshot({ path: resolve(captureDirectory, "english.png"), fullPage: true });
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
