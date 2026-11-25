import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { TESTOSTERONE_REFERENCE_SMILES, inspectTestosteroneGraph } from "../app/testosterone-stereo-structure.ts";

let server, app;
before(async () => {
  server = await createServer({ root: process.cwd(), configFile: false, logLevel: "error", appType: "custom", plugins: [react()], server: { middlewareMode: true, hmr: false } });
  app = await server.ssrLoadModule("/app/page.tsx");
});
after(async () => { await server?.close(); });

test(".quimica round-trip preserves testosterone connectivity, stereo and C5 state", () => {
  const imported = moleculeFromSmiles(TESTOSTERONE_REFERENCE_SMILES); assert.equal(imported.ok, true);
  const analysis = app.analyzeMolecule(imported.molecule);
  const entry = { id: "testosterone", name: "testosterone", formula: analysis.formula, family: analysis.family,
    molecule: imported.molecule, viewMode: "skeletal", atomCount: imported.molecule.atoms.length,
    createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z" };
  const document = app.createChemistryDocument("structure", [entry], "2026-11-25T00:00:00.000Z");
  const restored = app.readChemistryDocument(JSON.parse(JSON.stringify(document)))[0];
  assert.deepEqual(restored.molecule, imported.molecule);
  assert.ok(inspectTestosteroneGraph(restored.molecule));
  assert.equal(restored.molecule.atoms.find(atom => atom.id === inspectTestosteroneGraph(restored.molecule).locants["5"]).tetrahedralParity, undefined);
  const exported = moleculeToSmiles(restored.molecule); assert.equal(exported.ok, true);
  assert.equal(inspectTestosteroneGraph(moleculeFromSmiles(exported.smiles).molecule) !== null, true);
});
