import { isDeepStrictEqual } from "node:util";
import { moleculeFromSmiles, moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { applyNomenclatureConvention, stripStereochemicalDescriptors } from "../../app/nomenclature-conventions.ts";
import { localizeChemicalNameForDisplay, translateSpanishIupacForDisplay } from "../../app/iupac-name-normalization.ts";
import { generateLegacyEnglishName } from "../../app/legacy-english-nomenclature.ts";
import { formatStereochemicalName, getMainChainStereoDescriptors } from "../../app/double-bond-stereochemistry.ts";
import { getTetrahedralStereoCenters } from "../../app/tetrahedral-stereochemistry.ts";
import { structuralIdentity } from "../../tests/helpers/reference-corpus.mjs";

export const PROFILES = Object.freeze(["2013-es", "2013-en", "1979-es", "1979-en"]);
const clone = (value) => structuredClone(value);
export const serializable = (value) => JSON.parse(JSON.stringify(value, (_, item) => item instanceof Map ? [...item] : item instanceof Set ? [...item] : item));
const check = (pass, detail) => ({ status: pass ? "PASS" : "FAIL", ...(detail ? { detail } : {}) });
const skip = (detail) => ({ status: "SKIP", detail });

export function analyzeBoth(molecule, engine) {
  return { current: engine.analyzeMolecule(molecule), legacy: engine.analyzeMolecule(molecule, [], "iupac-1979-legacy") };
}

// Match the local UI path, without source-name override, external PubChem
// identity, or common alkyl aliases. Explicit imported stereo is enabled.
export function displayedProfiles(molecule, analyses, engine) {
  const unavailable = engine.externalCandidateNeedsNeutralLocalName(molecule, analyses.current)
    || engine.heterocycleHasUnrepresentedHydroxylGroups(molecule);
  const withStereo = (analysis, base) => getMainChainStereoDescriptors(molecule, analysis.mainChain, true).length
    || getTetrahedralStereoCenters(molecule).length
    ? formatStereochemicalName(molecule, analysis.mainChain, base, { explicitDoubleBonds: true }) : base;
  const currentBase = stripStereochemicalDescriptors(engine.suggestedIupacNameWithOmittedLocants(analyses.current));
  const current = unavailable ? null : withStereo(analyses.current, currentBase);
  const legacy = unavailable ? null : withStereo(analyses.legacy, analyses.legacy.name);
  const currentName = (language) => current === null ? null : applyNomenclatureConvention(
    engine.localizeSupportedSteroidConstitutionName(current, language)
      ?? (language === "en" ? translateSpanishIupacForDisplay(current) || current : localizeChemicalNameForDisplay(current, "es")),
    "current", language);
  const spanishLegacy = legacy === null ? "-" : applyNomenclatureConvention(
    engine.legacySpanishFormatterInput(analyses.legacy, legacy), "iupac-1979-es", "es");
  const englishLegacy = legacy === null || !engine.legacyEnglishProfileIsSupportedForMolecule(molecule)
    ? "-" : generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(molecule, analyses.legacy, legacy)).name;
  return {
    "2013-es": { name: currentName("es"), convention: "current", language: "es", selected: "current" },
    "2013-en": { name: currentName("en"), convention: "current", language: "en", selected: "current" },
    "1979-es": { name: spanishLegacy === "-" ? null : spanishLegacy, convention: "iupac-1979-es", language: "es", selected: "legacy" },
    "1979-en": { name: englishLegacy === "-" ? null : englishLegacy, convention: "iupac-1979-legacy-en", language: "en", selected: "legacy" },
  };
}

function analysisSnapshot(analysis, molecule) {
  return {
    name: analysis.name, chainName: analysis.chainName, family: analysis.family, formula: analysis.formula,
    parentAtomIds: analysis.mainChain, parentAtomCount: analysis.mainChain.length,
    parentCarbonCount: analysis.mainChain.filter((id) => (molecule.atoms.find((a) => a.id === id)?.element ?? "C") === "C").length,
    primaryFunctionalGroup: analysis.primaryFunctionalGroup ?? null,
    numberedAtoms: [...analysis.numberedAtoms], doubleBondLocants: analysis.doubleBondLocants, tripleBondLocants: analysis.tripleBondLocants,
    functionalGroups: analysis.functionalGroups.map(({ kind, atomIds, carbonIds, carbonId }) => ({ kind, atomIds, carbonIds, carbonId,
      locants: carbonIds.map((id) => analysis.numberedAtoms.get(id) ?? null) })),
    substituents: analysis.substituents.map(({ name, locant, atomIds, complex }) => ({ name, locant, atomIds, complex })),
  };
}

function bondOrder(molecule, first, second) {
  return molecule.bonds.find(([a, b]) => a === first && b === second || a === second && b === first)?.[2] ?? null;
}

function profileChecks(model, analysis, molecule) {
  const problems = [];
  const add = (code, detail, evidence) => problems.push({ code, detail, ...(evidence ? { evidence } : {}) });
  const atoms = new Set(molecule.atoms.map(({ id }) => id));
  const steps = new Set(model.steps.map(({ number }) => number));
  if (model.analysis !== analysis) add("WRONG_SELECTED_ANALYSIS", "Reasoning model did not reuse the selected analysis object");
  if (model.links.map(({ text }) => text).join("") !== model.displayedName) add("NAME_RECONSTRUCTION", "Link segments do not reconstruct the displayed name");
  for (const link of model.links) {
    for (const target of [link.stepNumber, ...(link.relatedStepNumbers ?? [])].filter(Boolean)) {
      if (!steps.has(target)) add("INVALID_NAVIGATION", "Link targets absent step", { text: link.text, target });
    }
  }
  const flat = Object.entries(model.fragments).flatMap(([stepNumber, fragment]) =>
    [fragment, ...(fragment.additionalFragments ?? [])].map((item) => ({ stepNumber, ...item, additionalFragments: undefined })));
  const spans = new Set();
  for (const fragment of flat) {
    const start = fragment.start ?? model.displayedName.indexOf(fragment.text);
    const key = `${fragment.stepNumber}:${start}:${fragment.text}`;
    if (spans.has(key)) add("DUPLICATE_FRAGMENT", "Same written span duplicated within one step", { key });
    spans.add(key);
    if (start < 0 || model.displayedName.slice(start, start + fragment.text.length) !== fragment.text) {
      add("NONLITERAL_FRAGMENT", "Fragment is not the exact displayed substring at start", { text: fragment.text, start });
    }
    if (!steps.has(fragment.stepNumber)) add("INVALID_NAVIGATION", "Fragment targets absent step", { stepNumber: fragment.stepNumber });
    if (fragment.atomIds?.some((id) => !atoms.has(id))) add("NONEXISTENT_HIGHLIGHT_ATOM", "Fragment references a nonexistent atom", { text: fragment.text, atomIds: fragment.atomIds });
    if (fragment.kind === "parent" && fragment.atomIds && !isDeepStrictEqual([...fragment.atomIds].sort((a, b) => a - b), [...analysis.mainChain].sort((a, b) => a - b))) {
      add("PARENT_HIGHLIGHT_MISMATCH", "Parent span does not highlight the selected parent", { text: fragment.text, atomIds: fragment.atomIds, parent: analysis.mainChain });
    }
    for (const pair of fragment.bondIds ?? []) {
      const order = bondOrder(molecule, ...pair);
      if (!order || fragment.bondType && order !== (fragment.bondType === "double" ? 2 : 3)) {
        add("WRONG_BOND_HIGHLIGHT", "Typed fragment refers to an absent/differently ordered bond", { text: fragment.text, pair, order, bondType: fragment.bondType });
      }
    }
  }
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) {
    const a = flat[i], b = flat[j];
    const sa = a.start ?? model.displayedName.indexOf(a.text), sb = b.start ?? model.displayedName.indexOf(b.text);
    const ea = sa + a.text.length, eb = sb + b.text.length;
    // Contained numbering/suffix evidence is intentional and represented by
    // relatedStepNumbers. Crossing (noncontained) claims are not equivalent.
    if (sa < sb && sb < ea && ea < eb || sb < sa && sa < eb && eb < ea) {
      add("CROSSING_FRAGMENT_SPANS", "Evidence spans partially cross", { a: [a.text, sa, a.stepNumber], b: [b.text, sb, b.stepNumber] });
    }
  }
  for (const step of model.steps.filter((s) => s.nameRole === "unsaturation")) {
    for (const match of step.explanation.matchAll(/C(\d+)([=≡])C(\d+)/g)) {
      const [, from, symbol, to] = match;
      const order = bondOrder(molecule, analysis.mainChain[Number(from) - 1], analysis.mainChain[Number(to) - 1]);
      if (order !== (symbol === "=" ? 2 : 3)) add("EXPLANATION_BOND_CLAIM_REVIEW", "Numbered bond statement needs review against selected parent", { claim: match[0], order, explanation: step.explanation });
    }
  }
  return { problems, fragments: flat.map(({ text, start, stepNumber, kind, atomIds, bondType, locant, semanticId }) => ({ text, start, stepNumber, kind, atomIds, bondType, locant, semanticId })),
    links: model.links.map(({ text, stepNumber, relatedStepNumbers, atomIds, bondType, locant, semanticId }) => ({ text, stepNumber, relatedStepNumbers, atomIds, bondType, locant, semanticId })),
    steps: model.steps.map(({ number, nameRole, explanation }) => ({ number, nameRole, explanation })),
    fragmentCount: flat.length, linkedSegments: model.links.filter((p) => p.stepNumber).length };
}

function analysisChecks(analysis, molecule) {
  const problems = [], ids = new Set(molecule.atoms.map((a) => a.id));
  if (new Set(analysis.mainChain).size !== analysis.mainChain.length || analysis.mainChain.some((id) => !ids.has(id))) {
    problems.push({ code: "INVALID_PARENT_ATOMS", detail: "Parent has duplicate or nonexistent atoms" });
  }
  for (const [type, locants] of [["double", analysis.doubleBondLocants], ["triple", analysis.tripleBondLocants]]) for (const locant of locants) {
    const from = analysis.mainChain[locant - 1];
    const to = analysis.mainChain[analysis.family === "cycloalkane" ? locant % analysis.mainChain.length : locant];
    const order = bondOrder(molecule, from, to);
    if (order !== (type === "double" ? 2 : 3)) problems.push({ code: "ANALYSIS_BOND_LOCANT", detail: "Analyzed parent locant does not match the actual bond", evidence: { type, locant, from, to, order } });
  }
  // Normative order only, applied to the groups the production detector found.
  // This is not an independent group detector or full nomenclature oracle.
  const priority = ["carboxylicAcid", "sulfonicAcid", "ester", "amide", "nitrile", "aldehyde", "ketone", "alcohol", "amine"];
  const senior = priority.find((kind) => analysis.functionalGroups.some((group) => group.kind === kind));
  if (senior && analysis.primaryFunctionalGroup !== senior) problems.push({ code: "DETECTED_GROUP_PRIORITY", detail: "Priority disagrees with P-41 order on production-detected groups", evidence: { senior, selected: analysis.primaryFunctionalGroup } });
  return problems;
}

// Alternate traversal of a neutral, non-stereo acyclic editable graph. This
// serializes connectivity only; OCL identity MUST agree before it is exercised.
function alternateTreeSmiles(molecule) {
  if (molecule.bonds.length !== molecule.atoms.length - 1 || molecule.atoms.some((a) => a.charge || a.tetrahedralParity || a.isotope)
    || molecule.bonds.some((b) => b[3])) return;
  const visited = new Set();
  const walk = (id, parent) => {
    visited.add(id);
    const atom = molecule.atoms.find((a) => a.id === id);
    const next = molecule.bonds.flatMap(([a, b, order = 1]) => a === id && b !== parent ? [[b, order]] : b === id && a !== parent ? [[a, order]] : [])
      .sort((a, b) => b[0] - a[0]);
    if (next.some(([child]) => visited.has(child))) throw new Error("cycle in tree variant");
    return (atom.element ?? "C") + next.map(([child, order], index) => {
      const text = (order === 2 ? "=" : order === 3 ? "#" : "") + walk(child, id);
      return index === next.length - 1 ? text : `(${text})`;
    }).join("");
  };
  return walk(molecule.atoms.at(-1).id);
}

export function evaluateCase(record, engine) {
  const result = { ...record, admission: { status: "PENDING" }, profiles: {}, properties: {}, signals: [], findings: [] };
  const converted = moleculeFromSmiles(record.smiles);
  if (!converted.ok) {
    result.admission = { status: "UNSUPPORTED", reason: converted.error, independentlyParseable: true };
    for (const profile of PROFILES) result.profiles[profile] = { status: "UNSUPPORTED", name: null, exact: "UNSUPPORTED", evidenceLevel: record.expected[profile] ? "GOLD" : "GENERATED" };
    result.properties.importExportIdentity = skip("Production import explicitly rejected this independently parseable boundary graph");
    return result;
  }
  const molecule = converted.molecule, original = clone(molecule);
  result.admission = { status: "IMPORTED", atomCount: molecule.atoms.length, bondCount: molecule.bonds.length,
    elements: [...new Set(molecule.atoms.map((a) => a.element ?? "C"))].sort(), charge: molecule.atoms.reduce((s, a) => s + (a.charge ?? 0), 0) };
  const initialExport = moleculeToSmiles(molecule);
  result.properties.importExportIdentity = check(initialExport.ok && structuralIdentity(initialExport.smiles) === record.identity,
    initialExport.ok ? initialExport.smiles : initialExport.error);
  try {
    const analyses = analyzeBoth(molecule, engine), analysisBefore = clone(analyses);
    const repeats = analyzeBoth(molecule, engine);
    result.properties.determinism = check(isDeepStrictEqual(serializable(analyses), serializable(repeats)));
    const profiles = displayedProfiles(molecule, analyses, engine);
    const repeatNames = displayedProfiles(molecule, repeats, engine);
    result.properties.nameDeterminism = check(isDeepStrictEqual(profiles, repeatNames));
    const models = {};
    for (const key of PROFILES) {
      const profile = profiles[key], analysis = analyses[profile.selected];
      const expected = record.expected[key];
      const row = { status: profile.name === null ? "UNSUPPORTED" : "NAMED", name: profile.name,
        ...(expected ? { expected } : {}), evidenceLevel: expected ? "GOLD" : "GENERATED",
        exact: profile.name === null ? "UNSUPPORTED" : expected ? (profile.name === expected ? "PASS" : "FAIL") : "UNVERIFIED",
        analysis: analysisSnapshot(analysis, molecule), structuralNameInterpretation: { status: "UNVERIFIED" } };
      result.profiles[key] = row;
      if (profile.name === null) {
        row.unsupportedReason = engine.externalCandidateNeedsNeutralLocalName(molecule, analyses.current)
          ? "UI safety gate blocks local naming for this graph"
          : key === "1979-en" && !engine.legacyEnglishProfileIsSupportedForMolecule(molecule)
            ? "Legacy EN explicitly excludes heterocycles" : "Selected production formatter has no admitted grammar";
        if (expected) result.signals.push({ profile: key, code: "UNEXPECTED_UNAVAILABLE", detail: "Individually derived exact expectation has no local output" });
        continue;
      }
      const model = engine.buildActiveIupacReasoning({ molecule, analyses, ...profile, displayedName: profile.name,
        generatedNames: PROFILES.map((p) => profiles[p].name).filter(Boolean), canHighlight: true });
      models[key] = model;
      row.reasoning = profileChecks(model, analysis, molecule);
      for (const problem of [...analysisChecks(analysis, molecule), ...row.reasoning.problems]) result.signals.push({ profile: key, ...problem });
      if (row.exact === "FAIL") result.signals.push({ profile: key, code: "EXACT_NAME_MISMATCH", detail: "Output differs from individually derived expectation", evidence: { expected, actual: profile.name } });
    }
    // Exercise the same pure projection sequence as the public language/profile
    // selector. Browser selection, theme and DOM layout are not simulated here.
    let last;
    for (const key of ["2013-es", "2013-en", "1979-es", "1979-en", "2013-es"]) {
      const p = profiles[key];
      if (p.name === null) continue;
      last = engine.buildActiveIupacReasoning({ molecule, analyses, ...p, displayedName: p.name,
        generatedNames: PROFILES.map((k) => profiles[k].name).filter(Boolean), canHighlight: true });
    }
    result.properties.profileLanguageReturn = models["2013-es"] && last
      ? check(isDeepStrictEqual(serializable(last), serializable(models["2013-es"]))) : skip("Current profile unavailable");
    result.properties.analysisImmutability = check(isDeepStrictEqual(serializable(analyses), serializable(analysisBefore)));
    const visual = clone(molecule);
    for (const atom of visual.atoms) { atom.x = atom.x * 1.125 + 37; atom.y = atom.y * 1.125 - 19; }
    const visualNames = displayedProfiles(visual, analyzeBoth(visual, engine), engine);
    result.properties.coordinateIndependence = check(PROFILES.every((p) => visualNames[p].name === profiles[p].name));
    result.properties.themeDOM = skip("UI theme/browser state not exercised; positive coordinate scale/translation tested separately");
    const variants = new Set([...(record.equivalentSmiles ?? []), ...(initialExport.ok ? [initialExport.smiles] : [])]);
    try { const tree = alternateTreeSmiles(molecule); if (tree) variants.add(tree); } catch { /* cyclic/stereo graph is not a tree candidate */ }
    const comparisons = [];
    for (const smiles of [...variants].filter((s) => s !== record.smiles).slice(0, 2)) {
      let identity;
      try { identity = structuralIdentity(smiles); } catch { continue; }
      if (identity !== record.identity) continue; // Not a proven equivalent representation.
      const parsed = moleculeFromSmiles(smiles);
      if (!parsed.ok) { comparisons.push({ smiles, status: "FAIL", reason: "Equivalent SMILES was rejected by production importer" }); continue; }
      const variantProfiles = displayedProfiles(parsed.molecule, analyzeBoth(parsed.molecule, engine), engine);
      const changed = PROFILES.filter((p) => profiles[p].name !== variantProfiles[p].name)
        .map((p) => ({ profile: p, original: profiles[p].name, variant: variantProfiles[p].name }));
      comparisons.push({ smiles, status: changed.length ? "FAIL" : "PASS", changed });
      for (const changedProfile of changed) result.signals.push({ profile: changedProfile.profile, code: "EQUIVALENT_SMILES_NAME_CHANGE", detail: "OCL identity agrees but displayed output changes", evidence: { smiles, ...changedProfile } });
    }
    result.properties.equivalentRepresentations = comparisons.length
      ? { status: comparisons.some((c) => c.status === "FAIL") ? "FAIL" : "PASS", comparisons } : skip("No distinct verified equivalent SMILES in this bounded run");
    const exported = moleculeToSmiles(molecule);
    const reimported = exported.ok ? moleculeFromSmiles(exported.smiles) : exported;
    const finalExport = reimported.ok ? moleculeToSmiles(reimported.molecule) : reimported;
    result.properties.roundTripIdentity = check(finalExport.ok && structuralIdentity(finalExport.smiles) === record.identity,
      finalExport.ok ? finalExport.smiles : finalExport.error);
    result.properties.graphImmutability = check(isDeepStrictEqual(molecule, original));
    for (const [property, value] of Object.entries(result.properties)) if (value.status === "FAIL") {
      result.signals.push({ code: `PROPERTY_${property}`, detail: `${property} failed`, evidence: value });
    }
  } catch (error) {
    result.signals.push({ code: "CRASH", detail: error.message, stack: error.stack?.split("\n").slice(0, 5) });
    result.properties.completed = check(false, error.message);
    for (const key of PROFILES) result.profiles[key] ??= { status: "ERROR", name: null, exact: "UNVERIFIED", evidenceLevel: "GENERATED" };
  }
  return serializable(result);
}
