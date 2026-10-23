# ORGORUSH-QUALITY-010 — Saneamiento TypeScript

Fecha: 23 de octubre de 2026. Referencia inicial: `main`, `961971e330f12101785fc42de3727d5aef4b6ce8`; árbol limpio antes de la tarea. No se ha realizado commit, push ni despliegue.

**Resultado final:** TypeScript global termina con **cero diagnósticos y salida 0**. Las 16 causas raíz de los 49 errores activos están corregidas, con `strict` y la cobertura del código fuente conservados. La auditoría química mantiene exactamente sus resultados; Pages y Sites compilan y validan; la suite completa termina con **3.048 PASS, cero FAIL y las cinco omisiones preexistentes**, en 169 archivos y 3.053 pruebas. No quedan criterios de aceptación pendientes dentro de esta tarea.

Evidencia estructurada: [inventario inicial](orgorush-quality-010.baseline.json) y [resultados finales](orgorush-quality-010.results.json). Los tres PASS añadidos respecto a FIX-009 corresponden a las tres pruebas nuevas QUALITY-010; se conservan los 3.045 PASS anteriores.

## 1. Línea base y alcance real

Se leyeron las convenciones de README, `package.json`, `tsconfig.json`, las configuraciones Vite de Pages/Sites, las declaraciones del adaptador Vinext y los contratos de importación, layout y razonamiento. No se encontraron archivos `AGENTS.md` aplicables.

No existía un script de typecheck en `package.json`. Se ejecutó el compilador local TypeScript 5.9.3, sin emitir archivos ni usar caché incremental:

```powershell
node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false
```

Resultado inicial global: **473 diagnósticos, salida 2**. Exactamente **49 corresponden al código activo** y **424 a copias históricas bajo `outputs/`**, incluidas las exportaciones de HEAD usadas por auditorías anteriores. No son 473 defectos independientes del producto. El typecheck acotado usado en FIX-009 reproduce los 49 errores activos. Se capturaron ambos resultados antes de editar el código.

El inventario versionable [orgorush-quality-010.baseline.json](orgorush-quality-010.baseline.json) contiene los 49 diagnósticos con archivo, línea, columna, código, mensaje completo —incluidas las sobrecargas—, categoría, causa, dependencias y solución propuesta. También registra los contadores de archivos históricos, el hash del registro global y los hashes del JavaScript emitido antes de los cambios puramente tipados.

Evidencias locales completas, ignoradas por Git:

- `outputs/quality-010/baseline-global-native.log`: 473 diagnósticos del comando global.
- `outputs/quality-010/baseline-active.log`: 49 diagnósticos con el alcance de FIX-009.
- `outputs/quality-010/stage-*.log`: verificaciones incrementales, incluidas las iteraciones que expusieron incompatibilidades derivadas.

La comprobación global se lanzó dos veces al diagnosticar su demora y se revisaron sus procesos por PID y línea de comando. Se conservan los registros de ambos intentos; la ejecución global nativa completó con salida 2 y produjo el inventario. Ninguno de esos intentos se presenta como una comprobación exitosa.

## 2. Causas raíz y correcciones

Las categorías A–E siguen la clasificación solicitada; algunos problemas pertenecen a dos categorías. Los números siguientes suman los **49 errores originales**; las incidencias de cada fila comparten corrección.

| Causa / categoría | Diagnósticos | Corrección y garantía |
|---|---:|---|
| Alias de anillo importado, B/C | 11 | Conservar `candidate.atomIds` después de `Array.isArray`. Se mantienen límites, IDs válidos, unicidad, cierre y comprobación de enlaces. |
| Unión de modos V1/V2, A/B | 4 | Reutilizar `decodeVersionedViewMode()`, que ya distingue el retorno nullable V1 del resultado discriminado V2. No se reinterpretan documentos históricos. |
| Extremos de cadena condensada, B | 2 | Usar el índice del último extremo de las rutas no vacías construidas por el algoritmo. No cambian puntuación ni orientación. |
| Discriminante de paréntesis condensados, A/C | 6 | Separar `branch-open`/`branch-close`, vinculados respectivamente a `(`/`)`. `Extract` deja de producir `never` y ahora impide textos cruzados. |
| Adyacencia tetracíclica, C | 1 | Inicializar explícitamente el `Record` completo A/B/C/D con cuatro arreglos independientes; mismos contenidos y orden de claves. |
| Objetivo de JavaScript, E | 2 | Alinear `target` con ES2020, ya usado por Pages. Los grupos de captura ES2018 existentes no se reescriben. |
| Flujo de sugerencias, C | 5 | Sustituir `forEach` por `for...of` para que el compilador observe las asignaciones a `best`; mismos candidatos, orden, puntuación y desempate estricto. |
| Propiedad `carbonCount` repetida, A | 1 | Eliminar su escritura redundante: el mismo valor procede de `parentTail`, que ya sobrescribía la propiedad. |
| Resultado OpenChemLib, B | 1 | Retornar temprano si `converted.ok` es falso; sólo entonces consultar el anillo y la molécula de la variante exitosa. |
| Contrato de enlaces aromáticos, A | 3 | Derivar los enlaces del modelo molecular existente, incluyendo orden opcional y marca E/Z booleana. No se declara falsamente que todo elemento del enlace es un número. |
| Estado del rectángulo expandido, A | 2 | Usar `MoleculeVisualExtent`, los cuatro campos realmente leídos por la vista. Los bounds calculados y sus márgenes no cambian. |
| Resultado PubChem exhaustivo, A | 1 | El filtro exterior excluye `invalid-formula`; los ternarios consumen los restantes estados. `invalid-response` es la última rama y conserva exactamente el texto ES/EN; se elimina el acceso a `.message` sobre `never`. |
| Selección semántica, A/B | 3 | El selector acepta el `semanticId` opcional del contrato real de fragmentos y comprueba su presencia antes de actualizar el estado. Los controles válidos siguen navegando y resaltando lo mismo. |
| Extremos semidesarrollados, B | 3 | Estrechar ambos extremos antes de comparar coordenadas. En una ruta malformada sin extremos se conserva su orden, evitando acceder a un átomo inexistente; las rutas válidas conservan su orientación. |
| Lectura de estereoquímica/layout, A | 1 | Introducir `ReadonlyStereoMolecule` para colecciones consultadas por inspección y layout. Los editores y copias de geometría mantienen `StereoMolecule` mutable. Los consumidores de layout usan el contrato compartido; se eliminan conversiones anteriores y se anota la copia mutable del renderer semidesarrollado. |
| Runtime y bindings Worker, D | 3 | Añadir exclusivamente `@cloudflare/workers-types@4.20260515.1`, alineado con el workerd instalado, para el contrato D1. `WorkerEnv` comparte bindings y el contrato Web `Request`/`Response` que exige Vinext. La declaración de `cloudflare:workers` expone ese entorno sin inyectar globales Worker en el navegador. |

El contrato readonly protege las colecciones consultadas; no afirma inmutabilidad profunda de todos sus miembros. Las pruebas adicionales congelan también átomos y enlaces en tiempo de ejecución para verificar que inspección y layout no mutan el grafo.

## 3. Configuración y cobertura

`npm run typecheck` ejecuta ahora `tsc --noEmit --incremental false`. No captura ni transforma su código de salida.

`strict: true`, `skipLibCheck`, `allowJs`, resolución de módulos, librerías, plugins e inclusiones permanecen con sus valores previos. No se añaden `any`, `@ts-ignore`, `@ts-nocheck`, conversiones dobles ni afirmaciones nuevas de no nulidad.

Se excluyen únicamente directorios de resultados generados: `outputs`, `dist`, `dist-pages`, `.sites-runtime`, `.wrangler`, `out` y `coverage`; `node_modules` ya estaba excluido. `build/` es código fuente y **sigue incluido**, al igual que `app`, `db`, `worker`, `pages-src`, las configuraciones Vite/Next/Drizzle y los contratos TS de pruebas. Una prueba compara las entradas del compilador con **todos los archivos TS/TSX/MTS seguidos por Git**, además de los archivos TS nuevos, para detectar exclusiones que reduzcan esa cobertura.

No se actualizaron versiones de dependencias de ejecución. El paquete nuevo aporta tipos de D1; su uso es `import type`. Los cambios adicionales de metadatos del lockfile proceden de la normalización de npm durante esa instalación.

Las declaraciones modulares Worker de `Fetcher` no son intercambiables con las de DOM/Vinext (`Request.fetcher`, iteradores de headers). Esa incompatibilidad se detectó durante la comprobación y se resolvió usando el contrato Web realmente consumido por Vinext, conservando los tipos oficiales de D1. No se forzaron conversiones entre los dos conjuntos de globales.

## 4. Registro incremental

| Conjunto aceptado | Diagnósticos activos antes | Después | Errores nuevos pendientes |
|---|---:|---:|---:|
| Línea base | 49 esperados | 49 confirmados; 473 con archivos históricos | 0 |
| A: validación, inferencia, tokens y propiedades | 49 | 19 | 0 |
| B: contratos de interfaz y geometría | 19 | 5 | 0 |
| C: objetivo y entorno Worker/Vinext | 5 | 0 globales | 0 |

Los registros `stage-b.log`, `stage-b2.log` y `stage-c-global.log` conservan las iteraciones de diagnóstico, que expusieron respectivamente 2, 6 y 3 incompatibilidades derivadas al propagar los contratos. Todas están resueltas en `stage-b3.log` y `stage-c2-global.log`; no se presentan esas iteraciones como conjuntos aceptados. El primer intento de la nueva prueba negativa falló por una ruta virtual Windows no normalizada; se corrigió el host del verificador, sin alterar los diagnósticos esperados ni el compilador.

## 5. Protección química y pedagógica

Se volvió a ejecutar:

```powershell
node scripts/validation-008-audit.mjs --strict-backed --output outputs/quality-010/reaudit.matrix.json
node scripts/quality-010-verify.mjs
```

La matriz histórica de 008 y la matriz corregida de 009 permanecen intactas. La nueva matriz se guarda en `outputs`, no sobre esas referencias.

Resultado: **72 estructuras, 216 observaciones principales, 432 al incluir las variantes reindexadas/reflejadas; 195 PASS, cero FAIL, 19 UNSUPPORTED y dos referencias históricas pendientes**. El modo estricto para casos respaldados pasa. El modo estricto absoluto sigue rechazando las dos referencias pendientes, sin reclasificarlas.

La comparación profunda comprueba **todos** los campos químicos y pedagógicos, excluyendo sólo `createdAt` y `head` de la raíz del archivo: identidad, SMILES, fórmula, conectividad, selección y numeración del padre, grupos, sustituyentes, nombres de los tres perfiles, pasos explicativos, rangos de texto y correspondencias atómicas/de enlaces. El hash de esos datos coincide antes/después:

`26c63c9e9da9b4599f101cafd52ae25c1f59853169badb5651f71594fb04c624`.

Además, el JavaScript emitido por los cuatro archivos con cambios exclusivamente de tipos —estereoquímica, layout esquelético, layout 2D y razonamiento aromático— coincide exactamente con el de `961971e`, compilado con las mismas opciones. Los hashes se conservan en el inventario.

No se han modificado los algoritmos de nomenclatura, prioridades, fallback Legacy, traducciones, CSS ni referencias independientes.

## 6. Pruebas y artefactos

| Comprobación | Resultado registrado |
|---|---|
| Documentos, vistas V1/V2, condensación y sugerencias | 35 PASS, 0 FAIL |
| Layout, E/Z, R/S, razonamiento y PubChem | 98 PASS, 0 FAIL |
| Pruebas nuevas QUALITY-010 | 3 PASS, 0 FAIL; incluyen compilación positiva/negativa y grafos congelados |
| TypeScript global final | 0 diagnósticos, salida 0 |
| Matriz 008/009 | 195 PASS / 19 UNSUPPORTED / 2 pendientes; datos íntegramente iguales |
| Auditorías y regresiones finales dirigidas | 118 PASS, 0 FAIL, 0 omisiones |
| Pages: build y validador | PASS; tres entradas, seis assets; base `/Hydrocarbon-Lab/` |
| Sites: build y validador ESM/manifiesto | PASS; `default.fetch` y manifiesto de hosting presentes |
| Suite general completa | 169 archivos; 3.053 pruebas; 3.048 PASS, 0 FAIL, 0 canceladas y 5 omisiones previas; salida 0 |

Las pruebas nuevas de compilación exigen que existan las variantes de tokens de paréntesis y sus textos correctos; comprueban los consumidores readonly y el binding D1 compartido. Un programa virtual inválido debe producir exactamente tres errores reales: texto de paréntesis incorrecto, orden de enlace 4 y `DB.prepare(123)`. No se utilizan directivas de supresión.

La suite completa se ejecutó con el mismo alcance y concurrencia de `npm test`: tras el build Sites validado, se enumeraron en PowerShell todos los `tests/*.test.mjs` y se pasaron a `node --test --test-concurrency=1`. La enumeración sólo adapta el glob a Windows. Comenzó a las `2026-10-23T19:33:09Z` y terminó a las `20:47:11Z`; duración del runner: `4.441.597,6035 ms` (74 min 2 s). Los **21 archivos de fuente registrados por hash permanecieron idénticos** durante toda la ejecución.

Practice/Exam se comprobaron mediante la suite completa, incluidos semillas, sesiones congeladas, generación, categorías, respuesta estructural, puntuación, intentos, almacenamiento, CSV y reconstrucción. Pasaron las matrices Easy/Intermediate/Hard, la repetición entre procesos nuevos y entre ES/EN, los snapshots congelados y el barrido del generador de 17 categorías con 32 semillas por categoría. La corrección atómica, los reintentos, la navegación de revisión y los contratos estrictos de tipos de Exam/distractores también pasaron. No se han actualizado snapshots ni fixtures.

Las cinco omisiones preexistentes identificadas por FIX-009 pertenecen a los casos `ESTER-0007`, `ESTER-0012`, `ESTER-0014`, `ESTER-0015` y `ESTER-0016` del corpus silver, donde el nombre inglés exacto no constituye un oráculo normativo. Sus comprobaciones estructurales siguen formando parte de la suite. Se compararon los cinco nombres y motivos de omisión con el log final de FIX-009, excluyendo sólo su duración: **son exactamente los mismos; no hay nuevas omisiones**.

El cierre repitió `npm run typecheck -- --pretty false` y `node scripts/quality-010-verify.mjs` sobre el código final: ambos terminaron con salida 0. Las seis fuentes independientes de VALIDATION-008 conservaron sus hashes originales; Git confirma que las matrices e informes históricos 008/009, el corpus y los fixtures congelados no se modificaron. `git diff --check` no detecta errores de whitespace.

Registros completos: `outputs/quality-010/full-suite.log`, `full-suite.result.json`, `typecheck-closure.log`, `closure-result.json`, `final-targets.log`, `build-pages.log`, `build-sites.log` y `chemical-comparison-closure.json`. El archivo de resultados versionable incluye contadores, timestamps, hashes de los logs, omisiones y comprobaciones de integridad; los logs masivos permanecen ignorados.

## 7. Archivos modificados

- Contratos/flujo del producto: `app/chemistry-document-validation.ts`, `app/condensed-layout.ts`, `app/double-bond-stereochemistry.ts`, `app/fused-ring-nomenclature.ts`, `app/molecule-2d-layout.ts`, `app/name-suggestions.ts`, `app/name-to-molecule.ts`, `app/page.tsx`, `app/reasoning-aromatic-substituents.ts`, `app/semi-developed-layout.ts`, `app/skeletal-layout.ts`.
- Configuración y documentación: `tsconfig.json`, `package.json`, `package-lock.json`, `README.md`.
- Integración Worker: `worker/index.ts`, nuevos `worker/env.ts` y `worker/cloudflare.d.ts`.
- Verificadores: nuevos `scripts/quality-010-diagnostics.mjs` y `scripts/quality-010-verify.mjs`.
- Regresiones: nuevos `tests/orgorush-quality-010.test.mjs` y `tests/types/quality-010-contracts.ts`.
- Evidencia versionable: este informe, `reports/orgorush-quality-010.baseline.json` y `reports/orgorush-quality-010.results.json`.

Los logs completos, matriz de esta ejecución, manifiestos de hashes y scripts temporales del pipeline se guardan en `outputs/quality-010/`, ignorado por Git. No se incorporan archivos temporales masivos al control de versiones.

## 8. Referencias de integración y mantenimiento

- [Cloudflare: TypeScript y tipos del runtime](https://developers.cloudflare.com/workers/languages/typescript/). Cloudflare recomienda generación con Wrangler para describir todas las APIs según fecha y flags; esta corrección utiliza únicamente el contrato D1 de su paquete oficial fijado, sin incorporar globales Worker al programa DOM.
- `node_modules/@cloudflare/workers-types/README.md`, sección «Importable Types»: importaciones modulares para proyectos que no deben incorporar todos los globales; entrada `2023-07-01` para fechas posteriores.
- `node_modules/vinext/dist/server/app-router-entry.d.ts`: contrato Web del binding `ASSETS`.
- `node_modules/vinext/dist/server/image-optimization.d.ts`: contrato del adaptador de imágenes.
- Las referencias normativas químicas siguen siendo las de [VALIDATION-008](orgorush-validation-008.md) y [FIX-009](orgorush-validation-fix-009.md). No se han añadido reglas ni reinterpretado referencias históricas para esta tarea de tipos.

Se recomienda incorporar `npm run typecheck` a CI y mantener las copias históricas en los directorios de resultados ignorados. Si se amplían los bindings o las APIs Worker, deberán extenderse sus contratos y revisarse con la fecha/flags del runtime; no se afirma cobertura de todas las APIs Cloudflare.

## 9. Limitaciones y estado de aceptación

La igualdad de datos de auditoría prueba conservación sobre el corpus verificado, no cobertura universal de IUPAC. Se conservan los 19 casos fuera de cobertura y las dos referencias históricas insuficientes. `skipLibCheck: true` y `allowJs: true` son los valores preexistentes; esta tarea no amplía el chequeo a todo el JavaScript de pruebas ni a los cuerpos de librerías externas.

La evaluación visual se apoya en la conservación de coordenadas y bounds, ausencia de cambios CSS/textuales y regresiones de renderizado; no se afirma una inspección manual nueva de todos los dispositivos y temas.

Las advertencias de tamaño de bundles y clasificación estática de algunas rutas Vinext se conservan visibles en los logs; no impiden los builds ni sus validadores. No quedan diagnósticos TypeScript ni verificaciones de esta tarea pendientes. Los casos químicos fuera de cobertura y las referencias históricas insuficientes se mantienen como límites del producto, sin reclasificarlos.

| Criterio de aceptación | Estado final |
|---|---|
| TypeScript sin diagnósticos y salida 0 | Cumplido, comprobación global y cierre |
| Strict, nulidad y cobertura sin debilitar; sin supresiones | Cumplido, revisión de cambios y compilación positiva/negativa |
| Nomenclatura, grafo y razonamiento de 008/009 conservados | Cumplido, igualdad profunda de 432 observaciones |
| Practice/Exam y snapshots conservados | Cumplido, suite completa y fixtures intactos |
| Cero regresiones y ninguna omisión nueva | Cumplido, 3.048 PASS / 0 FAIL / mismas 5 omisiones |
| Pages y Sites compilados y validados | Cumplido |
| Evidencia antes/después e informe completo | Cumplido |
| Sin commit, push ni despliegue | Cumplido; cambios locales para revisión |
