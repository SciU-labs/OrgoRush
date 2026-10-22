import {mkdirSync,writeFileSync,readFileSync,existsSync} from "node:fs";
import {AROMATIC_004_REFERENCES,AROMATIC_004_LIMITS,aromaticGraph} from "../tests/fixtures/iupac79-aromatic-004.mjs";
import {cyclicVariants} from "../tests/helpers/cyclic-audit-003.mjs";
import {loadExerciseChemistry} from "../tests/helpers/exercise-chemistry.mjs";
import {SmilesParser} from "openchemlib";
const baselinePath="reports/orgorush-iupac79-aromatic-004.baseline.json";
const baseline=existsSync(baselinePath)?JSON.parse(readFileSync(baselinePath,"utf8")):[];
const chemistry=await loadExerciseChemistry();
try {
  const rows=AROMATIC_004_REFERENCES.map(ref=>{
    const before=baseline.find(r=>r.id===ref.id);
    const variants=cyclicVariants(aromaticGraph(ref)).map(([variant,graph])=>{
      const analysis=chemistry.engine.analyzeMolecule(graph,[],"iupac-1979-legacy");
      const result=chemistry.engine.resolveLegacyNomenclature(graph,analysis);
      return {variant,state:result.spanishResolution.status,es:result.spanishResolution.name,en:result.englishName,
        nativeEs:result.nativeSpanishName,chemicalAvailability:result.chemicallyAvailable,
        numbering:[...chemistry.engine.displayedAtomLocants(result.spanishAnalysis)],
        status:result.spanishResolution.name===ref.es&&result.englishName===ref.en?"PASS":"FAIL"};
    });
    return {...ref,formula:new SmilesParser().parseMolecule(ref.smiles).getMolecularFormula().formula,
      before:before?{nativeEs:before.nativeEs,en:before.actualEn}:undefined,
      variants,status:variants.every(v=>v.status==="PASS")?"PASS":"FAIL"};
  });
  for(const ref of AROMATIC_004_LIMITS){
    const variants=cyclicVariants(aromaticGraph(ref)).map(([variant,graph])=>{
      const r=chemistry.engine.resolveLegacyNomenclature(graph,chemistry.engine.analyzeMolecule(graph,[],"iupac-1979-legacy"));
      return {variant,state:r.spanishResolution.status,es:r.spanishResolution.name,en:r.englishName,
        reason:r.spanishResolution.reason,status:r.spanishResolution.status==="UNSUPPORTED"?"UNSUPPORTED":"FAIL"};
    });
    rows.push({...ref,es:null,en:null,family:"boundary",formula:new SmilesParser().parseMolecule(ref.smiles).getMolecularFormula().formula,
      variants,status:variants.every(v=>v.status==="UNSUPPORTED")?"UNSUPPORTED":"FAIL"});
  }
  const counts={references:rows.length,observations:rows.reduce((n,r)=>n+r.variants.length,0),
    PASS:rows.filter(r=>r.status==="PASS").length,FAIL:rows.filter(r=>r.status==="FAIL").length,
    NATIVE_ES:rows.filter(r=>r.variants[0].state==="NATIVE_ES").length,
    TRANSLATED_FROM_LEGACY_EN:rows.filter(r=>r.variants[0].state==="TRANSLATED_FROM_LEGACY_EN").length,
    UNSUPPORTED:rows.filter(r=>r.variants[0].state==="UNSUPPORTED").length};
  mkdirSync("reports",{recursive:true});
  writeFileSync("reports/orgorush-iupac79-aromatic-004.matrix.json",JSON.stringify({base:"f5f3ca9",profile:"iupac-1979-legacy",counts,rows},null,2)+"\n");
  const table=["# Matriz aromática IUPAC 1979 — AROMATIC-004","","Generada con `node scripts/audit-iupac79-aromatic-004.mjs`. Cinco variantes de metadatos, coordenadas e IDs por estructura.","",
    "| ID | SMILES / fórmula | Antes ES / EN | Después ES / EN | Estado ES | Prueba |","| --- | --- | --- | --- | --- | --- |"];
  for(const r of rows)table.push(`| ${r.id} | ${r.smiles} · ${r.formula} | ${r.before?`${r.before.nativeEs} / ${r.before.en}`:"sin captura"} | ${r.variants[0].es} / ${r.variants[0].en} | ${r.variants[0].state} | ${r.status} |`);
  writeFileSync("reports/orgorush-iupac79-aromatic-004.matrix.md",table.join("\n")+"\n");
  console.log(JSON.stringify(counts,null,2));
  for(const r of rows.filter(r=>r.status==="FAIL"))console.log(JSON.stringify(r));
  if(counts.FAIL)process.exitCode=1;
}finally{await chemistry.close();}
