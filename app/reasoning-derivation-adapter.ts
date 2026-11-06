import type { AppLanguage } from "./i18n.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { StructuralComponent, StructuralDerivation } from "./structural-derivation.ts";
import type { AlphabeticalOrderPresentation } from "./reasoning-alphabetical-order.ts";
import type { ReasoningNameFragment } from "./reasoning-name-fragments.ts";
import { reasoningFragmentId } from "./reasoning-visual-targets.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { validatedNameTargets, type NameComponent, type ValidatedNameDerivation } from "./validated-name-derivation.ts";

export type PriorityReasoningStep = {
  number: string;
  title: string;
  explanation: string;
  target?: ReasoningVisualTarget;
  fragments?: ReasoningNameFragment;
  fragmentTargets: Record<string, ReasoningVisualTarget>;
  alphabeticalOrder?: AlphabeticalOrderPresentation;
  componentIds: string[];
  componentKind?: StructuralComponent["kind"];
  source: "FULL" | "structural" | "local";
};

export type PriorityReasoningModel = { steps: PriorityReasoningStep[]; name: string };

const groupNames = {
  en: { carboxylicAcid: "carboxylic acid", amide: "amide", ester: "ester", aldehyde: "aldehyde", ketone: "ketone", alcohol: "alcohol", heterocycle: "heterocyclic function" },
  es: { carboxylicAcid: "ácido carboxílico", amide: "amida", ester: "éster", aldehyde: "aldehído", ketone: "cetona", alcohol: "alcohol", heterocycle: "función heterocíclica" },
} as const;

function unionTarget(number: string, targets: readonly ReasoningVisualTarget[]): ReasoningVisualTarget | undefined {
  const atomIds = [...new Set(targets.flatMap(target => [...target.atomIds]))];
  if (!atomIds.length) return;
  const bonds = new Map<string, readonly [number, number]>();
  for (const target of targets) for (const [a, b] of target.bondIds) bonds.set(`${Math.min(a, b)}:${Math.max(a, b)}`, [a, b]);
  const locants = new Map<string, readonly [number, number | string]>();
  for (const target of targets) for (const item of target.locants) locants.set(`${item[0]}:${item[1]}`, item);
  return { stepNumber: number, atomIds, bondIds: [...bonds.values()], locants: [...locants.values()] };
}

function localTerm(text: string, language: AppLanguage) {
  if (language === "en") return text;
  const terms: Record<string, string> = {
    phenyl: "fenilo", hydroxy: "hidroxi", methyl: "metilo", "2-methylpropyl": "2-metilpropilo",
    acetyloxy: "acetiloxi", "oic acid": "ácido carboxílico", amide: "amida",
  };
  return terms[text] ?? text;
}

function componentLabel(component: NameComponent, language: AppLanguage, derivation: ValidatedNameDerivation) {
  if (component.id === "parent") return derivation.principalGroup === "amide" && derivation.components.some(item => item.id === "aryl")
    ? language === "en" ? "acetamide" : "acetamida" : language === "en" ? "Validated parent" : "Padre validado";
  if (component.id === "suffix") return groupNames[language][derivation.principalGroup];
  if (component.id === "aryl-prefix" && component.text.includes(",") && language === "es")
    return `Grupos metilo en C${component.numbering.map(([, locant]) => locant).join(" y C")}`;
  if (component.id === "aryl" || component.text.endsWith("phenyl")) return language === "en" ? "Phenyl group" : "Grupo fenilo";
  if (component.id.startsWith("sugar-") && (component.labelEs || component.label))
    return language === "es" ? component.labelEs ?? component.label! : component.label ?? component.labelEs!;
  const term = component.text.replace(/^\d+(?:,\d+)*-/, "").replace(/^\(|\)$/g, "");
  const translated = localTerm(term, language);
  const locant = component.locant === undefined ? "" : language === "en" ? ` at ${component.locant}` : ` en ${component.locant}`;
  return `${translated}${locant}`;
}

function componentFragment(component: NameComponent, language: AppLanguage, derivation: ValidatedNameDerivation): ReasoningNameFragment {
  const text = componentLabel(component, language, derivation);
  return { text, label: language === "en" ? `Select ${text}` : `Seleccionar ${text}`,
    kind: component.role === "parent" ? "parent" : component.role === "suffix" ? "function"
      : component.role === "substituent" || component.role === "prefix" ? "substituent" : "numbering",
    semanticId: component.id, atomIds: component.atomIds, bondIds: component.bondIds };
}

function makeStep(input: {
  number: string; title: string; explanation: string; components: readonly NameComponent[];
  derivation: ValidatedNameDerivation; language: AppLanguage; graph: GeneratedMolecule;
  alphabeticalOrder?: AlphabeticalOrderPresentation;
}): PriorityReasoningStep {
  const { number, title, explanation, components, derivation, language, graph, alphabeticalOrder } = input;
  const targets = validatedNameTargets(derivation);
  const fragments = components.map(component => componentFragment(component, language, derivation));
  const combined: ReasoningNameFragment | undefined = fragments.length
    ? { ...fragments[0], additionalFragments: fragments.slice(1) } : undefined;
  const fragmentTargets: Record<string, ReasoningVisualTarget> = {};
  components.forEach((component, index) => {
    const target = targets[component.id], fragment = fragments[index];
    if (target) fragmentTargets[reasoningFragmentId(number, fragment)] = { ...target, stepNumber: number,
      fragmentId: reasoningFragmentId(number, fragment) };
  });
  const locantFragments: ReasoningNameFragment[] = [], numberingTargets: ReasoningVisualTarget[] = [], seenLocants = new Set<string>();
  const addLocants = (component: NameComponent, labelPrefix: string) => {
    for (const [atomId, locant] of component.numbering) {
      if (!graph.atoms.some(atom => atom.id === atomId)) continue;
      const key = `${atomId}:${locant}`;
      if (seenLocants.has(key)) continue;
      seenLocants.add(key);
      const label = `${labelPrefix} ${locant}`;
      const item: ReasoningNameFragment = { text: String(locant), label, kind: "numbering",
        semanticId: `locant:${component.id}:${atomId}:${locant}`, atomIds: [atomId] };
      locantFragments.push(item);
      const fragmentId = reasoningFragmentId(number, item);
      const target = { stepNumber: number, fragmentId, atomIds: [atomId], bondIds: [], locants: [[atomId, locant]] as [number, number | string][] };
      fragmentTargets[fragmentId] = target; numberingTargets.push(target);
    }
  };
  if (title === (language === "en" ? "Numbering" : "Numeración")) {
    const parent = components.find(component => component.id === "parent");
    const aryl = components.find(component => component.id === "aryl");
    if (parent) addLocants(parent, language === "en" ? "Parent locant" : "Localizador del padre");
    if (aryl) addLocants(aryl, language === "en" ? "Phenyl ring locant" : "Localizador del anillo fenilo");
  }
  const allFragments = [...fragments, ...locantFragments];
  const fragmentView = allFragments.length ? { ...allFragments[0], additionalFragments: allFragments.slice(1) } : undefined;
  const stepTargets = title === (language === "en" ? "Numbering" : "Numeración")
    ? numberingTargets : components.map(component => targets[component.id]).filter(Boolean);
  return { number, title, explanation, target: unionTarget(number, stepTargets),
    fragments: fragmentView, fragmentTargets, componentIds: components.map(component => component.id), source: "FULL", alphabeticalOrder };
}

/** Projects FULL component evidence into the same numbered priority-list UI as
 * the original reasoning flow. Its ordering is semantic, never component order. */
export function buildValidatedPriorityReasoning(input: {
  derivation: ValidatedNameDerivation; graph: GeneratedMolecule; language: AppLanguage;
  alphabeticalOrder?: AlphabeticalOrderPresentation;
}): PriorityReasoningModel {
  const { derivation, graph, language } = input, byId = new Map(derivation.components.map(component => [component.id, component]));
  const parent = byId.get("parent") ?? derivation.components.find(component => component.role === "parent");
  const carbohydrate = derivation.parentSystem === "carbohydrate";
  const suffix = carbohydrate
    ? byId.get("sugar-polyol") ?? byId.get("sugar-open")
    : byId.get("suffix") ?? derivation.components.find(component => component.role === "suffix");
  const roots = derivation.components.filter(component => component.role === "substituent"
    && (!component.parentId || component.parentId === "parent"));
  const stereoComponents = derivation.components.filter(component => /stereo|cip|anomer|series/i.test(component.id));
  const descendants = derivation.components.filter(component => !stereoComponents.includes(component) && (component.role === "prefix"
    || component.role === "substituent" && component.parentId && component.parentId !== "parent"));
  const stages: Omit<Parameters<typeof makeStep>[0], "number" | "derivation" | "language" | "graph">[] = [];
  if (suffix) stages.push({ title: language === "en" ? "Principal functional group" : "Grupo funcional principal",
    explanation: language === "en" ? `${groupNames.en[derivation.principalGroup]} is the principal functional group and is expressed by the validated suffix.`
      : `La función principal es ${groupNames.es[derivation.principalGroup]} y se expresa mediante el sufijo validado.`, components: [suffix] });
  if (parent) {
    const ring = (graph.rings ?? []).find(candidate => candidate.atomIds.length >= 3 && candidate.atomIds.every(id => parent.atomIds.includes(id)));
    const carbonCount = parent.atomIds.filter(id => graph.atoms.find(atom => atom.id === id)?.element === "C").length;
    const rootRing = roots.find(root => (graph.rings ?? []).some(candidate => candidate.atomIds.length >= 3 && candidate.atomIds.every(id => root.atomIds.includes(id))));
    const rule = /P-\d+(?:\.\d+)+/.exec(parent.explanation)?.[0];
    const explanation = derivation.principalGroup === "amide" && roots.some(root => root.locant === "N")
      ? language === "en" ? "The amide is the parent; N- marks substitution on its nitrogen."
        : "La amida es el padre; N- indica que el sustituyente se une a su nitrógeno."
      : ring && derivation.principalGroup === "carboxylicAcid"
        ? language === "en" ? `The ring is the validated parent; the carboxyl carbon remains outside the ring.${rule ? ` (${rule})` : ""}`
          : `El anillo es el padre validado; el carbono carboxílico queda fuera del anillo.${rule ? ` (${rule})` : ""}`
        : language === "en" ? `The selected parent is the ${ring ? "cyclic system" : `acyclic ${carbonCount}-carbon chain`}${rootRing ? "; the attached ring is a substituent" : ""}.${rule ? ` (${rule})` : ""}`
          : `El padre seleccionado es ${ring ? "el sistema cíclico" : `la cadena acíclica de ${carbonCount} carbonos`}${rootRing ? "; el anillo unido es un sustituyente" : ""}.${rule ? ` (${rule})` : ""}`;
    stages.push({ title: language === "en" ? "Parent structure" : "Estructura principal", explanation,
      components: [parent, ...(carbohydrate && byId.get("sugar-ring") ? [byId.get("sugar-ring")!] : [])] });
  }
  const numberComponents = [parent, byId.get("aryl"), ...derivation.components.filter(component => component.id.startsWith("sugar-chain"))]
    .filter((component): component is NameComponent => Boolean(component && component.numbering.length));
  if (numberComponents.length) stages.push({ title: language === "en" ? "Numbering" : "Numeración",
    explanation: language === "en" ? roots.length || descendants.length
      ? "Parent, ring, and nested-substituent locants belong to their own numbering systems."
      : "Locants follow the numbering of the verified parent structure."
      : roots.length || descendants.length ? "El padre, el anillo y los sustituyentes anidados conservan sistemas de numeración independientes."
        : "Los localizadores siguen la numeración de la estructura parental validada.", components: numberComponents });
  const assigned = new Set([parent?.id, suffix?.id, ...numberComponents.map(component => component.id),
    ...roots.map(component => component.id), ...descendants.map(component => component.id),
    ...(carbohydrate && byId.get("sugar-ring") ? ["sugar-ring"] : [])]);
  const facets = carbohydrate ? derivation.components.filter(component => !assigned.has(component.id)
    && component.id !== "parent") : [];
  const substituents = [...roots, ...descendants, ...facets].filter((component, index, all) => all.findIndex(item => item.id === component.id) === index);
  if (substituents.length) stages.push({ title: language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores",
    explanation: language === "en" ? "Each component and its attachment are selected from the reconciled molecular graph."
      : "Cada componente y su enlace de unión se seleccionan desde el grafo molecular reconciliado.", components: substituents });
  if (input.alphabeticalOrder && (roots.length + descendants.length) > 1)
    stages.push({ title: language === "en" ? "Alphabetical order" : "Orden alfabético",
      explanation: input.alphabeticalOrder.paragraphs.join(" "), components: substituents, alphabeticalOrder: input.alphabeticalOrder });
  if (stereoComponents.length) stages.push({ title: language === "en" ? "Stereochemistry" : "Estereoquímica",
    explanation: language === "en" ? "Only configurations included in the FULL structural proof are stated."
      : "Solo se expresan configuraciones incluidas en la prueba estructural FULL.", components: stereoComponents });
  const steps = stages.map((stage, index) => makeStep({ ...stage, number: String(index + 1).padStart(2, "0"), derivation, language, graph }));
  const amideFragments = buildNSubstitutedAmideFragments(steps, derivation, graph, language);
  return { name: derivation.name, steps: amideFragments ?? steps };
}

function buildNSubstitutedAmideFragments(steps: PriorityReasoningStep[], derivation: ValidatedNameDerivation,
  graph: GeneratedMolecule, language: AppLanguage) {
  const byId = new Map(derivation.components.map(component => [component.id, component]));
  const parent = byId.get("parent"), suffix = byId.get("suffix"), aryl = byId.get("aryl");
  const hydroxy = derivation.components.find(component => component.id.startsWith("aryl-prefix") && component.text === "hydroxy");
  if (derivation.principalGroup !== "amide" || !parent || !suffix || !aryl || aryl.locant !== "N" || !hydroxy) return;
  const visual = validatedNameTargets(derivation), atoms = new Map(graph.atoms.map(atom => [atom.id, atom]));
  const parentStep = steps.find(step => step.title === (language === "en" ? "Parent structure" : "Estructura principal"));
  const numberingStep = steps.find(step => step.title === (language === "en" ? "Numbering" : "Numeración"));
  const substituentStep = steps.find(step => step.title === (language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores"));
  if (!parentStep || !numberingStep || !substituentStep) return;
  const merge = (...regions: {atomIds: readonly number[]; bondIds: readonly (readonly [number,number])[]}[]) => ({
    atomIds: [...new Set(regions.flatMap(region => region.atomIds))],
    bondIds: [...new Map(regions.flatMap(region => region.bondIds).map(([a,b]) => [`${Math.min(a,b)}:${Math.max(a,b)}`, [a,b] as [number,number]])).values()],
  });
  const addControl = (step: PriorityReasoningStep, semanticId: string, text: string, kind: ReasoningNameFragment["kind"], target: ReturnType<typeof merge>) => {
    const fragment: ReasoningNameFragment = { semanticId, text, kind, label: language === "en" ? `Select ${text}` : `Seleccionar ${text}`,
      atomIds: target.atomIds, bondIds: target.bondIds };
    const fragmentId = reasoningFragmentId(step.number, fragment);
    step.fragments = step.fragments ? { ...step.fragments, additionalFragments: [...(step.fragments.additionalFragments ?? []), fragment] } : fragment;
    step.fragmentTargets[fragmentId] = { stepNumber: step.number, fragmentId, atomIds: target.atomIds, bondIds: target.bondIds, locants: [] };
  };
  const acetamide = merge(parent, suffix);
  parentStep.explanation = language === "en" ? "Acet- denotes two acyl carbons; -amide identifies C(=O)–N." : "Acet- indica dos carbonos en la parte acilo y -amida identifica el grupo C(=O)–N.";
  parentStep.fragments = undefined;
  parentStep.fragmentTargets = {};
  addControl(parentStep, "parent", language === "en" ? "acetamide" : "acetamida", "parent", acetamide);
  const nitrogen = suffix.atomIds.find(id => atoms.get(id)?.element === "N");
  const ringIds = aryl.atomIds.filter(id => (atoms.get(id)?.element ?? "C") === "C");
  const ringEdges = graph.bonds.filter(([a,b]) => ringIds.includes(a) && ringIds.includes(b)).map(([a,b]) => [a,b] as [number,number]);
  const nBond = aryl.bondIds.find(([a,b]) => (a === nitrogen && ringIds.includes(b)) || (b === nitrogen && ringIds.includes(a)));
  if (!nitrogen || !nBond || ringIds.length !== 6) return;
  addControl(parentStep, "name:N", "N-", "substituent", { atomIds: [nitrogen, nBond[0] === nitrogen ? nBond[1] : nBond[0]], bondIds: [nBond] });
  addControl(substituentStep, "name:phenyl", language === "en" ? "phenyl" : "fenil", "substituent", { atomIds: ringIds, bondIds: ringEdges });
  const locant = aryl.numbering.find(([, value]) => value === 4)?.[0];
  const hydroxyO = hydroxy.atomIds.find(id => atoms.get(id)?.element === "O");
  const hydroxyBond = hydroxy.bondIds.find(([a,b]) => a === hydroxyO && ringIds.includes(b) || b === hydroxyO && ringIds.includes(a));
  if (!locant || !hydroxyO || !hydroxyBond) return;
  numberingStep.explanation = language === "en" ? "The carbon bonded to N is phenyl C1; hydroxy is at C4." : "El carbono unido a N es C1 del fenilo. El grupo hidroxi está en C4.";
  numberingStep.fragments = undefined;
  numberingStep.fragmentTargets = {};
  const locantFragment: ReasoningNameFragment = { semanticId: "name:phenyl-locant-4", text: "4", kind: "numbering",
    label: language === "en" ? "Phenyl ring locant 4" : "Localizador 4 del anillo fenilo", atomIds: [locant] };
  const locantId = reasoningFragmentId(numberingStep.number, locantFragment);
  numberingStep.fragments = locantFragment;
  numberingStep.fragmentTargets[locantId] = { stepNumber: numberingStep.number, fragmentId: locantId, atomIds: [locant], bondIds: [], locants: [[locant,4]] };
  addControl(substituentStep, "name:hydroxy", language === "en" ? "hydroxy" : "hidroxi", "substituent", { atomIds: [hydroxyO], bondIds: [hydroxyBond] });
  addControl(substituentStep, "name:4-hydroxyphenyl", language === "en" ? "4-hydroxyphenyl" : "4-hidroxifenil", "substituent",
    merge({ atomIds: ringIds, bondIds: ringEdges }, visual.aryl, { atomIds: [nitrogen], bondIds: [nBond] }));
  return steps;
}

function structuralLabel(component: StructuralComponent, language: AppLanguage) {
  if (language === "es") return component.kindEs ?? component.kind;
  return component.kind;
}

/** Structural-only evidence is deliberately presented as candidates and
 * connected regions; this adapter never turns it into name locants or parents. */
export function buildStructuralPriorityReasoning(input: { derivation: StructuralDerivation; language: AppLanguage }): PriorityReasoningModel {
  const { derivation, language } = input;
  const ranks: Record<StructuralComponent["kind"], number> = {
    carboxylicAcid: 0, ester: 0, amide: 0, carbonyl: 0, hydroxyl: 0,
    "candidate carbon skeleton": 1, "carbohydrate backbone": 1,
    ringSystem: 2, "connected fragment": 3,
    "N-bound methyl": 4, "ring oxygen": 4, hemiacetal: 4, hemiketal: 4,
    "configurational reference": 5, "anomeric centre": 5, stereo: 5,
  };
  const kinds = [...new Set(derivation.components.map(component => component.kind))]
    .sort((a, b) => ranks[a] - ranks[b] || a.localeCompare(b));
  const steps = kinds.map((kind, index): PriorityReasoningStep => {
    const number = String(index + 1).padStart(2, "0"), group = derivation.components.filter(component => component.kind === kind);
    const fragments = group.map(component => {
      const label = structuralLabel(component, language);
      return { text: label, label: language === "en" ? `Select ${label}` : `Seleccionar ${label}`,
        kind: "substituent" as const, semanticId: component.id, atomIds: component.atomIds, bondIds: component.bondIds };
    });
    const fragmentTargets: Record<string, ReasoningVisualTarget> = {};
    group.forEach((component, fragmentIndex) => {
      const fragment = fragments[fragmentIndex], fragmentId = reasoningFragmentId(number, fragment);
      fragmentTargets[fragmentId] = { stepNumber: number, fragmentId, atomIds: component.atomIds,
        bondIds: component.bondIds, locants: component.numbering ?? [] };
    });
    const componentText = (component: StructuralComponent) => language === "en" ? component.evidence : component.evidenceEs ?? component.evidence;
    const explanation = group.length === 1 ? componentText(group[0]) : language === "en"
      ? `${group.length} graph regions of this kind are independently identified; no parent locants are inferred.`
      : `Se identifican ${group.length} regiones de este tipo en el grafo; no se infieren localizadores parentales.`;
    const targets = group.map(component => ({ stepNumber: number, atomIds: component.atomIds,
      bondIds: component.bondIds, locants: component.numbering ?? [] }));
    return { number, title: structuralLabel(group[0], language), explanation, target: unionTarget(number, targets),
      fragments: { ...fragments[0], additionalFragments: fragments.slice(1) }, fragmentTargets,
      componentIds: group.map(component => component.id), componentKind: kind, source: "structural" };
  });
  return { name: derivation.name.text, steps };
}
