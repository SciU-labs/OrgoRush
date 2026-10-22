import { generateLegacyEnglishName, resolveFunctionalHierarchy, type LegacyEnglishNameModel } from "./legacy-english-nomenclature.ts";
import { attachLegacyFragment, legacyBenzoateFragment, legacyFunctionalFragment, legacyGraphsIdentical, legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { historicalPrefixKey, numberLegacyBenzene } from "./legacy-name-numbering.ts";
import type { RingGraph } from "./fused-topology.ts";
import { nameRetainedFused1979 } from "./iupac1979-retained-fused.ts";
import { verifyLegacyAliphaticAmineModel, formatLegacyAliphaticAmineSpanish } from "./iupac1979-aliphatic-amines.ts";

type StereoGraph = Omit<RingGraph,"atoms"> & { atoms: readonly (RingGraph["atoms"][number] & {tetrahedralParity?:string;tetrahedralBondTo?:number})[] };
export type LegacySpanishResolution =
  | {status:"NATIVE_ES";name:string}
  | {status:"TRANSLATED_FROM_LEGACY_EN";name:string;model:LegacyEnglishNameModel;numberedAtoms:Map<number,number>;fixedLocants?:Map<number,string>;rule:string}
  | {status:"UNSUPPORTED";name:"-";reason:string};

/** Reconstructs the semantic English plan independently of the namer's analysis.
 * Every atom, edge, charge, H count and parent anchor must match. Unknown
 * components, missing functions and silently saturated radicals fail closed. */
export function verifyLegacyAromaticModel(graph: StereoGraph, model: LegacyEnglishNameModel): boolean {
  try {
    if (model.profile !== "iupac-1979-legacy-en" || model.unavailableReason
      || model.parent.kind!=="aromatic" || model.parent.carbonCount!==6 || model.parent.atomIds.length!==6
      || new Set(model.parent.atomIds).size!==6 || model.parent.fallbackName
      || model.doubleBondLocants.length || model.tripleBondLocants.length
      || model.nitrogenSubstituents?.length || model.stereochemicalPrefix
      || graph.atoms.some(a=>a.tetrahedralParity!==undefined||a.tetrahedralBondTo!==undefined)
      || graph.bonds.some(b=>b[3])) return false;
    const validLocant=(n:number)=>Number.isInteger(n)&&n>=1&&n<=6;
    if (!model.substituents.every(s=>validLocant(s.locant)) || !model.functionalGroups.every(g=>validLocant(g.locant))) return false;
    const hierarchy=resolveFunctionalHierarchy(model.functionalGroups);
    if (hierarchy.principalGroups.length>1) return false;
    const expected = { atoms: Array.from({length:6},(_,id)=>({id,element:"C",charge:undefined as number|undefined})),
      bonds: Array.from({length:6},(_,i):[number,number,number]=>[i,(i+1)%6,i%2===0?2:1]) };
    for (const group of hierarchy.principalGroups) {
      const term=group.kind==="ester"?legacyBenzoateFragment(group.attachedAlkylName):legacyFunctionalFragment(group.kind);
      const included=["alcohol","amine"].includes(group.kind);
      if (!term || group.carbonIncludedInParent!==included || (group.kind!=="ester"&&group.attachedAlkylName)) return false;
      attachLegacyFragment(expected,group.locant-1,term);
    }
    const terms=model.substituents.map(s=>({s,term:legacyPrefixTerm(s.systematicName)}));
    if (terms.some(t=>!t.term)) return false;
    for (const {s,term} of terms) attachLegacyFragment(expected,s.locant-1,term!);
    // Functional metadata is checked in both directions; a fabricated or
    // omitted subordinate group cannot be laundered through the prefix list.
    const metadata=hierarchy.subordinateGroups.map(g=>`${g.locant}:${g.kind}`).sort();
    const prefixes=terms.filter(t=>t.term!.kind).map(({s,term})=>`${s.locant}:${term!.kind}`).sort();
    if (JSON.stringify(metadata)!==JSON.stringify(prefixes)) return false;
    const forced=new Map(model.parent.atomIds.map((id,i)=>[i,id]));
    return legacyGraphsIdentical(expected,graph,forced);
  } catch { return false; }
}

const suffixes:Record<string,string> = { alcohol:"fenol",amine:"anilina",carboxylicAcid:"ácido benzoico",
  aldehyde:"benzaldehído",nitrile:"benzonitrilo",amide:"benzamida" };
const multipliers=["","","di","tri","tetra","penta","hexa"];

export function translateLegacyEnglishToSpanish(input:{graph:StereoGraph;model:LegacyEnglishNameModel;englishName:string}):LegacySpanishResolution {
  const unsupported=(reason:string):LegacySpanishResolution=>({status:"UNSUPPORTED",name:"-",reason});
  try {
    if(input.model.profile!=="iupac-1979-legacy-en")return unsupported("non-legacy-profile");
    if (!input.englishName || input.englishName==="-" || generateLegacyEnglishName(input.model).name!==input.englishName)
      return unsupported("incomplete-or-inconsistent-english-name");
    if(input.model.parent.retained) {
      const proof=nameRetainedFused1979(input.graph),m=input.model;
      if(proof.status!=="SUPPORTED"||proof.nameEn!==input.englishName||m.parent.retained!.id!==proof.parentId
        ||m.substituents.length||m.functionalGroups.length||m.doubleBondLocants.length||m.tripleBondLocants.length
        ||m.nitrogenSubstituents?.length||m.stereochemicalPrefix||m.unavailableReason
        ||m.parent.kind!=="polycyclic"||m.parent.carbonCount!==proof.atomIds.length
        ||m.parent.atomIds.length!==proof.atomIds.length||new Set(m.parent.atomIds).size!==proof.atomIds.length
        ||m.parent.retained!.locants.length!==proof.atomIds.length
        ||m.parent.atomIds.some((id,i)=>(proof.englishLocants??proof.locants).get(id)!==m.parent.retained!.locants[i]))
        return unsupported("retained-parent-evidence-does-not-match-graph");
      return {status:"TRANSLATED_FROM_LEGACY_EN",name:proof.nameEs,model:m,fixedLocants:proof.locants,
        numberedAtoms:new Map([...proof.locants].filter(([,l])=>/^\d+$/.test(l)).map(([id,l])=>[id,Number(l)])),rule:proof.rule};
    }
    if(input.model.parent.kind==="chain") {
      if(!verifyLegacyAliphaticAmineModel(input.graph,input.model))
        return unsupported("aliphatic-amine-model-does-not-prove-complete-graph-and-numbering");
      const name=formatLegacyAliphaticAmineSpanish(input.model);
      if(!name)return unsupported("unrepresented-historical-amine-grammar");
      return {status:"TRANSLATED_FROM_LEGACY_EN",name,model:input.model,
        numberedAtoms:new Map(input.model.parent.atomIds.map((id,i)=>[id,i+1])),
        rule:"C-11.42; C-812.1(b); C-813.1; C-814.4; C-13/C-15; complete graph identity"};
    }
    if (!verifyLegacyAromaticModel(input.graph,input.model)) return unsupported("semantic-model-does-not-prove-complete-graph");
    const model=numberLegacyBenzene(input.model,name=>legacyPrefixTerm(name)?.es ?? name);
    if (!verifyLegacyAromaticModel(input.graph,model)) return unsupported("renumbered-parent-does-not-match-graph");
    const hierarchy=resolveFunctionalHierarchy(model.functionalGroups);
    const parent=hierarchy.principalKind==="ester"?legacyBenzoateFragment(hierarchy.principalGroups[0]?.attachedAlkylName)?.es
      :hierarchy.principalKind?suffixes[hierarchy.principalKind]:"benceno";
    if (!parent) return unsupported("unknown-historical-suffix");
    const grouped=new Map<string,{name:string;complex:boolean;locants:number[]}>();
    for (const s of model.substituents) {
      const name=legacyPrefixTerm(s.systematicName)!.es, key=`${s.complex}:${name}`;
      if(/^\d/.test(name)&&!s.complex)return unsupported("inconsistent-complex-prefix-grammar");
      const group=grouped.get(key)??{name,complex:s.complex,locants:[]};group.locants.push(s.locant);grouped.set(key,group);
    }
    const prefix=[...grouped.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
      .map(g=>{const locants=g.locants.sort((a,b)=>a-b).join(","), count=g.locants.length;
        const multiplier=count>1?(g.complex?["","","bis","tris","tetrakis","pentakis","hexakis"][count]:multipliers[count]):"";
        return `${locants}-${multiplier}${g.complex?`(${g.name})`:g.name}`;
      });
    if (!hierarchy.principalKind && model.substituents.length===1) prefix[0]=prefix[0].replace(/^1-/,"");
    const attached=prefix.join("-");
    const name=parent.startsWith("ácido ")?`ácido ${attached}${parent.slice(6)}`:`${attached}${parent}`;
    return {status:"TRANSLATED_FROM_LEGACY_EN",name,model,numberedAtoms:new Map(model.parent.atomIds.map((id,i)=>[id,i+1])),
      rule:"A-12.2–3; A-2.3–4; C-15.11; C-16.31–34; complete graph identity"};
  } catch { return unsupported("unrecognized-semantic-model"); }
}

/** The caller supplies the graph-validated native formatter output, never a
 * Suggested/PIN spelling. A lexical ES rejection does not veto the EN route. */
export function resolveLegacySpanish(input:{nativeSpanishName:string;englishName:string;model:LegacyEnglishNameModel;graph:StereoGraph;chemicallyAvailable:boolean}):LegacySpanishResolution {
  if (!input.chemicallyAvailable) return {status:"UNSUPPORTED",name:"-",reason:"chemical-safety-gate"};
  if (input.nativeSpanishName && input.nativeSpanishName!=="-") return {status:"NATIVE_ES",name:input.nativeSpanishName};
  return translateLegacyEnglishToSpanish(input);
}
