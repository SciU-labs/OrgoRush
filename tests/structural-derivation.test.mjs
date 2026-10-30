import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveStructuralComponents, mapStructuralRegions, remapStructuralDerivation, structuralVisualTargets } from "../app/structural-derivation.ts";

const graph = smiles => { const built = moleculeFromSmiles(smiles); assert.equal(built.ok, true, built.error); return built.molecule; };
const sorted = xs => [...xs].sort((a, b) => a - b);
// Reference connectivity: PubChem CID 3672, 1983, 2244; atom IDs are
// explicitly frozen for these SMILES, independently of component discovery.
const cases = [
  ["ibuprofen", "CC(C)Cc1ccc(cc1)C(C)C(=O)O", [["carboxylicAcid", [13,14,15]], ["ringSystem", [5,6,7,8,9,10]]]],
  ["paracetamol", "CC(=O)Nc1ccc(O)cc1", [["amide", [2,3,4]], ["hydroxyl", [8,9]], ["ringSystem", [5,6,7,8,10,11]]]],
  ["aspirin", "CC(=O)Oc1ccccc1C(=O)O", [["ester", [2,3,4]], ["carboxylicAcid", [11,12,13]], ["ringSystem", [5,6,7,8,9,10]]]],
];
for (const [name, smiles, expected] of cases) test(`${name}: exact structural regions, edges and permutation`, () => {
  const molecule = graph(smiles), model = deriveStructuralComponents(molecule, name);
  assert.equal(model.status, "PARTIAL");
  assert.deepEqual(model.components.map(c => [c.kind, sorted(c.atomIds)]), expected);
  const ids = new Map(molecule.atoms.map(a => [a.id, a.id * 17 + 100]));
  const permuted = { atoms: molecule.atoms.map(a => ({ ...a, id: ids.get(a.id) })).reverse(),
    bonds: molecule.bonds.map(([a,b,o]) => [ids.get(b),ids.get(a),o]).reverse() };
  const mapping = mapStructuralRegions(molecule, permuted, model.components.map(c => c.atomIds));
  assert.ok(mapping);
  const remapped = remapStructuralDerivation(model, molecule, permuted);
  assert.ok(remapped);
  const highlights = structuralVisualTargets(remapped);
  for (const c of remapped.components) {
    assert.deepEqual(highlights[c.id].atomIds, c.atomIds);
    assert.deepEqual(highlights[c.id].bondIds, c.bondIds);
  }
  for (const c of model.components) {
    assert.deepEqual(sorted(c.atomIds.map(id => mapping.get(id))), sorted(c.atomIds.map(id => ids.get(id))));
    assert.deepEqual(c.bondIds.map(([a,b]) => sorted([a,b])).sort(), molecule.bonds
      .filter(([a,b]) => c.atomIds.includes(a) && c.atomIds.includes(b)).map(([a,b]) => sorted([a,b])).sort());
  }
  const other = deriveStructuralComponents(permuted, name);
  for (const c of model.components) assert.ok(other.components.some(d => d.kind === c.kind
    && JSON.stringify(sorted(d.atomIds)) === JSON.stringify(sorted(c.atomIds.map(id => ids.get(id))))));
});
test("open and cyclic carbohydrate forms differ without invented stereo", () => {
  const open = deriveStructuralComponents(graph("O=CC(O)C(O)C(O)C(O)CO"), "glucose, open connectivity; stereo unspecified");
  const cyclic = deriveStructuralComponents(graph("OCC1OC(O)C(O)C(O)C1O"), "cyclic hexose; anomer unspecified");
  assert.equal(open.components.filter(c => c.kind === "hydroxyl").length, 5);
  assert.equal(open.components.filter(c => c.kind === "carbonyl").length, 1);
  assert.equal(cyclic.components.filter(c => c.kind === "ringSystem").length, 1);
  assert.equal(cyclic.components.filter(c => c.kind === "carbonyl").length, 0);
  assert.equal([...open.components,...cyclic.components].filter(c => c.kind === "stereo").length, 0);
});
test("ambiguous fragment correspondence and stereo changes fail closed", () => {
  const ethane = graph("CC");
  assert.equal(mapStructuralRegions(ethane, ethane, [[1]]), null);
  assert.ok(mapStructuralRegions(ethane, ethane, [[1,2]]));
  assert.equal(mapStructuralRegions(graph("C[C@H](O)C(=O)O"), graph("C[C@@H](O)C(=O)O"), []), null);
  assert.equal(mapStructuralRegions(graph("CCO"), graph("COC"), []), null);
});
test("invalid and uninformative graphs do not invent components", () => {
  assert.equal(deriveStructuralComponents(graph("CC"), "ibuprofen").status, "UNSUPPORTED");
  assert.equal(deriveStructuralComponents({ atoms: [], bonds: [[1,2]] }, "aspirin").status, "UNSUPPORTED");
});
test("fused heterocycle import is separate from a partial caffeine derivation", () => {
  const molecule=graph("Cn1c(=O)c2c(ncn2C)n(C)c1=O");
  const model=deriveStructuralComponents(molecule,"caffeine");
  assert.equal(model.status,"PARTIAL");
  assert.equal(model.components.filter(c=>c.kind==='ringSystem').length,1);
  assert.equal(model.components.filter(c=>c.kind==='N-bound methyl').length,3);
});
test("steroid ring system stays intact, with explicit stereo and no artificial parent", () => {
  const molecule = graph("C[C@]12CC[C@H]3[C@@H]([C@@H]1CC[C@@H]2O)CCC4=CC(=O)CC[C@]34C");
  const model = deriveStructuralComponents(molecule, "testosterone");
  const rings = model.components.filter(c => c.kind === "ringSystem");
  assert.equal(rings.length, 1);
  assert.equal(rings[0].atomIds.length, 17);
  assert.match(rings[0].evidence, /4 independent/);
  assert.equal(model.components.filter(c => c.kind === "carbonyl").length, 1);
  assert.equal(model.components.filter(c => c.kind === "hydroxyl").length, 1);
  assert.equal(model.components.filter(c => c.kind === "stereo").length, molecule.atoms.filter(a => a.tetrahedralParity).length);
  assert.equal(model.status, "PARTIAL");
});
