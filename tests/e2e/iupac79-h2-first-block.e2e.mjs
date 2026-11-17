import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const cases = [
  ['Citric Acid', 'C(C(=O)O)C(CC(=O)O)(C(=O)O)O', 'ácido 2-hidroxipropano-1,2,3-tricarboxílico', '2-hydroxypropane-1,2,3-tricarboxylic acid'],
  ['Ibuprofen ordering regression', 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O', 'ácido 2-[4-(2-metilpropil)fenil]propanoico', '2-[4-(2-methylpropyl)phenyl]propanoic acid'],
  ['Benzophenone', 'O=C(c1ccccc1)c1ccccc1', 'difenilmetanona', 'diphenylmethanone'],
  ['Tyramine', 'NCCc1ccc(O)cc1', '4-(2-aminoetil)fenol', '4-(2-aminoethyl)phenol'],
  ['Dopamine', 'NCCc1ccc(O)c(O)c1', '4-(2-aminoetil)-1,2-bencenodiol', '4-(2-aminoethyl)-1,2-benzenediol'],
  ['Acetaminophen', 'CC(=O)Nc1ccc(O)cc1', 'N-(4-hidroxifenil)etanamida', 'N-(4-hydroxyphenyl)ethanamide'],
  ['Aspirin', 'CC(=O)Oc1ccccc1C(=O)O', 'ácido 2-acetoxibenzoico', '2-acetoxybenzoic acid'],
  ['2,4-dichlorophenoxyacetic acid', 'O=C(O)COc1c(Cl)cc(Cl)cc1', 'ácido 2-(2,4-diclorofenoxi)etanoico', '2-(2,4-dichlorophenoxy)ethanoic acid'],
  ['Ibuprofen', 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O', 'ácido 2-(4-[2-metilpropil]fenil)propanoico', '2-(4-[2-methylpropyl]phenyl)propanoic acid'],
  ['Bupropion', 'CC(C(=O)C1=CC(=CC=C1)Cl)NC(C)(C)C', '1-(3-clorofenil)-2-(1,1-dimetiletilamino)-1-propanona', '1-(3-chlorophenyl)-2-(1,1-dimethylethylamino)-1-propanone'],
  ['Norepinephrine', 'C1=CC(=C(C=C1[C@H](CN)O)O)O', '4-[(1R)-2-amino-1-hidroxietil]-1,2-bencenodiol', '4-[(1R)-2-amino-1-hydroxyethyl]-1,2-benzenediol'],
  ['Epinephrine', 'CNC[C@@H](C1=CC(=C(C=C1)O)O)O', '4-[(1R)-1-hidroxi-2-(metilamino)etil]-1,2-bencenodiol', '4-[(1R)-1-hydroxy-2-(methylamino)ethyl]-1,2-benzenediol'],
  ['Lidocaine', 'CCN(CC)CC(=O)NC1=C(C=CC=C1C)C', '2-(dietilamino)-N-(2,6-dimetilfenil)etanamida', '2-(diethylamino)-N-(2,6-dimethylphenyl)ethanamide'],
  ['Fluoxetine', 'CNCCC(C1=CC=CC=C1)OC2=CC=C(C=C2)C(F)(F)F', '3-fenil-N-metil-3-[4-(trifluorometil)fenoxi]-1-propanamina', 'N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]-1-propanamine'],
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

for (const [family, smiles, es, en] of cases) test(`H2 1979 bilingual names: ${family}`, async () => {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  try {
    await page.addInitScript(() => {
      localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped');
      localStorage.setItem('hydrocarbon-lab-language', 'es');
    });
    await page.route('**/*', async route => route.request().url().startsWith(origin)
      ? route.continue() : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill(smiles);
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    await page.locator('.iupac-dock-expand').click();
    const legacy = page.getByRole('button', { name: /IUPAC 1979 \(Legacy\)/ }).first();
    await legacy.waitFor({ state: 'visible', timeout: 30_000 }); await legacy.click();
    const name = page.locator('.iupac-dock-name');
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, es, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), es);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('.iupac-dock-name')?.textContent?.trim() === expected, en, { timeout: 30_000 });
    assert.equal((await name.innerText()).trim(), en);
  } finally { await page.close(); }
});
