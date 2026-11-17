import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const cases = [
  { title: 'Fentanyl', esTitle: 'Fentanilo', cid: 3345, key: 'PJMPHNIQZUBGLI-UHFFFAOYSA-N', formula: 'C22H28N2O', smiles: 'CCC(=O)N(C1CCN(CC1)CCC2=CC=CC=C2)C3=CC=CC=C3', en: 'N-[1-(2-phenylethyl)-4-piperidyl]propionanilide', es: 'N-[1-(2-feniletil)-4-piperidil]propionanilida' },
  { title: 'Haloperidol', esTitle: 'Haloperidol', cid: 3559, key: 'LNEPOXFFQSENCJ-UHFFFAOYSA-N', formula: 'C21H23ClFNO2', smiles: 'C1CN(CCC1(C2=CC=C(C=C2)Cl)O)CCCC(=O)C3=CC=C(C=C3)F', en: '4-[4-(4-chlorophenyl)-4-hydroxypiperidino]-1-(4-fluorophenyl)-1-butanone', es: '4-[4-(4-clorofenil)-4-hidroxipiperidino]-1-(4-fluorofenil)-1-butanona' },
  { title: 'Piperoxan', esTitle: 'Piperoxano', cid: 6040, key: 'LYKMMUBOEFYJQG-UHFFFAOYSA-N', formula: 'C14H19NO2', smiles: 'C1CCN(CC1)CC2COC3=CC=CC=C3O2', en: '1-[(2,3-dihydro-1,4-benzodioxin-2-yl)methyl]piperidine', es: '1-[(2,3-dihidro-1,4-benzodioxin-2-il)metil]piperidina' },
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

for (const entry of cases) test(`H3.3 browser: ${entry.title} imports and displays common/systematic names by active language`, async () => {
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
          return route.fulfill({ json: { IdentifierList: { CID: [entry.cid] } } });
        if (pathname.includes(`/cid/${entry.cid}/property/`)) return route.fulfill({ json: { PropertyTable: { Properties: [{
          CID: entry.cid, IUPACName: entry.title === 'Fentanyl' ? 'N-phenyl-N-[1-(2-phenylethyl)piperidin-4-yl]propanamide'
            : entry.title === 'Haloperidol' ? '4-[4-(4-chlorophenyl)-4-hydroxypiperidin-1-yl]-1-(4-fluorophenyl)butan-1-one'
              : '1-(2,3-dihydro-1,4-benzodioxin-3-ylmethyl)piperidine', InChIKey: entry.key,
          IsomericSMILES: entry.smiles, CanonicalSMILES: entry.smiles, MolecularFormula: entry.formula,
          MolecularWeight: entry.title === 'Fentanyl' ? 336.48 : entry.title === 'Haloperidol' ? 375.86 : 233.31,
        }] } } });
        if (pathname.includes(`/cid/${entry.cid}/description/`)) return route.fulfill({ json: { InformationList: { Information: [{ Title: entry.title, Description: `${entry.title} reference record.` }] } } });
        if (pathname.includes(`/cid/${entry.cid}/synonyms/`)) return route.fulfill({ json: { InformationList: { Information: [{ CID: entry.cid, Synonym: [entry.title] }] } } });
      }
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(entry.smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('.iupac-dock-expand').click();
    const name = page.locator('.iupac-dock-name');
    await page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first().click();
    try {
      await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, entry.es, { timeout: 30_000 });
    } catch (error) {
      throw new Error(`${entry.title} expected ${entry.es}; dock=${await page.locator('.iupac-dock-name').textContent().catch(() => '(missing)')}; stack=${await page.locator('.iupac-dock-name-stack').textContent().catch(() => '(missing)')}`, { cause: error });
    }
    assert.equal((await name.innerText()).trim(), entry.es);
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name-stack')?.textContent?.includes(expected), entry.esTitle, { timeout: 15_000 });
    let stack = await page.locator('.iupac-dock-name-stack').innerText();
    assert.ok(stack.indexOf(entry.esTitle) >= 0 && stack.indexOf(entry.esTitle) < stack.indexOf(entry.es));
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, entry.en, { timeout: 15_000 });
    assert.equal((await name.innerText()).trim(), entry.en);
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name-stack')?.textContent?.includes(expected), entry.title, { timeout: 15_000 });
    stack = await page.locator('.iupac-dock-name-stack').innerText();
    assert.ok(stack.indexOf(entry.title) >= 0 && stack.indexOf(entry.title) < stack.indexOf(entry.en));
    await page.getByRole('button', { name: 'Español', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, entry.es, { timeout: 15_000 });
    assert.equal((await name.innerText()).trim(), entry.es);
  } finally { await page.close(); }
});
