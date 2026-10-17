import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention, formatIupac1979SpanishName, migrateNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";
import { activateReasoningReference, scrollToReasoningStep } from "../app/reasoning-name-navigation.ts";

// 1979 A-11.3 (-adiene/-atriene), C-314.1 (cyclic parent + -one),
// C-15.11 (suffix function before multiple bonds). See reports/orgorush-nom002b-repair.md.
const cases = [
  { smiles: "O=C1C=CC=CC1", root: "hex", size: 6, locants: [2, 4], reverse: [3, 5] },
  { smiles: "O=C1C=CCC=C1", root: "hex", size: 6, locants: [2, 5] },
  { smiles: "O=C1C=CC=C1", root: "pent", size: 5, locants: [2, 4] },
  { smiles: "O=C1C=CC=CCC1", root: "hept", size: 7, locants: [2, 4], reverse: [4, 6] },
  { smiles: "O=C1C=CC(C)=CC1", root: "hex", size: 6, locants: [2, 4], reverse: [3, 5], methyl: true },
  { smiles: "O=C1C=CC=CC=CC1", root: "oct", size: 8, locants: [2, 4, 6], reverse: [3, 5, 7] },
];
let server, page;
before(async () => {
  server = await createServer({ configFile: false, logLevel: "error", appType: "custom", plugins: [react()],
    server: { middlewareMode: true, hmr: false } });
  page = await server.ssrLoadModule("/app/page.tsx");
});
after(async () => server?.close());

for (const fixture of cases) test(`NOM-002B ${fixture.smiles}: four profiles, literal morphemes, structural numbering and navigation`, () => {
  const parsed = moleculeFromSmiles(fixture.smiles);
  assert.equal(parsed.ok, true);
  const molecule = parsed.molecule, original = structuredClone(molecule);
  const analyses = { current: page.analyzeMolecule(molecule), legacy: page.analyzeMolecule(molecule, [], "iupac-1979-legacy") };
  const decisions = structuredClone(analyses);
  const positions = fixture.locants.join(","), marker = fixture.locants.length === 2 ? "dien" : "trien";
  const names = {
    current: [
      `${fixture.methyl ? "4-metil" : ""}ciclo${fixture.root}a-${positions}-${marker}-1-ona`,
      `${fixture.methyl ? "4-methyl" : ""}cyclo${fixture.root}a-${positions}-${marker}-1-one`,
    ], legacy: [
      `${fixture.methyl ? "4-metil-" : ""}${positions}-ciclo${fixture.root}a${marker}ona`,
      `${fixture.methyl ? "4-methyl-" : ""}${positions}-cyclo${fixture.root}a${marker}one`,
    ],
  };
  assert.deepEqual([analyses.current.name, translateSpanishIupacToOpsin(analyses.current.name)], names.current);
  assert.deepEqual([
    applyNomenclatureConvention(page.legacySpanishFormatterInput(analyses.legacy, analyses.legacy.name), "iupac-1979-es", "es"),
    generateLegacyEnglishName(page.buildLegacyEnglishNameModel(molecule, analyses.legacy)).name,
  ], names.legacy);
  const initial = [];
  for (const [language, historical] of [["es", false], ["es", true], ["en", true], ["en", false], ["es", false]]) {
    const name = names[historical ? "legacy" : "current"][language === "es" ? 0 : 1];
    const convention = migrateNomenclatureConvention(historical ? "iupac-1979-es" : "current", language);
    const model = page.buildActiveIupacReasoning({ molecule, analyses, convention, language, displayedName: name,
      generatedNames: [...names.current, ...names.legacy], canHighlight: true });
    const analysis = model.analysis;
    assert.equal(analysis, historical ? analyses.legacy : analyses.current);
    assert.equal(analysis.family, "cycloalkane");
    assert.equal(analysis.mainChain.length, fixture.size);
    assert.equal(analysis.primaryFunctionalGroup, "ketone");
    assert.deepEqual(analysis.doubleBondLocants, fixture.locants);
    const ketone = analysis.functionalGroups.find(({ kind }) => kind === "ketone");
    assert.equal(analysis.numberedAtoms.get(ketone.carbonId), 1);
    assert.equal(molecule.bonds.filter(([a, b, order]) => order === 2 && analysis.mainChain.includes(a) && analysis.mainChain.includes(b)).length, fixture.locants.length);
    const step = (role) => model.steps.find(({ nameRole }) => nameRole === role);
    assert.match(step("function").explanation, language === "es" ? /cetona/i : /ketone/i);
    assert.match(step("parent").explanation, new RegExp(`${fixture.size}.*carbon`));
    assert.match(step("parent").explanation, /anillo|ring/);
    if (fixture.reverse) {
      assert.ok(step("numbering").explanation.includes(fixture.locants.join(", ")));
      assert.ok(step("numbering").explanation.includes(fixture.reverse.join(", ")));
      assert.match(step("numbering").explanation, language === "es" ? /primer punto de diferencia/ : /first point of difference/);
    } else {
      assert.doesNotMatch(step("numbering").explanation, /primer punto de diferencia|first point of difference/,
        "equivalent 2,5 directions must not claim a difference");
    }
    const fragment = model.fragments[step("unsaturation").number];
    const cards = [fragment, ...(fragment.additionalFragments ?? [])];
    assert.deepEqual(cards.map(({ text }) => text), [...fixture.locants.map(String), marker]);
    assert.equal(new Set(cards.map(({ start, text }) => `${start}:${text}`)).size, cards.length);
    for (const locant of fixture.locants) {
      const card = cards.find((item) => item.locant === locant);
      const atoms = analysis.mainChain.slice(locant - 1, locant + 1);
      assert.deepEqual(card.atomIds, atoms);
      assert.deepEqual(card.bondIds, [[...atoms].sort((a, b) => a - b)]);
      assert.ok(molecule.bonds.some(([a, b, order]) => order === 2 && atoms.includes(a) && atoms.includes(b)));
      assert.ok(step("unsaturation").explanation.includes(`C${locant}=C${locant + 1}`));
      assert.equal(card.explanation, language === "es" ? `Enlace doble C${locant}=C${locant + 1}.` : `Double bond C${locant}=C${locant + 1}.`);
      assert.ok(!card.explanation.includes(name), "bond cards do not repeat the full name");
    }
    const shared = cards.at(-1);
    assert.match(shared.explanation, new RegExp(`(?:«|“)${marker === "dien" ? "di" : "tri"}(?:»|”)`));
    assert.match(shared.explanation, /«en»|“en”/);
    assert.equal(shared.bondIds.length, fixture.locants.length);
    const overview = step("unsaturation").explanation;
    assert.ok(!overview.includes(shared.explanation), "overview must not concatenate the multiplier card");
    assert.ok(overview.includes(marker) && overview.includes(positions));
    assert.ok(overview.length < 300, "overview stays concise for two or three bonds");
    assert.equal(shared.explanation, language === "es"
      ? `«${marker === "dien" ? "di" : "tri"}» significa ${marker === "dien" ? "dos" : "tres"}; «en» identifica enlaces dobles C=C.`
      : `“${marker === "dien" ? "di" : "tri"}” means ${marker === "dien" ? "two" : "three"}; “en” identifies C=C double bonds.`);
    if (historical) assert.doesNotMatch(step("unsaturation").explanation, /2013/);
    assert.equal(model.links.map(({ text }) => text).join(""), name);
    const sharedLink = model.links.filter(({ text }) => text === marker);
    assert.equal(sharedLink.length, 1);
    assert.equal(sharedLink[0].stepNumber, "07");
    const selected = [];
    const rendered = page.ReasoningNameFragmentView({ fragment, selectedSemanticId: shared.semanticId,
      onSelectContribution: (item) => {
        selected.push(item.semanticId);
        activateReasoningReference({ current: null }, "07", (number) => scrollToReasoningStep(number,
          { getElementById: (id) => ({ scrollIntoView: () => selected.push(id) }) },
          { matchMedia: () => ({ matches: true }) }));
      } }).props.children;
    assert.equal(rendered.length, cards.length);
    for (const [index, row] of rendered.entries()) {
      const button = row.props.children[0];
      assert.equal(button.type, "button");
      assert.equal(button.props.type, "button"); // Native button activation includes Enter and Space.
      button.props.onClick();
      assert.deepEqual(selected.slice(-2), [cards[index].semanticId, "iupac-reasoning-step-07"]);
    }
    assert.equal(rendered.at(-1).props.children[0].props["aria-pressed"], true);
    initial.push(model);
  }
  assert.deepEqual(initial.at(-1), initial[0], "returning to ES 2013 restores the same model without stale spans");
  assert.deepEqual(analyses, decisions);
  assert.deepEqual(molecule, original);
  const smiles = moleculeToSmiles(molecule);
  assert.equal(smiles.ok, true);
  const reimported = moleculeFromSmiles(smiles.smiles);
  assert.equal(reimported.ok, true);
  assert.deepEqual(moleculeToSmiles(reimported.molecule), smiles);
});

for (const smiles of ["O=C1C=CCCC1", "C#CC(CCC)CCC"]) test(`AUD-001 ${smiles}: concise single-bond evidence follows the selected parent`, () => {
  const { molecule } = moleculeFromSmiles(smiles);
  const original = structuredClone(molecule);
  const analyses = { current: page.analyzeMolecule(molecule), legacy: page.analyzeMolecule(molecule, [], "iupac-1979-legacy") };
  for (const historical of [false, true]) {
    const analysis = historical ? analyses.legacy : analyses.current;
    const names = historical ? [
      applyNomenclatureConvention(page.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es"),
      generateLegacyEnglishName(page.buildLegacyEnglishNameModel(molecule, analysis)).name,
    ] : [analysis.name, translateSpanishIupacToOpsin(analysis.name)];
    for (const [index, language] of ["es", "en"].entries()) {
      const name = names[index];
      const model = page.buildActiveIupacReasoning({ molecule, analyses, language, displayedName: name,
        convention: migrateNomenclatureConvention(historical ? "iupac-1979-es" : "current", language), generatedNames: names, canHighlight: true });
      const step = model.steps.find(({ nameRole }) => nameRole === "unsaturation");
      assert.equal(model.links.map(({ text }) => text).join(""), name);
      if (!historical && smiles.startsWith("C#")) {
        assert.deepEqual(analysis.tripleBondLocants, []);
        assert.match(step.explanation, language === "es" ? /fuera.*cadena principal/ : /outside.*parent chain/);
      } else {
        const fragment = model.fragments[step.number];
        const cards = [fragment, ...(fragment.additionalFragments ?? [])];
        assert.equal(new Set(cards.map(({ start, text }) => `${start}:${text}`)).size, cards.length);
        for (const card of cards) {
          assert.equal(card.bondIds.length, 1);
          assert.deepEqual(card.atomIds, analysis.mainChain.slice(card.locant - 1, card.locant + 1));
          assert.match(card.explanation, language === "es" ? /^Enlace (doble|triple) C\d+[=≡]C\d+\.$/ : /^(Double|Triple) bond C\d+[=≡]C\d+\.$/);
          assert.ok(!card.explanation.includes(name));
          assert.ok(model.links.some(({ semanticId, stepNumber }) => semanticId === card.semanticId && stepNumber === step.number));
        }
        assert.ok(step.explanation.length < 200);
      }
    }
  }
  assert.deepEqual(molecule, original);
});

test("NOM-002B formatter rejects mismatched multiplicity and unsupported ketone grammars", () => {
  for (const name of ["ciclohexa-2,4-trien-1-ona", "ciclohexa-2,2-dien-1-ona", "ciclohexa-2,4-dien-1,6-diona"]) {
    assert.equal(formatIupac1979SpanishName(name), undefined, name);
  }
});
