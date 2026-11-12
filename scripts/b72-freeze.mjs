import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
import {Molecule} from 'openchemlib';
const names=['N-benzylbenzamide','N-benzyl-2-methylbenzamide','N-benzyl-3-methylbenzamide','N-benzyl-4-methylbenzamide','N-benzyl-2-methoxybenzamide','N-benzyl-4-methoxybenzamide','N-benzyl-2-fluorobenzamide','N-benzyl-4-fluorobenzamide','N-benzyl-2-chlorobenzamide','N-benzyl-4-chlorobenzamide','N-benzyl-4-bromobenzamide','N-benzyl-4-iodobenzamide','N-phenylbenzamide','N-phenethylbenzamide'];
const fixture='tests/fixtures/b72-independent-reference.json',freeze='reports/b72/corpus-freeze.json';
if(existsSync(fixture)||existsSync(freeze))throw Error('Already frozen');
const records=names.map((name,i)=>{const path=`reports/b72/receipts/${name}.json`,raw=readFileSync(path),p=JSON.parse(raw).PropertyTable.Properties[0];
 const smiles=p.ConnectivitySMILES??p.CanonicalSMILES,identity=structuralIdentity(smiles),m=Molecule.fromSmiles(smiles);
 const canonicalFormula=s=>[...s.matchAll(/([A-Z][a-z]?)(\d*)/g)].map(x=>`${x[1]}:${x[2]||1}`).sort().join(',');
 if(canonicalFormula(m.getMolecularFormula().formula)!==canonicalFormula(p.MolecularFormula))throw Error(`formula ${name}`);
 return {id:`B72-${String(i+1).padStart(2,'0')}`,referenceName:name,cid:p.CID,source:`https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,receipt:path,receiptSha256:createHash('sha256').update(raw).digest('hex'),smiles,formula:p.MolecularFormula,inchiKey:p.InChIKey,identity,stereo:'unspecified'};});
if(new Set(records.map(r=>r.identity)).size!==records.length)throw Error('Duplicate');
const files=['b50-pubchem-rings.json','b61-independent-reference.json','b62-independent-reference.json','b62-supplemental.json','b701-independent-reference.json','b71-independent-reference.json'];
const prior=files.flatMap(f=>JSON.parse(readFileSync(`tests/fixtures/${f}`,'utf8')).records).filter(r=>r.smiles);
for(const r of records){r.previous=prior.filter(p=>structuralIdentity(p.smiles)===r.identity).map(p=>p.id);}
const date=new Date().toISOString(),body=Buffer.from(JSON.stringify({frozenAt:date,records},null,2)+'\n');
writeFileSync(fixture,body,{flag:'wx'});writeFileSync(freeze,JSON.stringify({frozenAt:date,sha256:createHash('sha256').update(body).digest('hex'),count:records.length,preMeasurement:true,receipts:'Original responses obtained before freeze',duplicateScope:files,previous:records.filter(r=>r.previous.length).map(r=>({id:r.id,previous:r.previous}))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({count:records.length,previous:records.filter(r=>r.previous.length)}));
