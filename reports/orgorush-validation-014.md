# ORGORUSH-VALIDATION-014 — auditoría independiente

## A. Resumen ejecutivo

Baseline: `52e4cdd2dc588acc8fc2a2dce718af70d5c306ae`, rama main. Auditoría aditiva: los 764 archivos originales conservan su SHA-256. Sin cambios de producción, dependencias o fixtures históricos; sin commit ni push.

150 constituciones nuevas, ocho cuotas exactas. 450 observaciones principales y 150 controles complementarios 2013 EN: **600**. Las variantes son diagnósticos anidados. Resultado: **443 PASS; 2 FAIL-STRUCTURE; 3 FAIL-NAME; 0 FAIL-REASONING; 120 UNSUPPORTED; 32 PENDING-REFERENCE**. Hay **5 observaciones fallidas, 3 constituciones afectadas y 3 grupos de causa** (dos causas confirmadas y una probable). Se encontraron tres defectos; no se inventan otros dos para completar una lista de cinco.

| Perfil | PASS | FAIL-STRUCTURE | FAIL-NAME | FAIL-REASONING | UNSUPPORTED | PENDING-REFERENCE |
| --- | --- | --- | --- | --- | --- | --- |
| 2013-es | 114 | 1 | 1 | 0 | 22 | 12 |
| 1979-es | 92 | 0 | 0 | 0 | 53 | 5 |
| 1979-en | 120 | 0 | 0 | 0 | 23 | 7 |
| 2013-en | 117 | 1 | 2 | 0 | 22 | 8 |

Las 450 principales: PASS 326; FAIL-STRUCTURE 1; FAIL-NAME 1; FAIL-REASONING 0; UNSUPPORTED 98; PENDING-REFERENCE 24. El inglés 2013 es una proyección lingüística del análisis actual, no un cuarto motor independiente.

## B. Metodología e independencia

Se propusieron 203 nombres externos antes de consultar producción; se seleccionaron los primeros válidos y nuevos por cuota. 15 candidatos anteriores al cierre se descartaron por identidad histórica o duplicada. Se compararon identidades constitucionales canónicas sin estereoquímica ni isótopos frente a 1337 identidades históricas obtenidas de 390 fuentes locales, JSON, fixtures y recibos. Ninguna estructura se sustituyó por fallar OrgoRush. Los diez casos estereoquímicos también tienen constituciones diferentes.

OPSIN interpreta nombres de referencia y nombres ingleses observados. Se conservan 292 recibos crudos, URL, estado HTTP, cuerpo, fecha y SHA-256 en el nuevo fixture .opsin.json. La selección tiene 150 interpretaciones SUCCESS. La versión del servicio no fue suministrada; no se inventa. Una respuesta 404/WARNING no demuestra por sí sola un nombre químicamente erróneo. No se empleó PubChem ni se afirma corroboración suya.

El lector CML independiente reconstruye átomos, órdenes, cargas, fórmula con hidrógenos explícitos, grupos y rango ciclomático. Se comprueban valencias y correspondencia por isomorfismo acotado a 50000 visitas. OpenChemLib 9.25.0 aporta una segunda representación estructural; también lo usa producción, por lo que su concordancia no se trata como independencia algorítmica absoluta. La enumeración acíclica de padres procede del oráculo independiente anterior, sin reutilizar el selector del motor; conserva sus límites de desempate alfabético y grupos complejos.

Las expectativas 2013 y 1979 son aplicaciones derivadas de reglas, no ejemplos supuestamente impresos en las fuentes. OPSIN no certifica preferencia normativa. Se separan conectividad, validez, preferencia, convención y lengua. Los nombres equivalentes no preferidos no se clasifican P0/P1. Las alternativas sin revisión completa quedan pendientes. Una coincidencia española exige la referencia léxica y el nombre inglés externo correspondiente, además de las comprobaciones del grafo, padre y explicación.

Se preservaron las capturas originales en seis lotes de 25, con 100 observaciones por lote. El fixture inicialmente capturado tiene hash `076eeef657bf32c33943809104ab9dc4c726fc2a865bb9cac2d09bd1496ae9f3`; el definitivo `cac4617698fadbb5bab9d3e22c7e5e3afd3c6be48cff524f64c536bf51a99d02`. Una corrección del arnés de referencia sobre la API addBond/setBondType de OCL obligó a revisar metadatos aromáticos: los 150 IDs, SMILES, identidades, referencias inglesas y fórmulas permanecieron idénticos. Se archivaron productor y fixture originales y se verificó la revisión, sin repetir ni alterar resultados del motor. También se corrigieron criterios del auditor que confundían las letras de fusión con índices consecutivos, el ancla O-alquilo de un éster y los halógenos prefijos con grupos de sufijo. La envoltura del resultado exportado se desempaqueta antes de comparar su SMILES. Ninguna de estas correcciones modifica producción.

17 SMILES válidos fueron rechazados al importar. Para 12 grafos neutros de elementos editables se añadió una ruta directa CML → grafo ordinario del API de edición. Esta ruta **no simula una importación exitosa ni una prueba de clics de UI**. Los cinco restantes, con cargas o P/B, mantienen rechazo explícito. No se fuerza disponibilidad de nombres.

## C. Cobertura

| Familia | Constituciones | Perfil | PASS | FAIL-STRUCTURE | FAIL-NAME | FAIL-REASONING | UNSUPPORTED | PENDING-REFERENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| alkanes | 20 | 2013-es | 15 | 0 | 0 | 0 | 0 | 5 |
| alkanes | 20 | 1979-es | 14 | 0 | 0 | 0 | 6 | 0 |
| alkanes | 20 | 1979-en | 19 | 0 | 0 | 0 | 0 | 1 |
| alkanes | 20 | 2013-en | 15 | 0 | 0 | 0 | 0 | 5 |
| unsaturated | 25 | 2013-es | 21 | 0 | 1 | 0 | 2 | 1 |
| unsaturated | 25 | 1979-es | 18 | 0 | 0 | 0 | 7 | 0 |
| unsaturated | 25 | 1979-en | 25 | 0 | 0 | 0 | 0 | 0 |
| unsaturated | 25 | 2013-en | 22 | 0 | 1 | 0 | 2 | 0 |
| cyclic | 20 | 2013-es | 15 | 0 | 0 | 0 | 4 | 1 |
| cyclic | 20 | 1979-es | 11 | 0 | 0 | 0 | 6 | 3 |
| cyclic | 20 | 1979-en | 11 | 0 | 0 | 0 | 6 | 3 |
| cyclic | 20 | 2013-en | 14 | 0 | 1 | 0 | 4 | 1 |
| oxygen | 25 | 2013-es | 23 | 0 | 0 | 0 | 0 | 2 |
| oxygen | 25 | 1979-es | 18 | 0 | 0 | 0 | 7 | 0 |
| oxygen | 25 | 1979-en | 24 | 0 | 0 | 0 | 0 | 1 |
| oxygen | 25 | 2013-en | 24 | 0 | 0 | 0 | 0 | 1 |
| nitrogen | 20 | 2013-es | 18 | 0 | 0 | 0 | 0 | 2 |
| nitrogen | 20 | 1979-es | 15 | 0 | 0 | 0 | 4 | 1 |
| nitrogen | 20 | 1979-en | 18 | 0 | 0 | 0 | 0 | 2 |
| nitrogen | 20 | 2013-en | 19 | 0 | 0 | 0 | 0 | 1 |
| mixed | 15 | 2013-es | 12 | 1 | 0 | 0 | 1 | 1 |
| mixed | 15 | 1979-es | 8 | 0 | 0 | 0 | 6 | 1 |
| mixed | 15 | 1979-en | 13 | 0 | 0 | 0 | 2 | 0 |
| mixed | 15 | 2013-en | 13 | 1 | 0 | 0 | 1 | 0 |
| stereo | 10 | 2013-es | 10 | 0 | 0 | 0 | 0 | 0 |
| stereo | 10 | 1979-es | 8 | 0 | 0 | 0 | 2 | 0 |
| stereo | 10 | 1979-en | 10 | 0 | 0 | 0 | 0 | 0 |
| stereo | 10 | 2013-en | 10 | 0 | 0 | 0 | 0 | 0 |
| limits | 15 | 2013-es | 0 | 0 | 0 | 0 | 15 | 0 |
| limits | 15 | 1979-es | 0 | 0 | 0 | 0 | 15 | 0 |
| limits | 15 | 1979-en | 0 | 0 | 0 | 0 | 15 | 0 |
| limits | 15 | 2013-en | 0 | 0 | 0 | 0 | 15 | 0 |

Cada perfil aparece exactamente 150 veces. La matriz enumera átomos/enlaces pesados, conteos de órdenes Kekulé, elementos, fórmula, componentes, grupos, rango ciclomático y paridades CML. El rango ciclomático no pretende ser una lista única de todos los ciclos posibles de un policiclo.

## D. Resultados, exclusiones y pendientes

Se conservan todas las incidencias y se elige la clasificación principal en orden estructura → nombre → razonamiento. Un rechazo seguro no es PASS. Las excepciones de ejecución sobre grafos válidos se distinguen de la exclusión deliberada. No se encontró una excepción de análisis que se haya reclasificado como rechazo seguro.

55 constituciones tienen al menos un perfil UNSUPPORTED (120 observaciones). Los 15 casos limits son válidos y quedan rechazados en los cuatro perfiles: purina/quinolina, benzofurano/indol, adamantano y cubano sustituidos, sales y amonio, funciones S/P/B. Es una medida de cobertura, sin evidencia para llamarla regresión de disponibilidad en estructuras nuevas. El importador documenta sus barreras de carga y elementos en app/openchemlib-adapter.ts:217–243 y de policiclos en :335–346; las exclusiones particulares de nomenclatura se guardan literalmente en la matriz. Los rechazos regulares se etiquetan como oportunidad de cobertura futura; no se les atribuye una intención histórica no documentada.

Legacy ES tiene 53 rechazos, frente a 23 de Legacy EN y 22 de cada perfil 2013. Ejemplos: ésteres/amidas/nitrilos funcionalizados pueden tener nombre inglés Legacy verificable y resolución española no disponible. V014-125 queda rechazado en Legacy pero produce el nombre incorrecto en 2013: el rechazo de un perfil no oculta ese fallo del otro.

**32 observaciones pendientes**, de 16 constituciones. Incluyen radicales ramificados con nombres equivalentes no preferidos, construcciones históricas cíclicas, diferencias de orden léxico español y formas alternativas de amida/nitrilo. El generador léxico del fixture no es un traductor normativo completo: por ejemplo, el orden inglés methoxy/methyl no determina el español metil/metoxi. Esas discrepancias no prueban un defecto. En V014-028 la unión vocálica española del metilideno requiere revisión específica.

| Caso | Perfil | Nombre pendiente |
| --- | --- | --- |
| V014-009 | 2013-es | 5-(1-metiletil)nonano |
| V014-009 | 2013-en | 5-(1-methylethyl)nonane |
| V014-010 | 2013-es | 5-(1-metilpropil)decano |
| V014-010 | 2013-en | 5-(1-methylpropyl)decane |
| V014-012 | 2013-es | 6-(1,1-dimetiletil)dodecano |
| V014-012 | 1979-en | 6-(1,1-dimethylethyl)dodecane |
| V014-012 | 2013-en | 6-(1,1-dimethylethyl)dodecane |
| V014-013 | 2013-es | 6-(1-metilbutil)tridecano |
| V014-013 | 2013-en | 6-(1-methylbutyl)tridecane |
| V014-014 | 2013-es | 7-(1-etilpropil)tetradecano |
| V014-014 | 2013-en | 7-(1-ethylpropyl)tetradecane |
| V014-028 | 2013-es | 3-metilidenooct-1-eno |
| V014-048 | 1979-es | 1-metil-1,3-cicloheptadieno |
| V014-048 | 1979-en | 1-methyl-1,3-cycloheptadiene |
| V014-049 | 1979-es | 1,5-cicloundecadieno |
| V014-049 | 1979-en | 1,5-cycloundecadiene |
| V014-051 | 2013-es | 1-etil-3-(1,1-dimetiletil)benceno |
| V014-051 | 1979-es | 1-(1,1-dimetiletil)-3-etilbenceno |
| V014-051 | 1979-en | 1-(1,1-dimethylethyl)-3-ethylbenzene |
| V014-051 | 2013-en | 1-ethyl-3-(1,1-dimethylethyl)benzene |
| V014-086 | 2013-es | 4-etilheptanoato de 1-metiletilo |
| V014-086 | 1979-en | 1-methylethyl 4-ethylheptanoate |
| V014-086 | 2013-en | 1-methylethyl 4-ethylheptanoate |
| V014-090 | 2013-es | 4-metil-2-metoxiheptano |
| V014-102 | 2013-es | 2-metil-N-propilpentanamida |
| V014-102 | 1979-en | 2-methyl-N-propylpentanamide |
| V014-102 | 2013-en | 2-methyl-N-propylpentanamide |
| V014-104 | 2013-es | 4-etilheptanonitrilo |
| V014-104 | 1979-es | 4-etilheptanonitrilo |
| V014-108 | 1979-en | 3-ethyl-4-methylbenzenecarboxamide |
| V014-113 | 2013-es | 5-hidroxi-3-metiloctanonitrilo |
| V014-118 | 1979-es | 4-cloro-2-etoxihexanol |

## E. Análisis normativo

2013 conserva la longitud del padre antes de maximizar enlaces múltiples dentro del alcance aplicable P-44; 1979 A-3/C-13 selecciona primero las insaturaciones después de la función principal. V014-045 ilustra una diferencia legítima: el padre actual tetradecano conserva el radical butadienilo, mientras que Legacy usa 5-pentyl-1,3-tridecadiene. El error actual es la construcción del radical, no que ambos perfiles usen padres distintos.

V014-125 muestra un alcance que UNSATURATION-013 no cubrió: una rama =CH2 con función prioritaria. El nombre inglés observado representa otra constitución según OPSIN; P-29 distingue methyl (CH3–) de methylidene (CH2=). La reducción D1 confirma el fallo y los controles saturado y de un carbono menos no lo presentan.

Los radicales históricos 1-methylethyl y similares no se sustituyen automáticamente por la preferencia de 2013. La RSEQ se usa para terminología española, sin imponer reglas actuales al perfil 1979. Las referencias no resueltas siguen explícitas.

## F. «Cómo se obtiene» e invariancias

Se usaron buildActiveIupacReasoning, sus fragmentos y enlaces reales. Se comprobó integridad, existencia de pasos/átomos/enlaces, reconstrucción del texto, numeración acíclica, correspondencia de grupos funcionales y ausencia de mutación. El isomorfismo vincula los IDs reales a los átomos CML; el oráculo comprueba la composición del padre cuando es aplicable. Las revisiones no certifican automáticamente cada frase pedagógica ni la minimalidad de todos los padres cíclicos.

Resultado principal: **0 FAIL-REASONING independientes**. Esto no absuelve las explicaciones de los nombres incorrectos: D1 conserva además una explicación y un resaltado de «metil» para una rama =CH2. Se registra bajo su defecto químico prioritario y no se cuenta dos veces como causa nueva.

568 variantes con grafo: almacenamiento original, IDs/orden invertidos, reflexión visual y SMILES equivalente con mapas. Hay 12 variantes alternativas rechazadas por el importador. Sus diagnósticos no aumentan las 600 observaciones. Los 568 SMILES exportados preservan constitución y configuración; 532 se reimportan y pasan la correspondencia independiente, y 36 exportaciones de los grafos CML siguen rechazadas por la barrera de policiclos. Las diez constituciones estereoquímicas y sus variantes conservan el estado especificado; se comparó identidad isomérica con OPSIN, sin confundir reflexión visual con inversión química.

## G. Defectos y reproducciones

### V014-D01 — P0: Metilideno funcional nombrado como metil

Caso V014-125. El enlace C=CH2 lateral debe conservarse: 3-methylidenepentan-2-one, no 3-methylpentan-2-one. OPSIN confirma constituciones y fórmulas diferentes.

SMILES reducido: `CC(=O)C(=C)CC`. Salidas: 2013-es: **3-metilpentan-2-ona**; 1979-es: **3-etil-3-buten-2-ona**; 1979-en: **3-ethyl-3-buten-2-one**; 2013-en: **3-methylpentan-2-one**. Se pierde un doble enlace; C6H10O se convierte semánticamente en C6H12O. En el caso base: C8H14O2 frente a C8H16O2.

La rama funcional llama nameSubstituent con bondOrders y preferSystematicUnsaturatedPrefix, pero omite attachmentOrder; su valor por defecto 1 impide el caso methylidene. Lectura de código y reducción concuerdan. Confianza: confirmed. Controles: D1-control (`CC(=O)C(C)CC`), D1-shorter (`CC(=O)C(=C)C`). La reducción es el mínimo encontrado; no una demostración exhaustiva. Otros grupos funcionales con =CH2 lateral pueden compartir el mismo llamador. No se cuantifica su prevalencia fuera del corpus.

Referencias: [P-29.2, P-29.3.1: CH2= methylidene](https://iupac.qmul.ac.uk/BlueBook/P2.html), [P-62, P-63, P-64, P-65](https://iupac.qmul.ac.uk/BlueBook/P6.html).

### V014-D02 — P1: Radical dienilo pierde el multiplicador y el inglés conserva -il

Caso V014-045. Dos dobles enlaces de un radical requieren dien; 6-(buta-1,3-dien-1-yl)undecane en inglés. «but-1,3-en-1-il» no es una construcción correcta.

SMILES reducido: `CCCCCC(C=CC=C)CCCCC`. Salidas: 2013-es: **6-(but-1,3-en-1-il)undecano**; 1979-en: **5-pentyl-1,3-decadiene**; 2013-en: **6-(but-1,3-en-1-il)undecane**. Localizadores 1,3 con morfema singular en y ausencia de la vocal/multiplicador de buta...dien; proyección inglesa sin traducir il. El fallo de OPSIN es evidencia auxiliar, no la prueba normativa por sí solo.

makeUnsaturatedSubstituentName concatena todas las posiciones con en/in singular; el traductor de radicales numerados solo reconoce un localizador. Ambas limitaciones son visibles en el código. Confianza: confirmed. Controles: D2-shorter (`CCCCC(C=CC=C)CCCCC`), D2-control (`CCCCCC(CC=CC)CCCCC`). La reducción es el mínimo encontrado; no una demostración exhaustiva. Radicales laterales con múltiples dobles o triples enlaces; la extrapolación a triples no se cuenta como reproducción confirmada.

Referencias: [P-31.1 unsaturation multiplicative prefixes](https://iupac.qmul.ac.uk/BlueBook/P3.html), [P-21, P-22, P-23, P-24, P-25](https://iupac.qmul.ac.uk/BlueBook/P2.html), [A-3.5 (corroboración del radical dienyl, no selección del padre 2013)](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm).

### V014-D03 — P2: Proyección inglesa de tiofeno sustituido usa raíz española y localizador de alqueno

Caso V014-059. El padre inglés retenido es thiophene; 2-methylthiophene. La salida methyltiof-2-ene no conserva esa construcción.

SMILES reducido: `Cc1cccs1`. Salidas: 2013-es: **2-metiltiofeno**; 2013-en: **methyltiof-2-ene**. El localizador 2 del metilo se desplaza al sufijo ene y tiof no se traduce. No se afirma que OPSIN pruebe qué otra molécula representa una cadena que no interpreta.

Probable interacción entre normalización de sufijos eno y traducción de heterociclos por nombres completos. La reproducción confirma el síntoma; no se ha aislado una única función como causa suficiente. Confianza: symptom-confirmed; root-cause-probable. Controles: D3-unsubstituted (`c1ccsc1`), D3-control (`Cc1ccncc1`). La reducción es el mínimo encontrado; no una demostración exhaustiva. Otros heterociclos sustituidos sin entrada específica en la proyección inglesa requieren auditoría dirigida.

Referencias: [P-22.2.2, Table 2.2: thiophene](https://iupac.qmul.ac.uk/BlueBook/P2.html), [Tables 1-3; sections 4, 6b, 7, 8](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf).


Reproducir: `node scripts/validation-014-audit.mjs --reproduce`. Los controles adicionales no completan cuotas ni cuentan como nuevas observaciones del corpus. El JSON de defectos conserva las salidas de todos los perfiles, recibos externos, controles, funciones posiblemente implicadas e IDs de incidencias.

## H. Regresiones históricas

Se ejecutó de nuevo VALIDATION-008 en un archivo de outputs separado, sin sobrescribir su ledger. Su modo strict-backed y el comparador UNSATURATION-013, que encadena POLYENES-011/FIX-009, conservaron **198 PASS, 16 UNSUPPORTED y 2 PENDING-REFERENCE**. El comparador también verifica los dos cambios de fixture autorizados por 013 y la identidad del JavaScript protegido de QUALITY-010. LOCALIZATION-012 y los demás tests históricos están incluidos en la pasada general por archivos. No se exige igualdad literal con el motor anterior a las correcciones 011/013.

## I. Validación técnica y trazabilidad

| Control | Resultado | Duración ms |
| --- | --- | --- |
| typecheck | PASS | 15431 |
| build-pages | PASS | 5712 |
| validate-pages | PASS | 130 |
| build-sites | PASS | 13356 |
| historical-audit | PASS | 16809 |
| historical-verify | PASS | 1457 |

Suite general: **COMPLETE**, 173/173 archivos, ejecutados individualmente con `node --test --test-concurrency=1 tests/<archivo>`; agregado: {"tests":3104,"pass":3099,"fail":0,"cancelled":0,"skipped":5,"todo":0}. No se presenta como una ejecución única de npm test. Una sola pasada general; las pruebas dirigidas del nuevo auditor se ejecutaron durante su desarrollo y no se suman de nuevo al agregado. No se aumentaron timeouts. Las cinco omisiones históricas deben contrastarse por nombre al cerrar la pasada.

Herramientas: node v24.19.0; npm 11.17.0; openchemlib 9.25.0; typescript 5.9.3; vite 8.0.13. Hash de los 764 archivos protegidos: `4ccf381d67f248b4cfed7b67fa114ce0070bf791470edc27b5fee5993b250a3b`. El hash final del fixture es `cac4617698fadbb5bab9d3e22c7e5e3afd3c6be48cff524f64c536bf51a99d02`. Cada recibo de lote contiene su hash de cuerpo, productor, fixture, IDs, duración y estado COMPLETE. Los seis lotes y el suplemento se verifican antes de adjudicar; las fechas de ejecución quedan fuera de los resultados químicos comparables.

Archivos permanentes nuevos: scripts/validation-014-audit.mjs; scripts/validation-014-reference.mjs; tests/fixtures/orgorush-validation-014.mjs; tests/fixtures/orgorush-validation-014.opsin.json; tests/orgorush-validation-014.test.mjs; reports/orgorush-validation-014.md; reports/orgorush-validation-014.matrix.json; reports/orgorush-validation-014.defects.json. Los logs/capturas temporales están en outputs/validation-014/.

Comandos: `--collect` recoge seis lotes con reanudación estricta de hashes; `--roundtrip` verifica exportación/reimportación; `--adjudicate` contrasta las capturas con referencias; `--verify` verifica cuotas, novedad, fuentes, evidencia PASS e integridad de originales; `--report` escribe informe y defectos. Las referencias externas están congeladas para verificación offline. Recoger y adjudicar de cero requiere primero el baseline de protección y las capturas originales descritas en los manifiestos; --verify y los tests del auditor usan el baseline congelado en el fixture cuando no existen outputs.

## J. Propuesta FIX-015

1. **D01, P0:** transmitir/comprobar el orden del enlace de unión en la ruta funcional. Añadir reproducción reducida, variante con función secundaria y control saturado. Verificar identidad del nombre completo en todos los perfiles; no ampliar la nomenclatura Legacy por accidente.
2. **D02, P1:** construir multiplicadores/vocales de radicales poliinsaturados y traducir sus localizadores completos. Mantener el padre 2013 y la selección histórica; controlar dobles/triples mixtos y el radical monoinsaturado que ya funciona.
3. **D03, P2:** reconocer el padre heterocíclico antes de normalizar sufijos y conservar el localizador del sustituyente al proyectar al inglés. Comparar tiofeno sin sustitución y piridina sustituida.
4. **Referencias:** revisar las 32 observaciones pendientes por preferencia, sintaxis histórica y alfabeto español antes de convertirlas a PASS o defecto. Las diferencias equivalentes no justifican cambios químicos.
5. **Cobertura posterior separada:** evaluar barreras de policiclos, carga, S/P/B y disponibilidad Legacy ES con referencias propias. No presentar esa ampliación como reparación de los cinco nombres fallidos.

Ninguna de estas correcciones se aplica en 014.

### Fuentes consultadas

- **modern**: [P-41, P-44.1, P-44.3, P-44.4](https://iupac.qmul.ac.uk/BlueBook/P4.html); consulta 2026-10-25. 2013 parent/group seniority; independent rule application
- **modernSyntax**: [P-14.3, P-14.4, P-14.5, P-16.7](https://iupac.qmul.ac.uk/BlueBook/P1.html); consulta 2026-10-25. 2013 numbering, locants, alphabetical citation and vowel elision
- **modernHydrocarbons**: [P-21, P-22, P-23, P-24, P-25](https://iupac.qmul.ac.uk/BlueBook/P2.html); consulta 2026-10-25. 2013 chain/ring/spiro/fused parents
- **modernFunctions**: [P-62, P-63, P-64, P-65](https://iupac.qmul.ac.uk/BlueBook/P6.html); consulta 2026-10-25. 2013 amines, hydroxy/ether, ketone, acid/ester rules
- **modernNitrogen**: [P-66.1, P-66.5, P-66.6](https://iupac.qmul.ac.uk/BlueBook/P6a.html); consulta 2026-10-25. 2013 amides, nitriles and aldehydes
- **modernStereo**: [P-91–P-93](https://iupac.qmul.ac.uk/BlueBook/P9.html); consulta 2026-10-25. Stereodescriptors and CIP configuration
- **historicalParent**: [C-13.11(a-k)](https://www.acdlabs.com/iupac/nomenclature/79/r79_933.htm); consulta 2026-10-25. 1979 principal group > multiple bonds > length; numbering
- **historicalNumbering**: [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm); consulta 2026-10-25. 1979 suffix/multiple-bond/prefix numbering order
- **historicalUnsaturation**: [A-3.1-4](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm); consulta 2026-10-25. 1979 ene/yne/enyne grammar and seniority
- **historicalBranches**: [A-2.1–2.6](https://www.acdlabs.com/iupac/nomenclature/79/r79_36.htm); consulta 2026-10-25. Branched chains and systematic/retained radicals
- **historicalGroups**: [Table C-III](https://www.acdlabs.com/iupac/nomenclature/79/r79_905.htm); consulta 2026-10-25. 1979 suffix/prefix identities and priority
- **historicalAlcohol**: [C-201.1-2](https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm); consulta 2026-10-25. 1979 -ol / hydroxy-
- **historicalAldehyde**: [C-302.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_249.htm); consulta 2026-10-25. 1979 hydrocarbon parent + -al
- **historicalKetone**: [C-312.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_267.htm); consulta 2026-10-25. 1979 -one/-dione
- **historicalAcid**: [C-401.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm); consulta 2026-10-25. 1979 parent + -oic acid/-dioic acid
- **historicalEther**: [C-211](https://www.acdlabs.com/iupac/nomenclature/79/r79_227.htm); consulta 2026-10-25. 1979 alkoxyalkane and functional-class alternatives
- **historicalEster**: [C-463.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_363.htm); consulta 2026-10-25. 1979 O-alkyl + acid-derived ester component
- **historicalAmine**: [C-812.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_513.htm); consulta 2026-10-25. 1979 radical/parent amine alternatives
- **historicalSecondaryAmine**: [C-814.4](https://www.acdlabs.com/iupac/nomenclature/79/r79_522.htm); consulta 2026-10-25. 1979 N-substitution of the senior primary-amine parent
- **historicalPolyamine**: [C-813.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_517.htm); consulta 2026-10-25. 1979 diamine/polyamine parent construction
- **historicalAmide**: [C-822.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_541.htm); consulta 2026-10-25. 1979 acid-to-amide construction
- **historicalNAmide**: [C-824.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_548.htm); consulta 2026-10-25. 1979 N-substituted amides
- **historicalNitrile**: [C-832.1, C-832.5](https://www.acdlabs.com/iupac/nomenclature/79/r79_566.htm); consulta 2026-10-25. 1979 full hydrocarbon + nitrile; C#N carbon belongs to parent
- **historicalRings**: [A-11](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm); consulta 2026-10-25. 1979 monocyclic parents
- **historicalFused**: [A-21](https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm); consulta 2026-10-25. 1979 retained aromatic fused parents
- **historicalBridges**: [A-31](https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm); consulta 2026-10-25. 1979 bicyclo bridge counts
- **historicalSpiro**: [A-41](https://www.acdlabs.com/iupac/nomenclature/79/r79_197.htm); consulta 2026-10-25. 1979 spiro ring counts
- **spanishLexicon**: [Tables 1-3; sections 4, 6b, 7, 8](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf); consulta 2026-10-25. Spanish lexical/morphological forms and printed 2013 examples; for 1979 ONLY vocabulary, never modern parent selection or locant placement
- **opsin**: [name-to-structure service](https://www.ebi.ac.uk/opsin/); consulta 2026-10-25. Constitution cross-check ONLY; does not certify a historical or preferred name
- **Multiplicidad adicional**: [P-31.1](https://iupac.qmul.ac.uk/BlueBook/P3.html), consulta 2026-10-25.
- **Identidad externa**: [OPSIN](https://www.ebi.ac.uk/opsin/), recibos individuales completos en el fixture; sirve para nombre → estructura, no para certificar PIN.

### Cierre verificable de ejecución

173 archivos completados en la pasada general: {"tests":3104,"pass":3099,"fail":0,"cancelled":0,"skipped":5,"todo":0}. Los nombres de las 5 omisiones coinciden con la pasada histórica: ESTER-0007 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0012 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0014 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0015 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0016 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle.

El test nuevo 014 se ajustó durante la pasada general. Se ejecutó de nuevo únicamente ese archivo tras cerrar el arnés: {"tests":5,"pass":5,"fail":0,"cancelled":0,"skipped":0,"todo":0}, exit 0. Esa ejecución dirigida no se suma otra vez a los totales de la pasada. Los archivos originales permanecen idénticos al baseline; no se afirma que los diagnósticos nuevos fueran inmutables durante todo su desarrollo.

Las funciones capture y makeVariants coinciden por hash con el productor archivado de los seis lotes. Se reprodujeron las nueve capturas reducidas y los 600 veredictos base pueden repetirse offline con `node scripts/validation-014-audit.mjs --replay`. Este último comando adjudica observaciones guardadas; no vuelve a ejecutar el motor.
