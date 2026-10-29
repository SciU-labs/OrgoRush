import type { AppLanguage } from "./i18n.ts";

/** Already grouped and ordered by the active nomenclature formatter. */
export type AlphabeticalReasoningGroup = {
  sourceName: string;
  name: string;
  comparisonName: string;
  locants: readonly number[];
  citedPrefix: string;
  multiplier: string;
  complex: boolean;
};
export type AlphabeticalOrderPresentation = {
  groups: readonly AlphabeticalReasoningGroup[];
  fragment: string;
  label: string;
  paragraphs: string[];
};
const conventional = (group: AlphabeticalReasoningGroup) => /^(?:sec|tert|terc)-/.test(group.name);

function compareNames(left: AlphabeticalReasoningGroup, right: AlphabeticalReasoningGroup, language: AppLanguage) {
  const a = left.comparisonName, b = right.comparisonName;
  let index = 0;
  while (index < Math.min(a.length, b.length) && a[index] === b[index]) index++;
  const letters = Boolean(a[index] && b[index] && a[index] < b[index]);
  const label = (group: AlphabeticalReasoningGroup, letter: string) => {
    const name = language === "es" ? `«${group.name}»` : `“${group.name}”`;
    if (conventional(group)) return language === "es"
      ? `${name} (clave «${group.comparisonName}»)` : `${name} (key “${group.comparisonName}”)`;
    return `${name}${letters && index === 0 ? ` (${letter})` : ""}`;
  };
  const difference = letters && index > 0
    ? language === "es" ? ` por la primera diferencia (${a[index]} antes que ${b[index]})`
      : ` at the first difference (${a[index]} before ${b[index]})` : "";
  const citation = left.multiplier || right.multiplier
    ? language === "es" ? `; se cita «${left.citedPrefix}» antes de «${right.citedPrefix}»`
      : `; cite “${left.citedPrefix}” before “${right.citedPrefix}”` : "";
  return language === "es"
    ? `${label(left, a[index])} precede a ${label(right, b[index])}${difference}${citation}`
    : `${label(left, a[index])} precedes ${label(right, b[index])}${difference}${citation}`;
}

/** Narrative only: this function never sorts substituents or selects numbering. */
export function describeAlphabeticalOrder(
  groups: readonly AlphabeticalReasoningGroup[], language: AppLanguage,
): AlphabeticalOrderPresentation | undefined {
  if (!groups.length) return;
  const fragment = groups.map(group => group.name).join(" → ");
  let paragraphs: string[];
  if (groups.length === 1) {
    paragraphs = [language === "es"
      ? `Solo hay un tipo de sustituyente, «${groups[0].name}»; no es necesario comparar nombres diferentes.`
      : `There is only one substituent type, “${groups[0].name}”; no comparison between different names is needed.`];
  } else {
    const rule = groups.some(group => group.complex)
      ? language === "es"
        ? "Se ordena alfabéticamente por el nombre completo de cada sustituyente, conservando los prefijos internos de los complejos e ignorando multiplicadores externos y localizadores."
        : "Substituents are ordered alphabetically by their complete names, retaining internal prefixes in complex groups while ignoring outside multipliers and locants."
      : language === "es"
        ? "Los sustituyentes se ordenan alfabéticamente por su nombre base, sin considerar prefijos multiplicativos externos ni sus localizadores."
        : "Substituents are cited in alphabetical order using their base names, without considering external multiplicative prefixes or numerical locants.";
    // One representative comparison keeps large prefix sets brief; the static
    // arrow still shows the complete order supplied by the naming engine.
    const qualified = groups.findIndex(conventional);
    const index = qualified >= 0 ? Math.max(0, qualified - 1) : Math.max(0,
      groups.slice(0, -1).findIndex((group, i) => group.comparisonName !== groups[i + 1].comparisonName));
    const lead = groups.length > 2 ? language === "es" ? "Entre ellos" : "Among them" : language === "es" ? "Aquí" : "In this molecule";
    paragraphs = [rule, `${lead}, ${compareNames(groups[index], groups[index + 1], language)}.`];
  }
  return { groups, fragment, label: language === "es" ? "Orden alfabético" : "Alphabetical order", paragraphs };
}
