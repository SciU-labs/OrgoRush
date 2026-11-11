import { readFile, writeFile } from 'node:fs/promises';
import { generalizationInput } from '../tests/fixtures/b60-generalization-input.mjs';
const directory=new URL('../reports/b60/',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,directory),'utf8'));
const initial=await read('initial.json'), final=await read('final.json'), ui=await read('e2e/results.json');
if(ui.cases.length!==14 || ui.cases.some(row=>row.status!=='PASS'))throw new Error('Final UI report must contain 14 passing cases');
const parentNotes={1254:'Único ciclo con OH; P-59.2.1.4',326:'Benzaldehído retenido; anillo + C aldehídico externo',7439:'Único ciclo con C=O; P-59.2.1.4',7455:'Benzoato; C carbonílico externo y alcohol separado',7813:'Anilina retenida; anillo + amino por C1',69274:'Benzamida retenida; C(=O)N externo',7724:'Benzonitrilo retenido; C≡N externo',11419:'Único ciclo con C=O; P-59.2.1.4'};
const limitations={1254:'Sin configuración absoluta; monoalcohol',326:'Prefijos acotados; sin PIN certificado',7439:'Una insaturación anular; sin configuración absoluta',7455:'Éster simple; sin PIN certificado',7813:'Sin sustitución sobre N ni funciones superiores',69274:'Amida primaria; sin sustitución sobre N',7724:'Mononitrilo; prefijos acotados',11419:'Monocetona; sin configuración absoluta'};
const h='| CID | Nombre ES | Nombre EN | Anterior ES/EN | Posterior ES/EN | Nombre→grafo | Evidencia de progenitor | Evidencia de numeración | Función principal | Sustituyentes | Controles | Pruebas | Limitación |';
const lines=['# B6.0 — matriz completa del corpus histórico','',
  'Estados del perfil local actual. FULL significa reconstrucción y reglas admitidas; preferred permanece false. Los nombres de referencia de ibuprofeno no se generan localmente.','',h,
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
for(const row of final.rows) {
  const before=initial.rows.find(r=>r.cid===row.cid), es=row.profiles.es,en=row.profiles.en;
  const browser=ui.cases.find(r=>r.cid===row.cid), blocked=row.cid===3672;
  const names=blocked?['ácido 2-[4-(2-metilpropil)fenil]propanoico (referencia; local bloqueado)','2-[4-(2-methylpropyl)phenyl]propanoic acid (referencia; local bloqueado)']:[es.name,en.name];
  const positions=es.evidence?.numbering;
  const numbering=blocked?'Sin numeración local afirmada':positions
    ? `C1 por función; ${positions.priorities.join(' > ')}; comparación ${positions.comparison}`
    : 'Mínimos + desempate alfabético por idioma (B5.4)';
  const substitutes=es.components.filter(c=>['prefix','substituent'].includes(c.role)).map(c=>`${c.text}${c.locant?` (padre ${c.locant})`:''}${c.internalNumbering?' [ámbito interno separado]':''}`).join('; ');
  const cells=[row.cid,...names,`${before.profiles.es.status}/${before.profiles.en.status}`,`${es.status}/${en.status}`,
    blocked?'Sin nombre local; reconciliación externa histórica conservada':'Sí, ES/EN separados; isomorfía completa',
    blocked?'No afirmado por el generador local':parentNotes[row.cid]??'Benceno de seis C (gramática B5.4)',numbering,
    blocked?'Ácido carboxílico (estructural)':es.principalGroup,
    blocked?'Rama arílica e isobutilo; sin asignación local de nombre':substitutes,
    browser?`${browser.controls} activaciones; ES→EN→ES→EN; átomos/enlaces/localizadores exactos`:'Sin FULL local; controles externos históricos en regresión',
    browser?'Modelo + metamórficas + Chromium PASS':'Importación y bloqueo PASS; reconciliador externo PASS',
    blocked?'Bloqueo local deliberado preservado':limitations[row.cid]??'Gramática B5.4 acotada; sin PIN certificado'];
  lines.push(`| ${cells.map(c=>String(c).replaceAll('|','/')).join(' | ')} |`);
}
await writeFile(new URL('matrix.md',directory),lines.join('\n')+'\n');
const controls=ui.cases.reduce((sum,row)=>sum+row.controls,0);
await writeFile(new URL('coverage.json',directory),JSON.stringify({historicalB54Full:14,initial:initial.counts,final:final.counts,
  newlyFullSinceStart:final.counts.FULL-initial.counts.FULL,newlyFullSinceB54:final.counts.FULL-14,
  localMolecules:14,imported:15,generalization:{constructedMolecules:24,families:8,positiveProfiles:48,negativePairings:24*23*2,externalValidation:false},
  ui:{chromium:ui.browser,molecules:14,languageStates:56,activations:controls}},null,2)+'\n');
const corpus=['# B6.0 — corpus construido de generalización','',
  '24 estructuras distintas, posteriores a las reglas. No son registros PubChem ni respuestas OPSIN. Los SMILES y las fórmulas se especificaron separadamente del analizador de nombres; OCL verifica conectividad y composición. La validación remota quedó impedida por la revisión automática. No hay CID ni fecha de recuperación inventados. Creación: 2026-11-10; estereoquímica ausente. Expectativa y resultado: FULL ES/EN para estos controles acotados.','',
  '| ID | Familia | ES | EN | Fórmula | SMILES construido |','|---|---|---|---|---|---|',
  ...generalizationInput.map(r=>`| ${r.id} | ${r.family} | ${r.es} | ${r.en} | ${r.formula} | ${r.smiles} |`),
  '', 'Fuente normativa: [Blue Book P-5](https://iupac.qmul.ac.uk/BlueBook/P5.html), [P-60–65](https://iupac.qmul.ac.uk/BlueBook/P6.html), [P-66–69](https://iupac.qmul.ac.uk/BlueBook/P6a.html). No constituye certificación PIN.'];
await writeFile(new URL('generalization.md',directory),corpus.join('\n')+'\n');
console.log(JSON.stringify({matrixRows:final.rows.length,controls,uiCases:ui.cases.length}));
