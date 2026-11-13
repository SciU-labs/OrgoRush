import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName, selectVerifiedLocalizedPresentation} from '../app/validated-name-derivation.ts';
import {resolveDerivationConsistency} from '../app/derivation-consistency.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';

const cases=[
 ['Cc1ccccc1[N+](=O)[O-]','1-methyl-2-nitrobenzene','1-metil-2-nitrobenceno'],
 ['CCNC(=O)c1c(Br)cc(C)cc1','2-bromo-N-ethyl-4-methylbenzamide','2-bromo-N-etil-4-metilbenzamida'],
 ['CCN(CC)C(=O)c1cc(F)cc(F)c1','N,N-diethyl-3,5-difluorobenzamide','N,N-dietil-3,5-difluorobenzamida'],
 ['COC(=O)c1cc(Br)c(OC)cc1','methyl 3-bromo-4-methoxybenzoate','3-bromo-4-metoxibenzoato de metilo'],
 ['N#Cc1ccc(F)c(F)c1','3,4-difluorobenzonitrile','3,4-difluorobenzonitrilo'],
 ['O=C1CCC(C)CC1','4-methylcyclohexanone','4-metilciclohexanona'],
];
test('a locally generated Spanish alternative replaces an unlocalized external name only with a complete graph proof',()=>{
 for(const [smiles,en,es] of cases){const p=moleculeFromSmiles(smiles);assert.ok(p.ok);const model=reconcileSystematicName(p.molecule,en);assert.ok(model,en);
  assert.deepEqual(selectVerifiedLocalizedPresentation(model,p.molecule,'es',es),{name:es,language:'es',localized:true});
  const consistency=resolveDerivationConsistency({molecule:p.molecule,activeName:es,activeProfile:'current',language:'es',currentSourceName:en});
  assert.equal(consistency.status,'verified');assert.equal(consistency.derivation.name,es);
  const reasoning=buildValidatedPriorityReasoning({derivation:consistency.derivation,graph:p.molecule,language:'es'});
  for(const step of reasoning.steps){if(!step.fragments)continue;for(const fragment of [step.fragments,...(step.fragments.additionalFragments??[])]){
    if(fragment.start!==undefined)assert.equal(es.slice(fragment.start,fragment.start+fragment.text.length),fragment.text);
  }}
  assert.equal(selectVerifiedLocalizedPresentation(model,p.molecule,'en',es).name,en);
  assert.equal(selectVerifiedLocalizedPresentation(model,p.molecule,'es','3-metilbenceno').name,en);
 }
});

test('nitro is explained as a functional prefix when no suffix group is selected',()=>{
 for(const [smiles,es,en] of [
  ['Cc1ccccc1[N+](=O)[O-]','1-metil-2-nitrobenceno','1-methyl-2-nitrobenzene'],
  ['Cc1cccc([N+](=O)[O-])c1','1-metil-3-nitrobenceno','1-methyl-3-nitrobenzene'],
  ['Cc1ccc([N+](=O)[O-])cc1','1-metil-4-nitrobenceno','1-methyl-4-nitrobenzene'],
 ]){const p=moleculeFromSmiles(smiles);assert.ok(p.ok);
  for(const [language,name] of [['es',es],['en',en]]){const proof=reconcileSystematicName(p.molecule,name);assert.ok(proof);
   const step=buildValidatedPriorityReasoning({derivation:proof,graph:p.molecule,language}).steps.find(s=>s.title===(language==='es'?'Función expresada como prefijo':'Function expressed as a prefix'));
   assert.ok(step);assert.match(step.explanation,language==='es'?/nitro.*prefijo.*sufijo/i:/nitro.*prefix.*suffix/i);
   assert.ok(step.target.atomIds.length>=3);assert.ok(step.target.bondIds.length>=3);
  }
 }
});
