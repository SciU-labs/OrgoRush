import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  const loadRingTemplate ="), source.indexOf("  const newMolecule ="));
const js = ts.transpileModule(handler + "\nreturn loadRingTemplate;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function setup({ attach = false, succeeds = true, muted = false } = {}) {
  const sounds = [];
  const molecule = { atoms: [{ id: 1 }], rings: [] };
  const names = ["ringInsertMode", "selectedId", "isPristineInitialMolecule", "molecule", "isCarbonAtom", "getAtomValenceViolation", "attachRingToMolecule", "commit", "playSound", "cloneMolecule", "setPlacementTool", "previousSelectedId", "setSelectedId", "setRingInsertMode", "setShowRingPalette", "setShowAlkylPalette", "setShowFunctionalPalette"];
  const noop = () => {};
  const values = [attach ? "attach" : "replace", 1, false, molecule, () => true, () => null, () => ({ molecule, attachmentId: 1 }), () => succeeds, event => { if (!muted) sounds.push(event); }, x => x, noop, { current: null }, noop, noop, noop, noop, noop];
  const run = new Function(...names, js)(...values);
  run({ label: "benzene", size: 1, molecule: { atoms: [{ id: 1 }], rings: [{ atomIds: [1] }] } });
  return sounds;
}
test("ring replacement and attachment emit exactly one successful sound", () => {
  assert.deepEqual(setup(), ["atom"]);
  assert.deepEqual(setup({ attach: true }), ["bond"]);
});
test("failed commits and mute prevent successful audible feedback", () => {
  assert.deepEqual(setup({ succeeds: false }), []);
  assert.deepEqual(setup({ attach: true, succeeds: false }), []);
  assert.deepEqual(setup({ muted: true }), []);
});

