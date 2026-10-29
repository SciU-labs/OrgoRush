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
type NumberingContext = {
  functionLabel?: string;
  selectedLocants?: readonly number[];
  reverseLocants?: readonly number[];
};

const cardinals = {
  es: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"],
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
};
const countWord = (count: number, language: AppLanguage) => cardinals[language][count] ?? String(count);
const list = (items: readonly string[], language: AppLanguage) => items.length < 2 ? items[0] ?? ""
  : `${items.slice(0, -1).join(", ")}${language === "es" ? " y " : " and "}${items.at(-1)}`;

function groupDescription(group: AlphabeticalReasoningGroup, language: AppLanguage) {
  const locations = new Map<number, number>();
  for (const locant of [...group.locants].sort((a,b) => a-b)) locations.set(locant, (locations.get(locant) ?? 0) + 1);
  const count = group.locants.length;
  const position = locations.size === 1
    ? `${count === 2 ? language === "es" ? "ambos " : "both " : ""}${language === "es" ? "en" : "at"} C${[...locations.keys()][0]}`
    : [...locations.values()].every(value => value === 1)
      ? `${language === "es" ? "en" : "at"} ${list([...locations.keys()].map(n => `C${n}`), language)}`
      : list([...locations].map(([n, amount]) => `${countWord(amount, language)} ${language === "es" ? "en" : "at"} C${n}`), language);
  return language === "es"
    ? `${count === 1 ? "un grupo" : `${countWord(count, language)} grupos`} «${group.name}» (${position})`
    : `${countWord(count, language)} ${group.name} ${count === 1 ? "group" : "groups"} (${position})`;
}

function compareNames(left: AlphabeticalReasoningGroup, right: AlphabeticalReasoningGroup, language: AppLanguage) {
  const a = left.comparisonName, b = right.comparisonName;
  let index = 0;
  while (index < Math.min(a.length, b.length) && a[index] === b[index]) index++;
  const letters = a[index] && b[index] && a[index] < b[index]
    ? language === "es"
      ? index === 0 ? `«${a[index]}» va antes que «${b[index]}»`
        : `coinciden en «${a.slice(0, index)}» y la primera diferencia es «${a[index]}» antes que «${b[index]}»`
      : index === 0 ? `“${a[index]}” comes before “${b[index]}”`
        : `they share “${a.slice(0, index)}”, then “${a[index]}” comes before “${b[index]}”`
    : !a[index] && b[index]
      ? language === "es" ? "el primer nombre termina antes de que aparezcan más letras" : "the first name ends before the additional letters"
      : "";
  return language === "es"
    ? `Se compara «${left.name}» con «${right.name}»${letters ? `: ${letters}` : " según la forma de citación del perfil seleccionado"}; se cita «${left.citedPrefix}» antes de «${right.citedPrefix}».`
    : `Compare “${left.name}” with “${right.name}”${letters ? `: ${letters}` : " using the selected profile's citation form"}; “${left.citedPrefix}” is cited before “${right.citedPrefix}”.`;
}

/** Narrative only: this function never sorts substituents or selects numbering. */
export function describeAlphabeticalOrder(
  groups: readonly AlphabeticalReasoningGroup[], language: AppLanguage, numbering: NumberingContext = {},
): AlphabeticalOrderPresentation | undefined {
  if (!groups.length) return;
  const fragment = groups.map(group => group.name).join(" → ");
  const paragraphs = [language === "es"
    ? "Para escribir el nombre, los prefijos de los sustituyentes se citan en orden alfabético según sus nombres, no según su cantidad ni sus posiciones en el padre."
    : "When writing the name, substituent prefixes are cited alphabetically by their names, rather than by their quantities or positions on the parent.",
  language === "es" ? `En esta molécula encontramos ${list(groups.map(group => groupDescription(group, language)), language)}.`
    : `This molecule contains ${list(groups.map(group => groupDescription(group, language)), language)}.`];
  paragraphs.push(groups.length === 1
    ? language === "es" ? `Solo hay un tipo de sustituyente, «${groups[0].name}»; no es necesario comparar nombres diferentes.`
      : `There is only one substituent type, “${groups[0].name}”; no comparison between different names is needed.`
    : groups.slice(0, -1).map((group, index) => compareNames(group, groups[index + 1], language)).join(" "));
  const simpleMultipliers = groups.filter(group => !group.complex && group.multiplier);
  const quantity = simpleMultipliers.length
    ? list(simpleMultipliers.map(group => language === "es"
      ? `«${group.multiplier}-» en «${group.citedPrefix}» indica ${countWord(group.locants.length, language)} grupos «${group.name}»`
      : `“${group.multiplier}-” in “${group.citedPrefix}” indicates ${countWord(group.locants.length, language)} ${group.name} groups`), language)
    : language === "es" ? "Si se repite un sustituyente simple, su prefijo multiplicativo indica la cantidad"
      : "If a simple substituent is repeated, its multiplicative prefix indicates its quantity";
  paragraphs.push(language === "es"
    ? `${quantity}; ${simpleMultipliers.length > 1 ? "esos prefijos externos no determinan" : "ese prefijo externo no determina"} el orden alfabético de los nombres base. Los localizadores numéricos indican posiciones y tampoco determinan el orden de citación.`
    : `${quantity}; ${simpleMultipliers.length > 1 ? "those outside prefixes do not determine" : "that outside prefix does not determine"} the alphabetical order of the base names. Numerical locants indicate positions and do not determine citation order either.`);
  if (groups.some(group => group.complex)) paragraphs.push(language === "es"
    ? "Para los sustituyentes complejos se considera el nombre completo del grupo, incluidos sus prefijos internos; no se aplica una eliminación general de di-, tri- u otras partes de ese nombre. Un multiplicador externo cuenta grupos complejos completos."
    : "For complex substituents, the complete group name, including its internal prefixes, is considered; di-, tri- and other parts of that name are not universally removed. An outside multiplier counts complete complex groups.");
  const conventional = groups.filter(group => /^(?:sec|tert|terc)-/.test(group.name));
  if (conventional.length) paragraphs.push(list(conventional.map(group => language === "es"
    ? `En la forma convencional «${group.name}» utilizada aquí, se compara «${group.comparisonName}»; el calificador inicial describe la forma del grupo.`
    : `For the conventional form “${group.name}” used here, “${group.comparisonName}” is compared; the initial qualifier describes the group's form.`), language));
  const fixed = numbering.functionLabel && numbering.selectedLocants?.length && numbering.reverseLocants?.length
    ? language === "es"
      ? `Aquí la función principal («${numbering.functionLabel.toLowerCase()}») fija ${list(numbering.selectedLocants.map(n => `C${n}`), language)}, frente a ${list(numbering.reverseLocants.map(n => `C${n}`), language)} desde el otro extremo; el orden de citación no invierte esa elección. `
      : `Here the principal function (“${numbering.functionLabel.toLowerCase()}”) fixes ${list(numbering.selectedLocants.map(n => `C${n}`), language)}, versus ${list(numbering.reverseLocants.map(n => `C${n}`), language)} from the other end; citation order does not reverse that choice. `
    : "";
  paragraphs.push(fixed + (language === "es"
    ? "Esta ordenación al escribir el nombre es distinta de elegir el sentido de numeración. El orden alfabético solo puede resolver un empate después de respetar los criterios de mayor prioridad."
    : "Ordering prefixes when writing the name is separate from choosing the numbering direction. Alphabetical order can only resolve a tie after higher-priority criteria have been respected."));
  return { groups, fragment, label: language === "es" ? "Orden alfabético" : "Alphabetical order", paragraphs };
}
