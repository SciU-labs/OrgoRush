import { groupAmineOccurrences, type AmineNameNode, type ParsedArylAmine } from "./acyclic-aryl-amine-grammar.ts";
import { blueBookRule, substitutiveCitationKey, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";

export function proveArylAmine(parsed: ParsedArylAmine): CompositionalFamilyGraph | null {
  const {parent, amine, language, graph} = parsed, chain = parent.atomIds;
  if (amine.locant !== 1 || chain.length < 2) return null;
  const branches = parsed.substituents.filter(n => n.kind === "n-alkyl");
  if (branches.some(n => n.atomIds.length >= chain.length)) return null;
  const groups = groupAmineOccurrences(parsed);
  if (!groups) return null;
  const keys = groups.map(n => substitutiveCitationKey(n.text));
  if (keys.some((key,i) => i > 0 && keys[i-1].localeCompare(key, language) >= 0)) return null;
  // A carbon branch must not extend or tie the longest suffix-bearing chain.
  if (groups.some(n => n.kind === "alkyl" && typeof n.locant === "number"
    && (n.locant === 1 || n.atomIds.length >= chain.length - n.locant))) return null;
  const numbered = groups.filter(n => typeof n.locant === "number");
  if (groups.some(n => n.children.some(c => typeof c.locant === "number" && c.locant > 4))) return null;
  const component = (node: AmineNameNode, id: string, role: NameComponent["role"],
    explanation: string, explanationEs: string, options: Partial<NameComponent> = {}): NameComponent => ({
    id, role, text:node.text, start:node.span[0], end:node.span[1], atomIds:node.atomIds, bondIds:node.bondIds,
    numbering:[], language, explanation, explanationEs, ...options,
  });
  const nitrogen = amine.atomIds[0], suffixStart = amine.span[0]-2;
  const written = (start:number, atomId:number, locant:number) => ({start, end:start+String(locant).length, atomId, locant});
  const components = [
    component(parent,"parent","parent",
      `The chain of ${chain.length} carbons carries the amine. ${branches.length ? "It is longer than each other chain directly attached to nitrogen." : "It is the only chain directly attached to nitrogen."} The aromatic rings are cited as substituents.`,
      `La cadena de ${chain.length} carbonos lleva la amina. ${branches.length ? "Es más larga que cada una de las demás cadenas directamente unidas al nitrógeno." : "Es la única cadena directamente unida al nitrógeno."} Los anillos aromáticos se citan como sustituyentes.`,
      {numbering:chain.map((id,i)=>[id,i+1]), writtenLocants:[written(suffixStart,chain[0],1),
        ...numbered.map(n=>written(n.span[0],chain[Number(n.locant)-1],Number(n.locant)))]}),
    component(amine,"suffix","suffix",
      `Nitrogen carries ${["one carbon group","two carbon groups","three carbon groups"][branches.length]}, giving a ${["primary","secondary","tertiary"][branches.length]} amine at C1.`,
      `El nitrógeno está unido a ${["un grupo carbonado","dos grupos carbonados","tres grupos carbonados"][branches.length]}. La amina es ${["primaria","secundaria","terciaria"][branches.length]} y se sitúa en C1.`,
      {numbering:[[chain[0],1]]}),
  ];
  function project(node: AmineNameNode, parentId: string) {
    const id = parentId === "parent" ? node.kind : parentId+"-"+node.kind;
    const position = node.locant, parentLevel = parentId === "parent";
    const anchor = node.attachmentBond?.[0];
    const descriptions: Partial<Record<AmineNameNode["kind"],[string,string]>> = {
      "n-alkyl":[`The N locant places ${node.multiplicity ? "both alkyl groups" : "the alkyl group"} on the amine nitrogen.`,`El localizador N sitúa ${node.multiplicity ? "ambos grupos alquilo" : "el grupo alquilo"} en el nitrógeno de la amina.`],
      phenyl:node.multiplicity ? ["Two equivalent phenyl rings attach to the same methine carbon. Di- counts both rings.","Dos fenilos equivalentes se unen al mismo carbono metínico. Di- cuenta ambos anillos."]
        : [`The phenyl ring bonds directly to parent C${position}.`,`El anillo fenilo se une directamente a C${position} del padre.`],
      phenoxy:[`Oxygen joins the aromatic ring to C${position}. The oxygen-bearing ring carbon is internal C1.`,`El oxígeno une el anillo aromático a C${position}. El carbono del anillo unido al oxígeno es el C1 interno.`],
      diphenylmethoxy:[`An oxygen at C${position} links the parent to CH bearing two phenyl rings. Parentheses enclose this entire substituent.`,
        `Un oxígeno en C${position} une el padre a un CH que lleva dos fenilos. Los paréntesis delimitan el sustituyente completo.`],
      "aryl-core":["This selection follows the aromatic core up to its bond to the parent.","La selección abarca el núcleo aromático hasta su enlace con el padre."],
      halogens:["Tri- counts three fluorines bonded to the same methyl carbon.","Tri- cuenta tres átomos de flúor unidos al mismo carbono del metilo."],
      "ring-substituent":[`${node.text} is attached at internal ring C${position}, counted from its point of attachment in the direction of the lowest locant.`,
        `«${node.text}» se une al C${position} interno del anillo, numerado desde la unión en el sentido que da el menor localizador.`],
    };
    const [en,es]=descriptions[node.kind] ?? [`${node.text} attaches at parent C${position}.`,`«${node.text}» se une al C${position} del padre.`];
    const members=new Set(node.atomIds);
    const options: Partial<NameComponent> = {parentId, locant:position, numberingScope:parentId,
      attachmentBonds:node.bondIds.filter(([a,b])=>members.has(a)!==members.has(b))};
    if (position === "N") options.numbering=[[nitrogen,"N"]];
    if (typeof position === "number" && anchor !== undefined) options.numbering=[[anchor,position]];
    if (node.kind === "n-alkyl" && node.multiplicity) options.externalMultiplier="di";
    if (node.children.some(c=>c.kind==="ring-substituent")) {
      const child=node.children.find(c=>c.kind==="ring-substituent")!;
      const relative=String(node.locant).length+2;
      options.writtenLocants=[written(node.span[0]+relative,child.attachmentBond![0],Number(child.locant))];
    }
    const identity = components.some(c => c.id === id) ? id+"-"+node.span[0] : id;
    components.push(component(node,identity,parentLevel?"substituent":"prefix",en,es,options));
    node.children.forEach(child => project(child,identity));
  }
  groups.forEach(node => project(node,"parent"));
  const positions = numbered.map(n => Number(n.locant)).sort((a,b)=>a-b);
  return {graph, components, parent:chain, group:"amine", evidence:{
    source:"active-name",language,construction:"acyclic-aryl-amine",parentSelection:"amine-longest-n-attached-chain",
    rules:[blueBookRule(branches.length?"P-62.2.2":"P-62.2.1","P6"),blueBookRule("P-44.3.2","P4"),blueBookRule("P-14.5","P1")],
    numbering:{scope:"parent",priorities:["amine-suffix","substituent-locants"],selected:[[1],positions],
      reflected:[[chain.length],positions.map(n=>chain.length+1-n).sort((a,b)=>a-b)],comparison:-1},stereo:"unspecified-only"}};
}
