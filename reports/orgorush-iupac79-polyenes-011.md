# ORGORUSH-IUPAC79-POLYENES-011

Fecha: 24 de octubre de 2026. Base: `main`, `6a11752bde9ab174fd4e3092e3f7ac25958c9b54`, árbol inicialmente limpio. Trabajo local, sin commit, push ni despliegue.

## Defecto y causa demostrada

Para `C=CC=C`, antes de modificar fuentes se capturó la ruta real de resolución (`outputs/polyenes-011/before.json`):

| Dato | Resultado anterior |
|---|---|
| Blue Book 2013 ES | `buta-1,3-dieno` |
| Legacy 1979 EN | `1,3-butadiene` |
| Legacy 1979 ES | `-`, presentado como «No disponible para esta estructura» |
| Padre / carbonos | átomos `[1,2,3,4]` / 4 |
| Localizadores C=C / C≡C | `[1,3]` / `[]` |
| Sustituyentes / funciones | `[]` / `[]` |
| Entrada española nativa | `buta-1,3-dieno` |
| Modelo inglés | `chain`, C4, mismos átomos y localizadores |
| Disponibilidad química | `true` |
| Resolución española | `UNSUPPORTED`, `aliphatic-functional-model-does-not-prove-complete-graph-and-numbering` |

`formatIupac1979SpanishName()` agotaba sus alternativas: el formateador compartido sólo reconocía una insaturación acíclica, y `formatSpanish1979Extension()` carecía de la construcción raíz + a + lista de localizadores + multiplicador + eno. El modelo molecular estaba completo. Después, `translateLegacyEnglishToSpanish()` dirigía las cadenas sin amina al verificador de cadenas **funcionalizadas y saturadas**; éste rechazaba correctamente un hidrocarburo sin funciones y con dos C=C. No hubo pérdida de átomos ni de localizadores: faltaba gramática española nativa, seguida de un fallback deliberadamente fuera de cobertura.

La captura también mostró un defecto pedagógico delimitado: Legacy EN enlazaba `but`, pero dejaba `1,3-` y `adiene` sin evidencia de insaturación.

## Verificación normativa

1. IUPAC, *Nomenclature of Organic Chemistry*, edición 1979, Pergamon Press, Oxford, sección A, [A-3.1 y A-3.4, reproducción autorizada por ACD](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm). A-3.1 establece las terminaciones multiplicadas con vocal `a`, conserva cada posición de C=C y exige los menores localizadores. Los ejemplos históricos anteponen los números al padre. A-3.4 prioriza el número de enlaces múltiples y después la longitud; conserva las reglas de sustitución de alcanos. Esta es la autoridad histórica, no la salida del programa.
2. Misma edición, [A-2.2–A-2.6](https://www.acdlabs.com/iupac/nomenclature/79/r79_36.htm): comparación término a término de localizadores, orden alfabético, multiplicación de sustituyentes y desempates. Se reutilizan las implementaciones existentes, sin modificar la selección ni la numeración.
3. [IUPAC/RSEQ, Guía breve española, tablas 1–2 y §5.4](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf): vocabulario español de raíces, `en(o)` y multiplicadores `di`, `tri`, `tetra`, `penta`, `hexa`, `hepta`, `octa`. Se utiliza como respaldo léxico; sus criterios modernos no sustituyen los de 1979.
4. [Diario Oficial de la Unión Europea, L144/99, 30-04-2004](https://www.boe.es/doue/2004/144/L00078-00129.pdf): asocia explícitamente `CH₂=CH–CH=CH₂` con el nombre IUPAC español `1,3-butadieno`. [BOE-A-2004-14246](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2004-14246) corrobora ambas grafías españolas, histórica y moderna, para CAS 106-99-0. Es corroboración independiente de la forma española, no una nueva regla de selección.
5. [IUPAC, recomendaciones 1993, RC-80.1](https://iupac.qmul.ac.uk/ions/RC80.html): documenta el cambio hacia localizadores inmediatamente anteriores al sufijo y distingue expresamente la práctica de 1979. La presentación histórica no se obtiene aplicando los criterios modernos de selección.

Los cuatro ejemplos solicitados se derivaron de A-3.1/A-3.4 con el léxico español contrastado: C4 y posiciones 1,3; C5 y posiciones 1,4; C6 y posiciones 1,3,5; y el padre C4 con metilo en C2. Salvo el butadieno, no se afirma que cada expectativa sea un ejemplo literalmente impreso en la norma. El resto del corpus es igualmente **derivado de reglas**, con un lector SMILES y enumerador de rutas independientes para verificar la estructura y el padre histórico. No se consultó OrgoRush como autoridad normativa.

## Implementación y alcance

- `app/nomenclature-conventions.ts`: gramática acíclica completa para `di`–`octa`, raíces compartidas del proyecto y la secuencia de sustituyentes simples ya implementada. Comprueba multiplicidad, posiciones crecientes y límites de la cadena; mantiene la vocal `a`. No acepta coincidencias parciales ni multiplicadores numéricos inventados.
- `app/iupac1979-english-to-spanish.ts`: prueba estructural específica para la nueva ruta nativa. Reconstruye todos los carbonos, enlaces y sustituyentes alquilo mediante `legacyPrefixTerm`, `attachLegacyFragment` y `legacyGraphsIdentical`. Fija la correspondencia de átomos del padre: cada localizador debe coincidir con su enlace real. Comprueba valencia, neutralidad, número total de C=C, ausencia de C≡C y funciones, y cobertura completa del grafo. La identidad rechaza desconexiones, ciclos y partes omitidas. No se amplía el fallback EN → ES.
- `app/page.tsx`: aplica esa prueba al nuevo subconjunto de polienos acíclicos y a cualquier nombre fuente que reclame esa nueva gramática, aunque venga asociado al análisis de otra familia. Exige que el nombre fuente corresponda al análisis y que su prefijo estereoquímico coincida con el ya calculado desde el grafo. La explicación Legacy identifica el alcano de referencia y la sustitución histórica de la terminación.
- `app/reasoning-name-fragments.ts`: reconoce los localizadores históricos y reutiliza la evidencia multiplicativa para vincular el morfema común a todos los C=C. El caso acíclico adicional está condicionado al perfil Legacy; los fragmentos 2013 conservan su comportamiento.
- `tests/fixtures/orgorush-iupac79-polyenes-011.mjs`, `tests/orgorush-iupac79-polyenes-011.test.mjs`: corpus nuevo, verificaciones estructurales, tres perfiles, variantes de grafo, E/Z, pedagogía y rechazos.
- `tests/orgorush-validation-008.test.mjs`: actualiza exclusivamente el estado de cobertura de V008-012, V008-013 y V008-069; sus expectativas químicas originales permanecen intactas.
- `scripts/polyenes-011-verify.mjs`: compara la nueva auditoría con FIX-009, conserva los 195 positivos, todos los datos de referencia y los hashes de JavaScript protegidos por QUALITY-010; sólo permite las tres ampliaciones y su proyección pedagógica Legacy EN.
- Este informe.

No se cambian el analizador, los criterios de selección de padres, el formateador 2013, la generación inglesa, el motor estereoquímico, PubChem, la localización externa, Practice/Exam, dependencias ni configuración TypeScript.

El límite de multiplicidad es ocho C=C, correspondiente a la representación nativa actual. La gramática reutiliza raíces C1–C100, pero cada estructura sigue sometida a los límites existentes del analizador y de la identidad completa. El corpus positivo alcanza C30 y ocho dobles enlaces. Los sustituyentes recién habilitados son los alquilos simples ya expresables por la gramática española; no se generaliza a radicales complejos, familias funcionales, nuevos ciclos o policiclos.

## Resultados de los tres perfiles y matriz

La matriz completa antes/después se captura mediante `outputs/polyenes-011/matrix.mjs`, que carga las cuatro fuentes originales directamente desde `HEAD` con un plugin Vite de sólo lectura y después carga las fuentes actuales. No modifica el checkout. Resultado: `outputs/polyenes-011/matrix.json`.

| SMILES | Blue Book 2013 ES conservado | Legacy 1979 ES | Legacy 1979 EN |
|---|---|---|---|
| `C=CC=C` | buta-1,3-dieno | 1,3-butadieno | 1,3-butadiene |
| `C=CCC=C` | penta-1,4-dieno | 1,4-pentadieno | 1,4-pentadiene |
| `C=CCCCC=C` | hepta-1,6-dieno | 1,6-heptadieno | 1,6-heptadiene |
| `C=CCC(CCC)CC=C` | 4-propilhepta-1,6-dieno | 4-propil-1,6-heptadieno | 4-propyl-1,6-heptadiene |
| `C=CC=CC=C` | hexa-1,3,5-trieno | 1,3,5-hexatrieno | 1,3,5-hexatriene |
| `C=C(C)C=C` | 2-metilbuta-1,3-dieno | 2-metil-1,3-butadieno | 2-methyl-1,3-butadiene |
| `CC=CC=CC` | hexa-2,4-dieno | 2,4-hexadieno | 2,4-hexadiene |
| `CCC=CC=CCC` | octa-3,5-dieno | 3,5-octadieno | 3,5-octadiene |
| `C=CC=CCC=C` / `C=CCC=CC=C` | hepta-1,3,6-trieno | 1,3,6-heptatrieno | 1,3,6-heptatriene |
| `C=CC(CC)=C` | 3-metilpent-1-eno † | 2-etil-1,3-butadieno | 2-ethyl-1,3-butadiene |
| `C=CCC(CC)C=C` | 3-etilhexa-1,5-dieno | 3-etil-1,5-hexadieno | 3-ethyl-1,5-hexadiene |
| `C=CC(C)=CC=C` | 3-metilhexa-1,3,5-trieno | 3-metil-1,3,5-hexatrieno | 3-methyl-1,3,5-hexatriene |
| `C=CC(C)(C)C=C` | 3,3-dimetilpenta-1,4-dieno | 3,3-dimetil-1,4-pentadieno | 3,3-dimethyl-1,4-pentadiene |
| `C=C(C)C(C)=C` | 2,3-dimetilbuta-1,3-dieno | 2,3-dimetil-1,3-butadieno | 2,3-dimethyl-1,3-butadiene |
| `C=CC(CCCC)=C` | 3-metilhept-1-eno † | 2-butil-1,3-butadieno | 2-butyl-1,3-butadiene |
| `C=C=C` | propa-1,2-dieno | 1,2-propadieno | 1,2-propadiene |
| `C=CC=CC=CC=C` | octa-1,3,5,7-tetraeno | 1,3,5,7-octatetraeno | 1,3,5,7-octatetraene |
| `C=CC=CC=CC=CC=C` | deca-1,3,5,7,9-pentaeno | 1,3,5,7,9-decapentaeno | 1,3,5,7,9-decapentaene |
| `C=CC=CC=CC=CC=CC=C` | dodeca-1,3,5,7,9,11-hexaeno | 1,3,5,7,9,11-dodecahexaeno | 1,3,5,7,9,11-dodecahexaene |
| `C=CC=CC=CC=CC=CC=CC=C` | tetradeca-1,3,5,7,9,11,13-heptaeno | 1,3,5,7,9,11,13-tetradecaheptaeno | 1,3,5,7,9,11,13-tetradecaheptaene |
| `C=CC=CC=CC=CC=CC=CC=CC=C` | hexadeca-1,3,5,7,9,11,13,15-octaeno | 1,3,5,7,9,11,13,15-hexadecaoctaeno | 1,3,5,7,9,11,13,15-hexadecaoctaene |
| `C=CC=C` + 26 carbonos simples | triaconta-1,3-dieno | 1,3-triacontadieno | 1,3-triacontadiene |

† Son salidas preexistentes del perfil 2013: omiten la insaturación del grupo lateral `=CH₂`. Se registran como **baseline de conservación**, sin avalarlas como expectativas normativas. El análisis y formateador 2013 no se modifican en esta tarea. Los respectivos padres históricos sí contienen ambos C=C y generan nombres completos, comprobados por identidad del grafo. No se oculta esta limitación ni se corrige fuera del alcance autorizado.

Se comprueban además `(2E,4E)` y `(2Z,4Z)` de hexa-2,4-dieno en los tres perfiles, conservando los descriptores existentes; el motor estereoquímico no cambia.

## «Cómo se obtiene» y controles negativos

En ambos idiomas Legacy, el butadieno identifica cuatro carbonos, raíz `but`, alcano `butano`/`butane`, dos C=C en C1=C2 y C3=C4, numeración equivalente en ambos sentidos y terminación histórica de A-3.1. El fragmento `1` apunta al primer C=C, `3` al segundo y `dien` a ambos. Su explicación contextual separa `di` (dos) y `en` (C=C). Cada fragmento es una subcadena literal del nombre mostrado; los enlaces reconstruyen ese nombre exactamente y apuntan a átomos y enlaces existentes. La explicación de 2013 sigue su ruta previa.

Cada caso positivo verifica las tres salidas, el padre mediante el enumerador independiente, la identidad antes/después de exportar, cambios de IDs, inversión del almacenamiento, reflexión del dibujo y ausencia de mutaciones por las proyecciones pedagógicas. Los dos SMILES del heptatrieno representan el mismo grafo con ordenaciones distintas. Se cubren conjugación, aislamiento, acumulación, simetría, extremos e interiores, ramificación y selección histórica de un padre más corto con más enlaces múltiples.

Los controles rechazan grafos desconectados, valencias inválidas, cargas, ciclos y funciones frente al modelo de polieno, C≡C o C=C omitidos, posiciones repetidas o incorrectas, átomos del padre incongruentes, sustituyentes inventados y discrepancias entre nombre y grafo. Se prueba expresamente que suministrar `buta-1,3-dieno` junto con un alcano, monoeno, ciclo o alcohol no publica ese nombre falso. Un prefijo estereoquímico inventado tampoco habilita la ruta nativa. `C=C(C=C)C=C` permanece sin nombre español Legacy porque una insaturación está en un radical que esta ampliación no representa. El nonaeno C18 permanece `UNSUPPORTED`; no se convierte un número en un multiplicador supuesto. La cobertura cíclica anterior no se reclasifica como no disponible.

## Validación técnica

La validación se registra en `outputs/polyenes-011/validate.ps1`, `results.json`, `source-hashes.json`, los manifiestos de reanudación y los resultados individuales de `per-file/`. Las fuentes de producción permanecen congeladas mediante SHA-256; la única modificación posterior es una corrección de la aserción del ledger en `tests/orgorush-validation-008.test.mjs`, con repetición íntegra de ese archivo y registro de su hash final.

| Comprobación | Resultado |
|---|---|
| `npm run typecheck -- --pretty false` | Cero diagnósticos; salida 0; `strict` conservado |
| Pruebas dirigidas POLYENES-011, LOCALIZATION-012 y QUALITY-010 | 40 PASS, 0 FAIL, 0 SKIP; salida 0; 27 pruebas nuevas de polienos |
| Auditoría VALIDATION-008 y comparación con FIX-009 | 72 estructuras, dos ordenaciones, 432 observaciones: 195 positivos conservados y tres ampliaciones explícitas; 198 PASS, 16 UNSUPPORTED, 2 PENDING-REFERENCE por estructura/perfil; modo estricto respaldado exitoso |
| Comparación con fuentes originales de `HEAD` | 23 casos positivos; nombres 2013 ES/EN e históricos EN, padres, posiciones y sustituyentes idénticos; ES pasa de no disponible a la forma verificada |
| Pages | `npm run build:pages` y `npm run validate:pages`: salida 0 |
| Sites | `scripts/build-verified.sh`: compilación y validador del Worker ESM `default.fetch` y manifiesto de hosting, salida 0 tras repetir fuera del sandbox |
| Archivo VALIDATION-008 tras corregir el ledger | Repetición completa: 77 PASS, 0 FAIL, 0 SKIP; salida 0 |
| Suite general | 171 archivos verificados por bloques; 3.090 pruebas: 3.085 PASS, 0 FAIL y las mismas 5 SKIP preexistentes; cierre agregado con salida 0 |

La primera invocación de Sites se detuvo al **iniciar Git Bash**, antes de ejecutar el compilador: Windows denegó la creación de un objeto MSYS (`NtCreateDirectoryObject`, `0xC0000022`, salida `-1073741502`). Se repitió exactamente el script existente fuera del sandbox, con autorización de ejecución; terminó con salida 0, sin ampliar el límite original de tres minutos. El bloqueo del entorno y el resultado exitoso de la repetición quedan registrados por separado en `build-sites-sandbox-launch.log`, `build-sites-retry.log` y `sites-retry.result.json`. No se atribuye ese bloqueo a la química ni a la compilación.

La primera ejecución general dentro del sandbox se interrumpió durante la revisión final para reforzar el rechazo de nombres fuente asociados a otras familias. Se conserva íntegra en `full-suite-interrupted.log`, con tres fallos señalados en pruebas de procesos nuevos (límites originales de 60, 60 y 30 segundos); al estar incompleta, no se usa como certificación ni como recuento global. No llegó a emitir las trazas finales de esos fallos y no se los presenta como diferencias químicas confirmadas. Tras aprobar las 27 pruebas dirigidas con la guarda reforzada, se inició nuevamente toda la validación fuera del sandbox, con autorización y con los mismos comandos, secuencialidad y límites de tiempo. Las fuentes de esta segunda ejecución se congelan y verifican por separado.

La sesión de esa ejecución final dejó de estar activa tras completar 41 archivos (566 pruebas aprobadas) y al iniciar `difficulty-intermediate.test.mjs`; no hubo resumen final. El registro original se conserva en `full-suite-final-interrupted.log`. Al retomar, se verificaron nuevamente el commit y todos los hashes de fuentes, sin cambios. Se volvió a ejecutar **entero** el archivo interrumpido y se continuó con los 129 restantes, conservando el orden y `--test-concurrency=1`. `resume-manifest.json` registra ese inventario y `full-suite-prefix.log` conserva los resultados completos anteriores al archivo interrumpido.

El segundo bloque también se interrumpió, después de los 73 archivos desde `difficulty-intermediate.test.mjs` hasta `practice-attempt.test.mjs` y durante `practice-build-session.test.mjs`. Se conserva `full-suite-resume.log`; `full-suite-prefix2.log` excluye por completo ese último archivo. La nueva reanudación ejecuta íntegros los 57 archivos pendientes, en el mismo orden y con concurrencia uno, guardando para cada uno su log, salida real y hash en `per-file/`. `resume-final-manifest.json` permite comprobar la cobertura exacta de los 171 archivos mediante 41 + 73 + 57, sin contar dos veces los resultados parciales.

El segundo bloque detectó una expectativa obsoleta en el último test del ledger VALIDATION-008: seguía exigiendo `UNSUPPORTED` para los tres polienos recién verificados. Las 72 pruebas químicas de ese archivo aprobaron. La corrección del test reconoce exclusivamente V008-012, V008-013 y V008-069 en ES, exige sus nombres originales y compara su análisis con la estructura histórica EN archivada. Una primera repetición completa señaló además la diferencia entre una propiedad `undefined` en memoria y su ausencia en el JSON archivado; se normalizó únicamente esa representación al comparar. Este resultado fallido se conserva en `ledger-repair-first.log` y `ledger-repair-first.result.json`. No se cambian referencias, código de producción ni límites de tiempo para resolver estas aserciones.

La comprobación de cierre `verify-complete.mjs` exige que la repetición final del archivo contenga exactamente los mismos 77 nombres de prueba y que aprueben todos; sustituye el resultado del archivo entero al agregar la suite. Conserva los fallos originales como incidencias resueltas, verifica los hashes de las otras siete fuentes y el hash final del test repetido, y comprueba individualmente que las cinco omisiones coincidan con las anteriores. El resultado agregado corresponde a los archivos finales verificados, sin presentar ninguna ejecución interrumpida como una ejecución continua exitosa.

**Cierre comprobado:** `node outputs/polyenes-011/verify-complete.mjs` terminó con salida 0 y generó `summary.json`: 3.090 pruebas únicas, 3.085 aprobadas, cero fallos y cinco omisiones idénticas a las anteriores. Los 57 archivos del último bloque terminaron individualmente con salida 0. La repetición final del ledger aprobó sus 77 pruebas con salida 0; su hash SHA-256 final y sus tiempos reales constan en `per-file/orgorush-validation-008.test.mjs.result.json`. Las cuatro fuentes de producción, el comparador y los dos archivos nuevos de pruebas conservan los hashes de la validación de TypeScript y de ambas compilaciones. `git diff --check` no detectó errores; `HEAD` permanece en el commit inicial, sin commit ni push.

Los informes y fixtures originales de VALIDATION-008/FIX-009/QUALITY-010 y LOCALIZATION-012 se conservan. El verificador histórico `quality-010-verify.mjs` exige igualdad literal con la cobertura anterior, por lo que no se presenta como aplicable sin cambios a una ampliación deliberada: el nuevo comparador delimita expresamente las únicas diferencias admitidas y verifica también sus hashes de JavaScript protegidos. No se reescriben sus archivos ni sus resultados históricos.

## Limitaciones mantenidas

Fuera de cobertura: nueve o más C=C en el perfil español nativo, sustituyentes no expresables por su gramática completa, insaturaciones laterales omitidas por el modelo, nuevas familias funcionales y nuevos sistemas cíclicos/policíclicos. Las dos referencias históricas pendientes y las omisiones anteriores de la suite no se promueven a PASS. Las dos salidas 2013 señaladas con † quedan documentadas y conservadas.
