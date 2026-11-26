import assert from "node:assert/strict";
import test from "node:test";
import { Canonizer, Molecule, SmilesParser } from "openchemlib";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { getSteroidLike6565System } from "../app/fused-ring-nomenclature.ts";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { buildOpenChemLibStereoGraph } from "../app/tetrahedral-stereochemistry.ts";
import { normalizeMoleculePayload } from "../app/api/molecule-payload.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { reasoningFragmentId } from "../app/reasoning-visual-targets.ts";
import {
  EPITESTOSTERONE_REFERENCE_SMILES, inspectTestosteroneGraph, TESTOSTERONE_CHEBI_SMILES,
  TESTOSTERONE_REFERENCE_SMILES, testosteroneReferenceSmilesForExactGraph,
} from "../app/testosterone-stereo-structure.ts";
import { TESTOSTERONE_NAMES } from "../app/testosterone-stereo-grammar.ts";

const importSmiles=smiles=>{const result=moleculeFromSmiles(smiles);assert.equal(result.ok,true,result.error);return result.molecule;};
const testosterone=importSmiles(TESTOSTERONE_REFERENCE_SMILES);
const systematicNames=[TESTOSTERONE_NAMES.en,TESTOSTERONE_NAMES.es];

test("PubChem and independent ChEBI isomeric references match the complete testosterone graph",()=>{
  const pubchem=inspectTestosteroneGraph(testosterone);
  const chebi=inspectTestosteroneGraph(importSmiles(TESTOSTERONE_CHEBI_SMILES));
  assert.ok(pubchem);assert.ok(chebi);
  assert.equal(new SmilesParser().parseMolecule(TESTOSTERONE_REFERENCE_SMILES).getMolecularFormula().formula,"C19H28O2");
  assert.deepEqual([pubchem.locants["3"],pubchem.locants["4"],pubchem.locants["5"],pubchem.locants["17"]]
    .map(id=>pubchem.system.numbering.indexOf(id)+1),[3,4,5,17]);
  assert.deepEqual(pubchem.c4C5Bond,[pubchem.locants["4"],pubchem.locants["5"]].sort((a,b)=>a-b));
  assert.deepEqual(pubchem.c3OxoBond,[pubchem.locants["3"],pubchem.carbonylOxygenId].sort((a,b)=>a-b));
  assert.deepEqual(pubchem.c17HydroxyBond,[pubchem.locants["17"],pubchem.hydroxylOxygenId].sort((a,b)=>a-b));
  assert.deepEqual(pubchem.system.angularMethyls,{C18:pubchem.locants["18"],C19:pubchem.locants["19"]});
  assert.equal(testosterone.atoms.find(atom=>atom.id===pubchem.locants["5"]).tetrahedralParity,undefined,
    "C5 is trigonal in C4=C5 and must not retain a saturated-parent tetrahedral descriptor");
  assert.ok(chebi);
});

test("all four bilingual names are FULL only for the complete testosterone stereostructure",()=>{
  const expected=[
    [TESTOSTERONE_NAMES.en,"en"],[TESTOSTERONE_NAMES.es,"es"],
    [TESTOSTERONE_NAMES.commonEn,"en"],[TESTOSTERONE_NAMES.commonEs,"es"],
  ];
  for(const [name,language] of expected){
    const result=reconcileSystematicName(testosterone,name);
    assert.equal(result?.status,"FULL",name);
    assert.equal(result?.evidence?.language,language,name);
    assert.equal(result?.evidence?.construction,"fused-testosterone-stereo",name);
    assert.equal(result?.principalGroup,"ketone",name);
    assert.equal(result?.preferred,false,name);
    assert.equal(result?.components.filter(component=>component.id==="testosterone-carbonyl-3").length,1,name);
    assert.equal(result?.components.filter(component=>component.id==="testosterone-hydroxy-17").length,1,name);
  }
  assert.notEqual(reconcileSystematicName(testosterone,"17-hydroxyandrost-4-en-3-one")?.status,"FULL",
    "a constitutional name without verified 17β is not the fully specified testosterone name");
  assert.notEqual(reconcileSystematicName(testosterone,"17α-hydroxyandrost-4-en-3-one")?.status,"FULL");
});

test("C17 epimer, other stereocentre errors and incomplete stereo cannot reconcile as testosterone",()=>{
  const epimer=importSmiles(EPITESTOSTERONE_REFERENCE_SMILES);
  const epiC17=getSteroidLike6565System(epimer)?.numbering?.[16];
  assert.ok(epiC17);
  assert.equal(epimer.atoms.find(atom=>atom.id===epiC17)?.tetrahedralParity,"R");
  for(const name of systematicNames)assert.equal(reconcileSystematicName(epimer,name),null,name);

  const c17=inspectTestosteroneGraph(testosterone).locants["17"];
  const c9=inspectTestosteroneGraph(testosterone).locants["9"];
  for(const locantId of [c17,c9]){
    const incomplete={...testosterone,atoms:testosterone.atoms.map(atom=>atom.id===locantId?({...atom,tetrahedralParity:undefined}):atom)};
    for(const name of systematicNames)assert.equal(reconcileSystematicName(incomplete,name),null,`${name} missing stereo at ${locantId}`);
  }
  const invertedOther={...testosterone,atoms:testosterone.atoms.map(atom=>atom.id===c9?({...atom,tetrahedralParity:atom.tetrahedralParity==="R"?"S":"R"}):atom)};
  assert.equal(reconcileSystematicName(invertedOther,TESTOSTERONE_NAMES.en),null);

  const partialSmiles=TESTOSTERONE_REFERENCE_SMILES.replace("[C@@H]2O","C2O"),partial=importSmiles(partialSmiles);
  const partialC17=getSteroidLike6565System(partial)?.numbering?.[16];assert.ok(partialC17);
  assert.equal(partial.atoms.find(atom=>atom.id===partialC17)?.tetrahedralParity,undefined);
  assert.equal(inspectTestosteroneGraph(partial),null);
  for(const name of systematicNames)assert.equal(reconcileSystematicName(partial,name),null,name);
});

test("all name-defining edits invalidate identity, including both angular methyls and every fusion",()=>{
  const base=inspectTestosteroneGraph(testosterone),copy=()=>structuredClone(testosterone);
  const findBond=(graph,a,b)=>graph.bonds.find(bond=>(bond[0]===a&&bond[1]===b)||(bond[0]===b&&bond[1]===a));
  const changed=[];
  const saturated=copy();findBond(saturated,base.locants["4"],base.locants["5"])[2]=1;changed.push(saturated);
  const shiftedAlkene=copy();findBond(shiftedAlkene,base.locants["4"],base.locants["5"])[2]=1;findBond(shiftedAlkene,base.locants["5"],base.locants["6"])[2]=2;changed.push(shiftedAlkene);
  const noCarbonyl=copy();findBond(noCarbonyl,base.locants["3"],base.carbonylOxygenId)[2]=1;changed.push(noCarbonyl);
  const noCarbonylOxygen=copy();noCarbonylOxygen.bonds=noCarbonylOxygen.bonds.filter(bond=>!bond.includes(base.carbonylOxygenId));noCarbonylOxygen.atoms=noCarbonylOxygen.atoms.filter(atom=>atom.id!==base.carbonylOxygenId);changed.push(noCarbonylOxygen);
  const noC17Hydroxyl=copy();noC17Hydroxyl.bonds=noC17Hydroxyl.bonds.filter(bond=>!bond.includes(base.hydroxylOxygenId));noC17Hydroxyl.atoms=noC17Hydroxyl.atoms.filter(atom=>atom.id!==base.hydroxylOxygenId);changed.push(noC17Hydroxyl);
  const movedHydroxyl=copy();findBond(movedHydroxyl,base.locants["17"],base.hydroxylOxygenId)[1]=base.locants["16"];changed.push(movedHydroxyl);
  const epimerized=copy();epimerized.atoms=epimerized.atoms.map(atom=>atom.id===base.locants["17"]?({...atom,tetrahedralParity:atom.tetrahedralParity==="R"?"S":"R"}):atom);changed.push(epimerized);
  for(const locant of ["18","19"]){const removed=copy(),id=base.locants[locant];removed.bonds=removed.bonds.filter(bond=>!bond.includes(id));removed.atoms=removed.atoms.filter(atom=>atom.id!==id);changed.push(removed);}
  for(const pair of Object.values(base.system.junctions)){const opened=copy();opened.bonds=opened.bonds.filter(bond=>!(bond.includes(pair[0])&&bond.includes(pair[1])));changed.push(opened);}
  for(const [index,graph] of changed.entries()){
    assert.equal(reconcileSystematicName(graph,TESTOSTERONE_NAMES.en),null,`edit ${index} invalidates structure`);
    assert.equal(testosteroneReferenceSmilesForExactGraph(graph),null,`edit ${index} cannot reuse reference serialization`);
  }
});

test("name construction is a checked graph build, not common-name acceptance",()=>{
  for(const name of [...systematicNames,TESTOSTERONE_NAMES.commonEn,TESTOSTERONE_NAMES.commonEs]){
    const built=buildHydrocarbonFromIupacName(name);
    assert.equal(built.ok,true,name);
    assert.equal(built.inputFamily,"fused-testosterone-stereo",name);
    assert.ok(inspectTestosteroneGraph(built.molecule),name);
    assert.equal(reconcileSystematicName(built.molecule,name)?.status,"FULL",name);
  }
});

test("full graph mapping survives reordered IDs and equivalent atom-order references",()=>{
  const remap=new Map(testosterone.atoms.map((atom,index)=>[atom.id,900+index*13]));
  const transformed={
    atoms:[...testosterone.atoms].reverse().map(atom=>({...atom,id:remap.get(atom.id),x:-atom.x+20,y:atom.y-30})),
    bonds:[...testosterone.bonds].reverse().map(([a,b,order])=>[remap.get(b),remap.get(a),order]),
    rings:[...testosterone.rings].reverse().map(ring=>({...ring,id:ring.id+30,atomIds:[...ring.atomIds].reverse().map(id=>remap.get(id))})),
  };
  const proof=inspectTestosteroneGraph(transformed);assert.ok(proof);
  assert.equal(reconcileSystematicName(transformed,TESTOSTERONE_NAMES.en)?.status,"FULL");
  assert.equal(testosteroneReferenceSmilesForExactGraph(importSmiles(TESTOSTERONE_CHEBI_SMILES)),TESTOSTERONE_REFERENCE_SMILES);
});

test("testosterone SMILES round-trip preserves full stereochemical graph identity",()=>{
  const exported=moleculeToSmiles(testosterone);assert.equal(exported.ok,true);
  const source=new SmilesParser().parseMolecule(TESTOSTERONE_REFERENCE_SMILES);
  const restored=new SmilesParser().parseMolecule(exported.smiles);
  source.ensureHelperArrays(Molecule.cHelperCIP);restored.ensureHelperArrays(Molecule.cHelperCIP);
  assert.equal(new Canonizer(restored).getIDCode(),new Canonizer(source).getIDCode());
  assert.equal(reconcileSystematicName(importSmiles(exported.smiles),TESTOSTERONE_NAMES.en)?.status,"FULL");
});

test("position and functional-group edits immediately invalidate the testosterone name and reference export",()=>{
  const base=inspectTestosteroneGraph(testosterone),copy=()=>structuredClone(testosterone);
  const findBond=(graph,a,b)=>graph.bonds.find(bond=>(bond[0]===a&&bond[1]===b)||(bond[0]===b&&bond[1]===a));
  const changed=[];
  const c4c5=copy();findBond(c4c5,base.locants["4"],base.locants["5"])[2]=1;changed.push(c4c5);
  const c5c6=copy();findBond(c5c6,base.locants["4"],base.locants["5"])[2]=1;findBond(c5c6,base.locants["5"],base.locants["6"])[2]=2;changed.push(c5c6);
  const noCarbonyl=copy();findBond(noCarbonyl,base.locants["3"],base.carbonylOxygenId)[2]=1;changed.push(noCarbonyl);
  const noC17Hydroxyl=copy();noC17Hydroxyl.bonds=noC17Hydroxyl.bonds.filter(bond=>!bond.includes(base.hydroxylOxygenId));
  noC17Hydroxyl.atoms=noC17Hydroxyl.atoms.filter(atom=>atom.id!==base.hydroxylOxygenId);changed.push(noC17Hydroxyl);
  const noC19=copy();noC19.bonds=noC19.bonds.filter(bond=>!bond.includes(base.locants["19"]));noC19.atoms=noC19.atoms.filter(atom=>atom.id!==base.locants["19"]);changed.push(noC19);
  for(const graph of changed){
    assert.equal(reconcileSystematicName(graph,TESTOSTERONE_NAMES.en),null);
    assert.equal(testosteroneReferenceSmilesForExactGraph(graph),null);
  }
});

test("bilingual How obtained reasoning maps each unique control to the verified graph",()=>{
  const expectedIds=["testosterone-parent",..."ABCD".split("").map(label=>`testosterone-ring-${label}`),
    ...["ab","bc","cd"].map(label=>`testosterone-fusion-${label}`),...Array.from({length:19},(_,i)=>`testosterone-locant-${i+1}`),
    "testosterone-androstane-core","testosterone-c18","testosterone-c19","testosterone-unsaturation-4","testosterone-carbonyl-3",
    "testosterone-hydroxy-17","testosterone-17beta","testosterone-17beta-bond","testosterone-global-stereo"];
  for(const [language,name] of [["en",TESTOSTERONE_NAMES.en],["es",TESTOSTERONE_NAMES.es]]){
    const proof=reconcileSystematicName(testosterone,name),model=buildValidatedPriorityReasoning({derivation:proof,graph:testosterone,language});
    assert.equal(model.steps.length,6,`${language}: six progressive stages`);
    assert.deepEqual(model.steps.map(step=>step.number),["1","2","3","4","5","6"]);
    const fragments=model.steps.flatMap(step=>step.fragments?[step.fragments,...(step.fragments.additionalFragments??[])]:[]);
    const semanticIds=fragments.map(fragment=>fragment.semanticId);
    assert.equal(new Set(semanticIds).size,semanticIds.length,`${language}: no duplicate interactive controls`);
    for(const id of expectedIds){
      const step=model.steps.find(candidate=>[candidate.fragments,...(candidate.fragments?.additionalFragments??[])].some(fragment=>fragment?.semanticId===id));
      const fragment=[step?.fragments,...(step?.fragments?.additionalFragments??[])].find(candidate=>candidate?.semanticId===id);
      assert.ok(step&&fragment,`${language}: ${id} appears in the explanation`);
      const target=step.fragmentTargets[reasoningFragmentId(step.number,fragment)];assert.ok(target,`${language}: ${id} has a real graph target`);
      const component=proof.components.find(candidate=>candidate.id===id);
      let expectedAtoms,expectedBonds;
      if(id==="testosterone-androstane-core"){
        const core=new Set(Array.from({length:17},(_,index)=>inspectTestosteroneGraph(testosterone).locants[String(index+1)]));
        expectedAtoms=[...core];expectedBonds=testosterone.bonds.filter(([a,b])=>core.has(a)&&core.has(b)).map(([a,b])=>[a,b]);
      }else if(id==="testosterone-17beta-bond"){
        const hydroxyl=proof.components.find(candidate=>candidate.id==="testosterone-hydroxy-17");assert.ok(hydroxyl);
        expectedAtoms=hydroxyl.atomIds;expectedBonds=hydroxyl.bondIds;
      }else{
        assert.ok(component,`${id} is in the compositional proof`);expectedAtoms=component.atomIds;expectedBonds=component.bondIds;
      }
      assert.deepEqual([...target.atomIds].sort((a,b)=>a-b),[...new Set(expectedAtoms)].sort((a,b)=>a-b),`${language}: ${id} atom IDs`);
      assert.deepEqual([...new Set(target.bondIds.map(([a,b])=>[a,b].sort((x,y)=>x-y).join(":")))].sort(),
        [...new Set(expectedBonds.map(([a,b])=>[a,b].sort((x,y)=>x-y).join(":")))].sort(),`${language}: ${id} bond IDs`);
    }
    const completeText=model.steps.map(step=>step.title+" "+step.explanation).join(" ");
    assert.match(model.steps[0].explanation,language==="en"?/6–6–6–5.*C1–C17.*17 carbons.*gonane.*without angular methyls at C10 or C13.*C18 at C13.*18-carbon estrane.*C19 at C10.*19-carbon androstane.*pattern alone would not distinguish/is
      :/6–6–6–5.*C1–C17.*17 carbonos.*gonano.*sin metilos angulares en C10 ni C13.*C18 en C13.*18 carbonos.*estrano.*C19 en C10.*19 carbonos.*androstano.*por sí solo no distingue/is);
    assert.match(model.steps[1].explanation,language==="en"?/conventional numbering.*C1–C17.*C18.*C13.*C19.*C10.*oxygen is bonded to.*C17.*do not renumber/is
      :/numeración convencional.*C1–C17.*C18.*C13.*C19.*C10.*oxígeno.*C17.*no renumeran/is);
    assert.match(model.steps[2].explanation,language==="en"?/double bond joins C4 and C5.*locant is 4.*-4-en-/is
      :/doble enlace une C4 y C5.*localizador es 4.*-4-en-/is);
    assert.match(model.steps[3].explanation,language==="en"?/C3 bears a ketone.*C17 bears a hydroxyl.*ketone takes the suffix.*alcohol.*prefix.*does not displace/is
      :/C3 lleva una cetona.*C17 un hidroxilo.*cetona aporta el sufijo.*alcohol.*prefijo.*no desplaza/is);
    assert.match(model.steps[4].explanation,language==="en"?/conventional steroid projection.*β.*reference.*not inferred.*R\/S/is
      :/proyección esteroidea convencional.*β.*referencia.*no se deduce.*R\/S/is);
    if(language==="en")assert.doesNotMatch(completeText,/hidroxi|localizadores|estereoparent/);
    else assert.doesNotMatch(completeText,/hydroxy|stereoparent|locants/);
    assert.equal(model.name,name,`${language}: exact validated name punctuation`);
    assert.match(model.steps[0].explanation,language==="en"?/gonane.*estrane.*androstane/is:/gonano.*estrano.*androstano/is);
    assert.match(model.steps[3].explanation,language==="en"?/ketone takes the suffix.*alcohol.*prefix.*does not displace/is:/cetona aporta el sufijo.*alcohol.*prefijo.*no desplaza/is);
    assert.match(model.steps[4].explanation,language==="en"?/reference.*β.*not inferred.*R\/S/is:/referencia.*β.*no se deduce.*R\/S/is);
    assert.doesNotMatch(model.steps[4].explanation,/β\s*=\s*R|beta\s+(?:means|equals)\s+R|α\s*=\s*S|alpha\s+(?:means|equals)\s+S/i,`${language}: α/β is not equated with CIP R/S`);
    const mapped=inspectTestosteroneGraph(testosterone);
    assert.ok(testosterone.bonds.some(([a,b])=>(a===mapped.locants["13"]&&b===mapped.locants["18"])||(b===mapped.locants["13"]&&a===mapped.locants["18"])));
    assert.ok(testosterone.bonds.some(([a,b])=>(a===mapped.locants["10"]&&b===mapped.locants["19"])||(b===mapped.locants["10"]&&a===mapped.locants["19"])));
    assert.equal(semanticIds.filter(id=>id==="testosterone-locant-18").length,1);
    assert.equal(semanticIds.filter(id=>id==="testosterone-locant-19").length,1);
    assert.equal(semanticIds.filter(id=>id==="testosterone-c18").length,1,"C18 has one independently selectable angular-methyl control");
    assert.equal(semanticIds.filter(id=>id==="testosterone-c19").length,1,"C19 has one independently selectable angular-methyl control");
  }
});

test("cloud persistence preserves the full testosterone graph and stereo without stale fused metadata",()=>{
  const stored=normalizeMoleculePayload(JSON.parse(JSON.stringify(testosterone)));assert.ok(stored);
  assert.deepEqual(stored,testosterone);assert.ok(inspectTestosteroneGraph(stored));
  assert.equal(stored.fusedPolycyclicStereo,undefined,"the unsaturated core does not retain a saturated-parent annotation");
});
