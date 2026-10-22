# ORGORUSH-IUPAC79-FALLBACK-006

## Resultado y alcance

Se amplía el fallback estructural Legacy EN → ES a siete familias alifáticas
saturadas: alcoholes, cetonas, aldehídos, ácidos carboxílicos, amidas con NH2
sin sustituir, nitrilos y ésteres con O-alquilo lineal. No se declara cobertura
universal de IUPAC 1979. La extensión admite una sola familia funcional por
molécula; conserva las rutas españolas nativas y las aminas verificadas en 005.
Las funciones deben estar representadas en el padre; esta extensión no expresa
funciones adicionales ocultas en ramas mediante prefijos todavía no verificados.

Estado inicial: `1ed57f4`, árbol limpio. No se modifica el motor inglés, IUPAC
2013, el formateador español nativo, los controles de disponibilidad química,
las traducciones de interfaz ni la lógica de interacción. Sin commit ni push.

## Auditoría reproducible

La [línea base](orgorush-iupac79-fallback-006.baseline.json) registra 48
estructuras antes de cambiar el traductor: nombre inglés 1979, nombre español
1979, nombre español 2013, fórmula, disponibilidad química y causa del rechazo.
2013 se utiliza exclusivamente para comparar la estructura y detectar cambios;
su nombre nunca alimenta el fallback.

La [matriz final](orgorush-iupac79-fallback-006.audit.json) contiene esas 48
estructuras y nueve referencias adicionales. Clasificación de producción:

| Matriz | NATIVE_ES | TRANSLATED_FROM_LEGACY_EN | UNSUPPORTED |
|---|---:|---:|---:|
| Inicial, 48 estructuras | 27 | 0 | 21 |
| Mismas 48, después | 27 | 15 | 6 |
| Final ampliada, 57 estructuras | 27 | 24 | 6 |

Los 48 nombres ingleses, nombres de 2013, resultados nativos españoles y
vetos químicos permanecen iguales a la línea base. Las pruebas comparan estos
datos sin modificar las referencias correctas. Las 45 referencias nominales
positivas tienen además una traducción directa verificada en cinco variantes
de dibujo, metadatos y orden/identificación de átomos: 225 observaciones.
La traducción directa también prueba la ruta nueva donde producción conserva
`NATIVE_ES`; por ejemplo, el nativo `propanol` conserva su precedencia aunque
la ruta estructural pueda construir `1-propanol`.

| Familia | Causa raíz observada | Referencias positivas |
|---|---|---:|
| Alcoholes | Los nueve saturados de la matriz inicial ya eran nativos; faltaba una ruta estructural alternativa demostrable. | 9 |
| Cetonas | Las monocetonas probadas eran nativas; el formateador ES rechazaba el sufijo múltiple. | 7 |
| Aldehídos | Monoaldehídos probados nativos; rechazo léxico de dialdehídos. | 6 |
| Ácidos | Monoácidos probados nativos; rechazo del sufijo de diácido. | 6 |
| Amidas | El formateador ES no representaba esta gramática alifática; el único fallback de cadenas era para aminas. | 6 |
| Nitrilos | Igual carencia de gramática ES alifática y de verificación estructural específica. | 5 |
| Ésteres | Faltaba distinguir el padre ácido de los radicales enlazados al oxígeno y construir su orden español. | 6 |

Los rechazos originales compartían el diagnóstico de la ruta de aminas, que
no describía bien estas otras familias. Ahora tienen una ruta funcional
propia y un rechazo explícito cuando no puede demostrarse el modelo completo.

### Quince nombres reparados de la matriz inicial

| Estructura | Legacy EN, conservado | Legacy ES reparado |
|---|---|---|
| `CC(=O)CC(=O)C` | 2,4-pentanedione | 2,4-pentanodiona |
| `O=CCCC=O` | butanedial | butanodial |
| `O=C(O)CCC(=O)O` | butanedioic acid | ácido butanodioico |
| `NC=O` | methanamide | metanamida |
| `CCC(N)=O` | propanamide | propanamida |
| `CC(C)CC(N)=O` | 3-methylbutanamide | 3-metilbutanamida |
| `NC(=O)CCC(N)=O` | butanediamide | butanodiamida |
| `CC#N` | ethanenitrile | etanonitrilo |
| `CCC#N` | propanenitrile | propanonitrilo |
| `CC(C)CC#N` | 3-methylbutanenitrile | 3-metilbutanonitrilo |
| `N#CCCC#N` | butanedinitrile | butanodinitrilo |
| `CC(=O)OC` | methyl ethanoate | etanoato de metilo |
| `CCC(=O)OCC` | ethyl propanoate | propanoato de etilo |
| `CC(C)CC(=O)OC` | methyl 3-methylbutanoate | 3-metilbutanoato de metilo |
| `COC(=O)CCC(=O)OC` | dimethyl butanedioate | butanodioato de dimetilo |

Los SMILES identifican las entradas de prueba; no se emplean como claves del
algoritmo. Los nueve nombres adicionales verificados, incluidas formas ramificadas,
una tricetona y un diéster etílico, constan en la matriz final.

## Comprobación química y construcción del nombre

`iupac1979-aliphatic-functions.ts` reutiliza las raíces, fragmentos de
sustituyentes, comparación de padres, claves alfabéticas históricas e identidad
completa de grafos existentes. El despacho se incorpora a
`iupac1979-english-to-spanish.ts`; la ruta de aminas no cambia.

El procedimiento comprueba el perfil y la coincidencia exacta del nombre EN
con su modelo semántico; descubre las funciones en el grafo real; reconstruye
todos los átomos y enlaces del padre, funciones y ramas; y exige isomorfismo
completo con correspondencia forzada de cada carbono del padre. Se verifican
conectividad, valencias, cargas e hidrógenos implícitos. Los enlaces C=O y
C≡N pertenecen a sus funciones y no se confunden con insaturación C–C.

Después enumera independientemente los caminos del bosque de carbonos para
comprobar número de grupos principales, longitud, locantes funcionales,
cantidad y locantes de prefijos y desempate alfabético. Las grafías iso/sec/tert
admitidas conservan su propio criterio alfabético; un radical con locantes
internos exige la gramática de paréntesis correspondiente. En ésteres, los
carbonos del O-alquilo se reconstruyen íntegramente pero no se convierten en
parte del padre ácido. El español se ensambla mediante morfemas históricos
probados, sin sustituciones globales sobre nombres EN ni copias de 2013.

La prioridad entre familias distintas no se amplía: una molécula con funciones
mezcladas se rechaza en esta ruta y conserva su eventual solución nativa. La
prioridad de cantidad de funciones frente a longitud se prueba con el diol
cuyo padre C3 contiene dos OH y cuyo camino C5 solo contiene uno.

El análisis español seleccionado recibe los átomos numerados del modelo
verificado. Las pruebas recorren selección, disponibilidad, exportación,
nombre mostrado, pasos explicativos, fragmentos y enlaces de resaltado.

## Límites y trabajo pendiente

| Caso | Límite actual y siguiente trabajo |
|---|---|
| Tamaño | Padre C1–C20, máximo 120 átomos, molécula conexa y acíclica; radicales de la gramática existente. Ampliar con referencias propias. |
| Multiplicidad funcional | Hasta tres OH o cetonas; hasta dos funciones terminales en las demás familias. Verificar sufijos superiores y elisiones antes de ampliar. |
| Repetición de prefijos | Hasta diez repeticiones de un mismo prefijo simple y seis de uno complejo; ampliar sus multiplicadores con pruebas propias. |
| HCN | Fuera de la nueva ruta: se exige un fragmento R–C≡N con enlace a otro carbono. |
| Amidas N-sustituidas | No admitidas en la nueva ruta. Representar y comprobar radicales sobre N, anclas y locantes, incluidas poliamidas. |
| Ésteres mixtos | Rechazados: el modelo/formateador EN actual multiplica un único nombre de radical. Hace falta representar cada radical sin pérdida. No se corrige EN en esta tarea. |
| O-alquilo ramificado o funcionalizado | Rechazado; requiere construcción histórica independiente del radical, numeración interna y funciones subordinadas. |
| Familias mezcladas, halógenos y otras funciones | No se admiten como prefijos en esta nueva gramática homofuncional. Probar jerarquía histórica y reconstrucción de todos los prefijos antes de ampliar. |
| Nuevas formas insaturadas | Pendientes. Verificar C=C/C≡C, selección de padre, locantes, conjugación y gramática de cada sufijo, sin alterar los casos nativos ya soportados. |
| Estereoquímica e isótopos explícitos | El fallback nuevo los rechaza; no elimina información para aceptar un nombre. Las rutas nativas existentes se conservan. |
| Ciclos, aromáticos y heterociclos | Sin ampliación aquí; conservan sus rutas y regresiones previas. |

En las 48 entradas iniciales quedan seis `UNSUPPORTED`: la amida
`CNC(=O)CC` y las formas insaturadas `C=CC=O`, `C=CC(=O)O`, `C=CC(N)=O`,
`C=CC#N` y `C=CC(=O)OC`. Los alcoholes y cetonas insaturados que ya tenían
salida nativa continúan con ella.

## Referencias normativas

IUPAC, *Nomenclature of Organic Chemistry*, secciones A, B, C, D, E, F y H,
Pergamon Press, Oxford, 1979. Se consultó la reproducción autorizada de ACD/Labs:

- [C-201.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm): sufijo de alcoholes.
- [C-312.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_267.htm): cetonas acíclicas y sufijos múltiples.
- [C-302.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_249.htm) y [C-303.3](https://www.acdlabs.com/iupac/nomenclature/79/r79_251.htm): aldehídos y selección en cadenas ramificadas.
- [C-401.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm): carbono carboxílico incluido en ácidos acíclicos mono y dicarboxílicos.
- [C-822.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_541.htm): amidas con NH2 sin sustituir.
- [C-832.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_566.htm): nitrilos y dinitrilos con carbono funcional numerado.
- [C-463.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_363.htm): composición de ésteres neutros a partir de sus componentes.
- [C-13.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_933.htm), [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm) y [C-16.31–35](https://www.acdlabs.com/iupac/nomenclature/79/r79_883.htm): selección de padre, numeración y orden de prefijos.

Estas reglas determinan la construcción histórica; los morfemas españoles
usan las raíces y términos estructurales del repositorio. No se emplea una
recomendación de 2013 para inventar una regla de 1979.

## Validación

Etapas cerradas antes de habilitar la siguiente familia:

| Etapa | Resultado |
|---|---|
| Alcoholes y regresión 005 | 22/22 PASS |
| Cetonas, alcoholes y regresión 005 | 29/29 PASS |
| Aldehídos y familias previas | 25/25 PASS |
| Ácidos y familias previas | 31/31 PASS |
| Amidas y familias previas | 37/37 PASS |
| Nitrilos y familias previas | 42/42 PASS |
| Ésteres y familias previas | 48/48 PASS |
| Dirigidas finales, 003/004/005, selector, explicaciones y temas | 133/133 PASS |
| Auditoría final con `--verify` | 57 estructuras verificadas |
| Pages y validador | PASS; tres entradas, seis assets, base `/Hydrocarbon-Lab/` |
| Sites y validador | PASS; ESM Worker `default.fetch` y manifiesto presentes |
| TypeScript frente a `1ed57f4` | 49 diagnósticos antes y después; cero introducidos |
| Suite general | 2.931 pruebas: 2.926 PASS, cero FAIL, cinco SKIP preexistentes; 165 archivos, una ejecución completa sin interrupciones ni reintentos. |
| `git diff --check` | PASS |

TypeScript global sigue terminando con errores preexistentes; no se presenta
como compilación de tipos sin errores. La comparación usa una copia de HEAD,
los mismos directorios de código y exclusiones de outputs/dist/node_modules.
La primera tanda dirigida final detectó un error en la nueva prueba de ID cero:
suponía el mismo orden de dos funciones simétricas. Se corrigió para comprobar
la posición real del átomo en el padre probado y se repitieron las 133 pruebas,
todas aprobadas. No se cambiaron referencias químicas para obtener PASS.

El corpus conserva cinco SKIP preexistentes: `ESTER-0007`, `ESTER-0012`,
`ESTER-0014`, `ESTER-0015` y `ESTER-0016`, en la comprobación de nombre EN exacto
del perfil `hydrocarbon-lab-current-systematic-en-v1`. Son referencias de
calidad `silver`, sin función de oráculo nominal exacto. Sus pruebas de identidad
estructural sí pasan. Las seis referencias nominales nuevas de ésteres se
ejecutan con cinco variantes cada una y no se omiten.

La suite general terminó con código 0 en 4.178,903 segundos. Los snapshots
congelados conservaron sus fixtures y límites originales: el caso Easy pasó
en 41,562 segundos y el de planes v3 de D4 en 79,648 segundos. También pasó el
plan avanzado v4 en tres procesos ES/EN nuevos. No se detectaron regresiones
funcionales en esta ejecución; las limitaciones pendientes son las de cobertura
indicadas arriba y los diagnósticos TypeScript preexistentes.

Los negativos incluyen funciones y ramas omitidas, locantes falsos, padres
incompletos o invertidos, enlaces y átomos extra, valencias/conectividad,
radicales desconocidos, cargas, isótopos, estereoquímica y gramáticas excluidas.
Se comprueban grafos de cada familia dibujados independientemente y fórmulas
con OpenChemLib, además de identidad y numeración del modelo completo.

Reproducción:

```text
node scripts/audit-iupac79-fallback-006.mjs outputs/iupac79-fallback-006/result.json --verify
node --test --test-concurrency=1 tests/iupac79-fallback-006.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npm run build:pages
npm run validate:pages
bash scripts/build-verified.sh
```

En Windows se usó Git Bash para el último comando. Los registros locales están
en `outputs/iupac79-fallback-006/`; la comparación y resultados agregados se
conservan también en `orgorush-iupac79-fallback-006.verification.json`.
La suite general es la selección estándar de `package.json`, 165 archivos de
primer nivel; no incluye los diagnósticos optativos de defectos conocidos bajo
`tests/naming-audit/`.

## Archivos modificados

- `app/iupac1979-aliphatic-functions.ts`: verificación y construcción ES nuevas.
- `app/iupac1979-english-to-spanish.ts`: despacho funcional, sin alterar aminas.
- `tests/helpers/fallback-006.mjs`: 45 referencias nominales por familia.
- `tests/iupac79-fallback-006.test.mjs`: matriz, negativos y contratos de interfaz.
- `scripts/audit-iupac79-fallback-006.mjs`: auditoría reproducible con comprobaciones.
- Este informe y los JSON `.baseline`, `.audit` y `.verification` asociados.
