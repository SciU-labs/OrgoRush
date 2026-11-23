import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { mapStructuralRepresentative } from "../app/structural-derivation.ts";
import { reconcileSystematicName, presentValidatedSystematicName } from "../app/validated-name-derivation.ts";

const corpus = [
  ["Naphthalene", "c1ccc2ccccc2c1", "naphthalene", "naftaleno", "none"],
  ["1-methylnaphthalene", "Cc1cccc2ccccc12", "1-methylnaphthalene", "1-metilnaftaleno", "none"],
  ["2-methylnaphthalene", "Cc1ccc2ccccc2c1", "2-methylnaphthalene", "2-metilnaftaleno", "none"],
  ["1-chloronaphthalene", "Clc1cccc2ccccc12", "1-chloronaphthalene", "1-cloronaftaleno", "none"],
  ["2-chloronaphthalene", "Clc1ccc2ccccc2c1", "2-chloronaphthalene", "2-cloronaftaleno", "none"],
  ["1-nitronaphthalene", "[N+](=O)([O-])c1cccc2ccccc12", "1-nitronaphthalene", "1-nitronaftaleno", "none"],
  ["2-nitronaphthalene", "[N+](=O)([O-])c1ccc2ccccc2c1", "2-nitronaphthalene", "2-nitronaftaleno", "none"],
  ["1,2-dimethylnaphthalene", "Cc1c(C)ccc2ccccc12", "1,2-dimethylnaphthalene", "1,2-dimetilnaftaleno", "none"],
  ["1,8-dimethylnaphthalene", "Cc1cccc2cccc(C)c12", "1,8-dimethylnaphthalene", "1,8-dimetilnaftaleno", "none"],
  ["1-naphthol", "Oc1cccc2ccccc12", "naphthalen-1-ol", "naftalen-1-ol", "alcohol"],
  ["2-naphthol", "Oc1ccc2ccccc2c1", "naphthalen-2-ol", "naftalen-2-ol", "alcohol"],
  ["1-methoxynaphthalene", "COc1cccc2ccccc12", "1-methoxynaphthalene", "1-metoxinaftaleno", "none"],
  ["2-methoxynaphthalene", "COc1ccc2ccccc2c1", "2-methoxynaphthalene", "2-metoxinaftaleno", "none"],
  ["1-naphthylamine", "Nc1cccc2ccccc12", "naphthalen-1-amine", "naftalen-1-amina", "amine"],
  ["2-naphthylamine", "Nc1ccc2ccccc2c1", "naphthalen-2-amine", "naftalen-2-amina", "amine"],
  ["naphthalene-1-carboxylic acid", "O=C(O)c1cccc2ccccc12", "naphthalene-1-carboxylic acid", "ácido naftaleno-1-carboxílico", "carboxylicAcid"],
  ["naphthalene-2-carboxylic acid", "O=C(O)c1ccc2ccccc2c1", "naphthalene-2-carboxylic acid", "ácido naftaleno-2-carboxílico", "carboxylicAcid"],
  ["methyl naphthalene-2-carboxylate", "COC(=O)c1ccc2ccccc2c1", "methyl naphthalene-2-carboxylate", "metil naftaleno-2-carboxilato", "ester"],
  ["naphthalene-1-carbonitrile", "N#Cc1cccc2ccccc12", "naphthalene-1-carbonitrile", "naftaleno-1-carbonitrilo", "nitrile"],
  ["naphthalene-1,5-diol", "Oc1cccc2c(O)cccc12", "naphthalene-1,5-diol", "naftaleno-1,5-diol", "alcohol"],
];
const build = smiles => {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, result.error);
  return result.molecule;
};
const edgeKey = ([a, b]) => [a, b].sort((x, y) => x - y).join(":");

test("all 20 reference fused naphthalene structures import once and reconcile independently in both languages", () => {
  for (const [label, smiles, english, spanish, group] of corpus) {
    const molecule = build(smiles);
    assert.equal(molecule.atoms.filter(atom => atom.element === "C").length >= 10, true, `${label}: carbon count`);
    const core = reconcileSystematicName(molecule, english);
    assert.equal(core?.status, "FULL", `${label}: English name`);
    assert.equal(core.evidence?.construction, "fused-naphthalene");
    assert.equal(core.principalGroup, group);
    const spanishProof = reconcileSystematicName(molecule, spanish);
    assert.equal(spanishProof?.status, "FULL", `${label}: Spanish name`);
    assert.equal(spanishProof.evidence?.language, "es", `${label}: Spanish derivation is independently parsed`);
    assert.equal(presentValidatedSystematicName(core, "es").name, spanish);
    assert.equal(presentValidatedSystematicName(spanishProof, "en").name, english, `${label}: English projection is separately reconciled`);
    assert.equal(presentValidatedSystematicName(spanishProof, "es").localized, true, `${label}: strict Spanish source is a verified localized presentation`);
    for (const name of [english, spanish]) {
      const imported = buildHydrocarbonFromIupacName(name);
      assert.equal(imported.ok, true, `${label}: name import ${name}`);
      assert.equal(imported.inputFamily, "fused-naphthalene");
      assert.ok(mapStructuralRepresentative(imported.molecule, molecule), `${label}: name import matches the reference graph`);
    }

    const parent = core.components.find(component => component.id === "parent");
    assert.equal(parent.atomIds.length, 10, `${label}: one ten-atom fused parent`);
    assert.equal(new Set(parent.atomIds).size, 10, `${label}: shared atoms are not duplicated`);
    assert.deepEqual(new Set(parent.numbering.map(([, locant]) => String(locant))), new Set(["1","2","3","4","4a","5","6","7","8","8a"]));
    const fusion = molecule.bonds.filter(([a, b]) => parent.atomIds.includes(a) && parent.atomIds.includes(b));
    assert.equal(fusion.length, 11, `${label}: ten-atom parent has eleven graph edges`);
    assert.ok(fusion.every(([a, b]) => molecule.atoms.some(atom => atom.id === a) && molecule.atoms.some(atom => atom.id === b)));
    assert.ok(core.components.every(component => component.atomIds.every(id => molecule.atoms.some(atom => atom.id === id))));
    assert.ok(core.components.every(component => component.bondIds.every(edge => molecule.bonds.some(bond => edgeKey(bond) === edgeKey(edge)))),
      `${label}: pedagogical targets use exact graph edge IDs`);
  }
});

test("naphthalene structure keeps the fused edge and import rejects other polycyclic families", () => {
  const naphthalene = build("c1ccc2ccccc2c1");
  assert.equal(naphthalene.atoms.length, 10);
  assert.equal(naphthalene.bonds.length, 11);
  assert.equal(naphthalene.rings.length, 2);
  assert.ok(naphthalene.rings.every(ring => ring.kind === "aromatic" && ring.atomIds.length === 6));
  assert.equal(naphthalene.rings[0].atomIds.filter(id => naphthalene.rings[1].atomIds.includes(id)).length, 2);
  assert.equal(moleculeFromSmiles("c1ccccc1-c1ccccc1").ok, true, "biphenyl remains a valid independent-ring import");
  assert.equal(reconcileSystematicName(build("c1ccccc1-c1ccccc1"), "naphthalene"), null, "biphenyl is not fused naphthalene");
  const unsupportedDihydroxy="Oc1ccc2cc(O)ccc2c1";
  assert.equal(moleculeFromSmiles(unsupportedDihydroxy).ok,false,"unlisted 2,7-naphthalenediol remains outside the phase-one import envelope");
  assert.equal(buildHydrocarbonFromIupacName("naphthalene-2,7-diol").ok,false,"the name builder rejects the unlisted diol locants");
  assert.equal(buildHydrocarbonFromIupacName("naftaleno-2,7-diol").ok,false,"the Spanish name builder rejects the unlisted diol locants");
  assert.equal(moleculeFromSmiles("Oc1cccc2c(O)cccc12").ok,true,"the supported 1,5-diol remains importable");
  assert.equal(moleculeFromSmiles("C1CCC2(CC1)CCCC2").ok, false, "spiro fusion remains outside the import allowance");
});

test("wrong regioisomers, nonpreferred symmetry locants, omitted groups and invalid locants fail closed", () => {
  const alphaMethyl = build("Cc1cccc2ccccc12");
  assert.equal(reconcileSystematicName(alphaMethyl, "2-methylnaphthalene"), null);
  assert.equal(reconcileSystematicName(alphaMethyl, "4-methylnaphthalene"), null, "symmetry-equivalent spelling uses the lower preferred locant");
  assert.equal(reconcileSystematicName(alphaMethyl, "9-methylnaphthalene"), null);
  assert.equal(reconcileSystematicName(alphaMethyl, "4a-methylnaphthalene"), null);
  assert.equal(reconcileSystematicName(alphaMethyl, "naphthalene"), null, "an omitted substituent cannot reconcile");
  assert.equal(reconcileSystematicName(build("Cc1cccc2cc(C)ccc12"), "1,8-dimethylnaphthalene"), null);
  assert.equal(reconcileSystematicName(build("[N+](=O)([O-])c1cccc2ccccc12"), "naphthalene"), null,
    "an omitted charged nitro group cannot reconcile");
});

test("arbitrary atom IDs and atom/bond order do not change fused-parent selections", () => {
  const original = build("Cc1c(C)ccc2ccccc12"), names = ["1,2-dimethylnaphthalene", "1,2-dimetilnaftaleno"];
  const renamed = new Map(original.atoms.map(atom => [atom.id, atom.id * 23 + 101]));
  const permuted = { atoms: [...original.atoms].reverse().map(atom => ({...atom,id:renamed.get(atom.id)})),
    bonds: [...original.bonds].reverse().map(([a,b,order]) => [renamed.get(b),renamed.get(a),order]) };
  for (const name of names) {
    const proof = reconcileSystematicName(permuted, name);
    assert.equal(proof?.status, "FULL", name);
    assert.ok(proof.components.every(component => component.atomIds.every(id => permuted.atoms.some(atom => atom.id === id))));
  }
});
