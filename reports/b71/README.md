# B7.1 — benzamidas N-monosustituidas

## Diagnóstico y línea base

B61-I04 es `CCNC(=O)C1=CC=C(C=C1)C`, C10H13NO. El generador identifica benzamida y obtiene N-etil por los vecinos carbonados del nitrógeno, excluyendo el carbono carbonílico; el metilo se asigna al carbono 4 del anillo. La gramática de benzamida retenida solo interpretaba localizadores numéricos, por lo que no podía reconstruir el enlace N–etilo y ambos perfiles quedaban PARTIAL. La [prueba roja](red-initial.md) reprodujo el fallo antes del cambio. El [baseline](baseline.json) conserva nombres, estados, fórmula, OPSIN y análisis; [baseline-structure.json](baseline-structure.json) registra adyacencias y enlaces N/C=O derivados de los SMILES originales.

El control B701-18 es una **N-bencilbenzamida** con un segundo anillo: no pertenece a la subfamilia N-alquilo lineal y continúa UNSUPPORTED. Se conserva el corpus B7.0.1, cuyo SHA-256 se comprobó sin cambios: `d8bd4c18125c2ba947136d6d179699c20c0ae776b8aa83d500409b0b6afca8b1`.

## Regla y evidencia

La gramática `systematic-family-grammar.ts` acepta un único prefijo N-metil, N-etil o N-propil lineal al interpretar benzamida, y los prefijos aromáticos previamente admitidos. El localizador N y los localizadores numéricos se analizan como ámbitos distintos, con orden alfabético de los nombres químicos sin ordenar por el localizador. Desde el nombre se construyen un anillo, C=O, enlace C–N, una cadena N-alquilo y los prefijos del anillo; el comparador exige identidad completa del grafo, valencia, carga e información estereoquímica compatibles. Por la estructura reconstruida el N neutro tiene un enlace a carbonilo, uno al alquilo y un H implícito. N,N-disustitución, N-bencilo, N-fenilo, cadenas ramificadas o insaturadas y grafos con información no demostrada no obtienen esta nueva prueba FULL.

El modelo compartido marca `attachmentScope` como `ring` o `amide-nitrogen`. El adaptador crea un control literal `N` que selecciona solo el nitrógeno y un control del alquilo que selecciona sus carbonos, enlaces internos y enlace N–C. Los prefijos de anillo de esta familia incluyen el carbono aromático y su enlace de unión. La función selecciona C, O y N y los enlaces C=O y C–N. Los prefijos se presentan en el orden de sus tramos reales.

En B61-I04 el resultado es **N-etil-4-metilbenzamida / N-ethyl-4-methylbenzamide**, con FULL ES/EN por reconstrucción e isomorfismo completos; no se declara PIN. El [Blue Book P-66.1.1.1.2.1](https://iupac.qmul.ac.uk/BlueBook/P6a.html) conserva benzamida como progenitor sustituible, [P-66.1.1.3.1.1 y P-66.1.1.3.5](https://iupac.qmul.ac.uk/BlueBook/P6a.html) describen N-sustitución y localizadores, y [P-14.5](https://iupac.qmul.ac.uk/BlueBook/P1.html) ordena los prefijos sin tratar N como letra del sustituyente. La adaptación española se apoya también en B6.3. FULL y equivalencia OPSIN no certifican el nombre completo como PIN.

## Corpus externo y mediciones

El [fixture](../../tests/fixtures/b71-independent-reference.json) de 12 estructuras de PubChem se congeló antes de la primera ejecución del generador: [acta](corpus-freeze.json), SHA-256 `4874bc940b600cef345814a06a91e21a13502a2d0ae93bb9cc6d7c256f1dcfac`. Incluye ocho candidatos N-alquilo y cuatro controles fuera de la subfamilia. Se compararon identidades contra los fixtures B50/B61/B62/B701; no se asegura ausencia de solapamientos con cada estructura incidental de todas las pruebas históricas. El nombre N-methylbenzamide ya aparecía como control de rechazo en la prueba de gramática B6.0, por lo que no se presenta como completamente inédito. Los SMILES y descriptores se transcribieron de páginas públicas. Los 12 [recibos originales PUG](reference-receipts.json) se recuperaron **después** de congelar y medir, por falta de acceso directo inicial; sus hashes, fórmulas, InChIKey e identidades se verificaron contra el fixture. Por tanto no son recibos capturados antes de congelar, aunque la selección y el fixture sí preceden la medición.

| Corpus de 12 | Inicial por idioma | Posterior por idioma |
|---|---:|---:|
| FULL | 0 | 8 |
| PARTIAL | 9 | 1 |
| UNSUPPORTED | 3 | 3 |

La primera medición se conserva en [baseline.json](baseline.json). La posterior en [post-final.json](post-final.json) se desarrolló sobre el corpus y **no es una segunda medición ciega**. La [matriz](matrix.md) y [coverage.json](coverage.json) detallan casos y nombres. Las nueve denominaciones inglesas disponibles del corpus y la de B61-I04 fueron interpretadas por OPSIN local 2.9.0 y reconstruyeron el mismo grafo de referencia; el comparador usa OpenChemLib, también utilizado por OrgoRush. Las tres estructuras sin nombre local no se enviaron a OPSIN. La identidad estructural tampoco certifica preferencia nomenclatural.

## Pruebas

Las pruebas separan N-metil de 4-metil, N-etil de 4-etil y N-etil-4-metil de 4-etil-N-metil; además rechazan N,N-dimetil, N-fenil, N-alquenil, carga en nitrógeno, estereoquímica no representada, función adicional, longitudes y regioisómeros incorrectos. Estos rechazos son límites de FULL, no declaraciones de invalidez química universal. La prueba de B61-I04 comprueba C=O, C–N, ambos enlaces del etilo, carbono aromático 4, localizador N y tramos literales. Los ocho positivos del corpus se reevalúan con permutaciones de IDs, átomos y enlaces, rotación y exportación/reimportación; B61-I04 también prueba Kekulé alternativo y cambio ES→EN→ES.

Playwright en Edge 157 importó B61-I04 y B71-02/B71-04, sin simular nombres o pruebas: **3/3 casos, 78 activaciones** de controles, incluidos `N`, función, padres, sustituyentes y localizadores, en ES→EN→ES→EN, con comparación exacta de átomos/enlaces y geometría. [Resultados](e2e/results.json); las consultas opcionales de metadatos externos se aislaron.

Typecheck y diff-check se ejecutaron sin errores. Pasaron 158 pruebas focalizadas de B4–B7 y VALIDATION y las 27 pruebas del corpus de generalización B6.0. En esta última se actualizó el antiguo control que exigía rechazar N-methylbenzamide, ahora admitida y cubierta por las pruebas B7.1; los resultados históricos no se reescribieron. No se ejecutó la batería completa, ni se modificaron workflows, baselines históricos, dependencias de producción o el bloqueo local del ibuprofeno.

## Límites y propuesta B7.2

El corpus es pequeño y no aleatorio. La novedad no es exhaustiva frente a todas las estructuras históricas; los recibos se capturaron tras la línea base. La gramática no cubre N,N, N-bencilo, sustituyentes N aromáticos, ramificados o insaturados, ni construcciones con el mismo alquilo en N y anillo que requieran multiplicadores mixtos. B7.2 debería estudiar una de esas familias con un corpus externo nuevo, congelado con recibos antes de medir y con evidencia explícita de valencias y simetría; no se recomienda ampliar todas las amidas a la vez.
