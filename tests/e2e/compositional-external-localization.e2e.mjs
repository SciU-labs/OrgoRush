import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { inspectSmilesStructure, moleculeFromSmiles, moleculeToSmiles } from "../../app/openchemlib-adapter.ts";
import { CanonizerUtil, Molecule as OCLMolecule } from "openchemlib";
import { buildOpenChemLibStereoGraph } from "../../app/tetrahedral-stereochemistry.ts";
import { mapStructuralRegions } from "../../app/structural-derivation.ts";
import { getTetrahedralStereoCenters } from "../../app/tetrahedral-stereochemistry.ts";
import { inspectDoubleBondStereochemistry } from "../../app/double-bond-stereochemistry.ts";
import { localizeCompositionalExternalName } from "../../app/compositional-external-localization.ts";
import { structuralIdentity } from "../helpers/reference-corpus.mjs";
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

test("PubChem dopamine and fentanyl names appear compositionally localized in Spanish", async () => {
  const cases = [
    { title: "Dopamine", smiles: "C1=CC(=C(C=C1CCN)O)O", english: "4-(2-aminoethyl)benzene-1,2-diol", spanish: "4-(2-aminoetil)benceno-1,2-diol", cid: 681, inchiKey: "VYFYYTLLBUKUHU-UHFFFAOYSA-N" },
    { title: "Fentanyl", smiles: "CCC(=O)N(C1CCN(CC1)CCC2=CC=CC=C2)C3=CC=CC=C3", english: "N-phenyl-N-[1-(2-phenylethyl)piperidin-4-yl]propanamide", spanish: "N-fenil-N-[1-(2-feniletil)piperidin-4-il]propanamida", cid: 3345, inchiKey: "PJMPHNIQZUBGLI-UHFFFAOYSA-N" },
  ];
  let active = cases[0];
  let latestLookupSmiles = active.smiles;
  const served = [];
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
        latestLookupSmiles = decodeURIComponent(url.pathname.split("/smiles/")[1].split("/cids/")[0]);
        served.push({ kind: "cid", title: active.title, url: url.href });
        const activeGraph = moleculeFromSmiles(active.smiles);
        const lookupGraph = moleculeFromSmiles(latestLookupSmiles);
        const identity = parsed => {
          if (!parsed.ok) return null;
          const { molecule } = buildOpenChemLibStereoGraph(parsed.molecule);
          molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
          return CanonizerUtil.getIDCode(molecule, CanonizerUtil.NORMAL);
        };
        const activeIdentity = identity(activeGraph), lookupIdentity = identity(lookupGraph);
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ IdentifierList: { CID: activeIdentity && activeIdentity === lookupIdentity ? [active.cid] : [] } }) });
      }
      if (url.pathname.includes("/property/")) {
        served.push({ kind: "property", title: active.title, smiles: latestLookupSmiles, url: url.href });
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ PropertyTable: { Properties: [{ CID: active.cid, IUPACName: active.english,
            IsomericSMILES: latestLookupSmiles, CanonicalSMILES: latestLookupSmiles, InChIKey: active.inchiKey,
            MolecularFormula: active.title === "Dopamine" ? "C8H11NO2" : "C22H28N2O" }] } }) });
      }
      if (url.pathname.includes("/description/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (url.hostname === "www.ebi.ac.uk") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  try {
    await page.goto(`${origin}/OrgoRush/es/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: "Español", exact: true }).click();
    await page.locator('[aria-controls="smiles-interop-panel"]').click();
    const name = page.locator(".iupac-dock-name");
    for (const row of cases) {
      active = row;
      await page.locator("#smiles-text-input").fill(row.smiles);
      await page.locator("#smiles-interop-panel button[type=submit]").click();
      try {
        await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected,
          row.spanish, { timeout: 20_000 });
      } catch (error) {
        throw new Error(`${row.title}: name was ${(await name.innerText().catch(() => "<none>")).trim()}; served=${JSON.stringify(served)}; ${error.message}`);
      }
      assert.equal((await name.innerText()).trim(), row.spanish, `${row.title} has the localized Spanish name`);
      if (row.title === "Dopamine") {
        const common = page.locator(".iupac-dock-common-title");
        await common.waitFor({ state: "visible", timeout: 15_000 });
        assert.match(await common.innerText(), /Dopamina/);
        const hierarchy = await page.locator(".iupac-dock-name-stack").innerText();
        assert.match(hierarchy, /Dopamina[\s\S]*4-\(2-aminoetil\)benceno-1,2-diol/);
        const captureDirectory = resolve(process.cwd(), "reports", "iupac-name-hierarchy-2026-11-16");
        await mkdir(captureDirectory, { recursive: true });
        await page.screenshot({ path: resolve(captureDirectory, "dopamine-spanish.png"), fullPage: true });
      }
      await page.getByRole("button", { name: "English", exact: true }).click();
      await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected,
        row.english, { timeout: 5_000 });
      if (row.title === "Dopamine") {
        assert.match(await page.locator(".iupac-dock-common-title").innerText(), /Dopamine/);
        assert.match(await page.locator(".iupac-dock-name-stack").innerText(), /Dopamine[\s\S]*4-\(2-aminoethyl\)benzene-1,2-diol/);
        await page.screenshot({ path: resolve(process.cwd(), "reports", "iupac-name-hierarchy-2026-11-16", "dopamine-english.png"), fullPage: true });
      }
      await page.getByRole("button", { name: "Español", exact: true }).click();
      await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected,
        row.spanish, { timeout: 5_000 });
    }
  } finally {
    await page.close();
  }
});

test("all representable P2 PubChem structures retain bilingual names and molecular identity in Chromium", async () => {
  const fixture = JSON.parse(await readFile(new URL("../fixtures/orgorush-pubchem-corpus-120.json", import.meta.url), "utf8"));
  const spanishByTitle = new Map([
    ["Serotonin", "3-(2-aminoetil)-1H-indol-5-ol"],
    ["Histamine", "2-(1H-imidazol-5-il)etanamina"],
    ["Tryptamine", "2-(1H-indol-3-il)etanamina"],
    ["Caffeine", "1,3,7-trimetilpurina-2,6-diona"],
    ["D-Glucose", "(3R,4S,5S,6R)-6-(hidroximetil)oxano-2,3,4,5-tetrol"],
    ["Pyrazole", "1H-pirazol"],
    ["2-Pyrazinecarboxylic acid", "ácido pirazina-2-carboxílico"],
    ["Ibotenic Acid", "ácido 2-amino-2-(3-oxo-1,2-oxazol-5-il)acético"],
    ["Piperoxan", "1-(2,3-dihidro-1,4-benzodioxin-3-ilmetil)piperidina"],
    ["Quercetin", "2-(3,4-dihidroxifenil)-3,5,7-trihidroxicromen-4-ona"],
    ["Genistein", "5,7-dihidroxi-3-(4-hidroxifenil)cromen-4-ona"],
  ]);
  const cases = fixture.compounds.filter(row => row.priority === "P2"
    && (!process.env.ORGORUSH_P2_E2E_TITLE || row.title === process.env.ORGORUSH_P2_E2E_TITLE)).map(row => ({
    ...row,
    spanish: spanishByTitle.get(row.title),
    cid: 778000 + row.cid,
  }));
  assert.equal(cases.length, process.env.ORGORUSH_P2_E2E_TITLE ? 1 : 11);
  assert.ok(cases.every(row => row.spanish), "every P2 corpus row has a reviewed Spanish composition");
  let active = cases[0];
  let latestLookupSmiles = active.isomeric_smiles_pubchem;
  const served = [];
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
        latestLookupSmiles = decodeURIComponent(url.pathname.split("/smiles/")[1].split("/cids/")[0]);
        const matches = structuralIdentity(active.isomeric_smiles_pubchem) === structuralIdentity(latestLookupSmiles);
        served.push({ title: active.title, kind: "cid", matches, url: url.href });
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ IdentifierList: { CID: matches ? [active.cid] : [] } }) });
      }
      if (url.pathname.includes("/property/")) {
        served.push({ title: active.title, kind: "property", url: url.href });
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ PropertyTable: { Properties: [{ CID: active.cid, IUPACName: active.iupac_en_pubchem,
            IsomericSMILES: active.isomeric_smiles_pubchem, CanonicalSMILES: active.isomeric_smiles_pubchem,
            MolecularFormula: active.molecular_formula }] } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (url.hostname === "www.ebi.ac.uk" && url.pathname.startsWith("/opsin/ws/")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ status: "SUCCESS", smiles: active.isomeric_smiles_pubchem }) });
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
      active = row;
      await page.locator("#smiles-text-input").fill(row.isomeric_smiles_pubchem);
      await page.locator("#smiles-interop-panel button[type=submit]").click();
      try {
        await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected,
          row.spanish, { timeout: 20_000 });
      } catch (error) {
        const diagnosticSmiles = await exportSmiles().catch(() => "<export failed>");
        const diagnosticGraph = moleculeFromSmiles(diagnosticSmiles);
        const stereoCount = diagnosticGraph.ok ? getTetrahedralStereoCenters(diagnosticGraph.molecule).length : null;
        const directLocalizer = diagnosticGraph.ok ? localizeCompositionalExternalName(diagnosticGraph.molecule, row.iupac_en_pubchem,
          { verifiedExternalSmiles: row.isomeric_smiles_pubchem }) : null;
        throw new Error(`${row.title}: expected ${row.spanish}; shown=${(await name.innerText().catch(() => "<none>")).trim()}; `
          + `export=${diagnosticSmiles}; stereo=${stereoCount}; direct=${directLocalizer}; served=${JSON.stringify(served)}; ${error.message}`);
      }
      assert.equal((await name.innerText()).trim(), row.spanish, `${row.title} Spanish composition`);
      await page.getByRole("button", { name: "English", exact: true }).click();
      await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected,
        row.iupac_en_pubchem, { timeout: 5_000 });
      await page.getByRole("button", { name: "Español", exact: true }).click();
      await page.waitForFunction(expected => document.querySelector(".iupac-dock-name")?.textContent?.trim() === expected,
        row.spanish, { timeout: 5_000 });

      const importedSmiles = await exportSmiles();
      const importedGraph = inspectSmilesStructure(importedSmiles);
      assert.equal(importedGraph.ok, true, `${row.title} exports valid SMILES`);
      assert.equal(structuralIdentity(importedSmiles), structuralIdentity(row.isomeric_smiles_pubchem), `${row.title} import/export graph identity`);

      await page.locator('[aria-controls="iupac-name-builder"]').click();
      await page.locator("#iupac-name-input").fill(row.spanish);
      await page.locator("#iupac-name-builder button[type=submit]").click();
      await page.locator("#iupac-name-input").waitFor({ state: "hidden", timeout: 20_000 });
      const constructedSmiles = await exportSmiles();
      const constructedGraph = inspectSmilesStructure(constructedSmiles);
      assert.equal(constructedGraph.ok, true, `${row.title} Spanish construction exports`);
      assert.equal(structuralIdentity(constructedSmiles), structuralIdentity(row.isomeric_smiles_pubchem), `${row.title} construction preserves identity`);
    }
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
        await page.getByText("Nombre IUPAC sistemático · Libro Azul 2013+", { exact: true }).waitFor({ state: "visible", timeout: 5_000 });
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
