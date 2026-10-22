# ORGORUSH-IUPAC79-AROMATIC-004

## Auditoría inicial

Base `f5f3ca9`, árbol limpio. Se inspeccionaron los motores y adaptadores antes
de modificar aplicación. Esta clasificación precede a la implementación y se
contrastará con una matriz reproducible.

| Ruta | Diagnóstico inicial |
| --- | --- |
| `formatIupac1979SpanishName` | Gramática léxica finita; rechaza múltiples bencenos válidos que el modelo inglés ya representa |
| `legacySpanishFormatterInput` | Protege pruebas de grafo de fusionados; no constituye un traductor ni una validación de todos los nombres |
| `legacy-profile-display.ts` | Excepción textual TNT ligada a Suggested; falta una resolución general con procedencia explícita |
| `buildLegacyEnglishNameModel` | Conserva padre, funciones y prefijos, pero pierde IDs de átomos de prefijos/funciones y alternativas de numeración; no basta por sí solo para certificar identidad |
| `nameSubstituents` / orden y numeración | Ordena palabras inglesas sobre locantes seleccionados desde un análisis español; deben separarse citación y orientación por idioma |
| `nameRetainedFused1979` | Siete padres/patrones, solo un metilo o halógeno en naftaleno; representación de padres supone un ciclo hamiltoniano que pireno no posee |
| `normalize` y emparejamiento | Isomorfismo de átomos/enlaces aromáticos; hay que preservar valencias e hidrogenación reales al ampliar sustitución |
| Disponibilidad en la página | Ya separada de Modern por CYCLIC-AUDIT-003; falta distinguir nativo ES, inglés completo y traducción verificada |
| Seguridad química / estereoquímica | Mantener valencia, conectividad, representación completa de funciones y descriptores explícitos; no admitir una traducción por el solo hecho de obtener texto |

Las reglas seleccionadas son A-12, A-21/A-22/A-23, A-2.3–4, C-15.11 y
C-16.31–36 de 1979. La terminología española se contrastará con la guía
traducida de IUPAC/RSEQ, sin importar sus reglas PIN modernas.

Fuentes principales:

- [A-12](https://www.acdlabs.com/iupac/nomenclature/79/r79_61.htm).
- [A-21](https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm),
  [A-22](https://www.acdlabs.com/iupac/nomenclature/79/r79_72.htm),
  [A-23](https://www.acdlabs.com/iupac/nomenclature/79/r79_73.htm).
- [A-2.3–4](https://www.acdlabs.com/iupac/nomenclature/79/r79_36.htm).
- [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm),
  [C-16.31–36](https://www.acdlabs.com/iupac/nomenclature/79/r79_883.htm).
- [Terminología española IUPAC/RSEQ](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf).

## Resultado y procedencia

La resolución de producción distingue `NATIVE_ES`,
`TRANSLATED_FROM_LEGACY_EN` y `UNSUPPORTED`. La disponibilidad química se
evalúa antes de admitir cualquiera de las dos rutas españolas; un rechazo
léxico del formateador ES no bloquea la ruta inglesa.

La [matriz final](orgorush-iupac79-aromatic-004.matrix.md) y su
[JSON](orgorush-iupac79-aromatic-004.matrix.json) contienen **63 estructuras,
315 observaciones: 56 referencias positivas correctas, 0 FAIL y 7 límites
UNSUPPORTED comprobados**. Entre las referencias positivas hay **26
NATIVE_ES y 30 TRANSLATED_FROM_LEGACY_EN**. Cada estructura se prueba con
metadatos originales, sin anillos almacenados, rotación, reflexión/reasignación
de IDs y metadatos de anillos obsoletos.

Las expectativas de nombres y SMILES se conservan en el fixture independiente
del generador. Fórmula, número de ciclos y conectividad se comprueban con
OpenChemLib; la validación de la traducción compara además los grafos completos
con correspondencias obligatorias de los átomos del padre. Obtener un nombre
no basta para contar un PASS.

La [línea base](orgorush-iupac79-aromatic-004.baseline.json) reproduce las
56 referencias positivas contra un archivo aislado de `f5f3ca9`, usando las
mismas dependencias. La captura inicial de 48 casos precedió a los cambios;
los ocho casos añadidos durante la investigación se contrastaron también
contra ese código original, no contra la implementación corregida.

## Cobertura auditada y ampliada

| Familia | Cobertura final verificada | Ruta |
| --- | --- | --- |
| A: bencenos | 29 referencias: padre, alquilos, alquenilos, halógenos, orto/meta/para numéricos, sustitución múltiple, radical complejo, éter, fenol, anilina, nitro/TNT, ácido, aldehído, nitrilo, amida y benzoatos | Traducción semántica y prueba completa de grafo |
| B: fusionados | 10 padres: naftaleno, antraceno, fenantreno, indeno, fluoreno, azuleno, pireno, fluoranteno, bifenileno y trifenileno | Nativo ES y EN, A-21/A-22 |
| C: derivados fusionados | 11 referencias: mono/multialquilo, mono/multihalógeno, cambio de orden ES/EN con locantes fijos, naftol y metilnaftol, dihidro y tetrahidronaftaleno | Nativo con prueba de grafo |
| D: otros | Bifenilo, cadena con fenilo y alcohol/cetona, alquenilo unido a benceno, piridina y furano | Nativo en cinco casos; fallback para el alquenilo |

El registro pasa de siete a **doce patrones numerados**: diez padres retenidos
y dos constituciones hidrogenadas de naftaleno. Se elimina la restricción
«un metilo o halógeno, solo en naftaleno». La regla de sustitución ahora
reconoce componentes externos completos, con una única unión al padre:
alquilos lineales C1–C20 y F/Cl/Br/I, solos o repetidos, sobre los padres
registrados. El sufijo naftol admite un OH y sus prefijos alquilo/halógeno.
No se decide por el SMILES de una molécula concreta.

La periferia y las aristas interiores son conceptos separados. El pireno
contiene dos átomos interiores: no se inventa una periferia hamiltoniana de
16 átomos. Se conservan **10b y 10c de 1979**. La nota de
[FR-5.5.2 de 1998](https://iupac.qmul.ac.uk/fusedring/FR53.html) documenta
expresamente el cambio posterior a 3a¹ y 5a¹; estos últimos no se importan al
perfil Legacy. Los grafos numerados nuevos se transcribieron de las figuras
A-21(6), (14), (17) y (18), con sus dobles enlaces e hidrógenos.

La aromaticidad normalizada permite comparar formas de Kekulé equivalentes,
pero no sustituye la constitución. Se comprueban hidrógenos implícitos,
elementos, cargas y órdenes de enlace. Los patrones dihidro, tetrahidro y
aromático son diferentes. Los sistemas completamente saturados ya cubiertos
siguen usando las reglas A-31/A-32 existentes; no se renombran como un
hidroderivado retenido por compartir la fórmula o el esqueleto.

## Arquitectura del fallback

`iupac1979-english-to-spanish.ts` recibe el modelo Legacy inglés, su nombre
completo y el grafo original. No analiza un nombre completo mediante una
colección de reemplazos. La ruta de benceno:

1. Comprueba el perfil, el padre, los locantes, las funciones y la
   consistencia entre el nombre inglés y su propio generador.
2. Reconstruye un grafo independiente desde componentes químicos conocidos.
   El vocabulario incluye estructura de cada radical/grupo, cargas del nitro,
   y el radical unido al oxígeno de un benzoato.
3. Exige una biyección de todos los átomos y enlaces, fijando además la
   correspondencia de cada posición del padre con su átomo real. Compara
   también las funciones subordinadas con los prefijos que las representan.
4. Enumera las simetrías permitidas del ciclo y construye el nombre español
   con sus términos, multiplicadores y jerarquía funcional.
5. Repite la comprobación de identidad con la numeración española elegida.

Para los padres retenidos, el modelo transporta ID y locantes del registro.
Se vuelve a obtener la prueba del grafo completo y se exige que el inglés,
el padre y la numeración coincidan con ella. Se reutiliza el generador
retenido para sus formas españolas; la traducción no inventa descriptores ni
renumera un padre fijo mediante operaciones sobre dígitos.

`iupac1979-name-structure.ts` concentra vocabulario estructurado, fragmentos
y comparación de grafos. `legacy-name-numbering.ts` comparte las reglas de
numeración/citación entre el generador EN, el adaptador y el traductor.
Se reutilizan las raíces existentes y el analizador de radicales; no hay
servicios externos ni traducción por IA.

El comparador final de identidad está acotado a 20 000 visitas, 120 átomos y los
límites de topología existentes. Agotar un límite produce rechazo, no una
prueba parcial.

## Reglas de numeración y citación

Se aplican A-12.2–3, A-2.3–4, C-15.11 y C-16.31–34. Primero se comparan
locantes de función principal; después, los conjuntos de locantes de
prefijos, lexicográficamente. El desempate considera los locantes del
prefijo citado primero **en el idioma correspondiente**. Se enumeran las
doce orientaciones del ciclo de benceno mediante sus átomos y enlaces.

Los multiplicadores externos de grupos iguales se añaden después de
calcular su clave alfabética. Los multiplicadores internos de un radical
complejo permanecen en ella: `1,1-dimetiletil` se ordena por d. Se conserva
el tratamiento histórico de sec-/tert-. Se prueba un radical complejo junto
con etilo, además de sustituyentes repetidos y los tres patrones de xileno.

El inglés también selecciona su propia orientación; anteriormente ordenaba
las palabras inglesas sobre una numeración ya elegida en español.

Para radicales alquenilo, se usa A-3.5: la valencia libre recibe el número 1,
y la posición del doble enlace se cita como en `1-propenyl`. El equivalente
español es `1-propenil`. No se toma automáticamente la forma posterior
`prop-1-en-1-yl`. La elección de benceno como padre para este caso es
compatible con A-61.2 y A-61.4.

Fuentes adicionales verificadas:

- [A-3.5](https://www.acdlabs.com/iupac/nomenclature/79/r79_53.htm).
- [A-61](https://www.acdlabs.com/iupac/nomenclature/79/r79_83.htm).
- [C-202: fenoles y nombres retenidos](https://www.acdlabs.com/iupac/nomenclature/79/r79_209.htm).
- [C-463.1: ésteres](https://www.acdlabs.com/iupac/nomenclature/79/r79_363.htm).

## Ejemplos antes/después

«—» indica que el generador no admitía el nombre, no que el compuesto carezca
de nombre químico. Los nombres retenidos alternativos válidos no se declaran
obligatorios frente al padre sistemático elegido.

| Estructura | Antes Legacy ES / EN | Después Legacy ES / EN |
| --- | --- | --- |
| Benceno | — / benzene | benceno / benzene |
| o-yodometilbenceno | — / 2-iodo-1-methylbenzene | **1-metil-2-yodobenceno / 1-iodo-2-methylbenzene** |
| Vinilbenceno | — / vinilbenzene | etenilbenceno / ethenylbenzene |
| TNT | Formateador ES —; excepción UI ligada a Suggested / inglés válido | 2-metil-1,3,5-trinitrobenceno / 2-methyl-1,3,5-trinitrobenzene, ruta general |
| Benzoato de metilo | — / **methyl hexanoate, incorrecto** | benzoato de metilo / methyl benzoate |
| Alquenilo unido a benceno | — / **propylbenzene, pierde C=C** | (1-propenil)benceno / (1-propenyl)benzene |
| Pireno | — / — | pireno / pyrene |
| Fluoranteno | — / — | fluoranteno / fluoranthene |
| Dos metilos en naftaleno | — / — | 1,2-dimetilnaftaleno / 1,2-dimethylnaphthalene |
| Yodo y metilo en naftaleno | — / — | 2-metil-1-yodonaftaleno / 1-iodo-2-methylnaphthalene |
| OH en naftaleno | — / — | 1-naftol / 1-naphthol |
| Tetralina | — / — | 1,2,3,4-tetrahidronaftaleno / 1,2,3,4-tetrahydronaphthalene |

En el ejemplo del naftaleno, **no** se intercambian arbitrariamente 1 y 2:
son posiciones alfa/beta distintas del padre fijo. Cambia la citación
alfabética, conservando la conectividad y la numeración permitida.

## Integración e interacciones

`resolveLegacyNomenclature` es la resolución común del componente. Devuelve
disponibilidad química, salida española nativa, salida inglesa, resolución
española y análisis proyectados por idioma. `legacyProfileDisplayName` recibe
el español ya resuelto; Suggested no autoriza un nombre Legacy. La prueba de
TNT por el mecanismo general se ejecutó satisfactoriamente antes de retirar
la excepción específica del componente de presentación.

La proyección mueve juntos los átomos del padre y los locantes de sus
sustituyentes; las funciones conservan sus IDs estructurales. Las
explicaciones y los resaltados usan ese análisis. El nombre mostrado y copiado
usa el resultado seleccionado del componente. Las etiquetas SMILES, nombres
de archivo PNG/SVG y entradas guardadas explícitamente usan ese nombre Legacy
validado. La selección Current conserva sus etiquetas canónicas anteriores;
el historial automático y las búsquedas de identidad mantienen su clave
canónica. Las herramientas de auditoría y su helper de
razonamiento se actualizan para seguir esta misma ruta de producción.

Se conserva la configuración explícita `(1S)` del alcohol con cadena lateral
aromática en ambas salidas nativas y tras exportación/importación SMILES.
El fallback rechaza estereoquímica que su gramática no representa; no elimina
descriptores para conseguir un nombre disponible.

Los naftoles conservan también el grupo OH detectado en el análisis funcional.
Su explicación identifica el carbono portador y el sufijo retenido conforme a
C-202; la ruta del padre retenido no descarta esa función al construir el
nombre.

La importación offline por nombre se comprueba dentro de su cobertura
existente: metil/etilbenceno, xileno, yodometilbenceno y etenilbenceno. Se
añade `etenil` como componente equivalente al vinilo ya implementado. No se
afirma haber añadido un parser offline universal de todos los padres
fusionados. La importación/exportación SMILES sí cubre las 56 referencias.
La normalización destinada al parser externo reconoce también los cuatro
padres retenidos nuevos: `2-etilpireno` permanece un derivado de pireno y no
se transforma erróneamente en un supuesto alqueno con locante 2. Se verifican
asimismo los prefijos sobre fluoranteno, bifenileno y trifenileno.

## Límites pendientes explícitos

- El fallback de benceno admite como máximo una función principal del
  subconjunto validado. Dioles, diaminas y diácidos aromáticos mantienen
  UNSUPPORTED en ES, aunque EN pueda construirlos. No se certifica su
  terminología histórica española mediante una sustitución de sufijos.
- La función sulfónica no representada por el análisis existente no se
  traduce a partir de un benceno incompleto.
- Naftalenodioles, otros sufijos funcionales fusionados, antracenoles y
  heterociclos fusionados no registrados, como quinolina, permanecen fuera
  del subconjunto. Tampoco se completa aquí toda la lista A-21.
- La ampliación de hidrogenación es un segundo patrón constitucional
  explícito, además del existente; no un generador universal de todos los
  hidrógenos indicados. Perhidropireno y los límites anteriores no
  hamiltonianos siguen sin adquirir un nombre por semejanza topológica.
- Los benzoatos traducidos usan un solo éster con radical O-alquilo lineal
  saturado C1–C20. Ésteres múltiples o radicales O-alquilo más complejos no
  se admiten automáticamente.
- La traducción no cubre arbitrariamente todas las cadenas, ensamblajes,
  descriptores puenteados, sustitución sobre N ni radicales complejos.
  Esas familias conservan su generador nativo y sus controles actuales.
  Los radicales aromáticos poliinsaturados o fuera del vocabulario completo
  se declaran también no disponibles en EN; nunca se sustituye el radical
  por su forma saturada ni se deja texto español dentro de un nombre inglés.
- Los grafos con R/S o E/Z explícitos que requieren traducción aromática
  quedan UNSUPPORTED mientras no exista una gramática que represente esa
  configuración completa. Se prueban tanto ese rechazo como la conservación
  positiva de estereoquímica en la ruta nativa existente.
- El perfil Current conserva un límite preexistente para el radical
  alquenilo de tres carbonos auditado: su análisis compartido emitía
  `propilbenceno` para el grafo C9H10. Esta tarea extrae de nuevo los enlaces
  del radical en el adaptador Legacy. No se amplía aquí el generador Current
  de esa familia.

## Pruebas y regresión

Comandos reproducibles:

```sh
node scripts/audit-iupac79-aromatic-004.mjs
node --test --test-concurrency=1 tests/iupac79-aromatic-004.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npm run build:pages
node scripts/validate-pages.mjs
bash scripts/build-verified.sh
```

- Matriz: **56 PASS, 0 FAIL, 7 UNSUPPORTED**, 315 observaciones.
- Prueba específica: **11/11 PASS** dentro de la regresión ampliada, incluidos todos los
  nombres/variantes, prueba de grafo completa, locantes por idioma,
  razonamiento, funciones, numeración retenida, estereoquímica y SMILES.
  Los controles negativos incluyen un perfil 2013 mal presentado como
  Legacy y metadatos de complejidad incompatibles con el radical.
- Casos negativos: inglés incompleto o alterado; vocabulario, padre o
  sufijo desconocidos; locantes fuera de rango; funciones omitidas;
  radical incorrecto del éster; numeración sin correspondencia con el
  padre; enlaces/cargas distintos; átomos extra; metadatos retenidos
  falsificados y estereoquímica omitida.
- La regresión dirigida inicial ejecutó 79 pruebas: 78 PASS y una
  expectativa anterior de la excepción TNT. Se actualizó para comprobar
  la resolución de grafo sin depender de Suggested.
- Regresión ampliada final de los 16 archivos que dependen de la resolución
  o de su helper pedagógico: **196/196 PASS**, incluidos FUSED-001,
  POLYCYCLIC-002 y CYCLIC-AUDIT-003.
- Reejecución de cinco archivos con expectativas anteriores de UI,
  importación y capacidades: **60/60 PASS**. Se preserva el veto de glucosa
  mediante el resultado de producción en tiempo de ejecución; el control
  negativo de naftol se sustituye por un naftalenodiol no soportado.
- Copia, etiquetas de exportación, guardado explícito, editor y archivos
  SMILES: **17/17 PASS**. Se comprueba que la selección Current conserva su
  metadato previo y que ES/EN Legacy usa su nombre resuelto.
- Verificación final conjunta de química, funciones OH, explicación de
  naftoles, padres fusionados y exportaciones: **55/55 PASS**. La comprobación
  adicional de importación/normalización de los cuatro padres nuevos pasa
  **1/1**, preservando los locantes de sustitución.
- Planes congelados D4 en procesos ES/EN nuevos: **1/1 PASS**, con el límite
  original de tiempo y los fixtures originales intactos (88,6 s). Se
  reejecuta por un fallo bajo carga en la suite general.
- Última comprobación de numeración, generador EN, fallback y etiquetas:
  **40/40 PASS**. Se evita repetir la búsqueda de simetrías para padres
  ya canónicos sin desempate y se comparte el formateador ya numerado entre
  el resultado y su explicación. No se añade caché sobre modelos mutables.
- Suite general: **2 868 pruebas, 2 858 PASS, 5 FAIL iniciales y 5 omitidas**,
  en 5 491,3 s. Los cuatro primeros fallos eran expectativas anteriores de
  la citación `vinilbenzene`, rechazo de naftol e integración textual de las
  guardas de UI. Se actualizaron por el comportamiento comprobado del motor
  y se revalidaron **60/60**, conservando los controles químicos negativos.
  El quinto fue `spawnSync ... ETIMEDOUT` en un proceso de captura D4 con
  límite de 120 s; su reejecución aislada pasó sin cambiar fixtures ni
  límites. **No quedan incidencias de esa ejecución sin revalidación**.
  El registro general conserva esos cinco fallos iniciales: no se presenta
  como una segunda ejecución general limpia. Las cinco omisiones pertenecen
  al corpus preexistente; no se añaden `skip` ni `todo` para esta tarea.
  La ejecución incluye Practice/Exam, versiones congeladas, CSV, SMILES,
  selección de padres, razonamiento y controles de interfaz.
- TypeScript comparado con `f5f3ca9`, mismos directorios fuente y
  dependencias: **49 diagnósticos antes, 49 después, ninguno nuevo**.
  El chequeo global conserva problemas preexistentes; no se presenta
  como una compilación TypeScript limpia.
- Pages y Sites compilaron y sus validadores pasaron. Se verifican los
  artefactos finales después de cerrar las fuentes de aplicación. Los
  avisos de tamaño de chunks/módulos Node del Worker no
  son fallos de compilación.
- `git diff --check`: PASS. `HEAD` permanece en `f5f3ca9`; no se realiza
  commit ni push.

## Archivos

- Nuevos módulos: `app/iupac1979-english-to-spanish.ts`,
  `app/iupac1979-name-structure.ts`, `app/legacy-name-numbering.ts`.
- Motor e integración: `app/iupac1979-retained-fused.ts`,
  `app/legacy-english-nomenclature.ts`, `app/legacy-profile-display.ts`,
  `app/page.tsx`, `app/iupac-name-normalization.ts`,
  `app/name-to-molecule.ts`.
- Auditoría: `scripts/audit-iupac79-aromatic-004.mjs`,
  `scripts/naming-audit/evaluate.mjs` y los cuatro artefactos de informe,
  matriz y línea base `reports/orgorush-iupac79-aromatic-004*`.
- Pruebas nuevas: `tests/iupac79-aromatic-004.test.mjs`,
  `tests/fixtures/iupac79-aromatic-004.mjs`.
- Expectativas de cobertura y guardas actualizadas:
  `tests/fixtures/iupac79-fused.json`,
  `tests/fixtures/iupac79-cyclic-audit-003.mjs`,
  `tests/iupac79-retained-fused.test.mjs`,
  `tests/iupac1979-alkane-coverage.test.mjs`,
  `tests/legacy-english-nomenclature.test.mjs`,
  `tests/legacy-profile-display.test.mjs`,
  `tests/audnom006-english-morphology.test.mjs`,
  `tests/capability-audit.test.mjs`,
  `tests/chemistry-regressions.test.mjs`,
  `tests/formula-candidate-integration.test.mjs`,
  `tests/helpers/reasoning-integrity.mjs`.

No se modifican estilos visuales. Cambios locales para revisión, sin commit
ni push.
