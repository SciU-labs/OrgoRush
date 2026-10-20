import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildHydrocarbonFromIupacName } from "../../app/name-to-molecule.ts";
import { fuseRingOnBond } from "../../app/fused-ring.ts";
import { placeAttachmentTemplate } from "../../app/manual-layout.ts";
import { getFusedBicyclicSystem } from "../../app/fused-ring-nomenclature.ts";
import { buildOpenChemLibStereoGraph } from "../../app/tetrahedral-stereochemistry.ts";
import { buildSemiDevelopedRenderModel } from "../../app/semi-developed-renderer.ts";
import { getSemiDevelopedLabelExtent } from "../../app/semi-developed-label-geometry.ts";
import { clipSemiDevelopedBondSegments } from "../../app/semi-developed-bond-geometry.ts";
import { getSemiDevelopedBounds } from "../../app/semi-developed-layout.ts";

// Load the real TSX atom component without importing the editor or copying its markup.
export async function loadTsModule(source, sourceUrl) {
  let compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  compiled = compiled.replace(/from "([^"]+)"/g, (_, specifier) => {
    const url = specifier.startsWith(".") ? new URL(specifier, sourceUrl).href : import.meta.resolve(specifier);
    return `from "${url}"`;
  });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const rendererUrl = new URL("../../app/semi-developed-svg-renderer.tsx", import.meta.url);
const { SemiDevelopedAtomSvg } = await loadTsModule(readFileSync(rendererUrl, "utf8"), rendererUrl);

export function fused(first = 6, second = 6) {
  const result = buildHydrocarbonFromIupacName(first === 6 ? "ciclohexano" : "ciclopentano");
  assert.equal(result.ok, true, result.error);
  return fuseRingOnBond(result.molecule, 1, 2, second);
}

export function complexFused() {
  const molecule = fused();
  const numbering = getFusedBicyclicSystem(molecule).numbering;
  const addBranch = (locant, elements) => {
    let parent = numbering[locant - 1];
    const templateAtoms = elements.map((element, index) => ({ element, x: index + 1, y: 0 }));
    const templateBonds = elements.map((_, index) => [index === 0 ? -1 : index - 1, index, 1]);
    const placement = placeAttachmentTemplate(molecule, parent, templateAtoms, templateBonds, { zigzagLinear: true });
    assert.ok(placement, "real editor attachment placement is available");
    for (const [index, element] of elements.entries()) {
      const id = molecule.atoms.length + 1;
      molecule.atoms.push({ id, element, ...placement[index] });
      molecule.bonds.push([parent, id, 1]);
      parent = id;
    }
  };
  addBranch(2, ["O"]);
  addBranch(4, ["C", "C", "C"]);
  addBranch(7, ["C"]);
  return { molecule, numbering };
}

export function renderScene(molecule, positions, { scale = 1.25, dark = false, width = 1000, skeletal = false, numbering = [] } = {}) {
  const chemical = buildOpenChemLibStereoGraph(molecule);
  const model = buildSemiDevelopedRenderModel(molecule, positions, (id) =>
    chemical.molecule.getImplicitHydrogens(chemical.atomIdToIndex.get(id)));
  const glyphs = model.atoms.map((glyph) => {
    const label = glyph.element === "C" ? (glyph.hydrogens ? "CH" : "C")
      : glyph.element + (glyph.hydrogens ? "H" : "");
    const hydrogenSubscript = glyph.hydrogens > 1 ? glyph.hydrogens : undefined;
    const charge = glyph.charge ? String(glyph.charge) : "";
    const extent = getSemiDevelopedLabelExtent(label, hydrogenSubscript, charge, scale);
    const markup = renderToStaticMarkup(React.createElement(SemiDevelopedAtomSvg, {
      label, hydrogenSubscript, charge, labelScale: scale, selected: false,
    }));
    return { ...glyph, label, hydrogenSubscript, extent, markup, point: positions.get(glyph.atomId) };
  });
  const byId = new Map(glyphs.map((g) => [g.atomId, g]));
  const segments = model.bonds.flatMap(({ atomIds: [a, b] }) => {
    const start = positions.get(a), end = positions.get(b);
    const raw = [{ x: start.x, y: start.y, x2: end.x, y2: end.y }];
    const extent = (id) => skeletal && byId.get(id).element === "C"
      ? { halfWidth: 0, halfHeight: 0 } : byId.get(id).extent;
    return clipSemiDevelopedBondSegments(raw, start, end, extent(a), extent(b))
      .map((segment) => ({ ...segment, a, b }));
  });
  const bounds = getSemiDevelopedBounds(positions.values(), { padding: 72 });
  const background = dark ? "#101827" : "#ffffff", color = dark ? "#f2f5fa" : "#152231";
  const carbonCount = model.atoms.filter((g) => g.element === "C").length;
  const fontSize = carbonCount <= 10 ? 15 : carbonCount <= 20 ? 17 : carbonCount <= 50 ? 22 : 26;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width * bounds.height / bounds.width}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">
    <style>text{font-family:Arial,sans-serif;fill:${color}}.atom-label{font-size:${fontSize}px;font-weight:800}.hydrogen-subscript{font-size:0.96em;font-weight:800}.semi-developed-hover-ring{display:none}</style>
    <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="${background}"/>
    <g stroke="${color}" stroke-width="3">${segments.map((s) => `<line data-bond="${s.a}:${s.b}" x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}"/>`).join("")}</g>
    ${glyphs.filter((g) => !skeletal || g.element !== "C").map((g) => `<g data-atom="${g.atomId}" transform="translate(${g.point.x} ${g.point.y})">${g.markup}</g>`).join("")}
    ${numbering.map((id, index) => { const p = positions.get(id); return `<text x="${p.x + 25}" y="${p.y - 22}" font-size="12">${index + 1}</text>`; }).join("")}
  </svg>`;
  return { svg, glyphs, segments, bounds, fontSize };
}
