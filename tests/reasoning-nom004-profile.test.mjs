import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

import { deriveReasoningNameFragments } from "../app/reasoning-name-fragments.ts";
import { buildReasoningNameLinkParts } from "../app/reasoning-name-links.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { applyNomenclatureConvention, migrateNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import nom001 from "./fixtures/iupac-engine-audit-nom001-conforming.json" with { type: "json" };
import nom002 from "./fixtures/iupac-engine-nom002-cyclic-ketones.json" with { type: "json" };
import nom003 from "./fixtures/iupac-engine-audit-nom003-conforming.json" with { type: "json" };
import historicalAudit from "./fixtures/iupac-engine-audit-observed.json" with { type: "json" };

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let server;
let page;

before(async () => {
  server = await createServer({ root: projectRoot, configFile: false, logLevel: "error", appType: "custom",
    plugins: [react()], server: { middlewareMode: true, hmr: false } });
  page = await server.ssrLoadModule("/app/page.tsx");
});

after(async () => server?.close());

function getNames(molecule, analysis) {
  const englishLegacy = generateLegacyEnglishName(page.buildLegacyEnglishNameModel(molecule, analysis)).name;
  const spanishLegacy = applyNomenclatureConvention(
    page.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es",
  );
  return { englishLegacy, spanishLegacy };
}

function inspectProfile(molecule, analysis, name, language, convention) {
  const profile = convention === "current" ? "blue-book-2013" : "iupac-1979-legacy";
  const presentation = { profile, displayedName: name };
  const spanishSteps = page.buildIupacReasoningSteps(molecule, analysis, [], undefined, presentation);
  const steps = language === "en"
    ? page.buildEnglishReasoningSteps(spanishSteps, molecule, analysis, presentation)
    : spanishSteps;
  const fragments = deriveReasoningNameFragments({
    analysis, displayedName: name, generatedNames: [name], language, convention, steps, canHighlight: true,
  });
  const links = buildReasoningNameLinkParts(name, fragments, steps);
  for (const fragment of Object.values(fragments)) {
    const rows = page.ReasoningNameFragmentView({ fragment, onSelectContribution: () => {} }).props.children;
    assert.equal(new Set(rows.map((row) => row.key)).size, rows.length,
      `${name}: disjoint written spans of the same chemical bond need distinct React identities`);
  }
  assert.equal(links.map((part) => part.text).join(""), name, `${name} segment concatenation is lossless`);
  for (const link of links.filter((part) => part.stepNumber)) {
    assert.ok(steps.some((step) => step.number === link.stepNumber), `${link.text} points to an existing explanation`);
  }
  return { steps, fragments, links };
}

function parsed(smiles) {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  const before = moleculeToSmiles(result.molecule);
  assert.equal(before.ok, true);
  return { molecule: result.molecule, before: before.smiles };
}

test("NOM-004 A: all eight NOM-001 Spanish Legacy names retain structure-based explanations and literal segments", () => {
  for (const expected of nom001) {
    const { molecule, before } = parsed(expected.smiles);
    const current = page.analyzeMolecule(molecule);
    const legacy = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
    const { spanishLegacy, englishLegacy } = getNames(molecule, legacy);
    const observed = historicalAudit.find(({ id }) => id === expected.id);
    assert.equal(spanishLegacy, expected["1979-es"], `${expected.id} Spanish Legacy name remains unchanged`);
    assert.equal(englishLegacy, observed["1979-en"], `${expected.id} English Legacy name remains unchanged`);
    const profiles = [
      ["es", "current", current, current.name],
      ["en", "current", current, translateSpanishIupacToOpsin(current.name)],
      ["es", "iupac-1979-es", legacy, spanishLegacy],
      ["en", "iupac-1979-legacy-en", legacy, englishLegacy],
    ];
    for (const [language, convention, analysis, name] of profiles) {
      const result = inspectProfile(molecule, analysis, name, language, convention);
      const parentStep = result.steps.find(({ nameRole }) => nameRole === "parent");
      assert.ok(parentStep?.explanation, `${expected.id}/${convention}/${language} has parent context`);
      assert.ok(result.links.some(({ stepNumber }) => stepNumber), `${expected.id}/${convention}/${language} has a grounded segment`);
      assert.ok(result.steps.every((step) => step.explanation.length > 0), `${expected.id}/${convention}/${language} explanations are populated`);
      if (analysis.primaryFunctionalGroup) assert.ok(result.fragments["01"], `${expected.id}/${convention}/${language} links its principal function`);
      if (analysis.substituents.length) assert.ok(result.fragments["04"], `${expected.id}/${convention}/${language} links its substituent`);
    }
    const result = inspectProfile(molecule, legacy, spanishLegacy, "es", "iupac-1979-es");
    const after = moleculeToSmiles(molecule);
    assert.deepEqual(after, { ok: true, smiles: before }, `${expected.id} graph remains identical`);
    assert.ok(result.links.some(({ stepNumber }) => stepNumber), `${expected.id} exposes at least one grounded interactive segment`);
    if (expected.id === "12") {
      assert.equal(result.links.find(({ text }) => text === "but")?.stepNumber, "02");
      assert.equal(result.links.find(({ text }) => text === "3")?.stepNumber, "07");
      assert.equal(result.links.find(({ text }) => text === "en")?.stepNumber, "07");
      assert.match(result.steps.find(({ number }) => number === "07").explanation, /C3=C4/);
      assert.match(result.steps.find(({ number }) => number === "01").explanation, /localizador 2/);
    }
  }
});

test("NOM-004 B: seven Legacy cyclic ketones are explained from ring and locant analysis", () => {
  for (const expected of nom002) {
    const { molecule, before } = parsed(expected.smiles);
    const analysis = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
    const { englishLegacy, spanishLegacy } = getNames(molecule, analysis);
    assert.equal(spanishLegacy, expected["1979-es"], `${expected.id} Spanish name`);
    assert.equal(englishLegacy, expected["1979-en"], `${expected.id} English name`);
    for (const [language, name, convention] of [
      ["es", spanishLegacy, "iupac-1979-es"], ["en", englishLegacy, "iupac-1979-legacy-en"],
    ]) {
      const result = inspectProfile(molecule, analysis, name, language, convention);
      const parent = result.steps.find(({ nameRole }) => nameRole === "parent");
      assert.match(parent?.explanation ?? "", language === "en" ? /cyclic parent ring/ : /anillo cíclico progenitor/, name);
      assert.match(parent?.explanation ?? "", new RegExp(`${expected.ringSize} carbon`), name);
      assert.match(parent?.explanation ?? "", language === "en" ? /ring carbonyl is at C1/ : /carbonilo forma parte del anillo y está en C1/, name);
      if (expected.doubleBondLocants.length) {
        assert.match(parent?.explanation ?? "", new RegExp(`C${expected.doubleBondLocants[0]}=C${expected.doubleBondLocants[0] + 1}`), name);
      }
      if (expected.substituentLocants) {
        assert.match(result.steps.find(({ number }) => number === "04")?.explanation ?? "",
          language === "en" ? /methyl at C4/i : /metil en C4/i);
      }
    }
    assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before });
  }
});

test("NOM-004 C/D: 2013 and 1979 explanations use their selected NOM-003 parent", () => {
  for (const expected of nom003) {
    const { molecule, before } = parsed(expected.smiles);
    const current = page.analyzeMolecule(molecule);
    const legacy = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
    const names = getNames(molecule, legacy);
    const currentName = expected.blueBook2013.es;
    const legacyName = expected.legacy1979.es;
    assert.equal(current.mainChain.length, expected.blueBook2013.parentCarbonCount);
    assert.equal(legacy.mainChain.length, expected.legacy1979.parentCarbonCount);
    const modernResult = inspectProfile(molecule, current, currentName, "es", "current");
    const legacyResult = inspectProfile(molecule, legacy, legacyName, "es", "iupac-1979-es");
    assert.match(modernResult.steps.find(({ nameRole }) => nameRole === "parent")?.explanation ?? "", /cadena continua más larga/i);
    assert.match(legacyResult.steps.find(({ nameRole }) => nameRole === "parent")?.explanation ?? "", /análisis Legacy de 1979/);
    assert.equal(names.spanishLegacy, legacyName);
    assert.equal(modernResult.fragments["04"]?.text,
      expected.id === "19" ? "4-etenil" : "4-etinil", "the unsaturated substituent is linked in its assigned section");
    assert.equal(modernResult.fragments["07"], undefined, "step 07 explains the side-chain bond in prose without a duplicate card");
    for (const [language, convention, analysis, name] of [
      ["en", "current", current, expected.blueBook2013.en], ["en", "iupac-1979-legacy-en", legacy, expected.legacy1979.en],
    ]) {
      const result = inspectProfile(molecule, analysis, name, language, convention);
      assert.match(result.steps.find(({ nameRole }) => nameRole === "parent")?.explanation ?? "",
        convention === "current" ? /continuous carbon chain chosen as the parent/i : /1979 Legacy analysis selects/);
      const unsaturation = result.fragments["07"];
      if (analysis.doubleBondLocants.length || analysis.tripleBondLocants.length) {
        assert.ok(unsaturation || result.steps.find(({ nameRole }) => nameRole === "unsaturation"), name);
      }
      if (convention === "current") {
        assert.equal(result.fragments["04"]?.text, expected.id === "19" ? "4-ethenyl" : "4-ethynyl");
        assert.equal(unsaturation, undefined, "the English side-chain name is not duplicated in step 07");
      }
    }
    assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before });
  }
});

test("same ring analysis remains active across language and convention changes without leaking prior text", () => {
  const { molecule, before } = parsed("O=C1C=CCCC1");
  const current = page.analyzeMolecule(molecule);
  const legacy = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
  const legacyName = getNames(molecule, legacy);
  const sequence = [
    ["es", "current", current, current.name],
    ["en", "current", current, translateSpanishIupacToOpsin(current.name)],
    ["es", "iupac-1979-es", legacy, legacyName.spanishLegacy],
    ["en", "iupac-1979-legacy-en", legacy, legacyName.englishLegacy],
    ["es", "current", current, current.name],
  ];
  let previous;
  for (const [language, convention, analysis, name] of sequence) {
    const result = inspectProfile(molecule, analysis, name, language, convention);
    assert.equal(result.links.map(({ text }) => text).join(""), name, `${convention}/${language} fragments reconstruct the active name`);
    assert.equal(analysis.doubleBondLocants[0], 2, `${convention}/${language} uses the selected ring analysis`);
    assert.equal(analysis.mainChain.length, 6, `${convention}/${language} retains the six-carbon ring parent`);
    assert.match(result.steps.find(({ nameRole }) => nameRole === "unsaturation").explanation, /C2=C3/,
      `${convention}/${language} explains the active double bond`);
    assert.ok(result.links.every(({ stepNumber }) => !stepNumber || result.steps.some((step) => step.number === stepNumber)),
      `${convention}/${language} navigation targets exist`);
    const bondEvidence = result.links.filter(({ bondType, locant }) => bondType === "double" && locant === 2);
    assert.ok(bondEvidence.length, `${convention}/${language} exposes the active double-bond evidence in the visible name`);
    assert.ok(bondEvidence.every(({ atomIds }) => !atomIds || atomIds.every((id, index) => id === analysis.mainChain[1 + index])),
      `${convention}/${language} bond links use the selected ring atoms`);
    const functionLink = result.links.find(({ stepNumber }) => stepNumber === "01");
    assert.ok(functionLink, `${convention}/${language} links the active ketone function`);
    assert.ok(functionLink.contributions?.some(({ group }) => group === "ketone"),
      `${convention}/${language} function link reflects the analyzed ketone`);
    const parentLink = result.links.find(({ stepNumber }) => stepNumber === "02");
    assert.ok(parentLink, `${convention}/${language} links the active ring parent`);
    assert.deepEqual(parentLink.atomIds, analysis.mainChain, `${convention}/${language} parent link uses the active ring atoms`);
    if (previous) {
      const activeFragments = Object.values(result.fragments)
        .flatMap((fragment) => [fragment, ...(fragment.additionalFragments ?? [])]);
      const oldExclusiveFragments = Object.values(previous.fragments)
        .flatMap((fragment) => [fragment, ...(fragment.additionalFragments ?? [])])
        .map(({ text }) => text)
        .filter((text) => text && /\d/.test(text) && text.length >= 3 && !name.includes(text)
          && !activeFragments.some((fragment) => fragment.text === text));
      const explanationText = result.steps.map(({ explanation }) => explanation).join(" ");
      assert.ok(!explanationText.includes(previous.name), `${convention}/${language} has no stale prior name`);
      for (const text of oldExclusiveFragments) {
        assert.ok(!explanationText.includes(text), `${convention}/${language} does not retain prior-only fragment ${text}`);
      }
    }
    previous = { ...result, name };
  }
  assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before });
});

test("NOM-004 D: representative supported functional, unsaturated, cyclic and halo names keep their evidence", () => {
  const cases = [
    ["branched alkane", "CC(C)CC"],
    ["alkene", "CC=CC"],
    ["alkyne", "CCC#CC"],
    ["alcohol", "CC(O)CC"],
    ["ketone", "CC(=O)CC"],
    ["acyclic aldehyde", "CC(C)CC=O"],
    ["cyclic carboxylic acid", "O=C(O)C1CCCCC1"],
    ["saturated cyclic ketone", "O=C1CCCCC1"],
    ["unsaturated cyclic ketone", "O=C1C=CCCC1"],
    ["haloalkane", "CC(Cl)CC(C)C"],
  ];
  for (const [label, smiles] of cases) {
    const { molecule, before } = parsed(smiles);
    for (const [convention, analysis] of [
      ["current", page.analyzeMolecule(molecule)],
      ["iupac-1979-es", page.analyzeMolecule(molecule, [], "iupac-1979-legacy")],
    ]) {
      const names = getNames(molecule, analysis);
      const spanish = convention === "current" ? analysis.name : names.spanishLegacy;
      const english = convention === "current" ? translateSpanishIupacToOpsin(analysis.name) : names.englishLegacy;
      assert.notEqual(spanish, "-", `${label} Spanish ${convention} name is available`);
      assert.notEqual(english, "-", `${label} English ${convention} name is available`);
      for (const [language, name, languageConvention] of [
        ["es", spanish, convention === "current" ? "current" : "iupac-1979-es"],
        ["en", english, convention === "current" ? "current" : "iupac-1979-legacy-en"],
      ]) {
        const result = inspectProfile(molecule, analysis, name, language, languageConvention);
        assert.ok(result.steps.some(({ nameRole }) => nameRole === "parent"), `${label} has a parent explanation`);
        assert.ok(result.links.some(({ stepNumber }) => stepNumber), `${label} has a navigable name segment`);
        assert.ok(result.steps.every((step) => step.explanation.length > 0), `${label} has no empty explanation`);
      }
    }
    assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before }, `${label} graph identity`);
  }
});

test("NOM-004C: an unsaturated substituent has one name card while step 07 explains bond placement", () => {
  const { molecule, before } = parsed("C#CC(CCC)CCC");
  const analyses = {
    current: page.analyzeMolecule(molecule, [], "blue-book-2013"),
    legacy: page.analyzeMolecule(molecule, [], "iupac-1979-legacy"),
  };
  const names = {
    current: [analyses.current.name, translateSpanishIupacToOpsin(analyses.current.name)],
    legacy: (() => {
      const generated = getNames(molecule, analyses.legacy);
      return [generated.spanishLegacy, generated.englishLegacy];
    })(),
  };
  for (const [convention, selected] of [["current", "current"], ["iupac-1979-es", "legacy"]]) {
    for (const [language, index] of [["es", 0], ["en", 1]]) {
      const name = names[selected][index];
      const activeConvention = migrateNomenclatureConvention(convention, language);
      const model = page.buildActiveIupacReasoning({ molecule, analyses, convention: activeConvention, language,
        displayedName: name, generatedNames: names[selected], canHighlight: true });
      const step = (role) => model.steps.find((item) => item.nameRole === role);
      const cards = model.fragments[step("substituent").number];
      const cardRows = [cards, ...(cards?.additionalFragments ?? [])].filter(Boolean);
      const expectedPrefix = selected === "current"
        ? language === "es" ? "4-etinil" : "4-ethynyl"
        : language === "es" ? "propil" : "propyl";
      assert.equal(cardRows.filter((item) => item.text === expectedPrefix).length, 1,
        `${name}: the substituent is represented once in its assigned section`);
      const renderedCards = page.ReasoningNameFragmentView({ fragment: cards, onSelectContribution: () => {} }).props.children;
      assert.equal(renderedCards.filter((row) => row.props.children[0]?.props.children === expectedPrefix).length, 1,
        `${name}: the rendered section contains exactly one card for that span`);
      const target = model.links.filter((item) => item.text === expectedPrefix && item.stepNumber);
      assert.equal(target.length, 1, `${name}: the visible name has one navigational target`);
      assert.equal(target[0].stepNumber, "04", `${name}: substituent navigation goes to step 04`);
      assert.equal(model.links.map((item) => item.text).join(""), name, `${name}: links reconstruct the name`);

      const unsaturation = step("unsaturation");
      assert.ok(unsaturation, `${name}: the unsaturation section remains available`);
      if (selected === "current") {
        assert.equal(model.fragments[unsaturation.number], undefined,
          `${name}: the same substituent span is not rendered as a second step 07 card`);
        assert.match(unsaturation.explanation, language === "es"
          ? /enlace triple C≡C.*sustituyente etinilo.*heptano conserva -ano, no -ino/
          : /C≡C triple bond.*ethynyl substituent.*heptane retains -ane, not -yne/);
        assert.match(step("substituent").explanation, language === "es"
          ? /grupo etinilo unido al carbono 4 del heptano/
          : /ethynyl group attached at C4 of heptane/);
        assert.doesNotMatch(unsaturation.explanation, /4-etinil|4-ethynyl/,
          `${name}: step 07 does not repeat the interactive name fragment`);
      } else {
        const parentUnsaturation = model.fragments[unsaturation.number];
        assert.equal(parentUnsaturation?.bondType, "triple",
          `${name}: the actual Legacy parent triple bond keeps its own interactive evidence`);
        assert.equal(parentUnsaturation?.locant, 1);
        assert.match(unsaturation.explanation, language === "es" ? /C1≡C2/ : /C1≡C2/);
        assert.match(step("substituent").explanation, language === "es" ? /propil/ : /propyl/);
      }
    }
  }
  const { molecule: mixedMolecule, before: mixedBefore } = parsed("C=CCC(C#C)CCC");
  const mixedAnalysis = page.analyzeMolecule(mixedMolecule, [], "blue-book-2013");
  assert.ok(mixedAnalysis.doubleBondLocants.length, "the parent contains its own double bond");
  assert.ok(mixedAnalysis.substituents.some(({ name }) => /inil$/i.test(name)), "the substituent contains a distinct triple bond");
  const mixedEnglishName = translateSpanishIupacToOpsin(mixedAnalysis.name);
  for (const [language, name] of [["es", mixedAnalysis.name], ["en", mixedEnglishName]]) {
    const mixedModel = page.buildActiveIupacReasoning({ molecule: mixedMolecule,
      analyses: { current: mixedAnalysis, legacy: page.analyzeMolecule(mixedMolecule, [], "iupac-1979-legacy") },
      convention: "current", language, displayedName: name, generatedNames: [mixedAnalysis.name, mixedEnglishName], canHighlight: true });
    const substituent = mixedAnalysis.substituents.find(({ name: itemName }) => /inil$/i.test(itemName));
    const prefix = `${substituent.locant}-${language === "es" ? "etinil" : "ethynyl"}`;
    const step04 = mixedModel.fragments["04"];
    const step07 = mixedModel.steps.find(({ nameRole }) => nameRole === "unsaturation");
    assert.equal([step04, ...(step04?.additionalFragments ?? [])].filter((item) => item?.text === prefix).length, 1,
      `${name}: the side-chain substituent remains represented once`);
    assert.equal(mixedModel.fragments["07"]?.bondType, "double",
      `${name}: parent unsaturation keeps its distinct interactive bond target`);
    assert.match(step07.explanation, new RegExp(`C${mixedAnalysis.doubleBondLocants[0]}=C${mixedAnalysis.doubleBondLocants[0] + 1}`));
    assert.match(step07.explanation, /C≡C/);
    assert.match(step07.explanation, language === "es" ? /fuera de la cadena principal/ : /outside the selected parent chain/);
    assert.equal(mixedModel.links.map((item) => item.text).join(""), name);
  }
  assert.deepEqual(moleculeToSmiles(mixedMolecule), { ok: true, smiles: mixedBefore }, "distinct parent and substituent bonds leave the graph unchanged");
  assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before }, "all profile/language views preserve graph identity");
});

test("manual findings: parent, orientation, multiple bond and historical spelling have independent explanations and links", () => {
  const cases = [
    { smiles: "CC(O)C=C", current: ["but-3-en-2-ol", "but-3-en-2-ol"], legacy: ["3-buten-2-ol", "3-buten-2-ol"], root: ["but", "but"], bond: "C3=C4", orientation: /2.*3/, function: "alcohol" },
    { smiles: "O=C1C=CCCC1", current: ["ciclohex-2-en-1-ona", "cyclohex-2-en-1-one"], legacy: ["2-ciclohexenona", "2-cyclohexenone"], root: ["ciclohex", "cyclohex"], bond: "C2=C3", orientation: /2.*5/, function: "ketone" },
    { smiles: "O=C1C=CC(C)CC1", current: ["4-metilciclohex-2-en-1-ona", "4-methylcyclohex-2-en-1-one"], legacy: ["4-metil-2-ciclohexenona", "4-methyl-2-cyclohexenone"], root: ["ciclohex", "cyclohex"], bond: "C2=C3", orientation: /2.*5/, function: "ketone", substituent: /4/ },
    { smiles: "C=CC(CCC)CCC", current: ["4-etenilheptano", "4-ethenylheptane"], legacy: ["3-propil-1-hexeno", "3-propyl-1-hexene"], root: ["hex", "hex"], bond: "C1=C2", orientation: /1.*5/, substituent: /3/ },
    { smiles: "C#CC(CCC)CCC", current: ["4-etinilheptano", "4-ethynylheptane"], legacy: ["3-propil-1-hexino", "3-propyl-1-hexyne"], root: ["hex", "hex"], bond: "C1≡C2", orientation: /1.*5/, substituent: /3/ },
  ];
  for (const expected of cases) {
    const { molecule, before } = parsed(expected.smiles);
    for (const legacy of [false, true]) {
      const analysis = page.analyzeMolecule(molecule, [], legacy ? "iupac-1979-legacy" : "blue-book-2013");
      const names = legacy ? getNames(molecule, analysis) : { spanishLegacy: analysis.name, englishLegacy: translateSpanishIupacToOpsin(analysis.name) };
      assert.equal(names.spanishLegacy, (legacy ? expected.legacy : expected.current)[0]);
      assert.equal(names.englishLegacy, (legacy ? expected.legacy : expected.current)[1]);
      for (const [index, language, name] of [[0, "es", names.spanishLegacy], [1, "en", names.englishLegacy]]) {
        const result = inspectProfile(molecule, analysis, name, language, legacy ? language === "es" ? "iupac-1979-es" : "iupac-1979-legacy-en" : "current");
        const step = (role) => result.steps.find(({ nameRole }) => nameRole === role);
        const multipleInSubstituent = !legacy && !expected.function;
        assert.ok(step("parent")?.explanation.includes(String(analysis.mainChain.length)), `${name}: parent carbon count`);
        assert.ok(step("numbering")?.explanation, `${name}: numbering explanation`);
        assert.ok(step("unsaturation")?.explanation, `${name}: independent multiple-bond explanation`);
        if (!multipleInSubstituent) {
          assert.ok(step("unsaturation").explanation.includes(expected.bond), `${name}: actual bond endpoints`);
          assert.match(step("numbering").explanation, expected.orientation, `${name}: numerical orientation comparison`);
          assert.ok(result.links.some((part) => part.stepNumber === "07"), `${name}: direct navigation to unsaturation`);
          assert.ok(result.links.some((part) => part.text === expected.root[index] && part.stepNumber === "02"), `${name}: independent parent scaffold`);
        } else {
          assert.match(step("unsaturation").explanation, language === "es" ? /fuera.*cadena principal|sustituyente/ : /outside|substituent/);
          assert.match(step("substituent").explanation, language === "es" ? /carbono 4|C4/ : /C4/);
        }
        if (expected.function) assert.ok(result.links.some((part) => part.stepNumber === "01"), `${name}: functional suffix linked`);
        if (expected.root[0] === "ciclohex") {
          assert.match(step("parent").explanation, /6/);
          assert.match(step("numbering").explanation, /C1/);
          assert.doesNotMatch(step("parent").explanation, /anillo continuo/);
          if (!legacy) {
            assert.match(step("unsaturation").explanation, /C2=C3/);
            assert.ok(!step("unsaturation").explanation.includes(name), "the overview identifies the bond without repeating the modern name");
            const locantEvidence = result.links.find(({ text, stepNumber, bondType, locant }) =>
              text.startsWith("2") && stepNumber === "07" && bondType === "double" && locant === 2);
            const unsaturationEvidence = result.links.find(({ semanticId, bondType, locant }) =>
              semanticId === "unsaturation:double:2" && bondType === "double" && locant === 2);
            assert.ok(name.includes("-2-en-"), `${name}: 2013 spelling remains in the visible name`);
            assert.ok(locantEvidence, `${name}: the written locant links to active evidence`);
            assert.ok(unsaturationEvidence?.stepNumber, `${name}: the unsaturation spelling links to active evidence`);
            assert.ok(result.links.some(({ stepNumber, bondType, locant, atomIds }) => stepNumber === "07"
              && bondType === "double" && locant === 2
              && (!atomIds || atomIds.every((id, index) => id === analysis.mainChain[1 + index]))),
            `${name}: the visible unsaturation navigates to the analyzed C2=C3 bond`);
          } else {
            assert.equal(name, expected.legacy[index], `${name}: the Legacy spelling is preserved`);
            assert.match(step("parent").explanation, /Legacy/);
          }
          if (legacy) assert.doesNotMatch(step("function").explanation, /[«“]1-(?:ona|one)/, "an implicit Legacy carbonyl locant is not taught as a written suffix");
        }
        if (legacy && !expected.function) assert.match(step("parent").explanation, language === "es" ? /enlaces múltiples antes.*longitud/ : /multiple bonds before chain length/);
        if (legacy) assert.ok(result.steps.every((item) => !item.explanation.includes(expected.current[index])), `${name}: no modern spelling leaks`);
      }
    }
    assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before });
  }
});

test("NOM-004B: the UI model selects one engine result for every step and segment through the five-profile sequence", () => {
  const cases = [
    { smiles: "CC(O)C=C", current: ["but-3-en-2-ol", "but-3-en-2-ol"], legacy: ["3-buten-2-ol", "3-buten-2-ol"], count: 4, root: ["but", "but"], bondLocant: 3 },
    { smiles: "O=C1C=CCCC1", current: ["ciclohex-2-en-1-ona", "cyclohex-2-en-1-one"], legacy: ["2-ciclohexenona", "2-cyclohexenone"], count: 6, root: ["ciclohex", "cyclohex"], bondLocant: 2 },
    { smiles: "O=C1C=CC(C)CC1", current: ["4-metilciclohex-2-en-1-ona", "4-methylcyclohex-2-en-1-one"], legacy: ["4-metil-2-ciclohexenona", "4-methyl-2-cyclohexenone"], count: 6, root: ["ciclohex", "cyclohex"], bondLocant: 2, methyl: true },
    { smiles: "C=CC(CCC)CCC", current: ["4-etenilheptano", "4-ethenylheptane"], legacy: ["3-propil-1-hexeno", "3-propyl-1-hexene"], count: 6, root: ["hex", "hex"], bondLocant: 1, branched: true },
    { smiles: "C#CC(CCC)CCC", current: ["4-etinilheptano", "4-ethynylheptane"], legacy: ["3-propil-1-hexino", "3-propyl-1-hexyne"], count: 6, root: ["hex", "hex"], bondLocant: 1, branched: true, triple: true },
  ];
  for (const expected of cases) {
    const { molecule, before } = parsed(expected.smiles);
    const analyses = { current: page.analyzeMolecule(molecule), legacy: page.analyzeMolecule(molecule, [], "iupac-1979-legacy") };
    const originalDecisions = structuredClone(analyses);
    const legacyNames = getNames(molecule, analyses.legacy);
    assert.deepEqual([analyses.current.name, translateSpanishIupacToOpsin(analyses.current.name)], expected.current);
    assert.deepEqual([legacyNames.spanishLegacy, legacyNames.englishLegacy], expected.legacy);
    for (const [language, selected] of [["es", "current"], ["es", "iupac-1979-es"], ["en", "iupac-1979-es"], ["en", "current"], ["es", "current"]]) {
      const convention = migrateNomenclatureConvention(selected, language);
      const historical = convention !== "current", index = language === "es" ? 0 : 1;
      const name = (historical ? expected.legacy : expected.current)[index];
      // Exactly the inputs consumed by Home: both real engine results, and the
      // selected UI convention. The test cannot preselect the correct analysis.
      const model = page.buildActiveIupacReasoning({ molecule, analyses, convention, language,
        displayedName: name, generatedNames: [expected.current[index], expected.legacy[index]], canHighlight: true });
      assert.equal(model.analysis, historical ? analyses.legacy : analyses.current, `${name}: selected engine object is reused`);
      const step = (role) => model.steps.find((item) => item.nameRole === role);
      const parentCount = expected.branched && !historical ? 7 : expected.count;
      assert.equal(model.analysis.mainChain.length, parentCount);
      const parent = model.links.find((part) => part.stepNumber === "02");
      assert.ok(parent, `${name}: parent navigation`);
      assert.deepEqual(parent.atomIds, model.analysis.mainChain, `${name}: root refers to the selected parent atoms`);
      assert.equal(model.links.map((part) => part.text).join(""), name);
      assert.ok(model.links.every((part) => !part.stepNumber || model.steps.some((item) => item.number === part.stepNumber)));
      if (expected.branched) {
        assert.deepEqual(model.analysis.substituents.map(({ name, locant }) => [name, locant]),
          historical ? [["propil", 3]] : [[expected.triple ? "etinil" : "etenil", 4]]);
        assert.deepEqual(model.analysis.doubleBondLocants, historical && !expected.triple ? [1] : []);
        assert.deepEqual(model.analysis.tripleBondLocants, historical && expected.triple ? [1] : []);
        const allText = model.steps.map((item) => item.explanation).join(" ");
        if (historical) {
          assert.match(step("parent").explanation, /6/);
          assert.doesNotMatch(allText, /heptan|etinil|ethynyl|etenil|ethenyl/i);
          assert.match(step("numbering").explanation, language === "es" ? /propil en C3/ : /propyl at C3/);
          assert.match(step("numbering").explanation, /1.*5/);
          assert.ok(model.links.some((part) => part.text === "3" && part.stepNumber === "03"),
            `${name}: the substituent locant directly opens the numbering justification`);
          assert.ok(model.links.some((part) => part.text === (language === "es" ? "propil" : "propyl") && part.stepNumber === "04"));
        } else {
          assert.match(step("substituent").explanation, language === "es" ? /carbono 4|C4/ : /C4/);
          assert.match(step("unsaturation").explanation, language === "es"
            ? /enlace (?:doble|triple) C[≡=]C.*fuera de la cadena principal/
            : /C[≡=]C (?:double|triple) bond.*outside the selected parent chain/);
          assert.doesNotMatch(step("unsaturation").explanation, /C4/);
          assert.doesNotMatch(allText, /hexino|hexyne|hexeno|hexene/);
        }
      }
      if (!expected.branched || historical) {
        const bond = model.links.find((part) => part.stepNumber === "07" && part.bondType);
        assert.ok(bond, `${name}: direct multiple-bond navigation`);
        assert.equal(bond.locant, expected.bondLocant);
        assert.equal(bond.bondType, expected.triple ? "triple" : "double");
        assert.deepEqual(bond.atomIds, model.analysis.mainChain.slice(expected.bondLocant - 1, expected.bondLocant + 1));
      }
      if (expected.root[0] === "ciclohex") {
        assert.match(step("function").explanation, /C1/);
        assert.match(step("numbering").explanation, /2.*5/);
        if (historical) assert.match(step("function").explanation, language === "es" ? /implícito/ : /implicit/);
        if (expected.methyl) {
          assert.match(step("numbering").explanation, language === "es" ? /metil en C4/ : /methyl at C4/);
          assert.match(step("numbering").explanation, language === "es" ? /no modifican.*mayor prioridad/ : /do not override.*higher-priority/);
        }
      }
    }
    assert.deepEqual(analyses, originalDecisions, "building explanations never mutates either chemical decision");
    assert.deepEqual(moleculeToSmiles(molecule), { ok: true, smiles: before });
  }
});
