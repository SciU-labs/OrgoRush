import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveStructuralComponents, mapStructuralRegions, remapStructuralDerivation, structuralVisualTargets } from "../app/structural-derivation.ts";
import { buildStructuralPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";

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
  const molecule = graph(smiles), before = structuredClone(molecule), model = deriveStructuralComponents(molecule, name);
  assert.equal(model.status, "PARTIAL");
  const originalKinds = new Set(expected.map(([kind]) => kind));
  const originalComponents = model.components.filter(component => originalKinds.has(component.kind));
  assert.deepEqual(originalComponents.map(c => [c.kind, sorted(c.atomIds)]), expected);
  assert.ok(model.components.some(component => component.kind === "candidate carbon skeleton"));
  assert.ok(model.components.some(component => component.kind === "connected fragment"));
  const ids = new Map(molecule.atoms.map(a => [a.id, a.id * 17 + 100]));
  const permuted = { atoms: molecule.atoms.map(a => ({ ...a, id: ids.get(a.id) })).reverse(),
    bonds: molecule.bonds.map(([a,b,o]) => [ids.get(b),ids.get(a),o]).reverse() };
  const mapping = mapStructuralRegions(molecule, permuted, originalComponents.map(c => c.atomIds));
  assert.ok(mapping);
  const remapped = remapStructuralDerivation(model, molecule, permuted);
  assert.ok(remapped);
  const highlights = structuralVisualTargets(remapped);
  for (const c of remapped.components) {
    assert.deepEqual(highlights[c.id].atomIds, c.atomIds);
    assert.deepEqual(highlights[c.id].bondIds, c.bondIds);
  }
  for (const c of originalComponents) {
    assert.deepEqual(sorted(c.atomIds.map(id => mapping.get(id))), sorted(c.atomIds.map(id => ids.get(id))));
    assert.deepEqual(c.bondIds.map(([a,b]) => sorted([a,b])).sort(), molecule.bonds
      .filter(([a,b]) => c.atomIds.includes(a) && c.atomIds.includes(b)).map(([a,b]) => sorted([a,b])).sort());
  }
  const other = deriveStructuralComponents(permuted, name);
  for (const c of originalComponents) assert.ok(other.components.some(d => d.kind === c.kind
    && JSON.stringify(sorted(d.atomIds)) === JSON.stringify(sorted(c.atomIds.map(id => ids.get(id))))));
  const addedKinds = new Set(["candidate carbon skeleton", "connected fragment"]);
  const signatures = derivation => derivation.components.filter(c => addedKinds.has(c.kind))
    .map(c => `${c.kind}:${sorted(c.atomIds).join(",")}`).sort();
  const expectedAdded = model.components.filter(c => addedKinds.has(c.kind))
    .map(c => `${c.kind}:${sorted(c.atomIds.map(id => mapping.get(id))).join(",")}`).sort();
  assert.deepEqual(signatures(other), expectedAdded, `${name}: new graph regions map under ID permutation`);
  assert.deepEqual(molecule, before, `${name}: structural analysis does not mutate the graph`);
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
test("ethane yields an unverified two-carbon candidate, while insufficient and invalid graphs stay unsupported", () => {
  const ethane = graph("CC"), before = structuredClone(ethane);
  const partial = deriveStructuralComponents(ethane, "ibuprofen");
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.name.text, "ibuprofen");
  assert.equal(partial.name.classification, "unverified");
  assert.notEqual(partial.status, "FULL", "an arbitrary external name cannot promote graph evidence to FULL");
  const candidate = partial.components.find(component => component.kind === "candidate carbon skeleton");
  assert.ok(candidate);
  assert.equal(candidate.atomIds.length, 2);
  assert.ok(candidate.atomIds.every(id => ethane.atoms.find(atom => atom.id === id)?.element === "C"));
  assert.deepEqual(candidate.numbering, undefined, "an unverified name receives no IUPAC localizers");
  assert.match(candidate.evidence, /candidate only|candidate carbon path/i);
  assert.deepEqual(ethane, before);
  assert.equal(deriveStructuralComponents(graph("C"), "unrecognized name").status, "UNSUPPORTED",
    "a valid graph with no supported region remains unsupported");
  assert.equal(deriveStructuralComponents({ atoms: [], bonds: [[1,2]] }, "aspirin").status, "UNSUPPORTED");
});

test("candidate carbon paths and connected fragments are graph-backed, acyclic, and not IUPAC selections", () => {
  const molecule = graph("CCCCCCCC(=O)Nc1ccc(O)cc1"), before = structuredClone(molecule);
  const model = deriveStructuralComponents(molecule, "external-source-label");
  assert.equal(model.status, "PARTIAL");
  assert.equal(model.name.classification, "unverified");
  const ringAtoms = new Set(model.components.filter(component => component.kind === "ringSystem").flatMap(component => component.atomIds));
  const candidate = model.components.find(component => component.kind === "candidate carbon skeleton");
  assert.ok(candidate);
  assert.ok(candidate.atomIds.every(id => molecule.atoms.some(atom => atom.id === id && (atom.element ?? "C") === "C")));
  assert.ok(candidate.atomIds.every(id => !ringAtoms.has(id)), "an acyclic candidate excludes ring atoms");
  assert.equal(candidate.bondIds.length, candidate.atomIds.length - 1, "candidate bonds form one path without a cycle");
  for (let index = 1; index < candidate.atomIds.length; index += 1) {
    const a = candidate.atomIds[index - 1], b = candidate.atomIds[index];
    assert.ok(candidate.bondIds.some(([x, y]) => x === a && y === b || x === b && y === a));
    assert.ok(molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a));
  }
  assert.equal(candidate.numbering, undefined);
  assert.match(candidate.evidence, /candidate only|candidate path/i);
  assert.doesNotMatch(candidate.evidence, /selected IUPAC parent|is the IUPAC parent/i);

  const fragments = model.components.filter(component => component.kind === "connected fragment");
  assert.ok(fragments.length > 0);
  const atomIds = new Set(molecule.atoms.map(atom => atom.id));
  const elementCounts = new Map(molecule.atoms.map(atom => [atom.id, atom.element ?? "C"]));
  const candidateIds = new Set(candidate.atomIds);
  const retainedHeteroatoms = new Set(model.components.flatMap(component => component.atomIds)
    .filter(id => elementCounts.get(id) !== "C"));
  const expectedHeteroatoms = molecule.atoms.filter(atom => (atom.element ?? "C") !== "C").map(atom => atom.id);
  assert.deepEqual(sorted([...retainedHeteroatoms]), sorted(expectedHeteroatoms),
    "connected fragments preserve every heteroatom outside the carbon-only candidate path");
  for (const fragment of fragments) {
    assert.ok(fragment.atomIds.every(id => atomIds.has(id)));
    const region = new Set(fragment.atomIds), pending = [fragment.atomIds[0]], reached = new Set();
    while (pending.length) {
      const id = pending.pop();
      if (reached.has(id)) continue;
      reached.add(id);
      for (const [a, b] of molecule.bonds) if (a === id && region.has(b)) pending.push(b);
        else if (b === id && region.has(a)) pending.push(a);
    }
    assert.deepEqual(sorted(reached), sorted(fragment.atomIds), "fragment atoms form one connected region");
    assert.equal(fragment.numbering, undefined, "a structural fragment is not assigned IUPAC locants");
    assert.ok(fragment.bondIds.every(([a, b]) => molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a)));
    const joins = fragment.bondIds.filter(([a, b]) => candidateIds.has(a) !== candidateIds.has(b));
    assert.ok(joins.length > 0 && joins.every(([a, b]) =>
      (candidateIds.has(a) && region.has(b) || candidateIds.has(b) && region.has(a))
      && molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a)),
    "declared attachment edges join this fragment to the candidate path in the graph");
    assert.doesNotMatch(fragment.kind, /substituent/i, "structural fragments are not validated IUPAC substituents");
    assert.match(fragment.evidence, /name locant|localizador del nombre/i);
  }
  assert.deepEqual(molecule, before, "partial structural recognition is read-only");

  const ids = new Map(molecule.atoms.map(atom => [atom.id, atom.id * 29 + 500]));
  const permuted = { atoms: molecule.atoms.map(atom => ({ ...atom, id: ids.get(atom.id) })).reverse(),
    bonds: molecule.bonds.map(([a, b, order]) => [ids.get(b), ids.get(a), order]).reverse() };
  const remapped = remapStructuralDerivation(model, molecule, permuted);
  assert.ok(remapped, "candidate and fragment correspondences survive atom-ID permutation");
  const mappedRegions = components => components.filter(component => component.kind === "candidate carbon skeleton" || component.kind === "connected fragment")
    .map(component => `${component.kind}:${sorted(component.atomIds).join(",")}`).sort();
  assert.deepEqual(mappedRegions(remapped.components), model.components
    .filter(component => component.kind === "candidate carbon skeleton" || component.kind === "connected fragment")
    .map(component => `${component.kind}:${sorted(component.atomIds.map(id => ids.get(id))).join(",")}`).sort());
});
test("fused heterocycle import is separate from a partial caffeine derivation", () => {
  const molecule=graph("Cn1c(=O)c2c(ncn2C)n(C)c1=O");
  const model=deriveStructuralComponents(molecule,"caffeine");
  assert.equal(model.status,"PARTIAL");
  assert.equal(model.components.filter(c=>c.kind==='ringSystem').length,1);
  assert.equal(model.components.filter(c=>c.kind==='N-bound methyl').length,3);
});

test("ring reasoning distinguishes aromaticity, individual rings and external connections", () => {
  const examples = [
    ["benzene", "c1ccccc1", 1, /aromaticity/],
    ["toluene", "Cc1ccccc1", 1, /C–C/],
    ["phenol", "Oc1ccccc1", 1, /C–O/],
    ["anisole", "COc1ccccc1", 1, /aromaticity/],
    ["biphenyl", "c1ccccc1-c1ccccc1", 2, /C–C/],
    ["fluoxetine", "CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F", 2, /O/],
    ["cyclohexane", "C1CCCCC1", 1, /does not classify this ring as aromatic/],
    ["pyridine", "c1ccncc1", 1, /C\/N/],
    ["naphthalene", "c1ccc2ccccc2c1", 1, /2 independent cycles/],
  ];
  for (const [label, smiles, count, evidence] of examples) {
    const molecule = graph(smiles), model = deriveStructuralComponents(molecule, `${label} name is not reconciled`);
    const rings = model.components.filter(component => component.kind === "ringSystem");
    assert.equal(rings.length, count, `${label}: ring systems are counted by ring-edge connectivity`);
    for (const ring of rings) {
      assert.ok(ring.atomIds.length > 0);
      assert.ok(ring.bondIds.every(([a,b]) => ring.atomIds.includes(a) && ring.atomIds.includes(b)));
      assert.match(ring.evidence, evidence, `${label}: chemistry is described from the graph`);
    }
    const priorities = ["es", "en"].map(language => buildStructuralPriorityReasoning({ derivation: model, language }));
    for (const reasoning of priorities) {
      const ringStep = reasoning.steps.find(step => step.componentKind === "ringSystem");
      assert.ok(ringStep);
      const controls = [ringStep.fragments, ...(ringStep.fragments?.additionalFragments ?? [])];
      assert.equal(controls.length, count, `${label}: each ring has an independent control`);
      assert.equal(new Set(controls.map(control => control.text)).size, count, `${label}: ring controls are distinguishable`);
      const expectedRingAtoms = new Set(rings.flatMap(ring => ring.atomIds));
      assert.deepEqual(new Set(ringStep.target.atomIds), expectedRingAtoms, `${label}: the step control selects all rings together`);
      assert.deepEqual(new Set(ringStep.target.bondIds.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":"))),
        new Set(rings.flatMap(ring => ring.bondIds).map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":"))));
      for (const control of controls) {
        const target = ringStep.fragmentTargets[JSON.stringify([ringStep.number, control.kind, control.start ?? null, control.text, control.semanticId ?? null])];
        assert.ok(target);
        const component = model.components.find(item => item.id === control.semanticId);
        assert.deepEqual(new Set(target.atomIds), new Set(component.atomIds));
        assert.deepEqual(new Set(target.bondIds.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":"))),
          new Set(component.bondIds.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":"))));
      }
    }
  }
});

test("fluoxetine exposes independent ring, phenoxy and para-CF3 graph selections bilingually", () => {
  const molecule = graph("CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  const derivation = deriveStructuralComponents(molecule, "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine");
  assert.equal(derivation.status, "PARTIAL");
  const rings = derivation.components.filter(component => component.kind === "ringSystem");
  const phenoxy = derivation.components.find(component => component.kind === "phenoxy fragment");
  const substituted = derivation.components.find(component => component.kind === "substituted phenoxy fragment");
  const trifluoromethyl = derivation.components.find(component => component.kind === "trifluoromethyl group");
  const amine = derivation.components.find(component => component.kind === "amine fragment");
  const candidate = derivation.components.find(component => component.kind === "candidate carbon skeleton");
  const connections = derivation.components.filter(component => component.kind === "fragment connection");
  assert.equal(rings.length, 2);
  assert.ok(phenoxy);
  assert.ok(substituted);
  assert.ok(trifluoromethyl);
  assert.ok(amine);
  assert.equal(candidate.atomIds.length, 3);
  assert.equal(connections.length, 3);
  assert.equal(derivation.components.filter(component => component.kind === "connected fragment").length, 0,
    "recognized rings, amine and CF3 motifs replace redundant generic regions");
  assert.equal(phenoxy.atomIds.length, 7);
  assert.equal(substituted.atomIds.length, 11);
  assert.equal(trifluoromethyl.atomIds.length, 4);
  assert.match(amine.displayLabel, /Secondary amine/);
  assert.match(candidate.evidence, /3-carbon alkane skeleton/);
  assert.match(phenoxy.evidence, /ether oxygen/);
  assert.match(substituted.evidence, /para relationship/);
  assert.ok(!derivation.name.preferred, "fragment labels do not verify or promote the complete name");
  const visual = structuralVisualTargets(derivation);
  for (const component of [...rings, phenoxy, substituted]) {
    assert.deepEqual(new Set(visual[component.id].atomIds), new Set(component.atomIds));
    assert.deepEqual(new Set(visual[component.id].bondIds.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":"))),
      new Set(component.bondIds.map(([a,b]) => [a,b].sort((x,y)=>x-y).join(":"))));
  }
  const expectedLabels = [
    ["Ring 1: Benzene ring · direct C–C attachment", "Anillo 1: Anillo bencénico · unión directa C–C"],
    ["Ring 2: Benzene ring · attached through O", "Anillo 2: Anillo bencénico · unido por O"],
    ["Ring 2: Phenoxy group · ring + O", "Anillo 2: Grupo fenoxi · anillo + O"],
    ["Ring 2: 4-(Trifluoromethyl)phenoxy fragment · ring + O + CF3", "Anillo 2: Fragmento 4-(trifluorometil)fenoxi · anillo + O + CF3"],
  ];
  for (const [language,index] of [["en",0],["es",1]]) {
    const reasoning = buildStructuralPriorityReasoning({ derivation, language });
    const ringStep = reasoning.steps.find(step => step.componentKind === "ringSystem");
    const ringControls = [ringStep.fragments, ...(ringStep.fragments.additionalFragments ?? [])];
    assert.deepEqual(ringControls.map(fragment => fragment.text).sort(), expectedLabels.slice(0,2).map(pair=>pair[index]).sort());
    const phenoxyStep = reasoning.steps.find(step => step.componentKind === "phenoxy fragment");
    const substitutedStep = reasoning.steps.find(step => step.componentKind === "substituted phenoxy fragment");
    assert.equal(phenoxyStep.fragments.text, expectedLabels[2][index]);
    assert.equal(substitutedStep.fragments.text, expectedLabels[3][index]);
    assert.match(ringStep.explanation, /C–C|C-C/);
    assert.match(ringStep.explanation, /O/);
  }
});

test("composable motif recognition generalizes across functional and aromatic families", () => {
  const examples = [
    ["ethanol", "CCO", { hydroxyl: 1, "ether linkage": 0 }],
    ["anisole", "COc1ccccc1", { ringSystem: 1, "methoxy fragment": 1, "ether linkage": 1 }],
    ["phenethylamine", "NCCc1ccccc1", { ringSystem: 1, "amine fragment": 1, "benzyl fragment": 1 }],
    ["biphenyl", "c1ccccc1-c1ccccc1", { ringSystem: 2 }],
    ["diphenyl ether", "c1ccc(Oc2ccccc2)cc1", { ringSystem: 2, "phenoxy fragment": 2, "ether linkage": 1 }],
    ["benzyl alcohol", "OCc1ccccc1", { ringSystem: 1, hydroxyl: 1, "benzyl fragment": 1 }],
    ["dopamine", "NCCc1ccc(O)c(O)c1", { ringSystem: 1, hydroxyl: 2, "amine fragment": 1 }],
    ["2-hydroxybutanedioic acid", "O=C(O)C(O)CC(=O)O", { carboxylicAcid: 2, hydroxyl: 1 }],
    ["carvone", "CC1=CC(=O)C(=CC1)C(C)C", { ringSystem: 1, carbonyl: 1 }],
    ["ibuprofen", "CC(C)Cc1ccc(cc1)C(C)C(=O)O", { ringSystem: 1, carboxylicAcid: 1 }],
    ["fluoxetine", "CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F", { ringSystem: 2, "phenoxy fragment": 1,
      "substituted phenoxy fragment": 1, "trifluoromethyl group": 1, "amine fragment": 1, "ether linkage": 1,
      "fragment connection": 3, "candidate carbon skeleton": 1 }],
  ];
  for (const [label, smiles, expected] of examples) {
    const molecule = graph(smiles), model = deriveStructuralComponents(molecule, `${label}: unverified external name`);
    for (const [kind,count] of Object.entries(expected)) assert.equal(model.components.filter(c=>c.kind===kind).length,count,`${label}: ${kind}`);
    assert.equal(model.status, "PARTIAL", `${label}: structural motifs do not promote a complete name`);
    for (const component of model.components) {
      assert.ok(component.atomIds.every(id => molecule.atoms.some(atom => atom.id === id)), `${label}: atom provenance`);
      assert.ok(component.bondIds.every(([a,b]) => molecule.bonds.some(([x,y]) => x===a&&y===b || x===b&&y===a)), `${label}: bond provenance`);
    }
  }
  const negative = deriveStructuralComponents(graph("COC(F)(F)F"), "trifluoromethoxy test");
  assert.equal(negative.components.filter(c=>c.kind==="trifluoromethyl group").length,0,
    "a CF3 carbon attached through oxygen is not mislabeled as a carbon-bound trifluoromethyl group");
  const amide = deriveStructuralComponents(graph("CC(=O)N"), "acetamide test");
  assert.equal(amide.components.filter(c=>c.kind==="amine fragment").length,0,
    "an amide nitrogen is not classified as an amine");
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
