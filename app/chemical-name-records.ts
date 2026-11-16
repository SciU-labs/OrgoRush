export type ChemicalNameCategory =
  | "common"
  | "retained"
  | "systematic-iupac-1979"
  | "systematic-iupac-2013"
  | "pin-2013"
  | "alternative-synonym";

export type ChemicalNameRecord = {
  name: string;
  category: ChemicalNameCategory;
  language: "es" | "en" | "undetermined";
  profile: "IUPAC 1979" | "IUPAC 2013" | null;
  source: string;
  verification: "exact-identity" | "structure-roundtrip" | "local-graph-generation" | "source-only";
  pinStatus: "verified" | "not-verified" | "not-applicable";
};

const retainedNamePairs = new Set([
  "IUPAC 2013:en:methane", "IUPAC 2013:es:metano",
  "IUPAC 2013:en:phenol", "IUPAC 2013:es:fenol",
  "IUPAC 2013:en:acetic acid", "IUPAC 2013:es:ácido acético",
  "IUPAC 1979:en:ethylene", "IUPAC 1979:es:etileno",
  "IUPAC 1979:en:acetylene", "IUPAC 1979:es:acetileno",
]);

/** Profile-scoped retained forms supported by the cited historical rules.
 * This check never establishes PIN status; Spanish forms are localized display
 * names and are not represented as independently recommended retained names.
 */
export function isVerifiedRetainedName(name: string, language: "es" | "en", profile: "IUPAC 1979" | "IUPAC 2013" = "IUPAC 2013") {
  const normalized = name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase(language);
  return retainedNamePairs.has(`${profile}:${language}:${normalized}`);
}

export function chemicalNameRecord(record: ChemicalNameRecord): ChemicalNameRecord | null {
  const name = record.name.trim();
  if (!name || !record.source.trim()) return null;
  if (record.category === "pin-2013" && (record.profile !== "IUPAC 2013" || record.pinStatus !== "verified")) return null;
  if (record.category === "systematic-iupac-1979" && record.profile !== "IUPAC 1979") return null;
  if (record.category === "systematic-iupac-2013" && record.profile !== "IUPAC 2013") return null;
  if (record.category === "alternative-synonym" && (record.profile !== null || record.pinStatus !== "not-applicable")) return null;
  return { ...record, name };
}

export function pubChemAlternativeSynonymRecords(names: readonly string[], cid: number) {
  return names.flatMap((name) => {
    const record = chemicalNameRecord({
      name,
      category: "alternative-synonym",
      language: "undetermined",
      profile: null,
      source: `PubChem synonyms for CID ${cid}`,
      verification: "exact-identity",
      pinStatus: "not-applicable",
    });
    return record ? [record] : [];
  });
}
