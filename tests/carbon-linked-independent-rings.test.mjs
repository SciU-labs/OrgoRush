import test from 'node:test';
import assert from 'node:assert/strict';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
import { getMainChainStereoDescriptors } from '../app/double-bond-stereochemistry.ts';

// PubChem structure references used independently of the name parser:
// diphenylmethane CID 7580, diphenylmethanol CID 7037, triphenylmethanol CID
// 6457, BPA CID 6623, benzilic acid CID 6463, stilbene CID 11502, and
// 1-phenylcyclohexanol CID 15319. The two geometrical stilbene SMILES carry
// explicit E/Z bonds; the connectivity-only SMILES has no assigned geometry.
const references = [
  ['diphenylmethane', 'c1ccccc1Cc1ccccc1', 'none'],
  ['diphenylmethanol', 'OC(c1ccccc1)c1ccccc1', 'alcohol'],
  ['triphenylmethanol', 'OC(c1ccccc1)(c1ccccc1)c1ccccc1', 'alcohol'],
  ['4-[2-(4-hydroxyphenyl)propan-2-yl]phenol', 'CC(C)(c1ccc(O)cc1)c1ccc(O)cc1', 'alcohol'],
  ['1,2-diphenylethene', 'c1ccccc1C=Cc1ccccc1', 'none'],
  ['2-hydroxy-2,2-diphenylacetic acid', 'O=C(O)C(O)(c1ccccc1)c1ccccc1', 'carboxylicAcid'],
  ['cyclohexylbenzene', 'c1ccccc1C1CCCCC1', 'none'],
  ['1-phenylcyclohexan-1-ol', 'OC1(c2ccccc2)CCCCC1', 'alcohol'],
  ['1,3-diphenylpropane', 'c1ccccc1CCCc1ccccc1', 'none'],
  ['1,2-diphenylethane', 'c1ccccc1CCc1ccccc1', 'none'],
  ['1,4-diphenylbut-2-ene', 'c1ccccc1CC=CCc1ccccc1', 'none'],
];

function permute(graph) {
  const ids = new Map(graph.atoms.map((atom, index) => [atom.id, 901 + (graph.atoms.length - index) * 17]));
  return { ...graph,
    atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: ids.get(atom.id), x: -atom.y, y: atom.x })),
    bonds: [...graph.bonds].reverse().map(([a,b,order,ez]) => [ids.get(b),ids.get(a),order,...(ez === undefined ? [] : [ez])]),
    rings: graph.rings?.map(ring => ({...ring,atomIds:ring.atomIds.map(id=>ids.get(id))})) };
}

for (const [name, smiles, principalGroup] of references) {
  test(`${name}: carbon-linked independent rings reconcile with exact pedagogical regions`, () => {
    const imported = moleculeFromSmiles(smiles);
    assert.equal(imported.ok, true, imported.error);
    const model = reconcileSystematicName(imported.molecule, name);
    assert.equal(model?.status, 'FULL');
    assert.equal(model?.principalGroup, principalGroup);
    assert.equal(model?.evidence?.equivalence, 'complete-graph-isomorphism');
    const covered = new Set(model.components.flatMap(component => component.atomIds));
    assert.equal(covered.size, imported.molecule.atoms.length, 'all source atoms are assigned to named regions');
    assert.equal(reconcileSystematicName(permute(imported.molecule), name)?.status, 'FULL', 'atom IDs, bond order and layout do not affect the proof');
  });
}

test('di- and tri-phenyl controls retain both the grouped region and each individual ring', () => {
  for (const [name, smiles, expected] of [
    ['diphenylmethane','c1ccccc1Cc1ccccc1',2],
    ['diphenylmethanol','OC(c1ccccc1)c1ccccc1',2],
    ['triphenylmethanol','OC(c1ccccc1)(c1ccccc1)c1ccccc1',3],
    ['2-hydroxy-2,2-diphenylacetic acid','O=C(O)C(O)(c1ccccc1)c1ccccc1',2],
    ['1,3-diphenylpropane','c1ccccc1CCCc1ccccc1',2],
  ]) {
    const graph = moleculeFromSmiles(smiles).molecule;
    const model = reconcileSystematicName(graph, name);
    const count = name.startsWith('triphenyl') ? 3 : expected;
    const occurrences = model.components.filter(component => /^phenyl-\d+$/.test(component.id));
    assert.equal(occurrences.length, count, name);
    assert.ok(model.components.some(component => component.id === 'phenyl-groups' || component.id === 'diphenyl'), name);
    assert.ok(occurrences.every(component => component.atomIds.length === 6 && component.bondIds.length >= 7), name);
  }
});

test('BPA keeps parent-ring, chain-internal and second-ring locants in separate scopes', () => {
  const graph = moleculeFromSmiles('CC(C)(c1ccc(O)cc1)c1ccc(O)cc1').molecule;
  const proof = reconcileSystematicName(graph, '4-[2-(4-hydroxyphenyl)propan-2-yl]phenol');
  assert.equal(proof?.status, 'FULL');
  const chain = proof.components.find(component => component.id === 'propan-2-yl');
  const phenyl = proof.components.find(component => component.id === 'hydroxyphenyl');
  const hydroxy = proof.components.find(component => component.id === 'hydroxy-prefix');
  assert.deepEqual(chain.internalNumbering.map(([,locant])=>locant), [1,2,3]);
  assert.deepEqual(phenyl.internalNumbering.map(([,locant])=>locant), [1,2,3,4,5,6]);
  assert.deepEqual(hydroxy.atomIds, [phenyl.internalNumbering.find(([,locant])=>locant===4)[0], hydroxy.atomIds[1]]);
  assert.ok(chain.atomIds.includes(proof.parentAtomIds[3]) === false, 'chain C2 is separate from parent ring C4');
});

test('explicit E and Z descriptors must match the assigned stilbene geometry; no descriptor is invented', () => {
  const e = moleculeFromSmiles('c1ccccc1/C=C/c1ccccc1').molecule;
  const z = moleculeFromSmiles('c1ccccc1/C=C\\c1ccccc1').molecule;
  const unspecified = moleculeFromSmiles('c1ccccc1C=Cc1ccccc1').molecule;
  assert.equal(getMainChainStereoDescriptors(e, [7,8], true)[0]?.configuration, 'E');
  assert.equal(getMainChainStereoDescriptors(z, [7,8], true)[0]?.configuration, 'Z');
  assert.equal(getMainChainStereoDescriptors(unspecified, [7,8], true).length, 0);
  assert.equal(reconcileSystematicName(e, '(E)-1,2-diphenylethene')?.status, 'FULL');
  assert.equal(reconcileSystematicName(z, '(Z)-1,2-diphenylethene')?.status, 'FULL');
  assert.equal(reconcileSystematicName(unspecified, '1,2-diphenylethene')?.status, 'FULL');
  assert.equal(reconcileSystematicName(e, '(Z)-1,2-diphenylethene'), null);
  assert.equal(reconcileSystematicName(z, '(E)-1,2-diphenylethene'), null);
  assert.equal(reconcileSystematicName(unspecified, '(E)-1,2-diphenylethene'), null);
  assert.equal(reconcileSystematicName(e, '1,2-diphenylethene'), null);
  assert.equal(reconcileSystematicName(e, '(2E)-1,2-diphenylethene'), null);
  const chain = moleculeFromSmiles('c1ccccc1C/C=C/Cc1ccccc1').molecule;
  assert.equal(reconcileSystematicName(chain, '(2E)-1,4-diphenylbut-2-ene')?.status, 'FULL');
});

test('incorrect parents, locants, multiplicities, omitted rings and incompatible structures are rejected', () => {
  const methane = moleculeFromSmiles('c1ccccc1Cc1ccccc1').molecule;
  assert.equal(reconcileSystematicName(methane, '1,3-diphenylpropane'), null);
  assert.equal(reconcileSystematicName(methane, 'triphenylmethanol'), null);
  assert.equal(reconcileSystematicName(methane, 'phenylmethane'), null);
  const propane = moleculeFromSmiles('c1ccccc1CCCc1ccccc1').molecule;
  assert.equal(reconcileSystematicName(propane, '1,4-diphenylpropane'), null);
  assert.equal(reconcileSystematicName(propane, '1,2-diphenylpropane'), null);
  const acid = moleculeFromSmiles('O=C(O)C(O)(c1ccccc1)c1ccccc1').molecule;
  assert.equal(reconcileSystematicName(acid, '2-hydroxy-2-phenylacetic acid'), null);
  const cyclo = moleculeFromSmiles('OC1(c2ccccc2)CCCCC1').molecule;
  assert.equal(reconcileSystematicName(cyclo, '1-phenylcyclohexan-1-one'), null);
});

test('Spanish names retain the same ring, chain and heteroatom correspondence', () => {
  const spanish = [
    ['difenilmetano','c1ccccc1Cc1ccccc1'],
    ['difenilmetanol','OC(c1ccccc1)c1ccccc1'],
    ['trifenilmetanol','OC(c1ccccc1)(c1ccccc1)c1ccccc1'],
    ['4-[2-(4-hidroxifenil)propan-2-il]fenol','CC(C)(c1ccc(O)cc1)c1ccc(O)cc1'],
    ['difenilmetanona','O=C(c1ccccc1)c1ccccc1'],
    ['1,3-difenilpropano','c1ccccc1CCCc1ccccc1'],
    ['1,2-difenileteno','c1ccccc1C=Cc1ccccc1'],
    ['ácido 2-hidroxi-2,2-difenilacético','O=C(O)C(O)(c1ccccc1)c1ccccc1'],
    ['ciclohexilbenceno','c1ccccc1C1CCCCC1'],
    ['1-fenilciclohexan-1-ol','OC1(c2ccccc2)CCCCC1'],
  ];
  for (const [name, smiles] of spanish) {
    const graph = moleculeFromSmiles(smiles).molecule;
    const proof = reconcileSystematicName(graph, name);
    assert.equal(proof?.status, 'FULL', name);
    assert.equal(proof?.evidence?.language, 'es', `${name} must be independently parsed in Spanish`);
    for (const component of proof.components) assert.equal(name.slice(component.start, component.end), component.text, `${name}: literal component spans`);
  }
  const eGraph = moleculeFromSmiles('c1ccccc1/C=C/c1ccccc1').molecule;
  const zGraph = moleculeFromSmiles('c1ccccc1/C=C\\c1ccccc1').molecule;
  for (const [name,graph] of [['(E)-1,2-difenileteno',eGraph],['(Z)-1,2-difenileteno',zGraph]]) {
    const proof=reconcileSystematicName(graph,name);
    assert.equal(proof?.status,'FULL',name);
    assert.equal(proof?.evidence?.language,'es',`${name} is a strict Spanish reconciliation`);
  }
});
