# B6.4.1 — prefijo sistemático de tres carbonos

## Diagnóstico y cambio

La prueba roja y el análisis del fixture están en [red-inicial.md](red-inicial.md). El recorrido de `nameSubstituent` iniciaba cada ruta en el carbono de unión, elegía la ruta de dos carbonos con doble enlace y trataba el tercer carbono como metilo en C1. Ahora reconoce por conectividad una componente acíclica de tres carbonos, unida al padre por enlace simple desde el carbono central, con dos extremos terminales unidos a ese centro mediante enlaces doble y simple. Esa cadena se numera desde el extremo del doble enlace: C1=C2–C3 y unión al padre por C2. No se consulta CID ni nombre previo. La regla es específica de esa conectividad, no una selección general para todas las ramas insaturadas.

`app/page.tsx` genera `prop-1-en-2-il` con los tres átomos y el doble enlace reales; el traductor morfológico existente genera `prop-1-en-2-yl`. La selección de ruta previa podía omitir un enlace múltiple situado entre la ruta y una rama; ahora se marca como no compatible en vez de nombrar ese grupo como saturado. Esto cambia deliberadamente la barrera de ese caso insuficientemente representado, sin ampliar soporte.

`app/systematic-family-grammar.ts` interpreta ambas grafías mediante un grafo separado enraizado en el átomo de unión, registra la numeración interna C1/C2/C3 y la evidencia literal de la insaturación. `app/reasoning-derivation-adapter.ts` proyecta ambos localizadores internos desde sus posiciones literales y en un ámbito separado del anillo. `app/compositional-name-model.ts` permite referenciar P-32.1.1 en la evidencia. La reconciliación exige isomorfismo de grafo completo; no se asigna preferencia PIN al nombre completo. La regla antigua de traducción se conserva para entradas históricas y no se usa para generar el resultado nuevo.

## Nombres y alcance

| Estructura | Antes ES | Ahora ES | Ahora EN |
|---|---|---|---|
| Carvona B50-CID7439 | 2-metil-5-(1-metilvinil)ciclohex-2-en-1-ona | 2-metil-5-(prop-1-en-2-il)ciclohex-2-en-1-ona | 2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one |
| Ciclohexano con la misma rama | (1-metilvinil)ciclohexano | (prop-1-en-2-il)ciclohexano | (prop-1-en-2-yl)cyclohexane |
| Ciclohexanona con la misma rama | 4-(1-metilvinil)ciclohexanona | 4-(prop-1-en-2-il)ciclohexanona | 4-(prop-1-en-2-yl)cyclohexanone |
| Benceno con la misma rama | (1-metilvinil)benceno | (prop-1-en-2-il)benceno | (prop-1-en-2-yl)benzene |

Los valores «antes» de los tres ejemplos adicionales se infieren del recorrido original para esa conectividad; la prueba roja ejecutada antes del cambio registró directamente solo carvona y su permutación.

La carvona conserva C10H14O, anillo ciclohex-2-en-1-ona, carbonilo C1, C2=C3, metilo C2 y unión de la rama en C5, sin R/S. Las pruebas ES y EN reconstruyen el nombre activo completo y mantienen **FULL** mediante isomorfismo completo, sin promoción por coincidencia textual. La cobertura de los demás progenitores no se amplía automáticamente a FULL. El nombre ES completo está directamente documentado en el BOE citado en B6.4: **ES-DIRECTLY-SUPPORTED** para el nuevo nombre de esta fila; ello es una categoría terminológica, independiente del soporte de derivación.

## Verificación

- La prueba roja falló para el original y la permutación antes del cambio. Las pruebas B6.4.1 comprueban las dos representaciones y un SMILES equivalente, orden inverso de enlaces, rotación, exportación/reimportación, alternancia ES/EN, identidad del grafo y localizadores internos separados. También comprueban ciclohexano, ciclohexanona y benceno; controles vinilo, alilo, isopropilo, prop-1-en-1-il y metilideno; y bloqueo de una rama mayor cuya insaturación no se representa.
- OPSIN CLI local 2.9.0: las cinco formas inglesas del script (nombre previo, alternativa con localizador, nuevo nombre, nombre retenido y 1-methylvinyl) devuelven `CC=1C(CC(CC1)C(=C)C)=O`, fórmula C10H14O y el mismo grafo que el fixture. El stderr solo mostró el mensaje inicial de uso. OPSIN es independiente como intérprete del nombre, pero tanto la importación del fixture como la comparación de identidad usan OpenChemLib; no es una segunda implementación independiente del comparador ni una certificación PIN.
- Chromium real mediante Edge local y Playwright: fixture importado en la aplicación, nombres ES/EN, FULL, controles, átomos y enlaces exactos para padre, cetona, metilo, rama y ambos dobles enlaces, localizadores C1/C2 internos y C5 externo, cambio ES→EN→ES, geometría y ausencia de errores de consola/solicitudes fallidas. No se simuló el generador. Las peticiones externas no necesarias para la prueba se interceptaron; no se realizaron consultas OPSIN remotas.
- B5.2 y B6.0: 25/25; regresiones seleccionadas B4.1/B4.2, VALIDATION-008, B5.0/B5.3–B5.5, B6.0/B6.1 y B6.2.1: 216/216; VALIDATION-014, heterociclos y numeración visual: 28/28. Los registros y fixtures históricos se conservaron; se actualizaron únicamente expectativas de pruebas de nombres activos y su razonamiento.
- `npm run typecheck` y `git diff --check`: correctos. No se ejecutó la batería completa ni se atribuye una nueva ejecución a todos los artefactos históricos de B6.2.2/B6.3; se preservaron. Sin cambios de workflows, dependencias, grafo original ni bloqueo local de ibuprofeno.

La gramática de razonamiento para progenitores fuera de su cobertura sigue limitada y puede producir PARTIAL; no se fuerza FULL. Las pruebas de UI cubren exhaustivamente la carvona, no todos los progenitores generalizados.
