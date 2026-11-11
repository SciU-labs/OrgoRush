import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const pool=JSON.parse(readFileSync('reports/b61/reference-pool.json','utf8'));
const novelty=JSON.parse(readFileSync('reports/b62/novelty.json','utf8'));
const source=pool.records.find(r=>r.CID===65577),n=novelty.records.find(r=>r.cid===65577);
if(!source||!n?.novel)throw Error('Supplement is missing or overlaps historical fixtures');
const receipt=pool.receipts.find(r=>r.status===200&&JSON.parse(r.body).PropertyTable.Properties.some(p=>p.CID===source.CID));
const row={id:'B62-S01',cid:source.CID,source:`https://pubchem.ncbi.nlm.nih.gov/compound/${source.CID}`,
  retrievedAt:receipt?.retrievedAt??null,receiptSha256:receipt?.sha256??null,smiles:source.SMILES,
  formula:source.MolecularFormula,referenceName:source.IUPACName,inchiKey:source.InChIKey,
  stereo:{definedAtoms:source.DefinedAtomStereoCount,undefinedAtoms:source.UndefinedAtomStereoCount,definedBonds:source.DefinedBondStereoCount,undefinedBonds:source.UndefinedBondStereoCount},constitutionKey:n.constitutionKey};
const body=JSON.stringify({frozenAt:new Date().toISOString(),selectionBeforeGenerator:true,
  note:'Supplement chosen after the initial run revealed an overlap; it is an independently frozen additional case, not part of the original blind cohort.',records:[row]},null,2)+'\n';
writeFileSync('tests/fixtures/b62-supplemental.json',body,{flag:'wx'});
writeFileSync('reports/b62/supplement-freeze.json',JSON.stringify({sha256:createHash('sha256').update(body).digest('hex'),count:1},null,2)+'\n',{flag:'wx'});
