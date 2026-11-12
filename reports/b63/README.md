# B6.3 — validación terminológica española

Revisión realizada el **11 de noviembre de 2026** sobre el commit estable `81b26bd1f7aa51a8a3880b49f18c622230e48a23`, reutilizando las 84 filas de B6.2.2. Se revisaron los **69 perfiles con nombre español disponible, 66 nombres distintos**, mediante aplicación manual de reglas publicadas y contraste del vocabulario. No se añadió un parser español ni se convirtió el puente ES→EN del producto en fuente normativa.

## Resultado y alcance

| Categoría de auditoría ES | Filas | Interpretación |
|---|---:|---|
| ES-DIRECTLY-SUPPORTED | 0 | Ninguna fuente consultada acredita el nombre español completo exacto de un derivado del corpus. |
| ES-RULE-SUPPORTED | 68 | Construcción respaldada por reglas y términos publicados; incluye las dos filas de B61-I07. |
| ES-STRUCTURALLY-CONSISTENT | 1 | B50-CID7439: queda pendiente el respaldo terminológico específico de la rama «1-metilvinil». |
| ES-INCORRECT | 0 | No se demostró un error español que justificase modificar producción. |
| ES-INCONCLUSIVE | 15 | Filas sin nombre activo; no se adjudica una denominación ausente. |

Entre los nombres disponibles son 65 nombres distintos respaldados por reglas y uno pendiente de evidencia más específica. Los 15 registros sin nombre no se incluyen en esas 66 denominaciones. Las categorías ES son independientes de FULL/PARTIAL/UNSUPPORTED y no certifican PIN. El estado de cada fila, sus nombres, fuentes, locantes, sintaxis y alternativas se conserva en [matrix.md](matrix.md); las estructuras, fórmulas, hashes y decisiones están en [audit.json](audit.json).

## B61-I07: recuperación de las dos observaciones

Las filas **46** (`B61-independent-current`) y **81** (`B61-targeted-prior-failure-recheck`) de B6.2.2 repiten el mismo compuesto. No son dos errores distintos. También aparece en la matriz y README B6.1, en sus perfiles antes/después, y en el apartado de errores previos B6.2. Los informes históricos se conservaron íntegros.

- Fuente original de identidad: [PubChem CID 10758](https://pubchem.ncbi.nlm.nih.gov/compound/10758), referencia congelada B6.1; no se emplea como certificador español.
- SMILES exacto: `C1=CC=C(C=C1)C(C#N)O`; forma esquemática `C6H5–CH(OH)–C≡N`.
- Fórmula molecular: **C8H7NO**. El centro tetraédrico no tiene configuración especificada; el nombre tampoco introduce R/S.
- ES activo y conservado: **2-fenil-2-hidroxietanonitrilo**.
- EN activo: **2-hydroxy-2-phenylethanenitrile**. La referencia original B6.1 usa `2-hydroxy-2-phenylacetonitrile`, que emplea una raíz retenida diferente.
- B6.2.2 ya interpretó EN mediante OPSIN: `OC(C#N)C1=CC=CC=C1`, identidad `deVH@BAIemQfk@@@@`, fórmula concordante. Esta es evidencia estructural heredada, no una nueva ejecución ni un parseo español.

La condición inconclusa anterior procedía del criterio literal del auditor: `SpanishToOpsinCandidate` generaba `2-phenyl-2-hydroxyethanenitrile`, distinto del EN activo por orden de prefijos. El criterio no había comprobado la regla terminológica española; la desigualdad de cadenas no demostraba un error químico.

| Eje | Adjudicación independiente y límite |
|---|---|
| A. Identidad estructural | Nitrilo terminal con OH y fenilo en el carbono adyacente. La equivalencia EN de B6.2.2 corrobora la conectividad; no valida por sí sola la lengua española. |
| B. Terminología | «hidroxi» y «nitrilo» están documentados en S1, tabla 3; la adaptación phenyl→fenil se explica expresamente en S3. S1 §3e exige ordenar los prefijos en el idioma empleado: fenil antes de hidroxi. |
| C. Numeración | El carbono del nitrilo forma parte de la cadena de dos carbonos y es C1; fenilo y OH se unen a C2. El nitrilo tiene prioridad sobre el alcohol (S1 §4 y S2 P-66.5). No hay un nitrilo directamente unido al anillo que justifique usar aquí benzonitrilo como progenitor. |
| D. Preferencia | La forma sistemática con etanonitrilo es admisible en nomenclatura general. S2 P-66.5.1.2.1 conserva acetonitrile, con sustitución ilimitada, como raíz preferida inglesa frente a ethanenitrile. Se infiere la alternativa española «2-fenil-2-hidroxiacetonitrilo», pero no se encontró una referencia específica suficiente para adjudicar un PIN español completo. |

**Fila 46 → ES-RULE-SUPPORTED; fila 81 → ES-RULE-SUPPORTED.** Se resuelve la duda del orden localizado y de la construcción del nombre, sin afirmar apoyo directo al compuesto ni preferencia PIN. Ambas observaciones mantienen el soporte interno PARTIAL y `fullProof: false`. No se cambió su denominación ni el criterio histórico del informe B6.2.2.

## Jerarquía de fuentes y trazabilidad

Primero se aplicaron las reglas químicas del Blue Book; después, la adaptación española RSEQ/IUPAC. Las fuentes léxicas corroboran términos concretos sin sustituir la regla química. Las búsquedas de nombres frecuentes o de fuentes comerciales no se trataron como pruebas de preferencia.

| ID | Autoridad, documento y versión | Sección / evidencia utilizada | Consulta y enlace |
|---|---|---|---|
| S1 | IUPAC; Hellwich, Hartshorn, Yerin, Damhus y Hutton. Traducción y adaptación de Efraím Reyes y Pascual Román Polo, alojada por RSEQ. Guía breve, versión 1.0 diciembre 2021 (inglés 1.1 junio 2021). | §§2.1, 3e–f, tabla 3, 5.1–5.6, 6, 7 y 8. Construcción española, prioridad, locantes, prefijos, sufijos, anilina/fenol/piridina y ésteres. Evidencia general, no específica de los derivados. | 2026-11-11; [Guía RSEQ/IUPAC](https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf). |
| S2 | IUPAC/RSC, Favre y Powell (eds.), Blue Book, recomendaciones 2013, edición web. ISBN 978-0-85404-182-4. | [P-14.4–14.5](https://iupac.qmul.ac.uk/BlueBook/P1.html), [P-29.2](https://iupac.qmul.ac.uk/BlueBook/P2.html), [P-59](https://iupac.qmul.ac.uk/BlueBook/P5.html), [P-65.1.2.2.2](https://iupac.qmul.ac.uk/BlueBook/P6.html), [P-66](https://iupac.qmul.ac.uk/BlueBook/P6a.html). Reglas químicas y distinción de formas generales/preferidas. | 2026-11-11; edición web consultada, sin certificar traducción española. |
| S3 | Reyes, Román y García-Martínez; ACS Omega 2024, 9(4), 4138–4143. DOI 10.1021/acsomega.3c08887. | §1, p.4138: phenyl→fenil puede modificar orden de cita y numeración al adaptar el idioma. Fuente de los propios especialistas en adaptación; no menciona B61-I07. | 2026-11-11; [artículo en repositorio UPV/EHU](https://addi.ehu.es/bitstream/handle/10810/66780/reyes-et-al-2024-language-of-chemistry-making-iupac-nomenclature-available-in-spanish.pdf?sequence=1). |
| S4 | OIT/OMS, ICSC 1103, octubre 1999; versión española INSST ©2018. | Encabezado e identidad CAS 100-47-0: benzonitrilo. Apoyo directo al progenitor, no a los derivados del corpus. | 2026-11-11; [ICSC 1103](https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_card_id=1103&p_lang=es&p_version=2). |
| S5 | El Colegio de México, Diccionario del español de México, índice web sin número de edición indicado. | Índice de voces con marca Química: benzaldehído, benzamida, benzoato. Corroboración ortográfica y léxica; sin atribuir validación nomenclatural de derivados. | 2026-11-11; [índice DEM](https://dem.colmex.mx/moduls/Abreviaturas.aspx?txtAbre=%28Qu%C3%ADm%29&txtDesc=Qu%C3%ADmica&txtTipo=1). |

Las secciones y la naturaleza directa/general del respaldo también figuran en `sources` y `rules` del JSON. El libro español de La Rioja fue localizado, pero la descarga consultada devolvió timeout: no se atribuyen reglas a páginas que no pudieron examinarse. La extracción textual de la guía estuvo disponible; sus capturas PDF fueron bloqueadas por el sitio, por lo que no se presenta evidencia visual de esas capturas. No se usaron traducciones automáticas como normas.

## Hallazgos por causa y decisiones

1. **Orden alfabético localizado:** B61-I07 se resuelve por regla. También se revisaron metil/metoxi y metil/yodo en anillos libres, etil/metil, cloro/etoxi y el efecto de ignorar di/tri al ordenar. El orden ES puede diferir del EN sin perder validez.
2. **Progenitores retenidos:** anilina, fenol, benzaldehído, benzamida y benzonitrilo se contrastaron como componentes; no se convirtió el apoyo al progenitor en apoyo directo del nombre completo.
3. **Función principal y sufijos:** se revisaron ésteres con «de», N-sustitución de amidas, nitrilos frente a hidroxi, cetonas cíclicas y piridina-3,5-dicarboxílico. En el último, N fija 1 y los COOH externos se unen en 3,5; la evidencia terminológica no produce FULL.
4. **Ramas y sintaxis:** se revisaron 2-metilpropil, 1-metiletil, prop-2-en-1-ilo, metilideno y sus paréntesis/localizadores. S2 P-29.2 documenta 1-methylethyl como alternativa a propan-2-yl; no se normalizó el estilo de los nombres admisibles.
5. **Pendiente concreto:** B50-CID7439 conserva ES-STRUCTURALLY-CONSISTENT para la rama «1-metilvinil». No se demostró que sea incorrecta; faltó respaldo específico suficiente para resolver su uso español y preferencia. No se sustituyó por un candidato solo por ser más moderno.
6. **Preferencia no demostrada:** ninguna categoría ES de esta auditoría es un certificado PIN. La revisión por reglas no ofrece un segundo intérprete español de nombres completos ni una firma de un comité nomenclatural.

No se confirmó ninguna de las causas de error propuestas (traducción incorrecta, sufijo incompatible, numeración injustificada, pérdida de locantes o ambigüedad de paréntesis) con evidencia suficiente para editar producción. Por ello no hubo correcciones de código ni pruebas rojas artificiales. Las decisiones son conservadoras para los 15 perfiles sin nombre, incluido ibuprofeno, y para la expresión pendiente de CID7439; los IDs solo identifican observaciones del informe y no se añadieron a producción.

## Verificación y regresiones

Los archivos B6.1/B6.2/B6.2.2 leídos y los fixtures congelados tienen hashes de integridad en `audit.json`. La auditoría no modifica nombres, grafos, soporte, regiones interactivas, dependencias, workflows ni baselines. No se requiere Playwright porque no cambia la presentación o interacción de ningún caso.

Resultados en [verification.json](verification.json): **24/24 pruebas focalizadas aprobadas**, `npm run typecheck` correcto y `git diff --check` correcto. Los ocho hashes de entradas protegidas coinciden. Las suites focalizadas cubren soporte FULL/PARTIAL, B6.1, seis regioisómeros B6.2.1, aspirina/salicílico y la numeración aromática. No se ejecutó la batería completa ni se atribuye una nueva ejecución a las regresiones B4.1/B4.2, V008/014 o B5.0–B5.5 que permanecen sin cambios; se conserva su evidencia histórica. El código de `app/` en HEAD coincide con el commit medido en B6.2.2.

## Prioridades para B6.4

1. Adjudicar «1-metilvinil» y documentar alcance de uso general/preferido con una referencia española especializada.
2. Obtener referencias directas para nombres completos, especialmente amidas N-sustituidas, ésteres insaturados, diácidos heterocíclicos y ramas numeradas.
3. Separar explícitamente en futuras auditorías la admisibilidad general de la preferencia nomenclatural; revisar las raíces retenidas sin imponer uniformidad de estilo.
4. Encargar una revisión humana externa o integrar un intérprete español independiente cuando exista una herramienta adecuada; no presentar el puente ES→EN como sustituto.

No se utilizó OneDrive, ni se hizo commit o push.
