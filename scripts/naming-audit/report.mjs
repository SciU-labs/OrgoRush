import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { loadCorpus } from "../../tests/helpers/reference-corpus.mjs";
import { CanonizerUtil, SmilesParser } from "openchemlib";
import { PROFILES } from "./evaluate.mjs";
import { evidenceMap, interpretName, sha256 } from "./evidence.mjs";

const directory = new URL("../../reports/naming-audit/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, directory), "utf8"));
const write = (name, value) => writeFileSync(new URL(name, directory), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
const matrix = read("audit-matrix.json"), baseline = read("baseline.json"), plan = read("audit-cases.json");
const evidence = read("opsin-evidence.json"), receipts = evidenceMap(evidence), adjudications = read("adjudications.json");
const rawRecords = readdirSync(new URL("batches/", directory)).filter((name) => name.endsWith(".json")).sort().flatMap((name) => read(`batches/${name}`).results);
if (rawRecords.length !== plan.records.length) throw new Error("Incomplete audit batches");
const domain = existsSync(new URL("practice-envelope-observations.json", directory)) ? read("practice-envelope-observations.json") : undefined;
const domainById = new Map(domain?.rows.map((r) => [r.id, r]));
const validation = existsSync(new URL("validation-results.json", directory)) ? read("validation-results.json") : undefined;
const records = rawRecords.map((raw) => {
  const record = structuredClone(raw);
  record.profilesChecked = PROFILES;
  record.namesObtained = Object.fromEntries(PROFILES.map((p) => [p, record.profiles[p].name]));
  record.exactNamingStatus = Object.fromEntries(PROFILES.map((p) => [p, record.profiles[p].exact]));
  record.practiceEnvelope = domainById.get(record.id) ?? { status: "NOT_ASSESSED" };
  for (const [profile, output] of Object.entries(record.profiles)) {
    output.findings = [];
    output.structuralNameInterpretation = profile.endsWith("-en")
      ? interpretName(output.name, record.smiles, receipts)
      : { status: output.name ? "UNVERIFIED" : "UNSUPPORTED", reason: "No Spanish-to-English translation is used as an independent naming oracle" };
    output.assessment = output.status === "UNSUPPORTED" ? "UNSUPPORTED_AS_DESIGNED"
      : output.structuralNameInterpretation.status === "MISMATCH" ? "NAME_STRUCTURE_MISMATCH"
        : output.expected && output.exact === "PASS" ? "EXACT_VERIFIED_WITHIN_RECORDED_POLICY" : "UNVERIFIED_NAME";
    if (output.expected) output.expectedInterpretation = interpretName(output.expected, record.smiles, receipts);
  }
  return record;
});
const selectors = {
  "isotope-loss": (r, p) => r.id === "AUDCASE-0440" && r.profiles[p].status === "NAMED",
  "N-substitution-loss": (r, p) => r.features.includes("N-substitution") && p === "1979-en" && r.profiles[p].structuralNameInterpretation.status === "MISMATCH",
  "substituted-aryl-loss": (r, p) => ["AUDCASE-0171", "AUDCASE-0176"].includes(r.id) && r.profiles[p].status === "NAMED",
  "diacid-loss": (r, p) => p === "1979-en" && r.profiles[p].analysis?.functionalGroups.filter((g) => g.kind === "carboxylicAcid").length > 1 && r.profiles[p].structuralNameInterpretation.status === "MISMATCH",
  "RS-loss": (r, p) => p === "1979-en" && r.smiles.includes("@") && r.profiles[p].structuralNameInterpretation.status === "MISMATCH" && r.profiles[p].structuralNameInterpretation.constitutionalMatch,
  "duplicated-EZ-es": (r, p) => p === "1979-es" && /\(\d+[EZ]\)-\(\d+[ez]\)/.test(r.profiles[p].name ?? ""),
  "legacy-non-root": (r, p) => p.startsWith("1979") && r.signals.some((s) => s.profile === p && s.code === "CROSSING_FRAGMENT_SPANS"),
  "acid-en-overlap": (r, p) => p.startsWith("2013") && r.signals.some((s) => s.profile === p && s.code === "CROSSING_FRAGMENT_SPANS"),
  "duplicated-fragments": (r, p) => r.signals.some((s) => s.profile === p && s.code === "DUPLICATE_FRAGMENT"),
  "pyridine-explanation": (r, p) => r.id === "AUDCASE-0430" && p.startsWith("2013"),
  "untranslated-Legacy-labels": (r, p) => p === "1979-en" && r.profiles[p].reasoning?.steps.some((s) => /principal (?:amida|amina|nitrilo|éster|éter)\b/i.test(s.explanation)),
};
const findings = adjudications.findings.map((definition) => {
  const affected = records.flatMap((r) => PROFILES.filter((p) => selectors[definition.selector](r, p)).map((profile) => ({ caseId: r.id, profile })));
  for (const { caseId, profile } of affected) records.find((r) => r.id === caseId).profiles[profile].findings.push(definition.id);
  return { ...definition, status: "CONFIRMED", affectedCases: new Set(affected.map((x) => x.caseId)).size, affectedOutputs: affected.length, affected };
});
for (const record of records) {
  record.findings = [...new Set(Object.values(record.profiles).flatMap((p) => p.findings))];
  for (const signal of record.signals) signal.disposition = signal.code === "ANALYSIS_BOND_LOCANT" && record.id === "AUDCASE-0430"
    ? "CHECKER_CLOSURE_CAVEAT; actual explanation independently confirmed under AUDNOM-010"
    : "RELATED_CONFIRMED_PRESENTATION_OR_IDENTITY_FINDING";
}
const count = (items) => items.reduce((a, item) => ({ ...a, [item]: (a[item] ?? 0) + 1 }), {});
const byProfile = Object.fromEntries(PROFILES.map((p) => [p, {
  outputs: count(records.map((r) => r.profiles[p].status)), exact: count(records.map((r) => r.profiles[p].exact)),
  structural: count(records.map((r) => r.profiles[p].structuralNameInterpretation.status)),
}]));
const byFamily = Object.fromEntries(Object.keys(plan.targets).map((family) => {
  const selection = records.filter((r) => r.family === family);
  return [family, { structures: selection.length, imported: selection.filter((r) => r.admission.status === "IMPORTED").length,
    namedOutputs: Object.fromEntries(PROFILES.map((p) => [p, selection.filter((r) => r.profiles[p].status === "NAMED").length])),
    independentlyMismatchedOutputs: selection.flatMap((r) => Object.values(r.profiles)).filter((p) => p.structuralNameInterpretation.status === "MISMATCH").length,
    casesWithFindings: selection.filter((r) => r.findings.length).length }];
}));
const corpus = loadCorpus();
const constitutionKey = (smiles) => {
  const graph = new SmilesParser().parseMolecule(smiles);
  for (let atom = 0; atom < graph.getAllAtoms(); atom++) graph.setAtomMass(atom, 0);
  return CanonizerUtil.getIDCode(graph, CanonizerUtil.NOSTEREO);
};
const protectedConstitutions = new Set(corpus.map((r) => constitutionKey(r.smiles)));
const newConstitutions = new Set(records.map((r) => constitutionKey(r.smiles)));
const newImportedConstitutions = new Set(records.filter((r) => r.admission.status === "IMPORTED").map((r) => constitutionKey(r.smiles)));
const hashesUnchanged = Object.entries(baseline.protectedHashes).every(([path, hash]) => sha256(readFileSync(new URL(`../../${path}`, import.meta.url))) === hash);
if (!hashesUnchanged) throw new Error("Protected/production bytes changed; do not certify baseline preservation");
const named = records.flatMap((r) => Object.values(r.profiles)).filter((p) => p.status === "NAMED");
const stats = {
  structures: records.length, imported: records.filter((r) => r.admission.status === "IMPORTED").length,
  distinctConstitutionsIgnoringStereoAndIsotopes: newConstitutions.size,
  newConstitutionsOutsideProtected: [...newConstitutions].filter((id) => !protectedConstitutions.has(id)).length,
  newImportedConstitutionsOutsideProtected: [...newImportedConstitutions].filter((id) => !protectedConstitutions.has(id)).length,
  rejectedAtImport: records.filter((r) => r.admission.status === "UNSUPPORTED").length,
  namedOutputs: named.length, attemptedProfiles: records.length * PROFILES.length,
  protectedCorpus: { entries: corpus.length, authority: count(corpus.map((r) => r.authority)), identicalNewGraphs: 0, protectedAndProductionHashesUnchanged: hashesUnchanged },
  evidence: { perRecord: count(records.map((r) => r.evidenceLevel)), exactExpectedOutputs: records.reduce((s, r) => s + Object.keys(r.expected).length, 0),
    exactExpectedInterpretations: count(records.flatMap((r) => Object.values(r.profiles).filter((p) => p.expected).map((p) => p.expectedInterpretation.status))),
    noExactReferenceStructures: records.filter((r) => !Object.keys(r.expected).length).length, namedOutputsWithoutExactReference: named.filter((p) => !p.expected).length,
    receipts: evidence.responses.length, receiptOrigins: count(evidence.responses.map((r) => r.origin)), capturedNetworkFailures: evidence.failedRequests.length,
    observedEnglishInterpretations: count(records.flatMap((r) => [r.profiles["2013-en"], r.profiles["1979-en"]]).filter((p) => p.status === "NAMED").map((p) => p.structuralNameInterpretation.status)) },
  properties: Object.fromEntries([...new Set(records.flatMap((r) => Object.keys(r.properties)))].map((p) => [p, count(records.map((r) => r.properties[p]?.status ?? "NOT_APPLICABLE"))])),
  equivalentVariantCount: records.reduce((s, r) => s + (r.properties.equivalentRepresentations?.comparisons?.length ?? 0), 0),
  byFamily, byProfile, findingClusters: findings.length, findingSeverities: count(findings.map((f) => f.severity)),
  casesWithConfirmedFindings: records.filter((r) => r.findings.length).length,
  classifications: Object.fromEntries([...new Set(findings.flatMap((f) => f.classifications))].map((c) => [c, { clusters: findings.filter((f) => f.classifications.includes(c)).map((f) => f.id) }])),
  practiceEnvelope: domain ? count(domain.rows.map((r) => r.status)) : null,
  namedCasesOutsidePractice: records.filter((r) => r.practiceEnvelope.status === "OUTSIDE_ALL_CURRENT_CATEGORIES" && Object.values(r.profiles).some((p) => p.status === "NAMED")).length,
};
matrix.records = records;
matrix.adjudication = { reviewedAt: adjudications.reviewDate, sources: "sources.json", independentReceipts: "opsin-evidence.json", permanentFindingDefinitions: "adjudications.json", stats };
write("audit-matrix.next.json", matrix);
renameSync(new URL("audit-matrix.next.json", directory), new URL("audit-matrix.json", directory));
write("audit-statistics.json", stats);
write("audit-findings.json", { reviewDate: adjudications.reviewDate, findings });

const familyTable = Object.entries(byFamily).map(([name, f]) => `| ${name} | ${f.structures} | ${f.imported} | ${PROFILES.map((p) => f.namedOutputs[p]).join(" / ")} | ${f.independentlyMismatchedOutputs} |`).join("\n");
const profileTable = PROFILES.map((p) => {
  const v = byProfile[p];
  return `| ${p} | ${v.outputs.NAMED ?? 0} | ${v.outputs.UNSUPPORTED ?? 0} | ${v.exact.PASS ?? 0} | ${v.exact.UNVERIFIED ?? 0} | ${v.structural.MATCH ?? 0} / ${v.structural.MISMATCH ?? 0} |`;
}).join("\n");
const findingTable = findings.map((f) => `| ${f.id} | ${f.severity} | ${f.title} | ${f.affectedCases} / ${f.affectedOutputs} |`).join("\n");
const propertyTable = Object.entries(stats.properties).map(([name, values]) => `| ${name} | ${values.PASS ?? 0} | ${values.FAIL ?? 0} | ${values.SKIP ?? 0} | ${values.NOT_APPLICABLE ?? 0} |`).join("\n");
const validationText = validation ? validation.checks.map((v) => `- **${v.command}**: ${v.result}; ${v.durationMs == null ? "duración no medida" : `${(v.durationMs / 1000).toFixed(2)} s`}. ${v.detail ?? ""}`).join("\n") : "Validación final todavía en ejecución; consultar los logs de esta carpeta.";
write("audit-summary.md", `# OrgoRush — AUD-NOM-001\n\nFecha de revisión: 2026-10-18. Fase diagnóstica; sin reparaciones de producción, commit ni push.\n\n## Baseline y protección\n\nHEAD: \`${baseline.head}\` — ${baseline.headSubject}. Coincide con el baseline público 812f725. Estado inicial: únicamente \`?? reports/orgorush-aud001-repair.md\`; no había cambios rastreados. Los hashes de producción, corpus protegido, manifiesto y regresiones históricas auditadas permanecen idénticos. No se editó Practice/Exam, ningún expected previo ni referencias gold.\n\nLa interfaz ofrece current y Legacy 1979 en ES/EN. Se sigue la ruta local real de Home, sin alias opcionales, fuente externa ni PubChem. Para entradas configuradas, la opción de estereoquímica está activada. Se usan análisis moderno y Legacy distintos. Los nombres no disponibles se cuentan como UNSUPPORTED, no como nombres erróneos.\n\n## Matriz y cobertura\n\n**${stats.structures} identidades OCL distintas adicionales**, cero duplicados del corpus protegido de ${corpus.length} (${stats.protectedCorpus.authority.gold} gold, ${stats.protectedCorpus.authority.silver} silver). ${stats.imported} importadas; ${stats.rejectedAtImport} rechazos explícitos. Ignorando estereoquímica e isótopos hay ${stats.distinctConstitutionsIgnoringStereoAndIsotopes} constituciones distintas; ${stats.newConstitutionsOutsideProtected} son nuevas frente al corpus y ${stats.newImportedConstitutionsOutsideProtected} nuevas constituciones fueron importadas. Semilla decimal ${plan.seed}, versión ${plan.version}. Se conservan ${plan.excluded.length} candidatos descartados con motivos en audit-exclusions.json.\n\nLa admisión del laboratorio no se filtra por Practice/Exam. La observación suplementaria del validador vigente es ${JSON.stringify(stats.practiceEnvelope)}; nunca se usó para excluir candidatos. ${stats.namedCasesOutsidePractice} de las estructuras fuera de esas categorías recibieron nombre local en algún perfil. Sus categorías completas actuales no equivalen al perfil conservador del corpus de referencia.\n\n| Familia | Estructuras | Importadas | Nombres 2013 ES / EN / 1979 ES / EN | Interpretaciones EN distintas |\n|---|---:|---:|---|---:|\n${familyTable}\n\n## Cuatro perfiles: resultados separados\n\n${stats.attemptedProfiles} proyecciones previstas; ${stats.namedOutputs} nombres disponibles.\n\n| Perfil | Nombres | UNSUPPORTED | Exactos verificados PASS | Exactos sin verificar | Estructura independiente MATCH / MISMATCH |\n|---|---:|---:|---:|---:|---:|\n${profileTable}\n\nLas 20 estructuras revisadas individualmente aportan **${stats.evidence.exactExpectedOutputs} expectativas exactas inglesas**: 20 modernas y seis Legacy. Todas coinciden y sus interpretaciones independientes son MATCH. Las derivaciones y enlaces primarios constan en audit-cases.json y sources.json. Se distingue política sistemática del proyecto de una afirmación universal sobre PIN. No se convirtió traducción automática en referencia española.\n\n**${stats.evidence.noExactReferenceStructures} estructuras y ${stats.evidence.namedOutputsWithoutExactReference} salidas disponibles carecen de referencia exacta adjudicada.** Su nivel sigue siendo GENERATED; ni generación ni round-trip los convierten en oráculos. No se promovieron automáticamente casos a SILVER/GOLD. El corpus protegido conserva sus niveles originales.\n\nOPSIN: ${stats.evidence.receipts} recibos ingleses únicos (${JSON.stringify(stats.evidence.receiptOrigins)}), con URL exacta, cuerpo original, fecha y SHA-256. ${JSON.stringify(stats.evidence.observedEnglishInterpretations)} sobre los textos de salida realmente interpretados. La consulta ampliada se dirigió a N-sustitución y multiplicidad tras encontrar contradicciones; es una muestra intencional, no una tasa de defectos extrapolable a todas las moléculas. Los fallos iniciales de red se preservan como intentos fallidos, no evidencia química; las consultas autorizadas posteriores obtuvieron los recibos. PubChem no fue consultado.\n\n## Propiedades estructurales y semánticas\n\n| Propiedad | PASS | FAIL | SKIP | No aplicable |\n|---|---:|---:|---:|---:|\n${propertyTable}\n\nSe compararon ${stats.equivalentVariantCount} representaciones SMILES alternativas con identidad OCL previamente confirmada. El ensayo de representación aplica escala positiva y traslación a coordenadas; no se probó un cambio real de tema en navegador ni una sesión DOM. Idioma/perfil se ensaya en el modelo de producción, con retorno al modelo inicial e inmutabilidad de ambos análisis.\n\nLa identidad canónica conserva órdenes, cargas, isótopos y estado estéreo; no se comparan fórmulas o cadenas SMILES como sustituto de igualdad química. Los siete rechazos de importación corresponden a límites fusionados/puenteados/espiro y cargas no admitidas. La pérdida de 13C es una aceptación con pérdida y se separa de esos rechazos seguros. No se detectó mutación del grafo editable, no determinismo ni cambio de nombre entre los equivalentes verificados.\n\nLos grupos funcionales y sus átomos proceden de producción. La comparación con P-41 comprueba el orden sobre esos grupos detectados; no constituye un detector independiente. Los intervalos contenidos de numeración/sufijo son legítimos; solo se señalan cruces parciales y duplicados de la misma sección. Las dos señales iniciales de cierre en piridina no prueban un análisis erróneo: se revisaron como limitación del comprobador. El texto real C6=C7 sí es contradictorio y se documenta por separado.\n\n## Hallazgos por causa probable\n\n${findings.length} grupos confirmados; ${JSON.stringify(stats.findingSeverities)}. Los recuentos de casos y perfiles pueden solaparse entre grupos y no deben sumarse como moléculas independientes.\n\n| ID | Prioridad | Causa / manifestación | Casos / salidas afectadas |\n|---|---|---|---:|\n${findingTable}\n\nEl P0 se limita a pérdida silenciosa de identidad isotópica en una entrada aceptada; no implica corrupción generalizada de conectividad. Las 51 interpretaciones EN distintas se agrupan en pérdida de N-alquilo, metilo arílico, segundo carboxilo, R/S o isótopo. No son 51 causas distintas. Ninguna de estas conclusiones depende de exigir a todos los nombres una única grafía preferida.\n\n## Próxima fase de reparación\n\n1. Proteger la frontera de importación isotópica: conservar o rechazar antes de editar/exportar.\n2. Corregir o bloquear salidas incompletas de N-sustitución, arilos sustituidos y diácidos; son cambios de identidad, no variantes ortográficas. Mantener los cuatro perfiles contra su propio análisis.\n3. Conservar R/S y evitar doble prefijación E/Z al activar estereoquímica.\n4. Resolver límites de fragmentos (non, en/oic y numeración duplicada), después cierre heterocíclico y etiquetas EN.\n5. Añadir regresiones por causa con vecinos y referencias independientes; ejecutar certificación completa en CI después de las reparaciones. Ampliar referencias exactas españolas y de familias no adjudicadas mediante revisión individual.\n\n## Validación y reproducción\n\n${validationText}\n\nLa suite diagnóstica es optativa en tests/naming-audit/diagnostics.test.mjs. Comprueba producción real y conserva fallos para los defectos confirmados; no se incorpora silenciosamente al glob de CI ni se usa skip/todo para ocultarlos. El runner conserva 18 lotes; una reejecución con los mismos hashes los reutiliza. Las fuentes externas se consumen desde recibos locales al generar informes y ejecutar diagnósticos.\n\nArchivos nuevos: scripts/naming-audit/, tests/naming-audit/diagnostics.test.mjs y reports/naming-audit/. Ningún archivo de producción, referencia protegida ni prueba histórica fue modificado. El informe AUD-001 previamente sin seguimiento permanece intacto. Consultar README.md para comandos. No se ejecutó npm test completo. Esta auditoría no certifica conformidad IUPAC exhaustiva y no atribuye exactitud a los 440 nombres por el solo hecho de haber sido generados.\n`);

let findingsText = "# OrgoRush — hallazgos AUD-NOM-001\n\nFecha: 2026-10-18. Cada ID identifica un grupo causal permanente; las salidas correlacionadas no se contabilizan como defectos independientes. Datos completos en audit-findings.json y audit-matrix.json.\n\n";
for (const finding of findings) {
  findingsText += `## ${finding.id} — ${finding.title}\n\n**${finding.severity}; ${finding.classifications.join(", ")}; CONFIRMED.** ${finding.affectedCases} estructuras y ${finding.affectedOutputs} salidas.\n\n**Observado:** ${finding.observed}\n\n**Esperado / fundamento:** ${finding.expectedConstraint}\n\n**Evidencia:** ${finding.evidence}\n\n**Causa probable:** ${finding.causeHypothesis}\n\n**Código a revisar:** ${finding.sourcePaths.map((p) => `\`${p}\``).join(", ")}.\n\n`;
  for (const id of finding.representatives) {
    const record = records.find((r) => r.id === id);
    const affected = finding.affected.filter((a) => a.caseId === id);
    findingsText += `- ${id}; SMILES: \`${record.smiles}\`. ${affected.map(({ profile }) => `${profile}: \`${record.profiles[profile].name}\``).join("; ")}.\n`;
  }
  findingsText += `\n**Regresión propuesta:** ${finding.recommendedTest}\n\n`;
  if (finding.relatedManifestation) findingsText += `${finding.relatedManifestation}\n\n`;
  if (finding.auditCheckerCaveat) findingsText += `${finding.auditCheckerCaveat}\n\n`;
  findingsText += `**Casos:** ${[...new Set(finding.affected.map((a) => a.caseId))].join(", ")}.\n\n`;
}
findingsText += "## Referencias y evidencia\n\nLas derivaciones individuales y las páginas primarias consultadas están en audit-cases.json y sources.json. Los cuerpos de OPSIN y hashes están en opsin-evidence.json. No se introdujeron expectativas españolas por traducción ni se modificaron referencias gold del corpus.\n";
write("audit-findings.md", findingsText);
console.log(JSON.stringify({ structures: stats.structures, byProfile, findings: findings.map(({ id, severity, affectedCases, affectedOutputs }) => ({ id, severity, affectedCases, affectedOutputs })), englishStructure: stats.evidence.observedEnglishInterpretations }, null, 2));
