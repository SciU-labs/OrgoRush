import {readFileSync,writeFileSync} from 'node:fs';
const corpus=JSON.parse(readFileSync('tests/fixtures/b72-independent-reference.json','utf8'));
const initial=JSON.parse(readFileSync('reports/b72/baseline.json','utf8'));
const post=JSON.parse(readFileSync('reports/b72/post-final.json','utf8'));
const rows=corpus.records.map(r=>({source:r,initial:initial.rows.find(x=>x.id===r.id),post:post.rows.find(x=>x.id===r.id)}));
const counts=phase=>Object.fromEntries(['FULL','PARTIAL','UNSUPPORTED'].map(status=>[status,rows.filter(x=>x[phase].profiles.en.status===status).length]));
const summary={count:rows.length,initial:counts('initial'),post:counts('post'),opsinEquivalent:rows.filter(x=>x.post.opsin?.equivalent).length,
 postIsBlind:false,maximumNovelCount:13,knownPriorControl:'B72-13',method:'Comparison uses OpenChemLib, also used in OrgoRush.'};
writeFileSync('reports/b72/coverage.json',JSON.stringify(summary,null,2)+'\n');
writeFileSync('reports/b72/matrix.md','# B7.2: matriz de mediciones\n\n| Caso | Referencia | Inicial ES / EN | Posterior ES / EN | Nombre EN | OPSIN |\n|---|---|---|---|---|---|\n'+rows.map(({source,initial,post})=>`| [${source.id}](${source.source}) | ${source.referenceName} | ${initial.profiles.es.status} / ${initial.profiles.en.status} | ${post.profiles.es.status} / ${post.profiles.en.status} | ${post.profiles.en.name??'—'} | ${post.opsin ? post.opsin.equivalent?'equivalente':'NO equivalente' : 'sin nombre'} |`).join('\n')+'\n');
console.log(JSON.stringify(summary));
