# AUD-NOM-010C — Validación integral y cierre de regresiones

## Resultado

La validación completa disponible terminó sin fallos de pruebas. AUD-NOM-010B está integrado en `main`; el commit HEAD contiene los mocks de `setSmilesFeedback` y las aserciones de limpieza en `commit`, `undo` y `redo`.

**Recomendación: PARTIAL.** La batería global terminó con 0 fallos, pero Node reportó 5 pruebas `SKIP`. El repositorio las omite deliberadamente en `tests/reference-name-corpus.test.mjs` cuando el registro no tiene autoridad `gold` (`<authority>: not an exact naming oracle`). Conforme al criterio de esta fase, no cuento esos casos omitidos como PASS. No hubo timeouts ni pruebas interrumpidas.

## Repositorio

- Rama: `main`.
- HEAD: `3511357ec39f39043fe8f63a01f7e4b217e44e23`.
- Commit: `3511357 test: update SMILES feedback mocks and history assertions (AUD-NOM-010B)`.
- El commit modifica únicamente `tests/fused-ring.test.mjs` y `tests/manual-display-direction.test.mjs`; se verificaron los setters y las aserciones de feedback en ambos archivos.
- Estado antes de este informe: sin archivos tracked modificados; estaban presentes los dos untracked ajenos indicados abajo.

## Comandos y resultados

| Comando | Resultado | Tiempo / detalle |
| --- | --- | --- |
| `npm test` desde PowerShell | No inició las verificaciones: el script `build` invoca `bash`, que no está en el `PATH` de PowerShell. | Fallo de lanzamiento del entorno, no fallo de prueba. |
| `& 'C:\Program Files\Git\bin\bash.exe' -lc 'npm test'` | **PASS**, salida 0. Incluye `npm run build` y `node --test --test-concurrency=1 tests/*.test.mjs`. | Node reportó `5,287,846.6277 ms` (88 min 7.8 s). |
| Build verificado `vinext` dentro de `npm test` | **PASS**; artefacto Sites validado (`ESM Worker default.fetch` y hosting manifest). | Entornos client, server, RSC y SSR compilados. |
| `npm run build:pages` | **PASS**. | Vite completó en 7.29 s. Generó 3 entradas y assets de Pages. |
| `npm run validate:pages` | **PASS**. | 4.30 s; `entries: 3`, `assets: 6`, base `/Hydrocarbon-Lab/`. |
| `& 'C:\Program Files\Git\bin\bash.exe' -lc 'npm run lint'` | **PASS**, salida 0; 0 errores y 32 advertencias. | Aproximadamente 1.5 min. ESLint también recorrió `outputs/docx-vis-2/snapshot-baseline`. |
| `git diff --check` | **PASS**. | Sin errores de whitespace. |

La suite global registró **2,756 tests: 2,751 PASS, 0 FAIL, 5 SKIP, 0 cancelled, 0 todo**. Los 5 SKIP corresponden a los casos de nombre exacto cuyo registro no es una autoridad `gold`; la propia prueba explica que no son un oráculo exacto. No hubo regresiones nuevas ni fallos que requirieran reproducción aislada.

## Cobertura comprobada

La ejecución serial incluyó pruebas de anillos fusionados, identidad molecular, geometría y disposición, historial, `commit`/`undo`/`redo`, importación/exportación SMILES, isótopos, nomenclatura IUPAC en ambos idiomas, razonamiento interactivo, persistencia química, Practice/Exam, sesiones reproducibles, corpus de referencia, representación de canvas y exportaciones. Los casos AUD-NOM-010B de historial y representación pasaron dentro de la batería completa.

También se ejecutaron comprobaciones de estrés de 3,350 análisis de nomenclatura y 3,900 ciclos de importación/exportación SMILES, ambas con resultado PASS. Los barridos de distractores reportaron cero fallos en 544 grafos reales.

Un diagnóstico de capacidades incluido en la suite informó 280 estructuras: 214 `PASS`, 66 `PARTIAL` y tres casos `OUT-OF-SCOPE` por límites de soporte policíclico. El propio test de auditoría pasó; estos estados documentan cobertura funcional y no son fallos de Node.

## Fallos y advertencias

- La primera invocación de `npm test` desde PowerShell falló antes del build porque `bash` no estaba disponible en ese shell. La repetición desde Git for Windows Bash completó build y suite con código 0.
- El build verificado mostró avisos de imports Node en SSR sin `nodejs_compat`, clasificación estática desconocida de algunas rutas y chunks grandes; completó y validó el artefacto.
- `build:pages` mostró el aviso `INEFFECTIVE_DYNAMIC_IMPORT` de `openchemlib-adapter.ts` y un chunk principal mayor de 500 kB; completó correctamente.
- `npm run lint` emitió 32 advertencias, 0 errores. Incluyen variables sin uso, dependencias de React Hooks, uso de `<img>` y advertencias también presentes en el snapshot `outputs/docx-vis-2/snapshot-baseline`.
- No se aisló ni reprodujo ningún fallo de test porque la suite reportó cero.

## Limitaciones

- Cinco verificaciones de igualdad exacta de nombres quedaron omitidas de forma intencionada por no tener registros `gold`; por eso la recomendación general es PARTIAL aunque todas las pruebas ejecutadas pasaron.
- El diagnóstico de capacidades registra 66 estructuras `PARTIAL` y tres tipos de topología policíclica `OUT-OF-SCOPE`; no son resultados de regresión, pero limitan la cobertura funcional disponible.
- El lint pasó con 32 advertencias reportadas; no se corrigieron en esta fase de validación.
- La ejecución inicial de `npm test` en PowerShell no arrancó; la ejecución equivalente con el Bash instalado sí completó satisfactoriamente.

## Estado de entrega

- Este informe es el único archivo creado por AUD-NOM-010C.
- Se conservaron intactos los untracked ajenos `reports/orgorush-aud001-repair.md` y `tatus --short`.
- No hay cambios de producción ni tests de esta fase, no hay staging, y no se realizó commit ni push.
