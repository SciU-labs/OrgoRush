# B7.5.1 — auditoría visual

Antes del cambio se inspeccionaron el [anillo con dos salidas opuestas](before/para-skeletal.png) y su [vista semidesarrollada](before/para-semi.png). Las salidas automáticas de carbono eran diagonales en ambos extremos en esquelética; la semidesarrollada obedecía la dirección solicitada por la flecha. La [captura del fenol](before/fenol-skeletal.png) mostraba ya un OH radial.

Después se inspeccionaron [benceno](final/benzene-skeletal.png), [fenol](../b75/aromatic/fenol-skeletal.png), [salida superior](final/c1-skeletal.png), [salida inferior](final/c4-skeletal.png) y [ambas salidas](final/para-skeletal.png). Las salidas son verticales y el hexágono permanece simétrico, sin colisiones apreciables en estas capturas. La [vista semidesarrollada](final/para-semi.png) también orienta esas dos salidas verticalmente; sus posiciones laterales usan enlaces horizontales hacia fuera. [Mediciones y SMILES](final/results.json).

En la [captura anterior](before/c1-semi.png), el contorno de selección tocaba el indicador de numeración vecino. La [salida vertical posterior](final/c1-semi.png) los separa en ese ejemplo.

Se inspeccionaron asimismo las salidas de los vértices [superior derecho](final/c2-skeletal.png), [inferior derecho](final/c3-skeletal.png), [inferior izquierdo](final/c5-skeletal.png) y [superior izquierdo](final/c6-skeletal.png). Se orientan hacia el exterior; la vista semidesarrollada de los vértices izquierdos dejó de dibujar el grupo dentro del anillo. Las [mediciones y grafos](final/results.json) cubren las dos vistas.

Como regresión de B7.5, se reconstruyó el aminoácido aromático con OH y cadena en posiciones opuestas. Se inspeccionaron la [vista esquelética](../b75/aromatic/aminoacido-skeletal.png) y la [semidesarrollada](../b75/aromatic/aminoacido-semi.png): la cadena sale hacia el exterior. La prueba comparó el grafo exportado con la referencia y volvió a importarlo.

En una ejecución adicional se reflejó el anillo antes de añadir sustituyentes. Se verificaron un extremo, dos posiciones laterales y las dos salidas opuestas en ambas vistas; las direcciones siguieron siendo exteriores y los grafos coincidieron. [Resultados](mirror/results.json) · [ejemplo semidesarrollado reflejado](mirror/c2-semi.png).
