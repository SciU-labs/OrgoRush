# B7.2 — benzamidas N-benciladas

## Línea base y diagnóstico

El caso histórico B701-18 es **N-bencil-4-bromo-2-fluorobenzamida**, CID 9070949, `C1=CC=C(C=C1)CNC(=O)C2=C(C=C(C=C2)Br)F`; no es la benzamida N-bencilada sin sustituir. Antes de este cambio era UNSUPPORTED en ambos idiomas. El importador sí obtiene su grafo y sus dos anillos; la selección general del anillo no aseguraba que se eligiera el unido al carbonilo, el analizador de sustituyentes N solo admitía alquilos lineales sin anillos, y la gramática no reconstruía N-bencilo. Por ello no existía prueba FULL ni controles visuales completos para esta estructura. La [línea base](baseline.json) conserva las mediciones previas, incluido B61-I04. La [prueba roja](red-initial.log) verificó que la reconstrucción independiente de N-bencilbenzamida fallaba antes de modificar producción.

## Regla estructural y prueba

El reconocedor exige dos anillos aromáticos carbocíclicos separados, una amida, N neutro con dos vecinos por enlaces simples, un carbono CH2 entre N y el segundo anillo, y que este último no tenga otra sustitución. El otro anillo se identifica por su unión al carbono carbonílico. La selección no depende del primer anillo, de sus IDs ni de las coordenadas. Otros sustituyentes del anillo progenitor siguen sujetos a la capacidad y rechazos existentes. Las pruebas de valencia existentes siguen aplicándose. N-fenilo, N-fenetilo, bencilo sustituido y N,N-disustitución no se admiten por esta regla.

La gramática del nombre activo reconstruye independientemente dos anillos, carbonilo, enlace C–N, enlace N–CH2, unión CH2–fenilo y sustituyentes del anillo progenitor. La prueba exige equivalencia del grafo completo y correspondencias; no copia los enlaces del análisis del generador. La región `amide-nitrogen` contiene siete carbonos y sus enlaces internos y N–C, mientras que la región del progenitor contiene el anillo unido al carbonilo. El localizador literal `N` selecciona exclusivamente el nitrógeno; los localizadores numéricos se refieren al anillo progenitor. La interfaz no numera el fenilo del bencilo.

El prefijo no sustituido `benzyl` / `bencil` equivale estructuralmente a `phenylmethyl` / `fenilmetilo`. [Blue Book P-29.6.1](https://iupac.qmul.ac.uk/BlueBook/P2.html) y [P-57.1.2](https://iupac.qmul.ac.uk/BlueBook/P5.html) retienen *benzyl* no sustituido como prefijo preferido; [P-66.1.1.3](https://iupac.qmul.ac.uk/BlueBook/P6a.html) trata sustitución de amidas. La adaptación española usa `bencil`, en línea con el modelo español de OrgoRush. Esto no certifica el nombre completo como PIN. La referencia [NIST](https://webbook.nist.gov/cgi/cbook.cgi?ID=C1485707) identifica N-benzylbenzamide, C14H13NO, CAS 1485-70-7, y recoge también phenylmethyl.

## Corpus, línea base y OPSIN

Se descargaron las respuestas originales de PubChem en [receipts](receipts/) antes de congelar el [corpus](../../tests/fixtures/b72-independent-reference.json) de 14 estructuras: doce N-bencilo y dos controles de frontera. El [acta](corpus-freeze.json) contiene la fecha, SHA-256 del fixture y alcance de la búsqueda de duplicados. Cada registro conserva SHA-256 de su recibo, SMILES, fórmula, InChIKey y origen; la fórmula fue contrastada con OpenChemLib. Se compararon identidades frente a fixtures B50/B61/B62/B701/B71, sin afirmar exhaustividad para cada estructura incidental de todos los tests históricos. Una revisión adicional detectó que B72-13, N-fenilbenzamida, ya era control negativo en B7.1: se excluye del conteo de novedad ([auditoría](novelty-audit.json)); por ello hay como máximo 13 nuevos, no 14. B701-18 se mide separadamente como control histórico y tampoco se cuenta como estructura nueva. El corpus no es aleatorio.

| Medición de 14 | FULL ES/EN | PARTIAL ES/EN | UNSUPPORTED ES/EN |
|---|---:|---:|---:|
| Inicial | 0 | 0 | 14 |
| Posterior | 12 | 0 | 2 |

La medición [posterior](post-final.json), detallada en [matriz](matrix.md) y [coverage](coverage.json), utilizó este corpus durante el desarrollo y no es otra evaluación ciega. OPSIN 2.9.0 local interpretó los doce nombres ingleses generados; los SMILES obtenidos y su equivalencia están guardados en `post-final.json`. B701-18 también pasó FULL ES/EN y comparación OPSIN. El comparador utiliza OpenChemLib, igualmente empleado por OrgoRush: OPSIN es un intérprete externo, pero la comparación no es totalmente independiente de esa biblioteca. Ni equivalencia estructural ni FULL certifican PIN.

## Seguridad e invariancia

Las pruebas cruzan N-bencilo con N-fenilo, N-fenetilo, N,N-dibencilo, N-fenilfenilacetamida de igual fórmula, bencilo con anillo sustituido y sustitución asignada al anillo equivocado. También eliminan el enlace N–CH2, cambian localizador o carga e introducen estereoquímica no demostrada. Se prueban permutaciones de IDs, átomos, enlaces y anillos, rotación y traslación, Kekulé alternativo y exportación/reimportación, con selección del progenitor por conectividad. El límite de cada rechazo es la prueba composicional disponible, no la validez química general.

## Interfaz y regresiones

Edge Chromium real ejecutó dos positivos, N-bencilbenzamida y N-bencil-4-clorobenzamida: 2/2 casos, 40 activaciones, nombres ES/EN, regiones y enlaces contrastados con la prueba independiente, alternancia de idioma y geometría conservada; [resultados](e2e/results.json). Un tercer caso N-fenilo permaneció UNSUPPORTED en ambos idiomas y conservó la geometría; [resultado](e2e-boundary/results.json). Las respuestas opcionales de metadatos externos se aislaron; no se simularon nombres ni pruebas.

Pasaron **189/189** pruebas focalizadas B4–B7.2, VALIDATION-008/014 y numeración visual, además de `npm run typecheck` y `git diff --check`. La expectativa histórica B701-18 de rechazo se sustituyó en la prueba vigente por un control de localizador equivocado, conservando intactos los informes históricos. No se ejecutó toda la batería local.

No se modificaron baselines ni workflows ni se incorporaron dependencias. B7.3 podría investigar bencilos sustituidos o N,N-disustitución por separado, con nuevas pruebas estructurales y corpus propio; ninguna queda admitida automáticamente en B7.2.
