import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

test('the para-methylanisole alias is shown in both interface languages',async()=>{
  const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  let browser;
  try{
    await server.listen();
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='127.0.0.1'&&!url.pathname.includes('/api/'))return route.continue();
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'});
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded'});
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator('#smiles-text-input').fill('CC1=CC=C(C=C1)OC');
    await page.locator('#smiles-interop-panel button[type="submit"]').click();
    const alias=page.locator('.iupac-dock-common-name');
    await alias.waitFor({state:'visible',timeout:20000});
    assert.match(await alias.textContent(),/También conocido como:\s*4-metilanisol/);
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.getByText('Also known as:',{exact:true}).waitFor({state:'visible',timeout:20000});
    assert.match(await alias.textContent(),/Also known as:\s*4-methylanisole/);
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await server.close()}
},{timeout:90000});
