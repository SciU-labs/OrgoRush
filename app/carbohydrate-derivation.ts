import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedNameDerivation } from "./validated-name-derivation.ts";
import { mapStructuralRegions } from "./structural-derivation.ts";
import { buildCarbohydrateGraph, recognizeCarbohydrate, SUGAR_FAMILIES } from "./carbohydrate-structure.ts";

type Parsed = {graph:GeneratedMolecule;components:NameComponent[];parent:number[]};
const locants=(text:string)=>text.split(',').map(Number);
const uniqueAscending=(ps:number[])=>ps.every((p,i)=>!i||p>ps[i-1]);
type Descriptor = {locant:number;configuration:'R'|'S'};
function descriptors(text:string):Descriptor[]|null {
  if(!/^[1-6][RS](?:,[1-6][RS])*$/.test(text))return null;
  const ds=text.split(',').map(s=>({locant:Number(s[0]),configuration:s[1] as 'R'|'S'}));
  return uniqueAscending(ds.map(d=>d.locant))?ds:null;
}
function add(graph:GeneratedMolecule,components:NameComponent[],id:string,role:NameComponent['role'],name:string,start:number,text:string,ids:number[],explanation:string,
  numbering:NameComponent['numbering']=[],label?:string,bonds?:[number,number][]) {
  components.push({id,role,text,start,end:start+text.length,atomIds:ids,numbering,explanation,...(label?{label}:{}),
    bondIds:bonds??graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b])});
  return name.slice(start,start+text.length)===text;
}

function retained(name:string):Parsed|null {
  const cyclic=/^(alpha|beta|α|β)-(D|L)-([a-z]+)(pyranose|furanose)$/.exec(name);
  const open=/^(aldehydo|keto)-(D|L)-([a-z]+)$/.exec(name);
  if(!cyclic&&!open)return null;
  const series=(cyclic??open)![2],family=SUGAR_FAMILIES.find(f=>cyclic?f.stem===cyclic[3]:f.name===open![3]);
  if(!family||open&&(open[1]==='aldehydo'?1:2)!==family.carbonyl)return null;
  const form=cyclic?.[4],closure=form?family.carbonyl+(form==='furanose'?3:4):undefined;
  if(closure!==undefined&&closure>family.carbons)return null;
  const pattern=family.pattern.split('').map(c=>series==='D'?c:c==='+'?'-':'+').join('');
  const alpha=cyclic?.[1]==='alpha'||cyclic?.[1]==='α';
  const side=series==='D'?'right':'left';
  const graph=buildCarbohydrateGraph(family.carbons,family.carbonyl,closure,pattern,alpha?side:side==='right'?'left':'right');
  if(!graph)return null;
  const structure=recognizeCarbohydrate(graph);if(!structure?.complete||!structure.family||cyclic&&!structure.anomer)return null;
  const components:NameComponent[]=[],word=cyclic?`${family.stem}${form}`:family.name,start=name.indexOf(word);
  const parent=closure?[...structure.ringAtomIds,...structure.carbonIds.filter(id=>!structure.ringAtomIds.includes(id))]:structure.carbonIds;
  add(graph,components,'parent','parent',name,start,word,parent,
    `${family.carbons===6?'Hexose':'Pentose'}: one unbranched ${family.carbons}-carbon skeleton, numbered from the ${family.carbonyl===1?'potential aldehyde C1':'potential ketone C2'}. `+
    `The ${family.name} stereoparent is proved by the complete ordered Fischer OH pattern ${pattern.replaceAll('+','right ').replaceAll('-','left ').trim()}, not by molecular formula or a common-name lookup.`,structure.numbering);
  add(graph,components,'sugar-family','prefix',name,start,word,structure.centers.filter(c=>c.locant!==family.carbonyl).map(c=>c.atomId),
    `All non-anomeric configurations match ${series}-${family.name}. Epimers and its mirror image have different ordered configurations; closure can change CIP priorities without changing this stereoparent.`,
    structure.centers.filter(c=>c.locant!==family.carbonyl).map(c=>[c.atomId,c.locant]),'Configurational family');
  const seriesStart=(cyclic??open)![1].length+1;
  add(graph,components,'sugar-series','prefix',name,seriesStart,series,[structure.configurationalAtomId],
    `${series} is established at the highest-numbered parent chirality centre C${structure.configurationalPosition}. Its oxygen is ${side} in the conventional acyclic Fischer frame (lowest carbon locant above). This is a ligand-order comparison with the glyceraldehyde reference, not a universal R/D equivalence or a screen direction.`,
    [[structure.configurationalAtomId,structure.configurationalPosition]]);
  if(cyclic){
    add(graph,components,'sugar-ring','suffix',name,name.length-form!.length,form!,structure.ringAtomIds,
      `${form} identifies a saturated ${form==='furanose'?'five':'six'}-membered ring containing one oxygen. Closure joins C${family.carbonyl} to the oxygen originally on C${closure}; the remaining carbons are exocyclic.`,
      structure.numbering.filter(([id])=>structure.ringAtomIds.includes(id)));
    add(graph,components,'sugar-anomer','prefix',name,0,cyclic[1],[structure.anomericAtomId!,structure.anomericHydroxylId!,structure.configurationalAtomId],
      `${alpha?'Alpha':'Beta'} compares the exocyclic oxygen at anomeric C${family.carbonyl} with the oxygen at reference C${structure.configurationalPosition}. Their formal Fischer relationship is ${alpha?'cis':'trans'}. Both absolute configurations are explicit and checked; rotating or reflecting the drawing does not change them.`,
      [[structure.anomericAtomId!,family.carbonyl],[structure.configurationalAtomId,structure.configurationalPosition]],undefined,
      [[structure.anomericAtomId!,structure.anomericHydroxylId!]]);
  }else{
    add(graph,components,'sugar-open','prefix',name,0,open![1],[structure.carbonyl!.carbonId,structure.carbonyl!.oxygenId],
      `${open![1]} explicitly selects the open ${family.carbonyl===1?'aldehyde':'ketone'} form. C${family.carbonyl}=O is present; this proof does not identify an open chain with a cyclic tautomer.`,[[structure.carbonyl!.carbonId,family.carbonyl]]);
  }
  facets(graph,components,name,word,start);
  return {graph,components,parent};
}

/** Fully consumed substitutive grammar. These are graph construction rules
 * for polyhydroxy chains and oxane/oxolane parents, not compound-name aliases. */
function substitutive(name:string):Parsed|null {
  const head=/^\(([^()]+)\)-/.exec(name);if(!head)return null;
  const ds=descriptors(head[1]);if(!ds)return null;
  const rest=name.slice(head[0].length),offset=head[0].length;
  let graph:GeneratedMolecule,parent:number[],parentText:string,parentStart:number;
  let ringNumbering:[number,number][]|undefined;
  let decorationIds:number[],decorationNumbering:[number,number][];
  const chain=/^([1-6](?:,[1-6])*)-(tetra|penta)hydroxy(pent|hex)an(al|-2-one)$/.exec(rest);
  const ring=/^(.*)(oxane|oxolane)-([2-6](?:,[2-6])*)-(triol|tetrol)$/.exec(rest);
  const sideCenters:number[]=[];
  if(chain){
    const n=chain[3]==='pent'?5:6,carbonyl=chain[4]==='al'?1:2,ps=locants(chain[1]);
    if(!uniqueAscending(ps)||ps.length!==(chain[2]==='tetra'?4:5)||ps.join(',')!==Array.from({length:n},(_,i)=>i+1).filter(p=>p!==carbonyl).join(','))return null;
    graph=buildCarbohydrateGraph(n,carbonyl)!;parent=Array.from({length:n},(_,i)=>i+1);
    decorationIds=ps.map(p=>n+p);decorationNumbering=ps.map(p=>[p,p]);
    parentText=`${chain[3]}an${chain[4]}`;parentStart=name.length-parentText.length;
    for(const d of ds){if(!parent.includes(d.locant))return null;graph.atoms[d.locant-1].tetrahedralParity=d.configuration;}
  }else if(ring){
    const size=ring[2]==='oxane'?6:5,ps=locants(ring[3]);
    if(!uniqueAscending(ps)||ps.some(p=>p>size)||ps.length!==(ring[4]==='triol'?3:4))return null;
    graph={atoms:Array.from({length:size},(_,i)=>({id:i+1,element:i===0?'O':'C',x:0,y:0})),bonds:[]};
    for(let p=1;p<=size;p++)graph.bonds.push([p,p===size?1:p+1,1]);
    const atom=(element:'C'|'O',anchor:number)=>{const id=graph.atoms.length+1;graph.atoms.push({id,element,x:0,y:0});graph.bonds.push([anchor,id,1]);return id;};
    for(const p of ps)atom('O',p);
    const sideStart=graph.atoms.length;
    let attachmentPositions:number[];
    const hm=/^([2-6])-(?:\(hydroxymethyl\)|hydroxymethyl)$/.exec(ring[1]);
    const bis=/^([2-6]),([2-6])-bis\(hydroxymethyl\)$/.exec(ring[1]);
    const ethyl=/^([2-6])-\[\(1([RS])\)-1,2-dihydroxyethyl\]$/.exec(ring[1]);
    if(hm||bis){
      const positions=hm?[Number(hm[1])]:[Number(bis![1]),Number(bis![2])];
      if(!uniqueAscending(positions)||positions.some(p=>p>size))return null;
      for(const p of positions){const carbon=atom('C',p);atom('O',carbon);}
      attachmentPositions=positions;
    }else if(ethyl){
      const p=Number(ethyl[1]);if(p>size)return null;
      const a=atom('C',p);atom('O',a);const b=atom('C',a);atom('O',b);
      graph.atoms[a-1].tetrahedralParity=ethyl[2] as 'R'|'S';sideCenters.push(a);
      attachmentPositions=[p];
    }else return null;
    decorationIds=graph.atoms.slice(sideStart).map(a=>a.id);
    decorationNumbering=attachmentPositions.map(p=>[p,p]);
    for(const d of ds){if(d.locant<2||d.locant>size)return null;graph.atoms[d.locant-1].tetrahedralParity=d.configuration;}
    parent=Array.from({length:size},(_,i)=>i+1);parentText=ring[2];parentStart=offset+ring[1].length;
    ringNumbering=parent.map(id=>[id,id]);
  }else return null;
  const structure=recognizeCarbohydrate(graph);
  if(!structure?.complete||new Set([...ds.map(d=>d.locant),...sideCenters]).size!==structure.centers.length)return null;
  const components:NameComponent[]=[];
  add(graph,components,'parent','parent',name,parentStart,parentText,parent,
    ring?`${parentText} is the saturated ${parent.length}-membered heterocyclic parent. Its ring oxygen has heterocycle locant 1. These substitutive locants differ from carbohydrate-chain numbering.`
      :`${parentText} is the ${parent.length}-carbon open parent with carbonyl at C${structure.carbonylPosition}.`,ringNumbering??structure.numbering);
  add(graph,components,'sugar-cip','prefix',name,0,head[0].slice(0,-1),ds.map(d=>d.locant),
    `Every stated absolute R/S descriptor is reconstructed and compared with its real stereogenic atom. The ${ring?'heterocycle':'chain'} locants are ${ds.map(d=>`${d.locant}${d.configuration}`).join(', ')}. No omitted centre is assigned a configuration.`,ds.map(d=>[d.locant,d.locant]));
  // A literal prefix owns only the atoms it names. Ring-bound OH belongs to
  // the polyol suffix, and the open-chain carbonyl O is not a hydroxy prefix.
  const decoration=ring?ring[1]:chain![1]+'-'+chain![2]+'hydroxy';
  add(graph,components,'sugar-decoration','prefix',name,offset,decoration,
    decorationIds,
    (ring?'The exocyclic substituent is attached at the written heterocycle locant(s). Ring-bound OH groups are excluded from this prefix. '
      :`The ${chain![2]}hydroxy prefix specifies ${decorationIds.length} OH groups at the written chain locants; the carbonyl oxygen is excluded. `)
      +'Every substituent multiplicity is consumed completely. Side-chain locants belong to that substituent, separately from ring locants.'
      +(sideCenters.length?` The two-carbon dihydroxyethyl side chain bears two OH groups; its carbon 1 has the explicitly verified ${graph.atoms[sideCenters[0]-1].tetrahedralParity} configuration.`:''),
    decorationNumbering,undefined,graph.bonds.filter(([a,b])=>decorationIds.includes(a)||decorationIds.includes(b)).map(([a,b])=>[a,b]));
  if(ring)add(graph,components,'sugar-polyol','suffix',name,name.length-(ring[3].length+ring[4].length+1),`${ring[3]}-${ring[4]}`,
    structure.hydroxyls.filter(h=>parent.includes(h.carbonId)).flatMap(h=>[h.carbonId,h.oxygenId]),
    `${ring[4]} gives ${ring[4]==='triol'?3:4} ring-bound hydroxyls at the written heterocycle locants ${ring[3]}; the ring ether oxygen is not one of those hydroxyls.`,
    locants(ring[3]).map(p=>[p,p]));
  facets(graph,components,name,parentText,parentStart);
  return {graph,components,parent};
}

function facets(graph:GeneratedMolecule,components:NameComponent[],name:string,anchor:string,start:number) {
  const s=recognizeCarbohydrate(graph)!;
  const facet=(id:string,label:string,ids:number[],explanation:string,numbering:NameComponent['numbering']=[])=>
    add(graph,components,id,'parent',name,start,anchor,ids,explanation,numbering,label);
  facet('sugar-chain','Carbon skeleton · carbohydrate locants',s.carbonIds,
    `Carbohydrate numbering follows the complete unbranched carbon chain from the actual or potential carbonyl. ${s.carbonylPosition===1?'An aldose has terminal C1.':'A 2-ketose has two carbon neighbours at C2.'} These are carbohydrate locants even when the written name uses heterocycle locants.`,s.numbering);
  const oh=s.hydroxyls.flatMap(h=>[h.carbonId,h.oxygenId]);
  facet('sugar-hydroxyls','Hydroxyl groups',oh,
    `${s.hydroxyls.length} neutral terminal C–OH groups have one implicit H on each oxygen. Ring oxygen has two C–O bonds and zero H, so it is excluded.`,s.hydroxyls.map(h=>[h.carbonId,h.locant]));
  if(s.carbonyl)facet('sugar-carbonyl',s.carbonylPosition===1?'Aldehyde · C1':'Ketone · C2',[s.carbonyl.carbonId,s.carbonyl.oxygenId],
    `The open carbonyl C${s.carbonylPosition}=O is ${s.carbonylPosition===1?'terminal and carries one H':'internal with two carbon neighbours'}.`,[[s.carbonyl.carbonId,s.carbonylPosition]]);
  if(s.ringOxygenId!==undefined){
    facet('sugar-ring-oxygen','Ring oxygen',[s.ringOxygenId],`The single ring oxygen bridges carbohydrate C${s.carbonylPosition} and C${s.closurePosition}; it is an ether linkage within this ${s.form}.`);
    facet('sugar-hemiacetal',s.carbonylPosition===1?'Cyclic hemiacetal':'Cyclic hemiketal',[s.anomericAtomId!,s.ringOxygenId,s.anomericHydroxylId!],
      `Anomeric C${s.carbonylPosition} bears both ring oxygen and a free hydroxyl. It has ${s.carbonylPosition===1?'one carbon neighbour and one H: a hemiacetal':'two carbon neighbours and no H: a hemiketal'}. Replacing that OH with O–C would be an acetal/glycoside outside this analysis.`,[[s.anomericAtomId!,s.carbonylPosition]]);
    const outside=s.carbonIds.filter(id=>!s.ringAtomIds.includes(id));
    facet('sugar-exocyclic','Exocyclic carbon chain',outside,'These carbons belong to the numbered carbohydrate chain but lie outside the oxygen-containing ring.',s.numbering.filter(([id])=>outside.includes(id)));
  }
  facet('sugar-reference','Configurational reference',[s.configurationalAtomId],
    s.series?`At carbohydrate C${s.configurationalPosition}, the ordered ligand frame gives the ${s.series} series. This does not assert a universal equivalence between D/L and R/S.`:'The configurational reference lacks an explicit configuration; no D/L assignment is justified.',[[s.configurationalAtomId,s.configurationalPosition]]);
  if(s.family)facet('sugar-configuration','Verified carbohydrate configuration',s.centers.map(c=>c.atomId),
    `The non-anomeric configuration is ${s.series}-${s.family.name}. `+(s.form==='open'?'This is an open carbonyl form; alpha/beta does not apply.':s.anomer?`Both reference configurations prove the ${s.anomer} anomer by formal Fischer ${s.anomer==='alpha'?'cis':'trans'} relation.`:'No alpha/beta assignment is made: this retained ketose-anomer rule is outside the proved grammar.'),s.centers.map(c=>[c.atomId,c.locant]));
}

/** Dedicated stereo-aware gate. Older noncarbohydrate productions keep their
 * deliberate stereo exclusion. Full graph identity includes absolute R/S. */
export function reconcileCarbohydrateName(actual:GeneratedMolecule,name:string):ValidatedNameDerivation|null {
  if(name.length>200)return null;
  const parsed=retained(name)??substitutive(name);if(!parsed)return null;
  const {graph,components,parent}=parsed;
  if(components.some(c=>name.slice(c.start,c.end)!==c.text)||graph.atoms.some(a=>!components.some(c=>c.atomIds.includes(a.id))))return null;
  const regions=components.flatMap(c=>[c.atomIds,...c.numbering.map(([id])=>[id])]);
  const mapping=mapStructuralRegions(graph,actual,regions);if(!mapping)return null;
  const s=recognizeCarbohydrate(actual);if(!s?.complete)return null;
  return {status:'FULL',name,preferred:false,parentSystem:'carbohydrate',principalGroup:s.form==='open'?(s.carbonylPosition===1?'aldehyde':'ketone'):'alcohol',
    parentAtomIds:parent.map(id=>mapping.get(id)!),components:components.map(c=>({...c,atomIds:c.atomIds.map(id=>mapping.get(id)!),
      bondIds:c.bondIds.map(([a,b])=>[mapping.get(a)!,mapping.get(b)!]),numbering:c.numbering.map(([id,p])=>[mapping.get(id)!,p])}))};
}
