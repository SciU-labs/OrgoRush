import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const cases = [
  ['symmetric amine', 'CNC', 'dimetilamina', 'dimethylamine'],
  ['N-methyl amide', 'CC(=O)NC', 'N-metiletanamida', 'N-methylethanamide'],
  ['N,N-dimethyl amide', 'CC(=O)N(C)C', 'N,N-dimetiletanamida', 'N,N-dimethylethanamide'],
  ['simple ether', 'CCOCC', 'etoxietano', 'ethoxyethane'],
  ['repeated halogen', 'C(Cl)(Cl)Cl', 'triclorometano', 'trichloromethane'],
  ['nitro prefix', 'C[N+](=O)[O-]', 'nitrometano', 'nitromethane'],
  ['cinnamaldehyde with E geometry', 'C1=CC=C(C=C1)/C=C/C=O', '(2E)-3-fenil-2-propenal', '(2E)-3-phenyl-2-propenal', true],
  ['malic acid diacid', 'C(C(C(=O)O)O)C(=O)O', 'ácido 2-hidroxibutanodioico', '2-hydroxybutanedioic acid'],
  ['linolenic acid with three Z bonds', 'CC/C=C\\C/C=C\\C/C=C\\CCCCCCCC(=O)O', 'ácido (9Z,12Z,15Z)-9,12,15-octadecatrienoico', '(9Z,12Z,15Z)-9,12,15-octadecatrienoic acid', true],
  ['branched ester radical', 'CC(C)CCOC(=O)C', 'etanoato de 3-metilbutilo', '3-methylbutyl ethanoate'],
  ['phenethylamine aromatic substituent', 'C1=CC=C(C=C1)CCN', '2-feniletanamina', '2-phenylethanamine'],
  ['acrylonitrile unsaturated nitrile', 'C=CC#N', '2-propenonitrilo', '2-propenenitrile'],
  ['ethyl cyanoacetate C-832.5 parent correction', 'CCOC(=O)CC#N', '2-cianoetanoato de etilo', 'ethyl 2-cyanoethanoate'],
];
let server, browser, origin;

before(async () => {
  server = await createServer({ configFile: fileURLToPath(new URL('../../vite.pages.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
}, { timeout: 60_000 });
after(async () => { await browser?.close(); await server?.close(); });

for (const [family, smiles, es, en, stereo = false] of cases) {
  test(`H1 legacy name stays local and bilingual: ${family}`, async () => {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped');
      localStorage.setItem('hydrocarbon-lab-language', 'es');
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    try {
      await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.locator('[aria-controls="smiles-interop-panel"]').click();
      await page.locator('#smiles-text-input').fill(smiles);
      await page.locator('#smiles-interop-panel button[type="submit"]').click();
      if(stereo)await page.getByRole('switch', { name: 'Estereoquímica' }).click();
      await page.locator('.iupac-dock-expand').click();
      const legacy = page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first();
      await legacy.waitFor({ state: 'visible', timeout: 30_000 });
      await legacy.click();
      const name = page.locator('.iupac-dock-name');
      try { await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 }); }
      catch { throw new Error(`${family} Spanish expected ${es}; saw ${(await name.innerText()).trim()}`); }
      assert.equal((await name.innerText()).trim(), es, `${family} Spanish profile`);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, en, { timeout: 30_000 });
      assert.equal((await name.innerText()).trim(), en, `${family} English profile`);
      await page.getByRole('button', { name: 'Español', exact: true }).click();
      await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 });
      assert.deepEqual(errors, [], `${family} browser errors`);
    } finally {
      await page.close();
    }
  });
}
