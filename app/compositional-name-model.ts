import type { GeneratedMolecule } from "./name-to-molecule.ts";

export type PrincipalGroup = "none" | "carboxylicAcid" | "amide" | "ester" | "aldehyde" | "ketone"
  | "alcohol" | "amine" | "nitrile" | "heterocycle";

export type NameComponent = {
  id: string;
  role: "parent" | "suffix" | "substituent" | "prefix" | "unsaturation";
  text: string;
  start: number;
  end: number;
  parentId?: string;
  attachmentScope?: "ring" | "amide-nitrogen";
  /** Equivalent named branches share one written multiplicative prefix. */
  equivalenceGroup?: string;
  /** The union has a unique image. Individual occurrences follow the same
   * representative numbering, even when its direction is interchangeable. */
  mappingGroup?: string;
  externalMultiplier?: string;
  citationKey?: string;
  attachmentBonds?: [number,number][];
  nLocantStarts?: number[];
  locant?: number | "N";
  atomIds: number[];
  bondIds: [number, number][];
  numbering: [number, number | string][];
  explanation: string;
  explanationEs?: string;
  label?: string;
  labelEs?: string;
  language?: "es" | "en";
  numberingScope?: string;
  /** Never merged with parent numbering: C1 of a branch is a different scope. */
  internalNumbering?: [number, number][];
  writtenLocants?: {start:number;end:number;atomId:number;locant:number}[];
};

/** Independent name interpretation, before any access to the input molecule.
 * Chemical decisions are shared by ES/EN; only literal spans are linguistic. */
export type NameRuleEvidence = {
  source: "active-name";
  profile?: "current";
  language: "es" | "en";
  construction: "retained-aromatic" | "aromatic-ester" | "functional-monocycle" | "acyclic-aryl-amine" | "substituted-alkanamide" | "aminoalkyl-benzenediol" | "polycarboxylic-acid" | "multifunctional-alcohol" | "polysubstituted-benzene-prefixes" | "benzene-ring-assembly" | "independent-ring-substitution" | "aromatic-amine" | "carbon-linked-aromatic" | "functional-biaryl" | "aromatic-alkene" | "aryl-cycloalkane" | "functional-cycloaryl" | "fused-naphthalene" | "fused-tricyclic-arene";
  rules: { id: string; source: string }[];
  parentSelection: "retained-functional-parent" | "sole-suffix-bearing-cycle" | "amine-longest-n-attached-chain" | "acyl-chain" | "polyacid-backbone" | "hydroxyl-bearing-parent" | "unfunctionalized-benzene" | "ring-assembly" | "aromatic-parent" | "acyclic-chain" | "functionalized-ring";
  numbering: {
    scope: "parent";
    priorities: string[];
    selected: number[][];
    reflected: number[][];
    comparison: number;
  };
  stereo: "unspecified-only" | "specified-tetrahedral" | "specified-geometric" | "specified-tetrahedral-and-geometric";
};

export type CompositionalFamilyGraph = {
  graph: GeneratedMolecule;
  components: NameComponent[];
  parent: number[];
  group: PrincipalGroup;
  equivalentParentPaths?: number[][];
  allowEquivalentNumbering?: boolean;
  parentSystem?: "purine";
  evidence?: NameRuleEvidence;
};

export type ValidatedCompositionalEvidence = NameRuleEvidence & {
  reconstructedGraph: GeneratedMolecule;
  atomMapping: [number, number][];
  equivalence: "complete-graph-isomorphism";
};

export function compareLocantSequences(left: readonly number[], right: readonly number[]): number {
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? -1) - (right[i] ?? -1);
    if (difference) return difference;
  }
  return 0;
}

/** Without a suffix-fixed origin every rotation and reflection is admissible.
 * Citation order is already linguistic/alphabetical when this function runs. */
export function isLowestFreeRingNumbering(size: number, positions: readonly number[]): boolean {
  const score=(values:readonly number[])=>[...values].sort((a,b)=>a-b).concat([...values]);
  const selected=score(positions);
  for(let origin=0;origin<size;origin++)for(const direction of [1,-1]) {
    const alternate=positions.map(n=>((direction*(n-1-origin))%size+size)%size+1);
    if(compareLocantSequences(selected,score(alternate))>0)return false;
  }
  return true;
}

/** Suffix origin is fixed at C1. Unsaturation precedes the set of detachable
 * prefixes, then their citation order breaks a remaining numbering tie. */
export function proveMonocycleNumbering(size: number, positions: readonly (readonly number[])[], doubleLocants: readonly number[] = []) {
  const reflect = (n: number) => n === 1 ? 1 : size + 2 - n;
  const ascending = (values: readonly number[]) => [...values].sort((a, b) => a - b);
  const selected = [[1], ascending(doubleLocants), ascending(positions.flat()), ...positions.map(ascending)];
  const reflected = [[1], ascending(doubleLocants.map(n => size + 1 - n)),
    ascending(positions.flat().map(reflect)), ...positions.map(values => ascending(values.map(reflect)))];
  let comparison = 0;
  for (let i = 0; i < selected.length && !comparison; i++) comparison = compareLocantSequences(selected[i], reflected[i]);
  return { scope: "parent" as const, priorities: ["suffix", "unsaturation", "prefix-set", "prefix-citation-order"],
    selected, reflected, comparison };
}

export function blueBookRule(id: string, chapter: "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P6a") {
  return { id, source: `https://iupac.qmul.ac.uk/BlueBook/${chapter}.html#${id.replace(/[-.]/g, "")}` };
}

/** Ignore an external multiplier, but keep the complete name of a compound
 * prefix (including its internal di- or tri-) when comparing citation keys. */
export function substitutiveCitationKey(text: string): string {
  return text.replace(/^N,N-di/, "").replace(/^(?:N|[0-9]+)-/, "").replace(/[^a-z]/gi, "").toLowerCase();
}

export function spanishSubstitutiveName(components: NameComponent[]): string | null {
  const parent = components.find(c => c.role === "parent");
  const roots = components.filter(c => c.role === "substituent" && c.parentId === "parent");
  if (!parent || !roots.length) return null;
  const morphemes: Record<string,string> = {phenyl:"fenil",phenoxy:"fenoxi",meth:"met",eth:"et",yl:"il",oxy:"oxi",
    chloro:"cloro",iodo:"yodo",amine:"amina",amide:"amida",benzene:"benceno",hydroxy:"hidroxi"};
  const translate = (text: string) => text.replace(/phenyl|phenoxy|meth|eth|yl|oxy|chloro|iodo|amine|amide|benzene|hydroxy/g, word => morphemes[word]);
  return roots.map(c => translate(c.text)).sort((a,b) => substitutiveCitationKey(a).localeCompare(substitutiveCitationKey(b),"es"))
    .join("-") + translate(parent.text);
}
