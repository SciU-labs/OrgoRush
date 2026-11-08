import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedNameDerivation } from "./validated-name-derivation.ts";

/** Resolve subregions of the FULL acyloxy benzoic-acid construction. The ring
 * comes from the parent proof and its bonds, independent of editor ring metadata. */
export function resolveAcyloxyRegions(
  derivation: ValidatedNameDerivation, graph: GeneratedMolecule,
  parent: NameComponent, suffix: NameComponent, acyloxy: NameComponent,
) {
  if (derivation.status !== "FULL" || derivation.principalGroup !== "carboxylicAcid"
    || parent.text !== "benzoic acid" || suffix.role !== "suffix"
    || acyloxy.role !== "substituent" || acyloxy.parentId !== parent.id
    || typeof acyloxy.locant !== "number") return;

  const atoms = new Map(graph.atoms.map(atom => [atom.id, atom]));
  const neutral = (id: number, element: "C" | "O") => {
    const atom = atoms.get(id);
    return atom && (atom.element ?? "C") === element && !atom.charge;
  };
  const neighbors = (id: number) => graph.bonds.flatMap(([a, b, order = 1]) =>
    a === id ? [{ id: b, order }] : b === id ? [{ id: a, order }] : []);
  const region = (atomIds: readonly number[]) => {
    const ids = new Set(atomIds);
    return { atomIds, bondIds: graph.bonds.filter(([a, b]) => ids.has(a) && ids.has(b))
      .map(([a, b]) => [a, b] as const) };
  };

  const ringIds = parent.atomIds.filter(id => !suffix.atomIds.includes(id));
  const ring = region(ringIds);
  if (ringIds.length !== 6 || new Set(ringIds).size !== 6 || ring.bondIds.length !== 6
    || !ringIds.every(id => {
      const edges = neighbors(id).filter(edge => ringIds.includes(edge.id) && edge.id !== id);
      return neutral(id, "C") && edges.length === 2 && edges[0].id !== edges[1].id
        && edges.some(edge => edge.order === 1) && edges.some(edge => edge.order === 2);
    })) return;
  const c1 = parent.numbering.find(([, locant]) => locant === 1)?.[0];
  const site = parent.numbering.find(([, locant]) => locant === acyloxy.locant)?.[0];
  if (c1 === undefined || site === undefined || !ringIds.includes(c1) || !ringIds.includes(site)) return;
  const distance = new Map([[c1, 0]]), queue = [c1];
  for (const id of queue) {
    for (const edge of neighbors(id)) if (ringIds.includes(edge.id) && !distance.has(edge.id)) {
      distance.set(edge.id, distance.get(id)! + 1);
      queue.push(edge.id);
    }
  }
  if (distance.size !== 6 || distance.get(site) !== acyloxy.locant - 1) return;

  const acidCarbon = suffix.atomIds.find(id => neutral(id, "C"));
  if (suffix.atomIds.length !== 3 || acidCarbon === undefined || !parent.atomIds.includes(acidCarbon)) return;
  const acidEdges = neighbors(acidCarbon);
  const acidOxygens = acidEdges.filter(edge => neutral(edge.id, "O") && suffix.atomIds.includes(edge.id)
    && neighbors(edge.id).length === 1);
  if (acidEdges.length !== 3 || acidOxygens.length !== 2
    || !acidOxygens.some(edge => edge.order === 2) || !acidOxygens.some(edge => edge.order === 1)
    || !acidEdges.some(edge => edge.id === c1 && edge.order === 1)) return;
  const carboxyl = region(suffix.atomIds);

  const substituentIds = new Set(acyloxy.atomIds);
  if (substituentIds.size !== acyloxy.atomIds.length
    || [...ringIds, ...suffix.atomIds].some(id => substituentIds.has(id))) return;
  const attachments = graph.bonds.filter(([a, b]) => substituentIds.has(a) !== substituentIds.has(b));
  if (attachments.length !== 1) return;
  const [a, b, order = 1] = attachments[0];
  const linker = a === site ? b : b === site ? a : undefined;
  if (linker === undefined || order !== 1 || !substituentIds.has(linker) || !neutral(linker, "O")) return;
  const linkerEdges = neighbors(linker);
  const center = linkerEdges.find(edge => edge.order === 1 && substituentIds.has(edge.id) && neutral(edge.id, "C"))?.id;
  if (linkerEdges.length !== 2 || center === undefined) return;
  const centerEdges = neighbors(center);
  const oxo = centerEdges.find(edge => edge.order === 2 && substituentIds.has(edge.id) && neutral(edge.id, "O"))?.id;
  if (centerEdges.length !== 3 || oxo === undefined || neighbors(oxo).length !== 1) return;

  // The current FULL acyloxy grammar proves a linear saturated acyl chain.
  // Walk it from the ester carbonyl and require it to account for every carbon.
  const chain = new Set([center]);
  let previous = center, edges = centerEdges.filter(edge => edge.id !== linker && edge.id !== oxo);
  while (edges.length === 1) {
    const edge = edges[0];
    if (edge.order !== 1 || !substituentIds.has(edge.id) || !neutral(edge.id, "C") || chain.has(edge.id)) return;
    chain.add(edge.id);
    edges = neighbors(edge.id).filter(next => next.id !== previous);
    previous = edge.id;
  }
  if (edges.length || chain.size < 2 || chain.size + 2 !== substituentIds.size) return;

  const acyloxyRegion = region(acyloxy.atomIds);
  return {
    parent: region([...new Set([...parent.atomIds, ...suffix.atomIds])]),
    carboxyl, ring, locant: acyloxy.locant,
    acyloxy: { ...acyloxyRegion, bondIds: [...acyloxyRegion.bondIds, [site, linker] as const] },
    linker: region([linker]),
    acyl: region(acyloxy.atomIds.filter(id => id !== linker)),
    carbonyl: region([center, oxo]),
    methyl: chain.size === 2 ? region([previous]) : undefined,
  };
}
