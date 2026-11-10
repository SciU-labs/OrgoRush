import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles,resolvedProfileAnalyses} from '../scripts/naming-audit/evaluate.mjs';
import {buildReasoningVisualReferences,reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
import {assertReasoningIntegrity} from './helpers/reasoning-integrity.mjs';
import {structuralIdentity} from './helpers/reference-corpus.mjs';

const records=JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json',import.meta.url),'utf8')).records;
let engine,server;
before(async()=>{server=await loadExerciseChemistry();engine=server.engine});
after(async()=>{await server?.close()});
const cases=[
  [7731,'metil','metoxi',[1,4],[4,1]],
  [12207,'metil','yodo',[1,4],[4,1]],
  [9603,'fluoro','metil',[1,4],[1,4]],
  [7931,'cloro','metil',[1,3],[1,3]],
  [7236,'bromo','metil',[1,2],[1,2]],
];
for(const [cid,first,second,es,en] of cases)test(`localized aromatic candidate maps actual atoms for CID ${cid}`,()=>{
  const {smiles}=records.find(item=>item.cid===cid), imported=moleculeFromSmiles(smiles);
  assert.equal(imported.ok,true);const molecule=imported.molecule;
  const map=new Map(molecule.atoms.map((atom,index)=>[atom.id,2000+index*13]));
  const permuted={...molecule,atoms:[...molecule.atoms].reverse().map(atom=>({...atom,id:map.get(atom.id),x:-atom.y,y:atom.x})),
    bonds:[...molecule.bonds].reverse().map(([a,b,...rest])=>[map.get(b),map.get(a),...rest]),
    rings:molecule.rings.map(ring=>({...ring,atomIds:[...ring.atomIds].reverse().map(id=>map.get(id))}))};
  const rotated={...molecule,rings:molecule.rings.map(ring=>({...ring,atomIds:[...ring.atomIds.slice(2),...ring.atomIds.slice(0,2)]}))};
  for(const graph of [molecule,permuted,rotated]){
    const before=structuredClone(graph),analysis=engine.analyzeMolecule(graph);
    const spanish=engine.proposeLocalizedAromaticNumbering(graph,analysis,'es');
    const english=engine.proposeLocalizedAromaticNumbering(graph,analysis,'en');
    assert.ok(spanish&&english,`${cid} candidates available`);
    for(const [proposal,expected] of [[spanish,es],[english,en]]){
      for(const [name,locant] of [[first,expected[0]],[second,expected[1]]]){
        const original=analysis.substituents.find(item=>item.name===name),projected=proposal.substituents.find(item=>item.name===name);
        assert.ok(original&&projected,`${name} exists`);
        const atom=analysis.mainChain[original.locant-1];
        assert.equal(projected.locant,locant);
        assert.equal(proposal.numberedAtoms.get(atom),locant);
      }
    }
    assert.deepEqual(graph,before,'candidate numbering must not mutate the molecular graph');
  }
});
test('suffix-bearing aromatic and alicyclic parents remain outside the candidate helper',()=>{
  for(const cid of [326,69274,7724,11419]){
    const {molecule}=moleculeFromSmiles(records.find(item=>item.cid===cid).smiles);
    assert.equal(engine.proposeLocalizedAromaticNumbering(molecule,engine.analyzeMolecule(molecule),'en'),null,`${cid}`);
  }
});
for(const [cid,esName,enName,second] of [
  [7731,'1-metil-4-metoxibenceno','1-methoxy-4-methylbenzene','metoxi'],
  [12207,'1-metil-4-yodobenceno','1-iodo-4-methylbenzene','yodo'],
])test(`integrated name and interactive locants use the same numbering for CID ${cid}`,()=>{
  const imported=moleculeFromSmiles(records.find(item=>item.cid===cid).smiles);assert.equal(imported.ok,true);
  const molecule=imported.molecule,analyses=analyzeBoth(molecule,engine),profiles=displayedProfiles(molecule,analyses,engine);
  assert.equal(profiles['2013-es'].name,esName);
  assert.equal(profiles['2013-en'].name,enName);
  for(const [key,expected] of [['2013-es',[1,4]],['2013-en',[4,1]],['2013-es',[1,4]],['2013-en',[4,1]]]){
    const profile=profiles[key],projected=resolvedProfileAnalyses(molecule,analyses,profile,engine);
    const a=projected.current,model=engine.buildActiveIupacReasoning({molecule,analyses:projected,...profile,displayedName:profile.name,
      generatedNames:Object.values(profiles).map(item=>item.name).filter(Boolean),canHighlight:true});
    assertReasoningIntegrity(model,molecule);
    const refs=buildReasoningVisualReferences({molecule,analysis:a,steps:model.steps,fragments:model.fragments,displayedName:profile.name,enabled:true});
    for(const [name,locant] of [['metil',expected[0]],[second,expected[1]]]){
      const item=a.substituents.find(item=>item.name===name);assert.ok(item);
      const atom=a.mainChain[item.locant-1];assert.equal(item.locant,locant);assert.equal(a.numberedAtoms.get(atom),locant);
      const parts=Object.entries(model.fragments).flatMap(([step,value])=>[value,...(value.additionalFragments??[])].map(part=>({step,part})));
      const written=parts.find(({part})=>part.kind==='numbering'&&part.text===String(locant));assert.ok(written,`missing locant ${locant}`);
      const target=refs.fragments[reasoningFragmentId(written.step,written.part)];assert.ok(target,`missing target ${locant}`);
      assert.ok(target.atomIds.includes(atom),`${name} locant selects its ring atom`);
      const term=key.endsWith('en')?({metil:'methyl',metoxi:'methoxy',yodo:'iodo'}[name]):name;
      const component=parts.find(({part})=>part.kind==='substituent'&&part.text===`${locant}-${term}`);
      assert.ok(component,`missing ${term} fragment`);
      const selection=refs.fragments[reasoningFragmentId(component.step,component.part)];assert.ok(selection);
      const expectedAtoms=new Set([atom,...item.atomIds]);
      assert.deepEqual(new Set(selection.atomIds),expectedAtoms,`${term} atom region`);
      const edge=([x,y])=>[x,y].sort((x,y)=>x-y).join(':');
      const expectedEdges=molecule.bonds.filter(([x,y])=>expectedAtoms.has(x)&&expectedAtoms.has(y)).map(edge).sort();
      assert.deepEqual(selection.bondIds.map(edge).sort(),expectedEdges,`${term} bond region`);
    }
    const parent=Object.entries(model.fragments).flatMap(([step,value])=>[value,...(value.additionalFragments??[])].map(part=>({step,part})))
      .find(({part})=>part.kind==='parent');assert.ok(parent);
    const parentTarget=refs.fragments[reasoningFragmentId(parent.step,parent.part)];
    assert.deepEqual(new Set(parentTarget.atomIds),new Set(a.mainChain));
  }
});

test('integrated English ring numbering remains stable after reordering and rotated geometry',()=>{
  for(const [cid,name,second] of [[7731,'1-methoxy-4-methylbenzene','metoxi'],[12207,'1-iodo-4-methylbenzene','yodo']]){
    const source=records.find(item=>item.cid===cid).smiles,{molecule}=moleculeFromSmiles(source);
    const ids=new Map(molecule.atoms.map((atom,index)=>[atom.id,3000+index*11]));
    const transformed={...molecule,atoms:[...molecule.atoms].reverse().map(atom=>({...atom,id:ids.get(atom.id),x:-atom.y,y:atom.x})),
      bonds:[...molecule.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
      rings:molecule.rings.map(ring=>({...ring,atomIds:[...ring.atomIds.slice(2),...ring.atomIds.slice(0,2)].reverse().map(id=>ids.get(id))}))};
    for(const graph of [molecule,transformed]){
      const out=moleculeToSmiles(graph);assert.equal(out.ok,true);assert.equal(structuralIdentity(out.smiles),structuralIdentity(source));
      const analyses=analyzeBoth(graph,engine),profiles=displayedProfiles(graph,analyses,engine),profile=profiles['2013-en'];
      assert.equal(profile.name,name);
      const localized=resolvedProfileAnalyses(graph,analyses,profile,engine),a=localized.current;
      assert.equal(a.substituents.find(item=>item.name===second).locant,1);
      assert.equal(a.substituents.find(item=>item.name==='metil').locant,4);
      const model=engine.buildActiveIupacReasoning({molecule:graph,analyses:localized,...profile,displayedName:name,generatedNames:[name],canHighlight:true});
      assertReasoningIntegrity(model,graph);
      const refs=buildReasoningVisualReferences({molecule:graph,analysis:a,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
      const number=Object.entries(model.fragments).flatMap(([step,v])=>[v,...(v.additionalFragments??[])].map(part=>({step,part})))
        .find(({part})=>part.kind==='numbering'&&part.text==='1');assert.ok(number);
      assert.deepEqual(refs.fragments[reasoningFragmentId(number.step,number.part)].atomIds,[a.mainChain[0]]);
    }
  }
});
