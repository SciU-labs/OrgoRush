import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { mapStructuralRegions, analyzeStructuralEquivalence } from "./structural-derivation.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { parseAdditionalSystematicFamily } from "./systematic-family-grammar.ts";
import { reconcileCarbohydrateName } from "./carbohydrate-derivation.ts";
import { englishIupacRoot, iupacRootForCarbonCount } from "./iupac-prefixes.ts";

export type NameComponent = {
  id: string;
  role: "parent" | "suffix" | "substituent" | "prefix";
  text: string;
  start: number;
  end: number;
  parentId?: string;
  locant?: number | "N";
  atomIds: number[];
  bondIds: [number, number][];
  numbering: [number, number | string][];
  explanation: string;
  explanationEs?: string;
  label?: string;
  labelEs?: string;
};
export type ValidatedNameDerivation = {
  status: "FULL";
  name: string;
  preferred: false;
  principalGroup: "carboxylicAcid" | "amide" | "ester" | "aldehyde" | "ketone" | "alcohol" | "heterocycle";
  parentSystem?: "purine" | "carbohydrate";
  components: NameComponent[];
  parentAtomIds: number[];
  symmetry?: {
    mappingCount: number;
    atomOrbits: number[][];
    assignments: {parentAtomIds: number[]; components: NameComponent[]}[];
    explanation: string;
  };
};

export type ValidatedNamePresentation = { name: string; language: "en" | "es"; localized: boolean };

/** Localizes only a fully reconciled acid + substituted phenyl construction.
 * The original English name remains the validation key and component spans
 * continue to refer to it; atom mappings come from the reconciled model. */
export function presentValidatedSystematicName(model: ValidatedNameDerivation, language: "en" | "es"): ValidatedNamePresentation {
  if (language === "en") return { name: model.name, language: "en", localized: false };
  const components = Object.fromEntries(model.components.map(component => [component.id, component]));
  const parent = components.parent, suffix = components.suffix, aryl = components.aryl, prefix = components["aryl-prefix"];
  if (model.principalGroup !== "carboxylicAcid" || model.parentSystem || !parent || !suffix || !aryl || !prefix
    || model.components.length !== 4 || parent.atomIds.length !== parent.numbering.length
    || prefix.parentId !== "aryl" || typeof aryl.locant !== "number"
    || typeof prefix.locant !== "number") return { name: model.name, language: "en", localized: false };
  const root = iupacRootForCarbonCount(parent.atomIds.length);
  const term = legacyPrefixTerm(prefix.text);
  if (!root || !term || term.en !== prefix.text || term.kind || term.elements.some(element => element !== "C")
    || term.bonds.some(([, , order]) => order !== 1) || !/^oic acid$/.test(suffix.text)
    || !/^\d+-\[\d+-\(.+\)phenyl\].+anoic acid$/.test(model.name)) {
    return { name: model.name, language: "en", localized: false };
  }
  const englishRoot = englishIupacRoot(root);
  const expected = `${aryl.locant}-[${prefix.locant}-(${prefix.text})phenyl]${englishRoot}anoic acid`;
  if (model.name !== expected || aryl.numbering.length !== 2
    || aryl.numbering[0]?.[1] !== 1 || aryl.numbering[1]?.[1] !== prefix.locant
    || aryl.atomIds.length !== 6 + term.elements.length
    || prefix.atomIds.length !== term.elements.length || prefix.bondIds.length !== term.bonds.length + 1) {
    return { name: model.name, language: "en", localized: false };
  }
  const localized = `ácido ${aryl.locant}-[${prefix.locant}-(${term.es})fenil]${root}anoico`;
  return { name: localized, language: "es", localized: true };
}

const roots = ["", "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec"];

function rootedAlkylNumbering(elements: readonly string[], bonds: readonly [number, number, number][]) {
  if (!elements.length || elements.some(element => element !== "C") || bonds.length !== elements.length - 1
    || bonds.some(([, , order]) => order !== 1)) return;
  const adjacency = elements.map((): number[] => []);
  for (const [a, b] of bonds) {
    adjacency[a]?.push(b);
    adjacency[b]?.push(a);
  }
  const paths: number[][] = [];
  const walk = (current: number, previous: number, path: number[]) => {
    const next = adjacency[current].filter(id => id !== previous);
    if (!next.length) paths.push(path);
    else for (const id of next) walk(id, current, [...path, id]);
  };
  walk(0, -1, [0]);
  paths.sort((left, right) => right.length - left.length || left.join(",").localeCompare(right.join(",")));
  const backbone = paths[0];
  const backboneLocants = new Map(backbone.map((id, index) => [id, index + 1]));
  const visited = new Set(backbone);
  const branches: { locant: number; carbons: number }[] = [];
  for (const id of backbone) for (const start of adjacency[id]) {
    if (visited.has(start)) continue;
    const pending = [start]; let carbons = 0;
    visited.add(start);
    while (pending.length) {
      const current = pending.pop()!; carbons += 1;
      for (const next of adjacency[current]) if (!visited.has(next)) {
        visited.add(next); pending.push(next);
      }
    }
    branches.push({ locant: backboneLocants.get(id)!, carbons });
  }
  return { backboneLength: backbone.length, branches };
}

/** A finite compositional grammar, not a drug-name dictionary. Parse a name,
 * construct its complete graph, then prove identity and invariant components
 * or explicitly proved equivalent assignments. Unparsed input never gets FULL.
 * Stereo descriptors are deliberately outside this grammar. */
const cache = new WeakMap<GeneratedMolecule, {signature:string; entries:Map<string, ValidatedNameDerivation | null>}>();
export function reconcileSystematicName(actual: GeneratedMolecule, name: string): ValidatedNameDerivation | null {
  // The UI commits immutable graphs, but callers must not reuse a FULL proof
  // after editing the same object's connectivity, stereo or isotope metadata.
  const signature=JSON.stringify([actual.atoms,actual.bonds]);
  let cached = cache.get(actual);
  if (!cached || cached.signature!==signature) {
    cached = {signature,entries:new Map()}; cache.set(actual,cached);
  }
  const {entries}=cached;
  if (entries.has(name)) return entries.get(name)!;
  const result = reconcile(actual, name);
  if (entries.size >= 16) entries.clear();
  entries.set(name, result);
  return result;
}
function reconcile(actual: GeneratedMolecule, name: string): ValidatedNameDerivation | null {
  const carbohydrate=reconcileCarbohydrateName(actual,name);if(carbohydrate)return carbohydrate;
  if (name.length > 200 || actual.atoms.some(a => a.tetrahedralParity) || actual.bonds.some(b => b[3] !== undefined)) return null;
  const graph: GeneratedMolecule = { atoms: [], bonds: [] };
  const components: NameComponent[] = [];
  const atom = (element: "C" | "O" | "N" = "C") => {
    const id = graph.atoms.length + 1;
    graph.atoms.push({ id, element, x: 0, y: 0 }); return id;
  };
  const bond = (a: number, b: number, order: 1 | 2 | 3 = 1) => { graph.bonds.push([a, b, order]); };
  const chain = (n: number) => Array.from({ length: n }, (_, i) => { const id = atom(); if (i) bond(id - 1, id); return id; });
  const ring = () => { const ids = chain(6); graph.bonds.splice(graph.bonds.length - 5, 5);
    ids.forEach((id, i) => bond(id, ids[(i + 1) % 6], i % 2 ? 1 : 2)); return ids; };
  const component = (id: string, role: NameComponent["role"], text: string, start: number, ids: number[],
    explanation: string, options: Partial<NameComponent> = {}) => {
    const included = new Set(ids);
    components.push({ id, role, text, start, end: start + text.length, atomIds: ids,
      bondIds: graph.bonds.filter(([a,b]) => included.has(a) && included.has(b)).map(([a,b]) => [a,b]),
      numbering: [], explanation, ...options });
  };
  const acid = (carbon: number) => { const oxo = atom("O"), oh = atom("O"); bond(carbon, oxo, 2); bond(carbon, oh); return [carbon, oxo, oh]; };
  // One substituent at a specified position on phenyl, reusable for positional
  // isomers and the bounded alkyl grammar already used by the legacy engine.
  const aryl = (text: string, start: number, anchor: number, locant: number | "N"): boolean => {
    const m = /^([2-4])-(?:\(([^()]+)\)|(hydroxy|[a-z]+))phenyl$/.exec(text);
    if (!m) return false;
    const position = Number(m[1]), termName = m[2] ?? m[3];
    const term = legacyPrefixTerm(termName);
    if (!term || term.en !== termName || term.charges || term.elements.some(e => !["C", "O"].includes(e))
      || term.kind && term.kind !== "alcohol"
      || term.kind !== "alcohol" && term.bonds.some(([, , order]) => order !== 1)) return false;
    const ids = ring(); bond(anchor, ids[0]);
    const branch = term.elements.map(e => atom(e as "C" | "O"));
    term.bonds.forEach(([a,b,o]) => bond(branch[a], branch[b], o as 1 | 2 | 3));
    bond(ids[position - 1], branch[0]);
    const internalNumbering = rootedAlkylNumbering(term.elements, term.bonds);
    component("aryl", "substituent", text, start, [...ids, ...branch],
      `The phenyl substituent attaches at ${locant}. Its attachment carbon is ring position 1; the nested substituent is at ring position ${position}.`,
      { explanationEs: `El grupo fenilo se une a la cadena principal por el C1 del anillo, en el localizador ${locant} de la cadena. El otro sustituyente está en el C${position} del anillo; esta numeración interna no cambia la numeración del padre.`,
        locant, parentId: "parent", numbering: [[ids[0], 1], [ids[position - 1], position]], bondIds: [
        ...graph.bonds.filter(([a,b]) => [...ids,...branch].includes(a) && [...ids,...branch].includes(b)).map(([a,b]): [number,number] => [a,b]), [anchor, ids[0]],
      ] });
    const termStart = start + text.indexOf(termName);
    component("aryl-prefix", "prefix", termName, termStart, branch,
      term.kind === "alcohol" ? `Hydroxy specifies the –OH group at ring position ${position}.`
        : `The rooted alkyl graph defines ${termName}, attached at ring position ${position}; internal branch locants belong to this substituent.`,
      { locant: position, parentId: "aryl", bondIds: [...graph.bonds.filter(([a,b]) => branch.includes(a) && branch.includes(b)).map(([a,b]): [number,number] => [a,b]), [ids[position - 1], branch[0]]] });
    const prefixComponent = components[components.length - 1];
    prefixComponent.explanationEs = term.kind === "alcohol"
      ? `El prefijo «${termName}» señala el grupo –OH unido al C${position} del anillo.`
      : internalNumbering
        ? `La numeración interna de «${termName}» comienza en el átomo unido al anillo (C1): la cadena más larga tiene ${internalNumbering.backboneLength} carbonos${internalNumbering.branches.length ? ` y presenta ${internalNumbering.branches.map(branch => `un ramal de ${branch.carbons} ${branch.carbons === 1 ? "carbono" : "carbonos"} en C${branch.locant}`).join(" y ")}` : " y no presenta ramales"}. Esos localizadores pertenecen al sustituyente y son independientes del C${position} del fenilo.`
        : `El sustituyente «${termName}» se une por el C${position} del fenilo; su numeración interna se cuenta desde el punto de unión y es independiente de la numeración del anillo.`;
    prefixComponent.explanation = term.kind === "alcohol"
      ? `Hydroxy specifies the –OH group at ring position ${position}.`
      : internalNumbering
        ? `Numbering within ${termName} starts at its attachment atom (C1): its longest chain has ${internalNumbering.backboneLength} carbons${internalNumbering.branches.length ? `, with ${internalNumbering.branches.map(branch => `a ${branch.carbons}-carbon branch at C${branch.locant}`).join(" and ")}` : " and no branches"}. These locants belong to the substituent and are independent of phenyl ring position ${position}.`
        : `The ${termName} substituent attaches at phenyl ring position ${position}; its internal numbering starts from its attachment point and is separate from ring numbering.`;
    return true;
  };

  let group: ValidatedNameDerivation["principalGroup"];
  let parent: number[];
  let allowEquivalentParents = false;
  let parentSystem: ValidatedNameDerivation["parentSystem"];
  const acyclic = /^([2-9])-\[(.+)\]([a-z]+)anoic acid$/.exec(name);
  const amide = /^N-\((.+)\)(acetamide|[a-z]+anamide)$/.exec(name);
  // Parentheses are optional only around this single, unambiguous prefix.
  // Keep paired delimiters explicit rather than deleting punctuation globally.
  const benzoic = /^([2-4])-(?:\((acetyloxy|[a-z]+anoyloxy)\)|(acetyloxy|[a-z]+anoyloxy))benzoic acid$/.exec(name);
  if (acyclic) {
    const n = roots.indexOf(acyclic[3]), position = Number(acyclic[1]);
    if (n < 2 || position > n) return null;
    parent = chain(n); const functionIds = acid(parent[0]); group = "carboxylicAcid";
    const parentStart = name.length - `${acyclic[3]}anoic acid`.length;
    component("parent", "parent", name.slice(parentStart), parentStart, parent,
      `The selected parent is the ${n}-carbon acyclic chain. The carboxyl carbon is C1 and the carboxylic acid is the principal characteristic group. Because that principal group occurs only in the chain while the phenyl ring is cited as a substituent, Blue Book P-59.2.1.2 selects the acyclic parent; phenyl attaches at C${position}.`,
      { explanationEs: `Se selecciona como padre la cadena acíclica de ${n} carbonos. El carbono carboxílico es C1 y el ácido carboxílico es la función principal. Como esta función aparece solo en la cadena y el anillo fenilo se cita como sustituyente, el criterio Blue Book P-59.2.1.2 selecciona la cadena acíclica; el fenilo se une en C${position}.`,
        numbering: parent.map((id,i) => [id, i + 1]) });
    component("suffix", "suffix", "oic acid", name.length - 8, functionIds,
      "The carboxyl group determines the acid suffix and numbering origin.",
      { explanationEs: "El grupo carboxilo (–COOH) es la función principal y aporta el sufijo «oic acid» del nombre sistemático inglés." });
    if (!aryl(acyclic[2], 3, parent[position - 1], position)) return null;
  } else if (amide) {
    const n = amide[2] === "acetamide" ? 2 : roots.indexOf(amide[2].slice(0, -7));
    if (n < 2) return null;
    parent = chain(n); const oxygen = atom("O"), nitrogen = atom("N"); bond(parent[0], oxygen, 2); bond(parent[0], nitrogen); group = "amide";
    const parentStart = name.length - amide[2].length;
    component("parent", "parent", amide[2], parentStart, [...parent, nitrogen],
      `The ${n}-carbon amide is the parent. N- identifies substitution on nitrogen rather than on a numbered carbon.`,
      { numbering: parent.map((id,i) => [id, i + 1]) });
    component("suffix", "suffix", "amide", name.length - 5, [parent[0], oxygen, nitrogen], "C(=O)–N establishes the amide suffix.");
    if (!aryl(amide[1], 3, nitrogen, "N")) return null;
    parent = [...parent, nitrogen];
  } else if (benzoic) {
    const prefix = benzoic[2] ?? benzoic[3];
    const prefixStart = benzoic[2] ? 3 : 2;
    const position = Number(benzoic[1]); parent = ring(); const carbon = atom(); bond(parent[0], carbon); const functionIds = acid(carbon);
    group = "carboxylicAcid";
    const parentStart = name.length - 12;
    component("parent", "parent", "benzoic acid", parentStart, [...parent, carbon],
      `Benzoic acid is the retained acid parent. The ring carbon bearing the carboxyl group is position 1; the acyloxy substituent is at position ${position}.`,
      { numbering: [[parent[0], 1], [parent[position - 1], position]] });
    component("suffix", "suffix", "acid", name.length - 4, functionIds, "The carboxyl group is the principal characteristic group; the ester is expressed as a prefix.");
    const n = prefix === "acetyloxy" ? 2 : roots.indexOf(prefix.slice(0, -8));
    if (n < 2) return null;
    const oxygen = atom("O"), acyl = chain(n), oxo = atom("O"); bond(parent[position - 1], oxygen); bond(oxygen, acyl[0]); bond(acyl[0], oxo, 2);
    const ids = [oxygen, ...acyl, oxo];
    component("acyloxy", "substituent", prefix, prefixStart, ids,
      `The ${prefix} group is ring–O–C(=O)–alkyl at ring position ${position}. Its atoms are distinct from the principal carboxyl group.`,
      { locant: position, parentId: "parent", bondIds: [...graph.bonds.filter(([a,b]) => ids.includes(a) && ids.includes(b)).map(([a,b]): [number,number] => [a,b]), [parent[position - 1], oxygen]] });
    parent = [...parent, carbon];
  } else {
    const family = parseAdditionalSystematicFamily(name);
    if (!family) return null;
    graph.atoms.push(...family.graph.atoms); graph.bonds.push(...family.graph.bonds);
    components.push(...family.components); parent=family.parent; group=family.group;
    allowEquivalentParents=!!family.equivalentParentPaths;
    parentSystem=family.parentSystem;
  }

  // Every named span is literal and every graph atom must be accounted for.
  if (components.some(c => name.slice(c.start, c.end) !== c.text)
    || graph.atoms.some(a => !components.some(c => c.atomIds.includes(a.id)))) return null;
  const regions = components.flatMap(c => [c.atomIds, ...c.numbering.map(([id]) => [id])]);
  const equivalence=allowEquivalentParents?analyzeStructuralEquivalence(graph,actual):null;
  const mapping = allowEquivalentParents ? equivalence?.representative : mapStructuralRegions(graph, actual, regions);
  if (!mapping) return null;
  const assignment=(map: Map<number,number>)=>({parentAtomIds:parent.map(id=>map.get(id)!),
    components:components.map(c=>({...c,atomIds:c.atomIds.map(id=>map.get(id)!),
      bondIds:c.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
      numbering:c.numbering.map(([id,n]):[number,number|string]=>[map.get(id)!,n]),
    }))});
  const representative=assignment(mapping);
  if(!equivalence)return {status:"FULL",name,preferred:false,principalGroup:group,...representative,...(parentSystem?{parentSystem}:{})};
  // Deduplicate internal automorphisms that do not change any named region or
  // locant. Each remaining assignment is a complete valid decomposition, not
  // the union of mutually exclusive parent chains.
  const assignments=[...new Map(equivalence.mappings.map(map=>{
    const value=assignment(map);
    const signature=JSON.stringify(value.components.map(c=>[c.id,[...c.atomIds].sort((a,b)=>a-b),
      [...c.numbering].sort(([a],[b])=>a-b),c.bondIds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)]).sort(([a,b],[x,y])=>a-x||b-y)]));
    return [signature,value];
  })).values()];
  return {status:"FULL",name,preferred:false,principalGroup:group,...representative,symmetry:{
    mappingCount:equivalence.mappings.length,atomOrbits:equivalence.atomOrbits,assignments,
    explanation:`There are ${assignments.length} symmetry-equivalent numbered parent choices. The displayed choice has no chemical preference; switching changes the whole valid parent/substituent assignment together.`,
  }};
}

export function selectEquivalentAssignment(model: ValidatedNameDerivation, index: number): ValidatedNameDerivation {
  const selected=model.symmetry?.assignments[index];
  return selected?{...model,...selected}:model;
}

export function validatedNameTargets(model: ValidatedNameDerivation): Record<string, ReasoningVisualTarget> {
  return Object.fromEntries(model.components.map(c => [c.id, {
    stepNumber: c.id, atomIds: c.atomIds, bondIds: c.bondIds, locants: c.numbering,
  }]));
}
