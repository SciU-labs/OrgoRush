import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { blueBookRule, type CompositionalFamilyGraph, type NameComponent, type PrincipalGroup } from "./compositional-name-model.ts";

type Language = "en" | "es";

/** Names with simple independent benzene rings joined through a supported O/N. */
export function parseIndependentAromaticLink(name: string): CompositionalFamilyGraph | null {
  const phenoxy = name === "phenoxybenzene" ? { language: "en" as const, prefix: "phenoxy", parent: "benzene" }
    : name === "fenoxibenceno" ? { language: "es" as const, prefix: "fenoxi", parent: "benceno" } : null;
  if (phenoxy) return phenoxybenzene(name, phenoxy.language, phenoxy.prefix, phenoxy.parent);

  const match = /^(N(?:,N)?)-(di)?phenyl(benzenamine|aniline)$/.exec(name);
  if (match) {
    if (match[1] === "N,N" && !match[2] || match[1] === "N" && match[2]) return null;
    return arylamine(name, "en", match[1] === "N,N" ? 2 : 1, match[3]);
  }
  const spanishMatch = /^(N(?:,N)?)-(di)?fenil(bencenamina|anilina)$/.exec(name);
  if (spanishMatch) {
    if (spanishMatch[1] === "N,N" && !spanishMatch[2] || spanishMatch[1] === "N" && spanishMatch[2]) return null;
    return arylamine(name, "es", spanishMatch[1] === "N,N" ? 2 : 1, spanishMatch[3]);
  }
  return null;
}

function baseGraph() {
  const graph: GeneratedMolecule = { atoms: [], bonds: [] };
  const atom = (element: "C" | "O" | "N") => { const id = graph.atoms.length + 1; graph.atoms.push({ id, element, x: 0, y: 0 }); return id; };
  const ring = () => {
    const ids = Array.from({ length: 6 }, () => atom("C"));
    ids.forEach((id, index) => graph.bonds.push([id, ids[(index + 1) % 6]!, index % 2 ? 1 : 2]));
    return ids;
  };
  return { graph, atom, ring };
}

function phenoxybenzene(name: string, language: Language, prefix: string, parentText: string): CompositionalFamilyGraph {
  const { graph, atom, ring } = baseGraph();
  const parent = ring(), oxygen = atom("O"), phenyl = ring();
  graph.bonds.push([parent[0]!, oxygen, 1], [oxygen, phenyl[0]!, 1]);
  const prefixStart = 0, parentStart = prefix.length;
  const components: NameComponent[] = [
    { id: "parent", role: "parent", text: parentText, start: parentStart, end: parentStart + parentText.length, atomIds: parent,
      bondIds: graph.bonds.filter(([a,b]) => parent.includes(a) && parent.includes(b)).map(([a,b]):[number,number] => [a,b]),
      numbering: parent.map((id,index) => [id,index+1]), language, numberingScope: "parent",
      explanation: "Benzene is the parent ring. With one substituent, its attachment is C1 by convention; the second benzene ring is cited as phenoxy.",
      explanationEs: "El benceno es el anillo principal. Al tener un solo sustituyente, su punto de unión es C1 por convención; el segundo anillo se expresa como fenoxi.",
      writtenLocants: [] },
    { id: "phenoxy", role: "substituent", text: prefix, start: prefixStart, end: prefixStart + prefix.length, parentId: "parent",
      atomIds: [oxygen, ...phenyl], bondIds: [[parent[0]!,oxygen],[oxygen,phenyl[0]!], ...graph.bonds.filter(([a,b]) => phenyl.includes(a) && phenyl.includes(b)).map(([a,b]):[number,number] => [a,b])],
      numbering: [[parent[0]!,1],[phenyl[0]!,1]], language, numberingScope: "phenoxy-ring", citationKey: prefix,
      explanation: "Phenoxy contains a phenyl ring attached through oxygen; that oxygen links C1 of phenyl to C1 of the benzene parent.",
      explanationEs: "El grupo fenoxi contiene un anillo fenilo unido por oxígeno; ese oxígeno conecta C1 del fenilo con C1 del benceno principal.",
      label: "Phenoxy substituent", labelEs: "Sustituyente fenoxi" },
  ];
  return { graph, components, parent, group: "none", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "independent-ring-substitution", parentSelection: "aromatic-parent",
      rules: [blueBookRule("P-44.1.2.2", "P4"), blueBookRule("P-59.1.3", "P5")],
      numbering: { scope: "parent", priorities: ["ring-parent", "single-substituent-origin"], selected: [[1]], reflected: [[1]], comparison: 0 }, stereo: "unspecified-only" } };
}

function arylamine(name: string, language: Language, substituentCount: number, parentText: string): CompositionalFamilyGraph {
  const { graph, atom, ring } = baseGraph();
  const parent = ring(), nitrogen = atom("N");
  graph.bonds.push([parent[0]!, nitrogen, 1]);
  const phenylRings = Array.from({ length: substituentCount }, () => ring());
  for (const phenyl of phenylRings) graph.bonds.push([nitrogen, phenyl[0]!, 1]);
  const nameStart = name.indexOf(parentText), parentStart = nameStart;
  const prefixEnd = parentStart, prefixStart = 0;
  const prefixText = name.slice(prefixStart, prefixEnd);
  const suffixStart = name.length - (language === "en" ? "amine" : "amina").length;
  const components: NameComponent[] = [
    { id: "parent", role: "parent", text: parentText, start: parentStart, end: parentStart + parentText.length, atomIds: parent,
      bondIds: graph.bonds.filter(([a,b]) => parent.includes(a) && parent.includes(b)).map(([a,b]):[number,number] => [a,b]),
      numbering: parent.map((id,index) => [id,index+1]), language, numberingScope: "parent",
      explanation: "The benzene ring bearing the amine is the parent. The nitrogen attached to ring C1 supplies the amine suffix or is included in the retained aniline parent.",
      explanationEs: "El anillo de benceno que lleva la amina es la estructura principal. El nitrógeno unido a C1 aporta el sufijo amina o forma parte del nombre retenido anilina." },
    { id: "amine", role: "suffix", text: /anilin[ae]$/.test(parentText) ? parentText : language === "en" ? "amine" : "amina",
      start: /anilin[ae]$/.test(parentText) ? parentStart : suffixStart, end: /anilin[ae]$/.test(parentText) ? parentStart + parentText.length : name.length,
      atomIds: [nitrogen], bondIds: [[parent[0]!, nitrogen]], numbering: [[parent[0]!,1]], parentId: "parent", language,
      label: "Amine group", labelEs: "Grupo amina",
      explanation: "The nitrogen bonded to the parent ring is the amine center; its other N–C bonds determine N-substitution.",
      explanationEs: "El nitrógeno unido al anillo principal es el centro de la amina; sus otros enlaces N–C determinan la sustitución en N." },
  ];
  components.push({ id: "n-aryl-substitution", role: "prefix", text: prefixText, start: prefixStart, end: prefixEnd,
    parentId: "amine", atomIds: [nitrogen, ...phenylRings.flat()],
    bondIds: graph.bonds.filter(([a,b]) => phenylRings.some(phenyl => phenyl.includes(a) && phenyl.includes(b))
      || a === nitrogen && phenylRings.some(phenyl => phenyl.includes(b))
      || b === nitrogen && phenylRings.some(phenyl => phenyl.includes(a))).map(([a,b]):[number,number] => [a,b]),
    numbering: [[nitrogen,"N"]], locant: "N", language,
    explanation: substituentCount === 1 ? "N- places one phenyl substituent on the amine nitrogen." : "N,N- places two phenyl substituents on the same amine nitrogen.",
    explanationEs: substituentCount === 1 ? "N- sitúa un sustituyente fenilo en el nitrógeno de la amina." : "N,N- sitúa dos sustituyentes fenilo en el mismo nitrógeno de la amina.",
    label: substituentCount > 1 ? `Two phenyl groups at N (×${substituentCount})` : "Phenyl group at N",
    labelEs: substituentCount > 1 ? `Dos grupos fenilo en N (×${substituentCount})` : "Grupo fenilo en N" });
  for (const [index, phenyl] of phenylRings.entries()) {
    const wordStart = name.indexOf(language === "en" ? "phenyl" : "fenil", prefixStart);
    const word = language === "en" ? "phenyl" : "fenil";
    const occurrenceStart = wordStart >= 0 ? wordStart : prefixStart;
    components.push({ id: `n-phenyl-${index+1}`, role: "prefix", text: word, start: occurrenceStart, end: occurrenceStart + word.length,
      parentId: "amine", atomIds: phenyl,
      bondIds: [...graph.bonds.filter(([a,b]) => phenyl.includes(a) && phenyl.includes(b)).map(([a,b]):[number,number] => [a,b]), [nitrogen,phenyl[0]!] as [number,number]],
      numbering: [[phenyl[0]!,1]], language, numberingScope: `N-phenyl-${index+1}`,
      locant: "N",
      ...(substituentCount > 1 ? { mappingGroup: "equivalent-n-phenyl-occurrences" } : {}),
      explanation: "This phenyl ring is attached directly to the amine nitrogen, so its substituent locant is N rather than a carbon position on the parent ring.",
      explanationEs: "Este anillo fenilo está unido directamente al nitrógeno de la amina; por eso su localizador es N y no una posición de carbono del anillo principal.",
      label: substituentCount > 1 ? `Phenyl group at N · ${index+1}` : undefined,
      labelEs: substituentCount > 1 ? `Grupo fenilo en N · ${index+1}` : undefined });
  }
  return { graph, components, parent, group: "amine" as PrincipalGroup, allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "aromatic-amine", parentSelection: "aromatic-parent",
      rules: [blueBookRule("P-41", "P4"), blueBookRule("P-44.1.1", "P4"), blueBookRule("P-44.2.1", "P4"), blueBookRule("P-59.1.3", "P5")],
      numbering: { scope: "parent", priorities: ["maximum-suffix-groups", "benzene-ring-locants", "N-substitution"], selected: [[1]], reflected: [[1]], comparison: 0 }, stereo: "unspecified-only" } };
}
