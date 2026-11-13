import test from 'node:test';
import assert from 'node:assert/strict';
import {getAutoPlacedCarbonPosition,placeAttachmentTemplate} from '../app/manual-layout.ts';
import {calculateMolecule2DLayout} from '../app/molecule-2d-layout.ts';
import {moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {structuralIdentity} from './helpers/reference-corpus.mjs';

function benzene(rotation=0){
 const atoms=Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3+rotation;return {id:101+i*7,x:Math.cos(a)*1.35,y:Math.sin(a)*1.65,element:'C'}});
 return {atoms,bonds:atoms.map((a,i)=>[a.id,atoms[(i+1)%6].id,i%2?1:2]),rings:[{kind:'aromatic',atomIds:atoms.map(a=>a.id)}]};
}
const cosine=(a,b)=>(a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y));
function checkExit(m,vertex,point){
 const modified={...m,atoms:[...m.atoms,{id:999,...point,element:'C'}],bonds:[...m.bonds,[vertex.id,999,1]]};
 const positions=calculateMolecule2DLayout(modified,[],'skeletal');
 const center=m.atoms.reduce((s,a)=>({x:s.x+positions.get(a.id).x/6,y:s.y+positions.get(a.id).y/6}),{x:0,y:0});
 const parent=positions.get(vertex.id),child=positions.get(999);
 assert.ok(cosine({x:parent.x-center.x,y:parent.y-center.y},{x:child.x-parent.x,y:child.y-parent.y})>0.995);
 const output=moleculeToSmiles(modified);assert.ok(output.ok);assert.equal(structuralIdentity(output.smiles),structuralIdentity('Cc1ccccc1'));
}

test('automatic carbon exits follow all six radial directions independent of IDs and orientation',()=>{
 for(const rotation of [0,Math.PI/6,Math.PI/2]) for(const reflected of [false,true]){
  const graph=benzene(rotation);if(reflected)graph.atoms.forEach(atom=>atom.x=-atom.x);const before=structuredClone(graph);
  for(const vertex of graph.atoms){const point=getAutoPlacedCarbonPosition(graph,vertex.id,{x:1,y:0});checkExit(graph,vertex,point);}
  assert.deepEqual(graph,before);
 }
});

test('functional attachments on both poles remain radial',()=>{
 const graph=benzene();for(const vertex of [graph.atoms[0],graph.atoms[3]]){
  const [point]=placeAttachmentTemplate(graph,vertex.id,[{x:1,y:0,element:'O'}],[[-1,0,1]]);
  const center=graph.atoms.reduce((s,a)=>({x:s.x+a.x/6,y:s.y+a.y/6}),{x:0,y:0});
  assert.ok(cosine({x:vertex.x-center.x,y:vertex.y-center.y},{x:point.x-vertex.x,y:point.y-vertex.y})>0.995);
 }
});

test('a chain template begins radially and retains its zigzag continuation',()=>{
 const graph=benzene(),vertex=graph.atoms[3];
 const points=placeAttachmentTemplate(graph,vertex.id,[{x:1,y:0},{x:2,y:0}],[[-1,0,1],[0,1,1]],{zigzagLinear:true});
 assert.ok(points);checkExit(graph,vertex,points[0]);
 const a={x:points[0].x-vertex.x,y:points[0].y-vertex.y},b={x:points[1].x-points[0].x,y:points[1].y-points[0].y};
 assert.ok(Math.abs(cosine(a,b))<0.9);
});

test('deformed and obstructed rings use the safe existing candidate policy',()=>{
 const deformed=benzene();deformed.atoms[2].x+=1.2;const legacy=structuredClone(deformed);legacy.rings[0].kind='cycloalkane';
 assert.deepEqual(getAutoPlacedCarbonPosition(deformed,deformed.atoms[0].id,{x:1,y:0}),getAutoPlacedCarbonPosition(legacy,legacy.atoms[0].id,{x:1,y:0}));
 const blocked=benzene(),vertex=blocked.atoms[0];blocked.atoms.push({id:999,x:vertex.x,y:vertex.y-1,element:'C'});
 const point=getAutoPlacedCarbonPosition(blocked,vertex.id,{x:1,y:0});assert.ok(Math.hypot(point.x-blocked.atoms.at(-1).x,point.y-blocked.atoms.at(-1).y)>0.42);
});
