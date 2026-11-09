import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {buildReasoningVisualReferences,reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
import {parseParenthesizedScopes} from '../app/reasoning-functionalized-substituents.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {assertReasoningIntegrity} from './helpers/reasoning-integrity.mjs';

let chemistry;
before(async()=>{chemistry=await loadExerciseChemistry()});
after(async()=>{await chemistry?.close()});
const key=([a,b])=>[a,b].sort((x,y)=>x-y).join(':');
const examples=[
  ['O=C(O)C(CCO)CCO','ácido 4-hidroxi-2-(2-hidroxietil)butanoico','4-hydroxy-2-(2-hydroxyethyl)butanoic acid',[4,8,9,10],[[4,8],[8,9],[9,10]],[9,10]],
  ['O=C(O)C(CCN)CCC','ácido 2-(2-aminoetil)pentanoico','2-(2-aminoethyl)pentanoic acid',[4,5,6,7],[[4,5],[5,6],[6,7]],[6,7]],
  ['O=C(O)C(CC(=O)C)CCCC','ácido 2-(2-oxopropil)hexanoico','2-(2-oxopropyl)hexanoic acid',[4,5,6,7,8],[[4,5],[5,6],[6,7],[6,8]],[6,7]],
];
function permute(g){const map=new Map(g.atoms.map((a,i)=>[a.id,2000+i*13]));return {map,graph:{...g,
  atoms:[...g.atoms].reverse().map(a=>({...a,id:map.get(a.id),x:-a.y,y:a.x})),
  bonds:[...g.bonds].reverse().map(([a,b,...rest])=>[map.get(b),map.get(a),...rest])}}}
function targetFor(model,refs,keyName){
  for(const [step,value] of Object.entries(model.fragments))for(const part of [value,...(value.additionalFragments??[])])
    if(part.semanticId===`functionalized:${keyName}`)return {part,target:refs.fragments[reasoningFragmentId(step,part)]};
  assert.fail(`missing ${keyName}`);
}
test('parenthesized syntax keeps explicit nested scope and rejects unbalanced input',()=>{
  assert.deepEqual(parseParenthesizedScopes('2-(2-(x)y)z'),[{span:{start:2,end:10},children:[{span:{start:5,end:8},children:[]}]}]);
  assert.equal(parseParenthesizedScopes('2-(x'),null);
  assert.equal(parseParenthesizedScopes('2-x)'),null);
});
test('functionalized branch controls use exact graph regions and independent numbering in both languages',()=>{
  for(const [smiles,es,en,branch,bonds,func] of examples){
    const input=moleculeFromSmiles(smiles);assert.equal(input.ok,true);
    const p=permute(input.molecule);
    for(const [graph,map] of [[input.molecule,new Map(input.molecule.atoms.map(a=>[a.id,a.id]))],[p.graph,p.map]]){
      const analyses=analyzeBoth(graph,chemistry.engine), profiles=displayedProfiles(graph,analyses,chemistry.engine);
      for(const [profile,name] of [['2013-es',es],['2013-en',en]]){
        const selection=profiles[profile];assert.equal(selection.name,name);
        const model=chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,...selection,displayedName:name,
          generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
        assertReasoningIntegrity(model,graph);
        const refs=buildReasoningVisualReferences({molecule:graph,analysis:analyses.current,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
        const full=targetFor(model,refs,'complete'), group=targetFor(model,refs,'function');
        // In the symmetric first graph either hydroxyethyl arm can be the
        // parent. The independent expected regions account for both choices.
        const alternative=smiles===examples[0][0] && full.target?.atomIds.includes(map.get(5));
        const expectedBranch=alternative?[4,5,6,7]:branch;
        const expectedBonds=alternative?[[4,5],[5,6],[6,7]]:bonds;
        const expectedFunction=alternative?[6,7]:func;
        assert.ok(full.target&&group.target,name);
        assert.deepEqual([...full.target.atomIds].sort((a,b)=>a-b),expectedBranch.map(id=>map.get(id)).sort((a,b)=>a-b));
        assert.deepEqual(full.target.bondIds.map(key).sort(),expectedBonds.map(pair=>key(pair.map(id=>map.get(id)))).sort());
        assert.deepEqual([...group.target.atomIds].sort((a,b)=>a-b),expectedFunction.map(id=>map.get(id)).sort((a,b)=>a-b));
        assert.deepEqual(group.target.bondIds.map(key),[key(expectedFunction.map(id=>map.get(id)))]);
        const parent=targetFor(model,refs,'parent'), parentLocant=targetFor(model,refs,'parent-locant'), localLocant=targetFor(model,refs,'local-locant');
        assert.deepEqual(new Set(parent.target.atomIds),new Set(analyses.current.mainChain));
        assert.deepEqual(parentLocant.target.atomIds,[map.get(4)]);
        assert.deepEqual(localLocant.target.atomIds,[map.get(expectedFunction[0])]);
        assert.deepEqual(localLocant.target.locants,[[map.get(expectedFunction[0]),2]]);
        assert.equal(parentLocant.part.structuralContext.numberingScope,'parent');
        assert.equal(localLocant.part.structuralContext.numberingScope,'substituent');
        assert.equal(localLocant.part.structuralContext.locant,2);
        assert.deepEqual(localLocant.part.structuralContext.attachment,[map.get(4),map.get(expectedBranch[1])]);
        assert.ok(targetFor(model,refs,'skeleton').target);
        if(smiles===examples[0][0]) {
          const other=alternative?[9,10]:[6,7], target=targetFor(model,refs,'parent-function-4').target;
          assert.deepEqual([...target.atomIds].sort((a,b)=>a-b),other.map(id=>map.get(id)).sort((a,b)=>a-b));
          assert.deepEqual(target.bondIds.map(key),[key(other.map(id=>map.get(id)))]);
        }
        for(const part of [full.part,group.part,parent.part,parentLocant.part,localLocant.part])
          assert.equal(name.slice(part.start,part.start+part.text.length),part.text);
        assert.equal(reconcileSystematicName(graph,en),null,'no automatic FULL');
      }
    }
  }
});
test('stale branch evidence and unsupported triol never create these controls',()=>{
  for(const smiles of ['OCCC(CO)CCCCO','O=C(O)C(CCN)CCC']){
    const {molecule}=moleculeFromSmiles(smiles),analyses=analyzeBoth(molecule,chemistry.engine);
    if(smiles.startsWith('OCCC'))assert.equal(chemistry.engine.localNamerCannotSafelyName(molecule,analyses.current),true);
    else {const branch=analyses.current.substituents.find(s=>s.aminoAlkyl);branch.aminoAlkyl.amino.locant=3;}
    const m=chemistry.engine.buildActiveIupacReasoning({molecule,analyses,language:'es',convention:'current',
      displayedName:analyses.current.name,generatedNames:[analyses.current.name],canHighlight:true});
    assert.ok(!Object.values(m.fragments).some(f=>f.semanticId?.startsWith('functionalized:')));
  }
  const {molecule}=moleculeFromSmiles('O=C(O)C(CCN)CCC'),analyses=analyzeBoth(molecule,chemistry.engine);
  const terminal=analyses.current.mainChain.at(-1),id=Math.max(...molecule.atoms.map(a=>a.id))+100;
  const changed={...molecule,atoms:[...molecule.atoms,{id,x:0,y:0}],bonds:[...molecule.bonds,[terminal,id,1]]};
  const model=chemistry.engine.buildActiveIupacReasoning({molecule:changed,analyses,language:'es',convention:'current',
    displayedName:analyses.current.name,generatedNames:[analyses.current.name],canHighlight:true});
  assert.ok(!Object.values(model.fragments).some(f=>f.semanticId?.startsWith('functionalized:')),'unchanged branch with changed parent stays unavailable');
});
