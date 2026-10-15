# OrgoRush — NOM-004B: reparación de explicaciones y segmentos

Fecha: 2026-10-15. Estado inicial: `main`, HEAD `bc6fb03d3d3796354c2015d1f9a6308af1be6a7d`, árbol limpio. No se hizo commit ni push.

## A. Causas confirmadas y estado de partida

El desacuerdo original se debía a que el nombre Legacy procedía de su propio motor mientras «Cómo se obtiene» recibía el análisis 2013. NOM-004 había conectado ya `legacyAnalysis` con las explicaciones y añadido los segmentos históricos; esas reparaciones están presentes en el HEAD inicial de esta fase. No se atribuyen otra vez a NOM-004B.

Persistían estas deficiencias verificadas en código y navegador:

1. La numeración, el resaltado del padre y la proyección del canvas consumían todavía `analysis` 2013: en el alquino Legacy se explicaban seis carbonos, pero se dibujaban siete localizadores.
2. Las pruebas anteriores elegían manualmente el análisis que entregaban a los generadores pedagógicos. Podían pasar aunque la vista conectase el motor equivocado.
3. La numeración Legacy comparaba 1 frente a 5 sin indicar también el propilo en C3. La explicación cíclica no incorporaba el metilo en C4 a la conclusión de numeración ni decía por qué ese sustituyente no altera la decisión 2 frente a 5.
4. El prefijo Legacy `3-propil` dirigía al paso 04 y mencionaba el 03 como relación, pero no permitía abrir directamente la numeración desde el localizador. El esqueleto Legacy carecía de la asociación explícita con los átomos del padre que ya tenía la evidencia moderna.
5. La selección de un enlace interactivo se conservaba por SMILES solamente. El perfil, idioma y nombre no formaban parte de esa identidad.
6. El paso inglés de función de una monocetona cíclica no explicaba expresamente C1 y su omisión en el sufijo histórico.

## B. Conexión arquitectónica

`buildActiveIupacReasoning` recibe los dos resultados reales ya calculados por los motores y la convención activa. Selecciona uno de esos mismos objetos, sin copiarlo, seleccionar otra cadena ni renumerar el grafo. Construye conjuntamente pasos localizados, fragmentos y enlaces usando el nombre mostrado y las variantes generadas disponibles.

`Home` consume ese modelo. Su `activeAnalysis` alimenta también el conjunto de átomos del padre, las etiquetas de numeración, la geometría de presentación, la numeración condensada y los localizadores de los mensajes del editor. Las operaciones químicas de edición, los formateadores y la selección de padre no cambian. La geometría sigue siendo una proyección y no modifica coordenadas persistidas, historial ni grafo.

La referencia del enlace seleccionado utiliza la misma clave de contexto que las explicaciones: idioma, convención, nombre y SMILES. Las claves de React corregidas en NOM-004 se conservan.

## C. Segmentación histórica

La segmentación parte de evidencia estructural y de una salida generada disponible. Conserva las reglas de reconocimiento Legacy anteriores, añade los átomos del padre a la raíz y separa localizadores iniciales de prefijos respaldados por los sustituyentes analizados. No reconoce moléculas por SMILES ni genera o reemplaza nombres.

| Nombre Legacy ES | Segmentos y destinos posteriores |
|---|---|
| `3-buten-2-ol` | `3`/`en` → 07; `but` → 02; `2-ol` → 01 |
| `2-ciclohexenona` | `2`/`en` → 07; `ciclohex` → 02; `ona` → 01 |
| `4-metil-2-ciclohexenona` | `4` → 03; `metil` → 04; `2`/`en` → 07; `ciclohex` → 02; `ona` → 01 |
| `3-propil-1-hexeno` | `3` → 03; `propil` → 04; `1`/`eno` → 07; `hex` → 02 |
| `3-propil-1-hexino` | `3` → 03; `propil` → 04; `1`/`ino` → 07; `hex` → 02 |

El inglés conserva la misma asociación semántica con `cyclohex`, `methyl`, `propyl`, `one`, `ene` y `yne`. Los guiones permanecen en su posición como separadores. Se comprueba reconstrucción exacta del nombre y ausencia de enlaces a pasos inexistentes.

## D. Texto pedagógico y decisiones concretas

Texto real del paso 03 para la ciclohexenona en español, en ambas convenciones:

> El carbono del anillo que porta la función de sufijo es C1. Ambos sentidos conservan esa posición; después se comparan los enlaces múltiples, antes que los sustituyentes. El criterio de enlaces múltiples resuelve la orientación: los localizadores 2 son menores que 5 en el sentido opuesto. El primer punto de diferencia determina el sentido elegido.

La forma con metilo añade:

> Con esta orientación, los sustituyentes son metil en C4. Sus localizadores no modifican la decisión de mayor prioridad.

El padre moderno se explica por separado:

> Se elige el anillo de 6 carbonos que contiene el grupo cetona. El esqueleto cíclico aporta «ciclohex»; los enlaces múltiples y el sufijo funcional se explican por separado.

La insaturación Legacy se explica así:

> El enlace doble C2=C3 pertenece al padre Legacy seleccionado y lleva el localizador 2. La forma 1979 es «2-ciclohexenona». El localizador precede al esqueleto. «en» expresa el enlace doble.

En 2013 se identifica C2=C3 y el componente `-2-en-` dentro de `ciclohex-2-en-1-ona`. El paso de función identifica el carbonilo en C1 y el sufijo `ona`; Legacy indica que el 1 está implícito. El inglés ahora hace explícita la misma relación en el paso funcional: “The carbonyl carbon belongs to the ring and is C1. In this historical monocyclic ketone form, carbonyl locant 1 is implicit in the suffix.”

Para `3-propil-1-hexino`, el modelo Legacy conserva seis átomos en `mainChain`, `tripleBondLocants: [1]`, ningún doble enlace del padre y `propil` en C3. Explica C1≡C2 dentro del padre y compara 1 frente a 5; la conclusión de numeración añade el propilo en C3. Para 2013, el modelo conserva siete átomos, ningún enlace múltiple del padre y etinilo en C4, cuya insaturación queda en el sustituyente. El alqueno recibe el tratamiento equivalente.

Las reglas históricas mencionadas por el texto ya estaban documentadas en la auditoría: [A-3.4](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm), [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm) y [A-11.3](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm). Esta fase no modifica esas reglas en los motores.

## E. Resultados en los cuatro perfiles

Los veinte nombres siguientes son idénticos antes y después de NOM-004B. La diferencia está en la presentación de sus decisiones y su navegación.

| Estructura | 2013 ES | 1979 ES | 2013 EN | 1979 EN |
|---|---|---|---|---|
| `CC(O)C=C` | `but-3-en-2-ol` | `3-buten-2-ol` | `but-3-en-2-ol` | `3-buten-2-ol` |
| `O=C1C=CCCC1` | `ciclohex-2-en-1-ona` | `2-ciclohexenona` | `cyclohex-2-en-1-one` | `2-cyclohexenone` |
| `O=C1C=CC(C)CC1` | `4-metilciclohex-2-en-1-ona` | `4-metil-2-ciclohexenona` | `4-methylcyclohex-2-en-1-one` | `4-methyl-2-cyclohexenone` |
| `C=CC(CCC)CCC` | `4-etenilheptano` | `3-propil-1-hexeno` | `4-ethenylheptane` | `3-propyl-1-hexene` |
| `C#CC(CCC)CCC` | `4-etinilheptano` | `3-propil-1-hexino` | `4-ethynylheptane` | `3-propyl-1-hexyne` |

| Presentación | Antes, en el HEAD inicial | Después |
|---|---|---|
| Alcohol Legacy | Raíz, enlace y OH ya reparados por NOM-004 | Se conservan y se comprueban a través del modelo real de la vista |
| Ciclohexenona | 2 frente a 5 ya explicado; función inglesa poco explícita | Carbonilo C1 y su omisión histórica explícitos también en inglés |
| Metilciclohexenona | Orientación 2 frente a 5 sin conclusión sobre el metilo | Metilo C4 y subordinación de su localizador a la insaturación; acceso directo desde `4` a 03 |
| Alqueno ramificado Legacy | Panel de seis C, canvas numerado con siete; prefijo enlazado íntegramente a 04 | Padre visible y explicación de seis C; `3` abre 03 y `propil` abre 04 |
| Alquino ramificado Legacy | Mismo desacuerdo de siete números frente a seis C | Seis números, triple C1≡C2 en el padre, propilo C3 y explicación coherente |

## F. Interactividad real

Se verificaron 25 estados: cinco estructuras con la secuencia 2013 ES → 1979 ES → 1979 EN → 2013 EN → 2013 ES. Las moléculas se sustituyeron sin recargar la página. En cada estado se activó la raíz con clic y un segmento de enlace múltiple o sustituyente insaturado con Enter. Los 25 mantuvieron foco visible. En los prefijos históricos también se activó el localizador que abre el paso 03.

En los hidrocarburos ramificados, las etiquetas del canvas cambiaron conjuntamente con la convención: 1–7 en 2013 y 1–6 en Legacy, en los dos idiomas. Los textos de pasos y las asociaciones activas corresponden a cada estado, sin conservar filas de las moléculas anteriores. Tras el último ajuste de memoización se volvió a comprobar el alquino Legacy: Enter situó el paso 07 entre y=248 y y=552 en una ventana de 704 px, con foco visible en `ino`.

Evidencia local (archivos generados bajo `outputs/`, ignorados por Git):

- `outputs/nom004b-browser-evidence.json`: nombres, números dibujados, textos de pasos, enlaces y activaciones de los 25 estados.
- `outputs/nom004b-legacy-navigation.png`: página completa con seis localizadores y explicación Legacy.
- `outputs/nom004b-legacy-navigation-viewport.png`: destino de navegación y nombre activo con foco visible.

## G. Regresiones y validación técnica

- Auditoría IUPAC de 84 salidas, ocho estructuras NOM-001, siete cetonas NOM-002 y selección de padre NOM-003: **PASS** en la ejecución relacionada y en el tramo ya concluido de la batería completa. Los fixtures normativos e históricos se conservan.
- Prueba específica del modelo NOM-004/NOM-004B: **7 PASS, 0 FAIL, 0 omitidas**.
- Explicaciones, fragmentos, navegación, procedencia del padre y vista: `node --test --test-concurrency=1 tests/reasoning-nom004-profile.test.mjs tests/reasoning-name-fragments.test.mjs tests/reasoning-hierarchy.test.mjs tests/reasoning-parent-provenance.test.mjs tests/reasoning-name-navigation.test.mjs tests/view-layout-regression.test.mjs` — **78 PASS, 0 FAIL, 0 omitidas**. Registro: `outputs/nom004b-focused-tests.log`.
- Después de añadir la comprobación de las etiquetas reales del canvas (además de su proyección), `node --test tests/view-layout-regression.test.mjs` terminó con **20 PASS, 0 FAIL, 0 omitidas**. Registro: `outputs/nom004b-canvas-test.log`.
- Practice/Exam: `node --test --test-concurrency=1 tests/practice-session.test.mjs tests/exam-session.test.mjs tests/practice-structural-answer.test.mjs` — **47 PASS, 0 FAIL, 0 omitidas**. Registro: `outputs/nom004b-practice-exam.log`.
- La primera ejecución relacionada dio 101 PASS y 1 FAIL por el contexto simulado de vista que aún suministraba `analysis`; se actualizó a `activeAnalysis`. Una comprobación nueva demasiado restrictiva de horizontalidad no era aplicable a toda geometría insaturada; se sustituyó por la comprobación exacta de la proyección del padre activo y de inmutabilidad. La repetición de las dos suites dio **27 PASS, 0 FAIL**. Los fallos intermedios no se cuentan como aprobaciones.
- Batería completa: `node --test --test-concurrency=1 tests/*.test.mjs` terminó en 52 min 9 s con **2584 pruebas: 2566 PASS, 13 FAIL, 5 omitidas, 0 todo, 0 canceladas**. Los 13 fallos eran `ReferenceError: activeAnalysis is not defined` en `tests/skeletal-triple-residual.test.mjs`: esa suite extrae las expresiones reales del canvas y su contexto simulado todavía suministraba `analysis`. Se actualizaron únicamente los tres nombres de ese contexto a `activeAnalysis`, conservando el mapa de localizadores y todas las expectativas geométricas. Registro íntegro: `outputs/nom004b-full-tests.log`.
- Repetición de la suite esquelética después de corregir su contexto: **13 PASS, 0 FAIL, 0 omitidas**. La comprobación final conjunta `node --test --test-concurrency=1 tests/skeletal-triple-residual.test.mjs tests/view-layout-regression.test.mjs tests/reasoning-nom004-profile.test.mjs` dio **40 PASS, 0 FAIL, 0 omitidas**. Registro: `outputs/nom004b-final-integration-tests.log`. El código de producción no cambió después de la ejecución completa. Esta repetición valida todos los fallos detectados y las integraciones afectadas; no se presenta como una segunda ejecución completa de las 2584 pruebas. Las cinco omisiones globales ya existían; esta fase no añade `skip` ni `todo`.
- `npm test` — **BLOQUEADO**, termina antes de ejecutar pruebas porque `bash` no está en el PATH de PowerShell.
- `npm run build:pages` y `npm run validate:pages` — **PASS**; 139 módulos y artefacto de tres entradas. El build avisa sobre tamaño de chunks e importación dinámica ineficaz; no son errores de compilación.
- TypeScript global — **FAIL preexistente**. Las nueve ubicaciones de `app/page.tsx` mantienen los diagnósticos documentados de OpenChemLib, razonamiento aromático, límites visuales, `never` y tipos semánticos opcionales. No hay diagnósticos en el nuevo modelo, transporte del padre, segmentador o pruebas. Registro: `outputs/nom004b-typescript.log`.
- ESLint — **0 errores, 6 avisos previos**. Se detectaron dos errores nuevos de memoización sobre el análisis activo; se retiró esa memoización innecesaria y la repetición terminó con código 0. Registro: `outputs/nom004b-eslint.log`. La comprobación final de los tres tests modificados terminó también con código 0, sin avisos.
- `git diff --check` — **PASS** (Git solo advierte sobre normalización LF/CRLF en el test modificado).

## H. Integridad química

No se modifican `analyzeMolecule`, comparadores químicos, formateadores de nomenclatura, prioridades, normalización de nombres, SMILES, valencias ni fixtures. Los dos motores entregan los mismos nombres y selecciones. La prueba nueva compara los objetos completos de análisis antes y después de construir los modelos, los átomos y localizadores de enlaces, sustituyentes, concatenación de segmentos y serialización SMILES. La prueba de vista conserva grafo, metadatos estereoquímicos e historial al alternar representaciones y padres de 2013/1979. NOM-001, NOM-002 y NOM-003 no reciben cambios de algoritmo. Practice/Exam no recibe cambios de código.

## I. Límites

NOM-002B sigue expresamente fuera de alcance. No se declara TypeScript global ni `npm test` aprobados. La batería completa inicial tuvo los 13 fallos del contexto de prueba descritos arriba; todos pasan tras la reparación de ese contexto, y la integración final también pasa. Los problemas previos de `bash`/build general no se confunden con el build de GitHub Pages, que sí concluyó. Las pruebas de navegador cubren la matriz indicada; no equivalen a certificar toda la nomenclatura histórica o todos los dispositivos. La documentación histórica y los fixtures observados de la auditoría permanecen intactos.

## J. Archivos y Git

- `app/page.tsx`: modelo activo compartido, transporte de padre/localizadores a la presentación, conclusión de numeración y función cíclica inglesa, selección de enlace por contexto.
- `app/reasoning-name-fragments.ts`: átomos del padre Legacy y separación semántica de localizadores de prefijos históricos.
- `tests/reasoning-nom004-profile.test.mjs`: prueba de integración del modelo con los dos motores reales, cinco estructuras, secuencia de idiomas/perfiles, datos químicos y enlaces.
- `tests/view-layout-regression.test.mjs`: integración de proyección con el análisis activo y alternancia de padres de seis/siete C, conservando molécula e historial.
- `tests/skeletal-triple-residual.test.mjs`: contexto de prueba alineado con el análisis activo del canvas, conservando todas las expectativas de segmentos, extremos y radios de obstáculos.
- Este informe. No se modificaron configuraciones, dependencias, licencias ni marca. Sin commit ni push.

Estado final: misma rama y HEAD iniciales, seis archivos locales modificados/añadidos (dos fuentes, tres tests y este informe). Diff de los cinco archivos ya versionados: **191 inserciones y 44 eliminaciones**; se añade este informe técnico. El informe de auditoría original y sus fixtures permanecen sin cambios.
