import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { moleculeFromSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';
let chemistry;
before(async()=>{chemistry=await loadExerciseChemistry();});
after(async()=>{await chemistry?.close();});
test('cyclic substituents cannot overflow the local tree namer before FULL reconciliation',()=>{
  for(const smiles of ['O=C(c1ccccc1)c1ccccc1','c1ccc(C(=O)c2ccccc2)cc1']){
    const imported=moleculeFromSmiles(smiles);assert.equal(imported.ok,true);
    const analysis=chemistry.engine.analyzeMolecule(imported.molecule);
    assert.equal(chemistry.engine.localNamerCannotSafelyName(imported.molecule,analysis),true);
    assert.equal(reconcileSystematicName(imported.molecule,'diphenylmethanone')?.status,'FULL');
  }
});
