// External PubChem records transcribed from linked compound pages; no product
// analysis is invoked here. This script refuses to replace a frozen corpus.
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';

const rows=[
 [13381028,'2,3-dibromobenzaldehyde','C1=CC(=C(C(=C1)Br)Br)C=O','C7H4Br2O','GEICDMWIZIQEEI-UHFFFAOYSA-N'],
 [12648641,'2,6-dibromobenzaldehyde','C1=CC(=C(C(=C1)Br)C=O)Br','C7H4Br2O','YDYNSAUGVGAOLO-UHFFFAOYSA-N'],
 [15128239,'4-iodo-2-methoxybenzaldehyde','COC1=C(C=CC(=C1)I)C=O','C8H7IO2','ZDNOHFJWXJKIJF-UHFFFAOYSA-N'],
 [11173046,'2-iodo-4-methoxybenzaldehyde','COC1=CC(=C(C=C1)C=O)I','C8H7IO2','HYWMSRPGGMIKKZ-UHFFFAOYSA-N'],
 [46864076,'5-bromo-2-iodo-4-methoxybenzaldehyde','COC1=C(C=C(C(=C1)I)C=O)Br','C8H6BrIO2','YLYKODXTVWYWHT-UHFFFAOYSA-N'],
 [11810263,'2-bromo-3-methoxybenzaldehyde','COC1=CC=CC(=C1Br)C=O','C8H7BrO2','KELPUINOQGYPKR-UHFFFAOYSA-N'],
 [3699690,'3-chloro-2-methylbenzamide','CC1=C(C=CC=C1Cl)C(=O)N','C8H8ClNO','LBGDADHDWVIRII-UHFFFAOYSA-N'],
 [15691442,'2-bromo-3-fluorobenzamide','C1=CC(=C(C(=C1)F)Br)C(=O)N','C7H5BrFNO','QIJLTAHMKMBLRZ-UHFFFAOYSA-N'],
 [2778901,'5-bromo-2-fluorobenzamide','C1=CC(=C(C=C1Br)C(=O)N)F','C7H5BrFNO','MAGQVUXQRXLNGB-UHFFFAOYSA-N'],
 [20372234,'2-bromo-4-fluorobenzamide','C1=CC(=C(C=C1F)Br)C(=O)N','C7H5BrFNO','IWODMEGZVDWKPK-UHFFFAOYSA-N'],
 [593814,'3,4,5-trifluorobenzonitrile','C1=C(C=C(C(=C1F)F)F)C#N','C7H2F3N','XFKYJMGXZXJYBS-UHFFFAOYSA-N'],
 [737177,'2,4,6-trifluorobenzonitrile','C1=C(C=C(C(=C1F)C#N)F)F','C7H2F3N','HTKFGTCCOJIUIK-UHFFFAOYSA-N'],
 [593813,'2,4,5-trifluorobenzonitrile','C1=C(C(=CC(=C1F)F)F)C#N','C7H2F3N','DLKNOGQOOZFICZ-UHFFFAOYSA-N'],
 [2776998,'2,3,5-trifluorobenzonitrile','C1=C(C=C(C(=C1C#N)F)F)F','C7H2F3N','MMPKVFQMDMBXSG-UHFFFAOYSA-N'],
 [77529,'2-iodobenzamide','C1=CC=C(C(=C1)C(=O)N)I','C7H6INO','YEOYYWCXWUDVCX-UHFFFAOYSA-N'],
 [87224536,'2-chloro-3-ethoxybenzaldehyde','CCOC1=CC=CC(=C1Cl)C=O','C9H9ClO2','DZUVADWCDVFPAE-UHFFFAOYSA-N'],
 [12125938,'3-iodo-4-nitrobenzonitrile','C1=CC(=C(C=C1C#N)I)[N+](=O)[O-]','C7H3IN2O2','ZPOUQQLCCLKTHA-UHFFFAOYSA-N'],
 [9070949,'N-benzyl-4-bromo-2-fluorobenzamide','C1=CC=C(C=C1)CNC(=O)C2=C(C=C(C=C2)Br)F','C14H11BrFNO','GKZFVYKNOHAZBT-UHFFFAOYSA-N'],
];
const target='tests/fixtures/b701-independent-reference.json',freeze='reports/b701/corpus-freeze.json';
if(existsSync(target)||existsSync(freeze))throw Error('Frozen output already exists; refusing to overwrite');
const historical=['b50-pubchem-rings.json','b61-independent-reference.json','b62-independent-reference.json','b62-supplemental.json']
 .flatMap(f=>JSON.parse(readFileSync(`tests/fixtures/${f}`,'utf8')).records).filter(r=>r.smiles);
const b7=['O=Cc1c(Cl)cc(Br)cc1','N#Cc1c(F)cc(F)cc1','NC(=O)c1c(Cl)cc(OC)cc1'];
const known=new Set([...historical.map(x=>x.smiles),...b7].map(structuralIdentity));
const identities=rows.map(row=>structuralIdentity(row[2]));
if(new Set(identities).size!==rows.length)throw Error('Duplicate selected structures');
for(let i=0;i<rows.length;i++)if(known.has(identities[i]))throw Error(`Previously used structure: CID ${rows[i][0]}`);
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const frozenAt=new Date().toISOString();
const records=rows.map(([cid,referenceName,smiles,formula,inchiKey],i)=>({id:`B701-${String(i+1).padStart(2,'0')}`,cid,
 source:`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,referenceName,smiles,formula,inchiKey,identity:identities[i]}));
const bytes=Buffer.from(JSON.stringify({frozenAt,commit,source:'PubChem compound pages; transcribed descriptors, before product measurement',records},null,2)+'\n');
mkdirSync('reports/b701',{recursive:true});writeFileSync(target,bytes,{flag:'wx'});
writeFileSync(freeze,JSON.stringify({frozenAt,commit,fixture:target,sha256:createHash('sha256').update(bytes).digest('hex'),count:records.length,
 uniqueness:'OpenChemLib canonical graph identity; compared B50/B61/B62 fixtures and B7.0 constructed examples',selectionBeforeMeasurement:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({count:records.length,sha256:createHash('sha256').update(bytes).digest('hex'),commit}));
