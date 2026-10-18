import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Molecule as OCLMolecule, SmilesParser } from "openchemlib";

import { inspectSmilesStructure, moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { readSmilesFileRecord } from "../app/smiles-file.ts";

const isotopeCases = [
  ["[13CH3]CO", 6, 13],
  ["[13C]", 6, 13],
  ["C[2H]", 1, 2],
  ["C[3H]", 1, 3],
  ["[15NH2]C", 7, 15],
  ["C[18O]", 8, 18],
  // Explicit labels for the most abundant isotopes are still isotope identity.
  ["[12CH3]CO", 6, 12],
  ["C[1H]", 1, 1],
  ["C[16O]", 8, 16],
  ["[13CH2]1CCCCC1", 6, 13],
  ["C[C@H]([2H])O", 1, 2],
];

function parse(smiles) {
  const molecule = new SmilesParser().parseMolecule(smiles);
  molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
  return molecule;
}

function assertIsotopeRejection(result) {
  assert.equal(result.ok, false);
  assert.match(result.error, /isótopos explícitos/);
  assert.match(result.error, /No se importó.*identidad química/);
  assert.equal(Object.hasOwn(result, "molecule"), false, "no degraded editable graph is returned");
}

for (const [smiles, atomicNumber, mass] of isotopeCases) {
  test(`${smiles}: valid isotope input is explicitly rejected before editable conversion`, () => {
    const parsed = parse(smiles);
    assert.ok(Array.from({ length: parsed.getAllAtoms() }, (_, i) => i).some(
      (i) => parsed.getAtomicNo(i) === atomicNumber && parsed.getAtomMass(i) === mass,
    ), "the actual parser preserves the isotope, including explicit isotope hydrogens");
    assertIsotopeRejection(moleculeFromSmiles(smiles));
    assertIsotopeRejection(inspectSmilesStructure(smiles));
  });
}

for (const smiles of [
  "CCO", "OCC", "C1CCCCC1", "C%10CCCCC%10", "[H]C", "[CH3]CO",
  "C[N+](=O)[O-]", "c1ccccc1", "C#CCO", "C/C=C/C", "C/C=C\\C", "C[C@H](O)F",
]) {
  test(`${smiles}: ordinary atoms, ring labels, hydrogen counts and supported properties round trip`, () => {
    const original = parse(smiles);
    for (let i = 0; i < original.getAllAtoms(); i += 1) assert.equal(original.getAtomMass(i), 0);
    const imported = moleculeFromSmiles(smiles);
    assert.equal(imported.ok, true, imported.error);
    const exported = moleculeToSmiles(imported.molecule);
    assert.equal(exported.ok, true, exported.error);
    const restored = parse(exported.smiles);
    assert.equal(restored.getIDCode(), original.getIDCode(), "connectivity, charges and specified stereo retain full identity");
    assert.equal(restored.getMolecularFormula().formula, original.getMolecularFormula().formula);
    assert.equal(moleculeFromSmiles(exported.smiles).ok, true);
    assert.equal(inspectSmilesStructure(smiles).ok, true);
    if (smiles.includes("[N+]")) {
      assert.deepEqual(imported.molecule.atoms.filter((atom) => atom.charge).map((atom) => atom.charge).sort(), [-1, 1]);
    }
    if (smiles.includes("@")) assert.equal(imported.molecule.atoms.filter((atom) => atom.tetrahedralParity).length, 1);
    if (smiles.includes("/")) assert.equal(imported.molecule.bonds.filter((bond) => bond[3]).length, 1);
  });
}

test("invalid isotope syntax remains a syntax error, distinct from a valid unsupported isotope", () => {
  const smiles = "[13CH3";
  assert.throws(() => parse(smiles));
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, false);
  assert.match(result.error, /no pudo convertir/);
  assert.doesNotMatch(result.error, /isótopos/);
  assert.equal(Object.hasOwn(result, "molecule"), false);
});

// Execute the real editor actions using the same AST approach as smiles-text-import.
// An unsuccessful conversion must not reach analysis, commit or persistent writes.
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function action(name, context) {
  let source;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) source = `const ${node.getText(ast)};`;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(source, `${name} exists in the editor`);
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("context", `with (context) { ${compiled}; return ${name}; }`)(context);
}

function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child);
  return Object.freeze(value);
}

for (const language of ["es", "en"]) {
  for (const kind of ["text", "file"]) {
    test(`${language}/${kind}: rejected isotopes preserve the current graph, undo/redo and saved data`, async () => {
      const initial = moleculeFromSmiles("C/C=C/[C@H](F)C[N+](=O)[O-]");
      assert.equal(initial.ok, true, initial.error);
      assert.ok(initial.molecule.atoms.some((atom) => atom.charge));
      assert.ok(initial.molecule.atoms.some((atom) => atom.tetrahedralParity));
      assert.ok(initial.molecule.bonds.some((bond) => bond[3]));
      const state = freeze({
        molecule: initial.molecule,
        undoStack: [structuredClone(initial.molecule)], future: [structuredClone(initial.molecule)],
        undoPristineStates: [true], futurePristineStates: [false], isPristineInitialMolecule: false,
        savedEntries: [{ id: "existing", molecule: structuredClone(initial.molecule) }],
        storedDocument: JSON.stringify(initial.molecule),
      });
      const snapshot = structuredClone(state);
      const calls = [];
      const unexpected = (name) => () => { calls.push(name); throw new Error(`Unexpected ${name}`); };
      const context = {
        ...state, language, moleculeFromSmiles, readSmilesFileRecord,
        setSmilesFeedback: (feedback) => { context.smilesFeedback = feedback; },
        setSmilesImporting: (busy) => { context.smilesImporting = busy; },
        commit: unexpected("commit"), analyzeMolecule: unexpected("analysis"),
        fetch: unexpected("network write"),
        window: { localStorage: { setItem: unexpected("storage write") } },
      };
      for (const key of Object.keys(state)) {
        context[`set${key[0].toUpperCase()}${key.slice(1)}`] = unexpected(`set ${key}`);
      }
      context.importSmilesString = action("importSmilesString", context);
      const importFile = action("importSmilesDocument", context);
      for (const [smiles] of isotopeCases) {
        if (kind === "text") context.importSmilesString(smiles, { kind: "text" });
        else {
          const input = { value: "selected.smi", files: [{ name: "isotope.smi", size: 100, text: async () => `${smiles} isotope\n` }] };
          await importFile({ currentTarget: input });
          assert.equal(input.value, "");
          assert.equal(context.smilesImporting, false);
        }
        assert.equal(context.smilesFeedback.kind, "error");
        assert.match(context.smilesFeedback.message.source, /isótopos explícitos.*No se importó/);
        assert.deepEqual(calls, [], "no analysis, commit, state replacement or persistence is reached");
        for (const key of Object.keys(state)) {
          assert.strictEqual(context[key], state[key], key);
          assert.deepEqual(context[key], snapshot[key], key);
        }
      }
    });
  }
}
