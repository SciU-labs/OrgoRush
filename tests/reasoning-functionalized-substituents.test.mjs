import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {loadExerciseChemistry} from './helpers/exercise-chemistry.mjs';
import {analyzeBoth,displayedProfiles} from '../scripts/naming-audit/evaluate.mjs';
import {moleculeFromSmiles} from '../app/openchemlib-adapter.ts';
import {buildReasoningVisualReferences,reasoningFragmentId} from '../app/reasoning-visual-targets.ts';
import {parseParenthesizedScopes} from '../app/reasoning-functionalized-substituents.ts';
import {reconcileSystematicName} from '../app/validated-name-derivation.ts';
import {assertReasoningIntegrity} from './helpers/reasoning-integrity.mjs';
import {structuralIdentity} from './helpers/reference-corpus.mjs';
import {inspectSmilesStructure} from '../app/openchemlib-adapter.ts';

let chemistry;
before(async()=>{chemistry=await loadExerciseChemistry()});
after(async()=>{await chemistry?.close()});
const key=([a,b])=>[a,b].sort((x,y)=>x-y).join(':');
const examples=[
  ['O=C(O)C(CCO)CCO','ácido 4-hidroxi-2-(2-hidroxietil)butanoico','4-hydroxy-2-(2-hydroxyethyl)butanoic acid',[4,8,9,10],[[4,8],[8,9],[9,10]],[9,10]],
  ['O=C(O)C(CCN)CCC','ácido 2-(2-aminoetil)pentanoico','2-(2-aminoethyl)pentanoic acid',[4,5,6,7],[[4,5],[5,6],[6,7]],[6,7]],
  ['O=C(O)C(CC(=O)C)CCCC','ácido 2-(2-oxopropil)hexanoico','2-(2-oxopropyl)hexanoic acid',[4,5,6,7,8],[[4,5],[5,6],[6,7],[6,8]],[6,7]],
];
function permute(g){const map=new Map(g.atoms.map((a,i)=>[a.id,2000+i*13]));return {map,graph:{...g,
  atoms:[...g.atoms].reverse().map(a=>({...a,id:map.get(a.id),x:-a.y,y:a.x})),
  bonds:[...g.bonds].reverse().map(([a,b,...rest])=>[map.get(b),map.get(a),...rest])}}}
function targetFor(model,refs,keyName){
  for(const [step,value] of Object.entries(model.fragments))for(const part of [value,...(value.additionalFragments??[])])
    if(part.semanticId===`functionalized:${keyName}`)return {part,target:refs.fragments[reasoningFragmentId(step,part)]};
  assert.fail(`missing ${keyName}`);
}
test('parenthesized syntax keeps explicit nested scope and rejects unbalanced input',()=>{
  assert.deepEqual(parseParenthesizedScopes('2-(2-(x)y)z'),[{span:{start:2,end:10},children:[{span:{start:5,end:8},children:[]}]}]);
  assert.equal(parseParenthesizedScopes('2-(x'),null);
  assert.equal(parseParenthesizedScopes('2-x)'),null);
});
test('functionalized branch controls use exact graph regions and independent numbering in both languages',()=>{
  for(const [smiles,es,en,branch,bonds,func] of examples){
    const input=moleculeFromSmiles(smiles);assert.equal(input.ok,true);
    const p=permute(input.molecule);
    for(const [graph,map] of [[input.molecule,new Map(input.molecule.atoms.map(a=>[a.id,a.id]))],[p.graph,p.map]]){
      const analyses=analyzeBoth(graph,chemistry.engine), profiles=displayedProfiles(graph,analyses,chemistry.engine);
      for(const [profile,name] of [['2013-es',es],['2013-en',en]]){
        const selection=profiles[profile];assert.equal(selection.name,name);
        const model=chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,...selection,displayedName:name,
          generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
        assertReasoningIntegrity(model,graph);
        const refs=buildReasoningVisualReferences({molecule:graph,analysis:analyses.current,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
        const full=targetFor(model,refs,'complete'), group=targetFor(model,refs,'function');
        // In the symmetric first graph either hydroxyethyl arm can be the
        // parent. The independent expected regions account for both choices.
        const alternative=smiles===examples[0][0] && full.target?.atomIds.includes(map.get(5));
        const expectedBranch=alternative?[4,5,6,7]:branch;
        const expectedBonds=alternative?[[4,5],[5,6],[6,7]]:bonds;
        const expectedFunction=alternative?[6,7]:func;
        assert.ok(full.target&&group.target,name);
        assert.deepEqual([...full.target.atomIds].sort((a,b)=>a-b),expectedBranch.map(id=>map.get(id)).sort((a,b)=>a-b));
        assert.deepEqual(full.target.bondIds.map(key).sort(),expectedBonds.map(pair=>key(pair.map(id=>map.get(id)))).sort());
        assert.deepEqual([...group.target.atomIds].sort((a,b)=>a-b),expectedFunction.map(id=>map.get(id)).sort((a,b)=>a-b));
        assert.deepEqual(group.target.bondIds.map(key),[key(expectedFunction.map(id=>map.get(id)))]);
        const parent=targetFor(model,refs,'parent'), parentLocant=targetFor(model,refs,'parent-locant'), localLocant=targetFor(model,refs,'local-locant');
        assert.deepEqual(new Set(parent.target.atomIds),new Set(analyses.current.mainChain));
        assert.deepEqual(parentLocant.target.atomIds,[map.get(4)]);
        assert.deepEqual(localLocant.target.atomIds,[map.get(expectedFunction[0])]);
        assert.deepEqual(localLocant.target.locants,[[map.get(expectedFunction[0]),2]]);
        assert.equal(parentLocant.part.structuralContext.numberingScope,'parent');
        assert.equal(localLocant.part.structuralContext.numberingScope,'substituent');
        assert.equal(localLocant.part.structuralContext.locant,2);
        assert.deepEqual(localLocant.part.structuralContext.attachment,[map.get(4),map.get(expectedBranch[1])]);
        assert.ok(targetFor(model,refs,'skeleton').target);
        if(smiles===examples[0][0]) {
          const other=alternative?[9,10]:[6,7], target=targetFor(model,refs,'parent-function-4').target;
          assert.deepEqual([...target.atomIds].sort((a,b)=>a-b),other.map(id=>map.get(id)).sort((a,b)=>a-b));
          assert.deepEqual(target.bondIds.map(key),[key(other.map(id=>map.get(id)))]);
        }
        for(const part of [full.part,group.part,parent.part,parentLocant.part,localLocant.part])
          assert.equal(name.slice(part.start,part.start+part.text.length),part.text);
        assert.equal(reconcileSystematicName(graph,en),null,'no automatic FULL');
      }
    }
  }
});
test('stale branch evidence and unsupported triol never create these controls',()=>{
  for(const smiles of ['OCCC(CO)CCCCO','O=C(O)C(CCN)CCC']){
    const {molecule}=moleculeFromSmiles(smiles),analyses=analyzeBoth(molecule,chemistry.engine);
    if(smiles.startsWith('OCCC'))assert.equal(chemistry.engine.localNamerCannotSafelyName(molecule,analyses.current),true);
    else {const branch=analyses.current.substituents.find(s=>s.aminoAlkyl);branch.aminoAlkyl.amino.locant=3;}
    const m=chemistry.engine.buildActiveIupacReasoning({molecule,analyses,language:'es',convention:'current',
      displayedName:analyses.current.name,generatedNames:[analyses.current.name],canHighlight:true});
    assert.ok(!Object.values(m.fragments).some(f=>f.semanticId?.startsWith('functionalized:')));
  }
  const {molecule}=moleculeFromSmiles('O=C(O)C(CCN)CCC'),analyses=analyzeBoth(molecule,chemistry.engine);
  const terminal=analyses.current.mainChain.at(-1),id=Math.max(...molecule.atoms.map(a=>a.id))+100;
  const changed={...molecule,atoms:[...molecule.atoms,{id,x:0,y:0}],bonds:[...molecule.bonds,[terminal,id,1]]};
  const model=chemistry.engine.buildActiveIupacReasoning({molecule:changed,analyses,language:'es',convention:'current',
    displayedName:analyses.current.name,generatedNames:[analyses.current.name],canHighlight:true});
  assert.ok(!Object.values(model.fragments).some(f=>f.semanticId?.startsWith('functionalized:')),'unchanged branch with changed parent stays unavailable');
});

test('aldehyde and ketone parents preserve independent carbonyl and functionalized branch targets',()=>{
  // OPSIN SUCCESS SMILES frozen independently from the displayed names.
  const rows=[
    ['O=CC(CCO)CCO','OCCC(C=O)CCO','4-hidroxi-2-(2-hidroxietil)butanal','4-hydroxy-2-(2-hydroxyethyl)butanal','C6H12O3','aldehyde'],
    ['O=CC(CCN)CCC','NCCC(C=O)CCC','2-(2-aminoetil)pentanal','2-(2-aminoethyl)pentanal','C7H15NO','aldehyde'],
    ['CC(=O)C(CCN)CCC','NCCC(C(C)=O)CCC','3-(2-aminoetil)hexan-2-ona','3-(2-aminoethyl)hexan-2-one','C8H17NO','ketone'],
    ['O=CC(CC(=O)C)CCCC','O=C(CC(C=O)CCCC)C','2-(2-oxopropil)hexanal','2-(2-oxopropyl)hexanal','C9H16O2','aldehyde'],
    ['CC(=O)C(CCO)CCC','OCCC(C(C)=O)CCC','3-(2-hidroxietil)hexan-2-ona','3-(2-hydroxyethyl)hexan-2-one','C8H16O2','ketone'],
  ];
  for(const [smiles,reference,es,en,formula,principalKind] of rows){
    assert.equal(structuralIdentity(smiles),structuralIdentity(reference),en);
    for(const source of [smiles,reference]){
      assert.equal(inspectSmilesStructure(source).formula,formula);
      const parsed=moleculeFromSmiles(source);assert.equal(parsed.ok,true);
      for(const graph of [parsed.molecule,permute(parsed.molecule).graph]){
        const analyses=analyzeBoth(graph,chemistry.engine), profiles=displayedProfiles(graph,analyses,chemistry.engine),analysis=analyses.current;
        assert.equal(analysis.primaryFunctionalGroup,principalKind);
        const branch=analysis.substituents.find(s=>s.hydroxyAlkyl||s.aminoAlkyl||s.oxoAlkyl);
        assert.ok(branch,source);
        const proof=branch.hydroxyAlkyl??branch.aminoAlkyl??branch.oxoAlkyl;
        const func=proof.hydroxy??proof.amino??proof.oxo,hetero=func.oxygenId??func.nitrogenId;
        const principal=analysis.functionalGroups.find(g=>g.kind===principalKind&&analysis.mainChain.includes(g.carbonId));
        for(const [profile,name] of [['2013-es',es],['2013-en',en]]){
          const selection=profiles[profile];assert.equal(selection.name,name,source);
          const model=chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,...selection,displayedName:name,
            generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
          assertReasoningIntegrity(model,graph);
          const refs=buildReasoningVisualReferences({molecule:graph,analysis,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
          const get=k=>targetFor(model,refs,k).target;
          assert.deepEqual(new Set(get('parent').atomIds),new Set(analysis.mainChain));
          const parentEdges=graph.bonds.filter(([a,b])=>analysis.mainChain.includes(a)&&analysis.mainChain.includes(b));
          assert.deepEqual(get('parent').bondIds.map(key).sort(),parentEdges.map(key).sort());
          assert.deepEqual(new Set(get('principal').atomIds),new Set(principal.atomIds));
          assert.deepEqual(get('principal').bondIds.map(key),[key([principal.carbonId,principal.heteroAtomId])]);
          assert.deepEqual(new Set(get('complete').atomIds),new Set([proof.parentAtomId,...proof.atomIds]));
          assert.deepEqual(get('complete').bondIds.map(key).sort(),proof.bonds.map(key).sort());
          assert.deepEqual(new Set(get('skeleton').atomIds),new Set(proof.carbonPath));
          assert.deepEqual(get('skeleton').bondIds.map(key).sort(),proof.bonds.filter(([a,b])=>
            proof.carbonPath.includes(a)&&proof.carbonPath.includes(b)).map(key).sort());
          assert.deepEqual(new Set(get('function').atomIds),new Set([func.carbonId,hetero]));
          assert.deepEqual(get('function').bondIds.map(key),[key([func.carbonId,hetero])]);
          assert.deepEqual(get('attachment').bondIds.map(key),[key([proof.parentAtomId,proof.rootAtomId])]);
          assert.deepEqual(get('local-locant').locants,[[func.carbonId,func.locant]]);
          assert.deepEqual(get('parent-locant').locants,[[proof.parentAtomId,branch.locant]]);
          if(principalKind==='ketone')assert.deepEqual(get('principal-locant').locants,[[principal.carbonId,2]]);
          assert.equal(reconcileSystematicName(graph,en),null,'interactive evidence does not imply FULL');
        }
      }
    }
  }
});

test('a functionalized substituent with one internal methyl branch is graph-backed in both languages',()=>{
  const rows=[
    ['O=C(O)C(C(CO)C)CCCC','O=C(O)C(CCCC)C(C)CO','ácido 2-(2-hidroxi-1-metiletil)hexanoico',
      '2-(2-hydroxy-1-methylethyl)hexanoic acid','C9H18O3','carboxylicAcid',2],
    ['O=CC(C(CN)C)CCCC','O=CC(CCCC)C(C)CN','2-(2-amino-1-metiletil)hexanal',
      '2-(2-amino-1-methylethyl)hexanal','C9H19NO','aldehyde',2],
    ['CC(=O)C(C(CO)C)CCCC','CC(=O)C(CCCC)C(C)CO','3-(2-hidroxi-1-metiletil)heptan-2-ona',
      '3-(2-hydroxy-1-methylethyl)heptan-2-one','C10H20O2','ketone',3],
  ];
  for(const [source,alternate,es,en,formula,principalKind,parentLocant] of rows){
    assert.equal(structuralIdentity(source),structuralIdentity(alternate),en);
    assert.equal(inspectSmilesStructure(source).formula,formula,en);
    for(const smiles of [source,alternate]){
      const parsed=moleculeFromSmiles(smiles);assert.equal(parsed.ok,true,smiles);
      const permuted=permute(parsed.molecule);
      for(const [graph,map] of [[parsed.molecule,new Map(parsed.molecule.atoms.map(a=>[a.id,a.id]))],[permuted.graph,permuted.map]]){
        const analyses=analyzeBoth(graph,chemistry.engine),analysis=analyses.current,profiles=displayedProfiles(graph,analyses,chemistry.engine);
        assert.equal(analysis.formula.replace(/[₀-₉]/g,d=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(d)),formula,smiles);
        const branch=analysis.substituents.find(item=>item.hydroxyAlkyl||item.aminoAlkyl||item.oxoAlkyl);
        assert.ok(branch,smiles);
        const proof=branch.hydroxyAlkyl??branch.aminoAlkyl??branch.oxoAlkyl;
        assert.equal(analysis.primaryFunctionalGroup,principalKind);
        assert.equal(branch.locant,parentLocant);
        assert.equal(proof.internalBranches.length,1);
        assert.equal(proof.internalBranches[0].kind,'methyl');
        assert.deepEqual(proof.carbonPath.map((id,index)=>proof.numbering[index][1]),proof.carbonPath.map((_,index)=>index+1));
        assert.equal(proof.internalBranches[0].locant,1);
        assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,analysis),false,smiles);
        assert.equal(analysis.name,es);
        for(const [profile,name] of [['2013-es',es],['2013-en',en]]){
          const selection=profiles[profile];assert.equal(selection.name,name,profile);
          const model=chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,...selection,displayedName:name,
            generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
          assertReasoningIntegrity(model,graph);
          const refs=buildReasoningVisualReferences({molecule:graph,analysis,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
          const get=keyName=>targetFor(model,refs,keyName).target;
          const functionEvidence=branch.hydroxyAlkyl?proof.hydroxy:branch.aminoAlkyl?proof.amino:proof.oxo;
          const heteroId=functionEvidence.oxygenId??functionEvidence.nitrogenId;
          const principal=analysis.functionalGroups.find(group=>group.kind===principalKind&&analysis.mainChain.includes(group.carbonId));
          assert.deepEqual(new Set(get('parent').atomIds),new Set(analysis.mainChain));
          assert.deepEqual(new Set(get('principal').atomIds),new Set(principal.atomIds));
          assert.deepEqual(get('principal').bondIds.map(key).sort(),graph.bonds
            .filter(([a,b])=>principal.atomIds.includes(a)&&principal.atomIds.includes(b)).map(key).sort());
          assert.deepEqual(new Set(get('complete').atomIds),new Set([proof.parentAtomId,...proof.atomIds]));
          assert.deepEqual(get('complete').bondIds.map(key).sort(),proof.bonds.map(key).sort());
          assert.deepEqual(new Set(get('skeleton').atomIds),new Set(proof.carbonPath));
          assert.deepEqual(get('skeleton').bondIds.map(key).sort(),proof.bonds.filter(([a,b])=>proof.carbonPath.includes(a)&&proof.carbonPath.includes(b)).map(key).sort());
          const internalEvidence=targetFor(model,refs,'internal-branch'),internal=internalEvidence.target,carbonBranch=proof.internalBranches[0];
          assert.equal(internalEvidence.part.label,profile.endsWith('en')?'Internal methyl branch':'Ramificación metilo interna');
          assert.equal(name.slice(internalEvidence.part.start,internalEvidence.part.start+internalEvidence.part.text.length),internalEvidence.part.text);
          assert.deepEqual(new Set(internal.atomIds),new Set([carbonBranch.anchorAtomId,...carbonBranch.atomIds]));
          assert.deepEqual(internal.bondIds.map(key),carbonBranch.bonds.map(key));
          assert.deepEqual(new Set(get('function').atomIds),new Set([functionEvidence.carbonId,heteroId]));
          assert.deepEqual(get('function').bondIds.map(key),[key([functionEvidence.carbonId,heteroId])]);
          assert.deepEqual(get('attachment').bondIds.map(key),[key([proof.parentAtomId,proof.rootAtomId])]);
          assert.deepEqual(get('parent-locant').locants,[[proof.parentAtomId,parentLocant]]);
          assert.deepEqual(get('branch-locant').locants,[[carbonBranch.anchorAtomId,1]]);
          assert.deepEqual(get('local-locant').locants,[[functionEvidence.carbonId,functionEvidence.locant]]);
          const branchLocantEvidence=targetFor(model,refs,'branch-locant');
          assert.equal(branchLocantEvidence.part.label,profile.endsWith('en')?'Internal branch locant':'Localizador de la ramificación interna');
          assert.equal(branchLocantEvidence.part.structuralContext.numberingScope,'substituent');
          assert.equal(reconcileSystematicName(graph,en),null,'this graph evidence is PARTIAL, not a FULL name reconciliation');
        }
      }
    }
  }
});

test('internal-branch evidence is invalidated by stale locants, edited edges and omitted functions',()=>{
  const parsed=moleculeFromSmiles('O=C(O)C(C(CO)C)CCCC');assert.equal(parsed.ok,true);
  const graph=parsed.molecule,analysis=chemistry.engine.analyzeMolecule(graph);
  const item=analysis.substituents.find(entry=>entry.hydroxyAlkyl),proof=item.hydroxyAlkyl;
  const altered={...item,hydroxyAlkyl:{...proof,internalBranches:proof.internalBranches.map(branch=>({...branch,locant:3}))}};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,{...analysis,
    substituents:analysis.substituents.map(entry=>entry===item?altered:entry)}),true,'changed internal branch locant');
  const [methylId]=proof.internalBranches[0].atomIds,anchorId=proof.internalBranches[0].anchorAtomId;
  const removedBranchEdge={...graph,bonds:graph.bonds.filter(([a,b])=>!((a===methylId&&b===anchorId)||(b===methylId&&a===anchorId)))};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(removedBranchEdge,analysis),true,'stale branch edge');
  const hydroxyId=proof.hydroxy.oxygenId,carbonId=proof.hydroxy.carbonId;
  const removedFunctionEdge={...graph,bonds:graph.bonds.filter(([a,b])=>!((a===hydroxyId&&b===carbonId)||(b===hydroxyId&&a===carbonId)))};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(removedFunctionEdge,analysis),true,'omitted secondary function');
});

test('an oxo group chosen on the parent is not reclassified as an oxoalkyl branch',()=>{
  const {molecule}=moleculeFromSmiles('O=CC(CC(=O)C)CCC'),analysis=chemistry.engine.analyzeMolecule(molecule);
  assert.equal(analysis.name,'4-oxo-2-propilpentanal');
  assert.ok(analysis.functionalGroups.some(g=>g.kind==='ketone'&&analysis.mainChain.includes(g.carbonId)));
  assert.ok(!analysis.substituents.some(s=>s.oxoAlkyl));
});

test('a changed formula, principal carbonyl or locant invalidates the functionalized reasoning',()=>{
  const {molecule}=moleculeFromSmiles('CC(=O)C(CCN)CCC');
  const run=(graph,analyses)=>chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,
    language:'es',convention:'current',displayedName:analyses.current.name,generatedNames:[analyses.current.name],canHighlight:true});
  const assertUnavailable=model=>assert.ok(!Object.values(model.fragments).some(f=>f.semanticId?.startsWith('functionalized:')));
  const badFormula=analyzeBoth(molecule,chemistry.engine);badFormula.current.formula='C999H1';assertUnavailable(run(molecule,badFormula));
  const old=analyzeBoth(molecule,chemistry.engine), principal=old.current.functionalGroups.find(g=>g.kind==='ketone');
  const altered={...molecule,bonds:molecule.bonds.map(([a,b,...rest])=>
    a===principal.carbonId&&b===principal.heteroAtomId||b===principal.carbonId&&a===principal.heteroAtomId ? [a,b,1] : [a,b,...rest])};
  assertUnavailable(run(altered,old));
  const badNumbering=analyzeBoth(molecule,chemistry.engine);badNumbering.current.numberedAtoms.set(principal.carbonId,4);
  assertUnavailable(run(molecule,badNumbering));
});

test('two independently supported hydroxy/amino branches retain separate graph evidence in both languages',()=>{
  // OPSIN independently parses these complete English names to the listed equivalent graphs.
  const rows=[
    ['O=C(O)C(CCO)(CCN)CCC','NCCC(C(=O)O)(CCC)CCO','O=C(O)C(CCN)(CCO)CCC',
      'ácido 2-(2-aminoetil)-2-(2-hidroxietil)pentanoico','2-(2-aminoethyl)-2-(2-hydroxyethyl)pentanoic acid','C9H19NO3','carboxylicAcid'],
    ['O=CC(CCO)(CCN)CCC','NCCC(C=O)(CCC)CCO','O=CC(CCN)(CCO)CCC',
      '2-(2-aminoetil)-2-(2-hidroxietil)pentanal','2-(2-aminoethyl)-2-(2-hydroxyethyl)pentanal','C9H19NO2','aldehyde'],
    ['CC(=O)C(CCO)(CCN)CCC','NCCC(C(C)=O)(CCC)CCO','CC(=O)C(CCN)(CCO)CCC',
      '3-(2-aminoetil)-3-(2-hidroxietil)hexan-2-ona','3-(2-aminoethyl)-3-(2-hydroxyethyl)hexan-2-one','C10H21NO2','ketone'],
  ];
  const targetBySemantic=(model,refs,semanticId)=>{
    for(const [step,value] of Object.entries(model.fragments))for(const part of [value,...(value.additionalFragments??[])])
      if(part.semanticId===semanticId)return {part,target:refs.fragments[reasoningFragmentId(step,part)]};
    assert.fail(`missing ${semanticId}`);
  };
  for(const [source,opsin,swapped,es,en,formula,principalKind] of rows){
    assert.equal(structuralIdentity(source),structuralIdentity(opsin),en);
    assert.equal(inspectSmilesStructure(source).formula,formula);
    for(const smiles of [source,opsin,swapped]){
      const parsed=moleculeFromSmiles(smiles);assert.equal(parsed.ok,true);
      const permutation=permute(parsed.molecule);
      for(const graph of [parsed.molecule,permutation.graph]){
        const analyses=analyzeBoth(graph,chemistry.engine),analysis=analyses.current;
        assert.equal(analysis.formula.replace(/[₀-₉]/g,d=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(d)),formula);
        assert.equal(analysis.primaryFunctionalGroup,principalKind);
        assert.equal(analysis.substituents.filter(s=>s.hydroxyAlkyl||s.aminoAlkyl||s.oxoAlkyl).length,2);
        const profiles=displayedProfiles(graph,analyses,chemistry.engine);
        for(const [profile,name] of [['2013-es',es],['2013-en',en]]){
          const selection=profiles[profile];assert.equal(selection.name,name);
          const model=chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,...selection,displayedName:name,
            generatedNames:Object.values(profiles).map(p=>p.name).filter(Boolean),canHighlight:true});
          assertReasoningIntegrity(model,graph);
          const refs=buildReasoningVisualReferences({molecule:graph,analysis,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
          const scopes=parseParenthesizedScopes(name);assert.equal(scopes.length,2);assert.ok(scopes.every(scope=>scope.children.length===0));
          const branchItems=analysis.substituents.filter(s=>s.hydroxyAlkyl||s.aminoAlkyl||s.oxoAlkyl);
          const ordered=scopes.map(scope=>{
            const inner=name.slice(scope.span.start+1,scope.span.end-1),locant=Number(/(\d+)-$/.exec(name.slice(0,scope.span.start))?.[1]);
            return branchItems.find(item=>item.locant===locant
              && (profile.endsWith('en')?inner===item.name.replace('hidroxi','hydroxy').replace('etil','ethyl'):inner===item.name));
          });
          assert.ok(ordered.every(Boolean),'every name scope maps bijectively to one structural branch');
          assert.deepEqual(new Set(ordered.map(item=>`${item.locant}:${item.hydroxyAlkyl?'hydroxy':'amino'}`)).size,2);
          const internalSets=ordered.map(item=>new Set(item.hydroxyAlkyl?.atomIds??item.aminoAlkyl.atomIds));
          assert.equal([...internalSets[0]].some(id=>internalSets[1].has(id)),false,'branch internal atoms never overlap');
          for(let index=0;index<ordered.length;index++){
            const item=ordered[index],proof=item.hydroxyAlkyl??item.aminoAlkyl,func=proof.hydroxy??proof.amino;
            const hetero=func.oxygenId??func.nitrogenId,prefix=`functionalized:branch-${index+1}:`;
            const get=key=>targetBySemantic(model,refs,prefix+key).target;
            assert.deepEqual(new Set(get('complete').atomIds),new Set([proof.parentAtomId,...proof.atomIds]));
            assert.deepEqual(get('complete').bondIds.map(key).sort(),proof.bonds.map(key).sort());
            assert.deepEqual(new Set(get('skeleton').atomIds),new Set(proof.carbonPath));
            assert.deepEqual(get('skeleton').bondIds.map(key).sort(),proof.bonds.filter(([a,b])=>proof.carbonPath.includes(a)&&proof.carbonPath.includes(b)).map(key).sort());
            assert.deepEqual(new Set(get('function').atomIds),new Set([func.carbonId,hetero]));
            assert.deepEqual(get('function').bondIds.map(key),[key([func.carbonId,hetero])]);
            assert.deepEqual(get('attachment').atomIds.sort((a,b)=>a-b),[proof.parentAtomId,proof.rootAtomId].sort((a,b)=>a-b));
            assert.deepEqual(get('attachment').bondIds.map(key),[key([proof.parentAtomId,proof.rootAtomId])]);
            assert.deepEqual(get('parent-locant').locants,[[proof.parentAtomId,item.locant]]);
            assert.deepEqual(get('local-locant').locants,[[func.carbonId,func.locant]]);
            assert.equal(targetBySemantic(model,refs,prefix+'function').part.structuralContext.numberingScope,'substituent');
          }
          assert.deepEqual(new Set(targetBySemantic(model,refs,'functionalized:parent').target.atomIds),new Set(analysis.mainChain));
          assert.equal(reconcileSystematicName(graph,en),null,'interactive branch proof does not promote FULL');
        }
      }
    }
  }
});

test('equal-function, internally multi-functional, branched, unsaturated, stereo and nested branches stay outside this grammar',()=>{
  const unsupported=['O=C(O)C(CCN)(CCN)CCC','O=C(O)C(CCO)(CCO)CCC','O=C(O)C(CC(O)N)CCC',
    'O=C(O)C(C(C)(C)C(C)CO)CCCC','O=C(O)C(CC=CO)CCC','O=C(O)C(C[C@H](O)C)CCC',
    'O=C(O)C(C1CC(O)CC1)CCCC'];
  for(const smiles of unsupported){
    const parsed=moleculeFromSmiles(smiles);assert.equal(parsed.ok,true,smiles);
    const analyses=analyzeBoth(parsed.molecule,chemistry.engine),name=analyses.current.name;
    if(smiles==='O=C(O)C(C(C)(C)C(C)CO)CCCC')
      assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,analyses.current),true,'more than two internal methyl branches stay blocked');
    const model=chemistry.engine.buildActiveIupacReasoning({molecule:parsed.molecule,analyses,language:'es',convention:'current',
      displayedName:name,generatedNames:[name],canHighlight:true});
    assert.ok(!Object.values(model.fragments).flatMap(f=>[f,...(f.additionalFragments??[])]).some(f=>f.semanticId?.startsWith('functionalized:branch-')),smiles);
  }
  assert.ok(parseParenthesizedScopes('2-(2-(x)y)z')[0].children.length,'nested parenthesis depth is preserved so the renderer can reject it');
});

test('two internal methyl branches retain graph identity, numbering and equivalent-group symmetry',()=>{
  const rows=[
    {smiles:'O=C(O)C(C(C)(C)CO)CCCC',es:'ácido 2-(2-hidroxi-1,1-dimetiletil)hexanoico',
      en:'2-(2-hydroxy-1,1-dimethylethyl)hexanoic acid',formula:'C10H20O3',parentLocant:2,
      carbonPath:[5,8],branchLocants:[1,1],branchAtoms:[[5,6],[5,7]],branchBonds:[[5,6],[5,7]],function:[8,9],functionLocant:2,
      principal:[1,2,3],principalEdges:[[1,2],[2,3]],parent:[2,4,10,11,12,13]},
    {smiles:'O=C(O)C(C(C)C(C)CO)CCCC',es:'ácido 2-(3-hidroxi-1,2-dimetilpropil)hexanoico',
      en:'2-(3-hydroxy-1,2-dimethylpropyl)hexanoic acid',formula:'C11H22O3',parentLocant:2,
      carbonPath:[5,7,9],branchLocants:[1,2],branchAtoms:[[5,6],[7,8]],branchBonds:[[5,6],[7,8]],function:[9,10],functionLocant:3,
      principal:[1,2,3],principalEdges:[[1,2],[2,3]],parent:[2,4,11,12,13,14]},
    {smiles:'O=CC(C(C)(C)CN)CCCC',es:'2-(2-amino-1,1-dimetiletil)hexanal',
      en:'2-(2-amino-1,1-dimethylethyl)hexanal',formula:'C10H21NO',parentLocant:2,
      carbonPath:[4,7],branchLocants:[1,1],branchAtoms:[[4,5],[4,6]],branchBonds:[[4,5],[4,6]],function:[7,8],functionLocant:2,
      principal:[1,2],principalEdges:[[1,2]],parent:[2,3,9,10,11,12]},
  ];
  for(const row of rows){
    const {molecule,...parsed}=moleculeFromSmiles(row.smiles);assert.equal(parsed.ok,true,row.smiles);
    assert.equal(inspectSmilesStructure(row.smiles).formula,row.formula);
    const permutation=permute(molecule);
    for(const [graph,map] of [[molecule,new Map(molecule.atoms.map(atom=>[atom.id,atom.id]))],[permutation.graph,permutation.map]]){
      const analyses=analyzeBoth(graph,chemistry.engine),analysis=analyses.current,profiles=displayedProfiles(graph,analyses,chemistry.engine);
      const branch=analysis.substituents.find(item=>item.hydroxyAlkyl||item.aminoAlkyl||item.oxoAlkyl);
      assert.ok(branch,row.smiles);
      const proof=branch.hydroxyAlkyl??branch.aminoAlkyl??branch.oxoAlkyl;
      const func=proof.hydroxy??proof.amino??proof.oxo,hetero=func.oxygenId??func.nitrogenId;
      assert.equal(analysis.name,row.es);
      assert.equal(branch.locant,row.parentLocant);
      assert.deepEqual(proof.carbonPath,row.carbonPath.map(id=>map.get(id)));
      assert.deepEqual(proof.internalBranches.map(item=>item.locant),row.branchLocants);
      const actualBranches=proof.internalBranches.map(item=>[item.anchorAtomId,...item.atomIds].sort((a,b)=>a-b).join(':')).sort();
      const expectedBranches=row.branchAtoms.map(ids=>ids.map(id=>map.get(id)).sort((a,b)=>a-b).join(':')).sort();
      assert.deepEqual(actualBranches,expectedBranches);
      assert.equal(func.locant,row.functionLocant);
      assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,analysis),false,row.es);
      const principal=analysis.functionalGroups.find(group=>group.kind===analysis.primaryFunctionalGroup&&analysis.mainChain.includes(group.carbonId));
      assert.deepEqual(new Set(analysis.mainChain),new Set(row.parent.map(id=>map.get(id))));
      assert.deepEqual(new Set(principal.atomIds),new Set(row.principal.map(id=>map.get(id))));
      for(const [profile,name] of [['2013-es',row.es],['2013-en',row.en]]){
        assert.equal(profiles[profile].name,name,profile);
        const model=chemistry.engine.buildActiveIupacReasoning({molecule:graph,analyses,...profiles[profile],displayedName:name,
          generatedNames:Object.values(profiles).map(item=>item.name).filter(Boolean),canHighlight:true});
        assertReasoningIntegrity(model,graph);
        const refs=buildReasoningVisualReferences({molecule:graph,analysis,steps:model.steps,fragments:model.fragments,displayedName:name,enabled:true});
        const get=keyName=>targetFor(model,refs,keyName);
        const complete=get('complete'),internal=get('internal-branch'),skeleton=get('skeleton'),secondary=get('function');
        assert.deepEqual(new Set(complete.target.atomIds),new Set([proof.parentAtomId,...proof.atomIds]));
        assert.deepEqual(complete.target.bondIds.map(key).sort(),proof.bonds.map(key).sort());
        assert.deepEqual(new Set(internal.target.atomIds),new Set(row.branchAtoms.flat().map(id=>map.get(id))));
        assert.deepEqual(internal.target.bondIds.map(key).sort(),row.branchBonds.map(pair=>key(pair.map(id=>map.get(id)))).sort());
        assert.deepEqual(new Set(skeleton.target.atomIds),new Set(row.carbonPath.map(id=>map.get(id))));
        assert.deepEqual(new Set(secondary.target.atomIds),new Set([func.carbonId,hetero]));
        assert.deepEqual(secondary.target.bondIds.map(key),[key([func.carbonId,hetero])]);
        assert.deepEqual(get('parent-locant').target.locants,[[proof.parentAtomId,row.parentLocant]]);
        assert.deepEqual(get('local-locant').target.locants,[[func.carbonId,row.functionLocant]]);
        if(row.branchLocants[0]===row.branchLocants[1]){
          const branchLocant=get('branch-locant');
          assert.equal(branchLocant.part.label,profile.endsWith('en')?'Equivalent internal methyl locants':'Localizadores equivalentes de metilo interno');
          assert.deepEqual(branchLocant.target.locants,[[map.get(row.branchAtoms[0][0]),1]]);
          assert.deepEqual(new Set(branchLocant.target.atomIds),new Set([map.get(row.branchAtoms[0][0])]));
        }else{
          for(let i=0;i<2;i++){
            const branchLocant=get(`branch-locant-${i+1}`);
            assert.deepEqual(branchLocant.target.locants,[[map.get(row.branchAtoms[i][0]),row.branchLocants[i]]]);
          }
        }
        assert.equal(reconcileSystematicName(graph,row.en),null,'two-branch evidence must remain PARTIAL');
      }
    }
  }
});

test('two-branch admission rejects deleted, moved, relabeled and stale graph evidence',()=>{
  const parsed=moleculeFromSmiles('O=C(O)C(C(C)C(C)CO)CCCC');assert.equal(parsed.ok,true);
  const graph=parsed.molecule,analysis=chemistry.engine.analyzeMolecule(graph);
  const component=analysis.substituents.find(item=>item.hydroxyAlkyl),proof=component.hydroxyAlkyl;
  assert.equal(proof.internalBranches.length,2);
  const [first,second]=proof.internalBranches;
  const badProof={...component,hydroxyAlkyl:{...proof,internalBranches:proof.internalBranches.slice(0,1)}};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,{...analysis,
    substituents:analysis.substituents.map(item=>item===component?badProof:item)}),true,'omitted methyl proof');
  const [methyl]=first.atomIds;
  const deletedEdge={...graph,bonds:graph.bonds.filter(([a,b])=>!((a===methyl&&b===first.anchorAtomId)||(b===methyl&&a===first.anchorAtomId)))};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(deletedEdge,analysis),true,'deleted methyl edge');
  const movedEdge={...graph,bonds:graph.bonds.map(bond=>
    (bond[0]===methyl&&bond[1]===first.anchorAtomId)||(bond[1]===methyl&&bond[0]===first.anchorAtomId)
      ? [second.anchorAtomId,methyl,bond[2]??1] : bond)};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(movedEdge,analysis),true,'methyl shifted to another path carbon');
  const alteredLocant={...component,hydroxyAlkyl:{...proof,internalBranches:proof.internalBranches.map((branch,index)=>
    index===0?{...branch,locant:3}:branch)}};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,{...analysis,
    substituents:analysis.substituents.map(item=>item===component?alteredLocant:item)}),true,'altered methyl locant');
  const alteredFunction={...component,hydroxyAlkyl:{...proof,hydroxy:{...proof.hydroxy,locant:1}}};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,{...analysis,
    substituents:analysis.substituents.map(item=>item===component?alteredFunction:item)}),true,'altered secondary function locant');
  const changedAttachment={...graph,bonds:graph.bonds.filter(([a,b])=>!((a===proof.parentAtomId&&b===proof.rootAtomId)
    ||(b===proof.parentAtomId&&a===proof.rootAtomId))).concat([[proof.parentAtomId,proof.carbonPath[1],1]])};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(changedAttachment,analysis),true,'changed branch attachment');
});
