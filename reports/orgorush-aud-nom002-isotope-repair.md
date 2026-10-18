# OrgoRush — AUD-NOM-002: integridad isotópica

Fecha: 2026-10-18. HEAD inicial: `c7b2c091b33bacb2482afc0df59fe7be39fe14f4`.

## Causa y reparación

OpenChemLib 9.25.0 conserva la masa isotópica al interpretar SMILES. Su declaración
`getAtomMass()` documenta **0 para abundancia natural** y el número másico para un
isótopo específico. Se verificó con el parser instalado, antes y después de
`ensureHelperArrays(cHelperCIP)`, incluidos `[12CH3]CO`, `C[1H]` y `C[16O]`.

`GeneratedAtom` no contiene masa isotópica. `moleculeFromSmiles()` copiaba elemento,
carga y configuración tetraédrica, omitiendo todos los hidrógenos explícitos. La
exportación mediante `buildOpenChemLibStereoGraph()` reconstruía átomos sin masa.
Así, `[13CH3]CO` producía `CCO`; `C[2H]` y `C[3H]` producían `C`.

Ahora `moleculeFromSmiles()` recorre `getAllAtoms()` inmediatamente después del
parseo y rechaza cualquier masa distinta de 0 antes de construir el grafo editable
u omitir hidrógenos. Devuelve únicamente `{ ok: false, error }`, sin `molecule`:

> La estructura contiene isótopos explícitos que el editor todavía no admite.
> No se importó para evitar alterar su identidad química.

No se analiza el texto buscando dígitos ni se elimina ninguna anotación. Los
errores sintácticos continúan separados del rechazo por capacidad no admitida.
**Es rechazo seguro, no soporte isotópico completo.**

## Cobertura y rutas

- Rechazo de los seis casos solicitados: `[13CH3]CO`, `[13C]`, `C[2H]`, `C[3H]`,
  `[15NH2]C`, `C[18O]`. Todos son válidos para el parser real.
- También se rechazan los isótopos explícitos de abundancia mayoritaria,
  `[13CH2]1CCCCC1` y `C[C@H]([2H])O`, cuya identidad incluye hidrógeno isotópico.
- Importación y exportación normales de `CCO`, `OCC`, `C1CCCCC1`,
  `C%10CCCCC%10`, `[H]C`, `[CH3]CO`, nitro con cargas, aromáticos, triples enlaces,
  E/Z y R/S. Se compara la identidad canónica completa OCL y la fórmula; además
  se comprueban explícitamente cargas y estereoquímica almacenadas.
- `inspectSmilesStructure()` propaga el mismo rechazo. Las rutas de resolución
  por nombre, candidatos por fórmula, contextos y plantillas utilizan el
  adaptador o esa inspección y comprueban `ok` antes de utilizar el grafo.
- Las pruebas ejecutan las acciones reales `importSmilesString` e
  `importSmilesDocument` extraídas del AST de `app/page.tsx`, en ES y EN. Con un
  estado previo que incluye cargas, R/S, E/Z, undo/redo y datos guardados, los
  once casos isotópicos producen feedback de error sin alcanzar análisis,
  commit, sustitución de estado ni escrituras persistentes. Se conservan tanto
  referencias como contenido del estado previo. El autoguardado del editor
  depende de la molécula y la vista; el rechazo no modifica ninguna de ellas.

## Validación

- `node --test tests/smiles-isotope-integrity.test.mjs`: **28 PASS, 0 FAIL**.
- Pruebas existentes con `--test-concurrency=1`: **72 PASS, 0 FAIL**:
  `smiles-text-import`, `smiles-file`, `stress-smiles`,
  `tetrahedral-stereochemistry`, `double-bond-stereochemistry`,
  `formula-candidate-resolver`, `formula-candidate-integration`, `compound-context`.
  El stress incluye 3900 ciclos importación/exportación.
- `node --test --test-name-pattern="AUDNOM-001:" tests/naming-audit/diagnostics.test.mjs`:
  **1 PASS, 0 FAIL**. El diagnóstico exige ahora rechazo explícito por isótopos.
- `npm run build:pages`: **PASS**. Vite mantiene los avisos de tamaño de bundle
  e importación estática/dinámica compartida; no hay errores de compilación.
- `npm run validate:pages`: **PASS**.
  `PAGES_ARTIFACT={"entries":3,"assets":6,"base":"/Hydrocarbon-Lab/"}`.
- No se ejecutó `npm test` completo.

## Historia y alcance

Se conservan sin cambios `reports/naming-audit/audit-findings.*`, `audit-matrix.json`,
`audit-cases.json`, `baseline.json` y los recibos de evidencia de la auditoría de
440 estructuras. Siguen documentando la observación original AUDNOM-001 sobre
el código anterior. Esta nota registra su reparación posterior; no sustituye
ni regenera esos resultados históricos.

La única modificación de producción está en `app/openchemlib-adapter.ts`.
Se añaden las pruebas permanentes en `tests/smiles-isotope-integrity.test.mjs`
y se actualiza exclusivamente el caso AUDNOM-001 de
`tests/naming-audit/diagnostics.test.mjs`. No se modifican nomenclatura,
fragmentos, Practice/Exam ni referencias protegidas.

No se hizo commit ni push. Los ocho archivos sin seguimiento presentes al
inicio de la intervención se conservan.
