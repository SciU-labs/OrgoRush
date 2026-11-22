import test from 'node:test';
import assert from 'node:assert/strict';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';

// Structures and English names for the two single-hydroxy biaryls are from
// PubChem CIDs 7017 and 4-phenylphenol's record, respectively. The synthetic
// dihydroxy case varies the same grammar without adding a molecule exception.
const cases = [
  { id: 'CID 7017', name: '2-phenylphenol', spanish: '2-fenilfenol', smiles: 'Oc1ccccc1-c1ccccc1' },
  { id: 'CID 53435123', name: '4-phenylphenol', spanish: '4-fenilfenol', smiles: 'Oc1ccc(-c2ccccc2)cc1' },
  { id: 'synthetic dihydroxy biaryl', name: '4-(4-hydroxyphenyl)phenol', spanish: '4-(4-hidroxifenil)fenol', smiles: 'Oc1ccc(-c2ccc(O)cc2)cc1' },
];
const permute = graph => {
  const mapping = new Map(graph.atoms.map((atom, index) => [atom.id, 500 + (graph.atoms.length - index) * 23]));
  return { ...graph, atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: mapping.get(atom.id), x: -atom.y, y: atom.x })),
    bonds: [...graph.bonds].reverse().map(([a,b,...rest]) => [mapping.get(b), mapping.get(a), ...rest]), rings: [] };
};

const assemblies = [
  { id: 'CID 7095 biphenyl', name: "1,1'-biphenyl", spanish: "1,1'-bifenilo", smiles: 'c1ccccc1-c1ccccc1' },
  { id: 'CID 6766 ortho-terphenyl', name: "1,1':2',1''-terphenyl", spanish: "1,1':2',1''-terfenilo", smiles: 'c1ccccc1-c1ccccc1-c1ccccc1' },
  { id: 'CID 7076 meta-terphenyl', name: "1,1':3',1''-terphenyl", spanish: "1,1':3',1''-terfenilo", smiles: 'c1ccccc1-c1cc(ccc1)-c1ccccc1' },
  { id: 'CID 7115 para-terphenyl', name: "1,1':4',1''-terphenyl", spanish: "1,1':4',1''-terfenilo", smiles: 'c1ccccc1-c1ccc(cc1)-c1ccccc1' },
];

const heteroatomLinks = [
  { id: 'CID 7583 diphenyl ether', name: 'phenoxybenzene', spanish: 'fenoxibenceno', smiles: 'c1ccccc1Oc1ccccc1', group: 'none' },
  { id: 'CID 11487 diphenylamine', name: 'N-phenylaniline', spanish: 'N-fenilanilina', alternates: ['N-phenylbenzenamine','N-fenilbencenamina'], smiles: 'c1ccccc1Nc1ccccc1', group: 'amine' },
  { id: 'CID 11775 triphenylamine', name: 'N,N-diphenylaniline', spanish: 'N,N-difenilanilina', alternates: ['N,N-diphenylbenzenamine','N,N-difenilbencenamina'], smiles: 'N(c1ccccc1)(c1ccccc1)c1ccccc1', group: 'amine' },
];

for (const item of heteroatomLinks) {
  test(`${item.id}: supported heteroatom-linked rings reconcile with exact controls`, () => {
    const parsed = moleculeFromSmiles(item.smiles);
    assert.equal(parsed.ok, true);
    for (const name of [item.name, item.spanish, ...(item.alternates ?? [])]) {
      const proof = reconcileSystematicName(parsed.molecule, name);
      assert.equal(proof?.status, 'FULL', `${name} must account for both independent rings`);
      if (name === item.spanish) assert.equal(proof?.evidence?.language, 'es', `${name} must be parsed strictly in Spanish`);
      assert.equal(proof?.principalGroup, item.group);
      const linked = proof.components.find(component => component.id === (item.group === 'amine' ? 'n-aryl-substitution' : 'phenoxy'));
      assert.ok(linked);
      assert.ok(parsed.molecule.atoms.some(atom => linked.atomIds.includes(atom.id) && atom.element === (item.group === 'amine' ? 'N' : 'O')));
      assert.ok(linked.bondIds.length >= 2);
      assert.equal(reconcileSystematicName(permute(parsed.molecule), name)?.status, 'FULL');
    }
  });
}

for (const item of assemblies) {
  test(`${item.id}: P-28 ring assembly is reconstructed independently in both languages`, () => {
    const parsed = moleculeFromSmiles(item.smiles);
    assert.equal(parsed.ok, true);
    for (const name of [item.name, item.spanish]) {
      const proof = reconcileSystematicName(parsed.molecule, name);
      assert.equal(proof?.status, 'FULL', `${name} must account for the complete assembly`);
      if (name === item.spanish) assert.equal(proof?.evidence?.language, 'es', `${name} must be parsed strictly in Spanish`);
      assert.equal(proof?.evidence?.construction, 'benzene-ring-assembly');
      assert.equal(proof?.components.find(component => component.id === 'parent-assembly')?.atomIds.length, item.id.includes('biphenyl') ? 12 : 18);
      assert.ok(proof?.components.some(component => component.id === 'assembly-link-1' && component.bondIds.length === 1));
      assert.equal(reconcileSystematicName(permute(parsed.molecule), name)?.status, 'FULL', 'atom ordering and drawing rotation must not matter');
    }
  });
}

for (const item of cases) {
  test(`${item.id}: independent-ring phenol name is reconstructed in English and Spanish`, () => {
    const parsed = moleculeFromSmiles(item.smiles);
    assert.equal(parsed.ok, true);
    for (const name of [item.name, item.spanish]) {
      const proof = reconcileSystematicName(parsed.molecule, name);
      assert.equal(proof?.status, 'FULL', `${name} must be independently parsed and isomorphic`);
      if (name === item.spanish) assert.equal(proof?.evidence?.language, 'es', `${name} must be parsed strictly in Spanish`);
      assert.equal(proof?.evidence?.equivalence, 'complete-graph-isomorphism');
      assert.ok(proof.components.some(component => component.role === 'parent'));
      assert.ok(proof.components.some(component => component.role === 'substituent' || component.role === 'prefix'));
      assert.equal(reconcileSystematicName(permute(parsed.molecule), name)?.status, 'FULL');
    }
  });
}

test('independent-ring phenol grammar rejects a wrong ring locant and an omitted second hydroxyl', () => {
  const para = moleculeFromSmiles(cases[1].smiles);
  assert.equal(para.ok, true);
  assert.equal(reconcileSystematicName(para.molecule, '3-phenylphenol'), null);

  const dihydroxy = moleculeFromSmiles(cases[2].smiles);
  assert.equal(dihydroxy.ok, true);
  assert.equal(reconcileSystematicName(dihydroxy.molecule, '4-phenylphenol'), null);
});
test('P-28 assembly grammar rejects unsupported topology and incompatible ring locants', () => {
  const ortho = moleculeFromSmiles(assemblies[1].smiles);
  assert.equal(ortho.ok, true);
  assert.equal(reconcileSystematicName(ortho.molecule, "1,1':3',1''-terphenyl"), null);
  assert.equal(reconcileSystematicName(ortho.molecule, "1,1':5',1''-terphenyl"), null);
  assert.equal(reconcileSystematicName(ortho.molecule, "1,1':2',1''-quaterphenyl"), null);
});
