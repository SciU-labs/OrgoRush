import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import sharp from "sharp";
import { Molecule as OCLMolecule } from "openchemlib";
import { fuseRingOnBond } from "../app/fused-ring.ts";
import { calculateMolecule2DLayout } from "../app/molecule-2d-layout.ts";
import { getFusedBicyclicSystem, getFusedTricyclicSystem } from "../app/fused-ring-nomenclature.ts";
import { inspectSmilesStructure, moleculeFromSmiles, moleculeToSmiles } from "../app/openchemlib-adapter.ts";
import { buildOpenChemLibStereoGraph, getTetrahedralStereoBonds, getTetrahedralStereoCenters, setTetrahedralConfiguration } from "../app/tetrahedral-stereochemistry.ts";
import { readChemistryDocument, toSerializedPortableStructureV2 } from "../app/chemistry-document-validation.ts";
import { complexFused, fused, renderScene } from "./helpers/semi-fused-fixture.mjs";
import { loadExerciseChemistry } from "./helpers/exercise-chemistry.mjs";

let chemistry;
before(async () => { chemistry = await loadExerciseChemistry(); });
after(async () => { await chemistry?.close(); });
const analyzeSystem = (molecule) => (molecule.rings.length === 2 ? getFusedBicyclicSystem : getFusedTricyclicSystem)(
  molecule, chemistry.engine.detectFunctionalGroups(molecule));

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("fused 6+6 semi-developed polygons have unique vertices and equal shared-edge lengths", () => {
  const molecule = fused();
  const positions = calculateMolecule2DLayout(molecule, [], "semi-developed");
  const collisions = [];
  for (const [id, point] of positions) for (const [other, target] of positions) {
    if (id < other && distance(point, target) < 1e-7) collisions.push({ id, other, point, target });
  }
  const lengths = molecule.bonds.map(([a, b]) => ({ a, b, length: distance(positions.get(a), positions.get(b)) }));
  assert.deepEqual(collisions, [], "distinct carbon IDs must not share a display vertex");
  // Regular polygons use the existing 142-unit side; epsilon only absorbs floating point rotation.
  for (const { a, b, length } of lengths) assert.ok(Math.abs(length - 142) < 1e-7, `${a}-${b}: ${length}`);
});

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const area = (points) => Math.abs(points.reduce((sum, p, i) => {
  const q = points[(i + 1) % points.length]; return sum + p.x * q.y - p.y * q.x;
}, 0) / 2);
const centroid = (ids, positions) => ids.reduce((sum, id) => ({
  x: sum.x + positions.get(id).x / ids.length, y: sum.y + positions.get(id).y / ids.length,
}), { x: 0, y: 0 });

function checkGeometry(molecule, positions) {
  assert.equal(positions.size, molecule.atoms.length);
  for (const { id } of molecule.atoms) {
    const p = positions.get(id);
    assert.ok(Number.isFinite(p?.x) && Number.isFinite(p?.y), `finite position of ${id}`);
    for (const { id: other } of molecule.atoms) if (id !== other) {
      assert.ok(distance(p, positions.get(other)) > 1e-7, `vertices ${id}/${other} differ`);
    }
  }
  for (const [a, b] of molecule.bonds) assert.ok(distance(positions.get(a), positions.get(b)) > 1e-7);
  for (const ring of molecule.rings) {
    const points = ring.atomIds.map((id) => positions.get(id));
    const n = points.length;
    const expectedArea = n * 142 ** 2 / (4 * Math.tan(Math.PI / n));
    assert.ok(Math.abs(area(points) - expectedArea) < 1e-6, "complete regular polygon area");
    ring.atomIds.forEach((id, i) => assert.ok(Math.abs(distance(positions.get(id), points[(i + 1) % n]) - 142) < 1e-7));
  }
  for (const [i, left] of molecule.rings.entries()) for (const right of molecule.rings.slice(i + 1)) {
    const shared = left.atomIds.filter((id) => right.atomIds.includes(id));
    if (!shared.length) continue;
    assert.equal(shared.length, 2, "exactly two shared IDs, represented once in the Map");
    const [a, b] = shared.map((id) => positions.get(id));
    assert.ok(cross(a, b, centroid(left.atomIds, positions)) * cross(a, b, centroid(right.atomIds, positions)) < 0,
      "polygon interiors lie in opposite shared-edge half-planes");
  }
  for (const [i, [a, b]] of molecule.bonds.entries()) for (const [c, d] of molecule.bonds.slice(i + 1)) {
    if (a === c || a === d || b === c || b === d) continue;
    const p = positions.get(a), q = positions.get(b), r = positions.get(c), s = positions.get(d);
    assert.ok(!(cross(p, q, r) * cross(p, q, s) < -1e-7 && cross(r, s, p) * cross(r, s, q) < -1e-7),
      `no crossing of unrelated bonds ${a}-${b}/${c}-${d}`);
  }
}

const tricyclic = (first = 6, second = 6, third = 6) => fuseRingOnBond(fused(first, second), 8, 9, third);
const cases = [
  ["5+5", () => fused(5, 5), "C8H14"],
  ["5+6", () => fused(5, 6), "C9H16"],
  ["6+5", () => fused(6, 5), "C9H16"],
  ["6+6", () => fused(), "C10H18"],
  ["three rings 6+6+6", tricyclic, "C14H24"],
  ["three rings 6+6+5", () => tricyclic(6, 6, 5), "C13H22"],
  ["three rings 6+5+6", () => tricyclic(6, 5, 6), "C13H22"],
  ["OH, propyl and methyl", () => complexFused().molecule, "C14H26O"],
];

for (const [name, create, formula] of cases) test(`${name}: geometry, identity, numbering, formula and view round trips`, () => {
  const molecule = create(), before = structuredClone(molecule);
  const smiles = moleculeToSmiles(molecule);
  assert.equal(smiles.ok, true, smiles.error);
  assert.equal(inspectSmilesStructure(smiles.smiles).formula, formula);
  const analysis = analyzeSystem(molecule);
  assert.ok(analysis?.systematicName, "real chemical analysis recognizes the fused parent");
  const skeletal = calculateMolecule2DLayout(molecule, [], "skeletal");
  const semi = calculateMolecule2DLayout(molecule, [], "semi-developed");
  checkGeometry(molecule, semi);
  assert.deepEqual(calculateMolecule2DLayout(molecule, [], "skeletal"), skeletal);
  assert.deepEqual(calculateMolecule2DLayout(molecule, [], "semi-developed"), semi);
  assert.deepEqual(molecule, before, "layout cannot mutate chemistry, coordinates, stereo or metadata");
  assert.deepEqual(analyzeSystem(molecule), analysis, "same systematic name and locant-to-ID mapping");
  assert.equal(moleculeToSmiles(molecule).smiles, smiles.smiles);
  const imported = moleculeFromSmiles(smiles.smiles);
  assert.equal(imported.ok, true, imported.error);
  assert.equal(moleculeToSmiles(imported.molecule).smiles, smiles.smiles);
  checkGeometry(imported.molecule, calculateMolecule2DLayout(imported.molecule, [], "semi-developed"));
  const chemicalChecks = {
    calculateFormula: (graph) => inspectSmilesStructure(moleculeToSmiles(graph).smiles).formula,
    isValenceValid: (graph) => graph.atoms.every((atom) => graph.bonds.reduce((sum, [a, b, order = 1]) =>
      sum + (a === atom.id || b === atom.id ? order : 0), 0) <= (atom.element === "O" ? 2 : 4)),
    isSupportedElement: (element) => ["C", "O"].includes(element),
  };
  const structure = { molecule, name: analysis.systematicName, formula, family: "polycyclic", viewMode: "semi-developed",
    atomCount: molecule.atoms.length, createdAt: "2026-10-20", updatedAt: "2026-10-20" };
  const document = { format: "laboratorio-quimica-organica", version: 2, kind: "structure", structure: toSerializedPortableStructureV2(structure) };
  const restored = readChemistryDocument(JSON.parse(JSON.stringify(document)), chemicalChecks)[0];
  assert.deepEqual(restored.molecule, molecule);
  assert.deepEqual(calculateMolecule2DLayout(restored.molecule, [], restored.viewMode), semi);
});

test("edge anchoring survives record order, ring rotation/reversal, IDs, coordinates and reflection", () => {
  for (const create of [() => fused(5, 5), () => fused(5, 6), () => fused(6, 5), () => fused(), tricyclic, () => complexFused().molecule]) {
    const molecule = create();
    const orders = molecule.rings.length === 3 ? [[0, 2, 1], [2, 0, 1], [1, 2, 0], [2, 1, 0]] : [[0, 1], [1, 0]];
    for (const order of orders) for (let reverseMask = 0; reverseMask < 2 ** molecule.rings.length; reverseMask++) for (const mirror of [false, true]) {
      for (let shift = 0; shift < 6; shift++) {
        const remap = new Map(molecule.atoms.map((a, i) => [a.id, 1009 - i * 17]));
        const graph = {
          ...molecule, isMirrored: mirror,
          atoms: molecule.atoms.toReversed().map((a) => ({ ...a, id: remap.get(a.id), x: -a.y + 7, y: a.x * 2 - 5 })),
          bonds: molecule.bonds.toReversed().map(([a, b, ...rest]) => [remap.get(b), remap.get(a), ...rest]),
          rings: order.map((i) => {
            let ids = molecule.rings[i].atomIds.map((id) => remap.get(id));
            if (reverseMask & (1 << i)) ids.reverse();
            const j = shift % ids.length;
            return { ...molecule.rings[i], atomIds: [...ids.slice(j), ...ids.slice(0, j)] };
          }),
        };
        checkGeometry(graph, calculateMolecule2DLayout(graph, [], "semi-developed"));
      }
    }
  }
});

// Bounds from rasterized production TSX glyphs, not just the estimated hit targets.
const rasterCache = new Map();
async function rasterBounds(glyph, fontSize) {
  const key = `${fontSize}:${glyph.markup}`;
  if (!rasterCache.has(key)) rasterCache.set(key, (async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><style>.atom-label{font-family:Arial;font-size:${fontSize}px;font-weight:800}.hydrogen-subscript{font-size:0.96em}.semi-developed-hover-ring{display:none}</style><g transform="translate(120 90)">${glyph.markup}</g></svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < 1) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    assert.ok(maxX > minX && maxY > minY, "real text renders nonempty pixels");
    return { left: minX - 120, right: maxX + 1 - 120, top: minY - 90, bottom: maxY + 1 - 90 };
  })());
  return rasterCache.get(key);
}

function segmentHitsBox(s, box) {
  let lo = 0, hi = 1;
  for (const [start, end, min, max] of [[s.x, s.x2, box.left, box.right], [s.y, s.y2, box.top, box.bottom]]) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-9) { if (start < min || start > max) return false; }
    else { const a = (min - start) / delta, b = (max - start) / delta; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); }
  }
  return lo <= hi;
}

for (const [name, create] of cases) test(`${name}: real SVG glyphs, label pixels and clipped bonds remain distinct`, async () => {
  const molecule = create(), positions = calculateMolecule2DLayout(molecule, [], "semi-developed");
  for (const scale of [0.75, 1.25, 1.75]) {
    const scene = renderScene(molecule, positions, { scale });
    assert.equal(scene.glyphs.length, molecule.atoms.length);
    assert.equal(scene.segments.length, molecule.bonds.length, "all single bonds survive label clipping");
    const boxes = await Promise.all(scene.glyphs.map(async (glyph) => {
      const box = await rasterBounds(glyph, scene.fontSize);
      return { id: glyph.atomId, left: box.left + glyph.point.x, right: box.right + glyph.point.x,
        top: box.top + glyph.point.y, bottom: box.bottom + glyph.point.y };
    }));
    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) {
      assert.ok(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top,
        `actual text bounds of ${a.id}/${b.id} do not overlap at scale ${scale}`);
    }
    for (const segment of scene.segments) for (const box of boxes) {
      assert.ok(!segmentHitsBox(segment, box), `visible bond ${segment.a}-${segment.b} clears label ${box.id}`);
    }
    assert.equal((scene.svg.match(/data-atom=/g) ?? []).length, molecule.atoms.length);
  }
});

test("reported alcohol uses the correct CH/CH2 groups and locant-linked OH, propyl and methyl", () => {
  const { molecule, numbering } = complexFused();
  const scene = renderScene(molecule, calculateMolecule2DLayout(molecule, [], "semi-developed"));
  const groups = new Map(scene.glyphs.map((g) => [g.atomId, g]));
  assert.deepEqual(numbering.map((id) => groups.get(id).carbonGroup), ["CH", "CH", "CH2", "CH", "CH2", "CH", "CH", "CH2", "CH2", "CH2"]);
  for (const [locant, child] of [[2, 11], [4, 12], [7, 15]]) {
    assert.ok(scene.segments.some((s) => s.a === numbering[locant - 1] && s.b === child));
  }
  assert.equal(groups.get(11).label, "OH");
  assert.deepEqual([12, 13, 14, 15].map((id) => groups.get(id).carbonGroup), ["CH2", "CH2", "CH3", "CH3"]);
  assert.equal(analyzeSystem(molecule).systematicName, "7-metil-4-propilbiciclo[4.4.0]decan-2-ol");
});

test("stored R/S and preferred carriers survive layout, reflection and SMILES round trips", () => {
  let { molecule, numbering } = complexFused();
  for (const [locant, configuration, carrier] of [[2, "R", 11], [4, "S", 12], [7, "R", 15]]) {
    const result = setTetrahedralConfiguration(molecule, numbering[locant - 1], configuration, carrier);
    assert.equal(result.ok, true, result.error); molecule = result.molecule;
  }
  const centers = getTetrahedralStereoCenters(molecule);
  assert.equal(centers.length, 3);
  const snapshot = structuredClone(molecule), smiles = moleculeToSmiles(molecule).smiles;
  for (const mode of ["skeletal", "semi-developed"]) for (const isMirrored of [false, true]) {
    const source = { ...molecule, isMirrored };
    const positions = calculateMolecule2DLayout(source, [], mode);
    const displayed = { ...source, atoms: source.atoms.map((a) => ({ ...a, ...positions.get(a.id) })) };
    assert.deepEqual(getTetrahedralStereoCenters(displayed), centers);
    const descriptors = getTetrahedralStereoBonds(displayed);
    assert.equal(descriptors.length, 3);
    for (const descriptor of descriptors) {
      assert.equal(descriptor.neighborAtomId, source.atoms.find((a) => a.id === descriptor.atomId).tetrahedralBondTo);
      assert.ok(["wedge", "hash"].includes(descriptor.style));
    }
    // Decode the actual wedge/hash with stored R/S disabled: geometry must
    // communicate the same absolute configuration even after reflection.
    const visual = buildOpenChemLibStereoGraph(displayed, false);
    for (const descriptor of descriptors) {
      const center = visual.atomIdToIndex.get(descriptor.atomId), neighbor = visual.atomIdToIndex.get(descriptor.neighborAtomId);
      const bond = visual.molecule.getBond(center, neighbor);
      visual.molecule.setBondAtom(0, bond, center);
      visual.molecule.setBondAtom(1, bond, neighbor);
      visual.molecule.setBondType(bond, descriptor.style === "wedge" ? OCLMolecule.cBondTypeUp : OCLMolecule.cBondTypeDown);
    }
    visual.molecule.ensureHelperArrays(OCLMolecule.cHelperCIP);
    for (const descriptor of descriptors) assert.equal(
      visual.molecule.getAtomCIPParity(visual.atomIdToIndex.get(descriptor.atomId)),
      descriptor.configuration === "R" ? OCLMolecule.cAtomCIPParityRorM : OCLMolecule.cAtomCIPParitySorP,
      "wedge/hash decoded without stored parity agrees with R/S");
    assert.equal(moleculeToSmiles(displayed).smiles, smiles, "layout cannot invert stored absolute stereo");
  }
  const restored = moleculeFromSmiles(smiles);
  assert.equal(restored.ok, true, restored.error);
  assert.equal(moleculeToSmiles(restored.molecule).smiles, smiles);
  assert.deepEqual(molecule, snapshot);
});
