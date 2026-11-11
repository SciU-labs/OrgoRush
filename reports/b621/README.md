# B6.2.1 — corrección focalizada de ácidos piridindicarboxílicos

## Diagnóstico B6.2 conservado

El registro afectado es B62-I11, PubChem CID 10366. La estructura de referencia es `C1=C(C=NC=C1C(=O)O)C(=O)O`, fórmula C₇H₅NO₄; el nombre independiente archivado es `pyridine-3,5-dicarboxylic acid`. El perfil local antes de la corrección era PARTIAL.

El nombre local erróneo era `3,5-bis(1-metiletil)piridina` / `3,5-bis(1-methylethyl)pyridine`. OPSIN 2.9.0 interpretó este último como `CC(C)C=1C=NC=C(C1)C(C)C`, una piridina con dos ramas isopropilo (C₁₁H₁₇N), no como el diácido C₇H₅NO₄. La discrepancia fue constitucional y composicional: los dos carbonilos y sus cuatro oxígenos no estaban representados.

La causa raíz estaba en `analyzeHeterocycleMolecule()` de `app/page.tsx`: su recorrido trataba cada carbono exocíclico unido al anillo como raíz de una cadena carbonada y llamaba a `nameSubstituent()`. Aunque `detectFunctionalGroups()` ya reconocía los carboxilos, ese analizador devolvía `functionalGroups: []` y nunca seleccionaba la prioridad del ácido. El N del anillo, la conectividad aromática y la numeración desde N estaban bien reconocidos; el fallo era posterior, al formatear los carbonilos exocíclicos como sustituyentes.

## Corrección

`simplePyridineCarboxylicAcidAnalysis()` valida una envolvente estructural acotada antes de producir nombre: padre piridina aromático registrado de seis miembros, cinco carbonos y un N neutros, uno o dos grupos carboxilo completos y no solapados directamente unidos a C del anillo, cada carbono unido a C=O y C–OH, y ausencia de otros átomos fuera del padre y de los grupos. La comprobación excluye ésteres, amidas, grupos incompletos, sustituyentes adicionales, triácidos y heterociclos distintos.

Se comparan las orientaciones del anillo iniciadas en N y se elige el menor conjunto de localizadores de unión. No se usan IDs, geometría, ni numeración visual del canvas. La salida española usa `ácido piridina-<locantes>-dicarboxílico`; el puente español→OPSIN produce `pyridine-<locantes>-dicarboxylic acid`. Los monoácidos usan `carboxílico` / `carboxylic acid`. El caso B62-I11 ahora produce `ácido piridina-3,5-dicarboxílico` y `pyridine-3,5-dicarboxylic acid`.

La estructura y la gramática de reconstrucción FULL no se ampliaron. `reconcileSystematicName()` sigue sin certificar esos nombres: la molécula permanece PARTIAL. La app ahora presenta evidencia estructural parcial de anillo y carboxilos y declara que los localizadores del nombre no están conciliados; no representa esa evidencia como prueba del nombre.

## Regioisómeros, controles e invariancia

La prueba automática `tests/b621-pyridinedicarboxylic-acids.test.mjs` cubre los seis conjuntos de posiciones distintos: 2,3; 2,4; 2,5; 2,6; 3,4 y 3,5. Comprueba ambos idiomas, la lista de grupos, las uniones reales, la ausencia de sustituyentes carbonados inventados y que ningún caso obtiene una prueba FULL. Controles separados abarcan piridina, monoácido, isopropilo real, diéster, diamida, triácido, ácido bencenodicarboxílico y diazina dicarboxílica. El reconocimiento especial no los rebautiza como diácidos de piridina.

Las invariancias verificadas incluyen las formas aromática/Kekulé equivalentes del caso 3,5, recorridos SMILES alternativos, inversión del orden de átomos y enlaces, renumeración de IDs y rotación del dibujo. Las orientaciones equivalentes conservan el mismo nombre químico y los localizadores funcionales se calculan desde los vecinos del anillo.

## OPSIN local

`scripts/b621-opsin-audit.mjs` contrasta localmente los seis nombres dicarboxílicos y el monoácido con OPSIN 2.9.0 / Temurin 21 instalados fuera del repositorio. Resultado: 7/7 equivalentes, fórmula concordante y sin exigir SMILES textuales iguales. La identidad estructural se compara con OpenChemLib, dependencia compartida con OrgoRush; OPSIN aporta un intérprete de nombre independiente, pero el comparador de grafo no lo es. Esto no certifica PIN ni establece preferencia IUPAC. La evidencia reproducible completa está en [opsin.json](opsin.json).

## Interfaz

`tests/e2e/b62-heterocycle.e2e.mjs` ejecutó Playwright contra Edge 157, motor Chromium real. La app importó el SMILES original, mostró el nombre español e inglés esperado, expuso PARTIAL sin FULL, mostró la limitación de conciliación, conservó los 12 átomos, 12 enlaces y la geometría al cambiar ES↔EN, y no produjo errores de página o consola. Las solicitudes no locales fueron interceptadas y respondidas dentro de la prueba; ninguna respuesta externa aportó un nombre químico. Véase [chromium.json](chromium.json).

## Estado y regresiones

Los criterios y puertas de FULL/PARTIAL/UNSUPPORTED no se cambiaron: la derivación sigue sin prueba FULL y el perfil permanece PARTIAL. La interfaz ahora hace explícita esa evidencia estructural parcial para este nombre local disponible, sin presentar los localizadores del nombre como probados. No hubo cambios en workflows, baselines históricos ni dependencias. La prueba roja preservada pasó sin editar su expectativa química; la nueva regresión está en `tests/*.test.mjs`. La auditoría inicial B6.2 permanece intacta; su resultado posterior a la corrección está separado en este anexo y enlazado desde su README.

## Resultados finales

- Prueba roja preservada: 1/1. Véase [red-check.log](red-check.log).
- Regresión nueva de regioisómeros, controles e invariancia: 3/3. Véase [pyridine-regressions.log](pyridine-regressions.log).
- Regresiones visuales/contextuales, AUDNOM, B6.1 y aspirina/salicílico: 48/48. Véase [focused.log](focused.log).
- Grupo exacto de CI `node --test --test-concurrency=1 --test-shard=3/4 tests/*.test.mjs`: **693/693**, 0 fallos. Véase [shard-3.log](shard-3.log).
- Playwright Chromium real: 1/1. Véase [chromium.json](chromium.json).
- `npm run typecheck`: correcto. Véase [typecheck.log](typecheck.log).
- `git diff --check`: correcto. Véase [diff-check.log](diff-check.log).

No se ejecutó la batería completa fuera de este shard solicitado. No se hizo commit ni push.
