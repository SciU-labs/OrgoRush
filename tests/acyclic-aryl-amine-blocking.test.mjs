import assert from "node:assert/strict";
import { test } from "node:test";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { parseAdditionalSystematicFamily } from "../app/systematic-family-grammar.ts";
import { reconcileSystematicName } from "../app/validated-name-derivation.ts";

test("nested aryl amine reconciles only with correct parent, ring locants and citation order", () => {
  const name = "N-methyl-3-phenyl-3-[4-(trifluoromethyl)phenoxy]propan-1-amine";
  const parsed = moleculeFromSmiles("CNCCC(c1ccccc1)Oc1ccc(cc1)C(F)(F)F");
  assert.equal(parsed.ok, true);
  assert.ok(parseAdditionalSystematicFamily(name));
  assert.equal(reconcileSystematicName(parsed.molecule,name)?.status,"FULL");
  for (const bad of [name.replace("[4-","[3-"),name.replace("3-phenyl","2-phenyl"),name.replace("N-methyl-3-phenyl","3-phenyl-N-methyl")])
    assert.equal(reconcileSystematicName(parsed.molecule,bad),null);
});
