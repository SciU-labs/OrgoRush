# OrgoRush B6.1 — validación independiente y generalización

La auditoría conservó las cifras de B6.0 y congeló **20 moléculas externas nuevas antes de ejecutar el generador**. La observación ciega revisada detectó **7 FAIL-NAME en 40 perfiles**: tres pérdidas químicas de insaturación en dos idiomas y un orden alfabético EN incorrecto. Se corrigieron sus causas generales tras guardar pruebas rojas. También se corrigieron dos causas de FULL falso en controles adversariales de numeración y sintaxis del benceno libre.

**OPSIN local no pudo ejecutarse: 0 nombres procesados, 0 reconstrucciones externas nuevas, 0 rechazos del parser observados.** No se encontró Java ni OPSIN en PATH ni en las ubicaciones de instalación/caché enumeradas. No se enviaron nombres a otro endpoint o servicio remoto. La limitación es técnica; no es un rechazo químico de los nombres.

El resultado final sobre las 20 moléculas es **12 FULL-INTERNAL-ONLY, 20 PARTIAL-SAFE y 8 UNSUPPORTED-SAFE**. Hay **0 FULL-INDEPENDENTLY-VERIFIED**, **0 fallos demostrados restantes mediante los controles realizados** y **40 perfiles con contrastación completa PENDING-EXTERNAL**. La ausencia de un fallo detectado no demuestra precisión general. PS describe soporte parcial sin fallo detectado dentro de los controles practicados; no garantiza corrección del nombre completo ni de toda explicación posible.

## Evidencias y alcance

* [Matriz de fuentes, 40 perfiles antes/después y revisión española](matrix.md).
* [Auditoría de B6.0 con sus 24 grafos y 48 nombres](b60-independence.md).
* [Corpus inmutable](../../tests/fixtures/b61-independent-reference.json), [acta de congelación](corpus-freeze.json), [recibos PubChem crudos](reference-pool.json).
* [Resultado ciego crudo](blind.json), [adjudicación ciega](blind-reviewed.json), [medición final](final.json), [pruebas rojas](red-tests-complete.log).
* [Inventario local Java/OPSIN](local-toolchain.json), [trabajos preparados sin ejecutar](opsin-manifest.json), [revisión española limitada](spanish-adaptation.json).
* [Regresiones iniciales](regressions.log), [generalización final](generalization-final.log), [seguridad final](safety-final.log), [Chromium consolidado](e2e-final-results.json), [typecheck](typecheck.log), [integridad de alcance](scope-check.json).

## B6.0: línea base, no medida de precisión general

| Evidencia histórica | B6.0 conservado | Nueva medición interna B6.1 |
|---|---|---|
| Corpus original, 15 moléculas / 30 perfiles | 28 FULL / 2 UNSUPPORTED | 28 FULL / 2 UNSUPPORTED; ibuprofeno bloqueado localmente |
| 24 grafos construidos / 48 perfiles | 48 positivos FULL / 1.104 cruces negativos | 48 FULL internos; cruces de B6.0 conservados en regresión |
| Pruebas focalizadas | 299 aprobadas | mismas suites más 45 pruebas B6.1 |
| Chromium histórico | 14 casos / 408 activaciones | se conserva su evidencia; nueva ejecución en directorio B6.1 |


La reconstrucción de FamilyGraph desde el nombre es independiente del análisis concreto del generador, pero comparte tablas del producto y OCL. Los grafos G01–G24 se escribieron tras la gramática, sus expectativas FULL son decisiones del autor, y los blancos E2E se calculan con el propio reconciliador/adapter. Son controles válidos de regresión y proyección; no un segundo parser ni una muestra externa. [Inventario y dependencias completos](b60-independence.md).

## Selección y cronología

El programa de selección no importa el generador ni el reconciliador. Se recuperaron propiedades por **CID público**, sin enviar nombres generados. El pool contiene 44 registros y 12 recibos; un lote HTTP 502 quedó registrado y sus cuatro CIDs no se seleccionaron. No se sustituyeron errores de adquisición por respuestas inventadas.

Primero se excluyeron constituciones ya presentes en SMILES literales de tests/informes anteriores; el inventario inicial contenía 1.692 constituciones. Se escogieron 20 estratos representativos y de frontera, incluidos sistemas que exceden la sintaxis FULL actual. Se congelaron a **2026-11-11T00:52:44.625Z**, SHA-256 **c51a27f2193d7706c289fc348a48febefc19a2617603a0750f20c4beddce7e69**. El resultado ciego revisado se guardó a 2026-11-11T01:02:46.590Z; la medición final es de 2026-11-11T01:11:29.469Z. Las fechas están en UTC (en Santiago aún era 10 de noviembre).

La auditoría ampliada posterior agregó grafos estáticos de átomos/enlaces, sin ejecutar fixtures: 309 constituciones de grafos y 1723 constituciones históricas totales. **Ninguna de las 20 seleccionadas se solapa** en ese inventario ampliado. No se reemplazó ninguna molécula tras conocer resultados. El análisis estático no puede demostrar ausencia de toda estructura generada dinámicamente en cualquier código; su alcance y rutas están en [novelty-expanded.json](novelty-expanded.json).

Cada referencia guarda fuente, SMILES, fórmula, nombre calculado, InChIKey, estereoquímica definida/no definida, recuperación y hash. La fuente no es el generador, pero todas proceden de PubChem: no son varias autoridades independientes entre sí, no son un muestreo aleatorio y no permiten una estimación poblacional de precisión. Las expectativas no se copiaron a producción.

## Observación ciega y adjudicación

| Estado de auditoría | Ciego revisado, 40 perfiles | Final, 40 perfiles |
|---|---|---|
| FULL-INDEPENDENTLY-VERIFIED | 0 | 0 |
| FULL-INTERNAL-ONLY | 12 | 12 |
| PARTIAL-SAFE | 15 | 20 |
| UNSUPPORTED-SAFE | 6 | 8 |
| FAIL-NAME | 7 | 0 |
| FAIL-GRAPH real | 0 | 0 |
| FAIL-REASONING detectado | 0 | 0 |
| PENDING-EXTERNAL de nombre completo (eje adicional) | 33 | 40 |


El primer blind.json confundió la representación textual de fórmulas (por ejemplo C7H4NF / C7H4FN, C4H7OBr / C4H7BrO) con diferencias de composición y marcó 8 FAIL-GRAPH espurios. Se conserva ese archivo. Se corrigió el auditor para comparar mapas elemento→cantidad, se añadió una prueba y se guardó blind-reviewed.json **antes de editar producción**. No hubo 8 fallos del importador ni correcciones ficticias del grafo.

19/20 fuentes entran al editor y conservan identidad canónica completa al exportar/reimportar, incluidos órdenes, cargas y estereoquímica admitida. I16 es rechazo explícito de un sistema puenteado con centros definidos; su fórmula se comprueba leyendo el SMILES fuente directamente con OCL, sin fingir admisión del editor. Esto compara representaciones del grafo fuente con el mismo OCL: no reconstruye un nombre externamente. Antes había nombre local para 17/20 moléculas; ahora para 16/20, porque I15 se bloquea para conservar la barrera estereoquímica.

9 nombres EN finales coinciden literalmente con el nombre de su registro independiente: B61-I01, B61-I02, B61-I03, B61-I04, B61-I05, B61-I06, B61-I09, B61-I18, B61-I20. De ellos, I01–I03 tienen FULL interno; los demás son parciales. Es corroboración finita de parejas nombre–estructura publicadas, **no una ejecución nombre→grafo independiente**. No se penalizan los textos alternativos sólo por diferir de PubChem. No se certifica PIN.

## Fallos, causas y correcciones

| Hallazgo demostrado | Causa general | Corrección y límite |
|---|---|---|
| I08 ES/EN: propilo saturado para radical prop-2-enilo | esterAlkylName utilizaba el árbol sólo si era saturado; el fallback contaba carbonos | Árbol acíclico con órdenes reales y raíz del alcohol; ahora prop-2-en-1-yl. No amplía FULL. |
| I14 ES/EN: metil para =CH2 exocíclico | ringCandidates omitía attachmentOrder al nombrar la rama | Propagar el orden de unión; usar la regla existente metilideno. No amplía FULL. |
| I15 ES/EN: propilo para propenilo E | Radical largo insaturado se reducía a alquilo; el formateador E/Z sólo cubría el progenitor | Conservar sintaxis insaturada de ramas largas; bloquear C–C múltiple estereoespecificado fuera del progenitor hasta poder expresarlo. |
| I07 EN: phenyl antes de hydroxy | Orden ES reutilizado en una construcción acíclica plana | Reordenar prefijos según idioma sólo en construcción de sufijo terminal único completamente reconocida; ES mantiene fenil antes de hidroxi. |
| FULL falso: 2-methoxy-5-methylbenzene | Comparaba reflexión anclada en 1, sin todos los orígenes del anillo libre | Enumerar todos los orígenes y ambos sentidos; comparar conjunto de locantes y orden de cita. |
| FULL falso: 01-methoxy-4-methylbenzene | Enteros permisivos y separador final sin control | Localizador léxico 1–6 y consumo completo sin guion sobrante antes del progenitor. |


Las seis pruebas de seguridad relevantes fueron rojas antes de producción; la prueba del comparador de fórmulas ya pasaba. El log conserva los primeros contraejemplos que fallaron; no se atribuye una medición previa exhaustiva a todos los controles de cada bucle. Los FULL falsos adversariales tenían conectividad compatible pero sintaxis/numeración injustificada: no son FAIL-GRAPH. Ninguno de los 12 FULL emitidos en los 20 registros nuevos fue demostrado incorrecto; tampoco quedó certificado externamente.

Los cambios B6.1 de producción se limitan a page.tsx, systematic-family-grammar.ts y compositional-name-model.ts. No hay CIDs, listas de nombres externos ni excepciones por molécula en esas correcciones. Se conservan los cambios B4/B5/B6 recibidos. Los bloqueos finales I15, I16, I17 e I19 aparecen en ambos idiomas; el ibuprofeno histórico sigue bloqueado localmente y no se confunde con el nombre externo de referencia.

## OPSIN y español

El [repositorio oficial OPSIN](https://github.com/dan2097/opsin) documenta la versión 2.9.0, Java 8+ y el CLI autónomo. Con runtime y JAR oficiales adquiridos como acción separada, puede procesarse el archivo local sin un servicio web:

`java -jar opsin-cli-2.9.0-jar-with-dependencies.jar -osmi reports/b61/opsin-input.txt reports/b61/opsin-output.smi`

Hay 54 trabajos EN preparados (24 construidos B6.0, 14 históricos nombrados y 16 nuevos), todos NOT-RUN-TOOLCHAIN-MISSING. Se requiere registrar versión/hash del binario y capturar advertencias/rechazos/fallos técnicos al ejecutarlos. Un rechazo no probaría automáticamente error de nombre; coincidencia estructural no certificaría PIN. No se instaló Java/OPSIN ni se descargaron ejecutables en esta tarea. La búsqueda local enumera su alcance y no afirma inspeccionar todos los discos.

Los nombres españoles tienen una [revisión manual de adaptación](spanish-adaptation.json) basada en la [guía RSEQ/IUPAC](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf), §§3e (orden alfabético), 5.4 (insaturación), 7c–f (localizadores) y 8 (ésteres con «de»). La [Blue Book P-59.2.5](https://iupac.qmul.ac.uk/BlueBook/P5.html#P5925) respalda el desempate por prefijos y orden de cita. Son reglas publicadas independientes del producto; su aplicación manual sigue siendo acotada. No existe aquí un oráculo de nombre completo español y no se utiliza OPSIN para certificar español ni un traductor ES→EN como verificador independiente.

## Pruebas e invariancia

Los 15 controles químicos/sintácticos nuevos distinguen nombre equivalente, isómero distinto, mala sintaxis y nombre válido fuera de cobertura. Dos omisiones válidas del C1 de cetona cíclica se aceptan; isómeros de igual fórmula (N-etil / etil del anillo) se rechazan por conectividad. Hay cambios de función, rama, halógeno, enlace simple/doble, posición de insaturación, anillo/cadena y locantes internos.

Se prueban **1.080 rotulaciones aromáticas** (seis grupos, tres distancias, dos idiomas y 30 pares orientados de locantes) con una expectativa cerrada para dos prefijos distintos, sin llamar al algoritmo de rotación como oráculo. Incluyen negativos y positivos, y no son 1.080 moléculas externas nuevas.

Los 20 registros tienen pruebas de IDs permutados, orden/orientación de enlaces, rotación de coordenadas, orden de metadatos de anillo, ES→EN→ES y exportación/reimportación. Para los 19 admitidos se conserva identidad canónica con estereoquímica, nombres y correspondencia de blancos/locantes; I16 conserva el rechazo explícito. Los blancos se contrastan por identidad remapeada y existencia de enlaces/átomos; esto demuestra consistencia, no verdad química externa de cada explicación. La carga formal editada invalida caché; aromaticidad Kekulé se normaliza por OCL.

| Verificación final | Resultado |
|---|---|
| Suites focalizadas B4.1/B4.2, B5.0–B5.5, B6.0, V008/014 y AUD-NOM-005 | 299/299 históricas aprobadas; no se repitieron tras cambios sólo del arnés B6.1 |
| Invocación conjunta inicial B6.1 + históricas | 336/344; 8 fallos conservados: 7 por timeout Vite del hook y 1 por exigir orientación única en simetría |
| Verificación B6.1 final | 38/38 generalización y 7/7 seguridad; 344 pruebas distintas con última verificación aprobada, combinando ejecuciones |
| B6.1 nuevas | 7 pruebas de seguridad + 38 de generalización; sus bucles incluyen 1.080 rotulaciones |
| Chromium | 14/19 iniciales, 4/5 al repetir y 1/1 en el último caso aislado: 19/19 casos distintos aprobados; 450 activaciones FULL sin duplicar intentos; versión 140.0.7339.186 |
| TypeScript | npm run typecheck: PASS |
| Espacios/conflictos | git diff --check: véase diff-check.log |
| Integridad | Hashes de B6.0, fixtures históricos, workflows y módulos recibidos: scope-check.json |


La ejecución Chromium vuelve a cubrir los 14 casos históricos y dos FULL nuevos, más tres nombres parcialmente admitidos corregidos. Comprueba ES/EN, activación por ratón/teclado, destinos/locantes, limpieza de selecciones y geometría. La primera ejecución tuvo 14 aprobados y cinco fallos de arnés: dos lecturas del estado temporal de aria-pressed y tres expectativas de atributo PARTIAL ausente en esa vista local. Se repitieron únicamente esos cinco: cuatro pasaron y el caso nitro volvió a fallar al consultar la selección después de la pulsación. Como el resaltado dura dos segundos, el arnés final instala un observador DOM antes de la entrada real y exige ver simultáneamente aria-pressed y los átomos/enlaces/locantes exactos durante su vida visible. No pausa temporizadores, repite clics ni fabrica estados del producto. El nitro aislado pasó así sus cuatro ciclos de idioma; las latencias de observación están en e2e-nitro-final/results.json. No se atribuye al producto un defecto de selección persistente a partir de una lectura tardía de un estado transitorio.

Las vistas parciales conservan su atributo real (ausente o PARTIAL) y se exige que no afirmen FULL ni tengan un nombre completo validado. No se cambió producción para acomodar el test; tampoco se exige que el código de auditoría PS sea un atributo de interfaz.

Un intento intermedio con HMR/WebSocket desactivados rompió la conexión del cliente Vite y produjo cinco timeouts técnicos; se descartó esa configuración y se restauró exactamente la del servidor original. Sus errores repetidos se conservan comprimidos sin pérdida en e2e-retest/results.json.gz, con resumen y hash en e2e-retest/infrastructure-summary.json; no se cuentan como fallos químicos ni como pruebas aprobadas. La ejecución final mantiene HMR normal y no se edita producción durante los casos. Se conservan los intentos y se consolida la última observación por CID, sin fingir una sola ejecución 19/19.

Sus oráculos visuales internos están declarados como tales. Las peticiones opcionales externas se interceptan con metadatos vacíos; no se fabrican nombres ni FULL. Las pruebas históricas que mencionan OPSIN consumen snapshots preexistentes y no cuentan como nuevas ejecuciones de OPSIN local. No se ejecutó la batería completa.

Una primera ejecución del test de trazabilidad falló por pedir fórmula al importador editable del puenteado I16; se corrigió el test para leer la fuente con OCL, manteniendo el rechazo y sin cambiar producción. generalization-tests.log conserva ese fallo. Otra ejecución exigía idénticos IDs al invertir un anillo simétrico con sustituyentes repetidos: partial-invariance-red.log conserva el contraejemplo. El test ahora exige una única isomorfía del grafo completo que explique conjuntamente todos los blancos y localizadores; no admite equivalencias diferentes por fragmento. Pasó en los 20 registros. La invocación conjunta tuvo además un timeout Vite de 60 s cargando practice-question.ts en el hook de las siete pruebas de seguridad; se repitió esa suite sin modificar sus expectativas. Los dos controles de desplazamiento C=C entre C2/C3 incluyen positivos de su propio isómero y negativos cruzados con igual fórmula/función. Los logs de verificaciones finales son la autoridad sobre su resultado.

## Límites y prioridades B6.2

1. Ejecutar los trabajos EN con una distribución oficial OPSIN local y conservar versión, hashes, salida cruda y advertencias. Comparar grafos completos, fórmula, cargas, órdenes y estereoquímica; contabilizar sólo las equivalencias realmente reconstruidas.
2. Resolver la expresión y validación de E/Z en ramas antes de desbloquear I15. Tratar por separado policiclos puenteados y paridad tetraédrica; no eliminar especificación para lograr soporte.
3. Ampliar referencias completas ES con una fuente compatible y revisión química. Mantener separada la adaptación lingüística de la demostración nombre→grafo.
4. Validar los nombres parciales y los alternativos aún pendientes, especialmente ésteres insaturados, metilidenos, amidas N-sustituidas y funciones combinadas. No incrementar FULL sólo por coincidencia textual.
5. Repetir selección previa con más de una fuente externa y estratos fuera de la gramática; mantener estos 20 como regresión observada, no como otra muestra ciega para futuras adaptaciones.

No hubo commit, push, modificación de dependencias, workflows ni baselines históricos. No se usó OneDrive. El expediente preserva la evidencia negativa y las limitaciones técnicas en lugar de convertirlas en PASS externos.
