import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {presentValidatedSystematicName,reconcileSystematicName} from '../app/validated-name-derivation.ts';

const references=[
  {smiles:'C1CCC2CC3CCCCC3CC2C1',topology:'linear',en:'tetradecahydroanthracene',es:'tetradecahidroantraceno'},
  {smiles:'C1CC[C@H]2C[C@H]3CCCC[C@H]3C[C@H]2C1',topology:'linear',
    en:'(4aR,8aR,9aS,10aS)-tetradecahydroanthracene',es:'(4aR,8aR,9aS,10aS)-tetradecahidroantraceno'},
  {smiles:'C1CCC2C(C1)CCC3C2CCCC3',topology:'angular',en:'tetradecahydrophenanthrene',es:'tetradecahidrofenantreno'},
  {smiles:'C1CC[C@@H]2[C@H](C1)CC[C@H]3[C@@H]2CCCC3',topology:'angular',
    en:'(4aR,4bS,8aS,10aR)-tetradecahydrophenanthrene',es:'(4aR,4bS,8aS,10aR)-tetradecahidrofenantreno'},
  {smiles:'C1CC[C@@H]2[C@H](C1)CC[C@@H]3[C@H]2CCCC3',topology:'angular',
    en:'(4aR,4bR,8aR,10aR)-tetradecahydrophenanthrene',es:'(4aR,4bR,8aR,10aR)-tetradecahidrofenantreno'},
  {smiles:'C1CC[C@@H]2[C@H](C1)CC[C@H]3[C@H]2CCCC3',topology:'angular',
    en:'(4aR,4bR,8aS,10aR)-tetradecahydrophenanthrene',es:'(4aR,4bR,8aS,10aR)-tetradecahidrofenantreno'},
];

test('audited parent and absolute-PIN names reconcile strictly and independently in EN and ES',()=>{
  for(const fixture of references){
    const imported=moleculeFromSmiles(fixture.smiles);assert.equal(imported.ok,true,fixture.en);
    assert.equal(imported.molecule.fusedRingSystemStereo?.topology,fixture.topology);
    for(const [language,name] of [['en',fixture.en],['es',fixture.es]]){
      const proof=reconcileSystematicName(imported.molecule,name);assert.equal(proof?.status,'FULL',`${language}: ${name}`);
      assert.equal(proof.evidence?.language,language);
      const presentation=presentValidatedSystematicName(proof,language);
      assert.equal(presentation.name,name);assert.equal(presentation.language,language);
      assert.equal(presentation.localized,false);
      assert.equal(proof.components.find(component=>component.id==='parent')?.atomIds.length,14);
      assert.equal(proof.components.filter(component=>component.id.startsWith('fusion-junction-')).length,2);
      for(const component of proof.components.filter(item=>item.id.startsWith('fusion-junction-'))){
        assert.equal(component.atomIds.length,2);
        assert.equal(component.bondIds.length,1);
        assert.ok(component.atomIds.every(id=>imported.molecule.atoms.some(atom=>atom.id===id)));
        assert.ok(component.bondIds.every(([a,b])=>imported.molecule.bonds.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a))));
      }
    }
  }
});

test('wrong, incomplete, reversed, or unsupported absolute descriptors never become FULL',()=>{
  const linear=moleculeFromSmiles(references[1].smiles);assert.equal(linear.ok,true);
  for(const name of ['(4aS,8aR,9aS,10aS)-tetradecahydroanthracene',
    '(4aR,8aR,9aS)-tetradecahydroanthracene','(4aS,8aS,9aR,10aR)-tetradecahydroanthracene'])
    assert.equal(reconcileSystematicName(linear.molecule,name),null,name);
  const partialSmiles='C1CCC2C[C@H]3CCCC[C@H]3CC2C1';
  const partial=moleculeFromSmiles(partialSmiles);assert.equal(partial.ok,true);
  assert.equal(partial.molecule.fusedRingSystemStereo?.specification,'partial');
  assert.equal(reconcileSystematicName(partial.molecule,'tetradecahydroanthracene'),null);
  assert.equal(reconcileSystematicName(partial.molecule,references[1].en),null);
  const historical=moleculeFromSmiles(references[3].smiles);assert.equal(historical.ok,true);
  assert.equal(reconcileSystematicName(historical.molecule,'cis,syn,cis-perhydrophenanthrene'),null);
});

test('the two fusion controls are disjoint real graph regions',()=>{
  const imported=moleculeFromSmiles(references[3].smiles);assert.equal(imported.ok,true);
  const proof=reconcileSystematicName(imported.molecule,references[3].en);assert.ok(proof);
  const [first,second]=proof.components.filter(component=>component.id.startsWith('fusion-junction-'));
  assert.ok(first&&second);
  assert.equal(new Set([...first.atomIds,...second.atomIds]).size,4);
  assert.notDeepEqual(first.bondIds[0],second.bondIds[0]);
});

test('symmetry-equivalent mirror notation retains the achiral Blue Book PIN',()=>{
  const listed=moleculeFromSmiles(references[1].smiles);assert.equal(listed.ok,true);
  const inverted=moleculeFromSmiles('C1CC[C@@H]2C[C@@H]3CCCC[C@@H]3C[C@@H]2C1');assert.equal(inverted.ok,true);
  assert.equal(inverted.molecule.fusedRingSystemStereo?.identityCode,listed.molecule.fusedRingSystemStereo?.identityCode);
  assert.equal(reconcileSystematicName(inverted.molecule,references[1].en)?.status,'FULL');
});

test('audited fully locanted hydrogenation names remain bilingual and stereo-strict',()=>{
  const cases=[
    {smiles:references[1].smiles,
      en:'(4aR,8aR,9aS,10aS)-1,2,3,4,4a,5,6,7,8,8a,9,9a,10,10a-tetradecahydroanthracene',
      es:'(4aR,8aR,9aS,10aS)-1,2,3,4,4a,5,6,7,8,8a,9,9a,10,10a-tetradecahidroantraceno'},
    {smiles:references[4].smiles,
      en:'(4aR,4bR,8aR,10aR)-1,2,3,4,4a,4b,5,6,7,8,8a,9,10,10a-tetradecahydrophenanthrene',
      es:'(4aR,4bR,8aR,10aR)-1,2,3,4,4a,4b,5,6,7,8,8a,9,10,10a-tetradecahidrofenantreno'},
  ];
  for(const fixture of cases){
    const imported=moleculeFromSmiles(fixture.smiles);assert.equal(imported.ok,true);
    for(const language of ['en','es'])assert.equal(reconcileSystematicName(imported.molecule,fixture[language])?.evidence?.language,language);
  }
  const imported=moleculeFromSmiles(cases[0].smiles);assert.equal(imported.ok,true);
  assert.equal(reconcileSystematicName(imported.molecule,cases[0].en.replace('9aS','9aR')),null);
});
