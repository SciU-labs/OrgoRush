# ORGORUSH-IUPAC79-FALLBACK-005 — Aminas alifáticas

## Alcance y reproducción

Línea base: `8c81185`, árbol limpio antes de iniciar esta tarea. Se conserva
la reproducción original en `orgorush-iupac79-fallback-005.baseline.json`.
No se realiza commit ni push.

| Dato | Antes | Después |
|---|---|---|
| Suggested 2013 ES | `5-etiloctan-3-amina` | Sin cambio |
| Legacy 1979 EN | `5-ethyl-3-octanamine` | Sin cambio |
| Legacy 1979 ES | No disponible | `5-etil-3-octanamina` |
| Disponibilidad química | `true` | `true` |
| Formateador nativo ES | `"-"` | `"-"` |
| Padre del modelo EN | `chain`, 8 carbonos | Sin cambio |
| Función principal | amina, C3 | Sin cambio |
| Sustituyente | etil, C5 | Sin cambio |
| Resolución | `UNSUPPORTED` | `TRANSLATED_FROM_LEGACY_EN` |

El SMILES constitucional `CCC(N)CC(CC)CCC` coincide con un grafo construido
independientemente como cadena C1–C8, NH2 en C3 y etil en C5. OCL confirma
la fórmula C10H23N. No hay una excepción para este SMILES en la aplicación.

La causa exacta es doble: `formatIupac1979SpanishName()` no reconoce esta
gramática de aminas y devuelve `undefined` (el adaptador devuelve `"-"`);
el fallback posterior solo invocaba `verifyLegacyAromaticModel()`, que
exige `parent.kind === "aromatic"` y seis carbonos. La razón registrada
era `semantic-model-does-not-prove-complete-graph`. No era un veto químico.

La reproducción usa `analyzeMolecule`, `legacySpanishFormatterInput`, el
formateador nativo y `resolveLegacyNomenclature`; las pruebas ejercitan
también el constructor del modelo EN, el generador EN, el traductor y
`resolveLegacySpanish` directamente.

## Implementación y validación estructural

La ruta nueva admite aminas **acíclicas, saturadas, neutras**, con padre de
1–20 carbonos: primarias lineales o ramificadas, posiciones internas,
poliaminas primarias de hasta diez grupos NH2, todos en el padre, y monoaminas secundarias
o terciarias asimétricas con ramas N-alquilo lineales admitidas por el modelo existente.
Los prefijos carbonados usan la gramática estructural ya existente, incluidos
sus cuatro radicales ramificados explícitos; no se amplía esa gramática.
Se conserva el límite de 120 átomos del comparador estructural compartido.

Se reconstruye el padre, cada N, cada prefijo carbonado y cada rama N.
La comparación completa comprueba elementos, enlaces, cargas, hidrógenos
implícitos y correspondencia obligatoria de los átomos del padre y de las
ramas N. Se comprueban además valencias, ausencia de ciclos y conectividad.
La identidad constitucional por sí sola no basta: se enumeran caminos
del bosque carbonado real para descartar un padre más corto, menos grupos
principales o una orientación con locantes peores. Se reutiliza el comparador
de criterios Legacy del proyecto, sin volver a invocar el analizador como
prueba independiente de su propia elección.

La gramática ES se compone a partir de los componentes probados: por ejemplo,
`5-etil-3-octanamina`, `1,2-etanodiamina` y `N,N-dimetil-1-propanamina`.
No se traduce un nombre arbitrario mediante sustituciones de sufijos.
La coincidencia con la salida EN es solo una condición preliminar.

La ruta aromática y la prioridad de una salida nativa ES validada se
conservan. Actualmente las aminas de esta matriz usan el fallback; no se
presenta como nueva cobertura del formateador nativo. Su contrato de
precedencia tiene pruebas explícitas.

## Integración y defectos encontrados

- El resultado ES proyecta el nombre y la numeración probados al análisis
  usado por «Cómo se obtiene». La interfaz, el portapapeles y las exportaciones
  siguen consumiendo la resolución seleccionada existente.
- Se corrigió `carbonIncludedInParent` para aminas: el modelo comprobaba
  únicamente `carbonId`, que podía pertenecer a una rama N. Ahora consulta
  todos los carbonos vecinos representados en `carbonIds`. Las cadenas y
  grafías EN correctas se conservan.
- Las búsquedas de ancla confundían ID `0` con ausencia. Se comprueba ahora
  `undefined`; una regresión asigna ID cero al carbono portador del amino.
- Dos diagnósticos TypeScript iniciales del módulo nuevo se corrigieron
  con una anotación explícita del siguiente tramo carbonado.
- La revisión final de C-814.1 añadió un veto para aminas totalmente
  simétricas: el generador EN existente ofrece una forma con prefijos N,
  mientras esa regla prescribe la forma multiplicada del radical. No se
  modifica EN ni se publica una traducción histórica sin esa adjudicación.
- La comprobación alfabética enlaza cada topología de radical con su grafía
  citada: `isopropil` y `1-metiletil` tienen claves distintas. Una prueba de
  empate real conserva el mismo grafo y exige orientaciones opuestas para
  esas dos grafías; no se normaliza el alias antes de decidir la numeración.

## Referencias aplicadas

Fuente normativa: *Nomenclature of Organic Chemistry*, IUPAC, Pergamon,
1979, reproducción autorizada:

- [C-11.4](https://www.acdlabs.com/iupac/nomenclature/79/r79_918.htm):
  admite la nomenclatura por sufijo sobre el padre y su disposición histórica.
- [C-811](https://www.acdlabs.com/iupac/nomenclature/79/r79_510.htm):
  distingue las clases de aminas y la función sufijo/prefijo.
- [C-812.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_513.htm):
  aminas primarias por radical o por padre; se conserva la opción por padre
  que usa el generador EN existente.
- [C-813.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_517.htm):
  sufijos multiplicados de diaminas y poliaminas primarias.
- [C-814.1, C-814.4 y C-814.6](https://www.acdlabs.com/iupac/nomenclature/79/r79_522.htm):
  forma multiplicada de aminas simétricas, sustitución N sobre una amina
  primaria y límite de las poliaminas complejas.
- [C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm) y
  [A-2.3–4](https://www.acdlabs.com/iupac/nomenclature/79/r79_36.htm):
  prioridad de locantes y ordenación de prefijos.

## Pruebas y compilaciones

- Pruebas nuevas finales: **10/10 PASS**.
- Regresiones dirigidas de aminas/aromáticos/Legacy EN/exportación:
  **58/58 PASS** en la tanda dirigida inicial. Las pruebas de aminas se
  volvieron a ejecutar con todos los controles finales en la tanda siguiente.
- Revisión histórica final, prioridad de poliaminas, desempate de alias y
  regresiones N: **20/20 PASS**. Incluye el rechazo de una orientación
  numérica incorrecta que conserva exactamente la misma conectividad.
- Reproducción final: **12 casos traducidos y dos límites rechazados como
  se esperaba**, con aserciones; los mapas de numeración se guardan en el JSON.
- TypeScript, mismos directorios fuente y dependencias que `8c81185`:
  **49 diagnósticos preexistentes antes y después; ninguno nuevo**.
  El chequeo global sigue devolviendo código 1 por esos problemas existentes;
  no se declara una compilación TypeScript limpia.
- Pages: compilación **PASS**; validador **PASS**, tres entradas, seis assets,
  base `/Hydrocarbon-Lab/`.
- Sites: compilación **PASS**; validador de artefacto **PASS**, Worker ESM con
  `default.fetch` y manifiesto de hosting presentes.
- Suite general: **164 archivos cubiertos, 2.878 pruebas distintas**. La
  conexión de herramientas interrumpió la primera tanda tras completar 44
  archivos: 630 PASS y dos incidencias de capturas entre procesos. Se conservó
  el registro y se ejecutaron los 120 restantes: **2.241 PASS, cero FAIL y
  cinco SKIP preexistentes** (2.246 pruebas en esa tanda).
  Los SKIP corresponden a ESTER-0007, ESTER-0012, ESTER-0014, ESTER-0015 y
  ESTER-0016: referencias de nivel `silver` que no constituyen un oráculo
  de nombre exacto. No se modificaron esas referencias ni sus omisiones.
- Las dos capturas afectadas se revalidaron al terminar la suite, sin otras
  pruebas en paralelo: **10/10 PASS**, incluidos los dos casos inicialmente
  fallidos. Se conservaron los fixtures y los límites originales de 60 y
  120 segundos por proceso. El primer caso había reproducido `ETIMEDOUT`;
  el segundo falló tras 121,1 segundos en un test con límite de 120 segundos
  por proceso. Su diagnóstico completo no quedó disponible al interrumpirse
  la ejecución global; la repetición validó exactamente sus datos congelados.
  La repetición completa tardó 197,9 segundos y devolvió código 0.
- Resultado final por prueba distinta: **2.873 PASS y cinco SKIP; ninguna
  regresión funcional pendiente**. Esto combina las dos tandas y la
  revalidación; no se presenta como una única ejecución limpia sin
  interrupciones. Los cinco SKIP no se convierten en PASS.
- `git diff --check`: **PASS**. `HEAD` permanece en `8c81185`; sin commit ni push.

Las pruebas nuevas incluyen 17 referencias nominales en cinco variantes
de coordenadas/metadatos/IDs, el grafo independiente obligatorio, numeración
real, nombres de exportación, fragmentos y referencias de razonamiento,
radical complejo controlado, prioridad de dos NH2 sobre una cadena más larga
que contiene solo uno y ancla con ID cero. Los negativos incluyen
función o rama omitida, longitud o locante incorrecto, padre equivalente
pero más corto, correspondencias N falsas, enlaces cambiados, cargas,
isótopos y estereoquímica explícita no representada.

Reproducción: `node scripts/audit-iupac79-fallback-005.mjs`.
Pruebas específicas: `node --test --test-concurrency=1 tests/iupac79-fallback-005.test.mjs`.
Los registros de ejecución quedan en `outputs/iupac79-fallback-005/`.

## Cobertura pendiente

Se mantiene el alcance solicitado: no se incorporan otras familias antes
de cerrar las regresiones de aminas. La ampliación restante requiere pruebas
estructurales propias y se documenta para trabajo posterior:

| Familia o caso | Trabajo pendiente |
|---|---|
| Aminas insaturadas | Verificar gramática histórica de enlaces múltiples, su prioridad y las variantes de sufijo antes de admitirlas. |
| Aminas con estereoquímica explícita | Probar descriptores R/S y E/Z con correspondencia atómica; nunca quitar un descriptor para permitir la traducción. |
| Poliaminas N-sustituidas | Representar y validar N, N′ y otros locantes distinguibles; el modelo actual usa solo N. |
| Aminas secundarias/terciarias totalmente simétricas | Adjudicar y representar la forma di-/trialquilamina de C-814.1; no traducir automáticamente la grafía N-sustituida actual. |
| Otros radicales N, ciclos y heterociclos | Ampliar la representación de ramas y aplicar las reglas de padres correspondientes. |
| Aminas con otras funciones | Probar jerarquía, prefijos subordinados y todas las funciones del grafo. |
| Alcoholes y cetonas | Reconstruir O y órdenes de enlace; probar sufijos múltiples y prioridad con otras funciones. |
| Aldehídos y ácidos | Distinguir carbono incluido/exocíclico, terminales y grupos múltiples. |
| Amidas y nitrilos | Probar enlace C=O/C≡N, carbono de función y sustitución N cuando corresponda. |
| Ésteres | Identificar independientemente fragmento ácido y radical unido al O; no confundirlos con ramas del padre. |
| Alquenos y alquinos sustituidos | Probar órdenes de enlace, numeración y radicales insaturados completos. |

La causa común de estos fallbacks pendientes es la falta de una ruta
alifática verificada para cada familia, además de los límites léxicos del
formateador ES. No se afirma que todos sus nombres EN sean correctos ni que
todos sus rechazos tengan idéntica causa: esa auditoría queda pendiente.
No se declara cobertura universal de IUPAC 1979.

## Archivos modificados

- `app/iupac1979-aliphatic-amines.ts` (nuevo): prueba estructural y gramática ES.
- `app/iupac1979-english-to-spanish.ts`: despacho de la ruta alifática.
- `app/page.tsx`: datos del modelo y análisis seleccionado.
- `scripts/naming-audit/evaluate.mjs`: proyección del análisis alifático en auditorías.
- `scripts/audit-iupac79-fallback-005.mjs` (nuevo): reproducción verificable.
- `tests/iupac79-fallback-005.test.mjs` (nuevo): regresiones y negativos.
- Este informe, `reports/orgorush-iupac79-fallback-005.baseline.json` y
  `reports/orgorush-iupac79-fallback-005.verification.json`.
