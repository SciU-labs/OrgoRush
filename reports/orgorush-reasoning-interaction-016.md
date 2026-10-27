# ORGORUSH-REASONING-INTERACTION-016

## Funcionamiento

Los números de «Cómo se obtiene / How it is derived» son botones cuando el paso activo tiene un objetivo molecular verificable. Una activación por clic, toque, Enter o Espacio muestra un halo temporal en sus átomos y enlaces durante **2000 ms**. Otra activación, incluso sobre el mismo paso, cancela el temporizador anterior y empieza un intervalo nuevo.

El estado visual se identifica por la referencia de la molécula, el idioma, el perfil, el nombre y las evidencias de la explicación activa. Cambiar cualquiera de esos contextos retira el objetivo anterior; cerrar la ayuda o entrar en Practice/Exam también lo desactiva. Los temporizadores se liberan al desmontar. El botón no llama a navegación, scroll, selección de edición ni operaciones del grafo.

## Correspondencias

La resolución usa el `nameRole` del paso y la evidencia de `buildActiveIupacReasoning()`, sin asociar significados fijos a los números ni analizar números dentro de las explicaciones.

| Evidencia del paso | Objetivo visual |
| --- | --- |
| Padre | Átomos de `activeAnalysis.mainChain` y sus enlaces reales, incluido el cierre de un anillo cuando corresponde. |
| Numeración (corregida en 016A) | Solo los carbonos y etiquetas de los localizadores seleccionados con evidencia verificable. Se resuelven mediante `numberedAtoms` o el mapa del padre retenido; no se resaltan enlaces. Si falta evidencia suficiente, el número del paso permanece como texto. |
| Función principal | Átomos de las contribuciones funcionales ya identificadas y sus enlaces. La cetona resalta únicamente C=O. |
| Sustituyentes | Ramas del análisis y enlaces reales de unión al padre; incorpora también evidencia explícita de sustitución sobre nitrógeno. |
| Insaturaciones | Enlaces concretos y extremos de los fragmentos y contribuciones estructurales existentes; se comprueba el orden doble/triple. |
| E/Z con evidencia explícita | Enlace estereogénico y sus dos extremos identificados por el modelo existente. |

Todos los IDs y pares de enlace se validan contra la molécula activa. Una referencia inexistente o incompatible invalida el objetivo completo, evitando resaltados parciales engañosos.

## Casos sin correspondencia segura

Los pasos sin un rol estructural y sin evidencia suficiente conservan su número como texto. Esto incluye explicaciones contextuales, orden alfabético sin un mapeo explícito y estereoquímica R/S cuando el paso no ofrece evidencia estructural enlazable. No se inventa una región a partir del título, los números o el nombre completo.

Los nombres externos y las estructuras que ya carecen de evidencia local fiable siguen las restricciones actuales del razonamiento. La interacción no añade soporte químico ni crea un segundo analizador.

## Renderizado y accesibilidad

- Vistas esquelética y semidesarrollada: capa SVG con halos de enlace, anillos de átomo y etiquetas temporales de localizadores.
- Vista condensada: se usan los IDs de sus tokens existentes para marcar átomos y enlaces; el modelo condensado no cambia. Se conserva el alcance del renderer actual: por ejemplo, las estructuras cíclicas siguen sin admitir esta vista.
- Halos ámbar con colores para modo claro y oscuro. Los colores químicos originales permanecen debajo de la capa visual.
- Botones nativos de 44 × 44 px, foco visible, etiquetas ES/EN que anuncian el paso y los dos segundos, y `aria-pressed` durante su activación.
- Las capas gráficas usan `pointer-events="none"` y `aria-hidden="true"`; no interfieren con la edición ni duplican información para lectores de pantalla.
- Con `prefers-reduced-motion: reduce`, el halo permanece estático durante los mismos dos segundos.
- Todas las marcas temporales llevan `data-editor-only="true"`, ya excluido del cálculo de límites y la limpieza de exportaciones SVG/PNG. No se guardan en la molécula, el historial ni SMILES.

La navegación existente desde fragmentos del nombre hacia la explicación mantiene sus temporizadores y desplazamiento propios. El botón de un paso usa un controlador independiente y no provoca ese desplazamiento.

## Archivos

- `app/reasoning-visual-targets.ts`: proyección de objetivos, validación contra el grafo y temporizador de 2000 ms.
- `app/reasoning-visual-interaction.tsx`: estado temporal con comprobación de contexto, botones accesibles y capa SVG.
- `app/page.tsx`: integración con el modelo activo y el canvas del laboratorio; bloqueo en Practice/Exam.
- `app/condensed-renderer.tsx`: capas temporales sobre los tokens existentes.
- `app/globals.css`: tamaño y foco de los botones, halos con temas y movimiento reducido.
- `tests/orgorush-reasoning-interaction-016.test.mjs`: regresiones específicas.

## Pruebas originales (016, anteriores a 016A)

### Dirigidas

`node --test --test-concurrency=1 tests/orgorush-reasoning-interaction-016.test.mjs`: **12/12 aprobadas**. Cubren padre acíclico/cíclico, metilo, dos sustituyentes, cetona, dobles y triples, E/Z, sustitución sobre N, perfiles 2013 y Legacy ES/EN, renumeración de IDs, evidencia inválida, temporizadores superpuestos, reinicio del mismo paso, limpieza a los 2000 ms, cambio de contexto, desmontaje, botones nativos y las tres vistas.

Las pruebas ejecutan el motor y los componentes de producción. Los temporizadores se comprueban con el reloj simulado de Node. Para el hook se sustituye únicamente la planificación de React por un anfitrión determinista, siguiendo la convención de las pruebas de `difficulty-selector`; no se copia la lógica del controlador ni la química.

Las 18 baterías relacionadas de razonamiento, navegación, temas, teclado y renderizado terminaron con **213/213 aprobadas**, sin fallos ni omisiones. Incluyen `reasoning-*`, `iupac79-reasoning-007`, `ui-brand-004-reasoning-theme`, renderizado y layout condensado/semidesarrollado, geometría esquelética y teclado.

### Comprobación en navegador

Sobre el artefacto de Pages se cargó `CCC(=O)CC(C)CC` mediante la interfaz SMILES:

- Enter sobre el paso funcional resaltó los dos átomos del carbonilo y su enlace C=O.
- Espacio activó el mismo comportamiento; activar después sustituyentes reemplazó la región por la rama metilo y su unión.
- Tras el intervalo desaparecieron las marcas. El nombre `5-metilheptan-3-ona`, la selección de edición y el `viewBox` permanecieron iguales.
- Una segunda activación del botón visible mantuvo el desplazamiento de página y el encuadre del canvas.
- Padre y numeración proyectaron siete átomos y seis enlaces en las vistas esquelética y condensada. Con la numeración permanente desactivada se mostraron siete localizadores temporales.
- Cambiar idioma o perfil eliminó inmediatamente las marcas anteriores. Legacy EN resaltó el carbonilo conservando `5-methyl-3-heptanone`.
- Al abrir Practice no quedaron capas activas ni botones de razonamiento visibles.

### Comprobaciones de entrega

- `npm run typecheck`: **aprobado**.
- `npm run build:pages`: **aprobado**.
- `npm run validate:pages`: **aprobado**, con tres entradas, seis assets y base `/Hydrocarbon-Lab/`.
- `npm test`: **corrida única completada**, con **3131 pruebas: 3126 aprobadas, 0 fallidas, 5 omitidas, 0 canceladas**; código de salida **0**. Incluye el build verificado y las regresiones de FIX-015 y de integridad histórica de VALIDATION-014. Duración informada: **3 738 340.5899 ms**.
- `git diff --check`: **aprobado**. La comparación contra `HEAD` confirma que los seis artefactos históricos de VALIDATION-014 y el informe y las regresiones de FIX-015 no tienen diferencias.

El build informa los avisos existentes sobre tamaño de chunks e importación dinámica/estática de OpenChemLib; no bloquean el artefacto.

## Alcance preservado

No se cambian algoritmos de nomenclatura, nombres químicos, reglas IUPAC, datos moleculares, selección de edición, undo/redo ni persistencia para generar los efectos. No se añaden dependencias. VALIDATION-014 y los artefactos de FIX-015 permanecen sin modificaciones. No se ejecutó una nueva auditoría química ni se hizo commit o push.

## Corrección localizada 016A — 27 de octubre de 2026

El objetivo original de Numbering compartía `addRegion(analysis.mainChain)` con Parent chain. Esto iluminaba toda la cadena y generaba etiquetas para todos sus localizadores. La expectativa de la primera prueba también reproducía ese error; las comprobaciones originales de siete átomos bajo Numbering documentadas arriba quedan sustituidas por esta corrección.

Ahora Parent chain conserva exactamente su región y sus enlaces. Numbering usa `numberingComparison.selectedLocants` cuando la función principal resuelve la comparación. En los demás casos utiliza los IDs/localizadores estructurados de los fragmentos de numeración o sus listas de localizadores, verificando su posición literal en el nombre activo y su correspondencia inequívoca con el mapa del padre. No lee números del texto explicativo. Los IDs resultantes deben pertenecer a carbonos reales del padre; `bondIds` queda vacío. No hay alternativa automática de cadena completa.

Resultados verificados en 2013 ES/EN y Legacy ES/EN:

- `3-metilhexano`: únicamente C3 y su etiqueta.
- `5-metilheptan-3-ona`: únicamente C3, seleccionado por la comparación funcional; no se usa C5 de la orientación descartada.
- Dos sustituyentes con localizadores 2 y 4: únicamente esos dos carbonos y etiquetas.
- Evidencia ausente, localizador inexistente o mapa ambiguo: sin botón de Numbering.
- Renumeración de IDs, las tres vistas y activaciones sucesivas: se conserva el objetivo químico y la retirada a los 2000 ms.

Validación de 016A: la prueba actualizada falló antes del cambio (6 fallos que exponían el resaltado completo) y después aprobó **15/15**. Las regresiones relacionadas de fragmentos, jerarquía, perfiles, navegación y renderer condensado aprobaron **48/48**. `npm run typecheck` y `git diff --check` aprobaron. No se ejecutó `npm test`, ningún build ni una nueva auditoría química para esta corrección. Los resultados de la suite general indicados en el apartado original corresponden exclusivamente a la entrega 016.

Archivos de esta corrección: `app/reasoning-visual-targets.ts`, `app/page.tsx` (solo transmite el nombre activo para verificar los fragmentos), `tests/orgorush-reasoning-interaction-016.test.mjs` y este informe. No se modifican los textos explicativos, los motores IUPAC, los renderers, la accesibilidad ni el controlador de temporizadores.
