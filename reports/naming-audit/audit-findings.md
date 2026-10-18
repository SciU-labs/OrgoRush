# OrgoRush — hallazgos AUD-NOM-001

Fecha: 2026-10-18. Cada ID identifica un grupo causal permanente; las salidas correlacionadas no se contabilizan como defectos independientes. Datos completos en audit-findings.json y audit-matrix.json.

## AUDNOM-001 — Importación aceptada elimina silenciosamente la etiqueta isotópica

**P0; NAME_STRUCTURE_MISMATCH; CONFIRMED.** 1 estructuras y 4 salidas.

**Observado:** [13CH3]CO se importa sin error, pero la exportación inicial y la posterior al análisis son CCO; los cuatro perfiles muestran etanol/ethanol sin el isótopo.

**Esperado / fundamento:** Preservar la masa isotópica o rechazar explícitamente esta capacidad no representada. No se exige una grafía isotópica exacta nueva.

**Evidencia:** Identidades canónicas OCL distintas antes de cualquier nomenclatura. OPSIN también interpreta ethanol como etanol sin especificación isotópica. La conectividad ordinaria permanece igual.

**Causa probable:** El DTO editable no transfiere getAtomMass durante moleculeFromSmiles, ni buildOpenChemLibStereoGraph lo restaura al exportar. El límite no se rechaza como sí ocurre con cargas no soportadas.

**Código a revisar:** `app/openchemlib-adapter.ts`, `app/tetrahedral-stereochemistry.ts`.

- AUDCASE-0440; SMILES: `[13CH3]CO`. 2013-es: `etanol`; 2013-en: `ethanol`; 1979-es: `etanol`; 1979-en: `ethanol`.

**Regresión propuesta:** Importar y exportar 13C y vecinos no isotópicos: igualdad OCL completa o rechazo explícito, nunca aceptación con pérdida. P0 acotado a fidelidad de identidad isotópica; no se observó corrupción generalizada de conectividad.

**Casos:** AUDCASE-0440.

## AUDNOM-002 — Legacy EN omite los sustituyentes unidos al nitrógeno

**P1; WRONG_SUBSTITUENT, NAME_STRUCTURE_MISMATCH, WRONG_LEGACY_NAME; CONFIRMED.** 33 estructuras y 33 salidas.

**Observado:** CCNC(=O)CC produce propanamide; CN(C)CCC produce 1-propanamine en Legacy EN. El análisis moderno sí conserva N-ethyl y N,N-dimethyl.

**Esperado / fundamento:** Todo nombre admitido debe representar los carbonos enlazados a N. N-ethylpropanamide y N,N-dimethylpropan-1-amine son referencias estructurales verificadas para 2013; no se imponen automáticamente como la grafía histórica preferida.

**Evidencia:** OPSIN de los textos Legacy reales representa amida/amina primaria y omite los grupos N-alquilo. Contraste individual de conectividad, número de carbonos y recibos completos.

**Causa probable:** nitrogenSubstituentPrefixes genera prefijos fuera de analysis.substituents. buildLegacyEnglishNameModel solo transporta analysis.substituents y attachedAlkylName para ésteres; se pierden los prefijos N en el DTO.

**Código a revisar:** `app/page.tsx`, `app/legacy-english-nomenclature.ts`.

- AUDCASE-0342; SMILES: `CCNC(=O)CC`. 1979-en: `propanamide`.
- AUDCASE-0343; SMILES: `CN(C)CCC`. 1979-en: `1-propanamine`.

**Regresión propuesta:** Aminas secundaria/terciaria y amidas N-mono/N,N-disustituidas con ramas de distinto tamaño; interpretar cada salida admitida y exigir preservación de N-alquilo, además de evidencia pedagógica de los prefijos.

En el modelo pedagógico 2013 de los representantes, N-ethyl/N,N-dimethyl queda como texto plano y no tiene paso de sustitución propio. Se vincula a este grupo causal sin contarlo como otro nombre químicamente erróneo.

**Casos:** AUDCASE-0342, AUDCASE-0343, AUDCASE-0344, AUDCASE-0345, AUDCASE-0346, AUDCASE-0347, AUDCASE-0348, AUDCASE-0349, AUDCASE-0350, AUDCASE-0352, AUDCASE-0353, AUDCASE-0355, AUDCASE-0356, AUDCASE-0357, AUDCASE-0358, AUDCASE-0359, AUDCASE-0360, AUDCASE-0361, AUDCASE-0362, AUDCASE-0363, AUDCASE-0365, AUDCASE-0366, AUDCASE-0367, AUDCASE-0368, AUDCASE-0370, AUDCASE-0371, AUDCASE-0372, AUDCASE-0373, AUDCASE-0375, AUDCASE-0376, AUDCASE-0377, AUDCASE-0378, AUDCASE-0379.

## AUDNOM-003 — Una cadena funcional unida a un arilo metilado se nombra como fenilo sin sustituir

**P1; WRONG_SUBSTITUENT, NAME_STRUCTURE_MISMATCH; CONFIRMED.** 2 estructuras y 8 salidas.

**Observado:** Los arilos orto/para-metilados unidos a CH2CH2OH reciben 2-phenylethan-1-ol/2-phenylethanol y sus formas españolas, sin el metilo del anillo.

**Esperado / fundamento:** Conservar el metilo del arilo mediante una gramática admitida o activar el aviso de nombre local no disponible. No se fija un nombre completo histórico exacto para estos límites.

**Evidencia:** El SMILES contiene nueve carbonos y los nombres ingleses interpretados por OPSIN contienen ocho. Los perfiles actuales aceptan el nombre, aunque la gramática de arilo sustituido no esté implementada.

**Causa probable:** functionalChainAttachedToRing llama ringSubstituentName, que devuelve fenil por identidad del anillo; al escoger la cadena funcional se omite el componente metilo que también cuelga del anillo. La puerta de seguridad no detecta este sustituyente carbonado perdido.

**Código a revisar:** `app/page.tsx`.

- AUDCASE-0171; SMILES: `c1(CCO)c(C)cccc1`. 2013-es: `2-feniletan-1-ol`; 2013-en: `2-phenylethan-1-ol`; 1979-es: `2-feniletanol`; 1979-en: `2-phenylethanol`.
- AUDCASE-0176; SMILES: `c1(CCO)ccc(C)cc1`. 2013-es: `2-feniletan-1-ol`; 2013-en: `2-phenylethan-1-ol`; 1979-es: `2-feniletanol`; 1979-en: `2-phenylethanol`.

**Regresión propuesta:** Vecinos orto/meta/para con cadenas de uno y dos carbonos: no perder sustituyentes del arilo; hasta disponer de gramática completa, mantener el rechazo seguro de nombres incompletos.

**Casos:** AUDCASE-0171, AUDCASE-0176.

## AUDNOM-004 — Legacy EN reduce ácidos dicarboxílicos a monocarboxílicos

**P1; WRONG_LEGACY_NAME, NAME_STRUCTURE_MISMATCH; CONFIRMED.** 6 estructuras y 6 salidas.

**Observado:** El ácido decanodioico produce decanoic acid y el ácido butanodioico produce butanoic acid en Legacy EN; el motor detecta dos grupos carboxilo.

**Esperado / fundamento:** El nombre debe representar ambos carboxilos. P-14.3.4.1 incluye butanedioic acid como ejemplo; esto corrobora la estructura, sin convertir automáticamente la grafía 2013 en exigencia histórica exacta.

**Evidencia:** Seis homólogos tienen recibos OPSIN independientes con dos oxígenos menos que el grafo de entrada. El análisis y la conectividad editables siguen conteniendo los dos carboxilos.

**Causa probable:** functionalParent calcula count pero la rama carboxylicAcid devuelve siempre stem + oic acid, sin una variante dioic acid.

**Código a revisar:** `app/legacy-english-nomenclature.ts`.

- AUDCASE-0288; SMILES: `O=C(O)CCCCCCCCC(=O)O`. 1979-en: `decanoic acid`.
- AUDCASE-0292; SMILES: `O=C(O)CCC(=O)O`. 1979-en: `butanoic acid`.

**Regresión propuesta:** Series de diácidos simétricos/no simétricos y vecinos monocarboxílicos, conservando multiplicidad de sufijos y equivalencia estructural en cada perfil.

**Casos:** AUDCASE-0288, AUDCASE-0292, AUDCASE-0294, AUDCASE-0295, AUDCASE-0298, AUDCASE-0303.

## AUDNOM-005 — Legacy EN elimina R/S aun con estereoquímica explícita activada

**P1; WRONG_STEREOCHEMISTRY, NAME_STRUCTURE_MISMATCH; CONFIRMED.** 6 estructuras y 6 salidas.

**Observado:** Ambos enantiómeros del butan-2-ol muestran 2-butanol en Legacy EN; también desaparecen los descriptores de aminoácidos y dos centros halogenados.

**Esperado / fundamento:** Con la opción estereoquímica activada, conservar los descriptores que identifica la estructura. Es legítimo ofrecer un nombre constitucional en otro modo, pero este recorrido solicita explícitamente la variante estereoquímica.

**Evidencia:** Seis salidas inglesas Legacy tienen la misma constitución OCL y diferente estado estereoquímico respecto al SMILES configurado. Los perfiles modernos sí conservan la configuración y el SMILES exportado no cambia.

**Causa probable:** traditionalStereochemicalPrefix solo admite E/Z en su expresión regular; buildLegacyEnglishNameModel descarta los prefijos R/S que acaba de producir formatStereochemicalName.

**Código a revisar:** `app/page.tsx`.

- AUDCASE-0417; SMILES: `C[C@H](O)CC`. 1979-en: `2-butanol`.
- AUDCASE-0418; SMILES: `C[C@@H](O)CC`. 1979-en: `2-butanol`.
- AUDCASE-0421; SMILES: `C[C@H](Cl)[C@H](Br)C`. 1979-en: `2-bromo-3-chlorobutane`.

**Regresión propuesta:** Parejas R/S y sistemas con dos centros; activar la opción estereoquímica, comprobar ambos modelos y comparar identidades OCL con y sin información estéreo por separado.

**Casos:** AUDCASE-0417, AUDCASE-0418, AUDCASE-0419, AUDCASE-0420, AUDCASE-0421, AUDCASE-0422.

## AUDNOM-006 — Legacy ES duplica el prefijo E/Z al activar la variante estereoquímica

**P2; WRONG_LEGACY_NAME, WRONG_STEREOCHEMISTRY; CONFIRMED.** 4 estructuras y 4 salidas.

**Observado:** C/C=C/C muestra (2E)-(2e)--2-buteno; el vecino Z y la pareja hex-3-eno presentan la misma duplicación.

**Esperado / fundamento:** Un único prefijo E/Z correspondiente al grafo, sin el descriptor repetido en minúscula ni guion doble. No se promueve una traducción automática a referencia exacta española.

**Evidencia:** El análisis ya contiene (2E)- y la ruta de interfaz llama formatStereochemicalName sobre ese texto antes del formateo Legacy. Se conservan los cuatro nombres observados y los recibos de las salidas inglesas equivalentes.

**Causa probable:** La ruta moderna elimina primero los descriptores del nombre base; legacyNameWithSelectedStereochemistry no lo hace. El formateador añade un segundo prefijo y el adaptador español procesa el prefijo interior como texto base.

**Código a revisar:** `app/page.tsx`, `app/nomenclature-conventions.ts`, `app/double-bond-stereochemistry.ts`.

- AUDCASE-0411; SMILES: `C/C=C/C`. 1979-es: `(2E)-(2e)--2-buteno`.
- AUDCASE-0412; SMILES: `C/C=C\C`. 1979-es: `(2Z)-(2z)--2-buteno`.

**Regresión propuesta:** E/Z activado/desactivado, alternancia ES/EN y dos convenciones; exigir un único conjunto de descriptores para cada variante admitida.

**Casos:** AUDCASE-0411, AUDCASE-0412, AUDCASE-0413, AUDCASE-0414.

## AUDNOM-007 — El radical non Legacy se localiza dentro de la terminación y cruza el sufijo

**P2; FRAGMENT_MAPPING_ERROR; CONFIRMED.** 5 estructuras y 10 salidas.

**Observado:** En 2-metil-4-nonanona / 2-methyl-4-nonanone, el fragmento non apunta a la última coincidencia, solapada con ona/one. El enlace renderizado del padre queda reducido a una n.

**Esperado / fundamento:** El fragmento del padre debe señalar la raíz inicial del padre nonanona/nonanone, con un intervalo distinto al sufijo funcional. La reconstrucción global exacta del nombre por sí sola no detecta este error.

**Evidencia:** Cinco estructuras y ambos idiomas Legacy contienen intervalos parcialmente cruzados, offsets y atomIds almacenados en audit-matrix.json.

**Causa probable:** deriveLegacyConventionFragments usa name.lastIndexOf(rootText) sin límites morfológicos; non vuelve a aparecer dentro de nonanona/nonanone.

**Código a revisar:** `app/reasoning-name-fragments.ts`, `app/reasoning-name-links.ts`.

- AUDCASE-0249; SMILES: `CCCCCC(=O)CC(C)C`. 1979-es: `2-metil-4-nonanona`; 1979-en: `2-methyl-4-nonanone`.

**Regresión propuesta:** Padres non y vecinos oct/dec, con cetonas y sustituyentes; verificar límites exactos del padre y sufijo antes de construir enlaces, además de concatenación y atomIds.

**Casos:** AUDCASE-0249, AUDCASE-0266, AUDCASE-0270, AUDCASE-0276, AUDCASE-0285.

## AUDNOM-008 — En ácidos insaturados modernos, eno invade el sufijo oic/oico

**P2; FRAGMENT_MAPPING_ERROR; CONFIRMED.** 5 estructuras y 10 salidas.

**Observado:** pent-2-enoic acid tiene el fragmento 2-eno, solapado con oic; el enlace funcional visible se recorta a ic. En español, oico se recorta a ico.

**Esperado / fundamento:** Separar en y oic/oico según su función en este nombre; no tomar la o de la función como parte de un eno autónomo.

**Evidencia:** Cinco homólogos en ES/EN muestran el cruce de intervalos. Los nombres y los pares C2=C3 del análisis son correctos; el defecto es semántico e interactivo.

**Causa probable:** unsaturationMorpheme acepta en seguido opcionalmente de o/e sin distinguir el comienzo del sufijo funcional oic/oico.

**Código a revisar:** `app/reasoning-name-fragments.ts`, `app/reasoning-name-links.ts`.

- AUDCASE-0293; SMILES: `O=C(O)C=CCC`. 2013-es: `ácido pent-2-enoico`; 2013-en: `pent-2-enoic acid`.

**Regresión propuesta:** Ácidos y ésteres insaturados, incluidos polienos, con límites de morfemas y enlaces independientes para insaturación y función.

**Casos:** AUDCASE-0293, AUDCASE-0300, AUDCASE-0302, AUDCASE-0304, AUDCASE-0305.

## AUDNOM-009 — Localizadores repetidos se emiten dos veces en la misma sección Legacy

**P2; FRAGMENT_MAPPING_ERROR; CONFIRMED.** 32 estructuras y 40 salidas.

**Observado:** La sección 03 de 2,2-dimethylhexane contiene dos evidencias para el mismo intervalo 2,2; ocurre también con conjuntos de localizadores distintos.

**Esperado / fundamento:** Una sola evidencia por sección e intervalo literal, conservando las relaciones legítimas entre numeración y sufijos. No confundir fragmentos disjuntos de un mismo enlace con duplicación del mismo span.

**Evidencia:** Los registros incluyen claves step:start:text idénticas dentro del mismo paso. Se agrupan todas las manifestaciones bajo un identificador causal.

**Causa probable:** El adaptador Legacy inserta numeración y la pasada posterior de functionalNameEvidence vuelve a añadir la misma evidencia sin deduplicar todas las combinaciones.

**Código a revisar:** `app/reasoning-name-fragments.ts`.

- AUDCASE-0003; SMILES: `CC(C)(C)CCCC`. 1979-en: `2,2-dimethylhexane`.
- AUDCASE-0005; SMILES: `CCCCCCCCCC(C)CCCC(C)C`. 1979-en: `2,6-dimethylpentadecane`.

**Regresión propuesta:** Geminales y sustituyentes repetidos, uno y varios localizadores, ES/EN Legacy; comprobar unicidad de step/start/text sin borrar las evidencias válidas compartidas entre papeles.

**Casos:** AUDCASE-0003, AUDCASE-0004, AUDCASE-0005, AUDCASE-0006, AUDCASE-0008, AUDCASE-0011, AUDCASE-0012, AUDCASE-0013, AUDCASE-0015, AUDCASE-0017, AUDCASE-0022, AUDCASE-0023, AUDCASE-0024, AUDCASE-0025, AUDCASE-0030, AUDCASE-0032, AUDCASE-0033, AUDCASE-0120, AUDCASE-0125, AUDCASE-0144, AUDCASE-0147, AUDCASE-0192, AUDCASE-0196, AUDCASE-0198, AUDCASE-0199, AUDCASE-0201, AUDCASE-0202, AUDCASE-0205, AUDCASE-0208, AUDCASE-0215, AUDCASE-0421, AUDCASE-0422.

## AUDNOM-010 — La explicación de piridina inventa C7 al describir el cierre del anillo

**P2; EXPLANATION_CONTRADICTION; CONFIRMED.** 1 estructuras y 2 salidas.

**Observado:** El padre se explica correctamente como seis átomos, cinco C y un N; el paso 03 escribe dobles enlaces C2=C3, C4=C5 y C6=C7.

**Esperado / fundamento:** No existe posición 7. El cierre representado une las posiciones 6 y 1, siendo N el átomo de posición 1; una descripción de enlaces debe ser consciente del cierre y de los elementos.

**Evidencia:** Lista parentAtomIds de seis elementos, numberedAtoms y explicación literal ES/EN. El nombre pyridine sí pasa la interpretación estructural independiente.

**Causa probable:** multipleUnsaturationReasoningText usa locant + 1 y el prefijo C para todos los extremos, sin cierre cíclico ni tipo de átomo.

**Código a revisar:** `app/page.tsx`.

- AUDCASE-0430; SMILES: `c1ccncc1`. 2013-es: `piridina`; 2013-en: `pyridine`.

**Regresión propuesta:** Heterociclos aromáticos con dobles enlaces de cierre; contrastar cada extremo numerado explicado con un átomo existente y su elemento real.

Las dos señales ANALYSIS_BOND_LOCANT de este caso no prueban que el análisis esté mal: el comprobador inicial solo cerraba cycloalkane, no aromatic. Se adjudican como aviso de comprobador; el defecto confirmado está en el texto C6=C7, no en la selección del análisis.

**Casos:** AUDCASE-0430.

## AUDNOM-011 — Etiquetas funcionales españolas aparecen en explicaciones Legacy EN

**P2; WRONG_TRANSLATION; CONFIRMED.** 76 estructuras y 76 salidas.

**Observado:** The principal amida is at C1 y The principal éster is at C1, junto con amina/nitrilo en otras estructuras.

**Esperado / fundamento:** Usar amide, ester, amine y nitrile en el texto inglés, conservando los datos del análisis activo.

**Evidencia:** Textos parent del perfil 1979-en almacenados; no se requiere un oráculo de grafía normativa del nombre para demostrar la mezcla de idiomas.

**Causa probable:** legacyStructuralReasoningText traduce cuatro clases y para las restantes usa analysis.primaryFunctionalLabel en español como fallback.

**Código a revisar:** `app/page.tsx`.

- AUDCASE-0342; SMILES: `CCNC(=O)CC`. 1979-en: `propanamide`.
- AUDCASE-0312; SMILES: `COC(=O)CC(C)`. 1979-en: `methyl butanoate`.

**Regresión propuesta:** Tabla bilingüe de etiquetas para todas las clases funcionales admitidas por las explicaciones Legacy.

**Casos:** AUDCASE-0306, AUDCASE-0307, AUDCASE-0308, AUDCASE-0309, AUDCASE-0310, AUDCASE-0311, AUDCASE-0312, AUDCASE-0315, AUDCASE-0316, AUDCASE-0317, AUDCASE-0320, AUDCASE-0321, AUDCASE-0322, AUDCASE-0323, AUDCASE-0324, AUDCASE-0326, AUDCASE-0327, AUDCASE-0329, AUDCASE-0330, AUDCASE-0335, AUDCASE-0339, AUDCASE-0340, AUDCASE-0342, AUDCASE-0343, AUDCASE-0344, AUDCASE-0345, AUDCASE-0346, AUDCASE-0347, AUDCASE-0348, AUDCASE-0349, AUDCASE-0350, AUDCASE-0351, AUDCASE-0352, AUDCASE-0353, AUDCASE-0354, AUDCASE-0355, AUDCASE-0356, AUDCASE-0357, AUDCASE-0358, AUDCASE-0359, AUDCASE-0360, AUDCASE-0361, AUDCASE-0362, AUDCASE-0363, AUDCASE-0364, AUDCASE-0365, AUDCASE-0366, AUDCASE-0367, AUDCASE-0368, AUDCASE-0369, AUDCASE-0370, AUDCASE-0371, AUDCASE-0372, AUDCASE-0373, AUDCASE-0374, AUDCASE-0375, AUDCASE-0376, AUDCASE-0377, AUDCASE-0378, AUDCASE-0379, AUDCASE-0380, AUDCASE-0381, AUDCASE-0382, AUDCASE-0390, AUDCASE-0392, AUDCASE-0394, AUDCASE-0396, AUDCASE-0399, AUDCASE-0400, AUDCASE-0401, AUDCASE-0402, AUDCASE-0404, AUDCASE-0406, AUDCASE-0407, AUDCASE-0408, AUDCASE-0409.

## Referencias y evidencia

Las derivaciones individuales y las páginas primarias consultadas están en audit-cases.json y sources.json. Los cuerpos de OPSIN y hashes están en opsin-evidence.json. No se introdujeron expectativas españolas por traducción ni se modificaron referencias gold del corpus.
