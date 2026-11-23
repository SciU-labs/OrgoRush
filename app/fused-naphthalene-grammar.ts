import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { blueBookRule, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";

type Language = "en" | "es";
type Family = CompositionalFamilyGraph;
type Prefix = { token: string; locants: number[]; term: NonNullable<ReturnType<typeof legacyPrefixTerm>>; start: number; end: number; termStart: number };

// P-25.3.3 numbering: the conventional naphthalene skeleton has eight
// peripheral positions and fusion atoms 4a/8a. One graph atom is created for
// each locant; both six-membered cycles use the same two fusion atoms and edge.
const labels = ["1", "2", "3", "4", "4a", "5", "6", "7", "8", "8a"] as const;
const perimeter = labels.map((_, index) => [index, (index + 1) % labels.length] as const);
const coreEdges = [...perimeter, [4, 9] as const];
const doubleEdges = new Set(["0:1", "2:3", "4:5", "6:7", "8:9"]);
const locantAtom = new Map<number, number>([[1,0],[2,1],[3,2],[4,3],[5,5],[6,6],[7,7],[8,8]]);
const transforms = [
  [1,2,3,4,5,6,7,8],
  [4,3,2,1,8,7,6,5],
  [5,6,7,8,1,2,3,4],
  [8,7,6,5,4,3,2,1],
];

function bestNumbering(locants: number[][], suffixLocants: number[] = []): boolean {
  const score = (sets: number[][]) => [sets.flat().sort((a,b)=>a-b), ...sets.map(set=>[...set].sort((a,b)=>a-b))];
  const compare = (a: number[][], b: number[][]) => {
    for (let i=0;i<Math.max(a.length,b.length);i++) for(let j=0;j<Math.max(a[i]?.length??0,b[i]?.length??0);j++) {
      const delta=(a[i]?.[j]??-1)-(b[i]?.[j]??-1); if(delta)return delta;
    }
    return 0;
  };
  const current = score([...(suffixLocants.length?[suffixLocants]:[]), ...locants]);
  for(const map of transforms) {
    const candidate=score([...(suffixLocants.length?[suffixLocants.map(value=>map[value-1]!)]:[]), ...locants.map(set=>set.map(value=>map[value-1]!))]);
    if(compare(candidate,current)<0)return false;
  }
  return true;
}

function scanPrefixes(source: string, language: Language): Prefix[] | null {
  const result: Prefix[]=[]; let cursor=0;
  while(cursor<source.length) {
    const match=/^([1-8](?:,[1-8])*)-((?:di|tri)?[a-z]+)/.exec(source.slice(cursor));
    if(!match)return null;
    const locants=match[1]!.split(",").map(Number), body=match[2]!;
    if(new Set(locants).size!==locants.length||locants.some((value,index)=>index>0&&value<=locants[index-1]!))return null;
    const multiplied=/^(di|tri)(.+)$/.exec(body);
    const termName=multiplied?.[2]??body, term=legacyPrefixTerm(termName);
    const count=multiplied?.[1]==="di"?2:multiplied?.[1]==="tri"?3:1;
    if(!term||term[language]!==termName||locants.length!==count
      ||term.kind&&!(["halogen","nitro","ether"].includes(term.kind))
      ||term.kind===undefined&&term.elements.length!==1
      ||term.elements.some(element=>!["C","O","N","F","Cl","Br","I"].includes(element)))return null;
    if(result.some(entry=>entry.term[language]===term[language]||entry.locants.some(locant=>locants.includes(locant))))return null;
    const termStart=cursor+match[1]!.length+1;
    result.push({token:match[2]!,locants,term,start:cursor,end:cursor+match[0].length,termStart});
    cursor+=match[0].length;
    if(cursor<source.length){if(source[cursor]!=="-")return null;cursor++;}
  }
  const key=(entry:Prefix)=>entry.term[language].replace(/[^a-z]/g,"");
  if(result.some((entry,index)=>index>0&&key(result[index-1]!).localeCompare(key(entry),language)>0))return null;
  return result;
}

/** A finite current-profile grammar for naphthalene and its supported
 * detachable prefixes and characteristic groups. It constructs one fused
 * graph and then lets strict constitutional isomorphism validate the input. */
export function parseFusedNaphthalene(name: string): Family | null {
  const language:Language=name.includes("naftaleno")||name.includes("naftalen-")||name.includes("naftalen")?"es":"en";
  const graph:Family["graph"]={atoms:[],bonds:[]};
  const components:NameComponent[]=[];
  const atom=(element:NonNullable<Family["graph"]["atoms"][number]["element"]>,charge?:number)=>{
    const id=graph.atoms.length+1;graph.atoms.push({id,element,x:0,y:0,...(charge?{charge}:{})});return id;
  };
  const bond=(a:number,b:number,order:1|2|3=1)=>graph.bonds.push([a,b,order]);
  const layout=[[-0.5,-1],[-1.3660254038,-0.5],[-1.3660254038,0.5],[-0.5,1],[0.3660254038,0.5],
    [1.2320508076,1],[2.0980762114,0.5],[2.0980762114,-0.5],[1.2320508076,-1],[0.3660254038,-0.5]];
  const ring=labels.map((_,index)=>{
    const id=atom("C"),point=layout[index]!;
    Object.assign(graph.atoms[id-1]!,{x:point[0],y:point[1]});
    return id;
  });
  graph.rings=[{id:1,kind:"aromatic",atomIds:[ring[0]!,ring[1]!,ring[2]!,ring[3]!,ring[4]!,ring[9]!] },
    {id:2,kind:"aromatic",atomIds:[ring[4]!,ring[5]!,ring[6]!,ring[7]!,ring[8]!,ring[9]!] }];
  for(const [a,b] of coreEdges)bond(ring[a]!,ring[b]!,doubleEdges.has(`${a}:${b}`)?2:1);
  const parentStart=name.search(/naphthalene|naftaleno|naphthalen-|naftalen-/);
  if(parentStart<0)return null;
  const locantId=(locant:number)=>ring[locantAtom.get(locant)!]!;
  const component=(id:string,role:NameComponent["role"],text:string,start:number,ids:number[],explanation:string,
    options:Partial<NameComponent>={})=>components.push({id,role,text,start,end:start+text.length,atomIds:ids,
      bondIds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b]),numbering:[],explanation,...options});
  const wholeParent=/^(?:naphthalene|naftaleno)$/.exec(name);
  const prefixForm=/^(.+?)(naphthalene|naftaleno)$/.exec(name);
  const phenol=/^(naphthalen|naftalen)-([1-8])-(ol)$/.exec(name);
  const amine=/^(naphthalen|naftalen)-([1-8])-(amine|amina)$/.exec(name);
  const acid=/^(?:(?:acid )|(?:ácido ))?(naphthalene|naftaleno)-([1-8])-(carboxylic acid|carboxílico)$/.exec(name);
  const ester=/^(methyl|metil) (naphthalene|naftaleno)-([1-8])-(carboxylate|carboxilato)$/.exec(name);
  const nitrile=/^(naphthalene|naftaleno)-([1-8])-(carbonitrile|carbonitrilo)$/.exec(name);
  const diol=/^(naphthalene|naftaleno)-([1-8]),([1-8])-(diol)$/.exec(name);
  let group:Family["group"]="none", suffixLocants:number[]=[];

  if(wholeParent) {
    component("parent","parent",name,0,ring,"Naphthalene is one ortho-fused bicyclic system: the two six-membered rings share two adjacent carbon atoms and their common bond. Its ten skeletal atoms are represented once.",
      {explanationEs:"El naftaleno es un único sistema bicíclico ortofusionado: sus dos anillos de seis miembros comparten dos carbonos adyacentes y su enlace común. Cada uno de sus diez átomos esqueléticos aparece una sola vez.",numbering:ring.map((id,index)=>[id,labels[index]!]),numberingScope:"parent"});
  } else if(prefixForm) {
    const prefixes=scanPrefixes(prefixForm[1]!,language);if(!prefixes?.length)return null;
    const locantSets=prefixes.map(entry=>entry.locants);
    if(!bestNumbering(locantSets))return null;
    const seen=new Set<number>();
    const coreText=prefixForm[2]!,coreStart=name.length-coreText.length;
    component("parent","parent",coreText,coreStart,ring,
      "Naphthalene is the retained ortho-fused parent; each prefix attaches to one of its peripheral carbon atoms.",
      {explanationEs:"Se conserva el naftaleno como padre ortofusionado; cada prefijo se une a uno de sus carbonos periféricos.",numbering:ring.map((id,index)=>[id,labels[index]!]),numberingScope:"parent",
       writtenLocants:prefixes.flatMap(entry=>entry.locants.map(locant=>{const at=name.indexOf(String(locant),entry.start);return{start:at,end:at+String(locant).length,atomId:locantId(locant),locant};}))});
    for(const [index,entry] of prefixes.entries()){
      const tokenStart=entry.start,tokenEnd=entry.end,token=name.slice(tokenStart,tokenEnd),ids:number[]=[],bonds:[number,number][]=[];
      for(const locant of entry.locants){if(seen.has(locant))return null;seen.add(locant);
        const branch=entry.term.elements.map((element,atomIndex)=>atom(element as NonNullable<Family["graph"]["atoms"][number]["element"]>,entry.term.charges?.[atomIndex]));
        entry.term.bonds.forEach(([a,b,order])=>bond(branch[a]!,branch[b]!,order as 1|2|3));bond(locantId(locant),branch[0]!);
        ids.push(...branch);bonds.push(...entry.term.bonds.map(([a,b]):[number,number]=>[branch[a]!,branch[b]!]),[locantId(locant),branch[0]!]);
        const termText=entry.term[language],start=name.indexOf(termText,tokenStart+entry.token.indexOf(termText));
        component(`prefix-${index}-at-${locant}`,"substituent",termText,start,branch,
          `${termText} is attached to peripheral naphthalene C${locant}; the locant belongs to the fused parent.`,
          {explanationEs:`«${termText}» se une al C${locant} periférico del naftaleno; el localizador pertenece al padre fusionado.`,parentId:"parent",locant,numbering:[[locantId(locant),locant]],bondIds:[...entry.term.bonds.map(([a,b]):[number,number]=>[branch[a]!,branch[b]!]),[locantId(locant),branch[0]!]],numberingScope:"parent"});
      }
      component(`prefix-group-${index}`,"prefix",token,tokenStart,ids,
        entry.locants.length>1
          ? `The multiplier counts ${entry.locants.length} separate ${entry.term[language]} groups at C${entry.locants.join(", C")}; the base prefix is used for alphabetical citation.`
          : `The written token records parent locant ${entry.locants[0]} and the cited prefix ${entry.term[language]}.`,
        {explanationEs:entry.locants.length>1
          ? `El multiplicador cuenta ${entry.locants.length} grupos ${entry.term[language]} separados en C${entry.locants.join(" y C")}; para el orden alfabético se usa el nombre base del prefijo.`
          : `El segmento escrito registra el localizador ${entry.locants[0]} del padre y el prefijo citado «${entry.term[language]}».`,
          parentId:"parent",numbering:entry.locants.map(locant=>[locantId(locant),locant]),bondIds:bonds,numberingScope:"parent",
          citationKey:entry.term.en,externalMultiplier:entry.locants.length>1?token.match(/^(di|tri)/)?.[1]:undefined});
    }
  } else if(phenol||amine||acid||ester||nitrile||diol) {
    const match=phenol??amine??acid??ester??nitrile??diol!;
    const locants=diol?[Number(diol[2]),Number(diol[3])]:[Number(ester?match[3]:match[2])];
    if(!bestNumbering([],locants))return null;
    suffixLocants=locants;
    const parentText=match[0];
    const writtenLocants=locants.map(locant=>{
      const token=String(locant),from=name.indexOf(token,parentStart);
      return{start:from,end:from+token.length,atomId:locantId(locant),locant};
    });
    component("parent","parent",parentText,0,ring,
      `The fused naphthalene framework is retained as the parent; the principal group is attached at locant(s) ${locants.join(", ")}.`,
      {explanationEs:`Se conserva como padre el sistema fusionado de naftaleno; el grupo principal se une en ${locants.join(" y ")}.`,numbering:ring.map((id,index)=>[id,labels[index]!]),numberingScope:"parent",writtenLocants});
    if(phenol||diol){
      group="alcohol";
      for(const [index,locant] of locants.entries()){
        const oxygen=atom("O");bond(locantId(locant),oxygen);
        component(`hydroxy-${locant}`,"suffix",diol?"diol":"ol",name.lastIndexOf(diol?"diol":"ol"),[locantId(locant),oxygen],
          `The hydroxy group at naphthalene C${locant} is expressed by the alcohol suffix.`,
          {explanationEs:`El grupo hidroxi del C${locant} del naftaleno se expresa mediante el sufijo de alcohol.`,parentId:"parent",locant,numbering:[[locantId(locant),locant]],numberingScope:"parent"});
      }
    } else if(amine){
      group="amine";const nitrogen=atom("N");bond(locantId(locants[0]!),nitrogen);
      const amineText=amine[3]!;
      component("suffix","suffix",amineText,name.length-amineText.length,[locantId(locants[0]!),nitrogen],"The amino group at the numbered naphthalene carbon is the principal group and is expressed by the amine suffix.",
        {explanationEs:`El grupo amino unido al C${locants[0]} es la función principal y se expresa con el sufijo de amina.`,parentId:"parent",locant:locants[0],numbering:[[locantId(locants[0]!),locants[0]!]],numberingScope:"parent"});
    } else {
      const carbon=atom("C");bond(locantId(locants[0]!),carbon);
      if(nitrile){const nitrogen=atom("N");bond(carbon,nitrogen,3);group="nitrile";
        const nitrileText=nitrile[3]!;
        component("suffix","suffix",nitrileText,name.lastIndexOf(nitrileText),[carbon,nitrogen],"The nitrile carbon is external to the naphthalene skeleton and is attached at C1; the nitrile suffix is the principal group.",
          {explanationEs:`El carbono del nitrilo es externo al esqueleto de naftaleno y se une al C${locants[0]}; el sufijo de nitrilo expresa la función principal.`,parentId:"parent",locant:locants[0],numbering:[[locantId(locants[0]!),locants[0]!]],numberingScope:"parent"});
      } else {
      const oxo=atom("O");bond(carbon,oxo,2);
      if(acid){const hydroxy=atom("O");bond(carbon,hydroxy);group="carboxylicAcid";
        const acidText=acid[3]!;
        component("suffix","suffix",acidText,name.lastIndexOf(acidText),[carbon,oxo,hydroxy],"The carboxyl carbon is external to the naphthalene skeleton. The carboxylic acid is the principal group and is named as a ring carboxylic acid.",
          {explanationEs:`El carbono carboxílico es externo al esqueleto de naftaleno. El ácido carboxílico es la función principal y se nombra como ácido carboxílico unido al anillo.`,parentId:"parent",locant:locants[0],numbering:[[locantId(locants[0]!),locants[0]!]],numberingScope:"parent"});
      } else if(ester){const oxygen=atom("O"),methyl=atom("C");bond(carbon,oxygen);bond(oxygen,methyl);group="ester";
        const stem=match[1]!,start=0;
        component("alkyl","prefix",stem,start,[methyl],"Methyl is the alkyl part of the ester; it is attached through oxygen and is not part of the naphthalene skeleton.",
          {explanationEs:"El metilo es la parte alcoxi del éster; se une por oxígeno y no forma parte del esqueleto de naftaleno.",parentId:"parent",bondIds:[[carbon,oxygen],[oxygen,methyl]]});
        const esterText=ester[4]!;
        component("suffix","suffix",esterText,name.lastIndexOf(esterText),[carbon,oxo,oxygen],"The ring carboxylate ester is the principal functional group; its carbonyl carbon remains outside the fused aromatic skeleton.",
          {explanationEs:"El éster carboxilato unido al anillo es la función principal; su carbono carbonílico permanece fuera del esqueleto aromático fusionado.",parentId:"parent",locant:locants[0],numbering:[[locantId(locants[0]!),locants[0]!]],numberingScope:"parent"});
      }
      }
    }
  } else return null;

  const selected=[...(suffixLocants.length?[suffixLocants]:[]),...components.filter(c=>c.role==="substituent").map(c=>c.locant?[c.locant as number]:[])];
  return {graph,components,parent:ring,group,allowEquivalentNumbering:true,evidence:{source:"active-name",profile:"current",language,
    construction:"fused-naphthalene",parentSelection:"aromatic-parent",
    rules:[blueBookRule("P-25.3.1","P2"),blueBookRule("P-25.3.3","P2"),blueBookRule("P-14.4","P1"),blueBookRule("P-41","P4"),blueBookRule("P-65.1.2.2","P6")],
    numbering:{scope:"parent",priorities:["fixed-fused-parent-numbering-P-25.3.3","principal-suffix-locants-P-14.4","detachable-prefix-locants-P-14.4"],selected,reflected:[],comparison:0},stereo:"unspecified-only"}};
}
