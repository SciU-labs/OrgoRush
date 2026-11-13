import type { AppLanguage } from "./i18n.ts";
import { buildValidatedVisualNumbering } from "./visual-numbering.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { StructuralComponent, StructuralDerivation } from "./structural-derivation.ts";
import type { AlphabeticalOrderPresentation } from "./reasoning-alphabetical-order.ts";
import { describeAlphabeticalOrder } from "./reasoning-alphabetical-order.ts";
import { resolveAcyloxyRegions } from "./reasoning-acyloxy-regions.ts";
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
    : language==="es"?component.explanationEs??component.explanation:component.explanation;
  return { text, label: language === "en" ? `Select ${text}` : `Seleccionar ${text}`,
    kind: component.role === "parent" ? "parent" : component.role === "suffix" ? "function"
      : component.role === "unsaturation" ? "unsaturation"
      : component.role === "substituent" || component.role === "prefix" ? "substituent" : "numbering",
    ...(literal?{start:component.start,language:component.language,numberingScope:component.numberingScope,
      explanation}:{}),
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
    displayedComponents.push({...component,id:component.equivalenceGroup,atomIds:siblings.flatMap(c=>c.atomIds),
      bondIds:siblings.flatMap(c=>c.bondIds),nLocantStarts:siblings.flatMap(c=>c.nLocantStarts??[]),
      explanation:language==="en"?"Two equivalent substituents attach separately to the same amide nitrogen.":"Dos sustituyentes equivalentes se unen por separado al mismo nitrógeno amídico.",
      explanationEs:"Dos sustituyentes equivalentes se unen por separado al mismo nitrógeno amídico."});
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
    stages.push({ title: language === "en" ? "Principal functional group" : "Grupo funcional principal",
      explanation: (language === "en" ? `${groupNames.en[derivation.principalGroup]} is the principal functional group and is expressed by the validated suffix.`
        : `La función principal es ${groupNames.es[derivation.principalGroup]} y se expresa mediante el sufijo validado.`)+detail
        +(ester ? (language==="en" ? " The ester oxygen connects the acid-derived part to the alcohol-derived group." : " El oxígeno del éster conecta la parte derivada del ácido con el grupo derivado del alcohol.") : ""), components: [suffix] });
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
      const literal=(derivation.evidence?.language??component.language)===language
        && derivation.name.slice(component.start,component.end)===component.text;
      const label=literal?`«${component.text}»`:language==="en"?"The selected group":"El grupo seleccionado";
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
      const locants=positions.join(", ");
      if(positions.length>1 && attachmentCount===positions.length)return language==="en" ? `${label} represents ${positions.length} groups at parent positions ${locants}; the multiplier counts separate attachments.`
        : `${label} representa ${positions.length} grupos en las posiciones ${locants} del progenitor; el multiplicador cuenta uniones separadas.`;
      return language==="en" ? `${label} is connected to ${positions.length?`parent position ${locants}`:"the verified parent region"}${attachmentCount?"; its control includes the attachment bond":""}.`
        : `${label} se une ${positions.length?`a la posición ${locants} del progenitor`:"a la región progenitora verificada"}${attachmentCount?"; su control incluye el enlace de unión":""}.`;
    });
    const paragraphs:{explanation:string;components:NameComponent[]}[]=[];
    descriptions.forEach((description,index)=>{const last=paragraphs.length-1;
      if(last>=0 && paragraphs[last].explanation.length+description.length+1<240){paragraphs[last].explanation+=` ${description}`;paragraphs[last].components.push(substituents[index]);}
      else paragraphs.push({explanation:description,components:[substituents[index]]});});
    paragraphs.forEach((paragraph,index)=>stages.push({
      title:index===0 ? (language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores")
        : (language === "en" ? "Further substituent details" : "Detalle de los sustituyentes"),
      explanation:paragraph.explanation, components:index===0?substituents:paragraph.components }));
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
  const alphabeticalOrder=directPeers.length>1?describeAlphabeticalOrder(directPeers.map(component=>{
    const term=derivation.evidence?component.text:component.text.replace(/^[\d,]+-/,"");
    const multiplied=/^(di|tri)(.+)$/.exec(term);
    const name=multiplied?multiplied[2]:term;
    return {sourceName:term,name,comparisonName:name.replace(/[\d,()-]/g,""),
      locants:component.numbering.flatMap(([,n])=>typeof n==="number"?[n]:[]),
      citedPrefix:term,multiplier:multiplied?.[1]??"",complex:/^\d/.test(name)};
  }),language):input.alphabeticalOrder;
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
  const finalStep=steps.find(step=>step.title===(language==="en"?"Constructing the name":"Construcción del nombre"));
  if(finalStep){const target=unionTarget(finalStep.number,Object.values(safeValidatedTargets(graph,derivation)));
    if(target)finalStep.target={...target,locants:[]};}
  const acyloxy = byId.get("acyloxy");
  if (parent && suffix && acyloxy) addAcyloxyReasoning(steps, derivation, graph, language, parent, suffix, acyloxy);
  const amideFragments = buildNSubstitutedAmideFragments(steps, derivation, graph, language);
  const acidFragments = buildSubstitutedArylAcidFragments(steps, derivation, graph, language);
  return { name: derivation.name, steps: amideFragments ?? acidFragments ?? steps };
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
