import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { mapStructuralRegions, analyzeStructuralEquivalence } from "./structural-derivation.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { parseAdditionalSystematicFamily } from "./systematic-family-grammar.ts";
import { reconcileCarbohydrateName } from "./carbohydrate-derivation.ts";
import { englishIupacRoot, iupacRootForCarbonCount } from "./iupac-prefixes.ts";
import type { NameComponent, PrincipalGroup, NameRuleEvidence, ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
// Preserve the existing public import path while keeping shared types acyclic.
export type { NameComponent } from "./compositional-name-model.ts";
export type ValidatedNameDerivation = {
  status: "FULL";
  name: string;
  preferred: false;
  principalGroup: PrincipalGroup;
  parentSystem?: "purine" | "carbohydrate";
  components: NameComponent[];
  parentAtomIds: number[];
  evidence?: ValidatedCompositionalEvidence;
  symmetry?: {
    mappingCount: number;
    atomOrbits: number[][];
    assignments: {parentAtomIds: number[]; components: NameComponent[]}[];
    explanation: string;
  };
};

export type ValidatedNamePresentation = { name: string; language: "en" | "es"; localized: boolean };

/** Localizes supported FULL constructions.
 * The original English name remains the validation key and component spans
 * continue to refer to it; atom mappings come from the reconciled model. */
export function presentValidatedSystematicName(model: ValidatedNameDerivation, language: "en" | "es"): ValidatedNamePresentation {
  if (language === "en") return { name: model.name, language: "en", localized: false };
  const components = Object.fromEntries(model.components.map(component => [component.id, component]));
  if (model.principalGroup === "amide" && !model.parentSystem) {
    const parent = components.parent, suffix = components.suffix, aryl = components.aryl;
    const match = /^N-\(((?:4-hydroxy|3-hydroxy-4-methyl|3,4-dimethyl)phenyl)\)(acetamide)$/.exec(model.name);
    const expectedPrefixes = match?.[1].startsWith("4-hydroxy") ? ["aryl-prefix"]
      : match?.[1].startsWith("3-hydroxy") ? ["aryl-prefix-3", "aryl-prefix-4"]
        : match ? ["aryl-prefix"] : [];
    const prefixComponents = model.components.filter(component => component.id.startsWith("aryl-prefix"));
    if (match && parent?.text === "acetamide" && suffix?.text === "amide" && aryl?.text === match[1]
      && model.components.length === 3 + expectedPrefixes.length
      && prefixComponents.length === expectedPrefixes.length
      && expectedPrefixes.every(id => prefixComponents.some(component => component.id === id))) {
      const arylEs = match[1].replace("hydroxy", "hidroxi").replace(/methyl/g, "metil").replace("phenyl", "fenil");
      return { name: `N-(${arylEs})acetamida`, language: "es", localized: true };
    }
  }
  const parent = components.parent, suffix = components.suffix, aryl = components.aryl, prefix = components["aryl-prefix"];
  const acyloxy = components.acyloxy;
  if (model.status === "FULL" && model.principalGroup === "carboxylicAcid" && parent?.text === "benzoic acid"
    && acyloxy?.parentId === parent.id && acyloxy.labelEs && typeof acyloxy.locant === "number") {
    return { name: `ácido ${acyloxy.locant}-(${acyloxy.labelEs})benzoico`, language: "es", localized: true };
  }
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
    type ArylSubstituent = { position: number; termName: string; offset: number };
    let substituents: ArylSubstituent[] | undefined;
    let multiplicativeText: string | undefined;
    const dimethyl = /^([2-6]),([2-6])-dimethylphenyl$/.exec(text);
    if (dimethyl) {
      const positions = [Number(dimethyl[1]), Number(dimethyl[2])];
      if (positions[0] === positions[1]) return false;
      substituents = positions.map(position => ({ position, termName: "methyl", offset: 0 }));
      multiplicativeText = text.slice(0, -"phenyl".length);
    } else {
      const distinct = /^([2-6])-(hydroxy|methyl)-([2-6])-(?:(hydroxy|methyl)|\((2-methylpropyl)\)|(2-methylpropyl))phenyl$/.exec(text);
      if (distinct) {
        const firstPosition = Number(distinct[1]), secondPosition = Number(distinct[3]);
        const secondTerm = distinct[4] ?? distinct[5] ?? distinct[6];
        if (!secondTerm || firstPosition === secondPosition) return false;
        const alpha = (term: string) => term === "hydroxy" ? "hydroxy" : term === "methyl" ? "methyl" : "methylpropyl";
        if (distinct[2] === secondTerm || alpha(distinct[2]).localeCompare(alpha(secondTerm)) > 0) return false;
        const firstOffset = text.indexOf(distinct[2]);
        const secondOffset = text.indexOf(secondTerm, firstOffset + distinct[2].length);
        if (firstOffset < 0 || secondOffset < 0) return false;
        substituents = [
          { position: firstPosition, termName: distinct[2], offset: firstOffset },
          { position: secondPosition, termName: secondTerm, offset: secondOffset },
        ];
      }
    }
    if (substituents) {
      // Ring numbering starts at the parent attachment. Of the two possible
      // directions, retain the lexicographically lower locant set; when the
      // sets tie, alphabetic prefix order assigns the lower locant.
      const positions = substituents.map(item => item.position).sort((a, b) => a - b);
      const reversePositions = positions.map(position => 8 - position).sort((a, b) => a - b);
      const compare = (a: number[], b: number[]) => {
        for (let index = 0; index < a.length; index += 1) {
          const difference = a[index] - b[index];
          if (difference) return difference;
        }
        return 0;
      };
      if (compare(positions, reversePositions) > 0) return false;
      if (compare(positions, reversePositions) === 0) {
        const ordered = [...substituents].sort((a, b) => a.position - b.position);
        const alpha = (term: string) => term === "hydroxy" ? "hydroxy" : term === "methyl" ? "methyl" : "methylpropyl";
        if (alpha(ordered[0].termName).localeCompare(alpha(ordered[1].termName)) > 0) return false;
      }

      const ids = ring(); bond(anchor, ids[0]);
      const branches: { item: ArylSubstituent; ids: number[]; bonds: [number, number][] }[] = [];
      for (const item of substituents) {
        const term = legacyPrefixTerm(item.termName);
        if (!term || term.en !== item.termName || term.charges || term.elements.some(element => !["C", "O"].includes(element))
          || term.kind && term.kind !== "alcohol"
          || term.kind !== "alcohol" && term.bonds.some(([, , order]) => order !== 1)) return false;
        const branch = term.elements.map(element => atom(element as "C" | "O"));
        term.bonds.forEach(([a, b, order]) => bond(branch[a], branch[b], order as 1 | 2 | 3));
        bond(ids[item.position - 1], branch[0]);
        branches.push({ item, ids: branch, bonds: term.bonds.map(([a, b]) => [branch[a], branch[b]] as [number, number]) });
      }
      const allBranchIds = branches.flatMap(branch => branch.ids);
      const ringNumbering: [number, number | string][] = [[ids[0], 1], ...positions.map(position => [ids[position - 1], position] as [number, number])];
      const ringIds = [...ids, ...allBranchIds];
      const arylBonds: [number, number][] = [
        ...graph.bonds.filter(([a, b]) => ringIds.includes(a) && ringIds.includes(b)).map(([a, b]) => [a, b] as [number, number]),
        [anchor, ids[0]],
      ];
      const groupList = substituents.map(item => `${item.termName} at ring position ${item.position}`).join(" and ");
      const groupListEs = substituents.map(item => `${item.termName === "hydroxy" ? "hidroxi" : item.termName} en C${item.position}`).join(" y ");
      component("aryl", "substituent", text, start, ringIds,
        `The phenyl ring attaches to the parent at ring position 1; its additional substituents are ${groupList}. Ring locants are independent of parent locants.`,
        { explanationEs: `El anillo fenilo se une al padre por C1; sus sustituyentes adicionales son ${groupListEs}. Los localizadores del anillo son independientes de los del padre.`,
          locant, parentId: "parent", numbering: ringNumbering, bondIds: arylBonds });

      if (multiplicativeText) {
        const methylBranches = branches;
        const methylIds = methylBranches.flatMap(branch => branch.ids);
        const methylBonds: [number, number][] = methylBranches.flatMap(branch => [
          ...branch.bonds, [ids[branch.item.position - 1], branch.ids[0]] as [number, number],
        ]);
        component("aryl-prefix", "prefix", multiplicativeText, start, methylIds,
          `The multiplicative prefix dimethyl denotes two distinct methyl groups at ring positions ${positions.join(" and ")}.`,
          { start, end: start + multiplicativeText.length, locant: positions[0], parentId: "aryl",
            numbering: methylBranches.map(branch => [branch.ids[0], branch.item.position]), bondIds: methylBonds,
            explanationEs: `El prefijo multiplicativo «dimetil» representa dos grupos metilo distintos en C${positions[0]} y C${positions[1]} del anillo. Cada localizador se vincula con el carbono de su grupo.` });
      } else {
        for (const branch of branches) {
          const { item } = branch;
          const term = legacyPrefixTerm(item.termName)!;
          const termStart = start + item.offset;
          const internalNumbering = rootedAlkylNumbering(term.elements, term.bonds);
          const explanation = term.kind === "alcohol"
            ? `Hydroxy specifies the –OH group at ring position ${item.position}.`
            : `The rooted ${item.termName} graph attaches at ring position ${item.position}; its internal numbering starts at the attachment atom and is separate from ring numbering.`;
          const explanationEs = term.kind === "alcohol"
            ? `El prefijo «hidroxi» identifica el grupo –OH unido al C${item.position} del anillo.`
            : internalNumbering
              ? `La numeración interna de «${item.termName}» comienza en el átomo unido al anillo (C1): la cadena más larga tiene ${internalNumbering.backboneLength} carbonos${internalNumbering.branches.length ? ` y presenta ${internalNumbering.branches.map(branchInfo => `un ramal de ${branchInfo.carbons} ${branchInfo.carbons === 1 ? "carbono" : "carbonos"} en C${branchInfo.locant}`).join(" y ")}` : " y no presenta ramales"}. Esos localizadores son independientes del C${item.position} del fenilo.`
              : `El sustituyente «${item.termName}» se une al C${item.position} del fenilo; su numeración interna es independiente de la numeración del anillo.`;
          component(`aryl-prefix-${item.position}`, "prefix", item.termName, termStart, branch.ids, explanation,
            { locant: item.position, parentId: "aryl", numbering: [[branch.ids[0], item.position]],
              bondIds: [...branch.bonds, [ids[item.position - 1], branch.ids[0]]], explanationEs });
        }
      }
      return true;
    }

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
    const arylExplanation = locant === "N"
      ? `The phenyl substituent attaches through the amide nitrogen (N), not directly to an acetamide carbon. Its attachment carbon is ring position 1; the nested substituent is at ring position ${position}.`
      : `The phenyl substituent attaches at ${locant}. Its attachment carbon is ring position 1; the nested substituent is at ring position ${position}.`;
    const arylExplanationEs = locant === "N"
      ? `El fenilo se une al nitrógeno de la amida (N), no directamente a un carbono de la acetamida. El carbono de unión es C1 del anillo y el otro sustituyente está en C${position}.`
      : `El grupo fenilo se une a la cadena principal por el C1 del anillo, en el localizador ${locant} de la cadena. El otro sustituyente está en el C${position} del anillo; esta numeración interna no cambia la numeración del padre.`;
    component("aryl", "substituent", text, start, [...ids, ...branch], arylExplanation,
      { explanationEs: arylExplanationEs,
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
  let allowEquivalentNumbering = false;
  let parentSystem: ValidatedNameDerivation["parentSystem"];
  let ruleEvidence: NameRuleEvidence | undefined;
  const acyclic = /^([2-9])-(?:\[(.+)\]|\((.+)\))([a-z]+)anoic acid$/.exec(name);
  const amide = /^N-\((.+)\)(acetamide|[a-z]+anamide)$/.exec(name);
  // Parentheses are optional only around this single, unambiguous prefix.
  // Keep paired delimiters explicit rather than deleting punctuation globally.
  const benzoic = /^([2-4])-(?:\((acetyloxy|[a-z]+anoyloxy)\)|(acetyloxy|[a-z]+anoyloxy))benzoic acid$/.exec(name);
  if (acyclic) {
    const n = roots.indexOf(acyclic[4]), position = Number(acyclic[1]);
    if (n < 2 || position > n) return null;
    parent = chain(n); const functionIds = acid(parent[0]); group = "carboxylicAcid";
    const parentStart = name.length - `${acyclic[4]}anoic acid`.length;
    component("parent", "parent", name.slice(parentStart), parentStart, parent,
      `The selected parent is the ${n}-carbon acyclic chain. The carboxyl carbon is C1 and the carboxylic acid is the principal characteristic group. Because that principal group occurs only in the chain while the phenyl ring is cited as a substituent, Blue Book P-59.2.1.2 selects the acyclic parent; phenyl attaches at C${position}.`,
      { explanationEs: `Se selecciona como padre la cadena acíclica de ${n} carbonos. El carbono carboxílico es C1 y el ácido carboxílico es la función principal. Como esta función aparece solo en la cadena y el anillo fenilo se cita como sustituyente, el criterio Blue Book P-59.2.1.2 selecciona la cadena acíclica; el fenilo se une en C${position}.`,
        numbering: parent.map((id,i) => [id, i + 1]) });
    component("suffix", "suffix", "oic acid", name.length - 8, functionIds,
      "The carboxyl group determines the acid suffix and numbering origin.",
      { explanationEs: "El grupo carboxilo (–COOH) es la función principal y aporta el sufijo «oic acid» del nombre sistemático inglés." });
    if (!aryl(acyclic[2] ?? acyclic[3], 3, parent[position - 1], position)) return null;
  } else if (amide) {
    const n = amide[2] === "acetamide" ? 2 : roots.indexOf(amide[2].slice(0, -7));
    if (n < 2) return null;
    parent = chain(n); const oxygen = atom("O"), nitrogen = atom("N"); bond(parent[0], oxygen, 2); bond(parent[0], nitrogen); group = "amide";
    const parentStart = name.length - amide[2].length;
    component("parent", "parent", amide[2], parentStart, [...parent, nitrogen],
      `The ${n}-carbon amide is the parent. N- identifies substitution on nitrogen rather than on a numbered carbon.`,
      { numbering: parent.map((id,i) => [id, i + 1]),
        explanationEs: `La estructura principal incluye la cadena de ${n} carbonos y el grupo amida. El prefijo «N-» indica que la sustitución ocurre en el nitrógeno, no en un carbono numerado.` });
    component("suffix", "suffix", "amide", name.length - 5, [parent[0], oxygen, nitrogen], "C(=O)–N establishes the amide suffix.",
      { explanationEs: "El grupo C(=O)–N establece el sufijo de amida y forma parte de la estructura principal." });
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
      { locant: position, parentId: "parent", labelEs: n === 2 ? "acetiloxi" : `${iupacRootForCarbonCount(n)}anoiloxi`,
        bondIds: [...graph.bonds.filter(([a,b]) => ids.includes(a) && ids.includes(b)).map(([a,b]): [number,number] => [a,b]), [parent[position - 1], oxygen]] });
    parent = [...parent, carbon];
  } else {
    const family = parseAdditionalSystematicFamily(name);
    if (!family) return null;
    graph.atoms.push(...family.graph.atoms); graph.bonds.push(...family.graph.bonds);
    components.push(...family.components); parent=family.parent; group=family.group;
    allowEquivalentParents=!!family.equivalentParentPaths;
    allowEquivalentNumbering=!!family.allowEquivalentNumbering;
    parentSystem=family.parentSystem;
    ruleEvidence=family.evidence;
  }

  // Every named span is literal and every graph atom must be accounted for.
  if (components.some(c => name.slice(c.start, c.end) !== c.text)
    || graph.atoms.some(a => !components.some(c => c.atomIds.includes(a.id)))) return null;
  // A ring with proved numbering can retain a reflection exchanging equivalent
  // atoms. The representative is one complete valid numbered assignment; named
  // chemical regions must still have invariant images under all isomorphisms.
  // Families without this proof retain strict per-locant invariance.
  const regions = components.flatMap(c => [c.atomIds, ...(allowEquivalentNumbering ? [] : c.numbering.map(([id]) => [id]))]);
  const equivalence=allowEquivalentParents?analyzeStructuralEquivalence(graph,actual):null;
  const mapping = allowEquivalentParents ? equivalence?.representative : mapStructuralRegions(graph, actual, regions);
  if (!mapping) return null;
  const assignment=(map: Map<number,number>)=>({parentAtomIds:parent.map(id=>map.get(id)!),
    components:components.map(c=>({...c,atomIds:c.atomIds.map(id=>map.get(id)!),
      bondIds:c.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
      numbering:c.numbering.map(([id,n]):[number,number|string]=>[map.get(id)!,n]),
      ...(c.internalNumbering ? {internalNumbering:c.internalNumbering.map(([id,n]):[number,number]=>[map.get(id)!,n])} : {}),
      ...(c.writtenLocants ? {writtenLocants:c.writtenLocants.map(item=>({...item,atomId:map.get(item.atomId)!}))} : {}),
    }))});
  const representative=assignment(mapping);
  const evidence: ValidatedCompositionalEvidence | undefined = ruleEvidence ? {...ruleEvidence,
    reconstructedGraph: graph, atomMapping: [...mapping], equivalence: "complete-graph-isomorphism"} : undefined;
  if(!equivalence)return {status:"FULL",name,preferred:false,principalGroup:group,...representative,...(parentSystem?{parentSystem}:{}),...(evidence?{evidence}:{})};
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
