import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public English guide documents scope, persistence, data flows, licensing and issue reporting", () => {
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
    "GNU Affero General Public License",
    "AGPL-3.0-only",
    "Copyright © 2026 SCIU",
    "SCIU is the public pseudonym of the project's individual copyright holder",
  ]) assert.ok(readme.includes(expected), `README documents ${expected}`);

  assert.match(readme, /OrgoRush is free software licensed under the GNU Affero General Public License/);
  assert.doesNotMatch(readme, /no license|without a license|does not (?:have|include) a license/i);
});

test("the application exposes the public guide from its localized footer", () => {
  const page = read("../app/page.tsx");
  const i18n = read("../app/i18n.ts");
  assert.match(page, /href="https:\/\/github\.com\/sciu-lab\/Hydrocarbon-Lab\/blob\/main\/README\.md#english-overview"/);
  assert.match(page, /t\("Alcance, privacidad y reporte de errores"\)/);
  assert.match(i18n, /"Alcance, privacidad y reporte de errores": "Scope, privacy, and bug reports"/);
  assert.match(page, /Código fuente \/ Source code/);
  assert.match(page, /Hydrocarbon-Lab\/blob\/main\/LICENSE/);
  assert.match(page, /Copyright © 2026 SCIU/);
  assert.match(page, /<strong>SCIU<\/strong>/);
});

test("the root license is the complete GNU AGPLv3-only text with matching package metadata", () => {
  const license = read("../LICENSE").replace(/^\uFEFF/, "");
  const packageJson = JSON.parse(read("../package.json"));
  const packageLock = JSON.parse(read("../package-lock.json"));

  assert.match(license, /^\s*GNU AFFERO GENERAL PUBLIC LICENSE\s*$/m);
  assert.match(license, /Version 3, 19 November 2007/);
  assert.match(license, /13\. Remote Network Interaction; Use with the GNU General Public License\./);
  assert.match(license, /17\. Interpretation of Sections 15 and 16\./);
  assert.match(license, /END OF TERMS AND CONDITIONS/);
  assert.equal(packageJson.license, "AGPL-3.0-only");
  assert.equal(packageJson.private, true);
  assert.equal(packageLock.packages[""].license, "AGPL-3.0-only");
});
