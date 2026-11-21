import { Molecule } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { buildOpenChemLibStereoGraph } from "./tetrahedral-stereochemistry.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { editableValencesValid } from "./editable-valence.ts";
import { recognizeCarbohydrate, type CarbohydrateStructure } from "./carbohydrate-structure.ts";
import { deriveLocalAromaticNomenclature, type LocalAromaticNomenclature, type LocalSubstituentSelection } from "./structural-substituent-nomenclature.ts";
import type { ParentSelectionEvidence } from "./reasoning-parent-selection.ts";

export type StructuralComponent = {
  id: string;
  kind: "carboxylicAcid" | "ester" | "amide" | "carbonyl" | "hydroxyl" | "ringSystem" | "stereo" | "N-bound methyl"
    | "phenoxy fragment" | "substituted phenoxy fragment" | "methoxy fragment"
    | "fragment connection" | "amine fragment" | "trifluoromethyl group" | "ether linkage" | "benzyl fragment"
    | "carbohydrate backbone" | "ring oxygen" | "hemiacetal" | "hemiketal" | "configurational reference" | "anomeric centre"
    | "candidate carbon skeleton" | "connected fragment" | "aromatic ring locant" | "aromatic substituent fragment";
  atomIds: number[];
  bondIds: [number, number][];
  evidence: string;
  evidenceEs?: string;
  kindEs?: string;
  displayLabel?: string;
  displayLabelEs?: string;
  numbering?: [number,number|string][];
  nomenclature?: LocalAromaticNomenclature;
    nestedSelections?: LocalSubstituentSelection[];
  /** Nearest strictly containing graph component; structural containment only. */
  parentComponentId?: string;
};
export type StructuralDerivation = {
  status: "FULL" | "PARTIAL" | "UNSUPPORTED";
  name: { text: string; classification: "unverified"; preferred: false };
  components: StructuralComponent[];
  limitations: string[];
  carbohydrate?: CarbohydrateStructure;
};
const key = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const structuralComponentId = (kind: StructuralComponent["kind"], ids: readonly number[]) =>
  `graph:${kind}:${[...new Set(ids)].sort((a,b)=>a-b).join(",")}`;

function assignStructuralContainment(components: StructuralComponent[]) {
  const excluded = new Set<StructuralComponent["kind"]>([
    "fragment connection", "candidate carbon skeleton", "stereo",
    "configurational reference", "anomeric centre", "aromatic ring locant",
  ]);
  const byId = new Map(components.map(component => [component.id, component]));
  for (const child of components) {
    if (excluded.has(child.kind) || !child.atomIds.length) continue;
    const childAtoms = new Set(child.atomIds);
    const containers = components.filter(candidate => candidate !== child && !excluded.has(candidate.kind)
      && candidate.atomIds.length > childAtoms.size && [...childAtoms].every(id => candidate.atomIds.includes(id)));
    if (!containers.length) continue;
    const nearestSize = Math.min(...containers.map(candidate => candidate.atomIds.length));
    const nearest = containers.filter(candidate => candidate.atomIds.length === nearestSize);
    if (nearest.length === 1 && byId.has(nearest[0].id)) child.parentComponentId = nearest[0].id;
  }
}

/** Returns a unique longest path in the acyclic carbon-only graph, if one is
 * structurally distinguishable. This is candidate skeleton evidence only;
 * it never assigns IUPAC parent status or locants. */
function uniqueLongestAcyclicCarbonPath(graph: GeneratedMolecule, ringAtomIds: ReadonlySet<number>): number[] | null {
  const carbonIds = graph.atoms.filter(atom => (atom.element ?? "C") === "C" && !ringAtomIds.has(atom.id)).map(atom => atom.id);
  const allowed = new Set(carbonIds);
  const adjacency = new Map(carbonIds.map(id => [id, [] as number[]]));
  const edges = graph.bonds.filter(([a, b]) => allowed.has(a) && allowed.has(b));
  for (const [a, b] of edges) { adjacency.get(a)!.push(b); adjacency.get(b)!.push(a); }
  const seen = new Set<number>(), candidates: number[][] = [];
  for (const start of carbonIds) {
    if (seen.has(start)) continue;
    const component: number[] = [], queue = [start]; seen.add(start);
    while (queue.length) {
      const id = queue.pop()!; component.push(id);
      for (const next of adjacency.get(id)!) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    if (component.length < 2) continue;
    const componentSet = new Set(component);
    const componentEdges = edges.filter(([a, b]) => componentSet.has(a) && componentSet.has(b));
    if (componentEdges.length !== component.length - 1) continue;
    let longest = 0;
    const pathSets = new Map<string, number[]>();
    for (const source of component) {
      const parent = new Map<number, number | null>([[source, null]]), distances = new Map([[source, 0]]), pending = [source];
      while (pending.length) {
        const id = pending.shift()!;
        for (const next of adjacency.get(id)!) if (!distances.has(next)) {
          distances.set(next, distances.get(id)! + 1); parent.set(next, id); pending.push(next);
        }
      }
      for (const target of component) {
        if (target === source) continue;
        const length = distances.get(target)!;
        let path: number[] = [], current: number | null = target;
        while (current !== null) { path.push(current); current = parent.get(current) ?? null; }
        const signature = [...path].sort((a, b) => a - b).join(",");
        if (length > longest) { longest = length; pathSets.clear(); }
        if (length === longest) pathSets.set(signature, path.reverse());
      }
    }
    if (pathSets.size === 1) candidates.push([...pathSets.values()][0]);
  }
  if (!candidates.length) return null;
  const maximum = Math.max(...candidates.map(path => path.length));
  const longestCandidates = candidates.filter(path => path.length === maximum);
  const signatures = new Set(longestCandidates.map(path => [...path].sort((a, b) => a - b).join(",")));
  return signatures.size === 1 ? longestCandidates[0] : null;
}

/** Text cards and SVG selections consume exactly the same component evidence. */
export function structuralVisualTargets(model: StructuralDerivation): Record<string, ReasoningVisualTarget> {
  return Object.fromEntries(model.components.map(c => [c.id, {
    stepNumber: c.id, atomIds: c.atomIds, bondIds: c.bondIds, locants: c.numbering??[],
  }]));
}

function remapCarbonDerivation(derivation: import("./structural-substituent-nomenclature.ts").CarbonSubstituentDerivation,
  map: ReadonlyMap<number, number>): import("./structural-substituent-nomenclature.ts").CarbonSubstituentDerivation {
  return { ...derivation, rootAtomId: map.get(derivation.rootAtomId)!, atomIds: derivation.atomIds.map(id=>map.get(id)!),
    bondIds: derivation.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
    chainAtomIds: derivation.chainAtomIds.map(id=>map.get(id)!),
    chainBonds: derivation.chainBonds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
    numbering: derivation.numbering.map(([id,locant]):[number,number]=>[map.get(id)!,locant]),
    branches: derivation.branches.map(branch=>({...branch,parentAtomId:map.get(branch.parentAtomId)!,
      attachmentBondIds:branch.attachmentBondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
      derivation:remapCarbonDerivation(branch.derivation,map)})),
  };
}

export function remapStructuralDerivation(model: StructuralDerivation, source: GeneratedMolecule, target: GeneratedMolecule): StructuralDerivation | null {
  const map = mapStructuralRegions(source, target, model.components.map(c => c.atomIds));
  if (!map) return null;
  const mappedIds = new Map(model.components.map(c => [c.id, c.id.startsWith("graph:")
    ? structuralComponentId(c.kind, c.atomIds.map(id => map.get(id)!)) : c.id]));
  const components = model.components.map(c => ({ ...c,
    ...(c.id.startsWith("graph:") ? { id: structuralComponentId(c.kind, c.atomIds.map(id => map.get(id)!)) } : {}),
    ...(c.parentComponentId ? { parentComponentId: mappedIds.get(c.parentComponentId) } : {}),
    atomIds: c.atomIds.map(id => map.get(id)!),
    bondIds: c.bondIds.map(([a, b]): [number,number] => [map.get(a)!, map.get(b)!]),
    ...(c.numbering?{numbering:c.numbering.map(([id,p]):[number,number|string]=>[map.get(id)!,p])}:{}),
      ...(c.nestedSelections?{nestedSelections:c.nestedSelections.map(selection=>({...selection,
        atomIds:selection.atomIds.map(id=>map.get(id)!),
        bondIds:selection.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
        locants:selection.locants.map(([id,locant]):[number,number]=>[map.get(id)!,locant]),
      }))}:{}),
    ...(c.nomenclature?{nomenclature:{...c.nomenclature,
      attachmentAtomId:map.get(c.nomenclature.attachmentAtomId)!,
      ...(c.nomenclature.linkerAtomId!==undefined?{linkerAtomId:map.get(c.nomenclature.linkerAtomId)!}:{}),
      attachmentBondIds:c.nomenclature.attachmentBondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
      numbering:c.nomenclature.numbering.map(([id,p]):[number,number]=>[map.get(id)!,p]),
        substituents:c.nomenclature.substituents.map(item=>({...item,
        atomIds:item.atomIds.map(id=>map.get(id)!),
        bondIds:item.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
          ...(item.derivation?{derivation:remapCarbonDerivation(item.derivation,map)}:{}),
          ...(item.nestedSelections?{nestedSelections:item.nestedSelections.map(selection=>({...selection,
            atomIds:selection.atomIds.map(id=>map.get(id)!),
            bondIds:selection.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
            locants:selection.locants.map(([id,locant]):[number,number]=>[map.get(id)!,locant]),
          }))}:{}),
      })),
        nestedSelections:c.nomenclature.nestedSelections.map(selection=>({...selection,
          atomIds:selection.atomIds.map(id=>map.get(id)!),
          bondIds:selection.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
          locants:selection.locants.map(([id,locant]):[number,number]=>[map.get(id)!,locant]),
        })),
    }}:{}),
  }));
  return { ...model, components, ...(model.carbohydrate?{carbohydrate:recognizeCarbohydrate(target)??undefined}:{}) };
}

function normalized(graph: GeneratedMolecule) {
  if (!graph.atoms.length || graph.atoms.length > 120 || new Set(graph.atoms.map(a => a.id)).size !== graph.atoms.length)
    throw new Error("invalid or oversized graph");
  if (!editableValencesValid(graph)) throw new Error("invalid valence");
  const ids = new Set(graph.atoms.map(a => a.id));
  // The editor has no isotope field. Never silently ignore isotope metadata
  // supplied by a caller that bypasses the guarded SMILES importer.
  if (graph.atoms.some(a => "isotope" in a || "massNumber" in a || "mass" in a)) throw new Error("isotope metadata unsupported");
  const seen = new Set<string>();
  for (const [a, b, order = 1] of graph.bonds) {
    if (!ids.has(a) || !ids.has(b) || a === b || seen.has(key(a, b)) || ![1, 2, 3].includes(order)) throw new Error("invalid edge");
    seen.add(key(a, b));
  }
  const { molecule, atomIdToIndex } = buildOpenChemLibStereoGraph(graph);
  molecule.ensureHelperArrays(Molecule.cHelperRings);
  const edges = new Map(graph.bonds.map(([a, b, order = 1], i) => [key(a, b), molecule.isAromaticBond(i) ? 4 : order]));
  const labels = new Map(graph.atoms.map(a => {
    const i = atomIdToIndex.get(a.id)!;
    return [a.id, `${a.element ?? "C"}:${a.charge ?? 0}:${molecule.getImplicitHydrogens(i)}:${a.tetrahedralParity ?? "?"}:${graph.bonds.filter(([x, y]) => x === a.id || y === a.id).length}`];
  }));
  return { molecule, atomIdToIndex, edges, labels };
}

/** Enumerate constitutional correspondences and require fragment images to be
 * invariant under every automorphism. Bounded search fails closed. Absolute
 * R/S is part of the atom label. E/Z requires a separate verified projection. */
export type StructuralEquivalence = {
  representative: Map<number, number>;
  mappings: Map<number, number>[];
  atomOrbits: number[][];
};

function correspondences(source: GeneratedMolecule, target: GeneratedMolecule, regions: readonly (readonly number[])[], collect: boolean, firstOnly=false): StructuralEquivalence | null {
  try {
    if (source.atoms.length !== target.atoms.length || source.bonds.length !== target.bonds.length
      || [...source.bonds, ...target.bonds].some(b => b[3] !== undefined)) return null;
    const a = normalized(source), b = normalized(target);
    if (regions.some(r => r.some(id => !a.labels.has(id)))) return null;
    const options = new Map(source.atoms.map(atom => [atom.id, target.atoms.filter(t => a.labels.get(atom.id) === b.labels.get(t.id)).map(t => t.id)]));
    const order = source.atoms.map(atom => atom.id).sort((x, y) => options.get(x)!.length - options.get(y)!.length);
    const assigned = new Map<number, number>(), used = new Set<number>();
    let visits = 0, exhausted = false, ambiguous = false;
    let answer: Map<number, number> | null = null;
    const mappings: Map<number, number>[] = [];
    let images: string[] | undefined;
    function visit(depth: number) {
      if (++visits > 20000) { exhausted = true; return; }
      if (depth === order.length) {
        const next = regions.map(r => [...new Set(r.map(id => assigned.get(id)!))].sort((x, y) => x - y).join(","));
        if (!collect && images && next.some((image, i) => image !== images![i])) ambiguous = true;
        images = next; answer ??= new Map(assigned);
      if(firstOnly)return;
        mappings.push(new Map(assigned));
        if (mappings.length > 256) exhausted = true;
        return;
      }
      const id = order[depth];
      for (const other of options.get(id)!) {
        if (used.has(other) || [...assigned].some(([x, y]) => a.edges.get(key(id, x)) !== b.edges.get(key(other, y)))) continue;
        assigned.set(id, other); used.add(other); visit(depth + 1); used.delete(other); assigned.delete(id);
        if (exhausted || ambiguous || firstOnly&&answer) return;
      }
    }
    visit(0);
    if (exhausted || ambiguous || !answer) return null;
    const orbits = source.atoms.map(atom => [...new Set(mappings.map(map => map.get(atom.id)!))].sort((a,b)=>a-b));
    const uniqueOrbits = [...new Map(orbits.filter(orbit=>orbit.length>1).map(orbit=>[orbit.join(","),orbit])).values()];
    return { representative: answer, mappings, atomOrbits: uniqueOrbits };
  } catch { return null; }
}

/** Strict historical contract: every referenced region has one invariant image. */
export function mapStructuralRegions(source: GeneratedMolecule, target: GeneratedMolecule, regions: readonly (readonly number[])[]): Map<number, number> | null {
  return correspondences(source,target,regions,false)?.representative ?? null;
}

/** Return one complete graph isomorphism when the independently proved name
 * admits symmetry-equivalent numbered orientations. The caller's grammar
 * must establish locants before using this correspondence. */
export function mapStructuralRepresentative(source:GeneratedMolecule,target:GeneratedMolecule):Map<number,number>|null {
  return correspondences(source,target,[],false,true)?.representative??null;
}

/** All bounded full-graph isomorphisms. Composing any two gives an
 * automorphism of the same chemical graph, not a tautomer or partial match. */
export function analyzeStructuralEquivalence(source: GeneratedMolecule, target: GeneratedMolecule): StructuralEquivalence | null {
  return correspondences(source,target,[],true);
}

/** Full graph automorphisms must permute the proposed set transitively. */
export function regionsFormOrbit(regions: readonly number[][], automorphisms: readonly Map<number,number>[]): boolean {
  if (!regions.length || !automorphisms.length) return false;
  const key = (ids: number[]) => [...ids].sort((a,b) => a-b).join(",");
  const expected = new Set(regions.map(key)), images = new Set<string>();
  if (expected.size !== regions.length) return false;
  for (const mapping of automorphisms) {
    for (const [index, region] of regions.entries()) {
      const image = key(region.map(id => mapping.get(id)!));
      if (!expected.has(image)) return false;
      if (index === 0) images.add(image);
    }
  }
  return images.size === expected.size;
}

/** Structural evidence only: no external-name token parsing, parent selection,
 * locants or unspecified stereo assignments are performed by this fallback. */
export function deriveStructuralComponents(graph: GeneratedMolecule, displayedName: string, analyzedCandidate?: readonly number[],
  nomenclatureProfile: "blue-book-2013"|"iupac-1979-legacy" = "blue-book-2013",
  parentSelection?: ParentSelectionEvidence): StructuralDerivation {
  const result: StructuralDerivation = { status: "UNSUPPORTED", name: { text: displayedName, classification: "unverified", preferred: false },
    components: [], limitations: ["External-name fragments, parent selection and locants have not been reconciled with this graph."] };
  try {
    const { molecule, atomIdToIndex } = normalized(graph);
    const neighbors = (id: number) => graph.bonds.filter(([a, b]) => a === id || b === id)
      .map(([a, b, order = 1]) => ({ id: a === id ? b : a, order }));
    const atom = (id: number) => graph.atoms.find(a => a.id === id)!;
    const neutral = (id: number) => !(atom(id).charge ?? 0);
    const hydrogen = (id: number) => molecule.getImplicitHydrogens(atomIdToIndex.get(id)!);
    const add = (kind: StructuralComponent["kind"], ids: number[], evidence: string, numbering?:StructuralComponent['numbering'], evidenceEs?:string, extraBonds:[number,number][] = []) => {
      const region = [...new Set(ids)], included = new Set(region);
      const bondMap = new Map<string,[number,number]>();
      for (const [a,b] of [...graph.bonds.filter(([a, b]) => included.has(a) && included.has(b)), ...extraBonds]) bondMap.set(key(a,b),[a,b]);
      result.components.push({ id: `structural-${result.components.length}`, kind, atomIds: region,
        bondIds: [...bondMap.values()], evidence,...(numbering?{numbering}:{}),
        ...(evidenceEs?{evidenceEs}:{}), kindEs: ({carboxylicAcid:'Ácido carboxílico',ester:'Éster',amide:'Amida',carbonyl:'Carbonilo',hydroxyl:'Hidroxilo',ringSystem:'Sistema de anillos',stereo:'Estereoquímica','N-bound methyl':'Metilo unido a N','phenoxy fragment':'Fragmento fenoxi','substituted phenoxy fragment':'Fragmento fenoxi sustituido','methoxy fragment':'Fragmento metoxi','fragment connection':'Conexión entre fragmentos','amine fragment':'Función amina','trifluoromethyl group':'Grupo trifluorometil','ether linkage':'Enlace éter','benzyl fragment':'Fragmento bencílico','carbohydrate backbone':'Esqueleto de carbohidrato','ring oxygen':'Oxígeno del anillo',hemiacetal:'Hemiacetal',hemiketal:'Hemicetal','configurational reference':'Referencia configuracional','anomeric centre':'Centro anomérico','candidate carbon skeleton':'Candidato de cadena carbonada','connected fragment':'Fragmento conectado','aromatic ring locant':'Localizador del anillo aromático','aromatic substituent fragment':'Fragmento sustituyente aromático'} as const)[kind] });
    };
    const acylOxygens = new Set<number>();
    for (const c of graph.atoms.filter(a => (a.element ?? "C") === "C" && neutral(a.id))) {
      const ns = neighbors(c.id);
      const oxo = ns.filter(n => n.order === 2 && atom(n.id).element === "O" && neutral(n.id) && neighbors(n.id).length === 1);
      if (oxo.length !== 1) continue;
      const singleO = ns.find(n => n.order === 1 && atom(n.id).element === "O" && neutral(n.id));
      const nitrogen = ns.find(n => n.order === 1 && atom(n.id).element === "N" && neutral(n.id));
      if (singleO && hydrogen(singleO.id) === 1 && neighbors(singleO.id).length === 1) {
        acylOxygens.add(singleO.id); add("carboxylicAcid", [c.id, oxo[0].id, singleO.id], "C(=O)–OH; neutral oxygen with one implicit hydrogen.",undefined,"C(=O)–OH; oxígeno neutro con un hidrógeno implícito.");
      } else if (singleO && neighbors(singleO.id).length === 2 && neighbors(singleO.id).every(n => n.order === 1 && (atom(n.id).element ?? "C") === "C")) {
        acylOxygens.add(singleO.id); add("ester", [c.id, oxo[0].id, singleO.id], "C(=O)–O–C; ester linkage established by connectivity.",undefined,"C(=O)–O–C; el enlace éster se establece por conectividad.");
      } else if (nitrogen) add("amide", [c.id, oxo[0].id, nitrogen.id], "C(=O)–N; amide linkage established by connectivity.",undefined,"C(=O)–N; la conectividad confirma el enlace amida.");
      else add("carbonyl", [c.id, oxo[0].id], "A carbon–oxygen double bond is present; no suffix priority is inferred.",undefined,"Hay un enlace doble carbono–oxígeno; no se infiere prioridad de sufijos.");
    }
    for (const o of graph.atoms.filter(a => a.element === "O" && neutral(a.id) && !acylOxygens.has(a.id))) {
      const ns = neighbors(o.id);
      if (ns.length === 1 && ns[0].order === 1 && (atom(ns[0].id).element ?? "C") === "C" && hydrogen(o.id) === 1)
        add("hydroxyl", [o.id, ns[0].id], "C–OH; oxygen has one implicit hydrogen. No carbohydrate anomer is inferred.",undefined,"C–OH; el oxígeno tiene un hidrógeno implícito. No se infiere un anómero de carbohidrato.");
    }
    // Ring edges are determined by OCL, independent of editor ring metadata.
    const ringEdges = graph.bonds.filter((_, i) => molecule.isRingBond(i));
    const pending = new Set(ringEdges.flatMap(([a, b]) => [a, b]));
    while (pending.size) {
      const region = new Set<number>(), queue = [pending.values().next().value!];
      while (queue.length) {
        const id = queue.pop()!; if (region.has(id)) continue;
        region.add(id); pending.delete(id);
        for (const [a, b] of ringEdges) if (a === id || b === id) queue.push(a === id ? b : a);
      }
      const ids = [...region], count = ringEdges.filter(([a, b]) => region.has(a) && region.has(b)).length - ids.length + 1;
      add("ringSystem", ids, `Connected ring system with ${count} independent cycle(s). Shared ring atoms belong to this same system; no parent numbering is assigned.`,undefined,`Sistema de anillos conectado con ${count} ciclo(s) independiente(s). Los átomos compartidos pertenecen al mismo sistema; no se asigna numeración parental.`);
    }
    // Refine each OCL ring-edge component with chemical composition, aromaticity
    // and its external connectivity. Simple cycles remain independently
    // selectable; fused, spiro and bridged systems stay one connected region.
    const ringComponents = result.components.filter(item => item.kind === "ringSystem")
      .sort((left,right) => Math.min(...left.atomIds) - Math.min(...right.atomIds));
    for (const [ringIndex, component] of ringComponents.entries()) {
      const region = new Set(component.atomIds);
      component.id = structuralComponentId(component.kind, component.atomIds);
      const internalEdges = ringEdges.filter(([a,b]) => region.has(a) && region.has(b));
      component.bondIds = internalEdges.map(([a,b]) => [a,b]);
      const cycleCount = internalEdges.length - region.size + 1;
      const simpleCycle = cycleCount === 1 && internalEdges.length === region.size
        && [...region].every(id => internalEdges.filter(([a,b]) => a === id || b === id).length === 2);
      const aromatic = simpleCycle && [...region].every(id => molecule.isAromaticAtom(atomIdToIndex.get(id)!));
      const allCarbon = [...region].every(id => (atom(id).element ?? "C") === "C");
      const attachments = graph.bonds.filter(([a,b]) => region.has(a) !== region.has(b)).map(([a,b,order=1]) => {
        const ringAtom = region.has(a) ? a : b, outerAtom = region.has(a) ? b : a;
        return { ringAtom, outerAtom, order, ringElement: atom(ringAtom).element ?? "C", outerElement: atom(outerAtom).element ?? "C" };
      });
      const externalBondTypes=[...new Set(attachments.map(edge=>`${edge.ringElement}–${edge.outerElement}`))].sort();
      const etherO = attachments.find(edge => edge.order === 1 && edge.ringElement === "C" && edge.outerElement === "O"
        && neighbors(edge.outerAtom).some(next => next.id !== edge.ringAtom && next.order === 1 && (atom(next.id).element ?? "C") === "C"));
      const benzene = aromatic && allCarbon && region.size === 6;
      component.displayLabel = benzene
        ? externalBondTypes.length ? `Benzene ring · external bonds ${externalBondTypes.join(", ")}` : "Benzene ring · six carbon atoms"
        : simpleCycle ? `${aromatic ? "Aromatic" : "Nonaromatic"} ${region.size}-membered ring` : `Connected ring system · ${cycleCount} independent cycles`;
      component.displayLabelEs = benzene
        ? externalBondTypes.length ? `Anillo bencénico · enlaces externos ${externalBondTypes.join(", ")}` : "Anillo bencénico · seis carbonos"
        : simpleCycle ? `${aromatic ? "Anillo aromático" : "Anillo no aromático"} de ${region.size} átomos` : `Sistema de anillos conectado · ${cycleCount} ciclos independientes`;
      if (ringComponents.length > 1) {
        component.displayLabel = `Ring ${ringIndex + 1}: ${component.displayLabel}`;
        component.displayLabelEs = `Anillo ${ringIndex + 1}: ${component.displayLabelEs}`;
      }
      if (simpleCycle) {
        const elements = [...new Set([...region].map(id => atom(id).element ?? "C"))].sort().join("/");
        const linkTypes = [...new Set(attachments.map(edge => `${edge.ringElement}–${edge.outerElement}`))];
        const connections = linkTypes.length ? linkTypes.join(", ") : "none";
        component.evidence = `OpenChemLib ${aromatic ? "confirms aromaticity" : "does not classify this ring as aromatic"} for this ${region.size}-atom cycle containing ${elements}. External connections are ${connections}; they are excluded from the ring selection. No parent or name locants are assigned.`;
        component.evidenceEs = `OpenChemLib ${aromatic ? "confirma la aromaticidad" : "no clasifica este anillo como aromático"} para este ciclo de ${region.size} átomos con ${elements}. Las conexiones externas son ${connections}; quedan fuera de la selección del anillo. No se asignan padre ni localizadores del nombre.`;
      } else {
        const aromaticSystem = [...region].every(id => molecule.isAromaticAtom(atomIdToIndex.get(id)!));
        const elements = [...new Set([...region].map(id => atom(id).element ?? "C"))].sort().join("/");
        component.evidence = `OpenChemLib identifies a ${aromaticSystem ? "fully aromatic" : "partly or nonaromatic"} connected ring system with ${cycleCount} independent cycles, ${region.size} atoms (${elements}), and shared ring atoms. It is one connected system, not ${cycleCount} separate ring systems; no parent numbering is assigned.`;
        component.evidenceEs = `OpenChemLib identifica un sistema de anillos conectado ${aromaticSystem ? "completamente aromático" : "parcial o no aromático"}, con ${cycleCount} ciclos independientes, ${region.size} átomos (${elements}) y átomos de anillo compartidos. Es un solo sistema conectado, no ${cycleCount} sistemas separados; no se asigna numeración parental.`;
      }
      if (benzene && simpleCycle) {
        const benzylicCarbons = [...region].flatMap(ringCarbon => neighbors(ringCarbon)
          .filter(next => !region.has(next.id) && next.order === 1 && (atom(next.id).element ?? "C") === "C"
            && neutral(next.id) && hydrogen(next.id) === 2 && neighbors(next.id).length === 2)
          .map(next => next.id));
        for (const carbon of [...new Set(benzylicCarbons)]) {
          const ids = [...region,carbon], index = result.components.length;
          add("benzyl fragment", ids,
            "An aromatic carbon is directly bonded to a neutral methylene carbon (Ar–CH2–). This is a benzylic/benzyl structural topology; no correspondence to the displayed name or parent is asserted.", undefined,
            "Un carbono aromático se enlaza directamente a un carbono metileno neutro (Ar–CH2–). Es una topología bencílica/bencilo; no se afirma correspondencia con el nombre mostrado ni con su padre.");
          const prefix = ringComponents.length > 1 ? `Ring ${ringIndex + 1}: ` : "";
          const prefixEs = ringComponents.length > 1 ? `Anillo ${ringIndex + 1}: ` : "";
          result.components[index].displayLabel = `${prefix}Benzylic motif · ring + CH2`;
          result.components[index].displayLabelEs = `${prefixEs}Motivo bencílico · anillo + CH2`;
          result.components[index].id = structuralComponentId("benzyl fragment", ids);
        }
      }
      if (!benzene || !etherO) continue;
      const oxygenNeighbors = neighbors(etherO.outerAtom);
      if (!neutral(etherO.outerAtom) || oxygenNeighbors.length !== 2 || oxygenNeighbors.some(next => next.order !== 1)
        || !oxygenNeighbors.some(next => next.id === etherO.ringAtom)) continue;
      const oxygen = etherO.outerAtom, externalCarbon = oxygenNeighbors.find(next => next.id !== etherO.ringAtom)!.id;
      const terminalMethyl = neutral(externalCarbon) && neighbors(externalCarbon).length === 1 && hydrogen(externalCarbon) === 3;
      const phenoxyIds = [...region, oxygen];
      const phenoxyIndex = result.components.length;
      add(terminalMethyl ? "methoxy fragment" : "phenoxy fragment", terminalMethyl ? [...phenoxyIds, externalCarbon] : phenoxyIds,
        terminalMethyl
          ? "The aromatic ring is bonded to an ether oxygen connected to a terminal methyl carbon. This is a graph-supported methoxy substituent topology; no name locant or parent is inferred."
          : "The aromatic ring is bonded to an external ether oxygen that connects onward to a larger carbon fragment. This graph fragment has phenoxy connectivity; the displayed name remains unreconciled.", undefined,
        terminalMethyl
          ? "El anillo aromático se une a un oxígeno éter conectado a un carbono metilo terminal. El grafo demuestra la topología de un sustituyente metoxi; no se infiere localizador ni padre."
          : "El anillo aromático se une a un oxígeno éter externo que conecta con un fragmento carbonado mayor. Este fragmento tiene conectividad fenoxi; el nombre mostrado sigue sin conciliarse.");
      const ringPrefix = ringComponents.length > 1 ? `Ring ${ringIndex + 1}: ` : "";
      const ringPrefixEs = ringComponents.length > 1 ? `Anillo ${ringIndex + 1}: ` : "";
      result.components[phenoxyIndex].displayLabel = `${ringPrefix}${terminalMethyl ? "Methoxy group · ring + O + C" : "Phenoxy group · ring + O"}`;
      result.components[phenoxyIndex].displayLabelEs = `${ringPrefixEs}${terminalMethyl ? "Grupo metoxi · anillo + O + C" : "Grupo fenoxi · anillo + O"}`;
      const ringAdjacency = new Map([...region].map(id => [id, [] as number[]]));
      for (const [a,b] of internalEdges) { ringAdjacency.get(a)!.push(b); ringAdjacency.get(b)!.push(a); }
      for (const opposite of region) {
        if (opposite === etherO.ringAtom) continue;
        const distance = (() => {
          const queue: [number,number][] = [[etherO.ringAtom,0]], seen = new Set<number>();
          while (queue.length) { const [current,depth] = queue.shift()!; if (current === opposite) return depth;
            if (seen.has(current)) continue; seen.add(current);
            for (const next of ringAdjacency.get(current)!) queue.push([next,depth+1]); }
          return -1;
        })();
        if (distance !== 3) continue;
        const attachedCarbons = neighbors(opposite).filter(next => !region.has(next.id) && next.order === 1 && (atom(next.id).element ?? "C") === "C");
        if (attachedCarbons.length !== 1) continue;
        const cf3 = attachedCarbons[0].id, cf3Neighbors = neighbors(cf3);
        const fluorines = cf3Neighbors.filter(next => next.order === 1 && atom(next.id).element === "F");
        if (!neutral(cf3) || fluorines.length !== 3 || cf3Neighbors.length !== 4
          || fluorines.some(fluorine => !neutral(fluorine.id))) continue;
        const expandedIndex = result.components.length;
        add("substituted phenoxy fragment", [...phenoxyIds, cf3, ...fluorines.map(next => next.id)],
          "A CF3 substituent is attached to the ring carbon three ring bonds from the O attachment. The para relationship is established by cycle connectivity, without assigning name locants or a parent.", undefined,
          "Un sustituyente CF3 está unido al carbono del anillo situado a tres enlaces cíclicos de la conexión con O. La conectividad demuestra la relación para, sin asignar localizadores del nombre ni padre.");
        result.components[expandedIndex].displayLabel = `${ringPrefix}4-(Trifluoromethyl)phenoxy fragment · ring + O + CF3`;
        result.components[expandedIndex].displayLabelEs = `${ringPrefixEs}Fragmento 4-(trifluorometil)fenoxi · anillo + O + CF3`;
        break;
      }
    }
    const ringAtomIds = new Set(ringEdges.flatMap(([a, b]) => [a, b]));
    const analyzedPath = analyzedCandidate && analyzedCandidate.length >= 2 && new Set(analyzedCandidate).size === analyzedCandidate.length
      && analyzedCandidate.every(id => graph.atoms.some(atom => atom.id === id && (atom.element ?? "C") === "C" && !ringAtomIds.has(id)))
      && analyzedCandidate.slice(1).every((id, index) => graph.bonds.some(([a, b]) => a === analyzedCandidate[index] && b === id || b === analyzedCandidate[index] && a === id))
      ? [...analyzedCandidate] : undefined;
    const carbonSkeleton = analyzedPath ?? uniqueLongestAcyclicCarbonPath(graph, ringAtomIds);
    if (carbonSkeleton) {
      const skeleton = new Set(carbonSkeleton);
      add("candidate carbon skeleton", carbonSkeleton,
        analyzedPath
          ? `The local structure analysis identifies a connected ${carbonSkeleton.length}-carbon path. It remains a candidate only; longest-parent priority and name locants are not inferred.`
          : `The graph contains a unique acyclic path of ${carbonSkeleton.length} carbon atoms, compatible with a ${carbonSkeleton.length}-carbon alkane skeleton. It remains a candidate only; parent selection and name locants require nomenclature reconciliation.`, undefined,
        analyzedPath
          ? `El análisis estructural local identifica un camino conectado de ${carbonSkeleton.length} carbonos. Sigue siendo candidato; no se infieren la prioridad del padre más largo ni localizadores del nombre.`
          : `El grafo contiene un camino acíclico único de ${carbonSkeleton.length} átomos de carbono, compatible con un esqueleto alcano de ${carbonSkeleton.length} carbonos. Sigue siendo candidato; la selección del padre y sus localizadores requieren conciliación nomenclatural.`);
      const outside = new Set(graph.atoms.map(atom => atom.id).filter(id => !skeleton.has(id))), pendingOutside = new Set(outside);
      while (pendingOutside.size) {
        const start = pendingOutside.values().next().value!, region = new Set<number>(), queue = [start];
        while (queue.length) {
          const id = queue.pop()!; if (region.has(id)) continue;
          region.add(id); pendingOutside.delete(id);
          for (const [a, b] of graph.bonds) if (a === id && outside.has(b) || b === id && outside.has(a)) queue.push(a === id ? b : a);
        }
        const attachments = graph.bonds.filter(([a, b]) => region.has(a) && skeleton.has(b) || region.has(b) && skeleton.has(a))
          .map(([a, b]) => [a, b] as [number, number]);
        if (!attachments.length) continue;
        const attachmentCodes = [...new Set(attachments.map(([a,b]) => {
          const left = region.has(a) ? a : b, right = region.has(a) ? b : a;
          return `${atom(left).element ?? "C"}–${atom(right).element ?? "C"}`;
        }))];
        const aromaticRegion = result.components.find(component => component.kind === "ringSystem"
          && component.atomIds.length === 6 && component.atomIds.every(id => region.has(id))
          && component.atomIds.every(id => molecule.isAromaticAtom(atomIdToIndex.get(id)!)));
        const hasCf3 = [...region].some(id => {
          const ns = neighbors(id), fluorines = ns.filter(next => next.order === 1 && atom(next.id).element === "F" && neutral(next.id));
          const framework = ns.filter(next => atom(next.id).element !== "F");
          return (atom(id).element ?? "C") === "C" && neutral(id) && fluorines.length === 3 && ns.length === 4
            && framework.length === 1 && framework[0].order === 1 && (atom(framework[0].id).element ?? "C") === "C";
        });
        const hasNitrogen = [...region].some(id => atom(id).element === "N");
        const hasArylEther = [...region].some(id => atom(id).element === "O" && neutral(id)
          && neighbors(id).length === 2 && neighbors(id).every(next => next.order === 1)
          && neighbors(id).some(next => region.has(next.id) && molecule.isAromaticAtom(atomIdToIndex.get(next.id)!)));
        const composition = [...new Set([...region].map(id => atom(id).element ?? "C"))].sort().join("/");
        const connectionText = attachmentCodes.join(", ");
        const fragmentLabel = aromaticRegion && hasCf3 && hasArylEther
          ? { en: "CF3-substituted aryl ether branch", es: "Rama de éter arílico con CF3" }
          : aromaticRegion && hasArylEther
            ? { en: "Aryl ether branch", es: "Rama de éter arílico" }
            : aromaticRegion && attachmentCodes.includes("C–C")
              ? { en: "Aromatic branch · direct C–C link", es: "Rama aromática · unión directa C–C" }
              : hasNitrogen && attachmentCodes.includes("N–C")
                ? { en: "Nitrogen-containing fragment · C–N bond", es: "Fragmento con nitrógeno · enlace C–N" }
                : [...region].every(id => atom(id).element === "C")
                  ? { en: `Acyclic carbon fragment · ${region.size} atom(s)`, es: `Fragmento carbonado acíclico · ${region.size} átomo(s)` }
                  : { en: `Unclassified connected fragment · ${composition}`, es: `Fragmento conectado no clasificado · ${composition}` };
        const attachmentSummary = attachments.map(([a,b,order=1]) => {
          const inner = region.has(a) ? a : b, outer = region.has(a) ? b : a;
          return `${atom(inner).element ?? "C"}${order === 2 ? "=" : order === 3 ? "≡" : "–"}${atom(outer).element ?? "C"}`;
        }).join(", ");
        const fragmentIndex = result.components.length;
        add("connected fragment", [...region],
          `${fragmentLabel.en}. It contains ${region.size} connected atoms (${composition}); the external connection to the candidate carbon path is ${attachmentSummary}. The selected region includes that boundary bond for context. It is structural evidence, not a verified substituent or name locant.`, undefined,
          `${fragmentLabel.es}. Contiene ${region.size} átomos conectados (${composition}); la conexión externa con el camino carbonado candidato es ${attachmentSummary}. La selección incluye ese enlace de borde para mostrar la conexión. Es evidencia estructural, no un sustituyente ni localizador del nombre ya verificado.`, attachments);
        result.components[fragmentIndex].displayLabel = fragmentLabel.en;
        result.components[fragmentIndex].displayLabelEs = fragmentLabel.es;
        result.components[fragmentIndex].id = structuralComponentId("connected fragment", [...region]);
        for (const [a,b,order=1] of attachments) {
          const inner = region.has(a) ? a : b, outer = region.has(a) ? b : a;
          const left = atom(inner).element ?? "C", right = atom(outer).element ?? "C";
          const connectionType = `${left}–${right}`;
          const context = hasArylEther && connectionType === "O–C" ? "aryl ether" : aromaticRegion ? "aromatic branch" : hasNitrogen ? "nitrogen fragment" : "structural fragment";
          const connectionIndex = result.components.length;
          add("fragment connection", [inner,outer],
            `A ${order === 1 ? "single" : order === 2 ? "double" : "triple"} ${connectionType} bond connects this ${context} to the candidate carbon path. Both endpoint atoms are shown; no name locant or parent relationship is inferred.`, undefined,
            `Un enlace ${order === 1 ? "simple" : order === 2 ? "doble" : "triple"} ${connectionType} conecta este ${context === "aryl ether" ? "éter arílico" : context === "aromatic branch" ? "fragmento aromático" : context === "nitrogen fragment" ? "fragmento nitrogenado" : "fragmento estructural"} con el camino carbonado candidato. Se muestran ambos extremos; no se infiere localizador ni relación parental del nombre.`);
          result.components[connectionIndex].displayLabel = `${connectionType} connection · ${context} to carbon path`;
          result.components[connectionIndex].displayLabelEs = `Conexión ${connectionType} · ${context === "aryl ether" ? "éter arílico" : context === "aromatic branch" ? "rama aromática" : context === "nitrogen fragment" ? "rama nitrogenada" : "fragmento estructural"} con el camino carbonado`;
          result.components[connectionIndex].id = structuralComponentId("fragment connection", [inner,outer]);
        }
      }
      // Give an aromatic substituent a local name only when its attachment to
      // this graph-supported carbon path is explicit and the internal ring is
      // a simple six-membered carbon cycle. This never consults displayedName.
      const selectedAmineParent = parentSelection?.level === "rule-supported"
        && parentSelection.reconciliation === "unverified"
        && parentSelection.amineParentSelection?.outcome === "acyclic-parent"
        ? parentSelection.candidates.find(candidate => candidate.status === "selected-by-rule"
          && candidate.evidenceKind === "parent" && candidate.regionKind === "acyclic-chain"
          && candidate.nomenclaturalAdmissibility === "candidate-unverified"
          && candidate.ruleReference === "P-44.3.2") : undefined;
      const parentPathFor = (root: number) => {
        if (!selectedAmineParent || !parentSelection?.amineParentSelection) return null;
        const ids = selectedAmineParent.atomIds, set = new Set(ids), nitrogen = parentSelection.amineParentSelection.nitrogenAtomId;
        if (ids.length < 2 || ids.some(id => !graph.atoms.some(item => item.id === id && (item.element ?? "C") === "C"))) return null;
        const adjacency = new Map(ids.map(id => [id, [] as number[]]));
        for (const [a,b,order=1] of graph.bonds) if (set.has(a) && set.has(b)) {
          if (order !== 1) return null;
          adjacency.get(a)!.push(b); adjacency.get(b)!.push(a);
        }
        if ([...adjacency.values()].reduce((count, neighbors) => count + neighbors.length, 0) !== 2 * (ids.length - 1)) return null;
        const nBoundRoots = neighbors(nitrogen).filter(edge => set.has(edge.id) && edge.order === 1);
        if (nBoundRoots.length !== 1 || (adjacency.get(nBoundRoots[0].id)?.length ?? 0) !== 1) return null;
        const ordered = [nBoundRoots[0].id]; let previous = -1, current = nBoundRoots[0].id;
        while (ordered.length < ids.length) {
          const next = (adjacency.get(current) ?? []).filter(id => id !== previous);
          if (next.length !== 1 || ordered.includes(next[0])) return null;
          previous = current; current = next[0]; ordered.push(current);
        }
        return ordered.includes(root) ? ordered : null;
      };
      for (const ringComponent of nomenclatureProfile === "blue-book-2013" ? ringComponents : []) {
        const ring = new Set(ringComponent.atomIds);
        if (ring.size !== 6 || [...ring].some(id => !molecule.isAromaticAtom(atomIdToIndex.get(id)!))) continue;
        const internal = ringEdges.filter(([a,b]) => ring.has(a) && ring.has(b)).map(([a,b])=>[a,b] as [number,number]);
        const externalCandidates = graph.bonds.flatMap(([a,b,order=1]) => {
          if (ring.has(a) === ring.has(b)) return [];
          return [{ ringAtom: ring.has(a) ? a : b, outerAtom: ring.has(a) ? b : a, order }];
        });
        for (const attachment of externalCandidates) {
          let connection: "phenyl"|"phenoxy"|"benzyl"|"phenylamino"|undefined;
          let linkerAtomId: number|undefined, rootAtomId: number|undefined;
          if (attachment.order !== 1) continue;
          if ((atom(attachment.outerAtom).element ?? "C") === "C" && neutral(attachment.outerAtom)
            && skeleton.has(attachment.outerAtom)) {
            connection = "phenyl";
            rootAtomId = attachment.outerAtom;
          } else if ((atom(attachment.outerAtom).element ?? "C") === "C" && neutral(attachment.outerAtom)
            && hydrogen(attachment.outerAtom) === 2 && neighbors(attachment.outerAtom).length === 2) {
            const next = neighbors(attachment.outerAtom).find(edge => edge.id !== attachment.ringAtom && skeleton.has(edge.id) && edge.order === 1);
            if (next) { connection = "benzyl"; linkerAtomId = attachment.outerAtom; rootAtomId = next.id; }
          } else if (atom(attachment.outerAtom).element === "O" && neutral(attachment.outerAtom)) {
            const next = neighbors(attachment.outerAtom).find(edge => edge.id !== attachment.ringAtom && (atom(edge.id).element ?? "C") === "C" && edge.order === 1);
            if (next) { connection = "phenoxy"; linkerAtomId = attachment.outerAtom; rootAtomId = next.id; }
          } else if (atom(attachment.outerAtom).element === "N" && neutral(attachment.outerAtom)) {
            const next = neighbors(attachment.outerAtom).find(edge => edge.id !== attachment.ringAtom && (atom(edge.id).element ?? "C") === "C" && edge.order === 1);
            const carbonylNitrogen = next && neighbors(next.id).some(edge => edge.order === 2 && atom(edge.id).element === "O");
            if (next && !carbonylNitrogen && neighbors(attachment.outerAtom).length === 2 && hydrogen(attachment.outerAtom) === 1) {
              connection = "phenylamino"; linkerAtomId = attachment.outerAtom; rootAtomId = next.id;
            }
          }
          if (!connection || rootAtomId === undefined) continue;
          const parentPath = parentPathFor(rootAtomId);
          const parentAttachmentLocant = parentPath ? parentPath.indexOf(rootAtomId) + 1 : undefined;
          const local = deriveLocalAromaticNomenclature({ graph, ringAtomIds: [...ring], ringBondIds: internal,
            attachmentAtomId: attachment.ringAtom, attachmentRootAtomId: rootAtomId, connection, linkerAtomId,
            parentAtomIds: carbonSkeleton, ...(parentAttachmentLocant !== undefined ? { parentAttachmentLocant,
              parentRule: selectedAmineParent?.ruleReference } : {}), implicitHydrogens: hydrogen });
          if (!local) continue;
          const regionIds = [...new Set([...ring, ...(linkerAtomId === undefined ? [] : [linkerAtomId]), ...local.substituents.flatMap(item => item.atomIds)])];
          const existing = result.components.find(item => ["phenoxy fragment", "substituted phenoxy fragment", "benzyl fragment"].includes(item.kind)
            && item.atomIds.length === regionIds.length && regionIds.every(id => item.atomIds.includes(id)));
          if (existing) { existing.nomenclature = local; existing.numbering = local.numbering; }
          else {
            const label = local.name;
            const componentIndex = result.components.length;
            add("aromatic substituent fragment", regionIds, local.explanation, local.numbering, local.explanationEs,
              local.attachmentBondIds);
            result.components[componentIndex].displayLabel = `${label} · locally derived aromatic substituent`;
            result.components[componentIndex].displayLabelEs = `${local.nameEs} · sustituyente aromático derivado localmente`;
            result.components[componentIndex].nomenclature = local;
            result.components[componentIndex].id = structuralComponentId("aromatic substituent fragment", regionIds);
          }
          for (const sub of local.substituents) {
            const locantAtomId = local.numbering.find(([,n]) => n === sub.position)?.[0];
            if (locantAtomId === undefined) continue;
            const locantIds = [locantAtomId];
            const index = result.components.length;
            add("aromatic ring locant", [...locantIds, ...sub.atomIds], sub.explanation,
              local.numbering.filter(([id]) => locantIds.includes(id)), sub.explanationEs, sub.bondIds);
            result.components[index].displayLabel = `Ring locant ${sub.position} · ${sub.name}`;
            result.components[index].displayLabelEs = `Localizador ${sub.position} del anillo · ${sub.nameEs}`;
            result.components[index].id = structuralComponentId("aromatic ring locant", [...locantIds, ...sub.atomIds]);
            result.components[index].nestedSelections = sub.nestedSelections;
          }
          break;
        }
      }
    }
    // A neutral, tetra-valent carbon bearing exactly three single-bonded
    // fluorines is a graph-proved CF3 group, wherever it occurs in the graph.
    for (const carbon of graph.atoms.filter(a => (a.element ?? "C") === "C" && neutral(a.id))) {
      const ns = neighbors(carbon.id), fluorines = ns.filter(next => next.order === 1 && atom(next.id).element === "F" && neutral(next.id));
      const framework = ns.filter(next => atom(next.id).element !== "F");
      if (fluorines.length !== 3 || ns.length !== 4 || framework.length !== 1
        || framework[0].order !== 1 || (atom(framework[0].id).element ?? "C") !== "C") continue;
      const ids = [carbon.id, ...fluorines.map(next => next.id)], index = result.components.length;
      add("trifluoromethyl group", ids,
        "A neutral carbon has three single bonds to neutral fluorine atoms and one remaining single bond to the molecular framework. This verifies a CF3 group by valence and connectivity.", undefined,
        "Un carbono neutro tiene tres enlaces simples a átomos de flúor neutros y un enlace simple restante con el esqueleto molecular. La valencia y la conectividad confirman un grupo CF3.");
      result.components[index].displayLabel = "Trifluoromethyl group · CF3";
      result.components[index].displayLabelEs = "Grupo trifluorometil · CF3";
      result.components[index].id = structuralComponentId("trifluoromethyl group", ids);
    }
    for (const oxygen of graph.atoms.filter(a => a.element === "O" && neutral(a.id) && !acylOxygens.has(a.id)
      && !molecule.isRingAtom(atomIdToIndex.get(a.id)!))) {
      const ns = neighbors(oxygen.id);
      if (ns.length !== 2 || ns.some(next => next.order !== 1 || (atom(next.id).element ?? "C") !== "C")) continue;
      const ids = [oxygen.id, ...ns.map(next => next.id)], index = result.components.length;
      add("ether linkage", ids,
        "A neutral, noncyclic oxygen forms two single bonds to carbon (C–O–C). This verifies an ether linkage; it is not an alcohol or an ester oxygen.", undefined,
        "Un oxígeno neutro y no cíclico forma dos enlaces simples con carbono (C–O–C). Esto confirma un enlace éter; no es un alcohol ni un oxígeno de éster.");
      result.components[index].displayLabel = "Ether linkage · C–O–C";
      result.components[index].displayLabelEs = "Enlace éter · C–O–C";
      result.components[index].id = structuralComponentId("ether linkage", ids);
    }
    // Classify only neutral, non-amide nitrogens whose single-bond carbon
    // count and implicit hydrogens give a valid primary/secondary/tertiary amine.
    for (const nitrogen of graph.atoms.filter(a => a.element === "N" && neutral(a.id))) {
      const ns = neighbors(nitrogen.id), carbonNeighbors = ns.filter(next => next.order === 1 && (atom(next.id).element ?? "C") === "C");
      if (ns.length !== carbonNeighbors.length || ![1,2,3].includes(carbonNeighbors.length)
        || hydrogen(nitrogen.id) !== 3 - carbonNeighbors.length) continue;
      const amideCarbon = carbonNeighbors.some(next => neighbors(next.id).some(other => other.order === 2 && atom(other.id).element === "O"));
      if (amideCarbon) continue;
      const environment = carbonNeighbors.length === 1 ? "primary" : carbonNeighbors.length === 2 ? "secondary" : "tertiary";
      const ids = [nitrogen.id, ...carbonNeighbors.map(next => next.id)], index = result.components.length;
      add("amine fragment", ids,
        `A neutral nitrogen has ${carbonNeighbors.length} single-bonded carbon neighbours and ${hydrogen(nitrogen.id)} implicit hydrogen(s), supporting a ${environment} amine environment. The graph does not by itself verify a suffix or parent choice.`, undefined,
        `Un nitrógeno neutro tiene ${carbonNeighbors.length} vecinos carbonados unidos por enlace simple y ${hydrogen(nitrogen.id)} hidrógeno(s) implícito(s), compatible con una amina ${environment === "primary" ? "primaria" : environment === "secondary" ? "secundaria" : "terciaria"}. El grafo no verifica por sí solo el sufijo ni la selección del padre.`);
      result.components[index].displayLabel = `${environment[0].toUpperCase()}${environment.slice(1)} amine · N and ${carbonNeighbors.length} C substituents`;
      result.components[index].displayLabelEs = `Amina ${environment === "primary" ? "primaria" : environment === "secondary" ? "secundaria" : "terciaria"} · N y ${carbonNeighbors.length} sustituyentes C`;
      result.components[index].id = structuralComponentId("amine fragment", ids);
    }
    for(const c of graph.atoms.filter(a=>(a.element??"C")==="C" && neutral(a.id))) {
      const ns=neighbors(c.id);
      if(ns.length===1 && ns[0].order===1 && atom(ns[0].id).element==="N" && hydrogen(c.id)===3)
        add("N-bound methyl",[c.id,ns[0].id],"A methyl carbon with three implicit hydrogens is bonded to nitrogen. This is connectivity evidence; no heterocycle locant is assigned.",undefined,"Un carbono metilo con tres hidrógenos implícitos está unido a nitrógeno. Es evidencia de conectividad; no se asigna un locante de heterociclo.");
    }
    for (const a of graph.atoms) if (a.tetrahedralParity) add("stereo", [a.id], `Explicit absolute configuration ${a.tetrahedralParity}; preserved from the molecular model.`,undefined,`Configuración absoluta ${a.tetrahedralParity} explícita, conservada en el modelo molecular.`);
    const sugar=recognizeCarbohydrate(graph);
    if(sugar){
      result.carbohydrate=sugar;
      add('carbohydrate backbone',sugar.carbonIds,
        `An unbranched ${sugar.carbonIds.length}-carbon ${sugar.carbonylPosition===1?'aldose':'2-ketose'} skeleton in ${sugar.form} form is verified by the whole C/O graph. These are structural carbohydrate locants, not a reconciliation of the displayed name.`,sugar.numbering,
        `El grafo completo de C/O confirma un esqueleto lineal de ${sugar.carbonIds.length} carbonos, ${sugar.carbonylPosition===1?'aldosa':'2-cetosa'}, en forma ${sugar.form}. Son locantes estructurales del carbohidrato; no reconcilian el nombre mostrado.`);
      if(sugar.ringOxygenId!==undefined){
        add('ring oxygen',[sugar.ringOxygenId],`One ring ether oxygen bridges carbohydrate C${sugar.carbonylPosition} and C${sugar.closurePosition}; it is not a hydroxyl.`,undefined,`Un oxígeno éter del anillo conecta C${sugar.carbonylPosition} y C${sugar.closurePosition} del carbohidrato; no es un hidroxilo.`);
        add(sugar.carbonylPosition===1?'hemiacetal':'hemiketal',[sugar.anomericAtomId!,sugar.ringOxygenId,sugar.anomericHydroxylId!],
          `Anomeric C${sugar.carbonylPosition} has ring oxygen and a free OH, with ${sugar.carbonylPosition===1?'one carbon neighbour and one H':'two carbon neighbours and no H'}. Acetals and glycosides do not match this envelope.`,[[sugar.anomericAtomId!,sugar.carbonylPosition]],`El C${sugar.carbonylPosition} anomérico tiene oxígeno del anillo y un OH libre, con ${sugar.carbonylPosition===1?'un vecino carbonado y un H':'dos vecinos carbonados y ningún H'}. Los acetales y glicósidos no cumplen esta estructura.`);
        add('anomeric centre',[sugar.anomericAtomId!,sugar.anomericHydroxylId!],
          sugar.anomer?`Explicit anomeric and reference configurations prove ${sugar.anomer} by the formal Fischer ${sugar.anomer==='alpha'?'cis':'trans'} relationship.`
            :'No alpha/beta assignment: configuration is absent or the retained ketose-anomer rule is outside the proved grammar.',[[sugar.anomericAtomId!,sugar.carbonylPosition]],sugar.anomer?`Las configuraciones anomérica y de referencia demuestran el anómero ${sugar.anomer==='alpha'?'alfa':'beta'} mediante la relación formal ${sugar.anomer==='alpha'?'cis':'trans'} de Fischer.`:'No se asigna alfa/beta: falta configuración explícita o la regla de anómero de cetosa no está dentro de la gramática demostrada.');
      }
      add('configurational reference',[sugar.configurationalAtomId],
        sugar.series?`The highest numbered parent chirality centre C${sugar.configurationalPosition} proves series ${sugar.series} in the ordered Fischer ligand frame. ${sugar.family?`All non-anomeric centres additionally verify ${sugar.series}-${sugar.family.name}.`:'The remaining centres do not establish a supported stereoparent.'}`
          :'The highest numbered parent chirality centre is not explicitly configured; no D/L or stereoparent name is assigned.',[[sugar.configurationalAtomId,sugar.configurationalPosition]],sugar.series?`El centro quiral parental de mayor locante, C${sugar.configurationalPosition}, establece la serie ${sugar.series} según el orden de ligandos de Fischer. ${sugar.family?`Los demás centros no anoméricos también verifican ${sugar.series}-${sugar.family.name}.`:'Los centros restantes no establecen un estereoparental admitido.'}`:'El centro quiral parental de mayor locante no tiene configuración explícita; no se asigna D/L ni un nombre estereoparental.');
      result.limitations.push('Carbohydrate structural recognition does not by itself prove a retained or external name. Missing stereocentres and generic names remain PARTIAL.');
    }
    // Topological complements that are completely covered by specific graph
    // motifs are redundant as generic controls. Their external links remain
    // available as independent `fragment connection` selections.
    const recognizedKinds = new Set<StructuralComponent["kind"]>([
      "ringSystem", "phenoxy fragment", "substituted phenoxy fragment", "methoxy fragment",
      "carboxylicAcid", "ester", "amide", "carbonyl", "hydroxyl", "N-bound methyl",
      "amine fragment", "trifluoromethyl group", "benzyl fragment", "carbohydrate backbone", "ring oxygen",
      "ether linkage",
      "hemiacetal", "hemiketal", "anomeric centre",
    ]);
    const recognized = result.components.filter(component => recognizedKinds.has(component.kind));
    result.components = result.components.filter(component => {
      if (component.kind !== "connected fragment") return true;
      const region = new Set(component.atomIds), covering = recognized.filter(item => item.atomIds.some(id => region.has(id)));
      const coveredAtoms = new Set(covering.flatMap(item => item.atomIds));
      if ([...region].some(id => !coveredAtoms.has(id))) return true;
      const coveredBonds = new Set(covering.flatMap(item => item.bondIds.map(([a,b]) => key(a,b))));
      const internalBonds = graph.bonds.filter(([a,b]) => region.has(a) && region.has(b));
      return internalBonds.some(([a,b]) => !coveredBonds.has(key(a,b)));
    });
    assignStructuralContainment(result.components);
    result.status = result.components.length ? "PARTIAL" : "UNSUPPORTED";
    return result;
  } catch { return result; }
}
