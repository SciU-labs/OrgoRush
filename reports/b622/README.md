# B6.2.2 — cierre de auditoría química independiente

## Dictamen: sin contradicciones nuevas detectadas

La ejecución fresca de OPSIN OPSIN 2.9.0 local CLI with Temurin JRE 21.0.13+9 cubrió 84 filas del manifiesto actual. Se hicieron 69 llamadas para 66 nombres ingleses distintos: 69 equivalencias estructurales; sin diferencias, rechazos ni fallos técnicos. Las filas sin nombre actual permanecen como UNSUPPORTED-SAFE y no se contaron como llamadas.

La discrepancia original B62-I11 es una observación histórica ya corregida y no una discrepancia actual nueva: el nombre anterior `3,5-bis(1-methylethyl)pyridine` produjo una piridina diisopropilada sin oxígenos, en vez de los dos carboxilos. La causa de nomenclatura, corregida en B6.2.1, era que el formateador heterocíclico trataba carbonos exocíclicos como sustituyentes carbonados y omitía la prioridad del ácido; el detalle está en [su informe](../b621/README.md). El nombre actual es `pyridine-3,5-dicarboxylic acid`. Estructura de referencia: `C1=C(C=NC=C1C(=O)O)C(=O)O`; OPSIN produjo `N1=CC(=CC(=C1)C(=O)O)C(=O)O`. Ambas fórmulas son C7H5NO4 y la identidad estructural coincide. El perfil sigue en `PARTIAL-CANDIDATE` / `PARTIAL-VERIFIED`, con `fullProof: false`; este cierre no altera ni atribuye promoción a la barrera FULL.

## Corpus repetido

| Cohorte | Filas | FULL EN confirmados | EN PARTIAL verificados | EN sin nombre seguro |
|---|---:|---:|---:|---:|
| B6.0 construido (24) | 24 | 24 | 0 | 0 |
| B5.0 histórico (15) | 15 | 14 | 0 | 1 |
| B6.1 independiente (20) | 20 | 6 | 10 | 4 |
| B6.2 original congelado (20) | 20 | 3 | 9 | 8 |
| B6.2 suplemento congelado (1) | 1 | 0 | 0 | 1 |
| B6.1 rechecks dirigidos, repetidos (4) | 4 | 0 | 3 | 1 |
| **Total** | **84** | **47** | **22** | **undefined** |

Se conservaron los corpus originales. Las 20 referencias B6.2 tienen SHA-256 15e8eeb2074a59a5fcb670b90920dc13966ee1bcd3cb185039740841f497cbc6; el suplemento separado de una fila tiene SHA-256 735c9c0ea9a5433f10689da66bc0fa6651e42731f3fd68fa6c0cd23ae657f948. Cuatro rechecks son filas repetidas, no ampliación de la muestra. Los datos completos por ID, incluidos nombre, fórmula, estado anterior, salida OPSIN y comparación, están en [matrix.md](matrix.md) y [audit.json](audit.json).

## Estado bilingüe

ES: 47 nombres tienen soporte FULL interno, 20 tienen solo coincidencia composicional del puente ES→EN con OPSIN, 15 no emiten nombre y 2 quedan inconclusos. No hay intérprete español independiente en este procedimiento.

Los dos registros inconclusos son las dos apariciones de B61-I07 (una revalidación repetida). La traducción composicional ordena “phenyl” antes de “hydroxy”, pero el nombre inglés mostrado y aceptado por OPSIN ordena “hydroxy” antes de “phenyl”. OPSIN valida el nombre EN actual; no decide por sí mismo la nomenclatura española. Se requiere revisión terminológica independiente para esa correspondencia. Los estados `FULL-INTERNAL` tampoco equivalen a auditoría lingüística independiente.

## Comparación con los resultados archivados

La auditoría B6.2 inicial conserva 83 llamadas históricas (82 equivalentes, 1 discrepancia), 66 nombres distintos y 47 FULL ingleses confirmados. El resultado 1/1 no se borra ni se reescribe: correspondía al nombre pre-corrección de B62-I11. Esta reejecución es una comparación nueva sobre los corpus originales y los nombres actuales, no una edición de los artefactos históricos.

B62-I15 sigue conservado con su estado histórico, pero ya se documentó como solapamiento con un control B6.1 y no se presenta como novedad independiente. B50-CID3672 (ibuprofeno) permanece bloqueado por el importador; no se generó nombre ni llamada OPSIN. El suplemento B62-S01 permanece en su cohorte separada y tampoco fue admitido; no se incorpora al corpus original.

## Entorno, método y límites

- Rama/commit: main / 7d0396964935a687bb2d448303a0251c3129d964 (2026-11-11T06:21:35.535Z).
- Intérprete: OPSIN 2.9.0 local CLI with Temurin JRE 21.0.13+9. OPSIN se ejecutó localmente; ningún nombre se envió a un servicio remoto.
- Comparador: OpenChemLib 9.25.0 CanonizerUtil.NORMAL, shared with OrgoRush. Es útil para equivalencia estructural, pero no es independiente de OrgoRush.
- Una equivalencia OPSIN no certifica un PIN ni la corrección lingüística española.
- Las categorías de familia y sus límites de cobertura permanecen los mismos que en los artefactos B5.0/B6.0/B6.1/B6.2; esta auditoría no añadió familias, reglas ni soporte.
- No hubo cambios de producción, barreras FULL/PARTIAL/UNSUPPORTED, workflows, fixtures congelados, dependencias o JAR.

## Verificación de cierre

El cierre significa que esta reejecución no encontró una nueva discrepancia estructural en los nombres EN admitidos. No convierte los casos PARTIAL o UNSUPPORTED en FULL ni clausura las limitaciones de interpretación española señaladas arriba.

- Replay OPSIN fresco de los seis regioisómeros B6.2.1 y piridina-2-carboxílico: **7/7 equivalentes**, nombres ES/EN exactos, cero promociones FULL. Véase [b621-controls.json](b621-controls.json).
- Controles focalizados de visual-numbering, selected-atom-context, B6.1, B6.2.1 y generalización (incluidos aspirina y ácido salicílico): **52/52**.
- Shard exacto de GitHub Actions `node --test --test-concurrency=1 --test-shard=3/4 tests/*.test.mjs`: **693/693**, 0 fallos.
- `npm run typecheck`: correcto.
- `git diff --check`: correcto.

Los comandos, códigos de salida y conteos quedan registrados en [verification.json](verification.json). El shard se ejecutó en la rama/commit indicado arriba. Los artefactos B6.2.2 añadidos son el manifiesto de auditoría, su matriz y los scripts de reproducción; no se modificó código de producción ni los corpus congelados.
