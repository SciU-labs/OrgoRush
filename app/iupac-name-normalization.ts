import { translateSubstituentAliasesForOpsin } from "./substituent-aliases.ts";
import { englishIupacRoot, IUPAC_ROOTS } from "./iupac-prefixes.ts";
import { canonicalizeEnglishAcyclicPrefixes } from "./english-acyclic-prefixes.ts";

const alkylRootPattern = IUPAC_ROOTS
  .filter(Boolean)
  .sort((left, right) => right.length - left.length)
  .join("|");
const alkoxyMultipliers = "di|tri|tetra|penta|hexa|hepta|octa|nona|deca";
const spanishAlkoxyPrefix = new RegExp(
  `(^|[-,(])((?:${alkoxyMultipliers})?)(${alkylRootPattern})oxi(?=[a-z-]|$)`,
  "g",
);
// A locanted alkyl branch can be written directly before the alkoxy root in a
// complex substituent (for example, 1-metiletoxi). Translate this complete
// chemical construction before the generic alkyl pass splits its morphemes.
const spanishLocantedBranchedAlkoxy = new RegExp(
  `(^|[-,(])(\\d+(?:,\\d+)*-)(${alkylRootPattern})il(${alkylRootPattern})oxi(?=[a-z),.-]|$)`,
  "g",
);
const spanishAlkylNoun = new RegExp(`(${alkylRootPattern})ilo(?=$|[\\s,.)-])`, "g");
const spanishAlkylSubstituent = new RegExp(`(${alkylRootPattern})il(?=[a-z]|$|[\\s,.)-])`, "g");
const spanishUnsaturatedSubstituent = new RegExp(`(${alkylRootPattern})(en|in)il`, "g");
const unsaturationMultipliers = "di|tri|tetra|penta|hexa|hepta|octa|nona|deca";
const spanishNumberedUnsaturatedSubstituent = new RegExp(
  `(${alkylRootPattern})(a?)-(\\d+(?:,\\d+)*-)(?:(${unsaturationMultipliers}))?(en|in)-(\\d+)-il(?=$|[\\s,.)-])`,
  "g",
);
const spanishParentRoot = new RegExp(`(${IUPAC_ROOTS.filter((root) =>
  englishIupacRoot(root) !== root).join("|")})(?=(?:an|en|in)(?:[oa]|$|[-\\d]))`, "g");

function translateSpanishAlkylMorphemes(value: string) {
  const translate = (_match: string, root: string) => `${englishIupacRoot(root)}yl`;
  return value
    // Translate the complete divalent prefix before the monovalent alkyl pass.
    .replace(/(^|[-,(])(\d+(?:,\d+)*-)?metilideno(?=[a-z]|$|[-,)])/g, "$1$2methylidene")
    .replace(spanishNumberedUnsaturatedSubstituent, (_match, root: string, rootVowel: string, bondLocants: string,
      multiplier: string = "", unsaturation: string, freeValenceLocant: string) =>
      `${englishIupacRoot(root)}${rootVowel}-${bondLocants}${multiplier}${unsaturation === "en" ? "en" : "yn"}-${freeValenceLocant}-yl`)
    .replace(spanishUnsaturatedSubstituent, (_match, root: string, unsaturation: string) =>
      `${englishIupacRoot(root)}${unsaturation === "en" ? "enyl" : "ynyl"}`)
    .replace(spanishAlkylNoun, translate)
    .replace(spanishAlkylSubstituent, translate);
}

const commonSpanishNames: Record<string, string> = {
  acetaldehido: "ethanal",
  acetileno: "ethyne",
  acetona: "propan-2-one",
  "acido acetico": "acetic acid",
  "acido benzoico": "benzoic acid",
  "acido formico": "formic acid",
  "acido propionico": "propionic acid",
  anilina: "aniline",
  bencenamina: "benzenamine",
  benzonitrilo: "benzonitrile",
  benzamida: "benzamide",
  benceno: "benzene",
  bifenilo: "biphenyl",
  formaldehido: "methanal",
  fenol: "phenol",
  etileno: "ethene",
  propileno: "propene",
  butileno: "butene",
  metilacetileno: "propyne",
  "dimetil eter": "methoxymethane",
  "etil metil eter": "methoxyethane",
  "dietil eter": "ethoxyethane",
  propionaldehido: "propanal",
  "etil metil cetona": "butan-2-one",
  estireno: "styrene",
  naftaleno: "naphthalene",
  tetrahidropiran: "tetrahydropyran",
  tetrahidropirano: "tetrahydropyran",
  tolueno: "toluene",
  "o-xileno": "o-xylene",
  "m-xileno": "m-xylene",
  "p-xileno": "p-xylene",
  decalina: "decalin",
};

/** Spanish heterocycle parent names accepted by the laboratory interface. */
const heterocycleTranslations: Record<string, string> = {
  // Aromatic and unsaturated heterocycles.
  pirrol: "pyrrole",
  furan: "furan",
  furano: "furan",
  tiofeno: "thiophene",
  piridina: "pyridine",

  // Frequently used substituted pyridines.
  "2-metilpiridina": "2-methylpyridine",
  "3-metilpiridina": "3-methylpyridine",
  "4-metilpiridina": "4-methylpyridine",
  "2-cloropiridina": "2-chloropyridine",
  "3-cloropiridina": "3-chloropyridine",
  "4-cloropiridina": "4-chloropyridine",

  // Saturated heterocycles.
  pirrolidina: "pyrrolidine",
  piperidina: "piperidine",
  tetrahidrofurano: "tetrahydrofuran",
  tetrahidropirano: "tetrahydropyran",
  oxirano: "oxirane",
  aziridina: "aziridine",
  oxetano: "oxetane",
  azetidina: "azetidine",

  // Oxygen-containing rings.
  "1,3-dioxolano": "1,3-dioxolane",
  "1,4-dioxano": "1,4-dioxane",
  morfolina: "morpholine",
};

/**
 * Translates Spanish heterocycle fragments before sending a name to OPSIN.
 * Longer entries are intentionally replaced first so, for example,
 * "pirrolidina" cannot be partly translated as "pirrol".
 */
export function translateHeterocycles(name: string): string {
  let translated = name;
  const sortedKeys = Object.keys(heterocycleTranslations)
    .sort((left, right) => right.length - left.length);

  for (const key of sortedKeys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    translated = translated.replace(
      new RegExp(escapedKey, "gi"),
      heterocycleTranslations[key],
    );
  }

  return translated;
}

declare global {
  interface Window {
    translateHeterocycles: typeof translateHeterocycles;
  }
}

// Keep the translator available to the simulator and to browser-console users.
if (typeof window !== "undefined") {
  window.translateHeterocycles = translateHeterocycles;
}

const halogenMultipliers = "di|tri|tetra|penta|hexa|hepta|octa";
const halogenPrefixes = "fluoro|cloro|chloro|bromo|yodo|iodo";
const methaneParents = "metano|methane";
const halogenParents = [
  "metano", "etano", "propano", "butano", "pentano", "hexano", "heptano", "octano", "nonano", "decano",
  "benceno",
  "methane", "ethane", "propane", "butane", "pentane", "hexane", "heptane", "octane", "nonane", "decane",
  "benzene",
].join("|");

const gluedHalogenName = new RegExp(
  `(^|[\\s,(\\-])((?:${halogenMultipliers})?)(${halogenPrefixes})(${halogenParents})(?=$|[\\s,.)\\-])`,
  "gi",
);

const hyphenatedHalogenName = new RegExp(
  `(^|[\\s,(\\-])((?:${halogenMultipliers})-)?(${halogenPrefixes})-(${halogenParents})(?=$|[\\s,.)\\-])`,
  "gi",
);

const methaneHalogenLocant = new RegExp(
  `(^|[\\s,(])1(?:,1){0,3}-(?=(?:(?:${halogenMultipliers})-?)?(?:${halogenPrefixes})-?(?:${methaneParents})(?=$|[\\s,.)\\-]))`,
  "gi",
);

const multipliedMethaneHalogenName = new RegExp(
  `(^|[\\s,(\\-])((?:${halogenMultipliers})-?)(${halogenPrefixes})-?(${methaneParents})(?=$|[\\s,.)\\-])`,
  "gi",
);

function followsNumericLocant(value: string, matchOffset: number, boundary: string) {
  return boundary === "-"
    && /(?:^|[,(])\d+(?:,\d+)*-$/.test(value.slice(0, matchOffset + boundary.length));
}

/** A one-carbon parent never needs the repeated C1 locants for halogens. */
export function stripMethaneHalogenLocants(value: string) {
  return value.replace(methaneHalogenLocant, "$1");
}

function compactMultipliedMethaneHalogens(value: string) {
  return value.replace(
    multipliedMethaneHalogenName,
    (_match, boundary: string, multiplier: string, halogen: string, parent: string) =>
      `${boundary}${multiplier.replace(/-$/, "")}${halogen}${parent}`,
  );
}

/** Adds presentation hyphens to a directly attached halogen substituent. */
export function hyphenateHalogenatedName(value: string) {
  const withoutMethaneLocants = stripMethaneHalogenLocants(value);
  const locantAware = withoutMethaneLocants.replace(
    hyphenatedHalogenName,
    (match, boundary: string, multiplier: string = "", halogen: string, parent: string, offset: number, whole: string) =>
      followsNumericLocant(whole, offset, boundary)
        ? `${boundary}${multiplier.replace(/-$/, "")}${halogen}${parent}`
        : match,
  );
  const hyphenated = locantAware.replace(
    gluedHalogenName,
    (_match, boundary: string, multiplier: string = "", halogen: string, parent: string, offset: number, whole: string) =>
      followsNumericLocant(whole, offset, boundary)
        ? `${boundary}${multiplier}${halogen}${parent}`
        : `${boundary}${multiplier ? `${multiplier}-` : ""}${halogen}-${parent}`,
  );
  return compactMultipliedMethaneHalogens(hyphenated);
}

/** Restores the traditional, unhyphenated rendering of halogen derivatives. */
export function compactHalogenatedName(value: string) {
  const withoutMethaneLocants = stripMethaneHalogenLocants(value);
  const compacted = withoutMethaneLocants.replace(
    hyphenatedHalogenName,
    (_match, boundary: string, multiplier: string = "", halogen: string, parent: string) =>
      `${boundary}${multiplier.replace(/-$/, "")}${halogen}${parent}`,
  );
  return compactMultipliedMethaneHalogens(compacted);
}

function normalizePunctuation(value: string) {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .toLocaleLowerCase("es");

  const withStereochemicalLocants = normalized.replace(/\(([^()]*)\)/g, (_match, content: string) => {
    const stereochemical = content.replace(
      /(^|,)(\d*)([ersz])(?=,|$)/g,
      (_descriptor, separator: string, locant: string, letter: string) =>
        `${separator}${locant}${letter.toUpperCase()}`,
    );
    return `(${stereochemical})`;
  });

  // N- y N,N- son localizadores de heteroátomo, no la letra inicial de una
  // palabra. OPSIN los distingue de la n minúscula, por lo que se restauran
  // después de normalizar el resto del nombre.
  return withStereochemicalLocants.replace(/(^|[-,(])n(?=[,-])/g, "$1N");
}

/**
 * Accepts the classroom placement of a single multiple-bond locant and
 * returns the preferred parent-first notation before either parser sees it.
 * This only rearranges presentation; it does not infer a structure.
 */
export function normalizeTraditionalUnsaturationNotation(value: string) {
  // Benzene is a retained aromatic parent name. Its terminal "eno" is not an
  // alkene suffix and must never cause a preceding substituent locant to be
  // rearranged as a multiple-bond locant.
  if (/(?:benceno|naftaleno|antraceno|fenantreno|indeno|fluoreno|azuleno|pireno|fluoranteno|bifenileno|trifenileno)$/i.test(value)) return value;
  // Retained heterocycle names are translated as complete parent units below;
  // their terminal "eno" is likewise not an acyclic alkene suffix.
  if (translateHeterocycles(value) !== value) return value;

  const substituentPrefix = "(?:(?:\\d+(?:,\\d+)*-(?:fluoro|cloro|bromo|yodo|metil|etil|hidroxi|amino)-)+)";
  const prefixed = value.match(
    new RegExp(`^(${substituentPrefix})(\\d+)-((?:ciclo)?[a-z]+)-?(eno|ino)$`, "i"),
  );
  if (prefixed) {
    const [, prefix, locant, parent, suffix] = prefixed;
    return `${prefix.slice(0, -1)}${parent}-${locant}-${suffix}`;
  }

  const simple = value.match(/^(\d+)-((?:ciclo)?[a-z]+)-?(eno|ino)$/i);
  if (simple) {
    const [, locant, parent, suffix] = simple;
    return `${parent}-${locant}-${suffix}`;
  }
  return value;
}

/**
 * Normalizes a user-entered halogen name before it is passed to OPSIN.
 * Existing hyphens are left alone; only glued prefix/parent pairs are split.
 */
export function normalizeHalogenatedNameForOpsin(value: string) {
  return hyphenateHalogenatedName(
    normalizeTraditionalUnsaturationNotation(normalizePunctuation(value)),
  );
}

function translateCore(value: string) {
  const aliasesAndAcylGroups = translateSubstituentAliasesForOpsin(value)
    // Translate these complete lexical units before the systematic alkyl-root
    // pass so the embedded "etil" in "acetil" is never treated as ethyl.
    .replace(/(^|[-(])acetil(?=[a-z-]|$)/g, "$1acetyl")
    .replace(/(^|[-(])propionil(?=[a-z-]|$)/g, "$1propionyl")
    .replace(/(^|[-(])butiril(?=[a-z-]|$)/g, "$1butyryl");
  const bridgedAlkoxy = aliasesAndAcylGroups.replace(
    spanishLocantedBranchedAlkoxy,
    (_match, boundary: string, locants: string, branchRoot: string, alkoxyRoot: string) => {
      const alkoxyCarbonCount = IUPAC_ROOTS.indexOf(alkoxyRoot);
      const connector = alkoxyCarbonCount >= 5 ? "yloxy" : "oxy";
      return `${boundary}${locants}${englishIupacRoot(branchRoot)}yl${englishIupacRoot(alkoxyRoot)}${connector}`;
    },
  );
  let translated = translateSpanishAlkylMorphemes(bridgedAlkoxy)
    // Retained and systematic nitrogen parent names need to be translated
    // before the generic suffix rules. This also covers substituted parents
    // such as 4-nitroanilina and N-metilanilina.
    .replace(/anilina/g, "aniline")
    .replace(/bencenamina/g, "benzenamine")
    .replace(/benzonitrilo/g, "benzonitrile")
    .replace(/benzamida/g, "benzamide")
    // Alkoxy prefixes are a chemical morpheme, not an arbitrary substring.
    // The Spanish root set is shared with parent/alkyl translation; from C5
    // onward the English connector is yloxy (pentyloxy, hexyloxy, ...).
    .replace(spanishAlkoxyPrefix, (_match, boundary: string, multiplier: string, root: string) => {
      const carbonCount = IUPAC_ROOTS.indexOf(root);
      const englishRoot = englishIupacRoot(root);
      return `${boundary}${multiplier}${englishRoot}${carbonCount >= 5 ? "yloxy" : "oxy"}`;
    })
    // Vinyl is admitted as a Spanish substituent name; the current English
    // display uses its systematic ethenyl form. Keep translation at the
    // lexical substituent boundary so unrelated words are not rewritten.
    .replace(/(^|[-,(])vinil(?=[a-z]|$)/g, "$1ethenyl")
    .replace(/carbonil/g, "carbonyl")
    .replace(/hidroxi/g, "hydroxy")
    .replace(/amino/g, "__amino_prefix__")
    .replace(/carbamoil/g, "carbamoyl")
    .replace(/ciano/g, "cyano")
    .replace(/benceno/g, "benzene")
    .replace(/fenol/g, "phenol")
    .replace(/fenoxi/g, "phenoxy")
    .replace(/fenil/g, "phenyl")
    .replace(/cloro/g, "chloro")
    .replace(/yodo/g, "iodo")
    .replace(
      /ciclo(prop|but|pent|hex|hept|oct|non|dec)il/g,
      (_match, root: string) => `cyclo${root}yl`,
    )
    .replace(/naftaleno/g, "naphthalene")
    .replace(/antraceno/g, "anthracene")
    .replace(/fenantreno/g, "phenanthrene")
    .replace(/indeno/g, "indene")
    .replace(/fluoreno/g, "fluorene")
    .replace(/azuleno/g, "azulene")
    .replace(/pireno/g, "pyrene")
    .replace(/fluoranteno/g, "fluoranthene")
    .replace(/bifenileno/g, "biphenylene")
    .replace(/trifenileno/g, "triphenylene")
    .replace(/naftol/g, "naphthol")
    .replace(/dihidro(?=naphthalene)/g, "dihydro")
    .replace(/naftalen(?=-|$)/g, "naphthalen")
    .replace(/espiro(?=\[)/g, "spiro")
    .replace(/triciclo(?=\[)/g, "tricyclo")
    .replace(/biciclo(?=\[)/g, "bicyclo")
    .replace(/ciclo/g, "cyclo")
    .replace(/tetrahidro/g, "tetrahydro")
    .replace(/pirano/g, "pyran")
    // A chemical parent root can follow a glued substituent, without a word
    // boundary. Translate the root itself, independently of prefix identity,
    // at a Spanish suffix boundary; English lexical units (e.g. oxetane)
    // already translated above must not be interpreted as Spanish roots.
    .replace(spanishParentRoot, (_match, root: string) => englishIupacRoot(root));

  translated = translated
    // Parent-chain amines need the English alkane root even when an N-alkyl
    // prefix is immediately attached (for example N-metiletanamina). Word-
    // boundary replacements cannot see the "et" in methyletanamina, so these
    // suffix bridges are intentionally applied before the generic -amine rule.
    .replace(/metanamina$/g, "methanamine")
    .replace(/etanamina$/g, "ethanamine")
    .replace(/propanamina$/g, "propanamine")
    .replace(/butanamina$/g, "butanamine")
    .replace(/pentanamina$/g, "pentanamine")
    .replace(/hexanamina$/g, "hexanamine")
    .replace(/heptanamina$/g, "heptanamine")
    .replace(/octanamina$/g, "octanamine")
    .replace(/nonanamina$/g, "nonanamine")
    .replace(/decanamina$/g, "decanamine")
    .replace(/anodial$/g, "anedial")
    .replace(/anodiamida$/g, "anediamide")
    .replace(/anodiamina$/g, "anediamine")
    .replace(/anodioato$/g, "anedioate")
    .replace(/anodioico$/g, "anedioic")
    .replace(/carboxilato$/g, "carboxylate")
    .replace(/benzoico$/g, "benzoic")
    .replace(/carbaldehido$/g, "carbaldehyde")
    .replace(/carboxilico$/g, "carboxylic acid")
    // Spanish parent nitriles are commonly written as butanonitrilo or
    // pentanodinitrilo. OPSIN uses butanenitrile / pentanedinitrile.
    // Ring carbonitriles and carboxamides also retain the parent alkane e.
    .replace(/([a-z]+)ano(di|tri|tetra|penta|hexa)nitrilo$/g, "$1ane$2nitrile")
    .replace(/([a-z]+)anonitrilo$/g, "$1anenitrile")
    .replace(/([a-z]+)anocarbonitrilo$/g, "$1anecarbonitrile")
    .replace(/([a-z]+)anocarboxamida$/g, "$1anecarboxamide")
    .replace(/nitrilo$/g, "nitrile")
    .replace(/aldehido$/g, "aldehyde")
    .replace(/tetraona$/g, "tetraone")
    .replace(/triona$/g, "trione")
    .replace(/diona$/g, "dione")
    .replace(/ona$/g, "one")
    .replace(/amida$/g, "amide")
    .replace(/amina$/g, "amine")
    .replace(/tiol$/g, "thiol")
    .replace(/oato$/g, "oate")
    .replace(/oico$/g, "oic")
    .replace(/ano(?=-\d)/g, "ane")
    .replace(/eno(?=-\d)/g, "ene")
    .replace(/ino(?=-\d)/g, "yne")
    // Before a principal-group suffix Spanish elides the terminal "o" from
    // -ino (for example dec-3-in-2-ona); English correspondingly uses -yn-.
    .replace(/in(?=-\d)/g, "yn")
    .replace(/-en$/g, "-ene")
    .replace(/-in$/g, "-yne")
    .replace(/ano$/g, "ane")
    .replace(/eno$/g, "ene")
    .replace(/ino$/g, "yne")
    .replace(/-il$/g, "-yl")
    .replace(/ilo$/g, "yl")
    .replace(/__amino_prefix__/g, "amino");

  // English cyclic parent hydrides retain their final "e" before the
  // ring-attached suffixes carbaldehyde and carboxylic acid. The Spanish
  // bridge above leaves an "o" after cycloalkane roots; restore the English
  // parent ending only at these suffix boundaries, without affecting chains.
  return translated.replace(
    /(\bcyclo(?:prop|but|pent|hex|hept|oct|non|dec)an)o(?=carbaldehyde|carboxylic acid)/g,
    "$1e",
  );
}

/**
 * OPSIN follows English systematic nomenclature. The laboratory UI is Spanish,
 * so we generate a conservative English candidate before trying the original
 * text. This is intentionally a nomenclature bridge, not a structure parser.
 */
export function translateSpanishIupacToOpsin(value: string) {
  const normalized = normalizeHalogenatedNameForOpsin(value);
  if (!normalized) return "";

  const common = commonSpanishNames[normalized];
  if (common) return common;

  const heterocycleName = translateHeterocycles(normalized);

  const ester = heterocycleName.match(/^(.+?(?:oato|carboxilato))\s+de\s+(.+?(?:ilo|il))$/);
  if (ester) {
    const acidPart = translateCore(ester[1]);
    const alkylPart = translateCore(ester[2]);
    return `${alkylPart} ${acidPart}`;
  }

  const acid = heterocycleName.match(/^acido\s+(.+)$/);
  if (acid) {
    const acidName = translateCore(acid[1]);
    return acidName.endsWith("acid") ? acidName : `${acidName} acid`;
  }

  // Spanish acid names are also frequently entered without the leading word
  // "ácido". OPSIN's public HTTP service expects the English "acid" word.
  if (/(?:oico|carboxilico)$/.test(heterocycleName)) {
    const acidName = translateCore(heterocycleName);
    return acidName.endsWith("acid") ? acidName : `${acidName} acid`;
  }

  return translateCore(heterocycleName);
}

const alphabetizedHalogenPrefix = /(?<locants>\d+(?:,\d+)*-)(?<name>(?:(?:di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?(?:fluoro|chloro|bromo|iodo|methyl|ethyl)))(?=-|[a-z]|$)/gi;
const ignoredMultipliers = /^(?:di|tri|tetra|penta|hexa|hepta|octa|nona|deca)/i;

/** Reorders only the recognized, simple prefix run when halogens are present. */
function alphabetizeEnglishHalogenPrefixes(value: string) {
  const matches = [...value.matchAll(alphabetizedHalogenPrefix)];
  if (!matches.length || matches[0].index !== 0) return value;
  if (!matches.some((match) => /^(?:di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?(?:fluoro|chloro|bromo|iodo)$/i.test(match.groups?.name ?? ""))) {
    return value;
  }

  const lastMatch = matches.at(-1)!;
  const prefixEnd = lastMatch.index! + lastMatch[0].length;
  if (matches.some((match, index) => index > 0
    && !/^-*$/.test(value.slice(matches[index - 1].index! + matches[index - 1][0].length, match.index)))) {
    return value;
  }
  const prefixGroups = matches.map((match) => ({
    locants: match.groups!.locants.slice(0, -1),
    name: match.groups!.name,
    alphabeticalKey: match.groups!.name.replace(ignoredMultipliers, "").toLocaleLowerCase("en"),
  }));
  // Any remaining hyphen can introduce another locanted part (for example
  // 1-chloro-4-ethenylbenzene). It is not a disposable prefix/parent joiner.
  const parent = value.slice(prefixEnd);
  prefixGroups.sort((left, right) => left.alphabeticalKey.localeCompare(right.alphabeticalKey, "en")
    || left.locants.localeCompare(right.locants, "en", { numeric: true }));
  return `${prefixGroups.map(({ locants, name }) => `${locants}-${name}`).join("-")}${parent}`;
}

/** English display localization; OPSIN candidates keep their parser punctuation and source order. */
export function translateSpanishIupacForDisplay(value: string) {
  return canonicalizeEnglishAcyclicPrefixes(
    alphabetizeEnglishHalogenPrefixes(compactHalogenatedName(translateSpanishIupacToOpsin(value))),
  );
}

/**
 * Public parser boundary. Input normalization is intentionally separate from
 * display localization so parser vocabulary never leaks into the Spanish UI.
 */
export function normalizeChemicalNameForParser(value: string, locale: "es" | "en" = "es") {
  if (locale === "en") return normalizeHalogenatedNameForOpsin(value);
  return translateSpanishIupacToOpsin(value);
}

type DisplayVocabularyEntry = {
  /** A chemical morpheme boundary; this module is never used for generic UI text. */
  pattern: RegExp;
  spanish: string;
};

const displayVocabulary: readonly DisplayVocabularyEntry[] = [
  { pattern: /pyrene(?=$|[-,.)])/gi, spanish: "pireno" },
  { pattern: /fluoranthene(?=$|[-,.)])/gi, spanish: "fluoranteno" },
  { pattern: /biphenylene(?=$|[-,.)])/gi, spanish: "bifenileno" },
  { pattern: /triphenylene(?=$|[-,.)])/gi, spanish: "trifenileno" },
  { pattern: /naphthol(?=$|[-,.)])/gi, spanish: "naftol" },
  { pattern: /tetrahydro(?=naphthalene)/gi, spanish: "tetrahidro" },
  { pattern: /anthracene(?=$|[-,.)])/gi, spanish: "antraceno" },
  { pattern: /phenanthrene(?=$|[-,.)])/gi, spanish: "fenantreno" },
  { pattern: /indene(?=$|[-,.)])/gi, spanish: "indeno" },
  { pattern: /fluorene(?=$|[-,.)])/gi, spanish: "fluoreno" },
  { pattern: /azulene(?=$|[-,.)])/gi, spanish: "azuleno" },
  { pattern: /dihydro(?=naphthalene)/gi, spanish: "dihidro" },
  { pattern: /chloro(?=naphthalene)/gi, spanish: "cloro" },
  { pattern: /iodo(?=naphthalene)/gi, spanish: "yodo" },
  { pattern: /naphthalene(?=$|[-,.)])/gi, spanish: "naftaleno" },
  { pattern: /naphthalen(?=$|[-,.)])/gi, spanish: "naftalen" },
  { pattern: /pyridine(?=$|[-,.)])/gi, spanish: "piridina" },
  { pattern: /pyrrole(?=$|[-,.)])/gi, spanish: "pirrol" },
  { pattern: /morpholine(?=$|[-,.)])/gi, spanish: "morfolina" },
  { pattern: /decalin(?=$|[-,.)])/gi, spanish: "decalina" },
  { pattern: /tricyclo(?=\[)/gi, spanish: "triciclo" },
  { pattern: /bicyclo(?=\[)/gi, spanish: "biciclo" },
  { pattern: /spiro(?=\[)/gi, spanish: "espiro" },
  // These stems appear inside a complete IUPAC component such as
  // 2-methylpyridine; a following chemical suffix is an intentional boundary.
  { pattern: /methyl(?=[a-z]|$|[-,.)])/gi, spanish: "metil" },
  { pattern: /ethyl(?=[a-z]|$|[-,.)])/gi, spanish: "etil" },
  { pattern: /hydroxy(?=[a-z]|$|[-,.)])/gi, spanish: "hidroxi" },
  { pattern: /acetyl(?=[a-z]|$|[-,.)])/gi, spanish: "acetil" },
  { pattern: /propionyl(?=[a-z]|$|[-,.)])/gi, spanish: "propionil" },
  { pattern: /butyryl(?=[a-z]|$|[-,.)])/gi, spanish: "butiril" },
];

const displayStereoDescriptors = "(?:\\((?:\\d+[a-z]?)?[RSEZ](?:,(?:\\d+[a-z]?)?[RSEZ])*\\)-)*";
const externalFusedKetoneDisplay = new RegExp(
  `^(?<stereo>${displayStereoDescriptors})(?<prefixes>(?:\\d+(?:,\\d+)*-(?:acetyl|dimethyl|methyl)-)*)`
  + "(?<hydroLocants>\\d+(?:,\\d+)*)-dodecahydrocyclopenta(?<fusion>\\[a\\])phenanthren-(?<ketoneLocant>\\d+)-one$",
);

/** Localizes display text only; external names require complete vocabulary
 * coverage, while existing local/Legacy callers retain their lexical bridge. */
export function localizeChemicalNameForDisplay(
  value: string,
  locale: "es" | "en",
  options: { source?: "external" } = {},
) {
  if (locale === "en") return value;
  const translateKnownVocabulary = (text: string) => displayVocabulary.reduce(
    (localized, entry) => localized.replace(entry.pattern, entry.spanish), text,
  );
  if (options.source === "external") {
    // Recognize the whole construction before localizing any component.
    // Locants, stereodescriptors, fusion descriptor and separators are copied;
    // no parent selection, numbering, stereochemistry or identity is inferred.
    const fused = externalFusedKetoneDisplay.exec(value)?.groups;
    if (fused) {
      return `${fused.stereo}${translateKnownVocabulary(fused.prefixes)}${fused.hydroLocants}`
        + `-dodecahidrociclopenta${fused.fusion}fenantren-${fused.ketoneLocant}-ona`;
    }
    // Existing simple vocabulary is safe only when it accounts for every
    // lexical character. Match spans against the original text so replacing
    // one morpheme cannot create a boundary for an unknown neighboring word.
    const uncovered = value.split("");
    const stereo = new RegExp(`^${displayStereoDescriptors}`).exec(value)?.[0] ?? "";
    uncovered.fill(" ", 0, stereo.length);
    for (const entry of displayVocabulary) {
      for (const match of value.matchAll(entry.pattern)) {
        uncovered.fill(" ", match.index, match.index + match[0].length);
      }
    }
    if (/[^\d\s()[\],.\-]/.test(uncovered.join(""))) return value;
  }
  return translateKnownVocabulary(value);
}

export function getOpsinNameCandidates(value: string) {
  const originalNormalized = normalizePunctuation(value);
  const normalized = normalizeHalogenatedNameForOpsin(value);
  const translated = normalizeChemicalNameForParser(value, "es");
  // Try the normalized spelling first, then retain compact variants as a
  // compatibility fallback for older OPSIN spellings.
  return [...new Set([
    translated,
    normalized,
    compactHalogenatedName(translated),
    compactHalogenatedName(normalized),
    originalNormalized,
  ].filter(Boolean))];
}
