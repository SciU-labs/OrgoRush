import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import { findSaturatedFusedTricycle, isValidFusedTricyclicStereochemistry } from "./fused-tricyclic-stereochemistry.ts";

type Reference = { topology: "linear" | "angular"; identityCode: string; descriptors?: string };
const references: Record<string, Reference> = {
  "tetradecahydroanthracene": {topology:"linear",identityCode:"fgA@@@DjYU_VByHujjjjjh@@"},
  "tetradecahydroanthracene|4aR,8aR,9aS,10aS": {topology:"linear",identityCode:"fgA@@@DjYU_VByHujjjjjh`EBLPh@",descriptors:"4aR,8aR,9aS,10aS"},
  "tetradecahydrophenanthrene": {topology:"angular",identityCode:"fgA@@@LdbbbTVKIBMjuUUUUT@@"},
  "tetradecahydrophenanthrene|4aR,4bS,8aS,10aR": {topology:"angular",identityCode:"fgA@@@LdbbbTVKIBMjuUUUUTPBaDHd@@",descriptors:"4aR,4bS,8aS,10aR"},
  "tetradecahydrophenanthrene|4aR,4bR,8aR,10aR": {topology:"angular",identityCode:"fgA@@@LdbbbTVKIBMjuUUUUTPDaDPd@@",descriptors:"4aR,4bR,8aR,10aR"},
  "tetradecahydrophenanthrene|4aR,4bR,8aS,10aR": {topology:"angular",identityCode:"fgA@@@LdbbbTVKIBMjuUUUUTPDaDHd@@",descriptors:"4aR,4bR,8aS,10aR"},
};

const hydrogenationLocants={
  anthracene:"1,2,3,4,4a,5,6,7,8,8a,9,9a,10,10a",
  phenanthrene:"1,2,3,4,4a,4b,5,6,7,8,8a,9,10,10a",
};
type Parsed = { language:"en"|"es"; root:"anthracene"|"phenanthrene"; descriptors?:string; locants?:string; normalized:string };
export function parseFusedTricyclicStereoName(input:string):Parsed|null {
  const normalized=input.trim().normalize("NFC").replace(/\s+/g," ");
  const match=/^(?:\(([^()]*)\)-)?(?:(\d+(?:,\d+[a-z]?)*)-)?(tetradecahydro(anthracene|phenanthrene)|tetradecahidro(antraceno|fenantreno))$/i.exec(normalized);
  if(!match)return null;
  const language=match[4]?"en":"es";
  const root=match[4]==="anthracene"||match[5]==="antraceno"?"anthracene":"phenanthrene";
  const descriptors=match[1]?.replace(/(\d+[a-z]?)([rs])/gi,(_all,locant:string,stereo:string)=>`${locant.toLowerCase()}${stereo.toUpperCase()}`);
  if(descriptors&&!/^(?:\d+[a-z]?[RS])(?:,\d+[a-z]?[RS])*$/.test(descriptors))return null;
  const locants=match[2]?.toLowerCase();
  if(locants&&locants!==hydrogenationLocants[root])return null;
  return {language,root,descriptors,locants,normalized};
}

export function reconcileFusedTricyclicStereoName(actual:GeneratedMolecule,name:string):ValidatedNameDerivation|null {
  const parsed=parseFusedTricyclicStereoName(name),metadata=actual.fusedRingSystemStereo;
  if(!parsed||!metadata||!isValidFusedTricyclicStereochemistry(actual)||metadata.specification==="partial")return null;
  const englishRoot=parsed.root==="anthracene"?"tetradecahydroanthracene":"tetradecahydrophenanthrene";
  const key=parsed.descriptors?`${englishRoot}|${parsed.descriptors}`:englishRoot;
  const reference=references[key]??(parsed.descriptors?undefined:references[englishRoot]);
  if(!reference||metadata.topology!==reference.topology||metadata.connectivityCode!==connectivityCodeFor(reference.topology))return null;
  if(reference.descriptors){
    if(!parsed.descriptors||parsed.descriptors!==reference.descriptors||metadata.specification!=="complete"
      ||metadata.identityCode!==reference.identityCode)return null;
  } else if(parsed.descriptors||metadata.specification!=="unspecified")return null;
  const fusion=findSaturatedFusedTricycle(actual);if(!fusion)return null;
  const allIds=actual.atoms.map(atom=>atom.id),allBonds=actual.bonds.map(([a,b])=>[a,b] as [number,number]);
  const components:NameComponent[]=[{
    id:"parent",role:"parent",text:parsed.normalized.slice(parsed.descriptors?parsed.normalized.indexOf(")-")+2:0),
    start:parsed.descriptors?parsed.normalized.indexOf(")-")+2:0,end:parsed.normalized.length,
    atomIds:allIds,bondIds:allBonds,numbering:[],
    explanation:parsed.root==="anthracene"?"The parent is a fully saturated linear system of three fused six-membered rings."
      :"The parent is a fully saturated angular system of three fused six-membered rings.",
    explanationEs:parsed.root==="anthracene"?"La estructura principal es un sistema lineal completamente saturado de tres anillos fusionados de seis miembros."
      :"La estructura principal es un sistema angular completamente saturado de tres anillos fusionados de seis miembros.",
  },...fusion.ringIds.map((ringId,index)=>{
    const ring=actual.rings?.find(item=>item.id===ringId)!;
    return {id:`fused-ring-${index+1}`,role:"parent" as const,text:"",start:0,end:parsed.normalized.length,
      atomIds:[...ring.atomIds],bondIds:actual.bonds.filter(([a,b])=>ring.atomIds.includes(a)&&ring.atomIds.includes(b)).map(([a,b])=>[a,b] as [number,number]),numbering:[],
      explanation:`Ring ${index+1} is a saturated six-membered ring in the fused tricyclic parent.`,
      explanationEs:`El anillo ${index+1} es un ciclo saturado de seis miembros del sistema tricíclico fusionado.`};
  }),...metadata.junctions.map((junction,index)=>({
    id:`fusion-junction-${index+1}`,role:"prefix" as const,text:"",start:0,end:parsed.normalized.length,
    atomIds:[...junction.fusionAtomIds],bondIds:[[...junction.fusionBond] as [number,number]],numbering:[],
    label:`fusion ${index+1}`,labelEs:`fusión ${index+1}`,
    explanation:`Fusion ${index+1} is the shared edge between two rings; its four fusion atoms are tracked in the global stereochemical identity.`,
    explanationEs:`La fusión ${index+1} es el enlace compartido por dos anillos; sus átomos se conservan en la identidad estereoquímica global.`,
  })),...(parsed.descriptors?[{
    id:"stereo-descriptor",role:"prefix" as const,text:`(${parsed.descriptors})-`,start:0,end:parsed.normalized.indexOf(")-")+2,
    atomIds:[...new Set(metadata.junctions.flatMap(junction=>junction.fusionAtomIds))],
    bondIds:metadata.junctions.map(junction=>[...junction.fusionBond] as [number,number]),numbering:[],
    explanation:"All four fusion-center descriptors are checked together against the canonical global stereochemical identity.",
    explanationEs:"Los cuatro descriptores de los centros de fusión se verifican juntos frente a la identidad estereoquímica global canónica.",
  }]:[])];
  const evidence:ValidatedCompositionalEvidence={source:"active-name",profile:"current",language:parsed.language,
    construction:"fused-tricyclic-stereo",rules:[{id:"saturated-fused-tricycle",source:"Three six-membered saturated rings with exactly two shared fusion edges"},
      {id:"global-fusion-stereo-identity",source:"All fusion descriptors must match one independently audited global stereochemical reference"}],
    parentSelection:"fused-ring-system",numbering:{scope:"parent",priorities:["verified retained fused parent"],selected:[],reflected:[],comparison:0},
    stereo:reference.descriptors?"specified-fused-junction":"unspecified-only",reconstructedGraph:actual,
    atomMapping:allIds.map(id=>[id,id]),equivalence:"complete-graph-isomorphism"};
  return {status:"FULL",name,preferred:false,principalGroup:"none",components,parentAtomIds:allIds,evidence};
}

function connectivityCodeFor(topology:"linear"|"angular") {
  return topology==="linear"?"fgA@@@DjYU_VByHujjjjjh@@":"fgA@@@LdbbbTVKIBMjuUUUUT@@";
}
