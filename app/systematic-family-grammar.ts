import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedNameDerivation } from "./validated-name-derivation.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { analyzeStructuralEquivalence } from "./structural-derivation.ts";

type FamilyGraph = { graph: GeneratedMolecule; components: NameComponent[]; parent: number[];
  group: ValidatedNameDerivation["principalGroup"]; equivalentParentPaths?: number[][] };
const roots = ["", "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec"];
type Prefix = { text: string; term: NonNullable<ReturnType<typeof legacyPrefixTerm>>; positions: number[]; start: number };

/** Bounded prefix grammar with paired delimiters and literal source spans.
 * No common names, translation or approximate token searches. */
function prefixes(text: string, offset: number, maximum: number, repeated = false): Prefix[] | null {
  const result: Prefix[] = []; let consumed = 0;
  while (consumed < text.length) {
    const m = /^([1-9](?:,[1-9])*)-(?:\(([^()]+)\)|([a-z]+))/.exec(text.slice(consumed));
    if (!m) return null;
    const written = m[2] ?? m[3], positions = m[1].split(",").map(Number);
    const multiplied = /^(di|tri)(.+)$/.exec(written);
    const termName = multiplied ? multiplied[2] : written;
    const term = legacyPrefixTerm(termName);
    if (!term || term.en !== termName || term.charges
      || term.bonds.some(([, , order]) => order !== 1)
      || term.kind && !["alcohol", "amine", "ether"].includes(term.kind)
      || positions.some(p => p < 1 || p > maximum)
      || positions.length !== (multiplied ? multiplied[1] === "di" ? 2 : 3 : 1)
      || positions.some((p,i) => i > 0 && (repeated ? p < positions[i-1] : p <= positions[i-1]))) return null;
    result.push({ text: written, term, positions, start: offset + consumed + m[1].length + (m[2] ? 2 : 1) });
    consumed += m[0].length;
    if (consumed < text.length) { if (text[consumed] !== "-") return null; consumed++; if (consumed === text.length) return null; }
  }
  if (!repeated && new Set(result.flatMap(p => p.positions)).size !== result.flatMap(p => p.positions).length) return null;
  // Multiplicative prefixes do not affect alphabetical order.
  const alphabetical = (value: string) => value.replace(/^[\d,]+-/, "").replace(/[()-]/g, "");
  if (result.some((p,i) => i > 0 && alphabetical(result[i-1].term.en).localeCompare(alphabetical(p.term.en),"en") > 0)) return null;
  return result;
}

export function parseAdditionalSystematicFamily(name: string): FamilyGraph | null {
  const graph: GeneratedMolecule = { atoms: [], bonds: [] }, components: NameComponent[] = [];
  const atom = (element: "C" | "O" | "N" = "C") => { const id = graph.atoms.length + 1; graph.atoms.push({id,element,x:0,y:0}); return id; };
  const edge = (a: number, b: number, order: 1 | 2 = 1) => { graph.bonds.push([a,b,order]); };
  const chain = (n: number) => { const ids = Array.from({length:n},()=>atom()); ids.slice(1).forEach((id,i)=>edge(ids[i],id)); return ids; };
  const ring = () => { const ids = Array.from({length:6},()=>atom()); ids.forEach((id,i)=>edge(id,ids[(i+1)%6],i%2?1:2)); return ids; };
  const add = (id: string, role: NameComponent["role"], text: string, start: number, ids: number[], explanation: string,
    options: Partial<NameComponent> = {}) => {
    components.push({id,role,text,start,end:start+text.length,atomIds:ids,
      bondIds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b]),
      numbering:[],explanation,...options});
  };
  const attach = (ps: Prefix[], skeleton: number[], parentId = "parent") => {
    for (const [i,p] of ps.entries()) {
      const region: number[] = [], attachments: [number,number][] = [];
      for(const position of p.positions) {
        const ids = p.term.elements.map(e=>atom(e as "C"|"O"|"N"));
        p.term.bonds.forEach(([a,b])=>edge(ids[a],ids[b])); edge(skeleton[position-1],ids[0]);
        region.push(...ids); attachments.push([skeleton[position-1],ids[0]]);
      }
      add(`prefix-${i}`,"prefix",p.text,p.start,region,
        `${p.text} specifies the connected ${p.term.kind ?? "alkyl"} substituent at ${p.positions.join(",")}; these locants belong to ${parentId}.`,
        {parentId,locant:p.positions.length===1?p.positions[0]:undefined,
          numbering:[...new Map(p.positions.map(p=>[skeleton[p-1],p]))],
          bondIds:[...graph.bonds.filter(([a,b])=>region.includes(a)&&region.includes(b)).map(([a,b]):[number,number]=>[a,b]),...attachments]});
    }
  };
  let parent: number[], group: FamilyGraph["group"];
  let equivalentParentPaths: number[][] | undefined;
  const aromatic = /^(.*?)(benzoic acid|benzaldehyde|phenol)$/.exec(name);
  const ester = /^([a-z]+yl) (.*)benzoate$/.exec(name);
  const nAmide = /^N-phenyl(acetamide|[a-z]+anamide)$/.exec(name);
  const acyclic = /^(.+?)(meth|eth|prop|but|pent|hex|hept|oct|non|dec)an(oic acid|amide|al)$/.exec(name);
  const simpleChain = /^(meth|eth|prop|but|pent|hex|hept|oct|non|dec)an(oic acid|amide|al)$/.exec(name);
  const arylKetone = /^1-phenyl(ethanone|(?:prop|but|pent|hex|hept|oct|non|dec)an-1-one)$/.exec(name);
  const diarylKetone = /^(di)(phenyl)(methanone)$/.exec(name);
  if(aromatic || ester) {
    const suffix = aromatic?.[2] ?? "benzoate", start = name.length - suffix.length;
    const prefixText = aromatic?.[1] ?? ester![2], prefixStart = aromatic ? 0 : ester![1].length + 1;
    const ps = prefixes(prefixText,prefixStart,6); if(!ps || ps.some(p=>p.positions.includes(1)))return null;
    if(suffix==="phenol" && ps.some(p=>p.term.kind==="alcohol"))return null; // Polyols need a multi-suffix parent grammar.
    const positions = ps.flatMap(p=>p.positions).sort((a,b)=>a-b), reversed = positions.map(p=>8-p).sort((a,b)=>a-b);
    const comparison=positions.findIndex((p,i)=>p!==reversed[i]);
    if(comparison>=0 && positions[comparison]>reversed[comparison])return null;
    if(comparison<0) {
      const byPrefix=ps.flatMap(p=>p.positions), reflection=ps.flatMap(p=>p.positions.map(n=>8-n).sort((a,b)=>a-b));
      const tie=byPrefix.findIndex((p,i)=>p!==reflection[i]);
      if(tie>=0 && byPrefix[tie]>reflection[tie])return null;
    }
    const ids=ring(); parent=[...ids]; let functionIds: number[], linkage: number|undefined;
    if(suffix==="phenol") {const o=atom("O");edge(ids[0],o);functionIds=[ids[0],o];group="alcohol";}
    else {
      const c=atom(),o=atom("O");edge(ids[0],c);edge(c,o,2);parent.push(c);functionIds=[c,o];
      if(suffix!=="benzaldehyde") {linkage=atom("O");edge(c,linkage);functionIds.push(linkage);}
      group=ester?"ester":suffix==="benzaldehyde"?"aldehyde":"carboxylicAcid";
    }
    attach(ps,ids);
    if(ester) {
      const term=legacyPrefixTerm(ester[1]);
      if(!term || term.en!==ester[1] || term.kind || term.elements.some(e=>e!=="C") || term.bonds.some(([, ,o])=>o!==1))return null;
      const alkyl=term.elements.map(()=>atom());term.bonds.forEach(([a,b])=>edge(alkyl[a],alkyl[b]));edge(linkage!,alkyl[0]);
      add("ester-alkyl","substituent",ester[1],0,alkyl,"The alkyl group is bonded to the ester oxygen, not to the aromatic ring.",
        {parentId:"suffix",bondIds:[...graph.bonds.filter(([a,b])=>alkyl.includes(a)&&alkyl.includes(b)).map(([a,b]):[number,number]=>[a,b]),[linkage!,alkyl[0]]]});
    }
    add("parent","parent",suffix,start,parent,
      `${suffix} establishes the ${group} parent. Ring position 1 bears the characteristic group; the accepted locant sequence is ${positions.join(",") || "unsubstituted"}.`,
      {numbering:[[ids[0],1],...positions.map(p=>[ids[p-1],p] as [number,number])]});
    add("suffix","suffix",suffix,start,functionIds,`The ${group} group supplies the characteristic suffix. Secondary functions are expressed as prefixes.`);
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
  return {graph,components,parent,group,equivalentParentPaths};
}
