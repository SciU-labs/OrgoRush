import { IUPAC_ROOTS, englishIupacRoot } from "./iupac-prefixes.ts";
import type { RingGraph, TopologyResult } from "./fused-topology.ts";

export type CyclicParent1979 = {
  nameEs: string; nameEn: string; rule: string;
  numbering: number[]; locants: ReadonlyMap<number, string>;
  family: "bicyclic" | "spiro" | "assembly" | "heterocycle";
};
type Ring = { kind: "aromatic" | "cycloalkane"; atomIds: number[] };
const rootPattern = [...IUPAC_ROOTS].filter(Boolean).sort((a, b) => b.length - a.length).join("|");
const bicycleSpelling = new RegExp(`^biciclo\\[(\\d+)\\.(\\d+)\\.(\\d+)\\](${rootPattern})ano$`);
const spiroSpelling = new RegExp(`^espiro\\[(\\d+)\\.(\\d+)\\](${rootPattern})ano$`);
const identicalAssemblySpelling = new RegExp(`^1,1'-biciclo(?:${rootPattern})ilo$`);
const differentAssemblySpelling = new RegExp(`^(?:fenil|ciclo(?:${rootPattern})il)(?:benceno|ciclo(?:${rootPattern})ano)$`);
const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};
const ordered = (candidates: number[][]) => candidates.sort(compare)[0];

export function cyclicParentProof(nameEs: string, nameEn: string, rule: string, numbering: number[],
  family: CyclicParent1979["family"], locants = new Map(numbering.map((id, i) => [id, String(i + 1)]))): CyclicParent1979 {
  return { nameEs, nameEn, rule, numbering, locants, family };
}

/** A-31.1–2 and A-41.1–2, bare saturated constitutional parents only.
 * Substituted, unsaturated and higher bridge/spiro grammars are separate work.
 */
export function nameBareCyclicParent1979(graph: RingGraph, topology: TopologyResult, rings: Ring[]): CyclicParent1979 | undefined {
  if (topology.reason || topology.kind === "invalid" || !graph.atoms.length
    || graph.atoms.some(a => (a.element ?? "C") !== "C" || (a.charge ?? 0) !== 0
      || ("tetrahedralParity" in a && a.tetrahedralParity !== undefined)
      || ("tetrahedralBondTo" in a && a.tetrahedralBondTo !== undefined))
    || graph.bonds.some(b => b.slice(3).some(value => value !== undefined && value !== false))) return;
  const n = graph.atoms.length, root = IUPAC_ROOTS[n]; if (!root) return;
  const adjacency = new Map(graph.atoms.map(a => [a.id, [] as number[]]));
  for (const [a, b] of graph.bonds) { adjacency.get(a)!.push(b); adjacency.get(b)!.push(a); }
  const saturated = graph.bonds.every(([, , o = 1]) => o === 1);
  const heads = graph.atoms.filter(a => adjacency.get(a.id)!.length === 3).map(a => a.id);
  if (saturated && topology.cycleRank === 2 && heads.length === 2
    && graph.atoms.every(a => heads.includes(a.id) || adjacency.get(a.id)!.length === 2)) {
    const candidates: number[][] = [], descriptors: number[][] = [];
    for (const start of heads) {
      const end = heads.find(id => id !== start)!, paths: number[][] = [];
      for (const next of adjacency.get(start)!) {
        const path = [start, next];
        while (path.at(-1) !== end && path.length <= n) {
          const last = path.at(-1)!, previous = path.at(-2)!;
          const following = adjacency.get(last)!.find(id => id !== previous);
          if (following === undefined || path.includes(following)) break;
          path.push(following);
        }
        if (path.at(-1) === end) paths.push(path);
      }
      if (paths.length !== 3 || new Set(paths.flatMap(p => p.slice(1, -1))).size !== n - 2) continue;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) {
        const k = 3 - i - j;
        if (paths[i].length < paths[j].length || paths[j].length < paths[k].length) continue;
        const numbering = [...paths[i], ...paths[j].slice(1, -1).reverse(), ...paths[k].slice(1, -1)];
        if (numbering.length === n && new Set(numbering).size === n) { candidates.push(numbering); descriptors.push([i, j, k].map(x => paths[x].length - 2)); }
      }
    }
    if (candidates.length) {
      const descriptor = `[${descriptors[0].join(".")}]`;
      return cyclicParentProof(`biciclo${descriptor}${root}ano`, `bicyclo${descriptor}${englishIupacRoot(root)}ane`, "A-31.1–2", ordered(candidates), "bicyclic");
    }
  }
  const junctions = graph.atoms.filter(a => adjacency.get(a.id)!.length === 4);
  if (saturated && topology.kind === "spiro" && topology.cycleRank === 2 && rings.length === 2 && junctions.length === 1
    && graph.atoms.every(a => a.id === junctions[0].id || adjacency.get(a.id)!.length === 2)) {
    const center = junctions[0].id, small = Math.min(...rings.map(r => r.atomIds.length - 1));
    const candidates: number[][] = [];
    for (const first of rings.filter(r => r.atomIds.length - 1 === small)) {
      const other = rings.find(r => r !== first)!;
      const around = (ring: Ring) => {
        const i = ring.atomIds.indexOf(center), p = [...ring.atomIds.slice(i + 1), ...ring.atomIds.slice(0, i)];
        return [p, [...p].reverse()];
      };
      for (const a of around(first)) for (const b of around(other)) candidates.push([...a, center, ...b]);
    }
    const descriptor = `[${rings.map(r => r.atomIds.length - 1).sort((a, b) => a - b).join(".")}]`;
    return cyclicParentProof(`espiro${descriptor}${root}ano`, `spiro${descriptor}${englishIupacRoot(root)}ane`, "A-41.1–2", ordered(candidates), "spiro");
  }
  if (topology.kind !== "linked" || rings.length !== 2 || rings.some(r => r.atomIds.length < 3
    || !IUPAC_ROOTS[r.atomIds.length] || (r.kind === "aromatic" && r.atomIds.length !== 6))
    || new Set(rings.flatMap(r => r.atomIds)).size !== n) return;
  const connecting = graph.bonds.filter(([a, b]) => rings[0].atomIds.includes(a) !== rings[0].atomIds.includes(b));
  if (connecting.length !== 1 || (connecting[0][2] ?? 1) !== 1) return;
  if (rings.some(r => r.kind !== "aromatic" && graph.bonds.some(([a, b, o = 1]) => r.atomIds.includes(a) && r.atomIds.includes(b) && o !== 1))) return;
  // A-53.2: ring size precedes degree of hydrogenation.
  const [parent, sub] = [...rings].sort((a, b) => b.atomIds.length - a.atomIds.length
    || Number(b.kind === "aromatic") - Number(a.kind === "aromatic"));
  const attach = (ring: Ring) => [connecting[0][0], connecting[0][1]].find(id => ring.atomIds.includes(id))!;
  const paths = (ring: Ring) => {
    const index = ring.atomIds.indexOf(attach(ring));
    const p = [...ring.atomIds.slice(index), ...ring.atomIds.slice(0, index)];
    return ordered([p, [p[0], ...p.slice(1).reverse()]]);
  };
  const main = paths(parent), secondary = paths(sub), numbering = [...main, ...secondary];
  const locants = new Map([...main.map((id, i) => [id, String(i + 1)] as const), ...secondary.map((id, i) => [id, `${i + 1}'`] as const)]);
  const same = parent.atomIds.length === sub.atomIds.length && parent.kind === sub.kind;
  if (same && parent.kind === "aromatic") return cyclicParentProof("bifenilo", "biphenyl", "A-52.4", numbering, "assembly", locants);
  const parentRoot = IUPAC_ROOTS[parent.atomIds.length], subRoot = IUPAC_ROOTS[sub.atomIds.length];
  if (same) return cyclicParentProof(`1,1'-biciclo${parentRoot}ilo`, `1,1'-bicyclo${englishIupacRoot(parentRoot)}yl`, "A-52.1–2", numbering, "assembly", locants);
  const prefixEs = sub.kind === "aromatic" ? "fenil" : `ciclo${subRoot}il`;
  const prefixEn = sub.kind === "aromatic" ? "phenyl" : `cyclo${englishIupacRoot(subRoot)}yl`;
  return cyclicParentProof(`${prefixEs}${parent.kind === "aromatic" ? "benceno" : `ciclo${parentRoot}ano`}`,
    `${prefixEn}${parent.kind === "aromatic" ? "benzene" : `cyclo${englishIupacRoot(parentRoot)}ane`}`, "A-53.1–2", numbering, "assembly", locants);
}

/** Lexical admission only; callers must require the complete graph proof. */
export function isCyclicParent1979Spelling(value: string) {
  const bicycle = value.match(bicycleSpelling);
  if (bicycle) {
    const [, a, b, c, stem] = bicycle;
    return +a >= +b && +b >= 1 && +b >= +c && IUPAC_ROOTS[+a + +b + +c + 2] === stem;
  }
  const spiro = value.match(spiroSpelling);
  if (spiro) return +spiro[1] >= 2 && +spiro[2] >= +spiro[1] && IUPAC_ROOTS[+spiro[1] + +spiro[2] + 1] === spiro[3];
  return identicalAssemblySpelling.test(value)
    || value === "bifenilo"
    || differentAssemblySpelling.test(value);
}
