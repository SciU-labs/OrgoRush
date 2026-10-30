// Independent connectivity references: PubChem compound records and ChEBI
// definitions; explicit atom sets refer to each frozen SMILES, not the parser.
export const generalizationCases = [
  {common:'salicylic acid',name:'2-hydroxybenzoic acid',smiles:'O=C(O)c1ccccc1O',family:'aromatic acid',cid:338,formula:'C7H6O3',parent:[2,4,5,6,7,8,9],prefix:[10],component:'prefix-0'},
  {common:'benzoic acid',name:'benzoic acid',smiles:'O=C(O)c1ccccc1',family:'aromatic acid',cid:243,formula:'C7H6O2',parent:[2,4,5,6,7,8,9],prefix:[1,2,3],component:'suffix'},
  {common:'vanillin',name:'4-hydroxy-3-methoxybenzaldehyde',smiles:'COc1cc(C=O)ccc1O',family:'aromatic aldehyde / ether',cid:1183,formula:'C8H8O3',parent:[3,4,5,6,8,9,10],prefix:[11],component:'prefix-0'},
  {common:'acetanilide',name:'N-phenylacetamide',smiles:'CC(=O)Nc1ccccc1',family:'N-aryl amide',cid:904,formula:'C8H9NO',parent:[1,2,4],prefix:[5,6,7,8,9,10],component:'n-phenyl'},
  {common:'benzophenone',name:'diphenylmethanone',smiles:'O=C(c1ccccc1)c1ccccc1',family:'diaryl ketone',cid:3102,formula:'C13H10O',parent:[2],prefix:[3,4,5,6,7,8,9,10,11,12,13,14],component:'diphenyl'},
  {common:'methyl salicylate',name:'methyl 2-hydroxybenzoate',smiles:'COC(=O)c1ccccc1O',family:'aromatic ester',cid:4133,formula:'C8H8O3',parent:[3,5,6,7,8,9,10],prefix:[11],component:'prefix-0'},
  {common:'benzocaine',name:'ethyl 4-aminobenzoate',smiles:'CCOC(=O)c1ccc(N)cc1',family:'amino aromatic ester',cid:2337,formula:'C9H11NO2',parent:[4,6,7,8,9,11,12],prefix:[10],component:'prefix-0'},
  {common:'acetophenone',name:'1-phenylethanone',smiles:'CC(=O)c1ccccc1',family:'aryl ketone',cid:7410,formula:'C8H8O',parent:[1,2],prefix:[4,5,6,7,8,9],component:'phenyl'},
  {common:'4-methylbenzoic acid',name:'4-methylbenzoic acid',smiles:'Cc1ccc(C(=O)O)cc1',family:'alkyl aromatic acid',cid:7470,formula:'C8H8O2',parent:[2,3,4,5,6,9,10],prefix:[1],component:'prefix-0'},
  {common:'3-methylbutanoic acid',name:'3-methylbutanoic acid',smiles:'CC(C)CC(=O)O',family:'branched acid (symmetric termini)',cid:10430,formula:'C5H10O2',expected:'SYMMETRIC_FULL',parent:[1,2,4,5],prefix:[3],component:'prefix-0'},
  {common:'4-methoxybenzaldehyde',name:'4-methoxybenzaldehyde',smiles:'COc1ccc(C=O)cc1',family:'aromatic aldehyde / ether',cid:31244,formula:'C8H8O2',parent:[3,4,5,6,7,9,10],prefix:[1,2],component:'prefix-0'},
  {common:'2-hydroxypropanamide',name:'2-hydroxypropanamide',smiles:'CC(O)C(=O)N',family:'hydroxy amide',cid:94220,formula:'C3H7NO2',parent:[1,2,4,6],prefix:[3],component:'prefix-0'},
];

// Explicit, independent edge sets for the selected regions, including each
// attachment edge. Keys are unordered editor-graph atom pairs.
export const generalizationEdges = {
  'salicylic acid':['9:10'],
  'benzoic acid':['1:2','2:3'],
  vanillin:['10:11'],
  acetanilide:['4:5','5:6','6:7','7:8','8:9','9:10','5:10'],
  benzophenone:['2:3','2:9','3:4','4:5','5:6','6:7','7:8','3:8','9:10','10:11','11:12','12:13','13:14','9:14'],
  'methyl salicylate':['10:11'],
  benzocaine:['9:10'],
  acetophenone:['2:4','4:5','5:6','6:7','7:8','8:9','4:9'],
  '4-methylbenzoic acid':['1:2'],
  '3-methylbutanoic acid':['2:3'],
  '4-methoxybenzaldehyde':['1:2','2:3'],
  '2-hydroxypropanamide':['2:3'],
};
