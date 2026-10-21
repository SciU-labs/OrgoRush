import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { CanonizerUtil, Molecule, SmilesParser } from "openchemlib";
import { recognizeRingTopology } from "../app/fused-topology.ts";
import { moleculeToSmiles, moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { nameSaturatedFused1979, isSpanish1979SaturatedPolycyclicSpelling } from "../app/iupac1979-saturated-fused.ts";
import { fuseRingOnBond } from "../app/fused-ring.ts";
import { buildHydrocarbonFromIupacName } from "../app/name-to-molecule.ts";
import { assertReasoningIntegrity } from "./helpers/reasoning-integrity.mjs";
import { getFusedTetracyclicSystem, getSteroidLike6565System } from "../app/fused-ring-nomenclature.ts";
import { applyNomenclatureConvention } from "../app/nomenclature-conventions.ts";
import { generateLegacyEnglishName } from "../app/legacy-english-nomenclature.ts";
import { legacyProfileDisplayName } from "../app/legacy-profile-display.ts";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/iupac79-polycyclic-002.json", import.meta.url)));
function capture() {
  return { atoms: fixture.perimeter.map((id) => ({ id, x: Math.cos(id), y: Math.sin(id) })),
    bonds: [...fixture.perimeter.map((id, i) => [id, fixture.perimeter[(i + 1) % fixture.vertices], 1]), ...fixture.chords.map(([a,b]) => [a,b,1])] };
}
const parse = (smiles) => { const m = new SmilesParser().parseMolecule(smiles); m.ensureHelperArrays(Molecule.cHelperCIP); return m; };
const identity = (graph) => {
  const result = moleculeToSmiles(graph); assert.equal(result.ok, true, result.error);
  return CanonizerUtil.getIDCode(parse(result.smiles), CanonizerUtil.NORMAL);
};
function perimeterGraph(n, chords) {
  return { atoms: Array.from({ length: n }, (_, i) => ({ id: i + 1, x: Math.cos(i), y: Math.sin(i) })),
    bonds: [...Array.from({ length: n }, (_, i) => [i + 1, (i + 1) % n + 1, 1]), ...chords.map(([a,b]) => [a,b,1])] };
}
function transform(graph, salt, reflect = false) {
  const ids = new Map(graph.atoms.map((a, i) => [a.id, (graph.atoms.length - i) * 37 + salt]));
  return { atoms: graph.atoms.map((a) => ({ ...a, id: ids.get(a.id), x: -a.y + salt, y: (reflect ? -a.x : a.x) - salt })).reverse(),
    bonds: graph.bonds.map(([a,b,o]) => [ids.get(b), ids.get(a), o]).reverse() };
}
const cases = [
  ["bicyclic 5+5", 8, [[1,5]], "biciclo[3.3.0]octano", "bicyclo[3.3.0]octane"],
  ["bicyclic 6+5", 9, [[1,6]], "biciclo[4.3.0]nonano", "bicyclo[4.3.0]nonane"],
  ["bicyclic 6+6", 10, [[1,6]], "biciclo[4.4.0]decano", "bicyclo[4.4.0]decane"],
  ["linear tricyclic", 14, [[1,10],[3,8]], "triciclo[8.4.0.0^{3,8}]tetradecano", "tricyclo[8.4.0.0^{3,8}]tetradecane"],
  ["angular tricyclic", 14, [[1,10],[2,7]], "triciclo[8.4.0.0^{2,7}]tetradecano", "tricyclo[8.4.0.0^{2,7}]tetradecane"],
  ["three five-membered rings", 11, [[1,8],[3,7]], "triciclo[6.3.0.0^{2,6}]undecano", "tricyclo[6.3.0.0^{2,6}]undecane"],
  ["capture linear tetracyclic", 17, fixture.chords, fixture.expectedEs, fixture.expectedEn],
  ["C17H28 mixed isomer", 17, [[1,10],[2,7],[12,16]], "tetraciclo[8.7.0.0^{2,7}.0^{12,16}]heptadecano", "tetracyclo[8.7.0.0^{2,7}.0^{12,16}]heptadecane"],
  ["branched ring-adjacency tetracyclic", 18, [[1,6],[7,12],[13,18]], "tetraciclo[12.4.0.0^{2,7}.0^{8,13}]octadecano", "tetracyclo[12.4.0.0^{2,7}.0^{8,13}]octadecane"],
  ["five six-membered rings", 22, [[1,10],[3,8],[12,21],[14,19]], "pentaciclo[12.8.0.0^{3,12}.0^{5,10}.0^{16,21}]docosano", "pentacyclo[12.8.0.0^{3,12}.0^{5,10}.0^{16,21}]docosane"],
];

// Independently reconstruct the numbered graph from a name's descriptor.
function fromDescriptor(result) {
  const match = /^\[(\d+)\.(\d+)\.0(.*)\]$/.exec(result.descriptor);
  const first = Number(match[1]), count = first + Number(match[2]) + 2;
  const secondary = [...match[3].matchAll(/\.0\^\{(\d+),(\d+)\}/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return perimeterGraph(count, [[1, first + 2], ...secondary]);
}
// Exhaustive independent Hamilton-cycle oracle on these small fixtures. It
// checks A-32.31(c,d) across all cycles/bridges, not just the supplied boundary.
function independentBestScore(graph) {
  const adjacent = new Map(graph.atoms.map((a) => [a.id, []]));
  for (const [a,b] of graph.bonds) { adjacent.get(a).push(b); adjacent.get(b).push(a); }
  const start = graph.atoms[0].id, scores = [];
  function evaluate(path) {
    const edge = (a,b) => [a,b].sort((x,y) => x-y).join(":");
    const outer = new Set(path.map((a,i) => edge(a,path[(i+1)%path.length])));
    const chords = graph.bonds.filter(([a,b]) => !outer.has(edge(a,b)));
    for (const [left,right] of chords) {
      const i = path.indexOf(left), j = path.indexOf(right), distance = (j-i+path.length)%path.length;
      const a = distance-1, b = path.length-distance-1;
      for (const root of [left,right]) for (const direction of [1,-1]) {
        const cycle = Array.from({length:path.length},(_,k) => path[(path.indexOf(root)+direction*k+path.length*2)%path.length]);
        if (cycle.indexOf(root === left ? right : left) - 1 !== Math.max(a,b)) continue;
        const locants = new Map(cycle.map((id,k) => [id,k+1]));
        const pairs = chords.filter(([x,y]) => edge(x,y)!==edge(left,right)).map(([x,y]) => [locants.get(x),locants.get(y)].sort((x,y)=>x-y))
          .sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
        scores.push([Math.abs(a-b), ...pairs.flat().sort((x,y)=>x-y), ...pairs.flat()]);
      }
    }
  }
  function visit(path) {
    if (path.length===graph.atoms.length) { if (adjacent.get(path.at(-1)).includes(start)) evaluate(path); return; }
    for (const next of adjacent.get(path.at(-1))) if (!path.includes(next)) visit([...path,next]);
  }
  visit([start]);
  return scores.sort((a,b) => { for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]-b[i]; return 0; })[0];
}

for (const [label,n,chords,es,en] of cases) test(`A-31/A-32 graph proof and real bilingual profiles: ${label}`, () => {
  const graph = perimeterGraph(n,chords), before = structuredClone(graph), result = nameSaturatedFused1979(graph);
  assert.equal(result.status,"SUPPORTED",result.reason); assert.equal(result.nameEs,es); assert.equal(result.nameEn,en);
  assert.equal(identity(fromDescriptor(result)),identity(graph),"descriptor reconstructs the entire chemical constitution");
  const pairs = result.secondaryBridges.map((b)=>b.locants);
  assert.deepEqual([Math.abs(result.branches[0].length-result.branches[1].length),...pairs.flat().sort((a,b)=>a-b),...pairs.flat()],independentBestScore(graph));
  const exported=moleculeToSmiles(graph), imported=moleculeFromSmiles(exported.smiles);
  assert.equal(imported.ok,true,imported.error);
  for (const candidate of [graph,transform(graph,11),transform(graph,73,true),imported.molecule]) {
    const other=nameSaturatedFused1979(candidate); assert.equal(other.nameEs,es); assert.equal(other.nameEn,en);
    for(const convention of ["blue-book-2013","iupac-1979-legacy"]) {
      const analysis=engine.analyzeMolecule(candidate,[],convention);
      assert.equal(analysis.name,es); assert.equal(analysis.numberedAtoms.size,n);
      assert.equal(engine.localNamerCannotSafelyName(candidate,analysis),false);
      assert.equal(applyNomenclatureConvention(engine.legacySpanishFormatterInput(analysis,analysis.name),"iupac-1979-es","es"),es);
      assert.equal(generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(candidate,analysis)).name,en);
      for(const [language,displayedName] of [["es",es],["en",en]]) {
        const reasoning=engine.buildActiveIupacReasoning({molecule:candidate,analyses:{current:analysis,legacy:analysis},language,
          convention:language==="es"?"iupac-1979-es":"iupac-1979-legacy-en",displayedName,canHighlight:true});
        assertReasoningIntegrity(reasoning,candidate);
      }
    }
  }
  assert.deepEqual(graph,before);
});

test("C17H28 is not an identity key: gonane and the linear capture have different graphs and names", () => {
  const rings=[[1,2,3,4,5,10],[5,6,7,8,9,10],[8,9,11,12,13,14],[13,14,15,16,17]];
  const edges=new Map(); for(const ring of rings) ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length];edges.set([a,b].sort((x,y)=>x-y).join(":"),[a,b,1]);});
  const gonane={...capture(),bonds:[...edges.values()],rings:rings.map((atomIds,i)=>({id:i+1,kind:"cycloalkane",atomIds}))};
  assert.equal(getSteroidLike6565System(gonane).isGonaneTopology,true);
  assert.notEqual(identity(gonane),identity(capture()));
  const expected="tetraciclo[8.7.0.0^{2,7}.0^{11,15}]heptadecano";
  for(const graph of [gonane,{...gonane,rings:undefined},transform(gonane,23)]) {
    const result=nameSaturatedFused1979(graph);assert.equal(result.status,"SUPPORTED");assert.equal(result.nameEs,expected);
    assert.equal(identity(fromDescriptor(result)),identity(gonane));
    const analysis=engine.analyzeMolecule(graph,[],"iupac-1979-legacy");assert.equal(analysis.name,expected);
    assert.equal(engine.externalCandidateNeedsNeutralLocalName(graph,analysis),false);
  }
});

test("rebuild through the actual ring constructor and supported systematic-name parser", () => {
  for(const dispositions of [[2,2],[1,2],[1,1]]) {
    const initial=buildHydrocarbonFromIupacName("ciclohexano");assert.equal(initial.ok,true);
    let graph=fuseRingOnBond(initial.molecule,1,2,6);
    for(const [i,position] of dispositions.entries()) {const ring=graph.rings.at(-1);graph=fuseRingOnBond(graph,ring.atomIds[position],ring.atomIds[(position+1)%6],i===1?5:6);}
    const result=nameSaturatedFused1979(graph);assert.equal(result.status,"SUPPORTED");
    if(dispositions[0]===2 && dispositions[1]===2) assert.equal(identity(graph),identity(capture()));
    const analysis=engine.analyzeMolecule(graph,[],"iupac-1979-legacy");assert.equal(analysis.name,result.nameEs);
    const rebuilt=buildHydrocarbonFromIupacName(result.nameEs);assert.equal(rebuilt.ok,true,rebuilt.error);assert.equal(identity(rebuilt.molecule),identity(graph));
  }
  let five=fuseRingOnBond(buildHydrocarbonFromIupacName("ciclohexano").molecule,1,2,6);
  for(let i=0;i<3;i++){const ring=five.rings.at(-1);five=fuseRingOnBond(five,ring.atomIds[2],ring.atomIds[3],6);}
  assert.equal(identity(five),identity(perimeterGraph(cases[9][1],cases[9][2])));
  assert.equal(engine.analyzeMolecule(five,[],"iupac-1979-legacy").name,cases[9][3]);
});

test("negative scope stays closed to invalid, spiro, bridged, disconnected and decorated graphs", () => {
  function raw(smiles) {const m=parse(smiles);return {atoms:Array.from({length:m.getAllAtoms()},(_,i)=>({id:i+1,x:i,y:0,element:m.getAtomLabel(i)})),
    bonds:Array.from({length:m.getAllBonds()},(_,i)=>[m.getBondAtom(0,i)+1,m.getBondAtom(1,i)+1,m.getBondOrder(i)])};}
  for(const smiles of ["C1CCC2(C1)CCCC2","C1CC2CCC1C2","C1CCCCC1C2CCCCC2","c1ccc2ccccc2c1","CC1CCC2CCCCC2C1","OC1CCC2CCCCC2C1","C1CCCCC1.C1CCCCC1"]) {
    assert.equal(nameSaturatedFused1979(raw(smiles)).status,"UNSUPPORTED",smiles);
  }
  for(const change of [g=>g.atoms.push({...g.atoms[0]}),g=>g.bonds.push([...g.bonds[0]]),g=>g.bonds.push([1,999,1]),
    g=>{g.atoms[0].charge=1;},g=>{g.atoms[0].tetrahedralParity="R";},g=>g.atoms.push({id:99,x:0,y:0})]) {
    const graph=capture();change(graph);assert.equal(nameSaturatedFused1979(graph).status,"UNSUPPORTED");
  }
  const disconnected=capture();disconnected.atoms.push({id:99,x:0,y:0});
  const analysis=engine.analyzeMolecule(disconnected,[],"iupac-1979-legacy");assert.equal(engine.localNamerCannotSafelyName(disconnected,analysis),true);
  assert.equal(generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(disconnected,analysis)).name,"-");
  assert.equal(engine.legacySpanishFormatterInput({...engine.analyzeMolecule(capture()),saturatedFused1979:undefined},fixture.expectedEs),"-");
  for(const name of ["tetraciclo[8.7.0.0^{3,8}]heptadecano","tetraciclo[8.7.0.0^{3,8}.0^{12,99}]heptadecano","tetraciclo[8.7.0.0^{3,8}.0^{12,16}]octadecano"])
    assert.equal(isSpanish1979SaturatedPolycyclicSpelling(name),false,name);
});
let chemistry, engine;
before(async () => { chemistry = await loadExerciseChemistry(); engine = chemistry.engine; });
after(async () => chemistry?.close());

test("POLYCYCLIC-002: exact capture gets its A-32 name in the real Legacy dock in ES and EN", () => {
  const raw = capture(), topology = recognizeRingTopology(raw);
  assert.equal(raw.atoms.length, 17); assert.equal(raw.bonds.length, 20);
  assert.equal(topology.cycleRank, 4); assert.equal(topology.kind, "ortho-fused");
  assert.deepEqual(topology.cycles.map((c) => c.length).sort(), fixture.ringSizes);
  const graph = { ...raw, rings: topology.cycles.map((atomIds, i) => ({ id: i + 1, kind: "cycloalkane", atomIds })) };
  assert.equal(getSteroidLike6565System(graph).isGonaneTopology, false);
  assert.equal(getFusedTetracyclicSystem(graph).systematicName, fixture.expectedEs);
  const exported = moleculeToSmiles(graph); assert.equal(exported.ok, true, exported.error);
  const parsed = new SmilesParser().parseMolecule(exported.smiles); parsed.ensureHelperArrays(Molecule.cHelperCIP);
  assert.equal(parsed.getMolecularFormula().formula, fixture.formula);
  for (const molecule of [graph, raw]) {
    const analysis = engine.analyzeMolecule(molecule, [], "iupac-1979-legacy");
    const es = applyNomenclatureConvention(engine.legacySpanishFormatterInput(analysis, analysis.name), "iupac-1979-es", "es");
    const en = generateLegacyEnglishName(engine.buildLegacyEnglishNameModel(molecule, analysis)).name;
    assert.equal(es, fixture.expectedEs); assert.equal(en, fixture.expectedEn);
    assert.equal(engine.externalCandidateNeedsNeutralLocalName(molecule, analysis), false);
    for (const language of ["es", "en"]) assert.deepEqual(legacyProfileDisplayName({ language,
      suggestedName: language === "es" ? analysis.name : fixture.expectedEn, spanish1979Name: es, english1979Name: en }),
      { name: language === "es" ? fixture.expectedEs : fixture.expectedEn, available: true });
  }
});
