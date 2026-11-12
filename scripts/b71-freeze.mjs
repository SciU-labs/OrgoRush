// PubChem descriptor transcriptions; this step does not execute OrgoRush.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
const data=[
 [4060517,'N-ethyl-2-methylbenzamide','CCNC(=O)C1=CC=CC=C1C','C10H13NO','HRJDPMNBBKGHKT-UHFFFAOYSA-N'],
 [81897,'N-ethyl-4-methoxybenzamide','CCNC(=O)C1=CC=C(C=C1)OC','C10H13NO2','KIOWCVBPJXEJLN-UHFFFAOYSA-N'],
 [669440,'N-ethyl-3-methoxybenzamide','CCNC(=O)C1=CC(=CC=C1)OC','C10H13NO2','HTGKXUZEDPDFIO-UHFFFAOYSA-N'],
 [4070371,'4-bromo-N-ethylbenzamide','CCNC(=O)C1=CC=C(C=C1)Br','C9H10BrNO','JXFKDGIMTQHLIT-UHFFFAOYSA-N'],
 [4150792,'3-chloro-N-methylbenzamide','CNC(=O)C1=CC(=CC=C1)Cl','C8H8ClNO','WJJLGPQRUCWHKZ-UHFFFAOYSA-N'],
 [347959,'2-chloro-N-methylbenzamide','CNC(=O)C1=CC=CC=C1Cl','C8H8ClNO','ITXNDDPDABTCBO-UHFFFAOYSA-N'],
 [2425972,'2-fluoro-N-methylbenzamide','CNC(=O)C1=CC=CC=C1F','C8H8FNO','NAGFMACWWJYORB-UHFFFAOYSA-N'],
 [11954,'N-methylbenzamide','CNC(=O)C1=CC=CC=C1','C8H9NO','NCCHARWOCKOHIH-UHFFFAOYSA-N'],
 [3719193,'N-chloro-N-methylbenzamide','CN(C(=O)C1=CC=CC=C1)Cl','C8H8ClNO','SZDQYZRQIGILMN-UHFFFAOYSA-N'],
 [54316973,'N-fluoro-N-methylbenzamide','CN(C(=O)C1=CC=CC=C1)F','C8H8FNO','SOXCYPXQYYRALB-UHFFFAOYSA-N'],
 [2288603,'N-butyl-N-ethyl-4-methoxybenzamide','CCCCN(CC)C(=O)C1=CC=C(C=C1)OC','C14H21NO2','PYFBEXAGXADZGP-UHFFFAOYSA-N'],
 [668829,'N-cyclohexyl-N-ethyl-4-methoxybenzamide','CCN(C1CCCCC1)C(=O)C2=CC=C(C=C2)OC','C16H23NO2','MVZCFFOGUVJZLM-UHFFFAOYSA-N'],
];
const target='tests/fixtures/b71-independent-reference.json',freeze='reports/b71/corpus-freeze.json';
if(existsSync(target)||existsSync(freeze)) throw Error('Existing frozen corpus; refusing to overwrite');
const prior=['b50-pubchem-rings.json','b61-independent-reference.json','b62-independent-reference.json','b62-supplemental.json','b701-independent-reference.json']
  .flatMap(f=>JSON.parse(readFileSync(`tests/fixtures/${f}`,'utf8')).records).filter(r=>r.smiles);
const seen=new Set(prior.map(r=>structuralIdentity(r.smiles)));
const ids=data.map(x=>structuralIdentity(x[2]));
if(new Set(ids).size!==ids.length)throw Error('duplicate source structures');
for(let i=0;i<data.length;i++)if(seen.has(ids[i]))throw Error(`previously used structure CID ${data[i][0]}`);
const date=new Date().toISOString();
const records=data.map(([cid,referenceName,smiles,formula,inchiKey],i)=>({id:`B71-${String(i+1).padStart(2,'0')}`,cid,source:`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,referenceName,smiles,formula,inchiKey,identity:ids[i],stereo:'unspecified; no stereo descriptor in source SMILES'}));
const body=Buffer.from(JSON.stringify({frozenAt:date,source:'PubChem; descriptor transcription, not a raw HTTP receipt',records},null,2)+'\n');
mkdirSync('reports/b71',{recursive:true});writeFileSync(target,body,{flag:'wx'});
writeFileSync(freeze,JSON.stringify({frozenAt:date,fixture:target,sha256:createHash('sha256').update(body).digest('hex'),count:records.length,preMeasurement:true,novelty:'OCL identity against B50/B61/B62/B701 fixture records; not all incidental test structures'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({count:records.length,sha256:createHash('sha256').update(body).digest('hex')}));
