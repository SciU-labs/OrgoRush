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
import { getPotentialTetrahedralStereoCenterIds, getTetrahedralStereoCenters } from "./tetrahedral-stereochemistry.ts";
import { inspectTetrahedralCipPriorities } from "./double-bond-stereochemistry.ts";

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
  return { cited, name, multiplier, comparisonName:component.citationKey ?? comparisonName };
}

function localizedCitationName(text:string,language:AppLanguage) {
  if(language==="en")return text;
  return text.replace(/tert-butyl/g,"terc-butil").replace(/trifluoromethyl/g,"trifluorometil").replace(/diethyl/g,"dietil")
    .replace(/dimethyl/g,"dimetil").replace(/ethyl/g,"etil").replace(/methyl/g,"metil")
    .replace(/phenoxy/g,"fenoxi").replace(/phenyl/g,"fenilo").replace(/hydroxy/g,"hidroxi")
    .replace(/acetamide/g,"acetamida").replace(/amide/g,"amida").replace(/amine/g,"amina");
}

function compareLocantEvidence(left: readonly number[], right: readonly number[]) {
  for (let index=0;index<Math.max(left.length,right.length);index+=1) {
    const difference=(left[index]??Number.MAX_SAFE_INTEGER)-(right[index]??Number.MAX_SAFE_INTEGER);
    if(difference)return difference;
  }
  return 0;
}

/** A compact chemical label for a CIP ligand, derived only from its mapped
 * graph region. Keep ring branches descriptive when a rooted line formula
 * would hide their topology. */
function describeCipLigand(graph: GeneratedMolecule, centerId: number, priority: {
  atomId:number|null; branchAtomIds:number[]; branchBondIds:[number,number][];
}, language:AppLanguage) {
  const en=language==="en";
  if(priority.atomId===null)return en?"hydrogen":"hidrógeno";
  const atomById=new Map(graph.atoms.map(atom=>[atom.id,atom]));
  const atom=atomById.get(priority.atomId), element=atom?.element??"C";
  const branch=new Set(priority.branchAtomIds), bondIds=priority.branchBondIds;
  if(element==="O"&&bondIds.length===1)return en?"hydroxyl group (–OH)":"grupo hidroxilo (–OH)";
  if(element==="C") {
    const carbonylO=graph.bonds.find(([a,b,order])=>order===2&&((a===priority.atomId&&branch.has(b)
      &&atomById.get(b)?.element==="O")||(b===priority.atomId&&branch.has(a)&&atomById.get(a)?.element==="O")));
    const singleO=graph.bonds.some(([a,b,order])=>order===1&&((a===priority.atomId&&branch.has(b)
      &&atomById.get(b)?.element==="O")||(b===priority.atomId&&branch.has(a)&&atomById.get(a)?.element==="O")));
    if(carbonylO&&singleO)return en?"carboxyl group (–C(=O)OH)":"grupo carboxilo (–C(=O)OH)";
  }
  const ring=(graph.rings??[]).find(candidate=>candidate.kind==="aromatic"&&candidate.atomIds.includes(priority.atomId!)
    &&candidate.atomIds.every(id=>branch.has(id)));
  if(ring){
    const hydroxylCount=ring.atomIds.filter(id=>graph.bonds.some(([a,b,order])=>{
      const other=a===id?b:b===id?a:undefined;
      return other!==undefined&&order===1&&atomById.get(other)?.element==="O"&&!ring.atomIds.includes(other)
        &&(graph.bonds.filter(([x,y])=>x===other||y===other).length===1);
    })).length;
    return en?`aromatic ring${hydroxylCount?` bearing ${hydroxylCount} hydroxyl groups`:""}`
      :`anillo aromático${hydroxylCount?` con ${hydroxylCount} grupos hidroxilo`:""}`;
  }
  if(element==="O"){
    const leadsToRing=bondIds.some(([a,b])=>{const other=a===priority.atomId?b:a;
      return (graph.rings??[]).some(candidate=>candidate.kind==="aromatic"&&candidate.atomIds.includes(other));});
    return leadsToRing?(en?"ether oxygen leading to an aromatic ring":"oxígeno de éter unido a un anillo aromático")
      :(en?"oxygen-linked branch":"rama unida por oxígeno");
  }
  // Format short, unbranched, single-bond ligands such as –CH2–NH–CH3.
  const adjacency=new Map<number,number[]>();
  for(const [a,b,order] of graph.bonds)if(order===1&&(branch.has(a)&&branch.has(b)||a===centerId&&branch.has(b)||b===centerId&&branch.has(a))){
    adjacency.set(a,[...(adjacency.get(a)??[]),b]);adjacency.set(b,[...(adjacency.get(b)??[]),a]);
  }
  const atoms:number[]=[priority.atomId],previous=new Map<number,number>([[priority.atomId,centerId]]);
  let current=priority.atomId,linear=true;
  while(true){
    const next=(adjacency.get(current)??[]).filter(id=>id!==previous.get(current));
    if(next.length>1){linear=false;break;}
    if(!next.length)break;
    const nextId=next[0]!;if(atoms.includes(nextId)){linear=false;break;}
    atoms.push(nextId);previous.set(nextId,current);current=nextId;
  }
  if(linear&&atoms.length<=4&&atoms.length===branch.size){
    const valence:Record<string,number>={C:4,N:3,O:2,S:2};
    const subscript=(n:number)=>n===1?"":String(n).replace(/[0-9]/g,d=>"₀₁₂₃₄₅₆₇₈₉"[Number(d)]!);
    const formula=atoms.map(id=>{
      const item=atomById.get(id),symbol=item?.element??"C",degree=(adjacency.get(id)??[]).length;
      const hydrogens=Math.max(0,(valence[symbol]??0)-degree);
      return `${symbol}${hydrogens?`H${subscript(hydrogens)}`:""}`;
    }).join("–");
    return `–${formula}`;
  }
  if(element==="C"&&branch.size<=12&&[...branch].every(id=>atomById.get(id)?.element==="C"||atomById.get(id)?.element==="O"||atomById.get(id)?.element==="N")) {
    const carbons=[...branch].filter(id=>atomById.get(id)?.element==="C");
    const carbonAdj=new Map(carbons.map(id=>[id,[] as number[]]));
    for(const [a,b,order] of graph.bonds)if((order??1)===1&&carbonAdj.has(a)&&carbonAdj.has(b)){
      carbonAdj.get(a)!.push(b);carbonAdj.get(b)!.push(a);
    }
    const paths:number[][]=[];
    const walk=(id:number,path:number[])=>{
      paths.push(path);
      for(const next of carbonAdj.get(id)??[])if(!path.includes(next))walk(next,[...path,next]);
    };
    walk(priority.atomId, [priority.atomId]);
    const main=paths.sort((a,b)=>b.length-a.length)[0]??[];
    const valence:Record<string,number>={C:4,N:3,O:2};
    const hCount=(id:number)=>{
      const used=graph.bonds.filter(([a,b])=>a===id||b===id).reduce((sum,bond)=>sum+(bond[2]??1),0);
      return Math.max(0,(valence[atomById.get(id)?.element??"C"]??0)-used);
    };
    const subscript=(n:number)=>n===1?"":String(n).replace(/[0-9]/g,d=>"₀₁₂₃₄₅₆₇₈₉"[Number(d)]!);
    const tokens=main.map((id,index)=>{
      const h=hCount(id), branches:string[]=[];let carbonyl=false,hydroxySuffix=false;
      for(const [a,b,order] of graph.bonds){
        const other=a===id?b:b===id?a:undefined;
        if(other===undefined||!branch.has(other)||other===main[index-1]||other===main[index+1])continue;
        const otherElement=atomById.get(other)?.element??"C";
        if(otherElement==="O"){
          if(order===2)carbonyl=true;
          else if(graph.bonds.filter(([x,y])=>x===other||y===other).length===1)hydroxySuffix=true;
          else branches.push("OH");
        }
        else if(otherElement==="N")branches.push("NH");
        else if(otherElement==="C"){
          const sideH=hCount(other);branches.push(`CH${subscript(sideH)}`);
        }
      }
      return `C${h?`H${subscript(h)}`:""}${carbonyl?"(=O)":""}${branches.map(item=>`(${item})`).join("")}${hydroxySuffix?"OH":""}`;
    });
    const links=main.slice(0,-1).map((id,index)=>{
      const next=main[index+1];const bond=graph.bonds.find(([a,b])=>a===id&&b===next||a===next&&b===id);
      return (bond?.[2]??1)===3?"≡":(bond?.[2]??1)===2?"=":"–";
    });
    const formula=tokens.map((token,index)=>index?`${links[index-1]}${token}`:token).join("");
    if(formula.length<90)return `–${formula}`;
  }
  return element==="C"?(en?"carbon branch":"rama carbonada")
    :en?`${element}-containing branch`:`rama con ${element}`;
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
  if (component.label && component.labelEs) return language === "en" ? component.label : component.labelEs;
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
      : `El prefijo seleccionado representa ${positions.length} grupos separados en las posiciones ${positions.join(", ")} de la estructura principal.`
    : localizedComponentExplanation(component, language);
  const label=language==="en"?component.label:component.labelEs;
  return { text, label: label ?? (language === "en" ? `Select ${text}` : `Seleccionar ${text}`),
    kind: component.role === "parent" ? "parent" : component.role === "suffix" ? "function"
      : component.role === "unsaturation" ? "unsaturation"
      : component.role === "substituent" || component.role === "prefix" ? "substituent" : "numbering",
    ...(literal?{start:component.start,language:component.language,numberingScope:component.numberingScope}:{}),
    ...(explanation?{explanation}:{}),
    semanticId: component.id, atomIds: component.atomIds, bondIds: component.bondIds };
}

function safeValidatedTargets(graph:GeneratedMolecule,derivation:ValidatedNameDerivation) {
  const targets=validatedNameTargets(derivation), evidence=derivation.evidence;
  if(derivation.principalGroup==="amide" && targets.parent && targets.suffix) {
    const parent=unionTarget("parent",[targets.parent,targets.suffix]);
    if(parent)targets.parent={...parent,stepNumber:"parent"};
  }
  if(!evidence || evidence.numbering.comparison!==0
    || !["retained-aromatic","aromatic-ester","functional-monocycle","polysubstituted-benzene-prefixes"].includes(evidence.construction))return targets;
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
  // A step already gives the explanation for its selected target. Repeating
  // the same sentence beneath that control adds no information.
  fragments.forEach(fragment=>{if(fragment.explanation===explanation)delete fragment.explanation;});
  if(title===(language==="en"?"Principal functional group":"Grupo funcional principal"))
    fragments.forEach((fragment,index)=>{if(components[index].role==="suffix")delete fragment.explanation;});
  if(title===(language==="en"?"Parent structure":"Estructura principal")
    &&components.some(component=>component.id==="parent")
    &&(explanation.startsWith("The aromatic ring is the parent because")
      ||explanation.startsWith("El anillo aromático es la estructura principal porque")))
    fragments.forEach((fragment,index)=>{if(components[index].id==="parent")delete fragment.explanation;});
  if ([language === "en" ? "Substituents and locants" : "Sustituyentes y localizadores",
    language === "en" ? "Further substituent details" : "Detalle de los sustituyentes"].includes(title))
    fragments.forEach((fragment, index) => {
      const component = components[index], parentAtoms = new Set(derivation.parentAtomIds);
      const positions = component.numbering.filter(([id, locant]) => parentAtoms.has(id) && typeof locant === "number");
      const attachments = component.bondIds.filter(([a, b]) => parentAtoms.has(a) !== parentAtoms.has(b)).length;
      const repeatedPrefix = component.role === "prefix" && positions.length > 1 && attachments === positions.length;
      if (!component.equivalenceGroup && !repeatedPrefix) delete fragment.explanation;
    });
  if (title === (language === "en" ? "Alphabetical order" : "Orden alfabético"))
    fragments.forEach(fragment => delete fragment.explanation);
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
        && ["retained-aromatic", "aromatic-ester", "functional-monocycle", "polysubstituted-benzene-prefixes"].includes(derivation.evidence.construction)
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
    if (parent) addLocants(parent, language === "en" ? "Parent locant" : "Localizador de la estructura principal");
    if (aryl) addLocants(aryl, language === "en" ? "Phenyl ring locant" : "Localizador del anillo fenilo");
  }
  for (const component of components) if (component.parentId && component.writtenLocants?.length)
    addLocants(component, language==="en" ? "Internal locant" : "Localizador interno");
  // Literal internal locants select branch atoms only. Never merge these into
  // parent numbering or the canvas's global map.
  if(title===(language==="en"?"Numbering":"Numeración")) for (const component of components)
    if (component.locant === "N") {
    const atomId=component.numbering.find(([,locant])=>locant==="N")?.[0];
    const defaultStart=component.start>=2&&derivation.name.slice(component.start-2,component.start)==="N-"
      ?component.start-2:derivation.name.slice(component.start,component.start+2)==="N-"?component.start:component.start-2;
    const starts=component.nLocantStarts??[defaultStart];
    for(const [index,start] of starts.entries()) if(atomId!==undefined && derivation.name.slice(start,start+1)==="N") {
      const item: ReasoningNameFragment={text:"N",start,kind:"numbering",language,numberingScope:component.id,
        atomIds:[atomId],semanticId:`amide-n-locant:${component.id}${starts.length>1?`:${index}`:""}`,
        label:derivation.principalGroup==="amide"
          ?language==="en"?"Amide nitrogen locant":"Localizador del nitrógeno amídico"
          :language==="en"?"Amine nitrogen locant":"Localizador del nitrógeno de la amina"};
      locantFragments.push(item);
      const fragmentId=reasoningFragmentId(number,item);
      fragmentTargets[fragmentId]={stepNumber:number,fragmentId,atomIds:[atomId],bondIds:[],locants:[]};
    }
  }
  if(title===(language==="en"?"Substituents and locants":"Sustituyentes y localizadores"))
    for(const component of components) if(component.attachmentScope==="amide-nitrogen"&&component.equivalenceGroup&&component.text.startsWith("di")) {
      const item:ReasoningNameFragment={text:"di",start:component.start,kind:"substituent",language,
        semanticId:`amide-multiplier:${component.id}`,atomIds:component.atomIds,bondIds:component.bondIds,
        label:language==="en"?"Two equivalent substituents":"Dos sustituyentes equivalentes"};
      locantFragments.push(item);const fragmentId=reasoningFragmentId(number,item);
      fragmentTargets[fragmentId]={stepNumber:number,fragmentId,atomIds:component.atomIds,bondIds:component.bondIds,locants:[]};
    }
  for(const component of components) if(component.internalNumbering
    && !(title===(language==="en"?"Numbering":"Numeración")&&component.locant==="N")) {
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
  // The parent and ring controls already appeared in their own explanation
  // stages. The numbering stage exposes the atom-level locant controls only,
  // avoiding duplicate full-fragment buttons while retaining exact locant picks.
  const displayedFragments = title === (language === "en" ? "Numbering" : "Numeración") ? [] : fragments;
  const allFragments = [...displayedFragments, ...locantFragments];
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
      ?"Este prefijo representa dos grupos separados en la estructura principal."
      :`Este prefijo representa ${siblings.length} grupos separados en la estructura principal.`;
    const isAmideBranch=siblings.some(sibling=>sibling.attachmentScope==="amide-nitrogen");
    displayedComponents.push({...component,id:component.equivalenceGroup,atomIds:siblings.flatMap(c=>c.atomIds),
      bondIds:siblings.flatMap(c=>c.bondIds),nLocantStarts:siblings.flatMap(c=>c.nLocantStarts??[]),
      explanation:language==="en"?(isAmideBranch?amideBranchExplanationEn:groupExplanationEn)
        :(isAmideBranch?amideBranchExplanationEs:groupExplanationEs),
      explanationEs:isAmideBranch?amideBranchExplanationEs:groupExplanationEs});
  }
  const roots = displayedComponents.filter(component => component.role === "substituent"
    && (!component.parentId || component.parentId === "parent"));
  const parentAtomIds=new Set(byId.get("parent")?.atomIds??[]);
  const ringBoundSuffixHydroxylCount=(byId.get("suffix")?.atomIds??[]).filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"
    &&graph.bonds.some(([a,b,order])=>order===1&&(a===id&&parentAtomIds.has(b)||b===id&&parentAtomIds.has(a)))).length;
  const aromaticAminoalcoholSubstituent=roots.some(root=>{
    const nested=derivation.components.filter(component=>component.parentId===root.id);
    return nested.some(component=>component.locant!==undefined&&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"))
      &&nested.some(component=>component.locant!==undefined&&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="N"));
  })&&(graph.rings??[]).some(ring=>ring.kind==="aromatic"&&ring.atomIds.every(id=>parentAtomIds.has(id)))
    &&ringBoundSuffixHydroxylCount>=1;
  const stereoComponents = derivation.components.filter(component => /stereo|cip|anomer|series/i.test(component.id));
  const descendants = derivation.components.filter(component => !stereoComponents.includes(component) && (component.role === "prefix"
    || component.role === "substituent" && component.parentId && component.parentId !== "parent"));
  const stages: Omit<Parameters<typeof makeStep>[0], "number" | "derivation" | "language" | "graph">[] = [];
  if (suffix) {
    const elements = new Map(graph.atoms.map(atom => [atom.id, atom.element ?? "C"]));
    const characteristicBonds = graph.bonds.filter(([a,b])=>suffix.atomIds.includes(a)&&suffix.atomIds.includes(b));
    const ester=derivation.principalGroup==="ester" && characteristicBonds.some(([a,b,o])=>o===1
      && (elements.get(a)==="C"&&elements.get(b)==="O" || elements.get(a)==="O"&&elements.get(b)==="C"));
    const hydroxyPrefix = derivation.components.some(component => component.role === "prefix"
      && (component.citationKey==="hydroxy"||/hydroxy|hidroxi/i.test(component.text))
      && component.atomIds.some(id => elements.get(id) === "O"));
    const priorityDetail = derivation.principalGroup === "amide" && hydroxyPrefix
      ? language === "en" ? " The amide has priority over the hydroxyl group, so hydroxy- is expressed as a prefix while amide supplies the suffix."
        : " La amida tiene prioridad sobre el grupo hidroxilo: hidroxi- se expresa como prefijo y la amida aporta el sufijo."
      : "";
    const aminePrefix=derivation.principalGroup==="amide" && derivation.components.some(component=>component.role==="prefix"&&component.text==="amino");
    const amineNitrogen = derivation.principalGroup === "amine"
      ? suffix.atomIds.find(id => elements.get(id) === "N") : undefined;
    const amineCarbonSubstituents = amineNitrogen === undefined ? 0 : graph.bonds.filter(([a,b,order]) => order === 1
      && (a === amineNitrogen && elements.get(b) === "C" || b === amineNitrogen && elements.get(a) === "C")).length;
    const amineClass = amineCarbonSubstituents === 1 ? "primary" : amineCarbonSubstituents === 2 ? "secondary"
      : amineCarbonSubstituents === 3 ? "tertiary" : undefined;
    const amineClassDetail = amineClass
      ? language === "en" ? ` The amine is ${amineClass}: its nitrogen is bonded to ${["one carbon-based group","two carbon-based groups","three carbon-based groups"][amineCarbonSubstituents-1]}.`
        : ` La amina es ${amineClass === "primary" ? "primaria" : amineClass === "secondary" ? "secundaria" : "terciaria"}: su nitrógeno está unido a ${["un grupo carbonado","dos grupos carbonados","tres grupos carbonados"][amineCarbonSubstituents-1]}.`
      : "";
    const aromaticParent=byId.get("parent");
    const parentAtomSet=new Set(aromaticParent?.atomIds??[]);
    const hasAromaticParentRing=(graph.rings??[]).some(ring=>ring.kind==="aromatic"&&ring.atomIds.every(id=>parentAtomSet.has(id)));
    const ringHydroxyls=hasAromaticParentRing?suffix.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"
      &&graph.bonds.some(([a,b,order])=>order===1&&(a===id&&parentAtomSet.has(b)||b===id&&parentAtomSet.has(a)))):[];
    const sideHydroxy=hasAromaticParentRing?derivation.components.filter(component=>component.role==="prefix"
      &&(component.citationKey==="hydroxy"||/hydroxy|hidroxi/i.test(component.text))&&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"
        &&!parentAtomSet.has(id))):[];
    const countWord=language==="en"?(ringHydroxyls.length===1?"One":ringHydroxyls.length===2?"Two":String(ringHydroxyls.length))
      :(ringHydroxyls.length===1?"Un":ringHydroxyls.length===2?"Dos":String(ringHydroxyls.length));
    const functionalExplanation=aminePrefix
      ? language==="en"?"Amide is the principal group. It takes priority over the amine, so amide uses the suffix and the amine is cited as amino-."
        : "La amida es la función principal y tiene prioridad sobre la amina: aporta el sufijo y la amina se cita como «amino-»."
      : ringHydroxyls.length>=1&&sideHydroxy.length
        ?language==="en"?`Under P-41, phenolic and alcoholic hydroxyl groups belong to the same hydroxy-compound class; neither has separate seniority. ${countWord} hydroxyl group${ringHydroxyls.length===1?"":"s"} bonded directly to the aromatic ring ${ringHydroxyls.length===1?"is":"are"} expressed by the ${derivation.components.find(c=>c.id==="suffix")?.text??"polyol"} suffix. Hydroxyl groups on the side chains are cited as hydroxy- prefixes.`
          :`Según P-41, los grupos hidroxilo fenólicos y alcohólicos pertenecen a la misma clase de compuestos hidroxilados; no tienen prioridades separadas. ${countWord} grupo${ringHydroxyls.length===1?"":"s"} hidroxilo unido${ringHydroxyls.length===1?"":"s"} directamente al anillo aromático ${ringHydroxyls.length===1?"se expresa":"se expresan"} mediante el sufijo ${derivation.components.find(c=>c.id==="suffix")?.text??"poliol"}. Los hidroxilos de las cadenas laterales se citan como prefijos hidroxi-.`
      : derivation.principalGroup === "ester"
        ? language === "en" ? "The ester name cites the alcohol-derived group before the acid-derived alkanoate."
          : "El nombre del éster cita el grupo procedente del alcohol antes del alcanoato derivado del ácido."
      : language==="en"?`The principal functional group is ${groupNames.en[derivation.principalGroup]} and it is expressed by its characteristic suffix.`
        : `La función principal es ${groupNames.es[derivation.principalGroup]} y se expresa mediante su sufijo característico.`;
    stages.push({ title: language === "en" ? "Principal functional group" : "Grupo funcional principal",
      explanation: functionalExplanation+priorityDetail+amineClassDetail,
      components: [suffix, ...derivation.components.filter(c=>c.role==="suffix" && c.parentId===suffix.id)] });
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
    const aromaticParentRing=(graph.rings??[]).find(candidate=>candidate.kind==="aromatic"&&candidate.atomIds.every(id=>parent.atomIds.includes(id)));
    const parentRingOxygens=derivation.principalGroup==="alcohol"&&aromaticParentRing&&suffix?suffix.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"
      &&parent.atomIds.some(parentId=>graph.bonds.some(([a,b,order])=>order===1&&(a===id&&b===parentId||b===id&&a===parentId)))):[];
    const hydroxyOnSubstituent=Boolean(aromaticParentRing)&&derivation.components.some(component=>component.role==="prefix"
      &&(component.citationKey==="hydroxy"||/hydroxy|hidroxi/i.test(component.text))
      &&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"&&!parent.atomIds.includes(id)));
    const hydroxyAlternatives=parentRingOxygens.length>=1&&hydroxyOnSubstituent
      ?roots.flatMap(root=>{
        const core=derivation.components.find(component=>component.parentId===root.id&&component.role==="prefix"
          &&component.id.endsWith("-core")&&component.atomIds.length>0
          &&component.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C"));
        if(!core)return [];
        const coreAtoms=new Set(core.atomIds);
        const hydroxyls=derivation.components.filter(component=>component.role==="prefix"
          &&(component.citationKey==="hydroxy"||/hydroxy|hidroxi/i.test(component.text))
          &&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"&&!parent.atomIds.includes(id))
          &&component.atomIds.some(id=>graph.bonds.some(([a,b,order])=>order===1&&((a===id&&coreAtoms.has(b))||(b===id&&coreAtoms.has(a))))));
        return hydroxyls.length?[hydroxyls.length]:[];
      }):[];
    const maximumChainHydroxyls=hydroxyAlternatives.length?Math.max(...hydroxyAlternatives):0;
    const parentReason=parentRingOxygens.length>maximumChainHydroxyls
      ?language==="en"?`P-44.1.1 selects the parent that can express the most hydroxyl groups by suffix: the aromatic ring carries ${parentRingOxygens.length}, while each attached carbon chain carries at most ${maximumChainHydroxyls}.`
        :`P-44.1.1 selecciona la estructura principal que puede expresar mediante sufijo más grupos hidroxilo: el anillo aromático lleva ${parentRingOxygens.length} y cada cadena carbonada lateral, como máximo, ${maximumChainHydroxyls}.`
      :parentRingOxygens.length===maximumChainHydroxyls&&maximumChainHydroxyls>0
        ?language==="en"?`P-44.1.1 ties the ring and attached carbon-chain alternatives at ${parentRingOxygens.length} suffix hydroxyl group${parentRingOxygens.length===1?"":"s"} each. Both have carbon as the senior atom; P-44.1.2.2 prefers the ring over the chain.`
          :`P-44.1.1 empata el anillo y las cadenas carbonadas laterales con ${parentRingOxygens.length} grupo${parentRingOxygens.length===1?"":"s"} hidroxilo${parentRingOxygens.length===1?"":"s"} expresable${parentRingOxygens.length===1?"":"s"} mediante sufijo. Ambas alternativas tienen carbono como átomo senior; P-44.1.2.2 da preferencia al anillo sobre la cadena.`
        :undefined;
    const explanation = parentReason
      ?parentReason
      : parentRingOxygens.length>=1&&hydroxyOnSubstituent
      ?language==="en"?`The reconciled name places ${parentRingOxygens.length} suffix-expressed hydroxyl group${parentRingOxygens.length===1?"":"s"} on this aromatic parent. P-41 does not rank phenolic hydroxyls above alcoholic hydroxyls; the available parent-selection evidence does not compare all alternatives.`
        :`El nombre conciliado expresa ${parentRingOxygens.length} grupo${parentRingOxygens.length===1?"":"s"} hidroxilo mediante sufijo en este padre aromático. P-41 no sitúa los hidroxilos fenólicos por encima de los alcohólicos; la evidencia disponible no compara todas las alternativas de padre.`
      : derivation.evidence
      ? language==="es"?parent.explanationEs??parent.explanation:parent.explanation
      : derivation.principalGroup === "none"
      ? language === "en" ? parent.explanation : parent.explanationEs ?? parent.explanation
      : derivation.principalGroup === "amide" && roots.some(root => root.locant === "N")
      ? language === "en" ? "The amide is the parent; N- marks substitution on its nitrogen."
        : "La amida forma la estructura principal; N- indica que el sustituyente se une a su nitrógeno."
      : ring && derivation.principalGroup === "carboxylicAcid"
        ? language === "en" ? `The ring is the parent structure; the carboxyl carbon remains outside the ring.${rule ? ` (${rule})` : ""}`
          : `El anillo es la estructura principal; el carbono carboxílico queda fuera del anillo.${rule ? ` (${rule})` : ""}`
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
  const heteroatomSubstituents=roots.filter(component=>component.locant==="N"||component.attachmentScope==="amide-nitrogen");
  const numberComponents = [parent, byId.get("aryl"), ...derivation.components.filter(component => component.id.startsWith("sugar-chain")),...heteroatomSubstituents]
    .filter((component): component is NameComponent => Boolean(component && component.numbering.length));
  const aromaticEvidence=derivation.evidence && ["retained-aromatic", "aromatic-ester", "functional-monocycle", "polysubstituted-benzene-prefixes"].includes(derivation.evidence.construction)
    ? derivation.evidence : undefined;
  const writtenPositions=[...new Set(parent?.writtenLocants?.map(item=>item.locant)??[])].sort((a,b)=>a-b);
  const multifunctional=derivation.evidence && ["polycarboxylic-acid","multifunctional-alcohol"].includes(derivation.evidence.construction) ? derivation.evidence : undefined;
  const parentContainsRing=Boolean(parent&&(graph.rings??[]).some(candidate=>candidate.atomIds.length>=3
    &&candidate.atomIds.every(id=>parent.atomIds.includes(id))));
    const numberExplanation=multifunctional ? (language==="en" ? "Compare suffix locants first, then all prefix locants, then positions in citation order." : "Se comparan primero los localizadores del sufijo, después los de todos los prefijos y finalmente los de cada prefijo en orden de cita.") + (multifunctional.numbering.comparison===0 ? (language==="en" ? " The drawing shows one of the tied numberings." : " El dibujo muestra una de las numeraciones empatadas.") : "") : derivation.evidence?.construction==="polysubstituted-benzene-prefixes"
    ? language==="en" ? `Benzene has no suffix-bearing group. Compare all six orientations by the complete set of substituent locants, then by the locants for prefixes in citation order. The written locants are ${writtenPositions.join(", ")}.${aromaticEvidence?.numbering.comparison===0?" A symmetry tie remains.":" The written orientation is the lowest admissible one."}`
      : `El benceno no tiene un grupo expresado mediante sufijo. Se comparan las seis orientaciones por el conjunto completo de localizadores y luego por los de cada prefijo en orden de cita. Los localizadores escritos son ${writtenPositions.join(", ")}.${aromaticEvidence?.numbering.comparison===0?" Persiste un empate por simetría.":" La orientación escrita es la menor admisible."}`
    : aromaticEvidence&&parentContainsRing
    ? language==="en" ? `Ring C1 bears the characteristic group${writtenPositions.length?`; the written substituent positions are ${writtenPositions.join(", ")}`:""}. ${aromaticEvidence.numbering.comparison===0?"Equivalent orientations remain; only unambiguous atom locants are shown.":"The supported locants determine the displayed orientation."}`
      : `C1 del anillo lleva el grupo característico${writtenPositions.length?`; las posiciones escritas de los sustituyentes son ${writtenPositions.join(", ")}`:""}. ${aromaticEvidence.numbering.comparison===0?"Hay orientaciones equivalentes; solo se muestran los localizadores inequívocos por átomo.":"Los localizadores respaldados determinan la orientación mostrada."}`
    : aromaticEvidence&&!parentContainsRing
      ? language==="en" ? "The parent chain, each aromatic ring, and each nested substituent use separate numbering scopes."
        : "La cadena principal, cada anillo aromático y cada sustituyente anidado usan sistemas de numeración separados."
    : derivation.evidence?.construction === "acyclic-aryl-amine"
      ? language === "en" ? `The amine fixes parent C1. Carbon substituents occur at ${writtenPositions.filter(p=>p!==1).map(p=>"C"+p).join(", ") || "C1"}. Ring locants start again at the attachment carbon.`
        : `La amina fija C1 de la estructura principal. Los sustituyentes sobre carbono se sitúan en ${writtenPositions.filter(p=>p!==1).map(p=>"C"+p).join(", ") || "C1"}. Los localizadores del anillo se cuentan desde su carbono de unión.`
      : language === "en" ? roots.length || descendants.length
      ? "Parent, ring, and nested-substituent locants belong to their own numbering systems."
      : "Locants follow the numbering of the selected parent structure."
      : roots.length || descendants.length ? "La estructura principal, el anillo y los sustituyentes anidados conservan numeraciones independientes."
        : "Los localizadores siguen la numeración de la estructura principal.";
  const parentNumbering=new Map<number,number>((parent?.numbering??[]).flatMap(([atomId,locant])=>
    typeof locant==="number"?[[atomId,locant] as [number,number]]:[]));
  const parentCarbonLocants=[...new Set((parent?.numbering??[]).filter(([atomId,locant])=>typeof locant==="number"
    && (graph.atoms.find(atom=>atom.id===atomId)?.element??"C")==="C").map(([,locant])=>locant as number))].sort((a,b)=>a-b);
  const parentRing=Boolean(parent&&(graph.rings??[]).some(candidate=>candidate.atomIds.length>=3
    && candidate.atomIds.every(id=>parent.atomIds.includes(id))));
  const concreteNumbering:string[]=[];
  if(parentCarbonLocants.length>1)concreteNumbering.push(parentRing
    ?language==="en"?`The parent ring is numbered C${parentCarbonLocants[0]}–C${parentCarbonLocants.at(-1)}.`:`El anillo principal se numera de C${parentCarbonLocants[0]} a C${parentCarbonLocants.at(-1)}.`
    :language==="en"?`The parent chain is numbered C${parentCarbonLocants[0]}–C${parentCarbonLocants.at(-1)}.`:`La cadena principal se numera de C${parentCarbonLocants[0]} a C${parentCarbonLocants.at(-1)}.`);
  for(const component of roots) {
    const core=derivation.components.find(child=>child.parentId===component.id&&child.role==="prefix"
      &&child.atomIds.length>=2&&child.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C"));
    const body=core?localizedCitationName(core.text,language)
      :language==="en"?component.label??component.text:component.labelEs??component.text;
    const locants=[...new Set(component.numbering.flatMap(([atomId,locant])=>parentNumbering.has(atomId)&&typeof locant==="number"?[locant]:[]))];
    if(locants.length)concreteNumbering.push(language==="en"
      ?`“${body}” is attached at parent ${locants.map(locant=>`C${locant}`).join(" and ")}.`
      :`«${body}» se une en ${locants.map(locant=>`C${locant}`).join(" y ")} de la estructura principal.`);
    else if(component.locant==="N"||component.attachmentScope==="amide-nitrogen") {
      const nLocant=/^(N(?:,N)*)-/.exec(component.text)?.[1]??"N";
      const nitrogen=derivation.principalGroup==="amide"?language==="en"?"amide nitrogen":"nitrógeno amídico"
        :derivation.principalGroup==="amine"?language==="en"?"amine nitrogen":"nitrógeno de la amina"
        :language==="en"?"heteroatom":"heteroátomo";
      concreteNumbering.push(language==="en"?`The ${nLocant} locant places “${body}” on the ${nitrogen}.`
        :`El localizador ${nLocant} sitúa «${body}» en el ${nitrogen}.`);
    }
  }
  const detailedNumberExplanation=concreteNumbering.length
    ? ["polycarboxylic-acid","multifunctional-alcohol","polysubstituted-benzene-prefixes"].includes(derivation.evidence?.construction??"")
      || Boolean(aromaticEvidence) || derivation.evidence?.construction==="acyclic-aryl-amine"
      ? [...new Set([numberExplanation,...concreteNumbering])].join(" ") : concreteNumbering.join(" ")
    : numberExplanation;
  const nestedNumberDetails=aromaticAminoalcoholSubstituent?roots.flatMap(root=>{
    const children=derivation.components.filter(component=>component.parentId===root.id&&component.locant!==undefined);
    if(!children.length)return [];
    const rootLocant=root.numbering.flatMap(([atomId,locant])=>parentNumbering.has(atomId)&&typeof locant==="number"?[locant]:[])[0];
    const chain=derivation.components.find(component=>component.parentId===root.id&&component.atomIds.length>=1
      &&component.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C"));
    const chainName=chain&&chain.atomIds.length>=2?localizedCitationName(chain.text,language)
      :localizedCitationName(root.text.replace(/^(?:[\d,]+-)/,"").replace(/^\((.*)\)$/,"$1"),language);
    const assignments=children.map(component=>{
      const locant=component.locant;
      const hasO=component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O");
      const nitrogen=component.atomIds.find(id=>graph.atoms.find(atom=>atom.id===id)?.element==="N");
      const nAlkyl=nitrogen===undefined?undefined:derivation.components.find(child=>child.parentId===component.id
        &&child.atomIds.length>0&&child.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C")
        &&child.atomIds.some(carbon=>graph.bonds.some(([a,b,order])=>order===1&&(a===nitrogen&&b===carbon||b===nitrogen&&a===carbon))));
      const term=hasO?(language==="en"?"hydroxyl":"hidroxilo")
        :nitrogen?(nAlkyl?`${language==="en"?"":"grupo "}${localizedCitationName(nAlkyl.text,language)}amino${language==="en"?" group":""}`
          :language==="en"?"amino group":"grupo amino")
          :localizedCitationName(component.text.replace(/^\d+-/ ,""),language);
      return language==="en"?`C${locant} bears the ${term}`:`C${locant} lleva el ${term}`;
    });
    const desc=language==="en"?`Within the ${chainName} substituent at parent C${rootLocant??"?"}, ${assignments.join(" and ")}.`
      :`Dentro del sustituyente ${chainName} unido en C${rootLocant??"?"} de la estructura principal, ${assignments.join(" y ")}.`;
    return [desc];
  }):[];
  const finalNumberExplanation=nestedNumberDetails.length?[detailedNumberExplanation,...nestedNumberDetails].join(" "):detailedNumberExplanation;
  if (numberComponents.length) stages.push({ title: language === "en" ? "Numbering" : "Numeración",
    explanation:finalNumberExplanation, components: numberComponents });
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
    if(aromaticAminoalcoholSubstituent){
      const explanations=roots.map(root=>{
        const children=derivation.components.filter(component=>component.parentId===root.id);
        const core=children.find(component=>component.atomIds.length>=1
          &&component.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C"));
        const chain=core?.text??(language==="en"?"carbon chain":"cadena carbonada");
        const locant=root.numbering.flatMap(([atomId,locant])=>parentNumbering.has(atomId)&&typeof locant==="number"?[locant]:[])[0];
        const hydroxy=children.find(component=>component.locant!==undefined
          &&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"));
        const amino=children.find(component=>component.locant!==undefined
          &&component.atomIds.some(id=>graph.atoms.find(atom=>atom.id===id)?.element==="N"));
        const amineAlkyl=amino&&derivation.components.find(component=>component.parentId===amino.id&&component.role==="prefix"
          &&component.atomIds.length>0&&component.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C")
          &&component.atomIds.some(carbon=>[...new Set(amino.atomIds)].some(n=>graph.atoms.find(atom=>atom.id===n)?.element==="N"
            &&graph.bonds.some(([a,b,order])=>order===1&&(a===n&&b===carbon||b===n&&a===carbon)))));
        const amineAtoms=new Set(amino?.atomIds??[]);
        const nAlkyl=Boolean(amineAlkyl&&[...amineAtoms].some(n=>graph.atoms.find(atom=>atom.id===n)?.element==="N"
          &&amineAlkyl.atomIds.some(carbon=>graph.bonds.some(([a,b,order])=>order===1&&(a===n&&b===carbon||b===n&&a===carbon)))));
        const hydroxyPart=hydroxy?(language==="en"?`–OH at C${hydroxy.locant}`:`–OH en C${hydroxy.locant}`):undefined;
        const amineName=nAlkyl?`${localizedCitationName(amineAlkyl!.text,language)}amino`:language==="en"?"amino":"amino";
        const aminoPart=amino?(language==="en"?`${amineName} at C${amino.locant}`:`${amineName} en C${amino.locant}`):undefined;
        const parts=[hydroxyPart,aminoPart].filter((value):value is string=>Boolean(value));
        const nitrogenDetail=nAlkyl?(language==="en"?` The amino nitrogen is bonded to the ${localizedCitationName(amineAlkyl!.text,language)} group.`:` El nitrógeno del grupo amino está unido al grupo ${localizedCitationName(amineAlkyl!.text,language)}.`):"";
        if(!amino){
          const rootName=localizedCitationName(root.text.replace(/^(?:[\d,]+-)/,"").replace(/^\((.*)\)$/,"$1"),language);
          return language==="en"?`At parent C${locant??"?"}, ${rootName} is a ${core?.atomIds.length??""}-carbon substituent with –OH at its C1.`
            :`En C${locant??"?"} de la estructura principal, ${rootName} es un sustituyente de ${core?.atomIds.length??""} carbono con –OH en su C1.`;
        }
        return language==="en"
          ?`At parent C${locant??"?"}, the ${core?.atomIds.length??""}-carbon ${localizedCitationName(chain,language)} substituent bears ${parts.join(" and ")}.${nitrogenDetail}`
          :`En C${locant??"?"} de la estructura principal, el sustituyente ${localizedCitationName(chain,language)} de ${core?.atomIds.length??""} carbonos lleva ${parts.join(" y ")}.${nitrogenDetail}`;
      });
      stages.push({title:language==="en"?"Substituents and locants":"Sustituyentes y localizadores",
        explanation:explanations.join(" "),components:substituents});
    } else {
    // Root explanations summarize nested details for substituted alkanamides;
    // child controls remain available for selecting those exact regions.
    const summaryComponents=derivation.evidence?.construction==="substituted-alkanamide" ? roots : substituents;
    const descriptions=summaryComponents.map(component=>{
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
        : `${label} representa ${positions.length} grupos en las posiciones ${locants} de la estructura principal; el multiplicador cuenta uniones separadas.`;
      return language==="en" ? `${label} is cited at ${positions.length?`parent position ${locants}`:"the parent structure"}.`
        : `${label} se cita como sustituyente unido a ${positions.length?`la posición ${locants} de la estructura principal`:"la estructura principal"}.`;
    });
    const componentsToExplain=derivation.evidence?.construction==="substituted-alkanamide" ? summaryComponents : substituents;
    const paragraphs:{explanation:string;components:NameComponent[]}[]=[];
    descriptions.forEach((description,index)=>{
      const last=paragraphs.length-1;
      if(last>=0 && paragraphs[last].explanation.length+description.length+1<240){
        paragraphs[last].explanation+=` ${description}`;paragraphs[last].components.push(componentsToExplain[index]);
      } else paragraphs.push({explanation:description,components:[componentsToExplain[index]]});
    });
    paragraphs.forEach((paragraph,index)=>stages.push({
      title:index===0?(language==="en"?"Substituents and locants":"Sustituyentes y localizadores")
        :(language==="en"?"Nested substituent composition":"Composición de los sustituyentes anidados"),
      explanation:paragraph.explanation,
      components:index===0&&derivation.evidence?.construction==="substituted-alkanamide"?substituents:paragraph.components}));
    }
  }
  // The names and graph-linked attachment points are explained with the
  // substituents themselves; a second punctuation recap repeated that content.
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
  const localizedCitations=orderedPeers.map(({component})=>localizedCitationName(component.text,language));
  const localizedAlphabeticalOrder=orderedPeers.length>1?describeAlphabeticalOrder(orderedPeers.map(({component,cited,name,multiplier})=>{
    const localizedName=localizedCitationName(name,language);
    const localizedComparisonName=localizedCitationName(component.citationKey??name,language);
    const comparisonName=localizedComparisonName.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z]/g,"").toLocaleLowerCase(language);
    return {sourceName:localizedCitationName(component.text,language),name:localizedName,comparisonName,
      locants:component.numbering.flatMap(([,n])=>typeof n==="number"?[n]:[]),
      internalLocants:component.internalNumbering?.map(([,locant])=>locant)??[],
      citedPrefix:localizedCitationName(cited,language),multiplier,complex:/[()[\]{}-]/.test(localizedName)};
  }),language):undefined;
  const alphabeticSummary=language==="es"&&localizedAlphabeticalOrder&&orderedPeers.length>1
    ? "Se comparan los nombres completos de los sustituyentes, ignorando localizadores y multiplicadores externos. "+localizedAlphabeticalOrder.paragraphs.at(-1)
    : alphabeticalOrder?.paragraphs.join(" ");
  const displayedAlphabeticalOrder=language==="es"&&localizedAlphabeticalOrder?{...localizedAlphabeticalOrder,
    fragment:localizedCitations.join(" → ")}:alphabeticalOrder;
  if (alphabeticalOrder && [...peerCounts.values()].some(count => count > 1))
    stages.push({ title: language === "en" ? "Alphabetical order" : "Orden alfabético",
      explanation: alphabeticSummary??alphabeticalOrder.paragraphs.join(" "), components: directPeers, alphabeticalOrder:displayedAlphabeticalOrder });
  if (stereoComponents.length || getPotentialTetrahedralStereoCenterIds(graph).length)
    stages.push({ title: language === "en" ? "Stereochemistry" : "Estereoquímica",
      explanation: language === "en" ? "CIP priorities and only specified configurations are shown."
        : "Se muestran las prioridades CIP y únicamente las configuraciones especificadas.", components: stereoComponents });
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
    explanation:language==="en" ? `Combine the locants and prefixes with the parent${suffix?" and its characteristic suffix":"; no principal suffix is used"} to obtain ${derivation.name}.`
      +esterOrder : `Se combinan los localizadores y prefijos con la estructura principal${suffix?" y su sufijo característico":"; no se utiliza sufijo principal"} para obtener ${derivation.name}.`+esterOrder,
    components:[]});
  const steps = stages.map((stage, index) => makeStep({ ...stage, number: String(index + 1).padStart(2, "0"), derivation, language, graph }));
  addTetrahedralStereoEvidence(steps, graph, derivation, language);
  const construction=derivation.evidence?.construction;
  const hierarchical=construction==="acyclic-aryl-amine" || construction==="substituted-alkanamide"
    || construction==="aminoalkyl-benzenediol" || construction==="multifunctional-alcohol";
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
  const repeatedText = new Set(resultSteps.map(step=>step.explanation.trim()).filter(Boolean));
  for(const step of resultSteps) for(const fragment of [step.fragments,...step.fragments?.additionalFragments??[]]) {
    if(!fragment)continue;
    if(fragment.explanation && (repeatedText.has(fragment.explanation.trim())
      ||step.explanation.includes(fragment.explanation.trim()))) delete fragment.explanation;
    else if(fragment.explanation) repeatedText.add(fragment.explanation.trim());
  }
  const parentEvidence = parent && reconciledParentSelectionEvidence({ molecule: graph, parentAtomIds: parent.atomIds,
    derivationName: derivation.name, activeName: input.activeName, language });
  const parentStep = parent ? resultSteps.find(step => step.componentIds.includes(parent.id)) : undefined;
  if (parentStep && parentEvidence) parentStep.parentSelectionEvidence = parentEvidence;
  if(parentStep&&(parentStep.explanation.startsWith("The aromatic ring is the parent because")
    ||parentStep.explanation.startsWith("El anillo aromático es la estructura principal porque")))
    for(const fragment of [parentStep.fragments,...parentStep.fragments?.additionalFragments??[]])
      if(fragment)delete fragment.explanation;
  return { name: derivation.name, steps: resultSteps };
}

function addTetrahedralStereoEvidence(steps: PriorityReasoningStep[], graph: GeneratedMolecule,
  derivation: ValidatedNameDerivation, language: AppLanguage) {
  const en = language === "en";
  const assigned = new Map(getTetrahedralStereoCenters(graph).map(center => [center.atomId, center.configuration]));
  const centers = [...new Set([...getPotentialTetrahedralStereoCenterIds(graph), ...assigned.keys()])];
  if (!centers.length) return;
  let step = steps.find(candidate => candidate.title === (en ? "Stereochemistry" : "Estereoquímica"));
  if (!step) {
    const number = String(steps.length + 1).padStart(2, "0");
    step = { number, title: en ? "Stereochemistry" : "Estereoquímica", explanation: "",
      fragmentTargets: {}, componentIds: [], source: "FULL" };
    const construction = steps.findIndex(candidate => candidate.title === (en ? "Constructing the name" : "Construcción del nombre"));
    steps.splice(construction < 0 ? steps.length : construction, 0, step);
  }
  const elementNames: Record<number, [string, string]> = { 1: ["hydrogen", "hidrógeno"], 6: ["carbon", "carbono"],
    7: ["nitrogen", "nitrógeno"], 8: ["oxygen", "oxígeno"], 9: ["fluorine", "flúor"],
    16: ["sulfur", "azufre"], 17: ["chlorine", "cloro"], 35: ["bromine", "bromo"], 53: ["iodine", "yodo"] };
  const explanations: string[] = [], fragments: ReasoningNameFragment[] = [];
  const repeatedPriorityEvidence=new Map<string,string>();
  for (const centerId of centers) {
    const evidence = inspectTetrahedralCipPriorities(graph, centerId);
    if (!evidence) continue;
    const locant = derivation.components.flatMap(component => [
      ...component.numbering, ...(component.internalNumbering ?? []),
    ]).find(([atomId]) => atomId === centerId)?.[1];
    const inParent=derivation.components.find(component=>component.id==="parent")?.atomIds.includes(centerId)??false;
    const containingSubstituent=derivation.components.find(component=>component.role==="substituent"
      &&component.parentId==="parent"&&component.atomIds.includes(centerId));
    const namedSideChain=containingSubstituent&&derivation.components.find(component=>component.parentId===containingSubstituent.id
      &&component.role==="prefix"&&component.atomIds.length>=2
      &&component.atomIds.every(id=>graph.atoms.find(atom=>atom.id===id)?.element==="C"));
    const centerLabel = typeof locant === "number"
      ? !inParent&&containingSubstituent?en?`C${locant} of the ${namedSideChain?localizedCitationName(namedSideChain.text,language):"side-chain"} substituent`:`C${locant} de la cadena ${namedSideChain?localizedCitationName(namedSideChain.text,language):"lateral"} sustituyente`:`C${locant}`
      : en ? `atom ${centerId}` : `átomo ${centerId}`;
    const configuration = assigned.get(centerId);
    const configurationText=configuration
      ?en?`Under the CIP convention, at ${centerLabel}, if priority 4 (hydrogen) points away, the 1→2→3 order is ${configuration==="R"?"clockwise":"counterclockwise"}, giving ${configuration}. The molecular graph specifies ${configuration} at ${centerLabel}; the displayed 2D orientation alone does not assign the descriptor.`
        :`Según la convención CIP, en ${centerLabel}, si la prioridad 4 (hidrógeno) apunta hacia atrás, el recorrido 1→2→3 es ${configuration==="R"?"horario":"antihorario"} y corresponde a ${configuration}. El grafo molecular especifica ${configuration} en ${centerLabel}; la orientación 2D por sí sola no asigna el descriptor.`
      :en?`The molecular graph specifies no configuration at ${centerLabel}, so no R/S descriptor is added there.`
        :`El grafo molecular no especifica una configuración en ${centerLabel}; no se añade allí un descriptor R/S.`;
    explanations.push(en
      ? `${centerLabel} is stereogenic: its four ligands have distinct CIP priorities. ${configuration
        ? configurationText : configurationText}`
      : `${centerLabel} es estereogénico: sus cuatro ligandos tienen prioridades CIP distintas. ${configuration
        ? configurationText : configurationText}`);
    fragments.push({ text: centerLabel, structuralReference: "stereogenic-center",
      label: en ? `Select stereogenic center ${centerLabel}` : `Seleccionar centro estereogénico ${centerLabel}`,
      kind: "stereo", semanticId: `stereo-center:${centerId}`, atomIds: [centerId], bondIds: [] });
    const centerFragment = fragments.at(-1)!;
    let fragmentId = reasoningFragmentId(step.number, centerFragment);
    step.fragmentTargets[fragmentId] = { stepNumber: step.number, fragmentId, atomIds: [centerId], bondIds: [], locants: [] };

    // Without a specified tetrahedral configuration, CIP ranking does not
    // contribute to an R/S descriptor. Keep the centre note and omit unused
    // priority detail and controls.
    if (!configuration) continue;

    const prioritySignature=JSON.stringify(evidence.priorities.map(priority=>[
      describeCipLigand(graph,centerId,priority,language),priority.firstDifference?.sphere??null,
      priority.firstDifference?.higherAtomicNumber??null,priority.firstDifference?.lowerAtomicNumber??null,
    ]));
    const previousCenter=repeatedPriorityEvidence.get(prioritySignature);
    if(previousCenter)explanations.push(en
      ?`At ${centerLabel}, the ligand descriptions and CIP comparisons match those at ${previousCenter}.`
      :`En ${centerLabel}, las descripciones de los ligandos y las comparaciones CIP coinciden con las de ${previousCenter}.`);
    else repeatedPriorityEvidence.set(prioritySignature,centerLabel);

    for (const priority of evidence.priorities) {
      const difference = priority.firstDifference;
      const next=priority.rank<4?evidence.priorities.find(item=>item.rank===priority.rank+1):undefined;
      const branchDisplay=describeCipLigand(graph,centerId,priority,language);
      const comparedBranch=next?describeCipLigand(graph,centerId,next,language):undefined;
      let comparisonTarget=comparedBranch;
      if(comparedBranch&&en&&/^(?:hydroxyl|carboxyl) group|^aromatic ring/.test(comparedBranch))comparisonTarget=`the ${comparedBranch}`;
      if(comparedBranch&&!en&&(comparedBranch.startsWith("grupo ")||comparedBranch.startsWith("anillo aromático")))comparisonTarget=`al ${comparedBranch}`;
      const comparison=difference&&next&&priority.atomId!==null&&next.atomId!==null
        ?difference.sphere===1
          ?en?` Compared with ${comparisonTarget}, the atoms directly attached to the stereocenter differ: ${elementNames[difference.higherAtomicNumber]?.[0]??"the higher-priority atom"} outranks ${elementNames[difference.lowerAtomicNumber]?.[0]??"the other atom"}.`
            :` ${comparisonTarget?.startsWith("al ")?"Frente ":"Frente a "}${comparisonTarget}, difieren los átomos unidos directamente al centro estereogénico: ${elementNames[difference.higherAtomicNumber]?.[1]??"el elemento de mayor prioridad"} tiene prioridad sobre ${elementNames[difference.lowerAtomicNumber]?.[1]??"el otro elemento"}.`
          :en?` The first atoms of these two ligands match; farther along the groups, ${elementNames[difference.higherAtomicNumber]?.[0]??"the higher-priority atom"} outranks ${elementNames[difference.lowerAtomicNumber]?.[0]??"the other atom"}.`
            :` Los primeros átomos de estas dos ramas coinciden; más adelante, ${elementNames[difference.higherAtomicNumber]?.[1]??"el elemento de mayor prioridad"} tiene prioridad sobre ${elementNames[difference.lowerAtomicNumber]?.[1]??"el otro elemento"}.`
        :"";
      const reason = difference
        ? comparison
        : en ? " It is the lowest-ranked ligand." : " Es el ligando de menor prioridad.";
      const englishBranch=/^(?:hydroxyl|carboxyl) group|^aromatic ring/.test(branchDisplay)?`the ${branchDisplay}`:branchDisplay;
      const spanishBranch=branchDisplay.startsWith("grupo ")||branchDisplay.startsWith("anillo aromático")
        ?`al ${branchDisplay}`:branchDisplay==="hidrógeno"?"al hidrógeno":`a ${branchDisplay}`;
      if(!previousCenter)explanations.push(en ? `Priority ${priority.rank} is ${englishBranch}.${reason}`
        : `La prioridad ${priority.rank} corresponde ${spanishBranch}.${reason}`);
      if (priority.atomId === null) continue;
      const branchLabel = en ? `Priority ${priority.rank} · ${branchDisplay}`
        : `Prioridad ${priority.rank} · ${branchDisplay}`;
      const branch: ReasoningNameFragment = { text: branchLabel, structuralReference: "cip-priority-branch",
        label: en ? `Select ${branchLabel}` : `Seleccionar ${branchLabel}`, kind: "stereo",
        semanticId: `stereo-ligand:${centerId}:${priority.rank}`, atomIds: priority.branchAtomIds,
        bondIds: priority.branchBondIds };
      fragments.push(branch);
      fragmentId = reasoningFragmentId(step.number, branch);
      step.fragmentTargets[fragmentId] = { stepNumber: step.number, fragmentId,
        atomIds: branch.atomIds ?? [], bondIds: branch.bondIds ?? [], locants: [] };
    }
  }
  for (const component of derivation.components.filter(item => item.id.startsWith("stereo-"))) {
    const fragment: ReasoningNameFragment = { text: component.text,
      label: en ? `Select descriptor (${component.text})` : `Seleccionar descriptor (${component.text})`,
      kind: "stereo", semanticId: `stereo-descriptor:${component.id}`, start: component.start,
      language, atomIds: component.atomIds, bondIds: [] };
    fragments.push(fragment);
    const fragmentId = reasoningFragmentId(step.number, fragment);
    step.fragmentTargets[fragmentId] = { stepNumber: step.number, fragmentId,
      atomIds: component.atomIds, bondIds: [], locants: component.numbering };
  }
  step.explanation = explanations.join(" ");
  step.fragments = fragments.length ? { ...fragments[0], additionalFragments: fragments.slice(1) } : undefined;
  step.target = { stepNumber: step.number,
    atomIds: [...new Set(fragments.flatMap(fragment => [...fragment.atomIds ?? []]))],
    bondIds: [...new Map(fragments.flatMap(fragment => [...fragment.bondIds ?? []])
      .map(([a,b]) => [`${Math.min(a,b)}:${Math.max(a,b)}`, [a,b] as [number,number]])).values()], locants: [] };
}

/** Retain additional chemical views available before reconciliation. Never
 * attach a name locant or an individual identity to a swappable occurrence. */
function retainStructuralControls(step:PriorityReasoningStep, allSteps:PriorityReasoningStep[], evidence:StructuralDerivation,
  language:AppLanguage, graph:GeneratedMolecule) {
  const signature=(atoms:readonly number[],bonds:readonly (readonly [number,number])[])=>JSON.stringify([
    [...atoms].sort((a,b)=>a-b),bonds.map(([a,b])=>[Math.min(a,b),Math.max(a,b)].join(":")).sort()]);
  const seen=new Set(allSteps.flatMap(s=>Object.values(s.fragmentTargets).map(t=>signature(t.atomIds,t.bondIds))));
  const namedComponentIds=new Set(allSteps.flatMap(s=>s.componentIds));
  const namedAtoms=new Set(allSteps.flatMap(s=>[s.fragments,...s.fragments?.additionalFragments??[]]
    .filter((fragment):fragment is ReasoningNameFragment=>Boolean(fragment&&namedComponentIds.has(fragment.semanticId??"")))
    .flatMap(fragment=>fragment.atomIds??[])));
  const structural=buildStructuralPriorityReasoning({derivation:evidence,language});
  const symmetry=analyzeStructuralEquivalence(graph,graph);
  if(!symmetry)return;
  const retained:ReasoningNameFragment[]=[];
  for(const region of structural.steps) {
    if(!region.fragments || region.componentKind==="candidate carbon skeleton"
      || region.componentKind==="connected fragment")continue;
    if(["ringSystem","amine fragment"].includes(region.componentKind??"")
      && region.target?.atomIds.length
      && region.target.atomIds.every(atomId=>namedAtoms.has(atomId)))continue;
    for(const fragment of [region.fragments,...region.fragments.additionalFragments??[]]) {
      const original=region.fragmentTargets[reasoningFragmentId(region.number,fragment)];
      if(!original)continue;
      const key=signature(original.atomIds,original.bondIds);
      if(seen.has(key) || symmetry.mappings.some(map=>signature(original.atomIds.map(id=>map.get(id)!),
        original.bondIds.map(([a,b])=>[map.get(a)!,map.get(b)!]))!==key))continue;
      seen.add(key);
      const hasAuthoredParentExplanation=step.title===(language==="en"?"Parent structure":"Estructura principal")
        &&(step.explanation.startsWith("The aromatic ring is the parent because")
          ||step.explanation.startsWith("El anillo aromático es la estructura principal porque"));
      const part={...fragment,additionalFragments:undefined,
        ...(hasAuthoredParentExplanation?{explanation:undefined}:{})};
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
    : `El sustituyente tiene estructura –CH₂–CH(CH₃)₂; su numeración interna comienza en el punto de unión al anillo y es independiente del C2 de la estructura principal.`;
  add(substituentStep,"name:2-methylpropyl",alkylLabel,"substituent",{atomIds:alkyl.atomIds,bondIds:[...internalBonds,alkylAttachment]},internalC2?[[internalC2,2]]:[]);
  substituentStep.explanation=explanation;
  numberingStep.explanation=language === "en" ? "Parent C2, phenyl C1/C4, and substituent C2 belong to independent numbering systems."
    : "El C2 de la estructura principal, los C1/C4 del fenilo y el C2 del sustituyente pertenecen a sistemas de numeración independientes.";
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

function studentStructuralLabel(component: StructuralComponent, language: AppLanguage) {
  const en = language === "en";
  const labels: Partial<Record<StructuralComponent["kind"], string>> = en ? {
    carboxylicAcid: "Carboxyl group", ester: "Ester group", amide: "Amide group", carbonyl: "Carbonyl group",
    hydroxyl: "Hydroxy group", ringSystem: "Ring system", stereo: "Stereogenic centre", "N-bound methyl": "N-methyl group",
    "phenoxy fragment": "Phenoxy group", "substituted phenoxy fragment": "Substituted phenoxy group", "methoxy fragment": "Methoxy group",
    "amine fragment": "Amine group", "trifluoromethyl group": "Trifluoromethyl group", "ether linkage": "Ether linkage",
    "benzyl fragment": "Benzyl group", "carbohydrate backbone": "Carbohydrate chain", "ring oxygen": "Ring oxygen",
    hemiacetal: "Hemiacetal group", hemiketal: "Hemiketal group", "configurational reference": "Configurational reference",
    "anomeric centre": "Anomeric centre", "candidate carbon skeleton": "Carbon chain",
    "aromatic ring locant": "Aromatic ring substituent", "aromatic substituent fragment": "Aromatic substituent",
    "connected fragment": "Connected substituent",
  } : {
    carboxylicAcid: "Grupo carboxilo", ester: "Grupo éster", amide: "Grupo amida", carbonyl: "Grupo carbonilo",
    hydroxyl: "Grupo hidroxilo", ringSystem: "Sistema de anillos", stereo: "Centro estereogénico", "N-bound methyl": "Grupo N-metilo",
    "phenoxy fragment": "Grupo fenoxi", "substituted phenoxy fragment": "Grupo fenoxi sustituido", "methoxy fragment": "Grupo metoxi",
    "amine fragment": "Grupo amina", "trifluoromethyl group": "Grupo trifluorometilo", "ether linkage": "Enlace éter",
    "benzyl fragment": "Grupo bencilo", "carbohydrate backbone": "Cadena de carbohidrato", "ring oxygen": "Oxígeno del anillo",
    hemiacetal: "Grupo hemiacetal", hemiketal: "Grupo hemicetal", "configurational reference": "Referencia configuracional",
    "anomeric centre": "Centro anomérico", "candidate carbon skeleton": "Cadena de carbonos",
    "aromatic ring locant": "Sustituyente del anillo aromático", "aromatic substituent fragment": "Sustituyente aromático",
    "connected fragment": "Sustituyente conectado",
  };
  if (component.kind === "connected fragment") {
    const raw = structuralFragmentLabel(component, language);
    if (/CF3-substituted aryl ether/i.test(raw) || /éter arílico con CF3/i.test(raw))
      return en ? "Aryl ether branch with trifluoromethyl" : "Rama de éter arílico con trifluorometilo";
    if (/Aryl ether branch/i.test(raw) || /Rama de éter arílico/i.test(raw))
      return en ? "Aryl ether branch" : "Rama de éter arílico";
    if (/Aromatic branch/i.test(raw) || /Rama aromática/i.test(raw))
      return en ? "Phenyl branch" : "Rama fenilo";
    if (/Nitrogen-containing (?:branch|fragment)/i.test(raw) || /(?:Rama nitrogenada|Fragmento con nitrógeno)/i.test(raw))
      return en ? "Nitrogen-containing fragment (C–N bond)" : "Fragmento con nitrógeno (enlace C–N)";
    if (/Acyclic carbon fragment/i.test(raw) || /Fragmento carbonado acíclico/i.test(raw))
      return en ? "Carbon branch" : "Rama carbonada";
    return undefined;
  }
  if (component.kind === "aromatic ring locant")
    return language === "en" ? component.displayLabel ?? "Aromatic ring substituent"
      : component.displayLabelEs ?? "Sustituyente del anillo aromático";
  if (component.kind === "ringSystem") {
    const raw = structuralFragmentLabel(component, language);
    if (/Benzene ring|Anillo bencénico/i.test(raw)) return raw;
    return language === "en"
      ? /Aromatic/i.test(raw) ? "Aromatic ring" : "Ring system"
      : /Aromatic|aromático/i.test(raw) ? "Anillo aromático" : "Sistema de anillos";
  }
  if (component.kind === "amine fragment") {
    const raw = structuralFragmentLabel(component, language);
    const match = raw.match(/(primary|secondary|tertiary)/i) ?? raw.match(/(primaria|secundaria|terciaria)/i);
    if (match) return en ? `${match[1]![0]!.toUpperCase()}${match[1]!.slice(1)} amine` : `Amina ${match[1]!.toLowerCase()}`;
  }
  if (component.kind === "substituted phenoxy fragment" || component.kind === "phenoxy fragment"
    || component.kind === "aromatic substituent fragment") {
    const raw = structuralFragmentLabel(component, language);
    const ringIndex = raw.match(/^(?:Ring|Anillo)\s+(\d+):/i)?.[1];
    const prefix = ringIndex ? `${en ? "Ring" : "Anillo"} ${ringIndex}: ` : "";
    if (component.kind === "phenoxy fragment") return `${prefix}${en ? "Phenoxy group" : "Grupo fenoxi"}`;
    if (component.nomenclature) return `${prefix}${component.nomenclature[en ? "name" : "nameEs"]}`;
    if (component.kind === "substituted phenoxy fragment") return `${prefix}${en ? "Substituted phenoxy group" : "Grupo fenoxi sustituido"}`;
  }
  return labels[component.kind] ?? (component.kind === "fragment connection" ? undefined : structuralLabel(component, language));
}

function studentStructuralExplanation(component: StructuralComponent, language: AppLanguage, derivation: StructuralDerivation,
  graph?: GeneratedMolecule) {
  const en = language === "en";
  const child = component.parentComponentId
    ? derivation.components.find(candidate => candidate.id === component.parentComponentId) : undefined;
  const childName = studentStructuralLabel(component, language);
  const containerName = child ? studentStructuralLabel(child, language) : undefined;
  if (component.kind === "phenoxy fragment" && component.nomenclature) return en
    ? "The aromatic ring joins the carbon chain through an ether oxygen, forming a phenoxy group. The attachment carbon is ring C1."
    : "El anillo aromático se une a la cadena de carbonos mediante un oxígeno éter y forma un grupo fenoxi. El carbono de unión es C1 del anillo.";
  if (component.nomenclature) {
    const local = component.nomenclature;
    const connection = local.connection === "phenoxy" ? (en ? "through an ether oxygen" : "mediante un oxígeno éter")
      : local.connection === "benzyl" ? (en ? "through a methylene group" : "mediante un grupo metileno")
      : local.connection === "phenylamino" ? (en ? "through an –NH– group" : "mediante un grupo –NH–")
      : (en ? "directly through a ring carbon" : "directamente mediante un carbono del anillo");
    const locants = local.substituents.map(item => `C${item.position} ${language === "en" ? item.name : item.nameEs}`);
    const parentLocant = local.parentAttachmentLocant;
    const localNumbering = locants.length
      ? en
        ? `Numbering starts at the ring attachment as C1; the lowest locant set places the ring substituents at ${locants.join(", ")}.`
        : `La numeración comienza en el punto de unión del anillo como C1; el conjunto más bajo sitúa los sustituyentes en ${locants.join(", ")}.`
      : en ? "The ring attachment is C1." : "El punto de unión corresponde a C1 del anillo.";
    const parent = parentLocant === undefined ? "" : en
      ? ` It joins the identified carbon chain at C${parentLocant}.`
      : ` Se une a la cadena de carbonos identificada en C${parentLocant}.`;
    const result = en
      ? `${local.name} is used because this ring connects to the rest of the molecule ${connection}. ${localNumbering}${parent}`
      : `Se usa ${local.nameEs} porque este anillo se conecta con el resto de la molécula ${connection}. ${localNumbering}${parent}`;
    return result;
  }

  let explanation: string;
  switch (component.kind) {
    case "carboxylicAcid": explanation = en ? "The C(=O)–OH arrangement is a carboxyl group." : "La estructura C(=O)–OH corresponde a un grupo carboxilo."; break;
    case "ester": explanation = en ? "The C(=O)–O–C arrangement identifies an ester linkage." : "La estructura C(=O)–O–C identifica un enlace éster."; break;
    case "amide": explanation = en ? "The C(=O)–N arrangement identifies an amide." : "La estructura C(=O)–N identifica una amida."; break;
    case "carbonyl": explanation = en ? "The C=O bond forms a carbonyl group." : "El enlace C=O forma un grupo carbonilo."; break;
    case "hydroxyl": explanation = en ? "This C–OH group is a hydroxyl group." : "Este grupo C–OH es un grupo hidroxilo."; break;
    case "ringSystem": {
      const raw = structuralFragmentLabel(component, language);
      const external=raw.match(/external bonds (.+)$/i)?.[1]??raw.match(/enlaces externos (.+)$/i)?.[1];
      explanation = en
        ? external ? `The ring has external bonds ${external}; the element pairs show the different attachments.`
          : /attached through O/i.test(raw) ? "The benzene ring connects to the rest of the structure through an ether oxygen (C–O)."
          : /direct C–C attachment/i.test(raw) ? "A direct C–C bond connects the benzene ring to the rest of the structure."
          : /C–O attachment/i.test(raw) ? "The ring connects to the rest of the structure through a C–O bond."
          : /Aromatic/i.test(raw) ? "This is an aromatic ring." : "These atoms form a ring system."
        : external ? `El anillo presenta enlaces externos ${external}; los pares de elementos muestran las distintas conexiones.`
          : /unido por O/i.test(raw) ? "El anillo bencénico se conecta con el resto de la estructura mediante un oxígeno éter (C–O)."
          : /unión directa C–C/i.test(raw) ? "Un enlace C–C directo conecta el anillo bencénico con el resto de la estructura."
          : /unión C–O/i.test(raw) ? "El anillo se conecta con el resto de la estructura mediante un enlace C–O."
          : /Aromático/i.test(raw) ? "Este es un anillo aromático." : "Estos átomos forman un sistema de anillos.";
      break;
    }
    case "candidate carbon skeleton": explanation = en
      ? `This region contains a continuous chain of ${component.atomIds.length} carbon atoms.`
      : `Esta región contiene una cadena continua de ${component.atomIds.length} átomos de carbono.`; break;
    case "connected fragment": {
      const region = new Set(component.atomIds);
      const boundary = component.bondIds.filter(([a, b]) => region.has(a) !== region.has(b));
      const connections = graph ? [...new Set(boundary.map(([a, b]) => {
        const inside = region.has(a) ? a : b, outside = region.has(a) ? b : a;
        const left = graph.atoms.find(atom => atom.id === inside)?.element ?? "C";
        const right = graph.atoms.find(atom => atom.id === outside)?.element ?? "C";
        return `${left}–${right}`;
      }))] : [];
      explanation = en
        ? `This ${childName?.toLowerCase() ?? "branch"} attaches to the carbon chain${connections.length ? ` through ${connections.join(" and ")}` : ""}.`
        : `Esta ${childName?.toLowerCase() ?? "rama"} se une a la cadena de carbonos${connections.length ? ` mediante ${connections.join(" y ")}` : ""}.`;
      break;
    }
    case "amine fragment": explanation = en ? `The nitrogen has the bonds of a ${childName?.toLowerCase() ?? "amine"}.` : `El nitrógeno presenta los enlaces propios de una ${childName?.toLowerCase() ?? "amina"}.`; break;
    case "N-bound methyl": explanation = en ? "A methyl group is bonded directly to the nitrogen atom." : "Un grupo metilo está unido directamente al nitrógeno."; break;
    case "trifluoromethyl group": explanation = en ? "This carbon is bonded to three fluorine atoms, forming a trifluoromethyl group (–CF₃)." : "Este carbono está unido a tres átomos de flúor y forma un grupo trifluorometilo (–CF₃)."; break;
    case "ether linkage": explanation = en ? "The C–O–C arrangement is an ether linkage." : "La estructura C–O–C es un enlace éter."; break;
    case "benzyl fragment": explanation = en ? "The aromatic ring connects through a methylene group (–CH₂–)." : "El anillo aromático se conecta mediante un grupo metileno (–CH₂–)."; break;
    case "phenoxy fragment": explanation = en ? "The aromatic ring connects to the rest of the molecule through an ether oxygen; this is a phenoxy group." : "El anillo aromático se conecta con el resto de la molécula mediante un oxígeno éter; es un grupo fenoxi."; break;
    case "substituted phenoxy fragment": explanation = en ? "This phenoxy group carries the aromatic substituents shown in the controls." : "Este grupo fenoxi contiene los sustituyentes aromáticos indicados en los controles."; break;
    case "methoxy fragment": explanation = en ? "The oxygen joins the aromatic ring to a methyl group, forming methoxy." : "El oxígeno une el anillo aromático con un grupo metilo y forma metoxi."; break;
    case "stereo": explanation = en ? `The molecular structure specifies configuration ${component.evidence.match(/\b([RS])\b/)?.[1] ?? ""} at this centre.` : `La estructura molecular especifica la configuración ${component.evidence.match(/\b([RS])\b/)?.[1] ?? ""} en este centro.`; break;
    case "aromatic ring locant": explanation = en ? "This ring position carries the indicated substituent." : "Esta posición del anillo lleva el sustituyente indicado."; break;
    case "aromatic substituent fragment": explanation = en ? "The aromatic substituent and its internal positions are shown here." : "Aquí se muestra el sustituyente aromático y sus posiciones internas."; break;
    case "carbohydrate backbone": explanation = en ? `The structure contains a ${component.atomIds.length}-carbon carbohydrate chain.` : `La estructura contiene una cadena de carbohidrato de ${component.atomIds.length} carbonos.`; break;
    case "ring oxygen": explanation = en ? "This oxygen is part of the ring." : "Este oxígeno forma parte del anillo."; break;
    case "hemiacetal": explanation = en ? "This carbon is bonded to the ring oxygen and a hydroxyl group." : "Este carbono está unido al oxígeno del anillo y a un grupo hidroxilo."; break;
    case "hemiketal": explanation = en ? "This carbon is bonded to the ring oxygen and a hydroxyl group." : "Este carbono está unido al oxígeno del anillo y a un grupo hidroxilo."; break;
    case "anomeric centre": explanation = en ? "The marked carbon is the anomeric centre." : "El carbono señalado es el centro anomérico."; break;
    case "configurational reference": explanation = en ? "This centre sets the configurational reference for the carbohydrate." : "Este centro establece la referencia configuracional del carbohidrato."; break;
    case "fragment connection": return "";
    default: explanation = en ? "This part of the structure is identified in the molecule." : "Esta parte de la estructura se identifica en la molécula.";
  }
  if (component.kind === "ringSystem" || component.kind === "N-bound methyl") return explanation;
  if (component.kind === "trifluoromethyl group" && child?.kind === "substituted phenoxy fragment") {
    const position = child.nomenclature?.substituents.find(item => /trifluoromethyl|trifluorometil/i.test(item.name))?.position;
    if (position !== undefined) return en
      ? `${explanation} It is attached at C${position} of the phenoxy ring.`
      : `${explanation} Se une en C${position} del anillo fenoxi.`;
  }
  if (component.kind === "phenoxy fragment" && child?.kind === "substituted phenoxy fragment") {
    const substituent = child.nomenclature?.substituents.map(item => `C${item.position} ${en ? item.name : item.nameEs}`).join(", ");
    return en
      ? `The phenoxy ring carries ${substituent || "the indicated ring substituent"}.`
      : `El anillo fenoxi lleva ${substituent || "el sustituyente indicado"}.`;
  }
  if (child && childName && containerName) return en
    ? `${explanation} The ${childName.toLowerCase()} is part of the ${containerName.toLowerCase()}.`
    : `${explanation} El ${childName.toLowerCase()} forma parte del ${containerName.toLowerCase()}.`;
  return explanation;
}

/** Presents only chemical features established by structural evidence. It does
 * not turn a structural region into a verified name component or parent. */
export function buildStructuralPriorityReasoning(input: { derivation: StructuralDerivation; language: AppLanguage;
  parentSelection?: ParentSelectionEvidence; graph?:GeneratedMolecule }): PriorityReasoningModel {
  const { derivation, language } = input;
  const ranks: Record<StructuralComponent["kind"], number> = {
    carboxylicAcid: 0, ester: 0, amide: 0, carbonyl: 0, hydroxyl: 0,
    "candidate carbon skeleton": 1, "carbohydrate backbone": 1,
    ringSystem: 2, "connected fragment": 3,
    "phenoxy fragment": 3, "methoxy fragment": 3, "substituted phenoxy fragment": 4,
    "fragment connection": 9, "amine fragment": 1, "trifluoromethyl group": 1, "ether linkage": 1, "benzyl fragment": 3,
    "N-bound methyl": 4, "ring oxygen": 4, hemiacetal: 4, hemiketal: 4,
    "aromatic substituent fragment": 3, "aromatic ring locant": 4,
    "configurational reference": 5, "anomeric centre": 5, stereo: 5,
  };
  const studentComponents = derivation.components.filter(component => component.kind !== "fragment connection"
    && studentStructuralLabel(component, language) !== undefined);
  const kinds = [...new Set(studentComponents.map(component => component.kind))]
    .sort((a, b) => ranks[a] - ranks[b] || a.localeCompare(b));
  const steps = kinds.map((kind, index): PriorityReasoningStep => {
    const number = String(index + 1).padStart(2, "0"), group = studentComponents.filter(component => component.kind === kind);
    const labelFor = (component: StructuralComponent) => {
      const base = studentStructuralLabel(component, language) ?? structuralFragmentLabel(component, language);
      const peers = group.filter(item => studentStructuralLabel(item, language) === base);
      if (peers.length < 2) return base;
      return `${base} · ${peers.indexOf(component) + 1}`;
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
    const signature = (component: StructuralComponent) => JSON.stringify([
      [...component.atomIds].sort((a, b) => a - b), component.bondIds.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`).sort(),
    ]);
    const uniqueGroup = group.filter((component, position) => group.findIndex(other => signature(other) === signature(component)) === position);
    const componentText = (component: StructuralComponent) => studentStructuralExplanation(component, language, derivation, input.graph);
    const explanation = uniqueGroup.length === 1 ? componentText(uniqueGroup[0])
      : uniqueGroup.map(component => `${labelFor(component)}: ${componentText(component)}`).join(" ");
    const visibleGroup = uniqueGroup;
    const visibleFragments = fragments.filter(fragment => visibleGroup.some(component => component.id === fragment.semanticId
      || component.nestedSelections?.some(selection => `${component.id}:${selection.id}` === fragment.semanticId)));
    const targets = visibleGroup.map(component => ({ stepNumber: number, atomIds: component.atomIds,
      bondIds: component.bondIds, locants: component.numbering ?? [] }));
    const visibleTargets = Object.fromEntries(Object.entries(fragmentTargets).filter(([fragmentId]) => {
      const semanticId = fragments.find(fragment => reasoningFragmentId(number, fragment) === fragmentId)?.semanticId;
      return visibleFragments.some(fragment => fragment.semanticId === semanticId);
    }));
    return { number, title: studentStructuralLabel(visibleGroup[0], language) ?? structuralLabel(visibleGroup[0], language), explanation,
      target: unionTarget(number, targets),
      fragments: visibleFragments[0] ? { ...visibleFragments[0], additionalFragments: visibleFragments.slice(1) } : undefined,
      fragmentTargets: visibleTargets, componentIds: visibleGroup.map(component => component.id), componentKind: kind, source: "structural" };
  });
  if (input.parentSelection) {
    const evidence = input.parentSelection;
    const sameRegion = (left: readonly number[], right: readonly number[]) => left.length === right.length
      && left.every(id => right.includes(id));
    const matchingStep = steps.find(step => derivation.components.some(component => step.componentIds.includes(component.id)
      && evidence.candidates.some(item => sameRegion(item.atomIds, component.atomIds))));
    if (matchingStep) matchingStep.parentSelectionEvidence = evidence;
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
  const chainLabel=en?"Propan-1-amine chain":"Cadena de propan-1-amina";
  const phenylLabel=en?`${parentLocant}-phenyl substituent`:`Sustituyente ${parentLocant}-fenil`;
  const phenoxyName=phenoxy.nomenclature![en?"name":"nameEs"];
  const phenoxyLabel=en?`${parentLocant}-[${phenoxyName}] substituent`:`Sustituyente ${parentLocant}-[${phenoxyName}]`;
  const internalLocant=ringLocant.numbering?.[0]?.[1];
  const citedOrder=orderGroups.map(group=>group.cited).join(", ");
  const explanation=en
    ? `The three-carbon chain is numbered from the end attached to the amine, giving propan-1-amine. N-methyl is attached to nitrogen; phenyl and ${phenoxyName} attach at C${parentLocant}. The prefixes are cited alphabetically by their complete names: ${citedOrder}. Ring C${internalLocant} is an internal locant of the phenoxy substituent, separate from parent C${parentLocant}. Parentheses enclose the trifluoromethyl part, and square brackets enclose the complete phenoxy substituent.`
    : `La cadena de tres carbonos se numera desde el extremo unido a la amina y da propan-1-amina. El grupo N-metil se une al nitrógeno; fenil y ${phenoxyName} se unen en C${parentLocant}. Los prefijos se citan alfabéticamente por sus nombres completos: ${citedOrder}. C${internalLocant} es un localizador interno del sustituyente fenoxi y se distingue del C${parentLocant} de la cadena. Los paréntesis encierran el grupo trifluorometil y los corchetes delimitan el sustituyente fenoxi completo.`;
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
