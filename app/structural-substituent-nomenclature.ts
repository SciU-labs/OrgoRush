import type { GeneratedMolecule } from "./name-to-molecule.ts";

export type AromaticConnection = "phenyl" | "phenoxy" | "benzyl" | "phenylamino";
export type LocalAromaticSubstituent = {
  name: string;
  nameEs: string;
  position: number;
  atomIds: number[];
  bondIds: [number, number][];
  explanation: string;
  explanationEs: string;
  rule: string;
  derivation?: CarbonSubstituentDerivation;
  nestedSelections?: LocalSubstituentSelection[];
};
export type CarbonSubstituentBranch = {
  parentAtomId: number;
  locant: number;
  attachmentBondIds: [number, number][];
  derivation: CarbonSubstituentDerivation;
};
export type CarbonSubstituentDerivation = {
  name: string;
  nameEs: string;
  mode: "alkyl-type" | "alkanyl-type";
  rootAtomId: number;
  rootLocant: number;
  atomIds: number[];
  bondIds: [number, number][];
  chainAtomIds: number[];
  chainBonds: [number, number][];
  numbering: [number, number][];
  branches: CarbonSubstituentBranch[];
  rule: string;
  explanation: string;
  explanationEs: string;
};
export type LocalSubstituentSelection = {
  id: string;
  label: string;
  labelEs: string;
  atomIds: number[];
  bondIds: [number, number][];
  locants: [number, number][];
  explanation: string;
  explanationEs: string;
};
export type LocalAromaticNomenclature = {
  name: string;
  connection: AromaticConnection;
  rule: string;
  explanation: string;
  explanationEs: string;
  numbering: [number, number][];
  attachmentAtomId: number;
  attachmentBondIds: [number, number][];
  linkerAtomId?: number;
  parentAttachmentLocant?: number;
  parentRule?: string;
  substituents: LocalAromaticSubstituent[];
  nestedSelections: LocalSubstituentSelection[];
  nameEs: string;
};

const roots = ["", "methyl", "ethyl", "propyl", "butyl", "pentyl", "hexyl", "heptyl", "octyl", "nonyl", "decyl", "undecyl", "dodecyl", "tridecyl", "tetradecyl", "pentadecyl", "hexadecyl", "heptadecyl", "octadecyl", "nonadecyl", "icosyl"];
const rootsEs = ["", "metil", "etil", "propil", "butil", "pentil", "hexil", "heptil", "octil", "nonil", "decil", "undecil", "dodecil", "tridecil", "tetradecil", "pentadecil", "hexadecil", "heptadecil", "octadecil", "nonadecil", "icosil"];
const atomKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const sorted = <T>(items: T[], compare: (a: T, b: T) => number) => [...items].sort(compare);

type Branch = { name: string; nameEs: string; atoms: number[]; bonds: [number, number][]; rule: string;
  complex?: boolean;
  derivation?: CarbonSubstituentDerivation };

function enclosingMarks(name: string): [string,string] {
  if (name.includes("{")) return ["(",")"];
  if (name.includes("[")) return ["{","}"];
  if (name.includes("(")) return ["[","]"];
  return ["(",")"];
}
function enclose(name: string) {
  const [open,close]=enclosingMarks(name);
  return `${open}${name}${close}`;
}
function multiplicativePrefix(count: number, complex: boolean) {
  const simple:Record<number,string>={2:"di",3:"tri",4:"tetra",5:"penta"};
  const compound:Record<number,string>={2:"bis",3:"tris",4:"tetrakis",5:"pentakis"};
  return (complex?compound:simple)[count]??"";
}

function compareLocants(a: readonly number[], b: readonly number[]) {
  for (let index=0;index<Math.max(a.length,b.length);index+=1) {
    const difference=(a[index]??0)-(b[index]??0); if(difference)return difference;
  }
  return 0;
}
function compareStrings(a: readonly string[],b: readonly string[]) {
  for(let index=0;index<Math.max(a.length,b.length);index+=1){const difference=(a[index]??"").localeCompare(b[index]??"");if(difference)return difference;}
  return 0;
}

const alkaneStems = ["", "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec", "undec", "dodec", "tridec", "tetradec", "pentadec", "hexadec", "heptadec", "octadec", "nonadec", "icos"];
const alkaneStemsEs = ["", "met", "et", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec", "undec", "dodec", "tridec", "tetradec", "pentadec", "hexadec", "heptadec", "octadec", "nonadec", "icos"];

/** A bounded tree-only derivation. The parent attachment is the sole external
 * edge and must be at `root`; chain numbering and nested branches are kept as
 * atom identities for the UI rather than reconstructed from generated text. */
function deriveCarbonSubstituent(graph: GeneratedMolecule, root: number, excluded: ReadonlySet<number>, depth = 0): CarbonSubstituentDerivation | null {
  const allowed = new Set(graph.atoms.filter(atom => (atom.element ?? "C") === "C" && !(atom.charge ?? 0)
    && !excluded.has(atom.id)).map(atom => atom.id));
  if (!allowed.has(root) || depth > 4) return null;
  const adjacency = new Map([...allowed].map(id => [id, [] as number[]]));
  for (const [a,b,order=1] of graph.bonds) if (order === 1 && allowed.has(a) && allowed.has(b)) {
    adjacency.get(a)!.push(b); adjacency.get(b)!.push(a);
  }
  const region = new Set<number>(), queue = [root];
  while (queue.length) {
    const id = queue.pop()!; if (region.has(id)) continue;
    region.add(id); for (const next of adjacency.get(id) ?? []) if (!region.has(next)) queue.push(next);
  }
  if (region.size > 24 || depth > 4) return null;
  const edges = graph.bonds.filter(([a,b]) => region.has(a) && region.has(b));
  if (edges.length !== region.size - 1 || edges.some(([, , order=1]) => order !== 1)) return null;
  const external = graph.bonds.filter(([a,b]) => region.has(a) !== region.has(b));
  if (external.length !== 1 || !external.some(([a,b,order=1]) => (a === root || b === root) && order === 1)) return null;
  if (graph.bonds.some(([a,b,order=1]) => order !== 1 && (region.has(a) || region.has(b)))) return null;

  const pathBetween = (start:number, end:number) => {
    const previous = new Map<number,number|null>([[start,null]]), pending=[start];
    while (pending.length) { const current=pending.shift()!; if(current===end)break;
      for(const next of adjacency.get(current)??[])if(region.has(next)&&!previous.has(next)){previous.set(next,current);pending.push(next);}}
    if(!previous.has(end))return null;
    const path:number[]=[]; let current:number|null=end;
    while(current!==null){path.push(current);current=previous.get(current)??null;}
    return path.reverse();
  };
  const leafIds=[...region].filter(id=>(adjacency.get(id)??[]).filter(next=>region.has(next)).length<=1);
  const pathCandidates:{path:number[];mode:"alkyl-type"|"alkanyl-type"}[]=[];
  for(const end of leafIds){const path=pathBetween(root,end);if(path)pathCandidates.push({path,mode:"alkyl-type"});}
  for(let i=0;i<leafIds.length;i+=1)for(let j=i+1;j<leafIds.length;j+=1){
    const path=pathBetween(leafIds[i],leafIds[j]);
    if(path&&path.includes(root)&&path.indexOf(root)>0&&path.indexOf(root)<path.length-1){
      pathCandidates.push({path,mode:"alkanyl-type"});
      pathCandidates.push({path:[...path].reverse(),mode:"alkanyl-type"});
    }
  }
  const candidates=pathCandidates.filter(item=>item.path.length<=alkaneStems.length-1);
  if(!candidates.length)return null;
  const evaluated=candidates.map(candidate=>{
    const chainSet=new Set(candidate.path), numbering=new Map(candidate.path.map((id,index)=>[id,index+1]));
    const branches:CarbonSubstituentBranch[]=[]; let valid=true;
    for(const parentAtomId of candidate.path)for(const branchRoot of adjacency.get(parentAtomId)??[]){
      if(!region.has(branchRoot)||chainSet.has(branchRoot))continue;
      const derivation=deriveCarbonSubstituent(graph,branchRoot,new Set([...excluded,...chainSet]),depth+1);
      if(!derivation){valid=false;break;}
      const attachment=graph.bonds.find(([a,b])=>a===parentAtomId&&b===branchRoot||b===parentAtomId&&a===branchRoot);
      if(!attachment){valid=false;break;}
      branches.push({parentAtomId,locant:numbering.get(parentAtomId)!,attachmentBondIds:[[attachment[0],attachment[1]]],derivation});
    }
    if(!valid)return null;
    branches.sort((a,b)=>a.locant-b.locant||a.derivation.name.localeCompare(b.derivation.name));
    const rootLocant=numbering.get(root)!;
    const alphabetic=branches.map(branch=>branch.derivation.name).sort((a,b)=>a.localeCompare(b));
    return { ...candidate, branches, rootLocant, locants:branches.map(branch=>branch.locant), alphabetic };
  }).filter((candidate):candidate is NonNullable<typeof candidate>=>candidate!==null);
  if(!evaluated.length)return null;
  evaluated.sort((a,b)=>b.path.length-a.path.length||a.rootLocant-b.rootLocant
    ||b.branches.length-a.branches.length||compareLocants(a.locants,b.locants)||compareStrings(a.alphabetic,b.alphabetic));
  const selected=evaluated[0], stem=alkaneStems[selected.path.length]!, stemEs=alkaneStemsEs[selected.path.length]!;
  const describeBranches=(language:"en"|"es")=>{
    const groups=new Map<string,typeof selected.branches>();
    for(const branch of selected.branches){const name=language==="en"?branch.derivation.name:branch.derivation.nameEs;
      groups.set(name,[...(groups.get(name)??[]),branch]);}
    return [...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,items])=>{
      const locants=items.map(item=>item.locant).sort((a,b)=>a-b);
      const complex=items[0].derivation.branches.length>0;
      const locanted=/(?:^|-)[1-9][0-9]*(?:-|$)/.test(name);
      const multiplier=multiplicativePrefix(items.length,complex);
      const body=complex||items.length>1&&locanted?`${multiplier}${enclose(name)}`:`${multiplier}${name}`;
      return `${locants.length>1?`${locants.join(",")}-`:`${locants[0]}-`}${body}`;
    });
  };
  const prefix=describeBranches("en"),prefixEs=describeBranches("es");
  const base=selected.mode==="alkyl-type"?roots[selected.path.length]!: `${stem}an-${selected.rootLocant}-yl`;
  const baseEs=selected.mode==="alkyl-type"?rootsEs[selected.path.length]!: `${stemEs}an-${selected.rootLocant}-il`;
  const name=`${prefix.length?`${prefix.join("-")}`:""}${base}`;
  const nameEs=`${prefixEs.length?`${prefixEs.join("-")}`:""}${baseEs}`;
  const branchesText=selected.branches.length?selected.branches.map(branch=>{
    const nested=branch.derivation.explanation;
    return languageText(branch.locant,branch.derivation.name,nested,"en");
  }).join(" "):"No subsidiary carbon branches occur on this chain.";
  const branchesTextEs=selected.branches.length?selected.branches.map(branch=>
    languageText(branch.locant,branch.derivation.nameEs,branch.derivation.explanationEs,"es")).join(" ")
    :"Esta cadena no tiene ramificaciones carbonadas subsidiarias.";
  const rule=`P-29.2 (${selected.mode==="alkyl-type"?"1":"2"}); ${selected.mode==="alkyl-type"?"P-29.3.2.1":"P-29.3.2.2"}; P-29.4.1; P-29.5.1; P-46.1; P-14.3; P-14.5; P-16.5.1.1`;
  const explanation=selected.mode==="alkyl-type"
    ? `The free valence is at a terminal carbon, so the alkyl-type method (1) applies: the attachment carbon is C1 and its locant is omitted (P-29.2(1), P-29.3.2.1). The ${selected.path.length}-carbon principal chain and any subsidiary branches give ${name}. ${selected.branches.length?branchesText:"It has no subsidiary carbon branches."} These locants belong to this substituent, not to the molecule's higher structure.`
    : `The longest eligible principal chain contains ${selected.path.length} carbons, selected under P-46.1. Its attachment point is internal at C${selected.rootLocant}, so the alkanyl-type method (2) retains that free-valence locant in ${stem}an-${selected.rootLocant}-yl (P-29.2(2), P-29.3.2.2). ${selected.branches.length?branchesText:"No subsidiary carbon branches occur on this chain."} Together these parts give ${name}; all locants belong to this substituent, not to the higher parent.`;
  const explanationEs=selected.mode==="alkyl-type"
    ? `La valencia libre está en un carbono terminal, así que se aplica el método de tipo alquilo (1): el carbono de unión es C1 y se omite su localizador (P-29.2(1), P-29.3.2.1). La cadena principal de ${selected.path.length} carbono${selected.path.length===1?"":"s"} y sus ramificaciones subsidiarias forman ${nameEs}. ${selected.branches.length?branchesTextEs:"No presenta ramificaciones carbonadas subsidiarias."} Estos localizadores pertenecen a este sustituyente, no a la estructura superior.`
    : `La cadena principal elegible más larga contiene ${selected.path.length} carbonos y se selecciona según P-46.1. El punto de unión es interno, en C${selected.rootLocant}; el método de tipo alquilo con valencia interna (2) conserva ese localizador en ${stemEs}an-${selected.rootLocant}-il (P-29.2(2), P-29.3.2.2). ${selected.branches.length?branchesTextEs:"Esta cadena no tiene ramificaciones carbonadas subsidiarias."} Estas partes forman ${nameEs}; todos los localizadores pertenecen a este sustituyente, no al padre superior.`;
  const atomIds=[...region].sort((a,b)=>a-b);
  const bondIds=[...edges.map(([a,b])=>[a,b] as [number,number]),[external[0][0],external[0][1]] as [number,number]];
  return {name,nameEs,mode:selected.mode,rootAtomId:root,rootLocant:selected.rootLocant,atomIds,bondIds,
    chainAtomIds:selected.path,chainBonds:edges.filter(([a,b])=>selected.path.includes(a)&&selected.path.includes(b)).map(([a,b])=>[a,b]),
    numbering:selected.path.map((id,index)=>[id,index+1]),branches:selected.branches,rule,explanation,explanationEs};
}

function languageText(locant:number,name:string,explanation:string,language:"en"|"es") {
  return language==="en"?`At C${locant}, the branch is ${name}. ${explanation}`:`En C${locant}, la ramificación es ${name}. ${explanation}`;
}

function nestedCarbonSelections(derivation: CarbonSubstituentDerivation, prefix = "", depth = 0): LocalSubstituentSelection[] {
  if (depth > 4) return [];
  const path = prefix ? `${prefix}/` : "";
  const chainLabel = derivation.mode === "alkyl-type" ? "Principal carbon chain" : "Principal chain and attachment locant";
  const chainLabelEs = derivation.mode === "alkyl-type" ? "Cadena carbonada principal" : "Cadena principal y localizador de unión";
  const selections: LocalSubstituentSelection[] = [{
    id: `${path}chain:${derivation.chainAtomIds.join(",")}`,
    label: `${chainLabel} · ${derivation.name}`, labelEs: `${chainLabelEs} · ${derivation.nameEs}`,
    atomIds: derivation.chainAtomIds, bondIds: derivation.chainBonds, locants: derivation.numbering,
    explanation: derivation.mode === "alkyl-type"
      ? `This terminally attached chain uses method (1); its attachment carbon is C1 by convention. ${derivation.rule}.`
      : `The free valence is internal at C${derivation.rootLocant}, expressed explicitly by method (2). ${derivation.rule}.`,
    explanationEs: derivation.mode === "alkyl-type"
      ? `Esta cadena se une por un extremo y usa el método (1); por convención, el carbono de unión es C1. ${derivation.rule}.`
      : `La valencia libre es interna, en C${derivation.rootLocant}; el método (2) la expresa explícitamente. ${derivation.rule}.`,
  }];
  const attachmentBond = derivation.bondIds.find(([a,b]) => derivation.atomIds.includes(a) !== derivation.atomIds.includes(b));
  selections.push({
    id: `${path}attachment:${derivation.rootAtomId}:${derivation.rootLocant}`,
    label: `Point of attachment · C${derivation.rootLocant}`, labelEs: `Punto de unión · C${derivation.rootLocant}`,
    atomIds: [derivation.rootAtomId],
    bondIds: attachmentBond ? [attachmentBond] : [],
    locants: [[derivation.rootAtomId, derivation.rootLocant]],
    explanation: derivation.mode === "alkanyl-type"
      ? `The root atom has an internal free valence at C${derivation.rootLocant}; method (2) retains this locant.`
      : "The point of attachment is terminal; method (1) conventionally assigns it C1.",
    explanationEs: derivation.mode === "alkanyl-type"
      ? `El átomo raíz tiene una valencia libre interna en C${derivation.rootLocant}; el método (2) conserva este localizador.`
      : "El punto de unión es terminal; el método (1) le asigna convencionalmente el localizador C1.",
  });
  for (const branch of derivation.branches) {
    const child = branch.derivation;
    selections.push({
      id: `${path}branch:${branch.locant}:${child.rootAtomId}`,
      label: `Branch at C${branch.locant} · ${child.name}`,
      labelEs: `Rama en C${branch.locant} · ${child.nameEs}`,
      atomIds: child.atomIds, bondIds: child.bondIds, locants: child.numbering,
      explanation: `This complete subsidiary branch is attached to principal-chain C${branch.locant}. ${child.explanation}`,
      explanationEs: `Esta rama subsidiaria completa se une a C${branch.locant} de la cadena principal. ${child.explanationEs}`,
    });
    selections.push({
      id: `${path}branch-locant:${branch.locant}:${branch.parentAtomId}`,
      label: `Branch locant C${branch.locant}`, labelEs: `Localizador de la rama C${branch.locant}`,
      atomIds: [branch.parentAtomId], bondIds: [], locants: [[branch.parentAtomId, branch.locant]],
      explanation: `The branch is attached at locant C${branch.locant} of this substituent's principal chain.`,
      explanationEs: `La rama se une en el localizador C${branch.locant} de la cadena principal de este sustituyente.`,
    });
    selections.push(...nestedCarbonSelections(child, `${path}branch:${branch.locant}`, depth + 1));
  }
  return selections;
}

function classifySubstituent(graph: GeneratedMolecule, root: number, ring: ReadonlySet<number>, hydrogen: (id:number)=>number): Branch | null {
  const atoms = new Map(graph.atoms.map(atom=>[atom.id,atom]));
  const neighbors = (id:number) => graph.bonds.filter(([a,b])=>a===id||b===id).map(([a,b,order=1])=>({id:a===id?b:a,order}));
  const atom = atoms.get(root); if(!atom)return null;
  const ns=neighbors(root), ringNeighbors=ns.filter(next=>ring.has(next.id));
  if(ringNeighbors.length!==1 || ringNeighbors[0].order!==1)return null;
  const element=atom.element??"C";
  if(["F","Cl","Br","I"].includes(element)) {
    const halogen=element as "F"|"Cl"|"Br"|"I";
    const name={F:"fluoro",Cl:"chloro",Br:"bromo",I:"iodo"}[halogen];
    const es={F:"fluoro",Cl:"cloro",Br:"bromo",I:"yodo"}[halogen];
    return {name,nameEs:es,atoms:[root],bonds:[[root,ringNeighbors[0].id]],rule:"P-5.1; P-14.4"};
  }
  if(element==="O" && !(atom.charge??0)) {
    if(ns.length===1 && hydrogen(root)===1)
      return {name:"hydroxy",nameEs:"hidroxi",atoms:[root],bonds:[[root,ringNeighbors[0].id]],rule:"P-5.1; P-14.4"};
    const carbon=ns.find(next=>next.id!==ringNeighbors[0].id);
    if(carbon && carbon.order===1 && (atoms.get(carbon.id)?.element??"C")==="C"
      && neighbors(carbon.id).length===1 && hydrogen(carbon.id)===3)
      return {name:"methoxy",nameEs:"metoxi",atoms:[root,carbon.id],bonds:[[root,ringNeighbors[0].id],[root,carbon.id]],rule:"P-63.2.2.2; P-14.4"};
    return null;
  }
  if(element==="N" && !(atom.charge??0) && ns.length===1 && hydrogen(root)===2)
    return {name:"amino",nameEs:"amino",atoms:[root],bonds:[[root,ringNeighbors[0].id]],rule:"P-5.1; P-14.4"};
  if(element!=="C" || (atom.charge??0))return null;
  const fluorines=ns.filter(next=>next.order===1&&atoms.get(next.id)?.element==="F"&&!(atoms.get(next.id)?.charge??0));
  if(fluorines.length===3 && ns.length===4)
    return {name:"trifluoromethyl",nameEs:"trifluorometil",atoms:[root,...fluorines.map(item=>item.id)],
      bonds:[[root,ringNeighbors[0].id],...fluorines.map(item=>[root,item.id] as [number,number])],rule:"P-29.4.1",complex:true};
  // The inferred carbon path can itself traverse a ring substituent in PARTIAL
  // structures. The aromatic attachment is the local boundary; ring atoms are
  // excluded, while candidate-parent labels do not cut the substituent graph.
  const derivation=deriveCarbonSubstituent(graph,root,ring);
  if(!derivation)return null;
  return {name:derivation.name,nameEs:derivation.nameEs,atoms:derivation.atomIds,bonds:derivation.bondIds,
    rule:derivation.rule,derivation,complex:derivation.branches.length>0};
}

function enumerateCycle(anchor:number, adjacency:ReadonlyMap<number,readonly number[]>, first:number) {
  const order=[anchor], seen=new Set(order); let previous=anchor,current=first;
  while(!seen.has(current)) {
    order.push(current); seen.add(current);
    const next=(adjacency.get(current)??[]).filter(id=>id!==previous);
    if(next.length!==1)return null;
    previous=current; current=next[0];
  }
  return order.length===adjacency.size && current===anchor ? order : null;
}

/** Derive a bounded local name from ring connectivity alone. It never reads a
 * displayed name or decides how the complete molecule is named. */
export function deriveLocalAromaticNomenclature(input:{graph:GeneratedMolecule;ringAtomIds:readonly number[];
  ringBondIds:readonly (readonly [number,number])[];attachmentAtomId:number;attachmentRootAtomId:number;
  connection:AromaticConnection;linkerAtomId?:number;parentAtomIds?:readonly number[];parentAttachmentLocant?:number;
  parentRule?:string;implicitHydrogens:(id:number)=>number}):LocalAromaticNomenclature|null {
  const {graph,connection,attachmentAtomId,attachmentRootAtomId}=input;
  const ring=new Set(input.ringAtomIds), adjacency=new Map([...ring].map(id=>[id,[] as number[]]));
  if(ring.size!==6 || [...ring].some(id=>(graph.atoms.find(atom=>atom.id===id)?.element??"C")!=="C"))return null;
  for(const [a,b] of input.ringBondIds){if(ring.has(a)&&ring.has(b)){adjacency.get(a)!.push(b);adjacency.get(b)!.push(a);}}
  if([...adjacency.values()].some(neighbors=>neighbors.length!==2))return null;
  if(!ring.has(attachmentAtomId))return null;
  const first=(adjacency.get(attachmentAtomId)??[])[0],second=(adjacency.get(attachmentAtomId)??[])[1];
  const orders=[enumerateCycle(attachmentAtomId,adjacency,first),enumerateCycle(attachmentAtomId,adjacency,second)];
  const cycles=orders.filter((order):order is number[]=>order!==null);
  if(cycles.length!==2)return null;
  const graphNeighbors=(id:number)=>graph.bonds.filter(([a,b])=>a===id||b===id).map(([a,b,order=1])=>({id:a===id?b:a,order}));
  const branches: {branch:Branch; position:number; ringAtom:number; ringBond:[number,number]}[]=[];
  const anchorExternal=input.linkerAtomId === undefined
    ? graphNeighbors(attachmentAtomId).some(next=>next.id===attachmentRootAtomId&&next.order===1)
    : graphNeighbors(attachmentAtomId).some(next=>next.id===input.linkerAtomId&&next.order===1)
      && graphNeighbors(input.linkerAtomId).some(next=>next.id===attachmentRootAtomId&&next.order===1);
  if(!anchorExternal)return null;
  const attachmentBondIds:[number,number][] = input.linkerAtomId === undefined
    ? [[attachmentAtomId,attachmentRootAtomId]] : [[attachmentAtomId,input.linkerAtomId],[input.linkerAtomId,attachmentRootAtomId]];
  for(const id of ring) {
    if(id===attachmentAtomId)continue;
    const externals=graphNeighbors(id).filter(next=>!ring.has(next.id));
    for(const external of externals){
      const branch=classifySubstituent(graph,external.id,ring,input.implicitHydrogens);
      if(!branch)return null;
      branches.push({branch,position:0,ringAtom:id,ringBond:[id,external.id]});
    }
  }
  const variants=cycles.map(order=>{
    const positions=new Map(order.map((id,index)=>[id,index+1]));
    const located=branches.map(item=>({...item,position:positions.get(item.ringAtom)!}));
    const locants=located.map(item=>item.position).sort((a,b)=>a-b);
    const byLocant=sorted(located,(a,b)=>a.position-b.position||a.branch.name.localeCompare(b.branch.name));
    return {order,positions,located,locants,alpha:byLocant.map(item=>item.branch.name)};
  }).sort((a,b)=>compareLocants(a.locants,b.locants)||compareStrings(a.alpha,b.alpha));
  const selected=variants[0];
  const descriptor=sorted(selected.located,(a,b)=>a.position-b.position||a.branch.name.localeCompare(b.branch.name));
  const parts=descriptor.map(item=>`${item.position}-${item.branch.name}`);
  const partsEs=descriptor.map(item=>`${item.position}-${item.branch.nameEs}`);
  const base=connection==="phenylamino"?"anilino":connection;
  const baseEs=connection==="phenylamino"?"anilino":connection==="phenyl"?"fenil":connection==="phenoxy"?"fenoxi":connection==="benzyl"?"bencilo":"fenilamino";
  const grouped = (items:typeof descriptor, lang:"en"|"es") => {
    const groups = new Map<string, number[]>();
    for (const item of items) { const label = lang === "en" ? item.branch.name : item.branch.nameEs;
      groups.set(label, [...(groups.get(label) ?? []), item.position]); }
    return [...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([label,positions]) => {
      const evidence=descriptor.find(item=>(lang==="en"?item.branch.name:item.branch.nameEs)===label)?.branch;
      const complex=evidence?.complex??(Boolean(evidence?.derivation?.branches.length)||label.includes("("));
      const locanted=/(?:^|-)[1-9][0-9]*(?:-|$)/.test(label);
      const multiplier=multiplicativePrefix(positions.length,complex);
      const needsEnclosure=complex||positions.length>1&&locanted;
      const wrapped=needsEnclosure?`${multiplier}${enclose(label)}`:`${multiplier}${label}`;
      return `${positions.length>1?`${positions.join(",")}-`:`${positions[0]}-`}${wrapped}`;
    });
  };
  const partsGrouped=grouped(descriptor,"en"), partsGroupedEs=grouped(descriptor,"es");
  const name=`${partsGrouped.length?`${partsGrouped.join("-")}`:""}${base}`;
  const nameEs=`${partsGroupedEs.length?`${partsGroupedEs.join("-")}`:""}${baseEs}`;
  const rule=connection==="phenoxy"?"P-63.2.2.2; P-29.4.1; P-14.3.5; P-14.4"
    :connection==="benzyl"?"P-29.6.2.1; P-29.4.1; P-14.3.5; P-14.4"
    :connection==="phenylamino"?"P-62.2.1.1.1; P-29.4.1; P-14.3.5; P-14.4"
        :"P-29.6.1; P-29.4.1; P-14.3.5; P-14.4";
  const locantList=descriptor.map(item=>`C${item.position}: ${item.branch.name}`).join(", ");
  const locantListEs=descriptor.map(item=>`C${item.position}: ${item.branch.nameEs}`).join(", ");
  const connectionExplanation=connection==="phenoxy"?"The ring connects to the larger fragment through an ether oxygen, so phenoxy is the supported substituent base (P-63.2.2.2)."
    :connection==="benzyl"?"The ring connects through a methylene unit; benzyl is used here with the restricted general-nomenclature substitution allowed by P-29.6.2.1."
      :connection==="phenylamino"?"The ring connects through an –NH– unit, so anilino is the preferred substituent base (P-62.2.1.1.1)."
        :"The ring carbon is directly bonded to the larger fragment, so phenyl is the supported substituent base (P-29.6.1).";
  const connectionExplanationEs=connection==="phenoxy"?"El anillo se conecta con el fragmento mayor mediante un oxígeno éter, por lo que fenoxi es la base del sustituyente respaldada (P-63.2.2.2)."
    :connection==="benzyl"?"El anillo se conecta mediante un grupo metileno; aquí se usa bencilo con la sustitución restringida admitida en nomenclatura general por P-29.6.2.1."
      :connection==="phenylamino"?"El anillo se conecta mediante un grupo –NH–, por lo que anilino es la base preferida del sustituyente (P-62.2.1.1.1)."
        :"El carbono del anillo se enlaza directamente con el fragmento mayor, por lo que fenil es la base respaldada del sustituyente (P-29.6.1).";
  const parentText=input.parentAttachmentLocant!==undefined
    ? ` The attachment is at C${input.parentAttachmentLocant} of the rule-supported amine-parent candidate (${input.parentRule}; amine locant 1 under P-14.4); this local mapping does not reconcile the complete name.` : " This local derivation does not assign a parent-chain attachment locant.";
  const parentTextEs=input.parentAttachmentLocant!==undefined
    ? ` La unión ocurre en C${input.parentAttachmentLocant} del candidato parental de amina respaldado por reglas (${input.parentRule}; la amina recibe el localizador 1 según P-14.4); esta correspondencia local no concilia el nombre completo.` : " Esta derivación local no asigna un localizador de unión en la cadena parental.";
  const explanation=`${connectionExplanation} Its ring attachment atom is C1. Ring positions are assigned from that point using the lowest locant set (P-14.3.5 and P-14.4). The verified ring substituents are ${locantList||"none"}.${parentText} This derives only the substituent; the complete molecular name remains unverified.`;
  const explanationEs=`${connectionExplanationEs} El átomo de unión del anillo es C1. Las posiciones se asignan desde ese punto con el conjunto más bajo de localizadores (P-14.3.5 y P-14.4). Los sustituyentes verificados del anillo son ${locantListEs||"ninguno"}.${parentTextEs} Esta derivación se limita al sustituyente; el nombre de la molécula completa sigue sin verificarse.`;
  const numbering:[number,number][]=selected.order.map((id,index)=>[id,index+1]);
  return {name,nameEs,connection,rule,explanation,explanationEs,numbering,attachmentAtomId,attachmentBondIds,
    ...(input.linkerAtomId!==undefined?{linkerAtomId:input.linkerAtomId}:{}),
    ...(input.parentAttachmentLocant!==undefined?{parentAttachmentLocant:input.parentAttachmentLocant}:{}),
    ...(input.parentRule?{parentRule:input.parentRule}:{}),
    substituents:descriptor.map(item=>({name:item.branch.name,nameEs:item.branch.nameEs,position:item.position,atomIds:item.branch.atoms,
      bondIds:item.branch.bonds,explanation:`${item.branch.name} at ring position ${item.position}; ${item.branch.rule}.${item.branch.derivation?` ${item.branch.derivation.explanation}`:""}`,
      explanationEs:`${item.branch.nameEs} en la posición ${item.position} del anillo; ${item.branch.rule}.${item.branch.derivation?` ${item.branch.derivation.explanationEs}`:""}`,rule:item.branch.rule,
      ...(item.branch.derivation?{derivation:item.branch.derivation,nestedSelections:nestedCarbonSelections(item.branch.derivation)}:{})})),
    nestedSelections:descriptor.flatMap(item=>item.branch.derivation?nestedCarbonSelections(item.branch.derivation):[])};
}
