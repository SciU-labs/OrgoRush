import { Canonizer, Molecule, SmilesParser } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { NameBuildResult } from "./name-to-molecule.ts";
import { moleculeFromSmiles } from "./openchemlib-adapter.ts";
import { findSaturatedFusedPolycycle, isValidFusedPolycyclicStereochemistry, steroidLocantAtomIds } from "./fused-polycyclic-stereochemistry.ts";

export const AUDITED_STEROID_SMILES={
  estrane:{
    "5α":"C[C@@]12CCC[C@H]1[C@@H]3CC[C@H]4CCCC[C@@H]4[C@H]3CC2",
    "5β":"C[C@@]12CCC[C@H]1[C@@H]3CC[C@@H]4CCCC[C@@H]4[C@H]3CC2",
  },
  androstane:{
    "5α":"C[C@@]12CCC[C@H]1[C@@H]3CC[C@H]4CCCC[C@@]4([C@H]3CC2)C",
    "5β":"C[C@@]12CCC[C@H]1[C@@H]3CC[C@@H]4CCCC[C@@]4([C@H]3CC2)C",
  },
} as const;

export type SteroidFamily="estrane"|"androstane";
export type SteroidDescriptor="5α"|"5β"|"5ξ";
export type ParsedSteroidName={family:SteroidFamily;descriptor:SteroidDescriptor;language:"en"|"es";normalized:string};

function xiReference(family:SteroidFamily):string{
  const molecule=new SmilesParser().parseMolecule(AUDITED_STEROID_SMILES[family]["5α"]);
  const imported=moleculeFromSmiles(AUDITED_STEROID_SMILES[family]["5α"]);
  if(!imported.ok)throw new Error("The audited α steroid reference could not be imported.");
  const c5=imported.molecule.fusedPolycyclicStereo?.locantAtomIds?.["5"];
  if(c5===undefined)throw new Error("The audited α steroid reference has no C5 locant mapping.");
  molecule.setAtomParity(c5-1,0,false);
  return molecule.toIsomericSmiles();
}

const REFERENCE_SMILES:Record<SteroidFamily,Record<SteroidDescriptor,string>>={
  estrane:{...AUDITED_STEROID_SMILES.estrane,"5ξ":xiReference("estrane")},
  androstane:{...AUDITED_STEROID_SMILES.androstane,"5ξ":xiReference("androstane")},
};
const referenceIdentity=(smiles:string)=>{const molecule=new SmilesParser().parseMolecule(smiles);molecule.ensureHelperArrays(Molecule.cHelperCIP);return new Canonizer(molecule).getIDCode();};
export const STEROID_REFERENCES=Object.fromEntries(Object.entries(REFERENCE_SMILES).map(([family,descriptors])=>[family,
  Object.fromEntries(Object.entries(descriptors).map(([descriptor,smiles])=>[descriptor,{smiles,identityCode:referenceIdentity(smiles),
    specification:descriptor==="5ξ"?"partial":"complete",formula:family==="estrane"?"C18H30":"C19H32"}]))])) as Record<SteroidFamily,
      Record<SteroidDescriptor,{smiles:string;identityCode:string;specification:"complete"|"partial";formula:string}>>;

export function parseSteroidFamilyName(input:string):ParsedSteroidName|null{
  const normalized=input.trim().normalize("NFC").replace(/\s+/g,"");
  const match=/^5([αβξ])-(estrane|oestrane|estrano|oestrano|androstane|androstano)$/i.exec(normalized);
  if(!match)return null;
  const stem=match[2]!.toLowerCase(),family:SteroidFamily=stem.startsWith("andro")?"androstane":"estrane";
  const language=stem.endsWith("o")?"es":"en";
  return {family,descriptor:`5${match[1]}` as SteroidDescriptor,language,normalized};
}

export function buildSteroidFamilyMoleculeFromName(input:string):NameBuildResult|null{
  const parsed=parseSteroidFamilyName(input);if(!parsed)return null;
  const result=moleculeFromSmiles(STEROID_REFERENCES[parsed.family][parsed.descriptor].smiles);
  if(!result.ok)return {ok:false,error:result.error,inputFamily:"fused-steroid-family"};
  return {ok:true,molecule:result.molecule,normalizedInput:parsed.normalized,enabledAliases:[],inputFamily:"fused-steroid-family"};
}

function expectedAtomCount(family:SteroidFamily){return family==="estrane"?18:19;}
function makeDerivation(actual:GeneratedMolecule,parsed:ParsedSteroidName):ValidatedNameDerivation|null{
  const metadata=actual.fusedPolycyclicStereo,reference=STEROID_REFERENCES[parsed.family][parsed.descriptor];
  if(!metadata||!isValidFusedPolycyclicStereochemistry(actual)||metadata.identityCode!==reference.identityCode
    ||metadata.specification!==reference.specification)return null;
  const count=expectedAtomCount(parsed.family),topology=findSaturatedFusedPolycycle(actual,[5,6,6,6]),locants=steroidLocantAtomIds(actual);
  if(!topology||actual.atoms.length!==count||actual.bonds.length!==count+3||!locants
    ||Object.keys(locants).length!==count||!locants["18"]||(parsed.family==="androstane")!==Boolean(locants["19"]))return null;
  let formula:string;try{formula=new SmilesParser().parseMolecule(metadata.sourceSmiles).getMolecularFormula().formula;}catch{return null;}
  if(formula!==reference.formula)return null;
  const ringBonds=actual.bonds.map(([a,b])=>[a,b] as [number,number]);
  const ringLocants:[string,number[]][]=[["A",[1,2,3,4,5,10]],["B",[5,6,7,8,9,10]],["C",[8,9,11,12,13,14]],["D",[13,14,15,16,17]]];
  const expectedFusions=[[5,10],[8,9],[13,14]];
  const orderedJunctions=topology.junctions.map(junction=>({junction,pair:junction.fusionAtomIds.map(id=>Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])).sort((a,b)=>a-b)}))
    .sort((a,b)=>expectedFusions.findIndex(edge=>edge[0]===a.pair[0]&&edge[1]===a.pair[1])-expectedFusions.findIndex(edge=>edge[0]===b.pair[0]&&edge[1]===b.pair[1]));
  if(orderedJunctions.length!==3||orderedJunctions.some(item=>!expectedFusions.some(edge=>edge[0]===item.pair[0]&&edge[1]===item.pair[1])))return null;
  const language=parsed.language;
  const descriptorText=parsed.descriptor;
  const components:NameComponent[]=[{
    id:"steroid-parent",role:"parent",text:parsed.normalized,start:0,end:parsed.normalized.length,atomIds:actual.atoms.map(atom=>atom.id),bondIds:ringBonds,
    numbering:Object.entries(locants).map(([locant,id])=>[id,Number(locant)] as [number,number]),
    explanation:parsed.family==="estrane"?"Estrane has the saturated 6–6–6–5 steroid nucleus, C18 attached at C13, no C19 at C10, and no C17 side chain."
      :"Androstane has the saturated 6–6–6–5 steroid nucleus, C18 attached at C13 and C19 attached at C10, with no C17 side chain.",
    explanationEs:parsed.family==="estrane"?"El estrano tiene el núcleo esteroideo saturado 6–6–6–5, C18 unido a C13, no tiene C19 en C10 ni cadena lateral en C17."
      :"El androstano tiene el núcleo esteroideo saturado 6–6–6–5, C18 unido a C13 y C19 unido a C10, sin cadena lateral en C17."},
    ...ringLocants.map(([letter,positions])=>{const selected=positions.map(n=>locants[String(n)]!),ring=actual.rings?.find(item=>item.atomIds.length===positions.length&&item.atomIds.every(id=>selected.includes(id)));
      return {id:`steroid-ring-${letter}`,role:"parent" as const,text:"",start:0,end:parsed.normalized.length,atomIds:ring?[...ring.atomIds]:selected,
        bondIds:ringBonds.filter(([a,b])=>selected.includes(a)&&selected.includes(b)),numbering:selected.map((id,index)=>[id,positions[index]!] as [number,number]),
        label:`ring ${letter}`,labelEs:`anillo ${letter}`,explanation:`Ring ${letter} contains steroid locants ${positions.join(", ")}.`,explanationEs:`El anillo ${letter} contiene los localizadores esteroideos ${positions.join(", ")}.`};}),
    ...orderedJunctions.map(({junction},index)=>{const [a,b]=expectedFusions[index]!;return {id:`steroid-fusion-${index+1}`,role:"prefix" as const,text:"",start:0,end:parsed.normalized.length,
      atomIds:[...junction.fusionAtomIds],bondIds:[[...junction.fusionBond] as [number,number]],numbering:junction.fusionAtomIds.map(id=>[id,Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])] as [number,number]),
      label:`fusion C${a}–C${b}`,labelEs:`unión C${a}–C${b}`,explanation:`This is the shared C${a}–C${b} bond.`,explanationEs:`Este es el enlace compartido C${a}–C${b}.`};}),
    {id:"steroid-c18",role:"substituent",text:"C18",start:0,end:parsed.normalized.length,atomIds:[locants["18"]!],bondIds:[[locants["13"]!,locants["18"]!] as [number,number]],numbering:[[locants["18"]!,18]],label:"angular methyl C18",labelEs:"metilo angular C18",
      explanation:"C18 is the terminal angular methyl attached directly to C13.",explanationEs:"C18 es el metilo angular terminal unido directamente a C13."},
    ...(locants["19"]?[{id:"steroid-c19",role:"substituent" as const,text:"C19",start:0,end:parsed.normalized.length,atomIds:[locants["19"]],bondIds:[[locants["10"]!,locants["19"]] as [number,number]],numbering:[[locants["19"],19] as [number,number]],label:"angular methyl C19",labelEs:"metilo angular C19",
      explanation:"C19 is the terminal angular methyl attached directly to C10.",explanationEs:"C19 es el metilo angular terminal unido directamente a C10."}]:[]),
    ...([5,10,13,17] as const).map(locant=>({id:`steroid-locant-${locant}`,role:"prefix" as const,text:`C${locant}`,start:0,end:parsed.normalized.length,
      atomIds:[locants[String(locant)]!],bondIds:[],numbering:[[locants[String(locant)]!,locant] as [number,number]],label:`steroid C${locant}`,labelEs:`C${locant} esteroideo`,
      explanation:`This graph atom is steroid locant C${locant}.`,explanationEs:`Este átomo del grafo corresponde al localizador esteroideo C${locant}.`})),
    {id:"steroid-locants",role:"prefix",text:"",start:0,end:parsed.normalized.length,atomIds:Object.values(locants),bondIds:[],numbering:Object.entries(locants).map(([locant,id])=>[id,Number(locant)] as [number,number]),
      label:"steroid numbering",labelEs:"numeración esteroidea",explanation:"Conventional locants are mapped to graph atoms independently of drawing coordinates.",explanationEs:"Los localizadores convencionales se asignan a los átomos del grafo sin depender de las coordenadas del dibujo."},
    {id:"steroid-stereo",role:"prefix",text:descriptorText,start:0,end:descriptorText.length,atomIds:topology.junctions.flatMap(j=>j.fusionAtomIds).filter((id,index,all)=>all.indexOf(id)===index),bondIds:topology.junctions.map(j=>[...j.fusionBond] as [number,number]),numbering:[[locants["5"]!,5]],
      explanation:parsed.descriptor==="5ξ"?"The audited reference leaves C5 unresolved while retaining the other implicit steroid fusion configurations."
        :`The ${descriptorText} descriptor is checked against the complete stereochemical reference, not inferred from SMILES @/@@ or screen orientation.`,
      explanationEs:parsed.descriptor==="5ξ"?"La referencia auditada deja C5 sin resolver y conserva las demás configuraciones implícitas de las uniones esteroideas."
        :`El descriptor ${descriptorText} se contrasta con la referencia estereoquímica completa; no se deduce de @/@@ en SMILES ni de la orientación en pantalla.`}];
  const evidence:ValidatedCompositionalEvidence={source:"active-name",profile:"current",language,construction:"fused-steroid-family-stereo",
    rules:[{id:`steroid-${parsed.family}-parent`,source:"IUPAC-IUBMB Steroid Nomenclature (1989), 3S-1.1, 3S-1.3, 3S-1.5 and 3S-2.2/2.3; semisystematic parent, not claimed as a 2013 PIN"},
      {id:"steroid-reference-identity",source:"Audited PubChem isomeric structure and global stereochemical graph identity"}],
    parentSelection:"steroid-core",numbering:{scope:"parent",priorities:["conventional steroid numbering mapped from fused-ring graph and angular methyl anchors"],selected:Object.entries(locants).map(([n,id])=>[id,Number(n)]),reflected:[],comparison:0},
    stereo:parsed.descriptor==="5ξ"?"partially-specified-stereochemistry":"specified-fused-junction",reconstructedGraph:actual,
    atomMapping:actual.atoms.map(atom=>[atom.id,atom.id]),equivalence:"complete-graph-isomorphism"};
  return {status:"FULL",name:parsed.normalized,preferred:false,principalGroup:"none",components,parentAtomIds:actual.atoms.map(atom=>atom.id),evidence};
}

export function reconcileSteroidFamilyName(actual:GeneratedMolecule,name:string):ValidatedNameDerivation|null{
  const parsed=parseSteroidFamilyName(name);return parsed?makeDerivation(actual,parsed):null;
}
