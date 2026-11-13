# B7.5.1 — salidas aromáticas

## Antes

En el hexágono aromático regular del editor, la adición con la flecha derecha partía de dos candidatos de zigzag, sin incluir la dirección radial. La proyección esquelética conservaba esa dirección si era exterior. En Edge, el coseno entre salida y radial fue 0,816 en los vértices superior e inferior: unos 35° de desviación. El OH añadido desde la biblioteca ya era radial en el vértice superior. Véanse [datos previos](before/results.json) y [auditoría visual](visual-audit.md).

## Corrección

`app/manual-layout.ts` reconoce un hexágono aromático aislado aproximadamente regular por sus seis distancias al centro y sus lados. La primera adición automática de carbono usa la dirección desde el centro al vértice cuando el candidato supera la comprobación existente de colisiones y cruces. Las coordenadas del anillo no se modifican. Los anillos fusionados, deformados o con salida radial obstruida continúan usando la política previa. La regla no depende de números de átomo ni de nombres químicos.

Edge verificó benceno, fenol, un sustituyente en cada extremo y el compuesto con ambos sustituyentes. En esquelética las salidas superior e inferior quedaron verticales; el coseno medido con la radial pasó de 0,816 a 1,000. Los grafos exportados coincidieron estructuralmente con las referencias usando OpenChemLib. Al construir en semidesarrollada, `app/page.tsx` registra la dirección exterior realmente elegida: vertical en los extremos y horizontal hacia fuera en los laterales. Las direcciones manuales de otros tipos de estructura conservan su comportamiento.

También se construyeron por separado salidas en los cuatro vértices laterales: su dirección fue radial y diagonal hacia el exterior en esquelética y horizontal hacia fuera en semidesarrollada. Las pruebas de modelo incluyen rotaciones, reflexiones, IDs distintos, un anillo deformado y un candidato obstruido; los dos últimos conservan el comportamiento anterior. Las cifras de posición se refieren a los vértices geométricos del hexágono inicial: la numeración química visible puede cambiar al añadir un sustituyente.

## Verificación

Pasaron 108 pruebas focalizadas de B7.5, construcción manual, anillos, ambas proyecciones, SMILES, estereoquímica y valencia; también pasaron `npm run typecheck` y `git diff --check`. Edge verificó además anillos reflejados en ambas vistas y repitió el aminoácido aromático de B7.5, incluida su exportación e importación. La política radial automática está limitada a hexágonos aromáticos aislados aproximadamente regulares y a candidatos sin obstrucciones; no regulariza geometrías arrastradas por el usuario ni modifica salidas existentes.
