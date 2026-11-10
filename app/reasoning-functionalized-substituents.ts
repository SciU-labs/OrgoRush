import type { GeneratedMolecule } from "./name-to-molecule";
import type { AppLanguage } from "./i18n";
import { translateSpanishIupacForDisplay } from "./iupac-name-normalization.ts";
import { inspectHydroxyalkyl, inspectAminoalkyl, inspectOxoalkyl,
  type HydroxyalkylEvidence, type AminoalkylEvidence, type OxoalkylEvidence } from "./hydroxyalkyl-substituent.ts";
import type { ReasoningNameEvidence, ReasoningNameFragment } from "./reasoning-name-fragments";

type Group = { id: string; kind: string; carbonId: number; heteroAtomId: number; atomIds: number[] };
type Substituent = { name: string; locant: number; atomIds: number[];
  hydroxyAlkyl?: HydroxyalkylEvidence; aminoAlkyl?: AminoalkylEvidence; oxoAlkyl?: OxoalkylEvidence };
type Analysis = { name: string; chainName: string; mainChain: number[]; primaryFunctionalGroup?: string;
  functionalGroups: Group[]; substituents: Substituent[] };
type Span = { start: number; end: number };
export type ParenthesizedScope = { span: Span; children: ParenthesizedScope[] };
type BranchProof = HydroxyalkylEvidence | AminoalkylEvidence | OxoalkylEvidence;
type BranchRecord = { item: Substituent; proof: BranchProof; role: "hydroxy" | "amino" | "oxo";
  group: { groupId: string; carbonId: number; oxygenId?: number; nitrogenId?: number; locant: number };
  prefix: string; scope: Span; inner: string; parentLocant: string };

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

/** Build graph-backed evidence for one supported branch or a distinct hydroxy/amino pair. */
export function functionalizedBranchFragments(input: { molecule: GeneratedMolecule; analysis: Analysis;
  name: string; language: AppLanguage; steps: readonly {number:string; nameRole?:string}[] }): Record<string, ReasoningNameFragment> | null {
  const {molecule,analysis,name,language,steps}=input;
  if (name !== (language === "en" ? translateSpanishIupacForDisplay(analysis.name) : analysis.name)) return null;
  const branches=analysis.substituents.filter(item=>item.hydroxyAlkyl || item.aminoAlkyl || item.oxoAlkyl);
  const scopes=parseParenthesizedScopes(name);
  const roles=branches.map(item=>item.hydroxyAlkyl?"hydroxy":item.aminoAlkyl?"amino":item.oxoAlkyl?"oxo":"");
  if (!scopes || scopes.some(scope=>scope.children.length) || branches.length!==scopes.length
    || ![1,2].includes(branches.length)
    || branches.length===2 && (roles.filter(role=>role==="hydroxy").length!==1
      || roles.filter(role=>role==="amino").length!==1 || roles.includes("oxo"))) return null;

  const records: (BranchRecord|null)[]=branches.map(item=>{
    if ([item.hydroxyAlkyl,item.aminoAlkyl,item.oxoAlkyl].filter(Boolean).length!==1) return null;
    const proof:BranchProof=item.hydroxyAlkyl??item.aminoAlkyl??item.oxoAlkyl!;
    const rebuilt=item.hydroxyAlkyl
      ? inspectHydroxyalkyl(molecule,analysis.mainChain,proof.parentAtomId,proof.rootAtomId,analysis.functionalGroups)
      : item.aminoAlkyl
        ? inspectAminoalkyl(molecule,analysis.mainChain,proof.parentAtomId,proof.rootAtomId,analysis.functionalGroups)
        : inspectOxoalkyl(molecule,analysis.mainChain,proof.parentAtomId,proof.rootAtomId,analysis.functionalGroups);
    if (!rebuilt || JSON.stringify(rebuilt)!==JSON.stringify(proof) || analysis.mainChain[item.locant-1]!==proof.parentAtomId) return null;
    const role= item.hydroxyAlkyl ? "hydroxy" : item.aminoAlkyl ? "amino" : "oxo";
    const group=item.hydroxyAlkyl?.hydroxy ?? item.aminoAlkyl?.amino ?? item.oxoAlkyl!.oxo;
    const prefix=role==="hydroxy" ? language==="en"?"hydroxy":"hidroxi" : role;
    const translated=language==="en" ? translateSpanishIupacForDisplay(item.name) : item.name;
    const matches=scopes.flatMap(scope=>{
      const inner=name.slice(scope.span.start+1,scope.span.end-1), parentMatch=/([0-9]+)-$/.exec(name.slice(0,scope.span.start));
      return inner===translated && parentMatch && Number(parentMatch[1])===item.locant
        ? [{scope:scope.span,inner,parentLocant:parentMatch[1]}] : [];
    });
    if(matches.length!==1) return null;
    const match=matches[0];
    if(!match.inner.startsWith(`${group.locant}-${prefix}`) || !match.inner.slice(`${group.locant}-${prefix}`.length)) return null;
    return {item,proof,role,group,prefix,...match};
  });
  if(records.some(record=>!record)) return null;
  const ordered=(records as BranchRecord[]).sort((a,b)=>a.scope.start-b.scope.start);
  if(new Set(ordered.map(record=>record.item)).size!==branches.length
    || new Set(ordered.map(record=>`${record.proof.parentAtomId}:${record.proof.rootAtomId}`)).size!==branches.length
    || new Set(ordered.flatMap(record=>record.proof.atomIds)).size!==ordered.reduce((n,record)=>n+record.proof.atomIds.length,0)) return null;
  const first=ordered[0], {item,proof}=first;
  const chain=language==="en" ? translateSpanishIupacForDisplay(analysis.chainName) : analysis.chainName;
  const fullParent=chain.replace(/^ácido /,"");
  const parentStart=name.lastIndexOf(fullParent);
  if(parentStart<ordered.at(-1)!.scope.end || parentStart+fullParent.length!==name.length) return null;
  const principal=analysis.functionalGroups.filter(g=>g.kind===analysis.primaryFunctionalGroup && analysis.mainChain.includes(g.carbonId));
  if(principal.length!==1 || !["carboxylicAcid","aldehyde","ketone"].includes(analysis.primaryFunctionalGroup??"")) return null;
  const principalKind=analysis.primaryFunctionalGroup!;
  const suffix=principalKind==="carboxylicAcid" ? language==="en"?"oic acid":"oico"
    : principalKind==="aldehyde" ? "al" : language==="en"?"one":"ona";
  if(!fullParent.endsWith(suffix)) return null;
  const ketoneLocant=principalKind==="ketone" ? /-(\d+)-(?:ona|one)$/.exec(fullParent) : null;
  if(principalKind==="ketone" && (!ketoneLocant || analysis.mainChain[Number(ketoneLocant[1])-1]!==principal[0].carbonId)) return null;
  if(principalKind==="aldehyde" && analysis.mainChain[0]!==principal[0].carbonId) return null;
  const carbonyl=molecule.bonds.filter(([a,b,order])=>order===2
    && (a===principal[0].carbonId&&b===principal[0].heteroAtomId || b===principal[0].carbonId&&a===principal[0].heteroAtomId));
  if(carbonyl.length!==1) return null;
  const parentText=ketoneLocant ? fullParent.slice(0,ketoneLocant.index) : fullParent.slice(0,-suffix.length);
  if(!parentText) return null;
  const step=(role:string)=>steps.find(s=>s.nameRole===role)?.number;
  const parentStep=step("parent"),numberStep=step("numbering"),subStep=step("substituent"),functionStep=step("function");
  if(!parentStep||!numberStep||!subStep||!functionStep) return null;
  const bondsWithin=(ids:readonly number[])=>molecule.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b] as const);
  const target=(atoms:readonly number[],bonds:readonly (readonly [number,number])[]=[],locants:readonly (readonly [number,number])[]=[])=>(
    {atomIds:atoms,bondIds:bonds,locants});
  const en=language==="en", labels={parent:en?"Parent chain":"Cadena principal",complete:en?"Complete substituent":"Sustituyente completo",
    anchor:en?"Parent attachment locant":"Localizador de unión en el progenitor",local:en?"Substituent internal locant":"Localizador interno del sustituyente",
    function:en?"Secondary functional group":"Función secundaria",skeleton:en?"Substituent carbon skeleton":"Esqueleto carbonado del sustituyente"};
  const part=(text:string,start:number,kind:ReasoningNameEvidence["kind"],key:string,label:string,
    explicitTarget:NonNullable<ReasoningNameEvidence["explicitTarget"]>,contextProof:BranchProof=proof,contextItem:Substituent=item,
    semanticPrefix="functionalized"):ReasoningNameFragment=>({text,start,kind,label,semanticId:`${semanticPrefix}:${key}`,
      atomIds:explicitTarget.atomIds,bondIds:explicitTarget.bondIds,explicitTarget,
      structuralContext:{functionKind:key==="principal"||key==="principal-locant"?analysis.primaryFunctionalGroup!
        :key.startsWith("parent-function-")?"alcohol":contextItem.hydroxyAlkyl?"alcohol":contextItem.aminoAlkyl?"amine":contextItem.oxoAlkyl!.oxo.kind,
        numberingScope:key==="parent"||key==="principal"||key==="principal-locant"||key==="parent-locant"||key.startsWith("parent-function-")?"parent":"substituent",
        attachment:[contextProof.parentAtomId,contextProof.rootAtomId],
        ...(key==="parent-locant"?{locant:contextItem.locant}:key==="principal-locant"?{locant:Number(ketoneLocant![1])}
          :key.startsWith("branch-locant")?{locant:contextProof.internalBranches[Number(key.split("-").at(-1)) - 1]?.locant
            ?? contextProof.internalBranches[0]?.locant}
          :key==="local-locant"||key==="function"?{locant:contextItem.hydroxyAlkyl?.hydroxy.locant??contextItem.aminoAlkyl?.amino.locant??contextItem.oxoAlkyl!.oxo.locant}:{})}});
  const parentTextStart=parentStart;
  const parentPart=part(parentText,parentTextStart,"parent","parent",labels.parent,target(analysis.mainChain,bondsWithin(analysis.mainChain)));
  const locantParts:ReasoningNameEvidence[]=[], completeParts:ReasoningNameFragment[]=[], functionParts:ReasoningNameEvidence[]=[];
  for(let index=0;index<ordered.length;index++){
    const record=ordered[index], {item:branchItem,proof:branchProof,group,scope,inner,parentLocant,prefix}=record;
    const semanticPrefix=ordered.length===1?"functionalized":`functionalized:branch-${index+1}`;
    const parentNumberStart=scope.start-1-parentLocant.length;
    const parentLocantPart=part(parentLocant,parentNumberStart,"numbering","parent-locant",labels.anchor,
      target([branchProof.parentAtomId],[],[[branchProof.parentAtomId,branchItem.locant]]),branchProof,branchItem,semanticPrefix);
    const hetero=group.oxygenId??group.nitrogenId!;
    const groupAtoms=[group.carbonId,hetero], innerStart=scope.start+1, prefixText=`${group.locant}-${prefix}`;
    const localLocant=part(String(group.locant),innerStart,"numbering","local-locant",labels.local,
      target([group.carbonId],[],[[group.carbonId,group.locant]]),branchProof,branchItem,semanticPrefix);
    locantParts.push(parentLocantPart,localLocant);
    const complete=part(name.slice(scope.start,scope.end),scope.start,"substituent","complete",labels.complete,
      target([branchProof.parentAtomId,...branchProof.atomIds],branchProof.bonds.map(([a,b])=>[a,b] as const)),branchProof,branchItem,semanticPrefix);
    const attachment=part("(",scope.start,"substituent","attachment",en?"Bond to the parent":"Enlace al progenitor",
      target([branchProof.parentAtomId,branchProof.rootAtomId],[[branchProof.parentAtomId,branchProof.rootAtomId]]),branchProof,branchItem,semanticPrefix);
    const skeletonText=inner.slice(prefixText.length), skeleton=part(skeletonText,innerStart+prefixText.length,"substituent","skeleton",labels.skeleton,
      target(branchProof.carbonPath,bondsWithin(branchProof.carbonPath)),branchProof,branchItem,semanticPrefix);
    const extraFragments:ReasoningNameFragment[]=[attachment,skeleton];
    const branches=branchProof.internalBranches;
    if(branches.length>2||branches.some(branch=>branch.kind!=="methyl"||branch.atomIds.length!==1)) return null;
    if(branches.length){
      const locants=branches.map(branch=>branch.locant).sort((a,b)=>a-b);
      const multiplier=branches.length===1?"":branches.length===2?"di":"";
      const branchToken=`${locants.join(",")}-${multiplier}${en?"methyl":"metil"}`;
      const at=inner.indexOf(branchToken);
      if(at<0||inner.indexOf(branchToken,at+1)>=0) return null;
      const branchAtoms=[...new Set(branches.flatMap(branch=>[branch.anchorAtomId,...branch.atomIds]))];
      const branchBonds=branches.flatMap(branch=>branch.bonds.map(([a,b])=>[a,b] as const));
      const branchLabel=branches.length===1
        ? en?"Internal methyl branch":"Ramificación metilo interna"
        : en?"Two internal methyl branches":"Dos ramificaciones metilo internas";
      extraFragments.push(part(branchToken,innerStart+at,"substituent","internal-branch",branchLabel,
        target(branchAtoms,branchBonds),branchProof,branchItem,semanticPrefix));
      let offset=0;
      if(branches.length===2&&locants[0]===locants[1]){
        const span=locants.join(",");
        locantParts.push(part(span,innerStart+at,"numbering","branch-locant",
          en?"Equivalent internal methyl locants":"Localizadores equivalentes de metilo interno",
          target([...new Set(branches.map(branch=>branch.anchorAtomId))],[],[...new Map(branches
            .map(branch=>[`${branch.anchorAtomId}:${branch.locant}`,[branch.anchorAtomId,branch.locant] as const])).values()]),
          branchProof,branchItem,semanticPrefix));
      }else{
        for(let index=0;index<branches.length;index++){
          const branch=branches[index],text=String(branch.locant),numberAt=innerStart+at+offset;
          const key=branches.length===1?"branch-locant":`branch-locant-${index+1}`;
          locantParts.push(part(text,numberAt,"numbering",key,
            branches.length===1
              ? en?"Internal branch locant":"Localizador de la ramificación interna"
              : en?`Internal methyl locant ${index+1}`:`Localizador del metilo interno ${index+1}`,
            target([branch.anchorAtomId],[],[[branch.anchorAtomId,branch.locant]]),branchProof,branchItem,semanticPrefix));
          offset+=text.length+1;
        }
      }
    }
    completeParts.push({...complete,additionalFragments:extraFragments});
    const secondary=part(prefix,innerStart+String(group.locant).length+1,"function","function",labels.function,
      target(groupAtoms,bondsWithin(groupAtoms)),branchProof,branchItem,semanticPrefix);
    functionParts.push(secondary);
  }
  const principalLocant=ketoneLocant?part(ketoneLocant[1],parentStart+ketoneLocant.index+1,"numbering","principal-locant",
    en?"Principal carbonyl locant":"Localizador del carbonilo principal",target([principal[0].carbonId],[],[[principal[0].carbonId,Number(ketoneLocant[1])]])):undefined;
  const suffixStart=name.lastIndexOf(suffix);
  if(suffixStart<parentStart) return null;
  const primaryLabel=principalKind==="carboxylicAcid"?en?"Principal carboxyl group":"Grupo carboxilo principal"
    :principalKind==="aldehyde"?en?"Principal aldehyde":"Aldehído principal":en?"Principal ketone":"Cetona principal";
  const primary=part(suffix,suffixStart,"function","principal",primaryLabel,target(principal[0].atomIds,bondsWithin(principal[0].atomIds)));
  const extra:ReasoningNameEvidence[]=[];
  for(const other of analysis.substituents.filter(sub=>!branches.includes(sub))){
    const groupOnParent=analysis.functionalGroups.find(g=>g.kind==="alcohol"&&analysis.mainChain[other.locant-1]===g.carbonId
      &&g.atomIds.every(id=>other.atomIds.includes(id)));
    if(!groupOnParent||other.name!=="hidroxi") return null;
    const token=`${other.locant}-${en?"hydroxy":"hidroxi"}`,pos=name.indexOf(token);
    if(pos<0||pos>=ordered[0].scope.start) return null;
    extra.push(part(token,pos,"function",`parent-function-${other.locant}`,en?"Hydroxyl on parent":"Hidroxilo del progenitor",
      target(groupOnParent.atomIds,bondsWithin(groupOnParent.atomIds))));
  }
  const completeBase=completeParts[0];
  const secondaryParts=completeParts.flatMap((complete,index)=>index===0?[...(complete.additionalFragments??[])]:[complete,...(complete.additionalFragments??[])]);
  return {[parentStep]:parentPart,[numberStep]:{...locantParts[0],additionalFragments:[...locantParts.slice(1),...(principalLocant?[principalLocant]:[])]},
    [subStep]:{...completeBase,additionalFragments:secondaryParts},
    [functionStep]:{...primary,additionalFragments:[...functionParts,...extra]}};
}
