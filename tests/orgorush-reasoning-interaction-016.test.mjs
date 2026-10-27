import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { buildReasoningVisualTargets, createReasoningVisualController } from "../app/reasoning-visual-targets.ts";
import { buildCondensedRenderModel } from "../app/condensed-layout.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { observe, project } from "./helpers/reasoning-integrity.mjs";

let chemistry, ui, condensed;
before(async () => {
  chemistry = await loadExerciseChemistry();
  ui = await chemistry.loadModule("/app/reasoning-visual-interaction.tsx");
  condensed = await chemistry.loadModule("/app/condensed-renderer.tsx");
});
after(async () => { await chemistry?.close(); });
const key = (a, b) => [a,b].sort((x,y) => x-y).join(":");
const bondSet = bonds => new Set(bonds.map(([a,b]) => key(a,b)));
function model(smiles, profile = "2013-en") {
  const observed = observe(chemistry.engine, smiles);
  const reasoning = project(chemistry.engine, observed, profile);
  const before = structuredClone({ molecule: observed.molecule, reasoning });
  const targets = buildReasoningVisualTargets({ molecule: observed.molecule, ...reasoning, enabled: true });
  assert.deepEqual({ molecule: observed.molecule, reasoning }, before);
  for (const target of Object.values(targets)) {
    assert.ok(target.atomIds.every(id => observed.molecule.atoms.some(atom => atom.id === id)));
    for (const pair of target.bondIds) assert.ok(bondSet(observed.molecule.bonds).has(key(...pair)));
  }
  return { ...observed, reasoning, targets, role: role => targets[reasoning.steps.find(step => step.nameRole === role)?.number] };
}

test("016 parent keeps the complete selected chain or ring and its real bonds", () => {
  for (const smiles of ["CCCCCC", "C1CCCCC1", "CC1CCCCC1"]) {
    const m = model(smiles), parent = m.role("parent");
    assert.deepEqual(new Set(parent.atomIds), new Set(m.reasoning.analysis.mainChain));
    const expected = m.molecule.bonds.filter(([a,b]) => parent.atomIds.includes(a) && parent.atomIds.includes(b));
    assert.deepEqual(bondSet(parent.bondIds), bondSet(expected));
  }
});

function assertNumbering(m, expectedLocants) {
  const target = m.role("numbering");
  assert.ok(target, "verified numbering is interactive");
  const expected = [...m.reasoning.analysis.numberedAtoms].filter(([,n]) => expectedLocants.includes(n));
  assert.deepEqual(new Set(target.atomIds), new Set(expected.map(([id]) => id)));
  assert.deepEqual(new Map(target.locants), new Map(expected));
  assert.deepEqual(target.bondIds, [], "numbering never paints the connecting chain bonds");
  assert.ok(target.atomIds.length < m.role("parent").atomIds.length);
}

test("016A numbering selects C3 or C2/C4 from verified locants in all four profiles", () => {
  for (const profile of ["2013-es", "2013-en", "1979-es", "1979-en"]) {
    assertNumbering(model("CCC(C)CCC", profile), [3]);
    assertNumbering(model("CC(C)CC(C)CC", profile), [2,4]);
  }
});

test("016A selected principal-function locants exclude the discarded orientation", () => {
  for (const profile of ["2013-es", "2013-en", "1979-es", "1979-en"]) {
    const m = model("CCC(=O)CC(C)CC", profile);
    const step = m.reasoning.steps.find(step => step.nameRole === "numbering");
    assert.deepEqual(step.numberingComparison.selectedLocants, [3]);
    assert.deepEqual(step.numberingComparison.reverseLocants, [5]);
    assertNumbering(m, [3]);
  }
});

test("016A absent, stale or ambiguous numbering evidence never falls back to the whole parent", () => {
  const m = model("CCC(C)CCC");
  const step = m.reasoning.steps.find(step => step.nameRole === "numbering");
  const input = { molecule: m.molecule, analysis: m.reasoning.analysis, enabled: true,
    displayedName: m.reasoning.displayedName, steps: [{ ...step, explanation: "6 carbons; 3 selected, 4 reversed" }], fragments: {} };
  assert.deepEqual(buildReasoningVisualTargets(input), {});
  assert.deepEqual(buildReasoningVisualTargets({ ...input, steps: [{ ...step,
    numberingComparison: { criterion: "principal-function", selectedLocants: [99], reverseLocants: [3], comparison: -1 },
  }], fragments: m.reasoning.fragments }), {});
  const duplicateMap = new Map(m.reasoning.analysis.numberedAtoms);
  duplicateMap.set(m.reasoning.analysis.mainChain[0], 3);
  assert.deepEqual(buildReasoningVisualTargets({ ...input, analysis: { ...input.analysis, numberedAtoms: duplicateMap },
    fragments: m.reasoning.fragments }), {});
});

test("016 methyl and two distinct substituents include the real branches and attachment bonds", () => {
  for (const smiles of ["CCC(C)CCC", "CC(C)CC(C)CC"]) {
    const m = model(smiles), target = m.role("substituent");
    const branches = new Set(m.reasoning.analysis.substituents.flatMap(s => s.atomIds));
    const parent = new Set(m.reasoning.analysis.mainChain);
    const expected = m.molecule.bonds.filter(([a,b]) => branches.has(a) && (branches.has(b) || parent.has(b))
      || branches.has(b) && parent.has(a));
    assert.deepEqual(bondSet(target.bondIds), bondSet(expected));
    assert.ok([...branches].every(id => target.atomIds.includes(id)));
    if (m.reasoning.analysis.substituents.length === 2)
      assert.equal(new Set(m.reasoning.analysis.substituents.map(s => s.locant)).size, 2);
  }
});

test("016 ketone highlights the carbonyl atoms and C=O, not the whole chain", () => {
  const m = model("CCC(=O)CCC"), target = m.role("function");
  const carbonyl = m.molecule.bonds.find(([a,b,order]) => order === 2
    && [a,b].some(id => m.molecule.atoms.find(atom => atom.id === id).element === "O"));
  assert.deepEqual(new Set(target.atomIds), new Set(carbonyl.slice(0,2)));
  assert.deepEqual(bondSet(target.bondIds), bondSet([carbonyl]));
});

test("016 supported N-substituent evidence includes nitrogen and its attachment without guessing a carbon locant", () => {
  const m = model("CC(=O)N(C)C"), target = m.role("substituent");
  assert.ok(target);
  const nitrogen = m.molecule.atoms.find(atom => atom.element === "N");
  assert.ok(target.atomIds.includes(nitrogen.id));
  const carbonyl = m.molecule.bonds.find(([a,b,order]) => order === 2 && [a,b].some(id =>
    m.molecule.atoms.find(atom => atom.id === id).element === "O"));
  assert.ok(!bondSet(target.bondIds).has(key(...carbonyl.slice(0,2))));
  assert.deepEqual(target.locants,[]);
});

test("016 double, triple and E/Z targets come from exact structural evidence", () => {
  for (const [smiles, order] of [["CCC=CCC", 2], ["CCC#CCC", 3], ["C/C=C/C", 2]]) {
    const m = model(smiles), target = m.role("unsaturation");
    const expected = m.molecule.bonds.filter(([, , actual]) => actual === order);
    assert.deepEqual(bondSet(target.bondIds), bondSet(expected));
    if (smiles.includes("/")) assert.deepEqual(bondSet(m.role("stereo").bondIds), bondSet(expected));
  }
});

test("016 2013 and supported Legacy ES/EN resolve semantic roles independently of step number", () => {
  for (const profile of ["2013-es", "2013-en", "1979-es", "1979-en"]) {
    const m = model("CCC(=O)CC(C)CC", profile);
    for (const role of ["function", "parent", "numbering", "substituent"]) assert.ok(m.role(role), `${profile}: ${role}`);
  }
  const m = model("CCC(C)CCC");
  const moved = m.reasoning.steps.map(step => ({ ...step, number: `moved-${step.number}` }));
  const targets = buildReasoningVisualTargets({ molecule: m.molecule, ...m.reasoning, steps: moved, enabled: true });
  assert.deepEqual(targets[`moved-${m.role("parent").stepNumber}`].atomIds, m.role("parent").atomIds);
  assert.ok(m.reasoning.steps.filter(step => !step.nameRole).every(step => !m.targets[step.number]));
});

test("016 atom IDs and storage/visual order never become locants", () => {
  const m = model("CCC(=O)CC(C)CC"), remap = id => 800 - id * 19;
  const variant = { ...m.molecule,
    atoms: m.molecule.atoms.map(atom => ({ ...atom, id: remap(atom.id), x: -atom.x + 14, y: -atom.y })).reverse(),
    bonds: m.molecule.bonds.map(([a,b,...rest]) => [remap(b),remap(a),...rest]).reverse(),
  };
  const analysis = { ...m.reasoning.analysis, mainChain: m.reasoning.analysis.mainChain.map(remap),
    numberedAtoms: new Map([...m.reasoning.analysis.numberedAtoms].map(([id,n]) => [remap(id),n])),
    substituents: m.reasoning.analysis.substituents.map(s => ({ ...s, atomIds: s.atomIds.map(remap) })),
  };
  const targets = buildReasoningVisualTargets({ molecule: variant, analysis,
    steps: m.reasoning.steps.filter(step => ["parent","numbering","substituent"].includes(step.nameRole)), fragments: {}, enabled: true });
  const numbering = targets[m.role("numbering").stepNumber];
  assert.deepEqual(numbering.locants, m.role("numbering").locants.map(([id,n]) => [remap(id),n]));
  assert.ok(numbering.locants.every(([id,n]) => id !== n));
  assert.equal(numbering.atomIds.length,1);
  assert.deepEqual(numbering.bondIds,[]);
});

test("016 unsafe, stale and hidden explanation evidence supplies no button target", () => {
  const m = model("CC(=O)CC");
  assert.deepEqual(buildReasoningVisualTargets({ molecule: m.molecule, ...m.reasoning, enabled: false }), {});
  const step = { number: "arbitrary", nameRole: "stereo" };
  const input = { molecule: m.molecule, analysis: m.reasoning.analysis, steps: [step], enabled: true };
  assert.deepEqual(buildReasoningVisualTargets({ ...input, fragments: {} }), {});
  assert.deepEqual(buildReasoningVisualTargets({ ...input, fragments: { arbitrary: {
    kind: "stereo", text: "irrelevant 01 02 03", label: "unsafe", atomIds: [999], bondIds: [[999,998]],
  } } }), {});
});

test("016 timer expires at exactly 2000 ms and each same/different step press restarts it", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const changes = [], controller = createReasoningVisualController(target => changes.push(target));
  const m = model("CCC(=O)CC(C)CC");
  const a = m.role("parent"), b = m.role("numbering");
  assertNumbering(m,[3]);
  controller.activate(a); context.mock.timers.tick(1999); assert.strictEqual(changes.at(-1), a);
  context.mock.timers.tick(1); assert.equal(changes.at(-1), null);
  controller.activate(a); context.mock.timers.tick(1500); controller.activate(b);
  context.mock.timers.tick(500); assert.strictEqual(changes.at(-1), b);
  context.mock.timers.tick(1499); assert.strictEqual(changes.at(-1), b);
  controller.activate(b); context.mock.timers.tick(1999); assert.strictEqual(changes.at(-1), b);
  context.mock.timers.tick(1); assert.equal(changes.at(-1), null);
  controller.activate(a); controller.dispose(); const count = changes.length;
  context.mock.timers.tick(2000); assert.equal(changes.length, count);
});

// Run the real production hook with a deterministic React scheduling host, as in difficulty-selector tests.
function hookHost() {
  const slots = [], pending = []; let cursor = 0;
  const changed = (a,b) => !a || a.length !== b.length || a.some((item,i) => item !== b[i]);
  const hooks = {
    useState(initial) { const index = cursor++; slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = value; }]; },
    useMemo(fn,deps) { const index = cursor++; if (changed(slots[index]?.deps,deps)) slots[index] = { value: fn(), deps };
      return slots[index].value; },
    useEffect(fn,deps) { const index = cursor++; if (changed(slots[index]?.deps,deps)) pending.push(() => {
      slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
    }); },
  };
  const source = ts.transpileModule(readFileSync(new URL("../app/reasoning-visual-interaction.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} }, require = createRequire(import.meta.url);
  new Function("require","module","exports", source)(id => id === "react" ? hooks
    : id === "./reasoning-visual-targets" ? { createReasoningVisualController } : require(id), module, module.exports);
  return { render(key,graph,enabled = true) { cursor = 0; return module.exports.useReasoningVisualInteraction(key,graph,enabled); },
    flush() { pending.splice(0).forEach(fn => fn()); }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}

test("016 molecule, profile, explanation and visibility changes clear the real hook without editing state", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const graph = { atoms: [{ id: 1 }], bonds: [] }, original = structuredClone(graph);
  const target = { stepNumber: "02", atomIds: [1], bondIds: [], locants: [] };
  const host = hookHost(); let view = host.render("2013|en|explanation-a",graph); host.flush();
  view.activate(target); assert.strictEqual(host.render("2013|en|explanation-a",graph).target,target);
  for (const [key,nextGraph,enabled] of [["1979|en|explanation-a",graph,true], ["1979|en|explanation-b",graph,true],
    ["1979|en|explanation-b",structuredClone(graph),true], ["1979|en|explanation-b",graph,false]]) {
    view = host.render(key,nextGraph,enabled); assert.equal(view.target,null); host.flush();
    view.activate(target); host.render(key,nextGraph,enabled);
  }
  host.unmount(); context.mock.timers.tick(2000); assert.deepEqual(graph, original);
});

test("016 native step buttons expose accessible keyboard activation; unsafe steps remain text", () => {
  const m = model("CCC(C)CCC"), target = m.role("parent"), calls = [];
  for (const language of ["es","en"]) {
    const button = ui.ReasoningStepNumber({ number: target.stepNumber, title: "Parent", language, target,
      active: false, onActivate: value => calls.push(value) });
    assert.equal(button.type,"button"); assert.equal(button.props.type,"button");
    assert.ok(button.props["aria-label"].includes(language === "en" ? "two seconds" : "dos segundos"));
    assert.equal(button.props.tabIndex,undefined); assert.equal(button.props.onKeyDown,undefined);
    // Native button semantics provide both Enter and Space without custom key interception.
    button.props.onClick(); assert.strictEqual(calls.at(-1),target);
    assert.match(renderToStaticMarkup(button), /aria-pressed="false"/);
  }
  assert.equal(ui.ReasoningStepNumber({ number: "05", title: "Unmapped", language: "en", active: false,
    onActivate: () => assert.fail("no unsafe activation") }).type,"span");
});

test("016 overlays cover real SVG regions in skeletal, semi-developed and condensed views and stay out of exports", () => {
  const m = model("CCC(=O)CC(C)CC"), target = m.role("numbering");
  assertNumbering(m,[3]);
  const positions = new Map(m.molecule.atoms.map(atom => [atom.id,{ x: atom.x*50,y: atom.y*50 }]));
  for (const semiDeveloped of [false,true]) {
    const html = renderToStaticMarkup(React.createElement(ui.ReasoningVisualOverlay, { target, positions, semiDeveloped, showLocants: true }));
    assert.equal((html.match(/data-reasoning-atom=/g) ?? []).length,target.atomIds.length);
    assert.equal((html.match(/data-reasoning-bond=/g) ?? []).length,target.bondIds.length);
    assert.equal((html.match(/data-reasoning-locant=/g) ?? []).length,target.locants.length);
    assert.equal(target.locants.length,1);
    assert.match(html,/>3<\/text>/);
    assert.doesNotMatch(html,/>[124567]<\/text>/);
    assert.match(html,/data-editor-only="true"/); assert.match(html,/pointer-events="none"/);
  }
  const renderModel = buildCondensedRenderModel(m.molecule, () => 0);
  assert.equal(renderModel.available,true); const before = structuredClone(renderModel);
  const html = renderToStaticMarkup(React.createElement(condensed.CondensedMoleculeSvg, {
    model: renderModel, reasoningTarget: target, selectedAtomId: null, showNumbering: false,
    language: "en", advancedScreenReaderEnabled: false, onSelectAtom: () => {}, onActivateBond: () => {}, onToggleTetrahedral: () => {},
  }));
  assert.equal((html.match(/data-reasoning-atom=/g) ?? []).length,target.atomIds.length);
  assert.equal((html.match(/data-reasoning-bond=/g) ?? []).length,target.bondIds.length);
  assert.equal((html.match(/data-reasoning-locant=/g) ?? []).length,target.locants.length);
  assert.deepEqual(renderModel,before);
  const page = readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(page,/"\[data-editor-only='true'\]"/);
  assert.match(page,/reasoningVisualsEnabled = !practiceOpen && !isolatedBuild/);
  const css = readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.molecule-stage \.reasoning-visual-overlay \{ animation: none; \}/);
});
