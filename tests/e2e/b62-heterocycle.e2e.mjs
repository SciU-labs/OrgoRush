import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const smiles = 'C1=C(C=NC=C1C(=O)O)C(=O)O';
let server, browser, origin;
const result = {
  status: 'RUNNING', names: {}, browser: null, errors: [], interceptedExternalRequests: [],
  externalRequestPolicy: 'All non-app requests are intercepted and answered locally; none supplies a chemical name.',
  geometryPreserved: false,
};

before(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../../vite.pages.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    headless: true,
    timeout: 15000,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE }
      : {}),
  });
  result.browser = browser.version();
  await mkdir('reports/b621', { recursive: true });
}, { timeout: 45000 });

after(async () => {
  await writeFile('reports/b621/chromium.json', JSON.stringify(result, null, 2) + '\n');
  await browser?.close();
  await server?.close();
});

test('B6.2.1 pyridine diacid names stay bilingual and PARTIAL on the interactive canvas', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => result.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') result.errors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped'));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'fonts.gstatic.com') return route.fulfill({ status: 204, body: '' });
    if (url.hostname === 'www.googletagmanager.com') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    result.interceptedExternalRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  try {
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();

    const panel = page.locator('#iupac-reasoning-content');
    const disclosure = page.locator('.reasoning-visibility-button');
    if (await disclosure.getAttribute('aria-expanded') !== 'true') await disclosure.click();
    await panel.waitFor({ state: 'visible' });
    await page.getByText('ácido piridina-3,5-dicarboxílico', { exact: true }).first().waitFor({ state: 'visible' });
    assert.equal(await panel.getAttribute('data-derivation-support'), 'PARTIAL');
    assert.match(await panel.innerText(), /el nombre activo no está conciliado/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /bis\(1-metiletil\)|bis\(1-methylethyl\)/i);
    result.names.es = 'ácido piridina-3,5-dicarboxílico';

    const structure = () => page.locator('.molecule-stage').evaluate((node) => ({
      atoms: [...node.querySelectorAll('[data-atom-id]')].map((item) => [item.dataset.atomId, item.dataset.atomElement]).sort(),
      bonds: [...node.querySelectorAll('[data-bond-a]')].map((item) => [item.dataset.bondA, item.dataset.bondB, item.dataset.bondOrder]).sort(),
      geometry: [...node.querySelectorAll('.carbon-node')].map((item) => [item.dataset.atomId, item.getAttribute('transform')]).sort(),
    }));
    const initial = await structure();
    assert.equal(initial.atoms.length, 12);
    assert.equal(initial.bonds.length, 12);
    const acidEvidence = panel.locator('[data-name-fragment^="structural-"]');
    assert.equal(await acidEvidence.count(), 3, 'two carboxyl regions plus the unnumbered ring candidate');
    for (const [index, expectedAtoms] of [[0, [7, 8, 9]], [1, [10, 11, 12]]]) {
      const control = acidEvidence.nth(index);
      await control.click();
      const snapshot = await page.waitForFunction((atoms) => {
        const overlay = document.querySelector('.reasoning-visual-overlay');
        if (!overlay) return false;
        const selected = [...overlay.querySelectorAll('[data-reasoning-atom]')]
          .map((node) => Number(node.dataset.reasoningAtom)).sort((a, b) => a - b);
        return JSON.stringify(selected) === JSON.stringify(atoms) ? {
          atoms: selected,
          bonds: [...overlay.querySelectorAll('[data-reasoning-bond]')].map((node) => node.dataset.reasoningBond),
          locants: overlay.querySelectorAll('[data-reasoning-locant]').length,
        } : false;
      }, expectedAtoms, { timeout: 5000 });
      const selectedRegion = await snapshot.jsonValue();
      await snapshot.dispose();
      assert.deepEqual(selectedRegion.atoms, expectedAtoms);
      assert.equal(selectedRegion.locants, 0, 'partial evidence selects group atoms without claiming name locants');
      assert.equal(selectedRegion.bonds.length, 2);
    }

    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.getByText('pyridine-3,5-dicarboxylic acid', { exact: true }).first().waitFor({ state: 'visible' });
    assert.equal(await panel.getAttribute('data-derivation-support'), 'PARTIAL');
    assert.match(await panel.innerText(), /the active name is not reconciled/i);
    assert.doesNotMatch(await page.locator('body').innerText(), /bis\(1-methylethyl\)|bis\(1-metiletil\)/i);
    result.names.en = 'pyridine-3,5-dicarboxylic acid';
    const switched = await structure();
    assert.deepEqual(switched, initial);
    result.geometryPreserved = true;
    assert.deepEqual(result.errors, []);
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL';
    result.error = String(error);
    throw error;
  } finally {
    await page.close();
  }
}, { timeout: 90000 });
