import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const records=read('tests/fixtures/b71-independent-reference.json').records;
const baseline=read('reports/b71/baseline.json').rows,post=read('reports/b71/post-final.json').rows;
const count=rows=>Object.fromEntries(['es','en'].map(lang=>[lang,rows.reduce((a,r)=>{const s=r.profiles?.[lang]?.status??'UNSUPPORTED';a[s]=(a[s]??0)+1;return a},{})]));
const corpusRows=rows=>rows.filter(r=>r.id.startsWith('B71-'));
const coverage={corpusCount:records.length,baseline:count(corpusRows(baseline)),post:count(corpusRows(post)),postDevelopedOnCorpus:true,
  baselineOpsinEquivalent:corpusRows(baseline).filter(r=>r.opsin?.equivalent).length,
  postOpsinEquivalent:corpusRows(post).filter(r=>r.opsin?.equivalent).length,
  corpusSha256:read('reports/b71/corpus-freeze.json').sha256};
writeFileSync('reports/b71/coverage.json',JSON.stringify(coverage,null,2)+'\n');
const fmt=r=>r.profiles?`${r.profiles.es.status} / ${r.profiles.en.status}`:'UNSUPPORTED / UNSUPPORTED';
const lines=['# B7.1 — matriz del corpus','', 'La columna posterior se desarrolló sobre estos datos; no es una nueva medición ciega. OPSIN solo interpreta EN.','',
 '| ID / fuente | Nombre de referencia | Inicial ES / EN | Posterior ES / EN | Nombre EN posterior | OPSIN posterior |', '|---|---|---|---|---|---|'];
for(const r of records){const a=baseline.find(x=>x.id===r.id),b=post.find(x=>x.id===r.id);lines.push(`| [${r.id} / ${r.cid}](${r.source}) | ${r.referenceName} | ${fmt(a)} | ${fmt(b)} | ${b.profiles?.en?.name??'—'} | ${b.opsin?b.opsin.equivalent?'equivalente':'inconcluso o diferente':'sin nombre'} |`)}
writeFileSync('reports/b71/matrix.md',lines.join('\n')+'\n');console.log(JSON.stringify(coverage));
