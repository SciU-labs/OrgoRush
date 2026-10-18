# OrgoRush — AUD-NOM-004: cierre de los seis hallazgos

Fecha: 2026-10-18. Rama: `main`. HEAD de partida: `847e7abd427fa5144abded1b293ebc2f012dda3e` (AUD-NOM-003B ya integrado). Los cambios AUD-NOM-004 permanecen sin commit ni push.

## Estado y resumen

Los seis hallazgos AUDNOM-006–011 están **FIXED** y sus comprobaciones dirigidas pasan. No se cambiaron nombres IUPAC ni grafos químicos en los bloques de explicación/localizadores; se corrigieron además los cuatro nombres E/Z Legacy ES que contenían prefijos duplicados.

La comparación de `reports/naming-audit/aud-nom-004-before.json` y `aud-nom-004-after.json` en las 440 estructuras encontró exactamente cuatro diferencias, todas las esperadas para AUDNOM-006:

| Caso / perfil | Antes | Después |
| --- | --- | --- |
| AUDCASE-0411 / 1979-es | `(2E)-(2e)--2-buteno` | `(2E)-2-buteno` |
| AUDCASE-0412 / 1979-es | `(2Z)-(2z)--2-buteno` | `(2Z)-2-buteno` |
| AUDCASE-0413 / 1979-es | `(3E)-(3e)--3-hexeno` | `(3E)-3-hexeno` |
| AUDCASE-0414 / 1979-es | `(3Z)-(3z)--3-hexeno` | `(3Z)-3-hexeno` |

La comparación verificó las 440 estructuras: hashes de grafo y de análisis iguales en todos los casos; no hubo otras diferencias de exportación. Las referencias históricas, nombres gold, corpus y sus hashes no se modificaron.

## Hallazgos

### AUDNOM-006 — descriptor E/Z Legacy ES duplicado — FIXED

El análisis constitucional ya contenía E/Z y la ruta de presentación Legacy lo volvía a prefijar desde el grafo. El formateador también podía preservar un descriptor antiguo cuando no había descriptor nuevo. La presentación ahora elimina los descriptores existentes y deriva un único conjunto desde la geometría del grafo. Se mantienen el nombre constitucional y la configuración química.

Pruebas: 5 dirigidas dentro de la suite AUD-NOM-004 (E/Z, ES/EN, modo constitucional, geometría no especificada y estabilidad del formato repetido). Los cuatro IDs originales AUDCASE-0411–0414 siguen cubiertos.

### AUDNOM-007 — límite morfológico de la raíz Legacy `non` — FIXED

La búsqueda de la última coincidencia de `non` en `nonanone/nonanona` podía seleccionar texto del sufijo funcional en vez del progenitor. La derivación ahora prioriza la evidencia del progenitor y restringe la búsqueda alternativa al intervalo anterior al sufijo. Los nombres y el grafo no cambian; la evidencia interactiva cubre la raíz completa.

Pruebas: 6 dirigidas con los casos originales, vecinos `oct/non/dec` y prefijos N-alquilo que comprueban que una primera coincidencia tampoco basta.

### AUDNOM-008 — solapamiento `en` con sufijos funcionales — FIXED

La terminación opcional de la evidencia de insaturación podía invadir el `o` de sufijos ya reconocidos (`oic/oico`, `oate/oato`). La evidencia de insaturación ahora queda acotada al inicio del sufijo identificado. No se alteró el nombre generado.

Pruebas: 6 dirigidas, incluyendo ácidos insaturados ES/EN, ésteres y alquenos ordinarios; las evidencias `en` y funcional mantienen sus destinos separados.

### AUDNOM-009 — duplicación de evidencia de localizadores — FIXED

La misma extensión visible podía publicarse más de una vez dentro de una sección de explicación Legacy aunque sus entradas fueran el mismo rol y concepto. La normalización final consolida duplicados con igual tipo, texto, posición y `semanticId`, y combina sus contribuciones, átomos y enlaces únicos. Conserva entradas con `semanticId` distinto, por lo que no elimina relaciones válidas de conceptos distintos que comparten locante.

Pruebas: cada uno de los **40 perfiles originales** de los **32 registros** Legacy mantiene integridad de fragmentos, locantes, enlaces y destinos. AUDCASE-0003 y AUDCASE-0005 comprueban además todos los locantes geminales distintos.

### AUDNOM-010 — explicación aromática y extremo cíclico inexistente — FIXED

La explicación componía extremos como `C6=C7` a partir del locante, sin verificar que los átomos fueran vecinos en el grafo. Para enlaces múltiples no aromáticos ahora resuelve ambos átomos numerados, el enlace real, el orden y los elementos; en anillos usa el cierre real de último a primero. Si no puede validar el enlace, no inventa extremos. Los anillos aromáticos reciben una explicación de sistema deslocalizado y composición real, sin dobles enlaces localizados ficticios.

Pruebas: piridina, benceno, pirrol, furano y tiofeno ES/EN, con nombres sin cambios; un ciclo no aromático con doble enlace de cierre acredita `C6=C1` desde la arista real, nunca `C6=C7`.

### AUDNOM-011 — etiquetas funcionales en Legacy EN — FIXED

El fallback de inglés usaba la etiqueta interna localizada en español. La explicación Legacy ahora usa un catálogo inglés explícito para los grupos admitidos, con etiquetas españolas localizadas por separado. La etiqueta no interviene en la generación del nombre.

Pruebas: los **76 resultados Legacy EN originales** verifican su rótulo inglés; los perfiles ES permanecen en español. Se cubren las clases funcionales disponibles, incluidos los registros AUDCASE-0342 y AUDCASE-0312.

## Cobertura y validación

- `tests/audnom004-explained-nomenclature.test.mjs`: **61 PASS, 0 FAIL, 0 SKIP** (17 pruebas A–C ejecutadas antes de D–F y 44 comprobaciones D–F; corrida final combinada con 61 PASS). La suite nueva conserva reconstrucción exacta del nombre visible, intervalos, unicidad semántica, destinos interactivos y relaciones de átomos/enlaces mediante `tests/helpers/reasoning-integrity.mjs`.
- Diagnósticos históricos AUDNOM-006–011 en `tests/naming-audit/diagnostics.test.mjs`: **6 PASS, 0 FAIL, 0 SKIP**. Se filtró por los seis IDs; no se ejecutó ni se reescribió la prueba de hashes históricos protegidos, porque su contrato histórico compara archivos de producción que esta auditoría modifica.
- Regresiones relacionadas AUD-NOM-003, estereoquímica, isótopos, perfiles Legacy, navegación y accesibilidad: **133 PASS, 0 FAIL, 0 SKIP**.
- `npm run test:reference-corpus`: **797 pruebas, 792 PASS, 0 FAIL, 5 SKIP**. Los cinco SKIP son exclusiones ya declaradas en el corpus de autoridad plata; no se añadieron omisiones.
- `npm run build:pages`: PASS. Vite informa advertencias existentes de importación dinámica ineficaz y tamaño de chunk; el build terminó correctamente.
- `npm run validate:pages`: PASS; `PAGES_ARTIFACT={"entries":3,"assets":6,"base":"/Hydrocarbon-Lab/"}`.
- `git diff --check`: PASS.
- No se ejecutó `npm test` completo; la suite completa tarda aproximadamente 25 minutos en CI y el encargo limita la validación local a las baterías dirigidas y Pages.

## Archivos AUD-NOM-004

Producción: `app/double-bond-stereochemistry.ts`, `app/page.tsx`, `app/reasoning-name-fragments.ts`.

Pruebas/soporte: `tests/audnom004-explained-nomenclature.test.mjs`, `tests/helpers/reasoning-integrity.mjs`, `scripts/naming-audit/verify-repair-004.mjs`.

Evidencia comparativa: `reports/naming-audit/aud-nom-004-before.json`, `reports/naming-audit/aud-nom-004-after.json` y este informe.

No se tocaron `audit-findings.md`, `audit-findings.json`, el corpus de referencia, los nombres gold ni sus hashes. La corrección AUD-NOM-003B de HEAD no forma parte de este cambio. No se hizo staging, commit ni push.
