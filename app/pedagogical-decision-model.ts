/** Presentation-neutral decisions derived from already validated chemical evidence.
 * This layer is deliberately unable to establish molecular equivalence or FULL. */
export type PedagogicalDecisionKind = "parent-recognition" | "ring-system-recognition" | "ring-fusion"
  | "conventional-numbering" | "parent-selection" | "substituent-recognition" | "side-chain-recognition" | "unsaturation" | "functional-priority"
  | "subordinate-functional-group" | "functional-multiplicity" | "relative-stereochemistry" | "absolute-stereochemistry" | "name-assembly";

export type PedagogicalDecision = {
  id: string;
  kind: PedagogicalDecisionKind;
  family: string;
  rule: string;
  evidenceSource: string;
  atomIds: number[];
  bondIds: [number, number][];
  locants: (number | string)[];
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
  componentIds: string[];
};

export type RenderedPedagogicalStep = {
  title: string;
  explanation: string;
  advancedExplanation?: string;
  componentIds: string[];
};

/** Common projection used by every family adapter. It only combines verified
 * decisions; chemistry and status validation remain in their own grammars. */
export function renderPedagogicalDecisionPlan(decisions: readonly PedagogicalDecision[],
  plan: readonly PedagogicalStepPlan[], language: "en" | "es"): RenderedPedagogicalStep[] {
  const byId = new Map(decisions.map(decision => [decision.id, decision]));
  return plan.flatMap(step => {
    const selected = step.decisionIds.map(id => byId.get(id)).filter((item): item is PedagogicalDecision => Boolean(item));
    const explanation = selected.map(item => item.explanation[language]).filter(Boolean).join(" ");
    if (!explanation) return [];
    const advancedExplanation = selected.map(item => item.why?.[language]).filter(Boolean).join(" ");
    return [{ title: step.title[language], explanation, ...(advancedExplanation ? { advancedExplanation } : {}), componentIds: step.componentIds }];
  });
}
