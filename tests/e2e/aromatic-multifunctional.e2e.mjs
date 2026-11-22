import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { moleculeFromSmiles } from '../../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../../app/validated-name-derivation.ts';
import { buildValidatedPriorityReasoning } from '../../app/reasoning-derivation-adapter.ts';
import { reasoningFragmentId } from '../../app/reasoning-visual-targets.ts';

const cases = [
  { id: 'benzanilide', cid: 7168, name: 'N-phenylbenzamide', spanishName:'N-fenilbenzamida', smiles: 'O=C(Nc1ccccc1)c1ccccc1', controls: ['parent','n-aryl','amide-nitrogen'] },
  { id: 'diclofenac', cid: 3033, name: '2-[2-(2,6-dichloroanilino)phenyl]acetic acid', spanishName:'ácido 2-[2-(2,6-dicloroanilino)fenil]acético', smiles: 'O=C(O)Cc1ccccc1Nc1c(Cl)cccc1Cl', controls: ['parent','diarylamino-phenyl','linking-nitrogen','anilino-ring-substituent-1'] },
  { id: 'ketoprofen', cid: 3825, name: '2-(3-benzoylphenyl)propanoic acid', spanishName:'ácido 2-(3-benzoilfenil)propanoico', smiles: 'CC(C(=O)O)c1cc(ccc1)C(=O)c1ccccc1', controls: ['parent','aryl-substituent','benzoyl','benzoyl-carbonyl'] },
  { id: 'mefenamic-acid', cid: 4044, name: '2-[(2,3-dimethylphenyl)amino]benzoic acid', spanishName:'ácido 2-[(2,3-dimetilfenil)amino]benzoico', smiles: 'CC1=C(C(=CC=C1)NC2=CC=CC=C2C(=O)O)C', controls: ['parent','arylamino','linking-nitrogen','arylamino-phenyl-ring-substituent-1'] },
  { id: 'tolfenamic-acid', cid: 610479, name: '2-[(3-chloro-2-methylphenyl)amino]benzoic acid', spanishName:'ácido 2-[(3-cloro-2-metilfenil)amino]benzoico', smiles: 'CC1=C(C=CC=C1Cl)NC2=CC=CC=C2C(=O)O', controls: ['parent','arylamino','linking-nitrogen','arylamino-phenyl-ring-substituent-1'] },
  { id: 'fenofibrate', cid: 3339, name: 'propan-2-yl 2-[4-(4-chlorobenzoyl)phenoxy]-2-methylpropanoate', spanishName:'propan-2-ilo 2-[4-(4-clorobenzoil)fenoxi]-2-metilpropanoato', smiles: 'CC(C)OC(=O)C(C)(C)Oc1ccc(C(=O)c2ccc(Cl)cc2)cc1', controls: ['parent','propan-2-yl','methyl-at-c2','phenoxy-at-c2','phenoxy-ring','benzoyl','benzoyl-carbonyl','chlorophenyl-ring','halogen'] },
];
const outDir = process.env.AROMATIC_E2E_OUT_DIR ?? 'reports/conciliation-integral-aromatics/e2e';
let server, browser, origin;
before(async () => {
  server = await createServer({ configFile: 'vite.pages.config.ts', server: { host: '127.0.0.1', port: 5217, strictPort: true } });
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
  await mkdir(outDir, { recursive: true });
});
after(async () => { await browser?.close(); await server?.close(); });

test('six aromatic multifunctional structures reconcile bilingually in both canvas views', async () => {
  for (const item of cases) {
    const imported = moleculeFromSmiles(item.smiles); assert.equal(imported.ok, true);
    const proof = reconcileSystematicName(imported.molecule, item.name); assert.equal(proof?.status, 'FULL', item.id);
    const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph: imported.molecule, language: 'es', activeName: item.name });
    const controls = item.controls.map(semanticId => {
      const step = reasoning.steps.find(candidate => [candidate.fragments, ...(candidate.fragments?.additionalFragments ?? [])]
        .some(fragment => fragment?.semanticId === semanticId));
      const fragment = [step?.fragments, ...(step?.fragments?.additionalFragments ?? [])].find(value => value?.semanticId === semanticId);
      assert.ok(step && fragment, `${item.id}: ${semanticId} must be available as a control`);
      const target = step.fragmentTargets[reasoningFragmentId(step.number, fragment)]; assert.ok(target?.atomIds?.length);
      return { semanticId, step: step.number, target };
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    try {
      await page.addInitScript(() => localStorage.setItem('hydrocarbonLab.guidedTour.v1', 'skipped'));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && url.pathname === '/api/name-to-structure') {
          const requestName = route.request().postDataJSON()?.name;
          const requested = cases.find(candidate => candidate.name === requestName);
          return route.fulfill({ json: requested
            ? { source: 'PubChem', originalName: requested.name, interpretedName: requested.name,
                iupacName: requested.name, smiles: requested.smiles, cid: requested.cid, warnings: [] }
            : { error: 'Unknown deterministic name fixture' }, status: requested ? 200 : 404 });
        }
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        if (url.hostname === 'pubchem.ncbi.nlm.nih.gov') {
          const value = url.pathname.includes('/property/')
            ? { PropertyTable: { Properties: [{ CID: item.cid, IUPACName: item.name, IsomericSMILES: item.smiles, CanonicalSMILES: item.smiles }] } }
            : url.pathname.includes('/description/') ? { InformationList: { Information: [{ Title: item.id }] } }
              : { IdentifierList: { CID: [item.cid] } };
          return route.fulfill({ json: value, headers: { 'access-control-allow-origin': '*' } });
        }
        if (url.hostname === 'www.ebi.ac.uk' && url.pathname.startsWith('/opsin/ws/')) {
          const requested = cases.find(candidate => decodeURIComponent(url.pathname).includes(candidate.name));
          return route.fulfill({ status: requested ? 200 : 404, json: requested
            ? { status: 'SUCCESS', smiles: requested.smiles, message: 'Deterministic OPSIN fixture' }
            : { status: 'FAILURE', message: 'Unknown deterministic name fixture' },
            headers: { 'access-control-allow-origin': '*' } });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: { 'access-control-allow-origin': '*' } });
      });
      await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator("[aria-controls='iupac-name-builder']").click();
      await page.locator('#iupac-name-input').fill(item.name);
      await page.locator('#iupac-name-builder button[type="submit"]').click();
      await page.locator('#iupac-name-input').waitFor({ state: 'hidden', timeout: 30000 });
      const panel = page.locator('#iupac-reasoning-content');
      try {
        await page.waitForFunction(() => document.querySelector('#iupac-reasoning-content')?.getAttribute('data-derivation-support') === 'FULL', null, { timeout: 8000 });
      } catch (error) {
        const diagnostic = { item: item.id, title: await page.title(), support: await panel.getAttribute('data-derivation-support'),
          visibleName: await page.locator('.iupac-dock-name').innerText().catch(() => 'name unavailable'),
          nameCategory: await page.locator('.iupac-dock-systematic-name').getAttribute('data-name-category').catch(() => null),
          titleInputs: await page.locator('input').evaluateAll(nodes => nodes.map(node => ({ id: node.id, value: node.value }))),
          text: (await panel.innerText().catch(() => 'panel unavailable')).slice(0, 1500) };
        await page.screenshot({ path: `${outDir}/${item.id}-unsupported.png`, fullPage: true });
        throw new Error(`${error.message}\n${JSON.stringify(diagnostic)}`);
      }
      await page.screenshot({ path: `${outDir}/${item.id}-full-reasoning.png`, fullPage: true });
      const visibility = page.locator('.reasoning-visibility-button');
      if (await visibility.getAttribute('aria-expanded') !== 'true') await visibility.click();
      for (const language of ['es','en']) {
        await page.getByRole('button', { name: language === 'es' ? 'Español' : 'English', exact: true }).click();
        const expectedName = language === 'es' ? item.spanishName : item.name;
        try { await page.waitForFunction(name => document.querySelector('.iupac-dock-name')?.textContent?.trim() === name, expectedName, { timeout: 15000 }); }
        catch (error) {
          const diagnostic={item:item.id,language,expectedName,displayedName:await page.locator('.iupac-dock-name').innerText().catch(()=>null),
            support:await panel.getAttribute('data-derivation-support'),category:await page.locator('.iupac-dock-systematic-name').getAttribute('data-name-category').catch(()=>null)};
          await page.screenshot({path:`${outDir}/${item.id}-language-diagnostic.png`,fullPage:true});
          throw new Error(`${error.message}\n${JSON.stringify(diagnostic)}`);
        }
        await page.waitForFunction(() => document.querySelector('#iupac-reasoning-content')?.getAttribute('data-derivation-support') === 'FULL', null, { timeout: 15000 });
        if (await visibility.getAttribute('aria-expanded') !== 'true') await visibility.click();
        for (const [view,index] of [['semi',0],['skeletal',2]]) {
          await page.locator('.view-mode-switch button').nth(index).click();
          await page.locator(view === 'semi' ? '.semi-developed-view .semi-developed-node' : '.skeletal-view .skeletal-node').first().waitFor({ state: 'attached' });
          await page.waitForFunction(() => document.querySelector('#iupac-reasoning-content')?.getAttribute('data-derivation-support') === 'FULL', null, { timeout: 15000 });
          if (await visibility.getAttribute('aria-expanded') !== 'true') await visibility.click();
          if (item.id === 'benzanilide' && language === 'es' && view === 'semi') await page.screenshot({ path: `${outDir}/benzanilide-controls-debug.png`, fullPage: true });
          for (const control of controls) {
            // Translation may regroup a component into a neighboring pedagogical
            // step. Resolve it by its stable semantic ID, not a stale step number.
            const selector = `.reasoning-name-fragment-control[data-name-fragment="${control.semanticId}"]`;
            const button = page.locator(selector).first(); assert.ok(await page.locator(selector).count() > 0, `${item.id} ${control.semanticId} control exists`);
            try { await button.waitFor({ state: 'visible', timeout: 10000 }); }
            catch (error) {
              const diagnostic = {
                item: item.id, language, view, support: await panel.getAttribute('data-derivation-support'),
                expanded: await visibility.getAttribute('aria-expanded'),
                displayedName: await page.locator('.iupac-dock-name').innerText().catch(() => 'unavailable'),
                stepIds: await page.locator('[id^="iupac-reasoning-step-"]').evaluateAll(nodes => nodes.map(node => ({ id: node.id, text: node.innerText.slice(0, 240) }))),
                fragmentIds: await page.locator('.reasoning-name-fragment-control').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-name-fragment'))),
              };
              await page.screenshot({ path: `${outDir}/${item.id}-transition-diagnostic.png`, fullPage: true });
              throw new Error(`${error.message}\n${JSON.stringify(diagnostic)}`);
            }
            await button.evaluate(node => {
              const stage=node.ownerDocument.querySelector('.molecule-stage');
              const w=node.ownerDocument.defaultView; if(!stage||!w)throw Error('Missing stage for selection observer');
              w.__aromaticOverlayResult=new Promise((resolve,reject)=>{
                const read=()=>{const overlay=stage.querySelector('.reasoning-visual-overlay');
                  if(!overlay||node.getAttribute('aria-pressed')!=='true')return;
                  observer.disconnect();clearTimeout(timer);
                  resolve({atoms:[...overlay.querySelectorAll('[data-reasoning-atom]')].map(el=>Number(el.dataset.reasoningAtom)).sort((a,b)=>a-b),
                    bonds:[...new Set([...overlay.querySelectorAll('[data-reasoning-bond]')].map(el=>el.dataset.reasoningBond.split(':').map(Number).sort((a,b)=>a-b).join(':')))].sort()});};
                const observer=new MutationObserver(read);observer.observe(stage,{childList:true,subtree:true,attributes:true});observer.observe(node,{attributes:true});
                const timer=setTimeout(()=>{observer.disconnect();reject(Error(`No transient highlight for ${node.dataset.nameFragment}`));},5000);read();
              });
            });
            await button.click();
            const exact = await page.evaluate(() => window.__aromaticOverlayResult);
            exact.expectedAtoms = [...control.target.atomIds].sort((a,b)=>a-b);
            exact.expectedBonds = control.target.bondIds.map(([a,b])=>[Number(a),Number(b)].sort((x,y)=>x-y).join(':')).sort();
            assert.deepEqual(exact.atoms, exact.expectedAtoms, `${item.id} ${control.semanticId} atoms`);
            assert.deepEqual(exact.bonds, exact.expectedBonds, `${item.id} ${control.semanticId} bonds`);
            if (language === 'es' && view === 'skeletal' && ['diclofenac','ketoprofen','fenofibrate'].includes(item.id))
              await page.screenshot({ path: `${outDir}/${item.id}-nested-controls.png`, fullPage: true });
          }
          const text = await panel.innerText(); assert.ok(text.length > 100, `${item.id} ${language} explanation`);
          assert.equal(await panel.getAttribute('data-derivation-support'), 'FULL', `${item.id} ${language} ${view} remains FULL`);
          assert.doesNotMatch(text, /candidate rejected|candidato descartado|debug|diagnostic/i);
        }
      }
    } finally { await page.close(); }
  }
});
