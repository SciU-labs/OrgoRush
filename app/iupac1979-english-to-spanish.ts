import { generateLegacyEnglishName, resolveFunctionalHierarchy, type LegacyEnglishNameModel } from "./legacy-english-nomenclature.ts";
import { attachLegacyFragment, legacyBenzoateFragment, legacyFunctionalFragment, legacyGraphsIdentical, legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { historicalPrefixKey, numberLegacyBenzene } from "./legacy-name-numbering.ts";
import type { RingGraph } from "./fused-topology.ts";
import { nameRetainedFused1979 } from "./iupac1979-retained-fused.ts";
import { nameLegacyMonocyclicNitrogenHeterocycle } from "./iupac1979-monocyclic-heterocycles.ts";
import { nameLegacyFusedIndole } from "./iupac1979-fused-indole.ts";
import { nameLegacyPiperidineComposition } from "./iupac1979-piperidine-compositions.ts";
import { verifyLegacyAliphaticAmineModel, formatLegacyAliphaticAmineSpanish, legacySymmetricAliphaticAmineNames } from "./iupac1979-aliphatic-amines.ts";
import { getTetrahedralStereoCenters } from "./tetrahedral-stereochemistry.ts";
import { verifyLegacyAliphaticFunctionalModel, formatLegacyAliphaticFunctionalSpanish, verifyLegacySimpleEtherModel, formatLegacySimpleEtherSpanish, verifyLegacyAcyclicPrefixModel, formatLegacyAcyclicPrefixSpanish, verifyLegacyExtendedAliphaticFunctionalModel, formatLegacyExtendedAliphaticFunctionalSpanish, legacyAliphaticFunctionalRules } from "./iupac1979-aliphatic-functions.ts";

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
      || graph.atoms.some(a=>a.tetrahedralBondTo!==undefined)
      || graph.bonds.some(b=>b[3])) return false;
    const validLocant=(n:number)=>Number.isInteger(n)&&n>=1&&n<=6;
    if (!model.substituents.every(s=>validLocant(s.locant)) || !model.functionalGroups.every(g=>validLocant(g.locant))) return false;
    const hierarchy=resolveFunctionalHierarchy(model.functionalGroups);
    if (hierarchy.principalGroups.length>1
      && (new Set(hierarchy.principalGroups.map(group=>group.kind)).size!==1
        || hierarchy.principalGroups[0]?.kind!=="alcohol")) return false;
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
    const prefixes=terms.filter(t=>t.term!.kind&&!t.s.complex).map(({s,term})=>`${s.locant}:${term!.kind}`).sort();
    if (JSON.stringify(metadata)!==JSON.stringify(prefixes)) return false;
    const declaredStereo=terms.flatMap(({s,term})=>(term!.stereochemistry??[]).map(center=>{
      const atomId=s.atomIds?.[center.atomIndex];
      return atomId===undefined?null:{atomId,configuration:center.configuration};
    }));
    if(declaredStereo.some(center=>center===null))return false;
    const actualStereo=getTetrahedralStereoCenters(graph as never);
    if(actualStereo.length!==declaredStereo.length||actualStereo.some(center=>
      !declaredStereo.some(expected=>expected!==null&&expected.atomId===center.atomId&&expected.configuration===center.configuration)))return false;
    const forced=new Map(model.parent.atomIds.map((id,i)=>[i,id]));
    return legacyGraphsIdentical(expected,graph,forced);
  } catch { return false; }
}

const suffixes:Record<string,string> = { alcohol:"fenol",amine:"anilina",carboxylicAcid:"ácido benzoico",
  aldehyde:"benzaldehído",nitrile:"benzonitrilo",amide:"benzamida" };
const multipliers=["","","di","tri","tetra","penta","hexa"];

function retainedC2UnsaturatedName(graph:StereoGraph,model:LegacyEnglishNameModel,englishName:string):LegacySpanishResolution|undefined {
  const order=model.doubleBondLocants.length===1&&model.doubleBondLocants[0]===1&&!model.tripleBondLocants.length?2
    :model.tripleBondLocants.length===1&&model.tripleBondLocants[0]===1&&!model.doubleBondLocants.length?3:0;
  if(!order)return;
  const ids=model.parent.atomIds;
  if(model.parent.kind!=="chain"||model.parent.carbonCount!==2||ids.length!==2||new Set(ids).size!==2
    ||model.unavailableReason||model.functionalGroups.length||model.substituents.length||model.nitrogenSubstituents?.length
    ||model.stereochemicalPrefix||graph.atoms.length!==2||graph.bonds.length!==1
    ||graph.atoms.some(atom=>(atom.element??"C")!=="C"||atom.charge
      ||(atom as typeof atom & {isotope?:number}).isotope!==undefined
      ||atom.tetrahedralParity!==undefined||atom.tetrahedralBondTo!==undefined))return;
  const bond=graph.bonds[0];
  if(!ids.includes(bond[0])||!ids.includes(bond[1])||bond[2]!==order||bond[3])return;
  const name=order===2?"ethylene":"acetylene";
  if(englishName!==name)return unsupportedRetained();
  return {status:"TRANSLATED_FROM_LEGACY_EN",name:order===2?"etileno":"acetileno",model,
    numberedAtoms:new Map([[ids[0],1],[ids[1],2]]),rule:order===2?"A-3.1 (retained ethylene)":"A-3.2 (retained acetylene)"};
}

function unsupportedRetained():LegacySpanishResolution { return {status:"UNSUPPORTED",name:"-",reason:"retained-name-does-not-match-graph"}; }

/** Native acyclic polyenes must represent the entire neutral carbon graph.
 * Parent selection/numbering comes from the existing 1979 analyzer; forced
 * parent anchors prove each locant instead of accepting constitutional aliases.
 * This proof does not extend the EN -> ES fallback to new families. */
export function verifyLegacyAcyclicPolyeneModel(graph: StereoGraph, model: LegacyEnglishNameModel): boolean {
  try {
    const n = model.parent.carbonCount;
    if (model.profile !== "iupac-1979-legacy-en" || model.unavailableReason
      || model.parent.kind !== "chain" || model.parent.fallbackName || model.parent.retained
      || !Number.isInteger(n) || n < 3 || n > 100 || model.parent.atomIds.length !== n
      || new Set(model.parent.atomIds).size !== n || model.functionalGroups.length
      || model.tripleBondLocants.length || model.nitrogenSubstituents?.length
      || model.doubleBondLocants.length < 2 || model.doubleBondLocants.length > 8
      || graph.bonds.length !== graph.atoms.length - 1
      || graph.atoms.some(a => (a.element ?? "C") !== "C" || a.charge)
      || graph.bonds.some(b => ![1, 2].includes(b[2] ?? 1))
      || graph.bonds.filter(b => b[2] === 2).length !== model.doubleBondLocants.length) return false;
    const locants = model.doubleBondLocants;
    if (locants.some((l, i) => !Number.isInteger(l) || l < 1 || l >= n || i > 0 && l <= locants[i - 1])) return false;
    if (graph.atoms.some(a => graph.bonds.reduce((sum, [l, r, order = 1]) => sum + (l === a.id || r === a.id ? order : 0), 0) > 4)) return false;
    const expected = {
      atoms: Array.from({ length: n }, (_, id) => ({ id, element: "C", charge: undefined as number | undefined })),
      bonds: Array.from({ length: n - 1 }, (_, i): [number, number, number] => [i, i + 1, locants.includes(i + 1) ? 2 : 1]),
    };
    for (const s of model.substituents) {
      const term = legacyPrefixTerm(s.systematicName);
      if (!Number.isInteger(s.locant) || s.locant < 1 || s.locant > n || !term || term.kind
        || term.elements.some(e => e !== "C") || term.bonds.some(b => b[2] !== 1)) return false;
      attachLegacyFragment(expected, s.locant - 1, term);
    }
    return legacyGraphsIdentical(expected, graph, new Map(model.parent.atomIds.map((id, i) => [i, id])));
  } catch { return false; }
}

export function translateLegacyEnglishToSpanish(input:{graph:StereoGraph;model:LegacyEnglishNameModel;englishName:string}):LegacySpanishResolution {
  const unsupported=(reason:string):LegacySpanishResolution=>({status:"UNSUPPORTED",name:"-",reason});
  try {
    if(input.model.profile!=="iupac-1979-legacy-en")return unsupported("non-legacy-profile");
    if (input.model.parent.retained?.id === "piperidine-composition") {
      const proof = nameLegacyPiperidineComposition(input.graph);
      const model = input.model;
      if (!proof || proof.english !== input.englishName || model.parent.fallbackName !== proof.english
        || model.parent.atomIds.length !== proof.parentAtomIds.length
        || model.parent.atomIds.some((id, index) => id !== proof.parentAtomIds[index])
        || model.parent.retained!.locants.length !== proof.locants.size
        || [...proof.locants.values()].some((locant, index) => model.parent.retained!.locants[index] !== locant)
        || model.substituents.length || model.functionalGroups.length || model.doubleBondLocants.length
        || model.tripleBondLocants.length || model.nitrogenSubstituents?.length || model.stereochemicalPrefix
        || model.unavailableReason || generateLegacyEnglishName(model).name !== input.englishName)
        return unsupported("piperidine-composition-does-not-match-complete-graph-and-numbering");
      return { status: "TRANSLATED_FROM_LEGACY_EN", name: proof.spanish, model,
        fixedLocants: proof.locants,
        numberedAtoms: new Map([...proof.locants].flatMap(([id, locant]) => {
          const value = Number(locant); return Number.isInteger(value) ? [[id, value] as const] : [];
        })), rule: proof.rule };
    }
    if (input.model.parent.kind === "heterocycle") {
      const proof = nameLegacyMonocyclicNitrogenHeterocycle(input.graph);
      if (!proof || proof.english !== input.englishName || input.model.parent.fallbackName !== proof.english
        || input.model.parent.atomIds.length !== proof.atomLocants.size
        || input.model.parent.atomIds.some((id, index) => id !== [...proof.atomLocants.keys()][index]))
        return unsupported("heterocycle-retained-name-does-not-match-complete-graph");
      return { status: "TRANSLATED_FROM_LEGACY_EN", name: proof.spanish, model: input.model,
        numberedAtoms: proof.atomLocants, rule: proof.rule };
    }
    if (input.model.parent.retained?.id === "indole") {
      const proof = nameLegacyFusedIndole(input.graph);
      const model = input.model;
      if (!proof || proof.status !== "SUPPORTED" || proof.nameEn !== input.englishName || proof.nameEs === "-"
        || model.parent.kind !== "polycyclic" || model.parent.fallbackName !== proof.nameEn
        || model.parent.carbonCount !== proof.atomIds.length
        || model.parent.atomIds.length !== proof.atomIds.length
        || model.parent.atomIds.some((id, index) => id !== proof.atomIds[index]
          || model.parent.retained?.locants[index] !== proof.englishLocants?.get(id))
        || model.substituents.length || model.functionalGroups.length || model.doubleBondLocants.length
        || model.tripleBondLocants.length || model.nitrogenSubstituents?.length || model.stereochemicalPrefix
        || model.unavailableReason || generateLegacyEnglishName(model).name !== input.englishName)
        return unsupported("indole-name-does-not-match-complete-graph-and-numbering");
      return { status: "TRANSLATED_FROM_LEGACY_EN", name: proof.nameEs, model,
        fixedLocants: proof.locants,
        numberedAtoms: new Map([...proof.locants].filter(([, locant]) => /^\d+$/.test(locant))
          .map(([id, locant]) => [id, Number(locant)])), rule: proof.rule };
    }
    const retained=retainedC2UnsaturatedName(input.graph,input.model,input.englishName);
    if(retained)return retained;
    const symmetricAmine=legacySymmetricAliphaticAmineNames(input.graph,input.model);
    if(symmetricAmine?.english===input.englishName)return {status:"TRANSLATED_FROM_LEGACY_EN",name:symmetricAmine.spanish,
      model:input.model,numberedAtoms:new Map(input.model.parent.atomIds.map((id,i)=>[id,i+1])),rule:"C-814.1; complete graph identity"};
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
      const principalKind=resolveFunctionalHierarchy(input.model.functionalGroups).principalKind;
      const supportedUnsaturatedPrincipal=["aldehyde","carboxylicAcid","nitrile"].includes(principalKind??"");
      const prefixOnly=input.model.functionalGroups.length>0
        &&input.model.functionalGroups.every(group=>group.kind==="halogen"||group.kind==="nitro");
      const hasBranchedEsterRadical=input.model.functionalGroups.some(group=>{
        if(!group.attachedAlkylName)return false;
        const term=legacyPrefixTerm(group.attachedAlkylName);if(!term)return false;
        return term.elements.some((_,atom)=>term.bonds.filter(([a,b])=>a===atom||b===atom).length>2);
      });
      const extendedComposition=Boolean((input.model.doubleBondLocants.length||input.model.tripleBondLocants.length)&&supportedUnsaturatedPrincipal
        ||input.model.stereochemicalPrefix||!prefixOnly&&new Set(input.model.functionalGroups.map(group=>group.kind)).size>1
        ||principalKind==="carboxylicAcid"&&input.model.functionalGroups.filter(group=>group.kind==="carboxylicAcid").length>2
          &&input.model.functionalGroups.filter(group=>group.kind==="carboxylicAcid").every(group=>!group.carbonIncludedInParent)
        ||hasBranchedEsterRadical
        ||input.model.substituents.some(substituent=>{
          const fragment=legacyPrefixTerm(substituent.systematicName);
          return fragment?.es==="fenil"||Boolean(fragment&&fragment.elements.length>6);
        }));
      if(extendedComposition){
        if(!verifyLegacyExtendedAliphaticFunctionalModel(input.graph,input.model))
          return unsupported("extended-functional-model-does-not-prove-complete-graph-numbering-and-stereochemistry");
        const name=formatLegacyExtendedAliphaticFunctionalSpanish(input.model);
        if(!name)return unsupported("unrepresented-extended-functional-morpheme-order");
        const principal=resolveFunctionalHierarchy(input.model.functionalGroups).principalKind!;
        const rule=principal==="carboxylicAcid"&&resolveFunctionalHierarchy(input.model.functionalGroups).principalGroups.length>2
          ?"C-402.1":legacyAliphaticFunctionalRules[principal];
        return {status:"TRANSLATED_FROM_LEGACY_EN",name,model:input.model,
          numberedAtoms:new Map(input.model.parent.atomIds.map((id,i)=>[id,i+1])),
          rule:`${rule}; ${resolveFunctionalHierarchy(input.model.functionalGroups).subordinateGroups.some(group=>group.kind==="nitrile")?"C-832.5; ":""}${input.model.parent.carbonCount===1&&input.model.substituents.filter(s=>legacyPrefixTerm(s.systematicName)?.es==="fenil").length===2?"C-313.1; ":""}C-15; C-16; complete graph and CIP identity`};
      }
      if(input.model.functionalGroups.length&&input.model.functionalGroups.every(g=>g.kind==="halogen"||g.kind==="nitro")) {
        if(!verifyLegacyAcyclicPrefixModel(input.graph,input.model))return unsupported("acyclic-prefix-model-does-not-prove-complete-graph-and-numbering");
        const name=formatLegacyAcyclicPrefixSpanish(input.model);
        if(!name)return unsupported("unrepresented-historical-prefix-grammar");
        const prefixRules=[...new Set(input.model.functionalGroups.map(group=>group.kind==="halogen"?"C-102.1":"C-852.1"))].join("/");
        return {status:"TRANSLATED_FROM_LEGACY_EN",name,model:input.model,
          numberedAtoms:new Map(input.model.parent.atomIds.map((id,i)=>[id,i+1])),rule:`C-15.11; ${prefixRules}; C-13/C-16; complete graph identity`};
      }
      if(input.model.functionalGroups[0]?.kind==="ether") {
        if(!verifyLegacySimpleEtherModel(input.graph,input.model))return unsupported("simple-ether-model-does-not-prove-complete-graph-and-numbering");
        const name=formatLegacySimpleEtherSpanish(input.model);
        if(!name)return unsupported("unrepresented-historical-ether-grammar");
        return {status:"TRANSLATED_FROM_LEGACY_EN",name,model:input.model,
          numberedAtoms:new Map(input.model.parent.atomIds.map((id,i)=>[id,i+1])),rule:"C-211.1/C-211.2; C-13/C-15; complete graph identity"};
      }
      if(input.model.functionalGroups[0]?.kind!=="amine") {
        if(!verifyLegacyAliphaticFunctionalModel(input.graph,input.model))
          return unsupported("aliphatic-functional-model-does-not-prove-complete-graph-and-numbering");
        const name=formatLegacyAliphaticFunctionalSpanish(input.model);
        if(!name)return unsupported("unrepresented-historical-functional-grammar");
        return {status:"TRANSLATED_FROM_LEGACY_EN",name,model:input.model,
          numberedAtoms:new Map(input.model.parent.atomIds.map((id,i)=>[id,i+1])),
          rule:`${legacyAliphaticFunctionalRules[input.model.functionalGroups[0].kind]}; ${input.model.nitrogenSubstituents?.some(s=>legacyPrefixTerm(s.systematicName)?.kind==="alcohol")?"C-202.1; ":""}C-13.11/C-15; complete graph identity`};
      }
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
    let parent=hierarchy.principalKind==="ester"?legacyBenzoateFragment(hierarchy.principalGroups[0]?.attachedAlkylName)?.es
      :hierarchy.principalKind?suffixes[hierarchy.principalKind]:"benceno";
    if(hierarchy.principalKind==="alcohol"&&hierarchy.principalGroups.length>1) {
      // Blue Book 1979 C-202.1 forms benzene polyols by attaching -diol,
      // -triol, etc. to benzene; their locants precede that parent name.
      const locants=hierarchy.principalGroups.map(group=>group.locant).sort((a,b)=>a-b);
      const multiplier=["","","di","tri","tetra","penta","hexa","hepta","octa","nona","deca"][locants.length];
      if(!multiplier)return unsupported("unrepresented-historical-polyol-multiplier");
      parent=`${locants.join(",")}-benceno${multiplier}ol`;
    }
    if (!parent) return unsupported("unknown-historical-suffix");
    const grouped=new Map<string,{name:string;complex:boolean;locants:number[]}>();
    for (const s of model.substituents) {
      const name=legacyPrefixTerm(s.systematicName)!.es, key=`${s.complex}:${name}`;
      if(/^\d/.test(name)&&!s.complex)return unsupported("inconsistent-complex-prefix-grammar");
      const group=grouped.get(key)??{name,complex:s.complex,locants:[]};group.locants.push(s.locant);grouped.set(key,group);
    }
    const prefix=[...grouped.values()].sort((a,b)=>historicalPrefixKey(a.name).localeCompare(historicalPrefixKey(b.name),"es"))
      .map(g=>{const locants=g.locants.sort((a,b)=>a-b).join(","), count=g.locants.length,complex=g.complex&&g.name!=="fenil";
        const multiplier=count>1?(complex?["","","bis","tris","tetrakis","pentakis","hexakis"][count]:multipliers[count]):"";
        const opening=g.name.startsWith("(")?"[":"(",closing=opening==="["?"]":")";
        return `${locants}-${multiplier}${complex?`${opening}${g.name}${closing}`:g.name}`;
      });
    if (!hierarchy.principalKind && model.substituents.length===1) prefix[0]=prefix[0].replace(/^1-/,"");
    const attached=prefix.join("-");
    const name=parent.startsWith("ácido ")?`ácido ${attached}${parent.slice(6)}`
      :`${attached}${attached&&/^\d/.test(parent)?"-":""}${parent}`;
    const componentRules=[...(hierarchy.principalKind==="alcohol"? ["C-202.1"]:[]),
      ...(model.functionalGroups.some(group=>group.kind==="amine")
        ||model.substituents.some(substituent=>legacyPrefixTerm(substituent.systematicName)?.kind==="amine")?["C-812.1"]:[])];
    return {status:"TRANSLATED_FROM_LEGACY_EN",name,model,numberedAtoms:new Map(model.parent.atomIds.map((id,i)=>[id,i+1])),
      rule:[...componentRules,"A-12.2–3","A-2.3–4","C-15.11","C-16.31–34","complete graph identity"].join("; ")};
  } catch { return unsupported("unrecognized-semantic-model"); }
}

/** The caller supplies the graph-validated native formatter output, never a
 * Suggested/PIN spelling. A lexical ES rejection does not veto the EN route. */
export function resolveLegacySpanish(input:{nativeSpanishName:string;englishName:string;model:LegacyEnglishNameModel;graph:StereoGraph;chemicallyAvailable:boolean}):LegacySpanishResolution {
  if (!input.chemicallyAvailable) return {status:"UNSUPPORTED",name:"-",reason:"chemical-safety-gate"};
  if (input.nativeSpanishName && input.nativeSpanishName!=="-") return {status:"NATIVE_ES",name:input.nativeSpanishName};
  return translateLegacyEnglishToSpanish(input);
}
