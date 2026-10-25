// Audit-only corpus frozen before observing OrgoRush. No production imports.
export const BASELINE = "52e4cdd2dc588acc8fc2a2dce718af70d5c306ae";
export const PROFILES = Object.freeze(['2013-es','1979-es','1979-en','2013-en']);
export const TARGETS = Object.freeze({"alkanes":20,"unsaturated":25,"cyclic":20,"oxygen":25,"nitrogen":20,"mixed":15,"stereo":10,"limits":15});
export const SOURCES = {
  "modern": {
    "url": "https://iupac.qmul.ac.uk/BlueBook/P4.html",
    "sections": "P-41, P-44.1, P-44.3, P-44.4",
    "use": "2013 parent/group seniority; independent rule application",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "modernSyntax": {
    "url": "https://iupac.qmul.ac.uk/BlueBook/P1.html",
    "sections": "P-14.3, P-14.4, P-14.5, P-16.7",
    "use": "2013 numbering, locants, alphabetical citation and vowel elision",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "modernHydrocarbons": {
    "url": "https://iupac.qmul.ac.uk/BlueBook/P2.html",
    "sections": "P-21, P-22, P-23, P-24, P-25",
    "use": "2013 chain/ring/spiro/fused parents",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "modernFunctions": {
    "url": "https://iupac.qmul.ac.uk/BlueBook/P6.html",
    "sections": "P-62, P-63, P-64, P-65",
    "use": "2013 amines, hydroxy/ether, ketone, acid/ester rules",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "modernNitrogen": {
    "url": "https://iupac.qmul.ac.uk/BlueBook/P6a.html",
    "sections": "P-66.1, P-66.5, P-66.6",
    "use": "2013 amides, nitriles and aldehydes",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "modernStereo": {
    "url": "https://iupac.qmul.ac.uk/BlueBook/P9.html",
    "sections": "P-91–P-93",
    "use": "Stereodescriptors and CIP configuration",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalParent": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_933.htm",
    "sections": "C-13.11(a-k)",
    "use": "1979 principal group > multiple bonds > length; numbering",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalNumbering": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm",
    "sections": "C-15.11",
    "use": "1979 suffix/multiple-bond/prefix numbering order",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalUnsaturation": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm",
    "sections": "A-3.1-4",
    "use": "1979 ene/yne/enyne grammar and seniority",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalBranches": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_36.htm",
    "sections": "A-2.1–2.6",
    "use": "Branched chains and systematic/retained radicals",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalGroups": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_905.htm",
    "sections": "Table C-III",
    "use": "1979 suffix/prefix identities and priority",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalAlcohol": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm",
    "sections": "C-201.1-2",
    "use": "1979 -ol / hydroxy-",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalAldehyde": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_249.htm",
    "sections": "C-302.1",
    "use": "1979 hydrocarbon parent + -al",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalKetone": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_267.htm",
    "sections": "C-312.1",
    "use": "1979 -one/-dione",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalAcid": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm",
    "sections": "C-401.1",
    "use": "1979 parent + -oic acid/-dioic acid",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalEther": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_227.htm",
    "sections": "C-211",
    "use": "1979 alkoxyalkane and functional-class alternatives",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalEster": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_363.htm",
    "sections": "C-463.1",
    "use": "1979 O-alkyl + acid-derived ester component",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalAmine": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_513.htm",
    "sections": "C-812.1",
    "use": "1979 radical/parent amine alternatives",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalSecondaryAmine": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_522.htm",
    "sections": "C-814.4",
    "use": "1979 N-substitution of the senior primary-amine parent",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalPolyamine": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_517.htm",
    "sections": "C-813.1",
    "use": "1979 diamine/polyamine parent construction",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalAmide": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_541.htm",
    "sections": "C-822.1",
    "use": "1979 acid-to-amide construction",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalNAmide": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_548.htm",
    "sections": "C-824.1",
    "use": "1979 N-substituted amides",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalNitrile": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_566.htm",
    "sections": "C-832.1, C-832.5",
    "use": "1979 full hydrocarbon + nitrile; C#N carbon belongs to parent",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalRings": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm",
    "sections": "A-11",
    "use": "1979 monocyclic parents",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalFused": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm",
    "sections": "A-21",
    "use": "1979 retained aromatic fused parents",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalBridges": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm",
    "sections": "A-31",
    "use": "1979 bicyclo bridge counts",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "historicalSpiro": {
    "url": "https://www.acdlabs.com/iupac/nomenclature/79/r79_197.htm",
    "sections": "A-41",
    "use": "1979 spiro ring counts",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "spanishLexicon": {
    "url": "https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf",
    "sections": "Tables 1-3; sections 4, 6b, 7, 8",
    "use": "Spanish lexical/morphological forms and printed 2013 examples; for 1979 ONLY vocabulary, never modern parent selection or locant placement",
    "consultedDate": "2026-10-25",
    "evidenceType": "Normative rule/terminology; per-case applications are derived, not claimed printed examples"
  },
  "opsin": {
    "url": "https://www.ebi.ac.uk/opsin/",
    "sections": "name-to-structure service",
    "use": "Constitution cross-check ONLY; does not certify a historical or preferred name",
    "consultedDate": "2026-10-25",
    "evidenceType": "Direct JSON receipts; connectivity only"
  }
};
export const VALIDATION_CASES = [
  {
    "id": "V014-001",
    "category": "alkanes",
    "referenceEnglish": "5-ethyldecane",
    "smiles": "C(C)C(CCCC)CCCCC",
    "constitutionId": "dct@@DjUWVjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-ethyldecane.json",
    "referenceSha256": "c7ba7238f66c62afabbc69c2997eaa2eb358175343a06d019b2fe7c887477580",
    "expected": {
      "2013-en": [
        "5-ethyldecane"
      ],
      "2013-es": [
        "5-etildecano"
      ],
      "1979-en": [
        "5-ethyldecane"
      ],
      "1979-es": [
        "5-etildecano"
      ]
    },
    "formula": "C12H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-002",
    "category": "alkanes",
    "referenceEnglish": "3,6-dimethyldecane",
    "smiles": "CC(CC)CCC(CCCC)C",
    "constitutionId": "dct@@DjWVVjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C6-dimethyldecane.json",
    "referenceSha256": "5e0117f50d667bf954c0bf1111b1357aefe587e69886ef2b7042aa96269d564a",
    "expected": {
      "2013-en": [
        "3,6-dimethyldecane"
      ],
      "2013-es": [
        "3,6-dimetildecano"
      ],
      "1979-en": [
        "3,6-dimethyldecane"
      ],
      "1979-es": [
        "3,6-dimetildecano"
      ]
    },
    "formula": "C12H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-003",
    "category": "alkanes",
    "referenceEnglish": "4,4-dimethylnonane",
    "smiles": "CC(CCC)(CCCCC)C",
    "constitutionId": "dmT@@LddRJVjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C4-dimethylnonane.json",
    "referenceSha256": "b7c9ee1524d58802769c1c75a93d299de607c9b68f6ca878a8201161d8cd7826",
    "expected": {
      "2013-en": [
        "4,4-dimethylnonane"
      ],
      "2013-es": [
        "4,4-dimetilnonano"
      ],
      "1979-en": [
        "4,4-dimethylnonane"
      ],
      "1979-es": [
        "4,4-dimetilnonano"
      ]
    },
    "formula": "C11H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-004",
    "category": "alkanes",
    "referenceEnglish": "2,2,5-trimethylheptane",
    "smiles": "CC(C)(CCC(CC)C)C",
    "constitutionId": "ded@@LddUTUUUP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C2%2C5-trimethylheptane.json",
    "referenceSha256": "4e125a9eef5dc5948001d56f3c48e5074f05d15574a44ab2b72766ed6ed2cbb4",
    "expected": {
      "2013-en": [
        "2,2,5-trimethylheptane"
      ],
      "2013-es": [
        "2,2,5-trimetilheptano"
      ],
      "1979-en": [
        "2,2,5-trimethylheptane"
      ],
      "1979-es": [
        "2,2,5-trimetilheptano"
      ]
    },
    "formula": "C10H22",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-005",
    "category": "alkanes",
    "referenceEnglish": "3-ethyl-2,5-dimethylheptane",
    "smiles": "C(C)C(C(C)C)CC(CC)C",
    "constitutionId": "dmT@@LdbbQfjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethyl-2%2C5-dimethylheptane.json",
    "referenceSha256": "61c98df2e4e7f9161a3009cdbe6d8149ec835fe3891da269e911b7f4087fef3d",
    "expected": {
      "2013-en": [
        "3-ethyl-2,5-dimethylheptane"
      ],
      "2013-es": [
        "3-etil-2,5-dimetilheptano"
      ],
      "1979-en": [
        "3-ethyl-2,5-dimethylheptane"
      ],
      "1979-es": [
        "3-etil-2,5-dimetilheptano"
      ]
    },
    "formula": "C11H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-006",
    "category": "alkanes",
    "referenceEnglish": "4-ethyl-3,3-dimethyloctane",
    "smiles": "C(C)C(C(CC)(C)C)CCCC",
    "constitutionId": "dct@@LddTQVuUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethyl-3%2C3-dimethyloctane.json",
    "referenceSha256": "46ed9b99c90917bbfe9312d9ee12716463a67ece63ba3e92bda55a5d15693454",
    "expected": {
      "2013-en": [
        "4-ethyl-3,3-dimethyloctane"
      ],
      "2013-es": [
        "4-etil-3,3-dimetiloctano"
      ],
      "1979-en": [
        "4-ethyl-3,3-dimethyloctane"
      ],
      "1979-es": [
        "4-etil-3,3-dimetiloctano"
      ]
    },
    "formula": "C12H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-007",
    "category": "alkanes",
    "referenceEnglish": "2,2,4,6,6-pentamethylheptane",
    "smiles": "CC(C)(CC(CC(C)(C)C)C)C",
    "constitutionId": "dct@@LddUbteUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C2%2C4%2C6%2C6-pentamethylheptane.json",
    "referenceSha256": "fa0f86a99ffb1c2f2da5520f643a2a751f5214605c639c25bc6627e012cde9f7",
    "expected": {
      "2013-en": [
        "2,2,4,6,6-pentamethylheptane"
      ],
      "2013-es": [
        "2,2,4,6,6-pentametilheptano"
      ],
      "1979-en": [
        "2,2,4,6,6-pentamethylheptane"
      ],
      "1979-es": [
        "2,2,4,6,6-pentametilheptano"
      ]
    },
    "formula": "C12H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-008",
    "category": "alkanes",
    "referenceEnglish": "3,3,5,5-tetramethylheptane",
    "smiles": "CC(CC)(CC(CC)(C)C)C",
    "constitutionId": "dmT@@LddRLfjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C3%2C5%2C5-tetramethylheptane.json",
    "referenceSha256": "452afeff71f51a18012a25f7a30c91bf1f4092a7a35ac27d64eb222aad7fdfb3",
    "expected": {
      "2013-en": [
        "3,3,5,5-tetramethylheptane"
      ],
      "2013-es": [
        "3,3,5,5-tetrametilheptano"
      ],
      "1979-en": [
        "3,3,5,5-tetramethylheptane"
      ],
      "1979-es": [
        "3,3,5,5-tetrametilheptano"
      ]
    },
    "formula": "C11H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-009",
    "category": "alkanes",
    "referenceEnglish": "5-(propan-2-yl)nonane",
    "smiles": "CC(C)C(CCCC)CCCC",
    "constitutionId": "dct@@LdbbQRUUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-(propan-2-yl)nonane.json",
    "referenceSha256": "22bb60db2e58265179dd7ff06a4babc2ccf7b6a2c790dbd90a5e18f92aa930bf",
    "expected": {
      "2013-en": [
        "5-(propan-2-yl)nonane"
      ],
      "2013-es": [
        "5-(propan-2-il)nonano"
      ],
      "1979-en": [
        "5-(1-methylethyl)nonane"
      ],
      "1979-es": [
        "5-(1-metiletil)nonano"
      ]
    },
    "formula": "C12H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-010",
    "category": "alkanes",
    "referenceEnglish": "5-(butan-2-yl)decane",
    "smiles": "CC(CC)C(CCCC)CCCCC",
    "constitutionId": "dgl@@DjYW]Zjjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-(butan-2-yl)decane.json",
    "referenceSha256": "b35b405ee9cdb987bb99a36c1cca0f7cdb6cd3d7b8beadddf36ef5d7e865d744",
    "expected": {
      "2013-en": [
        "5-(butan-2-yl)decane"
      ],
      "2013-es": [
        "5-(butan-2-il)decano"
      ],
      "1979-en": [
        "5-(1-methylpropyl)decane"
      ],
      "1979-es": [
        "5-(1-metilpropil)decano"
      ]
    },
    "formula": "C14H30",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-011",
    "category": "alkanes",
    "referenceEnglish": "6-(2-methylpropyl)undecane",
    "smiles": "CC(CC(CCCCC)CCCCC)C",
    "constitutionId": "do\\@@LdbRTRJRjjjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-(2-methylpropyl)undecane.json",
    "referenceSha256": "f1a7bfe685cf55fd782297cbcee948b18e4a5c4f49da34ecb387ba16c651498d",
    "expected": {
      "2013-en": [
        "6-(2-methylpropyl)undecane"
      ],
      "2013-es": [
        "6-(2-metilpropil)undecano"
      ],
      "1979-en": [
        "6-(2-methylpropyl)undecane"
      ],
      "1979-es": [
        "6-(2-metilpropil)undecano"
      ]
    },
    "formula": "C15H32",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-012",
    "category": "alkanes",
    "referenceEnglish": "6-tert-butyldodecane",
    "smiles": "C(C)(C)(C)C(CCCCC)CCCCCC",
    "constitutionId": "f`~@@@LddTjRRRUUUUUP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-tert-butyldodecane.json",
    "referenceSha256": "593b10751809a3b03aa81a6ca68ce564c372a8bb9036c497c3b049d323c4fb8e",
    "expected": {
      "2013-en": [
        "6-tert-butyldodecane"
      ],
      "2013-es": [
        "6-terc-butildodecano"
      ],
      "1979-en": [
        "6-tert-butyldodecane"
      ],
      "1979-es": [
        "6-terc-butildodecano"
      ]
    },
    "formula": "C16H34",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-013",
    "category": "alkanes",
    "referenceEnglish": "6-(pentan-2-yl)tridecane",
    "smiles": "CC(CCC)C(CCCCC)CCCCCCC",
    "constitutionId": "fdq@@@DjYWU]^jjjjj`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-(pentan-2-yl)tridecane.json",
    "referenceSha256": "a08cdbd69a21ad39bca8bee727500118e81787235b4f83e18914b2efc8fb851d",
    "expected": {
      "2013-en": [
        "6-(pentan-2-yl)tridecane"
      ],
      "2013-es": [
        "6-(pentan-2-il)tridecano"
      ],
      "1979-en": [
        "6-(1-methylbutyl)tridecane"
      ],
      "1979-es": [
        "6-(1-metilbutil)tridecano"
      ]
    },
    "formula": "C18H38",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-014",
    "category": "alkanes",
    "referenceEnglish": "7-(pentan-3-yl)tetradecane",
    "smiles": "CCC(CC)C(CCCCCC)CCCCCCC",
    "constitutionId": "fli@@@LdbbRRQRRRjjjjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/7-(pentan-3-yl)tetradecane.json",
    "referenceSha256": "01d3642618665b0de14a5dff8334d6d7a6e8cae390717bbb364cc1626cecb142",
    "expected": {
      "2013-en": [
        "7-(pentan-3-yl)tetradecane"
      ],
      "2013-es": [
        "7-(pentan-3-il)tetradecano"
      ],
      "1979-en": [
        "7-(1-ethylpropyl)tetradecane"
      ],
      "1979-es": [
        "7-(1-etilpropil)tetradecano"
      ]
    },
    "formula": "C19H40",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-015",
    "category": "alkanes",
    "referenceEnglish": "4,5-dipropyldecane",
    "smiles": "C(CC)C(CCC)C(CCCCC)CCC",
    "constitutionId": "f`~@@@LdbbRRRRmUUUUP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C5-dipropyldecane.json",
    "referenceSha256": "361bb6e013322dca4a783a511798b91b594865297a7abed07c95973e65ac332b",
    "expected": {
      "2013-en": [
        "4,5-dipropyldecane"
      ],
      "2013-es": [
        "4,5-dipropildecano"
      ],
      "1979-en": [
        "4,5-dipropyldecane"
      ],
      "1979-es": [
        "4,5-dipropildecano"
      ]
    },
    "formula": "C16H34",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-016",
    "category": "alkanes",
    "referenceEnglish": "4,7-diethyl-2,9-dimethyldecane",
    "smiles": "C(C)C(CC(C)C)CCC(CC(C)C)CC",
    "constitutionId": "f`~@@@LdbRTUbReUUUUP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C7-diethyl-2%2C9-dimethyldecane.json",
    "referenceSha256": "b7278e3f9b7840275f14500a83ed2977a22fc3695f9180ca0e6bc789268b82cf",
    "expected": {
      "2013-en": [
        "4,7-diethyl-2,9-dimethyldecane"
      ],
      "2013-es": [
        "4,7-dietil-2,9-dimetildecano"
      ],
      "1979-en": [
        "4,7-diethyl-2,9-dimethyldecane"
      ],
      "1979-es": [
        "4,7-dietil-2,9-dimetildecano"
      ]
    },
    "formula": "C16H34",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-017",
    "category": "alkanes",
    "referenceEnglish": "2,3,3,6-tetramethyloctane",
    "smiles": "CC(C)C(CCC(CC)C)(C)C",
    "constitutionId": "dct@@LddTSTUUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C3%2C3%2C6-tetramethyloctane.json",
    "referenceSha256": "615e9e142c4143661d6ede95d7ec735071907a154cd6662d5766a310b5989e3f",
    "expected": {
      "2013-en": [
        "2,3,3,6-tetramethyloctane"
      ],
      "2013-es": [
        "2,3,3,6-tetrametiloctano"
      ],
      "1979-en": [
        "2,3,3,6-tetramethyloctane"
      ],
      "1979-es": [
        "2,3,3,6-tetrametiloctano"
      ]
    },
    "formula": "C12H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-018",
    "category": "alkanes",
    "referenceEnglish": "3,5,7-triethylnonane",
    "smiles": "C(C)C(CC)CC(CC(CC)CC)CC",
    "constitutionId": "do\\@@DjUYmVjjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C5%2C7-triethylnonane.json",
    "referenceSha256": "07b303bb4cfdb3d57e0138cfd346346e02d5d3bdf961a04ccc5ff1271dbeb248",
    "expected": {
      "2013-en": [
        "3,5,7-triethylnonane"
      ],
      "2013-es": [
        "3,5,7-trietilnonano"
      ],
      "1979-en": [
        "3,5,7-triethylnonane"
      ],
      "1979-es": [
        "3,5,7-trietilnonano"
      ]
    },
    "formula": "C15H32",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-019",
    "category": "alkanes",
    "referenceEnglish": "4,4,7-triethyldodecane",
    "smiles": "C(C)C(CCC)(CCC(CCCCC)CC)CC",
    "constitutionId": "fdq@@@LddRRRLrVUUUUUU@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C4%2C7-triethyldodecane.json",
    "referenceSha256": "7aea4a6aaba7359303066b1afda3252af51f0eb3ef4732fe210a66bf819d5716",
    "expected": {
      "2013-en": [
        "4,4,7-triethyldodecane"
      ],
      "2013-es": [
        "4,4,7-trietildodecano"
      ],
      "1979-en": [
        "4,4,7-triethyldodecane"
      ],
      "1979-es": [
        "4,4,7-trietildodecano"
      ]
    },
    "formula": "C18H38",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-020",
    "category": "alkanes",
    "referenceEnglish": "2,2,6,6-tetramethyldecane",
    "smiles": "CC(C)(CCCC(CCCC)(C)C)C",
    "constitutionId": "dgl@@LddRJRTeUUUT@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C2%2C6%2C6-tetramethyldecane.json",
    "referenceSha256": "579e16a562adc8c98c7bd1d10f87387e7358ecbd6669752fa7f275eee1bbfcf2",
    "expected": {
      "2013-en": [
        "2,2,6,6-tetramethyldecane"
      ],
      "2013-es": [
        "2,2,6,6-tetrametildecano"
      ],
      "1979-en": [
        "2,2,6,6-tetramethyldecane"
      ],
      "1979-es": [
        "2,2,6,6-tetrametildecano"
      ]
    },
    "formula": "C14H30",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-021",
    "category": "unsaturated",
    "referenceEnglish": "4-ethylnon-2-ene",
    "smiles": "C(C)C(C=CC)CCCCC",
    "constitutionId": "dmT@@Di[WVjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethylnon-2-ene.json",
    "referenceSha256": "0943cc9284de6503bd0b8fe9450a851b674964179f68ab9d850e5f8ff0db8782",
    "expected": {
      "2013-en": [
        "4-ethylnon-2-ene"
      ],
      "2013-es": [
        "4-etilnon-2-eno"
      ],
      "1979-en": [
        "4-ethyl-2-nonene"
      ],
      "1979-es": [
        "4-etil-2-noneno"
      ]
    },
    "formula": "C11H22",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-022",
    "category": "unsaturated",
    "referenceEnglish": "5-methyldec-3-ene",
    "smiles": "CC(C=CCC)CCCCC",
    "constitutionId": "dmT@@LdRbQRZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-methyldec-3-ene.json",
    "referenceSha256": "85c60cca1972d6ae6f70f417b3af38756d0d46b7f0f731774ac09dcafc173384",
    "expected": {
      "2013-en": [
        "5-methyldec-3-ene"
      ],
      "2013-es": [
        "5-metildec-3-eno"
      ],
      "1979-en": [
        "5-methyl-3-decene"
      ],
      "1979-es": [
        "5-metil-3-deceno"
      ]
    },
    "formula": "C11H22",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-023",
    "category": "unsaturated",
    "referenceEnglish": "3,6-dimethylhepta-1,5-diene",
    "smiles": "CC(C=C)CC=C(C)C",
    "constitutionId": "diD@@LdbJbZjd@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C6-dimethylhepta-1%2C5-diene.json",
    "referenceSha256": "2f5106a66e613ab7c8b52c8b18b5ee09e4661d52988ea382e4d3867b57db2732",
    "expected": {
      "2013-en": [
        "3,6-dimethylhepta-1,5-diene"
      ],
      "2013-es": [
        "3,6-dimetilhepta-1,5-dieno"
      ],
      "1979-en": [
        "3,6-dimethyl-1,5-heptadiene"
      ],
      "1979-es": [
        "3,6-dimetil-1,5-heptadieno"
      ]
    },
    "formula": "C9H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-024",
    "category": "unsaturated",
    "referenceEnglish": "nona-1,3,7-triene",
    "smiles": "C=CC=CCCC=CC",
    "constitutionId": "diD@@Di]VVi`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/nona-1%2C3%2C7-triene.json",
    "referenceSha256": "d4c76fb806cac16cbde8eb17c697b5e3f3338b255ffded55427712b1139ff766",
    "expected": {
      "2013-en": [
        "nona-1,3,7-triene"
      ],
      "2013-es": [
        "nona-1,3,7-trieno"
      ],
      "1979-en": [
        "1,3,7-nonatriene"
      ],
      "1979-es": [
        "1,3,7-nonatrieno"
      ]
    },
    "formula": "C9H14",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-025",
    "category": "unsaturated",
    "referenceEnglish": "deca-2,4,7-triene",
    "smiles": "CC=CC=CCC=CCC",
    "constitutionId": "ded@@DiUuejZ@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/deca-2%2C4%2C7-triene.json",
    "referenceSha256": "da8c2e6f68f98584345786203564882f7bf713b119794765df1209471fa9be2c",
    "expected": {
      "2013-en": [
        "deca-2,4,7-triene"
      ],
      "2013-es": [
        "deca-2,4,7-trieno"
      ],
      "1979-en": [
        "2,4,7-decatriene"
      ],
      "1979-es": [
        "2,4,7-decatrieno"
      ]
    },
    "formula": "C10H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-026",
    "category": "unsaturated",
    "referenceEnglish": "undeca-1,4,7,10-tetraene",
    "smiles": "C=CCC=CCC=CCC=C",
    "constitutionId": "dmT@@DiUWVjVd@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/undeca-1%2C4%2C7%2C10-tetraene.json",
    "referenceSha256": "75a63eaf46f7c00a58cd64c2af5df54f24c0c853168129eb7a88a0511111bc4f",
    "expected": {
      "2013-en": [
        "undeca-1,4,7,10-tetraene"
      ],
      "2013-es": [
        "undeca-1,4,7,10-tetraeno"
      ],
      "1979-en": [
        "1,4,7,10-undecatetraene"
      ],
      "1979-es": [
        "1,4,7,10-undecatetraeno"
      ]
    },
    "formula": "C11H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-027",
    "category": "unsaturated",
    "referenceEnglish": "4-ethylhepta-1,6-diene",
    "smiles": "C(C)C(CC=C)CC=C",
    "constitutionId": "diD@@DkYUjjP@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethylhepta-1%2C6-diene.json",
    "referenceSha256": "dd5bf4fdbaed4f153f848637a00a1c201fd44ff9ce90ce15755bd626a3ddd39c",
    "expected": {
      "2013-en": [
        "4-ethylhepta-1,6-diene"
      ],
      "2013-es": [
        "4-etilhepta-1,6-dieno"
      ],
      "1979-en": [
        "4-ethyl-1,6-heptadiene"
      ],
      "1979-es": [
        "4-etil-1,6-heptadieno"
      ]
    },
    "formula": "C9H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-028",
    "category": "unsaturated",
    "referenceEnglish": "3-methylideneoct-1-ene",
    "smiles": "C=C(C=C)CCCCC",
    "constitutionId": "diD@@Dj_VYj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-methylideneoct-1-ene.json",
    "referenceSha256": "9b1ea0b20938cb0de06c11e604d9a4d2b4e8b5089bfc754b807d1637bcfdd9c9",
    "expected": {
      "2013-en": [
        "3-methylideneoct-1-ene"
      ],
      "2013-es": null,
      "1979-en": [
        "2-pentyl-1,3-butadiene"
      ],
      "1979-es": [
        "2-pentil-1,3-butadieno"
      ]
    },
    "formula": "C9H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Spanish -ylidene/vowel junction not independently adjudicated; do not certify the lexical projection"
    ]
  },
  {
    "id": "V014-029",
    "category": "unsaturated",
    "referenceEnglish": "4-methylidenenon-2-ene",
    "smiles": "C=C(C=CC)CCCCC",
    "constitutionId": "ded@@Dj]]fZj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-methylidenenon-2-ene.json",
    "referenceSha256": "101380270855204f477f5860abe06397d75160d51ae9672282805fad0c55bf47",
    "expected": {
      "2013-en": [
        "4-methylidenenon-2-ene"
      ],
      "2013-es": [
        "4-metilidenonon-2-eno"
      ],
      "1979-en": [
        "2-pentyl-1,3-pentadiene"
      ],
      "1979-es": [
        "2-pentil-1,3-pentadieno"
      ]
    },
    "formula": "C10H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-030",
    "category": "unsaturated",
    "referenceEnglish": "3,5-dimethylideneoctane",
    "smiles": "C=C(CC)CC(CCC)=C",
    "constitutionId": "ded@@DjugZij@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C5-dimethylideneoctane.json",
    "referenceSha256": "f8248f6d8ab3766f9be5c34ed5831f3b337631e8867070bee280b4eef01d732f",
    "expected": {
      "2013-en": [
        "3,5-dimethylideneoctane"
      ],
      "2013-es": null,
      "1979-en": [
        "2-ethyl-4-propyl-1,4-pentadiene"
      ],
      "1979-es": [
        "2-etil-4-propil-1,4-pentadieno"
      ]
    },
    "formula": "C10H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Spanish -ylidene/vowel junction not independently adjudicated; do not certify the lexical projection"
    ]
  },
  {
    "id": "V014-031",
    "category": "unsaturated",
    "referenceEnglish": "4-ethylideneundecane",
    "smiles": "C(C)=C(CCC)CCCCCCC",
    "constitutionId": "dkL@@DjUuuZjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethylideneundecane.json",
    "referenceSha256": "2c26706c6049ba2da5d4355d363df2beeaaa990ac067dc5573b50ba3bf13d4af",
    "expected": {
      "2013-en": [
        "4-ethylideneundecane"
      ],
      "2013-es": null,
      "1979-en": [
        "3-propyl-2-decene"
      ],
      "1979-es": [
        "3-propil-2-deceno"
      ]
    },
    "formula": "C13H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Spanish -ylidene/vowel junction not independently adjudicated; do not certify the lexical projection"
    ]
  },
  {
    "id": "V014-032",
    "category": "unsaturated",
    "referenceEnglish": "5-(prop-2-en-1-yl)undecane",
    "smiles": "C(C=C)C(CCCC)CCCCCC",
    "constitutionId": "dgl@@DkYUUvjjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-(prop-2-en-1-yl)undecane.json",
    "referenceSha256": "09bf188d7a0655d17cdffafa5e129cfc3e3f25ef224bbc51dce7265839a4be81",
    "expected": {
      "2013-en": [
        "5-(prop-2-en-1-yl)undecane"
      ],
      "2013-es": [
        "5-(prop-2-en-1-il)undecano"
      ],
      "1979-en": [
        "4-butyl-1-decene"
      ],
      "1979-es": [
        "4-butil-1-deceno"
      ]
    },
    "formula": "C14H28",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-033",
    "category": "unsaturated",
    "referenceEnglish": "5-ethynylundecane",
    "smiles": "C(#C)C(CCCC)CCCCCC",
    "constitutionId": "dkL@@DkeUWzjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-ethynylundecane.json",
    "referenceSha256": "080e40850e7e0109c89e84a94dfde8df229cdffe7fbab9d769adb92e264df52d",
    "expected": {
      "2013-en": [
        "5-ethynylundecane"
      ],
      "2013-es": [
        "5-etinilundecano"
      ],
      "1979-en": [
        "3-butyl-1-nonyne"
      ],
      "1979-es": [
        "3-butil-1-nonino"
      ]
    },
    "formula": "C13H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-034",
    "category": "unsaturated",
    "referenceEnglish": "6-ethenyldodecane",
    "smiles": "C(=C)C(CCCCC)CCCCCC",
    "constitutionId": "dgl@@DkeUUVjjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-ethenyldodecane.json",
    "referenceSha256": "66cd12f491559ce5835c030a73ec41579cc8faffe9cbf66c463dbf9ec6015c46",
    "expected": {
      "2013-en": [
        "6-ethenyldodecane"
      ],
      "2013-es": [
        "6-etenildodecano"
      ],
      "1979-en": [
        "3-pentyl-1-nonene"
      ],
      "1979-es": [
        "3-pentil-1-noneno"
      ]
    },
    "formula": "C14H28",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-035",
    "category": "unsaturated",
    "referenceEnglish": "dec-4-yne",
    "smiles": "CCCC#CCCCCC",
    "constitutionId": "ded@@DiUWzjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/dec-4-yne.json",
    "referenceSha256": "4ecccd9a60f5768cd04f5b50c1624d0af94e329679dd4091eb7328d9cda44c00",
    "expected": {
      "2013-en": [
        "dec-4-yne"
      ],
      "2013-es": [
        "dec-4-ino"
      ],
      "1979-en": [
        "4-decyne"
      ],
      "1979-es": [
        "4-decino"
      ]
    },
    "formula": "C10H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-036",
    "category": "unsaturated",
    "referenceEnglish": "4,7-dimethylnon-2-yne",
    "smiles": "CC(C#CC)CCC(CC)C",
    "constitutionId": "dmT@@Di[v^jjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C7-dimethylnon-2-yne.json",
    "referenceSha256": "90f55eb090c1132bf14ab518b546f9379ea7e650c5e17041574dc0435b83aa71",
    "expected": {
      "2013-en": [
        "4,7-dimethylnon-2-yne"
      ],
      "2013-es": [
        "4,7-dimetilnon-2-ino"
      ],
      "1979-en": [
        "4,7-dimethyl-2-nonyne"
      ],
      "1979-es": [
        "4,7-dimetil-2-nonino"
      ]
    },
    "formula": "C11H20",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-037",
    "category": "unsaturated",
    "referenceEnglish": "undeca-1,6-diyne",
    "smiles": "C#CCCCC#CCCCC",
    "constitutionId": "dmT@@DiUU^jjl@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/undeca-1%2C6-diyne.json",
    "referenceSha256": "34961e35a0824909ed4b6a1aaba22fd183a856be67edbe7e2c0df29c9cabd6a6",
    "expected": {
      "2013-en": [
        "undeca-1,6-diyne"
      ],
      "2013-es": [
        "undeca-1,6-diino"
      ],
      "1979-en": [
        "1,6-undecadiyne"
      ],
      "1979-es": [
        "1,6-undecadiino"
      ]
    },
    "formula": "C11H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-038",
    "category": "unsaturated",
    "referenceEnglish": "dodeca-2,7-diyne",
    "smiles": "CC#CCCCC#CCCCC",
    "constitutionId": "dct@@DiUU_jjk`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/dodeca-2%2C7-diyne.json",
    "referenceSha256": "c91f930b271e2a37630c42727ccb83cb58e57f15cf4ad8d4623a0b5c17cc6dbf",
    "expected": {
      "2013-en": [
        "dodeca-2,7-diyne"
      ],
      "2013-es": [
        "dodeca-2,7-diino"
      ],
      "1979-en": [
        "2,7-dodecadiyne"
      ],
      "1979-es": [
        "2,7-dodecadiino"
      ]
    },
    "formula": "C12H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-039",
    "category": "unsaturated",
    "referenceEnglish": "dec-3-en-7-yne",
    "smiles": "CCC=CCCC#CCC",
    "constitutionId": "ded@@DiUuzjZ@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/dec-3-en-7-yne.json",
    "referenceSha256": "e98f4c25678ddd9e3fe2f6376f18094bd3f0a00854d89a9d6d171fcb904cf1e1",
    "expected": {
      "2013-en": [
        "dec-3-en-7-yne"
      ],
      "2013-es": [
        "dec-3-en-7-ino"
      ],
      "1979-en": [
        "3-decen-7-yne"
      ],
      "1979-es": [
        "3-decen-7-ino"
      ]
    },
    "formula": "C10H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-040",
    "category": "unsaturated",
    "referenceEnglish": "undec-1-en-8-yne",
    "smiles": "C=CCCCCCC#CCC",
    "constitutionId": "dmT@@DiUu^jjd@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/undec-1-en-8-yne.json",
    "referenceSha256": "4453fc94e91a2c21dda0431fa812ada96ff7adc7e83533f6c067a465fd37a45c",
    "expected": {
      "2013-en": [
        "undec-1-en-8-yne"
      ],
      "2013-es": [
        "undec-1-en-8-ino"
      ],
      "1979-en": [
        "1-undecen-8-yne"
      ],
      "1979-es": [
        "1-undecen-8-ino"
      ]
    },
    "formula": "C11H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-041",
    "category": "unsaturated",
    "referenceEnglish": "deca-1,4-dien-8-yne",
    "smiles": "C=CCC=CCCC#CC",
    "constitutionId": "ded@@Di]Uzii@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/deca-1%2C4-dien-8-yne.json",
    "referenceSha256": "eee8aa5c73488bca61b942cc31349ca2a0a414de60d4aa448e06dbdba6342c85",
    "expected": {
      "2013-en": [
        "deca-1,4-dien-8-yne"
      ],
      "2013-es": [
        "deca-1,4-dien-8-ino"
      ],
      "1979-en": [
        "1,4-decadien-8-yne"
      ],
      "1979-es": [
        "1,4-decadien-8-ino"
      ]
    },
    "formula": "C10H14",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-042",
    "category": "unsaturated",
    "referenceEnglish": "nona-1,2-diene",
    "smiles": "C=C=CCCCCCC",
    "constitutionId": "diD@@DiuUZj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/nona-1%2C2-diene.json",
    "referenceSha256": "6fa33f21352e51c2bde408eb31f357568b61da3940dabd2a4e41f660bb55d515",
    "expected": {
      "2013-en": [
        "nona-1,2-diene"
      ],
      "2013-es": [
        "nona-1,2-dieno"
      ],
      "1979-en": [
        "1,2-nonadiene"
      ],
      "1979-es": [
        "1,2-nonadieno"
      ]
    },
    "formula": "C9H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-043",
    "category": "unsaturated",
    "referenceEnglish": "deca-3,4-diene",
    "smiles": "CCC=C=CCCCCC",
    "constitutionId": "ded@@DiU]Vjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/deca-3%2C4-diene.json",
    "referenceSha256": "2533641788d807c40ede95010f61336d88f890b627717d8786e625f9e885879f",
    "expected": {
      "2013-en": [
        "deca-3,4-diene"
      ],
      "2013-es": [
        "deca-3,4-dieno"
      ],
      "1979-en": [
        "3,4-decadiene"
      ],
      "1979-es": [
        "3,4-decadieno"
      ]
    },
    "formula": "C10H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-044",
    "category": "unsaturated",
    "referenceEnglish": "4-methylhept-1-en-5-yne",
    "smiles": "CC(CC=C)C#CC",
    "constitutionId": "dax@@Di[~jd@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-methylhept-1-en-5-yne.json",
    "referenceSha256": "c5886b0fef59855e174f30ff1d8244817fed66156bd368591433528888a9b38d",
    "expected": {
      "2013-en": [
        "4-methylhept-1-en-5-yne"
      ],
      "2013-es": [
        "4-metilhept-1-en-5-ino"
      ],
      "1979-en": [
        "4-methyl-1-hepten-5-yne"
      ],
      "1979-es": [
        "4-metil-1-hepten-5-ino"
      ]
    },
    "formula": "C8H12",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-045",
    "category": "unsaturated",
    "referenceEnglish": "6-(buta-1,3-dien-1-yl)tetradecane",
    "smiles": "C(=CC=C)C(CCCCC)CCCCCCCC",
    "constitutionId": "fdq@@@Di^UUUvVjjjj`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-(buta-1%2C3-dien-1-yl)tetradecane.json",
    "referenceSha256": "0fd564a2f1980b76137c929fd31cc060600a6b283fc1ac8ed769f4a83431e388",
    "expected": {
      "2013-en": [
        "6-(buta-1,3-dien-1-yl)tetradecane"
      ],
      "2013-es": [
        "6-(buta-1,3-dien-1-il)tetradecano"
      ],
      "1979-en": [
        "5-pentyl-1,3-tridecadiene"
      ],
      "1979-es": [
        "5-pentil-1,3-tridecadieno"
      ]
    },
    "formula": "C18H34",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-046",
    "category": "cyclic",
    "referenceEnglish": "1,1,3-trimethylcycloheptane",
    "smiles": "CC1(CC(CCCC1)C)C",
    "constitutionId": "deT@@LddRLWSUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C1%2C3-trimethylcycloheptane.json",
    "referenceSha256": "4396f55712d6ccf67e7e31ad969b8c8dcbcad02647f1c46afeb2abe3fe2ee00b",
    "expected": {
      "2013-en": [
        "1,1,3-trimethylcycloheptane"
      ],
      "2013-es": [
        "1,1,3-trimetilcicloheptano"
      ],
      "1979-en": [
        "1,1,3-trimethylcycloheptane"
      ],
      "1979-es": [
        "1,1,3-trimetilcicloheptano"
      ]
    },
    "formula": "C10H20",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-047",
    "category": "cyclic",
    "referenceEnglish": "1-ethyl-4-propylcyclooctane",
    "smiles": "C(C)C1CCC(CCCC1)CCC",
    "constitutionId": "dkl@@LdbRRReEZjjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1-ethyl-4-propylcyclooctane.json",
    "referenceSha256": "212658fb5de25e57bef54bddf11d4605973d6b6e1a04b5eb818d89cf9aacfb99",
    "expected": {
      "2013-en": [
        "1-ethyl-4-propylcyclooctane"
      ],
      "2013-es": [
        "1-etil-4-propilciclooctano"
      ],
      "1979-en": [
        "1-ethyl-4-propylcyclooctane"
      ],
      "1979-es": [
        "1-etil-4-propilciclooctano"
      ]
    },
    "formula": "C13H26",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-048",
    "category": "cyclic",
    "referenceEnglish": "1-methylcyclohepta-1,3-diene",
    "smiles": "CC1=CC=CCCC1",
    "constitutionId": "daD@@DjWVyjf`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1-methylcyclohepta-1%2C3-diene.json",
    "referenceSha256": "fcdc701cc515e133d0ff2c5e6b99d3ebc30e460fbb1f9e52858b1d2545c9d987",
    "expected": {
      "2013-en": [
        "1-methylcyclohepta-1,3-diene"
      ],
      "2013-es": [
        "1-metilciclohepta-1,3-dieno"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C8H12",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-049",
    "category": "cyclic",
    "referenceEnglish": "cycloundeca-1,5-diene",
    "smiles": "C1=CCCC=CCCCCC1",
    "constitutionId": "dmt@@DiUUYUjjZ`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/cycloundeca-1%2C5-diene.json",
    "referenceSha256": "73caa6281cf8efb95a6ff80db1079f6993e9eb855e00938a1c95848231552242",
    "expected": {
      "2013-en": [
        "cycloundeca-1,5-diene"
      ],
      "2013-es": [
        "cicloundeca-1,5-dieno"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C11H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-050",
    "category": "cyclic",
    "referenceEnglish": "2-ethyl-1,4-dimethylbenzene",
    "smiles": "C(C)C1=C(C=CC(=C1)C)C",
    "constitutionId": "deT@@DjYWXPbH`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-ethyl-1%2C4-dimethylbenzene.json",
    "referenceSha256": "fad30157fc1757abf59655ea8cd23116c9472166f0c3a877f8effc74c22beb0c",
    "expected": {
      "2013-en": [
        "2-ethyl-1,4-dimethylbenzene"
      ],
      "2013-es": [
        "2-etil-1,4-dimetilbenceno"
      ],
      "1979-en": [
        "2-ethyl-1,4-dimethylbenzene"
      ],
      "1979-es": [
        "2-etil-1,4-dimetilbenceno"
      ]
    },
    "formula": "C10H14",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-051",
    "category": "cyclic",
    "referenceEnglish": "1-tert-butyl-3-ethylbenzene",
    "smiles": "C(C)(C)(C)C1=CC(=CC=C1)CC",
    "constitutionId": "dcL@@LdbRdT}RDEQP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1-tert-butyl-3-ethylbenzene.json",
    "referenceSha256": "ed6323cabd926ed4abb53b0fad2d2cd1befe22cf384cf6f6c3cdcea3aa039264",
    "expected": {
      "2013-en": [
        "1-tert-butyl-3-ethylbenzene"
      ],
      "2013-es": [
        "1-terc-butil-3-etilbenceno"
      ],
      "1979-en": [
        "1-tert-butyl-3-ethylbenzene"
      ],
      "1979-es": [
        "1-terc-butil-3-etilbenceno"
      ]
    },
    "formula": "C12H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-052",
    "category": "cyclic",
    "referenceEnglish": "1,2,4-triethylbenzene",
    "smiles": "C(C)C1=C(C=C(C=C1)CC)CC",
    "constitutionId": "dcL@@LdbbRRkBDQEP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C2%2C4-triethylbenzene.json",
    "referenceSha256": "8acea5cb1a66fb661389fb700f750fd55ad7cfa94664caac87d062e3a1121107",
    "expected": {
      "2013-en": [
        "1,2,4-triethylbenzene"
      ],
      "2013-es": [
        "1,2,4-trietilbenceno"
      ],
      "1979-en": [
        "1,2,4-triethylbenzene"
      ],
      "1979-es": [
        "1,2,4-trietilbenceno"
      ]
    },
    "formula": "C12H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-053",
    "category": "cyclic",
    "referenceEnglish": "1-bromo-3-ethyl-5-methylbenzene",
    "smiles": "BrC1=CC(=CC(=C1)C)CC",
    "constitutionId": "deT@`@qDfUgih@J`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1-bromo-3-ethyl-5-methylbenzene.json",
    "referenceSha256": "1b0ae860c7819fe18e735107a74a1d6693a9a7c31c3ead66e04312c76f04946f",
    "expected": {
      "2013-en": [
        "1-bromo-3-ethyl-5-methylbenzene"
      ],
      "2013-es": [
        "1-bromo-3-etil-5-metilbenceno"
      ],
      "1979-en": [
        "1-bromo-3-ethyl-5-methylbenzene"
      ],
      "1979-es": [
        "1-bromo-3-etil-5-metilbenceno"
      ]
    },
    "formula": "C9H11Br",
    "groupCounts": {
      "halogen": 1
    },
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-054",
    "category": "cyclic",
    "referenceEnglish": "2-ethylnaphthalene",
    "smiles": "C(C)C1=CC2=CC=CC=C2C=C1",
    "constitutionId": "dcl@@LdbbRRkCt`@@T@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-ethylnaphthalene.json",
    "referenceSha256": "819f34b6204cfc612068f9e27312fbd52f33105f02731355de457fdada3d3b94",
    "expected": {
      "2013-en": [
        "2-ethylnaphthalene"
      ],
      "2013-es": [
        "2-etilnaftaleno"
      ],
      "1979-en": [
        "2-ethylnaphthalene"
      ],
      "1979-es": [
        "2-etilnaftaleno"
      ]
    },
    "formula": "C12H12",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalFused"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-055",
    "category": "cyclic",
    "referenceEnglish": "1,4-dimethylnaphthalene",
    "smiles": "CC1=CC=C(C2=CC=CC=C12)C",
    "constitutionId": "dcl@@DjYeeiGP@HH@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C4-dimethylnaphthalene.json",
    "referenceSha256": "da1a0ceebff72281ec9b60df7dd0d1fb7bffb61b36dd36e9d7fd8beb459e4009",
    "expected": {
      "2013-en": [
        "1,4-dimethylnaphthalene"
      ],
      "2013-es": [
        "1,4-dimetilnaftaleno"
      ],
      "1979-en": [
        "1,4-dimethylnaphthalene"
      ],
      "1979-es": [
        "1,4-dimetilnaftaleno"
      ]
    },
    "formula": "C12H12",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalFused"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-056",
    "category": "cyclic",
    "referenceEnglish": "phenanthren-9-ol",
    "smiles": "C1=CC=CC=2C3=CC=CC=C3C(=CC12)O",
    "constitutionId": "foQA@@@ILrrkkNRMYt@@@@@@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/phenanthren-9-ol.json",
    "referenceSha256": "7e5e974615198686f0b3c5bcffd7da4abe59f3a8c895270f08f54520cb9e0b88",
    "expected": {
      "2013-en": [
        "phenanthren-9-ol"
      ],
      "2013-es": [
        "fenantren-9-ol"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C14H10O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions",
      "historicalFused"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-057",
    "category": "cyclic",
    "referenceEnglish": "2-methylbicyclo[2.2.2]octane",
    "smiles": "CC1C2CCC(C1)CC2",
    "constitutionId": "diT@@DjYUaxZjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-methylbicyclo%5B2.2.2%5Doctane.json",
    "referenceSha256": "cad1e90cc628781d6f8922686dad2c97d1ccfcacc76d864b8979e6904b5fad72",
    "expected": {
      "2013-en": [
        "2-methylbicyclo[2.2.2]octane"
      ],
      "2013-es": [
        "2-metilbiciclo[2.2.2]octano"
      ],
      "1979-en": [
        "2-methylbicyclo[2.2.2]octane"
      ],
      "1979-es": [
        "2-metilbiciclo[2.2.2]octano"
      ]
    },
    "formula": "C9H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalBridges"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-058",
    "category": "cyclic",
    "referenceEnglish": "3-ethylpyridine",
    "smiles": "C(C)C=1C=NC=CC1",
    "constitutionId": "daF@@@rQIPeP@T@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethylpyridine.json",
    "referenceSha256": "959c25aa2611e7594ae20f043d65f6a103206884930bbb5dcaf0828dc7c20d92",
    "expected": {
      "2013-en": [
        "3-ethylpyridine"
      ],
      "2013-es": [
        "3-etilpiridina"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C7H9N",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication"
    ]
  },
  {
    "id": "V014-059",
    "category": "cyclic",
    "referenceEnglish": "2-methylthiophene",
    "smiles": "CC=1SC=CC1",
    "constitutionId": "gFpH@DISNmLp@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-methylthiophene.json",
    "referenceSha256": "d7d6179ef750e751fef96429163fd47021c39c024628551ab2478f489c81fcf7",
    "expected": {
      "2013-en": [
        "2-methylthiophene"
      ],
      "2013-es": [
        "2-metiltiofeno"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C5H6S",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication"
    ]
  },
  {
    "id": "V014-060",
    "category": "cyclic",
    "referenceEnglish": "1,3,5-triethylcyclononane",
    "smiles": "C(C)C1CC(CC(CCCC1)CC)CC",
    "constitutionId": "do|@@DjUYmW[jjjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C3%2C5-triethylcyclononane.json",
    "referenceSha256": "a716d1fb5f5b842c000e39dfede761ac3ded19a323fb9880cd8fed4d713e2422",
    "expected": {
      "2013-en": [
        "1,3,5-triethylcyclononane"
      ],
      "2013-es": [
        "1,3,5-trietilciclononano"
      ],
      "1979-en": [
        "1,3,5-triethylcyclononane"
      ],
      "1979-es": [
        "1,3,5-trietilciclononano"
      ]
    },
    "formula": "C15H30",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-061",
    "category": "cyclic",
    "referenceEnglish": "2,7-dimethylnaphthalene",
    "smiles": "CC1=CC2=CC(=CC=C2C=C1)C",
    "constitutionId": "dcl@@DjYUUazP@@J@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C7-dimethylnaphthalene.json",
    "referenceSha256": "d51b3b00d080bd57563970472e677978822991fd9a7d3e46f5717dfa8c07cf1f",
    "expected": {
      "2013-en": [
        "2,7-dimethylnaphthalene"
      ],
      "2013-es": [
        "2,7-dimetilnaftaleno"
      ],
      "1979-en": [
        "2,7-dimethylnaphthalene"
      ],
      "1979-es": [
        "2,7-dimetilnaftaleno"
      ]
    },
    "formula": "C12H12",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalFused"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-062",
    "category": "cyclic",
    "referenceEnglish": "1,1-diethylcyclohexane",
    "smiles": "C(C)C1(CCCCC1)CC",
    "constitutionId": "deT@@DjeUZZjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C1-diethylcyclohexane.json",
    "referenceSha256": "8532df9b5d0db85e48c4a042dcb9706239cfd5293375e82aeee1fe94cc728193",
    "expected": {
      "2013-en": [
        "1,1-diethylcyclohexane"
      ],
      "2013-es": [
        "1,1-dietilciclohexano"
      ],
      "1979-en": [
        "1,1-diethylcyclohexane"
      ],
      "1979-es": [
        "1,1-dietilciclohexano"
      ]
    },
    "formula": "C10H20",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-063",
    "category": "cyclic",
    "referenceEnglish": "2-ethylquinoline",
    "smiles": "C(C)C1=NC2=CC=CC=C2C=C1",
    "constitutionId": "dcn@@@RfYgzz]@B@`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-ethylquinoline.json",
    "referenceSha256": "48afdc078630c2775b6c9e7003dda844647bff9388c58027c580acbfee00219a",
    "expected": {
      "2013-en": [
        "2-ethylquinoline"
      ],
      "2013-es": [
        "2-etilquinolina"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C11H11N",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication"
    ]
  },
  {
    "id": "V014-064",
    "category": "cyclic",
    "referenceEnglish": "2-ethylbicyclo[3.3.1]nonane",
    "smiles": "C(C)C1C2CCCC(CC1)C2",
    "constitutionId": "dmL@@DjYUVGejjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-ethylbicyclo%5B3.3.1%5Dnonane.json",
    "referenceSha256": "59f412638bdac7325cfb0db9a629fca7dc408bdfdac3cfd3f4abd0d319193a84",
    "expected": {
      "2013-en": [
        "2-ethylbicyclo[3.3.1]nonane"
      ],
      "2013-es": [
        "2-etilbiciclo[3.3.1]nonano"
      ],
      "1979-en": [
        "2-ethylbicyclo[3.3.1]nonane"
      ],
      "1979-es": [
        "2-etilbiciclo[3.3.1]nonano"
      ]
    },
    "formula": "C11H20",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalBridges"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-065",
    "category": "cyclic",
    "referenceEnglish": "1,3-diethyl-5-methylcyclodecane",
    "smiles": "C(C)C1CC(CC(CCCCC1)C)CC",
    "constitutionId": "do|@@DjUYm^wjjjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C3-diethyl-5-methylcyclodecane.json",
    "referenceSha256": "3651e23bea8e95a56bff558438628ce397478a408051028290a4a1e026c899bd",
    "expected": {
      "2013-en": [
        "1,3-diethyl-5-methylcyclodecane"
      ],
      "2013-es": [
        "1,3-dietil-5-metilciclodecano"
      ],
      "1979-en": [
        "1,3-diethyl-5-methylcyclodecane"
      ],
      "1979-es": [
        "1,3-dietil-5-metilciclodecano"
      ]
    },
    "formula": "C15H30",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-066",
    "category": "oxygen",
    "referenceEnglish": "4-ethyloctan-2-ol",
    "smiles": "C(C)C(CC(C)O)CCCC",
    "constitutionId": "dmTH@@RYyWjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethyloctan-2-ol.json",
    "referenceSha256": "db500d78fda9b094c70a5ded9ddb335c5a182ba227c2cd3447a8d4bd325b7aa2",
    "expected": {
      "2013-en": [
        "4-ethyloctan-2-ol"
      ],
      "2013-es": [
        "4-etiloctan-2-ol"
      ],
      "1979-en": [
        "4-ethyl-2-octanol"
      ],
      "1979-es": [
        "4-etil-2-octanol"
      ]
    },
    "formula": "C10H22O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-067",
    "category": "oxygen",
    "referenceEnglish": "3,6-dimethylheptan-2-ol",
    "smiles": "CC(C(C)O)CCC(C)C",
    "constitutionId": "dedH@@RYoZjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C6-dimethylheptan-2-ol.json",
    "referenceSha256": "297c0f666262c6f0aadca7b976c62555fb5a253ed0a9b2ea65b7cf2d0c9a64e6",
    "expected": {
      "2013-en": [
        "3,6-dimethylheptan-2-ol"
      ],
      "2013-es": [
        "3,6-dimetilheptan-2-ol"
      ],
      "1979-en": [
        "3,6-dimethyl-2-heptanol"
      ],
      "1979-es": [
        "3,6-dimetil-2-heptanol"
      ]
    },
    "formula": "C9H20O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-068",
    "category": "oxygen",
    "referenceEnglish": "4-methylnonan-3-ol",
    "smiles": "CC(C(CC)O)CCCCC",
    "constitutionId": "dmTH@@rJJIEJjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-methylnonan-3-ol.json",
    "referenceSha256": "ad9f58c61f47f883cb3d7794f49cc06858a6ebda8bd78749b9524026a6d2f2d8",
    "expected": {
      "2013-en": [
        "4-methylnonan-3-ol"
      ],
      "2013-es": [
        "4-metilnonan-3-ol"
      ],
      "1979-en": [
        "4-methyl-3-nonanol"
      ],
      "1979-es": [
        "4-metil-3-nonanol"
      ]
    },
    "formula": "C10H22O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-069",
    "category": "oxygen",
    "referenceEnglish": "3-ethylhexane-1,5-diol",
    "smiles": "C(C)C(CCO)CC(C)O",
    "constitutionId": "dedD@@eIgeZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethylhexane-1%2C5-diol.json",
    "referenceSha256": "52e3a96b6801504c3740de72cdfbb83ce3e55094cf63597991690ee8c214dc6e",
    "expected": {
      "2013-en": [
        "3-ethylhexane-1,5-diol"
      ],
      "2013-es": [
        "3-etilhexano-1,5-diol"
      ],
      "1979-en": [
        "3-ethyl-1,5-hexanediol"
      ],
      "1979-es": [
        "3-etil-1,5-hexanodiol"
      ]
    },
    "formula": "C8H18O2",
    "groupCounts": {
      "alcohol": 2
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-070",
    "category": "oxygen",
    "referenceEnglish": "2,4-dimethylheptane-2,5-diol",
    "smiles": "CC(C)(CC(C(CC)O)C)O",
    "constitutionId": "dmTD@@GHiDXhZjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C4-dimethylheptane-2%2C5-diol.json",
    "referenceSha256": "a4af005f9b7f717cd13c366660df36a5bea4afb1acbc9beb5bba98e22e0e338b",
    "expected": {
      "2013-en": [
        "2,4-dimethylheptane-2,5-diol"
      ],
      "2013-es": [
        "2,4-dimetilheptano-2,5-diol"
      ],
      "1979-en": [
        "2,4-dimethyl-2,5-heptanediol"
      ],
      "1979-es": [
        "2,4-dimetil-2,5-heptanodiol"
      ]
    },
    "formula": "C9H20O2",
    "groupCounts": {
      "alcohol": 2
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-071",
    "category": "oxygen",
    "referenceEnglish": "6-methylhept-3-en-2-ol",
    "smiles": "CC(CC=CC(C)O)C",
    "constitutionId": "diDH@@RYujfj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-methylhept-3-en-2-ol.json",
    "referenceSha256": "447ced61b652b373b6ded9347f889966ff1422eb71e9f24ca447dd9064e5efc0",
    "expected": {
      "2013-en": [
        "6-methylhept-3-en-2-ol"
      ],
      "2013-es": [
        "6-metilhept-3-en-2-ol"
      ],
      "1979-en": [
        "6-methyl-3-hepten-2-ol"
      ],
      "1979-es": [
        "6-metil-3-hepten-2-ol"
      ]
    },
    "formula": "C8H16O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-072",
    "category": "oxygen",
    "referenceEnglish": "4-ethylhept-5-yn-2-ol",
    "smiles": "C(C)C(CC(C)O)C#CC",
    "constitutionId": "dedH@@RYyVjkh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethylhept-5-yn-2-ol.json",
    "referenceSha256": "d7edb63f425fa5f6e915d6cb95ff842bae513e789a1342302a36801fd6a55100",
    "expected": {
      "2013-en": [
        "4-ethylhept-5-yn-2-ol"
      ],
      "2013-es": [
        "4-etilhept-5-in-2-ol"
      ],
      "1979-en": [
        "4-ethyl-5-heptyn-2-ol"
      ],
      "1979-es": [
        "4-etil-5-heptin-2-ol"
      ]
    },
    "formula": "C9H16O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-073",
    "category": "oxygen",
    "referenceEnglish": "5-hydroxynonan-3-one",
    "smiles": "OC(CC(CC)=O)CCCC",
    "constitutionId": "dmTD@@[HhdhTfjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-hydroxynonan-3-one.json",
    "referenceSha256": "61e6fc6fd25592ae3e7e6ea3200a1369ed7a7a150e1b2ffce92a233f6d114202",
    "expected": {
      "2013-en": [
        "5-hydroxynonan-3-one"
      ],
      "2013-es": [
        "5-hidroxinonan-3-ona"
      ],
      "1979-en": [
        "5-hydroxy-3-nonanone"
      ],
      "1979-es": [
        "5-hidroxi-3-nonanona"
      ]
    },
    "formula": "C9H18O2",
    "groupCounts": {
      "alcohol": 1,
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-074",
    "category": "oxygen",
    "referenceEnglish": "4-methyloctan-3-one",
    "smiles": "CC(C(CC)=O)CCCC",
    "constitutionId": "dedH@@rJJIEMUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-methyloctan-3-one.json",
    "referenceSha256": "0677fc53c67661b717f28d64f8ac213fa8e297f754fa9ee9514f18b4fc8747a3",
    "expected": {
      "2013-en": [
        "4-methyloctan-3-one"
      ],
      "2013-es": [
        "4-metiloctan-3-ona"
      ],
      "1979-en": [
        "4-methyl-3-octanone"
      ],
      "1979-es": [
        "4-metil-3-octanona"
      ]
    },
    "formula": "C9H18O",
    "groupCounts": {
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-075",
    "category": "oxygen",
    "referenceEnglish": "5-ethylnonane-2,7-dione",
    "smiles": "C(C)C(CCC(C)=O)CC(CC)=O",
    "constitutionId": "dkLD@@uIe[Wfjji`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-ethylnonane-2%2C7-dione.json",
    "referenceSha256": "047a6eacc98e6f6f6dad2858d18d41d29adba3b60118003016c9a03a392820cb",
    "expected": {
      "2013-en": [
        "5-ethylnonane-2,7-dione"
      ],
      "2013-es": [
        "5-etilnonano-2,7-diona"
      ],
      "1979-en": [
        "5-ethyl-2,7-nonanedione"
      ],
      "1979-es": [
        "5-etil-2,7-nonanodiona"
      ]
    },
    "formula": "C11H20O2",
    "groupCounts": {
      "ketone": 2
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-076",
    "category": "oxygen",
    "referenceEnglish": "3-methylheptane-2,5-dione",
    "smiles": "CC(C(C)=O)CC(CC)=O",
    "constitutionId": "dedD@@EIe[fji`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-methylheptane-2%2C5-dione.json",
    "referenceSha256": "73bf36f1b5c29a116f0d102be20da82cbeb2ffec93b9cab07860b8132e6eb896",
    "expected": {
      "2013-en": [
        "3-methylheptane-2,5-dione"
      ],
      "2013-es": [
        "3-metilheptano-2,5-diona"
      ],
      "1979-en": [
        "3-methyl-2,5-heptanedione"
      ],
      "1979-es": [
        "3-metil-2,5-heptanodiona"
      ]
    },
    "formula": "C8H14O2",
    "groupCounts": {
      "ketone": 2
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-077",
    "category": "oxygen",
    "referenceEnglish": "4-ethyloctanal",
    "smiles": "C(C)C(CCC=O)CCCC",
    "constitutionId": "dmTH@@RUYWZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethyloctanal.json",
    "referenceSha256": "ee6840dacc6bc63dda3c66cc599e7402f4c6d506c0683eb996cc212010e88f58",
    "expected": {
      "2013-en": [
        "4-ethyloctanal"
      ],
      "2013-es": [
        "4-etiloctanal"
      ],
      "1979-en": [
        "4-ethyloctanal"
      ],
      "1979-es": [
        "4-etiloctanal"
      ]
    },
    "formula": "C10H20O",
    "groupCounts": {
      "aldehyde": 1
    },
    "primaryGroup": "aldehyde",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAldehyde",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-078",
    "category": "oxygen",
    "referenceEnglish": "3,5-dimethylheptanal",
    "smiles": "CC(CC=O)CC(CC)C",
    "constitutionId": "dedH@@RUgejjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C5-dimethylheptanal.json",
    "referenceSha256": "64b0f8e3a372ae137f78d4bae6fae81a52520336575dd72d370566bce78c1de8",
    "expected": {
      "2013-en": [
        "3,5-dimethylheptanal"
      ],
      "2013-es": [
        "3,5-dimetilheptanal"
      ],
      "1979-en": [
        "3,5-dimethylheptanal"
      ],
      "1979-es": [
        "3,5-dimetilheptanal"
      ]
    },
    "formula": "C9H18O",
    "groupCounts": {
      "aldehyde": 1
    },
    "primaryGroup": "aldehyde",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAldehyde",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-079",
    "category": "oxygen",
    "referenceEnglish": "heptanedial",
    "smiles": "C(CCCCCC=O)=O",
    "constitutionId": "diDD@@EIUUZjd@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/heptanedial.json",
    "referenceSha256": "4c4fe120b41d735d75b7d3f434671e9d1e80cb218e6b7662411a9c6bad41711c",
    "expected": {
      "2013-en": [
        "heptanedial"
      ],
      "2013-es": [
        "heptanodial"
      ],
      "1979-en": [
        "heptanedial"
      ],
      "1979-es": [
        "heptanodial"
      ]
    },
    "formula": "C7H12O2",
    "groupCounts": {
      "aldehyde": 2
    },
    "primaryGroup": "aldehyde",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAldehyde",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-080",
    "category": "oxygen",
    "referenceEnglish": "3-ethylheptanoic acid",
    "smiles": "C(C)C(CC(=O)O)CCCC",
    "constitutionId": "dmTD@@QIme]jjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethylheptanoic%20acid.json",
    "referenceSha256": "4f3ed74943304b19f8656125ce348c862c4b954cf10a054898ffe8a99c4c5cf4",
    "expected": {
      "2013-en": [
        "3-ethylheptanoic acid"
      ],
      "2013-es": [
        "ácido 3-etilheptanoico"
      ],
      "1979-en": [
        "3-ethylheptanoic acid"
      ],
      "1979-es": [
        "ácido 3-etilheptanoico"
      ]
    },
    "formula": "C9H18O2",
    "groupCounts": {
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAcid",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-081",
    "category": "oxygen",
    "referenceEnglish": "4,4-dimethylhexanoic acid",
    "smiles": "CC(CCC(=O)O)(CC)C",
    "constitutionId": "dedD@@QImZVjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C4-dimethylhexanoic%20acid.json",
    "referenceSha256": "372089577526299f1cf2fdb430a6af7207fb5eedd8e1276fd1deca426205a577",
    "expected": {
      "2013-en": [
        "4,4-dimethylhexanoic acid"
      ],
      "2013-es": [
        "ácido 4,4-dimetilhexanoico"
      ],
      "1979-en": [
        "4,4-dimethylhexanoic acid"
      ],
      "1979-es": [
        "ácido 4,4-dimetilhexanoico"
      ]
    },
    "formula": "C8H16O2",
    "groupCounts": {
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAcid",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-082",
    "category": "oxygen",
    "referenceEnglish": "5-methyloct-2-enoic acid",
    "smiles": "CC(CC=CC(=O)O)CCC",
    "constitutionId": "dmTD@@QImV]ijj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-methyloct-2-enoic%20acid.json",
    "referenceSha256": "bfcbdc5f700cbb6d409d14917220dede7e50a806965ff24d23b8e7e3be578fbe",
    "expected": {
      "2013-en": [
        "5-methyloct-2-enoic acid"
      ],
      "2013-es": [
        "ácido 5-metiloct-2-enoico"
      ],
      "1979-en": [
        "5-methyl-2-octenoic acid"
      ],
      "1979-es": [
        "ácido 5-metil-2-octenoico"
      ]
    },
    "formula": "C9H16O2",
    "groupCounts": {
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAcid",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-083",
    "category": "oxygen",
    "referenceEnglish": "3-hydroxy-2-methylhexanoic acid",
    "smiles": "OC(C(C(=O)O)C)CCC",
    "constitutionId": "dedL@@QlbfbaSUUP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-hydroxy-2-methylhexanoic%20acid.json",
    "referenceSha256": "18eaf689d41012e62864dfa114dda7421071eee77b444357fd8b7d3a2d0c8919",
    "expected": {
      "2013-en": [
        "3-hydroxy-2-methylhexanoic acid"
      ],
      "2013-es": [
        "ácido 3-hidroxi-2-metilhexanoico"
      ],
      "1979-en": [
        "3-hydroxy-2-methylhexanoic acid"
      ],
      "1979-es": [
        "ácido 3-hidroxi-2-metilhexanoico"
      ]
    },
    "formula": "C7H14O3",
    "groupCounts": {
      "alcohol": 1,
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAcid",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-084",
    "category": "oxygen",
    "referenceEnglish": "3-oxooctanoic acid",
    "smiles": "O=C(CC(=O)O)CCCCC",
    "constitutionId": "dmTL@@RdfvuVijh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-oxooctanoic%20acid.json",
    "referenceSha256": "4d2d7cc509dbd2d857bfcc55c52ebd3ce43a9475f2e59e172bf167ea10ffe091",
    "expected": {
      "2013-en": [
        "3-oxooctanoic acid"
      ],
      "2013-es": [
        "ácido 3-oxooctanoico"
      ],
      "1979-en": [
        "3-oxooctanoic acid"
      ],
      "1979-es": [
        "ácido 3-oxooctanoico"
      ]
    },
    "formula": "C8H14O3",
    "groupCounts": {
      "carboxylicAcid": 1,
      "ketone": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAcid",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-085",
    "category": "oxygen",
    "referenceEnglish": "butyl 3-methylpentanoate",
    "smiles": "CC(CC(=O)OCCCC)CC",
    "constitutionId": "dctD@@QIeVWZjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/butyl%203-methylpentanoate.json",
    "referenceSha256": "49608b9d391528ee7a9dc30e7d786c4c10d04e0bf91abdcee23e0d89c54c71ba",
    "expected": {
      "2013-en": [
        "butyl 3-methylpentanoate"
      ],
      "2013-es": [
        "3-metilpentanoato de butilo"
      ],
      "1979-en": [
        "butyl 3-methylpentanoate"
      ],
      "1979-es": [
        "3-metilpentanoato de butilo"
      ]
    },
    "formula": "C10H20O2",
    "groupCounts": {
      "ester": 1
    },
    "primaryGroup": "ester",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEster",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-086",
    "category": "oxygen",
    "referenceEnglish": "propan-2-yl 4-ethylheptanoate",
    "smiles": "C(C)C(CCC(=O)OC(C)C)CCC",
    "constitutionId": "dglD@@SHhdhcDduUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/propan-2-yl%204-ethylheptanoate.json",
    "referenceSha256": "8fab5d4ee5f12e9b3ccb8b8bb8f80834f268b9a8700d4d55e1cfd4e6f196958b",
    "expected": {
      "2013-en": [
        "propan-2-yl 4-ethylheptanoate"
      ],
      "2013-es": [
        "4-etilheptanoato de propan-2-ilo"
      ],
      "1979-en": [
        "propan-2-yl 4-ethylheptanoate"
      ],
      "1979-es": [
        "4-etilheptanoato de propan-2-ilo"
      ]
    },
    "formula": "C12H24O2",
    "groupCounts": {
      "ester": 1
    },
    "primaryGroup": "ester",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEster",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-087",
    "category": "oxygen",
    "referenceEnglish": "ethyl 2,2-dimethylhexanoate",
    "smiles": "CC(C(=O)OCC)(CCCC)C",
    "constitutionId": "dctD@@SHheHeTuUUP@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/ethyl%202%2C2-dimethylhexanoate.json",
    "referenceSha256": "2a653bc99ee72b3aecf2722702b0dab34244c45500b04ca59b3c9c981542dd25",
    "expected": {
      "2013-en": [
        "ethyl 2,2-dimethylhexanoate"
      ],
      "2013-es": [
        "2,2-dimetilhexanoato de etilo"
      ],
      "1979-en": [
        "ethyl 2,2-dimethylhexanoate"
      ],
      "1979-es": [
        "2,2-dimetilhexanoato de etilo"
      ]
    },
    "formula": "C10H20O2",
    "groupCounts": {
      "ester": 1
    },
    "primaryGroup": "ester",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEster",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-088",
    "category": "oxygen",
    "referenceEnglish": "3-ethoxyheptane",
    "smiles": "C(C)OC(CC)CCCC",
    "constitutionId": "dedH@@RfU~jjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethoxyheptane.json",
    "referenceSha256": "0ea1ccf3ad6fad00cb744653c94b38e514309c9d079e193e800d06ccb7363a72",
    "expected": {
      "2013-en": [
        "3-ethoxyheptane"
      ],
      "2013-es": [
        "3-etoxiheptano"
      ],
      "1979-en": [
        "3-ethoxyheptane"
      ],
      "1979-es": [
        "3-etoxiheptano"
      ]
    },
    "formula": "C9H20O",
    "groupCounts": {
      "ether": 1
    },
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEther",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-089",
    "category": "oxygen",
    "referenceEnglish": "4-propoxynonane",
    "smiles": "C(CC)OC(CCC)CCCCC",
    "constitutionId": "dkLH@@RfUU~jjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-propoxynonane.json",
    "referenceSha256": "567a3bd9e2df8b791108b991cee4d7cccfd313c43479baaaaa2b7fe82704fdc6",
    "expected": {
      "2013-en": [
        "4-propoxynonane"
      ],
      "2013-es": [
        "4-propoxinonano"
      ],
      "1979-en": [
        "4-propoxynonane"
      ],
      "1979-es": [
        "4-propoxinonano"
      ]
    },
    "formula": "C12H26O",
    "groupCounts": {
      "ether": 1
    },
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEther",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-090",
    "category": "oxygen",
    "referenceEnglish": "2-methoxy-4-methylheptane",
    "smiles": "COC(C)CC(CCC)C",
    "constitutionId": "dedH@@Rf~^jjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-methoxy-4-methylheptane.json",
    "referenceSha256": "0a71cdab2358a8542099117d69e4bdfc4561b2f476445341f422b3dd3491d05c",
    "expected": {
      "2013-en": [
        "2-methoxy-4-methylheptane"
      ],
      "2013-es": [
        "2-metoxi-4-metilheptano"
      ],
      "1979-en": [
        "2-methoxy-4-methylheptane"
      ],
      "1979-es": [
        "2-metoxi-4-metilheptano"
      ]
    },
    "formula": "C9H20O",
    "groupCounts": {
      "ether": 1
    },
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEther",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-091",
    "category": "nitrogen",
    "referenceEnglish": "4-methyloctan-2-amine",
    "smiles": "CC(CC(C)N)CCCC",
    "constitutionId": "def@@@RYyvjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-methyloctan-2-amine.json",
    "referenceSha256": "e092c7639624379c269e565780eb466c03a908454bf2df10311710aef5fd3f23",
    "expected": {
      "2013-en": [
        "4-methyloctan-2-amine"
      ],
      "2013-es": [
        "4-metiloctan-2-amina"
      ],
      "1979-en": [
        "4-methyl-2-octanamine"
      ],
      "1979-es": [
        "4-metil-2-octanamina"
      ]
    },
    "formula": "C9H21N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-092",
    "category": "nitrogen",
    "referenceEnglish": "3-ethylheptan-1-amine",
    "smiles": "C(C)C(CCN)CCCC",
    "constitutionId": "def@@@RUe^jjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethylheptan-1-amine.json",
    "referenceSha256": "d852ae278a516a84a6557f5476d9effe37f146467ca67755fe6b6a3afc5f76bf",
    "expected": {
      "2013-en": [
        "3-ethylheptan-1-amine"
      ],
      "2013-es": [
        "3-etilheptan-1-amina"
      ],
      "1979-en": [
        "3-ethyl-1-heptanamine"
      ],
      "1979-es": [
        "3-etil-1-heptanamina"
      ]
    },
    "formula": "C9H21N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-093",
    "category": "nitrogen",
    "referenceEnglish": "N-ethylhexan-3-amine",
    "smiles": "C(C)NC(CC)CCC",
    "constitutionId": "diF@@@RfUzjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N-ethylhexan-3-amine.json",
    "referenceSha256": "7f67d10003524af7322cd584146e3c4d77ab918c0d23824dc6f200ec1fd0a4ce",
    "expected": {
      "2013-en": [
        "N-ethylhexan-3-amine"
      ],
      "2013-es": [
        "N-etilhexan-3-amina"
      ],
      "1979-en": [
        "N-ethyl-3-hexanamine"
      ],
      "1979-es": [
        "N-etil-3-hexanamina"
      ]
    },
    "formula": "C8H19N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-094",
    "category": "nitrogen",
    "referenceEnglish": "N,N-dimethylheptan-2-amine",
    "smiles": "CN(C(C)CCCCC)C",
    "constitutionId": "def@@@rRJGIUUU@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N%2CN-dimethylheptan-2-amine.json",
    "referenceSha256": "e7d99a18930627c426c734f8787d5c192c0b558bed0c28b68b14944227526608",
    "expected": {
      "2013-en": [
        "N,N-dimethylheptan-2-amine"
      ],
      "2013-es": [
        "N,N-dimetilheptan-2-amina"
      ],
      "1979-en": [
        "N,N-dimethyl-2-heptanamine"
      ],
      "1979-es": [
        "N,N-dimetil-2-heptanamina"
      ]
    },
    "formula": "C9H21N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-095",
    "category": "nitrogen",
    "referenceEnglish": "N-propylheptan-3-amine",
    "smiles": "C(CC)NC(CC)CCCC",
    "constitutionId": "dmV@@@rQQIIFjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N-propylheptan-3-amine.json",
    "referenceSha256": "59e75316fc5f1a4039b5a597f87cbc00a4ee326e6ce3c8c3e0131b9ea78079b8",
    "expected": {
      "2013-en": [
        "N-propylheptan-3-amine"
      ],
      "2013-es": [
        "N-propilheptan-3-amina"
      ],
      "1979-en": [
        "N-propyl-3-heptanamine"
      ],
      "1979-es": [
        "N-propil-3-heptanamina"
      ]
    },
    "formula": "C10H23N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-096",
    "category": "nitrogen",
    "referenceEnglish": "3-methylheptane-1,6-diamine",
    "smiles": "CC(CCN)CCC(C)N",
    "constitutionId": "dee@@@eIgYzjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-methylheptane-1%2C6-diamine.json",
    "referenceSha256": "618594a66b3191f733e6114d70fd8dce09095e95639863db680e0604a52bb7b2",
    "expected": {
      "2013-en": [
        "3-methylheptane-1,6-diamine"
      ],
      "2013-es": [
        "3-metilheptano-1,6-diamina"
      ],
      "1979-en": [
        "3-methyl-1,6-heptanediamine"
      ],
      "1979-es": [
        "3-metil-1,6-heptanodiamina"
      ]
    },
    "formula": "C8H20N2",
    "groupCounts": {
      "amine": 2
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-097",
    "category": "nitrogen",
    "referenceEnglish": "4-ethylhexane-1,3-diamine",
    "smiles": "C(C)C(C(CCN)N)CC",
    "constitutionId": "dee@@@eIfUZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethylhexane-1%2C3-diamine.json",
    "referenceSha256": "be8554a2b3ba3cb83e1abb87a346659bae7c9ec4e751af64c114c6c955028785",
    "expected": {
      "2013-en": [
        "4-ethylhexane-1,3-diamine"
      ],
      "2013-es": [
        "4-etilhexano-1,3-diamina"
      ],
      "1979-en": [
        "4-ethyl-1,3-hexanediamine"
      ],
      "1979-es": [
        "4-etil-1,3-hexanodiamina"
      ]
    },
    "formula": "C8H20N2",
    "groupCounts": {
      "amine": 2
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-098",
    "category": "nitrogen",
    "referenceEnglish": "4-methylheptanamide",
    "smiles": "CC(CCC(=O)N)CCC",
    "constitutionId": "defH@DAImYvjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-methylheptanamide.json",
    "referenceSha256": "c68eb73ba3599aa4ec6d58504ef1d6100cd873d6d1aa0ddcaa367b11823376d0",
    "expected": {
      "2013-en": [
        "4-methylheptanamide"
      ],
      "2013-es": [
        "4-metilheptanamida"
      ],
      "1979-en": [
        "4-methylheptanamide"
      ],
      "1979-es": [
        "4-metilheptanamida"
      ]
    },
    "formula": "C8H17NO",
    "groupCounts": {
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-099",
    "category": "nitrogen",
    "referenceEnglish": "3-ethyloctanamide",
    "smiles": "C(C)C(CC(=O)N)CCCCC",
    "constitutionId": "dcvH@DAIme]Zjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethyloctanamide.json",
    "referenceSha256": "e178173c9b26eb6e27889137d3d0256f020798c80ec82fc7dc42c14250c60935",
    "expected": {
      "2013-en": [
        "3-ethyloctanamide"
      ],
      "2013-es": [
        "3-etiloctanamida"
      ],
      "1979-en": [
        "3-ethyloctanamide"
      ],
      "1979-es": [
        "3-etiloctanamida"
      ]
    },
    "formula": "C10H21NO",
    "groupCounts": {
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-100",
    "category": "nitrogen",
    "referenceEnglish": "N-ethyl-3-methylhexanamide",
    "smiles": "C(C)NC(CC(CCC)C)=O",
    "constitutionId": "dmVH@DAIeV}jjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N-ethyl-3-methylhexanamide.json",
    "referenceSha256": "e73fba352f4b933f56b222e8e4139e3a37add10377a283a8d59ce86f293d695d",
    "expected": {
      "2013-en": [
        "N-ethyl-3-methylhexanamide"
      ],
      "2013-es": [
        "N-etil-3-metilhexanamida"
      ],
      "1979-en": [
        "N-ethyl-3-methylhexanamide"
      ],
      "1979-es": [
        "N-etil-3-metilhexanamida"
      ]
    },
    "formula": "C9H19NO",
    "groupCounts": {
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-101",
    "category": "nitrogen",
    "referenceEnglish": "N,N-dimethylheptanamide",
    "smiles": "CN(C(CCCCCC)=O)C",
    "constitutionId": "dmVH@DCHhhbdfjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N%2CN-dimethylheptanamide.json",
    "referenceSha256": "ba9f31cd0de054d1cb64ab71fd78a690e209c8223d30ef149a8478270d3dc54e",
    "expected": {
      "2013-en": [
        "N,N-dimethylheptanamide"
      ],
      "2013-es": [
        "N,N-dimetilheptanamida"
      ],
      "1979-en": [
        "N,N-dimethylheptanamide"
      ],
      "1979-es": [
        "N,N-dimetilheptanamida"
      ]
    },
    "formula": "C9H19NO",
    "groupCounts": {
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-102",
    "category": "nitrogen",
    "referenceEnglish": "N-propyl-2-methylpentanamide",
    "smiles": "C(CC)NC(C(CCC)C)=O",
    "constitutionId": "dmVH@DAIeeujjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N-propyl-2-methylpentanamide.json",
    "referenceSha256": "c3a99dedc5941fa9e5a327c5fc53668f796c6aa94c239571939edfa2204f4e49",
    "expected": {
      "2013-en": [
        "N-propyl-2-methylpentanamide"
      ],
      "2013-es": [
        "N-propil-2-metilpentanamida"
      ],
      "1979-en": [
        "N-propyl-2-methylpentanamide"
      ],
      "1979-es": [
        "N-propil-2-metilpentanamida"
      ]
    },
    "formula": "C9H19NO",
    "groupCounts": {
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-103",
    "category": "nitrogen",
    "referenceEnglish": "hexanediamide",
    "smiles": "C(CCCCC(=O)N)(=O)N",
    "constitutionId": "deeD@DdAR[UYjjX@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/hexanediamide.json",
    "referenceSha256": "d751ed0be0588e5b05032b7b309be6535b2c5a2c3fdaf19eb6bf4936b8dbc998",
    "expected": {
      "2013-en": [
        "hexanediamide"
      ],
      "2013-es": [
        "hexanodiamida"
      ],
      "1979-en": [
        "hexanediamide"
      ],
      "1979-es": [
        "hexanodiamida"
      ]
    },
    "formula": "C6H12N2O2",
    "groupCounts": {
      "amide": 2
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-104",
    "category": "nitrogen",
    "referenceEnglish": "4-ethylheptanenitrile",
    "smiles": "C(C)C(CCC#N)CCC",
    "constitutionId": "def@@@RUYWjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethylheptanenitrile.json",
    "referenceSha256": "28256c2716be715ebd969fc800fd4fec7d831bcbb2ecde8d578dc14512838d4c",
    "expected": {
      "2013-en": [
        "4-ethylheptanenitrile"
      ],
      "2013-es": [
        "4-etilheptanenitrilo"
      ],
      "1979-en": [
        "4-ethylheptanenitrile"
      ],
      "1979-es": [
        "4-etilheptanenitrilo"
      ]
    },
    "formula": "C9H17N",
    "groupCounts": {
      "nitrile": 1
    },
    "primaryGroup": "nitrile",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalNitrile",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-105",
    "category": "nitrogen",
    "referenceEnglish": "heptanedinitrile",
    "smiles": "C(CCCCCC#N)#N",
    "constitutionId": "diE@@@EIUUzjl@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/heptanedinitrile.json",
    "referenceSha256": "c6ee49d3a87cdf91a6a5700ff35aad14e2df228c256b32b86b74aee1662493a2",
    "expected": {
      "2013-en": [
        "heptanedinitrile"
      ],
      "2013-es": [
        "heptanodinitrilo"
      ],
      "1979-en": [
        "heptanedinitrile"
      ],
      "1979-es": [
        "heptanodinitrilo"
      ]
    },
    "formula": "C7H10N2",
    "groupCounts": {
      "nitrile": 2
    },
    "primaryGroup": "nitrile",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalNitrile",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-106",
    "category": "nitrogen",
    "referenceEnglish": "2-ethyl-4-methylbenzonitrile",
    "smiles": "C(C)C1=C(C#N)C=CC(=C1)C",
    "constitutionId": "dmv@@@RVYWx^@`h@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-ethyl-4-methylbenzonitrile.json",
    "referenceSha256": "702fb2a878341f1019b66bc0f906c1881f5a5bb60d22154186010266300bd040",
    "expected": {
      "2013-en": [
        "2-ethyl-4-methylbenzonitrile"
      ],
      "2013-es": [
        "2-etil-4-metilbenzonitrilo"
      ],
      "1979-en": [
        "2-ethyl-4-methylbenzonitrile"
      ],
      "1979-es": [
        "2-etil-4-metilbenzonitrilo"
      ]
    },
    "formula": "C10H11N",
    "groupCounts": {
      "nitrile": 1
    },
    "primaryGroup": "nitrile",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalNitrile",
      "modernNitrogen",
      "historicalNAmide",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-107",
    "category": "nitrogen",
    "referenceEnglish": "3,5-dimethylaniline",
    "smiles": "CC=1C=C(N)C=C(C1)C",
    "constitutionId": "dif@@@RYVZZ@B`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C5-dimethylaniline.json",
    "referenceSha256": "9e657d722f00b65a5d335f4de58531ab5fe78f3c85a4351ed8becd6bcf931a5a",
    "expected": {
      "2013-en": [
        "3,5-dimethylaniline"
      ],
      "2013-es": [
        "3,5-dimetilanilina"
      ],
      "1979-en": [
        "3,5-dimethylaniline"
      ],
      "1979-es": [
        "3,5-dimetilanilina"
      ]
    },
    "formula": "C8H11N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-108",
    "category": "nitrogen",
    "referenceEnglish": "3-ethyl-4-methylbenzamide",
    "smiles": "C(C)C=1C=C(C(=O)N)C=CC1C",
    "constitutionId": "dcNH@DAInUmxV`@j@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-ethyl-4-methylbenzamide.json",
    "referenceSha256": "6ac076dbc8518cda66754c2f8ae3b3e027bc34e8986958bf2f0650c93f460d31",
    "expected": {
      "2013-en": [
        "3-ethyl-4-methylbenzamide"
      ],
      "2013-es": [
        "3-etil-4-metilbenzamida"
      ],
      "1979-en": [
        "3-ethyl-4-methylbenzamide"
      ],
      "1979-es": [
        "3-etil-4-metilbenzamida"
      ]
    },
    "formula": "C10H13NO",
    "groupCounts": {
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-109",
    "category": "nitrogen",
    "referenceEnglish": "N-ethyl-N-methyl-4-propylaniline",
    "smiles": "C(C)N(C1=CC=C(C=C1)CCC)C",
    "constitutionId": "dkn@@@Rig_TYjB@j@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/N-ethyl-N-methyl-4-propylaniline.json",
    "referenceSha256": "9d7cf5dd83123a122e15a365886faf0756c1a1706df5c4cd82c534dddb1a6563",
    "expected": {
      "2013-en": [
        "N-ethyl-N-methyl-4-propylaniline"
      ],
      "2013-es": [
        "N-etil-N-metil-4-propilanilina"
      ],
      "1979-en": [
        "N-ethyl-N-methyl-4-propylaniline"
      ],
      "1979-es": [
        "N-etil-N-metil-4-propilanilina"
      ]
    },
    "formula": "C12H19N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-110",
    "category": "nitrogen",
    "referenceEnglish": "4,6-dimethylnonan-3-amine",
    "smiles": "CC(C(CC)N)CC(CCC)C",
    "constitutionId": "dcv@@@rJJIFKUUUT@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4%2C6-dimethylnonan-3-amine.json",
    "referenceSha256": "3792693bdd11c90f451e46cc837283e304a030ef120c66bde1f3c3cbea9f8ac9",
    "expected": {
      "2013-en": [
        "4,6-dimethylnonan-3-amine"
      ],
      "2013-es": [
        "4,6-dimetilnonan-3-amina"
      ],
      "1979-en": [
        "4,6-dimethyl-3-nonanamine"
      ],
      "1979-es": [
        "4,6-dimetil-3-nonanamina"
      ]
    },
    "formula": "C11H25N",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-111",
    "category": "mixed",
    "referenceEnglish": "4-amino-3-hydroxyheptanoic acid",
    "smiles": "NC(C(CC(=O)O)O)CCC",
    "constitutionId": "dmVL@NAJR[[mZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-amino-3-hydroxyheptanoic%20acid.json",
    "referenceSha256": "e4f35a3a4f92b51ba7be9be17c3ed348c53b6ddd6ac286124ffdb1a70d44659f",
    "expected": {
      "2013-en": [
        "4-amino-3-hydroxyheptanoic acid"
      ],
      "2013-es": [
        "ácido 4-amino-3-hidroxiheptanoico"
      ],
      "1979-en": [
        "4-amino-3-hydroxyheptanoic acid"
      ],
      "1979-es": [
        "ácido 4-amino-3-hidroxiheptanoico"
      ]
    },
    "formula": "C7H15NO3",
    "groupCounts": {
      "alcohol": 1,
      "amine": 1,
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAmine",
      "historicalAcid",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-112",
    "category": "mixed",
    "referenceEnglish": "6-amino-4-oxoheptanoic acid",
    "smiles": "NC(CC(CCC(=O)O)=O)C",
    "constitutionId": "dmVL@IAFR[VvZij`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-amino-4-oxoheptanoic%20acid.json",
    "referenceSha256": "5dfd3e5857e9561690c3f70f62915f649e0d11acc9304da49822039c6b39f694",
    "expected": {
      "2013-en": [
        "6-amino-4-oxoheptanoic acid"
      ],
      "2013-es": [
        "ácido 6-amino-4-oxoheptanoico"
      ],
      "1979-en": [
        "6-amino-4-oxoheptanoic acid"
      ],
      "1979-es": [
        "ácido 6-amino-4-oxoheptanoico"
      ]
    },
    "formula": "C7H13NO3",
    "groupCounts": {
      "amine": 1,
      "carboxylicAcid": 1,
      "ketone": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "historicalAcid",
      "historicalKetone",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-113",
    "category": "mixed",
    "referenceEnglish": "5-hydroxy-3-methyloctanenitrile",
    "smiles": "OC(CC(CC#N)C)CCC",
    "constitutionId": "dmVH@ECHhdhdZjjl@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-hydroxy-3-methyloctanenitrile.json",
    "referenceSha256": "7f16d0b2cf5012b25f552681fc5c2b543edb979b93061e0fc5eca18668f882c9",
    "expected": {
      "2013-en": [
        "5-hydroxy-3-methyloctanenitrile"
      ],
      "2013-es": [
        "5-hidroxi-3-metiloctanenitrilo"
      ],
      "1979-en": [
        "5-hydroxy-3-methyloctanenitrile"
      ],
      "1979-es": [
        "5-hidroxi-3-metiloctanenitrilo"
      ]
    },
    "formula": "C9H17NO",
    "groupCounts": {
      "alcohol": 1,
      "nitrile": 1
    },
    "primaryGroup": "nitrile",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalNitrile",
      "modernNitrogen",
      "historicalNAmide",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-114",
    "category": "mixed",
    "referenceEnglish": "3-amino-5-hydroxyheptanal",
    "smiles": "NC(CC=O)CC(CC)O",
    "constitutionId": "defD@BCde[[Zjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-amino-5-hydroxyheptanal.json",
    "referenceSha256": "ef9d40805a18972013e7146f70b6ad55bfc2e8b1733d9b468a82501158766f2b",
    "expected": {
      "2013-en": [
        "3-amino-5-hydroxyheptanal"
      ],
      "2013-es": [
        "3-amino-5-hidroxiheptanal"
      ],
      "1979-en": [
        "3-amino-5-hydroxyheptanal"
      ],
      "1979-es": [
        "3-amino-5-hidroxiheptanal"
      ]
    },
    "formula": "C7H15NO2",
    "groupCounts": {
      "alcohol": 1,
      "aldehyde": 1,
      "amine": 1
    },
    "primaryGroup": "aldehyde",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAldehyde",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "modernNitrogen",
      "historicalNAmide"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-115",
    "category": "mixed",
    "referenceEnglish": "4-hydroxy-2-methylhexanamide",
    "smiles": "OC(CC(C(=O)N)C)CC",
    "constitutionId": "defD@DCdfy{Zjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-hydroxy-2-methylhexanamide.json",
    "referenceSha256": "bb968a9d27c6033eacf4239226ce31c49d8a7e795342f3413747d797fdd27637",
    "expected": {
      "2013-en": [
        "4-hydroxy-2-methylhexanamide"
      ],
      "2013-es": [
        "4-hidroxi-2-metilhexanamida"
      ],
      "1979-en": [
        "4-hydroxy-2-methylhexanamide"
      ],
      "1979-es": [
        "4-hidroxi-2-metilhexanamida"
      ]
    },
    "formula": "C7H15NO2",
    "groupCounts": {
      "alcohol": 1,
      "amide": 1
    },
    "primaryGroup": "amide",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAmide",
      "modernNitrogen",
      "historicalNAmide",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-116",
    "category": "mixed",
    "referenceEnglish": "ethyl 4-amino-3-oxopentanoate",
    "smiles": "NC(C(CC(=O)OCC)=O)C",
    "constitutionId": "dmVL@IANrJIIPqjij@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/ethyl%204-amino-3-oxopentanoate.json",
    "referenceSha256": "2ae6a881280d15a3a4bf2c5b482546922d8d36f65fbdd64e7bd13ae1c81af621",
    "expected": {
      "2013-en": [
        "ethyl 4-amino-3-oxopentanoate"
      ],
      "2013-es": [
        "4-amino-3-oxopentanoato de etilo"
      ],
      "1979-en": [
        "ethyl 4-amino-3-oxopentanoate"
      ],
      "1979-es": [
        "4-amino-3-oxopentanoato de etilo"
      ]
    },
    "formula": "C7H13NO3",
    "groupCounts": {
      "amine": 1,
      "ester": 1,
      "ketone": 1
    },
    "primaryGroup": "ester",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "historicalEster",
      "historicalKetone",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-117",
    "category": "mixed",
    "referenceEnglish": "5-bromo-3-hydroxyheptan-2-one",
    "smiles": "BrC(CC(C(C)=O)O)CC",
    "constitutionId": "dedD`FDLSHhdhYUUL@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/5-bromo-3-hydroxyheptan-2-one.json",
    "referenceSha256": "525f885157698ee3fcaf44d4fbd62d04eec0074f8153ed58f68508ac9f77a8a0",
    "expected": {
      "2013-en": [
        "5-bromo-3-hydroxyheptan-2-one"
      ],
      "2013-es": [
        "5-bromo-3-hidroxiheptan-2-ona"
      ],
      "1979-en": [
        "5-bromo-3-hydroxy-2-heptanone"
      ],
      "1979-es": [
        "5-bromo-3-hidroxi-2-heptanona"
      ]
    },
    "formula": "C7H13BrO2",
    "groupCounts": {
      "alcohol": 1,
      "halogen": 1,
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-118",
    "category": "mixed",
    "referenceEnglish": "4-chloro-2-ethoxyhexan-1-ol",
    "smiles": "ClC(CC(CO)OCC)CC",
    "constitutionId": "dmTD`FdHaIe[Vjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-chloro-2-ethoxyhexan-1-ol.json",
    "referenceSha256": "a6ce26ec38d1a487ae50a532b9decd4ece1616103d8c4ff102ec43272fc7e816",
    "expected": {
      "2013-en": [
        "4-chloro-2-ethoxyhexan-1-ol"
      ],
      "2013-es": [
        "4-cloro-2-etoxihexan-1-ol"
      ],
      "1979-en": [
        "4-chloro-2-ethoxy-1-hexanol"
      ],
      "1979-es": [
        "4-cloro-2-etoxi-1-hexanol"
      ]
    },
    "formula": "C8H17ClO2",
    "groupCounts": {
      "alcohol": 1,
      "ether": 1,
      "halogen": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalEther",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-119",
    "category": "mixed",
    "referenceEnglish": "3-amino-2-methylheptan-4-ol",
    "smiles": "NC(C(C)C)C(CCC)O",
    "constitutionId": "defH@BAIf^Zjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-amino-2-methylheptan-4-ol.json",
    "referenceSha256": "997c1d52ac085f4161ecd8335598c98db5ae4e079bbda84299eb32a3739cefd4",
    "expected": {
      "2013-en": [
        "3-amino-2-methylheptan-4-ol"
      ],
      "2013-es": [
        "3-amino-2-metilheptan-4-ol"
      ],
      "1979-en": [
        "3-amino-2-methyl-4-heptanol"
      ],
      "1979-es": [
        "3-amino-2-metil-4-heptanol"
      ]
    },
    "formula": "C8H19NO",
    "groupCounts": {
      "alcohol": 1,
      "amine": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-120",
    "category": "mixed",
    "referenceEnglish": "4-ethoxy-3-methoxyheptan-2-one",
    "smiles": "C(C)OC(C(C(C)=O)OC)CCC",
    "constitutionId": "dkLL@@Kdf[[UZjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-ethoxy-3-methoxyheptan-2-one.json",
    "referenceSha256": "6c7293c71cc9b9c6faf2283c14d5709c905f2b735b8a8fa73c56c745059bac6d",
    "expected": {
      "2013-en": [
        "4-ethoxy-3-methoxyheptan-2-one"
      ],
      "2013-es": [
        "4-etoxi-3-metoxiheptan-2-ona"
      ],
      "1979-en": [
        "4-ethoxy-3-methoxy-2-heptanone"
      ],
      "1979-es": [
        "4-etoxi-3-metoxi-2-heptanona"
      ]
    },
    "formula": "C10H20O3",
    "groupCounts": {
      "ether": 2,
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalEther",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-121",
    "category": "mixed",
    "referenceEnglish": "3,5-dihydroxybenzoic acid",
    "smiles": "OC=1C=C(C(=O)O)C=C(C1)O",
    "constitutionId": "dmtB@@PUR[eYzV`BH@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3%2C5-dihydroxybenzoic%20acid.json",
    "referenceSha256": "cc8d92f6dbd2bbe33b311d81c6d312dc9182d606f443899ff11c3bbf7f245ede",
    "expected": {
      "2013-en": [
        "3,5-dihydroxybenzoic acid"
      ],
      "2013-es": [
        "ácido 3,5-dihidroxibenzoico"
      ],
      "1979-en": [
        "3,5-dihydroxybenzoic acid"
      ],
      "1979-es": [
        "ácido 3,5-dihidroxibenzoico"
      ]
    },
    "formula": "C7H6O4",
    "groupCounts": {
      "alcohol": 2,
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAcid",
      "modernFunctions",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-122",
    "category": "mixed",
    "referenceEnglish": "4-amino-2-ethylbenzoic acid",
    "smiles": "NC1=CC(=C(C(=O)O)C=C1)CC",
    "constitutionId": "dcND@MADfye\\YZ@`h@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-amino-2-ethylbenzoic%20acid.json",
    "referenceSha256": "797e14ca28a5b1e7392b511db09a22d8e05d85b4b9d25752d8d3e80c08a4d046",
    "expected": {
      "2013-en": [
        "4-amino-2-ethylbenzoic acid"
      ],
      "2013-es": [
        "ácido 4-amino-2-etilbenzoico"
      ],
      "1979-en": [
        "4-amino-2-ethylbenzoic acid"
      ],
      "1979-es": [
        "ácido 4-amino-2-etilbenzoico"
      ]
    },
    "formula": "C9H11NO2",
    "groupCounts": {
      "amine": 1,
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "historicalAcid",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-123",
    "category": "mixed",
    "referenceEnglish": "3-cyano-4-methylbenzoic acid",
    "smiles": "C(#N)C=1C=C(C(=O)O)C=CC1C",
    "constitutionId": "dcND@EADfyVwiZ@Hx@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-cyano-4-methylbenzoic%20acid.json",
    "referenceSha256": "71e23628feecf3daff4d9e8f15c52c1f6a47543f78bc1e01d226c1fa6ab1a6bd",
    "expected": {
      "2013-en": [
        "3-cyano-4-methylbenzoic acid"
      ],
      "2013-es": [
        "ácido 3-ciano-4-metilbenzoico"
      ],
      "1979-en": [
        "3-cyano-4-methylbenzoic acid"
      ],
      "1979-es": [
        "ácido 3-ciano-4-metilbenzoico"
      ]
    },
    "formula": "C9H7NO2",
    "groupCounts": {
      "carboxylicAcid": 1,
      "nitrile": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAcid",
      "historicalNitrile",
      "modernNitrogen",
      "historicalNAmide",
      "modernFunctions",
      "historicalRings"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-124",
    "category": "mixed",
    "referenceEnglish": "6-hydroxy-4-methylhept-2-enoic acid",
    "smiles": "OC(CC(C=CC(=O)O)C)C",
    "constitutionId": "dmTL@@RTfugffjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/6-hydroxy-4-methylhept-2-enoic%20acid.json",
    "referenceSha256": "cf1cffe4c5fa0be56053ecdabb85d872d29c6bb4bd16edbedd63cb74df7e41a7",
    "expected": {
      "2013-en": [
        "6-hydroxy-4-methylhept-2-enoic acid"
      ],
      "2013-es": [
        "ácido 6-hidroxi-4-metilhept-2-enoico"
      ],
      "1979-en": [
        "6-hydroxy-4-methyl-2-heptenoic acid"
      ],
      "1979-es": [
        "ácido 6-hidroxi-4-metil-2-heptenoico"
      ]
    },
    "formula": "C8H14O3",
    "groupCounts": {
      "alcohol": 1,
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalAcid",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-125",
    "category": "mixed",
    "referenceEnglish": "4-hydroxy-3-methylideneheptan-2-one",
    "smiles": "OC(C(C(C)=O)=C)CCC",
    "constitutionId": "dedD@@[HhhYdtuT@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/4-hydroxy-3-methylideneheptan-2-one.json",
    "referenceSha256": "a5513652539c21546cb436dc3462151cced753da913c2c2d7964a8a912bcbf3a",
    "expected": {
      "2013-en": [
        "4-hydroxy-3-methylideneheptan-2-one"
      ],
      "2013-es": [
        "4-hidroxi-3-metilidenoheptan-2-ona"
      ],
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C8H14O2",
    "groupCounts": {
      "alcohol": 1,
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "historicalKetone",
      "modernFunctions"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-126",
    "category": "stereo",
    "referenceEnglish": "(4S)-4-methylnonan-2-one",
    "smiles": "C[C@H](CC(C)=O)CCCCC",
    "constitutionId": "dmTH@@RYyuZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(4S)-4-methylnonan-2-one.json",
    "referenceSha256": "9e4d00fddec339a2c1a63e0d9fcc57837a010ffae480bae4b75cd867066454ef",
    "expected": {
      "2013-en": [
        "(4S)-4-methylnonan-2-one"
      ],
      "2013-es": [
        "(4S)-4-metilnonan-2-ona"
      ],
      "1979-en": [
        "(4S)-4-methyl-2-nonanone"
      ],
      "1979-es": [
        "(4S)-4-metil-2-nonanona"
      ]
    },
    "formula": "C10H20O",
    "groupCounts": {
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalKetone",
      "modernFunctions",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-127",
    "category": "stereo",
    "referenceEnglish": "(2R,4S)-4-ethylheptan-2-ol",
    "smiles": "C(C)[C@H](C[C@@H](C)O)CCC",
    "constitutionId": "dedH@@RYyVjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(2R%2C4S)-4-ethylheptan-2-ol.json",
    "referenceSha256": "1bf785e37170113db255c5e4d05dd85afa1ff241503b5dd8662134edbf0d1c65",
    "expected": {
      "2013-en": [
        "(2R,4S)-4-ethylheptan-2-ol"
      ],
      "2013-es": [
        "(2R,4S)-4-etilheptan-2-ol"
      ],
      "1979-en": [
        "(2R,4S)-4-ethyl-2-heptanol"
      ],
      "1979-es": [
        "(2R,4S)-4-etil-2-heptanol"
      ]
    },
    "formula": "C9H20O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-128",
    "category": "stereo",
    "referenceEnglish": "(3R,5S)-3,5-dimethyloctane",
    "smiles": "C[C@H](CC)C[C@H](CCC)C",
    "constitutionId": "ded@@DjWejjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(3R%2C5S)-3%2C5-dimethyloctane.json",
    "referenceSha256": "3204a8903be7102dda3b96ea9c47d7123a0eb5340c7d7db80e0879df2d15eea9",
    "expected": {
      "2013-en": [
        "(3R,5S)-3,5-dimethyloctane"
      ],
      "2013-es": [
        "(3R,5S)-3,5-dimetiloctano"
      ],
      "1979-en": [
        "(3R,5S)-3,5-dimethyloctane"
      ],
      "1979-es": [
        "(3R,5S)-3,5-dimetiloctano"
      ]
    },
    "formula": "C10H22",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-129",
    "category": "stereo",
    "referenceEnglish": "(2E)-4-ethyldec-2-ene",
    "smiles": "C(C)C(/C=C/C)CCCCCC",
    "constitutionId": "dct@@Di[WUjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(2E)-4-ethyldec-2-ene.json",
    "referenceSha256": "a22b3704c08a5742bead727a6c00bc7aab950049848b4534b3ef2a2451e0cd65",
    "expected": {
      "2013-en": [
        "(2E)-4-ethyldec-2-ene"
      ],
      "2013-es": [
        "(2E)-4-etildec-2-eno"
      ],
      "1979-en": [
        "(2E)-4-ethyl-2-decene"
      ],
      "1979-es": [
        "(2E)-4-etil-2-deceno"
      ]
    },
    "formula": "C12H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-130",
    "category": "stereo",
    "referenceEnglish": "(3Z)-6-methylundec-3-ene",
    "smiles": "CC(C\\C=C/CC)CCCCC",
    "constitutionId": "dct@@DiUoUjjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(3Z)-6-methylundec-3-ene.json",
    "referenceSha256": "9e03dba5e3b77f090de2fbd8f7a4f9affbb0c1f7eddb35017aef56666fa1590a",
    "expected": {
      "2013-en": [
        "(3Z)-6-methylundec-3-ene"
      ],
      "2013-es": [
        "(3Z)-6-metilundec-3-eno"
      ],
      "1979-en": [
        "(3Z)-6-methyl-3-undecene"
      ],
      "1979-es": [
        "(3Z)-6-metil-3-undeceno"
      ]
    },
    "formula": "C12H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-131",
    "category": "stereo",
    "referenceEnglish": "(2E,5Z)-4-methylnona-2,5-diene",
    "smiles": "CC(/C=C/C)\\C=C/CCC",
    "constitutionId": "ded@@DiY]ZjZ@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(2E%2C5Z)-4-methylnona-2%2C5-diene.json",
    "referenceSha256": "d102e31d96ae954078a9a1483c15a0994decda80d41b74345e8b8ed332a1d84c",
    "expected": {
      "2013-en": [
        "(2E,5Z)-4-methylnona-2,5-diene"
      ],
      "2013-es": [
        "(2E,5Z)-4-metilnona-2,5-dieno"
      ],
      "1979-en": [
        "(2E,5Z)-4-methyl-2,5-nonadiene"
      ],
      "1979-es": [
        "(2E,5Z)-4-metil-2,5-nonadieno"
      ]
    },
    "formula": "C10H18",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-132",
    "category": "stereo",
    "referenceEnglish": "(2R,3E)-5-methylhept-3-en-2-ol",
    "smiles": "CC(/C=C/[C@@H](C)O)CC",
    "constitutionId": "diDH@@RYvZfj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(2R%2C3E)-5-methylhept-3-en-2-ol.json",
    "referenceSha256": "77bf20772be578623a5d69f31c29b16f517188661620e4579ab7f7d3adb538e7",
    "expected": {
      "2013-en": [
        "(2R,3E)-5-methylhept-3-en-2-ol"
      ],
      "2013-es": [
        "(2R,3E)-5-metilhept-3-en-2-ol"
      ],
      "1979-en": [
        "(2R,3E)-5-methyl-3-hepten-2-ol"
      ],
      "1979-es": [
        "(2R,3E)-5-metil-3-hepten-2-ol"
      ]
    },
    "formula": "C8H16O",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-133",
    "category": "stereo",
    "referenceEnglish": "(2S,4R)-2-amino-4-methylheptanoic acid",
    "smiles": "N[C@H](C(=O)O)C[C@@H](CCC)C",
    "constitutionId": "dmVD@BADf{Yvjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(2S%2C4R)-2-amino-4-methylheptanoic%20acid.json",
    "referenceSha256": "bca8c69dfd6b4b2d40531285372f3c3bc72cbc0024ff98a611bc222c5ef23b01",
    "expected": {
      "2013-en": [
        "(2S,4R)-2-amino-4-methylheptanoic acid"
      ],
      "2013-es": [
        "ácido (2S,4R)-2-amino-4-metilheptanoico"
      ],
      "1979-en": [
        "(2S,4R)-2-amino-4-methylheptanoic acid"
      ],
      "1979-es": [
        "ácido (2S,4R)-2-amino-4-metilheptanoico"
      ]
    },
    "formula": "C8H17NO2",
    "groupCounts": {
      "amine": 1,
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "historicalAcid",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-134",
    "category": "stereo",
    "referenceEnglish": "(1R,2S)-1-ethyl-2-methylcyclopentane",
    "smiles": "C(C)[C@H]1[C@H](CCC1)C",
    "constitutionId": "daD@@DjYRZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(1R%2C2S)-1-ethyl-2-methylcyclopentane.json",
    "referenceSha256": "0432df36e59c83d82f1a2466e9a9b57aa01dae7c2858bedbbc0579b39f6ef3e0",
    "expected": {
      "2013-en": [
        "(1R,2S)-1-ethyl-2-methylcyclopentane"
      ],
      "2013-es": [
        "(1R,2S)-1-etil-2-metilciclopentano"
      ],
      "1979-en": [
        "(1R,2S)-1-ethyl-2-methylcyclopentane"
      ],
      "1979-es": [
        "(1R,2S)-1-etil-2-metilciclopentano"
      ]
    },
    "formula": "C8H16",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalRings",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-135",
    "category": "stereo",
    "referenceEnglish": "(3R)-3-methyldodecane",
    "smiles": "C[C@H](CC)CCCCCCCCC",
    "constitutionId": "dkL@@DjWuUjjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/(3R)-3-methyldodecane.json",
    "referenceSha256": "a2f95bf2a3eb2933a67d37bb67ef043671a2eca708c63508df755180a1904e95",
    "expected": {
      "2013-en": [
        "(3R)-3-methyldodecane"
      ],
      "2013-es": [
        "(3R)-3-metildodecano"
      ],
      "1979-en": [
        "(3R)-3-methyldodecane"
      ],
      "1979-es": [
        "(3R)-3-metildodecano"
      ]
    },
    "formula": "C13H28",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernStereo"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": []
  },
  {
    "id": "V014-136",
    "category": "limits",
    "referenceEnglish": "7-methyl-9H-purin-6-amine",
    "smiles": "CN1CNC2=NC=NC(=C12)N",
    "constitutionId": "dmN`@@rfUJY{fnEP`bh`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/7-methyl-9H-purin-6-amine.json",
    "referenceSha256": "1b73342e1cf7f75ae3728e51ca0f0e48541b699f77ed393205e71d2ca3cc693c",
    "expected": {
      "2013-en": [
        "7-methyl-9H-purin-6-amine"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C6H9N5",
    "groupCounts": {
      "amine": 3
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication",
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-137",
    "category": "limits",
    "referenceEnglish": "quinolin-6-ol",
    "smiles": "N1=CC=CC2=CC(=CC=C12)O",
    "constitutionId": "dmNH@AAIe[VfeX@@@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/quinolin-6-ol.json",
    "referenceSha256": "9bdca40826315eb4af4e1d0013a0f3a0032f09760f55ef0e4aae3fd183b1c3f3",
    "expected": {
      "2013-en": [
        "quinolin-6-ol"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C9H7NO",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication",
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-138",
    "category": "limits",
    "referenceEnglish": "2-ethylbenzofuran",
    "smiles": "C(C)C=1OC2=C(C1)C=CC=C2",
    "constitutionId": "dmLH@@RfY]raV`XH`@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-ethylbenzofuran.json",
    "referenceSha256": "6c14f910e0847d9608aaf35e24a3b660d9652dd1a1917d2ced59b5f97c61c67b",
    "expected": {
      "2013-en": [
        "2-ethylbenzofuran"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C10H10O",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication",
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-139",
    "category": "limits",
    "referenceEnglish": "3-methyl-1H-indole",
    "smiles": "CC1=CNC2=CC=CC=C12",
    "constitutionId": "dev@@@RfUWJzZABH@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/3-methyl-1H-indole.json",
    "referenceSha256": "b768940a041a676b8d2487d3d148ad3db2bae44a175c9fcf389b3fa4e7fb083d",
    "expected": {
      "2013-en": [
        "3-methyl-1H-indole"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C9H9N",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication",
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-140",
    "category": "limits",
    "referenceEnglish": "adamantan-2-one",
    "smiles": "C12C(C3CC(CC(C1)C3)C2)=O",
    "constitutionId": "dmlH@@rJJJIEazYUjjjj@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/adamantan-2-one.json",
    "referenceSha256": "c10c6def2526821215e21275f154d06cb56f25e094eeb196bf13c5ac98c989e7",
    "expected": {
      "2013-en": [
        "adamantan-2-one"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C10H14O",
    "groupCounts": {
      "ketone": 1
    },
    "primaryGroup": "ketone",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalKetone",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-141",
    "category": "limits",
    "referenceEnglish": "1,3,5,7-tetramethyladamantane",
    "smiles": "CC12CC3(CC(CC(C1)(C3)C)(C2)C)C",
    "constitutionId": "fgA@@@Dje^fVByKfjjjjjh@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C3%2C5%2C7-tetramethyladamantane.json",
    "referenceSha256": "a88039e43c3c52a3e8fba84c40b2792c4c9bb0a5e6be636cd8c7db3f0291297f",
    "expected": {
      "2013-en": [
        "1,3,5,7-tetramethyladamantane"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C14H24",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-142",
    "category": "limits",
    "referenceEnglish": "1,4-dimethylcubane",
    "smiles": "CC12C3C4C5(C3C1C5C24)C",
    "constitutionId": "de\\@@LddTQJUcYsCpuUUUT@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/1%2C4-dimethylcubane.json",
    "referenceSha256": "194d6fc334e8b6634a46e97a65fdf403dd4535ada1f8f045b3a3a3b44bd72180",
    "expected": {
      "2013-en": [
        "1,4-dimethylcubane"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C10H12",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-143",
    "category": "limits",
    "referenceEnglish": "sodium 3-methylbutanoate",
    "smiles": "CC(CC(=O)[O-])C.[Na+]",
    "constitutionId": "daXDaHpM@IsdEmfj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/sodium%203-methylbutanoate.json",
    "referenceSha256": "73b0eafc4865e21b292fa5367e7662c762a21c82cdf257e0690058935d0a521a",
    "expected": {
      "2013-en": [
        "sodium 3-methylbutanoate"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C5H9NaO2",
    "groupCounts": {
      "carboxylicAcid": 1
    },
    "primaryGroup": "carboxylicAcid",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAcid",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-144",
    "category": "limits",
    "referenceEnglish": "propyltrimethylammonium chloride",
    "smiles": "[Cl-].C(CC)[N+](C)(C)C",
    "constitutionId": "daZ@aHBHChg@iHkUT@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/propyltrimethylammonium%20chloride.json",
    "referenceSha256": "7b4e48497db9734e12ef33767e819f1be06d5a0359334baad41356aa84c8a1dd",
    "expected": {
      "2013-en": [
        "propyltrimethylammonium chloride"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C6H16ClN",
    "groupCounts": {
      "amine": 1
    },
    "primaryGroup": "amine",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAmine",
      "modernFunctions",
      "historicalSecondaryAmine",
      "historicalPolyamine",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-145",
    "category": "limits",
    "referenceEnglish": "diethyl sulfone",
    "smiles": "C(C)S(=O)(=O)CC",
    "constitutionId": "gNphH`DYIHTmT@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/diethyl%20sulfone.json",
    "referenceSha256": "8f1631e7fd2bd7563a3a3efe05cc543e36b1ef25a763d5779657de86059bb62c",
    "expected": {
      "2013-en": [
        "diethyl sulfone"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C4H10O2S",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-146",
    "category": "limits",
    "referenceEnglish": "triethyl phosphate",
    "smiles": "P(=O)(OCC)(OCC)OCC",
    "constitutionId": "dmTB`HSBCpRjuUZjj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/triethyl%20phosphate.json",
    "referenceSha256": "1dd946ac7040e1f5addb2ec6c4e30785ddd9f11c149f671ff090f0cc825a2979",
    "expected": {
      "2013-en": [
        "triethyl phosphate"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C6H15O4P",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-147",
    "category": "limits",
    "referenceEnglish": "2-(diphenylphosphanyl)ethan-1-ol",
    "smiles": "C1(=CC=CC=C1)P(CCO)C1=CC=CC=C1",
    "constitutionId": "f`qAB@K@|DjYeUWTxwj`B@H@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2-(diphenylphosphanyl)ethan-1-ol.json",
    "referenceSha256": "5d1d4479a7cd3a7ce07d297348c29c7aba19d9e1690bb9efc2fd06f0cd7044d2",
    "expected": {
      "2013-en": [
        "2-(diphenylphosphanyl)ethan-1-ol"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C14H15OP",
    "groupCounts": {
      "alcohol": 1
    },
    "primaryGroup": "alcohol",
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "historicalAlcohol",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-148",
    "category": "limits",
    "referenceEnglish": "2,2-dimethylbutanethioamide",
    "smiles": "CC(C(N)=S)(CC)C",
    "constitutionId": "daz@`D@HR[iZj`@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C2-dimethylbutanethioamide.json",
    "referenceSha256": "0e35994a6786ae1cf4140d60687e6cb2690dfc5e8d3d35de678662314e1091cd",
    "expected": {
      "2013-en": [
        "2,2-dimethylbutanethioamide"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C6H13NS",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-149",
    "category": "limits",
    "referenceEnglish": "triphenylborane",
    "smiles": "C1(=CC=CC=C1)B(C1=CC=CC=C1)C1=CC=CC=C1",
    "constitutionId": "flu@B@LTBUJssZktDzHTaAP@@@@@@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/triphenylborane.json",
    "referenceSha256": "3f5cc0eb694a29284a5c8ca71d0ee95e58dbbf551432a7c272d6d350ac23f73e",
    "expected": {
      "2013-en": [
        "triphenylborane"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C18H15B",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  },
  {
    "id": "V014-150",
    "category": "limits",
    "referenceEnglish": "2,7-dimethylquinoline",
    "smiles": "CC1=NC2=CC(=CC=C2C=C1)C",
    "constitutionId": "dcn@@@rQQQQUUtj@D@P@@",
    "referenceUrl": "https://www.ebi.ac.uk/opsin/ws/2%2C7-dimethylquinoline.json",
    "referenceSha256": "b36d8ade4ea774f4ec0a08a00a2cb215f3498fdcb76cf55d7f218412c8d1048e",
    "expected": {
      "2013-en": [
        "2,7-dimethylquinoline"
      ],
      "2013-es": null,
      "1979-en": null,
      "1979-es": null
    },
    "formula": "C11H11N",
    "groupCounts": {},
    "primaryGroup": null,
    "references": [
      "modern",
      "modernSyntax",
      "modernHydrocarbons",
      "spanishLexicon",
      "historicalParent",
      "historicalNumbering",
      "historicalBranches",
      "historicalUnsaturation",
      "historicalGroups",
      "modernFunctions",
      "modernNitrogen"
    ],
    "derivation": "Reference English name selected before production, interpreted independently by OPSIN; parent/group and lexicon rules applied separately. Parser acceptance does not establish preference.",
    "referenceLimitations": [
      "Historical heterocyclic parent/substitution conventions require individual B-section adjudication",
      "Connectivity reference available; preferred/historical lexical form is not asserted for this coverage-boundary probe"
    ]
  }
];
