import { blueBookRule, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { retainedFusedParentTemplate, nameRetainedFused1979 } from "./iupac1979-retained-fused.ts";

type Lang = "en" | "es";
const parents = [
  { id:"indane", en:"2,3-dihydro-1H-indene", es:"2,3-dihidro-1H-indeno", saturated:["1","2","3"], aromatic:["3a","4","5","6","7","7a"] },
  { id:"indene", en:"indene", es:"indeno", saturated:["1"], aromatic:["3a","4","5","6","7","7a"] },
  { id:"1,2,3,4-tetrahydronaphthalene", en:"1,2,3,4-tetrahydronaphthalene", es:"1,2,3,4-tetrahidronaftaleno", saturated:["1","2","3","4"], aromatic:["4a","5","6","7","8","8a"] },
] as const;

export function fusedBicycleFaces(template:NonNullable<ReturnType<typeof retainedFusedParentTemplate>>) {
  const adjacency=new Map(template.graph.atoms.map(atom=>[atom.id,new Set<number>()]));
  for(const [a,b] of template.graph.bonds){adjacency.get(a)!.add(b);adjacency.get(b)!.add(a);}
  const cycles:number[][]=[];
  function walk(path:number[],size:number){
    const current=path.at(-1)!;
    for(const next of adjacency.get(current)!){
      if(next===path[0]&&path.length===size){if(path[1]!<path.at(-1)!)cycles.push([...path]);}
      else if(path.length<size&&next>path[0]!&&!path.includes(next))walk([...path,next],size);
    }
  }
  for(const size of [5,6])for(const atom of template.graph.atoms)walk([atom.id],size);
  return cycles.filter((cycle,index)=>cycles.findIndex(other=>[...other].sort((a,b)=>a-b).join(",")===[...cycle].sort((a,b)=>a-b).join(","))===index);
}

export function fusedBicycleLayout(template:NonNullable<ReturnType<typeof retainedFusedParentTemplate>>, faces:number[][]) {
  const points=template.locants.map(()=>({x:0,y:0})),placed=new Set<number>();
  const center=(ring:number[])=>ring.reduce((sum,id)=>({x:sum.x+points[id]!.x/ring.length,y:sum.y+points[id]!.y/ring.length}),{x:0,y:0});
  const polygon=(n:number)=>Array.from({length:n},(_,i)=>({x:Math.cos(2*Math.PI*i/n),y:Math.sin(2*Math.PI*i/n)}));
  const first=faces[0];if(!first)return null;const initial=polygon(first.length);first.forEach((id,i)=>{points[id]=initial[i]!;placed.add(id);});
  const hasEdge=(a:number,b:number)=>template.graph.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a);
  while(placed.size<points.length){let progress=false;
    for(const ring of faces){if(ring.every(id=>placed.has(id)))continue;
      const prior=faces.find(other=>other!==ring&&other.every(id=>placed.has(id))&&ring.filter(id=>other.includes(id)).length===2&&hasEdge(...ring.filter(id=>other.includes(id)) as [number,number]));
      if(!prior)continue;const shared=ring.filter(id=>prior.includes(id)),oldCenter=center(prior);
      const shape=polygon(ring.length);let chosen:{coords:{x:number;y:number}[];side:number}|undefined;
      for(let edge=0;edge<ring.length&&!chosen;edge++){
        const next=(edge+1)%ring.length,aId=ring[edge]!,bId=ring[next]!;
        if(!shared.includes(aId)||!shared.includes(bId))continue;
        const targetA=points[aId]!,targetB=points[bId]!,tx=targetB.x-targetA.x,ty=targetB.y-targetA.y;
        for(const mirror of [false,true]){
          const local=shape.map(point=>({x:point.x,y:mirror?-point.y:point.y})),pa=local[edge]!,pb=local[next]!;
          const sx=pb.x-pa.x,sy=pb.y-pa.y,angle=Math.atan2(ty,tx)-Math.atan2(sy,sx),cos=Math.cos(angle),sin=Math.sin(angle);
          const scale=Math.hypot(tx,ty)/Math.hypot(sx,sy);
          const transform=(p:{x:number;y:number})=>({x:targetA.x+scale*(cos*(p.x-pa.x)-sin*(p.y-pa.y)),y:targetA.y+scale*(sin*(p.x-pa.x)+cos*(p.y-pa.y))});
          const coords=ring.map((_,i)=>transform(local[i]!)),c=transform({x:0,y:0}),newSide=Math.sign(tx*(c.y-targetA.y)-ty*(c.x-targetA.x));
          const priorSide=Math.sign(tx*(oldCenter.y-targetA.y)-ty*(oldCenter.x-targetA.x));
          if(newSide!==priorSide){chosen={coords,side:newSide};break;}
        }
      }
      if(!chosen)continue;ring.forEach((id,i)=>{if(!placed.has(id)){points[id]=chosen!.coords[i]!;placed.add(id);}});progress=true;
    }
    if(!progress)return null;
  }
  return points;
}

export function fusedBicycleParentMatch(name:string,language:Lang) {
  for(const parent of parents){
    const full=parent[language],stem=language==="en"?full.replace(/e$/i,""):full.replace(/o$/i,"");
    const suffix=/-(\d+)-(ol|one|ona)$/.exec(name);
    const functionKind:"alcohol"|"ketone"|undefined=suffix?(suffix[2]==="ol"?"alcohol":"ketone"):undefined;
    const parentText=functionKind?name.slice(0,suffix!.index):name;
    const expectedOptions=functionKind==="ketone"&&parent.id==="indane"
      ?[language==="en"?"2,3-dihydroinden":"2,3-dihidroinden"]
      :functionKind==="ketone"&&parent.id==="1,2,3,4-tetrahydronaphthalene"
        ?[language==="en"?"3,4-dihydro-2H-naphthalen":"3,4-dihidro-2H-naftalen"]
        :parent.id==="indene"&&!functionKind?[`1H-${full}`,full]
          :[functionKind?stem:full];
    const expected=expectedOptions.find(option=>parentText.endsWith(option));if(!expected)continue;
    const prefix=parentText.slice(0,parentText.length-expected.length).replace(/-$/,"");
    const locant=suffix?Number(suffix[1]):undefined;
    if(functionKind==="ketone"&&(!["indane","1,2,3,4-tetrahydronaphthalene"].includes(parent.id)||locant!==1))continue;
    if(functionKind==="alcohol"&&(!["indane","1,2,3,4-tetrahydronaphthalene"].includes(parent.id)||locant===undefined))continue;
    return {parent,prefix,parentText,locant,functionKind,indicatedHydrogen:parent.id==="indene"&&expected===`1H-${full}`};
  }
  return null;
}

function parseSubstituents(source:string,language:Lang) {
  if(!source)return [] as {locant:number;kind:"methyl"|"bromo"|"chloro"}[];
  const result:{locant:number;kind:"methyl"|"bromo"|"chloro"}[]=[];
  const pieces=source.split("-");
  for(let i=0;i<pieces.length;){
    const locant=Number(pieces[i++]);const token=pieces[i++];
    if(!Number.isSafeInteger(locant)||!token)return null;
    const kind=token===(language==="en"?"methyl":"metil")?"methyl":token==="bromo"?"bromo":token===(language==="en"?"chloro":"cloro")?"chloro":null;
    if(!kind||result.some(item=>item.locant===locant))return null;
    result.push({locant,kind});
  }
  return result;
}

/** Strict small grammar for the audited 5+6 and hydrogenated 6+6 parents.
 * Every accepted spelling is reconstructed and compared with the graph-backed
 * name generator; this parser does not classify by formula or ring count. */
export function parseFusedPartiallySaturatedName(source:string):CompositionalFamilyGraph|null {
  const normalized=source.trim().toLocaleLowerCase("en").replace(/(\d)h(?=-)/g,"$1H");
  const language:Lang=/(?:hidro|indeno|naftaleno|metil|cloro)/.test(normalized)?"es":"en";
  const match=fusedBicycleParentMatch(normalized,language);if(!match)return null;
  const prefixes=parseSubstituents(match.prefix,language);if(!prefixes||prefixes.length>2)return null;
  const template=retainedFusedParentTemplate(match.parent.id);if(!template)return null;
  const faces=fusedBicycleFaces(template),coordinates=fusedBicycleLayout(template,faces);if(!coordinates)return null;
  const graph:GeneratedMolecule={atoms:[],bonds:[],rings:[]};
  const atom=(element:NonNullable<GeneratedMolecule["atoms"][number]["element"]>,anchor?:number)=>{
    const id=graph.atoms.length+1,point=anchor?coordinates[anchor-1]!:undefined;
    const center=coordinates.reduce((sum,item)=>({x:sum.x+item.x/coordinates.length,y:sum.y+item.y/coordinates.length}),{x:0,y:0});
    let dx=point?point.x-center.x:1,dy=point?point.y-center.y:0,magnitude=Math.hypot(dx,dy);
    if(magnitude<0.1){dx=1;dy=0;magnitude=1;}
    graph.atoms.push({id,element,x:point?point.x+0.85*dx/magnitude:coordinates[id-1]?.x??0,y:point?point.y+0.85*dy/magnitude:coordinates[id-1]?.y??0});return id;
  };
  template.graph.atoms.forEach((_,index)=>graph.atoms.push({id:index+1,element:"C",x:coordinates[index]!.x,y:coordinates[index]!.y}));
  for(const [a,b,order=1] of template.graph.bonds)graph.bonds.push([a+1,b+1,order as 1|2|3]);
  const locantId=new Map(template.locants.map((locant,index)=>[locant,index+1]));
  const components:NameComponent[]=[];const parentIds=template.graph.atoms.map((_,i)=>i+1);
  const add=(part:NameComponent)=>components.push(part);
  const bondsFor=(ids:readonly number[])=>graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b] as [number,number]);
  const parentStart=normalized.indexOf(match.parentText);
  add({id:"parent",role:"parent",text:match.parentText,start:parentStart,end:parentStart+match.parentText.length,
    atomIds:parentIds,bondIds:bondsFor(parentIds),numbering:template.locants.map((locant,index)=>[index+1,/^\d+$/.test(locant)?Number(locant):locant]),
    explanation:match.parent.id==="indane"?"Indane is expressed by its PIN parent 2,3-dihydro-1H-indene; locants 2 and 3 are hydrogenated while the benzene ring remains aromatic."
      :match.parent.id==="indene"?"Indene is an ortho-fused five- and six-membered ring system with one localized double bond in the five-membered ring."
        :"The parent is 1,2,3,4-tetrahydronaphthalene: one ring is saturated and the other remains aromatic.",
    explanationEs:match.parent.id==="indane"?"El PIN del indano es 2,3-dihidro-1H-indeno; los localizadores 2 y 3 están hidrogenados y el anillo de benceno conserva su aromaticidad."
      :match.parent.id==="indene"?"El indeno es un sistema ortofusionado de anillos de cinco y seis miembros con un doble enlace localizado en el anillo de cinco."
        :"El padre es 1,2,3,4-tetrahidronaftaleno: un anillo está saturado y el otro conserva su aromaticidad.",numberingScope:"parent"});
  for(const [index,face] of faces.entries()){
    const ids=face.map(id=>id+1),ringLocants=face.map(id=>template.locants[id]!);
    const aromatic=ringLocants.every(locant=>match.parent.aromatic.includes(locant as never));
    add({id:`fused-ring:${index+1}`,role:"parent",text:match.parentText,start:parentStart,end:parentStart+match.parentText.length,
      atomIds:ids,bondIds:bondsFor(ids),numbering:face.map(id=>[id+1,/^\d+$/.test(template.locants[id]!)?Number(template.locants[id]!):template.locants[id]!]),
      label:language==="en"?`${face.length}-membered ${aromatic?"aromatic":"saturated or partially saturated"} ring ${index+1}`:`Anillo ${aromatic?"aromático":"saturado o parcialmente insaturado"} de ${face.length} miembros ${index+1}`,
      explanation:`This ${face.length}-membered ring is a constituent face of the fused parent; shared atoms and bonds occur once in the graph.`,
      explanationEs:`Este anillo de ${face.length} miembros es una cara del padre fusionado; los átomos y enlaces compartidos aparecen una sola vez en el grafo.`,numberingScope:"parent"});
  }
  const hydrogenatedLocants=match.parent.id==="1,2,3,4-tetrahydronaphthalene"&&match.functionKind==="ketone"?["2","3","4"]:match.parent.saturated;
  const aromaticIds=match.parent.aromatic.map(locant=>locantId.get(locant)!).filter(Boolean),saturatedIds=hydrogenatedLocants.map(locant=>locantId.get(locant)!).filter(Boolean);
  add({id:"aromatic-region",role:"parent",text:match.parentText,start:parentStart,end:parentStart+match.parentText.length,atomIds:aromaticIds,bondIds:bondsFor(aromaticIds),numbering:match.parent.aromatic.map(locant=>[locantId.get(locant)!,/^\d+$/.test(locant)?Number(locant):locant]),label:language==="en"?"Aromatic region":"Región aromática",explanation:"The aromatic region is assigned from the parent bond pattern and valence, not from the presence of a ring alone.",explanationEs:"La región aromática se identifica por el patrón de enlaces y la valencia del padre, no solo por la presencia de un anillo."});
  if(saturatedIds.length)add({id:"hydrogenated-region",role:"parent",text:match.parentText,start:parentStart,end:parentStart+match.parentText.length,atomIds:saturatedIds,bondIds:bondsFor(saturatedIds),numbering:hydrogenatedLocants.map(locant=>[locantId.get(locant)!,Number(locant)]),label:language==="en"?"Hydrogenated positions":"Posiciones hidrogenadas",explanation:`Hydrogenated positions ${hydrogenatedLocants.join(", ")} are saturated in this parent; they are not Kekulé alternatives.`,explanationEs:`Las posiciones ${hydrogenatedLocants.join(", ")} están saturadas en este padre; no son variantes de Kekulé.`});
  const fusionEdges=new Set<string>();for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
    const shared=faces[i]!.filter(id=>faces[j]!.includes(id));if(shared.length===2){const edge=graph.bonds.find(([a,b])=>shared.includes(a-1)&&shared.includes(b-1));if(edge)fusionEdges.add(`${Math.min(edge[0],edge[1])}:${Math.max(edge[0],edge[1])}`);}}
  const fusionBonds=[...fusionEdges].map(key=>key.split(":").map(Number) as [number,number]);
  add({id:"fusion-bond",role:"parent",text:match.parentText,start:parentStart,end:parentStart+match.parentText.length,atomIds:[...new Set(fusionBonds.flat())],bondIds:fusionBonds,numbering:[],label:language==="en"?"Fusion bond":"Enlace de fusión",explanation:"The two rings share this exact bond and its endpoint atoms.",explanationEs:"Los dos anillos comparten exactamente este enlace y sus átomos terminales."});
  for(const item of prefixes){const anchor=locantId.get(String(item.locant));if(!anchor)return null;
    const element=item.kind==="bromo"?"Br":item.kind==="chloro"?"Cl":"C",branch=atom(element,anchor);graph.bonds.push([anchor,branch,1]);
    const text=`${item.locant}-${language==="en"?item.kind:item.kind==="methyl"?"metil":item.kind==="chloro"?"cloro":item.kind}`;
    const start=normalized.indexOf(text);add({id:`substituent:${item.kind}:${item.locant}`,role:"substituent",text,start,end:start+text.length,parentId:"parent",locant:item.locant,atomIds:[branch],bondIds:[[anchor,branch]],numbering:[[anchor,item.locant]],explanation:`The ${item.kind} group is attached at parent locant ${item.locant}.`,explanationEs:`El grupo ${item.kind==="methyl"?"metil":item.kind} está unido al localizador parental ${item.locant}.`,numberingScope:"parent"});
  }
  if(match.locant&&match.functionKind){const anchor=locantId.get(String(match.locant));if(!anchor)return null;const oxygen=atom("O",anchor),order=match.functionKind==="ketone"?2:1;graph.bonds.push([anchor,oxygen,order]);
    const start=normalized.lastIndexOf(`-${match.locant}-`),suffix=normalized.slice(start);
    add({id:`${match.functionKind}-suffix`,role:"suffix",text:suffix,start,end:start+suffix.length,parentId:"parent",locant:match.locant,atomIds:[anchor,oxygen],bondIds:[[anchor,oxygen]],numbering:[[anchor,match.locant]],explanation:match.functionKind==="ketone"?`The ring carbonyl at locant ${match.locant} is expressed by the suffix -one.`:`The hydroxyl group at locant ${match.locant} is expressed by the suffix -ol.`,explanationEs:match.functionKind==="ketone"?`El carbonilo del anillo en el localizador ${match.locant} se expresa con el sufijo -ona.`:`El grupo hidroxilo en el localizador ${match.locant} se expresa con el sufijo -ol.`,numberingScope:"parent"});
  }
  graph.rings=faces.map((face,index)=>({id:index+1,kind:face.every(id=>match.parent.aromatic.includes(template.locants[id] as never))?"aromatic":"cycloalkane",atomIds:face.map(id=>id+1)}));
  const proof=nameRetainedFused1979({atoms:graph.atoms,bonds:graph.bonds});
  const canonicalInput=match.indicatedHydrogen?normalized.replace(/-?1H-/,""):normalized;
  if(proof.status!=="SUPPORTED"||proof.parentId!==match.parent.id||proof[language==="en"?"nameEn":"nameEs"]!==canonicalInput)return null;
  // Keep component spans literal to the submitted name. The parser normalizes
  // indicated-hydrogen capitalization for recognition, but the derivation
  // still needs source-faithful text spans (for example, `1h` in an app
  // generated display name) so changing locale does not invalidate the proof.
  const sourceComponents=components.map(item=>({...item,text:source.slice(item.start,item.end)}));
  return {graph,components:sourceComponents,parent:parentIds,group:match.functionKind??"none",allowEquivalentNumbering:true,
    evidence:{source:"active-name",profile:"current",language,construction:"fused-partially-saturated-bicycle",parentSelection:"aromatic-parent",
      rules:[blueBookRule("P-14.4","P1"),blueBookRule("P-25.3.3","P2"),blueBookRule("P-31.2.2","P3"),blueBookRule("P-31.2.3.3.1","P3")],
      numbering:{scope:"parent",priorities:["fixed-fused-parent-numbering","hydrogenation-locants","suffix-locants","substituent-locants"],selected:[...(match.locant?[[match.locant]]:[]),...prefixes.map(item=>[item.locant])],reflected:[],comparison:0},stereo:"unspecified-only"}};
}

export const FUSED_PARTIALLY_SATURATED_PARENT_IDS=parents.map(parent=>parent.id);
