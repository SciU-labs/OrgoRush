import { recognizeRingTopology, type RingGraph, type TopologyResult } from "./fused-topology.ts";
import { buildZeroLengthBridgeVonBaeyerDescriptor } from "./fused-ring-nomenclature.ts";
import { englishIupacRoot, iupacRootForCarbonCount, IUPAC_ROOTS } from "./iupac-prefixes.ts";

type SaturatedGraph = {
  atoms: readonly (RingGraph["atoms"][number] & { tetrahedralParity?: string; tetrahedralBondTo?: number })[];
  bonds: RingGraph["bonds"];
};
const cyclePrefixes = ["", "", "bi", "tri", "tetra", "penta", "hexa", "hepta", "octa", "nona", "deca"];
export type SaturatedFused1979Result =
  | { status: "UNSUPPORTED"; reason: string; topology: TopologyResult }
  | { status: "SUPPORTED"; topology: TopologyResult; nameEs: string; nameEn: string;
      descriptor: string; numbering: number[]; numberingCandidates: number[][];
      mainRing: number[]; mainBridgeheads: [number, number]; branches: [number[], number[]];
      secondaryBridges: { bridgeheads: [number, number]; locants: [number, number] }[];
      rules: readonly string[] };

/** Bare saturated 5/6-membered ortho-fused systems with a Hamiltonian boundary.
 * Ring count is derived from connectivity, never from stored ring records.
 * A-32 admits these via von Baeyer, independently of retained aromatic names.
 */
export function nameSaturatedFused1979(graph: SaturatedGraph): SaturatedFused1979Result {
  const topology = recognizeRingTopology(graph);
  const unsupported = (reason: string): SaturatedFused1979Result => ({ status: "UNSUPPORTED", reason, topology });
  if (topology.kind !== "ortho-fused") return unsupported(topology.reason ?? topology.kind);
  if (graph.atoms.some((a) => (a.element ?? "C") !== "C" || (a.charge ?? 0) !== 0
    || a.tetrahedralParity !== undefined || a.tetrahedralBondTo !== undefined)
    || graph.bonds.some((b) => (b[2] ?? 1) !== 1 || b[3])) return unsupported("not-a-bare-saturated-constitutional-parent");
  if (topology.cycles.some((ring) => ![5, 6].includes(ring.length))) return unsupported("ring-size-outside-5-6-subset");
  const atomIds = graph.atoms.map((a) => a.id), cyclicIds = new Set(topology.cycles.flat());
  if (cyclicIds.size !== atomIds.length) return unsupported("external-substituents-outside-subset");
  const prefix = cyclePrefixes[topology.cycleRank], root = iupacRootForCarbonCount(atomIds.length);
  if (!prefix || !root) return unsupported("multiplicative-prefix-or-parent-root-outside-subset");
  const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const edgeCounts = new Map<string, { ends: [number, number]; count: number }>();
  for (const ring of topology.cycles) ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], edge = key(a, b), entry = edgeCounts.get(edge);
    edgeCounts.set(edge, { ends: [a, b], count: (entry?.count ?? 0) + 1 });
  });
  const boundaryAdjacency = new Map(atomIds.map((id) => [id, [] as number[]]));
  for (const { ends: [a, b], count } of edgeCounts.values()) {
    if (count > 2) return unsupported("non-ortho-fusion-edge");
    if (count === 1) { boundaryAdjacency.get(a)!.push(b); boundaryAdjacency.get(b)!.push(a); }
  }
  if ([...boundaryAdjacency.values()].some((neighbors) => neighbors.length !== 2)) return unsupported("no-hamiltonian-boundary");
  const mainRing = [atomIds[0]];
  while (mainRing.length < atomIds.length) {
    const next = boundaryAdjacency.get(mainRing[mainRing.length - 1])!.find((id) => !mainRing.includes(id));
    if (next === undefined) return unsupported("multiple-boundary-components");
    mainRing.push(next);
  }
  if (!boundaryAdjacency.get(mainRing[mainRing.length - 1])!.includes(mainRing[0])) return unsupported("open-boundary");
  const descriptor = buildZeroLengthBridgeVonBaeyerDescriptor(
    { atoms: graph.atoms.map((a) => ({ ...a })), bonds: graph.bonds.map(([a,b,order]) => [a,b,order]) },
    atomIds, topology.cycleRank - 1, mainRing,
  );
  if (!descriptor) return unsupported("no-zero-length-bridge-description");
  const candidate = descriptor.candidates[0];
  return { status: "SUPPORTED", topology,
    nameEs: `${prefix}ciclo${descriptor.descriptor}${root}ano`,
    nameEn: `${prefix}cyclo${descriptor.descriptor}${englishIupacRoot(root)}ane`,
    descriptor: descriptor.descriptor, numbering: descriptor.numbering,
    numberingCandidates: descriptor.numberingCandidates, mainRing: descriptor.mainRing,
    mainBridgeheads: descriptor.mainBridgeheads, branches: descriptor.branches,
    secondaryBridges: candidate.secondaryBridges,
    rules: topology.cycleRank === 2 ? ["A-31.1", "A-31.2"]
      : ["A-31.2", "A-32.11–13", "A-32.21–23", "A-32.31(a–d)"] };
}

/** Lexical validation, not graph admission. The analysis adapter supplies proof.
 * Preserve the old three-bicycle whitelist; this extends only higher polycycles.
 */
export function isSpanish1979SaturatedPolycyclicSpelling(name: string) {
  const match = /^(tri|tetra|penta|hexa|hepta|octa|nona|deca)ciclo\[(\d+)\.(\d+)\.0((?:\.0\^\{\d+,\d+\})+)\]([a-z]+)ano$/.exec(name);
  if (!match) return false;
  const [, prefix, first, second, secondary, root] = match;
  const rank = cyclePrefixes.indexOf(prefix), count = Number(first) + Number(second) + 2;
  if (Number(first) < Number(second) || Number(second) < 1 || IUPAC_ROOTS[count] !== root) return false;
  const pairs = [...secondary.matchAll(/\.0\^\{(\d+),(\d+)\}/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return pairs.length === rank - 2 && new Set(pairs.map((pair) => pair.join(","))).size === pairs.length
    && pairs.every(([a,b]) => a >= 1 && a < b && b <= count);
}
