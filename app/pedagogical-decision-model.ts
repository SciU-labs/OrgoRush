/** Presentation-neutral decisions derived from already validated chemical evidence.
 * This layer is deliberately unable to establish molecular equivalence or FULL. */
export type PedagogicalDecisionKind = "parent-recognition" | "ring-system-recognition" | "ring-fusion"
  | "conventional-numbering" | "parent-selection" | "substituent-recognition" | "side-chain-recognition" | "unsaturation" | "functional-priority"
  | "subordinate-functional-group" | "functional-multiplicity" | "attachment-locants" | "parent-hydrogenation" | "retained-identity" | "relative-stereochemistry" | "absolute-stereochemistry" | "name-assembly";

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
  unjustifiedComponents: { componentId: string; cause: "not-referenced-by-explained-decision" }[];
  causes: string[];
  coverage: "complete" | "partial" | "none";
};

/** Internal coverage report only. It describes pedagogical evidence and never
 * changes the independent chemical reconciliation state. */
export function auditPedagogicalCoverage(input: {
  name: string;
  profile?: string;
  nameSource?: string;
  limitations?: string[];
  chemicalStatus: PedagogicalCoverageDiagnostic["chemicalStatus"];
  decisions: readonly PedagogicalDecision[];
  plan: readonly PedagogicalStepPlan[];
  steps: readonly RenderedPedagogicalStep[];
  componentIds: readonly string[];
}): PedagogicalCoverageDiagnostic {
  const explained = new Set(input.steps.flatMap(step => step.decisionIds));
  // Family adapters emit only chemically applicable verified decisions. A
  // missing presentation step must remain visible to the audit.
  const applicable = new Set(input.decisions.map(d => d.id));
  const unexplainedDecisions = [...applicable].filter(id => !explained.has(id));
  const coveredComponents = new Set(input.steps.filter(s => s.decisionIds.some(id => applicable.has(id))).flatMap(step => step.componentIds));
  const unjustifiedComponents = input.componentIds.filter(id => !coveredComponents.has(id))
    .map(componentId => ({ componentId, cause: "not-referenced-by-explained-decision" as const }));
  const causes = [
    ...(unexplainedDecisions.length ? [`unexplained-decisions:${unexplainedDecisions.join(",")}`] : []),
    ...(unjustifiedComponents.length ? [`unmapped-components:${unjustifiedComponents.map(item => item.componentId).join(",")}`] : []),
    ...(!applicable.size ? ["no-applicable-pedagogical-decisions"] : []),
    ...input.limitations ?? [],
  ];
  const presented = input.decisions.filter(d => explained.has(d.id));
  const coverage = !presented.length ? "none" : causes.length ? "partial" : "complete";
  return { name: input.name, chemicalStatus: input.chemicalStatus, profile: input.profile, nameSource: input.nameSource,
    applicableDecisions: [...applicable],
    availableDecisions: input.decisions.map(decision => decision.id),
    explainedDecisions: presented.map(d => d.id),
    justifiedLocants: presented.filter(d => d.kind === "attachment-locants" || d.kind === "conventional-numbering")
      .map(d => ({decisionId: d.id, scope: d.numberingScope ?? "parent", locants: d.locants})),
    coveredNameFragments: presented.map(d => ({ decisionId: d.id,
      fragments: d.nameFragments.filter(fragment => fragment && input.name.includes(fragment)) })),
    unjustifiedComponents, causes, coverage };
}

/** Common projection used by every family adapter. It only combines verified
 * decisions; chemistry and status validation remain in their own grammars. */
export function renderPedagogicalDecisionPlan(decisions: readonly PedagogicalDecision[],
  plan: readonly PedagogicalStepPlan[], language: "en" | "es"): RenderedPedagogicalStep[] {
  const byId = new Map(decisions.map(decision => [decision.id, decision]));
  return plan.flatMap(step => {
    const selected = step.decisionIds.map(id => byId.get(id)).filter((item): item is PedagogicalDecision => Boolean(item));
    const explanation = selected.map(item => item.explanation[language]).filter(Boolean).join(" ");
    if (!explanation) return [];
    const details = (step.detailDecisionIds ?? []).map(id => byId.get(id)).filter((item): item is PedagogicalDecision => Boolean(item?.explanation[language]));
    const advancedExplanation = [...selected.map(item => item.why?.[language]), ...details.map(item => item.explanation[language])].filter(Boolean).join(" ");
    return [{ title: step.title[language], explanation, ...(advancedExplanation ? { advancedExplanation } : {}),
      componentIds: step.componentIds, decisionIds: [...selected, ...details].map(item => item.id) }];
  });
}
