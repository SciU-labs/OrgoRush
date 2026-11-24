import type { GeneratedMolecule, GeneratedRing } from "./name-to-molecule.ts";
import { CanonizerUtil, Molecule as OCLMolecule, SmilesParser } from "openchemlib";

export type FusedTricyclicTopology = "linear" | "angular";
export type FusionSpecification = "unspecified" | "partial" | "complete";
export type FusionRelation = "cis" | "trans" | "unspecified" | "unresolved";

export type FusedTricyclicJunction = {
  /** The two atoms and their shared bond are graph identities, not drawing positions. */
  fusionAtomIds: [number, number];
  fusionBond: [number, number];
  ringIds: [number, number];
  /** Null until the local relationship has been derived from validated stereo. */
  relation: FusionRelation;
};

export type FusedTricyclicStereochemistry = {
  system: "saturated-fused-tricyclic-6-6-6";
  topology: FusedTricyclicTopology;
  specification: FusionSpecification;
  junctions: [FusedTricyclicJunction, FusedTricyclicJunction];
  /** Editable CIP assignments at the four fusion atoms; source SMILES also preserves non-CIP stereo. */
  fusionAtomStereo: { atomId: number; parity: "R" | "S" | null }[];
  /** OpenChemLib canonical stereo identity of the imported full graph. */
  identityCode: string;
  /** Canonical nonstereo graph identity; geometry and atom order do not affect it. */
  connectivityCode: string;
  /** Original isomeric representation is retained so partial/pseudo stereo can round-trip. */
  sourceSmiles: string;
};

export type FusedTricyclicFusion = {
  topology: FusedTricyclicTopology;
  ringIds: [number, number, number];
  centralRingId: number;
  junctions: [FusedTricyclicJunction, FusedTricyclicJunction];
};

const edgeKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

function canonicalIdentity(molecule: OCLMolecule, includeStereo: boolean): string {
  const copy = new OCLMolecule(molecule.getAllAtoms(), molecule.getAllBonds());
  molecule.copyMolecule(copy);
  copy.removeExplicitHydrogens();
  copy.ensureHelperArrays(OCLMolecule.cHelperCIP);
  return CanonizerUtil.getIDCode(copy, includeStereo ? CanonizerUtil.NORMAL : CanonizerUtil.NOSTEREO);
}

function connectivityIdentity(graph: GeneratedMolecule): string | null {
  try {
    const molecule = new OCLMolecule(graph.atoms.length, graph.bonds.length);
    const byId = new Map<number, number>();
    for (const atom of graph.atoms) byId.set(atom.id, molecule.addAtom(6));
    for (const [a,b,order=1] of graph.bonds) {
      if (order !== 1 || !byId.has(a) || !byId.has(b)) return null;
      molecule.addBond(byId.get(a)!, byId.get(b)!);
    }
    molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
    return CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL);
  } catch { return null; }
}

/** Build atom-ID-linked stereo metadata only after the full isomeric graph is validated. */
export function fusedTricyclicStereochemistryFromImported(
  molecule: OCLMolecule,
  graph: GeneratedMolecule,
  atomIndexToId: ReadonlyMap<number, number>,
  sourceSmiles: string,
): FusedTricyclicStereochemistry | null {
  try {
    molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
    const fusion = findSaturatedFusedTricycle(graph);
    if (!fusion || molecule.getMolecularFormula().formula !== "C14H24") return null;
    const fusionIds = new Set(fusion.junctions.flatMap(junction => junction.fusionAtomIds));
    const idToIndex = new Map([...atomIndexToId].map(([index, id]) => [id, index]));
    if (fusionIds.size !== 4 || [...fusionIds].some(id => !idToIndex.has(id))) return null;
    const configured = [...fusionIds].filter(id => {
      const parity = molecule.getAtomParity(idToIndex.get(id)!);
      return parity === OCLMolecule.cAtomParity1 || parity === OCLMolecule.cAtomParity2;
    }).length;
    const specification: FusionSpecification = configured === 4 ? "complete" : configured === 0 ? "unspecified" : "partial";
    const identityCode = canonicalIdentity(molecule, true);
    const connectivityCode = canonicalIdentity(molecule, false);
    if (!identityCode || !connectivityCode || connectivityIdentity(graph) !== connectivityCode) return null;
    const junctions = fusion.junctions.map(junction => ({ ...junction,
      relation: specification === "unspecified" ? "unspecified" as const : "unresolved" as const,
    })) as [FusedTricyclicJunction, FusedTricyclicJunction];
    const fusionAtomStereo=[...fusionIds].sort((a,b)=>a-b).map(atomId=>({atomId,
      parity:graph.atoms.find(atom=>atom.id===atomId)?.tetrahedralParity??null}));
    return {system:"saturated-fused-tricyclic-6-6-6",topology:fusion.topology,specification,junctions,
      fusionAtomStereo,identityCode,connectivityCode,sourceSmiles};
  } catch { return null; }
}

function actualCycle(ring: GeneratedRing, edges: Set<string>, atoms: Set<number>): boolean {
  const ids = ring.atomIds;
  if (ids.length !== 6 || new Set(ids).size !== 6 || ids.some(id => !atoms.has(id))) return false;
  return ids.every((id, index) => edges.has(edgeKey(id, ids[(index + 1) % ids.length]!)));
}

/**
 * Recognizes only an unsubstituted C14H24 fused tricycle with three genuine
 * six-membered cycles. It validates the actual ring edges and fusion path,
 * then distinguishes topology from the placement of the two shared edges in
 * the middle cycle. Coordinates and OCL's cycle ordering do not determine it.
 */
export function findSaturatedFusedTricycle(graph: GeneratedMolecule): FusedTricyclicFusion | null {
  const rings = graph.rings ?? [];
  if (graph.atoms.length !== 14 || graph.bonds.length !== 16 || rings.length !== 3) return null;
  if (graph.atoms.some(atom => (atom.element ?? "C") !== "C" || (atom.charge ?? 0) !== 0)) return null;
  if (graph.bonds.some(([, , order]) => (order ?? 1) !== 1)) return null;
  const atoms = new Set(graph.atoms.map(atom => atom.id));
  const edges = new Set(graph.bonds.map(([a, b]) => edgeKey(a, b)));
  if (edges.size !== 16 || rings.some(ring => ring.kind !== "cycloalkane" || !actualCycle(ring, edges, atoms))) return null;
  const covered = new Set(rings.flatMap(ring => ring.atomIds));
  if (covered.size !== 14 || [...atoms].some(id => !covered.has(id))) return null;

  const degree = new Map([...atoms].map(id => [id, 0]));
  for (const [a, b] of graph.bonds) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  if ([...degree.values()].filter(value => value === 3).length !== 4
    || [...degree.values()].some(value => value !== 2 && value !== 3)) return null;

  const shared: Array<{ left: number; right: number; atoms: [number, number] }> = [];
  for (let left = 0; left < rings.length; left += 1) for (let right = left + 1; right < rings.length; right += 1) {
    const a = rings[left]!, b = rings[right]!;
    const overlap = a.atomIds.filter(id => b.atomIds.includes(id)).sort((x, y) => x - y);
    if (!overlap.length) continue;
    if (overlap.length !== 2 || !edges.has(edgeKey(overlap[0]!, overlap[1]!))) return null;
    shared.push({ left, right, atoms: [overlap[0]!, overlap[1]!] });
  }
  if (shared.length !== 2 || new Set(shared.flatMap(item => [item.left, item.right])).size !== 3) return null;
  const ringDegree = rings.map((_, index) => shared.filter(item => item.left === index || item.right === index).length);
  const centralIndex = ringDegree.indexOf(2);
  if (centralIndex < 0 || ringDegree.filter(value => value === 1).length !== 2) return null;
  const middle = rings[centralIndex]!;
  const fusionEdgeIndices = shared.map(item => {
    const fusion = new Set(item.atoms);
    const index = middle.atomIds.findIndex((id, i) => fusion.has(id) && fusion.has(middle.atomIds[(i + 1) % 6]!));
    return index;
  });
  if (fusionEdgeIndices.some(index => index < 0)) return null;
  const distance = Math.abs(fusionEdgeIndices[0]! - fusionEdgeIndices[1]!);
  const ringEdgeDistance = Math.min(distance, 6 - distance);
  const topology: FusedTricyclicTopology = ringEdgeDistance === 3 ? "linear"
    : ringEdgeDistance === 2 ? "angular" : null as never;
  if (!topology) return null;
  const ordered = shared.map(item => ({
    fusionAtomIds: [...item.atoms] as [number, number],
    fusionBond: [...item.atoms] as [number, number],
    ringIds: [rings[item.left]!.id, rings[item.right]!.id] as [number, number],
    relation: "unresolved" as const,
  }));
  return {
    topology,
    ringIds: rings.map(ring => ring.id) as [number, number, number],
    centralRingId: middle.id,
    junctions: ordered as [FusedTricyclicJunction, FusedTricyclicJunction],
  };
}

export function isValidFusedTricyclicStereochemistry(graph: GeneratedMolecule): boolean {
  const metadata = graph.fusedRingSystemStereo;
  if (!metadata) return true;
  try {
    if (metadata.system !== "saturated-fused-tricyclic-6-6-6"
      || !["linear", "angular"].includes(metadata.topology)
      || !["unspecified", "partial", "complete"].includes(metadata.specification)
      || !Array.isArray(metadata.junctions) || metadata.junctions.length !== 2
      || !Array.isArray(metadata.fusionAtomStereo) || metadata.fusionAtomStereo.length !== 4
      || metadata.fusionAtomStereo.some(center=>!center||!Number.isSafeInteger(center.atomId)
        || !(center.parity===null||center.parity==="R"||center.parity==="S"))
      || typeof metadata.identityCode !== "string" || !metadata.identityCode
      || typeof metadata.connectivityCode !== "string" || !metadata.connectivityCode
      || typeof metadata.sourceSmiles !== "string" || !metadata.sourceSmiles) return false;
    if (metadata.junctions.some(junction => !junction || !Array.isArray(junction.fusionAtomIds)
      || junction.fusionAtomIds.length !== 2 || !junction.fusionAtomIds.every(Number.isSafeInteger)
      || !Array.isArray(junction.fusionBond) || junction.fusionBond.length !== 2
      || !junction.fusionBond.every(Number.isSafeInteger)
      || !Array.isArray(junction.ringIds) || junction.ringIds.length !== 2
      || !junction.ringIds.every(Number.isSafeInteger)
      || !["cis", "trans", "unspecified", "unresolved"].includes(junction.relation))) return false;
    let parsed: OCLMolecule;
    parsed = new SmilesParser().parseMolecule(metadata.sourceSmiles);
    parsed.ensureHelperArrays(OCLMolecule.cHelperCIP);
    if (metadata.identityCode !== canonicalIdentity(parsed, true)
      || metadata.connectivityCode !== canonicalIdentity(parsed, false)
      || metadata.connectivityCode !== connectivityIdentity(graph)) return false;
    const fusion = findSaturatedFusedTricycle(graph);
    if (!fusion || fusion.topology !== metadata.topology) return false;
    const relationExpected=metadata.specification==="unspecified"?"unspecified":"unresolved";
    if(metadata.junctions.some(junction=>junction.relation!==relationExpected))return false;
    const currentAtomStereo=[...new Set(fusion.junctions.flatMap(junction=>junction.fusionAtomIds))].sort((a,b)=>a-b)
      .map(atomId=>({atomId,parity:graph.atoms.find(atom=>atom.id===atomId)?.tetrahedralParity??null}));
    if(JSON.stringify(currentAtomStereo)!==JSON.stringify(metadata.fusionAtomStereo))return false;
    const key = (junction: FusedTricyclicJunction) => [
      [...junction.fusionAtomIds].sort((a,b) => a-b).join(","),
      edgeKey(...junction.fusionBond),
      [...junction.ringIds].sort((a,b) => a-b).join(","),
    ].join("|");
    if (fusion.junctions.map(key).sort().join(";") !== metadata.junctions.map(key).sort().join(";")) return false;
    const parsedParity = Array.from({length: parsed.getAllAtoms()}, (_, index) => parsed.getAtomParity(index))
      .filter(parity => parity === OCLMolecule.cAtomParity1 || parity === OCLMolecule.cAtomParity2).length;
    const expected: FusionSpecification = parsedParity === 0 ? "unspecified"
      : parsedParity === 4 ? "complete" : "partial";
    return expected === metadata.specification;
  } catch { return false; }
}

/** Compares complete global stereo identity, including symmetry equivalence. */
export function sameFusedTricyclicStereoIdentity(left: GeneratedMolecule, right: GeneratedMolecule): boolean {
  const a = left.fusedRingSystemStereo, b = right.fusedRingSystemStereo;
  return Boolean(a && b && isValidFusedTricyclicStereochemistry(left)
    && isValidFusedTricyclicStereochemistry(right)
    && a.topology === b.topology && a.specification === b.specification
    && a.connectivityCode === b.connectivityCode && a.identityCode === b.identityCode);
}

export function sanitizeFusedTricyclicStereochemistry<T extends GeneratedMolecule>(source: T): T {
  if (!source.fusedRingSystemStereo || isValidFusedTricyclicStereochemistry(source)) return source;
  const { fusedRingSystemStereo: _invalid, ...rest } = source;
  return rest as T;
}
