import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { VALIDATION_CASES, PROFILES } from "../tests/fixtures/orgorush-validation-008.mjs";
import { identity } from "./validation-008-audit.mjs";

const reportPath = new URL("../reports/orgorush-validation-008.md", import.meta.url);
const matrix = JSON.parse(readFileSync(new URL("../reports/orgorush-validation-008.matrix.json", import.meta.url), "utf8"));
const records = matrix.records;
const statuses = ["PASS", "FAIL-NAME", "FAIL-STRUCTURE", "FAIL-REASONING", "UNSUPPORTED", "PENDING-REFERENCE"];
const statusOf = view => view.classification ?? "PENDING-REFERENCE";
const counts = Object.fromEntries(PROFILES.map(profile => [profile, Object.fromEntries(statuses.map(status => [status,
  records.filter(row => statusOf(row.variants[0].profiles[profile]) === status).length]))]));
const old006 = new Set(JSON.parse(readFileSync(new URL("../reports/orgorush-iupac79-fallback-006.audit.json", import.meta.url), "utf8")).map(row => identity(row.smiles)));
const overlap006 = VALIDATION_CASES.filter(row => old006.has(identity(row.smiles))).length;
const logPath = new URL("../outputs/validation-008-tests.log", import.meta.url);
const testLog = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
const tests = /ℹ tests (\d+)/.exec(testLog)?.[1], passed = /ℹ pass (\d+)/.exec(testLog)?.[1], failed = /ℹ fail (\d+)/.exec(testLog)?.[1];
const totals = Object.fromEntries(statuses.map(status => [status, PROFILES.reduce((sum, profile) => sum + counts[profile][status], 0)]));
const sourceLines = Object.entries(matrix.sources).map(([key, source]) => `- **${key}**: [${source.sections}](${source.url}). ${source.use}.`);
const cell = view => {
  const label = view.classification ?? "Sin dictamen: referencia histórica insuficiente";
  return view.observed === view.expected ? `${view.expected} · **${label}**`
    : `Esperado: ${view.expected}; observado: ${view.observed ?? "No disponible"} · **${label}**`;
};
const detailRows = records.map(row => `| ${row.id} (${row.family}) | \`${row.smiles}\` | ${row.formula} | ${PROFILES.map(profile => cell(row.variants[0].profiles[profile])).join(" | ")} |`);
const unsupported = PROFILES.map(profile => `- **${profile}**: ${records.filter(row => row.variants[0].profiles[profile].classification === "UNSUPPORTED").map(row => row.id).join(", ")}.`);
const defects = records.flatMap(row => PROFILES.flatMap(profile => row.variants[0].profiles[profile].issues
  .filter(issue => issue.classification.startsWith("FAIL-")).map(issue => ({ id: row.id, profile, ...issue }))));

const body = `# ORGORUSH-VALIDATION-008

## Dictamen para el piloto educativo

**No se recomienda un piloto general sin corregir las explicaciones aromáticas Legacy y los nombres españoles con sufijos múltiples.** La revisión encuentra ${totals["FAIL-NAME"]} resultados FAIL-NAME y ${totals["FAIL-REASONING"]} FAIL-REASONING entre 216 combinaciones estructura/perfil; son ocho resultados afectados, no ocho causas distintas. Hay además ${totals["UNSUPPORTED"]} resultados expresamente UNSUPPORTED y ${totals["PENDING-REFERENCE"]} sin dictamen por respaldo histórico insuficiente. No se detecta FAIL-STRUCTURE en este corpus.

Los errores de nombres demostrados son de construcción morfológica española; **no se ha demostrado una conectividad equivocada en esos cuatro nombres**. Las explicaciones aromáticas pueden enseñar una distinción incorrecta entre anillo, cadena y raíz. Los dos nombres históricos pendientes no se certifican ni se declaran erróneos sin evidencia adicional.

La auditoría no cambia ningún archivo de producción, no implementa familias, no ajusta el motor a las referencias y no realiza commit ni push. Punto de partida: HEAD \`${matrix.head}\`. Registro UTC: ${matrix.createdAt}.

## Independencia y diseño

Se fijaron **72 constituciones distintas y 216 nombres esperados** antes de observar los nombres de producción. El módulo de referencias no importa código de OrgoRush ni resultados de auditorías previas. Los nombres esperados permanecieron intactos después de la comparación; las adjudicaciones posteriores se guardan en un archivo separado. Ninguna de las 72 constituciones coincide con las 57 de la matriz final FALLBACK-006 (intersección canónica: ${overlap006}). Hay controles clásicos cíclicos y aromáticos que sí pueden aparecer en otros trabajos anteriores; no se afirma que cada molécula sea inédita en todo el repositorio.

La muestra incluye alcanos, insaturaciones simples y múltiples, eninos, ciclos, aromáticos, fusionados, puentes y espiro; alcoholes, aldehídos, cetonas, ácidos, ésteres, éteres, aminas, amidas, nitrilos y funciones mixtas. V008-008 enfrenta deliberadamente la prioridad histórica de insaturación con la prioridad moderna de longitud. V008-071/072 enfrentan cantidad de grupos principales con cadenas más largas o grupos fuera del padre.

Las expectativas son **aplicaciones independientes de reglas**, salvo los ejemplos impresos expresamente identificados. No se afirma que los 216 nombres estén impresos literalmente en el Libro Azul. La fuente de 1979 es la reproducción autorizada de ACD/Labs de la edición de 1979; no se toman los enlaces a las revisiones de 1993 como reglas de 1979. Para español histórico se aplican esas reglas y su sintaxis por separado, utilizando el vocabulario español de la RSEQ; la guía española moderna **no determina el padre ni los locantes históricos**.

Se evalúa nomenclatura sistemática general compatible con cada época, no un concurso de coincidencia con un único PIN. Por ello el locante redundante de V008-020 se admite como variante general inequívoca, respaldada por A-11.3 y por reconstrucción independiente. Se registra su diferencia con el PIN moderno, que omite 1 según P-14.3.4.2(d). No se aceptan variantes solo porque las emita el motor.

Huellas:

- Fixture completo: \`${matrix.referenceValidation.fixtureSha256}\`.
- Nombres, estructuras, grupos y tamaños de padre: \`${matrix.referenceValidation.namesAndStructuresSha256}\`.
- Respuestas OPSIN congeladas: \`${matrix.referenceValidation.opsinSha256}\`.

## Métodos y límites de la verificación

1. Un lector de SMILES independiente y acotado, sin reutilizar detectores del producto, obtiene conectividad, valencias, fórmula y grupos funcionales. Sus fórmulas se contrastan con OpenChemLib; se compara composición, no el orden tipográfico de los elementos.
2. Un enumerador independiente recorre todas las rutas carbonadas acíclicas en ambos sentidos. Aplica prioridad de grupos de sufijo, longitud/insaturación en el orden de cada época, número de dobles enlaces, localizadores y ramificaciones. Los nombres manuales congelados comprueban además sustituyentes y citación alfabética.
3. **105 nombres ingleses de referencia**, modernos e históricos, se verificaron con OPSIN antes de ejecutar el producto. Todas sus estructuras coinciden con los SMILES independientes. Se añadió un testigo para la variante observada 1-cycloheptene: hay **106 respuestas HTTP 200**, congeladas completas con fecha, URL y SHA-256. OPSIN comprueba interpretación estructural; no acredita preferencia ni validez histórica. No se utiliza el traductor de OrgoRush para reconstruir nombres españoles.
4. Se usa la ruta local de selección y resolución de perfiles de la interfaz, sin PubChem ni un nombre importado que sustituya al generado. Cada estructura se evalúa almacenada y con identificadores, orden de átomos/enlaces y coordenadas reflejados: **432 evaluaciones de perfil**. La exportación de ambos grafos conserva la identidad canónica.
5. Se comprueban las fórmulas incluso cuando el nombre está no disponible. En las explicaciones se verifica el análisis activo, inmutabilidad, nombres literales, localizadores, fragmentos del padre, ausencia de solapamiento padre/función/insaturación y destinos de navegación. Los átomos funcionales y los enlaces resaltados se contrastan con el lector independiente, no solo con los grupos detectados por producción.
6. Las raíces se contrastan en contexto. V008-025/026 demuestran que un texto que etiqueta benceno como cadena y le atribuye hex- es pedagógicamente incorrecto aunque el nombre y los átomos resaltados sean correctos.

En sistemas cíclicos se contrasta el padre y el nombre normativo; no se pretende demostrar automáticamente todo el algoritmo de numeración fusionada con dos padres sin sustituir. Tampoco se certifican aquí todas las configuraciones R/S o E/Z: los SMILES de la muestra no fijan estereoquímica y el dictamen es constitucional. La revisión textual es estructurada y focalizada, no una certificación humana de cada frase. No se hizo inspección manual de clics o colores en navegador; se verifican los modelos y la navegación mediante sus datos y tests.

## Clasificación

Se conserva un dictamen principal con precedencia FAIL-STRUCTURE → FAIL-NAME → FAIL-REASONING; el JSON preserva todos los hallazgos. UNSUPPORTED solo significa un veto explícito de producción, sin nombre disponible. Un caso sin respaldo histórico suficiente tiene \`classification: null\` y \`referenceStatus: INSUFFICIENT_HISTORICAL_REFERENCE\`: **no constituye una sexta clase química ni se convierte en PASS o UNSUPPORTED**.

| Perfil | PASS | FAIL-NAME | FAIL-STRUCTURE | FAIL-REASONING | UNSUPPORTED | Sin dictamen histórico |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${PROFILES.map(profile => `| ${profile} | ${statuses.map(status => counts[profile][status]).join(" | ")} |`).join("\n")}
| **Total** | ${statuses.map(status => `**${totals[status]}**`).join(" | ")} |

La tabla cuenta 216 pares únicos; el segundo orden de átomos reproduce los mismos nombres y dictámenes. Los 432 resultados se conservan en el JSON. PASS es relativo a los controles y referencias de esta muestra, no una declaración de cobertura universal.

## Defectos y prioridad

### V008-N01 — P2 — Elisión incorrecta ante sufijos múltiples, 2013 español

| Caso | Nombre esperado independiente | Observado |
| --- | --- | --- |
| V008-030 | butano-1,3-diol | butan-1,3-diol |
| V008-038 | heptano-2,5-diona | heptan-2,5-diona |
| V008-056 | hexano-1,6-diamina | hexan-1,6-diamina |
| V008-070 | 3-etilpentano-1,5-diol | 3-etilpentan-1,5-diol |

**Causa raíz observada:** \`makeFunctionalParentName()\`, en \`app/page.tsx\`, calcula un \`stem\` eliminando la o final antes de decidir si el sufijo es mono- o multiplicado. Las ramas de alcohol, cetona y amina con varios grupos usan siempre ese stem. Esto elimina la vocal ante d, que no exige elisión.

**Respaldo:** RSEQ, guía española, §4 (ejemplo heptano-2,4-diona) y §6b (ejemplo etano-1,2-diol); P-16.7 y reglas de grupos de P-62/63/64. La extensión a diamina aplica la misma regla ante consonante y el vocabulario español, no una salida de OrgoRush. La severidad P2 distingue un error normativo/morfológico de un nombre que demostrablemente identifica otro grafo. Las cuatro fórmulas y selecciones de padre son correctas.

**Antes del piloto:** corregir la formación del padre con sufijos multiplicados y contrastar las repercusiones en derivados mixtos y explicaciones. Esta tarea solo documenta el defecto.

### V008-R01 — P1 — Benceno presentado como cadena alifática en Legacy ES/EN

Casos V008-025 y V008-026, en ambos perfiles históricos. Los nombres 1-etil-3-metilbenceno / 1-ethyl-3-methylbenzene y 1-bromo-3-clorobenceno / 1-bromo-3-chlorobenzene son correctos; su explicación dice “cadena principal de 6 carbonos”, “raíz numérica ... hex-” y “fragmento de cadena ... benceno-”, o sus equivalentes ingleses. Hex- no es un fragmento del nombre visible de ese padre retenido.

**Causa raíz observada:** \`legacyStructuralReasoningText()\`, en \`app/page.tsx\`, trata como anillo solo \`family === cycloalkane\`; el caso aromatic cae en la descripción de cadena. La descomposición compartida de REASONING-007 deriva una raíz alifática a partir de seis carbonos sin excluir ese padre retenido. Las pruebas de REASONING-007 cubrían familias alifáticas y no estos aromáticos.

**Respaldo:** A-11.3 conserva benzene; P-22 reconoce el padre aromático. No corresponde explicar ese nombre retenido mediante la raíz de hexano. Los átomos del anillo y sus fragmentos visibles están bien; el defecto demostrado es el texto pedagógico. Corregir antes de enseñar esa explicación a estudiantes.

### V008-H01 — Riesgo P1 pendiente de adjudicación histórica; sin FAIL demostrado

| Caso | Referencia histórica construida | Observado Legacy ES |
| --- | --- | --- |
| V008-067 | 2-metoxi-1-hexanol | 2-metoxihexanol |
| V008-068 | 3-etil-2-metil-1-heptanol | 3-etil-2-metilheptanol |

La ruta española nativa reutiliza \`formatTraditionalSystematicName()\`, en \`app/nomenclature-conventions.ts\`, que suprime expresamente el locante terminal de alcoholes como forma tradicional. La ruta inglesa conserva 1. No se ha localizado en las fuentes consultadas una autorización histórica suficiente para certificar estas dos omisiones concretas como nombres sistemáticos de 1979. Tampoco se usa una exigencia de PIN de 2013 como prueba de invalidez en 1979.

Mantener esos dos casos fuera de materiales de referencia evaluados hasta documentar la excepción aplicable o decidir una corrección con respaldo. Su grafo, grupos, fórmula y numeración internos son correctos. La explicación menciona C1, pero el nombre visible lo omite; esa diferencia requiere adjudicación, no una aceptación automática.

### V008-I01 — P2 — Diferencia entre importación y grafo de editor

V008-023 (bicyclo[2.2.2]octane) y V008-024 (spiro[3.4]octane) son rechazados por el importador SMILES con mensaje explícito de soporte limitado. **Ese rechazo no equivale a que Legacy no pueda nombrarlos.** Construyendo el mismo grafo constitucional de manera independiente, con el contrato ordinario del editor, ambos perfiles Legacy dan el nombre esperado y pasan los controles. 2013 sigue expresamente no disponible para esos grafos.

El JSON conserva el error de importación, la ruta alternativa utilizada y ambos grafos exportados. Los PASS Legacy de estas dos filas se refieren a la entrada de grafo de editor, nunca a una importación que haya tenido éxito. Se recomienda alinear y comunicar esas coberturas antes del piloto, sin atribuir una conectividad incorrecta a un rechazo seguro.

## Cobertura no implementada

${unsupported.join("\n")}

Los límites incluyen polienos españoles históricos, ciertas funciones insaturadas, éteres Legacy ES, amidas N-sustituidas, algunas funciones mixtas y grupos principales que quedan en ramas. V008-071 es el ejemplo publicado de dos OH frente a una cadena más larga con uno solo; V008-072 obliga a conservar un tercer OH como prefijo. En ambos, el producto declina nombrar: se conserva UNSUPPORTED, sin declarar aprobado un nombre ausente.

## Matriz completa: esperado frente a observado

En cada fila, la fórmula de referencia coincide con la observada en los tres análisis; sus grafías originales se conservan en el JSON. La última palabra de cada celda es el dictamen. Las referencias y la derivación normativa específicas por estructura están en \`references\` y \`derivation\` de la [matriz reproducible](orgorush-validation-008.matrix.json), resueltas contra el inventario de fuentes al final del informe.

| ID / familia | SMILES | Fórmula | IUPAC 2013 ES | IUPAC 1979 EN | IUPAC 1979 ES |
| --- | --- | --- | --- | --- | --- |
${detailRows.join("\n")}

## Reproducibilidad y regresiones

Archivos añadidos:

- \`tests/fixtures/orgorush-validation-008.mjs\`: corpus independiente y procedencia.
- \`tests/fixtures/orgorush-validation-008.review.mjs\`: adjudicaciones posteriores, sin cambiar los esperados.
- \`tests/fixtures/orgorush-validation-008.opsin.json\`: respuestas externas congeladas e íntegramente verificables por SHA-256.
- \`tests/helpers/validation-008-reference.mjs\`: lector, fórmula, grupos y enumeración de cadenas independientes.
- \`scripts/validation-008-audit.mjs\`: evaluación de producción y modo estricto.
- \`scripts/validation-008-fetch-opsin.mjs\`: renovación opcional y explícita de evidencia externa.
- \`scripts/validation-008-report.mjs\`: regeneración de este informe desde la matriz.
- \`tests/orgorush-validation-008.test.mjs\`: contratos de auditoría, referencias, permutaciones y controles negativos.
- \`reports/orgorush-validation-008.matrix.json\` y este informe.

Sin red, usando las respuestas congeladas:

\`\`\`powershell
node scripts/validation-008-audit.mjs
node scripts/validation-008-report.mjs
node --test --test-concurrency=1 tests/orgorush-validation-008.test.mjs
node scripts/validation-008-audit.mjs --strict
\`\`\`

El modo normal genera la evaluación sin ocultar errores. El modo estricto devuelve **exit 1** cuando quedan defectos demostrados o referencias pendientes; un UNSUPPORTED explícito conserva su categoría y no es por sí solo un error químico. Para renovar evidencias con red: \`node scripts/validation-008-fetch-opsin.mjs --observed\`.

Pruebas de esta ejecución: ${tests ? `**${passed}/${tests} aprobadas, ${failed} fallidas**` : "pendientes de completar la ejecución de tests"}, sobre la auditoría y las regresiones FALLBACK-005, FALLBACK-006 y REASONING-007. **Esos PASS verifican los contratos del auditor y la reproducción visible de los defectos; no convierten los ocho FAIL de la matriz química en aprobados.** Se inyectan además una fórmula falsa y un resaltado OH presentado como cetona para demostrar que el evaluador distingue FAIL-STRUCTURE y FAIL-REASONING aun con un nombre correcto. Los tests fallarán si cambian los hallazgos o aparece un defecto nuevo, obligando a revisar el registro.

No se vuelve a ejecutar la suite global de generación de ejercicios ni se reconstruyen Pages/Sites: no hay cambios en código de producción. Los registros locales de ejecución están en \`outputs/validation-008-*.log\` (ignorados por Git). Se conserva la separación entre pruebas de software y veredicto químico.

## Fuentes verificables

Consultadas durante esta auditoría; edición 2013 con sus correcciones publicadas y reproducción autorizada de la edición 1979. Fecha local: 22 de octubre de 2026; los registros externos conservan fecha UTC.

${sourceLines.join("\n")}

## Decisión y tareas previas a docencia

1. **P1:** corregir el razonamiento aromático Legacy y añadir regresiones de anillo retenido para ES/EN, sin cambiar los nombres correctos.
2. **P2:** corregir la vocal del padre español ante sufijos multiplicados y verificar sus repercusiones en alcoholes, cetonas y aminas.
3. **Pendiente histórico de riesgo P1:** adjudicar las dos omisiones de locante OH con fuente histórica suficiente antes de utilizarlas como respuestas modelo.
4. Mantener visibles los UNSUPPORTED, resolver o explicar la diferencia importador/editor y acotar expresamente cualquier piloto a dominios verificados.

Este es un control inicial de 72 constituciones, no una certificación universal de los tres perfiles ni una revisión firmada por un especialista externo. Los cambios permanecen locales para revisión.
`;
writeFileSync(reportPath, body);
console.log(JSON.stringify({ report: fileURLToPathSafe(reportPath), structures: records.length, verdicts: records.length * PROFILES.length, totals, defectRows: defects.length }));
function fileURLToPathSafe(url) { return decodeURIComponent(url.pathname).replace(/^\/(\w:)/, "$1"); }
