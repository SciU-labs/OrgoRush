import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, preview } from "vite";
import { acids, alcohols } from "../fixtures/multifunctional-reconciliation.mjs";
import { mapStructuralRegions } from "../../app/structural-derivation.ts";
import { reconcileSystematicName } from "../../app/validated-name-derivation.ts";
import { chromium } from "playwright";
import { moleculeFromSmiles,inspectSmilesStructure } from "../../app/openchemlib-adapter.ts";

const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
// The SMILES encounter order is the editor importer's ID order. Define
// expected regions independently of the name grammar and its isomorphism.
const cases=[
  ["fluoxetine","CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F","N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine",[
    ["suffix",[2],[[2,3]]],["parent",[3,4,5]],["n-alkyl",[1],[[1,2]]],["locant:parent:5:3",[5]],["phenyl",range(6,11),[[5,6]]],
    ["phenoxy",range(12,22),[[5,12]]],["phenoxy-aryl-core",range(12,18),[[5,12]]],["locant:phenoxy:16:4",[16]],
    ["phenoxy-ring-substituent",range(19,22),[[16,19]]],["phenoxy-ring-substituent-halogens",range(20,22),[[19,20],[19,21],[19,22]]]]],
  ["diphenhydramine","CN(C)CCOC(c1ccccc1)c1ccccc1","2-(diphenylmethoxy)-N,N-dimethylethan-1-amine",[
    ["n-alkyl",[1,3],[[1,2],[2,3]]],["diphenylmethoxy",range(6,19),[[5,6]]],["diphenylmethoxy-phenyl",range(8,19),[[7,8],[7,14]]]]],
  ["lidocaine","CCN(CC)CC(=O)Nc1c(C)cccc1C","2-(diethylamino)-N-(2,6-dimethylphenyl)acetamide",[
    ["suffix",[7,8,9]],["branch-0-amino",[3],[[3,6]]],["branch-0-amino-alkyl",[1,2,4,5],[[2,3],[3,4]]],["*-ring-alkyl",[12,17],[[11,12],[16,17]]]]],
  ["paracetamol","CC(=O)Nc1ccc(O)cc1","N-(4-hydroxyphenyl)acetamide",[["suffix",[2,3,4]],["name:4-hydroxyphenyl",range(4,11)]]],
  ["ibuprofen","CC(C)Cc1ccc(C(C)C(=O)O)cc1","2-[4-(2-methylpropyl)phenyl]propanoic acid",[["suffix",[11,12,13]],["name:2-methylpropyl",range(1,4),[[4,5]]]]],
];
const newTargets=[
  [["group-0",[1,2,3,4,13],[[4,5]]]],
  [["group-0",range(1,8),[[7,9]]],["group-3-link",[5],[[5,6]]]],
  [["suffix",[12,13]],["group-3-link",[9],[[8,9]]]],
  [["group-3",range(1,4),[[4,5]]],["group-0-link",[9],[[9,10]]]],
  [["carboxyl-2",[7,8,9]],["suffix",[1,2,3,7,8,9,11,12,13]]],
  [["suffix",[1,2,3,7,8,9]]], [["suffix",[1,2,3,8,9,10]]],
  [["suffix",[1,2,3,7,8,9]]], [["carboxyl-1",[1,2,3]]], [["carboxyl-1",[1,2,3]]],
];
const priorityIds=["adrenalina","salbutamol","venlafaxina","metoprolol","citrico","malico","tartarico","glutarico","glutamico","metilbutanodioico"];
const extra=[...alcohols,...acids].map(([,name,smiles],i)=>[priorityIds[i],smiles,name,newTargets[i]]);
cases.push(...extra);
const spanishNames=[
  "3-fenil-N-metil-3-[4-(trifluorometil)fenoxi]propan-1-amina","2-(difenilmetoxi)-N,N-dimetiletan-1-amina",
  "2-(dietilamino)-N-(2,6-dimetilfenil)acetamida","N-(4-hidroxifenil)acetamida","ácido 2-[4-(2-metilpropil)fenil]propanoico",
];
spanishNames.push("4-[(1R)-1-hidroxi-2-(metilamino)etil]benceno-1,2-diol","4-[2-(terc-butilamino)-1-hidroxietil]-2-(hidroximetil)fenol","1-[2-(dimetilamino)-1-(4-metoxifenil)etil]ciclohexan-1-ol","1-[4-(2-metoxietil)fenoxi]-3-(propan-2-ilamino)propan-2-ol","ácido 2-hidroxipropano-1,2,3-tricarboxílico","ácido (2S)-2-hidroxibutanodioico","ácido (2R,3R)-2,3-dihidroxibutanodioico","ácido pentanodioico","ácido (2S)-2-aminopentanodioico","ácido 2-metilbutanodioico");
const tntSmiles="Cc1c([N+](=O)[O-])cc([N+](=O)[O-])cc1[N+](=O)[O-]",tntName="2-methyl-1,3,5-trinitrobenzene";
const tntGraph=moleculeFromSmiles(tntSmiles).molecule,tntProof=reconcileSystematicName(tntGraph,tntName);
assert.ok(tntProof);
const tntComponent=id=>tntProof.components.find(component=>component.id===id);
const tntSelection=id=>{const component=tntComponent(id);return [id,component.atomIds,
  component.bondIds.filter(([a,b])=>!component.atomIds.includes(a)||!component.atomIds.includes(b))];};
cases.push(["tnt",tntSmiles,tntName,[
  tntSelection("parent"),tntSelection("prefix-0"),tntSelection("prefix-1"),
  tntSelection("prefix-1-occurrence-0"),tntSelection("prefix-1-occurrence-1"),tntSelection("prefix-1-occurrence-2"),
]]);
cases.at(-1)[3].push(...tntComponent("parent").writtenLocants.map(({atomId,locant})=>[
  `locant:parent:${atomId}:${locant}`,[atomId],[]]));
spanishNames.push("2-metil-1,3,5-trinitrobenceno");
const bondKey=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(":");
let server,browser,origin;
before(async()=>{
  const host={host:"127.0.0.1",port:0};
  if(process.env.ORGORUSH_BUILT_PAGES) {
    server=await preview({configFile:"vite.pages.config.ts",preview:host});
  } else {
    server=await createServer({configFile:"vite.pages.config.ts",server:host});
    await server.listen();
  }
  origin="http://127.0.0.1:"+server.httpServer.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.ORGORUSH_CHROMIUM_EXECUTABLE});
  if(process.env.ORGORUSH_SCREENSHOTS) await mkdir(process.env.ORGORUSH_SCREENSHOTS,{recursive:true});
});
after(async()=>{await browser?.close();await server?.close()});
for(const [index,[id,smiles,name,selections]] of cases.entries()) test(id+" has exact bilingual selections in both representations",async()=>{
  const graph=moleculeFromSmiles(smiles).molecule, formula=inspectSmilesStructure(smiles).formula;
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const cdp=await page.context().newCDPSession(page);
  try {
    await page.addInitScript(()=>localStorage.setItem("hydrocarbonLab.guidedTour.v1","skipped"));
    await page.route("**/*",route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin && !url.pathname.startsWith("/api/"))return route.continue();
      let data={};
      if(url.hostname==="pubchem.ncbi.nlm.nih.gov") {
        if(url.pathname.includes("/smiles/")&&url.pathname.includes("/cids/")){
          const queried=decodeURIComponent(url.pathname.split("/smiles/")[1].split("/cids/")[0]);
          const candidate=moleculeFromSmiles(queried);
          data={IdentifierList:{CID:candidate.ok&&mapStructuralRegions(candidate.molecule,graph,[])?[900000+index]:[]}};
        }
        if(url.pathname.includes("/property/"))data={PropertyTable:{Properties:[{CID:900000+index,IUPACName:name,IsomericSMILES:smiles,CanonicalSMILES:smiles,MolecularFormula:formula}]}};
        if(url.pathname.includes("/description/"))data={InformationList:{Information:[{Title:id}]}};
      }
      return route.fulfill({json:data,headers:{"access-control-allow-origin":"*"}});
    });
    await page.goto(origin+"/OrgoRush/es/",{waitUntil:"domcontentloaded"});
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(smiles);
    await page.locator("#smiles-interop-panel button[type=submit]").click();
    const panel=page.locator("#iupac-reasoning-content"),stage=page.locator(".molecule-stage");
    for(const language of ["es","en"]){
      await page.getByRole("button",{name:language==="es"?"Español":"English",exact:true}).click();
      await page.waitForFunction(n=>document.querySelector(".iupac-dock-name")?.textContent?.trim()===n,language==="es"?spanishNames[index]:name,{timeout:15000}).catch(async error=>{throw Error(`${id} (${language}) displayed: ${await page.locator(".iupac-dock-name").textContent()}`,{cause:error})});
      const toggle=page.locator(".reasoning-visibility-button");
      if(await toggle.getAttribute("aria-expanded")!=="true")await toggle.click();
      assert.equal(await panel.getAttribute("data-derivation-support"),"FULL");
      for(const [mode,buttonIndex] of [["semi",0],["skeletal",2]]){
        const modeButton=page.locator(".view-mode-switch button").nth(buttonIndex);
        await modeButton.click(); assert.equal(await modeButton.getAttribute("aria-pressed"),"true");
        await page.locator(mode==="semi"?".semi-developed-view .semi-developed-node":".skeletal-view .skeletal-node").first().waitFor({state:"attached"});
        await stage.scrollIntoViewIfNeeded();
        const clip=await stage.evaluate(el=>{
          const {x,y,width,height}=el.getBoundingClientRect();
          return {x:x+scrollX,y:y+scrollY,width,height,scale:1};
        });
        assert.equal(await stage.locator(".stage-legend span").first().innerText(),["adrenalina","salbutamol","venlafaxina","tnt"].includes(id)?(language==="es"?"Anillo principal":"Parent ring"):(language==="es"?"Cadena principal":"Parent chain"));
        for(const [semantic,atoms,extra=[]] of selections){
          const selector=semantic.startsWith("*")?'[data-name-fragment$="'+semantic.slice(1)+'"]':'[data-name-fragment="'+semantic+'"]';
          // Target the chemical explanation; the alphabetical recap and the
          // parent numbering step can legitimately cite the same group again.
          const step=panel.locator("li").filter({has:page.locator(selector)}).filter({hasNot:page.locator('strong:text-is("Alphabetical order"),strong:text-is("Orden alfabético")')}).first();
          const control=step.locator(selector);assert.equal(await control.count(),1,semantic);
          // Observe the same render that activates the two-second highlight.
          // Clicking in the DOM leaves the canvas in the viewport for capture.
          const actual=await control.evaluate(button=>new Promise((resolve,reject)=>{
            const stage=document.querySelector(".molecule-stage");
            const read=()=>{
              const el=stage.querySelector(".reasoning-visual-overlay");
              if(!el || button.getAttribute("aria-pressed")!=="true")return;
              observer.disconnect();clearTimeout(timer);
              resolve({
                atoms:[...el.querySelectorAll("[data-reasoning-atom]")].map(n=>+n.dataset.reasoningAtom).sort((a,b)=>a-b),
                bonds:[...el.querySelectorAll("[data-reasoning-bond]")].map(n=>n.dataset.reasoningBond.split(":").map(Number).sort((a,b)=>a-b).join(":")).sort(),
              });
            };
            const observer=new MutationObserver(read);
            observer.observe(stage,{childList:true,subtree:true,attributes:true});
            observer.observe(button,{attributes:true});
            const timer=setTimeout(()=>{observer.disconnect();reject(Error("No active overlay for "+button.dataset.nameFragment));},4000);
            button.click();read();
          }));
          assert.deepEqual(actual.atoms,[...atoms].sort((a,b)=>a-b),semantic);
          const bonds=graph.bonds.filter(([a,b])=>atoms.includes(a)&&atoms.includes(b)).concat(extra);
          assert.deepEqual(actual.bonds,[...new Set(bonds.map(([a,b])=>bondKey(a,b)))].sort(),semantic);
          const captureTnt=new Set(["parent","prefix-0","prefix-1","prefix-1-occurrence-0",...selections.filter(([target])=>target.startsWith("locant:parent:")).map(([target])=>target)]);
          if(process.env.ORGORUSH_SCREENSHOTS && (id==="tnt"?captureTnt.has(semantic):semantic===selections.at(-1)[0])){
            // Avoid Locator.screenshot's scroll and font-stability waits
            // between activation and capture. Reacquire if rendering the
            // frame exceeded the normal lifetime of the selection.
            let frame;
            for(let attempt=0;attempt<3 && !frame;attempt++){
              await control.evaluate(button=>button.click());
              await page.waitForFunction(()=>document.querySelector(".reasoning-visual-overlay"),null,{timeout:2000});
              const {data}=await cdp.send("Page.captureScreenshot",{format:"png",clip,captureBeyondViewport:true});
              if(await control.getAttribute("aria-pressed")==="true")frame=Buffer.from(data,"base64");
            }
            assert.ok(frame,"capture during the highlight: "+id+" "+language+" "+mode+" "+semantic);
            await writeFile(process.env.ORGORUSH_SCREENSHOTS+"/"+id+(id==="tnt"?"-"+semantic.replaceAll(":","-"):"")+"-"+language+"-"+mode+".png",frame);
          }
        }
      }
    }
  }finally{await page.close()}
});
