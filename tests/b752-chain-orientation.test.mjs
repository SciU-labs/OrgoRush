import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenChainSkeletalPositions } from '../app/skeletal-layout.ts';
import { calculateMolecule2DLayout } from '../app/molecule-2d-layout.ts';
import { flipCoordinates } from '../app/coordinate-flip.ts';

test('numbering reversal does not reverse an existing skeletal arrangement', () => {
  const molecule = {
    stableSkeletalOrientation: true,
    atoms: Array.from({length: 6}, (_, i) => ({id: i + 1, x: i, y: 0})),
    bonds: Array.from({length: 5}, (_, i) => [i + 1, i + 2, 1]),
  };
  molecule.atoms.push({id: 7, x: 3, y: -1});
  molecule.bonds.push([4, 7, 1]);
  const before = buildOpenChainSkeletalPositions(molecule, [6, 5, 4, 3, 2, 1]);
  const semiBefore = calculateMolecule2DLayout(molecule, [6, 5, 4, 3, 2, 1], 'semi-developed');
  molecule.atoms.push({id: 8, x: 1, y: -1});
  molecule.bonds.push([2, 8, 1]);
  const after = buildOpenChainSkeletalPositions(molecule, [1, 2, 3, 4, 5, 6]);
  const semiAfter = calculateMolecule2DLayout(molecule, [1, 2, 3, 4, 5, 6], 'semi-developed');
  for (let id = 1; id <= 7; id++) {
    assert.ok(Math.hypot(before.get(id).x - after.get(id).x, before.get(id).y - after.get(id).y) < 1e-8, `atom ${id} moved`);
    assert.ok(Math.hypot(semiBefore.get(id).x - semiAfter.get(id).x, semiBefore.get(id).y - semiAfter.get(id).y) < 1e-8, `semi-developed atom ${id} moved`);
  }
});

test('explicit reflection remains a reflection for a manually constructed chain', () => {
 const molecule={stableSkeletalOrientation:true,atoms:Array.from({length:6},(_,i)=>({id:i+1,x:i,y:0})),bonds:Array.from({length:5},(_,i)=>[i+1,i+2,1])};
 const path=[1,2,3,4,5,6];
 for(const mode of ['skeletal','semi-developed']) {
  const before=calculateMolecule2DLayout(molecule,path,mode);
  const after=calculateMolecule2DLayout(flipCoordinates(molecule),path,mode);
  const sum=before.get(1).x+before.get(6).x;
  for(const id of path){assert.ok(Math.abs(after.get(id).x-(sum-before.get(id).x))<1e-7,`${mode} atom ${id} was not reflected`);assert.ok(Math.abs(after.get(id).y-before.get(id).y)<1e-7)}
 }
});
