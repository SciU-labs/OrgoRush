import { Molecule as OCLMolecule } from "openchemlib";
import { recognizeRingTopology, type RingGraph } from "./fused-topology.ts";

type Ring = { id: number; kind: "aromatic" | "cycloalkane"; atomIds: number[] };
const atomicNumbers: Record<string, number> = { C: 6, N: 7, O: 8, S: 16, F: 9, Cl: 17, Br: 35, I: 53 };
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
const cache = new Map<string, { topology: ReturnType<typeof recognizeRingTopology>; rings: Ring[] }>();

/** Naming uses bonds as authority; canvas ring records are only traversal hints. */
export function perceiveNamingRings<T extends RingGraph & { rings?: Ring[] }>(graph: T): {
  molecule: T; topology: ReturnType<typeof recognizeRingTopology>;
} {
  const signature = JSON.stringify([graph.atoms.map(a => [a.id, a.element ?? "C", a.charge ?? 0]),
  graph.bonds.map(([a, b, o = 1]) => [a, b, o])]);
  let result = cache.get(signature);
  if (!result) {
    const topology = recognizeRingTopology(graph);
    let rings: Ring[] = [];
    if (topology.cycles.length && topology.kind !== "invalid" && !topology.reason
      && graph.atoms.every(a => atomicNumbers[a.element ?? "C"])) {
      const mol = new OCLMolecule(0, 0), indices = new Map<number, number>(), bonds = new Map<string, number>();
      for (const a of graph.atoms) {
        const index = mol.addAtom(atomicNumbers[a.element ?? "C"]); indices.set(a.id, index);
        mol.setAtomCharge(index, a.charge ?? 0);
      }
      for (const [a, b, o = 1] of graph.bonds) {
        const index = mol.addBond(indices.get(a)!, indices.get(b)!); mol.setBondOrder(index, o);
        bonds.set(edgeKey(a, b), index);
      }
      mol.setFragment(false);
      mol.ensureHelperArrays(OCLMolecule.cHelperRings);
      rings = topology.cycles.map((atomIds, i) => ({        
id: i + 1, atomIds: [...atomIds],
        kind: atomIds.every((a, j) => mol.isAromaticBond(bonds.get(edgeKey(a, atomIds[(j + 1) % atomIds.length]))!))
          ? "aromatic" : "cycloalkane"
      }));
    }
    result = { topology, rings };
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(signature, result);
  }
  // Preserve a valid editor traversal for existing tie-breaks, but never its
  // aromatic flag or an incomplete/stale cycle list.
  const sameCycle = (a: number[], b: number[]) => a.length === b.length && a.every(id => b.includes(id))
    && a.every((id, i) => graph.bonds.some(([x, y]) => edgeKey(x, y) === edgeKey(id, a[(i + 1) % a.length])));
  const stored = graph.rings;
  const complete = stored?.length === result.rings.length && new Set(stored.map(r => r.atomIds.slice().sort((a, b) => a - b).join(":"))).size === stored.length
    && stored.every(r => result!.rings.some(p => sameCycle(r.atomIds, p.atomIds)));
  const rings = complete ? stored!.map(r => ({ ...r, kind: result!.rings.find(p => sameCycle(r.atomIds, p.atomIds))!.kind })) : result.rings;
  return { topology: result.topology, molecule: { ...graph, rings: rings.map(r => ({ ...r, atomIds: [...r.atomIds] })) } };
}
