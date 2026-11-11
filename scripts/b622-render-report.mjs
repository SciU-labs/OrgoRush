import { readFileSync, writeFileSync } from 'node:fs';

const audit = JSON.parse(readFileSync('reports/b622/audit.json', 'utf8'));
const current = audit.currentRun;
const clean = (value) => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
const cohorts = [...new Set(audit.rows.map((row) => row.cohort))];
const cohortNames = {
  'B60-constructed-current': 'B6.0 construido (24)',
  'B50-historical-current': 'B5.0 histórico (15)',
  'B61-independent-current': 'B6.1 independiente (20)',
  'B62-frozen-original-cohort': 'B6.2 original congelado (20)',
  'B62-separately-frozen-supplement': 'B6.2 suplemento congelado (1)',
  'B61-targeted-prior-failure-recheck': 'B6.1 rechecks dirigidos, repetidos (4)',
};
const count = (rows, predicate) => rows.filter(predicate).length;
const rowsFor = (cohort) => audit.rows.filter((row) => row.cohort === cohort);

const matrix = [
  '# B6.2.2 — matriz de auditoría independiente',
  '',
  `Auditoría local ejecutada ${current.executedAt}; commit ${current.commit}. Los nombres ingleses actuales se enviaron directamente a OPSIN. La comparación estructural usa OpenChemLib, dependencia compartida con OrgoRush; una coincidencia no certifica PIN. El nombre español no fue interpretado por OPSIN.`,
  '',
  '| Cohorte / ID | Fórmula | Nombre ES actual | Validación ES | Nombre EN actual | OPSIN | Validación EN | Resultado OPSIN B6.2 original |',
  '|---|---|---|---|---|---|---|---|',
];
for (const cohort of cohorts) {
  for (const row of rowsFor(cohort)) {
    const es = row.profiles.es;
    const en = row.profiles.en;
    const sourceStatus = row.originalB62AuditResult ?? 'SIN REGISTRO ANTERIOR';
    matrix.push(`| ${clean(row.id)}${row.repeatOfMainCohort ? ' (repetición)' : ''} | ${clean(row.formulaActual ?? row.formulaReference)} | ${clean(es.name)} | ${clean(es.auditStatus)} | ${clean(en.name)} | ${clean(en.opsin?.status)} | ${clean(en.auditStatus)} | ${clean(sourceStatus)} |`);
  }
}
matrix.push(
  '',
  '## Criterios de lectura',
  '',
  '- `FULL-OPSIN-CONFIRMED`: nombre EN actual con reconstrucción FULL interna y grafo OPSIN equivalente.',
  '- `PARTIAL-VERIFIED`: nombre EN con barrera interna PARTIAL y grafo OPSIN equivalente; no promueve el resultado a FULL.',
  '- `UNSUPPORTED-SAFE`: no se emitió nombre y no se invocó OPSIN.',
  '- ES `FULL-INTERNAL` refleja solo reconstrucción interna. ES `PARTIAL-VERIFIED` refleja una traducción composicional que coincide con EN y OPSIN, no un parseo español independiente.',
  '- Cuatro filas B6.1 se repiten deliberadamente para revalidar fallos previos; no son registros adicionales del corpus.',
);
writeFileSync('reports/b622/matrix.md', `${matrix.join('\n')}\n`, { flag: 'wx' });

const report = [
  '# B6.2.2 — cierre de auditoría química independiente',
  '',
  `## Dictamen: sin contradicciones nuevas detectadas`,
  '',
  `La ejecución fresca de OPSIN ${current.interpreter} cubrió ${current.corpusRecords} filas del manifiesto actual. Se hicieron ${current.invocationCount} llamadas para ${current.uniqueEnglishNames} nombres ingleses distintos: ${current.opsinStatuses.EQUIVALENT ?? 0} equivalencias estructurales; sin diferencias, rechazos ni fallos técnicos. Las filas sin nombre actual permanecen como UNSUPPORTED-SAFE y no se contaron como llamadas.`,
  '',
  'La discrepancia original B62-I11 es una observación histórica ya corregida y no una discrepancia actual nueva: el nombre anterior `3,5-bis(1-methylethyl)pyridine` produjo un grafo distinto. El nombre actual `pyridine-3,5-dicarboxylic acid` produjo con OPSIN C7H5NO4 y un grafo equivalente al fixture. El perfil sigue en `PARTIAL-CANDIDATE` / `PARTIAL-VERIFIED`, con `fullProof: false`; este cierre no altera ni atribuye promoción a la barrera FULL.',
  '',
  '## Corpus repetido',
  '',
  '| Cohorte | Filas | FULL EN confirmados | EN PARTIAL verificados | EN sin nombre seguro |',
  '|---|---:|---:|---:|---:|',
  ...cohorts.map((cohort) => {
    const rows = rowsFor(cohort);
    return `| ${cohortNames[cohort] ?? cohort} | ${rows.length} | ${count(rows, (row) => row.profiles.en.auditStatus === 'FULL-OPSIN-CONFIRMED')} | ${count(rows, (row) => row.profiles.en.auditStatus === 'PARTIAL-VERIFIED')} | ${count(rows, (row) => row.profiles.en.auditStatus === 'UNSUPPORTED-SAFE')} |`;
  }),
  `| **Total** | **${current.corpusRecords}** | **${current.englishAuditStatuses['FULL-OPSIN-CONFIRMED']}** | **${current.englishAuditStatuses['PARTIAL-VERIFIED']}** | **${current.englishAuditStatuses['UNSUPPORTED-SAFE']}** |`,
  '',
  `Se conservaron los corpus originales. Las 20 referencias B6.2 tienen SHA-256 ${current.frozenFixtures[0].sha256}; el suplemento separado de una fila tiene SHA-256 ${current.frozenFixtures[1].sha256}. Cuatro rechecks son filas repetidas, no ampliación de la muestra. Los datos completos por ID, incluidos nombre, fórmula, estado anterior, salida OPSIN y comparación, están en [matrix.md](matrix.md) y [audit.json](audit.json).`,
  '',
  '## Estado bilingüe',
  '',
  `ES: ${current.spanishAuditStatuses['FULL-INTERNAL'] ?? 0} nombres tienen soporte FULL interno, ${current.spanishAuditStatuses['PARTIAL-VERIFIED'] ?? 0} tienen solo coincidencia composicional del puente ES→EN con OPSIN, ${current.spanishAuditStatuses['UNSUPPORTED-SAFE'] ?? 0} no emiten nombre y ${current.spanishAuditStatuses.INCONCLUSIVE ?? 0} quedan inconclusos. No hay intérprete español independiente en este procedimiento.`,
  '',
  'Los dos registros inconclusos son las dos apariciones de B61-I07 (una revalidación repetida). La traducción composicional ordena “phenyl” antes de “hydroxy”, pero el nombre inglés mostrado y aceptado por OPSIN ordena “hydroxy” antes de “phenyl”. OPSIN valida el nombre EN actual; no decide por sí mismo la nomenclatura española. Se requiere revisión terminológica independiente para esa correspondencia. Los estados `FULL-INTERNAL` tampoco equivalen a auditoría lingüística independiente.',
  '',
  '## Comparación con los resultados archivados',
  '',
  'La auditoría B6.2 inicial conserva 83 llamadas históricas (82 equivalentes, 1 discrepancia), 66 nombres distintos y 47 FULL ingleses confirmados. El resultado 1/1 no se borra ni se reescribe: correspondía al nombre pre-corrección de B62-I11. Esta reejecución es una comparación nueva sobre los corpus originales y los nombres actuales, no una edición de los artefactos históricos.',
  '',
  'B62-I15 sigue conservado con su estado histórico, pero ya se documentó como solapamiento con un control B6.1 y no se presenta como novedad independiente. B50-CID3672 (ibuprofeno) permanece bloqueado por el importador; no se generó nombre ni llamada OPSIN. El suplemento B62-S01 permanece en su cohorte separada y tampoco fue admitido; no se incorpora al corpus original.',
  '',
  '## Entorno, método y límites',
  '',
  `- Rama/commit: ${current.branch} / ${current.commit} (${current.executedAt}).`,
  `- Intérprete: ${current.interpreter}. OPSIN se ejecutó localmente; ningún nombre se envió a un servicio remoto.`,
  `- Comparador: ${current.comparator}. Es útil para equivalencia estructural, pero no es independiente de OrgoRush.`,
  '- Una equivalencia OPSIN no certifica un PIN ni la corrección lingüística española.',
  '- Las categorías de familia y sus límites de cobertura permanecen los mismos que en los artefactos B5.0/B6.0/B6.1/B6.2; esta auditoría no añadió familias, reglas ni soporte.',
  '- No hubo cambios de producción, barreras FULL/PARTIAL/UNSUPPORTED, workflows, fixtures congelados, dependencias o JAR.',
  '',
  '## Verificación de cierre',
  '',
  'El cierre significa que esta reejecución no encontró una nueva discrepancia estructural en los nombres EN admitidos. No convierte los casos PARTIAL o UNSUPPORTED en FULL ni clausura las limitaciones de interpretación española señaladas arriba. Resultados de pruebas solicitadas se anexan después de ejecutar las verificaciones focalizadas, el shard CI y typecheck.',
];
writeFileSync('reports/b622/README.md', `${report.join('\n')}\n`, { flag: 'wx' });
console.log(`Rendered ${audit.rows.length} audit rows into reports/b622/README.md and matrix.md`);
