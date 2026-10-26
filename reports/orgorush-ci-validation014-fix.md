# ORGORUSH-CI-VALIDATION014-FIX

La verificación histórica de VALIDATION-014 se separa de la protección de captura. No se modifica producción, ningún nombre químico, los fixtures originales, la matriz, los defectos ni el informe histórico. No se hace commit, push, despliegue ni reejecución remota de Actions.

## Investigación comprobada

Estado inicial: `main`, `745055edc6850e72f2f058a7329fc262bb97b225`, índice y working tree sin modificaciones. No se encontraron instrucciones `AGENTS.md` aplicables. El adjunto recibido termina en «Si se considera necesario utilizar hashes de esos»; se ha ejecutado la misión y los requisitos completos visibles.

Se descargaron los logs completos de los tres jobs mediante el conector GitHub; quedaron en `outputs/ci-validation014-fix/job-<id>.log`. Cada uno contiene unas 19.940 líneas. Los tres aprobaron las 157 regresiones críticas y la compilación de Sites; luego fallaron exactamente una prueba de integridad histórica, con 3.104 pruebas, 3.098 PASS y cinco SKIP. Los pasos de Pages posteriores a `npm test` quedaron omitidos.

| Ejecución | Job | Commit | Hecho confirmado |
| --- | --- | --- | --- |
| [40241384181](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/40241384181) | 121313721041 | 7870bb60cfb59a066d150b5064a679f9a239cdb7 | `protect()` comparaba HEAD con el commit anterior a la publicación de la propia auditoría. |
| [40245755436](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/40245755436) | 121326846984 | 551fc5a68f421686b76ebfd2031bf0cfb58ca02c | Eliminada esa comparación, se compararon bytes de checkout Linux contra un hash de checkout Windows de `bug_report.md`. |
| [40248616569](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/40248616569) | 121335417242 | 745055edc6850e72f2f058a7329fc262bb97b225 | La conversión uniforme a LF/CRLF no podía reconstruir el hash original mixto de `app/globals.css`. |

Los runners utilizaron Node 22.23.3 y checkout con `fetch-depth: 1`. El commit original de la auditoría no está garantizado en ese clon. El nuevo verificador histórico no exige ese objeto ni ejecuta Git.

La configuración local tiene `core.autocrlf=true`; no existe `.gitattributes` en el repositorio. `git check-attr` no asigna filtros a los dos archivos implicados. Hay definiciones globales de Git LFS, sin efecto observado sobre esos archivos. El índice contiene LF; el working tree de `bug_report.md` tiene CRLF y el de `globals.css` mezcla LF/CRLF. No hay diferencias de contenido entre esos archivos y sus blobs del baseline tras normalizar CRLF a LF.

| Archivo | SHA-256 capturado de bytes Windows | SHA-256 del blob Git / texto LF |
| --- | --- | --- |
| `.github/ISSUE_TEMPLATE/bug_report.md` | `7ee5a64f66fbca9391afed67bb89b3f9880bdb10ca63e27188c9bec568920c75` | `07e62e55a5310249370408496441fbecffde76afd23e6bca5b7ec36dab4de834` |
| `app/globals.css` | `fe70d052449128596d6e90589f0f265d122fa8ef88dd95f6018dc8ba4a66bea5` | `4b93fb9ffc33836f4b62bbbc89d3027ff12fb7b9935b78cadc7a19dbebae60cc` |

Se cotejaron los 764 archivos originales con sus hashes crudos congelados y con los blobs del commit `52e4cdd2dc588acc8fc2a2dce718af70d5c306ae`, árbol `e032efb7b3b821a0c9502cde5315952f7fe2b7e5`. Los 764 coincidían inicialmente con la captura cruda. Los 712 textos UTF-8 coinciden con el contenido Git al normalizar únicamente CRLF; los 52 binarios coinciden byte a byte. Se verificaron también los identificadores SHA-1 de objeto blob con su cabecera Git. No se atribuye un fallo de hash a una regresión química ni se ha observado en los tres logs un cambio de nombres.

## Contratos separados

### Histórico, por defecto y en CI

`node scripts/validation-014-audit.mjs --verify`

Comprueba el snapshot publicado. No consulta `HEAD`, el índice, blobs históricos, producción actual, archivos de `outputs/` ni la red. El dispatcher importa el motor y los adaptadores de UI únicamente para operaciones de captura. Las referencias proceden exclusivamente del fixture OPSIN publicado; ya no hay precedencia ni fallback a cachés locales.

El manifiesto nuevo `tests/fixtures/orgorush-validation-014.integrity.json` tiene una huella revisada fijada en `scripts/validation-014-integrity.mjs`. Vincula cinco artefactos históricos: corpus, referencias OPSIN, matriz, defectos e informe. Se comprueba el texto UTF-8 normalizado a LF, sin ignorar espacios, BOM, valores JSON o contenido de cadenas. Para JSON se comprueba además una representación semántica determinista. El manifiesto tampoco puede alterarse silenciosamente: su huella se verifica antes de usar sus rutas y hashes.

Además de las huellas, se comprueban 150 constituciones nuevas, cuotas, IDs y perfiles exactos; fórmula y valencia; los 292 cuerpos externos y sus hashes; procedencia del baseline; seis lotes completos, sus IDs y hashes declarados; totales globales, por familia y perfil; correspondencia de defectos e incidencias. Se recalculan los 600 veredictos base desde sus capturas y referencias, y se revisan de nuevo reconstrucción del nombre, pasos, enlaces, átomos y resaltados del razonamiento. No basta con que un campo guardado diga PASS.

`--replay` realiza esa misma verificación y declara explícitamente que repite observaciones guardadas, sin ejecutar el motor actual. Los hashes de fuentes y rutas Windows de los metadatos originales son procedencia histórica; no se reinterpretan como requisitos del checkout actual.

Los cuerpos completos de los lotes originales privados no forman parte del checkout publicado: se preservan y vinculan sus hashes declarados. El replay offline comprueba las capturas base incorporadas a la matriz y las referencias publicadas; no pretende volver a calcular hashes de payloads ausentes ni todas las explicaciones completas de variantes cuyo snapshot conserva solo un hash y un resumen.

### Captura del código original, explícita y estricta

`node scripts/validation-014-audit.mjs --check-source`

Compara el working tree con el manifiesto de blobs del baseline, sin exigir que el commit actual sea aquel baseline. Para texto solo se permite la diferencia de representación CRLF/LF; se rechazan contenido distinto, bytes UTF-8 inválidos y NUL. Para binarios se exigen bytes exactos. No se ejecutan filtros clean/smudge ni se cambian las opciones globales de Git. Los modos Git se conservan como procedencia; no se equiparan permisos POSIX y permisos Windows.

El resultado distingue `sourceManifestHash` —identidad canónica portable— de `legacyProductionHash` —identificador del listado de hashes crudos de la captura antigua—. El último no se presenta como hash de los bytes actuales de un checkout Linux.

`--collect`, `--roundtrip`, `--reproduce` y `--adjudicate` conservan esta protección. La captura comprueba las fuentes antes y después de los lotes y verifica los recibos al reanudar. Si FIX-015 modifica producción, esta protección debe rechazar capturar esos cambios bajo la identidad del baseline antiguo; la verificación histórica debe seguir aprobando.

El motor y sus funciones de captura están en `scripts/validation-014-capture.mjs`. Los lotes nuevos usan `outputs/validation-014/capture/`, con copias LF del corpus y productor, recibos, progreso y revisión de referencias. La ruta CML de los doce grafos neutros que rechazaba el importador queda reproducible dentro del capturador, con su vía de entrada explícita. No se afirma que esos grafos se importaron con éxito. Las exclusiones de cargas o elementos no representables permanecen explícitas.

`--adjudicate` escribe `capture/regenerated.matrix.json`; `--report` escribe derivados en `outputs/validation-014/regenerated/`. Ninguno sobrescribe los cinco artefactos históricos. No existe una regeneración automática del manifiesto para aceptar un cambio de resultados.

La identidad del corpus y del código de productor archivado utiliza también texto LF; los hashes de los cuerpos JSON de lotes y de las respuestas HTTP conservan su significado de bytes/cadenas crudas. Regenerar el informe A–J extenso sigue requiriendo las reducciones y los logs de autoría originales. Esa operación de autoría no se ejecuta en CI ni es requisito de `--verify` o `--replay`, que funcionan con el checkout publicado sin `outputs/`.

## Conservación de la ciencia

Se hizo una captura nueva de seis lotes, se comprobaron 568 exportaciones —532 reimportaciones y 36 rechazos, ninguna pérdida de constitución/configuración— y se adjudicaron las 600 observaciones. La reanudación validó los seis recibos existentes sin duplicar ni volver a recoger casos.

La comparación con la matriz publicada exige igualdad de nombres, disponibilidad, expectativas, análisis, padres, localizadores, sustituyentes, grupos, estereoquímica, incidencias, evidencias, explicaciones, grafos y variantes. Coinciden las 150 estructuras y 600 observaciones; solo se excluyen de esa comparación los metadatos de la ejecución nueva y las anotaciones editoriales posteriores del informe.

| Clasificación histórica y regenerada | Observaciones |
| --- | ---: |
| PASS | 443 |
| FAIL-STRUCTURE | 2 |
| FAIL-NAME | 3 |
| FAIL-REASONING principal | 0 |
| UNSUPPORTED | 120 |
| PENDING-REFERENCE | 32 |

Los tres defectos químicos/lingüísticos registrados continúan visibles. Este trabajo no implementa FIX-015 ni convierte los fallos en exclusiones o PASS.

## Pruebas y plataformas

Las 14 pruebas dirigidas aprobaron. Incluyen corrupción de cada artefacto y del manifiesto, alteración de cuerpos externos con hashes recalculados, PASS falsificados, evidencias insuficientes, grafos cambiados, perfiles ausentes, totales, procedencia y lotes alterados, LF/CRLF/mezcla, binarios y rechazo de fuentes modificadas.

El test de aislamiento construye un checkout temporal con artefactos, verificadores y OpenChemLib, sin el código de producción ni objetos Git. Usa PATH vacío, `outputs/validation-014/baseline.json` inválido y un `app/page.tsx` deliberadamente inválido. `--verify` pasa sin `.git`; `--replay` pasa con un HEAD ficticio posterior y sin objetos; `--check-source` falla al faltar las fuentes. La prueba copia la dependencia y no requiere privilegios para enlaces simbólicos, ni crea commits.

La primera ejecución dentro del sandbox falló al crear una unión de directorio temporal (EPERM). Se repitió fuera del sandbox y se confirmó el diagnóstico. Después se sustituyó esa unión por una copia ordinaria; la variante portable pasó también dentro del sandbox. No se omitió la prueba ni se cambió una aserción científica para sortear permisos.

Se añadió `.github/workflows/validation-014.yml`, con checkout superficial y matriz Ubuntu/Windows × Node 22/24. Mantiene `npm ci`, pruebas de contrato y verificación offline. El workflow de Pages conserva sus regresiones críticas y `npm test`; no se añadieron saltos de pruebas, `continue-on-error`, permisos de escritura ni un fetch completo del historial.

La validación local usa Windows y Node 24.19.0. WSL no está instalado; no se afirma una ejecución local Linux ni una ejecución remota nueva sin el push manual del usuario. La matriz multiplataforma queda preparada para ese push.

## Cierre técnico

- TypeScript: exit 0, cero errores.
- Regresiones críticas: **157 PASS**, cero fallos.
- **Una ejecución completa de npm test**, con la compilación oficial de Sites: **3.113 pruebas, 3.108 PASS, cero FAIL/cancelaciones y cinco SKIP**. No es un agregado de ejecuciones por archivo.
- Las cinco omisiones coinciden por nombre con las históricas: ESTER-0007 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0012 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0014 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0015 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle; ESTER-0016 [esters] exact EN / hydrocarbon-lab-current-systematic-en-v1 # silver: not an exact naming oracle.
- Pruebas dirigidas de infraestructura después del cierre: **14 PASS**, contabilizadas aparte del total general.
- Construcción y validación de Pages: exit 0. Sites: artefacto ESM validado dentro de npm test.
- Replay histórico posterior: 600 observaciones verificadas, exit 0.
- Se registró durante la suite una corrección de la identidad LF del corpus y de los archivos de productor en la adjudicación, y se amplió la aserción de representación en el test nuevo. Esos dos archivos de infraestructura cambiaron antes de que su prueba se ejecutara; se repitieron al final las 14 pruebas dirigidas y la adjudicación sobre los lotes existentes. Los demás archivos congelados no cambiaron.
- Los cinco artefactos históricos son idénticos byte a byte al inicio del trabajo. Los 764 archivos del baseline pasan además la protección canónica de captura.
- La captura nueva y sus variantes conservan nombres, análisis, explicaciones y clasificaciones de las 600 observaciones.

No se aumentaron límites de tiempo ni se relajó una prueba para aprobar el flujo. Los registros, hashes y el resumen verificable se conservan en outputs/ci-validation014-fix/. La ejecución remota de la nueva matriz queda pendiente del commit y push manuales del usuario.

## Archivos del cambio

- Modificados: `scripts/validation-014-audit.mjs`, `scripts/validation-014-reference.mjs`, `tests/orgorush-validation-014.test.mjs`.
- Nuevos: `scripts/validation-014-integrity.mjs`, `scripts/validation-014-capture.mjs`, `tests/fixtures/orgorush-validation-014.integrity.json`, `tests/orgorush-validation-014-integrity.test.mjs`, `.github/workflows/validation-014.yml` y este informe.
- Intactos: los cinco artefactos históricos, producción, dependencias, lockfile y `.github/workflows/deploy-pages.yml`.
