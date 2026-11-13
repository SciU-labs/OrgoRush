import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
import {readFileSync} from 'node:fs';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';

const cases=[
 ['Cc1ccccc1[N+](=O)[O-]','1-metil-2-nitrobenceno','1-methyl-2-nitrobenzene'],
 ['CCNC(=O)c1c(Br)cc(C)cc1','2-bromo-N-etil-4-metilbenzamida','2-bromo-N-ethyl-4-methylbenzamide'],
 ['CCN(CC)C(=O)c1cc(F)cc(F)c1','N,N-dietil-3,5-difluorobenzamida','N,N-diethyl-3,5-difluorobenzamide'],
 ['COC(=O)c1cc(Br)c(OC)cc1','3-bromo-4-metoxibenzoato de metilo','methyl 3-bromo-4-methoxybenzoate'],
 ['N#Cc1ccc(F)c(F)c1','3,4-difluorobenzonitrilo','3,4-difluorobenzonitrile'],
 ['O=C1CCC(C)CC1','4-metilciclohexanona','4-methylcyclohexanone'],
];
for(const [smiles,es,en] of cases)test(`FULL reasoning uses structural evidence and active literal name: ${en}`,()=>{
 const p=moleculeFromSmiles(smiles);assert.ok(p.ok);
 for(const [language,name] of [['es',es],['en',en]]){const proof=reconcileSystematicName(p.molecule,name);assert.ok(proof,name);
  const model=buildValidatedPriorityReasoning({derivation:proof,graph:p.molecule,language});
  const final=model.steps.find(step=>step.title===(language==='es'?'Construcción del nombre':'Constructing the name'));assert.ok(final);assert.ok(final.explanation.includes(name));
  const subst=model.steps.find(step=>step.title===(language==='es'?'Sustituyentes y localizadores':'Substituents and locants'));assert.ok(subst);assert.match(subst.explanation,/\d/);
  for(const step of model.steps)for(const f of step.fragments?[step.fragments,...step.fragments.additionalFragments??[]]:[]){
   if(f.start!==undefined)assert.equal(name.slice(f.start,f.start+f.text.length),f.text);
   const target=step.fragmentTargets[reasoningFragmentId(step.number,f)];if(target){for(const id of target.atomIds)assert.ok(p.molecule.atoms.some(a=>a.id===id));for(const [a,b] of target.bondIds)assert.ok(p.molecule.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a));}
  }
 }
});

const corpus=JSON.parse(readFileSync(new URL('../reports/b741/transversal-baseline.json',import.meta.url),'utf8')).rows;
for(const row of corpus)test(`transversal reasoning retains graph evidence: ${row.family}`,()=>{
 const parsed=moleculeFromSmiles(row.smiles);assert.ok(parsed.ok);const graph=parsed.molecule;
 for(const language of ['es','en']){const name=row.languages?.[language]?.name,proof=name&&reconcileSystematicName(graph,name);if(!proof)continue;
  const model=buildValidatedPriorityReasoning({derivation:proof,graph,language,activeName:name});
  const sourceLanguage=proof.evidence?.language??proof.components.find(c=>c.role==='parent')?.language;
  assert.equal(model.steps.some(step=>step.title===(language==='es'?'Construcción del nombre':'Constructing the name')),sourceLanguage===language);
  for(const step of model.steps){if(step.target){for(const id of step.target.atomIds)assert.ok(graph.atoms.some(a=>a.id===id));for(const [a,b] of step.target.bondIds)assert.ok(graph.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a));}
   for(const f of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[])if(f.start!==undefined)assert.equal(name.slice(f.start,f.start+f.text.length),f.text,`${row.family}: ${f.text}`);
  }
 }
});

test('a proof for another active spelling never claims to assemble that name',()=>{
 const p=moleculeFromSmiles('Cc1ccccc1[N+](=O)[O-]');assert.ok(p.ok);
 const proof=reconcileSystematicName(p.molecule,'1-methyl-2-nitrobenzene');assert.ok(proof);
 const model=buildValidatedPriorityReasoning({derivation:proof,graph:p.molecule,language:'es',activeName:'1-metil-2-nitrobenceno'});
 assert.ok(!model.steps.some(s=>s.title==='Construcción del nombre'));
 assert.ok(!model.steps.find(s=>s.title==='Sustituyentes y localizadores')?.explanation.includes('methyl'));
});

test('amide multiplier and ester alcohol group retain their distinct graph targets',()=>{
 const amide=moleculeFromSmiles('CCN(CC)C(=O)c1cc(F)cc(F)c1');assert.ok(amide.ok);
 const amideProof=reconcileSystematicName(amide.molecule,'N,N-dietil-3,5-difluorobenzamida');assert.ok(amideProof);
 const steps=buildValidatedPriorityReasoning({derivation:amideProof,graph:amide.molecule,language:'es'}).steps;
 const step=steps.find(s=>s.title==='Sustituyentes y localizadores');assert.match(step.explanation,/2 ramas separadas/);assert.match(step.explanation,/di- cuenta ambas/);
 const fluoro=[step.fragments,...step.fragments.additionalFragments??[]].find(f=>f.text==='difluoro');assert.match(fluoro.explanation,/2 grupos separados/);assert.doesNotMatch(fluoro.explanation,/1 átomo/);
 for(const item of steps){for(const target of [item.target,...Object.values(item.fragmentTargets)].filter(Boolean))
  assert.ok(!target.locants.some(([id,n])=>typeof n==='number'&&n!==1&&amideProof.components.find(c=>c.role==='parent').atomIds.includes(id)),`${item.title}: ambiguous ring locant`);}
 const multiplier=[step.fragments,...step.fragments.additionalFragments??[]].find(f=>f.semanticId?.startsWith('amide-multiplier:'));assert.ok(multiplier);
 const target=step.fragmentTargets[reasoningFragmentId(step.number,multiplier)],branches=amideProof.components.filter(c=>c.attachmentScope==='amide-nitrogen');
 for(const branch of branches){for(const atom of branch.atomIds)assert.ok(target.atomIds.includes(atom));for(const [a,b] of branch.bondIds)assert.ok(target.bondIds.some(([x,y])=>x===a&&y===b||x===b&&y===a));}
 const ester=moleculeFromSmiles('COC(=O)c1cc(Br)c(OC)cc1');assert.ok(ester.ok);const esterProof=reconcileSystematicName(ester.molecule,'3-bromo-4-metoxibenzoato de metilo');assert.ok(esterProof);
 const model=buildValidatedPriorityReasoning({derivation:esterProof,graph:ester.molecule,language:'es'});
 assert.match(model.steps.map(s=>s.explanation).join(' '),/grupo derivado del alcohol unido al oxígeno del éster/);
 const alcohol=esterProof.components.find(c=>c.parentId==='suffix'&&c.role==='substituent'),methoxy=esterProof.components.find(c=>c.text==='metoxi');
 assert.ok(alcohol&&methoxy);assert.ok(alcohol.atomIds.every(id=>!methoxy.atomIds.includes(id)));
});

test('nonliteral functional and numbering controls remain selectable as structural references',async()=>{
 const c=await loadExerciseChemistry();try{
  const f={text:'aldehído',label:'Grupo aldehído',kind:'function',semanticId:'suffix',atomIds:[1,2]};
  const id=reasoningFragmentId('01',f),target={stepNumber:'01',fragmentId:id,atomIds:[1,2],bondIds:[[1,2]],locants:[]};
  const row=c.engine.ReasoningNameFragmentView({fragment:f,stepNumber:'01',visualTargets:{[id]:target},onActivateTarget(){},language:'es',activeName:'propanal'}).props.children[0];
  const button=row.props.children[0],label=row.props.children[1];assert.equal(button.type,'button');assert.equal(button.props['data-reasoning-region'],'structural-reference');
  assert.match(button.props['aria-label'],/Referencia estructural/);assert.match(label.props.children,/Referencia estructural/);
  for(const language of ['es','en']){
   const part={text:'2,4-diene',label:'Multiple bonds, locants, and multiplicity',kind:'unsaturation'};
   const partId=reasoningFragmentId('03',part),numberTarget={stepNumber:'03',fragmentId:partId,atomIds:[2,4],bondIds:[],locants:[[2,2],[4,4]]};
   const view=c.engine.ReasoningNameFragmentView({fragment:part,stepNumber:'03',visualTargets:{[partId]:numberTarget},onActivateTarget(){},language,activeName:'hexa-2,4-diene'}).props.children[0];
   assert.match(view.props.children[0].props['aria-label'],language==='es'?/Localizadores de enlaces múltiples/:/Multiple-bond locants/);
  }
 }finally{await c.close();}
});
