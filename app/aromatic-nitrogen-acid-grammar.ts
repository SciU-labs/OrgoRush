import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { blueBookRule, type CompositionalFamilyGraph, type NameComponent, type PrincipalGroup } from "./compositional-name-model.ts";

type Language = "en" | "es";
type RingSub = { locant: number; kind: "methyl" | "chloro" | "fluoro" | "bromo" | "iodo"; start: number; end: number };

/** Parse the reusable N-aryl benzamide and arylamino-benzoic-acid patterns.
 * Numbering for the two rings is stored in separate scopes; an N locant is
 * never represented as a carbon locant on either ring. */
export function parseAromaticNitrogenAcid(name: string): CompositionalFamilyGraph | null {
  const translated = spanishNameToEnglish(name);
  if (translated) {
    const parsed = parseEnglishAromaticNitrogenAcid(translated.english);
    if (!parsed) return null;
    const mapBoundary = (offset: number) => translated.englishBoundaryToSpanish[Math.max(0, Math.min(offset, translated.englishBoundaryToSpanish.length - 1))]!;
    for (const component of parsed.components) {
      const start = mapBoundary(component.start), end = mapBoundary(component.end);
      component.start = start; component.end = end; component.text = name.slice(start, end);
      component.language = "es";
      if (component.writtenLocants) component.writtenLocants = component.writtenLocants.map(locant => ({
        ...locant, start: mapBoundary(locant.start), end: mapBoundary(locant.end),
      }));
    }
    if (parsed.evidence) parsed.evidence.language = "es";
    return parsed;
  }
  return parseEnglishAromaticNitrogenAcid(name);
}

/** Produce a Spanish spelling only for the bounded constructions that the
 * Spanish parser above can independently reconcile. Callers must still prove
 * the returned name against the molecular graph before displaying it. */
export function localizeAromaticNitrogenAcidName(name: string): string | null {
  if (name === "N-phenylbenzamide") return "N-fenilbenzamida";
  const replacements: [RegExp, string][] = [
    [/dichloro/g,"dicloro"], [/dimethyl/g,"dimetil"], [/methyl/g,"metil"], [/chloro/g,"cloro"],
    [/phenyl/g,"fenil"], [/phenoxy/g,"fenoxi"], [/benzoyl/g,"benzoil"],
  ];
  const translate = (value: string) => replacements.reduce((text,[pattern,replacement])=>text.replace(pattern,replacement),value);
  const acetic = /^(.*)acetic acid$/.exec(name);
  if (acetic) return `ácido ${translate(acetic[1]!)}acético`;
  const propanoic = /^(.*)propanoic acid$/.exec(name);
  if (propanoic) return `ácido ${translate(propanoic[1]!)}propanoico`;
  const benzoic = /^(.*)benzoic acid$/.exec(name);
  if (benzoic) return `ácido ${translate(benzoic[1]!)}benzoico`;
  const ester = /^propan-2-yl (.*)propanoate$/.exec(name);
  if (ester) return `propan-2-ilo ${translate(ester[1]!)}propanoato`;
  return null;
}

/** Translate only the bounded vocabulary and constructions used by these
 * aromatic families. The translated spelling is then parsed by the same
 * structural grammar; no synonym or approximate matching is used. */
function spanishNameToEnglish(name: string): { english: string; englishBoundaryToSpanish: number[] } | null {
  const replacements: [RegExp, string][] = [
    [/^ácido /, ""], [/dicloro/g, "dichloro"], [/dimetil/g, "dimethyl"], [/metil/g, "methyl"],
    [/cloro/g, "chloro"], [/fluoro/g, "fluoro"], [/bromo/g, "bromo"], [/yodo/g, "iodo"],
    [/fenil/g, "phenyl"], [/fenoxi/g, "phenoxy"], [/benzoil/g, "benzoyl"],
    [/benzamida/g, "benzamide"], [/acético/g, "acetic acid"], [/propanoico/g, "propanoic acid"], [/benzoico/g, "benzoic acid"],
    [/propanoato/g, "propanoate"], [/ilo\b/g, "yl"],
  ];
  // Token-wise replacement keeps delimiters and locants literal, while the
  // boundary map lets the validated components retain correct Spanish spans.
  const tokens = [...name.matchAll(/ácido |dicloro|dimetil|metil|cloro|fluoro|bromo|yodo|fenil|fenoxi|benzoil|benzamida|acético|propanoico|benzoico|propanoato|ilo\b/g)];
  if (!tokens.length && !name.startsWith("N-")) return null;
  let english = "", cursor = 0; const boundary = [0];
  const append = (source: string, start: number, end: number, output: string) => {
    const previousLength = english.length; english += output;
    if (!output.length) { boundary[previousLength] = end; return; }
    for (let i = 1; i <= output.length; i++) boundary[previousLength + i] = start + Math.round((end - start) * i / output.length);
  };
  for (const token of tokens) {
    const start = token.index!, end = start + token[0].length;
    if (start < cursor) continue;
    append(name.slice(cursor, start), cursor, start, name.slice(cursor, start));
    const matched = replacements.find(([pattern]) => { pattern.lastIndex = 0; return pattern.test(token[0]); });
    const replacement = matched ? matched[1] : token[0];
    append(token[0], start, end, replacement); cursor = end;
  }
  append(name.slice(cursor), cursor, name.length, name.slice(cursor));
  if (english === name || !/^(?:N-|2-|propan-2-)/.test(english)) return null;
  return { english, englishBoundaryToSpanish: boundary };
}

function parseEnglishAromaticNitrogenAcid(name: string): CompositionalFamilyGraph | null {
  const arylPattern = "(?:[1-6](?:,[1-6])?-(?:(?:di|tri)?(?:methyl|chloro|fluoro|bromo))-?)*phenyl";
  const amide = new RegExp(`^N-(?:phenyl|\\(${arylPattern}\\))benzamide$`).exec(name);
  if (amide) return parseNarylBenzamide(name);
  const acid = new RegExp(`^(\\d)-\\[\\((${arylPattern})\\)amino\\]benzoic acid$`).exec(name);
  if (acid) return parseArylAminoBenzoicAcid(name, Number(acid[1]), acid[2]!);
  const benzoylAcid = /^(2)-\(([2-4])-benzoylphenyl\)propanoic acid$/.exec(name);
  if (benzoylAcid) return parseBenzoylPropanoicAcid(name, Number(benzoylAcid[2]));
  const diarylaminoAcid = /^2-\[(2)-\(([2-6](?:,[2-6])?-(?:(?:di|tri)?(?:methyl|chloro|fluoro|bromo)))anilino\)phenyl\]acetic acid$/.exec(name);
  if (diarylaminoAcid) return parseDiarylaminoAceticAcid(name, Number(diarylaminoAcid[1]), diarylaminoAcid[2]!);
  const aromaticEster = /^propan-2-yl 2-\[([2-4])-\(([2-4])-(chloro|fluoro|bromo|iodo)benzoyl\)phenoxy\]-2-methylpropanoate$/.exec(name);
  if (aromaticEster) return parseNestedAromaticEster(name, Number(aromaticEster[1]), Number(aromaticEster[2]), aromaticEster[3] as Exclude<RingSub["kind"],"methyl">);
  return null;
}

function parseSubs(text: string, offset: number): RingSub[] | null {
  if (!text) return [];
  const matches = [...text.matchAll(/([1-6](?:,[1-6])*)-((?:di|tri)?)(methyl|chloro|fluoro|bromo|iodo)/g)];
  if (!matches.length || matches.map(m => m[0]).join("-") !== text) return null;
  const cited = matches.map(m => m[3]!);
  if (new Set(cited).size !== cited.length || cited.some((kind, i) => i > 0 && cited[i - 1]!.localeCompare(kind) > 0)) return null;
  const out: RingSub[] = [];
  for (const m of matches) {
    const locants = m[1]!.split(",").map(Number), multiplier = m[2]!, kind = m[3] as RingSub["kind"];
    if (new Set(locants).size !== locants.length || locants.some((n, i) => i > 0 && n <= locants[i - 1]!)) return null;
    if (locants.length !== (multiplier === "di" ? 2 : multiplier === "tri" ? 3 : 1)) return null;
    const start = offset + m.index!, end = start + m[0].length;
    out.push(...locants.map(locant => ({ locant, kind, start, end })));
  }
  if (out.some(s => s.locant === 1) || new Set(out.map(s => `${s.locant}:${s.kind}`)).size !== out.length) return null;
  const selected = out.map(s => s.locant).sort((a, b) => a - b);
  const reflected = selected.map(locant => 8 - locant).sort((a, b) => a - b);
  for (let i = 0; i < selected.length; i++) {
    if (selected[i] !== reflected[i]) return selected[i]! < reflected[i]! ? out : null;
  }
  const signature = (mapping: (locant: number) => number) => out.map(s => `${mapping(s.locant)}:${s.kind}`).sort();
  const direct = signature(locant => locant), mirror = signature(locant => 8 - locant);
  if (direct.join("|").localeCompare(mirror.join("|")) > 0) return null;
  return out;
}

function spanishGroupName(kind: RingSub["kind"]): string {
  return kind === "methyl" ? "metilo" : kind === "chloro" ? "cloro" : kind === "fluoro" ? "fluoro"
    : kind === "bromo" ? "bromo" : "yodo";
}

function makeBase() {
  const graph: GeneratedMolecule = { atoms: [], bonds: [] };
  const atom = (element: "C" | "N" | "O" | "Cl" | "F" | "Br" | "I" = "C") => {
    const id = graph.atoms.length + 1; graph.atoms.push({ id, element, x: 0, y: 0 }); return id;
  };
  const bond = (a: number, b: number, order: 1 | 2 = 1) => graph.bonds.push([a, b, order]);
  const ring = () => {
    const ids = Array.from({ length: 6 }, () => atom());
    ids.forEach((id, i) => bond(id, ids[(i + 1) % 6]!, i % 2 ? 1 : 2)); return ids;
  };
  return { graph, atom, bond, ring };
}

function addComponent(components: NameComponent[], input: Omit<NameComponent, "language">, language: Language) {
  components.push({ ...input, language });
}
function ringBonds(graph: GeneratedMolecule, ids: number[]): [number, number][] {
  const set = new Set(ids); return graph.bonds.filter(([a, b]) => set.has(a) && set.has(b)).map(([a, b]) => [a, b]);
}
function addRingSubstituents(name: string, source: string, ring: number[], graph: GeneratedMolecule,
  atom: (element?: "C" | "N" | "O" | "Cl" | "F" | "Br" | "I") => number, bond: (a: number, b: number, order?: 1 | 2) => unknown,
  components: NameComponent[], language: Language, parentId: string, scope: string): boolean {
  const phenylAt = source.indexOf("phenyl"), prefix = source.slice(0, phenylAt);
  const subs = parseSubs(prefix, name.indexOf(source)); if (!subs) return false;
  for (const [i, sub] of subs.entries()) {
    const hetero = sub.kind === "methyl" ? "C" : sub.kind === "chloro" ? "Cl" : sub.kind === "fluoro" ? "F" : sub.kind === "bromo" ? "Br" : "I";
    const branch = atom(hetero), parent = ring[sub.locant - 1]!; bond(parent, branch);
    const locantText = `${sub.locant}`;
    const local = name.slice(sub.start, sub.end), locantIndex = name.indexOf(locantText, sub.start);
    addComponent(components, { id: `${scope}-substituent-${i + 1}`, role: "substituent", text: local,
      start: sub.start, end: sub.end, parentId, locant: sub.locant, atomIds: [parent, branch], bondIds: [[parent, branch]],
      numbering: [[parent, sub.locant]], numberingScope: scope,
      writtenLocants: [{ start: locantIndex, end: locantIndex + locantText.length, atomId: parent, locant: sub.locant }],
      label: sub.kind === "methyl" ? "Methyl substituent" : `${sub.kind[0]!.toUpperCase()}${sub.kind.slice(1)} substituent`,
      labelEs: `Sustituyente ${spanishGroupName(sub.kind)}`,
      explanation: `The ${sub.kind} group is attached to C${sub.locant} of this independently numbered phenyl ring.`,
      explanationEs: `El grupo ${sub.kind === "methyl" ? "metilo" : sub.kind} se une al C${sub.locant} de este anillo fenilo, numerado por separado.` }, language);
  }
  return true;
}

function parseNarylBenzamide(name: string): CompositionalFamilyGraph | null {
  const substituted = name.startsWith("N-("), inner = substituted ? name.slice(3, name.indexOf(")benzamide")) : "";
  const substituentText = substituted ? inner : "phenyl";
  const base = substituentText.endsWith("phenyl") ? substituentText.slice(0, -6) : null;
  if (base === null) return null;
  const subs = parseSubs(base, substituted ? 3 : 0); if (!subs) return null;
  const { graph, atom, bond, ring } = makeBase(), parent = ring(), nitrogen = atom("N"), acyl = atom(), oxygen = atom("O"), aryl = ring();
  bond(parent[0]!, acyl); bond(acyl, oxygen, 2); bond(acyl, nitrogen); bond(nitrogen, aryl[0]!);
  const components: NameComponent[] = [];
  addComponent(components, { id: "parent", role: "parent", text: "benzamide", start: name.length - 9, end: name.length,
    atomIds: [...parent, acyl, oxygen, nitrogen], bondIds: [...ringBonds(graph, parent), [parent[0]!, acyl], [acyl, oxygen], [acyl, nitrogen]],
    numbering: parent.map((id, i) => [id, i + 1]), numberingScope: "benzamide-parent",
    explanation: "The carbonyl-bearing benzene is the benzamide parent. Its carbonyl carbon is attached at ring C1.",
    explanationEs: "El benceno unido al carbonilo es el padre benzamida. El carbono del carbonilo se une al C1 del anillo." }, "en");
  addComponent(components, { id: "suffix", role: "suffix", text: "amide", start: name.length - 5, end: name.length,
    parentId: "parent", atomIds: [acyl, oxygen, nitrogen], bondIds: [[acyl, oxygen], [acyl, nitrogen]], numbering: [[acyl, 1]],
    explanation: "The C(=O)–N group supplies the amide suffix; its nitrogen remains part of that principal functional group.",
    explanationEs: "El grupo C(=O)–N aporta el sufijo amida; el nitrógeno pertenece a esta función principal." }, "en");
  const nStart = 0, nEnd = substituted ? name.indexOf("benzamide") : name.indexOf("benzamide");
  addComponent(components, { id: "n-aryl", role: "substituent", text: name.slice(nStart, nEnd), start: nStart, end: nEnd,
    parentId: "parent", locant: "N", atomIds: [nitrogen, ...aryl],
    bondIds: [...ringBonds(graph, aryl), [nitrogen, aryl[0]!]], numbering: [[nitrogen, "N"], ...aryl.map((id, i): [number, number] => [id, i + 1])],
    numberingScope: "N-phenyl-ring", label: "N-phenyl substituent", labelEs: "Sustituyente N-fenilo",
    explanation: "N identifies the amide nitrogen as the attachment point for the second phenyl ring. Its ring numbering starts at the carbon bonded to N.",
    explanationEs: "N identifica el nitrógeno amídico como punto de unión del segundo anillo fenilo. Su numeración comienza en el carbono unido a N." }, "en");
  addComponent(components, { id: "amide-nitrogen", role: "prefix", text: "N", start: 0, end: 1,
    parentId: "n-aryl", locant: "N", atomIds: [nitrogen], bondIds: [[acyl, nitrogen], [nitrogen, aryl[0]!]], numbering: [[nitrogen, "N"]],
    label: "Amide nitrogen", labelEs: "Nitrógeno amídico",
    explanation: "This is the amide nitrogen. It connects the benzamide carbonyl to the independently named phenyl substituent.",
    explanationEs: "Este es el nitrógeno amídico; conecta el carbonilo de benzamida con el sustituyente fenilo." }, "en");
  if (!addRingSubstituents(name, substituentText, aryl, graph, atom, bond, components, "en", "n-aryl", "N-phenyl-ring")) return null;
  return { graph, components, parent: [...parent, acyl, nitrogen], group: "amide" as PrincipalGroup, allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language: "en", construction: "retained-aromatic", parentSelection: "retained-functional-parent",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-66.1.1.1.2", "P6a"), blueBookRule("P-66.1.1.3.1.1", "P6a"), blueBookRule("P-66.1.1.3.4", "P6a"), blueBookRule("P-14.5", "P1")],
      numbering: { scope: "parent", priorities: ["amide-suffix", "benzamide-ring", "N-substitution"], selected: [[1]], reflected: [[1]], comparison: 0 }, stereo: "unspecified-only" } };
}

function parseArylAminoBenzoicAcid(name: string, attachmentLocant: number, arylText: string): CompositionalFamilyGraph | null {
  const arylSubs = parseSubs(arylText.slice(0, -6), name.indexOf(arylText)); if (!arylSubs || attachmentLocant < 2 || attachmentLocant > 6) return null;
  const { graph, atom, bond, ring } = makeBase(), parent = ring(), aryl = ring(), nitrogen = atom("N"), acyl = atom(), oxy = atom("O"), hydroxyl = atom("O");
  const parentN = parent[attachmentLocant - 1]!;
  bond(parentN, nitrogen); bond(nitrogen, aryl[0]!); bond(parent[0]!, acyl); bond(acyl, oxy, 2); bond(acyl, hydroxyl);
  const components: NameComponent[] = [], acidStart = name.length - "benzoic acid".length;
  addComponent(components, { id: "parent", role: "parent", text: "benzoic acid", start: acidStart, end: name.length,
    atomIds: [...parent, acyl, oxy, hydroxyl], bondIds: [...ringBonds(graph, parent), [parent[0]!, acyl], [acyl, oxy], [acyl, hydroxyl]],
    numbering: parent.map((id, i) => [id, i + 1]), numberingScope: "benzoic-acid-parent",
    explanation: "The carboxylic acid has seniority and fixes benzoic acid as the parent. The ring carbon bonded to CO₂H is C1.",
    explanationEs: "El ácido carboxílico tiene prioridad y fija el padre ácido benzoico. El carbono unido a CO₂H es C1." }, "en");
  addComponent(components, { id: "suffix", role: "suffix", text: "acid", start: name.length - 4, end: name.length,
    parentId: "parent", atomIds: [acyl, oxy, hydroxyl], bondIds: [[acyl, oxy], [acyl, hydroxyl]], numbering: [[acyl, 1]],
    explanation: "The carboxyl group is the principal characteristic group and is named by the acid suffix.",
    explanationEs: "El grupo carboxilo es la función principal y se expresa con el sufijo de ácido." }, "en");
  const nStart = name.indexOf("[") + 1, nEnd = name.indexOf("]") + 1;
  addComponent(components, { id: "arylamino", role: "substituent", text: name.slice(nStart, nEnd), start: nStart, end: nEnd,
    parentId: "parent", locant: attachmentLocant, atomIds: [parentN, nitrogen, ...aryl],
    bondIds: [[parentN, nitrogen], [nitrogen, aryl[0]!], ...ringBonds(graph, aryl)],
    numbering: [[parentN, attachmentLocant], [nitrogen, "N"], ...aryl.map((id, i): [number, number] => [id, i + 1])],
    numberingScope: "arylamino-phenyl-ring", label: "Aryl–N–aryl substituent", labelEs: "Sustituyente arilo–N–arilo",
    explanation: `The amino nitrogen joins parent benzoic-acid C${attachmentLocant} to C1 of a separately numbered phenyl ring.`,
    explanationEs: `El nitrógeno amino une el C${attachmentLocant} del ácido benzoico con el C1 de un anillo fenilo numerado por separado.` }, "en");
  const aminoStart = name.indexOf("amino", nStart);
  addComponent(components, { id: "linking-nitrogen", role: "prefix", text: "amino", start: aminoStart, end: aminoStart + 5,
    parentId: "arylamino", locant: "N", atomIds: [nitrogen], bondIds: [[parentN, nitrogen], [nitrogen, aryl[0]!]],
    numbering: [[nitrogen, "N"]], label: "Linking nitrogen", labelEs: "Nitrógeno de unión",
    explanation: "The amino nitrogen is the single atom joining the two aromatic rings; it is distinct from the carboxyl group.",
    explanationEs: "El nitrógeno amino es el único átomo que une los dos anillos aromáticos; es distinto del grupo carboxilo." }, "en");
  if (!addRingSubstituents(name, arylText, aryl, graph, atom, bond, components, "en", "arylamino", "arylamino-phenyl-ring")) return null;
  return { graph, components, parent: [...parent, acyl, oxy, hydroxyl], group: "carboxylicAcid", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language: "en", construction: "retained-aromatic", parentSelection: "retained-functional-parent",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-65.1", "P6"), blueBookRule("P-62.2.1.1.1", "P6"), blueBookRule("P-14.4", "P1")],
      numbering: { scope: "parent", priorities: ["carboxylic-acid-suffix", "benzoic-acid-ring", "arylamino-attachment"], selected: [[1, attachmentLocant]], reflected: [[1, 8 - attachmentLocant]], comparison: -1 }, stereo: "unspecified-only" } };
}

function parseBenzoylPropanoicAcid(name: string, ringLocant: number): CompositionalFamilyGraph | null {
  const { graph, atom, bond, ring } = makeBase();
  const chain = [atom(), atom()], acidC = atom(), acidO = atom("O"), acidOH = atom("O");
  const aryl = ring(), benzoylC = atom(), ketoneO = atom("O"), phenyl = ring();
  bond(chain[0]!, chain[1]!); bond(chain[0]!, acidC); bond(acidC, acidO, 2); bond(acidC, acidOH);
  bond(chain[0]!, aryl[0]!); bond(aryl[ringLocant - 1]!, benzoylC); bond(benzoylC, ketoneO, 2); bond(benzoylC, phenyl[0]!);
  const components: NameComponent[] = [], parentStart = name.indexOf("propanoic acid");
  addComponent(components, { id: "parent", role: "parent", text: "propanoic acid", start: parentStart, end: name.length,
    atomIds: [...chain, acidC, acidO, acidOH], bondIds: [[chain[0]!, chain[1]!], [chain[0]!, acidC], [acidC, acidO], [acidC, acidOH]],
    numbering: [[acidC, 1], [chain[0]!, 2], [chain[1]!, 3]], numberingScope: "propanoic-acid-parent",
    explanation: "The carboxylic acid is the principal group and selects the three-carbon propanoic-acid parent. The carbonyl carbon is C1; the aryl substituent is at C2.",
    explanationEs: "El ácido carboxílico es la función principal y selecciona el padre ácido propanoico de tres carbonos. El carbono carbonílico es C1 y el sustituyente arilo está en C2." }, "en");
  addComponent(components, { id: "suffix", role: "suffix", text: "acid", start: name.length - 4, end: name.length,
    parentId: "parent", atomIds: [acidC, acidO, acidOH], bondIds: [[acidC, acidO], [acidC, acidOH]], numbering: [[acidC, 1]],
    explanation: "The carboxyl group supplies the acid suffix.", explanationEs: "El grupo carboxilo aporta el sufijo de ácido." }, "en");
  const arylStart = name.indexOf("(") + 1, arylEnd = name.indexOf(")", arylStart) + 1;
  addComponent(components, { id: "aryl-substituent", role: "substituent", text: name.slice(arylStart, arylEnd), start: arylStart, end: arylEnd,
    parentId: "parent", locant: 2, atomIds: [...aryl], bondIds: [...ringBonds(graph, aryl), [chain[0]!, aryl[0]!]],
    numbering: [[chain[0]!, 2], ...aryl.map((id, i): [number, number] => [id, i + 1])], numberingScope: `${ringLocant}-benzoylphenyl-ring`,
    writtenLocants: [{ start: arylStart, end: arylStart + 1, atomId: aryl[0]!, locant: ringLocant }],
    label: `${ringLocant}-benzoylphenyl substituent`, labelEs: `Sustituyente ${ringLocant}-benzoilfenilo`,
    explanation: `The phenyl ring is attached to parent C2. Its internal numbering starts at the attachment carbon; the benzoyl group is at ring C${ringLocant}.`,
    explanationEs: `El anillo fenilo se une al C2 parental. Su numeración interna comienza en el carbono de unión; el grupo benzoilo está en C${ringLocant} del anillo.` }, "en");
  const benzoylStart = name.indexOf("benzoyl");
  addComponent(components, { id: "benzoyl", role: "prefix", text: "benzoyl", start: benzoylStart, end: benzoylStart + 7,
    parentId: "aryl-substituent", locant: ringLocant, atomIds: [aryl[ringLocant - 1]!, benzoylC, ketoneO, ...phenyl],
    bondIds: [[aryl[ringLocant - 1]!, benzoylC], [benzoylC, ketoneO], [benzoylC, phenyl[0]!], ...ringBonds(graph, phenyl)],
    numbering: [[aryl[ringLocant - 1]!, ringLocant], [benzoylC, 1], ...phenyl.map((id, i): [number, number] => [id, i + 1])],
    numberingScope: "benzoyl-group", label: "Benzoyl group", labelEs: "Grupo benzoilo",
    explanation: "Benzoyl is the C(=O)–phenyl substituent at ring C3; the carbonyl attaches directly to this phenyl ring.",
    explanationEs: "Benzoilo es el sustituyente C(=O)–fenilo en C3 del anillo; el carbonilo se une directamente a este anillo fenilo." }, "en");
  addComponent(components, { id: "benzoyl-carbonyl", role: "prefix", text: "benzoyl", start: benzoylStart, end: benzoylStart + 7,
    parentId: "benzoyl", atomIds: [benzoylC, ketoneO], bondIds: [[benzoylC, ketoneO]], numbering: [[benzoylC, 1]],
    label: "Benzoyl carbonyl", labelEs: "Carbonilo del benzoilo",
    explanation: "This carbonyl is the bond-forming center between the first phenyl ring and the phenyl group in benzoyl; benzyl would connect through –CH₂– instead.",
    explanationEs: "Este carbonilo enlaza el primer anillo fenilo con el fenilo del benzoilo; el bencilo se uniría mediante –CH₂–." }, "en");
  return { graph, components, parent: [...chain, acidC, acidO, acidOH], group: "carboxylicAcid", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language: "en", construction: "retained-aromatic", parentSelection: "retained-functional-parent",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-65.1", "P6"), blueBookRule("P-59.2.1.4", "P5"), blueBookRule("P-14.4", "P1")],
      numbering: { scope: "parent", priorities: ["carboxylic-acid-suffix", "three-carbon-parent", "substituent-locants"], selected: [[1, 2]], reflected: [[1, 2]], comparison: 0 }, stereo: "unspecified-only" } };
}

function parseDiarylaminoAceticAcid(name: string, arylLocant: number, innerSubstituent: string): CompositionalFamilyGraph | null {
  if (arylLocant !== 2) return null;
  const secondSubStart = name.indexOf(innerSubstituent);
  const innerSubs = parseSubs(innerSubstituent, secondSubStart); if (!innerSubs) return null;
  const { graph, atom, bond, ring } = makeBase();
  const acidC = atom(), acidO = atom("O"), acidOH = atom("O"), methylene = atom(), first = ring(), nitrogen = atom("N"), second = ring();
  bond(acidC, acidO, 2); bond(acidC, acidOH); bond(acidC, methylene); bond(methylene, first[0]!);
  bond(first[arylLocant - 1]!, nitrogen); bond(nitrogen, second[0]!);
  const components: NameComponent[] = [], parentStart = name.length - "acetic acid".length;
  addComponent(components, { id: "parent", role: "parent", text: "acetic acid", start: parentStart, end: name.length,
    atomIds: [acidC, acidO, acidOH, methylene], bondIds: [[acidC, acidO], [acidC, acidOH], [acidC, methylene]],
    numbering: [[acidC, 1], [methylene, 2]], numberingScope: "acetic-acid-parent",
    explanation: "The carboxylic acid is the principal group. The acetic-acid parent is numbered from its carboxyl carbon (C1); the aryl substituent is attached at C2.",
    explanationEs: "El ácido carboxílico es la función principal. El padre ácido acético se numera desde el carbono carboxílico (C1); el arilo se une en C2." }, "en");
  addComponent(components, { id: "suffix", role: "suffix", text: "acid", start: name.length - 4, end: name.length,
    parentId: "parent", atomIds: [acidC, acidO, acidOH], bondIds: [[acidC, acidO], [acidC, acidOH]], numbering: [[acidC, 1]],
    explanation: "The carboxyl group supplies the acid suffix.", explanationEs: "El grupo carboxilo aporta el sufijo de ácido." }, "en");
  const firstStart = name.indexOf("[") + 1, firstEnd = name.indexOf("]") + 1;
  addComponent(components, { id: "diarylamino-phenyl", role: "substituent", text: name.slice(firstStart, firstEnd), start: firstStart, end: firstEnd,
    parentId: "parent", locant: 2, atomIds: [...first, nitrogen, ...second],
    bondIds: [...ringBonds(graph, first), ...ringBonds(graph, second), [methylene, first[0]!], [first[arylLocant - 1]!, nitrogen], [nitrogen, second[0]!]],
    numbering: [[methylene, 2], ...first.map((id, i): [number, number] => [id, i + 1]), [nitrogen, "N"], ...second.map((id, i): [number, number] => [id, i + 1])],
    numberingScope: "phenyl-anilino-rings", label: "Anilino-substituted phenyl group", labelEs: "Grupo fenilo sustituido con anilino",
    explanation: `The first phenyl ring attaches to parent C2. Its C${arylLocant} is bonded to the linking nitrogen; the second phenyl ring has its own numbering from N-bound C1.`,
    explanationEs: `El primer anillo fenilo se une al C2 parental. Su C${arylLocant} se enlaza al nitrógeno; el segundo anillo se numera por separado desde C1 unido a N.` }, "en");
  const nStart = name.indexOf("anilino");
  addComponent(components, { id: "linking-nitrogen", role: "prefix", text: "anilino", start: nStart, end: nStart + 7,
    parentId: "diarylamino-phenyl", locant: "N", atomIds: [first[arylLocant - 1]!, nitrogen, second[0]!],
    bondIds: [[first[arylLocant - 1]!, nitrogen], [nitrogen, second[0]!]], numbering: [[nitrogen, "N"]],
    label: "Linking nitrogen", labelEs: "Nitrógeno de unión",
    explanation: "Anilino denotes the phenyl–NH– bridge; its nitrogen is a linking atom, not a ring locant.",
    explanationEs: "Anilino designa el puente fenil–NH–; su nitrógeno es un átomo de unión, no un localizador del anillo." }, "en");
  for (const [i, sub] of innerSubs.entries()) {
    const element = sub.kind === "methyl" ? "C" : sub.kind === "chloro" ? "Cl" : sub.kind === "fluoro" ? "F" : sub.kind === "bromo" ? "Br" : "I";
    const group = atom(element), attached = second[sub.locant - 1]!; bond(attached, group);
    const locantStart = name.indexOf(String(sub.locant), sub.start);
    addComponent(components, { id: `anilino-ring-substituent-${i + 1}`, role: "substituent", text: name.slice(sub.start, sub.end),
      start: sub.start, end: sub.end, parentId: "diarylamino-phenyl", locant: sub.locant,
      atomIds: [attached, group], bondIds: [[attached, group]], numbering: [[attached, sub.locant]], numberingScope: "anilino-phenyl-ring",
      writtenLocants: [{ start: locantStart, end: locantStart + String(sub.locant).length, atomId: attached, locant: sub.locant }],
      label: `${sub.kind} at C${sub.locant} of the anilino ring`, labelEs: `${spanishGroupName(sub.kind)} en C${sub.locant} del anillo anilino`,
      explanation: `The ${sub.kind} group is attached to C${sub.locant} of the anilino phenyl ring; this is an internal ring locant.`,
      explanationEs: `El grupo ${spanishGroupName(sub.kind)} se une al C${sub.locant} del anillo anilino; es un localizador interno del anillo.` }, "en");
  }
  return { graph, components, parent: [acidC, acidO, acidOH, methylene], group: "carboxylicAcid", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language: "en", construction: "retained-aromatic", parentSelection: "retained-functional-parent",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-65.1", "P6"), blueBookRule("P-62.2.1.1.1", "P6"), blueBookRule("P-14.4", "P1")],
      numbering: { scope: "parent", priorities: ["carboxylic-acid-suffix", "acetic-acid-parent", "aryl-substituent-locants"], selected: [[1, 2]], reflected: [[1, 2]], comparison: 0 }, stereo: "unspecified-only" } };
}

function parseNestedAromaticEster(name: string, phenoxyLocant: number, halogenLocant: number,
  halogen: Exclude<RingSub["kind"],"methyl">): CompositionalFamilyGraph {
  const { graph, atom, bond, ring } = makeBase();
  const esterAlkyl = [atom(), atom(), atom()], esterO = atom("O"), carbonyl = atom(), carbonylO = atom("O");
  const alpha = atom(), parentMethyl = atom(), chainMethyl = atom(), etherO = atom("O"), phenoxy = ring();
  const benzoylC = atom(), benzoylO = atom("O"), chlorophenyl = ring(), halogenAtom = atom(halogen === "chloro" ? "Cl" : halogen === "fluoro" ? "F" : halogen === "bromo" ? "Br" : "I");
  bond(esterAlkyl[0]!, esterAlkyl[1]!); bond(esterAlkyl[1]!, esterAlkyl[2]!); bond(esterAlkyl[1]!, esterO);
  bond(esterO, carbonyl); bond(carbonyl, carbonylO, 2); bond(carbonyl, alpha); bond(alpha, parentMethyl); bond(alpha, chainMethyl); bond(alpha, etherO);
  bond(etherO, phenoxy[0]!); bond(phenoxy[phenoxyLocant - 1]!, benzoylC); bond(benzoylC, benzoylO, 2); bond(benzoylC, chlorophenyl[0]!);
  bond(chlorophenyl[halogenLocant - 1]!, halogenAtom);
  const components: NameComponent[] = [];
  const alcoholEnd = "propan-2-yl".length, parentStart = name.indexOf("2-methylpropanoate");
  addComponent(components, { id: "parent", role: "parent", text: "2-methylpropanoate", start: parentStart, end: name.length,
    atomIds: [carbonyl, alpha, chainMethyl], bondIds: [[carbonyl, alpha], [alpha, chainMethyl]],
    numbering: [[carbonyl, 1], [alpha, 2], [chainMethyl, 3]], numberingScope: "propanoate-parent",
    explanation: "The ester is named as an alkyl alkanoate. The acid-derived parent is 2-methylpropanoate, numbered from its carbonyl carbon; the phenoxy group also attaches at C2.",
    explanationEs: "El éster se nombra como alquil alcanoato. El padre derivado del ácido es 2-metilpropanoato, numerado desde el carbono carbonílico; el grupo fenoxi también se une en C2." }, "en");
  addComponent(components, { id: "methyl-at-c2", role: "substituent", text: "2-methyl", start: parentStart, end: parentStart + 8,
    parentId: "parent", locant: 2, atomIds: [alpha, parentMethyl], bondIds: [[alpha, parentMethyl]],
    numbering: [[alpha, 2]], numberingScope: "propanoate-parent",
    writtenLocants: [{ start: parentStart, end: parentStart + 1, atomId: alpha, locant: 2 }],
    label: "Methyl substituent at parent C2", labelEs: "Sustituyente metilo en C2 parental",
    explanation: "The methyl prefix names the additional methyl branch at parent C2. It is separate from the chain's C3 methyl.",
    explanationEs: "El prefijo metil nombra el ramal adicional unido al C2 parental. Es distinto del metilo C3 de la cadena." }, "en");
  const suffixStart = name.indexOf("propanoate");
  addComponent(components, { id: "ester-suffix", role: "suffix", text: "propanoate", start: suffixStart, end: suffixStart + 10,
    parentId: "parent", atomIds: [carbonyl, carbonylO, esterO], bondIds: [[carbonyl, carbonylO], [carbonyl, esterO]], numbering: [[carbonyl, 1]],
    explanation: "The ester group is C(=O)–O. The alcohol-derived alkyl group is named before the acid-derived alkanoate part.",
    explanationEs: "El grupo éster es C(=O)–O. El grupo procedente del alcohol se nombra antes de la parte alcanoato derivada del ácido." }, "en");
  addComponent(components, { id: "propan-2-yl", role: "substituent", text: name.slice(0, alcoholEnd), start: 0, end: alcoholEnd,
    parentId: "ester-suffix", atomIds: [...esterAlkyl], bondIds: [[esterAlkyl[0]!, esterAlkyl[1]!], [esterAlkyl[1]!, esterAlkyl[2]!], [esterAlkyl[1]!, esterO]],
    numbering: esterAlkyl.map((id, i): [number, number] => [id, [1, 2, 3][i]!]), numberingScope: "propan-2-yl-group",
    writtenLocants: [{ start: 7, end: 8, atomId: esterAlkyl[1]!, locant: 2 }],
    label: "Propan-2-yl group from the alcohol", labelEs: "Grupo propan-2-ilo procedente del alcohol",
    explanation: "The ester oxygen is bonded to C2 of the three-carbon propan-2-yl group. This is the alcohol-derived side of the ester.",
    explanationEs: "El oxígeno del éster se une al C2 del grupo propan-2-ilo de tres carbonos. Esta es la parte del éster procedente del alcohol." }, "en");
  const branchStart = name.indexOf("2-["), branchEnd = name.indexOf("]", branchStart) + 1;
  addComponent(components, { id: "phenoxy-at-c2", role: "substituent", text: name.slice(branchStart, branchEnd), start: branchStart, end: branchEnd,
    parentId: "parent", locant: 2, atomIds: [alpha, etherO, ...phenoxy, benzoylC, benzoylO, ...chlorophenyl, halogenAtom],
    bondIds: [[alpha, etherO], [etherO, phenoxy[0]!], ...ringBonds(graph, phenoxy), [phenoxy[phenoxyLocant - 1]!, benzoylC], [benzoylC, benzoylO], [benzoylC, chlorophenyl[0]!], ...ringBonds(graph, chlorophenyl), [chlorophenyl[halogenLocant - 1]!, halogenAtom]],
    numbering: [[alpha, 2], [etherO, "O"], ...phenoxy.map((id, i): [number, number] => [id, i + 1])], numberingScope: "phenoxy-ring",
    writtenLocants: [{ start: branchStart, end: branchStart + 1, atomId: alpha, locant: 2 },
      { start: name.indexOf(`${phenoxyLocant}-(`, branchStart), end: name.indexOf(`${phenoxyLocant}-(`, branchStart) + 1,
        atomId: phenoxy[phenoxyLocant - 1]!, locant: phenoxyLocant }],
    label: `${phenoxyLocant}-(${halogenLocant}-${halogen}benzoyl)phenoxy group`, labelEs: `Grupo ${phenoxyLocant}-(${halogenLocant}-${spanishGroupName(halogen)}benzoilo)fenoxi`,
    explanation: "This phenoxy substituent attaches to parent C2 through oxygen.",
    explanationEs: "Este sustituyente fenoxi se une al C2 parental mediante oxígeno." }, "en");
  const halogenatedBenzoyl = `${halogenLocant}-${halogen}benzoyl`, benzoylStart = name.indexOf(halogenatedBenzoyl),
    carbonylWordStart = name.indexOf("benzoyl", benzoylStart), benzoylTextLength = halogenatedBenzoyl.length;
  addComponent(components, { id: "benzoyl", role: "prefix", text: halogenatedBenzoyl, start: benzoylStart, end: benzoylStart + benzoylTextLength,
    parentId: "phenoxy-at-c2", locant: phenoxyLocant, atomIds: [phenoxy[phenoxyLocant - 1]!, benzoylC, benzoylO, ...chlorophenyl, halogenAtom],
    bondIds: [[phenoxy[phenoxyLocant - 1]!, benzoylC], [benzoylC, benzoylO], [benzoylC, chlorophenyl[0]!], ...ringBonds(graph, chlorophenyl), [chlorophenyl[halogenLocant - 1]!, halogenAtom]],
    numbering: [[phenoxy[phenoxyLocant - 1]!, phenoxyLocant], [benzoylC, 1], ...chlorophenyl.map((id, i): [number, number] => [id, i + 1])], numberingScope: "benzoyl-group",
    label: halogenatedBenzoyl, labelEs: `${halogenLocant}-${spanishGroupName(halogen)}benzoilo`,
    explanation: `The ${halogen} locant belongs to the phenyl ring inside benzoyl and is counted from its carbonyl attachment.`,
    explanationEs: `El localizador del ${spanishGroupName(halogen)} pertenece al anillo fenilo del benzoilo y se cuenta desde su unión al carbonilo.` }, "en");
  const phenoxyStart = name.indexOf("phenoxy", branchStart), benzoylRingStart = carbonylWordStart;
  addComponent(components, { id: "phenoxy-ring", role: "prefix", text: "phenoxy", start: phenoxyStart, end: phenoxyStart + 7,
    parentId: "phenoxy-at-c2", atomIds: [etherO, ...phenoxy], bondIds: [[alpha, etherO], [etherO, phenoxy[0]!], ...ringBonds(graph, phenoxy)],
    numbering: [[etherO, "O"], ...phenoxy.map((id, i): [number, number] => [id, i + 1])], numberingScope: "phenoxy-ring",
    label: "Phenoxy ring and oxygen linker", labelEs: "Anillo fenoxi y enlace de oxígeno",
    explanation: "The phenoxy ring starts at C1, the carbon bonded to O; its numbering is independent of the benzoyl ring.",
    explanationEs: "El anillo fenoxi comienza en C1, el carbono enlazado a O; su numeración es independiente de la del anillo benzoilo." }, "en");
  addComponent(components, { id: "chlorophenyl-ring", role: "prefix", text: "benzoyl", start: benzoylRingStart, end: benzoylRingStart + 7,
    parentId: "benzoyl", atomIds: [benzoylC, ...chlorophenyl], bondIds: [[benzoylC, chlorophenyl[0]!], ...ringBonds(graph, chlorophenyl)],
    numbering: [[benzoylC, 1], ...chlorophenyl.map((id, i): [number, number] => [id, i + 1])], numberingScope: "chlorophenyl-ring",
    label: "Second aromatic ring of benzoyl", labelEs: "Segundo anillo aromático del benzoilo",
    explanation: "This is the phenyl ring within benzoyl; its C1 is bonded to the carbonyl carbon.",
    explanationEs: "Este es el anillo fenilo del benzoilo; su C1 está unido al carbono carbonílico." }, "en");
  addComponent(components, { id: "benzoyl-carbonyl", role: "prefix", text: "benzoyl", start: carbonylWordStart, end: carbonylWordStart + 7,
    parentId: "benzoyl", atomIds: [benzoylC, benzoylO], bondIds: [[benzoylC, benzoylO]], numbering: [[benzoylC, 1]],
    label: "Benzoyl carbonyl", labelEs: "Carbonilo del benzoilo",
    explanation: "This carbonyl is part of benzoyl; it separates benzoyl from benzyl and phenyl.",
    explanationEs: "Este carbonilo forma parte del benzoilo y lo distingue de bencilo y fenilo." }, "en");
  addComponent(components, { id: "halogen", role: "prefix", text: halogen, start: benzoylStart + 2, end: benzoylStart + 2 + halogen.length,
    parentId: "benzoyl", locant: halogenLocant, atomIds: [chlorophenyl[halogenLocant - 1]!, halogenAtom],
    bondIds: [[chlorophenyl[halogenLocant - 1]!, halogenAtom]],
    numbering: [[chlorophenyl[halogenLocant - 1]!, halogenLocant]], numberingScope: "chlorophenyl-ring",
    writtenLocants: [{ start: benzoylStart, end: benzoylStart + 1, atomId: chlorophenyl[halogenLocant - 1]!, locant: halogenLocant }],
    label: `${halogen} substituent on the benzoyl phenyl ring`, labelEs: `Sustituyente ${spanishGroupName(halogen)} del anillo fenilo del benzoilo`,
    explanation: `The ${halogen} is at C${halogenLocant} of this ring; the locant is internal to the benzoyl phenyl ring.`,
    explanationEs: `El ${spanishGroupName(halogen)} está en C${halogenLocant} de este anillo; el localizador es interno al anillo fenilo del benzoilo.` }, "en");
  return { graph, components, parent: [carbonyl, alpha, chainMethyl], group: "ester", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language: "en", construction: "aromatic-ester", parentSelection: "acyclic-chain",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-65.6.3", "P6"), blueBookRule("P-59.2.1.4", "P5"), blueBookRule("P-14.4", "P1")],
      numbering: { scope: "parent", priorities: ["ester-parent", "acid-derived-chain", "substituent-locants"], selected: [[1, 2, 2, phenoxyLocant, halogenLocant]], reflected: [[1, 2, 2, phenoxyLocant, halogenLocant]], comparison: 0 }, stereo: "unspecified-only" } };
}
