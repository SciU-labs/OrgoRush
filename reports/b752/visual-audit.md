# B7.5.2 — auditoría visual

## Cambio de progenitor

En `before-earlier-branch/` consta la inversión inicial de la presentación al cambiar el sentido de numeración. En `parent-change-final/`, una cadena de seis carbonos recibe una rama y esta se prolonga hasta formar parte del nuevo progenitor. Se compararon coordenadas de los ocho átomos anteriores, en esquelética y semidesarrollada, además de todos los enlaces renderizados y sus órdenes. `results.json` registra los valores; `one-branch.png`, `two-branches.png` y sus equivalentes `-semi` son las capturas. Se inspeccionó la captura semidesarrollada final: la cadena original permanece horizontal y la rama prolongada queda separada.

La primera versión de la corrección produjo una falsa colisión entre enlaces colineales separados, visible en la captura anterior `parent-change-verified/two-branches-semi.png`; el caso se reprodujo en una prueba automatizada y se corrigió antes de `parent-change-final/`.

## Ramas y alquenos

`different-final-retry/` y `same-final-retry/` contienen comparaciones reales al añadir la segunda rama en carbonos distintos y en el mismo carbono. Se comprueban posiciones de todos los átomos anteriores en ambas vistas y los enlaces existentes.

En `three-branches/` se construyó una cadena de ocho carbonos y tres ramas. Se comprobó la estabilidad de coordenadas al añadir las ramas segunda y tercera, normalizando la escala automática al alcanzar once carbonos. Se inspeccionaron `two-branches.png` y `two-branches-semi.png`: aunque se accionaron flechas arriba y abajo, las ramas quedaron del mismo lado en cada vista. Esa ejecución precedió a la corrección de dirección.

Después de la corrección, `directed-three-final/two-branches.png` y `directed-three-final/two-branches-semi.png` se inspeccionaron: las ramas aparecen arriba, abajo y arriba, respectivamente. La prueba comprueba los signos de dirección en ambas vistas, los enlaces y las coordenadas anteriores. `directed-same/` y `directed-distinct-drag/` verifican ramas dirigidas sobre un mismo carbono y sobre carbonos distintos. `directed-parent-history/` verifica el cambio de progenitor junto con deshacer y rehacer.

`alkenes/E-before.png`, `E-after.png`, `E-semi-before.png`, `E-semi.png` y sus equivalentes `Z-*` corresponden a la adición de carbono a alquenos E y Z importados. La prueba comparó las coordenadas anteriores en ambas vistas y la identidad estructural estereoquímica del SMILES exportado. Se inspeccionó `E-after.png`.

Las capturas `unassigned-*` corresponden al alqueno sin configuración asignada. En `blocked-direction/` se registra el rechazo sin modificar un triple enlace y en `automatic-acid/` la inserción automática de dos átomos conservando la estructura anterior.

`built-alkenes/` documenta dos alquenos construidos manualmente: se comprobó que activar estereoquímica no asigna E/Z, se seleccionaron explícitamente ambos isómeros y se añadió una rama manteniendo posiciones en las dos vistas y el SMILES estereoquímico esperado. Se inspeccionó `1-after.png`.

En `alkene-endpoints/` se capturaron ambos extremos para E, Z y sin asignar, antes y después de cada adición. Se inspeccionaron `E-7-semi-before.png` y `E-7-semi.png`: el terminal que ocupaba la trayectoria se desplazó localmente; el resto permaneció fijo. En `Z-8-rejected.png` consta el rechazo de la dirección ocupada; `Z-8-semi.png` muestra la adición posterior en la dirección libre. Los JSON incluyen coordenadas, enlaces, órdenes, rechazos y SMILES, con reimportación comprobada.

En `alkene-parent/` se inspeccionó `9-semi.png`. `results.json` registra los nombres anterior y posterior, la rama que pasa a progenitor, posiciones y enlaces en cada paso y la flecha arriba rechazada antes de elegir derecha. Deshacer y rehacer se comprobaron en ambas vistas.

El intento de arrastrar una rama de `directed-distinct-drag/` no movió el átomo: el canvas no ofrece actualmente esa operación, no se modificó en esta etapa y queda fuera de su alcance.
