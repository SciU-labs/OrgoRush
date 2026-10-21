import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadExerciseChemistry } from "../tests/helpers/exercise-chemistry.mjs";
import { auditCyclicCases, cyclicCounts } from "../tests/helpers/cyclic-audit-003.mjs";
const chemistry = await loadExerciseChemistry();
try {
  const cases = auditCyclicCases(chemistry.engine), counts = cyclicCounts(cases);
  const path = resolve(process.argv[2] ?? "reports/orgorush-iupac79-cyclic-audit-003.matrix.json");
  const baselinePath = resolve("reports/orgorush-iupac79-cyclic-audit-003.baseline.json");
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : undefined;
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify({ profile: "iupac-1979-legacy", deduplication: "OpenChemLib CanonizerUtil.NORMAL; graph identity before counting", counts, baselineCounts: baseline?.counts, cases }, null, 2) + "\n");
  const cell = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  const table = ["# Matriz cíclica IUPAC 1979 — AUDIT-003", "", "Generada por `node scripts/audit-iupac79-cyclic-003.mjs`. El JSON adjunto conserva el grafo y las cinco observaciones por estructura.", "", "| ID / familia | SMILES / fórmula / topología | Referencia ES / EN | Regla | Generado ES / EN | Resultado |", "| --- | --- | --- | --- | --- | --- |"];
  for (const row of cases) {
    const values = [...new Set(row.variants.map(v => `${v.es} / ${v.en}`))].join("; ");
    table.push(`| ${[`${row.id} (${row.family})`, `${row.smiles} · ${row.formula} · ${row.topology} · rango ${row.cycleRank}`, `${row.es} / ${row.en}`, row.rule, values, row.status].map(cell).join(" | ")} |`);
  }
  writeFileSync(path.replace(/\.json$/, ".md"), table.join("\n") + "\n");
  console.log(JSON.stringify({ path, total: cases.length, counts }, null, 2));
  if (cases.some(row => row.status === "FAIL" || (row.target && row.status !== "PASS"))) process.exitCode = 1;
} finally { await chemistry.close(); }
