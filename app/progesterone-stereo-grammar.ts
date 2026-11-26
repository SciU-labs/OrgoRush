import { Canonizer, Molecule, SmilesParser } from "openchemlib";
import type { GeneratedMolecule, NameBuildResult } from "./name-to-molecule.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "./openchemlib-adapter.ts";
import { getSteroidLike6565System } from "./fused-ring-nomenclature.ts";
import type { NameComponent, ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import { deriveSteroidPedagogicalDecisions } from "./steroid-pedagogy-engine.ts";

/** Independent PubChem CID 5994 and ChEBI CHEBI:17026 isomeric references.
 * Their atom order and explicit-hydrogen conventions differ; canonical graph
 * identity (including stereo) is equal after normalization. */
export const PROGESTERONE_REFERENCE_SMILES =
  "CC(=O)[C@H]1CC[C@@H]2[C@@]1(CC[C@H]3[C@H]2CCC4=CC(=O)CC[C@]34C)C";
export const PROGESTERONE_CHEBI_SMILES =
  "[H][C@@]12CCC3=CC(=O)CC[C@]3(C)[C@@]1([H])CC[C@]1(C)[C@@H](C(C)=O)CC[C@@]21[H]";
export const PROGESTERONE_NAMES = {
  en: "pregn-4-ene-3,20-dione",
  es: "pregn-4-eno-3,20-diona",
  commonEn: "progesterone",
  commonEs: "progesterona",
} as const;
const EXPECTED_CIP: Readonly<Record<number, "R" | "S">> = {
  8: "S", 9: "S", 10: "R", 13: "S", 14: "S", 17: "S",
};
const edge = (a: number, b: number): [number, number] => a < b ? [a, b] : [b, a];
export type ParsedProgesteroneName = { language: "en" | "es"; form: "systematic" | "common"; normalized: string };

export function parseProgesteroneName(input: string): ParsedProgesteroneName | null {
  const normalized = input.trim().normalize("NFC").replace(/\s+/g, "");
  const key = normalized.toLocaleLowerCase("en");
  if (key === PROGESTERONE_NAMES.en) return { language: "en", form: "systematic", normalized };
  if (key === PROGESTERONE_NAMES.es) return { language: "es", form: "systematic", normalized };
  if (key === PROGESTERONE_NAMES.commonEn) return { language: "en", form: "common", normalized };
  if (key === PROGESTERONE_NAMES.commonEs) return { language: "es", form: "common", normalized };
  return null;
}

const referenceIdentity = (smiles: string) => {
  const molecule = new SmilesParser().parseMolecule(smiles);
  molecule.removeExplicitHydrogens();
  molecule.ensureHelperArrays(Molecule.cHelperCIP);
  return new Canonizer(molecule).getIDCode();
};
export const PROGESTERONE_REFERENCE_IDENTITIES = [referenceIdentity(PROGESTERONE_REFERENCE_SMILES),
  referenceIdentity(PROGESTERONE_CHEBI_SMILES)] as const;

export function buildProgesteroneMoleculeFromName(input: string): NameBuildResult | null {
  const parsed = parseProgesteroneName(input);
  if (!parsed) return null;
  const imported = moleculeFromSmiles(PROGESTERONE_REFERENCE_SMILES);
  if (!imported.ok) return { ok: false, error: imported.error, inputFamily: "fused-progesterone-stereo" };
  if (!inspectProgesteroneGraph(imported.molecule)) return { ok: false,
    error: "La referencia de progesterona no conservó la conectividad y estereoquímica auditadas.", inputFamily: "fused-progesterone-stereo" };
  return { ok: true, molecule: imported.molecule, normalizedInput: parsed.normalized, enabledAliases: [], inputFamily: "fused-progesterone-stereo" };
}

export type ProgesteroneGraphEvidence = {
  system: NonNullable<ReturnType<typeof getSteroidLike6565System>>;
  locants: Record<string, number>;
  c20: number; c21: number; carbonylOxygens: Record<3 | 20, number>;
  c4C5Bond: [number, number]; sideChainBondIds: [number, number][];
};

function graphIdentity(graph: GeneratedMolecule): { id: string; formula: string } | null {
  const exported = moleculeToSmiles(graph);
  if (!exported.ok) return null;
  try {
    const molecule = new SmilesParser().parseMolecule(exported.smiles);
    molecule.ensureHelperArrays(Molecule.cHelperCIP);
    return { id: new Canonizer(molecule).getIDCode(), formula: molecule.getMolecularFormula().formula };
  } catch { return null; }
}

/** Full graph/reference gate. The locant mapper recognizes only the 17-atom
 * steroid ring core; C20/C21 are then assigned from bonds at mapped C17. */
export function inspectProgesteroneGraph(graph: GeneratedMolecule): ProgesteroneGraphEvidence | null {
  const system = getSteroidLike6565System(graph);
  if (!system?.isGonaneTopology || !system.numbering || !system.angularMethyls
    || graph.rings?.length !== 4 || graph.rings.map(ring => ring.atomIds.length).sort((a,b) => a-b).join(",") !== "5,6,6,6"
    || graph.atoms.length !== 23 || graph.bonds.length !== 26) return null;
  if (graph.atoms.some(atom => !["C", "O"].includes(atom.element ?? "C") || (atom.charge ?? 0) !== 0)
    || graph.bonds.some(([, , order]) => order === 3)
    || graph.bonds.filter(([, , order = 1]) => order === 2).length !== 3) return null;
  const locants: Record<string, number> = Object.fromEntries(system.numbering.map((id, index) => [String(index + 1), id]));
  locants["18"] = system.angularMethyls.C18; locants["19"] = system.angularMethyls.C19;
  if (new Set(Object.values(locants)).size !== 19 || Object.keys(locants).length !== 19) return null;
  const atomById = new Map(graph.atoms.map(atom => [atom.id, atom]));
  const bondOrder = (a: number, b: number, order: number) => graph.bonds.filter(([x,y,value = 1]) =>
    ((x === a && y === b) || (x === b && y === a)) && value === order).length;
  const core = new Set(system.atomIds), c17 = locants["17"]!;
  const c20Candidates = graph.bonds.flatMap(([a,b,order = 1]) => {
    if (order !== 1 || (a !== c17 && b !== c17)) return [];
    const external = a === c17 ? b : a;
    return !core.has(external) && atomById.get(external)?.element === "C" ? [external] : [];
  });
  if (c20Candidates.length !== 1) return null;
  const c20 = c20Candidates[0]!;
  const c21Candidates = graph.bonds.flatMap(([a,b,order = 1]) => {
    if (order !== 1 || (a !== c20 && b !== c20)) return [];
    const external = a === c20 ? b : a;
    return external !== c17 && !core.has(external) && atomById.get(external)?.element === "C" ? [external] : [];
  });
  if (c21Candidates.length !== 1) return null;
  const c21 = c21Candidates[0]!; locants["20"] = c20; locants["21"] = c21;
  if (new Set(Object.values(locants)).size !== 21 || Object.keys(locants).length !== 21) return null;
  const carbonIds = graph.atoms.filter(atom => (atom.element ?? "C") === "C").map(atom => atom.id);
  const oxygenIds = graph.atoms.filter(atom => atom.element === "O").map(atom => atom.id);
  if (carbonIds.length !== 21 || oxygenIds.length !== 2) return null;
  const expectedCenters = new Set(Object.keys(EXPECTED_CIP).map(Number));
  const configured = graph.atoms.filter(atom => atom.tetrahedralParity);
  if (configured.length !== expectedCenters.size || configured.some(atom => {
    const locant = Number(Object.entries(locants).find(([,id]) => id === atom.id)?.[0]);
    return !expectedCenters.has(locant) || atom.tetrahedralParity !== EXPECTED_CIP[locant];
  }) || [...expectedCenters].some(locant => atomById.get(locants[String(locant)]!)?.tetrahedralParity !== EXPECTED_CIP[locant])) return null;
  const carbonyls = {} as Record<3 | 20, number>;
  for (const locant of [3,20] as const) {
    const candidates = oxygenIds.filter(oxygen => bondOrder(locants[String(locant)]!, oxygen, 2) === 1);
    if (candidates.length !== 1) return null;
    carbonyls[locant] = candidates[0]!;
  }
  const c4C5 = graph.bonds.filter(([a,b,order = 1]) => order === 2
    && ((a === locants["4"] && b === locants["5"]) || (a === locants["5"] && b === locants["4"])));
  if (c4C5.length !== 1 || bondOrder(c17, c20, 1) !== 1 || bondOrder(c20, c21, 1) !== 1
    || bondOrder(c20, carbonyls[20], 2) !== 1 || bondOrder(locants["3"]!, carbonyls[3], 2) !== 1) return null;
  const ref = graphIdentity(graph);
  if (!ref || ref.formula !== "C21H30O2" || !PROGESTERONE_REFERENCE_IDENTITIES.includes(ref.id as typeof PROGESTERONE_REFERENCE_IDENTITIES[number])) return null;
  const sideChainBondIds: [number, number][] = [edge(c17,c20), edge(c20,c21), edge(c20,carbonyls[20])];
  return { system, locants, c20, c21, carbonylOxygens: carbonyls, c4C5Bond: edge(locants["4"]!, locants["5"]!), sideChainBondIds };
}

const comp = (input: Omit<NameComponent, "start" | "end" | "text"> & { name: string; text?: string }): NameComponent => ({
  ...input, start: 0, end: input.name.length, text: input.text ?? input.name,
});
function makeDerivation(graph: GeneratedMolecule, parsed: ParsedProgesteroneName): ValidatedNameDerivation | null {
  const inspected = inspectProgesteroneGraph(graph);
  if (!inspected) return null;
  const { system, locants, c20, c21, carbonylOxygens, c4C5Bond, sideChainBondIds } = inspected;
  const name = parsed.language === "en" ? PROGESTERONE_NAMES.en : PROGESTERONE_NAMES.es;
  const parentAtoms = Array.from({ length: 21 }, (_, i) => locants[String(i + 1)]!);
  const parentSet = new Set(parentAtoms);
  const rings = (["A","B","C","D"] as const).map((label) => {
    const ids = system.ringsByLabel[label];
    return comp({ id: `steroid-ring-${label}`, role: "parent", name, text: "", atomIds: [...ids],
      bondIds: graph.bonds.filter(([a,b]) => ids.includes(a) && ids.includes(b)).map(([a,b]) => edge(a,b)),
      numbering: ids.map(id => [id, Number(Object.entries(locants).find(([,value]) => value === id)?.[0])] as [number,number]),
      label: `ring ${label}`, labelEs: `anillo ${label}`, explanation: `Ring ${label} is mapped onto the verified steroid graph.`,
      explanationEs: `El anillo ${label} está asignado sobre el grafo esteroideo verificado.` });
  });
  const fusions = (["AB","BC","CD"] as const).map((label,index) => {
    const pair = system.junctions[label];
    return comp({ id: `steroid-fusion-${index + 1}`, role: "prefix", name, text: "", atomIds: [...pair], bondIds: [edge(...pair)],
      numbering: pair.map(id => [id, Number(Object.entries(locants).find(([,value]) => value === id)?.[0])] as [number,number]),
      label: `fusion ${label}`, labelEs: `unión ${label}`, explanation: `This is the shared ${label} fusion bond.`,
      explanationEs: `Este es el enlace compartido de la unión ${label}.` });
  });
  const numbering = Object.entries(locants).map(([locant,id]) => [id,Number(locant)] as [number,number]);
  const locantComponents = numbering.map(([id,locant]) => comp({ id: `steroid-locant-${locant}`, role: "prefix", name, text: `C${locant}`,
    atomIds: [id], bondIds: [], numbering: [[id,locant]], label: `steroid C${locant}`, labelEs: `C${locant} esteroideo`,
    explanation: `This graph atom has conventional steroid locant C${locant}.`, explanationEs: `Este átomo del grafo tiene el localizador esteroideo convencional C${locant}.` }));
  const c18 = locants["18"]!, c19 = locants["19"]!;
  const functions: NameComponent[] = [3,20].map(locant => {
    const oxygen = carbonylOxygens[locant as 3 | 20], carbon = locants[String(locant)]!;
    return comp({ id: `steroid-ketone-${locant}`, role: "suffix", name, text: `C${locant}=O`, atomIds: [carbon,oxygen],
      bondIds: [edge(carbon,oxygen)], numbering: [[carbon,locant]], label: `ketone at C${locant}`, labelEs: `cetona en C${locant}`,
      explanation: `The carbonyl oxygen is double-bonded to steroid carbon C${locant}.`,
      explanationEs: `El oxígeno carbonílico está unido mediante doble enlace al carbono esteroideo C${locant}.` });
  });
  const components: NameComponent[] = [
    comp({ id: "parent", role: "parent", name, atomIds: parentAtoms,
      bondIds: graph.bonds.filter(([a,b]) => parentSet.has(a) && parentSet.has(b)).map(([a,b]) => edge(a,b)), numbering,
      explanation: "The parent includes the steroid core, angular methyls, and C17 side chain.",
      explanationEs: "La estructura principal incluye el núcleo esteroideo, los metilos angulares y la cadena lateral de C17." }),
    ...rings, ...fusions,
    comp({ id: "steroid-c18", role: "substituent", name, text: "C18", atomIds: [c18], bondIds: [edge(locants["13"]!,c18)], numbering: [[c18,18]],
      label: "angular methyl C18", labelEs: "metilo angular C18", explanation: "C18 is attached to C13.", explanationEs: "C18 está unido a C13." }),
    comp({ id: "steroid-c19", role: "substituent", name, text: "C19", atomIds: [c19], bondIds: [edge(locants["10"]!,c19)], numbering: [[c19,19]],
      label: "angular methyl C19", labelEs: "metilo angular C19", explanation: "C19 is attached to C10.", explanationEs: "C19 está unido a C10." }),
    comp({ id: "steroid-side-chain", role: "parent", name, text: "C20–C21 side chain", atomIds: [locants["17"]!,c20,c21], bondIds: sideChainBondIds,
      numbering: [[locants["17"]!,17],[c20,20],[c21,21]], label: "C17–C20–C21 side chain", labelEs: "cadena lateral C17–C20–C21",
      explanation: "The side chain is attached at C17 and contains the C20 carbonyl carbon followed by terminal C21.",
      explanationEs: "La cadena se une a C17 y contiene el carbono carbonílico C20 seguido del carbono terminal C21." }),
    ...locantComponents,
    comp({ id: "steroid-unsaturation-4", role: "unsaturation", name, text: parsed.language === "en" ? "4-ene" : "4-eno",
      atomIds: [...c4C5Bond], bondIds: [c4C5Bond], numbering: [[locants["4"]!,4],[locants["5"]!,5]],
      label: "C4=C5", labelEs: "C4=C5", explanation: "The double bond joins C4 and C5.", explanationEs: "El doble enlace une C4 y C5." }),
    ...functions,
    comp({ id: "steroid-stereo", role: "prefix", name, text: "stereochemistry", atomIds: Object.entries(locants).filter(([locant]) => EXPECTED_CIP[Number(locant)]).map(([,id]) => id),
      bondIds: [], numbering: Object.entries(locants).filter(([locant]) => EXPECTED_CIP[Number(locant)]).map(([locant,id]) => [id,Number(locant)]),
      label: "global steroid stereochemistry", labelEs: "estereoquímica esteroidea global",
      explanation: "All six configured centers match the complete progesterone reference; this semisystematic name does not spell out every descriptor.",
      explanationEs: "Los seis centros configurados coinciden con la referencia completa de progesterona; este nombre semisistemático no explicita todos los descriptores." }),
    ...(parsed.form === "common" ? [comp({ id: "progesterone-common-name", role: "prefix", name, text: parsed.normalized, atomIds: [], bondIds: [], numbering: [],
      label: parsed.language === "en" ? "common name progesterone" : "nombre común progesterona",
      explanation: "The common name is accepted only after the complete graph and stereochemistry match independent references.",
      explanationEs: "El nombre común se acepta solo después de que el grafo completo y su estereoquímica coincidan con referencias independientes." })] : []),
  ];
  const stereoIds = components.find(item => item.id === "steroid-stereo")!.atomIds;
  const stereoBonds = graph.bonds.filter(([a,b]) => stereoIds.includes(a) && stereoIds.includes(b)).map(([a,b]) => edge(a,b));
  const sideChain = { atomIds: [locants["17"]!,c20,c21], bondIds: sideChainBondIds };
  const pedagogy = { verification:"complete-graph-isomorphism" as const, family: "pregnane" as const, graph, locants, rings: rings.map(r => ({ id:r.id, atomIds:r.atomIds, bondIds:r.bondIds })),
    fusions: fusions.map(f => ({ id:f.id, atomIds:f.atomIds, bondIds:f.bondIds })), angularMethyls:{C18:c18,C19:c19}, sideChain,
    unsaturations:[{locant:4,atomIds:[locants["4"]!,locants["5"]!],bondIds:[c4C5Bond]}],
    functions:[3,20].map(locant => ({kind:"ketone" as const,locant,atomIds:[locants[String(locant)]!,carbonylOxygens[locant as 3|20]],bondIds:[edge(locants[String(locant)]!,carbonylOxygens[locant as 3|20])] })),
    stereo:{atomIds:stereoIds,bondIds:stereoBonds,reference:"independent progesterone stereochemical reference",descriptors:Object.entries(EXPECTED_CIP).map(([locant,descriptor])=>`${locant}${descriptor}`)},
    name,commonName:{en:PROGESTERONE_NAMES.commonEn,es:PROGESTERONE_NAMES.commonEs} };
  const evidence: ValidatedCompositionalEvidence = { source:"active-name", profile:"current", language:parsed.language,
    construction:"fused-progesterone-stereo", rules:[
      {id:"steroid-pregnane-parent",source:"IUPAC-IUBMB Nomenclature of Steroids 3S-1 and 3S-2; conventional numbering and pregnane skeleton"},
      {id:"pregn-4-ene-3-20-dione",source:"ChEBI CHEBI:17026 and PubChem CID 5994; graph, formula and full stereochemical reference"},
      {id:"pregn-4-eno-3-20-diona",source:"Farmacopea Argentina, Anexo 36, progesterone definition; Spanish spelling Pregn-4-eno-3,20-diona"},
      {id:"not-pin",source:"Supported steroid semisystematic form; not asserted to be a 2013 PIN"}],
    parentSelection:"steroid-core", numbering:{scope:"parent",priorities:["pregnane steroid skeleton C1–C21"],selected:numbering,reflected:[],comparison:0},
    stereo:"specified-tetrahedral", reconstructedGraph:graph,atomMapping:graph.atoms.map(atom=>[atom.id,atom.id]),equivalence:"complete-graph-isomorphism",
    steroidPedagogy:pedagogy };
  return {status:"FULL",name,preferred:false,principalGroup:"ketone",components,parentAtomIds:parentAtoms,evidence};
}

export function reconcileProgesteroneName(actual: GeneratedMolecule, name: string): ValidatedNameDerivation | null {
  const parsed = parseProgesteroneName(name);
  return parsed ? makeDerivation(actual, parsed) : null;
}
