# Prueba roja B7.3

Antes de modificar producción se congeló el corpus y se ejecutó `node --test tests/b73-nn-dialkyl.test.mjs`. El nombre `N,N-dimetilbenzamida` no devolvía derivación composicional: el estado obtenido era `undefined`, frente a `FULL` requerido para el grafo neutro `CN(C)C(=O)c1ccccc1` una vez implementada la nueva familia. El resultado literal se conserva en [red-initial.log](red-initial.log).

No se impuso FULL para estructuras fuera del alcance: se requiere interpretar por separado los dos enlaces N–C, demostrar valencia y comparar el grafo reconstruido completo. La línea base original está en [baseline.json](baseline.json).
