import { createHash } from "node:crypto";

export const AUDIT_VERSION = "AUD-NOM-005-v1";
export const PROFILES = Object.freeze(["2013-es", "2013-en", "1979-es", "1979-en"]);
export const SAMPLE_QUOTAS = Object.freeze({
  alkanes: 3, alkenes: 3, alkynes: 3, "multi-unsaturated": 4,
  carbocycles: 4, aromatics: 4, halogenated: 3, "alcohols-polyols": 3,
  carbonyls: 3, "carboxylic-acids": 4, "ethers-esters": 4,
  "nitrogen-functions": 4, "mixed-functions": 4, "stereo-polycycles-limits": 4,
});

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateHistoricalInventory(records) {
  if (!Array.isArray(records) || records.length !== 440) throw new Error(`Expected exactly 440 historical records, got ${records?.length ?? "non-array"}`);
  const ids = records.map((record) => record.id);
  const unique = new Set(ids);
  if (unique.size !== 440) throw new Error(`Expected 440 unique IDs, got ${unique.size}`);
  for (let index = 0; index < 440; index++) {
    const expected = `AUDCASE-${String(index + 1).padStart(4, "0")}`;
    if (!unique.has(expected)) throw new Error(`Historical inventory is missing ${expected}`);
  }
  for (const record of records) {
    if (typeof record.smiles !== "string" || !record.smiles || typeof record.identity !== "string" || !record.family) {
      throw new Error(`Historical record ${record.id} is missing structure identity fields`);
    }
  }
  return { count: records.length, firstId: ids[0], lastId: ids.at(-1), uniqueIds: unique.size };
}

const COVERAGE_FEATURES = Object.freeze([
  "N-substitution", "diacid", "ester", "ether", "positional-isomer", "halogen",
  "branching", "multiple-unsaturations", "explicit-tetrahedral", "multiple-tetrahedral",
  "explicit-E", "explicit-Z", "multiple-EZ", "heterocycle-isomer", "functional-chain-versus-ring",
  "suffix-priority", "parent-selection", "ring-orientation", "connecting-vowel", "geminal",
]);

function structuralMarks(record) {
  const smiles = record.smiles;
  return {
    heteroatom: /[NOSPFClBrI]/.test(smiles),
    nitrogen: /N/.test(smiles),
    oxygen: /O/.test(smiles),
    sulfur: /S/.test(smiles),
    halogen: /Cl|Br|[FI]/.test(smiles),
    ring: /\d/.test(smiles),
    multipleBond: /[=#]/.test(smiles),
    multipleMultipleBonds: (smiles.match(/[=#]/g) ?? []).length > 1,
    charge: /[+-]/.test(smiles),
    isotope: /\[\d+[A-Z]/.test(smiles),
    tetrahedralStereo: /@/.test(smiles),
    doubleBondStereo: /[\\/]/.test(smiles),
    aromatic: /[bcnops]/.test(smiles),
    featureTags: [...(record.features ?? [])].sort(),
  };
}

function candidateHash(record) {
  return sha256(`${record.id}\n${record.family}\n${record.smiles}`).slice(0, 16);
}

// This selection deliberately reads only ID, family, feature tags, and SMILES.
// It never reads production names, OPSIN results, or naming assessments.
export function selectReferenceSample(records) {
  validateHistoricalInventory(records);
  const selected = [];
  const familySummaries = {};
  for (const [family, quota] of Object.entries(SAMPLE_QUOTAS)) {
    const pool = records.filter((record) => record.family === family).map((record) => ({
      id: record.id,
      family,
      smiles: record.smiles,
      marks: structuralMarks(record),
      features: [...(record.features ?? [])].sort(),
      _hash: candidateHash(record),
    }));
    if (pool.length < quota) throw new Error(`Sample quota ${quota} exceeds ${family} inventory (${pool.length})`);
    const familyChosen = [];
    const remaining = [...pool];
    const covered = new Set();
    while (familyChosen.length < quota) {
      remaining.sort((a, b) => {
        const marginal = (item) => item.features.filter((feature) => COVERAGE_FEATURES.includes(feature) && !covered.has(feature)).length;
        return marginal(b) - marginal(a) || a._hash.localeCompare(b._hash);
      });
      const [next] = remaining.splice(0, 1);
      familyChosen.push(next);
      for (const feature of next.features) if (COVERAGE_FEATURES.includes(feature)) covered.add(feature);
    }
    selected.push(...familyChosen.map(({ _hash, ...item }) => item));
    familySummaries[family] = { inventory: pool.length, quota, selectedIds: familyChosen.map((item) => item.id).sort() };
  }
  const ids = new Set(selected.map((item) => item.id));
  if (selected.length !== 50 || ids.size !== 50) throw new Error(`Reference sample must contain 50 unique records; got ${selected.length}/${ids.size}`);
  return {
    audit: AUDIT_VERSION,
    method: "Stratified before reading any production name; family quotas fixed in AUD-NOM-005-v1 and deterministic coverage of structure feature tags, then SHA-256 tie break.",
    namesWereRead: false,
    total: selected.length,
    quotas: { ...SAMPLE_QUOTAS },
    families: familySummaries,
    records: selected.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function classifyIndependentInterpretation(interpretation) {
  if (interpretation.status === "MATCH") return {
    status: "MATCH", constitution: interpretation.constitutionalMatch ? "MATCH" : "CONFLICT",
    stereochemistry: interpretation.constitutionalMatch ? "MATCH" : "NOT_MATCHED",
  };
  if (interpretation.status === "MISMATCH") return {
    status: "MISMATCH",
    constitution: interpretation.constitutionalMatch === false ? "MISMATCH" : "MATCH",
    stereochemistry: interpretation.constitutionalMatch ? "MISMATCH" : "NOT_ASSESSABLE",
  };
  if (["REJECTED", "UNVERIFIED", "UNSUPPORTED"].includes(interpretation.status)) return {
    status: interpretation.status, constitution: "UNVERIFIED", stereochemistry: "UNVERIFIED",
  };
  throw new Error(`Unknown structural interpretation status: ${interpretation.status}`);
}

export function classifyHistoricalDiscrepancy({ currentStatus, currentInterpretation, safeRejection }) {
  if (safeRejection === true && currentStatus === "UNSUPPORTED") return "RESOLVED_SAFE_REJECTION";
  if (currentStatus === "UNSUPPORTED") return "NEEDS_MANUAL_REVIEW";
  if (!currentInterpretation) return "UNVERIFIED_CURRENT_OUTPUT";
  if (currentInterpretation.status === "MATCH") return "RESOLVED_MATCH";
  if (currentInterpretation.status === "MISMATCH") return "STILL_MISMATCH";
  return "UNVERIFIED_CURRENT_OUTPUT";
}

export function summarizeCounts(rows, key, statuses) {
  const result = Object.fromEntries(statuses.map((status) => [status, 0]));
  for (const row of rows) {
    const status = key(row);
    result[status] = (result[status] ?? 0) + 1;
  }
  if (Object.values(result).reduce((sum, count) => sum + count, 0) !== rows.length) {
    throw new Error("Audit status totals do not reconcile");
  }
  return result;
}

export function validateBatch(batch, expectedIds, { planHash, sourceHash, harnessHash }) {
  if (batch.audit !== AUDIT_VERSION || batch.planHash !== planHash || batch.sourceHash !== sourceHash || batch.harnessHash !== harnessHash) {
    throw new Error("AUD-NOM-005 batch hash/version mismatch; preserving file and refusing mixed evidence");
  }
  const actualIds = batch.records.map((record) => record.id);
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error("AUD-NOM-005 batch IDs/order mismatch");
  }
  return true;
}
