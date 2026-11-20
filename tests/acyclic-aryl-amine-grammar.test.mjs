import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {parseAcyclicArylAmine,matchAcyclicArylAmine,mapAcyclicArylAmineEvidence} from '../app/acyclic-aryl-amine-grammar.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';

const fixtures=[
 ['fluoxetine','N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine','CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F'],
 ['fluoxetina español','N-metil-3-fenil-3-[4-(trifluorometil)fenoxi]propan-1-amina','CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F'],
 ['diphenhydramine','2-(diphenylmethoxy)-N,N-dimethylethan-1-amine','CN(C)CCOC(c1ccccc1)c1ccccc1'],
 ['N-methyl phenylpropylamine','N-methyl-3-phenylpropan-1-amine','CNCCCc1ccccc1'],
 ['N,N-dimethyl phenylpropylamine','N,N-dimethyl-3-phenylpropan-1-amine','CN(C)CCCc1ccccc1'],
 ['para chlorophenoxy','3-(4-chlorophenoxy)propan-1-amine','NCCCOc1ccc(Cl)cc1'],
 ['ortho chlorophenoxy','3-(2-chlorophenoxy)propan-1-amine','NCCCOc1ccccc1Cl'],
 ['meta chlorophenoxy','3-(3-chlorophenoxy)propan-1-amine','NCCCOc1cccc(Cl)c1'],
 ['para methylphenoxy','N-ethyl-3-(4-methylphenoxy)propan-1-amine','CCNCCCOc1ccc(C)cc1'],
];
for(const [id,name,smiles] of fixtures)test(`${id}: parse, reconstruct, compare`,()=>{
 const source=moleculeFromSmiles(smiles);assert.equal(source.ok,true,source.error);
 const parsed=parseAcyclicArylAmine(name);assert.ok(parsed,id);
 const matched=matchAcyclicArylAmine(name,source.molecule);assert.ok(matched,id);
 assert.equal(matched.atomMapping.size,source.molecule.atoms.length);
 assert.equal(parsed.graph.bonds.length,source.molecule.bonds.length);
 assert.equal(parsed.parent.atomIds.length, id==='diphenhydramine'?2:3);
 for(const node of parsed.substituents){assert.ok(node.attachmentBond);assert.ok(node.atomIds.length);for(const child of node.children)assert.ok(child.attachmentBond);}
});
test('nested evidence preserves attachment and internal locant',()=>{
 const p=parseAcyclicArylAmine(fixtures[0][1]);const ring=p.substituents.find(c=>c.kind==='phenoxy');
 assert.equal(ring.locant,3);assert.equal(ring.children[0].locant,4);assert.equal(ring.children[0].atomIds.length,4);
 assert.equal(fixtures[0][1].slice(...ring.children[0].span),'trifluoromethyl');
 assert.equal(reconcileSystematicName(moleculeFromSmiles(fixtures[0][2]).molecule,fixtures[0][1])?.status,'FULL');
});
test('pedagogical regions map to real atom identities after graph permutation',()=>{
 const original=moleculeFromSmiles(fixtures[0][2]).molecule;
 const permuted={atoms:[...original.atoms].reverse().map(a=>({...a,id:a.id*31+500})),
   bonds:[...original.bonds].reverse().map(([a,b,o])=>[b*31+500,a*31+500,o])};
 const evidence=mapAcyclicArylAmineEvidence(fixtures[0][1],permuted);assert.ok(evidence);
 const ring=evidence.substituents.find(node=>node.kind==='phenoxy'), cf3=ring.children[0];
 assert.equal(cf3.atomIds.length,4);assert.equal(cf3.locant,4);
 for(const node of [evidence.parent,evidence.amine,...evidence.substituents,cf3]) {
  assert.ok(node.atomIds.every(id=>permuted.atoms.some(atom=>atom.id===id)));
  assert.ok(node.bondIds.every(([a,b])=>permuted.bonds.some(([x,y])=>a===x&&b===y||a===y&&b===x)));
 }
 assert.ok(cf3.atomIds.every(id=>ring.atomIds.includes(id)));
});
test('individual identical N branches are not assigned arbitrary identities',()=>{
 const f=fixtures.find(([id])=>id==='N,N-dimethyl phenylpropylamine');
 const graph=moleculeFromSmiles(f[2]).molecule;
 assert.ok(matchAcyclicArylAmine(f[1],graph));
 const branches=mapAcyclicArylAmineEvidence(f[1],graph).substituents.filter(node=>node.kind==='n-alkyl');
 assert.equal(branches.length,1);assert.equal(branches[0].multiplicity,2);assert.deepEqual([...branches[0].atomIds].sort(),[1,3]);
});
test('wrong structure, locants, groups, charge and specified stereochemistry cannot match',()=>{
 const molecule=moleculeFromSmiles(fixtures[0][2]).molecule;
 for(const name of ['N-methyl-2-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine','N-methyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine','N-methyl-3-phenyl-3-[3-(trifluoromethyl)phenoxy]propan-1-amine','N-methyl-3-phenyl-3-phenoxypropan-1-amine'])assert.equal(matchAcyclicArylAmine(name,molecule),null,name);
 for(const bad of ['N,N-methyl-3-phenylpropan-1-amine','N-methyl-9-phenylpropan-1-amine','N-methyl-3-phenylpropan-1-aminejunk'])assert.equal(parseAcyclicArylAmine(bad),null,bad);
 const charged=structuredClone(molecule);charged.atoms.find(a=>a.element==='N').charge=1;assert.equal(matchAcyclicArylAmine(fixtures[0][1],charged),null);
 const stereo=structuredClone(molecule);stereo.atoms.find(a=>a.id===4).tetrahedralParity='R';assert.equal(matchAcyclicArylAmine(fixtures[0][1],stereo),null);
});
