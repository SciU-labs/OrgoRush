import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { mapStructuralRegions, mapStructuralRepresentative, analyzeStructuralEquivalence } from "./structural-derivation.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { spanishSubstitutiveName } from "./compositional-name-model.ts";
import { parseAdditionalSystematicFamily } from "./systematic-family-grammar.ts";
import { localizeAromaticNitrogenAcidName } from "./aromatic-nitrogen-acid-grammar.ts";
import { localizeBenzeneRingAssemblyName } from "./benzene-ring-assembly.ts";
import { reconcileCarbohydrateName } from "./carbohydrate-derivation.ts";
import { englishIupacRoot, iupacRootForCarbonCount } from "./iupac-prefixes.ts";
import type { NameComponent, PrincipalGroup, NameRuleEvidence, ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
import { getTetrahedralStereoCenters } from "./tetrahedral-stereochemistry.ts";
import { getMainChainStereoDescriptors } from "./double-bond-stereochemistry.ts";
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
  /** The constitution name and locants whose stereodescriptors were separately verified. */
  stereochemicalBaseName?: string;
  stereochemicalDescriptors?: { locant: number; configuration: "R" | "S"; baseOffset: number }[];
  evidence?: ValidatedCompositionalEvidence;
  symmetry?: {
    mappingCount: number;
    atomOrbits: number[][];
    assignments: {parentAtomIds: number[]; components: NameComponent[]}[];
    explanation: string;
  };
};

export type ValidatedNamePresentation = { name: string; language: "en" | "es"; localized: boolean };

/** Prefer a locally generated Spanish name only after independently proving
 * that exact spelling against the current molecular graph. */
export function selectVerifiedLocalizedPresentation(model: ValidatedNameDerivation, molecule: GeneratedMolecule,
  language: "en" | "es", localSpanishName: string | null): ValidatedNamePresentation {
  const original = presentValidatedSystematicName(model, language);
  if (language !== "es" || original.localized || !localSpanishName) return original;
  return reconcileSystematicName(molecule, localSpanishName)
    ? {name: localSpanishName, language: "es", localized: true} : original;
}

/** Localizes supported FULL constructions.
 * The original English name remains the validation key and component spans
 * continue to refer to it; atom mappings come from the reconciled model. */
export function presentValidatedSystematicName(model: ValidatedNameDerivation, language: "en" | "es"): ValidatedNamePresentation {
  if (language === "en") return { name: model.name, language: "en", localized: false };
  if (model.evidence?.language === "en" && model.evidence.reconstructedGraph) {
    const localized = localizeAromaticNitrogenAcidName(model.name);
    if (localized && reconcileSystematicName(model.evidence.reconstructedGraph, localized)?.evidence?.language === "es")
      return { name: localized, language: "es", localized: true };
    if (model.evidence.construction === "benzene-ring-assembly") {
      const assemblyName = localizeBenzeneRingAssemblyName(model.name);
      if (assemblyName && reconcileSystematicName(model.evidence.reconstructedGraph, assemblyName)?.evidence?.language === "es")
        return { name: assemblyName, language: "es", localized: true };
    }
  }
  if (model.evidence?.stereo === "specified-tetrahedral" && model.stereochemicalBaseName
    && model.stereochemicalDescriptors?.length) {
    const topLevel = model.stereochemicalDescriptors.every(descriptor => descriptor.baseOffset === 0);
    const base = topLevel ? spanishSubstitutiveName(model.components.filter(component => !component.id.startsWith("stereo-"))) : null;
    const descriptor = `(${model.stereochemicalDescriptors.map(item => `${item.locant}${item.configuration}`).join(",")})-${base ?? ""}`;
    if (base && reconcileSystematicName(model.evidence.reconstructedGraph, descriptor)?.status === "FULL") {
      return { name: descriptor, language: "es", localized: true };
    }
    // Other supported constructions continue through their own localized
    // presentation path, preserving descriptors in their original scope.
  }
  if(model.evidence?.construction==="polysubstituted-benzene-prefixes"&&model.evidence.language==="en"){
    const prefixes=model.components.filter(component=>component.role==="prefix"&&component.parentId==="parent")
      .sort((a,b)=>a.start-b.start).map(component=>{
        const term=component.citationKey?legacyPrefixTerm(component.citationKey):undefined;
        const multiplicity=component.numbering.length;
        if(!term||!multiplicity)return null;
        const multiplier=multiplicity===1?"":({2:"di",3:"tri",4:"tetra",5:"penta",6:"hexa"} as Record<number,string>)[multiplicity];
        if(multiplier===undefined)return null;
        const enclosed=component.text.includes("(")?"(":"",prefix=component.numbering.map(([,locant])=>locant).join(",");
        return `${prefix}-${enclosed}${multiplier}${term.es}${enclosed?")":""}`;
      });
    const parent=model.components.find(component=>component.id==="parent");
    if(parent&&prefixes.length&&prefixes.every(Boolean)){
      const name=`${prefixes.join("-")}${parent.text==="benzene"?"benceno":parent.text}`;
      const proof=reconcileSystematicName(model.evidence.reconstructedGraph,name);
      if(proof?.evidence?.construction==="polysubstituted-benzene-prefixes"&&proof.evidence.language==="es")return {name,language:"es",localized:true};
    }
  }
  if ((model.evidence?.construction === "acyclic-aryl-amine" || model.evidence?.construction === "substituted-alkanamide" || model.evidence?.construction === "aminoalkyl-benzenediol") && model.evidence.language === "en") {
    const name = spanishSubstitutiveName(model.components);
    if (name && reconcileSystematicName(model.evidence.reconstructedGraph,name)?.evidence?.language==="es")
      return {name,language:"es",localized:true};
  }
  if (model.evidence?.language==="en" && ["multifunctional-alcohol","polycarboxylic-acid"].includes(model.evidence.construction)) {
    const terms:Record<string,string>={tricarboxylic:"tricarboxílico",anedioic:"anodioico",phenoxy:"fenoxi",phenyl:"fenil",phenol:"fenol",benzene:"benceno",hydroxy:"hidroxi",oxy:"oxi",meth:"met",eth:"et",yl:"il",cyclo:"ciclo",tert:"terc",ane:"ano"};
    const acid=model.name.endsWith(" acid");
    const spelling=(acid?"ácido ":"")+(acid?model.name.slice(0,-5):model.name).replace(/tricarboxylic|anedioic|phenoxy|phenyl|phenol|benzene|hydroxy|meth|eth|oxy|yl|cyclo|tert|ane/g,term=>terms[term]);
    if(reconcileSystematicName(model.evidence.reconstructedGraph,spelling)?.evidence?.language==="es")
      return {name:spelling,language:"es",localized:true};
  }
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
type ParsedNameStereo = {
  baseName: string;
  descriptors: { locant: number; configuration: "R" | "S"; baseOffset: number; tokenStart: number; tokenEnd: number }[];
  geometric: { locant?: number; configuration: "E" | "Z"; tokenStart: number; tokenEnd: number }[];
  baseToOriginal: number[];
};

function parseNameStereo(name: string): ParsedNameStereo {
  const expression = /\((\d+[RS](?:,\d+[RS])*)\)-/g;
  const descriptors: ParsedNameStereo["descriptors"] = [], baseToOriginal: number[] = [];
  let baseName = "", cursor = 0, match: RegExpExecArray | null;
  while ((match = expression.exec(name))) {
    const before = name.slice(cursor, match.index);
    baseName += before;
    for (let index = cursor; index < match.index; index += 1) baseToOriginal.push(index);
    const tokenEnd = match.index + match[0].length - 1;
    const baseOffset = baseName.length;
    for (const entry of match[1].split(",")) {
      const descriptor = /^(\d+)([RS])$/.exec(entry)!;
      descriptors.push({ locant: Number(descriptor[1]), configuration: descriptor[2] as "R" | "S",
        baseOffset, tokenStart: match.index, tokenEnd });
    }
    cursor = match.index + match[0].length;
  }
  baseName += name.slice(cursor);
  for (let index = cursor; index < name.length; index += 1) baseToOriginal.push(index);
  const geometric: ParsedNameStereo["geometric"] = [];
  const geometricPrefix = /^\(((?:\d+[EZ])(?:,\d+[EZ])*|[EZ])\)-/.exec(baseName);
  if (geometricPrefix) {
    const tokenStart = baseToOriginal[0] ?? 0;
    const tokenEnd = (baseToOriginal[geometricPrefix[0].length - 1] ?? (geometricPrefix[0].length - 1)) + 1;
    for (const item of geometricPrefix[1].split(",")) {
      const descriptor = /^(\d+)?([EZ])$/.exec(item)!;
      geometric.push({ ...(descriptor[1] ? { locant: Number(descriptor[1]) } : {}), configuration: descriptor[2] as "E" | "Z", tokenStart, tokenEnd });
    }
    baseName = baseName.slice(geometricPrefix[0].length);
    baseToOriginal.splice(0, geometricPrefix[0].length);
  }
  return { baseName, descriptors, geometric, baseToOriginal };
}

function reconcile(actual: GeneratedMolecule, name: string): ValidatedNameDerivation | null {
  // Preserve the dedicated carbohydrate reconciler's full stereo-aware path
  // before generic R/S name parsing, which handles a different grammar.
  const carbohydrate = reconcileCarbohydrateName(actual, name);
  if (carbohydrate) return carbohydrate;
  const parsed = parseNameStereo(name);
  const constitutional = parsed.descriptors.length || parsed.geometric.length ? { ...actual,
    atoms: parsed.descriptors.length ? actual.atoms.map(({ tetrahedralParity: _parity, tetrahedralBondTo: _carrier, ...atom }) => atom) : actual.atoms,
    ...(parsed.geometric.length ? { bonds: actual.bonds.map(([a,b,order]) => [a,b,order] as [number,number,1|2|3]) } : {}) } : actual;
  const proof = reconcileConstitution(constitutional, parsed.baseName);
  if (!proof) return null;
  const actualCenters = getTetrahedralStereoCenters(actual);
  const hasStoredParity = actual.atoms.some(atom => atom.tetrahedralParity);
  if (hasStoredParity && actualCenters.length !== actual.atoms.filter(atom => atom.tetrahedralParity).length) return null;
  if (!parsed.descriptors.length && !parsed.geometric.length) return hasStoredParity ? null : proof;
  if (parsed.descriptors.length && actualCenters.length !== parsed.descriptors.length) return null;

  const resolved = parsed.descriptors.map(descriptor => {
    const candidates = proof.components.flatMap(component => {
      const topLevelDescriptor = descriptor.baseOffset === 0;
      if (topLevelDescriptor ? component.role !== "parent"
        : descriptor.baseOffset < component.start || descriptor.baseOffset > component.end) return [];
      const mappings = component.internalNumbering?.length ? component.internalNumbering : component.numbering;
      return mappings.filter(([, locant]) => locant === descriptor.locant).map(([atomId]) => atomId);
    });
    const atomIds = [...new Set(candidates)];
    if (atomIds.length !== 1) return null;
    const center = actualCenters.find(item => item.atomId === atomIds[0]);
    return center?.configuration === descriptor.configuration ? { ...descriptor, atomId: center.atomId } : null;
  });
  if (resolved.some(item => !item)) return null;
  if (parsed.descriptors.length) {
    const uniqueCenters = new Set(resolved.map(item => item!.atomId));
    if (uniqueCenters.size !== actualCenters.length) return null;
  } else if (hasStoredParity) return null;

  let resolvedGeometric: { locant: number; configuration: "E" | "Z"; atomIds: [number,number] }[] = [];
  if (parsed.geometric.length) {
    const markedDoubleBonds = actual.bonds.filter(bond => bond[3] === true);
    const actualDescriptors = getMainChainStereoDescriptors(actual, proof.parentAtomIds, true);
    if (markedDoubleBonds.length !== parsed.geometric.length || actualDescriptors.length !== parsed.geometric.length) return null;
    resolvedGeometric = parsed.geometric.map((descriptor, index) => {
      const inferredLocant = descriptor.locant ?? (parsed.geometric.length === 1 ? actualDescriptors[0]?.locant : undefined);
      if (inferredLocant === undefined) return null;
      const match = actualDescriptors.find(item => item.locant === inferredLocant && item.configuration === descriptor.configuration);
      return match ? { locant: inferredLocant, configuration: descriptor.configuration, atomIds: [match.atomIds[0], match.atomIds[1]] as [number,number] } : null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    if (resolvedGeometric.length !== parsed.geometric.length) return null;
  } else if (actual.bonds.some(bond => bond[3] === true)) return null;

  const originalStart = (offset: number) => parsed.baseToOriginal[offset] ?? name.length;
  const originalEnd = (offset: number) => offset <= 0 ? 0 : (parsed.baseToOriginal[offset - 1] ?? name.length - 1) + 1;
  const components = proof.components.map(component => {
    const start = originalStart(component.start), end = originalEnd(component.end);
    return { ...component, start, end, text: name.slice(start, end),
      ...(component.writtenLocants ? { writtenLocants: component.writtenLocants.map(item => ({ ...item,
        start: originalStart(item.start), end: originalEnd(item.end) })) } : {}) };
  });
  for (const descriptor of resolved as NonNullable<(typeof resolved)[number]>[]) {
    const token = name.slice(descriptor.tokenStart, descriptor.tokenEnd);
    const text = `${descriptor.locant}${descriptor.configuration}`;
    const localStart = token.indexOf(text);
    if (localStart < 0) return null;
    components.push({ id: `stereo-${descriptor.locant}`, role: "prefix", text,
      start: descriptor.tokenStart + localStart, end: descriptor.tokenStart + localStart + text.length,
      parentId: "parent", atomIds: [descriptor.atomId], bondIds: [],
      numbering: [[descriptor.atomId, descriptor.locant]],
      explanation: `At locant ${descriptor.locant}, the molecular graph has the specified ${descriptor.configuration} configuration.`,
      explanationEs: `En el localizador ${descriptor.locant}, el grafo molecular presenta la configuración ${descriptor.configuration} especificada.`,
      label: `(${text})`, labelEs: `(${text})` });
  }
  for (let index = 0; index < resolvedGeometric.length; index++) {
    const descriptor = resolvedGeometric[index]!;
    const sourceToken = parsed.geometric[index]!;
    const start = sourceToken.tokenStart, end = sourceToken.tokenEnd - 1;
    components.push({ id: `geometry-${descriptor.locant}`, role: "unsaturation", text: name.slice(start, end), start, end,
      parentId: "parent", atomIds: descriptor.atomIds, bondIds: [[descriptor.atomIds[0], descriptor.atomIds[1]]],
      numbering: [[descriptor.atomIds[0], descriptor.locant]], locant: descriptor.locant,
      explanation: `The explicit ${descriptor.configuration} descriptor is verified for the parent C${descriptor.locant}=C${descriptor.locant + 1} double bond.`,
      explanationEs: `El descriptor ${descriptor.configuration} se verifica en el doble enlace parental C${descriptor.locant}=C${descriptor.locant + 1}.`,
      label: `${descriptor.configuration} at C${descriptor.locant}=C${descriptor.locant + 1}`,
      labelEs: `${descriptor.configuration} en C${descriptor.locant}=C${descriptor.locant + 1}` });
  }
  const actualParity = new Map(actual.atoms.filter(atom => atom.tetrahedralParity).map(atom => [atom.id, atom.tetrahedralParity!]));
  const mappedReconstruction = proof.evidence ? { ...proof.evidence.reconstructedGraph,
    atoms: proof.evidence.reconstructedGraph.atoms.map(atom => {
      const sourceId = proof.evidence!.atomMapping.find(([constructed]) => constructed === atom.id)?.[1];
      const parity = sourceId === undefined ? undefined : actualParity.get(sourceId);
      return { ...atom, ...(parity ? { tetrahedralParity: parity } : {}) };
    }),
    bonds: proof.evidence.reconstructedGraph.bonds.map(([a,b,order]) => {
      const map = new Map(proof.evidence!.atomMapping);
      const sourceA = map.get(a), sourceB = map.get(b);
      const marked = sourceA !== undefined && sourceB !== undefined && actual.bonds.some(([left,right,,explicit]) => explicit === true
        && (left === sourceA && right === sourceB || left === sourceB && right === sourceA));
      const reconstructedBond = [a,b,order] as typeof proof.evidence.reconstructedGraph.bonds[number];
      if (marked) reconstructedBond[3] = true;
      return reconstructedBond;
    }) } : undefined;
  const stereo: NameRuleEvidence["stereo"] = parsed.descriptors.length && resolvedGeometric.length ? "specified-tetrahedral-and-geometric"
    : parsed.descriptors.length ? "specified-tetrahedral" : resolvedGeometric.length ? "specified-geometric" : "unspecified-only";
  const evidence = proof.evidence && mappedReconstruction ? { ...proof.evidence, reconstructedGraph: mappedReconstruction, stereo } : undefined;
  return { ...proof, name, components, stereochemicalBaseName: parsed.baseName,
    stereochemicalDescriptors: parsed.descriptors.map(({locant,configuration,baseOffset})=>({locant,configuration,baseOffset})),
    ...(evidence ? { evidence } : {}) };
}

function reconcileConstitution(actual: GeneratedMolecule, name: string): ValidatedNameDerivation | null {
  const carbohydrate=reconcileCarbohydrateName(actual,name);if(carbohydrate)return carbohydrate;
  if (name.length > 200 || actual.bonds.some(b => b[3] !== undefined)) return null;
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
    if (!aryl(acyclic[2] ?? acyclic[3], 3, parent[position - 1], position)) {
      const family = parseAdditionalSystematicFamily(name); if (!family) return null;
      graph.atoms.length = 0; graph.bonds.length = 0;
      graph.atoms.push(...family.graph.atoms); graph.bonds.push(...family.graph.bonds);
      components.length = 0; components.push(...family.components); parent = family.parent; group = family.group;
      allowEquivalentParents = !!family.equivalentParentPaths; allowEquivalentNumbering = !!family.allowEquivalentNumbering;
      parentSystem = family.parentSystem; ruleEvidence = family.evidence;
    }
  } else if (amide && !/\)-[N2-9]/.test(amide[1])) {
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
  const grouped=new Map<string,number[]>();
  for(const component of components) {
    const key=component.mappingGroup ?? component.equivalenceGroup;
    if(key) grouped.set(key,[...(grouped.get(key)??[]),...component.atomIds]);
  }
  const regions = [...grouped.values(),...components.flatMap(c => [
    ...(!c.mappingGroup && !c.equivalenceGroup?[c.atomIds]:[]), ...(allowEquivalentNumbering ? [] : c.numbering.map(([id]) => [id]))])];
  const equivalence=allowEquivalentParents?analyzeStructuralEquivalence(graph,actual):null;
  const mapping = equivalence ? equivalence.representative
    : allowEquivalentNumbering ? mapStructuralRepresentative(graph,actual) : mapStructuralRegions(graph, actual, regions);
  if (!mapping) return null;
  const assignment=(map: Map<number,number>)=>({parentAtomIds:parent.map(id=>map.get(id)!),
    components:components.map(c=>({...c,atomIds:c.atomIds.map(id=>map.get(id)!),
      bondIds:c.bondIds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!]),
      numbering:c.numbering.map(([id,n]):[number,number|string]=>[map.get(id)!,n]),
      ...(c.attachmentBonds ? {attachmentBonds:c.attachmentBonds.map(([a,b]):[number,number]=>[map.get(a)!,map.get(b)!])} : {}),
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
  },...(evidence?{evidence}:{})};
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
