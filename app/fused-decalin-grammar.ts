import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { fusedRingJunctionStereoFromFusion, type FusedJunctionConfiguration } from "./fused-junction-stereochemistry.ts";

export type DecalinNameForm = "retained" | "systematic" | "pin";
export type ParsedDecalinName = { graph: GeneratedMolecule; language: "en" | "es"; form: DecalinNameForm;
  configuration: FusedJunctionConfiguration; normalized: string; descriptors?: [string,string] };

const rings: [number[],number[]] = [[1,3,4,5,6,2],[1,2,7,8,9,10]];
const coordinates: Record<number,[number,number]> = {
  1:[0,-0.5],2:[0,0.5],3:[-0.866,-1],4:[-1.732,-0.5],5:[-1.732,0.5],6:[-0.866,1],
  7:[0.866,1],8:[1.732,0.5],9:[1.732,-0.5],10:[0.866,-1],
};
function graphFor(configuration: FusedJunctionConfiguration): GeneratedMolecule {
  const ringEdges = rings.flatMap(ids => ids.map((id,index): [number,number,1] => [id,ids[(index+1)%ids.length]!,1]));
  const bonds = ringEdges.filter((bond,index) => ringEdges.findIndex(other => other[0]===bond[0]&&other[1]===bond[1]
    || other[0]===bond[1]&&other[1]===bond[0])===index);
  const graph: GeneratedMolecule = { atoms:Object.entries(coordinates).map(([id,[x,y]])=>({id:Number(id),x,y,element:"C"})),
    bonds, rings:rings.map((atomIds,index)=>({id:index+1,kind:"cycloalkane",atomIds:[...atomIds]})) };
  const stereo = fusedRingJunctionStereoFromFusion(graph,configuration);
  return stereo ? {...graph,fusedRingJunctionStereo:stereo} : graph;
}

export function parseFusedDecalinName(input: string): ParsedDecalinName | null {
  const normalized = input.trim().toLocaleLowerCase("en").normalize("NFC").replace(/\s+/g," ");
  const pin = /^\(4a([rs]),8a([rs])\)-(decahydronaphthalene|decahidronaftaleno)$/.exec(normalized);
  if (pin) {
    const spanish=pin[3]==="decahidronaftaleno";
    const descriptors=[pin[1]!,pin[2]!] as [string,string];
    // These exact absolute descriptors are tied to independently curated ChEBI structures.
    if (descriptors[0]==="s"&&descriptors[1]==="s") return {graph:graphFor("cis"),language:spanish?"es":"en",form:"pin",configuration:"cis",normalized,descriptors};
    if (descriptors[0]==="r"&&descriptors[1]==="r") return {graph:graphFor("trans"),language:spanish?"es":"en",form:"pin",configuration:"trans",normalized,descriptors};
    return null;
  }
  const aliases: Array<[RegExp,"en"|"es",DecalinNameForm,FusedJunctionConfiguration]> = [
    [/^(cis|trans)-decalin$/,"en","retained","cis"],
    [/^(cis|trans)-decahydronaphthalene$/,"en","systematic","cis"],
    [/^(cis|trans)-decalina$/,"es","retained","cis"],
    [/^(cis|trans)-decahidronaftaleno$/,"es","systematic","cis"],
  ];
  for (const [expression,language,form,defaultConfiguration] of aliases) {
    const match=expression.exec(normalized);
    if(match) return {graph:graphFor(match[1] as FusedJunctionConfiguration),language,form,configuration:match[1] as FusedJunctionConfiguration,normalized};
  }
  if(normalized==="decalin"||normalized==="decahydronaphthalene") return {graph:graphFor("unspecified"),language:"en",form:normalized==="decalin"?"retained":"systematic",configuration:"unspecified",normalized};
  if(normalized==="decalina"||normalized==="decahidronaftaleno") return {graph:graphFor("unspecified"),language:"es",form:normalized==="decalina"?"retained":"systematic",configuration:"unspecified",normalized};
  return null;
}
