import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {parseAdditionalSystematicFamily} from '../app/systematic-family-grammar.ts';
import {buildValidatedPriorityReasoning} from '../app/reasoning-derivation-adapter.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {resolveDerivationConsistency} from '../app/derivation-consistency.ts';

const fixture = f => JSON.parse(readFileSync(`tests/fixtures/${f}`, 'utf8')).records;
const rows=[...fixture('b61-independent-reference.json'),...fixture('b62-independent-reference.json')];
const cases=[
  ['B61-I20','3,5-dicloro-2-etoxibenzaldehído','3,5-dichloro-2-ethoxybenzaldehyde','aldehyde',3],
  ['B61-I06','3,4-difluorobenzonitrilo','3,4-difluorobenzonitrile','nitrile',2],
  ['B62-I17','4-clorobenzamida','4-chlorobenzamide','amide',1],
];
const edge = pair => pair.slice(0,2).sort((a,b)=>a-b).join(':');

for(const [id,es,en,group,count] of cases) test(`B7: ${id} independently reconstructs both active names`,()=>{
  const source=rows.find(r=>r.id===id), parsed=moleculeFromSmiles(source.smiles); assert.ok(parsed.ok);
  const graph=parsed.molecule, before=structuredClone(graph);
  for(const [language,name] of [['es',es],['en',en]]) {
    const proof=reconcileSystematicName(graph,name);
    assert.equal(proof?.status,'FULL',`${language} requires a complete independent reconstruction`);
    assert.equal(proof.preferred,false); assert.equal(proof.principalGroup,group);
    assert.equal(proof.evidence?.equivalence,'complete-graph-isomorphism');
    const parent=proof.components.find(c=>c.id==='parent'), prefixes=proof.components.filter(c=>c.role==='prefix');
    assert.equal(prefixes.reduce((n,c)=>n+c.numbering.length,0),count);
    assert.equal(parent.writtenLocants.length,count);
    if(language==='es') assert.ok(prefixes.every(c=>!c.explanationEs?.includes('numeración interna')));
    for(const c of proof.components) assert.equal(name.slice(c.start,c.end),c.text);
    for(const c of prefixes) for(const pair of c.bondIds) assert.ok(graph.bonds.some(b=>edge(b)===edge(pair)));
    const steps=buildValidatedPriorityReasoning({derivation:proof,graph,language}).steps;
    for(const step of steps) for(const fragment of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]) {
      assert.equal(name.slice(fragment.start,fragment.start+fragment.text.length),fragment.text);
    }
    const mapping=new Map(graph.atoms.map((a,i)=>[a.id,1000+i*19]));
    const permuted={...graph,atoms:[...graph.atoms].reverse().map(a=>({...a,id:mapping.get(a.id),x:-a.y,y:a.x})),
      bonds:[...graph.bonds].reverse().map(([a,b,...rest])=>[mapping.get(b),mapping.get(a),...rest]),rings:[]};
    assert.equal(reconcileSystematicName(permuted,name)?.status,'FULL');
    const exported=moleculeToSmiles(permuted);assert.ok(exported.ok); const restored=moleculeFromSmiles(exported.smiles);assert.ok(restored.ok);
    assert.equal(reconcileSystematicName(restored.molecule,name)?.status,'FULL');
  }
  assert.deepEqual(graph,before);
});

test('B7: malformed, wrongly numbered and outside-family names do not gain proof',()=>{
  const invalid=['3,3-dichloro-2-ethoxybenzaldehyde','3,5-chloro-2-ethoxybenzaldehyde',
    '2-ethoxy-3,5-dichlorobenzaldehyde','3,5-dichloro-6-ethoxybenzaldehyde',
    '3,5-dichloro-2-ethoxybenzamide','1,3,5-trimethyl-2,4-dinitrobenzene'];
  for(const name of invalid) {
    const source=rows.find(r=>r.id==='B61-I20'), parsed=moleculeFromSmiles(source.smiles);assert.ok(parsed.ok);
    assert.equal(reconcileSystematicName(parsed.molecule,name),null,name);
  }
  assert.equal(parseAdditionalSystematicFamily('1,3,5-trimethyl-2,4-dinitrobenzene'),null);
  for(const name of ['2,4,6-trifluorobenzonitrile','2-fluoro-4-chlorobenzamide',
    'N-methyl-4-chlorobenzamide','2,2-difluorobenzonitrile']) {
    const graph=moleculeFromSmiles(rows.find(r=>r.id==='B61-I06').smiles);assert.ok(graph.ok);
    assert.equal(reconcileSystematicName(graph.molecule,name),null,name);
  }
  const graph=moleculeFromSmiles(rows.find(r=>r.id==='B61-I20').smiles).molecule;
  const name='3,5-dichloro-2-ethoxybenzaldehyde';
  for(const mutate of [
    g=>{g.atoms.find(a=>a.element==='Cl').element='F'},
    g=>{g.atoms.find(a=>a.element==='Cl').charge=-1},
    g=>{g.atoms.find(a=>a.element==='O').isotope=18},
    g=>{g.atoms[0].tetrahedralParity='R'},
  ]) {const altered=structuredClone(graph);mutate(altered);assert.equal(reconcileSystematicName(altered,name),null);}
});

test('B7: other substituted parents reconstruct without compound-specific rules',()=>{
  for(const [smiles,es,en] of [
    ['O=Cc1c(Cl)cc(Br)cc1','4-bromo-2-clorobenzaldehído','4-bromo-2-chlorobenzaldehyde'],
    ['N#Cc1c(F)cc(F)cc1','2,4-difluorobenzonitrilo','2,4-difluorobenzonitrile'],
    ['NC(=O)c1c(Cl)cc(OC)cc1','2-cloro-4-metoxibenzamida','2-chloro-4-methoxybenzamide'],
  ]) {
    const parsed=moleculeFromSmiles(smiles); assert.ok(parsed.ok,smiles);
    for(const name of [es,en]) assert.equal(reconcileSystematicName(parsed.molecule,name)?.status,'FULL',name);
  }
});

test('B7: competing placements and reflected ring numbering are rejected',()=>{
  const parsed=moleculeFromSmiles(rows.find(r=>r.id==='B61-I20').smiles);assert.ok(parsed.ok);
  let accepted=0,checked=0;
  for(let first=2;first<=6;first++) for(let second=first+1;second<=6;second++)
    for(let ethoxy=2;ethoxy<=6;ethoxy++) if(ethoxy!==first && ethoxy!==second) {
      const name=`${first},${second}-dichloro-${ethoxy}-ethoxybenzaldehyde`;
      const proof=reconcileSystematicName(parsed.molecule,name);checked++;
      if(proof) {accepted++;assert.equal(name,'3,5-dichloro-2-ethoxybenzaldehyde');}
    }
  assert.equal(checked,30);assert.equal(accepted,1);
});

test('B7: the real generated profiles supply complete localized evidence',async()=>{
  const chemistry=await loadExerciseChemistry();
  try {
    for(const [id,es,en] of cases) {
      const parsed=moleculeFromSmiles(rows.find(r=>r.id===id).smiles);assert.ok(parsed.ok);
      const molecule=parsed.molecule, analyses=analyzeBoth(molecule,chemistry.engine);
      const profiles=displayedProfiles(molecule,analyses,chemistry.engine);
      for(const [language,name] of [['es',es],['en',en],['es',es]]) {
        const profile=profiles[`2013-${language}`];assert.equal(profile.name,name);
        const selected=resolveDerivationConsistency({molecule,activeName:name,activeProfile:'current',language});
        assert.equal(selected.status,'verified',`${id} ${language}`);
        assert.equal(selected.derivation?.status,'FULL');
      }
    }
    const boundary=moleculeFromSmiles(rows.find(r=>r.id==='B61-I18').smiles);assert.ok(boundary.ok);
    const boundaryProfiles=displayedProfiles(boundary.molecule,analyzeBoth(boundary.molecule,chemistry.engine),chemistry.engine);
    for(const language of ['es','en']) {
      const name=boundaryProfiles[`2013-${language}`].name;assert.ok(name);
      assert.equal(resolveDerivationConsistency({molecule:boundary.molecule,activeName:name,activeProfile:'current',language}).status,'unverified');
    }
    const ibuprofen=fixture('b50-pubchem-rings.json').find(r=>r.cid===3672);
    const imported=moleculeFromSmiles(ibuprofen.smiles);assert.ok(imported.ok);
    assert.ok(chemistry.engine.localNamerCannotSafelyName(imported.molecule,chemistry.engine.analyzeMolecule(imported.molecule)));
  } finally { await chemistry.close(); }
});
