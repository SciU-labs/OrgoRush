import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { translateSpanishIupacForDisplay } from "../app/iupac-name-normalization.ts";
import { deriveReasoningNameFragments } from "../app/reasoning-name-fragments.ts";
import { buildReasoningNameLinkParts } from "../app/reasoning-name-links.ts";
import { activateReasoningReference, scrollToReasoningStep } from "../app/reasoning-name-navigation.ts";
import { retainedFunctionalParentReasoning } from "../app/reasoning-functional-groups.ts";
import { parentStructureSelectionEvidence, reconciledParentSelectionEvidence } from "../app/reasoning-parent-selection.ts";

let server;
let page;
before(async () => {
  server = await createServer({ configFile: false, logLevel: "error", appType: "custom",
    plugins: [react()], server: { middlewareMode: true, hmr: false } });
  page = await server.ssrLoadModule("/app/page.tsx");
});
after(async () => { await server?.close(); });

function analyzed(smiles) {
  const imported = moleculeFromSmiles(smiles);
  assert.equal(imported.ok, true);
  return { molecule: imported.molecule, analysis: page.analyzeMolecule(imported.molecule) };
}

function presented(compound, language, overrides = {}) {
  const spanish = page.buildIupacReasoningSteps(compound.molecule, compound.analysis);
  const steps = language === "en" ? page.buildEnglishReasoningSteps(spanish, compound.molecule, compound.analysis) : spanish;
  const name = language === "en" ? translateSpanishIupacForDisplay(compound.analysis.name) : compound.analysis.name;
  const fragments = deriveReasoningNameFragments({ analysis: compound.analysis, displayedName: name,
    language, steps, canHighlight: true, ...overrides });
  const parts = buildReasoningNameLinkParts(overrides.displayedName ?? name, fragments, overrides.steps ?? steps);
  assert.equal(parts.map((part) => part.text).join(""), overrides.displayedName ?? name);
  let cursor = 0;
  const ranges = [];
  for (const part of parts) {
    if (part.stepNumber) {
      assert.match(part.text, /[a-záéíóúüñ0-9]/i, "punctuation does not become an orphan link");
      const targetSteps = overrides.steps ?? steps;
      assert.ok(targetSteps.some((step) => step.number === part.stepNumber));
      for (const number of [part.stepNumber, ...part.relatedStepNumbers]) {
        const visited = [];
        activateReasoningReference({ current: null }, number, (target) => scrollToReasoningStep(target,
          { getElementById: (id) => targetSteps.some((step) => id === `iupac-reasoning-step-${step.number}`)
            ? { scrollIntoView: () => visited.push(id) } : null }, { matchMedia: () => ({ matches: true }) }));
        assert.deepEqual(visited, [`iupac-reasoning-step-${number}`]);
      }
      ranges.push([cursor, cursor + part.text.length]);
    }
    cursor += part.text.length;
  }
  ranges.slice(1).forEach((range, index) => assert.ok(ranges[index][1] <= range[0], "rendered spans never overlap"));
  return { name, steps, fragments, parts };
}

const linkedRoles = (result) => result.parts.filter((part) => part.stepNumber)
  .map((part) => [part.text, result.steps.find((step) => step.number === part.stepNumber).nameRole]);

for (const language of ["es", "en"]) {
  test(`pentanoic acid: independent parent and both functional fragments in ${language}`, () => {
    const compound = analyzed("CCCCC(=O)O");
    const snapshot = structuredClone(compound.analysis);
    const result = presented(compound, language);
    assert.equal(result.name, language === "en" ? "pentanoic acid" : "ácido pentanoico");
    assert.deepEqual(linkedRoles(result), language === "en"
      ? [["pentan", "parent"], ["oic", "function"], ["acid", "function"]]
      : [["ácido", "function"], ["pentan", "parent"], ["oico", "function"]]);
    const parent = result.parts.find((part) => part.text === "pentan");
    assert.deepEqual(parent.atomIds, compound.analysis.mainChain);
    assert.equal(result.fragments[parent.stepNumber].text, "pentan");
    const functional = result.parts.filter((part) => part.contributions);
    assert.equal(functional.length, 2);
    assert.ok(functional.every((part) => part.text !== result.name && !part.text.includes("pentan")));
    assert.ok(functional.every((part) => part.contributions[0].group === "carboxylicAcid"));
    assert.deepEqual(compound.analysis, snapshot);
  });

  test(`benzaldehyde: retained reasoning and disjoint benz/aldehyde provenance in ${language}`, () => {
    const compound = analyzed("O=Cc1ccccc1");
    const snapshot = structuredClone(compound.analysis);
    const result = presented(compound, language);
    const aldehyde = language === "en" ? "aldehyde" : "aldehído";
    assert.equal(result.name, `benz${aldehyde}`);
    assert.deepEqual(linkedRoles(result), [["benz", "parent"], [aldehyde, "function"]]);
    const principal = result.steps.find((step) => step.nameRole === "function");
    const parent = result.steps.find((step) => step.nameRole === "parent");
    assert.match(principal.explanation, language === "en" ? /retained name/ : /nombre retenido/);
    assert.ok(principal.explanation.includes(result.name));
    assert.match(principal.explanation, /–CHO/);
    assert.match(principal.explanation, language === "en" ? /directly attached.*benzene ring/ : /unido directamente.*anillo bencénico/);
    assert.match(principal.explanation, language === "en" ? /outside the parent ring/ : /fuera del anillo padre/);
    assert.doesNotMatch(principal.explanation, /C1|alkanal|aporta el sufijo|contributes the suffix/);
    assert.match(parent.explanation, language === "en" ? /six-carbon benzene ring/ : /anillo bencénico de seis carbonos/);
    assert.doesNotMatch(parent.explanation, /aldeh|–CHO|sufijo|suffix/);
    assert.equal(result.fragments[parent.number].text, "benz");
    assert.equal(result.fragments[principal.number].text, aldehyde);
    assert.deepEqual(result.parts[0].atomIds, compound.analysis.mainChain);
    assert.ok(result.parts[1].contributions[0].atomIds.every((id) => !compound.analysis.mainChain.includes(id)));
    assert.deepEqual(compound.analysis, snapshot);
  });
}

for (const [label, smiles, parentEs, parentEn, suffixEs, suffixEn] of [
  ["dioic acid", "O=C(O)CCC(=O)O", "butano", "butane", "dioico", "dioic"],
  ["cyclic carboxylic acid", "O=C(O)C1CCCCC1", "ciclohexano", "cyclohexane", "carboxílico", "carboxylic acid"],
  ["aromatic dicarboxylic acid", "O=C(O)c1ccc(C(=O)O)cc1", "benceno", "benzene", "1,4-dicarboxílico", "1,4-dicarboxylic acid"],
  ["aromatic amide", "NC(=O)c1ccccc1", "benz", "benz", "amida", "amide"],
  ["aromatic nitrile", "N#Cc1ccccc1", "benzo", "benzo", "nitrilo", "nitrile"],
]) {
  test(`${label}: the existing functional morphology preserves a parent in both locales`, () => {
    const compound = analyzed(smiles);
    const names = [compound.analysis.name, translateSpanishIupacForDisplay(compound.analysis.name)];
    for (const language of ["es", "en", "es"]) {
      const result = presented(compound, language);
      const roles = linkedRoles(result);
      assert.ok(roles.some(([text, role]) => text === (language === "en" ? parentEn : parentEs) && role === "parent"));
      assert.ok(roles.some(([text, role]) => text === (language === "en" ? suffixEn : suffixEs) && role === "function"));
    }
    assert.deepEqual([page.analyzeMolecule(compound.molecule).name, translateSpanishIupacForDisplay(compound.analysis.name)], names);
  });
}

test("ester keeps parent, acid-derived suffix and O-alkyl portion independently reachable across locale switches", () => {
  const compound = analyzed("CC(C)C(=O)OCC");
  const spanish = presented(compound, "es");
  const english = presented(compound, "en");
  assert.deepEqual(linkedRoles(spanish), [["2-metil", "substituent"], ["propan", "parent"], ["oato", "function"], ["de etilo", "function"]]);
  assert.deepEqual(linkedRoles(english), [["ethyl", "function"], ["2-methyl", "substituent"], ["propan", "parent"], ["oate", "function"]]);
  assert.deepEqual(presented(compound, "es"), spanish);
  const suffix = english.parts.find((part) => part.text === "oate");
  const alkyl = english.parts.find((part) => part.text === "ethyl");
  assert.ok(suffix.contributions.every((origin) => !origin.atomIds.includes(alkyl.contributions[0].atomIds[0])));
});

test("halogen plus alkyl keeps separate parent and prefixes despite ES/EN alphabetical order", () => {
  for (const [element, esPrefix, enPrefix] of [["F", "fluoro", "fluoro"], ["Cl", "cloro", "chloro"], ["Br", "bromo", "bromo"], ["I", "yodo", "iodo"]]) {
    const compound = analyzed(`CC(${element})C(C)CCC`);
    const es = presented(compound, "es");
    const en = presented(compound, "en");
    assert.equal(es.name, element === "I" ? "3-metil-2-yodohexano" : `2-${esPrefix}-3-metilhexano`);
    assert.equal(en.name, `2-${enPrefix}-3-methylhexane`);
    assert.deepEqual(linkedRoles(es), element === "I"
      ? [["3-metil", "substituent"], ["2-yodo", "substituent"], ["hexano", "parent"]]
      : [[`2-${esPrefix}`, "substituent"], ["3-metil", "substituent"], ["hexano", "parent"]]);
    assert.deepEqual(linkedRoles(en), [[`2-${enPrefix}`, "substituent"], ["3-methyl", "substituent"], ["hexane", "parent"]]);
    assert.deepEqual(presented(compound, "es"), es);
    for (const result of [es, en]) {
      assert.ok(result.parts.filter((part) => result.steps.find((step) => step.number === part.stepNumber)?.nameRole === "substituent")
        .every((part) => part.relatedStepNumbers.includes(result.steps.find((step) => step.nameRole === "numbering").number)));
    }
  }
});

test("mixed nitro/alkyl and multiple halogens keep all analyzed prefixes alongside the parent", () => {
  for (const [smiles, prefixCount] of [["CC(C)C[N+](=O)[O-]", 2], ["CC(Br)C(Cl)C(F)C(I)C", 4]]) {
    const compound = analyzed(smiles);
    for (const language of ["es", "en", "es"]) {
      const result = presented(compound, language);
      assert.equal(linkedRoles(result).filter(([, role]) => role === "substituent").length, prefixCount);
      assert.equal(linkedRoles(result).filter(([, role]) => role === "parent").length, 1);
      assert.ok(!linkedRoles(result).some(([text]) => text === result.name));
    }
  }
});

test("substituted benzaldehyde shares retained-parent metadata without consuming the alkyl prefix", () => {
  const compound = analyzed("O=Cc1ccc(C)cc1");
  for (const language of ["es", "en"]) {
    const result = presented(compound, language);
    assert.deepEqual(linkedRoles(result), [[language === "en" ? "4-methyl" : "4-metil", "substituent"],
      ["benz", "parent"], [language === "en" ? "aldehyde" : "aldehído", "function"]]);
    assert.match(result.steps.find((step) => step.nameRole === "function").explanation, language === "en" ? /retained name/ : /nombre retenido/);
  }
});

test("semantic role targets and analyzed retained identity guard parent evidence", () => {
  const compound = analyzed("CCCCC(=O)O");
  const ordinary = presented(compound, "en");
  const remapped = ordinary.steps.map((step) => ({ ...step, number: `target-${step.nameRole}` }));
  const result = presented(compound, "en", { steps: remapped });
  assert.equal(result.parts.find((part) => part.text === "pentan").stepNumber, "target-parent");
  assert.deepEqual(presented(compound, "en", { steps: [] }).fragments, {});
  assert.deepEqual(presented(compound, "en", { canHighlight: false }).fragments, {});
  assert.deepEqual(presented(compound, "en", { displayedName: "hexanoic acid" }).fragments, {});
  assert.equal(retainedFunctionalParentReasoning(analyzed("CCCCC=O").analysis, "en"), undefined,
    "an ordinary aldehyde keeps its existing alkanal reasoning");
  const retained = analyzed("O=Cc1ccccc1").analysis;
  assert.equal(retainedFunctionalParentReasoning({ ...retained, family: "acyclic" }, "en"), undefined);
  assert.equal(retainedFunctionalParentReasoning({ ...retained, mainChain: [retained.functionalGroups[0].carbonId, ...retained.mainChain.slice(1)] }, "es"), undefined);
});

test("parent selection evidence distinguishes rule-supported decisions from structural candidates in both profiles", () => {
  const ibuprofen = analyzed("CC(C)Cc1ccc(cc1)C(C)C(=O)O");
  const trace = ibuprofen.analysis.parentSelectionTrace;
  assert.equal(trace.profile, "blue-book-2013");
  assert.ok(trace.evaluatedCandidateCount >= trace.candidates.length);
  assert.ok(trace.candidates.some(candidate => candidate.selected));
  assert.ok(trace.candidates.filter(candidate => !candidate.selected).every(candidate => candidate.decisiveCriterion),
    "each visible losing chain records its first differing engine criterion");
  assert.ok(trace.candidates.every(candidate => candidate.bondIds.every(([a, b]) =>
    ibuprofen.molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a))));
  const evidenceByLanguage = [];
  for (const language of ["es", "en"]) {
    const evidence = parentStructureSelectionEvidence(ibuprofen.molecule, ibuprofen.analysis, language);
    evidenceByLanguage.push(evidence);
    assert.equal(evidence.level, "rule-supported");
    assert.equal(evidence.reconciliation, "unverified");
    assert.equal(evidence.rule, "P-59.2.1.2");
    assert.deepEqual(evidence.candidates[0].atomIds, ibuprofen.analysis.mainChain);
    assert.equal(evidence.candidates[0].status, "selected-by-engine",
      "the comparator's selection and the separate rule support stay distinguishable");
    const ring = evidence.candidates.find(candidate => candidate.status === "structural-region");
    assert.ok(ring, "the attached aromatic ring is shown as a structural region, not as a defeated parent");
    assert.ok(ring.atomIds.every(id => ibuprofen.molecule.atoms.some(atom => atom.id === id)));
    assert.ok(ring.bondIds.every(([a, b]) => ibuprofen.molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a)));
  }
  assert.equal(evidenceByLanguage[0].candidates[0].id, evidenceByLanguage[1].candidates[0].id,
    "candidate identity is independent of UI language");
  const reenumeratedMolecule = { ...ibuprofen.molecule, atoms: [...ibuprofen.molecule.atoms].reverse(),
    bonds: [...ibuprofen.molecule.bonds].reverse() };
  const reenumerated = page.analyzeMolecule(reenumeratedMolecule);
  assert.equal(reenumerated.name, ibuprofen.analysis.name);
  assert.deepEqual([...reenumerated.mainChain].sort((a,b) => a-b), [...ibuprofen.analysis.mainChain].sort((a,b) => a-b),
    "atom and bond array ordering does not change the selected parent atom set");
  const spanishParentStep = page.buildIupacReasoningSteps(ibuprofen.molecule, ibuprofen.analysis).find(step => step.number === "02");
  const englishParentStep = page.buildEnglishReasoningSteps(page.buildIupacReasoningSteps(ibuprofen.molecule, ibuprofen.analysis),
    ibuprofen.molecule, ibuprofen.analysis).find(step => step.number === "02");
  assert.equal(spanishParentStep.parentSelectionEvidence.level, "rule-supported");
  assert.equal(englishParentStep.parentSelectionEvidence.level, "rule-supported");

  const ethanol = analyzed("CCO");
  const legacy = parentStructureSelectionEvidence(ethanol.molecule, ethanol.analysis, "en", "ethan-1-ol", "iupac-1979-legacy");
  assert.equal(legacy.level, "structural");
  assert.equal(legacy.candidates[0].status, "candidate");
  assert.equal(legacy.rule, undefined, "2013 rule references are not carried into the 1979 profile");

  const fluoxetine = analyzed("CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  const partial = parentStructureSelectionEvidence(fluoxetine.molecule, fluoxetine.analysis, "es");
  assert.equal(fluoxetine.analysis.parentSelectionTrace, undefined,
    "a different-family local analysis is not presented as if the acyclic selector compared it");
  assert.equal(partial?.level, "rule-supported", "the amine-bound propyl chain is distinguished from the N-methyl candidate");
  assert.equal(partial?.reconciliation, "unverified");
  assert.equal(partial?.amineParentSelection?.outcome, "acyclic-parent");
  assert.equal(partial?.amineParentSelection?.rule, "P-44.3.2");
  assert.ok(partial?.candidates.some(candidate => candidate.status === "selected-by-rule"
    && candidate.atomIds.length === 3), "the graph-backed propyl region wins over the methyl region");
  assert.match(partial?.explanation ?? "", /P-44.3.2/);
  assert.ok(partial.candidates.some(candidate => candidate.status === "not-compared" && candidate.regionKind === "aromatic-ring"),
    "fluoxetine exposes its other aromatic ring as a graph-backed unresolved region");
  assert.ok(partial.candidates.some(candidate => candidate.evidenceKind === "parent"
    && candidate.status === "selected-by-rule" && candidate.atomIds.length === 3),
  "the amine-linked propyl carbon region is exposed as the rule-supported parent candidate");
  assert.equal(fluoxetine.analysis.parentSelectionTrace, undefined,
    "unresolved regions do not fabricate a cross-family selector trace");

  const reconciled = reconciledParentSelectionEvidence({ molecule: ibuprofen.molecule,
    parentAtomIds: ibuprofen.analysis.mainChain, derivationName: "validated name", activeName: "validated name", language: "en" });
  assert.equal(reconciled.level, "name-reconciled");
  assert.equal(reconciled.reconciliation, "verified");
  assert.equal(reconciled.candidates[0].status, "name-reconciled");
  assert.equal(reconciledParentSelectionEvidence({ molecule: ibuprofen.molecule,
    parentAtomIds: ibuprofen.analysis.mainChain, derivationName: "validated name", activeName: "other name", language: "en" }), undefined,
  "a mismatching active name cannot inherit full reconciliation");
});

test("a principal group confined to a cycloalkane supports the cyclic-parent rule without promoting its side chain", () => {
  const compound = analyzed("OC1CCCCC1CC");
  const evidence = parentStructureSelectionEvidence(compound.molecule, compound.analysis, "es");
  assert.equal(compound.analysis.primaryFunctionalGroup, "alcohol");
  assert.equal(evidence.level, "rule-supported");
  assert.equal(evidence.rule, "P-59.2.1.4");
  assert.equal(evidence.reconciliation, "unverified");
  assert.equal(evidence.candidates[0].status, "selected-by-rule");
  assert.equal(evidence.candidates[0].regionKind, "carbocyclic-ring");
  assert.equal(evidence.candidates[0].principalGroupCount, 1);
  const context = evidence.candidates.find(item => item.status === "structural-region");
  assert.ok(context);
  assert.ok(context.atomIds.every(id => !compound.analysis.mainChain.includes(id)));
  assert.ok(context.bondIds.every(([a, b]) => compound.molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a)));
  assert.match(evidence.explanation, /no como candidata a padre evaluada/);

  const legacy = parentStructureSelectionEvidence(compound.molecule, compound.analysis, "en",
    compound.analysis.chainName, "iupac-1979-legacy");
  assert.equal(legacy.level, "structural");
  assert.equal(legacy.rule, undefined, "the 2013 P-59 criterion is not borrowed by the legacy profile");
});

test("principal-group occurrences are counted by identity across simple chain and ring candidates", () => {
  const chainWins = analyzed("OCC(O)CC1CC(O)CCC1");
  const chainEvidence = parentStructureSelectionEvidence(chainWins.molecule, chainWins.analysis, "es");
  assert.equal(chainEvidence.principalGroupComparison?.groupKind, "alcohol");
  assert.equal(chainEvidence.principalGroupComparison?.chainCount, 2);
  assert.equal(chainEvidence.principalGroupComparison?.ringCount, 1);
  assert.equal(chainEvidence.principalGroupComparison?.winner, "chain");
  assert.equal(chainEvidence.rule, "P-44.1.1; P-59.2.1.6");
  assert.equal(chainEvidence.reconciliation, "unverified");
  const countTargets = chainEvidence.candidates.filter(item => item.evidenceKind === "principal-groups");
  assert.equal(countTargets.length, 3);
  assert.equal(new Set(countTargets.flatMap(item => item.principalGroupIds ?? [])).size, 3);
  assert.ok(countTargets.every(item => item.atomIds.length === 2 && item.bondIds.length === 1));
  assert.ok(chainEvidence.candidates.some(item => item.status === "selected-by-rule" && item.regionKind === "acyclic-chain"
    && item.principalGroupCount === 2));
  assert.ok(chainEvidence.candidates.some(item => item.status === "evaluated-alternative" && item.regionKind === "carbocyclic-ring"
    && item.principalGroupCount === 1));
  assert.match(chainEvidence.explanation, /2 ocurrencias.*frente a 1/);

  const ketones = analyzed("CC(=O)CCC(=O)C1CC(=O)CCC1");
  const ketoneEvidence = parentStructureSelectionEvidence(ketones.molecule, ketones.analysis, "en");
  assert.equal(ketones.analysis.primaryFunctionalGroup, "ketone");
  assert.equal(ketoneEvidence.principalGroupComparison?.chainCount, 2);
  assert.equal(ketoneEvidence.principalGroupComparison?.ringCount, 1);
  assert.equal(ketoneEvidence.principalGroupComparison?.winner, "chain");

  const ringWins = analyzed("OCC1CC(O)C(O)CC1");
  const ringEvidence = parentStructureSelectionEvidence(ringWins.molecule, ringWins.analysis, "en");
  assert.equal(ringEvidence.principalGroupComparison?.chainCount, 1);
  assert.equal(ringEvidence.principalGroupComparison?.ringCount, 2);
  assert.equal(ringEvidence.principalGroupComparison?.winner, "ring");
  assert.match(ringEvidence.explanation, /ring candidates express up to 2 occurrences/);

  const tied = analyzed("OCC1CC(O)CCC1");
  const tieEvidence = parentStructureSelectionEvidence(tied.molecule, tied.analysis, "en");
  assert.equal(tieEvidence.principalGroupComparison?.chainCount, 1);
  assert.equal(tieEvidence.principalGroupComparison?.ringCount, 1);
  assert.equal(tieEvidence.principalGroupComparison?.winner, "ring");
  assert.equal(tieEvidence.principalGroupComparison?.pinPreferenceApplied, false);
  assert.match(tieEvidence.explanation, /P-59.2.1.7 is PIN-specific/);

  const reversedMolecule = { ...chainWins.molecule, atoms: [...chainWins.molecule.atoms].reverse(),
    bonds: [...chainWins.molecule.bonds].reverse() };
  const reversedAnalysis = page.analyzeMolecule(reversedMolecule);
  const reversedEvidence = parentStructureSelectionEvidence(reversedMolecule, reversedAnalysis, "en");
  assert.equal(reversedEvidence.principalGroupComparison?.chainCount, 2);
  assert.equal(reversedEvidence.principalGroupComparison?.ringCount, 1);
  assert.equal(reversedEvidence.principalGroupComparison?.winner, "chain");
  const reversedRepresentation = analyzed("OC1CCC(CCC(O)CO)CC1");
  const representationEvidence = parentStructureSelectionEvidence(reversedRepresentation.molecule,
    reversedRepresentation.analysis, "en");
  assert.equal(representationEvidence.principalGroupComparison?.chainCount, 2);
  assert.equal(representationEvidence.principalGroupComparison?.ringCount, 1);
  assert.equal(representationEvidence.principalGroupComparison?.winner, "chain",
    "a different SMILES traversal of the same connectivity preserves the chemical comparison");
  const legacy = parentStructureSelectionEvidence(chainWins.molecule, chainWins.analysis, "en",
    chainWins.analysis.chainName, "iupac-1979-legacy");
  assert.equal(legacy.principalGroupComparison, undefined,
    "the 2013 chain/ring count criteria are not transferred into IUPAC 1979");
});

test("principal-group comparison ignores lower-priority groups and excludes non-suffix nitro", () => {
  const mixedPriority = analyzed("OCC1C(=O)CCC(O)C1");
  const evidence = parentStructureSelectionEvidence(mixedPriority.molecule, mixedPriority.analysis, "en");
  assert.equal(mixedPriority.analysis.primaryFunctionalGroup, "ketone");
  assert.equal(evidence.principalGroupComparison, undefined,
    "exclusive ring function uses its dedicated rule; side-chain hydroxyl does not inflate the ketone count");
  assert.equal(evidence.candidates[0].principalGroupCount, 1,
    "only the principal ketone contributes; the lower-priority alcohol is excluded");

  const tnt = analyzed("Cc1c([N+](=O)[O-])c([N+](=O)[O-])c([N+](=O)[O-])cc1");
  const tntEvidence = parentStructureSelectionEvidence(tnt.molecule, tnt.analysis, "es");
  assert.equal(tnt.analysis.primaryFunctionalGroup, undefined);
  assert.equal(tntEvidence.principalGroupComparison, undefined);

  const hydrocarbon = analyzed("CC1CCCCC1");
  const hydrocarbonEvidence = parentStructureSelectionEvidence(hydrocarbon.molecule, hydrocarbon.analysis, "es");
  assert.equal(hydrocarbonEvidence.principalGroupComparison, undefined);

  const dopamine = analyzed("NCCc1cc(O)c(O)cc1");
  const dopamineEvidence = parentStructureSelectionEvidence(dopamine.molecule, dopamine.analysis, "es");
  assert.equal(dopamine.analysis.primaryFunctionalGroup, "alcohol");
  assert.equal(dopamineEvidence.principalGroupComparison, undefined,
    "the ring alcohols are principal; the chain amine cannot inflate their suffix count");
  assert.equal(dopamineEvidence.candidates[0].principalGroupCount, 2);

  const fused = analyzed("OCC1CCC2CCCCC2C1");
  assert.equal(fused.analysis.family, "polycyclic");
  const fusedEvidence = parentStructureSelectionEvidence(fused.molecule, fused.analysis, "es");
  assert.equal(fusedEvidence, undefined,
    "no comparison is fabricated when the fused-parent selector supplies no comparable region");
});

test("a carboxyl group outside a ring is one suffix occurrence associated with that cyclic parent", () => {
  const compound = analyzed("O=C(O)C1CCCCC1");
  const evidence = parentStructureSelectionEvidence(compound.molecule, compound.analysis, "en");
  assert.equal(compound.analysis.primaryFunctionalGroup, "carboxylicAcid");
  assert.equal(evidence.candidates[0].principalGroupCount, 1,
    "the two oxygens do not become two carboxyl occurrences");
  assert.equal(evidence.principalGroupComparison, undefined,
    "the exocyclic carboxyl carbon belongs to the cyclic suffix construction, not a one-carbon chain comparison");
  assert.match(evidence.explanation, /carbon of –COOH remains outside the ring/);

  const mixed = analyzed("O=C(O)CC1CCC(C(=O)O)CC1");
  const mixedEvidence = parentStructureSelectionEvidence(mixed.molecule, mixed.analysis, "en");
  assert.equal(mixed.analysis.primaryFunctionalGroup, "carboxylicAcid");
  assert.equal(mixedEvidence.principalGroupComparison?.chainCount, 1);
  assert.equal(mixedEvidence.principalGroupComparison?.ringCount, 1);
  assert.equal(mixedEvidence.principalGroupComparison?.winner, "ring");
  const occurrences = mixedEvidence.candidates.filter(item => item.evidenceKind === "principal-groups");
  assert.equal(occurrences.length, 2, "each –COOH is one group occurrence regardless of its two oxygen atoms");
  assert.deepEqual(occurrences.map(item => [item.atomIds.length, item.bondIds.length]).sort((a, b) => a[0] - b[0]),
    [[3, 2], [4, 3]], "the directly ring-bound carboxyl target adds the ring atom and attachment bond");
});

test("secondary amine candidates retain one occurrence identity and fluoxetine stays partial", () => {
  const fluoxetine = analyzed("CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  const amine = fluoxetine.analysis.functionalGroups.find(group => group.kind === "amine");
  assert.ok(amine);
  assert.equal(fluoxetine.analysis.functionalGroups.filter(group => group.kind === "amine").length, 1);
  assert.equal(new Set(amine.carbonIds).size, 2, "the N-bound methyl and propyl regions remain separate candidates");
  const evidence = parentStructureSelectionEvidence(fluoxetine.molecule, fluoxetine.analysis, "es");
  assert.equal(evidence.principalGroupComparison, undefined,
    "the amine is absent from the aromatic rings, so ring-chain group counts cannot choose between N-bound chains");
  const amineTargets = evidence.candidates.filter(item => item.evidenceKind === "amine-function");
  assert.equal(amineTargets.length, 1,
    "the two N-bound carbon regions share one selectable amine occurrence identity");
  assert.equal(fluoxetine.analysis.parentSelectionTrace, undefined);
  assert.equal(evidence.reconciliation, "unverified");
});

test("secondary and tertiary amine parent selection follows direct N attachments and traceable chain rules", () => {
  const cases = [
    ["N-methylethanamine", "CCNC", 2, [2, 1]],
    ["N-ethylpropan-1-amine", "CCCNCC", 2, [3, 2]],
    ["N-methylpropan-2-amine", "CC(C)NC", 2, [3, 1]],
    ["N,N-dimethylpropan-1-amine", "CCCN(C)C", 3, [3, 1, 1]],
    ["N-ethyl-N-methylbutan-1-amine", "CCCCN(CC)C", 3, [4, 2, 1]],
  ];
  for (const [label, smiles, degree, sizes] of cases) {
    const compound = analyzed(smiles);
    const evidence = parentStructureSelectionEvidence(compound.molecule, compound.analysis, "es");
    assert.equal(compound.analysis.primaryFunctionalGroup, "amine", `${label} keeps amine as its principal function`);
    assert.equal(compound.analysis.functionalGroups.filter(group => group.kind === "amine").length, 1,
      `${label} has one amine occurrence independent of N-bound carbon count`);
    assert.equal(evidence.amineParentSelection?.nitrogenDegree, degree, label);
    assert.equal(evidence.amineParentSelection?.outcome, "acyclic-parent", label);
    assert.equal(evidence.amineParentSelection?.rule, "P-44.3.2", label);
    const parent = evidence.candidates.find(candidate => candidate.status === "selected-by-rule");
    assert.ok(parent, label);
    assert.equal(parent.atomIds.filter(id => compound.molecule.atoms.find(atom => atom.id === id)?.element === "C").length,
      Math.max(...sizes), label);
    assert.ok(parent.atomIds.every(id => compound.molecule.atoms.find(atom => atom.id === id)?.element === "C"),
      "the selected carbon skeleton excludes the exocyclic nitrogen");
    assert.ok(parent.bondIds.every(([a, b]) => compound.molecule.bonds.some(([x, y]) => x === a && y === b || x === b && y === a)));
    assert.equal(evidence.candidates.filter(candidate => candidate.evidenceKind === "amine-function").length, 1);
    assert.equal(evidence.candidates.filter(candidate => candidate.evidenceKind === "nitrogen-atom").length, 1);
    assert.equal(evidence.candidates.filter(candidate => candidate.evidenceKind === "nitrogen-attachment").length, degree);
    assert.equal(evidence.reconciliation, "unverified");
  }

  const fluoxetine = analyzed("CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  const fluoxetineEvidence = parentStructureSelectionEvidence(fluoxetine.molecule, fluoxetine.analysis, "en");
  const fluoxetineParent = fluoxetineEvidence.candidates.find(candidate => candidate.status === "selected-by-rule");
  assert.equal(fluoxetineEvidence.amineParentSelection?.rule, "P-44.3.2");
  assert.equal(fluoxetineParent.atomIds.filter(id => fluoxetine.molecule.atoms.find(atom => atom.id === id)?.element === "C").length, 3);
  assert.ok(fluoxetineEvidence.candidates.some(candidate => candidate.evidenceKind === "n-substituent"
    && /N-methyl/.test(candidate.label) && candidate.atomIds.length === 1));
  assert.ok(fluoxetineEvidence.candidates.filter(candidate => candidate.evidenceKind === "parent")
    .every(candidate => !fluoxetine.molecule.rings?.some(ring => ring.atomIds.some(id => candidate.atomIds.includes(id)))),
  "the parent selection highlights the propyl carbon path only, not its phenyl substituent or phenoxy ring");
  assert.match(fluoxetineEvidence.explanation, /does not change or fully reconcile the active generated name/);
  assert.equal(fluoxetine.analysis.parentSelectionTrace, undefined);

  const ringAmine = analyzed("CCCCNC1CC1");
  const ringEvidence = parentStructureSelectionEvidence(ringAmine.molecule, ringAmine.analysis, "en");
  assert.equal(ringEvidence.amineParentSelection?.outcome, "cyclic-parent");
  assert.equal(ringEvidence.amineParentSelection?.rule, "P-62.2.2.2");
  const ringParent = ringEvidence.candidates.find(candidate => candidate.status === "selected-by-rule");
  assert.ok(ringParent);
  assert.ok(ringParent.atomIds.every(id => ringAmine.molecule.atoms.find(atom => atom.id === id)?.element === "C"));
  assert.equal(ringParent.atomIds.length, 3, "the ring parent excludes the N atom and butyl N-substituent");
});

test("equal amine substituents stay unresolved, lower-priority amines and legacy profile do not borrow suffix rules", () => {
  const triethylamine = analyzed("CCN(CC)CC");
  const tie = parentStructureSelectionEvidence(triethylamine.molecule, triethylamine.analysis, "en");
  assert.equal(tie.amineParentSelection?.outcome, "unresolved");
  assert.equal(tie.level, "selection-traced");
  assert.equal(tie.candidates.filter(candidate => candidate.status === "candidate" && candidate.regionKind === "acyclic-chain").length, 3,
    "three equal N-ethyl regions are preserved without an arbitrary winner");
  assert.doesNotMatch(tie.explanation, /selected amine-parent chain/i);

  const acidAmine = analyzed("NCC(=O)O");
  const acidEvidence = parentStructureSelectionEvidence(acidAmine.molecule, acidAmine.analysis, "en");
  assert.equal(acidAmine.analysis.primaryFunctionalGroup, "carboxylicAcid");
  assert.equal(acidEvidence.amineParentSelection, undefined,
    "the lower-priority amine is not used to select the suffix parent");

  const amide = analyzed("CC(=O)NCC");
  assert.ok(!amide.analysis.functionalGroups.some(group => group.kind === "amine"),
    "amide nitrogen is not reclassified as an amine");
  assert.equal(parentStructureSelectionEvidence(amide.molecule, amide.analysis, "en").amineParentSelection, undefined);

  const propylamine = analyzed("CCCNCC");
  const legacy = parentStructureSelectionEvidence(propylamine.molecule, propylamine.analysis, "en",
    propylamine.analysis.chainName, "iupac-1979-legacy");
  assert.equal(legacy.amineParentSelection, undefined,
    "2013 secondary-amine parent rules are not transferred to IUPAC 1979");

  const reordered = { ...propylamine.molecule, atoms: [...propylamine.molecule.atoms].reverse(),
    bonds: [...propylamine.molecule.bonds].reverse() };
  const reorderedAnalysis = page.analyzeMolecule(reordered);
  const reorderedEvidence = parentStructureSelectionEvidence(reordered, reorderedAnalysis, "en");
  assert.equal(reorderedEvidence.amineParentSelection?.outcome, "acyclic-parent");
  assert.equal(reorderedEvidence.candidates.find(candidate => candidate.status === "selected-by-rule").atomIds.length, 3);
  const alternativeSmiles = analyzed("CCNCCC");
  const alternativeEvidence = parentStructureSelectionEvidence(alternativeSmiles.molecule, alternativeSmiles.analysis, "en");
  assert.equal(alternativeEvidence.amineParentSelection?.outcome, "acyclic-parent");
  assert.equal(alternativeEvidence.candidates.find(candidate => candidate.status === "selected-by-rule").atomIds.length, 3,
    "reversing the SMILES traversal keeps the same N-propyl parent choice");

  const polyamine = analyzed("NCCNCC");
  assert.equal(parentStructureSelectionEvidence(polyamine.molecule, polyamine.analysis, "en").amineParentSelection, undefined,
    "multiple amine sites defer to P-62.2.4 rather than the single-N selector");
});
