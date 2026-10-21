/** Constitutional topology only: no canvas coordinates or stored ring metadata. */
export type RingGraph = {
  atoms: readonly { id: number; element?: string; charge?: number }[];
  bonds: readonly (readonly [number, number, number?, ...unknown[]])[];
};

export type RingTopology = "acyclic" | "monocyclic" | "ortho-fused" | "ortho-peri-fused"
  | "spiro" | "linked" | "bridged" | "other" | "invalid";
export type TopologyResult = {
  kind: RingTopology;
  cycleRank: number;
  cycles: number[][];
  fusionEdges: [number, number][];
  reason?: string;
};
const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;

export function recognizeRingTopology(graph: RingGraph): TopologyResult {
  const result = (kind: RingTopology, reason?: string): TopologyResult => ({
    kind, cycleRank, cycles, fusionEdges, ...(reason ? { reason } : {}),
  });
  let cycleRank = 0;
  let cycles: number[][] = [];
  const fusionEdges: [number, number][] = [];
  const ids = new Set(graph.atoms.map((atom) => atom.id));
  const adjacency = new Map([...ids].map((id) => [id, [] as number[]]));
  const edges = new Set<string>();
  if (ids.size !== graph.atoms.length || graph.atoms.some((a) => !Number.isSafeInteger(a.id))) {
    return result("invalid", "duplicate-or-invalid-atom-id");
  }
  for (const [a, b, order = 1] of graph.bonds) {
    if (a === b || !ids.has(a) || !ids.has(b) || edges.has(key(a, b)) || ![1, 2, 3].includes(order)) {
      return result("invalid", "invalid-or-duplicate-bond");
    }
    edges.add(key(a, b)); adjacency.get(a)!.push(b); adjacency.get(b)!.push(a);
  }
  const maxValence: Record<string, number> = { C: 4, O: 2, N: 3, S: 6, F: 1, Cl: 1, Br: 1, I: 1 };
  if (graph.atoms.some((atom) => (atom.charge ?? 0) === 0 && graph.bonds.reduce(
    (sum, [a, b, order = 1]) => sum + (a === atom.id || b === atom.id ? order : 0), 0,
  ) > (maxValence[atom.element ?? "C"] ?? Infinity))) return result("invalid", "invalid-valence");
  if (!ids.size) return result("acyclic");
  if (ids.size > 120 || graph.bonds.length > 150) return result("other", "graph-size-limit");

  // Tarjan edge blocks separate spiro junctions and inter-ring linking bonds.
  const discovery = new Map<number, number>(), low = new Map<number, number>();
  const stack: [number, number][] = [], blocks: Set<number>[] = [];
  let time = 0, components = 0;
  function visit(a: number, parent?: number) {
    discovery.set(a, ++time); low.set(a, time);
    for (const b of adjacency.get(a)!) {
      if (!discovery.has(b)) {
        stack.push([a, b]); visit(b, a);
        low.set(a, Math.min(low.get(a)!, low.get(b)!));
        if (low.get(b)! >= discovery.get(a)!) {
          const vertices = new Set<number>(); let edge: [number, number]; let count = 0;
          do { edge = stack.pop()!; vertices.add(edge[0]); vertices.add(edge[1]); count++; }
          while (edge[0] !== a || edge[1] !== b);
          if (count >= vertices.size) blocks.push(vertices);
        }
      } else if (b !== parent && discovery.get(b)! < discovery.get(a)!) {
        stack.push([a, b]); low.set(a, Math.min(low.get(a)!, discovery.get(b)!));
      }
    }
  }
  for (const id of ids) if (!discovery.has(id)) { components++; visit(id); }
  cycleRank = graph.bonds.length - ids.size + components;
  if (components > 1) return result("other", "disconnected");
  if (!cycleRank) return result("acyclic");
  if (cycleRank === 1) return result("monocyclic");
  if (blocks.length > 1) return result(blocks.some((block, i) => blocks.slice(i + 1)
    .some((other) => [...block].some((id) => other.has(id)))) ? "spiro" : "linked");

  // Enumerate induced (chordless) cycles within the single cyclic block. The
  // cap is a safe unsupported boundary, never an incomplete fusion assignment.
  const block = blocks[0]; let exhausted = false, visits = 0;
  function walk(path: number[]) {
    if (++visits > 20000 || cycles.length > 256) { exhausted = true; return; }
    const a = path[path.length - 1], first = path[0];
    for (const b of adjacency.get(a)!) {
      if (!block.has(b) || b <= first || path.includes(b)) continue;
      if (adjacency.get(b)!.some((c) => path.slice(1, -1).includes(c))) continue;
      if (path.length >= 2 && adjacency.get(b)!.includes(first)) {
        if (path.length >= 2 && path[1] < b) cycles.push([...path, b]);
      } else if (path.length < 24 && !exhausted) walk([...path, b]);
      else exhausted = true;
    }
  }
  for (const id of block) if (!exhausted) walk([id]);
  if (exhausted) return result("other", "cycle-enumeration-limit");
  // Peri systems also have large induced perimeter cycles. Select an elementary
  // minimum cycle basis by GF(2) edge elimination rather than mistaking those
  // composite perimeters for extra bridges. Equal-length redundant elementary
  // cycles (e.g. cages) are deliberately not assigned a fused topology.
  const basis = new Map<string, Set<string>>(), elementary: number[][] = [];
  let ambiguousElementary = false;
  for (const cycle of [...cycles].sort((a, b) => a.length - b.length)) {
    const vector = new Set(cycle.map((a, i) => key(a, cycle[(i + 1) % cycle.length])));
    while (vector.size) {
      const pivot = [...vector].sort()[0], existing = basis.get(pivot);
      if (!existing) { basis.set(pivot, new Set(vector)); elementary.push(cycle); break; }
      for (const edge of existing) { if (vector.has(edge)) vector.delete(edge); else vector.add(edge); }
    }
    if (!vector.size && cycle.length <= (elementary[elementary.length - 1]?.length ?? 0)) ambiguousElementary = true;
  }
  cycles = elementary;
  if (cycles.length !== cycleRank || ambiguousElementary) return result("bridged");
  const ringLinks = cycles.map(() => new Set<number>());
  for (let i = 0; i < cycles.length; i++) for (let j = i + 1; j < cycles.length; j++) {
    const shared = cycles[i].filter((id) => cycles[j].includes(id));
    if (shared.length > 2 || (shared.length === 2 && !edges.has(key(shared[0], shared[1])))) {
      return result("bridged");
    }
    if (shared.length === 2) {
      fusionEdges.push([shared[0], shared[1]]);
      ringLinks[i].add(j); ringLinks[j].add(i);
    }
  }
  const seen = new Set<number>(), pending = [0];
  while (pending.length) { const i = pending.pop()!; if (!seen.has(i)) { seen.add(i); pending.push(...ringLinks[i]); } }
  if (seen.size !== cycles.length) return result("other", "not-edge-fused");
  return result([...block].some((id) => cycles.filter((ring) => ring.includes(id)).length >= 3)
    ? "ortho-peri-fused" : "ortho-fused");
}
