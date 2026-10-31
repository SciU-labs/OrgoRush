import {readFile,writeFile} from 'node:fs/promises';
import {moleculeFromSmiles,inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName,validatedNameTargets} from '../app/validated-name-derivation.ts';
import {recognizePurineParent} from '../app/purine-derivation.ts';
import {deriveStructuralComponents} from '../app/structural-derivation.ts';
const records=JSON.parse(await readFile(new URL('../reports/purine-reference-live.json',import.meta.url),'utf8'));
const rows=records.map(r=>{
  const imported=moleculeFromSmiles(r.SMILES),graph=imported.ok?imported.molecule:null;
  const model=graph?reconcileSystematicName(graph,r.IUPACName):null,parent=graph?recognizePurineParent(graph):null;
  return {query:r.query,url:r.url,cid:r.CID,receivedName:r.IUPACName,smiles:r.SMILES,formula:r.MolecularFormula,
    actualFormula:inspectSmilesStructure(r.SMILES).formula,import:imported.ok?'SUPPORTED':'UNSUPPORTED',
    status:model?.status??(graph?deriveStructuralComponents(graph,r.IUPACName).status:'UNSUPPORTED'),
    parent,components:model?.components,targets:model?validatedNameTargets(model):undefined};
});
const result={priority:rows.slice(0,5),generalization:rows.slice(5),counts:{priorityFull:rows.slice(0,5).filter(r=>r.status==='FULL').length,
  otherPurineFull:rows.slice(5).filter(r=>r.status==='FULL').length,nonpurineNegative:rows.find(r=>r.query==='oxypurinol')?.status}};
await writeFile(new URL('../reports/purine-derivation-coverage.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({counts:result.counts,priority:result.priority.map(({query,receivedName,status})=>({query,receivedName,status}))},null,2));
if(result.counts.priorityFull!==5||result.counts.otherPurineFull!==8||result.counts.nonpurineNegative==='FULL')process.exitCode=1;
