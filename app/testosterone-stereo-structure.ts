import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { getSteroidLike6565System } from "./fused-ring-nomenclature.ts";

/** Audited isomeric structures from PubChem CID 6013 and ChEBI CHEBI:17347.
 * The ChEBI spelling is an independent atom-order / explicit-hydrogen form. */
export const TESTOSTERONE_REFERENCE_SMILES =
  "C[C@]12CC[C@H]3[C@H]([C@@H]1CC[C@@H]2O)CCC4=CC(=O)CC[C@]34C";
export const TESTOSTERONE_CHEBI_SMILES =
  "[H][C@@]12CCC3=CC(=O)CC[C@]3(C)[C@@]1([H])CC[C@]1(C)[C@@H](O)CC[C@@]21[H]";
export const EPITESTOSTERONE_REFERENCE_SMILES =
  "C[C@]12CC[C@H]3[C@H]([C@@H]1CC[C@H]2O)CCC4=CC(=O)CC[C@]34C";

const TESTOSTERONE_CIP_BY_LOCANT: Readonly<Record<number, "R" | "S">> = {
  8: "R", 9: "S", 10: "R", 13: "S", 14: "S", 17: "S",
};

export type TestosteroneGraphEvidence = {
  system: NonNullable<ReturnType<typeof getSteroidLike6565System>>;
  locants: Record<string, number>;
  carbonylOxygenId: number;
  hydroxylOxygenId: number;
  c4C5Bond: [number, number];
  c3OxoBond: [number, number];
  c17HydroxyBond: [number, number];
};

/**
 * Verifies the tightly bounded testosterone structure from graph topology,
 * bond orders, functional groups, formula, and every required stereocentre.
 * C5 is sp2 in this structure and is intentionally absent from the tetrahedral
 * configuration table; the α/β assignment at C17 is anchored to the audited
 * testosterone reference rather than inferred from @/@@ or drawing direction.
 */
export function inspectTestosteroneGraph(graph: GeneratedMolecule): TestosteroneGraphEvidence | null {
  const system = getSteroidLike6565System(graph);
  if (!system?.isGonaneTopology || !system.numbering || !system.angularMethyls
    || system.constitutionNameEn !== "17-hydroxyandrost-4-en-3-one"
    || graph.atoms.length !== 21 || graph.bonds.length !== 24 || graph.rings?.length !== 4
    || graph.rings.map(ring => ring.atomIds.length).sort((a,b)=>a-b).join(",") !== "5,6,6,6") return null;

  const atomById = new Map(graph.atoms.map(atom => [atom.id, atom]));
  if (atomById.size !== graph.atoms.length || graph.atoms.some(atom => (atom.charge ?? 0) !== 0)) return null;
  const carbonIds = graph.atoms.filter(atom => (atom.element ?? "C") === "C").map(atom => atom.id);
  const oxygenIds = graph.atoms.filter(atom => atom.element === "O").map(atom => atom.id);
  if (carbonIds.length !== 19 || oxygenIds.length !== 2
    || graph.atoms.some(atom => !["C", "O"].includes(atom.element ?? "C"))) return null;

  const locants = Object.fromEntries(system.numbering.map((id,index)=>[String(index+1),id])) as Record<string,number>;
  locants["18"] = system.angularMethyls.C18;
  locants["19"] = system.angularMethyls.C19;
  if (new Set(Object.values(locants)).size !== 19 || Object.keys(locants).length !== 19
    || Object.values(locants).some(id=>!atomById.has(id))) return null;
  const bondCount = (left:number,right:number,order:number) => graph.bonds.filter(([a,b,value=1]) =>
    ((a===left&&b===right)||(a===right&&b===left))&&value===order).length;
  const endpoints = (atomId:number) => graph.bonds.flatMap(([a,b,order=1])=>a===atomId?[[b,order] as const]:b===atomId?[[a,order] as const]:[]);
  const c4=locants["4"]!,c5=locants["5"]!,c3=locants["3"]!,c17=locants["17"]!;
  const c4C5=graph.bonds.filter(([a,b,order=1])=>order===2&&((a===c4&&b===c5)||(a===c5&&b===c4)));
  const c3O=oxygenIds.filter(id=>bondCount(c3,id,2)===1);
  const c17O=oxygenIds.filter(id=>bondCount(c17,id,1)===1);
  if (c4C5.length!==1 || c3O.length!==1 || c17O.length!==1 || c3O[0]===c17O[0]
    || graph.bonds.filter(([, ,order=1])=>order===2).length!==2
    || graph.bonds.some(([, ,order=1])=>order===3)
    || bondCount(c3,c3O[0]!,2)!==1 || bondCount(c17,c17O[0]!,1)!==1
    || endpoints(c3O[0]!).length!==1 || endpoints(c17O[0]!).length!==1
    || endpoints(c3O[0]!)[0]![0]!==c3 || endpoints(c17O[0]!)[0]![0]!==c17
    || endpoints(c3O[0]!)[0]![1]!==2 || endpoints(c17O[0]!)[0]![1]!==1) return null;

  const expectedCenters=new Set(Object.keys(TESTOSTERONE_CIP_BY_LOCANT).map(Number));
  const assigned=graph.atoms.filter(atom=>atom.tetrahedralParity);
  if (assigned.length!==expectedCenters.size || assigned.some(atom=>{
    const locant=Number(Object.entries(locants).find(([,id])=>id===atom.id)?.[0]);
    return !expectedCenters.has(locant)||atom.tetrahedralParity!==TESTOSTERONE_CIP_BY_LOCANT[locant];
  }) || [...expectedCenters].some(locant=>{
    const atom=atomById.get(locants[String(locant)]!);
    return atom?.tetrahedralParity!==TESTOSTERONE_CIP_BY_LOCANT[locant];
  }) || atomById.get(c5)?.tetrahedralParity!==undefined) return null;

  const hydrogenCount=graph.atoms.reduce((sum,atom)=>{
    const valence=graph.bonds.filter(([a,b])=>a===atom.id||b===atom.id)
      .reduce((bondSum,[, ,order=1])=>bondSum+order,0);
    const expectedValence=atom.element==="O"?2:4;
    return sum+expectedValence-valence;
  },0);
  if (hydrogenCount!==28) return null;

  const orderedBond=(pair:[number,number]):[number,number]=>pair[0]<pair[1]?pair:[pair[1],pair[0]];
  return {system,locants,carbonylOxygenId:c3O[0]!,hydroxylOxygenId:c17O[0]!,
    c4C5Bond:orderedBond([c4,c5]),c3OxoBond:orderedBond([c3,c3O[0]!]),c17HydroxyBond:orderedBond([c17,c17O[0]!])};
}

/** Return a canonical isomeric representation only for the exact, fully
 * verified graph. Edits or incomplete/epimeric structures never reuse it. */
export function testosteroneReferenceSmilesForExactGraph(graph:GeneratedMolecule):string|null {
  return inspectTestosteroneGraph(graph)?TESTOSTERONE_REFERENCE_SMILES:null;
}
