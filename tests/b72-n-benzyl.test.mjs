import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';

test('B7.2 N-benzylbenzamide independently reconstructs both rings and N–CH2–Ph',()=>{
  const p=moleculeFromSmiles('O=C(NCc1ccccc1)c1ccccc1');assert.ok(p.ok);
  for(const name of ['N-bencilbenzamida','N-benzylbenzamide']){
    const proof=reconcileSystematicName(p.molecule,name);assert.equal(proof?.status,'FULL',name);
    const branch=proof.components.find(c=>c.attachmentScope==='amide-nitrogen');
    assert.equal(branch.atomIds.length,7);assert.equal(branch.bondIds.length,8);
    assert.equal(branch.locant,'N');assert.equal(proof.parentAtomIds.filter(id=>branch.atomIds.includes(id)).length,0);
  }
});

test('B7.2 generator chooses carbonyl ring independent of input ordering',async()=>{
  const c=await loadExerciseChemistry();try {
    for(const [smiles,es,en] of [['O=C(NCc1ccccc1)c1ccccc1','N-bencilbenzamida','N-benzylbenzamide'],
      ['O=C(NCc1ccccc1)c1ccc(Cl)cc1','N-bencil-4-clorobenzamida','N-benzyl-4-chlorobenzamide']]){
      const p=moleculeFromSmiles(smiles);assert.ok(p.ok);const m=p.molecule;
      const ids=new Map(m.atoms.map((a,i)=>[a.id,700+i*19]));
      const moved={...m,atoms:[...m.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+3,y:a.x-4})),
        bonds:[...m.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
        rings:[...m.rings].reverse().map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
      for(const graph of [m,moved]){const a=analyzeBoth(graph,c.engine),profile=displayedProfiles(graph,a,c.engine);
        assert.equal(profile['2013-es'].name,es);assert.equal(profile['2013-en'].name,en);
        assert.equal(reconcileSystematicName(graph,en)?.status,'FULL');}
    }
  }finally{await c.close();}
});

test('B7.2 rejects different connectivity and substituted benzyl rings',()=>{
  for(const smiles of ['O=C(Nc1ccccc1)c1ccccc1','O=C(NCCc1ccccc1)c1ccccc1',
    'O=C(N(Cc1ccccc1)Cc1ccccc1)c1ccccc1','O=C(NCc1ccc(C)cc1)c1ccccc1',
    'O=C(Nc1ccccc1)Cc1ccccc1']) {
    const p=moleculeFromSmiles(smiles);assert.ok(p.ok);assert.equal(reconcileSystematicName(p.molecule,'N-benzylbenzamide'),null,smiles);
  }
  const p=moleculeFromSmiles('O=C(NCc1ccccc1)c1ccc(Cl)cc1');assert.ok(p.ok);
  assert.equal(reconcileSystematicName(p.molecule,'N-benzyl-4-chlorobenzamide')?.status,'FULL');
  assert.equal(reconcileSystematicName(p.molecule,'N-benzyl-3-chlorobenzamide'),null);
  const charged=structuredClone(p.molecule);charged.atoms.find(a=>a.element==='N').charge=1;
  assert.equal(reconcileSystematicName(charged,'N-benzyl-4-chlorobenzamide'),null);
  const wrongRing=moleculeFromSmiles('O=C(NCc1ccc(Cl)cc1)c1ccccc1');assert.ok(wrongRing.ok);
  assert.equal(reconcileSystematicName(wrongRing.molecule,'N-benzyl-4-chlorobenzamide'),null);
  const stereo=structuredClone(p.molecule);stereo.atoms[0].tetrahedralParity='R';
  assert.equal(reconcileSystematicName(stereo,'N-benzyl-4-chlorobenzamide'),null);
  const proof=reconcileSystematicName(p.molecule,'N-benzyl-4-chlorobenzamide');
  const branch=proof.components.find(c=>c.attachmentScope==='amide-nitrogen');
  const nitrogen=branch.numbering.find(([,n])=>n==='N')[0];
  const nc=branch.bondIds.find(([a,b])=>a===nitrogen||b===nitrogen);
  const broken=structuredClone(p.molecule);broken.bonds=broken.bonds.filter(([a,b])=>!(a===nc[0]&&b===nc[1]||a===nc[1]&&b===nc[0]));
  assert.equal(reconcileSystematicName(broken,'N-benzyl-4-chlorobenzamide'),null);
  const methylene=nc.find(id=>id!==nitrogen),join=branch.bondIds.find(([a,b])=>(a===methylene||b===methylene)&&a!==nitrogen&&b!==nitrogen);
  assert.ok(join);const disconnected=structuredClone(p.molecule);
  disconnected.bonds=disconnected.bonds.filter(([a,b])=>!(a===join[0]&&b===join[1]||a===join[1]&&b===join[0]));
  assert.equal(reconcileSystematicName(disconnected,'N-benzyl-4-chlorobenzamide'),null);
});

test('B7.2 independent proof survives atom, bond and ring permutations',()=>{
  const p=moleculeFromSmiles('O=C(NCc1ccccc1)c1ccc(Cl)cc1');assert.ok(p.ok);const m=p.molecule;
  const ids=new Map(m.atoms.map((a,i)=>[a.id,500+17*i]));
  const moved={...m,atoms:[...m.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+5,y:a.x+8})),
    bonds:[...m.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
    rings:[...m.rings].reverse().map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
  const out=moleculeToSmiles(moved);assert.ok(out.ok);const back=moleculeFromSmiles(out.smiles);assert.ok(back.ok);
  const kekule=structuredClone(m);
  for(const ring of kekule.rings){const ids=new Set(ring.atomIds);for(const bond of kekule.bonds)
    if(ids.has(bond[0])&&ids.has(bond[1]))bond[2]=bond[2]===2?1:2;}
  for(const graph of [m,moved,back.molecule,kekule])for(const name of ['N-bencil-4-clorobenzamida','N-benzyl-4-chlorobenzamide']){
    const proof=reconcileSystematicName(graph,name);assert.equal(proof?.status,'FULL',name);
    const n=proof.components.find(c=>c.attachmentScope==='amide-nitrogen');assert.equal(n.atomIds.length,7);
    assert.ok(!n.atomIds.some(id=>proof.parentAtomIds.includes(id)));
  }
});
