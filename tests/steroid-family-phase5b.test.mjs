import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SmilesParser} from 'openchemlib';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {steroidLocantAtomIds,isValidFusedPolycyclicStereochemistry} from '../app/fused-polycyclic-stereochemistry.ts';
import {buildHydrocarbonFromIupacName} from '../app/name-to-molecule.ts';
import {presentValidatedSystematicName,reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {STEROID_REFERENCES} from '../app/steroid-family-grammar.ts';
import {normalizeMoleculePayload} from '../app/api/molecule-payload.ts';

const records=[
  {family:'estrane',descriptor:'5α',formula:'C18H30',en:'5α-estrane',es:'5α-estrano',carbons:18},
  {family:'estrane',descriptor:'5β',formula:'C18H30',en:'5β-estrane',es:'5β-estrano',carbons:18},
  {family:'estrane',descriptor:'5ξ',formula:'C18H30',en:'5ξ-estrane',es:'5ξ-estrano',carbons:18},
  {family:'androstane',descriptor:'5α',formula:'C19H32',en:'5α-androstane',es:'5α-androstano',carbons:19},
  {family:'androstane',descriptor:'5β',formula:'C19H32',en:'5β-androstane',es:'5β-androstano',carbons:19},
  {family:'androstane',descriptor:'5ξ',formula:'C19H32',en:'5ξ-androstane',es:'5ξ-androstano',carbons:19},
];

test('audited estrane and androstane names reconcile independently in English and Spanish',()=>{
  for(const record of records){
    const source=STEROID_REFERENCES[record.family][record.descriptor].smiles;
    const imported=moleculeFromSmiles(source);assert.equal(imported.ok,true,record.en);
    const {molecule}=imported;assert.equal(molecule.atoms.length,record.carbons);
    assert.equal(new SmilesParser().parseMolecule(source).getMolecularFormula().formula,record.formula);
    assert.equal(isValidFusedPolycyclicStereochemistry(molecule),true);
    const locants=steroidLocantAtomIds(molecule);assert.ok(locants);
    assert.equal(Object.keys(locants).length,record.carbons);
    assert.ok(locants['18']);assert.equal(Boolean(locants['19']),record.family==='androstane');
    const c18Bond=molecule.bonds.find(([a,b])=>new Set([a,b]).has(locants['18']));assert.ok(c18Bond);
    assert.ok(c18Bond.includes(locants['13']));
    if(locants['19'])assert.ok(molecule.bonds.some(([a,b])=>new Set([a,b]).has(locants['19'])&&new Set([a,b]).has(locants['10'])));
    const en=reconcileSystematicName(molecule,record.en),es=reconcileSystematicName(molecule,record.es);
    assert.equal(en?.status,'FULL',record.en);assert.equal(es?.status,'FULL',record.es);
    assert.equal(en.evidence.language,'en');assert.equal(es.evidence.language,'es');
    assert.equal(presentValidatedSystematicName(en,'es').name,record.es);
    assert.equal(presentValidatedSystematicName(es,'en').name,record.en);
    assert.equal(en.evidence.construction,'fused-steroid-family-stereo');
  }
});

test('steroid numbering follows the graph when imported atom order and depiction change',()=>{
  const record=records[3],smiles=STEROID_REFERENCES.androstane['5α'].smiles;
  const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true);
  const graph=imported.molecule,expected=steroidLocantAtomIds(graph);assert.ok(expected);
  const reordered={...graph,atoms:[...graph.atoms].reverse(),bonds:[...graph.bonds].reverse(),rings:[...(graph.rings??[])].reverse()};
  assert.deepEqual(steroidLocantAtomIds(reordered),expected);
  const changed={...graph,atoms:graph.atoms.map(atom=>({...atom,x:-atom.x,y:-atom.y}))};
  assert.deepEqual(steroidLocantAtomIds(changed),expected);
  assert.equal(reconcileSystematicName(changed,record.en)?.status,'FULL');
});

test('family, methyl position and C5 descriptor swaps cannot reconcile as FULL',()=>{
  const estrane=moleculeFromSmiles(STEROID_REFERENCES.estrane['5α'].smiles).molecule;
  const androstane=moleculeFromSmiles(STEROID_REFERENCES.androstane['5α'].smiles).molecule;
  assert.equal(reconcileSystematicName(estrane,'5α-androstane'),null);
  assert.equal(reconcileSystematicName(androstane,'5α-estrane'),null);
  assert.equal(reconcileSystematicName(estrane,'5β-estrane'),null);
  assert.equal(reconcileSystematicName(androstane,'5β-androstane'),null);
  const missingC19={...androstane,atoms:androstane.atoms.filter(atom=>atom.id!==steroidLocantAtomIds(androstane)['19']),
    bonds:androstane.bonds.filter(([a,b])=>a!==steroidLocantAtomIds(androstane)['19']&&b!==steroidLocantAtomIds(androstane)['19'])};
  assert.equal(reconcileSystematicName(missingC19,'5α-androstane'),null);
  const locants=steroidLocantAtomIds(estrane),c18=locants['18'],c13=locants['13'],c10=locants['10'];
  const wrongPosition={...estrane,bonds:estrane.bonds.filter(([a,b])=>!new Set([a,b]).has(c18)||!new Set([a,b]).has(c13))
    .concat([[c10,c18,1]])};
  assert.equal(reconcileSystematicName(wrongPosition,'5α-estrane'),null);
  const unsaturated={...estrane,bonds:estrane.bonds.map(([a,b,order])=>[a,b,a===locants['1']||b===locants['1']?2:order])};
  assert.equal(reconcileSystematicName(unsaturated,'5α-estrane'),null);
});

test('all six steroid names can be built and SMILES round-trip retains each configuration state',()=>{
  for(const record of records){
    const built=buildHydrocarbonFromIupacName(record.en);assert.equal(built.ok,true,record.en);
    const exported=moleculeToSmiles(built.molecule);assert.equal(exported.ok,true,record.en);
    const restored=moleculeFromSmiles(exported.smiles);assert.equal(restored.ok,true,record.en);
    assert.equal(restored.molecule.fusedPolycyclicStereo.identityCode,built.molecule.fusedPolycyclicStereo.identityCode);
    assert.equal(restored.molecule.fusedPolycyclicStereo.specification,built.molecule.fusedPolycyclicStereo.specification);
    assert.equal(reconcileSystematicName(restored.molecule,record.en)?.status,'FULL');
  }
});

test('cloud payload persistence retains C18/C19 mappings and rejects forged or stale locants',()=>{
  for(const record of [records[0],records[3],records[5]]){
    const graph=moleculeFromSmiles(STEROID_REFERENCES[record.family][record.descriptor].smiles).molecule;
    const saved=normalizeMoleculePayload(JSON.parse(JSON.stringify(graph)));assert.ok(saved);
    assert.deepEqual(saved.fusedPolycyclicStereo.locantAtomIds,graph.fusedPolycyclicStereo.locantAtomIds);
    assert.equal(reconcileSystematicName(saved,record.en)?.status,'FULL');
    const invalid={...saved,fusedPolycyclicStereo:{...saved.fusedPolycyclicStereo,
      locantAtomIds:{...saved.fusedPolycyclicStereo.locantAtomIds,'18':999}}};
    assert.equal(normalizeMoleculePayload(invalid),null);
  }
});
