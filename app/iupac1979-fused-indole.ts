import { legacyGraphsIdentical } from "./iupac1979-name-structure.ts";
import { recognizeRingTopology, type RingGraph } from "./fused-topology.ts";
import type { RetainedFusedResult } from "./iupac1979-retained-fused.ts";
import { englishIupacRoot, iupacRootForCarbonCount } from "./iupac-prefixes.ts";

type GraphAtom = RingGraph["atoms"][number] & { tetrahedralParity?: string; tetrahedralBondTo?: number };
type Graph = Omit<RingGraph, "atoms"> & { atoms: readonly GraphAtom[] };
type Component =
  | { kind: "hydroxy"; locant: number; atomIds: number[] }
  | { kind: "aminoalkyl"; locant: number; carbonCount: number; atomIds: number[] }
  | { kind: "alkyl"; locant: number; carbonCount: number; atomIds: number[] };

const locants = ["1", "2", "3", "3a", "4", "5", "6", "7", "7a"] as const;
const locantIndex = new Map<string, number>(locants.map((value, index) => [value, index]));
const indoleEdges: [number, number, number][] = [
  [0, 1, 1], [1, 2, 2], [2, 3, 1], [3, 4, 2], [4, 5, 1],
  [5, 6, 2], [6, 7, 1], [7, 8, 2], [8, 0, 1], [3, 8, 1],
];
const atomElement = (graph: Graph, id: number) => graph.atoms.find(atom => atom.id === id)?.element ?? "C";
const neighbors = (graph: Graph, id: number) => graph.bonds.flatMap(([a, b, order = 1]) =>
  a === id ? [{ id: b, order }] : b === id ? [{ id: a, order }] : []);
const edgeOrder = (graph: Graph, a: number, b: number) => graph.bonds.find(([left, right]) =>
  left === a && right === b || left === b && right === a)?.[2] ?? 0;

function pathWithoutFusionEdge(graph: Graph, sixRing: readonly number[], start: number, end: number) {
  const interior = sixRing.filter(id => id !== start && id !== end);
  const startNeighbors = neighbors(graph, start).map(item => item.id).filter(id => interior.includes(id));
  if (startNeighbors.length !== 1) return;
  const path = [start, startNeighbors[0]!];
  while (path.at(-1) !== end && path.length <= sixRing.length) {
    const next = neighbors(graph, path.at(-1)!).map(item => item.id)
      .filter(id => interior.includes(id) && id !== path.at(-2));
    if (path.at(-1) !== start && neighbors(graph, path.at(-1)!).some(item => item.id === end)) {
      path.push(end); break;
    }
    if (next.length !== 1 || path.includes(next[0]!)) return;
    path.push(next[0]!);
  }
  return path.length === 6 && path[0] === start && path.at(-1) === end ? path : undefined;
}

function linearComponent(graph: Graph, core: Set<number>, atomIds: number[], anchor: number): Component | undefined {
  const nodes = atomIds.map(id => graph.atoms.find(atom => atom.id === id)!);
  const nitrogen = nodes.filter(atom => atom.element === "N");
  const oxygens = nodes.filter(atom => atom.element === "O");
  const attached = graph.bonds.filter(([a, b]) => core.has(a) && atomIds.includes(b) || core.has(b) && atomIds.includes(a));
  if (attached.length !== 1 || attached[0]![2] !== 1) return;
  const root = attached[0]![0] === anchor ? attached[0]![1] : attached[0]![0];
  if (oxygens.length === 1 && nodes.length === 1 && nitrogen.length === 0 && root === oxygens[0]!.id) {
    return { kind: "hydroxy", locant: 0, atomIds: [root] };
  }
  const carbonIds = nodes.filter(atom => atom.element === "C").map(atom => atom.id);
  if (nitrogen.length === 1 && carbonIds.length >= 1 && carbonIds.length <= 8 && oxygens.length === 0
    && nitrogen[0]!.id !== root && neighbors(graph, nitrogen[0]!.id).length === 1) {
    const ordered = [root];
    while (ordered.length < carbonIds.length) {
      const next = neighbors(graph, ordered.at(-1)!).map(item => item.id)
        .filter(id => carbonIds.includes(id) && id !== ordered.at(-2));
      if (next.length !== 1) return;
      ordered.push(next[0]!);
    }
    if (new Set(ordered).size !== carbonIds.length || !ordered.every((id, index) =>
      index === 0 ? neighbors(graph, id).some(item => item.id === anchor)
        : neighbors(graph, id).some(item => item.id === ordered[index - 1]))) return;
    if (ordered.some((id, index) => neighbors(graph, id).some(item => item.order !== 1
      && (item.id === nitrogen[0]!.id || ordered.includes(item.id) || item.id === anchor)))) return;
    const terminal = ordered.at(-1)!;
    if (!neighbors(graph, terminal).some(item => item.id === nitrogen[0]!.id && item.order === 1)
      || nodes.some(atom => atom.charge || atom.tetrahedralParity || atom.tetrahedralBondTo !== undefined)) return;
    return { kind: "aminoalkyl", locant: 0, carbonCount: carbonIds.length, atomIds: [...ordered, nitrogen[0]!.id] };
  }
  if (nitrogen.length || oxygens.length || carbonIds.length < 1 || carbonIds.length > 8) return;
  const ordered = [root];
  while (ordered.length < carbonIds.length) {
    const next = neighbors(graph, ordered.at(-1)!).map(item => item.id)
      .filter(id => carbonIds.includes(id) && id !== ordered.at(-2));
    if (next.length !== 1) return;
    ordered.push(next[0]!);
  }
  if (new Set(ordered).size !== carbonIds.length || ordered.some((id, index) => neighbors(graph, id).some(item =>
    item.order !== 1 && (ordered.includes(item.id) || item.id === anchor)))) return;
  return { kind: "alkyl", locant: 0, carbonCount: carbonIds.length, atomIds: ordered };
}

function carbonRadical(count: number, language: "es" | "en") {
  const root = iupacRootForCarbonCount(count);
  if (!root) return;
  return language === "es" ? `${root}il` : `${englishIupacRoot(root)}yl`;
}

function indolyl(locant: number, language: "es" | "en") {
  return language === "es" ? `1H-indol-${locant}-il` : `1H-indol-${locant}-yl`;
}

function makeName(components: Component[], language: "es" | "en") {
  const amines = components.filter((part): part is Extract<Component, { kind: "aminoalkyl" }> => part.kind === "aminoalkyl");
  const hydroxyls = components.filter((part): part is Extract<Component, { kind: "hydroxy" }> => part.kind === "hydroxy");
  const alkyls = components.filter((part): part is Extract<Component, { kind: "alkyl" }> => part.kind === "alkyl");
  const getRingLocant = (part: Component) => part.locant;
  const suffixOH = hydroxyls[0];
  const prefixes = [
    ...amines.map(part => ({ key: language === "es" ? "amino" : "amino", locant: getRingLocant(part),
      text: language === "es" ? `${part.carbonCount}-amino${carbonRadical(part.carbonCount, language)}`
        : `${part.carbonCount}-amino${carbonRadical(part.carbonCount, language)}` })),
    ...alkyls.map(part => ({ key: carbonRadical(part.carbonCount, language)!, locant: getRingLocant(part),
      text: carbonRadical(part.carbonCount, language)! })),
  ].sort((a, b) => a.key.localeCompare(b.key, language) || a.locant - b.locant)
    .map(part => `${part.locant}-${part.key === "amino" ? `(${part.text})` : part.text}`);
  if (amines.length === 1 && !suffixOH && !alkyls.length) {
    const part = amines[0]!;
    const ringLocant = getRingLocant(part);
    const radical = indolyl(ringLocant, language);
    const alkyl = carbonRadical(part.carbonCount, language)!;
    const amineParent = language === "es" ? `${alkyl}amina` : `${alkyl}amine`;
    return `${part.carbonCount}-(${radical})${amineParent}`;
  }
  const base = suffixOH
    ? `1H-indol-${getRingLocant(suffixOH)}-ol`
    : language === "es" ? "1H-indol" : "1H-indole";
  return `${prefixes.length ? `${prefixes.join("-")}-` : ""}${base}`;
}

/** Blue Book 1979 indole family: exact 5+6 fusion, standard retained numbering,
 * 1H tautomer, bounded C2/C3 aminoalkyl and ring-alkyl/OH substitution. */
export function nameLegacyFusedIndole(graph: Graph): RetainedFusedResult | undefined {
  try {
    if (graph.atoms.some(atom => atom.charge || atom.tetrahedralParity || atom.tetrahedralBondTo !== undefined)
      || graph.bonds.some(bond => bond[3] || ![1, 2].includes(bond[2] ?? 1))) return;
    const topology = recognizeRingTopology(graph);
    if (topology.kind !== "ortho-fused" || topology.cycleRank !== 2) return;
    const five = topology.cycles.find(cycle => cycle.length === 5), six = topology.cycles.find(cycle => cycle.length === 6);
    if (!five || !six || topology.cycles.some(cycle => cycle.length !== 5 && cycle.length !== 6)) return;
    const fusion = five.filter(id => six.includes(id));
    const coreIds = new Set([...five, ...six]);
    if (fusion.length !== 2 || !graph.bonds.some(([a, b]) => fusion.includes(a) && fusion.includes(b))
      || coreIds.size !== 9 || graph.atoms.filter(atom => coreIds.has(atom.id)).filter(atom => atomElement(graph, atom.id) === "N").length !== 1
      || graph.atoms.filter(atom => coreIds.has(atom.id)).filter(atom => atomElement(graph, atom.id) === "C").length !== 8) return;
    const nitrogen = [...coreIds].find(id => atomElement(graph, id) === "N");
    if (nitrogen === undefined || !five.includes(nitrogen)) return;
    const nitrogenFusion = neighbors(graph, nitrogen).filter(item => fusion.includes(item.id));
    const nitrogenCarbon = neighbors(graph, nitrogen).filter(item => five.includes(item.id) && !fusion.includes(item.id));
    if (nitrogenFusion.length !== 1 || nitrogenCarbon.length !== 1) return; // excludes isoindole
    const loc1 = nitrogen, loc7a = nitrogenFusion[0]!.id;
    const loc2 = nitrogenCarbon[0]!.id;
    const loc3Candidates = neighbors(graph, loc2).filter(item => five.includes(item.id)
      && !fusion.includes(item.id) && item.id !== nitrogen);
    if (loc3Candidates.length !== 1) return;
    const loc3 = loc3Candidates[0]!.id;
    const loc3aCandidates = neighbors(graph, loc3).filter(item => fusion.includes(item.id));
    if (loc3aCandidates.length !== 1 || loc3aCandidates[0]!.id === loc7a) return;
    const loc3a = loc3aCandidates[0]!.id;
    const benzenePath = pathWithoutFusionEdge(graph, six, loc3a, loc7a);
    if (!benzenePath || benzenePath.length !== 6) return;
    const order = [loc1, loc2, loc3, loc3a, benzenePath[1]!, benzenePath[2]!, benzenePath[3]!, benzenePath[4]!, loc7a];
    const numbering = new Map(order.map((id, index) => [id, locants[index]!]));
    const coreTemplate = { atoms: locants.map((_, id) => ({ id, element: id === 0 ? "N" : "C" })), bonds: indoleEdges };
    const externalIds = graph.atoms.filter(atom => !coreIds.has(atom.id)).map(atom => atom.id);
    const components: Component[] = [];
    const remaining = new Set(externalIds);
    const adjacency = new Map(graph.atoms.map(atom => [atom.id, neighbors(graph, atom.id).map(item => item.id)]));
    while (remaining.size) {
      const seed = remaining.values().next().value as number;
      const ids = new Set<number>(), pending = [seed];
      while (pending.length) {
        const id = pending.pop()!; if (ids.has(id)) continue; ids.add(id); remaining.delete(id);
        for (const next of adjacency.get(id) ?? []) if (!coreIds.has(next) && !ids.has(next)) pending.push(next);
      }
      const attachments = graph.bonds.flatMap(([a, b, bondOrder = 1]) => ids.has(a) && coreIds.has(b)
        ? [[b, a, bondOrder] as const] : ids.has(b) && coreIds.has(a) ? [[a, b, bondOrder] as const] : []);
      if (attachments.length !== 1) return;
      const [anchor, root, bondOrder] = attachments[0]!;
      if (bondOrder !== 1) return;
      const component = linearComponent(graph, coreIds, [...ids], anchor);
      if (!component) return;
      const locant = Number(numbering.get(anchor));
      if (!Number.isInteger(locant) || locant < 1 || locant > 7) return;
      components.push({ ...component, locant, atomIds: component.kind === "hydroxy" ? [root] : component.atomIds });
    }
    if (components.filter(part => part.kind === "hydroxy").length > 1
      || components.filter(part => part.kind === "aminoalkyl").length > 1
      || components.filter(part => part.kind === "aminoalkyl").some(part => part.locant !== 2 && part.locant !== 3)
      || components.filter(part => part.kind === "hydroxy").some(part => part.locant < 4 || part.locant > 7)) return;
    // Construct all allowed substituent fragments from their detected graph
    // paths and force the indole numbering. The complete identity proof also
    // rejects changed N-H placement, missing atoms, and wrong attachment sites.
    const expected = { atoms: [...coreTemplate.atoms], bonds: indoleEdges.map(edge => [...edge] as [number, number, number]) };
    const forced = new Map(order.map((id, index) => [index, id]));
    for (const part of components) {
      const anchor = [...numbering].find(([, value]) => Number(value) === part.locant)?.[0];
      if (anchor === undefined) return;
      if (part.kind === "hydroxy") {
        const id = expected.atoms.length; expected.atoms.push({ id, element: "O" }); expected.bonds.push([locantIndex.get(String(part.locant))!, id, 1]);
        forced.set(id, part.atomIds[0]!);
      } else {
        const ordered = part.atomIds;
        const elements = part.kind === "aminoalkyl" ? [...Array(part.carbonCount).fill("C"), "N"] : Array(part.carbonCount).fill("C");
        const start = expected.atoms.length;
        expected.atoms.push(...elements.map((element, index) => ({ id: start + index, element })));
        expected.bonds.push([locantIndex.get(String(part.locant))!, start, 1]);
        for (let index = 0; index < elements.length - 1; index++) expected.bonds.push([start + index, start + index + 1, 1]);
        ordered.forEach((id, index) => forced.set(start + index, id));
      }
    }
    if (!legacyGraphsIdentical(expected, graph as RingGraph, forced)) return;
    const english = makeName(components, "en"), spanish = makeName(components, "es");
    const idLocants = new Map(order.map((id, index) => [id, locants[index]!]));
    const englishLocants = new Map(idLocants);
    return { status: "SUPPORTED", topology, parentId: "indole", nameEs: spanish, nameEn: english,
      parentEs: "1H-indol", parentEn: "1H-indole", locants: idLocants, englishLocants,
      atomIds: order, rule: "B-2.11; B-3.4; B-5.11; C-II; C-201.1–.2; C-812.3(a); complete graph, indicated hydrogen, and locant verification",
      reference: "https://www.acdlabs.com/iupac/nomenclature/79/r79_951.htm" };
  } catch { return; }
}
