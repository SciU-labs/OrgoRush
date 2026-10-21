import { Molecule as OCLMolecule } from "openchemlib";
import { recognizeRingTopology, type RingGraph, type TopologyResult } from "./fused-topology.ts";

type FusedGraph = {
  atoms: readonly (RingGraph["atoms"][number] & { tetrahedralParity?: string; tetrahedralBondTo?: number })[];
  bonds: RingGraph["bonds"];
};
type ParentDefinition = {
  id: string;
  es: string;
  en: string;
  perimeter: string[];
  bridges: [string, string][];
  doubles: [string, string][];
  rule: string;
  figure: string;
};
const A21 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm";
const A23 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_73.htm";
const pairs = (text: string): [string, string][] => text.split(" ").map((pair) => pair.split("-") as [string, string]);
const perimeter = (text: string) => text.split(" ");

// Numbered adjacency transcribed from the 1979 figures, NOT a SMILES lookup.
// These definitions include constitutional bonds and hydrogen positions; formula
// and ring-size signatures alone never admit a retained parent.
export const RETAINED_FUSED_1979: readonly ParentDefinition[] = [
  { id: "naphthalene", es: "naftaleno", en: "naphthalene", perimeter: perimeter("1 2 3 4 4a 5 6 7 8 8a"),
    bridges: pairs("4a-8a"), doubles: pairs("1-2 3-4 4a-5 6-7 8-8a"), rule: "A-21.1(3); A-22.1–3", figure: `${A21}#bm2460` },
  { id: "anthracene", es: "antraceno", en: "anthracene", perimeter: perimeter("1 2 3 4 4a 10 10a 5 6 7 8 8a 9 9a"),
    bridges: pairs("4a-9a 8a-10a"), doubles: pairs("1-2 3-4 4a-10 10a-5 6-7 8-8a 9-9a"), rule: "A-21.1(13); A-22.5", figure: `${A21}#bm2560` },
  { id: "phenanthrene", es: "fenantreno", en: "phenanthrene", perimeter: perimeter("1 2 3 4 4a 4b 5 6 7 8 8a 9 10 10a"),
    bridges: pairs("4a-10a 4b-8a"), doubles: pairs("1-2 3-4 4a-10a 4b-5 6-7 8-8a 9-10"), rule: "A-21.1(12); A-22.5", figure: `${A21}#bm2550` },
  { id: "indene", es: "indeno", en: "indene", perimeter: perimeter("1 2 3 3a 4 5 6 7 7a"),
    bridges: pairs("3a-7a"), doubles: pairs("2-3 3a-7a 4-5 6-7"), rule: "A-21.1(2); A-21.6; A-22.4", figure: `${A21}#bm2450` },
  { id: "fluorene", es: "fluoreno", en: "fluorene", perimeter: perimeter("1 2 3 4 4a 4b 5 6 7 8 8a 9 9a"),
    bridges: pairs("4a-9a 4b-8a"), doubles: pairs("1-2 3-4 4a-9a 4b-8a 5-6 7-8"), rule: "A-21.1(10); A-22.1–4", figure: `${A21}#bm2530` },
  { id: "azulene", es: "azuleno", en: "azulene", perimeter: perimeter("1 2 3 3a 4 5 6 7 8 8a"),
    bridges: pairs("3a-8a"), doubles: pairs("1-2 3-3a 4-5 6-7 8-8a"), rule: "A-21.1(4); A-22.1–3", figure: `${A21}#bm2470` },
  { id: "1,4-dihydronaphthalene", es: "1,4-dihidronaftaleno", en: "1,4-dihydronaphthalene",
    perimeter: perimeter("1 2 3 4 4a 5 6 7 8 8a"), bridges: pairs("4a-8a"), doubles: pairs("2-3 4a-8a 5-6 7-8"),
    rule: "A-23.1–2; A-22.1–3", figure: `${A23}#bm1790` },
];

type NormalizedGraph = { ids: number[]; labels: string[]; edges: number[][] };
function normalize(graph: RingGraph): NormalizedGraph {
  const mol = new OCLMolecule(0, 0);
  const ids = graph.atoms.map((a) => a.id), index = new Map(ids.map((id, i) => [id, i]));
  graph.atoms.forEach(() => mol.addAtom(6));
  graph.bonds.forEach(([a, b, order = 1]) => {
    const bond = mol.addBond(index.get(a)!, index.get(b)!);
    mol.setBondOrder(bond, order);
  });
  mol.ensureHelperArrays(OCLMolecule.cHelperRings);
  const edges = ids.map(() => ids.map(() => 0));
  graph.bonds.forEach(([a, b, order = 1], i) => {
    edges[index.get(a)!][index.get(b)!] = edges[index.get(b)!][index.get(a)!] = mol.isAromaticBond(i) ? 4 : order;
  });
  return { ids, edges, labels: ids.map((id, i) => {
    const hydrogens = 4 - graph.bonds.reduce((sum, [a, b, order = 1]) => sum + (a === id || b === id ? order : 0), 0);
    return `${hydrogens}:${edges[i].filter(Boolean).sort().join(",")}`;
  }) };
}
function definitionGraph(parent: ParentDefinition): RingGraph {
  const locants = parent.perimeter;
  const edgePairs = [...locants.map((locant, i): [string, string] => [locant, locants[(i + 1) % locants.length]]), ...parent.bridges];
  return {
    atoms: locants.map((_, i) => ({ id: i })),
    bonds: edgePairs.map(([a, b]) => [locants.indexOf(a), locants.indexOf(b),
      parent.doubles.some(([c, d]) => a === c && b === d || a === d && b === c) ? 2 : 1]),
  };
}
const normalizedParents = RETAINED_FUSED_1979.map((definition) => ({ definition, graph: normalize(definitionGraph(definition)) }));

// Enumerate graph isomorphisms so numbering choices can be compared by locants,
// rather than by atom IDs or the coordinates of the user's drawing.
function mappings(parent: NormalizedGraph, actual: NormalizedGraph): number[][] {
  if (parent.ids.length !== actual.ids.length) return [];
  const options = parent.labels.map((label) => actual.labels.flatMap((other, i) => label === other ? [i] : []));
  const order = parent.ids.map((_, i) => i).sort((a, b) => options[a].length - options[b].length);
  const chosen = new Array<number>(parent.ids.length).fill(-1), used = new Set<number>(), found: number[][] = [];
  function visit(depth: number) {
    if (depth === order.length) { found.push(chosen.map((i) => actual.ids[i])); return; }
    const a = order[depth];
    for (const b of options[a]) {
      if (used.has(b) || order.slice(0, depth).some((c) => parent.edges[a][c] !== actual.edges[b][chosen[c]])) continue;
      chosen[a] = b; used.add(b); visit(depth + 1); used.delete(b); chosen[a] = -1;
    }
  }
  visit(0); return found;
}
export type RetainedFusedResult =
  | { status: "SUPPORTED"; topology: TopologyResult; parentId: string; nameEs: string; nameEn: string;
      parentEs: string; parentEn: string; locants: Map<number, string>; atomIds: number[]; rule: string; reference: string }
  | { status: "UNSUPPORTED"; topology: TopologyResult; reason: string; requiresRetainedRoute: boolean };

/** Bounded A-21/A-22/A-23 implementation; unsupported is a first-class result. */
export function nameRetainedFused1979(graph: FusedGraph): RetainedFusedResult {
  const topology = recognizeRingTopology(graph);
  let requiresRetainedRoute = false;
  const unsupported = (reason: string): RetainedFusedResult => ({ status: "UNSUPPORTED", topology, reason, requiresRetainedRoute });
  if (topology.kind !== "ortho-fused" && topology.kind !== "ortho-peri-fused") return unsupported(topology.reason ?? topology.kind);
  const coreIds = new Set(topology.cycles.flat());
  if (graph.atoms.some((a) => coreIds.has(a.id) && (a.element ?? "C") !== "C")) return unsupported("heterocyclic-parent");
  const core: RingGraph = { atoms: graph.atoms.filter((a) => coreIds.has(a.id)), bonds: graph.bonds.filter(([a, b]) => coreIds.has(a) && coreIds.has(b)) };
  let actual: NormalizedGraph;
  try {
    actual = normalize(core);
    // Preserve the existing A-32 treatment of mixed aliphatic tricycles which
    // may contain a benzene subunit. The new retained route guards aromatic
    // bicycles and fully aromatic larger cores independently of stored flags.
    requiresRetainedRoute = actual.edges.some((row) => row.includes(4))
      && (topology.cycleRank === 2 || actual.edges.every((row) => row.includes(4)));
  } catch { return unsupported("aromatic-normalization-failed"); }
  if (graph.atoms.some((atom) => atom.charge || atom.tetrahedralParity !== undefined || atom.tetrahedralBondTo !== undefined)
    || graph.bonds.some((bond) => bond[3])) return unsupported("charge-or-stereochemistry-outside-retained-subset");
  const external = graph.atoms.filter((a) => !coreIds.has(a.id));
  // Only one methyl or monovalent halogen on naphthalene is admitted here.
  // More complex substitution and functional suffixes need further rules.
  const prefixes: Record<string, [string, string]> = { C: ["metil", "methyl"], F: ["fluoro", "fluoro"], Cl: ["cloro", "chloro"], Br: ["bromo", "bromo"], I: ["yodo", "iodo"] };
  if (external.length > 1 || (external[0] && !prefixes[external[0].element ?? "C"])) return unsupported("substitution-outside-retained-subset");
  const attachment = external[0] ? graph.bonds.filter(([a, b]) => a === external[0].id || b === external[0].id) : [];
  const anchor = attachment.length === 1
    ? attachment[0][0] === external[0].id ? attachment[0][1] : attachment[0][0] : undefined;
  if (external.length && (attachment.length !== 1 || (attachment[0][2] ?? 1) !== 1 || !coreIds.has(anchor!))) return unsupported("unsupported-attachment");
  // Remove the substituent's valence contribution before matching the parent;
  // an ordinary aromatic CH has exactly one replaceable H.
  try {
    for (const { definition, graph: parent } of normalizedParents) {
      if (external.length && definition.id !== "naphthalene") continue;
      const choices = mappings(parent, actual);
      if (!choices.length) continue;
      choices.sort((a, b) => (anchor === undefined ? 0
        : Number(definition.perimeter[a.indexOf(anchor)]) - Number(definition.perimeter[b.indexOf(anchor)]))
        || a.join(",").localeCompare(b.join(","), "en", { numeric: true }));
      const chosen = choices[0];
      const locants = new Map(chosen.map((id, i) => [id, definition.perimeter[i]]));
      const substitutionLocant = anchor === undefined ? undefined : locants.get(anchor);
      if (external.length && (!substitutionLocant || !/^\d+$/.test(substitutionLocant))) return unsupported("fusion-atom-has-no-replaceable-hydrogen");
      const prefix = external[0] && prefixes[external[0].element ?? "C"];
      return { status: "SUPPORTED", topology, parentId: definition.id,
        parentEs: definition.es, parentEn: definition.en,
        nameEs: prefix ? `${substitutionLocant}-${prefix[0]}${definition.es}` : definition.es,
        nameEn: prefix ? `${substitutionLocant}-${prefix[1]}${definition.en}` : definition.en,
        locants, atomIds: chosen, rule: `${definition.rule}${prefix ? "; A-23.3" : ""}`, reference: definition.figure };
    }
  } catch { return unsupported("aromatic-normalization-failed"); }
  return unsupported("parent-or-hydrogenation-outside-verified-registry");
}

/** Spelling admission only; callers must also retain the graph-backed result. */
export function isRetainedFused1979NameEs(name: string) {
  return RETAINED_FUSED_1979.some((p) => name === p.es)
    || /^(?:1|2)-(?:metil|fluoro|cloro|bromo|yodo)naftaleno$/.test(name);
}
