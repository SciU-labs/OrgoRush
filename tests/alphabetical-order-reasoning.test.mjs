import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeAlphabeticalOrder } from "../app/reasoning-alphabetical-order.ts";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { nameSubstituents } from "../app/legacy-english-nomenclature.ts";
import { historicalPrefixKey } from "../app/legacy-name-numbering.ts";
import { buildReasoningVisualReferences } from "../app/reasoning-visual-targets.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { observe, project } from "./helpers/reasoning-integrity.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });
const example = "CC(=O)CC(Cl)=C(Cl)C(C)(C)C";
function model(smiles = example, profile = "2013-en") {
  const observed = observe(chemistry.engine, smiles);
  const before = structuredClone(observed);
  const reasoning = project(chemistry.engine, observed, profile);
  assert.deepEqual(observed, before, "reasoning never changes the analyzed structure or numbering");
  const step = reasoning.steps.find(step => step.alphabeticalOrder);
  return { ...observed, reasoning, step, presentation: step?.alphabeticalOrder };
}
function fromName(name, profile = "2013-en") {
  const result = buildHydrocarbonFromIupacName(name);
  assert.equal(result.ok, true, result.error);
  const exported = moleculeToSmiles(result.molecule);
  assert.equal(exported.ok, true, exported.error);
  return model(exported.smiles, profile);
}

function assertConcise(presentation, maximum = 50) {
  const text = presentation.paragraphs.join(" ");
  assert.ok(presentation.paragraphs.length <= 2);
  assert.equal((text.match(/[.!?](?:\s|$)/g) ?? []).length, presentation.paragraphs.length);
  assert.ok(text.split(/\s+/u).length <= maximum, text);
  assert.doesNotMatch(text, /C\d|numbering direction|sentido de numeración|ketone|cetona|two groups|dos grupos|both at|ambos en/i);
}

test("the example gives a short rule and its molecular application in ES/EN", () => {
  for (const [profile, fragment] of [["2013-es", "cloro → metil"], ["2013-en", "chloro → methyl"]]) {
    const m = model(example, profile), text = m.step.explanation;
    assert.equal(m.presentation.fragment, fragment);
    assert.deepEqual(m.presentation.groups.map(group => [...group.locants]), [[4,5], [6,6]]);
    assert.deepEqual(m.presentation.groups.map(group => group.multiplier), ["di", "di"]);
    assertConcise(m.presentation);
    assert.equal(m.presentation.paragraphs.length, 2);
    assert.equal(text, m.presentation.paragraphs.join(" "));
    assert.ok(text.split(/\s+/u).length >= 30, text);
    assert.match(m.presentation.paragraphs[0], profile.endsWith("es") ? /nombre base.*prefijos multiplicativos.*localizadores/ : /base names.*multiplicative prefixes.*locants/);
    assert.match(m.presentation.paragraphs[1], profile.endsWith("es") ? /«cloro» \(c\) precede a «metil» \(m\).*«dicloro» antes de «dimetil»/ : /“chloro” \(c\) precedes “methyl” \(m\).*“dichloro” before “dimethyl”/);
    assert.doesNotMatch(text, /sec-|tert-|terc-/);
    assert.equal(m.reasoning.steps.find(step => step.nameRole === "numbering").numberingComparison.comparison, -1);
  }
});

test("the selected profile supplies alphabetical citation; quantity and locants cannot reorder it", () => {
  const m = fromName("3-ethyl-2,2-dimethylhexane");
  assert.equal(m.presentation.fragment, "ethyl → methyl");
  assert.deepEqual(m.presentation.groups.map(group => group.citedPrefix), ["ethyl", "dimethyl"]);
  assert.deepEqual(m.presentation.groups.map(group => [...group.locants]), [[3], [2,2]]);
  assertConcise(m.presentation);
  assert.match(m.step.explanation, /without considering external multiplicative prefixes/);
  assert.match(m.step.explanation, /ethyl.*before.*dimethyl/);
});

test("different substituents generate their own comparison and never borrow the example", () => {
  const m = fromName("2-bromo-3-ethylhexane");
  assert.equal(m.presentation.fragment, "bromo → ethyl");
  assertConcise(m.presentation);
  assert.match(m.step.explanation, /“bromo” \(b\) precedes “ethyl” \(e\)/);
  assert.doesNotMatch(m.step.explanation, /chloro|C6\)|“di-”/);
  assert.deepEqual(m.presentation.groups.map(group => [...group.locants]), [[2], [3]]);
});

test("comparison continues beyond a shared initial letter, in the displayed language", () => {
  const es = model("CC(C)CC(OC)CC", "2013-es");
  const en = model("CC(C)CC(OC)CC", "2013-en");
  assert.equal(es.presentation.fragment, "metil → metoxi");
  assert.equal(en.presentation.fragment, "methoxy → methyl");
  assert.match(es.step.explanation, /primera diferencia \(i antes que o\)/);
  assert.match(en.step.explanation, /first difference \(o before y\)/);
  assertConcise(es.presentation);
  assertConcise(en.presentation);
});

test("displayed English prefix locants are projected without renumbering the molecule", () => {
  const es = model("CC(I)CC(C)C", "2013-es"), en = model("CC(I)CC(C)C", "2013-en");
  assert.equal(es.presentation.fragment, "metil → yodo");
  assert.equal(en.presentation.fragment, "iodo → methyl");
  assert.equal(en.reasoning.displayedName, "2-iodo-4-methylpentane");
  assert.deepEqual(en.presentation.groups.map(group => [...group.locants]), [[2], [4]]);
  assert.deepEqual(es.presentation.groups.map(group => [...group.locants]), [[2], [4]]);
  assert.match(en.step.explanation, /“iodo” \(i\) precedes “methyl” \(m\)/);
  assertConcise(en.presentation);
});

test("one substituent type gets one shorter sentence without repeating multiplicity or positions", () => {
  for (const profile of ["2013-es", "2013-en"]) {
    const m = fromName("2,2,4-trimethylpentane", profile);
    assert.equal(m.presentation.groups.length, 1);
    assert.equal(m.presentation.fragment, profile.endsWith("es") ? "metil" : "methyl");
    assert.deepEqual([...m.presentation.groups[0].locants], [2,2,4]);
    assert.match(m.step.explanation, profile.endsWith("es") ? /no es necesario comparar nombres diferentes/ : /no comparison between different names is needed/);
    assertConcise(m.presentation, 25);
    assert.equal(m.presentation.paragraphs.length, 1);
    assert.doesNotMatch(m.step.explanation, /tri-|trimetil|trimethyl|C2|C4/);
    assert.doesNotMatch(m.presentation.fragment, /→/);
  }
});

test("unsubstituted molecules retain their existing steps without an invented comparison", () => {
  const m = model("CCCC");
  assert.equal(m.step, undefined);
  assert.deepEqual(m.reasoning.steps.map(step => step.number), ["02"]);
  assert.equal(describeAlphabeticalOrder([], "en"), undefined);
});

test("ES to EN to ES and supported legacy profiles keep counts and citation aligned", () => {
  const observed = observe(chemistry.engine, example);
  const original = structuredClone(observed);
  const first = project(chemistry.engine, observed, "2013-es");
  for (const profile of ["1979-en", "1979-es", "2013-en", "2013-es"]) {
    const reasoning = project(chemistry.engine, observed, profile);
    const data = reasoning.steps.find(step => step.alphabeticalOrder).alphabeticalOrder;
    assert.equal(data.fragment, profile.endsWith("es") ? "cloro → metil" : "chloro → methyl");
    assert.deepEqual(data.groups.map(group => [...group.locants]), [[4,5], [6,6]]);
    assertConcise(data);
  }
  assert.deepEqual(project(chemistry.engine, observed, "2013-es"), first);
  assert.deepEqual(observed, original);
});

test("complex substituents retain their internal prefixes; the existing formatter supplies the order", () => {
  const prefixes = nameSubstituents([
    { locant: 7, systematicName: "1,1-dimetiletil", complex: true },
    { locant: 5, systematicName: "etil", complex: false },
  ]);
  assert.deepEqual(prefixes, ["7-(1,1-dimethylethyl)", "5-ethyl"]);
  const groups = [
    { sourceName: "1,1-dimetiletil", name: "1,1-dimethylethyl", comparisonName: historicalPrefixKey("1,1-dimethylethyl"),
      locants: [7], citedPrefix: "(1,1-dimethylethyl)", multiplier: "", complex: true },
    { sourceName: "etil", name: "ethyl", comparisonName: "ethyl", locants: [5], citedPrefix: "ethyl", multiplier: "", complex: false },
  ];
  const original = structuredClone(groups), result = describeAlphabeticalOrder(groups, "en");
  assert.equal(result.fragment, "1,1-dimethylethyl → ethyl");
  assert.match(result.paragraphs.join(" "), /“1,1-dimethylethyl” \(d\) precedes “ethyl” \(e\)/);
  assert.match(result.paragraphs.join(" "), /complete names, retaining internal prefixes in complex groups/);
  assert.match(result.paragraphs.join(" "), /ignoring outside multipliers/);
  assertConcise(result);
  assert.deepEqual(groups, original);
});

test("conventional qualifiers are explained only when that form is actually present", () => {
  const group = { sourceName: "tert-butil", name: "tert-butyl", comparisonName: historicalPrefixKey("tert-butyl"),
    locants: [4], citedPrefix: "tert-butyl", multiplier: "", complex: false };
  const other = { sourceName: "etil", name: "ethyl", comparisonName: "ethyl", locants: [3], citedPrefix: "ethyl", multiplier: "", complex: false };
  const presentation = describeAlphabeticalOrder([group, other], "en");
  const text = presentation.paragraphs.join(" ");
  assert.match(text, /“tert-butyl” \(key “butyl”\)/);
  assertConcise(presentation);
  assert.doesNotMatch(text, /sec-/);
  const ordinary = { ...group, name: "butyl", citedPrefix: "butyl" };
  assert.doesNotMatch(describeAlphabeticalOrder([ordinary, other], "en").paragraphs.join(" "), /key|conventional|sec-|tert-/);
});

test("many substituent types keep two short sentences while the arrow retains every group", () => {
  const groups = ["bromo", "chloro", "ethyl", "fluoro", "iodo", "methyl"].map((name, index) => ({
    sourceName: name, name, comparisonName: name, locants: [index + 1], citedPrefix: name, multiplier: "", complex: false,
  }));
  for (const language of ["es", "en"]) {
    const before = structuredClone(groups), result = describeAlphabeticalOrder(groups, language);
    assertConcise(result);
    assert.equal(result.paragraphs.length, 2);
    assert.equal(result.fragment, groups.map(group => group.name).join(" → "));
    assert.match(result.paragraphs[1], language === "es" ? /^Entre ellos,/ : /^Among them,/);
    assert.deepEqual(groups, before);
  }
});

test("the alphabetical summary uses the same prominent span and stays semantically noninteractive", () => {
  const m = model();
  const element = React.createElement(chemistry.engine.ReasoningAlphabeticalContent, { presentation: m.presentation });
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /class="reasoning-name-fragment reasoning-name-fragment--alphabetical"/);
  assert.match(markup, /class="reasoning-name-fragment-text">chloro → methyl<\/span>/);
  assert.doesNotMatch(markup, /<button|<a |tabindex|aria-pressed|role="button"|reasoning-name-fragment-control/);
  assert.equal((markup.match(/class="reasoning-alphabetical-paragraph"/g) ?? []).length, m.presentation.paragraphs.length);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const typography = /\.reasoning-name-fragment-text\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(typography, /font-size: clamp\(/);
  assert.match(typography, /font-weight: 700/);
  assert.match(typography, /overflow-wrap: anywhere/);
  const alphabetical = /\.reasoning-name-fragment--alphabetical\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(alphabetical, /min-width: 0/);
  assert.doesNotMatch(alphabetical, /font-size|font-weight|cursor|hover/);
});

test("the explanatory step supplies no Canvas target and leaves existing fragment targets intact", () => {
  const m = model();
  const input = { molecule: m.molecule, ...m.reasoning, enabled: true };
  const full = buildReasoningVisualReferences(input);
  const previous = buildReasoningVisualReferences({ ...input, steps: m.reasoning.steps.filter(step => !step.alphabeticalOrder) });
  assert.deepEqual(full, previous);
  assert.equal(full.steps[m.step.number], undefined);
  assert.equal(m.reasoning.fragments[m.step.number], undefined);
  const step = m.reasoning.steps.find(step => step.nameRole === "function");
  const fragment = m.reasoning.fragments[step.number];
  const rows = chemistry.engine.ReasoningNameFragmentView({ fragment, stepNumber: step.number, visualTargets: full.fragments,
    onActivateTarget() {}, language: "en" }).props.children;
  assert.equal(rows[0].props.children[0].type, "button");
});
