import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { moleculeFromSmiles, inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { loadExerciseChemistry } from '../tests/helpers/exercise-chemistry.mjs';
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';
import { analyzeBoth, displayedProfiles } from './naming-audit/evaluate.mjs';

const diacids = [
  ['2,3', 'n1c(C(=O)O)c(C(=O)O)ccc1'],
  ['2,4', 'n1c(C(=O)O)cc(C(=O)O)cc1'],
  ['2,5', 'n1c(C(=O)O)ccc(C(=O)O)c1'],
  ['2,6', 'n1c(C(=O)O)cccc1C(=O)O'],
  ['3,4', 'n1cc(C(=O)O)c(C(=O)O)cc1'],
  ['3,5', 'n1cc(C(=O)O)cc(C(=O)O)c1'],
];
const controls = [
  ...diacids.map(([locants, smiles]) => ({
    id: `pyridine-${locants}-dicarboxylic acid`, smiles,
    expectedEs: `ácido piridina-${locants}-dicarboxílico`,
    expectedEn: `pyridine-${locants}-dicarboxylic acid`,
  })),
  {
    id: 'pyridine-2-carboxylic acid', smiles: 'O=C(O)c1ccccn1',
    expectedEs: 'ácido piridina-2-carboxílico', expectedEn: 'pyridine-2-carboxylic acid',
  },
];
const java = 'C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar = 'C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const chemistry = await loadExerciseChemistry();
const rows = [];
try {
  for (const control of controls) {
    const imported = moleculeFromSmiles(control.smiles);
    if (!imported.ok) throw new Error(`${control.id}: fixture import failed: ${imported.error}`);
    const { molecule } = imported;
    const profiles = displayedProfiles(molecule, analyzeBoth(molecule, chemistry.engine), chemistry.engine);
    const es = profiles['2013-es'].name;
    const en = profiles['2013-en'].name;
    const process = spawnSync(java, ['-jar', jar, '-osmi', '-f'], {
      input: `${en ?? ''}\n`, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    const smiles = (process.stdout ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) ?? null;
    const referenceIdentity = structuralIdentity(control.smiles);
    const interpretedIdentity = smiles ? structuralIdentity(smiles) : null;
    rows.push({
      id: control.id, referenceSmiles: control.smiles,
      formula: inspectSmilesStructure(control.smiles).formula,
      currentEs: es, expectedEs: control.expectedEs,
      currentEn: en, expectedEn: control.expectedEn,
      esExact: es === control.expectedEs, enExact: en === control.expectedEn,
      fullProofEs: Boolean(profiles['2013-es'].fullProof),
      fullProofEn: Boolean(profiles['2013-en'].fullProof),
      opsinSmiles: smiles,
      opsinEquivalent: process.status === 0 && referenceIdentity === interpretedIdentity,
      referenceIdentity, interpretedIdentity,
      opsinExitCode: process.status,
      stderr: process.stderr ?? '',
    });
  }
} finally {
  await chemistry.close();
}
const result = {
  audit: 'B6.2.2 fresh replay of B6.2.1 controls',
  executedAt: new Date().toISOString(),
  interpreter: 'OPSIN 2.9.0 local CLI; Java Temurin 21.0.13+9-jre',
  comparator: 'OpenChemLib 9.25.0 structuralIdentity, shared with OrgoRush',
  result: rows.every((row) => row.esExact && row.enExact && !row.fullProofEs && !row.fullProofEn && row.opsinEquivalent)
    ? 'PASS' : 'FAIL',
  count: rows.length,
  equivalent: rows.filter((row) => row.opsinEquivalent).length,
  fullPromotions: rows.filter((row) => row.fullProofEs || row.fullProofEn).length,
  rows,
};
mkdirSync('reports/b622', { recursive: true });
writeFileSync('reports/b622/b621-controls.json', `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ result: result.result, count: result.count, equivalent: result.equivalent, fullPromotions: result.fullPromotions }, null, 2));
if (result.result !== 'PASS') process.exitCode = 1;
