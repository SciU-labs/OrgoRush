import assert from "node:assert/strict";
import test from "node:test";
import { resolveIupacNameState } from "../app/iupac-name-state.ts";

test("a local name is immediately successful and stable while external context loads", () => {
  assert.deepEqual(resolveIupacNameState({
    localStatus: "success",
    localName: "etanol",
    externalStatus: "loading",
  }), { status: "success", name: "etanol" });
});

test("a local rejection remains loading while external nomenclature is pending", () => {
  assert.deepEqual(resolveIupacNameState({
    localStatus: "unsupported",
    externalStatus: "loading",
  }), { status: "loading" });
});

test("a verified external name replaces the provisional local rejection", () => {
  assert.deepEqual(resolveIupacNameState({
    localStatus: "unsupported",
    externalStatus: "success",
    externalName: "etanol",
  }), { status: "success", name: "etanol" });
});

test("an external name without verified localization is distinct from unsupported chemistry", () => {
  assert.deepEqual(resolveIupacNameState({
    localStatus: "unsupported",
    externalStatus: "unlocalized",
    externalName: "5-ethyl-4-methyldodecane",
  }), { status: "external-unlocalized", name: "5-ethyl-4-methyldodecane" });
});

test("unsupported, external lookup error, and local calculation error remain distinct", () => {
  assert.deepEqual(resolveIupacNameState({
    localStatus: "unsupported",
    externalStatus: "unsupported",
  }), { status: "unsupported" });
  assert.deepEqual(resolveIupacNameState({
    localStatus: "unsupported",
    externalStatus: "error",
  }), { status: "external-error" });
  assert.deepEqual(resolveIupacNameState({
    localStatus: "error",
    externalStatus: "success",
    externalName: "etanol",
  }), { status: "error" });
});
