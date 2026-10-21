import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { CanonizerUtil, Molecule, SmilesParser } from "openchemlib";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { fuseRingOnBond } from "../app/fused-ring.ts";
import { getFusedBicyclicSystem } from "../app/fused-ring-nomenclature.ts";
import { applyNomenclatureConvention, formatIupac1979SpanishName } from "../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { legacyProfileDisplayName } from "../app/legacy-profile-display.ts";
import { translateSpanishIupacForDisplay } from "../app/iupac-name-normalization.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";

let chemistry;
let page;
before(async () => { chemistry = await loadExerciseChemistry(); page = chemistry.engine; });
after(async () => chemistry?.close());

function bicycle(first, second) {
  const built = buildHydrocarbonFromIupacName(first === 5 ? "ciclopentano" : "ciclohexano");
  assert.equal(built.ok, true, built.error);
  return fuseRingOnBond(built.molecule, 1, 2, second);
}

const cases = [
  { rings: [5, 5], paths: [3, 3, 0], atoms: 8, formula: "C₈H₁₄", ascii: "C8H14", es: "biciclo[3.3.0]octano", en: "bicyclo[3.3.0]octane", smiles: "C1CC2CCCC2C1" },
  { rings: [6, 5], paths: [4, 3, 0], atoms: 9, formula: "C₉H₁₆", ascii: "C9H16", es: "biciclo[4.3.0]nonano", en: "bicyclo[4.3.0]nonane", smiles: "C1CCC2CCCC2C1" },
  { rings: [6, 6], paths: [4, 4, 0], atoms: 10, formula: "C₁₀H₁₈", ascii: "C10H18", es: "biciclo[4.4.0]decano", en: "bicyclo[4.4.0]decane", smiles: "C1CCC2CCCCC2C1" },
];

const edgeKey = (a, b) => [a, b].sort((left, right) => left - right).join("-");
const ringEdges = (ring) => new Set(ring.atomIds.map((id, i) => edgeKey(id, ring.atomIds[(i + 1) % ring.atomIds.length])));
function parse(smiles) {
  const result = new SmilesParser().parseMolecule(smiles);
  result.ensureHelperArrays(Molecule.cHelperCIP);
  return result;
}
const identity = (smiles) => CanonizerUtil.getIDCode(parse(smiles), CanonizerUtil.NORMAL);

// Independently enumerate the three paths; do not infer the descriptor from a name.
function bridgeLengths(molecule, start, end) {
  const paths = [];
  function visit(path) {
    const current = path.at(-1);
    if (current === end) { paths.push(path.length - 2); return; }
    for (const [a, b] of molecule.bonds) {
      const next = a === current ? b : b === current ? a : undefined;
      if (next !== undefined && !path.includes(next)) visit([...path, next]);
    }
  }
  visit([start]);
  return paths.sort((a, b) => b - a);
}

for (const fixture of cases) test(`${fixture.rings.join("+")}: graph-backed A-31 parent in all four profiles`, () => {
  const molecule = bicycle(...fixture.rings);
  const before = structuredClone(molecule);
  assert.equal(molecule.atoms.length, fixture.atoms);
  assert.ok(molecule.atoms.every((atom) => (atom.element ?? "C") === "C"));
  assert.equal(molecule.rings.length, 2);
  assert.deepEqual(molecule.rings.map((ring) => ring.atomIds.length).sort(), [...fixture.rings].sort());
  const [left, right] = molecule.rings;
  const shared = left.atomIds.filter((id) => right.atomIds.includes(id));
  assert.equal(shared.length, 2);
  const leftEdges = ringEdges(left), rightEdges = ringEdges(right);
  assert.deepEqual([...leftEdges].filter((edge) => rightEdges.has(edge)), [edgeKey(...shared)]);
  assert.deepEqual(bridgeLengths(molecule, ...shared), fixture.paths);
  assert.equal(fixture.paths.reduce((sum, length) => sum + length, 2), fixture.atoms);
  for (const atom of molecule.atoms) {
    const degree = molecule.bonds.filter(([a, b]) => a === atom.id || b === atom.id).length;
    assert.equal(degree, shared.includes(atom.id) ? 3 : 2);
  }
  assert.ok(molecule.bonds.every((bond) => (bond[2] ?? 1) === 1));
  const exported = moleculeToSmiles(molecule);
  assert.equal(exported.ok, true, exported.error);
  assert.equal(identity(exported.smiles), identity(fixture.smiles));
  assert.equal(parse(exported.smiles).getMolecularFormula().formula, fixture.ascii);

  const current = page.analyzeMolecule(molecule);
  const legacy = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
  const analysesBefore = structuredClone({ current, legacy });
  const system = getFusedBicyclicSystem(molecule);
  assert.ok(system);
  assert.deepEqual(system.paths, fixture.paths);
  assert.deepEqual(legacy.mainChain, system.numbering);
  const otherHead = shared.find((id) => id !== system.numbering[0]);
  assert.ok(shared.includes(system.numbering[0]), "A-31.2 starts at a bridgehead");
  assert.equal(system.numbering[fixture.paths[0] + 1], otherHead, "the longest path is numbered first");
  const bondKeys = new Set(molecule.bonds.map(([a, b]) => edgeKey(a, b)));
  system.numbering.forEach((id, i) => assert.ok(bondKeys.has(edgeKey(id, system.numbering[(i + 1) % fixture.atoms]))));
  for (const analysis of [current, legacy]) {
    assert.equal(analysis.formula, fixture.formula);
    assert.equal(analysis.name, fixture.es);
    assert.equal(analysis.spanish1979SaturatedFusedParent, fixture.es);
  }
  const spanish = applyNomenclatureConvention(page.legacySpanishFormatterInput(legacy, legacy.name), "iupac-1979-es", "es");
  const englishModel = page.buildLegacyEnglishNameModel(molecule, legacy, legacy.name);
  assert.equal(englishModel.parent.kind, "polycyclic");
  assert.equal(englishModel.parent.fallbackName, fixture.en, "the existing English path translates the recognized parent");
  const english = generateLegacyEnglishName(englishModel).name;
  assert.equal(spanish, fixture.es);
  assert.equal(english, fixture.en);
  assert.equal(translateSpanishIupacForDisplay(current.name), fixture.en);
  for (const language of ["es", "en"]) assert.deepEqual(legacyProfileDisplayName({
    language, suggestedName: language === "es" ? fixture.es : fixture.en,
    spanish1979Name: spanish, english1979Name: english,
  }), { name: language === "es" ? fixture.es : fixture.en, available: true });

  for (const [language, convention] of [["es", "current"], ["en", "current"], ["en", "iupac-1979-legacy-en"], ["es", "iupac-1979-es"], ["es", "current"]]) {
    const model = page.buildActiveIupacReasoning({ molecule, analyses: { current, legacy }, language, convention,
      displayedName: language === "es" ? fixture.es : fixture.en, generatedNames: [fixture.es, fixture.en], canHighlight: true });
    assertReasoningIntegrity(model, molecule);
    assert.strictEqual(model.analysis, convention === "current" ? current : legacy);
    const text = model.steps.map((step) => `${step.title} ${step.explanation}`).join(" ");
    assert.match(text, language === "es" ? /cabezas de puente/ : /bridgeheads/);
    assert.ok(text.includes(`[${fixture.paths.join(".")}]`), "the explanation uses the graph-derived bridge descriptor");
    assert.match(text, new RegExp(`${fixture.paths[0]}, ${fixture.paths[1]},? ${language === "es" ? "y" : "and"} 0`));
    assert.doesNotMatch(model.steps.map((step) => step.title).join(" "), /Cadena principal|Main chain/);
  }
  assert.deepEqual(molecule, before);
  assert.deepEqual({ current, legacy }, analysesBefore, "profile changes retain all numbering and analysis state");
  assert.equal(moleculeToSmiles(molecule).smiles, exported.smiles);
});

test("recognized parent names and graph proof survive ID/order/coordinate permutations", () => {
  for (const fixture of cases) {
    const graph = bicycle(...fixture.rings);
    const remap = (id) => id * 17 + 100;
    const permuted = {
      ...graph,
      atoms: graph.atoms.map((atom) => ({ ...atom, id: remap(atom.id), x: -atom.y + 30, y: atom.x - 20 })).reverse(),
      bonds: graph.bonds.map(([a, b, order]) => [remap(b), remap(a), order]).reverse(),
      rings: graph.rings.map((ring) => ({ ...ring, atomIds: ring.atomIds.map(remap).reverse() })).reverse(),
    };
    const analysis = page.analyzeMolecule(permuted, [], "iupac-1979-legacy");
    assert.equal(analysis.spanish1979SaturatedFusedParent, fixture.es);
    assert.equal(applyNomenclatureConvention(page.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es"), fixture.es);
  }
});

// Valid unsupported topologies are fixtures for the analysis boundary only;
// they remain rejected by the real editable SMILES importer below.
function rawGraph(smiles) {
  const raw = parse(smiles), rings = raw.getRingSet();
  return {
    atoms: Array.from({ length: raw.getAllAtoms() }, (_, i) => ({ id: i + 1, element: raw.getAtomLabel(i), x: i, y: 0 })),
    bonds: Array.from({ length: raw.getAllBonds() }, (_, i) => [raw.getBondAtom(0, i) + 1, raw.getBondAtom(1, i) + 1, raw.getBondOrder(i)]),
    rings: Array.from({ length: rings.getSize() }, (_, i) => ({ id: i + 1, kind: rings.isAromatic(i) ? "aromatic" : "cycloalkane", atomIds: Array.from(rings.getRingAtoms(i), (id) => id + 1) })),
  };
}

test("graph-backed saturated polycycles extend coverage while other negative controls stay closed", () => {
  const base = bicycle(6, 6);
  const change = (fn) => { const graph = structuredClone(base); fn(graph); return graph; };
  const tri = fuseRingOnBond(base, 4, 5, 6);
  const probes = [
    ["unsaturated", change((g) => { g.bonds.find(([a,b]) => a === 3 && b === 4 || a === 4 && b === 3)[2] = 2; }), "biciclo[4.4.0]-2-deceno", "bicyclo[4.4.0]dec-2-ene"],
    ["alcohol", change((g) => { g.atoms.push({ id: 11, element: "O", x: 3, y: 3 }); g.bonds.push([3,11,1]); }), "biciclo[4.4.0]-2-decanol", "bicyclo[4.4.0]decan-2-ol"],
    ["substituted", change((g) => { g.atoms.push({ id: 11, element: "C", x: 3, y: 3 }); g.bonds.push([3,11,1]); }), "-"],
    // ORGORUSH-IUPAC79-FUSED-001: exact A-21.1(3) graph is now admitted.
    ["aromatic", rawGraph("c1ccc2ccccc2c1"), "naftaleno", "naphthalene"],
    ["heteroatom", change((g) => { g.atoms[2].element = "N"; }), "-"],
    ["spiro", rawGraph("C1CCC2(C1)CCCC2"), "-"],
    ["linked rings", rawGraph("C1CCCCC1C2CCCCC2"), "-", "cyclohexylcyclohexane"],
    // POLYCYCLIC-002 extends A-32 bare saturated parents, without admitting
    // arbitrary unsaturation, substituents, charges or assigned stereo here.
    ["tricyclic", tri, "triciclo[8.4.0.0^{3,8}]tetradecano", "tricyclo[8.4.0.0^{3,8}]tetradecane"],
    ["tetracyclic", fuseRingOnBond(tri, 13, 14, 6), "tetraciclo[8.8.0.0^{2,7}.0^{12,17}]octadecano", "tetracyclo[8.8.0.0^{2,7}.0^{12,17}]octadecane"],
    ["bridged", rawGraph("C1CC2CCC1C2"), "-"],
    ["stored tetrahedral stereo", change((g) => { g.atoms[0].tetrahedralParity = "R"; g.atoms[0].tetrahedralBondTo = 2; }), "-"],
    ["charge", change((g) => { g.atoms[0].charge = 1; }), "-"],
    ["disconnected", change((g) => { g.atoms.push({ id: 11, x: 9, y: 9 }); }), "-"],
    ["overvalent carbon", change((g) => { g.bonds.find(([a,b]) => a === 1 && b === 2 || a === 2 && b === 1)[2] = 3; }), "-"],
    ["stored bond stereo", change((g) => { g.bonds[0][3] = true; }), "-"],
  ];
  for (const [label, molecule, expectedEs, expectedEn] of probes) {
    const before = structuredClone(molecule);
    const analysis = page.analyzeMolecule(molecule, [], "iupac-1979-legacy");
    assert.equal(analysis.spanish1979SaturatedFusedParent, undefined, label);
    assert.equal(applyNomenclatureConvention(page.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es"), expectedEs, label);
    if (expectedEn) assert.equal(generateLegacyEnglishName(page.buildLegacyEnglishNameModel(molecule, analysis, analysis.name)).name, expectedEn, label);
    assert.equal(page.legacySpanishFormatterInput(analysis, "biciclo[4.4.0]decano"), "-", `${label}: a supplied name cannot replace graph proof`);
    assert.deepEqual(molecule, before, label);
  }
});

test("literal formatting alone cannot admit unproved, mismatched or stereo-tagged parent analyses", () => {
  const analysis = page.analyzeMolecule(bicycle(6, 6));
  assert.equal(page.legacySpanishFormatterInput({ ...analysis, spanish1979SaturatedFusedParent: undefined }, analysis.name), "-");
  assert.equal(page.legacySpanishFormatterInput(analysis, "biciclo[3.3.0]octano"), "-");
  assert.equal(page.legacySpanishFormatterInput(analysis, `(1R)-${analysis.name}`), "-");
  assert.equal(formatIupac1979SpanishName("biciclo[4.2.0]octano"), undefined);
  const naphthalene = moleculeFromSmiles("c1ccc2ccccc2c1");
  assert.equal(naphthalene.ok, true);
  assert.equal(page.analyzeMolecule(naphthalene.molecule).name, "naftaleno");
  for (const smiles of ["C1CCC2(C1)CCCC2", "C1CC2CCC1C2"]) {
    const result = moleculeFromSmiles(smiles);
    assert.equal(result.ok, false, `${smiles}: existing import safety remains intact`);
    assert.match(result.error, /policíclico/);
  }
});
