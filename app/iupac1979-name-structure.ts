import { Molecule as OCLMolecule } from "openchemlib";
import { recognizeRingTopology, type RingGraph } from "./fused-topology.ts";
import { iupacRootForCarbonCount, englishIupacRoot } from "./iupac-prefixes.ts";

export type LegacyFragment = {
  es: string; en: string; kind?: string;
  elements: string[]; bonds: [number, number, number][]; charges?: Record<number, number>;
  stereochemistry?: Array<{atomIndex:number;configuration:"R"|"S"}>;
};
const fragment = (es: string, en: string, elements: string[], bonds: [number,number,number][] = [],
  kind?: string, charges?: Record<number,number>,stereochemistry?:LegacyFragment["stereochemistry"]): LegacyFragment => ({ es, en, elements, bonds, kind, charges, stereochemistry });
const terms = [
  fragment("trifluorometil", "trifluoromethyl", ["C","F","F","F"], [[0,1,1],[0,2,1],[0,3,1]]),
  fragment("acetoxi", "acetoxy", ["O","C","O","C"], [[0,1,1],[1,2,2],[1,3,1]]),
  fragment("fluoro", "fluoro", ["F"], [], "halogen"),
  fragment("cloro", "chloro", ["Cl"], [], "halogen"),
  fragment("bromo", "bromo", ["Br"], [], "halogen"),
  fragment("yodo", "iodo", ["I"], [], "halogen"),
  fragment("hidroxi", "hydroxy", ["O"], [], "alcohol"),
  fragment("amino", "amino", ["N"], [], "amine"),
  fragment("nitro", "nitro", ["N","O","O"], [[0,1,2],[0,2,1]], "nitro", {0:1,2:-1}),
  fragment("ciano", "cyano", ["C","N"], [[0,1,3]], "nitrile"),
  fragment("formil", "formyl", ["C","O"], [[0,1,2]], "aldehyde"),
  fragment("carboxi", "carboxy", ["C","O","O"], [[0,1,2],[0,2,1]], "carboxylicAcid"),
  fragment("carbamoil", "carbamoyl", ["C","O","N"], [[0,1,2],[0,2,1]], "amide"),
  fragment("fenil", "phenyl", Array(6).fill("C"), [[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1]]),
];

/** Finite chemical component grammar, shared by graph validation and rendering.
 * This deliberately has no 'replace -ene' or whole-name translation rule. */
export function legacyPrefixTerm(name: string): LegacyFragment | undefined {
  const exact = terms.find(t => t.es === name || t.en === name);
  if (exact) return exact;
  // A phenoxy substituent is the same numbered aryl fragment attached through
  // oxygen. Keeping that oxygen explicit lets the structural proof distinguish
  // phenyl from phenoxy while reusing the substituted-phenyl grammar.
  const composedPhenoxy=name.match(/^(.+)(fenoxi|phenoxy)$/i);
  if(composedPhenoxy){
    const phenyl=legacyPrefixTerm(`${composedPhenoxy[1]}${composedPhenoxy[2]!.toLowerCase()==="fenoxi"?"fenil":"phenyl"}`);
    if(phenyl&&!phenyl.kind&&phenyl.elements.filter(element=>element==="C").length>=6
      &&phenyl.elements.every(element=>["C","F","Cl","Br","I"].includes(element))){
      const es=phenyl.es.replace(/fenil$/,"fenoxi"),en=phenyl.en.replace(/phenyl$/,"phenoxy");
      return fragment(es,en,["O",...phenyl.elements],[[0,1,1],...phenyl.bonds.map(([a,b,o]):[number,number,number]=>[a+1,b+1,o])]);
    }
  }
  // Composable substituted phenyl radicals. Components are separated only at
  // the top level, so nested parentheses remain intact and are parsed by the
  // same fragment grammar as standalone radicals.
  const phenyl=name.match(/^(.+)(fenil|phenyl)$/i);
  if(phenyl&&!/^\d+-(?:hidroxi|hydroxy)(?:fenil|phenyl)$/i.test(name)){
    const prefix=phenyl[1]!,parts:string[]=[];
    let depth=0,start=0;
    for(let i=0;i<prefix.length;i++){const c=prefix[i];if(c==="("||c==="[")depth++;else if(c===")"||c==="]")depth--;else if(c==="-"&&depth===0&&/^\d/.test(prefix.slice(i+1))){parts.push(prefix.slice(start,i));start=i+1;}}
    parts.push(prefix.slice(start));
    const elements=[...Array(6).fill("C")],bonds:[number,number,number][]=[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1]];
    const rendered=new Map<string,{es:string;en:string;complex:boolean;locants:number[]}>();
    for(const part of parts){
      const match=part.match(/^(\d+(?:,\d+)*?)\-(.+)$/);if(!match)return;
      const locants=match[1]!.split(",").map(Number),body=match[2]!;
      if(locants.some((locant,i)=>locant<2||locant>6||i>0&&locant<=locants[i-1]))return;
      const nested=body.match(/^\((.+)\)$/)??body.match(/^\[(.+)\]$/),multiplicative=body.match(/^(di|tri|tetra)(.+)$/);
      const componentName=nested?.[1]??multiplicative?.[2]??body;
      const term=legacyPrefixTerm(componentName);if(!term||term.kind&&term.kind!=="halogen")return;
      const expectedCount=multiplicative?.[1]==="di"?2:multiplicative?.[1]==="tri"?3:multiplicative?.[1]==="tetra"?4:1;
      if(locants.length!==expectedCount)return;
      const entry=rendered.get(term.es)??{es:term.es,en:term.en,complex:Boolean(nested),locants:[]};
      if(entry.complex!==Boolean(nested))return;
      for(const locant of locants){const offset=elements.length;elements.push(...term.elements);
        bonds.push([locant-1,offset,1],...term.bonds.map(([a,b,o]):[number,number,number]=>[a+offset,b+offset,o]));entry.locants.push(locant);}
      rendered.set(term.es,entry);
    }
    const esPrefix=[...rendered.values()].map(entry=>`${entry.locants.sort((a,b)=>a-b).join(",")}-${entry.complex?`[${entry.es}]`:entry.locants.length===1?entry.es:`${["","","di","tri","tetra"][entry.locants.length]}${entry.es}`}`).join("-");
    const enPrefix=[...rendered.values()].map(entry=>`${entry.locants.sort((a,b)=>a-b).join(",")}-${entry.complex?`[${entry.en}]`:entry.locants.length===1?entry.en:`${["","","di","tri","tetra"][entry.locants.length]}${entry.en}`}`).join("-");
    return fragment(`${esPrefix}fenil`,`${enPrefix}phenyl`,elements,bonds);
  }
  const substitutedAmino=name.match(/^(.+)amino$/i);
  if(substitutedAmino){
    const dialkyl=substitutedAmino[1]!.match(/^(di|tri)(.+)$/);
    if(dialkyl){
      const alkyl=legacyPrefixTerm(dialkyl[2]!);
      const count=dialkyl[1]==="di"?2:3;
      if(alkyl&&!alkyl.kind&&alkyl.elements.length>0&&alkyl.elements.every(element=>element==="C")
        &&alkyl.bonds.every(([, ,order])=>order===1)){
        const elements=["N"],bonds:[number,number,number][]=[];
        for(let i=0;i<count;i++){const offset=elements.length;elements.push(...alkyl.elements);bonds.push([0,offset,1],...alkyl.bonds.map(([a,b,o]):[number,number,number]=>[a+offset,b+offset,o]));}
        return fragment(`${dialkyl[1]}${alkyl.es}amino`,`${dialkyl[1]}${alkyl.en}amino`,elements,bonds,"amine");
      }
    }
    const alkyl=legacyPrefixTerm(substitutedAmino[1]!);
    if(alkyl&&!alkyl.kind&&alkyl.elements.length>0&&alkyl.elements.every(element=>element==="C")
      &&alkyl.bonds.every(([, ,order])=>order===1)){
      return fragment(`${alkyl.es}amino`,`${alkyl.en}amino`,["N",...alkyl.elements],[[0,1,1],...alkyl.bonds.map(([a,b,o]):[number,number,number]=>[a+1,b+1,o])],"amine");
    }
  }
  // Halo-substituted phenoxy radicals are assembled around the ether oxygen
  // and a numbered phenyl ring. Locant 1 is the point of attachment to the
  // parent; only the explicitly named halogens are added to the graph.
  const phenoxy=name.match(/^(?:(\d+(?:,\d+)*-)?)((?:di|tri)?)(cloro|chloro)?(fenoxi|phenoxy)$/i);
  if(phenoxy){
    const locants=(phenoxy[1]?.slice(0,-1).split(",").map(Number)??[]),count=phenoxy[2]==="di"?2:phenoxy[2]==="tri"?3:1;
    const halogen=phenoxy[3],word=phenoxy[4];
    if((halogen&&locants.length!==count)||(!halogen&&locants.length)||locants.some((n,i)=>n<2||n>6||i>0&&n<=locants[i-1]))return;
    const elements=["O",...Array(6).fill("C"),...locants.map(()=>"Cl")];
    const bonds:[number,number,number][]=[[0,1,1],...[0,1,2,3,4,5].map((i):[number,number,number]=>[i+1,(i+1)%6+1,i%2===0?2:1]),
      ...locants.map((locant,i):[number,number,number]=>[locant,7+i,1])];
    const esHalogen=halogen?`${locants.join(",")}-${count===1?"":count===2?"di":"tri"}cloro`:"";
    const enHalogen=halogen?`${locants.join(",")}-${count===1?"":count===2?"di":"tri"}chloro`:"";
    return fragment(`${esHalogen}fenoxi`,`${enHalogen}phenoxy`,elements,bonds);
  }
  // Functionalized alkyl radicals with two distinct locanted groups and
  // optional, explicitly specified R/S centers. The carbon chain is numbered
  // from its free valence; nested amino fragments reuse the alkylamine rule.
  const stereoRadical=name.match(/^\((\d+[RS](?:,\d+[RS])*)\)-(.+)$/i);
  const radicalText=stereoRadical?.[2]??name,stereoDescriptors=stereoRadical?.[1].split(",").map(value=>({
    atomIndex:Number(value.slice(0,-1))-1,configuration:value.at(-1)!.toUpperCase() as "R"|"S"}));
  for(let count=2;count<=20;count++){
    const root=iupacRootForCarbonCount(count),enRoot=englishIupacRoot(root??"");if(!root)continue;
    const suffix=radicalText.endsWith(`${root}il`)?`${root}il`:radicalText.endsWith(`${enRoot}yl`)?`${enRoot}yl`:"";
    if(!suffix)continue;
    const prefix=radicalText.slice(0,-suffix.length),parts:string[]=[];let depth=0,start=0;
    for(let i=0;i<prefix.length;i++){const c=prefix[i];if(c==="("||c==="[")depth++;else if(c===")"||c==="]")depth--;else if(c==="-"&&depth===0&&/^\d/.test(prefix.slice(i+1))){parts.push(prefix.slice(start,i));start=i+1;}}
    parts.push(prefix.slice(start));
    if(parts.length<2)continue;
    const elements=Array(count).fill("C"),bonds:[number,number,number][]=[];
    for(let i=0;i<count-1;i++)bonds.push([i,i+1,1]);
    const functionalParts:{locant:number;es:string;en:string;term:LegacyFragment}[]=[];
    let valid=true;
    for(const part of parts){const match=part.match(/^(\d+)-(.+)$/);if(!match){valid=false;break;}
      const locant=Number(match[1]),nested=match[2]!.match(/^\((.+)\)$/)??match[2]!.match(/^\[(.+)\]$/);
      const component=nested?.[1]??match[2]!,term=legacyPrefixTerm(component);
      if(locant<1||locant>count||!term||!(["alcohol","amine"].includes(term.kind??"") )){valid=false;break;}
      functionalParts.push({locant,es:nested?`(${term.es})`:term.es,en:nested?`(${term.en})`:term.en,term});
    }
    if(!valid||!functionalParts.length)continue;
    for(const part of functionalParts){const offset=elements.length;elements.push(...part.term.elements);
      bonds.push([part.locant-1,offset,1],...part.term.bonds.map(([a,b,o]):[number,number,number]=>[a+offset,b+offset,o]));}
    const esPrefix=[...functionalParts].sort((a,b)=>a.term.es.localeCompare(b.term.es,"es")||a.locant-b.locant).map(part=>`${part.locant}-${part.es}`).join("-");
    const enPrefix=[...functionalParts].sort((a,b)=>a.term.en.localeCompare(b.term.en,"en")||a.locant-b.locant).map(part=>`${part.locant}-${part.en}`).join("-");
    if(stereoDescriptors?.some(item=>item.atomIndex<0||item.atomIndex>=count))continue;
    const stereoEs=stereoDescriptors?.length?`(${stereoDescriptors.map(item=>`${item.atomIndex+1}${item.configuration}`).join(",")})-`:"";
    return fragment(`${stereoEs}${esPrefix}${root}il`,`${stereoEs}${enPrefix}${enRoot}yl`,elements,bonds,undefined,undefined,stereoDescriptors);
  }
  // Functionalized, linear alkyl radicals are composed from the same verified
  // alkane roots used by the parent grammar. The free valence is C1; the
  // functional locant is parsed independently and reconstructed in the graph.
  for (let count = 1; count <= 20; count++) {
    const root = iupacRootForCarbonCount(count);
    if (!root) continue;
    const enRoot = englishIupacRoot(root);
    for (const [kind, esPrefix, enPrefix, element] of [
      ["amine", "amino", "amino", "N"],
      ["alcohol", "hidroxi", "hydroxy", "O"],
    ] as const) {
      for (const [suffix, language] of [[`${root}il`, "es"], [`${enRoot}yl`, "en"]] as const) {
          if (!name.endsWith(suffix)) continue;
          const prefix = name.slice(0, -suffix.length);
          const match = prefix.match(language === "es"
            ? /^(\d+)-(amino|hidroxi)$/
            : /^(\d+)-(amino|hydroxy)$/);
          if (!match) continue;
          const locant = Number(match[1]);
          const expectedPrefix = language === "es" ? esPrefix : enPrefix;
          if (match[2] !== expectedPrefix || locant < 1 || locant > count) continue;
          const elements = [...Array(count).fill("C"), element];
          const bonds: [number, number, number][] = Array.from({ length: count - 1 }, (_, i) => [i, i + 1, 1]);
          bonds.push([locant - 1, count, 1]);
          return fragment(`${locant}-${esPrefix}${root}il`, `${locant}-${enPrefix}${enRoot}yl`, elements, bonds, kind);
      }
    }
  }
  // A phenyl radical may carry a graph-verified hydroxy substituent. Locant 1
  // is the free valence to the parent and cannot also carry hydroxy.
  const substitutedPhenyl=name.match(/^(\d+)-(hidroxi|hydroxy)(fenil|phenyl)$/i);
  if(substitutedPhenyl){
    const locant=Number(substitutedPhenyl[1]);
    if(locant>=2&&locant<=6){
      const elements=[...Array(6).fill("C"),"O"];
      const bonds:[number,number,number][]=[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1],[locant-1,6,1]];
      return fragment(`${locant}-hidroxifenil`,`${locant}-hydroxyphenyl`,elements,bonds,"alcohol");
    }
  }
  for (let count = 1; count <= 20; count++) {
    const root = iupacRootForCarbonCount(count);
    if (!root) continue;
    const enRoot = englishIupacRoot(root);
    const linear = Array.from({length: count-1}, (_,i): [number,number,number] => [i,i+1,1]);
    if (name === `${root}il` || name === `${enRoot}yl`) return fragment(`${root}il`, `${enRoot}yl`, Array(count).fill("C"), linear);
    if (name === `${root}oxi` || name === `${enRoot}oxy`) return fragment(`${root}oxi`, `${enRoot}oxy`,
      ["O", ...Array(count).fill("C")], [[0,1,1], ...linear.map(([a,b,o]): [number,number,number] => [a+1,b+1,o])], "ether");
    if (count >= 2) {
      for (let bond = 1; bond < count; bond++) for (let anchor = 1; anchor <= count; anchor++) {
        const es = `${root}-${bond}-en-${anchor}-il`, en = `${enRoot}-${bond}-en-${anchor}-yl`;
        const vinyl = count === 2 && bond === 1 && anchor === 1 && ["vinil","vinyl","etenil","ethenyl"].includes(name);
        const historicalEs=`${bond}-${root}enil`, historicalEn=`${bond}-${enRoot}enyl`;
        if (name !== es && name !== en && !vinyl && !(anchor===1&&[historicalEs,historicalEn].includes(name))) continue;
        // A-3.5 numbers the free valence as 1. Do not substitute the
        // later '-en-1-yl' convention for a historical radical name.
        if(anchor!==1)return undefined;
        const order = [anchor-1, ...Array.from({length:count},(_,i)=>i).filter(i=>i!==anchor-1)];
        return fragment(vinyl ? "etenil" : historicalEs, vinyl ? "ethenyl" : historicalEn, Array(count).fill("C"),
          linear.map(([a,b]): [number,number,number] => [order.indexOf(a), order.indexOf(b), a===bond-1 ? 2 : 1]));
      }
    }
  }
  // Compositional methyl-substituted alkyl radicals, numbered from the free
  // valence. This covers radicals such as 3-methylbutyl without a molecule
  // specific alias; the same fragment is used for rendering and graph proof.
  for(let count=2;count<=20;count++){
    const root=iupacRootForCarbonCount(count);if(!root)continue;
    const enRoot=englishIupacRoot(root);
    for(const suffix of [`${root}il`,`${enRoot}yl`]){
      if(!name.endsWith(suffix))continue;
      const prefix=name.slice(0,-suffix.length),match=/^(\d+(?:,\d+)*-)?(di|tri|tetra)?(metil|methyl)$/.exec(prefix);
      if(!match)continue;
      const locants=(match[1]?.slice(0,-1).split(",").map(Number)??[]),multi=match[2]??"";
      const branchCount=multi==="di"?2:multi==="tri"?3:multi==="tetra"?4:1;
      if(locants.length!==branchCount||locants.some((locant,i)=>!Number.isInteger(locant)||locant<1||locant>count||i>0&&locant<locants[i-1]))continue;
      if(locants.some(locant=>locants.filter(candidate=>candidate===locant).length
        +Number(locant>1)+Number(locant<count)>4))continue;
      const elements=Array(count+branchCount).fill("C"),bonds:[number,number,number][]=[];
      for(let i=0;i<count-1;i++)bonds.push([i,i+1,1]);
      locants.forEach((locant,i)=>bonds.push([locant-1,count+i,1]));
      const branchPrefix=`${locants.join(",")}-`,esMulti=branchCount===1?"":branchCount===2?"di":branchCount===3?"tri":"tetra";
      return fragment(`${branchPrefix}${esMulti}metil${root}il`,`${branchPrefix}${multi}methyl${enRoot}yl`,elements,bonds);
    }
  }
  // Bounded, explicit branched radical trees; internal multipliers remain in
  // alphabetization keys. Their first vertex is the point of attachment.
  const branched: [string,string,string[],[number,number,number][]][] = [
    ["1-metiletil","1-methylethyl",["isopropil","isopropyl"],[[0,1,1],[0,2,1]]],
    ["2-metilpropil","2-methylpropyl",["isobutil","isobutyl"],[[0,1,1],[1,2,1],[1,3,1]]],
    ["1-metilpropil","1-methylpropyl",["sec-butil","sec-butyl"],[[0,1,1],[0,2,1],[2,3,1]]],
    ["1,1-dimetiletil","1,1-dimethylethyl",["tert-butil","tert-butyl"],[[0,1,1],[0,2,1],[0,3,1]]],
  ];
  for (const [es,en,aliases,bonds] of branched) if ([es,en,...aliases].includes(name)) {
    const alias=aliases.indexOf(name);
    return fragment(alias<0?es:aliases[0],alias<0?en:aliases[1],Array(bonds.length+1).fill("C"),bonds);
  }
  return undefined;
}
export const legacyFunctionalFragment = (kind: string) => terms.find(t => t.kind === kind && kind !== "halogen");

/** C-463.1: ester anion + the explicitly represented O-bound radical. */
export function legacyBenzoateFragment(alkylName:string|undefined):LegacyFragment|undefined {
  const alkyl=alkylName?legacyPrefixTerm(alkylName):undefined;
  if(!alkyl||alkyl.kind||!alkyl.es.endsWith("il")||alkyl.elements.some(e=>e!=="C")||alkyl.bonds.some(([, ,o])=>o!==1)
    ||alkyl.bonds.length!==alkyl.elements.length-1)return;
  const degrees=alkyl.elements.map((_,i)=>alkyl.bonds.filter(([a,b])=>a===i||b===i).length);
  if(degrees[0]>1||degrees.some(d=>d>3))return;
  return {es:`benzoato de ${alkyl.es}o`,en:`${alkyl.en} benzoate`,kind:"ester",
    elements:["C","O","O",...alkyl.elements],bonds:[[0,1,2],[0,2,1],[2,3,1],
      ...alkyl.bonds.map(([a,b,o]):[number,number,number]=>[a+3,b+3,o])]};
}

type Normal = { ids: number[]; labels: string[]; edges: number[][] };
const atomicNumber: Record<string,number> = { C:6,N:7,O:8,S:16,F:9,Cl:17,Br:35,I:53 };
function normalize(graph: RingGraph): Normal | undefined {
  const topology = recognizeRingTopology(graph);
  if (topology.kind === "invalid" || topology.reason === "disconnected" || graph.atoms.length > 120) return;
  const molecule = new OCLMolecule(0,0), ids = graph.atoms.map(a=>a.id), index = new Map(ids.map((id,i)=>[id,i]));
  for (const atom of graph.atoms) {
    if (!atomicNumber[atom.element ?? "C"]) return;
    const i = molecule.addAtom(atomicNumber[atom.element ?? "C"]);
    molecule.setAtomCharge(i,atom.charge ?? 0);
  }
  for (const [a,b,o=1] of graph.bonds) molecule.setBondOrder(molecule.addBond(index.get(a)!,index.get(b)!),o);
  molecule.ensureHelperArrays(OCLMolecule.cHelperRings);
  const edges = ids.map(()=>ids.map(()=>0));
  graph.bonds.forEach(([a,b,o=1],i)=> { edges[index.get(a)!][index.get(b)!]=edges[index.get(b)!][index.get(a)!]=molecule.isAromaticBond(i)?4:o; });
  return {ids,edges,labels: graph.atoms.map((a,i)=>`${a.element ?? "C"}:${a.charge ?? 0}:${molecule.getImplicitHydrogens(i)}:${edges[i].filter(Boolean).sort().join(",")}`)};
}

/** Full constitutional identity with optional atom correspondences. A forced
 * parent correspondence prevents a reflected name from highlighting the wrong
 * positions. Bounded search fails closed; it never accepts a partial match. */
export function legacyGraphsIdentical(expected: RingGraph, actual: RingGraph, forced = new Map<number,number>()) {
  try {
    if (expected.atoms.length !== actual.atoms.length || expected.bonds.length !== actual.bonds.length) return false;
    const a=normalize(expected), b=normalize(actual);
    if (!a || !b) return false;
    const options=a.ids.map((id,i)=>b.ids.flatMap((other,j)=>a.labels[i]===b.labels[j] && (!forced.has(id)||forced.get(id)===other)?[j]:[]));
    const order=a.ids.map((_,i)=>i).sort((i,j)=>options[i].length-options[j].length);
    const chosen=Array(a.ids.length).fill(-1), used=new Set<number>(); let visits=0;
    function visit(depth:number):boolean {
      if (++visits>20000) return false;
      if (depth===order.length) return true;
      const i=order[depth];
      for (const j of options[i]) {
        if (used.has(j)||order.slice(0,depth).some(k=>a!.edges[i][k]!==b!.edges[j][chosen[k]])) continue;
        chosen[i]=j;used.add(j); if (visit(depth+1)) return true; used.delete(j);chosen[i]=-1;
      }
      return false;
    }
    return visit(0);
  } catch { return false; }
}

export function attachLegacyFragment(graph: {atoms: RingGraph["atoms"][number][];bonds:[number,number,number][]}, anchor:number, term:LegacyFragment) {
  const offset=graph.atoms.length;
  term.elements.forEach((element,i)=>graph.atoms.push({id:offset+i,element,charge:term.charges?.[i]}));
  graph.bonds.push([anchor,offset,1],...term.bonds.map(([a,b,o]):[number,number,number]=>[a+offset,b+offset,o]));
}

/** Return graph atom ids in the exact atom order used by a parsed fragment.
 * The attachment atom is fixed at fragment atom 0; remaining atoms are mapped
 * by element, degree, and bond order so downstream verifiers can prove the
 * right connectivity rather than trusting an arbitrary traversal order. */
export function legacyFragmentAtomOrder(term:LegacyFragment,graph:{atoms:readonly {id:number;element?:string}[];bonds:readonly [number,number,number?][]},anchor:number):number[]|undefined {
 try {
  const ids=graph.atoms.map(atom=>atom.id),byId=new Map(graph.atoms.map(atom=>[atom.id,atom]));
  const edges=new Map<string,number>();
  const key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
  for(const [a,b,order=1] of graph.bonds){if(!byId.has(a)||!byId.has(b)||edges.has(key(a,b)))return;edges.set(key(a,b),order);}
  const degree=(id:number)=>graph.bonds.filter(([a,b])=>a===id||b===id).length;
  const termDegree=term.elements.map((_,i)=>term.bonds.filter(([a,b])=>a===i||b===i).length);
  const options=term.elements.map((element,i)=>ids.filter(id=>byId.get(id)?.element===element&&degree(id)===termDegree[i]));
  if(!options[0]?.includes(anchor))return;
  options[0]=[anchor];
  const order=term.elements.map((_,i)=>i).sort((a,b)=>options[a]!.length-options[b]!.length);
  const assigned=Array<number>(term.elements.length).fill(-1),used=new Set<number>();let visits=0;
  const visit=(depth:number):boolean=>{
   if(++visits>20000)return false;if(depth===order.length)return true;
   const i=order[depth]!;
   for(const id of options[i]!){if(used.has(id))continue;
    const compatible=term.bonds.every(([a,b,bondOrder=1])=>{
     if(a!==i&&b!==i)return true;const other=a===i?b:a,otherId=assigned[other]!;
     return otherId<0||edges.get(key(id,otherId))===bondOrder;
    });
    if(!compatible)continue;assigned[i]=id;used.add(id);if(visit(depth+1))return true;used.delete(id);assigned[i]=-1;
   }
   return false;
  };
  return visit(0)?assigned:undefined;
 }catch{return;}
}
