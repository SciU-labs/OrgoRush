# ORGORUSH-IUPAC2013-UNSATURATION-013

Fecha: 25 de octubre de 2026. Base: `main`, `3c47e07` (POLYENES-011 integrada); árbol limpio antes de intervenir. Sin commit ni push.

## Diagnóstico capturado antes de editar el motor

`outputs/unsaturation-013/diagnose.mjs` captura el grafo importado, ambos análisis, los cuatro nombres ES/EN y los modelos pedagógicos de 2013 ES y Legacy ES/EN en `before.json` y `before-outside.json`. La primera carga de Vite registró un aviso EPERM al limpiar su caché, aunque terminó con salida 0; se repitió fuera del sandbox y produjo los mismos resultados. El aviso del entorno se distingue del resultado químico. La auditoría anterior a los cambios se conserva en `before.matrix.json`.

| Entrada | Nombre 2013 anterior | Padre numerado | C=C reales | Sustituyente anterior |
|---|---|---|---|---|
| `C=CC(CC)=C` | 3-metilpent-1-eno | 1–2–3–4–5 | 1=2 y 3=6 | metil, átomo 6, C3 |
| `C=CC(CCCC)=C` | 3-metilhept-1-eno | 1–2–3–4–5–6–7 | 1=2 y 3=8 | metil, átomo 8, C3 |
| `C=CC(CCC)=C` | 3-metilhex-1-eno | 1–2–3–4–5–6 | 1=2 y 3=7 | metil, átomo 7, C3 |
| `C=CC(C)CC` | 3-metilpent-1-eno | 1–2–3–5–6 | 1=2 | metil, átomo 4, C3, unión sencilla |

No se pierde información durante la importación: los dos enlaces dobles están presentes y las fórmulas de los tres primeros grafos son C6H10, C8H14 y C7H12. El control saturado lateral es C6H12.

Los grafos originales se pueden leer de forma condensada como `CH₂=CH–C(=CH₂)–CH₂–CH₃` (A) y `CH₂=CH–C(=CH₂)–CH₂–CH₂–CH₂–CH₃` (B). En A, el conjunto completo de enlaces numerados es `{1=2, 2–3, 3–4, 4–5, 3=6}`; en B, `{1=2, 2–3, 3–4, 4–5, 5–6, 6–7, 3=8}`. El enlace lateral doble y el carbono terminal están presentes en ambas capturas, junto con la fórmula y las coordenadas originales.

La causa exacta está en `nameSubstituent()`: enumera la componente lateral y lee únicamente los órdenes **internos** de `chosen.path`. Una componente de un solo carbono no tiene enlaces internos y cae en `alkylNames[1]`, es decir, `metil`, aunque su unión al padre sea doble. La enumeración acíclica le suministra el mapa de órdenes, pero no interpreta esa unión. `selectParentCandidate()` aplica la prioridad de longitud 2013 correctamente y no requiere corrección.

El defecto pedagógico sigue esa pérdida en el modelo: el sustituyente aparece como metilo. La función existente de insaturaciones laterales sólo cuenta enlaces cuyos dos extremos están dentro del sustituyente y por eso tampoco reconoce el enlace de unión C3=CH2. La corrección debe aportar evidencia específica de esa unión sin cambiar el razonamiento de los otros sustituyentes.

## Referencias y expectativas independientes

- [IUPAC 2013, P-44.3.2 y P-44.4.1](https://iupac.qmul.ac.uk/BlueBook/P4.html#P-44.3.2): longitud antes de insaturación en la cadena acíclica; los enlaces múltiples desempatan después. Justifica conservar penteno, hexeno y hepteno.
- [IUPAC 2013, P-29.2/P-29.3.1](https://iupac.qmul.ac.uk/BlueBook/P2.html#P-29.2): `CH2=` tiene el prefijo preferido `methylidene`, frente a `CH3–`, `methyl`.
- [IUPAC 2013, P-56.4](https://iupac.qmul.ac.uk/BlueBook/P5.html#P-56.4): distingue `ylidene` para unión doble de los grupos divalentes unidos por enlaces sencillos.
- [PubChem, 3-Methylene-1-pentene, CID 18850](https://pubchem.ncbi.nlm.nih.gov/compound/3-Methylene-1-pentene): el registro indexado relaciona C6H10 con `3-methylidenepent-1-ene`. La URL numérica devolvió un bloqueo del servicio y la página alternativa exige JavaScript; se distingue la evidencia indexada de una descarga completa del registro.
- [Real Academia de Ciencias, Vocabulario Científico y Técnico: metilideno](https://vctrac.es/index.php?title=metilideno): corrobora la correspondencia léxica española `metilideno` / `methylidene`; no se usa como regla de elección del padre.

Las expectativas hexeno/hepteno se derivan de estas reglas y de los grafos completos, no de las salidas anteriores del motor. El padre comienza por el extremo del C=C, su localizador es 1 y la unión lateral está en C3: `3-metilidenopent-1-eno`, `3-metilidenohex-1-eno` y `3-metilidenohept-1-eno`; equivalentes ingleses `3-methylidenepent-1-ene`, `3-methylidenehex-1-ene` y `3-methylidenehept-1-ene`.

## Corrección y alcance

`app/page.tsx` entrega el orden real de la unión al padre a `nameSubstituent()` exclusivamente desde el análisis acíclico 2013 de hidrocarburos carbonados sin grupos funcionales. Una componente terminal de un carbono unida por doble enlace se identifica como `metilideno`. No fue necesario añadir campos al contrato de sustituyentes: ya contiene los átomos y el localizador, y el grafo proporciona el enlace.

Antes de publicar el nuevo nombre, `verifyCurrentMethylideneModel()` reconstruye el padre numerado y el carbono lateral y utiliza `legacyGraphsIdentical()`, utilidad de identidad de grafos ya existente. Fija las correspondencias de todos los átomos, exige neutralidad, valencia válida, dos hidrógenos en el carbono lateral y coincidencia de todos los enlaces. No vuelve a seleccionar ni numerar una cadena, no contiene excepciones por SMILES y no modifica el motor Legacy.

La cobertura nueva se limita deliberadamente a **un único metilideno terminal como único sustituyente**, sobre un padre acíclico sin triples enlaces, dentro de las raíces C3–C100 ya representadas. El padre puede tener o no dobles enlaces. Componentes divalentes de varios carbonos, dos metilidenos y combinaciones con otros sustituyentes permanecen fuera de esta ampliación: cuando el padre 2013 deja esos enlaces múltiples fuera de su cadena, se utiliza la indisponibilidad existente en lugar de publicar un alquilo saturado falso. Esto no reclasifica los sustituyentes metilo unidos por enlace sencillo.

En `app/iupac-name-normalization.ts` se incorpora únicamente la traducción directa del morfema completo `metilideno` a `methylidene`, antes de la regla monovalente de alquilos. No se sustituye globalmente `metil` ni se modifica la localización inversa de nombres externos, sus verificadores o la integración con PubChem.

La explicación actual incorpora P-44.3.2, el padre de cinco/siete carbonos, la distinción =CH2/–CH3 y el nombre completo. El fragmento `3` enlaza con C3; `metilideno` enlaza con C3, el carbono lateral y su enlace **doble**. El padre `pent` conserva sus cinco átomos y `1-eno` su C1=C2. Se reutilizan los tipos de evidencia y la navegación semántica existentes. La nueva evidencia sólo se crea para un modelo íntegramente verificado y su nombre local exacto, bajo el perfil actual.

## Nombres y diferencias entre perfiles

| Entrada | 2013 ES corregido | 2013 EN | Legacy ES conservado | Legacy EN conservado |
|---|---|---|---|---|
| `C=CC(CC)=C` | 3-metilidenopent-1-eno | 3-methylidenepent-1-ene | 2-etil-1,3-butadieno | 2-ethyl-1,3-butadiene |
| `C=CC(CCCC)=C` | 3-metilidenohept-1-eno | 3-methylidenehept-1-ene | 2-butil-1,3-butadieno | 2-butyl-1,3-butadiene |
| `C=CC(CCC)=C` | 3-metilidenohex-1-eno | 3-methylidenehex-1-ene | 2-propil-1,3-butadieno | 2-propyl-1,3-butadiene |
| `C=CC(C)CC` (control) | 3-metilpent-1-eno | 3-methylpent-1-ene | 3-metil-1-penteno | 3-methyl-1-pentene |

El caso adicional `CCCC(=C)CCC` verifica que un padre saturado de siete carbonos conserva su terminación y representa el C=C lateral mediante `4-metilidenoheptano` / `4-methylideneheptane`. Se comprueban también los descriptores `(2E)` y `(2Z)` de `4-metilidenohept-2-eno`, sin alterar el motor estereoquímico.

## Archivos y protección de referencias

- `app/page.tsx`: reconocimiento, prueba del grafo y evidencia pedagógica acotados.
- `app/iupac-name-normalization.ts`: morfema directo ES → EN.
- `tests/fixtures/orgorush-iupac79-polyenes-011.mjs`: exclusivamente las dos expectativas 2013 defectuosas y su comentario de procedencia; las expectativas Legacy no cambian.
- `tests/fixtures/orgorush-iupac2013-unsaturation-013.mjs` y `tests/orgorush-iupac2013-unsaturation-013.test.mjs`: expectativas derivadas de normas, lector de grafos y enumerador de caminos independientes, invariancia, controles, identidad, pedagogía y E/Z.
- `scripts/unsaturation-013-verify.mjs`: comparación íntegra de la auditoría y lista cerrada de dos diferencias autorizadas en el fixture anterior. Comprueba además los cuatro hashes de JavaScript protegidos por QUALITY-010.
- `scripts/unsaturation-013-matrix.mjs`: carga las fuentes originales de `3c47e07` con un plugin Vite de sólo lectura y compara los perfiles y explicaciones con las fuentes finales, sin cambiar el checkout. Sus únicas diferencias actuales admitidas son seis nombres de metilideno (incluidos los dos E/Z) y dos casos que deben pasar de un falso alquilo a no soportados. Exige igualdad literal de los modelos, nombres y explicaciones Legacy y conserva el padre, su numeración y fórmula actuales.
- Este informe.

Los dos scripts nuevos se justifican por la comparación reproducible y explícita de regresiones solicitada; no añaden comportamiento a la aplicación. Los informes y matrices originales de VALIDATION-008, FIX-009, QUALITY-010 y POLYENES-011 permanecen intactos. No hay cambios en selección de padres, anillos, funciones, SMILES, estereoquímica general, Practice/Exam, estado, diseño, dependencias o configuración TypeScript.

## Validación

Las primeras pruebas dirigidas detectaron una omisión pedagógica: el texto no incluía el nombre completo. Se completó ese texto, sin relajar la aserción. La segunda ejecución de 013 + POLYENES-011 aprobó **36/36** pruebas, sin omisiones. Se conservan `targeted-first.log` (35 PASS, 1 FAIL) y `targeted-second.log` (36 PASS) en `outputs/unsaturation-013/`.

Las nueve pruebas nuevas incluyen cinco casos base, variantes de IDs, almacenamiento y coordenadas, fórmula y enlaces independientes, padre correcto, control metilo, dos descriptores E/Z y rechazos estructurales. La evidencia visual verifica la unión doble lateral y el doble enlace del padre por separado, además de la reconstrucción literal del nombre completo.

`npm run typecheck -- --pretty false` terminó con cero diagnósticos y salida 0, manteniendo `strict: true`. La validación se registra en `outputs/unsaturation-013/final/`, con **423 archivos de fuentes, pruebas, configuración y referencias congelados mediante SHA-256** y resultados reales por etapa y archivo.

| Comprobación | Resultado |
|---|---|
| Dirigidas 013 + POLYENES-011 | 36 PASS, 0 FAIL, 0 SKIP, salida 0 |
| Regresiones pertinentes en 14 archivos | 246 PASS, 0 FAIL, 0 SKIP, salida 0; padres, convenciones, sustituyentes, razonamiento, Legacy EN, E/Z, R/S, QUALITY-010, LOCALIZATION-012 y VALIDATION-008/FIX-009 |
| Auditoría de 72 estructuras y dos ordenaciones | 198 PASS, 16 UNSUPPORTED y 2 PENDING-REFERENCE por estructura/perfil; idéntica a la captura previa, incluidos nombres, análisis y pedagogía |
| Comparación de fuentes originales `3c47e07` | 30 estructuras; Legacy íntegro idéntico; padres y numeración actuales conservados; únicamente las 8 diferencias actuales enumeradas |
| Fixtures POLYENES-011 | Sólo cambian las dos expectativas 2013 autorizadas; las otras 21 filas y todos los nombres Legacy son idénticos |
| QUALITY-010 | Cero errores TypeScript; hashes de JavaScript protegidos intactos |
| Pages | `npm run build:pages` y `npm run validate:pages`, salida 0 |
| Sites | Script oficial `scripts/build-verified.sh`, compilación y validación, salida 0 |
| Suite general | 172 archivos, cada uno una vez, secuencialmente con `node --test --test-concurrency=1`; 3.099 pruebas: **3.094 PASS, 0 FAIL, 5 SKIP preexistentes**, 0 canceladas; todos los procesos terminaron con salida 0 |

El controlador `outputs/unsaturation-013/validate-final.ps1` guarda el inventario completo, el log, el código de salida y el hash de cada archivo de pruebas. Ejecuta la suite completa con el aislamiento habitual de procesos por archivo y concurrencia uno. El registro individual permite conservar el trabajo completado ante una interrupción; no se aumenta ningún timeout. La comprobación de cierre exige igualdad de los 423 hashes, cobertura exacta del inventario y coincidencia nominal de las cinco omisiones anteriores.

`node outputs/unsaturation-013/verify-final.mjs` terminó con salida 0 y generó `final/summary.json`: los 423 hashes siguen intactos, los 172 archivos coinciden exactamente con el inventario actual y las cinco omisiones tienen los mismos nombres que antes. La suite general final completó su única pasada sin interrupciones, timeouts ni repeticiones de archivos. Las incidencias preliminares de caché y explicación quedan documentadas separadamente; no se presentan como regresiones químicas ni se ocultan sus registros.

`git diff --check` no detectó errores. Las dependencias, el lockfile, `tsconfig.json`, los módulos de estereoquímica y los informes históricos no cambian. `HEAD` permanece en `3c47e07`; no se realizó commit ni push.

## Limitaciones mantenidas

No se amplía a etilideno u otros sustituyentes divalentes de varios carbonos, dos o más metilidenos, metilideno combinado con otros sustituyentes, padres con C≡C, funciones oxigenadas/nitrogenadas o anillos. No se convierte una estructura no demostrada en un nombre aparentemente completo. Las 16 situaciones UNSUPPORTED y las dos referencias históricas pendientes de la auditoría conservan exactamente sus estados y datos originales.
