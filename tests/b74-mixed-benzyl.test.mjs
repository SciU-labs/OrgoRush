import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';

test('B7.4 reconstructs separate N-methyl and N-benzyl bonds in both languages',()=>{
  const p=moleculeFromSmiles('CN(CC1=CC=CC=C1)C(=O)C2=CC=CC=C2');assert.ok(p.ok);
  for(const name of ['N-bencil-N-metilbenzamida','N-benzyl-N-methylbenzamide']){
    const proof=reconcileSystematicName(p.molecule,name);assert.equal(proof?.status,'FULL',name);
    const branches=proof.components.filter(c=>c.attachmentScope==='amide-nitrogen');assert.equal(branches.length,2);
    const benzyl=branches.find(c=>c.atomIds.length===7),alkyl=branches.find(c=>c.atomIds.length===1);
    assert.ok(benzyl&&alkyl);assert.equal(benzyl.bondIds.length,8);assert.equal(alkyl.bondIds.length,1);
    const nitrogen=benzyl.numbering.find(([,loc])=>loc==='N')[0];assert.equal(alkyl.numbering.find(([,loc])=>loc==='N')[0],nitrogen);
    assert.ok(benzyl.bondIds.some(([a,b])=>a===nitrogen||b===nitrogen));
    assert.ok(alkyl.bondIds.some(([a,b])=>a===nitrogen||b===nitrogen));
    assert.ok(!benzyl.atomIds.some(id=>proof.parentAtomIds.includes(id)));
  }
});

test('B7.4 rejects wrong connectivity, charges, extra branches and stereo',()=>{
  const wrong=['CCN(c1ccccc1)C(=O)c1ccccc1','CN(CCc1ccccc1)C(=O)c1ccccc1',
    'O=C(N(Cc1ccccc1)Cc1ccccc1)c1ccccc1','O=C(NCc1ccccc1)c1ccccc1',
    'CNC(=O)c1ccccc1','CN(CC)C(=O)c1ccccc1','CN(Cc1ccc(Cl)cc1)C(=O)c1ccccc1'];
  for(const smiles of wrong){const p=moleculeFromSmiles(smiles);assert.ok(p.ok);assert.equal(reconcileSystematicName(p.molecule,'N-benzyl-N-methylbenzamide'),null,smiles);}
  const dibenzyl=moleculeFromSmiles('O=C(N(Cc1ccccc1)Cc1ccccc1)c1ccccc1');assert.ok(dibenzyl.ok);
  assert.equal(reconcileSystematicName(dibenzyl.molecule,'N,N-dibenzylbenzamide'),null);
  const p=moleculeFromSmiles('CN(Cc1ccccc1)C(=O)c1ccc(Cl)cc1');assert.ok(p.ok);
  assert.equal(reconcileSystematicName(p.molecule,'N-benzyl-4-chloro-N-methylbenzamide')?.status,'FULL');
  assert.equal(reconcileSystematicName(p.molecule,'N-benzyl-3-chloro-N-methylbenzamide'),null);
  assert.equal(reconcileSystematicName(p.molecule,'4-chloro-N-methyl-N-benzylbenzamide'),null);
  const proof=reconcileSystematicName(p.molecule,'N-benzyl-4-chloro-N-methylbenzamide');
  const benzyl=proof.components.find(c=>c.attachmentScope==='amide-nitrogen'&&c.atomIds.length===7);
  const nitrogen=benzyl.numbering.find(([,n])=>n==='N')[0],nc=benzyl.bondIds.find(([a,b])=>a===nitrogen||b===nitrogen);
  const methylene=nc.find(id=>id!==nitrogen),join=benzyl.bondIds.find(([a,b])=>(a===methylene||b===methylene)&&a!==nitrogen&&b!==nitrogen);
  for(const bond of [nc,join]){const broken=structuredClone(p.molecule);broken.bonds=broken.bonds.filter(([a,b])=>!(a===bond[0]&&b===bond[1]||a===bond[1]&&b===bond[0]));assert.equal(reconcileSystematicName(broken,'N-benzyl-4-chloro-N-methylbenzamide'),null);}
  const charged=structuredClone(p.molecule);charged.atoms.find(a=>a.id===nitrogen).charge=1;assert.equal(reconcileSystematicName(charged,'N-benzyl-4-chloro-N-methylbenzamide'),null);
  const over=structuredClone(p.molecule);over.atoms.push({id:9999,element:'C',x:0,y:0});over.bonds.push([nitrogen,9999,1]);assert.equal(reconcileSystematicName(over,'N-benzyl-4-chloro-N-methylbenzamide'),null);
  const stereo=structuredClone(p.molecule);stereo.atoms[0].tetrahedralParity='R';assert.equal(reconcileSystematicName(stereo,'N-benzyl-4-chloro-N-methylbenzamide'),null);
});

test('B7.4 visual regions distinguish two branches and their shared nitrogen',()=>{
  const p=moleculeFromSmiles('CN(Cc1ccccc1)C(=O)c1ccccc1');assert.ok(p.ok);
  for(const [name,language] of [['N-bencil-N-metilbenzamida','es'],['N-benzyl-N-methylbenzamide','en']]){
    const proof=reconcileSystematicName(p.molecule,name),branches=proof.components.filter(c=>c.attachmentScope==='amide-nitrogen');
    const model=buildValidatedPriorityReasoning({derivation:proof,graph:p.molecule,language});
    const step=model.steps.find(s=>branches.every(b=>s.componentIds.includes(b.id)));assert.ok(step);
    const fragments=[step.fragments,...step.fragments.additionalFragments??[]],locants=fragments.filter(f=>f.semanticId?.startsWith('amide-n-locant:'));
    assert.equal(locants.length,2);
    const nitrogen=branches[0].numbering[0][0];for(const f of locants)assert.deepEqual(step.fragmentTargets[reasoningFragmentId(step.number,f)].atomIds,[nitrogen]);
    for(const b of branches){const f=fragments.find(x=>x.semanticId===b.id),target=step.fragmentTargets[reasoningFragmentId(step.number,f)];assert.deepEqual(target.atomIds,b.atomIds);assert.deepEqual(target.bondIds,b.bondIds);}
  }
});

test('B7.4 proofs survive reversed rings, bond directions, Kekulé and roundtrip',()=>{
  for(const [smiles,es,en] of [['CN(Cc1ccccc1)C(=O)c1ccccc1','N-bencil-N-metilbenzamida','N-benzyl-N-methylbenzamide'],
    ['CCN(Cc1ccccc1)C(=O)c1ccc(F)cc1','N-bencil-N-etil-4-fluorobenzamida','N-benzyl-N-ethyl-4-fluorobenzamide']]){
    const p=moleculeFromSmiles(smiles);assert.ok(p.ok);const m=p.molecule,ids=new Map(m.atoms.map((a,i)=>[a.id,700+i*19]));
    const moved={...m,atoms:[...m.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+5,y:a.x-8})),
      bonds:[...m.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
      rings:[...m.rings].reverse().map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
    const out=moleculeToSmiles(moved);assert.ok(out.ok);const back=moleculeFromSmiles(out.smiles);assert.ok(back.ok);
    const kekule=structuredClone(m);for(const ring of kekule.rings){const set=new Set(ring.atomIds);for(const bond of kekule.bonds)if(set.has(bond[0])&&set.has(bond[1]))bond[2]=bond[2]===2?1:2;}
    for(const graph of [m,moved,back.molecule,kekule])for(const name of [es,en,es]){const proof=reconcileSystematicName(graph,name);assert.equal(proof?.status,'FULL',name);
      const branches=proof.components.filter(c=>c.attachmentScope==='amide-nitrogen');assert.deepEqual(branches.map(c=>c.atomIds.length).sort((a,b)=>a-b),[name.includes('N-etil')||name.includes('N-ethyl')?2:1,7]);
      assert.ok(!branches[0].atomIds.some(id=>branches[1].atomIds.includes(id)));}
  }
});

test('B7.4 generator retains graph-derived names under atom and branch reordering',async()=>{
  const c=await loadExerciseChemistry();try{for(const [smiles,es,en] of [['CN(Cc1ccccc1)C(=O)c1ccccc1','N-bencil-N-metilbenzamida','N-benzyl-N-methylbenzamide'],
    ['CCN(Cc1ccccc1)C(=O)c1ccc(F)cc1','N-bencil-N-etil-4-fluorobenzamida','N-benzyl-N-ethyl-4-fluorobenzamide']]){
    const p=moleculeFromSmiles(smiles);assert.ok(p.ok);const m=p.molecule,ids=new Map(m.atoms.map((a,i)=>[a.id,800+i*31]));
    const moved={...m,atoms:[...m.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+6,y:a.x-3})),bonds:[...m.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),rings:[...m.rings].reverse().map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
    for(const graph of [m,moved]){const profiles=displayedProfiles(graph,analyzeBoth(graph,c.engine),c.engine);assert.equal(profiles['2013-es'].name,es);assert.equal(profiles['2013-en'].name,en);}
  }
  // Equal-formula N-aryl is not this family. Its former incomplete local
  // name omitted phenyl and interpreted as a different structure in OPSIN.
  const aryl=moleculeFromSmiles('CCN(c1ccccc1)C(=O)c1ccccc1');assert.ok(aryl.ok);
  const profiles=displayedProfiles(aryl.molecule,analyzeBoth(aryl.molecule,c.engine),c.engine);
  assert.equal(profiles['2013-es'].name,null);assert.equal(profiles['2013-en'].name,null);
  const hydroxyl=moleculeFromSmiles('O=C(N(O)Cc1ccccc1)c1ccccc1');assert.ok(hydroxyl.ok);
  const outside=displayedProfiles(hydroxyl.molecule,analyzeBoth(hydroxyl.molecule,c.engine),c.engine);
  assert.equal(outside['2013-es'].name,null);assert.equal(outside['2013-en'].name,null);
  }finally{await c.close();}
});
