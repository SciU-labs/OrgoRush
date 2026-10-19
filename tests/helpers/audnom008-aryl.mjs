import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evidenceMap, interpretName } from "../../scripts/naming-audit/evidence.mjs";

// Texts adjudicated from the sources in aud-nom-008-aryl-substitution.md before implementation.
// ES forms use the Spanish RSEQ/IUPAC grammar, not the application's translator as an oracle.
export const methylPhenylCases = [
  { id: "AUDCASE-0171", smiles: "c1(CCO)c(C)cccc1", kekule: "C1(CCO)=C(C)C=CC=C1", ringLocant: 2,
    es: "2-(2-metilfenil)etan-1-ol", en: "2-(2-methylphenyl)ethan-1-ol" },
  { id: "meta-control", smiles: "c1(CCO)cc(C)ccc1", kekule: "C1(CCO)=CC(C)=CC=C1", ringLocant: 3,
    es: "2-(3-metilfenil)etan-1-ol", en: "2-(3-methylphenyl)ethan-1-ol" },
  { id: "AUDCASE-0176", smiles: "c1(CCO)ccc(C)cc1", kekule: "C1(CCO)=CC=C(C)C=C1", ringLocant: 4,
    es: "2-(4-metilfenil)etan-1-ol", en: "2-(4-methylphenyl)ethan-1-ol" },
];
export const arylReceiptDocument = JSON.parse(readFileSync(new URL(
  "../../reports/naming-audit/aud-nom-008/opsin-receipts.json", import.meta.url), "utf8"));
export const arylReceipts = evidenceMap(arylReceiptDocument);

/** Replaces an obsolete blanket rejection with exact names plus the same safety contract. */
export function assertValidatedArylProfiles(profiles, fixture) {
  assert.ok(fixture, "independently adjudicated aryl fixture exists");
  assert.equal(profiles["2013-es"].name, fixture.es);
  assert.equal(profiles["2013-en"].name, fixture.en);
  assert.equal(profiles["1979-es"].name, null, "exact Legacy Spanish wording remains unadjudicated");
  assert.equal(profiles["1979-en"].name, null, "exact Legacy English wording remains unadjudicated");
  assert.equal(interpretName(fixture.en, fixture.smiles, arylReceipts).status, "MATCH",
    "exact rule-derived English name retains full independent structural identity");
  assert.doesNotMatch(profiles["2013-en"].name, /^2-phenylethan/,
    "a methyl-substituted ring must never return the incomplete bare-phenyl output");
}
