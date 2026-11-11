// Selection by independently obtained references and historical novelty only.
// This module deliberately imports neither the generator nor the name verifier.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const pool=await read('../reports/b61/reference-pool.json'),novelty=await read('../reports/b61/novelty.json');
const selection=[
  [24834,'aromatic-aldehyde-ether'],[11950,'aromatic-aldehyde-regioisomer'],
  [7020622,'primary-aromatic-amide'],[117869,'N-substituted-aromatic-amide'],
  [14517,'halogenated-aromatic-nitrile'],[587203,'multiply-halogenated-nitrile'],
  [10758,'functionalized-side-chain-nitrile'],[31266,'unsaturated-alcohol-derived-ester'],
  [13156,'halogenated-side-chain-ketone'],[557975,'geminal-multiply-branched-cyclic-ketone'],
  [79506,'symmetric-cyclic-ketone'],[522591,'mixed-branched-cyclic-ketone'],
  [11230,'branched-unsaturated-cyclic-alcohol'],[11142,'ring-and-exocyclic-unsaturation'],
  [637563,'stereo-aromatic-alkenyl-ether'],[6552009,'explicit-stereo-bicyclic-alcohol'],
  [8465,'amino-functionalized-side-chain'],[11849,'multiple-nitro-and-methyl-prefixes'],
  [7498,'halogen-in-side-chain-versus-ring'],[23094808,'combined-halogens-ether-aldehyde'],
];
const records=selection.map(([cid,stratum],index)=>{
  const source=pool.records.find(r=>r.CID===cid),check=novelty.records.find(r=>r.cid===cid);
  if(!source||!check?.novel)throw new Error(`CID ${cid}: missing reference or not novel`);
  return {id:`B61-I${String(index+1).padStart(2,'0')}`,externalId:`PubChem:CID${cid}`,cid,stratum,
    source:source.sourcePage,retrievalUrl:source.source,retrievedAt:source.retrievedAt,receiptSha256:source.receiptSha256,
    smiles:source.SMILES,connectivitySmiles:source.ConnectivitySMILES,formula:source.MolecularFormula,
    referenceName:source.IUPACName,referenceNameKind:'PubChem computed IUPAC name; not PIN certification',referenceSpanish:null,
    inchiKey:source.InChIKey,stereo:{definedAtoms:source.DefinedAtomStereoCount,undefinedAtoms:source.UndefinedAtomStereoCount,
      definedBonds:source.DefinedBondStereoCount,undefinedBonds:source.UndefinedBondStereoCount},
    availableEvidence:['independent-public-name-structure-record','independent-formula','explicit-stereo-metadata'],
    unavailableEvidence:['local-OPSIN-not-installed','no-independent-Spanish-whole-name-oracle'],
    novelty:{constitutionKey:check.constitutionKey,historicalOverlap:false}};
});
if(new Set(records.map(r=>r.novelty.constitutionKey)).size!==records.length)throw new Error('Duplicate constitution in selected records');
const corpus={version:'B6.1-frozen-1',frozenAt:new Date().toISOString(),selectionBeforeGenerator:true,
  selectionProtocol:'20 source-based strata spanning admitted families and deliberate boundary combinations; no generator outputs used in selection',
  historicalInventory:novelty.historicalConstitutions,records};
const body=JSON.stringify(corpus,null,2)+'\n',sha256=createHash('sha256').update(body).digest('hex');
await writeFile(new URL('../tests/fixtures/b61-independent-reference.json',import.meta.url),body,{flag:'wx'});
await writeFile(new URL('../reports/b61/corpus-freeze.json',import.meta.url),JSON.stringify({sha256,records:records.length,frozenAt:corpus.frozenAt,
  path:'tests/fixtures/b61-independent-reference.json',engineNotImported:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({records:records.length,sha256,engineNotImported:true}));
