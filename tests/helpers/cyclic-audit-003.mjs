import assert from "node:assert/strict";
import { Molecule, SmilesParser, CanonizerUtil } from "openchemlib";
import { moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { recognizeRingTopology } from "../../app/fused-topology.ts";
import { applyNomenclatureConvention } from "../../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../../app/legacy-english-nomenclature.ts";
import { CYCLIC_REFERENCES, GENERATED_CYCLIC_REFERENCES, graphFromCyclicReference } from "../fixtures/iupac79-cyclic-audit-003.mjs";

export function validatedCyclicCases() {
  const identities = new Map();
  for (const ref of [...CYCLIC_REFERENCES, ...GENERATED_CYCLIC_REFERENCES]) {
    const graph = graphFromCyclicReference(ref), ids = new Set(graph.atoms.map(a => a.id));
    assert.equal(ids.size, graph.atoms.length, `${ref.id}: unique atom IDs`);
    assert(graph.atoms.every(a => Number.isSafeInteger(a.id)), `${ref.id}: integer atom IDs`);
    const edges = new Set(), adjacency = new Map([...ids].map(id => [id, []]));
    for (const [a, b, o] of graph.bonds) {
      assert(ids.has(a) && ids.has(b) && a !== b && [1, 2, 3].includes(o), ref.id);
      const key = [a, b].sort((x, y) => x - y).join(":"); assert(!edges.has(key), ref.id); edges.add(key);
      adjacency.get(a).push(b); adjacency.get(b).push(a);
    }
    const seen = new Set(), pending = [graph.atoms[0].id];
    while (pending.length) { const id = pending.pop(); if (!seen.has(id)) { seen.add(id); pending.push(...adjacency.get(id)); } }
    assert.equal(seen.size, ids.size, ref.id);
    const maxValence = { C: 4, N: 3, O: 2, S: 6, F: 1, Cl: 1, Br: 1, I: 1 };
    for (const atom of graph.atoms) {
      const valence = graph.bonds.reduce((sum, [a, b, o]) => sum + (a === atom.id || b === atom.id ? o : 0), 0);
      assert(valence <= maxValence[atom.element ?? "C"] && !(atom.charge ?? 0), ref.id);
    }
    const exported = moleculeToSmiles(graph); assert(exported.ok, ref.id);
    const independent = new SmilesParser().parseMolecule(exported.smiles); independent.ensureHelperArrays(Molecule.cHelperCIP);
    assert.equal(independent.getMolecularFormula().formula, ref.formula, ref.id);
    assert.equal(independent.getAllBonds() - independent.getAllAtoms() + 1, graph.bonds.length - ids.size + 1, ref.id);
    const identity = CanonizerUtil.getIDCode(independent, CanonizerUtil.NORMAL);
    assert.equal(recognizeRingTopology(graph).kind, ref.expectedTopology, `${ref.id}: topology`);
    if (ref.hamiltonian === false) {
      const start = graph.atoms[0].id;
      const search = path => path.length === ids.size ? adjacency.get(path.at(-1)).includes(start)
        : adjacency.get(path.at(-1)).some(next => !path.includes(next) && search([...path, next]));
      assert.equal(search([start]), false, `${ref.id}: independently exhaust Hamiltonian boundaries`);
    }
    if (identities.has(identity)) {
      const existing = identities.get(identity); assert.equal(existing.es, ref.es, ref.id); assert.equal(existing.en, ref.en, ref.id);
      existing.aliases.push(ref.id); continue;
    }
    identities.set(identity, { ...ref, graph, identity, smiles: exported.smiles, aliases: [], cycleRank: graph.bonds.length - ids.size + 1, topology: recognizeRingTopology(graph).kind });
  }
  return [...identities.values()];
}

export function cyclicVariants(graph) {
  const reindex = new Map(graph.atoms.map((a, i) => [a.id, 1000 + 17 * (graph.atoms.length - i)]));
  return [
    ["stored", graph],
    ["no-ring-metadata", { ...graph, rings: undefined }],
    ["rotated", { ...graph, atoms: graph.atoms.map(a => ({ ...a, x: -a.y + 31, y: a.x - 17 })) }],
    ["reindexed-reflected", {      
atoms: graph.atoms.map(a => ({ ...a, id: reindex.get(a.id), x: -a.x + 73, y: a.y + 91 })).reverse(),
      bonds: graph.bonds.map(([a, b, ...tail]) => [reindex.get(b), reindex.get(a), ...tail]).reverse(), rings: undefined    
}],
    ["stale-ring-metadata", { ...graph, rings: [{ id: 99, kind: "aromatic", atomIds: [-1, -2, -3] }] }],
  ];
}

export function observeCyclicCase(engine, graph) {
  try {
    const analysis = engine.analyzeMolecule(graph, [], "iupac-1979-legacy");
    const rawEs = applyNomenclatureConvention(engine.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es");
    const rawEn = generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(graph, analysis)).name;
    const unavailable = engine.legacyLocalNameIsUnavailable
      ? engine.legacyLocalNameIsUnavailable(graph, analysis)
      : engine.externalCandidateNeedsNeutralLocalName(graph, engine.analyzeMolecule(graph));
    return {      
analysis: analysis.name, rawEs, rawEn, es: unavailable ? "-" : rawEs,
      en: unavailable || !engine.legacyEnglishProfileIsSupportedForMolecule(graph) ? "-" : rawEn    
};
  } catch (error) { return { es: "ERROR", en: "ERROR", error: String(error) }; }
}

export function auditCyclicCases(engine) {
  return validatedCyclicCases().map(({ graph, ...ref }) => {
    const variants = cyclicVariants(graph).map(([variant, input]) => {
      const actual = observeCyclicCase(engine, input);
      const status = language => [ref[language], ...(ref.alternatives?.[language] ?? [])].includes(actual[language])
        ? "PASS" : actual[language] === "-" ? "UNSUPPORTED" : "FAIL";
      const esStatus = status("es"), enStatus = status("en");
      return { variant, ...actual, esStatus, enStatus, status: [esStatus, enStatus].includes("FAIL") ? "FAIL" : esStatus === enStatus && esStatus === "PASS" ? "PASS" : "UNSUPPORTED" };
    });
    return { ...ref, graph, variants, status: variants.some(v => v.status === "FAIL") ? "FAIL" : variants.every(v => v.status === "PASS") ? "PASS" : "UNSUPPORTED" };
  });
}

export function cyclicCounts(rows) {
  return Object.fromEntries(["A", "B", "C", "D", "E", "F", "G"].map(family => {
    const group = rows.filter(r => r.family === family);
    return [family, Object.fromEntries(["PASS", "FAIL", "UNSUPPORTED"].map(status => [status, group.filter(r => r.status === status).length]))];
  }));
}
