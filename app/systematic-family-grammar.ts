import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { legacyPrefixTerm } from "./iupac1979-name-structure.ts";
import { analyzeStructuralEquivalence } from "./structural-derivation.ts";
import { parsePurineFamily } from "./purine-derivation.ts";
import { proveMonocycleNumbering, isLowestFreeRingNumbering, blueBookRule } from "./compositional-name-model.ts";
import type { NameComponent, CompositionalFamilyGraph, NameRuleEvidence } from "./compositional-name-model.ts";

type FamilyGraph = CompositionalFamilyGraph;
const roots = ["", "meth", "eth", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec"];
type Prefix = { text: string; term: NonNullable<ReturnType<typeof legacyPrefixTerm>>; positions: number[]; start: number;
  locantSpans:{start:number;end:number;locant:number}[] };

/** Bounded prefix grammar with paired delimiters and literal source spans.
 * No common names, translation or approximate token searches. */
function prefixes(text: string, offset: number, maximum: number, repeated = false, language: "en" | "es" = "en", alkenyl = false): Prefix[] | null {
  const result: Prefix[] = []; let consumed = 0;
  while (consumed < text.length) {
    const termPattern = language === "en" ? "[a-z]+" : "[a-záéíóúñ]+";
    const m = new RegExp(`^([1-9](?:,[1-9])*)-(?:\\(([^()]+)\\)|(${termPattern}))`).exec(text.slice(consumed));
    if (!m) return null;
    const written = m[2] ?? m[3], positions = m[1].split(",").map(Number);
    const multiplied = /^(di|tri)(.+)$/.exec(written);
    const termName = multiplied ? multiplied[2] : written;
    const term = alkenyl && ["1-metilvinil", "1-methylethenyl"].includes(termName)
      ? {es:"1-metilvinil",en:"1-methylethenyl",elements:["C","C","C"],bonds:[[0,1,2],[0,2,1]] as [number,number,number][]}
      : legacyPrefixTerm(termName);
    if (!term || term[language] !== termName || term.charges
      || term.bonds.some(([, , order]) => order !== 1 && !(alkenyl && order === 2))
      || term.kind && !["alcohol", "amine", "ether"].includes(term.kind)
      || positions.some(p => p < 1 || p > maximum)
      || positions.length !== (multiplied ? multiplied[1] === "di" ? 2 : 3 : 1)
      || positions.some((p,i) => i > 0 && (repeated ? p < positions[i-1] : p <= positions[i-1]))) return null;
    let locantOffset=offset+consumed;
    const locantSpans=m[1].split(",").map(token=>{
      const span={start:locantOffset,end:locantOffset+token.length,locant:Number(token)};
      locantOffset+=token.length+1;return span;
    });
    result.push({ text: written, term, positions, locantSpans, start: offset + consumed + m[1].length + (m[2] ? 2 : 1) });
    consumed += m[0].length;
    if (consumed < text.length) { if (text[consumed] !== "-") return null; consumed++; if (consumed === text.length) return null; }
  }
  if (!repeated && new Set(result.flatMap(p => p.positions)).size !== result.flatMap(p => p.positions).length) return null;
  if(new Set(result.map(p=>p.term[language])).size!==result.length)return null;
  // Multiplicative prefixes do not affect alphabetical order.
  const alphabetical = (value: string) => value.replace(/^[\d,]+-/, "").replace(/[()-]/g, "");
  if (result.some((p,i) => i > 0 && alphabetical(result[i-1].term[language]).localeCompare(alphabetical(p.term[language]),language) > 0)) return null;
  return result;
}

export function parseAdditionalSystematicFamily(name: string): FamilyGraph | null {
  const purine=parsePurineFamily(name);if(purine)return purine;
  // Finite grammar for disubstituted benzene without a characteristic suffix.
  // Names are parsed in their written language; each term is independently
  // translated to a structure from the shared chemical fragment table.
  const benzene = /^(.*?)(benzene|benceno)$/.exec(name);
  if (benzene) {
    const language = benzene[2] === "benzene" ? "en" : "es";
    const entries: { locant: number; written: string; term: NonNullable<ReturnType<typeof legacyPrefixTerm>>; start: number }[] = [];
    const token = language === "en" ? /([1-6])-([a-z]+)/g : /([1-6])-([a-záéíóúñ]+)/g;
    let cursor = 0, match: RegExpExecArray | null;
    while ((match = token.exec(benzene[1]))) {
      if (match.index !== cursor) return null;
      const locant = Number(match[1]), written = match[2];
      const term = legacyPrefixTerm(written);
      if (locant < 1 || locant > 6 || !term || (language === "en" ? term.en !== written : term.es !== written)
        || term.elements.some(element => !["C", "O", "N", "F", "Cl", "Br", "I"].includes(element))
        || term.kind && !["ether", "nitro", "halogen"].includes(term.kind)
        || term.kind !== "nitro" && (term.charges || term.bonds.some(([, , order]) => order !== 1))) return null;
      const start = match.index;
      entries.push({ locant, written, term, start });
      cursor = token.lastIndex;
      if (cursor < benzene[1].length) {
        if (benzene[1][cursor] !== "-") return null;
        cursor += 1;if(cursor===benzene[1].length)return null;token.lastIndex = cursor;
      }
    }
    if (cursor !== benzene[1].length || entries.length !== 2 || new Set(entries.map(entry => entry.locant)).size !== 2) return null;
    const terms = entries.map(entry => entry.term.en);
    if (terms.filter(term => term === "methyl").length !== 1
      || terms.some(term => !["methyl", "methoxy", "nitro", "fluoro", "chloro", "bromo", "iodo"].includes(term))) return null;
    const second = terms.find(term => term !== "methyl");
    if (!second || !["methoxy", "nitro", "fluoro", "chloro", "bromo", "iodo"].includes(second)) return null;
    if (entries.some((entry, i) => i > 0 && entries[i - 1].written.localeCompare(entry.written, language) > 0)) return null;
    if(!isLowestFreeRingNumbering(6,entries.map(entry=>entry.locant)))return null;
    const graph: GeneratedMolecule = { atoms: [], bonds: [] };
    const atom = (element: "C" | "O" | "N" | "F" | "Cl" | "Br" | "I", charge?: number) => {
      const id = graph.atoms.length + 1; graph.atoms.push({ id, element, x: 0, y: 0, ...(charge ? { charge } : {}) }); return id;
    };
    const ring = Array.from({ length: 6 }, () => atom("C"));
    ring.forEach((id, i) => graph.bonds.push([id, ring[(i + 1) % 6], i % 2 ? 1 : 2]));
    const components: NameComponent[] = [];
    const parentStart = benzene[1].length;
    components.push({ id: "parent", role: "parent", text: benzene[2], start: parentStart, end: name.length,
      atomIds: ring, bondIds: graph.bonds.map(([a, b]) => [a, b]),
      numbering: ring.map((id, i) => [id, i + 1]),
      explanation: "Benzene is the parent ring. Ring positions C1–C6 number the six aromatic carbons; the lowest locant set fixes the direction, and the alphabetically first substituent receives the lower locant when directions tie.",
      explanationEs: "El benceno es el anillo padre. C1–C6 numeran sus seis carbonos; el conjunto más bajo de localizadores fija el sentido y, si hay empate, el sustituyente primero en orden alfabético recibe el localizador menor." });
    for (const [index, entry] of entries.entries()) {
      const ids = entry.term.elements.map((element, i) => atom(element as "C" | "O" | "N" | "F" | "Cl" | "Br" | "I", entry.term.charges?.[i]));
      entry.term.bonds.forEach(([a, b, order]) => graph.bonds.push([ids[a], ids[b], order as 1 | 2 | 3]));
      const attachment = [ring[entry.locant - 1], ids[0]] as [number, number]; graph.bonds.push(attachment);
      const text = name.slice(entry.start, entry.start + `${entry.locant}-${entry.written}`.length);
      components.push({ id: `prefix-${index}`, role: "prefix", text, start: entry.start, end: entry.start + text.length,
        parentId: "parent", locant: entry.locant, atomIds: ids,
        bondIds: [...graph.bonds.filter(([a, b]) => ids.includes(a) && ids.includes(b)).map(([a, b]) => [a, b] as [number, number]), attachment],
        numbering: [[ring[entry.locant - 1], entry.locant]],
        explanation: `${entry.written} identifies the ${entry.term.kind ?? "alkyl"} substituent attached at benzene ring position ${entry.locant}.`,
        explanationEs: `${entry.written} identifica el sustituyente unido al C${entry.locant} del anillo de benceno.` });
    }
    for(const component of components){component.language=language;component.numberingScope="parent";}
    return { graph, components, parent: ring, group: "none", allowEquivalentNumbering: true };
  }
  const graph: GeneratedMolecule = { atoms: [], bonds: [] }, components: NameComponent[] = [];
  const atom = (element: "C" | "O" | "N" = "C") => { const id = graph.atoms.length + 1; graph.atoms.push({id,element,x:0,y:0}); return id; };
  const edge = (a: number, b: number, order: 1 | 2 | 3 = 1) => { graph.bonds.push([a,b,order]); };
  const chain = (n: number) => { const ids = Array.from({length:n},()=>atom()); ids.slice(1).forEach((id,i)=>edge(ids[i],id)); return ids; };
  const ring = () => { const ids = Array.from({length:6},()=>atom()); ids.forEach((id,i)=>edge(id,ids[(i+1)%6],i%2?1:2)); return ids; };
  const add = (id: string, role: NameComponent["role"], text: string, start: number, ids: number[], explanation: string,
    options: Partial<NameComponent> = {}) => {
    components.push({id,role,text,start,end:start+text.length,atomIds:ids,
      bondIds:graph.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>[a,b]),
      numbering:[],explanation,...options});
  };
  const attach = (ps: Prefix[], skeleton: number[], parentId = "parent", language: "en" | "es" = "en") => {
    for (const [i,p] of ps.entries()) {
      const region: number[] = [], attachments: [number,number][] = [];
      const rootDegree = p.term.bonds.filter(([a,b]) => a === 0 || b === 0).length;
      const unsaturated=p.term.bonds.some(([, ,order])=>order===2);
      const spanishSkeleton = rootDegree > 1 && p.term.elements.length > 2
        ? `esqueleto ramificado de ${p.term.elements.length} carbonos`
        : `fragmento de ${p.term.elements.length} átomo${p.term.elements.length === 1 ? "" : "s"}`;
      for(const position of p.positions) {
        const ids = p.term.elements.map(e=>atom(e as "C"|"O"|"N"));
        p.term.bonds.forEach(([a,b,order])=>edge(ids[a],ids[b],order as 1|2|3)); edge(skeleton[position-1],ids[0]);
        region.push(...ids); attachments.push([skeleton[position-1],ids[0]]);
      }
      // Fragment tables are rooted at their attachment atom. A numbered branch
      // retains its own longest rooted path; tied terminal atoms are chemically
      // equivalent and never become parent-ring locants.
      let internalNumbering: [number,number][] | undefined;
      if(p.positions.length===1 && /^\d/.test(p.text) && p.term.bonds.length===p.term.elements.length-1) {
        const paths=(id:number,from:number):number[][]=>{
          const next=p.term.bonds.flatMap(([a,b])=>a===id&&b!==from?[b]:b===id&&a!==from?[a]:[]);
          return next.length?next.flatMap(child=>paths(child,id).map(path=>[id,...path])):[[id]];
        };
        const backbone=paths(0,-1).sort((a,b)=>b.length-a.length)[0];
        internalNumbering=backbone.map((index,i)=>[region[index],i+1]);
      }
      add(`prefix-${i}`,"prefix",p.text,p.start,region,
        language === "en" ? `${p.text} specifies the connected ${p.term.kind ?? (unsaturated?"alkenyl":"alkyl")} substituent at ${p.positions.join(",")}; these locants belong to ${parentId}.${internalNumbering?" Internal branch numbering starts at its attachment atom, in a separate scope.":""}`
          : `El sustituyente «${p.text}» forma un ${spanishSkeleton} y se une al anillo en el localizador ${p.positions.join(",")}; ese localizador pertenece al padre.`,
        {parentId,locant:p.positions.length===1?p.positions[0]:undefined,
          numbering:[...new Map(p.positions.map(p=>[skeleton[p-1],p]))],
          ...(internalNumbering?{internalNumbering}:{}),
          ...(language === "es" ? { explanationEs: `El sustituyente «${p.text}» forma un ${spanishSkeleton} y se une al anillo en el localizador ${p.positions.join(",")}; ese localizador pertenece al padre. La numeración interna de la rama empieza en su átomo de unión y tiene un ámbito independiente.` } : {}),
          bondIds:[...graph.bonds.filter(([a,b])=>region.includes(a)&&region.includes(b)).map(([a,b]):[number,number]=>[a,b]),...attachments]});
      if(unsaturated && p.positions.length===1) {
        const written=/(vinil|ethenyl|enil|enyl|en-[1-9]-(?:yl|il))$/.exec(p.text);
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
    const ps = prefixes(prefixText,prefixStart,6,false,language); if(!ps || ps.some(p=>p.positions.includes(1)))return null;
    if(suffix==="phenol" && ps.some(p=>p.term.kind==="alcohol"))return null; // Polyols need a multi-suffix parent grammar.
    // Alcohol outranks amine; polyamines need their own multi-suffix grammar.
    if(suffix==="aniline" && ps.some(p=>p.term.kind && p.term.kind!=="ether"))return null;
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
    attach(ps,ids,"parent",language);
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
      rules:[rule,blueBookRule("P-59.2.5","P5")],parentSelection:"retained-functional-parent",
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
      rules:[blueBookRule("P-59.2.1.4","P5"),blueBookRule("P-59.2.3","P5"),blueBookRule("P-59.2.5","P5"),
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
