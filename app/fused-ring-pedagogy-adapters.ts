import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { PedagogicalDecision, PedagogicalStepPlan } from "./pedagogical-decision-model.ts";
import { numberedAttachmentDecisions } from "./numbered-attachment-decisions.ts";
import { equivalentNaphthaleneLocantSets } from "./fused-naphthalene-grammar.ts";
import { buildPedagogicalNameInventory, nameComponentBinding } from "./pedagogical-name-inventory.ts";

export type FusedPedagogicalAdaptation = { decisions: PedagogicalDecision[]; plan: PedagogicalStepPlan[] };
const bondKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const bondExists = (graph: GeneratedMolecule, a: number, b: number) => graph.bonds.some(([x,y]) => bondKey(x,y) === bondKey(a,b));

/** Adapt only after the independent reconciler has returned FULL. */
export function adaptDecalinEvidence(graph: GeneratedMolecule, derivation: ValidatedNameDerivation | null): FusedPedagogicalAdaptation | null {
  if (!derivation || derivation.status !== "FULL" || derivation.evidence?.construction !== "fused-decalin"
    || derivation.evidence.equivalence !== "complete-graph-isomorphism") return null;
  const parent = derivation.components.find(item => item.id === "parent");
  const rings = derivation.components.filter(item => /^fused-ring-\d+$/.test(item.id));
  const junction = derivation.components.find(item => item.id === "fusion-junction");
  if (!parent || rings.length !== 2 || !junction || rings.some(ring => ring.atomIds.length !== 6)) return null;
  const sharedAtoms = rings[0]!.atomIds.filter(id => rings[1]!.atomIds.includes(id));
  const sharedBond = rings[0]!.bondIds.find(([a,b]) => rings[1]!.bondIds.some(([x,y]) => bondKey(a,b) === bondKey(x,y)));
  if (sharedAtoms.length !== 2 || !sharedBond || !bondExists(graph, ...sharedBond)) return null;
  const configuration = graph.fusedRingJunctionStereo?.configuration ?? "unspecified";
  const decisions: PedagogicalDecision[] = [
    { id: "decalin.ring-system", kind: "ring-system-recognition", family: "decalin", rule: "two-six-membered-rings-share-one-edge",
      evidenceSource: "FULL graph isomorphism; mapped ring components", atomIds: [...parent.atomIds], bondIds: [...parent.bondIds], locants: [], result: "bicyclic saturated C10 system",
      explanation: { en: "Two saturated six-membered carbon rings share one bond. Their two junction carbons belong to both rings, so the distinct-carbon count is 6 + 6 − 2 = 10; this shared edge makes one fused system rather than two rings joined by an external bond.",
        es: "Dos anillos saturados de seis carbonos comparten un enlace. Sus dos carbonos de unión pertenecen a ambos anillos, así que hay 6 + 6 − 2 = 10 carbonos distintos; el enlace compartido forma un sistema fusionado, no dos anillos unidos por un enlace externo." },
      why: { en: "The ring atom sets intersect in exactly two atoms, and the graph contains the bond between them.", es: "Los conjuntos de átomos de los anillos se intersectan en exactamente dos átomos, y el grafo contiene el enlace entre ellos." }, nameFragments: [parent.text], dependsOn: [], verification: "verified" },
    { id: "decalin.parent-name", kind: "parent-selection", family: "decalin", rule: "validated-retained-or-hydrogenated-naphthalene-parent",
      evidenceSource: "FULL reconciled name profile", atomIds: [...parent.atomIds], bondIds: [...parent.bondIds], locants: [], result: parent.text,
      explanation: { en: "The reconciled form may use the retained name decalin or the systematic name decahydronaphthalene. The validated profile determines the spelling; retained naming does not automatically make it a PIN.",
        es: "La forma conciliada puede usar el nombre retenido decalina o el nombre sistemático decahidronaftaleno. El perfil validado determina la grafía; que sea un nombre retenido no lo convierte automáticamente en PIN." },
      why: { en: "Both forms refer to the same verified saturated fused C10 framework; the active validated spelling determines which form is displayed.", es: "Ambas formas se refieren al mismo esqueleto C10 saturado y fusionado ya verificado; la grafía conciliada determina cuál se muestra." }, nameFragments: [parent.text], dependsOn: ["decalin.ring-system"], verification: "verified" },
  ];
  if (junction.atomIds.every(id => graph.atoms.some(atom => atom.id === id)) && junction.bondIds.every(([a,b]) => bondExists(graph,a,b))) {
    decisions.push({ id: "decalin.fusion-stereo", kind: "relative-stereochemistry", family: "decalin", rule: "validated-fused-junction-relative-configuration",
      evidenceSource: "FULL graph isomorphism and validated junction stereochemistry", atomIds: [...junction.atomIds], bondIds: [...junction.bondIds], locants: [], result: configuration,
      explanation: configuration === "unspecified"
        ? { en: "The molecular name does not specify a relative configuration at the fused junction; the explanation leaves it unspecified and adds no cis/trans or absolute descriptor.", es: "El nombre no especifica la configuración relativa de la unión fusionada; la explicación la deja sin especificar y no añade descriptores cis/trans ni absolutos." }
        : { en: `The validated junction hydrogens have a ${configuration} relationship: on the same face for cis, on opposite faces for trans. This follows the graph's specified stereochemical identity, not wedge positions in the drawing, and is not a universal conversion to R/S.`,
          es: `Los hidrógenos de la unión verificada tienen relación ${configuration}: están en la misma cara para cis y en caras opuestas para trans. Esto procede de la identidad estereoquímica especificada en el grafo, no de la posición de las cuñas en el dibujo, y no constituye una conversión universal a R/S.` },
      why: { en: "The reconciler first requires agreement between the molecule's junction configuration and the parsed name; this pedagogical step reports that verified result only.", es: "El conciliador exige primero que coincidan la configuración de la unión molecular y la del nombre analizado; este paso pedagógico solo informa ese resultado verificado." }, nameFragments: [parent.text], dependsOn: ["decalin.ring-system"], verification: "verified" });
  }
  decisions.push({ id: "decalin.name-assembly", kind: "name-assembly", family: "decalin", rule: "include-relative-descriptor-only-when-specified",
    evidenceSource: "FULL reconciled parent form and stereo state", atomIds: [...parent.atomIds], bondIds: [...parent.bondIds], locants: [], result: derivation.name,
    explanation: { en: configuration === "unspecified" ? "Use the reconciled parent form without a cis/trans descriptor because fusion stereochemistry is unspecified." : `Use the reconciled ${configuration} descriptor with the selected parent form; the displayed spelling is the name independently matched to the graph.`,
      es: configuration === "unspecified" ? "Se usa la forma parental conciliada sin descriptor cis/trans porque la estereoquímica de fusión está sin especificar." : `Se usa el descriptor ${configuration} con la forma parental seleccionada; la grafía mostrada es el nombre conciliado de forma independiente con el grafo.` },
    why: { en: "Name assembly consumes the validated parent and, only when present, the validated relative configuration.", es: "La composición usa el padre validado y, solo cuando está presente, la configuración relativa verificada." }, nameFragments: [derivation.name], dependsOn: ["decalin.parent-name", ...(configuration === "unspecified" ? [] : ["decalin.fusion-stereo"])], verification: "verified" });
  return { decisions, plan: [
    { id: "ring-system", title: { en: "Identify the fused system", es: "Identificar el sistema fusionado" }, decisionIds: ["decalin.ring-system"], componentIds: ["parent", ...rings.map(item => item.id), ...(configuration === "unspecified" ? ["fusion-junction"] : [])] },
    ...(configuration === "unspecified" ? [] : [{ id: "stereo", title: { en: "Fusion configuration", es: "Configuración de la fusión" }, decisionIds: ["decalin.fusion-stereo"], componentIds: ["fusion-junction"] }]),
    { id: "parent", title: { en: "Select the parent name", es: "Elegir el nombre parental" }, decisionIds: ["decalin.parent-name"], componentIds: ["parent"] },
    { id: "assembly", title: { en: "Build the name", es: "Construir el nombre" }, decisionIds: ["decalin.name-assembly"], componentIds: ["parent", "fusion-junction"] },
  ] };
}

export function adaptNaphthaleneEvidence(graph: GeneratedMolecule, derivation: ValidatedNameDerivation | null): FusedPedagogicalAdaptation | null {
  if (!derivation || derivation.status !== "FULL" || derivation.evidence?.construction !== "fused-naphthalene"
    || derivation.evidence.equivalence !== "complete-graph-isomorphism" || !derivation.evidence.reconstructedGraph) return null;
  const parent = derivation.components.find(item => item.id === "parent");
  if (!parent || parent.atomIds.length !== 10) return null;
  const rings = (graph.rings ?? []).filter(ring => ring.kind === "aromatic" && ring.atomIds.length === 6 && ring.atomIds.every(id => parent.atomIds.includes(id)));
  if (rings.length !== 2) return null;
  const fusionAtoms = rings[0]!.atomIds.filter(id => rings[1]!.atomIds.includes(id));
  const fusionBond = graph.bonds.find(([a,b]) => fusionAtoms.includes(a) && fusionAtoms.includes(b));
  if (fusionAtoms.length !== 2 || !fusionBond) return null;
  const atomIds = graph.atoms.filter(atom => parent.atomIds.includes(atom.id)).map(atom => atom.id);
  const ringBonds = [...rings.flatMap(ring => graph.bonds.filter(([a,b]) => ring.atomIds.includes(a) && ring.atomIds.includes(b)))
    .reduce((unique,bond) => unique.set(bondKey(bond[0],bond[1]), [bond[0],bond[1]] as [number,number]), new Map<string,[number,number]>()).values()];
  const peripheral = parent.numbering.filter(([,locant]) => /^\d+$/.test(String(locant)));
  const substituents = derivation.components.filter(item => item.parentId === "parent" && (item.role === "prefix" || item.role === "suffix" || item.role === "substituent"));
  const suffixes = substituents.filter(item => item.role === "suffix");
  const suffix = suffixes[0];
  const detachable = substituents.filter(item => item.role !== "suffix");
  const attachments = numberedAttachmentDecisions({ graph, derivation, parent, components: substituents,
    family: "naphthalene", numberingDecisionId: "naphthalene.numbering" });
  const hydroxylSites = attachments.filter(item => item.result.endsWith("–O"));
  const diol = derivation.principalGroup === "alcohol" && suffixes.length === 2 && hydroxylSites.length === 2
    && suffixes.every(item => item.text === "diol");
  const hydroxylLocants = hydroxylSites.map(item => item.locants[0]).join(",");
  const singleClass = suffixes.length ? !detachable.length : detachable.filter(c => c.role === "prefix").length === 1;
  const orientationSets = singleClass ? equivalentNaphthaleneLocantSets(attachments.map(item => Number(item.locants[0]))) : [];
  const otherSets = orientationSets.slice(1).map(set => set.join(",")).join(" / ");
  const locantIds = substituents.flatMap(item => item.numbering.filter(([,locant]) => /^\d+$/.test(String(locant))).map(([,locant]) => Number(locant)));
  const decisions: PedagogicalDecision[] = [
    { id: "naphthalene.ring-system", kind: "ring-system-recognition", family: "naphthalene", rule: "two-aromatic-six-membered-rings-share-one-edge",
      evidenceSource: "FULL graph isomorphism and mapped parent/ring data", atomIds, bondIds: ringBonds, locants: [], result: "fused aromatic C10 parent",
      explanation: { en: "Naphthalene has two fused six-membered aromatic rings. They share two atoms and their bond, forming one aromatic system with ten distinct carbon atoms.", es: "El naftaleno contiene dos anillos aromáticos fusionados de seis miembros. Comparten dos átomos y su enlace, y forman un sistema aromático con diez carbonos distintos." },
      why: { en: "The validated parent maps to ten carbon atoms; the two ring atom sets intersect at the same two atoms joined by the shared edge.", es: "El padre validado corresponde a diez átomos de carbono; los conjuntos de los dos anillos se intersectan en los dos átomos unidos por el enlace compartido." }, nameFragments: [parent.text], dependsOn: [], verification: "verified" },
    { id: "naphthalene.numbering", kind: "conventional-numbering", family: "naphthalene", rule: "fixed-conventional-naphthalene-numbering",
      evidenceSource: "FULL validated parent numbering", atomIds: peripheral.map(([id]) => id), bondIds: [], locants: peripheral.map(([,locant]) => Number(locant)), result: "peripheral 1–8; fusion 4a and 8a",
      explanation: { en: "The fused parent uses conventional naphthalene locants: peripheral positions 1–8 and fusion positions 4a and 8a. These locants belong to this fused skeleton; no steroid numbering or drawing-based renumbering is applied.", es: "El padre fusionado utiliza los localizadores convencionales del naftaleno: posiciones periféricas 1–8 y posiciones de fusión 4a y 8a. Corresponden a este esqueleto; no se usa numeración esteroidea ni se renumera según el dibujo." },
      why: otherSets ? {
        en: `The symmetry of the fused skeleton also permits ${otherSets}. Comparing the locant sets from left to right gives ${orientationSets[0]!.join(",")} at the first point of difference.`,
        es: `La simetría del esqueleto fusionado también permite ${otherSets}. Al comparar los conjuntos de izquierda a derecha, se elige ${orientationSets[0]!.join(",")} por el primer punto de diferencia.`,
      } : { en: "The shared edge fixes the fusion positions 4a and 8a in each equivalent orientation.", es: "En cada orientación equivalente, el enlace compartido fija las posiciones de fusión 4a y 8a." }, nameFragments: substituents.map(item => item.text), dependsOn: ["naphthalene.ring-system"], verification: "verified" },
    ...attachments,
    ...(suffix ? [{ id: "naphthalene.functional-priority", kind: diol ? "functional-multiplicity" as const : "functional-priority" as const, family: "naphthalene" as const,
      rule: "validated-principal-group-and-suffix-component", evidenceSource: "FULL principal-group result and mapped suffix component",
      atomIds: suffixes.flatMap(item => item.atomIds), bondIds: suffixes.flatMap(item => item.bondIds), locants: suffixes.flatMap(item => item.numbering.map(([,locant]) => locant)),
      result: derivation.principalGroup, explanation: {
        en: diol ? `Each of the two hydroxyl groups is bonded directly to the same fused parent. Their locants ${hydroxylLocants} precede the shared ending diol, where di- counts the two groups.`
          : derivation.principalGroup === "carboxylicAcid" ? "The carboxylic acid is the principal group and is expressed by the validated carboxylic-acid ending; the carboxyl carbon remains outside the fused ring skeleton."
          : derivation.principalGroup === "ester" ? "The ring carboxylate ester is the principal group; its suffix and the separate alkyl-on-oxygen component follow the validated ester construction."
            : derivation.principalGroup === "alcohol" ? "The mapped hydroxyl group is expressed by the validated alcohol ending at its naphthalene locant."
              : derivation.principalGroup === "amine" ? "The mapped amino group is the principal group and is expressed by the validated amine ending at its naphthalene locant."
                : "The validated suffix-bearing group determines the name ending at its mapped naphthalene locant.",
        es: diol ? `Los dos hidroxilos están unidos directamente al mismo padre fusionado. Sus localizadores ${hydroxylLocants} preceden a la terminación común diol, donde di- cuenta ambos grupos.`
          : derivation.principalGroup === "carboxylicAcid" ? "El ácido carboxílico es el grupo principal y se expresa mediante la terminación validada de ácido carboxílico; el carbono carboxílico queda fuera del esqueleto del anillo fusionado."
          : derivation.principalGroup === "ester" ? "El éster carboxilato unido al anillo es el grupo principal; el sufijo y el componente alquilo unido al oxígeno siguen la construcción de éster validada."
            : derivation.principalGroup === "alcohol" ? "El hidroxilo mapeado se expresa mediante la terminación de alcohol validada en su localizador del naftaleno."
              : derivation.principalGroup === "amine" ? "El grupo amino mapeado es el grupo principal y se expresa mediante la terminación de amina validada en su localizador del naftaleno."
                : "El grupo con sufijo validado determina la terminación del nombre en su localizador mapeado del naftaleno." },
      why: { en: "The principal-group label and the suffix atom/bond mapping come from the independent FULL derivation; no priority is inferred from the drawing.", es: "La función principal y el mapa de átomos y enlaces del sufijo proceden de la derivación FULL independiente; la prioridad no se deduce del dibujo." },
      nameFragments: [suffix.text], dependsOn: ["naphthalene.numbering"], verification: "verified" as const }] : []),
    ...detachable.map((component,index) => ({ id: `naphthalene.substituent.${index+1}`, kind: "substituent-recognition" as const, family: "naphthalene" as const,
      rule: "validated-substituent-identity-and-attachment-locant", evidenceSource: "FULL mapped name component and attachment bonds",
      atomIds: [...component.atomIds], bondIds: [...component.bondIds], locants: component.numbering.map(([,locant]) => locant), result: component.text,
      explanation: { en: component.explanation || `The validated ${component.label ?? component.text} component remains at its mapped parent locant.`,
        es: component.explanationEs || `El componente validado ${component.labelEs ?? component.text} conserva su localizador mapeado en el padre.` },
      why: { en: "The substituent's identity, attachment bond and parent position are taken from the reconciled component mapping.",
        es: "La identidad del sustituyente, el enlace de unión y su posición en el padre proceden del mapa del componente conciliado." },
      nameFragments: [component.text], dependsOn: ["naphthalene.numbering"], verification: "verified" as const })),
    { id: "naphthalene.name-assembly", kind: "name-assembly", family: "naphthalene", rule: "validated-fused-parent-substituent-suffix-assembly",
      evidenceSource: "FULL reconciled name and mapped components", atomIds: [...parent.atomIds], bondIds: [...parent.bondIds], locants: locantIds, result: derivation.name,
      explanation: { en: `The validated name combines the fused parent${substituents.length ? " with its mapped substituents or characteristic group" : ""}; the displayed spelling and locants are those independently reconciled to the graph.`,
        es: `El nombre validado combina el padre fusionado${substituents.length ? " con sus sustituyentes o grupo característico localizado" : ""}; la grafía y los localizadores mostrados son los conciliados de forma independiente con el grafo.` },
      why: { en: "Only components present in the validated derivation contribute; the adapter does not infer absent functions or locants.", es: "Solo contribuyen los componentes presentes en la derivación validada; el adaptador no infiere funciones ni localizadores ausentes." },
      nameFragments: [derivation.name, ...substituents.map(item => item.text)],
      dependsOn: ["naphthalene.numbering", ...(suffix ? ["naphthalene.functional-priority"] : []), ...detachable.map((_,index)=>`naphthalene.substituent.${index+1}`)], verification: "verified" as const },
  ];
  const inventory = buildPedagogicalNameInventory(derivation,graph);
  for (const decision of decisions) {
    const source = detachable[Number(decision.id.split(".").at(-1))-1];
    const ids = decision.id === "naphthalene.ring-system" ? ["parent"]
      : decision.id === "naphthalene.functional-priority" ? suffixes.map(c=>c.id)
      : decision.id.startsWith("naphthalene.substituent.") && source ? [source.id] : [];
    decision.componentBindings = inventory.components.filter(c=>c.aspect==="identity" && ids.includes(c.id)
      || decision.id === "naphthalene.numbering" && c.aspect === "locants"
      || decision.id === "naphthalene.name-assembly" && c.aspect === "assembly").map(nameComponentBinding);
    if (decision.id === "naphthalene.name-assembly") {
      decision.atomIds = graph.atoms.map(a=>a.id);
      decision.bondIds = graph.bonds.map(([a,b])=>[a,b]);
    }
  }
  return { decisions, plan: [
    { id: "ring-system", title: { en: "Identify the fused aromatic system", es: "Identificar el sistema aromático fusionado" }, decisionIds: ["naphthalene.ring-system"], componentIds: ["parent", ...rings.map((_,i) => `fused-ring:${i+1}`), "fusion-atoms", "fusion-bonds"] },
    { id: "numbering", title: { en: "Numbering", es: "Numeración" }, decisionIds: ["naphthalene.numbering"], detailDecisionIds: attachments.map(item => item.id), componentIds: ["parent", ...substituents.map(item => item.id)] },
    ...(suffix ? [{ id: "functional-priority", title: { en: "Identify the principal function", es: "Identificar la función principal" }, decisionIds: ["naphthalene.functional-priority"], componentIds: suffixes.map(item => item.id) }] : []),
    ...(detachable.length ? [{ id: "substituents", title: { en: "Identify substituents and attachment positions", es: "Identificar sustituyentes y posiciones de unión" }, decisionIds: detachable.map((_,index)=>`naphthalene.substituent.${index+1}`), componentIds: detachable.map(item=>item.id) }] : []),
    { id: "assembly", title: { en: "Build the name", es: "Construir el nombre" }, decisionIds: ["naphthalene.name-assembly"], componentIds: ["parent", ...substituents.map(item => item.id)] },
  ] };
}
