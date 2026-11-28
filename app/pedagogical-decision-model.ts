import type { NameComponentBinding, PedagogicalNameInventory } from "./pedagogical-name-inventory.ts";

/** Presentation-neutral decisions derived from already validated chemical evidence.
 * This layer is deliberately unable to establish molecular equivalence or FULL. */
export type PedagogicalDecisionKind = "parent-recognition" | "ring-system-recognition" | "ring-fusion"
  | "conventional-numbering" | "parent-selection" | "substituent-recognition" | "side-chain-recognition" | "unsaturation" | "functional-priority"
  | "subordinate-functional-group" | "functional-multiplicity" | "attachment-locants" | "parent-hydrogenation" | "retained-identity" | "relative-stereochemistry" | "absolute-stereochemistry" | "name-assembly" | "parent-stem" | "scope-composition";

export type PedagogicalDecision = {
  id: string;
  kind: PedagogicalDecisionKind;
  family: string;
  rule: string;
  evidenceSource: string;
  atomIds: number[];
  bondIds: [number, number][];
  locants: (number | string)[];
  numberingScope?: string;
  result: string;
  explanation: { en: string; es: string };
  why?: { en: string; es: string };
  nameFragments: string[];
  componentBindings?: NameComponentBinding[];
  dependsOn: string[];
  verification: "verified";
};

export type PedagogicalStepPlan = {
  id: string;
  title: { en: string; es: string };
  decisionIds: string[];
  detailDecisionIds?: string[];
  componentIds: string[];
};

export type RenderedPedagogicalStep = {
  title: string;
  explanation: string;
  advancedExplanation?: string;
  componentIds: string[];
  decisionIds: string[];
};

export type PedagogicalCoverageDiagnostic = {
  name: string;
  chemicalStatus: "FULL" | "PARTIAL" | "UNVALIDATED";
  profile?: string;
  nameSource?: string;
  applicableDecisions: string[];
  availableDecisions: string[];
  explainedDecisions: string[];
  justifiedLocants: {decisionId: string; scope: string; locants: (number | string)[]}[];
  coveredNameFragments: { decisionId: string; fragments: string[] }[];
  unjustifiedComponents: { componentId: string; cause: "not-referenced-by-explained-decision" | "unexplained-name-component" | "insufficient-name-evidence" }[];
  causes: string[];
  inventory?: PedagogicalNameInventory;
  componentCoverage: {componentId: string; status: "explained" | "unexplained" | "insufficient-evidence"; decisionIds: string[]}[];
  coverage: "complete" | "partial" | "none" | "unverified";
};

/** Internal coverage report only. It describes pedagogical evidence and never
 * changes the independent chemical reconciliation state. */
export function auditPedagogicalCoverage(input: {
  name: string;
  profile?: string;
  nameSource?: string;
  limitations?: string[];
  inventory?: PedagogicalNameInventory;
  chemicalStatus: PedagogicalCoverageDiagnostic["chemicalStatus"];
  decisions: readonly PedagogicalDecision[];
  plan: readonly PedagogicalStepPlan[];
  steps: readonly RenderedPedagogicalStep[];
  componentIds: readonly string[];
}): PedagogicalCoverageDiagnostic {
  const explained = new Set(input.steps.filter(step=>step.explanation.trim() || step.advancedExplanation?.trim()).flatMap(step => step.decisionIds));
  // Family adapters emit only chemically applicable verified decisions. A
  // missing presentation step must remain visible to the audit.
  const applicable = new Set(input.decisions.map(d => d.id));
  const unexplainedDecisions = [...applicable].filter(id => !explained.has(id));
  const coveredComponents = new Set(input.steps.filter(s => s.decisionIds.some(id => applicable.has(id))).flatMap(step => step.componentIds));
  const unjustifiedComponents: PedagogicalCoverageDiagnostic["unjustifiedComponents"] = input.componentIds.filter(id => !coveredComponents.has(id))
    .map(componentId => ({ componentId, cause: "not-referenced-by-explained-decision" as const }));
  const causes = [
    ...(unexplainedDecisions.length ? [`unexplained-decisions:${unexplainedDecisions.join(",")}`] : []),
    ...(unjustifiedComponents.length ? [`unmapped-components:${unjustifiedComponents.map(item => item.componentId).join(",")}`] : []),
    ...(!applicable.size ? ["no-applicable-pedagogical-decisions"] : []),
    ...input.limitations ?? [],
    ...input.inventory?.limitations ?? [],
  ];
  const presented = input.decisions.filter(d => explained.has(d.id));
  const inventory = input.inventory;
  const validInventory = inventory?.name === input.name && !inventory.limitations.length && inventory.components.length > 0
    && new Set(inventory.components.map(c=>c.id)).size === inventory.components.length
    && inventory.components.every(c=>Number.isInteger(c.start) && Number.isInteger(c.end)
      && c.start >= 0 && c.end > c.start && c.end <= input.name.length && input.name.slice(c.start,c.end) === c.text
      && (c.aspect !== "locants" || c.text === c.locants.map(String).join(",")));
  const componentCoverage = (inventory?.components ?? []).map(component => {
    const decisionIds = presented.filter(decision => {
      const binding = decision.componentBindings?.find(binding => binding.id === component.id
        && binding.start === component.start && binding.end === component.end && binding.aspect === component.aspect
        && binding.numberingScope === component.numberingScope);
      if (inventory?.name !== input.name || !binding
        || component.start < 0 || component.end > input.name.length || component.end <= component.start
        || component.aspect === "locants" && component.text !== component.locants.map(String).join(",")
        || (decision.kind === "name-assembly") !== (component.aspect === "assembly")
        || component.aspect === "stem" && decision.kind !== "parent-stem"
        || component.aspect === "scope" && decision.kind !== "scope-composition"
        || decision.verification !== "verified" || !decision.evidenceSource.trim()
        || inventory!.name.slice(binding.start,binding.end) !== component.text
        || !component.atomIds.length || component.atomIds.some(id => !decision.atomIds.includes(id))) return false;
      if (component.aspect === "locants" && ((decision.numberingScope ?? "parent") !== component.numberingScope
        || component.locants.some(n => !decision.locants.some(locant => String(locant) === String(n))))) return false;
      return component.bondIds.every(([a,b]) => decision.bondIds.some(([x,y]) => a === x && b === y || a === y && b === x));
    }).map(d => d.id);
    return {componentId:component.id, status:component.evidence !== "available" ? "insufficient-evidence" as const
      : decisionIds.length ? "explained" as const : "unexplained" as const, decisionIds};
  });
  // An assembly assertion cannot cover unexplained constituents.
  for (const component of inventory?.components.filter(c=>c.aspect==="assembly") ?? []) {
    const state = componentCoverage.find(c=>c.componentId===component.id)!;
    if (state.status === "explained" && component.dependsOn.some(id=>componentCoverage.find(c=>c.componentId===id)?.status !== "explained")) {
      state.status = "unexplained";
      state.decisionIds = [];
    }
  }
  const pending = componentCoverage.filter(c => c.status !== "explained");
  for (const component of pending) if (!unjustifiedComponents.some(c=>c.componentId===component.componentId))
    unjustifiedComponents.push({componentId:component.componentId,cause:component.status === "insufficient-evidence"
      ? "insufficient-name-evidence" : "unexplained-name-component"});
  if (pending.length) causes.push("pending-name-components:"+pending.map(c=>c.componentId).join(","));
  if (presented.length && !validInventory) causes.push("unverified-name-decomposition");
  const coverage = !presented.length ? "none" : !validInventory ? "unverified" : causes.length ? "partial" : "complete";
  return { name: input.name, chemicalStatus: input.chemicalStatus, profile: input.profile, nameSource: input.nameSource,
    applicableDecisions: [...applicable],
    availableDecisions: input.decisions.map(decision => decision.id),
    explainedDecisions: presented.map(d => d.id),
    justifiedLocants: presented.filter(d => d.kind === "attachment-locants" || d.kind === "conventional-numbering")
      .map(d => ({decisionId: d.id, scope: d.numberingScope ?? "parent", locants: d.locants})),
    coveredNameFragments: presented.map(d => ({ decisionId: d.id,
      fragments: inventory?.components.filter(c => componentCoverage.some(status => status.componentId === c.id
        && status.status === "explained" && status.decisionIds.includes(d.id))).map(c=>c.text) ?? [] })),
    inventory, componentCoverage, unjustifiedComponents, causes, coverage };
}

/** Common projection used by every family adapter. It only combines verified
 * decisions; chemistry and status validation remain in their own grammars. */
export function renderPedagogicalDecisionPlan(decisions: readonly PedagogicalDecision[],
  plan: readonly PedagogicalStepPlan[], language: "en" | "es"): RenderedPedagogicalStep[] {
  const byId = new Map(decisions.map(decision => [decision.id, decision]));
  return plan.flatMap(step => {
    const selected = step.decisionIds.map(id => byId.get(id)).filter((item): item is PedagogicalDecision => Boolean(item?.explanation[language]?.trim()));
    const explanation = selected.map(item => item.explanation[language]).filter(Boolean).join(" ");
    if (!explanation) return [];
    const details = (step.detailDecisionIds ?? []).map(id => byId.get(id)).filter((item): item is PedagogicalDecision => Boolean(item?.explanation[language]?.trim()));
    const advancedExplanation = [...selected.map(item => item.why?.[language]), ...details.map(item => item.explanation[language])].filter(Boolean).join(" ");
    return [{ title: step.title[language], explanation, ...(advancedExplanation ? { advancedExplanation } : {}),
      componentIds: step.componentIds, decisionIds: [...selected, ...details].map(item => item.id) }];
  });
}
