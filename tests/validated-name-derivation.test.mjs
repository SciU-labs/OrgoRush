import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectSmilesStructure, moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { presentValidatedSystematicName, reconcileSystematicName, validatedNameTargets } from "../app/validated-name-derivation.ts";
import { classifyValidatedStructureColors, structuralBondKey } from "../app/structural-color-classification.ts";
import { resolveDerivationConsistency } from "../app/derivation-consistency.ts";
import { verifiedStructuralReasoning } from "../app/verified-structural-reasoning.ts";
import { parentStructureSelectionReasoning } from "../app/reasoning-parent-selection.ts";
import { resolveChemicalName } from "../app/name-structure-resolver.ts";

const imported = s => { const r = moleculeFromSmiles(s); assert.equal(r.ok,true,r.error); return r.molecule; };
const sorted = xs => [...xs].sort((a,b) => a-b);
const fixtures = [
  { name: "2-[4-(2-methylpropyl)phenyl]propanoic acid", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", group: "carboxylicAcid",
    regions: { parent: [11,12,13], suffix: [13,14,15], aryl: [1,2,3,4,5,6,7,8,9,10], "aryl-prefix": [1,2,3,4] },
    locants: [[13,1],[11,2],[12,3]], branchLocant: 2 },
  { name: "N-(4-hydroxyphenyl)acetamide", smiles: "CC(=O)Nc1ccc(O)cc1", group: "amide",
    regions: { parent: [1,2,4], suffix: [2,3,4], aryl: [5,6,7,8,9,10,11], "aryl-prefix": [9] },
    locants: [[2,1],[1,2]], branchLocant: "N" },
  { name: "2-(acetyloxy)benzoic acid", smiles: "CC(=O)Oc1ccccc1C(=O)O", group: "carboxylicAcid",
    regions: { parent: [5,6,7,8,9,10,11], suffix: [11,12,13], acyloxy: [1,2,3,4] },
    locants: [[10,1],[5,2]], branchLocant: 2 },
];
for (const f of fixtures) test(`FULL exact name, parent, nested components and colours: ${f.name}`, () => {
  const graph = imported(f.smiles), model = reconcileSystematicName(graph,f.name);
  assert.equal(model?.status,"FULL"); assert.equal(model.principalGroup,f.group); assert.equal(model.preferred,false);
  const targets = validatedNameTargets(model);
  for (const c of model.components) {
    assert.deepEqual(sorted(c.atomIds),f.regions[c.id]);
    assert.equal(f.name.slice(c.start,c.end),c.text);
    assert.deepEqual(targets[c.id].atomIds,c.atomIds);
    assert.deepEqual(targets[c.id].bondIds,c.bondIds);
    for (const [a,b] of c.bondIds) assert.ok(graph.bonds.some(([x,y]) => x===a && y===b || x===b && y===a));
  }
  assert.deepEqual(model.components.find(c=>c.id==='parent').numbering,f.locants);
  assert.equal(model.components.find(c=>c.role==='substituent').locant,f.branchLocant);
  if (f.regions.aryl) {
    assert.deepEqual(model.components.find(c=>c.id==='aryl').numbering,
      f.group==='amide' ? [[5,1],[8,4]] : [[8,1],[5,4]]);
    assert.equal(model.components.find(c=>c.id==='aryl-prefix').locant,4);
    assert.equal(model.components.find(c=>c.id==='aryl-prefix').parentId,'aryl');
  }
  const ids = new Map(graph.atoms.map(a=>[a.id, 1000+a.id*11]));
  const permuted = { atoms:graph.atoms.map(a=>({...a,id:ids.get(a.id)})).reverse(),
    bonds:graph.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse() };
  const remapped = reconcileSystematicName(permuted,f.name);
  assert.equal(remapped?.status,'FULL');
  for (const c of remapped.components) assert.deepEqual(sorted(c.atomIds),sorted(f.regions[c.id].map(id=>ids.get(id))));
  assert.equal(reconcileSystematicName(graph,f.name.replace(/4-/, '3-')+' unsupported suffix'),null);
});
const multiArylCases = [
  { name: "N-(3,4-dimethylphenyl)acetamide", smiles: "CC(=O)Nc1cc(C)c(C)cc1", group: "amide", locants: [3, 4], prefixes: ["aryl-prefix"] },
  { name: "N-(3-hydroxy-4-methylphenyl)acetamide", smiles: "CC(=O)Nc1cc(O)c(C)cc1", group: "amide", locants: [3, 4], prefixes: ["aryl-prefix-3", "aryl-prefix-4"] },
  { name: "2-(3,4-dimethylphenyl)propanoic acid", smiles: "CC(C(=O)O)c1cc(C)c(C)cc1", group: "carboxylicAcid", locants: [3, 4], prefixes: ["aryl-prefix"] },
  { name: "N-(2,4-dimethylphenyl)acetamide", smiles: "CC(=O)Nc1c(C)cc(C)cc1", group: "amide", locants: [2, 4], prefixes: ["aryl-prefix"] },
  { name: "N-(3-hydroxy-4-(2-methylpropyl)phenyl)acetamide", smiles: "CC(=O)Nc1cc(O)c(CC(C)C)cc1", group: "amide", locants: [3, 4], prefixes: ["aryl-prefix-3", "aryl-prefix-4"] },
  { name: "N-(3-methyl-4-(2-methylpropyl)phenyl)acetamide", smiles: "CC(=O)Nc1cc(C)c(CC(C)C)cc1", group: "amide", locants: [3, 4], prefixes: ["aryl-prefix-3", "aryl-prefix-4"] },
  { name: "N-(2-hydroxy-6-methylphenyl)acetamide", smiles: "CC(=O)Nc1c(O)cccc1C", group: "amide", locants: [2, 6], prefixes: ["aryl-prefix-2", "aryl-prefix-6"] },
];
for (const f of multiArylCases) test(`FULL proves two phenyl substituents and complete component links: ${f.name}`, () => {
  const graph = imported(f.smiles), model = reconcileSystematicName(graph, f.name);
  assert.equal(model?.status, "FULL");
  assert.equal(model.principalGroup, f.group);
  const components = Object.fromEntries(model.components.map(component => [component.id, component]));
  const aryl = components.aryl;
  assert.equal(aryl.text.match(/phenyl$/)?.[0], "phenyl");
  assert.deepEqual(aryl.numbering.map(([, locant]) => locant), [1, ...f.locants]);
  for (const component of model.components) {
    assert.ok(component.explanation.trim(), `${component.id} has an English explanation`);
    assert.ok(component.explanationEs?.trim(), `${component.id} has a Spanish explanation`);
  }
  assert.deepEqual(f.prefixes, model.components.filter(component => component.parentId === "aryl").map(component => component.id));
  for (const id of ["parent", "suffix", "aryl", ...f.prefixes]) {
    const component = components[id];
    assert.ok(component, `component ${id} exists`);
    assert.equal(f.name.slice(component.start, component.end), component.text);
    assert.ok(component.atomIds.length > 0);
    const target = validatedNameTargets(model)[id];
    assert.deepEqual(target.atomIds, component.atomIds);
    assert.deepEqual(target.bondIds, component.bondIds);
    for (const [a, b] of component.bondIds) assert.ok(graph.bonds.some(([x, y]) => x === a && y === b || x === b && y === a));
  }
  const colors = classifyValidatedStructureColors(graph, model);
  assert.ok([...colors.atoms.values()].every(category => category !== "unclassified"));
  assert.ok([...colors.bonds.values()].every(category => category !== "unclassified"));
  const attachment = aryl.bondIds.find(([a, b]) => components.parent.atomIds.includes(a) !== components.parent.atomIds.includes(b));
  assert.ok(attachment, "parent-to-phenyl attachment is part of the aryl component");
  const prefixAtoms = new Set(f.prefixes.flatMap(id => components[id].atomIds));
  const ringAtoms = new Set(aryl.atomIds.filter(id => !prefixAtoms.has(id)));
  for (const prefixId of f.prefixes) {
    const prefix = components[prefixId];
    assert.equal(prefix.parentId, "aryl");
    const prefixAtomIds = new Set(prefix.atomIds);
    const joins = prefix.bondIds.filter(([a, b]) => prefixAtomIds.has(a) !== prefixAtomIds.has(b));
    assert.equal(joins.length, prefix.numbering.length, "each named locant has its own phenyl attachment bond");
    assert.ok(joins.every(([a, b]) => ringAtoms.has(prefixAtomIds.has(a) ? b : a)), "prefix joins terminate at phenyl atoms");
    assert.ok(prefix.bondIds.length >= prefix.atomIds.length, "internal and phenyl attachment bonds are mapped");
  }
  if (f.name.includes("dimethyl")) {
    const methyl = components["aryl-prefix"];
    assert.equal(methyl.atomIds.length, 2);
    assert.deepEqual(methyl.numbering.map(([, locant]) => locant), f.locants);
    assert.equal(new Set(methyl.atomIds).size, 2);
  }
  if (f.name.includes("hydroxy-4-methyl")) {
    assert.equal(reconcileSystematicName(graph, "N-(4-hydroxy-3-methylphenyl)acetamide"), null,
      "the exchanged hydroxy/methyl isomer does not match the graph");
  }
  if (f.name === "N-(2,4-dimethylphenyl)acetamide") {
    assert.equal(reconcileSystematicName(graph, "N-(3,4-dimethylphenyl)acetamide"), null,
      "the 2,4 positional isomer is not confused with the 3,4 isomer");
  }
  const idMap = new Map(graph.atoms.map(atom => [atom.id, atom.id * 19 + 700]));
  const permuted = { atoms: graph.atoms.map(atom => ({ ...atom, id: idMap.get(atom.id) })).reverse(),
    bonds: graph.bonds.map(([a, b, order, stereo]) => [idMap.get(b), idMap.get(a), order, stereo]).reverse() };
  const remapped = reconcileSystematicName(permuted, f.name);
  assert.equal(remapped?.status, "FULL", "ID and import ordering do not decide classification");
  assert.deepEqual(remapped.components.map(component => component.id), model.components.map(component => component.id));
});
test("multi-substituted phenyl grammar rejects unsupported, incomplete, wrong-locant and stale-graph claims", () => {
  const graph = imported(multiArylCases[1].smiles);
  for (const invalid of [
    "N-(3-hydroxy-4-methylphenyl)acetamide-extra",
    "N-(3-hydroxy-4-methylphenylacetamide",
    "N-(3-hydroxyphenyl)acetamide",
    "N-(3-hydroxy-4-methyl-5-methylphenyl)acetamide",
    "N-(3-chloro-4-methylphenyl)acetamide",
    "N-(3,4,5-trimethylphenyl)acetamide",
    "N-(2,3,4-dimethylphenyl)acetamide",
    "N-(3-hydroxy-3-methylphenyl)acetamide",
    "N-(4-hydroxy-5-methylphenyl)acetamide",
  ]) assert.equal(reconcileSystematicName(graph, invalid), null, invalid);
  assert.equal(reconcileSystematicName(imported("CC(=O)Nc1c(O)cccc1C"),
    "N-(2-methyl-6-hydroxyphenyl)acetamide"), null, "equal locant sets use alphabetical prefix tie-breaking");
  const stereochemical = imported("C[C@H](C(=O)O)c1cc(C)c(C)cc1");
  assert.equal(reconcileSystematicName(stereochemical, multiArylCases[2].name), null,
    "explicit stereochemistry is not discarded by the achiral grammar");
  const edited = imported(multiArylCases[0].smiles);
  assert.equal(reconcileSystematicName(edited, multiArylCases[0].name)?.status, "FULL");
  edited.atoms.pop();
  assert.equal(reconcileSystematicName(edited, multiArylCases[0].name), null,
    "editing a graph invalidates its earlier cached FULL proof");
});
test("equivalent multi-substituted phenyl SMILES retain the same connectivity and locants", () => {
  const name = multiArylCases[2].name;
  const smiles = ["CC(C(=O)O)c1cc(C)c(C)cc1", "CC(C(=O)O)c1cc(C)c(cc1)C"];
  const inspected = smiles.map(value => inspectSmilesStructure(value));
  assert.ok(inspected.every(result => result.ok));
  assert.equal(inspected[0].canonicalConnectivity, inspected[1].canonicalConnectivity);
  const models = smiles.map(value => reconcileSystematicName(imported(value), name));
  for (const model of models) {
    assert.equal(model?.status, "FULL");
    assert.deepEqual(model.components.find(component => component.id === "aryl").numbering.map(([, locant]) => locant), [1, 3, 4]);
    assert.deepEqual(presentValidatedSystematicName(model, "es"), { name, language: "en", localized: false },
      "new multi-prefix name stays in its verified source language until safe localization exists");
  }
});
test("ibuprofen FULL derivation explains parent selection and all components in ES without changing chemistry", () => {
  const f = fixtures[0], graph = imported(f.smiles), graphBefore = structuredClone(graph);
  const model = reconcileSystematicName(graph, f.name);
  assert.equal(model?.status, "FULL");
  assert.equal(model.name, "2-[4-(2-methylpropyl)phenyl]propanoic acid");
  const components = Object.fromEntries(model.components.map(component => [component.id, component]));
  const chemistrySnapshot = model.components.map(({ id, text, start, end, atomIds, bondIds, numbering, locant, parentId }) =>
    ({ id, text, start, end, atomIds, bondIds, numbering, locant, parentId }));
  assert.match(components.parent.explanation, /3-carbon acyclic chain/);
  assert.match(components.parent.explanation, /carboxyl carbon is C1/);
  assert.match(components.parent.explanation, /principal characteristic group/);
  assert.match(components.parent.explanation, /P-59\.2\.1\.2/);
  assert.match(components.parent.explanation, /phenyl ring is cited as a substituent/);
  assert.match(components.parent.explanationEs, /cadena acíclica de 3 carbonos/);
  assert.match(components.parent.explanationEs, /C1/);
  assert.match(components.parent.explanationEs, /función principal/);
  assert.match(components.parent.explanationEs, /P-59\.2\.1\.2/);
  assert.match(components.parent.explanationEs, /anillo fenilo.*sustituyente/);
  assert.match(components.suffix.explanationEs, /carboxilo.*función principal.*oic acid/);
  assert.match(components.suffix.explanation, /carboxyl group.*acid suffix/);
  assert.match(components.aryl.explanationEs, /fenilo.*C1.*localizador 2.*C4/);
  assert.match(components.aryl.explanation, /phenyl substituent attaches at 2.*ring position 1.*ring position 4/);
  assert.match(components["aryl-prefix"].explanationEs, /2-methylpropyl.*3 carbonos.*1 carbono.*C2.*C4/);
  assert.match(components["aryl-prefix"].explanation, /2-methylpropyl.*3 carbons.*1-carbon branch at C2.*ring position 4/);
  for (const id of ["parent", "suffix", "aryl", "aryl-prefix"]) {
    assert.ok(components[id].explanationEs?.trim(), `${id} has a Spanish explanation`);
    assert.equal(f.name.slice(components[id].start, components[id].end), components[id].text);
  }
  assert.deepEqual(model.parentAtomIds, [13, 11, 12]);
  assert.deepEqual(components.parent.numbering, f.locants);
  for (const [id, expectedAtomIds] of Object.entries(f.regions)) assert.deepEqual(sorted(components[id].atomIds), expectedAtomIds);
  assert.deepEqual(model.components.map(({ id, text, start, end, atomIds, bondIds, numbering, locant, parentId }) =>
    ({ id, text, start, end, atomIds, bondIds, numbering, locant, parentId })), chemistrySnapshot);
  assert.deepEqual(graph, graphBefore);
});
test("equivalent ibuprofen SMILES share localized presentation, parent rationale, and per-graph atom links", () => {
  const name = fixtures[0].name;
  const smiles = ["CC(C)Cc1ccc(C(C)C(O)=O)cc1", "CC(C)Cc1ccc(cc1)C(C)C(=O)O"];
  const inspected = smiles.map(value => inspectSmilesStructure(value));
  assert.ok(inspected.every(result => result.ok));
  assert.equal(inspected[0].canonicalConnectivity, inspected[1].canonicalConnectivity);
  const models = smiles.map(value => reconcileSystematicName(imported(value), name));
  for (const model of models) {
    assert.equal(model?.status, "FULL");
    const presentationEs = presentValidatedSystematicName(model, "es");
    assert.deepEqual(presentationEs, {
      name: "ácido 2-[4-(2-metilpropil)fenil]propanoico", language: "es", localized: true,
    });
    assert.deepEqual(presentValidatedSystematicName(model, "en"), { name, language: "en", localized: false });
    const parent = model.components.find(component => component.id === "parent");
    assert.match(parent.explanation, /P-59\.2\.1\.2/);
    assert.match(parent.explanationEs, /P-59\.2\.1\.2/);
    assert.match(parent.explanationEs, /cadena acíclica de 3 carbonos/);
    for (const component of model.components) {
      assert.equal(name.slice(component.start, component.end), component.text);
      const target = validatedNameTargets(model)[component.id];
      assert.deepEqual(target.atomIds, component.atomIds);
      assert.deepEqual(target.bondIds, component.bondIds);
    }
  }
  assert.equal(models[0].components.map(component => component.id).join(","), models[1].components.map(component => component.id).join(","));
  assert.deepEqual(models[0].components.find(component => component.id === "parent").numbering.map(([, locant]) => locant), [1, 2, 3]);
  assert.deepEqual(models[1].components.find(component => component.id === "parent").numbering.map(([, locant]) => locant), [1, 2, 3]);
});
test("FULL structural colors include suffix heteroatoms and nested substituents, independent of IDs", () => {
  for (const f of [fixtures[0], fixtures[1]]) {
    const molecule = imported(f.smiles), moleculeBefore = structuredClone(molecule);
    const model = reconcileSystematicName(molecule, f.name);
    assert.equal(model?.status, "FULL");
    const modelBefore = structuredClone(model);
    const colors = classifyValidatedStructureColors(molecule, model);
    const parentComponents = model.components.filter(component => component.id === "parent" || component.id === "suffix");
    const substituentComponents = model.components.filter(component => component.id !== "parent" && component.id !== "suffix");
    const parentAtoms = new Set(parentComponents.flatMap(component => component.atomIds));
    const substituentAtoms = new Set(substituentComponents.flatMap(component => component.atomIds));
    const parentBonds = new Set(parentComponents.flatMap(component => component.bondIds.map(([a, b]) => structuralBondKey(a, b))));
    const substituentBonds = new Set(substituentComponents.flatMap(component => component.bondIds.map(([a, b]) => structuralBondKey(a, b))));
    for (const atom of molecule.atoms) {
      assert.equal(colors.atoms.get(atom.id), parentAtoms.has(atom.id) ? "parent" : substituentAtoms.has(atom.id) ? "substituent" : "unclassified");
    }
    for (const [a, b] of molecule.bonds) {
      const key = structuralBondKey(a, b);
      assert.equal(colors.bonds.get(key), parentBonds.has(key) ? "parent" : substituentBonds.has(key) ? "substituent" : "unclassified");
    }
    if (f === fixtures[1]) {
      const aryl = model.components.find(component => component.id === "aryl");
      const attachment = aryl.bondIds.find(([a, b]) => parentAtoms.has(a) !== parentAtoms.has(b));
      assert.ok(attachment, "N–phenyl parent-to-substituent bond is explicitly assigned");
      assert.equal(colors.bonds.get(structuralBondKey(...attachment)), "substituent");
      const hydroxy = model.components.find(component => component.id === "aryl-prefix");
      assert.equal(hydroxy.atomIds.length, 1);
      assert.equal(colors.atoms.get(hydroxy.atomIds[0]), "substituent");
      assert.ok(hydroxy.bondIds.some(([a, b]) => colors.bonds.get(structuralBondKey(a, b)) === "substituent"));
      const amideNitrogen = model.components.find(component => component.id === "parent").atomIds.find(id => molecule.atoms.find(atom => atom.id === id)?.element === "N");
      assert.equal(colors.atoms.get(amideNitrogen), "parent");
      const carbonylO = model.components.find(component => component.id === "suffix").atomIds.find(id => molecule.atoms.find(atom => atom.id === id)?.element === "O");
      assert.equal(colors.atoms.get(carbonylO), "parent");
      for (const [a, b] of model.components.find(component => component.id === "suffix").bondIds) {
        assert.equal(colors.bonds.get(structuralBondKey(a, b)), "parent", "amide carbonyl/N bonds retain parent colour");
      }
    } else {
      const carbonylO = model.components.find(component => component.id === "suffix").atomIds.find(id => molecule.atoms.find(atom => atom.id === id)?.element === "O");
      assert.equal(colors.atoms.get(carbonylO), "parent");
      const alkyl = model.components.find(component => component.id === "aryl-prefix");
      assert.ok(alkyl.atomIds.every(id => colors.atoms.get(id) === "substituent"));
    }

    const remap = new Map(molecule.atoms.map(atom => [atom.id, atom.id * 17 + 500]));
    const remappedMolecule = { atoms: molecule.atoms.map(atom => ({ ...atom, id: remap.get(atom.id) })).reverse(),
      bonds: molecule.bonds.map(([a, b, order, stereo]) => [remap.get(b), remap.get(a), order, stereo]).reverse() };
    const remappedModel = { ...model, name: "unused for classification",
      parentAtomIds: model.parentAtomIds.map(id => remap.get(id)),
      components: model.components.map(component => ({ ...component,
        atomIds: component.atomIds.map(id => remap.get(id)),
        bondIds: component.bondIds.map(([a, b]) => [remap.get(a), remap.get(b)]),
        numbering: component.numbering.map(([id, locant]) => [remap.get(id), locant]),
      })) };
    const remappedColors = classifyValidatedStructureColors(remappedMolecule, remappedModel);
    for (const [oldId, newId] of remap) assert.equal(remappedColors.atoms.get(newId), colors.atoms.get(oldId));
    for (const [a, b] of molecule.bonds) assert.equal(
      remappedColors.bonds.get(structuralBondKey(remap.get(a), remap.get(b))), colors.bonds.get(structuralBondKey(a, b)));
    assert.equal(classifyValidatedStructureColors(molecule, null), null);
    assert.deepEqual(molecule, moleculeBefore);
    assert.deepEqual(model, modelBefore);
  }
});
test("active-name verification preserves FULL evidence only for its compatible Current presentation", () => {
  for (const f of [fixtures[0], fixtures[1], fixtures[2]]) {
    const molecule = imported(f.smiles);
    const result = resolveDerivationConsistency({ molecule, activeName: f.name, activeProfile: "current", language: "en", currentSourceName: f.name });
    assert.equal(result.status, "verified");
    assert.equal(result.derivation?.name, f.name);
    const spanishName = presentValidatedSystematicName(result.derivation, "es").name;
    const localized = resolveDerivationConsistency({ molecule, activeName: spanishName, activeProfile: "current", language: "es", currentSourceName: f.name });
    assert.equal(localized.status, "verified");
    assert.equal(localized.derivation?.name, f.name, "localized display reuses the original structurally verified name");
    assert.ok(classifyValidatedStructureColors(molecule, localized.derivation), "phase 2 colors remain active for a compatible FULL proof");
  }

  const smiles = ["CC(C)Cc1ccc(C(C)C(O)=O)cc1", "CC(C)Cc1ccc(cc1)C(C)C(=O)O"];
  assert.equal(inspectSmilesStructure(smiles[0]).canonicalConnectivity, inspectSmilesStructure(smiles[1]).canonicalConnectivity);
  const equivalentResults = smiles.map(value => resolveDerivationConsistency({
    molecule: imported(value), activeName: fixtures[0].name, activeProfile: "current", language: "en", currentSourceName: fixtures[0].name,
  }));
  assert.deepEqual(equivalentResults.map(result => result.status), ["verified", "verified"]);
  assert.deepEqual(equivalentResults.map(result => result.derivation.components.find(component => component.id === "parent").numbering.map(([, locant]) => locant)),
    [[1, 2, 3], [1, 2, 3]]);

  const ibuprofen = imported(fixtures[0].smiles);
  const legacy = resolveDerivationConsistency({ molecule: ibuprofen, activeName: "ácido 2-(4-isobutilfenil)propanoico",
    activeProfile: "legacy", language: "es", currentSourceName: fixtures[0].name });
  assert.equal(legacy.status, "profile-mismatch");
  assert.equal(legacy.derivation, null, "Current evidence must not be exposed as the Legacy derivation");
  assert.equal(legacy.otherEvidence?.name, fixtures[0].name);
  const unsupported = resolveDerivationConsistency({ molecule: ibuprofen, activeName: "nombre no compatible",
    activeProfile: "current", language: "es" });
  assert.equal(unsupported.status, "unverified");
  assert.equal(unsupported.derivation, null);
});
test("FULL N-substituted phenyl amides localize compositionally and reuse only Current evidence", () => {
  const cases = [
    ["N-(4-hydroxyphenyl)acetamide", "CC(=O)Nc1ccc(O)cc1", "N-(4-hidroxifenil)acetamida"],
    ["N-(3-hydroxy-4-methylphenyl)acetamide", "CC(=O)Nc1cc(O)c(C)cc1", "N-(3-hidroxi-4-metilfenil)acetamida"],
    ["N-(3,4-dimethylphenyl)acetamide", "CC(=O)Nc1cc(C)c(C)cc1", "N-(3,4-dimetilfenil)acetamida"],
  ];
  for (const [english, smiles, spanish] of cases) {
    const molecule = imported(smiles), derivation = reconcileSystematicName(molecule, english);
    assert.equal(derivation?.status, "FULL", english);
    assert.deepEqual(presentValidatedSystematicName(derivation, "es"), { name: spanish, language: "es", localized: true });
    const current = resolveDerivationConsistency({ molecule, activeName: spanish, activeProfile: "current", language: "es", currentSourceName: english });
    assert.equal(current.status, "verified", spanish);
    assert.equal(current.derivation?.name, english);
    const legacy = resolveDerivationConsistency({ molecule, activeName: spanish, activeProfile: "legacy", language: "es", currentSourceName: english });
    assert.equal(legacy.status, "profile-mismatch", "localized Current proof is not reused for Legacy");
    assert.equal(legacy.derivation, null);
  }
  const acid = reconcileSystematicName(imported(fixtures[0].smiles), fixtures[0].name);
  assert.equal(presentValidatedSystematicName(acid, "es").name, "ácido 2-[4-(2-metilpropil)fenil]propanoico");
});
test("consistency remains unverified for explicit stereo and after graph edits", () => {
  const stereoName = `(2R)-${fixtures[0].name}`;
  const stereoMolecule = imported("CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O");
  assert.ok(stereoMolecule.atoms.some(atom => atom.tetrahedralParity), "explicit stereochemistry remains on the graph");
  const stereo = resolveDerivationConsistency({ molecule: stereoMolecule, activeName: stereoName,
    activeProfile: "current", language: "en", currentSourceName: stereoName });
  assert.equal(stereo.status, "unverified", "an unsupported FULL grammar is not a chemical conflict");
  assert.equal(stereo.derivation, null);

  const molecule = imported(fixtures[0].smiles);
  const initiallyVerified = resolveDerivationConsistency({ molecule, activeName: fixtures[0].name,
    activeProfile: "current", language: "en", currentSourceName: fixtures[0].name });
  assert.equal(initiallyVerified.status, "verified");
  molecule.bonds.pop();
  const afterEdit = resolveDerivationConsistency({ molecule, activeName: fixtures[0].name,
    activeProfile: "current", language: "en", currentSourceName: fixtures[0].name });
  assert.equal(afterEdit.status, "unverified", "changed connectivity cannot reuse the earlier FULL result");
  assert.equal(afterEdit.derivation, null);
});
test("FULL structural explanations cover cyclic parents, nested groups and N attachment in ES and EN", () => {
  const cases = [
    { fixture: fixtures[0], es: /estructura acíclica.*anillo.*sustituyente.*P-59\.2\.1\.2/s, en: /acyclic.*ring.*substituent.*P-59\.2\.1\.2/s },
    { fixture: fixtures[1], es: /nitrógeno.*unión directa.*P-66\.1\.1\.3\.1\.1/s, en: /nitrogen.*direct attachment.*P-66\.1\.1\.3\.1\.1/s },
    { fixture: fixtures[2], es: /benzoic acid.*fuera del anillo.*carbonilo.*distinto/s, en: /benzoic acid.*outside the aromatic ring.*distinct/s },
  ];
  for (const { fixture, es, en } of cases) {
    const molecule = imported(fixture.smiles);
    const verified = resolveDerivationConsistency({ molecule, activeName: fixture.name, activeProfile: "current", language: "en", currentSourceName: fixture.name });
    assert.equal(verified.status, "verified");
    for (const [language, expected] of [["es", es], ["en", en]]) {
      const items = verifiedStructuralReasoning({ molecule, derivation: verified.derivation,
        consistency: verified.status, activeProfile: "current", language });
      assert.ok(items.length >= 1);
      if (fixture === fixtures[1]) {
        assert.match(items.find(item => item.id === "full-parent-selection").text, /acetamide|acetamida/);
        assert.match(items.find(item => item.id === "full-amide-n-substitution").text, expected);
      } else assert.match(items.find(item => item.id === "full-parent-selection").text, expected);
      for (const item of items) {
        assert.ok(item.atomIds.every(id => molecule.atoms.some(atom => atom.id === id)));
        assert.ok(item.bondIds.every(([a, b]) => molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a)));
      }
      if (fixture === fixtures[0]) {
        assert.match(items.find(item => item.id.startsWith("full-substituent-")).text, /2-methylpropyl|2-metilpropil/);
        assert.match(items.find(item => item.id.startsWith("full-substituent-")).text, /P-59\.2\.1\.8/);
      }
      if (fixture === fixtures[2]) assert.doesNotMatch(items.find(item => item.id === "full-parent-selection").text, /P-59\.2\.1\.8/);
    }
  }
});
test("structural explanations require compatible FULL evidence and ignore IDs and coordinates", () => {
  const molecule = imported(fixtures[0].smiles);
  const model = reconcileSystematicName(molecule, fixtures[0].name);
  const full = verifiedStructuralReasoning({ molecule, derivation: model, consistency: "verified", activeProfile: "current", language: "es" });
  assert.ok(full.length);
  assert.deepEqual(verifiedStructuralReasoning({ molecule, derivation: model, consistency: "profile-mismatch", activeProfile: "legacy", language: "es" }), []);
  assert.deepEqual(verifiedStructuralReasoning({ molecule, derivation: null, consistency: "unverified", activeProfile: "current", language: "es" }), []);

  const remap = new Map(molecule.atoms.map(atom => [atom.id, atom.id * 23 + 701]));
  const remappedMolecule = { atoms: molecule.atoms.map(atom => ({ ...atom, id: remap.get(atom.id), x: atom.x + 87, y: atom.y - 41 })).reverse(),
    bonds: molecule.bonds.map(([a, b, order, stereo]) => [remap.get(b), remap.get(a), order, stereo]).reverse(),
    rings: molecule.rings?.map(ring => ({ ...ring, atomIds: ring.atomIds.map(id => remap.get(id)) })) };
  const remappedModel = { ...model, parentAtomIds: model.parentAtomIds.map(id => remap.get(id)),
    components: model.components.map(component => ({ ...component,
      atomIds: component.atomIds.map(id => remap.get(id)),
      bondIds: component.bondIds.map(([a, b]) => [remap.get(a), remap.get(b)]),
      numbering: component.numbering.map(([id, locant]) => [remap.get(id), locant]),
    })) };
  const remapped = verifiedStructuralReasoning({ molecule: remappedMolecule, derivation: remappedModel,
    consistency: "verified", activeProfile: "current", language: "es" });
  assert.deepEqual(remapped.map(item => item.text), full.map(item => item.text));
  for (let index = 0; index < full.length; index += 1) {
    assert.deepEqual(remapped[index].atomIds.sort((a, b) => a - b), full[index].atomIds.map(id => remap.get(id)).sort((a, b) => a - b));
  }
});
test("general cyclic parent guidance uses cyclic acid/aldehyde criteria and limits PIN claims", () => {
  const makeAnalysis = (smiles, group) => {
    const molecule = imported(smiles), ring = molecule.rings.find(item => item.kind === "cycloalkane");
    const center = molecule.atoms.find(atom => atom.element === "C" && molecule.bonds.some(([a, b, order]) =>
      (a === atom.id || b === atom.id) && (order ?? 1) === 2
      && molecule.atoms.find(other => other.id === (a === atom.id ? b : a))?.element === "O"));
    const familyName = group === "carboxylicAcid" ? "ciclohexanocarboxílico" : "ciclohexanocarbaldehído";
    const analysis = { family: "cycloalkane", mainChain: ring.atomIds, chainName: familyName,
      primaryFunctionalGroup: group, functionalGroups: [{ kind: group, carbonId: center.id }],
      numberedAtoms: new Map(ring.atomIds.map((id, index) => [id, index + 1])) };
    return { molecule, analysis };
  };
  const acid = makeAnalysis("O=C(O)C1CCCCC1", "carboxylicAcid");
  const acidEs = parentStructureSelectionReasoning(acid.molecule, acid.analysis, "es");
  assert.match(acidEs, /P-65\.1\.2\.2\.2/);
  assert.match(acidEs, /fuera del anillo/);
  assert.doesNotMatch(acidEs, /P-59\.2\.1\.8/);
  const aldehyde = makeAnalysis("O=CC1CCCCC1", "aldehyde");
  const aldehydeEn = parentStructureSelectionReasoning(aldehyde.molecule, aldehyde.analysis, "en");
  assert.match(aldehydeEn, /P-66\.6\.1\.1\.3/);
  assert.match(aldehydeEn, /remains outside the ring/);

  const hydrocarbon = imported("CCc1ccccc1"), aromaticRing = hydrocarbon.rings.find(item => item.kind === "aromatic");
  const general = parentStructureSelectionReasoning(hydrocarbon, { family: "aromatic", mainChain: aromaticRing.atomIds,
    chainName: "benzene", functionalGroups: [], numberedAtoms: new Map(aromaticRing.atomIds.map((id, index) => [id, index + 1])) }, "en");
  assert.match(general, /P-44\.1\.2\.2 and P-52\.2\.8/);
  assert.match(general, /does not establish that it is the PIN/);
  assert.deepEqual(verifiedStructuralReasoning({ molecule: hydrocarbon, derivation: null, consistency: "unverified",
    activeProfile: "current", language: "en" }), [], "unsupported hydrocarbons receive no new FULL claim");
});
test('exact attachment edges distinguish nested and principal functions',()=>{
  const ib = reconcileSystematicName(imported(fixtures[0].smiles),fixtures[0].name);
  assert.ok(ib.components.find(c=>c.id==='aryl').bondIds.some(([a,b])=>a===11&&b===8));
  assert.ok(ib.components.find(c=>c.id==='aryl-prefix').bondIds.some(([a,b])=>a===5&&b===4));
  const asp = reconcileSystematicName(imported(fixtures[2].smiles),fixtures[2].name);
  assert.deepEqual(asp.components.find(c=>c.id==='acyloxy').bondIds.map(sorted).sort(),[[1,2],[2,3],[2,4],[4,5]]);
});
test('positional isomers must match the parsed locant, not a familiar name',()=>{
  const para=imported(fixtures[1].smiles);
  assert.equal(reconcileSystematicName(para,'N-(3-hydroxyphenyl)acetamide'),null);
  assert.equal(reconcileSystematicName(para,'N-(2-hydroxyphenyl)acetamide'),null);
  assert.equal(reconcileSystematicName(para,'N-(4-hidroxiphenyl)acetamide'),null);
  const meta=imported('CC(=O)Nc1cccc(O)c1');
  assert.equal(reconcileSystematicName(meta,'N-(3-hydroxyphenyl)acetamide')?.status,'FULL');
  assert.equal(reconcileSystematicName(meta,fixtures[1].name),null);
  assert.equal(reconcileSystematicName(imported(fixtures[2].smiles),'3-(acetyloxy)benzoic acid'),null);
});
test('equivalent SMILES reconcile; unspecified and explicit stereo are not conflated',()=>{
  assert.equal(reconcileSystematicName(imported('O=C(O)c1ccccc1OC(C)=O'),fixtures[2].name)?.status,'FULL');
  assert.equal(reconcileSystematicName(imported('CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O'),fixtures[0].name),null);
  assert.equal(reconcileSystematicName(imported(fixtures[0].smiles),'(2R)-'+fixtures[0].name),null);
  assert.equal(reconcileSystematicName(imported('CCO'),'ethanol'),null);
  assert.equal(reconcileSystematicName(imported(fixtures[0].smiles),'ibuprofen'),null);
});
test('single acyloxy prefix supports paired or omitted parentheses with literal spans',()=>{
  const graph=imported(fixtures[2].smiles);
  for(const name of ['2-acetyloxybenzoic acid','2-(acetyloxy)benzoic acid']) {
    const model=reconcileSystematicName(graph,name);
    assert.equal(model?.status,'FULL');
    assert.deepEqual(sorted(model.components.find(c=>c.id==='acyloxy').atomIds),[1,2,3,4]);
    for(const c of model.components)assert.equal(name.slice(c.start,c.end),c.text);
  }
  for(const name of ['2-(acetyloxybenzoic acid','2-acetyloxy)benzoic acid','2-((acetyloxy))benzoic acid','3-acetyloxybenzoic acid','2-acetyloxybenzoic acid extra'])
    assert.equal(reconcileSystematicName(graph,name),null,name);
  const homolog=imported('CCC(=O)Oc1ccccc1C(=O)O');
  assert.equal(reconcileSystematicName(homolog,'2-propanoyloxybenzoic acid')?.status,'FULL');
  assert.equal(reconcileSystematicName(homolog,'2-(propanoyloxy)benzoic acid')?.status,'FULL');
});
test('graph edits and independent molecules cannot reuse stale cached results',()=>{
  const graph=imported(fixtures[2].smiles);
  assert.equal(reconcileSystematicName(graph,fixtures[2].name)?.status,'FULL');
  assert.equal(reconcileSystematicName(imported('CC(=O)Oc1ccccc1C(=O)OC'),fixtures[2].name),null);
  assert.equal(reconcileSystematicName(imported(fixtures[1].smiles),fixtures[2].name),null);
});

// Transport fixtures are deterministic; construction, import and reconciliation
// use production code. These are not live-service or browser assertions.
for (const [i, aliases, cid, formula] of [
  [0,['ibuprofen'],3672,'C13H18O2'],
  [1,['paracetamol','acetaminophen'],1983,'C8H9NO2'],
  [2,['aspirin','acetylsalicylic acid'],2244,'C9H8O4'],
]) for (const alias of aliases) test(`Build by Name resolver → graph → FULL: ${alias}`, async()=>{
  const f=fixtures[i];
  const result=await resolveChemicalName(alias,{fetchImpl:async input=>{
    const url=String(input);
    if (url.includes('/cids/JSON')) return Response.json({IdentifierList:{CID:[cid]}});
    if (url.includes('/property/')) return Response.json({PropertyTable:{Properties:[{CID:cid,IUPACName:f.name,IsomericSMILES:f.smiles,MolecularFormula:formula}]}});
    return new Response('{}',{status:404});
  }});
  assert.equal(result.ok,true);
  assert.equal(result.value.source,'PubChem');
  const model=reconcileSystematicName(imported(result.value.smiles),result.value.iupacName);
  assert.equal(model?.status,'FULL');
  assert.deepEqual(sorted(model.parentAtomIds),f.regions.parent);
});
