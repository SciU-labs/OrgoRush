// Optional coverage observation, never an admission gate for this Lab audit.
import { readFileSync, writeFileSync } from "node:fs";
import { moleculeFromSmiles } from "../../app/openchemlib-adapter.ts";
import { EXERCISE_CATEGORIES } from "../../app/exercise-model.ts";
import { validateExerciseDomain, EXERCISE_DOMAIN_VERSION } from "../../app/exercise-domain.ts";
import { loadExerciseChemistry } from "../../tests/helpers/exercise-chemistry.mjs";

const directory = new URL("../../reports/naming-audit/", import.meta.url);
const matrix = JSON.parse(readFileSync(new URL("audit-matrix.json", directory), "utf8"));
const chemistry = await loadExerciseChemistry(), rows = [];
try {
  for (const record of matrix.records) {
    const imported = moleculeFromSmiles(record.smiles);
    if (!imported.ok || record.properties.importExportIdentity.status === "FAIL") {
      rows.push({ id: record.id, status: "NOT_ASSESSED", reason: imported.ok ? "Lossy Lab import must not establish admission for the original graph" : imported.error });
      continue;
    }
    const rejected = [];
    let accepted;
    for (const category of EXERCISE_CATEGORIES) {
      const observed = validateExerciseDomain(imported.molecule, category, chemistry.oracles);
      if (observed.valid) { accepted = category; break; }
      rejected.push({ category, reason: observed.reason });
    }
    rows.push({ id: record.id, status: accepted ? "ACCEPTED" : "OUTSIDE_ALL_CURRENT_CATEGORIES", ...(accepted ? { acceptedCategory: accepted } : { rejected }) });
  }
  writeFileSync(new URL("practice-envelope-observations.json", directory), `${JSON.stringify({
    domainVersion: EXERCISE_DOMAIN_VERSION, categories: EXERCISE_CATEGORIES,
    policy: "Supplementary production-validator observation only. No candidate was excluded from naming because of this result. Exact profile policy of the protected corpus remains narrower than the complete Lab.", rows,
  }, null, 2)}\n`);
  console.log(JSON.stringify(rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})));
} finally { await chemistry.close(); }
