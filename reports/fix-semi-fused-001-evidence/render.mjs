// Run from the repository root, under an external 85-second process limit.
// This is a static fixture of production layout, glyph and clipping functions;
// it is deliberately not presented as an editor/browser screenshot.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { calculateMolecule2DLayout } from "../../app/molecule-2d-layout.ts";
import { complexFused, fused, loadTsModule, renderScene } from "../../tests/helpers/semi-fused-fixture.mjs";

const baseline = "6e193623d3009df4abc810180822874c242ccfc5";
const oldSource = execFileSync("git", ["show", `${baseline}:app/semi-developed-layout.ts`], { encoding: "utf8" });
const oldLayout = (await loadTsModule(oldSource, new URL("../../app/semi-developed-layout.ts", import.meta.url))).calculateSemiDevelopedLayout;
const directory = new URL("./", import.meta.url);
await mkdir(directory, { recursive: true });
const metrics = { baseline, fixtures: {} };

function measurements(molecule, positions, numbering) {
  const locant = (id) => numbering.indexOf(id) + 1;
  const collisions = [];
  for (const [id, a] of positions) for (const [other, b] of positions) {
    if (id >= other || Math.hypot(a.x - b.x, a.y - b.y) > 1e-7) continue;
    collisions.push({ atomIds: [id, other], locants: [locant(id), locant(other)], coordinates: [a, b] });
  }
  return { positions: [...positions], collisions, lengths: molecule.bonds.map(([a, b]) => ({
    atomIds: [a, b], length: Math.hypot(positions.get(a).x - positions.get(b).x, positions.get(a).y - positions.get(b).y),
  })), reportedPairs: [[2, 8], [1, 5], [4, 10]].map(([a, b]) => ({
    locants: [a, b], distance: Math.hypot(positions.get(numbering[a - 1]).x - positions.get(numbering[b - 1]).x,
      positions.get(numbering[a - 1]).y - positions.get(numbering[b - 1]).y),
  })) };
}

for (const [name, fixture] of [["core", { molecule: fused(), numbering: [1, 6, 5, 4, 3, 2, 10, 9, 8, 7] }], ["alcohol", complexFused()]]) {
  const { molecule, numbering } = fixture;
  const before = oldLayout(molecule), after = calculateMolecule2DLayout(molecule, [], "semi-developed");
  metrics.fixtures[name] = { molecule, numbering, before: measurements(molecule, before, numbering), after: measurements(molecule, after, numbering) };
  const images = [];
  for (const [view, positions, skeletal] of [
    ["skeletal", calculateMolecule2DLayout(molecule, [], "skeletal"), true],
    ["before", before, false], ["after", after, false],
  ]) {
    const { svg } = renderScene(molecule, positions, { numbering, skeletal, width: 900 });
    await writeFile(new URL(`${name}-${view}.svg`, directory), svg);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(new URL(`${name}-${view}.png`, directory), png);
    images.push(await sharp(png).resize(500, 500, { fit: "contain", background: "white" }).png().toBuffer());
  }
  await sharp({ create: { width: 1500, height: 500, channels: 4, background: "white" } })
    .composite(images.map((input, index) => ({ input, left: index * 500, top: 0 })))
    .png().toFile(new URL(`${name}-comparison.png`, directory).pathname.replace(/^\/(.:)/, "$1"));
}
const { molecule, numbering } = complexFused();
const positions = calculateMolecule2DLayout(molecule, [], "semi-developed");
for (const width of [320, 390, 1280]) for (const dark of [false, true]) {
  const { svg } = renderScene(molecule, positions, { numbering, width, dark });
  const stem = `alcohol-${width}-${dark ? "dark" : "light"}`;
  await writeFile(new URL(`${stem}.svg`, directory), svg);
  await sharp(Buffer.from(svg)).png().toFile(new URL(`${stem}.png`, directory).pathname.replace(/^\/(.:)/, "$1"));
}
await writeFile(new URL("coordinates.json", directory), JSON.stringify(metrics, null, 2) + "\n");
console.log("Static evidence generated: baseline/fixed coordinates, SVG, PNG and viewport fixtures (not full UI verification).");
