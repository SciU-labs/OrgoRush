import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";

import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { translateSpanishIupacToOpsin } from "../app/iupac-name-normalization.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
let server;
let analyzeMolecule;
let buildIupacReasoningSteps;
let buildEnglishReasoningSteps;

before(async () => {
  server = await createServer({ root: projectRoot, configFile: false, logLevel: "error", appType: "custom",
    plugins: [react()], server: { middlewareMode: true, hmr: false } });
  ({ analyzeMolecule, buildIupacReasoningSteps, buildEnglishReasoningSteps }
    = await server.ssrLoadModule("/app/page.tsx"));
});

after(async () => server?.close());

const cases = [
  ["longer saturated alkene competitor", "C=CC(CCC)CCCC", "4-eteniloctano", "4-ethenyloctane", 8, [], [], 7, [1], []],
  ["longer saturated alkyne competitor", "C#CC(CCC)CCCC", "4-etiniloctano", "4-ethynyloctane", 8, [], [], 7, [], [1]],
  ["numbered prop-2-en-1-yl substituent", "C=CCC(CCCC)CCCC", "5-(prop-2-en-1-il)nonano", "5-(prop-2-en-1-yl)nonane", 9, [], [], 8, [1], []],
  ["numbered prop-2-yn-1-yl substituent", "C#CCC(CCCC)CCCC", "5-(prop-2-in-1-il)nonano", "5-(prop-2-yn-1-yl)nonane", 9, [], [], 8, [], [1]],
  ["equal maximum chains with alkene", "C=CC(CC)CC", "3-etilpent-1-eno", "3-ethylpent-1-ene", 5, [1], [], 5, [1], []],
  ["equal maximum chains with alkyne", "C#CC(CC)CC", "3-etilpent-1-ino", "3-ethylpent-1-yne", 5, [], [1], 5, [], [1]],
  ["same maximum length alkene path", "C=CC(CCC)CC", "3-etilhex-1-eno", "3-ethylhex-1-ene", 6, [1], [], 6, [1], []],
  ["same maximum length alkyne path", "C#CC(CCC)CC", "3-etilhex-1-ino", "3-ethylhex-1-yne", 6, [], [1], 6, [], [1]],
  ["alcohol suffix and equal-length unsaturated path", "OCC(CCC)CC=C", "2-propilpent-4-en-1-ol", "2-propylpent-4-en-1-ol", 5, [4], [], 5, [4], []],
  ["aldehyde suffix and equal-length unsaturated path", "O=CC(CCC)CC=C", "2-propilpent-4-enal", "2-propylpent-4-enal", 5, [4], [], 5, [4], []],
  ["ketone suffix and equal-length unsaturated path", "CC(=O)C(CCC)CC=C", "3-propilhex-5-en-2-ona", "3-propylhex-5-en-2-one", 6, [5], [], 6, [5], []],
  ["carboxylic acid suffix and equal-length unsaturated path", "O=C(O)C(CCC)CC=C", "ácido 2-propilpent-4-enoico", "2-propylpent-4-enoic acid", 5, [4], [], 5, [4], []],
  ["alcohol suffix and equal-length alkynyl path", "OCC(CCC)CC#C", "2-propilpent-4-in-1-ol", "2-propylpent-4-yn-1-ol", 5, [], [4], 5, [], [4]],
];

test("Blue Book 2013 parent selection honors length before unsaturation, then suffix priority", () => {
  cases.forEach(([label, smiles, expectedEs, expectedEn, parentAtoms, doubleLocants, tripleLocants,
    legacyParentAtoms, legacyDoubleLocants, legacyTripleLocants]) => {
    const converted = moleculeFromSmiles(smiles);
    assert.equal(converted.ok, true, converted.ok ? undefined : converted.error);
    const molecule = converted.molecule;
    const before = moleculeToSmiles(molecule);
    assert.equal(before.ok, true);
    const blueBook = analyzeMolecule(molecule);
    const legacy = analyzeMolecule(molecule, [], "iupac-1979-legacy");
    const after = moleculeToSmiles(molecule);
    assert.deepEqual(after, before, `${label}: naming must not mutate the graph`);
    assert.equal(blueBook.name, expectedEs, `${label}: Spanish Blue Book 2013 name`);
    assert.equal(translateSpanishIupacToOpsin(blueBook.name), expectedEn,
      `${label}: English Blue Book 2013 name from the same analysis`);
    assert.equal(blueBook.mainChain.length, parentAtoms, `${label}: parent-chain length`);
    assert.deepEqual(blueBook.doubleBondLocants, doubleLocants, `${label}: parent double-bond locants`);
    assert.deepEqual(blueBook.tripleBondLocants, tripleLocants, `${label}: parent triple-bond locants`);
    assert.equal(legacy.mainChain.length, legacyParentAtoms, `${label}: separate 1979 parent-chain selection`);
    assert.deepEqual(legacy.doubleBondLocants, legacyDoubleLocants, `${label}: 1979 double-bond locants`);
    assert.deepEqual(legacy.tripleBondLocants, legacyTripleLocants, `${label}: 1979 triple-bond locants`);
    for (const group of blueBook.functionalGroups) {
      if (blueBook.primaryFunctionalGroup === group.kind) {
        assert.ok(group.carbonIds.some((carbonId) => blueBook.mainChain.includes(carbonId)),
          `${label}: principal functional group remains in the selected parent`);
      }
    }
    if (label === "longer saturated alkene competitor" || label === "longer saturated alkyne competitor") {
      const spanishSteps = buildIupacReasoningSteps(molecule, blueBook);
      const englishSteps = buildEnglishReasoningSteps(spanishSteps, molecule, blueBook);
      const spanishUnsaturation = spanishSteps.find(({ nameRole }) => nameRole === "unsaturation");
      const englishUnsaturation = englishSteps.find(({ nameRole }) => nameRole === "unsaturation");
      const spanishSubstituent = spanishSteps.find(({ nameRole }) => nameRole === "substituent");
      const englishSubstituent = englishSteps.find(({ nameRole }) => nameRole === "substituent");
      assert.match(spanishUnsaturation?.explanation ?? "", /enlace (?:doble|triple).*fuera de la cadena principal seleccionada.*octano conserva -ano/);
      assert.match(englishUnsaturation?.explanation ?? "", /C(?:=|≡)C (?:double|triple) bond.*outside the selected parent chain.*octane retains -ane/);
      assert.match(spanishSubstituent?.explanation ?? "", /grupo (?:etenilo|etinilo) unido al carbono 4/);
      assert.match(englishSubstituent?.explanation ?? "", /(?:ethenyl|ethynyl) group attached at C4/);
    }
  });
});
