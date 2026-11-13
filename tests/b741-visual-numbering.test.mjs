import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {buildBranchCountingGuides,buildValidatedVisualNumbering} from '../app/visual-numbering.ts';
import {buildCondensedRenderModel} from '../app/condensed-layout.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';

test('two N-ethyl guides have separate rooted counts and never change aromatic locants',()=>{
 const p=moleculeFromSmiles('CCN(CC)C(=O)c1cc(F)cc(F)c1');assert.ok(p.ok);const graph=p.molecule;
 for(const name of ['N,N-dietil-3,5-difluorobenzamida','N,N-diethyl-3,5-difluorobenzamide']){
  const proof=reconcileSystematicName(graph,name);assert.ok(proof);const parent=buildValidatedVisualNumbering(graph,proof),guides=buildBranchCountingGuides(graph,proof);
  assert.equal(guides.length,2);assert.ok(guides.every(g=>g.locants.map(([,n])=>n).join(',')==='1′,2′'));
  assert.equal(new Set(guides.flatMap(g=>g.atomIds)).size,4);assert.ok(guides.every(g=>g.atomIds.every(id=>!parent.has(id))));
  const n=proof.components.find(c=>c.attachmentScope==='amide-nitrogen').numbering[0][0];
  for(const guide of guides)assert.ok(graph.bonds.some(([a,b])=>a===n&&b===guide.atomIds[0]||b===n&&a===guide.atomIds[0]));
  const moved=structuredClone(graph);for(const a of moved.atoms){const x=a.x;a.x=-a.y;a.y=x+200;}
  assert.deepEqual(buildBranchCountingGuides(moved,proof),guides);assert.deepEqual(buildValidatedVisualNumbering(moved,proof),parent);
  const ids=new Map(graph.atoms.map((atom,index)=>[atom.id,1000+index*17]));
  const remapped={atoms:graph.atoms.toReversed().map(atom=>({...atom,id:ids.get(atom.id)})),
   bonds:graph.bonds.toReversed().map(([a,b,...rest])=>[ids.get(b),ids.get(a),...rest]),
   rings:graph.rings.map(ring=>({...ring,atomIds:ring.atomIds.toReversed().map(id=>ids.get(id))}))};
  const remappedProof=reconcileSystematicName(remapped,name);assert.ok(remappedProof);const remappedGuides=buildBranchCountingGuides(remapped,remappedProof);
  const signature=items=>items.map(g=>g.atomIds.join(',')).sort();
  assert.deepEqual(signature(remappedGuides),signature(guides.map(g=>({...g,atomIds:g.atomIds.map(id=>ids.get(id))}))));
 }
});

test('guides refuse cyclic N-benzyl regions and unavailable proofs',()=>{
 const p=moleculeFromSmiles('CN(Cc1ccccc1)C(=O)c1ccccc1'),proof=reconcileSystematicName(p.molecule,'N-benzyl-N-methylbenzamide');assert.ok(proof);
 const guides=buildBranchCountingGuides(p.molecule,proof);assert.equal(guides.length,1);assert.equal(guides[0].atomIds.length,1);
 assert.deepEqual(buildBranchCountingGuides(p.molecule,null),[]);
});

test('condensed layout consumes the same explicit atom-to-locant mapping',()=>{
 const p=moleculeFromSmiles('CCC=O'),proof=reconcileSystematicName(p.molecule,'propanal');assert.ok(proof);
 const expected=buildValidatedVisualNumbering(p.molecule,proof),layout=buildCondensedRenderModel(p.molecule,()=>0,{numbering:expected});assert.ok(layout.available);
 for(const token of layout.tokens.filter(t=>t.type==='atom'))assert.equal(token.locant,expected.get(token.atomId));
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');assert.match(page,/numbering: effectiveShowNumbering && !contextualDerivationNumbering \? visualNumbering : undefined/);
});

test('a symmetric 3,5-disubstituted parent does not assign interchangeable ring atoms unique locants',()=>{
 const p=moleculeFromSmiles('CCN(CC)C(=O)c1cc(F)cc(F)c1');assert.ok(p.ok);
 for(const name of ['N,N-dietil-3,5-difluorobenzamida','N,N-diethyl-3,5-difluorobenzamide']){
  const proof=reconcileSystematicName(p.molecule,name);assert.ok(proof);assert.equal(proof.evidence.numbering.comparison,0);
  assert.deepEqual([...buildValidatedVisualNumbering(p.molecule,proof).values()],[1]);
 }
});

test('functional monocycle reflection shows only fixed locants without changing its name or graph',()=>{
 const parsed=moleculeFromSmiles('O=C1CCC(C)CC1');assert.ok(parsed.ok);const graph=parsed.molecule;
 for(const name of ['4-metilciclohexanona','4-methylcyclohexanone']){
  const proof=reconcileSystematicName(graph,name);assert.ok(proof);assert.equal(proof.evidence.numbering.comparison,0);
  const original=JSON.stringify({graph,proof});const numbering=buildValidatedVisualNumbering(graph,proof);
  assert.deepEqual([...numbering.values()].sort((a,b)=>a-b),[1,4]);assert.equal(JSON.stringify({graph,proof}),original);
  const reasoning=buildValidatedPriorityReasoning({graph,derivation:proof,language:name.includes('methyl')?'en':'es',activeName:name});
  for(const step of reasoning.steps)for(const target of [step.target,...Object.values(step.fragmentTargets)].filter(Boolean))
   for(const [id,locant] of target.locants)if(proof.parentAtomIds.includes(id)&&typeof locant==='number')assert.equal(numbering.get(id),locant);
  const moved=structuredClone(graph);for(const a of moved.atoms){const x=a.x;a.x=-a.y;a.y=x;}
  assert.deepEqual([...buildValidatedVisualNumbering(moved,proof)],[...numbering]);
 }
 const asymmetric=moleculeFromSmiles('O=C1C(C)CCCC1');assert.ok(asymmetric.ok);
 const proof=reconcileSystematicName(asymmetric.molecule,'2-methylcyclohexanone');assert.ok(proof);
 assert.notEqual(proof.evidence.numbering.comparison,0);
 assert.equal(buildValidatedVisualNumbering(asymmetric.molecule,proof).size,6);
});

const corpus=JSON.parse(readFileSync(new URL('../reports/b741/transversal-baseline.json',import.meta.url),'utf8')).rows;
for(const row of corpus)test(`existing transversal case keeps numbering inside its verified parent: ${row.family}`,()=>{
 const p=moleculeFromSmiles(row.smiles);assert.ok(p.ok);
 for(const language of ['es','en']){
  const name=row.languages?.[language]?.name,proof=name&&reconcileSystematicName(p.molecule,name);
  if(!proof){assert.deepEqual([...buildValidatedVisualNumbering(p.molecule,proof)],[]);assert.deepEqual(buildBranchCountingGuides(p.molecule,proof),[]);continue;}
  const parent=new Set(proof.parentAtomIds),numbers=buildValidatedVisualNumbering(p.molecule,proof);
  for(const [id,locant] of numbers){assert.ok(parent.has(id),`${row.family}: ${id}`);assert.ok(typeof locant==='number'||typeof locant==='string');}
  const moved=structuredClone(p.molecule);for(const atom of moved.atoms){atom.x+=77;atom.y-=43;}
  assert.deepEqual([...buildValidatedVisualNumbering(moved,proof)],[...numbers]);
 }
});
