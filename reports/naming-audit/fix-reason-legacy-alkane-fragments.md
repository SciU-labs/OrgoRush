# FIX-REASON-LEGACY-001 — fragmento del padre alcano

## Causa raíz confirmada

`buildActiveIupacReasoning()` termina llamando a `deriveReasoningNameFragments()`. Para Legacy, `deriveLegacyConventionFragments()` encontraba la raíz en `IUPAC_ROOTS` y publicaba `prop`; luego `parentNameEvidence()` volvía a recortar la misma raíz del sufijo analizado. Por eso, aunque el nombre visible fuese `propano`, la evidencia final asociada a «Cadena principal» seguía siendo `prop`. En 2013 ya se obtenía el span completo para este caso.

La reproducción anterior al cambio llegó al modelo final: `CCC` / Legacy ES emitió `prop` en lugar de `propano`.

## Corrección

Se añadió un predicado de presentación para padres que el análisis identifica como alcanos saturados acíclicos: familia acíclica, cadena no vacía, sin grupos funcionales ni enlaces dobles o triples, y padre localizado terminado en `-ano` o `-ane`. Solo entonces `parentNameEvidence()` y el adaptador Legacy usan el nombre completo del padre.

El span parte del final literal del nombre menos la longitud del padre analizado. No se busca una raíz dentro del nombre ni se modifica la selección o numeración química. El prefijo del sustituyente conserva evidencia separada. Los anillos, insaturaciones, grupos funcionales y nombres retenidos siguen usando sus reglas previas.

## Nombres y fragmentos

| Estructura | Perfil | Nombre visible | Fragmento de cadena principal |
|---|---|---|---|
| Propano | 2013 ES | `propano` | `propano` |
| Propano | Legacy ES | `propano` | Antes `prop`; ahora `propano` |
| Propano | 2013 EN | `propane` | `propane` |
| Propano | Legacy EN | `propane` | Antes `prop`; ahora `propane` |
| 2-metilpropano | 2013 / Legacy ES | `2-metilpropano` | `propano`; `2-metil` permanece separado |
| 2-metilpropano | 2013 / Legacy EN | `2-methylpropane` | `propane`; `2-methyl` permanece separado |
| 2,2-dimetilpropano | 2013 / Legacy ES | `2,2-dimetilpropano` | `propano`; prefijo y multiplicador permanecen en el nombre |
| 2,2-dimetilpropano | 2013 / Legacy EN | `2,2-dimethylpropane` | `propane`; prefijo y multiplicador permanecen en el nombre |

La comprobación dirigida también incluye metano, etano, butano, pentano, hexano, 2-metilbutano y 3-metilpentano. Metano conserva su tratamiento de visibilidad existente.

## Integridad química e interacción

La prueba nueva valida nombres y fórmulas exactos, longitud de cadena y localizadores analizados, identidad del grafo tras exportar el SMILES, e igualdad de la molécula editable antes y después del razonamiento. Comprueba que el fragmento padre apunte al paso existente, coincida carácter por carácter con el nombre y resalte exactamente los átomos de la cadena principal. Para estructuras ramificadas verifica evidencia y enlaces separados para padre y sustituyente; los enlaces y fragmentos reconstruyen el nombre visible sin cambios. También comprueba evidencia de localizadores, navegación del localizador único y la forma literal del localizador duplicado y multiplicador. Las proyecciones de propano repetidas producen la misma evidencia y navegación.

Las suites existentes de fragmentos (20/20), cobertura de alcanos Legacy (2/2), navegación (4/4) y NOM-002B (9/9) pasan. En particular, las pruebas de NOM-002B confirman que los spans de insaturación, localizadores y sufijos funcionales siguen separados y estructuralmente vinculados. No se alteró evidencia funcional para forzar el fragmento nuevo.

## Validación

- `node --test tests/fix-reason-legacy-alkane-fragments.test.mjs`: 1/1 PASS. Proceso con límite externo de 85 s; duración Node informada: aproximadamente 54 s.
- `node --test tests/reasoning-name-fragments.test.mjs`: 20/20 PASS.
- `node --test tests/iupac1979-alkane-coverage.test.mjs`: 2/2 PASS.
- `node --test tests/reasoning-name-navigation.test.mjs`: 4/4 PASS.
- `node --test tests/iupac-nom002b-polyunsaturated-ketones.test.mjs`: 9/9 PASS.
- `npm run build:pages`: PASS; Vite compiló en 8.08 s. Mostró avisos de importación dinámica inefectiva y tamaño de bundle, sin fallar el build.
- `npm run validate:pages`: PASS; validó 3 entradas y 6 recursos con base `/Hydrocarbon-Lab/`.
- `git diff --check`: PASS.

Una ejecución intermedia de la prueba nueva expiró al ampliar la cobertura de identidad para todos los diez casos. Se acotó la proyección: los tres casos de aceptación principal se comprueban en los cuatro perfiles; las muestras restantes verifican nomenclatura, fórmula, grafo y las dos rutas españolas, y metano mantiene su presentación. La versión final pasó dentro del límite externo. No se ejecutaron `npm test`, auditorías extensivas ni barridos completos.

## Archivos modificados

1. `app/reasoning-name-fragments.ts`
2. `tests/fix-reason-legacy-alkane-fragments.test.mjs`
3. `reports/naming-audit/fix-reason-legacy-alkane-fragments.md`

Sin cambios en nombres generados, motor químico, análisis de cadena principal, localizadores, datos moleculares, Practice/Exam ni informes históricos. No se hizo commit ni push.
