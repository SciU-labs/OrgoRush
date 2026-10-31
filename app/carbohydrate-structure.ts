import { Molecule } from "openchemlib";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { editableValencesValid } from "./editable-valence.ts";
import { buildOpenChemLibStereoGraph, tetrahedralConfigurationFromOpenChemLib } from "./tetrahedral-stereochemistry.ts";

type Side = "right" | "left";
export type SugarFamily = { name:string; stem:string; carbons:5|6; carbonyl:1|2; pattern:string };
// Retained stereoparents, IUPAC P-102 Tables 10.2/10.3. Signs describe OH in
// the conventional acyclic Fischer frame, NEVER CIP R/S or screen directions.
export const SUGAR_FAMILIES: readonly SugarFamily[] = [
  {name:"ribose",stem:"ribo",carbons:5,carbonyl:1,pattern:"+++"},
  {name:"arabinose",stem:"arabino",carbons:5,carbonyl:1,pattern:"-++"},
  {name:"xylose",stem:"xylo",carbons:5,carbonyl:1,pattern:"+-+"},
  {name:"lyxose",stem:"lyxo",carbons:5,carbonyl:1,pattern:"--+"},
  {name:"glucose",stem:"gluco",carbons:6,carbonyl:1,pattern:"+-++"},
  {name:"mannose",stem:"manno",carbons:6,carbonyl:1,pattern:"--++"},
  {name:"galactose",stem:"galacto",carbons:6,carbonyl:1,pattern:"+--+"},
  {name:"fructose",stem:"fructo",carbons:6,carbonyl:2,pattern:"-++"},
];
export type CarbohydrateStructure = {
  carbonIds:number[]; numbering:[number,number][]; carbonylPosition:1|2;
  form:"open"|"furanose"|"pyranose";
  hydroxyls:{carbonId:number;oxygenId:number;locant:number}[];
  carbonyl?:{carbonId:number;oxygenId:number};
  ringAtomIds:number[]; ringOxygenId?:number; closurePosition?:number;
  anomericAtomId?:number; anomericHydroxylId?:number;
  configurationalAtomId:number; configurationalPosition:number;
  centers:{atomId:number;locant:number;configuration?:"R"|"S";fischerSide?:Side}[];
  series?:"D"|"L"; anomer?:"alpha"|"beta"; family?:SugarFamily;
  complete:boolean;
};
const key=(a:number,b:number)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

/** OCL relative parity uses ascending neighbor indices, with implicit H last.
 * Express the SAME tetrahedron in the ordered Fischer frame [up,down,OH,H]
 * (or the fourth explicit ligand). Vertical bonds recede; horizontal advance.
 * An even permutation and parity1 places OH right. This is a ligand-order
 * transformation, so changes of CIP priority on ring closure remain intact. */
function rightParity(ligands:readonly number[]):number {
  let inversions=0;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(ligands[i]>ligands[j])inversions++;
  return inversions%2?Molecule.cAtomParity2:Molecule.cAtomParity1;
}

// Recalculate CIP from the completed relative parities in a fresh OCL graph.
// The editor helper first computes priorities, then sets absolute configurations;
// its earlier Canonizer may still cache the provisional parity1 CIP values.
// Do not invalidate all helpers: that would perceive new parities from 2D.
function freshCipGraph(source:Molecule):Molecule {
  const result=new Molecule(source.getAllAtoms(),source.getAllBonds());
  for(let i=0;i<source.getAllAtoms();i++)result.addAtom(source.getAtomicNo(i));
  for(let i=0;i<source.getAllBonds();i++){
    const b=result.addBond(source.getBondAtom(0,i),source.getBondAtom(1,i));result.setBondOrder(b,source.getBondOrder(i));
  }
  result.ensureHelperArrays(Molecule.cHelperNeighbours);
  for(let i=0;i<source.getAllAtoms();i++)result.setAtomParity(i,source.getAtomParity(i),false);
  result.setParitiesValid(0);result.ensureHelperArrays(Molecule.cHelperCIP);
  return result;
}

/** Whole-molecule neutral, unmodified pentose/hexose envelope. Ring metadata
 * is deliberately unused: cycloalkane is a legacy nonaromatic storage tag. */
export function recognizeCarbohydrate(graph:GeneratedMolecule):CarbohydrateStructure|null {
  try {
    const atoms=graph.atoms;
    if(atoms.length<10||atoms.length>12||new Set(atoms.map(a=>a.id)).size!==atoms.length
      ||atoms.some(a=>!['C','O'].includes(a.element??'C')||a.charge||'isotope' in a||'mass' in a||'massNumber' in a)
      ||!editableValencesValid(graph))return null;
    const atomById=new Map(atoms.map(a=>[a.id,a])),edges=new Set<string>();
    for(const [a,b,o=1,stereo] of graph.bonds){
      if(!atomById.has(a)||!atomById.has(b)||a===b||edges.has(key(a,b))||![1,2].includes(o)||stereo!==undefined)return null;
      edges.add(key(a,b));
    }
    const ns=(id:number)=>graph.bonds.filter(([a,b])=>a===id||b===id).map(([a,b,o=1])=>({id:a===id?b:a,order:o}));
    const element=(id:number)=>atomById.get(id)!.element??'C';
    const cs=atoms.filter(a=>(a.element??'C')==='C').map(a=>a.id),os=atoms.filter(a=>a.element==='O').map(a=>a.id);
    const n=cs.length;if((n!==5&&n!==6)||os.length!==n)return null;
    const carbonNeighbors=(id:number)=>ns(id).filter(a=>element(a.id)==='C');
    if(cs.some(id=>carbonNeighbors(id).some(a=>a.order!==1)||carbonNeighbors(id).length>2))return null;
    const ends=cs.filter(id=>carbonNeighbors(id).length===1);if(ends.length!==2)return null;
    const oxos=os.filter(id=>ns(id).length===1&&ns(id)[0].order===2);
    const bridges=os.filter(id=>ns(id).length===2&&ns(id).every(a=>a.order===1&&element(a.id)==='C'));
    const hydroxylOs=os.filter(id=>ns(id).length===1&&ns(id)[0].order===1&&element(ns(id)[0].id)==='C');
    let carbonylId:number,ringOxygenId:number|undefined,anomericHydroxylId:number|undefined;
    if(oxos.length===1&&bridges.length===0&&hydroxylOs.length===n-1)carbonylId=ns(oxos[0])[0].id;
    else if(!oxos.length&&bridges.length===1&&hydroxylOs.length===n-1){
      ringOxygenId=bridges[0];
      const candidates=ns(ringOxygenId).filter(c=>ns(c.id).some(o=>hydroxylOs.includes(o.id)));
      if(candidates.length!==1)return null;
      carbonylId=candidates[0].id;
      anomericHydroxylId=ns(carbonylId).find(o=>hydroxylOs.includes(o.id))!.id;
    }else return null;
    const paths=ends.map(start=>{
      const path=[start];while(path.length<=n){const next=carbonNeighbors(path.at(-1)!).find(a=>!path.includes(a.id));if(!next)break;path.push(next.id);}return path;
    }).filter(path=>path.length===n);
    const ranked=paths.sort((a,b)=>a.indexOf(carbonylId)-b.indexOf(carbonylId));
    if(!ranked.length||ranked.length>1&&ranked[0].indexOf(carbonylId)===ranked[1].indexOf(carbonylId))return null;
    const carbonIds=ranked[0],carbonylPosition=carbonIds.indexOf(carbonylId)+1;
    if(carbonylPosition!==1&&carbonylPosition!==2)return null;
    const closureId=ringOxygenId===undefined?undefined:ns(ringOxygenId).find(c=>c.id!==carbonylId)!.id;
    const closurePosition=closureId===undefined?undefined:carbonIds.indexOf(closureId)+1;
    const ringSize=closurePosition===undefined?0:closurePosition-carbonylPosition+2;
    if(ringOxygenId!==undefined&&ringSize!==5&&ringSize!==6)return null;
    const {molecule,atomIdToIndex}=buildOpenChemLibStereoGraph(graph);
    molecule.ensureHelperArrays(Molecule.cHelperCIP);
    const configured=freshCipGraph(molecule);
    const h=(id:number)=>molecule.getImplicitHydrogens(atomIdToIndex.get(id)!);
    if(os.some(id=>h(id)!==(hydroxylOs.includes(id)?1:0)))return null;
    for(const [i,id] of carbonIds.entries()){
      const oxygenNeighbors=ns(id).filter(a=>element(a.id)==='O');
      if(oxygenNeighbors.length!==(ringOxygenId!==undefined&&id===carbonylId?2:1))return null;
      const expectedH=id===carbonylId?(carbonylPosition===1?1:0):i===0||i===n-1?2:1;
      if(h(id)!==expectedH)return null;
    }
    const centerPositions=Array.from({length:n-carbonylPosition-1},(_,i)=>i+carbonylPosition+1);
    if(ringOxygenId!==undefined)centerPositions.unshift(carbonylPosition);
    if(atoms.some(a=>a.tetrahedralParity&&!centerPositions.some(p=>carbonIds[p-1]===a.id)))return null;
    const index=(id:number)=>atomIdToIndex.get(id)!;
    const centers=centerPositions.map(locant=>{
      const id=carbonIds[locant-1],a=atomById.get(id)!;
      const oxygen=locant===closurePosition?ringOxygenId!:ns(id).find(o=>hydroxylOs.includes(o.id))!.id;
      const up=locant===1?ringOxygenId!:carbonIds[locant-2],down=carbonIds[locant];
      const fourth=locant===carbonylPosition&&carbonylPosition===2?index(ringOxygenId!):atoms.length;
      const ligands=[index(up),index(down),index(oxygen),fourth];
      const valid=molecule.isAtomStereoCenter(index(id));
      const verified=a.tetrahedralParity&&valid&&tetrahedralConfigurationFromOpenChemLib(configured,index(id))===a.tetrahedralParity;
      // The trivalent CHOH conversion is independently checked against the
      // retained aldose Fischer references. Quaternary ketose anomeric centres
      // need a separately established formal projection; do not infer alpha/beta
      // from their CIP letter or reuse the CHOH conversion for that centre.
      const side:Side|undefined=verified&&!(locant===carbonylPosition&&carbonylPosition===2)
        ?(molecule.getAtomParity(index(id))===rightParity(ligands)?'right':'left'):undefined;
      return {atomId:id,locant,configuration:verified?a.tetrahedralParity:undefined,fischerSide:side};
    });
    if(centers.some(c=>!molecule.isAtomStereoCenter(index(c.atomId))))return null;
    const reference=centers.find(c=>c.locant===n-1)!;
    const series=reference.fischerSide?(reference.fischerSide==='right'?'D':'L'):undefined;
    const pattern=centers.filter(c=>c.locant!==carbonylPosition).map(c=>c.fischerSide?(c.fischerSide===(series==='D'?'right':'left')?'+':'-'):'?').join('');
    const family=series?SUGAR_FAMILIES.find(f=>f.carbons===n&&f.carbonyl===carbonylPosition&&f.pattern===pattern):undefined;
    const anomeric=centers.find(c=>c.locant===carbonylPosition);
    const anomer=anomeric?.fischerSide&&reference.fischerSide?(anomeric.fischerSide===reference.fischerSide?'alpha':'beta'):undefined;
    return {carbonIds,numbering:carbonIds.map((id,i)=>[id,i+1]),carbonylPosition,
      form:ringSize===5?'furanose':ringSize===6?'pyranose':'open',
      hydroxyls:hydroxylOs.map(oxygenId=>{const carbonId=ns(oxygenId)[0].id;return {carbonId,oxygenId,locant:carbonIds.indexOf(carbonId)+1};}),
      ...(oxos.length?{carbonyl:{carbonId:carbonylId,oxygenId:oxos[0]}}:{}),
      ringAtomIds:ringOxygenId===undefined?[]:[...carbonIds.slice(carbonylPosition-1,closurePosition),ringOxygenId],
      ringOxygenId,closurePosition,anomericAtomId:ringOxygenId===undefined?undefined:carbonylId,anomericHydroxylId,
      configurationalAtomId:reference.atomId,configurationalPosition:n-1,centers,series,anomer,family,
      complete:centers.every(c=>!!c.configuration)};
  }catch{return null;}
}

/** Construct a stereoparent from chain length, carbonyl, closure and Fischer
 * configuration. Conversion to actual CIP descriptors is delegated to OCL. */
export function buildCarbohydrateGraph(n:5|6,carbonyl:1|2,closure?:number,pattern?:string,anomer?:Side):GeneratedMolecule|null {
  const graph:GeneratedMolecule={atoms:Array.from({length:2*n},(_,i)=>({id:i+1,element:i<n?'C':'O',x:0,y:0})),bonds:[]};
  for(let p=1;p<n;p++)graph.bonds.push([p,p+1,1]);
  for(let p=1;p<=n;p++)graph.bonds.push([p,n+p,!closure&&p===carbonyl?2:1]);
  if(closure)graph.bonds.push([carbonyl,n+closure,1]);
  if(!pattern)return graph;
  if(closure&&carbonyl===2)return null; // Retained ketose anomer grammar is not yet proved.
  if(pattern.length!==n-carbonyl-1||!/^[+-]+$/.test(pattern)||closure&&(!anomer||![5,6].includes(closure-carbonyl+2)))return null;
  const {molecule}=buildOpenChemLibStereoGraph(graph,false);
  const ps=Array.from({length:pattern.length},(_,i)=>i+carbonyl+1);
  if(closure)ps.unshift(carbonyl);
  for(const p of ps){
    const oxygen=p===closure?n+closure:n+p,up=p===1?n+closure!:p-1,down=p+1;
    const fourth=closure&&p===carbonyl&&carbonyl===2?n+closure-1:2*n;
    const parity=rightParity([up-1,down-1,oxygen-1,fourth]);
    const right=p===carbonyl?anomer==='right':pattern[p-carbonyl-1]==='+';
    molecule.setAtomParity(p-1,right?parity:parity===Molecule.cAtomParity1?Molecule.cAtomParity2:Molecule.cAtomParity1,false);
  }
  const configured=freshCipGraph(molecule);
  for(const p of ps){const configuration=tetrahedralConfigurationFromOpenChemLib(configured,p-1);if(!configuration)return null;graph.atoms[p-1].tetrahedralParity=configuration;}
  return graph;
}
