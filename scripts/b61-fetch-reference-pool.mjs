// Reference acquisition only. Sends public CIDs, never project names, to PubChem.
// No OPSIN request and no production naming code is imported here.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const initialCids=[10758,12180,10243,10241,12349,11914,11870,11856,11849,13156,65577,31249,
  31266,7678,7420,7498,8465,11310,11074,11487,11612,12137,18635,23427,638011,637511,
  637563,10366,10865,11142,11230,6552009];
const properties='IUPACName,MolecularFormula,CanonicalSMILES,IsomericSMILES,InChIKey,DefinedAtomStereoCount,UndefinedAtomStereoCount,DefinedBondStereoCount,UndefinedBondStereoCount';
const extraCids=[557975,6993418,20474,522591,79506,117869,14517,7020622,67855,587203,11959,67880];
const targetedCids=[24834,11950,11560,23094808];
const extra=process.argv.includes('--extra')||process.argv.includes('--targeted');
const cids=process.argv.includes('--targeted')?targetedCids:extra?extraCids:initialCids;
const previous=extra?JSON.parse(await readFile(new URL('../reports/b61/reference-pool.json',import.meta.url),'utf8')):null;
const records=previous?.records??[],receipts=previous?.receipts??[];
await mkdir(new URL('../reports/b61/',import.meta.url),{recursive:true});
for(let i=0;i<cids.length;i+=4) {
  const batch=cids.slice(i,i+4);
  const url=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${batch.join(',')}/property/${properties}/JSON`;
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),body=await response.text();
  const receipt={url,retrievedAt:new Date().toISOString(),status:response.status,
    sha256:createHash('sha256').update(body).digest('hex'),body};
  receipts.push(receipt);
  if(response.ok) {
    const data=JSON.parse(body);
    for(const row of data.PropertyTable.Properties)if(!records.some(old=>old.CID===row.CID))records.push({...row,source:url,sourcePage:`https://pubchem.ncbi.nlm.nih.gov/compound/${row.CID}`,
      retrievedAt:receipt.retrievedAt,receiptSha256:receipt.sha256});
  }
  console.log(`${batch.join(',')}: HTTP ${response.status}`);
}
await writeFile(new URL('../reports/b61/reference-pool.json',import.meta.url),JSON.stringify({purpose:'reference-acquisition-by-public-CID-before-blind-run',records,receipts},null,2)+'\n');
console.log(JSON.stringify(records.map(r=>({cid:r.CID,name:r.IUPACName,formula:r.MolecularFormula,smiles:r.SMILES,
  stereo:[r.DefinedAtomStereoCount,r.DefinedBondStereoCount]})),null,2));
