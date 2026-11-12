import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const refs=read('tests/fixtures/b701-independent-reference.json').records;
const freeze=read('reports/b701/corpus-freeze.json');
const initial=read('reports/b701/initial.json'),post=read('reports/b701/post-verified.json');
const opsinBefore=read('reports/b701/opsin-initial.json'),opsinAfter=read('reports/b701/opsin-post.json');
const counts=rows=>Object.fromEntries(['es','en'].map(lang=>[lang,rows.reduce((o,r)=>{const s=r.profiles[lang]?.status??'UNSUPPORTED';o[s]=(o[s]??0)+1;return o}, {})]));
const countsOpsin=rows=>rows.reduce((o,r)=>{o[r.status]=(o[r.status]??0)+1;return o},{});
const coverage={fixtureSha256:freeze.sha256,count:refs.length,initialProfiles:counts(initial.rows),postProfiles:counts(post.rows),
  initialOpsin:countsOpsin(opsinBefore.rows),postOpsin:countsOpsin(opsinAfter.rows),postDevelopedOnCorpus:true,
  localNameOrderDefects:['B701-03','B701-04','B701-05','B701-17'],
  initialContradicted:opsinBefore.rows.filter(r=>r.status==='CONTRADICTED').map(r=>r.id)};
writeFileSync('reports/b701/coverage.json',JSON.stringify(coverage,null,2)+'\n');
const esc=s=>String(s??'—').replaceAll('|','\\|');
const lines=['# B7.0.1 — matriz de medición','',
  'La comparación OPSIN es para EN; FULL indica reconstrucción interna del nombre activo. El resultado posterior se desarrolló sobre este corpus y no es ciego.','',
  '| ID / fuente | Referencia EN | Inicial ES / EN | OPSIN inicial | Final ES / EN | OPSIN final |',
  '|---|---|---|---|---|---|'];
for(const ref of refs) {
  const a=initial.rows.find(x=>x.id===ref.id),b=post.rows.find(x=>x.id===ref.id),oi=opsinBefore.rows.find(x=>x.id===ref.id),op=opsinAfter.rows.find(x=>x.id===ref.id);
  const p=(r,k)=>`${r.profiles[k]?.status??'UNSUPPORTED'}: ${esc(r.profiles[k]?.name)}`;
  lines.push(`| [${ref.id} / ${ref.cid}](${ref.source}) | ${esc(ref.referenceName)} | ${p(a,'es')} / ${p(a,'en')} | ${oi.status} | ${p(b,'es')} / ${p(b,'en')} | ${op.status} |`);
}
writeFileSync('reports/b701/matrix.md',lines.join('\n')+'\n');console.log(JSON.stringify(coverage));
