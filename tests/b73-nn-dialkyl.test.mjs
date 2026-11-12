import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';

test('B7.3 two amide nitrogen methyl groups require a complete independent proof',()=>{
  const p=moleculeFromSmiles('CN(C)C(=O)c1ccccc1');assert.ok(p.ok);
  for(const name of ['N,N-dimetilbenzamida','N,N-dimethylbenzamide']){
    const proof=reconcileSystematicName(p.molecule,name);assert.equal(proof?.status,'FULL',name);
    const branches=proof.components.filter(c=>c.attachmentScope==='amide-nitrogen');
    assert.equal(branches.length,2);assert.ok(branches.every(c=>c.atomIds.length===1&&c.bondIds.length===1));
    assert.notEqual(branches[0].atomIds[0],branches[1].atomIds[0]);
    assert.equal(branches[0].numbering[0][0],branches[1].numbering[0][0]);
  }
});

test('B7.3 N locants and multiplicative control target both actual branches',()=>{
  const p=moleculeFromSmiles('CN(C)C(=O)c1ccccc1');assert.ok(p.ok);
  for(const [name,language] of [['N,N-dimetilbenzamida','es'],['N,N-dimethylbenzamide','en']]){
    const proof=reconcileSystematicName(p.molecule,name),branches=proof.components.filter(c=>c.attachmentScope==='amide-nitrogen');
    const model=buildValidatedPriorityReasoning({derivation:proof,graph:p.molecule,language});
    const step=model.steps.find(s=>s.fragments?.semanticId?.startsWith('n-equivalent-'));
    assert.ok(step);const fragments=[step.fragments,...step.fragments.additionalFragments??[]];
    const n=fragments.filter(f=>f.semanticId?.startsWith('amide-n-locant:'));
    assert.equal(n.length,2);assert.deepEqual(n.map(x=>x.start),[0,2]);
    for(const f of n)assert.deepEqual(step.fragmentTargets[reasoningFragmentId(step.number,f)].atomIds,[branches[0].numbering[0][0]]);
    const f=fragments.find(x=>x.semanticId?.startsWith('amide-multiplier:'));assert.ok(f);
    const target=step.fragmentTargets[reasoningFragmentId(step.number,f)];assert.equal(target.atomIds.length,2);assert.equal(target.bondIds.length,2);
  }
});

test('B7.3 dialkyl grammar rejects constitutional and valence errors',()=>{
  const cases=[['CN(C)C(=O)c1ccccc1','N-methylbenzamide'],['CNC(=O)c1ccc(C)cc1','N,N-dimethylbenzamide'],
    ['CN(CC)C(=O)c1ccccc1','N,N-diethylbenzamide'],['CCCNC(=O)c1ccccc1','N-ethyl-N-methylbenzamide'],
    ['CN(CC)C(=O)c1ccccc1','N-methyl-N-ethylbenzamide'],
    ['CN(C)C(=O)c1ccc(C)cc1','N-ethyl-N-methylbenzamide'],
    ['NC(=O)c1cc(C)cc(C)c1','N,N-dimethylbenzamide'],
    ['CN(C)C(=O)c1ccccc1','N,N-dimethyl-4-methylbenzamide'],
    ['NC(=O)c1ccccc1','N,N-dimethylbenzamide'],['CN(C)C(=O)c1ccccc1','N,N-methylbenzamide'],
    ['CN(C)C(=O)c1ccccc1','N-dimethylbenzamide'],['CN(C)C(=O)c1ccccc1','N,N,4-trimethylbenzamide'],
    // B7.4 admits this mixed family; keep a wrong N-alkyl length as control.
    ['CN(Cc1ccccc1)C(=O)c1ccccc1','N-benzyl-N-ethylbenzamide'],
    ['CN(c1ccccc1)C(=O)c1ccccc1','N-methyl-N-phenylbenzamide'],
    ['CN(C=C)C(=O)c1ccccc1','N-ethenyl-N-methylbenzamide']];
  for(const [smiles,name] of cases){const p=moleculeFromSmiles(smiles);assert.ok(p.ok);assert.equal(reconcileSystematicName(p.molecule,name),null,name);}
  const p=moleculeFromSmiles('CN(C)C(=O)c1ccccc1');const charged=structuredClone(p.molecule);charged.atoms.find(a=>a.element==='N').charge=1;
  assert.equal(reconcileSystematicName(charged,'N,N-dimethylbenzamide'),null);
  const overvalent=structuredClone(p.molecule),nitrogen=overvalent.atoms.find(a=>a.element==='N').id;
  overvalent.atoms.push({id:9999,element:'C',x:0,y:0});overvalent.bonds.push([nitrogen,9999,1]);
  assert.equal(reconcileSystematicName(overvalent,'N,N-dimethylbenzamide'),null);
  const proof=reconcileSystematicName(p.molecule,'N,N-dimethylbenzamide');
  const missing=structuredClone(p.molecule),[a,b]=proof.components.find(c=>c.attachmentScope==='amide-nitrogen').bondIds[0];
  missing.bonds=missing.bonds.filter(([x,y])=>!(x===a&&y===b||x===b&&y===a));
  assert.equal(reconcileSystematicName(missing,'N,N-dimethylbenzamide'),null);
  const stereo=structuredClone(p.molecule);stereo.atoms[0].tetrahedralParity='R';assert.equal(reconcileSystematicName(stereo,'N,N-dimethylbenzamide'),null);
});

test('B7.3 symmetry and distinct branches survive graph permutations and roundtrip',()=>{
  for(const [smiles,es,en] of [['CN(C)C(=O)c1ccccc1','N,N-dimetilbenzamida','N,N-dimethylbenzamide'],
    ['CN(CC)C(=O)c1ccccc1','N-etil-N-metilbenzamida','N-ethyl-N-methylbenzamide'],
    ['CCCN(CC)C(=O)c1ccccc1','N-etil-N-propilbenzamida','N-ethyl-N-propylbenzamide'],
    ['CN(C)C(=O)c1ccc(Cl)cc1','4-cloro-N,N-dimetilbenzamida','4-chloro-N,N-dimethylbenzamide']]){
    const p=moleculeFromSmiles(smiles);assert.ok(p.ok);const m=p.molecule;
    const ids=new Map(m.atoms.map((a,i)=>[a.id,500+31*i]));
    const moved={...m,atoms:[...m.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+5,y:a.x+8})),
      bonds:[...m.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
      rings:m.rings.map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
    const out=moleculeToSmiles(moved);assert.ok(out.ok);const back=moleculeFromSmiles(out.smiles);assert.ok(back.ok);
    const kekule=structuredClone(m);const ring=new Set(kekule.rings[0].atomIds);for(const bond of kekule.bonds)if(ring.has(bond[0])&&ring.has(bond[1]))bond[2]=bond[2]===2?1:2;
    for(const graph of [m,moved,back.molecule,kekule])for(const name of [es,en,es]){
      const proof=reconcileSystematicName(graph,name);assert.equal(proof?.status,'FULL',name);
      const branches=proof.components.filter(c=>c.attachmentScope==='amide-nitrogen');assert.equal(branches.length,2);
      assert.ok(!branches[0].atomIds.some(id=>branches[1].atomIds.includes(id)));
    }
  }
});

test('B7.3 generated profiles preserve citation order and separate N branches',async()=>{
  const c=await loadExerciseChemistry();try{
    for(const [smiles,es,en] of [['CN(C)C(=O)c1ccccc1','N,N-dimetilbenzamida','N,N-dimethylbenzamide'],
      ['CN(CC)C(=O)c1ccccc1','N-etil-N-metilbenzamida','N-ethyl-N-methylbenzamide'],
      ['CN(C)C(=O)c1ccc(OC)cc1','N,N-dimetil-4-metoxibenzamida','4-methoxy-N,N-dimethylbenzamide']]){
      const p=moleculeFromSmiles(smiles);assert.ok(p.ok);const graph=p.molecule,ids=new Map(graph.atoms.map((a,i)=>[a.id,900+i*31]));
      const moved={...graph,atoms:[...graph.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+6,y:a.x-3})),
        bonds:[...graph.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
        rings:graph.rings.map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
      for(const m of [graph,moved]){const profiles=displayedProfiles(m,analyzeBoth(m,c.engine),c.engine);
        assert.equal(profiles['2013-es'].name,es);assert.equal(profiles['2013-en'].name,en);
        assert.equal(reconcileSystematicName(m,en)?.status,'FULL');}
    }
  }finally{await c.close();}
});
