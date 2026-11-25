import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const baseline=JSON.parse(read('reports/carbohydrate-editor-baseline.json'));
const hash=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
test('phase 8 preserves every catalog button, category, label and menu layout byte for byte',()=>{
  const source=read('app/page.tsx');
  for(const [name,{startMarker,endMarker,sha256}] of Object.entries(baseline.sections)){
    const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);
    assert.ok(start>=0&&end>start);assert.equal(hash(source.slice(start,end)),sha256,name);
  }
  const begin=source.indexOf('const FUNCTIONAL_GROUP_TEMPLATES:'),end=source.indexOf('const PRESETS:',begin);
  const code=ts.transpileModule(source.slice(begin,end)+'\nglobalThis.catalog=FUNCTIONAL_GROUP_TEMPLATES;',
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const context={};vm.runInNewContext(code,context);
  const catalog=JSON.parse(JSON.stringify(context.catalog));
  assert.equal(catalog.length,14);
  assert.deepEqual(catalog.map(t=>[t.id,t.category,t.kind]),[
    ['hydroxyl','oxygen','alcohol'],['ether-methyl','oxygen','ether'],['aldehyde','oxygen','aldehyde'],
    ['ketone','oxygen','ketone'],['carboxylic-acid','oxygen','carboxylicAcid'],['methyl-ester','oxygen','ester'],
    ['amine','nitrogen','amine'],['amide','nitrogen','amide'],['nitrile','nitrogen','nitrile'],['nitro','nitrogen','nitro'],
    ['halo-f','halogen','halogen'],['halo-cl','halogen','halogen'],['halo-br','halogen','halogen'],['halo-i','halogen','halogen'],
  ]);
  assert.ok(!catalog.some(t=>/hemi|pyran|furan|sugar|carbohydrate/i.test(t.id)));
});
test('editor chemistry modules remain unchanged apart from bounded nomenclature and B7.5 additions',()=>{
  for(const [file,sha256] of Object.entries(baseline.files)){
    if(file==='app/name-to-molecule.ts'){
      let source=read(file).replace(/\r\n/g,'\n');
      const parserImport='import { parseFusedNaphthalene } from "./fused-naphthalene-grammar.ts";\n';
      const tricyclicParserImport='import { parseFusedTricyclicArene } from "./fused-tricyclic-arene-grammar.ts";\n';
      const partiallySaturatedParserImport='import { parseFusedPartiallySaturatedName } from "./fused-partially-saturated-grammar.ts";\n';
      const decalinParserImport='import { parseFusedDecalinName } from "./fused-decalin-grammar.ts";\n';
      const gonaneBuilderImport='import { buildGonaneMoleculeFromName } from "./gonane-stereo-grammar.ts";\n';
      const steroidBuilderImport='import { buildSteroidFamilyMoleculeFromName } from "./steroid-family-grammar.ts";\n';
      const testosteroneBuilderImport='import { buildTestosteroneMoleculeFromName } from "./testosterone-stereo-grammar.ts";\n';
      const junctionStereoTypeImport='import type { FusedRingJunctionStereo } from "./fused-junction-stereochemistry.ts";\n';
      const tricyclicStereoTypeImport='import type { FusedTricyclicStereochemistry } from "./fused-tricyclic-stereochemistry.ts";\n';
      const polycyclicStereoTypeImport='import type { FusedPolycyclicStereochemistry } from "./fused-polycyclic-stereochemistry.ts";\n';
      const junctionStereoField='  /** Relative configuration of the shared edge in an audited fused-ring system. */\n  fusedRingJunctionStereo?: FusedRingJunctionStereo;\n';
      const tricyclicStereoField='  /** Global stereo identity and independent shared edges of a saturated fused tricycle. */\n  fusedRingSystemStereo?: FusedTricyclicStereochemistry;\n';
      const polycyclicStereoField='  /** Global stereo identity for connected saturated fused systems with a variable ring count. */\n  fusedPolycyclicStereo?: FusedPolycyclicStereochemistry;\n';
      const familyTypes=[' | "fused-naphthalene"',' | "fused-tricyclic-arene"'];
      const partiallySaturatedFamilyType=' | "fused-partially-saturated-bicycle"';
      const decalinFamilyType=' | "fused-decalin"';
      const gonaneFamilyType=' | "fused-gonane-stereo"';
      const steroidFamilyType=' | "fused-steroid-family"';
      const testosteroneFamilyType=' | "fused-testosterone-stereo"';
      const gonaneBuilderBranch='  const gonane=buildGonaneMoleculeFromName(value);\n  if(gonane)return gonane;\n';
      const steroidBuilderBranch='  const steroid=buildSteroidFamilyMoleculeFromName(value);\n  if(steroid)return steroid;\n';
      const testosteroneBuilderBranch='  const testosterone=buildTestosteroneMoleculeFromName(value);\n  if(testosterone)return testosterone;\n';
      const builderBranch='  const naphthalene = parseFusedNaphthalene(value.trim().toLocaleLowerCase("es"));\n'
        +'  if (naphthalene) return { ok: true, molecule: naphthalene.graph,\n'
        +'    normalizedInput: value.trim().toLocaleLowerCase("es"), enabledAliases: [], inputFamily: "fused-naphthalene" };\n';
      const tricyclicBuilderBranch='  const tricyclicArene = parseFusedTricyclicArene(value.trim().toLocaleLowerCase("en"));\n'
        +'  if (tricyclicArene) return { ok: true, molecule: tricyclicArene.graph,\n'
        +'    normalizedInput: value.trim().toLocaleLowerCase("en"), enabledAliases: [], inputFamily: "fused-tricyclic-arene" };\n';
      const partiallySaturatedBuilderBranch='  const fusedPartiallySaturated = parseFusedPartiallySaturatedName(value.trim().toLocaleLowerCase("en"));\n'
        +'  if (fusedPartiallySaturated) return { ok: true, molecule: fusedPartiallySaturated.graph,\n'
        +'    normalizedInput: value.trim().toLocaleLowerCase("en"), enabledAliases: [], inputFamily: "fused-partially-saturated-bicycle" };\n';
      const decalinBuilderBranch='  const decalin = parseFusedDecalinName(value);\n'
        +'  if (decalin) return {ok:true,molecule:decalin.graph,normalizedInput:decalin.normalized,enabledAliases:[],inputFamily:"fused-decalin"};\n';
      assert.equal(source.split(parserImport).length-1,1,'fused naphthalene parser import must remain singular');
      assert.equal(source.split(tricyclicParserImport).length-1,1,'fused tricyclic arene parser import must remain singular');
      assert.equal(source.split(partiallySaturatedParserImport).length-1,1,'partially saturated fused parser import must remain singular');
      assert.equal(source.split(decalinParserImport).length-1,1,'decalin parser import must remain singular');
      assert.equal(source.split(gonaneBuilderImport).length-1,1,'gonane stereo builder import must remain singular');
      assert.equal(source.split(steroidBuilderImport).length-1,1,'steroid family builder import must remain singular');
      assert.equal(source.split(testosteroneBuilderImport).length-1,1,'testosterone builder import must remain singular');
      assert.equal(source.split(junctionStereoTypeImport).length-1,1,'fused junction stereo type import must remain singular');
      assert.equal(source.split(junctionStereoField).length-1,1,'fused junction stereo metadata remains a single optional graph field');
      assert.equal(source.split(tricyclicStereoTypeImport).length-1,1,'fused tricycle stereo type import must remain singular');
      assert.equal(source.split(polycyclicStereoTypeImport).length-1,1,'variable-length fused stereo type import must remain singular');
      assert.equal(source.split(tricyclicStereoField).length-1,1,'fused tricycle metadata remains one bounded optional graph field');
      assert.equal(source.split(polycyclicStereoField).length-1,1,'variable-length fused metadata remains one bounded optional graph field');
      for(const familyType of familyTypes)assert.equal(source.split(familyType).length-1,2,'both name-builder result variants expose the bounded family');
      assert.equal(source.split(partiallySaturatedFamilyType).length-1,2,'both name-builder result variants expose the bounded partially saturated family');
      assert.equal(source.split(decalinFamilyType).length-1,2,'both name-builder result variants expose the bounded decalin family');
      assert.equal(source.split(gonaneFamilyType).length-1,2,'both name-builder result variants expose the bounded gonane family');
      assert.equal(source.split(steroidFamilyType).length-1,2,'both name-builder result variants expose the bounded steroid family');
      assert.equal(source.split(testosteroneFamilyType).length-1,2,'both name-builder result variants expose the bounded testosterone family');
      assert.equal(source.split(gonaneBuilderBranch).length-1,1,'gonane name import remains one bounded early branch');
      assert.equal(source.split(steroidBuilderBranch).length-1,1,'steroid-family name import remains one bounded early branch');
      assert.equal(source.split(testosteroneBuilderBranch).length-1,1,'testosterone name import remains one bounded early branch');
      assert.equal(source.split(builderBranch).length-1,1,'fused naphthalene name import remains one bounded early branch');
      assert.equal(source.split(tricyclicBuilderBranch).length-1,1,'fused tricyclic arene name import remains one bounded early branch');
      assert.equal(source.split(partiallySaturatedBuilderBranch).length-1,1,'partially saturated fused name import remains one bounded early branch');
      assert.equal(source.split(decalinBuilderBranch).length-1,2,'both name-builder entry points expose the bounded decalin parser');
      source=source.replace(parserImport,'').replace(tricyclicParserImport,'').replace(partiallySaturatedParserImport,'')
        .replace(decalinParserImport,'').replace(gonaneBuilderImport,'').replace(steroidBuilderImport,'').replace(testosteroneBuilderImport,'').replace(junctionStereoTypeImport,'').replace(tricyclicStereoTypeImport,'')
        .replace(polycyclicStereoTypeImport,'').replace(junctionStereoField,'').replace(tricyclicStereoField,'').replace(polycyclicStereoField,'')
        .replace(decalinParserImport,'').replaceAll(familyTypes[0],'').replaceAll(familyTypes[1],'').replaceAll(partiallySaturatedFamilyType,'').replaceAll(decalinFamilyType,'')
        .replaceAll(gonaneFamilyType,'').replaceAll(steroidFamilyType,'').replaceAll(testosteroneFamilyType,'').replace(builderBranch,'').replace(tricyclicBuilderBranch,'').replace(partiallySaturatedBuilderBranch,'')
        .replace(gonaneBuilderBranch,'').replace(steroidBuilderBranch,'').replace(testosteroneBuilderBranch,'').replaceAll(decalinBuilderBranch,'');
      assert.equal(hash(source),sha256,file);
      continue;
    }
    if(file==='app/tetrahedral-stereochemistry.ts')continue;
    assert.equal(hash(read(file)),sha256,file);
  }
  const file='app/tetrahedral-stereochemistry.ts',source=read(file).replace(/\r\n/g,'\n');
  const fusedJunctionSanitizerImport='import { sanitizeFusedRingJunctionStereochemistry } from "./fused-junction-stereochemistry.ts";\n';
  const fusedTricycleSanitizerImport='import { sanitizeFusedTricyclicStereochemistry } from "./fused-tricyclic-stereochemistry.ts";\n';
  const fusedPolycycleSanitizerImport='import { sanitizeFusedPolycyclicStereochemistry } from "./fused-polycyclic-stereochemistry.ts";\n';
  const fusedPolycycleSanitizerReturn='  return sanitizeFusedPolycyclicStereochemistry(sanitizeFusedTricyclicStereochemistry(sanitizeFusedRingJunctionStereochemistry(changed ? { ...source, atoms } : source)));';
  assert.equal(source.split(fusedJunctionSanitizerImport).length-1,1,'fused junction sanitizer import remains singular');
  assert.equal(source.split(fusedTricycleSanitizerImport).length-1,1,'fused tricycle sanitizer import remains singular');
  assert.equal(source.split(fusedPolycycleSanitizerImport).length-1,1,'variable-length fused stereo sanitizer import remains singular');
  assert.equal(source.split(fusedPolycycleSanitizerReturn).length-1,1,'all fused stereo metadata is sanitized after tetrahedral edits');
  const startMarker='/** Preserve the local tetrahedral arrangement when an automatic addition';
  const endMarker='export function setTetrahedralConfiguration';
  const baselineComparable=source.replace(fusedJunctionSanitizerImport,'').replace(fusedTricycleSanitizerImport,'').replace(fusedPolycycleSanitizerImport,'')
    .replace(fusedPolycycleSanitizerReturn,'  return changed ? { ...source, atoms } : source;');
  const start=baselineComparable.indexOf(startMarker),end=baselineComparable.indexOf(endMarker,start);
  assert.ok(start>=0&&end>start,'B7.5 addition reconciler must remain a single bounded insertion');
  assert.equal(hash(baselineComparable.slice(0,start)+baselineComparable.slice(end)),baseline.files[file],file);
});
