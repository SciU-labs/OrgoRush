// Legacy expectations derived before observation from IUPAC 1979 A-3.1/A-3.4,
// A-2.3/A-2.4; historical ES morphology corroborated by the EU/BOE
// CH2=CH-CH=CH2 / 1,3-butadieno entry. See the task report for sources.
// No production naming, localization or generated outputs are imported.
// Current is a preservation baseline, not a normative endorsement: the two
// competing-parent cases below already omit an exocyclic =CH2 in 2013.
export const POLYENES = [
  ['C=CC=C', 'buta-1,3-dieno', '1,3-butadieno', '1,3-butadiene'],
  ['C=CCC=C', 'penta-1,4-dieno', '1,4-pentadieno', '1,4-pentadiene'],
  ['C=CCCCC=C', 'hepta-1,6-dieno', '1,6-heptadieno', '1,6-heptadiene'],
  ['C=CCC(CCC)CC=C', '4-propilhepta-1,6-dieno', '4-propil-1,6-heptadieno', '4-propyl-1,6-heptadiene'],
  ['C=CC=CC=C', 'hexa-1,3,5-trieno', '1,3,5-hexatrieno', '1,3,5-hexatriene'],
  ['C=C(C)C=C', '2-metilbuta-1,3-dieno', '2-metil-1,3-butadieno', '2-methyl-1,3-butadiene'],
  ['CC=CC=CC', 'hexa-2,4-dieno', '2,4-hexadieno', '2,4-hexadiene'],
  ['CCC=CC=CCC', 'octa-3,5-dieno', '3,5-octadieno', '3,5-octadiene'],
  ['C=CC=CCC=C', 'hepta-1,3,6-trieno', '1,3,6-heptatrieno', '1,3,6-heptatriene'],
  ['C=CCC=CC=C', 'hepta-1,3,6-trieno', '1,3,6-heptatrieno', '1,3,6-heptatriene'],
  ['C=CC(CC)=C', '3-metilpent-1-eno', '2-etil-1,3-butadieno', '2-ethyl-1,3-butadiene'],
  ['C=CCC(CC)C=C', '3-etilhexa-1,5-dieno', '3-etil-1,5-hexadieno', '3-ethyl-1,5-hexadiene'],
  ['C=CC(C)=CC=C', '3-metilhexa-1,3,5-trieno', '3-metil-1,3,5-hexatrieno', '3-methyl-1,3,5-hexatriene'],
  ['C=CC(C)(C)C=C', '3,3-dimetilpenta-1,4-dieno', '3,3-dimetil-1,4-pentadieno', '3,3-dimethyl-1,4-pentadiene'],
  ['C=C(C)C(C)=C', '2,3-dimetilbuta-1,3-dieno', '2,3-dimetil-1,3-butadieno', '2,3-dimethyl-1,3-butadiene'],
  ['C=CC(CCCC)=C', '3-metilhept-1-eno', '2-butil-1,3-butadieno', '2-butyl-1,3-butadiene'],
  ['C=C=C', 'propa-1,2-dieno', '1,2-propadieno', '1,2-propadiene'],
  ['C=CC=CC=CC=C', 'octa-1,3,5,7-tetraeno', '1,3,5,7-octatetraeno', '1,3,5,7-octatetraene'],
  ['C=CC=CC=CC=CC=C', 'deca-1,3,5,7,9-pentaeno', '1,3,5,7,9-decapentaeno', '1,3,5,7,9-decapentaene'],
  ['C=CC=CC=CC=CC=CC=C', 'dodeca-1,3,5,7,9,11-hexaeno', '1,3,5,7,9,11-dodecahexaeno', '1,3,5,7,9,11-dodecahexaene'],
  ['C=CC=CC=CC=CC=CC=CC=C', 'tetradeca-1,3,5,7,9,11,13-heptaeno', '1,3,5,7,9,11,13-tetradecaheptaeno', '1,3,5,7,9,11,13-tetradecaheptaene'],
  ['C=CC=CC=CC=CC=CC=CC=CC=C', 'hexadeca-1,3,5,7,9,11,13,15-octaeno', '1,3,5,7,9,11,13,15-hexadecaoctaeno', '1,3,5,7,9,11,13,15-hexadecaoctaene'],
  ['C=CC=C' + 'C'.repeat(26), 'triaconta-1,3-dieno', '1,3-triacontadieno', '1,3-triacontadiene'],
].map(([smiles, current, es, en]) => ({ smiles, current, es, en }));
