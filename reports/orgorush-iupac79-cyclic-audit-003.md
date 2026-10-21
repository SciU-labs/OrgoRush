# ORGORUSH-IUPAC79-CYCLIC-AUDIT-003

## Clasificación inicial, anterior a cambios del motor

Base: `90b119a`, árbol limpio. Esta sección se estableció al inspeccionar el
flujo antes de modificar código de aplicación. La matriz ejecutable posterior
comprobará sus hipótesis; no equivale a una afirmación de cobertura universal.

| Filtro o ruta | Clase de rechazo | Diagnóstico inicial |
| --- | --- | --- |
| `legacy-profile-display.ts` | 5/6, presentación final | Convierte `-` del motor localizado en «No disponible»; excepción TNT independiente del dominio cíclico |
| `legacySpanishFormatterInput` / `formatIupac1979SpanishName` | 6 | Admisión lexical limitada: faltan cicloalcanos simples, varios insaturados, padres heterocíclicos y ensamblajes ya reconocidos |
| `legacyEnglishProfileIsSupportedForMolecule` | 5 | Veto general a cualquier heterociclo aun cuando el modelo conserva un padre registrado |
| `legacyEnglishName` / `nomenclatureVariants` en la página | 5 | Disponibilidad Legacy depende de la seguridad del análisis moderno; impide ampliar ambos perfiles de forma independiente |
| `carbonSkeleton` / `heterocycleRing` | 3 | Recuperación de monociclo solo después de retirar heteroátomos; padres aromáticos o heterocíclicos sin metadatos pueden recorrer otra ruta |
| `getFusedBicyclicSystem`, `getFusedTricyclicSystem`, `getFusedTetracyclicSystem`, esteroides | 2/3 | Requieren anillos guardados; la recuperación general anterior solo se aplica al padre saturado sin sustituyentes |
| `nameRetainedFused1979` | 2, con límites deliberados | Registro A-21/A-23 acotado; sustitución y patrones de hidrogenación adicionales no están implementados |
| `nameSaturatedFused1979` / generador de puentes cero | 2 | Dominio ortofusionado 5/6, periferia hamiltoniana; no es un algoritmo A-32 para puentes positivos generales |
| Puentes positivos, espiro y sistemas mixtos | 2 | El clasificador reconoce familias, pero no hay una ruta nominal general correspondiente |
| `analyzeMultiRingMolecule` / ensamblajes | 2/4 | Prefiere un anillo y radicales; no implementa de forma general A-52/A-54 ni numeración con primas |
| Registro heterocíclico / `localNamerCannotSafelyName` | 2 | Padres registrados concretos; los demás sistemas y OH no representados se bloquean por seguridad |
| `externalCandidateNeedsNeutralLocalName`, N sustituidos, estereoquímica no representada | 2/5 | Protegen contra nombres incompletos; no deben eliminarse indiscriminadamente |
| `legacy-english-nomenclature.ts`: `unavailableReason`, diácidos, raíz desconocida | 2/6 | Gramática funcional finita; evitar admitir derivados por el solo hecho de reconocer el núcleo |
| `openchemlib-adapter.ts` | 1/2, frontera de importación | Rechaza isótopos explícitos y topologías no editables; no debe confundirse con la validez normativa de un nombre |
| `fused-topology.ts`, valencia/esquema, límites de enumeración | 1/2 | Grafos inválidos, desconectados y límites de recursos; un límite computacional no convierte una molécula válida en inválida |

Clases: 1 fuera del dominio del proyecto (o entrada inválida); 2 nomenclatura
válida aún no implementada; 3 reconocimiento topológico; 4 algoritmo; 5 integración
del perfil; 6 validación posterior de un nombre ya generado.

Se inspeccionaron también `simple-cycle.ts`, `heterocycle-registry.ts`, la
numeración de anillos y cadenas, selección de padres, funciones exocíclicas,
normalización/localización, el adaptador SMILES y la política separada de
Practice/Exam. La restricción de generación de ejercicios no se usa como una
definición de todo el dominio químico editable.

## Reglas y límites de las correcciones propuestas

Antes de implementar, se seleccionan A-11/A-2/A-61 para monociclos; A-31.1–2
para padres bicíclicos saturados con tres caminos disjuntos; A-41.1–2 para
monoespiránicos saturados simples; B-1/B-2 para padres heterocíclicos ya
registrados y verificados. Se reutilizarán las rutas A-21/A-23/A-32 anteriores.
No se promete aquí A-32 de jaulas generales, poliespiránicos, componentes
mixtos, heteropuentes o ensamblajes arbitrarios; sus dependencias se documentarán
como ampliaciones independientes en el informe final.

Fuentes principales (reproducción autorizada de IUPAC 1979):

- [Índice A](https://www.acdlabs.com/iupac/nomenclature/79/r79_2.htm).
- [A-11](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm).
- [A-31](https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm),
  [A-32](https://www.acdlabs.com/iupac/nomenclature/79/r79_164.htm),
  [A-34](https://www.acdlabs.com/iupac/nomenclature/79/r79_166.htm).
- [A-41](https://www.acdlabs.com/iupac/nomenclature/79/r79_197.htm).
- [A-52](https://www.acdlabs.com/iupac/nomenclature/79/r79_156.htm),
  [A-53](https://www.acdlabs.com/iupac/nomenclature/79/r79_157.htm),
  [A-54](https://www.acdlabs.com/iupac/nomenclature/79/r79_158.htm).
- [Índice B](https://www.acdlabs.com/iupac/nomenclature/79/r79_3.htm),
  [nombres heterocíclicos hidrogenados retenidos](https://www.acdlabs.com/iupac/nomenclature/79/r79_959.htm).

La clasificación anterior quedó establecida antes de modificar el motor. Las
secciones siguientes registran la reproducción y la implementación posterior.

## Conjunto reproducible y criterios

La referencia contiene 66 grafos explícitos y 47 construcciones paramétricas:
26 grafos theta con tres caminos entre dos cabezas de puente y 21 monoespiros.
Los nombres y fórmulas de referencia están fijados en
[`tests/fixtures/iupac79-cyclic-audit-003.mjs`](../tests/fixtures/iupac79-cyclic-audit-003.mjs),
sin consultar la salida del motor para construir el resultado esperado.

Antes del recuento se comprueban IDs/aristas, valencias, conectividad por
recorrido independiente y rango ciclomático `E − V + 1`. Se exporta cada grafo,
se vuelve a interpretar con OpenChemLib y se contrasta su fórmula literal.
La identidad canónica `CanonizerUtil.NORMAL` elimina duplicados isomórficos
antes de contar. Los 113 grafos de esta entrega resultan distintos. Sus cinco
presentaciones no cuentan como moléculas adicionales:

- Metadatos del caso de referencia.
- Sin metadatos de anillos.
- Dibujo rotado y trasladado.
- IDs y listas invertidos, reflexión y traslación, sin metadatos.
- Metadatos de anillos deliberadamente obsoletos.

La matriz final contiene **565 observaciones y 113 constituciones**. La línea
base se obtuvo antes de las correcciones con cuatro variantes por caso
(452 observaciones; todavía no incluía la rotación independiente).

Un idioma es PASS solo si coincide con la referencia o una alternativa
normativamente adjudicada. `-` es UNSUPPORTED. Un nombre distinto, un error o
una discrepancia sin adjudicar es FAIL. La estructura es FAIL si falla alguna
variante; es PASS solo si ambos idiomas pasan en todas las variantes; en otro
caso es UNSUPPORTED. Por tanto, los recuentos iniciales incluyen fallos de
robustez frente a metadatos: no significan que todos los dibujos de cada caso
generasen un nombre incorrecto.

Las alternativas no se equiparan automáticamente mediante traducciones o
normalizaciones amplias. A-52.1 permite la construcción sobre radical y sobre
hidrocarburo: `1,1'-bicyclohexyl` y `1,1'-bicyclohexane` están adjudicados como
alternativas EN (y sus formas ES en el fixture). Se emite la primera.
C-812.1 permite `cyclohexylamine` y `cyclohexanamine`; ambas y sus formas ES
están adjudicadas, y el motor conserva la construcción sobre el padre RH.
Un nombre
moderno o una discrepancia no adjudicada no adquiere PASS por parecer plausible.
Por ejemplo, `phenylcyclohexane` para bifenilo añade seis hidrógenos respecto
de C12H10 y representa otro grafo; el prefijo duplicado
`3-methyl-3-methylbicyclo[4.4.0]decane` representa dos sustituciones en lugar de
una. No son meras variantes de escritura.

## Resultados por familia

| Familia | Constituciones | Antes PASS / FAIL / UNSUPPORTED | Final PASS / FAIL / UNSUPPORTED |
| --- | ---: | --- | --- |
| A: monociclos de 3–12 miembros, saturación, alquenos/alquinos y sustitución | 12 | 0 / 12 / 0 | 12 / 0 / 0 |
| B: fusionados, puentes cero, retenidos aromáticos, hidrogenación y periferia no hamiltoniana | 22 | 12 / 0 / 10 | 19 / 0 / 3 |
| C: puentes positivos, longitudes y cabezas equivalentes; jaula con puentes secundarios positivos | 17 | 0 / 0 / 17 | 16 / 0 / 1 |
| D: monoespiros de tamaños iguales/diferentes, poliespiro y mixto espiro-fusionado | 23 | 0 / 0 / 23 | 21 / 0 / 2 |
| E: anillos iguales/diferentes, aromáticos/saturados y tres componentes | 6 | 0 / 6 / 0 | 5 / 0 / 1 |
| F: N, O, S, O+N, saturados/aromáticos, fusionados, puenteados y espiro | 20 | 0 / 14 / 6 | 15 / 0 / 5 |
| G: alquilo, halógeno, alcohol, cetona, enona, ácido, aldehído, nitrilo, amida y amina | 13 | 0 / 13 / 0 | 12 / 0 / 1 |
| **Total de este conjunto finito** | **113** | **12 / 45 / 56** | **100 / 0 / 13** |

Cada fila con SMILES, fórmula, topología, rango, regla, esperado y generado ES/EN
está en la [tabla completa](orgorush-iupac79-cyclic-audit-003.matrix.md).
El [JSON final](orgorush-iupac79-cyclic-audit-003.matrix.json) conserva también
los grafos y cada variante. El [JSON inicial](orgorush-iupac79-cyclic-audit-003.baseline.json)
conserva las salidas y errores anteriores. Los textos internos `rawEs`, `rawEn`
y `analysis` se distinguen de los nombres disponibles tras los filtros del perfil.

Este conjunto no representa toda la nomenclatura IUPAC; no se deriva un
porcentaje global de cobertura.

## Causas raíz y correcciones

1. **Percepción incompleta, clase 3.** El clasificador distinguía monociclos,
   espiros y ensamblajes, pero devolvía sus listas de ciclos vacías. Ahora
   conserva el ciclo ordenado y descompone los bloques biconexos cíclicos. La
   percepción de nomenclatura reconstruye los anillos desde los enlaces y
   determina aromaticidad con OpenChemLib, sin coordenadas. Solo se conserva
   una orientación guardada si su lista completa de ciclos coincide con el
   grafo. IDs, orden y flags obsoletos no seleccionan otra familia.
2. **Ruta de fusionados decorados, clase 3.** Los reconocedores anteriores
   reciben los ciclos percibidos también para derivados e insaturados. Las
   decisiones aromáticas A-21/A-23 se toman antes de adaptar los flags a la
   interfaz histórica del reconocedor alicíclico. Se conservan los padres,
   numeraciones y pruebas de FUSED-001/POLYCYCLIC-002.
3. **Ausencia de padres generales, clase 2.** Se añaden pruebas completas del
   grafo para bicíclicos theta saturados sin sustitución (A-31.1–2), monoespiros
   saturados simples (A-41.1–2) y dos carbociclos simples enlazados (A-52/A-53).
   Las longitudes se calculan desde los caminos, sin comparar fórmulas o IDs
   de moléculas concretas. La selección A-53 compara tamaño antes de grado de
   hidrogenación. Los ensamblajes usan locantes con primas separados del
   contrato numérico anterior.
4. **Bloqueo de heterociclos registrados, clases 3/5/6.** Se reutiliza el
   registro existente; el emparejamiento exige el anillo completo de átomos y
   enlaces, neutralidad y ausencia de sustituyentes. Se recuperan los padres
   sin metadatos y se aplica prioridad O/S/N y menores locantes. Se elimina
   el veto general EN solo para esos padres. Glucosa, OH no representados y
   heterociclos no registrados mantienen sus controles de seguridad.
5. **Filtros cruzados de perfiles, clase 5.** La disponibilidad Legacy, copia,
   locantes y explicación dependen de su propio análisis. Un padre Legacy
   demostrado puede mostrarse aunque Modern siga sin disponer de esa gramática.
   El proveedor externo no sustituye ni adjudica el nombre Legacy.
6. **Formateo/localización, clases 4/6.** La gramática monocíclica ES precede
   al formateador de cadenas: `ciclo-1-hexeno` pasa a `1-ciclohexeno`. Se
   incorporan cicloalcanos y los sufijos ya reconocidos de amina, carbonitrilo
   y carboxamida. EN conserva el locante del sustituyente cuando la
   insaturación distingue posiciones. El fallback policíclico usa el padre
   sin prefijos, evitando duplicarlos al reconstruir el nombre.
7. **Recursión de ensamblajes no implementados, clases 2/4.** Tres o más
   componentes no caen en el nombrador de ramas acíclicas. Se devuelve un
   límite explícito hasta implementar A-54. Los padres cíclicos cargados
   tampoco reciben un nombre neutro; esto no bloquea grupos nitro exocíclicos.

Las comprobaciones nuevas reconstruyen todas las aristas a partir del
descriptor y de la numeración de los 47 grafos generados, además del nombre.
También comprueban identidad bajo las cinco transformaciones, locantes O-1/O-3,
primas de ensamblajes, independencia Modern/Legacy, contenido de explicaciones
y ausencia de mutaciones del grafo. Los controles negativos añaden cargas,
estereoquímica almacenada, insaturación y sustitución a los nuevos núcleos.

## Justificación normativa y referencias

La fuente es **IUPAC, Nomenclature of Organic Chemistry, Sections A, B, C, D,
E, F, and H, Pergamon Press, Oxford, 1979**, reproducida con autorización por
ACD/Labs. No se utilizaron nombres de PubChem como oráculo ni se sustituyeron
estas reglas por sus revisiones posteriores.

| Alcance | Regla y criterio aplicado |
| --- | --- |
| Cicloalcanos/insaturados y sustitución | A-11.1/11.3, A-2 y A-61: raíz del anillo y menores locantes, con el prefijo cíclico unido al padre |
| Aromáticos fusionados e hidrogenados ya establecidos | [A-21](https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm), [A-22](https://www.acdlabs.com/iupac/nomenclature/79/r79_72.htm), [A-23](https://www.acdlabs.com/iupac/nomenclature/79/r79_73.htm): registro y numeración anteriores conservados |
| Bicíclicos simples | A-31.1–2: tres recuentos decrecientes; numerar por puente mayor, intermedio y menor |
| Fusionados saturados generales anteriores | A-32.11–31: periferia máxima, división y puentes secundarios cero; sin extender automáticamente a jaulas positivas |
| Monoespiros | A-41.1–2: recuentos crecientes excluyen el átomo espiro; anillo menor, unión y mayor |
| Dos sistemas idénticos | A-52.1–2: bi + radical/hidrocarburo y locantes con primas; A-52.4 conserva bifenilo |
| Dos sistemas diferentes | A-53.1–2: tamaño del anillo antes de hidrogenación; explica fenilcicloheptano frente a cicloheptilbenceno |
| Heterociclos registrados | [B-1](https://www.acdlabs.com/iupac/nomenclature/79/r79_702.htm), [tabla B-II](https://www.acdlabs.com/iupac/nomenclature/79/r79_704.htm), [B-2.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_958.htm), B-2.12: nombres retenidos/Hantzsch-Widman e hidrogenación de los padres existentes |
| Derivados funcionales | [Tabla C-III](https://www.acdlabs.com/iupac/nomenclature/79/r79_905.htm); [C-812](https://www.acdlabs.com/iupac/nomenclature/79/r79_513.htm), [C-832](https://www.acdlabs.com/iupac/nomenclature/79/r79_566.htm), [C-822.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_541.htm): amina, carbonitrilo y carboxamida sobre el núcleo ya analizado |

Ejemplos completos de la matriz: `biciclo[2.2.1]heptano` /
`bicyclo[2.2.1]heptane`, `espiro[4.5]decano` / `spiro[4.5]decane`,
`fenilcicloheptano` / `phenylcycloheptane`, `1,3-dioxolano` /
`1,3-dioxolane`. Las reglas por estructura constan en los fixtures y en la tabla.

## Límites pendientes y tareas separadas

Los 13 casos UNSUPPORTED son nomenclatura válida aún no implementada (clase 2),
no estructuras químicamente inválidas:

| Tarea propuesta | Casos de la matriz | Dependencia y trabajo necesario |
| --- | --- | --- |
| IUPAC79-RETAINED-HYDRO-004 | tetralina, pireno | Ampliar grafos retenidos y numeración A-21/A-22; después A-23 para más patrones de hidrogenación |
| IUPAC79-BAEYER-GENERAL-005 | perhidropireno, adamantano | A-32 sin periferia hamiltoniana y con puentes secundarios positivos; optimización de anillo principal y desempate de superíndices. A-34 requiere además el padre fusionado y sus locantes |
| IUPAC79-SPIRO-COMPONENTS-006 | diespiro, espiro-fusionado | A-41.4–7: componentes con numeración fija, primas, orden y desempates de varios centros; depende del registro fusionado ampliado |
| IUPAC79-ASSEMBLY-007 | terfenilo | A-54/A-55: numeración seriada de componentes, primas múltiples, sustitución y enlaces adicionales; no basta repetir radicales |
| IUPAC79-HETERO-GENERAL-008 | indol, quinolina, quinuclidina, oxaespiro, dihidrofurano | [B-3](https://www.acdlabs.com/iupac/nomenclature/79/r79_960.htm), B-10/B-14 y B-1.2: selección y numeración de fusión/puentes, reemplazo hetero e hidrogenación posicional; reutilizar las tareas anteriores según familia |
| IUPAC79-CYCLIC-DERIVATIVES-009 | metildecalina, solo ES pendiente | Numeración y gramática histórica de sustituyentes/sufijos sobre padres bicíclicos; EN ya emite una sola vez `3-methylbicyclo[4.4.0]decane` |

No se amplían el constructor, los elementos ni los grupos funcionales. La
exportación SMILES de todos los grafos se comprueba; la importación editable
mantiene sus restricciones previas para espiros y puentes. **Un nombre
constitucional verificado no implica que la interfaz permita construir o
importar toda esa familia.** Tampoco se amplía la asignación de estereoquímica.
Los límites computacionales del clasificador (120 átomos, 150 enlaces,
20 000 recorridos, 256 ciclos y profundidad de enumeración 24) permanecen
explícitos; agotar un límite devuelve UNSUPPORTED, no una identificación parcial.

## Archivos y reproducción

- Motor: `app/fused-topology.ts`, `app/naming-ring-perception.ts`,
  `app/iupac1979-cyclic-parents.ts`, `app/page.tsx`,
  `app/nomenclature-conventions.ts`, `app/legacy-english-nomenclature.ts`.
- Auditoría: `scripts/audit-iupac79-cyclic-003.mjs`,
  `scripts/naming-audit/evaluate.mjs`, script npm en `package.json`.
- Referencias/pruebas: fixtures y helper `cyclic-audit-003`, prueba nueva
  `tests/iupac79-cyclic-audit-003.test.mjs`. Pruebas anteriores actualizadas:
  `tests/aud-nom-011-legacy-fused-bicycles.test.mjs`,
  `tests/chemistry-regressions.test.mjs`,
  `tests/legacy-english-nomenclature.test.mjs`,
  `tests/formula-candidate-integration.test.mjs` y
  `tests/iupac1979-alkane-coverage.test.mjs`. Se actualizan expectativas de
  padres recién admitidos y nombres de puertas de seguridad. Se conservan los controles químicos negativos y se
  añaden comprobaciones de prueba de grafo y de glucosa en tiempo de ejecución.
- Informe, tabla, JSON final y captura inicial en `reports/`.

```sh
npm run audit:iupac79-cyclic
node --test --test-concurrency=1 tests/iupac79-cyclic-audit-003.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npm run build
```

El comando de auditoría sale con código 1 si aparece un FAIL o si un caso
marcado como implementado deja de pasar; los límites pendientes explícitos no
hacen fallar el comando.

## Validación ejecutada

- Línea base y prueba roja capturadas antes de modificar aplicación: primer
  caso `ciclopropano` rechazado en ES; errores y salidas completos archivados.
- Matriz final: **100 PASS, 0 FAIL, 13 UNSUPPORTED**; 565 observaciones.
- Comprobaciones dirigidas finales de los ocho archivos afectados: **117/117 PASS**, incluyendo la matriz,
  numeración/identidad, separación de perfiles, explicaciones, guardas de
  glucosa, heterociclos y gramática EN.
- Compilación `scripts/build-verified.sh`: PASS, incluido el validador del
  Worker ESM y del manifiesto de hosting. Avisos del empaquetador sobre módulos
  Node y tamaño de chunks; no errores de compilación.
- TypeScript: comparación contra un archivo aislado de `HEAD` con los mismos
  directorios fuente y dependencias: **49 diagnósticos antes y después,
  ninguno nuevo**. El typecheck global aún falla por problemas preexistentes;
  no se presenta como una comprobación limpia.
- Suite completa: **2 852 pruebas, 2 843 PASS, 4 FAIL y 5 omitidas** en la
  ejecución de diagnóstico (1 510,7 s). Los cuatro fallos eran expectativas
  anteriores: veto de padres heterocíclicos completos, dos comprobaciones
  textuales del filtro compartido con Modern y rechazo de ciclohexano ES.
  Se actualizaron para el alcance verificado y se reforzaron los controles
  negativos de glucosa, prueba de grafo y pireno. La **reejecución de los ocho
  archivos afectados pasó 117/117**, con 0 fallos y 0 omitidas. La suite
  completa incluyó Practice/Exam, versiones congeladas, SMILES, aromaticidad,
  numeración, perfiles, explicaciones y controles visuales. La primera
  ejecución conserva los cuatro fallos iniciales en su registro; la
  reejecución dirigida confirma su resolución. Las cinco omitidas pertenecen
  al corpus preexistente de ésteres sin oráculo exacto (`silver`); no se
  añadieron omisiones para esta tarea.
- Verificación adicional final de la prueba nueva: **4/4 PASS**, incluido OH
  exocíclico sobre heterociclo sin metadatos, etiquetas y los dos perfiles.
- `git diff --check`: PASS. `HEAD` permanece en `90b119a`.

Cambios locales para revisión. No se realiza commit ni push.
