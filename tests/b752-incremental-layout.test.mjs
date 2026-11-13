import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMolecule2DLayout, preserveIncrementalLayout, preserveDirectionalCarbonAddition, preserveIncrementalAttachment, reflectIncrementalLayout} from '../app/molecule-2d-layout.ts';
import {flipCoordinates} from '../app/coordinate-flip.ts';
import {inspectDoubleBondStereochemistry} from '../app/double-bond-stereochemistry.ts';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {getAutoPlacedCarbonPosition} from '../app/manual-layout.ts';

test('a changed parent does not relocate the existing atoms in either projection', () => {
 let graph={stableSkeletalOrientation:true,atoms:Array.from({length:6},(_,i)=>({id:i+1,x:i,y:0})),bonds:Array.from({length:5},(_,i)=>[i+1,i+2,1])};
 let oldPath=[1,2,3,4,5,6];
 for(const [parent,id,x,y,newPath] of [[3,7,2,-1,[1,2,3,4,5,6]],[7,8,2,-2,[1,2,3,4,5,6]],[8,9,2,-3,[6,5,4,3,7,8,9]]]){
  const before=Object.fromEntries(['skeletal','semi-developed'].map(mode=>[mode,calculateMolecule2DLayout(graph,oldPath,mode)]));
  const next={...graph,atoms:[...graph.atoms,{id,x,y}],bonds:[...graph.bonds,[parent,id,1]]};
  graph=preserveIncrementalLayout(graph,next,oldPath,parent,id);
  for(const mode of ['skeletal','semi-developed']){
   const after=calculateMolecule2DLayout(graph,newPath,mode);
   for(const [atom,p] of before[mode])assert.ok(Math.hypot(after.get(atom).x-p.x,after.get(atom).y-p.y)<1e-7,`${mode} atom ${atom} moved when adding ${id}`);
  }
  oldPath=newPath;
 }
});

for(const side of [-1,1])test(`incremental addition preserves defined alkene geometry on side ${side}`,()=>{
 const base={atoms:[{id:1,x:-2.5,y:1.4},{id:2,x:-1.3,y:.8},{id:3,x:0,y:0},{id:4,x:1.4,y:0},{id:5,x:2.7,y:side*.8},{id:6,x:3.9,y:side*1.4}],bonds:[[1,2,1],[2,3,1],[3,4,2,true],[4,5,1],[5,6,1]]};
 const next={...base,atoms:[...base.atoms,{id:7,x:-1.3,y:2.1}],bonds:[...base.bonds,[2,7,1]]};
 const expected=inspectDoubleBondStereochemistry(next,3,4).configuration;
 assert.ok(expected);
 const saved=preserveIncrementalLayout(base,next,[1,2,3,4,5,6],2,7);
 assert.ok(saved.incrementalLayout,'the verified addition should retain a layout');
 assert.deepEqual(saved.bonds,next.bonds);
 for(const mode of ['skeletal','semi-developed']){
  const before=calculateMolecule2DLayout(base,[1,2,3,4,5,6],mode), after=calculateMolecule2DLayout(saved,[6,5,4,3,2,1],mode);
  for(const [id,p] of before)assert.deepEqual(after.get(id),p);
  const displayed={...saved,atoms:saved.atoms.map(a=>({...a,...after.get(a.id)}))};
  assert.equal(inspectDoubleBondStereochemistry(displayed,3,4).configuration,expected);
 }
});

test('a CIP priority change is not forced to retain the former E/Z letter',()=>{
 let graph={atoms:[{id:1,x:-2.5,y:1.4},{id:2,x:-1.3,y:.8},{id:3,x:0,y:0},{id:4,x:1.4,y:0},{id:5,x:2.7,y:-.8},{id:6,x:3.9,y:-1.4}],bonds:[[1,2,1],[2,3,1],[3,4,2,true],[4,5,1],[5,6,1]]};
 let initialConfiguration;
 for(const [parent,id,x,y] of [[3,7,0,-1.3],[7,8,-1,-2],[8,9,-2,-2.5]]){
  const next={...graph,atoms:[...graph.atoms,{id,x,y}],bonds:[...graph.bonds,[parent,id,1]]};
  const nextLayout=preserveIncrementalLayout(graph,next,[1,2,3,4,5,6],parent,id);
  assert.ok(nextLayout?.incrementalLayout,`addition ${id} needs a stable layout`);
  graph=nextLayout;
  if(id===7)initialConfiguration=inspectDoubleBondStereochemistry(graph,3,4).configuration;
 }
 const inspection=inspectDoubleBondStereochemistry(graph,3,4);
 assert.equal(inspection.priorityAtomIds[0],7,'extended ligand should become higher priority');
 assert.notEqual(inspection.configuration,initialConfiguration,'the correct descriptor changes when priorities reverse');
 for(const mode of ['skeletal','semi-developed']){
  const p=calculateMolecule2DLayout(graph,[9,8,7,3,4,5,6],mode);
  const displayed={...graph,atoms:graph.atoms.map(a=>({...a,...p.get(a.id)}))};
  assert.equal(inspectDoubleBondStereochemistry(displayed,3,4).configuration,inspection.configuration);
 }
});

test('reflection transforms the preserved geometry and a coordinate edit invalidates it',()=>{
 const base={atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0},{id:3,x:2,y:0}],bonds:[[1,2,1],[2,3,1]]};
 const next={...base,atoms:[...base.atoms,{id:4,x:1,y:-1}],bonds:[...base.bonds,[2,4,1]]};
 const saved=preserveIncrementalLayout(base,next,[1,2,3],2,4);
 assert.ok(saved.incrementalLayout);
 const reflected=reflectIncrementalLayout(saved,flipCoordinates(saved));
 for(const mode of ['skeletal','semi-developed']){
  const before=calculateMolecule2DLayout(saved,[1,2,3],mode),after=calculateMolecule2DLayout(reflected,[1,2,3],mode);
  const xs=[...before.values()].map(p=>p.x), sum=Math.min(...xs)+Math.max(...xs);
  for(const [id,p] of before)assert.ok(Math.abs(after.get(id).x-(sum-p.x))<1e-7 && Math.abs(after.get(id).y-p.y)<1e-7);
 }
 const moved={...saved,atoms:saved.atoms.map(a=>a.id===4?{...a,x:a.x+5}:a)};
 const recomputed=calculateMolecule2DLayout(moved,[1,2,3],'skeletal');
 const noSnapshot=calculateMolecule2DLayout({...moved,incrementalLayout:undefined},[1,2,3],'skeletal');
 assert.deepEqual(recomputed,noSnapshot);
});

test('extension of a triple bond retains a straight angle',()=>{
 const base={atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0}],bonds:[[1,2,3]]};
 const next={...base,atoms:[...base.atoms,{id:3,x:2,y:0}],bonds:[...base.bonds,[2,3,1]]};
 const saved=preserveIncrementalLayout(base,next,[1,2],2,3);
 assert.ok(saved.incrementalLayout);
 for(const mode of ['skeletal','semi-developed']){
  const p=calculateMolecule2DLayout(saved,[1,2,3],mode),a=p.get(1),b=p.get(2),c=p.get(3);
  assert.ok(Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<1e-6);
  assert.ok((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>0);
 }
});

test('incrementally constructed chains retain a horizontal semi-developed backbone',()=>{
 let graph={atoms:[{id:1,x:0,y:0}],bonds:[]};
 for(let id=2;id<=6;id++){
  const next={...graph,atoms:[...graph.atoms,{id,x:id-1,y:0}],bonds:[...graph.bonds,[id-1,id,1]]};
  graph=preserveIncrementalLayout(graph,next,Array.from({length:id-1},(_,i)=>i+1),id-1,id);
  assert.ok(graph.incrementalLayout);
 }
 const p=calculateMolecule2DLayout(graph,[1,2,3,4,5,6],'semi-developed');
 for(let id=1;id<=6;id++)assert.ok(Math.abs(p.get(id).y-p.get(1).y)<1e-6,`carbon ${id} moved off the baseline`);
});

test('different addition histories preserve their own geometry and equivalent connectivity',()=>{
 const build=(order)=>{
  let graph={atoms:Array.from({length:5},(_,i)=>({id:i+1,x:i,y:0})),bonds:Array.from({length:4},(_,i)=>[i+1,i+2,1])};
  for(const [index,parent] of order.entries()){
   const id=6+index,before=calculateMolecule2DLayout(graph,[1,2,3,4,5]);
   const next={...graph,atoms:[...graph.atoms,{id,x:parent-1,y:parent===2?-1:1}],bonds:[...graph.bonds,[parent,id,1]]};
   graph=preserveIncrementalLayout(graph,next,[1,2,3,4,5],parent,id);
   assert.ok(graph.incrementalLayout);
   const after=calculateMolecule2DLayout(graph,[1,2,3,4,5]);
   for(const [atom,p] of before)assert.deepEqual(after.get(atom),p);
  }
  return graph;
 };
 const left=build([2,4]),right=build([4,2]);
 const attachments=g=>g.bonds.filter(([a,b])=>a>5||b>5).map(([a,b])=>Math.min(a,b)).sort();
 assert.deepEqual(attachments(left),attachments(right));
 assert.equal(left.atoms.length,right.atoms.length);assert.equal(left.bonds.length,right.bonds.length);
});

test('three successive branches on a long chain keep all previous bonds in place',()=>{
 let graph={atoms:Array.from({length:8},(_,i)=>({id:i+1,x:i,y:0})),bonds:Array.from({length:7},(_,i)=>[i+1,i+2,1])};
 const path=[1,2,3,4,5,6,7,8];
 for(const [parent,id,y] of [[2,9,-1],[4,10,1],[6,11,-1]]){
  const before=Object.fromEntries(['skeletal','semi-developed'].map(mode=>[mode,calculateMolecule2DLayout(graph,path,mode)]));
  const next={...graph,atoms:[...graph.atoms,{id,x:parent-1,y}],bonds:[...graph.bonds,[parent,id,1]]};
  graph=preserveIncrementalLayout(graph,next,path,parent,id);assert.ok(graph.incrementalLayout);
  for(const mode of ['skeletal','semi-developed']){
   const after=calculateMolecule2DLayout(graph,path,mode);
   for(const [atom,p] of before[mode])assert.deepEqual(after.get(atom),p);
  }
 }
});

test('explicit up and down place branches in the requested screen sectors in both views',()=>{
 let graph={atoms:Array.from({length:8},(_,i)=>({id:i+1,x:i,y:0})),bonds:Array.from({length:7},(_,i)=>[i+1,i+2,1])};
 const path=[1,2,3,4,5,6,7,8];
 for(const [parent,id,y] of [[2,9,-1],[4,10,1],[6,11,-1]]){
  const next={...graph,atoms:[...graph.atoms,{id,x:parent-1,y}],bonds:[...graph.bonds,[parent,id,1]]};
  graph=preserveIncrementalLayout(graph,next,path,parent,id,{x:0,y});
  assert.ok(graph?.incrementalLayout);
  for(const mode of ['skeletal','semi-developed']){
   const positions=calculateMolecule2DLayout(graph,path,mode);
   assert.ok((positions.get(id).y-positions.get(parent).y)*y>1e-6,`${mode} atom ${id} went the wrong way`);
  }
 }
});

test('an impossible explicit direction does not fall back to global re-layout',()=>{
 const before={atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0}],bonds:[[1,2,3]]};
 const next={...before,atoms:[...before.atoms,{id:3,x:2,y:0}],bonds:[...before.bonds,[2,3,1]]};
 assert.equal(preserveIncrementalLayout(before,next,[1,2],2,3,{x:0,y:-1}),null);
});

test('a longer candidate cannot pass through an existing neighbor to satisfy an arrow',()=>{
 const before={atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0}],bonds:[[1,2,1]]};
 const next={...before,atoms:[...before.atoms,{id:3,x:-1,y:0}],bonds:[...before.bonds,[2,3,1]]};
 assert.equal(preserveIncrementalLayout(before,next,[1,2],2,3,{x:-1,y:0}),null);
});

test('directed extension can change CIP priority without moving existing atoms',()=>{
 let graph={atoms:[{id:1,x:-2.5,y:1.4},{id:2,x:-1.3,y:.8},{id:3,x:0,y:0},{id:4,x:1.4,y:0},{id:5,x:2.7,y:-.8},{id:6,x:3.9,y:-1.4}],bonds:[[1,2,1],[2,3,1],[3,4,2,true],[4,5,1],[5,6,1]]};
 let initial;
 for(const [parent,id,x,y,dir] of [[3,7,0,-1.3,{x:0,y:-1}],[7,8,-1,-2,{x:-1,y:0}],[8,9,-2,-2.5,{x:-1,y:0}]]){
  const positions=Object.fromEntries(['skeletal','semi-developed'].map(mode=>[mode,calculateMolecule2DLayout(graph,[1,2,3,4,5,6],mode)]));
  const next={...graph,atoms:[...graph.atoms,{id,x,y}],bonds:[...graph.bonds,[parent,id,1]]};
  graph=preserveIncrementalLayout(graph,next,[1,2,3,4,5,6],parent,id,dir);
  assert.ok(graph?.incrementalLayout,`directed addition ${id} failed`);
  if(id===7)initial=inspectDoubleBondStereochemistry(graph,3,4).configuration;
  for(const mode of ['skeletal','semi-developed']){
   const after=calculateMolecule2DLayout(graph,[1,2,3,4,5,6],mode);
   for(const [atom,p] of positions[mode])assert.deepEqual(after.get(atom),p);
  }
 }
 assert.notEqual(inspectDoubleBondStereochemistry(graph,3,4).configuration,initial);
});

test('an automatically placed multi-atom substituent preserves the pre-existing projections',()=>{
 const graph={atoms:Array.from({length:6},(_,i)=>({id:i+1,x:i,y:0})),bonds:Array.from({length:5},(_,i)=>[i+1,i+2,1])};
 const path=[1,2,3,4,5,6],before=Object.fromEntries(['skeletal','semi-developed'].map(mode=>[mode,calculateMolecule2DLayout(graph,path,mode)]));
 const next={...graph,atoms:[...graph.atoms,{id:7,x:2,y:-1},{id:8,x:2,y:-2}],bonds:[...graph.bonds,[3,7,1],[7,8,1]]};
 const placed=preserveIncrementalAttachment(graph,next,path);
 assert.ok(placed?.incrementalLayout);assert.deepEqual(placed.bonds,next.bonds);
 for(const mode of ['skeletal','semi-developed']){
  const after=calculateMolecule2DLayout(placed,[6,5,4,3,7,8],mode);
  for(const [atom,p] of before[mode])assert.deepEqual(after.get(atom),p);
 }
});

test('screen direction is reconciled with imported E alkene editor geometry',()=>{
 const parsed=moleculeFromSmiles('CC/C=C/CC');assert.ok(parsed.ok);const before=parsed.molecule,path=[1,2,3,4,5,6];
 const directions=[{x:1,y:0},{x:0,y:-1},{x:0,y:1},{x:-1,y:0}];
 const raw=directions.map(direction=>getAutoPlacedCarbonPosition(before,3,direction));
 const next={...before,atoms:[...before.atoms,{id:7,...raw[0],element:'C'}],bonds:[...before.bonds,[3,7,1]]};
 const placed=preserveDirectionalCarbonAddition(before,next,path,3,7,{x:1,y:0},raw.slice(1));
 assert.ok(placed?.incrementalLayout,'a compatible raw orientation exists');
 assert.equal(inspectDoubleBondStereochemistry(placed,3,4).configuration,'E');
 for(const mode of ['skeletal','semi-developed']){
  const beforePos=calculateMolecule2DLayout(before,path,mode),after=calculateMolecule2DLayout(placed,path,mode);
  for(const [id,p] of beforePos)assert.deepEqual(after.get(id),p);
  assert.ok(after.get(7).x>after.get(3).x);
 }
});

test('an obstructed semi-developed lane can move only an unconstrained terminal atom locally',()=>{
 const parsed=moleculeFromSmiles('CC/C=C/CC');assert.ok(parsed.ok);const before=parsed.molecule,path=[1,2,3,4,5,6];
 const raw=getAutoPlacedCarbonPosition(before,3,{x:0,y:-1});
 const next={...before,stableSkeletalOrientation:true,atoms:[...before.atoms,{id:7,...raw,element:'C'}],bonds:[...before.bonds,[3,7,1]]};
 const placed=preserveIncrementalLayout(before,next,path,3,7,{x:0,y:-1});
 assert.ok(placed?.incrementalLayout,'a local adjustment should permit the requested direction');
 assert.ok(placed.incrementalLayout.adjustments.some(a=>a.relocatedAtomId===6 && a.view==='semi-developed'));
 const old=calculateMolecule2DLayout(before,path,'semi-developed'),after=calculateMolecule2DLayout(placed,path,'semi-developed');
 for(const [id,p] of old)if(id!==6)assert.deepEqual(after.get(id),p);
 assert.notDeepEqual(after.get(6),old.get(6));assert.ok(after.get(7).y<after.get(3).y);
 const display={...placed,atoms:placed.atoms.map(a=>({...a,...after.get(a.id)}))};
 assert.equal(inspectDoubleBondStereochemistry(display,3,4).configuration,'E');
});

test('an unassigned alkene accepts a free substituent without assigning E/Z',()=>{
 const parsed=moleculeFromSmiles('CCC=CCC');assert.ok(parsed.ok);const before=parsed.molecule,path=[1,2,3,4,5,6];
 const dirs=[{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}],points=dirs.map(d=>getAutoPlacedCarbonPosition(before,3,d));
 const next={...before,stableSkeletalOrientation:true,atoms:[...before.atoms,{id:7,...points[0],element:'C'}],bonds:[...before.bonds,[3,7,1]]};
 const placed=preserveDirectionalCarbonAddition(before,next,path,3,7,dirs[0],points.slice(1));
 assert.ok(placed?.incrementalLayout);assert.notEqual(placed.bonds.find(([a,b])=>a===3&&b===4)?.[3],true);
 for(const mode of ['skeletal','semi-developed']){
  const beforePos=calculateMolecule2DLayout(before,path,mode),after=calculateMolecule2DLayout(placed,path,mode);
  for(const [id,p] of beforePos)assert.deepEqual(after.get(id),p);
  assert.ok(after.get(7).y<after.get(3).y);
 }
});

test('a carbonyl double bond does not trigger alkene-side constraints on an acid attachment',()=>{
 const before={atoms:[{id:1,x:0,y:0},{id:2,x:1,y:0},{id:3,x:2,y:0}],bonds:[[1,2,1],[2,3,1]]};
 const next={...before,atoms:[...before.atoms,{id:4,x:3,y:0,element:'O'},{id:5,x:2,y:-1,element:'O'}],bonds:[...before.bonds,[3,4,2],[3,5,1]]};
 const placed=preserveIncrementalAttachment(before,next,[1,2,3]);assert.ok(placed?.incrementalLayout);assert.deepEqual(placed.bonds,next.bonds);
});
