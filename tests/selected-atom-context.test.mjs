import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { buildValidatedVisualNumbering } from "../app/visual-numbering.ts";
import { selectedAromaticCarboxylCarbonContext } from "../app/selected-atom-context.ts";

const aspirinSmiles="CC(=O)Oc1ccccc1C(=O)O";
const aspirinNames=["2-acetyloxybenzoic acid","2-(acetyloxy)benzoic acid"];
const imported=smiles=>{
  const result=moleculeFromSmiles(smiles);
  assert.equal(result.ok,true,result.error);
  return result.molecule;
};
const edge=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

function context(molecule,name,selectedAtomId,language="es"){
  const derivation=reconcileSystematicName(molecule,name);
  assert.equal(derivation?.status,"FULL",name);
  return selectedAromaticCarboxylCarbonContext({molecule,derivation,selectedAtomId,language,
    visualNumbering:buildValidatedVisualNumbering(molecule,derivation)});
}

function aspirinIds(molecule,derivation){
  const parent=derivation.components.find(component=>component.id==="parent");
  const suffix=derivation.components.find(component=>component.id==="suffix");
  const acyloxy=derivation.components.find(component=>component.id==="acyloxy");
  const ring=molecule.rings.find(item=>item.kind==="aromatic"&&item.atomIds.length===6
    &&item.atomIds.every(id=>parent.atomIds.includes(id)));
  const c1=parent.numbering.find(([,locant])=>locant===1)[0];
  const carboxylCarbon=parent.atomIds.find(id=>suffix.atomIds.includes(id)&&!ring.atomIds.includes(id)
    &&molecule.atoms.find(atom=>atom.id===id)?.element==="C");
  const acetylCarbonyl=acyloxy.atomIds.find(id=>molecule.atoms.find(atom=>atom.id===id)?.element==="C"
    &&molecule.bonds.some(([a,b,order])=>order===2&&(a===id&&molecule.atoms.find(atom=>atom.id===b)?.element==="O"
      ||b===id&&molecule.atoms.find(atom=>atom.id===a)?.element==="O")));
  assert.ok(molecule.bonds.some(([a,b])=>edge(a,b)===edge(c1,carboxylCarbon)));
  assert.ok(carboxylCarbon!==c1&&!ring.atomIds.includes(carboxylCarbon));
  assert.ok(acyloxy.atomIds.includes(acetylCarbonyl));
  return {c1,carboxylCarbon,acetylCarbonyl,ring};
}

test("aspirin carboxyl-carbon notice is exact and follows the active language",()=>{
  const molecule=imported(aspirinSmiles),derivation=reconcileSystematicName(molecule,aspirinNames[0]);
  const {carboxylCarbon}=aspirinIds(molecule,derivation);
  assert.deepEqual(context(molecule,aspirinNames[0],carboxylCarbon),{
    heading:"Carbono carboxílico:",
    explanation:"forma parte del grupo funcional principal (–COOH), pero no de la numeración C1–C6 del anillo aromático.",
  });
  assert.deepEqual(context(molecule,aspirinNames[0],carboxylCarbon,"en"),{
    heading:"Carboxyl carbon:",
    explanation:"belongs to the principal functional group (–COOH), but is not part of the aromatic ring's C1–C6 numbering.",
  });
});

test("only the verified benzoic-acid carboxyl carbon receives this notice",()=>{
  const aspirin=imported(aspirinSmiles),derivation=reconcileSystematicName(aspirin,aspirinNames[1]);
  const {c1,carboxylCarbon,acetylCarbonyl}=aspirinIds(aspirin,derivation);
  assert.ok(context(aspirin,aspirinNames[1],carboxylCarbon));
  assert.equal(context(aspirin,aspirinNames[1],c1),null,"aromatic C1 is not the outside carboxyl carbon");
  assert.equal(context(aspirin,aspirinNames[1],acetylCarbonyl),null,"the acetyl ester carbonyl is not the principal acid carbonyl");

  const salicylic=imported("O=C(O)c1ccccc1O"),salicylicName="2-hydroxybenzoic acid";
  const salicylicDerivation=reconcileSystematicName(salicylic,salicylicName);
  assert.equal(salicylicDerivation?.status,"FULL");
  const salicylicParent=salicylicDerivation.components.find(component=>component.id==="parent");
  const salicylicSuffix=salicylicDerivation.components.find(component=>component.id==="suffix");
  const salicylicRing=salicylic.rings.find(item=>item.kind==="aromatic"&&item.atomIds.length===6);
  const salicylicCarbon=principalCarboxylCarbon(salicylic,salicylicParent,salicylicSuffix,salicylicRing);
  assert.ok(selectedAromaticCarboxylCarbonContext({molecule:salicylic,derivation:salicylicDerivation,
    selectedAtomId:salicylicCarbon,language:"es",visualNumbering:buildValidatedVisualNumbering(salicylic,salicylicDerivation)}));

  const benzoic=imported("O=C(O)c1ccccc1"),benzoicName="benzoic acid";
  const benzoicDerivation=reconcileSystematicName(benzoic,benzoicName);
  assert.equal(benzoicDerivation?.status,"FULL");
  const benzoicParent=benzoicDerivation.components.find(component=>component.id==="parent");
  const benzoicSuffix=benzoicDerivation.components.find(component=>component.id==="suffix");
  const benzoicRing=benzoic.rings.find(item=>item.kind==="aromatic"&&item.atomIds.length===6);
  const benzoicCarbon=principalCarboxylCarbon(benzoic,benzoicParent,benzoicSuffix,benzoicRing);
  const benzoicNumbering=buildValidatedVisualNumbering(benzoic,benzoicDerivation);
  assert.equal(benzoicNumbering.size,1,"the symmetric ring keeps only its explicit C1 locant");
  assert.ok(selectedAromaticCarboxylCarbonContext({molecule:benzoic,derivation:benzoicDerivation,
    selectedAtomId:benzoicCarbon,language:"es",visualNumbering:benzoicNumbering}));
});

function principalCarboxylCarbon(molecule,parent,suffix,ring){
  return parent.atomIds.find(id=>suffix.atomIds.includes(id)&&!ring.atomIds.includes(id)
    &&molecule.atoms.find(atom=>atom.id===id)?.element==="C");
}

test("equivalent SMILES and permuted atom IDs preserve the selected carboxyl carbon",()=>{
  for(const smiles of [aspirinSmiles,"O=C(O)c1ccccc1OC(C)=O","CC(=O)Oc1ccccc1C(O)=O"]){
    const molecule=imported(smiles),derivation=reconcileSystematicName(molecule,aspirinNames[0]);
    const {carboxylCarbon,ring}=aspirinIds(molecule,derivation);
    assert.ok(context(molecule,aspirinNames[0],carboxylCarbon));
    const idMap=new Map(molecule.atoms.map((atom,index)=>[atom.id,1200+(molecule.atoms.length-index)*19]));
    const remapped={atoms:[...molecule.atoms].reverse().map(atom=>({...atom,id:idMap.get(atom.id)})),
      bonds:[...molecule.bonds].reverse().map(([a,b,order,stereo])=>[idMap.get(b),idMap.get(a),order,stereo]),
      rings:molecule.rings.map(item=>({...item,atomIds:[...item.atomIds].reverse().map(id=>idMap.get(id))}))};
    const remappedDerivation=reconcileSystematicName(remapped,aspirinNames[0]);
    const mappedCarbon=idMap.get(carboxylCarbon);
    assert.ok(selectedAromaticCarboxylCarbonContext({molecule:remapped,derivation:remappedDerivation,
      selectedAtomId:mappedCarbon,language:"en",visualNumbering:buildValidatedVisualNumbering(remapped,remappedDerivation)}));
    assert.ok(ring.atomIds.every(id=>idMap.has(id)));
  }
});

test("acyclic acid carbon C1 does not get the aromatic-ring explanation",()=>{
  const molecule=imported("CCC(=O)O"),name="propanoic acid",derivation=reconcileSystematicName(molecule,name);
  assert.equal(derivation?.status,"FULL");
  const parent=derivation.components.find(component=>component.id==="parent");
  const carbonyl=parent.numbering.find(([,locant])=>locant===1)[0];
  assert.equal(selectedAromaticCarboxylCarbonContext({molecule,derivation,selectedAtomId:carbonyl,
    language:"es",visualNumbering:buildValidatedVisualNumbering(molecule,derivation)}),null);
  assert.equal(selectedAromaticCarboxylCarbonContext({molecule,derivation:null,selectedAtomId:carbonyl,
    language:"es",visualNumbering:new Map()}),null,"PARTIAL evidence cannot activate the explanation");
});

test("mouse and keyboard atom selection both feed the contextual notice from selectedId",()=>{
  const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(page,/selectedAromaticCarboxylCarbonContext\(\{[\s\S]*?selectedAtomId:\s*selectedId/);
  assert.match(page,/onClick=\{\(event\)\s*=>\s*\{[\s\S]*?setSelectedId\(atom\.id\)/);
  assert.match(page,/onKeyDown=\{\(event\)\s*=>\s*\{[\s\S]*?setSelectedId\(atom\.id\)/);
  assert.match(page,/const notice = selectedCarboxylContext\s*\?[\s\S]*?:\s*baseNotice/);
  assert.match(page,/selectedCarboxylContext && !advancedScreenReaderEnabled\s*&&\s*\([\s\S]*?className="contextual-atom-announcement" role="status" aria-live="polite"/);
  assert.match(page,/className="notice"\s*role=\{advancedScreenReaderEnabled \? "status" : undefined\}\s*aria-live=\{advancedScreenReaderEnabled \? "polite" : undefined\}[\s\S]*?\{localizedDynamicText\(notice\)\}/);
});
