import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

import { legacyProfileDisplayName,selectedNomenclatureExportName } from "../app/legacy-profile-display.ts";

test("display cannot promote Suggested TNT without the graph-validated Spanish resolution", () => {
  const resolved = legacyProfileDisplayName({
    language: "es",
    suggestedName: "2-metil-1,3,5-trinitrobenceno",
    spanish1979Name: "-",
    english1979Name: "2-methyl-1,3,5-trinitrobenzene",
  });
  assert.deepEqual(resolved, { name: "No disponible para esta estructura", available: false });
  assert.deepEqual(legacyProfileDisplayName({language:"es",suggestedName:"ignored",
    spanish1979Name:"2-metil-1,3,5-trinitrobenceno",english1979Name:"2-methyl-1,3,5-trinitrobenzene"}),
    {name:"2-metil-1,3,5-trinitrobenceno",available:true});
});

test("supported locale-specific Legacy outputs are preserved", () => {
  assert.deepEqual(legacyProfileDisplayName({
    language: "es",
    suggestedName: "propan-2-ona",
    spanish1979Name: "propanona",
    english1979Name: "propanone",
  }), { name: "propanona", available: true });
  assert.deepEqual(legacyProfileDisplayName({
    language: "en",
    suggestedName: "propan-2-one",
    spanish1979Name: "propanona",
    english1979Name: "propanone",
  }), { name: "propanone", available: true });
});

test("unsupported Legacy profiles show a localized explanation instead of a dash", () => {
  assert.deepEqual(legacyProfileDisplayName({
    language: "es",
    suggestedName: "unknown",
    spanish1979Name: "-",
    english1979Name: "-",
  }), { name: "No disponible para esta estructura", available: false });
  assert.deepEqual(legacyProfileDisplayName({
    language: "en",
    suggestedName: "unknown",
    spanish1979Name: "-",
    english1979Name: "-",
  }), { name: "Not available for this structure", available: false });
});

test("export and explicit saved-entry labels use the verified selected name and preserve Current metadata",()=>{
  const input={convention:"iupac-1979-es",displayedName:"1-metil-2-yodobenceno",copyable:true,canonicalName:"nombre canónico"};
  assert.equal(selectedNomenclatureExportName(input),input.displayedName);
  assert.equal(selectedNomenclatureExportName({...input,convention:"iupac-1979-legacy-en",displayedName:"1-iodo-2-methylbenzene"}),"1-iodo-2-methylbenzene");
  assert.equal(selectedNomenclatureExportName({...input,convention:"current"}),input.canonicalName);
  assert.equal(selectedNomenclatureExportName({...input,copyable:false,displayedName:"No disponible para esta estructura"}),input.canonicalName);
});

test("visible copy, SMILES, image and explicit Save bindings share the selected resolution",()=>{
  const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(page,/copyVisibleName\(displayedIupacName\)/);
  assert.match(page,/const exportIupacName=selectedNomenclatureExportName\(\{convention:activeNomenclatureConvention,\s*displayedName:displayedIupacName,copyable:displayedNameCopyable/);
  assert.match(page,/downloadSmilesFile\(result.smiles, exportIupacName\)/);
  assert.equal([...page.matchAll(/const currentName = molecule.atoms.length \? localizedExportIupacName : "molecula"/g)].length,2);
  const save=page.slice(page.indexOf("  const saveCurrentStructure ="),page.indexOf("  const restoreLibraryEntry ="));
  assert.equal([...save.matchAll(/name: exportIupacName/g)].length,2,"local and remote explicit Save use the same resolved name");
});
