import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const novelty=JSON.parse(readFileSync('reports/b62/novelty-selection.json','utf8'));
const pool=JSON.parse(readFileSync('reports/b61/reference-pool.json','utf8'));
const extraBody=readFileSync('reports/b62/new-source.json','utf8');
const extra=JSON.parse(extraBody).PropertyTable.Properties;
const ids=[10243,10241,7678,11310,11074,11487,12137,18635,638011,637511,10366,10865,20474,67855,11959,67880,12084,16896,89908,14265];
const records=ids.map((cid,index)=>{
  const n=novelty.records.find(x=>x.cid===cid);if(!n?.novel)throw Error(`Not novel: ${cid}`);
  const source=pool.records.find(x=>x.CID===cid)??extra.find(x=>x.CID===cid);
  const receipt=pool.receipts.find(r=>r.status===200 && JSON.parse(r.body).PropertyTable.Properties.some(p=>p.CID===cid));
  return {id:`B62-I${String(index+1).padStart(2,'0')}`,cid,source:`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    retrievedAt:receipt?.retrievedAt??new Date().toISOString(),receiptSha256:receipt?.sha256??createHash('sha256').update(extraBody).digest('hex'),
    smiles:source.SMILES,formula:source.MolecularFormula,referenceName:source.IUPACName,inchiKey:source.InChIKey,
    stereo:{definedAtoms:source.DefinedAtomStereoCount,undefinedAtoms:source.UndefinedAtomStereoCount,definedBonds:source.DefinedBondStereoCount,undefinedBonds:source.UndefinedBondStereoCount},constitutionKey:n.constitutionKey};
});
if(new Set(records.map(r=>r.constitutionKey)).size!==20)throw Error('Duplicate constitution');
const body=JSON.stringify({frozenAt:new Date().toISOString(),selectionBeforeGenerator:true,records},null,2)+'\n';
writeFileSync('tests/fixtures/b62-independent-reference.json',body,{flag:'wx'});
writeFileSync('reports/b62/corpus-freeze.json',JSON.stringify({sha256:createHash('sha256').update(body).digest('hex'),count:20},null,2)+'\n',{flag:'wx'});
console.log('Frozen 20 structures before generator invocation');
