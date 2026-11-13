# B7.5.2 — estabilidad incremental: avance y límites

La auditoría de cierre ha aprobado los escenarios solicitados para cadenas abiertas. La etapa queda lista para revisión y eventual publicación dentro de ese alcance; los límites de estructuras cíclicas y el arrastre de átomos se indican más abajo. No se ha hecho commit ni push.

## Causa y solución

Las vistas reconstruían sus coordenadas desde la cadena elegida para la nomenclatura. Al cambiar esa cadena, los mismos átomos podían pasar de rama a progenitor y recibir nuevas posiciones. El diagnóstico original `tests/b752-parent-change-diagnostic.mjs` mostró el desplazamiento de los ocho átomos anteriores al añadir el noveno.

`app/molecule-2d-layout.ts` conserva ahora una disposición por identidad de átomo para cada una de las dos vistas al añadir manualmente un carbono a un grafo acíclico conectado. La selección del progenitor y los localizadores siguen calculándose a partir del grafo. Los candidatos para el nuevo átomo se contrastan con las posiciones y enlaces anteriores; si se necesita otra dirección local, se registra en la disposición. Los triples conservan la continuación lineal. Para dobles enlaces con configuración definida se verifica la configuración que corresponde al grafo actualizado, sin forzar la letra anterior cuando cambian prioridades CIP.

`app/page.tsx` conecta la operación al editor y conserva los datos de presentación en el historial. La instantánea se invalida al cambiar el grafo o las coordenadas; el reflejo explícito transforma ambas vistas guardadas. Se conservan las correcciones de orientación anteriores de `app/skeletal-layout.ts`. Una falsa colisión entre segmentos colineales separados provocaba una cadena semidesarrollada doblada durante el desarrollo; se añadió una prueba y se corrigió.

La flecha selecciona una dirección de pantalla: anteriormente la propuesta de layout se aceptaba antes de considerar esa dirección. Ahora se buscan candidatos dentro del sector solicitado en ambas vistas, con restricciones de ángulo, colisiones y estereoquímica. Para adiciones a árboles acíclicos, si no hay candidato seguro, la operación se rechaza con un aviso sin modificar el grafo; no se recurre a una reconstrucción global. Las inserciones automáticas de grupos acíclicos se descomponen en adiciones locales y también se rechazan si alguna no puede ubicarse con seguridad. Los casos con anillos conservan el mecanismo anterior.

El interruptor de estereoquímica ahora puede activarse cuando hay un doble enlace capaz de presentar E/Z aunque todavía no tenga configuración asignada. Activarlo no asigna un descriptor; la asignación sigue requiriendo la acción explícita sobre el enlace.

En un caso de cambio CIP se detectó que una prueba anterior podía aceptar una instantánea obsoleta tras el fallback. La corrección impide ese fallback y conserva el lado relativo incluso de los sustituyentes que inicialmente no tienen mayor prioridad. La prueba dirigida verifica que el descriptor cambie cuando realmente cambian las prioridades sin mover los átomos anteriores.

La orientación del grafo importado puede diferir de la de pantalla. Para un carbono de un doble enlace, el editor prueba posiciones internas alternativas y solo acepta una si conserva la dirección visible solicitada, evita colisiones y respeta el lado geométrico de los sustituyentes. En la vista semidesarrollada, si todas las opciones están bloqueadas por un único carbono terminal sin centro estereogénico, se busca el menor ajuste local válido de ese terminal; la disposición y el aviso identifican el ajuste. No se mueven extremos de enlaces múltiples ni ligandos unidos directamente a ellos. La regla de lados de alquenos solo se aplica a C=C: una versión intermedia también la aplicaba a C=O y bloqueaba un ácido; se corrigió y se añadió una regresión específica.

## Regresión histórica y contrato

`tests/e2e/b75-manual.e2e.mjs` intentaba continuar siempre hacia la izquierda después de cambiar de vista y, en algunos casos, exportar y reimportar. En el caso ramificado, el carbono terminal estaba en x=426 y su único vecino en x=284 de la misma línea semidesarrollada. Un nuevo enlace recto hacia la izquierda se superpondría al enlace existente; alargarlo atravesaría el átomo vecino. El comportamiento anterior admitía la operación sin garantizar la dirección visual solicitada.

Se actualizó esa prueba, sin eliminarla: si la izquierda está libre sigue exigiendo la adición; si se rechaza, exige que no cambien átomos ni enlaces, comprueba que el enlace existente ocupa realmente la izquierda y después añade hacia la derecha. En ambos caminos verifica que los enlaces anteriores siguen presentes y que el carbono nuevo aparece en la dirección efectivamente elegida. La regresión completa de sus diez casos aprobó en Edge; también aprobaron por separado los casos ramificado y ácido.

## Comprobaciones

- Cambio de progenitor: prueba automática y construcción real en Edge. En `parent-change-final/results.json` los ocho átomos anteriores mantienen coordenadas en ambas vistas y los siete enlaces anteriores conservan sus extremos y órdenes; se añade únicamente el enlace 8–9.
- La misma secuencia en `parent-history/` comprobó que deshacer y rehacer restauran las coordenadas esqueléticas respectivas.
- En Edge se repitieron casos de dos ramas en carbonos distintos y dos en el mismo carbono (`different-final-retry/` y `same-final-retry/`), con comparación de posiciones y enlaces.
- En `three-branches/` se registró el problema anterior. En `directed-three-final/` se repitió con flechas arriba, abajo y arriba: las tres direcciones se verificaron en ambas vistas, las coordenadas anteriores permanecieron estables tras normalizar la escala automática y se comprobaron los enlaces.
- En Edge se importaron E, Z y un alqueno sin configuración asignada, se añadió un carbono, se compararon ambas vistas y se exportó SMILES. La identidad estructural y estereoquímica resultante coincidió para los tres (`alkenes/`). Son ediciones reales sobre estructuras importadas, no una construcción íntegra de los alquenos desde cero.
- En `built-alkenes/` se construyeron ambos isómeros desde cero, se activó el control sin asignación automática, se asignó explícitamente la configuración y se añadió una rama. Se comprobaron las posiciones en ambas vistas, la dirección de la rama y el SMILES isomérico antes y después.
- En `alkene-endpoints/` se añadieron sucesivamente sustituyentes a ambos extremos de los alquenos E, Z y sin asignar. Se verificaron ambos layouts, enlaces previos y órdenes, así como el SMILES isomérico tras exportación y reimportación. En E, el carbono terminal 6 bloqueaba la trayectoria semidesarrollada y se desplazó localmente con aviso; los demás átomos se conservaron. En Z se rechazó una flecha que coincidía con un enlace y se continuó en la dirección libre. El alqueno sin asignar no adquirió E/Z.
- En `alkene-parent/` se construyó un alqueno Z, se prolongó una rama hasta que pasó al nuevo progenitor y se compararon todas las coordenadas y enlaces anteriores en cada paso. El nombre cambió de `(3Z)-hex-3-eno` a `(3E)-4-etilhept-3-eno`: el cambio de letra corresponde a las prioridades CIP del grafo modificado, no a un giro de los átomos anteriores. Se comprobó el SMILES estereoquímico y deshacer/rehacer en ambas vistas. Una flecha arriba fue rechazada sin cambios y la operación se realizó hacia la derecha.
- `blocked-direction/` verifica en Edge el rechazo seguro de una flecha incompatible con la continuación lineal de un triple enlace. `automatic-acid/` verifica una inserción automática de dos átomos, las dos proyecciones y el SMILES.
- Pruebas automatizadas: cambio de progenitor, ramas sucesivas, historias de construcción distintas, proyecciones, reflejo, invalidación por edición de coordenadas, triples, E y Z y cambio legítimo de prioridades CIP. `tests/b752-incremental-layout.test.mjs` contiene los casos.
- 146 pruebas automatizadas de geometría, construcción, estereoquímica, importación, numeración y colores aprobaron después de los cambios de alquenos. Otras 39 pruebas enfocadas cubrieron valencia, renderizado y exportación. `npm run typecheck` y `git diff --check` aprobaron tras la corrección del carbonilo.
- La regresión de salidas radiales B7.5.1 volvió a aprobar en Edge después de las correcciones finales.

## Límites

La protección incremental cubre adiciones de un átomo y grupos en árboles acíclicos conectados. Las estructuras cíclicas, desconectadas o transformaciones que modifican enlaces previos conservan sus vías anteriores y no cuentan con la misma garantía; las salidas aromáticas B7.5.1 se verificaron mediante su regresión. Una transformación arbitraria de coordenadas invalida la instantánea. El arrastre de átomos no existe en el canvas actual, no fue modificado por B7.5.2 y queda para una mejora independiente. En `directed-distinct-drag/drag-probe.json` el intento real tuvo desplazamiento cero; sí existen controles de arrastre de paneles y plantillas.

El control de estereoquímica inicialmente estaba deshabilitado para un doble enlace estereogénico sin asignar; se corrigió y la prueba posterior de construcción explícita de E y Z aprobó. La auditoría cubre los escenarios representativos indicados, no todas las topologías orgánicas posibles.

Dos pruebas de Edge lanzadas simultáneamente agotaron el tiempo de carga; ambas pasaron al ejecutarlas por separado. Se conservan los resultados y capturas previos, sin reescribir informes históricos. No se hizo commit ni push.
