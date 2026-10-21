# OrgoRush — AUD-001: explicaciones de insaturación concisas

## A. Causa

El paso 07 concatenaba las explicaciones completas de cada contribución de enlace y la del multiplicador. Esos mismos textos se renderizaban después en tarjetas. Además, las contribuciones cíclicas citaban el nombre completo y su convención una vez por enlace.

## B. Archivos

- `app/page.tsx`: síntesis bilingüe a partir de las contribuciones estructurales, deduplicadas por identidad semántica; el paso 07 deja de concatenar descripciones de tarjetas.
- `app/reasoning-name-fragments.ts`: descripción breve común para cada enlace; definición breve del multiplicador ya soportado por NOM-002B.
- `tests/iupac-nom002b-polyunsaturated-ketones.test.mjs`: verifica síntesis, tarjetas breves, multiplicidad, igualdad de sentidos 2,5 y dos casos adicionales de insaturación simple/padre frente a sustituyente.
- `tests/reasoning-nom004-profile.test.mjs`: adapta las expectativas de prosa al diseño solicitado y conserva la comprobación exacta del nombre mediante reconstrucción de fragmentos.
- Este informe.

## C. Antes y después

Antes: el paso 07 repetía, por cada enlace, localizador, contribución al nombre, nombre completo y colocación según la convención; después volvía a explicar el multiplicador. Las tarjetas reproducían esos párrafos.

Después, para el caso de referencia:

> El anillo contiene dos enlaces dobles en C2=C3 y C4=C5. Los localizadores 2,4 indican sus posiciones; «dien» expresa dos enlaces C=C.

| Tarjeta | Descripción |
|---|---|
| `2` | Enlace doble C2=C3. |
| `4` | Enlace doble C4=C5. |
| `dien` | «di» significa dos; «en» identifica enlaces dobles C=C. |

La introducción usa los localizadores y tipos de enlace analizados; cada tarjeta conserva su `semanticId`, `atomIds`, `bondIds`, posición escrita y destino al paso 07. `dien` conserva la unión de ambos enlaces. No se modifica el renderizador ni el manejo de eventos.

## D. Cuatro perfiles

| Perfil | Nombre conservado | Síntesis y tarjetas |
|---|---|---|
| 2013 ES | ciclohexa-2,4-dien-1-ona | Breves, en español |
| 2013 EN | cyclohexa-2,4-dien-1-one | Breves, en inglés |
| 1979 ES | 2,4-ciclohexadienona | Breves, en español |
| 1979 EN | 2,4-cyclohexadienone | Breves, en inglés |

Los fragmentos se siguen copiando de la grafía activa. Las descripciones de enlace ya no necesitan repetir la convención; Legacy no recibe prosa sobre escritura 2013. Las pruebas recorren ES actual → ES Legacy → EN Legacy → EN actual → ES actual y comparan el modelo restaurado.

## E. Casos y semántica

Se verifican las seis cetonas polinsaturadas de NOM-002B: conjuntos 2,4 y 2,5, anillos de cinco, seis y siete miembros, derivado metilado y octatrienona 2,4,6. `dien` define di/dos y `trien` tri/tres. La misma regla conserva los demás multiplicadores que ya admite la evidencia compartida, hasta octa; no se amplía la gramática química.

También se verifican `O=C1C=CCCC1` (un doble enlace) y `C#CC(CCC)CCC` (triple enlace en sustituyente moderno o padre Legacy). En el segundo caso se mantiene la distinción estructural existente, sin convertir el enlace del sustituyente en una insaturación del padre. El caso 2,5 rechaza una explicación falsa basada en el primer punto de diferencia.

## F. Pruebas

Primera batería: NOM-002B, fragmentos, navegación, perfiles NOM-004 y aromáticos: 59 PASS y una expectativa de prosa incompatible con la solicitud. Esa expectativa exigía que alguna explicación incluyera el nombre completo; se reemplazó por reconstrucción exacta del nombre activo y una síntesis exacta con C2=C3, conservando el control de textos obsoletos. Otra expectativa de grafía `-2-en-` pasó a comprobar el enlace real y la ausencia del nombre repetido.

Resultado final: **62 pruebas distintas aprobadas**, sin `skip` ni `todo`: 45 de fragmentos/navegación/aromáticos aprobadas en la primera batería, y 17 de NOM-002B/AUD-001/perfiles aprobadas en la repetición final. No hubo cambios de implementación entre ambas ejecuciones.

```text
node --test --test-concurrency=1 tests/iupac-nom002b-polyunsaturated-ketones.test.mjs tests/reasoning-name-fragments.test.mjs tests/reasoning-name-navigation.test.mjs tests/reasoning-nom004-profile.test.mjs tests/reasoning-aromatic-functional.test.mjs
node --test --test-concurrency=1 tests/iupac-nom002b-polyunsaturated-ketones.test.mjs tests/reasoning-nom004-profile.test.mjs
```

Se mantienen las comprobaciones de nombres exactos, reconstrucción literal, enlaces químicos reales, átomos y pares de enlace, unicidad de spans, navegación, selección de tarjeta e inmutabilidad del grafo. En navegador local se verificaron clic en `2`, Enter en `4` y Enter en `dien`; selección exclusiva y cambios entre los cuatro perfiles, con regreso a español. El servidor aislado no era accesible al navegador; se utilizó el servidor local autorizado fuera del sandbox y se cerró al terminar.

## G. Build y Pages

- `npm run build:pages`: **PASS**. Avisos existentes de importación estática/dinámica compartida y tamaño de bundle.
- `npm run validate:pages`: **PASS**, 3 entradas, 6 assets, base `/Hydrocarbon-Lab/`.
- `git diff --check`: **PASS**.
- Suite global: no ejecutada en AUD-001, conforme al encargo; queda para GitHub Actions tras commit/push autorizado.

## H. Riesgos y límites

El cambio es de presentación. Se conservan nombres, selección de padre, numeración, conectividad, SMILES y motores Practice/Exam. NOM-002B y NOM-004B/C/D mantienen su evidencia e interacción. Los patrones sin contribuciones verificadas conservan su explicación de respaldo. La justificación de numeración del paso 03 sigue siendo independiente; esta intervención simplifica la introducción y las tarjetas del paso 07.

## I. Git y diff

Estado inicial limpio en `main`, sincronizado con `origin/main`. Cambios acotados a los cuatro archivos de implementación/pruebas indicados y este informe nuevo. El diff de los cuatro archivos existentes es **102 inserciones y 34 eliminaciones**. Sin dependencias nuevas, excepciones por molécula, cambios en motores de nombres, commit ni push.
