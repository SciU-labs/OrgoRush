import { legacyGraphsIdentical } from "./iupac1979-name-structure.ts";
import type { RingGraph } from "./fused-topology.ts";

type Atom = RingGraph["atoms"][number] & { tetrahedralParity?: string; tetrahedralBondTo?: number };
export type LegacyHeterocycleGraph = Omit<RingGraph, "atoms"> & { atoms: readonly Atom[] };

export type LegacyHeterocycleName = {
  english: string;
  spanish: string;
  parent: string;
  atomLocants: Map<number, number>;
  rule: string;
};

const element = (atom: Atom) => atom.element ?? "C";
const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;

function simpleCycles(graph: LegacyHeterocycleGraph, size: number) {
  const ids = graph.atoms.map(atom => atom.id);
  const adjacency = new Map(ids.map(id => [id, [] as number[]]));
  for (const [left, right] of graph.bonds) {
    adjacency.get(left)?.push(right);
    adjacency.get(right)?.push(left);
  }
  const cycles = new Map<string, number[]>();
  for (const start of ids) {
    const visit = (path: number[]) => {
      const tail = path.at(-1)!;
      if (path.length === size) {
        if (adjacency.get(tail)?.includes(start)) {
          const body = path.slice(1);
          const reverse = [path[0]!, ...body.slice().reverse()];
          const canonical = [path, reverse].map(candidate => {
            const rotations = candidate.map((_, index) => [...candidate.slice(index), ...candidate.slice(0, index)]);
            return rotations.map(rotation => rotation.join(",")).sort()[0]!;
          }).sort()[0]!;
          cycles.set(canonical, path);
        }
        return;
      }
      for (const next of adjacency.get(tail) ?? []) {
        if (next > start && !path.includes(next)) visit([...path, next]);
      }
    };
    visit([start]);
  }
  return [...cycles.values()];
}

function graphProof(graph: LegacyHeterocycleGraph, ring: readonly number[], orderedElements: readonly string[],
  bondOrders: readonly number[], append: { elements: string[]; bonds: [number, number, number][]; forced: Map<number, number> } = {
    elements: [], bonds: [], forced: new Map(),
  }) {
  const atoms = [...orderedElements, ...append.elements].map((item, id) => ({ id, element: item }));
  const bonds: [number, number, number][] = ring.map((_, index) => [index, (index + 1) % ring.length, bondOrders[index]!]);
  bonds.push(...append.bonds);
  const expected: RingGraph = { atoms, bonds };
  const forced = new Map<number, number>(ring.map((id, index) => [index, id]));
  for (const [expectedId, actualId] of append.forced) forced.set(expectedId, actualId);
  return legacyGraphsIdentical(expected, graph as RingGraph, forced);
}

function rotation(sequence: readonly number[], start: number, reverse = false) {
  const index = sequence.indexOf(start);
  const step = reverse ? -1 : 1;
  return Array.from({ length: sequence.length }, (_, offset) => sequence[(index + offset * step + sequence.length * 2) % sequence.length]!);
}

function ringNameCandidates(graph: LegacyHeterocycleGraph, ring: number[]) {
  const result: Array<{ parent: string; es: string; en: string; ordered: number[]; elements: string[]; bonds: number[] }> = [];
  const ringElements = ring.map(id => element(graph.atoms.find(atom => atom.id === id)!));
  if (ring.length === 5 && ringElements.filter(value => value === "N").length === 2
    && ringElements.filter(value => value === "C").length === 3) {
    for (const nh of ring.filter(id => element(graph.atoms.find(atom => atom.id === id)!) === "N")) {
      const adjacentNitrogen = (direction: number) => {
        let index = ring.indexOf(nh);
        for (let step = 1; step < ring.length; step++) {
          index = (index + direction + ring.length) % ring.length;
          const id = ring[index]!;
          if (element(graph.atoms.find(atom => atom.id === id)!) === "N") return step === 1;
        }
        return false;
      };
      for (const reverse of [false, true]) {
        const ordered = rotation(ring, nh, reverse);
        const elements = ordered.map(id => element(graph.atoms.find(atom => atom.id === id)!));
        if (elements[0] !== "N") continue;
        if (elements[1] === "N" && adjacentNitrogen(reverse ? -1 : 1)) {
          result.push({ parent: "pyrazole", es: "pirazol", en: "pyrazole", ordered,
            elements: ["N", "N", "C", "C", "C"], bonds: [1, 2, 1, 2, 1] });
        }
        if (elements[2] === "N") {
          result.push({ parent: "imidazole", es: "imidazol", en: "imidazole", ordered,
            elements: ["N", "C", "N", "C", "C"], bonds: [1, 2, 1, 2, 1] });
        }
      }
    }
  }
  if (ring.length === 6 && ringElements.filter(value => value === "N").length === 2
    && ringElements.filter(value => value === "C").length === 4) {
    for (const start of ring.filter(id => element(graph.atoms.find(atom => atom.id === id)!) === "N")) {
      for (const reverse of [false, true]) {
        const ordered = rotation(ring, start, reverse);
        const elements = ordered.map(id => element(graph.atoms.find(atom => atom.id === id)!));
        const secondN = elements.indexOf("N", 1) + 1;
        const parent = secondN === 2 ? "pyridazine" : secondN === 3 ? "pyrimidine" : secondN === 4 ? "pyrazine" : "";
        if (parent) result.push({ parent, es: ({ pyrazine: "pirazina", pyrimidine: "pirimidina", pyridazine: "piridazina" } as const)[parent as "pyrazine" | "pyrimidine" | "pyridazine"],
          en: parent, ordered, elements, bonds: [2, 1, 2, 1, 2, 1] });
      }
    }
  }
  return result;
}

/**
 * Bounded Blue Book 1979 support for retained neutral diazoles/diazines and
 * compositional histamine / pyrazine-carboxylic-acid constructions. It proves
 * the complete graph (including implicit H count) with fixed ring locants.
 */
export function nameLegacyMonocyclicNitrogenHeterocycle(graph: LegacyHeterocycleGraph): LegacyHeterocycleName | undefined {
  try {
    if (graph.atoms.length < 5 || graph.atoms.length > 10 || graph.bonds.length !== graph.atoms.length
      || graph.atoms.some(atom => !["C", "N", "O"].includes(element(atom)) || atom.charge || atom.tetrahedralParity || atom.tetrahedralBondTo !== undefined)
      || graph.bonds.some(bond => bond[3] || ![1, 2, 3].includes(bond[2] ?? 1))) return;
    const allIds = new Set(graph.atoms.map(atom => atom.id));
    if (allIds.size !== graph.atoms.length || graph.bonds.some(([a, b]) => !allIds.has(a) || !allIds.has(b))) return;
    for (const ring of [...simpleCycles(graph, 5), ...simpleCycles(graph, 6)]) {
      if (ring.length !== 5 && ring.length !== 6) continue;
      if (new Set(ring).size !== ring.length) continue;
      const candidates = ringNameCandidates(graph, ring);
      for (const candidate of candidates) {
        const bondAlternatives = candidate.ordered.length === 6
          ? [candidate.bonds, candidate.bonds.map((_, index) => candidate.bonds[(index + 1) % candidate.bonds.length]!)]
          : [candidate.bonds];
        if (graph.atoms.length === ring.length && bondAlternatives.some(orders => graphProof(graph, candidate.ordered, candidate.elements, orders))) {
          const locants = new Map(candidate.ordered.map((id, index) => [id, index + 1]));
          return { english: candidate.parent === "pyrazole" ? "1H-pyrazole" : candidate.en,
            spanish: candidate.parent === "pyrazole" ? "1H-pirazol" : candidate.es,
            parent: candidate.parent, atomLocants: locants,
            rule: "B-1.1, B-1.51–1.53; B-2.11 (retained neutral heterocycle); indicated hydrogen; complete graph identity" };
        }
        // C-812.3: an alkyl radical substituted terminally by a cyclic group
        // may be named by adding -amine to the radical. B-5.11 supplies the
        // retained imidazolyl radical.
        if (candidate.parent === "imidazole" && graph.atoms.length === 8) {
          const attachmentIndex = candidate.ordered.findIndex(id => graph.bonds.some(([a, b]) =>
            a === id && !ring.includes(b) || b === id && !ring.includes(a)));
          const attachment = candidate.ordered[attachmentIndex];
          if (attachmentIndex < 3 || attachmentIndex > 4 || attachment === undefined) continue;
          const outside = graph.atoms.filter(atom => !ring.includes(atom.id));
          const byId = new Map(graph.atoms.map(atom => [atom.id, atom]));
          const neighbors = new Map(outside.map(atom => [atom.id, [] as number[]]));
          for (const [a, b] of graph.bonds) {
            if (neighbors.has(a)) neighbors.get(a)!.push(b);
            if (neighbors.has(b)) neighbors.get(b)!.push(a);
          }
          const attached = graph.bonds.filter(([a, b]) => a === attachment && outside.some(atom => atom.id === b)
            || b === attachment && outside.some(atom => atom.id === a));
          if (outside.length !== 3 || attached.length !== 1) continue;
          const first = attached[0]![0] === attachment ? attached[0]![1] : attached[0]![0];
          const firstAtom = byId.get(first)!;
          const secondCandidates = (neighbors.get(first) ?? []).filter(id => outside.some(atom => atom.id === id) && id !== attachment);
          if (element(firstAtom) !== "C" || secondCandidates.length !== 1) continue;
          const second = secondCandidates[0]!;
          const terminal = (neighbors.get(second) ?? []).filter(id => id !== first && outside.some(atom => atom.id === id));
          if (element(byId.get(second)!) !== "C" || terminal.length !== 1 || element(byId.get(terminal[0]!)!) !== "N") continue;
          if (neighbors.get(terminal[0]!)!.length !== 1 || (neighbors.get(first) ?? []).length !== 2
            || (neighbors.get(second) ?? []).length !== 2) continue;
          const appended = { elements: ["C", "C", "N"], bonds: [[attachmentIndex, 5, 1], [5, 6, 1], [6, 7, 1]] as [number, number, number][],
            forced: new Map([[5, first], [6, second], [7, terminal[0]!]]) };
          if (!bondAlternatives.some(orders => graphProof(graph, candidate.ordered, candidate.elements, orders, appended))) continue;
          const atomLocants = new Map(candidate.ordered.map((id, index) => [id, index + 1]));
          const imidazolylLocant = attachmentIndex + 1;
          return { english: `2-(1H-imidazol-${imidazolylLocant}-yl)ethylamine`, spanish: `2-(1H-imidazol-${imidazolylLocant}-il)etilamina`, parent: "imidazole",
            atomLocants, rule: "B-2.11; B-5.11; C-812.3(a); C-13.11; complete graph and implicit-hydrogen identity" };
        }
        // Carboxylic-acid senior suffix attached to C-2 of retained pyrazine.
        if (candidate.parent === "pyrazine" && graph.atoms.length === 9) {
          const carboxylLinks = graph.bonds.flatMap(([a, b]) => {
            const aElement = element(byIdSafe(graph, a)), bElement = element(byIdSafe(graph, b));
            return candidate.ordered.includes(a) && bElement === "C" && !candidate.ordered.includes(b) ? [[a, b] as const]
              : candidate.ordered.includes(b) && aElement === "C" && !candidate.ordered.includes(a) ? [[b, a] as const] : [];
          });
          if (carboxylLinks.length !== 1) continue;
          const [ringAtom, carbonyl] = carboxylLinks[0]!;
          if (candidate.ordered.indexOf(ringAtom) !== 1) continue;
          const carbonylNeighbors = graph.bonds.filter(([a, b]) => a === carbonyl || b === carbonyl)
            .map(([a, b, order = 1]) => ({ id: a === carbonyl ? b : a, order }));
          const oxygens = carbonylNeighbors.filter(item => element(byIdSafe(graph, item.id)) === "O");
          if (carbonylNeighbors.length !== 3 || oxygens.length !== 2 || !oxygens.some(item => item.order === 2)
            || !oxygens.some(item => item.order === 1)) continue;
          const outside = graph.atoms.filter(atom => !ring.includes(atom.id));
          const order = (id: number) => graph.bonds.find(([a, b]) => a === carbonyl && b === id || b === carbonyl && a === id)?.[2] ?? 1;
          const oxygenDouble = oxygens.find(item => order(item.id) === 2)!.id;
          const oxygenSingle = oxygens.find(item => order(item.id) === 1)!.id;
          const appended = { elements: ["C", "O", "O"], bonds: [[1, 6, 1], [6, 7, 2], [6, 8, 1]] as [number, number, number][],
            forced: new Map([[6, carbonyl], [7, oxygenDouble], [8, oxygenSingle]]) };
          if (outside.length !== 3 || !bondAlternatives.some(orders => graphProof(graph, candidate.ordered, candidate.elements, orders, appended))) continue;
          const atomLocants = new Map(candidate.ordered.map((id, index) => [id, index + 1]));
          return { english: "pyrazine-2-carboxylic acid", spanish: "ácido pirazina-2-carboxílico", parent: "pyrazine",
            atomLocants, rule: "B-2.11 (retained pyrazine); C-401 (carboxylic acid on a heterocyclic parent); B-1.51–1.52; complete graph identity" };
        }
      }
    }
  } catch { return; }
}

function byIdSafe(graph: LegacyHeterocycleGraph, id: number) {
  return graph.atoms.find(atom => atom.id === id) ?? { id, element: "C" };
}
