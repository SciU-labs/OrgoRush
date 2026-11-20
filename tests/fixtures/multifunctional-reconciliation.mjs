export const alcohols = [
  ["Adrenalina","4-[(1R)-1-hydroxy-2-(methylamino)ethyl]benzene-1,2-diol","CNC[C@@H](c1ccc(O)c(O)c1)O"],
  ["Salbutamol","4-[2-(tert-butylamino)-1-hydroxyethyl]-2-(hydroxymethyl)phenol","CC(C)(C)NCC(O)c1ccc(O)c(CO)c1"],
  ["Venlafaxina","1-[2-(dimethylamino)-1-(4-methoxyphenyl)ethyl]cyclohexan-1-ol","COc1ccc(C(CN(C)C)C2(O)CCCCC2)cc1"],
  ["Metoprolol","1-[4-(2-methoxyethyl)phenoxy]-3-(propan-2-ylamino)propan-2-ol","COCCc1ccc(OCC(O)CNC(C)C)cc1"],
];
export const acids = [
  ["Cítrico","2-hydroxypropane-1,2,3-tricarboxylic acid","OC(=O)CC(O)(C(=O)O)CC(=O)O"],
  ["Málico","(2S)-2-hydroxybutanedioic acid","O=C(O)[C@@H](O)CC(=O)O"],
  ["Tartárico","(2R,3R)-2,3-dihydroxybutanedioic acid","O=C(O)[C@H](O)[C@@H](O)C(=O)O"],
  ["Glutárico","pentanedioic acid","O=C(O)CCCC(=O)O"],
  ["Glutámico","(2S)-2-aminopentanedioic acid","O=C(O)[C@@H](N)CCC(=O)O"],
  ["2-metilbutanodioico","2-methylbutanedioic acid","O=C(O)C(C)CC(=O)O"],
];
export const synthetic = [
  ["2-(ethylamino)propan-1-ol","OCC(NCC)C"],["1-(dimethylamino)butan-2-ol","CN(C)CC(O)CC"],
  ["1-(ethylamino)-3-methoxypropan-2-ol","CCNCC(O)COC"],["1-amino-3-(propan-2-yloxy)propan-2-ol","NCC(O)COC(C)C"],
  ["4-[2-(ethylamino)-1-hydroxyethyl]benzene-1,2-diol","CCNCC(O)c1ccc(O)c(O)c1"],
  ["4-[2-(dimethylamino)-1-hydroxyethyl]phenol","CN(C)CC(O)c1ccc(O)cc1"],
  ["1-(dimethylamino)-3-phenoxypropan-2-ol","CN(C)CC(O)COc1ccccc1"],
  ...["prop","but","pent","hex","hept","oct"].map((root,i)=>[root+"anedioic acid","O=C(O)"+"C".repeat(i+1)+"C(=O)O"]),
  ...["but","pent","hex","hept","oct"].map((root,i)=>["2-hydroxy"+root+"anedioic acid","O=C(O)C(O)"+"C".repeat(i+1)+"C(=O)O"]),
  ["butane-1,2,4-tricarboxylic acid","OC(=O)CC(C(=O)O)CCC(=O)O"],
  ["2,3-dihydroxybutanedioic acid","OC(=O)C(O)C(O)C(=O)O"],
].filter(([name])=>!acids.some(([,acid])=>acid===name)).map(([name,smiles])=>["Sintética",name,smiles]);
import {cases} from "./complex-nitrogen-cases.mjs";
export const previous = [
  ...cases,
  ["N-methyl-3-phenylpropan-1-amine","CNCCCc1ccccc1"],
  ["N-ethyl-4-phenylbutan-1-amine","CCNCCCCc1ccccc1"],
  ["2-[4-(2-methylpropyl)phenyl]propanoic acid","CC(C)Cc1ccc(C(C)C(=O)O)cc1"],
  ["methyl 2-hydroxybenzoate","COC(=O)c1ccccc1O"],
  ["N-(4-hydroxyphenyl)acetamide","CC(=O)Nc1ccc(O)cc1"],
  ["2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one","CC1=CCC(CC1=O)C(=C)C"],
];
export const variants=[
  ["Carvona","2-methyl-5-prop-1-en-2-ylcyclohex-2-en-1-one","CC1=CCC(CC1=O)C(=C)C"],
  ["TNT","2-methyl-1,3,5-trinitrobenzene","Cc1c([N+](=O)[O-])cc([N+](=O)[O-])cc1[N+](=O)[O-]"],
];
