import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { inspectSmilesStructure, moleculeFromSmiles, moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { mapStructuralRegions } from "../../app/structural-derivation.ts";
import { getTetrahedralStereoCenters } from "../../app/tetrahedral-stereochemistry.ts";
import { inspectDoubleBondStereochemistry } from "../../app/double-bond-stereochemistry.ts";
import { VALIDATION_CASES } from "../fixtures/orgorush-validation-014.mjs";

const smiles = "Oc1c(C)c(C(N)C)ccc1";
const english = "3-(1-aminoethyl)-2-methylphenol";
const spanish = "3-(1-aminoetil)-2-metilfenol";
let server, browser, origin;

before(async () => {
  server = await createServer({ configFile: fileURLToPath(new URL("../../vite.pages.config.ts", import.meta.url)), server: { host: "localhost", port: 0 } });
  await server.listen();
  origin = `http://localhost:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.ORGORUSH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ORGORUSH_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

test("PubChem English name localizes only for the matching live phenol graph in both languages", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped");
    localStorage.setItem("hydrocarbon-lab-language", "es");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "www.ebi.ac.uk" && url.pathname.startsWith("/opsin/ws/")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ status: "SUCCESS", smiles }) });
    }
    if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
      if (url.pathname.includes("/smiles/") && url.pathname.includes("/cids/")) {
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ IdentifierList: { CID: [771001] } }) });
      }
      if (url.pathname.includes("/property/")) {
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ PropertyTable: { Properties: [{
          CID: 771001, IUPACName: english, IsomericSMILES: smiles, CanonicalSMILES: smiles, MolecularFormula: "C9H13NO",
        }] } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  try {
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    await page.locator("#smiles-text-input").fill(smiles);
    await page.locator("#smiles-interop-panel button[type=submit]").click();
    const name = page.locator(".iupac-dock-name");
    await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected, spanish, { timeout: 20_000 });
    assert.equal((await name.innerText()).trim(), spanish);
    await page.getByRole("button", { name: "English", exact: true }).click();
    await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected, english, { timeout: 5_000 });
    assert.equal((await name.innerText()).trim(), english);
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected, spanish, { timeout: 5_000 });
    assert.doesNotMatch((await name.innerText()).trim(), /aminoethyl|methyl/);

    const exportSmiles = async () => {
      if (!(await page.locator("#smiles-interop-panel").isVisible())) await page.locator('[aria-controls="smiles-interop-panel"]').click();
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar SMILES (.smi)" }).click();
      const download = await pending;
      return (await readFile(await download.path(), "utf8")).trim().split(/\s+/)[0];
    };
    const expectedGraph = inspectSmilesStructure(smiles);
    assert.equal(expectedGraph.ok, true);
    const importedGraph = inspectSmilesStructure(await exportSmiles());
    assert.equal(importedGraph.ok, true);
    assert.equal(importedGraph.canonicalConnectivity, expectedGraph.canonicalConnectivity,
      "SMILES import preserves the independently expected molecular graph");

    await page.locator('[aria-controls="iupac-name-builder"]').click();
    await page.locator("#iupac-name-input").fill(spanish);
    await page.locator("#iupac-name-builder button[type=submit]").click();
    await page.locator("#iupac-name-input").waitFor({ state: "hidden", timeout: 20_000 });
    const constructedGraph = inspectSmilesStructure(await exportSmiles());
    assert.equal(constructedGraph.ok, true);
    assert.equal(constructedGraph.canonicalConnectivity, expectedGraph.canonicalConnectivity,
      "Spanish IUPAC name construction retains the imported connectivity");
    assert.equal((await name.innerText()).trim(), spanish,
      "the Spanish input remains a Spanish display after successful construction");
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
test("functional parents and R/S and E/Z names round-trip in Chromium through PubChem and OPSIN contracts", async () => {
  const selectedIds = (process.env.ORGORUSH_FUNCTIONAL_E2E_IDS ?? "V014-080,V014-085,V014-100,V014-104,V014-107,V014-091,V014-133,V014-129").split(",");
  const cases = selectedIds.map(id => {
    const row = VALIDATION_CASES.find(value => value.id === id);
    assert.ok(row?.expected["2013-es"]?.[0], `${id} has an independently reviewed Spanish reference`);
    return { id, smiles: row.smiles, english: row.referenceEnglish, spanish: row.expected["2013-es"][0], formula: row.formula, cid: 772000 + Number(id.slice(-3)) };
  });
  const sameReferenceGraph = (candidateSmiles, row) => {
    const expected = moleculeFromSmiles(row.smiles), candidate = moleculeFromSmiles(candidateSmiles);
    if (!expected.ok || !candidate.ok) return false;
    const expectedIsomeric = moleculeToSmiles(expected.molecule), candidateIsomeric = moleculeToSmiles(candidate.molecule);
    if (expectedIsomeric.ok && candidateIsomeric.ok && expectedIsomeric.smiles === candidateIsomeric.smiles) return true;
    const correspondence = mapStructuralRegions(expected.molecule, candidate.molecule, []);
    if (!correspondence) return false;
    const candidateRs = new Map(getTetrahedralStereoCenters(candidate.molecule).map(center => [center.atomId, center.configuration]));
    if (getTetrahedralStereoCenters(expected.molecule).some(center => candidateRs.get(correspondence.get(center.atomId)) !== center.configuration)) return false;
    const bondKey = (left, right) => [left, right].sort((a, b) => a - b).join(":");
    const candidateEz = new Map(candidate.molecule.bonds.flatMap(([left, right, order = 1, stereoFlag]) => {
      if (order !== 2 || stereoFlag !== true) return [];
      const result = inspectDoubleBondStereochemistry(candidate.molecule, left, right);
      return result.configuration ? [[bondKey(left, right), result.configuration]] : [];
    }));
    return expected.molecule.bonds.every(([left, right, order = 1, stereoFlag]) => {
      if (order !== 2 || stereoFlag !== true) return true;
      const result = inspectDoubleBondStereochemistry(expected.molecule, left, right);
      return !result.configuration || candidateEz.get(bondKey(correspondence.get(left), correspondence.get(right))) === result.configuration;
    });
  };
  cases.forEach(row => {
    const canonical = inspectSmilesStructure(row.smiles);
    assert.equal(canonical.ok, true, `${row.id} reference SMILES parses`);
  });
  const byCid = new Map(cases.map(row => [row.cid, row]));
  const served = [];
  const opsinQueries = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped");
    localStorage.setItem("hydrocarbon-lab-language", "es");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "www.ebi.ac.uk" && url.pathname.startsWith("/opsin/ws/")) {
      const encodedName = url.pathname.split("/ws/")[1]?.replace(/\.json$/, "") ?? "";
      const requestedName = decodeURIComponent(encodedName);
      opsinQueries.push(requestedName);
      const row = cases.find(value => value.english === requestedName);
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(row ? { status: "SUCCESS", smiles: row.smiles } : { status: "FAILURE", message: "Name not found" }) });
    }
    if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
      if (url.pathname.includes("/smiles/") && url.pathname.includes("/cids/")) {
        const encodedSmiles = url.pathname.split("/smiles/")[1]?.split("/cids/")[0] ?? "";
        const queried = decodeURIComponent(encodedSmiles);
        const canonical = inspectSmilesStructure(queried);
        const row = canonical.ok ? cases.find(value => value.formula === canonical.formula && sameReferenceGraph(queried, value)) : undefined;
        served.push({ kind: "cid", canonical: canonical.ok ? `${canonical.canonicalConnectivity}|${canonical.formula}` : queried, id: row?.id ?? null });
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ IdentifierList: { CID: row ? [row.cid] : [] } }) });
      }
      const cidMatch = /\/cid\/(\d+)\//.exec(url.pathname);
      const row = cidMatch ? byCid.get(Number(cidMatch[1])) : undefined;
      if (url.pathname.includes("/property/")) {
        served.push({ kind: "property", id: row?.id ?? null });
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ PropertyTable: { Properties: row ? [{
            CID: row.cid, IUPACName: row.english, IsomericSMILES: row.smiles, CanonicalSMILES: row.smiles, MolecularFormula: row.formula,
          }] : [] } }) });
      }
      if (url.pathname.includes("/description/")) {
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ InformationList: { Information: row ? [{ Title: row.english, Description: "" }] : [] } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  try {
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const name = page.locator(".iupac-dock-name");
    const exportSmiles = async () => {
      if (!(await page.locator("#smiles-interop-panel").isVisible())) await page.locator('[aria-controls="smiles-interop-panel"]').click();
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportar SMILES (.smi)" }).click();
      const download = await pending;
      return (await readFile(await download.path(), "utf8")).trim().split(/\s+/)[0];
    };

    for (const row of cases) {
      const propertiesResponse = page.waitForResponse(response => response.url().includes("pubchem.ncbi.nlm.nih.gov") && response.url().includes("/property/"));
      const descriptionResponse = page.waitForResponse(response => response.url().includes("pubchem.ncbi.nlm.nih.gov") && response.url().includes("/description/"));
      await page.locator("#smiles-text-input").fill(row.smiles);
      await page.locator("#smiles-interop-panel button[type=submit]").click();
      try {
        await Promise.all([propertiesResponse, descriptionResponse]);
      } catch (error) {
        throw new Error(`${row.id} PubChem property/description contract was not completed; fixtures=${JSON.stringify(served)}`, { cause: error });
      }
      try {
        await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected, row.spanish, { timeout: 20_000 });
      } catch (error) {
        const visibleName = (await name.innerText().catch(() => "<no dock name>")).trim();
        const provenance = await page.locator(".iupac-dock-origin").allInnerTexts().catch(() => []);
        const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(-1500);
        throw new Error(`${row.id} expected ${row.spanish}; UI showed ${visibleName}; provenance=${JSON.stringify(provenance)}; body=${JSON.stringify(bodyText)}; fixtures=${JSON.stringify(served)}`, { cause: error });
      }
      assert.equal((await name.innerText()).trim(), row.spanish, `${row.id} Spanish display`);
      if (row.id === cases[0].id) {
        await page.locator(".iupac-dock-expand").click();
        await page.getByText("Localización composicional", { exact: true }).waitFor({ state: "visible", timeout: 5_000 });
        await page.locator(".iupac-dock-expand").click();
      }

      const expected = inspectSmilesStructure(row.smiles);
      const importedSmiles = await exportSmiles();
      const imported = inspectSmilesStructure(importedSmiles);
      const expectedParsed = moleculeFromSmiles(row.smiles);
      const importedParsed = moleculeFromSmiles(importedSmiles);
      assert.equal(expected.ok, true);
      assert.equal(imported.ok, true);
      assert.equal(sameReferenceGraph(importedSmiles, row), true, `${row.id} import preserves the reference graph`);
      assert.equal(imported.formula, expected.formula, `${row.id} import formula`);
      assert.equal(expectedParsed.ok, true);
      assert.equal(importedParsed.ok, true);
      assert.equal(sameReferenceGraph(importedSmiles, row), true, `${row.id} import preserves connectivity and absolute/geometry configuration`);
      assert.equal(imported.tetrahedralStereoCenterCount, expected.tetrahedralStereoCenterCount, `${row.id} stereocenter count`);
      assert.equal(imported.unpreservedTetrahedralStereoCenterCount, 0, `${row.id} preserves tetrahedral stereo`);

      await page.getByRole("button", { name: "English", exact: true }).click();
      try {
        await page.waitForFunction(expectedName => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expectedName, row.english, { timeout: 10_000 });
      } catch (error) {
        throw new Error(`${row.id} English view expected ${row.english}; UI showed ${(await name.innerText()).trim()}`, { cause: error });
      }
      assert.equal((await name.innerText()).trim(), row.english, `${row.id} English display`);
      await page.getByRole("button", { name: "Español", exact: true }).click();
      await page.waitForFunction(expectedName => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expectedName, row.spanish, { timeout: 10_000 });

      await page.locator('[aria-controls="iupac-name-builder"]').click();
      await page.locator("#iupac-name-input").fill(row.spanish);
      await page.locator("#iupac-name-builder button[type=submit]").click();
      await page.locator("#iupac-name-input").waitFor({ state: "hidden", timeout: 20_000 });
      const constructedSmiles = await exportSmiles();
      const constructed = inspectSmilesStructure(constructedSmiles);
      const constructedParsed = moleculeFromSmiles(constructedSmiles);
      assert.equal(constructed.ok, true, `${row.id} Spanish name construction parses`);
      assert.equal(sameReferenceGraph(constructedSmiles, row), true, `${row.id} construction preserves the reference graph`);
      assert.equal(constructed.formula, expected.formula, `${row.id} construction formula`);
      assert.equal(constructed.unpreservedTetrahedralStereoCenterCount, 0, `${row.id} construction preserves tetrahedral stereo`);
      assert.equal(constructedParsed.ok, true, `${row.id} constructed SMILES parses`);
      assert.equal(sameReferenceGraph(constructedSmiles, row), true, `${row.id} construction preserves connectivity and absolute/geometry configuration`);
    }
    assert.ok(opsinQueries.every(query => cases.some(row => row.english === query)),
      `all OPSIN name-builder requests map to one of the independently sourced cases: ${opsinQueries.join(" | ")}`);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("PubChem records for another constitution or absolute configuration never become verified identities", async () => {
  const negatives = [
    { id: "amide-isomer", active: "CC(=O)NC", wrong: "CCC(=O)N", english: "N-methylethanamide", formula: "C3H7NO", cid: 773101 },
    { id: "opposite-RS", active: "N[C@H](C(=O)O)C[C@@H](CCC)C", wrong: "N[C@@H](C(=O)O)C[C@@H](CCC)C", english: "(2S,4R)-2-amino-4-methylheptanoic acid", formula: "C8H17NO2", cid: 773133 },
    { id: "opposite-EZ", active: "C(C)C(/C=C/C)CCCCCC", wrong: "C(C)C(/C=C\\C)CCCCCC", english: "(2E)-4-ethyldec-2-ene", formula: "C12H24", cid: 773129 },
  ];
  const byCid = new Map(negatives.map(row => [row.cid, row]));
  const byFormula = new Map(negatives.map(row => [row.formula, row]));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    localStorage.setItem("hydrocarbonLab.guidedTour.v1", "skipped");
    localStorage.setItem("hydrocarbon-lab-language", "es");
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "pubchem.ncbi.nlm.nih.gov") {
      if (url.pathname.includes("/smiles/") && url.pathname.includes("/cids/")) {
        const encoded = url.pathname.split("/smiles/")[1]?.split("/cids/")[0] ?? "";
        const inspection = inspectSmilesStructure(decodeURIComponent(encoded));
        const row = inspection.ok ? byFormula.get(inspection.formula) : undefined;
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ IdentifierList: { CID: row ? [row.cid] : [] } }) });
      }
      const cid = /\/cid\/(\d+)\//.exec(url.pathname)?.[1];
      const row = cid ? byCid.get(Number(cid)) : undefined;
      if (url.pathname.includes("/property/"))
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ PropertyTable: { Properties: row ? [{
          CID: row.cid, IUPACName: row.english, IsomericSMILES: row.wrong, CanonicalSMILES: row.wrong, MolecularFormula: row.formula,
        }] : [] } }) });
      if (url.pathname.includes("/description/"))
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ InformationList: { Information: [] } }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
  });
  try {
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    for (const row of negatives) {
      const propertyResponse = page.waitForResponse(response => response.url().includes("pubchem.ncbi.nlm.nih.gov") && response.url().includes("/property/"));
      await page.locator("#smiles-text-input").fill(row.active);
      await page.locator("#smiles-interop-panel button[type=submit]").click();
      await propertyResponse;
      await page.locator(".iupac-dock-expand").click();
      const details = page.locator("#iupac-dock-detail");
      await details.waitFor({ state: "visible" });
      assert.doesNotMatch(await details.innerText(), new RegExp(`CID ${row.cid}`), `${row.id}: mismatching PubChem identity is not attached`);
      assert.notEqual((await page.locator(".iupac-dock-name").innerText()).trim(), row.english,
        `${row.id}: PubChem English is not surfaced as a verified Spanish name`);
      await page.locator(".iupac-dock-expand").click();
    }
  } finally {
    await page.close();
  }
});
