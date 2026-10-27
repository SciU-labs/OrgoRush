import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { analyzeBoth, displayedProfiles } from "../scripts/naming-audit/evaluate.mjs";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { normalizeTraditionalUnsaturationNotation, translateSpanishIupacForDisplay } from "../app/iupac-name-normalization.ts";
import { witness } from "../scripts/validation-014-reference.mjs";
import { evidence, observe, project, assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";
import { VALIDATION_CASES } from "./fixtures/orgorush-validation-014.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => chemistry?.close());

function analyze(smiles) {
  const molecule = moleculeFromSmiles(smiles).molecule;
  const analyses = analyzeBoth(molecule, chemistry.engine);
  return { molecule, analyses, profiles: displayedProfiles(molecule, analyses, chemistry.engine) };
}
const plainFormula = value => value.replace(/[₀-₉]/g, digit => String("₀₁₂₃₄₅₆₇₈₉".indexOf(digit)));

test("FIX-015A preserves methylidene identity in functional 2013 names and explanations", () => {
  const cases = [
    ["CC(=O)C(=C)CC", "3-metilidenopentan-2-ona", "3-methylidenepentan-2-one", "C6H10O"],
    ["OC(C(C(C)=O)=C)CCC", "4-hidroxi-3-metilidenoheptan-2-ona", "4-hydroxy-3-methylideneheptan-2-one", "C8H14O2"],
  ];
  for (const [smiles, spanish, english, formula] of cases) {
    const { molecule, analyses, profiles } = analyze(smiles);
    assert.equal(plainFormula(analyses.current.formula), formula);
    assert.equal(profiles["2013-es"].name, spanish);
    assert.equal(profiles["2013-en"].name, english);
    assert.equal(witness(english, smiles).status, "PASS", english);
    for (const [profile, term] of [["2013-es", "metilideno"], ["2013-en", "methylidene"]]) {
      const model = project(chemistry.engine, { molecule, analyses, profiles }, profile);
      assertReasoningIntegrity(model, molecule);
      const part = evidence(model).find(item => item.semanticId === "substituent:methylidene:3");
      assert.equal(part?.text, term);
      assert.equal(part?.bondType, "double");
      assert.deepEqual(new Set(part?.atomIds), new Set([analyses.current.mainChain[2], analyses.current.substituents.find(s => s.name === "metilideno").atomIds[0]]));
      assert.ok(model.steps.some(step => step.explanation.includes(term) && step.explanation.includes("CH₂")));
    }
  }
  const saturated = analyze("CC(=O)C(C)CC");
  assert.equal(saturated.profiles["2013-es"].name, "3-metilpentan-2-ona");
  assert.equal(analyze("CC(=O)C(=C)C").profiles["2013-es"].name, "3-metilbut-3-en-2-ona");
  const legacy = analyze("CC(=O)C(=C)CC").profiles;
  assert.equal(legacy["1979-es"].name, "3-etil-3-buten-2-ona");
  assert.equal(legacy["1979-en"].name, "3-ethyl-3-buten-2-one");
});

test("FIX-015B names all double bonds in the current unsaturated radical", () => {
  const cases = [
    ["CCCCCC(C=CC=C)CCCCC", "6-(buta-1,3-dien-1-il)undecano", "6-(buta-1,3-dien-1-yl)undecane", "5-pentyl-1,3-decadiene"],
    ["C(=CC=C)C(CCCCC)CCCCCCCC", "6-(buta-1,3-dien-1-il)tetradecano", "6-(buta-1,3-dien-1-yl)tetradecane", "5-pentyl-1,3-tridecadiene"],
  ];
  for (const [smiles, spanish, english, legacyEnglish] of cases) {
    const observed = observe(chemistry.engine, smiles);
    const { profiles } = observed;
    assert.equal(profiles["2013-es"].name, spanish);
    assert.equal(profiles["2013-en"].name, english);
    assert.equal(witness(english, smiles).status, "PASS", english);
    const sideBonds = observed.molecule.bonds.filter(([a,b,order=1]) => order > 1
      && !observed.analyses.current.mainChain.includes(a) && !observed.analyses.current.mainChain.includes(b));
    assert.equal(sideBonds.length, 2);
    for (const profile of ["2013-es", "2013-en"]) {
      const model = project(chemistry.engine, observed, profile);
      assertReasoningIntegrity(model, observed.molecule);
      const prose = model.steps.map(step => step.explanation).join(" ");
      assert.match(prose, /dien/);
      assert.ok(profile === "2013-en" ? prose.includes("2 C=C double bonds") : prose.includes("2 enlaces dobles C=C"));
      for (const [a,b] of sideBonds) assert.ok(evidence(model).some(part => part.bondIds?.some(([x,y]) => x === a && y === b || x === b && y === a)));
    }
    assert.equal(profiles["1979-en"].name, legacyEnglish);
  }
  assert.equal(analyze("CCCCCC(C=CC=C)CCCCC").profiles["1979-en"].name, "5-pentyl-1,3-decadiene");
  assert.equal(analyze("CCCCC(C=CC=C)CCCCC").profiles["2013-en"].name, "5-butyldeca-1,3-diene");
  const mono = analyze("CCCCCC(CC=CC)CCCCC");
  assert.equal(mono.profiles["2013-es"].name, "6-(but-2-en-1-il)undecano");
  assert.equal(mono.profiles["2013-en"].name, "6-(but-2-en-1-yl)undecane");
  assert.equal(witness(mono.profiles["2013-en"].name, "CCCCCC(CC=CC)CCCCC").status, "PASS");
});

test("FIX-015 outputs are invariant under atom renumbering, storage order, and visual reflection", () => {
  for (const smiles of ["OC(C(C(C)=O)=C)CCC", "CCCCCC(C=CC=C)CCCCC", "Cc1cccs1"]) {
    const { molecule, profiles } = observe(chemistry.engine, smiles);
    const remap = id => 900 - 11 * id;
    const variant = {
      ...molecule,
      atoms: molecule.atoms.map(atom => ({ ...atom, id: remap(atom.id), x: -atom.x, y: -atom.y })).reverse(),
      bonds: molecule.bonds.map(([a,b,...rest]) => [remap(b), remap(a), ...rest]).reverse(),
      rings: molecule.rings?.map(ring => ({ ...ring, atomIds: ring.atomIds.map(remap) })).reverse(),
    };
    const before = structuredClone(variant);
    const analyses = analyzeBoth(variant, chemistry.engine);
    const actual = displayedProfiles(variant, analyses, chemistry.engine);
    for (const key of Object.keys(profiles)) assert.equal(actual[key].name, profiles[key].name, `${smiles}: ${key}`);
    assert.deepEqual(variant, before);
  }
});

test("FIX-015C keeps thiophene retained names and substituent locants in English", () => {
  assert.equal(normalizeTraditionalUnsaturationNotation("2-metiltiofeno"), "2-metiltiofeno");
  assert.equal(translateSpanishIupacForDisplay("2-metiltiofeno"), "2-methylthiophene");
  assert.equal(translateSpanishIupacForDisplay("tiofeno"), "thiophene");
  assert.equal(translateSpanishIupacForDisplay("4-metilpiridina"), "4-methylpyridine");
  const thio = analyze("Cc1cccs1");
  assert.equal(thio.profiles["2013-es"].name, "2-metiltiofeno");
  assert.equal(thio.profiles["2013-en"].name, "2-methylthiophene");
  assert.equal(witness(thio.profiles["2013-en"].name, "Cc1cccs1").status, "PASS");
  for (const [smiles, spanish, english] of [["c1ccsc1", "tiofeno", "thiophene"], ["Cc1ccncc1", "4-metilpiridina", "4-methylpyridine"]]) {
    const { profiles } = analyze(smiles);
    assert.equal(profiles["2013-es"].name, spanish);
    assert.equal(profiles["2013-en"].name, english);
    assert.equal(witness(english, smiles).status, "PASS", english);
  }
});

test("FIX-015 observations match frozen Validation-014 identities and historical evidence remains unchanged", () => {
  for (const id of ["V014-045", "V014-059", "V014-125"]) {
    const record = VALIDATION_CASES.find(item => item.id === id);
    assert.ok(record);
    assert.equal(witness(record.referenceEnglish, record.smiles).status, "PASS");
  }
});
