# Fase 7 — derivación FULL de purinas y xantinas

## Resultado químico

Los cinco casos prioritarios se reconcilian FULL mediante una gramática del padre purina, reconstrucción de enlaces/valencias e isomorfismo completo. Los nombres comunes no forman parte de la gramática ni activan una lista de excepciones. Se conservan las cadenas simétricas de fase 6 y la gramática aromática/acíclica anterior.

PubChem se consultó nuevamente para obtener los nombres, SMILES y fórmulas: [purine-reference-live.json](purine-reference-live.json). Las respuestas de OPSIN y sus grafos CML numerados constituyen un segundo control independiente: [purine-opsin-audit.json](purine-opsin-audit.json) y [purine-hydrogenation-controls.json](purine-hydrogenation-controls.json). La medición reproducible del motor está en [purine-derivation-coverage.json](purine-derivation-coverage.json), generada por `node scripts/audit-purine-derivation.mjs`.

| Entrada | Nombre sistemático recibido de PubChem | Fórmula | Estado | Padre y localizadores verificados | N–H en el grafo real |
|---|---|---|---|---|---|
| [Purina, CID 1044](https://pubchem.ncbi.nlm.nih.gov/compound/1044) | `7H-purine` | C5H4N4 | FULL | Purina 1–9; N1, N3, N7, N9; fusión C4–C5 | N7, especificado por 7H |
| [Xantina, CID 1188](https://pubchem.ncbi.nlm.nih.gov/compound/1188) | `3,7-dihydropurine-2,6-dione` | C5H4N4O2 | FULL | Mismo padre; oxo C2/C6; hidro N3/N7 | N1, N3, N7; N1–H se determina por valencia |
| [Cafeína, CID 2519](https://pubchem.ncbi.nlm.nih.gov/compound/2519) | `1,3,7-trimethylpurine-2,6-dione` | C8H10N4O2 | FULL | Mismo padre; metilos N1/N3/N7; oxo C2/C6 | Ninguno; cada N metilado carece de N–H |
| [Teobromina, CID 5429](https://pubchem.ncbi.nlm.nih.gov/compound/5429) | `3,7-dimethylpurine-2,6-dione` | C7H8N4O2 | FULL | Mismo padre; metilos N3/N7; oxo C2/C6 | N1 implícito, determinado por valencia |
| [Teofilina, CID 2153](https://pubchem.ncbi.nlm.nih.gov/compound/2153) | `1,3-dimethyl-7H-purine-2,6-dione` | C7H8N4O2 | FULL | Mismo padre; metilos N1/N3; oxo C2/C6; H indicado N7 | N7, especificado por 7H |

Estructuras realmente construidas en el recorrido live (OPSIN), contrastadas por grafo completo con las referencias de PubChem:

| Entrada | SMILES utilizado en Build by Name |
|---|---|
| Purina | `N1=CN=C2N=CNC2=C1` |
| Xantina | `N1C(=O)NC=2N=CNC2C1=O` |
| Cafeína | `N1(C)C(=O)N(C)C=2N=CN(C)C2C1=O` |
| Teobromina | `N1C(=O)N(C)C=2N=CN(C)C2C1=O` |
| Teofilina | `N1(C)C(=O)N(C)C=2N=CNC2C1=O` |

Las cinco respuestas PubChem y las cinco resoluciones OPSIN se registran en el JSON de red del E2E live. El nombre mostrado se exige literalmente; la prueba no sustituye el nombre recibido por una alternativa elegida para conseguir FULL. Los IDs de estas estructuras difieren de los SMILES de referencia y la correspondencia se verifica antes de comparar los blancos visuales.

## Reglas generales y arquitectura

La [sección P-25.3.3 del Blue Book](https://iupac.qmul.ac.uk/BlueBook/P2.html#P-25.3.3) conserva la numeración tradicional de la purina como excepción a la numeración general de sistemas fusionados. La lista de padres retenidos, P-25.2.1, identifica el isómero 7H. Los hidrógenos indicados y los prefijos hidro se interpretan dentro del alcance de [P-14.7](https://iupac.qmul.ac.uk/BlueBook/P1.html#P-14.7), [P-25.7](https://iupac.qmul.ac.uk/BlueBook/P2.html#P-25.7) y [P-58.2](https://iupac.qmul.ac.uk/BlueBook/P5.html#P-58.2).

`purine-derivation.ts` representa el padre mediante dos circuitos conectados: 1–2–3–4–5–6–1 y 4–5–7–8–9–4. Son nueve posiciones, diez enlaces anulares, cuatro N en 1/3/7/9 y dos carbonos de fusión 4/5. Un mapeo constitucional único asigna esas posiciones al sistema anular del grafo; no utiliza coordenadas, IDs mínimos, orden SMILES ni metadatos de anillo del editor. La validación química completa se realiza después: reconocer la constitución por sí sola no concede FULL.

La gramática consume el nombre completo y conserva los intervalos literales de:

- Metilación en posiciones no fusionadas, con mono sin prefijo multiplicativo y di/tri/tetramethyl con conteos y localizadores ordenados sin repeticiones.
- Prefijos di/tetrahydro en los N soportados, combinados con los grupos oxo.
- Uno o más hidrógenos indicados con localizadores N y símbolo H.
- Padre `purine`, o `purin` por elisión ante `one`.
- Uno, dos o tres grupos oxo en las posiciones carbonadas periféricas 2, 6 y 8, con `one`, `dione` o `trione` y conteos exactos.

Se enumeran como máximo 1024 colocaciones de dobles enlaces en las diez aristas del padre. Se exige neutralidad, valencias permitidas, dobles enlaces no acumulados, carbonilos y sitios de H/sustitución coherentes. Se conserva el máximo número de dobles enlaces no acumulados compatible con esas condiciones. La selección de estructura ocurre **sin consultar el grafo real**. Si las soluciones máximas tienen diferentes poblaciones de H por posición o enlaces no equivalentes, la producción se rechaza; no se escoge el tautómero que casualmente coincida con el editor.

Varias formas de Kekulé se aceptan únicamente cuando el mapeador histórico prueba su equivalencia conservando cada localizador del padre. OpenChemLib normaliza aristas aromáticas, mientras las etiquetas del mapeo conservan elemento, carga, H implícitos, grado y estereoquímica soportada. No se desplazan H entre N, no se identifica automáticamente lactama con lactima y no se utiliza la fórmula como prueba de identidad. Se mantienen los límites históricos de 120 átomos, 20 000 visitas y 256 correspondencias; el reconocedor constitucional también exige unicidad y limita sus visitas.

El parser se conecta a `systematic-family-grammar.ts` y al reconciliador existente. Este último reconstruye todos los átomos, exige cobertura por componentes y realiza el mismo isomorfismo completo con imágenes invariantes de regiones/localizadores que utilizaban los casos FULL anteriores. La caché conserva su firma de átomos/enlaces para invalidar pruebas tras ediciones.

## Hidrógenos, sustitución y tautomería

En xantina se verifican N3–H y N7–H indicados por `3,7-dihydro`, y N1–H implícito: N1 tiene dos enlaces anulares simples, está entre los carbonilos C2 y C6 y completa valencia neutra tres con un H. En teobromina se aplica el mismo control a N1. En cafeína N1, N3 y N7 tienen cada uno dos enlaces anulares simples y un enlace al metilo; no se les añade H.

Un H indicado describe el sitio del padre antes de sustitución. Si un metilo ocupa ese mismo sitio, el H del padre ha sido reemplazado: no se exige simultáneamente N–H y N–CH3. El control independiente `1,3,7-trimethyl-7H-purine-2,6-dione` confirma esa situación. Los prefijos hidro tampoco se usan como un contador del H total de la molécula: deben leerse junto con hidrógeno indicado, sustitución y sufijos. Se contrastaron cuatro combinaciones adicionales con OPSIN, incluida una tetrahydro/trione y una trimethyl/dihydro; todas conservaron el grafo y sus H reales.

`purine-2,6-dione` sin el prefijo hidro no se sustituye por xantina: la reconstrucción del nombre sin hidro coincide con el grafo más insaturado publicado por OPSIN, no con la xantina C5H4N4O2. Las formas 7H y 9H de purina y de la diona se distinguen por sus H en N y sus enlaces. El candidato enólico de xantina permanece diferente del grafo dioxo. La protonación, cargas nuevas, isótopos no representables o estereoquímica fuera del alcance no se omiten para lograr FULL.

## Explicación y highlighting

Todos los componentes usan `NameComponent` y `validatedNameTargets`; no se añade otro motor de colores. Los blancos compartidos incluyen padre completo, cuatro nitrógenos, dos átomos de fusión y su enlace, metilos y enlaces de unión, C=O, sitios hidro e H indicado. Cada componente conserva pares átomo/localizador y sus enlaces reales.

La explicación distingue el significado de di/tri/tetra, los metilos en N concretos, dione/trione y los H implícitos o reemplazados. El padre utiliza nueve átomos del mismo sistema fusionado. La leyenda lo denomina «Sistema purínico». La prioridad de colores funcionales y el halo de selección existentes se conservan donde las regiones se superponen.

La numeración es contextual en la explicación: al seleccionar el padre aparecen las nueve posiciones; al seleccionar metilos, carbonilos, N o fusión aparecen sus localizadores. Se suprimen los números permanentes del análisis local para estos modelos. La vista esquelética utiliza las mismas regiones y pares átomo/localizador que la semidesarrollada. La frontera previa que deshabilita la vista condensada para sistemas cíclicos permanece vigente.

## Generalización y controles

Además de las cinco prioridades, ocho referencias PubChem alcanzan FULL: paraxantina, 1-/3-/7-metilxantina, ácido úrico, hipoxantina, tetrametilácido úrico y 8-metilcafeína. Verifican metilación en N y C, cantidades de uno a cuatro metilos, mono/dioxo/trioxo y diferentes sitios de H. Los grafos numerados de OPSIN añaden dionas en 2/8 y 6/8 y controles 9H.

Oxipurinol, con la misma fórmula C5H4N4O2 que la xantina pero conectividad pyrazolopirimidínica, no se identifica como purina y conserva PARTIAL. Las negativas también cubren metilos en posiciones incorrectas, H indicado incompatible, oxo ausente o mal situado, conectividad alterada, O en lugar de un N anular, N sobrevalente, protonación, metadatos isotópicos, localizadores repetidos y prefijos multiplicativos inconsistentes.

Los cinco SMILES de referencia tienen conjuntos exactos de IDs fijados independientemente del código de producción. Otras pruebas leen los localizadores y enlaces H explícitos del CML de OPSIN. Los metilos poseen sus propios localizadores de fragmento en CML, que se separan de los nueve localizadores anulares; no se confunden sus «1» con N1 del padre. Las pruebas invierten IDs/orden de almacenamiento/enlaces, rotan coordenadas en tres orientaciones y omiten el elemento de los carbonos conforme al contrato del editor (`undefined` significa C). El mapeo esperado del padre se mantiene bajo todas esas transformaciones.

## Archivos de la fase

- Nuevo `app/purine-derivation.ts`: constitución, gramática, reconstrucción y componentes semánticos.
- `app/systematic-family-grammar.ts` y `app/validated-name-derivation.ts`: integración acotada, etiqueta semántica del padre y texto opcional de componentes.
- `app/page.tsx`: numeración contextual, leyenda y presentación compartida de componentes.
- `app/reasoning-visual-interaction.tsx`: atributo de diagnóstico del paso activo; mismo controlador y mismo temporizador.
- `tests/purine-derivation.test.mjs` y su fixture: 52 pruebas específicas e independientes.
- `tests/symmetry-fused-import.test.mjs`: conserva importación y PARTIAL estructural, y ahora exige FULL únicamente por la nueva reconciliación completa.
- `tests/e2e/derivation.e2e.mjs`: cinco casos purínicos, IDs/aristas/localizadores exactos, fuentes reales, reordenamiento y representación esquelética. El recorrido de fase 6 se actualiza para la promoción real de cafeína a FULL.
- `scripts/audit-purine-derivation.mjs` y los JSON de evidencia de esta fase.

La ejecución de todos los archivos de pruebas descubrió además nueve expectativas históricas que fallaban también en el commit anterior `ae06683`. Se reprodujeron en una copia aislada sin cambios de fase 7 antes de corregirlas:

- Dos fixtures de persistencia/documentos usaban `N[C@@](C)C(=O)O`, que no representa el H del centro quiral que pretendían probar. Ahora usan `[C@@H]` y mantienen una negativa explícita que impide añadir silenciosamente H al original.
- Dos comprobaciones aún rechazaban indol, aunque la importación de fusión neutra C/N de cinco/seis miembros ya estaba habilitada en fase 6. Ahora comprueban esa capacidad y conservan una fusión de siete miembros fuera del alcance como control negativo.
- Una expresión regular del test de glucosa precedía a la prioridad del nombre completamente reconciliado. Se conserva el test químico de glucosa y se comprueban tanto esa prioridad verificada como el fallback externo protegido.
- Cuatro casos Easy/Intermediate/Hard pretendían importar un carbono sp pentavalente para probar el rechazo posterior. El importador ya lo rechazaba antes de llegar al validador. `tests/helpers/overvalent-sp-carbon.mjs` verifica primero ese rechazo y después construye deliberadamente el mismo contraejemplo inválido desde un portador válido, para exigir también su rechazo por los validadores independientes.

Los seis archivos de pruebas afectados se actualizan con estas comprobaciones más explícitas; no se relaja ninguna regla química de producción. Los logs de contraste están en `.sites-runtime/phase7-baseline-{failures,additional,hard,intermediate}.log`.

También se actualizaron tres contextos de extracción VM que habían quedado desfasados respecto de la aplicación anterior a esta fase. Dos casos de localización no proporcionaban `reconcileSystematicName` ni el grafo/contexto utilizado por la presentación verificada. Trece casos de geometría esquelética y uno de layout no proporcionaban `visualNumbering`; ahora reciben el mapa que utiliza el componente real. Se conservaron las aserciones químicas y geométricas y se añadió un control positivo: una cafeína reconciliada no habilita la ruta Legacy protegida. Los dos fallos de localización y ejemplos de ambos contextos de render se reprodujeron contra el commit anterior; los logs son `.sites-runtime/phase7-baseline-{localization,render-context}.log`. En total se corrigieron fixtures/contextos de nueve archivos, sin cambiar referencias químicas congeladas para hacerlos pasar.

La ejecución integral utiliza una copia del commit más el overlay de cambios, con hashes SHA-256 y las mismas dependencias y artefacto compilado, situada fuera de OneDrive para reducir la carga de archivos. `.sites-runtime/phase7-current-snapshot.json` registra su origen y los hashes. El primer arnés de esa copia no tenía HEAD y `git archive` había convertido finales de línea de dos referencias verificadas byte a byte: esos problemas de copia hicieron fallar 77 casos de inventario y una comprobación de integridad. No se editaron sus pruebas ni sus referencias en el repositorio; se repitieron completos en el workspace original, junto con los archivos cuyos contextos se corrigieron. Los últimos cambios al reconocedor y a sus controles se cubrieron además con la repetición focal final.

No se modificó el importador para esta fase ni se instaló otra dependencia.

## Validación técnica final

Resultados estructurados: [purine-validation-results.json](purine-validation-results.json).

| Comprobación | Resultado |
|---|---|
| Banco acumulado prioritario | 20/20 FULL: los 15 anteriores más las cinco prioridades purínicas |
| Pruebas específicas de purinas | 52/52 aprobadas |
| Repetición focal final: purinas, reconciliación, generalización, estructura y simetría | 119/119 aprobadas |
| Todos los 188 archivos ordinarios de pruebas unitarias/integración | Resultado consolidado: 3290 aprobadas, 5 omitidas existentes, ningún fallo pendiente |
| E2E anteriores | 7/7: tres originales, tres de generalización y uno de simetría/fusión |
| E2E purínico con HTTP simulado | 1/1 recorrido aprobado, con las cinco moléculas |
| E2E purínico con servicios reales | 1/1 recorrido aprobado, con las cinco moléculas |
| Typecheck | Aprobado |
| Lint | 0 errores; 36 advertencias existentes |
| Build de producción | Aprobado; avisos existentes de tamaño de chunk y compatibilidad SSR |
| Artefacto local del Worker | Importación ESM aprobada, `default.fetch` presente y manifiesto de hosting JSON válido |
| `git diff --check` | Aprobado |
| Despliegue | No realizado |

El resultado ordinario es una **consolidación**, no una afirmación de que el primer comando integral terminó con código cero. Ese comando ejecutó 3294 casos: 3195 aprobados, 94 fallidos y 5 omitidos. Sus 94 fallos pertenecían a cinco archivos completos: 78 problemas del arnés de copia y 16 contextos VM desfasados. Se sustituyen los resultados completos de esos cinco archivos (134 casos) por sus repeticiones finales: 102/102 y 33/33, incluyendo el nuevo control positivo de localización. Así se obtienen 3295 casos, con 3290 aprobados y cinco omitidos. Las omisiones son los controles ESTER0007/0012/0014/0015/0016 que ya excluían una proyección EN Silver como oráculo exacto. Los logs son `.sites-runtime/phase7-all-unit-current.log`, `phase7-final-historical-rerun.log` y `phase7-render-context-rerun.log`.

Se ejecutaron además los **dos archivos de auditoría opcionales** de `tests/naming-audit/`, fuera del patrón ordinario de CI: 24 casos, 20 aprobados y cuatro fallidos. Los cuatro también fallan al ejecutar los mismos controles contra `ae06683`, sin fase 7:

- La guardia de hashes históricos de infraestructura, cuya primera discrepancia es `app/bond-label-geometry.ts`, archivo no modificado en esta fase.
- AUDNOM-002: conectividad de amidas N-sustituidas y aminas terciarias en Legacy EN.
- AUDNOM-003: sustituyentes metilo del anillo en nombres arilo de cadenas funcionales.
- AUDNOM-005: proyección R/S en Legacy EN.

Los tres últimos obtienen `UNVERIFIED` por falta de recibos independientes para salidas Legacy ya existentes. Se conservan estas expectativas y sus evidencias congeladas: no se los declara aprobados ni se modifica el motor Legacy para ampliar esta fase. Logs: `.sites-runtime/phase7-optional-audits.log` y `phase7-baseline-optional-audits.log`.

Los nueve recorridos E2E aprobaron; se repitieron ambos recorridos purínicos después del último build. Cada uno verifica los cinco nombres recibidos, los blancos exactos de átomos/enlaces/localizadores de todos los componentes y la alternancia entre moléculas. Los dos JSON finales registran listas vacías de errores de página y consola. El recorrido real utiliza PubChem y OPSIN sin sustituir nombres para lograr FULL.

## Capturas y evidencia del navegador

Cada fila corresponde a una selección contextual realmente observada y capturada durante el E2E; ambos modos comprueban también los demás componentes, incluido el padre de nueve posiciones, N1/N3/N7/N9, fusión C4–C5, metilos, carbonilos e H cuando corresponde.

| Molécula | Highlighting validado | Captura simulada | Captura con servicios reales |
|---|---|---|---|
| Purina | Padre, N, fusión y 7H | [Purina](../outputs/derivation-e2e/purine/deterministic/purine.png) | [Purina](../outputs/derivation-e2e/purine/live/purine.png) |
| Xantina | Padre, N, fusión, hidro 3/7 y oxo 2/6 | [Xantina](../outputs/derivation-e2e/purine/deterministic/xanthine.png) | [Xantina](../outputs/derivation-e2e/purine/live/xanthine.png) |
| Cafeína | Padre, N, fusión, metilos 1/3/7 y oxo 2/6 | [Cafeína](../outputs/derivation-e2e/purine/deterministic/caffeine.png) | [Cafeína](../outputs/derivation-e2e/purine/live/caffeine.png) |
| Teobromina | Padre, N, fusión, metilos 3/7 y oxo 2/6 | [Teobromina](../outputs/derivation-e2e/purine/deterministic/theobromine.png) | [Teobromina](../outputs/derivation-e2e/purine/live/theobromine.png) |
| Teofilina | Padre, N, fusión, metilos 1/3, 7H y oxo 2/6 | [Teofilina](../outputs/derivation-e2e/purine/deterministic/theophylline.png) | [Teofilina](../outputs/derivation-e2e/purine/live/theophylline.png) |

Capturas adicionales reales: [las nueve posiciones del padre](../outputs/derivation-e2e/purine/live/caffeine-parent.png) y [los cuatro N en vista esquelética](../outputs/derivation-e2e/purine/live/caffeine-skeletal.png). Se inspeccionaron visualmente la numeración del padre, los N esqueléticos y las selecciones de H/carbonilos. La evidencia completa de red, grafos y regiones está en [E2E simulado](../outputs/derivation-e2e/purine/deterministic/phase7.json) y [E2E real](../outputs/derivation-e2e/purine/live/phase7.json).

## Limitaciones conservadas

La gramática no cubre todos los sustituyentes, glucósidos, cargas, isotopía, reducciones carbonadas ni sistemas policíclicos con más anillos. El reconocedor de este alcance exige un sistema anular de nueve átomos y diez aristas. Glucosa y testosterona mantienen su ruta PARTIAL. Los nombres comunes se resuelven externamente y no son producciones de la gramática.

Un ejemplo explícito es `3,7-dihydropurine-2,8-dione`: OPSIN selecciona una forma usando prioridades de hidrógeno indicado implícito que esta gramática todavía no implementa. El constructor acotado conserva más de una asignación de H y devuelve PARTIAL. En cambio, las formas con sitios de H suficientes para probar una sola clase, como `7,9-dihydro-3H-purine-2,8-dione`, sí se reconcilian. Este límite está probado y no se resuelve seleccionando el grafo del editor.

FULL significa nombre completo interpretado y reconciliado dentro de estas producciones; `preferred` sigue siendo `false`. No se afirma que cada variante aceptada sea el nombre preferido IUPAC. No se realizó despliegue.
