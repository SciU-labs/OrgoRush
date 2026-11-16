import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { CanonizerUtil, Molecule as OCLMolecule } from "openchemlib";
import { moleculeFromSmiles, moleculeToSmiles } from "./openchemlib-adapter.ts";
import { englishIupacRoot, IUPAC_ROOTS } from "./iupac-prefixes.ts";
import { translateSpanishIupacToOpsin } from "./iupac-name-normalization.ts";
import { buildHydrocarbonFromIupacName } from "./name-to-molecule.ts";
import { buildOpenChemLibStereoGraph, getTetrahedralStereoCenters } from "./tetrahedral-stereochemistry.ts";
import { inspectDoubleBondStereochemistry } from "./double-bond-stereochemistry.ts";

/** A deliberately finite grammar for external names whose localization can be
 * proved without changing parent choice, numbering or stereochemistry. */
type Prefix = {
  locants: number[];
  multiplier: string;
  term: string;
  substituent?: { kind: "functionalized-alkyl"; sourceName: string; root: string; carbonCount: number; functional: string; internalLocant: number };
  advancedSubstituent?: AdvancedSubstituent;
  wrapper?: "(" | "[";
};
type Parsed = { parent: "phenol" | "benzene"; prefixes: Prefix[]; language: "en" | "es" };
type AdvancedGroup = { locant: number; name: string; nested?: AdvancedSubstituent };
type AdvancedSubstituent =
  | { kind: "alkyl"; sourceName: string; root: string; carbonCount: number; attachmentLocant: number; attachmentLocantExplicit: boolean; unsaturation?: { locant: number; order: 2 | 3 }; groups: AdvancedGroup[] }
  | { kind: "aryl"; sourceName: string; ring: Parsed };

const spanishRoots = IUPAC_ROOTS.slice(1, 11);
const roots = ["", ...spanishRoots.map(englishIupacRoot)];
const rootEs: Record<string, string> = Object.fromEntries(roots.slice(1).map((root, index) => [root, spanishRoots[index]!]));
const rootEn: Record<string, string> = Object.fromEntries(Object.entries(rootEs).map(([en, es]) => [es, en]));
const multipliers = ["", "di", "tri", "tetra", "penta", "hexa"] as const;
const functionalGroups = ["amino", "hydroxy", "fluoro", "chloro", "bromo", "iodo", "methoxy", "ethoxy", "propoxy"] as const;
const terms = roots.slice(1).map(root => `${root}yl`);
const spanishTerms = spanishRoots.map(root => `${root}il`);
function termsWithMultiplied(term: string) { return multipliers.slice(1).map(multiplier => `${multiplier}${term}`); }

function rootCarbonCount(root: string) { return roots.indexOf(root as typeof roots[number]); }

function parseAlkyl(text: string, language: "en" | "es") {
  const rootMap = language === "en" ? Object.fromEntries(roots.map(root => [root, root])) : rootEn;
  const ending = language === "en" ? "yl" : "il";
  for (const functional of functionalGroups) {
    const term = language === "en" ? functional : ({ amino: "amino", hydroxy: "hidroxi", fluoro: "fluoro", chloro: "cloro", bromo: "bromo", iodo: "yodo", methoxy: "metoxi", ethoxy: "etoxi", propoxy: "propoxi" } as Record<string, string>)[functional];
    const match = new RegExp(`^(?:(\\d+)-)?${term}(${Object.keys(rootMap).filter(Boolean).join("|")})${ending}$`).exec(text);
    if (!match) continue;
    const root = rootMap[match[2]!];
    return { root, count: rootCarbonCount(root), functional, internalLocant: Number(match[1] ?? "1"), term };
  }
  const alkylMatch = new RegExp(`^(${Object.keys(rootMap).filter(Boolean).join("|")})${ending}$`).exec(text);
  if (alkylMatch) return { root: rootMap[alkylMatch[1]!]!, count: rootCarbonCount(rootMap[alkylMatch[1]!]!), functional: "", internalLocant: 1, term: "" };
  return null;
}

function readBalanced(value: string, openingIndex: number) {
  const opening = value[openingIndex];
  const closing = opening === "(" ? ")" : opening === "[" ? "]" : "";
  if (!closing) return null;
  const stack = [closing];
  for (let index = openingIndex + 1; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(" || char === "[") stack.push(char === "(" ? ")" : "]");
    else if (char === ")" || char === "]") {
      if (stack.pop() !== char) return null;
      if (!stack.length) return { text: value.slice(openingIndex + 1, index), end: index + 1, closing };
    }
  }
  return null;
}

function parseAdvancedSubstituent(sourceName: string, language: "en" | "es", depth = 0): AdvancedSubstituent | null {
  if (depth > 4 || !sourceName || sourceName.length > 100) return null;
  let text = language === "es" ? translateSpanishIupacToOpsin(sourceName) : sourceName;
  if (language === "es") {
    const spanishUnsaturatedRadical = new RegExp(`^(?<prefix>.*?)(?<root>${Object.keys(rootEn).sort((a,b)=>b.length-a.length).join("|")})-(?<locant>\\d+)-(?<bond>en|in)il$`).exec(text);
    if (spanishUnsaturatedRadical?.groups) {
      const { prefix, root, locant, bond } = spanishUnsaturatedRadical.groups;
      text = `${prefix}${rootEn[root]!}-${locant}-${bond === "en" ? "en" : "yn"}yl`;
    }
  }
  if (text.endsWith("phenyl")) {
    const ringName = `${text.slice(0, -"phenyl".length)}benzene`;
    const ring = parseName(ringName, "en");
    return ring ? { kind: "aryl", sourceName, ring } : null;
  }

  const rootPattern = roots.slice(1).map(root => root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((left, right) => right.length - left.length).join("|");
  const core = new RegExp(`(?<root>${rootPattern})(?:-(?<unsaturationLocant>\\d+)-(?<unsaturation>en|yn))?(?:-(?<attachmentLocant>\\d+))?yl$`).exec(text);
  if (!core?.groups) return null;
  const root = core.groups.root!;
  const carbonCount = roots.indexOf(root as typeof roots[number]);
  const attachmentLocant = Number(core.groups.attachmentLocant ?? 1);
  const unsaturationLocant = core.groups.unsaturationLocant ? Number(core.groups.unsaturationLocant) : undefined;
  const unsaturation = core.groups.unsaturation
    ? { locant: unsaturationLocant!, order: core.groups.unsaturation === "en" ? 2 as const : 3 as const }
    : undefined;
  if (carbonCount < 1 || attachmentLocant < 1 || attachmentLocant > carbonCount
    || unsaturationLocant !== undefined && (unsaturationLocant < 1 || unsaturationLocant >= carbonCount)) return null;

  let head = text.slice(0, core.index);
  const groups: AdvancedGroup[] = [];
  const groupNames = [...functionalGroups, ...terms, "phenyl"].sort((left, right) => right.length - left.length);
  while (head) {
    const locantMatch = /^(\d+)-/.exec(head);
    if (!locantMatch) return null;
    const locant = Number(locantMatch[1]);
    const afterLocant = head.slice(locantMatch[0].length);
    let name = "";
    let nested: AdvancedSubstituent | undefined;
    let consumed = 0;
    if (afterLocant.startsWith("(") || afterLocant.startsWith("[")) {
      const parsed = readBalanced(afterLocant, 0);
      if (!parsed) return null;
      name = parsed.text;
      const value = parseAdvancedSubstituent(name, "en", depth + 1);
      if (!value) return null;
      nested = value;
      consumed = parsed.end + (afterLocant[parsed.end] === "-" ? 1 : 0);
    } else {
      name = groupNames.find(candidate => afterLocant.startsWith(candidate)
        && (afterLocant[candidate.length] === "-" || candidate.length === afterLocant.length)) ?? "";
      if (!name) return null;
      consumed = name.length + (afterLocant[name.length] === "-" ? 1 : 0);
      if (terms.includes(name) || name === "phenyl") {
        nested = parseAdvancedSubstituent(name, "en", depth + 1) ?? undefined;
        if (!nested) return null;
      }
    }
    if (locant < 1 || locant > carbonCount) return null;
    groups.push({ locant, name, ...(nested ? { nested } : {}) });
    head = head.slice(locantMatch[0].length + consumed);
  }
  if (new Set(groups.map(group => `${group.locant}:${group.name}`)).size !== groups.length) return null;
  return { kind: "alkyl", sourceName, root, carbonCount, attachmentLocant,
    attachmentLocantExplicit: Boolean(core.groups.attachmentLocant), ...(unsaturation ? { unsaturation } : {}), groups };
}

function parseName(value: string, language: "en" | "es"): Parsed | null {
  if (!value || value.length > 160 || /[()[\]RSZE]/i.test(value) && /\([0-9,]*(?:R|S|E|Z)\)/i.test(value)) return null;
  let rest = value;
  const prefixes: Prefix[] = [];
  while (true) {
    const locantMatch = /^(\d+(?:,\d+)*-)/.exec(rest);
    if (!locantMatch) break;
    const locants = locantMatch[1]!.slice(0, -1).split(",").map(Number);
    const afterLocants = rest.slice(locantMatch[0].length);
    let token = "";
    let parenthesized = false;
    let wrapper: "(" | "[" | undefined;
    let complexMultiplier = "";
    let consumed = 0;
    const complexMultiplierMatch = /^(bis|tris|tetrakis)(?=[([])/.exec(afterLocants);
    const delimiterOffset = complexMultiplierMatch?.[0].length ?? 0;
    const opening = afterLocants[delimiterOffset];
    if (complexMultiplierMatch || opening === "(" || opening === "[") {
      const parsed = readBalanced(afterLocants, delimiterOffset);
      if (!parsed || afterLocants[parsed.end] && afterLocants[parsed.end] !== "-" && !/[a-z]/.test(afterLocants[parsed.end]!)) return null;
      token = parsed.text;
      wrapper = opening as "(" | "[";
      parenthesized = true;
      complexMultiplier = complexMultiplierMatch?.[1] ?? "";
      consumed = locantMatch[0].length + parsed.end + (afterLocants[parsed.end] === "-" ? 1 : 0);
    } else {
      const simpleTokens = language === "en"
        ? [...terms, ...terms.flatMap(term => termsWithMultiplied(term)), "amino", "hydroxy", "fluoro", "chloro", "bromo", "iodo", "methoxy", "ethoxy", "propoxy"]
        : [...spanishTerms, ...spanishTerms.flatMap(term => termsWithMultiplied(term)), "amino", "hidroxi", "fluoro", "cloro", "bromo", "yodo", "metoxi", "etoxi", "propoxi"];
      token = simpleTokens.sort((a, b) => b.length - a.length).find(candidate => afterLocants.startsWith(candidate)
        && (afterLocants[candidate.length] === "-" || /^[a-z]/.test(afterLocants.slice(candidate.length))) ) ?? "";
      if (!token) return null;
      consumed = locantMatch[0].length + token.length + (afterLocants[token.length] === "-" ? 1 : 0);
    }
    const termMap: Record<string, string> = language === "en"
      ? Object.fromEntries(terms.map(term => [term, term]))
      : { metil: "methyl", etil: "ethyl", propil: "propyl", butil: "butyl", pentil: "pentyl", hexil: "hexyl", heptil: "heptyl", octil: "octyl", nonil: "nonyl", decil: "decyl" };
    let term = "";
    let multiplier = "";
    let simple = false;
    for (const mult of multipliers) {
      const tail = token.startsWith(mult) ? token.slice(mult.length) : token;
      if (termMap[tail]) { term = termMap[tail]!; multiplier = mult; simple = true; break; }
    }
    if (simple) {
      const expectedCount = complexMultiplier === "bis" ? 2 : complexMultiplier === "tris" ? 3 : complexMultiplier === "tetrakis" ? 4
        : multiplier ? multipliers.indexOf(multiplier as typeof multipliers[number]) + 1 : 1;
      if (locants.length !== expectedCount || locants.some(n => n < 1 || n > 6)) return null;
      prefixes.push({ locants, multiplier: complexMultiplier || multiplier, term });
    } else {
      const standaloneGroups: Record<string, string> = language === "en"
        ? { amino: "amino", hydroxy: "hydroxy", fluoro: "fluoro", chloro: "chloro", bromo: "bromo", iodo: "iodo", methoxy: "methoxy", ethoxy: "ethoxy", propoxy: "propoxy" }
        : { amino: "amino", hidroxi: "hydroxy", fluoro: "fluoro", cloro: "chloro", bromo: "bromo", yodo: "iodo", metoxi: "methoxy", etoxi: "ethoxy", propoxi: "propoxy" };
      if (standaloneGroups[token]) {
        if (parenthesized || locants.length !== 1 || locants[0]! < 1 || locants[0]! > 6) return null;
        prefixes.push({ locants, multiplier: "", term: standaloneGroups[token]! });
        rest = rest.slice(consumed);
        continue;
      }
      const alkyl = parseAlkyl(token, language);
      const advanced = alkyl ? null : parseAdvancedSubstituent(token, language);
      const copies = complexMultiplier === "bis" ? 2 : complexMultiplier === "tris" ? 3 : complexMultiplier === "tetrakis" ? 4 : 1;
      if (!parenthesized || (!alkyl && !advanced) || locants.length !== copies || locants.some(n => n < 1 || n > 6)
        || alkyl && (alkyl.internalLocant < 1 || alkyl.internalLocant > alkyl.count)) return null;
      prefixes.push({ locants, multiplier: complexMultiplier, term: token,
        ...(wrapper ? { wrapper } : {}),
        ...(alkyl ? { substituent: {
          kind: "functionalized-alkyl" as const, sourceName: token, root: alkyl.root,
          carbonCount: alkyl.count, functional: alkyl.functional, internalLocant: alkyl.internalLocant,
        } } : { advancedSubstituent: advanced! }),
      });
    }
    rest = rest.slice(consumed);
  }
  const parent = language === "en" ? rest : rest === "fenol" ? "phenol" : rest === "benceno" ? "benzene" : "";
  const resolvedParent = language === "en" && (rest === "phenol" || rest === "benzene") ? rest : parent;
  if (resolvedParent !== "phenol" && resolvedParent !== "benzene") return null;
  if (resolvedParent === "benzene" && prefixes.some(p => p.locants.some(n => n < 1 || n > 6))) return null;
  if (resolvedParent === "phenol" && prefixes.some(p => p.locants.some(n => n < 2 || n > 6))) return null;
  return { parent: resolvedParent, prefixes, language };
}

function renderAdvancedSubstituent(substituent: AdvancedSubstituent, language: "en" | "es"): string {
  if (substituent.kind === "aryl") {
    return render(substituent.ring, language).replace(language === "es" ? /benceno$/ : /benzene$/,
      language === "es" ? "fenil" : "phenyl");
  }
  const translations: Record<string, string> = {
    amino: "amino", hydroxy: "hidroxi", fluoro: "fluoro", chloro: "cloro", bromo: "bromo", iodo: "yodo",
    methoxy: "metoxi", ethoxy: "etoxi", propoxy: "propoxi", methyl: "metil", ethyl: "etil", propyl: "propil", butyl: "butil",
    pentyl: "pentil", hexyl: "hexil", heptyl: "heptil", octyl: "octil", nonyl: "nonil", decyl: "decil",
  };
  const groups = substituent.groups.map(group => {
    const name = group.nested ? renderAdvancedSubstituent(group.nested, language)
      : language === "es" ? translations[group.name] ?? group.name : group.name;
    return `${group.locant}-${name}`;
  }).join("-");
  const root = language === "es" ? rootEs[substituent.root] : substituent.root;
  const unsaturation = substituent.unsaturation
    ? `-${substituent.unsaturation.locant}-${substituent.unsaturation.order === 2 ? "en" : "yn"}` : "";
  const attachment = substituent.attachmentLocantExplicit ? `-${substituent.attachmentLocant}` : "";
  return `${groups}${root}${unsaturation}${attachment}${language === "es" ? "il" : "yl"}`;
}

function render(parsed: Parsed, language: "en" | "es") {
  const termTranslations: Record<string, string> = {
    methyl: "metil", ethyl: "etil", propyl: "propil", butyl: "butil", pentyl: "pentil", hexyl: "hexil", heptyl: "heptil", octyl: "octil", nonyl: "nonil", decyl: "decil",
    amino: "amino", hydroxy: "hidroxi", fluoro: "fluoro", chloro: "cloro", bromo: "bromo", iodo: "yodo", methoxy: "metoxi", ethoxy: "etoxi", propoxy: "propoxi",
  };
  const entries = parsed.prefixes.map(prefix => {
    const locants = prefix.locants.join(",");
    const simple = (prefix.term in termTranslations && !prefix.term.includes("yl")) || terms.includes(prefix.term);
    if (simple) {
      const stem = language === "en" ? prefix.term : termTranslations[prefix.term] ?? prefix.term;
      const multiplicative = language === "es" ? ({ di: "di", tri: "tri", tetra: "tetra", penta: "penta", hexa: "hexa" } as Record<string, string>)[prefix.multiplier] ?? prefix.multiplier : prefix.multiplier;
      return `${locants}-${multiplicative}${stem}`;
    }
    let token = prefix.advancedSubstituent ? renderAdvancedSubstituent(prefix.advancedSubstituent, language) : prefix.term;
    if (!prefix.advancedSubstituent && language === "es") {
      token = token.replace(/^(\d+-)?(amino|hydroxy|fluoro|chloro|bromo|iodo|methoxy|ethoxy)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)yl$/, (_m, internal: string | undefined, functional: string, root: string) => {
        const functionEs: Record<string, string> = { amino: "amino", hydroxy: "hidroxi", fluoro: "fluoro", chloro: "cloro", bromo: "bromo", iodo: "yodo", methoxy: "metoxi", ethoxy: "etoxi" };
        return `${internal ?? ""}${functionEs[functional]}${rootEs[root]}il`;
      });
    } else if (!prefix.advancedSubstituent) {
      token = token.replace(/^(\d+-)?(amino|hidroxi|fluoro|cloro|bromo|yodo|metoxi|etoxi)(met|et|prop|but|pent|hex|hept|oct|non|dec)il$/, (_m, internal: string | undefined, functional: string, root: string) => {
        const functionEn: Record<string, string> = { amino: "amino", hidroxi: "hydroxy", fluoro: "fluoro", cloro: "chloro", bromo: "bromo", yodo: "iodo", metoxi: "methoxy", etoxi: "ethoxy" };
        return `${internal ?? ""}${functionEn[functional]}${rootEn[root]}yl`;
      });
    }
    const opening = prefix.wrapper ?? "(";
    const closing = opening === "(" ? ")" : "]";
    return `${locants}-${prefix.multiplier}${opening}${token}${closing}`;
  });
  const parent = language === "en" ? parsed.parent : parsed.parent === "phenol" ? "fenol" : "benceno";
  return `${entries.join("-")}${parent}`;
}

export function buildCompositionalExternalGraph(parsed: Parsed): GeneratedMolecule | null {
  const atoms: GeneratedMolecule["atoms"] = [];
  const bonds: GeneratedMolecule["bonds"] = [];
  const addAtom = (element: "C" | "N" | "O" | "F" | "Cl" | "Br" | "I") => { const id = atoms.length + 1; atoms.push({ id, element, x: 0, y: 0 }); return id; };
  const addBond = (a: number, b: number, order: 1 | 2 | 3 = 1) => { bonds.push([a, b, order]); };
  const createRing = (anchor?: number) => {
    const ids = Array.from({ length: 6 }, () => addAtom("C"));
    ids.forEach((id, index) => addBond(id, ids[(index + 1) % 6]!, index % 2 ? 1 : 2));
    if (anchor) addBond(anchor, ids[0]!);
    return ids;
  };
  const attachAdvanced = (anchor: number, substituent: AdvancedSubstituent): boolean => {
    if (substituent.kind === "aryl") {
      const aryl = createRing(anchor);
      return substituent.ring.prefixes.every(prefix => prefix.locants.every(locant => attachPrefix(aryl[(locant - 1 + 6) % 6]!, prefix)));
    }
    const chain = Array.from({ length: substituent.carbonCount }, () => addAtom("C"));
    addBond(anchor, chain[substituent.attachmentLocant - 1]!, substituent.attachmentLocant === 1 ? 1 : 1);
    for (let index = 1; index < chain.length; index += 1) addBond(chain[index - 1]!, chain[index]!);
    if (substituent.unsaturation) {
      const left = chain[substituent.unsaturation.locant - 1], right = chain[substituent.unsaturation.locant];
      if (!left || !right) return false;
      const existing = bonds.findIndex(([a, b]) => a === left && b === right || a === right && b === left);
      if (existing < 0) return false;
      bonds[existing] = [left, right, substituent.unsaturation.order];
    }
    return substituent.groups.every(group => {
      const atom = chain[group.locant - 1];
      if (!atom) return false;
      if (group.nested) return attachAdvanced(atom, group.nested);
      const elements: Record<string, "N" | "O" | "F" | "Cl" | "Br" | "I"> = { amino: "N", hydroxy: "O", fluoro: "F", chloro: "Cl", bromo: "Br", iodo: "I" };
      if (elements[group.name]) { addBond(atom, addAtom(elements[group.name]!)); return true; }
      if (group.name.endsWith("oxy")) {
        const oxygen = addAtom("O"); addBond(atom, oxygen);
        const length = group.name === "methoxy" ? 1 : 2;
        let previous = oxygen;
        for (let index = 0; index < length; index += 1) { const carbon = addAtom("C"); addBond(previous, carbon); previous = carbon; }
        return true;
      }
      return false;
    });
  };
  const attachPrefix = (anchor: number, prefix: Prefix): boolean => {
    if (prefix.advancedSubstituent) return attachAdvanced(anchor, prefix.advancedSubstituent);
    const simpleElement: Record<string, "N" | "O" | "F" | "Cl" | "Br" | "I"> = { fluoro: "F", chloro: "Cl", bromo: "Br", iodo: "I", amino: "N", hydroxy: "O" };
    if (simpleElement[prefix.term]) { addBond(anchor, addAtom(simpleElement[prefix.term]!)); return true; }
    const simpleRoot = new RegExp(`^(${terms.join("|")})$`).exec(prefix.term);
    if (simpleRoot) {
      const count = roots.indexOf(simpleRoot[1]!.replace(/yl$/, "") as typeof roots[number]);
      if (count < 1) return false;
      let previous = anchor;
      for (let index = 0; index < count; index += 1) { const id = addAtom("C"); addBond(previous, id); previous = id; }
      return true;
    }
    const alkyl = prefix.substituent
      ? { count: prefix.substituent.carbonCount, functional: prefix.substituent.functional, internalLocant: prefix.substituent.internalLocant }
      : parseAlkyl(prefix.term, parsed.language);
    if (!alkyl || alkyl.count < 1) return false;
    const advanced = parseAdvancedSubstituent(prefix.term, parsed.language);
    if (advanced) return attachAdvanced(anchor, advanced);
    const chain = Array.from({ length: alkyl.count }, () => addAtom("C"));
    addBond(anchor, chain[0]!);
    for (let index = 1; index < chain.length; index += 1) addBond(chain[index - 1]!, chain[index]!);
    const innerPosition = alkyl.internalLocant - 1;
    if (alkyl.functional === "amino" || alkyl.functional === "hydroxy") {
      addBond(chain[innerPosition]!, addAtom(alkyl.functional === "amino" ? "N" : "O")); return true;
    }
    if (["fluoro", "chloro", "bromo", "iodo"].includes(alkyl.functional)) {
      const halogen = ({ fluoro: "F", chloro: "Cl", bromo: "Br", iodo: "I" } as const)[alkyl.functional as "fluoro" | "chloro" | "bromo" | "iodo"];
      addBond(chain[innerPosition]!, addAtom(halogen)); return true;
    }
    if (alkyl.functional.endsWith("oxy")) {
      const oxygen = addAtom("O"); addBond(chain[innerPosition]!, oxygen);
      const length = alkyl.functional === "methoxy" ? 1 : 2;
      let previous = oxygen;
      for (let index = 0; index < length; index += 1) { const carbon = addAtom("C"); addBond(previous, carbon); previous = carbon; }
      return true;
    }
    return false;
  };
  const ring = createRing();
  if (parsed.parent === "phenol") { const oxygen = addAtom("O"); addBond(ring[0]!, oxygen); }
  const seen = new Set<string>();
  for (const prefix of parsed.prefixes) for (const locant of prefix.locants) {
    const duplicate = `${locant}:${prefix.term}`;
    if (seen.has(duplicate)) return null;
    seen.add(duplicate);
    const anchor = ring[(locant - 1 + 6) % 6]!;
    if (!attachPrefix(anchor, prefix)) return null;
  }
  return { atoms, bonds };
}

function identity(molecule: GeneratedMolecule) {
  const result = moleculeToSmiles(molecule);
  return result.ok ? result.smiles : null;
}

// OpenChemLib's canonical IDCode normalizes equivalent Kekulé spellings of
// aromatic rings while retaining connectivity and stereo. Use it for external
// identity receipts; keep the serialized key for exact builder round-trips.
function structuralIdentity(molecule: GeneratedMolecule) {
  try {
    const { molecule: openChemLibMolecule } = buildOpenChemLibStereoGraph(molecule);
    openChemLibMolecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
    return CanonizerUtil.getIDCode(openChemLibMolecule, CanonizerUtil.NORMAL);
  } catch { return null; }
}

const chainStems = ["meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec"] as const;
const chainStemEs: Record<string, string> = { meth: "met", eth: "et", prop: "prop", but: "but", pent: "pent", hex: "hex", hept: "hept", oct: "oct", non: "non", dec: "dec" };
const simplePrefixEs: Record<string, string> = {
  methyl: "metil", ethyl: "etil", propyl: "propil", butyl: "butil", pentyl: "pentil", hexyl: "hexil",
  heptyl: "heptil", octyl: "octil", nonyl: "nonil", decyl: "decil", amino: "amino", hydroxy: "hidroxi",
  fluoro: "fluoro", chloro: "cloro", bromo: "bromo", iodo: "yodo", methoxy: "metoxi", ethoxy: "etoxi", propoxy: "propoxi",
  acetyloxy: "acetiloxi", phenyl: "fenil", nitro: "nitro", cyano: "ciano",
};

/**
 * A conservative acyclic/carbocyclic parent bridge for families already parsed
 * by the local name builder. Each component has an explicit morpheme mapping;
 * the translated result is independently reparsed by that builder and checked
 * against the active molecular graph. No free-form word replacement is used.
 */
function localizeBuilderSupportedChain(actual: GeneratedMolecule, name: string): string | null {
  const parentPattern = new RegExp(`(?<parent>cyclo)?(?<stem>${[...chainStems].reverse().join("|")})(?<ending>an-\\d+-ol|an-\\d+-one|an-al|anal|an-\\d+-al|-\\d+-ene|-\\d+-yne|ane|ene|yne)$`);
  const parent = parentPattern.exec(name);
  if (!parent?.groups || parent.index === undefined) return null;
  const prefixText = name.slice(0, parent.index).replace(/-$/, "");
  const translatedPrefixes: string[] = [];
  if (prefixText) {
    let remaining = prefixText;
    const termsByLength = Object.keys(simplePrefixEs).sort((left, right) => right.length - left.length);
    while (remaining) {
      const termPattern = termsByLength.join("|");
      const match = new RegExp(`^(?<locants>\\d+(?:,\\d+)*)-(?<multiplier>di|tri|tetra|penta|hexa)?(?<term>${termPattern})(?:-|$)`).exec(remaining);
      if (!match?.groups) return null;
      const term = simplePrefixEs[match.groups.term];
      const multiplier = match.groups.multiplier ?? "";
      if (!term) return null;
      const locants = match.groups.locants.split(",");
      const copies = multiplier ? ({ di: 2, tri: 3, tetra: 4, penta: 5, hexa: 6 } as Record<string, number>)[multiplier]! : 1;
      if (locants.length !== copies || locants.some(value => Number(value) < 1)) return null;
      translatedPrefixes.push(`${match.groups.locants}-${multiplier}${term}`);
      remaining = remaining.slice(match[0].length);
    }
  }
  const stem = chainStemEs[parent.groups.stem!];
  if (!stem) return null;
  const prefix = parent.groups.parent ? "ciclo" : "";
  const ending = parent.groups.ending!;
  let localizedEnding: string;
  if (ending === "ane") localizedEnding = "ano";
  else if (ending === "ene") localizedEnding = "eno";
  else if (ending === "yne") localizedEnding = "ino";
  else if (ending.endsWith("-ene")) localizedEnding = `${ending.slice(0, -4)}-eno`;
  else if (ending.endsWith("-yne")) localizedEnding = `${ending.slice(0, -4)}-ino`;
  else if (ending === "an-al" || ending === "anal") localizedEnding = "anal";
  else if (ending === "an-one" || ending.endsWith("-one")) localizedEnding = `${ending.slice(0, -3)}ona`;
  else if (ending.endsWith("-ol")) localizedEnding = ending;
  else if (ending.endsWith("-al")) localizedEnding = ending;
  else return null;
  // English and Spanish retain the same connecting -an- for suffix parents.
  const spanishParent = `${prefix}${stem}${localizedEnding}`;
  const localized = `${translatedPrefixes.join("-")}${spanishParent}`;
  const sourceBuild = buildHydrocarbonFromIupacName(name), spanishBuild = buildHydrocarbonFromIupacName(localized);
  const expected = identity(actual);
  if (!sourceBuild.ok || !spanishBuild.ok || !expected
    || identity(sourceBuild.molecule) !== expected || identity(spanishBuild.molecule) !== expected) return null;
  return localized;
}

const chainRootNames = [...new Set(IUPAC_ROOTS.slice(1).map(englishIupacRoot))]
  .sort((left, right) => right.length - left.length);
const spanishPrefixTerms: Record<string, string> = {
  amino: "amino", hydroxy: "hidroxi", oxo: "oxo", methyl: "metil", ethyl: "etil", propyl: "propil",
  butyl: "butil", pentyl: "pentil", hexyl: "hexil", heptyl: "heptil", octyl: "octil", nonyl: "nonil",
  decyl: "decil", fluoro: "fluoro", chloro: "cloro", bromo: "bromo", iodo: "yodo", methoxy: "metoxi",
  ethoxy: "etoxi", propoxy: "propoxi", cyano: "ciano", nitro: "nitro", phenyl: "fenil", methylidene: "metilideno",
  acetyloxy: "acetiloxi",
};
const spanishPrefixTermsByLength = Object.keys(spanishPrefixTerms).sort((left, right) => right.length - left.length);

function localizeFunctionalPrefixRun(source: string, maximumLocant?: number): string | null {
  let remaining = source;
  const localized: string[] = [];
  if (!/^\d/.test(remaining) && !/^N(?:,N)*-/.test(remaining)) {
    const simple = /^(?<multiplier>di|tri|tetra|penta|hexa)?(?<term>fluoro|chloro|bromo|iodo|nitro|amino|hydroxy|methoxy|ethoxy|propoxy|phenyl|methyl|ethyl|propyl|butyl|acetyloxy)$/.exec(remaining);
    if (simple?.groups) {
      const multiplier = simple.groups.multiplier ?? "";
      const translated = simplePrefixEs[simple.groups.term];
      return translated ? `${multiplier}${translated}` : null;
    }
  }
  while (remaining) {
    const unsaturatedRadical = /^(?<locants>\d+(?:,\d+)*-)(?<root>meth|eth|prop|but|pent|hex|hept|oct|non|dec)-(?<bondLocant>\d+)-(?<bond>en|yn)yl(?:-|$)/.exec(remaining);
    if (unsaturatedRadical?.groups) {
      const stem = chainStemEs[unsaturatedRadical.groups.root!] ?? unsaturatedRadical.groups.root!;
      const locants = unsaturatedRadical.groups.locants!.slice(0, -1);
      if (maximumLocant !== undefined && locants.split(",").some(value => Number(value) < 1 || Number(value) > maximumLocant)) return null;
      const component = `${stem}-${unsaturatedRadical.groups.bondLocant}-${unsaturatedRadical.groups.bond === "yn" ? "in" : "en"}il`;
      localized.push(`${locants}-(${component})`);
      remaining = remaining.slice(unsaturatedRadical[0].length);
      if (remaining.startsWith("-")) remaining = remaining.slice(1);
      continue;
    }
    const nested = /^(?<locants>\d+(?:,\d+)*)(?<separator>-)(?<opening>[([])/.exec(remaining);
    if (nested?.groups) {
      const parsed = readBalanced(remaining, nested.groups.locants!.length + 1);
      if (!parsed) return null;
      const locants = nested.groups.locants!.split(",");
      if (maximumLocant !== undefined && locants.some(value => Number(value) < 1 || Number(value) > maximumLocant)) return null;
      const component = localizeNestedExternalComponents(parsed.text);
      if (component === null) return null;
      localized.push(`${locants.join(",")}-${nested.groups.opening}${component}${parsed.closing}`);
      remaining = remaining.slice(parsed.end);
      if (remaining.startsWith("-")) remaining = remaining.slice(1);
      continue;
    }
    const termPattern = spanishPrefixTermsByLength.join("|");
    const match = new RegExp(`^(?<locants>N(?:,N)*|\\d+(?:,\\d+)*)-(?<multiplier>di|tri|tetra|penta|hexa)?(?<term>${termPattern})(?:-|$)`).exec(remaining);
    if (!match?.groups) return null;
    const locants = match.groups.locants;
    const multiplier = match.groups.multiplier ?? "";
    const term = match.groups.term;
    const copies = multiplier ? ({ di: 2, tri: 3, tetra: 4, penta: 5, hexa: 6 } as Record<string, number>)[multiplier]! : 1;
    const count = locants === "N" ? 1 : locants.startsWith("N,") ? locants.split(",").length : locants.split(",").length;
    if (count !== copies || locants.startsWith("N,") && !multiplier || locants === "N" && multiplier) return null;
    if (maximumLocant !== undefined && !locants.startsWith("N")
      && locants.split(",").some(value => Number(value) < 1 || Number(value) > maximumLocant)) return null;
    localized.push(`${locants}-${multiplier}${spanishPrefixTerms[term]}`);
    remaining = remaining.slice(match[0].length);
  }
  return localized.join("-");
}

// Localize nested external substituent components by complete, recognized
// morphemes. Parentheses and brackets are retained; unknown words reject.
function localizeNestedExternalComponents(source: string): string | null {
  const mappings: Array<[RegExp, string]> = [
    [/(meth|eth|prop|but|pent|hex|hept|oct|non|dec)an-(\d+)-yl/g, "$1an-$2-il"],
    [/piperidin-(\d+)-yl/g, "piperidin-$1-il"],
    [/pyrrolidin-(\d+)-yl/g, "pirrolidin-$1-il"],
    [/morpholin-(\d+)-yl/g, "morfolin-$1-il"],
    [/phenoxy/g, "fenoxi"], [/phenyl/g, "fenil"], [/nitro/g, "nitro"],
    [/tert-butylamino/g, "terc-butilamino"],
    [/acetyloxy/g, "acetiloxi"],
    [/trifluoromethyl/g, "trifluorometil"], [/methyl/g, "metil"], [/ethyl/g, "etil"],
    [/propyl/g, "propil"], [/butyl/g, "butil"], [/pentyl/g, "pentil"], [/hexyl/g, "hexil"],
    [/heptyl/g, "heptil"], [/octyl/g, "octil"], [/nonyl/g, "nonil"], [/decyl/g, "decil"],
    [/hydroxy/g, "hidroxi"], [/amino/g, "amino"], [/methoxy/g, "metoxi"], [/ethoxy/g, "etoxi"],
    [/chloro/g, "cloro"], [/fluoro/g, "fluoro"], [/bromo/g, "bromo"], [/iodo/g, "yodo"],
  ];
  let localized = source;
  for (const [pattern, replacement] of mappings) localized = localized.replace(pattern, replacement);
  // Remaining ASCII letters must belong to the finite heterocycle/root
  // vocabulary admitted here. This keeps the helper from becoming a
  // best-effort word replacer.
  const withoutStereo = localized.replace(/\(\d+[RS](?:,\d+[RS])*\)/g, "");
  const remainder = withoutStereo.replace(/piperidin|pirrolidin|morfolin|prop|met|et|but|pent|hex|hept|oct|non|dec|an|amino|hidroxi|metoxi|etoxi|cloro|fluoro|bromo|yodo|fenil|fenoxi|nitro|terc|di|tri|tetra|penta|hexa|il|N/gi, "");
  if (/[a-z]/i.test(remainder)) return null;
  return localized;
}

function topLevelLocantsExceed(source: string, maximum: number) {
  let depth = 0;
  let token = "";
  for (const char of source) {
    if (char === "(" || char === "[") { depth += 1; token += " "; continue; }
    if (char === ")" || char === "]") { depth = Math.max(0, depth - 1); token += " "; continue; }
    token += depth === 0 ? char : " ";
  }
  return [...token.matchAll(/(?:^|-)(\d+(?:,\d+)*)-/g)]
    .some(match => match[1]!.split(",").some(value => Number(value) < 1 || Number(value) > maximum));
}

function localizePrincipalParent(source: string, family: "acid" | "ester" | "amide" | "nitrile" | "amine" | "aniline" | "hydrocarbon" | "alcohol" | "aldehyde" | "ketone") {
  const aromatic: Record<string, string> = {
    acid: "benzoic acid", ester: "benzoate", amide: "benzamide", nitrile: "benzonitrile", aniline: "aniline", aldehyde: "benzaldehyde",
  };
  if (aromatic[family] && source.endsWith(aromatic[family]!)) {
    const prefixSource = source.slice(0, -aromatic[family]!.length).replace(/-$/, "");
    const prefix = localizeFunctionalPrefixRun(prefixSource, 6);
    if (prefix === null) return null;
    const base = ({ acid: "benzoico", ester: "benzoato", amide: "benzamida", nitrile: "benzonitrilo", aniline: "anilina", aldehyde: "benzaldehído" } as Record<string, string>)[family]!;
    return { prefix, parent: base };
  }

  // Retained acetic-acid family names are treated as complete parent
  // components (acetic acid / acetate / acetamide), not translated by
  // substring replacement. Prefixes remain compositional and locanted.
  const retained: Partial<Record<typeof family, [RegExp, string, string]>> = {
    acid: [/^(?<prefix>.*?)(?:acetic acid)$/, "acetic acid", "acético"],
    ester: [/^(?<prefix>.*?)(?:acetate)$/, "acetate", "acetato"],
    amide: [/^(?<prefix>.*?)(?:acetamide)$/, "acetamide", "acetamida"],
  };
  const retainedRule = retained[family];
  if (retainedRule) {
    const match = retainedRule[0].exec(source);
    if (match?.groups) {
      const prefix = localizeFunctionalPrefixRun(match.groups.prefix!.replace(/-$/, ""), 2);
      if (prefix !== null) return { prefix, parent: retainedRule[2] };
    }
  }

  for (const root of chainRootNames) {
    const tails: Record<typeof family, Array<[RegExp, string]>> = {
      acid: [
        [/^anedioic acid$/, "anodioico"], [/^-(\d+)-ynoic acid$/, "-$1-inoico"],
        [/^-(\d+)-enoic acid$/, "-$1-enoico"], [/^anoic acid$/, "anoico"], [/^enoic acid$/, "enoico"], [/^ynoic acid$/, "inoico"],
        [/^a-(\d+(?:,\d+)+)-trienoic acid$/, "a-$1-trienoico"],
        [/^ane-(\d+(?:,\d+)+)-tricarboxylic acid$/, "ano-$1-tricarboxílico"],
      ],
      ester: [
        [/^-(\d+)-ynoate$/, "-$1-inoato"], [/^-(\d+)-enoate$/, "-$1-enoato"],
        [/^anoate$/, "anoato"], [/^enoate$/, "enoato"], [/^ynoate$/, "inoato"],
      ],
      amide: [
        [/^anediamide$/, "anodiamida"], [/^anamide$/, "anamida"], [/^enamide$/, "enamida"], [/^ynamide$/, "inamida"],
      ],
      nitrile: [
        [/^anedinitrile$/, "anodinitrilo"], [/^anenitrile$/, "anenitrilo"],
        [/^-(\d+)-enenitrile$/, "-$1-enenitrilo"],
        [/^enenitrile$/, "enenitrilo"], [/^ynenitrile$/, "inenitrilo"],
      ],
      amine: [
        [/^ane-([0-9]+(?:,[0-9]+)*)-diamine$/, "ano-$1-diamina"],
        [/^an-(\d+)-amine$/, "an-$1-amina"], [/^anamine$/, "anamina"],
      ],
      aniline: [],
      hydrocarbon: [
        [/^a-([0-9]+(?:,[0-9]+)*)-diene$/, "a-$1-dieno"], [/^a-([0-9]+(?:,[0-9]+)*)-triene$/, "a-$1-trieno"],
        [/^-([0-9]+)-ene$/, "-$1-eno"], [/^-([0-9]+)-yne$/, "-$1-ino"],
        [/^ane$/, "ano"], [/^ene$/, "eno"], [/^yne$/, "ino"],
      ],
      alcohol: [[/^-(\d+)-en-(\d+)-ol$/, "-$1-en-$2-ol"], [/^-(\d+)-yn-(\d+)-ol$/, "-$1-in-$2-ol"],
        [/^an-(\d+)-ol$/, "an-$1-ol"], [/^anol$/, "anol"],
        [/^ane-(\d+(?:,\d+)+)-diol$/, "ano-$1-diol"], [/^ane-(\d+(?:,\d+)+)-triol$/, "ano-$1-triol"]],
      aldehyde: [[/^anal$/, "anal"], [/^-(\d+)-enal$/, "-$1-enal"]],
      ketone: [
        [/^-([0-9]+)-en-([0-9]+)-one$/, "-$1-en-$2-ona"],
        [/^an-([0-9]+)-one$/, "an-$1-ona"], [/^anone$/, "anona"],
      ],
    };
    for (const [pattern, spanishTail] of tails[family]) {
      const parentMatch = new RegExp(`^(?<prefix>.*?)(?<root>${root})(?<tail>${pattern.source.slice(1, -1)})$`).exec(source);
      if (!parentMatch?.groups) continue;
      let rawPrefix = parentMatch.groups.prefix!.replace(/-$/, "");
      let cyclic = false;
      if ((family === "hydrocarbon" || family === "alcohol" || family === "ketone") && rawPrefix.endsWith("cyclo")) {
        cyclic = true;
        rawPrefix = rawPrefix.slice(0, -5);
      }
      const rootIndex = IUPAC_ROOTS.findIndex(spanishRoot => englishIupacRoot(spanishRoot) === root);
      const carbonCount = rootIndex < 0 ? undefined : rootIndex;
      const prefix = localizeFunctionalPrefixRun(rawPrefix, carbonCount);
      if (prefix === null) return null;
      const tail = pattern.exec(parentMatch.groups.tail!);
      if (!tail) continue;
      const unsaturatedParent = /(?:-\d+-(?:en|yn)|(?:en|yn)(?:oic acid|oate|amide|nitrile)|a-\d+(?:,\d+)*-trien)/.test(parentMatch.groups.tail!);
      const tailLocants = tail.slice(1).filter(Boolean).flatMap(value => value.split(",").map(Number));
      if (carbonCount !== undefined && tailLocants.some(value => value < 1 || value > carbonCount || unsaturatedParent && value >= carbonCount)) return null;
      const translatedTail = parentMatch.groups.tail!.replace(pattern, spanishTail);
      const localizedRoot = chainStemEs[root] ?? root;
      return { prefix, parent: `${cyclic ? "ciclo" : ""}${localizedRoot}${translatedTail}` };
    }
  }
  return null;
}

function localizeAromaticDiol(source: string): { prefix: string; parent: string } | null {
  const match = /^(?<prefix>.*?)(?<parent>benzene-(?<locants>[1-6](?:,[1-6])*)-diol)$/.exec(source);
  if (!match?.groups) return null;
  const locants = match.groups.locants!.split(",").map(Number);
  if (locants.length < 2 || new Set(locants).size !== locants.length) return null;
  const rawPrefix = match.groups.prefix!.replace(/-$/, "");
  const prefix = localizeFunctionalPrefixRun(rawPrefix, 6);
  if (prefix === null) return null;
  return { prefix, parent: `benceno-${match.groups.locants}-diol` };
}

function canonicalizeExternalEnglishAlias(source: string) {
  const retainedParents: Record<string, string> = {
    toluene: "methylbenzene", anisole: "methoxybenzene", acetylene: "ethyne",
    formaldehyde: "methanal", acetaldehyde: "ethanal", chloroform: "trichloromethane",
    acetonitrile: "ethanenitrile",
  };
  return (retainedParents[source] ?? source)
    .replace(/^(chloro|bromo|fluoro|iodo|nitro|methoxy)-(?=benzene|phenol)/, "$1")
    .replace(/(\d+)-\((meth|eth|prop|but|pent|hex|hept|oct|non|dec)-(\d+)-(en|yn)yl\)/g, "$1-$2-$3-$4yl");
}

/**
 * PubChem's matching isomeric SMILES confirms the molecule identity, not the
 * meaning of a translated name. Meaning is carried by these bounded parent,
 * suffix, prefix, locant and N-substitution rules; the Spanish result must
 * normalize back to the exact source name. Neither check establishes PIN
 * preference, which this display-only localizer does not claim.
 */
function localizeFunctionalParentExternalName(actual: GeneratedMolecule, sourceName: string, verifiedExternalSmiles?: string): string | null {
  const stereoMatch = /^(?<stereo>\((?:\d+[RSEZ]|[EZ])(?:,\d+[RSEZ])*\)-)?(?<name>.*)$/.exec(sourceName);
  if (!stereoMatch?.groups) return null;
  const stereo = stereoMatch.groups.stereo ?? "";
  let name = stereoMatch.groups.name!;
  name = canonicalizeExternalEnglishAlias(name);
  let localized: string | null = null;
  let family: "acid" | "ester" | "amide" | "nitrile" | "amine" | "aniline" | "hydrocarbon" | "alcohol" | "aldehyde" | "ketone" | null = null;

  if (sourceName === "acetonitrile") {
    family = "nitrile";
    localized = "acetonitrilo";
  }

  if (localized) {
    // Retained name alias with a standard Spanish equivalent.
  } else if (name.endsWith(" acid")) {
    family = "acid";
    const parts = localizePrincipalParent(name, family);
    if (parts) localized = `ácido ${stereo}${parts.prefix ? `${parts.prefix}${parts.parent}` : parts.parent}`;
  } else if (name.includes(" ")) {
    family = "ester";
    const split = /^(.+?) (.+)$/.exec(name);
    const alkylEs: Record<string, string> = { methyl: "metilo", ethyl: "etilo", propyl: "propilo", butyl: "butilo", pentyl: "pentilo", hexyl: "hexilo" };
    let organyl = split ? alkylEs[split[1]!] : undefined;
    if (split && !organyl) {
      const radical = /^(?<root>meth|eth|prop|but|pent|hex|hept|oct|non|dec)an-(?<locant>\d+)-yl$/.exec(split[1]!);
      if (radical?.groups) organyl = `${radical.groups.root}an-${radical.groups.locant}-ilo`;
      const branched = parseAdvancedSubstituent(split[1]!, "en");
      if (!organyl && branched?.kind === "alkyl") organyl = `${renderAdvancedSubstituent(branched, "es")}o`;
    }
    const parts = split ? localizePrincipalParent(split[2]!, family) : null;
    if (parts && organyl) localized = `${parts.prefix ? `${parts.prefix}${parts.parent}` : parts.parent} de ${organyl}`;
  } else {
    const aromatic = /^(?<prefix>.*?)(?<parent>benzene|phenol)$/.exec(name);
    if (aromatic?.groups && aromatic.groups.prefix) {
      const prefix = localizeFunctionalPrefixRun(aromatic.groups.prefix.replace(/-$/, ""), 6);
      if (prefix) {
        family = "hydrocarbon";
        localized = `${prefix}${aromatic.groups.parent === "benzene" ? "benceno" : "fenol"}`;
      }
    }
    const ether = /^(?<alkoxy>methoxy|ethoxy|propoxy)(?<root>meth|eth|prop|but|pent|hex|hept|oct|non|dec)ane$/.exec(name);
    if (!localized && ether?.groups) {
      const prefix = simplePrefixEs[ether.groups.alkoxy!]!;
      const root = chainStemEs[ether.groups.root!]!;
      family = "hydrocarbon";
      localized = `${prefix}${root}ano`;
    }
    const heterocycleParents: Record<string, string> = {
      pyridine: "piridina", piperidine: "piperidina", pyrrolidine: "pirrolidina", morpholine: "morfolina", oxolane: "oxolano",
    };
    if (heterocycleParents[name]) {
      family = "hydrocarbon";
      localized = `${stereo}${heterocycleParents[name]}`;
    }
    const diol = localizeAromaticDiol(name);
    if (!localized && diol) {
      family = "hydrocarbon";
      localized = `${stereo}${diol.prefix ? `${diol.prefix}${diol.parent}` : diol.parent}`;
    }
    // N-substituted amides can contain recursively bracketed radicals and
    // heterocyclic stems. Translate only recognized complete components.
    if (!localized && /amide$/.test(name)) {
      const retainedAmide = /^(?<prefix>.*?)(?<parent>acetamide)$/.exec(name);
      if (retainedAmide?.groups) {
        const prefix = localizeNestedExternalComponents(retainedAmide.groups.prefix!.replace(/-$/, ""));
        if (prefix !== null) {
          localized = `${stereo}${prefix}acetamida`;
          family = "amide";
        }
      }
      const amide = /^(?<prefix>.*?)(?<root>meth|eth|prop|but|pent|hex|hept|oct|non|dec)an(?<suffix>amide)$/.exec(name);
      if (!localized && amide?.groups) {
        const rawPrefix = amide.groups.prefix!.replace(/-$/, "");
        const rootIndex = IUPAC_ROOTS.findIndex(value => englishIupacRoot(value) === amide.groups!.root);
        const prefix = rootIndex < 0 || topLevelLocantsExceed(rawPrefix, rootIndex)
          ? null : localizeNestedExternalComponents(rawPrefix);
        if (prefix !== null) {
          const stem = ({ meth: "met", eth: "et", prop: "prop", but: "but", pent: "pent", hex: "hex", hept: "hept", oct: "oct", non: "non", dec: "dec" } as Record<string, string>)[amide.groups.root!]!;
          localized = `${stereo}${prefix}${stem}anamida`;
          family = "amide";
        }
      }
    }
    const familyCandidates: Array<["amide" | "nitrile" | "aniline" | "amine" | "alcohol" | "aldehyde" | "ketone" | "hydrocarbon", RegExp]> = [
      ["amide", /(?:amide|benzamide)$/], ["nitrile", /(?:nitrile|benzonitrile)$/],
      ["aniline", /aniline$/], ["amine", /amine$/], ["alcohol", /(?:an-\d+-ol|an-ol|ane-\d+(?:,\d+)+-(?:diol|triol)|-\d+-en-\d+-ol|-\d+-yn-\d+-ol|anol)$/],
      ["aldehyde", /(?:anal|benzaldehyde|-\d+-enal)$/], ["ketone", /(?:anone|an-\d+-one|-en-\d+-one)$/],
      ["hydrocarbon", /(?:ane|ene|yne)$/],
    ];
    const found = familyCandidates.find(([, pattern]) => pattern.test(name));
    if (!localized && found) {
      family = found[0];
      const parts = localizePrincipalParent(name, family);
      if (parts) localized = `${stereo}${parts.prefix ? `${parts.prefix}${parts.parent}` : parts.parent}`;
    }
  }
  if (!family || !localized || canonicalizeExternalEnglishAlias(translateSpanishIupacToOpsin(localized))
    !== canonicalizeExternalEnglishAlias(sourceName)) return null;

  // Stereo descriptors can sit inside a complex substituent (for example
  // [(1R)-...] or [(1R,2R)-...]); count and preserve them across the full
  // source name rather than only a leading parent descriptor.
  const tetraDescriptors = [...sourceName.matchAll(/\d+([RS])/g)].map(match => match[1]);
  const doubleDescriptors = [...sourceName.matchAll(/\d+([EZ])/g)].map(match => match[1]);
  const singleDoubleDescriptor = /^\(([EZ])\)-/.exec(sourceName);
  if (singleDoubleDescriptor) doubleDescriptors.push(singleDoubleDescriptor[1]);
  const tetraCenters = getTetrahedralStereoCenters(actual);
  const doubleCenters = actual.bonds.filter(([left, right, order = 1, stereoFlag]) => order === 2 && stereoFlag === true
    && inspectDoubleBondStereochemistry(actual, left, right).stereogenic
    && inspectDoubleBondStereochemistry(actual, left, right).configuration);
  if (tetraDescriptors.length !== tetraCenters.length || doubleDescriptors.length !== doubleCenters.length) return null;
  if (tetraDescriptors.length && tetraDescriptors.sort().join("") !== tetraCenters.map(center => center.configuration).sort().join("")) return null;
  if (doubleDescriptors.length && doubleDescriptors.sort().join("") !== doubleCenters.map(([left, right]) => inspectDoubleBondStereochemistry(actual, left, right).configuration).sort().join("")) return null;

  const spanishGraph = buildHydrocarbonFromIupacName(localized);
  const expected = identity(actual);
  if (family === "acid" && spanishGraph.ok && expected && identity(spanishGraph.molecule) === expected) return localized;
  // Other families are currently outside the local constructor. This route is
  // permitted only when the external provider supplied the name with the same
  // verified isomeric SMILES as the active canvas graph; the exact inverse
  // grammar above preserves parent, locants, N-attachment and stereo labels.
  const externalGraph = verifiedExternalSmiles ? moleculeFromSmiles(verifiedExternalSmiles) : null;
  const externallyVerified = Boolean(expected && externalGraph?.ok
    && structuralIdentity(externalGraph.molecule) === structuralIdentity(actual));
  return externallyVerified ? localized : null;
}

/** Translate only complete constructions covered by this grammar and prove
 * both bilingual parses against the active graph before returning Spanish. */
export function localizeCompositionalExternalName(
  actual: GeneratedMolecule,
  englishName: string,
  options: { verifiedExternalSmiles?: string } = {},
): string | null {
  const source = parseName(englishName, "en");
  if (!source) return localizeBuilderSupportedChain(actual, englishName)
    ?? localizeFunctionalParentExternalName(actual, englishName, options.verifiedExternalSmiles);
  const spanishName = render(source, "es");
  const spanish = parseName(spanishName, "es");
  if (!spanish) return null;
  const sourceGraph = buildCompositionalExternalGraph(source), spanishGraph = buildCompositionalExternalGraph(spanish);
  const expectedIdentity = identity(actual);
  if (sourceGraph && spanishGraph && expectedIdentity && identity(sourceGraph) === expectedIdentity
    && identity(spanishGraph) === expectedIdentity) return spanishName;
  return localizeBuilderSupportedChain(actual, englishName)
    ?? localizeFunctionalParentExternalName(actual, englishName, options.verifiedExternalSmiles);
}

/** Exposed for corpus accounting and parser tests; unsupported means no claim. */
export function parseCompositionalExternalName(name: string, language: "en" | "es" = "en") {
  return parseName(name, language);
}
