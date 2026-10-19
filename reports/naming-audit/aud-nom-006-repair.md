# AUD-NOM-006 — reparación dirigida de AUDNOM-012

## Resultado

**AUDNOM-012: FIXED para los dos nombres ingleses IUPAC 2013 afectados.** La intervención corrige únicamente la traducción léxica inglesa y la conservación de un separador entre prefijos/localizadores. No cambia estructura molecular ni nomenclatura española. No se modificó la convención Legacy 1979.

HEAD verificado al inicio: `feb6ef017bf384eb6c32243dafdfa8d115774c3a` (`main`), que contiene AUD-NOM-005. El workflow de ese commit terminó `completed / success`: [GitHub Actions run 39169493299](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/39169493299). Al inicio solo existían dos archivos ajenos sin seguimiento; se preservaron.

## Causas raíz y correcciones

### AUDCASE-0160 — ethenyl y separador de localizador

La nomenclatura española del motor ya formaba el nombre correcto `1-cloro-4-vinilbenceno`. La ruta de display inglesa traducía `cloro` y `benceno`, pero no tenía una regla léxica delimitada para `vinil`, por lo que lo filtraba como `vinil`. Después, `alphabetizeEnglishHalogenPrefixes` identificaba `1-chloro` como prefijo simple y eliminaba todos los guiones iniciales del resto sin reconocer que `-4-` empezaba otro fragmento con localizador. Eso produjo `1-chloro4-vinilbenzene`.

La traducción inglesa ahora convierte `vinil` a `ethenyl` solo en un límite de morfema químico. La ordenación conserva el guion restante, de modo que el localizador siguiente permanece separado. Los nombres con más de un prefijo simple siguen ordenándose y pasan las regresiones existentes.

### AUDCASE-0337 — prefijo pentyloxy

La normalización inglesa tenía reemplazos de texto independientes para `metoxi`, `etoxi`, `propoxi` y `butoxi`; no contemplaba las raíces desde C5, y el resultado conservaba `pentoxi`.

Esos reemplazos se sustituyeron por una regla acotada a prefijos: obtiene las raíces de `IUPAC_ROOTS`, respeta los límites de nombre y mantiene los multiplicadores. Para C1–C4 forma `methoxy`–`butoxy`; desde C5 forma el conector inglés `yloxy` (`pentyloxy`, `hexyloxy`, etc.). No altera la raíz del padre ni sustituye coincidencias dentro de otra palabra.

## Comparación separada por perfil

| Caso | 2013 ES antes → después | 2013 EN antes → después | 1979 ES antes → después | 1979 EN antes → después |
|---|---|---|---|---|
| AUDCASE-0160, `c1(C=C)ccc(Cl)cc1` | `1-cloro-4-vinilbenceno` → igual | `1-chloro4-vinilbenzene` → **`1-chloro-4-ethenylbenzene`** | No disponible → igual | `1-chloro-4-vinilbenzene` → igual |
| AUDCASE-0337, `CCCCCC(C)OCCCCC` | `2-pentoxiheptano` → igual | `2-pentoxiheptane` → **`2-pentyloxyheptane`** | No disponible → igual | `2-pentoxiheptane` → igual |

Las dos salidas Legacy EN permanecen sin adjudicación histórica exacta y no se presentan como nombres preferidos ni como nombres normativamente validados. AUD-NOM-006 no traslada la expectativa 2013 a Legacy.

## Evidencia química y nomenclatural

Las expectativas inglesas modernas ya se habían derivado de forma independiente en AUD-NOM-005 antes de comparar los outputs: Blue Book P-12.3/P-14 y P-5 para `1-chloro-4-ethenylbenzene`; P-63.2.2.1.1 y P-63.2.4 para `2-pentyloxyheptane`. Los dos recibos OPSIN persistidos en `reports/naming-audit/aud-nom-005/rule-derived-candidate-receipts.json` interpretan las cadenas candidatas como `MATCH` de la estructura correspondiente. No se hicieron consultas externas nuevas.

El test usa la ruta química real y el adaptador: contrasta grafo y exportación con identidad estructural, fórmula (`C₈H₇Cl`, `C₁₂H₂₆O`), estabilidad del análisis y del padre, y los cuatro perfiles. Para las explicaciones, verifica que los enlaces reconstruyan literalmente el nombre visible, los destinos existan y las evidencias apunten solo a átomos/enlaces reales. Los casos objetivo no tienen estereocentros ni dobles enlaces E/Z; una comprobación léxica adicional confirma que los descriptores `(2R,4E)` sobreviven sin alteración. No se habilitaron nombres bloqueados.

La suite conserva los rechazos de AUDCASE-0171 y AUDCASE-0176 en los cuatro perfiles: ambos siguen sin publicar nombres locales incompletos y permanecen en `NEEDS_MANUAL_REVIEW` para el inventario histórico de 51 casos. No se editó ni reclasificó `historical-discrepancies-51.json`.

## Pruebas

Las invocaciones de prueba llevan límite explícito `--test-timeout=85000`; ninguna excedió 90 s.

| Comando | Resultado final | Duración |
|---|---:|---:|
| `node --test --test-timeout=85000 tests/audnom006-english-morphology.test.mjs` | 3 PASS, 0 FAIL, 0 SKIP | 11.98 s |
| `node --test --test-concurrency=1 --test-timeout=85000 tests/audnom006-english-morphology.test.mjs tests/ether-current-profile-regressions.test.mjs tests/halogen-nomenclature.test.mjs tests/aromatic-functional-nomenclature.test.mjs` | 37 PASS, 0 FAIL, 0 SKIP | 36.47 s |

La suite incluye ethenyl orto/meta/para, otro sustituyente aromático, los alcoxi C1–C10, grupos prefijo múltiples, límites de morfema, reconstrucción de fragmentos y navegación, determinismo, salida española y perfil Legacy. La segunda invocación también comprueba regresiones existentes de alquiloxi, halógenos y nomenclatura aromática.

Durante el trabajo, una primera ejecución de la nueva prueba falló por comparar la fórmula con subíndices ASCII en vez de los subíndices Unicode que usa la app; corregida la expectativa, pasó. Una ejecución intermedia de la suite relacionada reveló que un grupo alcoxi seguido de otro localizador no entraba en el límite de la regla nueva; se amplió el límite al guion y se añadieron casos permanentes. La repetición final pasó completa, como reflejan los comandos anteriores.

No se ejecutaron `npm test`, suites globales, el corpus de referencia, el auditor de 440 casos, `npm run build:pages` ni `npm run validate:pages`, respetando el límite de recursos de esta reparación. No se hicieron capturas OPSIN nuevas.

## Archivos para el commit futuro

```text
app/iupac-name-normalization.ts
tests/audnom006-english-morphology.test.mjs
reports/naming-audit/aud-nom-006-repair.md
```

No incluir en ese commit los archivos ajenos preexistentes `reports/orgorush-aud001-repair.md` y `tatus --short`. No se hizo commit ni push.
