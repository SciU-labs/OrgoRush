import { CanonizerUtil, Molecule as OCLMolecule, SmilesParser } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";

export type FusedJunctionConfiguration = "cis" | "trans" | "unspecified";
export type FusedRingJunctionStereo = {
  system: "decalin";
  fusionAtomIds: [number, number];
  fusionBond: [number, number];
  configuration: FusedJunctionConfiguration;
};

export type DecalinFusion = {
  rings: [number[], number[]];
  fusionAtomIds: [number, number];
  fusionBond: [number, number];
};

export const DECALIN_REFERENCE_SMILES = {
  cis: "[H][C@]12CCCC[C@@]1([H])CCCC2",
  trans: "[H][C@]12CCCC[C@]1([H])CCCC2",
  unspecified: "C1CCC2CCCCC2C1",
} as const;

function stereoIdCode(smiles: string) {
  const molecule = new SmilesParser().parseMolecule(smiles);
  molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
  return CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL);
}

const referenceIdCodes = {
  cis: stereoIdCode(DECALIN_REFERENCE_SMILES.cis),
  trans: stereoIdCode(DECALIN_REFERENCE_SMILES.trans),
};

const pairKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/**
 * Recognizes only unsubstituted, saturated decalin. In particular this does
 * not infer a fused-ring configuration from coordinates or atom order.
 */
export function findExactDecalinFusion(graph: GeneratedMolecule): DecalinFusion | null {
  if (graph.atoms.length !== 10 || graph.bonds.length !== 11 || graph.rings?.length !== 2) return null;
  if (graph.atoms.some(atom => (atom.element ?? "C") !== "C" || (atom.charge ?? 0) !== 0)) return null;
  if (graph.bonds.some(([, , order]) => (order ?? 1) !== 1)) return null;
  const [left, right] = graph.rings;
  if (left.atomIds.length !== 6 || right.atomIds.length !== 6
    || left.kind !== "cycloalkane" || right.kind !== "cycloalkane") return null;
  const atomIds=new Set(graph.atoms.map(atom=>atom.id));
  const edges=new Set(graph.bonds.map(([a,b])=>pairKey(a,b)));
  for(const ring of [left,right]){
    if(new Set(ring.atomIds).size!==ring.atomIds.length||ring.atomIds.some(id=>!atomIds.has(id)))return null;
    for(let index=0;index<ring.atomIds.length;index+=1){
      if(!edges.has(pairKey(ring.atomIds[index]!,ring.atomIds[(index+1)%ring.atomIds.length]!)))return null;
    }
  }
  const rightIds = new Set(right.atomIds);
  const shared = left.atomIds.filter(id => rightIds.has(id)).sort((a, b) => a - b);
  if (shared.length !== 2 || graph.atoms.some(atom => !left.atomIds.includes(atom.id) && !rightIds.has(atom.id))) return null;
  const fusionBond = pairKey(shared[0]!, shared[1]!);
  if (graph.bonds.filter(([a, b]) => pairKey(a, b) === fusionBond).length !== 1) return null;
  const degree = new Map(graph.atoms.map(atom => [atom.id, 0]));
  for (const [a, b] of graph.bonds) { degree.set(a, (degree.get(a) ?? 0) + 1); degree.set(b, (degree.get(b) ?? 0) + 1); }
  if (shared.some(id => degree.get(id) !== 3)) return null;
  return { rings: [[...left.atomIds], [...right.atomIds]], fusionAtomIds: shared as [number, number],
    fusionBond: shared as [number, number] };
}

export function isValidFusedRingJunctionStereo(graph: GeneratedMolecule): boolean {
  const stored = graph.fusedRingJunctionStereo;
  if (!stored) return true;
  if (stored.system !== "decalin"
    || !["cis", "trans", "unspecified"].includes(stored.configuration)) return false;
  const fusion = findExactDecalinFusion(graph);
  return Boolean(fusion
    && [...stored.fusionAtomIds].sort((a, b) => a - b).join(",") === fusion.fusionAtomIds.join(",")
    && pairKey(...stored.fusionBond) === pairKey(...fusion.fusionBond));
}

export function sanitizeFusedRingJunctionStereochemistry<T extends GeneratedMolecule>(source: T): T {
  if (!source.fusedRingJunctionStereo || isValidFusedRingJunctionStereo(source)) return source;
  const { fusedRingJunctionStereo: _invalid, ...rest } = source;
  return rest as T;
}

export type ImportedDecalinJunctionResult =
  | { status: "not-decalin" }
  | { status: "supported"; configuration: FusedJunctionConfiguration; fusionAtomIndices: [number, number] }
  | { status: "unsupported"; error: string };

/** Classifies the relative fusion using OpenChemLib's canonical stereo graph.
 * Its lowercase pseudoasymmetric junction parities are never cast to R/S. */
export function classifyImportedDecalinJunction(molecule: OCLMolecule): ImportedDecalinJunctionResult {
  try {
    molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
    const heavy = Array.from({ length: molecule.getAllAtoms() }, (_, index) => index)
      .filter(index => molecule.getAtomicNo(index) !== 1);
    if (heavy.length !== 10 || heavy.some(index => molecule.getAtomicNo(index) !== 6 || molecule.getAtomCharge(index) !== 0)
      || molecule.getMolecularFormula().formula !== "C10H18") return { status: "not-decalin" };
    const heavySet = new Set(heavy), heavyBonds: number[] = [];
    for (let index = 0; index < molecule.getAllBonds(); index += 1) {
      const a = molecule.getBondAtom(0, index), b = molecule.getBondAtom(1, index);
      if (heavySet.has(a) && heavySet.has(b)) {
        if (molecule.getBondOrder(index) !== 1) return { status: "not-decalin" };
        heavyBonds.push(index);
      } else if (heavySet.has(a) !== heavySet.has(b)) {
        const hydrogen = heavySet.has(a) ? b : a;
        if (molecule.getAtomicNo(hydrogen) !== 1 || molecule.getBondOrder(index) !== 1) return { status: "not-decalin" };
      } else if (!heavySet.has(a) && !heavySet.has(b)) return { status: "not-decalin" };
    }
    if (heavyBonds.length !== 11) return { status: "not-decalin" };
    const ringSet = molecule.getRingSet();
    if (ringSet.getSize() !== 2) return { status: "not-decalin" };
    const rings = Array.from({ length: 2 }, (_, index) => Array.from(ringSet.getRingAtoms(index)));
    if (rings.some(ring => ring.length !== 6 || ring.some(index => !heavySet.has(index)))) return { status: "not-decalin" };
    const right = new Set(rings[1]!);
    const fusionAtomIndices = rings[0]!.filter(index => right.has(index)).sort((a, b) => a - b);
    if (fusionAtomIndices.length !== 2) return { status: "not-decalin" };

    const assigned = fusionAtomIndices.map(index => {
      const parity = molecule.getAtomParity(index);
      return parity === OCLMolecule.cAtomParity1 || parity === OCLMolecule.cAtomParity2;
    });
    if (!assigned.some(Boolean)) {
      return { status: "supported", configuration: "unspecified", fusionAtomIndices: fusionAtomIndices as [number, number] };
    }
    if (!assigned.every(Boolean)) {
      return { status: "unsupported", error: "La configuración de la unión fusionada está especificada solo de forma parcial; no se importó." };
    }
    const identity = CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL);
    if (identity === referenceIdCodes.cis) {
      return { status: "supported", configuration: "cis", fusionAtomIndices: fusionAtomIndices as [number, number] };
    }
    if (identity === referenceIdCodes.trans) {
      return { status: "supported", configuration: "trans", fusionAtomIndices: fusionAtomIndices as [number, number] };
    }
    return { status: "unsupported", error: "La configuración explícita de la unión no coincide con las referencias verificadas de cis/trans-decalina." };
  } catch {
    return { status: "unsupported", error: "No se pudo verificar la configuración de la unión fusionada; no se importó como estereoquímica especificada." };
  }
}

export function fusedRingJunctionStereoFromFusion(
  graph: GeneratedMolecule,
  configuration: FusedJunctionConfiguration,
): FusedRingJunctionStereo | null {
  const fusion = findExactDecalinFusion(graph);
  return fusion ? { system: "decalin", fusionAtomIds: [...fusion.fusionAtomIds],
    fusionBond: [...fusion.fusionBond], configuration } : null;
}
