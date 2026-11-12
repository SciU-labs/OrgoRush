import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {structuralIdentity} from './helpers/reference-corpus.mjs';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {analyzeStructuralEquivalence} from '../app/structural-derivation.ts';

const freeze=JSON.parse(readFileSync('reports/b701/corpus-freeze.json','utf8'));
const bytes=readFileSync(freeze.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),freeze.sha256);
const records=JSON.parse(bytes).records;
const graph=id=>{const p=moleculeFromSmiles(records.find(r=>r.id===id).smiles);assert.ok(p.ok);return p.molecule;};

test('B7.0.1: adversarial controls never equate incompatible names and graphs',()=>{
  const cases=[
    ['posición','B701-01','2,4-dibromobenzaldehyde'],
    ['fluoro por cloro','B701-08','2-bromo-3-chlorobenzamide'],
    ['bromo por yodo','B701-08','3-fluoro-2-iodobenzamide'],
    ['multiplicador','B701-01','2,3,4-tribromobenzaldehyde'],
    ['locante repetido','B701-01','2,2-dibromobenzaldehyde'],
    ['fuera del anillo','B701-01','2,7-dibromobenzaldehyde'],
    ['orden de prefijos','B701-08','3-fluoro-2-bromobenzamide'],
    ['función','B701-08','2-bromo-3-fluorobenzaldehyde'],
    ['longitud alquilo','B701-07','3-chloro-2-ethylbenzamide'],
    ['regioisómero misma fórmula','B701-03','2-iodo-4-methoxybenzaldehyde'],
    // B7.2 proves the historical N-benzyl case; retain a wrong-locant control.
    ['amida N-sustituida con localizador incorrecto','B701-18','N-benzyl-4-bromo-3-fluorobenzamide'],
    ['nitro fuera de cobertura','B701-17','3-iodo-4-nitrobenzonitrile'],
    ['fuera de familia','B701-03','4-iodo-2-methoxybenzene'],
  ];
  for(const [label,id,name] of cases) assert.equal(reconcileSystematicName(graph(id),name),null,label);
  const wrongLink=moleculeFromSmiles('CCc1cc(I)ccc1C=O');assert.ok(wrongLink.ok);
  assert.equal(reconcileSystematicName(wrongLink.molecule,'4-iodo-2-methoxybenzaldehyde'),null,'alcoxi unido por carbono');
  const hetero=moleculeFromSmiles('O=Cc1ncccc1I');
  if(hetero.ok)assert.equal(reconcileSystematicName(hetero.molecule,'2-iodobenzaldehyde'),null,'heteroaromático');
  assert.notEqual(records.find(r=>r.id==='B701-03').identity,records.find(r=>r.id==='B701-04').identity);
});

test('B7.0.1: full corpus retains profiles through graph and aromatic representations',async()=>{
  const chemistry=await loadExerciseChemistry();
  try {
    for(const ref of records.slice(0,16)) {
      const source=graph(ref.id), idmap=new Map(source.atoms.map((a,i)=>[a.id,2000+i*31]));
      const reordered={...source,atoms:[...source.atoms].reverse().map(a=>({...a,id:idmap.get(a.id),x:-a.y+12,y:a.x-7})),
        bonds:[...source.bonds].reverse().map(([a,b,...rest])=>[idmap.get(b),idmap.get(a),...rest]),
        rings:source.rings?.map(r=>({...r,atomIds:[...r.atomIds].reverse().map(id=>idmap.get(id))}))};
      const kekule=structuredClone(source),ring=kekule.rings.find(r=>r.kind==='aromatic');
      const ids=new Set(ring.atomIds);for(const bond of kekule.bonds)if(ids.has(bond[0])&&ids.has(bond[1])) bond[2]=bond[2]===2?1:2;
      assert.equal(structuralIdentity(moleculeToSmiles(kekule).smiles),ref.identity,`${ref.id} Kekulé graph`);
      const exported=moleculeToSmiles(reordered);assert.ok(exported.ok);const roundtrip=moleculeFromSmiles(exported.smiles);assert.ok(roundtrip.ok);
      const baseline=displayedProfiles(source,analyzeBoth(source,chemistry.engine),chemistry.engine);
      for(const candidate of [reordered,kekule,roundtrip.molecule]) {
        const profiles=displayedProfiles(candidate,analyzeBoth(candidate,chemistry.engine),chemistry.engine);
        const equivalence=analyzeStructuralEquivalence(source,candidate);assert.ok(equivalence);
        for(const language of ['es','en','es','en']) {
          const name=profiles[`2013-${language}`].name;
          assert.equal(name,baseline[`2013-${language}`].name,`${ref.id} ${language}`);
          const proof=reconcileSystematicName(candidate,name), original=reconcileSystematicName(source,name);
          assert.equal(proof?.status,'FULL',`${ref.id} ${language}`);
          const region=(component,map)=>JSON.stringify({
            atoms:component.atomIds.map(id=>map.get(id)).sort((a,b)=>a-b),
            bonds:component.bondIds.map(([a,b])=>[map.get(a),map.get(b)].sort((x,y)=>x-y).join(':')).sort(),
            numbering:component.numbering.map(([id,n])=>`${map.get(id)}:${n}`).sort(),
          });
          const identity=new Map(candidate.atoms.map(a=>[a.id,a.id]));
          assert.ok(equivalence.mappings.some(map=>original.components.every(component=>{
            const counterpart=proof.components.find(c=>c.id===component.id);
            return counterpart && region(component,map)===region(counterpart,identity);
          })),`${ref.id} ${language}: one complete isomorphism preserves all named regions and locants`);
        }
      }
    }
  } finally {await chemistry.close();}
});
