import { compareParentCandidates, type LegacyEnglishNameModel, type ParentCandidateCriteria } from "./legacy-english-nomenclature.ts";
import { attachLegacyFragment, legacyGraphsIdentical, legacyPrefixTerm, type LegacyFragment } from "./iupac1979-name-structure.ts";
import { iupacRootForCarbonCount } from "./iupac-prefixes.ts";
import { historicalPrefixKey } from "./legacy-name-numbering.ts";
import type { RingGraph } from "./fused-topology.ts";

type FunctionalGraph = Omit<RingGraph,"atoms"> & {atoms:readonly (RingGraph["atoms"][number]&{
  tetrahedralParity?:string;tetrahedralBondTo?:number;isotope?:number;
})[]};
const multipliers=["","","di","tri","tetra","penta","hexa","hepta","octa","nona","deca"];
const complexMultipliers=["","","bis","tris","tetrakis","pentakis","hexakis"];
const maxValence:Readonly<Record<string,number>>={C:4,O:2,N:3};
export const legacyAliphaticFunctionalRules:Readonly<Record<string,string>>={alcohol:"C-201.1",ketone:"C-312.1",
 aldehyde:"C-302.1/C-303.3",carboxylicAcid:"C-401.1",amide:"C-822.1",nitrile:"C-832.1",ester:"C-401.1/C-463.1"};
const sorted=(values:number[])=>values.sort((a,b)=>a-b);
const alkyl=(name:string)=>{const term=legacyPrefixTerm(name);
  return term&&!term.kind&&term.elements.every(e=>e==="C")&&term.bonds.every(b=>b[2]===1)?term:undefined;};
const fragmentGraph=(term:LegacyFragment)=>({atoms:term.elements.map((element,id)=>({id,element})),bonds:term.bonds});
const esterAlkoxy=(name:string|undefined):LegacyFragment|undefined=>{
 const term=name?alkyl(name):undefined;
 if(!term||!/^[a-z]+il$/.test(term.es))return;
 const degrees=term.elements.map((_,i)=>term.bonds.filter(([a,b])=>a===i||b===i).length);
 if(degrees[0]>1||degrees.some(d=>d>2))return;
 return {...term,kind:"ester",elements:["O",...term.elements],bonds:[[0,1,1],
  ...term.bonds.map(([a,b,o]):[number,number,number]=>[a+1,b+1,o])]};
};

/** Deliberately homofunctional and saturated. A new suffix is enabled only with
 * its graph reconstruction and independent parent/numbering proof. Carbonyl
 * and nitrile bonds belong to the function, never to the hydrocarbon locants. */
export function verifyLegacyAliphaticFunctionalModel(graph:FunctionalGraph,m:LegacyEnglishNameModel):boolean {
 try {
  const n=m.parent.carbonCount,kind=m.functionalGroups[0]?.kind;
  if(m.profile!=="iupac-1979-legacy-en"||m.unavailableReason||m.parent.kind!=="chain"||m.parent.fallbackName||m.parent.retained
   ||!Number.isInteger(n)||n<1||n>20||m.parent.atomIds.length!==n||new Set(m.parent.atomIds).size!==n
   ||m.doubleBondLocants.length||m.tripleBondLocants.length||m.stereochemicalPrefix||m.nitrogenSubstituents?.length
   // Multiplication is bounded to the mono/di/tri historical suffixes tested
   // here; higher counts and their vowel elision require a separate extension.
   ||!Object.hasOwn(legacyAliphaticFunctionalRules,kind)||!m.functionalGroups.length||m.functionalGroups.length>3
   ||["aldehyde","carboxylicAcid","amide","nitrile","ester"].includes(kind)&&m.functionalGroups.length>2
   ||m.functionalGroups.some(g=>g.kind!==kind||!g.carbonIncludedInParent
    ||(kind==="ester"?!esterAlkoxy(g.attachedAlkylName):Boolean(g.attachedAlkylName)))
   ||graph.atoms.length>120||graph.bonds.length!==graph.atoms.length-1
   ||graph.atoms.some(a=>!["C","O","N"].includes(a.element??"C")||a.charge
    ||a.tetrahedralParity!==undefined||a.tetrahedralBondTo!==undefined||a.isotope!==undefined)
   ||graph.bonds.some(b=>b[3]))return false;
  // The English model expresses multiple esters as one multiplied radical.
  // Mixed diesters need an extended EN model; never infer the missing name.
  if(kind==="ester"&&new Set(m.functionalGroups.map(g=>esterAlkoxy(g.attachedAlkylName)!.es)).size!==1)return false;
  const atoms=new Map(graph.atoms.map(a=>[a.id,a])),neighbors=new Map(graph.atoms.map(a=>[a.id,[] as {id:number;order:number}[]]));
  if(atoms.size!==graph.atoms.length)return false;
  for(const [a,b,order=1] of graph.bonds){
   if(a===b||!atoms.has(a)||!atoms.has(b)||![1,2,3].includes(order)||neighbors.get(a)!.some(x=>x.id===b))return false;
   neighbors.get(a)!.push({id:b,order});neighbors.get(b)!.push({id:a,order});
  }
  const carbon=(id:number)=>(atoms.get(id)?.element??"C")==="C";
  if(m.parent.atomIds.some(id=>!atoms.has(id)||!carbon(id))||graph.atoms.some(a=>
   neighbors.get(a.id)!.reduce((sum,b)=>sum+b.order,0)>(maxValence[a.element??"C"]??0)))return false;
  // Function anchors are discovered from the real graph, independently of the
  // model's kinds and locants. Every remaining atom must match reconstruction.
  const anchors:number[]=[];
  for(const a of graph.atoms.filter(a=>carbon(a.id))){
   const adjacent=neighbors.get(a.id)!,hetero=adjacent.filter(x=>!carbon(x.id));
   if(!hetero.length)continue;
   if(kind==="alcohol"){
    if(hetero.some(x=>atoms.get(x.id)!.element!=="O"||x.order!==1||neighbors.get(x.id)!.length!==1))return false;
    anchors.push(...hetero.map(()=>a.id));
   }else if(kind==="ketone"||kind==="aldehyde"){
    if(hetero.length!==1||atoms.get(hetero[0].id)!.element!=="O"||hetero[0].order!==2
     ||neighbors.get(hetero[0].id)!.length!==1)return false;
    const carbonCount=adjacent.filter(x=>carbon(x.id)).length;
    if(kind==="ketone"?carbonCount!==2:carbonCount>1)return false;
    anchors.push(a.id);
   }else if(kind==="carboxylicAcid"){
    if(hetero.length!==2||hetero.some(x=>atoms.get(x.id)!.element!=="O"||neighbors.get(x.id)!.length!==1)
     ||hetero.filter(x=>x.order===2).length!==1||hetero.filter(x=>x.order===1).length!==1
     ||adjacent.filter(x=>carbon(x.id)).length>1)return false;
    anchors.push(a.id);
   }else if(kind==="amide"){
    if(hetero.length!==2||hetero.some(x=>neighbors.get(x.id)!.length!==1)
     ||hetero.filter(x=>x.order===2&&atoms.get(x.id)!.element==="O").length!==1
     ||hetero.filter(x=>x.order===1&&atoms.get(x.id)!.element==="N").length!==1
     ||adjacent.filter(x=>carbon(x.id)).length>1)return false;
    anchors.push(a.id);
   }else if(kind==="nitrile"){
    if(hetero.length!==1||hetero[0].order!==3||atoms.get(hetero[0].id)!.element!=="N"
     ||neighbors.get(hetero[0].id)!.length!==1||adjacent.filter(x=>carbon(x.id)).length!==1)return false;
    anchors.push(a.id);
   }else if(kind==="ester"){
    const oxo=hetero.find(x=>x.order===2&&atoms.get(x.id)!.element==="O"&&neighbors.get(x.id)!.length===1);
    if(!oxo)continue; // O-bound alkyl carbons are checked by whole-graph identity.
    const oxy=hetero.find(x=>x!==oxo);
    if(hetero.length!==2||!oxy||oxy.order!==1||atoms.get(oxy.id)!.element!=="O"
     ||neighbors.get(oxy.id)!.length!==2||neighbors.get(oxy.id)!.some(x=>!carbon(x.id))
     ||adjacent.filter(x=>carbon(x.id)).length>1)return false;
    anchors.push(a.id);
   }
  }
  if(anchors.length!==m.functionalGroups.length)return false;
  const valid=(l:number)=>Number.isInteger(l)&&l>=1&&l<=n;
  if(!m.functionalGroups.every(g=>valid(g.locant))||!m.substituents.every(s=>valid(s.locant)))return false;
  const expected={atoms:Array.from({length:n},(_,id)=>({id,element:"C",charge:undefined as number|undefined})),
   bonds:Array.from({length:n-1},(_,i):[number,number,number]=>[i,i+1,1])};
  for(const group of m.functionalGroups){
   attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm(kind==="nitrile"?"amino":"hidroxi")!);
   if(kind!=="alcohol")expected.bonds.at(-1)![2]=2;
   if(kind==="nitrile")expected.bonds.at(-1)![2]=3;
   if(kind==="carboxylicAcid")attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm("hidroxi")!);
   if(kind==="amide")attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm("amino")!);
   if(kind==="ester")attachLegacyFragment(expected,group.locant-1,esterAlkoxy(group.attachedAlkylName)!);
  }
  for(const s of m.substituents){const term=alkyl(s.systematicName);
   if(!term||(/^\d/.test(term.es)&&!s.complex))return false;
   attachLegacyFragment(expected,s.locant-1,term);
  }
  if(!legacyGraphsIdentical(expected,graph,new Map(m.parent.atomIds.map((id,i)=>[i,id]))))return false;

  const component=(start:number,blocked:Set<number>)=>{
   const ids:number[]=[],pending=[start],seen=new Set(blocked);
   while(pending.length){const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);ids.push(id);
    pending.push(...neighbors.get(id)!.filter(x=>carbon(x.id)).map(x=>x.id));}return ids;};
  const radicalNames=(count:number)=>[`${iupacRootForCarbonCount(count)}il`,
   ...["1-metiletil","2-metilpropil","1-metilpropil","1,1-dimetiletil"].filter(name=>alkyl(name)!.elements.length===count)];
  // Alphabetize the represented spelling, including admitted iso/sec/tert
  // aliases; do not silently rename a radical before checking a tie.
  const spellings=new Map<string,string>();
  for(const s of m.substituents){const term=alkyl(s.systematicName)!;
   const canonical=radicalNames(term.elements.length).find(name=>{const candidate=alkyl(name);
    return candidate&&legacyGraphsIdentical(fragmentGraph(term),fragmentGraph(candidate),new Map([[0,0]]));});
   if(!canonical||spellings.has(canonical)&&spellings.get(canonical)!==term.es)return false;
   spellings.set(canonical,term.es);
  }
  const criteria=(path:number[]):ParentCandidateCriteria|undefined=>{
   const set=new Set(path),locants=anchors.filter(id=>set.has(id)).map(id=>path.indexOf(id)+1);
   const prefixes:{locant:number;name:string}[]=[];
   for(const [i,id] of path.entries())for(const {id:branch} of neighbors.get(id)!.filter(x=>carbon(x.id)&&!set.has(x.id))){
    const ids=component(branch,set),subgraph={atoms:ids.map(id=>atoms.get(id)!),bonds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b))};
    const name=radicalNames(ids.length).find(name=>{const term=alkyl(name);
     return term&&legacyGraphsIdentical(fragmentGraph(term),subgraph,new Map([[0,branch]]));});
    if(!name)return;
    prefixes.push({locant:i+1,name:spellings.get(name)??name});
   }
   return {principalGroupCount:locants.length,multipleBondCount:0,carbonCount:path.length,doubleBondCount:0,
    principalGroupLocants:sorted(locants),multipleBondLocants:[],doubleBondLocants:[],prefixCount:prefixes.length,
    prefixLocants:sorted(prefixes.map(s=>s.locant)),alphabeticalTieBreak:prefixes.sort((a,b)=>
     historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es")||a.locant-b.locant)
     .map(s=>`${historicalPrefixKey(s.name)}:${String(s.locant).padStart(3,"0")}`).join("|")};
  };
  const selected=criteria(m.parent.atomIds);if(!selected)return false;
  let validParent=true;
  const visit=(path:number[])=>{
   const count=anchors.filter(id=>path.includes(id)).length;
   if(count>selected.principalGroupCount||count===selected.principalGroupCount&&path.length>n){validParent=false;return;}
   if(count===selected.principalGroupCount&&path.length===n){const other=criteria(path);
    if(!other||compareParentCandidates(other,selected)<0){validParent=false;return;}}
   for(const {id:next} of neighbors.get(path.at(-1)!)!.filter(x=>carbon(x.id)))if(validParent&&!path.includes(next))visit([...path,next]);
  };
  for(const a of graph.atoms)if(carbon(a.id)&&validParent)visit([a.id]);
  return validParent;
 }catch{return false;}
}

/** Spanish morphemes are assembled from proven components, never from an EN
 * suffix replacement or the Current 2013 name. Native ES retains precedence. */
export function formatLegacyAliphaticFunctionalSpanish(m:LegacyEnglishNameModel):string|undefined {
 const root=iupacRootForCarbonCount(m.parent.carbonCount),locants=sorted(m.functionalGroups.map(g=>g.locant)),count=locants.length;
 const kind=m.functionalGroups[0]?.kind;
 if(!root||!Object.hasOwn(legacyAliphaticFunctionalRules,kind))return;
 const suffix=kind==="alcohol"?"ol":"ona";
 const omitLocant=kind==="alcohol"?m.parent.carbonCount<=2:m.parent.carbonCount===3;
 const parent=kind==="ester"?`${root}an${count===1?"oato":"odioato"}`
  :kind==="nitrile"?`${root}ano${count===1?"nitrilo":"dinitrilo"}`
  :kind==="amide"?`${root}an${count===1?"amida":"odiamida"}`
  :kind==="carboxylicAcid"?`${root}an${count===1?"oico":"odioico"}`
  :kind==="aldehyde"?`${root}an${count===1?"al":"odial"}`
  :count===1?`${omitLocant?"":`${locants[0]}-`}${root}an${suffix}`
  :`${locants.join(",")}-${root}ano${multipliers[count]}${suffix}`;
 const groups=new Map<string,{name:string;complex:boolean;locants:number[]}>();
 for(const s of m.substituents){const name=alkyl(s.systematicName)!.es,key=`${s.complex}:${name}`;
  const group=groups.get(key)??{name,complex:s.complex,locants:[]};group.locants.push(s.locant);groups.set(key,group);}
 const prefixes=[...groups.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
  .map(g=>{const multiplier=g.locants.length>1?(g.complex?complexMultipliers:multipliers)[g.locants.length]:"";
   if(multiplier===undefined)return;
   return `${sorted(g.locants).join(",")}-${multiplier}${g.complex?`(${g.name})`:g.name}`;});
 if(prefixes.some(p=>p===undefined))return;
 const prefix=prefixes.join("-"),name=`${prefix}${prefix&&/^\d/.test(parent)?"-":""}${parent}`;
 if(kind==="carboxylicAcid")return `ácido ${name}`;
 if(kind==="ester")return `${name} de ${count===2?"di":""}${esterAlkoxy(m.functionalGroups[0].attachedAlkylName)!.es}o`;
 return name;
}
