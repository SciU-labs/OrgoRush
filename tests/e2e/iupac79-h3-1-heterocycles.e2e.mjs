import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const cases = [
  ['Pyrazole', 'C1=CNN=C1', '1H-pirazol', '1H-pyrazole'],
  ['Histamine', 'C1=C(NC=N1)CCN', '2-(1H-imidazol-5-il)etilamina', '2-(1H-imidazol-5-yl)ethylamine'],
  ['Pyrazine-2-carboxylic acid', 'C1=CN=C(C=N1)C(=O)O', 'ácido pirazina-2-carboxílico', 'pyrazine-2-carboxylic acid'],
];
let server, browser, origin;
before(async () => {
  server = await createServer({ configFile: fileURLToPath(new URL('../../vite.pages.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
}, { timeout: 60_000 });
after(async () => { await browser?.close(); await server?.close(); });

for (const [label, smiles, es, en] of cases) test(`H3.1 bilingual profile stays graph-local: ${label}`, async () => {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  try {
    await page.addInitScript(() => {
      localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped');
      localStorage.setItem('hydrocarbon-lab-language', 'es');
    });
    await page.route('**/*', route => route.request().url().startsWith(origin)
      ? route.continue() : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('.iupac-dock-expand').click();
    const profile = page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first();
    await profile.waitFor({ state: 'visible', timeout: 30_000 }); await profile.click();
    const name = page.locator('.iupac-dock-name');
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), es);
    await page.getByRole('button', { name: /IUPAC sugerido \(Blue Book 2013\+\)/ }).first().click();
    await page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first().click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), es, 'profile switch retains the active structure and local name');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, en, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), en);
    await page.getByRole('button', { name: /IUPAC Suggested \(Blue Book 2013\+\)/ }).first().click();
    await page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first().click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, en, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), en, 'profile switch retains the active structure and local name');
    await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), es);
  } finally { await page.close(); }
});
