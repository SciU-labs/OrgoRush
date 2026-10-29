import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { formatStereochemicalName, getMainChainStereoDescriptors,
  inspectDoubleBondStereochemistry, toggleDoubleBondGeometry } from "../app/double-bond-stereochemistry.ts";
import { calculateMolecule2DLayout } from "../app/molecule-2d-layout.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { getBondInteractionHintActions } from "../app/bond-interaction-hints.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { resolveChemicalName } from "../app/name-structure-resolver.ts";
import { renderScene } from "./helpers/semi-fused-fixture.mjs";

const build = (name) => {
  const result = buildHydrocarbonFromIupacName(name);
  assert.equal(result.ok, true, `${name}: ${result.error}`);
  return result;
};
const configurations = (molecule) => molecule.bonds.flatMap(([a, b, order]) => {
  const stereo = order === 2 && inspectDoubleBondStereochemistry(molecule, a, b);
  return stereo?.stereogenic ? [stereo.configuration] : [];
});
const constitution = (molecule) => ({
  atoms: molecule.atoms.map(({ id, element, charge }) => ({ id, element, charge })),
  bonds: molecule.bonds.map(([a, b, order]) => [a, b, order]),
});
const cases = [
  ["but-2-ene", 2, "Z"],
  ["1,2-dichloroethene", 1, "Z"],
  ["4,5-dichloro-6,6-dimethylhept-4-en-2-one", 4, "Z"],
  ["but-2-eno", 2, "Z"],
  ["1,2-dicloroeteno", 1, "Z"],
  ["4,5-dicloro-6,6-dimetilhept-4-en-2-ona", 4, "Z"],
  // Identical methyl groups have opposite CIP ranks on the two ends.
  ["2-bromobut-2-ene", 2, "E"],
  // Cl is below Br on one end and above H on the other.
  ["1-bromo-1,2-dichloroethene", 1, "E"],
];

for (const [base, locant, cisConfiguration] of cases) {
  test(`cis/trans ${base}: connectivity, explicit state, render layout, toggle and SMILES`, () => {
    const plain = build(base).molecule;
    const variants = [];
    for (const relative of ["cis", "trans"]) {
      const configuration = relative === "cis" ? cisConfiguration : cisConfiguration === "E" ? "Z" : "E";
      const result = build(`${relative}-${base}`);
      const molecule = result.molecule;
      assert.equal(result.normalizedInput, `(${locant}${configuration})-${base}`);
      assert.deepEqual(configurations(molecule), [configuration]);
      assert.deepEqual(constitution(molecule), constitution(plain));
      assert.equal(molecule.bonds.find(([a, b]) => a === locant && b === locant + 1)[3], true);
      assert.ok(getBondInteractionHintActions(molecule).includes("switch-ez"));
      for (const mode of ["skeletal", "semi-developed"]) {
        const positions = calculateMolecule2DLayout(molecule, molecule.atoms.map(a => a.id), mode);
        const displayed = { ...molecule, atoms: molecule.atoms.map(a => ({ ...a, ...positions.get(a.id) })) };
        assert.deepEqual(configurations(displayed), [configuration], `${mode} renders ${configuration}`);
        assert.ok(displayed.atoms.every(a => Number.isFinite(a.x) && Number.isFinite(a.y)));
      }
      const toggled = toggleDoubleBondGeometry(molecule, locant, locant + 1);
      assert.equal(toggled.ok, true, toggled.error);
      assert.deepEqual(configurations(toggled.molecule), [configuration === "E" ? "Z" : "E"]);
      assert.deepEqual(constitution(toggled.molecule), constitution(molecule));
      assert.deepEqual(configurations(molecule), [configuration], "editing does not mutate the source");
      const exported = moleculeToSmiles(molecule);
      assert.equal(exported.ok, true, exported.error);
      const imported = moleculeFromSmiles(exported.smiles);
      assert.equal(imported.ok, true, imported.error);
      assert.deepEqual(configurations(imported.molecule), [configuration]);
      assert.ok(imported.molecule.bonds.some(b => b[3] === true));
      variants.push({ molecule, smiles: exported.smiles });
    }
    assert.notEqual(variants[0].smiles, variants[1].smiles);
    assert.notDeepEqual(variants[0].molecule.atoms, variants[1].molecule.atoms);
  });
}

test("explicit E/Z remains supported, including multiple locanted descriptors", () => {
  for (const name of ["(2E)-but-2-ene", "(2Z)-but-2-eno", "(E)-1,2-dichloroethene",
    "(4Z)-4,5-dichloro-6,6-dimethylhept-4-en-2-one", "(2E,4Z)-hexa-2,4-diene",
    "(E)-hexa-1,3-diene", "(E)-hept-4-en-2-one"]) {
    const result = build(name);
    assert.deepEqual(configurations(result.molecule), [...name.matchAll(/[EZ]/g)].map(m => m[0]));
  }
  assert.equal(build("  CiS – but-2-ene ").normalizedInput, "(2Z)-but-2-ene");
});

test("unspecified names never acquire explicit stereo or serialize the drawing as specified", () => {
  for (const [base] of cases) {
    const { molecule } = build(base);
    assert.ok(molecule.bonds.every(b => b[3] !== true));
    const mainChain = molecule.atoms.map(a => a.id);
    assert.deepEqual(getMainChainStereoDescriptors(molecule, mainChain, true), []);
    assert.equal(formatStereochemicalName(molecule, mainChain, base, { explicitDoubleBonds: true }), base);
    const smiles = moleculeToSmiles(molecule);
    assert.equal(smiles.ok, true, smiles.error);
    assert.doesNotMatch(smiles.smiles, /[/\\]/);
  }
});

test("inappropriate or ambiguous descriptors return actionable validation", () => {
  for (const [base, error] of [
    ["propene", /no hay.*isomería geométrica/],
    ["2-methylbut-2-ene", /no hay.*isomería geométrica/],
    ["butane", /no hay.*isomería geométrica/],
    ["hexa-2,4-diene", /varios dobles enlaces.*E\/Z/],
    ["3-methylhept-3-ene", /referencia.*ambigua.*E\/Z/],
    ["1,2-dibromo-1,2-dichloroethene", /referencia.*ambigua.*E\/Z/],
    ["cyclohexene", /cíclico/],
    ["benzene", /validar cis\/trans/],
    ["cis-but-2-ene", /superpuestos/],
  ]) for (const relative of ["cis", "trans"]) {
    const result = buildHydrocarbonFromIupacName(`${relative}-${base}`);
    assert.equal(result.ok, false, `${relative}-${base}`);
    assert.equal(result.inputFamily, "alkene-stereo");
    assert.match(result.error, error);
  }
  for (const name of ["(1E)-propene", "(2E,2Z)-but-2-ene", "(E)-hexa-2,4-diene"]) {
    assert.equal(buildHydrocarbonFromIupacName(name).ok, false, name);
  }
});

test("production naming emits E/Z and round-trips both isomers", async () => {
  const chemistry = await loadExerciseChemistry();
  try {
    for (const [base] of cases) for (const relative of ["cis", "trans"]) {
      const { molecule } = build(`${relative}-${base}`);
      const analysis = chemistry.engine.analyzeMolecule(molecule);
      assert.match(analysis.name, /^\(\d+[EZ]\)-/);
      assert.doesNotMatch(analysis.name, /cis|trans/);
      const rebuilt = build(analysis.name).molecule;
      const expected = moleculeToSmiles(molecule), actual = moleculeToSmiles(rebuilt);
      assert.equal(actual.ok, true, actual.error);
      assert.equal(expected.ok, true, expected.error);
      assert.equal(actual.smiles, expected.smiles, analysis.name);
      for (const mode of ["skeletal", "semi-developed"]) {
        const positions = calculateMolecule2DLayout(molecule, analysis.mainChain, mode);
        const displayed = { ...molecule, atoms: molecule.atoms.map(a => ({ ...a, ...positions.get(a.id) })) };
        assert.deepEqual(configurations(displayed), configurations(molecule));
        const rendered = renderScene(molecule, positions, { skeletal: mode === "skeletal" });
        assert.match(rendered.svg, /<svg/);
        assert.doesNotMatch(rendered.svg, /NaN|Infinity|undefined/);
      }
    }
  } finally { await chemistry.close(); }
});

test("Name Builder uses validated stereo before external resolution and enables existing controls", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const construct = source.slice(source.indexOf("const constructFromName ="), source.indexOf("const constructFromIupacName ="));
  assert.match(construct, /!localPreflight\.ok[\s\S]*?inputFamily === "alkene-stereo"[\s\S]*?message: localPreflight\.error/);
  assert.match(construct, /if \(localPreflight\.ok[\s\S]*?inputFamily === "alkene-stereo"[\s\S]*?next = localPreflight\.molecule/);
  assert.match(construct, /next\.bonds\.some\(bond => bond\[3\] === true\)[\s\S]*?setShowStereochemistry\(true\)/);
  assert.match(source, /stereoConfiguration = stereoInspection\?\.stereogenic && bond\[3\] === true/);
});

test("combined resolver validates local aliases without a network request", async () => {
  const fetchImpl = async () => { assert.fail("local stereo must not need the network"); };
  for (const name of ["cis-but-2-ene", "trans-4,5-dichloro-6,6-dimethylhept-4-en-2-one"]) {
    const result = await resolveChemicalName(name, { fetchImpl });
    assert.equal(result.ok, true, result.error);
    assert.match(result.value.interpretedName, /^\(\d+[EZ]\)-/);
    const imported = moleculeFromSmiles(result.value.smiles);
    assert.equal(imported.ok, true, imported.error);
    assert.deepEqual(configurations(imported.molecule), configurations(build(name).molecule));
  }
  for (const name of ["cis-propene", "trans-hexa-2,4-diene", "cis-cis-but-2-ene"]) {
    const result = await resolveChemicalName(name, { fetchImpl });
    assert.equal(result.ok, false, name);
    assert.match(result.error, /cis\/trans|superpuestos/);
  }
});

test("advanced connectivity is resolved first, then cis/trans is validated with the same CIP editor", async () => {
  for (const relative of ["cis", "trans"]) {
    const requested = [];
    const name = `${relative}-2-bromo-3-methoxybut-2-ene`;
    const local = buildHydrocarbonFromIupacName(name);
    assert.equal(local.requiresAdvancedConnectivity, true);
    const result = await resolveChemicalName(name, { fetchImpl: async url => {
      requested.push(decodeURIComponent(String(url)));
      return Response.json({ status: "SUCCESS", smiles: "CC(Br)=C(OC)C", warnings: [] });
    } });
    assert.equal(result.ok, true, result.error);
    assert.equal(requested.length, 1);
    assert.match(requested[0], /\/2-bromo-3-methoxybut-2-ene\.json$/);
    assert.doesNotMatch(requested[0], /cis|trans/);
    const imported = moleculeFromSmiles(result.value.smiles);
    assert.equal(imported.ok, true, imported.error);
    assert.deepEqual(configurations(imported.molecule), [relative === "cis" ? "Z" : "E"]);
    assert.equal(result.value.interpretedName, `(${relative === "cis" ? "Z" : "E"})-2-bromo-3-methoxybut-2-ene`);
    assert.equal(result.value.cid, undefined);
    assert.equal(result.value.inchiKey, undefined);
  }
  const methylReference = await resolveChemicalName("cis-2-methoxybut-2-ene", { fetchImpl: async () =>
    Response.json({ status: "SUCCESS", smiles: "CC(OC)=CC", warnings: [] }) });
  // This connectivity has one identical methyl group on each end and is valid.
  assert.equal(methylReference.ok, true, methylReference.error);
  const rejected = await resolveChemicalName("cis-2-methoxypent-2-ene", { fetchImpl: async () =>
    Response.json({ status: "SUCCESS", smiles: "CC(OC)=CCC", warnings: [] }) });
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /referencia.*ambigua/);
});
