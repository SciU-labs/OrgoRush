import { writeFile } from "node:fs/promises";
import { complexFused } from "../../tests/helpers/semi-fused-fixture.mjs";
import { setTetrahedralConfiguration } from "../../app/tetrahedral-stereochemistry.ts";
import { moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
let { molecule, numbering } = complexFused();
for (const [locant, configuration, carrier] of [[2, "R", 11], [4, "S", 12], [7, "R", 15]]) {
  const result = setTetrahedralConfiguration(molecule, numbering[locant - 1], configuration, carrier);
  if (!result.ok) throw new Error(result.error);
  molecule = result.molecule;
}
const exported = moleculeToSmiles(molecule);
if (!exported.ok) throw new Error(exported.error);
await writeFile(new URL("fixture.json", import.meta.url), JSON.stringify({ molecule, numbering, smiles: exported.smiles }, null, 2) + "\n");
console.log(exported.smiles);
