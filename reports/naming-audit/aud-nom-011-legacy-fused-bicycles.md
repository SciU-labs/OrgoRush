# AUD-NOM-011 — Legacy 1979: tres padres bicíclicos fusionados saturados

Fecha: 2026-10-20. Resultado: **PASS del alcance dirigido**. La validación integral queda para CI.

## A. Causa raíz y reproducción previa

HEAD inicial: `bff6c56bf1bd33ed6ee4f283b6e7871646131639`, rama `main`. El árbol tracked estaba limpio; solo existían los dos archivos ajenos sin seguimiento indicados al final.

Se construyeron ciclopentano/ciclohexano con `buildHydrocarbonFromIupacName()` y se fusionaron con `fuseRingOnBond()`. Antes de cambiar producción se analizaron los grafos con los modos actual y Legacy y se reprodujeron las rutas reales de formato y visualización.

| Fusión | Fórmula obtenida | Entrada del formateador ES | Legacy ES antes | Legacy EN antes |
| --- | --- | --- | --- | --- |
| 5+5 | C8H14 | biciclo[3.3.0]octano | `-`, no disponible | bicyclo[3.3.0]octane |
| 6+5 | C9H16 | biciclo[4.3.0]nonano | `-`, no disponible | bicyclo[4.3.0]nonane |
| 6+6 | C10H18 | biciclo[4.4.0]decano | `-`, no disponible | bicyclo[4.4.0]decane |

`formatIupac1979SpanishName()` no tenía una extensión para estos padres. `legacyProfileDisplayName()` convertía el guion en indisponibilidad. No se encontró un segundo bloqueo específico en el selector.

En EN, `buildLegacyEnglishNameModel()` asigna `parent.kind = "polycyclic"` y traduce `displayedSourceName` como `parent.fallbackName`. `hydrocarbonParent()` y `functionalParent()` del generador Legacy devuelven ese fallback. Por tanto, la ruta inglesa **hereda el nombre policíclico calculado y traducido; no constituye una demostración histórica independiente**. Los tres resultados básicos se justifican con las reglas originales siguientes.

## B. Evidencia histórica y terminología española

Fuente normativa: IUPAC, *Nomenclature of Organic Chemistry, Sections A, B, C, D, E, F, and H*, Pergamon Press, Oxford, 1979.

| Fuente consultada | Afirmación respaldada |
| --- | --- |
| [A-31, sistemas bicíclicos](https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm) | A-31.1 nombra sistemas alicíclicos saturados de dos anillos que comparten al menos dos átomos con `bicyclo`, el alcano del total de carbonos y las tres longitudes de puente en orden descendente. A-31.2 comienza en una cabeza de puente y sigue primero el camino más largo, después el siguiente y finalmente el más corto. |
| [Nota original: definición de puente](https://www.acdlabs.com/iupac/nomenclature/79/r79_165.htm) | Un puente puede ser un enlace de valencia. El enlace compartido tiene cero átomos intermedios; las cabezas no se cuentan en las longitudes. |
| [Índice de las recomendaciones 1979](https://www.acdlabs.com/iupac/nomenclature/79/r79_8.htm) | Identifica A-31 como parte de la reproducción autorizada de la edición de 1979. |
| [Mariano Pazos Afonso, IES A Sardiñeira/Xunta de Galicia, curso 2009-10: Alcanos bicíclicos](https://centros.edu.xunta.es/iesasardineira/web_CS/qo/nomenclatura/nomenorgan/hidrocarburos/biciclicos.php) | Corrobora la terminología española `biciclo`, cabezas de puente, tres cadenas y el nombre del alcano con el mismo total de carbonos. Es evidencia de la adaptación lingüística, no una traducción oficial de la edición de 1979. La puntuación con puntos sigue la fuente normativa inglesa. |

Aplicación al grafo: los caminos externos de anillos de 5/6 miembros contienen respectivamente 3/4 carbonos intermedios; el tercer camino es el enlace compartido. Sumando las dos cabezas se obtienen 8, 9 y 10 carbonos. Así se justifican `[3.3.0]octane`, `[4.3.0]nonane` y `[4.4.0]decane`, y sus formas españolas `biciclo…octano/nonano/decano`.

La justificación histórica usa A-31.1/A-31.2 de 1979 y su nota, no las ampliaciones de 1999/2013. No se utilizó la aceptación de OPSIN como prueba normativa. La equivalencia de los nombres modernos e históricos de estos tres padres es legítima.

## C. Reparación y resultados

Se añadió una lista explícita de las tres grafías al formateador ES. La admisión química se verifica en la capa de análisis que dispone del grafo y del resultado real de `getFusedBicyclicSystem()`.

El análisis conserva una prueba `spanish1979SaturatedFusedParent` solo si el sistema reconocido cumple: dos carbociclos alifáticos de 5/6 miembros que cubren todos los átomos; enlaces simples, únicos y válidos; carbonos neutros de valencia admisible; ausencia de sustituyentes, funciones y metadatos estereoquímicos. El reconocedor existente prueba la fusión por una arista y proporciona descriptor, nombre y numeración; no se duplicó su algoritmo. La unión completa de los dos ciclos también prueba conectividad.

`legacySpanishFormatterInput()` exige esa prueba para las tres grafías. Un nombre suministrado, un análisis distinto o un prefijo estereoquímico no pueden activar la cobertura. Las demás rutas conservan su comportamiento anterior.

| Fusión | Átomos | Fórmula | Puentes | 2013 ES | 1979 ES | 2013 EN | 1979 EN | Estado |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| 5+5 | 8 C | C8H14 | [3.3.0] | biciclo[3.3.0]octano | biciclo[3.3.0]octano | bicyclo[3.3.0]octane | bicyclo[3.3.0]octane | PASS |
| 6+5 | 9 C | C9H16 | [4.3.0] | biciclo[4.3.0]nonano | biciclo[4.3.0]nonano | bicyclo[4.3.0]nonane | bicyclo[4.3.0]nonane | PASS |
| 6+6 | 10 C | C10H18 | [4.4.0] | biciclo[4.4.0]decano | biciclo[4.4.0]decano | bicyclo[4.4.0]decane | bicyclo[4.4.0]decane | PASS |

Las pruebas enumeran independientemente los caminos entre cabezas, verifican una sola arista común y las identidades de SMILES de control. Comprueban la fórmula, el comienzo de la numeración por el camino más largo, la invariancia frente a IDs/orden/coordenadas y el recorrido ES→EN→Legacy→actual sin mutar grafo, numeración o análisis.

Las explicaciones reutilizan los pasos bicíclicos existentes: fusión, cabezas/caminos y numeración bicíclica. Los fragmentos/enlaces reconstruyen exactamente el nombre visible y solo apuntan a evidencia y destinos existentes; no se añadieron enlaces pedagógicos ni pasos de cadena acíclica.

## D. Alcance preservado y riesgos pendientes

No se habilitan mediante esta regla biciclos insaturados, aromáticos, heterocíclicos, funcionalizados, sustituidos, espiro, anillos enlazados externamente, triciclos, tetraciclos, otros sistemas puenteados, grafos desconectados, carbonos sobrevalentes ni estructuras con carga o metadatos estereoquímicos. La prueba incluye 15 controles de estas fronteras; los tres primeros controles de importación policíclica siguen siendo rechazados por el adaptador real.

Preservar el comportamiento no significa declarar todo derivado no disponible. La reproducción previa mostró estas rutas existentes y las pruebas las conservan literalmente:

| Control | Legacy ES preexistente y conservado | Legacy EN preexistente y conservado |
| --- | --- | --- |
| Un doble enlace en el biciclo 6+6 | biciclo[4.4.0]-2-deceno | bicyclo[4.4.0]dec-2-ene |
| Alcohol en el biciclo 6+6 | biciclo[4.4.0]-2-decanol | bicyclo[4.4.0]decan-2-ol |
| Dos ciclohexanos enlazados externamente | No disponible ES | cyclohexylcyclohexane |

Esta intervención no adjudica históricamente las grafías de esos derivados. Su validez y cualquier normalización pendiente requieren un alcance separado.

**Riesgo EN observado antes de reparar:** un metilo añadido a C3 del grafo construido de decalina se numera como C2 y produce Suggested `2-methylbicyclo[4.4.0]decane`, pero el fallback Legacy devuelve `2-methyl-2-methylbicyclo[4.4.0]decane`. El fallback ya contiene el prefijo y el formateador lo vuelve a añadir. También hay fallback para padres tricíclicos/tetracíclicos, sin que esta tarea pruebe su procedencia normativa de 1979. Ningún comportamiento de esa ruta EN se modificó; el problema no afecta los tres padres sin sustituyentes aquí validados y queda registrado para una tarea específica.

No se modificaron `fuseRingOnBond`, el reconocedor von Baeyer, elección de cabezas, fórmulas, conectividad, geometría, import/export SMILES ni Practice/Exam. Los corpus, recibos y registros históricos —incluido AUD-NOM-009— permanecen intactos. La cobertura ES nueva se atribuye exclusivamente a AUD-NOM-011.

## E. Ejecuciones y límites

Cada proceso Node tuvo un límite externo de **85 segundos**, aplicado por PowerShell con `Start-Process`, `WaitForExit(85000)` y terminación del árbol con `Kill($true)` en caso de TIMEOUT. Los tiempos siguientes son los del wrapper, excluyendo el arranque del shell. No hubo TIMEOUT.

| Comando / ejecución | Tiempo | Resultado final |
| --- | ---: | --- |
| Reproducción previa dirigida (script temporal, retirado) | 13.00 s | Tres padres: ES no disponible / EN disponible; fronteras registradas antes del cambio |
| `node --test tests/aud-nom-011-legacy-fused-bicycles.test.mjs` | 13.20 s | 6 PASS / 0 FAIL / 0 SKIP |
| `node --test tests/fused-ring-nomenclature.test.mjs` | 13.45 s | 36 PASS / 0 FAIL / 0 SKIP |
| `node --test tests/nomenclature-conventions.test.mjs tests/legacy-profile-display.test.mjs` | 1.03 s | 19 PASS / 0 FAIL / 0 SKIP |
| `node --test tests/legacy-english-nomenclature.test.mjs` | 12.89 s | 24 PASS / 0 FAIL / 0 SKIP |
| `node --test --test-concurrency=1 tests/reasoning-nom004-profile.test.mjs tests/fix-reason-legacy-alkane-fragments.test.mjs` | 26.78 s | 9 PASS / 0 FAIL / 0 SKIP |
| `npm run build:pages` | 5.55 s (Vite: 4.02 s) | PASS |
| `npm run validate:pages` | 0.76 s | PASS: 3 entradas, 6 assets, base `/Hydrocarbon-Lab/` |
| `git diff --check` | — | PASS |

**Total final de pruebas dirigidas: 94 PASS, 0 FAIL, 0 SKIP.** El build conserva avisos de chunk grande, import dinámico ineficaz del adaptador y tiempos de plugins; no impidieron compilar ni validar.

Intentos de desarrollo registrados: el primer montaje del script previo terminó en 17.35 s porque el importador rechazó correctamente el fixture aromático fusionado; se utilizaron luego grafos OpenChemLib solo como fixtures de análisis de topologías no editables, sin cambiar el importador. La primera ejecución de la nueva prueba terminó en 14.82 s con 3 PASS/3 FAIL por una expectativa de puntuación inglesa que no contemplaba la coma antes de `and`. Se corrigió exclusivamente esa aserción nueva para comprobar los conteos y descriptor reales; la ejecución final indicada arriba pasó.

Reproducción del límite para cualquiera de los comandos Node de la tabla (el wrapper empleado también capturó stdout/stderr temporales y midió con Stopwatch):

```powershell
$p = Start-Process node -ArgumentList @('--test', 'tests/aud-nom-011-legacy-fused-bicycles.test.mjs') -NoNewWindow -PassThru
if (-not $p.WaitForExit(85000)) {
  $p.Kill($true)
  $p.WaitForExit()
  throw 'TIMEOUT after 85 seconds'
}
if ($p.ExitCode -ne 0) { throw "Node exited with $($p.ExitCode)" }
```

Build/validación de Pages se lanzaron mediante el CLI npm de Node dentro del mismo límite externo. No se ejecutaron `npm test`, el glob completo `tests/*.test.mjs`, barridos de 440 estructuras, auditorías globales ni suites extensas de UI.

## F. Archivos y Git

Modificados:

- `app/nomenclature-conventions.ts`: tres grafías explícitas de 1979.
- `app/page.tsx`: prueba estructural de admisión y paso seguro al formateador ES.

Nuevos:

- `tests/aud-nom-011-legacy-fused-bicycles.test.mjs`.
- `reports/naming-audit/aud-nom-011-legacy-fused-bicycles.md`.

HEAD y rama permanecen en `bff6c56bf1bd33ed6ee4f283b6e7871646131639`, `main`. Se preservaron los archivos ajenos sin seguimiento `reports/orgorush-aud001-repair.md` y `tatus --short`. Sin staging, commit ni push.
