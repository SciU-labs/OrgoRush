import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Manual terminology decisions applied to the frozen B6.2.2 observations.
// This renders evidence; it neither parses Spanish nor awards product FULL.
const input = 'reports/b622/audit.json';
const bytes = readFileSync(input);
const audit = JSON.parse(bytes);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const consulted = '2026-11-11';
const sources = [
  { id:'S1', authority:'IUPAC / RSEQ', authors:'K.-H. Hellwich, R. M. Hartshorn, A. Yerin, T. Damhus, A. T. Hutton; adaptación Efraím Reyes y Pascual Román Polo', title:'Guía Breve para la Nomenclatura en Química Orgánica', version:'Versión 1.0, diciembre 2021; original inglés 1.1 junio 2021', sections:'§§2.1, 3e–f, 4 tabla 3, 5.1–5.6, 6, 7, 8', url:'https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf', supports:'Construcción, prioridad, vocabulario de funciones, orden de prefijos, locantes y clases funcionales; evidencia general, no de cada nombre completo.' },
  { id:'S2', authority:'IUPAC / RSC', authors:'H. A. Favre y W. H. Powell (eds.)', title:'Nomenclature of Organic Chemistry — IUPAC Recommendations and Preferred Names 2013', version:'Edición 2013; edición web consultada', sections:'P-14.4–14.5; P-29.2; P-59.1–59.2; P-65.1.2.2.2; P-66.1.1.3.5; P-66.5.1.1–1.2 y 66.5.2; P-66.6.1.2', url:'https://iupac.qmul.ac.uk/BlueBook/', supports:'Reglas químicas y distinción entre nomenclatura general y nombres preferidos; no certifica traducciones españolas.' },
  { id:'S3', authority:'ACS Omega / UPV-EHU / Universidad de Alicante', authors:'Efraím Reyes, Pascual Román, Javier García-Martínez', title:'Language of Chemistry: Making IUPAC Nomenclature Available in Spanish', version:'2024, 9(4), 4138–4143; DOI 10.1021/acsomega.3c08887', sections:'§1, p.4138', url:'https://addi.ehu.es/bitstream/handle/10810/66780/reyes-et-al-2024-language-of-chemistry-making-iupac-nomenclature-available-in-spanish.pdf?sequence=1', supports:'Adaptación phenyl→fenil y cambio del orden de cita entre idiomas; no es una fuente directa para B61-I07.' },
  { id:'S4', authority:'OIT/OMS; versión española INSST', authors:'Programa ICSC', title:'ICSC 1103 — Benzonitrilo', version:'Octubre 1999; versión española ©2018', sections:'Encabezado e identidad CAS 100-47-0', url:'https://chemicalsafety.ilo.org/dyn/icsc/showcard.display?p_card_id=1103&p_lang=es&p_version=2', supports:'Término benzonitrilo para el progenitor; no valida automáticamente derivados sustituidos ni PIN.' },
  { id:'S5', authority:'El Colegio de México', authors:'Diccionario del español de México', title:'Vocablos con marca Química', version:'Índice web sin versión indicada', sections:'Entradas indexadas benzaldehído, benzamida, benzoato', url:'https://dem.colmex.mx/moduls/Abreviaturas.aspx?txtAbre=%28Qu%C3%ADm%29&txtDesc=Qu%C3%ADmica&txtTipo=1', supports:'Corroboración léxica de los progenitores, no de su preferencia nomenclatural ni de un derivado completo.' },
];
sources.forEach(s => s.consulted = consulted);
const rules = {
  ALD:'S1 §§3,4,5.6,7; S2 P-66.6.1.2; S5: progenitor benzaldehído y sustitución del anillo.',
  EST:'S1 §§4,7,8; S2 P-65: parte ácida y grupo unido al O con «de».',
  AMI:'S1 §§3,4,5.6,7: anilina y prefijos del anillo.',
  AMD:'S1 §§3,4,7; S2 P-66.1.1.3.5; S5: benzamida, N frente a localizador de anillo.',
  NIT:'S1 §§3,4,7; S2 P-66.5.1.2 y 66.5.2; S4: benzonitrilo y sustitución.',
  CYC:'S1 §§4,5.2,5.4,7; S2 P-59.2: cicloalcano con función sufijo y locantes.',
  SUB:'S1 §§2.1,3,5.5; S2 P-29.2: ramas y locantes internos; formas generales no necesariamente preferidas.',
  BEN:'S1 §§3,4,5.2,7; S2 P-14.4–14.5: benceno, prefijos, orden español y mínimo conjunto.',
  I07:'S1 §§3e,4 tabla3,5.1,6a,7; S2 P-66.5.1.1.1,66.5.1.2.1; S3 §1: nitrilo sobre OH, fenil antes de hidroxi.',
  ACID:'S1 §§4,5.2,7a–c; S2 P-65.1.2.2.2 y P-59.2.2.2: piridina y carboxilos externos.',
  CHAIN:'S1 §§3,4,5.1,5.4,7; S2 P-59: cadena con sufijo de mayor jerarquía.',
};
const notes = new Map();
function add(id, rule, locants, syntax, alternatives='No se adjudica una alternativa completa ni PIN.') {
  notes.set(id,{rule,locants,syntax,alternatives});
}
const b60 = [
 ['ALD','CHO fija C1; metil en C2.'],['ALD','CHO fija C1; etil en C3.'],['ALD,SUB','CHO fija C1; rama en C4; 2-metilpropil se une por su C1.'],
 ['EST','Carbono de unión de benzoato fija C1; etil en C2; metilo unido al O.'],['EST','Metil en C3 del benzoato; etilo unido al O.'],['EST','Etil en C4 del benzoato; propilo unido al O.'],
 ['AMI','NH2 fija C1; etil en C2.'],['AMI','NH2 fija C1; propil en C3.'],['AMI,SUB','NH2 fija C1; rama en C4; unión en C1 del etil sustituido.'],
 ['AMD','CONH2 fija C1; etil en C2.'],['AMD','CONH2 fija C1; propil en C3.'],['AMD,SUB','CONH2 fija C1; rama en C4, 2-metilpropil unido por C1.'],
 ['NIT','CN fija C1 del anillo; etil en C2.'],['NIT','CN fija C1 del anillo; propil en C3.'],['NIT,SUB','CN fija C1; rama en C4 y metil en C1 de etil.'],
 ['CYC','OH en C1 implícito; etil en C2.'],['CYC','OH en C1 implícito; metil en C3.'],['CYC','OH en C1 implícito; metilos en C2,C3.'],
 ['CYC','Carbonilo cíclico en C1 implícito; etil en C3.'],['CYC','Carbonilo en C1 implícito; propil en C2.'],['CYC','Carbonilo en C1 implícito; metilos C2,C4.'],
 ['CYC','C=O en C1; C2=C3; metil en C3.'],['CYC','C=O en C1; C2=C3; etil en C4.'],['CYC','C=O en C1; C2=C3; metilos en C2,C4.'],
];
b60.forEach(([rule,locants],i)=>add(`B60-G${String(i+1).padStart(2,'0')}`,rule,locants,'Sin defecto de sintaxis demostrado; paréntesis delimitan ramas cuando las hay.'));
add('B50-CID1254','CYC,SUB','OH C1 implícito; rama C2 y metil C5. La rama tiene metil en su C1.','Metil antes de metiletil; separación de locantes externos/internos.','propan-2-il es alternativa de grupo a 1-metiletil (S2 P-29.2); no se cambia el nombre.');
add('B50-CID7731','BEN','Anillo libre: conjunto 1,4; metil precede a metoxi en ES.','No trasladar automáticamente orden/locantes del inglés.');
add('B50-CID326','ALD,SUB','CHO fija C1; rama C4, C1 del etil sustituido.','Rama entre paréntesis.');
add('B50-CID7439','CYC,SUB','C=O C1; C2=C3; metil C2; rama insaturada C5.','Conectividad consistente; falta respaldo español específico de «1-metilvinil» y su alcance de uso.','prop-1-en-2-il es candidato a contraste, no sustitución aprobada en esta auditoría.');
add('B50-CID7455','EST','Metil C4 del benzoato; O-metilo.','Ácido y alcohol no intercambiados.');
add('B50-CID7813','AMI','NH2 fija C1; metil en C4.','Anilina retenida; sustitución en C, no N.');
add('B50-CID69274','AMD','CONH2 fija C1; metil en C4.','Benzamida retenida.');
add('B50-CID7724','NIT','CN fija C1; metil en C4.','Benzonitrilo retenido.');
add('B50-CID7473','BEN','Conjunto 1,4; metil precede a nitro en ES.','Nitro es prefijo, no sufijo.');
add('B50-CID9603','BEN','Conjunto 1,4; fluoro precede a metil.','Prefijo fluoro.');
add('B50-CID7931','BEN','Conjunto 1,3; cloro precede a metil.','Prefijo cloro.');
add('B50-CID7236','BEN','Conjunto 1,2; bromo precede a metil.','Prefijo bromo.');
add('B50-CID12207','BEN','Conjunto 1,4; metil precede a yodo en ES.','Yodo, adaptación española respaldada en S1.');
add('B50-CID11419','CYC','C=O C1 implícito; metil en C2.','Omisión del 1 de monocetona cíclica no demuestra error.');
for(const [id,loc] of [['B61-I01',4],['B61-I02',2],['B62-I19',3]]) add(id,'ALD',`CHO fija C1; etoxi en C${loc}.`,'Etoxi conserva unión por O.');
add('B61-I03','AMD','CONH2 fija C1; etil C4.','Sin N-etil inventado.');
add('B61-I04','AMD','Etil en N; metil C4 del anillo.','N no equivale a localizador numérico; etil antes de metil.');
for(const [id,loc] of [['B61-I05','4'],['B61-I06','3,4'],['B62-I14','2'],['B62-I16','3']])add(id,'NIT',`CN fija C1 del anillo; fluoro en ${loc}.`,'di no altera el orden alfabético.');
add('B61-I07','I07','C1 es carbono de CN; C2 porta OH y fenilo; anillo no es progenitor del nitrilo.','fenil precede a hidroxi en ES; ambos 2; sin R/S inventado.','2-fenil-2-hidroxiacetonitrilo: alternativa por raíz retenida, inferida de S2; no fuente directa ni PIN ES adjudicado.');
add('B61-I08','EST,SUB','Acilo con seis C; alcohol unido por C1 y C2=C3.','«de» separa partes; -ilo libre y -il en prefijo no se confunden.');
add('B61-I09','CHAIN','C=O C2; bromo C1 frente a numeración inversa que daría C=O C3.','bromo prefijo; ona sufijo.');
add('B61-I10','CYC','C=O C1; etil C3; metilos C3,C5,C5; conjunto mínimo.','Etil antes de trimetil, ignorando tri al ordenar.');
add('B61-I11','CYC','C=O C1; etil C4.','Ciclohexanona con C1 implícito.');
add('B61-I12','CYC','C=O C1; etil C2; metil C3.','Etil antes de metil.');
add('B61-I13','CYC,SUB','OH C1; C3=C4; metil C4 y rama en C1.','Insaturación 3 frente a 4 en sentido contrario; -en-1-ol.');
add('B61-I14','CYC,SUB','Doble enlace del anillo C1=C2; ramas C3,C6; metilideno es =CH2, no metilo.','metiletil precede a metilideno; paréntesis conservan C1 interno.');
add('B61-I18','BEN','Conjunto de todas las posiciones 1,2,3,4,5; metilos 1,3,5 y nitros 2,4.','Metil antes de nitro; tri/di no reordenan los prefijos.');
add('B61-I20','ALD','CHO fija C1; etoxi C2; cloros C3,C5.','Cloro antes de etoxi, ignorando di.');
add('B62-I03','CHAIN','Cadena propano con C=O C2; fenil C1 frente a C3.','Fenil prefijo y -ona función principal.');
add('B62-I09','CHAIN','CHO C1; dobles C2=C3 y C6=C7; metilos C3,C7; 2E especificado.','Sin E/Z nuevo en C6=C7, cuyo extremo C7 lleva grupos equivalentes.');
add('B62-I10','CHAIN','CHO C1; doble C2=C3; fenil C3; 2E especificado.','fenilprop-2-enal, sin alterar el descriptor almacenado.');
add('B62-I11','ACID','N de piridina C1; carboxilos unidos en C3,C5, externos al anillo.','Ácido + piridina + dicarboxílico; no se trata C=O como alquilo.');
add('B62-I13','CYC','C=O C1 implícito; etil C2.','Ciclohexanona.');
add('B62-I15','AMD','Etil en N, no en el anillo.','N-etil unido sin espacio; benzamida retenida.');
add('B62-I17','AMD','CONH2 fija C1; cloro C4.','clorobenzamida, sin guion terminal ante progenitor.');
add('B62-I18','BEN','Fenol fija C1; metil C2; bromo C4.','Bromo antes de metil; no se fuerza C1 para primer prefijo.');
add('B62-I20','CYC','C=O C1 implícito; metil C2.','Ciclopentanona.');

const rows = audit.rows.map(r => {
  const n = notes.get(r.id);
  if(r.profiles.es.name && !n)throw new Error(`Missing manual assessment ${r.id}`);
  return {
    ordinal:r.ordinal, cohort:r.cohort, id:r.id, repeat:r.repeatOfMainCohort,
    es:r.profiles.es.name, en:r.profiles.en.name, referenceSmiles:r.smilesReference,
    formula:r.formulaActual ?? r.formulaReference,
    structuralEvidence:r.profiles.en.opsin.status === 'EQUIVALENT' ? 'B6.2.2 EN OPSIN equivalent; inherited, not rerun or Spanish parsing' : 'No name interpreted',
    priorEsAuditStatus:r.profiles.es.auditStatus,
    productSupport:r.profiles.es.internalSupport ?? r.profiles.es.support,
    auditStatus:!n ? 'ES-INCONCLUSIVE' : r.id==='B50-CID7439' ? 'ES-STRUCTURALLY-CONSISTENT' : 'ES-RULE-SUPPORTED',
    directCompoundSource:null,
    ...(n ?? {rule:null,locants:'No hay nombre activo que adjudicar.',syntax:'Sin nombre; no se deduce error terminológico del bloqueo.',alternatives:'No se propone nombre para desbloquear el caso.'}),
    preference:'No se certifica PIN español.',
  };
});
const counts = Object.fromEntries(['ES-DIRECTLY-SUPPORTED','ES-RULE-SUPPORTED','ES-STRUCTURALLY-CONSISTENT','ES-INCORRECT','ES-INCONCLUSIVE'].map(s=>[s,rows.filter(r=>r.auditStatus===s).length]));
const protectedFiles = ['reports/b61/README.md','reports/b61/matrix.md','reports/b62/README.md','reports/b622/README.md','reports/b622/matrix.md',input,'tests/fixtures/b62-independent-reference.json','tests/fixtures/b62-supplemental.json'];
const result = {audit:'B6.3 manual Spanish terminology review',date:consulted,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),input,inputSha256:hash(bytes),sources,rules,counts,availableRows:rows.filter(r=>r.es).length,availableUniqueNames:new Set(rows.filter(r=>r.es).map(r=>r.es)).size,protectedFiles:protectedFiles.map(path=>({path,sha256:hash(readFileSync(path))})),rows};
mkdirSync('reports/b63',{recursive:true});
writeFileSync('reports/b63/audit.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const esc = x => String(x ?? '—').replaceAll('|','\\|');
let md = '# B6.3 — matriz terminológica española\n\nRevisión manual de las 84 filas congeladas B6.2.2; no es otro parser ni nueva medición OPSIN. Las fuentes y las reglas se identifican en README.md y audit.json. Una etiqueta ES no altera el soporte del producto. Las 15 filas sin nombre se conservan como ES-INCONCLUSIVE por ausencia de objeto terminológico, no como nombres incorrectos.\n\n';
md += '| Fila / ID | ES activo | EN activo | Identidad heredada | Regla / fuente | Localizadores | Sintaxis / pendiente | Alternativa / preferencia | Resultado |\n|---|---|---|---|---|---|---|---|---|\n';
for(const r of rows)md += '| '+[`${r.ordinal} / ${r.id}${r.repeat?' (repetida)':''}`,r.es,r.en,r.es?'EN equivalente B6.2.2':'Sin nombre',r.rule,r.locants,r.syntax,r.alternatives,r.auditStatus].map(esc).join(' | ')+' |\n';
md += '\n## Claves de reglas\n\n'+Object.entries(rules).map(([id,text])=>`- **${id}**: ${text}`).join('\n')+'\n\nNo hay una fuente específica consultada para el nombre completo de ninguno de los 66 nombres distintos. El respaldo de un progenitor no se registra como apoyo directo del derivado. La preferencia PIN permanece sin adjudicar para todos los perfiles.\n';
writeFileSync('reports/b63/matrix.md',md,{flag:'wx'});
console.log(JSON.stringify({counts,availableRows:result.availableRows,availableUniqueNames:result.availableUniqueNames},null,2));
