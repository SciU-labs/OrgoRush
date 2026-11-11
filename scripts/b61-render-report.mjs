import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { generalizationInput } from '../tests/fixtures/b60-generalization-input.mjs';
import { mutations } from '../tests/fixtures/b61-mutations.mjs';
const base=new URL('../reports/b61/',import.meta.url);
const json=async name=>JSON.parse(await readFile(new URL(name,base),'utf8'));
const [corpus,blind,final,freeze,novelty,pool]=await Promise.all([
  json('../../tests/fixtures/b61-independent-reference.json'),json('blind-reviewed.json'),json('final.json'),
  json('corpus-freeze.json'),json('novelty-expanded.json'),json('reference-pool.json')]);
if(createHash('sha256').update(await readFile(new URL('../../tests/fixtures/b61-independent-reference.json',base))).digest('hex')!==freeze.sha256)
  throw new Error('Frozen source corpus changed');
if(corpus.records.some(r=>!novelty.records.find(n=>n.cid===r.cid)?.novel))throw new Error('Historical overlap found');
const text=value=>String(value??'—').replaceAll('|','&#124;').replaceAll('\n',' ');
const table=(head,rows)=>`| ${head.join(' | ')} |\n|${head.map(()=>'---').join('|')}|\n${rows.map(row=>`| ${row.map(text).join(' | ')} |`).join('\n')}\n`;
const short={'FULL-INTERNAL-ONLY':'FI','FULL-INDEPENDENTLY-VERIFIED':'FV','PARTIAL-SAFE':'PS','UNSUPPORTED-SAFE':'US','FAIL-NAME':'FN','FAIL-GRAPH':'FG','FAIL-REASONING':'FR','PENDING-EXTERNAL':'PE'};
const guide='https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf';
const rules={aromatic:'Progenitor retenido, grupo de sufijo, posición orto/meta/para y radical simple o ramificado; ES/EN directos.',
  cyclic:'Función en C1, sentido del anillo, conjunto menor de localizadores y radicales/multiplicadores.',
  enone:'Sufijo cetona, enlace C=C del anillo y desempate de orientación antes de los prefijos.'};
await writeFile(new URL('b60-independence.md',base),`# Auditoría de independencia de B6.0

Se leyeron README.md, matrix.md, architecture-before.md y el fixture completo de las 24 estructuras. Se contrastó su recorrido con las pruebas y los módulos de producción. Las cifras históricas siguen siendo 28/30 perfiles FULL, 24 estructuras construidas, 48 positivos, 1.104 cruces negativos, 299 pruebas y 14 casos Chromium/408 activaciones. Su valor es de regresión y consistencia dentro de cobertura; no estiman precisión química general.

## Inventario de los 48 nombres esperados

Los grafos proceden de SMILES escritos manualmente después de las reglas de B6.0; cada fórmula y los dos nombres se escribieron en el fixture. No fueron recuperados de una fuente química externa y no son respuestas OPSIN. El fixture no invoca al generador para fabricar expectativas. El importador OCL construye el grafo editable; el comparador normaliza aromaticidad con el mismo OCL. La estereoquímica está ausente.

${table(['ID','Familia','ES esperado','EN esperado','Fórmula','SMILES'],generalizationInput.map(r=>[r.id,r.family,r.es,r.en,r.formula,r.smiles]))}
## Reglas y dependencia entre comprobaciones

${table(['Grupo','Casos','Reglas ejercitadas'],[['Aromáticos con sufijo','G01–G15',rules.aromatic],['Alcoholes/cetonas cíclicos','G16–G21',rules.cyclic],['Enonas cíclicas','G22–G24',rules.enone]])}

* evaluate.mjs expone el generador y la selección de nombres que usa la aplicación. Sus salidas son observaciones del sistema, nunca expectativas químicas independientes.
* systematic-family-grammar.ts recibe un nombre y construye FamilyGraph sin llamar a analyzeMolecule. Después validated-name-derivation.ts compara ese grafo con el original mediante structural-derivation.ts. Es separación arquitectónica útil, pero pertenece al mismo producto: comparte tipos, tablas históricas de fragmentos/radicales y normalización OCL. No equivale a OPSIN.
* compositional-name-model.ts comparte tipos y funciones puras de comparación de localizadores; no es una segunda autoridad normativa. En B6.1 se agrega allí la comparación de todos los orígenes para anillos libres.
* Las expectativas FULL del fixture son decisiones de cobertura del autor. Las fórmulas y los SMILES escritos aparte reducen circularidad, pero no convierten estos pares en un corpus externo ni muestreado antes de la gramática.
* Los 1.104 cruces comparan cada nombre contra otros grafos del mismo corpus. Son controles de no equivalencia interna y de rechazo, no 1.104 nombres externos nuevos.
* El E2E B6.0 obtiene los blancos visuales esperados con reconcileSystematicName y buildValidatedPriorityReasoning, las mismas funciones que alimentan la interfaz. Es una prueba válida de proyección DOM, accesibilidad, idioma y geometría; reutiliza el algoritmo del producto como oráculo de selección y no demuestra la corrección química de ese algoritmo.

No se descartan estas pruebas. Se rebaja la interpretación de independencia. La nueva ejecución conserva los 48 FULL internos del corpus construido y los 28 FULL/2 bloqueos históricos; véase final.json. Ninguno se promociona automáticamente a FV por esos resultados.
`);

// Prepared local-only jobs. This is not an OPSIN invocation or response.
const jobs=[];
for(const [cohort,rows] of [['B60-constructed',final.b60Constructed.rows],['B50-historical',final.historical.rows],['B61-independent-source',final.rows]])for(const row of rows) {
  if(!row.profiles.en.name)continue;
  const source=cohort==='B60-constructed'?generalizationInput.find(r=>r.id===row.id)
    :cohort==='B61-independent-source'?corpus.records.find(r=>r.id===row.id)
      :JSON.parse(await readFile(new URL('../tests/fixtures/b50-pubchem-rings.json',import.meta.url),'utf8')).records.find(r=>r.cid===row.cid);
  jobs.push({line:jobs.length+1,cohort,id:row.id,cid:row.cid,name:row.profiles.en.name,expectedSmiles:source.smiles,
    expectedFormula:source.formula,status:'NOT-RUN-TOOLCHAIN-MISSING',opsinResult:null});
}
await writeFile(new URL('opsin-input.txt',base),jobs.map(j=>j.name).join('\n')+'\n');
await writeFile(new URL('opsin-manifest.json',base),JSON.stringify({createdAt:new Date().toISOString(),language:'en',jobsPrepared:jobs.length,
  namesProcessed:0,remoteNameRequests:0,documentation:'https://github.com/dan2097/opsin',jobs},null,2)+'\n');

const spanishNotes={
  'B61-I01':'etoxi, benzaldehído y localizador 4; misma posición del registro EN.',
  'B61-I02':'etoxi, benzaldehído y localizador 2; regioisómero distinto de I01.',
  'B61-I03':'etil, benzamida y localizador 4.',
  'B61-I04':'N-etil distingue sustitución del nitrógeno; metil del anillo conserva C4.',
  'B61-I05':'fluoro en C4 y sufijo benzonitrilo.',
  'B61-I06':'di-fluoro y conjunto 3,4 del benzonitrilo.',
  'B61-I07':'fenil precede a hidroxi en español; ambos en C2 del etanonitrilo. acetonitrilo/etanonitrilo no se igualan sólo por texto.',
  'B61-I08':'éster con «de»; prop-2-en-1-ilo expresa el doble enlace y la posición de unión. La omisión de -1- de la referencia no se penaliza por texto.',
  'B61-I09':'bromo en C1 y cetona en C2; sufijo -ona.',
  'B61-I10':'etil precede a metil; tri- conserva 3,5,5; cetona cíclica con C1 omitido.',
  'B61-I11':'etil en C4 y cetona cíclica con C1 omitido.',
  'B61-I12':'etil en C2 antes de metil en C3; cetona cíclica con C1 omitido.',
  'B61-I13':'-3-en-1-ol conserva función e insaturación; 1-metiletil es una presentación alternativa de propan-2-il.',
  'B61-I14':'metilideno conserva =CH2; 1-metiletil y metilideno cambian orden de cita respecto de la pareja methylidene/propan-2-yl de la fuente. Diferencia textual no implica fallo.',
  'B61-I18':'metil antes de nitro, sin ordenar por tri-/di-; conjuntos 1,3,5 y 2,4.',
  'B61-I20':'cloro antes de etoxi; di- y posiciones 3,5/2 conservadas.'
};
const spanishReview={method:'Bounded manual adaptation review against independent published rules; no production ES→EN translation used as an oracle',
  source:guide,sections:['3e','5.4','7c–f','8'],wholeNameCertification:false,independentSpanishWholeNameRecords:0,
  records:final.rows.map(r=>({id:r.id,name:r.profiles.es.name,status:r.profiles.es.name?'LIMITED-ADAPTATION-REVIEW':'BLOCKED-NO-NAME',
    note:spanishNotes[r.id]??'No se emite nombre local; sin afirmación de adaptación completa.',remaining:'PENDING-EXTERNAL whole-name equivalence'}))};
await writeFile(new URL('spanish-adaptation.json',base),JSON.stringify(spanishReview,null,2)+'\n');

const exact=final.rows.filter(r=>r.profiles.en.nameValidation.independentReferenceExactMatch);
const notes={
  'B61-I07':'Orden EN corregido; conectividad del nombre completo pendiente.',
  'B61-I08':'Antes propilo saturado; ahora radical prop-2-en-1-ilo, sin ampliar FULL.',
  'B61-I13':'Alcohol/insaturación detectados; gramática FULL no cubre esta combinación.',
  'B61-I14':'Antes metil perdía =CH2; ahora metilideno. Equivalencia completa pendiente.',
  'B61-I15':'Antes propilo perdía C=C/E. Ahora bloqueo por estereoquímica de rama no expresable.',
  'B61-I16':'Importador editable rechaza sistema puenteado con tres centros definidos; no se elimina estereoquímica.',
  'B61-I17':'Bloqueo local preexistente para esta combinación de funciones/sustitución.',
  'B61-I19':'Bloqueo local preexistente; no confundir bromometilo con bromo + metilo del anillo.'};
await writeFile(new URL('matrix.md',base),`# B6.1 — matriz del corpus congelado

20 moléculas × ES/EN actual = 40 perfiles. FI = FULL-INTERNAL-ONLY; FV = FULL-INDEPENDENTLY-VERIFIED; PS = PARTIAL-SAFE; US = UNSUPPORTED-SAFE; FN = FAIL-NAME. Todos los nombres completos conservan además PENDING-EXTERNAL en nameValidation. PS expresa admisión parcial y controles limitados sin fallo detectado, no exactitud del nombre completo certificada. No se suman estos estados internos a resultados de un parser externo.

## Fuente y cobertura

Cada CID enlaza el registro independiente. El fixture conserva SMILES, fórmula, InChIKey, conteos estereoquímicos, URL de recuperación, UTC y hash del recibo crudo. PubChem es una sola familia de fuentes externas; sus nombres calculados no son certificados PIN.

${table(['ID / fuente','Referencia EN externa','Fórmula','Estereoquímica definida / no definida','Resultado ES / EN','Observación'],corpus.records.map((r,i)=>{
  const row=final.rows[i],s=r.stereo;
  return [r.id+` [CID ${r.cid}](${r.source})`,r.referenceName,r.formula,`átomos ${s.definedAtoms}/${s.undefinedAtoms}; enlaces ${s.definedBonds}/${s.undefinedBonds}`,
    `${short[row.profiles.es.audit]} / ${short[row.profiles.en.audit]}`,notes[r.id]??(row.profiles.en.nameValidation.independentReferenceExactMatch?'Coincidencia literal EN con pareja externa; no reconstrucción independiente.':'Forma alternativa; diferencia textual no se cuenta como error.')];
}))}
## Observación ciega y resultado final por perfil

Se usa blind-reviewed.json: conserva los nombres del motor anterior a las correcciones y corrige sólo el comparador de fórmulas del auditor. blind.json crudo permanece disponible. El corpus no se reemplazó tras observar resultados.

${table(['ID','Idioma','Nombre ciego','Auditoría ciega','Nombre final','Auditoría final'],final.rows.flatMap((row,i)=>['es','en'].map(l=>[row.id,l,blind.rows[i].profiles[l].name,blind.rows[i].profiles[l].audit,row.profiles[l].name,row.profiles[l].audit])))}
## Español: comprobación de adaptación limitada

No hay referencia completa española independiente para estos 20 registros. Se revisaron términos, funciones, localizadores y orden de cita con la [Guía breve RSEQ/IUPAC](${guide}), §§3e, 5.4, 7c–f y 8. No se usó una transformación ES→EN del producto como certificador. Esta revisión manual, posterior a la observación ciega, no promociona perfiles a FV ni elimina PENDING-EXTERNAL.

${table(['ID','Nombre ES revisado','Reglas/adaptación observadas'],final.rows.filter(r=>r.profiles.es.name).map(r=>[r.id,r.profiles.es.name,spanishNotes[r.id]]))}
## Mutaciones separadas del corpus externo

${table(['ID','Eje','Clase esperada','Nombre de control','¿Debe obtener FULL?'],mutations.map(r=>[r.id,r.axis,r.kind,r.name,r.accept?'sí':'no']))}

M09 tiene la misma conectividad pero numeración no mínima; no es un isómero diferente. M10/M11 aceptan dos textos válidos de la misma estructura. M12 es nombre de referencia válido fuera de cobertura. M08 no tiene una interpretación independiente demostrada: su numeración interna carece de justificación; su rechazo conservador no se convierte en una afirmación de invalidez universal. M13/M14 son controles sintácticos fuera de la forma admitida.
`);

const regression=await readFile(new URL('regressions.log',base),'utf8');
const browserLog=await readFile(new URL('e2e.log',base),'utf8');
const browser=await json('e2e/results.json');
const totals=log=>Object.fromEntries(['tests','pass','fail','skipped'].map(k=>[k,Number(log.match(new RegExp(`(?:ℹ|#) ${k} (\\d+)`))?.[1]??NaN)]));
const generalization=totals(await readFile(new URL('generalization-final.log',base),'utf8'));
const safety=totals(await readFile(new URL('safety-final.log',base),'utf8'));
const positions=totals(await readFile(new URL('unsaturation-position-tests.log',base),'utf8'));
const browserRetest=await json('e2e-final/results.json');
const latestCases=new Map(browser.cases.map(r=>[r.cid,r]));for(const row of browserRetest.cases)latestCases.set(row.cid,row);
const nitroFinal=await json('e2e-nitro-final/results.json');for(const row of nitroFinal.cases)latestCases.set(row.cid,row);
const currentCases=[...latestCases.values()];
const initialTotals=totals(regression);
const failedInitial=regression.split(/ℹ tests/)[0].split('\n').filter(line=>line.startsWith('✖'));
if(initialTotals.tests!==344||initialTotals.fail!==8||failedInitial.length!==8||failedInitial.some(line=>!line.startsWith('✖ B6.1')))
  throw new Error('Review initial focused failures; do not silently promote a failed historical test');
for(const [label,stats,expected] of [['generalization',generalization,38],['safety',safety,7],['positions',positions,2]])
  if(stats.pass!==expected||stats.fail!==0)throw new Error(`Unresolved ${label} verification`);
if(currentCases.length!==19||currentCases.some(r=>r.status!=='PASS'))throw new Error('Unresolved Chromium case');
await writeFile(new URL('e2e-final-results.json',base),JSON.stringify({browser:browser.browser,
  method:'Latest successful observation for each distinct case; first failed attempts preserved in e2e/results.json and e2e.log',
  initialRun:'e2e/results.json',focusedRetest:'e2e-final/results.json',nitroTransientHighlightRetest:'e2e-nitro-final/results.json',
  discardedInfrastructureRun:'e2e-retest/results.json.gz',cases:currentCases},null,2)+'\n');
const checks={regressionsInitial:initialTotals,generalizationFinal:generalization,safetyFinal:safety,unsaturationPositionRetest:positions,
  historicalRegressionPasses:299,finalUniquePassingTests:344,
  chromiumInitial:totals(browserLog),chromiumFocusedRetest:totals(await readFile(new URL('e2e-final.log',base),'utf8')),
  chromiumNitroFinal:totals(await readFile(new URL('e2e-nitro-final.log',base),'utf8')),browser:browser.browser,
  browserCases:currentCases.length,browserPassed:currentCases.filter(r=>r.status==='PASS').length,
  controls:currentCases.reduce((n,r)=>n+r.controls,0),typecheck:'PASS',diffCheck:'see diff-check.log',
  note:'Focused suites only; historical frozen OPSIN tests consume existing snapshots, not new local/remote parser calls.'};
await writeFile(new URL('validation-ledger.json',base),JSON.stringify(checks,null,2)+'\n');
await writeFile(new URL('README.md',base),`# OrgoRush B6.1 — validación independiente y generalización

La auditoría conservó las cifras de B6.0 y congeló **20 moléculas externas nuevas antes de ejecutar el generador**. La observación ciega revisada detectó **7 FAIL-NAME en 40 perfiles**: tres pérdidas químicas de insaturación en dos idiomas y un orden alfabético EN incorrecto. Se corrigieron sus causas generales tras guardar pruebas rojas. También se corrigieron dos causas de FULL falso en controles adversariales de numeración y sintaxis del benceno libre.

**OPSIN local no pudo ejecutarse: 0 nombres procesados, 0 reconstrucciones externas nuevas, 0 rechazos del parser observados.** No se encontró Java ni OPSIN en PATH ni en las ubicaciones de instalación/caché enumeradas. No se enviaron nombres a otro endpoint o servicio remoto. La limitación es técnica; no es un rechazo químico de los nombres.

El resultado final sobre las 20 moléculas es **12 FULL-INTERNAL-ONLY, 20 PARTIAL-SAFE y 8 UNSUPPORTED-SAFE**. Hay **0 FULL-INDEPENDENTLY-VERIFIED**, **0 fallos demostrados restantes mediante los controles realizados** y **40 perfiles con contrastación completa PENDING-EXTERNAL**. La ausencia de un fallo detectado no demuestra precisión general. PS describe soporte parcial sin fallo detectado dentro de los controles practicados; no garantiza corrección del nombre completo ni de toda explicación posible.

## Evidencias y alcance

* [Matriz de fuentes, 40 perfiles antes/después y revisión española](matrix.md).
* [Auditoría de B6.0 con sus 24 grafos y 48 nombres](b60-independence.md).
* [Corpus inmutable](../../tests/fixtures/b61-independent-reference.json), [acta de congelación](corpus-freeze.json), [recibos PubChem crudos](reference-pool.json).
* [Resultado ciego crudo](blind.json), [adjudicación ciega](blind-reviewed.json), [medición final](final.json), [pruebas rojas](red-tests-complete.log).
* [Inventario local Java/OPSIN](local-toolchain.json), [trabajos preparados sin ejecutar](opsin-manifest.json), [revisión española limitada](spanish-adaptation.json).
* [Regresiones iniciales](regressions.log), [generalización final](generalization-final.log), [seguridad final](safety-final.log), [Chromium consolidado](e2e-final-results.json), [typecheck](typecheck.log), [integridad de alcance](scope-check.json).

## B6.0: línea base, no medida de precisión general

${table(['Evidencia histórica','B6.0 conservado','Nueva medición interna B6.1'],[
['Corpus original, 15 moléculas / 30 perfiles','28 FULL / 2 UNSUPPORTED','28 FULL / 2 UNSUPPORTED; ibuprofeno bloqueado localmente'],
['24 grafos construidos / 48 perfiles','48 positivos FULL / 1.104 cruces negativos','48 FULL internos; cruces de B6.0 conservados en regresión'],
['Pruebas focalizadas','299 aprobadas','mismas suites más 45 pruebas B6.1'],
['Chromium histórico','14 casos / 408 activaciones','se conserva su evidencia; nueva ejecución en directorio B6.1']])}

La reconstrucción de FamilyGraph desde el nombre es independiente del análisis concreto del generador, pero comparte tablas del producto y OCL. Los grafos G01–G24 se escribieron tras la gramática, sus expectativas FULL son decisiones del autor, y los blancos E2E se calculan con el propio reconciliador/adapter. Son controles válidos de regresión y proyección; no un segundo parser ni una muestra externa. [Inventario y dependencias completos](b60-independence.md).

## Selección y cronología

El programa de selección no importa el generador ni el reconciliador. Se recuperaron propiedades por **CID público**, sin enviar nombres generados. El pool contiene ${pool.records.length} registros y ${pool.receipts.length} recibos; un lote HTTP 502 quedó registrado y sus cuatro CIDs no se seleccionaron. No se sustituyeron errores de adquisición por respuestas inventadas.

Primero se excluyeron constituciones ya presentes en SMILES literales de tests/informes anteriores; el inventario inicial contenía 1.692 constituciones. Se escogieron 20 estratos representativos y de frontera, incluidos sistemas que exceden la sintaxis FULL actual. Se congelaron a **${corpus.frozenAt}**, SHA-256 **${freeze.sha256}**. El resultado ciego revisado se guardó a ${blind.executedAt}; la medición final es de ${final.executedAt}. Las fechas están en UTC (en Santiago aún era 10 de noviembre).

La auditoría ampliada posterior agregó grafos estáticos de átomos/enlaces, sin ejecutar fixtures: ${novelty.staticGraphConstitutions} constituciones de grafos y ${novelty.historicalConstitutions} constituciones históricas totales. **Ninguna de las 20 seleccionadas se solapa** en ese inventario ampliado. No se reemplazó ninguna molécula tras conocer resultados. El análisis estático no puede demostrar ausencia de toda estructura generada dinámicamente en cualquier código; su alcance y rutas están en [novelty-expanded.json](novelty-expanded.json).

Cada referencia guarda fuente, SMILES, fórmula, nombre calculado, InChIKey, estereoquímica definida/no definida, recuperación y hash. La fuente no es el generador, pero todas proceden de PubChem: no son varias autoridades independientes entre sí, no son un muestreo aleatorio y no permiten una estimación poblacional de precisión. Las expectativas no se copiaron a producción.

## Observación ciega y adjudicación

${table(['Estado de auditoría','Ciego revisado, 40 perfiles','Final, 40 perfiles'],[
['FULL-INDEPENDENTLY-VERIFIED',0,0],['FULL-INTERNAL-ONLY',12,12],['PARTIAL-SAFE',15,20],['UNSUPPORTED-SAFE',6,8],['FAIL-NAME',7,0],['FAIL-GRAPH real',0,0],['FAIL-REASONING detectado',0,0],['PENDING-EXTERNAL de nombre completo (eje adicional)',33,40]])}

El primer blind.json confundió la representación textual de fórmulas (por ejemplo C7H4NF / C7H4FN, C4H7OBr / C4H7BrO) con diferencias de composición y marcó 8 FAIL-GRAPH espurios. Se conserva ese archivo. Se corrigió el auditor para comparar mapas elemento→cantidad, se añadió una prueba y se guardó blind-reviewed.json **antes de editar producción**. No hubo 8 fallos del importador ni correcciones ficticias del grafo.

19/20 fuentes entran al editor y conservan identidad canónica completa al exportar/reimportar, incluidos órdenes, cargas y estereoquímica admitida. I16 es rechazo explícito de un sistema puenteado con centros definidos; su fórmula se comprueba leyendo el SMILES fuente directamente con OCL, sin fingir admisión del editor. Esto compara representaciones del grafo fuente con el mismo OCL: no reconstruye un nombre externamente. Antes había nombre local para 17/20 moléculas; ahora para 16/20, porque I15 se bloquea para conservar la barrera estereoquímica.

${exact.length} nombres EN finales coinciden literalmente con el nombre de su registro independiente: ${exact.map(r=>r.id).join(', ')}. De ellos, I01–I03 tienen FULL interno; los demás son parciales. Es corroboración finita de parejas nombre–estructura publicadas, **no una ejecución nombre→grafo independiente**. No se penalizan los textos alternativos sólo por diferir de PubChem. No se certifica PIN.

## Fallos, causas y correcciones

${table(['Hallazgo demostrado','Causa general','Corrección y límite'],[
['I08 ES/EN: propilo saturado para radical prop-2-enilo','esterAlkylName utilizaba el árbol sólo si era saturado; el fallback contaba carbonos','Árbol acíclico con órdenes reales y raíz del alcohol; ahora prop-2-en-1-yl. No amplía FULL.'],
['I14 ES/EN: metil para =CH2 exocíclico','ringCandidates omitía attachmentOrder al nombrar la rama','Propagar el orden de unión; usar la regla existente metilideno. No amplía FULL.'],
['I15 ES/EN: propilo para propenilo E','Radical largo insaturado se reducía a alquilo; el formateador E/Z sólo cubría el progenitor','Conservar sintaxis insaturada de ramas largas; bloquear C–C múltiple estereoespecificado fuera del progenitor hasta poder expresarlo.'],
['I07 EN: phenyl antes de hydroxy','Orden ES reutilizado en una construcción acíclica plana','Reordenar prefijos según idioma sólo en construcción de sufijo terminal único completamente reconocida; ES mantiene fenil antes de hidroxi.'],
['FULL falso: 2-methoxy-5-methylbenzene','Comparaba reflexión anclada en 1, sin todos los orígenes del anillo libre','Enumerar todos los orígenes y ambos sentidos; comparar conjunto de locantes y orden de cita.'],
['FULL falso: 01-methoxy-4-methylbenzene','Enteros permisivos y separador final sin control','Localizador léxico 1–6 y consumo completo sin guion sobrante antes del progenitor.']])}

Las seis pruebas de seguridad relevantes fueron rojas antes de producción; la prueba del comparador de fórmulas ya pasaba. El log conserva los primeros contraejemplos que fallaron; no se atribuye una medición previa exhaustiva a todos los controles de cada bucle. Los FULL falsos adversariales tenían conectividad compatible pero sintaxis/numeración injustificada: no son FAIL-GRAPH. Ninguno de los 12 FULL emitidos en los 20 registros nuevos fue demostrado incorrecto; tampoco quedó certificado externamente.

Los cambios B6.1 de producción se limitan a page.tsx, systematic-family-grammar.ts y compositional-name-model.ts. No hay CIDs, listas de nombres externos ni excepciones por molécula en esas correcciones. Se conservan los cambios B4/B5/B6 recibidos. Los bloqueos finales I15, I16, I17 e I19 aparecen en ambos idiomas; el ibuprofeno histórico sigue bloqueado localmente y no se confunde con el nombre externo de referencia.

## OPSIN y español

El [repositorio oficial OPSIN](https://github.com/dan2097/opsin) documenta la versión 2.9.0, Java 8+ y el CLI autónomo. Con runtime y JAR oficiales adquiridos como acción separada, puede procesarse el archivo local sin un servicio web:

\`java -jar opsin-cli-2.9.0-jar-with-dependencies.jar -osmi reports/b61/opsin-input.txt reports/b61/opsin-output.smi\`

Hay ${jobs.length} trabajos EN preparados (24 construidos B6.0, 14 históricos nombrados y 16 nuevos), todos NOT-RUN-TOOLCHAIN-MISSING. Se requiere registrar versión/hash del binario y capturar advertencias/rechazos/fallos técnicos al ejecutarlos. Un rechazo no probaría automáticamente error de nombre; coincidencia estructural no certificaría PIN. No se instaló Java/OPSIN ni se descargaron ejecutables en esta tarea. La búsqueda local enumera su alcance y no afirma inspeccionar todos los discos.

Los nombres españoles tienen una [revisión manual de adaptación](spanish-adaptation.json) basada en la [guía RSEQ/IUPAC](${guide}), §§3e (orden alfabético), 5.4 (insaturación), 7c–f (localizadores) y 8 (ésteres con «de»). La [Blue Book P-59.2.5](https://iupac.qmul.ac.uk/BlueBook/P5.html#P5925) respalda el desempate por prefijos y orden de cita. Son reglas publicadas independientes del producto; su aplicación manual sigue siendo acotada. No existe aquí un oráculo de nombre completo español y no se utiliza OPSIN para certificar español ni un traductor ES→EN como verificador independiente.

## Pruebas e invariancia

Los 15 controles químicos/sintácticos nuevos distinguen nombre equivalente, isómero distinto, mala sintaxis y nombre válido fuera de cobertura. Dos omisiones válidas del C1 de cetona cíclica se aceptan; isómeros de igual fórmula (N-etil / etil del anillo) se rechazan por conectividad. Hay cambios de función, rama, halógeno, enlace simple/doble, posición de insaturación, anillo/cadena y locantes internos.

Se prueban **1.080 rotulaciones aromáticas** (seis grupos, tres distancias, dos idiomas y 30 pares orientados de locantes) con una expectativa cerrada para dos prefijos distintos, sin llamar al algoritmo de rotación como oráculo. Incluyen negativos y positivos, y no son 1.080 moléculas externas nuevas.

Los 20 registros tienen pruebas de IDs permutados, orden/orientación de enlaces, rotación de coordenadas, orden de metadatos de anillo, ES→EN→ES y exportación/reimportación. Para los 19 admitidos se conserva identidad canónica con estereoquímica, nombres y correspondencia de blancos/locantes; I16 conserva el rechazo explícito. Los blancos se contrastan por identidad remapeada y existencia de enlaces/átomos; esto demuestra consistencia, no verdad química externa de cada explicación. La carga formal editada invalida caché; aromaticidad Kekulé se normaliza por OCL.

${table(['Verificación final','Resultado'],[
['Suites focalizadas B4.1/B4.2, B5.0–B5.5, B6.0, V008/014 y AUD-NOM-005','299/299 históricas aprobadas; no se repitieron tras cambios sólo del arnés B6.1'],
['Invocación conjunta inicial B6.1 + históricas',`${checks.regressionsInitial.pass}/${checks.regressionsInitial.tests}; 8 fallos conservados: 7 por timeout Vite del hook y 1 por exigir orientación única en simetría`],
['Verificación B6.1 final','38/38 generalización y 7/7 seguridad; 344 pruebas distintas con última verificación aprobada, combinando ejecuciones'],
['B6.1 nuevas','7 pruebas de seguridad + 38 de generalización; sus bucles incluyen 1.080 rotulaciones'],
['Chromium',`${checks.chromiumInitial.pass}/19 iniciales, ${checks.chromiumFocusedRetest.pass}/5 al repetir y ${checks.chromiumNitroFinal.pass}/1 en el último caso aislado: ${checks.browserPassed}/${checks.browserCases} casos distintos aprobados; ${checks.controls} activaciones FULL sin duplicar intentos; versión ${checks.browser}`],
['TypeScript','npm run typecheck: PASS'],['Espacios/conflictos','git diff --check: véase diff-check.log'],
['Integridad','Hashes de B6.0, fixtures históricos, workflows y módulos recibidos: scope-check.json']])}

La ejecución Chromium vuelve a cubrir los 14 casos históricos y dos FULL nuevos, más tres nombres parcialmente admitidos corregidos. Comprueba ES/EN, activación por ratón/teclado, destinos/locantes, limpieza de selecciones y geometría. La primera ejecución tuvo 14 aprobados y cinco fallos de arnés: dos lecturas del estado temporal de aria-pressed y tres expectativas de atributo PARTIAL ausente en esa vista local. Se repitieron únicamente esos cinco: cuatro pasaron y el caso nitro volvió a fallar al consultar la selección después de la pulsación. Como el resaltado dura dos segundos, el arnés final instala un observador DOM antes de la entrada real y exige ver simultáneamente aria-pressed y los átomos/enlaces/locantes exactos durante su vida visible. No pausa temporizadores, repite clics ni fabrica estados del producto. El nitro aislado pasó así sus cuatro ciclos de idioma; las latencias de observación están en e2e-nitro-final/results.json. No se atribuye al producto un defecto de selección persistente a partir de una lectura tardía de un estado transitorio.

Las vistas parciales conservan su atributo real (ausente o PARTIAL) y se exige que no afirmen FULL ni tengan un nombre completo validado. No se cambió producción para acomodar el test; tampoco se exige que el código de auditoría PS sea un atributo de interfaz.

Un intento intermedio con HMR/WebSocket desactivados rompió la conexión del cliente Vite y produjo cinco timeouts técnicos; se descartó esa configuración y se restauró exactamente la del servidor original. Sus errores repetidos se conservan comprimidos sin pérdida en e2e-retest/results.json.gz, con resumen y hash en e2e-retest/infrastructure-summary.json; no se cuentan como fallos químicos ni como pruebas aprobadas. La ejecución final mantiene HMR normal y no se edita producción durante los casos. Se conservan los intentos y se consolida la última observación por CID, sin fingir una sola ejecución 19/19.

Sus oráculos visuales internos están declarados como tales. Las peticiones opcionales externas se interceptan con metadatos vacíos; no se fabrican nombres ni FULL. Las pruebas históricas que mencionan OPSIN consumen snapshots preexistentes y no cuentan como nuevas ejecuciones de OPSIN local. No se ejecutó la batería completa.

Una primera ejecución del test de trazabilidad falló por pedir fórmula al importador editable del puenteado I16; se corrigió el test para leer la fuente con OCL, manteniendo el rechazo y sin cambiar producción. generalization-tests.log conserva ese fallo. Otra ejecución exigía idénticos IDs al invertir un anillo simétrico con sustituyentes repetidos: partial-invariance-red.log conserva el contraejemplo. El test ahora exige una única isomorfía del grafo completo que explique conjuntamente todos los blancos y localizadores; no admite equivalencias diferentes por fragmento. Pasó en los 20 registros. La invocación conjunta tuvo además un timeout Vite de 60 s cargando practice-question.ts en el hook de las siete pruebas de seguridad; se repitió esa suite sin modificar sus expectativas. Los dos controles de desplazamiento C=C entre C2/C3 incluyen positivos de su propio isómero y negativos cruzados con igual fórmula/función. Los logs de verificaciones finales son la autoridad sobre su resultado.

## Límites y prioridades B6.2

1. Ejecutar los trabajos EN con una distribución oficial OPSIN local y conservar versión, hashes, salida cruda y advertencias. Comparar grafos completos, fórmula, cargas, órdenes y estereoquímica; contabilizar sólo las equivalencias realmente reconstruidas.
2. Resolver la expresión y validación de E/Z en ramas antes de desbloquear I15. Tratar por separado policiclos puenteados y paridad tetraédrica; no eliminar especificación para lograr soporte.
3. Ampliar referencias completas ES con una fuente compatible y revisión química. Mantener separada la adaptación lingüística de la demostración nombre→grafo.
4. Validar los nombres parciales y los alternativos aún pendientes, especialmente ésteres insaturados, metilidenos, amidas N-sustituidas y funciones combinadas. No incrementar FULL sólo por coincidencia textual.
5. Repetir selección previa con más de una fuente externa y estratos fuera de la gramática; mantener estos 20 como regresión observada, no como otra muestra ciega para futuras adaptaciones.

No hubo commit, push, modificación de dependencias, workflows ni baselines históricos. No se usó OneDrive. El expediente preserva la evidencia negativa y las limitaciones técnicas en lugar de convertirlas en PASS externos.
`);
console.log(JSON.stringify({written:['README.md','matrix.md','b60-independence.md','spanish-adaptation.json','opsin-manifest.json','opsin-input.txt','validation-ledger.json'],checks,jobs:jobs.length,exactExternalNamePairs:exact.length},null,2));
