import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { PedagogicalDecision, PedagogicalStepPlan } from "./pedagogical-decision-model.ts";
import { numberedAttachmentDecisions } from "./numbered-attachment-decisions.ts";
import { buildPedagogicalNameInventory, nameComponentBinding } from "./pedagogical-name-inventory.ts";

export function adaptPurineEvidence(graph: GeneratedMolecule, derivation: ValidatedNameDerivation) {
  if (derivation.status !== "FULL" || derivation.parentSystem !== "purine") return null;
  const byId = new Map(derivation.components.map(component => [component.id, component]));
  const parent = byId.get("parent"), nitrogens = byId.get("purine-nitrogens"), fusion = byId.get("purine-fusion");
  if (!parent || !nitrogens || !fusion) return null;
  const decisions: PedagogicalDecision[] = [];
  const plan: PedagogicalStepPlan[] = [];
  const inventory = buildPedagogicalNameInventory(derivation,graph);
  function stage(id: string, kind: PedagogicalDecision["kind"], rule: string, title: PedagogicalStepPlan["title"],
    components: NameComponent[], explanation: PedagogicalDecision["explanation"], dependsOn: string[],
    why?: PedagogicalDecision["why"]) {
    decisions.push({ id, kind, family: "purine", rule, evidenceSource: "reconciled purine parent, tautomer and component mapping",
      atomIds: [...new Set(components.flatMap(c => c.atomIds))], bondIds: components.flatMap(c => c.bondIds),
      locants: [...new Set(components.flatMap(c => c.numbering.map(([, n]) => n)))],
      result: components.map(c => c.text).join(" "), nameFragments: [...new Set(components.map(c => c.text))],
      explanation, why, dependsOn, verification: "verified",
      componentBindings: kind === "name-assembly" ? inventory.components.filter(c=>c.aspect==="assembly").map(nameComponentBinding)
        : inventory.components.filter(c=>components.some(component=>component.id === c.id
        || c.id === component.id+".multiplier")).map(nameComponentBinding) });
    plan.push({ id, title, decisionIds: [id], componentIds: components.map(c => c.id) });
  }
  stage("purine.parent", "parent-selection", "retained-fused-purine-parent",
    { en: "Choose the fused parent", es: "Elegir el padre fusionado" }, [parent, fusion],
    { en: "A six-membered ring and a five-membered ring share C4–C5. Their nine distinct atoms and the arrangement of four ring nitrogens identify the retained purine parent.",
      es: "Un anillo de seis miembros y otro de cinco comparten C4–C5. Sus nueve átomos distintos y la disposición de los cuatro nitrógenos identifican el padre retenido purina." },
    [], { en: parent.explanation, es: parent.explanationEs! });
  stage("purine.numbering", "conventional-numbering", "retained-purine-atom-map",
    { en: "Numbering", es: "Numeración" }, [nitrogens],
    { en: "Trace the six-membered ring from N1 through C2, N3, C4, C5 and C6. From C5 the other ring continues through N7, C8 and N9 back to C4. Substitution preserves these locants.",
      es: "Recorre el anillo de seis desde N1 por C2, N3, C4, C5 y C6. Desde C5 el otro anillo sigue por N7, C8 y N9 hasta C4. Los sustituyentes conservan estos localizadores." }, ["purine.parent"]);
  decisions.find(d => d.id === "purine.numbering")!.locants = parent.numbering.map(([, locant]) => locant);
  const numbering = decisions.find(d => d.id === "purine.numbering")!;
  numbering.atomIds = parent.atomIds;
  numbering.bondIds = parent.bondIds;
  numbering.componentBindings = inventory.components.filter(c=>c.aspect === "locants").map(nameComponentBinding);
  // The numbering step already generates the nine individual locant controls.
  plan[1]!.componentIds.unshift(parent.id);
  for (const component of derivation.components.filter(c => c.role !== "parent")) {
    const methyl = component.id === "purine-methyl", oxo = component.role === "suffix";
    const id = `purine.${component.id.slice("purine-".length)}`;
    const attachments = numberedAttachmentDecisions({ graph, derivation, parent, components: [component],
      family: "purine", numberingDecisionId: "purine.numbering" });
    stage(id, oxo ? "functional-multiplicity" : methyl ? "substituent-recognition" : "parent-hydrogenation",
      oxo ? "purine-oxo-suffix" : methyl ? "parent-h-replaced-by-methyl" : component.id,
      oxo ? { en: "Locate the carbonyl groups", es: "Localizar los carbonilos" }
        : methyl ? { en: "Place the methyl groups", es: "Situar los metilos" }
          : { en: "Account for parent hydrogen", es: "Situar el hidrógeno del padre" },
      [component], { en: component.explanation, es: component.explanationEs! }, ["purine.numbering"]);
    decisions.push(...attachments);
    plan.at(-1)!.detailDecisionIds = attachments.map(item => item.id);
  }
  const parts = [parent, ...derivation.components.filter(c => c.role !== "parent")].sort((a,b) => a.start - b.start);
  const sequence = parts.map(c => c.text).join(" + ");
  stage("purine.assembly", "name-assembly", "reconciled-purine-fragment-order",
    { en: "Assemble the name", es: "Construir el nombre" }, parts,
    { en: `Read the verified fragments in the order ${sequence}. Together they give ${derivation.name}.`,
      es: `Al leer los fragmentos en orden, ${sequence}, se obtiene ${derivation.name}.` }, decisions.map(d => d.id));
  plan.at(-1)!.componentIds = []; // Each literal already has its own control.
  return { decisions, plan };
}
