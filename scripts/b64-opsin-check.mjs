import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';
import { inspectSmilesStructure } from '../app/openchemlib-adapter.ts';

const java = 'C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar = 'C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const reference = JSON.parse(readFileSync('tests/fixtures/b50-pubchem-rings.json', 'utf8')).records.find(x => x.cid === 7439);
const names = [
  '2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one',
  '2-methyl-5-(1-methylethen-1-yl)cyclohex-2-en-1-one',
  '2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one',
  '2-methyl-5-isopropenylcyclohex-2-en-1-one',
  '2-methyl-5-(1-methylvinyl)cyclohex-2-en-1-one',
];
for (const name of names) {
  const result = spawnSync(java, ['-jar', jar, '-osmi', '-f'], { input: `${name}\n`, encoding: 'utf8', timeout: 30000, windowsHide: true });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const smiles = result.stdout.trim().split(/\r?\n/).at(-1);
  if (!smiles) { console.log(JSON.stringify({ name, status: 'UNRECOGNIZED', stderr: result.stderr.trim() })); continue; }
  const same = structuralIdentity(smiles) === structuralIdentity(reference.smiles);
  const inspection = inspectSmilesStructure(smiles);
  assert.ok(inspection.ok);
  assert.equal(inspection.formula,reference.formula);
  console.log(JSON.stringify({ name, status: 'SUCCESS', opsinVersion:'2.9.0', smiles, formula:inspection.formula, same, stderr: result.stderr.trim() }));
  assert.ok(same, `${name}: graph differs from fixture`);
}
const variants = ['C=C(C)C1CCCCC1', 'C=CCC1CCCCC1', 'CC(C)C1CCCCC1', 'C=CC1CCCCC1', 'C=C1CCCCC1'];
assert.equal(new Set(variants.map(structuralIdentity)).size, variants.length, 'distinct groups and exocyclic connectivity');
console.log('Five negative-control graphs are distinct.');
