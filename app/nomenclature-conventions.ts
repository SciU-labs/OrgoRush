import type { AppLanguage } from "./i18n";
import {
  compactHalogenatedName,
  stripMethaneHalogenLocants,
} from "./iupac-name-normalization.ts";
import { englishIupacRoot, IUPAC_ROOTS } from "./iupac-prefixes.ts";
import { isRetainedFused1979NameEs } from "./iupac1979-retained-fused.ts";

export type NomenclatureConvention = "current" | "traditional" | "iupac-1979-es" | "iupac-1979-legacy-en";

type ConventionCycle = readonly NomenclatureConvention[];

const conventionCycles: Record<AppLanguage, ConventionCycle> = {
  es: ["current", "iupac-1979-es"],
  en: ["current", "iupac-1979-legacy-en"],
};

/** The public selector has two profiles; historical internal conventions remain readable. */
export function selectableNomenclatureConventions(language: AppLanguage) {
  return conventionCycles[language];
}

export function migrateNomenclatureConvention(value: unknown, language: AppLanguage): NomenclatureConvention {
  if (value === "iupac-1979-es" || value === "iupac-1979-legacy-en"
    || value === "IUPAC 1979" || value === "IUPAC 1979 Legacy English") {
    return language === "es" ? "iupac-1979-es" : "iupac-1979-legacy-en";
  }
  // An old Traditional selection was a separate common-name profile.
  return "current";
}
const stereoPrefix = /^(\((?:\d+[EZRS](?:,\d+[EZRS])*)\)-)(.+)$/;
const pureAlkaneNames = new Set(
  IUPAC_ROOTS.slice(1).flatMap((root) => [`${root}ano`, `${englishIupacRoot(root)}ane`]),
);

// A-31.1 (1979). This is a spelling whitelist, not a molecular recognizer;
// legacySpanishFormatterInput requires the corresponding graph proof.
export function isSpanish1979SaturatedFusedParentName(name: string) {
  return name === "biciclo[3.3.0]octano"
    || name === "biciclo[4.3.0]nonano"
    || name === "biciclo[4.4.0]decano";
}

const traditionalRoots: Record<AppLanguage, readonly string[]> = {
  es: IUPAC_ROOTS.slice(1),
  en: IUPAC_ROOTS.slice(1).map(englishIupacRoot),
};

const traditionalRootPatterns: Record<AppLanguage, string> = {
  es: rootPatternFor("es"),
  en: rootPatternFor("en"),
};

function rootPatternFor(language: AppLanguage) {
  return [...new Set(traditionalRoots[language])]
    .sort((left, right) => right.length - left.length)
    .join("|");
}

type TraditionalName = {
  es: string;
  en: string;
};

const traditionalNames: Record<string, TraditionalName> = {
  metano: { es: "metano", en: "methane" },
  methane: { es: "metano", en: "methane" },
  etano: { es: "etano", en: "ethane" },
  ethane: { es: "etano", en: "ethane" },
  propano: { es: "propano", en: "propane" },
  propane: { es: "propano", en: "propane" },
  eteno: { es: "etileno", en: "ethylene" },
  ethene: { es: "etileno", en: "ethylene" },
  propeno: { es: "propileno", en: "propylene" },
  propene: { es: "propileno", en: "propylene" },
  "prop-1-eno": { es: "propileno", en: "propylene" },
  "prop-1-ene": { es: "propileno", en: "propylene" },
  "but-1-eno": { es: "butileno", en: "butylene" },
  "but-1-ene": { es: "butileno", en: "butylene" },
  "but-2-eno": { es: "butileno", en: "butylene" },
  "but-2-ene": { es: "butileno", en: "butylene" },
  etino: { es: "acetileno", en: "acetylene" },
  ethyne: { es: "acetileno", en: "acetylene" },
  "prop-1-ino": { es: "metilacetileno", en: "methylacetylene" },
  "prop-1-yne": { es: "metilacetileno", en: "methylacetylene" },
  metanol: { es: "metanol", en: "methanol" },
  methanol: { es: "metanol", en: "methanol" },
  "propan-1-ol": { es: "propanol", en: "propanol" },
  "propan-2-ol": { es: "alcohol isopropílico", en: "isopropyl alcohol" },
  etanol: { es: "alcohol etílico", en: "ethyl alcohol" },
  ethanol: { es: "alcohol etílico", en: "ethyl alcohol" },
  "etan-1-ol": { es: "alcohol etílico", en: "ethyl alcohol" },
  "ethan-1-ol": { es: "alcohol etílico", en: "ethyl alcohol" },
  "etan-1,2-diol": { es: "etilenglicol", en: "ethylene glycol" },
  "ethane-1,2-diol": { es: "etilenglicol", en: "ethylene glycol" },
  "propan-1,2-diol": { es: "propilenglicol", en: "propylene glycol" },
  "propane-1,2-diol": { es: "propilenglicol", en: "propylene glycol" },
  "propan-1,2,3-triol": { es: "glicerina", en: "glycerin" },
  "propane-1,2,3-triol": { es: "glicerina", en: "glycerin" },
  metoximetano: { es: "dimetil éter", en: "dimethyl ether" },
  methoxymethane: { es: "dimetil éter", en: "dimethyl ether" },
  metoxietano: { es: "etil metil éter", en: "ethyl methyl ether" },
  methoxyethane: { es: "etil metil éter", en: "ethyl methyl ether" },
  etoxietano: { es: "dietil éter", en: "diethyl ether" },
  ethoxyethane: { es: "dietil éter", en: "diethyl ether" },
  metanal: { es: "formaldehído", en: "formaldehyde" },
  methanal: { es: "formaldehído", en: "formaldehyde" },
  etanal: { es: "acetaldehído", en: "acetaldehyde" },
  ethanal: { es: "acetaldehído", en: "acetaldehyde" },
  propanal: { es: "propionaldehído", en: "propionaldehyde" },
  "propan-2-ona": { es: "acetona", en: "acetone" },
  "propan-2-one": { es: "acetona", en: "acetone" },
  "butan-2-ona": { es: "etil metil cetona", en: "ethyl methyl ketone" },
  "butan-2-one": { es: "etil metil cetona", en: "ethyl methyl ketone" },
  benceno: { es: "benceno", en: "benzene" },
  benzene: { es: "benceno", en: "benzene" },
  fenol: { es: "fenol", en: "phenol" },
  phenol: { es: "fenol", en: "phenol" },
  anilina: { es: "anilina", en: "aniline" },
  aniline: { es: "anilina", en: "aniline" },
  "ácido benzoico": { es: "ácido benzoico", en: "benzoic acid" },
  "benzoic acid": { es: "ácido benzoico", en: "benzoic acid" },
  etenilbenceno: { es: "estireno", en: "styrene" },
  ethenylbenzene: { es: "estireno", en: "styrene" },
  naftaleno: { es: "naftaleno", en: "naphthalene" },
  naphthalene: { es: "naftaleno", en: "naphthalene" },
  "ácido metanoico": { es: "ácido fórmico", en: "formic acid" },
  "methanoic acid": { es: "ácido fórmico", en: "formic acid" },
  "ácido etanoico": { es: "ácido acético", en: "acetic acid" },
  "ethanoic acid": { es: "ácido acético", en: "acetic acid" },
  "ácido propanoico": { es: "ácido propiónico", en: "propionic acid" },
  "propanoic acid": { es: "ácido propiónico", en: "propionic acid" },
  metilbenceno: { es: "tolueno", en: "toluene" },
  methylbenzene: { es: "tolueno", en: "toluene" },
};

/** Removes the displayed E/Z or R/S prefix; the structural model is untouched. */
export function stripStereochemicalDescriptors(name: string) {
  const directMatch = name.match(stereoPrefix);
  if (directMatch) return directMatch[2];

  const acidMatch = name.match(/^(ácido |acid )(\((?:\d+[EZRS](?:,\d+[EZRS])*)\)-)(.+)$/i);
  if (acidMatch) return `${acidMatch[1]}${acidMatch[3]}`;
  return name;
}

function splitStereochemicalPrefix(name: string) {
  const directMatch = name.match(stereoPrefix);
  if (directMatch) return { prefix: directMatch[1], baseName: directMatch[2] };

  const acidMatch = name.match(/^(ácido |acid )(\((?:\d+[EZRS](?:,\d+[EZRS])*)\)-)(.+)$/i);
  if (acidMatch) return { prefix: `${acidMatch[1]}${acidMatch[2]}`, baseName: acidMatch[3] };
  return { prefix: "", baseName: name };
}

function withTraditionalPrefix(prefix: string, name: string) {
  return prefix ? `${prefix}-${name}` : name;
}

/**
 * Converts a localized preferred IUPAC name to the systematic, pre-2013
 * classroom convention. This is intentionally a display-only formatter:
 * structural interpretation remains with OPSIN/OpenChemLib.
 */
export function formatTraditionalSystematicName(baseName: string, language: AppLanguage) {
  const value = baseName.toLocaleLowerCase("es");
  const root = traditionalRootPatterns[language];
  const parent = `(.*?)(${root})`;

  // Monohydric alcohols: the terminal OH is implicit in the traditional form;
  // all other OH positions move in front of the parent name.
  const alcohol = value.match(new RegExp(`^${parent}an-(\\d+)-ol$`, "i"));
  if (alcohol) {
    const [, substituents, parentRoot, position] = alcohol;
    return position === "1"
      ? `${substituents}${parentRoot}anol`
      : withTraditionalPrefix(substituents, `${position}-${parentRoot}anol`);
  }
  if (new RegExp(`^${parent}anol$`, "i").test(value)) return value;

  // Polyols always keep every OH locant, but put those locants before the
  // parent: propan-1,2-diol -> 1,2-propanodiol.
  const polyolConnector = language === "es" ? "an" : "ane";
  const polyol = value.match(
    new RegExp(`^${parent}${polyolConnector}-(\\d+(?:,\\d+)*)-(di|tri|tetra|penta|hexa)ol$`, "i"),
  );
  if (polyol) {
    const [, substituents, parentRoot, positions, multiplier] = polyol;
    return withTraditionalPrefix(substituents, `${positions}-${parentRoot}ano${multiplier}ol`);
  }

  // Aldehyde locants are explicit in the preferred display for C4 and above,
  // but remain implicit in the traditional classroom form.
  const preferredAldehyde = value.match(new RegExp(`^${parent}an-1-al$`, "i"));
  if (preferredAldehyde) {
    const [, substituents, parentRoot] = preferredAldehyde;
    return `${substituents}${parentRoot}anal`;
  }
  // Aldehyde and acid locants are inherent to carbon 1, so their systematic
  // traditional names are unchanged. Returning them here avoids replacing a
  // valid educational name with a retained common name (e.g. formaldehyde).
  if (new RegExp(`^${parent}anal$`, "i").test(value)) return value;
  if (language === "es" && new RegExp(`^ácido ${parent}anoico$`, "i").test(value)) return value;
  if (language === "en" && new RegExp(`^${parent}anoic acid$`, "i").test(value)) return value;

  // Unsaturated ketones keep the double-bond locant first and the carbonyl
  // locant immediately before its suffix: pent-3-en-2-ona -> 3-penten-2-ona.
  const ketoneSuffix = language === "es" ? "ona" : "one";
  const unsaturatedKetone = value.match(
    new RegExp(`^${parent}-(\\d+)-en-(\\d+)-${ketoneSuffix}$`, "i"),
  );
  if (unsaturatedKetone) {
    const [, substituents, parentRoot, doublePosition, ketonePosition] = unsaturatedKetone;
    return withTraditionalPrefix(
      substituents,
      `${doublePosition}-${parentRoot}en-${ketonePosition}-${ketoneSuffix}`,
    );
  }

  // Ketones use a leading locant, except propan-2-one/propan-2-ona whose only
  // possible carbonyl position is traditionally implicit.
  const ketone = value.match(new RegExp(`^${parent}an-(\\d+)-${ketoneSuffix}$`, "i"));
  if (ketone) {
    const [, substituents, parentRoot, position] = ketone;
    if (!substituents && parentRoot === "prop" && position === "2") {
      return `${parentRoot}an${ketoneSuffix}`;
    }
    return withTraditionalPrefix(substituents, `${position}-${parentRoot}an${ketoneSuffix}`);
  }
  if (new RegExp(`^${parent}an${ketoneSuffix}$`, "i").test(value)) return value;

  // The legacy placement for a single double or triple bond is before the
  // parent: 4-cloropent-2-eno -> 4-cloro-2-penteno.
  const unsaturationSuffix = language === "es" ? "eno|ino" : "ene|yne";
  const unsaturation = value.match(new RegExp(`^${parent}-(\\d+)-(${unsaturationSuffix})$`, "i"));
  if (unsaturation) {
    const [, substituents, parentRoot, position, suffix] = unsaturation;
    return withTraditionalPrefix(substituents, `${position}-${parentRoot}${suffix}`);
  }

  return undefined;
}

/** Spanish IUPAC 1979 output applies verified historical forms before the shared formatter. */
export function formatIupac1979SpanishName(baseName: string) {
  if (isRetainedFused1979NameEs(baseName)) return baseName;
  return formatSpanish1979CyclicKetone(baseName)
    ?? formatTraditionalSystematicName(baseName, "es")
    ?? formatSpanish1979Extension(baseName);
}

/**
 * 1979 cyclic enones keep "ciclo" attached to the ring parent and omit the
 * inherent carbonyl locant 1. This is deliberately Spanish Legacy-only.
 */
function formatSpanish1979CyclicKetone(baseName: string) {
  const value = baseName.toLocaleLowerCase("es");
  const root = traditionalRootPatterns.es;
  // A-11.3: -adiene/-atriene; C-314.1: cyclic parent + -one.
  // Scope the added grammar to monocyclic monoketones with inherent C1.
  const polyenone = value.match(new RegExp(`^(.*?)ciclo(${root})a-(\\d+(?:,\\d+)+)-(di|tri|tetra|penta|hexa|hepta|octa)en-1-ona$`, "i"));
  if (polyenone) {
    const [, substituents, ringRoot, locants, multiplier] = polyenone;
    const positions = locants.split(",");
    const multiplicity = ["", "", "di", "tri", "tetra", "penta", "hexa", "hepta", "octa"].indexOf(multiplier);
    if (positions.length !== multiplicity || new Set(positions).size !== positions.length) return undefined;
    return withTraditionalPrefix(substituents, `${locants}-ciclo${ringRoot}a${multiplier}enona`);
  }
  const enone = value.match(new RegExp(`^(.*?)ciclo(${root})-(\\d+)-en-(\\d+)-ona$`, "i"));
  if (!enone) return undefined;

  const [, substituents, ringRoot, doubleBondLocant, carbonylLocant] = enone;
  const ketoneSuffix = carbonylLocant === "1" ? "ona" : `-${carbonylLocant}-ona`;
  return withTraditionalPrefix(substituents, `${doubleBondLocant}-ciclo${ringRoot}en${ketoneSuffix}`);
}

/**
 * Additional Spanish Legacy forms supported by the graph name grammar but
 * not covered by the common-name formatter. These rules are scoped to the
 * IUPAC 1979 selector; they do not change the separate Traditional profile.
 */
function formatSpanish1979Extension(baseName: string) {
  const value = baseName.toLocaleLowerCase("es");
  const root = traditionalRootPatterns.es;
  const parent = `(.*?)(${root})`;

  if (isSpanish1979SaturatedFusedParentName(value)) return value;

  // Saturated acyclic parent alkanes keep the same valid systematic spelling
  // in the 1979 and 2013 profiles. Recognize only a project-supported root.
  if (new RegExp(`^(?:${root})ano$`, "i").test(value)) return value;

  // A-2.1–2.3: substituted saturated parent chains keep locants before
  // alphabetized substituent names. Accept only the simple prefixes handled
  // by this formatter instead of treating arbitrary text as a valid name.
  const substituentNames = "fluoro|cloro|bromo|yodo|metil|etil|propil|butil";
  const substituentMultipliers: Record<string, number> = {
    di: 2, tri: 3, tetra: 4, penta: 5, hexa: 6, hepta: 7, octa: 8, nona: 9, deca: 10,
  };
  const hasSupportedSubstituentSequence = (prefix: string) => {
    const parts = prefix.split("-");
    if (!parts.length || parts.length % 2 !== 0) return false;
    for (let index = 0; index < parts.length; index += 2) {
      const locants = parts[index].split(",");
      if (!locants.every((locant) => /^\d+$/.test(locant))) return false;
      const substituent = new RegExp(`^(di|tri|tetra|penta|hexa|hepta|octa|nona|deca)?(${substituentNames})$`, "i")
        .exec(parts[index + 1]);
      if (!substituent) return false;
      const count = substituentMultipliers[substituent[1]?.toLocaleLowerCase("en") ?? ""] ?? 1;
      if (locants.length !== count) return false;
    }
    return true;
  };
  const substitutedAlkane = value.match(new RegExp(`^${parent}ano$`, "i"));
  if (substitutedAlkane?.[1] && hasSupportedSubstituentSequence(substitutedAlkane[1])) return value;

  // C-304.1 and C-401.2 use these suffixes on a ring parent; the attachment
  // carbon of the exocyclic group is not included in the ring numbering.
  if (new RegExp(`^ciclo(?:${root})ano(?:carbaldehído)$`, "i").test(value)) return value;
  if (new RegExp(`^ácido ciclo(?:${root})ano(?:carboxílico)$`, "i").test(value)) return value;

  // A-3.3 and C-201.1: put the unsaturation locant before the parent and keep
  // the hydroxyl locant immediately before -ol (e.g. 3-buten-1-ol).
  const unsaturatedAlcohol = value.match(new RegExp(`^(${root})-(\\d+)-(en|in)-(\\d+)-ol$`, "i"));
  if (unsaturatedAlcohol) {
    const [, parentRoot, bondLocant, unsaturation, hydroxylLocant] = unsaturatedAlcohol;
    return `${bondLocant}-${parentRoot}${unsaturation}-${hydroxylLocant}-ol`;
  }

  // A-3.3 specifies the historical enyne ending and its independent locants.
  const enyne = value.match(new RegExp(`^(${root})-(\\d+)-en-(\\d+)-ino$`, "i"));
  if (enyne) {
    const [, parentRoot, doubleLocant, tripleLocant] = enyne;
    return `${doubleLocant}-${parentRoot}en-${tripleLocant}-ino`;
  }

  // A-11.3, C-201.1: cyclic unsaturated parent plus the principal OH suffix.
  // Keep the hydroxyl locant even at C1: here C1 is also part of the C=C bond.
  const unsaturatedRingAlcohol = value.match(
    new RegExp(`^ciclo(${root})-(\\d+)-(en|in)-(\\d+)-ol$`, "i"),
  );
  if (unsaturatedRingAlcohol) {
    const [, parentRoot, bondLocant, unsaturation, hydroxylLocant] = unsaturatedRingAlcohol;
    return `${bondLocant}-ciclo${parentRoot}${unsaturation}-${hydroxylLocant}-ol`;
  }

  return undefined;
}

function traditionalName(baseName: string, language: AppLanguage) {
  const systematicName = formatTraditionalSystematicName(baseName, language);
  if (systematicName) return systematicName;
  const retainedName = traditionalNames[baseName.toLocaleLowerCase("es")]?.[language];
  if (retainedName) return retainedName;
  if (/(?:fluoro|cloro|chloro|bromo|yodo|iodo)/i.test(baseName)) {
    return compactHalogenatedName(baseName);
  }
  return pureAlkaneNames.has(baseName.toLocaleLowerCase("es")) ? baseName : "-";
}

/** Returns only an exact alias already curated in the traditional-name table. */
export function getCuratedCommonName(systematicName: string, language: AppLanguage) {
  const { baseName } = splitStereochemicalPrefix(systematicName);
  const commonName = traditionalNames[baseName.toLocaleLowerCase("es")]?.[language];
  if (!commonName) return null;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(language).replace(/[^a-z0-9]/g, "");
  return normalize(commonName) === normalize(baseName) ? null : commonName;
}

/**
 * Applies only display conventions to a localized PIN. It deliberately does
 * not parse or identify a molecule, so OPSIN/OpenChemLib naming remains the
 * canonical source of the underlying name.
 */
export function applyNomenclatureConvention(
  name: string,
  convention: NomenclatureConvention,
  language: AppLanguage,
) {
  const { prefix, baseName } = splitStereochemicalPrefix(name);
  const spanish1979 = convention === "iupac-1979-es" && language === "es";
  const formattedName = spanish1979
    ? formatIupac1979SpanishName(baseName) ?? "-"
    : convention === "traditional"
      ? traditionalName(baseName, language)
      : baseName;
  if (formattedName === "-") return "-";
  const methaneLocantsRemoved = stripMethaneHalogenLocants(formattedName);
  const halogenFormattedName = convention === "traditional"
    ? compactHalogenatedName(methaneLocantsRemoved)
    : spanish1979
      ? formattedName
      : compactHalogenatedName(methaneLocantsRemoved);
  return `${prefix}${halogenFormattedName}`;
}

export function nextNomenclatureConvention(
  current: NomenclatureConvention,
  language: AppLanguage,
): NomenclatureConvention {
  const cycle = conventionCycles[language];
  const currentIndex = cycle.indexOf(current);
  if (currentIndex >= 0) return cycle[(currentIndex + 1) % cycle.length];
  return cycle[0];
}

export function nomenclatureConventionLabel(
  convention: NomenclatureConvention,
  language: AppLanguage,
) {
  if (convention === "iupac-1979-es" || convention === "iupac-1979-legacy-en") return "IUPAC 1979 (Legacy)";
  return language === "en" ? "IUPAC Suggested (Blue Book 2013+)" : "IUPAC sugerido (Blue Book 2013+)";
}
