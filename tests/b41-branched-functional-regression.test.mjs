import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { loadExerciseChemistry } from './helpers/exercise-chemistry.mjs';
import { structuralIdentity } from './helpers/reference-corpus.mjs';
import { moleculeFromSmiles, moleculeToSmiles, inspectSmilesStructure } from '../app/openchemlib-adapter.ts';
import { buildHydrocarbonFromIupacName } from '../app/name-to-molecule.ts';
import { translateSpanishIupacToOpsin } from '../app/iupac-name-normalization.ts';
import { reconcileSystematicName } from '../app/validated-name-derivation.ts';

// Names describe the frozen graphs; they do not claim that every name is a PIN.
const cases = [
  ['CCC(C)CO','2-metilbutan-1-ol','C5H12O','alcohol',true],
  ['CC(=O)C(C)C','3-metilbutan-2-ona','C5H10O','ketone',true],
  ['CC(C)CC=O','3-metilbutanal','C5H10O','aldehyde',true],
  ['CC(C)C(=O)O','ácido 2-metilpropanoico','C4H8O2','carboxylicAcid',true],
  ['CC(C)C(=O)OC','2-metilpropanoato de metilo','C5H10O2','ester'],
  ['COc1ccccc1C','1-metil-2-metoxibenceno','C8H10O','ether'],
  ['CC(C)C#N','2-metilpropanonitrilo','C4H7N','nitrile'],
  ['CC(C)CN','2-metilpropan-1-amina','C4H11N','amine'],
  ['CC(Br)C(C)C','2-bromo-3-metilbutano','C5H11Br','halogen',true],
  ['CC(C)C[N+](=O)[O-]','2-metil-1-nitropropano','C4H9NO2','nitro'],
  ['CC(C)C(C)CO','2,3-dimetilbutan-1-ol','C6H14O','alcohol'],
  ['CC(C)CC(C)O','4-metilpentan-2-ol','C6H14O','alcohol'],
  ['CC(C)C(C)C=O','2,3-dimetilbutanal','C6H12O','aldehyde'],
  ['CC(C)C(C)C(=O)O','ácido 2,3-dimetilbutanoico','C6H12O2','carboxylicAcid'],
  ['CC(C)C(C)C(=O)OC','2,3-dimetilbutanoato de metilo','C7H14O2','ester'],
  ['COc1ccc(C)cc1C','2,4-dimetil-1-metoxibenceno','C9H12O','ether'],
  ['CC(C)C(C)C#N','2,3-dimetilbutanonitrilo','C6H11N','nitrile'],
  ['CC(C)C(C)CN','2,3-dimetilbutan-1-amina','C6H15N','amine'],
  ['CC(Br)C(C)C(C)C','2-bromo-3,4-dimetilpentano','C7H15Br','halogen'],
  ['CC(C)C(C)C[N+](=O)[O-]','2,3-dimetil-1-nitrobutano','C6H13NO2','nitro'],
  ['OCC(CC)C(C)C','2-etil-3-metilbutan-1-ol','C7H16O','alcohol'],
  ['NCC(CC)C(C)C','2-etil-3-metilbutan-1-amina','C7H17N','amine'],
  ['CC(=O)C(=C)CC','3-metilidenopentan-2-ona','C6H10O','ketone'],
  ['CC(=O)C(C)CC','3-metilpentan-2-ona','C6H12O','ketone'],
];

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });

function permute(graph) {
  const ids = new Map(graph.atoms.map((atom, index) => [atom.id, 1000 + 17 * (graph.atoms.length - index)]));
  return {
    ...graph,
    atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: ids.get(atom.id), x: -atom.y, y: atom.x })),
    bonds: [...graph.bonds].reverse().map(([a,b,...rest]) => [ids.get(b), ids.get(a), ...rest]),
    ...(graph.rings ? { rings: graph.rings.map(ring => ({ ...ring, atomIds: [...ring.atomIds].reverse().map(id => ids.get(id)) })) } : {}),
  };
}

test('branched functional graphs retain identity, formula, group and name after atom and drawing permutations', () => {
  for (const [smiles, expectedName, formula, group, localBuild] of cases) {
    const input = moleculeFromSmiles(smiles);
    assert.equal(input.ok, true, smiles);
    const identity = structuralIdentity(smiles);
    assert.equal(inspectSmilesStructure(smiles).formula, formula, smiles);
    for (const graph of [input.molecule, permute(input.molecule)]) {
      const analysis = chemistry.engine.analyzeMolecule(graph);
      assert.equal(analysis.name, expectedName, smiles);
      assert.ok(analysis.functionalGroups.some(item => item.kind === group), `${smiles}: ${group}`);
      const exported = moleculeToSmiles(graph);
      assert.equal(exported.ok, true, smiles);
      assert.equal(structuralIdentity(exported.smiles), identity, `${smiles}: molecular identity`);
    }
    if (localBuild) {
      const built = buildHydrocarbonFromIupacName(expectedName);
      assert.equal(built.ok, true, expectedName);
      const exported = moleculeToSmiles(built.molecule);
      assert.equal(exported.ok, true, expectedName);
      assert.equal(structuralIdentity(exported.smiles), identity, `${expectedName}: name → graph`);
    }
  }
});

test('equivalent traversals of the same branched alcohol and amine preserve naming and identity', () => {
  for (const [first, second, expected] of [
    ['OCC(CC)C(C)C','OCC(C(C)C)CC','2-etil-3-metilbutan-1-ol'],
    ['NCC(CC)C(C)C','NCC(C(C)C)CC','2-etil-3-metilbutan-1-amina'],
  ]) {
    assert.equal(structuralIdentity(first), structuralIdentity(second));
    for (const smiles of [first,second]) {
      const parsed = moleculeFromSmiles(smiles);
      assert.equal(parsed.ok, true, smiles);
      assert.equal(chemistry.engine.analyzeMolecule(parsed.molecule).name, expected);
    }
  }
});

test('unimplemented amino groups inside a branch remain fail-closed', () => {
  for (const [smiles, kind] of [
    ['O=C(O)C(CCN)CCN','amine'],
    ['O=C(O)C(CCO)(CCN)CCN','amine'],
  ]) {
    const parsed = moleculeFromSmiles(smiles);
    assert.equal(parsed.ok, true, smiles);
    for (const graph of [parsed.molecule, permute(parsed.molecule)]) {
      const analysis = chemistry.engine.analyzeMolecule(graph);
      assert.equal(analysis.functionalGroups.filter(group => group.kind === kind).length, 2, smiles);
      assert.equal(chemistry.engine.localNamerCannotSafelyName(graph, analysis), true, smiles);
    }
  }
});

test('a hydroxyethyl branch retains its own hydroxyl and local locant', () => {
  const input = moleculeFromSmiles('O=C(O)C(CCO)CCO');
  assert.equal(input.ok, true);
  // OPSIN 2-(2-hydroxyethyl)-4-hydroxybutanoic acid: OCCC(C(=O)O)CCO,
  // standard InChIKey QRPLMNRUNFKKJY-UHFFFAOYSA-N (independent reference).
  assert.equal(structuralIdentity('O=C(O)C(CCO)CCO'), structuralIdentity('OCCC(C(=O)O)CCO'));
  for (const graph of [input.molecule, permute(input.molecule)]) {
    const analysis = chemistry.engine.analyzeMolecule(graph);
    assert.equal(analysis.name, 'ácido 4-hidroxi-2-(2-hidroxietil)butanoico');
    assert.equal(chemistry.engine.localNamerCannotSafelyName(graph, analysis), false);
    assert.equal(reconcileSystematicName(graph, '4-hydroxy-2-(2-hydroxyethyl)butanoic acid'), null,
      'a locally generated name does not assert FULL');
  }
});

test('hydroxyalkyl proofs preserve every branch atom and bond across independently interpreted OPSIN graphs', () => {
  // Frozen OPSIN SUCCESS SMILES for the English names; no network is used here.
  const examples = [
    ['O=C(O)C(CCO)CCO','ácido 4-hidroxi-2-(2-hidroxietil)butanoico','4-hydroxy-2-(2-hydroxyethyl)butanoic acid','OCCC(C(=O)O)CCO',1],
    ['O=CC(CCO)CCO','4-hidroxi-2-(2-hidroxietil)butanal','4-hydroxy-2-(2-hydroxyethyl)butanal','OCCC(C=O)CCO',1],
    ['CC(=O)C(CCO)CCO','5-hidroxi-3-(2-hidroxietil)pentan-2-ona','5-hydroxy-3-(2-hydroxyethyl)pentan-2-one','OCCC(C(C)=O)CCO',1],
    ['O=C(O)C(CCO)(CCO)CC','ácido 2-etil-4-hidroxi-2-(2-hidroxietil)butanoico','2-ethyl-4-hydroxy-2-(2-hydroxyethyl)butanoic acid','C(C)C(C(=O)O)(CCO)CCO',1],
    ['O=C(O)C(CO)(CO)CC','ácido 2,2-bis(1-hidroximetil)butanoico','2,2-bis(1-hydroxymethyl)butanoic acid','OCC(C(=O)O)(CC)CO',2],
    ['O=C(O)C(CCO)(CCO)CCO','ácido 4-hidroxi-2,2-bis(2-hidroxietil)butanoico','4-hydroxy-2,2-bis(2-hydroxyethyl)butanoic acid','OCCC(C(=O)O)(CCO)CCO',2],
    ['O=C(O)C(C(O)C)CCC','ácido 2-(1-hidroxietil)pentanoico','2-(1-hydroxyethyl)pentanoic acid','OC(C)C(C(=O)O)CCC',1],
  ];
  for (const [smiles, spanish, english, opsinSmiles, count] of examples) {
    assert.equal(structuralIdentity(smiles), structuralIdentity(opsinSmiles), english);
    assert.equal(translateSpanishIupacToOpsin(spanish), english);
    for (const source of [smiles,opsinSmiles]) {
      const parsed = moleculeFromSmiles(source);
      assert.equal(parsed.ok,true,source);
      for (const graph of [parsed.molecule,permute(parsed.molecule)]) {
        const analysis = chemistry.engine.analyzeMolecule(graph);
        assert.equal(analysis.name,spanish,source);
        assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,analysis),false,source);
        const branches = analysis.substituents.filter(item => item.hydroxyAlkyl);
        assert.equal(branches.length,count,source);
        for (const branch of branches) {
          const proof = branch.hydroxyAlkyl;
          assert.equal(proof.attachmentOrder,1);
          assert.equal(proof.numbering[0][0],proof.rootAtomId);
          assert.equal(proof.numbering[0][1],1);
          assert.equal(proof.numbering.find(([id]) => id===proof.hydroxy.carbonId)[1],proof.hydroxy.locant);
          assert.equal(proof.atomIds.length,proof.carbonPath.length+1);
          assert.equal(proof.bonds.length,proof.atomIds.length);
          assert.ok(proof.bonds.every(([a,b,order]) => graph.bonds.some(([x,y,o]) =>
            (a===x&&b===y||a===y&&b===x)&&(order??1)===(o??1))));
          assert.ok(analysis.functionalGroups.some(group => group.kind==='alcohol' && group.heteroAtomId===proof.hydroxy.oxygenId));
        }
        const exported = moleculeToSmiles(graph);
        assert.equal(exported.ok,true,source);
        assert.equal(structuralIdentity(exported.smiles),structuralIdentity(opsinSmiles),source);
      }
    }
  }
});

test('a repeated principal suffix plus a same-kind functionalized branch stays outside validated reasoning', () => {
  for (const smiles of ['OCCC(CO)CCCCO','OCCC(CCO)CCCCO']) {
    const parsed=moleculeFromSmiles(smiles); assert.equal(parsed.ok,true,smiles);
    for (const graph of [parsed.molecule,permute(parsed.molecule)]) {
      const analysis=chemistry.engine.analyzeMolecule(graph);
      const alcohols=analysis.functionalGroups.filter(group=>group.kind==='alcohol');
      assert.equal(analysis.primaryFunctionalGroup,'alcohol',smiles);
      assert.equal(alcohols.length,3,smiles);
      assert.equal(alcohols.filter(group=>analysis.mainChain.includes(group.carbonId)).length,2,smiles);
      assert.ok(analysis.substituents.some(item=>item.hydroxyAlkyl),smiles);
      assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,analysis),true,smiles);
      assert.equal(chemistry.engine.externalCandidateNeedsNeutralLocalName(graph,analysis),true,smiles);
    }
  }
});

test('branched, multiply hydroxylated or explicitly stereogenic hydroxy branches stay fail-closed', () => {
  for (const smiles of [
    'O=C(O)C([C@H](O)C)CCC',
    'O=C(O)C(C(O)(O)C)CCC',
    'O=C(O)C(C(O)C(C)C)CCCC',
    'O=C(O)C(C=CO)CCCC',
  ]) {
    const parsed=moleculeFromSmiles(smiles);
    assert.equal(parsed.ok,true,smiles);
    const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
    assert.ok(analysis.functionalGroups.some(group=>group.kind==='alcohol'),smiles);
    assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,analysis),true,smiles);
  }
});

test('stale branch evidence cannot make an incomplete name or edited graph safe', () => {
  const parsed=moleculeFromSmiles('O=C(O)C(CCO)CCO');
  assert.equal(parsed.ok,true);
  const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
  assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,{...analysis,name:'ácido 2-etil-4-hidroxibutanoico'}),true);
  assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,{...analysis,
    name:analysis.name.replace('2-(2-hidroxietil)','3-(2-hidroxietil)')}),true,
    'a parent locant in the name must agree with the attachment evidence');
  const proof=analysis.substituents.find(item=>item.hydroxyAlkyl).hydroxyAlkyl;
  const edited={...parsed.molecule,bonds:parsed.molecule.bonds.filter(([a,b])=>
    !(a===proof.hydroxy.oxygenId&&b===proof.hydroxy.carbonId||b===proof.hydroxy.oxygenId&&a===proof.hydroxy.carbonId))};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(edited,analysis),true);
});

test('primary aminoalkyl branches retain the amine and its internal locant', () => {
  // Frozen OPSIN SUCCESS interpretations; no network access is used in tests.
  const examples=[
    ['O=C(O)C(CCN)CCC','ácido 2-(2-aminoetil)pentanoico','2-(2-aminoethyl)pentanoic acid','NCCC(C(=O)O)CCC'],
    ['O=CC(CCN)CCC','2-(2-aminoetil)pentanal','2-(2-aminoethyl)pentanal','NCCC(C=O)CCC'],
    ['CC(=O)C(CCN)CCC','3-(2-aminoetil)hexan-2-ona','3-(2-aminoethyl)hexan-2-one','NCCC(C(C)=O)CCC'],
    ['O=C(O)C(C(N)C)CCC','ácido 2-(1-aminoetil)pentanoico','2-(1-aminoethyl)pentanoic acid','NC(C)C(C(=O)O)CCC'],
    ['O=C(O)C(CCCN)CCCC','ácido 2-(3-aminopropil)hexanoico','2-(3-aminopropyl)hexanoic acid','NCCCC(C(=O)O)CCCC'],
    ['O=C(O)C(CCN)(CCO)CCC','ácido 2-(2-aminoetil)-2-(2-hidroxietil)pentanoico','2-(2-aminoethyl)-2-(2-hydroxyethyl)pentanoic acid','NCCC(C(=O)O)(CCC)CCO'],
    ['O=C(O)C(CCN)CCCO','ácido 2-(2-aminoetil)-5-hidroxipentanoico','2-(2-aminoethyl)-5-hydroxypentanoic acid','NCCC(C(=O)O)CCCO'],
  ];
  for(const [smiles,spanish,english,opsinSmiles] of examples){
    assert.equal(structuralIdentity(smiles),structuralIdentity(opsinSmiles),english);
    for(const source of [smiles,opsinSmiles]){
      const parsed=moleculeFromSmiles(source); assert.equal(parsed.ok,true,source);
      for(const graph of [parsed.molecule,permute(parsed.molecule)]){
        const analysis=chemistry.engine.analyzeMolecule(graph);
        assert.equal(analysis.name,spanish,source);
        assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,analysis),false,source);
        assert.equal(translateSpanishIupacToOpsin(spanish),english);
        assert.equal(reconcileSystematicName(graph,english),null,'no automatic FULL');
        assert.equal(inspectSmilesStructure(source).formula,inspectSmilesStructure(opsinSmiles).formula,source);
        const proof=analysis.substituents.find(item=>item.aminoAlkyl)?.aminoAlkyl;
        assert.ok(proof,source);
        assert.equal(proof.attachmentOrder,1);
        assert.deepEqual(proof.numbering[0],[proof.rootAtomId,1]);
        assert.equal(proof.numbering.find(([id])=>id===proof.amino.carbonId)[1],proof.amino.locant);
        assert.equal(proof.atomIds.length,proof.carbonPath.length+1);
        assert.equal(proof.bonds.length,proof.atomIds.length);
        assert.ok(proof.bonds.every(([a,b,order])=>graph.bonds.some(([x,y,o])=>
          (a===x&&b===y||a===y&&b===x)&&(order??1)===(o??1))),source);
        assert.ok(analysis.functionalGroups.some(group=>group.kind==='amine'&&group.id===proof.amino.groupId
          &&group.heteroAtomId===proof.amino.nitrogenId),source);
        const exported=moleculeToSmiles(graph); assert.equal(exported.ok,true,source);
        assert.equal(structuralIdentity(exported.smiles),structuralIdentity(opsinSmiles),source);
      }
    }
  }
});

test('non-primary, charged, unsaturated, branched, stereogenic or other nitrogen functions stay outside aminoalkyl support', () => {
  for(const smiles of [
    'O=C(O)C(CCNC)CCC', 'O=C(O)C(CCN(C)C)CCC',
    'O=C(O)C(CC#N)CCC', 'O=C(O)C(CC(=O)N)CCC',
    'O=C(O)C(CC[N+](=O)[O-])CCC', 'O=C(O)C(C=CN)CCC',
    'O=C(O)C(C(N)(C)C)CCCC', 'O=C(O)C([C@H](N)C)CCC',
  ]){
    const parsed=moleculeFromSmiles(smiles); assert.equal(parsed.ok,true,smiles);
    const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
    assert.ok(!analysis.substituents.some(item=>item.aminoAlkyl),smiles);
    assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,analysis),true,smiles);
  }
  const parsed=moleculeFromSmiles('O=C(O)C(CCN)CCC'); assert.equal(parsed.ok,true);
  const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
  const nitrogen=analysis.substituents.find(item=>item.aminoAlkyl).aminoAlkyl.amino.nitrogenId;
  const charged={...parsed.molecule,atoms:parsed.molecule.atoms.map(atom=>atom.id===nitrogen?{...atom,charge:1}:atom)};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(charged,analysis),true,'changed N charge invalidates stale proof');
});

test('aminoalkyl evidence becomes unsafe after changing the name, locant or N bond', () => {
  const parsed=moleculeFromSmiles('O=C(O)C(CCN)CCC'); assert.equal(parsed.ok,true);
  const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
  const proof=analysis.substituents.find(item=>item.aminoAlkyl).aminoAlkyl;
  for(const name of ['ácido 2-etilpentanoico',analysis.name.replace('2-(2-aminoetil)','3-(2-aminoetil)')])
    assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,{...analysis,name}),true,name);
  const edited={...parsed.molecule,bonds:parsed.molecule.bonds.filter(([a,b])=>
    !(a===proof.amino.nitrogenId&&b===proof.amino.carbonId||b===proof.amino.nitrogenId&&a===proof.amino.carbonId))};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(edited,analysis),true);
});

test('oxoalkyl branches preserve aldehyde and ketone carbonyls with independent local numbering', () => {
  // Frozen OPSIN interpretations; two requested candidates select a parent
  // containing the ketone; the remaining examples require branch proof.
  const examples = [
    ['O=C(O)C(CC(=O)C)CCC','ácido 4-oxo-2-propilpentanoico','O=C(CC(C(=O)O)CCC)C','C8H14O3',null],
    ['O=CC(CC(=O)C)CCC','4-oxo-2-propilpentanal','O=C(CC(C=O)CCC)C','C8H14O2',null],
    ['O=C(O)C(CC=O)CCC','ácido 2-(2-oxoetil)pentanoico','O=CCC(C(=O)O)CCC','C7H12O3','aldehyde',2,'2-(2-oxoethyl)pentanoic acid'],
    ['O=C(O)C(CC(=O)C)CCCC','ácido 2-(2-oxopropil)hexanoico','O=C(CC(C(=O)O)CCCC)C','C9H16O3','ketone',2,'2-(2-oxopropyl)hexanoic acid'],
    ['O=C(O)C(CCC=O)CCCC','ácido 2-(3-oxopropil)hexanoico','O=CCCC(C(=O)O)CCCC','C9H16O3','aldehyde',3,'2-(3-oxopropyl)hexanoic acid'],
    ['O=C(O)C(CCC(=O)C)CCCCC','ácido 2-(3-oxobutil)heptanoico','O=C(CCC(C(=O)O)CCCCC)C','C11H20O3','ketone',3,'2-(3-oxobutyl)heptanoic acid'],
  ];
  for (const [smiles,name,reference,formula,kind,locant,english] of examples) {
    assert.equal(structuralIdentity(smiles),structuralIdentity(reference),smiles);
    for (const source of [smiles,reference]) {
      assert.equal(inspectSmilesStructure(source).formula,formula,source);
      const parsed=moleculeFromSmiles(source); assert.equal(parsed.ok,true,source);
      for (const graph of [parsed.molecule,permute(parsed.molecule)]) {
        const analysis=chemistry.engine.analyzeMolecule(graph);
        assert.equal(analysis.name,name,source);
        assert.equal(chemistry.engine.localNamerCannotSafelyName(graph,analysis),false,source);
        const exported=moleculeToSmiles(graph); assert.equal(exported.ok,true);
        assert.equal(structuralIdentity(exported.smiles),structuralIdentity(reference));
        if (!kind) continue;
        const proof=analysis.substituents.find(item=>item.oxoAlkyl)?.oxoAlkyl;
        assert.ok(proof,source);
        assert.equal(proof.oxo.kind,kind);
        assert.equal(proof.oxo.source,'detected-group-and-graph');
        assert.equal(proof.attachmentOrder,1);
        assert.equal(analysis.mainChain[analysis.substituents.find(item=>item.oxoAlkyl).locant-1],proof.parentAtomId);
        assert.equal(proof.atomIds.length,proof.carbonPath.length+1);
        assert.equal(proof.bonds.length,proof.atomIds.length);
        assert.ok(proof.bonds.every(([a,b,order])=>graph.bonds.some(([x,y,o])=>
          (a===x&&b===y||a===y&&b===x)&&(order??1)===(o??1))));
        assert.ok(analysis.functionalGroups.some(group=>group.id===proof.oxo.groupId && group.kind===kind
          && group.carbonId===proof.oxo.carbonId && group.heteroAtomId===proof.oxo.oxygenId));
        assert.deepEqual(proof.numbering[0],[proof.rootAtomId,1]);
        assert.equal(proof.numbering.find(([id])=>id===proof.oxo.carbonId)[1],locant);
        assert.ok(proof.bonds.some(([a,b,order])=>order===2 &&
          (a===proof.oxo.carbonId&&b===proof.oxo.oxygenId||b===proof.oxo.carbonId&&a===proof.oxo.oxygenId)));
        assert.equal(translateSpanishIupacToOpsin(name),english);
        assert.equal(reconcileSystematicName(graph,english),null);
      }
    }
  }
});

test('oxoalkyl proof rejects altered carbonyl evidence and unsupported branch structures', () => {
  for (const smiles of [
    'O=C(O)C(CC(=O)O)CCCC', 'O=C(O)C(CC(=O)OC)CCCC', 'O=C(O)C(CC(=O)N)CCCC',
    'O=C(O)C(CC(=O)CC(C)C)CCCCCCC', 'O=C(O)C(CC(=O)C=O)CCCCC',
    'O=C(O)C(C=CC=O)CCCC', 'O=C(O)C([C@H](C)C=O)CCCCC',
  ]) {
    const parsed=moleculeFromSmiles(smiles); assert.equal(parsed.ok,true,smiles);
    const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
    assert.ok(!analysis.substituents.some(item=>item.oxoAlkyl),smiles);
    // A complete parent can contain both functional groups, e.g. a diacid.
    // When a group remains in a branch, the incomplete name is blocked.
    if (analysis.functionalGroups.some(group => group.carbonIds.length
      && !group.carbonIds.some(id => analysis.mainChain.includes(id))))
      assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,analysis),true,smiles);
  }
  const parsed=moleculeFromSmiles('O=C(O)C(CC(=O)C)CCCC'); assert.equal(parsed.ok,true);
  const analysis=chemistry.engine.analyzeMolecule(parsed.molecule);
  const component=analysis.substituents.find(item=>item.oxoAlkyl), proof=component.oxoAlkyl;
  const changed={...parsed.molecule,bonds:parsed.molecule.bonds.map(bond=>
    (bond[0]===proof.oxo.carbonId&&bond[1]===proof.oxo.oxygenId||bond[1]===proof.oxo.carbonId&&bond[0]===proof.oxo.oxygenId)
      ? [bond[0],bond[1],1] : bond)};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(changed,analysis),true);
  const acid=analysis.functionalGroups.find(group=>group.kind==='carboxylicAcid');
  const missingPrincipalOxygen={...parsed.molecule,atoms:parsed.molecule.atoms.filter(atom=>atom.id!==acid.heteroAtomId),
    bonds:parsed.molecule.bonds.filter(([a,b])=>a!==acid.heteroAtomId&&b!==acid.heteroAtomId)};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(missingPrincipalOxygen,analysis),true,'stale principal function');
  const [p1,p2]=analysis.mainChain.slice(-2);
  const changedParent={...parsed.molecule,bonds:parsed.molecule.bonds.map(bond=>
    (bond[0]===p1&&bond[1]===p2||bond[1]===p1&&bond[0]===p2) ? [bond[0],bond[1],2] : bond)};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(changedParent,analysis),true,'stale parent bond');
  const terminal=analysis.mainChain.at(-1), addedId=Math.max(...parsed.molecule.atoms.map(atom=>atom.id))+100;
  const extended={...parsed.molecule,atoms:[...parsed.molecule.atoms,{id:addedId,x:0,y:0}],
    bonds:[...parsed.molecule.bonds,[terminal,addedId,1]]};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(extended,analysis),true,'stale complete graph');
  assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,{...analysis,name:analysis.name.replace('2-(2-oxo','3-(2-oxo')}),true);
  const forged={...component,oxoAlkyl:{...proof,oxo:{...proof.oxo,locant:3}}};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,{...analysis,
    substituents:analysis.substituents.map(item=>item===component?forged:item)}),true);
  const misplaced={...component,oxoAlkyl:{...proof,oxo:{...proof.oxo,carbonId:proof.rootAtomId}}};
  assert.equal(chemistry.engine.localNamerCannotSafelyName(parsed.molecule,{...analysis,
    substituents:analysis.substituents.map(item=>item===component?misplaced:item)}),true);
  const acyl=moleculeFromSmiles('O=C(O)C(C(=O)C)CCCC'); assert.equal(acyl.ok,true);
  const acylAnalysis=chemistry.engine.analyzeMolecule(acyl.molecule);
  assert.ok(!acylAnalysis.substituents.some(item=>item.oxoAlkyl),'attachment at carbonyl is acyl, not oxoalkyl');
});
