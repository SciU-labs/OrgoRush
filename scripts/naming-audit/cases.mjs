// Audit inputs only. Templates construct SMILES, never expected names or a namer.
import { SmilesParser } from "openchemlib";
import { loadCorpus, structuralIdentity } from "../../tests/helpers/reference-corpus.mjs";

export const SEED = 0xa0d001;
export const VERSION = "AUD-NOM-001-v1";
export const TARGETS = Object.freeze({
  alkanes: 35, alkenes: 30, alkynes: 25, "multi-unsaturated": 25,
  carbocycles: 40, aromatics: 35, halogenated: 25, "alcohols-polyols": 30,
  carbonyls: 40, "carboxylic-acids": 20, "ethers-esters": 35,
  "nitrogen-functions": 40, "mixed-functions": 30, "stereo-polycycles-limits": 30,
});

const P4 = "https://iupac.qmul.ac.uk/BlueBook/P4.html";
const P6 = "https://iupac.qmul.ac.uk/BlueBook/P6.html";
const P6A = "https://iupac.qmul.ac.uk/BlueBook/P6a.html";
const P3 = "https://iupac.qmul.ac.uk/BlueBook/P3.html";
const P2 = "https://iupac.qmul.ac.uk/BlueBook/P2.html";
const A34 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm";
const A113 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm";
const C314 = "https://www.acdlabs.com/iupac/nomenclature/79/r79_276.htm";

// Individually specified before observing this audit's outputs. These exact EN
// expectations have a per-structure derivation; no ES text is auto-promoted.
export const REVIEWED = [
  { family: "multi-unsaturated", smiles: "C=CC(CCCC)CCCC", features: ["parent-convention-switch", "unsaturated-substituent", "equal-longest-paths"],
    expected: { "2013-en": "5-ethenylnonane", "1979-en": "3-butyl-1-heptene" },
    derivation: "Two four-carbon arms meet the carbon bonded to a two-carbon ethenyl arm. Modern longest parent: 4+1+4=9 carbons, ethenyl at 5. Historical parent containing C=C: 2+1+4=7, double bond at 1 and butyl at 3.", sources: [P4, A34] },
  { family: "multi-unsaturated", smiles: "C#CC(CCCC)CCCC", features: ["parent-convention-switch", "unsaturated-substituent", "equal-longest-paths"],
    expected: { "2013-en": "5-ethynylnonane", "1979-en": "3-butyl-1-heptyne" },
    derivation: "Same three-arm graph as the preceding case, with a triple bond. Nine-carbon modern parent has ethynyl at 5; seven-carbon historical unsaturated parent has triple bond at 1 and butyl at 3.", sources: [P4, A34] },
  { family: "mixed-functions", smiles: "OCCC(=O)N", features: ["amide-over-alcohol", "published-rule-example"], expected: { "2013-en": "3-hydroxypropanamide" },
    derivation: "HO-CH2-CH2-CONH2 is the explicit P-41 example: amide is senior to alcohol; carbonyl carbon is C1 and hydroxy is at C3.", sources: [P4] },
  { family: "mixed-functions", smiles: "O=CCCC#N", features: ["nitrile-over-aldehyde", "published-rule-example"], expected: { "2013-en": "4-oxobutanenitrile" },
    derivation: "OHC-CH2-CH2-CN is the explicit P-41 example: nitrile is senior to aldehyde. Nitrile carbon is C1, aldehyde oxygen is represented by oxo at C4.", sources: [P4] },
  { family: "mixed-functions", smiles: "CC(=O)CC(=O)O", features: ["acid-over-ketone"], expected: { "2013-en": "3-oxobutanoic acid" },
    derivation: "Four-carbon acid chain includes the carboxyl carbon as C1; ketone at C3 becomes oxo. Carboxylic acid is senior to ketone.", sources: [P4, P6] },
  { family: "mixed-functions", smiles: "OCCC(=O)O", features: ["acid-over-alcohol"], expected: { "2013-en": "3-hydroxypropanoic acid" },
    derivation: "Three-carbon acid parent, carboxyl at C1, hydroxyl at C3; acid suffix and hydroxy prefix.", sources: [P4, P6] },
  { family: "mixed-functions", smiles: "CC(O)CC=O", features: ["aldehyde-over-alcohol"], expected: { "2013-en": "3-hydroxybutanal" },
    derivation: "Unbranched four-carbon chain, terminal CHO is C1; the secondary hydroxyl is at C3 and is a hydroxy prefix.", sources: [P4, P6] },
  { family: "mixed-functions", smiles: "O=CCCC(=O)C", features: ["aldehyde-over-ketone"], expected: { "2013-en": "4-oxopentanal" },
    derivation: "Five-carbon chain counted from aldehyde carbon C1. Internal ketone carbon is C4 and contributes oxo, because aldehyde is senior.", sources: [P4, P6] },
  { family: "mixed-functions", smiles: "CC(=O)C(O)C", features: ["ketone-over-alcohol"], expected: { "2013-en": "3-hydroxybutan-2-one" },
    derivation: "Four-carbon chain; suffix ketone receives C2 rather than C3, placing subordinate hydroxy at C3.", sources: [P4, P6] },
  { family: "carbonyls", smiles: "CC(=O)C=CC", features: ["suffix-before-unsaturation"], expected: { "2013-en": "pent-3-en-2-one" },
    derivation: "Five-carbon unbranched chain; carbonyl is assigned C2 rather than C4, placing C=C at C3. Terminal e of ene is elided before one.", sources: [P6, P3] },
  { family: "alcohols-polyols", smiles: "CCC(O)C=CC", features: ["suffix-before-unsaturation"], expected: { "2013-en": "hex-4-en-3-ol" },
    derivation: "Six-carbon chain; OH at C3 rather than C4 controls direction despite C=C receiving C4 rather than C2.", sources: [P6, P3] },
  { family: "multi-unsaturated", smiles: "C=CC=CC=C", features: ["three-double-bonds", "connecting-vowel"], expected: { "2013-en": "hexa-1,3,5-triene", "1979-en": "1,3,5-hexatriene" },
    derivation: "Unbranched six-carbon chain with three alternating double bonds at 1,3,5. The a connecting vowel precedes triene; locants move before the parent in the recorded historical convention.", sources: [P2, A34] },
  { family: "multi-unsaturated", smiles: "C#CCC#C", features: ["two-triple-bonds", "connecting-vowel"], expected: { "2013-en": "penta-1,4-diyne", "1979-en": "1,4-pentadiyne" },
    derivation: "Five-carbon chain with C1#C2 and C4#C5, equivalent directions, a retained before diyne. Historical locants precede parent.", sources: [P2, A34] },
  { family: "carbonyls", smiles: "O=C1C=CC=CCC1", features: ["cyclic-ketone", "two-double-bonds", "connecting-vowel"],
    expected: { "2013-en": "cyclohepta-2,4-dien-1-one", "1979-en": "2,4-cycloheptadienone" },
    derivation: "Seven-carbon ring, carbonyl C1. Double-bond sets 2,4 and 4,6 select 2,4. Modern locants separate parent/ene/one; A-11.3 and C-314.1 give historical adienone with carbonyl C1 implicit.", sources: [P6, A113, C314] },
  { family: "carbonyls", smiles: "O=C1C=CC=CC=CC1", features: ["cyclic-ketone", "three-double-bonds", "connecting-vowel"],
    expected: { "2013-en": "cycloocta-2,4,6-trien-1-one", "1979-en": "2,4,6-cyclooctatrienone" },
    derivation: "Eight-carbon ring with one ring ketone, numbered from carbonyl C1. Double bonds at 2,4,6 are preferred to 3,5,7. Historical a+trienone retains C1 as the inherent ketone position.", sources: [P6, A113, C314] },
  { family: "alcohols-polyols", smiles: "OCCC1CCCCC1", features: ["functional-chain-versus-ring"], expected: { "2013-en": "2-cyclohexylethan-1-ol" },
    derivation: "OH lies on an external two-carbon chain. Parent containing suffix OH is ethan-1-ol; the separate six-carbon ring is cyclohexyl at C2.", sources: [P4, P6] },
  { family: "carboxylic-acids", smiles: "O=C(O)C1CCCCC1", features: ["exocyclic-functional-carbon"], expected: { "2013-en": "cyclohexanecarboxylic acid" },
    derivation: "COOH carbon is outside the saturated six-carbon ring; carboxylic acid is appended to cyclohexane without counting that carbon as a seventh ring atom.", sources: [P6] },
  { family: "nitrogen-functions", smiles: "N#CC1CCCCC1", features: ["exocyclic-functional-carbon"], expected: { "2013-en": "cyclohexanecarbonitrile" },
    derivation: "Nitrile carbon lies outside a saturated six-carbon ring. The ring parent takes carbonitrile rather than counting the CN carbon in the ring.", sources: [P6A] },
  { family: "nitrogen-functions", smiles: "CCNC(=O)CC", features: ["N-substitution", "secondary-amide"], expected: { "2013-en": "N-ethylpropanamide" },
    derivation: "Three-carbon acyl chain includes carbonyl as C1; the ethyl group attaches to nitrogen and must receive an N locant.", sources: [P6A] },
  { family: "nitrogen-functions", smiles: "CN(C)CCC", features: ["N-substitution", "tertiary-amine"], expected: { "2013-en": "N,N-dimethylpropan-1-amine" },
    derivation: "Longest carbon group directly attached to N is propyl, making propan-1-amine. The two remaining methyl groups attach to N and require N,N locants.", sources: [P6A] },
];

export function seededRandom(seed = SEED) {
  let value = seed >>> 0;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
function shuffled(items, random) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}
function chain(n, { branches = {}, bonds = {}, oxo = [] } = {}) {
  return Array.from({ length: n }, (_, k) => {
    const p = k + 1;
    return `C${oxo.includes(p) ? "(=O)" : ""}${(branches[p] ?? []).map((b) => `(${b})`).join("")}${p < n ? bonds[p] ?? "" : ""}`;
  }).join("");
}
function ring(n, options = {}) { const raw = chain(n, options); return raw.replace(/^C/, "C1") + "1"; }
function benzene(branches) { return Array.from({ length: 6 }, (_, k) => `c${k === 0 ? "1" : ""}${branches[k + 1] ? `(${branches[k + 1]})` : ""}`).join("") + "1"; }

function candidatePool() {
  const pools = Object.fromEntries(Object.keys(TARGETS).map((family) => [family, []]));
  const add = (family, smiles, features = [], extra = {}) => pools[family].push({ family, smiles, features, ...extra });
  for (let n = 5; n <= 15; n++) {
    add("alkanes", chain(n), ["linear-chain", "homologous-series"]);
    for (let p = 2; p < n; p++) {
      for (const branch of ["C", "CC", "CCC"]) add("alkanes", chain(n, { branches: { [p]: [branch] } }), ["branching", "parent-selection"]);
      if (p < n - 1) add("alkanes", chain(n, { branches: { [p]: ["C"], [n - 1]: ["C"] } }), ["repeated-substituents", "numbering-tie"]);
      add("alkanes", chain(n, { branches: { [p]: ["C", "C"] } }), ["geminal", "repeated-substituents"]);
    }
  }
  for (let n = 5; n <= 12; n++) for (let p = 1; p < n; p++) {
    add("alkenes", chain(n, { bonds: { [p]: "=" } }), ["single-double-bond", "locant-neighbor"]);
    add("alkynes", chain(n, { bonds: { [p]: "#" } }), ["single-triple-bond", "locant-neighbor"]);
    const branchPos = p > 2 ? 2 : n - 1;
    if (![p, p + 1].includes(branchPos)) {
      add("alkenes", chain(n, { bonds: { [p]: "=" }, branches: { [branchPos]: ["C"] } }), ["single-double-bond", "branching", "numbering"]);
      add("alkynes", chain(n, { bonds: { [p]: "#" }, branches: { [branchPos]: ["CC"] } }), ["single-triple-bond", "branching", "parent-selection"]);
    }
  }
  for (let n = 5; n <= 12; n++) for (const bonds of [{ 1: "=", 3: "=" }, { 2: "=", 4: "=" }, { 1: "#", 3: "#" }, { 1: "=", 4: "#" }, { 1: "#", 4: "=" }, { 1: "=", 3: "=", 5: "=" }, { 1: "=", 4: "=" }]) {
    if (Math.max(...Object.keys(bonds).map(Number)) >= n) continue;
    add("multi-unsaturated", chain(n, { bonds }), ["multiple-unsaturations", Object.values(bonds).includes("#") ? "poly-yne-or-enyne" : "polyene"]);
    if (n >= 7) add("multi-unsaturated", chain(n, { bonds, branches: { [n - 1]: ["C"] } }), ["multiple-unsaturations", "branching"]);
  }
  for (let n = 3; n <= 10; n++) {
    for (const branches of [{}, { 1: ["C"] }, { 1: ["CC"] }, { 1: ["CCC"] }, { 1: ["C"], 2: ["C"] }, { 1: ["C"], 3: ["CC"] }, { 1: ["C", "C"] }]) {
      add("carbocycles", ring(n, { branches }), ["carbocycle", "ring-orientation", "saturated-ring"]);
      add("carbocycles", ring(n, { branches, bonds: { 2: "=" } }), ["carbocycle", "ring-orientation", "unsaturated-ring"]);
    }
    if (n >= 6) add("carbocycles", ring(n, { bonds: { 1: "=", 3: "=" }, branches: { [n - 1]: ["C"] } }), ["cyclic-diene", "branching"]);
  }
  for (const a of ["C", "CC", "CCC", "CCCC", "C=C", "C#C", "O", "N", "F", "Cl", "Br", "C=O", "C(=O)O", "C#N", "OC", "CO", "CCO"]) {
    add("aromatics", benzene({ 1: a }), ["aromatic", "attachment-sensitive"]);
    for (const p of [2, 3, 4]) {
      add("aromatics", benzene({ 1: a, [p]: "C" }), ["aromatic", "positional-isomer", "numbering-tie"]);
      add("aromatics", benzene({ 1: a, [p]: "Cl" }), ["aromatic", "mixed-prefixes", "numbering-tie"]);
    }
  }
  for (let n = 3; n <= 10; n++) for (const halogen of ["F", "Cl", "Br", "I"]) for (const p of [1, 2, n - 1]) {
    add("halogenated", chain(n, { branches: { [p]: [halogen], [n]: ["Cl"] } }), ["halogen", "multiple-prefixes", "alphabetical-tie"]);
    if (p > 1) add("halogenated", chain(n, { branches: { [p]: [halogen, halogen] } }), ["halogen", "geminal", "repeated-substituents"]);
  }
  for (let n = 3; n <= 10; n++) for (let p = 1; p <= Math.ceil(n / 2); p++) {
    const alcoholBranches = { [p]: ["O"] };
    alcoholBranches[n - 1] = [...(alcoholBranches[n - 1] ?? []), "C"];
    add("alcohols-polyols", chain(n, { branches: alcoholBranches }), ["alcohol", "branching", "suffix-numbering"]);
    add("alcohols-polyols", chain(n, { branches: { [p]: ["O"], [n]: ["O"] } }), ["diol", "suffix-multiplicity"]);
    if (n >= 5 && p !== 3) add("alcohols-polyols", chain(n, { branches: { [p]: ["O"] }, bonds: { 3: "=" } }), ["unsaturated-alcohol", "suffix-before-unsaturation"]);
  }
  for (let n = 4; n <= 10; n++) {
    add("carbonyls", chain(n, { oxo: [1], branches: { [n - 1]: ["C"] } }), ["branched-aldehyde"]);
    add("carbonyls", chain(n, { oxo: [1, n] }), ["dialdehyde", "multiplicity"]);
    for (let p = 2; p < n; p++) {
      add("carbonyls", chain(n, { oxo: [p], branches: { [p < n - 1 ? n - 1 : 2]: ["C"] } }), ["ketone", "branching"]);
      if (p < n - 2) add("carbonyls", chain(n, { oxo: [p, n - 1] }), ["diketone", "multiplicity"]);
    }
    for (const bonds of [{}, { 2: "=" }, { 2: "=", 4: "=" }]) {
      if (Math.max(0, ...Object.keys(bonds).map(Number)) >= n) continue;
      add("carbonyls", ring(n, { oxo: [1], bonds }), ["cyclic-ketone", "carbonyl-C1", "ring-orientation"]);
      if (n >= 6) add("carbonyls", ring(n, { oxo: [1], bonds, branches: { [n - 1]: ["C"] } }), ["cyclic-ketone", "methylated", "ring-orientation"]);
    }
    add("carboxylic-acids", `O=C(O)${chain(n - 1, { branches: { 2: ["C"] } })}`, ["acid", "branching"]);
    add("carboxylic-acids", `O=C(O)${chain(n - 2)}C(=O)O`, ["diacid", "multiplicity"]);
    add("carboxylic-acids", `O=C(O)C=C${chain(n - 3)}`, ["unsaturated-acid", "suffix-priority"]);
    add("carboxylic-acids", `O=C(O)${ring(n)}`, ["ring-carboxylic-acid", "exocyclic-functional-carbon"]);
  }
  for (let a = 1; a <= 5; a++) for (let b = 2; b <= 6; b++) {
    add("ethers-esters", `${chain(a)}OC(C)${chain(b)}`, ["ether", "secondary-attachment", "numbering"]);
    add("ethers-esters", `${chain(a)}OC(=O)${chain(b, { branches: { 2: ["C"] } })}`, ["ester", "branched-acid-component"]);
    add("ethers-esters", `${chain(a)}C(=O)OC(C)${chain(b)}`, ["ester", "secondary-organyl", "exact-spelling-unadjudicated"]);
    add("nitrogen-functions", `${chain(a)}N(C)${chain(b)}`, ["tertiary-amine", "N-substitution"]);
    add("nitrogen-functions", `${chain(a)}NC(=O)${chain(b)}`, ["secondary-amide", "N-substitution"]);
    add("nitrogen-functions", `${chain(a)}C(=O)N(C)${chain(b)}`, ["tertiary-amide", "N-substitution"]);
    add("nitrogen-functions", `N#C${chain(b, { branches: { 2: ["C"] } })}${chain(a)}`, ["nitrile", "branching"]);
  }
  for (let n = 4; n <= 10; n++) for (const p of [2, 3, n - 1]) {
    add("mixed-functions", `O=C(O)${chain(n, { branches: { [p]: ["O"] } })}`, ["acid-over-alcohol"]);
    add("mixed-functions", `O=C(O)${chain(n, { oxo: [p] })}`, ["acid-over-ketone"]);
    add("mixed-functions", `O=C${chain(n, { branches: { [p]: ["N"] } })}`, ["aldehyde-over-amine"]);
    add("mixed-functions", `N#C${chain(n, { branches: { [p]: ["O"] } })}`, ["nitrile-over-alcohol"]);
    add("mixed-functions", `NC(=O)${chain(n, { branches: { [p]: ["N"] } })}`, ["amide-over-amine"]);
    add("mixed-functions", `CCOC(=O)${chain(n, { branches: { [p]: ["O"] } })}`, ["ester-over-alcohol"]);
  }
  const special = [
    ["C/C=C/C", "explicit-E"], ["C/C=C\\C", "explicit-Z"], ["CC/C=C/CC", "explicit-E"], ["CC/C=C\\CC", "explicit-Z"],
    ["C/C=C/C=C/C", "multiple-EZ"], ["C/C=C\\C=C/C", "multiple-EZ"],
    ["C[C@H](O)CC", "explicit-tetrahedral"], ["C[C@@H](O)CC", "explicit-tetrahedral"],
    ["N[C@H](C)C(=O)O", "explicit-tetrahedral"], ["N[C@@H](C)C(=O)O", "explicit-tetrahedral"],
    ["C[C@H](Cl)[C@H](Br)C", "multiple-tetrahedral"], ["C[C@H](Cl)[C@@H](Br)C", "multiple-tetrahedral"],
    ["O1CC1", "registered-heterocycle"], ["O1CCNCC1", "registered-heterocycle"], ["O1CNCCC1", "heterocycle-isomer"],
    ["N1CCCCC1", "registered-heterocycle"], ["O1CCOC1", "registered-heterocycle"], ["O1CCOCC1", "registered-heterocycle"],
    ["OC1CCNCC1", "functionalized-heterocycle"], ["c1ccncc1", "aromatic-heterocycle"], ["c1ccsc1", "sulfur-heterocycle"],
    ["C1CCC2CCCCC2C1", "fused-bicyclic"], ["c1ccc2ccccc2c1", "fused-aromatic"], ["C1CC2CCC1C2", "bridged"],
    ["C1CCC2(CC1)CCCC2", "spiro"], ["C1C2CC3CC1CC(C2)C3", "adamantane"],
    ["C[N+](C)(C)C", "quaternary-ammonium"], ["CC[NH2+]CC", "charged-nitrogen"],
    ["CC(=O)[O-]", "carboxylate"], ["[13CH3]CO", "isotope"],
    ["CS(=O)(=O)O", "sulfur-functional-limit"], ["C[N+](=O)[O-]", "nitro"],
    ["C1CCCCCCCCCC1", "large-ring-limit"], ["C1CCCCC1CC2CCCCC2", "two-rings-side-chain"],
    ["C1CCCCC1C2CCCCC2", "two-disjoint-rings"], ["CC(=O)Cl", "acid-chloride-limit"],
  ];
  for (const [smiles, feature] of special) add("stereo-polycycles-limits", smiles, [feature, "laboratory-boundary"]);
  return pools;
}

export function buildAuditCases() {
  const protectedRecords = loadCorpus();
  const protectedIdentities = new Map(protectedRecords.map((r) => [structuralIdentity(r.smiles), r.id]));
  const seen = new Map(), selected = [], excluded = [];
  const random = seededRandom();
  const pools = candidatePool();
  for (const [family, target] of Object.entries(TARGETS)) {
    const reviewed = REVIEWED.filter((r) => r.family === family).map((r) => ({ ...r, evidenceLevel: "GOLD", review: { method: "individual-rule-derivation", derivation: r.derivation, sources: r.sources } }));
    const generated = family === "stereo-polycycles-limits" ? pools[family] : shuffled(pools[family], random);
    let count = 0;
    for (const candidate of [...reviewed, ...generated]) {
      if (count === target) break;
      let identity;
      try {
        const graph = new SmilesParser().parseMolecule(candidate.smiles);
        if (!graph.getAllAtoms()) throw new Error("empty molecule");
        identity = structuralIdentity(candidate.smiles);
      } catch (e) { excluded.push({ family, smiles: candidate.smiles, reason: "INVALID_SMILES", detail: e.message }); continue; }
      if (protectedIdentities.has(identity)) {
        excluded.push({ family, smiles: candidate.smiles, reason: "PROTECTED_CORPUS_DUPLICATE", referenceId: protectedIdentities.get(identity) }); continue;
      }
      if (seen.has(identity)) { excluded.push({ family, smiles: candidate.smiles, reason: "AUDIT_DUPLICATE", selectedId: seen.get(identity) }); continue; }
      const { derivation, sources, ...rest } = candidate;
      const id = `AUDCASE-${String(selected.length + 1).padStart(4, "0")}`;
      selected.push({ id, ...rest, evidenceLevel: candidate.evidenceLevel ?? "GENERATED", expected: candidate.expected ?? {}, identity });
      seen.set(identity, id); count++;
    }
    if (count !== target) throw new Error(`${family}: only ${count} distinct structures available for target ${target}`);
  }
  return { version: VERSION, seed: SEED, targets: TARGETS, protectedEntries: protectedRecords.length,
    records: selected, excluded, generationPolicy: "Seeded stratified graph templates; OCL canonical identity excludes protected and intra-audit duplicates. GOLD is per reviewed profile only. Remaining profiles are GENERATED, not exact oracles." };
}
