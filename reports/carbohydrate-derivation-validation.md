# Fase 8 — monosacáridos dentro del editor existente

## Alcance y resultado

Se trabajó sobre la copia local, incluidos los cambios sin publicar de fase 7; no se reemplazó por GitHub. La importación, el reconocimiento estructural y la derivación del nombre son tres comprobaciones separadas.

Las diez estructuras prioritarias se importan conservando sus configuraciones absolutas. Sus nombres sustitutivos R/S completos se reconcilian FULL mediante reconstrucción e isomorfismo de todo el grafo. Nueve nombres retenidos explícitos también alcanzan FULL. `beta-D-fructofuranose` permanece PARTIAL como nombre retenido: se reconoce el hemicetal, la familia fructosa y D, pero no se afirma su descriptor β. El nombre sustitutivo completo de ese mismo grafo sí tiene una prueba independiente de cada R/S. No se presentan ambos resultados como equivalentes.

Los nombres genéricos y las referencias cíclicas sin configuración anomérica permanecen PARTIAL. El banco anterior conserva sus 20 FULL. La evidencia ejecutable está en [carbohydrate-derivation-coverage.json](carbohydrate-derivation-coverage.json), generado por `node scripts/audit-carbohydrate-derivation.mjs`.

## Capacidades originales y catálogo invariable

El editor ya admitía C/O, enlaces simples/dobles/triples, valencias neutras, H implícitos, múltiples OH, aldehídos, cetonas y anillos oxigenados de cinco/seis miembros. El importador traduce H explícitos de SMILES al modelo implícito y exige conservar fórmula y población de H por átomo. Los campos `tetrahedralParity: R/S` y el enlace portador de cuña ya existían, al igual que importación/exportación estereoquímica y mecanismos CIP.

No se modificaron el modelo de átomos/enlaces, las reglas de valencia, el importador, los mecanismos existentes de estereoquímica ni el registro de herramientas de anillos. No se instaló ninguna dependencia ni se añadió otro servicio al flujo del producto. Solo se utilizan las infraestructuras existentes de OPSIN/PubChem.

El catálogo conserva exactamente seis grupos oxigenados, cuatro nitrogenados y cuatro halógenos: **14 entradas**. No se añadieron botones de hemiacetal, hemicetal, piranosa o furanosa, ni un editor Fischer/Haworth. Las nuevas etiquetas corresponden a evidencia interna de derivación, no a herramientas de construcción.

[carbohydrate-editor-baseline.json](carbohydrate-editor-baseline.json) contiene hashes tomados antes de editar fase 8 sobre el estado local de fases 1–7. `tests/carbohydrate-editor-catalog.test.mjs` comprueba los bytes normalizados LF del catálogo, sus etiquetas y el bloque de categorías/distribución del menú, evalúa sus 14 entradas y verifica que los módulos de valencia, átomos/enlaces, registro de anillos y estereoquímica siguen intactos.

La etiqueta de almacenamiento `cycloalkane` significa históricamente «anillo no aromático» en este modelo. Ya se separaba de la composición química: el padre del modelo Legacy usa `heterocycle`, el rótulo visible usa «Heterociclo» y el nombre incompleto de un heterociclo polihidroxilado queda protegido. Las nuevas pruebas de integración verifican esas tres condiciones en anillos oxigenados y conservan el ciclohexano como hidrocarburo. No fue necesario migrar el enum de anillos ni cambiar documentos persistidos. El reconocedor nuevo no utiliza esa etiqueta para identificar un azúcar.

## Referencias e identidad de las formas

Se consultaron PubChem y OPSIN nuevamente: [respuestas originales](carbohydrate-reference-live.json) y [controles sistemáticos independientes](carbohydrate-systematic-controls.json). Cada recibo conserva URL, fecha, estado HTTP, SMILES y CML cuando procede. Las referencias numéricas esperadas proceden de los localizadores CML, separados de sus H explícitos; no del algoritmo nuevo.

Se detectó un problema de sinónimos real: PubChem interpreta la consulta `aldehydo-L-glucose` como CID 2724488, una forma cíclica sin especificación anomérica. OPSIN devuelve la cadena abierta. No son isomorfos y la prueba exige esa diferencia. La referencia de L-glucosa abierta se verificó por separado con su nombre `(2S,3R,4S,5S)-2,3,4,5,6-pentahydroxyhexanal`, que PubChem resuelve a CID 10954115. Ambos recibos originales se conservan; no se alteró la respuesta del sinónimo para aparentar coincidencia.

La base normativa es [IUPAC P-102](https://iupac.qmul.ac.uk/BlueBook/P10.html): sus tablas 10.2/10.3, numeración y padres de monosacáridos. La relación configuracional de D/L se contrastó con [2-Carb-3/4](https://iupac.qmul.ac.uk/2carb/03n04.html), y la relación de anomería con [2-Carb-6](https://iupac.qmul.ac.uk/2carb/06n07.html).

## Reconocimiento por conectividad completa

`carbohydrate-structure.ts` exige un esqueleto carbonado lineal de cinco o seis carbonos, tantos O como C, neutralidad, valencias válidas, enlaces editables y un solo sistema compatible. Rechaza ramificaciones, cargas, isótopos no representables, aristas duplicadas/incorrectas y elementos ajenos al alcance. La fórmula C6H12O6 no decide la identidad.

En forma abierta exige un único C=O y OH en todos los otros carbonos. La orientación de la cadena da C1 al aldehído o C2 a la cetona admitida, comprobando también el H y los vecinos carbonados del carbonilo. En forma cíclica exige un único O con dos vecinos carbonados, el resto de O como OH libres y una cadena carbonada completa con un único cierre compatible de cinco/seis miembros.

El carbono anomérico es el carbono unido simultáneamente al O del anillo y a un OH libre. Un vecino C y un H identifican el hemiacetal aldósico; dos vecinos C y ningún H identifican el hemicetal cetósico. El otro extremo del puente O determina el sitio de cierre. Se verifican todos los carbonos exocíclicos y todos los OH. Un éter ordinario, un poliol sin carbonilo, un acetal, un glucósido o una molécula con conectividad distinta no satisface este sobre estructural.

Reconocer el sobre no demuestra un nombre: un azúcar con centros sin asignar puede tener esqueleto, carbonilo, OH, cierre y referencia numerados de forma segura, pero sigue PARTIAL como derivación completa.

## D/L, familias y anomería

Se transforma la paridad relativa de OCL a un marco de ligandos ordenados por la cadena: carbono anterior, carbono siguiente, oxígeno y H implícito. Se contabiliza la paridad de la permutación respecto de los índices reales. El marco representa la convención Fischer de la cadena acíclica; no usa las coordenadas x/y del editor. El centro de referencia es el centro configuracional de mayor localizador del padre, C5 en las hexosas y C4 en las pentosas de este alcance.

La comparación con ese marco determina D/L; no existe una regla general `R = D`. El patrón completo de todos los centros no anoméricos distingue los estereopadres glucosa, manosa y galactosa, además de fructosa y cuatro aldopentosas. Las formas L invierten el patrón completo. Los centros ausentes impiden identificar una familia completa. Los patrones retenidos son definiciones configuracionales de estereopadres, no excepciones que conceden FULL por el nombre común.

Para los hemiacetales aldósicos admitidos, el ligando de cierre en C1 ocupa el lugar definido por el marco formal. Se compara la configuración del oxígeno exocíclico anomérico con la referencia: relación formal cis para α y trans para β. Se exige configuración explícita en ambos sitios y en los demás centros necesarios para demostrar el nombre. Las referencias independientes verifican ambas glucopiranosas, ambas glucofuranosas y ambas glucopiranosas L. Rotaciones y reflexiones del dibujo conservando R/S no cambian el resultado.

La conversión del centro cuaternario anomérico de cetosas requiere una verificación formal adicional. No se reutiliza automáticamente la regla CHOH aldósica ni se deduce α/β de una letra CIP. Ese paso queda fuera de las reglas demostradas: el nombre retenido de β-D-fructofuranosa conserva PARTIAL, aunque se pueda demostrar un nombre sustitutivo R/S del grafo completo. No es una incapacidad de importación del editor.

En la conversión interna se encontró que el Canonizer usado para calcular prioridades puede conservar valores CIP provisionales después de ajustar paridades absolutas. El módulo nuevo recalcula CIP en un grafo OCL fresco que copia las paridades relativas ya establecidas y mantiene el orden de índices; no vuelve a percibirlas desde coordenadas 2D. Esta medida es local a carbohidratos y no modifica el módulo estereoquímico anterior. Los roundtrips SMILES y las referencias OPSIN/PubChem verifican la conservación de R/S.

## Derivación FULL y highlighting compartido

`carbohydrate-derivation.ts` interpreta dos gramáticas acotadas: nombres retenidos con forma explícita y descriptores completos, y nombres sustitutivos R/S de cadenas polihidroxiladas y padres oxane/oxolane. Reconstruye todos los átomos, OH, sustituyentes exocíclicos y configuraciones indicadas, consume el nombre completo y exige un isomorfismo completo con `mapStructuralRegions`. No borra estereoquímica ni normaliza una forma abierta a otra cíclica.

`reconcileSystematicName` tiene una entrada específica para estos carbohidratos. Las producciones anteriores conservan su exclusión deliberada de estereoquímica no implementada. El modelo nuevo usa los mismos `NameComponent`, `validatedNameTargets`, prioridades visuales, regiones y controlador temporal de highlighting. Los spans del nombre son literales. `preferred` continúa en `false`.

Las facetas verificadas incluyen esqueleto, carbonilo, OH, oxígeno del anillo, centro anomérico, patrón configuracional, centro de referencia y cadena exocíclica. El nombre sustitutivo conserva sus localizadores heterocíclicos (O1 del oxane/oxolane); las facetas de carbohidrato declaran explícitamente su propia numeración C1–C6. Los números son contextuales para evitar mezclar esos dos sistemas. No se añadieron números permanentes ni controles de dibujo. La restricción anterior de vista condensada en sistemas cíclicos se conserva.

La ruta PARTIAL presenta la evidencia estructural y sus localizadores como tales, sin afirmarlos como prueba del nombre externo. La invalidación existente por grafo/configuración evita reutilizar resultados después de editar o alternar moléculas.

## Matriz verificable

La tabla siguiente usa la estructura OPSIN contrastada con PubChem. «Retenido» se refiere al nombre explícito de la primera columna, y «R/S» al nombre completo de la segunda. Todas las filas son importables y reconocidas estructuralmente. Para L-glucosa abierta se usa la comprobación independiente del CID 10954115 descrita anteriormente.

| Caso explícito | Importación | Reconocimiento | Nombre sustitutivo recibido | Retenido | R/S |
|---|---|---|---|---|---|
| aldehydo-D-glucose | SUPPORTED | open; D-glucose; α/β no aplica | `(2R,3S,4R,5R)-2,3,4,5,6-pentahydroxyhexanal` | FULL | FULL |
| aldehydo-L-glucose | SUPPORTED | open; L-glucose; α/β no aplica | `(2S,3R,4S,5S)-2,3,4,5,6-pentahydroxyhexanal` | FULL | FULL |
| alpha-D-glucopyranose | SUPPORTED | pyranose; D-glucose; alpha | `(2S,3R,4S,5S,6R)-6-(hydroxymethyl)oxane-2,3,4,5-tetrol` | FULL | FULL |
| beta-D-glucopyranose | SUPPORTED | pyranose; D-glucose; beta | `(2R,3R,4S,5S,6R)-6-(hydroxymethyl)oxane-2,3,4,5-tetrol` | FULL | FULL |
| alpha-D-glucofuranose | SUPPORTED | furanose; D-glucose; alpha | `(2S,3R,4R,5R)-5-[(1R)-1,2-dihydroxyethyl]oxolane-2,3,4-triol` | FULL | FULL |
| beta-D-glucofuranose | SUPPORTED | furanose; D-glucose; beta | `(2R,3R,4R,5R)-5-[(1R)-1,2-dihydroxyethyl]oxolane-2,3,4-triol` | FULL | FULL |
| aldehydo-D-mannose | SUPPORTED | open; D-mannose; α/β no aplica | `(2S,3S,4R,5R)-2,3,4,5,6-pentahydroxyhexanal` | FULL | FULL |
| aldehydo-D-galactose | SUPPORTED | open; D-galactose; α/β no aplica | `(2R,3S,4S,5R)-2,3,4,5,6-pentahydroxyhexanal` | FULL | FULL |
| keto-D-fructose | SUPPORTED | open; D-fructose; α/β no aplica | `(3S,4R,5R)-1,3,4,5,6-pentahydroxyhexan-2-one` | FULL | FULL |
| beta-D-fructofuranose | SUPPORTED | furanose; D-fructose; α/β retenido no validado | `(2R,3S,4S,5R)-2,5-bis(hydroxymethyl)oxolane-2,3,4-triol` | PARTIAL | FULL |

| Caso | SMILES utilizado y verificado |
|---|---|
| aldehydo-D-glucose | `O=C[C@H](O)[C@@H](O)[C@H](O)[C@H](O)CO` |
| aldehydo-L-glucose | `O=C[C@@H](O)[C@H](O)[C@@H](O)[C@@H](O)CO` |
| alpha-D-glucopyranose | `O[C@@H]1[C@H](O)[C@@H](O)[C@H](O)[C@H](O1)CO` |
| beta-D-glucopyranose | `O[C@H]1[C@H](O)[C@@H](O)[C@H](O)[C@H](O1)CO` |
| alpha-D-glucofuranose | `O[C@@H]1[C@H](O)[C@@H](O)[C@H](O1)[C@H](O)CO` |
| beta-D-glucofuranose | `O[C@H]1[C@H](O)[C@@H](O)[C@H](O1)[C@H](O)CO` |
| aldehydo-D-mannose | `O=C[C@@H](O)[C@@H](O)[C@H](O)[C@H](O)CO` |
| aldehydo-D-galactose | `O=C[C@H](O)[C@@H](O)[C@@H](O)[C@H](O)CO` |
| keto-D-fructose | `OCC(=O)[C@@H](O)[C@H](O)[C@H](O)CO` |
| beta-D-fructofuranose | `OC[C@]1(O)[C@@H](O)[C@H](O)[C@H](O1)CO` |

Las estructuras y los conjuntos exactos de átomos/enlaces/localizadores de cada fila están en [carbohydrate-derivation-coverage.json](carbohydrate-derivation-coverage.json). Los cinco/seis localizadores de carbono, el O anular y los OH se contrastan con el CML independiente.

Las respuestas PubChem de `glucose`, `D-glucose` y `D-fructose` tienen centros anoméricos sin asignar: se importan y reconocen, pero conservan PARTIAL. OPSIN puede resolver esos textos a otras formas abiertas específicas; el flujo debe analizar la estructura efectivamente recibida y su nombre verificado, sin identificarlas con la referencia cíclica del sinónimo.

Los controles de [frontera de importación](carbohydrate-import-boundaries.json) verifican además que una variante con 13C y una variante con O aniónico siguen rechazadas por el modelo existente. No se eliminan esos datos ni se amplía el editor para importarlas. Un glucósido o un poliol puede ser importable con las herramientas anteriores y, a la vez, no satisfacer el reconocedor de monosacáridos de esta fase: importación y reconocimiento no se confunden.

## Pruebas y problemas encontrados

Las 65 pruebas nuevas de estructura/derivación cubren 14 referencias, CML numerado, identidad OH/O anular, nombres retenidos y sustitutivos, metadatos de C implícito, inversión de IDs y almacenamiento, rotación, reflexión y exportación/reimportación de SMILES. Se eliminó o invirtió cada centro configuracional de cada referencia para exigir rechazo del nombre completo original.

Las negativas también incluyen D/L incorrecto, α/β intercambiado, epímeros glucosa/manosa/galactosa, cambio de tamaño de anillo, aldosa/cetosa, acetal/glucósido, un isómero C6H12O6 con otra conectividad, OH o carbonilo mal situado, valencias/cargas/isótopos inválidos, localizadores mal formados y moléculas no relacionadas. Dos pruebas adicionales verifican la invariancia del catálogo y otras dos ejecutan el análisis real del editor.

El arnés Playwright observa la selección antes del clic nativo para comprobar los indicadores durante su temporizador existente. Lee R/S del grafo real mediante un atributo pasivo del átomo. Verifica átomos, enlaces y localizadores de todos los componentes, además de comparar la numeración y O del anillo con las referencias CML. Comprueba nombres comunes y sistemáticos, las diez estructuras, sustitución de moléculas, ausencia de estados obsoletos, vista esquelética, nombre retenido sin metadatos y el fallback de glucosa con anomería sin especificar.

La revisión final detectó y corrigió un defecto semántico real: la región del prefijo literal incluía todos los átomos exteriores al padre, por lo que `6-(hydroxymethyl)` también señalaba OH del anillo y `pentahydroxy` incluía el O carbonílico. Ahora el primero selecciona únicamente su C/O exocíclico y sus enlaces reales, y el segundo solo los cinco O de OH y sus enlaces de unión. Los OH del anillo pertenecen al sufijo poliol. Se añadieron comprobaciones independientes de átomos, enlaces y localizadores escritos a partir de los localizadores exocíclicos fijados en el fixture CML. Así se evita que comparar una selección con el mismo modelo de producción oculte un error de alcance del fragmento.

Durante su preparación se corrigieron tres problemas del arnés nuevo: orientación textual de las aristas (`10:2` frente a `2:10`), reconocimiento de la URL EBI ya utilizada por el producto para OPSIN y aislamiento de una página sin la identidad PubChem previamente cacheada. No se relajaron comparaciones químicas ni se modificaron expectativas antiguas para ocultar regresiones.

## Validación técnica

Resultados estructurados: [carbohydrate-validation-results.json](carbohydrate-validation-results.json).

| Comprobación | Resultado |
|---|---|
| Banco anterior | 20/20 FULL conservados |
| Prioridades de esta fase | 10/10 importables y reconocidas; 10/10 nombres R/S FULL; 9/10 nombres retenidos FULL |
| Pruebas focales finales, tras corregir el prefijo | 186/186 aprobadas, incluidas las 65 específicas y la invariancia del catálogo |
| Integración con el análisis real del editor | 2/2 aprobadas |
| `npm run test:critical` | 157/157 aprobadas en la copia temporal |
| `npm test` | 3359 aprobadas, 5 omisiones existentes y cero fallos; 3364 casos en 191 archivos. Repetición focal final del archivo afectado incluida. |
| E2E anteriores | 9/9 aprobados: originales, aromáticos/generalización, simetría/fusión y purinas simuladas/reales |
| E2E de carbohidratos simulado | 1/1 aprobado, diez estructuras, nombres sistemáticos, nombre retenido y fallback PARTIAL |
| E2E de carbohidratos real | 1/1 aprobado, diez estructuras, nombres realmente recibidos y blancos exactos |
| Typecheck final | Aprobado |
| Lint global | 0 errores, 36 advertencias existentes; excluye snapshots/capturas generados de `outputs` y `.sites-runtime` |
| Lint de los archivos afectados tras el último ajuste | Aprobado |
| `npm run build:pages` final | Aprobado |
| `npm run validate:pages` final | 4/4 aprobadas |
| Build de producción final | Aprobado |
| Validación local del Worker | ESM importable, `default.fetch` presente y manifiesto de hosting JSON válido |
| Despliegue | No realizado |

Los 11 recorridos E2E pasaron. Se repitieron ambos recorridos de carbohidratos con la corrección final de prefijos y las comparaciones independientes de CML. No hay errores de página ni de consola inesperados. El recorrido real registra tres respuestas OPSIN 404/FAILURE para candidatos de traducción que la infraestructura existente intenta antes de la grafía original correcta (`glucofuranse`/`fructofuranse`). Se conservan los mensajes y URLs exactos y se exige una resolución OPSIN posterior correcta; no se ocultan errores de ejecución ni se sustituyen nombres para obtener FULL.

La primera ejecución crítica sobre OneDrive sufrió timeouts de transporte Vite al cargar módulos; sus fallos en cadena eran del hook de carga. Se detuvo ese proceso y se repitió completo el comando en una copia temporal byte a byte del estado local. Esa ejecución terminó con 157 aprobadas y cero fallos. Las referencias históricas conservan sus finales de línea y hashes; el índice Git temporal se inicializó desde el HEAD local sin reescribir los archivos de trabajo. No se modificó ningún test antiguo durante fase 8.

La ejecución integral y la validación final tienen recibos separados en `.sites-runtime/phase8-unit-snapshot.json` y `phase8-snapshot.json`. Entre ellas solo cambió un archivo de producto: `app/carbohydrate-derivation.ts`, para corregir el alcance del prefijo literal, sus enlaces y sus localizadores. Se compararon las 14 referencias: los estados FULL, nombres, padres y todos los demás componentes son idénticos. Las repeticiones finales focales y E2E cubren ese ajuste. Los 147 archivos de producto de la copia E2E final coinciden por SHA-256 con el workspace; `.sites-runtime/phase8-application-match.json` y `phase8-literal-prefix-delta.json` documentan la comprobación.

Se ejecutaron los dos archivos de auditoría opcionales: **24 casos, 20 aprobados y los mismos cuatro fallos preexistentes de fase 7**. Son la guardia de hashes históricos de infraestructura y AUDNOM-002/003/005, con salidas Legacy EN sin recibo independiente (`UNVERIFIED`). Se conservaron las pruebas y referencias congeladas; no se los declara aprobados. Su contraste anterior está en el [informe de fase 7](purine-full-derivation-validation.md); el resultado actual está en `.sites-runtime/phase8-optional-audits.log`.

Logs principales: `.sites-runtime/phase8-npm-test.log`, `phase8-critical-final.log`, `phase8-final-focused.log`, `phase8-editor-compatibility.log`, `phase8-project-lint.log`, `phase8-final-scope-lint.log`, `phase8-final-typecheck.log`, `phase8-final-build-pages.log`, `phase8-final-validate-pages.log`, `phase8-final-build.log` y `phase8-e2e-{deterministic,live}-final.log`.

## Capturas y evidencia de navegador

Las capturas principales muestran la cadena numerada. El E2E verifica además todos los componentes del nombre y las facetas estructurales; las regiones literales se contrastan con los conjuntos exocíclicos/OH y localizadores de CML, incluidos los enlaces de unión.

| Caso | HTTP simulado | Servicios reales |
|---|---|---|
| D-glucosa abierta | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/aldehydo-D-glucose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/aldehydo-D-glucose.png) |
| L-glucosa abierta | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/aldehydo-L-glucose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/aldehydo-L-glucose.png) |
| α-D-glucopiranosa | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/alpha-D-glucopyranose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/alpha-D-glucopyranose.png) |
| β-D-glucopiranosa | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/beta-D-glucopyranose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/beta-D-glucopyranose.png) |
| α-D-glucofuranosa | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/alpha-D-glucofuranose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/alpha-D-glucofuranose.png) |
| β-D-glucofuranosa | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/beta-D-glucofuranose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/beta-D-glucofuranose.png) |
| D-manosa abierta | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/aldehydo-D-mannose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/aldehydo-D-mannose.png) |
| D-galactosa abierta | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/aldehydo-D-galactose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/aldehydo-D-galactose.png) |
| D-fructosa abierta | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/keto-D-fructose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/keto-D-fructose.png) |
| β-D-fructofuranosa, nombre R/S | [Captura](../outputs/derivation-e2e/carbohydrate/deterministic/beta-D-fructofuranose.png) | [Captura](../outputs/derivation-e2e/carbohydrate/live/beta-D-fructofuranose.png) |

Controles visuales adicionales: [hidroximetilo literal, sin OH del anillo](../outputs/derivation-e2e/carbohydrate/live/alpha-D-glucopyranose-literal-prefix.png), [pentahidroxi, sin O carbonílico](../outputs/derivation-e2e/carbohydrate/live/aldehydo-D-glucose-literal-prefix.png), [vista esquelética](../outputs/derivation-e2e/carbohydrate/live/alpha-D-glucopyranose-skeletal.png), [nombre retenido con D/α](../outputs/derivation-e2e/carbohydrate/deterministic/retained-alpha-D-glucopyranose.png) y [anomería sin especificar, PARTIAL](../outputs/derivation-e2e/carbohydrate/deterministic/unspecified-anomer-partial.png). Se inspeccionaron la legibilidad y las regiones de los prefijos corregidos, la numeración del esqueleto y los centros configuracionales.

Evidencia completa de grafos, selecciones y red: [simulado](../outputs/derivation-e2e/carbohydrate/deterministic/phase8.json) y [real](../outputs/derivation-e2e/carbohydrate/live/phase8.json).

## Archivos de fase 8 y limitaciones

- Nuevos `app/carbohydrate-structure.ts` y `app/carbohydrate-derivation.ts`: reconocimiento, marco configuracional y reconciliación completa.
- `app/validated-name-derivation.ts`: entrada específica y etiqueta interna del padre; `app/structural-derivation.ts`: evidencia PARTIAL y numeración estructural.
- `app/page.tsx`: presentación compartida, numeración contextual, ruta segura PARTIAL y atributo de diagnóstico R/S.
- Nuevos tests `carbohydrate-derivation`, `carbohydrate-editor-catalog`, `carbohydrate-editor-compatibility`, fixture CML y recorrido E2E `carbohydrate.e2e.mjs`.
- `scripts/audit-carbohydrate-derivation.mjs` y los recibos/informes enlazados.

El alcance no incluye disacáridos, polisacáridos, glucósidos, fosforilados, azúcares modificados/deoxi/amino, sales, isótopos, anillos de otros tamaños ni todos los estereopadres retenidos. No se asignan configuraciones ausentes. Un nombre genérico no se convierte en α-D-glucopiranosa. Los nombres con forma o regla no demostrada conservan PARTIAL; las estructuras que el editor rechaza siguen UNSUPPORTED en la importación. No se amplió el editor para admitirlas.

La gramática retenida utiliza las grafías inglesas verificadas de las referencias. El paso formal de anomería en cetosas cuaternarias sigue pendiente, con la distinción entre nombre retenido PARTIAL y nombre sustitutivo R/S FULL documentada arriba.

No se realizó despliegue.
