import {writeFile} from 'node:fs/promises';
import {carbohydrateCases,carbohydrateReferences} from '../tests/fixtures/carbohydrate-derivation.mjs';
import {generalizationCases} from '../tests/fixtures/generalized-derivation.mjs';
import {purineCases} from '../tests/fixtures/purine-derivation.mjs';
import {moleculeFromSmiles,inspectSmilesStructure,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {recognizeCarbohydrate} from '../app/carbohydrate-structure.ts';
import {reconcileSystematicName,validatedNameTargets} from '../app/validated-name-derivation.ts';
import {deriveStructuralComponents,mapStructuralRegions} from '../app/structural-derivation.ts';
const graph=s=>{const r=moleculeFromSmiles(s);if(!r.ok)throw Error(r.error);return r.molecule;};
const rows=carbohydrateCases.map(f=>{
  const g=graph(f.smiles),s=recognizeCarbohydrate(g),m=reconcileSystematicName(g,f.name),retained=reconcileSystematicName(g,f.common);
  const original=carbohydrateReferences.find(r=>r.query===f.common),p=original.pubchem.body.PropertyTable.Properties[0];
  const exported=moleculeToSmiles(g);
  return {query:f.common,priority:f.priority,receivedName:f.name,smiles:f.smiles,formula:f.formula,cid:f.cid,
    import:{status:'SUPPORTED',inspection:inspectSmilesStructure(f.smiles),exported,roundtrip:exported.ok&&!!mapStructuralRegions(g,graph(exported.smiles),[])},
    structuralRecognition:{status:s?'RECOGNIZED':'UNSUPPORTED',...s},
    derivation:{systematicStatus:m?.status??deriveStructuralComponents(g,f.name).status,
      retainedStatus:retained?.status??deriveStructuralComponents(g,f.common).status,
      components:m?.components,targets:m?validatedNameTargets(m):undefined},
    originalPubChemQuery:{cid:p.CID,receivedName:p.IUPACName,smiles:p.SMILES??p.IsomericSMILES,
      matchesExpectedGraph:!!mapStructuralRegions(g,graph(p.SMILES??p.IsomericSMILES),[])}};
});
const generic=carbohydrateReferences.slice(14).map(r=>{const p=r.pubchem.body.PropertyTable.Properties[0],g=graph(p.SMILES??p.IsomericSMILES);return{
  query:r.query,source:'PubChem',receivedName:p.IUPACName,smiles:p.SMILES??p.IsomericSMILES,
  recognition:recognizeCarbohydrate(g),status:reconcileSystematicName(g,p.IUPACName)?.status??deriveStructuralComponents(g,p.IUPACName).status,
};});
const previous=[...generalizationCases,...purineCases,
  {common:'ibuprofen',name:'2-[4-(2-methylpropyl)phenyl]propanoic acid',smiles:'CC(C)Cc1ccc(cc1)C(C)C(=O)O'},
  {common:'paracetamol',name:'N-(4-hydroxyphenyl)acetamide',smiles:'CC(=O)Nc1ccc(O)cc1'},
  {common:'aspirin',name:'2-(acetyloxy)benzoic acid',smiles:'CC(=O)Oc1ccccc1C(=O)O'},
].map(f=>({query:f.common,name:f.name,status:reconcileSystematicName(graph(f.smiles),f.name)?.status??'PARTIAL'}));
const result={priority:rows.filter(r=>r.priority),generalization:rows.filter(r=>!r.priority),genericPubChem:generic,previous,
  counts:{priorityImportable:rows.filter(r=>r.priority&&r.import.status==='SUPPORTED').length,
    prioritySystematicFull:rows.filter(r=>r.priority&&r.derivation.systematicStatus==='FULL').length,
    priorityRetainedFull:rows.filter(r=>r.priority&&r.derivation.retainedStatus==='FULL').length,
    previousFull:previous.filter(r=>r.status==='FULL').length}};
await writeFile(new URL('../reports/carbohydrate-derivation-coverage.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({counts:result.counts,priority:result.priority.map(r=>({query:r.query,systematic:r.derivation.systematicStatus,retained:r.derivation.retainedStatus}))},null,2));
if(result.counts.prioritySystematicFull!==10||result.counts.priorityRetainedFull!==9||result.counts.previousFull!==20)process.exitCode=1;
