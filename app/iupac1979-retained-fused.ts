import { Molecule as OCLMolecule } from "openchemlib";
import { recognizeRingTopology, type RingGraph, type TopologyResult } from "./fused-topology.ts";
import { attachLegacyFragment, legacyGraphsIdentical, legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { compareHistoricalLocants, historicalPrefixKey } from "./legacy-name-numbering.ts";
import { iupacAlkylNameForCarbonCount } from "./iupac-prefixes.ts";

type FusedGraph = {
  atoms: readonly (RingGraph["atoms"][number] & { tetrahedralParity?: string; tetrahedralBondTo?: number })[];
  bonds: RingGraph["bonds"];
};
type ParentDefinition = {
  id: string;
  es: string;
  en: string;
  perimeter: string[];
  bridges: [string, string][];
  interior?: string[];
  doubles: [string, string][];
  rule: string;
  figure: string;
};
const A21 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm";
const A23 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_73.htm";
const pairs = (text: string): [string, string][] => text.split(" ").map((pair) => pair.split("-") as [string, string]);
const perimeter = (text: string) => text.split(" ");
const multipliers=["","","di","tri","tetra","penta","hexa","hepta","octa","nona","deca","undeca","dodeca","trideca","tetradeca","pentadeca","hexadeca","heptadeca","octadeca","nonadeca","icosa"];

// Numbered adjacency transcribed from the 1979 figures, NOT a SMILES lookup.
// These definitions include constitutional bonds and hydrogen positions; formula
// and ring-size signatures alone never admit a retained parent.
export const RETAINED_FUSED_1979: readonly ParentDefinition[] = [
  { id: "naphthalene", es: "naftaleno", en: "naphthalene", perimeter: perimeter("1 2 3 4 4a 5 6 7 8 8a"),
    bridges: pairs("4a-8a"), doubles: pairs("1-2 3-4 4a-5 6-7 8-8a"), rule: "A-21.1(3); A-22.1–3", figure: `${A21}#bm2460` },
  { id: "anthracene", es: "antraceno", en: "anthracene", perimeter: perimeter("1 2 3 4 4a 10 10a 5 6 7 8 8a 9 9a"),
    bridges: pairs("4a-9a 8a-10a"), doubles: pairs("1-2 3-4 4a-10 10a-5 6-7 8-8a 9-9a"), rule: "A-21.1(13); A-22.5", figure: `${A21}#bm2560` },
  { id: "phenanthrene", es: "fenantreno", en: "phenanthrene", perimeter: perimeter("1 2 3 4 4a 4b 5 6 7 8 8a 9 10 10a"),
    bridges: pairs("4a-10a 4b-8a"), doubles: pairs("1-2 3-4 4a-10a 4b-5 6-7 8-8a 9-10"), rule: "A-21.1(12); A-22.5", figure: `${A21}#bm2550` },
  { id: "indene", es: "indeno", en: "indene", perimeter: perimeter("1 2 3 3a 4 5 6 7 7a"),
    bridges: pairs("3a-7a"), doubles: pairs("2-3 3a-7a 4-5 6-7"), rule: "A-21.1(2); A-21.6; A-22.4", figure: `${A21}#bm2450` },
  { id: "fluorene", es: "fluoreno", en: "fluorene", perimeter: perimeter("1 2 3 4 4a 4b 5 6 7 8 8a 9 9a"),
    bridges: pairs("4a-9a 4b-8a"), doubles: pairs("1-2 3-4 4a-9a 4b-8a 5-6 7-8"), rule: "A-21.1(10); A-22.1–4", figure: `${A21}#bm2530` },
  { id: "azulene", es: "azuleno", en: "azulene", perimeter: perimeter("1 2 3 3a 4 5 6 7 8 8a"),
    bridges: pairs("3a-8a"), doubles: pairs("1-2 3-3a 4-5 6-7 8-8a"), rule: "A-21.1(4); A-22.1–3", figure: `${A21}#bm2470` },
  // A-22.2 (1979) uses 10b/10c for pyrene's interior atoms. The 1998
  // fusion recommendations changed those locants to 3a¹/5a¹; do not import them.
  { id: "pyrene", es: "pireno", en: "pyrene", perimeter: perimeter("1 2 3 3a 4 5 5a 6 7 8 8a 9 10 10a"), interior: ["10b","10c"],
    bridges: pairs("10a-10b 10b-3a 10b-10c 10c-5a 10c-8a"),
    doubles: pairs("1-2 3-3a 4-5 5a-6 7-8 8a-10c 9-10 10a-10b"), rule: "A-21.1(18); A-22.2", figure: `${A21}#bm2610` },
  { id: "fluoranthene", es: "fluoranteno", en: "fluoranthene", perimeter: perimeter("1 2 3 3a 4 5 6 6a 6b 7 8 9 10 10a 10b"), interior: ["10c"],
    bridges: pairs("3a-10c 6a-10c 10b-10c 6b-10a"),
    doubles: pairs("1-2 3-3a 4-5 6-6a 6b-7 8-9 10-10a 10b-10c"), rule: "A-21.1(14); A-22", figure: `${A21}#bm2570` },
  { id: "biphenylene", es: "bifenileno", en: "biphenylene", perimeter: perimeter("1 2 3 4 4a 4b 5 6 7 8 8a 8b"),
    bridges: pairs("4a-8b 4b-8a"), doubles: pairs("1-8b 2-3 4-4a 4b-5 6-7 8-8a"), rule: "A-21.1(6); A-22", figure: `${A21}#bm2490` },
  { id: "triphenylene", es: "trifenileno", en: "triphenylene", perimeter: perimeter("1 2 3 4 4a 4b 5 6 7 8 8a 8b 9 10 11 12 12a 12b"),
    bridges: pairs("4a-12b 4b-8a 8b-12a"), doubles: pairs("1-2 3-4 4a-4b 5-6 7-8 8a-8b 9-10 11-12 12a-12b"), rule: "A-21.1(17); A-22", figure: `${A21}#bm2600` },
  { id: "1,4-dihydronaphthalene", es: "1,4-dihidronaftaleno", en: "1,4-dihydronaphthalene",
    perimeter: perimeter("1 2 3 4 4a 5 6 7 8 8a"), bridges: pairs("4a-8a"), doubles: pairs("2-3 4a-8a 5-6 7-8"),
    rule: "A-23.1–2; A-22.1–3", figure: `${A23}#bm1790` },
  { id: "1,2,3,4-tetrahydronaphthalene", es: "1,2,3,4-tetrahidronaftaleno", en: "1,2,3,4-tetrahydronaphthalene",
    perimeter: perimeter("1 2 3 4 4a 5 6 7 8 8a"), bridges: pairs("4a-8a"), doubles: pairs("4a-8a 5-6 7-8"),
    rule: "A-23.1–2; A-22", figure: A23 },
];

type NormalizedGraph = { ids: number[]; labels: string[]; edges: number[][] };
function normalize(graph: RingGraph): NormalizedGraph {
  const mol = new OCLMolecule(0, 0);
  const ids = graph.atoms.map((a) => a.id), index = new Map(ids.map((id, i) => [id, i]));
  graph.atoms.forEach(() => mol.addAtom(6));
  graph.bonds.forEach(([a, b, order = 1]) => {
    const bond = mol.addBond(index.get(a)!, index.get(b)!);
    mol.setBondOrder(bond, order);
  });
  mol.ensureHelperArrays(OCLMolecule.cHelperRings);
  const edges = ids.map(() => ids.map(() => 0));
  graph.bonds.forEach(([a, b, order = 1], i) => {
    edges[index.get(a)!][index.get(b)!] = edges[index.get(b)!][index.get(a)!] = mol.isAromaticBond(i) ? 4 : order;
  });
  return { ids, edges, labels: ids.map((id, i) => {
    const hydrogens = 4 - graph.bonds.reduce((sum, [a, b, order = 1]) => sum + (a === id || b === id ? order : 0), 0);
    return `${hydrogens}:${edges[i].filter(Boolean).sort().join(",")}`;
  }) };
}
function definitionGraph(parent: ParentDefinition): RingGraph {
  const locants = [...parent.perimeter, ...(parent.interior ?? [])];
  const edgePairs = [...parent.perimeter.map((locant, i): [string, string] => [locant, parent.perimeter[(i + 1) % parent.perimeter.length]]), ...parent.bridges];
  return {
    atoms: locants.map((_, i) => ({ id: i })),
    bonds: edgePairs.map(([a, b]) => [locants.indexOf(a), locants.indexOf(b),
      parent.doubles.some(([c, d]) => a === c && b === d || a === d && b === c) ? 2 : 1]),
  };
}
const normalizedParents = RETAINED_FUSED_1979.map((definition) => ({ definition, graph: normalize(definitionGraph(definition)) }));

// Enumerate graph isomorphisms so numbering choices can be compared by locants,
// rather than by atom IDs or the coordinates of the user's drawing.
function mappings(parent: NormalizedGraph, actual: NormalizedGraph): number[][] {
  if (parent.ids.length !== actual.ids.length) return [];
  const options = parent.labels.map((label) => actual.labels.flatMap((other, i) => label === other ? [i] : []));
  const order = parent.ids.map((_, i) => i).sort((a, b) => options[a].length - options[b].length);
  const chosen = new Array<number>(parent.ids.length).fill(-1), used = new Set<number>(), found: number[][] = [];
  function visit(depth: number) {
    if (depth === order.length) { found.push(chosen.map((i) => actual.ids[i])); return; }
    const a = order[depth];
    for (const b of options[a]) {
      if (used.has(b) || order.slice(0, depth).some((c) => parent.edges[a][c] !== actual.edges[b][chosen[c]])) continue;
      chosen[a] = b; used.add(b); visit(depth + 1); used.delete(b); chosen[a] = -1;
    }
  }
  visit(0); return found;
}
export type RetainedFusedResult =
  | { status: "SUPPORTED"; topology: TopologyResult; parentId: string; nameEs: string; nameEn: string;
      parentEs: string; parentEn: string; locants: Map<number, string>; englishLocants?: Map<number,string>; atomIds: number[]; rule: string; reference: string }
  | { status: "UNSUPPORTED"; topology: TopologyResult; reason: string; requiresRetainedRoute: boolean };

/** Bounded A-21/A-22/A-23 implementation; unsupported is a first-class result. */
export function nameRetainedFused1979(graph: FusedGraph): RetainedFusedResult {
  const topology = recognizeRingTopology(graph);
  let requiresRetainedRoute = false;
  const unsupported = (reason: string): RetainedFusedResult => ({ status: "UNSUPPORTED", topology, reason, requiresRetainedRoute });
  if (topology.kind !== "ortho-fused" && topology.kind !== "ortho-peri-fused") return unsupported(topology.reason ?? topology.kind);
  const coreIds = new Set(topology.cycles.flat());
  if (graph.atoms.some((a) => coreIds.has(a.id) && (a.element ?? "C") !== "C")) return unsupported("heterocyclic-parent");
  const core: RingGraph = { atoms: graph.atoms.filter((a) => coreIds.has(a.id)), bonds: graph.bonds.filter(([a, b]) => coreIds.has(a) && coreIds.has(b)) };
  let actual: NormalizedGraph;
  try {
    actual = normalize(core);
    // Preserve the existing A-32 treatment of mixed aliphatic tricycles which
    // may contain a benzene subunit. The new retained route guards aromatic
    // bicycles and fully aromatic larger cores independently of stored flags.
    requiresRetainedRoute = actual.edges.some((row) => row.includes(4))
      && (topology.cycleRank === 2 || actual.edges.every((row) => row.includes(4)));
  } catch { return unsupported("aromatic-normalization-failed"); }
  if (graph.atoms.some((atom) => atom.charge || atom.tetrahedralParity !== undefined || atom.tetrahedralBondTo !== undefined)
    || graph.bonds.some((bond) => bond[3])) return unsupported("charge-or-stereochemistry-outside-retained-subset");
  const external = graph.atoms.filter((a) => !coreIds.has(a.id));
  const remaining=new Set(external.map(a=>a.id));
  const attachments: {anchor:number;term:NonNullable<ReturnType<typeof legacyPrefixTerm>>}[]=[];
  const candidates=["fluoro","cloro","bromo","yodo","hidroxi",
    ...Array.from({length:20},(_,i)=>iupacAlkylNameForCarbonCount(i+1)!)]
    .map(legacyPrefixTerm).filter((t):t is NonNullable<typeof t>=>Boolean(t));
  while (remaining.size) {
    const ids=new Set<number>(), stack=[remaining.values().next().value!];
    while(stack.length) {const id=stack.pop()!;if(ids.has(id))continue;ids.add(id);remaining.delete(id);
      for(const [a,b] of graph.bonds) {const other=a===id?b:b===id?a:undefined;if(other!==undefined&&!coreIds.has(other)&&!ids.has(other))stack.push(other);}}
    const links=graph.bonds.filter(([a,b])=>ids.has(a)&&coreIds.has(b)||ids.has(b)&&coreIds.has(a));
    if(links.length!==1||(links[0][2]??1)!==1)return unsupported("unsupported-attachment");
    const [a,b]=links[0], anchor=coreIds.has(a)?a:b, root=coreIds.has(a)?b:a;
    const component={atoms:external.filter(a=>ids.has(a.id)),bonds:graph.bonds.filter(([a,b])=>ids.has(a)&&ids.has(b))};
    const term=candidates.find(t=>legacyGraphsIdentical({atoms:t.elements.map((element,id)=>({id,element})),bonds:t.bonds},component,new Map([[0,root]])));
    if(!term)return unsupported("substitution-outside-retained-subset");
    attachments.push({anchor,term});
  }
  // Remove the substituent's valence contribution before matching the parent;
  // an ordinary aromatic CH has exactly one replaceable H.
  try {
    for (const { definition, graph: parent } of normalizedParents) {
      const choices = mappings(parent, actual);
      if (!choices.length) continue;
      const labels=[...definition.perimeter,...(definition.interior??[])];
      const hydroxyls=attachments.filter(a=>a.term.kind==="alcohol");
      if(hydroxyls.length&&(definition.id!=="naphthalene"||hydroxyls.length!==1))return unsupported("functional-suffix-outside-retained-subset");
      const locant=(choice:number[],anchor:number)=>Number(labels[choice.indexOf(anchor)]);
      const ordered=(choice:number[],items:typeof attachments)=>items.map(a=>locant(choice,a.anchor)).sort((a,b)=>a-b);
      const select=(language:"es"|"en")=>[...choices].sort((a,b)=>compareHistoricalLocants(ordered(a,hydroxyls),ordered(b,hydroxyls))
        ||compareHistoricalLocants(ordered(a,attachments),ordered(b,attachments))
        ||[...new Set(attachments.map(t=>t.term[language]))].sort((a,b)=>historicalPrefixKey(a).localeCompare(historicalPrefixKey(b),language))
          .reduce((cmp,name)=>cmp||compareHistoricalLocants(ordered(a,attachments.filter(t=>t.term[language]===name)),ordered(b,attachments.filter(t=>t.term[language]===name))),0)
        ||a.join(",").localeCompare(b.join(","),"en",{numeric:true}))[0];
      const chosen = select("es"), chosenEn=select("en");
      const locants = new Map(chosen.map((id, i) => [id, labels[i]]));
      if(attachments.some(a=>!/^\d+$/.test(locants.get(a.anchor)??"")))return unsupported("fusion-atom-has-no-replaceable-hydrogen");
      // Verify the complete decorated graph, with every parent position fixed.
      const template=definitionGraph(definition), expected={atoms:[...template.atoms],bonds:template.bonds.map(([a,b,o=1]):[number,number,number]=>[a,b,o])};
      for(const a of attachments)attachLegacyFragment(expected,chosen.indexOf(a.anchor),a.term);
      if(!legacyGraphsIdentical(expected,graph,new Map(chosen.map((id,i)=>[i,id]))))return unsupported("decorated-parent-identity-failed");
      const render=(language:"es"|"en",choice:number[])=>{
        const groups=new Map<string,number[]>();
        for(const a of attachments.filter(a=>a.term.kind!=="alcohol")){const name=a.term[language];groups.set(name,[...(groups.get(name)??[]),locant(choice,a.anchor)]);}
        const prefixes=[...groups].sort(([a],[b])=>historicalPrefixKey(a).localeCompare(historicalPrefixKey(b),language)).map(([name,values])=>
          `${values.sort((a,b)=>a-b).join(",")}-${multipliers[values.length]}${name}`);
        const base=hydroxyls.length?`${locant(choice,hydroxyls[0].anchor)}-${language==="es"?"naftol":"naphthol"}`:definition[language];
        return prefixes.length?`${prefixes.join("-")}${/^\d/.test(base)?"-":""}${base}`:base;
      };
      return { status: "SUPPORTED", topology, parentId: definition.id,
        parentEs: definition.es, parentEn: definition.en,
        nameEs: render("es",chosen), nameEn: render("en",chosenEn),
        locants, englishLocants:new Map(chosenEn.map((id,i)=>[id,labels[i]])),atomIds: chosen, rule: `${definition.rule}${attachments.length ? "; A-23.3; C-15.11; C-16.31" : ""}`, reference: definition.figure };
    }
  } catch { return unsupported("aromatic-normalization-failed"); }
  return unsupported("parent-or-hydrogenation-outside-verified-registry");
}

/** Spelling admission only; callers must also retain the graph-backed result. */
export function isRetainedFused1979NameEs(name: string) {
  return [...RETAINED_FUSED_1979.map(p=>p.es),"1-naftol","2-naftol"].some(base=>{
    if(!name.endsWith(base))return false;
    const prefix=name.slice(0,-base.length).replace(/-$/,"");
    if(!prefix)return true;
    return prefix.split(/-(?=\d)/).every(part=>{
      const match=part.match(/^(\d+(?:,\d+)*)-([a-z]+)$/);
      if(!match)return false;
      const count=match[1].split(",").length, word=match[2];
      const component=count===1?word:word.startsWith(multipliers[count])?word.slice(multipliers[count].length):"";
      const term=legacyPrefixTerm(component);
      return Boolean(term&&(term.kind==="halogen"||!term.kind));
    });
  });
}
