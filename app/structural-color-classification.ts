import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";

export type StructuralColorCategory = "parent" | "substituent" | "unclassified";

export function structuralBondKey(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Builds permanent canvas colours only from graph IDs and a FULL derivation.
 * Parent/suffix atoms and edges form one region; every validated substituent
 * component (including nested children and explicitly assigned join bonds)
 * contributes to the substituent region. Shared atoms resolve to parent. */
export function classifyValidatedStructureColors(
  molecule: GeneratedMolecule,
  derivation: ValidatedNameDerivation | null | undefined,
) {
  if (!derivation) return null;
  const graphAtomIds = new Set(molecule.atoms.map(atom => atom.id));
  const graphBonds = new Set(molecule.bonds.map(([a, b]) => structuralBondKey(a, b)));
  const parentAtoms = new Set<number>();
  const substituentAtoms = new Set<number>();
  const parentBonds = new Set<string>();
  const substituentBonds = new Set<string>();
  const componentsById = new Map(derivation.components.map(component => [component.id, component]));
  const belongsToSubstituent = (component: ValidatedNameDerivation["components"][number]) => {
    let current = component;
    const visited = new Set<string>();
    while (current.parentId) {
      if (visited.has(current.id)) return false;
      visited.add(current.id);
      if (current.parentId === "parent") return component.role === "substituent" || component.role === "prefix";
      if (current.parentId === "suffix") return false;
      const parent = componentsById.get(current.parentId);
      if (!parent) return false;
      current = parent;
    }
    return current.role === "substituent" || current.role === "prefix";
  };

  for (const component of derivation.components) {
    const isParentRegion = component.id === "parent" || component.id === "suffix";
    const isSubstituentRegion = !isParentRegion && belongsToSubstituent(component);
    if (!isParentRegion && !isSubstituentRegion) continue;
    const atomTarget = isParentRegion ? parentAtoms : substituentAtoms;
    const bondTarget = isParentRegion ? parentBonds : substituentBonds;
    for (const id of component.atomIds) if (graphAtomIds.has(id)) atomTarget.add(id);
    for (const [a, b] of component.bondIds) {
      const key = structuralBondKey(a, b);
      if (graphBonds.has(key)) bondTarget.add(key);
    }
  }

  const atoms = new Map<number, StructuralColorCategory>();
  for (const atom of molecule.atoms) {
    atoms.set(atom.id, parentAtoms.has(atom.id) ? "parent"
      : substituentAtoms.has(atom.id) ? "substituent" : "unclassified");
  }
  const bonds = new Map<string, StructuralColorCategory>();
  for (const [a, b] of molecule.bonds) {
    const key = structuralBondKey(a, b);
    bonds.set(key, parentBonds.has(key) ? "parent"
      : substituentBonds.has(key) ? "substituent" : "unclassified");
  }
  return { atoms, bonds };
}
