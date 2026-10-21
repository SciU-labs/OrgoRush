import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getSemiDevelopedStereoCenters, normalizeSemiDevelopedStereoDisplay, readSemiDevelopedStereoDisplay,
  writeSemiDevelopedStereoDisplay, SEMI_DEVELOPED_STEREO_STORAGE_KEY, semiDevelopedStereoAccessibleLabel } from "../app/semi-developed-stereo.ts";
import { getTetrahedralStereoCenters, getTetrahedralStereoBonds, getPotentialTetrahedralStereoCenterIds,
  setTetrahedralConfiguration, sanitizeTetrahedralStereochemistry, layoutTetrahedralBadgePositions, TETRAHEDRAL_BADGE_RADIUS } from "../app/tetrahedral-stereochemistry.ts";
import { moleculeFromSmiles, moleculeToSmiles, inspectSmilesStructure } from "../app/openchemlib-adapter.ts";
import { calculateMolecule2DLayout } from "../app/molecule-2d-layout.ts";
import { getSemiDevelopedBounds } from "../app/semi-developed-layout.ts";
import { uiText } from "../app/i18n.ts";
import { complexFused, renderScene, loadTsModule } from "./helpers/semi-fused-fixture.mjs";

const rendererUrl = new URL("../app/semi-developed-svg-renderer.tsx", import.meta.url);
const { SemiDevelopedStereoBadgeSvg } = await loadTsModule(readFileSync(rendererUrl, "utf8"), rendererUrl);
const imported = (smiles) => { const result = moleculeFromSmiles(smiles); assert.equal(result.ok, true, result.error); return result.molecule; };
const selected = (molecule, display = "labels", enabled = true, mode = "semi-developed") => getSemiDevelopedStereoCenters(molecule, mode, enabled, display);

function configuredFused() {
  let { molecule, numbering } = complexFused();
  for (const [locant, configuration, carrier] of [[2, "R", 11], [4, "S", 12], [7, "R", 15]]) {
    const result = setTetrahedralConfiguration(molecule, numbering[locant - 1], configuration, carrier);
    assert.equal(result.ok, true, result.error); molecule = result.molecule;
  }
  return { molecule, numbering };
}

test("achiral, potential unassigned and invalidated centers never receive affirmative R/S labels", () => {
  assert.deepEqual(selected(imported("CCO")), []);
  const potential = imported("CCC(O)C");
  assert.ok(getPotentialTetrahedralStereoCenterIds(potential).length > 0);
  assert.deepEqual(selected(potential), []);
  const invalid = imported("CCC(C)CC");
  invalid.atoms.find((a) => invalid.bonds.filter(([left, right]) => left === a.id || right === a.id).length === 3).tetrahedralParity = "R";
  assert.deepEqual(selected(sanitizeTetrahedralStereochemistry(invalid)), []);
  assert.deepEqual(selected(invalid), [], "CIP validity is checked even before the normal sanitizer");
});

for (const [name, smiles] of [["R", "C[C@@H](O)CC"], ["S", "C[C@H](O)CC"]]) test(`configured ${name}: real assigned center, atom identity and informational SVG`, () => {
  const molecule = imported(smiles), before = structuredClone(molecule);
  const centers = selected(molecule);
  assert.equal(centers.length, 1);
  assert.equal(centers[0].configuration, name);
  assert.deepEqual(centers, getTetrahedralStereoCenters(molecule));
  const centerAtom = molecule.atoms.find((a) => a.id === centers[0].atomId);
  delete centerAtom.tetrahedralBondTo;
  assert.deepEqual(selected(molecule), centers, "a badge does not require a carrier hint");
  for (const language of ["es", "en"]) {
    const markup = renderToStaticMarkup(React.createElement(SemiDevelopedStereoBadgeSvg, {
      center: centers[0], position: { x: 50, y: 70 }, scale: 1, language, locant: 2,
    }));
    assert.match(markup, new RegExp(`data-stereo-atom-id="${centerAtom.id}"`));
    assert.match(markup, /role="img"/);
    assert.ok(markup.includes(semiDevelopedStereoAccessibleLabel(centers[0], language, 2)));
    assert.ok(markup.includes(`>${name}</text>`));
    assert.doesNotMatch(markup, /role="button"|tabindex|hit-target|data-editor-only|tetrahedral-wedge|tetrahedral-hash/i);
  }
  assert.deepEqual(molecule.atoms.map((a) => a.tetrahedralParity), before.atoms.map((a) => a.tetrahedralParity));
});

test("hidden, global off, other representations and reactivation preserve the independent preference and chemistry", () => {
  const { molecule } = configuredFused(), snapshot = structuredClone(molecule);
  const centers = selected(molecule);
  assert.equal(centers.length, 3);
  assert.deepEqual(selected(molecule, "hidden"), []);
  assert.deepEqual(selected(molecule, "labels", false), []);
  assert.deepEqual(selected(molecule, "labels", true, "skeletal"), []);
  assert.deepEqual(selected(molecule, "labels", true, "condensed"), []);
  assert.deepEqual(selected(molecule, "labels"), centers);
  assert.deepEqual(molecule, snapshot);
});

const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
  const t = square ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / square)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};

test("fused alcohol: deterministic badges clear CH/CH2/CH3/OH, numbering, bonds and each other at supported scales", () => {
  const { molecule, numbering } = configuredFused(), before = structuredClone(molecule);
  for (const isMirrored of [false, true]) for (const labelScale of [0.75, 1.25, 1.75]) for (const scale of [0.75, 1, 2, 3]) {
    const graph = { ...molecule, isMirrored };
    const positions = calculateMolecule2DLayout(graph, [], "semi-developed");
    const scene = renderScene(graph, positions, { scale: labelScale });
    const obstacles = scene.glyphs.map(({ point: p, extent: e }) => ({ x: p.x - e.halfWidth, y: p.y - e.halfHeight, width: 2 * e.halfWidth, height: 2 * e.halfHeight }));
    // Number badges are separate obstacles, not the center's chemical identity.
    obstacles.push(...numbering.map((id) => { const p = positions.get(id); return { x: p.x + 23, y: p.y - 40, width: 24, height: 24 }; }));
    const centers = selected(graph), options = { bonds: graph.bonds };
    const badges = layoutTetrahedralBadgePositions(centers, positions, scale, obstacles, options);
    assert.equal(badges.size, centers.length);
    assert.deepEqual(layoutTetrahedralBadgePositions(centers, positions, scale, obstacles, options), badges);
    const radius = TETRAHEDRAL_BADGE_RADIUS * scale;
    for (const [id, p] of badges) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(Math.hypot(p.x - positions.get(id).x, p.y - positions.get(id).y) <= 144 * scale + 1e-7, "near the owning atom within the bounded candidate search");
      for (const e of obstacles) {
        const x = Math.max(e.x, Math.min(p.x, e.x + e.width)), y = Math.max(e.y, Math.min(p.y, e.y + e.height));
        assert.ok(Math.hypot(p.x - x, p.y - y) >= radius + 4 - 1e-7, `badge ${id} clears text/numbering at ${scale}`);
      }
      for (const [a, b] of graph.bonds) assert.ok(segmentDistance(p, positions.get(a), positions.get(b)) >= radius + 7 - 1e-7, `badge ${id} clears bond ${a}-${b}`);
      for (const [other, q] of badges) if (other !== id) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 2 * radius + 7 * scale - 1e-7);
    }
    const extents = [...badges.values()].map((p) => ({ x: p.x - radius, y: p.y - radius, width: 2 * radius, height: 2 * radius }));
    const bounds = getSemiDevelopedBounds(positions.values(), { extents });
    for (const e of extents) assert.ok(e.x >= bounds.x && e.y >= bounds.y && e.x + e.width <= bounds.x + bounds.width && e.y + e.height <= bounds.y + bounds.height, "auto-fit includes complete badges");
  }
  assert.deepEqual(molecule, before);
});

test("switching representations and labels cannot change graph, hydrogens, formula, carriers or stereochemical SMILES", () => {
  const { molecule } = configuredFused(), before = structuredClone(molecule);
  const smiles = moleculeToSmiles(molecule).smiles;
  const centers = getTetrahedralStereoCenters(molecule);
  const carriers = getTetrahedralStereoBonds(molecule).map(({ atomId, neighborAtomId }) => [atomId, neighborAtomId]);
  const skeletal = calculateMolecule2DLayout(molecule, [], "skeletal");
  const semi = calculateMolecule2DLayout(molecule, [], "semi-developed");
  for (const mode of ["skeletal", "semi-developed", "skeletal", "semi-developed"]) for (const display of ["hidden", "labels"]) {
    getSemiDevelopedStereoCenters(molecule, mode, true, display);
    assert.deepEqual(calculateMolecule2DLayout(molecule, [], mode), mode === "skeletal" ? skeletal : semi);
    assert.deepEqual(getTetrahedralStereoCenters(molecule), centers);
    assert.equal(moleculeToSmiles(molecule).smiles, smiles);
    assert.equal(inspectSmilesStructure(smiles).formula, "C14H26O");
  }
  assert.deepEqual(getTetrahedralStereoBonds(molecule).map(({ atomId, neighborAtomId }) => [atomId, neighborAtomId]), carriers);
  assert.deepEqual(molecule, before);
});

test("preferences default safely, persist independently and recover unavailable or corrupt storage", () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  for (const invalid of [undefined, null, "unknown", "labels-and-bonds", "{bad", 0, {}]) assert.equal(normalizeSemiDevelopedStereoDisplay(invalid), "labels");
  assert.equal(readSemiDevelopedStereoDisplay(), "labels");
  assert.equal(readSemiDevelopedStereoDisplay(storage), "labels");
  writeSemiDevelopedStereoDisplay("hidden", storage);
  assert.equal(values.get(SEMI_DEVELOPED_STEREO_STORAGE_KEY), "hidden");
  assert.equal(readSemiDevelopedStereoDisplay(storage), "hidden");
  writeSemiDevelopedStereoDisplay("labels", storage);
  assert.equal(readSemiDevelopedStereoDisplay(storage), "labels");
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(readSemiDevelopedStereoDisplay(blocked), "labels");
  assert.doesNotThrow(() => writeSemiDevelopedStereoDisplay("hidden", blocked));
  assert.doesNotThrow(() => writeSemiDevelopedStereoDisplay("labels"));
});

test("ES/EN configuration, accessible locants and explicit atom-ID fallback are independent of chemistry", () => {
  const center = { atomId: 911, configuration: "S" };
  assert.equal(semiDevelopedStereoAccessibleLabel(center, "es", 2), "Carbono 2, configuración S");
  assert.equal(semiDevelopedStereoAccessibleLabel(center, "en", 2), "Carbon 2, S configuration");
  assert.equal(semiDevelopedStereoAccessibleLabel(center, "en"), "Atom ID 911, S configuration");
  assert.equal(semiDevelopedStereoAccessibleLabel(center, "es", 0), "Átomo ID 911, configuración S");
  for (const text of ["Estereoquímica en semidesarrollada", "Ocultar R/S", "Mostrar R/S", "Mostrar R/S y enlaces estereoquímicos"]) {
    assert.equal(uiText("es", text), text);
    assert.notEqual(uiText("en", text), text);
  }
});

test("page wires default labels to fit bounds and exportable informational glyphs while keeping advanced bonds disabled", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /viewMode === "skeletal" && stereochemistryEnabled[\s\S]*?getTetrahedralStereoBonds/);
  assert.match(page, /const tetrahedralBadgeDescriptors = viewMode === "semi-developed"[\s\S]*?semiDevelopedStereoCenters : tetrahedralStereoBonds/);
  assert.match(page, /value="labels-and-bonds" disabled/);
  assert.match(page, /<SemiDevelopedStereoBadgeSvg[\s\S]*?locant=\{semiDevelopedAtomGlyphs.get\(center.atomId\)\?\.element === "C"[\s\S]*?activeAnalysis.numberedAtoms.get\(center.atomId\) : undefined/);
  assert.match(page, /semiDevelopedStereoPreferenceReady/);
  assert.match(page, /getSemiDevelopedBounds\(displayPositions.values\(\), \{[^\n]*extents: visualExtents/);
  assert.match(page, /cleanSvgForExport\(clonedSvg\)/);
  assert.match(page, /if \(isolatedBuild \|\| !semiDevelopedStereoPreferenceReady\) return/);
});
