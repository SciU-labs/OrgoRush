# AUD-NOM-008 — recuperación segura de arilos sustituidos

## Diagnóstico registrado antes de cambiar producción

HEAD inicial: `f5f0072adc8884c1f352fe1ae38a4ec957cd8daa`, AUD-NOM-007. Se consultó el workflow [39309485398](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/39309485398); al iniciar seguía ejecutándose. Antes de modificar producción se confirmó `completed / success` (consulta de 2026-10-19 19:37 UTC). No se modificó producción mientras se investigaban los casos.

La reproducción por importación SMILES y los análisis reales de ambos perfiles muestra que AUDCASE-0171 y AUDCASE-0176 tienen fórmula C₉H₁₂O y distintos grafos OpenChemLib. El control sin metilo tiene C₈H₁₀O. Ambos análisis eligen correctamente una cadena de dos carbonos con el alcohol en C1; sin embargo, `selectChainAgainstMonocycle` usa `ringSubstituentName`, que devuelve siempre `fenil` para el anillo bencénico. Su prefijo guarda solo los seis átomos del anillo. El metilo, que está en otro componente al quitar el anillo, queda fuera del prefijo; no tiene identidad, localizador interno ni procedencia en el análisis. Los tres isómeros metilados reciben internamente `2-feniletan-1-ol`.

`hasUnrepresentedArylSubstitution` detecta el vecino externo adicional del anillo y mantiene `localNamerCannotSafelyName` activo. La ruta de UI bloquea los cuatro nombres, y el DTO Legacy inglés repite la compuerta. Es una protección correcta. Para la molécula sin metilo se publican `2-feniletan-1-ol`, `2-phenylethan-1-ol`, `2-feniletanol` y `2-phenylethanol`.

La representación que falta debe fijar como C1 del arilo el carbono enlazado a la cadena; recorrer ambos sentidos del ciclo, elegir el localizador menor del metilo y conservar los siete carbonos y todos sus enlaces. La numeración del anillo es independiente de C1–C2 de la cadena alcohólica.

## Evidencia normativa previa a la implementación

- [Blue Book P-44.1.1](https://iupac.qmul.ac.uk/BlueBook/P4.html): se elige el padre que incorpora el grupo característico principal. Aquí es la cadena que porta el alcohol.
- [P-63.1.2](https://iupac.qmul.ac.uk/BlueBook/P6.html): nomenclatura sustitutiva con sufijo `ol`, numerado con prioridad sobre los prefijos.
- [P-29.6.1 y P-29.6.2.3](https://iupac.qmul.ac.uk/BlueBook/P2.html): fenilo admite sustitución; se identifican `2-methylphenyl` y los isómeros 3 y 4 como prefijos preferidos. [P-14.3.4.2(b), P-14.3.5](https://iupac.qmul.ac.uk/BlueBook/P1.html): la omisión del localizador de una cadena de dos átomos es para monosustitución; aquí OH y arilo requieren distinguir C1 y C2.
- [RSEQ/IUPAC, guía española 2021](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf), §§3–7 y ejemplo de §10: aporta las formas españolas `metilfenil`, `etano`, `2-aminoetan-1-ol`, la selección del grupo principal y los paréntesis. En particular incluye un ejemplo con `2-(3-metilfenil)propanoato de metilo`. La adjudicación española se deriva de estas reglas y formas españolas; OPSIN inglés no certifica la grafía española.
- [IUPAC 1979 A-13.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_62.htm) fija C1 en la valencia libre y contiene prefijos retenidos tolilo; [C-201.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_202.htm) describe el sufijo de alcohol. Estas fuentes no se tratarán como adjudicación automática de la grafía moderna para Legacy: falta fijar el texto histórico exacto, su agrupación y localizadores. Ese perfil puede continuar bloqueado.

Antes de implementar se fijaron los candidatos modernos ingleses `2-(2-methylphenyl)ethan-1-ol`, `2-(3-methylphenyl)ethan-1-ol` y `2-(4-methylphenyl)ethan-1-ol`. Los tres recibos OPSIN nuevos dan SUCCESS y MATCH de la identidad completa frente al SMILES original; los tres IDCode son distintos. Esto valida interpretación estructural, mientras que la derivación normativa se apoya en las reglas anteriores.

## Identidad, validez y preferencia

Estas tres conclusiones se evalúan por separado: (A) el SMILES devuelto por OPSIN tiene el mismo IDCode completo de OpenChemLib que la entrada, y cada isómero tiene un IDCode diferente; (B) la construcción del nombre sigue las reglas del padre alcohólico, el prefijo sustituido y sus localizadores; (C) la elección moderna de `methylphenyl`, del sufijo y de los localizadores se deriva de las reglas de preferencia citadas. OPSIN solo aporta A, nunca certifica B o C. Las formas españolas se adjudican con la gramática española y se vinculan explícitamente al candidato inglés interpretado, sin presentar OPSIN como parser de español.

| Entrada | Fórmula | IDCode completo |
|---|---|---|
| AUDCASE-0171, orto | C₉H₁₂O | ``deTH@@RUfTYj@`@@`` |
| Control meta | C₉H₁₂O | `deTH@@RUe[aj@B@@` |
| AUDCASE-0176, para | C₉H₁₂O | `deTH@@RUe_aj@B@@` |

Las respuestas nuevas originales, fecha de consulta, URL, texto exacto, estado HTTP/parser y SHA-256 se conservan en [opsin-receipts.json](aud-nom-008/opsin-receipts.json). Se capturaron el 2026-10-19 a las 19:35 UTC. Los SHA-256 son `235f9045febcb473a8f6f8878b352195d6daa88d2ef034ea7c035000425ca5e5` (orto), `5cd71ae022a57ec48d1fad95181437bace512d3da07befbe368a0186a9b3e88f` (meta) y `2de339b1502d8efbdbe4c6a4ae1879f61ecfc28dfbb57959d5259ffbe4592cf9` (para). La prueba recalcula los hashes y las identidades offline. El servicio no suministra aquí una versión de parser certificada. La primera consulta restringida falló por DNS; se repitió con acceso de red autorizado y se obtuvieron tres respuestas químicas auténticas, sin normalizar los nombres candidatos.

## Reparación y alcance

`monomethyl-phenyl.ts` construye un descriptor a partir del grafo: comprueba seis carbonos aromáticos neutros y enlaces Kekulé compatibles, un único enlace a la cadena y una única rama metilo terminal por enlace sencillo. Recorre las dos orientaciones del ciclo desde el carbono de unión C1 y selecciona la posición menor del metilo. Registra los átomos numerados del anillo, ambos extremos de la unión, átomo y localizador del metilo, los siete átomos del fragmento y sus enlaces internos. No depende del SMILES, IDs originales, orden de inserción ni coordenadas.

`page.tsx` utiliza ese descriptor solo para un alcohol neutro con dos carbonos saturados de cadena y arilo en el carbono opuesto al –OH: la subfamilia 2-(monometilfenil)etan-1-ol. El prefijo complejo incluye paréntesis y el metilo; ambos localizadores de la cadena se conservan. La compuerta de seguridad vuelve a construir la prueba desde el grafo y contrasta nombre, átomos, enlaces y localizadores. Un análisis antiguo, incompleto o alterado vuelve a quedar bloqueado. No se retiró la compuerta.

El origen estructural se comparte con la evidencia pedagógica: el fragmento `2-(n-metilfenil)`/`2-(n-methylphenyl)` comprende anillo y metilo, y dirige a la explicación del sustituyente. Los localizadores internos no se atribuyen a la numeración C1–C2 del alcohol. El sufijo `1-ol` conserva la evidencia del grupo –OH y su prioridad.

Fuera del soporte nuevo quedan etilfenilos, polimetilfenilos, sustituyentes heteroatómicos del anillo, cadenas laterales de uno o tres carbonos, alcoholes bencílicos metilados, otras funciones, cargas y sistemas multianillo. Continúan las rutas previas para las estructuras ya admitidas y los bloqueos de las no representables. No se modificaron las reglas de otras funciones ni las reparaciones léxicas de AUD-NOM-006/006B.

Legacy mantiene un rechazo explícito por perfil: `legacySpanishFormatterInput` devuelve `-` y el DTO inglés incluye indisponibilidad para esta nueva familia. La regla histórica de tolilos y alcoholes necesita todavía adjudicar la forma exacta en cada idioma; no se publica automáticamente el nombre 2013. La molécula sigue editable/exportable.

## Disponibilidad, copiado e integridad

Se probaron los cuatro perfiles por las funciones reales de selección, el estado `available` de Legacy y la compuerta local. Se inspeccionó además el cableado de `displayedNameCopyable` y del botón de copiar: la disponibilidad del perfil y la compuerta estructural controlan su activación. Para 2013 se permite nombre seguro; en Legacy no está disponible ni es copiable. Se verificó la proyección de interfaz y sus condiciones en código; no se ejecutó una prueba de navegador ni se escribió en el portapapeles del sistema.

Las pruebas importan los cuatro controles, comparan fórmulas, identidad completa de importación/exportación, cadena y alcohol en C1, unión arilo en C2, posiciones orto/meta/para y todos los átomos/enlaces del descriptor. Repiten los controles con IDs arbitrarios, inversión de arrays/enlaces, coordenadas nuevas, reordenación del anillo y entradas aromáticas/Kekulé equivalentes. Comprueban fragmentos literales, destinos existentes, prioridades explicadas y el recorrido ES → EN → Legacy → 2013 con grafo inmutable.

## Inventario actual y estados

El nuevo [profile-inventory.json](aud-nom-008/profile-inventory.json) define `VALIDATED_NAME`, `SAFE_REJECTION`, `PENDING_NORMATIVE_ADJUDICATION`, `STRUCTURAL_MISMATCH` y `UNVERIFIED`, con criterios explícitos. Para los dos casos hay cuatro salidas modernas `VALIDATED_NAME` y cuatro salidas Legacy `SAFE_REJECTION`, estas últimas con adjudicación normativa pendiente. La nueva evidencia no reescribe los 45/2/0/4 estados históricos de AUD-NOM-005.

| Caso | 2013 ES | 2013 EN | Legacy ES | Legacy EN |
|---|---|---|---|---|
| AUDCASE-0171 | **FIXED** — `2-(2-metilfenil)etan-1-ol` | **FIXED** — `2-(2-methylphenyl)ethan-1-ol` | **BLOCKED** — rechazo seguro, grafía pendiente | **BLOCKED** — rechazo seguro, grafía pendiente |
| AUDCASE-0176 | **FIXED** — `2-(4-metilfenil)etan-1-ol` | **FIXED** — `2-(4-methylphenyl)ethan-1-ol` | **BLOCKED** — rechazo seguro, grafía pendiente | **BLOCKED** — rechazo seguro, grafía pendiente |

Resultado global: **PARTIAL**. No se asigna un nombre histórico como si estuviese validado. Próximo trabajo: adjudicar las grafías históricas exactas y su interpretación antes de ampliar esos dos perfiles; cualquier ampliación a otras ramas, cadenas o funciones exige evidencia y controles propios.

## Validación ejecutada

Todos los procesos Node, incluidos los diagnósticos y el build, tuvieron un límite externo de 85 s con `Process.WaitForExit(85000)` y `Process.Kill(true)` para todo su árbol. No hubo timeout en esta intervención. Los tiempos siguientes corresponden a la última ejecución pertinente de cada comando. Las pruebas repetidas respondieron a añadir la validación del inventario y reforzar límites estructurales concretos.

| Comando / filtro | PASS | FAIL | SKIP | Tiempo real |
|---|---:|---:|---:|---:|
| `node --test tests/audnom008-aryl-substitution.test.mjs` | 7 | 0 | 0 | 24.21 s |
| `node --test tests/audnom003-aryl-substitution.test.mjs` | 11 | 0 | 0 | 23.84 s |
| `node --test --test-name-pattern=^AUDNOM-003: tests/audnom003-current-diagnostics.test.mjs` | 1 | 0 | 0 | 12.35 s |
| `node --test tests/audnom006-english-morphology.test.mjs` | 3 | 0 | 0 | 12.60 s |
| `node --test --test-name-pattern="structured attachment\|NOM-ETHER-001: terminal" tests/ether-nomenclature.test.mjs` | 12 | 0 | 0 | 13.66 s |
| `node --test tests/iupac1979-alkane-coverage.test.mjs` | 2 | 0 | 0 | 11.96 s |
| `node --test tests/aromatic-functional-nomenclature.test.mjs` | 6 | 0 | 0 | 11.63 s |
| `node --test tests/english-aromatic-localization.test.mjs` | 10 | 0 | 0 | 11.82 s |
| `node --test --test-name-pattern="^(?!representative span audit:)" tests/reasoning-aromatic-functional.test.mjs` | 21 | 0 | 0 | 22.64 s |

El filtro negativo de la última fila no excluyó la subprueba `representative span audit`; esta evaluó sus 47 estructuras admitidas dentro de ese proceso de 22.64 s. Se registra como ejecutada, sin atribuirle un SKIP y sin repetirla. El filtro de éteres sí evitó el barrido de 128 semillas de Practice. Las primeras ejecuciones de la cobertura nueva pasaron 7/7 en 7.41 s y 14.15 s; la regresión arilo histórica pasó inicialmente 11/11 en 12.43 s. Los diagnósticos acotados de reproducción, interpretación independiente y proyección posterior duraron 9.08 s, 0.58 s y 7.10 s, respectivamente.

Build Pages: `node node_modules/vite/bin/vite.js build --config vite.pages.config.ts` (misma entrada que `build:pages`), correcto en 8.72 s; emitió advertencias de importación dinámica redundante y tamaño de bundle. Validación Pages: `node scripts/validate-pages.mjs`, correcta en 0.30 s, 3 entradas/6 recursos/base `/Hydrocarbon-Lab/`. `git diff --check` correcto.

No se ejecutaron `npm test`, la auditoría de 440 estructuras, corpus global ni barridos completos de Practice/Exam. Las pruebas integrales de esta reparación quedan para CI. Las tres protecciones vivas antiguas que exigían indisponibilidad de 0171/0176 se actualizaron expresamente: ahora exigen nombres completos exactos y MATCH independiente en 2013, y mantienen los bloqueos Legacy. No se eliminaron ni saltaron casos ni se modificaron los datos históricos.

## Archivos exactos para revisión

```text
app/monomethyl-phenyl.ts
app/page.tsx
app/reasoning-aromatic-substituents.ts
app/reasoning-functional-groups.ts
app/reasoning-name-fragments.ts
tests/audnom008-aryl-substitution.test.mjs
tests/helpers/audnom008-aryl.mjs
tests/audnom003-aryl-substitution.test.mjs
tests/audnom003-current-diagnostics.test.mjs
tests/audnom006-english-morphology.test.mjs
reports/naming-audit/aud-nom-008-aryl-substitution.md
reports/naming-audit/aud-nom-008/opsin-receipts.json
reports/naming-audit/aud-nom-008/profile-inventory.json
```

Los archivos ajenos `reports/orgorush-aud001-repair.md` y `tatus --short` permanecen sin tocar. HEAD conserva AUD-NOM-007; no se hizo commit ni push.
