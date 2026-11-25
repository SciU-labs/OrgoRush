import { Canonizer, Molecule as OCLMolecule, SmilesParser } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { NameBuildResult } from "./name-to-molecule.ts";
import { moleculeFromSmiles } from "./openchemlib-adapter.ts";
import { AUDITED_GONANE_SMILES, auditedGonaneLocantAtomIds, findSaturatedFusedPolycycle, isValidFusedPolycyclicStereochemistry } from "./fused-polycyclic-stereochemistry.ts";

export const GONANE_REFERENCES = {
  "5ξ": {smiles:AUDITED_GONANE_SMILES["5ξ"],identityCode:"fhe@@@LdbbbTReryHQmN|Fjjjjjjj@TDaLad@",specification:"partial"},
  "5α": {smiles:AUDITED_GONANE_SMILES["5α"],identityCode:"fhe@@@LdbbbTReryHQmN|Fjjjjjjf@TDaDcHY@@",specification:"complete"},
  "5β": {smiles:AUDITED_GONANE_SMILES["5β"],identityCode:"fhe@@@LdbbbTReryHQmN|Fjjjjjjf@TDaDSHY@@",specification:"complete"},
} as const;

export type ParsedGonaneName={language:"en"|"es";descriptor:"5ξ"|"5α"|"5β";normalized:string};
export function parseGonaneStereoName(input:string):ParsedGonaneName|null{
  const normalized=input.trim().normalize("NFC").replace(/\s+/g,"");
  const match=/^5([αβξ])-(gonane|gonano)$/i.exec(normalized);if(!match)return null;
  const language=match[2]==="gonane"?"en":"es";
  const descriptor=`5${match[1]}` as ParsedGonaneName["descriptor"];
  return {language,descriptor,normalized};
}

export function buildGonaneMoleculeFromName(input:string):NameBuildResult|null{
  const parsed=parseGonaneStereoName(input);if(!parsed)return null;
  const result=moleculeFromSmiles(GONANE_REFERENCES[parsed.descriptor].smiles);
  if(!result.ok)return {ok:false,error:result.error,inputFamily:"fused-gonane-stereo"};
  return {ok:true,molecule:result.molecule,normalizedInput:parsed.normalized,enabledAliases:[],inputFamily:"fused-gonane-stereo"};
}

function canonicalSmilesIdentity(smiles:string){
  const molecule=new SmilesParser().parseMolecule(smiles);molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
  return new Canonizer(molecule).getIDCode();
}

export function reconcileGonaneStereoName(actual:GeneratedMolecule,name:string):ValidatedNameDerivation|null{
  const parsed=parseGonaneStereoName(name),metadata=actual.fusedPolycyclicStereo;
  if(!parsed||!metadata||!isValidFusedPolycyclicStereochemistry(actual))return null;
  const reference=GONANE_REFERENCES[parsed.descriptor];
  if(metadata.identityCode!==reference.identityCode||metadata.specification!==reference.specification
    ||metadata.connectivityCode!=="fhe@@@LdbbbTReryHQmN|Fjjjjjj`@@")return null;
  const topology=findSaturatedFusedPolycycle(actual,[5,6,6,6]);
  if(!topology||actual.atoms.length!==17||actual.bonds.length!==20)return null;
  let formula:string;try{const m=new SmilesParser().parseMolecule(metadata.sourceSmiles);formula=m.getMolecularFormula().formula;}catch{return null;}
  if(formula!=="C17H28"||canonicalSmilesIdentity(reference.smiles)!==reference.identityCode)return null;
  const locants=auditedGonaneLocantAtomIds(metadata.sourceSmiles);if(!locants)return null;
  const atomIds=actual.atoms.map(a=>a.id),bondIds=actual.bonds.map(([a,b])=>[a,b] as [number,number]);
  const ringLocants:[string,number[]][]=[["A",[1,2,3,4,5,10]],["B",[5,6,7,8,9,10]],["C",[8,9,11,12,13,14]],["D",[13,14,15,16,17]]];
  const expectedFusions=[[5,10],[8,9],[13,14]];
  const orderedJunctions=topology.junctions.map(junction=>({junction,locants:junction.fusionAtomIds.map(id=>Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])).sort((a,b)=>a-b)}))
    .sort((a,b)=>expectedFusions.findIndex(edge=>edge[0]===a.locants[0]&&edge[1]===a.locants[1])
      -expectedFusions.findIndex(edge=>edge[0]===b.locants[0]&&edge[1]===b.locants[1]));
  if(orderedJunctions.some(item=>expectedFusions.findIndex(edge=>edge[0]===item.locants[0]&&edge[1]===item.locants[1])<0))return null;
  const components:NameComponent[]=[{id:"parent",role:"parent",text:parsed.normalized,start:0,end:parsed.normalized.length,atomIds,bondIds,numbering:Object.entries(locants).map(([locant,id])=>[id,Number(locant)] as [number,number]),
    explanation:"Gonane is the unsubstituted saturated C17 steroid parent. The 6–6–6–5 ring path and all three shared edges are verified from the molecular graph.",
    explanationEs:"El gonano es el hidrocarburo esteroideo saturado C17 sin sustituyentes. La secuencia de anillos 6–6–6–5 y sus tres enlaces compartidos se verifican en el grafo molecular."},
    ...ringLocants.map(([letter,positions])=>{const selected=positions.map(n=>locants[String(n)]!);const ring=actual.rings?.find(r=>r.atomIds.length===positions.length&&r.atomIds.every(id=>selected.includes(id)));return {
      id:`gonane-ring-${letter}`,role:"parent" as const,text:"",start:0,end:parsed.normalized.length,atomIds:ring?[...ring.atomIds]:selected,
      bondIds:bondIds.filter(([a,b])=>selected.includes(a)&&selected.includes(b)),numbering:selected.map((id,index)=>[id,positions[index]!] as [number,number]),
      label:`ring ${letter}`,labelEs:`anillo ${letter}`,explanation:`Ring ${letter} contains steroid locants ${positions.join(", ")}.`,explanationEs:`El anillo ${letter} contiene los localizadores esteroideos ${positions.join(", ")}.`};}),
    ...orderedJunctions.map(({junction,locants:pair},index)=>{const expected=expectedFusions[index]!;return {
      id:`gonane-fusion-${index+1}`,role:"prefix" as const,text:"",start:0,end:parsed.normalized.length,atomIds:[...junction.fusionAtomIds],bondIds:[[...junction.fusionBond] as [number,number]],numbering:junction.fusionAtomIds.map(id=>[id,Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])] as [number,number]),
      label:`fusion C${expected[0]}–C${expected[1]}`,labelEs:`unión C${expected[0]}–C${expected[1]}`,explanation:`This is the shared C${expected[0]}–C${expected[1]} bond.`,explanationEs:`Este es el enlace compartido C${expected[0]}–C${expected[1]}.`};}),
    {id:"gonane-locants",role:"prefix",text:"",start:0,end:parsed.normalized.length,atomIds:Object.values(locants),bondIds:[],numbering:Object.entries(locants).map(([locant,id])=>[id,Number(locant)] as [number,number]),
      label:"steroid numbering",labelEs:"numeración esteroidea",explanation:"Conventional locants are mapped to graph atoms independently of canvas coordinates.",explanationEs:"Los localizadores convencionales se asignan a los átomos del grafo sin depender de las coordenadas del lienzo."},
    {id:"gonane-stereo",role:"prefix",text:parsed.descriptor,start:0,end:parsed.descriptor.length,atomIds:topology.junctions.flatMap(j=>j.fusionAtomIds).filter((id,i,a)=>a.indexOf(id)===i),bondIds:topology.junctions.map(j=>[...j.fusionBond] as [number,number]),numbering:[[locants["5"]!,5]],
      explanation:parsed.descriptor==="5ξ"?"The audited parent specifies its other fusion stereochemistry but leaves C5 unresolved, so ξ is retained.":`The ${parsed.descriptor==="5α"?"5α":"5β"} descriptor is checked against the complete stereochemical reference, not inferred from SMILES @/@@ or screen orientation.`,
      explanationEs:parsed.descriptor==="5ξ"?"La referencia del esqueleto especifica la estereoquímica restante, pero deja C5 sin resolver; por eso se conserva ξ.":`El descriptor ${parsed.descriptor} se contrasta con la referencia estereoquímica completa; no se deduce de @/@@ en SMILES ni de la orientación en pantalla.`}];
  const evidence:ValidatedCompositionalEvidence={source:"active-name",profile:"current",language:parsed.language,construction:"fused-gonane-stereo",
    rules:[{id:"steroid-gonane-parent",source:"IUPAC-IUBMB Steroid Nomenclature (1989), 3S-2.1; semisystematic steroid parent, not claimed as a 2013 PIN"},
      {id:"gonane-stereo-reference",source:"Audited isomeric reference identity; all specified junction stereochemistry compared globally"}],
    parentSelection:"steroid-gonane",numbering:{scope:"parent",priorities:["conventional steroid numbering verified against reference mapping"],selected:Object.entries(locants).map(([n,id])=>[id,Number(n)]),reflected:[],comparison:0},
    stereo:parsed.descriptor==="5ξ"?"partially-specified-stereochemistry":"specified-fused-junction",reconstructedGraph:actual,
    atomMapping:atomIds.map(id=>[id,id]),equivalence:"complete-graph-isomorphism"};
  return {status:"FULL",name:parsed.normalized,preferred:false,principalGroup:"none",components,parentAtomIds:atomIds,evidence};
}
