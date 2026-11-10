/** Independent name-to-structure receipts from the official OPSIN web service. */
export const source = Object.freeze({
  service: 'https://www.ebi.ac.uk/opsin/ws/',
  repository: 'https://github.com/dan2097/opsin',
  retrievedAt: '2026-11-10T02:25:42Z',
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
]);
