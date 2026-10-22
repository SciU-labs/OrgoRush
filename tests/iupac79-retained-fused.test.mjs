import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import ts from "typescript";
import { CanonizerUtil, Molecule, SmilesParser } from "openchemlib";
import { recognizeRingTopology } from "../app/fused-topology.ts";
import { nameRetainedFused1979 } from "../app/iupac1979-retained-fused.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { translateSpanishIupacForDisplay, localizeChemicalNameForDisplay } from "../app/iupac-name-normalization.ts";
import { readChemistryDocument } from "../app/chemistry-document-validation.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/iupac79-fused.json", import.meta.url))).cases;
const parser = (smiles) => { const m = new SmilesParser().parseMolecule(smiles); m.ensureHelperArrays(Molecule.cHelperCIP); return m; };
const identity = (smiles) => CanonizerUtil.getIDCode(parser(smiles), CanonizerUtil.NORMAL);
function rawGraph(smiles) {
  const m = parser(smiles);
  return { atoms: Array.from({ length: m.getAllAtoms() }, (_, i) => ({ id: i + 1, element: m.getAtomLabel(i), x: m.getAtomX(i), y: m.getAtomY(i) })),
    bonds: Array.from({ length: m.getAllBonds() }, (_, i) => [m.getBondAtom(0, i) + 1, m.getBondAtom(1, i) + 1, m.getBondOrder(i)]) };
}
function permute(graph, seed) {
  const ids = graph.atoms.map((a) => a.id), remap = new Map(ids.map((id, i) => [id, (ids.length - i) * 31 + seed]));
  return { atoms: graph.atoms.map((a) => ({ ...a, id: remap.get(a.id), x: -a.y + seed, y: -a.x - seed })).reverse(),
    bonds: graph.bonds.map(([a, b, order]) => [remap.get(b), remap.get(a), order]).reverse() };
}
const numberingSignature = (graph, result) => graph.bonds.filter(([a, b]) => result.locants.has(a) && result.locants.has(b))
  .map(([a, b]) => [result.locants.get(a), result.locants.get(b)].sort().join("-")).sort();

for (const f of fixtures) test(`1979 fixture ${f.id}: ${f.status}`, () => {
  assert.ok(f.rule && f.justification);
  const graph = rawGraph(f.smiles), before = structuredClone(graph), result = nameRetainedFused1979(graph);
  if (f.route === "von-baeyer") {
    assert.equal(result.status, "UNSUPPORTED", "retained naming does not impersonate von Baeyer");
    assert.equal(result.topology.kind, "ortho-fused");
  } else if (f.status === "PASS") {
    assert.equal(result.status, "SUPPORTED", result.reason);
    assert.equal(result.nameEs, f.es); assert.equal(result.nameEn, f.en);
    assert.equal(parser(f.smiles).getMolecularFormula().formula, f.formula);
    assert.equal(result.locants.size, result.atomIds.length);
    assert.equal(new Set(result.locants.values()).size, result.locants.size);
    assert.equal(translateSpanishIupacForDisplay(f.es), f.en);
    assert.equal(localizeChemicalNameForDisplay(f.en, "es"), f.es);
    for (const candidate of [permute(graph, 17), permute(graph, 71), ...(f.equivalent ? [rawGraph(f.equivalent)] : [])]) {
      if (f.equivalent) assert.equal(identity(f.equivalent), identity(f.smiles), `${f.id}: independent SMILES constitution`);
      const other = nameRetainedFused1979(candidate);
      assert.equal(other.status, "SUPPORTED", other.reason);
      assert.equal(other.nameEs, f.es); assert.equal(other.nameEn, f.en);
      assert.deepEqual(numberingSignature(candidate, other), numberingSignature(graph, result));
    }
  } else {
    assert.equal(result.status, "UNSUPPORTED"); assert.equal(result.topology.kind, f.topology);
    assert.equal("nameEs" in result, false); assert.ok(result.reason);
  }
  assert.deepEqual(graph, before, "recognition does not mutate the editor graph");
});

test("invalid graphs, fusion-site overvalence, charges and stereo never acquire retained names", () => {
  const graph = rawGraph(fixtures[0].smiles), r = nameRetainedFused1979(graph);
  const fusionAtom = [...r.locants].find(([, locant]) => locant === "4a")[0];
  const changes = [
    (g) => { g.atoms.push({ ...g.atoms[0] }); },
    (g) => { g.bonds.push([...g.bonds[0]]); },
    (g) => { g.bonds.push([g.atoms[0].id, 9999, 1]); },
    (g) => { g.bonds.push([fusionAtom, fusionAtom, 1]); },
    (g) => { g.atoms.push({ id: 90, x: 0, y: 0 }); g.bonds.push([fusionAtom, 90, 1]); },
    (g) => { g.atoms[0].charge = 1; },
    (g) => { g.atoms[0].tetrahedralParity = "R"; },
    (g) => { g.bonds[0][3] = true; },
    (g) => { g.atoms.push({ id: 90, x: 0, y: 0 }); },
  ];
  for (const change of changes) {
    const g = structuredClone(graph); change(g);
    assert.equal(nameRetainedFused1979(g).status, "UNSUPPORTED");
  }
  assert.equal(nameRetainedFused1979(rawGraph("c1ccc2[nH]ccc2c1")).reason, "heterocyclic-parent");
});

test("numbered constitutional adjacency follows the figures, including exceptional parents", () => {
  const result = (id) => { const r = nameRetainedFused1979(rawGraph(fixtures.find((f) => f.id === id).smiles)); assert.equal(r.status, "SUPPORTED"); return r; };
  for (const [id, locants] of [
    ["naphthalene", ["4a", "8a"]], ["anthracene", ["4a", "8a", "9a", "10a"]],
    ["phenanthrene", ["4a", "4b", "8a", "10a"]], ["fluorene", ["4a", "4b", "8a", "9a"]],
    ["indene", ["3a", "7a"]], ["azulene", ["3a", "8a"]],
  ]) assert.deepEqual([...result(id).locants.values()].filter((l) => /[a-z]/.test(l)).sort(), locants.sort());
  for (const [id, locant] of [["indene", "1"], ["fluorene", "9"]]) {
    const g = rawGraph(fixtures.find((f) => f.id === id).smiles), r = result(id);
    const atom = [...r.locants].find(([, l]) => l === locant)[0];
    assert.equal(g.bonds.reduce((sum, [a, b, o]) => sum + (a === atom || b === atom ? o : 0), 0), 2, "correct indicated-hydrogen site");
  }
});

let chemistry, engine;
before(async () => { chemistry = await loadExerciseChemistry(); engine = chemistry.engine; });
after(async () => chemistry?.close());

for (const f of fixtures.filter((f) => f.status === "PASS")) test(`integrated ES/EN profiles, SMILES and explanation: ${f.id}`, () => {
  const imported = moleculeFromSmiles(f.smiles); assert.equal(imported.ok, true, imported.error);
  const molecule = imported.molecule, before = structuredClone(molecule);
  for (const graph of [molecule, { ...molecule, rings: undefined }, { ...permute(molecule, 43), rings: [] }]) {
    if (f.route && !graph.rings?.length) continue; // existing aliphatic recognizer still requires ring metadata
    for (const convention of ["blue-book-2013", "iupac-1979-legacy"]) {
      const analysis = engine.analyzeMolecule(graph, [], convention);
      assert.equal(analysis.name, f.es);
      assert.equal(engine.localNamerCannotSafelyName(graph, analysis), false);
      assert.equal(engine.externalCandidateNeedsNeutralLocalName(graph, analysis), false,
        "the actual name dock must not suppress a verified halogen prefix");
      assert.equal(applyNomenclatureConvention(engine.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es"), f.es);
      assert.equal(generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(graph, analysis)).name, f.en);
      if (!f.route) assert.deepEqual([...engine.displayedAtomLocants(analysis)], [...analysis.retainedFused.locants]);
      for (const [language, displayedName] of [["es", f.es], ["en", f.en]]) {
        const model = engine.buildActiveIupacReasoning({ molecule: graph, analyses: { current: analysis, legacy: analysis }, language,
          convention: language === "es" ? "iupac-1979-es" : "iupac-1979-legacy-en", displayedName, canHighlight: true });
        assertReasoningIntegrity(model, graph);
        assert.ok(model.steps.some((s) => /1979|bridgeheads|cabezas de puente/.test(s.explanation)));
      }
    }
  }
  const exported = moleculeToSmiles(molecule); assert.equal(exported.ok, true, exported.error);
  assert.equal(identity(exported.smiles), identity(f.smiles));
  assert.equal(engine.analyzeMolecule(moleculeFromSmiles(exported.smiles).molecule).name, f.es);
  assert.deepEqual(molecule, before);
});

test("unsupported fused aromatic functional and peri parents cannot fall through to an invented chain name", () => {
  for (const f of [{smiles:"Oc1ccc2cc(O)ccc2c1"},{smiles:"c1ccc2c(c1)C(=O)CC2"}]) {
    const graph = rawGraph(f.smiles), analysis = engine.analyzeMolecule(graph);
    assert.equal(analysis.retainedFused.status, "UNSUPPORTED");
    assert.equal(engine.localNamerCannotSafelyName(graph, analysis), true);
    assert.equal(generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(graph, analysis)).name, "-");
    assert.equal(engine.legacySpanishFormatterInput(analysis, "naftaleno"), "-");
    const misleadingMetadata = { ...graph, rings: recognizeRingTopology(graph).cycles.map((atomIds, i) => ({ id: i + 1, kind: "cycloalkane", atomIds })) };
    assert.equal(engine.analyzeMolecule(misleadingMetadata).retainedFused.status, "UNSUPPORTED",
      "aromatic rejection cannot change to an aliphatic von Baeyer name when stored ring flags change");
  }
  const invalid = rawGraph(fixtures[0].smiles);
  const junction = [...nameRetainedFused1979(invalid).locants].find(([, locant]) => locant === "4a")[0];
  invalid.atoms.push({ id: 90, x: 0, y: 0 }); invalid.bonds.push([junction, 90, 1]);
  const analysis = engine.analyzeMolecule(invalid);
  assert.equal(analysis.retainedFused.status, "UNSUPPORTED");
  assert.equal(analysis.retainedFused.topology.kind, "invalid");
  assert.equal(engine.localNamerCannotSafelyName(invalid, analysis), true);
  assert.equal(generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(invalid, analysis)).name, "-");
});

test("real import commit, undo/redo and chemistry document reconstruction retain the name", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function action(name, context) {
    let code;
    function visit(node) { if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name?.getText(ast) === name)
      code = ts.isVariableDeclaration(node) ? `const ${node.getText(ast)};` : node.getText(ast); ts.forEachChild(node, visit); }
    visit(ast); assert.ok(code);
    return new Function("context", `with(context) { ${ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}; return ${name}; }`)(context);
  }
  const start = moleculeFromSmiles("CC").molecule;
  const ctx = { molecule: start, undoStack: [], future: [], undoPristineStates: [], futurePristineStates: [],
    isPristineInitialMolecule: true, viewMode: "skeletal", getCondensedUnavailableReason: () => null,
    findMoleculeValenceViolation: engine.findMoleculeValenceViolation,
    retainValidManualDisplayPlacements: (g) => g };
  ctx.cloneMolecule = action("cloneMolecule", ctx);
  for (const field of ["molecule", "undoStack", "future", "undoPristineStates", "futurePristineStates", "isPristineInitialMolecule"])
    ctx[`set${field[0].toUpperCase()}${field.slice(1)}`] = (v) => { ctx[field] = typeof v === "function" ? v(ctx[field]) : v; };
  for (const name of ["setViewMode", "setPlacementTool", "setReasoningSourceName", "setSourceNameOverride", "setSmilesFeedback", "setNotice", "setSelectedId"]) ctx[name] = () => {};
  for (const f of fixtures.filter((f) => f.status === "PASS" && !f.route)) {
    const molecule = moleculeFromSmiles(f.smiles).molecule;
    action("commit", ctx)(molecule);
    action("undo", { ...ctx })(); action("redo", { ...ctx })();
    assert.deepEqual(ctx.molecule, molecule); assert.equal(engine.analyzeMolecule(ctx.molecule).name, f.es);
    const structure = { molecule: ctx.molecule, name: f.es, formula: f.formula, family: "polycyclic", viewMode: "skeletal", atomCount: molecule.atoms.length, createdAt: "today", updatedAt: "today" };
    const restored = readChemistryDocument(JSON.parse(JSON.stringify({ format: "laboratorio-quimica-organica", version: 1, kind: "structure", structure })),
      { calculateFormula: () => f.formula, isValenceValid: () => true, isSupportedElement: () => true })[0];
    assert.equal(engine.analyzeMolecule(restored.molecule).name, f.es);
    assert.equal(recognizeRingTopology(restored.molecule).kind, f.topology ?? "ortho-fused");
  }
});
