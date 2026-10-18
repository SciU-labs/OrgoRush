import assert from "node:assert/strict";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { evidenceMap, interpretName } from "../evidence.mjs";
import { AUDIT_VERSION, PROFILES, classifyHistoricalDiscrepancy, classifyIndependentInterpretation, summarizeCounts, validateHistoricalInventory } from "./audit-core.mjs";

const output = new URL("../../../reports/naming-audit/aud-nom-005/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8"));
const atomic = (path, value) => {
  const temp = new URL(`${path.pathname.split("/").at(-1)}.tmp`, path);
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, path);
};

const historical = read("reports/naming-audit/audit-matrix.json");
const oldRecords = historical.records;
validateHistoricalInventory(oldRecords);
const current = JSON.parse(readFileSync(new URL("current-results.json", output), "utf8"));
const plan = JSON.parse(readFileSync(new URL("plan.json", output), "utf8"));
const expectedCases = read("reports/naming-audit/audit-cases.json");
const after004 = JSON.parse(readFileSync(new URL("../../../reports/naming-audit/aud-nom-004-after.json", import.meta.url), "utf8"));
const sources = [
  read("reports/naming-audit/opsin-evidence.json"),
  read("reports/naming-audit/aud-nom-003-opsin-evidence.json"),
  JSON.parse(readFileSync(new URL("sample-opsin-evidence.json", output), "utf8")),
  JSON.parse(readFileSync(new URL("rule-derived-candidate-receipts.json", output), "utf8")),
];
const receipts = new Map();
for (const source of sources) for (const [name, receipt] of evidenceMap(source)) {
  const previous = receipts.get(name);
  if (previous && previous.sha256 !== receipt.sha256) throw new Error(`Conflicting immutable receipt for ${name}`);
  if (!previous) receipts.set(name, receipt);
}
const currentById = new Map(current.records.map((record) => [record.id, record]));
const baselineById = new Map(oldRecords.map((record) => [record.id, record]));
const afterById = new Map(after004.records.map((record) => [record.id, record]));
const expectedById = new Map(expectedCases.records.map((record) => [record.id, record]));

const interpretationFor = (name, smiles, profile) => {
  if (!name) return { status: "UNSUPPORTED", reason: "No exact profile output" };
  if (!profile.endsWith("-en")) return { status: "UNVERIFIED", reason: "No independent Spanish-name oracle; no translation proxy is used" };
  return interpretName(name, smiles, receipts);
};
const exactReferenceFor = (record, profile, name) => {
  const sourceRecord = expectedById.get(record.id);
  const expected = sourceRecord?.expected?.[profile];
  if (!expected) return { status: "NO_EXACT_REFERENCE" };
  const review = sourceRecord.review;
  return {
    status: name === expected ? "EXACT_MATCH" : "EXACT_MISMATCH",
    expected,
    evidenceLevel: sourceRecord.evidenceLevel,
    derivation: review?.derivation ?? null,
    sources: review?.sources ?? [],
  };
};

const sampleRows = plan.referenceSample.records.map((selection) => {
  const evaluated = currentById.get(selection.id);
  const original = baselineById.get(selection.id);
  assert.ok(evaluated && original, `sample ID not found: ${selection.id}`);
  const profiles = Object.fromEntries(PROFILES.map((profile) => {
    const name = evaluated.profiles[profile].name;
    const rawInterpretation = interpretationFor(name, evaluated.smiles, profile);
    const structural = classifyIndependentInterpretation(rawInterpretation);
    const exactReference = exactReferenceFor(evaluated.currentEvaluation, profile, name);
    const normative = exactReference.status === "EXACT_MATCH"
      ? { status: "RULE_DERIVED_EXACT_REFERENCE_MATCH", detail: "Individual expected form is backed by the recorded rule derivation and source links; this does not establish preferred status beyond that derivation." }
      : exactReference.status === "EXACT_MISMATCH"
        ? { status: "RULE_DERIVED_EXACT_REFERENCE_MISMATCH", detail: "Observed text differs from the individually rule-derived expectation." }
        : { status: "UNADJUDICATED", detail: "No name-specific normative source review for this profile; OPSIN is structural evidence only." };
    return [profile, {
      availability: evaluated.profiles[profile].status,
      name,
      structuralInterpretation: rawInterpretation,
      structuralClassification: structural,
      exactReference,
      normative,
      historicalName: original.profiles[profile].name,
    }];
  }));
  return {
    id: selection.id, family: selection.family, smiles: selection.smiles, features: selection.features,
    structureOnlyMarks: selection.marks,
    structuralIdentity: evaluated.historicalIdentity,
    importExport: evaluated.editable,
    profiles,
  };
});

const historicalDiscrepancies = [];
for (const prior of oldRecords) for (const profile of ["2013-en", "1979-en"]) {
  const oldInterpretation = prior.profiles[profile]?.structuralNameInterpretation;
  if (oldInterpretation?.status !== "MISMATCH") continue;
  const now = currentById.get(prior.id);
  const currentProfile = now.profiles[profile];
  const currentInterpretation = interpretationFor(currentProfile.name, prior.smiles, profile);
  const exactStatus = classifyHistoricalDiscrepancy({
    currentStatus: currentProfile.status,
    currentInterpretation,
    safeRejection: now.safeRejection,
  });
  historicalDiscrepancies.push({
    id: prior.id,
    family: prior.family,
    smiles: prior.smiles,
    profile,
    oldName: prior.profiles[profile].name,
    oldOpsinInterpretation: {
      status: oldInterpretation.status,
      interpretedSmiles: oldInterpretation.interpretedSmiles ?? null,
      constitutionalMatch: oldInterpretation.constitutionalMatch ?? false,
      receiptSha256: oldInterpretation.receiptSha256 ?? null,
      origin: oldInterpretation.origin ?? null,
      retrievedAt: oldInterpretation.retrievedAt ?? null,
    },
    currentName: currentProfile.name,
    currentAvailability: currentProfile.status,
    currentOpsinInterpretation: currentInterpretation,
    classification: exactStatus,
    reason: exactStatus === "RESOLVED_SAFE_REJECTION" ? "AUD-NOM-002 explicitly rejects this isotope to preserve identity."
      : exactStatus === "NEEDS_MANUAL_REVIEW" ? currentProfile.status === "UNSUPPORTED"
        ? now.currentEvaluation.profiles[profile]?.unsupportedReason ?? "Current naming gate leaves no output; safe-rejection status is not established."
        : "No independent current interpretation." : undefined,
  });
}
assert.equal(historicalDiscrepancies.length, 51, `expected 51 historical English discrepancies, got ${historicalDiscrepancies.length}`);
const discrepancyCounts = summarizeCounts(historicalDiscrepancies, (row) => row.classification,
  ["RESOLVED_MATCH", "RESOLVED_SAFE_REJECTION", "STILL_MISMATCH", "UNVERIFIED_CURRENT_OUTPUT", "NEEDS_MANUAL_REVIEW"]);

const nameChanges = [];
const latestSnapshotDifferences = [];
const audited004Changes = new Set(after004.differences.map(({ id, profile }) => `${id}/${profile}`));
for (const now of current.records) {
  const old = baselineById.get(now.id);
  const latest = afterById.get(now.id);
  for (const profile of PROFILES) {
    const previousName = old.profiles[profile]?.name ?? null;
    const currentName = now.profiles[profile]?.name ?? null;
    const expectedAfter = latest.names?.[profile] ?? null;
    if (currentName !== expectedAfter) latestSnapshotDifferences.push({ id: now.id, profile, currentName, AUDNOM004Name: expectedAfter });
    if (previousName === currentName) continue;
    const status = audited004Changes.has(`${now.id}/${profile}`) ? "DOCUMENTED_AUDNOM004_CORRECTION"
      : now.safeRejection ? "DOCUMENTED_AUDNOM002_SAFE_ISOTOPE_REJECTION"
        : exactReferenceFor(now.currentEvaluation, profile, currentName).status === "EXACT_MATCH" ? "MATCHES_RULE_DERIVED_EXACT_REFERENCE"
          : "CHANGE_MATCHES_AUDNOM004_SNAPSHOT; EARLIER_ATTRIBUTION_REQUIRES_REVIEW";
    nameChanges.push({ id: now.id, family: now.family, profile, smiles: now.smiles, beforeAUDNOM001: previousName,
      current: currentName, availability: now.profiles[profile].status, status });
  }
}

const profileTotals = Object.fromEntries(PROFILES.map((profile) => {
  const rows = current.records.map((record) => record.profiles[profile]);
  const structural = current.records.map((record) => {
    const row = record.profiles[profile];
    return interpretationFor(row.name, record.smiles, profile).status;
  });
  const exact = current.records.map((record) => record.currentEvaluation.profiles[profile].exact);
  return [profile, {
    availability: summarizeCounts(rows, (row) => row.status, ["NAMED", "UNSUPPORTED", "ERROR"]),
    structuralInterpretations: summarizeCounts(structural, (status) => status, ["MATCH", "MISMATCH", "REJECTED", "UNVERIFIED", "UNSUPPORTED"]),
    exactReference: summarizeCounts(exact, (status) => status, ["PASS", "FAIL", "UNVERIFIED", "UNSUPPORTED"]),
  }];
}));

const properties = {};
for (const record of current.records) for (const [property, observation] of Object.entries(record.currentEvaluation.properties)) {
  const status = observation?.status ?? "NOT_ASSESSED";
  properties[property] ??= {};
  properties[property][status] = (properties[property][status] ?? 0) + 1;
}
const signalRows = current.records.flatMap((record) => record.currentEvaluation.signals.map((signal) => ({ id: record.id, smiles: record.smiles, ...signal })));
const reviewedSignals = signalRows.map((signal) => ({
  ...signal,
  auditDisposition: signal.code === "ANALYSIS_BOND_LOCANT" && current.records.find((record) => record.id === signal.id)?.currentEvaluation.profiles?.["2013-en"]?.analysis?.family === "aromatic"
    ? "AUDITOR_FALSE_POSITIVE_AROMATIC_KEKULE_CLOSURE"
    : "REQUIRES_MANUAL_REVIEW",
  evidence: signal.code === "ANALYSIS_BOND_LOCANT" ? "The inherited helper assumes only family=cycloalkane is cyclic. Aromatic Kekulé locants are not constitutional double-bond locants; the displayed explanation is audited separately against actual atoms and bonds." : signal.evidence,
}));

const receiptCoverage = {
  validatedReceiptNames: receipts.size,
  sample: {
    structures: sampleRows.length,
    outputs: sampleRows.reduce((count, row) => count + Object.values(row.profiles).filter((profile) => profile.availability === "NAMED").length, 0),
    independentlyMatchedEnglishOutputs: sampleRows.reduce((count, row) => count + ["2013-en", "1979-en"].filter((profile) => row.profiles[profile].name && row.profiles[profile].structuralInterpretation.status === "MATCH").length, 0),
    parserRejections: sampleRows.flatMap((row) => ["2013-en", "1979-en"].map((profile) => row.profiles[profile])).filter((profile) => profile.name && profile.structuralInterpretation.status === "REJECTED").length,
    exactRuleDerivedOutputs: sampleRows.reduce((count, row) => count + Object.values(row.profiles).filter((profile) => profile.exactReference.status === "EXACT_MATCH").length, 0),
    namedWithoutExactNormativeReference: sampleRows.reduce((count, row) => count + Object.values(row.profiles).filter((profile) => profile.availability === "NAMED" && profile.normative.status === "UNADJUDICATED").length, 0),
    unsupportedWithoutOutput: sampleRows.reduce((count, row) => count + Object.values(row.profiles).filter((profile) => profile.availability === "UNSUPPORTED").length, 0),
  },
};

atomic(new URL("sample-current-interpretations.json", output), {
  audit: AUDIT_VERSION, selectedFromStructuresOnly: true, source: "OPSIN exact-text responses; stored receipts hash-validated offline", receiptCoverage, records: sampleRows,
});
atomic(new URL("historical-discrepancies-51.json", output), {
  audit: AUDIT_VERSION, source: "AUD-NOM-001 audit-matrix.json; 51 originally MISMATCH English outputs, not presumed current", counts: discrepancyCounts, records: historicalDiscrepancies,
});
atomic(new URL("historical-name-comparison.json", output), {
  audit: AUDIT_VERSION, baseline: "AUD-NOM-001 audit-matrix.json", currentSnapshot: "AUD-NOM-004-after.json",
  currentToAUDNOM004Differences: latestSnapshotDifferences, baselineDifferences: nameChanges,
});
atomic(new URL("property-summary.json", output), { audit: AUDIT_VERSION, totalStructures: current.records.length, profiles: profileTotals, properties, signalReview: reviewedSignals });
const ruleCandidates = JSON.parse(readFileSync(new URL("rule-derived-candidate-receipts.json", output), "utf8")).evaluated;
atomic(new URL("rule-derived-candidates.json", output), {
  audit: AUDIT_VERSION,
  method: "Expected forms fixed from cited IUPAC rules before comparing to current output; OPSIN is used only to independently interpret candidate strings against the input structure.",
  candidates: ruleCandidates,
});
atomic(new URL("findings.json", output), {
  audit: AUDIT_VERSION,
  findings: [{
    id: "AUDNOM-012", severity: "P2", status: "CONFIRMED_IN_TWO_CASES",
    title: "Modern English outputs retain Spanish substituent morphology",
    cases: ["AUDCASE-0160", "AUDCASE-0337"],
    evidence: [
      { id: "AUDCASE-0160", smiles: "c1(C=C)ccc(Cl)cc1", profiles: {
        "2013-en": { observed: "1-chloro4-vinilbenzene", expectedRuleDerived: "1-chloro-4-ethenylbenzene", observedOpsin: "REJECTED", expectedOpsin: "MATCH", reference: "https://iupac.qmul.ac.uk/BlueBook/P1.html (P-12.3, P-14.4, P-14.5.2); https://iupac.qmul.ac.uk/BlueBook/P5.html" },
        "1979-en": { observed: "1-chloro-4-vinilbenzene", expectedRuleDerived: null, observedOpsin: "REJECTED", expectedOpsin: "MATCH", reference: null, note: "English/Spanish morphology leakage is visible; no exact 1979 name is claimed from the 2013 rule." },
      }, rule: "P-12.3 identifies ethenylbenzene as a PIN form; apply the halogen prefix and complete locants. Candidate exact string independently matches the input structure in OPSIN." },
      { id: "AUDCASE-0337", smiles: "CCCCCC(C)OCCCCC", profiles: {
        "2013-en": { observed: "2-pentoxiheptane", expectedRuleDerived: "2-pentyloxyheptane", observedOpsin: "REJECTED", expectedOpsin: "MATCH", reference: "https://iupac.qmul.ac.uk/BlueBook/P6.html (P-63.2.2.1.1, P-63.2.4)" },
        "1979-en": { observed: "2-pentoxiheptane", expectedRuleDerived: null, observedOpsin: "REJECTED", expectedOpsin: "MATCH", reference: null, note: "Spanish morphology is visible; no exact 1979 name is claimed from the 2013 rule." },
      }, rule: "P-63.2.2.1.1 forms oxy substituent prefixes by concatenation and gives pentyloxy as the worked C5 form; P-63.2.4 permits substitutive ether nomenclature. Candidate exact string independently matches the input structure in OPSIN." },
    ],
    expectedName: null,
    causeHypothesis: "The English output path appears to reuse Spanish vinil/pentoxi morphology; the modern aryl form also omits the separator before locant 4. This is localized to language formatting, but not yet to a single function. Structural identity remains intact.",
    impact: "P2 terminology and exact-name usability in 2013 EN. OPSIN rejection of observed strings supports parser incompatibility, while the independent Blue Book derivation plus OPSIN MATCH of each candidate supports the specific modern expectation. The same 2013 expectation is not imposed on Legacy 1979.",
    proposedRegression: "Assert exact rule-derived modern English forms for both structures and independent candidate interpretation; preserve separate Legacy expectations until supported by historical evidence.",
  }],
});

const reportManifestPath = new URL("manifest.json", output);
const manifest = JSON.parse(readFileSync(reportManifestPath, "utf8"));
manifest.adjudicatedAt = new Date().toISOString();
manifest.historicalDiscrepancyCounts = discrepancyCounts;
manifest.baselineNameChanges = nameChanges.length;
manifest.currentToAUDNOM004Differences = latestSnapshotDifferences.length;
manifest.selectedReferenceCoverage = receiptCoverage.sample;
manifest.signalCount = signalRows.length;
manifest.unreviewedSignalCount = reviewedSignals.filter((row) => row.auditDisposition === "REQUIRES_MANUAL_REVIEW").length;
atomic(reportManifestPath, manifest);
console.log(JSON.stringify({
  historicalDiscrepancies: discrepancyCounts,
  changedNameProfiles: nameChanges.length,
  currentToAUDNOM004Differences: latestSnapshotDifferences.length,
  profileTotals,
  receiptCoverage,
  signals: reviewedSignals,
  propertyTotals: properties,
}));
