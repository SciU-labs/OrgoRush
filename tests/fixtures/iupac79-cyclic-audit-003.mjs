// Historical names are explicit reference data, not production naming output.
// Parametric graphs independently construct the descriptor to be recognized.
import { Molecule, SmilesParser } from "openchemlib";

const row = (id, family, smiles, formula, es, en, rule, target = true) => ({
  id, family, smiles, formula, es, en, rule, target,
  expectedTopology: ({ A: "monocyclic", B: "ortho-fused", C: "bridged", D: "spiro", E: "linked", F: "monocyclic", G: "monocyclic" })[family],
  ...({
    pyrene: { expectedTopology: "ortho-peri-fused", hamiltonian: false },
    perhydropyrene: { expectedTopology: "ortho-peri-fused", hamiltonian: false },
    indole: { expectedTopology: "ortho-fused" }, quinoline: { expectedTopology: "ortho-fused" },
    quinuclidine: { expectedTopology: "bridged" }, oxaspiro: { expectedTopology: "spiro" },
    methyldecalin: { expectedTopology: "ortho-fused" },
  })[id],
});
const roots = ["", "met", "et", "prop", "but", "pent", "hex", "hept", "oct", "non", "dec", "undec", "dodec", "tridec", "tetradec", "pentadec", "hexadec"];
const englishRoot = (root) => root === "et" ? "eth" : root === "met" ? "meth" : root;
export const CYCLIC_REFERENCES = [
  ...[3, 4, 5, 6, 7, 8, 12].map((n) => ({ ...row(`mono-${n}`, "A", null, `C${n}H${2 * n}`, `ciclo${roots[n]}ano`, `cyclo${englishRoot(roots[n])}ane`, "A-11.1"), perimeter: n })),
  row("mono-ene", "A", "C1=CCCCC1", "C6H10", "1-ciclohexeno", "1-cyclohexene", "A-11.3; A-3.3"),
  row("mono-diene", "A", "C1=CC=CCC1", "C6H8", "1,3-ciclohexadieno", "1,3-cyclohexadiene", "A-11.3; A-3.3"),
  row("mono-yne", "A", "C1#CCCCCCC1", "C8H12", "1-ciclooctino", "1-cyclooctyne", "A-11.3; A-3.3"),
  row("mono-methyl-ene", "A", "CC1=CCCCC1", "C7H12", "1-metil-1-ciclohexeno", "1-methyl-1-cyclohexene", "A-11.3; A-2.2; A-61"),
  row("mono-dimethyl", "A", "CC1CC(C)CCC1", "C8H16", "1,3-dimetilciclohexano", "1,3-dimethylcyclohexane", "A-11.1; A-2.2; A-61"),
  row("naphthalene", "B", "c1ccc2ccccc2c1", "C10H8", "naftaleno", "naphthalene", "A-21.1(3); A-22"),
  row("anthracene", "B", "c1ccc2cc3ccccc3cc2c1", "C14H10", "antraceno", "anthracene", "A-21.1(13); A-22.5"),
  row("phenanthrene", "B", "c1ccc2c(c1)ccc1ccccc12", "C14H10", "fenantreno", "phenanthrene", "A-21.1(12); A-22.5"),
  row("azulene", "B", "C1=CC=C2C=CC=C2C=C1", "C10H8", "azuleno", "azulene", "A-21.1(4); A-22"),
  row("dihydronaphthalene", "B", "C1C=CCC2=CC=CC=C12", "C10H10", "1,4-dihidronaftaleno", "1,4-dihydronaphthalene", "A-23.1–2"),
  row("tetralin", "B", "C1CCC2=CC=CC=C2C1", "C10H12", "1,2,3,4-tetrahidronaftaleno", "1,2,3,4-tetrahydronaphthalene", "A-23.1–2", true),
  row("pyrene", "B", "c1cc2ccc3cccc4ccc(c1)c2c34", "C16H10", "pireno", "pyrene", "A-21.1(18); A-22", true),
  { ...row("perhydropyrene", "B", "c1cc2ccc3cccc4ccc(c1)c2c34", "C16H26", "perhidropireno", "perhydropyrene", "A-23.2; A-32 non-Hamiltonian boundary pending", false), saturate: true },
  { ...row("linear-tricyclic", "B", null, "C14H24", "triciclo[8.4.0.0^{3,8}]tetradecano", "tricyclo[8.4.0.0^{3,8}]tetradecane", "A-32.11–31"), perimeter: 14, chords: [[1, 10], [3, 8]] },
  { ...row("angular-tricyclic", "B", null, "C14H24", "triciclo[8.4.0.0^{2,7}]tetradecano", "tricyclo[8.4.0.0^{2,7}]tetradecane", "A-32.11–31"), perimeter: 14, chords: [[1, 10], [2, 7]] },
  { ...row("capture-C17H28", "B", null, "C17H28", "tetraciclo[8.7.0.0^{3,8}.0^{12,16}]heptadecano", "tetracyclo[8.7.0.0^{3,8}.0^{12,16}]heptadecane", "A-32.11–31"), perimeter: 17, chords: [[1, 10], [3, 8], [12, 16]] },
  { ...row("star-tetracyclic", "B", null, "C18H30", "tetraciclo[12.4.0.0^{2,7}.0^{8,13}]octadecano", "tetracyclo[12.4.0.0^{2,7}.0^{8,13}]octadecane", "A-32.11–31"), perimeter: 18, chords: [[1, 6], [7, 12], [13, 18]] },
  row("adamantane", "C", "C1C2CC3CC1CC(C2)C3", "C10H16", "triciclo[3.3.1.1^{3,7}]decano", "tricyclo[3.3.1.1^{3,7}]decane", "A-32; positive secondary bridge numbering pending", false),
  { ...row("dispiro", "D", null, "C8H12", "diespiro[2.1.2.1]octano", "dispiro[2.1.2.1]octane", "A-41.6", false), edges: [[1, 2], [2, 3], [3, 4], [4, 1], [1, 5], [5, 6], [6, 1], [3, 7], [7, 8], [8, 3]] },
  row("mixed-spiro", "D", "c1ccc2c(c1)CCC21CCCC1", "C13H16", "espiro[ciclopentano-1,1'-indano]", "spiro[cyclopentane-1,1'-indane]", "A-41.4; A-23", false),
  row("biphenyl", "E", "c1ccccc1-c1ccccc1", "C12H10", "bifenilo", "biphenyl", "A-52.4"),
  { ...row("bicyclohexyl", "E", "C1CCCCC1C1CCCCC1", "C12H22", "1,1'-biciclohexilo", "1,1'-bicyclohexyl", "A-52.1–2"),
    alternatives: { es: ["1,1'-biciclohexano"], en: ["1,1'-bicyclohexane"] } },
  row("mixed-linked", "E", "C1CCCC1C1CCCCC1", "C11H20", "ciclopentilciclohexano", "cyclopentylcyclohexane", "A-53.1–2"),
  row("cyclohexylbenzene", "E", "c1ccccc1C1CCCCC1", "C12H16", "ciclohexilbenceno", "cyclohexylbenzene", "A-53.2(c)"),
  row("phenylcycloheptane", "E", "c1ccccc1C1CCCCCC1", "C13H18", "fenilcicloheptano", "phenylcycloheptane", "A-53.2(b)"),
  row("terphenyl", "E", "c1ccccc1-c1ccc(-c2ccccc2)cc1", "C18H14", "1,1':4',1''-terfenilo", "1,1':4',1''-terphenyl", "A-54.1–3", false),
  ...[
    ["pyrrole", "c1cc[nH]c1", "C4H5N", "pirrol", "pyrrole", "B-2.11(12)"],
    ["furan", "o1cccc1", "C4H4O", "furano", "furan", "B-2.11(5)"],
    ["thiophene", "s1cccc1", "C4H4S", "tiofeno", "thiophene", "B-2.11(1)"],
    ["pyridine", "n1ccccc1", "C5H5N", "piridina", "pyridine", "B-2.11(15)"],
    ["oxirane", "O1CC1", "C2H4O", "oxirano", "oxirane", "B-1.1; Table B-II"],
    ["aziridine", "N1CC1", "C2H5N", "aziridina", "aziridine", "B-1.1; Table B-II"],
    ["oxetane", "O1CCC1", "C3H6O", "oxetano", "oxetane", "B-1.1; Table B-II"],
    ["azetidine", "N1CCC1", "C3H7N", "azetidina", "azetidine", "B-1.1; Table B-II"],
    ["pyrrolidine", "N1CCCC1", "C4H9N", "pirrolidina", "pyrrolidine", "B-2.12(3)"],
    ["tetrahydrofuran", "O1CCCC1", "C4H8O", "tetrahidrofurano", "tetrahydrofuran", "B-1.2; B-2.11(5)"],
    ["dioxolane", "O1COCC1", "C3H6O2", "1,3-dioxolano", "1,3-dioxolane", "B-1.1,1.3,1.52"],
    ["piperidine", "N1CCCCC1", "C5H11N", "piperidina", "piperidine", "B-2.12(9)"],
    ["tetrahydropyran", "O1CCCCC1", "C5H10O", "tetrahidropirano", "tetrahydropyran", "B-1.2; B-2.11(6)"],
    ["morpholine", "O1CCNCC1", "C4H9NO", "morfolina", "morpholine", "B-2.12(14)"],
    ["dioxane", "O1CCOCC1", "C4H8O2", "1,4-dioxano", "1,4-dioxane", "B-1.1,1.3,1.52"],
  ].map(([id, smiles, formula, es, en, rule]) => row(id, "F", smiles, formula, es, en, rule)),
  row("indole", "F", "c1ccc2[nH]ccc2c1", "C8H7N", "indol", "indole", "B-2.11(22); B-3", false),
  row("quinoline", "F", "c1ccc2ncccc2c1", "C9H7N", "quinolina", "quinoline", "B-2.11(27); B-3", false),
  row("quinuclidine", "F", "C1CN2CCC1CC2", "C7H13N", "quinuclidina", "quinuclidine", "B-2.12(13); B-14", false),
  row("oxaspiro", "F", "O1CCCC12CCCCC2", "C9H16O", "1-oxaespiro[4.5]decano", "1-oxaspiro[4.5]decane", "B-10.1", false),
  row("dihydrofuran", "F", "O1CCC=C1", "C4H6O", "2,3-dihidrofurano", "2,3-dihydrofuran", "B-1.2", false),
  row("methylcyclohexane", "G", "CC1CCCCC1", "C7H14", "metilciclohexano", "methylcyclohexane", "A-11; A-2; A-61"),
  row("ethylcyclohexane", "G", "CCC1CCCCC1", "C8H16", "etilciclohexano", "ethylcyclohexane", "A-61.4"),
  row("chlorocyclohexane", "G", "ClC1CCCCC1", "C6H11Cl", "clorociclohexano", "chlorocyclohexane", "A-11; C-102"),
  row("methylhalocycle", "G", "CC1CCC(Br)CC1", "C7H13Br", "1-bromo-4-metilciclohexano", "1-bromo-4-methylcyclohexane", "A-2.2; C-102"),
  row("cyclohexanol", "G", "OC1CCCCC1", "C6H12O", "ciclohexanol", "cyclohexanol", "C-201.1"),
  row("cyclohexanone", "G", "O=C1CCCCC1", "C6H10O", "ciclohexanona", "cyclohexanone", "C-314.1"),
  row("enone", "G", "O=C1C=CCCC1", "C6H8O", "2-ciclohexenona", "2-cyclohexenone", "A-11.3; C-314.1"),
  row("ringacid", "G", "O=C(O)C1CCCCC1", "C7H12O2", "ácido ciclohexanocarboxílico", "cyclohexanecarboxylic acid", "C-401.2"),
  row("ringaldehyde", "G", "O=CC1CCCCC1", "C7H12O", "ciclohexanocarbaldehído", "cyclohexanecarbaldehyde", "C-304.1"),
  row("ringnitrile", "G", "N#CC1CCCCC1", "C7H11N", "ciclohexanocarbonitrilo", "cyclohexanecarbonitrile", "C-832.2"),
  row("ringamide", "G", "NC(=O)C1CCCCC1", "C7H13NO", "ciclohexanocarboxamida", "cyclohexanecarboxamide", "C-822.1; Table C-III"),
  { ...row("ringamine", "G", "NC1CCCCC1", "C6H13N", "ciclohexanamina", "cyclohexanamine", "C-812.1(a–b)"),
    alternatives: { es: ["ciclohexilamina"], en: ["cyclohexylamine"] } },
  row("methyldecalin", "G", "CC1CCC2CCCCC2C1", "C11H20", "3-metilbiciclo[4.4.0]decano", "3-methylbicyclo[4.4.0]decane", "A-31.1–2; A-2", false),
];

// Complete finite construction sweeps; overlapping reference constitutions are
// deduplicated by an independent canonical identity before coverage is counted.
export const GENERATED_CYCLIC_REFERENCES = [];
for (let a = 1; a <= 4; a++)for (let b = 1; b <= a; b++)for (let c = 0; c <= Math.min(b, 2); c++) {
  const n = a + b + c + 2, descriptor = `[${a}.${b}.${c}]`;
  GENERATED_CYCLIC_REFERENCES.push({    
...row(`theta-${a}-${b}-${c}`, c ? "C" : "B", null, `C${n}H${2 * n - 2}`,
      `biciclo${descriptor}${roots[n]}ano`, `bicyclo${descriptor}${englishRoot(roots[n])}ane`, "A-31.1–2"), theta: [a, b, c]  
});
}
for (let a = 2; a <= 7; a++)for (let b = a; b <= 7; b++) {
  const n = a + b + 1, descriptor = `[${a}.${b}]`;
  GENERATED_CYCLIC_REFERENCES.push({    
...row(`spiro-${a}-${b}`, "D", null, `C${n}H${2 * n - 2}`,
      `espiro${descriptor}${roots[n]}ano`, `spiro${descriptor}${englishRoot(roots[n])}ane`, "A-41.1–2"), spiro: [a, b]  
});
}

export function graphFromCyclicReference(reference) {
  if (reference.smiles) {
    const m = new SmilesParser().parseMolecule(reference.smiles); m.ensureHelperArrays(Molecule.cHelperCIP);
    const rings = m.getRingSet();
    return {      
atoms: Array.from({ length: m.getAllAtoms() }, (_, i) => ({ id: i + 1, x: Math.cos(i), y: Math.sin(i), element: m.getAtomLabel(i), charge: m.getAtomCharge(i) })),
      bonds: Array.from({ length: m.getAllBonds() }, (_, i) => [m.getBondAtom(0, i) + 1, m.getBondAtom(1, i) + 1, reference.saturate ? 1 : m.getBondOrder(i)]),
      ...(reference.saturate ? {} : { rings: Array.from({ length: rings.getSize() }, (_, i) => ({ id: i + 1, kind: rings.isAromatic(i) ? "aromatic" : "cycloalkane", atomIds: Array.from(rings.getRingAtoms(i), j => j + 1) })) })    
};
  }
  let edges = reference.edges?.map(([a, b]) => [a, b, 1]) ?? [], n;
  if (reference.perimeter) { n = reference.perimeter; edges = [...Array.from({ length: n }, (_, i) => [i + 1, (i + 1) % n + 1, 1]), ...(reference.chords ?? []).map(([a, b]) => [a, b, 1])]; }
  if (reference.theta) { n = 2; for (const count of reference.theta) { const path = [1, ...Array.from({ length: count }, () => ++n), 2]; for (let i = 1; i < path.length; i++)edges.push([path[i - 1], path[i], 1]); } }
  if (reference.spiro) { n = 1; for (const count of reference.spiro) { const path = [1, ...Array.from({ length: count }, () => ++n), 1]; for (let i = 1; i < path.length; i++)edges.push([path[i - 1], path[i], 1]); } }
  n ??= Math.max(...edges.flatMap(([a, b]) => [a, b]));
  return { atoms: Array.from({ length: n }, (_, i) => ({ id: i + 1, x: Math.cos(i), y: Math.sin(i) })), bonds: edges };
}
