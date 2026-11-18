/** Independent structure/name reference for adjudicating the former AUD-NOM-008 gate.
 * PubChem CID 82200 reports 2-(2-hydroxyethyl)phenol and canonical SMILES
 * C1=CC=C(C(=C1)CCO)O. The external name is used only as a structural
 * cross-check, not as certification of a preferred or PIN 1979 name.
 * Historical composition: retained phenol parent plus a 2-hydroxyethyl
 * substituent, using the 1979 hydroxy nomenclature rules (C-201.1-2).
 */
export const AUDNOM008_HYDROXYETHYLPHENOL_REFERENCE=Object.freeze({
  cid:82200,
  source:"https://pubchem.ncbi.nlm.nih.gov/compound/82200",
  nameEn:"2-(2-hydroxyethyl)phenol",
  nameEs:"2-(2-hidroxietil)fenol",
  smiles:"C1=CC=C(C(=C1)CCO)O",
  formula:"C8H10O2",
  rule:"1979 C-201.1-2; phenol retained parent with a compositional hydroxyethyl substituent.",
});
