// Adjudication AFTER the blind comparison. Original expected names stay fixed.
// No production name is accepted merely because OrgoRush emits it.
export const NAME_REVIEWS = {
  "V008-020": {
    "2013-es": { observed: "ciclohept-1-eno", verdict: "ACCEPTED_GENERAL_NAME", references: ["modernSyntax", "historicalRings"],
      reason: "Explicit locant 1 describes the same unique C=C in this unsubstituted ring. General unambiguous nomenclature accepted; PIN would omit 1 under P-14.3.4.2(d)." },
    "1979-en": { observed: "1-cycloheptene", verdict: "ACCEPTED_GENERAL_NAME", references: ["historicalRings"],
      reason: "A-11.3 supplies lowest multiple-bond locants; explicit 1 is constitutionally unambiguous. Independent OPSIN witness required, not a PIN assertion." },
    "1979-es": { observed: "1-ciclohepteno", verdict: "ACCEPTED_GENERAL_NAME", references: ["historicalRings", "spanishLexicon"],
      reason: "Independent application of the same A-11.3 construction and Spanish -eno vocabulary; explicit 1 does not change constitution." },
  },
  "V008-030": { "2013-es": { observed: "butan-1,3-diol", verdict: "FAIL-NAME", severity: "P2", code: "SPANISH_MULTIPLICATIVE_ELISION", references: ["spanishLexicon", "modernSyntax"],
    reason: "Spanish parent -o is retained before diol: RSEQ prints etano-1,2-diol (§6b). P-16.7 elides the terminal parent vowel before vowel-initial suffixes, not before d. Independent reference remains butano-1,3-diol." } },
  "V008-038": { "2013-es": { observed: "heptan-2,5-diona", verdict: "FAIL-NAME", severity: "P2", code: "SPANISH_MULTIPLICATIVE_ELISION", references: ["spanishLexicon", "modernSyntax"],
    reason: "Missing parent -o before diona. RSEQ §4 explicitly prints a heptano-2,4-diona example. Independent reference remains heptano-2,5-diona." } },
  "V008-056": { "2013-es": { observed: "hexan-1,6-diamina", verdict: "FAIL-NAME", severity: "P2", code: "SPANISH_MULTIPLICATIVE_ELISION", references: ["spanishLexicon", "modernSyntax", "modernFunctions"],
    reason: "Same inappropriate elision before consonant-initial diamina; preserve Spanish parent hexano. P-16.7 and RSEQ parent/suffix vocabulary, independently applied." } },
  "V008-070": { "2013-es": { observed: "3-etilpentan-1,5-diol", verdict: "FAIL-NAME", severity: "P2", code: "SPANISH_MULTIPLICATIVE_ELISION", references: ["spanishLexicon", "modernSyntax"],
    reason: "Same demonstrable loss of parent -o before diol; ethyl substitution does not change the elision rule." } },
  "V008-067": { "1979-es": { observed: "2-metoxihexanol", verdict: "REFERENCE-PENDING", severity: "P1", code: "HISTORICAL_OH_LOCANT_UNRESOLVED", references: ["historicalAlcohol", "historicalParent"],
    reason: "Native formatter omits the OH locant 1. The frozen reference is 2-metoxi-1-hexanol. Insufficient historical evidence collected to endorse this particular omission as 1979 systematic nomenclature; neither PASS nor demonstrated name/graph error." } },
  "V008-068": { "1979-es": { observed: "3-etil-2-metilheptanol", verdict: "REFERENCE-PENDING", severity: "P1", code: "HISTORICAL_OH_LOCANT_UNRESOLVED", references: ["historicalAlcohol", "historicalParent"],
    reason: "Native formatter omits the OH locant 1. Frozen reference remains 3-etil-2-metil-1-heptanol. Requires a verified 1979 locant-omission reference before teaching this form; not silently accepted or classified UNSUPPORTED." } },
};
