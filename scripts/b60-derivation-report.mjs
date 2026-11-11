import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { analyzeBoth, displayedProfiles } from './naming-audit/evaluate.mjs';
import { loadExerciseChemistry } from '../tests/helpers/exercise-chemistry.mjs';
import { resolveDerivationConsistency } from '../app/derivation-consistency.ts';
import { deriveStructuralComponents } from '../app/structural-derivation.ts';
import { validatedNameTargets } from '../app/validated-name-derivation.ts';

const stage = process.argv[2];
if (!['initial', 'final'].includes(stage)) throw new Error('Expected initial or final');
const { records } = JSON.parse(await readFile(new URL('../tests/fixtures/b50-pubchem-rings.json', import.meta.url), 'utf8'));
const chemistry = await loadExerciseChemistry();
try {
  const rows = records.map(record => {
    const imported = moleculeFromSmiles(record.smiles);
    if (!imported.ok) throw new Error(imported.error);
    const graph = imported.molecule, analyses = analyzeBoth(graph, chemistry.engine);
    const profiles = displayedProfiles(graph, analyses, chemistry.engine);
    return { cid: record.cid, imported: true, formula: record.formula, profiles: Object.fromEntries(['es', 'en'].map(language => {
      const name = profiles[`2013-${language}`].name;
      const result = name ? resolveDerivationConsistency({ molecule: graph, activeName: name, language, activeProfile: 'current' }) : null;
      const proof = result?.derivation;
      const status = !name ? 'UNSUPPORTED' : proof ? 'FULL' : deriveStructuralComponents(graph, name).status;
      return [language, { name, status, independentlyParsed: proof?.name === name, preferred: proof?.preferred ?? false,
        principalGroup: proof?.principalGroup ?? null, parent: proof?.components.find(c => c.id === 'parent') ?? null,
        components: proof?.components ?? [], evidence: proof?.evidence ?? null,
        targets: proof ? validatedNameTargets(proof) : null }];
    })) };
  });
  const counts = { FULL: 0, PARTIAL: 0, UNSUPPORTED: 0 };
  rows.flatMap(row => Object.values(row.profiles)).forEach(profile => counts[profile.status]++);
  await mkdir(new URL('../reports/b60/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../reports/b60/${stage}.json`, import.meta.url), JSON.stringify({ stage, counts, rows }, null, 2) + '\n');
  console.log(JSON.stringify({ stage, counts, rows: rows.map(row => ({cid:row.cid, es:row.profiles.es.name, en:row.profiles.en.name, status:[row.profiles.es.status,row.profiles.en.status]})) }, null, 2));
} finally { await chemistry.close(); }
