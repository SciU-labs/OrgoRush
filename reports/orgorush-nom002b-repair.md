# OrgoRush — NOM-002B: cetonas cíclicas polinsaturadas

Fecha: 2026-10-17. Sin commit ni push.

## A. Causa raíz

`formatSpanish1979CyclicKetone` solo reconocía `ciclo<raíz>-<localizador>-en-<localizador>-ona`. Una dienona aporta una vocal `a`, varios localizadores y `dien`; por ello ninguna rama española admitía el nombre moderno válido y el perfil recibía `-`. El adaptador de disponibilidad no es la causa y permanece intacto.

El generador inglés ya construía `2,4-cyclohexadienone` a partir del modelo estructural. No ha sido necesario modificarlo.

## B. Fundamento histórico

Fuentes consultadas directamente:

- [IUPAC 1979 A-11.3](https://www.acdlabs.com/iupac/nomenclature/79/r79_60.htm): los monociclos insaturados emplean las terminaciones `-ene`, `-adiene`, `-atriene`, etc., y localizadores bajos para los enlaces múltiples.
- [IUPAC 1979 C-314.1](https://www.acdlabs.com/iupac/nomenclature/79/r79_276.htm): procedimiento clásico para cetonas cíclicas, con el sufijo `-one` unido al nombre del sistema cíclico y elisión de la `e` terminal.
- [IUPAC 1979 C-15.11](https://www.acdlabs.com/iupac/nomenclature/79/r79_869.htm): el grupo principal citado como sufijo precede a los enlaces múltiples al decidir la numeración.
- [NIST Chemistry WebBook, CAS 24599-57-3](https://webbook.nist.gov/cgi/cbook.cgi?ID=C24599573&Mask=1&Units=CAL): registra `2,4-Cyclohexadienone`, fórmula C6H6O e InChIKey WQPDQJCBHQPNCZ-UHFFFAOYSA-N. Corrobora la forma histórica con el localizador del carbonilo implícito; no sustituye las reglas normativas anteriores.

La aplicación conjunta de A-11.3 y C-314.1 fundamenta `2,4-cyclohexadienone`. `2,4-ciclohexadienona` es la adaptación morfológica española del perfil existente, con `ciclo` y `ona`; no se presenta como una cita literal española del libro inglés. Conserva la `a`, `di`, ambos localizadores y el carbonilo inherente en C1. No es una traducción automática del resultado inglés.

## C. Corrección de nomenclatura

Se añade una producción delimitada para monocetonas monocíclicas con varios dobles enlaces, carbonilo en C1 y multiplicador concordante con los localizadores. Se conservan los prefijos de sustitución, el esqueleto del anillo y todos los localizadores. Se rechazan discrepancias de multiplicidad, localizadores repetidos y gramáticas de policetonas que esta ampliación no documenta.

No se cambian el generador 2013, el modelo de decisión química, los comparadores de padres, el generador inglés ni el mensaje de indisponibilidad.

## D. Fragmentos `2`, `4` y `dien`

Las contribuciones individuales de enlace conservan su identidad semántica, localizador y par exacto de átomos. Legacy recibe un adaptador literal para sus localizadores anteriores al esqueleto. Se añade una única evidencia compartida para `dien` (o el multiplicador soportado), asociada a la unión de los átomos y enlaces de sus contribuciones individuales.

La tarjeta compartida explica que `di` cuenta dos enlaces dobles y `en` expresa el tipo de enlace C=C. El paso 07 incluye ese significado y los enlaces C2=C3 y C4=C5. El fragmento `dien` se copia del nombre visible y tiene un destino al paso 07. Su etiqueta accesible no inventa un localizador individual. Cada nombre se reconstruye exactamente al concatenar los enlaces y el texto restante.

Los fragmentos de localizador agrupado modernos citan ahora la forma escrita completa `2,4-dien`, en lugar de enseñar las porciones aisladas `-2` y `4-` como si fueran morfemas de insaturación.

## E. Numeración antes y después

La comparación estructural ya fijaba el carbonilo en C1 y comparaba ambos sentidos del anillo. Para el caso principal, el resultado era y sigue siendo **2,4 frente a 3,5**, decidido por el primer punto de diferencia. No se ha cambiado el algoritmo de selección ni añadido una comparación constante para esta molécula.

Las pruebas nuevas exigen ambos conjuntos en ES/EN y en ambos perfiles. También comprueban 2,4 frente a 4,6 en la heptadienona, y 2,4,6 frente a 3,5,7 en la octatrienona. Los anillos con sentidos equivalentes no reciben una justificación falsa de desigualdad.

## F. Cuatro perfiles del caso de referencia

| Perfil | Antes | Después |
|---|---|---|
| 2013 ES | ciclohexa-2,4-dien-1-ona | ciclohexa-2,4-dien-1-ona |
| 2013 EN | cyclohexa-2,4-dien-1-one | cyclohexa-2,4-dien-1-one |
| 1979 ES | No disponible (`-`) | 2,4-ciclohexadienona |
| 1979 EN | 2,4-cyclohexadienone | 2,4-cyclohexadienone |

La nueva prueba incluye seis estructuras: ciclohexa-2,4-dienona, ciclohexa-2,5-dienona, ciclopenta-2,4-dienona, ciclohepta-2,4-dienona, 4-metilciclohexa-2,4-dienona y cicloocta-2,4,6-trienona. Exige nombres completos exactos en los cuatro perfiles, función cetona, número de carbonos del anillo, carbonilo C1, enlaces y localizadores, ida y vuelta SMILES, e inmutabilidad de los grafos y análisis.

## G. Interactividad

Pruebas automatizadas: cada fragmento se renderiza una vez con identidad distinta y texto realmente escrito; los callbacks seleccionan su identidad y navegan al paso 07. `dien` contiene los pares de átomos de ambos enlaces y los localizadores contienen cada par por separado. La secuencia ES actual → ES Legacy → EN Legacy → EN actual → ES actual restaura el modelo inicial y conserva ambos análisis sin mutación.

Comprobación en navegador local: clic en `2` seleccionó solo su tarjeta; Enter sobre `4` seleccionó solo su tarjeta; Enter sobre `dien` seleccionó su tarjeta compartida. Se verificó Enter sobre `dien` tanto en 2013 EN como en Legacy EN, la grafía Legacy ES y el retorno a ES 2013. Los cambios de idioma/perfil limpian la selección anterior y conservan tres tarjetas, sin duplicación ni mezcla de grafías. El servidor del sandbox inicialmente no era accesible al navegador; la comprobación se realizó con el servidor local autorizado fuera del sandbox.

## H. Regresiones históricas

Las siete cetonas NOM-002 conservan sus nombres exactos: ciclopentanona, ciclohexanona, 2-ciclopentenona, 2-ciclohexenona, 3-ciclohexenona, 2-cicloheptenona y 4-metil-2-ciclohexenona. La batería de perfiles conserva NOM-004B, la deduplicación de NOM-004C y las 16 regresiones aromáticas corregidas por NOM-004D. Los casos NOM-003 conservan la selección de sus padres.

## I. Validación

Comandos de las baterías dirigidas:

```text
node --test --test-concurrency=1 tests/iupac-nom002b-polyunsaturated-ketones.test.mjs tests/reasoning-name-fragments.test.mjs
node --test --test-concurrency=1 tests/iupac-nom002-cyclic-ketones.test.mjs tests/reasoning-nom004-profile.test.mjs tests/reasoning-aromatic-functional.test.mjs tests/reasoning-name-navigation.test.mjs tests/iupac-nom003-parent-selection.test.mjs
```

- Específicas NOM-002B + fragmentos/insaturaciones múltiples, repetidas en esta recuperación: **27 PASS, 0 FAIL, 0 SKIP**.
- NOM-002 + NOM-003 + perfiles NOM-004B/C + aromáticos NOM-004D + navegación, repetidas en esta recuperación: **35 PASS, 0 FAIL, 0 SKIP**.
- Navegador local: **PASS**, según las comprobaciones de G.
- `npm test`: **sin resultado global verificable**. El registro conservado en `outputs/nom002b/npm-test.log` no termina con el resumen agregado de Node y contiene marcadores de fallos en invocaciones de numerosos archivos; no hay proceso `node`, `npm` o `bash` activo asociado al trabajo. Según el alcance de NOM-002B, no se repitió esta batería secuencial extensa. La suite global queda pendiente de CI.
- `npm run build:pages`: **PASS**; avisos de importación dinámica compartida y tamaño de bundle, sin error de compilación.
- `npm run validate:pages`: **PASS**, tres entradas y seis assets; base `/Hydrocarbon-Lab/`.
- `git diff --check`: **PASS**.

## J. Diff y límites

Archivos de implementación: `app/nomenclature-conventions.ts`, `app/reasoning-name-fragments.ts`, `app/page.tsx`. Se añaden `tests/iupac-nom002b-polyunsaturated-ketones.test.mjs` y este informe. Los fixtures anteriores permanecen intactos.

La ampliación histórica cubre la gramática verificada de monocetonas cíclicas con enlaces dobles y C1 implícito; no pretende incorporar todas las policetonas, insaturaciones mixtas o sistemas policíclicos. Practice/Exam, importación/exportación SMILES, valencias, licencia e interfaz general no reciben modificaciones. No hay dependencias nuevas ni excepciones por SMILES. No se han añadido `skip` o `todo`, ni alterado expectativas previas. NOM-002 y NOM-003 permanecen sin cambios en su motor/selección correspondiente; las pruebas seleccionadas solo confirman su comportamiento de regresión.
