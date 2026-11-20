import type { AppLanguage } from "./i18n.ts";
import { buildValidatedVisualNumbering } from "./visual-numbering.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { analyzeStructuralEquivalence, type StructuralComponent, type StructuralDerivation } from "./structural-derivation.ts";
import type { AlphabeticalOrderPresentation } from "./reasoning-alphabetical-order.ts";
import { describeAlphabeticalOrder } from "./reasoning-alphabetical-order.ts";
import { resolveAcyloxyRegions } from "./reasoning-acyloxy-regions.ts";
import type { ReasoningNameFragment } from "./reasoning-name-fragments.ts";
import { reasoningFragmentId } from "./reasoning-visual-targets.ts";
import type { ReasoningVisualTarget } from "./reasoning-visual-targets.ts";
import { reconciledParentSelectionEvidence, type ParentSelectionEvidence } from "./reasoning-parent-selection.ts";
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
  parentSelectionEvidence?: ParentSelectionEvidence;
  source: "FULL" | "structural" | "local";
};

export type PriorityReasoningModel = { steps: PriorityReasoningStep[]; name: string };

export function shouldShowStructuralPriorityReasoning(input: {
  hasValidatedDerivation: boolean; reasoningUnsupported: boolean; structuralStatus: StructuralDerivation["status"];
}) {
  return !input.hasValidatedDerivation && input.reasoningUnsupported && input.structuralStatus === "PARTIAL";
}

const groupNames = {
  en: { none: "no characteristic suffix group", carboxylicAcid: "carboxylic acid", amide: "amide", ester: "ester", aldehyde: "aldehyde", ketone: "ketone", alcohol: "alcohol", amine:"amine", nitrile:"nitrile", heterocycle: "heterocyclic function" },
  es: { none: "sin grupo característico de sufijo", carboxylicAcid: "ácido carboxílico", amide: "amida", ester: "éster", aldehyde: "aldehído", ketone: "cetona", alcohol: "alcohol", amine:"amina", nitrile:"nitrilo", heterocycle: "función heterocíclica" },
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

function verifiedExternalMultiplier(component: NameComponent, derivation: ValidatedNameDerivation) {
  if (component.externalMultiplier) return component.externalMultiplier;
  if (!component.equivalenceGroup) return "";
  const count = derivation.components.filter(item => item.equivalenceGroup === component.equivalenceGroup
    && (item.parentId ?? "parent") === (component.parentId ?? "parent")).length;
  const expected: Record<number,string> = {2:"di",3:"tri",4:"tetra",5:"penta",6:"hexa",7:"hepta",8:"octa",9:"nona",10:"deca"};
  const multiplier = expected[count];
  if (!multiplier) return "";
  const name = component.text.replace(/^(?:(?:N(?:,N)*|[0-9]+(?:,[0-9]+)*)-)/, "");
  return name.startsWith(multiplier) ? multiplier : "";
}

function peerNameForOrder(component: NameComponent, derivation: ValidatedNameDerivation) {
  const locant = /^(?:(?:N(?:,N)*|[0-9]+(?:,[0-9]+)*)-)/.exec(component.text)?.[0] ?? "";
  const cited = component.text.slice(locant.length);
  const multiplier = verifiedExternalMultiplier(component, derivation);
  const name = multiplier ? cited.slice(multiplier.length).replace(/^-/, "") : cited;
  // Locants and grouping marks are not initial letters; every alphabetic part
  // of the complete term stays in the key, including internal di-/tri- terms.
  const comparisonName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "").toLocaleLowerCase();
  return { cited, name, multiplier, comparisonName };
}

function compareLocantEvidence(left: readonly number[], right: readonly number[]) {
  for (let index=0;index<Math.max(left.length,right.length);index+=1) {
    const difference=(left[index]??Number.MAX_SAFE_INTEGER)-(right[index]??Number.MAX_SAFE_INTEGER);
    if(difference)return difference;
  }
  return 0;
}

function localTerm(text: string, language: AppLanguage) {
  if (language === "en") return text;
  const terms: Record<string, string> = {
    phenyl: "fenilo", hydroxy: "hidroxi", methyl: "metilo", "2-methylpropyl": "2-metilpropilo",
    "oic acid": "ácido carboxílico", amide: "amida",
  };
  return terms[text] ?? text;
}

function componentLabel(component: NameComponent, language: AppLanguage, derivation: ValidatedNameDerivation) {
  if (component.id === "parent") {
    if (derivation.principalGroup === "amide" && component.text === "acetamide") return language === "en" ? "acetamide" : "acetamida";
    if (derivation.principalGroup === "carboxylicAcid" && component.text === "benzoic acid") return language === "en" ? component.text : "ácido benzoico";
    const acyclicAcid = /^(meth|eth|prop|but|pent|hex|hept|oct|non|dec)anoic acid$/.exec(component.text);
    if (derivation.principalGroup === "carboxylicAcid" && acyclicAcid) {
      const es = { meth:"metanoico", eth:"etanoico", prop:"propanoico", but:"butanoico", pent:"pentanoico", hex:"hexanoico", hept:"heptanoico", oct:"octanoico", non:"nonanoico", dec:"decanoico" }[acyclicAcid[1]];
      return language === "en" ? component.text : `ácido ${es}`;
    }
    return component.text;
  }
  if (component.id === "suffix") return groupNames[language][derivation.principalGroup];
  if (component.id === "aryl-prefix" && component.text.includes(",") && language === "es")
    return `Grupos metilo en C${component.numbering.map(([, locant]) => locant).join(" y C")}`;
  if (component.id === "aryl" || component.text.endsWith("phenyl")) {
    if (language === "en") return component.text;
    return component.text.replace(/2-methylpropyl/g, "2-metilpropil")
      .replace(/hydroxy/g, "hidroxi")
      .replace(/methyl/g, "metil")
      .replace(/phenyl/g, "fenilo");
  }
  if (component.id.startsWith("sugar-") && (component.labelEs || component.label))
    return language === "es" ? component.labelEs ?? component.label! : component.label ?? component.labelEs!;
  // Translate the complete rooted substituent first: dropping its leading
  // locant turns e.g. 2-methylpropyl into the unrecognized "methylpropyl".
  const term = component.text.replace(/^\(|\)$/g, "");
  const translated = language === "es" && component.id === "acyloxy" && component.labelEs
    ? component.labelEs : localTerm(term, language);
  const locant = component.locant === undefined ? "" : language === "en" ? ` at ${component.locant}` : ` en ${component.locant}`;
  return `${translated}${locant}`;
}

function localizedComponentExplanation(component: NameComponent, language: AppLanguage) {
  if (language === "en") return component.explanation;
  // Name components may come from an English source while the reasoning UI is
  // Spanish. Use an authored Spanish explanation when available; never leak an
  // English sentence into the localized view.
  const explanation = component.explanationEs ?? (component.language === "es" ? component.explanation : undefined);
  if (!explanation) return undefined;
  return explanation
    .replace(/\bhydroxy\b/gi, "hidroxi")
    .replace(/\bphenyl\b/gi, "fenilo")
    .replace(/\b2-methylpropyl\b/gi, "2-metilpropilo")
    .replace(/\bmethyl\b/gi, "metilo")
    .replace(/\bethyl\b/gi, "etilo")
    .replace(/\bacetyl\b/gi, "acetilo");
}

function componentFragment(component: NameComponent, language: AppLanguage, derivation: ValidatedNameDerivation): ReasoningNameFragment {
  const literal=!!derivation.evidence || component.language===language;
  const text = literal ? component.text : componentLabel(component, language, derivation);
  const parentAtoms=new Set(derivation.parentAtomIds);
  const positions=component.numbering.flatMap(([id,locant])=>parentAtoms.has(id)&&typeof locant==="number"?[locant]:[]);
  const attachments=component.bondIds.filter(([a,b])=>parentAtoms.has(a)!==parentAtoms.has(b)).length;
  const repeated=component.role==="prefix" && positions.length>1 && attachments===positions.length;
  const explanation=repeated
    ? language==="en" ? `The selected prefix represents ${positions.length} separate groups at parent positions ${positions.join(", ")}.`
      : `El prefijo seleccionado representa ${positions.length} grupos separados en las posiciones ${positions.join(", ")} del progenitor.`
    : localizedComponentExplanation(component, language);
  return { text, label: language === "en" ? `Select ${text}` : `Seleccionar ${text}`,
    kind: component.role === "parent" ? "parent" : component.role === "suffix" ? "function"
      : component.role === "unsaturation" ? "unsaturation"
      : component.role === "substituent" || component.role === "prefix" ? "substituent" : "numbering",
    ...(literal?{start:component.start,language:component.language,numberingScope:component.numberingScope}:{}),
    ...(explanation?{explanation}:{}),
    semanticId: component.id, atomIds: component.atomIds, bondIds: component.bondIds };
}

function safeValidatedTargets(graph:GeneratedMolecule,derivation:ValidatedNameDerivation) {
  const targets=validatedNameTargets(derivation), evidence=derivation.evidence;
  if(!evidence || evidence.numbering.comparison!==0
    || !["retained-aromatic","aromatic-ester","functional-monocycle"].includes(evidence.construction))return targets;
  const parent=new Set(derivation.components.find(c=>c.role==="parent")?.atomIds??[]);
  const visible=buildValidatedVisualNumbering(graph,derivation);
  return Object.fromEntries(Object.entries(targets).map(([id,target])=>[id,{...target,
    locants:target.locants.filter(([atom,locant])=>!parent.has(atom)||typeof locant!=="number"||visible.get(atom)===locant)}]));
}

function makeStep(input: {
  number: string; title: string; explanation: string; components: readonly NameComponent[];
  derivation: ValidatedNameDerivation; language: AppLanguage; graph: GeneratedMolecule;
  alphabeticalOrder?: AlphabeticalOrderPresentation;
}): PriorityReasoningStep {
  const { number, title, explanation, components, derivation, language, graph, alphabeticalOrder } = input;
  const targets = safeValidatedTargets(graph,derivation);
  const fragments = components.map(component => componentFragment(component, language, derivation));
  if (title === (language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores"))
    fragments.forEach((fragment, index) => {
      const component = components[index], parentAtoms = new Set(derivation.parentAtomIds);
      const positions = component.numbering.filter(([id, locant]) => parentAtoms.has(id) && typeof locant === "number");
      const attachments = component.bondIds.filter(([a, b]) => parentAtoms.has(a) !== parentAtoms.has(b)).length;
      const repeatedPrefix = component.role === "prefix" && positions.length > 1 && attachments === positions.length;
      if (!component.equivalenceGroup && !repeatedPrefix) delete fragment.explanation;
    });
  const combined: ReasoningNameFragment | undefined = fragments.length
    ? { ...fragments[0], additionalFragments: fragments.slice(1) } : undefined;
  const fragmentTargets: Record<string, ReasoningVisualTarget> = {};
  components.forEach((component, index) => {
    const target = targets[component.id] ?? (component.equivalenceGroup ? {stepNumber:component.id,atomIds:component.atomIds,bondIds:component.bondIds,locants:component.numbering} : undefined), fragment = fragments[index];
    if (target) fragmentTargets[reasoningFragmentId(number, fragment)] = { ...target, stepNumber: number,
      fragmentId: reasoningFragmentId(number, fragment) };
  });
  const locantFragments: ReasoningNameFragment[] = [], numberingTargets: ReasoningVisualTarget[] = [], seenLocants = new Set<string>();
  const addLocants = (component: NameComponent, labelPrefix: string) => {
    const entries = derivation.evidence
      ? (component.writtenLocants??[]).map(item=>({atomId:item.atomId,locant:item.locant,start:item.start}))
      : component.numbering.map(([atomId,locant])=>({atomId,locant,start:undefined}));
    for (const {atomId,locant,start} of entries) {
      if (!graph.atoms.some(atom => atom.id === atomId)) continue;
      if (component.id === "parent" && derivation.evidence?.numbering.comparison === 0
        && ["retained-aromatic", "aromatic-ester", "functional-monocycle"].includes(derivation.evidence.construction)
        && buildValidatedVisualNumbering(graph,derivation).get(atomId) !== locant) continue;
      const key = `${atomId}:${locant}`;
      if (seenLocants.has(key)) continue;
      seenLocants.add(key);
      const label = `${labelPrefix} ${locant}`;
      const item: ReasoningNameFragment = { text: String(locant), label, kind: "numbering",
        ...(start!==undefined?{start,language,numberingScope:component.id}:{}),
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
  for (const component of components) if (component.parentId && component.writtenLocants?.length)
    addLocants(component, language==="en" ? "Internal locant" : "Localizador interno");
  // Literal internal locants select branch atoms only. Never merge these into
  // parent numbering or the canvas's global map.
  for (const component of components) if (component.attachmentScope === "amide-nitrogen" && component.locant === "N") {
    const atomId=component.numbering.find(([,locant])=>locant==="N")?.[0];
    const starts=component.nLocantStarts??[component.start-2];
    for(const [index,start] of starts.entries()) if(atomId!==undefined && derivation.name.slice(start,start+1)==="N") {
      const item: ReasoningNameFragment={text:"N",start,kind:"numbering",language,numberingScope:component.id,
        atomIds:[atomId],semanticId:`amide-n-locant:${component.id}${starts.length>1?`:${index}`:""}`,
        label:language==="en"?"Amide nitrogen locant":"Localizador del nitrógeno amídico"};
      locantFragments.push(item);
      const fragmentId=reasoningFragmentId(number,item);
      fragmentTargets[fragmentId]={stepNumber:number,fragmentId,atomIds:[atomId],bondIds:[],locants:[]};
    }
    if(component.equivalenceGroup && component.text.startsWith("di")) {
      const item:ReasoningNameFragment={text:"di",start:component.start,kind:"substituent",language,
        semanticId:`amide-multiplier:${component.id}`,atomIds:component.atomIds,bondIds:component.bondIds,
        label:language==="en"?"Two equivalent substituents":"Dos sustituyentes equivalentes"};
      locantFragments.push(item);const fragmentId=reasoningFragmentId(number,item);
      fragmentTargets[fragmentId]={stepNumber:number,fragmentId,atomIds:component.atomIds,bondIds:component.bondIds,locants:[]};
    }
  }
  for(const component of components) if(component.internalNumbering) {
    const systematic = /^prop-([1-9])-en-([1-9])-(?:il|yl)$/.exec(component.text);
    if (systematic) {
      for (const [token, relative] of [[systematic[1],5],[systematic[2],10]] as const) {
        const locant=Number(token), atomId=component.internalNumbering.find(([,n])=>n===locant)?.[0];
        if(atomId===undefined)continue;
        const item: ReasoningNameFragment={text:token,start:component.start+relative,kind:"numbering",language,
          numberingScope:component.id,locant,atomIds:[atomId],semanticId:`branch-locant:${component.id}:${relative}`,
          label:language==="en"?`Branch locant ${locant}`:`Localizador interno de rama ${locant}`};
        locantFragments.push(item);
        const fragmentId=reasoningFragmentId(number,item);
        fragmentTargets[fragmentId]={stepNumber:number,fragmentId,atomIds:[atomId],bondIds:[],locants:[[atomId,locant]]};
      }
      continue;
    }
    const written=/^([1-9](?:,[1-9])*)-/.exec(component.text);
    if(!written)continue;
    let relative=0;
    for(const token of written[1].split(",")) {
      const locant=Number(token), atomId=component.internalNumbering.find(([,n])=>n===locant)?.[0];
      if(atomId===undefined)continue;
      const item: ReasoningNameFragment={text:token,start:component.start+relative,kind:"numbering",language,
        numberingScope:component.id,locant,atomIds:[atomId],semanticId:`branch-locant:${component.id}:${relative}`,
        label:language==="en"?`Branch locant ${locant}`:`Localizador interno de rama ${locant}`};
      relative+=token.length+1;
      locantFragments.push(item);
      const fragmentId=reasoningFragmentId(number,item);
      fragmentTargets[fragmentId]={stepNumber:number,fragmentId,atomIds:[atomId],bondIds:[],locants:[[atomId,locant]]};
    }
  }
  const allFragments = [...fragments, ...locantFragments];
  const fragmentView = allFragments.length ? { ...allFragments[0], additionalFragments: allFragments.slice(1) } : undefined;
  const stepTargets = title === (language === "en" ? "Numbering" : "Numeración")
    ? numberingTargets : components.map(component => targets[component.id] ?? (component.equivalenceGroup ? {stepNumber:component.id,atomIds:component.atomIds,bondIds:component.bondIds,locants:component.numbering}:undefined)).filter(Boolean);
  return { number, title, explanation, target: unionTarget(number, stepTargets),
    fragments: fragmentView, fragmentTargets, componentIds: components.map(component => component.id), source: "FULL", alphabeticalOrder };
}

/** Projects FULL component evidence into the same numbered priority-list UI as
 * the original reasoning flow. Its ordering is semantic, never component order. */
export function buildValidatedPriorityReasoning(input: {
  derivation: ValidatedNameDerivation; graph: GeneratedMolecule; language: AppLanguage;
  alphabeticalOrder?: AlphabeticalOrderPresentation;
  activeName?: string;
  structuralEvidence?: StructuralDerivation;
}): PriorityReasoningModel {
  const { derivation, graph, language } = input, byId = new Map(derivation.components.map(component => [component.id, component]));
  const parent = byId.get("parent") ?? derivation.components.find(component => component.role === "parent");
  const carbohydrate = derivation.parentSystem === "carbohydrate";
  const suffix = carbohydrate
    ? byId.get("sugar-polyol") ?? byId.get("sugar-open")
    : byId.get("suffix") ?? derivation.components.find(component => component.role === "suffix");
  const displayedComponents:NameComponent[]=[];
  for(const component of derivation.components) {
    if(!component.equivalenceGroup){displayedComponents.push(component);continue;}
    if(displayedComponents.some(c=>c.equivalenceGroup===component.equivalenceGroup))continue;
    const siblings=derivation.components.filter(c=>c.equivalenceGroup===component.equivalenceGroup);
    const amideBranchExplanationEn=siblings.length===2
      ?"The 2 separate branches attach to the same amide nitrogen; di- counts both, not one longer chain."
      :`${siblings.length} separate branches attach to the same amide nitrogen.`;
    const amideBranchExplanationEs=siblings.length===2
      ?"Las 2 ramas separadas se unen al mismo nitrógeno amídico; di- cuenta ambas, no una cadena más larga."
      :`${siblings.length} ramas separadas se unen al mismo nitrógeno amídico.`;
    const groupExplanationEn=siblings.length===2
      ?"This substituent represents 2 separate groups at the parent positions."
      :`This substituent represents ${siblings.length} separate groups at the parent positions.`;
    const groupExplanationEs=siblings.length===2
      ?"Este sustituyente representa 2 grupos separados en las posiciones del padre."
      :`Este sustituyente representa ${siblings.length} grupos separados en las posiciones del padre.`;
    const isAmideBranch=siblings.some(sibling=>sibling.attachmentScope==="amide-nitrogen");
    displayedComponents.push({...component,id:component.equivalenceGroup,atomIds:siblings.flatMap(c=>c.atomIds),
      bondIds:siblings.flatMap(c=>c.bondIds),nLocantStarts:siblings.flatMap(c=>c.nLocantStarts??[]),
      explanation:language==="en"?(isAmideBranch?amideBranchExplanationEn:groupExplanationEn)
        :(isAmideBranch?amideBranchExplanationEs:groupExplanationEs),
      explanationEs:isAmideBranch?amideBranchExplanationEs:groupExplanationEs});
  }
  const roots = displayedComponents.filter(component => component.role === "substituent"
    && (!component.parentId || component.parentId === "parent"));
  const stereoComponents = derivation.components.filter(component => /stereo|cip|anomer|series/i.test(component.id));
  const descendants = derivation.components.filter(component => !stereoComponents.includes(component) && (component.role === "prefix"
    || component.role === "substituent" && component.parentId && component.parentId !== "parent"));
  const stages: Omit<Parameters<typeof makeStep>[0], "number" | "derivation" | "language" | "graph">[] = [];
  if (suffix) {
    const elements = new Map(graph.atoms.map(atom => [atom.id, atom.element ?? "C"]));
    const characteristicBonds = graph.bonds.filter(([a,b])=>suffix.atomIds.includes(a)&&suffix.atomIds.includes(b));
    const hasBond = (left:string,right:string,order:number) => characteristicBonds.some(([a,b,o])=>o===order
      && (elements.get(a)===left&&elements.get(b)===right || elements.get(a)===right&&elements.get(b)===left));
    const carbonyl=hasBond("C","O",2), nitrile=hasBond("C","N",3);
    const detail=carbonyl ? (language==="en" ? " Its selected atoms include a C=O carbonyl bond." : " Sus átomos seleccionados incluyen un enlace carbonilo C=O.")
      : nitrile ? (language==="en" ? " Its selected atoms include the C≡N bond." : " Sus átomos seleccionados incluyen el enlace C≡N.") : "";
    const ester=derivation.principalGroup==="ester" && characteristicBonds.some(([a,b,o])=>o===1
      && (elements.get(a)==="C"&&elements.get(b)==="O" || elements.get(a)==="O"&&elements.get(b)==="C"));
    const hydroxyPrefix = derivation.components.some(component => component.role === "prefix"
      && /hydroxy/i.test(component.text) && component.atomIds.some(id => elements.get(id) === "O"));
    const priorityDetail = derivation.principalGroup === "amide" && hydroxyPrefix
      ? language === "en" ? " The amide has priority over the hydroxyl group, so hydroxy- is expressed as a prefix while amide supplies the suffix."
        : " La amida tiene prioridad sobre el grupo hidroxilo: hidroxi- se expresa como prefijo y la amida aporta el sufijo."
      : "";
    stages.push({ title: language === "en" ? "Principal functional group" : "Grupo funcional principal",
      explanation: (language === "en" ? `${groupNames.en[derivation.principalGroup]} is the principal functional group and is expressed by the validated suffix.`
        : `La función principal es ${groupNames.es[derivation.principalGroup]} y se expresa mediante el sufijo validado.`)+detail
        +priorityDetail
        +(derivation.evidence?.construction === "acyclic-aryl-amine"
          ? " " + localizedComponentExplanation(suffix,language)
          : "")
        +(ester ? (language==="en" ? " The ester oxygen connects the acid-derived part to the alcohol-derived group attached to the ester oxygen." : " El oxígeno del éster conecta la parte derivada del ácido con el grupo derivado del alcohol unido al oxígeno del éster.") : ""), components: [suffix] });
  }
  if (derivation.principalGroup === "none") {
    const nitro = derivation.components.filter(component => component.role === "prefix" && /nitro$/.test(component.text)
      && component.atomIds.some(id => graph.atoms.find(atom => atom.id === id)?.element === "N"
        && component.atomIds.filter(other => graph.atoms.find(atom => atom.id === other)?.element === "O"
          && graph.bonds.some(([a,b]) => a === id && b === other || a === other && b === id)).length === 2));
    if (nitro.length) stages.push({title:language === "en" ? "Function expressed as a prefix" : "Función expresada como prefijo",
      explanation:language === "en" ? "The nitro functional group is cited as a prefix; this name has no principal characteristic group expressed by a suffix."
        : "El grupo funcional nitro se cita como prefijo; este nombre no tiene un grupo característico principal expresado mediante sufijo.",
      components:nitro});
  }
  if (parent) {
    const ring = (graph.rings ?? []).find(candidate => candidate.atomIds.length >= 3 && candidate.atomIds.every(id => parent.atomIds.includes(id)));
    const carbonCount = parent.atomIds.filter(id => graph.atoms.find(atom => atom.id === id)?.element === "C").length;
    const rootRing = roots.find(root => (graph.rings ?? []).some(candidate => candidate.atomIds.length >= 3 && candidate.atomIds.every(id => root.atomIds.includes(id))));
    const rule = /P-\d+(?:\.\d+)+/.exec(parent.explanation)?.[0];
    const explanation = derivation.evidence
      ? language==="es"?parent.explanationEs??parent.explanation:parent.explanation
      : derivation.principalGroup === "none"
      ? language === "en" ? parent.explanation : parent.explanationEs ?? parent.explanation
      : derivation.principalGroup === "amide" && roots.some(root => root.locant === "N")
      ? language === "en" ? "The amide is the parent; N- marks substitution on its nitrogen."
        : "La amida es el padre; N- indica que el sustituyente se une a su nitrógeno."
      : ring && derivation.principalGroup === "carboxylicAcid"
        ? language === "en" ? `The ring is the validated parent; the carboxyl carbon remains outside the ring.${rule ? ` (${rule})` : ""}`
          : `El anillo es el padre validado; el carbono carboxílico queda fuera del anillo.${rule ? ` (${rule})` : ""}`
        : language === "en" ? `The selected parent is the ${ring ? "cyclic system" : `acyclic ${carbonCount}-carbon chain`}${rootRing ? "; the attached ring is a substituent" : ""}.${rule ? ` (${rule})` : ""}`
          : `El padre seleccionado es ${ring ? "el sistema cíclico" : `la cadena acíclica de ${carbonCount} carbonos`}${rootRing ? "; el anillo unido es un sustituyente" : ""}.${rule ? ` (${rule})` : ""}`;
    const functionalCarbon=suffix?.atomIds.find(id=>(graph.atoms.find(atom=>atom.id===id)?.element??"C")==="C"
      && graph.bonds.some(([a,b,order])=>order===2 && (a===id&&suffix.atomIds.includes(b)&&graph.atoms.find(atom=>atom.id===b)?.element==="O"
        || b===id&&suffix.atomIds.includes(a)&&graph.atoms.find(atom=>atom.id===a)?.element==="O")));
    const ringDetail=ring && functionalCarbon!==undefined && !ring.atomIds.includes(functionalCarbon)
      && graph.bonds.some(([a,b])=>a===functionalCarbon&&ring.atomIds.includes(b)||b===functionalCarbon&&ring.atomIds.includes(a))
      ? (language==="en" ? ` The ring has ${ring.atomIds.length} atoms; the carbonyl carbon is outside it.`
        : ` El anillo tiene ${ring.atomIds.length} átomos; el carbono carbonílico está fuera de él.`) : "";
    stages.push({ title: language === "en" ? "Parent structure" : "Estructura principal", explanation:explanation+ringDetail,
      components: [parent, ...(carbohydrate && byId.get("sugar-ring") ? [byId.get("sugar-ring")!] : [])] });
  }
  const numberComponents = [parent, byId.get("aryl"), ...derivation.components.filter(component => component.id.startsWith("sugar-chain"))]
    .filter((component): component is NameComponent => Boolean(component && component.numbering.length));
  const aromaticEvidence=derivation.evidence && ["retained-aromatic", "aromatic-ester", "functional-monocycle"].includes(derivation.evidence.construction)
    ? derivation.evidence : undefined;
  const writtenPositions=[...new Set(parent?.writtenLocants?.map(item=>item.locant)??[])].sort((a,b)=>a-b);
  const numberExplanation=aromaticEvidence
    ? language==="en" ? `Ring C1 bears the characteristic group${writtenPositions.length?`; the written substituent positions are ${writtenPositions.join(", ")}`:""}. ${aromaticEvidence.numbering.comparison===0?"Equivalent orientations remain; only unambiguous atom locants are shown.":"The supported locants determine the displayed orientation."}`
      : `C1 del anillo lleva el grupo característico${writtenPositions.length?`; las posiciones escritas de los sustituyentes son ${writtenPositions.join(", ")}`:""}. ${aromaticEvidence.numbering.comparison===0?"Hay orientaciones equivalentes; solo se muestran los localizadores inequívocos por átomo.":"Los localizadores respaldados determinan la orientación mostrada."}`
    : derivation.evidence?.construction === "acyclic-aryl-amine"
      ? language === "en" ? `The amine fixes parent C1. Carbon substituents occur at ${writtenPositions.filter(p=>p!==1).map(p=>"C"+p).join(", ") || "C1"}. Ring locants start again at the attachment carbon.`
        : `La amina fija C1 del padre. Los sustituyentes sobre carbono se sitúan en ${writtenPositions.filter(p=>p!==1).map(p=>"C"+p).join(", ") || "C1"}. Los localizadores del anillo se cuentan desde su carbono de unión.`
    : language === "en" ? roots.length || descendants.length
      ? "Parent, ring, and nested-substituent locants belong to their own numbering systems."
      : "Locants follow the numbering of the verified parent structure."
      : roots.length || descendants.length ? "El padre, el anillo y los sustituyentes anidados conservan sistemas de numeración independientes."
        : "Los localizadores siguen la numeración de la estructura parental validada.";
  if (numberComponents.length) stages.push({ title: language === "en" ? "Numbering" : "Numeración",
    explanation:numberExplanation, components: numberComponents });
  const unsaturations=derivation.components.filter(component=>component.role==="unsaturation");
  if(unsaturations.length)stages.push({title:language==="en"?"Unsaturation":"Insaturaciones",
    explanation:unsaturations.map(c=>language==="es"?c.explanationEs??c.explanation:c.explanation).join(" "),components:unsaturations});
  const assigned = new Set([parent?.id, suffix?.id, ...numberComponents.map(component => component.id),
    ...roots.map(component => component.id), ...descendants.map(component => component.id),
    ...(carbohydrate && byId.get("sugar-ring") ? ["sugar-ring"] : [])]);
  const facets = carbohydrate ? derivation.components.filter(component => !assigned.has(component.id)
    && component.id !== "parent") : [];
  const substituents = [...roots, ...descendants, ...facets].filter((component, index, all) => all.findIndex(item => item.id === component.id) === index);
  if (substituents.length) {
    const descriptions=substituents.map(component=>{
      const specific = localizedComponentExplanation(component, language);
      if (specific) return specific;
      const label=`«${componentLabel(component, language, derivation)}»`;
      const parentAtoms=new Set(parent?.atomIds??[]);
      const positions=[...new Set(component.numbering.flatMap(([id,locant])=>parentAtoms.has(id)&&typeof locant==="number"?[locant]:[]))];
      const attachmentCount=component.bondIds.filter(([a,b])=>parentAtoms.has(a)!==parentAtoms.has(b)).length;
      if(component.attachmentScope==="amide-nitrogen") {
        const count=component.equivalenceGroup ? derivation.components.filter(c=>c.equivalenceGroup===component.equivalenceGroup).length : 1;
        return language==="en" ? `${label}: ${count===1?"one branch":`${count} separate branches`} attached to the amide nitrogen${count===2?"; di- counts both, not a single longer chain":""}.`
          : `${label}: ${count===1?"una rama unida":`${count} ramas separadas unidas`} al nitrógeno amídico${count===2?"; di- cuenta ambas, no una cadena más larga":""}.`;
      }
      if(derivation.principalGroup==="ester" && component.parentId===suffix?.id)
        return language==="en" ? `${label} is the alcohol-derived group attached to the ester oxygen.`
          : `${label} es el grupo derivado del alcohol unido al oxígeno del éster.`;
      const nestedParent = component.parentId ? byId.get(component.parentId) : undefined;
      if (nestedParent && nestedParent.id !== parent?.id && typeof component.locant === "number") {
        const parentLabel = componentLabel(nestedParent, language, derivation);
        return language === "en"
          ? `${label} is a nested ${component.role === "prefix" ? "prefix" : "substituent"} within «${parentLabel}» at internal position ${component.locant}; this locant belongs to the nested numbering scope.`
          : `${label} es un ${component.role === "prefix" ? "prefijo" : "sustituyente"} anidado en «${parentLabel}» en la posición interna ${component.locant}; este localizador pertenece a su propio sistema de numeración.`;
      }
      if (component.locant === "N" && component.role === "substituent")
        return language === "en" ? `${label} attaches through the ${derivation.principalGroup === "amide" ? "amide" : derivation.principalGroup === "amine" ? "amine" : "principal group"} nitrogen and is introduced by N-.`
          : `${label} se une mediante el nitrógeno ${derivation.principalGroup === "amide" ? "de la amida" : derivation.principalGroup === "amine" ? "de la amina" : "del grupo principal"} y se introduce con N-.`;
      const locants=positions.join(", ");
      if(positions.length>1 && attachmentCount===positions.length)return language==="en" ? `${label} represents ${positions.length} groups at parent positions ${locants}; the multiplier counts separate attachments.`
        : `${label} representa ${positions.length} grupos en las posiciones ${locants} del progenitor; el multiplicador cuenta uniones separadas.`;
      return language==="en" ? `${label} is cited as a connected substituent at ${positions.length?`parent position ${locants}`:"the verified parent"}.`
        : `${label} se cita como sustituyente conectado en ${positions.length?`la posición ${locants} del progenitor`:"el progenitor verificado"}.`;
    });
    const paragraphs:{explanation:string;components:NameComponent[]}[]=[];
    descriptions.forEach((description,index)=>{const last=paragraphs.length-1;
      if(last>=0 && paragraphs[last].explanation.length+description.length+1<240){paragraphs[last].explanation+=` ${description}`;paragraphs[last].components.push(substituents[index]);}
      else paragraphs.push({explanation:description,components:[substituents[index]]});});
    paragraphs.forEach((paragraph,index)=>stages.push({
      title:index===0 ? (language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores")
        : (language === "en" ? "Further substituent details" : "Detalle de los sustituyentes"),
      explanation:paragraph.explanation, components:index===0 && !["acyclic-aryl-amine","substituted-alkanamide"].includes(derivation.evidence?.construction??"")?substituents:paragraph.components }));
  }
  const construction=derivation.evidence?.construction;
  const hierarchical=construction==="acyclic-aryl-amine" || construction==="substituted-alkanamide" || construction==="aminoalkyl-benzenediol";
  const compoundRoots=roots.filter(root=>descendants.some(child=>child.parentId===root.id));
  if (hierarchical && compoundRoots.length) {
    const explanation=compoundRoots.map(root => {
      const brackets=root.text.includes("["), parentheses=root.text.includes("(");
      if (brackets) return language==="en" ? `In ${root.text}, parentheses enclose the inner substituent and brackets enclose the substituted aromatic group. The leading locant belongs to the parent.`
        : `En ${root.text}, los paréntesis delimitan el sustituyente interno y los corchetes el grupo aromático sustituido. El primer localizador pertenece al padre.`;
      if (parentheses) return language==="en" ? `In ${root.text}, the parentheses keep the complete substituent together at its indicated attachment.`
        : `En ${root.text}, los paréntesis mantienen unido el sustituyente completo en el punto de unión indicado.`;
      return root.text;
    }).join(" ");
    stages.push({title:language==="en"?"Composition of substituents":"Composición de sustituyentes", explanation, components:compoundRoots});
  }
  // Compare siblings attached to the same parent/ring. A nested group is not
  // another independent substituent unless another sibling requires ordering.
  const alphabeticalPeers = [...roots, ...descendants].filter(component =>
    component.role === "substituent" || component.role === "prefix");
  const peerCounts = new Map<string, number>();
  for (const component of alphabeticalPeers) {
    const parentId = component.parentId ?? "parent";
    peerCounts.set(parentId, (peerCounts.get(parentId) ?? 0) + 1);
  }
  // Directly parsed names supply their own citation terms. Borrowing this
  // narrative from a generator analysis can leave historical synonyms (e.g.
  // methylvinyl) in an active methylethenyl proof after localization.
  const directPeers=alphabeticalPeers.filter(component=>component.parentId==="parent"
    && (derivation.evidence || component.language===language)).sort((a,b)=>a.start-b.start);
  const legacyAlphabeticalOrder=directPeers.length>1?describeAlphabeticalOrder(directPeers.map(component=>{
    const term=derivation.evidence?component.text:component.text.replace(/^[\d,]+-/,"");
    const multiplied=/^(di|tri)(.+)$/.exec(term);
    const name=multiplied?multiplied[2]:term;
    return {sourceName:term,name,comparisonName:name.replace(/[\d,()-]/g,""),
      locants:component.numbering.flatMap(([,n])=>typeof n==="number"?[n]:[]),
      citedPrefix:term,multiplier:multiplied?.[1]??"",complex:/^\d/.test(name)};
  }),language):undefined;
  const orderedPeers=directPeers.map(component=>({component,...peerNameForOrder(component,derivation)}))
    .sort((a,b)=>a.comparisonName.localeCompare(b.comparisonName,language)
      || compareLocantEvidence(a.component.internalNumbering?.map(([,locant])=>locant)??[],
        b.component.internalNumbering?.map(([,locant])=>locant)??[]));
  const alphabeticalOrder=orderedPeers.length>1?describeAlphabeticalOrder(orderedPeers.map(({component,cited,name,multiplier,comparisonName})=>({
    sourceName:cited,name,comparisonName,
    locants:component.numbering.flatMap(([,n])=>typeof n==="number"?[n]:[]),
    internalLocants:component.internalNumbering?.map(([,locant])=>locant)??[],
    citedPrefix:cited,multiplier,complex:/[()[\]{}-]/.test(name),
  })),language):input.alphabeticalOrder??legacyAlphabeticalOrder;
  if (alphabeticalOrder && [...peerCounts.values()].some(count => count > 1))
    stages.push({ title: language === "en" ? "Alphabetical order" : "Orden alfabético",
      explanation: alphabeticalOrder.paragraphs.join(" "), components: substituents, alphabeticalOrder });
  if (stereoComponents.length) stages.push({ title: language === "en" ? "Stereochemistry" : "Estereoquímica",
    explanation: language === "en" ? "Only configurations included in the FULL structural proof are stated."
      : "Solo se expresan configuraciones incluidas en la prueba estructural FULL.", components: stereoComponents });
  const literalActiveName = (derivation.evidence?.language ?? parent?.language) === language
    && (input.activeName === undefined || input.activeName === derivation.name);
  const esterAlcohol=derivation.principalGroup==="ester" ? substituents.find(c=>c.parentId===suffix?.id) : undefined;
  const esterOrder=esterAlcohol && parent && derivation.name.slice(esterAlcohol.start,esterAlcohol.end)===esterAlcohol.text
    ? language==="es" && esterAlcohol.start>parent.start && derivation.name.slice(parent.end,esterAlcohol.start).includes(" de ")
      ? " La parte del ácido precede a «de» y al grupo derivado del alcohol."
      : language==="en" && esterAlcohol.start<parent.start
        ? " The alcohol-derived group is cited before the acid-derived parent."
        : "" : "";
  if (parent && literalActiveName) stages.push({title:language==="en"?"Constructing the name":"Construcción del nombre",
    explanation:language==="en" ? `Combine the verified locants and prefixes with the parent${suffix?" and its characteristic suffix":"; no principal suffix is used"} to obtain ${derivation.name}.`
      +esterOrder : `Se combinan los localizadores y prefijos verificados con el progenitor${suffix?" y su sufijo característico":"; no se utiliza sufijo principal"} para obtener ${derivation.name}.`+esterOrder,
    components:[]});
  const steps = stages.map((stage, index) => makeStep({ ...stage, number: String(index + 1).padStart(2, "0"), derivation, language, graph }));
  if (hierarchical && input.structuralEvidence) {
    const composition=steps.find(step=>step.title===(language==="en"?"Composition of substituents":"Composición de sustituyentes"))
      ?? steps.find(step=>step.title===(language==="en"?"Substituents and locants":"Sustituyentes y localizadores"));
    if(composition) retainStructuralControls(composition,steps,input.structuralEvidence,language,graph);
  }
  const finalStep=steps.find(step=>step.title===(language==="en"?"Constructing the name":"Construcción del nombre"));
  if(finalStep){const target=unionTarget(finalStep.number,Object.values(safeValidatedTargets(graph,derivation)));
    if(target)finalStep.target={...target,locants:[]};}
  const acyloxy = byId.get("acyloxy");
  if (parent && suffix && acyloxy) addAcyloxyReasoning(steps, derivation, graph, language, parent, suffix, acyloxy);
  const amideFragments = buildNSubstitutedAmideFragments(steps, derivation, graph, language);
  const acidFragments = buildSubstitutedArylAcidFragments(steps, derivation, graph, language);
  const resultSteps = amideFragments ?? acidFragments ?? steps;
  const parentEvidence = parent && reconciledParentSelectionEvidence({ molecule: graph, parentAtomIds: parent.atomIds,
    derivationName: derivation.name, activeName: input.activeName, language });
  const parentStep = parent ? resultSteps.find(step => step.componentIds.includes(parent.id)) : undefined;
  if (parentStep && parentEvidence) parentStep.parentSelectionEvidence = parentEvidence;
  return { name: derivation.name, steps: resultSteps };
}

/** Retain additional chemical views available before reconciliation. Never
 * attach a name locant or an individual identity to a swappable occurrence. */
function retainStructuralControls(step:PriorityReasoningStep, allSteps:PriorityReasoningStep[], evidence:StructuralDerivation,
  language:AppLanguage, graph:GeneratedMolecule) {
  const signature=(atoms:readonly number[],bonds:readonly (readonly [number,number])[])=>JSON.stringify([
    [...atoms].sort((a,b)=>a-b),bonds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":")).sort()]);
  const seen=new Set(allSteps.flatMap(s=>Object.values(s.fragmentTargets).map(t=>signature(t.atomIds,t.bondIds))));
  const structural=buildStructuralPriorityReasoning({derivation:evidence,language});
  const symmetry=analyzeStructuralEquivalence(graph,graph);
  if(!symmetry)return;
  const retained:ReasoningNameFragment[]=[];
  for(const region of structural.steps) {
    if(!region.fragments || region.componentKind==="candidate carbon skeleton")continue;
    for(const fragment of [region.fragments,...region.fragments.additionalFragments??[]]) {
      const original=region.fragmentTargets[reasoningFragmentId(region.number,fragment)];
      if(!original)continue;
      const key=signature(original.atomIds,original.bondIds);
      if(seen.has(key) || symmetry.mappings.some(map=>signature(original.atomIds.map(id=>map.get(id)!),
        original.bondIds.map(([a,b])=>[map.get(a)!,map.get(b)!]))!==key))continue;
      seen.add(key);
      const part={...fragment,additionalFragments:undefined};
      const id=reasoningFragmentId(step.number,part);
      step.fragmentTargets[id]={...original,fragmentId:id,stepNumber:step.number,locants:[]};
      retained.push(part);
    }
  }
  if(step.fragments && retained.length)step.fragments={...step.fragments,
    additionalFragments:[...step.fragments.additionalFragments??[],...retained]};
}

function addAcyloxyReasoning(steps: PriorityReasoningStep[], derivation: ValidatedNameDerivation,
  graph: GeneratedMolecule, language: AppLanguage, parent: NameComponent, suffix: NameComponent, acyloxy: NameComponent) {
  const regions = resolveAcyloxyRegions(derivation, graph, parent, suffix, acyloxy);
  if (!regions) return;
  const en = language === "en";
  const functionStep = steps.find(step => step.componentIds.includes(suffix.id));
  const parentStep = steps.find(step => step.componentIds.includes(parent.id));
  const numberingStep = steps.find(step => step.title === (en ? "Numbering" : "Numeración"));
  const substituentStep = steps.find(step => step.componentIds.includes(acyloxy.id));
  if (!functionStep || !parentStep || !numberingStep || !substituentStep) return;

  type Region = Pick<ReasoningVisualTarget, "atomIds" | "bondIds">;
  type RegionControl = ReasoningNameFragment & Region;
  const control = (semanticId: string, text: string, kind: ReasoningNameFragment["kind"], region: Region): RegionControl =>
    ({ semanticId, text, kind, label: en ? `Select ${text}` : `Seleccionar ${text}`, ...region });
  const replace = (step: PriorityReasoningStep, componentId: string, ...controls: RegionControl[]) => {
    const current = step.fragments ? [step.fragments, ...(step.fragments.additionalFragments ?? [])] : [];
    const fragments = current.flatMap(fragment => {
      if (fragment.semanticId !== componentId) return [fragment];
      delete step.fragmentTargets[reasoningFragmentId(step.number, fragment)];
      return controls;
    });
    for (const fragment of controls) {
      const fragmentId = reasoningFragmentId(step.number, fragment);
      step.fragmentTargets[fragmentId] = { stepNumber: step.number, fragmentId, atomIds: fragment.atomIds,
        bondIds: fragment.bondIds, locants: [] };
    }
    step.fragments = fragments.length ? { ...fragments[0], additionalFragments: fragments.slice(1) } : undefined;
  };

  functionStep.explanation = en ? "The carboxylic acid (–COOH) is the principal function and gives the parent its name, benzoic acid."
    : "El ácido carboxílico (–COOH) es la función principal y da nombre a la estructura principal, el ácido benzoico.";
  replace(functionStep, suffix.id, control(suffix.id, en ? "Carboxyl group" : "Grupo carboxilo", "function", regions.carboxyl));
  parentStep.explanation = en ? "Benzoic acid includes the aromatic ring and the carboxyl group."
    : "El ácido benzoico comprende el anillo aromático y el grupo carboxilo.";
  replace(parentStep, parent.id, control(parent.id, en ? "Benzoic acid" : "Ácido benzoico", "parent", regions.parent),
    control("name:aromatic-ring", en ? "Aromatic ring" : "Anillo aromático", "parent", regions.ring));
  numberingStep.explanation = en
    ? `Ring C1 bears the carboxyl group and C${regions.locant} bears the substituent. The external carboxyl carbon is outside the C1–C6 numbering.`
    : `El C1 del anillo lleva el carboxilo y el C${regions.locant} lleva el sustituyente. El carbono carboxílico externo queda fuera de la numeración C1–C6.`;
  replace(numberingStep, parent.id);

  const term = en ? acyloxy.text : acyloxy.labelEs ?? "aciloxi";
  const acylTerm = en ? (regions.methyl ? "Acetyl" : "Acyl") : (regions.methyl ? "acetilo" : "acilo");
  substituentStep.explanation = en
    ? `The complete ${term} group is attached at ring C${regions.locant}. It contains an ester, while the carboxylic acid remains the principal function. The smaller selections show parts of the substituent.`
    : `El grupo ${term} completo se une al C${regions.locant} del anillo. Contiene un éster y el ácido carboxílico conserva la prioridad. Las selecciones menores muestran partes del sustituyente.`;
  const subregions = [
    control(acyloxy.id, en ? `${term} group` : `Grupo ${term}`, "substituent", regions.acyloxy),
    control("name:linking-oxygen", en ? "Linking oxygen" : "Oxígeno de unión", "substituent", regions.linker),
    control("name:acyl", en ? `${acylTerm} fragment` : `Fragmento ${acylTerm}`,
      "substituent", regions.acyl),
    control("name:acyl-carbonyl", en ? `${acylTerm} carbonyl` : `Carbonilo del ${acylTerm}`,
      "substituent", regions.carbonyl),
  ];
  if (regions.methyl) subregions.push(control("name:acetyl-methyl", en ? "Acetyl methyl" : "Metilo del acetilo",
    "substituent", regions.methyl));
  replace(substituentStep, acyloxy.id, ...subregions);

  // Each of these steps already has a control for its complete region.
  for (const step of [functionStep, parentStep, substituentStep]) {
    if (step.componentIds.length === 1) step.target = undefined;
  }
}

function buildSubstitutedArylAcidFragments(steps: PriorityReasoningStep[], derivation: ValidatedNameDerivation,
  graph: GeneratedMolecule, language: AppLanguage) {
  const byId = new Map(derivation.components.map(component => [component.id, component]));
  const parent = byId.get("parent"), suffix = byId.get("suffix"), aryl = byId.get("aryl"), alkyl = byId.get("aryl-prefix");
  if (derivation.principalGroup !== "carboxylicAcid" || !parent || !suffix || !aryl || !alkyl
    || !/anoic acid$/.test(parent.text) || aryl.locant !== 2 || alkyl.parentId !== "aryl") return;
  const atomById = new Map(graph.atoms.map(atom => [atom.id, atom]));
  const parentStep = steps.find(step => step.title === (language === "en" ? "Parent structure" : "Estructura principal"));
  const numberingStep = steps.find(step => step.title === (language === "en" ? "Numbering" : "Numeración"));
  const substituentStep = steps.find(step => step.title === (language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores"));
  if (!parentStep || !numberingStep || !substituentStep) return;
  // This specialized acid/aryl presentation uses position controls below;
  // remove the generic whole-component controls and duplicate locants first.
  numberingStep.fragments = undefined;
  numberingStep.fragmentTargets = {};
  numberingStep.target = undefined;
  const bondKey = (a:number,b:number) => `${Math.min(a,b)}:${Math.max(a,b)}`;
  const validBond = (a:number,b:number) => graph.bonds.some(([x,y]) => bondKey(a,b) === bondKey(x,y));
  const merge = (...regions: {atomIds: readonly number[]; bondIds: readonly (readonly [number,number])[]}[]) => ({
    atomIds: [...new Set(regions.flatMap(region => region.atomIds))],
    bondIds: [...new Map(regions.flatMap(region => region.bondIds).filter(([a,b]) => validBond(a,b))
      .map(([a,b]) => [bondKey(a,b), [a,b] as [number,number]])).values()],
  });
  const add = (step:PriorityReasoningStep, semanticId:string, text:string, kind:ReasoningNameFragment["kind"], target:ReturnType<typeof merge>, locants:readonly (readonly [number,number|string])[] = []) => {
    const fragment:ReasoningNameFragment = { semanticId, text, kind, label:language === "en" ? `Select ${text}` : `Seleccionar ${text}`,
      atomIds:target.atomIds,bondIds:target.bondIds };
    const id=reasoningFragmentId(step.number,fragment);
    step.fragments=step.fragments?{...step.fragments,additionalFragments:[...(step.fragments.additionalFragments??[]),fragment]}:fragment;
    step.fragmentTargets[id]={stepNumber:step.number,fragmentId:id,atomIds:target.atomIds,bondIds:target.bondIds,locants};
  };
  const acid = merge(parent,suffix);
  if (acid.atomIds.length!==5 || acid.atomIds.some(id=>!atomById.has(id)) || acid.bondIds.length!==4) return steps;
  parentStep.explanation = language === "en" ? "Propane identifies the three-carbon parent chain; the carboxyl group supplies the principal acid suffix."
    : "Propan- identifica la cadena principal de tres carbonos; el grupo carboxilo aporta el sufijo del ácido.";
  parentStep.fragments=undefined; parentStep.fragmentTargets={};
  add(parentStep,"name:parent-acid",language === "en" ? "propanoic acid" : "ácido propanoico","parent",acid);
  add(parentStep,"parent",language === "en" ? "propanoic acid chain" : "cadena del ácido propanoico","parent",parent);
  const parentC2=parent.numbering.find(([,locant])=>locant===2)?.[0], ringC1=aryl.numbering.find(([,locant])=>locant===1)?.[0];
  const parentBond=parentC2===undefined?undefined:aryl.bondIds.find(([a,b])=>a===parentC2&&aryl.atomIds.includes(b)||b===parentC2&&aryl.atomIds.includes(a));
  if (parentC2===undefined || ringC1===undefined || !parentBond || !validBond(...parentBond)) return steps;
  const addLocant = (semanticId:string, text:string, label:string, atomId:number, locant:number|string,
    relatedAtomIds:readonly number[] = [], bondIds:readonly (readonly [number,number])[] = []) => {
    const atomIds=[atomId,...relatedAtomIds];
    const fragment:ReasoningNameFragment = {semanticId,text,kind:"numbering",label,atomIds};
    const id=reasoningFragmentId(numberingStep.number,fragment);
    numberingStep.fragments=numberingStep.fragments
      ? {...numberingStep.fragments,additionalFragments:[...(numberingStep.fragments.additionalFragments??[]),fragment]}
      : fragment;
    numberingStep.fragmentTargets[id]={stepNumber:numberingStep.number,fragmentId:id,atomIds,bondIds,locants:[[atomId,locant]]};
  };
  const parentLocants=parent.numbering.filter(([,locant])=>[1,2,3].includes(Number(locant)));
  for(const [atomId,locant] of parentLocants) addLocant(`name:parent-locant-${locant}`,String(locant),
    language === "en" ? `Propanoic acid chain C${locant}` : `Cadena del ácido propanoico C${locant}`,atomId,locant,
    locant===2?[ringC1]:[],locant===2?[parentBond]:[]);
  const ringIds=aryl.atomIds.filter(id=>(atomById.get(id)?.element??"C")==="C" && !alkyl.atomIds.includes(id));
  const ringEdges=graph.bonds.filter(([a,b])=>ringIds.includes(a)&&ringIds.includes(b)).map(([a,b])=>[a,b] as [number,number]);
  if (ringIds.length!==6 || ringEdges.length!==6) return steps;
  const alkylAttachment=alkyl.bondIds.find(([a,b])=>alkyl.atomIds.includes(a)!==alkyl.atomIds.includes(b));
  const arylC4=aryl.numbering.find(([,locant])=>locant===4)?.[0];
  if (!alkylAttachment || !validBond(...alkylAttachment) || arylC4===undefined) return steps;
  const ringSubstituentBond=alkylAttachment.find(id=>ringIds.includes(id));
  if (ringSubstituentBond===undefined || ringSubstituentBond!==arylC4) return steps;
  const internalBonds=alkyl.bondIds.filter(([a,b])=>alkyl.atomIds.includes(a)&&alkyl.atomIds.includes(b));
  if (internalBonds.length!==alkyl.atomIds.length-1 || alkyl.atomIds.some(id=>(atomById.get(id)?.element??"C")!=="C")) return steps;
  add(substituentStep,"name:phenyl","fenilo","substituent",{atomIds:ringIds,bondIds:ringEdges});
  if(ringC1===undefined)return steps;
  addLocant("name:phenyl-locant-1","1",language === "en" ? "Phenyl ring C1" : "Anillo fenilo C1",ringC1,1);
  addLocant("name:phenyl-locant-4","4",language === "en" ? "Phenyl ring C4" : "Anillo fenilo C4",arylC4,4,[],[alkylAttachment]);
  const rooted=alkyl.atomIds.find(id=>validBond(id,ringSubstituentBond));
  const adjacency=new Map(alkyl.atomIds.map(id=>[id,[] as number[]]));
  for(const [a,b] of internalBonds){adjacency.get(a)?.push(b);adjacency.get(b)?.push(a);}
  const paths:number[][]=[];
  const walk=(id:number,previous:number,path:number[])=>{const next=(adjacency.get(id)??[]).filter(other=>other!==previous);if(!next.length)paths.push(path);else for(const other of next)walk(other,id,[...path,other]);};
  if (rooted===undefined) return steps;
  walk(rooted,-1,[rooted]);
  const longest=Math.max(...paths.map(path=>path.length));
  const backbones=paths.filter(path=>path.length===longest);
  const orientations=backbones.flatMap(path=>[path,[...path].reverse()]).filter(path=>path[0]===rooted);
  const numberingCandidates=orientations.map(path=>{const map=new Map(path.map((id,index)=>[id,index+1]));for(const id of alkyl.atomIds)if(!map.has(id)){const attached=(adjacency.get(id)??[]).find(neighbor=>map.has(neighbor));if(attached)map.set(id,map.get(attached)!);}return map;});
  const canonical=numberingCandidates[0];
  const locants=canonical?[...canonical].map(([id,locant])=>[id,locant] as [number,number]):[];
  const internalC2=locants.find(([,locant])=>locant===2)?.[0];
  const displayedAlkylLocants=new Set<number>();
  for(const [atomId,locant] of locants) if((locant===1||locant===2||locant===3)&&!displayedAlkylLocants.has(locant)) {
    displayedAlkylLocants.add(locant);
    addLocant(`name:alkyl-locant-${locant}`,String(locant),
      language === "en" ? `2-methylpropyl substituent C${locant}` : `Sustituyente 2-metilpropilo C${locant}`,atomId,locant);
  }
  const alkylLabel=language === "en" ? "2-methylpropyl" : "2-metilpropilo";
  const explanation=language === "en" ? `The rooted substituent is –CH₂–CH(CH₃)₂; its internal C2 numbering starts at the ring attachment and is independent of parent C2.`
    : `El sustituyente tiene estructura –CH₂–CH(CH₃)₂; su numeración interna comienza en el punto de unión al anillo y es independiente del C2 del padre.`;
  add(substituentStep,"name:2-methylpropyl",alkylLabel,"substituent",{atomIds:alkyl.atomIds,bondIds:[...internalBonds,alkylAttachment]},internalC2?[[internalC2,2]]:[]);
  substituentStep.explanation=explanation;
  numberingStep.explanation=language === "en" ? "Parent C2, phenyl C1/C4, and substituent C2 belong to independent numbering systems."
    : "El C2 del padre, los C1/C4 del fenilo y el C2 del sustituyente pertenecen a sistemas de numeración independientes.";
  return steps;
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
  addControl(substituentStep, "name:phenyl", language === "en" ? "phenyl" : "fenilo", "substituent", { atomIds: ringIds, bondIds: ringEdges });
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
  addControl(substituentStep, "name:4-hydroxyphenyl", language === "en" ? "4-hydroxyphenyl" : "4-hidroxifenilo", "substituent",
    merge({ atomIds: ringIds, bondIds: ringEdges }, visual.aryl, { atomIds: [nitrogen], bondIds: [nBond] }));
  return steps;
}

function structuralLabel(component: StructuralComponent, language: AppLanguage) {
  if (language === "es") return component.kindEs ?? component.kind;
  return component.kind;
}

function structuralFragmentLabel(component: StructuralComponent, language: AppLanguage) {
  return language === "en" ? component.displayLabel ?? structuralLabel(component, language)
    : component.displayLabelEs ?? structuralLabel(component, language);
}

/** Structural-only evidence is deliberately presented as candidates and
 * connected regions; this adapter never turns it into name locants or parents. */
export function buildStructuralPriorityReasoning(input: { derivation: StructuralDerivation; language: AppLanguage;
  parentSelection?: ParentSelectionEvidence; graph?:GeneratedMolecule }): PriorityReasoningModel {
  const { derivation, language } = input;
  const ranks: Record<StructuralComponent["kind"], number> = {
    carboxylicAcid: 0, ester: 0, amide: 0, carbonyl: 0, hydroxyl: 0,
    "candidate carbon skeleton": 1, "carbohydrate backbone": 1,
    ringSystem: 2, "connected fragment": 3,
    "phenoxy fragment": 3, "methoxy fragment": 3, "substituted phenoxy fragment": 4,
    "fragment connection": 3, "amine fragment": 1, "trifluoromethyl group": 1, "ether linkage": 1, "benzyl fragment": 3,
    "N-bound methyl": 4, "ring oxygen": 4, hemiacetal: 4, hemiketal: 4,
    "aromatic substituent fragment": 3, "aromatic ring locant": 4,
    "configurational reference": 5, "anomeric centre": 5, stereo: 5,
  };
  const kinds = [...new Set(derivation.components.map(component => component.kind))]
    .sort((a, b) => ranks[a] - ranks[b] || a.localeCompare(b));
  const steps = kinds.map((kind, index): PriorityReasoningStep => {
    const number = String(index + 1).padStart(2, "0"), group = derivation.components.filter(component => component.kind === kind);
    const labelFor = (component: StructuralComponent) => {
      const base = structuralFragmentLabel(component, language);
      const peers = group.filter(item => structuralFragmentLabel(item, language) === base);
      if (peers.length < 2) return base;
      const sameSize = peers.filter(item => item.atomIds.length === component.atomIds.length);
      const size = language === "en" ? `${component.atomIds.length} atoms` : `${component.atomIds.length} átomos`;
      const occurrence = sameSize.length > 1 ? ` · ${sameSize.indexOf(component) + 1}` : "";
      return `${base} · ${size}${occurrence}`;
    };
    const fragments = group.flatMap(component => {
      const label = labelFor(component);
      const whole = { text: label, label: language === "en" ? `Select ${label}` : `Seleccionar ${label}`,
        kind: "substituent" as const, semanticId: component.id, atomIds: component.atomIds, bondIds: component.bondIds };
      const nested = (component.nestedSelections ?? []).map(selection => {
        const text = language === "en" ? selection.label : selection.labelEs;
        return { text, label: language === "en" ? `Select ${text}` : `Seleccionar ${text}`,
          kind: "substituent" as const, semanticId: `${component.id}:${selection.id}`,
          atomIds: selection.atomIds, bondIds: selection.bondIds };
      });
      return [whole, ...nested];
    });
    const fragmentTargets: Record<string, ReasoningVisualTarget> = {};
    group.forEach(component => {
      const fragmentsForComponent = [
        { semanticId: component.id, atomIds: component.atomIds, bondIds: component.bondIds, locants: component.numbering ?? [] },
        ...(component.nestedSelections ?? []).map(selection => ({ semanticId: `${component.id}:${selection.id}`,
          atomIds: selection.atomIds, bondIds: selection.bondIds, locants: selection.locants })),
      ];
      for (const target of fragmentsForComponent) {
        const fragment = fragments.find(item => item.semanticId === target.semanticId);
        if (!fragment) continue;
        const fragmentId = reasoningFragmentId(number, fragment);
        fragmentTargets[fragmentId] = { stepNumber: number, fragmentId, atomIds: target.atomIds,
          bondIds: target.bondIds, locants: target.locants };
      }
    });
    const componentText = (component: StructuralComponent) => {
      if (component.nomenclature) return language === "en"
        ? component.nomenclature.explanation : component.nomenclature.explanationEs;
      const evidence = language === "en" ? component.evidence : component.evidenceEs ?? component.evidence;
      const container = component.parentComponentId
        ? derivation.components.find(candidate => candidate.id === component.parentComponentId) : undefined;
      if (!container) return evidence;
      const childName = structuralFragmentLabel(component, language), parentName = structuralFragmentLabel(container, language);
      return evidence + (language === "en"
        ? ` This ${childName} is a contained part of ${parentName}; this describes graph composition, not a verified name or locant.`
        : ` Este elemento, ${childName}, forma parte de ${parentName}; esto describe la composición del grafo, no un nombre o localizador verificado.`);
    };
    const explanation = group.length === 1 ? componentText(group[0]) : ["ringSystem", "connected fragment", "fragment connection"].includes(kind)
      ? `${language === "en" ? "Each control below describes an independently identified graph region; these labels do not establish name locants. " : "Cada control describe una región del grafo identificada por separado; estas etiquetas no establecen localizadores del nombre. "}${group.map(component => `${labelFor(component)}: ${componentText(component)}`).join(" ")}`
      : language === "en"
        ? `${group.length} graph regions of this kind are independently identified; no parent locants are inferred.`
        : `Se identifican ${group.length} regiones de este tipo en el grafo; no se infieren localizadores parentales.`;
    const targets = group.map(component => ({ stepNumber: number, atomIds: component.atomIds,
      bondIds: component.bondIds, locants: component.numbering ?? [] }));
    return { number, title: structuralLabel(group[0], language), explanation, target: unionTarget(number, targets),
      fragments: { ...fragments[0], additionalFragments: fragments.slice(1) }, fragmentTargets,
      componentIds: group.map(component => component.id), componentKind: kind, source: "structural" };
  });
  if (input.parentSelection) {
    const evidence = input.parentSelection;
    const sameRegion = (left: readonly number[], right: readonly number[]) => left.length === right.length
      && left.every(id => right.includes(id));
    const matchingStep = steps.find(step => derivation.components.some(component => step.componentIds.includes(component.id)
      && evidence.candidates.some(item => sameRegion(item.atomIds, component.atomIds))));
    if (matchingStep) matchingStep.parentSelectionEvidence = evidence;
    else {
      const number = String(steps.length + 1).padStart(2, "0");
      const targets = evidence.candidates.map(item => ({ stepNumber: number, fragmentId: item.id,
        atomIds: item.atomIds, bondIds: item.bondIds, locants: [] }));
      const fragments = evidence.candidates.map(item => ({ text: item.label,
        label: language === "en" ? `Select ${item.label}` : `Seleccionar ${item.label}`,
        kind: "parent" as const, semanticId: item.id, atomIds: item.atomIds, bondIds: item.bondIds }));
      const fragmentTargets = Object.fromEntries(evidence.candidates.map((item, index) => [
        reasoningFragmentId(number, fragments[index]), targets[index],
      ]));
      steps.push({ number, title: language === "en" ? "Parent candidates" : "Candidatos a padre",
        explanation: evidence.explanation, target: unionTarget(number, targets),
        fragments: fragments[0] ? { ...fragments[0], additionalFragments: fragments.slice(1) } : undefined,
        fragmentTargets, componentIds: evidence.candidates.map(item => item.id),
        parentSelectionEvidence: evidence, source: "structural" });
    }
  }
  const composition = input.graph ? buildAmineArylComposition(derivation, input.parentSelection, language,
    input.graph, String(steps.length+1).padStart(2,"0")) : undefined;
  if (composition) steps.push(composition);
  return { name: derivation.name.text, steps };
}

function buildAmineArylComposition(derivation:StructuralDerivation, selection:ParentSelectionEvidence|undefined,
  language:AppLanguage,graph:GeneratedMolecule,number:string):PriorityReasoningStep|undefined {
  if(selection?.level!=="rule-supported"||selection.reconciliation!=="unverified"
    ||selection.amineParentSelection?.outcome!=="acyclic-parent"||selection.amineParentSelection.rule!=="P-44.3.2")return;
  const selected=selection.candidates.find(candidate=>candidate.status==="selected-by-rule"
    &&candidate.evidenceKind==="parent"&&candidate.regionKind==="acyclic-chain"
    &&candidate.nomenclaturalAdmissibility==="candidate-unverified"&&candidate.ruleReference==="P-44.3.2");
  if(!selected)return;
  const sameRegion=(left:readonly number[],right:readonly number[])=>left.length===right.length&&left.every(id=>right.includes(id));
  const chain=derivation.components.find(component=>component.kind==="candidate carbon skeleton"&&sameRegion(component.atomIds,selected.atomIds));
  const methyl=derivation.components.find(component=>component.kind==="N-bound methyl"
    &&component.atomIds.includes(selection.amineParentSelection!.nitrogenAtomId));
  if(!chain||!methyl||!methyl.atomIds.includes(selection.amineParentSelection.nitrogenAtomId))return;
  const graphAtoms=new Set(chain.atomIds), nitrogen=selection.amineParentSelection.nitrogenAtomId;
  const pathBonds=chain.bondIds.filter(([a,b])=>graphAtoms.has(a)&&graphAtoms.has(b));
  if(pathBonds.length!==chain.atomIds.length-1||chain.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element!=="C"))return;
  const neighbors=(id:number)=>pathBonds.flatMap(([a,b])=>a===id?[b]:b===id?[a]:[]);
  const nLinks=graph.bonds.filter(([a,b,order=1])=>order===1&&(
    a===nitrogen&&graphAtoms.has(b)||b===nitrogen&&graphAtoms.has(a)))
    .map(([a,b])=>a===nitrogen?b:a);
  if(nLinks.length!==1)return;
  const chainOrder=[nLinks[0]],visited=new Set(chainOrder);let previous=nitrogen,current=nLinks[0];
  while(chainOrder.length<chain.atomIds.length){
    const next=neighbors(current).filter(id=>id!==previous&&!visited.has(id));
    if(next.length!==1)return;
    previous=current;current=next[0];visited.add(current);chainOrder.push(current);
  }
  if(neighbors(chainOrder.at(-1)!).length!==1||visited.size!==chain.atomIds.length)return;
  const locals=derivation.components.filter(component=>component.nomenclature
    &&["phenyl","phenoxy"].includes(component.nomenclature.connection)
    &&component.nomenclature.parentRule==="P-44.3.2"&&component.nomenclature.parentAttachmentLocant!==undefined);
  const attachmentFor=(component:StructuralComponent)=>component.nomenclature!.attachmentBondIds
    .flatMap(([a,b])=>[a,b]).find(id=>graphAtoms.has(id));
  const verifiedLocals=locals.filter(component=>{
    const atom=attachmentFor(component),locant=atom===undefined?-1:chainOrder.indexOf(atom)+1;
    return locant===component.nomenclature!.parentAttachmentLocant;
  });
  const phenyl=verifiedLocals.find(component=>component.nomenclature?.connection==="phenyl"&&component.nomenclature.name==="phenyl");
  const phenoxy=verifiedLocals.find(component=>component.nomenclature?.connection==="phenoxy"
    &&component.nomenclature.substituents.some(sub=>sub.name==="trifluoromethyl"));
  if(!phenyl||!phenoxy||phenyl.nomenclature!.parentAttachmentLocant!==phenoxy.nomenclature!.parentAttachmentLocant)return;
  const ringLocant=derivation.components.find(component=>component.kind==="aromatic ring locant"
    &&component.atomIds.some(id=>phenoxy.atomIds.includes(id)));
  if(!ringLocant)return;
  const parentLocant=phenyl.nomenclature!.parentAttachmentLocant!,parentAtom=chainOrder[parentLocant-1];
  if(parentAtom===undefined)return;
  const orderGroups=[
    {name:language==="en"?"methyl":"metil",cited:language==="en"?"N-methyl":"N-metil",locants:[] as number[]},
    {name:language==="en"?"phenyl":"fenil",cited:phenyl.nomenclature![language==="en"?"name":"nameEs"],locants:[parentLocant]},
    {name:language==="en"?"trifluoromethylphenoxy":"trifluorometilfenoxi",
      cited:phenoxy.nomenclature![language==="en"?"name":"nameEs"],locants:[parentLocant]},
  ].sort((a,b)=>a.name.localeCompare(b.name,language));
  const alphabeticalOrder=describeAlphabeticalOrder(orderGroups.map(group=>({sourceName:group.cited,name:group.name,
    comparisonName:group.name.replace(/[^A-Za-z]/g,""),locants:group.locants,citedPrefix:group.cited,multiplier:"",
    complex:group.cited.includes("(")})),language);
  const en=language==="en";
  const chainLabel=en?"Rule-supported propan-1-amine parent candidate":"Candidato parental de propan-1-amina respaldado por reglas";
  const phenylLabel=en?`${parentLocant}-phenyl substituent`:`Sustituyente ${parentLocant}-fenil`;
  const phenoxyName=phenoxy.nomenclature![en?"name":"nameEs"];
  const phenoxyLabel=en?`${parentLocant}-[${phenoxyName}] substituent`:`Sustituyente ${parentLocant}-[${phenoxyName}]`;
  const internalLocant=ringLocant.numbering?.[0]?.[1];
  const explanation=en
    ? `The N-bound three-carbon parent candidate starts at C1 where it attaches to the amine nitrogen (P-44.3.2; locant 1 under P-14.4). The graph places N-methyl on N and both verified aromatic substituents at parent C${parentLocant}. Their cited terms are ordered by their complete names: methyl, phenyl, then ${phenoxyName}; the initial ring locant and punctuation do not replace the internal name when alphabetizing (P-14.5.2). C${parentLocant} marks attachment of each complete substituent to the parent; ring C${internalLocant} is a separate internal locant for trifluoromethyl. The parentheses in ${phenoxyName} enclose its internal trifluoromethyl prefix, and square brackets enclose the complete phenoxy substituent because its name already contains parentheses (P-16.5.2.4). Braces are not needed at this nesting depth (P-16.5.3). This composes graph-supported name parts only; the complete active name and PIN remain unreconciled, so the derivation stays PARTIAL.`
    : `El candidato parental de tres carbonos unido a N comienza en C1, donde se enlaza con el nitrógeno de la amina (P-44.3.2; localizador 1 según P-14.4). El grafo sitúa N-metil sobre N y ambos sustituyentes aromáticos verificados en C${parentLocant} del padre. Sus términos se ordenan por sus nombres completos: fenil, metil y después ${phenoxyName}; el localizador inicial del anillo y los signos de agrupación no sustituyen el nombre interno al alfabetizar (P-14.5.2). C${parentLocant} marca la unión de cada sustituyente completo al padre; C${internalLocant} del anillo es un localizador interno distinto para trifluorometil. Los paréntesis de ${phenoxyName} encierran el prefijo interno trifluorometil, y los corchetes delimitan el sustituyente fenoxi completo porque su nombre ya contiene paréntesis (P-16.5.2.4). No se requieren llaves a esta profundidad (P-16.5.3). Solo se componen partes respaldadas por el grafo; el nombre activo completo y el PIN siguen sin conciliarse, por lo que la derivación permanece PARTIAL.`;
  const fragments=[
    {text:chainLabel,semanticId:"composition:parent",kind:"parent" as const,atomIds:chain.atomIds,bondIds:pathBonds},
    {text:en?"N-methyl":"N-metil",semanticId:"composition:n-methyl",kind:"substituent" as const,atomIds:methyl.atomIds,bondIds:methyl.bondIds},
    {text:phenylLabel,semanticId:"composition:phenyl",kind:"substituent" as const,atomIds:phenyl.atomIds,bondIds:phenyl.bondIds},
    {text:phenoxyLabel,semanticId:"composition:phenoxy",kind:"substituent" as const,atomIds:phenoxy.atomIds,bondIds:phenoxy.bondIds},
    {text:en?`Parent locant C${parentLocant}`:`Localizador parental C${parentLocant}`,semanticId:"composition:parent-locant",
      kind:"numbering" as const,atomIds:[parentAtom],bondIds:[]},
    {text:en?`Ring locant C${internalLocant} · trifluoromethyl`:`Localizador del anillo C${internalLocant} · trifluorometil`,
      semanticId:"composition:ring-locant",kind:"numbering" as const,atomIds:ringLocant.atomIds,bondIds:ringLocant.bondIds},
  ].map(fragment=>({...fragment,label:en?`Select ${fragment.text}`:`Seleccionar ${fragment.text}`}));
  const fragmentTargets=Object.fromEntries(fragments.map(fragment=>{
    const fragmentId=reasoningFragmentId(number,fragment);
    return [fragmentId,{stepNumber:number,fragmentId,atomIds:fragment.atomIds,bondIds:fragment.bondIds,
      locants:fragment.semanticId==="composition:parent-locant"?[[parentAtom,parentLocant] as [number,number]]:[]}];
  }));
  const components=[chain,methyl,phenyl,phenoxy,ringLocant];
  return {number,title:en?"Constructing the name":"Construcción del nombre",explanation,
    target:unionTarget(number,fragments.map(fragment=>fragmentTargets[reasoningFragmentId(number,fragment)])),
    fragments:fragments[0]?{...fragments[0],additionalFragments:fragments.slice(1)}:undefined,fragmentTargets,
    componentIds:components.map(component=>component.id),source:"structural",alphabeticalOrder};
}
