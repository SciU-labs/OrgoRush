import assert from "node:assert/strict";
import test from "node:test";

import { chemicalNameRecord, isVerifiedRetainedName, pubChemAlternativeSynonymRecords } from "../app/chemical-name-records.ts";

test("chemical name records keep profile, source, language, verification, and PIN evidence separate", () => {
  const oldName = chemicalNameRecord({
    name: "2-metilbutano",
    category: "systematic-iupac-1979",
    language: "es",
    profile: "IUPAC 1979",
    source: "OrgoRush legacy engine",
    verification: "local-graph-generation",
    pinStatus: "not-verified",
  });
  assert.equal(oldName?.category, "systematic-iupac-1979");
  assert.equal(oldName?.profile, "IUPAC 1979");
  assert.equal(oldName?.source, "OrgoRush legacy engine");
  assert.equal(oldName?.verification, "local-graph-generation");
  assert.equal(oldName?.pinStatus, "not-verified");

  assert.equal(chemicalNameRecord({
    name: "2-methylbutane",
    category: "pin-2013",
    language: "en",
    profile: "IUPAC 2013",
    source: "PubChem IUPACName",
    verification: "exact-identity",
    pinStatus: "not-verified",
  }), null, "a PubChem IUPACName is not automatically evidence of PIN status");

  assert.equal(chemicalNameRecord({
    name: "2-methylbutane",
    category: "pin-2013",
    language: "en",
    profile: "IUPAC 1979",
    source: "Blue Book PIN record",
    verification: "source-only",
    pinStatus: "verified",
  }), null, "PIN classification is limited to the formal 2013 profile");
});

test("PubChem synonyms remain source-only alternatives with unclassified language", () => {
  assert.deepEqual(pubChemAlternativeSynonymRecords(["Dextrose"], 5793), [{
    name: "Dextrose",
    category: "alternative-synonym",
    language: "undetermined",
    profile: null,
    source: "PubChem synonyms for CID 5793",
    verification: "exact-identity",
    pinStatus: "not-applicable",
  }]);
});

test("retained-name classification stays limited to explicit Blue Book examples and does not infer PIN", () => {
  assert.equal(isVerifiedRetainedName("phenol", "en"), true);
  assert.equal(isVerifiedRetainedName("fenol", "es"), true);
  assert.equal(isVerifiedRetainedName("ethylene", "en", "IUPAC 1979"), true);
  assert.equal(isVerifiedRetainedName("etileno", "es", "IUPAC 1979"), true);
  assert.equal(isVerifiedRetainedName("acetylene", "en", "IUPAC 1979"), true);
  assert.equal(isVerifiedRetainedName("acetileno", "es", "IUPAC 1979"), true);
  assert.equal(isVerifiedRetainedName("ethylene", "en", "IUPAC 2013"), false,
    "a retained name in the 1979 profile does not imply retained or PIN status in 2013");
  assert.equal(isVerifiedRetainedName("acetylene", "en", "IUPAC 2013"), false);
  assert.equal(isVerifiedRetainedName("2-methylphenol", "en"), false, "a retained parent does not turn every derivative into a retained name");
  assert.equal(isVerifiedRetainedName("acetone", "en"), false, "a retained common name is not assumed from familiarity");
  const retained = chemicalNameRecord({
    name: "fenol",
    category: "retained",
    language: "es",
    profile: "IUPAC 2013",
    source: "Blue Book P-1 retained-name entry + graph-backed localization",
    verification: "structure-roundtrip",
    pinStatus: "not-verified",
  });
  assert.equal(retained?.pinStatus, "not-verified");
});
