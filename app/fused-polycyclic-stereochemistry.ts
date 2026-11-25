import type { GeneratedMolecule, GeneratedRing } from "./name-to-molecule.ts";
import { CanonizerUtil, Molecule as OCLMolecule, SmilesParser } from "openchemlib";

/** Metadata shared by saturated fused systems with any number of rings. */
export type FusedPolycyclicStereochemistry = {
  system: "saturated-fused-polycycle";
  ringSizes: number[];
  ringIds: number[];
  junctions: { ringIds: [number, number]; fusionAtomIds: [number, number]; fusionBond: [number, number] }[];
  specification: "unspecified" | "partial" | "complete";
  atomStereo: { atomId: number; parity: "R" | "S" | null }[];
  identityCode: string;
  connectivityCode: string;
  sourceSmiles: string;
  /** Optional conventional numbering, expressed as locant -> editable graph atom ID. */
  locantAtomIds?: Record<string, number>;
};

export type FusedPolycyclicTopology = {
  ringIds: number[];
  ringSizes: number[];
  junctions: FusedPolycyclicStereochemistry["junctions"];
};

export const AUDITED_GONANE_SMILES={
  "5ξ":"C1CCC2CC[C@H]3[C@@H]4CCC[C@H]4CC[C@@H]3[C@H]2C1",
  "5α":"C1CC[C@H]2[C@H](C1)CC[C@@H]3[C@@H]2CC[C@H]4[C@H]3CCC4",
  "5β":"C1CC[C@H]2[C@@H](C1)CC[C@@H]3[C@@H]2CC[C@H]4[C@H]3CCC4",
} as const;
const gonaneLocantSourceIndex:Record<string,number>={"1":2,"2":1,"3":0,"4":5,"5":4,"6":6,"7":7,"8":8,"9":9,"10":3,"11":10,"12":11,"13":12,"14":13,"15":14,"16":15,"17":16};
export function auditedGonaneLocantAtomIds(sourceSmiles:string):Record<string,number>|undefined{
  try{
    const reference=new SmilesParser().parseMolecule(AUDITED_GONANE_SMILES["5α"]);
    const target=new SmilesParser().parseMolecule(sourceSmiles);
    reference.removeExplicitHydrogens();target.removeExplicitHydrogens();
    reference.ensureHelperArrays(OCLMolecule.cHelperCIP);target.ensureHelperArrays(OCLMolecule.cHelperCIP);
    if(reference.getAllAtoms()!==17||target.getAllAtoms()!==17)return undefined;
    const graph=(molecule:OCLMolecule)=>({adj:Array.from({length:molecule.getAllAtoms()},(_,i)=>new Set(Array.from({length:molecule.getConnAtoms(i)},(_,j)=>molecule.getConnAtom(i,j)))),
      parity:Array.from({length:molecule.getAllAtoms()},(_,i)=>molecule.getAtomCIPParity(i))});
    const source=graph(reference),actual=graph(target),mapping=Array(17).fill(-1) as number[],used=new Set<number>(),solutions:number[][]=[];
    const order=Array.from({length:17},(_,i)=>i).sort((a,b)=>source.adj[b]!.size-source.adj[a]!.size);
    const visit=(depth:number)=>{
      if(solutions.length>1)return;
      if(depth===17){solutions.push([...mapping]);return;}
      const index=order[depth]!;
      for(let candidate=0;candidate<17;candidate++){
        if(used.has(candidate)||source.adj[index]!.size!==actual.adj[candidate]!.size)continue;
        // C5 is intentionally ignored here: this maps the skeleton without
        // allowing its 5α/5β inversion to change conventional numbering.
        if(index!==gonaneLocantSourceIndex["5"]&&source.parity[index]!==actual.parity[candidate])continue;
        let matches=true;
        for(let previous=0;previous<17;previous++)if(mapping[previous]!==-1
          &&source.adj[index]!.has(previous)!==actual.adj[candidate]!.has(mapping[previous]!)){matches=false;break;}
        if(!matches)continue;
        mapping[index]=candidate;used.add(candidate);visit(depth+1);used.delete(candidate);mapping[index]=-1;
      }
    };
    visit(0);
    if(solutions.length!==1)return undefined;
    const sourceToTarget=solutions[0]!;
    return Object.fromEntries(Object.entries(gonaneLocantSourceIndex).map(([locant,index])=>[locant,sourceToTarget[index]!+1]));
  }catch{return undefined;}
}

const edgeKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/** Finds a connected path of saturated carbon rings joined only by shared edges. */
export function findSaturatedFusedPolycycle(graph: GeneratedMolecule, expectedRingSizes?: readonly number[]): FusedPolycyclicTopology | null {
  const rings = graph.rings ?? [];
  if (rings.length < 2 || graph.atoms.length !== rings.reduce((sum, ring) => sum + ring.atomIds.length, 0) - (rings.length - 1) * 2) return null;
  if (graph.bonds.length !== rings.reduce((sum, ring) => sum + ring.atomIds.length, 0) - (rings.length - 1)) return null;
  if (expectedRingSizes && (rings.length !== expectedRingSizes.length
    || [...rings].map(r => r.atomIds.length).sort((a,b)=>a-b).join(",") !== [...expectedRingSizes].sort((a,b)=>a-b).join(","))) return null;
  if (graph.atoms.some(atom => (atom.element ?? "C") !== "C" || (atom.charge ?? 0) !== 0)
    || graph.bonds.some(([, , order]) => (order ?? 1) !== 1)) return null;
  const atomIds = new Set(graph.atoms.map(atom => atom.id));
  const edges = new Set(graph.bonds.map(([a,b]) => edgeKey(a,b)));
  if (edges.size !== graph.bonds.length || rings.some(ring => ring.kind !== "cycloalkane"
    || ring.atomIds.length < 3 || new Set(ring.atomIds).size !== ring.atomIds.length
    || ring.atomIds.some(id => !atomIds.has(id))
    || !ring.atomIds.every((id,index) => edges.has(edgeKey(id,ring.atomIds[(index+1)%ring.atomIds.length]!))))) return null;
  const shared: FusedPolycyclicTopology["junctions"] = [];
  for (let left=0; left<rings.length; left++) for(let right=left+1;right<rings.length;right++) {
    const overlap=rings[left]!.atomIds.filter(id=>rings[right]!.atomIds.includes(id));
    if (!overlap.length) continue;
    if(overlap.length!==2||!edges.has(edgeKey(overlap[0]!,overlap[1]!)))return null;
    shared.push({ringIds:[rings[left]!.id,rings[right]!.id],fusionAtomIds:[overlap[0]!,overlap[1]!],fusionBond:[overlap[0]!,overlap[1]!]});
  }
  if(shared.length!==rings.length-1)return null;
  if(new Set(shared.flatMap(j=>j.fusionAtomIds)).size!==shared.length*2)return null;
  const ringDegree=new Map(rings.map(r=>[r.id,shared.filter(j=>j.ringIds.includes(r.id)).length]));
  if([...ringDegree.values()].some(value=>value<1||value>2)||[...ringDegree.values()].filter(value=>value===1).length!==2)return null;
  const visited=new Set<number>();let current=[...ringDegree].find(([,degree])=>degree===1)?.[0];
  while(current!==undefined&&!visited.has(current)){
    visited.add(current);current=shared.find(j=>j.ringIds.includes(current!)&&j.ringIds.some(id=>!visited.has(id)))?.ringIds.find(id=>!visited.has(id));
  }
  if(visited.size!==rings.length)return null;
  const covered=new Set(rings.flatMap(r=>r.atomIds));
  if(covered.size!==atomIds.size||[...atomIds].some(id=>!covered.has(id)))return null;
  const degree=new Map([...atomIds].map(id=>[id,0]));
  for(const [a,b] of graph.bonds){degree.set(a,(degree.get(a)??0)+1);degree.set(b,(degree.get(b)??0)+1);}
  if([...degree.values()].some(d=>d!==2&&d!==3)||[...degree.values()].filter(d=>d===3).length!==shared.length*2)return null;
  return {ringIds:rings.map(r=>r.id),ringSizes:rings.map(r=>r.atomIds.length),junctions:shared};
}

function canonical(molecule: OCLMolecule, stereo: boolean) {
  const copy=new OCLMolecule(molecule.getAllAtoms(),molecule.getAllBonds());molecule.copyMolecule(copy);
  copy.removeExplicitHydrogens();copy.ensureHelperArrays(OCLMolecule.cHelperCIP);
  return CanonizerUtil.getIDCode(copy,stereo?CanonizerUtil.NORMAL:CanonizerUtil.NOSTEREO);
}

function connectivity(graph:GeneratedMolecule):string|null{
  try{
    const molecule=new OCLMolecule(graph.atoms.length,graph.bonds.length),map=new Map<number,number>();
    for(const atom of graph.atoms)map.set(atom.id,molecule.addAtom(6));
    for(const [a,b,order=1] of graph.bonds){if(order!==1||!map.has(a)||!map.has(b))return null;molecule.addBond(map.get(a)!,map.get(b)!);}
    molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);return CanonizerUtil.getIDCode(molecule,CanonizerUtil.NORMAL);
  }catch{return null;}
}

export function fusedPolycyclicStereochemistryFromImported(molecule:OCLMolecule,graph:GeneratedMolecule,sourceSmiles:string):FusedPolycyclicStereochemistry|null{
  try{
    const topology=findSaturatedFusedPolycycle(graph);if(!topology)return null;
    molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
    const junctionAtomIds=[...new Set(topology.junctions.flatMap(j=>j.fusionAtomIds))];
    const configured=junctionAtomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.tetrahedralParity).length;
    const specification=configured===0?"unspecified":configured===junctionAtomIds.length?"complete":"partial";
    const identityCode=canonical(molecule,true),connectivityCode=canonical(molecule,false);
    if(connectivity(graph)!==connectivityCode)return null;
    return {system:"saturated-fused-polycycle",ringSizes:topology.ringSizes,ringIds:topology.ringIds,junctions:topology.junctions,
      specification,atomStereo:graph.atoms.filter(a=>topology.junctions.some(j=>j.fusionAtomIds.includes(a.id)))
        .map(a=>({atomId:a.id,parity:a.tetrahedralParity??null})),identityCode,connectivityCode,sourceSmiles,
      ...(auditedGonaneLocantAtomIds(sourceSmiles)?{locantAtomIds:auditedGonaneLocantAtomIds(sourceSmiles)}:{})};
  }catch{return null;}
}

export function isValidFusedPolycyclicStereochemistry(graph:GeneratedMolecule):boolean{
  const metadata=graph.fusedPolycyclicStereo;if(!metadata)return true;
  try{
    if(metadata.system!=="saturated-fused-polycycle"||!Array.isArray(metadata.ringSizes)||!metadata.ringSizes.every(Number.isSafeInteger)
      ||!Array.isArray(metadata.ringIds)||!metadata.ringIds.every(Number.isSafeInteger)||new Set(metadata.ringIds).size!==metadata.ringIds.length
      ||!Array.isArray(metadata.junctions)||metadata.junctions.length!==metadata.ringIds.length-1
      ||!Array.isArray(metadata.atomStereo)||!metadata.identityCode||!metadata.connectivityCode||!metadata.sourceSmiles
      ||!["unspecified","partial","complete"].includes(metadata.specification))return false;
    const topology=findSaturatedFusedPolycycle(graph,metadata.ringSizes);if(!topology)return false;
    const graphAtomIds=new Set(graph.atoms.map(atom=>atom.id));
    if([...topology.ringIds].sort((a,b)=>a-b).join(",")!==[...metadata.ringIds].sort((a,b)=>a-b).join(","))return false;
    const expectedKeys=topology.junctions.map(j=>`${[...j.ringIds].sort().join(",")}|${edgeKey(...j.fusionBond)}`).sort();
    const storedKeys=metadata.junctions.map(j=>`${[...j.ringIds].sort().join(",")}|${edgeKey(...j.fusionBond)}`).sort();
    if(expectedKeys.join(";")!==storedKeys.join(";"))return false;
    const fusionIds=[...new Set(topology.junctions.flatMap(j=>j.fusionAtomIds))].sort((a,b)=>a-b);
    const actualStereo=fusionIds.map(atomId=>({atomId,parity:graph.atoms.find(atom=>atom.id===atomId)?.tetrahedralParity??null}));
    const storedStereo=[...metadata.atomStereo].sort((a,b)=>a.atomId-b.atomId);
    if(JSON.stringify(actualStereo)!==JSON.stringify(storedStereo))return false;
    const configured=actualStereo.filter(center=>center.parity!==null).length;
    const expectedSpecification=configured===0?"unspecified":configured===fusionIds.length?"complete":"partial";
    if(metadata.specification!==expectedSpecification)return false;
    const locantAtomIds=metadata.locantAtomIds;
    if(locantAtomIds){
      const audited=auditedGonaneLocantAtomIds(metadata.sourceSmiles);
      if(!audited||JSON.stringify(locantAtomIds)!==JSON.stringify(audited)
        ||Object.keys(locantAtomIds).length!==17||new Set(Object.values(locantAtomIds)).size!==17
        ||Object.values(locantAtomIds).some(id=>!graphAtomIds.has(id)))return false;
      const expectedEdges=[[5,10],[8,9],[13,14]].map(([a,b])=>edgeKey(locantAtomIds[String(a)]!,locantAtomIds[String(b)]!)).sort();
      if(expectedEdges.join(";")!==topology.junctions.map(j=>edgeKey(...j.fusionBond)).sort().join(";"))return false;
    }
    const parsed=new SmilesParser().parseMolecule(metadata.sourceSmiles);parsed.ensureHelperArrays(OCLMolecule.cHelperCIP);
    return metadata.identityCode===canonical(parsed,true)&&metadata.connectivityCode===canonical(parsed,false)
      &&metadata.connectivityCode===connectivity(graph);
  }catch{return false;}
}

export function sanitizeFusedPolycyclicStereochemistry<T extends GeneratedMolecule>(source:T):T{
  if(!source.fusedPolycyclicStereo||isValidFusedPolycyclicStereochemistry(source))return source;
  const {fusedPolycyclicStereo:_invalid,...rest}=source;return rest as T;
}
