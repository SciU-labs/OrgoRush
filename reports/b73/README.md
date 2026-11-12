# B7.3 — benzamidas N,N-dialquiladas

## Diagnóstico y regla

La benzamida primaria tiene dos H sobre N, la monosustituida uno y la N,N-disustituida ninguno, con tres enlaces simples del N neutro: uno al carbonilo y uno a cada rama. El generador ya calculaba nombres para dos ramas de carbono simples y multiplicadores `N,N-di`, pero la gramática aceptaba como máximo una rama N. La [línea base](baseline.json) y la [prueba roja](red-initial.md) se registraron antes de modificar producción. El importador y el generador ya manejaban las cinco estructuras iniciales; la prueba independiente no podía reconstruir sus dos enlaces N–C y los perfiles eran PARTIAL.

La ampliación de `systematic-family-grammar.ts` reconoce dos cadenas N lineales saturadas de metilo, etilo o propilo; acepta `N,N-di` para dos iguales y dos prefijos N independientes para dos diferentes. Desde el nombre reconstruye el anillo progenitor, C=O, C–N, cada cadena y sus dos enlaces N–C. Requiere la equivalencia completa del grafo y preserva los controles existentes de carga, valencia y estereoquímica. No utiliza IDs ni nombres de moléculas como reglas.

El modelo conserva dos componentes con átomos y enlaces separados. Las ramas idénticas comparten una etiqueta de simetría; `validated-name-derivation.ts` contrasta su unión como región invariante y conserva una correspondencia completa, sin declarar preferencia química entre ramas intercambiables. `reasoning-derivation-adapter.ts` presenta un control conjunto para el prefijo multiplicativo, un control `di` y dos localizadores `N` que señalan el mismo nitrógeno. Con ramas distintas, cada prefijo selecciona su propia cadena y enlace N–C. Los localizadores del anillo continúan en otro ámbito. `page.tsx` ordena los prefijos N y de anillo según el idioma; esto corrige, por ejemplo, `4-methoxy-N,N-dimethylbenzamide` en inglés.

El [Blue Book P-66.1.1.3.1.1](https://iupac.qmul.ac.uk/BlueBook/P6a.html) describe la citación con N de amidas sustituidas y ejemplifica `N,N-diethyl`; [P-14.5](https://iupac.qmul.ac.uk/BlueBook/P1.html) ordena prefijos ignorando multiplicadores simples. Se conservan las decisiones españolas de B6.3/B7.0.1. FULL significa reconstrucción y equivalencia demostradas, no certificación de nombre IUPAC preferido.

## Corpus y mediciones

Las 16 respuestas originales de PubChem están en [receipts](receipts/), recuperadas antes de congelar el [fixture](../../tests/fixtures/b73-independent-reference.json). El [acta](corpus-freeze.json) registra fecha, SHA-256 `ad38e9ddd45f97feba63bd464a9f2ac911fead9b822f630428ab54e7ad3e4df1`, fórmulas contrastadas con OpenChemLib y alcance de la comparación con fixtures anteriores. N,N-dimetilbenzamida B73-13 ya figuraba como control negativo B7.1 y se identifica como histórico, no novedad. La búsqueda de duplicados no abarca necesariamente cada estructura incidental de todas las pruebas antiguas. El corpus es pequeño y no aleatorio.

| Corpus de 16 | FULL ES/EN | PARTIAL ES/EN | UNSUPPORTED ES/EN |
|---|---:|---:|---:|
| Inicial | 0 | 14 | 2 |
| Posterior | 12 | 2 | 2 |

La [matriz](matrix.md), [coverage](coverage.json) y [medición posterior](post-final.json) incluyen todos los casos sin descartar resultados; esta medición usó el corpus durante el desarrollo y no es ciega. OPSIN local 2.9.0 interpretó los 14 nombres ingleses emitidos y sus grafos fueron equivalentes; el archivo registra SMILES y errores. OpenChemLib se usa tanto en el comparador como en OrgoRush, y OPSIN no certifica PIN. B61-I04 y B701-18 continúan FULL y equivalentes mediante OPSIN.

Los dos PARTIAL del corpus y el control adicional 4-metil-N,N-dimetil presentan el mismo radical en N y anillo: una representación agrupada como `N,N,4-trimethyl` requiere multiplicadores mixtos aún no demostrados. La equivalencia de sus nombres emitidos no transforma esos perfiles en FULL. Los dos UNSUPPORTED son N-bencil-N-metilo y N,N-dibencilo; N-arilo-N-alquilo, ramas N insaturadas, amidas multifuncionales y estereoquímica explícita permanecen fuera de la ampliación salvo soporte anterior independiente.

## Pruebas

Se contrastan N,N-dimetilo frente a N-metil y N,4-dimetilo, N-etil-N-metilo frente a N,N-dietilo y N-propilo, multiplicadores y locantes mal formados, amida primaria, carga, estereoquímica y ramas bencilo o insaturadas. Se prueban permutaciones de IDs, átomos, enlaces y ramas, Kekulé alternativo, rotación, traslación, exportación/reimportación y alternancia ES/EN. La antigua prueba B7.1 que rechazaba el nombre correcto N,N-dimethylbenzamide se actualizó a un control con N omitido; se preservaron los informes históricos.

Playwright con Edge 157 ejecutó N,N-dimetilbenzamida, N-etil-N-metilbenzamida y 4-cloro-N,N-dimetilbenzamida: tres positivos, **78 activaciones** con comparación de átomos, enlaces y localizadores, alternancia de idioma y geometría preservada. El cuarto caso, N-bencil-N-metilbenzamida, permaneció UNSUPPORTED al cambiar de idioma. Los cuatro pasaron sin errores de consola; [resultados](e2e/results.json). Las respuestas opcionales de metadatos externos se aislaron; nombres y pruebas se generaron localmente.

Pasaron **194/194** pruebas focalizadas B4–B7.3, VALIDATION-008/014 y numeración visual, además de `npm run typecheck` y `git diff --check`. Los controles adversariales y de simetría añadidos después de iniciar esa ejecución se verificaron también por separado. No se ejecutó la batería completa, ni se modificaron workflows o baselines históricos, ni se añadieron dependencias de producción. B7.4 podría investigar agrupación mixta N/anillo o N-alquilo-N-bencilo mediante pruebas y corpus propios.
