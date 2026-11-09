import type { GeneratedMolecule } from "./name-to-molecule";
import type { AppLanguage } from "./i18n";
import { translateSpanishIupacForDisplay } from "./iupac-name-normalization.ts";
import { inspectHydroxyalkyl, inspectAminoalkyl, inspectOxoalkyl,
  type HydroxyalkylEvidence, type AminoalkylEvidence, type OxoalkylEvidence } from "./hydroxyalkyl-substituent.ts";
import type { ReasoningNameEvidence, ReasoningNameFragment } from "./reasoning-name-fragments";

type Group = { id: string; kind: string; carbonId: number; heteroAtomId: number; atomIds: number[] };
type Analysis = { name: string; chainName: string; mainChain: number[]; primaryFunctionalGroup?: string;
  functionalGroups: Group[]; substituents: { name: string; locant: number; atomIds: number[];
    hydroxyAlkyl?: HydroxyalkylEvidence; aminoAlkyl?: AminoalkylEvidence; oxoAlkyl?: OxoalkylEvidence }[] };
type Span = { start: number; end: number };
export type ParenthesizedScope = { span: Span; children: ParenthesizedScope[] };

/** Preserve nesting and literal offsets; unsupported nested content is not flattened. */
export function parseParenthesizedScopes(name: string): ParenthesizedScope[] | null {
  const roots: ParenthesizedScope[] = [], stack: { start: number; children: ParenthesizedScope[] }[] = [];
  for (let i=0;i<name.length;i++) {
    if (name[i] === "(") stack.push({start:i,children:[]});
    else if (name[i] === ")") {
      const node=stack.pop(); if (!node) return null;
      const completed={span:{start:node.start,end:i+1},children:node.children};
      if (stack.length) stack[stack.length-1].children.push(completed);
      else roots.push(completed);
    }
  }
  return stack.length ? null : roots;
}

/** Build only complete, single-branch evidence; all atoms come from the current graph. */
export function functionalizedBranchFragments(input: { molecule: GeneratedMolecule; analysis: Analysis;
  name: string; language: AppLanguage; steps: readonly {number:string; nameRole?:string}[] }): Record<string, ReasoningNameFragment> | null {
  const {molecule,analysis,name,language,steps}=input;
  if (name !== (language === "en" ? translateSpanishIupacForDisplay(analysis.name) : analysis.name)) return null;
  const branches=analysis.substituents.filter(item=>item.hydroxyAlkyl || item.aminoAlkyl || item.oxoAlkyl);
  const scopes=parseParenthesizedScopes(name);
  if (branches.length !== 1 || !scopes || scopes.length !== 1 || scopes[0].children.length) return null;
  const item=branches[0], proof=item.hydroxyAlkyl ?? item.aminoAlkyl ?? item.oxoAlkyl!;
  const rebuilt=item.hydroxyAlkyl ? inspectHydroxyalkyl(molecule,analysis.mainChain,proof.parentAtomId,proof.rootAtomId,analysis.functionalGroups)
    : item.aminoAlkyl ? inspectAminoalkyl(molecule,analysis.mainChain,proof.parentAtomId,proof.rootAtomId,analysis.functionalGroups)
      : inspectOxoalkyl(molecule,analysis.mainChain,proof.parentAtomId,proof.rootAtomId,analysis.functionalGroups);
  if (!rebuilt || JSON.stringify(rebuilt)!==JSON.stringify(proof)
    || analysis.mainChain[item.locant-1]!==proof.parentAtomId) return null;
  const role=item.hydroxyAlkyl ? "hydroxy" : item.aminoAlkyl ? "amino" : "oxo";
  const group=item.hydroxyAlkyl?.hydroxy ?? item.aminoAlkyl?.amino ?? item.oxoAlkyl!.oxo;
  const hetero="oxygenId" in group ? group.oxygenId : group.nitrogenId;
  const prefix=role === "hydroxy" ? language === "en" ? "hydroxy" : "hidroxi" : role;
  const translated=language === "en" ? translateSpanishIupacForDisplay(item.name) : item.name;
  const scope=scopes[0].span, inner=name.slice(scope.start+1,scope.end-1);
  const startText=`${group.locant}-${prefix}`;
  if (inner!==translated || !inner.startsWith(startText) || !inner.slice(startText.length)) return null;
  const before=name.slice(0,scope.start), parentMatch=/(\d+)-$/.exec(before);
  if (!parentMatch || Number(parentMatch[1])!==item.locant) return null;
  const chain=language === "en" ? translateSpanishIupacForDisplay(analysis.chainName) : analysis.chainName;
  const fullParent=chain.replace(/^ácido /,"");
  const parentStart=name.lastIndexOf(fullParent);
  if (parentStart < scope.end || parentStart + fullParent.length !== name.length) return null;
  const principal=analysis.functionalGroups.filter(g=>g.kind===analysis.primaryFunctionalGroup && analysis.mainChain.includes(g.carbonId));
  if (principal.length!==1 || !["carboxylicAcid","aldehyde","ketone"].includes(analysis.primaryFunctionalGroup ?? "")) return null;
  const principalKind=analysis.primaryFunctionalGroup!;
  const suffix=principalKind === "carboxylicAcid" ? language==="en"?"oic acid":"oico"
    : principalKind === "aldehyde" ? "al" : language === "en" ? "one" : "ona";
  if (!fullParent.endsWith(suffix)) return null;
  const ketoneLocant = principalKind === "ketone" ? /-(\d+)-(?:ona|one)$/.exec(fullParent) : null;
  if (principalKind === "ketone" && (!ketoneLocant
    || analysis.mainChain[Number(ketoneLocant[1])-1] !== principal[0].carbonId)) return null;
  if (principalKind === "aldehyde" && analysis.mainChain[0] !== principal[0].carbonId) return null;
  const carbonyl=molecule.bonds.filter(([a,b,order]) => order===2
    && (a===principal[0].carbonId && b===principal[0].heteroAtomId || b===principal[0].carbonId && a===principal[0].heteroAtomId));
  if (carbonyl.length!==1) return null;
  const parentText=ketoneLocant ? fullParent.slice(0,ketoneLocant.index) : fullParent.slice(0,-suffix.length);
  if (!parentText) return null;
  const step=(role:string)=>steps.find(s=>s.nameRole===role)?.number;
  const parentStep=step("parent"),numberStep=step("numbering"),subStep=step("substituent"),functionStep=step("function");
  if (!parentStep || !numberStep || !subStep || !functionStep) return null;
  const bondsWithin=(ids: readonly number[])=>molecule.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b] as const);
  const target=(atoms:readonly number[], bonds:readonly (readonly [number,number])[]=[], locants:readonly (readonly [number,number])[]=[])=>
    ({atomIds:atoms,bondIds:bonds,locants});
  const part=(text:string,start:number,kind:ReasoningNameEvidence["kind"],key:string,label:string,
    explicitTarget:NonNullable<ReasoningNameEvidence["explicitTarget"]>):ReasoningNameEvidence=>
    ({text,start,kind,label,semanticId:`functionalized:${key}`,atomIds:explicitTarget.atomIds,bondIds:explicitTarget.bondIds,explicitTarget,
      structuralContext:{functionKind:key === "principal" || key === "principal-locant" ? analysis.primaryFunctionalGroup! : key.startsWith("parent-function-") ? "alcohol"
        : item.hydroxyAlkyl ? "alcohol" : item.aminoAlkyl ? "amine" : item.oxoAlkyl!.oxo.kind,
      numberingScope:key === "parent" || key === "principal" || key === "principal-locant" || key === "parent-locant" || key.startsWith("parent-function-") ? "parent" : "substituent",
      attachment:[proof.parentAtomId,proof.rootAtomId],
      ...(key === "parent-locant" ? {locant:item.locant} : key === "principal-locant" ? {locant:Number(ketoneLocant![1])} : key === "local-locant" || key === "function" ? {locant:group.locant} : {})}});
  const en=language==="en", labels={ parent:en?"Parent chain":"Cadena principal", complete:en?"Complete substituent":"Sustituyente completo",
    anchor:en?"Parent attachment locant":"Localizador de unión en el progenitor", local:en?"Substituent internal locant":"Localizador interno del sustituyente",
    function:en?"Secondary functional group":"Función secundaria", skeleton:en?"Substituent carbon skeleton":"Esqueleto carbonado del sustituyente" };
  const branchAtoms=[proof.parentAtomId,...proof.atomIds], branchBonds=proof.bonds.map(([a,b])=>[a,b] as const);
  const functionAtoms=[group.carbonId,hetero];
  const parentNumberStart=scope.start-1-parentMatch[1].length, innerStart=scope.start+1;
  const parentPart=part(parentText,parentStart,"parent","parent",labels.parent,target(analysis.mainChain,bondsWithin(analysis.mainChain)));
  const parentLocant=part(parentMatch[1],parentNumberStart,"numbering","parent-locant",labels.anchor,target([proof.parentAtomId],[],[[proof.parentAtomId,item.locant]]));
  const localLocant=part(String(group.locant),innerStart,"numbering","local-locant",labels.local,target([group.carbonId],[],[[group.carbonId,group.locant]]));
  const principalLocant=ketoneLocant ? part(ketoneLocant[1],parentStart+ketoneLocant.index+1,"numbering","principal-locant",
    en?"Principal carbonyl locant":"Localizador del carbonilo principal",target([principal[0].carbonId],[],[[principal[0].carbonId,Number(ketoneLocant[1])]])) : undefined;
  const complete=part(name.slice(scope.start,scope.end),scope.start,"substituent","complete",labels.complete,target(branchAtoms,branchBonds));
  const attachment=part("(",scope.start,"substituent","attachment",en?"Bond to the parent":"Enlace al progenitor",
    target([proof.parentAtomId,proof.rootAtomId],[[proof.parentAtomId,proof.rootAtomId]]));
  const functional=part(prefix,innerStart+String(group.locant).length+1,"function","function",labels.function,target(functionAtoms,bondsWithin(functionAtoms)));
  const skeletonText=inner.slice(startText.length), skeletonStart=innerStart+startText.length;
  const skeleton=part(skeletonText,skeletonStart,"substituent","skeleton",labels.skeleton,target(proof.carbonPath,bondsWithin(proof.carbonPath)));
  const suffixStart=name.lastIndexOf(suffix);
  if (suffixStart<parentStart) return null;
  const primaryLabel=principalKind === "carboxylicAcid" ? en?"Principal carboxyl group":"Grupo carboxilo principal"
    : principalKind === "aldehyde" ? en?"Principal aldehyde":"Aldehído principal" : en?"Principal ketone":"Cetona principal";
  const primary=part(suffix,suffixStart,"function","principal",primaryLabel,target(principal[0].atomIds,bondsWithin(principal[0].atomIds)));
  // Other named functions directly on the parent keep their own graph target.
  const extra:ReasoningNameEvidence[]=[];
  for (const other of analysis.substituents.filter(s=>s!==item)) {
    const groupOnParent=analysis.functionalGroups.find(g=>g.kind==="alcohol" && analysis.mainChain[other.locant-1]===g.carbonId
      && g.atomIds.every(id=>other.atomIds.includes(id)));
    if (!groupOnParent || other.name!=="hidroxi") return null;
    const token=`${other.locant}-${en?"hydroxy":"hidroxi"}`, pos=name.indexOf(token);
    if (pos<0 || pos>=scope.start) return null;
    extra.push(part(token,pos,"function",`parent-function-${other.locant}`,en?"Hydroxyl on parent":"Hidroxilo del progenitor",target(groupOnParent.atomIds,bondsWithin(groupOnParent.atomIds))));
  }
  return { [parentStep]:parentPart, [numberStep]:{...parentLocant,additionalFragments:[localLocant,...(principalLocant?[principalLocant]:[])]},
    [subStep]:{...complete,additionalFragments:[attachment,skeleton]}, [functionStep]:{...primary,additionalFragments:[functional,...extra]} };
}
