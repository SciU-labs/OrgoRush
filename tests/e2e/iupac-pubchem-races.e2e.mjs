import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server;
let browser;
let origin;
const held = [];
let failPubChemCidLookups = false;

before(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL('../../vite.pages.config.ts', import.meta.url)),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE }
      : {}) });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

const waitFor = async (predicate, message, timeout = 10_000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${message}`);
};

async function importSmiles(page, smiles) {
  const toggle = page.locator('[aria-controls="smiles-interop-panel"]');
  if (!(await page.locator('#smiles-interop-panel').isVisible())) await toggle.click();
  await page.locator('#smiles-text-input').fill(smiles);
  await page.locator('#smiles-interop-panel button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.molecule-stage [data-atom-id]').length > 0);
  if (await page.locator('#smiles-interop-panel').isVisible()) await toggle.click();
}

async function settleRequest(item, body = { IdentifierList: { CID: [] } }) {
  item.release(body);
}

test('PubChem responses remain identity- and language-safe through races, errors and clearing', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped');
    localStorage.setItem('hydrocarbon-lab-language', 'es');
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'pubchem.ncbi.nlm.nih.gov') {
      if (failPubChemCidLookups && url.pathname.includes('/smiles/')) return route.abort('failed');
      if (url.pathname.includes('/description/')) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' }, body: '{}' });
      }
      if (url.pathname.includes('/synonyms/')) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ InformationList: { Information: [{ Synonym: [] }] } }) });
      }
      const entry = { url: url.href, released: false };
      entry.release = async (body) => {
        if (entry.released) return;
        entry.released = true;
        try {
          await route.fulfill({ status: 200, contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        } catch { /* The app may correctly abort a superseded request. */ }
      };
      entry.fail = async () => {
        if (entry.released) return;
        entry.released = true;
        try { await route.abort('failed'); } catch { /* Superseded requests are already aborted. */ }
      };
      held.push(entry);
      return;
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await importSmiles(page, 'CCO');
    const name = page.locator('.iupac-dock-name');
    await page.getByRole('button', { name: 'Español' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.trim() === 'etanol');
    const firstPending = await waitFor(() => held.find((item) => item.url.includes('/smiles/')),
      'the first intercepted PubChem lookup');
    assert.equal((await name.innerText()).trim(), 'etanol', 'a local Spanish name is immediately available while PubChem is pending');

    await page.getByRole('button', { name: 'English' }).click();
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.trim() === 'ethanol');
    await settleRequest(firstPending);
    assert.equal((await name.innerText()).trim(), 'ethanol', 'the old Spanish-language request cannot replace the active English name');

    await page.getByRole('button', { name: 'Español' }).click();
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.trim() === 'etanol');
    const secondPending = await waitFor(() => held.filter((item) => item.url.includes('/smiles/')).at(-1),
      'the Spanish-language PubChem lookup');
    assert.equal((await name.innerText()).trim(), 'etanol', 'English-to-Spanish language change uses the Spanish local name immediately');

    const beforePropanol = held.length;
    await importSmiles(page, 'CC(C)O');
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.trim() !== 'etanol');
    const currentName = (await name.innerText()).trim();
    assert.ok(currentName.includes('propan'), `second molecule has its own local name, got ${currentName}`);
    const propanolPending = await waitFor(() => held.slice(beforePropanol).find((item) => item.url.includes('/smiles/')),
      'the second molecule PubChem lookup');
    await settleRequest(secondPending);
    assert.equal((await name.innerText()).trim(), currentName, 'a late response for the prior structure cannot overwrite the current name');

    await page.getByRole('button', { name: 'English' }).click();
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.trim().includes('propan'));
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.trim() === 'methane');
    await propanolPending.release({ IdentifierList: { CID: [1] } });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal((await name.innerText()).trim(), 'methane', 'a deleted molecule is not restored by a late external response');
    assert.doesNotMatch(await name.innerText(), /ethanol|propan|calculating/i);

    const unsupported = 'CC(=O)NC(C)C';
    await page.getByRole('button', { name: 'Español' }).click();
    failPubChemCidLookups = true;
    await importSmiles(page, unsupported);
    assert.doesNotMatch((await name.innerText()).trim(), /No disponible para esta estructura/,
      'unsupported is not announced while external verification is pending');
    await page.waitForFunction(() => document.querySelector('.iupac-dock-name')?.textContent?.includes(
      'No se pudo consultar PubChem; el soporte local sigue sin confirmarse'), null, { timeout: 15_000 })
      .catch(async () => { throw new Error(`Network error status was not rendered; current name: ${(await name.innerText()).trim()}`); });
    failPubChemCidLookups = false;
    assert.doesNotMatch((await name.innerText()).trim(), /No disponible para esta estructura/,
      'network failure does not claim that the chemistry is unsupported');

    // This amide/N-substituent combination is explicitly outside the local
    // grammar. A structurally matching PubChem record exercises the distinct
    // External name with a compositional Spanish equivalent. This case used
    // to exercise the unlocalized fallback; it now verifies the expanded
    // N-substituted acetamide grammar without weakening the race assertions.
    const externalOnlySmiles = 'CC(=O)NCC(C)C';
    const beforeExternalOnly = held.length;
    await importSmiles(page, externalOnlySmiles);
    const cidLookup = await waitFor(() => held.slice(beforeExternalOnly).find((item) => item.url.includes('/smiles/')),
      'external-only structure CID lookup');
    assert.doesNotMatch((await name.innerText()).trim(), /No disponible para esta estructura/,
      'unsupported is not announced before the PubChem check resolves');
    await cidLookup.release({ IdentifierList: { CID: [901] } });
    const propertyLookup = await waitFor(() => held.slice(beforeExternalOnly).find((item) => item.url.includes('/property/')),
      'external-only structure property lookup');
    await propertyLookup.release({ PropertyTable: { Properties: [{
      CID: 901,
      IUPACName: 'N-(2-methylpropyl)acetamide',
      IsomericSMILES: externalOnlySmiles,
      CanonicalSMILES: externalOnlySmiles,
      MolecularFormula: 'C5H11NO',
    }] } });
    await page.waitForFunction(() => !/Calculando nombre IUPAC|Calculating IUPAC name/.test(
      document.querySelector('.iupac-dock-name')?.textContent?.trim() ?? ''), null, { timeout: 15_000 });
    const externalDisplay = (await name.innerText()).trim();
    assert.equal(externalDisplay, 'N-(2-metilpropil)acetamida',
      `the newly covered name is localized compositionally, got: ${externalDisplay}`);
    assert.doesNotMatch(externalDisplay, /methylpropyl|acetamide/i,
      'the external English name is never presented as Spanish');

    assert.deepEqual(errors, [], 'browser execution has no uncaught exceptions');
  } finally {
    failPubChemCidLookups = false;
    for (const item of held) if (!item.released) await item.release({ IdentifierList: { CID: [] } });
    await page.close();
  }
});
