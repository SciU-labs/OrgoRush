import { Molecule } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent } from "./validated-name-derivation.ts";
import { buildOpenChemLibStereoGraph } from "./tetrahedral-stereochemistry.ts";
import { mapStructuralRegions } from "./structural-derivation.ts";

// Retained purine numbering (IUPAC P-25.2.1 / P-25.3.3), not SMILES order.
// The six-membered circuit is 1-2-3-4-5-6; the five-membered is 4-5-7-8-9.
export const PURINE_EDGES: readonly (readonly [number,number])[] =
  [[1,2],[2,3],[3,4],[4,5],[5,6],[6,1],[5,7],[7,8],[8,9],[9,4]];
export const PURINE_NITROGENS = [1,3,7,9] as const;
const nitrogen = (p:number) => (PURINE_NITROGENS as readonly number[]).includes(p);
const edgeKey = (a:number,b:number) => `${Math.min(a,b)}:${Math.max(a,b)}`;
const positions = Array.from({length:9},(_,i)=>i+1);

export type PurineParent = {
  atomIds:number[]; numbering:[number,number][]; bondIds:[number,number][];
  nitrogenIds:number[]; fusionAtomIds:number[]; hydrogens:[number,number][];
};

/** Constitution recognition ignores bond placement only to identify the
 * retained skeleton. It does not prove a name, tautomer or hydrogenation. */
export function recognizePurineParent(graph:GeneratedMolecule):PurineParent|null {
  if(!mapStructuralRegions(graph,graph,[]))return null;
  const {molecule,atomIdToIndex}=buildOpenChemLibStereoGraph(graph);
  molecule.ensureHelperArrays(Molecule.cHelperRings);
  const ringEdges=graph.bonds.filter((_,i)=>molecule.isRingBond(i));
  const ids=[...new Set(ringEdges.flatMap(([a,b])=>[a,b]))];
  if(ids.length!==9 || ringEdges.length!==10)return null;
  const edges=new Set(ringEdges.map(([a,b])=>edgeKey(a,b)));
  const degree=(id:number)=>ringEdges.filter(([a,b])=>a===id||b===id).length;
  const degreeAt=(p:number)=>PURINE_EDGES.filter(([a,b])=>a===p||b===p).length;
  const options=new Map(positions.map(p=>[p,ids.filter(id=>{
    const a=graph.atoms.find(a=>a.id===id)!;
    return (a.element??"C")===(nitrogen(p)?"N":"C") && !(a.charge??0) && degree(id)===degreeAt(p);
  })]));
  const order=[...positions].sort((a,b)=>options.get(a)!.length-options.get(b)!.length);
  const assigned=new Map<number,number>(),used=new Set<number>(),solutions:Map<number,number>[]=[];
  let visits=0;
  const visit=(i:number)=>{
    if(++visits>20000 || solutions.length>1)return;
    if(i===9){solutions.push(new Map(assigned));return;}
    const p=order[i];
    for(const id of options.get(p)!) {
      if(used.has(id)||[...assigned].some(([q,j])=>PURINE_EDGES.some(([a,b])=>edgeKey(a,b)===edgeKey(p,q))!==edges.has(edgeKey(id,j))))continue;
      assigned.set(p,id);used.add(id);visit(i+1);used.delete(id);assigned.delete(p);
    }
  };
  visit(0);if(visits>20000 || solutions.length!==1)return null;
  const map=solutions[0],atomIds=positions.map(p=>map.get(p)!);
  return {atomIds,numbering:positions.map(p=>[map.get(p)!,p]),
    bondIds:PURINE_EDGES.map(([a,b])=>[map.get(a)!,map.get(b)!]),
    nitrogenIds:PURINE_NITROGENS.map(p=>map.get(p)!),fusionAtomIds:[map.get(4)!,map.get(5)!],
    hydrogens:positions.map(p=>[map.get(p)!,molecule.getImplicitHydrogens(atomIdToIndex.get(map.get(p)!)!)]),
  };
}

type Segment = {text:string;start:number;positions:number[]};
export type PurineSyntax = {
  methyl?:Segment; hydro?:Segment; indicated?:Segment;
  parent:Segment; oxo?:Segment;
};
const list=(s:string)=>s.split(",").map(Number);
const ordered=(ns:number[])=>ns.every((p,i)=>p>=1&&p<=9&&(!i||p>ns[i-1]));
const multiplicity:Record<string,number>={"":1,di:2,tri:3,tetra:4};

/** Finite, fully consumed grammar: methyl / hydro / indicated H / retained
 * parent / oxo suffix. Common compound names never enter this production. */
export function parsePurineSyntax(name:string):PurineSyntax|null {
  if(name.length>200)return null;
  let rest=name,offset=0;
  const result:Partial<PurineSyntax>={};
  const take=(kind:"methyl"|"hydro"|"indicated",pattern:RegExp)=>{
    const m=pattern.exec(rest);if(!m)return;
    const ns=list(m[1].replace(/H/g,""));
    if(!ordered(ns))return false;
    const count=kind==="indicated"?ns.length:multiplicity[m[2]??""];
    if(ns.length!==count || kind!=="methyl"&&ns.some(p=>!nitrogen(p)))return false;
    result[kind]={text:m[0].replace(/-$/,""),start:offset,positions:ns};
    rest=rest.slice(m[0].length);offset+=m[0].length;return true;
  };
  if(take("methyl",/^([1-9](?:,[1-9])*)-(di|tri|tetra)?methyl(?=-|purin)-?/)===false)return null;
  if(take("hydro",/^([1-9](?:,[1-9])*)-(di|tetra)hydro(?=-|purin)-?/)===false)return null;
  if(take("indicated",/^([1-9]H(?:,[1-9]H)*)-/)===false)return null;
  const tail=/^(purine)(?:-([268](?:,[268])*)-(dione|trione))?$|^(purin)-([268])-(one)$/.exec(rest);
  if(!tail)return null;
  const word=tail[1]??tail[4];result.parent={text:word,start:offset,positions};
  const oxoList=tail[2]??tail[5],suffix=tail[3]??tail[6];
  if(oxoList) {
    const ns=list(oxoList),count=suffix==="one"?1:suffix==="dione"?2:3;
    if(!ordered(ns)||ns.length!==count)return null;
    result.oxo={text:`${oxoList}-${suffix}`,start:offset+word.length+1,positions:ns};
  }
  if(result.hydro && !result.oxo)return null; // Reduced carbon sites need a wider grammar.
  if(result.methyl?.positions.some(p=>p===4||p===5||result.oxo?.positions.includes(p)))return null;
  if(result.hydro?.positions.some(p=>result.indicated?.positions.includes(p)))return null;
  return result as PurineSyntax;
}

/** Construct ALL maximum noncumulative-double-bond arrangements satisfying
 * the stated neutral valences and H/substitution sites. Keep H on each atom;
 * never select a tautomer by matching the actual editor molecule. */
export function buildPurineGraph(syntax:PurineSyntax):GeneratedMolecule|null {
  const methyl=syntax.methyl?.positions??[],oxo=syntax.oxo?.positions??[];
  const saturated=new Set([...(syntax.hydro?.positions??[]),...(syntax.indicated?.positions??[]),...methyl.filter(nitrogen)]);
  // P-25.7.1.3.1 permits omission of 7H for the unsubstituted parent.
  if(!syntax.methyl&&!syntax.hydro&&!syntax.indicated&&!syntax.oxo)saturated.add(7);
  const candidates:GeneratedMolecule[]=[];let maximum=-1;
  for(let mask=0;mask<1<<PURINE_EDGES.length;mask++) {
    const doubles=positions.map(p=>PURINE_EDGES.reduce((n,[a,b],i)=>n+((a===p||b===p)&&(mask&(1<<i))?1:0),0));
    if(positions.some(p=>{
      const d=doubles[p-1];
      if(d>1)return true;
      if(nitrogen(p))return saturated.has(p)&&d!==0;
      return d!==(oxo.includes(p)?0:1);
    }))continue;
    const count=doubles.reduce((n,d)=>n+d,0)/2;
    if(count<maximum)continue;
    const graph:GeneratedMolecule={atoms:positions.map(id=>({id,element:nitrogen(id)?"N":"C",x:0,y:0})),
      bonds:PURINE_EDGES.map(([a,b],i)=>[a,b,mask&(1<<i)?2:1])};
    for(const p of oxo){const id=graph.atoms.length+1;graph.atoms.push({id,element:"O",x:0,y:0});graph.bonds.push([p,id,2]);}
    for(const p of methyl){const id=graph.atoms.length+1;graph.atoms.push({id,element:"C",x:0,y:0});graph.bonds.push([p,id,1]);}
    if(count>maximum){maximum=count;candidates.length=0;}
    candidates.push(graph);
  }
  if(!candidates.length)return null;
  const graph=candidates[0];
  // Fixed locants must retain identical H populations AND normalized bonds
  // across every candidate. Multiple Kekulé drawings are fine; tautomers aren't.
  if(candidates.some(other=>!mapStructuralRegions(graph,other,positions.map(p=>[p]))))return null;
  return graph;
}

export function parsePurineFamily(name:string) {
  const syntax=parsePurineSyntax(name);if(!syntax)return null;
  const graph=buildPurineGraph(syntax);if(!graph)return null;
  const parent=recognizePurineParent(graph);if(!parent)return null;
  const components:NameComponent[]=[];
  const add=(id:string,role:NameComponent["role"],s:Segment,ids:number[],explanation:string,label?:string,bonds?:[number,number][])=>{
    components.push({id,role,text:s.text,start:s.start,end:s.start+s.text.length,atomIds:ids,
      bondIds:bonds??graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b]),
      numbering:s.positions.map(p=>[p,p]),explanation,...(label?{label}:{})});
  };
  add("parent","parent",syntax.parent,positions,
    "Purine is one fused nine-position parent, not two independent parents. Its retained numbering has N at 1, 3, 7 and 9 and fusion carbons at 4 and 5. Select this fragment to inspect all nine locants.");
  add("purine-nitrogens","parent",{...syntax.parent,positions:[...PURINE_NITROGENS]},[...PURINE_NITROGENS],
    "These four ring nitrogens are positions 1, 3, 7 and 9 of the same retained parent. Element identity and connectivity determine the locants, independently of drawing orientation.","Ring nitrogens · 1, 3, 7, 9");
  add("purine-fusion","parent",{...syntax.parent,positions:[4,5]},[4,5],
    "Carbons 4 and 5 and their shared bond fuse the six- and five-membered circuits; neither atom is duplicated.","Fusion · 4, 5");
  if(syntax.methyl) {
    const s=syntax.methyl,ids=s.positions.map(p=>graph.bonds.find(([a,b])=>a===p&&b>9&&(graph.atoms[b-1].element==="C"))![1]);
    add("purine-methyl","prefix",s,ids,
      `${s.text} specifies ${ids.length} methyl group(s), one at each of positions ${s.positions.join(", ")}. Each methyl replaces a parent H; a methylated ring N carries no N–H. ${ids.length===1?"One methyl needs no multiplying prefix.":`${["","","Di","Tri","Tetra"][ids.length]}- counts these ${ids.length} distinct methyl groups.`}`,undefined,s.positions.map((p,i)=>[p,ids[i]]));
  }
  for(const [kind,s] of [["hydro",syntax.hydro],["indicated",syntax.indicated]] as const)if(s) {
    const occupied=s.positions.filter(p=>syntax.methyl?.positions.includes(p));
    add(`purine-${kind}`,"prefix",s,s.positions,
      `${s.text} fixes the single-bonded parent nitrogen site(s) ${s.positions.join(", ")}. ${occupied.length?`Methyl substitution replaces the parent H at ${occupied.join(", ")}; these sites have no remaining N–H.`:"Each selected nitrogen retains one hydrogen in this structure."} Hydrogen populations are checked per atom; another tautomer is not interchangeable.`);
  }
  if(syntax.oxo) {
    const s=syntax.oxo,oxygenIds=s.positions.map(p=>graph.bonds.find(([a,b,o])=>a===p&&o===2&&graph.atoms[b-1].element==="O")![1]);
    add("purine-oxo","suffix",s,[...s.positions,...oxygenIds],
      `${s.text} specifies ${s.positions.length} C=O group(s) at parent carbon(s) ${s.positions.join(", ")}. ${s.positions.length===2?"Dione means two oxo groups.":s.positions.length===3?"Trione means three oxo groups.":"One denotes one oxo group."} Their carbonyl carbons remain part of the fused parent.`);
  }
  const nh=parent.hydrogens.filter(([p,h])=>nitrogen(p)&&h>0).map(([p])=>p);
  const implied=nh.filter(p=>!syntax.hydro?.positions.includes(p)&&!syntax.indicated?.positions.includes(p));
  components[0].explanation+=nh.length?` The reconciled neutral graph has N–H at ${nh.join(", ")}.`:" The reconciled neutral graph has no N–H bonds.";
  if(implied.length)components[0].explanation+=` At N${implied.join(", N")}, two single ring bonds and neutral nitrogen valence three leave one implicit H. These unlisted H sites are checked in the graph rather than added to the written hydro locants.`;
  return {graph,components,parent:positions,group:"heterocycle" as const,parentSystem:"purine" as const};
}
