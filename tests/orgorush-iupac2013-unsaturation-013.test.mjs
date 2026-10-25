import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {UNSATURATION_013} from './fixtures/orgorush-iupac2013-unsaturation-013.mjs';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {referenceGraph,referenceParentCandidates,normalizeFormula} from './helpers/validation-008-reference.mjs';
import {observe,project,evidence,assertReasoningIntegrity} from './helpers/reasoning-integrity.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';

let chemistry;
before(async()=>{chemistry=await loadExerciseChemistry();});
after(async()=>chemistry?.close());
const isBond=(pair,a,b)=>pair[0]===a&&pair[1]===b||pair[0]===b&&pair[1]===a;

for(const row of UNSATURATION_013)test(`UNSATURATION-013 ${row.smiles}: complete graph, current parent, bilingual name and invariant storage`,()=>{
 const {engine}=chemistry,observed=observe(engine,row.smiles),{molecule,analyses,profiles}=observed;
 const current=analyses.current,reference=referenceGraph(row.smiles);
 assert.equal(molecule.atoms.length,row.carbons);assert.equal(reference.atoms.length,row.carbons);
 assert.equal(normalizeFormula(current.formula),`C${row.carbons}H${row.hydrogens}`);
 assert.equal(profiles['2013-es'].name,row.es);assert.equal(profiles['2013-en'].name,row.en);
 if(row.legacyEs){assert.equal(profiles['1979-es'].name,row.legacyEs);assert.equal(profiles['1979-en'].name,row.legacyEn);}
 assert.equal(current.mainChain.length,row.parent);assert.deepEqual(current.doubleBondLocants,row.doubles);
 assert.ok(referenceParentCandidates(reference,'2013-es').some(p=>p.join(',')===current.mainChain.join(',')),'independent P-44.3.2 path oracle');
 assert.equal(current.substituents.length,1);
 const s=current.substituents[0],anchor=current.mainChain[row.locant-1],carbon=s.atomIds[0];
 assert.equal(s.locant,row.locant);assert.equal(s.name,row.methyl?'metil':'metilideno');assert.equal(s.atomIds.length,1);
 assert.equal(molecule.bonds.find(pair=>isBond(pair,anchor,carbon))[2],row.methyl?1:2);
 assert.equal(reference.neighbors(anchor).find(edge=>edge.id===carbon).order,row.methyl?1:2,'independent bond order');
 assert.equal(molecule.bonds.filter(b=>b[2]===2).length,row.doubles.length+(row.methyl?0:1));
 assert.equal(engine.verifyCurrentMethylideneModel(molecule,current),!row.methyl);
 for(const key of ['2013-es','2013-en','1979-es','1979-en'])if(profiles[key].name)assertReasoningIntegrity(project(engine,observed,key),molecule);
 const remap=id=>900-11*id;
 for(const transform of [a=>({...a,id:remap(a.id)}),a=>({...a,id:remap(a.id),x:-a.x,y:-a.y})]){
  const variant={...molecule,atoms:molecule.atoms.map(transform).reverse(),bonds:molecule.bonds.map(([a,b,...tail])=>[remap(b),remap(a),...tail]).reverse()};
  const before=structuredClone(variant),va=analyzeBoth(variant,engine),vp=displayedProfiles(variant,va,engine);
  for(const key of Object.keys(profiles))assert.equal(vp[key].name,profiles[key].name,key);
  assert.deepEqual(variant,before);assert.equal(va.current.mainChain.length,row.parent);
  assert.equal(engine.verifyCurrentMethylideneModel(variant,va.current),!row.methyl);
 }
});

test('UNSATURATION-013 pedagogy separates parent C=C and the real C3=CH2 attachment in both languages',()=>{
 const {engine}=chemistry,o=observe(engine,'C=CC(CC)=C'),a=o.analyses.current,s=a.substituents[0],anchor=a.mainChain[2],carbon=s.atomIds[0];
 for(const key of ['2013-es','2013-en']){
  const model=project(engine,o,key),text=model.steps.map(s=>s.explanation).join(' '),term=key==='2013-en'?'methylidene':'metilideno';
  assert.match(text,/P-44\.3\.2/);assert.match(text,/5 carbon/);assert.match(text,/P-29\.2/);assert.match(text,/P-56\.4/);
  assert.match(text,/CH₂/);assert.match(text,/CH₃/);assert.ok(text.includes(o.profiles[key].name));
  const part=evidence(model).find(p=>p.semanticId==='substituent:methylidene:3');
  assert.equal(part.text,term);assert.equal(part.bondType,'double');assert.ok(part.bondIds.some(p=>isBond(p,anchor,carbon)));
  assert.deepEqual(new Set(part.atomIds),new Set([anchor,carbon]));
  assert.ok(model.links.some(p=>p.text===term&&p.bondType==='double'&&p.bondIds.some(b=>isBond(b,anchor,carbon))));
  assert.ok(model.links.some(p=>p.text==='3'&&p.atomIds?.includes(anchor)));
  const [l,r]=a.mainChain;
  assert.ok(evidence(model).some(p=>p.kind==='unsaturation'&&p.bondIds?.some(b=>isBond(b,l,r))));
  assertReasoningIntegrity(model,o.molecule);
 }
});

test('UNSATURATION-013 witness rejects missing/invented double bonds, wrong attachments and incomplete models',()=>{
 const {engine}=chemistry,o=observe(engine,'C=CC(CC)=C'),a=o.analyses.current,graph=o.molecule,s=a.substituents[0];
 const rejects=[
  {...graph,atoms:[...graph.atoms,{id:999,x:0,y:0}]},
  {...graph,bonds:graph.bonds.map(b=>b.includes(s.atomIds[0])?[b[0],b[1],1]:b)},
  {...graph,bonds:[...graph.bonds,[a.mainChain[2],999,1]],atoms:[...graph.atoms,{id:999,x:0,y:0}]},
  {...graph,atoms:graph.atoms.map((x,i)=>i?x:{...x,charge:1})},
 ];
 for(const g of rejects)assert.equal(engine.verifyCurrentMethylideneModel(g,a),false);
 const methyl=observe(engine,'C=CC(C)CC');
 assert.equal(engine.verifyCurrentMethylideneModel(methyl.molecule,{...methyl.analyses.current,substituents:[{...methyl.analyses.current.substituents[0],name:'metilideno'}]}),false);
 for(const mutation of [{doubleBondLocants:[]},{doubleBondLocants:[1,1]},
  {substituents:[{...s,locant:2}]},{substituents:[{...s,atomIds:[999]}]},
  {substituents:[s,{...s,locant:4}]},{mainChain:[...a.mainChain].reverse()}])
  assert.equal(engine.verifyCurrentMethylideneModel(graph,{...a,...mutation}),false);
 assert.equal(observe(engine,'C=CC(C)CC').profiles['2013-es'].name,'3-metilpent-1-eno');
});

test('UNSATURATION-013 unverified divalent components and multiple methylidenes fail closed',()=>{
 for(const smiles of ['CCCC(=CC)CCCC','CCC(=C)C(=C)CCC']){
  const {molecule}=moleculeFromSmiles(smiles),analyses=analyzeBoth(molecule,chemistry.engine);
  assert.equal(analyses.current.cyclicUnsupported,'current-multiple-attachment-not-completely-represented');
  assert.equal(displayedProfiles(molecule,analyses,chemistry.engine)['2013-es'].name,null);
 }
 const g=observe(chemistry.engine,'C=CC(CC)=C').molecule;
 for(const graph of [{...g,atoms:[...g.atoms,{id:999,x:0,y:0}]},
  {...g,bonds:[...g.bonds,[3,999,1]],atoms:[...g.atoms,{id:999,x:0,y:0}]}]){
  const a=chemistry.engine.analyzeMolecule(graph);
  assert.equal(chemistry.engine.externalCandidateNeedsNeutralLocalName(graph,a),true);
 }
});

test('UNSATURATION-013 current E/Z descriptors retain their parent locants and graph evidence',()=>{
 for(const [smiles,descriptor] of [['C/C=C/C(=C)CCC','(2E)'],['C/C=C\\C(=C)CCC','(2Z)']]){
  const o=observe(chemistry.engine,smiles);
  assert.equal(o.profiles['2013-es'].name,`${descriptor}-4-metilidenohept-2-eno`);
  assert.equal(o.profiles['2013-en'].name,`${descriptor}-4-methylidenehept-2-ene`);
  for(const key of ['2013-es','2013-en'])assertReasoningIntegrity(project(chemistry.engine,o,key),o.molecule);
 }
});
