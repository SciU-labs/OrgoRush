import assert from "node:assert/strict";
import test from "node:test";
import { CanonizerUtil, Molecule, SmilesParser } from "openchemlib";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { presentValidatedSystematicName } from "../app/validated-name-derivation.ts";
import { normalizeMoleculePayload } from "../app/api/molecule-payload.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { sanitizeTetrahedralStereochemistry } from "../app/tetrahedral-stereochemistry.ts";

const references={
  cis:"[H][C@]12CCCC[C@@]1([H])CCCC2",
  trans:"[H][C@]12CCCC[C@]1([H])CCCC2",
};

function stereochemicalId(smiles){
  const molecule=new SmilesParser().parseMolecule(smiles);
  molecule.ensureHelperArrays(Molecule.cHelperCIP);
  return CanonizerUtil.getIDCode(molecule,CanonizerUtil.NORMAL);
}

test("cis/trans decalins preserve distinct junction configurations through editable graph export",()=>{
  const cis=moleculeFromSmiles(references.cis),trans=moleculeFromSmiles(references.trans);
  assert.equal(cis.ok,true);assert.equal(trans.ok,true);
  const cisExport=moleculeToSmiles(cis.molecule),transExport=moleculeToSmiles(trans.molecule);
  assert.equal(cisExport.ok,true);assert.equal(transExport.ok,true);
  assert.equal(stereochemicalId(cisExport.smiles),stereochemicalId(references.cis),"cis junction relation must survive import/export");
  assert.equal(stereochemicalId(transExport.smiles),stereochemicalId(references.trans),"trans junction relation must survive import/export");
  assert.notEqual(stereochemicalId(cisExport.smiles),stereochemicalId(transExport.smiles),"cis and trans must remain distinct stereoisomers");
});

test("decalin names reconcile only with the matching specified or unspecified fusion relation",()=>{
  const cis=moleculeFromSmiles(references.cis),trans=moleculeFromSmiles(references.trans),unspecified=moleculeFromSmiles("C1CCC2CCCCC2C1");
  assert.equal(cis.ok,true);assert.equal(trans.ok,true);assert.equal(unspecified.ok,true);
  for(const [name,graph] of [["cis-decalin",cis.molecule],["cis-decalina",cis.molecule],
    ["(4as,8as)-decahydronaphthalene",cis.molecule],["trans-decalin",trans.molecule],
    ["(4ar,8ar)-decahidronaftaleno",trans.molecule],["decalin",unspecified.molecule],
    ["decahidronaftaleno",unspecified.molecule]]) assert.equal(reconcileSystematicName(graph,name)?.status,"FULL",name);
  for(const [name,graph] of [["trans-decalin",cis.molecule],["cis-decalin",trans.molecule],
    ["cis-decalin",unspecified.molecule],["decalin",cis.molecule],["decalin",trans.molecule]])
    assert.equal(reconcileSystematicName(graph,name),null,`${name} must not reconcile to a different fusion configuration`);
  const model=reconcileSystematicName(cis.molecule,"cis-decalina");assert.ok(model);
  assert.deepEqual(presentValidatedSystematicName(model,"en"),{name:"cis-decalin",language:"en",localized:true});
  const reasoning=buildValidatedPriorityReasoning({derivation:model,graph:cis.molecule,language:"es"});
  const junction=reasoning.steps.flatMap(step=>Object.values(step.fragmentTargets)).find(target=>
    target.atomIds.length===2&&target.bondIds.length===1);
  assert.deepEqual([...junction.atomIds].sort((a,b)=>a-b),[...cis.molecule.fusedRingJunctionStereo.fusionAtomIds].sort((a,b)=>a-b));
  assert.deepEqual(junction.bondIds.map(pair=>[...pair].sort((a,b)=>a-b)),[cis.molecule.fusedRingJunctionStereo.fusionBond.slice().sort((a,b)=>a-b)]);
});

test("the bounded name grammar carries fusion metadata through validated persistence",()=>{
  for(const name of ["decalin","cis-decalin","trans-decalin","decalina","cis-decalina","trans-decalina",
    "decahydronaphthalene","cis-decahydronaphthalene","(4as,8as)-decahydronaphthalene",
    "decahidronaftaleno","trans-decahidronaftaleno","(4ar,8ar)-decahidronaftaleno"]){
    const built=buildHydrocarbonFromIupacName(name);assert.equal(built.ok,true,name);
    const proof=reconcileSystematicName(built.molecule,name);assert.equal(proof?.status,"FULL",name);
    const payload=normalizeMoleculePayload(built.molecule);assert.ok(payload,name);
    assert.equal(payload.fusedRingJunctionStereo?.configuration,built.molecule.fusedRingJunctionStereo?.configuration,name);
  }
});

test("permuted SMILES retain relative fusion and partial or stale assignments fail closed",()=>{
  const cis=moleculeFromSmiles("C1C[C@H](CCCC2)[C@H]2CC1");
  const trans=moleculeFromSmiles("C(CC1)C[C@H]2[C@H]1CCCC2");
  assert.equal(cis.ok,true);assert.equal(trans.ok,true);
  assert.equal(cis.molecule.fusedRingJunctionStereo.configuration,"cis");
  assert.equal(trans.molecule.fusedRingJunctionStereo.configuration,"trans");
  assert.equal(stereochemicalId(moleculeToSmiles(cis.molecule).smiles),stereochemicalId(references.cis));
  assert.equal(stereochemicalId(moleculeToSmiles(trans.molecule).smiles),stereochemicalId(references.trans));
  assert.equal(moleculeFromSmiles("C1CC[C@H]2CCCCC2C1").ok,false,"a partial fusion assignment must never be imported as specified");
  const edited={...cis.molecule,bonds:cis.molecule.bonds.slice(1)};
  assert.equal(sanitizeTetrahedralStereochemistry(edited).fusedRingJunctionStereo,undefined,
    "a topology edit that invalidates the recognized fusion must clear stale junction metadata");
  const malformed={...cis.molecule,rings:cis.molecule.rings.map((ring,index)=>index?ring:{...ring,atomIds:[ring.atomIds[0],ring.atomIds[2],ring.atomIds[1],...ring.atomIds.slice(3)]})};
  assert.equal(moleculeToSmiles(malformed).ok,false,"ring metadata must follow the actual graph cycles before stereo export");
  assert.equal(normalizeMoleculePayload(malformed),null,"API persistence must reject unverifiable ring metadata");
});
