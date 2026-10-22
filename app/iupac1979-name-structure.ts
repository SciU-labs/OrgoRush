import { Molecule as OCLMolecule } from "openchemlib";
import { recognizeRingTopology, type RingGraph } from "./fused-topology.ts";
import { iupacRootForCarbonCount, englishIupacRoot } from "./iupac-prefixes.ts";

export type LegacyFragment = {
  es: string; en: string; kind?: string;
  elements: string[]; bonds: [number, number, number][]; charges?: Record<number, number>;
};
const fragment = (es: string, en: string, elements: string[], bonds: [number,number,number][] = [],
  kind?: string, charges?: Record<number,number>): LegacyFragment => ({ es, en, elements, bonds, kind, charges });
const terms = [
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
  if(!alkyl||alkyl.kind||!/^[a-z]+il$/.test(alkyl.es)||alkyl.elements.some(e=>e!=="C")||alkyl.bonds.some(([, ,o])=>o!==1)
    ||alkyl.bonds.length!==alkyl.elements.length-1)return;
  const degrees=alkyl.elements.map((_,i)=>alkyl.bonds.filter(([a,b])=>a===i||b===i).length);
  if(degrees[0]>1||degrees.some(d=>d>2))return;
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
