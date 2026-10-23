import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";

export function emittedJavaScriptSha256(source, fileName) {
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, removeComments: true,
  }, fileName }).outputText;
  return createHash("sha256").update(output).digest("hex");
}

// Parse complete tsc messages, including continuation lines, without changing
// the compiler's exit status. This script only inventories a captured log.
export function parseDiagnostics(log) {
  return [...log.matchAll(/^(.+?)\((\d+),(\d+)\): error (TS\d+): ([\s\S]*?)(?=^.+?\(\d+,\d+\): error TS\d+:|$(?![\s\S]))/gm)]
    .map((match) => ({ file: match[1].replaceAll("\\", "/"), line: Number(match[2]),
      column: Number(match[3]), code: match[4], message: match[5].trim() }));
}

const causes = [
  ["ring-alias", "B/C", "app/chemistry-document-validation.ts", 200, 240,
    "El alias de un Record pierde el estrechamiento de atomIds realizado sobre candidate.",
    "Conservar atomIds en una constante después de Array.isArray; mantener todas las validaciones."],
  ["view-mode-union", "A/B", "app/chemistry-document-validation.ts", 241, 270,
    "Se mezclan el retorno nullable V1 y la unión discriminada V2 antes de discriminar la versión.",
    "Reutilizar decodeVersionedViewMode, cuyo contrato ya es ViewMode | null."],
  ["optional-endpoint", "B", "app/condensed-layout.ts", 180, 200,
    "Array.at permite undefined y Map.get exige una clave numérica.",
    "Representar los extremos del recorrido no vacío con índices y conservar la selección."],
  ["branch-discriminator", "A/C", "app/condensed-layout.ts", 300, 320,
    "Extract busca un discriminante individual en una variante que reúne dos literales: produce never.",
    "Separar las variantes branch-open y branch-close y relacionar sus textos exactos."],
  ["fused-record", "C", "app/fused-ring-nomenclature.ts", 0, Infinity,
    "Object.fromEntries no garantiza todas las claves A/B/C/D del Record y deduce never[].",
    "Inicializar explícitamente el Record completo con cuatro arreglos tipados."],
  ["runtime-target", "E", "app/iupac-name-normalization.ts", 0, Infinity,
    "target ES2017 contradice los grupos de captura ES2018 ya usados y el build Pages ES2020.",
    "Alinear target con ES2020 sin reducir strict ni las comprobaciones de nulidad."],
  ["callback-flow", "C", "app/name-suggestions.ts", 0, Infinity,
    "El análisis de flujo no incorpora las asignaciones a best dentro de forEach.",
    "Recorrer los candidatos con for...of manteniendo orden, cálculo y desempate."],
  ["duplicate-property", "A", "app/name-to-molecule.ts", 0, Infinity,
    "carbonCount se declara explícitamente y también en parentTail, del que ya se extrajo.",
    "Conservar la propiedad de parentTail, eliminando únicamente la escritura redundante."],
  ["ocl-discriminator", "B", "app/page.tsx", 2360, 2380,
    "La existencia de ring no implica para TypeScript que converted.ok sea true.",
    "Retornar temprano si falla converted antes de usar converted.molecule."],
  ["aromatic-bond-contract", "A", "app/page.tsx", 4700, 5500,
    "El razonamiento declara arreglos de números, pero los enlaces admiten orden opcional y marca E/Z booleana.",
    "Declarar la tupla de extremos, orden opcional y metadatos que la función realmente lee."],
  ["viewport-contract", "A", "app/page.tsx", 11000, 11100,
    "El estado exige padding aunque los bounds condensados sólo aportan el rectángulo usado por la vista.",
    "Usar el contrato de rectángulo común para el estado; preservar los valores calculados."],
  ["exhaustive-result", "A", "app/page.tsx", 11800, 11830,
    "El JSX exterior ya excluye invalid-formula y el ternario consume todos los demás estados: la rama final es never.",
    "Usar invalid-response como última rama exhaustiva y conservar exactamente su texto traducido."],
  ["semantic-selection", "A/B", "app/page.tsx", 14600, 14900,
    "El selector pide un semanticId requerido pero los fragmentos pueden no tenerlo; el estrechamiento de propiedad no transforma el objeto entero.",
    "Recibir el semanticId string que ya comprueban los controles y tipar el callback con el valor validado."],
  ["path-endpoint", "B", "app/semi-developed-layout.ts", 0, Infinity,
    "Map.get devuelve un átomo opcional para el último extremo de la ruta.",
    "Estrechar ambos extremos antes de comparar, manteniendo la orientación en datos válidos."],
  ["stereo-layout-contract", "A", "app/skeletal-layout.ts", 0, Infinity,
    "El modelo de layout omite elementos, órdenes y anillos leídos por la inspección E/Z, y ofrece arreglos readonly al contrato mutable.",
    "Derivar el modelo de lectura de StereoMolecule y adaptar explícitamente la copia mutable usada para inspección E/Z."],
  ["worker-runtime", "D", "db/index.ts", 0, Infinity,
    "Faltan declaraciones del protocolo cloudflare:workers y de sus bindings reales.",
    "Incorporar tipos oficiales del runtime y un contrato explícito para los bindings configurados."],
  ["worker-runtime", "D", "worker/index.ts", 0, Infinity,
    "Fetcher y D1Database pertenecen al runtime Worker, no a DOM ni Node.",
    "Importar tipos oficiales de Worker y compartir el contrato de bindings."],
];

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/quality-010-diagnostics.mjs")) {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) throw new Error("Usage: node scripts/quality-010-diagnostics.mjs input.log inventory.json");
  const log = readFileSync(input, "utf8");
  const all = parseDiagnostics(log);
  const active = all.filter(({ file }) => !file.startsWith("outputs/"));
  const inventory = active.map((diagnostic, index) => {
    const cause = causes.find(([, , file, low, high]) => diagnostic.file === file
      && diagnostic.line >= low && diagnostic.line <= high);
    if (!cause) throw new Error(`Unclassified diagnostic: ${JSON.stringify(diagnostic)}`);
    return { id: `TS010-${String(index + 1).padStart(2, "0")}`, ...diagnostic,
      rootCause: cause[0], category: cause[1], cause: cause[5], proposedSolution: cause[6],
      dependency: `Los diagnósticos con rootCause=${cause[0]} comparten corrección.` };
  });
  const artifactCounts = {};
  for (const { file } of all.filter(({ file }) => file.startsWith("outputs/"))) {
    const artifact = file.slice(0, file.indexOf("/app/") > 0 ? file.indexOf("/app/") : file.lastIndexOf("/"));
    artifactCounts[artifact] = (artifactCounts[artifact] ?? 0) + 1;
  }
  const emittedJavaScript = Object.fromEntries(["app/double-bond-stereochemistry.ts", "app/skeletal-layout.ts",
    "app/molecule-2d-layout.ts", "app/reasoning-aromatic-substituents.ts"].map(path => [path,
    emittedJavaScriptSha256(execFileSync("git", ["show", `961971e:${path}`], { encoding: "utf8" }), path)]));
  writeFileSync(output, JSON.stringify({ reference: "961971e330f12101785fc42de3727d5aef4b6ce8", emittedJavaScript,
    command: "node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false",
    exitCode: 2, totalDiagnostics: all.length, activeDiagnostics: active.length,
    archivedDiagnostics: all.length - active.length, inputSha256: createHash("sha256").update(log).digest("hex"),
    artifactCounts, inventory }, null, 2) + "\n");
  console.log(JSON.stringify({ total: all.length, active: active.length, archived: all.length - active.length }));
}
