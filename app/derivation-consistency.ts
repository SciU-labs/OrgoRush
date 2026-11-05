import type { AppLanguage } from "./i18n.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import { presentValidatedSystematicName, reconcileSystematicName } from "./validated-name-derivation.ts";

export type DerivationConsistencyStatus = "verified" | "unverified" | "profile-mismatch";

/** Resolves which already available structural proof applies to the active
 * name/profile. A localized Current presentation may reuse its exact source
 * proof; other profile/name fallbacks must reconcile independently. */
export function resolveDerivationConsistency(input: {
  molecule: GeneratedMolecule;
  activeName: string;
  activeProfile: "current" | "legacy";
  language: AppLanguage;
  currentSourceName?: string | null;
}): {
  status: DerivationConsistencyStatus;
  derivation: ValidatedNameDerivation | null;
  otherEvidence: ValidatedNameDerivation | null;
} {
  const activeDerivation = reconcileSystematicName(input.molecule, input.activeName);
  if (activeDerivation) return { status: "verified", derivation: activeDerivation, otherEvidence: null };

  const currentEvidence = input.currentSourceName
    ? reconcileSystematicName(input.molecule, input.currentSourceName) : null;
  if (currentEvidence && input.activeProfile === "current"
    && presentValidatedSystematicName(currentEvidence, input.language).name === input.activeName) {
    return { status: "verified", derivation: currentEvidence, otherEvidence: null };
  }
  if (currentEvidence) return { status: "profile-mismatch", derivation: null, otherEvidence: currentEvidence };
  return { status: "unverified", derivation: null, otherEvidence: null };
}
