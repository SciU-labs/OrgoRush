import test from 'node:test';
import assert from 'node:assert/strict';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';

const cases = [
  ['N-phenylbenzamide','O=C(Nc1ccccc1)c1ccccc1'],
  ['N-(2-methylphenyl)benzamide','O=C(Nc1ccccc1C)c1ccccc1'],
  ['N-(3-methylphenyl)benzamide','O=C(Nc1cc(C)ccc1)c1ccccc1'],
  ['N-(4-methylphenyl)benzamide','O=C(Nc1ccc(C)cc1)c1ccccc1'],
  ['N-(2,3-dimethylphenyl)benzamide','O=C(Nc1c(C)c(C)ccc1)c1ccccc1'],
  ['N-(2,4-dichlorophenyl)benzamide','O=C(Nc1c(Cl)cc(Cl)cc1)c1ccccc1'],
  ['N-(2-bromo-4-methylphenyl)benzamide','O=C(Nc1c(Br)cc(C)cc1)c1ccccc1'],
  ['2-[(2-methylphenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1ccccc1C'],
  ['2-[(3-methylphenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1cc(C)ccc1'],
  ['2-[(2,3-dimethylphenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1c(C)c(C)ccc1'],
  ['2-[(2,6-dichlorophenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1c(Cl)cccc1Cl'],
  ['2-[(2-bromo-4-fluorophenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1c(Br)cc(F)cc1'],
  ['2-[(2-fluoro-3-methylphenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1c(F)c(C)ccc1'],
  ['2-[(3-chloro-2-methylphenyl)amino]benzoic acid','O=C(O)c1ccccc1Nc1c(C)c(Cl)ccc1'],
  ['2-(3-benzoylphenyl)propanoic acid','CC(C(=O)O)c1cc(ccc1)C(=O)c1ccccc1'],
  ['2-(2-benzoylphenyl)propanoic acid','CC(C(=O)O)c1c(C(=O)c2ccccc2)cccc1'],
  ['2-[2-(2,6-dichloroanilino)phenyl]acetic acid','O=C(O)Cc1ccccc1Nc1c(Cl)cccc1Cl'],
  ['propan-2-yl 2-[4-(4-chlorobenzoyl)phenoxy]-2-methylpropanoate','CC(C)OC(=O)C(C)(C)Oc1ccc(C(=O)c2ccc(Cl)cc2)cc1'],
  ['propan-2-yl 2-[3-(2-fluorobenzoyl)phenoxy]-2-methylpropanoate','CC(C)OC(=O)C(C)(C)Oc1cc(C(=O)c2c(F)cccc2)ccc1'],
];

const permute = graph => {
  const ids = new Map(graph.atoms.map((atom, i) => [atom.id, 1001 + (graph.atoms.length - i) * 19]));
  return { ...graph, atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: ids.get(atom.id) })),
    bonds: [...graph.bonds].reverse().map(([a,b,...rest]) => [ids.get(b), ids.get(a), ...rest]) };
};

for (const [name, smiles] of cases) test(`${name} has complete, permutation-stable atom selections`, () => {
  const imported = moleculeFromSmiles(smiles); assert.equal(imported.ok, true);
  const proof = reconcileSystematicName(imported.molecule, name);
  assert.equal(proof?.status, 'FULL');
  assert.equal(proof?.evidence?.equivalence, 'complete-graph-isomorphism');
  assert.equal(new Set(proof.components.flatMap(component => component.atomIds)).size, imported.molecule.atoms.length);
  assert.equal(reconcileSystematicName(permute(imported.molecule), name)?.status, 'FULL');
  for (const component of proof.components) {
    assert.equal(name.slice(component.start, component.end), component.text);
    for (const locant of component.writtenLocants ?? []) assert.equal(name.slice(locant.start, locant.end), String(locant.locant));
  }
});

const spanishPriorityCases = [
  ['N-fenilbenzamida','O=C(Nc1ccccc1)c1ccccc1'],
  ['ácido 2-[2-(2,6-dicloroanilino)fenil]acético','O=C(O)Cc1ccccc1Nc1c(Cl)cccc1Cl'],
  ['ácido 2-(3-benzoilfenil)propanoico','CC(C(=O)O)c1cc(ccc1)C(=O)c1ccccc1'],
  ['ácido 2-[(2,3-dimetilfenil)amino]benzoico','O=C(O)c1ccccc1Nc1c(C)c(C)ccc1'],
  ['ácido 2-[(3-cloro-2-metilfenil)amino]benzoico','O=C(O)c1ccccc1Nc1c(C)c(Cl)ccc1'],
  ['propan-2-ilo 2-[4-(4-clorobenzoil)fenoxi]-2-metilpropanoato','CC(C)OC(=O)C(C)(C)Oc1ccc(C(=O)c2ccc(Cl)cc2)cc1'],
];
for (const [name, smiles] of spanishPriorityCases) test(`${name} is independently reconciled in Spanish`, () => {
  const imported = moleculeFromSmiles(smiles); assert.equal(imported.ok, true);
  const proof = reconcileSystematicName(imported.molecule, name);
  assert.equal(proof?.status, 'FULL');
  assert.equal(proof?.evidence?.language, 'es');
  assert.equal(proof?.evidence?.equivalence, 'complete-graph-isomorphism');
  for (const component of proof.components) {
    assert.equal(name.slice(component.start, component.end), component.text);
    for (const locant of component.writtenLocants ?? []) assert.equal(name.slice(locant.start, locant.end), String(locant.locant));
  }
});

test('incorrect ring positions, omitted multiplicities, extras and wrong attachments are rejected', () => {
  const graph = moleculeFromSmiles('O=C(O)c1ccccc1Nc1c(C)c(Cl)ccc1').molecule;
  for (const name of [
    '3-[(3-chloro-2-methylphenyl)amino]benzoic acid',
    '2-[(2-chloro-3-methylphenyl)amino]benzoic acid',
    '2-[(2-methylphenyl)amino]benzoic acid',
    '2-[(3-chloro-2-methylphenyl)amino]benzamide',
  ]) assert.equal(reconcileSystematicName(graph, name), null, name);
  const benzamide = moleculeFromSmiles('O=C(Nc1cc(C)ccc1)c1ccccc1').molecule;
  for (const name of [
    'N-(5-methylphenyl)benzamide',
    'N-(4-methyl-2-chlorophenyl)benzamide',
    'N-(2,3-dimethylphenyl)benzamide',
  ]) assert.equal(reconcileSystematicName(benzamide, name), null, name);
  const ketoprofen = moleculeFromSmiles('CC(C(=O)O)c1cc(ccc1)C(=O)c1ccccc1').molecule;
  assert.equal(reconcileSystematicName(ketoprofen, '2-(5-benzoylphenyl)propanoic acid'), null);
  const fenofibrate = moleculeFromSmiles(cases[17][1]).molecule;
  assert.equal(reconcileSystematicName(fenofibrate, cases[17][0].replace('4-chloro','3-chloro')), null);
  assert.equal(reconcileSystematicName(fenofibrate, cases[17][0].replace('2-methyl','3-methyl')), null);
  const charged = moleculeFromSmiles('O=C(O)c1ccccc1Nc1ccccc1C').molecule;
  charged.atoms.filter(atom => atom.element === 'O')[1].charge = -1;
  assert.equal(reconcileSystematicName(charged, cases[7][0]), null, 'incompatible charge state must not reconcile');
  const chiralKetoprofen = moleculeFromSmiles('C[C@H](c1cc(ccc1)C(=O)c1ccccc1)C(=O)O').molecule;
  assert.equal(reconcileSystematicName(chiralKetoprofen, cases[14][0]), null, 'an unspecified name must not erase specified stereochemistry');
});
