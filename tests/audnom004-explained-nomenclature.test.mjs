import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { affected, observe, project, evidence, assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";
import { formatStereochemicalName, getMainChainStereoDescriptors } from "../app/double-bond-stereochemistry.ts";
import { applyNomenclatureConvention, stripStereochemicalDescriptors } from "../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

for (const record of affected("AUDNOM-006")) {
  test(`AUDNOM-006: ${record.id} has one graph-derived E/Z set across languages and conventions`, () => {
    const observed = observe(chemistry.engine, record.smiles);
    for (const key of ["2013-es", "2013-en", "1979-es", "1979-en", "2013-es"]) {
      const profile = observed.profiles[key];
      const analysis = key.startsWith("2013") ? observed.analyses.current : observed.analyses.legacy;
      const descriptors = getMainChainStereoDescriptors(observed.molecule, analysis.mainChain, true);
      assert.equal(descriptors.length, 1);
      const prefix = `(${descriptors[0].locant}${descriptors[0].configuration})-`;
      assert.ok(profile.name.startsWith(prefix), profile.name);
      assert.equal((profile.name.match(/\([\d,EZRS]+\)-/gi) ?? []).length, 1);
      assert.ok(!profile.name.includes("--"));
      const model = project(chemistry.engine, observed, key);
      assert.equal(model.links.map((item) => item.text).join(""), profile.name);
      const once = formatStereochemicalName(observed.molecule, analysis.mainChain,
        stripStereochemicalDescriptors(analysis.name), { explicitDoubleBonds: true });
      assert.equal(formatStereochemicalName(observed.molecule, analysis.mainChain, once, { explicitDoubleBonds: true }), once);
    }
  });
}

test("AUDNOM-006: constitutional mode, unspecified geometry and existing R/S stay distinct", () => {
  for (const smiles of ["C/C=C/C", "C/C=C\\C", "CC=CC", "C[C@H](O)CC", "C[C@@H](O)CC"]) {
    const { molecule, analyses } = observe(chemistry.engine, smiles);
    const base = stripStereochemicalDescriptors(analyses.legacy.name);
    const off = generateLegacyEnglishName(chemistry.engine.buildLegacyEnglishNameModel(molecule, analyses.legacy, base, { stereochemistry: false })).name;
    assert.doesNotMatch(off, /\([\d,EZRS]+\)-/i);
    const spanishOff = applyNomenclatureConvention(chemistry.engine.legacySpanishFormatterInput(analyses.legacy, base), "iupac-1979-es", "es");
    assert.doesNotMatch(spanishOff, /\([\d,EZRS]+\)-/i);
    if (smiles === "CC=CC") {
      assert.doesNotMatch(formatStereochemicalName(molecule, analyses.legacy.mainChain, base, { explicitDoubleBonds: true }), /[EZ]/);
    }
  }
});

for (const record of affected("AUDNOM-007")) {
  test(`AUDNOM-007: ${record.id} exposes the complete non root before the ketone suffix`, () => {
    const observed = observe(chemistry.engine, record.smiles);
    for (const key of record.affectedProfiles) {
      const model = project(chemistry.engine, observed, key);
      const parent = evidence(model).find((item) => item.kind === "parent");
      const suffix = evidence(model).find((item) => item.kind === "function");
      assert.equal(parent.text, "non");
      assert.equal(parent.start, model.displayedName.lastIndexOf("nonan"));
      assert.ok(parent.start + parent.text.length <= suffix.start);
      assert.deepEqual(new Set(parent.atomIds), new Set(model.analysis.mainChain));
      const linked = model.links.find((item) => item.stepNumber === parent.stepNumber);
      assert.equal(linked.text, "non");
      assert.deepEqual(new Set(linked.atomIds), new Set(parent.atomIds));
    }
  });
}

test("AUDNOM-007: oct/non/dec neighbors and an N-nonyl prefix use the functional-parent context", () => {
  for (const [smiles, root] of [["CCCCCC(=O)CC(C)C", "non"], ["CCCCC(=O)CC(C)C", "oct"],
    ["CCCCCCC(=O)CC(C)C", "dec"], ["CCCCCCCCC(=O)NCCCCCCCCC", "non"]]) {
    const observed = observe(chemistry.engine, smiles);
    for (const key of ["1979-es", "1979-en"]) {
      if (!observed.profiles[key].name) { assert.equal(key, "1979-es"); continue; }
      const model = project(chemistry.engine, observed, key);
      const parent = evidence(model).find((item) => item.kind === "parent");
      assert.equal(parent.text, root, model.displayedName);
      assert.equal(parent.start, model.displayedName.lastIndexOf(`${root}an`));
      assert.equal(model.links.find((item) => item.stepNumber === parent.stepNumber).text, root);
    }
  }
});

for (const record of affected("AUDNOM-008")) {
  test(`AUDNOM-008: ${record.id} keeps en separate from oic/oico in modern ES/EN`, () => {
    const observed = observe(chemistry.engine, record.smiles);
    for (const key of record.affectedProfiles) {
      const model = project(chemistry.engine, observed, key);
      const fragments = evidence(model);
      const suffix = fragments.find((item) => item.kind === "function" && /oic/.test(item.text));
      const unsaturation = fragments.find((item) => item.kind === "unsaturation");
      assert.ok(suffix && unsaturation);
      assert.equal(unsaturation.text, `${unsaturation.locant}-en`);
      assert.ok(unsaturation.start + unsaturation.text.length <= suffix.start);
      assert.equal(suffix.text, key.endsWith("en") ? "oic" : "oico");
      assert.ok(model.links.some((item) => item.stepNumber === suffix.stepNumber && item.text === suffix.text));
      assert.ok(model.links.some((item) => item.semanticId === unsaturation.semanticId));
    }
  });
}

test("AUDNOM-008: admitted unsaturated esters keep oate/oato intact and ordinary alkenes retain ene/eno", () => {
  for (const smiles of ["COC(=O)C=CCC", "CCOC(=O)C=CCCC", "O=C(O)C=CCCCC"]) {
    const observed = observe(chemistry.engine, smiles);
    for (const key of ["2013-es", "2013-en"]) {
      const model = project(chemistry.engine, observed, key);
      const suffix = evidence(model).find((item) => item.kind === "function" && /oat|oic/.test(item.text));
      const bond = evidence(model).find((item) => item.kind === "unsaturation");
      assert.ok(suffix && bond, model.displayedName);
      assert.ok(bond.start + bond.text.length <= suffix.start);
      assert.ok(model.links.some((item) => item.text === suffix.text && item.stepNumber === suffix.stepNumber));
    }
  }
  const alkene = observe(chemistry.engine, "CC=CCC");
  for (const key of ["2013-es", "2013-en"]) {
    const bond = evidence(project(chemistry.engine, alkene, key)).find((item) => item.kind === "unsaturation");
    assert.equal(bond.text, key.endsWith("en") ? "2-ene" : "2-eno");
  }
});

for (const record of affected("AUDNOM-009")) {
  for (const key of record.affectedProfiles) {
    test(`AUDNOM-009: ${record.id}/${key} has one interactive locant per section and role`, () => {
      const observed = observe(chemistry.engine, record.smiles);
      const model = project(chemistry.engine, observed, key);
      assertReasoningIntegrity(model, observed.molecule);
      const numbering = evidence(model).filter((item) => item.kind === "numbering");
      const identities = numbering.map((item) =>
        `${item.stepNumber}:${item.kind}:${item.start ?? model.displayedName.indexOf(item.text)}:${item.text}:${item.semanticId ?? ""}`);
      assert.equal(new Set(identities).size, identities.length, JSON.stringify(numbering));
      for (const substituent of model.analysis.substituents) {
        assert.match(model.displayedName, new RegExp(`(?:^|\\D)${substituent.locant}(?=\\D|$)`));
        assert.ok(numbering.some((item) => item.text.split(",").includes(String(substituent.locant))
          && (item.start ?? model.displayedName.indexOf(item.text)) >= 0));
      }
    });
  }
}

test("AUDNOM-009: AUDCASE-0003 and 0005 preserve every distinct geminal locant", () => {
  for (const [id, expected] of [["AUDCASE-0003", "2,2"], ["AUDCASE-0005", "2,6"]]) {
    const record = affected("AUDNOM-009").find((item) => item.id === id);
    const observed = observe(chemistry.engine, record.smiles);
    for (const key of record.affectedProfiles) {
      const model = project(chemistry.engine, observed, key);
      const matching = evidence(model).filter((item) => item.kind === "numbering" && item.text === expected);
      assert.equal(matching.length, 1, `${id}/${key}: ${JSON.stringify(matching)}`);
      assert.ok(model.links.some((item) => item.stepNumber === matching[0].stepNumber && item.text === expected));
    }
  }
});

test("AUDNOM-010: aromatic explanations use real ring composition and avoid localized bonds", () => {
  for (const [smiles, spanish, english, element] of [
    ["n1ccccc1", "piridina", "pyridine", "nitrógeno"],
    ["c1ccccc1", "benceno", "benzene", undefined],
    ["c1cc[nH]c1", "pirrol", "pyrrole", "nitrógeno"],
    ["o1cccc1", "furano", "furan", "oxígeno"],
    ["s1cccc1", "tiofeno", "thiophene", "azufre"],
  ]) {
    const observed = observe(chemistry.engine, smiles);
    assert.equal(observed.profiles["2013-es"].name, spanish);
    assert.equal(observed.profiles["2013-en"].name, english);
    for (const key of ["2013-es", "2013-en"]) {
      const model = project(chemistry.engine, observed, key);
      const explanations = model.steps.map((step) => step.explanation).join(" ");
      assert.doesNotMatch(explanations, /C\d+[=≡]C\d+/);
      const localizedBonds = model.analysis.doubleBondLocants.length + model.analysis.tripleBondLocants.length;
      if (localizedBonds >= 2) {
        const explanation = model.steps.find((step) => step.number === "03")?.explanation ?? "";
        assert.ok(explanation, `${smiles}/${key}: numbering explanation exists`);
        assert.match(explanation, key.endsWith("en") ? /aromatic|delocalized/i : /aromático|deslocalizado/i);
      }
      const hetero = observed.molecule.atoms.filter((atom) => atom.element !== "C");
      if (element) {
        assert.ok(hetero.length);
        for (const atom of hetero) {
          const locant = model.analysis.numberedAtoms.get(atom.id);
          assert.ok(locant !== undefined);
          if (localizedBonds >= 2) assert.match(explanations, key.endsWith("en")
            ? new RegExp(`${element === "nitrógeno" ? "nitrogen" : element === "oxígeno" ? "oxygen" : "sulfur"}[^.]*${locant}`)
            : new RegExp(`${element}[^.]*${locant}`));
        }
      } else assert.ok(observed.molecule.atoms.filter((atom) => atom.element === "C").length === 6);
    }
  }
});

test("AUDNOM-010: a nonaromatic cyclic multiple bond is described only across a real graph edge", () => {
  const observed = observe(chemistry.engine, "C1CCC=CC=1");
  const molecule = observed.molecule;
  const analysis = structuredClone(observed.analyses.current);
  const ring = molecule.rings?.find((item) => item.kind === "cycloalkane");
  assert.equal(ring?.atomIds.length, 6);
  analysis.mainChain = [...ring.atomIds].reverse();
  analysis.numberedAtoms = new Map(analysis.mainChain.map((id, index) => [id, index + 1]));
  analysis.doubleBondLocants = analysis.mainChain.flatMap((id, index) => {
    const next = analysis.mainChain[(index + 1) % analysis.mainChain.length];
    return molecule.bonds.some(([a, b, order]) => (a === id && b === next || a === next && b === id) && order === 2)
      ? [index + 1] : [];
  });
  assert.ok(analysis.doubleBondLocants.includes(6), "the reversed valid ring path numbers its closure bond 6–1");
  assert.ok(analysis.doubleBondLocants.length >= 2, "the path exercises the multiple-unsaturation explanation");
  const spanish = chemistry.engine.buildIupacReasoningSteps(molecule, analysis);
  const english = chemistry.engine.buildEnglishReasoningSteps(spanish, molecule, analysis);
  for (const steps of [spanish, english]) {
    const text = steps.find((step) => step.number === "03")?.explanation ?? "";
    assert.match(text, /C6=C1/);
    assert.doesNotMatch(text, /C6=C7/);
    for (const [, leftLocant, rightLocant] of text.matchAll(/C(\d+)=C(\d+)/g)) {
      const left = analysis.mainChain[Number(leftLocant) - 1];
      const right = analysis.mainChain[(Number(rightLocant) - 1) % analysis.mainChain.length];
      assert.ok(molecule.bonds.some(([a, b, order]) =>
        (a === left && b === right || a === right && b === left) && order === 2), text);
    }
  }
});

const englishFunctionalLabels = {
  halogen: "halide", alcohol: "alcohol", ether: "ether", aldehyde: "aldehyde", ketone: "ketone",
  carboxylicAcid: "carboxylic acid", ester: "ester", amine: "amine", amide: "amide", nitrile: "nitrile", nitro: "nitro",
};
test("AUDNOM-011: all original Legacy EN findings use English functional labels; Spanish stays localized", () => {
  const records = affected("AUDNOM-011");
  assert.equal(records.length, 76);
  for (const record of records) {
    const observed = observe(chemistry.engine, record.smiles);
    const english = project(chemistry.engine, observed, "1979-en");
    assertReasoningIntegrity(english, observed.molecule);
    for (const step of english.steps) assert.doesNotMatch(step.explanation,
      /principal (?:halogenuro|amida|amina|éster|éter|nitrilo|aldehído|cetona|ácido carboxílico)\b/i,
      `${record.id}: ${step.explanation}`);
    const group = english.analysis.primaryFunctionalGroup;
    const functionalLocants = english.analysis.functionalGroups
      .filter((item) => item.kind === group)
      .flatMap((item) => item.carbonIds.map((id) => english.analysis.numberedAtoms.get(id)))
      .filter((locant) => locant !== undefined);
    if (group && functionalLocants.length) {
      assert.ok(english.steps.some((step) => step.explanation.includes(`The principal ${englishFunctionalLabels[group]} is at C${functionalLocants.join(", ")}.`)),
        `${record.id}/${group}: ${english.steps.map((step) => step.explanation).join(" ")}`);
    }
    if (observed.profiles["1979-es"].name) {
      const spanish = project(chemistry.engine, observed, "1979-es");
      assertReasoningIntegrity(spanish, observed.molecule);
      assert.ok(spanish.steps.some((step) => step.explanation.includes("La función principal ("))
        || !functionalLocants.length, `${record.id}: Spanish Legacy explanation retains its Spanish label`);
    }
  }
});
