# OrgoRush — auditoría de motores IUPAC 2013 y 1979 Legacy

Fecha: 2026-10-13. Alcance: diagnóstico y caracterización; no se modificó código de producción.

## A. Estado inicial del repositorio

- Rama: `main`, siguiendo `origin/main`.
- Commit inicial: `59494da1538641b68e49a3bd5bf9962d724f86a7`.
- Árbol inicial limpio (`git status --short --branch`: `## main...origin/main`).

## B. Arquitectura de nomenclatura

La interfaz mantiene una sola `Analysis` del grafo. `analyzeMolecule` construye el nombre sugerido y fija `mainChain`, numeración, enlaces múltiples y sustituyentes. El selector de idioma/perfil de la interfaz deriva las cuatro presentaciones de ese análisis local; cambiar el perfil o el idioma no vuelve a analizar ni modifica el grafo.

- **2013 ES:** aplica el nombre sugerido del análisis y las convenciones de presentación actuales.
- **2013 EN:** traduce los morfemas españoles de ese nombre local con `translateSpanishIupacToOpsin`/la localización de la interfaz. No hay segundo análisis estructural inglés.
- **1979 EN:** `buildLegacyEnglishNameModel` adapta la misma `Analysis` —incluida su `mainChain`— a un modelo semántico; `generateLegacyEnglishName` construye el formato histórico inglés. No vuelve a escoger una cadena independiente para estos casos.
- **1979 ES:** `legacySpanishFormatterInput` conserva los localizadores del grafo y `applyNomenclatureConvention` pasa el nombre a `formatIupac1979SpanishName`/`formatTraditionalSystematicName`. Este formateador español es una gramática de patrones limitados, no una traducción general ni un motor independiente de análisis.

En la vista, un `"-"` español hace que `legacyProfileDisplayName` devuelva `available: false` y el mensaje «No disponible para esta estructura». No hay excepción ni retorno nulo: la indisponibilidad es un resultado explícito del formateador cuando no reconoce el patrón. El comentario de código limita deliberadamente la función a patrones sistemáticos verificados, aunque no define una lista formal de clases cubiertas.

## C. Resultados de las 84 comprobaciones

Las 21 entradas pasaron por `moleculeFromSmiles`; las cuatro salidas se calcularon desde el mismo grafo por molécula. El test vuelve a parsear y calcular cada caso y comprueba determinismo, identidad de átomos/enlaces entre ejecuciones y salidas observadas fijadas en fixture. No se infirieron descriptores E/Z. El test no maneja navegador ni afirma una prueba manual de interfaz.

**Lectura de estados:** `PASS` = el resultado observado satisface la propiedad indicada; `FAIL` = incumple la propiedad explícita (indisponibilidad, formato NOM-002 o criterio PIN NOM-003); `PARTIAL` = nombre generado y se conserva como evidencia, pero no hubo verificación normativa independiente de esa celda. La disponibilidad y el PIN se informan por separado: una cadena no vacía no equivale a corrección.

| ID / SMILES | 2013 EN | 2013 ES | 1979 EN | 1979 ES |
|---|---|---|---|---|
| 01 `CC(C)CC` | PARTIAL · `2-methylbutane` | PARTIAL · `2-metilbutano` | PARTIAL · `2-methylbutane` | **FAIL · no disponible** (`-`) |
| 02 `CC(Cl)CC(C)C` | PARTIAL · `2-chloro-4-methylpentane` | PARTIAL · `2-cloro-4-metilpentano` | PARTIAL · `2-chloro-4-methylpentane` | **FAIL · no disponible** (`-`) |
| 03 `CC(C)CC=O` | PARTIAL · `3-methylbutanal` | PARTIAL · `3-metilbutanal` | PARTIAL · `3-methylbutanal` | PARTIAL · `3-metilbutanal` |
| 04 `CC(=O)CC=O` | PARTIAL · `3-oxobutanal` | PARTIAL · `3-oxobutanal` | PARTIAL · `3-oxobutanal` | PARTIAL · `3-oxobutanal` |
| 05 `O=CC1CCCCC1` | PARTIAL · `cyclohexanecarbaldehyde` | PARTIAL · `ciclohexanocarbaldehído` | PARTIAL · `cyclohexanecarbaldehyde` | **FAIL · no disponible** (`-`) |
| 06 `O=C(O)C1CCCCC1` | PARTIAL · `cyclohexanecarboxylic acid` | PARTIAL · `ácido ciclohexanocarboxílico` | PARTIAL · `cyclohexanecarboxylic acid` | **FAIL · no disponible** (`-`) |
| 07 `CC=CC` | PARTIAL · `but-2-ene` | PARTIAL · `but-2-eno` | PARTIAL · `2-butene` | PARTIAL · `2-buteno` |
| 08 `CCC#CC` | PARTIAL · `pent-2-yne` | PARTIAL · `pent-2-ino` | PARTIAL · `2-pentyne` | PARTIAL · `2-pentino` |
| 09 `CC(O)CC` | PARTIAL · `butan-2-ol` | PARTIAL · `butan-2-ol` | PARTIAL · `2-butanol` | PARTIAL · `2-butanol` |
| 10 `CC(=O)CC` | PARTIAL · `butan-2-one` | PARTIAL · `butan-2-ona` | PARTIAL · `2-butanone` | PARTIAL · `2-butanona` |
| 11 `OCCC=C` | PARTIAL · `but-3-en-1-ol` | PARTIAL · `but-3-en-1-ol` | PARTIAL · `3-buten-1-ol` | **FAIL · no disponible** (`-`) |
| 12 `CC(O)C=C` | PARTIAL · `but-3-en-2-ol` | PARTIAL · `but-3-en-2-ol` | PARTIAL · `3-buten-2-ol` | **FAIL · no disponible** (`-`) |
| 13 `CC(=O)C=C` | PARTIAL · `but-3-en-2-one` | PARTIAL · `but-3-en-2-ona` | PARTIAL · `3-buten-2-one` | PARTIAL · `3-buten-2-ona` |
| 14 `CC(O)CC(O)C` | PARTIAL · `pentan-2,4-diol` | PARTIAL · `pentan-2,4-diol` | PARTIAL · `2,4-pentanediol` | PARTIAL · `2,4-pentanodiol` |
| 15 `C=CCC#C` | PARTIAL · `pent-1-en-4-yne` | PARTIAL · `pent-1-en-4-ino` | PARTIAL · `1-penten-4-yne` | **FAIL · no disponible** (`-`) |
| 16 `CC=CC(C)C` | PARTIAL · `4-methylpent-2-ene` | PARTIAL · `4-metilpent-2-eno` | PARTIAL · `4-methyl-2-pentene` | PARTIAL · `4-metil-2-penteno` |
| 17 `OC1=CCCCC1` | PARTIAL · `cyclohex-1-en-1-ol` | PARTIAL · `ciclohex-1-en-1-ol` | PARTIAL · `1-cyclohexenol` | **FAIL · no disponible** (`-`) |
| 18 `O=C1C=CCCC1` | PARTIAL · `cyclohex-2-en-1-one` | PARTIAL · `ciclohex-2-en-1-ona` | PARTIAL · `2-cyclohexenone` | **FAIL · formato/localizadores** · `ciclo-2-hexen-1-ona` |
| 19 `C=CC(CCC)CCC` | **FAIL · no PIN** · `3-propylhex-1-ene` | **FAIL · no PIN** · `3-propilhex-1-eno` | PASS · `3-propyl-1-hexene` | PASS · `3-propil-1-hexeno` |
| 20 `C#CC(CCC)CCC` | **FAIL · no PIN** · `3-propylhex-1-yne` | **FAIL · no PIN** · `3-propilhex-1-ino` | PASS · `3-propyl-1-hexyne` | PASS · `3-propil-1-hexino` |
| 21 `CC(=O)C(O)C` | PARTIAL · `3-hydroxybutan-2-one` | PARTIAL · `3-hidroxibutan-2-ona` | PARTIAL · `3-hydroxy-2-butanone` | PARTIAL · `3-hidroxi-2-butanona` |

Resumen de las 84 celdas: 84 ejecutadas; 8 Legacy ES sin nombre; 1 Legacy ES con ensamblaje sospechoso; 4 nombres 2013 que representan la estructura pero no son el PIN esperado; 2 nombres Legacy que satisfacen el perfil histórico esperado en los casos 19–20; 69 celdas permanecen `PARTIAL` por falta de validación normativa independiente. El test fija observaciones, no declara correctas todas las salidas no reportadas como defectuosas.

## D. Diagnóstico NOM-001 — Legacy español indisponible

**Causa confirmada:** `formatTraditionalSystematicName` no tiene una regla que acepte el patrón de nombre localizado de cada caso. Devuelve `undefined`; `formatIupac1979SpanishName` lo conserva y `applyNomenclatureConvention` lo convierte en `"-"`. La capa de presentación marca el perfil como no disponible. El Legacy inglés, por su parte, sí construye las ocho salidas a partir del modelo de grafo. Por tanto, el defecto no es que la molécula no se analice, ni una excepción silenciosa, ni que el motor inglés carezca de nombre.

| Caso | Nombre/localizador que llega al formateador | Regla que falta | Responsable y causa |
|---|---|---|---|
| 01 | `2-metilbutano` | Alcano ramificado general | `formatTraditionalSystematicName`: reconoce alcanos puros y ciertos patrones con sufijo; no tiene una rama general de alcano + prefijo alquilo. |
| 02 | `2-cloro-4-metilpentano` | Haloalcano ramificado | El patrón general de sustitución no se procesa como nombre sistemático completo; la compactación de halógenos ocurre después del formateo y no puede rescatar `undefined`. |
| 05 | `ciclohexanocarbaldehído` | Aldehído exocíclico unido a cicloalcano (`-carbaldehído`) | El patrón de aldehído disponible trata cadena con sufijo `-anal`; no el nombre de grupo unido al anillo. |
| 06 | `ácido ciclohexanocarboxílico` | Ácido carboxílico unido a anillo (`ácido …carboxílico`) | El patrón de ácido sistemático disponible acepta cadena `ácido …anoico`, no el padre cíclico. |
| 11 | `but-3-en-1-ol` | Alcohol insaturado terminal | La regla de alcohol Legacy solo contempla el padre saturado `…an-…-ol`/`…anol`; no procesa `…en…ol`. |
| 12 | `but-3-en-2-ol` | Alcohol insaturado interno | La misma omisión de gramática que el caso 11. |
| 15 | `pent-1-en-4-ino` | Ene-ino (doble y triple enlace) | Hay patrón para enlace múltiple aislado, pero no conversión general de `en` + `ino` ni de conjuntos de localizadores mixtos. |
| 17 | `ciclohex-1-en-1-ol` | Enol cíclico | El analizador reconoce el anillo, el doble enlace y el OH en C1; el formateador carece de combinación ciclo + insaturación + sufijo alcohol. |

La ruta se reproduce sin UI ni dependencias externas: parsear SMILES → `analyzeMolecule` → `legacySpanishFormatterInput` → `applyNomenclatureConvention(..., "iupac-1979-es", "es")` → `"-"` → `legacyProfileDisplayName(...).available === false`. En la UI, además, el cálculo se suprime cuando el nombre local no está disponible; esa condición no se activa para estos ocho casos. No se encontró política intencional por clase molecular; la cobertura limitada sí está codificada como decisión de diseño general del formateador, sin inventar nombres cuando no puede reconocer un patrón.

**Corrección mínima posterior recomendada:** ampliar el formateador declarativamente con formas verificadas (alcano sustituido/halogenado, sufijos carbaldehído y carboxílico cíclicos, alcohol insaturado y anillo insaturado funcionalizado) o reemplazar el conjunto de regex por un ensamblador composicional que use los localizadores ya calculados. Impacto probable: los nombres Legacy españoles de todas esas familias dejan de estar indisponibles; riesgo de colisiones de regex y cambios en salidas históricas cercanas, por lo que cada forma necesita fixtures específicos.

## E. Diagnóstico NOM-002 — caso 18

Grafo y análisis local confirmados: ciclo de seis carbonos, cetona en C1, doble enlace C2–C3; el análisis 2013 produce `ciclohex-2-en-1-ona`. El perfil inglés histórico produce `2-cyclohexenone`. El español Legacy observado es `ciclo-2-hexen-1-ona`.

La causa técnica está en el patrón de cetona insaturada de `formatTraditionalSystematicName`. La captura `parent = (.*?)(root)` separa `ciclo` como prefijo y `hex` como raíz; después antepone el localizador de enlace a la raíz y vuelve a añadir el prefijo con guion, creando `ciclo-2-hexen-1-ona`. Conserva el localizador de carbonilo `1` del nombre 2013 aunque el formato histórico paralelo lo omite cuando es el C1 inherente, y coloca el localizador de insaturación después de `ciclo` en lugar de delante de la unidad `ciclohex`.

La regla histórica C-314.1 describe las cetonas cíclicas por sufijo `-one` añadido al nombre del anillo con elisión de `e`; C-315.1 cubre cetonas cíclicas insaturadas. El resultado inglés del motor es congruente con la forma antigua `2-cyclohexenone`; por paralelismo, `2-ciclohexenona` es la forma española de estilo histórico más probable. La evidencia disponible no confirma una edición normativa IUPAC de 1979 en español, así que la aceptabilidad histórica exacta de esa grafía española queda pendiente. Sí queda confirmado que el ensamblaje actual no conserva la forma/unidad `ciclohex` como padre, y no coincide con el propio perfil inglés Legacy. No es una cuestión de identidad estructural ni de asignar E/Z.

**Impacto probable:** el mismo patrón puede afectar cicloalquenonas y cicloalquinonas con sufijo en el anillo; también conviene revisar los patrones de alcoholes cíclicos insaturados (caso 17) y el tratamiento general de locantes del carbonilo inherentes en anillos. No se extrapoló a otros ciclos sin prueba.

## F. Diagnóstico NOM-003 — selección de cadena y PIN

Para los casos 19 y 20 hay dos esqueletos candidatos relevantes: una cadena de seis carbonos que contiene el enlace múltiple, y un camino saturado de siete carbonos que deja el grupo etenilo/etinilo como sustituyente. El análisis actual selecciona la primera, informa seis átomos en `mainChain` y produce `3-propylhex-1-ene` / `3-propylhex-1-yne`.

La selección es compartida entre modos: `analyzeHydrocarbonMolecule` genera candidatos del grafo y llama a `selectLegacyParentCandidate`; `parentCriteria` de `app/page.tsx` los ordena por `principalGroupCount`, después **`multipleBondCount` y después `carbonCount`**. En estos hidrocarburos sin grupo principal, una insaturación gana antes de comparar longitud. El nombre inglés 1979 consume la misma cadena de `Analysis` mediante `buildLegacyEnglishNameModel`, por eso obtiene una cadena de seis carbonos y solo cambia la disposición Legacy de localizadores. El análisis 2013 tampoco tiene selector PIN independiente: cambia la morfología de salida, no el padre elegido.

Esto incumple el orden 2013 aplicable a cadenas acíclicas. P-44.3.2 antepone número de átomos del esqueleto y dice expresamente que, desde 2013, longitud precede a insaturación; sus ejemplos declaran `octane (PIN)` preferido a `hept-1-ene (PIN)`. P-44.4 solo considera mayor número de enlaces múltiples cuando P-44.1–P-44.3 no resuelven la elección. Los dos SMILES tienen siete carbonos en el camino saturado, más que los seis de la cadena insaturada, así que para la regla indicada la elección es `4-ethenylheptane` y `4-ethynylheptane`, respectivamente. La localización queda en C4 al numerar heptano desde cualquiera de los extremos equivalentes. En la forma española usada por la app: `4-etenilheptano` y `4-etinilheptano`; la traducción española no define un PIN oficial, pero conserva la estructura y la selección de padre.

Los nombres actuales no son nombres químicamente imposibles: describen la conectividad con una convención que prioriza la insaturación y son congruentes con la prioridad histórica indicada para 1979. El defecto es específico a presentarlos como resultado Blue Book 2013/PIN. La diferencia inglesa 2013 vs. 1979 (`3-propylhex-1-ene` frente a `3-propyl-1-hexene`) demuestra que el modo moderno cambia principalmente el formato/localizadores, no que cambie la selección de padre.

**Corrección posterior recomendada:** separar los comparadores de padres por perfil. En 2013, implementar los criterios P-44 en el orden normativo completo (no solo intercambiar dos campos globalmente); mantener la jerarquía Legacy para 1979. El análisis de cada modo tendría que transportar su propio padre, localizadores y procedencia a los formateadores. Riesgo alto: cambios en cadenas ramificadas, funciones principales, explicaciones y cualquier componente que asuma una sola `Analysis`; requieren pruebas diferenciales amplias para ambos motores.

## G. Plan de corrección

| Prioridad | Cambio futuro | Dificultad / riesgo | Archivos probables |
|---|---|---|---|
| P1 | Añadir selección de cadena 2013 conforme a P-44 y desacoplarla del perfil Legacy; casos 19/20 como PIN y pruebas de desempate | Alta / alto: cambia padres y numeración en varias clases | `app/page.tsx`, modelo/análisis de nomenclatura; pruebas de motores |
| P2 | Completar o componer el formateador 1979 ES para las ocho formas NOM-001, con cada forma estructuralmente sustentada | Media / medio: aumenta cobertura y puede afectar familias vecinas | `app/nomenclature-conventions.ts`, pruebas dedicadas y fixture |
| P3 | Corregir composición de prefijo cíclico/localizadores de cetona en el formato Legacy español; verificar cicloalquenonas y cicloalquinonas antes de generalizar | Media / medio | `app/nomenclature-conventions.ts`, pruebas Legacy ES |
| P4 | Ampliar el verificador de la batería con oráculos estructurales/normativos independientes para las 69 celdas parciales | Media / bajo para producción; requiere curación química | `tests/fixtures/iupac-engine-audit-observed.json`, matriz de expectativas y documentación |

## H. Verificaciones y cambios realizados

Archivos añadidos:

- `tests/iupac-engine-audit.test.mjs`: parseo de los 21 SMILES, cálculo cuatro modos/idiomas (84 salidas), determinismo, identidad de grafo entre ejecuciones, y caracterización exacta de las salidas auditadas.
- `tests/fixtures/iupac-engine-audit-observed.json`: snapshot de los nombres actuales; los defectos esperados se conservan como datos y se explicitan arriba, no se ocultan con `skip`/`todo`.
- `reports/orgorush-iupac-engine-audit.md`: este informe técnico.

Comando ejecutado: `node --test --test-concurrency=1 tests/iupac-engine-audit.test.mjs tests/legacy-english-nomenclature.test.mjs tests/language-audit-regressions.test.mjs tests/nomenclature-conventions.test.mjs tests/chemistry-regressions.test.mjs`. Resultado: **93 pruebas PASS, 0 FAIL**, duración aproximada 91 s. Tras añadir la comprobación explícita de caso 17 (OH en C1 y doble enlace C1–C2), se volvió a ejecutar `node --test tests/iupac-engine-audit.test.mjs`: **1 prueba PASS, 0 FAIL**. Los casos conocidos se reportan como fallos normativos en la matriz, mientras la prueba de caracterización pasa al confirmar que el comportamiento observado sigue siendo reproducible.

No se modificaron algoritmos de nomenclatura ni otros archivos productivos. No se ejecutó una sesión de interfaz manual. La afirmación de que los nombres de los 21 casos son todos químicamente correctos no se hace: los casos marcados `PARTIAL` conservan el resultado y requieren oráculos de referencia externos o revisión química independiente.

### Fuentes normativas consultadas

- [Blue Book 2013, P-44.3.2 y P-44.4](https://iupac.qmul.ac.uk/BlueBook/P4.html): selección de cadenas, inversión de prioridad longitud/insaturación y criterios posteriores.
- [Blue Book 2013, P-45](https://iupac.qmul.ac.uk/BlueBook/P4.html): selección PIN entre nombres basados en un mismo padre principal.
- [IUPAC 1979, Rule A-3.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm): hidrocarburos acíclicos insaturados y localizadores de doble enlace.
- [IUPAC 1979, Rule C-314](https://www.acdlabs.com/iupac/nomenclature/79/r79_276.htm) y [C-315](https://www.acdlabs.com/iupac/nomenclature/79/r79_278.htm): sufijos de cetona en ciclos saturados e insaturados.

## Seguimiento — corrección NOM-001 (2026-10-13)

Este seguimiento documenta la implementación posterior de cobertura en el formateador 1979 español. La matriz inicial y `tests/fixtures/iupac-engine-audit-observed.json` permanecen como evidencia histórica del estado anterior; los resultados actuales se comprueban aparte con `tests/fixtures/iupac-engine-audit-nom001-conforming.json`.

| Caso | Antes (1979 ES) | Después (1979 ES) | Regla / formación aplicada |
|---|---|---|---|
| 01 | `-` | `2-metilbutano` | A-2.1–2.3: alcano ramificado, cadena principal, menor localizador y sustituyente. |
| 02 | `-` | `2-cloro-4-metilpentano` | A-2.1–2.3: prefijos con localizadores y orden alfabético (`cloro`, `metil`). |
| 05 | `-` | `ciclohexanocarbaldehído` | C-304.1: sufijo `-carbaldehído` sobre el nombre del sistema cíclico. |
| 06 | `-` | `ácido ciclohexanocarboxílico` | C-401.2: sufijo `-carboxílico` sobre el padre cíclico. |
| 11 | `-` | `3-buten-1-ol` | A-3.1 y C-201.1: localizador de insaturación antepuesto al padre; localizador OH ante `-ol`. |
| 12 | `-` | `3-buten-2-ol` | A-3.1 y C-201.1: misma forma con el localizador OH 2. |
| 15 | `-` | `1-penten-4-ino` | A-3.3: forma histórica enino con localizadores separados para C=C y C≡C. |
| 17 | `-` | `1-ciclohexen-1-ol` | A-11.3 y C-201.1: padre cíclico insaturado y localizador OH expreso antes del sufijo. |

La implementación se limita al camino `formatIupac1979SpanishName`; el formateador Traditional conserva su cobertura anterior. Se añadieron patrones composicionales acotados a raíces y prefijos simples admitidos por este módulo. No se usaron nombres ingleses como entrada, reglas por SMILES ni cambios a análisis/selección de cadenas. En particular, caso 17 conserva la asignación verificada de OH en C1 y enlace C1=C2; el localizador del sufijo se mantiene porque C-201.1 indica el grupo OH por `-ol` y debe quedar inequívoco.

La tabla histórica de 84 salidas y los resultados actuales se separan en pruebas: el snapshot original sigue mostrando ocho guiones; las nuevas expectativas de conformidad fijan las ocho formas anteriores y comprueban disponibilidad del perfil. La prueba completa también compara los otros 76 resultados con el snapshot histórico; NOM-002 (caso 18) y NOM-003 (casos 19–20) quedan sin cambios. La batería combinada, incluida la comprobación de identidad de átomos y enlaces durante el formateo, terminó con **93 pruebas PASS, 0 FAIL, 0 omitidas**, en aproximadamente 129 s. `git diff --check` también terminó sin errores.

Archivos modificados para este seguimiento: `app/nomenclature-conventions.ts`, `tests/iupac-engine-audit.test.mjs`, `reports/orgorush-iupac-engine-audit.md` y el nuevo `tests/fixtures/iupac-engine-audit-nom001-conforming.json`. El fixture histórico `tests/fixtures/iupac-engine-audit-observed.json` se conservó sin cambios. No se creó commit ni se hizo push.

Fuentes de las formas incorporadas: [1979 A-2](https://www.acdlabs.com/iupac/nomenclature/79/r79_36.htm), [A-3](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm), [A-11](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm), [C-201](https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm), [C-304](https://www.acdlabs.com/iupac/nomenclature/79/r79_255.htm) y [C-401](https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm). Las terminaciones en español son las formas sistemáticas españolas del perfil del producto; las referencias 1979 citadas están publicadas en inglés.

## Diagnóstico previo — NOM-002 cicloalquenonas (2026-10-13)

Estado de partida: rama `main`, commit `3ed050701eae6f9de7a5308ee75c4f956424189e`, árbol limpio. NOM-001 ya estaba integrado. Se leyeron la batería de auditoría, ambos fixtures y la implementación vigente antes de cambiar producción.

La causa reproducida es la rama `unsaturatedKetone` de `formatTraditionalSystematicName` en `app/nomenclature-conventions.ts`. El patrón compartido construye `parent = (.*?)(root)`. Para `ciclohex-2-en-1-ona`, el grupo inicial captura `ciclo` y la raíz captura `hex`; luego `withTraditionalPrefix` antepone esa captura con guion a `2-hexen-1-ona`. El mismo mecanismo genera `ciclo-2-penten-1-ona`, `ciclo-3-hexen-1-ona`, `ciclo-2-hepten-1-ona` y `4-metilciclo-2-hexen-1-ona`. El localizador del carbonilo `1` se conserva porque la plantilla de cetona insaturada conserva explícitamente el localizador del sufijo `-ona`; el generador Legacy inglés, separado, lo omite en este conjunto.

En la familia probada, la cadena principal siempre es el anillo completo. `analysis.functionalGroups` ubica el carbono del carbonilo como locante 1 y `doubleBondLocants` informa 2 o 3 según el SMILES. No hay selección de cadena que corregir. El defecto afecta cetonas cíclicas insaturadas de cinco, seis y siete átomos, y una forma sustituida. No se reproduce en cetonas saturadas de cinco y seis miembros, cuyos nombres permanecen `ciclopentanona` y `ciclohexanona`. Las reglas NOM-001 para cicloaldehídos, ácidos cíclicos y alcohol cíclico insaturado usan patrones separados; el patrón de cetona puede corregirse en el límite de formato sin tocar el análisis compartido.

Interpretación normativa preliminar, antes del arreglo: IUPAC 1979 C-16.11 enumera `cyclo` entre las sílabas no separables del nombre padre; separar `ciclo` de `hex` no es válido. C-314.1 indica formar cetonas cíclicas clásicas añadiendo `-one` al nombre del sistema de anillo. A-11.3 indica expresar las insaturaciones del monociclo mediante `-ene` y dar números bajos a los enlaces múltiples; C-15.11 da prioridad a los grupos principales citados como sufijo frente a enlaces múltiples al escoger la numeración. Por eso el carbono del grupo cetona es C1 y las posiciones de los dobles enlaces de estos casos son 2 o 3. Para un único carbonilo en una monocetona monocíclica, el 1 resulta inherente al sufijo en esta forma Legacy, y se omite en el generador Legacy inglés, como `2-cyclohexenone`. Las reglas citadas no formulan literalmente en inglés la grafía española ni una regla general aislada de omisión del `1`; por tanto, `2-ciclohexenona` y sus análogos son adaptación morfológica española del formato histórico documentado en inglés, no cita textual ni nombre español publicado por IUPAC 1979. Se mantienen separados de las formas actuales `ciclohex-2-en-1-ona`.

La caracterización previa de las siete moléculas registró: cetonas saturadas correctas; las cinco insaturadas, respectivamente, `ciclo-2-penten-1-ona`, `ciclo-2-hexen-1-ona`, `ciclo-3-hexen-1-ona`, `ciclo-2-hepten-1-ona` y `4-metilciclo-2-hexen-1-ona`. La matriz normativa posterior verifica nombre, grafo, locante del grupo carbonilo y locante de insaturación, y mantiene separados los outputs 2013 e inglés Legacy.

Fuentes verificadas directamente: [IUPAC 1979 C-16.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_879.htm), [C-314.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_276.htm), [C-315.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_278.htm), [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm) y [A-11.3](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm). C-314.1 describe el procedimiento clásico; C-315.1 es una alternativa para policarbociclos y heterociclos, así que no se presenta esa alternativa como la regla aplicable a estos monociclos.

## Seguimiento — corrección NOM-002 cicloalquenonas (2026-10-13)

### Resultado e interpretación

Se añadió una regla previa y exclusiva de `formatIupac1979SpanishName` para la familia estructural `prefijos + ciclo + raíz + localizador-en + localizador-ona`. La reconstrucción mantiene `ciclo` unido a la raíz del anillo, mueve el locante de la insaturación delante del padre y omite el `1` del carbonilo cuando es el locante inherente de la monocetona cíclica. Si el locante del carbonilo no es 1, el patrón lo conserva. No hay ramas por SMILES ni cambios en análisis o selección de padre.

La omisión del `1` se apoya en la forma Legacy documentada por el motor inglés para las siete estructuras y en que C-314.1 forma la cetona cíclica por el sufijo `-one` directamente en el nombre del anillo; la regla C-15.11 da prioridad de numeración al grupo citado como sufijo sobre el enlace múltiple. Con la numeración del grafo, eso fija el carbonilo en C1 y deja locantes de dobles enlaces 2 o 3. La grafía española es adaptación morfológica del Legacy inglés y de las reglas históricas, no prescripción textual española publicada por IUPAC. La forma 2013 moderna se conserva con el localizador explícito (`ciclohex-2-en-1-ona`).

| Molécula | 1979 ES antes | 1979 ES después | 1979 EN después | 2013 EN / ES (sin cambios) |
|---|---|---|---|---|
| Ciclopentanona | `ciclopentanona` | `ciclopentanona` | `cyclopentanone` | `cyclopentanone` / `ciclopentanona` |
| Ciclohexanona | `ciclohexanona` | `ciclohexanona` | `cyclohexanone` | `cyclohexanone` / `ciclohexanona` |
| Ciclopent-2-en-1-ona | `ciclo-2-penten-1-ona` | `2-ciclopentenona` | `2-cyclopentenone` | `cyclopent-2-en-1-one` / `ciclopent-2-en-1-ona` |
| Ciclohex-2-en-1-ona | `ciclo-2-hexen-1-ona` | `2-ciclohexenona` | `2-cyclohexenone` | `cyclohex-2-en-1-one` / `ciclohex-2-en-1-ona` |
| Ciclohex-3-en-1-ona | `ciclo-3-hexen-1-ona` | `3-ciclohexenona` | `3-cyclohexenone` | `cyclohex-3-en-1-one` / `ciclohex-3-en-1-ona` |
| Ciclohept-2-en-1-ona | `ciclo-2-hepten-1-ona` | `2-cicloheptenona` | `2-cycloheptenone` | `cyclohept-2-en-1-one` / `ciclohept-2-en-1-ona` |
| 4-Metilciclohex-2-en-1-ona | `4-metilciclo-2-hexen-1-ona` | `4-metil-2-ciclohexenona` | `4-methyl-2-cyclohexenone` | `4-methylcyclohex-2-en-1-one` / `4-metilciclohex-2-en-1-ona` |

`tests/fixtures/iupac-engine-nom002-cyclic-ketones.json` fija estas cuatro salidas por estructura, fórmula y locantes de carbonilo y alqueno, con la base normativa. `tests/iupac-nom002-cyclic-ketones.test.mjs` comprueba además el grafo antes y después de formatear y que el anillo completo siga siendo la cadena principal. El fixture histórico de auditoría no se modificó: caso 18 aún documenta `ciclo-2-hexen-1-ona` como dato observado anterior. La prueba matriz separa ahora esa evidencia de la expectativa normativa nueva.

### Regresiones y validaciones

- NOM-001: se volvieron a evaluar sus ocho nombres; todos siguen conformes y disponibles.
- Matriz original: las 21 estructuras × cuatro perfiles se recalculan. En los 21 casos, Legacy EN, 2013 EN y 2013 ES permanecen idénticos al fixture histórico; fuera de los nueve casos de NOM-001/NOM-002, las cuatro salidas permanecen idénticas.
- Comando de suites: `node --test --test-concurrency=1 tests/iupac-engine-audit.test.mjs tests/iupac-nom002-cyclic-ketones.test.mjs tests/legacy-english-nomenclature.test.mjs tests/language-audit-regressions.test.mjs tests/nomenclature-conventions.test.mjs tests/chemistry-regressions.test.mjs` — **94 PASS, 0 FAIL, 0 omitidas**.
- `git diff --check` — sin errores (Git mostró solo aviso de normalización LF/CRLF en el informe Markdown).
- `npm run build` no pudo iniciar porque `bash` no está disponible en el PATH de PowerShell. Ejecución directa alternativa `npm exec -- vinext build`: transformó 266 módulos y finalizó la fase de build, pero el plugin `sites` terminó con error `EPERM` al retirar `dist/.openai/drizzle`; por eso no se reporta el build completo como PASS.
- `npm exec tsc -- --noEmit --pretty false` — falla por diagnósticos del proyecto fuera del alcance, incluidos archivos de snapshot bajo `outputs/` y workers. Filtrar la salida por `app/nomenclature-conventions.ts` y la prueba NOM-002 no encontró diagnósticos en el código modificado.

Archivos de este seguimiento: `app/nomenclature-conventions.ts`, `tests/iupac-engine-audit.test.mjs`, `tests/iupac-nom002-cyclic-ketones.test.mjs`, `tests/fixtures/iupac-engine-nom002-cyclic-ketones.json` y este informe. No se tocaron el fixture histórico ni el fixture normativo NOM-001. No se creó commit ni se hizo push.

## Seguimiento — corrección NOM-003 de selección de cadena (2026-10-13)

### Causa, reglas y solución

Estado de partida: rama `main`, HEAD `4386d2ae164182c48ee45b86433196ab29d26412`, árbol limpio. El selector común enumeraba caminos acíclicos en `analyzeHydrocarbonMolecule` y `analyzeFunctionalAcyclic`, numeraba cada marco y los comparaba mediante `compareParentCandidates`. Ese comparador heredado ordena grupo principal, cantidad de enlaces múltiples y longitud; por eso en 2013 los casos 19–20 preferían la cadena de seis carbonos que incorpora la insaturación.

La jerarquía 2013 separa la selección del padre de la selección del PIN. [P-44 del Blue Book 2013](https://iupac.qmul.ac.uk/BlueBook/P4.html) compara cadenas acíclicas primero por heteroátomos y luego por átomos del esqueleto; P-44.3.2 explicita que la longitud precede a la insaturación y contrasta octano frente a hept-1-eno. Si esa etapa no decide, P-44.4.1 compara primero el número de enlaces múltiples y después el de dobles enlaces. Solo una vez seleccionado el padre sénior, P-45.2 decide entre nombres por número y localizadores de sustituyentes. Para 1979, [A-3.4 de IUPAC 1979](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm) conserva la prioridad del máximo número de enlaces dobles y triples y después, entre cadenas empatadas en insaturación, el mayor número de carbonos.

Se parametrizó el comparador interno de candidatos: `analyzeMolecule` usa por defecto el orden 2013 y permite calcular una segunda `Analysis` con el orden 1979 para los dos nombres Legacy. El comparador 1979 compartido y sus pruebas permanecen intactos. En los casos 19–20, la cadena saturada de siete carbonos gana en 2013 y la insaturación del fragmento lateral se nombra estructuralmente como etenil/etinil; el análisis Legacy conserva la cadena insaturada de seis carbonos. La traducción inglesa tiene reglas léxicas para esas formas. La representación estructural y el grafo no se reescriben.

Las explicaciones 2013 ahora detectan una insaturación que está dentro de un sustituyente y dicen que queda fuera de la cadena principal saturada. La visualización, numeración, localizadores y nombre sugerido 2013 siguen consumiendo el mismo `Analysis` 2013. Se mantuvo la forma heredada `vinil` en análisis no afectados, como vinilciclohexano; el prefijo sistemático etenil se usa en la cadena acíclica para la selección 2013.

### Resultados 19 y 20

La tabla anterior se conserva en el fixture observado original. En ambos, el texto español es la localización sistemática usada por el producto; la referencia Blue Book se publica en inglés. [P-32.3 del Blue Book](https://iupac.qmul.ac.uk/BlueBook/P3.html) prefiere el prefijo sistemático `ethenyl` frente al retenido `vinyl`; P-32.1 describe la formación de prefijos a partir de padres insaturados. Para la traducción española se emplea `etenil`/`etinil`, formas de nomenclatura sistemática en español, no traducciones por reemplazo del nombre completo.

| Caso | Perfil | Antes | Después | Padre/localizadores posteriores |
|---|---|---|---|---|
| 19 | 2013 EN | `3-propylhex-1-ene` | `4-ethenylheptane` | heptano, 7 C; doble enlace en sustituyente etenilo unido a C4 |
| 19 | 2013 ES | `3-propilhex-1-eno` | `4-etenilheptano` | heptano, 7 C; doble enlace en sustituyente etenilo unido a C4 |
| 19 | 1979 EN | `3-propyl-1-hexene` | `3-propyl-1-hexene` | 6 C; doble enlace del padre en C1 |
| 19 | 1979 ES | `3-propil-1-hexeno` | `3-propil-1-hexeno` | 6 C; doble enlace del padre en C1 |
| 20 | 2013 EN | `3-propylhex-1-yne` | `4-ethynylheptane` | heptano, 7 C; triple enlace en sustituyente etinilo unido a C4 |
| 20 | 2013 ES | `3-propilhex-1-ino` | `4-etinilheptano` | heptano, 7 C; triple enlace en sustituyente etinilo unido a C4 |
| 20 | 1979 EN | `3-propyl-1-hexyne` | `3-propyl-1-hexyne` | 6 C; triple enlace del padre en C1 |
| 20 | 1979 ES | `3-propil-1-hexino` | `3-propil-1-hexino` | 6 C; triple enlace del padre en C1 |

### Pruebas y alcance de regresión

`tests/fixtures/iupac-engine-audit-observed.json` permanece sin cambios como evidencia previa. `tests/fixtures/iupac-engine-audit-nom003-conforming.json` añade las salidas normativas y su base normativa. La auditoría de 84 salidas compara el estado histórico excepto las celdas que NOM-001/NOM-002 ya separaban y las cuatro salidas 2013 cambiadas de los casos NOM-003; exige que los cuatro resultados Legacy de los dos casos sigan iguales.

La batería nueva de selección fija 13 estructuras: competencia de distinta longitud con alqueno y alquino, incluidos sustituyentes etenilo/etinilo de dos carbonos y prop-2-en-1-il/prop-2-in-1-il de tres carbonos; cadenas alternativas de igual longitud máxima; dos brazos con la misma longitud máxima con y sin insaturación; y alcohol, aldehído, cetona y ácido con insaturación. Comprueba nombres ES/EN desde el mismo análisis, longitud/localizadores del padre, selección Legacy independiente, inclusión de la función principal en el padre y estabilidad SMILES antes/después. Para los dos casos de la auditoría que dejan insaturación fuera del padre, las explicaciones española e inglesa describen el etenilo/etinilo en C4 y el padre saturado. Los prefijos de tres carbonos llevan localizadores tanto de insaturación como de valencia libre, como requiere P-32.1.

- `node --test --test-concurrency=1 tests/iupac-engine-audit.test.mjs tests/iupac-nom003-parent-selection.test.mjs tests/iupac-nom002-cyclic-ketones.test.mjs tests/legacy-english-nomenclature.test.mjs tests/nomenclature-conventions.test.mjs tests/language-audit-regressions.test.mjs tests/chemistry-regressions.test.mjs tests/name-builder.test.mjs tests/functional-nomenclature.test.mjs tests/halogen-nomenclature.test.mjs tests/reasoning-name-fragments.test.mjs tests/chemistry-document-validation.test.mjs` — **48 PASS, 0 FAIL, 0 omitidas**.
- `node --test --test-concurrency=1 tests/practice-session.test.mjs tests/exam-session.test.mjs tests/practice-structural-answer.test.mjs` — **47 PASS, 0 FAIL, 0 omitidas**.
- `npm run build` no inicia porque `bash` no está disponible en PowerShell. `npm exec -- vinext build` transformó 266 módulos y reportó `built in 11.34s`, pero el hook `sites` falló al final con `EPERM` al retirar `dist/.openai/drizzle`; el build completo no es PASS.
- `npm exec tsc -- --noEmit --pretty false` falla en diagnósticos preexistentes del proyecto (incluye validación de documentos, layout, snapshots de `outputs/` y algunos puntos existentes de `app/page.tsx`). El filtrado de las tres fuentes tocadas encontró solo errores previos en `app/page.tsx` (conversión OpenChemLib, tipos de razonamiento/layout) y en `app/iupac-name-normalization.ts` (grupos de captura nombrados y target); no reportó errores en las nuevas funciones de selección, prefijos insaturados o formato Legacy.
- Una ejecución de `node --test --test-concurrency=1 tests/*.test.mjs` y una de `npm run test:critical` se interrumpieron manualmente tras largos tramos sin salida nueva; sus resultados parciales no se cuentan como PASS. Las pruebas dedicadas de nomenclatura, química, Practice y Exam anteriores sí concluyeron con los totales informados.
- `git diff --check` terminó sin errores; Git advierte que normalizará LF a CRLF en el test modificado.

Archivos de NOM-003: `app/page.tsx`, `app/iupac-name-normalization.ts`, `app/legacy-english-nomenclature.ts`, `tests/iupac-engine-audit.test.mjs`, `tests/iupac-nom003-parent-selection.test.mjs`, `tests/fixtures/iupac-engine-audit-nom003-conforming.json` y este informe. NOM-001 y NOM-002 no recibieron cambios de implementación; sus comprobaciones en la suite dedicada siguen PASS. NOM-004 no se abordó ni modificó. No se hizo commit ni push.

## Seguimiento — NOM-004: integración pedagógica de perfiles y segmentos (2026-10-13; revisión manual 2026-10-15)

### A. Causas raíz

La vista ya calculaba un análisis moderno y otro Legacy y usaba el resultado del perfil elegido para mostrar el nombre. Sin embargo, `Home` construía «Cómo se obtiene» con `analysis` (2013) en ambos perfiles. Por eso las explicaciones podían describir el padre moderno aunque el nombre visible proviniera de 1979. Los segmentos se derivaban por separado en `reasoning-name-fragments.ts`; sus reglas morfológicas no reconocían el tramo español Legacy `3-buten` dentro de `3-buten-2-ol`. En los casos NOM-003, tampoco se describía consistentemente el padre de siete carbonos de 2013 frente al padre Legacy de seis carbonos.

### B. Arquitectura revisada (A–K)

- **A–C. Identidad, perfil e idioma:** `Home` conserva el mismo objeto `molecule`, `activeNomenclatureConvention` determina qué análisis alimenta el panel y `language` elige la versión localizada. El nombre visible y las variantes disponibles provienen de los formateadores ya existentes.
- **D–E. Padre y localizadores:** `analyzeMolecule` entrega `mainChain`, `numberedAtoms`, enlaces múltiples, grupos funcionales y sustituyentes del grafo. NOM-004 no introduce otro selector químico.
- **F–H. Texto, segmentos y destinos:** `buildIupacReasoningSteps` crea los pasos, `buildEnglishReasoningSteps` localiza el texto y `deriveReasoningNameFragments` asocia spans literales con evidencia del análisis. `buildReasoningNameLinkParts` exige que la unión de los segmentos reproduzca el nombre mostrado y los enlaces nativos llevan al paso relacionado.
- **I. Cambios de perfil/idioma:** ahora los pasos y fragmentos se vuelven a calcular con el perfil, idioma, nombre y análisis activos; el estado de referencia también está condicionado por esa clave.
- **J. Evidencia ausente:** el segmentador conserva texto sin enlace si no acredita un tramo. No se crean enlaces hacia pasos inexistentes; los enlaces renderizados son anclas accesibles con teclado y pueden activarse con Enter.
- **K. Fases previas:** NOM-001/002/003 corrigieron nomenclatura y selección de padre; no originaron el desacuerdo pedagógico. Sus salidas nuevas hicieron visible que la vista seguía usando análisis 2013 para explicar resultados Legacy y cadenas 2013 recién seleccionadas.

### C. Cambios realizados

- `app/page.tsx`: se pasa el análisis del perfil activo y su nombre visible a las funciones de explicación. Se añadieron textos estructurales acotados al perfil Legacy para padre, numeración, sustituyentes e insaturación; los pasos 2013 mantienen su ruta existente. No se modifican generadores de nombres ni selectores de padre.
- `app/reasoning-name-fragments.ts`: reconocimiento de formas Legacy respaldadas por el análisis para `3-buten-2-ol`, padres cíclicos insaturados y formas españolas enino; evidencia de sustituyentes insaturados en 2013 NOM-003; sufijo completo `carbaldehído/carbaldehyde` para anillos.
- `tests/reasoning-nom004-profile.test.mjs`: nuevas comprobaciones de perfiles, segmentos, explicaciones, enlaces y persistencia del grafo.
- Este informe conserva el registro de los archivos. El fixture observado histórico no se modificó.

### D. NOM-001

Los ocho casos (`01`, `02`, `05`, `06`, `11`, `12`, `15`, `17`) conservan los nombres de sus fixtures conformes en los cuatro perfiles. Los ocho se verifican con fragmentos concatenables y justificaciones existentes. Caso 12: el nombre Legacy español antes y después es `3-buten-2-ol`; antes el tramo `3-buten` no tenía asociación de insaturación coherente y el panel podía explicar la escritura moderna `but-3-en-2-ol`; después `3` y `en` apuntan al paso 07 y explican C3=C4/localizador 3, `but` apunta al padre del paso 02 y `2-ol` a la función del paso 01. También se verifica padre de cuatro carbonos.

### E. NOM-002

Las siete cetonas cíclicas conservan los nombres Legacy EN/ES. La explicación se construye desde `family`, átomos del padre, localizador del carbonilo, insaturación y sustituyentes del análisis. La batería comprueba anillo de cinco/seis/siete carbonos, carbonilo C1, locantes 2/3 y, para la forma sustituida, metilo en C4. No se usa la grafía «ciclo» como prueba estructural ni se modifica la lógica química.

### F. NOM-003

Para los casos 19 y 20, 2013 conserva padre de siete carbonos y explica etenilo/etinilo en C4 con insaturación fuera del padre; 1979 conserva padre de seis carbonos, insaturación del padre en C1 y propilo en C3. La prueba cubre inglés y español en ambas convenciones. El texto de padre 2013 sigue la explicación de cadena continua larga existente; Legacy identifica de forma explícita que se usan los resultados de su propio análisis.

### G. Interactividad y accesibilidad

La prueba de integración verifica que los spans se concatenen exactamente en el nombre y que cada enlace apunte a un paso existente. En el navegador local se cargó `CC(O)C=C`, se seleccionó español/1979 y se observó `3-buten-2-ol`; la activación del segmento `3-buten` con ratón y con Enter llevó al paso 07 (scrollY 1422), cuya explicación identifica el enlace C3=C4. Las pruebas existentes cubren retardo de hover, cancelación al salir, clic/tap, desplazamiento y movimiento reducido; los controles son enlaces nativos con nombres accesibles y foco visible existente.

### H. Integridad química

Las pruebas comparan SMILES de la misma molécula antes y después de construir explicaciones y al alternar perfiles/idiomas. No cambiaron nombres generados, selección de cadena, prioridad, valencias, conectividad ni serialización. Los nombres visibles permanecen idénticos a los fixtures normativos de NOM-001/002/003.

### I. Verificaciones

- `node --test --test-concurrency=1 tests/reasoning-nom004-profile.test.mjs tests/reasoning-name-fragments.test.mjs tests/reasoning-name-navigation.test.mjs tests/reasoning-hierarchy.test.mjs tests/reasoning-parent-provenance.test.mjs tests/iupac-engine-audit.test.mjs tests/iupac-nom002-cyclic-ketones.test.mjs tests/iupac-nom003-parent-selection.test.mjs` — **60 PASS, 0 FAIL, 0 omitidas**, incluida la auditoría de 84 salidas y las pruebas de interacción simulada. Tras corregir las claves de renderizado, se repitió `node --test tests/reasoning-nom004-profile.test.mjs`: **6 PASS, 0 FAIL**, con comprobación nueva de claves únicas en los elementos renderizados de toda su matriz.
- Navegación real local: segmento Legacy español activado por clic y Enter — **PASS**.
- `npx eslint app/page.tsx app/reasoning-name-fragments.ts app/reasoning-functional-groups.ts tests/reasoning-nom004-profile.test.mjs` — **0 errores, 6 warnings** existentes en otras zonas de `app/page.tsx` (hooks, variables no usadas e `<img>`), en la ejecución concluida anterior al ajuste final de claves React. Una repetición final no produjo salida y se interrumpió: no se cuenta como otra aprobación.
- `npx tsc --noEmit --pretty false` — **FAIL del proyecto por diagnósticos preexistentes**. El filtrado de rutas modificadas no reportó errores en `app/reasoning-name-fragments.ts`; `app/page.tsx` mantiene diagnósticos en puntos anteriores/no relacionados (interoperabilidad OpenChemLib, tipos de razonamiento aromático/layout, `never` y evidencias semánticas), también presentes en el snapshot baseline bajo `outputs/`.
- Build: `npm run build` no puede iniciar en PowerShell porque el script requiere `bash`. `npm exec -- vinext build` transforma la app, pero termina con `EPERM` en el hook `sites` al retirar `dist/.openai/drizzle`; no se contabiliza como build aprobado.
- `git diff --check` — **PASS**.
- `npm run test:critical` — ejecución interrumpida, sin veredicto final; sus resultados parciales no se cuentan. La comprobación terminada `node --test --test-concurrency=1 tests/practice-session.test.mjs tests/exam-session.test.mjs tests/practice-structural-answer.test.mjs` dio **47 PASS, 0 FAIL, 0 omitidas**.

### J. Riesgos y límites

La traducción Legacy inglesa existente no se amplía como motor general: las asociaciones de forma Legacy solo se crean cuando el nombre exacto y los datos del análisis las respaldan. El proyecto conserva errores TypeScript y bloqueo del build ya mencionados; por ello no se declara compilación completa. NOM-002B (cetonas cíclicas con múltiples dobles enlaces) sigue expresamente fuera de alcance. Las pruebas no sustituyen una revisión normativa independiente de cada morfología histórica.

### K. Git y alcance

Estado al cerrar: rama `main`, HEAD `a712d172f4ee7602f40a9dd5311f576553f0203f`; cambios locales únicamente en `app/page.tsx`, `app/reasoning-name-fragments.ts`, `app/reasoning-functional-groups.ts`, este informe y el nuevo `tests/reasoning-nom004-profile.test.mjs`. No se hizo commit ni push. NOM-002 y NOM-003 no recibieron cambios de implementación durante NOM-004.

### Adenda: hallazgos manuales, causas adicionales y correcciones

1. El paso de insaturación solo admitía familia `acyclic`: las cicloalquenonas carecían de destino 07. Ahora admite también `cycloalkane` con evidencia de enlaces múltiples del padre. La raíz cíclica se explica por separado como `ciclohex`, seis carbonos, en el paso 02.
2. `selectedParentNumberingReasoning` compara las dos orientaciones del padre ya seleccionado. Con el carbonilo anclado en C1, explica localizadores de doble enlace 2 frente a 5. No enumera ni selecciona padres nuevos. Compara función principal, insaturación y sustituyentes; conserva las rutas existentes fuera de las familias respaldadas.
3. `functionalContributionReasoning` recibía siempre el nombre moderno. Su parámetro opcional `displayedName` permite explicar el sufijo realmente escrito: `ona`/`one` Legacy con C1 implícito, sin insertar `1-ona`/`1-one` en esa grafía.
4. Dos spans escritos del mismo enlace compartían `semanticId` y se renderizaban con la misma clave React. La prueba dinámica detectó filas antiguas al cambiar de molécula. `ReasoningNameFragmentView` usa ahora identidad de tramo (identidad química, posición y texto) para la clave; mantiene la asociación química compartida. Una prueba exige claves únicas entre hermanos.

El criterio histórico de cadena insaturada se explica únicamente para hidrocarburos sin función principal, conforme a [A-3.4](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm). La prioridad de la función al numerar sigue [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm); la orientación del anillo insaturado se apoya en [A-11.3](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm). Estas referencias fundamentan el texto pedagógico; no se alteraron las reglas del motor.

#### Comparación de los cuatro perfiles: nombres idénticos antes y después de NOM-004

| SMILES | 2013 ES | 1979 ES | 2013 EN | 1979 EN |
|---|---|---|---|---|
| `CC(O)C=C` | `but-3-en-2-ol` | `3-buten-2-ol` | `but-3-en-2-ol` | `3-buten-2-ol` |
| `O=C1C=CCCC1` | `ciclohex-2-en-1-ona` | `2-ciclohexenona` | `cyclohex-2-en-1-one` | `2-cyclohexenone` |
| `O=C1C=CC(C)CC1` | `4-metilciclohex-2-en-1-ona` | `4-metil-2-ciclohexenona` | `4-methylcyclohex-2-en-1-one` | `4-methyl-2-cyclohexenone` |
| `C=CC(CCC)CCC` | `4-etenilheptano` | `3-propil-1-hexeno` | `4-ethenylheptane` | `3-propyl-1-hexene` |
| `C#CC(CCC)CCC` | `4-etinilheptano` | `3-propil-1-hexino` | `4-ethynylheptane` | `3-propyl-1-hexyne` |

#### Contenido explicado y destinos comprobados

| Estructura | Contenido posterior, en ambos idiomas | Antes → después en la presentación |
|---|---|---|
| Alcohol | Padre de cuatro C; OH en C2; doble C3=C4, localizador 3. La grafía Legacy antepone 3 a `buten`; la moderna escribe `but-3-en`. | Padre y enlace confundidos en un tramo → `but` llega a 02; `3`/`en` a 07; `2-ol` a 01. |
| Ciclohexenona | Anillo de seis C; carbonilo C1; doble C2=C3; al invertir orientación sería 5, por eso se elige 2. Escritura moderna `-2-en-` y Legacy `2-…en…ona`. | Sin paso 07 cíclico/raíz independiente → `ciclohex` llega a 02, insaturación a 07 y sufijo a 01. |
| Metilciclohexenona | Mismo anillo, carbonilo y orientación; metilo en C4. Legacy omite el 1 del carbonilo en el nombre mostrado, pero lo explica. | Texto genérico y sufijo moderno infiltrado → raíz, metilo, enlace y sufijo tienen explicación propia conforme al nombre activo. |
| Hidrocarburo con doble enlace | 2013: padre saturado de siete C, etenilo C4 y doble fuera del padre. Legacy: padre de seis C que incorpora C1=C2, propilo C3; máxima insaturación antes de longitud. | Análisis 2013 usado para explicar Legacy → cada perfil explica su padre ya seleccionado y su criterio. |
| Análogo triple | 2013: siete C y etinilo C4; Legacy: seis C, triple C1≡C2 y propilo C3. | Igual desacuerdo entre perfiles → explicación independiente del triple enlace y del padre correcto. |

En nombres modernos NOM-003, el prefijo insaturado conserva el enlace principal al paso 04 y evidencia relacionada del paso 07; este último explica expresamente que la insaturación está fuera del padre. En Legacy, el localizador y morfema de insaturación del padre enlazan directamente al 07. Ningún enlace se asigna por SMILES o identificador de caso.

#### Verificación real y límites de cierre

En el navegador se activaron con clic y Enter los enlaces de raíz e insaturación de las cinco estructuras en español, en 2013 y 1979, comprobando texto de destino y foco visible. Después de la corrección React se alternaron anillo, alcohol y cadenas insaturadas: no quedaron filas del anillo ni nombres anteriores. Se comprobó ES→EN→ES, las vistas Esquelética/Condensada/Semidesarrollada y los temas Auto/Claro/Oscuro conservando el nombre y la navegación. No se comprobó un dispositivo móvil físico ni una matriz de tamaños de pantalla.

Evidencia visual: `C:/Users/Alex_/.codex/visualizations/2026/10/13/01a133de-c877-7332-b67a-c546065972e1/nom004-legacy-navigation.png`.

La repetición final de `npm exec -- vinext build` transformó 266 módulos y reportó `built in 2.80s`; volvió a fallar al cerrar con `EPERM` en `sites`, ruta `dist/.openai/drizzle`. Se conserva como **FAIL/bloqueo del entorno**, no como PASS. TypeScript global también conserva los fallos descritos. Durante el navegador las API locales de historial/guardado devolvieron 500; la persistencia remota no forma parte de esta validación y no se modificó. Las comprobaciones de nomenclatura, navegación y Practice/Exam terminadas sí están aprobadas; no se declara una compilación general aprobada.
