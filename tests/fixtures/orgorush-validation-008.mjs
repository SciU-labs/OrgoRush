// Independent rule applications fixed before observing production. No imports
// from app/, generated-name corpora or previous audit outputs are permitted here.
export const SOURCES = {
  modern: { url: "https://iupac.qmul.ac.uk/BlueBook/P4.html", sections: "P-41, P-44.1, P-44.3, P-44.4", use: "2013 parent/group seniority; independent rule application" },
  modernSyntax: { url: "https://iupac.qmul.ac.uk/BlueBook/P1.html", sections: "P-14.3, P-14.4, P-14.5, P-16.7", use: "2013 numbering, locants, alphabetical citation and vowel elision" },
  modernHydrocarbons: { url: "https://iupac.qmul.ac.uk/BlueBook/P2.html", sections: "P-21, P-22, P-23, P-24, P-25", use: "2013 chain/ring/spiro/fused parents" },
  modernFunctions: { url: "https://iupac.qmul.ac.uk/BlueBook/P6.html", sections: "P-62, P-63, P-64, P-65", use: "2013 amines, hydroxy/ether, ketone, acid/ester rules" },
  modernNitrogen: { url: "https://iupac.qmul.ac.uk/BlueBook/P6a.html", sections: "P-66.1, P-66.5, P-66.6", use: "2013 amides, nitriles and aldehydes" },
  historicalParent: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_933.htm", sections: "C-13.11(a-k)", use: "1979 principal group > multiple bonds > length; numbering" },
  historicalNumbering: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm", sections: "C-15.11", use: "1979 suffix/multiple-bond/prefix numbering order" },
  historicalHydrocarbons: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_2.htm", sections: "A-1, A-2, A-3", use: "1979 hydrocarbon grammar; use linked rules, not 1993 revisions" },
  historicalUnsaturation: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm", sections: "A-3.1-4", use: "1979 ene/yne/enyne grammar and seniority" },
  historicalRings: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm", sections: "A-11", use: "1979 monocyclic parents" },
  historicalFused: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm", sections: "A-21", use: "1979 retained aromatic fused parents" },
  historicalBridges: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm", sections: "A-31", use: "1979 bicyclo bridge counts" },
  historicalSpiro: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_197.htm", sections: "A-41", use: "1979 spiro ring counts" },
  historicalGroups: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_905.htm", sections: "Table C-III", use: "1979 suffix/prefix identities and priority" },
  historicalAlcohol: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm", sections: "C-201.1-2", use: "1979 -ol / hydroxy-" },
  historicalAldehyde: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_249.htm", sections: "C-302.1", use: "1979 hydrocarbon parent + -al" },
  historicalKetone: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_267.htm", sections: "C-312.1", use: "1979 -one/-dione" },
  historicalAcid: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm", sections: "C-401.1", use: "1979 parent + -oic acid/-dioic acid" },
  historicalPolyamine: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_517.htm", sections: "C-813.1", use: "1979 diamine/polyamine parent construction" },
  historicalEther: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_227.htm", sections: "C-211", use: "1979 alkoxyalkane and functional-class alternatives" },
  historicalEster: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_363.htm", sections: "C-463.1", use: "1979 O-alkyl + acid-derived ester component" },
  historicalAmine: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_513.htm", sections: "C-812.1", use: "1979 radical/parent amine alternatives" },
  historicalSecondaryAmine: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_522.htm", sections: "C-814.4", use: "1979 N-substitution of the senior primary-amine parent" },
  historicalAmide: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_541.htm", sections: "C-822.1", use: "1979 acid-to-amide construction" },
  historicalNAmide: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_548.htm", sections: "C-824.1", use: "1979 N-substituted amides" },
  historicalNitrile: { url: "https://www.acdlabs.com/iupac/nomenclature/79/r79_566.htm", sections: "C-832.1, C-832.5", use: "1979 full hydrocarbon + nitrile; C#N carbon belongs to parent" },
  spanishLexicon: { url: "https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf", sections: "Tables 1-3; sections 4, 6b, 7, 8", use: "Spanish lexical/morphological forms and printed 2013 examples; for 1979 ONLY vocabulary, never modern parent selection or locant placement" },
  opsin: { url: "https://www.ebi.ac.uk/opsin/", sections: "name-to-structure service", use: "Constitution cross-check ONLY; does not certify a historical or preferred name" },
};

const rows = [];
function add(family, smiles, modernEs, historicalEn, historicalEs, modernEn, parentCarbons, groups = {}, note = "") {
  const id = `V008-${String(rows.length + 1).padStart(3, "0")}`;
  const refs = ["modern", "modernSyntax", "spanishLexicon", "historicalParent", "historicalNumbering", "historicalGroups"];
  if (["alkane", "unsaturated", "selection"].includes(family)) refs.push("modernHydrocarbons", "historicalHydrocarbons", "historicalUnsaturation");
  else if (["ring", "aromatic", "fused"].includes(family)) refs.push("modernHydrocarbons", "historicalRings", "historicalFused", "historicalBridges", "historicalSpiro");
  else refs.push("modernFunctions", "modernNitrogen");
  const byGroup = { alcohol: "historicalAlcohol", aldehyde: "historicalAldehyde", ketone: "historicalKetone", carboxylicAcid: "historicalAcid", ether: "historicalEther", ester: "historicalEster", amine: "historicalAmine", amide: "historicalAmide", nitrile: "historicalNitrile" };
  for (const group of Object.keys(groups)) if (byGroup[group]) refs.push(byGroup[group]);
  if (groups.amine > 1) refs.push("historicalPolyamine");
  if (groups.amine) refs.push("historicalSecondaryAmine");
  if (groups.amide) refs.push("historicalNAmide");
  rows.push({ id, family, smiles, expected: { "2013-es": modernEs, "1979-en": historicalEn, "1979-es": historicalEs }, modernEnglishWitness: modernEn,
    parentCarbons: typeof parentCarbons === "number" ? { "2013-es": parentCarbons, "1979-en": parentCarbons, "1979-es": parentCarbons } : parentCarbons,
    groups, references: [...new Set(refs)], derivation: note || `Independent substitutive rule application to the supplied graph; ${parentCarbons} parent carbons. Not claimed to be a printed example.`,
    historicalReference: "RULE_DERIVED", spanishHistoricalMethod: "1979 rules applied independently; Spanish lexical forms only from RSEQ" });
}

add("alkane", "CCCCCCC", "heptano", "heptane", "heptano", "heptane", 7);
add("alkane", "CCCCCCCCC", "nonano", "nonane", "nonano", "nonane", 9);
add("alkane", "CCC(C)CCCC", "3-metilheptano", "3-methylheptane", "3-metilheptano", "3-methylheptane", 7);
add("alkane", "CCC(C)(C)CC", "3,3-dimetilpentano", "3,3-dimethylpentane", "3,3-dimetilpentano", "3,3-dimethylpentane", 5);
add("alkane", "CCC(CC)CCC", "3-etilhexano", "3-ethylhexane", "3-etilhexano", "3-ethylhexane", 6);
add("alkane", "CC(C)C(C)C(C)C", "2,3,4-trimetilpentano", "2,3,4-trimethylpentane", "2,3,4-trimetilpentano", "2,3,4-trimethylpentane", 5);
add("alkane", "CCCC(CC)CCCCC", "4-etilnonano", "4-ethylnonane", "4-etilnonano", "4-ethylnonane", 9);
add("selection", "CCCC(C=C)CCC", "4-etenilheptano", "3-propyl-1-hexene", "3-propil-1-hexeno", "4-ethenylheptane", { "2013-es": 7, "1979-en": 6, "1979-es": 6 }, {}, "2013 chooses the seven-carbon chain; 1979 chooses the six-carbon chain containing C=C (C-13.11(b) before (c)).");
add("unsaturated", "C=CCCCCCC", "oct-1-eno", "1-octene", "1-octeno", "oct-1-ene", 8);
add("unsaturated", "CC=CCCCC", "hept-2-eno", "2-heptene", "2-hepteno", "hept-2-ene", 7);
add("unsaturated", "CC=CC(C)CC", "4-metilhex-2-eno", "4-methyl-2-hexene", "4-metil-2-hexeno", "4-methylhex-2-ene", 6);
add("unsaturated", "C=CCCCC=C", "hepta-1,6-dieno", "1,6-heptadiene", "1,6-heptadieno", "hepta-1,6-diene", 7);
add("unsaturated", "C=CC=CC=C", "hexa-1,3,5-trieno", "1,3,5-hexatriene", "1,3,5-hexatrieno", "hexa-1,3,5-triene", 6);
add("unsaturated", "C#CCCCCC", "hept-1-ino", "1-heptyne", "1-heptino", "hept-1-yne", 7);
add("unsaturated", "CCC#CCCCC", "oct-3-ino", "3-octyne", "3-octino", "oct-3-yne", 8);
add("unsaturated", "C#CC=CCC", "hex-3-en-1-ino", "3-hexen-1-yne", "3-hexen-1-ino", "hex-3-en-1-yne", 6);
add("ring", "C1CCCCCCC1", "ciclooctano", "cyclooctane", "ciclooctano", "cyclooctane", 8);
add("ring", "CCC1CCCC1", "etilciclopentano", "ethylcyclopentane", "etilciclopentano", "ethylcyclopentane", 5);
add("ring", "CC1CC(C)CCC1", "1,3-dimetilciclohexano", "1,3-dimethylcyclohexane", "1,3-dimetilciclohexano", "1,3-dimethylcyclohexane", 6);
add("ring", "C1=CCCCCC1", "ciclohepteno", "cycloheptene", "ciclohepteno", "cycloheptene", 7);
add("fused", "c1ccc2ccccc2c1", "naftaleno", "naphthalene", "naftaleno", "naphthalene", 10);
add("fused", "c1ccc2cc3ccccc3cc2c1", "antraceno", "anthracene", "antraceno", "anthracene", 14);
add("ring", "C1CC2CCC1CC2", "biciclo[2.2.2]octano", "bicyclo[2.2.2]octane", "biciclo[2.2.2]octano", "bicyclo[2.2.2]octane", 8);
add("ring", "C1CCC2(C1)CCC2", "espiro[3.4]octano", "spiro[3.4]octane", "espiro[3.4]octano", "spiro[3.4]octane", 8);
add("aromatic", "CCc1cccc(C)c1", "1-etil-3-metilbenceno", "1-ethyl-3-methylbenzene", "1-etil-3-metilbenceno", "1-ethyl-3-methylbenzene", 6);
add("aromatic", "Brc1cccc(Cl)c1", "1-bromo-3-clorobenceno", "1-bromo-3-chlorobenzene", "1-bromo-3-clorobenceno", "1-bromo-3-chlorobenzene", 6, { halogen: 2 });
add("alcohol", "CC(O)CCCCC", "heptan-2-ol", "2-heptanol", "2-heptanol", "heptan-2-ol", 7, { alcohol: 1 });
add("alcohol", "CC(O)C(C)CC", "3-metilpentan-2-ol", "3-methyl-2-pentanol", "3-metil-2-pentanol", "3-methylpentan-2-ol", 5, { alcohol: 1 });
add("alcohol", "CC(C)C(O)CCC", "2-metilhexan-3-ol", "2-methyl-3-hexanol", "2-metil-3-hexanol", "2-methylhexan-3-ol", 6, { alcohol: 1 });
add("alcohol", "OCCC(O)C", "butano-1,3-diol", "1,3-butanediol", "1,3-butanodiol", "butane-1,3-diol", 4, { alcohol: 2 });
add("alcohol", "CC(O)CC=C", "pent-4-en-2-ol", "4-penten-2-ol", "4-penten-2-ol", "pent-4-en-2-ol", 5, { alcohol: 1 });
add("alcohol", "OC1CCCCCCC1", "ciclooctanol", "cyclooctanol", "ciclooctanol", "cyclooctanol", 8, { alcohol: 1 });
add("aldehyde", "CCCCCCC=O", "heptanal", "heptanal", "heptanal", "heptanal", 7, { aldehyde: 1 });
add("aldehyde", "O=CCC(C)CCC", "3-metilhexanal", "3-methylhexanal", "3-metilhexanal", "3-methylhexanal", 6, { aldehyde: 1 });
add("aldehyde", "O=CC=CCCC", "hex-2-enal", "2-hexenal", "2-hexenal", "hex-2-enal", 6, { aldehyde: 1 });
add("ketone", "CCC(=O)CCCCC", "octan-3-ona", "3-octanone", "3-octanona", "octan-3-one", 8, { ketone: 1 });
add("ketone", "CC(=O)CC(C)CC", "4-metilhexan-2-ona", "4-methyl-2-hexanone", "4-metil-2-hexanona", "4-methylhexan-2-one", 6, { ketone: 1 });
add("ketone", "CC(=O)CCC(=O)CC", "heptano-2,5-diona", "2,5-heptanedione", "2,5-heptanodiona", "heptane-2,5-dione", 7, { ketone: 2 });
add("ketone", "CC(=O)CCC=C", "hex-5-en-2-ona", "5-hexen-2-one", "5-hexen-2-ona", "hex-5-en-2-one", 6, { ketone: 1 });
add("ketone", "O=C1CCCCCCC1", "ciclooctanona", "cyclooctanone", "ciclooctanona", "cyclooctanone", 8, { ketone: 1 });
add("acid", "CCCCCCC(=O)O", "ácido heptanoico", "heptanoic acid", "ácido heptanoico", "heptanoic acid", 7, { carboxylicAcid: 1 });
add("acid", "O=C(O)CC(C)CC", "ácido 3-metilpentanoico", "3-methylpentanoic acid", "ácido 3-metilpentanoico", "3-methylpentanoic acid", 5, { carboxylicAcid: 1 });
add("acid", "O=C(O)C=CCCC", "ácido hex-2-enoico", "2-hexenoic acid", "ácido 2-hexenoico", "hex-2-enoic acid", 6, { carboxylicAcid: 1 });
add("acid", "O=C(O)CCCCC(=O)O", "ácido hexanodioico", "hexanedioic acid", "ácido hexanodioico", "hexanedioic acid", 6, { carboxylicAcid: 2 });
add("ester", "CCCC(=O)OCCC", "butanoato de propilo", "propyl butanoate", "butanoato de propilo", "propyl butanoate", 4, { ester: 1 });
add("ester", "CC(C)CC(=O)OCC", "3-metilbutanoato de etilo", "ethyl 3-methylbutanoate", "3-metilbutanoato de etilo", "ethyl 3-methylbutanoate", 4, { ester: 1 });
add("ester", "CCC=CC(=O)OC", "pent-2-enoato de metilo", "methyl 2-pentenoate", "2-pentenoato de metilo", "methyl pent-2-enoate", 5, { ester: 1 });
add("ester", "CCC(=O)OCCCC", "propanoato de butilo", "butyl propanoate", "propanoato de butilo", "butyl propanoate", 3, { ester: 1 });
add("ether", "CC(OC)CCC", "2-metoxipentano", "2-methoxypentane", "2-metoxipentano", "2-methoxypentane", 5, { ether: 1 });
add("ether", "CCC(OCC)CCC", "3-etoxihexano", "3-ethoxyhexane", "3-etoxihexano", "3-ethoxyhexane", 6, { ether: 1 });
add("ether", "COCCCC", "1-metoxibutano", "1-methoxybutane", "1-metoxibutano", "1-methoxybutane", 4, { ether: 1 });
add("amine", "CC(N)CCCCC", "heptan-2-amina", "2-heptanamine", "2-heptanamina", "heptan-2-amine", 7, { amine: 1 });
add("amine", "NCCC(C)CC", "3-metilpentan-1-amina", "3-methyl-1-pentanamine", "3-metil-1-pentanamina", "3-methylpentan-1-amine", 5, { amine: 1 });
add("amine", "CC(NCC)CCC", "N-etilpentan-2-amina", "N-ethyl-2-pentanamine", "N-etil-2-pentanamina", "N-ethylpentan-2-amine", 5, { amine: 1 });
add("amine", "CCCCN(C)C", "N,N-dimetilbutan-1-amina", "N,N-dimethyl-1-butanamine", "N,N-dimetil-1-butanamina", "N,N-dimethylbutan-1-amine", 4, { amine: 1 });
add("amine", "NCCCCCCN", "hexano-1,6-diamina", "1,6-hexanediamine", "1,6-hexanodiamina", "hexane-1,6-diamine", 6, { amine: 2 });
add("amide", "CCCCCC(=O)N", "hexanamida", "hexanamide", "hexanamida", "hexanamide", 6, { amide: 1 });
add("amide", "NC(=O)CC(C)CC", "3-metilpentanamida", "3-methylpentanamide", "3-metilpentanamida", "3-methylpentanamide", 5, { amide: 1 });
add("amide", "CCCC(=O)NCC", "N-etilbutanamida", "N-ethylbutanamide", "N-etilbutanamida", "N-ethylbutanamide", 4, { amide: 1 });
add("nitrile", "CCCCCC#N", "hexanonitrilo", "hexanenitrile", "hexanonitrilo", "hexanenitrile", 6, { nitrile: 1 });
add("nitrile", "N#CCC(C)CC", "3-metilpentanonitrilo", "3-methylpentanenitrile", "3-metilpentanonitrilo", "3-methylpentanenitrile", 5, { nitrile: 1 });
add("nitrile", "N#CCCCC#N", "pentanodinitrilo", "pentanedinitrile", "pentanodinitrilo", "pentanedinitrile", 5, { nitrile: 2 });
add("mixed", "CC(=O)CC(O)CC", "4-hidroxihexan-2-ona", "4-hydroxy-2-hexanone", "4-hidroxi-2-hexanona", "4-hydroxyhexan-2-one", 6, { ketone: 1, alcohol: 1 });
add("mixed", "O=C(O)CC(N)CC", "ácido 3-aminopentanoico", "3-aminopentanoic acid", "ácido 3-aminopentanoico", "3-aminopentanoic acid", 5, { carboxylicAcid: 1, amine: 1 });
add("mixed", "N#CC(O)CC", "2-hidroxibutanonitrilo", "2-hydroxybutanenitrile", "2-hidroxibutanonitrilo", "2-hydroxybutanenitrile", 4, { nitrile: 1, alcohol: 1 });
add("mixed", "O=CCCC(=O)C", "4-oxopentanal", "4-oxopentanal", "4-oxopentanal", "4-oxopentanal", 5, { aldehyde: 1, ketone: 1 });
add("mixed", "OCC(OC)CCCC", "2-metoxihexan-1-ol", "2-methoxy-1-hexanol", "2-metoxi-1-hexanol", "2-methoxyhexan-1-ol", 6, { alcohol: 1, ether: 1 });
add("selection", "OCC(C)C(CC)CCCC", "3-etil-2-metilheptan-1-ol", "3-ethyl-2-methyl-1-heptanol", "3-etil-2-metil-1-heptanol", "3-ethyl-2-methylheptan-1-ol", 7, { alcohol: 1 });
add("selection", "C=CCC(CCC)CC=C", "4-propilhepta-1,6-dieno", "4-propyl-1,6-heptadiene", "4-propil-1,6-heptadieno", "4-propylhepta-1,6-diene", 7);
add("selection", "OCCC(CC)CCO", "3-etilpentano-1,5-diol", "3-ethyl-1,5-pentanediol", "3-etil-1,5-pentanodiol", "3-ethylpentane-1,5-diol", 5, { alcohol: 2 });
add("selection", "OCCC(CCCCCl)C(O)C", "3-(4-clorobutil)pentano-1,4-diol", "3-(4-chlorobutyl)-1,4-pentanediol", "3-(4-clorobutil)-1,4-pentanodiol", "3-(4-chlorobutyl)pentane-1,4-diol", 5, { alcohol: 2, halogen: 1 }, "Printed 2013 P-44.1.1 example: two OH groups outrank a longer eight-carbon chain containing only one OH. Historical parent criterion C-13.11(a) independently has the same priority.");
add("selection", "OCCC(CO)CCCCO", "3-(hidroximetil)heptano-1,7-diol", "3-(hydroxymethyl)-1,7-heptanediol", "3-(hidroximetil)-1,7-heptanodiol", "3-(hydroxymethyl)heptane-1,7-diol", 7, { alcohol: 3 }, "Maximum chain OH suffix count is two. Third OH must survive as hydroxymethyl prefix; C-201.2, P-63.1.4. Parent length then resolves the alternative paths.");

export const VALIDATION_CASES = Object.freeze(rows);
export const PROFILES = Object.freeze(["2013-es", "1979-en", "1979-es"]);
