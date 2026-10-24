# ORGORUSH-IUPAC2013-LOCALIZATION-012

Referencia inicial: `main`, `5c737a7d959c5c8ff2386a1130abfa362af4b82a`, árbol limpio. Fecha: 23 de octubre de 2026. Cambios locales, sin commit, push ni despliegue.

## Causa y corrección

El fallback del perfil Current tomaba `pubChemIupacName` directamente y omitía `localizeChemicalNameForDisplay()`. El vocabulario existente conocía `acetyl` y `methyl`, pero no la construcción completa de hidrogenación, fusión y cetona; aplicarlo parcialmente habría producido un nombre híbrido.

El fallback mostrado pasa ahora por el localizador existente con `{ source: "external" }`. Inglés devuelve el original sin modificar. Español reconoce la construcción completa antes de convertir componentes. Los consumidores locales y Legacy mantienen el comportamiento previo del localizador.

Antes, nombre principal español:

```text
(8S,9S,10R,13S,14S,17S)-17-acetyl-10,13-dimethyl-1,2,6,7,8,9,11,12,14,15,16,17-dodecahydrocyclopenta[a]phenanthren-3-one
```

Después:

```text
(8S,9S,10R,13S,14S,17S)-17-acetil-10,13-dimetil-1,2,6,7,8,9,11,12,14,15,16,17-dodecahidrociclopenta[a]fenantren-3-ona
```

La forma española se contrastó antes de fijar la expectativa: [Guía IUPAC/RSEQ en español](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf), tablas 1–3 y secciones 5.3, 7 y 9; el [documento técnico del fabricante Organon](https://organonpro.com/es-ce/implanon-ipp-cr), p. 25, utiliza `ciclopenta[a]fenantren-3-ona`. El texto indexado de la [ficha Fisher Scientific/Lipomed 30458294](https://www.fishersci.es/shop/products/progesterone-lipomed/30458294) corrobora el nombre español completo; su página directa no se recuperó mediante el navegador de investigación. La construcción conserva la numeración y los descriptores del texto proporcionado.

## Reglas de presentación

- Reconocimiento completo de prefijos locantados `acetyl`, `methyl` y `dimethyl`, seguido de la construcción `dodecahydrocyclopenta[a]phenanthren-<locante>-one`.
- Reutilización del vocabulario existente para `acetil`, `metil` y `dimetil`; incorporación contextual de `dodecahidro`, `ciclopenta[a]` y `fenantren-<locante>-ona`.
- Copia literal de estereodescriptores, localizadores, `[a]`, comas, paréntesis y guiones. No se reordenan componentes.
- Fuera de esa construcción, un nombre externo sólo usa el vocabulario simple previo si todos sus caracteres léxicos están reconocidos. Un componente desconocido conserva el **nombre original completo**.
- Los nombres ya españoles permanecen intactos; localizar dos veces produce el mismo resultado.

No se amplía a otros descriptores de fusión, grados de hidrogenación o sufijos funcionales sin verificar su construcción completa. Esta limitación conserva el original en los casos fuera del vocabulario.

`namingPubChemIdentity.iupacName` conserva el texto original de PubChem. `pinName`, el cálculo del nombre canónico, las consultas y los metadatos de exportación/almacenamiento mantienen sus valores y reglas anteriores. El panel de procedencia existente permite consultar el nombre de PubChem cuando difiere del nombre principal localizado en Current. El comportamiento de esa condición en Legacy se conserva. No se modifican motores, grafo, SMILES, razonamiento, Practice/Exam, peticiones ni carga asincrónica. No se añaden dependencias ni servicios.

## Archivos

- `app/iupac-name-normalization.ts`: reconocimiento contextual y cobertura completa para presentación externa.
- `app/page.tsx`: fallback mostrado de Current y disponibilidad del original en procedencia.
- `tests/iupac2013-external-localization.test.mjs`: diez regresiones nuevas, incluida ejecución de la expresión real de selección de perfiles mediante AST/VM, metadatos canónicos y procedencia.
- `tests/chemistry-regressions.test.mjs`, `tests/formula-candidate-integration.test.mjs`: actualizar únicamente las aserciones del cableado de presentación; expectativas químicas y salvaguardas conservadas.
- Este informe.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npm run typecheck -- --pretty false` | 0 diagnósticos, salida 0 |
| Pruebas dirigidas de localización, selector, PubChem y Legacy | 109 PASS, 0 FAIL, 0 omisiones |
| Matriz 008/FIX-009 y comparación profunda | 72 estructuras, 216 observaciones: 195 PASS, 19 UNSUPPORTED, 2 PENDING-REFERENCE; campos químicos/pedagógicos idénticos; modo estricto respaldado exitoso |
| Pages: compilación y validación | Salida 0; 3 entradas, 6 assets, base `/Hydrocarbon-Lab/` |
| Sites: compilación y validación | Salida 0; Worker ESM `default.fetch` y manifiesto de hosting validados |
| Suite general completa | 170 archivos, 3063 pruebas: 3057 PASS, 1 FAIL (`ETIMEDOUT`), 5 SKIP previos, 0 cancelaciones; salida 1 |
| Repetición aislada del archivo fallido | 51 PASS, 0 FAIL, 0 SKIP; salida 0; archivo completo, sin filtros y con timeout original de 30000 ms por proceso |

Las pruebas verifican el nombre completo, sus seis descriptores, todos los números y la puntuación, inglés idéntico, idempotencia, nombres simples, rechazo de traducciones parciales, variantes estereoquímicas copiadas literalmente, los dos perfiles locales y la conservación del original y los nombres canónicos. No acceden a la red.

La matriz nueva se guarda en `outputs/localization-012/reaudit.matrix.json`; las 195 referencias positivas y los informes/fixtures históricos no se sobrescriben. El verificador existente compara todos los campos químicos y pedagógicos con FIX-009, excluyendo sólo fecha y commit del archivo. Los logs completos y los hashes de esta ejecución permanecen en `outputs/localization-012/`, ignorado por Git.

La incidencia de la suite general corresponde a `separate fresh Node processes reproduce every category with entropy and clock APIs disabled`, en `tests/exercise-chemical-generator.test.mjs:370`: `execFileSync` agotó su límite de 30000 ms, con `ETIMEDOUT`, `SIGTERM` y salida vacía. La prueba duró 31,6 s. No se registró una comparación química incorrecta. Las diez regresiones LOCALIZATION-012 pasaron también dentro de esa suite. Se conserva íntegra la ejecución con salida 1, sin reclasificarla como exitosa.

La repetición completa de `tests/exercise-chemical-generator.test.mjs` terminó con 51 PASS y salida 0. La prueba de los dos procesos nuevos también pasó (44,2 s en conjunto), manteniendo el límite original de 30 s para cada proceso. No se modificó ese archivo ni se relajaron expectativas o controles. La ejecución general original conserva su FAIL por timeout; no se declara una suite general íntegramente verde.

El cierre de evidencia (`outputs/localization-012/verify-results.mjs`, salida 0) comprueba el único error `ETIMEDOUT`, el reintento exitoso, las diez regresiones nuevas aprobadas dentro de la suite, las mismas cinco omisiones históricas, los hashes de las cinco fuentes probadas y los seis archivos de referencias protegidos. No hubo cambios de fuentes durante ninguna ejecución. El resumen reproducible queda en `outputs/localization-012/results.json`.

La corrección de presentación queda verificada dentro de la cobertura indicada. Se mantiene documentada la incidencia de tiempo de la primera suite; las construcciones externas no reconocidas conservan íntegro su original. No se realizaron commit, push ni despliegue.
