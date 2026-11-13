import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";

export type StructuralColorCategory = "parent" | "functional" | "substituent" | "unclassified";

export function structuralBondKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Builds permanent canvas colours only from graph IDs and a FULL derivation.
 * The verified suffix supplies functional atoms and bonds. Shared atoms retain
 * parent membership, while function takes visual priority over parent and
 * substituent. Substituent attachment edges remain part of the substituent. */
export function classifyValidatedStructureColors(
  molecule: GeneratedMolecule,
  derivation: ValidatedNameDerivation | null | undefined,
) {
  if (!derivation || derivation.status !== "FULL") return null;
  const graphAtomIds = new Set(molecule.atoms.map(atom => atom.id));
  const graphBonds = new Set(molecule.bonds.map(([a, b]) => structuralBondKey(a, b)));
  const parentAtoms = new Set<number>();
  const substituentAtoms = new Set<number>();
  const functionalAtoms = new Set<number>();
  const parentBonds = new Set<string>();
  const substituentBonds = new Set<string>();
  const functionalBonds = new Set<string>();
  for (const id of derivation.parentAtomIds) if (graphAtomIds.has(id)) parentAtoms.add(id);
  const componentsById = new Map(derivation.components.map(component => [component.id, component]));
  const belongsToSubstituent = (component: ValidatedNameDerivation["components"][number]) => {
    let current = component;
    const visited = new Set<string>();
    while (current.parentId) {
      if (visited.has(current.id)) return false;
      visited.add(current.id);
      if (current.parentId === "parent") return component.role === "substituent" || component.role === "prefix";
      if (current.parentId === "suffix") return component.role === "substituent" || component.role === "prefix";
      const parent = componentsById.get(current.parentId);
      if (!parent) return false;
      current = parent;
    }
    return current.role === "substituent" || current.role === "prefix";
  };

  for (const component of derivation.components) {
    const isFunctionalRegion = component.role === "suffix" && derivation.principalGroup !== "none";
    const isParentRegion = component.id === "parent";
    const isSubstituentRegion = !isParentRegion && !isFunctionalRegion && belongsToSubstituent(component);
    if (!isParentRegion && !isFunctionalRegion && !isSubstituentRegion) continue;
    const atomTarget = isFunctionalRegion ? functionalAtoms : isParentRegion ? parentAtoms : substituentAtoms;
    const bondTarget = isFunctionalRegion ? functionalBonds : isParentRegion ? parentBonds : substituentBonds;
    for (const id of component.atomIds) if (graphAtomIds.has(id)) atomTarget.add(id);
    for (const [a, b] of component.bondIds) {
      const key = structuralBondKey(a, b);
      if (graphBonds.has(key)) bondTarget.add(key);
    }
  }

  const atoms = new Map<number, StructuralColorCategory>();
  for (const atom of molecule.atoms) {
    atoms.set(atom.id, functionalAtoms.has(atom.id) ? "functional" : parentAtoms.has(atom.id) ? "parent"
      : substituentAtoms.has(atom.id) ? "substituent" : "unclassified");
  }
  const bonds = new Map<string, StructuralColorCategory>();
  for (const [a, b] of molecule.bonds) {
    const key = structuralBondKey(a, b);
    bonds.set(key, functionalBonds.has(key) ? "functional" : parentBonds.has(key) ? "parent"
      : substituentBonds.has(key) ? "substituent" : "unclassified");
  }
  return { atoms, bonds, membership: { parentAtoms, parentBonds, functionalAtoms, functionalBonds, substituentAtoms, substituentBonds } };
}
