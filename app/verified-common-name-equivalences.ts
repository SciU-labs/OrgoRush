type VerifiedCommonNameEquivalence = {
  aliases: readonly string[];
  pubChemQuery: string;
  inchiKey: string;
  cid?: number;
  formula?: string;
  referenceSmiles?: string;
};

// These are exact bilingual synonym sets pinned to a PubChem identity. They
// are deliberately not fuzzy translations: a fallback query is accepted only
// when PubChem returns the registered InChIKey.
const VERIFIED_COMMON_NAME_EQUIVALENCES: readonly VerifiedCommonNameEquivalence[] = [
  {
    aliases: ["alcohol isopropílico", "alcohol isopropilico", "isopropyl alcohol"],
    pubChemQuery: "isopropyl alcohol",
    inchiKey: "KFZMGEQAYNKOFK-UHFFFAOYSA-N",
  },
  {
    aliases: ["glicerina", "glicerol", "glycerin", "glycerol"],
    pubChemQuery: "glycerol",
    inchiKey: "PEDCQBHIVMGVHV-UHFFFAOYSA-N",
  },
  {
    aliases: ["testosterona", "testosterone"],
    pubChemQuery: "testosterone",
    inchiKey: "MUMGGOZAMZWBJJ-DYKIIFRCSA-N",
  },
  {
    aliases: ["colesterol", "cholesterol"],
    pubChemQuery: "cholesterol",
    inchiKey: "HVYWMOMLDIMFJA-DPAQBDIFSA-N",
  },
  {
    aliases: [
      "aspirina", "aspirin", "ácido acetilsalicílico", "acido acetilsalicilico",
      "acetylsalicylic acid", "2-acetyloxybenzoic acid", "2-(acetyloxy)benzoic acid",
    ],
    pubChemQuery: "aspirin",
    inchiKey: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
    cid: 2244,
    formula: "C9H8O4",
    referenceSmiles: "CC(=O)Oc1ccccc1C(=O)O",
  },
];

const VERIFIED_PUBCHEM_COMMON_NAMES = [
  {
    cid: 681,
    inchiKey: "VYFYYTLLBUKUHU-UHFFFAOYSA-N",
    names: { es: "Dopamina", en: "Dopamine" },
  },
  {
    cid: 3345,
    inchiKey: "PJMPHNIQZUBGLI-UHFFFAOYSA-N",
    names: { es: "Fentanilo", en: "Fentanyl" },
  },
  {
    cid: 5816,
    inchiKey: "UCTWMZQNUQWSLP-VIFPVBQESA-N",
    names: { es: "Adrenalina", en: "Epinephrine" },
  },
  {
    cid: 439260,
    inchiKey: "SFLSHLFXELFNJZ-QMMMGPOBSA-N",
    names: { es: "Noradrenalina", en: "Norepinephrine" },
  },
  {
    cid: 5202,
    inchiKey: "QZAYGJVTTNCVMB-UHFFFAOYSA-N",
    names: { es: "Serotonina", en: "Serotonin" },
  },
  {
    cid: 1983,
    inchiKey: "RZVAJINKPMORJF-UHFFFAOYSA-N",
    names: { es: "Paracetamol", en: "Acetaminophen" },
  },
  {
    cid: 2244,
    inchiKey: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
    names: { es: "Aspirina", en: "Aspirin" },
  },
  {
    cid: 3672,
    inchiKey: "HEFNNWSXXWATRW-UHFFFAOYSA-N",
    names: { es: "Ibuprofeno", en: "Ibuprofen" },
  },
  {
    cid: 180,
    inchiKey: "CSCPPACGZOOCGX-UHFFFAOYSA-N",
    names: { es: "Acetona", en: "Acetone" },
  },
  {
    cid: 2519,
    inchiKey: "RYYVLZVUVIJVGH-UHFFFAOYSA-N",
    names: { es: "Cafeína", en: "Caffeine" },
  },
  {
    cid: 3676,
    inchiKey: "NNJVILVZKWQKPM-UHFFFAOYSA-N",
    names: { es: "Lidocaína", en: "Lidocaine" },
  },
  {
    cid: 1183,
    inchiKey: "MWOOGOJBHIARFG-UHFFFAOYSA-N",
    names: { es: "Vainillina", en: "Vanillin" },
  },
  {
    cid: 753,
    inchiKey: "PEDCQBHIVMGVHV-UHFFFAOYSA-N",
    names: { es: "Glicerina", en: "Glycerol" },
  },
  {
    cid: 5280343,
    inchiKey: "REFJWTPEDVJJIY-UHFFFAOYSA-N",
    names: { es: "Quercetina", en: "Quercetin" },
  },
  {
    cid: 5280961,
    inchiKey: "TZBJGXHYKVUXJN-UHFFFAOYSA-N",
    names: { es: "Genisteína", en: "Genistein" },
  },
  {
    cid: 750,
    inchiKey: "DHMQDGOQFOQNFH-UHFFFAOYSA-N",
    names: { es: "Glicina", en: "Glycine" },
  },
  {
    cid: 5950,
    inchiKey: "QNAYBMKLOCPYGJ-REOHCLBHSA-N",
    names: { es: "L-alanina", en: "L-Alanine" },
  },
  {
    cid: 6057,
    inchiKey: "OUYCCCASQSFEME-QMMMGPOBSA-N",
    names: { es: "L-tirosina", en: "L-Tyrosine" },
  },
  {
    cid: 6106,
    inchiKey: "ROHFNLRQFUQHCH-YFKPBYRVSA-N",
    names: { es: "L-leucina", en: "L-Leucine" },
  },
  {
    cid: 564,
    inchiKey: "SLXKOJJOQWFEFD-UHFFFAOYSA-N",
    names: { es: "Ácido aminocaproico", en: "Aminocaproic acid" },
  },
  {
    cid: 5793,
    inchiKey: "WQZGKKKJIJFFOK-GASJEMHNSA-N",
    names: { es: "D-glucosa", en: "D-Glucose" },
  },
  {
    cid: 8376,
    inchiKey: "SPSSULHKWOKEEL-UHFFFAOYSA-N",
    names: { es: "TNT · 2,4,6-trinitrotolueno", en: "TNT · 2,4,6-trinitrotoluene" },
  },
] as const;

const VERIFIED_PUBCHEM_ALTERNATIVE_SYNONYMS = [
  {
    cid: 5793,
    inchiKey: "WQZGKKKJIJFFOK-GASJEMHNSA-N",
    names: ["D-glucose", "Dextrose"],
  },
  {
    cid: 8376,
    inchiKey: "SPSSULHKWOKEEL-UHFFFAOYSA-N",
    names: ["TNT", "2,4,6-trinitrotoluene", "2,4,6-trinitrotolueno"],
  },
] as const;

const VERIFIED_PUBCHEM_RECORD_EQUIVALENCES = [
  {
    cid: 5793,
    inchiKey: "WQZGKKKJIJFFOK-GASJEMHNSA-N",
    names: ["D-glucosa", "D-Glucose"],
  },
  {
    cid: 1140,
    inchiKey: "YXFVVABEGXRONW-UHFFFAOYSA-N",
    names: ["tolueno", "Toluene"],
  },
  {
    cid: 8376,
    inchiKey: "SPSSULHKWOKEEL-UHFFFAOYSA-N",
    names: ["TNT", "2,4,6-trinitrotolueno", "2,4,6-trinitrotoluene"],
  },
] as const;

/** Localized display text only for an exact PubChem compound identity. */
export function verifiedPubChemSystematicDisplayName(
  identity: { cid?: number; inchiKey?: string },
  language: "es" | "en",
) {
  if (identity.cid !== 8376 || identity.inchiKey?.trim().toLocaleUpperCase("en") !== "SPSSULHKWOKEEL-UHFFFAOYSA-N") {
    return null;
  }
  return language === "es" ? "2-metil-1,3,5-trinitrobenceno" : "2-methyl-1,3,5-trinitrobenzene";
}

function normalizeExactAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

export function verifiedCommonNameQuery(value: string) {
  const normalized = normalizeExactAlias(value);
  const equivalence = VERIFIED_COMMON_NAME_EQUIVALENCES.find(({ aliases }) =>
    aliases.some((alias) => normalizeExactAlias(alias) === normalized),
  );
  return equivalence
    ? {
      query: equivalence.pubChemQuery,
      expectedInchiKey: equivalence.inchiKey,
      ...(equivalence.cid ? { expectedCid: equivalence.cid } : {}),
      ...(equivalence.formula ? { expectedFormula: equivalence.formula } : {}),
      ...(equivalence.referenceSmiles ? { referenceSmiles: equivalence.referenceSmiles } : {}),
    }
    : null;
}

/** Exact biochemical display names; both CID and stereochemical InChIKey must match. */
export function verifiedPubChemCommonName(
  identity: { cid?: number; inchiKey?: string },
  language: "es" | "en",
) {
  const inchiKey = identity.inchiKey?.trim().toLocaleUpperCase("en");
  const match = VERIFIED_PUBCHEM_COMMON_NAMES.find((entry) =>
    identity.cid === entry.cid && inchiKey === entry.inchiKey,
  );
  return match?.names[language] ?? null;
}

/** Returns only synonyms explicitly reviewed for the exact PubChem structure and stereochemical identity. */
export function verifiedPubChemAlternativeSynonyms(
  identity: { cid?: number; inchiKey?: string },
  pubChemSynonyms: readonly string[],
) {
  const inchiKey = identity.inchiKey?.trim().toLocaleUpperCase("en");
  const entry = VERIFIED_PUBCHEM_ALTERNATIVE_SYNONYMS.find(candidate =>
    identity.cid === candidate.cid && inchiKey === candidate.inchiKey);
  if (!entry) return [];
  const returnedNames = new Set(pubChemSynonyms.map(normalizeExactAlias));
  return entry.names.filter(name => returnedNames.has(normalizeExactAlias(name)));
}

/** Identifies bilingual aliases only for the exact known PubChem structure. */
export function verifiedPubChemRecordTitleEquivalent(
  identity: { cid?: number; inchiKey?: string },
  recordTitle: string | undefined,
  displayedName: string | null | undefined,
) {
  if (!recordTitle || !displayedName) return false;
  const inchiKey = identity.inchiKey?.trim().toLocaleUpperCase("en");
  if (!inchiKey) return false;
  return VERIFIED_PUBCHEM_RECORD_EQUIVALENCES.some((entry) =>
    identity.cid === entry.cid
    && inchiKey === entry.inchiKey
    && entry.names.some((name) => normalizeExactAlias(name) === normalizeExactAlias(recordTitle))
    && displayedName.split(" · ").some((alias) =>
      entry.names.some((name) => normalizeExactAlias(name) === normalizeExactAlias(alias))),
  );
}
