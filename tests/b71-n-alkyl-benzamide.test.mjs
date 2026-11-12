import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
const ref=JSON.parse(readFileSync('tests/fixtures/b61-independent-reference.json','utf8')).records.find(r=>r.id==='B61-I04');
test('B7.1: N-ethyl and ring methyl require independently reconstructed FULL',()=>{
  const parsed=moleculeFromSmiles(ref.smiles);assert.ok(parsed.ok);
  for(const name of ['N-etil-4-metilbenzamida','N-ethyl-4-methylbenzamide']) {
    const proof=reconcileSystematicName(parsed.molecule,name);
    assert.equal(proof?.status,'FULL',name);
    assert.equal(proof.principalGroup,'amide');assert.equal(proof.preferred,false);
    const n=proof.components.find(c=>c.attachmentScope==='amide-nitrogen');
    const ring=proof.components.find(c=>c.attachmentScope==='ring');
    const suffix=proof.components.find(c=>c.id==='suffix');
    assert.equal(n.locant,'N'); assert.equal(n.atomIds.length,2);assert.equal(n.bondIds.length,2);
    const nitrogen=n.numbering.find(([,x])=>x==='N')[0];
    assert.ok(suffix.atomIds.includes(nitrogen));assert.ok(!proof.parentAtomIds.includes(nitrogen));
    assert.ok(n.bondIds.some(([a,b])=>a===nitrogen||b===nitrogen));
    assert.equal(suffix.atomIds.length,3);assert.equal(suffix.bondIds.length,2);
    assert.equal(ring.locant,4);assert.equal(ring.atomIds.length,2);assert.equal(ring.bondIds.length,1);
    const model=buildValidatedPriorityReasoning({derivation:proof,graph:parsed.molecule,language:name.includes('benzamida')?'es':'en'});
    const step=model.steps.find(s=>s.componentIds.includes(n.id));
    const control=[step.fragments,...step.fragments.additionalFragments??[]].find(f=>f.semanticId?.startsWith('amide-n-locant'));
    assert.equal(name.slice(control.start,control.start+control.text.length),'N');
    assert.deepEqual(step.fragmentTargets[reasoningFragmentId(step.number,control)].atomIds,[nitrogen]);
  }
});

test('B7.1: finite N-alkyl grammar does not confuse N and ring positions',()=>{
  const positives=[
    ['CNC(=O)c1ccccc1','N-methylbenzamide'],
    ['CCNC(=O)c1ccccc1','N-ethylbenzamide'],
    ['CCCNC(=O)c1ccccc1','N-propylbenzamide'],
    ['CNC(=O)c1ccc(Cl)cc1','4-chloro-N-methylbenzamide'],
    ['CCNC(=O)c1c(Cl)cc(OC)cc1','2-chloro-N-ethyl-4-methoxybenzamide'],
  ];
  for(const [smiles,name] of positives){const p=moleculeFromSmiles(smiles);assert.ok(p.ok);assert.equal(reconcileSystematicName(p.molecule,name)?.status,'FULL',name);}
  const cases=[
    ['CNC(=O)c1ccccc1','4-methylbenzamide'],
    ['CCNC(=O)c1ccccc1','4-ethylbenzamide'],
    [ref.smiles,'4-ethyl-N-methylbenzamide'],
    ['CN(C)C(=O)c1ccccc1','N,N-dimethylbenzamide'],
    ['O=C(Nc1ccccc1)c1ccccc1','N-phenylbenzamide'],
    ['C=CCNC(=O)c1ccccc1','N-(prop-2-en-1-yl)benzamide'],
    [ref.smiles,'N-propyl-4-methylbenzamide'],
    [ref.smiles,'N-ethyl-3-methylbenzamide'],
    [ref.smiles,'4-methyl-N-ethylbenzamide'],
  ];
  for(const [smiles,name] of cases){const p=moleculeFromSmiles(smiles);assert.ok(p.ok);assert.equal(reconcileSystematicName(p.molecule,name),null,name);}
  const p=moleculeFromSmiles(ref.smiles);assert.ok(p.ok);
  const charged=structuredClone(p.molecule);charged.atoms.find(a=>a.element==='N').charge=1;
  assert.equal(reconcileSystematicName(charged,'N-ethyl-4-methylbenzamide'),null,'charged nitrogen');
  const stereo=structuredClone(p.molecule);stereo.atoms[0].tetrahedralParity='R';
  assert.equal(reconcileSystematicName(stereo,'N-ethyl-4-methylbenzamide'),null,'explicit unsupported stereo');
  const stronger=moleculeFromSmiles('CCNC(=O)c1ccc(C(=O)O)cc1');assert.ok(stronger.ok);
  assert.equal(reconcileSystematicName(stronger.molecule,'N-ethyl-4-methylbenzamide'),null,'additional senior function');
});

test('B7.1: N and ring scopes survive permutations and aromatic representations',()=>{
  const parsed=moleculeFromSmiles(ref.smiles);assert.ok(parsed.ok);const graph=parsed.molecule;
  const map=new Map(graph.atoms.map((a,i)=>[a.id,1100+i*17]));
  const changed={...graph,atoms:[...graph.atoms].reverse().map(a=>({...a,id:map.get(a.id),x:-a.y+5,y:a.x-3})),
    bonds:[...graph.bonds].reverse().map(([a,b,...rest])=>[map.get(b),map.get(a),...rest]),
    rings:graph.rings.map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>map.get(id))}))};
  const alt=structuredClone(graph), ring=new Set(alt.rings[0].atomIds);
  for(const bond of alt.bonds)if(ring.has(bond[0])&&ring.has(bond[1]))bond[2]=bond[2]===2?1:2;
  const exported=moleculeToSmiles(changed);assert.ok(exported.ok);const restored=moleculeFromSmiles(exported.smiles);assert.ok(restored.ok);
  for(const molecule of [graph,changed,alt,restored.molecule]) for(const name of ['N-etil-4-metilbenzamida','N-ethyl-4-methylbenzamide','N-etil-4-metilbenzamida']) {
    const proof=reconcileSystematicName(molecule,name);assert.equal(proof?.status,'FULL');
    const n=proof.components.find(c=>c.attachmentScope==='amide-nitrogen'), r=proof.components.find(c=>c.attachmentScope==='ring');
    const nitrogen=n.numbering.find(([,x])=>x==='N')[0], ring4=proof.components.find(c=>c.id==='parent').numbering.find(([,x])=>x===4)[0];
    assert.notEqual(nitrogen,ring4); assert.ok(n.bondIds.some(([a,b])=>a===nitrogen||b===nitrogen));
    assert.ok(r.atomIds.includes(ring4));
  }
});

test('B7.1: admitted frozen corpus retains N and ring scope under permutation',()=>{
  const corpus=JSON.parse(readFileSync('tests/fixtures/b71-independent-reference.json','utf8'));
  const measured=JSON.parse(readFileSync('reports/b71/post-final.json','utf8'));
  for(const record of corpus.records) {
    const row=measured.rows.find(r=>r.id===record.id);if(row.profiles?.en?.status!=='FULL')continue;
    const p=moleculeFromSmiles(record.smiles);assert.ok(p.ok);const original=p.molecule;
    const ids=new Map(original.atoms.map((a,i)=>[a.id,2000+i*13]));
    const changed={...original,atoms:[...original.atoms].reverse().map(a=>({...a,id:ids.get(a.id),x:-a.y+5,y:a.x-3})),
      bonds:[...original.bonds].reverse().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
      rings:original.rings.map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>ids.get(id))}))};
    const smiles=moleculeToSmiles(changed);assert.ok(smiles.ok);const back=moleculeFromSmiles(smiles.smiles);assert.ok(back.ok);
    for(const molecule of [original,changed,back.molecule]) for(const language of ['es','en','es']) {
      const proof=reconcileSystematicName(molecule,row.profiles[language].name);assert.equal(proof?.status,'FULL',record.id);
      const n=proof.components.find(c=>c.attachmentScope==='amide-nitrogen');assert.ok(n,record.id);
      const nitrogen=n.numbering.find(([,locant])=>locant==='N')[0];
      assert.ok(n.bondIds.some(([a,b])=>a===nitrogen||b===nitrogen));
      for(const ring of proof.components.filter(c=>c.attachmentScope==='ring'))assert.ok(!ring.atomIds.includes(nitrogen));
    }
  }
});
