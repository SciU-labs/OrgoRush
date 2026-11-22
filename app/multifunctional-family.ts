import { readBalanced } from "./name-delimiters.ts";
import { blueBookRule, compareLocantSequences, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { getPotentialTetrahedralStereoCenterIds } from "./tetrahedral-stereochemistry.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";

type Language = "en" | "es";
type Token = { positions: number[]; word: string; start: number; body: number; end: number; wrapper: string };
const lengths: Record<string,number> = {eth:2,et:2,prop:3,but:4,pent:5,hex:6,hept:7,oct:8};
const sorted = (numbers: number[]) => [...numbers].sort((a,b)=>a-b);

// Read one numbering scope. Delimiters belong to a token and must balance
// before a hyphen can introduce a sibling in the enclosing scope.
function tokens(text: string, base: number): Token[] | null {
  const result: Token[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = cursor, match = /^([1-9](?:,[1-9])*)-/.exec(text.slice(cursor));
    if (!match) return null;
    cursor += match[0].length;
    const opening = text[cursor], wrapped = opening === "(" || opening === "[";
    const body = cursor + Number(wrapped);
    if (wrapped) {
      const group = readBalanced(text,cursor);
      if (!group) return null;
      cursor = group.end;
    } else {
      const simple = /^[a-z]+/.exec(text.slice(cursor));
      if (!simple) return null;
      cursor += simple[0].length;
    }
    const word = text.slice(body, cursor - Number(wrapped));
    result.push({positions:match[1].split(",").map(Number),word,start:start+base,body:body+base,end:cursor+base,wrapper:wrapped?opening:""});
    if (cursor < text.length && (text[cursor++] !== "-" || cursor === text.length)) return null;
  }
  return result;
}

const citation = (word:string) => word.replace(/^\([1-9][RS]\)-/,"").replace(/(?:tert|terc)-/g,"").replace(/[^a-z]/g,"");
function ordered(entries:Token[], language:Language) {
  const key=(t:Token)=>citation(t.positions.length>1?t.word.replace(/^di/,""):t.word);
  return entries.every((t,i)=>!i || key(entries[i-1]).localeCompare(key(t),language)<0);
}

export function parseMultifunctionalFamily(name:string, language:Language): CompositionalFamilyGraph | null {
  const en=language==="en", acid = en ? name.endsWith(" acid") : name.startsWith("ácido ");
  const start = acid && !en ? 6 : 0;
  const end = acid && en ? name.length-5 : name.length;
  const body=name.slice(start,end);
  const diacid=(en?/(eth|prop|but|pent|hex|hept|oct)anedioic$/:/(et|prop|but|pent|hex|hept|oct)anodioico$/).exec(body);
  const triacid=(en?/(prop|but|pent|hex|hept|oct)ane-([1-8],[1-8],[1-8])-tricarboxylic$/:/(prop|but|pent|hex|hept|oct)ano-([1-8],[1-8],[1-8])-tricarboxílico$/).exec(body);
  const phenol=(en?/(phenol|benzene-1,2-diol)$/:/(fenol|benceno-1,2-diol)$/).exec(body);
  const alkanol=(en?/(cyclo)?(prop|but|pent|hex|hept|oct)an-([1-8])-ol$/:/(ciclo)?(prop|but|pent|hex|hept|oct)an-([1-8])-ol$/).exec(body);
  const ending=acid ? diacid??triacid : phenol??alkanol;
  if (!ending) return null;
  const cyclic=!!(phenol||alkanol?.[1]), aromatic=!!phenol;
  const size=phenol?6:lengths[alkanol?.[2]??ending[1]];
  const suffixSites=diacid?[1,size]:triacid?triacid[2].split(",").map(Number):phenol?phenol[1].endsWith("diol")?[1,2]:[1]:[Number(alkanol![3])];
  if (suffixSites.some((p,i)=>p>size || i>0 && p<=suffixSites[i-1]) || triacid && (suffixSites[0]!==1 || suffixSites[2]!==size)) return null;
  const stereo=/^\(([1-8][RS](?:,[1-8][RS])*)\)-/.exec(body);
  const offset=start+(stereo?.[0].length??0);
  const entries=tokens(name.slice(offset,start+ending.index),offset);
  // This grammar is shared by aminoalcohols and aromatic hydroxy parents.
  // A phenol may carry carbon substituents or another hydroxyl-bearing ring;
  // the latter is admitted only after the candidate parent and competing
  // suffix-bearing ring have been compared below.  Keep bare/simple alcohols
  // outside this production.
  if (!entries || !ordered(entries,language) || !acid && (!entries.length || !(/amino/.test(body) || aromatic))) return null;
  // Keep the existing aminoalkyl benzenediol proof for the simple production.
  if (phenol?.[1].endsWith("diol") && entries.length===1 && /^[1-9]-amino(?:ethyl|propyl|butyl|etil|propil|butil)$/.test(entries[0].word)) return null;
  const positions=entries.flatMap(t=>t.positions);
  if (new Set(positions).size!==positions.length || positions.some(p=>p>size || (aromatic||diacid)&&suffixSites.includes(p))) return null;
  const score=(map:(n:number)=>number)=>[sorted(suffixSites.map(map)),sorted(positions.map(map)),...entries.map(t=>sorted(t.positions.map(map)))];
  const selected=score(n=>n);
  const alternatives=cyclic?Array.from({length:size*2-1},(_,index)=>{
    const i=index+1;
    return score(n=>1+((Math.floor(i/2)+(i%2?-1:1)*(n-1)+size)%size));
  }):[score(n=>size+1-n)];
  const compare=(a:number[][],b:number[][])=>compareLocantSequences(a.flat(),b.flat());
  if (alternatives.some(alt=>compare(selected,alt)>0)) return null;

  const graph:GeneratedMolecule={atoms:[],bonds:[]}, components:NameComponent[]=[];
  function atom(element:"C"|"O"|"N"="C") {
    const id=graph.atoms.length+1; graph.atoms.push({id,element,x:0,y:0}); return id;
  }
  function bond(a:number,b:number,order:1|2=1) {graph.bonds.push([a,b,order]);}
  function skeleton(n:number,ring=false,aryl=false) {
    const ids=Array.from({length:n},()=>atom());
    for(let i=0;i<n-1;i++) bond(ids[i],ids[i+1],aryl&&i%2===0?2:1);
    if(ring) bond(ids[n-1],ids[0]);
    return ids;
  }
  function part(id:string,role:NameComponent["role"],from:number,to:number,ids:number[],explanation:string,explanationEs:string,
    extra:Partial<NameComponent>={},anchor?:number) {
    const members=new Set(ids);
    const bonds=graph.bonds.filter(([a,b])=>members.has(a)&&members.has(b)||a===anchor&&members.has(b)||b===anchor&&members.has(a));
    const component:NameComponent={id,role,start:from,end:to,text:name.slice(from,to),language,atomIds:ids,
      bondIds:bonds.map(([a,b])=>[a,b]),numbering:[],explanation,explanationEs,...extra};
    components.push(component); return component;
  }
  function configuration(spec:string,from:number,ids:number[],scope:string) {
    let at=from;
    const seen=new Set<number>();
    for(const descriptor of spec.split(",")) {
      const p=Number(descriptor[0]),id=ids[p-1];
      if(!id||seen.has(p)||[...seen].some(previous=>previous>p))return false;
      seen.add(p);
      graph.atoms[id-1].tetrahedralParity=descriptor[1] as "R"|"S";
      part("stereo-"+at,"prefix",at,at+2,[id],`The descriptor specifies configuration ${descriptor[1]} at C${p}.`,
        `El descriptor indica configuración ${descriptor[1]} en C${p}.`,{parentId:scope,numbering:[[id,p]],mappingGroup:"configurations-"+scope+"-"+descriptor[1]});
      at+=3;
    }
    return true;
  }
  const parent=skeleton(size,cyclic,aromatic);
  if(stereo && !configuration(stereo[1],start+1,parent,"parent"))return null;
  const parentStart=start+ending.index;
  const suffixOffset = triacid ? ending[0].lastIndexOf("-")+1 : diacid ? ending[1].length+3 : ending[0].length-(ending[0].endsWith("diol")?4:2);
  const suffixStart=parentStart+suffixOffset;
  const groups=suffixSites.map(p=>{
    const site=parent[p-1],c=triacid?atom():site;
    if(triacid)bond(site,c);
    const oh=atom("O");bond(c,oh);
    if(!acid)return [c,oh];
    const oxo=atom("O");bond(c,oxo,2); return [c,oh,oxo];
  });
  const why=diacid?["The path between both carboxyl carbons includes them as its two ends.","La cadena incluye ambos carbonos carboxílicos en sus extremos."]:
    triacid?["A chain can include at most two carboxyl carbons. The backbone bears all three as external carboxyl groups, so all three enter the suffix.","Una cadena puede incluir como máximo dos carbonos carboxílicos. El esqueleto lleva los tres carboxilos externos y permite citar los tres mediante el sufijo."]:
    aromatic?[suffixSites.length===2?"The ring bears two hydroxyls, more than the side chain.":"The ring and the competing chains each bear one hydroxyl. The cycle takes precedence under the current profile.",
      suffixSites.length===2?"El anillo lleva dos hidroxilos y supera a la cadena lateral.":"El anillo y las cadenas candidatas llevan un hidroxilo cada uno. El perfil actual da prioridad al ciclo."]:
    ["The hydroxyl determines the suffix ahead of the amine and ether. The selected carbon skeleton carries that hydroxyl.","El hidroxilo tiene prioridad sobre la amina y el éter para el sufijo. El esqueleto elegido lleva ese hidroxilo."];
  const parentNode=part("parent","parent",parentStart,name.length,parent,why[0],why[1],{numbering:parent.map((id,i)=>[id,i+1]),writtenLocants:[]});
  const suffix=part("suffix","suffix",suffixStart,name.length,groups.flat(),acid?`All ${groups.length} carboxyl groups contribute to the acid suffix.`:"Alcohol has priority over amine and ether. Hydroxyls on the parent supply the suffix.",
    acid?`Los ${groups.length} carboxilos aportan el sufijo de ácido.`:"El alcohol tiene prioridad sobre la amina y el éter. Los hidroxilos del padre aportan el sufijo.");
  suffix.bondIds=groups.flatMap(ids=>ids.slice(1).map(id=>[ids[0],id] as [number,number]));
  if(triacid || phenol?.[1].endsWith("diol") || alkanol) {
    const digits=parentStart+ending[0].indexOf("-")+1;
    suffixSites.forEach((p,i)=>parentNode.writtenLocants!.push({start:digits+i*2,end:digits+i*2+1,atomId:parent[p-1],locant:p}));
  }
  if(acid) groups.forEach((ids,i)=>part("carboxyl-"+suffixSites[i],"suffix",suffixStart,name.length,ids,why[0],why[1],
    {parentId:"suffix",mappingGroup:"acid-occurrences",label:"Carboxyl at C"+suffixSites[i],labelEs:"Carboxilo en C"+suffixSites[i]}));

  const scopeNames=new Map<string,string>([["parent",en?"parent structure":"estructura principal"]]);
  function attach(t:Token,anchor:number,scope:string,depth:number):boolean {
    if(depth>3||t.positions.length!==1)return false;
    const {word,body:from}=t, p=t.positions[0], id="group-"+t.start;
    scopeNames.set(id,word);
    // The scope map is populated below for every nested component. Keeping the
    // chemical name here lets locant evidence say which ring or chain is being
    // numbered instead of referring to a generic "numbered skeleton".
    const scopeName=scopeNames.get(scope);
    const first=graph.atoms.length;
    const hydroxy=word===(en?"hydroxy":"hidroxi");
    const amino=/(amino)$/.exec(word);
    const oxy=(en?/(methoxy|ethoxy|propan-2-yloxy)$/:/(metoxi|etoxi|propan-2-iloxi)$/).exec(word);
    const aryl=(en?/(phenoxy|phenyl)$/:/(fenoxi|fenil)$/).exec(word);
    const alkyl=(en?/(methyl|ethyl|propyl)$/:/(metil|etil|propil)$/).exec(word);
    if(hydroxy || amino || oxy && oxy.index===0) {
      const simple=hydroxy || word==="amino" || !!oxy && !word.startsWith("propan");
      if(t.wrapper!==(simple?"":"("))return false;
      const hetero=atom(amino?"N":"O"); bond(anchor,hetero);
      if(!simple || oxy) {
        let radical=amino?word.slice(0,-5):word.startsWith("propan")?word.slice(0,-3):word.startsWith("met")?(en?"methyl":"metil"):(en?"ethyl":"etil");
        const copies=radical.startsWith("di")?2:1;
        if(copies===2)radical=radical.slice(2);
        const branched=radical===(en?"propan-2-yl":"propan-2-il")?"isopropyl":radical===(en?"tert-butyl":"terc-butil")?"tert-butyl":null;
        if(!branched && !(en?/^(methyl|ethyl|propyl)$/:/^(metil|etil|propil)$/).test(radical))return false;
        const term=legacyPrefixTerm(branched??radical);
        if(!term)return false;
        const carbons:number[]=[];
        for(let copy=0;copy<copies;copy++){
          const ids=term.elements.map(()=>atom()); bond(hetero,ids[0]);
          for(const [a,b] of term.bonds)bond(ids[a],ids[b]);
          carbons.push(...ids);
        }
        const split=t.end-Number(!!t.wrapper)-(amino?5:3);
        const heteroName=amino?(en?"amine nitrogen":"nitrógeno de la amina"):(en?"ether oxygen":"oxígeno del éter");
        const rootedGroup=branched??radical;
        const groupName=rootedGroup==="methyl"||rootedGroup==="metil"?(en?"methyl":"metilo")
          :rootedGroup==="ethyl"||rootedGroup==="etil"?(en?"ethyl":"etilo")
          :rootedGroup==="propyl"||rootedGroup==="propil"?(en?"propyl":"propilo")
          :rootedGroup==="isopropyl"?(en?"propan-2-yl":"propan-2-ilo")
          :rootedGroup==="tert-butyl"?(en?"tert-butyl":"terc-butilo"):null;
        part(id+"-link","prefix",split,t.end-Number(!!t.wrapper),[hetero],
          `The substituent attaches through the ${heteroName}.`,`El sustituyente se une a través del ${heteroName}.`,{parentId:id},anchor);
        if(!groupName)return false;
        const quantified=en?`${copies===2?"Two":"One"} ${groupName}${copies===2?" groups":" group"}`
          :`${copies===2?"Dos grupos de ":"Un grupo de "}${groupName}`;
        part(id+"-alkyl","prefix",from,split,carbons,
          `${quantified} ${copies===1?(en?"is":"está"): (en?"are":"están")} bonded to the ${heteroName}.`,
          `${quantified} ${copies===1?"está":"están"} unido${copies===1?"":"s"} al ${heteroName}.`,{parentId:id},hetero);
      }
    } else if(aryl||alkyl) {
      const core=(aryl??alkyl)!, isEther=!!aryl&&/oxy$|oxi$/.test(word);
      const nestedText=word.slice(0,core.index);
      const descriptor=/^\(([1-8][RS])\)-/.exec(nestedText);
      const nestedStart=descriptor?.[0].length??0;
      let nested=tokens(nestedText.slice(nestedStart),from+nestedStart);
      const hydroxymethyl=nestedText===(en?"hydroxy":"hidroxi") && /^met/.test(core[0]);
      if(hydroxymethyl)nested=[{word:nestedText,start:from,body:from,end:from+nestedText.length,positions:[1],wrapper:""}];
      if(!nested || !ordered(nested,language) || aryl && descriptor)return false;
      if(t.wrapper!==(nestedText?(nestedText.includes("(")?"[":"("):""))return false;
      const n=aryl?6:/^met/.test(core[0])?1:/^et/.test(core[0])?2:3;
      const attachment=isEther?atom("O"):anchor;
      if(isEther)bond(anchor,attachment);
      const ids=skeleton(n,!!aryl,!!aryl);bond(attachment,ids[0]);
      if(descriptor && !configuration(descriptor[1],from+1,ids,id))return false;
      const used=new Set<number>();
      for(const sub of nested){
        const at=sub.positions[0];
        if(at>n || used.has(at) || aryl && (at<2 || at>4 || nested.length!==1))return false;
        // A hydroxyphenyl branch is a second candidate ring bearing the same
        // senior characteristic group. It is retained as a candidate here;
        // global parent validation below must show that the named parent is
        // admissible for the current construction and profile.
        // A rooted alkyl ends at its longest carbon path. Only heteroatom or aromatic attachments can branch off it.
        if(!aryl && !/amino$|oxy$|oxi$|hydroxy$|hidroxi$|phenyl$|fenil$/.test(sub.word))return false;
        if(!attach(sub,ids[at-1],id,depth+1))return false;
        used.add(at);
      }
      if(nested.length || isEther){
        const internalDetail=nested.map(sub=>`${sub.word} ${en?"at":"en"} C${sub.positions.join(en?" and ":" y ")}`);
        const internalText=internalDetail.length?`; ${internalDetail.join(en?" and ":" y ")}`:"";
        const coreExplanation=aryl
          ?en?`In this ${isEther?"phenoxy":"phenyl"} ring, C1 is the atom bonded to ${isEther?"oxygen":"the parent"}${internalText}.`
            :`En este anillo ${isEther?"fenoxi":"fenilo"}, C1 es el átomo unido a ${isEther?"oxígeno":"la estructura principal"}${internalText}.`
          :en?`The ${word} carbon chain starts at C1, the carbon attached to ${isEther?"oxygen":"the preceding group"}${internalText}.`
            :`La cadena carbonada ${word} empieza en C1, el carbono unido a ${isEther?"oxígeno":"el grupo anterior"}${internalText}.`;
        const coreExplanationEs=aryl
          ?`En este anillo ${isEther?"fenoxi":"fenilo"}, C1 es el átomo unido a ${isEther?"oxígeno":"la estructura principal"}${internalText}.`
          :`La cadena carbonada ${word} empieza en C1, el carbono unido a ${isEther?"oxígeno":"el grupo anterior"}${internalText}.`;
        part(id+"-core","prefix",from+core.index,from+word.length,ids,
        coreExplanation,coreExplanationEs,
        {parentId:id,numberingScope:id,numbering:[[ids[0],1]],writtenLocants:nested.filter(()=>!hydroxymethyl).map(s=>({start:s.start,end:s.start+1,atomId:ids[s.positions[0]-1],locant:s.positions[0]}))},attachment);
      }
      if(isEther)part(id+"-link","prefix",from+word.length-3,from+word.length,[attachment],"Oxygen joins the two carbon regions.","El oxígeno une las dos regiones carbonadas.",{parentId:id},anchor);
    } else return false;
    scopeNames.set(id,word);
    const targetAt=scope==="parent"?(en?"of the parent structure":"de la estructura principal"):
      /phenyl|fenil/.test(scopeName??"")?(en?"of the phenyl ring":"del anillo fenilo"):
      /phenoxy|fenoxi/.test(scopeName??"")?(en?"of the phenoxy ring":"del anillo fenoxi"):
      (en?`of the ${scopeName??"substituent"} group`:`de la cadena ${scopeName??"sustituyente"}`);
    part(id,scope==="parent"?"substituent":"prefix",t.start,t.end,graph.atoms.slice(first).map(a=>a.id),
      `The ${word} group attaches at C${p} ${targetAt}.`,`El grupo ${word} se une en C${p} ${targetAt}.`,
      {citationKey:citation(word),locant:p,parentId:scope,numberingScope:scope,numbering:[[anchor,p]]},anchor);
    return true;
  }

  for(const entry of entries){
    if(acid){
      const multi=entry.positions.length===2;
      const base=multi?entry.word.slice(2):entry.word;
      if(entry.wrapper || entry.positions.length>2 || multi && (!entry.word.startsWith("di")||entry.positions[0]>=entry.positions[1]) ||
        !(en?/^(methyl|hydroxy|amino)$/:/^(metil|hidroxi|amino)$/).test(base) || triacid && /^met/.test(base))return null;
      const ids=entry.positions.map(p=>{
        const id=atom(/^met/.test(base)?"C":base==="amino"?"N":"O");bond(parent[p-1],id);return id;
      });
      const located=entry.positions.map(position=>`C${position}`).join(en?" and ":" y ");
      part("group-"+entry.start,"substituent",entry.start,entry.end,ids,
        `The prefix places ${base} at ${located} of the acid parent chain.`,
        `El prefijo sitúa ${base} en ${located} de la cadena principal del ácido.`,
        {parentId:"parent",citationKey:citation(base),...(multi?{externalMultiplier:"di"}:{}),numbering:entry.positions.map(p=>[parent[p-1],p]),bondIds:ids.map((id,i)=>[parent[entry.positions[i]-1],id])});
    } else {
      if(!aromatic && !cyclic && !/amino$|oxy$|oxi$/.test(entry.word))return null;
      if(!attach(entry,parent[entry.positions[0]-1],"parent",0))return null;
    }
    entry.positions.forEach((p,i)=>parentNode.writtenLocants!.push({start:entry.start+2*i,end:entry.start+2*i+1,locant:p,atomId:parent[p-1]}));
  }
  // In the supported alcohol productions no subordinate carbon chain may
  // carry more hydroxyls than the selected parent. Compare carbon-only paths.
  if(!acid) {
    const outside=new Set(graph.atoms.filter(a=>a.element==="C"&&!parent.includes(a.id)).map(a=>a.id));
    const hydroxyls=new Set(graph.atoms.filter(a=>a.element==="O"&&graph.bonds.filter(([a1,b])=>a1===a.id||b===a.id).length===1).map(a=>a.id));
    const seen=new Set<number>();
    let competingHydroxyls=0;
    const parentOH=graph.bonds.filter(([a,b])=>parent.includes(a)&&hydroxyls.has(b)||parent.includes(b)&&hydroxyls.has(a));
    if(parentOH.length!==groups.length)return null;
    let outsideCycleRank=0;
    if(outside.size) {
      const outsideEdges=graph.bonds.filter(([a,b])=>outside.has(a)&&outside.has(b));
      const cycleSeen=new Set<number>();
      let components=0;
      for(const id of outside)if(!cycleSeen.has(id)){
        components++;
        const pending=[id];
        while(pending.length){const current=pending.pop()!;if(cycleSeen.has(current))continue;cycleSeen.add(current);
          for(const [a,b] of outsideEdges){const next=a===current?b:b===current?a:0;if(next&&!cycleSeen.has(next))pending.push(next);}
        }
      }
      outsideCycleRank=Math.max(0,outsideEdges.length-outside.size+components);
    }
    for(const id of outside)if(!seen.has(id)){
      let count=0; const pending=[id];
      while(pending.length){const c=pending.pop()!;if(seen.has(c))continue;seen.add(c);
        for(const [a,b] of graph.bonds){const other=a===c?b:b===c?a:0;if(hydroxyls.has(other))count++;if(outside.has(other)&&!seen.has(other))pending.push(other);}
      }
      if(count>groups.length || !cyclic && count)return null;
      competingHydroxyls=Math.max(competingHydroxyls,count);
    }
    if(aromatic&&competingHydroxyls&&outsideCycleRank) {
      parentNode.explanation=`The named parent is this six-carbon benzene ring, where the hydroxyl is expressed by the phenol suffix. Another ring also bears ${competingHydroxyls} hydroxyl group(s). The characteristic-group count is tied, so ring seniority is compared under Blue Book P-44.2.1; both candidates here are six-carbon carbocyclic rings with the same skeletal composition. The active name assigns the suffix to this ring and cites the other hydroxyl-bearing ring as a substituent; this is evidence for the systematic name, not a claim that it is the PIN.`;
      parentNode.explanationEs=`La estructura principal nombrada es este anillo de benceno de seis carbonos, cuyo hidroxilo se expresa mediante el sufijo fenol. Otro anillo también lleva ${competingHydroxyls} grupo(s) hidroxilo. La cantidad de grupos característicos está empatada, así que la senioridad de los anillos se compara conforme a P-44.2.1 del Blue Book; aquí ambos candidatos son anillos carbocíclicos de seis carbonos con la misma composición esquelética. El nombre activo asigna el sufijo a este anillo y cita el otro anillo hidroxilado como sustituyente; esto respalda el nombre sistemático, no afirma que sea el PIN.`;
    } else if(aromatic&&competingHydroxyls) {
      parentNode.explanation=`The named parent is the six-carbon benzene ring bearing the phenol suffix. The competing hydroxyl is on an acyclic carbon region; within the same characteristic-group class, Blue Book P-44.1.2.2 gives the ring seniority over a chain.`;
      parentNode.explanationEs=`La estructura principal nombrada es el anillo de benceno de seis carbonos que lleva el sufijo fenol. El otro hidroxilo está en una región carbonada acíclica; dentro de la misma clase de grupo característico, P-44.1.2.2 del Blue Book da senioridad al anillo frente a la cadena.`;
    } else if(!competingHydroxyls) {
      parentNode.explanation=cyclic ? "This cycle alone carries the hydroxyl suffix. The amine and ether groups, where present, are cited as prefixes." :
        `The uninterrupted chain of ${size} carbons carries the hydroxyl. Extending it through N or O would interrupt the carbon chain.`;
      parentNode.explanationEs=cyclic ? "Solo este ciclo lleva los hidroxilos expresados por sufijo. Las aminas y los éteres presentes se citan mediante prefijos." :
        `La cadena continua de ${size} carbonos lleva el hidroxilo. Pasar por N u O interrumpiría la cadena carbonada.`;
    }
  }
  const configured=graph.atoms.filter(a=>a.tetrahedralParity);
  if(configured.length) {
    const candidates=new Set(getPotentialTetrahedralStereoCenterIds(graph));
    if(configured.some(a=>!candidates.has(a.id)))return null;
  }
  const reflected=alternatives.reduce((best,alt)=>compare(alt,best)<0?alt:best);
  return {graph,parent,components,group:acid?"carboxylicAcid":"alcohol",allowEquivalentNumbering:true,evidence:{
    source:"active-name",profile:"current",language,construction:acid?"polycarboxylic-acid":"multifunctional-alcohol",parentSelection:acid?"polyacid-backbone":"hydroxyl-bearing-parent",
    rules:[blueBookRule("P-44.1.1","P4"),...(aromatic?[blueBookRule("P-44.2.1","P4")]:[]),blueBookRule("P-14.4","P1"),blueBookRule(acid?"P-65.1":"P-63.1","P6")],
    numbering:{scope:"parent",priorities:["suffix","prefix-set","citation"],selected,reflected,comparison:compare(selected,reflected)},
    stereo:configured.length?"specified-tetrahedral":"unspecified-only"}};
}
