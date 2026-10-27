# ORGORUSH-FIX-015 — corrección de VALIDATION-014

## Resultado

Se corrigieron los tres defectos científicos y las cinco observaciones fallidas originales. Los cambios usan la estructura molecular analizada para construir los nombres y las evidencias pedagógicas; no se aplicaron sustituciones textuales a nombres completos. VALIDATION-014 se conserva como evidencia histórica sin modificar.

| Observación histórica | Antes | Resultado actual |
| --- | --- | --- |
| V014-125, 2013 ES | `4-hidroxi-3-metilheptan-2-ona` | `4-hidroxi-3-metilidenoheptan-2-ona` |
| V014-125, 2013 EN | `4-hydroxy-3-methylheptan-2-one` | `4-hydroxy-3-methylideneheptan-2-one` |
| V014-045, 2013 ES | `6-(but-1,3-en-1-il)tetradecano` | `6-(buta-1,3-dien-1-il)tetradecano` |
| V014-045, 2013 EN | `6-(but-1,3-en-1-il)tetradecane` | `6-(buta-1,3-dien-1-yl)tetradecane` |
| V014-059, 2013 EN | `methyltiof-2-ene` | `2-methylthiophene` |

## Causas y cambios

### FIX-015A — metilideno funcional

`analyzeFunctionalAcyclic()` llamaba a `nameSubstituent()` sin pasar el orden del enlace entre el átomo del padre y el primer átomo de la rama. El valor por defecto `attachmentOrder = 1` hacía que el grafo `=CH₂` se interpretara como `–CH₃`. El llamador ahora propaga el orden real del enlace mediante `bondOrders`.

La selección del padre y la explicación también identifican el metilideno por su tipo y localizan la conexión doble en el grafo. Así, la explicación puede encontrarlo aunque haya otros sustituyentes antes y el compuesto contenga oxígeno. El resaltado de la rama usa el enlace y los átomos de la estructura, no una conjetura desde el texto del nombre.

Comprobaciones dirigidas:

- `CC(=O)C(=C)CC` conserva fórmula `C6H10O` y genera metilideno; el nombre con metilo correspondería a `C6H12O` y pierde la insaturación.
- La estructura completa V014-125 genera los nombres ES/EN de la tabla.
- `CC(=O)C(C)CC` conserva el sustituyente metilo saturado.
- `CC(=O)C(=C)C` sigue incorporando la insaturación al padre: `3-metilbut-3-en-2-ona` / `3-methylbut-3-en-2-one`.
- Los perfiles Legacy 1979 conservan sus resultados congelados.

### FIX-015B — multiplicidad del dienilo

`makeUnsaturatedSubstituentName()` construía los localizadores con el morfema singular aunque la rama tuviera más de un enlace múltiple. Ahora cuenta las insaturaciones del grafo y aplica el multiplicador correspondiente, conserva los localizadores y la posición de unión, y añade la vocal de enlace requerida en los nombres con multiplicidad. La proyección inglesa de `app/iupac-name-normalization.ts` reconoce la forma locantada plural y produce el sufijo `-yl` o `-yn` apropiado, sin reemplazos generales de subcadenas.

La explicación incluye el número correcto de enlaces múltiples y resalta los enlaces de la rama obtenidos del grafo. Los nombres monoinsaturados permanecen en singular.

Comprobaciones dirigidas:

- `CCCCCC(C=CC=C)CCCCC` genera `6-(buta-1,3-dien-1-il)undecano` / `6-(buta-1,3-dien-1-yl)undecane`.
- V014-045 genera los nombres de la tabla.
- El control monoinsaturado `CCCCCC(CC=CC)CCCCC` conserva `6-(but-2-en-1-il)undecano` / `6-(but-2-en-1-yl)undecane`.
- Se conservan resultados heredados 1979 —por ejemplo, `5-pentyl-1,3-decadiene` en el caso reducido y `5-pentyl-1,3-tridecadiene` para V014-045—, que siguen la selección de padre de ese perfil. No se fuerza el padre 2013 sobre Legacy.
- El control de cadena alternativa 2013 mantiene `5-butyldeca-1,3-diene`.

### FIX-015C — tiofeno sustituido en inglés

La reproducción confirmó que `normalizeTraditionalUnsaturationNotation("2-metiltiofeno")` devolvía `metiltiof-2-eno`: el patrón genérico de alqueno trataba el final retenido `tiofeno` como una terminación con locante de insaturación. La normalización ahora deja intactos los nombres reconocidos por `translateHeterocycles()`. La proyección inglesa mantiene el localizador del sustituyente y no procesa el nombre retenido del anillo como alqueno.

Controles: `Cc1cccs1` produce `2-metiltiofeno` / `2-methylthiophene`; se mantienen los resultados existentes para `c1ccsc1` y `Cc1ccncc1`. No se amplía la lista de heterociclos reconocidos.

## Evidencia química y normativa

Los casos usan las estructuras, fórmulas, referencias y recibos OPSIN congelados en `tests/fixtures/orgorush-validation-014.mjs` y `tests/fixtures/orgorush-validation-014.opsin.json`; las pruebas comparan el análisis actual del motor de producción con esas evidencias sin consultas de red. Las pruebas del nuevo archivo también comprueban invariancia ante remapeo de IDs atómicos y cambios de coordenadas mediante los mecanismos de comparación estructural existentes.

La corrección de insaturación y los localizadores de sustituyentes se alinean con las reglas de sustituyentes insaturados del [Blue Book, sección P-3](https://iupac.qmul.ac.uk/BlueBook/P3.html); la formación y los sufijos de radicales se consultan en [P-2](https://iupac.qmul.ac.uk/BlueBook/P2.html). La distinción entre metilo y metilideno se apoya en [P-29](https://iupac.qmul.ac.uk/BlueBook/P6.html). Los perfiles Legacy se validan contra sus resultados congelados y no se reinterpretan como nombres 2013.

## Explicaciones y resaltados

Las regresiones confirman que los fragmentos pedagógicos describen el metilideno y su enlace doble, que todos los enlaces del dienilo quedan explicados y enlazados con sus objetivos estructurales, y que el nombre del tiofeno conserva el localizador del sustituyente. Los controles de metilo y monoeno comprueban que no se sobregeneralizan las reglas nuevas. Se ejecutaron las pruebas relacionadas de nomenclatura funcional, fragmentos de razonamiento, UNSATURATION-013, POLYENES-011 y LOCALIZATION-012.

## Validación ejecutada

- `node --test --test-concurrency=1 tests/orgorush-fix-015.test.mjs`: **5/5 aprobadas**.
- `node --test --test-concurrency=1 tests/orgorush-validation-014.test.mjs tests/orgorush-validation-014-integrity.test.mjs`: **14/14 aprobadas**.
- `node scripts/validation-014-audit.mjs --verify`: **aprobado**; 150 estructuras, 600 observaciones, integridad histórica confirmada; `sourceTreeChecked=false`.
- Pruebas relacionadas ejecutadas individualmente: UNSATURATION-013 **9/9**, POLYENES-011 **27/27**, LOCALIZATION-012 **10/10**, fragmentos de razonamiento **20/20**, nomenclatura funcional **22/22**. El caso `difficulty-easy-session` también aprobó **8/8**.
- `npm run typecheck`: **aprobado**.
- `npm run build:pages` y `npm run validate:pages`: **aprobados**; artefacto validado con base `/Hydrocarbon-Lab/`.
- `npm test`, ejecutado una sola vez: **3114 aprobadas, 0 fallidas, 5 omitidas**; código de salida 0. Incluye build exitoso y validación del artefacto Pages. Duración informada por Node: 4 416 137.544 ms.
- `npm run test:critical`: el comando agregado no llegó a terminar durante el intento independiente. Sus pruebas se ejecutaron dentro de la suite única `npm test`, que terminó con 0 fallos; no se atribuye un resultado exitoso independiente a ese comando.
- `git diff --check`: aprobado.

El build informó avisos existentes de compatibilidad de Cloudflare, tamaño de chunks y clasificación de rutas; no impidieron su finalización ni la validación del artefacto.

## Integridad y alcance

No se modificó ningún artefacto histórico VALIDATION-014. La verificación de integridad aprobó. Las otras **120 observaciones UNSUPPORTED** y **32 PENDING-REFERENCE** permanecen fuera del alcance; no se declara que toda VALIDATION-014 haya pasado.

No se añadieron dependencias ni se hicieron cambios en branding, workflows, Practice o Exam. No se hizo commit ni push.
