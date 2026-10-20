# AUD-NOM-009B — cierre documental

Verificación de archivos y evidencia ya registrada. No se ejecutó química,
evaluación de respuestas, navegador, suites, build ni instalación.

## A. Entregables y discrepancia resuelta

Los **11/11 entregables previstos** existen en sus rutas correctas. Ninguno
faltaba y ninguno se reconstruyó. `smoke-matrix.json` ya tenía **626.686 bytes**
al iniciar 009B; Git lo identifica como nuevo (`??`) y no está ignorado.
Su SHA-256 es
`8c1e825c4f887a2b3176c34474c6b494e3e9a5ff65e40c5f67f48c9588a99885`.

El listado reducido de Codex no era un inventario exhaustivo del disco ni de
Git. El guion `smoke.mjs` contiene la escritura de la matriz mediante
`writeFileSync`; una salida generada no debe inferirse ausente de la lista de
ediciones. No se afirma una causa interna del listado de la aplicación que
no se inspeccionó. El inventario inicial real tenía **65 archivos de AUD-NOM-009**:
los 11 previstos más 54 archivos de evidencia/recibos/resumen. Los hashes y
tamaños iniciales se conservaron en [document-baseline.json](document-baseline.json).

| Entregable previsto | Resultado inicial | Estado Git |
|---|---|---|
| `../aud-nom-009-prelaunch-audit.md` | Existe | Nuevo, no ignorado |
| `issue-register.json` | JSON válido | Nuevo, no ignorado |
| `smoke-matrix.json` | JSON válido, matriz original | Nuevo, no ignorado |
| `sample-plan.json` | JSON válido, 39 entradas | Nuevo, no ignorado |
| `baseline.json` | JSON válido, HEAD de referencia | Nuevo, no ignorado |
| `browser-checks.json` | JSON válido, observaciones y límites | Nuevo, no ignorado |
| `run-bounded.ps1` | Leído, límite externo de 85 s | Nuevo, no ignorado |
| `smoke.mjs` | Leído, no ejecutado | Nuevo, no ignorado |
| `grading-smoke.mjs` | Leído, no ejecutado | Nuevo, no ignorado |
| `summarize.mjs` | Leído, no ejecutado | Nuevo, no ignorado |
| `validate-evidence.mjs` | Leído, no ejecutado | Nuevo, no ignorado |

Solo se aclararon tres documentos anteriores: informe principal, registro de
hallazgos y verificaciones de navegador. No se alteraron matriz, selección,
recibos, estados AX, bytes de imágenes, scripts originales ni `validation.json`.
Nueve capturas tenían firma JPEG con extensión `.png`: se corrigió únicamente
su extensión a `.jpg` y sus referencias, sin recodificación. `exported-aryl.png`
sí es PNG y conserva su nombre. La correspondencia de rutas antiguas/nuevas y
los SHA-256 idénticos constan en `document-baseline.json` y en el recibo final.
Los SMILES de la tabla se delimitaron como código para que expresiones como
`CC[N+](=O)[O-]` no se interpreten como enlaces Markdown; sus caracteres y las
39 filas coinciden con los datos originales.
009B añade este cierre, un baseline de hashes, el comprobador documental,
su recibo, el inventario de staging y el comando propuesto.

## B. Recuentos y significado de los estados

- **39 entradas** S01–S39 coinciden, en orden e identidad textual SMILES, con
  el plan congelado; su SHA-256 coincide con el guardado en la matriz.
- **38 grafos importados** tienen `identity: PASS` y `graphUnmutated: true`
  registrados. No se recalculó su identidad química en 009B.
- **S38** es el control isotópico rechazado, sin grafo ni exportación: no es
  una molécula aceptada, un test fallido ni un PASS de exportación.
- **156 posiciones lógicas** = 39 entradas × 4 perfiles. Hay 152 posiciones
  de grafos importados: 126 nombres disponibles y 26 bloqueados. Las cuatro
  posiciones del isótopo no se ejecutaron; `profiles: {}` refleja ese hecho.
- **126 modelos pedagógicos** son combinaciones caso/perfil disponibles
  verificadas en 009. Cada modelo contiene varias aserciones. No son 126
  estructuras distintas ni se dispone de un total exacto de aserciones.
- Las **seis comparaciones de evaluación de respuestas** tienen su propio
  recibo y no se suman a los 126 modelos. Tampoco son 38 tests automatizados.

| Perfil | Disponibles | Bloqueadas | Interpretación de nombres disponibles |
|---|---:|---:|---|
| 2013 ES | 37 | 1 | 37 UNVERIFIED por OPSIN inglés; no adjudicación española nueva |
| 2013 EN | 37 | 1 | 24 MATCH, 13 UNVERIFIED |
| 1979 ES | 18 | 20 | 18 UNVERIFIED por OPSIN inglés; no adjudicación española nueva |
| 1979 EN | 34 | 4 | 14 MATCH, 18 UNVERIFIED, 2 REJECTED |

`PASS`/`FAIL` describen resultados de comprobaciones ejecutadas. Un nombre
`BLOCKED`/`UNSUPPORTED` no es un FAIL químico. `UNVERIFIED` significa evidencia
insuficiente; no se convierte en PASS o FAIL. `REJECTED` en interpretación
significa rechazo del texto por OPSIN, distinto del rechazo de importación
de S38. `SKIP` no tiene un contador de pruebas registrado aquí: no se inventa
un SKIP por cada posición no ejecutada. MATCH no certifica preferencia normativa.

Se contrastaron las 39 filas literales del informe con la matriz, los resúmenes,
baseline, recibo original de validación, evaluación de respuestas, enlaces de
evidencia y registro de hallazgos. Los datos originales permanecen separados
de la nueva comprobación documental.

## C. Hallazgos y límites de la evidencia

El registro mantiene exactamente **0 P0, 0 P1, 8 P2, 2 P3**, IDs AUD009-001 a
AUD009-010, con mismas severidades, acciones y gates que la tabla del informe.
Las rutas citadas existen; los anclajes S38/S14/S28 identifican registros
reales, no pruebas nuevas.

| Prioritario para 010 | Tipo de hallazgo | Evidencia conservada |
|---|---|---|
| AUD009-001, rechazo isotópico en español en EN | Defecto de presentación observado en 009 | Mensaje en matriz S38 y observación de navegador original; PNG solo contextual, no muestra el error |
| AUD009-003, sesiones temporales | Mejora de comunicación basada en omisión observada | Setup, preguntas/resultados y política de persistencia documentada; sin nueva prueba de reload de sesión |
| AUD009-007, confirmación SMILES obsoleta | Defecto reproducible de presentación | AX de History restaurado conserva butane junto a ethanol/C2H6O |
| AUD009-004, enlaces después de reload | Defecto reproducible de presentación | AX antes/después: enlaces aryl/ethan/1-ol frente a texto sin enlaces |
| AUD009-006, información pública inglesa | Mejora de comunicación pública | README y entradas de interfaz documentadas; no fallo del motor |

AUD009-002 es una limitación de cobertura observada; AUD009-005 es un riesgo
léxico cuyo texto y rechazo del parser están registrados, pero cuya grafía
normativa histórica sigue **UNVERIFIED**. `CONFIRMED` no adjudica esa grafía.
Las notas nuevas distinguen estas naturalezas sin elevar ni bajar prioridades.

Las observaciones de navegador fueron **automatizadas por el agente** mediante
IAB/CUA, con DOM/AX y capturas interpretadas por el agente. No hubo usuarios
externos, estudio de usabilidad, lector de pantalla ni dispositivos táctiles
reales. No se hicieron nuevas acciones de navegador en 009B. Los tamaños de
imágenes se registran como geometría del archivo; su nombre no certifica el
viewport medido. La captura del error isotópico no muestra el mensaje: queda
documentada esta limitación de trazabilidad visual, sin rellenarla con evidencia
inventada. Portapapeles, SVG descargado y Saved siguen con sus límites originales.
En particular, la captura cuyo nombre incluye `1280` mide realmente **811 ×
889 píxeles**; el nombre no demuestra una captura completa a 1280 px. Las
métricas DOM de viewport de 009 están separadas en `browser-checks.json`.

## D. Estado de lanzamiento

La evidencia registrada sigue respaldando, dentro del alcance de beta:

- `TECHNICAL_READINESS: READY_WITH_LIMITATIONS`.
- `SHOW_HN_READINESS: READY_AFTER_FIXES`.
- `PRODUCT_HUNT_READINESS: READY_AFTER_FIXES`.

No se certifica actualidad adicional del despliegue mediante esta tarea:
`baseline.json` conserva la comprobación de CI realizada en 009 sobre
`63d8a8e7ef1df0ccafa62378fa6ebb2a30a49b31`. No se repitieron build, CI ni
verificaciones de producto. No se resolvió ningún P2 y no se cambian las
condiciones de lanzamiento para obtener un resultado más favorable.

## E. Git, staging y siguiente fase

Rama `main`, mismo HEAD, ningún tracked modificado ni cambios staged.
Los archivos ajenos `reports/orgorush-aud001-repair.md` y `tatus --short`
siguen sin seguimiento y sus SHA-256 coinciden con el inicio de 009B.
No se incorporan a la lista propuesta.

[commit-files.txt](commit-files.txt) es la lista **exacta, ordenada y exhaustiva**
para el futuro commit: 71 rutas explícitas (65 originales más 6 altas de cierre).
Incluye todas las capturas y estados AX citados, no solo los once principales.
El comprobador verifica que Git pueda añadir cada archivo y que no haya rutas
ajenas. [staging-command.ps1](staging-command.ps1) contiene el comando expandido
con esas 71 rutas, sin comodines y sin `git add .`.

**Propuesta para ejecutar desde la raíz cuando el usuario termine su revisión:**

```powershell
& ./reports/naming-audit/aud-nom-009/staging-command.ps1
```

El script usa un array de rutas literales y `git add -- $auditFiles`.
**No se ejecutó staging, commit ni push.** Mensaje sugerido:

```text
docs(aud-nom-009): complete prelaunch readiness audit
```

Verificación documental ejecutable, sin importar química:

```powershell
& ./reports/naming-audit/aud-nom-009/run-bounded.ps1 -NodeArgs @('reports/naming-audit/aud-nom-009/verify-documents.mjs')
```

El recibo [document-integrity.json](document-integrity.json) conserva recuentos,
hashes, rutas de evidencia y resultado. El proceso tiene límite externo real de
85 segundos mediante el wrapper ya existente; las llamadas Git internas también
tienen timeout. `git diff --check` pasó; el árbol tracked sigue sin diferencias.

Los primeros intentos del comprobador documental terminaron con error: uno
resolvía `README.md` contra la carpeta de auditoría y se corrigió; el siguiente
detectó las extensiones de imagen que no coincidían con los bytes. No fueron
fallos químicos ni se contaron como PASS. La ejecución final y su duración se
registran separadamente en el recibo, conservando `validation.json` de 009.

AUD-NOM-010 puede comenzar **posteriormente**, con autorización propia, para
las reparaciones P2 pequeñas citadas. No se inició en 009B, no se amplió ninguna
familia química ni se modificaron producción, pruebas, auditorías 001–008,
dependencias o despliegue.
