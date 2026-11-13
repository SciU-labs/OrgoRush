import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
const files=readdirSync('app',{recursive:true,withFileTypes:true}).filter(x=>x.isFile()&&/\.tsx?$/.test(x.name)).map(x=>resolve(x.parentPath,x.name));
const known=new Set(files),graph=new Map();
for(const file of files){const source=readFileSync(file,'utf8');const deps=[];
 for(const match of source.matchAll(/\b(?:import|export)\s+(?!type\b)[\s\S]*?\sfrom\s*["'](\.[^"']+)["']/g)){
  const base=resolve(file,'..',match[1]);const target=[base,base+'.ts',base+'.tsx',join(base,'index.ts'),join(base,'index.tsx')].find(x=>known.has(x));if(target)deps.push(target);
 }graph.set(file,deps);
}
const changed=['page.tsx','condensed-layout.ts','condensed-renderer.tsx','structural-color-classification.ts','visual-numbering.ts','validated-name-derivation.ts','reasoning-derivation-adapter.ts','reasoning-parent-selection.ts','reasoning-name-fragments.ts','reasoning-visual-targets.ts'];
const cycles=[];
for(const name of changed){const start=resolve('app',name),visited=new Set([start]),visit=(node,path)=>{for(const next of graph.get(node)??[]){if(next===start){cycles.push([...path,next].map(x=>relative('.',x)));continue}if(!visited.has(next)){visited.add(next);visit(next,[...path,next]);}}};visit(start,[start]);}
const result={method:'Static local runtime import/export from clauses; excludes type-only imports; not a dynamic-import audit',changed,cycles};
writeFileSync('reports/b741/stage-e-imports.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
