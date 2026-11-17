import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const cases = [
  ['Tryptamine', 'C1=CC=C2C(=C1)C(=CN2)CCN', '2-(1H-indol-3-il)etilamina', '2-(1H-indol-3-yl)ethylamine', 1150, 'APJYDQYYACXCRM-UHFFFAOYSA-N', 'C10H12N2'],
  ['Serotonin', 'C1=CC2=C(C=C1O)C(=CN2)CCN', '3-(2-aminoetil)-1H-indol-5-ol', '3-(2-aminoethyl)-1H-indol-5-ol', 5202, 'QZAYGJVTTNCVMB-UHFFFAOYSA-N', 'C10H12N2O'],
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

for (const [label, smiles, es, en, cid, inchiKey, formula] of cases) test(`H3.2 browser: ${label} has verified common title and bilingual local 1979 name`, async () => {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  try {
    await page.addInitScript(() => {
      localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped');
      localStorage.setItem('hydrocarbon-lab-language', 'es');
    });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'pubchem.ncbi.nlm.nih.gov') {
        const pathname = decodeURIComponent(url.pathname);
        if (/\/compound\/(?:smiles|inchikey)\/.+\/cids\/JSON$/.test(pathname))
          return route.fulfill({ json: { IdentifierList: { CID: [cid] } } });
        if (pathname.includes(`/cid/${cid}/property/`)) return route.fulfill({ json: { PropertyTable: { Properties: [{
          CID: cid, IUPACName: label === 'Tryptamine' ? '2-(1H-indol-3-yl)ethanamine' : '3-(2-aminoethyl)-1H-indol-5-ol',
          InChIKey: inchiKey, IsomericSMILES: smiles, CanonicalSMILES: smiles, MolecularFormula: formula,
          MolecularWeight: label === 'Tryptamine' ? 160.22 : 176.21,
        }] } } });
        if (pathname.includes(`/cid/${cid}/description/`)) return route.fulfill({ json: { InformationList: { Information: [{
          Title: label, Description: `${label} structure reference.`,
        }] } } });
        if (pathname.includes(`/cid/${cid}/synonyms/`)) return route.fulfill({ json: { InformationList: { Information: [{ CID: cid, Synonym: [label] }] } } });
      }
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('.iupac-dock-expand').click();
    const name = page.locator('.iupac-dock-name');
    await page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first().click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), es);
    const spanishTitle = label === 'Tryptamine' ? 'Triptamina' : 'Serotonina';
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name-stack')?.textContent?.includes(expected), spanishTitle, { timeout: 15_000 });
    const spanishStack = await page.locator('.iupac-dock-name-stack').innerText();
    assert.ok(spanishStack.indexOf(spanishTitle) >= 0 && spanishStack.indexOf(spanishTitle) < spanishStack.indexOf(es),
      'the localized common name is the primary title and the 1979 name remains secondary');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, en, { timeout: 15_000 });
    assert.equal((await name.innerText()).trim(), en);
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name-stack')?.textContent?.includes(expected), label, { timeout: 15_000 });
    const englishStack = await page.locator('.iupac-dock-name-stack').innerText();
    assert.ok(englishStack.indexOf(label) >= 0 && englishStack.indexOf(label) < englishStack.indexOf(en),
      'the English common name is the primary title and the 1979 name remains secondary');
    await page.getByRole('button', { name: /IUPAC Suggested \(Blue Book 2013\+\)/ }).first().click();
    await page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first().click();
    await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 15_000 });
    assert.equal((await name.innerText()).trim(), es);
  } finally { await page.close(); }
});
