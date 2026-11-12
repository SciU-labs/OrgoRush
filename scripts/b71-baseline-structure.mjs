import {readFileSync,writeFileSync} from 'node:fs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
const baseline=JSON.parse(readFileSync('reports/b71/baseline.json','utf8'));
const rows=[];
for(const item of baseline.rows){
  const p=moleculeFromSmiles(item.smiles);if(!p.ok){rows.push({id:item.id,error:p.error});continue;}
  const g=p.molecule, atoms=new Map(g.atoms.map(a=>[a.id,a]));
  const carbonyl=g.bonds.find(([a,b,o])=>o===2&&((atoms.get(a)?.element==='O'&&(atoms.get(b)?.element??'C')==='C')||(atoms.get(b)?.element==='O'&&(atoms.get(a)?.element??'C')==='C')));
  const carbon=carbonyl?.find(id=>(atoms.get(id)?.element??'C')==='C');
  const nBond=g.bonds.find(([a,b,o=1])=>o===1&&(a===carbon&&atoms.get(b)?.element==='N'||b===carbon&&atoms.get(a)?.element==='N'));
  const nitrogen=nBond?.find(id=>atoms.get(id)?.element==='N');
  rows.push({id:item.id,carbonyl:carbonyl??null,nitrogen:nitrogen??null,
    nBonds:g.bonds.filter(([a,b])=>a===nitrogen||b===nitrogen),ringAtoms:g.rings?.filter(r=>r.kind==='aromatic').map(r=>r.atomIds)});
}
writeFileSync('reports/b71/baseline-structure.json',JSON.stringify({note:'Direct graph adjacency of original frozen SMILES, not a naming proof',rows},null,2)+'\n',{flag:'wx'});
console.log(`Captured baseline graph adjacency for ${rows.length} records.`);
