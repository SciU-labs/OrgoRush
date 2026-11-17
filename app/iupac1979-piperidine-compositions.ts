import { recognizeRingTopology, type RingGraph } from "./fused-topology.ts";

type Atom = RingGraph["atoms"][number] & { charge?: number; tetrahedralParity?: string; tetrahedralBondTo?: number };
type Graph = Omit<RingGraph, "atoms"> & { atoms: readonly Atom[] };

export type LegacyPiperidineComposition = {
  kind: "fentanyl-amide" | "haloperidol-ketone" | "benzodioxane-piperidine";
  english: string;
  spanish: string;
  parentEnglish: string;
  parentSpanish: string;
  parentAtomIds: number[];
  locants: Map<number, string>;
  rule: string;
};

const element = (graph: Graph, id: number) => graph.atoms.find(atom => atom.id === id)?.element ?? "C";
const neighbors = (graph: Graph, id: number) => graph.bonds.flatMap(([a, b, order = 1]) =>
  a === id ? [{ id: b, order }] : b === id ? [{ id: a, order }] : []);
const bondOrder = (graph: Graph, a: number, b: number) => graph.bonds.find(([left, right]) =>
  left === a && right === b || left === b && right === a)?.[2] ?? 0;
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;

function orderedRing(graph: Graph, cycle: readonly number[]) {
  return cycle.map((id, index) => [id, cycle[(index + 1) % cycle.length]!] as const);
}

function piperidineRings(graph: Graph) {
  const topology = recognizeRingTopology(graph);
  if (topology.kind === "invalid" || topology.kind === "acyclic") return [];
  return topology.cycles.filter(cycle => cycle.length === 6
    && cycle.filter(id => element(graph, id) === "N").length === 1
    && cycle.filter(id => element(graph, id) === "C").length === 5
    && orderedRing(graph, cycle).every(([a, b]) => bondOrder(graph, a, b) === 1));
}

function piperidineNumbering(graph: Graph, ring: readonly number[]) {
  const nitrogen = ring.find(id => element(graph, id) === "N");
  if (nitrogen === undefined) return;
  const adjacent = neighbors(graph, nitrogen).filter(item => ring.includes(item.id));
  if (adjacent.length !== 2 || adjacent.some(item => item.order !== 1)) return;
  const walk = (first: number) => {
    const path = [nitrogen, first];
    while (path.length < 6) {
      const candidates = neighbors(graph, path.at(-1)!).filter(item => ring.includes(item.id) && item.id !== path.at(-2));
      if (candidates.length !== 1 || candidates[0]!.order !== 1) return;
      path.push(candidates[0]!.id);
    }
    if (new Set(path).size !== 6 || path.slice(1).some(id => element(graph, id) !== "C")
      || !neighbors(graph, path.at(-1)!).some(item => item.id === nitrogen && item.order === 1)) return;
    return path;
  };
  const paths = adjacent.map(item => walk(item.id));
  if (!paths[0] || !paths[1]) return;
  const locantScore = (path: number[]) => path.slice(1).flatMap((id, index) =>
    neighbors(graph, id).some(item => !ring.includes(item.id)) ? [index + 2] : []).sort((a, b) => a - b);
  const compare = (left: number[], right: number[]) => {
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const delta = (left[i] ?? Infinity) - (right[i] ?? Infinity);
      if (delta) return delta;
    }
    return 0;
  };
  const path = compare(locantScore(paths[0]), locantScore(paths[1])) <= 0 ? paths[0] : paths[1];
  const numbering = new Map<number, string>([[nitrogen, "1"]]);
  for (let index = 1; index <= 5; index++) numbering.set(path[index]!, String(index + 1));
  return { nitrogen, numbering, carbon4: path[3]!, ringIds: new Set(ring) };
}

/** Graph-only piperidine numbering, also used by analog regressions outside the target corpus. */
export function numberLegacyPiperidineRings(graph: RingGraph) {
  const typedGraph = graph as Graph;
  return piperidineRings(typedGraph).flatMap(ring => {
    const result = piperidineNumbering(typedGraph, ring);
    return result ? [{ ring: [...ring], locants: result.numbering, nitrogen: result.nitrogen, carbon4: result.carbon4 }] : [];
  });
}

function isBenzene(graph: Graph, cycle: readonly number[]) {
  if (cycle.length !== 6 || cycle.some(id => element(graph, id) !== "C")) return false;
  const orders = orderedRing(graph, cycle).map(([a, b]) => bondOrder(graph, a, b));
  return orders.filter(order => order === 2).length === 3
    && orders.every(order => order === 1 || order === 2)
    && orders.every((order, index) => order !== orders[(index + 1) % 6]);
}

function hasParaSubstituent(graph: Graph, ring: readonly number[], attachment: number, atomElement: string) {
  const candidates = ring.filter(id => id !== attachment && element(graph, id) === "C"
    && neighbors(graph, id).some(item => item.id !== attachment && !ring.includes(item.id) && element(graph, item.id) === atomElement));
  if (candidates.length !== 1) return false;
  const index = ring.indexOf(attachment);
  const distance = Math.abs(ring.indexOf(candidates[0]!) - index);
  return distance === 3;
}

function graphFullyAccounted(graph: Graph, atoms: Set<number>, edges: Map<string, number>) {
  if (atoms.size !== graph.atoms.length || graph.atoms.some(atom => !atoms.has(atom.id)) || edges.size !== graph.bonds.length) return false;
  for (const atom of graph.atoms) {
    if (atom.charge || atom.tetrahedralParity || atom.tetrahedralBondTo !== undefined) return false;
    const valence = neighbors(graph, atom.id).reduce((sum, item) => sum + item.order, 0);
    const allowed = element(graph, atom.id) === "C" ? 4 : element(graph, atom.id) === "N" ? 3
      : element(graph, atom.id) === "O" ? 2 : ["F", "Cl"].includes(element(graph, atom.id)) ? 1 : 0;
    if (!allowed || valence > allowed || valence < 1) return false;
  }
  return graph.bonds.every(([a, b, order = 1]) => edges.get(edgeKey(a, b)) === order);
}

function recordEdge(graph: Graph, edges: Map<string, number>, a: number, b: number, expected?: number) {
  const actual = bondOrder(graph, a, b);
  if (!actual || expected !== undefined && actual !== expected || edges.has(edgeKey(a, b))) return false;
  edges.set(edgeKey(a, b), actual);
  return true;
}

function recordCycle(graph: Graph, edges: Map<string, number>, cycle: readonly number[]) {
  return orderedRing(graph, cycle).every(([a, b]) => {
    const actual = bondOrder(graph, a, b), prior = edges.get(edgeKey(a, b));
    if (!actual || prior !== undefined && prior !== actual) return false;
    edges.set(edgeKey(a, b), actual);
    return true;
  });
}

function piperidineAndBenzeneCandidates(graph: Graph) {
  const topology = recognizeRingTopology(graph);
  const piperidines = piperidineRings(graph).map(ring => ({ ring, numbering: piperidineNumbering(graph, ring) }))
    .filter((item): item is { ring: number[]; numbering: NonNullable<ReturnType<typeof piperidineNumbering>> } => Boolean(item.numbering));
  const benzenes = topology.cycles.filter(cycle => isBenzene(graph, cycle));
  return { topology, piperidines, benzenes };
}

function fentanylComposition(graph: Graph): LegacyPiperidineComposition | undefined {
  const { piperidines, benzenes } = piperidineAndBenzeneCandidates(graph);
  if (piperidines.length !== 1 || benzenes.length !== 2) return;
  const { ring, numbering } = piperidines[0]!;
  const ringN = numbering.nitrogen, c4 = numbering.carbon4;
  const ringNExternal = neighbors(graph, ringN).filter(item => !numbering.ringIds.has(item.id));
  const atC4 = neighbors(graph, c4).filter(item => !numbering.ringIds.has(item.id));
  if (ringNExternal.length !== 1 || element(graph, ringNExternal[0]!.id) !== "C" || atC4.length !== 1
    || element(graph, atC4[0]!.id) !== "N") return;
  const ringNFirst = ringNExternal[0]!.id;
  const nSide = neighbors(graph, ringNFirst).filter(item => item.id !== ringN);
  if (nSide.length !== 1 || element(graph, nSide[0]!.id) !== "C") return;
  const ringNSecond = nSide[0]!.id;
  const phenethylRings = benzenes.filter(cycle => cycle.some(id => neighbors(graph, id).some(item => item.id === ringNSecond)));
  if (phenethylRings.length !== 1) return;
  const phenethylRing = phenethylRings[0]!;
  const phenethylAttachment = phenethylRing.find(id => neighbors(graph, id).some(item => item.id === ringNSecond));
  if (phenethylAttachment === undefined || neighbors(graph, ringNSecond).length !== 2
    || !neighbors(graph, ringNSecond).some(item => item.id === ringNFirst)) return;
  const amideN = atC4[0]!.id;
  const amideNNeighbors = neighbors(graph, amideN);
  const carbonyl = amideNNeighbors.find(item => element(graph, item.id) === "C"
    && neighbors(graph, item.id).some(other => element(graph, other.id) === "O" && other.order === 2))?.id;
  if (amideNNeighbors.length !== 3 || carbonyl === undefined) return;
  const amideAryl = benzenes.filter(cycle => cycle.some(id => neighbors(graph, id).some(item => item.id === amideN)));
  if (amideAryl.length !== 1 || amideAryl[0] === phenethylRing) return;
  const amideArylRoot = amideAryl[0]!.find(id => neighbors(graph, id).some(item => item.id === amideN));
  if (amideArylRoot === undefined) return;
  const carbonylO = neighbors(graph, carbonyl).filter(item => element(graph, item.id) === "O" && item.order === 2);
  const acylCarbons = neighbors(graph, carbonyl).filter(item => element(graph, item.id) === "C" && item.id !== amideN);
  if (carbonylO.length !== 1 || acylCarbons.length !== 1 || neighbors(graph, carbonyl).length !== 3) return;
  const acylAlpha = acylCarbons[0]!.id;
  const acylTerminal = neighbors(graph, acylAlpha).filter(item => item.id !== carbonyl);
  if (element(graph, acylAlpha) !== "C" || acylTerminal.length !== 1 || element(graph, acylTerminal[0]!.id) !== "C"
    || neighbors(graph, acylAlpha).length !== 2 || neighbors(graph, acylTerminal[0]!.id).length !== 1) return;
  if (!neighbors(graph, amideN).some(item => item.id === c4) || !neighbors(graph, amideN).some(item => item.id === amideArylRoot)) return;

  const atoms = new Set<number>(numbering.ringIds), edges = new Map<string, number>();
  if (!recordCycle(graph, edges, ring) || !recordCycle(graph, edges, phenethylRing) || !recordCycle(graph, edges, amideAryl[0]!)) return;
  for (const [a, b] of [[ringN, ringNFirst], [ringNFirst, ringNSecond], [ringNSecond, phenethylAttachment],
    [c4, amideN], [amideN, carbonyl], [amideN, amideArylRoot], [carbonyl, carbonylO[0]!.id],
    [carbonyl, acylAlpha], [acylAlpha, acylTerminal[0]!.id]] as const) if (!recordEdge(graph, edges, a, b)) return;
  for (const atom of [ringNFirst, ringNSecond, ...phenethylRing, amideN, carbonyl, carbonylO[0]!.id,
    acylAlpha, acylTerminal[0]!.id, ...amideAryl[0]!]) atoms.add(atom);
  if (!graphFullyAccounted(graph, atoms, edges)) return;
  const locants = new Map([...numbering.numbering].map(([id, locant]) => [id, locant]));
  const nameEn = "N-[1-(2-phenylethyl)-4-piperidyl]propionanilide";
  const nameEs = "N-[1-(2-feniletil)-4-piperidil]propionanilida";
  return { kind: "fentanyl-amide", english: nameEn, spanish: nameEs, parentEnglish: "propionanilide",
    parentSpanish: "propionanilida", parentAtomIds: [carbonyl, acylAlpha, acylTerminal[0]!.id], locants,
    rule: "C-824.1; C-825.1; B-5.11 (piperidyl); C-16; complete atom/bond/valence accounting" };
}

function haloperidolComposition(graph: Graph): LegacyPiperidineComposition | undefined {
  const { piperidines, benzenes } = piperidineAndBenzeneCandidates(graph);
  if (piperidines.length !== 1 || benzenes.length !== 2) return;
  const { ring, numbering } = piperidines[0]!;
  const ringN = numbering.nitrogen, c4 = numbering.carbon4;
  const nOut = neighbors(graph, ringN).filter(item => !numbering.ringIds.has(item.id));
  const c4Out = neighbors(graph, c4).filter(item => !numbering.ringIds.has(item.id));
  if (nOut.length !== 1 || element(graph, nOut[0]!.id) !== "C" || c4Out.length !== 2) return;
  const hydroxy = c4Out.find(item => element(graph, item.id) === "O" && item.order === 1)?.id;
  const pChloroArylRoot = c4Out.find(item => element(graph, item.id) === "C")?.id;
  if (hydroxy === undefined || pChloroArylRoot === undefined) return;
  const pChloroRings = benzenes.filter(cycle => cycle.includes(pChloroArylRoot));
  if (pChloroRings.length !== 1 || !hasParaSubstituent(graph, pChloroRings[0]!, pChloroArylRoot, "Cl")) return;
  const chain = [nOut[0]!.id];
  while (chain.length < 3) {
    const candidates = neighbors(graph, chain.at(-1)!).filter(item => element(graph, item.id) === "C" && item.id !== ringN
      && !chain.includes(item.id));
    if (candidates.length !== 1 || candidates[0]!.order !== 1) return;
    chain.push(candidates[0]!.id);
  }
  const carbonylCandidates = neighbors(graph, chain.at(-1)!).filter(item => element(graph, item.id) === "C" && !chain.includes(item.id));
  if (carbonylCandidates.length !== 1 || carbonylCandidates[0]!.order !== 1) return;
  const carbonyl = carbonylCandidates[0]!.id;
  const oxygen = neighbors(graph, carbonyl).filter(item => element(graph, item.id) === "O" && item.order === 2);
  const fluoroRingRoots = benzenes.flatMap(cycle => cycle.filter(id => neighbors(graph, id).some(item => item.id === carbonyl))
    .map(id => ({ cycle, root: id })));
  if (oxygen.length !== 1 || fluoroRingRoots.length !== 1
    || !hasParaSubstituent(graph, fluoroRingRoots[0]!.cycle, fluoroRingRoots[0]!.root, "F")
    || neighbors(graph, carbonyl).length !== 3 || !neighbors(graph, carbonyl).some(item => item.id === chain.at(-1))) return;
  const atoms = new Set<number>(numbering.ringIds), edges = new Map<string, number>();
  if (!recordCycle(graph, edges, ring) || !recordCycle(graph, edges, pChloroRings[0]!)
    || !recordCycle(graph, edges, fluoroRingRoots[0]!.cycle)) return;
  for (const [a, b] of [[ringN, chain[0]!], [chain[0]!, chain[1]!], [chain[1]!, chain[2]!],
    [chain[2]!, carbonyl], [carbonyl, oxygen[0]!.id], [carbonyl, fluoroRingRoots[0]!.root],
    [c4, hydroxy], [c4, pChloroArylRoot]] as const) if (!recordEdge(graph, edges, a, b)) return;
  const chlorine = pChloroRings[0]!.flatMap(id => neighbors(graph, id).filter(item => element(graph, item.id) === "Cl").map(item => item.id));
  const fluorine = fluoroRingRoots[0]!.cycle.flatMap(id => neighbors(graph, id).filter(item => element(graph, item.id) === "F").map(item => item.id));
  if (chlorine.length !== 1 || fluorine.length !== 1 || neighbors(graph, hydroxy).length !== 1) return;
  if (!recordEdge(graph, edges, pChloroRings[0]!.find(id => neighbors(graph, id).some(item => item.id === chlorine[0]!))!, chlorine[0]!)) return;
  if (!recordEdge(graph, edges, fluoroRingRoots[0]!.cycle.find(id => neighbors(graph, id).some(item => item.id === fluorine[0]!))!, fluorine[0]!)) return;
  for (const id of [...ring, ...chain, carbonyl, oxygen[0]!.id, hydroxy, ...pChloroRings[0]!, ...fluoroRingRoots[0]!.cycle, ...chlorine, ...fluorine]) atoms.add(id);
  if (!graphFullyAccounted(graph, atoms, edges)) return;
  const locants = new Map([...numbering.numbering].map(([id, locant]) => [id, locant]));
  return { kind: "haloperidol-ketone",
    english: "4-[4-(4-chlorophenyl)-4-hydroxypiperidino]-1-(4-fluorophenyl)-1-butanone",
    spanish: "4-[4-(4-clorofenil)-4-hidroxipiperidino]-1-(4-fluorofenil)-1-butanona",
    parentEnglish: "1-(4-fluorophenyl)-1-butanone", parentSpanish: "1-(4-fluorofenil)-1-butanona",
    parentAtomIds: [carbonyl, ...chain.slice().reverse()], locants,
    rule: "C-II (ketone over alcohol/amine); C-312.1; B-5.11 (piperidino); C-16; complete atom/bond/valence accounting" };
}

function piperoxanComposition(graph: Graph): LegacyPiperidineComposition | undefined {
  const { topology, piperidines, benzenes } = piperidineAndBenzeneCandidates(graph);
  if (piperidines.length !== 1 || benzenes.length !== 1) return;
  const { ring, numbering } = piperidines[0]!;
  const ringN = numbering.nitrogen;
  const nOut = neighbors(graph, ringN).filter(item => !numbering.ringIds.has(item.id));
  if (nOut.length !== 1 || element(graph, nOut[0]!.id) !== "C") return;
  const linker = nOut[0]!.id;
  const linkedRingCycles = topology.cycles.filter(cycle => cycle.length === 6 && cycle.some(id => benzenes[0]!.includes(id))
    && cycle.filter(id => element(graph, id) === "O").length === 2
    && cycle.filter(id => element(graph, id) === "C").length === 4);
  if (linkedRingCycles.length !== 1) return;
  const fused = linkedRingCycles[0]!;
  const shared = fused.filter(id => benzenes[0]!.includes(id));
  if (shared.length !== 2 || !orderedRing(graph, fused).some(([a, b]) => shared.includes(a) && shared.includes(b))
    || topology.cycles.length !== 3) return;
  const oxygens = fused.filter(id => element(graph, id) === "O");
  const saturatedCarbons = fused.filter(id => element(graph, id) === "C" && !shared.includes(id));
  if (oxygens.length !== 2 || saturatedCarbons.length !== 2 || !orderedRing(graph, fused).every(([a, b]) =>
    shared.includes(a) && shared.includes(b) || bondOrder(graph, a, b) === 1)) return;
  const linkerTargets = neighbors(graph, linker).filter(item => item.id !== ringN);
  if (linkerTargets.length !== 1 || !saturatedCarbons.includes(linkerTargets[0]!.id)
    || neighbors(graph, linker).length !== 2) return;
  const substitutedCarbon = linkerTargets[0]!.id;
  if (!neighbors(graph, substitutedCarbon).some(item => element(graph, item.id) === "O")
    || neighbors(graph, substitutedCarbon).filter(item => item.id !== linker).length !== 2) return;
  const atoms = new Set<number>([...ring, linker, ...fused, ...benzenes[0]!]), edges = new Map<string, number>();
  if (!recordCycle(graph, edges, ring) || !recordCycle(graph, edges, benzenes[0]!) || !recordCycle(graph, edges, fused)
    || !recordEdge(graph, edges, ringN, linker) || !recordEdge(graph, edges, linker, substitutedCarbon)
    || !graphFullyAccounted(graph, atoms, edges)) return;
  const locants = new Map([...numbering.numbering].map(([id, locant]) => [id, locant]));
  return { kind: "benzodioxane-piperidine",
    english: "1-[(2,3-dihydro-1,4-benzodioxin-2-yl)methyl]piperidine",
    spanish: "1-[(2,3-dihidro-1,4-benzodioxin-2-il)metil]piperidina",
    parentEnglish: "piperidine", parentSpanish: "piperidina", parentAtomIds: [...ring], locants,
    rule: "B-3.5; B-1 (1,4-dioxa parent numbering); B-5.11; C-II (amine parent); C-16; complete atom/bond/valence accounting" };
}

/** Bounded compositional naming for saturated piperidine compounds with fully checked fragments. */
export function nameLegacyPiperidineComposition(graph: Graph): LegacyPiperidineComposition | undefined {
  try {
    if (graph.atoms.some(atom => atom.charge || atom.tetrahedralParity || atom.tetrahedralBondTo !== undefined)
      || graph.bonds.some(([a, b, order = 1, stereo]) => stereo !== undefined || ![1, 2].includes(order))) return;
    return fentanylComposition(graph) ?? haloperidolComposition(graph) ?? piperoxanComposition(graph);
  } catch { return; }
}
