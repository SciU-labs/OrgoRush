import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { moleculeFromSmiles, moleculeToSmiles } from '../app/openchemlib-adapter.ts';
import { reconcileSystematicName, validatedNameTargets } from '../app/validated-name-derivation.ts';
import { parseAdditionalSystematicFamily } from '../app/systematic-family-grammar.ts';
import { buildValidatedPriorityReasoning } from '../app/reasoning-derivation-adapter.ts';
import { resolveDerivationConsistency } from '../app/derivation-consistency.ts';

const { records } = JSON.parse(readFileSync(new URL('./fixtures/b50-pubchem-rings.json', import.meta.url)));
export const acceptance = [
  [326,'4-(1-metiletil)benzaldehído','4-(1-methylethyl)benzaldehyde','aldehyde'],
  [7455,'4-metilbenzoato de metilo','methyl 4-methylbenzoate','ester'],
  [7813,'4-metilanilina','4-methylaniline','amine'],
  [69274,'4-metilbenzamida','4-methylbenzamide','amide'],
  [7724,'4-metilbenzonitrilo','4-methylbenzonitrile','nitrile'],
  [1254,'5-metil-2-(1-metiletil)ciclohexanol','5-methyl-2-(1-methylethyl)cyclohexanol','alcohol'],
  [11419,'2-metilciclohexanona','2-methylcyclohexanone','ketone'],
  [7439,'2-metil-5-(prop-1-en-2-il)ciclohex-2-en-1-ona','2-methyl-5-(prop-1-en-2-yl)cyclohex-2-en-1-one','ketone'],
];
const graphFor = cid => {
  const result = moleculeFromSmiles(records.find(r => r.cid === cid).smiles);
  assert.ok(result.ok, result.error); return result.molecule;
};
const edgeKey = ([a,b]) => [a,b].sort((a,b)=>a-b).join(':');
const clone = graph => structuredClone(graph);

for (const [cid,es,en,group] of acceptance) test(`B6 compositional acceptance ${cid}: exact active ES/EN proofs`, () => {
  const graph = graphFor(cid), snapshot = JSON.stringify(graph);
  for (const language of ['es','en','es','en']) {
    const name = language === 'es' ? es : en;
    const result = resolveDerivationConsistency({molecule:graph,activeName:name,language,activeProfile:'current',currentSourceName:en});
    const proof = result.derivation;
    assert.equal(result.status,'verified'); assert.equal(proof?.name,name); assert.equal(result.otherEvidence,null);
    assert.equal(proof.status,'FULL'); assert.equal(proof.preferred,false); assert.equal(proof.principalGroup,group);
    assert.equal(proof.evidence.source,'active-name'); assert.equal(proof.evidence.language,language);
    assert.equal(proof.evidence.equivalence,'complete-graph-isomorphism');
    assert.equal(proof.evidence.atomMapping.length,graph.atoms.length);
    assert.equal(new Set(proof.evidence.atomMapping.map(([,id])=>id)).size,graph.atoms.length);
    assert.ok(proof.evidence.numbering.comparison<=0);
    assert.ok(proof.evidence.rules.every(rule=>rule.id.startsWith('P-') && rule.source.startsWith('https://iupac.qmul.ac.uk/BlueBook/')));
    const targets = Object.values(validatedNameTargets(proof));
    assert.deepEqual(new Set(targets.flatMap(t=>t.atomIds)),new Set(graph.atoms.map(a=>a.id)));
    assert.deepEqual(new Set(targets.flatMap(t=>t.bondIds.map(edgeKey))),new Set(graph.bonds.map(edgeKey)));
    for (const component of proof.components) {
      assert.equal(name.slice(component.start,component.end),component.text);
      assert.equal(component.language,language);
      assert.ok(component.atomIds.every(id=>graph.atoms.some(a=>a.id===id)));
    }
    const model = buildValidatedPriorityReasoning({derivation:proof,graph,language});
    assert.ok(model.steps.some(s=>s.componentIds.includes('parent')));
    assert.ok(model.steps.some(s=>s.componentIds.includes('suffix')));
    assert.ok(model.steps.some(s=>s.componentIds.includes('prefix-0')));
    for (const step of model.steps) for (const target of Object.values(step.fragmentTargets)) {
      assert.ok(target.atomIds.every(id=>graph.atoms.some(a=>a.id===id)));
      assert.ok(target.bondIds.every(pair=>graph.bonds.some(edge=>edgeKey(edge)===edgeKey(pair))));
    }
    for(const step of model.steps)for(const fragment of step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]) {
      assert.equal(name.slice(fragment.start,fragment.start+fragment.text.length),fragment.text,'every new control has a literal source span');
      assert.equal(fragment.language,language);assert.ok(fragment.numberingScope);
      if(fragment.semanticId?.startsWith('branch-locant:')) {
        const branch=proof.components.find(c=>c.id===fragment.numberingScope);
        assert.ok(branch.atomIds.includes(fragment.atomIds[0]),'internal locant selects a branch atom');
        assert.ok(!proof.parentAtomIds.includes(fragment.atomIds[0]),'internal locant never selects a ring carbon');
      }
    }
    if(cid===7439) {
      const unsaturations=proof.components.filter(c=>c.role==='unsaturation');
      assert.equal(unsaturations.length,2,'ring and branch C=C bonds have distinct literal evidence');
      assert.equal(new Set(unsaturations.flatMap(c=>c.bondIds.map(edgeKey))).size,2);
      assert.equal(proof.evidence.reconstructedGraph.bonds.filter(([, ,o])=>o===2).length,3);
      const alphabetic=model.steps.find(step=>step.alphabeticalOrder)?.alphabeticalOrder;
      assert.equal(alphabetic.fragment,language==='en'?'methyl → prop-1-en-2-yl':'metil → prop-1-en-2-il',
        'alphabetic reasoning uses the exact active name, not a historical synonym from the generator');
    }
    assert.equal(JSON.stringify(graph),snapshot,'language and reasoning never mutate the input graph');
  }
});

test('B6 retained parents reject wrong retained functions, regioisomers and prefix priorities', () => {
  for (const [cid,es,en] of acceptance.slice(0,5)) {
    const graph = graphFor(cid);
    for (const name of [es,en]) {
      assert.equal(reconcileSystematicName(graph,name.replace('4-','2-')),null);
      assert.equal(reconcileSystematicName(graph,name.replace('4-','3-')),null);
      assert.equal(reconcileSystematicName(graph,name.replace('4-','5-')),null);
      assert.equal(reconcileSystematicName(graph,`(R)-${name}`),null);
    }
  }
  for (const [smiles,name] of [
    ['Cc1ccc([N+](=O)[O-])cc1','4-methylaniline'],
    ['Cc1ccc(C=O)cc1','4-methylbenzamide'],
    ['Cc1ccc(C=N)cc1','4-methylbenzonitrile'],
    ['Cc1ccc(N#C)cc1','4-methylbenzonitrile'],
    ['Oc1ccc(N)cc1','4-hydroxyaniline'],
    ['Nc1ccc(N)cc1','4-aminoaniline'],
  ]) {
    const graph=moleculeFromSmiles(smiles);
    if(graph.ok) assert.equal(reconcileSystematicName(graph.molecule,name),null,`${name}: ${smiles}`);
    else assert.ok(smiles.includes('N#C'),'invalid isonitrile valence also fails closed at import');
  }
});

for (const [cid,es,en] of acceptance) test(`B6 adversarial graph edits and representation invariance ${cid}`, () => {
  const graph=graphFor(cid), mapping=new Map(graph.atoms.map((a,i)=>[a.id,900-i*13]));
  const permuted={...graph,atoms:[...graph.atoms].reverse().map(a=>({...a,id:mapping.get(a.id),x:-a.y+13,y:a.x-11})),
    bonds:[...graph.bonds].reverse().map(([a,b,...rest])=>[mapping.get(b),mapping.get(a),...rest]),rings:[]};
  for(const name of [es,en]) {
    assert.ok(reconcileSystematicName(permuted,name),'IDs, edge direction/order, rotation and absent ring metadata are irrelevant');
    const exported=moleculeToSmiles(permuted); assert.ok(exported.ok,exported.error);
    const reimported=moleculeFromSmiles(exported.smiles); assert.ok(reimported.ok,reimported.error);
    assert.ok(reconcileSystematicName(reimported.molecule,name),'SMILES export/import preserves the proof');
    const missing=clone(graph); missing.atoms.pop(); missing.bonds=missing.bonds.filter(([a,b])=>missing.atoms.some(x=>x.id===a)&&missing.atoms.some(x=>x.id===b));
    assert.equal(reconcileSystematicName(missing,name),null);
    const charged=clone(graph); charged.atoms[0].charge=1;
    assert.equal(reconcileSystematicName(charged,name),null);
    const stereo=clone(graph); stereo.atoms[0].tetrahedralParity='R';
    assert.equal(reconcileSystematicName(stereo,name),null);
    const isotope=clone(graph); isotope.atoms[0].isotope=13;
    assert.equal(reconcileSystematicName(isotope,name),null);
    const added=clone(graph), id=Math.max(...graph.atoms.map(a=>a.id))+100;
    added.atoms.push({id,element:'C',x:0,y:0});added.bonds.push([graph.atoms[0].id,id,1]);
    assert.equal(reconcileSystematicName(added,name),null);
    const hetero=clone(graph);hetero.atoms.find(a=>a.element==='O'||a.element==='N').element='S';
    assert.equal(reconcileSystematicName(hetero,name),null);
    const proof=reconcileSystematicName(graph,name);
    const functional=proof.components.find(c=>c.id==='suffix');
    const special=graph.bonds.find(([a,b,o])=>o>1 && functional.atomIds.includes(a) && functional.atomIds.includes(b));
    if(special) {
      const changed=clone(graph);changed.bonds.find(edge=>edgeKey(edge)===edgeKey(special))[2]=1;
      assert.equal(reconcileSystematicName(changed,name),null);
    }
  }
});

test('B6 cyclic grammar rejects unjustified numbering, syntax and scope changes', () => {
  for(const name of [
    '5-methyl-2-(1-methylethyl)cyclohexan-2-ol',
    '2-(1-methylethyl)-5-methylcyclohexanol',
    '3-methyl-6-(1-methylethyl)cyclohexanol',
    '6-methylcyclohexanone','2,2-methylcyclohexanone',
    '2-(1-methylethenyl)-5-methylcyclohex-5-en-1-one',
    '2-methyl-5-((1-methylethenyl))cyclohex-2-en-1-one',
    '2-metil-5-(1-methylethenyl)ciclohex-2-en-1-ona',
    '2-hydroxycyclohexanone','2-phenylcyclohexanone',
  ]) assert.equal(parseAdditionalSystematicFamily(name),null,name);
  const carvone=graphFor(7439);
  for(const name of ['2-methyl-5-(1-methylethyl)cyclohex-2-en-1-one',
    '2-methyl-5-(1-methylethenyl)cyclohexanone',
    '2-methyl-4-(1-methylethenyl)cyclohex-2-en-1-one'])
    assert.equal(reconcileSystematicName(carvone,name),null,name);
});
