import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";

/**
 * Expands verified locants around a six-carbon aromatic parent ring only when
 * its topology and all explicitly named positions determine one orientation.
 * Ambiguous or incomplete evidence leaves the FULL locants untouched.
 */
export function buildValidatedVisualNumbering(
  molecule: GeneratedMolecule,
  derivation: ValidatedNameDerivation | null | undefined,
): ReadonlyMap<number, number | string> {
  const parent = derivation?.components.find(component => component.role === "parent");
  const numbering = new Map<number, number | string>(parent?.numbering ?? []);
  if (!parent || !molecule.rings?.length) return numbering;

  const anchors = parent.numbering.filter(([id, locant]) => typeof locant === "number"
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
