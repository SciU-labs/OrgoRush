# OrgoRush B6.0 — derivación composicional bilingüe

La intervención amplía el reconciliador a **28 perfiles locales FULL de 30** del
corpus histórico. Ibuprofeno conserva sus dos perfiles locales UNSUPPORTED.
La medición inicial del árbol recibido fue **16 FULL, 12 PARTIAL y 2 UNSUPPORTED**:
los dos FULL españoles de B5.5 ya estaban implementados. Por tanto, B6 agrega
**12 derivaciones independientes**, correspondientes a seis moléculas en dos
idiomas; el aumento respecto de la referencia histórica B5.4 de 14 FULL es 14.
No se atribuyen a esta intervención los dos avances preexistentes de B5.5.

La entrega incluye:

* [Matriz de las quince moléculas y ambos idiomas](matrix.md).
* [Medición inicial](initial.json), [medición final con grafos y correspondencias](final.json)
  y [cobertura cuantitativa](coverage.json).
* [Corpus nuevo de 24 estructuras construidas](generalization.md).
* [Resultados reales de Chromium](e2e/results.json), [regresiones](regressions.log)
  y [typecheck](typecheck.log).
* [Dependencias examinadas antes de modificar el motor](architecture-before.md)
  y [estado local recibido](preexisting-files.json).

## A. Arquitectura y demostración

El problema era una gramática de verificación más estrecha que el generador:
progenitores que el generador ya nombraba carecían de reconstrucción independiente.
La solución extiende FamilyGraph, que ya separaba el nombre interpretado del
grafo original. No se sustituyó el generador ni se trasladó su análisis como prueba.

`compositional-name-model.ts` reúne los tipos compartidos de componentes, función
principal, representación de familia y evidencia. Su único import es de tipos
del grafo. `validated-name-derivation.ts` sigue reexportando NameComponent para
conservar los imports existentes; no hay una dependencia circular nueva entre
el modelo compartido y el reconciliador.

La capa lingüística mantiene el nombre activo, idioma, tramos literales y orden
de cita. La gramática consume localizadores y delimitadores emparejados; no borra
paréntesis ni traduce un nombre incorrecto para hacerlo aceptable. Los paréntesis
se verifican durante el análisis acotado, sin introducir un AST universal nuevo.
La capa química contiene átomos, cargas, enlaces, padre, función y componentes.
Los localizadores del padre y la numeración interna de ramas se almacenan
separadamente. Los controles internos nunca alimentan el mapa global del anillo.

La capa de prueba conserva reglas normativas, los dos candidatos de numeración,
su comparación, el grafo reconstruido y el mapa entre sus átomos y los originales.
`source: active-name` y el idioma identifican el origen de esta evidencia.
La política estereoquímica queda declarada como `unspecified-only`.

El reconciliador recibe el nombre activo y construye primero un grafo nuevo desde
sus términos, sin acceso al análisis que generó ese nombre. Después utiliza el
comparador existente de `structural-derivation.ts`. Este valida valencias y
compara el número de átomos y enlaces, elementos, cargas, hidrógenos implícitos,
adyacencias y órdenes de enlace. OCL normaliza la aromaticidad, permitiendo
representaciones Kekulé equivalentes. La pertenencia a ciclos queda preservada
por la isomorfía de la conectividad completa; los metadatos `rings` del editor no
deciden identidad. Ni fórmula ni igualdad textual de SMILES bastan para aprobar.
Los IDs y las coordenadas originales se conservan: solo se proyecta el mapa.

La búsqueda de correspondencias es acotada y falla conservadoramente si se agota
o si una región química nombrada tiene imágenes incompatibles. Para un anillo
con numeración demostrada se admite una asignación representativa entre
orientaciones químicamente equivalentes. Esto no permite mezclar la numeración
de dos orientaciones: cada mapa es una asignación completa. No se relaja la
equivalencia de las regiones nombradas. Los átomos estereogénicos explícitos y
los metadatos isotópicos no soportados siguen impidiendo FULL.

FULL requiere simultáneamente gramática admitida, prioridad y numeración
justificadas, tramos literales válidos, cobertura de los átomos y equivalencia
del grafo completo. El contrato de fallo continúa siendo null en el reconciliador
y `unverified` o `profile-mismatch` en el resolvedor. El respaldo estructural
puede seguir siendo PARTIAL; una construcción insuficiente no se promociona.
`preferred` permanece false: ni el éxito del reconciliador ni un nombre calculado
por PubChem constituyen certificación PIN.

### Familias implementadas

**Aldehídos y ésteres aromáticos.** Se conserva B5.5 y se incorpora su evidencia
al modelo común. ES y EN se analizan directamente, con sus propios tramos.
El éster distingue el metilo del anillo del radical unido a O; su carbonilo,
oxígeno de enlace y conexión al anillo se reconstruyen expresamente.

**Anilina, benzamida y benzonitrilo.** Comparten el mismo constructor de benceno,
análisis de prefijos y comparación de sentidos. Solo varía el grupo funcional:
anillo–NH2, anillo–C(=O)NH2 o anillo–C≡N. La anilina no admite aquí prefijos con
funciones que desplacen a la amina ni poliaminas; las nuevas amidas son primarias.
No existen verificadores separados por CID.

**Alcoholes y cetonas monocíclicos.** Una gramática compartida admite ciclos de
3–8 carbonos con una función por sufijo y ramas carbonadas acíclicas del repertorio
verificado. C1 lo fija la función. Se compara la insaturación antes del conjunto
de prefijos y, en empate, el orden de cita. La rama 1-metilvinil/1-methylethenyl
construye su doble enlace explícito, sin depender de IDs del grafo de entrada.
La carvona tiene tres dobles enlaces: C=O, C2=C3 y el de la rama; cada uno tiene
evidencia y destino seleccionable. Se aceptan también las formas explícitas
`cyclohexan-1-one` y `cyclohexan-1-ol` pertinentes a los controles.

### Fundamento normativo consultado

Se usaron fuentes primarias, no nombres calculados como autoridad de preferencia:

| Responsabilidad | Secciones Blue Book |
|---|---|
| Padre con función en un ciclo y numeración de ramas | [P-59.2.1.4 y P-59.2.1.8](https://iupac.qmul.ac.uk/BlueBook/P5.html#P59214) |
| Sufijo, insaturaciones y desempates de prefijos | [P-59.2.3–P-59.2.5](https://iupac.qmul.ac.uk/BlueBook/P5.html#P5923) |
| Anilina; alcoholes; cetonas; ésteres simples | [P-62.2.1.1.1, P-63.1.2, P-64.2, P-65.6.3.3.1](https://iupac.qmul.ac.uk/BlueBook/P6.html) |
| Benzamida, benzonitrilo y benzaldehído retenidos | [P-66.1.1.1.2, P-66.5.1.2.1, P-66.6.1.2.1](https://iupac.qmul.ac.uk/BlueBook/P6a.html) |

La evidencia identifica la regla aplicada a esta construcción finita. No demuestra
todos los padres o todos los nombres posibles de una molécula, ni configura una
certificación general de PIN en español o inglés.

## B. Matriz del corpus de aceptación

[matrix.md](matrix.md) contiene las quince filas, nombres ES/EN, estados antes y
después, reconstrucción, padre, numeración, función, sustituyentes, controles,
pruebas y limitaciones. No se omite ibuprofeno. Para él se distingue el nombre de
referencia del nombre local deliberadamente ausente. El reconciliador externo
histórico y el permiso del generador local siguen siendo decisiones distintas.

## C. Cobertura y defectos

| Medida | Inicial ejecutado | Final |
|---|---:|---:|
| Estructuras importadas | 15 | 15 |
| Moléculas con nombre local | 14 | 14 |
| Perfiles FULL | 16 | 28 |
| Perfiles PARTIAL del corpus local | 12 | 0 |
| Perfiles UNSUPPORTED del corpus local | 2 | 2 |
| Nuevas derivaciones desde el inicio | — | 12 |
| Moléculas con pruebas nuevas de interfaz ES/EN | — | 14 |

Los seis déficits de familia medidos al inicio (tres retenidos y tres alicíclicos)
quedan cubiertos en ambos idiomas. Son ampliaciones de evidencia; no se presentan
como doce errores del generador. No se detectó un nombre local químicamente
incorrecto nuevo en los quince casos.

Se detectó y corrigió **un defecto pedagógico preexistente**: el orden alfabético
de carvona mostraba el sinónimo histórico inglés methylvinyl mientras el nombre
activo contenía methylethenyl. Ahora esa presentación se deriva de los componentes
del nombre verificado y tiene una regresión ES/EN. Durante la implementación una
prueba adversarial detectó **un exceso de alcance**: se permitía una rama fenilo
en la nueva gramática alicíclica. Se restringió a árboles carbonados; el rechazo
explícito permanece probado. Ninguno de estos hallazgos se ocultó modificando
baselines, reglas FULL/PARTIAL/UNSUPPORTED o registros históricos.

El detalle de activaciones, estados de idioma y navegador está en coverage.json.
La ejecución definitiva contiene **408 activaciones**, 56 estados de idioma y
14 moléculas con todos sus controles comprobados.
La única molécula pendiente de generación local del corpus es ibuprofeno, con
dos perfiles bloqueados deliberadamente.

## D. Generalización y corpus negativo

El corpus nuevo contiene **24 constituciones distintas**, tres por cada una de
ocho familias: aldehídos, ésteres, aminas, amidas y nitrilos aromáticos; alcoholes,
cetonas y cetonas insaturadas cíclicos. Incluye orto/meta/para, ciclos de cinco,
seis y siete átomos, ramas de varias longitudes, ramificación y multiplicadores.
Los 48 nombres ES/EN se reconstruyen como FULL contra sus conectividades
construidas. No se afirma haber medido la generación local de esos 24 nombres.

Las reglas estaban implementadas antes de crear este corpus. Su validación no
exigió añadir CID ni cambiar las reglas para aceptar una fila concreta. Los SMILES
y fórmulas se especificaron separadamente del analizador de nombres. Se conserva
ID interno, ambos nombres, fórmula, estructura, procedencia, fecha de creación,
ausencia de estereoquímica y expectativa. No hay CID inventados.

La consulta remota a OPSIN no se ejecutó satisfactoriamente: el intento normal
falló por resolución de red y la revisión automática rechazó la ampliación de
permisos por el envío de 24 nombres al servicio público. Se utilizó la alternativa
local permitida en la solicitud. Este corpus es **construido y verificado por
conectividad local**, no un corpus de recibos independientes PubChem/OPSIN. La
evidencia externa histórica B4.2, VALIDATION-008/014 y de traducción de carvona
se conserva y se prueba por separado.

Además se ejecutan **1.104 emparejamientos negativos**: cada nombre de cada idioma
contra las otras 23 estructuras nuevas. Todos se rechazan, incluidos isómeros de
igual fórmula con carbonos redistribuidos entre las partes de un éster y ramas
n-propilo/isopropilo. Hay catorce construcciones fuera de alcance o mal formadas
rechazadas explícitamente en la suite de generalización, además de los negativos
del corpus histórico y de aceptación B6. No se detectaron fallos de generalización
en esos controles. Esta muestra no demuestra cobertura fuera de su gramática.

## E. Pruebas y reproducibilidad

**Línea inicial:** 55 pruebas focalizadas B5 pasaron antes de modificar el motor.
Las tres nuevas pruebas de aceptación alicíclica fallaron inicialmente por
`unverified`; después pasan en ambos idiomas. Los positivos retenidos se
comprobaron antes de comenzar la implementación alicíclica.
El primer typecheck de la ampliación señaló etiquetas exhaustivas de amina y
nitrilo faltantes en dos tablas de presentación; se completaron y el typecheck
definitivo termina sin errores.

**Modelo y regresiones:** la ejecución consolidada de veinte archivos focalizados
contiene **299 pruebas, todas aprobadas**, sin skip ni TODO del runner. Incluye
B4.1, B4.2, corpus B5.0, alias de anisol, traducción de carvona, numeración bilingüe,
B5.2–B5.5, derivaciones históricas, razonamiento y comparación estructural,
VALIDATION-008, VALIDATION-014 y su integridad, y AUD-NOM-005. V008-072 permanece
UNSUPPORTED. Aspirina, paracetamol e ibuprofeno externo conservan sus regresiones;
el generador local de ibuprofeno sigue bloqueado.

**Prueba química:** los quince grafos de aceptación proceden del fixture PubChem
original, sin descargarlo nuevamente. Las referencias externas congeladas se
verifican en sus suites. Los veinticuatro controles nuevos son construidos;
ninguna igualdad de fórmula sustituye la comprobación de adyacencias. Los
negativos alteran función, heteroátomos, carga, número de átomos, carbonilo,
regioquímica, enlaces y conexiones; se rechazan nombres mal ordenados,
localizadores indebidos y delimitadores anidados no admitidos.

**Invariancia:** IDs permutados, orden y dirección de enlaces invertidos,
rotación y traslación, metadatos rings ausentes, representaciones aromáticas
equivalentes y exportación/reimportación SMILES. Las secuencias ES→EN→ES y
EN→ES→EN se comprueban sin mutación del grafo ni configuración absoluta inventada.
Los controles internos de rama seleccionan átomos de esa rama, no del anillo.

**Interfaz real:** Playwright utiliza Chromium 140.0.7339.186 ya instalado.
La nueva suite prueba las ocho moléculas solicitadas y los seis bencenos B5.4.
Para cada una importa SMILES en la aplicación, comprueba el nombre y FULL activo,
abre la ayuda, activa controles con ratón y teclado, y compara exactamente
átomos, enlaces y localizadores con la prueba proyectada. Comprueba cuatro
estados ES→EN→ES→EN, etiquetas del canvas, invalidación de selección anterior,
geometría de átomos y trazos de enlaces. Verifica consola, peticiones fallidas y
destinos externos inesperados. B5.0.4 y la suite histórica B5.2 se reproducen
también; sus resultados detallados figuran en los logs de interfaz.

Las rutas externas opcionales de PubChem/Wikipedia devuelven metadatos vacíos;
analytics y fuentes se aíslan. No se simulan nombres, estructuras ni respuestas
FULL. Importación, generación local y verificación ejecutan código real. Estas
pruebas no certifican disponibilidad de servicios externos.

**Incidencias de pruebas, separadas de defectos químicos:**

* Se encontró Chromium en la caché existente y se fijó PLAYWRIGHT_BROWSERS_PATH;
  no se instaló ninguna dependencia ni navegador nuevo.
* El sandbox impidió inicialmente el acceso a loopback. La ejecución autorizada
  fuera de ese límite permitió usar el servidor local con rutas externas aisladas.
* La primera expectativa de overlay incluía extremos de enlace como círculos y
  esperaba localizadores ya visibles. Se ajustó al contrato real del renderer,
  manteniendo las comparaciones exactas de átomos, enlaces y etiquetas.
* Las pruebas B5.0.4 aún esperaban frases del razonamiento local anterior a FULL,
  no distinguían controles duplicados del paso alfabético y trataban enlaces
  como dirigidos. Se actualizaron a la semántica FULL, conservando las mismas
  comprobaciones de sustitución, numeración, alias y geometría.
* Una consulta opcional a Wikipedia del metano inicial fue detectada como destino
  inesperado; se agregó al aislamiento de metadatos, sin desactivar el control.
* Una separación final de tipos provocó recargas HMR durante una ejecución.
  Los logs guardan esa incidencia; la validación definitiva usa código estable.

Los registros fallidos intermedios se conservan en e2e/*failure*.json. No se
utilizan para calcular los resultados finales. Typecheck y diff-check se
ejecutan además de las pruebas focalizadas. No se ejecutó la batería local
completa ni se modificó GitHub Actions.

| Ejecución | Resultado ejecutado | Evidencia |
|---|---|---|
| Veinte archivos focalizados, versión final | 299/299; 0 fail, skip o TODO | [regressions.log](regressions.log) |
| Nueva integración de interfaz B6 | 14/14; 0 errores de consola, red fallida o destinos inesperados | [b60-e2e.log](b60-e2e.log), [detalle](e2e/results.json) |
| Numeración bilingüe B5.0.4 | 2/2 | [b504-e2e.log](b504-e2e.log) |
| B5.2 histórica, primera ejecución | 10/12; dos incidencias durante desarrollo | [b52-e2e-initial.log](b52-e2e-initial.log) |
| Repetición acotada de los dos casos B5.2 afectados | 2/2 con código estable; ninguna aserción eliminada | [b52-e2e-recheck.log](b52-e2e-recheck.log) |
| TypeScript | Exit 0 | [typecheck.log](typecheck.log) |
| Diff-check | Exit 0 | [diff-check.log](diff-check.log) |

No se presenta la primera ejecución B5.2 como una suite de doce aprobada de una
sola vez: se distinguen los diez positivos originales de las dos repeticiones.
La suite B6 final vuelve a cubrir independientemente las catorce moléculas con
el código definitivo. Las capturas seleccionadas de [carvona](e2e/7439.png),
[mentol](e2e/1254.png) y [éster](e2e/7455.png) documentan la interfaz observada.

## F. Archivos y responsabilidad

| Archivo | Cambio B6 y justificación | Validación |
|---|---|---|
| app/compositional-name-model.ts | Tipos comunes, evidencia, comparación pura de numeración y referencias normativas | B6, typecheck |
| app/systematic-family-grammar.ts | Constructor aromático compartido, tres retenidos, monociclos funcionales, órdenes de rama, tramos e ámbitos | B5.3–B5.5, B6, generalización |
| app/validated-name-derivation.ts | Reexport de tipos; mapeo de evidencia y numeración interna al grafo original; campos opcionales compatibles | Derivaciones históricas, negativos, metamórficas |
| app/reasoning-derivation-adapter.ts | Fragmentos literales, insaturaciones separadas, controles internos y orden alfabético del nombre activo | Adapter, B6, Chromium |
| app/reasoning-name-fragments.ts | Metadatos opcionales de idioma y ámbito | Typecheck, fragmentos, regresiones |
| app/verified-structural-reasoning.ts | Etiquetas amina/nitrilo y explicación de progenitor alicíclico desde evidencia | Derivaciones, B6 |
| tests/b60-compositional-derivation.test.mjs | Aceptación bilingüe, reglas, controles literales, ediciones adversariales e invariancia | 18 pruebas |
| tests/b60-generalization.test.mjs | Corpus separado, cruces negativos, límites y equivalencia aromática | 27 pruebas |
| tests/fixtures/b60-generalization-input.mjs | 24 estructuras y fórmulas construidas con procedencia explícita | Generalización |
| tests/e2e/b60-compositional.e2e.mjs | 14 moléculas reales, selección exacta, idiomas, consola y geometría | Chromium |
| tests/b53-full-partial-support.test.mjs | Expectativas actualizadas a las nuevas pruebas FULL; se conserva verificación de proyección funcional | Regresión B5.3 |
| tests/e2e/b52-cyclic-branched-reasoning.e2e.mjs | Expectativas FULL de familias ampliadas y valor por defecto de tamaño parental | Regresión histórica Chromium |
| tests/e2e/b504-localized-ring.e2e.mjs | Selectores por paso, texto FULL, regiones exactas y enlaces no dirigidos | Dos regresiones Chromium |
| scripts/b60-derivation-report.mjs | Medición reproducible de los treinta perfiles, sin CID en las reglas | initial/final.json |
| scripts/b60-render-report.mjs | Matriz, corpus y métricas a partir de resultados ejecutados; exige 14 PASS de interfaz | Informe generado |
| reports/b60/* | Evidencia inicial/final, logs, capturas y documentación | Revisión de resultados |

`app/page.tsx`, `reasoning-functional-groups.ts` y `reasoning-visual-targets.ts`
ya estaban modificados al inicio y no se editaron en B6. Los cambios acumulados
B4/B5 y los tests preexistentes sin commit se preservan. Los diez archivos de
baselines/corpus protegidos por el manifiesto inicial mantienen su hash.
No hay cambios de dependencias, generador químico ni contratos de API externos.
No se hizo commit, push, reset, clean ni cambio de Actions.

## G. Limitaciones restantes

| Categoría | Límite concreto |
|---|---|
| Gramática | Repertorio finito; fuera de alcance N-sustitución de los nuevos retenidos, polifunciones cíclicas, dienonas, heterociclos nuevos, anillos fusionados y ramas cíclicas en la nueva familia |
| Evidencia independiente | Los 24 controles nuevos carecen de recibos remotos; son estructuras construidas. Las referencias externas históricas sí se conservan |
| Selección de progenitor | Demostrada para los retenidos admitidos y el único ciclo portador de sufijo, con ramas permitidas; no para familias policíclicas arbitrarias |
| Numeración | Se comparan los dos sentidos del monociclo y los ámbitos de las ramas admitidas; no sistemas con múltiples sufijos o fusión nueva |
| Estereoquímica | No se inventa R/S ni E/Z; las nuevas familias FULL requieren estructura sin estereoquímica explícita |
| Traducción | Los nombres activos de estas familias se analizan por idioma; permanece la compatibilidad histórica de otras presentaciones localizadas, sin extenderla implícitamente |
| Razonamiento | El relato y los controles nuevos se basan en evidencia literal; las construcciones rechazadas conservan el respaldo parcial que corresponda |
| Interfaz | Probada en Chromium de escritorio, con servicios opcionales aislados; no acredita otros navegadores, móvil ni disponibilidad de proveedores |
| Seguridad deliberada | Ibuprofeno sigue sin generación local; límites de isomorfía, valencias, isótopos y estereoquímica continúan conservadores |

## H. Tres prioridades generales posteriores

1. **Añadir evidencia externa del corpus construido.** Recuperar y congelar
   interpretaciones OPSIN o registros equivalentes con autorización para ese
   intercambio permitiría contrastar los 48 nombres con un segundo analizador,
   sin confundir conectividad con preferencia PIN.
2. **Generalizar la prueba de selección y numeración de múltiples funciones.**
   Un comparador explícito de candidatos para polialcoholes, policetonas y ciclos
   con más de un grupo principal resolvería el límite actual de un solo sufijo,
   conservando evidencia de los candidatos descartados.
3. **Incorporar estereoquímica al grafo reconstruido y a sus correspondencias.**
   Añadir descriptores, prioridades y pruebas de isomorfía estereoquímica permitiría
   distinguir mentoles/carvonas configuracionalmente especificados. Actualmente
   esas estructuras permanecen fuera del nuevo FULL; no se debe inferir su
   configuración a partir del nombre tradicional.
