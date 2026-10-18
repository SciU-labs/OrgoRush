# OrgoRush — AUD-NOM-001

Fecha de revisión: 2026-10-18. Fase diagnóstica; sin reparaciones de producción, commit ni push.

## Baseline y protección

HEAD: `812f72547a6b02d55d4c600f648893376ac742fc` — fix(aud002): include linking vowel in legacy cyclic parent fragments. Coincide con el baseline público 812f725. Estado inicial: únicamente `?? reports/orgorush-aud001-repair.md`; no había cambios rastreados. Los hashes de producción, corpus protegido, manifiesto y regresiones históricas auditadas permanecen idénticos. No se editó Practice/Exam, ningún expected previo ni referencias gold.

La interfaz ofrece current y Legacy 1979 en ES/EN. Se sigue la ruta local real de Home, sin alias opcionales, fuente externa ni PubChem. Para entradas configuradas, la opción de estereoquímica está activada. Se usan análisis moderno y Legacy distintos. Los nombres no disponibles se cuentan como UNSUPPORTED, no como nombres erróneos.

## Matriz y cobertura

**440 identidades OCL distintas adicionales**, cero duplicados del corpus protegido de 184 (179 gold, 5 silver). 433 importadas; 7 rechazos explícitos. Ignorando estereoquímica e isótopos hay 433 constituciones distintas; 430 son nuevas frente al corpus y 423 nuevas constituciones fueron importadas. Semilla decimal 10539009, versión AUD-NOM-001-v1. Se conservan 22 candidatos descartados con motivos en audit-exclusions.json.

La admisión del laboratorio no se filtra por Practice/Exam. La observación suplementaria del validador vigente es {"ACCEPTED":199,"OUTSIDE_ALL_CURRENT_CATEGORIES":233,"NOT_ASSESSED":8}; nunca se usó para excluir candidatos. 228 de las estructuras fuera de esas categorías recibieron nombre local en algún perfil. Sus categorías completas actuales no equivalen al perfil conservador del corpus de referencia.

| Familia | Estructuras | Importadas | Nombres 2013 ES / EN / 1979 ES / EN | Interpretaciones EN distintas |
|---|---:|---:|---|---:|
| alkanes | 35 | 35 | 35 / 35 / 16 / 35 | 0 |
| alkenes | 30 | 30 | 30 / 30 / 30 / 30 | 0 |
| alkynes | 25 | 25 | 25 / 25 / 25 / 25 | 0 |
| multi-unsaturated | 25 | 25 | 25 / 25 / 5 / 25 | 0 |
| carbocycles | 40 | 40 | 40 / 40 / 25 / 40 | 0 |
| aromatics | 35 | 35 | 32 / 32 / 3 / 32 | 4 |
| halogenated | 25 | 25 | 25 / 25 / 8 / 25 | 0 |
| alcohols-polyols | 30 | 30 | 30 / 30 / 30 / 30 | 0 |
| carbonyls | 40 | 40 | 40 / 40 / 29 / 40 | 0 |
| carboxylic-acids | 20 | 20 | 20 / 20 / 9 / 20 | 6 |
| ethers-esters | 35 | 35 | 35 / 35 / 0 / 35 | 0 |
| nitrogen-functions | 40 | 40 | 40 / 40 / 0 / 40 | 33 |
| mixed-functions | 30 | 30 | 30 / 30 / 15 / 30 | 0 |
| stereo-polycycles-limits | 30 | 23 | 21 / 21 / 9 / 14 | 8 |

## Cuatro perfiles: resultados separados

1760 proyecciones previstas; 1481 nombres disponibles.

| Perfil | Nombres | UNSUPPORTED | Exactos verificados PASS | Exactos sin verificar | Estructura independiente MATCH / MISMATCH |
|---|---:|---:|---:|---:|---:|
| 2013-es | 428 | 12 | 0 | 428 | 0 / 0 |
| 2013-en | 428 | 12 | 20 | 408 | 164 / 3 |
| 1979-es | 204 | 236 | 0 | 204 | 0 / 0 |
| 1979-en | 421 | 19 | 6 | 415 | 115 / 48 |

Las 20 estructuras revisadas individualmente aportan **26 expectativas exactas inglesas**: 20 modernas y seis Legacy. Todas coinciden y sus interpretaciones independientes son MATCH. Las derivaciones y enlaces primarios constan en audit-cases.json y sources.json. Se distingue política sistemática del proyecto de una afirmación universal sobre PIN. No se convirtió traducción automática en referencia española.

**420 estructuras y 1455 salidas disponibles carecen de referencia exacta adjudicada.** Su nivel sigue siendo GENERATED; ni generación ni round-trip los convierten en oráculos. No se promovieron automáticamente casos a SILVER/GOLD. El corpus protegido conserva sus niveles originales.

OPSIN: 245 recibos ingleses únicos ({"live-independent-OPSIN":240,"existing-frozen-reference-receipt":5}), con URL exacta, cuerpo original, fecha y SHA-256. {"MATCH":279,"UNVERIFIED":519,"MISMATCH":51} sobre los textos de salida realmente interpretados. La consulta ampliada se dirigió a N-sustitución y multiplicidad tras encontrar contradicciones; es una muestra intencional, no una tasa de defectos extrapolable a todas las moléculas. Los fallos iniciales de red se preservan como intentos fallidos, no evidencia química; las consultas autorizadas posteriores obtuvieron los recibos. PubChem no fue consultado.

## Propiedades estructurales y semánticas

| Propiedad | PASS | FAIL | SKIP | No aplicable |
|---|---:|---:|---:|---:|
| importExportIdentity | 432 | 1 | 7 | 0 |
| determinism | 433 | 0 | 0 | 7 |
| nameDeterminism | 433 | 0 | 0 | 7 |
| profileLanguageReturn | 428 | 0 | 5 | 7 |
| analysisImmutability | 433 | 0 | 0 | 7 |
| coordinateIndependence | 433 | 0 | 0 | 7 |
| themeDOM | 0 | 0 | 433 | 7 |
| equivalentRepresentations | 406 | 0 | 27 | 7 |
| roundTripIdentity | 432 | 1 | 0 | 7 |
| graphImmutability | 433 | 0 | 0 | 7 |

Se compararon 565 representaciones SMILES alternativas con identidad OCL previamente confirmada. El ensayo de representación aplica escala positiva y traslación a coordenadas; no se probó un cambio real de tema en navegador ni una sesión DOM. Idioma/perfil se ensaya en el modelo de producción, con retorno al modelo inicial e inmutabilidad de ambos análisis.

La identidad canónica conserva órdenes, cargas, isótopos y estado estéreo; no se comparan fórmulas o cadenas SMILES como sustituto de igualdad química. Los siete rechazos de importación corresponden a límites fusionados/puenteados/espiro y cargas no admitidas. La pérdida de 13C es una aceptación con pérdida y se separa de esos rechazos seguros. No se detectó mutación del grafo editable, no determinismo ni cambio de nombre entre los equivalentes verificados.

Los grupos funcionales y sus átomos proceden de producción. La comparación con P-41 comprueba el orden sobre esos grupos detectados; no constituye un detector independiente. Los intervalos contenidos de numeración/sufijo son legítimos; solo se señalan cruces parciales y duplicados de la misma sección. Las dos señales iniciales de cierre en piridina no prueban un análisis erróneo: se revisaron como limitación del comprobador. El texto real C6=C7 sí es contradictorio y se documenta por separado.

## Hallazgos por causa probable

11 grupos confirmados; {"P0":1,"P1":4,"P2":6}. Los recuentos de casos y perfiles pueden solaparse entre grupos y no deben sumarse como moléculas independientes.

| ID | Prioridad | Causa / manifestación | Casos / salidas afectadas |
|---|---|---|---:|
| AUDNOM-001 | P0 | Importación aceptada elimina silenciosamente la etiqueta isotópica | 1 / 4 |
| AUDNOM-002 | P1 | Legacy EN omite los sustituyentes unidos al nitrógeno | 33 / 33 |
| AUDNOM-003 | P1 | Una cadena funcional unida a un arilo metilado se nombra como fenilo sin sustituir | 2 / 8 |
| AUDNOM-004 | P1 | Legacy EN reduce ácidos dicarboxílicos a monocarboxílicos | 6 / 6 |
| AUDNOM-005 | P1 | Legacy EN elimina R/S aun con estereoquímica explícita activada | 6 / 6 |
| AUDNOM-006 | P2 | Legacy ES duplica el prefijo E/Z al activar la variante estereoquímica | 4 / 4 |
| AUDNOM-007 | P2 | El radical non Legacy se localiza dentro de la terminación y cruza el sufijo | 5 / 10 |
| AUDNOM-008 | P2 | En ácidos insaturados modernos, eno invade el sufijo oic/oico | 5 / 10 |
| AUDNOM-009 | P2 | Localizadores repetidos se emiten dos veces en la misma sección Legacy | 32 / 40 |
| AUDNOM-010 | P2 | La explicación de piridina inventa C7 al describir el cierre del anillo | 1 / 2 |
| AUDNOM-011 | P2 | Etiquetas funcionales españolas aparecen en explicaciones Legacy EN | 76 / 76 |

El P0 se limita a pérdida silenciosa de identidad isotópica en una entrada aceptada; no implica corrupción generalizada de conectividad. Las 51 interpretaciones EN distintas se agrupan en pérdida de N-alquilo, metilo arílico, segundo carboxilo, R/S o isótopo. No son 51 causas distintas. Ninguna de estas conclusiones depende de exigir a todos los nombres una única grafía preferida.

## Próxima fase de reparación

1. Proteger la frontera de importación isotópica: conservar o rechazar antes de editar/exportar.
2. Corregir o bloquear salidas incompletas de N-sustitución, arilos sustituidos y diácidos; son cambios de identidad, no variantes ortográficas. Mantener los cuatro perfiles contra su propio análisis.
3. Conservar R/S y evitar doble prefijación E/Z al activar estereoquímica.
4. Resolver límites de fragmentos (non, en/oic y numeración duplicada), después cierre heterocíclico y etiquetas EN.
5. Añadir regresiones por causa con vecinos y referencias independientes; ejecutar certificación completa en CI después de las reparaciones. Ampliar referencias exactas españolas y de familias no adjudicadas mediante revisión individual.

## Validación y reproducción

- **node scripts/naming-audit/run.mjs**: COMPLETED; 186.87 s. 440 estructuras, 18 lotes, cuatro perfiles; las señales y los nombres sin oráculo se informan, no se convierten en PASS de nomenclatura.
- **node --test tests/naming-audit/diagnostics.test.mjs**: 5 PASS; 11 FAIL diagnósticos confirmados; 0 SKIP; 0 TODO; 91.15 s. 16 pruebas. Carga producción real y reproduce los 11 grupos; esta fase no repara el motor ni ajusta expectativas para ocultarlos.
- **npm run test:reference-corpus**: 792 PASS; 0 FAIL; 5 SKIP; 141.17 s. 797 pruebas. Las cinco omisiones son los casos silver ya documentados; se verifican esquema, referencias, identidad y protección del manifiesto.
- **npm run report:reference-corpus**: PASS; 91.45 s. 184 entradas: 179 gold exactos PASS, cinco silver SKIP; 184 estructuras esperadas y 184 observadas PASS, cero peticiones de red. Resultado nuevo copiado aquí y archivo histórico restaurado byte por byte.
- **npm run build:pages**: PASS; 12.59 s. Avisos de importación dinámica compartida y tamaño de bundle, sin error de compilación. Ningún código de producción fue cambiado.
- **npm run validate:pages**: PASS; 1.61 s. Tres entradas, seis assets, base /Hydrocarbon-Lab/.
- **git diff --check**: PASS; 0.40 s. No hay cambios en archivos rastreados; los artefactos de auditoría son nuevos y están sin seguimiento.

La suite diagnóstica es optativa en tests/naming-audit/diagnostics.test.mjs. Comprueba producción real y conserva fallos para los defectos confirmados; no se incorpora silenciosamente al glob de CI ni se usa skip/todo para ocultarlos. El runner conserva 18 lotes; una reejecución con los mismos hashes los reutiliza. Las fuentes externas se consumen desde recibos locales al generar informes y ejecutar diagnósticos.

Archivos nuevos: scripts/naming-audit/, tests/naming-audit/diagnostics.test.mjs y reports/naming-audit/. Ningún archivo de producción, referencia protegida ni prueba histórica fue modificado. El informe AUD-001 previamente sin seguimiento permanece intacto. Consultar README.md para comandos. No se ejecutó npm test completo. Esta auditoría no certifica conformidad IUPAC exhaustiva y no atribuye exactitud a los 440 nombres por el solo hecho de haber sido generados.
