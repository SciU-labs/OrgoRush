import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { legacyPrefixTerm, type LegacyFragment } from "./iupac1979-name-structure.ts";
import { blueBookRule, substitutiveCitationKey, proveMonocycleNumbering, type NameComponent, type CompositionalFamilyGraph } from "./compositional-name-model.ts";
import { analyzeStructuralEquivalence, regionsFormOrbit } from "./structural-derivation.ts";


/** Bounded alkanamide production. Fragment tables provide the connected
 * radicals; parent choice, orientation, N valence and citation are checked here. */
export function parseSubstitutedAlkanamide(name: string): CompositionalFamilyGraph | null {
  const ending = /(acet|ethan|etan|propan|butan|pentan|hexan)(amide|amida)$/.exec(name);
  if (!ending || !ending.index) return null;
  const language=ending[2]==="amide"?"en":"es";
  if (ending[1]===(language==="en"?"etan":"ethan")) return null;
  const length:Record<string,number>={acet:2,ethan:2,etan:2,propan:3,butan:4,pentan:5,hexan:6};
  const graph:GeneratedMolecule={atoms:[],bonds:[]}, components:NameComponent[]=[];
  function atom(element:"N"|"C"|"O"="C") {
    const id=graph.atoms.length+1;
    graph.atoms.push({id,element,x:0,y:0});
    return id;
  }
  const edge=(a:number,b:number,order:1|2|3=1)=>graph.bonds.push([a,b,order]);
  const chain=Array.from({length:length[ending[1]]},()=>atom());
  chain.slice(1).forEach((id,i)=>edge(chain[i],id));
  const oxygen=atom("O"), amideN=atom("N");
  edge(chain[0],oxygen,2);edge(chain[0],amideN);
  function part(id:string,role:NameComponent["role"],start:number,text:string,atomIds:number[],
    explanation:string,explanationEs:string,anchor?:number,options:Partial<NameComponent>={}) {
    const included=new Set(atomIds);
    const bondIds=graph.bonds.filter(([a,b])=>included.has(a)&&included.has(b) ||
      a===anchor&&included.has(b) || b===anchor&&included.has(a)).map(([a,b]):[number,number]=>[a,b]);
    components.push({id,role,start,end:start+text.length,text,atomIds,bondIds,explanation,explanationEs,numbering:[],language,attachmentBonds:bondIds.filter(([a,b])=>included.has(a)!==included.has(b)),...options});
  }
  function attach(term:LegacyFragment,anchor:number) {
    const ids=term.elements.map(el=>atom(el as "C"|"N"));
    for(const [a,b,order] of term.bonds) edge(ids[a],ids[b],order as 1|2|3);
    edge(anchor,ids[0]);
    return ids;
  }
  const prefix=name.slice(0,ending.index), parentLocants:NonNullable<NameComponent["writtenLocants"]>=[];
  const equivalentBranches:number[][][]=[];
  let cursor=0, nBranches=0, previousKey="";
  while(cursor<prefix.length) {
    const token=/^(N,N|N|[2-9])-(?:\(([^()]+)\)|([a-z]+))/.exec(prefix.slice(cursor));
    if(!token)return null;
    const [full,locant,compound,simple]=token, body=compound??simple, start=cursor+locant.length+(compound?2:1);
    const key=substitutiveCitationKey(full);
    if(previousKey && previousKey.localeCompare(key,language)>=0)return null;
    previousKey=key;
    const onN=locant.startsWith("N"), count=locant==="N,N"?2:1, position=Number(locant);
    if(onN)nBranches+=count;
    if(nBranches>2 || !onN && position>chain.length)return null;
    const anchor=onN?amideN:chain[position-1], id="branch-"+cursor;
    if(!onN)parentLocants.push({start:cursor,end:cursor+locant.length,atomId:anchor,locant:position});
    const amino=/^(di)?(methyl|ethyl|propyl|metil|etil|propil)amino$/.exec(body);
    const aryl=/^([2-6](?:,[2-6])?)-(di)?(methyl|ethyl|metil|etil)(phenyl|fenil)$/.exec(body);
    const base=count===2?body.slice(2):body, term=legacyPrefixTerm(base);
    if(!term || term[language]!==base || term.charges || term.stereochemistry ||
       term.elements.some(e=>e!=="C"&&e!=="N"))return null;
    const linear=/^(methyl|ethyl|propyl|metil|etil|propil)$/.test(base);
    const phenyl=base===(language==="en"?"phenyl":"fenil");
    if(count===2 && (!body.startsWith("di") || !linear))return null;
    if(amino && (onN || !compound) || aryl && (!onN || !compound))return null;
    if(!amino && !aryl && (!linear && !(onN&&phenyl) || !!compound))return null;
    if(!onN && linear && term.elements.length>chain.length-position)return null;
    const regions=Array.from({length:count},()=>attach(term,anchor)), ids=regions.flat();
    if(count>1)equivalentBranches.push(regions);
    const ringPositions=aryl?.[1].split(",").map(Number)??[];
    if(aryl && (ringPositions.length!==(aryl[2]?2:1) ||
      proveMonocycleNumbering(6,[ringPositions]).comparison>0))return null;
    const whyEn=onN ? `N places ${body} on the nitrogen directly bonded to the amide carbonyl.`
      : `${body} is attached to C${position} of the amide chain.`;
    const whyEs=onN ? `N sitúa «${body}» en el nitrógeno unido directamente al carbonilo de la amida.`
      : `«${body}» se une al C${position} de la cadena de la amida.`;
    part(id,"substituent",cursor,full,ids,whyEn,whyEs,anchor,{
      parentId:"parent",locant:onN?"N":position,numbering:[[anchor,onN?"N":position]],
      ...(onN?{attachmentScope:"amide-nitrogen",nLocantStarts:count===2?[cursor,cursor+2]:[cursor]}:{}),
      ...(count===2?{externalMultiplier:"di"}:{})});
    if(amino) {
      const nitrogen=ids[0], alkyl=body.slice(0,-5);
      if(amino[1]) {
        const size=(ids.length-1)/2;
        equivalentBranches.push([ids.slice(1,1+size),ids.slice(1+size)]);
      }
      part(id+"-amino","prefix",start+alkyl.length,"amino",[nitrogen],
        "This nitrogen bears the alkyl branches. The amide outranks the amine, which is cited as amino.",
        "Este nitrógeno lleva las ramas alquilo. La amida tiene prioridad y la amina se cita como amino.",anchor,{parentId:id});
      part(id+"-amino-alkyl","prefix",start,alkyl,ids.slice(1),
        `${alkyl} counts ${amino[1]?2:1} alkyl chain(s) directly bonded to the amino nitrogen.`,
        `«${alkyl}» cuenta ${amino[1]?2:1} cadena(s) alquilo unida(s) al nitrógeno del amino.`,nitrogen,{parentId:id+"-amino"});
    }
    if(aryl) {
      const ring=ids.slice(0,6), branches=ids.slice(6), ringStart=start+body.length-aryl[4].length;
      const word=body.slice(aryl[1].length+1,-aryl[4].length);
      part(id+"-ring","prefix",ringStart,aryl[4],ring,
        "Ring C1 is the carbon bonded to the amide nitrogen. Count around the ring to give its substituents the lowest locants.",
        "El C1 del anillo se une al nitrógeno amídico. El sentido de numeración da los menores localizadores a los sustituyentes.",anchor,{parentId:id});
      // A reflection fixing the attachment carbon exchanges 2/6 or 3/5.
      // Other multiply cited positions retain their individual identities.
      const exchanged=ringPositions.length===2 && ringPositions[0]+ringPositions[1]===8;
      const branchSize=branches.length/ringPositions.length;
      const occurrences=ringPositions.map((_,i)=>branches.slice(i*branchSize,(i+1)*branchSize));
      if(exchanged)equivalentBranches.push(occurrences);
      if(!exchanged)components.find(c=>c.id===id+"-ring")!.writtenLocants=ringPositions.map((locant,i)=>({
        start:start+2*i,end:start+2*i+1,atomId:ring[locant-1],locant}));
      const ringSites=ringPositions.map(p=>ring[p-1]);
      part(id+"-ring-positions","prefix",start,aryl[1],ringSites,
        `Ring positions ${aryl[1]} locate the substituents within phenyl.`,
        `Las posiciones ${aryl[1]} sitúan los sustituyentes dentro del fenilo.`,undefined,{parentId:id+"-ring",bondIds:[]});
      const branchBonds=graph.bonds.filter(([a,b])=>branches.includes(a)||branches.includes(b)).map(([a,b]):[number,number]=>[a,b]);
      part(id+"-ring-alkyl","prefix",start+aryl[1].length+1,word,branches,
        `${word} counts ${ringPositions.length} alkyl attachment(s) at ring positions ${aryl[1]}.`,
        `«${word}» cuenta ${ringPositions.length} unión(es) alquilo en las posiciones ${aryl[1]} del anillo.`,
        undefined,{parentId:id+"-ring",bondIds:branchBonds});
    }
    cursor+=full.length;
    if(cursor<prefix.length && (prefix[cursor++]!=="-" || cursor===prefix.length))return null;
  }
  if(!components.length)return null;
  if(equivalentBranches.length) {
    const symmetry=analyzeStructuralEquivalence(graph,graph);
    if(!symmetry || equivalentBranches.some(group=>!regionsFormOrbit(group,symmetry.mappings)))return null;
  }
  part("parent","parent",ending.index,ending[0],chain,
    `The longest chain containing the amide carbonyl has ${chain.length} carbons. Number from the carbonyl carbon, C1.`,
    `La cadena más larga que contiene el carbonilo de la amida tiene ${chain.length} carbonos. Se numera desde el carbono carbonílico, C1.`,
    undefined,{numbering:chain.map((id,i)=>[id,i+1]),writtenLocants:parentLocants});
  part("suffix","suffix",name.length-ending[2].length,ending[2],[chain[0],oxygen,amideN],
    "The C(=O)–N group supplies the amide suffix.","El grupo C(=O)–N aporta el sufijo de amida.");
  return {parent:chain,graph,components,group:"amide",evidence:{
    source:"active-name",language,construction:"substituted-alkanamide",parentSelection:"acyl-chain",
    rules:[blueBookRule("P-66.1.1.3.1.1","P6a"),blueBookRule("P-14.5","P1")],
    numbering:{scope:"parent",priorities:["carbonyl"],selected:[[1]],reflected:[[chain.length]],comparison:-1},stereo:"unspecified-only"}};
}
