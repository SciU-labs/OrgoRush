import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {CanonizerUtil,Molecule,SmilesParser} from 'openchemlib';
import {referenceParentCandidates,normalizeFormula} from '../tests/helpers/validation-008-reference.mjs';
import {VALIDATION_CASES,PROFILES,TARGETS,BASELINE,SOURCES} from '../tests/fixtures/orgorush-validation-014.mjs';
export {referenceParentCandidates,normalizeFormula};
export const digest=value=>createHash('sha256').update(value).digest('hex');
// Vocabulary is applied to independently supplied reference names, never to
// production outputs. Unreviewed boundary families get no Spanish expectation.
export function referenceSpanish(name){
 if(!name)return null;
 const ester=name.match(/^(.+) ([^ ]+oate)$/);
 if(ester){let alkyl=referenceSpanish(ester[1]),acid=referenceSpanish(ester[2]);if(!alkyl||!acid)return null;return `${acid} de ${alkyl.endsWith('il')?alkyl+'o':alkyl}`;}
 let s=name;
 const vocabulary=[['methylidene','metilideno'],['ethylidene','etilideno'],['methylene','metileno'],['ethynyl','etinil'],['ethenyl','etenil'],['methoxy','metoxi'],['ethoxy','etoxi'],['propoxy','propoxi'],['hydroxy','hidroxi'],['cyano','ciano'],['methyl','metil'],['ethyl','etil'],['propyl','propil'],['butyl','butil'],['pentyl','pentil'],['hexyl','hexil'],['heptyl','heptil'],['octyl','octil'],['chloro','cloro'],['iodo','yodo'],['tert-','terc-'],['bicyclo','biciclo'],['cyclo','ciclo'],['spiro','espiro'],['naphthalene','naftaleno'],['naphthalen','naftalen'],['phenanthren','fenantren'],['anthracene','antraceno'],['benzene','benceno'],['benzen','bencen'],['pyridine','piridina'],['quinoline','quinolina'],['thiophene','tiofeno'],['aniline','anilina'],['benzonitrile','benzonitrilo'],['benzamide','benzamida']];
 for(const [a,b]of vocabulary)s=s.replaceAll(a,b);
 s=s.replace(/meth(?=an|-)/g,'met').replace(/eth(?=an|-)/g,'et').replace(/ynyl/g,'inil').replace(/enyl/g,'enil').replace(/-yl/g,'-il');
 s=s.replace(/anediol/g,'anodiol').replace(/anedione/g,'anodiona').replace(/anedial/g,'anodial').replace(/anediamine/g,'anodiamina').replace(/anediamide/g,'anodiamida').replace(/anedinitrile/g,'anodinitrilo');
 s=s.replace(/ane(?=-\d+(?:,\d+)*-(?:diol|dione|diamine))/g,'ano');
 s=s.replace(/carboxylic acid$/,'carboxílico').replace(/oic acid$/,'oico');if(name.endsWith(' acid'))s='ácido '+s;
 s=s.replace(/nitrile$/,'nitrilo').replace(/amide$/,'amida').replace(/amine$/,'amina').replace(/oate$/,'oato').replace(/one$/,'ona').replace(/yne$/,'ino').replace(/ene$/,'eno').replace(/ane$/,'ano').replace(/yn-/g,'in-');
 return s;
}
const historicalDifferentParents={
 '3-methylideneoct-1-ene':'2-pentyl-1,3-butadiene',
 '4-methylidenenon-2-ene':'2-pentyl-1,3-pentadiene',
 '3,5-dimethylideneoctane':'2-ethyl-4-propyl-1,4-pentadiene',
 '4-ethylideneundecane':'3-propyl-2-decene',
 '5-(prop-2-en-1-yl)undecane':'4-butyl-1-decene',
 '5-ethynylundecane':'3-butyl-1-nonyne',
 '6-ethenyldodecane':'3-pentyl-1-nonene',
 '6-(buta-1,3-dien-1-yl)tetradecane':'5-pentyl-1,3-tridecadiene',
};
const roots='pentadec|tetradec|tridec|dodec|undec|dec|non|oct|hept|hex|pent|but|prop|eth|meth';
export function referenceHistorical(name,category){
 if(category==='limits')return null;
 const stereo=/^\([\dRSZE,]+\)-/.exec(name)?.[0]??'',base=name.slice(stereo.length);
 if(historicalDifferentParents[base])return stereo+historicalDifferentParents[base];
 if(/cyclo.*(?:ene|diene)$|phenanthren/.test(base))return null;
 // Mixed principal groups are reviewed against C-13/C-15, not a blind parent
 // replacement. Parent-switching functional cases need individual evidence.
 if(/methylidene/.test(base)&&category!=='unsaturated')return null;
 let match=base.match(new RegExp(`^(.*?)(${roots})(a?)-(\\d+(?:,\\d+)*)-(en|dien|trien)-(\\d+(?:,\\d+)*)-(yne|diyne)$`));
 if(match){const[,p,r,a,d,en,t,yn]=match;return stereo+(p?p+'-':'')+`${d}-${r}${a}${en}-${t}-${yn}`;}
 match=base.match(new RegExp(`^(.*?)(${roots})(a?)-(\\d+(?:,\\d+)*)-(ene|diene|triene|tetraene|pentaene|yne|diyne|triyne)$`));
 if(match){const[,p,r,a,l,suffix]=match;return stereo+(p?p+'-':'')+`${l}-${r}${a}${suffix}`;}
 match=base.match(new RegExp(`^(.*?)(${roots})an-(\\d+)-(ol|one|amine)$`));
 if(match){const[,p,r,l,suffix]=match;return stereo+(p?p+'-':'')+`${l}-${r}an${suffix}`;}
 match=base.match(new RegExp(`^(.*?)(${roots})ane-(\\d+(?:,\\d+)*)-(diol|dione|diamine)$`));
 if(match){const[,p,r,l,suffix]=match;return stereo+(p?p+'-':'')+`${l}-${r}ane${suffix}`;}
 match=base.match(new RegExp(`^(.*?)(${roots})-(\\d+)-(en|yn)-(\\d+)-(ol|one)$`));
 if(match){const[,p,r,d,bond,f,suffix]=match;return stereo+(p?p+'-':'')+`${d}-${r}${bond}-${f}-${suffix}`;}
 match=base.match(new RegExp(`^(.*?)(${roots})-(\\d+)-enoic acid$`));
 if(match){const[,p,r,l]=match;return stereo+(p?p+'-':'')+`${l}-${r}enoic acid`;}
 if(/cyclo.*(?:ene|diene)$|phenanthren/.test(base))return null;
 return name.replaceAll('(propan-2-yl)','(1-methylethyl)').replaceAll('(butan-2-yl)','(1-methylpropyl)').replaceAll('(pentan-2-yl)','(1-methylbutyl)').replaceAll('(pentan-3-yl)','(1-ethylpropyl)');
}
export function identity(smiles,stereo=false){
 assert.equal(typeof smiles,'string','Identity requires a SMILES string, not an export result wrapper');
 const m=new SmilesParser().parseMolecule(smiles);
 for(let i=0;i<m.getAllAtoms();i++)m.setAtomMass(i,0);
 return CanonizerUtil.getIDCode(m,stereo?CanonizerUtil.NORMAL:CanonizerUtil.NOSTEREO);
}
const cacheRoot=new URL('../outputs/validation-014/opsin/',import.meta.url);
const frozenPath=new URL('../tests/fixtures/orgorush-validation-014.opsin.json',import.meta.url);
let frozen;
export function receipt(name){
 frozen??=existsSync(frozenPath)?new Map(JSON.parse(readFileSync(frozenPath,'utf8')).responses.map(r=>[r.name,r])):new Map();
 const cached=new URL(`${digest(name)}.json`,cacheRoot);
 const r=frozen.get(name)??(existsSync(cached)?JSON.parse(readFileSync(cached,'utf8')):null);
 if(r?.body)assert.equal(digest(r.body),r.sha256,`Corrupt independent reference ${name}`);
 return r;
}
export function witness(name,smiles){
 const r=receipt(name);let b;try{b=JSON.parse(r?.body);}catch{}
 if(r?.httpStatus!==200||b?.status!=='SUCCESS'||!b.smiles)return{status:'PENDING-REFERENCE',reason:b?.message??r?.error??'No successful independent parser receipt',url:r?.url,sha256:r?.sha256};
 const same=identity(b.smiles)===identity(smiles),stereoSame=identity(b.smiles,true)===identity(smiles,true);
 return{status:same?'PASS':'FAIL-STRUCTURE',stereoStatus:stereoSame?'PASS':'DIFFERENT',smiles:b.smiles,url:r.url,sha256:r.sha256,
  formula:new SmilesParser().parseMolecule(b.smiles).getMolecularFormula().formula};
}
const attributes=text=>Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
const atomicNumber={H:1,B:5,C:6,N:7,O:8,F:9,Na:11,P:15,S:16,Cl:17,K:19,Br:35,I:53};
export function rawMolecule(graph){
 const m=new Molecule(graph.atoms.length,graph.bonds.length),indices=new Map();
 for(const a of graph.atoms){assert.ok(atomicNumber[a.element??'C'],`Audit atomic table: ${a.element}`);const i=m.addAtom(atomicNumber[a.element??'C']);indices.set(a.id,i);m.setAtomCharge(i,a.charge??0);}
 for(const [a,b,order=1] of graph.bonds){const bond=m.addBond(indices.get(a),indices.get(b));m.setBondType(bond,order===1.5?Molecule.cBondTypeDelocalized:order===3?Molecule.cBondTypeTriple:order===2?Molecule.cBondTypeDouble:Molecule.cBondTypeSingle);}
 m.ensureHelperArrays(Molecule.cHelperCIP);return{m,indices};
}
export function normalizeGraph(graph){
 const {m,indices}=rawMolecule(graph),atoms=graph.atoms.map(a=>({...a,element:a.element??'C',charge:a.charge??0,aromatic:m.isAromaticAtom(indices.get(a.id))}));
 return{atoms,bonds:graph.bonds.map(([a,b,o=1])=>[a,b,m.isAromaticBond(m.getBond(indices.get(a),indices.get(b)))?1.5:o])};
}
function components(atoms,bonds){
 const seen=new Set(),groups=[];
 for(const a of atoms){if(seen.has(a.id))continue;const group=[],queue=[a.id];while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);group.push(id);for(const [l,r]of bonds){if(l===id&&!seen.has(r))queue.push(r);if(r===id&&!seen.has(l))queue.push(l);}}groups.push(group);}return groups;
}
export function cmlGraph(cml){
 const allAtoms=[...cml.matchAll(/<atom\b([^>]*?)(?:\/>|>([\s\S]*?)<\/atom>)/g)].map(([,attrs,body])=>{const a=attributes(attrs);return{id:a.id,element:a.elementType,charge:Number(a.formalCharge??0),cmlStereo:body?.match(/<atomParity[^>]*>([\s\S]*?)<\/atomParity>/)?.[0]??null};});
 const allBonds=[...cml.matchAll(/<bond\b([^>]*?)(?:\/>|>([\s\S]*?)<\/bond>)/g)].map(([,attrs])=>{const a=attributes(attrs),[l,r]=a.atomRefs2.split(' '),order={S:1,D:2,T:3,A:1.5,'1':1,'2':2,'3':3}[a.order];assert.ok(order,`CML bond order ${a.order}`);return[l,r,order];});
 assert.ok(allAtoms.length&&allBonds.length,'Complete CML reference');
 const ids=new Set(allAtoms.map(a=>a.id));assert.equal(ids.size,allAtoms.length);assert.ok(allBonds.every(([a,b])=>ids.has(a)&&ids.has(b)));
 const heavy=allAtoms.filter(a=>a.element!=='H'),heavyIds=new Set(heavy.map(a=>a.id));
 const normalized=normalizeGraph({atoms:heavy,bonds:allBonds.filter(([a,b])=>heavyIds.has(a)&&heavyIds.has(b))});
 const byId=new Map(normalized.atoms.map(a=>[a.id,a]));
 const graph={...normalized,element:id=>byId.get(id)?.element,
  neighbors:id=>normalized.bonds.flatMap(([a,b,order])=>a===id?[{id:b,order}]:b===id?[{id:a,order}]:[])};
 graph.kekuleBonds=allBonds.filter(([a,b])=>heavyIds.has(a)&&heavyIds.has(b));
 const counts={};for(const a of allAtoms)counts[a.element]=(counts[a.element]??0)+1;
 graph.formula=['C','H',...Object.keys(counts).filter(k=>!['C','H'].includes(k)).sort()].filter(k=>counts[k]).map(k=>k+(counts[k]===1?'':counts[k])).join('');
 graph.components=components(graph.atoms,graph.bonds);graph.cycleRank=graph.bonds.length-graph.atoms.length+graph.components.length;
 graph.valence=heavy.map(a=>{const used=allBonds.reduce((n,[l,r,o])=>n+(l===a.id||r===a.id?o:0),0),max={C:4,N:a.charge>0?4:3,O:a.charge<0?1:2,F:1,Cl:1,Br:1,I:1,S:6,P:5,B:a.charge<0?4:3,Na:0,K:0}[a.element];return{id:a.id,used,max,valid:used<=max||(byId.get(a.id).aromatic&&a.element==='N'&&used<=4)};});
 const groups=[];const add=(kind,carbonId,atomIds)=>groups.push({kind,carbonId,atomIds:[...new Set(atomIds)]});
 for(const a of graph.atoms.filter(a=>a.element==='C')){
  const near=graph.neighbors(a.id),o=near.find(e=>e.order===2&&graph.element(e.id)==='O'),nit=near.find(e=>e.order===3&&graph.element(e.id)==='N');
  if(nit)add('nitrile',a.id,[a.id,nit.id]);if(!o)continue;
  const so=near.find(e=>e.order===1&&graph.element(e.id)==='O'),sn=near.find(e=>e.order===1&&graph.element(e.id)==='N');
  if(so){const carbons=graph.neighbors(so.id).filter(e=>graph.element(e.id)==='C');add(carbons.length===1?'carboxylicAcid':'ester',a.id,[a.id,o.id,so.id,...carbons.map(e=>e.id)]);}
  else if(sn)add('amide',a.id,[a.id,o.id,sn.id]);
  else add(near.filter(e=>graph.element(e.id)==='C').length===2?'ketone':'aldehyde',a.id,[a.id,o.id]);
 }
 for(const a of graph.atoms){
  const near=graph.neighbors(a.id);
  if(a.element==='O'&&near.length&&near.every(e=>e.order===1&&graph.element(e.id)==='C')&&!groups.some(g=>g.atomIds.includes(a.id)))add(near.length===1?'alcohol':'ether',near[0].id,[a.id,...near.map(e=>e.id)]);
  if(a.element==='N'&&near.length&&near.every(e=>e.order===1&&graph.element(e.id)==='C')&&!groups.some(g=>g.atomIds.includes(a.id))
    &&near.every(e=>!graph.neighbors(e.id).some(x=>x.order===2&&graph.element(x.id)==='S')))add('amine',near[0].id,[a.id,...near.map(e=>e.id)]);
  if(['F','Cl','Br','I'].includes(a.element)&&near.length)add('halogen',near[0].id,[a.id,near[0].id]);
 }
 graph.groups=groups;graph.groupCounts=Object.fromEntries([...new Set(groups.map(g=>g.kind))].sort().map(k=>[k,groups.filter(g=>g.kind===k).length]));
 graph.primary=['carboxylicAcid','ester','amide','nitrile','aldehyde','ketone','alcohol','amine'].find(k=>graph.groupCounts[k]);
 return graph;
}
/** Independent bounded graph correspondence; no app namer or graph matcher. */
export function graphMapping(reference,actual){
 const target=normalizeGraph(actual);if(reference.atoms.length!==target.atoms.length||reference.bonds.length!==target.bonds.length)return{status:'FAIL-STRUCTURE',reason:'atom/bond cardinality'};
 const adjacent=g=>new Map(g.atoms.map(a=>[a.id,new Map(g.bonds.flatMap(([l,r,o])=>l===a.id?[[r,o]]:r===a.id?[[l,o]]:[]))]));
 const ra=adjacent(reference),ta=adjacent(target),options=new Map(reference.atoms.map(a=>[a.id,target.atoms.filter(b=>a.element===b.element&&(a.charge??0)===(b.charge??0)&&ra.get(a.id).size===ta.get(b.id).size).map(b=>b.id)]));
 const order=[...reference.atoms].sort((a,b)=>options.get(a.id).length-options.get(b.id).length||ra.get(b.id).size-ra.get(a.id).size);
 const map=new Map(),used=new Set();let visits=0,bounded=false;
 function walk(depth){if(++visits>50000){bounded=true;return false;}if(depth===order.length)return true;const id=order[depth].id;
  for(const candidate of options.get(id)){if(used.has(candidate)||[...map].some(([a,b])=>(ra.get(id).get(a)??0)!==(ta.get(candidate).get(b)??0)))continue;
   map.set(id,candidate);used.add(candidate);if(walk(depth+1))return true;map.delete(id);used.delete(candidate);}return false;}
 if(!walk(0))return{status:bounded?'PENDING-REFERENCE':'FAIL-STRUCTURE',reason:bounded?'isomorphism search bound':'non-isomorphic reference and imported graph',visits};
 return{status:'PASS',referenceToActual:map,actualToReference:new Map([...map].map(([a,b])=>[b,a])),visits};
}

const root=new URL('../',import.meta.url),out=new URL('outputs/validation-014/',root);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function baselineData(){return existsSync(new URL('baseline.json',out))?read(new URL('baseline.json',out)):read(frozenPath).baseline;}
function protect(){const b=baselineData();assert.equal(b.head,BASELINE,'Frozen audit baseline changed');for (const f of b.files) {
  const bytes = readFileSync(new URL(f.path, root));

  // Exact binary comparison first.
  if (digest(bytes) === f.sha256) continue;

  // Accept equivalent Windows/Linux line endings only.
  const lf = bytes.toString('utf8').replace(/\r\n/g, '\n');
  const crlf = lf.replace(/\n/g, '\r\n');

  assert.ok(
    !bytes.includes(0) &&
      (digest(lf) === f.sha256 || digest(crlf) === f.sha256),
    f.path + ': protected file changed beyond LF/CRLF normalization'
  );
}return digest(JSON.stringify(b.files));}
export const STATUSES=['PASS','FAIL-STRUCTURE','FAIL-NAME','FAIL-REASONING','UNSUPPORTED','PENDING-REFERENCE'];
const issue=(code,classification,severity,detail,evidence={})=>({code,classification,severity,detail,evidence});
export function classify(issues,available,backed){
 for(const classification of ['FAIL-STRUCTURE','FAIL-NAME','FAIL-REASONING'])if(issues.some(i=>i.classification===classification))return classification;
 return !available?'UNSUPPORTED':backed?'PASS':'PENDING-REFERENCE';
}
function sameSet(a,b){return a.length===b.length&&a.every(x=>b.includes(x));}
function plainMapping(mapping){return{...mapping,referenceToActual:mapping.referenceToActual?[...mapping.referenceToActual]:undefined,actualToReference:mapping.actualToReference?[...mapping.actualToReference]:undefined};}
function norm(name){return name?.normalize('NFC').replaceAll('–','-').trim();}
// Structural proof alone does not decide a preferred or historical name.
// Spanish nonmatching alternatives remain pending unless a specific defect is
// independently demonstrated. English and Spanish projections are not engines.
export function assess(row,key,variant,reference){
 const p=variant.profiles[key],a=p.analysis??{},issues=[],mapping=graphMapping(reference,variant.graph);
 const expected=row.expected[key]??null,expectedEnglish=row.expected[key.startsWith('2013')?'2013-en':'1979-en'];
 const exact=Boolean(expected?.some(n=>norm(n)===norm(p.name)));
 let nameProof={status:'PENDING-REFERENCE',reason:'No independently reviewed lexical/normative match'};
 const englishKey=key.startsWith('2013')?'2013-en':'1979-en',english=variant.profiles[englishKey]?.name;
 const englishWitness=english?witness(english,row.smiles):null;
 if(p.name&&key.endsWith('-en'))nameProof=englishWitness;
 else if(p.name&&exact&&expectedEnglish?.length)nameProof=witness(expectedEnglish[0],row.smiles);
 // Limited transparent lexical correspondence can prove a mistranslated
 // structure, but cannot certify a nonmatching Spanish name as preferred.
 const lexicalCorrespondence=Boolean(p.name&&english&&norm(referenceSpanish(english))===norm(p.name));
 if(p.name&&lexicalCorrespondence&&englishWitness?.status==='FAIL-STRUCTURE')nameProof={...englishWitness,via:'independent lexical correspondence to parsed English label'};
 if(mapping.status==='FAIL-STRUCTURE')issues.push(issue('INPUT-GRAPH','FAIL-STRUCTURE','P0',mapping.reason));
 if(p.name&&nameProof?.status==='FAIL-STRUCTURE')issues.push(issue('WRONG-MOLECULE','FAIL-STRUCTURE','P0','Independent name parser produces a different constitution',nameProof));
 if(p.analysisError||p.selectionError)issues.push(issue('ANALYSIS-EXCEPTION','FAIL-NAME','P1','Runtime exception on a valid input graph',{message:p.analysisError?.message??p.selectionError?.message}));
 if(p.name&&normalizeFormula(a.formula??'')!==normalizeFormula(row.formula))issues.push(issue('FORMULA','FAIL-STRUCTURE','P0','Published analysis formula disagrees with reference',{expected:row.formula,observed:a.formula}));
 const parent=a.mainChain??[],numbers=new Map(a.numberedAtoms??[]),atoms=new Map(variant.graph.atoms.map(a=>[a.id,a])),bonds=variant.graph.bonds;
 if(p.name){
  for(const s of a.substituents??[]){
   const englishAlkyl={metil:'methyl',etil:'ethyl',propil:'propyl',butil:'butyl',pentil:'pentyl',hexil:'hexyl',heptil:'heptyl',octil:'octyl',nonil:'nonyl',decil:'decyl'}[s.name];
   if(!englishAlkyl||(!p.name.includes(s.name)&&!p.name.includes(englishAlkyl)))continue;
   const ids=s.atomIds??[];if(!ids.length||!ids.every(id=>(atoms.get(id)?.element??'C')==='C'&&!parent.includes(id)))continue;
   const multiple=bonds.filter(([l,r,o])=>o>1&&((ids.includes(l)&&ids.includes(r))||(ids.includes(l)&&parent.includes(r))||(ids.includes(r)&&parent.includes(l))));
   if(multiple.length){issues.push(issue('SATURATED-BRANCH','FAIL-STRUCTURE','P0','An alkyl label replaces a branch containing a multiple bond',{substituent:s,multipleBonds:multiple,sources:[SOURCES.modernHydrocarbons,SOURCES.historicalUnsaturation]}));
    const highlights=(p.reasoning?.links??[]).filter(l=>l.atomIds?.some(id=>ids.includes(id))&&(l.text?.includes(s.name)||l.text?.includes(englishAlkyl)));
    if(highlights.length)issues.push(issue('BRANCH-EXPLANATION','FAIL-REASONING','P2','Explanation labels and highlights an unsaturated branch as saturated alkyl',{highlights,multipleBonds:multiple}));
   }
  }
  if(/\d+,\d+(?:,\d+)*-(?:en|yn|in)-\d+-(?:il|yl)/.test(p.name))issues.push(issue('RADICAL-MULTIPLICITY','FAIL-NAME','P1','Several radical unsaturation locants use a singular en/yn stem',{name:p.name,reference:SOURCES.historicalUnsaturation}));
  if(key.endsWith('-en')&&/tiof/.test(p.name))issues.push(issue('HETEROCYCLE-EN','FAIL-NAME','P2','English projection retains a Spanish heterocycle stem and relocates its substituent locant into an ene ending',{name:p.name,expected:row.referenceEnglish,reference:{url:SOURCES.modernHydrocarbons.url,sections:'P-22.2.2 retained mancude heteromonocycles; thiophene'}}));
  if(row.category==='stereo'&&nameProof?.status==='PASS'&&nameProof.stereoStatus==='DIFFERENT')issues.push(issue('STEREO-LOSS','FAIL-NAME','P1','Name does not preserve the specified stereochemical identity',{name:p.name,expected:row.referenceEnglish,parsed:nameProof.smiles}));
  if(variant.graphMutated||p.reasoningMutatedGraphOrAnalyses)issues.push(issue('MUTATION','FAIL-REASONING','P2','Analysis or explanation mutates its input'));
  if(p.reasoningError||p.reasoningIntegrity?.status!=='PASS')issues.push(issue('REASONING-INTEGRITY','FAIL-REASONING','P2','Interactive explanation fails its structural integrity checks',{message:p.reasoningError?.message??p.reasoningIntegrity?.message??'Explanation missing'}));
  // Fused-ring numbering contains bridgehead letters and is not an array index.
  if(!reference.cycleRank&&parent.some((id,i)=>numbers.get(id)!==i+1))issues.push(issue('NUMBERED-PARENT','FAIL-REASONING','P2','Parent sequence and numbered atoms disagree',{parent,numberedAtoms:[...numbers]}));
 }
 let parentOracle={status:'NOT-APPLICABLE',reason:'Cyclic, charged, or unsupported functional graph'};
 if(mapping.status==='PASS'&&!reference.cycleRank&&reference.components.length===1&&reference.atoms.every(a=>!a.charge)&&!['limits'].includes(row.category)){
  const paths=referenceParentCandidates(reference,key.startsWith('2013')?'2013-es':'1979-en');
  const chosen=parent.map(id=>mapping.actualToReference.get(id));
  parentOracle={status:paths?.some(path=>sameSet(path,chosen))?'PASS':'PENDING-REFERENCE',selected:chosen,candidates:paths,
   limitation:'Independent path seniority only; alphabetical final ties and complex group naming need the frozen normative name'};
 }
 let groupsCheck={status:'NOT-APPLICABLE'};
 if(p.name&&mapping.status==='PASS'){
  if((a.primaryFunctionalGroup??null)!==(reference.primary??null))issues.push(issue('PRINCIPAL-GROUP','FAIL-REASONING','P2','Explanation selects a different principal group from independent functional seniority',{observed:a.primaryFunctionalGroup??null,expected:reference.primary??null}));
  const observed=(a.functionalGroups??[]).filter(g=>g.kind!=='halogen');
  const unmatched=observed.filter(g=>!reference.groups.some(r=>r.kind===g.kind&&(g.atomIds??[]).every(id=>r.atomIds.includes(mapping.actualToReference.get(id)))));
  // Halogens are prefix substituents in the engine, not suffix functionalGroups.
  const missing=reference.groups.filter(r=>r.kind!=='halogen'&&!observed.some(g=>r.kind===g.kind&&(g.atomIds??[]).some(id=>r.atomIds.includes(mapping.actualToReference.get(id)))));
  groupsCheck={status:unmatched.length||missing.length?'PENDING-REFERENCE':'PASS',unmatched,missing};
  // Only a geometrically false asserted target is a confirmed reasoning error.
  if(unmatched.length)issues.push(issue('FUNCTION-TARGET','FAIL-REASONING','P2','A recognized functional group targets atoms inconsistent with independent CML bonds',{unmatched}));
  const fragments=Object.values(p.reasoning?.fragments??{}).flatMap(f=>[f,...(f.additionalFragments??[])]),links=p.reasoning?.links??[];
  for(const f of [...fragments,...links]){
   const contributions=f.contributions??[];
   for(const c of contributions){if(!reference.groups.some(g=>g.kind===c.group&&(c.atomIds??[]).every(id=>g.atomIds.includes(mapping.actualToReference.get(id)))))issues.push(issue('FUNCTION-HIGHLIGHT','FAIL-REASONING','P2','Interactive functional contribution highlights a chemically different target',{contribution:c}));}
   const order=f.bondType==='double'||f.kind==='doubleBond'?2:f.bondType==='triple'||f.kind==='tripleBond'?3:null;
   const correctEdge=order&&bonds.some(([l,r,o])=>o===order&&f.atomIds?.includes(l)&&f.atomIds?.includes(r));
   const locantEdge=Number.isInteger(f.locant)&&f.kind==='unsaturation'?[parent[f.locant-1],parent[f.locant]]:null;
   if(order&&f.atomIds?.length>=2&&(!correctEdge||(locantEdge&&!locantEdge.every(id=>f.atomIds.includes(id)))))issues.push(issue('BOND-HIGHLIGHT','FAIL-REASONING','P2','Unsaturation highlight has the wrong bond order or locant endpoints',{fragment:f}));
  }
 }
 const backed=Boolean(p.name&&exact&&nameProof?.status==='PASS'&&mapping.status==='PASS'&&p.reasoningIntegrity?.status==='PASS'&&groupsCheck.status==='PASS'&&(!parent.length||parentOracle.status!=='PENDING-REFERENCE')&&row.category!=='limits');
 const classification=classify(issues,Boolean(p.name),backed);
 return{name:p.name,available:Boolean(p.name),expected,classification,severity:issues.length?issues.map(i=>i.severity).sort()[0]:null,issues,
  evidence:{name:nameProof,englishCounterpart:englishWitness,lexicalCorrespondence,normativeExactMatch:exact,referenceSections:row.references,
   graph:plainMapping(mapping),parentOracle,groups:groupsCheck,reasoningIntegrity:p.reasoningIntegrity??null},
  coverage:!p.name?{kind:'future-coverage-opportunity',detail:p.availabilityDetail??a.cyclicUnsupported??'Explicitly unavailable',regression:'Not established: constitution absent from historical corpus'}:null,
  analysis:a,parent:parent,numberedAtoms:a.numberedAtoms??[],locants:{double:a.doubleBondLocants??[],triple:a.tripleBondLocants??[]},substituents:a.substituents??[],functionalGroups:a.functionalGroups??[],stereo:a.stereo??a.stereochemistry??null,
  reasoning:{status:issues.some(i=>i.classification==='FAIL-REASONING')?'FAIL-REASONING':p.name?'CHECKED':'NOT-APPLICABLE',model:p.reasoning??null}};
}
function count(observations){return Object.fromEntries(STATUSES.map(s=>[s,observations.filter(p=>p.classification===s).length]));}
export async function adjudicate(){
 const productionHash=protect(),baseline=baselineData();
 const collectedFixture=readFileSync(new URL('fixture-collected.mjs',out)),collector=readFileSync(new URL('collector-used.mjs',out));
 const archived=(await import(`data:text/javascript,${encodeURIComponent(collectedFixture.toString())}`)).VALIDATION_CASES;
 assert.deepEqual(archived.map(r=>[r.id,r.smiles,r.constitutionId,r.referenceEnglish]),VALIDATION_CASES.map(r=>[r.id,r.smiles,r.constitutionId,r.referenceEnglish]));
 const batchReceipts=[],raw=[];
 for(let i=1;i<=6;i++){const file=new URL(`batches/batch-${i}.json`,out),r=read(new URL(`batches/batch-${i}.receipt.json`,out));
  assert.equal(r.status,'COMPLETE');assert.equal(r.productionHash,productionHash);assert.equal(r.bodySha256,digest(readFileSync(file)));assert.equal(r.fixtureHash,digest(collectedFixture));assert.equal(r.collectorHash,digest(collector));
  batchReceipts.push(r);raw.push(...read(file).records);}
 const supplementPath=new URL('editor-equivalent.json',out),supplement=existsSync(supplementPath)?read(supplementPath).records:[],supplementReceipt=existsSync(supplementPath)?read(new URL('editor-equivalent.receipt.json',out)):null;
 if(supplementReceipt){assert.equal(supplementReceipt.productionHash,productionHash);assert.equal(supplementReceipt.bodySha256,digest(readFileSync(supplementPath)));}
 const records=VALIDATION_CASES.map(row=>{
  const original=raw.find(r=>r.id===row.id),r=supplement.find(r=>r.id===row.id)??original;
  const ref=receipt(row.referenceEnglish);assert.equal(ref.sha256,row.referenceSha256);const g=cmlGraph(JSON.parse(ref.body).cml);assert.ok(g.valence.every(a=>a.valid),row.id);assert.equal(normalizeFormula(g.formula),normalizeFormula(row.formula));
  const variants=r.variants.filter(v=>v.graph).map(v=>({label:v.label,sourceSmiles:v.sourceSmiles,exported:v.exported,
   graphProof:plainMapping(graphMapping(g,v.graph)),exportIdentity:v.exported?.ok?{constitution:identity(v.exported.smiles)===identity(row.smiles),stereo:identity(v.exported.smiles,true)===identity(row.smiles,true)}:null,
   profiles:Object.fromEntries(PROFILES.map(p=>[p,assess(row,p,v,g)]))}));
  const profiles=variants[0]?.profiles??Object.fromEntries(PROFILES.map(p=>[p,{name:null,available:false,classification:'UNSUPPORTED',severity:null,issues:[],expected:row.expected[p],evidence:{importRejection:original.importError},coverage:{kind:'intentional-documented-exclusion',detail:original.importError,regression:'Not established'},reasoning:{status:'NOT-APPLICABLE'}}]));
  // Variant diagnostics may expose a real defect without adding observations.
  for(const p of PROFILES){const base=profiles[p];for(const v of variants.slice(1))for(const i of v.profiles[p].issues){if(!base.issues.some(b=>b.code===i.code))base.issues.push({...i,variant:v.label});}
   if(variants.some(v=>v.graphProof.status==='FAIL-STRUCTURE'))base.issues.push(issue('VARIANT-GRAPH','FAIL-STRUCTURE','P0','Equivalent serialization changed constitution'));
   if(variants.some(v=>v.exportIdentity?.constitution===false))base.issues.push(issue('EXPORT-GRAPH','FAIL-STRUCTURE','P0','Production SMILES export changed constitution'));
   if(variants.some(v=>v.exportIdentity?.stereo===false))base.issues.push(issue('EXPORT-STEREO','FAIL-NAME','P1','Production SMILES export lost or changed specified stereochemistry'));
   base.classification=classify(base.issues,base.available,base.classification==='PASS');base.severity=base.issues.length?base.issues.map(i=>i.severity).sort()[0]:null;
  }
  return{...row,referenceGraph:{formula:g.formula,elements:[...new Set(g.atoms.map(a=>a.element))].sort(),atoms:g.atoms.length,bonds:g.bonds.length,
   bondOrders:Object.fromEntries([1,2,3,1.5].map(o=>[o,g.kekuleBonds.filter(b=>b[2]===o).length])),cycleRank:g.cycleRank,components:g.components.length,groups:g.groups,groupCounts:g.groupCounts,
   stereocentres:g.atoms.filter(a=>a.cmlStereo).map(a=>({atomId:a.id,parity:a.cmlStereo})),valence:'PASS'},
   imported:original.imported,importError:original.importError,inputRoute:r.primaryInputRoute??'production SMILES importer',replayGraph:r.variants[0]?.graph??null,profiles,
   variants:variants.map(v=>({...v,profiles:Object.fromEntries(PROFILES.map(p=>{const a=v.profiles[p];return[p,{name:a.name,available:a.available,classification:a.classification,severity:a.severity,issues:a.issues,evidence:{name:a.evidence.name,graphStatus:a.evidence.graph.status,parentStatus:a.evidence.parentOracle.status,groupsStatus:a.evidence.groups.status,reasoningIntegrity:a.evidence.reasoningIntegrity},reasoningHash:digest(JSON.stringify(a.reasoning.model)),reasoningStatus:a.reasoning.status}];}))})),
   rejectedVariants:r.variants.filter(v=>!v.graph).map(v=>({label:v.label,importError:v.importError,sourceSmiles:v.sourceSmiles}))};
 });
 const observations=records.flatMap(r=>PROFILES.map(p=>r.profiles[p]));
 const matrix={schema:'orgorush-validation-014/v1',baseline:BASELINE,sources:SOURCES,scope:{constitutions:150,primaryObservations:450,complementary2013English:150,totalObservations:600,projection:'2013-en is a language projection, not a fourth independent engine',variants:'Nested diagnostics, never additional base observations'},
  counts:count(observations),byProfile:Object.fromEntries(PROFILES.map(p=>[p,count(records.map(r=>r.profiles[p]))])),byCategory:Object.fromEntries(Object.keys(TARGETS).map(c=>[c,Object.fromEntries(PROFILES.map(p=>[p,count(records.filter(r=>r.category===c).map(r=>r.profiles[p]))]))])),records,roundtrips:existsSync(new URL('roundtrips.json',out))?read(new URL('roundtrips.json',out)):null,
  execution:{productionHash,protectedFiles:baseline.files.length,fixtureHash:digest(readFileSync(new URL('tests/fixtures/orgorush-validation-014.mjs',root))),referenceRevision:read(new URL('reference-revision.json',out)),batchReceipts,supplementReceipt,tools:{node:baseline.node,npm:baseline.npm,...baseline.tools}}};
 save(new URL('reports/orgorush-validation-014.matrix.json',root),matrix);await verifyMatrix();console.log(JSON.stringify({counts:matrix.counts,byProfile:matrix.byProfile}));return matrix;
}
export async function verifyMatrix(matrix=read(new URL('reports/orgorush-validation-014.matrix.json',root))){
 assert.equal(matrix.records.length,150);assert.equal(new Set(matrix.records.map(r=>r.id)).size,150);assert.equal(new Set(matrix.records.map(r=>identity(r.smiles))).size,150);
 const historicalData=baselineData().historical;
 const historical=new Set(historicalData.identities.map(i=>typeof i==='string'?i:i.id));
 for(const [category,n]of Object.entries(TARGETS))assert.equal(matrix.records.filter(r=>r.category===category).length,n);
 let total=0;for(const r of matrix.records){assert.ok(!historical.has(identity(r.smiles)),`Historical duplicate ${r.id}`);assert.equal(r.constitutionId,identity(r.smiles));assert.deepEqual(Object.keys(r.profiles),PROFILES);assert.equal(receipt(r.referenceEnglish).sha256,r.referenceSha256);assert.equal(witness(r.referenceEnglish,r.smiles).status,'PASS');
  for(const p of PROFILES){total++;const v=r.profiles[p];assert.ok(STATUSES.includes(v.classification));assert.ok(Array.isArray(v.issues));if(v.classification==='PASS'){
   assert.equal(v.available,true);assert.equal(v.issues.length,0);assert.equal(v.evidence.name.status,'PASS');assert.equal(v.evidence.graph.status,'PASS');assert.equal(v.evidence.normativeExactMatch,true);assert.equal(v.evidence.groups.status,'PASS');assert.equal(v.evidence.reasoningIntegrity.status,'PASS');
  }}
 }assert.equal(total,600);assert.deepEqual(matrix.counts,count(matrix.records.flatMap(r=>Object.values(r.profiles))));
 protect();return{structures:150,observations:600,protected:true};
}

/** Offline scientific replay of the 600 captured base observations. This does
 * not rerun the production engine or turn a captured output into its oracle. */
export async function replayMatrix(){
 const matrix=read(new URL('reports/orgorush-validation-014.matrix.json',root));await verifyMatrix(matrix);let checked=0;
 for(const row of matrix.records){
  if(!row.replayGraph){for(const p of PROFILES){assert.equal(row.profiles[p].classification,'UNSUPPORTED');checked++;}continue;}
  const profiles=Object.fromEntries(PROFILES.map(p=>{const v=row.profiles[p];return[p,{name:v.name,analysis:v.analysis,reasoning:v.reasoning.model,reasoningIntegrity:v.evidence.reasoningIntegrity}];}));
  const graph=cmlGraph(JSON.parse(receipt(row.referenceEnglish).body).cml);
  for(const p of PROFILES){const actual=assess(row,p,{graph:row.replayGraph,profiles},graph);assert.equal(actual.classification,row.profiles[p].classification,`${row.id}/${p}`);checked++;}
 }
 assert.equal(checked,600);return{baseObservationsReplayed:checked,engineRerun:false};
}

function reductionEvidence(r){return{id:r.id,smiles:r.smiles,referenceEnglish:r.referenceEnglish,reference:witness(r.referenceEnglish,r.smiles),
 names:Object.fromEntries(PROFILES.map(p=>[p,r.profiles?.[p]?.name??null])),
 englishProofs:Object.fromEntries(['2013-en','1979-en'].map(p=>[p,r.profiles?.[p]?.name?witness(r.profiles[p].name,r.smiles):null])),
 reasoning:Object.fromEntries(PROFILES.map(p=>[p,{integrity:r.profiles?.[p]?.reasoningIntegrity??null,hash:r.profiles?.[p]?.reasoning?digest(JSON.stringify(r.profiles[p].reasoning)):null}]))};}
export async function writeReport(){
 const matrix=read(new URL('reports/orgorush-validation-014.matrix.json',root));await verifyMatrix(matrix);
 const reductions=read(new URL('reductions.json',out)).records.map(reductionEvidence),get=id=>reductions.find(r=>r.id===id);
 for(const r of reductions)assert.equal(r.reference.status,'PASS',`Unverified reduction reference ${r.id}`);
 const definitions=[
  {id:'V014-D01',severity:'P0',category:'mixed',title:'Metilideno funcional nombrado como metil',caseId:'V014-125',code:'SATURATED-BRANCH',
   minimal:get('D1-min'),controls:[get('D1-control'),get('D1-shorter')],
   criterion:'El enlace C=CH2 lateral debe conservarse: 3-methylidenepentan-2-one, no 3-methylpentan-2-one. OPSIN confirma constituciones y fórmulas diferentes.',
   difference:'Se pierde un doble enlace; C6H10O se convierte semánticamente en C6H12O. En el caso base: C8H14O2 frente a C8H16O2.',
   references:[{url:SOURCES.modernHydrocarbons.url,sections:'P-29.2, P-29.3.1: CH2= methylidene'},SOURCES.modernFunctions],
    functions:[{path:'app/page.tsx',name:'nameSubstituent',line:1883},{path:'app/page.tsx',name:'analyzeFunctionalAcyclic',line:3529}],
   rootCause:'La rama funcional llama nameSubstituent con bondOrders y preferSystematicUnsaturatedPrefix, pero omite attachmentOrder; su valor por defecto 1 impide el caso methylidene. Lectura de código y reducción concuerdan.',
   confidence:'confirmed',impact:'Otros grupos funcionales con =CH2 lateral pueden compartir el mismo llamador. No se cuantifica su prevalencia fuera del corpus.'},
  {id:'V014-D02',severity:'P1',category:'unsaturated',title:'Radical dienilo pierde el multiplicador y el inglés conserva -il',caseId:'V014-045',code:'RADICAL-MULTIPLICITY',
   minimal:get('D2-min'),controls:[get('D2-shorter'),get('D2-control')],
   criterion:'Dos dobles enlaces de un radical requieren dien; 6-(buta-1,3-dien-1-yl)undecane en inglés. «but-1,3-en-1-il» no es una construcción correcta.',
   difference:'Localizadores 1,3 con morfema singular en y ausencia de la vocal/multiplicador de buta...dien; proyección inglesa sin traducir il. El fallo de OPSIN es evidencia auxiliar, no la prueba normativa por sí solo.',
   references:[{url:'https://iupac.qmul.ac.uk/BlueBook/P3.html',sections:'P-31.1 unsaturation multiplicative prefixes',consultedDate:'2026-10-25'},SOURCES.modernHydrocarbons,{...SOURCES.historicalUnsaturation,sections:'A-3.5 (corroboración del radical dienyl, no selección del padre 2013)'}],
   functions:[{path:'app/page.tsx',name:'makeUnsaturatedSubstituentName',line:1965},{path:'app/iupac-name-normalization.ts',name:'spanishNumberedUnsaturatedSubstituent',line:25}],
   rootCause:'makeUnsaturatedSubstituentName concatena todas las posiciones con en/in singular; el traductor de radicales numerados solo reconoce un localizador. Ambas limitaciones son visibles en el código.',
   confidence:'confirmed',impact:'Radicales laterales con múltiples dobles o triples enlaces; la extrapolación a triples no se cuenta como reproducción confirmada.'},
  {id:'V014-D03',severity:'P2',category:'cyclic',title:'Proyección inglesa de tiofeno sustituido usa raíz española y localizador de alqueno',caseId:'V014-059',code:'HETEROCYCLE-EN',
   minimal:get('D3-min'),controls:[get('D3-unsubstituted'),get('D3-control')],
   criterion:'El padre inglés retenido es thiophene; 2-methylthiophene. La salida methyltiof-2-ene no conserva esa construcción.',
   difference:'El localizador 2 del metilo se desplaza al sufijo ene y tiof no se traduce. No se afirma que OPSIN pruebe qué otra molécula representa una cadena que no interpreta.',
   references:[{url:SOURCES.modernHydrocarbons.url,sections:'P-22.2.2, Table 2.2: thiophene',consultedDate:'2026-10-25'},SOURCES.spanishLexicon],
   functions:[{path:'app/iupac-name-normalization.ts',name:'normalizeTraditionalUnsaturationNotation',line:261},{path:'app/iupac-name-normalization.ts',name:'heterocycleTranslations / translateCore',line:92}],
   rootCause:'Probable interacción entre normalización de sufijos eno y traducción de heterociclos por nombres completos. La reproducción confirma el síntoma; no se ha aislado una única función como causa suficiente.',
   confidence:'symptom-confirmed; root-cause-probable',impact:'Otros heterociclos sustituidos sin entrada específica en la proyección inglesa requieren auditoría dirigida.'},
 ];
 for(const d of definitions){d.affectedObservations=matrix.records.flatMap(r=>PROFILES.filter(p=>r.id===d.caseId&&r.profiles[p].issues.some(i=>i.code===d.code||(d.id==='V014-D01'&&i.code==='WRONG-MOLECULE'))).map(p=>({caseId:r.id,profile:p,observed:r.profiles[p].name,expected:r.expected[p],classification:r.profiles[p].classification})));
  d.reproduction=['node scripts/validation-014-audit.mjs --reproduce',`Buscar ${d.id} y comparar los perfiles y las identidades en reports/orgorush-validation-014.defects.json`];
  d.reductionScope='Mínimo encontrado mediante las eliminaciones documentadas; no se afirma minimalidad matemática global.';
  d.incidenceIds=d.affectedObservations.map(o=>`${o.caseId}/${o.profile}/${d.id}`);
 }
 const defects={schema:'orgorush-validation-014-defects/v1',failedObservations:matrix.records.flatMap(r=>Object.values(r.profiles)).filter(p=>p.classification.startsWith('FAIL')).length,
  affectedConstitutions:matrix.records.filter(r=>Object.values(r.profiles).some(p=>p.classification.startsWith('FAIL'))).length,
  probableRootCauseGroups:definitions.length,confirmedRootCauses:2,probableRootCauses:1,definitions,additionalControls:reductions};
 save(new URL('reports/orgorush-validation-014.defects.json',root),defects);
 // Stable issue identifiers live on all observations, including nested variants.
 for(const row of matrix.records)for(const p of PROFILES){const v=row.profiles[p];v.incidenceIds=definitions.filter(d=>d.affectedObservations.some(o=>o.caseId===row.id&&o.profile===p)).map(d=>`${row.id}/${p}/${d.id}`);
  v.nomenclatureDimensions={connectivity:v.evidence.name?.status??'NOT-APPLICABLE',nameValidity:v.available?(v.evidence.normativeExactMatch?'rule-derived reference match':'individual adjudication or pending'):'NOT-APPLICABLE',preferredName:'Separate from connectivity; no universal PIN certificate',historicalConvention:p.startsWith('1979')?(v.evidence.normativeExactMatch?'reviewed frozen 1979 construction':'pending or unavailable'):'NOT-APPLICABLE',localization:p.endsWith('-es')?'RSEQ lexicon plus applicable edition rules':'English reference or explicit projection'};
 }
 const controls=existsSync(new URL('controls.json',out))?read(new URL('controls.json',out)):[],complete=existsSync(new URL('suite-completion.json',out))?read(new URL('suite-completion.json',out)):null;
 const suite=controls.filter(c=>c.stage.startsWith('per-file/')),suiteCounts={tests:0,pass:0,fail:0,cancelled:0,skipped:0,todo:0};
 for(const c of suite){const log=readFileSync(new URL(c.stage+'.log',out),'utf8');for(const [,k,n]of log.matchAll(/^ℹ (tests|pass|fail|cancelled|skipped|todo) (\d+)/gm))suiteCounts[k]+=Number(n);}
 matrix.execution.technicalControls={controls,suite:{status:complete?'COMPLETE':'IN-PROGRESS',expectedFiles:173,completedFiles:suite.length,counts:suiteCounts,completion:complete}};
 const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n');
 const byProfile=table(['Perfil',...STATUSES],PROFILES.map(p=>[p,...STATUSES.map(s=>matrix.byProfile[p][s])]));
 const category=table(['Familia','Constituciones','Perfil',...STATUSES],Object.entries(TARGETS).flatMap(([c,n])=>PROFILES.map(p=>[c,n,p,...STATUSES.map(s=>matrix.byCategory[c][p][s])])));
 const pending=matrix.records.flatMap(r=>PROFILES.filter(p=>r.profiles[p].classification==='PENDING-REFERENCE').map(p=>[r.id,p,r.profiles[p].name??'—']));
 const unsupported=matrix.records.filter(r=>Object.values(r.profiles).some(p=>p.classification==='UNSUPPORTED'));
 const primary=count(matrix.records.flatMap(r=>PROFILES.slice(0,3).map(p=>r.profiles[p])));
 const variants=matrix.records.flatMap(r=>r.variants),rt=matrix.roundtrips.records;
 const technical=table(['Control','Resultado','Duración ms'],controls.filter(c=>!c.stage.startsWith('per-file/')).map(c=>[c.stage,c.exitCode===0?'PASS':`EXIT ${c.exitCode}`,c.durationMs]));
 const sources=Object.entries(SOURCES).map(([k,s])=>`- **${k}**: [${s.sections}](${s.url}); consulta ${s.consultedDate}. ${s.use}`).join('\n');
 const markdown=`# ORGORUSH-VALIDATION-014 — auditoría independiente\n\n## A. Resumen ejecutivo\n\nBaseline: \`${BASELINE}\`, rama main. Auditoría aditiva: los ${matrix.execution.protectedFiles} archivos originales conservan su SHA-256. Sin cambios de producción, dependencias o fixtures históricos; sin commit ni push.\n\n150 constituciones nuevas, ocho cuotas exactas. 450 observaciones principales y 150 controles complementarios 2013 EN: **600**. Las variantes son diagnósticos anidados. Resultado: **${Object.entries(matrix.counts).map(([s,n])=>`${n} ${s}`).join('; ')}**. Hay **${defects.failedObservations} observaciones fallidas, ${defects.affectedConstitutions} constituciones afectadas y ${definitions.length} grupos de causa** (dos causas confirmadas y una probable). Se encontraron tres defectos; no se inventan otros dos para completar una lista de cinco.\n\n${byProfile}\n\nLas 450 principales: ${Object.entries(primary).map(([s,n])=>`${s} ${n}`).join('; ')}. El inglés 2013 es una proyección lingüística del análisis actual, no un cuarto motor independiente.\n\n## B. Metodología e independencia\n\nSe propusieron 203 nombres externos antes de consultar producción; se seleccionaron los primeros válidos y nuevos por cuota. 15 candidatos anteriores al cierre se descartaron por identidad histórica o duplicada. Se compararon identidades constitucionales canónicas sin estereoquímica ni isótopos frente a 1337 identidades históricas obtenidas de 390 fuentes locales, JSON, fixtures y recibos. Ninguna estructura se sustituyó por fallar OrgoRush. Los diez casos estereoquímicos también tienen constituciones diferentes.\n\nOPSIN interpreta nombres de referencia y nombres ingleses observados. Se conservan ${read(frozenPath).responses.length} recibos crudos, URL, estado HTTP, cuerpo, fecha y SHA-256 en el nuevo fixture .opsin.json. La selección tiene 150 interpretaciones SUCCESS. La versión del servicio no fue suministrada; no se inventa. Una respuesta 404/WARNING no demuestra por sí sola un nombre químicamente erróneo. No se empleó PubChem ni se afirma corroboración suya.\n\nEl lector CML independiente reconstruye átomos, órdenes, cargas, fórmula con hidrógenos explícitos, grupos y rango ciclomático. Se comprueban valencias y correspondencia por isomorfismo acotado a 50000 visitas. OpenChemLib 9.25.0 aporta una segunda representación estructural; también lo usa producción, por lo que su concordancia no se trata como independencia algorítmica absoluta. La enumeración acíclica de padres procede del oráculo independiente anterior, sin reutilizar el selector del motor; conserva sus límites de desempate alfabético y grupos complejos.\n\nLas expectativas 2013 y 1979 son aplicaciones derivadas de reglas, no ejemplos supuestamente impresos en las fuentes. OPSIN no certifica preferencia normativa. Se separan conectividad, validez, preferencia, convención y lengua. Los nombres equivalentes no preferidos no se clasifican P0/P1. Las alternativas sin revisión completa quedan pendientes. Una coincidencia española exige la referencia léxica y el nombre inglés externo correspondiente, además de las comprobaciones del grafo, padre y explicación.\n\nSe preservaron las capturas originales en seis lotes de 25, con 100 observaciones por lote. El fixture inicialmente capturado tiene hash \`${matrix.execution.referenceRevision.rawFixtureSha256}\`; el definitivo \`${matrix.execution.fixtureHash}\`. Una corrección del arnés de referencia sobre la API addBond/setBondType de OCL obligó a revisar metadatos aromáticos: los 150 IDs, SMILES, identidades, referencias inglesas y fórmulas permanecieron idénticos. Se archivaron productor y fixture originales y se verificó la revisión, sin repetir ni alterar resultados del motor. También se corrigieron criterios del auditor que confundían las letras de fusión con índices consecutivos, el ancla O-alquilo de un éster y los halógenos prefijos con grupos de sufijo. La envoltura del resultado exportado se desempaqueta antes de comparar su SMILES. Ninguna de estas correcciones modifica producción.\n\n17 SMILES válidos fueron rechazados al importar. Para 12 grafos neutros de elementos editables se añadió una ruta directa CML → grafo ordinario del API de edición. Esta ruta **no simula una importación exitosa ni una prueba de clics de UI**. Los cinco restantes, con cargas o P/B, mantienen rechazo explícito. No se fuerza disponibilidad de nombres.\n\n## C. Cobertura\n\n${category}\n\nCada perfil aparece exactamente 150 veces. La matriz enumera átomos/enlaces pesados, conteos de órdenes Kekulé, elementos, fórmula, componentes, grupos, rango ciclomático y paridades CML. El rango ciclomático no pretende ser una lista única de todos los ciclos posibles de un policiclo.\n\n## D. Resultados, exclusiones y pendientes\n\nSe conservan todas las incidencias y se elige la clasificación principal en orden estructura → nombre → razonamiento. Un rechazo seguro no es PASS. Las excepciones de ejecución sobre grafos válidos se distinguen de la exclusión deliberada. No se encontró una excepción de análisis que se haya reclasificado como rechazo seguro.\n\n${unsupported.length} constituciones tienen al menos un perfil UNSUPPORTED (${matrix.counts.UNSUPPORTED} observaciones). Los 15 casos limits son válidos y quedan rechazados en los cuatro perfiles: purina/quinolina, benzofurano/indol, adamantano y cubano sustituidos, sales y amonio, funciones S/P/B. Es una medida de cobertura, sin evidencia para llamarla regresión de disponibilidad en estructuras nuevas. El importador documenta sus barreras de carga y elementos en app/openchemlib-adapter.ts:217–243 y de policiclos en :335–346; las exclusiones particulares de nomenclatura se guardan literalmente en la matriz. Los rechazos regulares se etiquetan como oportunidad de cobertura futura; no se les atribuye una intención histórica no documentada.\n\nLegacy ES tiene 53 rechazos, frente a 23 de Legacy EN y 22 de cada perfil 2013. Ejemplos: ésteres/amidas/nitrilos funcionalizados pueden tener nombre inglés Legacy verificable y resolución española no disponible. V014-125 queda rechazado en Legacy pero produce el nombre incorrecto en 2013: el rechazo de un perfil no oculta ese fallo del otro.\n\n**${matrix.counts['PENDING-REFERENCE']} observaciones pendientes**, de ${new Set(pending.map(r=>r[0])).size} constituciones. Incluyen radicales ramificados con nombres equivalentes no preferidos, construcciones históricas cíclicas, diferencias de orden léxico español y formas alternativas de amida/nitrilo. El generador léxico del fixture no es un traductor normativo completo: por ejemplo, el orden inglés methoxy/methyl no determina el español metil/metoxi. Esas discrepancias no prueban un defecto. En V014-028 la unión vocálica española del metilideno requiere revisión específica.\n\n${table(['Caso','Perfil','Nombre pendiente'],pending)}\n\n## E. Análisis normativo\n\n2013 conserva la longitud del padre antes de maximizar enlaces múltiples dentro del alcance aplicable P-44; 1979 A-3/C-13 selecciona primero las insaturaciones después de la función principal. V014-045 ilustra una diferencia legítima: el padre actual tetradecano conserva el radical butadienilo, mientras que Legacy usa 5-pentyl-1,3-tridecadiene. El error actual es la construcción del radical, no que ambos perfiles usen padres distintos.\n\nV014-125 muestra un alcance que UNSATURATION-013 no cubrió: una rama =CH2 con función prioritaria. El nombre inglés observado representa otra constitución según OPSIN; P-29 distingue methyl (CH3–) de methylidene (CH2=). La reducción D1 confirma el fallo y los controles saturado y de un carbono menos no lo presentan.\n\nLos radicales históricos 1-methylethyl y similares no se sustituyen automáticamente por la preferencia de 2013. La RSEQ se usa para terminología española, sin imponer reglas actuales al perfil 1979. Las referencias no resueltas siguen explícitas.\n\n## F. «Cómo se obtiene» e invariancias\n\nSe usaron buildActiveIupacReasoning, sus fragmentos y enlaces reales. Se comprobó integridad, existencia de pasos/átomos/enlaces, reconstrucción del texto, numeración acíclica, correspondencia de grupos funcionales y ausencia de mutación. El isomorfismo vincula los IDs reales a los átomos CML; el oráculo comprueba la composición del padre cuando es aplicable. Las revisiones no certifican automáticamente cada frase pedagógica ni la minimalidad de todos los padres cíclicos.\n\nResultado principal: **0 FAIL-REASONING independientes**. Esto no absuelve las explicaciones de los nombres incorrectos: D1 conserva además una explicación y un resaltado de «metil» para una rama =CH2. Se registra bajo su defecto químico prioritario y no se cuenta dos veces como causa nueva.\n\n${variants.length} variantes con grafo: almacenamiento original, IDs/orden invertidos, reflexión visual y SMILES equivalente con mapas. Hay ${matrix.records.flatMap(r=>r.rejectedVariants).length} variantes alternativas rechazadas por el importador. Sus diagnósticos no aumentan las 600 observaciones. Los 568 SMILES exportados preservan constitución y configuración; 532 se reimportan y pasan la correspondencia independiente, y 36 exportaciones de los grafos CML siguen rechazadas por la barrera de policiclos. Las diez constituciones estereoquímicas y sus variantes conservan el estado especificado; se comparó identidad isomérica con OPSIN, sin confundir reflexión visual con inversión química.\n\n## G. Defectos y reproducciones\n\n${definitions.map(d=>`### ${d.id} — ${d.severity}: ${d.title}\n\nCaso ${d.caseId}. ${d.criterion}\n\nSMILES reducido: \`${d.minimal.smiles}\`. Salidas: ${PROFILES.filter(p=>d.minimal.names[p]).map(p=>`${p}: **${d.minimal.names[p]}**`).join('; ')}. ${d.difference}\n\n${d.rootCause} Confianza: ${d.confidence}. Controles: ${d.controls.map(c=>`${c.id} (\`${c.smiles}\`)`).join(', ')}. La reducción es el mínimo encontrado; no una demostración exhaustiva. ${d.impact}\n\nReferencias: ${d.references.filter(Boolean).map(s=>`[${s.sections}](${s.url})`).join(', ')}.\n`).join('\n')}\n\nReproducir: \`node scripts/validation-014-audit.mjs --reproduce\`. Los controles adicionales no completan cuotas ni cuentan como nuevas observaciones del corpus. El JSON de defectos conserva las salidas de todos los perfiles, recibos externos, controles, funciones posiblemente implicadas e IDs de incidencias.\n\n## H. Regresiones históricas\n\nSe ejecutó de nuevo VALIDATION-008 en un archivo de outputs separado, sin sobrescribir su ledger. Su modo strict-backed y el comparador UNSATURATION-013, que encadena POLYENES-011/FIX-009, conservaron **198 PASS, 16 UNSUPPORTED y 2 PENDING-REFERENCE**. El comparador también verifica los dos cambios de fixture autorizados por 013 y la identidad del JavaScript protegido de QUALITY-010. LOCALIZATION-012 y los demás tests históricos están incluidos en la pasada general por archivos. No se exige igualdad literal con el motor anterior a las correcciones 011/013.\n\n## I. Validación técnica y trazabilidad\n\n${technical}\n\nSuite general: **${complete?'COMPLETE':'EN CURSO'}**, ${suite.length}/173 archivos, ejecutados individualmente con \`node --test --test-concurrency=1 tests/<archivo>\`; agregado: ${JSON.stringify(suiteCounts)}. No se presenta como una ejecución única de npm test. Una sola pasada general; las pruebas dirigidas del nuevo auditor se ejecutaron durante su desarrollo y no se suman de nuevo al agregado. No se aumentaron timeouts. Las cinco omisiones históricas deben contrastarse por nombre al cerrar la pasada.\n\nHerramientas: ${Object.entries(matrix.execution.tools).map(([k,v])=>`${k} ${v}`).join('; ')}. Hash de los ${matrix.execution.protectedFiles} archivos protegidos: \`${matrix.execution.productionHash}\`. El hash final del fixture es \`${matrix.execution.fixtureHash}\`. Cada recibo de lote contiene su hash de cuerpo, productor, fixture, IDs, duración y estado COMPLETE. Los seis lotes y el suplemento se verifican antes de adjudicar; las fechas de ejecución quedan fuera de los resultados químicos comparables.\n\nArchivos permanentes nuevos: scripts/validation-014-audit.mjs; scripts/validation-014-reference.mjs; tests/fixtures/orgorush-validation-014.mjs; tests/fixtures/orgorush-validation-014.opsin.json; tests/orgorush-validation-014.test.mjs; reports/orgorush-validation-014.md; reports/orgorush-validation-014.matrix.json; reports/orgorush-validation-014.defects.json. Los logs/capturas temporales están en outputs/validation-014/.\n\nComandos: \`--collect\` recoge seis lotes con reanudación estricta de hashes; \`--roundtrip\` verifica exportación/reimportación; \`--adjudicate\` contrasta las capturas con referencias; \`--verify\` verifica cuotas, novedad, fuentes, evidencia PASS e integridad de originales; \`--report\` escribe informe y defectos. Las referencias externas están congeladas para verificación offline. Recoger y adjudicar de cero requiere primero el baseline de protección y las capturas originales descritas en los manifiestos; --verify y los tests del auditor usan el baseline congelado en el fixture cuando no existen outputs.\n\n## J. Propuesta FIX-015\n\n1. **D01, P0:** transmitir/comprobar el orden del enlace de unión en la ruta funcional. Añadir reproducción reducida, variante con función secundaria y control saturado. Verificar identidad del nombre completo en todos los perfiles; no ampliar la nomenclatura Legacy por accidente.\n2. **D02, P1:** construir multiplicadores/vocales de radicales poliinsaturados y traducir sus localizadores completos. Mantener el padre 2013 y la selección histórica; controlar dobles/triples mixtos y el radical monoinsaturado que ya funciona.\n3. **D03, P2:** reconocer el padre heterocíclico antes de normalizar sufijos y conservar el localizador del sustituyente al proyectar al inglés. Comparar tiofeno sin sustitución y piridina sustituida.\n4. **Referencias:** revisar las 32 observaciones pendientes por preferencia, sintaxis histórica y alfabeto español antes de convertirlas a PASS o defecto. Las diferencias equivalentes no justifican cambios químicos.\n5. **Cobertura posterior separada:** evaluar barreras de policiclos, carga, S/P/B y disponibilidad Legacy ES con referencias propias. No presentar esa ampliación como reparación de los cinco nombres fallidos.\n\nNinguna de estas correcciones se aplica en 014.\n\n### Fuentes consultadas\n\n${sources}\n- **Multiplicidad adicional**: [P-31.1](https://iupac.qmul.ac.uk/BlueBook/P3.html), consulta 2026-10-25.\n- **Identidad externa**: [OPSIN](https://www.ebi.ac.uk/opsin/), recibos individuales completos en el fixture; sirve para nombre → estructura, no para certificar PIN.\n`;
 const closurePath=new URL('final-summary.json',out),closure=existsSync(closurePath)?read(closurePath):null;
 if(closure)matrix.execution.finalVerification=closure;
 save(new URL('reports/orgorush-validation-014.matrix.json',root),matrix);
 const appendix=closure?`\n### Cierre verificable de ejecución\n\n${closure.completedFiles} archivos completados en la pasada general: ${JSON.stringify(closure.counts)}. Los nombres de las ${closure.skipNames.length} omisiones coinciden con la pasada histórica: ${closure.skipNames.join('; ')}.\n\nEl test nuevo 014 se ajustó durante la pasada general. Se ejecutó de nuevo únicamente ese archivo tras cerrar el arnés: ${JSON.stringify(closure.finalDiagnosticTest.counts)}, exit ${closure.finalDiagnosticTest.exitCode}. Esa ejecución dirigida no se suma otra vez a los totales de la pasada. Los archivos originales permanecen idénticos al baseline; no se afirma que los diagnósticos nuevos fueran inmutables durante todo su desarrollo.\n\nLas funciones capture y makeVariants coinciden por hash con el productor archivado de los seis lotes. Se reprodujeron las nueve capturas reducidas y los 600 veredictos base pueden repetirse offline con \`node scripts/validation-014-audit.mjs --replay\`. Este último comando adjudica observaciones guardadas; no vuelve a ejecutar el motor.\n`:'';
 writeFileSync(new URL('reports/orgorush-validation-014.md',root),markdown+appendix);protect();console.log(JSON.stringify({report:'written',counts:matrix.counts,defects:definitions.length,suiteCompleted:suite.length}));
 return defects;
}
