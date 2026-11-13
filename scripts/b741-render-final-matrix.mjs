import {readFileSync,writeFileSync} from 'node:fs';
const file='reports/b741/family-matrix.md',marker='## Etapa E — medición final';
const matrix=JSON.parse(readFileSync('reports/b741/stage-e-matrix.json','utf8'));
const previous=readFileSync(file,'utf8').split(marker)[0].trimEnd();
const lines=[marker,'','La medición posterior reutiliza los 31 grafos originales; FULL indica reconciliación del nombre exacto y PARTIAL ausencia de esa prueba. OPSIN compara conectividad completa mediante OpenChemLib, compartido con la aplicación. Los resultados no certifican PIN. [Datos completos](stage-e-matrix.json) · [Auditoría PARTIAL del modelo](stage-e-partial.json).','','| Familia | Nombre ES | Estado ES | Nombre EN | Estado EN | OPSIN EN |','|---|---|---|---|---|---|'];
for(const r of matrix.rows)lines.push(`| ${r.family} | ${r.languages.es.name??'—'} | ${r.languages.es.status} | ${r.languages.en.name??'—'} | ${r.languages.en.status} | ${r.opsin.status} |`);
writeFileSync(file,`${previous}\n\n${lines.join('\n')}\n`);
