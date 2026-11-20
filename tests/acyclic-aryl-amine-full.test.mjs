import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName,presentValidatedSystematicName} from '../app/validated-name-derivation.ts';
import {resolveDerivationConsistency} from '../app/derivation-consistency.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {reasoningFragmentId} from '../app/reasoning-visual-targets.ts';

const name='N-methyl-3-phenylpropan-1-amine';
const source=()=>{const result=moleculeFromSmiles('CNCCCc1ccccc1');assert.equal(result.ok,true);return result.molecule;};
const sorted=x=>[...x].sort((a,b)=>a-b);
test('validated route proves the name and exposes exact bilingual graph selections',()=>{
 const graph=source(), proof=reconcileSystematicName(graph,name);assert.equal(proof?.status,'FULL');
 assert.equal(proof.preferred,false);assert.equal(proof.evidence.parentSelection,'amine-longest-n-attached-chain');
 assert.deepEqual(sorted(proof.components.find(c=>c.id==='parent').atomIds),[3,4,5]);
 assert.deepEqual(proof.components.find(c=>c.id==='suffix').atomIds,[2]);
 assert.deepEqual(proof.components.find(c=>c.id==='n-alkyl').atomIds,[1]);
 assert.deepEqual(sorted(proof.components.find(c=>c.id==='phenyl').atomIds),[6,7,8,9,10,11]);
 const es=presentValidatedSystematicName(proof,'es');assert.equal(es.name,'3-fenil-N-metilpropan-1-amina');
 for(const [language,activeName] of [['en',name],['es',es.name]]){
  const result=resolveDerivationConsistency({molecule:graph,activeName,activeProfile:'current',language,currentSourceName:name});
  assert.equal(result.status,'verified');assert.equal(result.derivation.status,'FULL');
  const model=buildValidatedPriorityReasoning({graph,derivation:result.derivation,language,activeName});
  const text=model.steps.map(s=>s.explanation).join(' ');
  assert.match(text,language==='en'?/amine/:/amina/);assert.doesNotMatch(text,language==='en'?/amide/:/amida/);
  assert.match(text,language==='en'?/secondary/:/secundaria/);
  assert.match(text,/C1/);assert.match(text,/C3/);
  assert.ok(model.steps.some(s=>s.title===(language==='en'?'Constructing the name':'Construcción del nombre')));
  const fragments=model.steps.flatMap(step=>[step.fragments,...(step.fragments?.additionalFragments??[])].filter(Boolean).map(fragment=>({step,fragment})));
  for(const id of ['parent','suffix','n-alkyl','phenyl'])assert.ok(fragments.some(x=>x.fragment.semanticId===id),`${language} ${id}`);
  const expected={parent:{atoms:[3,4,5],bonds:['3:4','4:5']},suffix:{atoms:[2],bonds:['2:3']},
    'n-alkyl':{atoms:[1],bonds:['1:2']},phenyl:{atoms:[6,7,8,9,10,11],bonds:['5:6','6:7','6:11','7:8','8:9','9:10','10:11']}};
  for(const [id,region] of Object.entries(expected)) {
   const found=fragments.find(x=>x.fragment.semanticId===id);
   const target=found.step.fragmentTargets[reasoningFragmentId(found.step.number,found.fragment)];
   assert.deepEqual(sorted(target.atomIds),region.atoms,`${language} ${id} atoms`);
   assert.deepEqual(target.bondIds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(':')).sort(),[...region.bonds].sort(),`${language} ${id} bonds`);
  }
  const locant=fragments.find(({fragment})=>fragment.semanticId?.startsWith('locant:parent:')&&fragment.text==='3');
  assert.ok(locant);assert.deepEqual(locant.fragment.atomIds,[5]);
  for(const {step,fragment} of fragments){const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];assert.ok(target,fragment.semanticId);
   assert.ok(target.atomIds.every(id=>graph.atoms.some(a=>a.id===id)));assert.ok(target.bondIds.every(([a,b])=>graph.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));}
 }
 assert.equal(resolveDerivationConsistency({molecule:graph,activeName:name,activeProfile:'legacy',language:'en'}).status,'profile-mismatch');
});
test('permutation preserves whole proof and wrong localisations fail closed',()=>{
 const graph=source(), transformed={atoms:[...graph.atoms].reverse().map(a=>({...a,id:a.id*31+500})),bonds:[...graph.bonds].reverse().map(([a,b,o])=>[b*31+500,a*31+500,o])};
 const proof=reconcileSystematicName(transformed,name);assert.equal(proof?.status,'FULL');
 assert.deepEqual(sorted(proof.components.find(c=>c.id==='parent').atomIds),[3,4,5].map(n=>n*31+500));
 for(const bad of ['N-methyl-2-phenylpropan-1-amine','N-methyl-3-phenylpropan-2-amine','3-phenyl-N-methylpropan-1-amine','N-ethyl-3-phenylpropan-1-amine'])assert.equal(reconcileSystematicName(graph,bad),null,bad);
 const stereo=structuredClone(graph);stereo.atoms[2].tetrahedralParity='R';assert.equal(reconcileSystematicName(stereo,name),null);
});
test('same construction supports a different N-alkyl and longer parent',()=>{
 const graph=moleculeFromSmiles('CCNCCCCc1ccccc1').molecule;
 assert.equal(reconcileSystematicName(graph,'N-ethyl-4-phenylbutan-1-amine')?.status,'FULL');
});
test('equal or longer N-attached parent candidates are not decided by this production',()=>{
 const tied=moleculeFromSmiles('CCCNCCCc1ccccc1').molecule;
 assert.equal(reconcileSystematicName(tied,'N-propyl-3-phenylpropan-1-amine'),null);
 const longer=moleculeFromSmiles('CCCCNCCCc1ccccc1').molecule;
 assert.equal(reconcileSystematicName(longer,'N-butyl-3-phenylpropan-1-amine'),null);
});
