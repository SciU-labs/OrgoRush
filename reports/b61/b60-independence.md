# Auditoría de independencia de B6.0

Se leyeron README.md, matrix.md, architecture-before.md y el fixture completo de las 24 estructuras. Se contrastó su recorrido con las pruebas y los módulos de producción. Las cifras históricas siguen siendo 28/30 perfiles FULL, 24 estructuras construidas, 48 positivos, 1.104 cruces negativos, 299 pruebas y 14 casos Chromium/408 activaciones. Su valor es de regresión y consistencia dentro de cobertura; no estiman precisión química general.

## Inventario de los 48 nombres esperados

Los grafos proceden de SMILES escritos manualmente después de las reglas de B6.0; cada fórmula y los dos nombres se escribieron en el fixture. No fueron recuperados de una fuente química externa y no son respuestas OPSIN. El fixture no invoca al generador para fabricar expectativas. El importador OCL construye el grafo editable; el comparador normaliza aromaticidad con el mismo OCL. La estereoquímica está ausente.

| ID | Familia | ES esperado | EN esperado | Fórmula | SMILES |
|---|---|---|---|---|---|
| B60-G01 | aldehyde | 2-metilbenzaldehído | 2-methylbenzaldehyde | C8H8O | O=Cc1c(C)cccc1 |
| B60-G02 | aldehyde | 3-etilbenzaldehído | 3-ethylbenzaldehyde | C9H10O | O=Cc1cc(CC)ccc1 |
| B60-G03 | aldehyde | 4-(2-metilpropil)benzaldehído | 4-(2-methylpropyl)benzaldehyde | C11H14O | O=Cc1ccc(CC(C)C)cc1 |
| B60-G04 | ester | 2-etilbenzoato de metilo | methyl 2-ethylbenzoate | C10H12O2 | COC(=O)c1c(CC)cccc1 |
| B60-G05 | ester | 3-metilbenzoato de etilo | ethyl 3-methylbenzoate | C10H12O2 | CCOC(=O)c1cc(C)ccc1 |
| B60-G06 | ester | 4-etilbenzoato de propilo | propyl 4-ethylbenzoate | C12H16O2 | CCCOC(=O)c1ccc(CC)cc1 |
| B60-G07 | amine | 2-etilanilina | 2-ethylaniline | C8H11N | Nc1c(CC)cccc1 |
| B60-G08 | amine | 3-propilanilina | 3-propylaniline | C9H13N | Nc1cc(CCC)ccc1 |
| B60-G09 | amine | 4-(1-metiletil)anilina | 4-(1-methylethyl)aniline | C9H13N | Nc1ccc(C(C)C)cc1 |
| B60-G10 | amide | 2-etilbenzamida | 2-ethylbenzamide | C9H11NO | NC(=O)c1c(CC)cccc1 |
| B60-G11 | amide | 3-propilbenzamida | 3-propylbenzamide | C10H13NO | NC(=O)c1cc(CCC)ccc1 |
| B60-G12 | amide | 4-(2-metilpropil)benzamida | 4-(2-methylpropyl)benzamide | C11H15NO | NC(=O)c1ccc(CC(C)C)cc1 |
| B60-G13 | nitrile | 2-etilbenzonitrilo | 2-ethylbenzonitrile | C9H9N | N#Cc1c(CC)cccc1 |
| B60-G14 | nitrile | 3-propilbenzonitrilo | 3-propylbenzonitrile | C10H11N | N#Cc1cc(CCC)ccc1 |
| B60-G15 | nitrile | 4-(1-metiletil)benzonitrilo | 4-(1-methylethyl)benzonitrile | C10H11N | N#Cc1ccc(C(C)C)cc1 |
| B60-G16 | cyclic-alcohol | 2-etilciclopentanol | 2-ethylcyclopentanol | C7H14O | OC1C(CC)CCC1 |
| B60-G17 | cyclic-alcohol | 3-metilcicloheptanol | 3-methylcycloheptanol | C8H16O | OC1CC(C)CCCC1 |
| B60-G18 | cyclic-alcohol | 2,3-dimetilciclohexanol | 2,3-dimethylcyclohexanol | C8H16O | OC1C(C)C(C)CCC1 |
| B60-G19 | cyclic-ketone | 3-etilciclopentanona | 3-ethylcyclopentanone | C7H12O | O=C1CC(CC)CC1 |
| B60-G20 | cyclic-ketone | 2-propilcicloheptanona | 2-propylcycloheptanone | C10H18O | O=C1C(CCC)CCCCC1 |
| B60-G21 | cyclic-ketone | 2,4-dimetilciclohexanona | 2,4-dimethylcyclohexanone | C8H14O | O=C1C(C)CC(C)CC1 |
| B60-G22 | cyclic-enone | 3-metilciclopent-2-en-1-ona | 3-methylcyclopent-2-en-1-one | C6H8O | O=C1C=C(C)CC1 |
| B60-G23 | cyclic-enone | 4-etilciclohex-2-en-1-ona | 4-ethylcyclohex-2-en-1-one | C8H12O | O=C1C=CC(CC)CC1 |
| B60-G24 | cyclic-enone | 2,4-dimetilciclohept-2-en-1-ona | 2,4-dimethylcyclohept-2-en-1-one | C9H14O | O=C1C(C)=CC(C)CCC1 |

## Reglas y dependencia entre comprobaciones

| Grupo | Casos | Reglas ejercitadas |
|---|---|---|
| Aromáticos con sufijo | G01–G15 | Progenitor retenido, grupo de sufijo, posición orto/meta/para y radical simple o ramificado; ES/EN directos. |
| Alcoholes/cetonas cíclicos | G16–G21 | Función en C1, sentido del anillo, conjunto menor de localizadores y radicales/multiplicadores. |
| Enonas cíclicas | G22–G24 | Sufijo cetona, enlace C=C del anillo y desempate de orientación antes de los prefijos. |


* evaluate.mjs expone el generador y la selección de nombres que usa la aplicación. Sus salidas son observaciones del sistema, nunca expectativas químicas independientes.
* systematic-family-grammar.ts recibe un nombre y construye FamilyGraph sin llamar a analyzeMolecule. Después validated-name-derivation.ts compara ese grafo con el original mediante structural-derivation.ts. Es separación arquitectónica útil, pero pertenece al mismo producto: comparte tipos, tablas históricas de fragmentos/radicales y normalización OCL. No equivale a OPSIN.
* compositional-name-model.ts comparte tipos y funciones puras de comparación de localizadores; no es una segunda autoridad normativa. En B6.1 se agrega allí la comparación de todos los orígenes para anillos libres.
* Las expectativas FULL del fixture son decisiones de cobertura del autor. Las fórmulas y los SMILES escritos aparte reducen circularidad, pero no convierten estos pares en un corpus externo ni muestreado antes de la gramática.
* Los 1.104 cruces comparan cada nombre contra otros grafos del mismo corpus. Son controles de no equivalencia interna y de rechazo, no 1.104 nombres externos nuevos.
* El E2E B6.0 obtiene los blancos visuales esperados con reconcileSystematicName y buildValidatedPriorityReasoning, las mismas funciones que alimentan la interfaz. Es una prueba válida de proyección DOM, accesibilidad, idioma y geometría; reutiliza el algoritmo del producto como oráculo de selección y no demuestra la corrección química de ese algoritmo.

No se descartan estas pruebas. Se rebaja la interpretación de independencia. La nueva ejecución conserva los 48 FULL internos del corpus construido y los 28 FULL/2 bloqueos históricos; véase final.json. Ninguno se promociona automáticamente a FV por esos resultados.
