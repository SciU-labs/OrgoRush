import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import test from "node:test";
import ts from "typescript";
import { parseDiagnostics } from "../scripts/quality-010-diagnostics.mjs";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { inspectDoubleBondStereochemistry } from "../app/double-bond-stereochemistry.ts";
import { calculateMolecule2DLayout } from "../app/molecule-2d-layout.ts";

const root = resolve(import.meta.dirname, "..");
const configFile = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
assert.equal(configFile.error, undefined);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const textOf = path => readFileSync(resolve(root, path), "utf8");
const format = diagnostics => ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => "\n",
});

test("QUALITY-010 inventories all original errors and keeps complete tsc messages", () => {
  const baseline = JSON.parse(textOf("reports/orgorush-quality-010.baseline.json"));
  assert.equal(baseline.activeDiagnostics, 49);
  assert.equal(baseline.totalDiagnostics, 473);
  assert.equal(baseline.archivedDiagnostics, 424);
  assert.equal(baseline.inventory.length, 49);
  assert.ok(baseline.inventory.every(item => item.cause && item.category && item.proposedSolution && item.dependency));
  assert.ok(baseline.inventory.find(item => item.code === "TS2769").message.includes("Overload 2"));
  assert.deepEqual(parseDiagnostics("file.ts(2,3): error TS1234: first\n  continuation\nnext.ts(4,5): error TS2345: second\n"), [
    { file: "file.ts", line: 2, column: 3, code: "TS1234", message: "first\n  continuation" },
    { file: "next.ts", line: 4, column: 5, code: "TS2345", message: "second" },
  ]);
});

test("QUALITY-010 checks every tracked TS source, including both build configurations, under strict mode", { timeout: 240000 }, () => {
  assert.equal(config.options.strict, true);
  for (const flag of ["strictNullChecks", "noImplicitAny", "strictFunctionTypes", "strictBindCallApply",
    "strictPropertyInitialization", "alwaysStrict", "useUnknownInCatchVariables"])
    assert.notEqual(config.options[flag], false, `strict must continue to enable ${flag}`);
  assert.equal(config.options.noEmit, true);
  assert.equal(config.options.target, ts.ScriptTarget.ES2020);
  assert.deepEqual(config.errors, []);
  const inputs = new Set(config.fileNames.map(file => relative(root, file).replaceAll("\\", "/")));
  const tracked = execFileSync("git", ["ls-files", "--", "*.ts", "*.tsx", "*.mts"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  for (const path of [...tracked, "worker/env.ts", "worker/cloudflare.d.ts", "tests/types/quality-010-contracts.ts"])
    assert.ok(inputs.has(path), `TypeScript must cover ${path}`);
  for (const path of ["vite.config.ts", "vite.pages.config.ts", "build/sites-vite-plugin.ts", "pages-src/main.tsx", "app/page.tsx", "db/index.ts", "worker/index.ts"])
    assert.ok(inputs.has(path), path);
  assert.ok([...inputs].every(path => !path.startsWith("outputs/")), "archived source copies are not current application inputs");
  const program = ts.createProgram(config.fileNames, { ...config.options, incremental: false });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, format(diagnostics));

  // Negative compile: require real errors for malformed tokens, unsupported
  // bond orders, and invalid D1 arguments. No compiler suppression directives.
  const virtual = resolve(root, "tests/types/quality-010-negative.ts").replaceAll("\\", "/");
  const source = `
import type { CondensedToken } from "../../app/condensed-layout.ts";
import type { ReadonlyStereoMolecule } from "../../app/double-bond-stereochemistry.ts";
import type { WorkerEnv } from "../../worker/env.ts";
const wrongText: Extract<CondensedToken, { type: "branch-open" }> = { type: "branch-open", text: ")", x: 0, y: 0, width: 1, branchDepth: 0 };
const wrongOrder: ReadonlyStereoMolecule = { atoms: [], bonds: [[1, 2, 4]] };
declare const env: WorkerEnv;
env.DB.prepare(123);
`;
  const host = ts.createCompilerHost(config.options);
  const originalRead = host.readFile.bind(host), originalExists = host.fileExists.bind(host);
  host.readFile = path => path.replaceAll("\\", "/") === virtual ? source : originalRead(path);
  host.fileExists = path => path.replaceAll("\\", "/") === virtual || originalExists(path);
  const originalSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, ...rest) => path.replaceAll("\\", "/") === virtual
    ? ts.createSourceFile(path, source, languageVersion, true)
    : originalSourceFile(path, languageVersion, ...rest);
  const negative = ts.createProgram([...config.fileNames, virtual], { ...config.options, incremental: false }, host, program);
  const errors = ts.getPreEmitDiagnostics(negative);
  assert.equal(errors.length, 3, format(errors));
  assert.ok(errors.every(error => error.file?.fileName === virtual), format(errors));
  assert.deepEqual(errors.map(error => error.code), [2322, 2322, 2345]);
});

test("QUALITY-010 readonly graph consumers preserve E/Z, coordinates, metadata and SMILES", () => {
  for (const smiles of ["CC/C=C/CC", "CC/C=C\\CC"]) {
    const imported = moleculeFromSmiles(smiles);
    assert.equal(imported.ok, true);
    const molecule = imported.molecule;
    const before = JSON.stringify(molecule), exported = moleculeToSmiles(molecule);
    assert.equal(exported.ok, true);
    for (const atom of molecule.atoms) Object.freeze(atom);
    for (const bond of molecule.bonds) Object.freeze(bond);
    Object.freeze(molecule.atoms); Object.freeze(molecule.bonds); Object.freeze(molecule);
    const [left, right] = molecule.bonds.find(([, , order]) => order === 2);
    const stereo = inspectDoubleBondStereochemistry(molecule, left, right);
    assert.equal(stereo.stereogenic, true);
    assert.ok(stereo.configuration);
    for (const view of ["skeletal", "semi-developed"]) {
      const positions = calculateMolecule2DLayout(molecule, [1, 2, 3, 4, 5, 6], view);
      const displayed = { ...molecule, atoms: molecule.atoms.map(atom => ({ ...atom, ...positions.get(atom.id) })) };
      assert.equal(inspectDoubleBondStereochemistry(displayed, left, right).configuration, stereo.configuration);
    }
    assert.equal(JSON.stringify(molecule), before);
    assert.deepEqual(moleculeToSmiles(molecule), exported);
  }
});
