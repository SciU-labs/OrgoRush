import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { nameRetainedFused1979 } from "../app/iupac1979-retained-fused.ts";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { legacyGraphsIdentical } from "../app/iupac1979-name-structure.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";
import { parseFusedPartiallySaturatedName } from "../app/fused-partially-saturated-grammar.ts";
import { buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";

const corpus=[
  ["indane","2,3-dihydro-1H-indene","2,3-dihidro-1H-indeno"],
  ["1-methylindane","1-methyl-2,3-dihydro-1H-indene","1-metil-2,3-dihidro-1H-indeno"],
  ["2-methylindane","2-methyl-2,3-dihydro-1H-indene","2-metil-2,3-dihidro-1H-indeno"],
  ["5-methylindane","5-methyl-2,3-dihydro-1H-indene","5-metil-2,3-dihidro-1H-indeno"],
  ["indan-1-ol","2,3-dihydro-1H-inden-1-ol","2,3-dihidro-1H-inden-1-ol"],
  ["indan-2-ol","2,3-dihydro-1H-inden-2-ol","2,3-dihidro-1H-inden-2-ol"],
  ["indan-1-one","2,3-dihydroinden-1-one","2,3-dihidroinden-1-ona"],
  ["indene","1H-indene","1H-indeno"],
  ["2-methylindene","2-methyl-1H-indene","2-metil-1H-indeno"],
  ["3-methylindene","3-methyl-1H-indene","3-metil-1H-indeno"],
  ["5-methylindene","5-methyl-1H-indene","5-metil-1H-indeno"],
  ["5-bromoindene","5-bromo-1H-indene","5-bromo-1H-indeno"],
  ["6-chloroindene","6-chloro-1H-indene","6-cloro-1H-indeno"],
  ["tetralin","1,2,3,4-tetrahydronaphthalene","1,2,3,4-tetrahidronaftaleno"],
  ["1-methyltetralin","1-methyl-1,2,3,4-tetrahydronaphthalene","1-metil-1,2,3,4-tetrahidronaftaleno"],
  ["2-methyltetralin","2-methyl-1,2,3,4-tetrahydronaphthalene","2-metil-1,2,3,4-tetrahidronaftaleno"],
  ["5-methyltetralin","5-methyl-1,2,3,4-tetrahydronaphthalene","5-metil-1,2,3,4-tetrahidronaftaleno"],
  ["tetralin-1-ol","1,2,3,4-tetrahydronaphthalen-1-ol","1,2,3,4-tetrahidronaftalen-1-ol"],
  ["tetralin-2-ol","1,2,3,4-tetrahydronaphthalen-2-ol","1,2,3,4-tetrahidronaftalen-2-ol"],
  ["1-tetralone","3,4-dihydro-2H-naphthalen-1-one","3,4-dihidro-2H-naftalen-1-ona"],
];
const independentReferences=JSON.parse(readFileSync(new URL("./fixtures/fused-partially-saturated-5plus6-pubchem.json",import.meta.url),"utf8"));

const locants = ["1", "2", "3", "3a", "4", "5", "6", "7", "7a"];
const parentEdges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,0],[3,8]];
const indaneDoubles = new Set(["3:8", "4:5", "6:7"]);
const indeneDoubles = new Set(["1:2", "3:8", "4:5", "6:7"]);
const edgeKey = (a,b) => a < b ? `${a}:${b}` : `${b}:${a}`;
function graph(parent="indane", attach=[]) {
  const bonds=parentEdges.map(([a,b])=>[a+1,b+1,(parent==="indene"?indeneDoubles:indaneDoubles).has(edgeKey(a,b))?2:1]);
  const atoms=locants.map((_,i)=>({id:i+1,element:"C",x:Math.cos(i),y:Math.sin(i)}));
  for(const item of attach){const id=atoms.length+1;atoms.push({id,element:item.element??"C",x:3+id,y:0});bonds.push([Number(item.anchor)+1,id,item.order??1]);}
  return {atoms,bonds};
}

test("indane uses the hydrogenated indene PIN and preserves traditional indene numbering", () => {
  const result=nameRetainedFused1979(graph());
  assert.equal(result.status,"SUPPORTED",result.reason);
  assert.equal(result.parentId,"indane");
  assert.equal(result.nameEn,"2,3-dihydro-1H-indene");
  assert.equal(result.nameEs,"2,3-dihidro-1H-indeno");
  assert.deepEqual([...result.locants.values()].sort(),["1","2","3","3a","4","5","6","7","7a"].sort());
});

test("indane derivatives locate methyl, alcohol and ketone through the graph", () => {
  const methyl=nameRetainedFused1979(graph("indane",[{anchor:0}]));
  assert.equal(methyl.nameEn,"1-methyl-2,3-dihydro-1H-indene");
  assert.equal(methyl.nameEs,"1-metil-2,3-dihidro-1H-indeno");
  const alcohol=nameRetainedFused1979(graph("indane",[{anchor:1,element:"O"}]));
  assert.equal(alcohol.nameEn,"2,3-dihydro-1H-inden-2-ol");
  assert.equal(alcohol.nameEs,"2,3-dihidro-1H-inden-2-ol");
  const ketone=nameRetainedFused1979(graph("indane",[{anchor:0,element:"O",order:2}]));
  assert.equal(ketone.nameEn,"2,3-dihydroinden-1-one");
  assert.equal(ketone.nameEs,"2,3-dihidroinden-1-ona");
});

test("partial hydrogenation is constitutional and is invariant to atom IDs and drawing coordinates", () => {
  const indene=nameRetainedFused1979(graph("indene"));
  assert.equal(indene.status,"SUPPORTED",indene.reason);
  assert.equal(indene.parentId,"indene");
  assert.equal(indene.nameEn,"indene");
  assert.equal(nameRetainedFused1979(graph()).parentId,"indane");
  const source=graph("indane"), remap=new Map(source.atoms.map((atom,i)=>[atom.id,100-i*7]));
  const permuted={atoms:source.atoms.map((atom,i)=>({...atom,id:remap.get(atom.id),x:i*91,y:-i*13})).reverse(),
    bonds:source.bonds.map(([a,b,o])=>[remap.get(b),remap.get(a),o]).reverse()};
  const result=nameRetainedFused1979(permuted);
  assert.equal(result.status,"SUPPORTED",result.reason);
  assert.equal(result.nameEn,"2,3-dihydro-1H-indene");
});

test("the retained route fails closed for incompatible bonds, charge, missing branches and wrong valence", () => {
  const source=graph();
  const changes=[
    g=>g.bonds.find(b=>edgeKey(b[0]-1,b[1]-1)==="3:8")[2]=1,
    g=>g.atoms[0].charge=1,
    g=>g.bonds.pop(),
    g=>g.bonds.push([1,999,1]),
    g=>g.bonds.push([1,1,1]),
    g=>g.bonds[0][2]=3,
    g=>g.atoms.push({id:90,element:"C",x:0,y:0}),
    g=>g.bonds.push([1,90,2]),
    g=>g.atoms[0].tetrahedralParity="R",
    g=>g.atoms[0].element="N",
    g=>g.bonds.push([1,2,1]),
    g=>g.bonds.push([1,90,1]),
  ];
  for(const change of changes){const mutated=structuredClone(source);change(mutated);assert.equal(nameRetainedFused1979(mutated).status,"UNSUPPORTED");}
});

test("the 20 independently conciliated 5+6 and partially hydrogenated 6+6 reference names are FULL in both languages",()=>{
  for(const [id,en,es] of corpus){
    for(const [language,name] of [["en",en],["es",es]]){
      const built=buildHydrocarbonFromIupacName(name);assert.equal(built.ok,true,`${id}/${language}: ${built.error}`);
      assert.equal(built.inputFamily,"fused-partially-saturated-bicycle",`${id}/${language}`);
      const proof=reconcileSystematicName(built.molecule,name);
      assert.equal(proof?.status,"FULL",`${id}/${language}: strict graph reconciliation`);
      assert.equal(proof?.evidence?.language,language,`${id}/${language}: independent language grammar`);
      assert.equal(proof?.evidence?.construction,"fused-partially-saturated-bicycle");
    }
  }
  assert.equal(corpus.length,20);
});

test("all 20 bilingual structures match independent PubChem connectivity references",()=>{
  assert.equal(independentReferences.records.length,corpus.length);
  for(let index=0;index<corpus.length;index++){
    const [id,en,es]=corpus[index], reference=independentReferences.records[index];
    assert.equal(reference.name,id,`reference row ${index}`);
    const expected=moleculeFromSmiles(reference.smiles);
    assert.equal(expected.ok,true,`${id}: PubChem connectivity SMILES must parse`);
    for(const [language,name] of [["EN",en],["ES",es]]){
      const built=buildHydrocarbonFromIupacName(name);
      assert.equal(built.ok,true,`${id}/${language}: ${built.error}`);
      const graph=molecule=>({atoms:molecule.atoms.map(({id,element,charge})=>({id,element,charge})),bonds:molecule.bonds.map(([a,b,order=1])=>[a,b,order])});
      assert.equal(legacyGraphsIdentical(graph(expected.molecule),graph(built.molecule)),true,`${id}/${language} graph differs from PubChem CID ${reference.cid}`);
    }
  }
});

test("saturated-ring alcohols are not explained as hydroxyls on the aromatic region",()=>{
  for(const [en,es] of [["2,3-dihydro-1H-inden-1-ol","2,3-dihidro-1H-inden-1-ol"],["1,2,3,4-tetrahydronaphthalen-1-ol","1,2,3,4-tetrahidronaftalen-1-ol"]]){
    const built=buildHydrocarbonFromIupacName(es);assert.equal(built.ok,true,es);
    for(const [language,name] of [["es",es],["en",en]]){
      const proof=reconcileSystematicName(built.molecule,name);assert.equal(proof?.status,"FULL",`${language} ${name}`);
      const reasoning=buildValidatedPriorityReasoning({derivation:proof,graph:built.molecule,language});
      const parentStep=reasoning.steps.find(step=>step.title===(language==="en"?"Parent structure":"Estructura principal"));
      assert(parentStep,`${language} ${name}: parent explanation`);
      assert.doesNotMatch(parentStep.explanation,/aromatic ring carries 1|anillo aromático lleva 1/i);
    }
  }
});

test("cis/trans decalin configurations cannot reconcile as an explicitly specified isomer",()=>{
  const base=buildHydrocarbonFromIupacName("1,2,3,4-tetrahydronaphthalene");assert.equal(base.ok,true);
  const ringAtoms=base.molecule.rings[0].atomIds.filter(id=>base.molecule.rings[1].atomIds.includes(id));assert.equal(ringAtoms.length,2);
  const makeDecalin=(parities)=>{
    const molecule=structuredClone(base.molecule);
    molecule.bonds=molecule.bonds.map(([a,b])=>[a,b,1]);
    for(const [id,configuration] of parities)molecule.atoms.find(atom=>atom.id===id).tetrahedralParity=configuration;
    return molecule;
  };
  const fusionA=makeDecalin([[ringAtoms[0],"R"],[ringAtoms[1],"S"]]);
  const fusionB=makeDecalin([[ringAtoms[0],"R"],[ringAtoms[1],"R"]]);
  const constitutional=molecule=>({atoms:molecule.atoms.map(({tetrahedralParity:_parity,...atom})=>atom),bonds:molecule.bonds});
  assert.deepEqual(constitutional(fusionA),constitutional(fusionB),"the test pair differs only in fusion stereochemistry");
  assert.notDeepEqual(fusionA.atoms.map(atom=>atom.tetrahedralParity??null),fusionB.atoms.map(atom=>atom.tetrahedralParity??null));
  for(const graph of [fusionA,fusionB])for(const specified of ["(4as,8as)-decahydronaphthalene","(4ar,8ar)-decahydronaphthalene"])
    assert.equal(reconcileSystematicName(graph,specified),null,`${specified} cannot claim FULL without a validated fusion-stereo mapping`);
});

test("indicated hydrogen is accepted explicitly for indene, but indene and indane stay constitutionally distinct",()=>{
  const indene=parseFusedPartiallySaturatedName("1H-indene"),indane=parseFusedPartiallySaturatedName("2,3-dihydro-1H-indene");
  assert(indene&&indane);
  assert.equal(reconcileSystematicName(indene.graph,"2,3-dihydro-1H-indene"),null);
  assert.equal(reconcileSystematicName(indane.graph,"1H-indene"),null);
  const methyl=parseFusedPartiallySaturatedName("2-methyl-1H-indene");assert(methyl);
  assert.equal(reconcileSystematicName(methyl.graph,"3-methyl-1H-indene"),null,"wrong position is not treated as a symmetry-equivalent locant");
  assert.equal(reconcileSystematicName(indene.graph,"2-methyl-1H-indene"),null,"an omitted branch cannot disappear");
  assert.equal(reconcileSystematicName(indane.graph,"2,3-dihydro-1H-inden-2-ol"),null,"a missing oxygen cannot be inferred");
});

test("5+6 and 6+6 canvas faces share one exact edge and retain regular ring geometry",()=>{
  for(const name of ["2,3-dihydro-1H-indene","indene","1,2,3,4-tetrahydronaphthalene"]){
    const built=buildHydrocarbonFromIupacName(name);assert.equal(built.ok,true,name);
    const rings=built.molecule.rings;assert.equal(rings.length,2,name);
    const sizes=rings.map(ring=>ring.atomIds.length).sort((a,b)=>a-b);
    assert.deepEqual(sizes,name.includes("naphthalene")?[6,6]:[5,6],name);
    const shared=rings[0].atomIds.filter(id=>rings[1].atomIds.includes(id));assert.equal(shared.length,2,name);
    const fusion=built.molecule.bonds.filter(([a,b])=>shared.includes(a)&&shared.includes(b));assert.equal(fusion.length,1,name);
    for(const ring of rings){
      const points=ring.atomIds.map(id=>built.molecule.atoms.find(atom=>atom.id===id));
      const lengths=points.map((point,i)=>Math.hypot(point.x-points[(i+1)%points.length].x,point.y-points[(i+1)%points.length].y));
      assert(Math.max(...lengths)-Math.min(...lengths)<1e-8,`${name}: regular ${ring.atomIds.length}-gon`);
    }
    assert.notDeepEqual(rings[0].atomIds.map(id=>built.molecule.atoms[id-1].x),rings[1].atomIds.map(id=>built.molecule.atoms[id-1].x),name);
  }
});
