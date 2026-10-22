import type { AppLanguage } from "./i18n.ts";
import type { NomenclatureConvention } from "./nomenclature-conventions.ts";

/** Export labels follow a verified selected Legacy name. Keep the existing
 * canonical metadata when Current is selected or no Legacy name is available. */
export function selectedNomenclatureExportName(input: {
  convention:NomenclatureConvention;displayedName:string;copyable:boolean;canonicalName:string;
}) {
  return input.convention!=="current"&&input.copyable?input.displayedName:input.canonicalName;
}

/** Resolves display text for Legacy without inventing historical names. */
export function legacyProfileDisplayName(input: {
  language: AppLanguage;
  suggestedName: string;
  spanish1979Name: string;
  english1979Name: string;
}) {
  if (input.language === "es" && input.spanish1979Name !== "-") {
    return { name: input.spanish1979Name, available: true };
  }
  if (input.language === "en" && input.english1979Name !== "-") {
    return { name: input.english1979Name, available: true };
  }

  return {
    name: input.language === "en" ? "Not available for this structure" : "No disponible para esta estructura",
    available: false,
  };
}
