// Rule-derived expectations: IUPAC 2013 P-44.3.2, P-29.2/P-29.3.1,
// P-56.4. The C6H10 case is independently corroborated by PubChem CID 18850.
// Graphs are read independently in the tests; no production naming is used
// to derive these names or their parent/attachment expectations.
export const UNSATURATION_013 = [
  {smiles:'C=CC(CC)=C',parent:5,locant:3,doubles:[1],carbons:6,hydrogens:10,
    es:'3-metilidenopent-1-eno',en:'3-methylidenepent-1-ene',legacyEs:'2-etil-1,3-butadieno',legacyEn:'2-ethyl-1,3-butadiene'},
  {smiles:'C=CC(CCCC)=C',parent:7,locant:3,doubles:[1],carbons:8,hydrogens:14,
    es:'3-metilidenohept-1-eno',en:'3-methylidenehept-1-ene',legacyEs:'2-butil-1,3-butadieno',legacyEn:'2-butyl-1,3-butadiene'},
  {smiles:'C=CC(CCC)=C',parent:6,locant:3,doubles:[1],carbons:7,hydrogens:12,
    es:'3-metilidenohex-1-eno',en:'3-methylidenehex-1-ene',legacyEs:'2-propil-1,3-butadieno',legacyEn:'2-propyl-1,3-butadiene'},
  {smiles:'C=CC(C)CC',parent:5,locant:3,doubles:[1],carbons:6,hydrogens:12,methyl:true,
    es:'3-metilpent-1-eno',en:'3-methylpent-1-ene',legacyEs:'3-metil-1-penteno',legacyEn:'3-methyl-1-pentene'},
  {smiles:'CCCC(=C)CCC',parent:7,locant:4,doubles:[],carbons:8,hydrogens:16,
    es:'4-metilidenoheptano',en:'4-methylideneheptane'},
];
