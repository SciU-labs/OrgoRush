/** Structural scope: one neutral benzene ring, one methyl and one parent bond. */
export type MonomethylPhenyl = {
  kind: "monomethylphenyl";
  attachmentAtomId: number;
  parentAttachmentAtomId: number;
  /** C1 is the attachment atom; array indices supply the independent ring locants. */
  ringAtomIds: number[];
  methyl: { atomId: number; ringAtomId: number; locant: 2 | 3 | 4 };
  atomIds: number[];
  bondIds: [number, number][];
};

type Ring = { kind: string; atomIds: readonly number[] };
type Graph = {
  atoms: readonly { id: number; element?: string; charge?: number }[];
  bonds: readonly (readonly [number, number, number?])[];
  rings?: readonly Ring[];
};

/** No text parsing: reject every external branch except the terminal methyl. */
export function describeMonomethylPhenyl(graph: Graph, ring: Ring, parentAtomIds: readonly number[]): MonomethylPhenyl | undefined {
  const ringSet = new Set(ring.atomIds), parent = new Set(parentAtomIds);
  const carbon = (id: number) => graph.atoms.some((atom) => atom.id === id
    && (atom.element ?? "C") === "C" && !atom.charge);
  if (ring.kind !== "aromatic" || ringSet.size !== 6 || ring.atomIds.length !== 6
    || ring.atomIds.some((id) => parent.has(id) || !carbon(id))
    || graph.rings?.some((other) => !(other.atomIds.length === 6 && other.atomIds.every((id) => ringSet.has(id)))
      && other.atomIds.some((id) => ringSet.has(id)))) return;
  const ringBonds = graph.bonds.filter(([a, b]) => ringSet.has(a) && ringSet.has(b));
  if (ringBonds.length !== 6 || ringBonds.some(([, , order = 1]) => order !== 1 && order !== 2)) return;
  const neighbors = (id: number) => ringBonds.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : []);
  if (ring.atomIds.some((id) => neighbors(id).length !== 2
    || ringBonds.filter(([a, b, order]) => (a === id || b === id) && order === 2).length !== 1)) return;
  const external = graph.bonds.flatMap(([a, b, order = 1]) => ringSet.has(a) !== ringSet.has(b)
    ? [{ ringId: ringSet.has(a) ? a : b, outsideId: ringSet.has(a) ? b : a, order }] : []);
  const attachments = external.filter(({ outsideId }) => parent.has(outsideId));
  const branches = external.filter(({ outsideId }) => !parent.has(outsideId));
  if (attachments.length !== 1 || branches.length !== 1 || external.some(({ order }) => order !== 1)) return;
  const attachment = attachments[0], methyl = branches[0];
  if (!carbon(methyl.outsideId) || graph.bonds.filter(([a, b]) => a === methyl.outsideId || b === methyl.outsideId).length !== 1) return;
  const paths = neighbors(attachment.ringId).flatMap((first) => {
    const path = [attachment.ringId, first];
    while (path.length < 6) {
      const next = neighbors(path.at(-1)!).find((id) => id !== path.at(-2));
      if (next === undefined || path.includes(next)) return [];
      path.push(next);
    }
    return neighbors(path.at(-1)!).includes(path[0]) ? [path] : [];
  }).sort((a, b) => a.indexOf(methyl.ringId) - b.indexOf(methyl.ringId)
    || a.join(",").localeCompare(b.join(",")));
  const path = paths[0];
  const locant = path ? path.indexOf(methyl.ringId) + 1 : 0;
  if (locant !== 2 && locant !== 3 && locant !== 4) return;
  const atomIds = [...path, methyl.outsideId];
  return { kind: "monomethylphenyl", attachmentAtomId: attachment.ringId,
    parentAttachmentAtomId: attachment.outsideId, ringAtomIds: path,
    methyl: { atomId: methyl.outsideId, ringAtomId: methyl.ringId, locant }, atomIds,
    bondIds: [...path.map((id, index): [number, number] => [id, path[(index + 1) % 6]]), [methyl.ringId, methyl.outsideId]] };
}

export const monomethylPhenylNameEs = (aryl: MonomethylPhenyl) => `${aryl.methyl.locant}-metilfenil`;
