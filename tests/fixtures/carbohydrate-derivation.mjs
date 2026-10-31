import {readFileSync} from 'node:fs';
const read=file=>JSON.parse(readFileSync(new URL(`../../reports/${file}`,import.meta.url),'utf8'));
export const carbohydrateReferences=read('carbohydrate-reference-live.json');
export const carbohydrateControls=read('carbohydrate-systematic-controls.json');
// Names, family, series, form and anomer are fixed expectations from the
// independently resolved retained names, not outputs of the recognizer.
const expected=[
  ['glucose','D','open',undefined,1],['glucose','L','open',undefined,1],
  ['glucose','D','pyranose','alpha',1],['glucose','D','pyranose','beta',1],
  ['glucose','D','furanose','alpha',1],['glucose','D','furanose','beta',1],
  ['mannose','D','open',undefined,1],['galactose','D','open',undefined,1],
  ['fructose','D','open',undefined,2],['fructose','D','furanose',undefined,2],
  ['glucose','L','pyranose','alpha',1],['glucose','L','pyranose','beta',1],
  ['ribose','D','open',undefined,1],['ribose','D','furanose','alpha',1],
];
// Independent carbohydrate locants outside the heterocycle in each reference.
const exocyclicLocants=[[],[],[6],[6],[5,6],[5,6],[],[],[],[1,6],[6],[6],[],[5]];

/** Independent numbered OPSIN CML graph. Explicit H atoms and locant labels
 * establish chain numbering and OH identity without the carbohydrate engine. */
export function numberedCml(cml){
  const all=[...cml.matchAll(/<atom\b([^>]*?)(?:\/>|>([\s\S]*?)<\/atom>)/g)].map(m=>({
    id:Number(/\bid="a(\d+)"/.exec(m[1])[1]),element:/elementType="([A-Za-z]+)"/.exec(m[1])[1],
    locant:/<label value="([1-6])"/.exec(m[2]??'')?.[1],
  }));
  const heavy=all.filter(a=>a.element!=='H'),ids=new Map(heavy.map((a,i)=>[a.id,i+1]));
  const bonds=[...cml.matchAll(/<bond\b[^>]*atomRefs2="a(\d+) a(\d+)" order="([SDT])"/g)]
    .map(m=>[Number(m[1]),Number(m[2]),{S:1,D:2,T:3}[m[3]]]);
  const heavyBonds=bonds.filter(([a,b])=>ids.has(a)&&ids.has(b)).map(([a,b,o])=>[ids.get(a),ids.get(b),o]);
  const numbering=heavy.filter(a=>a.element==='C'&&a.locant).map(a=>[ids.get(a.id),Number(a.locant)]).sort((a,b)=>a[1]-b[1]);
  const degree=id=>heavyBonds.filter(([a,b])=>a===id||b===id).length;
  const ringOxygen=heavy.find(a=>a.element==='O'&&degree(ids.get(a.id))===2);
  // The generic OH extraction below uses explicit CML H neighbours; keep
  // heavy-atom IDs in the same order as the independently published SMILES.
  const hydroxylIds=heavy.filter(atom=>atom.element==='O'&&bonds.some(([a,b])=>
    a===atom.id&&all.find(t=>t.id===b)?.element==='H'||b===atom.id&&all.find(t=>t.id===a)?.element==='H')).map(a=>ids.get(a.id));
  return {numbering,ringOxygenId:ringOxygen?ids.get(ringOxygen.id):undefined,hydroxylIds,
    atoms:heavy.map(a=>({id:ids.get(a.id),element:a.element,x:0,y:0})),bonds:heavyBonds};
}

export const carbohydrateCases=carbohydrateReferences.slice(0,14).map((r,i)=>{
  const corrected=i===1?carbohydrateControls.find(r=>r.name==='(2S,3R,4S,5S)-2,3,4,5,6-pentahydroxyhexanal')?.pubchem?.body?.PropertyTable?.Properties?.[0]:undefined;
  const p=corrected??r.pubchem.body.PropertyTable.Properties[0];
  const [family,series,form,anomer,carbonylPosition]=expected[i];
  return {common:r.query,name:p.IUPACName,cid:p.CID,formula:p.MolecularFormula,smiles:r.opsin.body.smiles,cml:r.opsin.body.cml,
    pubchemSmiles:p.SMILES??p.IsomericSMILES,family,series,form,anomer,carbonylPosition,priority:i<10,
    exocyclicLocants:exocyclicLocants[i],
    expectedRetained:i===9?'PARTIAL':'FULL',reference:numberedCml(r.opsin.body.cml)};
});
