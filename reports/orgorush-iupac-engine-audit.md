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
