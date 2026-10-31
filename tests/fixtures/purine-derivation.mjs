import {readFileSync} from 'node:fs';
export const purineReferences=JSON.parse(readFileSync(new URL('../../reports/purine-reference-live.json',import.meta.url),'utf8'));
export const purineOpsin=[...JSON.parse(readFileSync(new URL('../../reports/purine-opsin-audit.json',import.meta.url),'utf8')),
  ...JSON.parse(readFileSync(new URL('../../reports/purine-hydrogenation-controls.json',import.meta.url),'utf8'))];
// Locants manually traced on the frozen PubChem connectivity, independently
// of the production recognizer; array index + 1 is the retained locant.
const expected={
  purine:{parent:[6,5,4,3,2,1,9,8,7],methyl:[],oxo:[],nh:[7],indicated:[7]},
  xanthine:{parent:[8,9,11,3,4,6,5,1,2],methyl:[],oxo:[[2,10],[6,7]],nh:[1,3,7],hydro:[3,7]},
  caffeine:{parent:[9,10,12,5,6,7,2,3,4],methyl:[[1,14],[3,13],[7,1]],oxo:[[2,11],[6,8]],nh:[]},
  theobromine:{parent:[9,10,12,5,6,7,2,3,4],methyl:[[3,13],[7,1]],oxo:[[2,11],[6,8]],nh:[1]},
  theophylline:{parent:[7,8,2,3,4,5,11,12,13],methyl:[[1,10],[3,1]],oxo:[[2,9],[6,6]],nh:[7],indicated:[7]},
};
export const purineCases=purineReferences.slice(0,5).map(r=>({...r,common:r.query,name:r.IUPACName,smiles:r.SMILES,cid:r.CID,formula:r.MolecularFormula,...expected[r.query]}));
