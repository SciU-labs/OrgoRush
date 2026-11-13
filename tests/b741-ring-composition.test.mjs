import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {parentStructureSelectionReasoning} from '../app/reasoning-parent-selection.ts';
import {buildReasoningVisualReferences} from '../app/reasoning-visual-targets.ts';

test('aromatic parent descriptions count ring atoms and carbon atoms independently',()=>{
 for(const [smiles,name,size,carbons] of [['n1ccccc1','pyridine',6,5],['c1ccoc1','furan',5,4]]){
  const parsed=moleculeFromSmiles(smiles);assert.ok(parsed.ok);const molecule=parsed.molecule;
  const ring=molecule.rings.find(item=>item.kind==='aromatic');assert.ok(ring);
  const analysis={family:'aromatic',mainChain:ring.atomIds,chainName:name,functionalGroups:[],numberedAtoms:new Map()};
  const es=parentStructureSelectionReasoning(molecule,analysis,'es'),en=parentStructureSelectionReasoning(molecule,analysis,'en');
  assert.match(es,new RegExp(`${size} átomos, de ellos ${carbons} carbonos`));
  assert.match(en,new RegExp(`${size} atoms, including ${carbons} carbons`));
 }
});

test('a unique heteroatom is selectable as a structural numbering reference without invented locants',()=>{
 const parsed=moleculeFromSmiles('n1ccccc1');assert.ok(parsed.ok);const molecule=parsed.molecule;
 const ring=molecule.rings.find(item=>item.kind==='aromatic'),nitrogen=molecule.atoms.find(atom=>atom.element==='N');assert.ok(ring&&nitrogen);
 const analysis={mainChain:ring.atomIds,numberedAtoms:new Map([[nitrogen.id,1]]),substituents:[],functionalGroups:[]};
 const input={molecule,analysis,steps:[{number:'03',nameRole:'numbering'}],fragments:{},displayedName:'piridina',enabled:true};
 assert.deepEqual(buildReasoningVisualReferences(input).steps['03'],{stepNumber:'03',atomIds:[nitrogen.id],bondIds:[],locants:[]});
 const wrong={...input,analysis:{...analysis,numberedAtoms:new Map([[nitrogen.id,2]])}};
 assert.equal(buildReasoningVisualReferences(wrong).steps['03'],undefined);
 const twoHetero=moleculeFromSmiles('n1ccncc1').molecule;
 const twoInput={...input,molecule:twoHetero,analysis:{...analysis,mainChain:twoHetero.rings[0].atomIds,numberedAtoms:new Map([[twoHetero.atoms.find(a=>a.element==='N').id,1]])}};
 assert.equal(buildReasoningVisualReferences(twoInput).steps['03'],undefined);
});
