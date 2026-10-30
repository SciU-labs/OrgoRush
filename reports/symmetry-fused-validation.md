# Fase 6 — simetría y heterociclos fusionados

## Diagnóstico y cambio funcional

El ácido 3-metilbutanoico era PARTIAL por dos controles distintos: la gramática exigía una única cadena carbonada máxima desde el carbonilo principal, y el reconciliador histórico exigía imágenes invariantes de cada región y de cada átomo numerado. En `HOOC–CH2–CH(CH3)2`, intercambiar los dos metilos conserva el grafo químico, pero cambia el conjunto exacto de átomos de la cadena. El rechazo confundía esa equivalencia con una selección principal no resuelta.

La gramática ahora enumera las cadenas máximas y exige que **cada** alternativa sea la imagen punto a punto de la cadena numerada interpretada bajo un automorfismo del grafo completo. Una igualdad de longitud por sí sola no basta. Por ejemplo, `CCC(C(=O)O)C(C)C` con `2-ethyl-3-methylbutanoic acid` sigue rechazado: las alternativas máximas no son automorfas.

`analyzeStructuralEquivalence` enumera biyecciones completas que conservan elemento, carga, hidrógenos implícitos, configuración absoluta R/S, grado, aristas y no aristas. Los enlaces aromáticos se normalizan con OpenChemLib para admitir recorridos aromáticos y de Kekulé equivalentes. Dos correspondencias completas entre los mismos grafos difieren por un automorfismo; sus imágenes forman órbitas atómicas. Las asignaciones pedagógicas se agrupan por sus conjuntos de átomos, enlaces y pares átomo/localizador. Se eliminan solamente duplicados que no cambian esos datos.

Los límites son 120 átomos, 20 000 visitas y 256 correspondencias completas. Agotar un límite devuelve ausencia de prueba. La ruta histórica `mapStructuralRegions` conserva el contrato de regiones invariantes. Solamente la producción acíclica con cadenas equivalentes probadas utiliza las asignaciones alternativas para FULL. No se amplía la gramática de estereoquímica; E/Z explícito y nombres fuera de su alcance siguen sin reconciliarse. El modelo editable no representa isótopos: tanto SMILES isotópico como metadatos isotópicos introducidos directamente se rechazan, sin borrar la diferencia.

El ácido 3-metilbutanoico alcanza **FULL**, con dos asignaciones completas. Para `CC(C)CC(=O)O`, las cadenas son `{1,2,4,5}` y `{2,3,4,5}`, y los metilos excluidos son respectivamente `{3}` y `{1}`. La órbita intercambiable es `{1,3}`. Para ácido 2,2-dimetilpropanoico hay seis correspondencias y tres elecciones distintas de padre, con los dos metilos restantes agrupados en el prefijo multiplicativo. Los ácidos 2-metilbutanoico y 3-metilpentanoico mantienen un padre único.

La UI explica que la elección mostrada carece de preferencia química y ofrece alternarla. Cada cambio sustituye conjuntamente padre, sustituyentes, numeración, colores y blancos de resaltado; nunca pinta la unión de cadenas como una cadena ficticia. Cambiar de molécula o de orden atómico reinicia la elección y descarta el resaltado previo. El orden determinista es únicamente de presentación.

## Importación: causa y reglas

OpenChemLib ya parseaba los cierres, carbonilos y nitrógenos de la cafeína. El bloqueo estaba en la política de conversión al editor: el sistema fusionado no coincidía con un padre retenido autorizado y no era un sistema alifático enteramente carbonado de anillos de cinco/seis miembros. No era un fallo del SMILES de PubChem ni se resolvió desactivando aromaticidad.

Se añade una regla general para sistemas fusionados con anillos de cinco o seis miembros, átomos anulares neutros C/N/O y al menos un N anular. Cada par de anillos comparte cero átomos o exactamente dos unidos por una arista presente en ambos anillos. Se conservan los controles previos para otras topologías y para cargas formales; no se autoriza de forma general nitrógeno cargado ni sistemas puenteados/espiro.

Antes de aceptar cualquier conversión, se valida la molécula OCL y la valencia editable (C4, N3, O2 y las convenciones previas de nitro cargado). Se reconstruye el grafo del editor y se compara la fórmula **y el número de hidrógenos de cada átomo** con el origen. Así, una fórmula coincidente no puede ocultar el traslado de un H a otro N. No se normalizan tautómeros entre sí. La exportación y reimportación se comparan por isomorfismo completo.

## Cobertura de importación y derivación, por separado

Las estructuras y nombres proceden de respuestas reales de PubChem guardadas con URL, CID, fórmula y SMILES en [fused-reference-records.json](fused-reference-records.json). Se valida la forma concreta recibida; el nombre común no implica identidad entre todos sus tautómeros.

| Referencia | Fórmula | Importación | Derivación |
|---|---|---|---|
| [Purina, CID 1044](https://pubchem.ncbi.nlm.nih.gov/compound/1044) | C5H4N4 | SUPPORTED | PARTIAL |
| [Xantina, CID 1188](https://pubchem.ncbi.nlm.nih.gov/compound/1188) | C5H4N4O2 | SUPPORTED | PARTIAL |
| [Teobromina, CID 5429](https://pubchem.ncbi.nlm.nih.gov/compound/5429) | C7H8N4O2 | SUPPORTED | PARTIAL |
| [Teofilina, CID 2153](https://pubchem.ncbi.nlm.nih.gov/compound/2153) | C7H8N4O2 | SUPPORTED | PARTIAL |
| [Cafeína, CID 2519](https://pubchem.ncbi.nlm.nih.gov/compound/2519) | C8H10N4O2 | SUPPORTED | PARTIAL |

Las cinco estructuras tienen anillos de cinco y seis miembros con dos átomos compartidos y nueve átomos anulares únicos. La cafeína tiene 14 átomos pesados, 15 enlaces, cuatro N, dos C=O y tres metilos unidos a N. PARTIAL reconoce el sistema anular y las funciones respaldadas por conectividad. El nuevo componente genérico `N-bound methyl` identifica C(H3)–N, con el mismo enlace e IDs que utiliza el resaltado. No asigna posiciones 1/3/7 ni deriva el padre purínico. La leyenda del canvas PARTIAL indica estructura uniforme para evitar etiquetar una cadena principal sin evidencia.

La comparación xantina/candidato enólico no identifica ambos grafos; teobromina y teofilina tampoco se identifican entre sí. Se comprueba una representación aromática alternativa de cafeína. Los casos negativos conservan rechazo de cierre incompleto, oxígeno trivalente, nitrógeno neutro tetravalente, sustitución extra de N y pérdida isotópica.

La cobertura de referencia pasa de 14 FULL + 1 PARTIAL a **15 FULL**: los tres casos originales y las doce moléculas del banco de generalización. Esa cifra describe este banco finito; los cinco heterociclos anteriores no se suman como FULL. Los informes de fase 5 y sus mediciones antes/después se conservan como evidencia histórica.

La medición actual, sin sobrescribir la de fase 5, está en [symmetry-fused-coverage.json](symmetry-fused-coverage.json): 15/15 referencias FULL y 5/5 heterociclos importados con derivación PARTIAL.

## Validación automatizada y visual

`tests/symmetry-fused-import.test.mjs` contiene 15 pruebas nuevas: cinco ácidos, asignaciones exactas, orden de IDs/SMILES alternativo, ambigüedad real, localizadores erróneos, isótopos, R/S, cinco heterociclos, identidad de ida/vuelta, regiones de cafeína, valencias y tautómeros. Los conjuntos de alternativas del ácido prioritario y del ácido piválico se fijan independientemente de la salida del motor. Las pruebas antiguas que esperaban el bloqueo de cafeína se sustituyen por verificaciones positivas de fórmula, fuente, importación y PARTIAL; las protecciones de identidad incorrecta y ambigüedad permanecen.

La caché también comprueba una firma de átomos/enlaces: introducir isótopos o estereoquímica en el mismo objeto después de obtener FULL invalida la prueba anterior. Hay aserciones específicas de ambas mutaciones.

El E2E de fase 6 construye ambos nombres, verifica las dos cadenas exactas, conmuta la elección, importa una representación reordenada, construye cafeína, comprueba átomos/enlaces y exige PARTIAL sin FULL. El sistema fusionado selecciona exactamente nueve átomos y diez enlaces, con cero localizadores. Se ejecuta con HTTP controlado y también con servicios reales, sin rutas simuladas en modo live. Los JSON guardan errores de aplicación, errores de consola y, en el modo live final, respuestas de los servicios.

El recorrido live final recibió ambos nombres desde OPSIN (HTTP 200 / SUCCESS) y la confirmación de cafeína desde PubChem CID 2519 (HTTP 200, nombre `1,3,7-trimethylpurine-2,6-dione`). Los registros de errores de aplicación y de consola quedaron vacíos.

Capturas revisadas:

- [Elección equivalente 2/2 y metilo complementario](../outputs/derivation-e2e/symmetry-fused/deterministic/equivalent-parent.png).
- [Cafeína PARTIAL y fusión legible](../outputs/derivation-e2e/symmetry-fused/deterministic/caffeine-partial.png).
- [Cafeína mediante servicios reales](../outputs/derivation-e2e/symmetry-fused/live/caffeine-partial.png).
- [Evidencia DOM y red del recorrido live](../outputs/derivation-e2e/symmetry-fused/live/phase6.json).

Las capturas se generan en `outputs/`, excluido de Git por la configuración existente. Ambos anillos y los dos carbonilos son legibles; la fusión no duplica átomos. Los tests también verifican áreas no degeneradas de ambos polígonos. No se necesitó alterar el algoritmo de layout en esta fase.

Resultados del motor y regresión:

| Comprobación | Resultado |
|---|---|
| Suite serial amplia: componentes, resaltados, contexto, familias, editor, layouts, R/S y E/Z | 163/163; exit 0; 348,3 s |
| Suite focalizada final: simetría, heterociclos, reconciliador, banco y resolver | 76/76; exit 0; 6,6 s |
| Importación/exportación repetida, integridad isotópica y nombres comunes | 38/38; incluye 3900 ciclos de ida/vuelta |
| Medición del banco FULL y del banco fusionado | 15/15 FULL; 5/5 importados PARTIAL; exit 0 |
| E2E original, HTTP controlado | 3/3 contenedores; ibuprofeno, paracetamol, aspirina, sus nombres sistemáticos y variante entre paréntesis; carga/error; 92,6 s |
| E2E familias, HTTP controlado | 3/3; vanillina, benzofenona, benzocaína y 2-hidroxipropanamida, nombres comunes y sistemáticos; carga/error; 92,9 s |
| E2E fase 6, HTTP controlado | 1/1; 39,9 s |
| E2E fase 6, servicios reales | 1/1; 37,6 s; sin errores de aplicación ni consola |
| Typecheck final | Exit 0 |
| Lint de fuentes | 425 archivos, 0 errores, 36 advertencias previas; exit 0 |
| Lint del helper E2E después de la captura atómica | Exit 0 |
| Build de producción | Exit 0; cinco etapas de vinext completadas |
| Worker empaquetado | Importación ESM, `default.fetch` y manifiesto JSON de hosting válidos; exit 0 |
| `git diff --check` | Exit 0 |

Reproducción de la suite focalizada: `node --test --test-concurrency=1 tests/symmetry-fused-import.test.mjs tests/common-name-resolver.test.mjs tests/structural-derivation.test.mjs tests/validated-name-derivation.test.mjs tests/generalized-derivation.test.mjs`. La suite amplia añade interacción 016, fragmentos de resaltado, integración de editor, contexto, constructor, layouts, estereoquímica y empaquetado Windows.

Se registraron tres intentos fallidos como resultados distintos de los pases finales: la primera suite amplia terminó 159/163 por un timeout de transporte Vite de 60 s en el hook SSR de `semi-developed-orthogonal-layout`; la repetición serial fuera del sandbox pasó los 163. En una corrida de regresión de navegador se modificó una fuente durante la ejecución: la recarga HMR interrumpió el clic del escenario de carga/error (2/3). Otra corrida de familias terminó 2/3 porque el resaltado expiró entre su comprobación de presencia y la lectura de sus datos. El helper ahora empieza a observar antes del clic nativo y captura átomos, enlaces y localizadores en una sola operación del navegador. Conserva las mismas aserciones exactas y el temporizador real de dos segundos. Tras corregir esa carrera del test, los ocho contenedores E2E se repitieron sobre fuentes estables y pasaron. Los intentos anteriores no se cuentan como validaciones satisfactorias.

Los E2E usan la instalación existente de Playwright y Chromium headless; no se descargó otro navegador. Se reproducen con `node --test --test-concurrency=1 tests/e2e/derivation.e2e.mjs`, configurando `ORGORUSH_PLAYWRIGHT_MODULE` y `ORGORUSH_CHROMIUM_EXECUTABLE` con las rutas instaladas. `ORGORUSH_E2E_PHASE6=1` selecciona ácido/cafeína; `ORGORUSH_E2E_LIVE=1` utiliza servicios reales. Para las familias se usa `ORGORUSH_E2E_GENERALIZED=1` y `ORGORUSH_E2E_NAMES=vanillin|benzocaine|benzophenone|2-hydroxypropanamide`. Sin ambos selectores se usa el banco original. Los logs finales están en `.sites-runtime/phase6-final-{original,families,deterministic,live}.log`.

En Windows se invocaron directamente TypeScript, ESLint y `node node_modules/vinext/dist/cli.js build`, equivalentes a las herramientas de los wrappers Bash del proyecto. El build conserva avisos de vinext sobre imports Node/compatibilidad SSR y tamaño de chunk. La validación del Worker es local y comprueba el contrato del artefacto; no representa una ejecución desplegada en Cloudflare ni una prueba de bindings remotos.

## Límites pendientes

La gramática purínica, su numeración y los nombres tautoméricos no están implementados para FULL. La nueva frontera de importación es deliberadamente acotada a los sistemas neutros descritos. No garantiza todos los heterociclos, cargas, tamaños anulares ni topologías policíclicas. Los isótopos siguen sin representación editable. La equivalencia se prueba para el grafo concreto, conservando H y estereoquímica soportada; no es un normalizador de tautómeros. Un límite de búsqueda o una alternativa principal no equivalente conserva PARTIAL.

No se instaló ninguna dependencia nueva ni se realizó despliegue.
