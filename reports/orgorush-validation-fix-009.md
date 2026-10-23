# ORGORUSH-VALIDATION-FIX-009

## Resultado de la corrección

Se corrigen los **cuatro FAIL-NAME y cuatro FAIL-REASONING confirmados por VALIDATION-008**, sin ampliar familias. La reauditoría conserva las 72 estructuras y las 216 combinaciones estructura/perfil; verifica además un segundo orden de átomos, para 432 observaciones reproducibles.

Punto de partida: HEAD `a8023a2ef1e9e46978ff9d15cd277744aaa6e0d0`. Registro de la matriz corregida: `2026-10-23T04:01:21.499Z` (23 de octubre en Santiago).

| Perfil | PASS antes → después | FAIL-NAME antes → después | FAIL-REASONING antes → después | FAIL-STRUCTURE | UNSUPPORTED | Referencia histórica pendiente |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2013-es | 64 → 68 | 4 → 0 | 0 → 0 | 0 | 4 | 0 |
| 1979-en | 68 → 70 | 0 → 0 | 2 → 0 | 0 | 2 | 0 |
| 1979-es | 55 → 57 | 0 → 0 | 2 → 0 | 0 | 13 | 2 |
| **Total** | **187 → 195** | **4 → 0** | **4 → 0** | **0** | **19** | **2** |

La matriz anterior permanece en `orgorush-validation-008.matrix.json`. El resultado actual está en `orgorush-validation-fix-009.matrix.json`; no se sobrescribe la evidencia histórica. Los esperados independientes y sus fuentes son los originales de VALIDATION-008.

**Validación final completada:** los 168 archivos de la suite general ejecutan 3050 pruebas: **3045 PASS, cero FAIL, cero canceladas y cinco SKIP preexistentes**. Pages y Sites compilan y validan sus artefactos. La comparación TypeScript conserva exactamente los 49 diagnósticos anteriores, sin añadir ni retirar ninguno.

## Diagnóstico y referencias comprobadas

Se revisaron el informe 008 completo, todos los registros y variantes de su matriz, los fixtures de nombres y adjudicaciones, las respuestas OPSIN congeladas, el verificador independiente, el ejecutor y las pruebas asociadas. Los ocho resultados afectados corresponden a **dos causas raíz**, con distinto alcance científico y distinto perfil afectado.

### 1. Elisión ante sufijos multiplicados — P2, cuatro resultados modernos en español

`makeFunctionalParentName()` quitaba la `o` final antes de decidir si el sufijo era simple o multiplicado. Usaba después esa forma elidida ante `diol`, `diona` y `diamina`. Es un defecto de formación morfológica, sin un grafo equivocado demostrado en estos casos.

| Caso | SMILES | Perfil | Antes | Esperado original / después | Dictamen |
| --- | --- | --- | --- | --- | --- |
| V008-030 | `OCCC(O)C` | 2013-es | butan-1,3-diol | **butano-1,3-diol** | FAIL-NAME → PASS |
| V008-038 | `CC(=O)CCC(=O)CC` | 2013-es | heptan-2,5-diona | **heptano-2,5-diona** | FAIL-NAME → PASS |
| V008-056 | `NCCCCCCN` | 2013-es | hexan-1,6-diamina | **hexano-1,6-diamina** | FAIL-NAME → PASS |
| V008-070 | `OCCC(CC)CCO` | 2013-es | 3-etilpentan-1,5-diol | **3-etilpentano-1,5-diol** | FAIL-NAME → PASS |

**Respaldo moderno:** [Libro Azul 2013, P-16.7](https://iupac.qmul.ac.uk/BlueBook/P1.html#P-16.7), sobre elisión de vocales, junto con la [guía de IUPAC en español publicada por RSEQ](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf), §4 y §6b. La guía imprime ejemplos que conservan `o` ante los sufijos multiplicados de cetona y alcohol. La aplicación a `diamina` usa la misma regla y el vocabulario funcional español; no deriva de una salida del programa. Las reglas funcionales y de prioridad de los esperados siguen en las referencias P-62/63/64 de 008.

La corrección usa el nombre del hidrocarburo completo cuando el sufijo está multiplicado y la convención es `blue-book-2013`. La construcción de los sufijos simples mantiene su ruta. El intermediario interno Legacy conserva su contrato con el formateador histórico, evitando cambiar los nombres de 1979 que ya eran correctos. No se cambia la selección ni la numeración del padre.

La misma corrección permite que la traducción moderna al inglés conserve la `e` ante esos multiplicadores. Se comprueban, por ejemplo, `propane-1,2,3-triol` y `pentane-2,4-dione`; esto no convierte una traducción moderna en una fuente histórica. Las insaturaciones mantienen sus locantes y enlaces, con la vocal final delante del sufijo multiplicado y con fragmentos separados para insaturación y función.

### 2. Padre aromático explicado como cadena alifática — P1, cuatro resultados Legacy

`legacyStructuralReasoningText()` solo reconocía como anillo la familia `cycloalkane`; `aromatic` caía en la descripción de cadena. `deriveLegacyParentNamePresentation()` calculaba además una raíz alifática por número de carbonos para ese padre aromático retenido. Los nombres y las correspondencias atómicas originales eran correctos; el defecto confirmado estaba en la explicación.

| Caso | SMILES | Perfil | Nombre correcto conservado | Antes | Después |
| --- | --- | --- | --- | --- | --- |
| V008-025 | `CCc1cccc(C)c1` | 1979-en | 1-ethyl-3-methylbenzene | parent chain; hex- | aromatic parent ring; benzene; PASS |
| V008-025 | `CCc1cccc(C)c1` | 1979-es | 1-etil-3-metilbenceno | cadena principal; hex- | anillo aromático; benceno; PASS |
| V008-026 | `Brc1cccc(Cl)c1` | 1979-en | 1-bromo-3-chlorobenzene | parent chain; hex- | aromatic parent ring; benzene; PASS |
| V008-026 | `Brc1cccc(Cl)c1` | 1979-es | 1-bromo-3-clorobenceno | cadena principal; hex- | anillo aromático; benceno; PASS |

**Respaldo histórico:** [IUPAC 1979, A-11.3](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm) conserva el nombre benzene. [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm) establece la precedencia de los factores de numeración, incluidos grupo de sufijo, localizadores de prefijos y desempate por el prefijo citado primero. Se utiliza la reproducción autorizada de la edición de 1979, sin sustituirla por las recomendaciones enlazadas de 1993.

La explicación actual identifica el padre aromático seleccionado, sus seis carbonos y el nombre retenido benceno/benzene. La explicación de numeración enumera los sustituyentes y sus posiciones **del análisis activo**, con el desempate alfabético correspondiente al idioma. La evidencia de presentación aromática no inventa una raíz de alcano. No se reemplazan las explicaciones por mensajes genéricos ni se recalculan padre o locantes en la capa de presentación.

El fragmento interactivo del padre sigue siendo el texto literal `benceno`/`benzene` del nombre visible y apunta a los seis átomos del anillo. Se conservan los destinos de sustituyentes y las separaciones entre padre, insaturación y función. Como control adicional, `Cc1cccc(I)c1` conserva `1-metil-3-yodobenceno` y `1-iodo-3-methylbenzene`; la explicación y la correspondencia del carbono con metilo reflejan C1 en español y C3 en inglés.

## Integridad de la reauditoría

`scripts/validation-fix-009-compare.mjs` compara las dos matrices y exige:

- Ocho combinaciones originales con fallo pasan al esperado independiente original, sin incidencias restantes.
- Solo cambian cuatro nombres españoles modernos, repetidos en dos variantes de átomos: ocho cambios de nombre entre 432 observaciones.
- Todos los nombres previamente correctos, indisponibles o pendientes permanecen iguales.
- Las identidades moleculares exportadas, fórmulas, grupos funcionales, sustituyentes, padres, mapas de numeración y destinos atómicos/de enlaces de los fragmentos permanecen iguales en las 432 observaciones.
- La comparación completa de pasos confirma que las explicaciones de los resultados previamente correctos son idénticas; solo cambian los ocho resultados objetivo, repetidos en sus dos variantes.
- Los 19 UNSUPPORTED y los dos resultados históricos sin dictamen conservan sus clasificaciones. Las referencias y los datos esperados son idénticos a los del registro anterior.

El ejecutor de 008 admite `--output` para guardar la nueva evidencia y `--strict-backed` para exigir cero fallos en los casos soportados con referencias suficientes. Este modo **no modifica ningún dictamen**: conserva 390 PASS, 38 UNSUPPORTED y cuatro referencias pendientes al contar las dos variantes. En términos únicos: 195, 19 y dos. `--strict` sin acotar referencias sigue sin certificar los dos históricos pendientes; no se presenta ese modo como exitoso.

Los hashes del fixture independiente, las adjudicaciones, las respuestas OPSIN, el verificador independiente, el informe y la matriz 008 se comparan con los tomados antes de la modificación. No se modifica ningún esperado de esos archivos.

## Pruebas y compilaciones

| Comprobación | Resultado |
| --- | --- |
| Matriz completa, `--strict-backed`, salida 009 | PASS; 72 estructuras, 216 pares únicos, 432 observaciones con variantes; cero FAIL de las tres clases |
| Comparación íntegra antes/después | PASS; solo los ocho dictámenes confirmados mejoran; evidencia estructural y cobertura intactas |
| Pruebas dirigidas de nombres, funciones, fragmentos y ocho defectos | 88 PASS, cero FAIL; ejecución corregida de cuatro archivos |
| Auditoría histórica de nombres, FALLBACK-006 y FIX-009 | 66 PASS, cero FAIL en la primera comprobación de esos tres archivos |
| Dirigidas finales: fragmentos, Build, referencias avanzadas compartidas y FIX-009 | **152 PASS, cero FAIL**, cinco archivos; incluye los 14 controles finales de FIX-009 |
| Capturas congeladas v3/v4 | Ambas comparaciones pasan; v4 repite payloads completos en ES/ES/EN y recupera el hash histórico al revertir solo el nombre corregido |
| Suite general final, 168 archivos | **3050 pruebas: 3045 PASS, cero FAIL, cinco SKIP preexistentes**, cero canceladas; salida 0 |
| Pages, compilación y validación | PASS; tres entradas, seis recursos, base `/Hydrocarbon-Lab/` |
| Sites, `scripts/build-verified.sh` | PASS; Worker ESM con `default.fetch` y manifiesto de hosting validados |
| Comparación TypeScript contra HEAD | 49 diagnósticos antes y después; **cero introducidos** |
| `git diff --check` | PASS |

La primera ejecución dirigida terminó con 408 PASS y cuatro FAIL, correspondientes a tres pruebas de razonamiento y una prueba de comparación contra observaciones antiguas de FALLBACK-006. Sus expectativas reproducían la elisión errónea demostrada y se corrigieron con la regla normativa, sin modificar las referencias independientes de 008. También se corrige el antiguo test de nomenclatura que pedía expresamente eliminar la vocal ante diol/triol. Las instantáneas históricas `iupac-engine-audit-observed.json` y `orgorush-iupac79-fallback-006.baseline.json` permanecen intactas; sus pruebas exceptúan únicamente las salidas modernas afectadas y exigen explícitamente las grafías normativas nuevas, conservando todos los nombres Legacy y los controles químicos.

La suite general encuentra asimismo expectativas antiguas de dos padres insaturados con funciones múltiples: `3-metilhept-3-en-2,6-diona` y `5-metilhept-3-in-2,6-diol`. Se exige ahora `3-metilhept-3-eno-2,6-diona` y `5-metilhept-3-ino-2,6-diol`, aplicando la misma regla. Se conserva el JSON capturado de D4 y se corrigen solo esas dos expectativas modernas en la vista del test; identidades, locantes y nombres Legacy ingleses siguen congelados.

La captura v4 contiene una tercera grafía afectada, `5-metiloct-3-en-2,7-diona`, cuyo resultado correcto es `5-metiloct-3-eno-2,7-diona`. Su comprobación no sustituye el hash antiguo por el observado: un inspector del payload revierte únicamente ese nombre español en una copia y exige recuperar el **hash histórico completo**. Los snapshots originales y sus demás campos permanecen intactos, y los payloads corregidos deben repetirse completos en tres procesos nuevos ES/ES/EN. Se conserva así una prueba de que la corrección morfológica es la única diferencia.

El control congelado v3 alcanzó su límite de 120 segundos al compilar el mismo motor tres veces en un proceso. El helper de captura permite reutilizar una instancia pura entre niveles, manteniendo generadores y guardas de entropía propios. Cada idioma sigue ejecutándose en un proceso nuevo. La comparación completa contra el snapshot original pasa con esta ruta; **no se elevan los límites de tiempo ni se regeneran las capturas**.

Los controles de Build detectaron además una repercusión de la corrección moderna en la presentación de los nombres Legacy ingleses: el adaptador de insaturación suponía la forma moderna elidida al localizar el padre histórico. Se reconoce ahora la frontera literal entre `ene`/`yne` modernos y `en`/`yn` del nombre Legacy suministrado, solo para alcoholes/cetonas acíclicos con varios grupos funcionales y localizadores concordantes. Se conservan todos los nombres. La raíz del padre obtiene evidencia propia cuando la variante Legacy y el enlace tipado están comprobados, sin reemplazar un fragmento existente del perfil seleccionado. Las regresiones finales comprueban texto literal, átomos del padre y del enlace, ausencia de solapamiento, localizadores falsificados y metadatos funcionales incompletos; los casos negativos quedan sin evidencia interactiva prestada.

La primera pasada general se interrumpió después de identificar estas expectativas antiguas, el margen insuficiente de compilaciones repetidas y la regresión de presentación. Se conserva en `full-suite-initial.log`. Después de corregir y verificar los casos afectados se ejecutó una **pasada general nueva**, tras repetir matriz, comparación TypeScript y ambas compilaciones. Las 24 fuentes registradas por SHA-256 permanecieron intactas durante la ejecución. El resultado final corresponde íntegramente a esa nueva pasada, sin combinar resultados parciales: inicio `2026-10-23T04:03:45.498Z`, fin `2026-10-23T05:28:03.384Z`, salida 0.

Las cinco omisiones coinciden exactamente con la suite anterior de FALLBACK-006: comparaciones de nombre inglés exacto para los registros silver `ESTER-0007`, `ESTER-0012`, `ESTER-0014`, `ESTER-0015` y `ESTER-0016`, que no constituyen oráculos de nombre exacto. Sus comprobaciones de estructura, identidad y alternativas siguen aprobadas. No se añaden SKIP ni se confunden con los 19 UNSUPPORTED de la matriz química.

La comprobación final verifica los hashes originales de los seis archivos independientes de 008 y la conservación de las tres capturas históricas de D4/v3/v4. Una comparación por multiconjunto de los diagnósticos TypeScript confirma 49 antes y 49 después, con cero añadidos y cero eliminados. `git diff --check` termina sin errores; HEAD permanece en el punto de partida.

Las compilaciones emiten advertencias existentes sobre tamaño de chunks, importaciones dinámicas que también son estáticas y análisis de rutas/compatibilidad de vinext. Son advertencias, no compilaciones fallidas. Los diagnósticos TypeScript previos siguen pendientes fuera del alcance de esta corrección.

Reproducción desde la raíz del repositorio:

```powershell
node scripts/validation-008-audit.mjs --strict-backed --output reports/orgorush-validation-fix-009.matrix.json
node scripts/validation-fix-009-compare.mjs
node --test --test-concurrency=1 tests/orgorush-validation-fix-009.test.mjs tests/orgorush-validation-008.test.mjs tests/functional-nomenclature.test.mjs tests/reasoning-functional-group-coverage.test.mjs tests/reasoning-name-fragments.test.mjs tests/iupac-engine-audit.test.mjs tests/iupac79-fallback-006.test.mjs tests/difficulty-hard-foundation.test.mjs tests/difficulty-hard-structural.test.mjs tests/difficulty-hard-frozen.test.mjs tests/difficulty-hard-generation-frozen.test.mjs
$validation009Tests = @(Get-ChildItem tests -Filter '*.test.mjs' | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 @validation009Tests
npm run build:pages
npm run validate:pages
& 'C:\Program Files\Git\bin\bash.exe' scripts/build-verified.sh
```

Los registros locales se guardan en `outputs/validation-fix-009/`, incluidos `reaudit-final.log`, `comparison.json`, `reasoning-step-diff.json`, `corrected-targets.log`, `additional-targets.log`, `final-fragment-regressions-v2.log`, `full-suite.log`, `full-suite.result.json`, `final-source-hashes.json`, `final-integrity-check.json`, `build-pages-final.log`, `build-sites-final.log` y `typecheck-comparison.json`.

## Archivos de esta corrección

- `app/page.tsx`: formación moderna de sufijos multiplicados y explicaciones aromáticas Legacy.
- `app/reasoning-name-fragments.ts`: exclusión de raíces alifáticas para padres aromáticos retenidos y conservación de fragmentos separados de padre/insaturación al presentar nombres Legacy junto al análisis moderno corregido.
- `scripts/validation-008-audit.mjs`: destino de salida configurable y modo estricto para casos soportados con respaldo suficiente; sin cambios en los verificadores químicos.
- `scripts/validation-fix-009-compare.mjs`: comparación reproducible de resultados y evidencia antes/después.
- `tests/orgorush-validation-fix-009.test.mjs`: una regresión por cada resultado corregido, los tres perfiles, evidencia interactiva, numeración por idioma, controles de modo estricto e integridad de referencias/matrices.
- `tests/orgorush-validation-008.test.mjs`: exigir PASS para los ocho casos corregidos contra los esperados originales y preservar los restantes dictámenes.
- `tests/functional-nomenclature.test.mjs`, `tests/reasoning-functional-group-coverage.test.mjs`, `tests/reasoning-name-fragments.test.mjs`, `tests/iupac-engine-audit.test.mjs`, `tests/iupac79-fallback-006.test.mjs`: sustitución de expectativas morfológicas erróneas demostradas, conservando los controles de estructura, fragmentos y perfiles históricos.
- `tests/difficulty-hard-foundation.test.mjs`, `tests/difficulty-hard-structural.test.mjs`, `tests/helpers/validation-fix-009-d4.mjs`: expectativas modernas verificadas de los dos padres insaturados, compartidas por las pruebas que comparan sus nombres y conservando la captura original.
- `tests/difficulty-hard-generation-frozen.test.mjs`, `tests/helpers/difficulty-hard-v4-snapshot.mjs`: prueba por hash de que solo cambia la grafía española verificada, con repetición completa en procesos nuevos y snapshots intactos.
- `tests/difficulty-hard-frozen.test.mjs`, `tests/helpers/difficulty-session-snapshot.mjs`: evitar compilaciones SSR redundantes dentro de cada proceso de captura, conservando límites, guardas y todas las comparaciones históricas.
- `reports/orgorush-validation-fix-009.matrix.json` y este informe: evidencia de la corrección.

Los diez archivos nuevos de VALIDATION-008 ya estaban sin seguimiento al iniciar 009 y se conservan en el directorio de trabajo. De ellos solo se adaptan el ejecutor y el test enumerados arriba; los fixtures, verificadores independientes, informe y matriz originales no cambian. No se modifican componentes de interfaz ajenos al alcance.

## Límites y decisión para el piloto

Los ocho defectos confirmados dejan de bloquear por sus causas concretas. Este resultado no certifica cobertura universal ni sustituye una revisión docente de materiales fuera de la muestra. Los 19 UNSUPPORTED permanecen excluidos de la cobertura. V008-067 y V008-068 en español Legacy siguen sin dictamen histórico suficiente para la omisión de C1 del alcohol; deben mantenerse fuera de materiales evaluados hasta resolver esa referencia.

Se conserva asimismo la limitación del importador para V008-023/024: los nombres Legacy se auditan sobre grafos equivalentes a los construidos en el editor, con el rechazo de importación SMILES explícito en la matriz. No se declara reparado el importador.

Los cambios quedan locales para revisión. **No se realiza commit ni push.**
