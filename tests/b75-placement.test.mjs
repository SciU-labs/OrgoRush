import test from 'node:test';
import assert from 'node:assert/strict';
import { placeAttachmentTemplate } from '../app/manual-layout.ts';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { calculateMolecule2DLayout } from '../app/molecule-2d-layout.ts';
import { preserveTetrahedralArrangementOnAddition } from '../app/tetrahedral-stereochemistry.ts';

const terminal = [{x:1,y:0,element:'O'}];
const bond = [[-1,0,1]];
const angle = (p, q, r) => {
  const a = [p.x-q.x,p.y-q.y], b = [r.x-q.x,r.y-q.y];
  return Math.acos((a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)))*180/Math.PI;
};

test('automatic attachment considers bond geometry and leaves the existing graph untouched', () => {
  const molecule = {atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0}],bonds:[[1,2,1]]};
  const before = structuredClone(molecule);
  const result = placeAttachmentTemplate(molecule,2,terminal,bond);
  assert.ok(result);
  assert.ok(Math.abs(angle(molecule.atoms[0],molecule.atoms[1],result[0])-120)<5);
  assert.deepEqual(molecule,before);
  assert.deepEqual(placeAttachmentTemplate(molecule,2,terminal,bond),result);
});

test('triple bond continuation remains linear and blocked candidates are avoided', () => {
  const triple = {atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0}],bonds:[[1,2,3]]};
  const point = placeAttachmentTemplate(triple,2,terminal,bond)[0];
  assert.ok(angle(triple.atoms[0],triple.atoms[1],point)>170);
  const blocked = {atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0},{id:3,x:1.5,y:0.866}],bonds:[[1,2,1]]};
  const alternative = placeAttachmentTemplate(blocked,2,terminal,bond)[0];
  assert.ok(Math.hypot(alternative.x-blocked.atoms[2].x,alternative.y-blocked.atoms[2].y)>0.42);
});

test('a ring attachment remains outside the cycle', () => {
  const atoms=Array.from({length:6},(_,i)=>({id:i+1,x:Math.cos(i*Math.PI/3),y:Math.sin(i*Math.PI/3)}));
  const molecule={atoms,bonds:atoms.map((_,i)=>[i+1,(i+1)%6+1,1]),rings:[{atomIds:atoms.map(a=>a.id)}]};
  const point=placeAttachmentTemplate(molecule,1,terminal,bond)[0];
  assert.ok(point.x>atoms[0].x);
});

test('automatic candidate evaluation does not mutate an existing stereocenter', () => {
  const parsed=moleculeFromSmiles('C[C@H](O)CC');assert.ok(parsed.ok);
  const graph=parsed.molecule,before=structuredClone(graph);
  const terminal=graph.atoms.find(atom=>(atom.element??'C')==='C' && graph.bonds.filter(([a,b])=>a===atom.id||b===atom.id).length===1);
  assert.ok(terminal);const point=placeAttachmentTemplate(graph,terminal.id,terminalTemplate(),bond);assert.ok(point);
  assert.deepEqual(graph,before);
  const result=moleculeToSmiles(graph);assert.ok(result.ok);
  assert.equal(structuralIdentity(result.smiles),structuralIdentity('C[C@H](O)CC'));
});

test('extending a ligand preserves spatial configuration when CIP priorities change', () => {
  const parsed=moleculeFromSmiles('C[C@H](O)CC');assert.ok(parsed.ok);const graph=parsed.molecule;
  const terminal=graph.atoms.find(atom=>(atom.element??'C')==='C' && graph.bonds.filter(([a,b])=>a===atom.id||b===atom.id).length===1);
  assert.ok(terminal);const point=placeAttachmentTemplate(graph,terminal.id,terminalTemplate(),bond);assert.ok(point);
  const id=Math.max(...graph.atoms.map(a=>a.id))+1;
  const edited={...graph,atoms:[...graph.atoms,{id,...point[0],element:'F'}],bonds:[...graph.bonds,[terminal.id,id,1]]};
  const preserved=preserveTetrahedralArrangementOnAddition(graph,edited);
  const after=moleculeToSmiles(preserved);assert.ok(after.ok);
  assert.equal(structuralIdentity(after.smiles),structuralIdentity('FC[C@H](O)CC'));
});

test('CIP relabeling preserves either enantiomer and is stable under atom and bond reordering', () => {
  for(const [source,expected] of [['C[C@H](O)CC','FC[C@H](O)CC'],['C[C@@H](O)CC','FC[C@@H](O)CC']]) for(const reverse of [false,true]) {
    const graph=moleculeFromSmiles(source).molecule;
    if(reverse){graph.atoms.reverse();graph.bonds.reverse();}
    const center=graph.atoms.find(a=>a.tetrahedralParity);
    const terminal=graph.atoms.find(a=>a.id!==center.id&&(a.element??'C')==='C'
      &&graph.bonds.some(([x,y])=>x===center.id&&y===a.id||y===center.id&&x===a.id)
      &&graph.bonds.filter(([x,y])=>x===a.id||y===a.id).length===1);
    assert.ok(terminal);const id=Math.max(...graph.atoms.map(a=>a.id))+1;
    const next={...graph,atoms:[...graph.atoms,{id,x:terminal.x+1,y:terminal.y,element:'F'}],bonds:[...graph.bonds,[terminal.id,id,1]]};
    const actual=moleculeToSmiles(preserveTetrahedralArrangementOnAddition(graph,next));assert.ok(actual.ok);
    assert.equal(structuralIdentity(actual.smiles),structuralIdentity(expected));
  }
});

test('explicit stereochemical edits are not relabeled', () => {
  const graph=moleculeFromSmiles('C[C@H](O)CC').molecule,center=graph.atoms.find(a=>a.tetrahedralParity);
  const toggled={...graph,atoms:graph.atoms.map(a=>a.id===center.id?{...a,tetrahedralParity:a.tetrahedralParity==='R'?'S':'R'}:a)};
  assert.equal(preserveTetrahedralArrangementOnAddition(graph,toggled),toggled);
});

test('replacing the implicit hydrogen at a tetrahedral carbon preserves its arrangement', () => {
  for(const [source,expected] of [['C[C@H](O)CC','C[C@@](O)(F)CC'],['C[C@@H](O)CC','C[C@](O)(F)CC']]) for(const reverse of [false,true]) {
    const graph=moleculeFromSmiles(source).molecule;if(reverse){graph.atoms.reverse();graph.bonds.reverse();}
    const center=graph.atoms.find(a=>a.tetrahedralParity);
    const next={...graph,atoms:[...graph.atoms,{id:99,x:center.x+1,y:center.y,element:'F'}],bonds:[...graph.bonds,[center.id,99,1]]};
    const actual=moleculeToSmiles(preserveTetrahedralArrangementOnAddition(graph,next));assert.ok(actual.ok);
    assert.equal(structuralIdentity(actual.smiles),structuralIdentity(expected));
  }
});

test('a valid four-neighbor tetrahedral carbon can be reimported after export', () => {
  for(const smiles of ['C[C@@](O)(F)CC','C[C@](O)(F)CC','C[C@@](O)(F)C/C=C/C']) {
    const result=moleculeFromSmiles(smiles);assert.ok(result.ok, result.ok ? '' : result.error);
    const output=moleculeToSmiles(result.molecule);assert.ok(output.ok);
    assert.equal(structuralIdentity(output.smiles),structuralIdentity(smiles));
  }
  assert.equal(moleculeFromSmiles('C(C)(C)(C)(C)C').ok,false);
});

test('remote addition preserves two assigned centers', () => {
  const graph=moleculeFromSmiles('C[C@H](O)[C@H](F)CC').molecule;
  const next={...graph,atoms:[...graph.atoms,{id:99,x:3,y:0,element:'F'}],bonds:[...graph.bonds,[1,99,1]]};
  const actual=moleculeToSmiles(preserveTetrahedralArrangementOnAddition(graph,next));assert.ok(actual.ok);
  assert.equal(structuralIdentity(actual.smiles),structuralIdentity('FC[C@H](O)[C@H](F)CC'));
});

function terminalTemplate(){return [{x:1,y:0,element:'F'}];}

test('skeletal projection is linear at either end of a triple bond', () => {
  for(const smiles of ['C#CC','CC#C','CC#CC']) {
    const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);const graph=parsed.molecule;
    const carbons=graph.atoms.filter(a=>(a.element??'C')==='C').map(a=>a.id);
    const layout=calculateMolecule2DLayout(graph,carbons,'skeletal');
    for(let i=1;i<carbons.length-1;i++) {
      const adjacent=graph.bonds.filter(([a,b])=>a===carbons[i]||b===carbons[i]);
      if(adjacent.some(([, ,order])=>order===3)) assert.ok(angle(layout.get(carbons[i-1]),layout.get(carbons[i]),layout.get(carbons[i+1]))>175);
    }
  }
});
