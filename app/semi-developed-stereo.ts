import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { getTetrahedralStereoCenters, type TetrahedralStereoCenter } from "./tetrahedral-stereochemistry.ts";

export const SEMI_DEVELOPED_STEREO_STORAGE_KEY = "hydrocarbonLab.semiDevelopedStereoDisplay.v1";
export const DEFAULT_SEMI_DEVELOPED_STEREO_DISPLAY = "labels";
export type SemiDevelopedStereoDisplay = "hidden" | "labels";

// Advanced bonds are deliberately unavailable until label clipping and all
// carrier geometries can be certified. Unsupported saved values recover labels.
export function normalizeSemiDevelopedStereoDisplay(value: unknown): SemiDevelopedStereoDisplay {
  return value === "hidden" ? "hidden" : DEFAULT_SEMI_DEVELOPED_STEREO_DISPLAY;
}

export function readSemiDevelopedStereoDisplay(storage?: Pick<Storage, "getItem">): SemiDevelopedStereoDisplay {
  try { return normalizeSemiDevelopedStereoDisplay(storage?.getItem(SEMI_DEVELOPED_STEREO_STORAGE_KEY)); }
  catch { return DEFAULT_SEMI_DEVELOPED_STEREO_DISPLAY; }
}

export function writeSemiDevelopedStereoDisplay(value: SemiDevelopedStereoDisplay, storage?: Pick<Storage, "setItem">) {
  try { storage?.setItem(SEMI_DEVELOPED_STEREO_STORAGE_KEY, normalizeSemiDevelopedStereoDisplay(value)); }
  catch { /* A blocked storage backend must not disable the session preference. */ }
}

export function getSemiDevelopedStereoCenters(
  molecule: GeneratedMolecule,
  viewMode: string,
  stereochemistryEnabled: boolean,
  display: SemiDevelopedStereoDisplay,
): TetrahedralStereoCenter[] {
  return viewMode === "semi-developed" && stereochemistryEnabled && display === "labels"
    ? getTetrahedralStereoCenters(molecule) : [];
}

export function semiDevelopedStereoAccessibleLabel(
  center: TetrahedralStereoCenter,
  language: "es" | "en",
  locant?: number,
) {
  const reference = Number.isInteger(locant) && locant! > 0
    ? (language === "en" ? `Carbon ${locant}` : `Carbono ${locant}`)
    : (language === "en" ? `Atom ID ${center.atomId}` : `Átomo ID ${center.atomId}`);
  return language === "en" ? `${reference}, ${center.configuration} configuration`
    : `${reference}, configuración ${center.configuration}`;
}
