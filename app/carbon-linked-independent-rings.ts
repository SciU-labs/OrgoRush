import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { blueBookRule, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";

type Language = "en" | "es";
type GraphBuilder = {
  graph: GeneratedMolecule;
  atom(element?: "C" | "O"): number;
  bond(a: number, b: number, order?: 1 | 2): void;
  benzene(): number[];
  cyclohexane(): number[];
};

function builder(): GraphBuilder {
  const graph: GeneratedMolecule = { atoms: [], bonds: [] };
  const atom = (element: "C" | "O" = "C") => {
    const id = graph.atoms.length + 1;
    graph.atoms.push({ id, element, x: 0, y: 0 });
    return id;
  };
  const bond = (a: number, b: number, order: 1 | 2 = 1) => { graph.bonds.push([a, b, order]); };
  const benzene = () => {
    const ids = Array.from({ length: 6 }, () => atom());
    ids.forEach((id, index) => bond(id, ids[(index + 1) % 6]!, index % 2 === 0 ? 2 : 1));
    return ids;
  };
  const cyclohexane = () => {
    const ids = Array.from({ length: 6 }, () => atom());
    ids.forEach((id, index) => bond(id, ids[(index + 1) % 6]!));
    return ids;
  };
  return { graph, atom, bond, benzene, cyclohexane };
}

function component(input: {
  id: string; role: NameComponent["role"]; name: string; start: number; end: number;
  atoms: number[]; bonds: [number, number][]; language: Language; explanation: string; explanationEs: string;
  parentId?: string; numbering?: [number, number | string][]; internalNumbering?: [number, number][];
  locant?: number | "N"; label?: string; labelEs?: string; mappingGroup?: string; writtenLocants?: NameComponent["writtenLocants"];
}): NameComponent {
  return { id: input.id, role: input.role, text: input.name.slice(input.start, input.end), start: input.start, end: input.end,
    atomIds: input.atoms, bondIds: input.bonds, numbering: input.numbering ?? [], language: input.language,
    explanation: input.explanation, explanationEs: input.explanationEs, parentId: input.parentId,
    ...(input.internalNumbering ? { internalNumbering: input.internalNumbering } : {}),
    ...(input.locant !== undefined ? { locant: input.locant } : {}),
    ...(input.label ? { label: input.label } : {}), ...(input.labelEs ? { labelEs: input.labelEs } : {}),
    ...(input.mappingGroup ? { mappingGroup: input.mappingGroup } : {}),
    ...(input.writtenLocants ? { writtenLocants: input.writtenLocants } : {}) };
}

function internalRingNumbering(ids: number[]): [number, number][] {
  return ids.map((id, index) => [id, index + 1]);
}

function ringBonds(graph: GeneratedMolecule, ids: number[]): [number, number][] {
  const set = new Set(ids);
  return graph.bonds.filter(([a, b]) => set.has(a) && set.has(b)).map(([a, b]) => [a, b]);
}

function centralDiaryl(name: string, language: Language): CompositionalFamilyGraph | null {
  const match = language === "en"
    ? /^(di|tri)phenyl(methane|methanol)$/.exec(name)
    : /^(di|tri)fenil(metano|metanol)$/.exec(name);
  if (!match) return null;
  const count = match[1] === "di" ? 2 : 3;
  const alcohol = /ol$/.test(match[2]!);
  if (count === 3 && !alcohol) return null;
  const b = builder(), center = b.atom(), rings = Array.from({ length: count }, () => b.benzene());
  rings.forEach(ring => b.bond(center, ring[0]!));
  const oxygen = alcohol ? b.atom("O") : undefined;
  if (oxygen) b.bond(center, oxygen);
  const components: NameComponent[] = [];
  const root = match[2]!, rootStart = name.length - root.length;
  components.push(component({ id: "parent", role: "parent", name, start: rootStart, end: name.length,
    atoms: [center], bonds: [], language, numbering: [[center, 1]],
    explanation: alcohol
      ? `The one-carbon methanol parent carries the hydroxyl suffix at C1. P-44.1.2.2 permits the ring–chain treatment that cites the equivalent phenyl rings alike as substituents; the parent is selected by that naming method, not by counting rings.`
      : `The methane parent is the one-carbon chain; its two equivalent phenyl groups are cited as substituents. This general name treats those rings alike (Blue Book P-44.1.2.2, method 2).`,
    explanationEs: alcohol
      ? `El metanol, de un carbono, lleva el sufijo hidroxilo en C1. P-44.1.2.2 permite tratar así el sistema anillo-cadena y citar por igual los anillos fenilo equivalentes como sustituyentes; la selección del padre no se basa en contar anillos.`
      : `El metano es la cadena principal de un carbono; sus dos grupos fenilo equivalentes se citan como sustituyentes. Este nombre general trata ambos anillos por igual (Blue Book P-44.1.2.2, método 2).` }));
  if (oxygen) components.push(component({ id: "suffix", role: "suffix", name, start: name.length - 2, end: name.length,
    atoms: [center, oxygen], bonds: [[center, oxygen]], language,
    explanation: `The hydroxyl on the central carbon gives the methanol parent its alcohol suffix.`,
    explanationEs: `El grupo hidroxilo unido al carbono central aporta el sufijo de alcohol al padre metanol.`, parentId: "parent" }));
  const prefixText = name.slice(0, rootStart), prefixStart = 0, phenylWord = language === "en" ? "phenyl" : "fenil";
  const wordStart = prefixStart + (language === "en" ? 2 : 2);
  const allArylAtoms = rings.flat();
  const allArylBonds = rings.flatMap(ring => ringBonds(b.graph, ring)).concat(rings.map(ring => [center, ring[0]!]));
  const groupedLabel = count === 2 ? (language === "en" ? "Two equivalent phenyl substituents (diphenyl)" : "Dos sustituyentes fenilo equivalentes (difenil)")
    : (language === "en" ? "Three equivalent phenyl substituents (triphenyl)" : "Tres sustituyentes fenilo equivalentes (trifenil)");
  components.push(component({ id: "phenyl-groups", role: "prefix", name, start: 0, end: rootStart,
    atoms: allArylAtoms, bonds: allArylBonds, language, parentId: "parent", label: groupedLabel, labelEs: groupedLabel,
    explanation: `The multiplicative prefix ${prefixText} identifies ${count} phenyl rings attached to the same C1; their equivalence follows from the identical connectivity and attachment atom.`,
    explanationEs: `El prefijo multiplicativo «${prefixText}» identifica ${count} anillos fenilo unidos al mismo C1; son equivalentes por su conectividad y punto de unión idénticos.` }));
  rings.forEach((ring, index) => components.push(component({ id: `phenyl-${index + 1}`, role: "prefix", name,
    start: wordStart, end: wordStart + phenylWord.length, atoms: ring, bonds: [...ringBonds(b.graph, ring), [center, ring[0]!]],
    language, parentId: "phenyl-groups", numbering: [[ring[0]!, 1]], mappingGroup: "equivalent-phenyl-occurrences",
    label: `${phenylWord === "phenyl" ? "Phenyl" : "Phenyl"} occurrence ${index + 1}`,
    labelEs: `Grupo fenilo ${index + 1}`,
    explanation: `This individual phenyl ring is attached to central C1 through a C–C bond.`,
    explanationEs: `Este anillo fenilo individual se une al C1 central mediante un enlace C–C.` })));
  return { graph: b.graph, components, parent: [center], group: alcohol ? "alcohol" : "none", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "carbon-linked-aromatic",
      parentSelection: "acyclic-chain", rules: [blueBookRule("P-44.1.1.1", "P4"), blueBookRule("P-44.1.2.2", "P4"), blueBookRule("P-59.1.3", "P5"), ...(alcohol ? [blueBookRule("P-63.1", "P6")] : [])],
      numbering: { scope: "parent", priorities: [alcohol ? "suffix-bearing-carbon" : "chain-context-treating-equivalent-aryl-substituents-alike"], selected: [[1]], reflected: [[1]], comparison: 0 },
      stereo: "unspecified-only" } };
}

function stilbene(name: string, language: Language): CompositionalFamilyGraph | null {
  const en = language === "en";
  const match = en ? /^(1,2)-(di)phenyl(ethene)$/.exec(name) : /^(1,2)-(di)fenil(eten[oa])$/.exec(name);
  if (!match) return null;
  const b = builder(), chain = [b.atom(), b.atom()], rings = [b.benzene(), b.benzene()];
  b.bond(chain[0]!, chain[1]!, 2);
  rings.forEach((ring, index) => b.bond(chain[index]!, ring[0]!));
  const locantsStart = 0, wordStart = name.indexOf(en ? "diphenyl" : "difenil"), phenylWord = en ? "phenyl" : "fenil";
  const components: NameComponent[] = [
    component({ id: "parent", role: "parent", name, start: name.indexOf(match[3]!), end: name.length,
      atoms: chain, bonds: [[chain[0]!, chain[1]!]], language, numbering: [[chain[0]!, 1], [chain[1]!, 2]],
      explanation: "The two-carbon ethene chain is chosen to express its C=C bond; the two equivalent phenyl rings are cited as substituents (Blue Book P-44.1.2.2, method 2). This is a systematic name, not a PIN claim.",
      explanationEs: "Se elige la cadena eteno de dos carbonos para expresar el enlace C=C; los dos anillos fenilo equivalentes se citan como sustituyentes (Blue Book P-44.1.2.2, método 2). Esto respalda un nombre sistemático, no afirma que sea el PIN." }),
    component({ id: "unsaturation-1", role: "unsaturation", name, start: name.indexOf(match[3]!), end: name.length,
      atoms: chain, bonds: [[chain[0]!, chain[1]!]], language, parentId: "parent", numbering: [[chain[0]!, 1]], locant: 1,
      explanation: "The parent C1=C2 double bond is the unsaturation expressed by ethene.",
      explanationEs: "El doble enlace parental C1=C2 es la insaturación expresada por eteno." }),
    component({ id: "diphenyl", role: "prefix", name, start: wordStart, end: wordStart + (en ? "diphenyl" : "difenil").length,
      atoms: rings.flat(), bonds: rings.flatMap(ring => ringBonds(b.graph, ring)).concat(rings.map((ring, index) => [chain[index]!, ring[0]!])),
      language, parentId: "parent", label: en ? "Two phenyl groups (×2)" : "Dos grupos fenilo (×2)",
      labelEs: "Dos grupos fenilo (×2)", explanation: "Diphenyl denotes one phenyl ring at C1 and one at C2; both are structurally equivalent.",
      explanationEs: "Difenil indica un anillo fenilo en C1 y otro en C2; son equivalentes estructuralmente." }),
  ];
  rings.forEach((ring, index) => components.push(component({ id: `phenyl-${index + 1}`, role: "prefix", name,
    start: wordStart + 2, end: wordStart + 2 + phenylWord.length, atoms: ring,
    bonds: [...ringBonds(b.graph, ring), [chain[index]!, ring[0]!]], language, parentId: "diphenyl",
    numbering: [[chain[index]!, index + 1], [ring[0]!, 1]], mappingGroup: "equivalent-stilbene-phenyl-rings", locant: index + 1,
    label: en ? `Phenyl at C${index + 1}` : `Fenilo en C${index + 1}`,
    labelEs: `Fenilo en C${index + 1}`,
    explanation: `This phenyl ring is bonded to parent C${index + 1}; the locant is on ethene, while C1 of the ring belongs to the substituent.`,
    explanationEs: `Este anillo fenilo se une al C${index + 1} del padre; ese localizador pertenece al eteno y el C1 del anillo tiene numeración interna.` })));
  return { graph: b.graph, components, parent: chain, group: "none", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "aromatic-alkene", parentSelection: "acyclic-chain",
      rules: [blueBookRule("P-44.1.2.2", "P4"), blueBookRule("P-59.1.3", "P5"), blueBookRule("P-31.1", "P3")],
      numbering: { scope: "parent", priorities: ["parent-alkene-locants", "equivalent-phenyl-occurrences"], selected: [[1, 2]], reflected: [[1, 2]], comparison: 0 },
      stereo: "unspecified-only" } };
}

function phenylatedChain(name: string, language: Language): CompositionalFamilyGraph | null {
  const en = language === "en";
  const suffix = en ? "phenyl" : "fenil";
  const match = en
    ? /^(\d+(?:,\d+)?)-di(phenyl)(methane|ethane|propane|butane|pentane|hexane|heptane|octane|ethene|(?:prop|but|pent|hex|hept|oct)-[1-7]-ene)$/.exec(name)
    : /^(\d+(?:,\d+)?)-di(fenil)(metano|etano|propano|butano|pentano|hexano|heptano|octano|eteno|(?:prop|but|pent|hex|hept|oct)-[1-7]-eno)$/.exec(name);
  if (!match) return null;
  const positions = match[1]!.split(",").map(Number);
  if (positions.length !== 2) return null;
  const rootWritten = match[3]!;
  const alkaneRoots: Record<string, number> = en
    ? { methane: 1, ethane: 2, propane: 3, butane: 4, pentane: 5, hexane: 6, heptane: 7, octane: 8 }
    : { metano: 1, etano: 2, propano: 3, butano: 4, pentano: 5, hexano: 6, heptano: 7, octano: 8 };
  const unsaturated = en ? /^(prop|but|pent|hex|hept|oct)-([1-7])-ene$/.exec(rootWritten)
    : /^(prop|but|pent|hex|hept|oct)-([1-7])-eno$/.exec(rootWritten);
  const roots: Record<string, number> = { prop: 3, but: 4, pent: 5, hex: 6, hept: 7, oct: 8 };
  const size = unsaturated ? roots[unsaturated[1]!] : alkaneRoots[rootWritten];
  const doubleLocant = unsaturated ? Number(unsaturated[2]) : rootWritten === (en ? "ethene" : "eteno") ? 1 : undefined;
  if (!size || positions.some(position => position < 1 || position > size)
    || doubleLocant !== undefined && (doubleLocant < 1 || doubleLocant >= size)) return null;
  if (positions[0]! > positions[1]!) return null;
  const reflectedPositions = positions.map(position => size + 1 - position).sort((a,b)=>a-b);
  const reflectedDouble = doubleLocant === undefined ? undefined : size - doubleLocant;
  if (doubleLocant !== undefined && reflectedDouble !== undefined && reflectedDouble < doubleLocant
    || (doubleLocant === undefined || reflectedDouble === doubleLocant)
      && reflectedPositions.join(",") < positions.join(",")) return null;

  const b = builder(), chain = Array.from({ length: size }, () => b.atom());
  for (let index = 0; index < size - 1; index++) b.bond(chain[index]!, chain[index + 1]!, index + 1 === doubleLocant ? 2 : 1);
  const rings = positions.map(() => b.benzene());
  positions.forEach((position, index) => b.bond(chain[position - 1]!, rings[index]![0]!));
  const prefixStart = match[1]!.length + 1, prefixText = en ? "diphenyl" : "difenil";
  const groupStart = name.indexOf(prefixText), rootStart = name.length - rootWritten.length;
  const multiplicative = component({ id: "diphenyl", role: "prefix", name, start: groupStart, end: groupStart + prefixText.length,
    atoms: rings.flat(), bonds: rings.flatMap(ring => ringBonds(b.graph, ring)).concat(rings.map((ring,index)=>[chain[positions[index]!-1]!,ring[0]!])),
    language, parentId: "parent", label: en ? "Two phenyl groups (×2)" : "Dos grupos fenilo (×2)", labelEs: "Dos grupos fenilo (×2)",
    explanation: `The multiplier di- denotes two phenyl rings at parent locants ${positions.join(" and ")}; each ring is attached through its C1.`,
    explanationEs: `El multiplicador di- representa dos anillos fenilo en los localizadores ${positions.join(" y ")}; cada anillo se une por su C1.` });
  const components: NameComponent[] = [component({ id: "parent", role: "parent", name, start: rootStart, end: name.length,
    atoms: chain, bonds: chain.slice(1).map((id,index)=>[chain[index]!,id]), language,
    numbering: chain.map((id,index)=>[id,index+1]),
    writtenLocants: positions.map((position,index)=>{
      const digitStart = index === 0 ? 0 : match[1]!.indexOf(",") + 1;
      return { start: digitStart, end: digitStart + String(position).length, atomId: chain[position-1]!, locant: position };
    }),
    explanation: unsaturated
      ? `The ${size}-carbon chain is selected to express its C${doubleLocant}=C${doubleLocant!+1} double bond while treating the phenyl rings as like substituents (Blue Book P-44.1.2.2, method 2). This is a systematic name, not a PIN claim.`
      : `The ${size}-carbon chain is the named parent; the two phenyl rings are cited as like substituents under general nomenclature (Blue Book P-44.1.2.2, method 2). This is not a PIN claim.`,
    explanationEs: unsaturated
      ? `Se elige la cadena de ${size} carbonos para expresar el doble enlace C${doubleLocant}=C${doubleLocant!+1} y tratar los anillos fenilo como sustituyentes iguales (Blue Book P-44.1.2.2, método 2). Es un nombre sistemático, no una afirmación de PIN.`
      : `La cadena de ${size} carbonos es el padre nombrado; los dos anillos fenilo se citan como sustituyentes iguales según la nomenclatura general (Blue Book P-44.1.2.2, método 2). No se afirma que sea el PIN.` }), multiplicative];
  if (doubleLocant !== undefined) {
    const doubleStart = rootStart + rootWritten.indexOf(String(doubleLocant));
    components.push(component({ id: `unsaturation-${doubleLocant}`, role: "unsaturation", name, start: doubleStart, end: doubleStart + String(doubleLocant).length,
      atoms: [chain[doubleLocant-1]!,chain[doubleLocant]!], bonds: [[chain[doubleLocant-1]!,chain[doubleLocant]!]], language,
      parentId: "parent", numbering: [[chain[doubleLocant-1]!,doubleLocant]], locant: doubleLocant,
      explanation: `The parent double bond is between C${doubleLocant} and C${doubleLocant+1}.`,
      explanationEs: `El doble enlace del padre une C${doubleLocant} con C${doubleLocant+1}.` }));
  }
  const symmetric = positions[0] === positions[1] || positions[0]! + positions[1]! === size + 1;
  rings.forEach((ring,index)=>components.push(component({ id:`phenyl-${index+1}`, role:"prefix", name,
    start: groupStart + 2, end: groupStart + 2 + suffix.length, atoms:ring,
    bonds:[...ringBonds(b.graph,ring),[chain[positions[index]!-1]!,ring[0]!]], language, parentId:"diphenyl",
    numbering:[[chain[positions[index]!-1]!,positions[index]!],[ring[0]!,1]], locant:positions[index],
    ...(symmetric ? {mappingGroup:"equivalent-chain-phenyl-occurrences"} : {}),
    label: en ? `Phenyl at parent C${positions[index]}` : `Fenilo en C${positions[index]}`,
    labelEs:`Fenilo en C${positions[index]}`,
    explanation:`This phenyl ring is joined by C–C to parent C${positions[index]}; its ring locant 1 belongs to the substituent.`,
    explanationEs:`Este fenilo se une mediante C–C al C${positions[index]} del padre; el localizador 1 del anillo pertenece al sustituyente.`})));
  return { graph:b.graph, components, parent:chain, group:"none", allowEquivalentNumbering:true,
    evidence:{source:"active-name",profile:"current",language,construction:"carbon-linked-aromatic",parentSelection:"acyclic-chain",
      rules:[blueBookRule("P-44.1.2.2","P4"),blueBookRule("P-59.1.3","P5"),...(unsaturated?[blueBookRule("P-31.1","P3")]:[])],
      numbering:{scope:"parent",priorities:["parent-unsaturation","phenyl-prefix-locants","prefix-citation"],selected:[[...(doubleLocant===undefined?[]:[doubleLocant]),...positions]],reflected:[[...(reflectedDouble===undefined?[]:[reflectedDouble]),...reflectedPositions]],comparison:0},stereo:"unspecified-only"}};
}

function benzilicAcid(name: string, language: Language): CompositionalFamilyGraph | null {
  const en = language === "en";
  const expected = en ? "2-hydroxy-2,2-diphenylacetic acid" : "ácido 2-hidroxi-2,2-difenilacético";
  if (name !== expected) return null;
  const b = builder(), acidCarbon = b.atom(), alpha = b.atom(), carbonylO = b.atom("O"), acidO = b.atom("O"), hydroxyO = b.atom("O");
  b.bond(acidCarbon, alpha); b.bond(acidCarbon, carbonylO, 2); b.bond(acidCarbon, acidO); b.bond(alpha, hydroxyO);
  const rings = [b.benzene(), b.benzene()]; rings.forEach(ring => b.bond(alpha, ring[0]!));
  const startAcid = en ? name.length - "acetic acid".length : name.indexOf("acético");
  const wordStart = name.indexOf(en ? "diphenyl" : "difenil");
  const word = en ? "phenyl" : "fenil";
  const allRingBonds = rings.flatMap(ring => ringBonds(b.graph, ring)).concat(rings.map(ring => [alpha, ring[0]!]));
  const components: NameComponent[] = [
    component({ id: "parent", role: "parent", name, start: startAcid, end: name.length, atoms: [acidCarbon, alpha], bonds: [[acidCarbon, alpha]],
      language, numbering: [[acidCarbon, 1], [alpha, 2]],
      explanation: "The acetic-acid parent contains the sole carboxylic-acid group. Its carbonyl carbon is C1 and the substituted carbon is C2; the phenyl rings do not carry this suffix.",
      explanationEs: "El ácido acético es la estructura principal y contiene el único grupo carboxilo. El carbono carbonílico es C1 y el carbono sustituido es C2; los anillos fenilo no llevan este sufijo.",
      writtenLocants: [{ start: name.indexOf("2-"), end: name.indexOf("2-") + 1, atomId: alpha, locant: 2 }] }),
    component({ id: "suffix", role: "suffix", name, start: name.length - (en ? 4 : 7), end: name.length,
      atoms: [acidCarbon, carbonylO, acidO], bonds: [[acidCarbon, carbonylO], [acidCarbon, acidO]], language, parentId: "parent",
      explanation: "The C(=O)OH group is the carboxylic-acid suffix.", explanationEs: "El grupo C(=O)OH se expresa mediante el sufijo de ácido carboxílico." }),
    component({ id: "hydroxy", role: "prefix", name, start: 0, end: en ? "2-hydroxy".length : "ácido 2-hidroxi".length,
      atoms: [alpha, hydroxyO], bonds: [[alpha, hydroxyO]], language, parentId: "parent", locant: 2,
      explanation: "Hydroxy identifies the –OH group on parent C2; the acid group remains the principal suffix.",
      explanationEs: "Hidroxi identifica el –OH unido al C2 del padre; el ácido conserva el sufijo principal." }),
    component({ id: "diphenyl", role: "prefix", name, start: wordStart - 2, end: wordStart + word.length,
      atoms: rings.flat(), bonds: allRingBonds, language, parentId: "parent", locant: 2,
      label: en ? "Two phenyl groups at C2 (×2)" : "Dos grupos fenilo en C2 (×2)", labelEs: "Dos grupos fenilo en C2 (×2)",
      explanation: "The multiplier di- counts two separate phenyl rings attached to alpha C2; both have the same connectivity and locant.",
      explanationEs: "El multiplicador di- cuenta dos anillos fenilo distintos unidos al C2 alfa; ambos tienen la misma conectividad y localizador." }),
  ];
  rings.forEach((ring, index) => components.push(component({ id: `phenyl-${index + 1}`, role: "prefix", name,
    start: wordStart, end: wordStart + word.length, atoms: ring, bonds: [...ringBonds(b.graph, ring), [alpha, ring[0]!]],
    language, parentId: "diphenyl", locant: 2, numbering: [[alpha, 2], [ring[0]!, 1]], mappingGroup: "equivalent-acid-phenyl-rings",
    label: `${en ? "Phenyl" : "Fenilo"} occurrence ${index + 1}`, labelEs: `Fenilo ${index + 1}`,
    explanation: `This phenyl occurrence is individually bonded to alpha C2 by C–C; its ring C1 numbering is internal.`,
    explanationEs: `Este fenilo individual se une al C2 alfa mediante C–C; el C1 del anillo pertenece a su numeración interna.` })));
  return { graph: b.graph, components, parent: [acidCarbon, alpha], group: "carboxylicAcid", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "carbon-linked-aromatic", parentSelection: "acyclic-chain",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-44.1.1.1", "P4"), blueBookRule("P-59.1.3", "P5"), blueBookRule("P-65.1", "P6")],
      numbering: { scope: "parent", priorities: ["maximum-acid-suffix-groups", "carboxyl-carbon-C1", "hydroxy-and-diaryl-at-C2"], selected: [[1, 2]], reflected: [[1, 2]], comparison: 0 },
      stereo: "unspecified-only" } };
}

function bisphenol(name: string, language: Language): CompositionalFamilyGraph | null {
  const en = language === "en";
  const match = en ? /^([2-4])-\[2-\(([2-4])-hydroxyphenyl\)propan-2-yl\]phenol$/.exec(name)
    : /^([2-4])-\[2-\(([2-4])-hidroxifenil\)propan-2-il\]fenol$/.exec(name);
  if (!match) return null;
  const outerLocant = Number(match[1]), innerLocant = Number(match[2]);
  const b = builder(), parentRing = b.benzene(), parentO = b.atom("O"), chain = [b.atom(), b.atom(), b.atom()], branchRing = b.benzene(), branchO = b.atom("O");
  b.bond(parentRing[0]!, parentO); b.bond(parentRing[outerLocant - 1]!, chain[1]!);
  b.bond(chain[0]!, chain[1]!); b.bond(chain[1]!, chain[2]!);
  b.bond(chain[1]!, branchRing[0]!); b.bond(branchRing[innerLocant - 1]!, branchO);
  const chainStart = name.indexOf("propan-2-");
  const innerStart = name.indexOf(en ? "hydroxyphenyl" : "hidroxifenil") - (en ? 0 : 0);
  const innerPrefixStart = name.indexOf(en ? "hydroxy" : "hidroxi");
  const outerLocantStart = 0;
  const groupStart = name.indexOf("[") + 1, groupEnd = name.indexOf("]");
  const branchAtoms = [...chain, ...branchRing, branchO];
  const branchBonds = b.graph.bonds.filter(([a, c]) => branchAtoms.includes(a) && branchAtoms.includes(c)
    || a === parentRing[outerLocant - 1] && c === chain[1] || c === parentRing[outerLocant - 1] && a === chain[1])
    .map(([a, c]): [number, number] => [a, c]);
  const nameText = en ? "hydroxyphenyl" : "hidroxifenil";
  const suffixEnd = name.length;
  const components: NameComponent[] = [
    component({ id: "parent", role: "parent", name, start: name.length - (en ? "phenol" : "fenol").length, end: suffixEnd,
      atoms: parentRing, bonds: ringBonds(b.graph, parentRing), language, numbering: internalRingNumbering(parentRing),
      writtenLocants: [{ start: outerLocantStart, end: outerLocantStart + 1, atomId: parentRing[outerLocant - 1]!, locant: outerLocant }],
      explanation: "Both benzene rings bear one hydroxyl, so the characteristic-group count is tied. The active general name assigns phenol as the parent and treats the other hydroxyphenyl ring as part of the C4 substituent; the symmetric para/para case also permits the exchanged complete assignment (Blue Book P-44.1.1 and P-44.2.1). This does not assert PIN status.",
      explanationEs: "Ambos anillos de benceno llevan un hidroxilo, así que la cantidad de grupos característicos está empatada. El nombre general activo toma fenol como padre y expresa el otro anillo hidroxifenilo dentro del sustituyente en C4; en el caso para/para simétrico también cabe intercambiar la asignación completa (Blue Book P-44.1.1 y P-44.2.1). Esto no afirma que sea el PIN." }),
    component({ id: "suffix", role: "suffix", name, start: name.length - (en ? "phenol" : "fenol").length, end: suffixEnd,
      atoms: [parentRing[0]!, parentO], bonds: [[parentRing[0]!, parentO]], language, parentId: "parent",
      explanation: "The parent-ring hydroxyl is expressed by the phenol suffix.", explanationEs: "El hidroxilo del anillo principal se expresa mediante el sufijo fenol." }),
    component({ id: "aryl-alkyl-substituent", role: "substituent", name, start: groupStart, end: groupEnd,
      atoms: branchAtoms, bonds: branchBonds, language, parentId: "parent", locant: outerLocant,
      label: `2-(hydroxyphenyl)propan-2-yl at C${outerLocant}`, labelEs: `2-(hidroxifenil)propan-2-il en C${outerLocant}`,
      explanation: `This complete substituent attaches at parent C${outerLocant} through propan-2-yl C2; that central carbon also bears two methyl ends and a hydroxyphenyl ring.`,
      explanationEs: `Este sustituyente completo se une al C${outerLocant} principal por el C2 del propan-2-ilo; ese carbono central también lleva dos extremos metilo y un anillo hidroxifenilo.` }),
    component({ id: "propan-2-yl", role: "prefix", name, start: chainStart, end: chainStart + "propan-2-yl".length,
      atoms: chain, bonds: [[chain[0]!, chain[1]!], [chain[1]!, chain[2]!]], language, parentId: "aryl-alkyl-substituent",
      internalNumbering: chain.map((id, index) => [id, index + 1]), numbering: [[chain[1]!, 2]], locant: outerLocant,
      writtenLocants: [{ start: chainStart + 7, end: chainStart + 8, atomId: chain[1]!, locant: 2 }],
      explanation: "The propan-2-yl skeleton has three carbons; its C2 is the attachment point to the parent ring and branches to both terminal methyl carbons.",
      explanationEs: "El esqueleto propan-2-ilo tiene tres carbonos; su C2 se une al anillo principal y se ramifica hacia los dos carbonos metilo terminales." }),
    component({ id: "hydroxyphenyl", role: "substituent", name, start: innerStart, end: innerStart + nameText.length,
      atoms: [...branchRing, branchO], bonds: [...ringBonds(b.graph, branchRing), [chain[1]!, branchRing[0]!], [branchRing[innerLocant - 1]!, branchO]], language,
      parentId: "aryl-alkyl-substituent", internalNumbering: internalRingNumbering(branchRing), numbering: [[branchRing[0]!, 1], [branchRing[innerLocant - 1]!, innerLocant]],
      writtenLocants: [{ start: innerStart - 2, end: innerStart - 1, atomId: branchRing[innerLocant - 1]!, locant: innerLocant }],
      explanation: `This phenyl ring attaches to propan-2-yl C2 through its C1; its hydroxyl is at internal ring C${innerLocant}.`,
      explanationEs: `Este anillo fenilo se une al C2 del propan-2-ilo por su C1; su hidroxilo está en el C${innerLocant} interno del anillo.` }),
    component({ id: "hydroxy-prefix", role: "prefix", name, start: innerPrefixStart, end: innerPrefixStart + (en ? "hydroxy" : "hidroxi").length,
      atoms: [branchRing[innerLocant - 1]!, branchO], bonds: [[branchRing[innerLocant - 1]!, branchO]], language, parentId: "hydroxyphenyl", locant: innerLocant,
      label: `Hydroxy on inner phenyl C${innerLocant}`, labelEs: `Hidroxilo en el C${innerLocant} del fenilo interno`,
      explanation: `Hydroxy is a prefix on the phenyl substituent; it is not the parent phenol suffix.`,
      explanationEs: `Hidroxi es un prefijo del sustituyente fenilo; no es el sufijo fenol del padre.` }),
  ];
  const equivalent = outerLocant === innerLocant;
  return { graph: b.graph, components, parent: parentRing, group: "alcohol", allowEquivalentNumbering: true,
    ...(equivalent ? { equivalentParentPaths: [parentRing, branchRing] } : {}),
    evidence: { source: "active-name", profile: "current", language, construction: "functional-biaryl",
      parentSelection: "functionalized-ring", rules: [blueBookRule("P-41", "P4"), blueBookRule("P-44.1.1.1", "P4"), blueBookRule("P-44.2.1", "P4"), blueBookRule("P-59.1.3", "P5"), blueBookRule("P-63.1", "P6")],
      numbering: { scope: "parent", priorities: ["maximum-suffix-groups", "parent-ring-locants", "branch-internal-ring-locants"], selected: [[1, outerLocant], [1, innerLocant]], reflected: [[1, outerLocant], [1, innerLocant]], comparison: 0 },
      stereo: "unspecified-only" } };
}

function cyclohexylbenzene(name: string, language: Language): CompositionalFamilyGraph | null {
  if (name !== (language === "en" ? "cyclohexylbenzene" : "ciclohexilbenceno")) return null;
  const b = builder(), parent = b.benzene(), cycle = b.cyclohexane();
  b.bond(parent[0]!, cycle[0]!);
  const substituentStart = 0, parentStart = language === "en" ? "cyclohexyl".length : "ciclohexil".length;
  const root = language === "en" ? "benzene" : "benceno";
  const components: NameComponent[] = [
    component({ id: "parent", role: "parent", name, start: parentStart, end: name.length, atoms: parent, bonds: ringBonds(b.graph, parent),
      language, numbering: internalRingNumbering(parent),
      explanation: "The two candidate rings each contain six carbons; benzene is selected because it has the greater number of multiple bonds (Blue Book P-44.2.1 and P-44.4.1.1). The cyclohexyl ring is the substituent.",
      explanationEs: "Ambos anillos candidatos tienen seis carbonos; se selecciona benceno porque contiene más enlaces múltiples (Blue Book P-44.2.1 y P-44.4.1.1). El ciclohexilo es el sustituyente." }),
    component({ id: "cyclohexyl", role: "substituent", name, start: substituentStart, end: parentStart, atoms: cycle,
      bonds: [...ringBonds(b.graph, cycle), [parent[0]!, cycle[0]!]], language, parentId: "parent", locant: 1,
      internalNumbering: internalRingNumbering(cycle), numbering: [[parent[0]!, 1], [cycle[0]!, 1]],
      label: "Cyclohexyl ring", labelEs: "Anillo ciclohexilo",
      explanation: "Cyclohexyl is a saturated six-carbon ring attached to benzene C1 through a C–C bond; its own C1 starts at the attachment.",
      explanationEs: "Ciclohexilo es un anillo saturado de seis carbonos unido al C1 del benceno mediante C–C; su C1 interno empieza en la unión." }),
  ];
  return { graph: b.graph, components, parent, group: "none", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "aryl-cycloalkane", parentSelection: "aromatic-parent",
      rules: [blueBookRule("P-44.2.1", "P4"), blueBookRule("P-44.4.1.1", "P4"), blueBookRule("P-59.1.3", "P5")],
      numbering: { scope: "parent", priorities: ["ring-class", "skeletal-atom-count", "multiple-bond-count"], selected: [[1]], reflected: [[1]], comparison: -1 },
      stereo: "unspecified-only" } };
}

function phenylcyclohexanol(name: string, language: Language): CompositionalFamilyGraph | null {
  const en = language === "en";
  if (name !== (en ? "1-phenylcyclohexan-1-ol" : "1-fenilciclohexan-1-ol")) return null;
  const b = builder(), parent = b.cyclohexane(), oxygen = b.atom("O"), phenyl = b.benzene();
  b.bond(parent[0]!, oxygen); b.bond(parent[0]!, phenyl[0]!);
  const phenylStart = name.indexOf(en ? "phenyl" : "fenil"), suffixStart = name.length - 2;
  const parentStart = phenylStart + (en ? "phenyl" : "fenil").length + 1;
  const components: NameComponent[] = [
    component({ id: "parent", role: "parent", name, start: parentStart, end: name.length, atoms: parent, bonds: ringBonds(b.graph, parent),
      language, numbering: internalRingNumbering(parent), writtenLocants: [{ start: 0, end: 1, atomId: parent[0]!, locant: 1 },
        { start: name.lastIndexOf("-1-") + 1, end: name.lastIndexOf("-1-") + 2, atomId: parent[0]!, locant: 1 }],
      explanation: "The cyclohexane ring bearing the alcohol suffix is the parent; the hydroxyl fixes C1. Phenyl at that same carbon is a substituent.",
      explanationEs: "El ciclohexano que lleva el sufijo alcohol es la estructura principal; el hidroxilo fija C1. El fenilo unido a ese mismo carbono es un sustituyente." }),
    component({ id: "suffix", role: "suffix", name, start: suffixStart, end: name.length, atoms: [parent[0]!, oxygen], bonds: [[parent[0]!, oxygen]], language, parentId: "parent",
      explanation: "The C1–OH bond supplies the alcohol suffix.", explanationEs: "El enlace C1–OH aporta el sufijo de alcohol." }),
    component({ id: "phenyl", role: "substituent", name, start: phenylStart, end: phenylStart + (en ? "phenyl" : "fenil").length,
      atoms: phenyl, bonds: [...ringBonds(b.graph, phenyl), [parent[0]!, phenyl[0]!]], language, parentId: "parent", locant: 1,
      internalNumbering: internalRingNumbering(phenyl), numbering: [[parent[0]!, 1], [phenyl[0]!, 1]], label: "Phenyl at parent C1", labelEs: "Fenilo en C1 del padre",
      explanation: "The phenyl ring is connected by C–C to cyclohexane C1; its ring C1 is an independent internal locant.",
      explanationEs: "El anillo fenilo se une por C–C al C1 del ciclohexano; el C1 del anillo tiene un localizador interno independiente." }),
  ];
  return { graph: b.graph, components, parent, group: "alcohol", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "functional-cycloaryl", parentSelection: "functionalized-ring",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-44.1.1.1", "P4"), blueBookRule("P-44.1.2.2", "P4"), blueBookRule("P-59.2.1.4", "P5"), blueBookRule("P-63.1", "P6")],
      numbering: { scope: "parent", priorities: ["suffix-bearing-ring", "suffix-locant-C1", "phenyl-locant-C1"], selected: [[1], [1]], reflected: [[1], [1]], comparison: 0 },
      stereo: "unspecified-only" } };
}

/** Bounded constructions for independent rings joined through saturated or unsaturated carbon skeletons. */
export function parseCarbonLinkedIndependentRings(name: string): CompositionalFamilyGraph | null {
  return diphenylmethanone(name)
    ?? centralDiaryl(name, "en") ?? centralDiaryl(name, "es")
    ?? phenylatedChain(name,"en") ?? phenylatedChain(name,"es")
    ?? stilbene(name, "en") ?? stilbene(name, "es")
    ?? benzilicAcid(name, "en") ?? benzilicAcid(name, "es")
    ?? bisphenol(name, "en") ?? bisphenol(name, "es")
    ?? cyclohexylbenzene(name, "en") ?? cyclohexylbenzene(name, "es")
    ?? phenylcyclohexanol(name, "en") ?? phenylcyclohexanol(name, "es");
}

/** Spanish counterpart for the existing diphenylmethanone construction. */
function diphenylmethanone(name: string): CompositionalFamilyGraph | null {
  if (name !== "difenilmetanona") return null;
  const b = builder(), carbonyl = b.atom(), oxygen = b.atom("O"), rings = [b.benzene(), b.benzene()];
  b.bond(carbonyl, oxygen, 2); rings.forEach(ring => b.bond(carbonyl, ring[0]!));
  const components: NameComponent[] = [
    component({ id:"parent",role:"parent",name,start:7,end:name.length,atoms:[carbonyl],bonds:[],language:"es",
      numbering:[[carbonyl,1]],explanation:"The carbonyl carbon forms the one-carbon methanone parent.",
      explanationEs:"El carbono carbonílico forma la estructura principal metanona, de un carbono." }),
    component({ id:"suffix",role:"suffix",name,start:name.length-3,end:name.length,atoms:[carbonyl,oxygen],
      bonds:[[carbonyl,oxygen]],language:"es",parentId:"parent",numbering:[[carbonyl,1]],
      explanation:"The C=O group supplies the ketone suffix.",explanationEs:"El grupo C=O aporta el sufijo de cetona." }),
    component({ id:"diphenyl",role:"prefix",name,start:0,end:7,atoms:rings.flat(),
      bonds:rings.flatMap(ring=>[...ringBonds(b.graph,ring),[carbonyl,ring[0]!]]),language:"es",parentId:"parent",
      label:"Dos grupos fenilo",labelEs:"Dos grupos fenilo",
      explanation:"The di- prefix counts the two phenyl rings bonded to the carbonyl carbon.",
      explanationEs:"El prefijo di- cuenta los dos anillos fenilo unidos al carbono carbonílico." }),
  ];
  rings.forEach((ring,index)=>components.push(component({id:`phenyl-${index+1}`,role:"prefix",name,start:2,end:7,
    atoms:ring,bonds:[...ringBonds(b.graph,ring),[carbonyl,ring[0]!]],language:"es",parentId:"diphenyl",
    numbering:[[ring[0]!,1]],mappingGroup:"equivalent-ketone-phenyl-rings",label:`Fenilo ${index+1}`,labelEs:`Fenilo ${index+1}`,
    explanation:"This phenyl ring is individually attached to the carbonyl carbon.",
    explanationEs:"Este anillo fenilo se une individualmente al carbono carbonílico." })));
  return {graph:b.graph,components,parent:[carbonyl],group:"ketone",allowEquivalentNumbering:true,
    evidence:{source:"active-name",profile:"current",language:"es",construction:"carbon-linked-aromatic",parentSelection:"acyclic-chain",
      rules:[blueBookRule("P-41","P4"),blueBookRule("P-44.1.2.2","P4"),blueBookRule("P-59.1.3","P5")],
      numbering:{scope:"parent",priorities:["ketone-suffix","two-equivalent-phenyl-substituents"],selected:[[1]],reflected:[[1]],comparison:0},stereo:"unspecified-only"}};
}
