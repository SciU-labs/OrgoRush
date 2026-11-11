import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SmilesParser } from 'openchemlib';
import { moleculeFromSmiles, moleculeToSmiles, inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { analyzeStructuralEquivalence } from '../app/structural-derivation.ts';
import { buildValidatedPriorityReasoning } from '../app/reasoning-derivation-adapter.ts';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { analyzeBoth, displayedProfiles, resolvedProfileAnalyses } from '../scripts/naming-audit/evaluate.mjs';
import { buildReasoningVisualReferences } from '../app/reasoning-visual-targets.ts';
import { sameComposition } from '../scripts/b61-evidence.mjs';
import { mutations } from './fixtures/b61-mutations.mjs';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const corpus=read('./fixtures/b61-independent-reference.json'),freeze=read('../reports/b61/corpus-freeze.json');
const sourcePool=read('../reports/b61/reference-pool.json'),blind=read('../reports/b61/blind-reviewed.json');
const parse=smiles=>{const result=moleculeFromSmiles(smiles);assert.ok(result.ok,result.error);return result.molecule};
let chemistry;before(async()=>{chemistry=await loadExerciseChemistry()});after(async()=>{await chemistry?.close()});

test('B6.1 references are frozen before the blind run and trace to independent PubChem receipts',()=>{
  const body=readFileSync(new URL('./fixtures/b61-independent-reference.json',import.meta.url));
  assert.equal(createHash('sha256').update(body).digest('hex'),freeze.sha256);
  assert.ok(Date.parse(corpus.frozenAt)<Date.parse(blind.executedAt));
  assert.equal(corpus.records.length,20);assert.equal(corpus.selectionBeforeGenerator,true);
  assert.equal(new Set(corpus.records.map(r=>r.novelty.constitutionKey)).size,20);
  for(const record of corpus.records) {
    const receipt=sourcePool.receipts.find(r=>r.sha256===record.receiptSha256);
    assert.ok(receipt);assert.equal(receipt.status,200);
    assert.equal(createHash('sha256').update(receipt.body).digest('hex'),receipt.sha256);
    const external=JSON.parse(receipt.body).PropertyTable.Properties.find(r=>r.CID===record.cid);
    assert.equal(external.SMILES,record.smiles);assert.equal(external.IUPACName,record.referenceName);
    assert.equal(external.MolecularFormula,record.formula);assert.equal(record.referenceSpanish,null);
    // Read source composition independently of editable-canvas admission. A
    // bridged source may be valid in OCL and deliberately rejected by the UI.
    const sourceFormula=new SmilesParser().parseMolecule(record.smiles).getMolecularFormula().formula;
    assert.ok(sameComposition(sourceFormula,record.formula));
  }
});

for(const item of mutations)test(`B6.1 mutation ${item.id}: ${item.axis}, ${item.kind}`,()=>{
  const source=corpus.records.find(r=>r.cid===item.sourceCid),graph=parse(source.smiles);
  assert.equal(!!reconcileSystematicName(graph,item.name),item.accept,item.name);
  if(item.namedStructure) {
    const identical=structuralIdentity(item.namedStructure)===structuralIdentity(source.smiles);
    assert.equal(identical,item.kind==='same-connectivity-nonminimal-numbering');
    if(item.id==='B61-M05'||item.id==='B61-M15') {
      const other=mutations.find(m=>m.id===(item.id==='B61-M05'?'B61-M15':'B61-M05'));
      assert.equal(reconcileSystematicName(parse(item.namedStructure),item.name)?.status,'FULL');
      assert.equal(reconcileSystematicName(parse(item.namedStructure),other.name),null,
        'moving C=C between ring positions 2 and 3 must fail even when formula and function are unchanged');
    }
  }
});

test('B6.1 1080 aromatic labelings exercise numbering independently of the production rotation algorithm',()=>{
  const groups=[['F','fluoro','fluoro'],['Cl','chloro','cloro'],['Br','bromo','bromo'],['I','iodo','yodo'],
    ['[N+](=O)[O-]','nitro','nitro'],['OC','methoxy','metoxi']];
  let checks=0;
  for(const [smilesPart,en,es] of groups)for(const distance of [1,2,3]) {
    const patterns={1:`Cc1c(${smilesPart})cccc1`,2:`Cc1cc(${smilesPart})ccc1`,3:`Cc1ccc(${smilesPart})cc1`};
    const graph=parse(patterns[distance]);
    for(const language of ['en','es']) {
      const terms=[language==='en'?'methyl':'metil',language==='en'?en:es].sort((a,b)=>a.localeCompare(b,language));
      for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a!==b) {
        const name=`${a}-${terms[0]}-${b}-${terms[1]}${language==='en'?'benzene':'benceno'}`;
        // Closed-form expected result for two different substituents: the
        // first cited one starts at 1, the other at 1 + shortest ring distance.
        // This does not call the production numbering helper.
        assert.equal(!!reconcileSystematicName(graph,name),a===1&&b===distance+1,name);checks++;
      }
    }
  }
  assert.equal(checks,1080);
});

for(const record of corpus.records)test(`B6.1 representation and language invariance ${record.id}`,()=>{
  const imported=moleculeFromSmiles(record.smiles);
  if(!imported.ok) {
    assert.ok(record.stereo.definedAtoms>0);assert.match(imported.error,/puentead|policíclic/);return;
  }
  const graph=imported.molecule,map=new Map(graph.atoms.map((a,i)=>[a.id,1800-i*23]));
  const transformed={...graph,atoms:graph.atoms.toReversed().map(a=>({...a,id:map.get(a.id),x:-a.y+31,y:a.x-17})),
    bonds:graph.bonds.toReversed().map(([a,b,...rest])=>[map.get(b),map.get(a),...rest]),
    rings:graph.rings?.map(r=>({...r,atomIds:r.atomIds.toReversed().map(id=>map.get(id))}))};
  const expected=displayedProfiles(graph,analyzeBoth(graph,chemistry.engine),chemistry.engine);
  const actual=displayedProfiles(transformed,analyzeBoth(transformed,chemistry.engine),chemistry.engine);
  const targetKey=target=>JSON.stringify({atoms:[...target.atomIds].sort((a,b)=>a-b),
    bonds:target.bondIds.map(pair=>pair.toSorted((a,b)=>a-b).join(':')).sort(),
    locants:target.locants.toSorted(([a],[b])=>a-b)});
  for(const language of ['es','en','es']) {
    const key=`2013-${language}`;assert.equal(actual[key].name,expected[key].name);
    const name=actual[key].name;if(!name)continue;
    const proof=reconcileSystematicName(transformed,name),reference=reconcileSystematicName(graph,name);
    assert.equal(proof?.status,reference?.status);
    if(proof) {
      assert.equal(proof.preferred,false);assert.equal(proof.name,name);
      const model=buildValidatedPriorityReasoning({derivation:proof,graph:transformed,language});
      for(const component of proof.components)assert.equal(name.slice(component.start,component.end),component.text);
      for(const step of model.steps)for(const target of Object.values(step.fragmentTargets))
        assert.ok(target.atomIds.every(id=>transformed.atoms.some(a=>a.id===id)));
    } else {
      // Exercise the actual local PARTIAL projection as well as FULL. These
      // are UI consistency checks, not an independent nomenclature oracle.
      const references=(molecule,profile)=>{
        const profiles=displayedProfiles(molecule,analyzeBoth(molecule,chemistry.engine),chemistry.engine);
        const analyses=resolvedProfileAnalyses(molecule,analyzeBoth(molecule,chemistry.engine),profile,chemistry.engine);
        const model=chemistry.engine.buildActiveIupacReasoning({molecule,analyses,...profile,displayedName:profile.name,
          generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
        return buildReasoningVisualReferences({molecule,analysis:model.analysis,steps:model.steps,fragments:model.fragments,
          displayedName:profile.name,enabled:true});
      };
      const before=references(graph,expected[key]),after=references(transformed,actual[key]);
      for(const collection of ['steps','fragments'])for(const [id,target] of Object.entries(after[collection])) {
        assert.ok(target.atomIds.every(id=>transformed.atoms.some(a=>a.id===id)));
        assert.ok(target.bondIds.every(([a,b])=>transformed.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
        assert.ok(before[collection][id],`${collection}:${id}`);
      }
      const matches=correspondence=>['steps','fragments'].every(collection=>{
        if(Object.keys(before[collection]).length!==Object.keys(after[collection]).length)return false;
        return Object.entries(before[collection]).every(([id,old])=>{
          const target=after[collection][id];if(!target)return false;
          const mapped={...old,atomIds:old.atomIds.map(id=>correspondence.get(id)),
            bondIds:old.bondIds.map(([a,b])=>[correspondence.get(a),correspondence.get(b)]),
            locants:old.locants.map(([id,n])=>[correspondence.get(id),n])};
          return targetKey(target)===targetKey(mapped);
        });
      });
      // Repeated identical substituents can reverse the ring orientation under
      // a true graph automorphism. Require ONE full-graph correspondence for
      // every target and locant jointly, rather than imposing arbitrary IDs
      // or choosing a different equivalence independently for each fragment.
      assert.ok(matches(map)||analyzeStructuralEquivalence(graph,transformed)?.mappings.some(matches),
        'all partial targets and locants retain one chemically equivalent full-graph correspondence');
    }
  }
  const exported=moleculeToSmiles(transformed);assert.ok(exported.ok,exported.error);
  assert.equal(structuralIdentity(exported.smiles),structuralIdentity(record.smiles),'including explicit stereo when import is admitted');
  const round=parse(exported.smiles),roundNames=displayedProfiles(round,analyzeBoth(round,chemistry.engine),chemistry.engine);
  for(const language of ['es','en'])assert.equal(roundNames[`2013-${language}`].name,expected[`2013-${language}`].name);
});

test('B6.1 carbonyl order, formal charge, functional placement and halogen edits cannot reuse FULL',()=>{
  const ketone=parse(corpus.records.find(r=>r.cid===79506).smiles),proof=reconcileSystematicName(ketone,'4-ethylcyclohexanone');
  assert.ok(proof);const edited=structuredClone(ketone),oxygen=edited.atoms.find(a=>a.element==='O');
  edited.bonds.find(([a,b])=>a===oxygen.id||b===oxygen.id)[2]=1;
  assert.equal(reconcileSystematicName(edited,'4-ethylcyclohexanone'),null);
  assert.ok(reconcileSystematicName(edited,'4-ethylcyclohexanol'));
  const amide=parse(corpus.records.find(r=>r.cid===7020622).smiles);
  assert.ok(reconcileSystematicName(amide,'4-ethylbenzamide'));
  amide.atoms.find(a=>a.element==='N').charge=1;
  assert.equal(reconcileSystematicName(amide,'4-ethylbenzamide'),null,'cache invalidated after an in-place charge edit');
  const a=parse('CCc1ccc(C(=O)N)cc1'),b=parse('CCNC(=O)c1ccccc1');
  assert.ok(sameComposition(inspectSmilesStructure('CCc1ccc(C(=O)N)cc1').formula,inspectSmilesStructure('CCNC(=O)c1ccccc1').formula));
  assert.equal(analyzeStructuralEquivalence(a,b),null,'N-ethyl and ring-ethyl have identical composition and different connectivity');
  assert.equal(analyzeStructuralEquivalence(parse('N#Cc1ccc(F)cc1'),parse('N#Cc1ccc(Cl)cc1')),null);
});
