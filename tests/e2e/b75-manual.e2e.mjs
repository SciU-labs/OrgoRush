import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {structuralIdentity} from '../helpers/reference-corpus.mjs';

test('manual tools attach functional groups and retain the graph across both views', async () => {
  const out='reports/b75/browser'; await mkdir(out,{recursive:true});
  const server=await createServer({configFile:fileURLToPath(new URL('../../vite.pages.config.ts',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen();
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
    const cases=[
      {id:'butano',carbons:4,expected:'CCCC'}, {id:'pentanol',carbons:5,group:'Alcohol',expected:'CCCCCO'},
      {id:'ramificado',carbons:4,branch:true,expected:'CCC(C)C'},
      {id:'propan-2-ol',carbons:3,group:'Alcohol',anchor:2,expected:'CC(O)C'},
      {id:'amina',carbons:3,group:'Amina',expected:'CCCN'}, {id:'acido',carbons:3,group:'Ácido carboxílico',expected:'CCC(=O)O'},
      {id:'amida',carbons:3,group:'Amida',expected:'CCC(=O)N'}, {id:'alqueno',carbons:3,double:true,expected:'C=CC'},
      {id:'alquino',carbons:3,triple:true,expected:'C#CC'},
      {id:'nitro',carbons:3,group:'Nitro',expected:'CCC[N+](=O)[O-]'},
    ];
    for(const item of cases.filter(value=>!process.env.B75_CASE || value.id===process.env.B75_CASE)) {
      const page=await browser.newPage({viewport:{width:1440,height:1000}});
      await page.addInitScript(()=>{localStorage.setItem('hydrocarbonLab.guidedTour.v1','skipped');localStorage.setItem('hydrocarbon-lab-language','es')});
      await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&!u.pathname.startsWith('/api/'))return route.continue();return route.fulfill({status:200,contentType:'application/json',body:'{}'});});
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/OrgoRush/es/`,{waitUntil:'domcontentloaded',timeout:90000});
      await page.locator('.molecule-nodes-layer [data-atom-id="1"]').click({force:true,timeout:90000});
      if(item.double||item.triple) await page.getByTitle(item.double?'Crear enlace doble':'Crear enlace triple').click();
      for(let i=1;i<item.carbons;i++) {
        await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
        if((item.double||item.triple) && i===1) await page.getByTitle('Crear enlace simple').click();
      }
      if(item.branch){await page.locator('.molecule-nodes-layer [data-atom-id="2"]').click({force:true});await page.getByRole('button',{name:'Añadir carbono hacia arriba'}).click();}
      if(item.group) {
        await page.locator('.functional-button').click();
        await page.locator('.functional-option').filter({has:page.getByText(item.group,{exact:true})}).click();
        await page.locator(`.molecule-nodes-layer [data-atom-id="${item.anchor??item.carbons}"]`).click({force:true});
      }
      const expected=item.carbons+(item.branch?1:0)+(item.group?(item.group==='Nitro'?3:item.group==='Alcohol'||item.group==='Amina'?1:2):0);
      await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n,expected);
      const graph=async()=>({atoms:await page.locator('.molecule-nodes-layer [data-atom-id]').count(),bonds:await page.locator('.molecule-bonds-layer [data-bond-a][data-bond-b]').count()});
      const before=await graph();assert.equal(before.atoms,expected);assert.equal(before.bonds,expected-1);
      const exported=async()=>{await page.locator('[aria-controls="smiles-interop-panel"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar SMILES (.smi)'}).click();const download=await pending;const smiles=(await readFile(await download.path(),'utf8')).trim().split(/\s+/)[0];await page.locator('[aria-controls="smiles-interop-panel"]').click();return smiles;};
      assert.equal(structuralIdentity(await exported()),structuralIdentity(item.expected),`${item.id}: graph`);
      for(const [view,index] of [['skeletal',2],['semi',0]]) {
        await page.locator('.view-mode-switch button').nth(index).click();
        assert.deepEqual(await graph(),before);
        await page.locator('.molecule-stage').screenshot({path:`${out}/${item.id}-${view}.png`});
      }
      assert.equal(structuralIdentity(await exported()),structuralIdentity(item.expected),`${item.id}: view changes`);
      if(['ramificado','alqueno','acido'].includes(item.id)) {
        const smiles=await exported();await page.locator('[aria-controls="smiles-interop-panel"]').click();
        await page.locator('#smiles-text-input').fill(smiles);await page.locator('#smiles-interop-panel button[type="submit"]').click();
        await page.locator('[aria-controls="smiles-interop-panel"]').click();
        assert.equal(structuralIdentity(await exported()),structuralIdentity(item.expected),`${item.id}: SMILES roundtrip`);
      }
      const terminal=await page.evaluate(()=>{const nodes=[...document.querySelectorAll('.molecule-nodes-layer [data-atom-id]')];const bonds=[...document.querySelectorAll('.molecule-bonds-layer [data-bond-a][data-bond-b]')];return nodes.find(n=>n.dataset.atomElement==='C'&&bonds.filter(b=>b.dataset.bondA===n.dataset.atomId||b.dataset.bondB===n.dataset.atomId).length===1)?.dataset.atomId});
      assert.ok(terminal);await page.locator(`.molecule-nodes-layer [data-atom-id="${terminal}"]`).click({force:true});
      const snapshot=async()=>page.evaluate(()=>({
        atoms:[...document.querySelectorAll('.molecule-nodes-layer [data-atom-id]')].map(n=>[n.dataset.atomId,n.getAttribute('transform')]),
        bonds:[...document.querySelectorAll('.molecule-bonds-layer [data-bond-a][data-bond-b]')].map(n=>[n.dataset.bondA,n.dataset.bondB,n.dataset.bondOrder]),
      }));
      const beforeAddition=await snapshot();
      let usedDirection='izquierda';
      await page.getByRole('button',{name:'Añadir carbono hacia izquierda'}).click();
      await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n+1
        || document.body.innerText.includes('No hay una posición segura en esa dirección.'),expected);
      if(await page.locator('.molecule-nodes-layer [data-atom-id]').count()===expected) {
        // A leftward orthogonal bond would overlap the existing bond. The
        // former test silently accepted a different direction in this case.
        assert.deepEqual(await snapshot(),beforeAddition,`${item.id}: rejected addition changed the graph or positions`);
        const [edge]=beforeAddition.bonds.filter(([a,b])=>a===terminal||b===terminal);
        const neighbor=edge[0]===terminal?edge[1]:edge[0];
        const point=id=>{const match=beforeAddition.atoms.find(([atom])=>atom===id)[1].match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return{x:Number(match[1]),y:Number(match[2])}};
        const origin=point(terminal),occupied=point(neighbor);
        assert.ok(occupied.x<origin.x && Math.abs(occupied.y-origin.y)<1e-6,`${item.id}: rejection must correspond to the occupied left sector`);
        usedDirection='derecha';
        await page.getByRole('button',{name:'Añadir carbono hacia derecha'}).click();
      }
      await page.waitForFunction(n=>document.querySelectorAll('.molecule-nodes-layer [data-atom-id]').length===n,expected+1);
      const afterAddition=await snapshot();
      for(const bond of beforeAddition.bonds)assert.ok(afterAddition.bonds.some(next=>JSON.stringify(next)===JSON.stringify(bond)),`${item.id}: an existing bond changed`);
      const newAtom=afterAddition.atoms.find(([id])=>!beforeAddition.atoms.some(([old])=>old===id));assert.ok(newAtom);
      const xy=entry=>{const match=entry[1].match(/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)/i);return{x:Number(match[1]),y:Number(match[2])}};
      const from=xy(beforeAddition.atoms.find(([id])=>id===terminal)), added=xy(newAtom);
      assert.ok((added.x-from.x)*(usedDirection==='derecha'?1:-1)>1e-6,`${item.id}: the added atom did not follow the selected direction`);
      await page.close();
    }
  } finally {await browser?.close();await server.close();}
},{timeout:600000});
