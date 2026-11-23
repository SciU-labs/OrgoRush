import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { analyzeStructuralEquivalence } from "./structural-derivation.ts";
import { parsePurineFamily } from "./purine-derivation.ts";
import { compareLocantSequences, proveMonocycleNumbering, blueBookRule } from "./compositional-name-model.ts";
import type { NameComponent, CompositionalFamilyGraph, NameRuleEvidence } from "./compositional-name-model.ts";
import { parseMultifunctionalFamily } from "./multifunctional-family.ts";
import { parseAcyclicArylAmine } from "./acyclic-aryl-amine-grammar.ts";

import { parseSubstitutedAlkanamide } from "./substituted-alkanamide.ts";
import { proveArylAmine } from "./aryl-amine-proof.ts";
import { parseBenzeneRingAssembly } from "./benzene-ring-assembly.ts";
import { parseIndependentAromaticLink } from "./independent-aromatic-link-grammar.ts";
import { parseCarbonLinkedIndependentRings } from "./carbon-linked-independent-rings.ts";
import { parseAromaticNitrogenAcid } from "./aromatic-nitrogen-acid-grammar.ts";
import { parseFusedNaphthalene } from "./fused-naphthalene-grammar.ts";
import { parseFusedTricyclicArene } from "./fused-tricyclic-arene-grammar.ts";

type FamilyGraph = CompositionalFamilyGraph;
const roots = ["", "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec"];
type Prefix = { text: string; term: NonNullable<ReturnType<typeof legacyPrefixTerm>>; positions: number[]; start: number; onAmideN?: boolean; nCount?: number; nLocantStarts?: number[];
  locantSpans:{start:number;end:number;locant:number}[] };

/** Bounded prefix grammar with paired delimiters and literal source spans.
 * No common names, translation or approximate token searches. */
function prefixes(text: string, offset: number, maximum: number, repeated = false, language: "en" | "es" = "en", alkenyl = false, aromaticHalogens = false, amideN = false): Prefix[] | null {
  const result: Prefix[] = []; let consumed = 0;
  while (consumed < text.length) {
    const letters = language === "en" ? "[a-z]+" : "[a-záéíóúñ]+";
    // P-16.5, general nomenclature. After separating the cyclic parent,
    // this complete radical has a unique parse, including both internal locants.
    const termPattern = alkenyl ? `prop-1-en-2-${language==="en"?"yl":"il"}$|${letters}` : letters;
    const m = new RegExp(`^(${amideN ? "N(?:,N)?|" : ""}[1-9](?:,[1-9])*)-(?:\\(([^()]+)\\)|(${termPattern}))`).exec(text.slice(consumed));
    if (!m) return null;
    const written = m[2] ?? m[3], onAmideN = m[1].startsWith("N"), positions = onAmideN ? [] : m[1].split(",").map(Number);
    const nCount=onAmideN ? m[1].split(",").length : 0;
    const multiplied = /^(di|tri)(.+)$/.exec(written);
    const termName = multiplied ? multiplied[2] : written;
    // The general legacy fragment table is broader than the current-profile
    // derivation grammar. Functionalized alkyl radicals need their own
    // independently adjudicated parent/locant proof before they can produce
    // FULL name evidence here.
    if (!/^(?:hydroxy|hidroxi|amino|oxo)$/.test(termName)
      && /(?:hydroxy|hidroxi|amino|oxo)/.test(termName)) return null;
    // Do not accept a branch descriptor that merely extends the numbered
    // substituent chain at its terminal carbon (e.g. 2-methylethyl). The
    // longest rooted chain is the parent radical in that case.
    const terminalChainExtension = termName.match(/^(\d+(?:,\d+)*-)?(?:di|tri)?meth(?:yl|il)(eth|prop|but|pent|hex|hept|oct|non|dec)(?:yl|il)$/i);
    if (terminalChainExtension) {
      const chainLength = ({eth:2,prop:3,but:4,pent:5,hex:6,hept:7,oct:8,non:9,dec:10} as const)[terminalChainExtension[2]!.toLowerCase() as "eth"|"prop"|"but"|"pent"|"hex"|"hept"|"oct"|"non"|"dec"];
      const locants = terminalChainExtension[1]?.slice(0,-1).split(",").map(Number) ?? [];
      if (chainLength > 1 && locants.includes(chainLength)) return null;
    }
    const systematicPropenyl = alkenyl && ["prop-1-en-2-il", "prop-1-en-2-yl"].includes(termName);
    const benzyl = onAmideN && (language === "en" ? termName === "benzyl" : termName === "bencil");
    const term = benzyl
      ? {es:"bencil",en:"benzyl",elements:["C","C","C","C","C","C","C"],bonds:[[0,1,1],[1,2,2],[2,3,1],[3,4,2],[4,5,1],[5,6,2],[6,1,1]] as [number,number,number][]}
      : systematicPropenyl
      ? {es:"prop-1-en-2-il",en:"prop-1-en-2-yl",elements:["C","C","C"],bonds:[[0,1,2],[0,2,1]] as [number,number,number][]}
      : alkenyl && ["1-metilvinil", "1-methylethenyl"].includes(termName)
      ? {es:"1-metilvinil",en:"1-methylethenyl",elements:["C","C","C"],bonds:[[0,1,2],[0,2,1]] as [number,number,number][]}
      : legacyPrefixTerm(termName);
    if (!term || term[language] !== termName || term.charges
      || term.bonds.some(([, , order]) => order !== 1 && !((alkenyl || benzyl) && order === 2))
      || term.kind && !["alcohol", "amine", "ether", ...(aromaticHalogens ? ["halogen"] : [])].includes(term.kind)
      || positions.some(p => p < 1 || p > maximum)
      || onAmideN && (m[2] || (nCount===1 ? Boolean(multiplied) : multiplied?.[1]!=="di") || (nCount===2 && benzyl)
        || !["metil", "etil", "propil", "methyl", "ethyl", "propyl", "bencil", "benzyl"].includes(termName))
      || !onAmideN && positions.length !== (multiplied ? multiplied[1] === "di" ? 2 : 3 : 1)
      || positions.some((p,i) => i > 0 && (repeated ? p < positions[i-1] : p <= positions[i-1]))) return null;
    let locantOffset=offset+consumed;
    const locantSpans=(onAmideN ? [] : m[1].split(",")).map(token=>{
      const span={start:locantOffset,end:locantOffset+token.length,locant:Number(token)};
      locantOffset+=token.length+1;return span;
    });
    result.push({ text: written, term, positions, locantSpans, onAmideN, nCount,
      nLocantStarts:onAmideN?Array.from({length:nCount},(_,i)=>offset+consumed+2*i):undefined,
      start: offset + consumed + m[1].length + (m[2] ? 2 : 1) });
    consumed += m[0].length;
    if (consumed < text.length) { if (text[consumed] !== "-") return null; consumed++; if (consumed === text.length) return null; }
  }
  if (!repeated && new Set(result.flatMap(p => p.positions)).size !== result.flatMap(p => p.positions).length) return null;
  if(result.reduce((sum,p)=>sum+(p.nCount??0),0)>2)return null;
  if(new Set(result.map(p=>p.term[language])).size!==result.length)return null;
  // Multiplicative prefixes do not affect alphabetical order.
  const alphabetical = (value: string) => value.replace(/^[\d,]+-/, "").replace(/[()-]/g, "");
  if (result.some((p,i) => i > 0 && alphabetical(result[i-1].term[language]).localeCompare(alphabetical(p.term[language]),language) > 0)) return null;
  return result;
}

export function parseAdditionalSystematicFamily(name: string): FamilyGraph | null {
  return parseFusedTricyclicArene(name) ?? parseFusedNaphthalene(name) ?? parseAromaticNitrogenAcid(name) ?? parseEstablishedFamily(name) ?? parseBenzeneRingAssembly(name) ?? parseIndependentAromaticLink(name)
    ?? parseCarbonLinkedIndependentRings(name) ?? parseMultifunctionalFamily(name,"en") ?? parseMultifunctionalFamily(name,"es");
}

/** Prefix-only substitution on benzene. Each typed prefix is parsed once,
 * expanded by its written multiplier, and attached at the written ring
 * locants. The active locants must also be the lowest admissible orientation
 * after citation-order tie breaking (Blue Book P-14.4/P-14.5). */
function parsePolysubstitutedBenzene(name:string):FamilyGraph|null {
  const parentMatch=/(benzene|benceno)$/.exec(name);if(!parentMatch)return null;
  const language=parentMatch[1]==="benzene"?"en":"es",source=name.slice(0,parentMatch.index);
  if(!source)return null;
  const entries:{written:string;term:NonNullable<ReturnType<typeof legacyPrefixTerm>>;locants:number[];start:number;end:number;termStart:number;termEnd:number;multiplier:string}[]=[];
  const multipliers:Record<string,number>={di:2,tri:3,tetra:4,penta:5,hexa:6};
  let cursor=0;
  while(cursor<source.length){
    const locantMatch=/^([1-6](?:,[1-6])*)-/.exec(source.slice(cursor));if(!locantMatch)return null;
    const locants=locantMatch[1]!.split(",").map(Number),start=cursor;
    if(new Set(locants).size!==locants.length||locants.some((value,index)=>index>0&&value<=locants[index-1]!))return null;
    cursor+=locantMatch[0].length;
    let body="",bodyStart=cursor,bodyEnd=cursor;
    if(source[cursor]==="("||source[cursor]==="["){
      const close=source[cursor]==="("?")":"]";let depth=0,end=-1;
      for(let i=cursor;i<source.length;i++){if(source[i]===source[cursor])depth++;else if(source[i]===close&&--depth===0){end=i;break;}}
      if(end<0)return null;body=source.slice(cursor+1,end);bodyStart=cursor;bodyEnd=end+1;cursor=end+1;
    }else{
      const match=/^[a-záéíóúñ]+/i.exec(source.slice(cursor));if(!match)return null;
      body=match[0];bodyStart=cursor;bodyEnd=cursor+body.length;cursor=bodyEnd;
    }
    const matchMultiplier=/^(di|tri|tetra|penta|hexa)(.+)$/i.exec(body);
    let multiplier=matchMultiplier?.[1]?.toLowerCase()??"",base=matchMultiplier?.[2]??body;
    let expected=multiplier?multipliers[multiplier]!:1,term=legacyPrefixTerm(base);
    // A substituent name can itself begin with the same letters as a
    // multiplicative prefix (trifluoromethyl); exact fragment recognition
    // takes precedence unless the locant count confirms a multiplier.
    if(multiplier&&locants.length===1&&legacyPrefixTerm(body)?.[language]===body){multiplier="";base=body;expected=1;term=legacyPrefixTerm(body);}
    if(!term||term[language]!==base||locants.length!==expected
      ||term.kind&&!["nitro","halogen","ether"].includes(term.kind)
      ||term.elements.some(element=>!["C","O","N","F","Cl","Br","I"].includes(element))
      ||term.charges&&Object.keys(term.charges).some(index=>!Number.isInteger(Number(index))||Number(index)<0||Number(index)>=term.elements.length)
      ||term.bonds.some(([, ,order])=>order!==1&&!(term.kind==="nitro"&&order===2)
        &&!/(?:phenyl|phenoxy)$/.test(term.en)))return null;
    // The same substituent belongs in one multiplicative prefix, not in two
    // separate tokens whose occurrences could be counted inconsistently.
    if(entries.some(entry=>entry.term[language]===term[language]))return null;
    entries.push({written:body,term,locants,start,end:cursor,termStart:bodyStart,termEnd:bodyEnd,multiplier});
    if(cursor<source.length){if(source[cursor]!=="-")return null;cursor++;if(cursor===source.length)return null;}
  }
  if(!entries.length||entries.some(entry=>entry.locants.some(locant=>entries.some(other=>other!==entry&&other.locants.includes(locant)))))return null;
  const citation=(entry:typeof entries[number])=>entry.term[language].replace(/[^a-záéíóúñ]/gi,"").toLocaleLowerCase(language);
  const ordered=[...entries].sort((a,b)=>citation(a).localeCompare(citation(b),language));
  if(entries.some((entry,index)=>entry!==ordered[index]))return null;
  const score=(groups:readonly (readonly number[])[])=>{
    const all=groups.flat().sort((a,b)=>a-b);
    return [all,groups[0]?[...groups[0]].sort((a,b)=>a-b):[]];
  };
  const transform=(locant:number,origin:number,direction:number)=>((direction*(locant-1-origin)%6+6)%6)+1;
  const selectedGroups=entries.map(entry=>entry.locants);
  const selected=score(selectedGroups),alternatives:(number[][])[]=[];
  for(let origin=0;origin<6;origin++)for(const direction of [1,-1])
    if(origin!==0||direction!==1)alternatives.push(entries.map(entry=>entry.locants.map(value=>transform(value,origin,direction))));
  const compare=(left:number[][],right:number[][])=>{
    for(let i=0;i<Math.max(left.length,right.length);i++){
      const a=left[i]??[],b=right[i]??[];for(let j=0;j<Math.max(a.length,b.length);j++){
        const difference=(a[j]??-1)-(b[j]??-1);if(difference)return difference;
      }
    }return 0;
  };
  const locantScores=(groups:readonly (readonly number[])[]):number[][]=>{
    const full=groups.flat().sort((a,b)=>a-b),first=[...(groups[0]??[])].sort((a,b)=>a-b);
    return [full,first];
  };
  let best=locantScores(alternatives[0]??selectedGroups);
  for(const candidate of alternatives){const candidateScore=locantScores(candidate);if(compare(candidateScore,best)<0)best=candidateScore;}
  const selectedScore=locantScores(selectedGroups);
  if(compare(selectedScore,best)>0)return null;

  const graph:GeneratedMolecule={atoms:[],bonds:[]};
  const atom=(element:GeneratedMolecule["atoms"][number]["element"],charge?:number)=>{const id=graph.atoms.length+1;graph.atoms.push({id,element,x:0,y:0,...(charge?{charge}:{})});return id;};
  const ring=Array.from({length:6},()=>atom("C"));ring.forEach((id,index)=>graph.bonds.push([id,ring[(index+1)%6],(index%2?1:2) as 1|2]));
  const components:NameComponent[]=[];
  const parentStart=source.length,ringText=parentMatch[1]!;
  components.push({id:"parent",role:"parent",text:ringText,start:parentStart,end:name.length,atomIds:ring,
    bondIds:graph.bonds.map(([a,b])=>[a,b]),numbering:ring.map((id,index)=>[id,index+1]),language,numberingScope:"parent",
    writtenLocants:entries.flatMap(entry=>entry.locants.map(locant=>{
      const at=source.indexOf(`${locant}`,entry.start);return {start:at,end:at+String(locant).length,atomId:ring[locant-1]!,locant};
    })),
    explanation:`Benzene is selected as the parent structure because no characteristic group is expressed by a suffix. All six ring positions are admissible origins; compare the complete prefix locant set first, then the locants in citation order (P-22.1.3, P-14.4, P-14.5).`,
    explanationEs:`El benceno se selecciona como estructura principal porque ningún grupo característico se expresa mediante sufijo. Los seis átomos del anillo pueden iniciar la numeración; se compara primero el conjunto completo de localizadores de prefijos y después sus localizadores en orden de cita (P-22.1.3, P-14.4, P-14.5).`});
  for(const [index,entry] of entries.entries()){
    const termStartInWritten=entry.written.indexOf(entry.term[language]);
    if(termStartInWritten<0)return null;
    const tokenStart=entry.start,tokenEnd=entry.end,written=name.slice(tokenStart,tokenEnd);
    const groupIds:number[]=[],groupBonds:[number,number][]=[];
    for(const [occurrence,locant] of entry.locants.entries()){
      const ids=entry.term.elements.map((element,atomIndex)=>atom(element as GeneratedMolecule["atoms"][number]["element"],entry.term.charges?.[atomIndex]));
      entry.term.bonds.forEach(([a,b,order])=>graph.bonds.push([ids[a]!,ids[b]!,order as 1|2|3]));
      const attachment:[number,number]=[ring[locant-1]!,ids[0]!];graph.bonds.push(attachment);
      groupIds.push(...ids);groupBonds.push(...entry.term.bonds.map(([a,b]):[number,number]=>[ids[a]!,ids[b]!]),attachment);
      const oneWord=entry.term[language],oneStart=name.indexOf(oneWord,entry.termStart);
      components.push({id:`prefix-${index}-occurrence-${occurrence}`,role:"substituent",text:oneWord,start:oneStart,end:oneStart+oneWord.length,
        parentId:`prefix-${index}`,locant,atomIds:ids,bondIds:[...entry.term.bonds.map(([a,b]):[number,number]=>[ids[a]!,ids[b]!]),attachment],
        numbering:[[ring[locant-1]!,locant]],language,numberingScope:"parent",
        explanation:`This individual ${oneWord} group is bonded to benzene C${locant}. Its locant names the ring attachment, not an atom within the substituent.`,
        explanationEs:`Este grupo ${oneWord} individual se une al C${locant} del benceno. El localizador identifica el carbono del anillo, no un átomo interno del sustituyente.`,
        label:`${entry.term.en} at C${locant}`,labelEs:`${entry.term.es} en C${locant}`,
        ...(entry.locants.length>1?{mappingGroup:`prefix-${index}-occurrences`}:{})});
    }
    const citationName=entry.term[language],prefixText=written;
    const groupExplanation=entry.locants.length>1
      ? `The multiplier ${entry.multiplier} counts ${entry.locants.length} separate ${citationName} groups at C${entry.locants.join(", C")}.`
      : `The ${citationName} prefix identifies the attached group at benzene C${entry.locants[0]}.`;
    const groupExplanationEs=entry.locants.length>1
      ? `El multiplicador ${entry.multiplier} cuenta ${entry.locants.length} grupos ${citationName} separados en C${entry.locants.join(" y C")}.`
      : `El prefijo ${citationName} identifica el grupo unido al C${entry.locants[0]} del benceno.`;
    components.push({id:`prefix-${index}`,role:"prefix",text:prefixText,start:tokenStart,end:tokenEnd,parentId:"parent",
      atomIds:groupIds,bondIds:groupBonds,numbering:entry.locants.map(locant=>[ring[locant-1]!,locant]),
      language,numberingScope:"parent",citationKey:citation(entry),externalMultiplier:entry.multiplier||undefined,
      explanation:groupExplanation,explanationEs:groupExplanationEs,label:entry.locants.length>1?`${citationName} groups (×${entry.locants.length})`:undefined,
      labelEs:entry.locants.length>1?`Grupos ${citationName} (×${entry.locants.length})`:undefined});
  }
  const reflected=best;
  return {graph,components,parent:ring,group:"none",allowEquivalentNumbering:true,evidence:{source:"active-name",profile:"current",language,
    construction:"polysubstituted-benzene-prefixes",parentSelection:"unfunctionalized-benzene",
    rules:[blueBookRule("P-22.1.3","P2"),blueBookRule("P-14.3.5","P1"),blueBookRule("P-14.4","P1"),blueBookRule("P-14.5.1","P1"),blueBookRule("P-14.5.4","P1")],
    numbering:{scope:"parent",priorities:["all-detachable-prefix-locants-P-14.4-f","first-cited-prefix-locants-P-14.4-g"],selected,reflected,comparison:compare(selectedScore,best)},stereo:"unspecified-only"}};
}

function parseEstablishedFamily(name:string): FamilyGraph | null {
  const amine = parseAcyclicArylAmine(name);
  if (amine) return proveArylAmine(amine);
  if (/(?:amide|amida)$/.test(name) && /amino|N,N-|N-.*-N-|N-(?:methyl|ethyl|propyl|metil|etil|propil)/.test(name)) {
    const alkanamide=parseSubstitutedAlkanamide(name);
    if (alkanamide) return alkanamide;
  }
  const purine=parsePurineFamily(name);if(purine)return purine;
  const polysubstitutedBenzene=parsePolysubstitutedBenzene(name);
  if(polysubstitutedBenzene)return polysubstitutedBenzene;
  // The prefix-only benzene grammar above owns this name family. Do not fall
  // through to any older two-prefix grammar that lacks full tie-break proof.
  if(/(?:benzene|benceno)$/.test(name))return null;
  const graph: GeneratedMolecule = { atoms: [], bonds: [] }, components: NameComponent[] = [];
  const atom = (element: "C" | "O" | "N" | "F" | "Cl" | "Br" | "I" = "C") => { const id = graph.atoms.length + 1; graph.atoms.push({id,element,x:0,y:0}); return id; };
  const edge = (a: number, b: number, order: 1 | 2 | 3 = 1) => { graph.bonds.push([a,b,order]); };
  const chain = (n: number) => { const ids = Array.from({length:n},()=>atom()); ids.slice(1).forEach((id,i)=>edge(ids[i],id)); return ids; };
  const ring = () => { const ids = Array.from({length:6},()=>atom()); ids.forEach((id,i)=>edge(id,ids[(i+1)%6],i%2?1:2)); return ids; };
  const add = (id: string, role: NameComponent["role"], text: string, start: number, ids: number[], explanation: string,
    options: Partial<NameComponent> = {}) => {
    components.push({id,role,text,start,end:start+text.length,atomIds:ids,
      bondIds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b]),
      numbering:[],explanation,...options});
  };
  const attach = (ps: Prefix[], skeleton: number[], parentId = "parent", language: "en" | "es" = "en", scope?: "ring") => {
    for (const [i,p] of ps.entries()) {
      const region: number[] = [], attachments: [number,number][] = [];
      const rootDegree = p.term.bonds.filter(([a,b]) => a === 0 || b === 0).length;
      const unsaturated=p.term.bonds.some(([, ,order])=>order===2);
      const spanishSkeleton = p.text === "prop-1-en-2-il" ? "cadena de tres carbonos"
        : rootDegree > 1 && p.term.elements.length > 2
        ? `esqueleto ramificado de ${p.term.elements.length} carbonos`
        : `fragmento de ${p.term.elements.length} átomo${p.term.elements.length === 1 ? "" : "s"}`;
      for(const position of p.positions) {
        const ids = p.term.elements.map(e=>atom(e as "C"|"O"|"N"|"F"|"Cl"|"Br"|"I"));
        p.term.bonds.forEach(([a,b,order])=>edge(ids[a],ids[b],order as 1|2|3)); edge(skeleton[position-1],ids[0]);
        region.push(...ids); attachments.push([skeleton[position-1],ids[0]]);
      }
      // Fragment tables are rooted at their attachment atom. A numbered branch
      // retains its own longest rooted path; tied terminal atoms are chemically
      // equivalent and never become parent-ring locants.
      let internalNumbering: [number,number][] | undefined;
      const systematicPropenyl = p.text === (language === "es" ? "prop-1-en-2-il" : "prop-1-en-2-yl");
      if (p.positions.length===1 && systematicPropenyl) {
        internalNumbering=[[region[1],1],[region[0],2],[region[2],3]];
      } else if(p.positions.length===1 && /^\d/.test(p.text) && p.term.bonds.length===p.term.elements.length-1) {
        const paths=(id:number,from:number):number[][]=>{
          const next=p.term.bonds.flatMap(([a,b])=>a===id&&b!==from?[b]:b===id&&a!==from?[a]:[]);
          return next.length?next.flatMap(child=>paths(child,id).map(path=>[id,...path])):[[id]];
        };
        const backbone=paths(0,-1).sort((a,b)=>b.length-a.length)[0];
        internalNumbering=backbone.map((index,i)=>[region[index],i+1]);
      }
      add(`prefix-${i}`,"prefix",p.text,p.start,region,
        language === "en" ? `${p.text} specifies the connected ${p.term.kind ?? (unsaturated?"alkenyl":"alkyl")} substituent at ${p.positions.join(",")}; these locants belong to ${parentId}.${systematicPropenyl?" Its separate chain numbering puts the double bond at C1=C2 and the attachment at C2.":internalNumbering?" Internal branch numbering starts at its attachment atom, in a separate scope.":""}`
          : `El sustituyente «${p.text}» forma un ${spanishSkeleton} y se une al anillo en el localizador ${p.positions.join(",")}; ese localizador pertenece al padre.`,
        {parentId,locant:p.positions.length===1?p.positions[0]:undefined,...(scope?{attachmentScope:scope}:{}),
          numbering:[...new Map(p.positions.map(p=>[skeleton[p-1],p]))],
          ...(internalNumbering?{internalNumbering}:{}),
          ...(language === "es" ? { explanationEs: `El sustituyente «${p.text}» forma un ${spanishSkeleton} y se une al anillo en el localizador ${p.positions.join(",")}; ese localizador pertenece al padre.${systematicPropenyl?" En la numeración independiente de la rama el doble enlace es C1=C2 y la unión está en C2.":internalNumbering?" La numeración interna de la rama empieza en su átomo de unión y tiene un ámbito independiente.":""}` } : {}),
          bondIds:[...graph.bonds.filter(([a,b])=>region.includes(a)&&region.includes(b)).map(([a,b]):[number,number]=>[a,b]),...attachments]});
      if(unsaturated && p.positions.length===1) {
        const written=systematicPropenyl ? /1-en/.exec(p.text) : /(vinil|ethenyl|enil|enyl|en-[1-9]-(?:yl|il))$/.exec(p.text);
        if(written)for(const [index,[a,b,order]] of p.term.bonds.entries())if(order===2) {
          add(`branch-unsaturation-${i}-${index}`,"unsaturation",written[0],p.start+written.index,[region[a],region[b]],
            language==="en"?"This double bond belongs to the substituent; its internal locants are independent of the parent ring."
              :"Este doble enlace pertenece al sustituyente; sus localizadores internos son independientes del anillo padre.",
            {parentId:`prefix-${i}`,numberingScope:`prefix-${i}`});
        }
      }
    }
  };
  let parent: number[], group: FamilyGraph["group"];
  let evidence: NameRuleEvidence | undefined;
  let allowEquivalentNumbering = false;
  let equivalentParentPaths: number[][] | undefined;
  // A diol on a single benzene ring outranks the amine on an aminoalkyl
  // branch. Compare the suffix positions before the prefix over all 12
  // numberings; expose atom-specific locants only for a unique winner.
  const diol=/^([1-6])-\(([1-9])-amino(ethyl|propyl|butyl|etil|propil|butil)\)(benzene|benceno)-([1-6]),([1-6])-diol$/.exec(name);
  if (diol) {
    const language=diol[4]==="benzene"?"en":"es", position=Number(diol[1]);
    const locants=[Number(diol[5]),Number(diol[6])], selected=[...locants,position];
    if(locants[0]>=locants[1] || locants.includes(position))return null;
    for(let origin=0;origin<6;origin++)for(const direction of [-1,1]) {
      if(!origin && direction===1)continue;
      const project=(n:number)=>((origin+direction*(n-1)+6)%6)+1;
      const alternative=[...locants.map(project).sort((a,b)=>a-b),project(position)];
      if(compareLocantSequences(selected,alternative)>=0)return null;
    }
    const text=diol[2]+"-amino"+diol[3],term=legacyPrefixTerm(text);
    if(!term || term[language]!==text || term.kind!=="amine")return null;
    const parent=ring(),sites=locants.map(p=>parent[p-1]),oxygen=sites.map(site=>{const o=atom("O");edge(site,o);return o;});
    const ids=term.elements.map(el=>atom(el as "C"|"N")), anchor=parent[position-1];
    term.bonds.forEach(([a,b])=>edge(ids[a],ids[b]));edge(anchor,ids[0]);
    const n=ids.find(id=>graph.atoms[id-1].element==="N")!, internalPos=Number(diol[2]),root=diol[0].indexOf(diol[4]);
    add("parent","parent",name.slice(root),root,parent,
      "The ring bears both hydroxyl groups. Their suffix fixes the lowest pair of locants before the aminoalkyl position is compared.",
      {explanationEs:"El anillo lleva ambos hidroxilos. Su sufijo recibe el par de localizadores más bajo antes de comparar la posición del aminoalquilo.",
        numbering:parent.map((id,i)=>[id,i+1]),writtenLocants:[{start:0,end:1,locant:position,atomId:anchor},
          ...locants.map((locant,i)=>({start:root+diol[4].length+1+2*i,end:root+diol[4].length+2+2*i,locant,atomId:sites[i]}))]});
    add("suffix","suffix","diol",name.length-4,[...sites,...oxygen],"Two ring hydroxyl groups supply the diol suffix. The amine is subordinate.",
      {explanationEs:"Dos hidroxilos del anillo aportan el sufijo diol. La amina se expresa mediante el prefijo amino.",bondIds:sites.map((id,i)=>[id,oxygen[i]])});
    add("aminoalkyl","substituent",name.slice(0,root),0,ids,`The alkyl chain attaches at ring C${position}. Its internal C1 is bonded to the ring.`,
      {parentId:"parent",locant:position,explanationEs:`El alquilo se une al C${position} del anillo. Su C1 interno es el carbono unido al anillo.`,
        numbering:[[anchor,position]],writtenLocants:[{start:3,end:4,locant:internalPos,atomId:ids[internalPos-1]}],
        bondIds:[...term.bonds.map(([a,b]):[number,number]=>[ids[a],ids[b]]),[anchor,ids[0]]]});
    add("aminoalkyl-amino","prefix","amino",5,[n],`Amino denotes the nitrogen on branch C${internalPos}.`,
      {parentId:"aminoalkyl",bondIds:[[ids[internalPos-1],n]],explanationEs:`Amino indica el nitrógeno unido al C${internalPos} de la rama.`});
    for(const c of components)c.language=language;
    return {graph,components,parent,group:"alcohol",evidence:{language,source:"active-name",construction:"aminoalkyl-benzenediol",
      parentSelection:"sole-suffix-bearing-cycle",rules:[blueBookRule("P-63.1","P6"),blueBookRule("P-14.4","P1")],
      numbering:{scope:"parent",priorities:["diol-suffix","aminoalkyl"],selected:[locants,[position]],
        reflected:[locants.map(n=>n===1?1:8-n).sort((a,b)=>a-b),[position===1?1:8-position]],comparison:-1},stereo:"unspecified-only"}};
  }
  const aromaticEnglish = /^(.*?)(benzoic acid|benzaldehyde|phenol|aniline|benzamide|benzonitrile)$/.exec(name);
  const aromaticSpanish = /^(.*?)(benzaldehído|anilina|benzamida|benzonitrilo)$/.exec(name);
  const retainedSpanish: Record<string,string> = {benzaldehído:"benzaldehyde",anilina:"aniline",benzamida:"benzamide",benzonitrilo:"benzonitrile"};
  const aromaticInput = aromaticEnglish
    ? { prefixText: aromaticEnglish[1], suffixWritten: aromaticEnglish[2], suffix: aromaticEnglish[2], language: "en" as const }
    : aromaticSpanish ? { prefixText: aromaticSpanish[1], suffixWritten: aromaticSpanish[2], suffix: retainedSpanish[aromaticSpanish[2]], language: "es" as const } : null;
  const esterEnglish = /^([a-z]+yl) (.*)benzoate$/.exec(name);
  const esterSpanish = /^(.*)benzoato de ([a-z]+o)$/.exec(name);
  const esterAlkylWritten = esterEnglish?.[1] ?? esterSpanish?.[2];
  const esterAlkylRadical = esterEnglish?.[1] ?? esterSpanish?.[2]?.slice(0, -1);
  const esterAlkylTerm = esterAlkylRadical ? legacyPrefixTerm(esterAlkylRadical) : undefined;
  const esterInput = esterAlkylWritten && esterAlkylTerm
    && (esterEnglish ? esterAlkylTerm.en === esterAlkylRadical : esterAlkylTerm.es === esterAlkylRadical)
    && !esterAlkylTerm.kind && esterAlkylTerm.elements.every(e => e === "C")
    && esterAlkylTerm.bonds.every(([, , order]) => order === 1)
    ? { alcoholWritten: esterAlkylWritten, alcoholTerm: esterAlkylTerm, prefixText: esterEnglish?.[2] ?? esterSpanish![1],
      language: esterEnglish ? "en" as const : "es" as const,
      suffixStart: esterEnglish ? name.length - "benzoate".length : name.indexOf("benzoato"),
      suffixWritten: esterEnglish ? "benzoate" : "benzoato" }
    : null;
  const nAmide = /^N-phenyl(acetamide|[a-z]+anamide)$/.exec(name);
  const acyclic = /^(.+?)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)an(oic acid|amide|al)$/.exec(name);
  const simpleChain = /^(meth|eth|prop|but|pent|hex|hept|oct|non|dec)an(oic acid|amide|al)$/.exec(name);
  const arylKetone = /^1-phenyl(ethanone|(?:prop|but|pent|hex|hept|oct|non|dec)an-1-one)$/.exec(name);
  const diarylKetone = /^(di)(phenyl)(methanone)$/.exec(name);
  const saturatedCycle = /^(.*?)(cyclo|ciclo)(prop|but|pent|hex|hept|oct)an(?:-1-)?(ol|one|ona)$/.exec(name);
  const unsaturatedCycle = /^(.*?)(cyclo|ciclo)(prop|but|pent|hex|hept|oct)-([1-8])-en-1-(one|ona)$/.exec(name);
  const cyclicInput = saturatedCycle || unsaturatedCycle;
  if(aromaticInput || esterInput) {
    const suffix = aromaticInput?.suffix ?? "benzoate";
    const suffixWritten = aromaticInput?.suffixWritten ?? esterInput!.suffixWritten;
    const start = aromaticInput ? name.length - suffixWritten.length : esterInput!.suffixStart;
    const prefixText = aromaticInput?.prefixText ?? esterInput!.prefixText;
    const language = aromaticInput?.language ?? esterInput!.language;
    const prefixStart = aromaticInput || language === "es" ? 0 : esterEnglish![1].length + 1;
    const ps = prefixes(prefixText,prefixStart,6,false,language,false,true,suffix==="benzamide"); if(!ps || ps.some(p=>p.positions.includes(1)))return null;
    if(suffix==="phenol" && ps.some(p=>p.term.kind==="alcohol"))return null; // Polyols need a multi-suffix parent grammar.
    // Alcohol outranks amine; polyamines need their own multi-suffix grammar.
    if(suffix==="aniline" && ps.some(p=>p.term.kind && !["ether","halogen"].includes(p.term.kind)))return null;
    const positions = ps.flatMap(p=>p.positions).sort((a,b)=>a-b), reversed = positions.map(p=>8-p).sort((a,b)=>a-b);
    const comparison=positions.findIndex((p,i)=>p!==reversed[i]);
    if(comparison>=0 && positions[comparison]>reversed[comparison])return null;
    if(comparison<0) {
      const byPrefix=ps.flatMap(p=>p.positions), reflection=ps.flatMap(p=>p.positions.map(n=>8-n).sort((a,b)=>a-b));
      const tie=byPrefix.findIndex((p,i)=>p!==reflection[i]);
      if(tie>=0 && byPrefix[tie]>reflection[tie])return null;
    }
    const ids=ring(); parent=[...ids]; let functionIds: number[], linkage: number|undefined;
    if(suffix==="phenol" || suffix==="aniline") {
      const hetero=atom(suffix==="phenol"?"O":"N");edge(ids[0],hetero);functionIds=[ids[0],hetero];group=suffix==="phenol"?"alcohol":"amine";
    }
    else if(suffix==="benzonitrile") {
      const c=atom(),n=atom("N");edge(ids[0],c);edge(c,n,3);parent.push(c);functionIds=[c,n];group="nitrile";
    }
    else {
      const c=atom(),o=atom("O");edge(ids[0],c);edge(c,o,2);parent.push(c);functionIds=[c,o];
      if(suffix!=="benzaldehyde") {linkage=atom(suffix==="benzamide"?"N":"O");edge(c,linkage);functionIds.push(linkage);}
      group=esterInput?"ester":suffix==="benzaldehyde"?"aldehyde":suffix==="benzamide"?"amide":"carboxylicAcid";
    }
    const ringPrefixes=ps.filter(p=>!p.onAmideN), nPrefixes=ps.filter(p=>p.onAmideN), nPrefix=nPrefixes[0];
    attach(ringPrefixes,ids,"parent",language,"ring");
    if(nPrefix) {
      if(suffix!=="benzamide" || linkage===undefined)return null;
      for(const [prefixIndex,nPrefix] of nPrefixes.entries()) for(let occurrence=0;occurrence<(nPrefix.nCount??1);occurrence++) {
      const alkyl=nPrefix.term.elements.map(()=>atom());
      nPrefix.term.bonds.forEach(([a,b,order])=>edge(alkyl[a],alkyl[b],order as 1|2|3));
      edge(linkage,alkyl[0]);
      const isBenzyl=nPrefix.term.en==="benzyl";
      const id=nPrefixes.length===1 && nPrefix.nCount===1 ? (isBenzyl?"n-benzyl":"n-alkyl") : `n-alkyl-${prefixIndex}-${occurrence}`;
      add(id,"substituent",nPrefix.text,nPrefix.start,alkyl,
        isBenzyl ? (language==="en" ? "N links benzyl through CH2 to the amide nitrogen; its phenyl ring is distinct from the carbonyl-bearing parent."
          : "N une el bencilo por CH2 al nitrógeno amídico; su anillo fenilo es distinto del anillo progenitor unido al carbonilo.")
        : language==="en"?"N locates the alkyl substituent on the amide nitrogen, independently of the aromatic ring."
          :"N indica que el alquilo se une al nitrógeno amídico, no a un carbono del anillo.",
        {parentId:"parent",locant:"N",attachmentScope:"amide-nitrogen",numbering:[[linkage,"N"]],
          nLocantStarts:[nPrefix.nLocantStarts![occurrence]],...(nPrefix.nCount===2?{equivalenceGroup:`n-equivalent-${prefixIndex}`} : {}),
          bondIds:[...graph.bonds.filter(([a,b])=>alkyl.includes(a)&&alkyl.includes(b)).map(([a,b]):[number,number]=>[a,b]),[linkage,alkyl[0]]]});
      }
      for(const component of components) if(component.attachmentScope==="ring")
        component.atomIds=[...new Set([...component.atomIds,...component.numbering.map(([id])=>id)])];
    }
    if(esterInput) {
      const term=esterInput.alcoholTerm;
      const alkyl=term.elements.map(()=>atom());term.bonds.forEach(([a,b])=>edge(alkyl[a],alkyl[b]));edge(linkage!,alkyl[0]);
      const alcoholStart = esterEnglish ? 0 : name.indexOf(esterInput.alcoholWritten);
      add("ester-alkyl","substituent",esterInput.alcoholWritten,alcoholStart,alkyl,
        language === "en" ? "The alcohol-derived alkyl group is bonded to the ester oxygen, not to the aromatic ring."
          : "El grupo alquilo procedente del alcohol se une al oxígeno del éster, no directamente al anillo aromático.",
        {parentId:"suffix",bondIds:[...graph.bonds.filter(([a,b])=>alkyl.includes(a)&&alkyl.includes(b)).map(([a,b]):[number,number]=>[a,b]),[linkage!,alkyl[0]]]});
    }
    const groupEs = {aldehyde:"aldehído",ester:"éster",amide:"amida",amine:"amina",nitrile:"nitrilo",alcohol:"alcohol",carboxylicAcid:"ácido carboxílico"}[group];
    add("parent","parent",suffixWritten,start,parent,
      language === "en" ? `${suffixWritten} establishes the ${group} parent. Ring position 1 bears the characteristic group; the accepted locant sequence is ${positions.join(",") || "unsubstituted"}.`
        : `${suffixWritten} establece el padre aromático con función ${groupEs}. El grupo característico ocupa la posición 1 del anillo; los localizadores son ${positions.join(",") || "ninguno"}.`,
      {numbering:ids.map((id,i)=>[id,i+1]),language,numberingScope:"parent",
        writtenLocants:ps.flatMap(p=>p.locantSpans.map(span=>({...span,atomId:ids[span.locant-1]})))});
    add("suffix","suffix",suffixWritten,start,functionIds,
      language === "en" ? `The ${group} group supplies the characteristic suffix. Secondary functions are expressed as prefixes.`
        : `El grupo ${groupEs} queda representado por sus átomos y enlaces característicos.`);
    const rule = suffix==="aniline" ? blueBookRule("P-62.2.1", "P6")
      : suffix==="benzamide" ? blueBookRule("P-66.1.1.1.2", "P6a")
      : suffix==="benzonitrile" ? blueBookRule("P-66.5.1.2.1", "P6a")
      : suffix==="benzaldehyde" ? blueBookRule("P-66.6.1.2.1", "P6a")
      : esterInput ? blueBookRule("P-65.6.3.3.1", "P6") : blueBookRule("P-59.2.1.4", "P5");
    evidence={source:"active-name",language,construction:esterInput?"aromatic-ester":"retained-aromatic",
      rules:[rule,blueBookRule("P-59.2.5","P5"),...(nPrefix?[blueBookRule("P-66.1.1.3.1.1","P6a"),blueBookRule("P-14.5","P1")]:[]),
        ...(nPrefix?.term.en==="benzyl"?[blueBookRule("P-57.1.2","P5")]:[])],parentSelection:"retained-functional-parent",
      numbering:proveMonocycleNumbering(6,ps.map(p=>p.positions)),stereo:"unspecified-only"};
    allowEquivalentNumbering=true;
  } else if(cyclicInput) {
    const language=cyclicInput[2]==="cyclo"?"en":"es";
    const suffix=unsaturatedCycle?cyclicInput[5]:cyclicInput[4];
    if(language==="es" && suffix==="one" || language==="en" && suffix==="ona")return null;
    const size=roots.indexOf(cyclicInput[3]);
    const doubleLocants=unsaturatedCycle?[Number(cyclicInput[4])]:[];
    // A ketone at C1 cannot share that carbon with a ring C=C bond.
    if(doubleLocants.some(n=>n<2||n>=size))return null;
    const ps=prefixes(cyclicInput[1],0,size,true,language,true);
    if(!ps || ps.some(p=>p.term.kind || p.term.elements.some(e=>e!=="C") || p.term.bonds.length!==p.term.elements.length-1))return null;
    const numbering=proveMonocycleNumbering(size,ps.map(p=>p.positions),doubleLocants);
    if(numbering.comparison>0)return null;
    const ids=Array.from({length:size},()=>atom());
    ids.forEach((id,i)=>edge(id,ids[(i+1)%size],doubleLocants.includes(i+1)?2:1));
    const oxygen=atom("O");group=suffix==="ol"?"alcohol":"ketone";edge(ids[0],oxygen,group==="alcohol"?1:2);
    parent=ids;attach(ps,ids,"parent",language);
    const parentStart=cyclicInput[1].length, parentWritten=name.slice(parentStart);
    add("parent","parent",parentWritten,parentStart,ids,
      language==="en"
        ? `The only suffix-bearing cycle is the ${size}-carbon parent (P-59.2.1.4). The ${group} is at C1; numbering compares unsaturation before the complete prefix locant set and citation-order ties (P-59.2.3, P-59.2.5).`
        : `El único ciclo portador de la función principal es el padre de ${size} carbonos (P-59.2.1.4). La función ${group==="alcohol"?"alcohol":"cetona"} fija C1; se comparan primero las insaturaciones, después el conjunto de localizadores de prefijos y sus desempates (P-59.2.3, P-59.2.5).`,
      {numbering:ids.map((id,i)=>[id,i+1]),numberingScope:"parent",
        writtenLocants:[...ps.flatMap(p=>p.locantSpans.map(span=>({...span,atomId:ids[span.locant-1]}))),
          ...doubleLocants.map(locant=>({start:name.indexOf(`${locant}-en`,parentStart),end:name.indexOf(`${locant}-en`,parentStart)+1,atomId:ids[locant-1],locant})),
          ...(parentWritten.includes("-1-")?[{start:name.lastIndexOf("-1-")+1,end:name.lastIndexOf("-1-")+2,atomId:ids[0],locant:1}]:[])]});
    add("suffix","suffix",suffix,name.length-suffix.length,[ids[0],oxygen],
      language==="en"?`The ring carbon at C1 is bonded to oxygen by ${group==="alcohol"?"a single bond (C–OH)":"a double bond (C=O)"}.`
        : `El carbono C1 del anillo se une al oxígeno mediante ${group==="alcohol"?"un enlace simple (C–OH)":"un enlace doble (C=O)"}.`);
    for(const locant of doubleLocants) {
      const text=`${locant}-en`, start=name.indexOf(text,parentStart);
      add(`unsaturation-${locant}`,"unsaturation",text,start,[ids[locant-1],ids[locant]],
        language==="en"?`The parent double bond is C${locant}=C${locant+1}; suffix C1 has numbering priority.`
          : `El doble enlace parental es C${locant}=C${locant+1}; la función en C1 tiene prioridad de numeración.`,
        {parentId:"parent",locant,numbering:[]});
    }
    evidence={source:"active-name",language,construction:"functional-monocycle",parentSelection:"sole-suffix-bearing-cycle",
      ...(ps.some(p=>p.text.startsWith("prop-1-en-2-") && name[p.start-1]!=="(")?{profile:"current" as const}:{}),
      rules:[...(ps.some(p=>p.text==="prop-1-en-2-il"||p.text==="prop-1-en-2-yl")?[blueBookRule("P-32.1.1","P3"),blueBookRule("P-16.5","P1")]:[]),blueBookRule("P-59.2.1.4","P5"),blueBookRule("P-59.2.3","P5"),blueBookRule("P-59.2.5","P5"),
        blueBookRule(group==="alcohol"?"P-63.1.2":"P-64.2","P6"),blueBookRule("P-59.2.1.8","P5")],
      numbering,stereo:"unspecified-only"};
    allowEquivalentNumbering=true;
  } else if(nAmide) {
    const n=nAmide[1]==="acetamide"?2:roots.indexOf(nAmide[1].slice(0,-7));if(n<2)return null;
    const ids=chain(n), o=atom("O"), nitrogen=atom("N");edge(ids[0],o,2);edge(ids[0],nitrogen);
    const phenyl=ring();edge(nitrogen,phenyl[0]);parent=[...ids,nitrogen];group="amide";
    add("parent","parent",nAmide[1],name.length-nAmide[1].length,parent,"The amide is the parent; its carbonyl carbon is C1.",{numbering:ids.map((id,i)=>[id,i+1])});
    add("suffix","suffix","amide",name.length-5,[ids[0],o,nitrogen],"C(=O)–N establishes the amide function.");
    add("n-phenyl","substituent","N-phenyl",0,phenyl,"N- places the phenyl substituent on nitrogen.",{locant:"N",parentId:"parent",bondIds:[...graph.bonds.filter(([a,b])=>phenyl.includes(a)&&phenyl.includes(b)).map(([a,b]):[number,number]=>[a,b]),[nitrogen,phenyl[0]]]});
  } else if(diarylKetone || arylKetone) {
    // 'diphenyl' is one multiplicative component. Separate ring targets would
    // incorrectly distinguish symmetry-equivalent phenyl groups.
    const n=arylKetone ? arylKetone[1]==="ethanone"?2:roots.indexOf(arylKetone[1].split("an-")[0]) : 1;
    if(n<1)return null;
    const ids=chain(n),o=atom("O");edge(ids[0],o,2);const phenyl=ring();edge(ids[0],phenyl[0]);
    if(!arylKetone){const second=ring();edge(ids[0],second[0]);phenyl.push(...second);}
    parent=ids;group="ketone";const text=arylKetone?arylKetone[1]:"methanone";
    add("parent","parent",text,name.length-text.length,ids,"The ketone carbonyl is C1 of the acyclic parent.",{numbering:ids.map((id,i)=>[id,i+1])});
    add("suffix","suffix","one",name.length-3,[ids[0],o],"The carbonyl carbon is bonded to carbon on both sides, establishing a ketone.");
    add(arylKetone?"phenyl":"diphenyl","substituent",arylKetone?"phenyl":"diphenyl",arylKetone?2:0,phenyl,
      "The phenyl substituent(s) are bonded directly to the carbonyl carbon. Equivalent phenyl rings share one multiplicative target.",
      {parentId:"parent",locant:1,bondIds:graph.bonds.filter(([a,b])=>phenyl.includes(a)&&phenyl.includes(b)||a===ids[0]&&phenyl.includes(b)).map(([a,b])=>[a,b])});
  } else if(acyclic || simpleChain) {
    const prefixText=simpleChain?"":acyclic![1], root=simpleChain?simpleChain[1]:acyclic![2], suffix=simpleChain?simpleChain[2]:acyclic![3];
    const n=roots.indexOf(root);if(n<1)return null;
    const ps=prefixes(prefixText,0,n,true);if(!ps || ps.some(p=>p.positions.includes(1)))return null;
    const ids=chain(n),o=atom("O");edge(ids[0],o,2);let functionIds=[ids[0],o];parent=[...ids];
    group=suffix==="oic acid"?"carboxylicAcid":suffix==="amide"?"amide":"aldehyde";
    if(group!=="aldehyde"){const terminal=atom(group==="amide"?"N":"O");edge(ids[0],terminal);functionIds=[...functionIds,terminal];if(group==="amide")parent.push(terminal);}
    attach(ps,ids);
    // Parent choice must include the principal carbonyl and the longest
    // available acyclic carbon path. Parsing a shorter name is insufficient.
    const paths=(id:number,from:number|null):number[][]=>{
      const continuations=graph.bonds.flatMap(([a,b])=>{
      const other=a===id?b:b===id?a:null;
        return other!==null && other!==from && graph.atoms[other-1].element==="C"?paths(other,id):[];
      });
      return continuations.length?continuations.map(path=>[id,...path]):[[id]];
    };
    const candidates=paths(ids[0],null), maximum=Math.max(...candidates.map(path=>path.length));
    if(maximum!==n)return null;
    const longestPaths=candidates.filter(path=>path.length===maximum);
    if(longestPaths.length>1) {
      const proof=analyzeStructuralEquivalence(graph,graph);
      // Every tied parent must be the pointwise image of the parsed numbered
      // parent under a chemical automorphism. A non-equivalent tie stays partial.
      if(!proof || longestPaths.some(path=>!proof.mappings.some(map=>ids.every((id,i)=>map.get(id)===path[i]))))return null;
      equivalentParentPaths=longestPaths;
    }
    const parentText=`${root}an${suffix}`;
    add("parent","parent",parentText,name.length-parentText.length,parent,`The ${n}-carbon parent contains the principal ${group} carbon as C1; longer rooted carbon paths are excluded by validation.`,{numbering:ids.map((id,i)=>[id,i+1])});
    add("suffix","suffix",suffix,name.length-suffix.length,functionIds,`The ${group} group supplies the suffix; hydroxyl, amino and alkoxy groups remain prefixes.`);
  } else return null;
  if(evidence) for(const component of components) {
    component.language=evidence.language;
    component.numberingScope=component.numberingScope ?? (component.role==="prefix"?"parent":component.id);
  }
  return {graph,components,parent,group,equivalentParentPaths,allowEquivalentNumbering,evidence};
}
