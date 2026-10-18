# OrgoRush — AUD-NOM-003: reparación de cuatro grupos P1

Fecha: 2026-10-18. HEAD inicial: `cacdbeca6d30e531158e6451e3c914c3c8c5ffb5`.
Rama: `main`, inicialmente sincronizada con `origin/main`.

## Resumen

| Hallazgo histórico | Estado | Estructuras originales | Nombres corregidos | Salidas no disponibles |
| --- | --- | ---: | ---: | ---: |
| AUDNOM-002 — N-sustitución | FIXED | 33 | 33 Legacy EN | 0 |
| AUDNOM-003 — arilos sustituidos | SAFE_REJECTION | 2 | 0 | 8, cuatro perfiles por estructura |
| AUDNOM-004 — diácidos | FIXED | 6 | 6 Legacy EN | 0 |
| AUDNOM-005 — R/S | FIXED | 6 | 6 Legacy EN | 0 |

**4/4 grupos resueltos dentro del alcance: tres con nombres corregidos y uno
con no disponibilidad segura del nombre local.** Son **47 estructuras distintas**:
45 tienen su salida defectuosa corregida; dos quedan protegidas en los cuatro
perfiles. No se suman rechazos como nombres correctos. Son 53 salidas históricas:
45 corregidas y ocho no disponibles. Las 45 salidas inglesas corregidas tienen
interpretación OPSIN **MATCH** de identidad completa, no solo de constitución.
Dentro de esas 47 estructuras no queda una salida afectada que publique el nombre
incorrecto anterior. No se afirma haber reparado los otros hallazgos de la
auditoría de 440 estructuras; AUDNOM-006–011 quedan fuera de esta intervención.

`SAFE_REJECTION` aquí significa rechazar **el nombre local incompleto**. Esas
moléculas se siguen importando, editando y exportando sin cambiar su identidad.
La política de rechazo de importaciones isotópicas pertenece a AUD-NOM-002 y no
se modifica en esta fase.

Resultados por caso, con nombres antes/después y procedencia independiente:
[aud-nom-003-results.json](aud-nom-003-results.json). Incluye hashes SHA-256 de
los dos archivos de producción examinados. Reproducción sin red:

```powershell
node scripts/naming-audit/verify-repair-003.mjs
```

## Precondiciones y evidencia histórica

- AUD-NOM-002 está incorporado en el HEAD inicial. Sus pruebas permanentes
  `tests/smiles-isotope-integrity.test.mjs` existen y pasaron: 28 PASS, cero fallos.
- No había diferencias en archivos versionados al comenzar. Había ocho archivos
  sin seguimiento: seis logs anteriores de `reports/naming-audit/`,
  `reports/orgorush-aud001-repair.md` y `tatus --short`. Se conservaron.
- El corpus protegido carga 184 estructuras y 203 recibos; su validación final
  conserva las entradas y los recibos originales.
- La reproducción previa a editar producción confirmó en vivo los nombres
  defectuosos de N-etilpropanamida, N,N-dimetilpropanamina, arilo orto-metilado,
  ácido butanodioico y ambos enantiómeros de butan-2-ol. Los demás nombres antes
  están en la matriz congelada, que permanece intacta.
- No se reescriben `baseline.json`, `audit-matrix.json`, `audit-cases.json`,
  `audit-findings.*`, `adjudications.json` ni `opsin-evidence.json`.
  Los hashes de producción del baseline describen el HEAD histórico `812f725`;
  no se actualizan para convertir una modificación posterior en un PASS histórico.
- `tests/naming-audit/diagnostics.test.mjs` se conserva. Los nuevos diagnósticos
  actuales están en `tests/audnom003-current-diagnostics.test.mjs`, separados de
  la obligación histórica de conservar los hashes. Identifican explícitamente
  los cuatro hallazgos originales y comprueban el código actual.

## Bloque A — AUDNOM-002: FIXED

**Causa demostrada:** `nitrogenSubstituentPrefixes()` producía prefijos N fuera
de `analysis.substituents`. El DTO de `buildLegacyEnglishNameModel()` solo
transportaba los sustituyentes del progenitor carbonado. El formateador inglés
recibía una amina o amida aparentemente sin sustitución sobre N.

| SMILES | Antes, Legacy EN | Después, Legacy EN |
| --- | --- | --- |
| `CCNC(=O)CC` | `propanamide` | `N-ethylpropanamide` |
| `CN(C)CCC` | `1-propanamine` | `N,N-dimethyl-1-propanamine` |

Se transportan los grupos N-alquilo desde sus enlaces reales al nitrógeno, con
IDs de átomos. Se agrupan y alfabetizan sus nombres usando localizadores `N`,
independientes de los localizadores carbonados. Se conserva la multiplicidad,
incluidos grupos iguales y distintos. El resultado de razonamiento Legacy
expone también esos grupos por separado. No se convierten en sustituyentes de
un carbono numerado ni se copia el nombre moderno como supuesto nombre histórico.

La interfaz «Cómo se obtiene» incorpora la explicación N en ES/EN y enlaza los
localizadores N visibles con el nitrógeno y la rama alquilo correspondiente.
Los fragmentos reconstruyen literalmente el nombre y sus destinos existen.

Fundamento histórico: [C-814.4, aminas secundarias/terciarias no simétricas](https://www.acdlabs.com/iupac/nomenclature/79/r79_522.htm)
y [C-824.1, prefijos para amidas N-sustituidas](https://www.acdlabs.com/iupac/nomenclature/79/r79_548.htm).
La ubicación histórica de localizadores se conserva: por ejemplo, la amina
Legacy usa `N,N-dimethyl-1-propanamine`, mientras el moderno sigue siendo
`N,N-dimethylpropan-1-amine`. OPSIN confirma su estructura, sin adjudicar un
nombre histórico preferido ni convertir estas salidas en referencias gold.

Pruebas: amida sin sustitución, N-mono y N,N-disustituidas; aminas primaria,
secundaria y terciaria; grupos N diferentes; progenitor ramificado;
numeración carbonada; fragmentos y navegación; las 33 estructuras originales.
Los nombres modernos correctos se comparan literalmente con la captura histórica.

**Límite:** la gramática N existente admite alquilos lineales unidos por un
extremo. N-isopropilo, N-alquilos ramificados, insaturados, cíclicos o con otras
funciones que no pueda expresar con seguridad pasan a nombre local no
disponible. Esto se aplica al selector y al DTO Legacy. Las 33 estructuras
originales de este hallazgo están dentro del subgrupo nombrado, sin rechazos.

## Bloque B — AUDNOM-003: SAFE_REJECTION

**Causa demostrada:** al elegir la cadena funcional, el análisis añadía un
sustituyente `fenil` que solo incluía los seis átomos del anillo. El metilo
adicional del anillo quedaba fuera del nombre. La cobertura de heteroátomos no
detectaba ese carbono perdido.

| SMILES | Antes | Después |
| --- | --- | --- |
| `c1(CCO)c(C)cccc1` | `2-phenylethan-1-ol` / `2-phenylethanol` y formas ES | Nombre local no disponible, cuatro perfiles |
| `c1(CCO)ccc(C)cc1` | Las mismas formas sin el metilo del anillo | Nombre local no disponible, cuatro perfiles |

La puerta de seguridad comprueba ahora si un anillo proyectado como fenilo tiene
otra rama fuera del progenitor funcional. No publica `phenyl`/`fenil` como nombre
de un arilo sustituido. No se amplía la gramática ni se renombran, renumeran o
reposicionan átomos del anillo.

Pruebas: metilo orto/meta/para, cadenas funcionales de uno, dos y tres carbonos,
cuatro perfiles, mensajes ES/EN, ambos casos históricos y rechazo del DTO Legacy
incompleto. Los fenilos sin sustituir y los metilos sobre la cadena funcional
conservan sus nombres admitidos. La exportación y el grafo permanecen iguales.
La evidencia OPSIN histórica demuestra la pérdida anterior; no se atribuye un
MATCH a los mensajes de no disponibilidad.

**Límite:** no se añade nomenclatura local de arilos sustituidos en estas cadenas.

## Bloque C — AUDNOM-004: FIXED

**Causa demostrada:** `functionalParent()` conocía la cantidad de grupos, pero
su rama de ácido de cadena devolvía siempre `stem + oic acid`.

| SMILES | Antes, Legacy EN | Después, Legacy EN |
| --- | --- | --- |
| `O=C(O)CCC(=O)O` | `butanoic acid` | `butanedioic acid` |
| `O=C(O)CCCCCCCCC(=O)O` | `decanoic acid` | `decanedioic acid` |

Se aplica `-dioic acid` cuando hay exactamente dos carboxilos cuyos carbonos
integran los extremos del progenitor acíclico. Se comprueban inclusión y
localizadores `1,n`; no se aplica ese sufijo indiscriminadamente a tres grupos
o carbonos carboxílicos externos. Se conserva la gramática aromática existente
que sí representa los carboxilos externos; otros patrones múltiples sin una
gramática suficiente dan no disponibilidad Legacy en vez de un monoácido.

Fundamento histórico: [C-401.1 y C-401.2](https://www.acdlabs.com/iupac/nomenclature/79/r79_308.htm).
La regla histórica distingue los carboxilos terminales incorporados al
progenitor de la nomenclatura con `carboxylic acid`. Que el nombre de estos
homólogos coincida con el moderno está respaldado por esa regla, no por copiarlo.

Pruebas: los seis casos históricos, homólogos monoácidos, diácidos ramificados e
hidroxilados, ésteres, ácidos de anillo y bencénicos, y exclusión del sufijo
`dioic` cuando sus condiciones no se cumplen. La evidencia del sufijo visible
incluye las dos contribuciones carboxilo y la explicación funcional correspondiente.

**Límite:** no se introduce una gramática general para poliácidos ni todos los
patrones de diácidos de anillo.

## Bloque D — AUDNOM-005: FIXED

**Causa demostrada:** el formateador de estereoquímica calculaba R/S, pero el
adaptador Legacy EN extraía un prefijo con una expresión regular limitada a E/Z.

| SMILES | Antes, Legacy EN con estéreo activado | Después |
| --- | --- | --- |
| `C[C@H](O)CC` | `2-butanol` | `(2S)-2-butanol` |
| `C[C@@H](O)CC` | `2-butanol` | `(2R)-2-butanol` |

El selector comunica explícitamente si se solicita estereoquímica al DTO Legacy.
Los descriptores se calculan desde el grafo, mediante las inspecciones CIP
existentes de R/S y E/Z y la numeración del progenitor seleccionado. El texto
no aporta configuraciones. El prefijo se construye una sola vez. El modo
constitucional no incorpora R/S aunque reciba texto anterior con un prefijo.
La compatibilidad de las llamadas anteriores sigue reconociendo la solicitud
estéreo del nombre generado, pero siempre calcula las configuraciones reales.

Fundamento de R/S: [reglas IUPAC de estereoquímica, 1976, sección E](https://publications.iupac.org/pac/1976/pdf/4501x0011.pdf).
Los seis casos históricos tienen MATCH OPSIN de identidad completa. El estado
constitucional y el estereoespecífico se comprueban por separado.

Pruebas: pareja S/R, aminoácidos, dos centros halogenados, centros no configurados,
moléculas aquirales, idiomas y convenciones, opción activada/desactivada, texto
obsoleto, no duplicación, R/S junto con E/Z y exportación isomérica conservada.

**Límite:** si se solicita estéreo y un centro tetraédrico configurado queda fuera
del progenitor que el formateador sabe localizar, Legacy EN queda no disponible.
No se inventan localizadores para ese centro ni se amplía la gramática estéreo.
No se modifica el formateador español ni se interviene en AUDNOM-006.

## Evidencia independiente posterior

Se añadieron 16 recibos nuevos en
[aud-nom-003-opsin-evidence.json](aud-nom-003-opsin-evidence.json), con URL exacta,
fecha, estado HTTP, cuerpo sin modificar, procedencia y SHA-256. Los recibos
anteriores se reutilizan por nombre exacto sin sobrescribirlos. Las pruebas
posteriores verifican los hashes y usan las respuestas congeladas, sin red.
La captura se hizo solo para los once textos corregidos que faltaban y cinco
casos vecinos; no hubo consulta masiva de las 440 estructuras.

Los 45 nombres ingleses corregidos tienen MATCH; también se contrasta la
identidad de los nombres modernos previamente correctos, manteniendo literalmente
sus salidas ES/EN. No queda evidencia pendiente para esos 45 nombres. Los datos
nuevos son recibos de interpretación, no adjudicaciones de grafía histórica
preferida ni nuevas entradas gold.

## Archivos de esta intervención

Producción:

- `app/page.tsx`: DTO N, seguridad del arilo, descriptores desde CIP, estado de la
  opción estéreo y evidencia pedagógica N.
- `app/legacy-english-nomenclature.ts`: localizadores N, multiplicidad,
  no disponibilidad, diácidos y datos de razonamiento N.

Pruebas permanentes, incluidas por el patrón raíz de CI:

- `tests/audnom003-n-substitution.test.mjs`.
- `tests/audnom003-aryl-substitution.test.mjs`.
- `tests/audnom003-dicarboxylic-acids.test.mjs`.
- `tests/audnom003-stereochemistry.test.mjs`.
- `tests/audnom003-current-diagnostics.test.mjs`.
- Auxiliar compartido: `tests/helpers/audnom003-repair.mjs`.

Herramienta y evidencia:

- `scripts/naming-audit/verify-repair-003.mjs`.
- `reports/naming-audit/aud-nom-003-results.json`.
- `reports/naming-audit/aud-nom-003-opsin-evidence.json`.
- Este informe.

No se cambian conectividad, fórmulas, importador isotópico, referencias gold,
corpus original, aliases ni código de Practice/Exam. No se añaden dependencias.

## Validación y cierre

- Tanda dirigida de nuevas y relacionadas, 18 archivos, concurrencia 1:
  **240 PASS, 0 FAIL, 0 SKIP**. Incluye Legacy EN, nitrogenadas, aromáticos,
  funciones, prioridad/progenitor, tetraédrica, comparación 2013/1979,
  fragmentos, navegación y las 28 regresiones isotópicas.
- Diagnósticos actuales con recibos independientes: **5 PASS, 0 FAIL**.
- Revalidación de N, diagnósticos actuales y Legacy EN: **39 PASS, 0 FAIL**.
- Ejecución final conjunta de los cinco archivos `tests/audnom003-*.test.mjs`:
  **44 PASS, 0 FAIL, 0 SKIP**, con el código de producción final.
- `npm run test:reference-corpus`: **797 pruebas, 792 PASS, 0 FAIL, 5 SKIP**
  preexistentes del corpus; no se añade ni modifica ningún skip/todo.
- Las tandas anteriores se solapan y no se suman como pruebas únicas.
- No se ejecutó `npm test` completo.
- `npm run build:pages`: **PASS**. Conserva avisos no fatales de tamaño de bundle
  e importación dinámica/estática compartida.
- `npm run validate:pages`: **PASS**:
  `PAGES_ARTIFACT={"entries":3,"assets":6,"base":"/Hydrocarbon-Lab/"}`.
- `git diff --check`: **PASS**.
- Los hashes de producción del resultado posterior coinciden con los archivos
  actuales. La herramienta registra **cero recibos independientes pendientes**.

No se hizo commit ni push. La rama y HEAD iniciales se conservan; los ocho
archivos sin seguimiento previos se mantienen intactos. Esta intervención deja
dos archivos versionados modificados y diez archivos nuevos de pruebas,
herramienta, evidencia e informe; ninguno está preparado en el índice.
