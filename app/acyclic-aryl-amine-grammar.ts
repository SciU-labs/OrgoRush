import type { GeneratedAtom, GeneratedMolecule } from "./name-to-molecule.ts";
import { analyzeStructuralEquivalence, regionsFormOrbit, mapStructuralRegions } from "./structural-derivation.ts";

export type AmineNameNode = {
  kind: "parent" | "amine" | "n-alkyl" | "phenyl" | "phenoxy" | "diphenylmethoxy" | "ring-substituent" | "aryl-core" | "halogens" | "alkyl" | "alkoxy";
  text: string;
  span: [number, number];
  atomIds: number[];
  bondIds: [number, number][];
  locant?: number | "N";
  attachmentBond?: [number, number];
  multiplicity?: number;
  children: AmineNameNode[];
};
export type ParsedArylAmine = { graph: GeneratedMolecule; parent: AmineNameNode; amine: AmineNameNode; substituents: AmineNameNode[]; language: "en" | "es" };

/** Interprets a bounded name grammar into a graph; it does not establish
 * nomenclatural priority, preferred status or a FULL pedagogical derivation. */
export function parseAcyclicArylAmine(name: string): ParsedArylAmine | null {
  if (name.length > 200) return null;
  const end = /(meth|eth|prop|but|pent|hex|hept|oct|non|dec|met|et)(?:an)-(\d+)-(amine|amina)$/.exec(name);
  if (!end || end.index === 0) return null;
  const language = end[3] === "amine" ? "en" : "es";
  const roots: Record<string, number> = {meth:1,met:1,eth:2,et:2,prop:3,but:4,pent:5,hex:6,hept:7,oct:8,non:9,dec:10};
  if (language === "es" && ["meth", "eth"].includes(end[1]) || language === "en" && ["met", "et"].includes(end[1])) return null;
  const length = roots[end[1]], amineLocant = Number(end[2]);
  if (String(amineLocant) !== end[2] || !length || amineLocant < 1 || amineLocant > length) return null;
  const prefixText = name.slice(0, end.index);
  type Token = {kind: "n-alkyl" | "phenyl" | "phenoxy" | "diphenylmethoxy" | "alkyl" | "alkoxy"; start:number; end:number; text:string; locant?:number; count?:number; alkylLength?:number; ringLocant?:number; sub?:string; subStart?:number};
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < prefixText.length) {
    const rest = prefixText.slice(pos);
    const n = (language === "en" ? /^(N(?:,N)?)-(dimethyl|diethyl|methyl|ethyl|propyl)/ : /^(N(?:,N)?)-(dimetil|dietil|metil|etil|propil)/).exec(rest);
    if (n) {
      const count = n[1] === "N,N" ? 2 : 1, multiplied = n[2].startsWith("di");
      if ((count === 2) !== multiplied || count + tokens.reduce((total,t) => total+(t.count??0),0) > 2) return null;
      const base = multiplied ? n[2].slice(2) : n[2];
      const alkylLength = /^(methyl|metil)$/.test(base) ? 1 : /^(ethyl|etil)$/.test(base) ? 2 : 3;
      tokens.push({kind:"n-alkyl",start:pos,end:pos+n[0].length,text:n[0],count,alkylLength}); pos += n[0].length;
    } else {
      const m = /^([1-9]\d*)-/.exec(rest); if (!m) return null;
      const locant = Number(m[1]); if (locant < 1 || locant > length) return null;
      const begin = pos; pos += m[0].length;
      const body = prefixText.slice(pos);
      const simple = language === "en" ? /^(phenyl|phenoxy)/.exec(body) : /^(fenil|fenoxi)/.exec(body);
      const diphenyl = language === "en" ? /^\(diphenylmethoxy\)/.exec(body) : /^\(difenilmetoxi\)/.exec(body);
      const aliphatic = (language === "en" ? /^(methoxy|ethoxy|methyl|ethyl)/ : /^(metoxi|etoxi|metil|etil)/).exec(body);
      const nested = language === "en"
        ? /^(?:\[([2-6])-\((trifluoromethyl)\)(?:phenoxy|phenyl)\]|\(([2-6])-(methyl|ethyl|fluoro|chloro|bromo|iodo|methoxy|ethoxy)(?:phenoxy|phenyl)\))/.exec(body)
        : /^(?:\[([2-6])-\((trifluorometil)\)(?:fenoxi|fenil)\]|\(([2-6])-(metil|etil|fluoro|cloro|bromo|yodo|metoxi|etoxi)(?:fenoxi|fenil)\))/.exec(body);
      if (simple) {
        pos += simple[0].length;
        tokens.push({kind:/^(phenyl|fenil)$/.test(simple[0])?"phenyl":"phenoxy",start:begin,end:pos,text:name.slice(begin,pos),locant});
      } else if (aliphatic) {
        pos += aliphatic[0].length;
        tokens.push({kind:/oxy$|oxi$/.test(aliphatic[0])?"alkoxy":"alkyl",start:begin,end:pos,text:name.slice(begin,pos),locant,sub:aliphatic[0]});
      } else if (diphenyl) {
        pos += diphenyl[0].length; tokens.push({kind:"diphenylmethoxy",start:begin,end:pos,text:name.slice(begin,pos),locant});
      } else if (nested) {
        const sub=nested[2] ?? nested[4], ringLocant=Number(nested[1] ?? nested[3]);
        const subStart=pos+nested[0].indexOf(sub); pos+=nested[0].length;
        tokens.push({kind:/phenyl|fenil/.test(nested[0])?"phenyl":"phenoxy",start:begin,end:pos,text:name.slice(begin,pos),locant,ringLocant,sub,subStart});
      } else return null;
    }
    if (pos < prefixText.length) { if (prefixText[pos] !== "-") return null; pos++; if (pos === prefixText.length) return null; }
  }
  if (!tokens.some(token => ["phenyl","phenoxy","diphenylmethoxy"].includes(token.kind))) return null;
  const graph: GeneratedMolecule = {atoms:[],bonds:[]};
  const atom=(element:GeneratedAtom["element"]="C")=>{const id=graph.atoms.length+1;graph.atoms.push({id,element,x:0,y:0});return id;};
  const bond=(a:number,b:number,order:1|2|3=1):[number,number]=>{graph.bonds.push([a,b,order]);return [a,b];};
  const chain=(count:number)=>{const ids=Array.from({length:count},()=>atom());ids.slice(1).forEach((id,i)=>bond(ids[i],id));return ids;};
  const ring=()=>{const ids=Array.from({length:6},()=>atom());ids.forEach((id,i)=>bond(id,ids[(i+1)%6],i%2?1:2));return ids;};
  const internal=(ids:number[])=>graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b]):[number,number]=>[a,b]);
  const main=chain(length), nitrogen=atom("N"), amineBond=bond(main[amineLocant-1],nitrogen);
  const parent:AmineNameNode={kind:"parent",text:end[0],span:[end.index,name.length],atomIds:main,bondIds:internal(main),children:[]};
  const amine:AmineNameNode={kind:"amine",text:end[3],span:[name.length-end[3].length,name.length],atomIds:[nitrogen],bondIds:[amineBond],locant:amineLocant,attachmentBond:amineBond,children:[]};
  const substituents:AmineNameNode[]=[];
  for (const token of tokens) {
    if (token.kind === "n-alkyl") {
      for (let i=0;i<token.count!;i++) { const ids=chain(token.alkylLength!), attachment=bond(nitrogen,ids[0]);
        substituents.push({kind:token.kind,text:token.text,span:[token.start,token.end],atomIds:ids,bondIds:[...internal(ids),attachment],locant:"N",attachmentBond:attachment,children:[]}); }
      continue;
    }
    const ids:number[]=[],children:AmineNameNode[]=[], parentAtom=main[token.locant!-1]; let root:number;
    if (token.kind === "alkyl" || token.kind === "alkoxy") {
      const carbons = chain(/^et/.test(token.sub!) ? 2 : 1);
      root = token.kind === "alkoxy" ? atom("O") : carbons[0];
      if (root !== carbons[0]) { ids.push(root); bond(root,carbons[0]); }
      ids.push(...carbons);
    } else if (token.kind === "diphenylmethoxy") {
      const oxygen=atom("O"), carbon=atom();ids.push(oxygen,carbon);bond(oxygen,carbon);root=oxygen;
      const word=language==="en"?"diphenyl":"difenil", start=token.start+token.text.indexOf(word);
      for(let i=0;i<2;i++){const r=ring();ids.push(...r);const link=bond(carbon,r[0]);children.push({kind:"phenyl",text:word,span:[start,start+word.length],atomIds:r,bondIds:[...internal(r),link],attachmentBond:link,children:[]});}
    } else {
      const oxygen=token.kind === "phenoxy" ? atom("O") : undefined, r=ring();ids.push(...(oxygen?[oxygen]:[]),...r);root=oxygen??r[0];if(oxygen)bond(oxygen,r[0]);
      if(token.sub && token.ringLocant){const subIds:number[]=[];let first:number;
        if(token.sub.startsWith("trifluoro")){first=atom();subIds.push(first);for(let i=0;i<3;i++){const f=atom("F");subIds.push(f);bond(first,f);}}
        else if (/oxy$|oxi$/.test(token.sub)) {first=atom("O");const carbons=chain(/^et/.test(token.sub)?2:1);bond(first,carbons[0]);subIds.push(first,...carbons);}
        else if(["methyl","metil","ethyl","etil"].includes(token.sub)){subIds.push(...chain(/^(ethyl|etil)$/.test(token.sub)?2:1));first=subIds[0];}
        else {const elements:Record<string,GeneratedAtom["element"]>={fluoro:"F",chloro:"Cl",cloro:"Cl",bromo:"Br",iodo:"I",yodo:"I"};first=atom(elements[token.sub]);subIds.push(first);}
        const link=bond(r[token.ringLocant-1],first);const coreIds=[...ids];ids.push(...subIds);children.push({kind:"ring-substituent",text:token.sub,span:[token.subStart!,token.subStart!+token.sub.length],atomIds:subIds,bondIds:[...internal(subIds),link],locant:token.ringLocant,attachmentBond:link,children:token.sub.startsWith("trifluoro") ? [{kind:"halogens",text:"trifluoro",span:[token.subStart!,token.subStart!+"trifluoro".length],atomIds:subIds.slice(1),bondIds:internal(subIds),multiplicity:3,children:[]}] : []});
        const core=token.kind==="phenoxy"?(language==="en"?"phenoxy":"fenoxi"):(language==="en"?"phenyl":"fenil");
        const start=token.start+token.text.lastIndexOf(core);
        children.push({kind:"aryl-core",text:core,span:[start,start+core.length],atomIds:coreIds,attachmentBond:[parentAtom,root],bondIds:[...internal(coreIds),[parentAtom,root]],children:[]});
      }
    }
    const attachment=bond(parentAtom,root);substituents.push({kind:token.kind,text:token.text,span:[token.start,token.end],atomIds:ids,bondIds:[...internal(ids),attachment],locant:token.locant,attachmentBond:attachment,children});
  }
  const degree=new Map(graph.atoms.map(a=>[a.id,0]));for(const [a,b,o=1] of graph.bonds){degree.set(a,degree.get(a)!+o);degree.set(b,degree.get(b)!+o);}
  if(graph.atoms.some(a=>degree.get(a.id)!>({C:4,N:3,O:2,F:1,Cl:1,Br:1,I:1} as Record<string,number>)[a.element??"C"]))return null;
  return {graph,parent,amine,substituents,language};
}

/** Graph equivalence is evidence of identity, not proof of nomenclature. */
export function matchAcyclicArylAmine(name:string, actual:GeneratedMolecule): {parsed:ParsedArylAmine; atomMapping:Map<number,number>} | null {
  const parsed=parseAcyclicArylAmine(name); if(!parsed)return null;
  const atomMapping=mapStructuralRegions(parsed.graph,actual,[]);return atomMapping?{parsed,atomMapping}:null;
}

/** Maps every pedagogical region as a whole. Ambiguous mappings of an
 * individual region are rejected even when the complete graphs are isomorphic. */
export function mapAcyclicArylAmineEvidence(name: string, actual: GeneratedMolecule): ParsedArylAmine | null {
  const parsed = parseAcyclicArylAmine(name);
  if (!parsed) return null;
  const grouped = groupAmineOccurrences(parsed);
  if (!grouped) return null;
  const flatten = (node: AmineNameNode): AmineNameNode[] => [node, ...node.children.flatMap(flatten)];
  const nodes = [parsed.parent, parsed.amine, ...grouped.flatMap(flatten)];
  const regions = nodes.map(node => node.atomIds);
  // A locant or attachment is meaningful only if its image is unambiguous,
  // including the parent-side endpoint omitted from the fragment's atom set.
  for (const node of nodes) if (node.attachmentBond) regions.push([...node.attachmentBond]);
  const mapping = mapStructuralRegions(parsed.graph, actual, regions);
  if (!mapping) return null;
  const remap = (node: AmineNameNode): AmineNameNode => ({
    ...node,
    atomIds: node.atomIds.map(id => mapping.get(id)!),
    bondIds: node.bondIds.map(([a,b]) => [mapping.get(a)!, mapping.get(b)!]),
    ...(node.attachmentBond ? { attachmentBond: [mapping.get(node.attachmentBond[0])!, mapping.get(node.attachmentBond[1])!] as [number,number] } : {}),
    children: node.children.map(remap),
  });
  return { ...parsed, graph: actual, parent: remap(parsed.parent), amine: remap(parsed.amine),
    substituents: grouped.map(remap) };
}

/** Collapse only siblings written with one multiplier and exchanged by
 * automorphisms of the complete graph. */
export function groupAmineOccurrences(parsed: ParsedArylAmine): AmineNameNode[] | null {
  let symmetry: ReturnType<typeof analyzeStructuralEquivalence> | undefined;
  function group(siblings: AmineNameNode[]): AmineNameNode[] | null {
    const result: AmineNameNode[] = [];
    const groups = new Map<string, AmineNameNode[]>();
    for (const node of siblings) {
      const key = node.kind + ":" + node.span.join(":");
      groups.set(key, [...(groups.get(key) ?? []), node]);
    }
    for (const peers of groups.values()) {
      const [first] = peers;
      const children = group(first.children);
      if (!children) return null;
      if (peers.length === 1) { result.push({...first, children}); continue; }
      symmetry ??= analyzeStructuralEquivalence(parsed.graph, parsed.graph);
      if (!symmetry || first.children.length || !regionsFormOrbit(peers.map(p => p.atomIds), symmetry.mappings)) return null;
      result.push({...first, attachmentBond:undefined, children, multiplicity:peers.length,
        atomIds:peers.flatMap(p => p.atomIds), bondIds:peers.flatMap(p => p.bondIds)});
    }
    return result;
  }
  return group(parsed.substituents);
}
