# AUD-NOM-003B — reparación aislada de CI

## Base y alcance

- HEAD inicial: `10ab003c60112ae6d496d7e61ea2546f8cdcfe2f`, rama `main`, igual a `origin/main`.
- CI original: [39107652253](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/39107652253), 2628 pruebas: 2615 PASS, 8 FAIL y 5 SKIP; las 157 regresiones críticas pasaron.
- No se ejecutó `npm test` completo. No se hizo commit ni push.
- Se preservaron los archivos previos sin seguimiento y los cambios parciales de AUD-NOM-004 en `app/page.tsx`, `app/double-bond-stereochemistry.ts` y `app/reasoning-name-fragments.ts` (SHA-256 sin cambios durante esta intervención).

## Los ocho fallos y sus causas

| Fallo original | Causa confirmada |
| --- | --- |
| `audnom003-aryl-substitution.test.mjs` | ENOENT al cargar el helper: evidencia adicional no incluida en Git. |
| `audnom003-current-diagnostics.test.mjs` | Mismo ENOENT antes de comprobar las 45 correcciones. |
| `audnom003-dicarboxylic-acids.test.mjs` | Mismo ENOENT. |
| `audnom003-n-substitution.test.mjs` | Mismo ENOENT. |
| `audnom003-stereochemistry.test.mjs` | Mismo ENOENT. |
| `practice-review.test.mjs`: revisión sin tiempo/entropía | Reproducido: `practice-review` → `buildLegacyEnglishNameModel` → `getTetrahedralStereoCenters` → construcción de grafo → `ensureHelperArrays(cHelperCIP)` → `Date.now`; error `review cannot read time`. La molécula E/Z no tenía R/S explícito. |
| `exercise-chemical-generator.test.mjs`: procesos nuevos sin reloj/entropía | Reproducido: E/Z agota los 16 intentos; todos los rechazos de oráculo contienen `Date.now forbidden`. La consulta tetraédrica innecesaria está dentro de la construcción del nombre Legacy EN del oráculo de referencia. |
| `difficulty-hard-generation-frozen.test.mjs`: planes v4 Hard | Confirmado independientemente sobre HEAD sin guarda: la captura avanza hasta `ez`, donde falla con `ExamPlanUnavailable`. Instrumentación temporal del mismo seed `D5-V4-FIXTURE:ez` y configuración advanced/v4/tres tipos mostró la pila `validateStructuralFamily` → `oracles.reference` → `buildLegacyEnglishNameModel` → helper tetraédrico → CIP → reloj prohibido. Los 16 intentos se convierten en `hard-analysis-oracle-failed`; la selección captura el error y devuelve indisponibilidad sin `reason`. No se dedujo la causa solo por el error superficial. |

La instrumentación de diagnóstico se hizo exclusivamente en la copia de validación, sin cambios en los generadores, los límites de intentos ni los helpers/snapshots congelados del repositorio.

## Corrección de producción

Únicamente `app/tetrahedral-stereochemistry.ts`: antes de construir el grafo CIP, `getTetrahedralStereoCenters` devuelve `[]` si ningún átomo tiene `tetrahedralParity` almacenada. La salida de este helper ya estaba limitada a configuraciones explícitas.

Se revisaron sus consumidores: nombre Legacy EN y prefijo, descriptores de cadena principal, explicaciones, disponibilidad/importación de estereoquímica de la interfaz, sanitización, configuración y representación de enlaces tetraédricos. Ninguno requiere que esta consulta de centros **configurados** descubra centros sin asignar. `getPotentialTetrahedralStereoCenterIds` conserva íntegra su inspección CIP y la detección de centros potenciales. Cuando existe una configuración almacenada, se mantiene el grafo CIP y `isAtomStereoCenter`, incluidos los filtros de asignaciones inválidas y de centros fuera del progenitor soportado.

## Evidencia publicable e integridad

Los dos archivos ya existían localmente, pero `git ls-files` no los incluía. `git check-ignore -v` devolvió código 1 y ninguna coincidencia: no estaban excluidos; habían quedado sin seguimiento. Git no registra por qué se omitió su incorporación manual.

Se prepararon **solo estos dos JSON** en el índice, sin modificar sus bytes ni recapturar respuestas:

- `reports/naming-audit/aud-nom-003-opsin-evidence.json`: 16 recibos independientes auténticos, obtenidos de OPSIN el 2026-10-18. Blob de Git: `0e3aa5d71f309f692976d5c7640ae6fbfbdc6c50`.
- `reports/naming-audit/aud-nom-003-results.json`: 47 estructuras, 45 salidas reparadas y 8 salidas con rechazo seguro. Blob: `119b18401d798ca87e5ceb2e1d1c70c5370059c2`.

La nueva prueba permanente `tests/audnom003b-ci-integrity.test.mjs` comprueba:

1. Ausencia de construcción de grafo al consultar R/S sin asignar, incluso en butan-2-ol con centro potencial real.
2. Ejecución CIP cuando existe R/S y descarte de una asignación en una molécula aquiral.
3. Nombres Legacy EN de ambos E/Z sin reloj ni entropía.
4. JSON, esquema, 16 nombres no duplicados, URL exacta codificada, HTTP 200, fecha ISO, procedencia, SHA-256 del cuerpo original, respuesta SUCCESS, nombre interpretado en CML y SMILES independiente.
5. Inventario y perfiles históricos completos, recibo exacto de cada resultado, identidad molecular completa recalculada y recuentos 33 + 6 + 6 = **45 MATCH**; dos arilos / ocho perfiles siguen en **SAFE_REJECTION**.

No se eliminó ni debilitó `assertIndependentName`. No se alteraron las referencias gold, los recibos históricos, los hallazgos originales, ni los snapshots de dificultad. MATCH indica identidad molecular interpretada, no preferencia de grafía histórica.

## Validación aislada y sin red

Se extrajo `git archive HEAD` en una carpeta nueva fuera del workspace del proyecto, bajo el directorio de visualizaciones permitido. Se añadieron únicamente los dos JSON, la guarda y la nueva prueba; las dependencias instaladas se compartieron mediante una junction de `node_modules`. No se hicieron solicitudes OPSIN. Comparación de todos los archivos versionados contra los blobs de HEAD (normalizando solo CRLF de Windows): la única diferencia de fuente fue `app/tetrahedral-stereochemistry.ts`. Los dos blobs preparados en Git coinciden byte por byte con la evidencia validada. Así las pruebas no dependen de los cambios parciales de AUD-NOM-004 ni de otros archivos locales sin seguimiento.

| Comando / grupo | Resultado |
| --- | --- |
| Los cinco `tests/audnom003-*.test.mjs` especificados, `--test-concurrency=1` | 44 PASS, 0 FAIL. |
| `node --test tests/practice-review.test.mjs` | 35 PASS, 0 FAIL; incluye revisión sin reloj/entropía y TypeScript estricto. |
| `node --test tests/exercise-chemical-generator.test.mjs` | 51 PASS, 0 FAIL; incluye procesos nuevos ES/EN con reloj, Date, random y UUID prohibidos. Barrido: 17 categorías × 32 seeds, cero fallos. |
| `node --test tests/difficulty-hard-generation-frozen.test.mjs` | 1 PASS, 0 FAIL; tres procesos nuevos ES/ES/EN, 17 categorías y tres tipos; igualdad exacta con el snapshot original, sin regenerarlo. |
| `node --test tests/audnom003b-ci-integrity.test.mjs` | 4 PASS, 0 FAIL. |
| `node --test --test-concurrency=1 tests/tetrahedral-stereochemistry.test.mjs tests/double-bond-stereochemistry.test.mjs tests/legacy-english-nomenclature.test.mjs tests/legacy-profile-display.test.mjs tests/smiles-isotope-integrity.test.mjs` | 81 PASS, 0 FAIL. |
| `npm run test:reference-corpus` | 797 pruebas: 792 PASS, 0 FAIL y los 5 SKIP preexistentes; sin red ni cambios en el corpus protegido. |
| `npm run build:pages` | Aprobado (salida 0). Avisos no bloqueantes de tamaño de chunks y de importación dinámica/estática del adaptador. |
| `npm run validate:pages` | Aprobado (salida 0): `PAGES_ARTIFACT={"entries":3,"assets":6,"base":"/Hydrocarbon-Lab/"}`. |
| `git diff --check` y `git diff --cached --check` | Ambos aprobados. |

## Archivos y estado Git

La reparación comprende la guarda de dos líneas en `app/tetrahedral-stereochemistry.ts`, la nueva prueba, este informe y los dos JSON adicionales preparados en Git. Los demás cambios y archivos sin seguimiento anteriores pertenecen al estado previo y se conservaron. Los archivos de producción y pruebas de esta reparación quedan para revisión, sin commit ni push; los dos JSON están staged para impedir que vuelvan a quedar fuera de la próxima incorporación.
