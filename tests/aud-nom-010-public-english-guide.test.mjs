import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public English guide documents scope, persistence, data flows and issue reporting", () => {
  const readme = read("../README.md").replace(/\s+/g, " ");

  for (const expected of [
    "## English overview",
    "https://sciu-lab.github.io/Hydrocarbon-Lab/en/",
    "IUPAC 1979 Legacy profile covers a narrower, explicitly supported subset",
    "are lost when the page is reloaded",
    "Google Analytics",
    "OPSIN, PubChem, Wikidata, and Wikipedia",
    "not necessarily initiated by a separate manual action",
    "https://github.com/sciu-lab/Hydrocarbon-Lab/issues/new?template=bug_report.md",
  ]) assert.ok(readme.includes(expected), `README documents ${expected}`);

  assert.doesNotMatch(readme, /open.source|opensource/i, "the guide does not claim a software license");
});

test("the application exposes the public guide from its localized footer", () => {
  const page = read("../app/page.tsx");
  const i18n = read("../app/i18n.ts");
  assert.match(page, /href="https:\/\/github\.com\/sciu-lab\/Hydrocarbon-Lab\/blob\/main\/README\.md#english-overview"/);
  assert.match(page, /t\("Alcance, privacidad y reporte de errores"\)/);
  assert.match(i18n, /"Alcance, privacidad y reporte de errores": "Scope, privacy, and bug reports"/);
});
