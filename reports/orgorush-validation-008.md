# ORGORUSH-VALIDATION-008

## Dictamen para el piloto educativo

**No se recomienda un piloto general sin corregir las explicaciones aromáticas Legacy y los nombres españoles con sufijos múltiples.** La revisión encuentra 4 resultados FAIL-NAME y 4 FAIL-REASONING entre 216 combinaciones estructura/perfil; son ocho resultados afectados, no ocho causas distintas. Hay además 19 resultados expresamente UNSUPPORTED y 2 sin dictamen por respaldo histórico insuficiente. No se detecta FAIL-STRUCTURE en este corpus.

Los errores de nombres demostrados son de construcción morfológica española; **no se ha demostrado una conectividad equivocada en esos cuatro nombres**. Las explicaciones aromáticas pueden enseñar una distinción incorrecta entre anillo, cadena y raíz. Los dos nombres históricos pendientes no se certifican ni se declaran erróneos sin evidencia adicional.

La auditoría no cambia ningún archivo de producción, no implementa familias, no ajusta el motor a las referencias y no realiza commit ni push. Punto de partida: HEAD `a8023a2ef1e9e46978ff9d15cd277744aaa6e0d0`. Registro UTC: 2026-10-23T01:40:10.723Z.

## Independencia y diseño

Se fijaron **72 constituciones distintas y 216 nombres esperados** antes de observar los nombres de producción. El módulo de referencias no importa código de OrgoRush ni resultados de auditorías previas. Los nombres esperados permanecieron intactos después de la comparación; las adjudicaciones posteriores se guardan en un archivo separado. Ninguna de las 72 constituciones coincide con las 57 de la matriz final FALLBACK-006 (intersección canónica: 0). Hay controles clásicos cíclicos y aromáticos que sí pueden aparecer en otros trabajos anteriores; no se afirma que cada molécula sea inédita en todo el repositorio.

La muestra incluye alcanos, insaturaciones simples y múltiples, eninos, ciclos, aromáticos, fusionados, puentes y espiro; alcoholes, aldehídos, cetonas, ácidos, ésteres, éteres, aminas, amidas, nitrilos y funciones mixtas. V008-008 enfrenta deliberadamente la prioridad histórica de insaturación con la prioridad moderna de longitud. V008-071/072 enfrentan cantidad de grupos principales con cadenas más largas o grupos fuera del padre.

Las expectativas son **aplicaciones independientes de reglas**, salvo los ejemplos impresos expresamente identificados. No se afirma que los 216 nombres estén impresos literalmente en el Libro Azul. La fuente de 1979 es la reproducción autorizada de ACD/Labs de la edición de 1979; no se toman los enlaces a las revisiones de 1993 como reglas de 1979. Para español histórico se aplican esas reglas y su sintaxis por separado, utilizando el vocabulario español de la RSEQ; la guía española moderna **no determina el padre ni los locantes históricos**.

Se evalúa nomenclatura sistemática general compatible con cada época, no un concurso de coincidencia con un único PIN. Por ello el locante redundante de V008-020 se admite como variante general inequívoca, respaldada por A-11.3 y por reconstrucción independiente. Se registra su diferencia con el PIN moderno, que omite 1 según P-14.3.4.2(d). No se aceptan variantes solo porque las emita el motor.

Huellas:

- Fixture completo: `1520ce036edcfde887415461aa7f3adfeb62b847e9d4fcf8c2c3b43ee32caab4`.
- Nombres, estructuras, grupos y tamaños de padre: `45dfffa1054c123926667e085a9631ac9b5a0d9a0e62ca2aac0b2690670b524f`.
- Respuestas OPSIN congeladas: `bdcca40447fbfce2eb1c7c7994493de49ebc302cc788e802a7061f39c0e4ed77`.

## Métodos y límites de la verificación

1. Un lector de SMILES independiente y acotado, sin reutilizar detectores del producto, obtiene conectividad, valencias, fórmula y grupos funcionales. Sus fórmulas se contrastan con OpenChemLib; se compara composición, no el orden tipográfico de los elementos.
2. Un enumerador independiente recorre todas las rutas carbonadas acíclicas en ambos sentidos. Aplica prioridad de grupos de sufijo, longitud/insaturación en el orden de cada época, número de dobles enlaces, localizadores y ramificaciones. Los nombres manuales congelados comprueban además sustituyentes y citación alfabética.
3. **105 nombres ingleses de referencia**, modernos e históricos, se verificaron con OPSIN antes de ejecutar el producto. Todas sus estructuras coinciden con los SMILES independientes. Se añadió un testigo para la variante observada 1-cycloheptene: hay **106 respuestas HTTP 200**, congeladas completas con fecha, URL y SHA-256. OPSIN comprueba interpretación estructural; no acredita preferencia ni validez histórica. No se utiliza el traductor de OrgoRush para reconstruir nombres españoles.
4. Se usa la ruta local de selección y resolución de perfiles de la interfaz, sin PubChem ni un nombre importado que sustituya al generado. Cada estructura se evalúa almacenada y con identificadores, orden de átomos/enlaces y coordenadas reflejados: **432 evaluaciones de perfil**. La exportación de ambos grafos conserva la identidad canónica.
5. Se comprueban las fórmulas incluso cuando el nombre está no disponible. En las explicaciones se verifica el análisis activo, inmutabilidad, nombres literales, localizadores, fragmentos del padre, ausencia de solapamiento padre/función/insaturación y destinos de navegación. Los átomos funcionales y los enlaces resaltados se contrastan con el lector independiente, no solo con los grupos detectados por producción.
6. Las raíces se contrastan en contexto. V008-025/026 demuestran que un texto que etiqueta benceno como cadena y le atribuye hex- es pedagógicamente incorrecto aunque el nombre y los átomos resaltados sean correctos.

En sistemas cíclicos se contrasta el padre y el nombre normativo; no se pretende demostrar automáticamente todo el algoritmo de numeración fusionada con dos padres sin sustituir. Tampoco se certifican aquí todas las configuraciones R/S o E/Z: los SMILES de la muestra no fijan estereoquímica y el dictamen es constitucional. La revisión textual es estructurada y focalizada, no una certificación humana de cada frase. No se hizo inspección manual de clics o colores en navegador; se verifican los modelos y la navegación mediante sus datos y tests.

## Clasificación

Se conserva un dictamen principal con precedencia FAIL-STRUCTURE → FAIL-NAME → FAIL-REASONING; el JSON preserva todos los hallazgos. UNSUPPORTED solo significa un veto explícito de producción, sin nombre disponible. Un caso sin respaldo histórico suficiente tiene `classification: null` y `referenceStatus: INSUFFICIENT_HISTORICAL_REFERENCE`: **no constituye una sexta clase química ni se convierte en PASS o UNSUPPORTED**.

| Perfil | PASS | FAIL-NAME | FAIL-STRUCTURE | FAIL-REASONING | UNSUPPORTED | Sin dictamen histórico |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2013-es | 64 | 4 | 0 | 0 | 4 | 0 |
| 1979-en | 68 | 0 | 0 | 2 | 2 | 0 |
| 1979-es | 55 | 0 | 0 | 2 | 13 | 2 |
| **Total** | **187** | **4** | **0** | **4** | **19** | **2** |

La tabla cuenta 216 pares únicos; el segundo orden de átomos reproduce los mismos nombres y dictámenes. Los 432 resultados se conservan en el JSON. PASS es relativo a los controles y referencias de esta muestra, no una declaración de cobertura universal.

## Defectos y prioridad

### V008-N01 — P2 — Elisión incorrecta ante sufijos múltiples, 2013 español

| Caso | Nombre esperado independiente | Observado |
| --- | --- | --- |
| V008-030 | butano-1,3-diol | butan-1,3-diol |
| V008-038 | heptano-2,5-diona | heptan-2,5-diona |
| V008-056 | hexano-1,6-diamina | hexan-1,6-diamina |
| V008-070 | 3-etilpentano-1,5-diol | 3-etilpentan-1,5-diol |

**Causa raíz observada:** `makeFunctionalParentName()`, en `app/page.tsx`, calcula un `stem` eliminando la o final antes de decidir si el sufijo es mono- o multiplicado. Las ramas de alcohol, cetona y amina con varios grupos usan siempre ese stem. Esto elimina la vocal ante d, que no exige elisión.

**Respaldo:** RSEQ, guía española, §4 (ejemplo heptano-2,4-diona) y §6b (ejemplo etano-1,2-diol); P-16.7 y reglas de grupos de P-62/63/64. La extensión a diamina aplica la misma regla ante consonante y el vocabulario español, no una salida de OrgoRush. La severidad P2 distingue un error normativo/morfológico de un nombre que demostrablemente identifica otro grafo. Las cuatro fórmulas y selecciones de padre son correctas.

**Antes del piloto:** corregir la formación del padre con sufijos multiplicados y contrastar las repercusiones en derivados mixtos y explicaciones. Esta tarea solo documenta el defecto.

### V008-R01 — P1 — Benceno presentado como cadena alifática en Legacy ES/EN

Casos V008-025 y V008-026, en ambos perfiles históricos. Los nombres 1-etil-3-metilbenceno / 1-ethyl-3-methylbenzene y 1-bromo-3-clorobenceno / 1-bromo-3-chlorobenzene son correctos; su explicación dice “cadena principal de 6 carbonos”, “raíz numérica ... hex-” y “fragmento de cadena ... benceno-”, o sus equivalentes ingleses. Hex- no es un fragmento del nombre visible de ese padre retenido.

**Causa raíz observada:** `legacyStructuralReasoningText()`, en `app/page.tsx`, trata como anillo solo `family === cycloalkane`; el caso aromatic cae en la descripción de cadena. La descomposición compartida de REASONING-007 deriva una raíz alifática a partir de seis carbonos sin excluir ese padre retenido. Las pruebas de REASONING-007 cubrían familias alifáticas y no estos aromáticos.

**Respaldo:** A-11.3 conserva benzene; P-22 reconoce el padre aromático. No corresponde explicar ese nombre retenido mediante la raíz de hexano. Los átomos del anillo y sus fragmentos visibles están bien; el defecto demostrado es el texto pedagógico. Corregir antes de enseñar esa explicación a estudiantes.

### V008-H01 — Riesgo P1 pendiente de adjudicación histórica; sin FAIL demostrado

| Caso | Referencia histórica construida | Observado Legacy ES |
| --- | --- | --- |
| V008-067 | 2-metoxi-1-hexanol | 2-metoxihexanol |
| V008-068 | 3-etil-2-metil-1-heptanol | 3-etil-2-metilheptanol |

La ruta española nativa reutiliza `formatTraditionalSystematicName()`, en `app/nomenclature-conventions.ts`, que suprime expresamente el locante terminal de alcoholes como forma tradicional. La ruta inglesa conserva 1. No se ha localizado en las fuentes consultadas una autorización histórica suficiente para certificar estas dos omisiones concretas como nombres sistemáticos de 1979. Tampoco se usa una exigencia de PIN de 2013 como prueba de invalidez en 1979.

Mantener esos dos casos fuera de materiales de referencia evaluados hasta documentar la excepción aplicable o decidir una corrección con respaldo. Su grafo, grupos, fórmula y numeración internos son correctos. La explicación menciona C1, pero el nombre visible lo omite; esa diferencia requiere adjudicación, no una aceptación automática.

### V008-I01 — P2 — Diferencia entre importación y grafo de editor

V008-023 (bicyclo[2.2.2]octane) y V008-024 (spiro[3.4]octane) son rechazados por el importador SMILES con mensaje explícito de soporte limitado. **Ese rechazo no equivale a que Legacy no pueda nombrarlos.** Construyendo el mismo grafo constitucional de manera independiente, con el contrato ordinario del editor, ambos perfiles Legacy dan el nombre esperado y pasan los controles. 2013 sigue expresamente no disponible para esos grafos.

El JSON conserva el error de importación, la ruta alternativa utilizada y ambos grafos exportados. Los PASS Legacy de estas dos filas se refieren a la entrada de grafo de editor, nunca a una importación que haya tenido éxito. Se recomienda alinear y comunicar esas coberturas antes del piloto, sin atribuir una conectividad incorrecta a un rechazo seguro.

## Cobertura no implementada

- **2013-es**: V008-023, V008-024, V008-071, V008-072.
- **1979-en**: V008-071, V008-072.
- **1979-es**: V008-012, V008-013, V008-035, V008-043, V008-047, V008-049, V008-050, V008-051, V008-059, V008-065, V008-069, V008-071, V008-072.

Los límites incluyen polienos españoles históricos, ciertas funciones insaturadas, éteres Legacy ES, amidas N-sustituidas, algunas funciones mixtas y grupos principales que quedan en ramas. V008-071 es el ejemplo publicado de dos OH frente a una cadena más larga con uno solo; V008-072 obliga a conservar un tercer OH como prefijo. En ambos, el producto declina nombrar: se conserva UNSUPPORTED, sin declarar aprobado un nombre ausente.

## Matriz completa: esperado frente a observado

En cada fila, la fórmula de referencia coincide con la observada en los tres análisis; sus grafías originales se conservan en el JSON. La última palabra de cada celda es el dictamen. Las referencias y la derivación normativa específicas por estructura están en `references` y `derivation` de la [matriz reproducible](orgorush-validation-008.matrix.json), resueltas contra el inventario de fuentes al final del informe.

| ID / familia | SMILES | Fórmula | IUPAC 2013 ES | IUPAC 1979 EN | IUPAC 1979 ES |
| --- | --- | --- | --- | --- | --- |
| V008-001 (alkane) | `CCCCCCC` | C7H16 | heptano · **PASS** | heptane · **PASS** | heptano · **PASS** |
| V008-002 (alkane) | `CCCCCCCCC` | C9H20 | nonano · **PASS** | nonane · **PASS** | nonano · **PASS** |
| V008-003 (alkane) | `CCC(C)CCCC` | C8H18 | 3-metilheptano · **PASS** | 3-methylheptane · **PASS** | 3-metilheptano · **PASS** |
| V008-004 (alkane) | `CCC(C)(C)CC` | C7H16 | 3,3-dimetilpentano · **PASS** | 3,3-dimethylpentane · **PASS** | 3,3-dimetilpentano · **PASS** |
| V008-005 (alkane) | `CCC(CC)CCC` | C8H18 | 3-etilhexano · **PASS** | 3-ethylhexane · **PASS** | 3-etilhexano · **PASS** |
| V008-006 (alkane) | `CC(C)C(C)C(C)C` | C8H18 | 2,3,4-trimetilpentano · **PASS** | 2,3,4-trimethylpentane · **PASS** | 2,3,4-trimetilpentano · **PASS** |
| V008-007 (alkane) | `CCCC(CC)CCCCC` | C11H24 | 4-etilnonano · **PASS** | 4-ethylnonane · **PASS** | 4-etilnonano · **PASS** |
| V008-008 (selection) | `CCCC(C=C)CCC` | C9H18 | 4-etenilheptano · **PASS** | 3-propyl-1-hexene · **PASS** | 3-propil-1-hexeno · **PASS** |
| V008-009 (unsaturated) | `C=CCCCCCC` | C8H16 | oct-1-eno · **PASS** | 1-octene · **PASS** | 1-octeno · **PASS** |
| V008-010 (unsaturated) | `CC=CCCCC` | C7H14 | hept-2-eno · **PASS** | 2-heptene · **PASS** | 2-hepteno · **PASS** |
| V008-011 (unsaturated) | `CC=CC(C)CC` | C7H14 | 4-metilhex-2-eno · **PASS** | 4-methyl-2-hexene · **PASS** | 4-metil-2-hexeno · **PASS** |
| V008-012 (unsaturated) | `C=CCCCC=C` | C7H12 | hepta-1,6-dieno · **PASS** | 1,6-heptadiene · **PASS** | Esperado: 1,6-heptadieno; observado: No disponible · **UNSUPPORTED** |
| V008-013 (unsaturated) | `C=CC=CC=C` | C6H8 | hexa-1,3,5-trieno · **PASS** | 1,3,5-hexatriene · **PASS** | Esperado: 1,3,5-hexatrieno; observado: No disponible · **UNSUPPORTED** |
| V008-014 (unsaturated) | `C#CCCCCC` | C7H12 | hept-1-ino · **PASS** | 1-heptyne · **PASS** | 1-heptino · **PASS** |
| V008-015 (unsaturated) | `CCC#CCCCC` | C8H14 | oct-3-ino · **PASS** | 3-octyne · **PASS** | 3-octino · **PASS** |
| V008-016 (unsaturated) | `C#CC=CCC` | C6H8 | hex-3-en-1-ino · **PASS** | 3-hexen-1-yne · **PASS** | 3-hexen-1-ino · **PASS** |
| V008-017 (ring) | `C1CCCCCCC1` | C8H16 | ciclooctano · **PASS** | cyclooctane · **PASS** | ciclooctano · **PASS** |
| V008-018 (ring) | `CCC1CCCC1` | C7H14 | etilciclopentano · **PASS** | ethylcyclopentane · **PASS** | etilciclopentano · **PASS** |
| V008-019 (ring) | `CC1CC(C)CCC1` | C8H16 | 1,3-dimetilciclohexano · **PASS** | 1,3-dimethylcyclohexane · **PASS** | 1,3-dimetilciclohexano · **PASS** |
| V008-020 (ring) | `C1=CCCCCC1` | C7H12 | Esperado: ciclohepteno; observado: ciclohept-1-eno · **PASS** | Esperado: cycloheptene; observado: 1-cycloheptene · **PASS** | Esperado: ciclohepteno; observado: 1-ciclohepteno · **PASS** |
| V008-021 (fused) | `c1ccc2ccccc2c1` | C10H8 | naftaleno · **PASS** | naphthalene · **PASS** | naftaleno · **PASS** |
| V008-022 (fused) | `c1ccc2cc3ccccc3cc2c1` | C14H10 | antraceno · **PASS** | anthracene · **PASS** | antraceno · **PASS** |
| V008-023 (ring) | `C1CC2CCC1CC2` | C8H14 | Esperado: biciclo[2.2.2]octano; observado: No disponible · **UNSUPPORTED** | bicyclo[2.2.2]octane · **PASS** | biciclo[2.2.2]octano · **PASS** |
| V008-024 (ring) | `C1CCC2(C1)CCC2` | C8H14 | Esperado: espiro[3.4]octano; observado: No disponible · **UNSUPPORTED** | spiro[3.4]octane · **PASS** | espiro[3.4]octano · **PASS** |
| V008-025 (aromatic) | `CCc1cccc(C)c1` | C9H12 | 1-etil-3-metilbenceno · **PASS** | 1-ethyl-3-methylbenzene · **FAIL-REASONING** | 1-etil-3-metilbenceno · **FAIL-REASONING** |
| V008-026 (aromatic) | `Brc1cccc(Cl)c1` | C6H4BrCl | 1-bromo-3-clorobenceno · **PASS** | 1-bromo-3-chlorobenzene · **FAIL-REASONING** | 1-bromo-3-clorobenceno · **FAIL-REASONING** |
| V008-027 (alcohol) | `CC(O)CCCCC` | C7H16O | heptan-2-ol · **PASS** | 2-heptanol · **PASS** | 2-heptanol · **PASS** |
| V008-028 (alcohol) | `CC(O)C(C)CC` | C6H14O | 3-metilpentan-2-ol · **PASS** | 3-methyl-2-pentanol · **PASS** | 3-metil-2-pentanol · **PASS** |
| V008-029 (alcohol) | `CC(C)C(O)CCC` | C7H16O | 2-metilhexan-3-ol · **PASS** | 2-methyl-3-hexanol · **PASS** | 2-metil-3-hexanol · **PASS** |
| V008-030 (alcohol) | `OCCC(O)C` | C4H10O2 | Esperado: butano-1,3-diol; observado: butan-1,3-diol · **FAIL-NAME** | 1,3-butanediol · **PASS** | 1,3-butanodiol · **PASS** |
| V008-031 (alcohol) | `CC(O)CC=C` | C5H10O | pent-4-en-2-ol · **PASS** | 4-penten-2-ol · **PASS** | 4-penten-2-ol · **PASS** |
| V008-032 (alcohol) | `OC1CCCCCCC1` | C8H16O | ciclooctanol · **PASS** | cyclooctanol · **PASS** | ciclooctanol · **PASS** |
| V008-033 (aldehyde) | `CCCCCCC=O` | C7H14O | heptanal · **PASS** | heptanal · **PASS** | heptanal · **PASS** |
| V008-034 (aldehyde) | `O=CCC(C)CCC` | C7H14O | 3-metilhexanal · **PASS** | 3-methylhexanal · **PASS** | 3-metilhexanal · **PASS** |
| V008-035 (aldehyde) | `O=CC=CCCC` | C6H10O | hex-2-enal · **PASS** | 2-hexenal · **PASS** | Esperado: 2-hexenal; observado: No disponible · **UNSUPPORTED** |
| V008-036 (ketone) | `CCC(=O)CCCCC` | C8H16O | octan-3-ona · **PASS** | 3-octanone · **PASS** | 3-octanona · **PASS** |
| V008-037 (ketone) | `CC(=O)CC(C)CC` | C7H14O | 4-metilhexan-2-ona · **PASS** | 4-methyl-2-hexanone · **PASS** | 4-metil-2-hexanona · **PASS** |
| V008-038 (ketone) | `CC(=O)CCC(=O)CC` | C7H12O2 | Esperado: heptano-2,5-diona; observado: heptan-2,5-diona · **FAIL-NAME** | 2,5-heptanedione · **PASS** | 2,5-heptanodiona · **PASS** |
| V008-039 (ketone) | `CC(=O)CCC=C` | C6H10O | hex-5-en-2-ona · **PASS** | 5-hexen-2-one · **PASS** | 5-hexen-2-ona · **PASS** |
| V008-040 (ketone) | `O=C1CCCCCCC1` | C8H14O | ciclooctanona · **PASS** | cyclooctanone · **PASS** | ciclooctanona · **PASS** |
| V008-041 (acid) | `CCCCCCC(=O)O` | C7H14O2 | ácido heptanoico · **PASS** | heptanoic acid · **PASS** | ácido heptanoico · **PASS** |
| V008-042 (acid) | `O=C(O)CC(C)CC` | C6H12O2 | ácido 3-metilpentanoico · **PASS** | 3-methylpentanoic acid · **PASS** | ácido 3-metilpentanoico · **PASS** |
| V008-043 (acid) | `O=C(O)C=CCCC` | C6H10O2 | ácido hex-2-enoico · **PASS** | 2-hexenoic acid · **PASS** | Esperado: ácido 2-hexenoico; observado: No disponible · **UNSUPPORTED** |
| V008-044 (acid) | `O=C(O)CCCCC(=O)O` | C6H10O4 | ácido hexanodioico · **PASS** | hexanedioic acid · **PASS** | ácido hexanodioico · **PASS** |
| V008-045 (ester) | `CCCC(=O)OCCC` | C7H14O2 | butanoato de propilo · **PASS** | propyl butanoate · **PASS** | butanoato de propilo · **PASS** |
| V008-046 (ester) | `CC(C)CC(=O)OCC` | C7H14O2 | 3-metilbutanoato de etilo · **PASS** | ethyl 3-methylbutanoate · **PASS** | 3-metilbutanoato de etilo · **PASS** |
| V008-047 (ester) | `CCC=CC(=O)OC` | C6H10O2 | pent-2-enoato de metilo · **PASS** | methyl 2-pentenoate · **PASS** | Esperado: 2-pentenoato de metilo; observado: No disponible · **UNSUPPORTED** |
| V008-048 (ester) | `CCC(=O)OCCCC` | C7H14O2 | propanoato de butilo · **PASS** | butyl propanoate · **PASS** | propanoato de butilo · **PASS** |
| V008-049 (ether) | `CC(OC)CCC` | C6H14O | 2-metoxipentano · **PASS** | 2-methoxypentane · **PASS** | Esperado: 2-metoxipentano; observado: No disponible · **UNSUPPORTED** |
| V008-050 (ether) | `CCC(OCC)CCC` | C8H18O | 3-etoxihexano · **PASS** | 3-ethoxyhexane · **PASS** | Esperado: 3-etoxihexano; observado: No disponible · **UNSUPPORTED** |
| V008-051 (ether) | `COCCCC` | C5H12O | 1-metoxibutano · **PASS** | 1-methoxybutane · **PASS** | Esperado: 1-metoxibutano; observado: No disponible · **UNSUPPORTED** |
| V008-052 (amine) | `CC(N)CCCCC` | C7H17N | heptan-2-amina · **PASS** | 2-heptanamine · **PASS** | 2-heptanamina · **PASS** |
| V008-053 (amine) | `NCCC(C)CC` | C6H15N | 3-metilpentan-1-amina · **PASS** | 3-methyl-1-pentanamine · **PASS** | 3-metil-1-pentanamina · **PASS** |
| V008-054 (amine) | `CC(NCC)CCC` | C7H17N | N-etilpentan-2-amina · **PASS** | N-ethyl-2-pentanamine · **PASS** | N-etil-2-pentanamina · **PASS** |
| V008-055 (amine) | `CCCCN(C)C` | C6H15N | N,N-dimetilbutan-1-amina · **PASS** | N,N-dimethyl-1-butanamine · **PASS** | N,N-dimetil-1-butanamina · **PASS** |
| V008-056 (amine) | `NCCCCCCN` | C6H16N2 | Esperado: hexano-1,6-diamina; observado: hexan-1,6-diamina · **FAIL-NAME** | 1,6-hexanediamine · **PASS** | 1,6-hexanodiamina · **PASS** |
| V008-057 (amide) | `CCCCCC(=O)N` | C6H13NO | hexanamida · **PASS** | hexanamide · **PASS** | hexanamida · **PASS** |
| V008-058 (amide) | `NC(=O)CC(C)CC` | C6H13NO | 3-metilpentanamida · **PASS** | 3-methylpentanamide · **PASS** | 3-metilpentanamida · **PASS** |
| V008-059 (amide) | `CCCC(=O)NCC` | C6H13NO | N-etilbutanamida · **PASS** | N-ethylbutanamide · **PASS** | Esperado: N-etilbutanamida; observado: No disponible · **UNSUPPORTED** |
| V008-060 (nitrile) | `CCCCCC#N` | C6H11N | hexanonitrilo · **PASS** | hexanenitrile · **PASS** | hexanonitrilo · **PASS** |
| V008-061 (nitrile) | `N#CCC(C)CC` | C6H11N | 3-metilpentanonitrilo · **PASS** | 3-methylpentanenitrile · **PASS** | 3-metilpentanonitrilo · **PASS** |
| V008-062 (nitrile) | `N#CCCCC#N` | C5H6N2 | pentanodinitrilo · **PASS** | pentanedinitrile · **PASS** | pentanodinitrilo · **PASS** |
| V008-063 (mixed) | `CC(=O)CC(O)CC` | C6H12O2 | 4-hidroxihexan-2-ona · **PASS** | 4-hydroxy-2-hexanone · **PASS** | 4-hidroxi-2-hexanona · **PASS** |
| V008-064 (mixed) | `O=C(O)CC(N)CC` | C5H11NO2 | ácido 3-aminopentanoico · **PASS** | 3-aminopentanoic acid · **PASS** | ácido 3-aminopentanoico · **PASS** |
| V008-065 (mixed) | `N#CC(O)CC` | C4H7NO | 2-hidroxibutanonitrilo · **PASS** | 2-hydroxybutanenitrile · **PASS** | Esperado: 2-hidroxibutanonitrilo; observado: No disponible · **UNSUPPORTED** |
| V008-066 (mixed) | `O=CCCC(=O)C` | C5H8O2 | 4-oxopentanal · **PASS** | 4-oxopentanal · **PASS** | 4-oxopentanal · **PASS** |
| V008-067 (mixed) | `OCC(OC)CCCC` | C7H16O2 | 2-metoxihexan-1-ol · **PASS** | 2-methoxy-1-hexanol · **PASS** | Esperado: 2-metoxi-1-hexanol; observado: 2-metoxihexanol · **Sin dictamen: referencia histórica insuficiente** |
| V008-068 (selection) | `OCC(C)C(CC)CCCC` | C10H22O | 3-etil-2-metilheptan-1-ol · **PASS** | 3-ethyl-2-methyl-1-heptanol · **PASS** | Esperado: 3-etil-2-metil-1-heptanol; observado: 3-etil-2-metilheptanol · **Sin dictamen: referencia histórica insuficiente** |
| V008-069 (selection) | `C=CCC(CCC)CC=C` | C10H18 | 4-propilhepta-1,6-dieno · **PASS** | 4-propyl-1,6-heptadiene · **PASS** | Esperado: 4-propil-1,6-heptadieno; observado: No disponible · **UNSUPPORTED** |
| V008-070 (selection) | `OCCC(CC)CCO` | C7H16O2 | Esperado: 3-etilpentano-1,5-diol; observado: 3-etilpentan-1,5-diol · **FAIL-NAME** | 3-ethyl-1,5-pentanediol · **PASS** | 3-etil-1,5-pentanodiol · **PASS** |
| V008-071 (selection) | `OCCC(CCCCCl)C(O)C` | C9H19ClO2 | Esperado: 3-(4-clorobutil)pentano-1,4-diol; observado: No disponible · **UNSUPPORTED** | Esperado: 3-(4-chlorobutyl)-1,4-pentanediol; observado: No disponible · **UNSUPPORTED** | Esperado: 3-(4-clorobutil)-1,4-pentanodiol; observado: No disponible · **UNSUPPORTED** |
| V008-072 (selection) | `OCCC(CO)CCCCO` | C8H18O3 | Esperado: 3-(hidroximetil)heptano-1,7-diol; observado: No disponible · **UNSUPPORTED** | Esperado: 3-(hydroxymethyl)-1,7-heptanediol; observado: No disponible · **UNSUPPORTED** | Esperado: 3-(hidroximetil)-1,7-heptanodiol; observado: No disponible · **UNSUPPORTED** |

## Reproducibilidad y regresiones

Archivos añadidos:

- `tests/fixtures/orgorush-validation-008.mjs`: corpus independiente y procedencia.
- `tests/fixtures/orgorush-validation-008.review.mjs`: adjudicaciones posteriores, sin cambiar los esperados.
- `tests/fixtures/orgorush-validation-008.opsin.json`: respuestas externas congeladas e íntegramente verificables por SHA-256.
- `tests/helpers/validation-008-reference.mjs`: lector, fórmula, grupos y enumeración de cadenas independientes.
- `scripts/validation-008-audit.mjs`: evaluación de producción y modo estricto.
- `scripts/validation-008-fetch-opsin.mjs`: renovación opcional y explícita de evidencia externa.
- `scripts/validation-008-report.mjs`: regeneración de este informe desde la matriz.
- `tests/orgorush-validation-008.test.mjs`: contratos de auditoría, referencias, permutaciones y controles negativos.
- `reports/orgorush-validation-008.matrix.json` y este informe.

Sin red, usando las respuestas congeladas:

```powershell
node scripts/validation-008-audit.mjs
node scripts/validation-008-report.mjs
node --test --test-concurrency=1 tests/orgorush-validation-008.test.mjs
node scripts/validation-008-audit.mjs --strict
```

El modo normal genera la evaluación sin ocultar errores. El modo estricto devuelve **exit 1** cuando quedan defectos demostrados o referencias pendientes; un UNSUPPORTED explícito conserva su categoría y no es por sí solo un error químico. Para renovar evidencias con red: `node scripts/validation-008-fetch-opsin.mjs --observed`.

Pruebas de esta ejecución: **168/168 aprobadas, 0 fallidas**, sobre la auditoría y las regresiones FALLBACK-005, FALLBACK-006 y REASONING-007. **Esos PASS verifican los contratos del auditor y la reproducción visible de los defectos; no convierten los ocho FAIL de la matriz química en aprobados.** Se inyectan además una fórmula falsa y un resaltado OH presentado como cetona para demostrar que el evaluador distingue FAIL-STRUCTURE y FAIL-REASONING aun con un nombre correcto. Los tests fallarán si cambian los hallazgos o aparece un defecto nuevo, obligando a revisar el registro.

No se vuelve a ejecutar la suite global de generación de ejercicios ni se reconstruyen Pages/Sites: no hay cambios en código de producción. Los registros locales de ejecución están en `outputs/validation-008-*.log` (ignorados por Git). Se conserva la separación entre pruebas de software y veredicto químico.

## Fuentes verificables

Consultadas durante esta auditoría; edición 2013 con sus correcciones publicadas y reproducción autorizada de la edición 1979. Fecha local: 22 de octubre de 2026; los registros externos conservan fecha UTC.

- **modern**: [P-41, P-44.1, P-44.3, P-44.4](https://iupac.qmul.ac.uk/BlueBook/P4.html). 2013 parent/group seniority; independent rule application.
- **modernSyntax**: [P-14.3, P-14.4, P-14.5, P-16.7](https://iupac.qmul.ac.uk/BlueBook/P1.html). 2013 numbering, locants, alphabetical citation and vowel elision.
- **modernHydrocarbons**: [P-21, P-22, P-23, P-24, P-25](https://iupac.qmul.ac.uk/BlueBook/P2.html). 2013 chain/ring/spiro/fused parents.
- **modernFunctions**: [P-62, P-63, P-64, P-65](https://iupac.qmul.ac.uk/BlueBook/P6.html). 2013 amines, hydroxy/ether, ketone, acid/ester rules.
- **modernNitrogen**: [P-66.1, P-66.5, P-66.6](https://iupac.qmul.ac.uk/BlueBook/P6a.html). 2013 amides, nitriles and aldehydes.
- **historicalParent**: [C-13.11(a-k)](https://www.acdlabs.com/iupac/nomenclature/79/r79_933.htm). 1979 principal group > multiple bonds > length; numbering.
- **historicalNumbering**: [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm). 1979 suffix/multiple-bond/prefix numbering order.
- **historicalHydrocarbons**: [A-1, A-2, A-3](https://www.acdlabs.com/iupac/nomenclature/79/r79_2.htm). 1979 hydrocarbon grammar; use linked rules, not 1993 revisions.
- **historicalUnsaturation**: [A-3.1-4](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm). 1979 ene/yne/enyne grammar and seniority.
- **historicalRings**: [A-11](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm). 1979 monocyclic parents.
- **historicalFused**: [A-21](https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm). 1979 retained aromatic fused parents.
- **historicalBridges**: [A-31](https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm). 1979 bicyclo bridge counts.
- **historicalSpiro**: [A-41](https://www.acdlabs.com/iupac/nomenclature/79/r79_197.htm). 1979 spiro ring counts.
- **historicalGroups**: [Table C-III](https://www.acdlabs.com/iupac/nomenclature/79/r79_905.htm). 1979 suffix/prefix identities and priority.
- **historicalAlcohol**: [C-201.1-2](https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm). 1979 -ol / hydroxy-.
- **historicalAldehyde**: [C-302.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_249.htm). 1979 hydrocarbon parent + -al.
- **historicalKetone**: [C-312.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_267.htm). 1979 -one/-dione.
- **historicalAcid**: [C-401.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm). 1979 parent + -oic acid/-dioic acid.
- **historicalPolyamine**: [C-813.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_517.htm). 1979 diamine/polyamine parent construction.
- **historicalEther**: [C-211](https://www.acdlabs.com/iupac/nomenclature/79/r79_227.htm). 1979 alkoxyalkane and functional-class alternatives.
- **historicalEster**: [C-463.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_363.htm). 1979 O-alkyl + acid-derived ester component.
- **historicalAmine**: [C-812.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_513.htm). 1979 radical/parent amine alternatives.
- **historicalSecondaryAmine**: [C-814.4](https://www.acdlabs.com/iupac/nomenclature/79/r79_522.htm). 1979 N-substitution of the senior primary-amine parent.
- **historicalAmide**: [C-822.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_541.htm). 1979 acid-to-amide construction.
- **historicalNAmide**: [C-824.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_548.htm). 1979 N-substituted amides.
- **historicalNitrile**: [C-832.1, C-832.5](https://www.acdlabs.com/iupac/nomenclature/79/r79_566.htm). 1979 full hydrocarbon + nitrile; C#N carbon belongs to parent.
- **spanishLexicon**: [Tables 1-3; sections 4, 6b, 7, 8](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf). Spanish lexical/morphological forms and printed 2013 examples; for 1979 ONLY vocabulary, never modern parent selection or locant placement.
- **opsin**: [name-to-structure service](https://www.ebi.ac.uk/opsin/). Constitution cross-check ONLY; does not certify a historical or preferred name.

## Decisión y tareas previas a docencia

1. **P1:** corregir el razonamiento aromático Legacy y añadir regresiones de anillo retenido para ES/EN, sin cambiar los nombres correctos.
2. **P2:** corregir la vocal del padre español ante sufijos multiplicados y verificar sus repercusiones en alcoholes, cetonas y aminas.
3. **Pendiente histórico de riesgo P1:** adjudicar las dos omisiones de locante OH con fuente histórica suficiente antes de utilizarlas como respuestas modelo.
4. Mantener visibles los UNSUPPORTED, resolver o explicar la diferencia importador/editor y acotar expresamente cualquier piloto a dominios verificados.

Este es un control inicial de 72 constituciones, no una certificación universal de los tres perfiles ni una revisión firmada por un especialista externo. Los cambios permanecen locales para revisión.
