import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import test from "node:test";

const output = "reports/cycloalkane-branch-geometry";

test("benzene and cyclohexane use matching exterior branch geometry through the canvas", async () => {
  await mkdir(output, { recursive: true });
  const server = await createServer({
    configFile: fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url)),
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  let browser;
  const results = [];
  const screenshots = [];
    let benzeneBranchToRingRatio;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE }
        : {}),
    });
    for (const kind of ["benzene", "cyclohexane"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      await page.addInitScript(() => {
        localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped");
        localStorage.setItem("hydrocarbon-lab-language", "es");
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1" && !url.pathname.startsWith("/api/")) return route.continue();
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      });
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`, {
        waitUntil: "domcontentloaded", timeout: 90000,
      });
      const atom = (id) => page.locator(`.molecule-nodes-layer [data-atom-id="${id}"]`);
      const coordinates = () => page.locator(".molecule-nodes-layer [data-atom-id]").evaluateAll((nodes) =>
        Object.fromEntries(nodes.map((node) => {
          const match = node.getAttribute("transform").match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);
          return [node.dataset.atomId, { x: Number(match[1]), y: Number(match[2]) }];
        })),
      );
      await page.locator(".ring-button").click();
      if (kind === "benzene") {
        await page.locator(".aromatic-option").filter({ has: page.getByText("Benceno", { exact: true }) }).click();
      } else {
        await page.locator(".cycle-ring-grid .ring-option").filter({ has: page.getByText("Ciclohexano", { exact: true }) }).click();
      }
      await atom(1).click({ force: true });
      await page.waitForFunction(() => document.querySelectorAll(".molecule-nodes-layer [data-atom-id]").length === 6);
      await page.locator(".view-mode-switch button").nth(2).click();
      await atom(1).waitFor({ state: "visible" });
      const initial = await coordinates();
      // Direction controls calculate and commit on click; there is no separate
      // transient ghost-preview for this manual-addition interaction.
      await atom(1).click({ force: true });
      const addUp = page.getByRole("button", { name: "Añadir carbono hacia arriba" });
      await addUp.hover();
      assert.equal(await page.locator(".molecule-nodes-layer [data-atom-id]").count(), 6, "hovering the add direction does not mutate the graph");
      await addUp.click();
      await page.waitForFunction(() => document.querySelectorAll(".molecule-nodes-layer [data-atom-id]").length === 7);
      await atom(2).click({ force: true });
      await addUp.click();
      await page.waitForFunction(() => document.querySelectorAll(".molecule-nodes-layer [data-atom-id]").length === 8);
      const final = await coordinates();
      for (let id = 1; id <= 6; id += 1) {
        assert.ok(Math.hypot(final[id].x - initial[id].x, final[id].y - initial[id].y) < 1e-6, `${kind} ring vertex ${id} was not moved`);
      }
      const center = [1, 2, 3, 4, 5, 6].reduce((sum, id) => ({ x: sum.x + final[id].x / 6, y: sum.y + final[id].y / 6 }), { x: 0, y: 0 });
      const branches = [[1, 7], [2, 8]].map(([parent, child]) => {
        const start = final[parent];
        const end = final[child];
        const radial = { x: start.x - center.x, y: start.y - center.y };
        const vector = { x: end.x - start.x, y: end.y - start.y };
        return {
          parent,
          child,
          length: Math.hypot(vector.x, vector.y),
          radialCosine: (radial.x * vector.x + radial.y * vector.y) / (Math.hypot(radial.x, radial.y) * Math.hypot(vector.x, vector.y)),
        };
      });
      const ringEdges = [1, 2, 3, 4, 5, 6].map((id) => {
        const next = id === 6 ? 1 : id + 1;
        return Math.hypot(final[next].x - final[id].x, final[next].y - final[id].y);
      });
      const ringMean = ringEdges.reduce((sum, length) => sum + length / ringEdges.length, 0);
      branches.forEach(({ radialCosine }) => assert.ok(radialCosine > 0.995, `${kind}: the exit is radial at the selected vertex`));
      assert.ok(Math.abs(branches[0].length - branches[1].length) < 1e-6, `${kind}: external bonds have equal lengths`);
      assert.ok(Math.abs(ringEdges[0] / ringMean - 1) < 0.02, `${kind}: ring edges are uniform`);
      const branchToRingRatio = branches[0].length / ringMean;
      if (kind === "benzene") benzeneBranchToRingRatio = branchToRingRatio;
      else assert.ok(Math.abs(branchToRingRatio - benzeneBranchToRingRatio) < 0.01, "cyclohexane keeps the same external-bond-to-ring ratio as benzene");
      const image = await page.locator(".molecule-stage").screenshot({ path: `${output}/${kind}.png` });
      screenshots.push({ kind, data: `data:image/png;base64,${image.toString("base64")}` });
      results.push({ kind, branches, ringEdges, branchToRingRatio, ringVerticesUnchanged: true });
      await page.close();
    }

    const comparison = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    const composition = `<html><body style="margin:0;background:#f4f6fa;font:600 18px Arial;color:#24364b"><main style="display:flex;gap:16px;padding:16px">${screenshots.map(({ kind, data }) => `<section><h2 style="margin:0 0 8px;text-transform:capitalize">${kind === "benzene" ? "Benceno" : "Ciclohexano"}</h2><img style="display:block;width:680px;border:1px solid #cbd5e1;border-radius:12px" src="${data}"></section>`).join("")}</main></body></html>`;
    await comparison.setContent(composition);
    await comparison.screenshot({ path: `${output}/comparison.png`, fullPage: true });
    await comparison.close();
    await writeFile(`${output}/results.json`, `${JSON.stringify({ source: "Playwright against local Vite source", results }, null, 2)}\n`);
  } finally {
    await browser?.close();
    await server.close();
  }
}, { timeout: 300000 });
