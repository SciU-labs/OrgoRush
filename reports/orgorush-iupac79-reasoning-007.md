# ORGORUSH-IUPAC79-REASONING-007

## Alcance

Corrección de presentación del razonamiento Legacy español e inglés. Los motores de nomenclatura, la resolución EN → ES, los nombres generados, las fórmulas y la numeración no se modifican. Cambios locales, sin commit ni push.

## Diagnóstico

1. `legacyStructuralReasoningText()` denominaba «esqueleto carbonado» a una raíz numérica tomada directamente de `alkaneRoots`: `met`, `et`, `prop`, `but`. Además, el inglés recibía las grafías españolas `met` y `et`.
2. El adaptador de fragmentos Legacy descartaba la extensión de una cadena funcional ya reconocida: `etan` se recortaba a `et`. En inglés podía enlazar solamente `met` dentro de `methan` o `et` dentro de `ethan`.
3. Los formatos históricos con locantes iniciales (`3-buten-2-one`) y vocales de enlace (`1,2-etanodiol`, `2,4-pentanedione`) necesitan reconocimiento de presentación específico para separar correctamente cadena, insaturación y función.

## Solución

`deriveLegacyParentNamePresentation()` comparte la evidencia entre la explicación y el adaptador de enlaces. Distingue raíz numérica, fragmento saturado realmente escrito y componente funcional completo. Utiliza `englishIupacRoot()` para las grafías inglesas y la evidencia funcional existente para ubicar los componentes.

| Nombre visible | Raíz numérica | Fragmento saturado | Componente funcional | Enlace de cadena principal |
| --- | --- | --- | --- | --- |
| etanoato de metilo | et- | etan- | etanoato | etan |
| methyl ethanoate | eth- | ethan- | ethanoate | ethan |
| metanoato de metilo | met- | metan- | metanoato | metan |
| methyl methanoate | meth- | methan- | methanoate | methan |
| etanol / ethanol | et- / eth- | etan- / ethan- | etanol / ethanol | etan / ethan |
| etanamina / ethanamine | et- / eth- | etan- / ethan- | etanamina / ethanamine | etan / ethan |
| 3-buten-2-ona / 3-buten-2-one | but- | No corresponde | 3-buten-2-ona / 3-buten-2-one | but |

La vocal de enlace se conserva en el fragmento interactivo cuando aparece escrita: `etano` en `1,2-etanodiol` y `pentane` en `2,4-pentanedione`. La explicación identifica por separado la base saturada `etan-` / `pentan-`. El sufijo funcional queda fuera del enlace de cadena. Los nombres insaturados no se describen como cadenas saturadas. Los componentes de ácidos conservan `ácido` / `acid`.

Se mantienen los enlaces de alcanos saturados completos y el tratamiento previo de vocales de enlace de cetonas cíclicas. Las nuevas adaptaciones de presentación se activan exclusivamente en Legacy; IUPAC 2013 conserva su comportamiento.

No se usan sustituciones globales ni tablas de nombres particulares por SMILES en producción. Los nombres explícitos de los tests son referencias congeladas de regresión.

## Archivos

- `app/page.tsx`: explicación bilingüe y uso de la descomposición compartida.
- `app/reasoning-name-fragments.ts`: evidencia morfológica de presentación y conservación del fragmento principal completo.
- `tests/iupac79-reasoning-007.test.mjs`: matriz de 27 estructuras, ambos idiomas y dos órdenes de átomos; 108 modelos de razonamiento, más controles negativos.
- `tests/audnom004-explained-nomenclature.test.mjs`: expectativas visuales Legacy actualizadas de `non` / `oct` / `dec` a `nonan` / `octan` / `decan`, manteniendo los nombres químicos y las expectativas IUPAC 2013.
- Este informe.

## Pruebas

La matriz incluye metanoatos, etanoatos, propanoatos y butanoatos; un éster ramificado; raíces repetidas en `ethyl ethanoate`; alcoholes; cetonas; aminas; dioles y dicetonas; alquenos y alquinos; alcoholes y cetonas insaturados; amidas; nitrilos; aldehídos y ácidos. `2-nonanone` verifica que la búsqueda no tome una raíz que cruce al sufijo `one`.

Cada observación comprueba nombres exactos, raíz y fragmento esperados, componente funcional cuando procede, grafo y análisis inmutables, procedencia atómica de los enlaces, conservación de locantes, destinos de navegación y reconstrucción literal del nombre. Ningún fragmento principal puede solaparse con evidencia funcional ni de insaturación. La partición renderizada se comprueba sin pérdidas ni duplicación. Se conservan los solapamientos semánticos intencionales entre numeración y función.

Resultados finales sobre el código modificado:

| Validación | Resultado |
| --- | --- |
| Todas las pruebas `*reasoning*.test.mjs`, enlaces de alcanos Legacy, selector/display, convenciones, FALLBACK-005/006, AROMATIC-004, CYCLIC-AUDIT-003 y bicicletas fusionadas Legacy | 256 PASS, 0 FAIL, 0 SKIP |
| `audnom004-explained-nomenclature.test.mjs` | 61 PASS, 0 FAIL, 0 SKIP |
| Total de los dos grupos finales, sin duplicar la ejecución intermedia | **317 PASS, 0 FAIL, 0 SKIP** |
| Nuevos casos REASONING-007 incluidos en el primer grupo | 28 PASS; 27 estructuras × 2 idiomas × 2 órdenes de átomos y controles negativos |
| `npm run build:pages` | PASS |
| `npm run validate:pages` | PASS; 3 entradas, 6 assets, base `/Hydrocarbon-Lab/` |
| `bash scripts/build-verified.sh` | PASS; compilación Sites y validación del Worker ESM `default.fetch` y manifiesto |
| TypeScript frente a HEAD `b4efa07` | 49 diagnósticos previos, 49 actuales, **0 nuevos** |
| `git diff --check` | PASS |

Los dos grupos finales se ejecutaron mediante `node --test --test-concurrency=1`. El primero comprende los nueve archivos que coinciden con `tests/*reasoning*.test.mjs` más `fix-reason-legacy-alkane-fragments`, `legacy-profile-display`, `nomenclature-conventions`, `iupac79-fallback-005`, `iupac79-fallback-006`, `iupac79-aromatic-004`, `iupac79-cyclic-audit-003` y `aud-nom-011-legacy-fused-bicycles` (todos `.test.mjs`). El segundo ejecuta por separado la auditoría anterior indicada en la tabla.

Registros locales ignorados por Git: `outputs/reasoning-007/regression-final.log`, `earlier-audit-regression.log`, `build-pages-final.log`, `build-sites-final.log` y `typecheck-comparison.json`.

## Límites

El reconocimiento consume exclusivamente nombres y análisis existentes. No amplía la cobertura química Legacy ni descompone artificialmente nombres retenidos indivisibles. Si no existe evidencia de un fragmento, la explicación no lo inventa.

No se ejecuta de nuevo la suite global de generación de ejercicios en esta tarea de presentación. Se ejecutan todas las pruebas de razonamiento y las regresiones químicas y de selección Legacy relacionadas. No se realiza una comprobación manual en navegador; las interacciones se verifican mediante los tests existentes de componentes, navegación y perfiles activos.
