import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { blueBookRule, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";

const assemblies = new Map([["biphenyl", 2], ["terphenyl", 3], ["quaterphenyl", 4], ["quinquephenyl", 5], ["sexiphenyl", 6]]);
const spanish: Record<string, string> = { biphenyl: "bifenilo", terphenyl: "terfenilo", quaterphenyl: "quaterfenilo", quinquephenyl: "quinquefenilo", sexiphenyl: "sexifenilo" };

/** Translate only the established unbranched ring-assembly parent term. */
export function localizeBenzeneRingAssemblyName(name: string): string | null {
  for (const [english, localized] of Object.entries(spanish)) {
    if (name.endsWith(english)) return `${name.slice(0, -english.length)}${localized}`;
  }
  return null;
}

type Attachment = { ring: number; locant: number; start: number; end: number };

/**
 * Interprets the unbranched assemblies of identical benzene rings described
 * in Blue Book P-28. It deliberately excludes fused, bridged, spiro, and
 * branched assemblies. Every ring is numbered independently from its first
 * assembly bond; the attachment locants are checked before graph generation.
 */
export function parseBenzeneRingAssembly(name: string): CompositionalFamilyGraph | null {
  const suffix = [...assemblies].find(([en]) => name.endsWith(en) || name.endsWith(spanish[en]!));
  if (!suffix) return null;
  const [englishRoot, ringCount] = suffix;
  const localizedRoot = name.endsWith(englishRoot) ? englishRoot : spanish[englishRoot]!;
  const language = localizedRoot === englishRoot ? "en" : "es";
  const source = name.slice(0, -localizedRoot.length).replace(/-$/, "");
  if (!source) return null;

  // Each colon-separated item is one assembly bond: locant on ring i,
  // followed by the primed locant on ring i+1.
  const pairPattern = /^([1-6])('*),([1-6])('*$)/;
  const pairs: { left: Attachment; right: Attachment }[] = [];
  let descriptorStart = 0;
  for (const descriptor of source.split(":")) {
    const match = pairPattern.exec(descriptor);
    if (!match) return null;
    const leftRing = match[2]!.length, rightRing = match[4]!.length;
    if (rightRing !== leftRing + 1 || rightRing >= ringCount) return null;
    const comma = descriptor.indexOf(",");
    pairs.push({ left: { ring: leftRing, locant: Number(match[1]), start: descriptorStart, end: descriptorStart + 1 },
      right: { ring: rightRing, locant: Number(match[3]), start: descriptorStart + comma + 1, end: descriptorStart + descriptor.length } });
    descriptorStart += descriptor.length + 1;
  }
  if (pairs.length !== ringCount - 1) return null;
  for (let index = 0; index < pairs.length; index++) {
    if (pairs[index]!.left.ring !== index || pairs[index]!.right.ring !== index + 1) return null;
  }

  const locantsByRing = Array.from({ length: ringCount }, () => [] as number[]);
  for (const pair of pairs) {
    locantsByRing[pair.left.ring]!.push(pair.left.locant);
    locantsByRing[pair.right.ring]!.push(pair.right.locant);
  }
  for (const locants of locantsByRing) {
    if (new Set(locants).size !== locants.length || locants.length > 2) return null;
    if (locants.length === 1 && locants[0] !== 1) return null;
    if (locants.length === 2) {
      if (!locants.includes(1)) return null;
      const other = locants.find(value => value !== 1)!;
      if (other < 2 || other > 4) return null;
    }
  }

  // A linear assembly can be read from either end. Select the lower cited
  // locant sequence; this is the only assembly-level orientation choice in
  // this deliberately narrow, unsubstituted grammar.
  const forward = pairs.flatMap(pair => [pair.left.locant, pair.right.locant]);
  const reverse = [...pairs].reverse().flatMap(pair => [pair.right.locant, pair.left.locant]);
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const difference = (a[i] ?? -1) - (b[i] ?? -1);
      if (difference) return difference;
    }
    return 0;
  };
  if (compare(forward, reverse) > 0) return null;

  const graph: GeneratedMolecule = { atoms: [], bonds: [] };
  const rings = Array.from({ length: ringCount }, () => {
    const ids = Array.from({ length: 6 }, () => {
      const id = graph.atoms.length + 1;
      graph.atoms.push({ id, element: "C", x: 0, y: 0 });
      return id;
    });
    ids.forEach((id, index) => graph.bonds.push([id, ids[(index + 1) % 6]!, index % 2 ? 1 : 2]));
    return ids;
  });
  for (const pair of pairs) graph.bonds.push([rings[pair.left.ring]![pair.left.locant - 1]!, rings[pair.right.ring]![pair.right.locant - 1]!, 1]);
  const atomIds = rings.flat();
  const numbering = rings.flatMap((ring, index) => ring.map((id, locant) => [id, `${locant + 1}${"'".repeat(index)}`] as [number, string]));
  const components: NameComponent[] = [{
    id: "parent-assembly", role: "parent", text: name, start: 0, end: name.length, atomIds,
    bondIds: graph.bonds.map(([a, b]) => [a, b]), numbering, language,
    explanation: `The parent is an unbranched assembly of ${ringCount} benzene rings joined by direct C–C bonds. Each ring is numbered independently from its assembly attachment; primes distinguish the rings. The written locants specify every inter-ring bond (Blue Book P-28).`,
    explanationEs: `La estructura principal es un conjunto lineal de ${ringCount} anillos de benceno unidos directamente por enlaces C–C. Cada anillo se numera desde su punto de unión al conjunto; las primas distinguen los anillos. Los localizadores escritos especifican cada enlace entre anillos (Blue Book P-28).`,
    label: `${ringCount} directly linked benzene rings`, labelEs: `${ringCount} anillos de benceno unidos directamente`,
  }];
  pairs.forEach((pair, index) => {
    const left = rings[pair.left.ring]![pair.left.locant - 1]!, right = rings[pair.right.ring]![pair.right.locant - 1]!;
    const spanStart = pair.left.start, spanEnd = pair.right.end;
    components.push({ id: `assembly-link-${index+1}`, role: "prefix", text: name.slice(spanStart, spanEnd), start: spanStart, end: spanEnd,
      parentId: "parent-assembly", atomIds: [left, right], bondIds: [[left,right]],
      numbering: [[left,`${pair.left.locant}${"'".repeat(pair.left.ring)}`],[right,`${pair.right.locant}${"'".repeat(pair.right.ring)}`]],
      writtenLocants: [{ start: pair.left.start, end: pair.left.end, atomId: left, locant: pair.left.locant },
        { start: pair.right.start, end: pair.right.end, atomId: right, locant: pair.right.locant }],
      language, numberingScope: `ring-assembly-${index+1}`,
      explanation: `This locant pair identifies the direct C${pair.left.locant}–C${pair.right.locant} bond between benzene rings ${pair.left.ring+1} and ${pair.right.ring+1}.`,
      explanationEs: `Este par de localizadores identifica el enlace directo C${pair.left.locant}–C${pair.right.locant} entre los anillos de benceno ${pair.left.ring+1} y ${pair.right.ring+1}.`,
      label: `Ring ${pair.left.ring+1}–${pair.right.ring+1} connection`, labelEs: `Unión entre anillos ${pair.left.ring+1}–${pair.right.ring+1}` });
  });
  const construction = "benzene-ring-assembly" as const;
  return { graph, components, parent: atomIds, group: "none", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction, parentSelection: "ring-assembly",
      rules: [blueBookRule("P-28.2.1", "P2"), ...(ringCount >= 3 ? [blueBookRule("P-28.3.2", "P2")] : []), blueBookRule("P-44.2.2.2.7", "P4"), blueBookRule("P-59.1.3", "P5")],
      numbering: { scope: "parent", priorities: ["assembly-connectivity", "ring-attachment-locants", "lower-cited-locant-sequence"], selected: [forward], reflected: [reverse], comparison: compare(forward, reverse) },
      stereo: "unspecified-only" } };
}
