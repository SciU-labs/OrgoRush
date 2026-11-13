import {readFileSync,writeFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
const matrix=JSON.parse(readFileSync('reports/b741/stage-e-matrix.json','utf8')).rows;
const initial=JSON.parse(readFileSync('reports/b741/stage-e-partial-browser/results.json','utf8')).cases;
const retry=JSON.parse(readFileSync('reports/b741/stage-e-partial-retry/results.json','utf8')).cases;
const finalLabels=JSON.parse(readFileSync('reports/b741/stage-e-label-final/results.json','utf8')).cases;
const finalNotes=JSON.parse(readFileSync('reports/b741/stage-e-final-note/results.json','utf8')).cases;
const heteroFinal=JSON.parse(readFileSync('reports/b741/stage-e-hetero-final/results.json','utf8')).cases;
const key=([a,b])=>[a,b].sort((x,y)=>x-y).join(':');
const set=xs=>[...new Set(xs)].sort((a,b)=>a-b).join(',');
const report=[];
for(const first of initial){const row=heteroFinal.find(x=>x.family===first.family&&x.status==='PASS')??finalNotes.find(x=>x.family===first.family&&x.status==='PASS')??finalLabels.find(x=>x.family===first.family&&x.status==='PASS')??(first.status==='PASS'?first:retry.find(x=>x.family===first.family));if(!row||row.status!=='PASS')continue;
 const data=matrix.find(x=>x.family===row.family),graph=moleculeFromSmiles(data.smiles).molecule,parent=data.analysis.mainChain,groups=data.analysis.functionalGroups.filter(g=>g.kind===data.analysis.primaryFunctionalGroup);
 for(const lang of row.languages)for(const item of lang.checks){let expected=null,type=null,expectedBondsOverride=null;
  if(/Cadena principal|Anillo principal|Parent chain|Parent ring|Parent benzene ring/i.test(item.label)){type='parent';expected=parent;}
  else if(/Paso 1: Grupo funcional principal|Step 1: Principal functional group/i.test(item.label)&&groups.length){type='principal-group';expected=groups.flatMap(g=>g.atomIds);}
  else if(/Sufijo del grupo funcional|Principal functional group suffix|Posición y sufijo|locant and suffix|Ácido carboxílico/i.test(item.label)&&groups.length){type='functional-suffix';expected=groups.flatMap(g=>g.atomIds.filter(id=>g.kind!=='ester'||id!==g.alkylCarbonId));}
  else if(/Porción alquilo unida al oxígeno|O-bound alkyl portion/i.test(item.label)){
   const group=groups.find(g=>g.kind==='ester'&&g.alkylCarbonId!==undefined);
   const attachment=group&&graph.bonds.find(([a,b])=>(a===group.alkylCarbonId&&group.atomIds.includes(b)||b===group.alkylCarbonId&&group.atomIds.includes(a))&&
     (graph.atoms.find(atom=>atom.id===(a===group.alkylCarbonId?b:a))?.element==='O'));
   if(attachment){type='ester-alcohol';expected=attachment.slice(0,2);}
  }
  else if(/Paso 3: Numeración|Step 3: Numbering|Localizador(?:es)? (?:del|de)|Numeración razonada|\bNumbering\b|\blocants?\b/i.test(item.label)&&!/Paso 4|Step 4|: Sustituyente|: Prefijo funcional|: Substituents? and|: Functional prefix/i.test(item.label)){
   const locants=/^(?:Referencia estructural\. |Structural reference\. )?(\d+(?:,\d+)*)/.exec(item.label)?.[1]?.split(',').map(Number);
   const selected=locants??(groups.length?groups.flatMap(g=>g.carbonIds.map(id=>new Map(data.analysis.numberedAtoms).get(id)))
    :data.analysis.doubleBondLocants.length||data.analysis.tripleBondLocants.length?[...data.analysis.doubleBondLocants,...data.analysis.tripleBondLocants]
    :data.analysis.substituents.map(s=>s.locant));
   const hetero=graph.atoms.filter(atom=>parent.includes(atom.id)&&(atom.element??'C')!=='C');
   const aromaticHeterocycle=graph.rings?.some(r=>r.kind==='aromatic'&&r.atomIds.length===parent.length&&r.atomIds.every(id=>parent.includes(id)))
    && hetero.length===1 && new Map(data.analysis.numberedAtoms).get(hetero[0].id)===1 && !data.analysis.substituents.length;
   const found=aromaticHeterocycle?[hetero[0].id]:data.analysis.numberedAtoms.filter(([,number])=>selected.includes(number)).map(([id])=>id);
   if(found.length){type='numbering';expected=found;expectedBondsOverride=[];}
  }
  else if(/Paso 4: Sustituyentes|Step 4: Substituents|Sustituyente|Prefijo funcional|Substituent|Functional prefix/i.test(item.label)&&data.analysis.substituents.length){
   const tokens=item.label.toLowerCase(),all=/Paso 4:|Step 4:/i.test(item.label);
   const chosen=data.analysis.substituents.filter(s=>all||tokens.includes(s.sortName?.toLowerCase()??s.name.toLowerCase())
     ||s.name==='metil'&&tokens.includes('methyl')||s.name==='nitro'&&tokens.includes('nitro')
     ||s.name==='etoxi'&&tokens.includes('ethoxy')||s.name==='cloro'&&tokens.includes('chloro'));
   if(chosen.length){type='substituent';const atoms=new Set(),edges=new Set();
    for(const s of chosen){const members=new Set(s.atomIds);for(const id of members)atoms.add(id);
     for(const [a,b] of graph.bonds)if(members.has(a)&&members.has(b)||members.has(a)&&!parent.includes(a)&&parent.includes(b)||members.has(b)&&!parent.includes(b)&&parent.includes(a)){
      atoms.add(a);atoms.add(b);edges.add(key([a,b]));}}
    expected=[...atoms];expectedBondsOverride=[...edges].sort();}
  }
  else if(/Paso 7: Insaturaciones|Step 7: Name unsaturations|Enlace (?:doble|triple) en la posición|(?:Double|Triple) bond at position/i.test(item.label)){
   const multiple=graph.bonds.filter(([, ,order])=>order===2||order===3);
   if(multiple.length===1){type='single-unsaturation';expected=multiple[0].slice(0,2);}
  }
  if(!expected){report.push({family:row.family,language:lang.language,label:item.label,status:'NOT-ADJUDICATED'});continue;}
  const targetSet=new Set(expected),expectedBonds=expectedBondsOverride??graph.bonds.filter(([a,b])=>targetSet.has(a)&&targetSet.has(b)).map(key).sort();
  const actualBonds=item.bonds.map(key).sort();
  const status=set(item.atoms)===set(expected)&&JSON.stringify(actualBonds)===JSON.stringify(expectedBonds)?'EXACT':'DIFFERENT';
  report.push({family:row.family,language:lang.language,label:item.label,type,status,expectedAtoms:expected,expectedBonds,actualAtoms:item.atoms,actualBonds});
 }
}
const counts=Object.fromEntries(Object.entries(Object.groupBy(report,x=>x.status)).map(([k,v])=>[k,v.length]));
writeFileSync('reports/b741/stage-e-partial-semantics.json',JSON.stringify({scope:'Exact atom and bond sets compared with graph and local analysis evidence; not an independent nomenclature proof',counts,rows:report},null,2)+'\n');
console.log(JSON.stringify(counts));for(const r of report.filter(r=>r.status==='DIFFERENT'))console.log(JSON.stringify(r));
