import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {build} from 'vite';

// Recover the B7.3 in-memory page from its unchanged B7.2 helper and the
// preserved uncommitted B7.3 edits; verify its recorded hash before building.
const path='app/page.tsx',current=readFileSync(path,'utf8'),eol=current.includes('\r\n')?'\r\n':'\n';
let baseline=current.replace(/\r\n/g,'\n');
const head=spawnSync('git',['show','HEAD:app/page.tsx'],{encoding:'utf8'});if(head.status!==0)throw Error('Cannot read HEAD page');
const old=head.stdout.replace(/\r\n/g,'\n');
const replaceOnce=(needle,replacement)=>{if(!baseline.includes(needle)||baseline.indexOf(needle)!==baseline.lastIndexOf(needle))throw Error(`Cannot reverse ${needle.slice(0,70)}`);baseline=baseline.replace(needle,replacement)};
replaceOnce('&& terminalGroups.length === 1 && (molecule.rings?.length === 1 || Boolean(amideBenzylEvidence(molecule,terminalGroups[0])))','&& terminalGroups.length === 1 && molecule.rings?.length === 1');
replaceOnce('const parent = analysis.mainChain, ring = molecule.rings!.find(candidate=>candidate.atomIds.length===parent.length && candidate.atomIds.every(id=>parent.includes(id)));\n    if(!ring)return analysis;','const ring = molecule.rings![0], parent = analysis.mainChain;');
const start='function amideBenzylEvidence(',end='\nfunction nitrogenSubstituentPrefixes(';
const section=s=>s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)));
replaceOnce(section(baseline),section(old));
const guardStart='  // A benzamide N directly bonded to a second aromatic ring requires an\n';
const guardEnd='  if (hasUnrepresentedArylSubstitution(molecule, analysis)) return true;';
const a=baseline.indexOf(guardStart),b=baseline.indexOf(guardEnd,a);if(a<0||b<0)throw Error('Missing N-aryl guard');baseline=baseline.slice(0,a)+baseline.slice(b);
baseline=baseline.replace(/\n/g,eol);
const hash=createHash('sha256').update(baseline).digest('hex'),expected=JSON.parse(readFileSync('reports/b73/post-final.json','utf8')).pageSha256;
if(hash!==expected)throw Error(`B7.3 source reconstruction hash mismatch: ${hash} != ${expected}`);
const grammarPath='app/systematic-family-grammar.ts',grammar=readFileSync(grammarPath,'utf8'),line='  if(result.reduce((sum,p)=>sum+(p.nCount??0),0)>1 && result.some(p=>p.onAmideN&&p.term.en==="benzyl"))return null;';
const anchor='  if(result.reduce((sum,p)=>sum+(p.nCount??0),0)>2)return null;';
if(!grammar.includes(anchor)||grammar.includes(line))throw Error('Cannot reconstruct B7.3 grammar');
const baselineGrammar=grammar.replace(anchor,`${anchor}${grammar.includes('\r\n')?'\r\n':'\n'}${line}`);
async function measure(previous){
 const plugin={name:'b74-benchmark-source',enforce:'pre',load(id){const normalized=id.replace(/\\/g,'/');
   if(previous&&normalized.endsWith('/app/page.tsx'))return baseline;
   if(previous&&normalized.endsWith('/app/systematic-family-grammar.ts'))return baselineGrammar;
   return null;}};
 const result=await build({configFile:'vite.pages.config.ts',plugins:[plugin],build:{write:false,reportCompressedSize:false},logLevel:'error'});
 const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output).filter(x=>x.type==='chunk');
 return {chunks:outputs.length,javascriptBytes:outputs.reduce((n,x)=>n+Buffer.byteLength(x.code),0),gzipBytes:outputs.reduce((n,x)=>n+gzipSync(x.code,{level:9}).length,0)};
}
const before=await measure(true),after=await measure(false),result={baselinePageSha256:hash,method:'Vite Pages production builds in memory; B7.3 page hash verified, grammar restored from B7.4 guard',before,after,deltaBytes:after.javascriptBytes-before.javascriptBytes,deltaGzipBytes:after.gzipBytes-before.gzipBytes};
writeFileSync('reports/b74/bundle-size.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
