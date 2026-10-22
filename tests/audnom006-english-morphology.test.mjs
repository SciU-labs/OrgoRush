import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { evidenceMap, interpretName } from "../scripts/naming-audit/evidence.mjs";
import { translateSpanishIupacForDisplay, translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";
import { assertReasoningIntegrity, project, observe } from "./helpers/reasoning-integrity.mjs";
import { methylPhenylCases, assertValidatedArylProfiles } from "./helpers/audnom008-aryl.mjs";

const isotopeAuditPath = new URL("../reports/naming-audit/aud-nom-005/rule-derived-candidate-receipts.json", import.meta.url);
const candidateReceipts = evidenceMap(JSON.parse(readFileSync(isotopeAuditPath, "utf8")));
const historicalMatrix = JSON.parse(readFileSync(new URL("../reports/naming-audit/audit-matrix.json", import.meta.url), "utf8"));

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

test("AUD-NOM-006 fixes modern English morphology while preserving profiles, graph and interactive name evidence", () => {
  const fixtures = [
    {
      id: "AUDCASE-0160", smiles: "c1(C=C)ccc(Cl)cc1", expected: "1-chloro-4-ethenylbenzene",
      spanish: "1-cloro-4-vinilbenceno", legacyEnglish: "1-chloro-4-ethenylbenzene", legacySpanish:"1-cloro-4-etenilbenceno",
      formula: "C₈H₇Cl", locant: 4, moiety: "ethenyl",
    },
    {
      id: "AUDCASE-0337", smiles: "CCCCCC(C)OCCCCC", expected: "2-pentyloxyheptane",
      spanish: "2-pentoxiheptano", legacyEnglish: "2-pentoxiheptane",
      formula: "C₁₂H₂₆O", locant: 2, moiety: "pentyloxy",
    },
  ];

  for (const fixture of fixtures) {
    const observed = observe(chemistry.engine, fixture.smiles);
    const { molecule, analyses, profiles } = observed;
    assert.equal(molecule.atoms.length > 0, true, fixture.id);
    assert.equal(analyses.current.formula, fixture.formula, `${fixture.id}: formula`);
    assert.equal(profiles["2013-es"].name, fixture.spanish, `${fixture.id}: Spanish output unchanged`);
    assert.equal(profiles["2013-en"].name, fixture.expected, `${fixture.id}: 2013 EN`);
    assert.equal(profiles["1979-en"].name, fixture.legacyEnglish,
      `${fixture.id}: Legacy retains its separately adjudicated status and wording`);
    assert.equal(profiles["1979-es"].name, fixture.legacySpanish??null, `${fixture.id}: graph-verified Legacy coverage`);
    assert.deepEqual(chemistry.engine.analyzeMolecule(molecule), analyses.current, `${fixture.id}: repeat analysis is deterministic`);
    assert.deepEqual(chemistry.engine.analyzeMolecule(molecule, [], "iupac-1979-legacy"), analyses.legacy,
      `${fixture.id}: repeat Legacy analysis is deterministic`);
    assert.deepEqual(chemistry.engine.analyzeMolecule(molecule).mainChain, analyses.current.mainChain,
      `${fixture.id}: parent numbering is stable`);

    const candidate = interpretName(fixture.expected, fixture.smiles, candidateReceipts);
    assert.equal(candidate.status, "MATCH", `${fixture.id}: stored independent OPSIN receipt`);
    assert.equal(candidate.constitutionalMatch, true, `${fixture.id}: OPSIN constitution`);

    const reasoning = project(chemistry.engine, observed, "2013-en");
    assertReasoningIntegrity(reasoning, molecule);
    assert.equal(reasoning.links.map(({ text }) => text).join(""), fixture.expected);
    assert.ok(reasoning.links.some((link) => link.text.includes(fixture.moiety) && link.stepNumber),
      `${fixture.id}: visible substituent maps to a valid reasoning destination`);
    for (const link of reasoning.links) {
      for (const target of [link.stepNumber, ...(link.relatedStepNumbers ?? [])].filter(Boolean)) {
        assert.ok(reasoning.steps.some((step) => step.number === target), `${fixture.id}: valid navigation target ${target}`);
      }
    }
  }

  assert.equal(translateSpanishIupacForDisplay("1-cloro-4-vinilbenceno"), "1-chloro-4-ethenylbenzene");
  assert.equal(translateSpanishIupacForDisplay("2-pentoxiheptano"), "2-pentyloxyheptane");
});

test("the English translator handles ring-position neighbors and root-derived alkoxy homologues only at prefix boundaries", () => {
  for (const [spanish, english] of [
    ["1-cloro-2-vinilbenceno", "1-chloro-2-ethenylbenzene"],
    ["1-cloro-3-vinilbenceno", "1-chloro-3-ethenylbenzene"],
    ["1-cloro-4-vinilbenceno", "1-chloro-4-ethenylbenzene"],
    ["1-cloro-4-metilbenceno", "1-chloro-4-methylbenzene"],
    ["2-metoxiheptano", "2-methoxyheptane"],
    ["2-etoxiheptano", "2-ethoxyheptane"],
    ["2-propoxiheptano", "2-propoxyheptane"],
    ["2-butoxiheptano", "2-butoxyheptane"],
    ["2-pentoxiheptano", "2-pentyloxyheptane"],
    ["2-hexoxiheptano", "2-hexyloxyheptane"],
    ["2-heptoxiheptano", "2-heptyloxyheptane"],
    ["2-octoxiheptano", "2-octyloxyheptane"],
    ["2-nonoxiheptano", "2-nonyloxyheptane"],
    ["2-decoxiheptano", "2-decyloxyheptane"],
    ["2-etoxi-4-metilpentano", "2-ethoxy-4-methylpentane"],
    ["2-pentoxi-4-metilheptano", "2-pentyloxy-4-methylheptane"],
    ["1-(1-metiletoxi)butano", "1-(1-methylethoxy)butane"],
    ["(2R,4E)-2-pentoxihept-4-eno", "(2R,4E)-2-pentyloxyhept-4-ene"],
  ]) {
    assert.equal(translateSpanishIupacForDisplay(spanish), english, spanish);
    assert.equal(translateSpanishIupacToOpsin(english), english, `${english}: English idempotence`);
  }
  assert.equal(translateSpanishIupacForDisplay("hipentoxiheptano"), "hipentoxiheptane",
    "alkoxy conversion must not match inside an unrelated word");
  assert.equal(translateSpanishIupacForDisplay("1-cloro-4-vinilbenceno"), "1-chloro-4-ethenylbenzene",
    "the locant after a halogen prefix remains separated");

  for (const [smiles, expected] of [
    ["c1(C=C)c(Cl)cccc1", "1-chloro-2-ethenylbenzene"],
    ["c1(C=C)cc(Cl)ccc1", "1-chloro-3-ethenylbenzene"],
    ["c1(C=C)ccc(Cl)cc1", "1-chloro-4-ethenylbenzene"],
  ]) {
    const { profiles } = observe(chemistry.engine, smiles);
    assert.equal(profiles["2013-en"].name, expected, `${smiles}: ortho/meta/para current English output`);
  }
});

test("historical AUDCASE-0171/0176 require complete validated modern names after AUD-NOM-008; Legacy remains unavailable", () => {
  for (const id of ["AUDCASE-0171", "AUDCASE-0176"]) {
    const source = historicalMatrix.records.find((record) => record.id === id);
    assert.ok(source, `${id}: historical structure exists`);
    const { profiles } = observe(chemistry.engine, source.smiles);
    // Explicitly supersedes the earlier blanket gate with exact structural
    // evidence; the old methyl-omitting name can never satisfy this assertion.
    assertValidatedArylProfiles(profiles, methylPhenylCases.find((item) => item.id === id));
  }
});
