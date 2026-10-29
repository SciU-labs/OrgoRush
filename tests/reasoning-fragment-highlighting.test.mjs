import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildReasoningVisualReferences, reasoningFragmentId, createReasoningVisualController } from "../app/reasoning-visual-targets.ts";
import { toggleDoubleBondGeometry, inspectDoubleBondStereochemistry } from "../app/double-bond-stereochemistry.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { observe, project } from "./helpers/reasoning-integrity.mjs";

let chemistry, ui;
before(async () => {
  chemistry = await loadExerciseChemistry();
  ui = await chemistry.loadModule("/app/reasoning-visual-interaction.tsx");
});
after(async () => { await chemistry?.close(); });

const allParts = fragment => fragment ? [fragment, ...(fragment.additionalFragments ?? [])] : [];
function model(smiles = "CC(=O)CC(Cl)=C(Cl)C(C)(C)C", profile = "2013-en", observed) {
  observed ??= observe(chemistry.engine, smiles);
  const reasoning = project(chemistry.engine, observed, profile);
  const input = { molecule: observed.molecule, ...reasoning, enabled: true };
  const before = structuredClone(input);
  const references = buildReasoningVisualReferences(input);
  assert.deepEqual(input, before, "target projection never edits chemistry or name evidence");
  const step = role => reasoning.steps.find(step => step.nameRole === role);
  const part = (role, text) => allParts(reasoning.fragments[step(role)?.number]).find(item => item.text === text);
  const target = (role, text) => references.fragments[reasoningFragmentId(step(role).number, part(role, text))];
  return { ...observed, reasoning, input, references, step, part, target };
}
const region = target => ({ atoms: new Set(target.atomIds), bonds: new Set(target.bondIds.map(pair => [...pair].sort((a,b) => a-b).join(":"))) });
const numbered = (m, target) => [...new Set(target.atomIds.map(id => m.reasoning.analysis.numberedAtoms.get(id)))].sort((a,b) => a-b);
function fragmentView(m, role, active, onActivateTarget, language = "en") {
  const step = m.step(role);
  return chemistry.engine.ReasoningNameFragmentView({ fragment: m.reasoning.fragments[step.number], stepNumber: step.number,
    visualTargets: m.references.fragments, selectedFragmentId: active?.fragmentId, onActivateTarget, language });
}

test("01 and its 2-one fragment use the same ketone atoms and bond", () => {
  const m = model(), step = m.step("function"), suffix = m.target("function", "2-one");
  assert.equal(step.number, "01");
  assert.deepEqual(region(suffix), region(m.references.steps[step.number]));
  assert.equal(suffix.atomIds.length, 2);
  assert.equal(suffix.bondIds.length, 1);
  assert.ok(suffix.atomIds.some(id => m.molecule.atoms.find(atom => atom.id === id).element === "O"));
  const calls = [];
  ui.ReasoningStepNumber({ number: step.number, title: step.title, language: "en", target: m.references.steps[step.number],
    active: false, onActivate: target => calls.push(target) }).props.onClick();
  fragmentView(m, "function", null, target => calls.push(target)).props.children[0].props.children[0]
    .props.onClick({ stopPropagation() {} });
  assert.deepEqual(region(calls[0]), region(calls[1]));
});

for (const [text, locants] of [["2", [2]], ["6,6", [6]], ["4,5", [4,5]]]) {
  test(`Reasoned Numbering ${text} targets only parent carbon(s) ${locants}`, () => {
    const m = model(), target = m.target("numbering", text);
    assert.ok(target);
    assert.deepEqual(numbered(m, target), locants);
    assert.equal(target.atomIds.length, locants.length);
    assert.deepEqual(target.bondIds, []);
    assert.deepEqual(new Set(target.locants.map(([,n]) => n)), new Set(locants));
    assert.ok(target.atomIds.every(id => m.reasoning.analysis.mainChain.includes(id)
      && (m.molecule.atoms.find(atom => atom.id === id).element ?? "C") === "C"));
  });
}

test("03 is the exact deduplicated union of its accepted numbering fragments", () => {
  const m = model(), step = m.step("numbering"), target = m.references.steps[step.number];
  assert.equal(step.number, "03");
  assert.deepEqual(numbered(m, target), [2,4,5,6]);
  assert.equal(target.atomIds.length, 4);
  assert.deepEqual(target.bondIds, []);
  assert.equal(target.fragmentId, undefined);
  const union = new Set(allParts(m.reasoning.fragments[step.number])
    .flatMap(part => [...m.references.fragments[reasoningFragmentId(step.number, part)].atomIds]));
  assert.deepEqual(new Set(target.atomIds), union);
});

test("fragment, section and other-step activations replace one another and share the 2s expiry", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const m = model(); let active;
  const controller = createReasoningVisualController(target => { active = target; });
  for (const [text, locants] of [["2", [2]], ["6,6", [6]], ["4,5", [4,5]]]) {
    const rows = fragmentView(m, "numbering", active, target => controller.activate(target)).props.children;
    rows.find(row => row.props.children[0].props.children.props.children === text)
      .props.children[0].props.onClick({ stopPropagation() {} });
    assert.deepEqual(numbered(m, active), locants);
    context.mock.timers.tick(1000);
  }
  const section = m.references.steps[m.step("numbering").number];
  controller.activate(section);
  assert.deepEqual(numbered(m, active), [2,4,5,6]);
  controller.activate(m.target("function", "2-one"));
  assert.deepEqual(region(active), region(m.references.steps["01"]));
  context.mock.timers.tick(1999); assert.ok(active);
  context.mock.timers.tick(1); assert.equal(active, null);
  controller.activate(section); controller.clear(); assert.equal(active, null);
  controller.dispose();
});

test("a fragment click stops propagation and never activates the entire section", () => {
  const m = model(); let active, stopped = false;
  const row = fragmentView(m, "numbering", null, target => { active = target; }).props.children[1];
  row.props.children[0].props.onClick({ stopPropagation() { stopped = true; } });
  if (!stopped) active = m.references.steps["03"];
  assert.equal(stopped, true);
  assert.deepEqual(numbered(m, active), [6]);
  assert.ok(active.fragmentId);
});

test("fragment buttons retain native keyboard semantics, focus styles and exclusive accessible states in ES/EN", () => {
  const m = model(), active = m.target("numbering", "6,6");
  for (const language of ["es", "en"]) {
    const tree = fragmentView(m, "numbering", active, () => {}, language);
    const buttons = tree.props.children.map(row => row.props.children[0]);
    assert.ok(buttons.every(button => button.type === "button" && button.props.type === "button"));
    assert.ok(buttons.every(button => button.props.onKeyDown === undefined && button.props.tabIndex === undefined));
    assert.equal(buttons.filter(button => button.props["aria-pressed"]).length, 1);
    assert.ok(buttons[1].props["aria-label"].includes("6,6"));
    assert.ok(buttons[1].props["aria-label"].includes(language === "en" ? "two seconds" : "dos segundos"));
    const markup = renderToStaticMarkup(tree);
    assert.equal((markup.match(/<button/g) ?? []).length, 3);
    assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1);
    for (const button of buttons) assert.doesNotMatch(renderToStaticMarkup(button.props.children), /<button|<a /);
  }
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.reasoning-name-fragment-control:focus-visible\s*\{[^}]*outline:/);
  assert.match(css, /\.reasoning-name-fragment-control\[aria-pressed="true"\]/);
});

test("rejected-orientation locants and explanatory numbers are never imported into numbering targets", () => {
  const m = model("CC(=O)CCCC");
  const step = m.step("numbering");
  assert.deepEqual(step.numberingComparison.selectedLocants, [2]);
  assert.deepEqual(step.numberingComparison.reverseLocants, [5]);
  assert.deepEqual(numbered(m, m.references.steps[step.number]), [2]);
  const changed = { ...step, explanation: "Reject 5; 99 candidates and 6 atoms; step 03" };
  const references = buildReasoningVisualReferences({ ...m.input, steps: [changed] });
  assert.deepEqual(references.steps[step.number], m.references.steps[step.number]);
});

test("missing, stale, ambiguous and non-carbon references remain noninteractive", () => {
  const m = model(), step = m.step("numbering");
  const atomId = m.reasoning.analysis.mainChain[1];
  const fixtures = [
    { text: "2", start: -1, kind: "numbering", label: "Missing span" },
    { text: "2", start: m.part("numbering", "2").start, atomIds: [999], kind: "numbering", label: "Stale" },
    { text: "6", kind: "numbering", label: "Ambiguous occurrence" },
    { text: "2", start: m.part("numbering", "2").start, semanticId: "unmapped", kind: "stereo", label: "No provenance" },
  ];
  for (const fragment of fixtures) {
    const references = buildReasoningVisualReferences({ ...m.input, fragments: { [step.number]: fragment } });
    assert.deepEqual(references.fragments, {});
    const html = renderToStaticMarkup(React.createElement(chemistry.engine.ReasoningNameFragmentView, {
      fragment, stepNumber: step.number, visualTargets: references.fragments, onActivateTarget: () => assert.fail("no target"),
      onSelectContribution: () => assert.fail("semantic ID alone cannot bypass validation"),
    }));
    assert.doesNotMatch(html, /<button/);
  }
  const nonCarbon = { ...m.molecule, atoms: m.molecule.atoms.map(atom => atom.id === atomId ? { ...atom, element: "N" } : atom) };
  const references = buildReasoningVisualReferences({ ...m.input, molecule: nonCarbon });
  assert.equal(references.fragments[reasoningFragmentId(step.number, m.part("numbering", "2"))], undefined);
  assert.deepEqual(buildReasoningVisualReferences({ ...m.input, enabled: false }), { steps: {}, fragments: {} });
});

test("whole-branch parent and substituent highlights keep the existing real attachment bonds", () => {
  const m = model();
  const parent = m.references.steps[m.step("parent").number];
  assert.deepEqual(region(m.target("parent", "hept")), region(parent));
  const methyl = m.target("substituent", "6,6-dimethyl");
  const chlorine = m.target("substituent", "4,5-dichloro");
  assert.equal(methyl.bondIds.length, 2);
  assert.equal(chlorine.bondIds.length, 2);
  assert.deepEqual(numbered(m, { atomIds: methyl.atomIds.filter(id => m.reasoning.analysis.mainChain.includes(id)) }), [6]);
  assert.deepEqual(new Set([...methyl.atomIds, ...chlorine.atomIds]), new Set(m.references.steps[m.step("substituent").number].atomIds));
  const nitrogen = model("CC(=O)N(C)C"), step = nitrogen.step("substituent");
  const fragment = allParts(nitrogen.reasoning.fragments[step.number]).find(part => /^N/.test(part.text));
  const nTarget = nitrogen.references.fragments[reasoningFragmentId(step.number, fragment)];
  assert.deepEqual(region(nTarget), region(nitrogen.references.steps[step.number]), "N locants do not acquire an unrelated parent-carbon attachment");
});

test("numbering also uses typed unsaturation provenance without treating every visible number as a locant", () => {
  const m = model("CCC#CCC");
  const step = m.step("numbering"), fragment = allParts(m.reasoning.fragments[step.number])[0];
  assert.equal(fragment.kind, "unsaturation");
  const target = m.references.fragments[reasoningFragmentId(step.number, fragment)];
  assert.deepEqual(numbered(m, target), [3]);
  assert.deepEqual(target.bondIds, []);
  const unsaturation = m.references.steps[m.step("unsaturation").number];
  assert.equal(unsaturation.atomIds.length, 2);
  assert.equal(unsaturation.bondIds.length, 1);
});

test("generic projections work across unrelated molecules and all available naming profiles", () => {
  for (const smiles of ["CCC(C)CCC", "CC(O)CCC", "CCC#CCC", "CC(=O)N(C)C", "CC1=CC=CC=C1O"]) {
    const observed = observe(chemistry.engine, smiles);
    for (const profile of ["2013-en", "2013-es", "1979-en", "1979-es"]) {
      if (!observed.profiles[profile].name) continue; // Do not invent an unavailable nomenclature profile.
      const m = model(smiles, profile, observed);
      assert.ok(Object.keys(m.references.fragments).length > 0, `${smiles}: ${profile}`);
      for (const target of Object.values(m.references.fragments)) {
        assert.ok(target.atomIds.every(id => m.molecule.atoms.some(atom => atom.id === id)));
        for (const [a,b] of target.bondIds) assert.ok(m.molecule.bonds.some(([x,y]) => a === x && b === y || a === y && b === x));
        if (m.reasoning.steps.find(step => step.number === target.stepNumber).nameRole === "numbering") assert.deepEqual(target.bondIds, []);
      }
    }
  }
});

test("a verified broad fragment shares its existing step target when there is no finer provenance", () => {
  const m = model("CCC(C)CCC"), step = m.step("substituent");
  const fragment = { ...m.reasoning.fragments[step.number], atomIds: undefined, contributions: undefined, bondIds: undefined };
  const references = buildReasoningVisualReferences({ ...m.input, fragments: { [step.number]: fragment } });
  assert.deepEqual(region(references.fragments[reasoningFragmentId(step.number, fragment)]), region(references.steps[step.number]));
});

test("E/Z fragment targets survive geometry changes without changing stereochemistry", () => {
  const m = model("C/C=C/C"), step = m.step("stereo"), part = allParts(m.reasoning.fragments[step.number])[0];
  const target = m.references.fragments[reasoningFragmentId(step.number, part)];
  assert.ok(target);
  const [a,b] = target.bondIds[0];
  assert.equal(inspectDoubleBondStereochemistry(m.molecule, a,b).configuration, "E");
  const toggled = toggleDoubleBondGeometry(m.molecule, a,b);
  assert.equal(toggled.ok, true, toggled.error);
  const analysis = chemistry.engine.analyzeMolecule(toggled.molecule);
  const reasoning = chemistry.engine.buildActiveIupacReasoning({ molecule: toggled.molecule,
    analyses: { current: analysis, legacy: analysis }, displayedName: analysis.name, language: "es", convention: "current",
    generatedNames: [analysis.name], canHighlight: true });
  const references = buildReasoningVisualReferences({ molecule: toggled.molecule, ...reasoning, enabled: true });
  const next = allParts(reasoning.fragments[reasoning.steps.find(step => step.nameRole === "stereo").number])[0];
  assert.ok(references.fragments[reasoningFragmentId(step.number, next)]);
  assert.equal(inspectDoubleBondStereochemistry(toggled.molecule, a,b).configuration, "Z");
  assert.equal(inspectDoubleBondStereochemistry(m.molecule, a,b).configuration, "E");
  assert.notEqual(reasoningFragmentId(step.number, next), target.fragmentId);
});

test("the real editor uses one activation path, no fragment scrolling, and guards reconstructed molecules", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const activate = source.slice(source.indexOf("const activateReasoningCanvasReference ="), source.indexOf("useEffect", source.indexOf("const activateReasoningCanvasReference =")));
  assert.match(activate, /setSelectedUnsaturationReference\(null\)/);
  assert.match(activate, /setActiveReasoningStep\(null\)/);
  assert.match(activate, /cancelReasoningHover/);
  assert.match(activate, /activateReasoningVisual\(target\)/);
  assert.doesNotMatch(activate, /scroll|navigateToReasoningStep/);
  assert.match(source, /onActivate=\{activateReasoningCanvasReference\}/);
  assert.match(source, /onActivateTarget=\{activateReasoningCanvasReference\}/);
  assert.match(source, /selectedUnsaturationReference\.molecule === molecule/);
  assert.match(source, /JSON\.stringify\(reasoningVisualReferences\)/);
});
