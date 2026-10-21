# UI-BRAND-002 — Unificación de tema y colores del canvas

## Resultado

La paleta principal del canvas y el selector de tema usan azul OrgoRush en el tema claro y una variante azul legible en el oscuro. La cadena principal, la numeración y las selecciones del canvas siguen esos tokens; las ramificaciones conservan el ámbar y los grupos funcionales y distintivos R/S mantienen sus colores separados. El color principal predeterminado de exportación también pasa a azul. No se modificó lógica química, geometría, nomenclatura, layout estructural ni comportamiento.

## Cambios

- `app/globals.css`: tokens azules por tema y alto contraste; selector e icono de tema, rejilla, fondo y borde del canvas, selección/numeración, ayudas visuales y muestra de color principal.
- `app/page.tsx`: valor predeterminado principal de exportación `#4d8c94` → `#3563ff`; la variable CSS del color principal respeta el tema. Las opciones predeterminadas ámbar (`#d5a254`) y funcional (`#8a6ca0`) no cambiaron. La paleta personalizada continúa siendo independiente.

El canvas usa fondo claro `#f8fafc` con puntos azul grisáceo `#d5dff0`; en oscuro, `#101827` con puntos `#33415c`, línea principal `#8fa8ff` y numeración azul más profunda `#3156c7`. Alto contraste conserva el color de alto contraste accesible definido por el tema. Los estados de selección de ramificaciones mantienen el ámbar cuando está activa la codificación por familias.

## Comprobación visual

Se inspeccionó el preview local con una molécula ramificada y centro estereogénico (`CC[C@H](C)O`). En claro y oscuro se distinguieron visualmente la cadena principal azul, la ramificación ámbar, el grupo OH y el indicador S. Se revisaron las vistas esquelética, semidesarrollada y condensada, alto contraste AA, y los viewports 390×844 y 320×800. La vista de alto contraste mantiene su variante accesible. Con el panel SMILES abierto a 320 px se observó desplazamiento horizontal en la composición ya existente; no se alteró el layout, fuera del alcance visual de esta tarea.

## Validación

- `node --test --test-concurrency=1 tests/browser-global-and-png-export.test.mjs tests/feat-semi-stereo-001.test.mjs`: **12 PASS, 0 FAIL, 0 SKIP**, dentro del límite externo de 85 s.
- `npm run build:pages`: PASS. Vite emitió las advertencias ya visibles sobre importación dinámica/estática de `openchemlib-adapter.ts` y chunks mayores de 500 kB; el build terminó correctamente.
- `npm run validate:pages`: PASS (`entries: 3`, `assets: 6`, base `/Hydrocarbon-Lab/`).
- `git diff --check`: PASS.

No se ejecutó la suite completa. La inspección visual fue manual en el preview local; no se guardaron capturas como archivos del repositorio.

## Estado Git al cierre

Base inspeccionada: `ca4d114bab7e047a2c390c9ac1ebcb18a8b3e2b3`, rama `main`. Cambios de esta tarea: los dos archivos de aplicación indicados arriba y este informe. Se conservaron sin modificar los archivos ajenos sin seguimiento `reports/orgorush-aud001-repair.md` y `tatus --short`. No se creó commit ni se hizo push.
