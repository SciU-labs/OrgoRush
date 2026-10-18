# AUD-NOM-001 — auditoría separada del laboratorio

Esta carpeta contiene evidencia diagnóstica, no una ampliación del corpus gold
de Practice/Exam ni una certificación IUPAC. No hay cambios de producción.

## Resultados que deben leerse por separado

- `audit-summary.md`: alcance, cifras reales, limitaciones y orden de reparación.
- `audit-findings.md` y `.json`: 11 IDs permanentes, ejemplos, causas probables y
  regresiones propuestas. Una misma causa puede afectar muchos perfiles/casos.
- `audit-matrix.json`: 440 registros con cuatro perfiles, análisis seleccionado,
  nombres, evidencias, fragmentos, explicaciones, propiedades y hallazgos.
- `audit-statistics.json`: estadísticas derivadas de los registros, no cifras
  escritas manualmente para completar cuotas.
- `audit-cases.json`: selección determinística congelada, semilla y derivaciones
  individuales declaradas antes de observar las salidas de esta ejecución.
- `audit-exclusions.json`: duplicados excluidos y sus motivos. Las estructuras
  fuera de Practice/Exam no se descartaron del laboratorio.
- `batches/`: 18 lotes inmutables de resultados brutos. Las interpretaciones y
  adjudicaciones posteriores no reescriben estos lotes.
- `baseline.json`: HEAD, inventario inicial y hashes de producción, corpus,
  manifiesto y regresiones históricas. El estado inicial precede a la creación
  de los nuevos scripts; `status` registra también el arnés ya creado.
- `sources.json`: páginas primarias consultadas y alcance de sus aplicaciones.
- `opsin-evidence.json`: textos ingleses exactos, URLs, fechas, cuerpo original
  y SHA-256. No pasa por los candidatos ni fallbacks del resolvedor de la app.
- `practice-envelope-observations.json`: observación suplementaria de todas las
  categorías del validador de producción; jamás se usó como filtro de admisión.
- `validation-results.json` y los logs: comandos, duración y fallos explícitos.

`GOLD` solo se aplica a los perfiles que tienen una derivación individual en
`expected`. El campo general de un registro revisado no convierte sus otros
idiomas/perfiles en gold. Las referencias exactas nuevas son inglesas. Los demás
resultados permanecen GENERATED, incluso cuando OPSIN confirma su estructura.
La política systematic del proyecto no equivale a una promesa universal de PIN.
La traducción de producción forma parte del sistema auditado, nunca del oráculo.

## Método reproducible

Se usa Node instalado y las dependencias ya presentes. No se añadió ninguna.
Los scripts están en `scripts/naming-audit/`:

1. `cases.mjs` construye templates SMILES y excluye identidades OCL ya protegidas
   o repetidas. No contiene un generador paralelo de nombres.
2. `evaluate.mjs` invoca los analizadores y presentadores reales. Reproduce la
   ruta local de Home sin PubChem, sin alias opcionales y con la opción estéreo
   activada para entradas configuradas. Cada perfil recibe su propio análisis.
3. `run.mjs` guarda lotes de 25, con semillas y hashes. Un fallo no destruye los
   lotes completos; el siguiente comando reanuda sin volver a nombrarlos.
4. `evidence.mjs` compara los recibos independientes con la identidad de entrada.
5. `report.mjs` combina lotes brutos, recibos y adjudicaciones explícitas. Distingue
   coincidencia exacta, interpretación estructural y ausencia de referencia.

```text
node scripts/naming-audit/run.mjs
node scripts/naming-audit/report.mjs
node --test tests/naming-audit/diagnostics.test.mjs
npm run test:reference-corpus
npm run report:reference-corpus
git diff --check
```

Con los archivos entregados, `run.mjs` reutiliza los lotes si coinciden los
hashes. Para una repetición completa, usar una copia independiente del checkout
del baseline con estos scripts y sin sus resultados previos, conservando esta
carpeta como evidencia. Si cambia producción o el arnés, el runner rechaza
mezclar lotes: iniciar una revisión explícitamente versionada. No borrar hashes
ni editar expectativas para forzar la reanudación.

La suite diagnóstica es **optativa**, fuera del glob histórico `tests/*.test.mjs`.
Carga producción real una vez y vuelve a ejecutar representantes de las causas.
En este baseline tiene 5 PASS de infraestructura/evidencia y **11 FAIL reales**,
uno por grupo causal; no hay `skip` ni `todo`. Estos fallos documentan contratos
pendientes de reparación. El objetivo de esta fase no es volverlos verdes
modificando las referencias. La batería protegida permanece independiente.

El script oficial `report:reference-corpus` escribe una ruta histórica. En esta
auditoría se conservó su resultado en `reference-report-current.json` y se
restauró el archivo histórico original byte por byte. Su log informa 179 gold
exactos PASS, cinco silver SKIP y 184 equivalencias estructurales PASS.

## Captura externa opcional

El informe y las pruebas finales funcionan sin red, con los recibos entregados.
La captura fue acotada: primero 160 nombres nuevos, después una ampliación de
80 recibos guardados dirigida a N-sustitución y funciones repetidas. Se reutilizan
cinco recibos protegidos existentes sin modificarlos. Los fallos iniciales de
red y una escritura transitoria bloqueada por OneDrive no son evidencia química;
se reanudó con los recibos ya persistidos. La escritura del índice pasó a ser
atómica y con reintentos de E/S limitados.

```text
node scripts/naming-audit/capture-opsin.mjs --max-new=160
node scripts/naming-audit/capture-opsin.mjs --max-new=80 --focus=high-risk
```

El límite es por invocación y solo consume nombres sin recibo guardado. No
repetir estas consultas para generar el informe. OPSIN interpreta estructuras;
su aceptación no demuestra preferencia normativa ni atribución a 1979. PubChem
no fue consultado. Las fuentes normativas son las páginas primarias registradas.

## Límites de las propiedades

La identidad canónica OCL distingue conectividad, órdenes, cargas, masa isotópica
y estado estéreo. Las representaciones alternativas solo se evalúan después de
confirmar esa misma identidad, no por igualdad de fórmula o del texto SMILES.
La variante de árbol es únicamente un serializador de conectividad neutral,
no un segundo motor químico. Los casos sin una variante distinta verificable
conservan SKIP de esa propiedad, sin fingir una comparación ejecutada.

Idioma/perfil se ensaya en el modelo puro que consume Home. La independencia de
representación aplica escala positiva y traslación; no se ejerció una sesión de
navegador, tema real, selección persistente ni disposición DOM. La comparación
de prioridad usa grupos detectados por producción: no valida independientemente
toda la detección funcional. La señal inicial de cierre de piridina se revisó:
el análisis cierra 6→1, pero el comprobador básico solo cerraba carbociclos. El
defecto confirmado está en la explicación literal `C6=C7` y el uso de C para N1.

Los 440 casos no agotan el espacio químico. Hay 420 estructuras sin referencia
exacta nueva y no se revisaron normativamente los nombres españoles. La muestra
OPSIN se orientó al riesgo y no estima prevalencia estadística. Los rechazos
explícitos de alcance no se clasifican como nombres incorrectos. La pérdida
isotópica aceptada se separa de esos rechazos y recibe prioridad de integridad.
