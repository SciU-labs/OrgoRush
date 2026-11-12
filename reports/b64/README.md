# B6.4 — adjudicación del isopropenilo (trabajo incompleto)

## Diagnóstico

El fixture B50-CID7439 (`CC1=CCC(CC1=O)C(=C)C`, C10H14O, sin estereoquímica especificada) tiene un anillo ciclohex-2-en-1-ona: C=O en C1, C2=C3, metilo en C2 y CH2=C(CH3)– unido por su carbono central a C5. El doble enlace de esta rama es distinto del doble enlace del anillo. El nombre activo ES es `2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona`; el EN es `2-methyl-5-(1-methylethenyl)cyclohex-2-en-1-one`.

En [P-32.1.1 del Blue Book](https://iupac.qmul.ac.uk/BlueBook/P3.html), IUPAC da explícitamente `prop-1-en-2-yl` como prefijo preferido y `1-methylethen-1-yl` como construcción alternativa del mismo grupo. En el primero el doble enlace une C1 y C2 y la unión al progenitor está en C2; en el segundo el carbono de unión es C1 del etenilo y también porta el metilo. P-32.3 admite `isopropenyl` en nomenclatura general sin sustitución adicional y conserva `vinyl` para uso general, pero excluye su sustitución por alquilos que extiendan la cadena. Por ello `1-methylvinyl` y su adaptación `1-metilvinil` identifican la conectividad, pero no cumplen esa restricción moderna. Esto no implica que sean incomprensibles o que todo uso histórico sea incorrecto.

| Expresión | Evaluación |
|---|---|
| 1-metilvinil / 1-methylvinyl | Misma conectividad; nombre documentado en uso, pero la metilación de vinil entra en conflicto con P-32.3. No es el prefijo moderno preferido. |
| 1-metiletenil / 1-methylethenyl | Misma conectividad y forma abreviada utilizada; P-32.1.1 exige citar incluso el localizador 1 de la valencia libre en cadenas acíclicas. No se atribuye conformidad literal completa a la forma sin ese localizador. |
| 1-methylethen-1-yl | Alternativa sistemática explícita en P-32.1.1, no preferida. La adaptación española con localizador es 1-metileten-1-il, inferida de la construcción, sin fuente española específica localizada. |
| prop-1-en-2-il / prop-1-en-2-yl | Misma conectividad; prefijo inglés preferido por IUPAC. La forma española y el nombre completo de carvona sin R/S aparecen en el [BOE, Reglamento 2015/1221](https://www.boe.es/buscar/doc.php?id=DOUE-L-2015-81456). Esto no certifica el nombre completo como PIN. |
| isopropenil / isopropenyl | Misma conectividad; el inglés es nombre retenido para uso general sin sustitución adicional. El español es un equivalente terminológico documentado, no el prefijo preferido. |

El [Gold Book](https://www.old.goldbook.iupac.org/html/V/V06622.html) describe grupos vinílicos sustituidos en sentido estructural; ello no anula la restricción específica de nomenclatura P-32.3. La documentación de uso de 1-metilvinil, por ejemplo en la [ficha española de carvona](https://www.carlroth.com/downloads/sdb/es/6/SDB_6947_ES_ES.pdf), tampoco demuestra conformidad con aquella restricción.

## Origen y alcance de la corrección pendiente

`nameSubstituent` en `app/page.tsx` recoge el árbol a partir del átomo unido al progenitor y busca rutas máximas **que comienzan en ese átomo**. En esta rama ambas rutas tienen dos carbonos; prioriza la que incluye el doble enlace. El carbono restante se nombra como metilo en posición 1, mientras el camino de dos carbonos se denomina vinil, dando 1-metilvinil. Esa búsqueda enraizada no representa la cadena de tres carbonos que atraviesa el átomo de unión. `app/iupac-name-normalization.ts` traduce la unidad completa a 1-methylethenyl antes de las sustituciones léxicas genéricas.

`app/systematic-family-grammar.ts` reconoce literalmente las dos formas activas y construye el fragmento de tres carbonos con enlaces 0=1 y 0–2. `app/validated-name-derivation.ts` reconcilia el nombre con el grafo; el modelo composicional y el adaptador de razonamiento proyectan componentes y rangos literales. La prueba B5.2 verifica el fragmento de la rama, su unión al anillo y sus enlaces, y distingue la insaturación del anillo. Un cambio a prop-1-en-2-il exige elegir una cadena que pueda atravesar el punto de unión, numerarla independientemente, generar y traducir la forma sistemática y ampliar la gramática y las evidencias literales; no basta reemplazar texto.

**Se requiere una corrección general de producción. Aún no se ha implementado ni validado.** No se alteraron archivos de producción ni los estados FULL/PARTIAL/UNSUPPORTED; siguen mostrándose los nombres anteriores. No se propone conservarlos como conformes a P-32.3. Los candidatos son `2-metil-5-(prop-1-en-2-il)ciclohex-2-en-1-ona` y `2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one`. El BOE respalda el texto español; OPSIN solo interpreta inglés y no constituye un verificador independiente del texto español.

## Verificación ejecutada

`node scripts/b64-opsin-check.mjs`: OPSIN CLI local 2.9.0 interpretó las cinco formas inglesas completas (1-methylethenyl, 1-methylethen-1-yl, prop-1-en-2-yl, isopropenyl y 1-methylvinyl). Las cinco produjeron `CC=1C(CC(CC1)C(=C)C)=O`, con identidad OpenChemLib igual a la del fixture, incluida la ausencia de estereoquímica especificada. El resultado de OPSIN no demuestra validez normativa. Los cinco grafos de control isopropenilo, alilo, isopropilo, vinilo y metilidenociclohexano fueron distintos.

Las suites `b50-vinyl-translation`, `b52-cyclic-branched-reasoning` y `b60-compositional-derivation` pasaron 27/27; incluyen permutaciones de IDs y enlaces, rotación, exportación/reimportación, cambio ES→EN→ES y comprobación de regiones de la rama en carvona. `npm run typecheck` y `git diff --check` pasaron. No se ejecutó Playwright porque no hubo cambio de producción. No se han completado las pruebas de generalización del generador en anillo saturado, anillo insaturado y benceno, ni el resto de regresiones históricas solicitadas; los controles de grafos anteriores no las sustituyen.

## Anexo no destructivo a B6.3

Para el nombre ES activo de B50-CID7439, la adjudicación bajo las recomendaciones modernas pasa de ES-STRUCTURALLY-CONSISTENT a **ES-INCORRECT** por la construcción de la rama frente a P-32.3, no por conectividad incorrecta. El nombre candidato completo está directamente documentado en el BOE, pero esa evidencia no convierte el nombre activo en ES-DIRECTLY-SUPPORTED. Se preservan la matriz y observaciones históricas B6.3. La corrección, pruebas completas y validación de interfaz siguen pendientes, por lo que B6.4 no está terminado.

## Anexo posterior B6.4.1

La corrección y su verificación se documentan en [B6.4.1](../b641/README.md). La observación anterior se conserva como registro del estado anterior a la implementación. El nombre activo ES nuevo es `2-metil-5-(prop-1-en-2-il)ciclohex-2-en-1-ona`, directamente documentado por el BOE (**ES-DIRECTLY-SUPPORTED**); EN es `2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one`. El perfil de carvona conserva FULL mediante una reconstrucción independiente de cada nombre y comparación del grafo completo. El soporte terminológico no certifica PIN.
