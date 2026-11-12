# B7.0.1 — validación externa de la gramática aromática

## Línea base y corpus congelado

La medición inicial partió del commit `0a253f461371f18f16f04153007aaedaaa72cd07`, sin cambios de producción, con B7.0 7/7 pruebas aprobadas. La gramática de B7.0 admite F, Cl, Br e I como prefijos de los progenitores aromáticos funcionales ya cubiertos (benzaldehído, benzonitrilo, benzamida, anilina, benzoato y algunos padres ingleses adicionales). El parser acotado acepta `di-` y `tri-`, exige localizadores distintos y ordenados, orden alfabético de los términos sin multiplicadores, asigna C1 al grupo principal y compara las dos orientaciones. Reconstruye los enlaces de cada prefijo, compara el grafo completo y proyecta los componentes y sus literales al razonamiento. No generaliza a bencenos polisustituidos sin sufijo, nitro en esta gramática o amidas N-sustituidas.

Se seleccionaron 18 estructuras de páginas de [PubChem](https://pubchem.ncbi.nlm.nih.gov/), con fuentes individuales, SMILES originales, fórmula e InChIKey en el [fixture](../../tests/fixtures/b701-independent-reference.json). Se seleccionaron antes de ejecutar el generador; incluyen regioisómeros, halógenos mixtos, alcoxi, alquilo, di-/tri-, un caso nitro y una amida N-sustituida de frontera. Se transcribieron los descriptores públicos vistos en las páginas, sin conservar respuestas HTTP firmadas; esto limita la auditoría de la captura frente a un recibo guardado. Los identificadores pueden consultarse mediante los enlaces directos de la [matriz](matrix.md). El nombre `2,4,6-trifluorobenzonitrile` ya figuraba en B7.0 como nombre adversarial contra **otro** grafo; la estructura correspondiente no se utilizó allí como positivo.

La unicidad se comprobó por identidad de grafo OpenChemLib entre los 18 registros y frente a los fixtures B50/B61/B62 y los tres ejemplos construidos de B7.0. No se inspeccionó exhaustivamente cada SMILES incidental de todas las pruebas históricas, por lo que no se afirma una prueba de novedad universal. El corpus, fecha UTC, versión y hash se guardaron antes de medir en [corpus-freeze.json](corpus-freeze.json); SHA-256 `d8bd4c18125c2ba947136d6d179699c20c0ae776b8aa83d500409b0b6afca8b1`. No se editó ni reemplazó el fixture.

## Primera medición y OPSIN

La [medición inicial inmutable](initial.json) contiene por caso análisis, función, progenitor, sustituyentes, nombre/estado ES y EN, evidencia de numeración y controles FULL disponibles. En 18 moléculas:

Los cinco perfiles inicialmente PARTIAL se proyectaron por separado en [initial-partial-controls.json](initial-partial-controls.json), cargando después el `page.tsx` del commit B7.0 y verificando que sus nombres coincidieran con la medición inicial. Esos controles son razonamiento local PARTIAL, no una prueba independiente de nombre a grafo; esta recuperación posterior no modifica la medición ciega.

| Medida inicial | ES | EN |
|---|---:|---:|
| FULL interno | 16 | 13 |
| PARTIAL | 1 | 4 |
| UNSUPPORTED | 1 | 1 |

OPSIN local 2.9.0 interpretó los 17 nombres ingleses generados: **13 FULL-OPSIN-CONFIRMED**, **4 PARTIAL-VERIFIED**, **1 UNSUPPORTED-SAFE**, ninguna contradicción estructural ni resultado inconcluso. La clasificación se refiere a identidad del grafo, no a corrección del orden alfabético o PIN. Detalles y SMILES reconstruidos están en [opsin-initial.json](opsin-initial.json). Se compararon composición e identidad canónica estructural con el fixture, no solo fórmulas o cadenas SMILES. OPSIN es un intérprete independiente del nombre, pero OrgoRush y el comparador utilizan OpenChemLib: no se presenta esta comparación como una segunda implementación totalmente independiente de identidad.

El caso nitro B701-17 quedó PARTIAL en ambos idiomas; la amida N-bencilo B701-18 quedó UNSUPPORTED. Ninguno fue promovido artificialmente. Los 16 restantes eran FULL en ES. Los tres PARTIAL adicionales en EN, B701-03/04/05, conservaban conectividad correcta pero citaban `methoxy` antes de `iodo`; B701-17 también citaba `nitro` antes de `iodo`. El orden es un defecto de presentación nomenclatural, no un cambio de grafo. La organización de prefijos se apoya en las reglas de orden alfanumérico del [Blue Book P-14/P-59](https://iupac.qmul.ac.uk/BlueBook/P5.html) y en la adaptación lingüística ya documentada en B6.3; los nombres calculados de PubChem no certifican PIN.

## Corrección desarrollada sobre el corpus

Una prueba roja conservada en `tests/b701-localized-order.test.mjs` reprodujo `2-methoxy-4-iodobenzaldehyde` frente a `4-iodo-2-methoxybenzaldehyde`. La causa general estaba en `resolveLocalizedCurrentAnalysis`: se localizaban cadenas acíclicas y bencenos sin sufijo, pero no los padres aromáticos funcionales; el traductor textual tampoco incluía alcoxi o nitro en su ordenación limitada de halógenos.

En `app/page.tsx` se añadió una propuesta acotada, basada en el grafo y el análisis, para benzaldehído, benzonitrilo y benzamida con un grupo principal, un anillo aromático y prefijos simples que reconstruyen el nombre español completo. Se valida C1, se comparan las dos orientaciones con claves alfabéticas inglesas y se vuelven a construir nombre, numeración y sustituyentes como una sola asignación. La prueba de empate independiente verifica que 2-metoxi-6-yodo en ES pasa a 2-iodo-6-methoxy en EN. Se mantienen los límites de estereoquímica y la gramática de evidencia; el caso nitro se ordena correctamente pero sigue PARTIAL.

La [medición posterior final](post-verified.json) se desarrolló sobre este corpus y **no constituye una segunda evaluación ciega**. El archivo de código final `app/page.tsx` tiene SHA-256 `474216ccfbf84cc6d8fcfec6ae2452a52433138af2c37995a55ef48cef97082b`. Los resultados intermedios se conservan en [post.json](post.json) y [post-final.json](post-final.json); tras comprobar expresamente el anclaje C1 y la existencia de los seis átomos se repitió la medición. Sus nombres y estados son idénticos a los interpretados por OPSIN en la ejecución post-corrección.

| Medida posterior | ES | EN |
|---|---:|---:|
| FULL interno | 16 | 16 |
| PARTIAL | 1 | 1 |
| UNSUPPORTED | 1 | 1 |

La repetición local de OPSIN para esos nombres dio 16 FULL-OPSIN-CONFIRMED, 1 PARTIAL-VERIFIED y 1 UNSUPPORTED-SAFE; [opsin-post.json](opsin-post.json). La medición final coincide en nombres y estados con los que se enviaron a OPSIN local. El resultado detallado por compuesto está en [matrix.md](matrix.md) y los recuentos en [coverage.json](coverage.json).

## Controles, invariancia e interfaz

Las pruebas adversariales separadas abarcan posiciones, sustitución de F/Cl y Br/I, multiplicidad, localizador duplicado/fuera del anillo, orden, función, unión carbono frente a oxígeno, longitud alquilo, regioisómeros de igual fórmula, nombre fuera de familia, amida N-sustituida, heteroaromático y nitro. Se exige ausencia de FULL para el emparejamiento incompatible; un rechazo acotado no implica invalidez universal del nombre.

Los 16 positivos se reanalizaron con IDs permutados, enlaces y extremos invertidos, geometría rotada/trasladada, doble enlace aromático Kekulé alternativo y exportación/reimportación SMILES, con alternancia ES→EN→ES→EN. La identidad canónica se verificó antes de comparar resultados. Para cada representación e idioma se exige un isomorfismo completo que preserve conjuntamente regiones nombradas, enlaces y localizadores; la UI comprueba además los destinos de cada control. Esto no agota todas las posibles moléculas o simetrías.

Playwright con Edge local 157 importó tres estructuras nuevas (B701-03, B701-05 y B701-11), sin simular nombres ni resultados de química. Las pruebas compararon nombres, FULL, función, padre, prefijos, multiplicadores y localizadores literales, átomos/enlaces resaltados, idioma y geometría: **3/3 casos, 84 activaciones**; [resultados finales](e2e-final/results.json). Las peticiones de metadatos externos opcionales se aislaron.

La batería focalizada B4.1/B4.2, B5, B6, B7, B7.0.1 y numeración visual pasó 141/141 durante el desarrollo; tras los endurecimientos se repitieron B7 y B7.0.1 (10/10), además de B7 y VALIDATION-008/014 y adaptador (101/101 tras el primer control C1). V008-072, aspirina, ibuprofeno y paracetamol quedaron cubiertos; el test B7 comprueba que el generador local de ibuprofeno sigue bloqueado. `npm run typecheck` y `git diff --check` pasaron. No se ejecutó la batería completa ni se modificaron workflows o baselines históricos.

## Límites y B7.1

La muestra no es aleatoria y no estima la exactitud universal. La cobertura probada se limita a estos 18 registros y los controles descritos. Conviene que B7.1 amplíe con una muestra externa nueva y congelada **después** de este arreglo, con desempates de idioma y controles de simetría; tratar nitro y amidas N-sustituidas como familias separadas con pruebas de prioridad y grafo antes de conceder FULL. No se añadieron dependencias de producción ni Java/OPSIN al bundle, y no se hizo commit ni push.
