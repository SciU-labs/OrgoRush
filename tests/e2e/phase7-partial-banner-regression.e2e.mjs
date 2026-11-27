import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const smiles = "CC(=O)C(C)CC";
const output = process.env.ORGORUSH_E2E_OUT_DIR ?? "reports/phase7";
let server, browser, origin;
before(async () => {
  server = await createServer({ configFile: "vite.pages.config.ts", server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

test("removing the generic partial notice preserves the five ketone explanation stages in both languages", async () => {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  try {
    await page.addInitScript(() => localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped"));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}",
        headers: { "access-control-allow-origin": "*" } });
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await mkdir(output, { recursive: true });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const panel = page.locator("#iupac-reasoning-content");
    const disclosure = page.locator(".reasoning-visibility-button");
    if (await disclosure.getAttribute("aria-expanded") !== "true") await disclosure.click();
    await panel.waitFor({ state: "visible", timeout: 30000 });
    for (const language of ["es", "en"]) {
      if (language === "en") await page.getByRole("button", { name: "English", exact: true }).click();
      const support = await panel.getAttribute("data-derivation-support");
      assert.notEqual(support, "FULL", "the explanation must not promote chemical status");
      assert.equal(await panel.getAttribute("data-pedagogical-coverage-status"), "unverified",
        "local steps retain a separate unverified pedagogical-coverage marker");
      assert.equal(await panel.locator("[data-reasoning-partial]").count(), 0, "generic partial notice is removed");
      const steps = await panel.locator("ol > li").evaluateAll(nodes => nodes.map(node => ({
        title: node.querySelector("strong")?.textContent?.trim(),
        text: node.querySelector("p")?.textContent?.trim(),
      })));
      assert.equal(steps.length, 5, `${language}: keep the five existing explanation stages`);
      const titles = steps.map(step => step.title);
      assert.deepEqual(titles, language === "es"
        ? ["Grupo funcional principal", "Cadena principal", "Numeración razonada", "Sustituyentes y localizadores", "Orden alfabético"]
        : ["Principal functional group", "Parent chain", "Numbering", "Substituents and locants", "Alphabetical order"]);
      const joined = steps.map(step => step.text ?? "").join(" ");
      assert.match(joined, language === "es" ? /cetona/ : /ketone/i);
      assert.match(steps[0].text ?? "", language === "es" ? /C2|2-ona/ : /C2|2-one/);
      assert.match(steps[1].text ?? "", language === "es" ? /5 carbonos|pentano/ : /5 carbons|pentane/);
      assert.match(steps[2].text ?? "", language === "es" ? /queda en C2|C2/ : /remains at C2|C2/);
      assert.match(steps[3].text ?? "", language === "es" ? /metilo en C3/ : /3-methyl/);
      assert.match(steps[4].text ?? "", language === "es" ? /un tipo de sustituyente/ : /one substituent type/i);
      const visiblePage = await page.locator("body").innerText();
      assert.match(visiblePage, language === "es" ? /3-metilpentan-2-ona/ : /3-methylpentan-2-one/i);
      assert.doesNotMatch(joined, /complete name cannot yet be justified|aún no se puede justificar el nombre completo/i);
      await page.screenshot({ path: `${output}/partial-ketone-${language}.png`, fullPage: true });
    }
  } finally { await page.close(); }
});
