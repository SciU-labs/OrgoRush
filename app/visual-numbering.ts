import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";

export type BranchCountingGuide = {
  componentId: string;
  equivalenceGroup?: string;
  atomIds: number[];
  bondIds: [number, number][];
  /** Prime marks distinguish pedagogical branch counts from parent locants. */
  locants: [number, string][];
};

/** Number a verified, unbranched N-alkyl region from its N attachment.
 * Counts are a visual aid; they do not add locants to the active name. */
export function buildBranchCountingGuides(molecule: GeneratedMolecule,
  derivation: ValidatedNameDerivation | null | undefined): BranchCountingGuide[] {
  if (!derivation || derivation.status !== "FULL") return [];
  const atoms = new Map(molecule.atoms.map(atom => [atom.id, atom]));
  return derivation.components.flatMap(component => {
    if (component.attachmentScope !== "amide-nitrogen" || !component.atomIds.length
      || component.atomIds.some(id => !atoms.has(id) || (atoms.get(id)?.element ?? "C") !== "C")) return [];
    const nitrogen = component.numbering.find(([, locant]) => locant === "N")?.[0];
    if (nitrogen === undefined || atoms.get(nitrogen)?.element !== "N") return [];
    const members = new Set(component.atomIds);
    const edges = molecule.bonds.filter(([a,b]) => members.has(a) && members.has(b));
    const attachment = molecule.bonds.filter(([a,b]) => a === nitrogen && members.has(b) || b === nitrogen && members.has(a));
    if (attachment.length !== 1 || attachment[0][2] !== 1 || edges.length !== members.size - 1
      || edges.some(([, ,order]) => order !== 1)) return [];
    const root = attachment[0][0] === nitrogen ? attachment[0][1] : attachment[0][0];
    const path = [root]; let previous = nitrogen, current = root;
    while (path.length < members.size) {
      const next = edges.flatMap(([a,b]) => a === current && b !== previous ? [b] : b === current && a !== previous ? [a] : []);
      if (next.length !== 1 || path.includes(next[0])) return [];
      previous = current; current = next[0]; path.push(current);
    }
    if (edges.some(([a,b]) => Math.abs(path.indexOf(a)-path.indexOf(b)) !== 1)) return [];
    return [{componentId:component.id,equivalenceGroup:component.equivalenceGroup,atomIds:path,
      bondIds:component.bondIds,locants:path.map((id,index):[number,string]=>[id,`${index+1}′`])}];
  });
}

/**
 * Expands verified locants around a six-carbon aromatic parent ring only when
 * its topology and all explicitly named positions determine one orientation.
 * Ambiguous or incomplete evidence keeps only the supported visual anchors;
 * the derivation's complete internal numbering is never changed.
 */
export function buildValidatedVisualNumbering(
  molecule: GeneratedMolecule,
  derivation: ValidatedNameDerivation | null | undefined,
): ReadonlyMap<number, number | string> {
  const parent = derivation?.components.find(component => component.role === "parent");
  const retainedAromatic = derivation?.evidence?.construction === "retained-aromatic"
    || derivation?.evidence?.construction === "aromatic-ester";
  const equivalentOrientations = retainedAromatic && derivation?.evidence?.numbering.comparison === 0;
  const equivalentMonocycle = derivation?.evidence?.construction === "functional-monocycle"
    && derivation.evidence.numbering.comparison === 0;
  if (equivalentMonocycle && parent) {
    const ring = molecule.rings?.find(candidate => candidate.atomIds.length === parent.atomIds.length
      && candidate.atomIds.every(id => parent.atomIds.includes(id)));
    if (ring) {
      const size = ring.atomIds.length;
      return new Map(parent.numbering.filter(([id, locant]) => ring.atomIds.includes(id)
        && typeof locant === "number" && (locant === 1 || size % 2 === 0 && locant === size / 2 + 1)));
    }
  }
  // Compositional parents carry all six internal locants for reconstruction.
  // Only implicit C1 and written parent locants constrain the visual direction.
  // Legacy derivations already store their explicit anchors in parent.numbering.
  const visualAnchors = retainedAromatic && parent?.writtenLocants !== undefined
    ? parent.numbering.filter(([id, locant]) => locant === 1
      || (!equivalentOrientations || locant === 4)
        && parent.writtenLocants!.some(written => written.atomId === id && written.locant === locant))
    : parent?.numbering ?? [];
  const numbering = new Map<number, number | string>(visualAnchors);
  if (!parent || !molecule.rings?.length) return numbering;

  const anchors = visualAnchors.filter(([id, locant]) => typeof locant === "number"
    && Number.isInteger(locant) && locant >= 1 && locant <= 6);
  if (!anchors.some(([, locant]) => locant === 1)) return numbering;
  const parentAtoms = new Set(parent.atomIds);
  const atoms = new Map(molecule.atoms.map(atom => [atom.id, atom]));
  const suffixAtoms = new Set(derivation?.components.find(component => component.role === "suffix")?.atomIds ?? []);
  const candidates = molecule.rings.filter(ring => ring.kind === "aromatic"
    && ring.atomIds.length === 6
    && new Set(ring.atomIds).size === 6
    && ring.atomIds.every(id => parentAtoms.has(id) && (atoms.get(id)?.element ?? "C") === "C")
    && anchors.every(([id]) => ring.atomIds.includes(id))
    && parent.atomIds.filter(id => !ring.atomIds.includes(id)).every(id => suffixAtoms.has(id)));
  if (candidates.length !== 1) return numbering;

  const ringAtoms = new Set(candidates[0].atomIds);
  const ringEdges = molecule.bonds.filter(([a, b]) => ringAtoms.has(a) && ringAtoms.has(b));
  if (ringEdges.length !== 6) return numbering;
  const adjacency = new Map<number, number[]>([...ringAtoms].map(id => [id, []]));
  for (const [a, b] of ringEdges) {
    if (a === b || adjacency.get(a)?.includes(b) || adjacency.get(b)?.includes(a)) return numbering;
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
  }
  if ([...adjacency.values()].some(neighbors => neighbors.length !== 2)) return numbering;

  const start = anchors.find(([, locant]) => locant === 1)![0];
  const cycles: number[][] = [];
  for (const first of adjacency.get(start) ?? []) {
    const path = [start, first];
    let previous = start, current = first;
    while (path.length < 6) {
      const next = (adjacency.get(current) ?? []).filter(id => id !== previous && !path.includes(id));
      if (next.length !== 1) break;
      previous = current;
      current = next[0];
      path.push(current);
    }
    if (path.length === 6 && (adjacency.get(path[5]) ?? []).includes(start)) cycles.push(path);
  }
  const matching = cycles.filter(path => anchors.every(([id, locant]) => path[Number(locant) - 1] === id));
  if (matching.length !== 1) return numbering;
  matching[0].forEach((id, index) => numbering.set(id, index + 1));
  return numbering;
}
