/**
 * Post-archive adjudications for 1979 Spanish names that became locally
 * available after the frozen VALIDATION-008 matrix was captured. This file
 * does not rewrite that historical matrix or its expected-name source.
 * Each name is checked against the independently fixed structure/name case,
 * the 1979 parent/group rules, and the Spanish lexical reference in the case.
 */
export const VALIDATION_008_HOTFIX_ADJUDICATIONS = Object.freeze([
  {
    id: "V008-035",
    smiles: "O=CC=CCCC",
    expectedSpanish1979: "2-hexenal",
    expectedEnglish1979: "2-hexenal",
    ruleEvidence: ["historicalParent:C-13.11", "historicalNumbering:C-15.11", "historicalAldehyde:C-302.1", "historicalUnsaturation:A-3.1-4"],
    independentStructureEvidence: "OPSIN constitution witness plus frozen formula/connectivity oracle; OPSIN is not treated as historical-name authority.",
  },
  {
    id: "V008-043",
    smiles: "O=C(O)C=CCCC",
    expectedSpanish1979: "ácido 2-hexenoico",
    expectedEnglish1979: "2-hexenoic acid",
    ruleEvidence: ["historicalParent:C-13.11", "historicalNumbering:C-15.11", "historicalAcid:C-401.1", "historicalUnsaturation:A-3.1-4"],
    independentStructureEvidence: "OPSIN constitution witness plus frozen formula/connectivity oracle; OPSIN is not treated as historical-name authority.",
  },
  {
    id: "V008-059",
    smiles: "CCCC(=O)NCC",
    expectedSpanish1979: "N-etilbutanamida",
    expectedEnglish1979: "N-ethylbutanamide",
    ruleEvidence: ["historicalParent:C-13.11", "historicalNumbering:C-15.11", "historicalAmide:C-822.1", "historicalNAmide:C-824.1"],
    independentStructureEvidence: "OPSIN constitution witness plus frozen formula/connectivity oracle; OPSIN is not treated as historical-name authority.",
  },
  {
    id: "V008-065",
    smiles: "N#CC(O)CC",
    expectedSpanish1979: "2-hidroxibutanonitrilo",
    expectedEnglish1979: "2-hydroxybutanenitrile",
    ruleEvidence: ["historicalParent:C-13.11", "historicalNumbering:C-15.11", "historicalNitrile:C-832.1, C-832.5", "historicalAlcohol:C-201.1-2"],
    independentStructureEvidence: "OPSIN constitution witness plus frozen formula/connectivity oracle; OPSIN is not treated as historical-name authority.",
  },
]);
