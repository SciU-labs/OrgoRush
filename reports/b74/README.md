# B7.4 — benzamidas N-alquilo-N-bencilo

## Diagnóstico

B7.3 permanecía sin commit al iniciar; sus cambios se conservaron. La referencia histórica B73-14, CID 527038, `CN(CC1=CC=CC=C1)C(=O)C2=CC=CC=C2`, C15H15NO, estaba UNSUPPORTED. El importador sí construía el grafo y detectaba la amida, pero la evidencia de bencilo exigía dos vecinos de N en vez de admitir tres; el selector de progenitor heredaba esa limitación, el generador no reconocía la rama y la gramática prohibía combinar bencilo con otra rama N. Por tanto no se alcanzaba comparación ni correspondencia visual FULL. La [línea base](baseline.json) y la [prueba roja bilingüe](red-initial.md) preceden al cambio de producción.

## Regla y evidencia

`amideBenzylEvidence` reutiliza el reconocimiento B7.2 para identificar un único CH2–fenilo no sustituido entre los vecinos de N, también cuando hay un segundo sustituyente. Exige N neutro, enlaces simples, valencia comprobada, dos anillos aromáticos separados y anillo progenitor unido al carbonilo; las otras ramas siguen sujetas al control B7.3 de alquilos lineales. El anillo padre se identifica por conectividad, sin depender de IDs, orden o coordenadas. N,N-dibencilo, N-fenilo, N-fenetilo y bencilo sustituido no se incorporan por esta regla.

La gramática B7.3 ya reconstruía dos ramas N y la de B7.2 ya reconstruía bencilo: se elimina exclusivamente la prohibición de combinarlas. El nombre activo crea un grafo nuevo con carbonilo, N, N–alquilo, N–CH2, CH2–fenilo y ambos anillos; FULL requiere equivalencia y correspondencia completas. Los componentes conservan átomos, enlaces y localizadores N separados. El adaptador existente resalta las dos ramas por separado, incluidos ambos enlaces N–C y el enlace CH2–fenilo. La ordenación inglesa considera los prefijos del anillo progenitor incluso cuando existe un anillo bencilo.

La referencia produce **N-bencil-N-metilbenzamida / N-benzyl-N-methylbenzamide**, FULL ES/EN. [P-66.1.1.3.1](https://iupac.qmul.ac.uk/BlueBook/P6a.html) describe la sustitución N; [P-29.6.1](https://iupac.qmul.ac.uk/BlueBook/P2.html) conserva `benzyl` no sustituido como prefijo preferido. `benzyl` / `bencil` corresponde a `phenylmethyl` / `fenilmetilo`, no a fenilo unido directamente a N. La adaptación española sigue B6.3/B7.0.1. FULL y OPSIN no certifican PIN para el nombre completo.

## Corpus y resultados

Se recuperaron [recibos originales de PubChem](receipts/) antes de congelar los 13 registros del [fixture](../../tests/fixtures/b74-independent-reference.json); el [acta](corpus-freeze.json) registra fecha, hash y comparación con fixtures B5–B7.3. Los registros B74-01 y B74-13 ya eran controles B7.3 y no se cuentan como novedades. La búsqueda no demuestra ausencia de toda aparición incidental en pruebas históricas. Los recibos registran fórmula, SMILES e InChIKey; la fórmula se contrastó con OpenChemLib y CID 527038 se contrastó también con el SMILES solicitado.

| Corpus de 13 | FULL ES/EN | PARTIAL ES/EN | UNSUPPORTED ES/EN |
|---|---:|---:|---:|
| Inicial | 0 | 1 | 12 |
| Posterior | 11 | 0 | 2 |

La [matriz](matrix.md), [coverage](coverage.json) y [medición posterior](post-verified.json) conservan todos los casos. La segunda medición se utilizó durante el desarrollo y no es una nueva evaluación ciega. OPSIN local 2.9.0 interpretó los once nombres ingleses emitidos y cada grafo resultante fue equivalente; se guardan SMILES, mensajes y resultado. El comparador emplea OpenChemLib, compartido con OrgoRush.

La línea base reveló además un defecto preexistente del control de igual fórmula N-etil-N-fenilbenzamida B74-12: emitía `N-ethylbenzene--carboxamide`, que OPSIN interpretaba como otra estructura. Se incorporó un rechazo basado en la conexión directa N–anillo aromático de una benzamida con dos anillos, porque esa N-arilamida requiere otra gramática; ahora permanece UNSUPPORTED y no emite ese nombre. El resultado anterior y el fallo OPSIN se mantienen en la línea base. N,N-dibencilo B74-13 también sigue UNSUPPORTED.

La [revisión B7.3](b73-regression.json) confirma que sus doce casos FULL se mantienen FULL y sus dos PARTIAL de multiplicadores mixtos siguen PARTIAL en ambos idiomas. B73-14 cambia de UNSUPPORTED a FULL por la nueva regla; el otro control UNSUPPORTED permanece así. B61-I04 y B701-18 siguen FULL. Se actualizó la expectativa negativa B7.3 para comprobar una longitud de alquilo incorrecta en vez de rechazar el nombre ahora demostrado; los informes históricos quedaron intactos.

## Pruebas y límites

Los controles incluyen el isómero N-etil-N-fenilo de igual fórmula, N-fenetilo, N,N-dibencilo, N-bencilo monosustituido, N-metilo, N-etil-N-metilo, sustitución en el anillo incorrecto, omisión de N–C o CH2–fenilo, carga y exceso de valencia, y estereoquímica no representada. Se prueban IDs y átomos permutados, inversión de enlaces y anillos, rotación, traslación, Kekulé alternativo, exportación/reimportación y ES/EN.

Edge Chromium 157 verificó tres positivos reales: N-bencil-N-metilbenzamida, su derivado 4-cloro y N-bencil-N-etilbenzamida, con **86 activaciones**, cambios de idioma, enlaces y geometría contrastados; [resultados](e2e/results.json). En esa misma ejecución el intento de comprobar N,N-dibencilo agotó la espera durante una recarga de desarrollo y no pasó; se conserva el resultado fallido. En una ejecución separada, el control de igual fórmula N-etil-N-fenilo permaneció UNSUPPORTED en ambos idiomas, sin errores de consola y con geometría conservada; [resultado](e2e-boundary/results.json). N,N-dibencilo también se comprobó mediante pruebas estructurales y la matriz, pero no se afirma que haya pasado ese intento visual.

Pasaron **199/199 pruebas focalizadas** B4–B7.4, VALIDATION-008/014 y numeración visual, además de `npm run typecheck` y `git diff --check`; el control añadido después para el nombre N,N-dibencilo también pasó por separado. Dos compilaciones Vite Pages en memoria, con el código B7.3 reconstruido y su hash de `page.tsx` cotejado contra el registro previo, produjeron cuatro chunks en ambos casos: **+414 bytes JavaScript y +82 bytes gzip** en B7.4; [medición y método](bundle-size.json). La gramática anterior se reconstruyó restituyendo su única barrera B7.4, sin escribir sobre el trabajo del usuario. No se ejecutó toda la batería ni se añadieron dependencias de producción, Java, datos externos o tablas por molécula al bundle, ni se modificaron workflows o baselines históricos. Los multiplicadores mixtos N/anillo siguen fuera de alcance.
