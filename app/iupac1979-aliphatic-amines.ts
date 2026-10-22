import { compareParentCandidates, type LegacyEnglishNameModel, type ParentCandidateCriteria } from "./legacy-english-nomenclature.ts";
import { attachLegacyFragment, legacyGraphsIdentical, legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { iupacRootForCarbonCount } from "./iupac-prefixes.ts";
import { historicalPrefixKey } from "./legacy-name-numbering.ts";
import type { RingGraph } from "./fused-topology.ts";

type AmineGraph = Omit<RingGraph,"atoms"> & { atoms: readonly (RingGraph["atoms"][number] & {
  tetrahedralParity?:string; tetrahedralBondTo?:number; isotope?:number;
})[] };
const multipliers=["","","di","tri","tetra","penta","hexa","hepta","octa","nona","deca"];
const complexMultipliers=["","","bis","tris","tetrakis","pentakis","hexakis"];
const sorted=(values:number[])=>values.sort((a,b)=>a-b);
const saturatedAlkyl=(name:string)=>{
  const term=legacyPrefixTerm(name);
  return term && !term.kind && term.elements.every(e=>e==="C") && term.bonds.every(b=>b[2]===1) ? term : undefined;
};

/** C-11.42/C-812.1(b), C-813.1 and C-814.4. This grammar admits neutral,
 * saturated C/N trees only. Explicit stereo, other functions and unsaturation
 * need their own historical proof; no information is silently discarded. */
export function verifyLegacyAliphaticAmineModel(graph:AmineGraph, model:LegacyEnglishNameModel):boolean {
  try {
    const m=model,n=m.parent.carbonCount;
    if(m.profile!=="iupac-1979-legacy-en"||m.unavailableReason||m.parent.kind!=="chain"||m.parent.fallbackName||m.parent.retained
      ||!Number.isInteger(n)||n<1||n>20||m.parent.atomIds.length!==n||new Set(m.parent.atomIds).size!==n
      ||m.doubleBondLocants.length||m.tripleBondLocants.length||m.stereochemicalPrefix
      ||!m.functionalGroups.length||m.functionalGroups.length>10
      ||m.functionalGroups.some(g=>g.kind!=="amine"||!g.carbonIncludedInParent||g.attachedAlkylName)
      ||graph.atoms.length>120||graph.bonds.length!==graph.atoms.length-1
      ||graph.atoms.some(a=>!["C","N"].includes(a.element??"C")||a.charge
        ||a.tetrahedralParity!==undefined||a.tetrahedralBondTo!==undefined||a.isotope!==undefined)
      ||graph.bonds.some(b=>(b[2]??1)!==1||b[3]))return false;
    const atoms=new Map(graph.atoms.map(a=>[a.id,a])),neighbors=new Map(graph.atoms.map(a=>[a.id,[] as number[]]));
    for(const [a,b] of graph.bonds){if(a===b||!atoms.has(a)||!atoms.has(b)||neighbors.get(a)!.includes(b))return false;
      neighbors.get(a)!.push(b);neighbors.get(b)!.push(a);}
    const carbon=(id:number)=>(atoms.get(id)?.element??"C")==="C";
    if(graph.atoms.some(a=>neighbors.get(a.id)!.length>((a.element??"C")==="N"?3:4))
      ||m.parent.atomIds.some(id=>!atoms.has(id)||!carbon(id)))return false;
    const nitrogen=graph.atoms.filter(a=>a.element==="N");
    if(nitrogen.length!==m.functionalGroups.length||nitrogen.some(a=>!neighbors.get(a.id)!.length
      ||neighbors.get(a.id)!.some(id=>!carbon(id))))return false;
    // Multiple N atoms require distinguishable N locants (N,N', ...), which
    // the current English model cannot express. Primary polyamines are safe.
    if(nitrogen.length>1&&(m.nitrogenSubstituents?.length||nitrogen.some(a=>neighbors.get(a.id)!.length!==1)))return false;
    const valid=(l:number)=>Number.isInteger(l)&&l>=1&&l<=n;
    if(!m.functionalGroups.every(g=>valid(g.locant))||!m.substituents.every(s=>valid(s.locant)))return false;
    const expected={atoms:Array.from({length:n},(_,id)=>({id,element:"C",charge:undefined as number|undefined})),
      bonds:Array.from({length:n-1},(_,i):[number,number,number]=>[i,i+1,1])};
    const forced=new Map(m.parent.atomIds.map((id,i)=>[i,id]));
    let monoNitrogen=-1;
    for(const group of m.functionalGroups){const next=expected.atoms.length;
      attachLegacyFragment(expected,group.locant-1,legacyPrefixTerm("amino")!);
      if(nitrogen.length===1){monoNitrogen=next;forced.set(next,nitrogen[0].id);}}
    for(const s of m.substituents){const term=saturatedAlkyl(s.systematicName);
      if(!term||(/^\d/.test(term.es)&&!s.complex))return false;
      attachLegacyFragment(expected,s.locant-1,term);}
    const usedBranchIds=new Set<number>();
    for(const s of m.nitrogenSubstituents??[]){
      const term=saturatedAlkyl(s.systematicName);
      if(monoNitrogen<0||s.nitrogenAtomId!==nitrogen[0].id||!term||s.complex
        ||!s.atomIds.length||s.atomIds.length!==term.elements.length||new Set(s.atomIds).size!==s.atomIds.length
        ||s.atomIds.some(id=>!atoms.has(id)||!carbon(id)||m.parent.atomIds.includes(id)||usedBranchIds.has(id)))return false;
      const ids=new Set(s.atomIds),links=neighbors.get(s.nitrogenAtomId)!.filter(id=>ids.has(id));
      if(links.length!==1)return false;
      // N prefixes currently represent end-attached, unbranched alkyl only.
      const path:number[]=[];let cursor:number|undefined=links[0],previous=s.nitrogenAtomId;
      while(cursor!==undefined){if(path.includes(cursor))return false;path.push(cursor);
        const next:number[]=neighbors.get(cursor)!.filter(id=>id!==previous);
        if(next.some(id=>!ids.has(id))||next.length>1)return false;
        previous=cursor;cursor=next[0];}
      if(path.length!==ids.size)return false;
      const offset=expected.atoms.length;attachLegacyFragment(expected,monoNitrogen,term);
      path.forEach((id,i)=>{forced.set(offset+i,id);usedBranchIds.add(id);});
    }
    if(!legacyGraphsIdentical(expected,graph,forced))return false;

    // Independent parent/numbering check. Enumerate paths in the actual carbon
    // forest, without trusting the namer's chosen parent or its locant arrays.
    const component=(start:number,blocked:Set<number>)=>{
      const ids:number[]=[],pending=[start],seen=new Set(blocked);
      while(pending.length){const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);ids.push(id);
        pending.push(...neighbors.get(id)!.filter(carbon));}return ids;};
    // C-814.1 requires the radical-based di-/tri- form for fully symmetrical
    // secondary/tertiary amines. The current EN formatter only supplies the
    // N-substitution form, so do not claim a proven historical translation.
    if(nitrogen.length===1&&neighbors.get(nitrogen[0].id)!.length>1){
      const roots=neighbors.get(nitrogen[0].id)!;
      const radicals=roots.map(root=>{const ids=component(root,new Set([nitrogen[0].id]));
        return {atoms:ids.map(id=>atoms.get(id)!),bonds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b))};});
      if(radicals.slice(1).every((radical,i)=>legacyGraphsIdentical(radicals[0],radical,new Map([[roots[0],roots[i+1]]]))))return false;
    }
    const radicalNames=(count:number)=>[`${iupacRootForCarbonCount(count)}il`,
      ...["1-metiletil","2-metilpropil","1-metilpropil","1,1-dimetiletil"].filter(name=>legacyPrefixTerm(name)!.elements.length===count)];
    // C-15/A-2 apply the alphabet of the actually cited prefix. An admitted
    // isopropyl alias must not be silently judged as 1-methylethyl. Bind each
    // represented radical topology to one consistent spelling in this model.
    const spellings=new Map<string,string>();
    for(const s of m.substituents){const term=saturatedAlkyl(s.systematicName)!;
      const canonical=radicalNames(term.elements.length).find(name=>{const candidate=saturatedAlkyl(name);return candidate&&legacyGraphsIdentical(
        {atoms:term.elements.map((element,id)=>({id,element})),bonds:term.bonds},
        {atoms:candidate.elements.map((element,id)=>({id,element})),bonds:candidate.bonds},new Map([[0,0]]));});
      if(!canonical||spellings.has(canonical)&&spellings.get(canonical)!==term.es)return false;
      spellings.set(canonical,term.es);
    }
    const criteria=(path:number[]):ParentCandidateCriteria|undefined=>{
      const set=new Set(path),groups=nitrogen.flatMap(a=>{
        const anchors=neighbors.get(a.id)!.filter(id=>set.has(id));
        return anchors.length===1?[path.indexOf(anchors[0])+1]:[];});
      const prefixes:{locant:number;name:string}[]=[];
      for(const [i,id] of path.entries())for(const branch of neighbors.get(id)!.filter(next=>carbon(next)&&!set.has(next))){
        const ids=component(branch,set),subgraph={atoms:ids.map(id=>atoms.get(id)!),bonds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b))};
        const name=radicalNames(ids.length).find(name=>{const term=saturatedAlkyl(name);return term&&legacyGraphsIdentical(
          {atoms:term.elements.map((element,id)=>({id,element})),bonds:term.bonds},subgraph,new Map([[0,branch]]));});
        if(!name)return;
        prefixes.push({locant:i+1,name:spellings.get(name)??name});
      }
      return {principalGroupCount:groups.length,multipleBondCount:0,carbonCount:path.length,doubleBondCount:0,
        principalGroupLocants:sorted(groups),multipleBondLocants:[],doubleBondLocants:[],prefixCount:groups.length,
        prefixLocants:sorted(prefixes.map(s=>s.locant)),alphabeticalTieBreak:prefixes.sort((a,b)=>
          historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es")||a.locant-b.locant)
          .map(s=>`${historicalPrefixKey(s.name)}:${String(s.locant).padStart(3,"0")}`).join("|")};
    };
    const selected=criteria(m.parent.atomIds);if(!selected)return false;
    let validParent=true;
    const visit=(path:number[])=>{
      const groupCount=nitrogen.filter(a=>neighbors.get(a.id)!.some(id=>path.includes(id))).length;
      if(groupCount>selected.principalGroupCount||groupCount===selected.principalGroupCount&&path.length>n){validParent=false;return;}
      if(groupCount===selected.principalGroupCount&&path.length===n){const other=criteria(path);
        if(!other||compareParentCandidates(other,selected)<0){validParent=false;return;}}
      for(const next of neighbors.get(path.at(-1)!)!.filter(carbon))if(validParent&&!path.includes(next))visit([...path,next]);
    };
    for(const atom of graph.atoms)if(carbon(atom.id)&&validParent)visit([atom.id]);
    return validParent;
  }catch{return false;}
}

/** Renders proven semantic components, never a replacement on an EN name. */
export function formatLegacyAliphaticAmineSpanish(model:LegacyEnglishNameModel):string|undefined {
  const root=iupacRootForCarbonCount(model.parent.carbonCount),locants=sorted(model.functionalGroups.map(g=>g.locant));
  if(!root)return;
  const count=locants.length;
  const parent=count===1?`${model.parent.carbonCount<=2?"":`${locants[0]}-`}${root}anamina`
    :`${locants.join(",")}-${root}ano${multipliers[count]}amina`;
  const groups=new Map<string,{name:string;complex:boolean;locants:(number|"N")[]}>();
  for(const s of [...model.substituents,...(model.nitrogenSubstituents??[]).map(s=>({...s,locant:"N" as const}))]){
    const name=legacyPrefixTerm(s.systematicName)!.es,key=`${s.complex}:${name}`;
    const group=groups.get(key)??{name,complex:s.complex,locants:[]};group.locants.push(s.locant);groups.set(key,group);
  }
  const prefixes=[...groups.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
    .map(g=>{const multiplier=g.locants.length>1?(g.complex?complexMultipliers:multipliers)[g.locants.length]:"";
      if(multiplier===undefined)return undefined;
      const positions=g.locants.sort((a,b)=>a==="N"?b==="N"?0:-1:b==="N"?1:a-b).join(",");
      return `${positions}-${multiplier}${g.complex?`(${g.name})`:g.name}`;});
  if(prefixes.some(p=>p===undefined))return;
  const prefix=prefixes.join("-");return `${prefix}${prefix&&/^\d/.test(parent)?"-":""}${parent}`;
}
