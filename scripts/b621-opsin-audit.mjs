import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';

const java = 'C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar = 'C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const cases = [
  ['pyridine-2,3-dicarboxylic acid', 'n1c(C(=O)O)c(C(=O)O)ccc1'],
  ['pyridine-2,4-dicarboxylic acid', 'n1c(C(=O)O)cc(C(=O)O)cc1'],
  ['pyridine-2,5-dicarboxylic acid', 'n1c(C(=O)O)ccc(C(=O)O)c1'],
  ['pyridine-2,6-dicarboxylic acid', 'n1c(C(=O)O)cccc1C(=O)O'],
  ['pyridine-3,4-dicarboxylic acid', 'n1cc(C(=O)O)c(C(=O)O)cc1'],
  ['pyridine-3,5-dicarboxylic acid', 'n1cc(C(=O)O)cc(C(=O)O)c1'],
  ['pyridine-2-carboxylic acid', 'O=C(O)c1ccccn1'],
];

const results = cases.map(([name, referenceSmiles]) => {
  const result = spawnSync(java, ['-jar', jar, '-osmi'], {
    input: `${name}\n`, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  const opsinSmiles = result.stdout?.trim().split(/\r?\n/).at(-1) ?? '';
  if (result.error || result.status !== 0 || !opsinSmiles) {
    throw new Error(`OPSIN failed for ${name}: ${result.error ?? result.stderr ?? result.status}`);
  }
  const original = inspectSmilesStructure(referenceSmiles);
  const interpreted = inspectSmilesStructure(opsinSmiles);
  const equivalent = structuralIdentity(referenceSmiles) === structuralIdentity(opsinSmiles);
  return {
    name,
    referenceSmiles,
    opsinSmiles,
    referenceFormula: original.formula,
    opsinFormula: interpreted.formula,
    equivalent,
  };
});

if (results.some((result) => !result.equivalent || result.referenceFormula !== result.opsinFormula)) {
  throw new Error(`OPSIN structural mismatch:\n${JSON.stringify(results.filter((result) => !result.equivalent), null, 2)}`);
}

const report = {
  audit: 'B6.2.1 local independent OPSIN comparison',
  interpreter: 'OPSIN 2.9.0 local CLI; Java Temurin 21.0.13+9-jre',
  comparison: 'OpenChemLib structural identity (shared comparator; not an independent graph canonicalizer)',
  result: 'PASS',
  cases: results,
};
await mkdir('reports/b621', { recursive: true });
await writeFile('reports/b621/opsin.json', JSON.stringify(report, null, 2) + '\n');
console.log(`OPSIN equivalent: ${results.length}/${results.length}`);
