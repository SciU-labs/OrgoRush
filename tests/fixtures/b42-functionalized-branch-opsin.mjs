/** Independent name-to-structure receipts from the official OPSIN web service. */
export const source = Object.freeze({
  service: 'https://www.ebi.ac.uk/opsin/ws/',
  repository: 'https://github.com/dan2097/opsin',
  retrievedAt: '2026-11-10T04:14:03Z',
  note: 'The service response exposes status and SMILES but not its deployed OPSIN version.',
});

export const records = Object.freeze([
  Object.freeze({
    id: 'B42-A',
    inputSmiles: 'O=C(O)C(C(CO)C)CCCC',
    name: '2-(2-hydroxy-1-methylethyl)hexanoic acid',
    status: 'SUCCESS',
    smiles: 'OCC(C)C(C(=O)O)CCCC',
    formula: 'C9H18O3',
  }),
  Object.freeze({
    id: 'B42-B',
    inputSmiles: 'O=CC(C(CN)C)CCCC',
    name: '2-(2-amino-1-methylethyl)hexanal',
    status: 'SUCCESS',
    smiles: 'NCC(C)C(C=O)CCCC',
    formula: 'C9H19NO',
  }),
  Object.freeze({
    id: 'B42-C',
    inputSmiles: 'CC(=O)C(C(CO)C)CCCC',
    name: '3-(2-hydroxy-1-methylethyl)heptan-2-one',
    status: 'SUCCESS',
    smiles: 'OCC(C)C(C(C)=O)CCCC',
    formula: 'C10H20O2',
  }),
  Object.freeze({
    id: 'B421-A',
    inputSmiles: 'O=C(O)C(C(C)(C)CO)CCCC',
    name: '2-(2-hydroxy-1,1-dimethylethyl)hexanoic acid',
    status: 'SUCCESS',
    smiles: 'OCC(C)(C)C(C(=O)O)CCCC',
    formula: 'C10H20O3',
  }),
  Object.freeze({
    id: 'B421-B',
    inputSmiles: 'O=C(O)C(C(C)C(C)CO)CCCC',
    name: '2-(3-hydroxy-1,2-dimethylpropyl)hexanoic acid',
    status: 'SUCCESS',
    smiles: 'OCC(C(C)C(C(=O)O)CCCC)C',
    formula: 'C11H22O3',
  }),
  Object.freeze({
    id: 'B421-C',
    inputSmiles: 'O=CC(C(C)(C)CN)CCCC',
    name: '2-(2-amino-1,1-dimethylethyl)hexanal',
    status: 'SUCCESS',
    smiles: 'NCC(C)(C)C(C=O)CCCC',
    formula: 'C10H21NO',
  }),
]);
