import assert from 'node:assert/strict';
import {test} from 'node:test';
import {carbohydrateCases,carbohydrateReferences,carbohydrateControls} from './fixtures/carbohydrate-derivation.mjs';
import {moleculeFromSmiles,moleculeToSmiles,inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {recognizeCarbohydrate,buildCarbohydrateGraph} from '../app/carbohydrate-structure.ts';
import {reconcileSystematicName,validatedNameTargets} from '../app/validated-name-derivation.ts';
import {deriveStructuralComponents,structuralVisualTargets,mapStructuralRegions,remapStructuralDerivation} from '../app/structural-derivation.ts';
import {purineCases} from './fixtures/purine-derivation.mjs';
import {generalizationCases} from './fixtures/generalized-derivation.mjs';
const graph=s=>{const r=moleculeFromSmiles(s);assert.equal(r.ok,true,r.error);return r.molecule;};
const sorted=xs=>[...xs].sort((a,b)=>a-b);
const edge=([a,b,o=1])=>`${Math.min(a,b)}:${Math.max(a,b)}:${o}`;
const model=(g,name)=>reconcileSystematicName(g,name);

for(const f of carbohydrateCases){
  test(`compatible graph, independent CML locants and OH identity: ${f.common}`,()=>{
    const g=graph(f.smiles),s=recognizeCarbohydrate(g);assert.ok(s);
    assert.equal(s.form,f.form);assert.equal(s.series,f.series);assert.equal(s.family?.name,f.family);
    assert.equal(s.anomer,f.anomer);assert.equal(s.complete,true);assert.equal(s.carbonylPosition,f.carbonylPosition);
    // The same gluco C3 is S in the open chain and R after furanose closure,
    // yet its Fischer OH remains left. CIP letters are not Fischer sides.
    if(f.common==='aldehydo-D-glucose'||f.common==='alpha-D-glucofuranose'){
      const c3=s.centers.find(c=>c.locant===3);assert.equal(c3.fischerSide,'left');
      assert.equal(c3.configuration,f.form==='open'?'S':'R');
    }
    assert.deepEqual(s.numbering,f.reference.numbering);assert.equal(s.ringOxygenId,f.reference.ringOxygenId);
    assert.deepEqual(sorted(s.hydroxyls.map(h=>h.oxygenId)),sorted(f.reference.hydroxylIds));
    assert.deepEqual(g.bonds.map(edge).sort(),f.reference.bonds.map(edge).sort());
    assert.equal(s.configurationalAtomId,f.reference.numbering.at(-2)[0]);
    assert.equal(inspectSmilesStructure(f.smiles).formula,f.formula);
    assert.ok(mapStructuralRegions(g,graph(f.pubchemSmiles),[]),'independent PubChem and OPSIN structures agree');
    if(s.form==='open')assert.equal(s.anomericAtomId,undefined);
    else{
      assert.equal(s.ringAtomIds.length,f.form==='furanose'?5:6);
      assert.equal(s.anomericAtomId,f.reference.numbering[f.carbonylPosition-1][0]);
      assert.ok(f.reference.hydroxylIds.includes(s.anomericHydroxylId));
      assert.ok(!f.reference.hydroxylIds.includes(s.ringOxygenId));
    }
  });
  test(`FULL literal substitutive name and exact shared targets: ${f.common}`,()=>{
    const g=graph(f.smiles),m=model(g,f.name);assert.equal(m?.status,'FULL');assert.equal(m.parentSystem,'carbohydrate');
    assert.equal(m.name,f.name);assert.equal(m.preferred,false);
    const targets=validatedNameTargets(m),allIds=new Set(g.atoms.map(a=>a.id));
    for(const c of m.components){
      assert.equal(f.name.slice(c.start,c.end),c.text);assert.deepEqual(targets[c.id].atomIds,c.atomIds);
      assert.deepEqual(targets[c.id].bondIds,c.bondIds);assert.deepEqual(targets[c.id].locants,c.numbering);
      for(const id of c.atomIds)assert.ok(allIds.has(id));
      for(const [a,b] of c.bondIds)assert.ok(g.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a));
    }
    assert.deepEqual(new Set(m.components.flatMap(c=>c.atomIds)),allIds);
    const chain=m.components.find(c=>c.id==='sugar-chain');assert.deepEqual(chain.numbering,f.reference.numbering);
    const exocyclic=f.exocyclicLocants.map(p=>f.reference.numbering[p-1][0]);
    const prefixIds=f.form==='open'?f.reference.hydroxylIds:[...exocyclic,...f.reference.hydroxylIds.filter(o=>
      f.reference.bonds.some(([a,b])=>a===o&&exocyclic.includes(b)||b===o&&exocyclic.includes(a)))];
    const prefix=m.components.find(c=>c.id==='sugar-decoration');
    assert.deepEqual(sorted(prefix.atomIds),sorted(prefixIds),'literal prefix must not absorb ring OH or carbonyl O');
    assert.deepEqual(prefix.bondIds.map(([a,b])=>edge([a,b])).sort(),f.reference.bonds.filter(([a,b])=>prefixIds.includes(a)||prefixIds.includes(b)).map(edge).sort(),'prefix includes its real attachment bonds');
    const writtenLocants=f.name.slice(f.name.indexOf(')-')+2).match(/^([\d,]+)-/)[1].split(',').map(Number);
    assert.deepEqual(prefix.numbering,writtenLocants.map(p=>[f.reference.numbering[(f.form==='open'?p:f.carbonylPosition+p-2)-1][0],p]),'written prefix locants use the right chain or heterocycle namespace');
    assert.deepEqual(sorted(m.components.find(c=>c.id==='sugar-hydroxyls').atomIds),sorted(
      f.reference.hydroxylIds.flatMap(o=>[o,g.bonds.find(([a,b])=>a===o||b===o).find(id=>id!==o)])));
    if(f.reference.ringOxygenId)assert.deepEqual(m.components.find(c=>c.id==='sugar-ring-oxygen').atomIds,[f.reference.ringOxygenId]);
    assert.deepEqual(m.components.find(c=>c.id==='sugar-reference').atomIds,[f.reference.numbering.at(-2)[0]]);
  });
  test(`retained name requires the stated form and complete configuration: ${f.common}`,()=>{
    const g=graph(f.smiles),m=model(g,f.common);
    assert.equal(m?.status??deriveStructuralComponents(g,f.common).status,f.expectedRetained);
    if(m){assert.equal(m.name,f.common);for(const c of m.components)assert.equal(f.common.slice(c.start,c.end),c.text);}
  });
  test(`IDs, storage order, rotation, reflection and stereo SMILES roundtrip: ${f.common}`,()=>{
    const g=graph(f.smiles),ids=new Map(g.atoms.map((a,i)=>[a.id,1000+(g.atoms.length-i)*17]));
    for(const reflected of [false,true]){
      const a=Math.PI*.37,changed={atoms:g.atoms.map(atom=>({...atom,id:ids.get(atom.id),
        x:(reflected?-1:1)*(atom.x*Math.cos(a)-atom.y*Math.sin(a)),y:atom.x*Math.sin(a)+atom.y*Math.cos(a),
        ...(atom.tetrahedralBondTo?{tetrahedralBondTo:ids.get(atom.tetrahedralBondTo)}:{})})).reverse(),
        bonds:g.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse()};
      const s=recognizeCarbohydrate(changed);assert.ok(s);assert.equal(s.series,f.series);assert.equal(s.anomer,f.anomer);
      assert.deepEqual(s.numbering,f.reference.numbering.map(([id,p])=>[ids.get(id),p]));
      const m=model(changed,f.name);assert.equal(m?.status,'FULL');
      for(const c of model(g,f.name).components)assert.deepEqual(sorted(m.components.find(d=>d.id===c.id).atomIds),sorted(c.atomIds.map(id=>ids.get(id))));
      const exported=moleculeToSmiles(changed);assert.equal(exported.ok,true,exported.error);
      assert.ok(mapStructuralRegions(changed,graph(exported.smiles),[]));assert.equal(model(graph(exported.smiles),f.name)?.status,'FULL');
    }
    const implicitC={...g,atoms:g.atoms.map(a=>a.element==='C'?Object.fromEntries(Object.entries(a).filter(([k])=>k!=='element')):a)};
    assert.equal(model(implicitC,f.name)?.status,'FULL');
  });
}

test('every missing or inverted chiral centre rejects the original complete name',()=>{
  for(const f of carbohydrateCases){const g=graph(f.smiles);
    const lost=graph(f.smiles.replace(/@+/g,''));
    assert.equal(inspectSmilesStructure(f.smiles.replace(/@+/g,'')).formula,f.formula,'losing stereo does not change formula');
    assert.equal(model(lost,f.name),null,'SMILES with stereo removed cannot prove the complete name');
    assert.equal(recognizeCarbohydrate(lost).complete,false);
    for(const a of g.atoms.filter(a=>a.tetrahedralParity)){
    for(const action of ['missing','inverted']){
      const changed={...g,atoms:g.atoms.map(t=>t.id===a.id?{...t,tetrahedralParity:action==='missing'?undefined:t.tetrahedralParity==='R'?'S':'R'}:t)};
      assert.equal(model(changed,f.name),null,`${f.common} ${a.id} ${action}`);
      assert.equal(model(changed,f.common),null,`${f.common} retained ${a.id} ${action}`);
      if(action==='missing')assert.equal(deriveStructuralComponents(changed,f.common).status,'PARTIAL');
    }
  }}
});
test('enantio/epimer/anomer, open/cyclic and aldose/ketose names are not interchangeable',()=>{
  const f=carbohydrateCases,g=f.map(f=>graph(f.smiles));
  for(const [a,b] of [[0,1],[0,6],[0,7],[0,8],[2,3],[4,5],[2,4],[2,10],[3,11],[0,2]]){
    assert.equal(model(g[a],f[b].name),null);assert.equal(model(g[b],f[a].name),null);
    assert.equal(model(g[a],f[b].common),null);assert.equal(model(g[b],f[a].common),null);
  }
});
test('generic names and unspecified anomers remain PARTIAL with honest structural evidence',()=>{
  for(const query of ['D-glucose','glucose','D-fructose']){
    const r=carbohydrateReferences.find(r=>r.query===query),p=r.pubchem.body.PropertyTable.Properties[0],g=graph(p.SMILES??p.IsomericSMILES);
    assert.equal(model(g,p.IUPACName),null);assert.equal(model(g,query),null);
    const partial=deriveStructuralComponents(g,p.IUPACName);assert.equal(partial.status,'PARTIAL');assert.ok(partial.carbohydrate);
    assert.equal(partial.carbohydrate.anomer,undefined);assert.equal(partial.carbohydrate.complete,false);
    assert.ok(!partial.components.some(c=>/prove (alpha|beta)/.test(c.evidence)));
    const targets=structuralVisualTargets(partial),chain=partial.components.find(c=>c.kind==='carbohydrate backbone');
    assert.deepEqual(targets[chain.id].locants,chain.numbering);
    const perm={...g,atoms:g.atoms.map(a=>({...a,id:a.id+70})),bonds:g.bonds.map(([a,b,o])=>[a+70,b+70,o])};
    const remapped=remapStructuralDerivation(partial,g,perm);assert.ok(remapped);
    assert.deepEqual(remapped.carbohydrate.numbering,partial.carbohydrate.numbering.map(([id,p])=>[id+70,p]));
  }
});
test('PubChem aldehydo-L synonym discrepancy does not identify different structural forms',()=>{
  const r=carbohydrateReferences[1],p=r.pubchem.body.PropertyTable.Properties[0],cyclic=graph(p.SMILES??p.IsomericSMILES),open=graph(r.opsin.body.smiles);
  assert.equal(mapStructuralRegions(cyclic,open,[]),null);assert.equal(model(cyclic,r.query),null);
  assert.equal(model(cyclic,p.IUPACName),null);assert.equal(model(open,r.query)?.status,'FULL');
});
test('ketose anomer rule fails closed while the complete substitutive R/S name can be proved',()=>{
  for(const r of [carbohydrateReferences[9],...carbohydrateControls.filter(r=>['alpha-D-fructofuranose','beta-L-fructofuranose'].includes(r.name))]){
    const g=graph(r.opsin?.body?.smiles??r.smiles),s=recognizeCarbohydrate(g);
    assert.equal(s.family?.name,'fructose');assert.equal(s.form,'furanose');assert.equal(s.anomer,undefined);
    assert.equal(model(g,r.query??r.name),null);
    const p=deriveStructuralComponents(g,r.query??r.name);assert.equal(p.status,'PARTIAL');assert.ok(p.components.some(c=>c.kind==='hemiketal'));
  }
  assert.equal(buildCarbohydrateGraph(6,2,5,'-++','right'),null);
});
test('acetals, glycosides, ordinary ethers, polyols and equal-formula wrong connectivities are rejected',()=>{
  const f=carbohydrateCases[2],g=graph(f.smiles),s=recognizeCarbohydrate(g);
  const glycoside=structuredClone(g);glycoside.atoms.push({id:90,element:'C',x:0,y:0});glycoside.bonds.push([s.anomericHydroxylId,90,1]);
  assert.equal(recognizeCarbohydrate(glycoside),null);assert.equal(model(glycoside,f.name),null);
  for(const smiles of ['C1CCOC1','C1CCOCC1','COCOC','OCC(O)C(O)C(O)C(O)CO','O=CC(O)(O)CC(O)C(O)CO','C1(O)OCC(O)CC1O','OCC1OC(O)C(O)C(O)C(O)C1O','CC(=O)O','CCO']){
    const bad=graph(smiles);assert.equal(recognizeCarbohydrate(bad),null,smiles);assert.equal(model(bad,f.name),null);
  }
  assert.equal(inspectSmilesStructure('O=CC(O)(O)CC(O)C(O)CO').formula,'C6H12O6');
});
test('invalid valence, charges, isotopes, edges and misplaced stereo cannot be admitted',()=>{
  const f=carbohydrateCases[2],g=graph(f.smiles);
  const mutations=[
    x=>x.atoms[0].charge=1,x=>x.atoms[0].massNumber=18,x=>x.atoms[0].isotope=18,
    x=>x.bonds.push([...x.bonds[0]]),x=>x.bonds[0][1]=999,x=>x.bonds[0][3]=true,
    x=>x.atoms[0].tetrahedralParity='R',x=>x.bonds.find(b=>b[0]===2||b[1]===2)[2]=3,
    x=>x.atoms[0].element='N',x=>x.atoms.push({...x.atoms[0]}),
  ];
  for(const mutate of mutations){const bad=structuredClone(g);mutate(bad);assert.equal(recognizeCarbohydrate(bad),null);assert.equal(model(bad,f.name),null);}
});
test('strict consumed grammar rejects missing descriptors, malformed multiplicities and locant namespaces',()=>{
  for(const f of carbohydrateCases){const g=graph(f.smiles);for(const name of [f.name+' extra',f.name.replace(/^\([^)]*\)-/,''),f.name.replace(/[RS]/,'X'),f.name.replace('pentahydroxy','tetrahydroxy').replace('tetrol','triol'),f.name.replace(/\d[RS],/,'')]){
    if(name!==f.name)assert.equal(model(g,name),null,name);
  }}
});
test('cache invalidates after stereo editing and earlier family banks retain FULL',()=>{
  const f=carbohydrateCases[2],g=graph(f.smiles);assert.equal(model(g,f.name)?.status,'FULL');
  const a=g.atoms.find(a=>a.tetrahedralParity);a.tetrahedralParity=a.tetrahedralParity==='R'?'S':'R';assert.equal(model(g,f.name),null);
  for(const f of [...generalizationCases,...purineCases])assert.equal(model(graph(f.smiles),f.name)?.status,'FULL');
  for(const f of purineCases)assert.equal(recognizeCarbohydrate(graph(f.smiles)),null);
});
