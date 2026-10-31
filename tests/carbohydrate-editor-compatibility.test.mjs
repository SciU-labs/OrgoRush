import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {carbohydrateCases} from './fixtures/carbohydrate-derivation.mjs';
import {moleculeFromSmiles,moleculeToSmiles} from '../app/openchemlib-adapter.ts';
import {editableValencesValid} from '../app/editable-valence.ts';
import {getTetrahedralAssignmentSummary} from '../app/tetrahedral-stereochemistry.ts';
let chemistry;
before(async()=>{chemistry=await loadExerciseChemistry();});
after(async()=>{await chemistry?.close();});
test('existing editor imports, edits and exports all reference monosaccharides without new chemistry',()=>{
  for(const f of carbohydrateCases){
    const r=moleculeFromSmiles(f.smiles);assert.equal(r.ok,true,r.error);
    assert.equal(editableValencesValid(r.molecule),true);assert.equal(moleculeToSmiles(r.molecule).ok,true);
    const stereo=getTetrahedralAssignmentSummary(r.molecule);assert.equal(stereo.complete,true);
    const a=chemistry.engine.analyzeMolecule(r.molecule);
    assert.ok(a.mainChain.length>0);
    if(f.form!=='open'){
      assert.equal(r.molecule.rings[0].kind,'cycloalkane','legacy nonaromatic storage tag remains compatible');
      assert.equal(chemistry.engine.buildLegacyEnglishNameModel(r.molecule,a).parent.kind,'heterocycle','semantic parent uses ring composition');
      assert.equal(chemistry.engine.principalGroupAnalysisLabel(r.molecule,a),'Heterociclo');
      assert.equal(chemistry.engine.localNamerCannotSafelyName(r.molecule,a),true,'incomplete local parent name is not presented as a full sugar name');
    }
  }
});
test('ordinary oxygen rings and carbon rings keep their composition and naming routes',()=>{
  for(const [smiles,parent,label,family] of [
    ['C1CCOC1','tetrahidrofurano','Heterociclo','heterocycle'],
    ['C1CCOCC1','tetrahidropirano','Heterociclo','heterocycle'],
    ['C1CCCCC1','ciclohexano','Hidrocarburo','ring'],
  ]){
    const g=moleculeFromSmiles(smiles).molecule,a=chemistry.engine.analyzeMolecule(g);
    assert.equal(a.chainName,parent);assert.equal(chemistry.engine.principalGroupAnalysisLabel(g,a),label);
    assert.equal(chemistry.engine.buildLegacyEnglishNameModel(g,a).parent.kind,family);
  }
});
