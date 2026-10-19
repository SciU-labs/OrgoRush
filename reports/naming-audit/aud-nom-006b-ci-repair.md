# AUD-NOM-006B — reparación de regresión de éter complejo

## Resultado

La regresión de CI para `CC(C)OCCCC` queda corregida en la traducción léxica inglesa. La salida 2013 ES sigue siendo `1-(1-metiletoxi)butano`, y la salida inglesa es `1-(1-methylethoxy)butane`. No se cambió la nomenclatura química, el perfil Legacy, la evidencia funcional ni la estructura molecular.

## Causa raíz

La prueba fallaba porque `translateSpanishAlkylMorphemes` traducía el sustituyente interno `metil` a `methyl`, pero la regla general de alcoxi solo reconoce un prefijo en un límite léxico. En `1-metiletoxi`, la raíz `etoxi` está pegada a `metil`; por eso el traductor producía `1-methyletoxi`. `functionalNameEvidence` busca evidencia literal en el nombre inglés mostrado y no podía asociar ese texto parcial con el fragmento funcional completo `1-methylethoxy`. La aserción fallida reflejaba una pérdida real de correspondencia interactiva, no una falta de contenido explicativo.

## Corrección y cobertura

Se añadió una regla acotada para la construcción completa `localizador + raíz alquilo + il + raíz alcoxi + oxi`, con raíces tomadas de `IUPAC_ROOTS`. Se aplica antes de separar los morfemas y acepta el cierre de paréntesis como límite del fragmento. Convierte, por ejemplo, `1-metiletoxi` en `1-methylethoxy`; no reemplaza subcadenas arbitrarias ni cambia la evidencia de `functionalNameEvidence`.

La regresión existente de éteres verifica en ambos idiomas el nombre, la coincidencia literal del fragmento, procedencia del grupo éter, átomos asociados, destino de navegación, reconstrucción completa del nombre y grafo sin cambios. La prueba de morfología ahora incluye el nombre español completo y su salida inglesa. Sus casos vecinos AUDCASE-0160 y AUDCASE-0337 continúan comprobando ethenyl y pentyloxy, junto con perfiles Legacy y español sin cambios.

## Validación

Cada proceso Node de prueba se ejecutó bajo un límite externo real de 85 segundos que mata el árbol de procesos al vencer.

| Comando | Resultado | Tiempo real |
|---|---:|---:|
| `node --test tests/ether-nomenclature.test.mjs` | 15 PASS, 0 FAIL, 0 SKIP | 16.09 s |
| `node --test tests/audnom006-english-morphology.test.mjs` | 3 PASS, 0 FAIL, 0 SKIP | 12.37 s |
| `npm run build:pages` | Correcto | 7.46 s |
| `npm run validate:pages` | Correcto; 3 entradas, 6 recursos, base `/Hydrocarbon-Lab/` | 2.74 s |

El build emitió advertencias de importación dinámica redundante y tamaño de bundle; terminó correctamente. No se ejecutó la suite global.

## Archivos de esta reparación

```text
app/iupac-name-normalization.ts
tests/audnom006-english-morphology.test.mjs
reports/naming-audit/aud-nom-006b-ci-repair.md
```

No se modificó el informe histórico de AUD-NOM-006 ni se hicieron commit o push.
