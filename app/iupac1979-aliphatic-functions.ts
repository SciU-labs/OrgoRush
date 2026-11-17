import { compareParentCandidates, resolveFunctionalHierarchy, type LegacyEnglishNameModel, type ParentCandidateCriteria } from "./legacy-english-nomenclature.ts";
import { attachLegacyFragment, legacyGraphsIdentical, legacyPrefixTerm, type LegacyFragment } from "./iupac1979-name-structure.ts";
import { iupacRootForCarbonCount } from "./iupac-prefixes.ts";
import { historicalPrefixKey } from "./legacy-name-numbering.ts";
import type { RingGraph } from "./fused-topology.ts";
import { getMainChainStereoDescriptors } from "./double-bond-stereochemistry.ts";
import { getMainChainTetrahedralDescriptors, getTetrahedralStereoCenters } from "./tetrahedral-stereochemistry.ts";

type FunctionalGraph = Omit<RingGraph,"atoms"> & {atoms:readonly (RingGraph["atoms"][number]&{
  tetrahedralParity?:string;tetrahedralBondTo?:number;isotope?:number;
})[]};
const multipliers=["","","di","tri","tetra","penta","hexa","hepta","octa","nona","deca"];
const complexMultipliers=["","","bis","tris","tetrakis","pentakis","hexakis"];
const maxValence:Readonly<Record<string,number>>={C:4,O:2,N:3,F:1,Cl:1,Br:1,I:1};
export const legacyAliphaticFunctionalRules:Readonly<Record<string,string>>={alcohol:"C-201.1",amine:"C-812.1/C-814.1",ketone:"C-312.1",
 aldehyde:"C-302.1/C-303.3",carboxylicAcid:"C-401.1",amide:"C-822.1",nitrile:"C-832.1",ester:"C-401.1/C-463.1"};
const sorted=(values:number[])=>values.sort((a,b)=>a-b);
const alkyl=(name:string)=>{const term=legacyPrefixTerm(name);
  return term&&!term.kind&&term.elements.every(e=>e==="C")&&term.bonds.every(b=>b[2]===1)?term:undefined;};
const supportedNSubstituent=(name:string)=>{
 const term=legacyPrefixTerm(name);if(alkyl(name))return term;
 return term?.kind==="alcohol"&&term.elements.length===7&&term.elements.slice(0,6).every(e=>e==="C")
  &&term.elements[6]==="O"&&term.bonds.length===7&&term.bonds.filter(([, ,order])=>order===2).length===3?term:undefined;
};
const fragmentGraph=(term:LegacyFragment)=>({atoms:term.elements.map((element,id)=>({id,element})),bonds:term.bonds});
const esterAlkoxy=(name:string|undefined):LegacyFragment|undefined=>{
 const term=name?alkyl(name):undefined;
 if(!term||!term.es.endsWith("il"))return;
 const degrees=term.elements.map((_,i)=>term.bonds.filter(([a,b])=>a===i||b===i).length);
 if(degrees[0]>1||degrees.some(d=>d>3))return;
 return {...term,kind:"ester",elements:["O",...term.elements],bonds:[[0,1,1],
  ...term.bonds.map(([a,b,o]):[number,number,number]=>[a+1,b+1,o])]};
};

/** Deliberately homofunctional and saturated. A new suffix is enabled only with
 * its graph reconstruction and independent parent/numbering proof. Carbonyl
 * and nitrile bonds belong to the function, never to the hydrocarbon locants. */
export function verifyLegacyAliphaticFunctionalModel(graph:FunctionalGraph,m:LegacyEnglishNameModel):boolean {
 try {
  const n=m.parent.carbonCount,kind=m.functionalGroups[0]?.kind;
  const hasHydroxyphenylNitrogenSubstituent=kind==="amide"&&(m.nitrogenSubstituents??[]).some(sub=>{
   const term=legacyPrefixTerm(sub.systematicName);
   return term?.kind==="alcohol"&&term.elements.length===7&&term.elements.slice(0,6).every(e=>e==="C")&&term.elements[6]==="O";
  });
  if(m.profile!=="iupac-1979-legacy-en"||m.unavailableReason||m.parent.kind!=="chain"||m.parent.fallbackName||m.parent.retained
   ||!Number.isInteger(n)||n<1||n>20||m.parent.atomIds.length!==n||new Set(m.parent.atomIds).size!==n
   ||m.doubleBondLocants.length||m.tripleBondLocants.length||m.stereochemicalPrefix
   ||Boolean(m.nitrogenSubstituents?.length&&kind!=="amide")
   // Multiplication is bounded to the mono/di/tri historical suffixes tested
   // here; higher counts and their vowel elision require a separate extension.
   ||!Object.hasOwn(legacyAliphaticFunctionalRules,kind)||!m.functionalGroups.length||m.functionalGroups.length>3
   ||["aldehyde","carboxylicAcid","amide","nitrile","ester"].includes(kind)&&m.functionalGroups.length>2
   ||m.functionalGroups.some(g=>g.kind!==kind||!g.carbonIncludedInParent
    ||(kind==="ester"?!esterAlkoxy(g.attachedAlkylName):Boolean(g.attachedAlkylName)))
   ||graph.atoms.length>120||graph.bonds.length!==(hasHydroxyphenylNitrogenSubstituent?graph.atoms.length:graph.atoms.length-1)
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
   if(kind==="amine"){
    const parentGroup=m.functionalGroups.find(group=>group.kind==="amine"&&group.locant>=1&&group.locant<=m.parent.atomIds.length);
    const expectedAnchor=parentGroup?m.parent.atomIds[parentGroup.locant-1]:undefined;
    if(a.id!==expectedAnchor)continue;
    if(hetero.length!==1||atoms.get(hetero[0]!.id)!.element!=="N"||hetero[0]!.order!==1
      ||neighbors.get(hetero[0]!.id)!.length<1||neighbors.get(hetero[0]!.id)!.length>3
      ||neighbors.get(hetero[0]!.id)!.some(x=>!carbon(x.id)||x.order!==1))return false;
    anchors.push(a.id);
   }else if(kind==="alcohol"){
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
    const aromaticHydroxySubstituent=(m.nitrogenSubstituents??[]).some(sub=>{
     const term=legacyPrefixTerm(sub.systematicName);
     return term?.kind==="alcohol"&&term.elements.length===7&&term.elements.slice(0,6).every(e=>e==="C")&&term.elements[6]==="O";
    });
    if(aromaticHydroxySubstituent&&hetero.length===1&&atoms.get(hetero[0].id)!.element==="O"&&hetero[0].order===1
      &&neighbors.get(hetero[0].id)!.length===1)continue;
    if(hetero.length===1&&atoms.get(hetero[0].id)!.element==="N"&&hetero[0].order===1
      &&(m.nitrogenSubstituents??[]).some(sub=>sub.nitrogenAtomId===hetero[0].id&&sub.atomIds.includes(a.id)))continue;
    const oxo=hetero.filter(x=>x.order===2&&atoms.get(x.id)!.element==="O"&&neighbors.get(x.id)!.length===1);
    const amideNitrogen=hetero.filter(x=>x.order===1&&atoms.get(x.id)!.element==="N");
    if(hetero.length!==2||oxo.length!==1||amideNitrogen.length!==1
     ||neighbors.get(amideNitrogen[0].id)!.length>3
     ||neighbors.get(amideNitrogen[0].id)!.some(x=>x.order!==1||!carbon(x.id))
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
  const forced=new Map(m.parent.atomIds.map((id,i)=>[i,id]));
  for(const group of m.functionalGroups){
   attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm(kind==="nitrile"?"amino":"hidroxi")!);
   if(kind!=="alcohol")expected.bonds.at(-1)![2]=2;
   if(kind==="nitrile")expected.bonds.at(-1)![2]=3;
   if(kind==="carboxylicAcid")attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm("hidroxi")!);
   if(kind==="amide"){
    const nitrogenId=expected.atoms.length;
    attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm("amino")!);
    const substitutions=m.nitrogenSubstituents??[];
    if(substitutions.length>2)return false;
    const used=new Set(m.parent.atomIds);
    for(const substitution of substitutions){
     const rawTerm=legacyPrefixTerm(substitution.systematicName),ids=substitution.atomIds;
     const aromaticHydroxy=rawTerm?.kind==="alcohol"&&rawTerm.elements.length===7
      &&rawTerm.elements.slice(0,6).every(e=>e==="C")&&rawTerm.elements[6]==="O"
      &&rawTerm.bonds.length===7&&rawTerm.bonds.filter(([, ,order])=>order===2).length===3;
     const term=alkyl(substitution.systematicName)??(aromaticHydroxy?rawTerm:undefined);
     if(!Number.isInteger(substitution.nitrogenAtomId)
      ||atoms.get(substitution.nitrogenAtomId)?.element!=="N"||!term||!ids||ids.length!==term.elements.length
      ||new Set(ids).size!==ids.length||ids.includes(substitution.nitrogenAtomId)
      ||ids.some((id,i)=>!atoms.has(id)||(atoms.get(id)!.element??"C")!==term!.elements[i]||used.has(id)))return false;
     const offset=expected.atoms.length;
     attachLegacyFragment(expected,nitrogenId,term);
     forced.set(nitrogenId,substitution.nitrogenAtomId);
     term.elements.forEach((_,i)=>forced.set(offset+i,ids[i]));
     ids.forEach(id=>used.add(id));
    }
   }
   if(kind==="ester")attachLegacyFragment(expected,group.locant-1,esterAlkoxy(group.attachedAlkylName)!);
  }
  for(const s of m.substituents){const term=alkyl(s.systematicName);
   if(!term||(/^\d/.test(term.es)&&!s.complex))return false;
   attachLegacyFragment(expected,s.locant-1,term);
  }
  if(!legacyGraphsIdentical(expected,graph,forced))return false;

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

/** Extended acyclic proof used when a Legacy name combines unsaturation,
 * subordinate functions, aromatic radicals, or explicit stereodescriptors.
 * The parent path and every named fragment are rebuilt before full graph
 * identity; CIP descriptors are recomputed from the active graph. */
export function verifyLegacyExtendedAliphaticFunctionalModel(graph:FunctionalGraph,m:LegacyEnglishNameModel):boolean {
 try {
  const n=m.parent.carbonCount,hierarchy=resolveFunctionalHierarchy(m.functionalGroups);
  if(m.profile!=="iupac-1979-legacy-en"||m.unavailableReason||m.parent.kind!=="chain"||m.parent.fallbackName||m.parent.retained
   ||!Number.isInteger(n)||n<1||n>20||m.parent.atomIds.length!==n||new Set(m.parent.atomIds).size!==n
   ||!m.functionalGroups.length||m.functionalGroups.length>4||!hierarchy.principalKind
   ||(m.nitrogenSubstituents?.length??0)>2||graph.atoms.length>120||graph.atoms.some(a=>a.isotope!==undefined)
   ||graph.bonds.some(b=>!([1,2,3].includes(b[2]??1))))return false;
  const doubles=m.doubleBondLocants,triples=m.tripleBondLocants;
  const validLocants=(values:number[])=>values.every((locant,i)=>Number.isInteger(locant)&&locant>=1&&locant<n&&(i===0||locant>values[i-1]));
  if(!validLocants(doubles)||!validLocants(triples)||doubles.some(locant=>triples.includes(locant)))return false;
  if(!m.functionalGroups.every(g=>Number.isInteger(g.locant)&&g.locant>=1&&g.locant<=n
    &&(g.carbonIncludedInParent||hierarchy.subordinateGroups.includes(g)&&g.kind==="nitrile"
      ||g.kind==="carboxylicAcid"&&hierarchy.principalKind==="carboxylicAcid"&&hierarchy.principalGroups.length>2))
    ||!m.substituents.every(s=>Number.isInteger(s.locant)&&s.locant>=1&&s.locant<=n))return false;
  const principal=hierarchy.principalGroups;
  if(!principal.length||principal.some(g=>!Object.hasOwn(legacyAliphaticFunctionalRules,g.kind)))return false;
  // Every non-principal characteristic group must be represented once as a
  // structurally recognized prefix at the same carbon locant.
  const consumed=new Set<number>();
  for(const group of hierarchy.subordinateGroups){
   const match=m.substituents.findIndex((s,i)=>!consumed.has(i)&&s.locant===group.locant&&legacyPrefixTerm(s.systematicName)?.kind===group.kind);
   if(match<0)return false;consumed.add(match);
  }
  for(const [i,s] of m.substituents.entries()){
   const term=legacyPrefixTerm(s.systematicName);if(!term)return false;
   if(term.kind&&term.kind!==hierarchy.principalKind&&!consumed.has(i))return false;
  }
  const expected={atoms:Array.from({length:n},(_,id)=>({id,element:"C"} as {id:number;element:string;charge?:number})),
   bonds:Array.from({length:n-1},(_,i):[number,number,number]=>[i,i+1,doubles.includes(i+1)?2:triples.includes(i+1)?3:1])};
  const attach=(anchor:number,element:string,order=1)=>{const id=expected.atoms.length;expected.atoms.push({id,element});expected.bonds.push([anchor,id,order]);return id;};
  const forced=new Map(m.parent.atomIds.map((id,i)=>[i,id]));
  const amideNitrogenIds:number[]=[],amineNitrogenIds:number[]=[];
  for(const group of principal){const anchor=group.locant-1;
   if(group.kind==="carboxylicAcid"){
    if(group.carbonIncludedInParent){attach(anchor,"O");attach(anchor,"O",2);}
    else {
     if(principal.length<3)return false;
     const carbonyl=attach(anchor,"C");attach(carbonyl,"O");attach(carbonyl,"O",2);
    }
   }
   else if(group.kind==="ester"){
    const alkoxy=esterAlkoxy(group.attachedAlkylName);if(!alkoxy)return false;
    attach(anchor,"O",2);attachLegacyFragment(expected,anchor,alkoxy);
   }else if(group.kind==="amide"){
    attach(anchor,"O",2);amideNitrogenIds.push(attach(anchor,"N"));
   }else if(group.kind==="nitrile")attach(anchor,"N",3);
   else if(group.kind==="aldehyde"||group.kind==="ketone")attach(anchor,"O",2);
   else if(group.kind==="alcohol")attach(anchor,"O");
   else if(group.kind==="amine")amineNitrogenIds.push(attach(anchor,"N"));
   else return false;
  }
  for(const s of m.substituents){const term=legacyPrefixTerm(s.systematicName);if(!term)return false;
   attachLegacyFragment(expected,s.locant-1,term);}
  const usedNitrogenFragmentAtoms=new Set<number>();
  for(const substitution of m.nitrogenSubstituents??[]){
   const term=legacyPrefixTerm(substitution.systematicName),ids=substitution.atomIds,nitrogen=substitution.nitrogenAtomId;
   const expectedNitrogen=amideNitrogenIds[0]??amineNitrogenIds[0];
   if(!term||!expectedNitrogen||!Number.isInteger(nitrogen)||graph.atoms.find(atom=>atom.id===nitrogen)?.element!=="N"
    ||!ids||ids.length!==term.elements.length||new Set(ids).size!==ids.length||ids.includes(nitrogen)
    ||ids.some(id=>usedNitrogenFragmentAtoms.has(id)||!graph.atoms.some(atom=>atom.id===id)))return false;
   const idSet=new Set(ids);
   if(ids.some(id=>graph.bonds.some(([a,b])=>(a===id&&!idSet.has(b)&&b!==nitrogen)||(b===id&&!idSet.has(a)&&a!==nitrogen))))return false;
   const fragmentElements=ids.map(id=>graph.atoms.find(atom=>atom.id===id)?.element??"C").sort().join(",");
   if(fragmentElements!==[...term.elements].sort().join(","))return false;
   attachLegacyFragment(expected,expectedNitrogen,term);forced.set(expectedNitrogen,nitrogen);
   ids.forEach(id=>usedNitrogenFragmentAtoms.add(id));
  }
  if(!legacyGraphsIdentical(expected,graph,forced))return false;
  const stereoGraph={...graph,atoms:graph.atoms.map(a=>({...a})),bonds:graph.bonds.map(b=>[...b])};
  const stereoSource=stereoGraph as unknown as Parameters<typeof getMainChainStereoDescriptors>[0];
  const stereo=[...getMainChainStereoDescriptors(stereoSource,m.parent.atomIds,true),...getMainChainTetrahedralDescriptors(stereoSource as Parameters<typeof getMainChainTetrahedralDescriptors>[0],m.parent.atomIds)]
   .sort((a,b)=>a.locant-b.locant||a.configuration.localeCompare(b.configuration));
  const expectedStereo=stereo.length?`(${stereo.map(d=>`${d.locant}${d.configuration}`).join(",")})-`:undefined;
  if((m.stereochemicalPrefix??undefined)!==expectedStereo)return false;
  const parentIds=new Set(m.parent.atomIds);
  if(getTetrahedralStereoCenters(stereoSource as Parameters<typeof getTetrahedralStereoCenters>[0]).some(center=>!parentIds.has(center.atomId)))return false;
  const descriptors=new Set(stereo.filter(d=>d.configuration==="E"||d.configuration==="Z").map(d=>d.locant));
  if(graph.bonds.some(([a,b,order=1,ez])=>ez&&(!parentIds.has(a)||!parentIds.has(b)||order!==2
    ||!descriptors.has(Math.min(m.parent.atomIds.indexOf(a),m.parent.atomIds.indexOf(b))+1))))return false;
  return true;
 }catch{return false;}
}

/** Historical Spanish forms assembled only from components admitted by the
 * extended graph proof above. */
export function formatLegacyExtendedAliphaticFunctionalSpanish(m:LegacyEnglishNameModel):string|undefined {
 const root=iupacRootForCarbonCount(m.parent.carbonCount),hierarchy=resolveFunctionalHierarchy(m.functionalGroups),kind=hierarchy.principalKind;
 if(!root||!kind||!hierarchy.principalGroups.length)return;
 const count=hierarchy.principalGroups.length,locants=hierarchy.principalGroups.map(g=>g.locant).sort((a,b)=>a-b);
 const multiplier=multipliers[count];if(multiplier===undefined)return;
 const d=m.doubleBondLocants,t=m.tripleBondLocants;if(d.length&&t.length)return;
 const unsaturatedStem=()=>{
  if(!d.length&&!t.length)return `${root}an`;
  const values=d.length?d:t,ending=d.length?"en":"in",multi=values.length===1?"":multipliers[values.length];
  if(multi===undefined)return;
  return `${values.length===1?`${values[0]}-`: `${values.join(",")}-${root}a`}${values.length===1?root:""}${multi}${ending}`;
 };
 const stem=unsaturatedStem();if(!stem)return;
 const parent=kind==="carboxylicAcid"&&count>2&&hierarchy.principalGroups.every(g=>!g.carbonIncludedInParent)
  ?`${root}ano-${locants.join(",")}-${multipliers[count]}carboxílico`
  :kind==="carboxylicAcid"?`${stem}${count===1?"oico":`o${multipliers[count]}oico`}`
  :kind==="ester"?`${stem}${count===1?"oato":`${multipliers[count]}oato`}`
  :kind==="amide"?`${stem}${count===1?"amida":`${multipliers[count]}amida`}`
  :kind==="nitrile"?`${stem}${count===1?"onitrilo":`${multipliers[count]}nitrilo`}`
  :kind==="aldehyde"?`${stem}${count===1?"al":`${multipliers[count]}al`}`
  :kind==="ketone"?`${m.parent.carbonCount===1&&count===1?"":`${sorted(locants).join(",")}-`}${stem}${count===1?"ona":`${multipliers[count]}ona`}`
  :kind==="alcohol"?`${sorted(locants).join(",")}-${stem}${count===1?"ol":`${multipliers[count]}ol`}`
  :kind==="amine"?count===1&&m.parent.carbonCount<=2&&!d.length&&!t.length?`${stem}amina`
   :`${sorted(locants).join(",")}-${stem}${count===1?"amina":`${multipliers[count]}amina`}`:undefined;
 if(!parent)return;
 const groups=new Map<string,{name:string;complex:boolean;locants:number[]}>();
 for(const s of m.substituents){const term=legacyPrefixTerm(s.systematicName);if(!term)return;
  const key=`${s.complex}:${term.es}`,g=groups.get(key)??{name:term.es,complex:s.complex,locants:[]};g.locants.push(s.locant);groups.set(key,g);}
 const prefixes=[...groups.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
  .map(g=>{const complex=g.complex&&g.name!=="fenil",multi=g.locants.length>1?(complex?complexMultipliers:multipliers)[g.locants.length]:"";
   if(multi===undefined)return;
   const component=complex?g.name.replace(/\[([^\[\]]+)\]/g,"($1)"):g.name;
   const opening=component.includes("(")?"[":"(",closing=opening==="["?"]":")";
   return `${sorted(g.locants).join(",")}-${multi}${complex?`${opening}${component}${closing}`:component}`;});
 for(const substitution of m.nitrogenSubstituents??[]){const term=legacyPrefixTerm(substitution.systematicName);if(!term)return;
  prefixes.push(`N-${substitution.complex?`(${term.es})`:term.es}`);}
 if(prefixes.some(p=>p===undefined))return;
 const completePrefixes=prefixes as string[];
 if(kind==="amine"&&(m.nitrogenSubstituents?.length??0)>0)
  completePrefixes.sort((a,b)=>historicalPrefixKey(a).localeCompare(historicalPrefixKey(b),"es"));
 let prefix=completePrefixes.join("-");
 if(kind==="ketone"&&m.parent.carbonCount===1&&m.functionalGroups.every(group=>group.locant===1)
  &&m.substituents.every(sub=>sub.locant===1))prefix=prefix.replace(/^1(?:,1)*-/i,"");
 const name=`${m.stereochemicalPrefix??""}${prefix}${prefix&&/^\d/.test(parent)?"-":""}${parent}`;
 if(kind==="carboxylicAcid")return `ácido ${name}`;
 if(kind==="ester"){
  const alkoxy=esterAlkoxy(hierarchy.principalGroups[0]?.attachedAlkylName);if(!alkoxy)return;
  return `${name} de ${alkoxy.es}o`;
 }
 return name;
}

/** C-211: bounded alkoxyalkane recognition for small unbranched parents
 * (up to two carbons). The full graph and senior component are pinned;
 * unsupported larger parent choices remain rejected. */
export function verifyLegacySimpleEtherModel(graph:FunctionalGraph,m:LegacyEnglishNameModel):boolean {
 try {
  const n=m.parent.carbonCount,g=m.functionalGroups[0],s=m.substituents[0],term=s?legacyPrefixTerm(s.systematicName):undefined;
  if(m.profile!=="iupac-1979-legacy-en"||m.unavailableReason||m.parent.kind!=="chain"||m.parent.fallbackName||m.parent.retained
   ||!Number.isInteger(n)||n<1||n>2||m.parent.atomIds.length!==n||new Set(m.parent.atomIds).size!==n
   ||m.functionalGroups.length!==1||g.kind!=="ether"||!g.carbonIncludedInParent||m.substituents.length!==1
   ||s.locant!==g.locant||s.locant<1||s.locant>n||!term||term.kind!=="ether"
   ||term.elements[0]!=="O"||term.elements.slice(1).some(e=>e!=="C")||n<term.elements.length-1||term.bonds.some(b=>b[2]!==1)
   ||m.doubleBondLocants.length||m.tripleBondLocants.length||m.nitrogenSubstituents?.length||m.stereochemicalPrefix
   ||graph.bonds.length!==graph.atoms.length-1||graph.atoms.length!==n+term.elements.length
   ||graph.atoms.some(a=>!["C","O"].includes(a.element??"C")||a.charge||a.tetrahedralParity!==undefined
    ||a.tetrahedralBondTo!==undefined||a.isotope!==undefined)||graph.bonds.some(b=>(b[2]??1)!==1||b[3]))return false;
  const expected={atoms:Array.from({length:n},(_,id)=>({id,element:"C"})),
   bonds:Array.from({length:n-1},(_,i):[number,number,number]=>[i,i+1,1])};
  attachLegacyFragment(expected,s.locant-1,term);
  return legacyGraphsIdentical(expected,graph,new Map(m.parent.atomIds.map((id,i)=>[i,id])));
 }catch{return false;}
}

export function formatLegacySimpleEtherSpanish(m:LegacyEnglishNameModel):string|undefined {
 const term=m.substituents.length===1?legacyPrefixTerm(m.substituents[0].systematicName):undefined;
 const root=iupacRootForCarbonCount(m.parent.carbonCount);
 if(!term||term.kind!=="ether"||!root||m.parent.carbonCount>2||m.functionalGroups.length!==1||m.functionalGroups[0].kind!=="ether")return;
 return `${term.es}${root}ano`;
}

/** Bounded H-1 prefix family: neutral alkanes bearing only halogen and/or
 * nitro prefixes. Acyclic parent and every substituent are reconstructed;
 * stereochemistry, unsaturation, mixed characteristic groups and branches
 * containing carbon are deliberately excluded. */
export function verifyLegacyAcyclicPrefixModel(graph:FunctionalGraph,m:LegacyEnglishNameModel):boolean {
 try {
  const n=m.parent.carbonCount;
  if(m.profile!=="iupac-1979-legacy-en"||m.unavailableReason||m.parent.kind!=="chain"||m.parent.fallbackName||m.parent.retained
   ||!Number.isInteger(n)||n<1||n>20||m.parent.atomIds.length!==n||new Set(m.parent.atomIds).size!==n
   ||m.doubleBondLocants.length||m.tripleBondLocants.length||m.nitrogenSubstituents?.length||m.stereochemicalPrefix
   ||!m.substituents.length||m.functionalGroups.length!==m.substituents.length
   ||m.functionalGroups.some((g,i)=>!(["halogen","nitro"].includes(g.kind)&&g.carbonIncludedInParent
    &&g.locant===m.substituents[i].locant&&legacyPrefixTerm(m.substituents[i].systematicName)?.kind===g.kind))
   ||m.substituents.some(s=>!Number.isInteger(s.locant)||s.locant<1||s.locant>n)
   ||graph.atoms.filter(a=>(a.element??"C")==="C").length!==n||graph.atoms.length>n+m.substituents.length*3
   ||graph.bonds.length!==graph.atoms.length-1||graph.atoms.some(a=>a.tetrahedralParity!==undefined||a.tetrahedralBondTo!==undefined
    ||a.isotope!==undefined)||graph.bonds.some(b=>b[3]))return false;
  const expected={atoms:Array.from({length:n},(_,id)=>({id,element:"C"})),
   bonds:Array.from({length:n-1},(_,i):[number,number,number]=>[i,i+1,1])};
  for(const s of m.substituents){const term=legacyPrefixTerm(s.systematicName);if(!term||!["halogen","nitro"].includes(term.kind??""))return false;
   attachLegacyFragment(expected,s.locant-1,term);}
  if(expected.atoms.length!==graph.atoms.length||!legacyGraphsIdentical(expected,graph,new Map(m.parent.atomIds.map((id,i)=>[i,id]))))return false;
  const forward=m.substituents.map(s=>s.locant).sort((a,b)=>a-b);
  const reverse=m.substituents.map(s=>n+1-s.locant).sort((a,b)=>a-b);
  const compare=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
  // Numbering must give the lowest complete locant set. If tied, use the
  // alphabetical first prefix at the first differing locant (C-15.11(d,e)).
  if(compare(reverse,forward)<0)return false;
  if(compare(reverse,forward)===0){
   const key=(reversed:boolean)=>m.substituents.map(s=>({loc:reversed?n+1-s.locant:s.locant,name:legacyPrefixTerm(s.systematicName)!.es}))
    .sort((a,b)=>a.loc-b.loc||historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
    .map(x=>`${String(x.loc).padStart(3,"0")}:${historicalPrefixKey(x.name)}`).join("|");
   if(key(true)<key(false))return false;
  }
  return true;
 }catch{return false;}
}

export function formatLegacyAcyclicPrefixSpanish(m:LegacyEnglishNameModel):string|undefined {
 const root=iupacRootForCarbonCount(m.parent.carbonCount);if(!root||!m.substituents.length)return;
 const groups=new Map<string,{name:string;locants:number[]}>();
 for(const s of m.substituents){const term=legacyPrefixTerm(s.systematicName);if(!term||!["halogen","nitro"].includes(term.kind??""))return;
  const g=groups.get(term.es)??{name:term.es,locants:[]};g.locants.push(s.locant);groups.set(term.es,g);}
 const multi=["","","di","tri","tetra","penta","hexa","hepta","octa","nona","deca"];
 const prefixes=[...groups.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
  .map(g=>{const locants=g.locants.sort((a,b)=>a-b);if(locants.length>=multi.length)return;
   const locant=m.parent.carbonCount===1?"":`${locants.join(",")}-`;
   return `${locant}${multi[locants.length]}${g.name}`;});
 if(prefixes.some(x=>x===undefined))return;
 return `${prefixes.join("-")}${root}ano`;
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
 const nitrogenGroups=new Map<string,{name:string;count:number;complex:boolean}>();
 for(const substitution of m.nitrogenSubstituents??[]){const term=supportedNSubstituent(substitution.systematicName);if(!term)return;
  const group=nitrogenGroups.get(term.es)??{name:term.es,count:0,complex:substitution.complex};group.count++;nitrogenGroups.set(term.es,group);}
 const nitrogenPrefix=[...nitrogenGroups.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
  .map(group=>`N${group.count>1?`,N`:""}-${group.count>1?multipliers[group.count]:""}${group.complex?`(${group.name})`:group.name}`);
 let prefix=[...nitrogenPrefix,...prefixes].join("-");
 if(kind==="ketone"&&m.parent.carbonCount===1&&m.functionalGroups.every(group=>group.locant===1)
  &&m.substituents.every(sub=>sub.locant===1))prefix=prefix.replace(/^1(?:,1)*-/i,"");
 const name=`${prefix}${prefix&&/^\d/.test(parent)?"-":""}${parent}`;
 if(kind==="carboxylicAcid")return `ácido ${name}`;
 if(kind==="ester")return `${name} de ${count===2?"di":""}${esterAlkoxy(m.functionalGroups[0].attachedAlkylName)!.es}o`;
 return name;
}
