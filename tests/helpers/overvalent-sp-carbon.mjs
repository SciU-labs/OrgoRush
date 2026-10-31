import assert from 'node:assert/strict';
import {moleculeFromSmiles} from '../../app/openchemlib-adapter.ts';

/** An intentionally invalid editor graph. Import must reject the original
 * SMILES before the independent exercise validators are exercised. */
export function overvalentSpCarbonGraph(){
  assert.equal(moleculeFromSmiles('CC(O)C#C(Br)C(C)CC').ok,false);
  const parsed=moleculeFromSmiles('CC(O)C#CC(C)CC');assert.equal(parsed.ok,true);
  const molecule=parsed.molecule,tripleCarbon=molecule.bonds.find(([, ,o])=>o===3)[1];
  const id=Math.max(...molecule.atoms.map(a=>a.id))+1;
  molecule.atoms.push({id,element:'Br',x:0,y:0});molecule.bonds.push([tripleCarbon,id,1]);
  return molecule;
}
