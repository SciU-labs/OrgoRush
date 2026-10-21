# ORGORUSH-UI-BRAND-004 — «Cómo se obtiene»

## Resultado y archivos

La derivación reutiliza la identidad azul de OrgoRush en claro y oscuro y la
variante accesible del sistema global en alto contraste. Se preservan el texto,
los pasos, los perfiles IUPAC y sus interacciones.

- `app/globals.css`: única modificación de aplicación; colores, alias locales y
  estados visuales del panel y de las referencias del nombre que conducen a él.
- `tests/ui-brand-004-reasoning-theme.test.mjs`: siete pruebas de tokens,
  sobrescrituras y contraste de la paleta por tema/estado.
- Este informe.

Base de revisión: `3e39b37`. El árbol estaba limpio al comenzar esta tarea.
No se modificaron TS/TSX, traducciones, algoritmos, datos moleculares ni eventos.
No se creó commit ni se realizó push.

## Auditoría de colores y correcciones

| Elemento | Herencia encontrada | Corrección |
| --- | --- | --- |
| Fragmentos, sustituyentes, sufijos y locantes | `--mint-strong`: `#1d806e` / `#68c4aa` | `--brand-selected-ink`, azul legible por tema |
| Etiquetas de fragmentos | `--muted` global: `#63746f` / `#9bada7` | Alias `--muted` local al panel: `--brand-muted` en claro y el neutro oscuro ya usado por el encabezado |
| Fondos de controles de fragmentos | `--paper` global: blanco / verde oscuro `#172521` | Alias `--paper` local: `--brand-surface` / `--brand-toolbar` |
| Bordes de esos controles | `--line`: `#dce6e2` / `#30443f` | `--brand-selected-ink` |
| Foco de fragmentos | `--blue`, cuyo valor era verde azulado `#266b78` / `#79b7c0` | `--brand-selected-ink` |
| Enlaces desde el nombre a los pasos | Subrayado `#87d8be`; hover/active/focus `#b9ffdf` | `--orgorush-structure-main` para subrayado/foco y `--brand-surface` para el texto sobre el dock oscuro |
| Padre en oscuro | Sobrescritura literal `#9bb4ff` | El mismo token `--brand-selected-ink` que las demás contribuciones |
| Paso activo | Texto secundario sobre el fondo azul suave: 4,4489:1 en claro | Usa `--ink` dentro del paso activo; conserva el fondo `--brand-primary-soft` |

El contenedor, encabezado, numeradores y botón de mostrar/ocultar ya utilizaban
en gran parte los tokens de OrgoRush. Se unificaron sus alias de texto/superficie
para que las reglas oscuras y de alto contraste no recuperasen colores antiguos.
Los valores oscuros `#f8fafc` y `#aebbd0` ya existían en este componente; ahora
se comparten mediante los alias locales existentes `--ink` y `--muted`.
No se inventó una nueva paleta ni se alteraron tokens globales.

Los SVG del ojo usan `currentColor`. El panel no tiene gradientes de marca;
las transparencias del halo de enlace pertenecen a la selección química.
El ámbar/naranja que vincula una contribución con el enlace del canvas se
conserva. En alto contraste, su borde usa `--amber`, evitando el amarillo oscuro
sobre blanco. Los indicadores globales de éxito y otros paneles no se recolorean.

Alto contraste conserva deliberadamente sus tokens globales, incluido
`--brand-selected-ink: #074f66`; no se reemplaza la paleta accesible global.
Las referencias conservan además subrayado sólido al activarse y foco visible,
y el paso conserva el subrayado de sus fragmentos: el estado no depende solo
del color.

## Revisión en navegador

Preview local con `CC(C)=CC(=O)O`, nombre actual y Legacy, español e inglés.
Se revisaron escritorio 1280×720 y móviles 390×844 y 320×800. El tamaño temporal
del navegador se restableció al terminar; también se restauraron ES, perfil
actual, tema automático y alto contraste desactivado.

Se midieron los estilos calculados del texto contra su fondo efectivo, incluidos
pasos activos, fragmentos, etiquetas y controles. Resultados mínimos observados:

| Modo | Contraste mínimo de texto | Foco verificado |
| --- | ---: | --- |
| Claro | 4,7547:1 | Controles: 7,7481:1; enlace del dock: 3,7001:1 |
| Oscuro | 7,2331:1 | Enlace del dock: 3,7001:1 |
| Alto contraste sobre oscuro | 9,0545:1 | Control y fragmento: 9,0545:1 |

La prueba de paleta también comprueba alto contraste sobre claro y oscuro.
Se usan los umbrales de [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
y [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast):
4,5:1 para el texto probado y 3:1 para indicadores de foco/bordes de controles.
Esto es una comprobación dirigida de contraste, no una certificación WCAG de
toda la aplicación.

Comprobaciones funcionales observadas:

- Mostrar/ocultar por teclado conserva `aria-expanded` / `aria-hidden` y el
  contenido químico exacto antes y después de volver a abrir.
- Las referencias del nombre activan el paso correspondiente.
- Seleccionar `2-en` mantiene `aria-pressed`, el foco y el halo del enlace.
- Legacy EN conserva sus fragmentos separados `2` / `en` y el nombre
  `3-methyl-2-butenoic acid`; el perfil actual ES conserva
  `ácido 3-metilbut-2-enoico` y la fórmula C₅H₈O₂.
- No hubo desbordamiento horizontal dentro del componente en las vistas probadas.

Las capturas y mediciones están en el directorio ignorado
`outputs/ui-brand-004/`: `light-desktop.png`, `dark-desktop.png`,
`high-contrast-desktop.png`, sus variantes móviles y `browser-audit.json`.
Las tres capturas completas de escritorio se inspeccionaron visualmente.

## Pruebas y compilación

Ejecución final en serie: **125 PASS, 0 FAIL, 0 SKIP**, en nueve archivos:

```text
tests/ui-brand-004-reasoning-theme.test.mjs
tests/reasoning-hierarchy.test.mjs
tests/reasoning-name-fragments.test.mjs
tests/reasoning-name-navigation.test.mjs
tests/reasoning-nom004-profile.test.mjs
tests/reasoning-functional-group-coverage.test.mjs
tests/iupac79-polycyclic-002.test.mjs
tests/guided-tour.test.mjs
tests/browser-global-and-png-export.test.mjs
```

Comando: `node --test --test-concurrency=1` con los nueve archivos indicados.
Log: `outputs/ui-brand-004/targeted-serial.log`.
El primer intento con concurrencia 2 dentro del aislamiento se abortó después
de timeouts de transporte de Vite de 60000 ms en la carga SSR de los hooks.
Ese intento no se contabiliza como verde. La ejecución final de las mismas
pruebas, en serie fuera del aislamiento de red, terminó correctamente sin
modificar límites ni aserciones químicas.

- `npm run build:pages`: PASS.
- `npm run validate:pages`: PASS; 3 entradas, 6 assets.
- `scripts/build-verified.sh` desde Git Bash: PASS; Worker ESM y manifest de
  hosting validados. Se conservan las advertencias de herramientas en los logs.
- ESLint del archivo nuevo: PASS, sin errores ni advertencias.
- `git diff --check`: PASS; Git solo avisa de la conversión habitual LF/CRLF.
- Comparación PostCSS con HEAD, normalizando finales de línea y desglosando
  selectores compartidos: **2394 contextos de selectores ajenos a la derivación,
  0 declaraciones cambiadas**. Incluye los estilos de `footer`, separados de
  reglas que antes compartían selector con la derivación. Script reproducible y
  resultado: `outputs/ui-brand-004/audit-css-scope.mjs` / `css-scope-audit.json`.

## Límites

No se ejecutó la suite completa: se ejecutaron las 125 pruebas dirigidas y ambas
compilaciones. La inspección visual corresponde al navegador disponible y a los
tamaños indicados; no se hizo una matriz de todos los navegadores ni de todos los
widgets de accesibilidad. La migración de otros paneles y de la paleta global de
alto contraste queda fuera de esta tarea. No queda una limitación funcional
conocida introducida por este cambio visual.
