# AUD-NOM-010 — Pre-Launch UX Stabilization

## Cierre

Se repararon los cuatro bloqueos de difusión identificados por AUD-NOM-009: AUD009-001, AUD009-003, AUD009-006 y AUD009-007. Los cambios se limitaron a localización de mensajes, avisos de persistencia, documentación pública y estado del feedback SMILES. No se modificaron química, nomenclatura ni evaluación de ejercicios.

## Hallazgos y reparaciones

| ID | Causa | Solución |
| --- | --- | --- |
| AUD009-001 | El adaptador rechazaba correctamente los isótopos explícitos, pero devolvía un mensaje fijo en español; la interfaz inglesa mostraba ese texto sin traducir. | Se añadió el código estable `EXPLICIT_ISOTOPE_UNSUPPORTED`, conservando el campo `error` existente. La interfaz localiza el rechazo en inglés o español. La importación sigue rechazando la estructura antes de crear el grafo editable y no modifica el estado molecular ni los datos guardados. |
| AUD009-003 | La configuración de Práctica/Examen no avisaba de que sesiones, borradores y resultados temporales se pierden al recargar. | Se añadió un aviso bilingüe junto al botón de inicio, indicando la duración de la sesión y que Historial/Guardados usan almacenamiento separado según la versión del laboratorio. |
| AUD009-006 | La documentación pública del README estaba principalmente en español y no presentaba en inglés el alcance, persistencia y flujos de datos relevantes. | Se añadió “English overview” al README, con enlaces a la aplicación y al reporte de errores, alcance de perfiles, persistencia, servicios externos y ejecución local de la evaluación. El pie de página enlaza a esa sección. No se afirma que el proyecto tenga una licencia de software abierta. |
| AUD009-007 | El feedback SMILES podía permanecer visible después de que el usuario recuperara otra molécula, haciendo que el mensaje ya no correspondiera al contenido activo. | El feedback se limpia al confirmar un cambio de molécula y en las rutas de restauración de borradores, deshacer y rehacer. Se añadió una prueba que restaura otra estructura desde Historial y comprueba que el feedback anterior desaparece. |

## Archivos modificados

- `README.md`
- `app/globals.css`
- `app/i18n.ts`
- `app/openchemlib-adapter.ts`
- `app/page.tsx`
- `app/practice-panel.tsx`
- `tests/aud-nom-010-public-english-guide.test.mjs` (nuevo)
- `tests/exam-ui.test.mjs`
- `tests/practice-ui.test.mjs`
- `tests/smiles-isotope-integrity.test.mjs`
- `tests/smiles-text-import.test.mjs`

Este informe es el único archivo añadido por la solicitud de cierre.

## Validación ejecutada

- `node --test tests/smiles-isotope-integrity.test.mjs` — PASS, 28 pruebas. Incluye localización ES/EN y comprobaciones de que el rechazo isotópico no reemplaza el grafo, historial o datos guardados.
- `node --test tests/smiles-text-import.test.mjs` — PASS, 12 pruebas. Incluye limpieza del feedback al restaurar desde Historial y al deshacer/rehacer.
- `node --test tests/aud-nom-010-public-english-guide.test.mjs` — PASS, 2 pruebas.
- `node --test --test-concurrency=1 --test-name-pattern="configuration (es|en)" tests/practice-ui.test.mjs` — PASS, 2 casos dirigidos de configuración.
- `node --test --test-concurrency=1 --test-name-pattern="Exam config (es|en)" tests/exam-ui.test.mjs` — PASS, 2 casos dirigidos de configuración.
- `npm run build:pages` — PASS.
- `npm run validate:pages` — PASS; artefacto con 3 entradas, 6 assets y base `/Hydrocarbon-Lab/`.
- `git diff --check` — PASS.

**Limitación de validación UI:** se intentaron ejecutar las suites completas `tests/practice-ui.test.mjs` y `tests/exam-ui.test.mjs`; ambas se interrumpieron tras superar 90 segundos sin salida. Por tanto, las suites completas **no se consideran PASS**. Solo se aprobaron los dos casos dirigidos de configuración bilingüe de cada suite indicados arriba. No se ejecutó `npm test` completo ni la batería integral de CI.

## Limitaciones funcionales

- Los isótopos explícitos siguen sin estar soportados por el editor; la solución implementa rechazo seguro y localizado, no conservación o edición isotópica.
- La guía describe los límites y flujos documentados para la versión pública; Historial/Guardados pueden variar según la configuración del laboratorio.
- No se hizo validación integral de todas las interacciones de Práctica/Examen debido a la interrupción de las suites completas; CI debe validar el conjunto tras el siguiente push.

## Estado de entrega

- HEAD al cierre: `24fe156064eee1f344520faa39c5c81e1a398fe7`, rama `main`.
- No se prepararon cambios en staging; no se hizo commit ni push.
- Se conservaron intactos los archivos ajenos sin seguimiento `reports/orgorush-aud001-repair.md` y `tatus --short`.
