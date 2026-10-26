import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VALIDATION_CASES,PROFILES,TARGETS} from './fixtures/orgorush-validation-014.mjs';
import {identity,witness,receipt,cmlGraph,graphMapping,rawMolecule,classify,verifyMatrix,assess} from '../scripts/validation-014-reference.mjs';

test('014 has exactly 150 valid distinct constitutions and eight exact quotas',()=>{
 assert.equal(VALIDATION_CASES.length,150);assert.equal(new Set(VALIDATION_CASES.map(r=>identity(r.smiles))).size,150);
 for(const [c,n]of Object.entries(TARGETS))assert.equal(VALIDATION_CASES.filter(r=>r.category===c).length,n);
 for(const r of VALIDATION_CASES){const g=cmlGraph(JSON.parse(receipt(r.referenceEnglish).body).cml);assert.ok(g.valence.every(a=>a.valid),r.id);assert.equal(witness(r.referenceEnglish,r.smiles).status,'PASS');}
});
test('014 retains actual CML multiple bonds and normalizes aromatic resonance',()=>{
 const r=VALIDATION_CASES.find(r=>r.category==='unsaturated'),g=cmlGraph(JSON.parse(receipt(r.referenceEnglish).body).cml);
 const graph={atoms:g.atoms,bonds:g.kekuleBonds};assert.equal(graphMapping(g,graph).status,'PASS');
 const b=graph.bonds.find(b=>b[2]>1),wrong=structuredClone(graph);wrong.bonds.find(e=>e[0]===b[0]&&e[1]===b[1])[2]=1;
 assert.equal(graphMapping(g,wrong).status,'FAIL-STRUCTURE');
 const a=VALIDATION_CASES.find(r=>r.referenceEnglish==='quinolin-6-ol'),ar=cmlGraph(JSON.parse(receipt(a.referenceEnglish).body).cml);
 assert.ok(ar.bonds.some(b=>b[2]===1.5));assert.equal(graphMapping(ar,{atoms:ar.atoms,bonds:ar.kekuleBonds}).status,'PASS');
 assert.equal(rawMolecule(graph).m.getAllBonds(),graph.bonds.length);
});
test('014 independent parser rejects a wrong molecule, without using preference as identity',()=>{
 const r=VALIDATION_CASES.find(r=>r.id==='V014-125');
 assert.equal(witness('4-hydroxy-3-methylheptan-2-one',r.smiles).status,'FAIL-STRUCTURE');
 assert.equal(witness('no cached scientific reference',r.smiles).status,'PENDING-REFERENCE');
 assert.equal(classify([],true,false),'PENDING-REFERENCE');assert.equal(classify([],false,false),'UNSUPPORTED');
 assert.equal(classify([{classification:'FAIL-REASONING'},{classification:'FAIL-STRUCTURE'}],true,true),'FAIL-STRUCTURE');
});
test('014 matrix contains 600 base observations and no unbacked PASS',async()=>{
 const m=JSON.parse(readFileSync(new URL('../reports/orgorush-validation-014.matrix.json',import.meta.url),'utf8'));
 assert.deepEqual(await verifyMatrix(m),{structures:150,observations:600,historyIntegrity:true,sourceTreeChecked:false});
 const r=m.records.find(r=>r.id==='V014-125');assert.equal(r.profiles['2013-es'].classification,'FAIL-STRUCTURE');
 const counterfeit=structuredClone(m);const v=counterfeit.records[0].profiles[PROFILES[0]];v.classification='PASS';v.evidence.name.status='PENDING-REFERENCE';
 await assert.rejects(()=>verifyMatrix(counterfeit));
});
test('014 adjudication is deterministic and detects injected false functional targets',()=>{
 const raw=JSON.parse(readFileSync(new URL('../reports/orgorush-validation-014.matrix.json',import.meta.url),'utf8')).records.find(r=>r.id==='V014-125');
 const row=VALIDATION_CASES.find(r=>r.id===raw.id),g=cmlGraph(JSON.parse(receipt(row.referenceEnglish).body).cml);
 const v={graph:raw.replayGraph,profiles:Object.fromEntries(PROFILES.map(p=>[p,{name:raw.profiles[p].name,analysis:raw.profiles[p].analysis,reasoning:raw.profiles[p].reasoning.model,reasoningIntegrity:raw.profiles[p].evidence.reasoningIntegrity}]))};
 assert.deepEqual(assess(row,'2013-es',v,g),assess(row,'2013-es',v,g));
 const wrong=structuredClone(v);wrong.profiles['2013-es'].analysis.functionalGroups[0].atomIds=[wrong.graph.atoms.find(a=>a.element==='C').id];
 // Change the asserted kind as well: a nitrile cannot target a saturated carbon.
 wrong.profiles['2013-es'].analysis.functionalGroups[0].kind='nitrile';
 assert.ok(assess(row,'2013-es',wrong,g).issues.some(i=>i.code==='FUNCTION-TARGET'));
 const wrongBond=structuredClone(v),chain=wrongBond.profiles['2013-es'].analysis.mainChain;
 wrongBond.profiles['2013-es'].reasoning.links.push({kind:'unsaturation',bondType:'double',locant:1,atomIds:chain.slice(0,2),text:'en'});
 assert.ok(assess(row,'2013-es',wrongBond,g).issues.some(i=>i.code==='BOND-HIGHLIGHT'));
});
