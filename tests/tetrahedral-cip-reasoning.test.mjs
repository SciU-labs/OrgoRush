import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { getTetrahedralStereoCenters } from "../app/tetrahedral-stereochemistry.ts";
import { inspectTetrahedralCipPriorities } from "../app/double-bond-stereochemistry.ts";
import { presentValidatedSystematicName, reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { alcohols, acids, variants } from "./fixtures/multifunctional-reconciliation.mjs";

const base = "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine";
const achiralSmiles = "CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F";
function imported(smiles) {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, result.ok ? undefined : result.error);
  return result.molecule;
}
function permute(graph, transform) {
  return { ...graph,
    atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: transform(atom.id),
      ...(atom.tetrahedralBondTo !== undefined ? { tetrahedralBondTo: transform(atom.tetrahedralBondTo) } : {}) })),
    bonds: [...graph.bonds].reverse().map(([a,b,order,stereo]) => [transform(b),transform(a),order,stereo]),
    rings: graph.rings?.map(ring => ({ ...ring, atomIds:ring.atomIds.map(transform) })) };
}
function fragmentBySemanticId(step, semanticId) {
  return [step.fragments, ...(step.fragments?.additionalFragments ?? [])].find(fragment => fragment?.semanticId === semanticId);
}

test("fluoxetine unspecified, R and S names reconcile only with matching graph configuration", () => {
  const unspecified = imported(achiralSmiles);
  assert.equal(reconcileSystematicName(unspecified, base)?.status, "FULL");
  const unspecReasoning = buildValidatedPriorityReasoning({ derivation: reconcileSystematicName(unspecified, base),
    graph: unspecified, language: "en", activeName: base });
  const unspecStep = unspecReasoning.steps.find(step => step.title === "Stereochemistry");
  assert.ok(unspecStep);
  assert.match(unspecStep.explanation, /molecular graph specifies no configuration at C3/);
  assert.doesNotMatch(unspecStep.explanation, /descriptor is included/);

  for (const marker of ["@", "@@"]) {
    const graph = imported(`CNCC[C${marker}H](c1ccccc1)Oc1ccc(cc1)C(F)(F)F`);
    const center = getTetrahedralStereoCenters(graph)[0];
    assert.ok(center, "fluoxetine has one assigned tetrahedral center");
    const name = `(3${center.configuration})-${base}`;
    const proof = reconcileSystematicName(graph, name);
    assert.equal(proof?.status, "FULL", name);
    assert.equal(reconcileSystematicName(graph, `(3${center.configuration === "R" ? "S" : "R"})-${base}`), null);
    assert.equal(reconcileSystematicName(graph, base), null, "a configured graph cannot be reconciled to an unmarked name");
    assert.equal(reconcileSystematicName(graph, `(2${center.configuration})-${base}`), null, "wrong stereogenic locant is rejected");
    const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph, language: "en", activeName: name });
    const step = reasoning.steps.find(item => item.title === "Stereochemistry");
    assert.ok(step);
    assert.match(step.explanation, new RegExp(`molecular graph specifies ${center.configuration} at C3`));
    assert.match(step.explanation, /atoms directly attached|first atoms.*match/i,
      "the comparison identifies whether the ligands differ at the root or farther along their branches");
    assert.doesNotMatch(step.explanation, /sphere [2-9]|atomic number/i,
      "internal sphere indices and atomic-number diagnostics stay out of the learner-facing explanation");
    assert.deepEqual([1,2,3].map(rank => fragmentBySemanticId(step, `stereo-ligand:${center.atomId}:${rank}`)?.atomIds?.length > 0), [true,true,true]);
    assert.deepEqual(fragmentBySemanticId(step, `stereo-center:${center.atomId}`)?.atomIds, [center.atomId]);
    const priorities = inspectTetrahedralCipPriorities(graph, center.atomId);
    assert.deepEqual(priorities?.priorities.map(item => item.rank), [1,2,3,4]);

    const transformed = permute(graph, id => 900 + id * 17);
    const remappedProof = reconcileSystematicName(transformed, name);
    assert.equal(remappedProof?.status, "FULL", "atom IDs and order do not determine absolute configuration");
    const remappedCenter = getTetrahedralStereoCenters(transformed)[0];
    assert.equal(remappedCenter.configuration, center.configuration);
    const remappedReasoning = buildValidatedPriorityReasoning({ derivation: remappedProof, graph: transformed,
      language: "en", activeName: name });
    const remappedStep = remappedReasoning.steps.find(item => item.title === "Stereochemistry");
    assert.deepEqual([...fragmentBySemanticId(remappedStep, `stereo-ligand:${remappedCenter.atomId}:1`).atomIds].sort((a,b)=>a-b),
      fragmentBySemanticId(step, `stereo-ligand:${center.atomId}:1`).atomIds.map(id => 900 + id * 17).sort((a,b)=>a-b));
    const moved = { ...graph, atoms: graph.atoms.map((atom,index) => ({ ...atom, x: index * -91, y: index * 53 })) };
    const movedProof = reconcileSystematicName(moved, name);
    assert.equal(movedProof?.status, "FULL");
    const movedReasoning = buildValidatedPriorityReasoning({ derivation: movedProof, graph: moved, language: "en", activeName: name });
    const movedStep = movedReasoning.steps.find(item => item.title === "Stereochemistry");
    assert.deepEqual(fragmentBySemanticId(movedStep, `stereo-ligand:${center.atomId}:1`).atomIds,
      fragmentBySemanticId(step, `stereo-ligand:${center.atomId}:1`).atomIds);
  }
});

test("adrenaline distinguishes phenolic suffix hydroxyls, side-chain locants and rooted CIP branches", () => {
  const [label,name,smiles]=alcohols[0],graph=imported(smiles),proof=reconcileSystematicName(graph,name);
  assert.equal(proof?.status,"FULL",label);
  const parent=new Set(proof.components.find(component=>component.id==="parent").atomIds);
  const suffix=proof.components.find(component=>component.id==="suffix");
  const suffixHydroxyls=suffix.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"
    &&graph.bonds.some(([a,b,order])=>order===1&&(a===id&&parent.has(b)||b===id&&parent.has(a))));
  assert.equal(suffixHydroxyls.length,2);
  for(const language of ["en","es"]){
    const reasoning=buildValidatedPriorityReasoning({derivation:proof,graph,language,activeName:name});
    const functionStep=reasoning.steps.find(step=>step.title===(language==="en"?"Principal functional group":"Grupo funcional principal"));
    const parentStep=reasoning.steps.find(step=>step.title===(language==="en"?"Parent structure":"Estructura principal"));
    const numbering=reasoning.steps.find(step=>step.title===(language==="en"?"Numbering":"Numeración"));
    const substituents=reasoning.steps.find(step=>step.title===(language==="en"?"Substituents and locants":"Sustituyentes y localizadores"));
    const stereo=reasoning.steps.find(step=>step.title===(language==="en"?"Stereochemistry":"Estereoquímica"));
    assert.match(functionStep.explanation,language==="en"?/Under P-41.*phenolic and alcoholic hydroxyl groups belong to the same.*Two hydroxyl groups bonded directly to the aromatic ring/i:/Según P-41.*fenólicos y alcohólicos pertenecen a la misma clase.*Dos grupos hidroxilo unidos directamente al anillo aromático/i);
    assert.match(parentStep.explanation,language==="en"?/P-44\.1\.1.*ring carries 2.*attached carbon chain carries at most 1/i:/P-44\.1\.1.*anillo aromático lleva 2.*cadena carbonada lateral.*1/i);
    assert.doesNotMatch(parentStep.explanation,language==="en"?/phenol outranks alcohol|phenolic.*senior/i:/fenol.*prioridad|fenólico.*senior/i);
    assert.match(numbering.explanation,language==="en"?/parent C4.*ethyl.*C1.*hydroxyl.*C2.*methylamino/i:/C4.*etil.*C1.*hidroxilo.*C2.*metilamino/i);
    assert.match(substituents.explanation,language==="en"?/2-carbon ethyl.*–OH at C1.*methylamino at C2.*nitrogen is bonded to the methyl group/i:/etil de 2 carbonos.*–OH en C1.*metilamino en C2.*nitrógeno.*grupo metil/i);
    assert.doesNotMatch(substituents.explanation,/heteroatom|átomo|alkyl group|grupo\(s\) alquilo|numbered skeleton|esqueleto numerado/i);
    assert.match(stereo.explanation,language==="en"?/C1 of the ethyl substituent.*clockwise.*molecular graph specifies R at C1/i:/C1 de la cadena etil.*horario.*grafo molecular especifica R en C1/i);
    assert.match(stereo.explanation,language==="en"?/–CH₂–NH–CH₃.*first atoms.*nitrogen outranks carbon.*aromatic ring bearing 2 hydroxyl groups/i:/–CH₂–NH–CH₃.*primeros átomos.*nitrógeno tiene prioridad sobre carbono.*anillo aromático con 2 grupos hidroxilo/i);
    const center=graph.atoms.find(atom=>atom.tetrahedralParity);
    assert.ok(fragmentBySemanticId(stereo,`stereo-ligand:${center.id}:2`)?.atomIds.length>0);
    assert.ok(fragmentBySemanticId(stereo,`stereo-ligand:${center.id}:3`)?.atomIds.length>0);
    assert.ok([stereo.fragments,...stereo.fragments.additionalFragments].every(fragment=>!fragment?.explanation),
      "CIP explanation is not repeated below every selection control");
  }
});

test("salbutamol distinguishes its phenolic suffix from both side-chain alcohol prefixes",()=>{
  const [label,name,smiles]=alcohols[1],graph=imported(smiles),proof=reconcileSystematicName(graph,name);
  assert.equal(proof?.status,"FULL",label);
  const ring=new Set(proof.components.find(component=>component.id==="parent").atomIds);
  const suffix=proof.components.find(component=>component.id==="suffix");
  const ringHydroxyls=suffix.atomIds.filter(id=>graph.atoms.find(atom=>atom.id===id)?.element==="O"
    &&graph.bonds.some(([a,b,order])=>order===1&&(a===id&&ring.has(b)||b===id&&ring.has(a))));
  assert.equal(ringHydroxyls.length,1);
  for(const language of ["en","es"]){
    const reasoning=buildValidatedPriorityReasoning({derivation:proof,graph,language,activeName:name});
    const steps=reasoning.steps;
    const functionStep=steps.find(step=>step.title===(language==="en"?"Principal functional group":"Grupo funcional principal"));
    const parentStep=steps.find(step=>step.title===(language==="en"?"Parent structure":"Estructura principal"));
    const numbering=steps.find(step=>step.title===(language==="en"?"Numbering":"Numeración"));
    assert.match(functionStep.explanation,language==="en"?/Under P-41.*phenolic and alcoholic hydroxyl groups belong to the same.*One hydroxyl group bonded directly to the aromatic ring/i:/Según P-41.*fenólicos y alcohólicos pertenecen a la misma clase.*Un grupo hidroxilo unido directamente al anillo aromático/i);
    assert.match(parentStep.explanation,language==="en"?/P-44\.1\.1 ties.*at 1.*P-44\.1\.2\.2 prefers the ring over the chain/i:/P-44\.1\.1 empata.*con 1 grupo.*P-44\.1\.2\.2 da preferencia al anillo sobre la cadena/i);
    assert.doesNotMatch(parentStep.explanation,language==="en"?/phenol outranks alcohol|phenolic.*senior/i:/fenol.*prioridad|fenólico.*senior/i);
    assert.match(numbering.explanation,language==="en"?/C2.*tert-butylamino/i:/C2.*terc-butilamino/i);
    assert.doesNotMatch(numbering.explanation,/methylamino|metilamino/i,"a tert-butylamino branch must not be mislabeled methylamino");
    const nested=steps.find(step=>step.title===(language==="en"?"Substituents and locants":"Sustituyentes y localizadores"));
    assert.match(nested.explanation,language==="en"?/C4.*ethyl.*–OH at C1.*tert-butylamino at C2/i:/C4.*etil.*–OH en C1.*terc-butilamino en C2/i);
    assert.doesNotMatch(nested.explanation,/heteroatom|átomo|alkyl group|grupo\(s\) alquilo|numbered skeleton|esqueleto numerado/i);
  }
});

test("the same R/S proof has a bilingual pedagogical explanation", () => {
  const graph = imported("CNCC[C@H](c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  const center = getTetrahedralStereoCenters(graph)[0];
  const name = `(3${center.configuration})-${base}`;
  const derivation = reconcileSystematicName(graph, name);
  assert.equal(derivation?.status, "FULL");
  const reasoning = buildValidatedPriorityReasoning({ derivation, graph, language: "es", activeName: name });
  const step = reasoning.steps.find(item => item.title === "Estereoquímica");
  assert.ok(step);
  assert.match(step.explanation, /prioridades CIP distintas/);
  assert.ok(step.fragments.additionalFragments.some(fragment => fragment.label.startsWith("Seleccionar Prioridad")));
  const localized = presentValidatedSystematicName(derivation, "es").name;
  assert.match(localized, /^\(3[RS]\)-/);
  assert.equal(reconcileSystematicName(graph, localized)?.status, "FULL");
});

test("two-center tartaric acid validates all written configurations and rejects a changed descriptor", () => {
  const name = "(2R,3R)-2,3-dihydroxybutanedioic acid";
  const graph = imported("O=C(O)[C@H](O)[C@@H](O)C(=O)O");
  const proof = reconcileSystematicName(graph, name);
  assert.equal(proof?.status, "FULL");
  assert.equal(proof.components.filter(component => component.id.startsWith("stereo-")).length, 2);
  assert.equal(reconcileSystematicName(graph, "(2S,3R)-2,3-dihydroxybutanedioic acid"), null);
  assert.equal(reconcileSystematicName(imported("O=C(O)C(O)C(O)C(=O)O"), name), null);
  for(const language of ["en","es"]){
    const reasoning=buildValidatedPriorityReasoning({derivation:proof,graph,language,activeName:language==="en"?name:presentValidatedSystematicName(proof,"es").name});
    const stereo=reasoning.steps.find(item=>item.title===(language==="en"?"Stereochemistry":"Estereoquímica"));
    assert.match(stereo.explanation,language==="en"?/carboxyl group \(–C\(=O\)OH\).*first atoms.*match|root atoms/i:/grupo carboxilo \(–C\(=O\)OH\).*primeros átomos.*coinciden/i);
    assert.doesNotMatch(stereo.explanation,/carbon branch|rama carbonada/);
  }
});

test("stereochemistry generalizes to the supported multifunctional corpus and a synthetic two-center aminoalcohol", () => {
  const cases = [
    alcohols[0], // adrenaline: nested (1R) descriptor
    alcohols[1], // salbutamol: potentially stereogenic but unspecified
    alcohols[2], // venlafaxine
    alcohols[3], // metoprolol
    acids[1], acids[2], acids[4],
    variants[0], // carvone: stereogenic ring carbon, unspecified
    ["Dopamine", "4-(2-aminoethyl)benzene-1,2-diol", "NCCc1ccc(O)c(O)c1"],
    ["Ibuprofen", "2-[4-(2-methylpropyl)phenyl]propanoic acid", "CC(C)Cc1ccc(C(C)C(=O)O)cc1"],
  ];
  for (const [label, name, smiles] of cases) {
    const graph = imported(smiles), proof = reconcileSystematicName(graph, name);
    assert.equal(proof?.status, "FULL", label);
    const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph, language: "en", activeName: name });
    const step = reasoning.steps.find(item => item.title === "Stereochemistry");
    if (graph.atoms.some(atom => atom.tetrahedralParity)) assert.ok(step, `${label} has a descriptor explanation`);
    if (step && !graph.atoms.some(atom => atom.tetrahedralParity))
      assert.match(step.explanation, /no R\/S descriptor is added/i, label);
  }

  const syntheticSmiles = "CCNC[C@H](O)[C@@H](NC)C";
  const syntheticName = "(2S,3S)-1-(ethylamino)-3-(methylamino)butan-2-ol";
  const synthetic = imported(syntheticSmiles), proof = reconcileSystematicName(synthetic, syntheticName);
  assert.equal(proof?.status, "FULL");
  const reasoning = buildValidatedPriorityReasoning({ derivation: proof, graph: synthetic, language: "es", activeName: syntheticName });
  const stereo = reasoning.steps.find(item => item.title === "Estereoquímica");
  assert.ok(stereo);
  assert.match(stereo.explanation, /C2.*C3/);
  assert.equal(reconcileSystematicName(synthetic, "(2R,3S)-1-(ethylamino)-3-(methylamino)butan-2-ol"), null);
});
