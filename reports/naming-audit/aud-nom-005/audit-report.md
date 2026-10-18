# AUD-NOM-005 — segunda auditoría independiente de exactitud química

## Resumen ejecutivo

La ejecución reevaluó los **440 IDs originales** (sin añadir ni sustituir estructuras) con la ruta de química local actual, en los cuatro perfiles. El HEAD de referencia fue `bb0f8cf220878e55023592f7e22ac4be7b498d86` (`main`, AUD-NOM-004); el workflow de ese HEAD terminó correctamente: [GitHub Actions 39154680173](https://github.com/sciu-lab/Hydrocarbon-Lab/actions/runs/39154680173). No se cambió código de producción ni evidencia anterior.

- **432 importadas** y **8 rechazadas explícitamente**: cuatro policiclos fuera del soporte actual, tres estructuras con cargas fuera del alcance admitido y un SMILES con isótopo explícito (AUD-NOM-002). Los rechazos no se cuentan como corrupción.
- Salidas disponibles: **2013 ES 425/440**, **2013 EN 425/440**, **Legacy ES 201/440**, **Legacy EN 418/440**. Las demás son UNSUPPORTED.
- OPSIN, usando recibos originales, recibos AUD-NOM-003 y capturas nuevas hash-validadas, interpreta actualmente **198 nombres 2013 EN** y **190 Legacy EN** como MATCH constitucional y estereoquímico. Dos textos por perfil son REJECTED por el parser; 451 quedan UNVERIFIED y 37 outputs UNSUPPORTED. OPSIN valida interpretación estructural, no preferencia ni conformidad normativa.
- Hay **26 referencias exactas ya adjudicadas individualmente en el inventario histórico**: 20 de 2013 EN y 6 de Legacy EN, todas PASS; ninguna falla. En la muestra estructural de esta fase, seis salidas tienen esas referencias exactas; 169 salidas nombradas de la muestra siguen sin adjudicación normativa exacta. Se derivaron además dos expectativas modernas específicas con reglas Blue Book y se comprobó independientemente que OPSIN las interpreta contra la estructura correcta.
- El muestreo contiene 50 estructuras en 14 familias, seleccionado por SMILES/riesgo antes de leer los nombres. Es deliberadamente estratificado, no aleatorio; sus proporciones no estiman exactitud general.

## Comparación histórica

Los 51 resultados ingleses que AUD-NOM-001 había marcado MISMATCH se reexaminaron individualmente con la salida actual y recibos auténticos. El detalle de cada caso, nombre antiguo/actual, interpretación y motivo está en [historical-discrepancies-51.json](./historical-discrepancies-51.json).

| Estado actual | Casos | Interpretación |
|---|---:|---|
| `RESOLVED_MATCH` | 45 | Hay recibo actual validado y coincide la estructura. |
| `RESOLVED_SAFE_REJECTION` | 2 | Rechazo explícito del isótopo de AUDCASE-0440 en ambos perfiles ingleses; conserva identidad. |
| `STILL_MISMATCH` | 0 | No se observó discrepancia estructural actual confirmada. |
| `UNVERIFIED_CURRENT_OUTPUT` | 0 | No quedan salidas disponibles sin interpretación entre estas discrepancias. |
| `NEEDS_MANUAL_REVIEW` | 4 | AUDCASE-0171 y AUDCASE-0176, en 2013 EN y Legacy EN: la compuerta actual no da nombre, pero no es un rechazo seguro documentado. |

En la comparación textual de los 440 casos, 61 salidas de perfil difieren de AUD-NOM-001: cuatro corresponden a las correcciones E/Z de AUD-NOM-004, cuatro a la nueva política de rechazo isotópico de AUD-NOM-002 y las otras 53 coinciden con la captura AUD-NOM-004 pero requieren atribución exacta a las fases anteriores. No hay diferencias entre la ejecución actual y la captura completa posterior a AUD-NOM-004. No se ha etiquetado una mera diferencia textual como regresión.

## Exactitud por familia

La tabla resume la muestra, no una tasa de exactitud. “MATCH EN” cuenta outputs ingleses de los dos perfiles que tienen interpretación independiente recibida; “ref. exacta” son solo las expectativas exactas históricas adjudicadas para salidas de la muestra.

| Familia | Casos muestreados | Outputs nombrados / 4 perfiles | MATCH EN | Ref. exacta |
|---|---:|---:|---:|---:|
| Alcanos | 3 | 11 | 6 | 0 |
| Alquenos | 3 | 12 | 6 | 0 |
| Alquinos | 3 | 12 | 6 | 0 |
| Poliinsaturados | 4 | 12 | 8 | 2 |
| Carbociclos | 4 | 14 | 8 | 0 |
| Aromáticos | 4 | 13 | 6 | 0 |
| Halogenados | 3 | 11 | 6 | 0 |
| Alcoholes/polioles | 3 | 12 | 6 | 1 |
| Carbonilos | 3 | 12 | 6 | 2 |
| Ácidos carboxílicos | 4 | 14 | 8 | 0 |
| Éteres/ésteres | 4 | 12 | 6 | 0 |
| Funciones nitrogenadas | 4 | 12 | 8 | 0 |
| Funciones mixtas | 4 | 14 | 8 | 1 |
| Estereoquímica/policiclos/límites | 4 | 14 | 8 | 0 |
| **Total** | **50** | **175** | **96** | **6** |

Los 96 MATCH son verificaciones de interpretación OPSIN de textos ingleses exactos, no adjudicaciones de nomenclatura preferida. Otras 4 instancias de la muestra (dos textos repetidos por perfil) fueron rechazadas por OPSIN; 25 posiciones de perfil no tienen output por soporte explícitamente limitado. Los archivos `sample-current-interpretations.json` y `property-summary.json` contienen el registro granular.

## Evidencia normativa

Las expectativas exactas de la muestra que ya constaban en `audit-cases.json` conservan su nivel y derivación original; no se extendieron a otros perfiles o idiomas. Para AUDCASE-0160 y AUDCASE-0337 se fijaron candidatos modernos antes de compararlos con la salida:

- **AUDCASE-0160**, `c1(C=C)ccc(Cl)cc1`: 2013 EN observado `1-chloro4-vinilbenzene`; expectativa derivada `1-chloro-4-ethenylbenzene`. Blue Book P-12.3 identifica *ethenylbenzene* como PIN; P-14 trata los locantes y el orden del nombre, y P-5 da el prefijo *chloro*. OPSIN rechaza el texto observado y devuelve MATCH para la cadena candidata. Fuentes: [Blue Book P-1](https://iupac.qmul.ac.uk/BlueBook/P1.html) y [P-5](https://iupac.qmul.ac.uk/BlueBook/P5.html).
- **AUDCASE-0337**, `CCCCCC(C)OCCCCC`: 2013 EN observado `2-pentoxiheptane`; expectativa derivada `2-pentyloxyheptane`. P-63.2.2.1.1 prescribe la formación del prefijo *oxy* y aporta *pentyloxy* como ejemplo; P-63.2.4 admite nomenclatura sustitutiva de éteres. OPSIN rechaza el texto observado y da MATCH para el candidato. Fuente: [Blue Book P-6](https://iupac.qmul.ac.uk/BlueBook/P6.html).

Estos datos sustentan el hallazgo `AUDNOM-012` P2: la salida inglesa moderna conserva morfología española en ambos casos y, para el aromático, omite el separador antes del localizador 4. La causa probable es una fuga en el formateo por idioma; no se localizó una función única. No se afirma que las formas 2013 sean la expectativa normativa exacta de Legacy 1979: allí se registra el texto observado, pero la forma histórica queda sin adjudicar. OPSIN por sí solo tampoco sería autoridad normativa.

No se adjudicaron nombres en español. No se usó la traducción de OrgoRush como oráculo ni se infirió exactitud española a partir de OPSIN inglés. La certeza estructural inglesa y la certeza de grafía española permanecen separadas.

## Integridad química y pedagógica

Las propiedades computadas para las 432 moléculas importables dieron: import/export de identidad 432 PASS (8 SKIP por rechazo); round-trip 432 PASS; determinismo y determinismo del nombre 432 PASS; inmutabilidad del grafo/análisis 432 PASS; independencia de coordenadas 432 PASS; perfil e idioma 425 PASS (7 SKIP); representaciones equivalentes 406 PASS y 26 SKIP. Son comparaciones estructurales con identidad OpenChemLib a través de la ruta de adaptador; no constituyen un segundo motor químico completamente independiente. La variante de árbol solo está disponible para 406 estructuras distintas evaluables. La comprobación DOM/tema real fue SKIP para las 432 moléculas: no se ejecutó navegador.

La ejecución produjo dos señales `ANALYSIS_BOND_LOCANT`, ambas para piridina (`AUDCASE-0430`). La inspección adjudicó ambas como falso positivo del verificador heredado: este trata como cierre solo `family=cycloalkane` y no reconoce el cierre Kekulé aromático 6→1; en un sistema aromático los enlaces pi están deslocalizados. No quedó señal sin revisar. No se confirmó un defecto adicional de explicación/fragments en esta fase. Esta cobertura pedagógica se limita a las señales automáticas y sus casos, no a una auditoría manual exhaustiva de cada explicación o control visual.

## Hallazgos y recomendaciones

- `AUDNOM-012` — **P2 confirmado**, dos casos: morfología española en dos nombres ingleses modernos, una con límite de localizador mal formado. No hay pérdida de identidad molecular. Evidencia detallada en [findings.json](./findings.json) y candidatos/recibos en [rule-derived-candidates.json](./rule-derived-candidates.json) y `rule-derived-candidate-receipts.json`.
- No se identificó P0/P1 nuevo en las 440 estructuras importables. Las 8 exclusiones son rechazos de soporte, no errores de nombre. Cuatro salidas históricas permanecen en revisión manual.
- Próxima prioridad diagnóstica: inspeccionar AUDCASE-0171/0176 y documentar por separado el linaje de las 53 diferencias de nombre aún no atribuidas. Después, reparar el formateo inglés de AUDNOM-012 con una autorización de implementación y regresiones bilingües adecuadas.
- Ampliar referencias normativas de forma priorizada y mantener estados UNADJUDICATED donde falten fuentes; no presentar OPSIN como certificación IUPAC ni inferir calidad lingüística española.

## Archivos y reproducibilidad

La fase nueva está bajo `scripts/naming-audit/aud-nom-005/`, `tests/naming-audit/aud-nom-005.test.mjs` y `reports/naming-audit/aud-nom-005/`. Conserva lotes, hashes, plan de muestra, recibos OPSIN adicionales, los 51 estados, comparación de los 440 nombres, resumen de propiedades, hallazgo y candidatos derivados. Las consultas externas se limitaron a 49 textos exactos de muestra y 2 candidatos fijados por reglas; los errores iniciales de red se guardaron separados de respuestas químicas. La ejecución offline consume recibos guardados y valida sus hashes.

## Validación

La suite dedicada ejecutada después de añadir comprobaciones de la evidencia nueva:

```text
node --test tests/naming-audit/aud-nom-005.test.mjs
8 PASS, 0 FAIL, 0 SKIP
```

La batería relacionada AUD-NOM-002 a 004 pasó con 205 PASS y 0 FAIL; la prueba de selección de progenitor ejecutada por separado añadió 1 PASS. `npm run test:reference-corpus` terminó con 792 PASS, 0 FAIL y 5 SKIP. `npm run build:pages`, `npm run validate:pages` y `git diff --check` pasaron. El detalle y la errata de ruta corregida en la batería relacionada constan en [validation-results.json](./validation-results.json). `npm test` completo no se ejecutó. El workflow de GitHub citado corresponde al HEAD previo al inicio de esta auditoría, no a estos archivos nuevos sin publicar.

## Estado Git

Al iniciar, el árbol tenía solo dos archivos ajenos sin seguimiento: `reports/orgorush-aud001-repair.md` y `tatus --short`. Se preservaron sin modificación. Esta fase añadió únicamente sus artefactos de auditoría, arnés y prueba dedicada; ningún archivo de producción o referencia protegida se editó. No se hizo commit ni push.
