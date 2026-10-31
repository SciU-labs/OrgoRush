import { Molecule } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { buildOpenChemLibStereoGraph } from "./tetrahedral-stereochemistry.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { editableValencesValid } from "./editable-valence.ts";
import { recognizeCarbohydrate, type CarbohydrateStructure } from "./carbohydrate-structure.ts";

export type StructuralComponent = {
  id: string;
  kind: "carboxylicAcid" | "ester" | "amide" | "carbonyl" | "hydroxyl" | "ringSystem" | "stereo" | "N-bound methyl"
    | "carbohydrate backbone" | "ring oxygen" | "hemiacetal" | "hemiketal" | "configurational reference" | "anomeric centre";
  atomIds: number[];
  bondIds: [number, number][];
  evidence: string;
  numbering?: [number,number|string][];
};
export type StructuralDerivation = {
  status: "FULL" | "PARTIAL" | "UNSUPPORTED";
  name: { text: string; classification: "unverified"; preferred: false };
  components: StructuralComponent[];
  limitations: string[];
  carbohydrate?: CarbohydrateStructure;
};
const key = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/** Text cards and SVG selections consume exactly the same component evidence. */
export function structuralVisualTargets(model: StructuralDerivation): Record<string, ReasoningVisualTarget> {
  return Object.fromEntries(model.components.map(c => [c.id, {
    stepNumber: c.id, atomIds: c.atomIds, bondIds: c.bondIds, locants: c.numbering??[],
  }]));
}

export function remapStructuralDerivation(model: StructuralDerivation, source: GeneratedMolecule, target: GeneratedMolecule): StructuralDerivation | null {
  const map = mapStructuralRegions(source, target, model.components.map(c => c.atomIds));
  if (!map) return null;
  return { ...model, components: model.components.map(c => ({ ...c,
    atomIds: c.atomIds.map(id => map.get(id)!),
    bondIds: c.bondIds.map(([a, b]) => [map.get(a)!, map.get(b)!]),
    ...(c.numbering?{numbering:c.numbering.map(([id,p]):[number,number|string]=>[map.get(id)!,p])}:{}),
  })),...(model.carbohydrate?{carbohydrate:recognizeCarbohydrate(target)??undefined}:{}) };
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

function correspondences(source: GeneratedMolecule, target: GeneratedMolecule, regions: readonly (readonly number[])[], collect: boolean): StructuralEquivalence | null {
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
        mappings.push(new Map(assigned));
        if (mappings.length > 256) exhausted = true;
        return;
      }
      const id = order[depth];
      for (const other of options.get(id)!) {
        if (used.has(other) || [...assigned].some(([x, y]) => a.edges.get(key(id, x)) !== b.edges.get(key(other, y)))) continue;
        assigned.set(id, other); used.add(other); visit(depth + 1); used.delete(other); assigned.delete(id);
        if (exhausted || ambiguous) return;
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

/** All bounded full-graph isomorphisms. Composing any two gives an
 * automorphism of the same chemical graph, not a tautomer or partial match. */
export function analyzeStructuralEquivalence(source: GeneratedMolecule, target: GeneratedMolecule): StructuralEquivalence | null {
  return correspondences(source,target,[],true);
}

/** Structural evidence only: no external-name token parsing, parent selection,
 * locants or unspecified stereo assignments are performed by this fallback. */
export function deriveStructuralComponents(graph: GeneratedMolecule, displayedName: string): StructuralDerivation {
  const result: StructuralDerivation = { status: "UNSUPPORTED", name: { text: displayedName, classification: "unverified", preferred: false },
    components: [], limitations: ["External-name fragments, parent selection and locants have not been reconciled with this graph."] };
  try {
    const { molecule, atomIdToIndex } = normalized(graph);
    const neighbors = (id: number) => graph.bonds.filter(([a, b]) => a === id || b === id)
      .map(([a, b, order = 1]) => ({ id: a === id ? b : a, order }));
    const atom = (id: number) => graph.atoms.find(a => a.id === id)!;
    const neutral = (id: number) => !(atom(id).charge ?? 0);
    const hydrogen = (id: number) => molecule.getImplicitHydrogens(atomIdToIndex.get(id)!);
    const add = (kind: StructuralComponent["kind"], ids: number[], evidence: string, numbering?:StructuralComponent['numbering']) => {
      const region = [...new Set(ids)], included = new Set(region);
      result.components.push({ id: `structural-${result.components.length}`, kind, atomIds: region,
        bondIds: graph.bonds.filter(([a, b]) => included.has(a) && included.has(b)).map(([a, b]) => [a, b]), evidence,...(numbering?{numbering}:{}) });
    };
    const acylOxygens = new Set<number>();
    for (const c of graph.atoms.filter(a => (a.element ?? "C") === "C" && neutral(a.id))) {
      const ns = neighbors(c.id);
      const oxo = ns.filter(n => n.order === 2 && atom(n.id).element === "O" && neutral(n.id) && neighbors(n.id).length === 1);
      if (oxo.length !== 1) continue;
      const singleO = ns.find(n => n.order === 1 && atom(n.id).element === "O" && neutral(n.id));
      const nitrogen = ns.find(n => n.order === 1 && atom(n.id).element === "N" && neutral(n.id));
      if (singleO && hydrogen(singleO.id) === 1 && neighbors(singleO.id).length === 1) {
        acylOxygens.add(singleO.id); add("carboxylicAcid", [c.id, oxo[0].id, singleO.id], "C(=O)–OH; neutral oxygen with one implicit hydrogen.");
      } else if (singleO && neighbors(singleO.id).length === 2 && neighbors(singleO.id).every(n => n.order === 1 && (atom(n.id).element ?? "C") === "C")) {
        acylOxygens.add(singleO.id); add("ester", [c.id, oxo[0].id, singleO.id], "C(=O)–O–C; ester linkage established by connectivity.");
      } else if (nitrogen) add("amide", [c.id, oxo[0].id, nitrogen.id], "C(=O)–N; amide linkage established by connectivity.");
      else add("carbonyl", [c.id, oxo[0].id], "A carbon–oxygen double bond is present; no suffix priority is inferred.");
    }
    for (const o of graph.atoms.filter(a => a.element === "O" && neutral(a.id) && !acylOxygens.has(a.id))) {
      const ns = neighbors(o.id);
      if (ns.length === 1 && ns[0].order === 1 && (atom(ns[0].id).element ?? "C") === "C" && hydrogen(o.id) === 1)
        add("hydroxyl", [o.id, ns[0].id], "C–OH; oxygen has one implicit hydrogen. No carbohydrate anomer is inferred.");
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
      add("ringSystem", ids, `Connected ring system with ${count} independent cycle(s). Shared ring atoms belong to this same system; no parent numbering is assigned.`);
    }
    for(const c of graph.atoms.filter(a=>(a.element??"C")==="C" && neutral(a.id))) {
      const ns=neighbors(c.id);
      if(ns.length===1 && ns[0].order===1 && atom(ns[0].id).element==="N" && hydrogen(c.id)===3)
        add("N-bound methyl",[c.id,ns[0].id],"A methyl carbon with three implicit hydrogens is bonded to nitrogen. This is connectivity evidence; no heterocycle locant is assigned.");
    }
    for (const a of graph.atoms) if (a.tetrahedralParity) add("stereo", [a.id], `Explicit absolute configuration ${a.tetrahedralParity}; preserved from the molecular model.`);
    const sugar=recognizeCarbohydrate(graph);
    if(sugar){
      result.carbohydrate=sugar;
      add('carbohydrate backbone',sugar.carbonIds,
        `An unbranched ${sugar.carbonIds.length}-carbon ${sugar.carbonylPosition===1?'aldose':'2-ketose'} skeleton in ${sugar.form} form is verified by the whole C/O graph. These are structural carbohydrate locants, not a reconciliation of the displayed name.`,sugar.numbering);
      if(sugar.ringOxygenId!==undefined){
        add('ring oxygen',[sugar.ringOxygenId],`One ring ether oxygen bridges carbohydrate C${sugar.carbonylPosition} and C${sugar.closurePosition}; it is not a hydroxyl.`);
        add(sugar.carbonylPosition===1?'hemiacetal':'hemiketal',[sugar.anomericAtomId!,sugar.ringOxygenId,sugar.anomericHydroxylId!],
          `Anomeric C${sugar.carbonylPosition} has ring oxygen and a free OH, with ${sugar.carbonylPosition===1?'one carbon neighbour and one H':'two carbon neighbours and no H'}. Acetals and glycosides do not match this envelope.`,[[sugar.anomericAtomId!,sugar.carbonylPosition]]);
        add('anomeric centre',[sugar.anomericAtomId!,sugar.anomericHydroxylId!],
          sugar.anomer?`Explicit anomeric and reference configurations prove ${sugar.anomer} by the formal Fischer ${sugar.anomer==='alpha'?'cis':'trans'} relationship.`
            :'No alpha/beta assignment: configuration is absent or the retained ketose-anomer rule is outside the proved grammar.',[[sugar.anomericAtomId!,sugar.carbonylPosition]]);
      }
      add('configurational reference',[sugar.configurationalAtomId],
        sugar.series?`The highest numbered parent chirality centre C${sugar.configurationalPosition} proves series ${sugar.series} in the ordered Fischer ligand frame. ${sugar.family?`All non-anomeric centres additionally verify ${sugar.series}-${sugar.family.name}.`:'The remaining centres do not establish a supported stereoparent.'}`
          :'The highest numbered parent chirality centre is not explicitly configured; no D/L or stereoparent name is assigned.',[[sugar.configurationalAtomId,sugar.configurationalPosition]]);
      result.limitations.push('Carbohydrate structural recognition does not by itself prove a retained or external name. Missing stereocentres and generic names remain PARTIAL.');
    }
    result.status = result.components.length ? "PARTIAL" : "UNSUPPORTED";
    return result;
  } catch { return result; }
}
