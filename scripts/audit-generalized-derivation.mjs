import { writeFile, readFile } from 'node:fs/promises';
import { generalizationCases } from '../tests/fixtures/generalized-derivation.mjs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { deriveStructuralComponents, mapStructuralRegions } from '../app/structural-derivation.ts';

const live=process.argv.includes('--live');
const baseline=JSON.parse(await readFile(new URL('../reports/generalization-before.json',import.meta.url),'utf8'));
const rows=[];
for(const f of generalizationCases) {
  let receivedName=f.name,smiles=f.smiles,source='independent fixture',error,referenceIdentity;
  if(live) {
    try {
      const response=await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(f.common)}/property/IUPACName,SMILES,MolecularFormula/JSON`,{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const property=(await response.json()).PropertyTable?.Properties?.[0];
      if(!property?.IUPACName || !property.SMILES)throw Error('Property response lacks name or SMILES');
      receivedName=property.IUPACName;smiles=property.SMILES;source=`PubChem CID ${property.CID}`;
      const actual=moleculeFromSmiles(smiles),expected=moleculeFromSmiles(f.smiles);
      referenceIdentity=actual.ok&&expected.ok&&!!mapStructuralRegions(expected.molecule,actual.molecule,[]);
    } catch(e) {error=String(e);rows.push({common:f.common,source:'live attempt failed',error});continue;}
  }
  const imported=moleculeFromSmiles(smiles);
  const full=imported.ok?reconcileSystematicName(imported.molecule,receivedName):null;
  const status=full?.status??(imported.ok?deriveStructuralComponents(imported.molecule,receivedName).status:'UNSUPPORTED');
  rows.push({common:f.common,source,receivedName,reconciledName:full?.name??null,smiles,referenceIdentity,
    before:baseline.find(row=>row.common===f.common)?.before,after:status,family:f.family,
    parent:full?.parentAtomIds??[],components:full?.components??[],error:imported.ok?undefined:imported.error});
}
const evaluated=rows.filter(r=>r.after),counts=Object.fromEntries(['FULL','PARTIAL','UNSUPPORTED'].map(status=>[status,evaluated.filter(r=>r.after===status).length]));
const result={mode:live?'live':'fixtures',evaluated:evaluated.length,attempted:rows.length,counts,rows};
await writeFile(new URL(`../reports/generalization-${live?'live':'after'}.json`,import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({mode:result.mode,evaluated:result.evaluated,counts,rows:rows.map(({common,receivedName,after,error,referenceIdentity})=>({common,receivedName,after,error,referenceIdentity}))},null,2));
if(live && (evaluated.length!==rows.length || rows.some(row=>row.referenceIdentity!==true)))process.exitCode=1;
