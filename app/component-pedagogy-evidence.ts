import type { AppLanguage } from "./i18n.ts";
import type { PedagogicalDecision } from "./pedagogical-decision-model.ts";
import type { PedagogicalNameInventory } from "./pedagogical-name-inventory.ts";
import { nameComponentBinding } from "./pedagogical-name-inventory.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { PriorityReasoningStep } from "./reasoning-derivation-adapter.ts";

/** Lift existing visible component explanations into explicit provenance.
 * A numeric control alone supplies no identity explanation. */
export function presentedComponentDecisions(derivation: ValidatedNameDerivation, inventory: PedagogicalNameInventory,
  steps: PriorityReasoningStep[], language: AppLanguage): PedagogicalDecision[] {
  const decisions: PedagogicalDecision[] = [];
  const numberingTitle = language === "en" ? "Numbering" : "Numeración";
  for (const component of derivation.components) {
    const step = steps.find(s=>s.componentIds.includes(component.id) && !s.alphabeticalOrder && s.title !== numberingTitle);
    if (!step?.explanation.trim()) continue;
    const entry = inventory.components.find(c=>c.id===component.id && c.aspect==="identity");
    const id = "component."+component.id;
    decisions.push({id,kind:component.role === "parent" ? "parent-selection"
      : component.role === "suffix" ? "functional-priority" : "substituent-recognition",
      family:"mapped-components",rule:"presented-reconciled-component",evidenceSource:"reconciled component and visible semantic step",
      atomIds:component.atomIds,bondIds:component.bondIds,locants:component.numbering.map(([,n])=>n),
      numberingScope:entry?.numberingScope ?? "parent",result:component.text,
      explanation:{en:language==="en"?step.explanation:"",es:language==="es"?step.explanation:""},
      nameFragments:[],componentBindings:entry?[nameComponentBinding(entry)]:[],dependsOn:[],verification:"verified"});
    (step.decisionIds ??= []).push(id);
  }
  const step = steps.find(s=>s.title === numberingTitle);
  if (step?.target && step.explanation.trim()) {
    const id = "component.parent-numbering";
    const entries = inventory.components.filter(c=>c.aspect==="locants" && c.numberingScope==="parent");
    decisions.push({id,kind:"conventional-numbering",family:"mapped-components",rule:"presented-parent-locant-map",
      evidenceSource:"reconciled parent map and visible numbering step",atomIds:[...step.target.atomIds],
      bondIds:step.target.bondIds.map(([a,b])=>[a,b]),
      locants:step.target.locants.map(([,n])=>n),numberingScope:"parent",result:"parent locants",
      explanation:{en:language==="en"?step.explanation:"",es:language==="es"?step.explanation:""},
      nameFragments:[],componentBindings:entries.map(nameComponentBinding),dependsOn:[],verification:"verified"});
    (step.decisionIds ??= []).push(id);
  }
  return decisions;
}
