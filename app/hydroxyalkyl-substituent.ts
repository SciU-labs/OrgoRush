import type { GeneratedMolecule, GeneratedBond } from './name-to-molecule';

type DetectedGroup = { id: string; kind: string; carbonId: number; heteroAtomId: number };

/** Shared evidence for a saturated, unbranched monofunctional substituent. */
type LinearFunctionalizedAlkyl = {
  parentAtomId: number;
  rootAtomId: number;
  attachmentOrder: 1;
  atomIds: number[];
  bonds: GeneratedBond[];
  carbonPath: number[];
  numbering: [number, number][];
  internalBranches: [];
  stereo: 'no-explicit-configuration';
};

export type HydroxyalkylEvidence = LinearFunctionalizedAlkyl & {
  hydroxy: { groupId: string; carbonId: number; oxygenId: number; locant: number };
};

export type AminoalkylEvidence = LinearFunctionalizedAlkyl & {
  amino: { groupId: string; carbonId: number; nitrogenId: number; locant: number };
};

/** Returns evidence only when the entire detached branch is represented. */
function inspectLinearFunctionalizedAlkyl(
  molecule: GeneratedMolecule,
  parentPath: readonly number[],
  parentAtomId: number,
  rootAtomId: number,
  groups: readonly DetectedGroup[],
  kind: 'alcohol' | 'amine',
): (LinearFunctionalizedAlkyl & { functionGroup: { groupId: string; carbonId: number; heteroId: number; locant: number } }) | null {
  const element = kind === 'alcohol' ? 'O' : 'N';
  const parent = new Set(parentPath);
  const atoms = new Map(molecule.atoms.map(atom => [atom.id, atom]));
  if (!parent.has(parentAtomId) || parent.has(rootAtomId) || !atoms.has(rootAtomId)) return null;
  const adjacent = (id: number) => molecule.bonds.filter(([a,b]) => a === id || b === id);
  const other = (bond: GeneratedBond, id: number) => bond[0] === id ? bond[1] : bond[0];
  const attachments = adjacent(rootAtomId).filter(bond => other(bond,rootAtomId) === parentAtomId);
  if (attachments.length !== 1 || (attachments[0][2] ?? 1) !== 1 || attachments[0][3]) return null;
  if (atoms.get(parentAtomId)?.tetrahedralParity) return null;

  const ids = new Set<number>();
  const stack = [rootAtomId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    const atom = atoms.get(id);
    if (!atom || (atom.element && atom.element !== 'C' && atom.element !== element)
      || (atom.charge ?? 0) !== 0 || atom.tetrahedralParity || atom.tetrahedralBondTo) return null;
    ids.add(id);
    for (const bond of adjacent(id)) {
      if ((bond[2] ?? 1) !== 1 || bond[3]) return null;
      const next = other(bond,id);
      if (parent.has(next)) {
        if (id !== rootAtomId || next !== parentAtomId) return null;
      } else if (!ids.has(next)) stack.push(next);
    }
  }
  const bonds = molecule.bonds.filter(([a,b]) => ids.has(a) && ids.has(b));
  if (bonds.length !== ids.size - 1) return null;
  const heteroAtoms = [...ids].filter(id => atoms.get(id)?.element === element);
  // Neutral O with one bond represents OH; neutral N with one bond is a primary amine.
  if (heteroAtoms.length !== 1 || adjacent(heteroAtoms[0]).length !== 1) return null;
  const heteroId = heteroAtoms[0];
  const carbonId = other(adjacent(heteroId)[0],heteroId);
  const matchingGroups = groups.filter(group => group.kind === kind && group.carbonId === carbonId && group.heteroAtomId === heteroId);
  if (matchingGroups.length !== 1) return null;
  if (atoms.get(rootAtomId)?.element && atoms.get(rootAtomId)?.element !== 'C') return null;

  const carbonPath: number[] = [];
  let current: number | undefined = rootAtomId;
  let previous: number | undefined;
  while (current !== undefined) {
    carbonPath.push(current);
    const children: number[] = adjacent(current).map(bond => other(bond,current!))
      .filter(id => ids.has(id) && id !== previous && (atoms.get(id)?.element ?? 'C') === 'C');
    if (children.length > 1) return null;
    previous = current;
    current = children[0];
  }
  if (carbonPath.length !== ids.size - 1 || !carbonPath.includes(carbonId)) return null;
  return {
    parentAtomId, rootAtomId, attachmentOrder: 1,
    atomIds: [...carbonPath,heteroId], bonds: [attachments[0],...bonds].map(bond => [...bond] as GeneratedBond),
    carbonPath, numbering: carbonPath.map((id,index) => [id,index + 1]),
    functionGroup: { groupId: matchingGroups[0].id, carbonId, heteroId, locant: carbonPath.indexOf(carbonId) + 1 },
    internalBranches: [], stereo: 'no-explicit-configuration',
  };
}

export function inspectHydroxyalkyl(molecule: GeneratedMolecule, parentPath: readonly number[], parentAtomId: number,
  rootAtomId: number, groups: readonly DetectedGroup[]): HydroxyalkylEvidence | null {
  const result = inspectLinearFunctionalizedAlkyl(molecule,parentPath,parentAtomId,rootAtomId,groups,'alcohol');
  if (!result) return null;
  const { functionGroup, ...evidence } = result;
  return { ...evidence, hydroxy: { groupId:functionGroup.groupId, carbonId:functionGroup.carbonId,
    oxygenId:functionGroup.heteroId, locant:functionGroup.locant } };
}

export function inspectAminoalkyl(molecule: GeneratedMolecule, parentPath: readonly number[], parentAtomId: number,
  rootAtomId: number, groups: readonly DetectedGroup[]): AminoalkylEvidence | null {
  const result = inspectLinearFunctionalizedAlkyl(molecule,parentPath,parentAtomId,rootAtomId,groups,'amine');
  if (!result) return null;
  const { functionGroup, ...evidence } = result;
  return { ...evidence, amino: { groupId:functionGroup.groupId, carbonId:functionGroup.carbonId,
    nitrogenId:functionGroup.heteroId, locant:functionGroup.locant } };
}
