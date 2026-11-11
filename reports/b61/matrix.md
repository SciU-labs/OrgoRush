# B6.1 — matriz del corpus congelado

20 moléculas × ES/EN actual = 40 perfiles. FI = FULL-INTERNAL-ONLY; FV = FULL-INDEPENDENTLY-VERIFIED; PS = PARTIAL-SAFE; US = UNSUPPORTED-SAFE; FN = FAIL-NAME. Todos los nombres completos conservan además PENDING-EXTERNAL en nameValidation. PS expresa admisión parcial y controles limitados sin fallo detectado, no exactitud del nombre completo certificada. No se suman estos estados internos a resultados de un parser externo.

## Fuente y cobertura

Cada CID enlaza el registro independiente. El fixture conserva SMILES, fórmula, InChIKey, conteos estereoquímicos, URL de recuperación, UTC y hash del recibo crudo. PubChem es una sola familia de fuentes externas; sus nombres calculados no son certificados PIN.

| ID / fuente | Referencia EN externa | Fórmula | Estereoquímica definida / no definida | Resultado ES / EN | Observación |
|---|---|---|---|---|---|
| B61-I01 [CID 24834](https://pubchem.ncbi.nlm.nih.gov/compound/24834) | 4-ethoxybenzaldehyde | C9H10O2 | átomos 0/0; enlaces 0/0 | FI / FI | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I02 [CID 11950](https://pubchem.ncbi.nlm.nih.gov/compound/11950) | 2-ethoxybenzaldehyde | C9H10O2 | átomos 0/0; enlaces 0/0 | FI / FI | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I03 [CID 7020622](https://pubchem.ncbi.nlm.nih.gov/compound/7020622) | 4-ethylbenzamide | C9H11NO | átomos 0/0; enlaces 0/0 | FI / FI | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I04 [CID 117869](https://pubchem.ncbi.nlm.nih.gov/compound/117869) | N-ethyl-4-methylbenzamide | C10H13NO | átomos 0/0; enlaces 0/0 | PS / PS | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I05 [CID 14517](https://pubchem.ncbi.nlm.nih.gov/compound/14517) | 4-fluorobenzonitrile | C7H4FN | átomos 0/0; enlaces 0/0 | PS / PS | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I06 [CID 587203](https://pubchem.ncbi.nlm.nih.gov/compound/587203) | 3,4-difluorobenzonitrile | C7H3F2N | átomos 0/0; enlaces 0/0 | PS / PS | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I07 [CID 10758](https://pubchem.ncbi.nlm.nih.gov/compound/10758) | 2-hydroxy-2-phenylacetonitrile | C8H7NO | átomos 0/1; enlaces 0/0 | PS / PS | Orden EN corregido; conectividad del nombre completo pendiente. |
| B61-I08 [CID 31266](https://pubchem.ncbi.nlm.nih.gov/compound/31266) | prop-2-enyl hexanoate | C9H16O2 | átomos 0/0; enlaces 0/0 | PS / PS | Antes propilo saturado; ahora radical prop-2-en-1-ilo, sin ampliar FULL. |
| B61-I09 [CID 13156](https://pubchem.ncbi.nlm.nih.gov/compound/13156) | 1-bromobutan-2-one | C4H7BrO | átomos 0/0; enlaces 0/0 | PS / PS | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I10 [CID 557975](https://pubchem.ncbi.nlm.nih.gov/compound/557975) | 3-ethyl-3,5,5-trimethylcyclohexan-1-one | C11H20O | átomos 0/1; enlaces 0/0 | FI / FI | Forma alternativa; diferencia textual no se cuenta como error. |
| B61-I11 [CID 79506](https://pubchem.ncbi.nlm.nih.gov/compound/79506) | 4-ethylcyclohexan-1-one | C8H14O | átomos 0/0; enlaces 0/0 | FI / FI | Forma alternativa; diferencia textual no se cuenta como error. |
| B61-I12 [CID 522591](https://pubchem.ncbi.nlm.nih.gov/compound/522591) | 2-ethyl-3-methylcyclohexan-1-one | C9H16O | átomos 0/2; enlaces 0/0 | FI / FI | Forma alternativa; diferencia textual no se cuenta como error. |
| B61-I13 [CID 11230](https://pubchem.ncbi.nlm.nih.gov/compound/11230) | 4-methyl-1-propan-2-ylcyclohex-3-en-1-ol | C10H18O | átomos 0/1; enlaces 0/0 | PS / PS | Alcohol/insaturación detectados; gramática FULL no cubre esta combinación. |
| B61-I14 [CID 11142](https://pubchem.ncbi.nlm.nih.gov/compound/11142) | 3-methylidene-6-propan-2-ylcyclohexene | C10H16 | átomos 0/1; enlaces 0/0 | PS / PS | Antes metil perdía =CH2; ahora metilideno. Equivalencia completa pendiente. |
| B61-I15 [CID 637563](https://pubchem.ncbi.nlm.nih.gov/compound/637563) | 1-methoxy-4-[(E)-prop-1-enyl]benzene | C10H12O | átomos 0/0; enlaces 1/0 | US / US | Antes propilo perdía C=C/E. Ahora bloqueo por estereoquímica de rama no expresable. |
| B61-I16 [CID 6552009](https://pubchem.ncbi.nlm.nih.gov/compound/6552009) | (1R,2S,4R)-1,7,7-trimethylbicyclo[2.2.1]heptan-2-ol | C10H18O | átomos 3/0; enlaces 0/0 | US / US | Importador editable rechaza sistema puenteado con tres centros definidos; no se elimina estereoquímica. |
| B61-I17 [CID 8465](https://pubchem.ncbi.nlm.nih.gov/compound/8465) | 1-(3,4-dihydroxyphenyl)-2-(propan-2-ylamino)ethanone | C11H15NO3 | átomos 0/0; enlaces 0/0 | US / US | Bloqueo local preexistente para esta combinación de funciones/sustitución. |
| B61-I18 [CID 11849](https://pubchem.ncbi.nlm.nih.gov/compound/11849) | 1,3,5-trimethyl-2,4-dinitrobenzene | C9H10N2O4 | átomos 0/0; enlaces 0/0 | PS / PS | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |
| B61-I19 [CID 7498](https://pubchem.ncbi.nlm.nih.gov/compound/7498) | bromomethylbenzene | C7H7Br | átomos 0/0; enlaces 0/0 | US / US | Bloqueo local preexistente; no confundir bromometilo con bromo + metilo del anillo. |
| B61-I20 [CID 23094808](https://pubchem.ncbi.nlm.nih.gov/compound/23094808) | 3,5-dichloro-2-ethoxybenzaldehyde | C9H8Cl2O2 | átomos 0/0; enlaces 0/0 | PS / PS | Coincidencia literal EN con pareja externa; no reconstrucción independiente. |

## Observación ciega y resultado final por perfil

Se usa blind-reviewed.json: conserva los nombres del motor anterior a las correcciones y corrige sólo el comparador de fórmulas del auditor. blind.json crudo permanece disponible. El corpus no se reemplazó tras observar resultados.

| ID | Idioma | Nombre ciego | Auditoría ciega | Nombre final | Auditoría final |
|---|---|---|---|---|---|
| B61-I01 | es | 4-etoxibenzaldehído | FULL-INTERNAL-ONLY | 4-etoxibenzaldehído | FULL-INTERNAL-ONLY |
| B61-I01 | en | 4-ethoxybenzaldehyde | FULL-INTERNAL-ONLY | 4-ethoxybenzaldehyde | FULL-INTERNAL-ONLY |
| B61-I02 | es | 2-etoxibenzaldehído | FULL-INTERNAL-ONLY | 2-etoxibenzaldehído | FULL-INTERNAL-ONLY |
| B61-I02 | en | 2-ethoxybenzaldehyde | FULL-INTERNAL-ONLY | 2-ethoxybenzaldehyde | FULL-INTERNAL-ONLY |
| B61-I03 | es | 4-etilbenzamida | FULL-INTERNAL-ONLY | 4-etilbenzamida | FULL-INTERNAL-ONLY |
| B61-I03 | en | 4-ethylbenzamide | FULL-INTERNAL-ONLY | 4-ethylbenzamide | FULL-INTERNAL-ONLY |
| B61-I04 | es | N-etil-4-metilbenzamida | PARTIAL-SAFE | N-etil-4-metilbenzamida | PARTIAL-SAFE |
| B61-I04 | en | N-ethyl-4-methylbenzamide | PARTIAL-SAFE | N-ethyl-4-methylbenzamide | PARTIAL-SAFE |
| B61-I05 | es | 4-fluorobenzonitrilo | PARTIAL-SAFE | 4-fluorobenzonitrilo | PARTIAL-SAFE |
| B61-I05 | en | 4-fluorobenzonitrile | PARTIAL-SAFE | 4-fluorobenzonitrile | PARTIAL-SAFE |
| B61-I06 | es | 3,4-difluorobenzonitrilo | PARTIAL-SAFE | 3,4-difluorobenzonitrilo | PARTIAL-SAFE |
| B61-I06 | en | 3,4-difluorobenzonitrile | PARTIAL-SAFE | 3,4-difluorobenzonitrile | PARTIAL-SAFE |
| B61-I07 | es | 2-fenil-2-hidroxietanonitrilo | PARTIAL-SAFE | 2-fenil-2-hidroxietanonitrilo | PARTIAL-SAFE |
| B61-I07 | en | 2-phenyl-2-hydroxyethanenitrile | FAIL-NAME | 2-hydroxy-2-phenylethanenitrile | PARTIAL-SAFE |
| B61-I08 | es | hexanoato de propilo | FAIL-NAME | hexanoato de prop-2-en-1-ilo | PARTIAL-SAFE |
| B61-I08 | en | propyl hexanoate | FAIL-NAME | prop-2-en-1-yl hexanoate | PARTIAL-SAFE |
| B61-I09 | es | 1-bromobutan-2-ona | PARTIAL-SAFE | 1-bromobutan-2-ona | PARTIAL-SAFE |
| B61-I09 | en | 1-bromobutan-2-one | PARTIAL-SAFE | 1-bromobutan-2-one | PARTIAL-SAFE |
| B61-I10 | es | 3-etil-3,5,5-trimetilciclohexanona | FULL-INTERNAL-ONLY | 3-etil-3,5,5-trimetilciclohexanona | FULL-INTERNAL-ONLY |
| B61-I10 | en | 3-ethyl-3,5,5-trimethylcyclohexanone | FULL-INTERNAL-ONLY | 3-ethyl-3,5,5-trimethylcyclohexanone | FULL-INTERNAL-ONLY |
| B61-I11 | es | 4-etilciclohexanona | FULL-INTERNAL-ONLY | 4-etilciclohexanona | FULL-INTERNAL-ONLY |
| B61-I11 | en | 4-ethylcyclohexanone | FULL-INTERNAL-ONLY | 4-ethylcyclohexanone | FULL-INTERNAL-ONLY |
| B61-I12 | es | 2-etil-3-metilciclohexanona | FULL-INTERNAL-ONLY | 2-etil-3-metilciclohexanona | FULL-INTERNAL-ONLY |
| B61-I12 | en | 2-ethyl-3-methylcyclohexanone | FULL-INTERNAL-ONLY | 2-ethyl-3-methylcyclohexanone | FULL-INTERNAL-ONLY |
| B61-I13 | es | 4-metil-1-(1-metiletil)ciclohex-3-en-1-ol | PARTIAL-SAFE | 4-metil-1-(1-metiletil)ciclohex-3-en-1-ol | PARTIAL-SAFE |
| B61-I13 | en | 4-methyl-1-(1-methylethyl)cyclohex-3-en-1-ol | PARTIAL-SAFE | 4-methyl-1-(1-methylethyl)cyclohex-3-en-1-ol | PARTIAL-SAFE |
| B61-I14 | es | 3-metil-6-(1-metiletil)ciclohex-1-eno | FAIL-NAME | 3-(1-metiletil)-6-metilidenociclohex-1-eno | PARTIAL-SAFE |
| B61-I14 | en | 3-methyl-6-(1-methylethyl)cyclohex-1-ene | FAIL-NAME | 3-(1-methylethyl)-6-methylidenecyclohex-1-ene | PARTIAL-SAFE |
| B61-I15 | es | 1-metoxi-4-propilbenceno | FAIL-NAME | — | UNSUPPORTED-SAFE |
| B61-I15 | en | 1-methoxy-4-propylbenzene | FAIL-NAME | — | UNSUPPORTED-SAFE |
| B61-I16 | es | — | UNSUPPORTED-SAFE | — | UNSUPPORTED-SAFE |
| B61-I16 | en | — | UNSUPPORTED-SAFE | — | UNSUPPORTED-SAFE |
| B61-I17 | es | — | UNSUPPORTED-SAFE | — | UNSUPPORTED-SAFE |
| B61-I17 | en | — | UNSUPPORTED-SAFE | — | UNSUPPORTED-SAFE |
| B61-I18 | es | 1,3,5-trimetil-2,4-dinitrobenceno | PARTIAL-SAFE | 1,3,5-trimetil-2,4-dinitrobenceno | PARTIAL-SAFE |
| B61-I18 | en | 1,3,5-trimethyl-2,4-dinitrobenzene | PARTIAL-SAFE | 1,3,5-trimethyl-2,4-dinitrobenzene | PARTIAL-SAFE |
| B61-I19 | es | — | UNSUPPORTED-SAFE | — | UNSUPPORTED-SAFE |
| B61-I19 | en | — | UNSUPPORTED-SAFE | — | UNSUPPORTED-SAFE |
| B61-I20 | es | 3,5-dicloro-2-etoxibenzaldehído | PARTIAL-SAFE | 3,5-dicloro-2-etoxibenzaldehído | PARTIAL-SAFE |
| B61-I20 | en | 3,5-dichloro-2-ethoxybenzaldehyde | PARTIAL-SAFE | 3,5-dichloro-2-ethoxybenzaldehyde | PARTIAL-SAFE |

## Español: comprobación de adaptación limitada

No hay referencia completa española independiente para estos 20 registros. Se revisaron términos, funciones, localizadores y orden de cita con la [Guía breve RSEQ/IUPAC](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf), §§3e, 5.4, 7c–f y 8. No se usó una transformación ES→EN del producto como certificador. Esta revisión manual, posterior a la observación ciega, no promociona perfiles a FV ni elimina PENDING-EXTERNAL.

| ID | Nombre ES revisado | Reglas/adaptación observadas |
|---|---|---|
| B61-I01 | 4-etoxibenzaldehído | etoxi, benzaldehído y localizador 4; misma posición del registro EN. |
| B61-I02 | 2-etoxibenzaldehído | etoxi, benzaldehído y localizador 2; regioisómero distinto de I01. |
| B61-I03 | 4-etilbenzamida | etil, benzamida y localizador 4. |
| B61-I04 | N-etil-4-metilbenzamida | N-etil distingue sustitución del nitrógeno; metil del anillo conserva C4. |
| B61-I05 | 4-fluorobenzonitrilo | fluoro en C4 y sufijo benzonitrilo. |
| B61-I06 | 3,4-difluorobenzonitrilo | di-fluoro y conjunto 3,4 del benzonitrilo. |
| B61-I07 | 2-fenil-2-hidroxietanonitrilo | fenil precede a hidroxi en español; ambos en C2 del etanonitrilo. acetonitrilo/etanonitrilo no se igualan sólo por texto. |
| B61-I08 | hexanoato de prop-2-en-1-ilo | éster con «de»; prop-2-en-1-ilo expresa el doble enlace y la posición de unión. La omisión de -1- de la referencia no se penaliza por texto. |
| B61-I09 | 1-bromobutan-2-ona | bromo en C1 y cetona en C2; sufijo -ona. |
| B61-I10 | 3-etil-3,5,5-trimetilciclohexanona | etil precede a metil; tri- conserva 3,5,5; cetona cíclica con C1 omitido. |
| B61-I11 | 4-etilciclohexanona | etil en C4 y cetona cíclica con C1 omitido. |
| B61-I12 | 2-etil-3-metilciclohexanona | etil en C2 antes de metil en C3; cetona cíclica con C1 omitido. |
| B61-I13 | 4-metil-1-(1-metiletil)ciclohex-3-en-1-ol | -3-en-1-ol conserva función e insaturación; 1-metiletil es una presentación alternativa de propan-2-il. |
| B61-I14 | 3-(1-metiletil)-6-metilidenociclohex-1-eno | metilideno conserva =CH2; 1-metiletil y metilideno cambian orden de cita respecto de la pareja methylidene/propan-2-yl de la fuente. Diferencia textual no implica fallo. |
| B61-I18 | 1,3,5-trimetil-2,4-dinitrobenceno | metil antes de nitro, sin ordenar por tri-/di-; conjuntos 1,3,5 y 2,4. |
| B61-I20 | 3,5-dicloro-2-etoxibenzaldehído | cloro antes de etoxi; di- y posiciones 3,5/2 conservadas. |

## Mutaciones separadas del corpus externo

| ID | Eje | Clase esperada | Nombre de control | ¿Debe obtener FULL? |
|---|---|---|---|---|
| B61-M01 | regioisomer | valid-other-structure | 2-ethylbenzamide | no |
| B61-M02 | principal-function | valid-other-structure | 4-ethylbenzaldehyde | no |
| B61-M03 | branch-length | valid-other-structure | 4-propylbenzamide | no |
| B61-M04 | functional-placement | valid-other-structure | N-ethylbenzamide | no |
| B61-M05 | ring-unsaturation | valid-other-structure | 4-ethylcyclohex-2-en-1-one | no |
| B61-M06 | halogen | valid-other-structure | 4-chlorobenzonitrile | no |
| B61-M07 | ring-versus-side-chain | valid-other-structure | 1-bromo-2-methylbenzene | no |
| B61-M08 | branch-internal-locant | unjustified-branch-numbering | 4-methyl-1-(2-methylethyl)cyclohex-3-en-1-ol | no |
| B61-M09 | numbering-orientation | same-connectivity-nonminimal-numbering | 6-ethoxybenzaldehyde | no |
| B61-M10 | equivalent-locant-omission | valid-same-structure | 4-ethylcyclohexanone | sí |
| B61-M11 | explicit-suffix-locant | valid-same-structure | 4-ethylcyclohexan-1-one | sí |
| B61-M12 | retained-versus-systematic | valid-but-outside-verifier-coverage | 2-hydroxy-2-phenylacetonitrile | no |
| B61-M13 | nested-delimiters | syntactically-invalid | 4-([ethoxy))benzaldehyde | no |
| B61-M14 | repeated-locant-without-multiplier | syntactically-invalid | 4,4-ethoxybenzaldehyde | no |
| B61-M15 | ring-bond-position | valid-other-structure | 4-ethylcyclohex-3-en-1-one | no |


M09 tiene la misma conectividad pero numeración no mínima; no es un isómero diferente. M10/M11 aceptan dos textos válidos de la misma estructura. M12 es nombre de referencia válido fuera de cobertura. M08 no tiene una interpretación independiente demostrada: su numeración interna carece de justificación; su rechazo conservador no se convierte en una afirmación de invalidez universal. M13/M14 son controles sintácticos fuera de la forma admitida.
