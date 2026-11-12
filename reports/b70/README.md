# B7.0 — prefijos halógenos en padres aromáticos funcionales

## Diagnóstico

Base: `cb9df71` (B6.4.1). Los nombres y análisis locales de los tres casos ya eran correctos; no se cambió el generador. La gramática independiente de padres aromáticos retenidos ya sabía agrupar multiplicadores, construir otros prefijos y comparar las dos orientaciones del anillo, pero rechazaba `kind: halogen`, aunque la tabla de fragmentos ya contenía F, Cl, Br e I. Por ello la prueba de nombre a grafo devolvía `null` y la interfaz conservaba PARTIAL. La prueba inicial B7 falló en los tres casos ES; el control negativo permaneció correcto.

| Caso | Nombre ES / EN | Función y sustituyentes | Resultado actual |
|---|---|---|---|
| B61-I20 | 3,5-dicloro-2-etoxibenzaldehído / 3,5-dichloro-2-ethoxybenzaldehyde | aldehído; Cl en 3 y 5, etoxi en 2 | FULL ES y EN |
| B61-I06 | 3,4-difluorobenzonitrilo / 3,4-difluorobenzonitrile | nitrilo; F en 3 y 4 | FULL ES y EN |
| B62-I17 | 4-clorobenzamida / 4-chlorobenzamide | amida; Cl en 4 | FULL ES y EN |
| B61-I18 | 1,3,5-trimetil-2,4-dinitrobenceno / 1,3,5-trimethyl-2,4-dinitrobenzene | sin función de sufijo | fuera de la ampliación; el parser composicional acotado lo rechaza |

Las cifras y estados históricos de B6 se mantienen en sus matrices originales; no se recalculan ni sobrescriben. El nombre correcto, la evidencia de reglas, FULL y un PIN certificado son afirmaciones distintas.

## Construcción y barreras

`app/systematic-family-grammar.ts` permite halógenos de la tabla compartida únicamente en el constructor de padres aromáticos con función o éster ya admitidos. Se reconstruye un átomo de halógeno por localizador, con su enlace al carbono numerado. La comprobación de multiplicidad, posiciones distintas, orden alfabético sin di-/tri-, delimitadores y comparación de orientaciones sigue siendo obligatoria. Se mantiene la restricción del resto de funciones de anilina, admitiendo halógenos y éteres. El constructor de anillos sin sufijo y el de ciclos alifáticos no se ampliaron.

El flujo continúa siendo grafo de entrada → análisis y nombre local ES/EN → interpretación literal independiente del nombre → construcción de un nuevo grafo y comprobación de numeración → isomorfismo completo y proyección de átomos/enlaces originales → controles. La evidencia conserva P-59.2.5 y la sección del progenitor retenido registrada por el código; sus fuentes se detallan en B6.0. El comparador comprueba conectividad, órdenes, elementos y carga y conserva los rechazos de estereoquímica/isótopos no admitidos. `preferred` sigue en `false`. La explicación española deja de afirmar numeración interna para un halógeno o una rama sin evidencia de numeración interna.

Los fragmentos agrupados seleccionan todos los átomos y enlaces del prefijo multiplicado; cada locante escrito selecciona el carbono correspondiente. En el para-sustituido B62-I17 las dos orientaciones son equivalentes: el canvas muestra los anclajes inequívocos 1 y 4 y no inventa una orientación visual para 2, 3, 5 y 6. La prueba interna completa puede usar una asignación representativa sin mezclar orientaciones.

## Verificación

- `tests/b70-aromatic-compositional.test.mjs`: siete pruebas aprobadas; ES/EN, identidad, función, literales, proyección, permutaciones de IDs y enlaces, rotación, SMILES exportado/reimportado, tres estructuras adicionales y 30 distribuciones posibles para el caso principal, con una sola aceptada. Rechaza multiplicidades erróneas, orden no válido, posiciones duplicadas, grafos alterados, cambio de halógeno/carga/isótopo/estereoquímica y nombres fuera de alcance.
- `scripts/b70-opsin-check.mjs`: OPSIN local 2.9.0 reconstruyó las tres denominaciones inglesas y sus grafos coincidieron con los fixtures, incluida la composición. Los SMILES obtenidos fueron `ClC=1C(=C(C=O)C=C(C1)Cl)OCC`, `FC=1C=C(C#N)C=CC1F` y `ClC1=CC=C(C(=O)N)C=C1`. El comparador de identidad usa OpenChemLib también para importar la referencia; OPSIN es un intérprete independiente, no una certificación PIN.
- Regresiones focalizadas B5.2, B5.4–B5.5, B6.0, B6.1, B6.2.1 y B6.4.1: 121/121. Tras el ajuste de explicación se repitieron B6.0, B6.4.1 y B7: 27/27. No se ejecutó la batería completa.
- VALIDATION-008, VALIDATION-014, numeración visual y adaptador de razonamiento: 100/100; incluyen V008-072, aspirina, ibuprofeno, paracetamol y el control de frontera TNT. Una prueba adicional verifica que la generación local de ibuprofeno sigue bloqueada.
- Playwright con Edge local importa los tres fixtures en la aplicación, usa el generador y la reconciliación reales, prueba ES→EN→ES→EN, nombres, estado FULL, controles y comparación exacta de sus átomos, enlaces y localizadores, geometría, consola y red. Las búsquedas externas opcionales se aislaron. En una ejecución previa, la expectativa de numeración completa en B62-I17 no respetaba la simetría; se corrigió para comprobar los anclajes reales y la ausencia de números ambiguos. Otra repetición registró una solicitud opcional del metano inicial cancelada; se volvió a ejecutar aisladamente sin desactivar el control de red.
- La ejecución final de Edge 157 aprobó 3/3 casos y 66 activaciones; el detalle está en [e2e/results.json](e2e/results.json).
- `npm run typecheck` y `git diff --check`: correctos.

No se añadieron dependencias, excepciones por molécula, ni acceso remoto a OPSIN. No se alteraron el bloqueo local de ibuprofeno, los workflows, los baselines o la arquitectura de Pages. Esta ampliación no cubre todos los sustituyentes posibles, los bencenos polisustituidos sin sufijo, ni constituye un motor universal.
