import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, preview } from "vite";
import { chromium } from "playwright";
import test from "node:test";

test("skeletal cyclohexane adds a vertical carbon from its top vertex", async () => {
  const output = process.env.CYCLOHEXANE_EXIT_OUT ?? "reports/cyclohexane-top-exit/local";
  await mkdir(output, { recursive: true });
  const targetUrl = process.env.ORGORUSH_APP_URL;
  const previewBuiltPages = process.env.ORGORUSH_PAGES_PREVIEW === "1";
  const configFile = fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url));
  const server = targetUrl ? null : previewBuiltPages ? await preview({
    configFile,
    preview: { host: "127.0.0.1", port: 0 },
  }) : await createServer({
    configFile,
    server: { host: "127.0.0.1", port: 0 },
  });
  if (server && !previewBuiltPages) await server.listen();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE }
        : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped");
      localStorage.setItem("hydrocarbon-lab-language", "es");
    });
    if (!targetUrl) {
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/")) return route.continue();
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });
    }
    const url = targetUrl ?? `http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

    // Exact user sequence: switch view first, then open the ring tool.
    await page.locator(".view-mode-switch button").nth(2).click();
    await page.locator(".ring-button").click();
    await page.locator(".cycle-ring-grid .ring-option")
      .filter({ has: page.getByText("Ciclohexano", { exact: true }) }).click();

    // The ring library places a selected template at the clicked canvas carbon.
    const atom = (id) => page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
    await atom(1).click({ force: true });
    await page.waitForFunction(() => document.querySelectorAll(".molecule-nodes-layer [data-atom-id]").length === 6);
    await atom(1).click({ force: true }); // top ring carbon
    const addUp = page.getByRole("button", { name: "Añadir carbono hacia arriba" });
    await addUp.hover();
    assert.equal(await page.locator(".molecule-nodes-layer [data-atom-id]").count(), 6, "hovering does not commit the new atom");
    await addUp.click();
    await page.waitForFunction(() => document.querySelectorAll(".molecule-nodes-layer [data-atom-id]").length === 7);

    const coordinates = await page.locator(".molecule-nodes-layer [data-atom-id]").evaluateAll((nodes) =>
      Object.fromEntries(nodes.map((node) => {
        const match = node.getAttribute("transform").match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);
        return [node.dataset.atomId, { x: Number(match[1]), y: Number(match[2]) }];
      })),
    );
    const center = [1, 2, 3, 4, 5, 6].reduce((sum, id) => ({
      x: sum.x + coordinates[id].x / 6,
      y: sum.y + coordinates[id].y / 6,
    }), { x: 0, y: 0 });
    const parent = coordinates[1];
    const child = coordinates[7];
    const radial = { x: parent.x - center.x, y: parent.y - center.y };
    const bond = { x: child.x - parent.x, y: child.y - parent.y };
    const radialCosine = (radial.x * bond.x + radial.y * bond.y)
      / (Math.hypot(radial.x, radial.y) * Math.hypot(bond.x, bond.y));
    const screenshot = await page.locator(".molecule-stage").screenshot({ path: `${output}/cycle-top-vertical.png` });
    await writeFile(`${output}/results.json`, `${JSON.stringify({ url, view: "skeletal", actionOrder: [
      "open Spanish app", "skeletal view", "ring tool", "cyclohexane", "place ring at initial carbon", "select top vertex", "add carbon up",
    ], parent, child, radialCosine, bondLength: Math.hypot(bond.x, bond.y), horizontalDrift: bond.x }, null, 2)}\n`);
    if (targetUrl) {
      const localImage = await readFile("reports/cyclohexane-top-exit/local/cycle-top-vertical.png");
      const comparison = await browser.newPage({ viewport: { width: 1440, height: 650 } });
      await comparison.setContent(`<html><body style="margin:0;padding:12px;background:#f2f5f9;font:600 18px Arial;color:#24364b"><main style="display:flex;gap:12px"><section><h2 style="margin:0 0 8px">Local modificada</h2><img style="width:690px;border:1px solid #cbd5e1;border-radius:10px" src="data:image/png;base64,${localImage.toString("base64")}"></section><section><h2 style="margin:0 0 8px">GitHub Pages publicada</h2><img style="width:690px;border:1px solid #cbd5e1;border-radius:10px" src="data:image/png;base64,${screenshot.toString("base64")}"></section></main></body></html>`);
      await comparison.screenshot({ path: "reports/cyclohexane-top-exit/comparison.png", fullPage: true });
      await comparison.close();
    }
    assert.ok(Math.abs(bond.x) < 1e-6, `top exit is vertical; horizontal drift was ${bond.x}px`);
    assert.ok(bond.y < 0, "the added carbon is above the ring");
    assert.ok(radialCosine > 0.995, "the final canvas bond follows the radial direction");
  } finally {
    await browser?.close();
    if (previewBuiltPages) await new Promise((resolve, reject) => server?.httpServer.close((error) => error ? reject(error) : resolve()));
    else await server?.close();
  }
}, { timeout: 300000 });
