import assert from "node:assert/strict";

/** Small independent SMILES reader for this corpus only. No production import,
 * ring perception, naming, normalization or functional-group code is reused. */
export function referenceGraph(smiles) {
  const atoms = [], bonds = [], branches = [], rings = new Map();
  let current, pending;
  for (let i = 0; i < smiles.length;) {
    const ch = smiles[i];
    if (ch === "(") { branches.push(current); i++; continue; }
    if (ch === ")") { assert.ok(branches.length); current = branches.pop(); i++; continue; }
    if ("-=#".includes(ch)) { pending = { "-": 1, "=": 2, "#": 3 }[ch]; i++; continue; }
    if (/\d/.test(ch)) {
      if (rings.has(ch)) {
        const [other, order] = rings.get(ch);
        bonds.push([current, other, pending ?? order ?? (atoms[current - 1].aromatic && atoms[other - 1].aromatic ? 1.5 : 1)]);
        rings.delete(ch);
      } else rings.set(ch, [current, pending]);
      pending = undefined; i++; continue;
    }
    const token = /^(?:Cl|Br|C|N|O|F|I|c|n)/.exec(smiles.slice(i))?.[0];
    assert.ok(token, `Unsupported reference grammar at ${smiles.slice(i)}`);
    const atom = { id: atoms.length + 1, element: token.toUpperCase() === "CL" ? "Cl" : token.toUpperCase() === "BR" ? "Br" : token.toUpperCase(), aromatic: token === token.toLowerCase() };
    atoms.push(atom);
    if (current !== undefined) bonds.push([current, atom.id, pending ?? (atoms[current - 1].aromatic && atom.aromatic ? 1.5 : 1)]);
    current = atom.id; pending = undefined; i += token.length;
  }
  assert.equal(rings.size, 0); assert.equal(branches.length, 0);
  const neighbors = id => bonds.flatMap(([a, b, order]) => a === id ? [{ id: b, order }] : b === id ? [{ id: a, order }] : []);
  const element = id => atoms[id - 1].element;
  const counts = {};
  for (const atom of atoms) {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
    const edges = neighbors(atom.id);
    const hydrogen = atom.aromatic ? atom.element === "C" ? 3 - edges.length : 0
      : ({ C: 4, O: 2, N: 3, F: 1, Cl: 1, Br: 1, I: 1 }[atom.element] - edges.reduce((sum, edge) => sum + edge.order, 0));
    assert.ok(Number.isInteger(hydrogen) && hydrogen >= 0, `Reference valence ${smiles} atom ${atom.id}`);
    counts.H = (counts.H ?? 0) + hydrogen;
  }
  const formula = ["C", "H", ...Object.keys(counts).filter(key => !["C", "H"].includes(key)).sort()]
    .filter(key => counts[key]).map(key => key + (counts[key] === 1 ? "" : counts[key])).join("");
  const groups = [];
  const add = (kind, carbonId, atomIds) => groups.push({ kind, carbonId, atomIds });
  for (const atom of atoms.filter(atom => atom.element === "C" && !atom.aromatic)) {
    const near = neighbors(atom.id), doubleO = near.find(edge => element(edge.id) === "O" && edge.order === 2);
    const tripleN = near.find(edge => element(edge.id) === "N" && edge.order === 3);
    if (tripleN) add("nitrile", atom.id, [atom.id, tripleN.id]);
    if (!doubleO) continue;
    const singleO = near.find(edge => element(edge.id) === "O" && edge.order === 1);
    const singleN = near.find(edge => element(edge.id) === "N" && edge.order === 1);
    if (singleO) add(neighbors(singleO.id).length === 1 ? "carboxylicAcid" : "ester", atom.id, [atom.id, doubleO.id, singleO.id]);
    else if (singleN) add("amide", atom.id, [atom.id, doubleO.id, singleN.id]);
    else add(near.filter(edge => element(edge.id) === "C").length === 2 ? "ketone" : "aldehyde", atom.id, [atom.id, doubleO.id]);
  }
  for (const atom of atoms) {
    const near = neighbors(atom.id);
    if (atom.element === "O" && near.every(edge => edge.order === 1 && element(edge.id) === "C")
      && !groups.some(group => group.atomIds.includes(atom.id))) {
      add(near.length === 1 ? "alcohol" : "ether", near[0].id, [atom.id, ...near.map(edge => edge.id)]);
    }
    if (atom.element === "N" && near.every(edge => edge.order === 1 && element(edge.id) === "C")
      && !groups.some(group => group.atomIds.includes(atom.id))) add("amine", near[0].id, [atom.id, ...near.map(edge => edge.id)]);
    if (["F", "Cl", "Br", "I"].includes(atom.element)) add("halogen", near[0].id, [atom.id, near[0].id]);
  }
  const groupCounts = Object.fromEntries([...new Set(groups.map(group => group.kind))].sort().map(kind => [kind, groups.filter(group => group.kind === kind).length]));
  const primary = ["carboxylicAcid", "ester", "amide", "nitrile", "aldehyde", "ketone", "alcohol", "amine"].find(kind => groupCounts[kind]);
  return { atoms, bonds, neighbors, element, formula, groups, groupCounts, primary, cycleRank: bonds.length - atoms.length + 1 };
}

const lexCompare = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};

/** Enumerate every oriented carbon path independently, without production's
 * path finder. Only the explicitly documented seniority criteria are applied;
 * alphabetical tie resolution is additionally checked by the frozen names. */
export function referenceParentCandidates(graph, profile) {
  if (graph.cycleRank) return null;
  const paths = [];
  const walk = path => {
    paths.push(path);
    for (const edge of graph.neighbors(path.at(-1))) if (graph.element(edge.id) === "C" && !path.includes(edge.id)) walk([...path, edge.id]);
  };
  for (const atom of graph.atoms.filter(atom => atom.element === "C")) walk([atom.id]);
  const scores = paths.map(path => {
    const functional = graph.groups.filter(group => group.kind === graph.primary).flatMap(group => {
      // An amine's nitrogen may bind several carbon components. Every directly
      // attached carbon on this candidate must be considered (N substituents).
      const anchors = group.kind === "amine" ? group.atomIds.filter(id => graph.element(id) === "C") : [group.carbonId];
      return anchors.filter(id => path.includes(id)).map(id => path.indexOf(id) + 1);
    }).sort((a, b) => a - b);
    const doubles = [], triples = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const order = graph.neighbors(path[i]).find(edge => edge.id === path[i + 1]).order;
      if (order === 2) doubles.push(i + 1);
      if (order === 3) triples.push(i + 1);
    }
    const multiple = [...doubles, ...triples].sort((a, b) => a - b);
    const branches = path.flatMap((id, i) => graph.neighbors(id)
      .filter(edge => graph.element(edge.id) === "C" && !path.includes(edge.id)).map(() => i + 1));
    const seniority = profile === "2013-es" ? [-functional.length, -path.length, -multiple.length, -doubles.length]
      : [-functional.length, -multiple.length, -path.length, -doubles.length];
    return { path, score: [...seniority, ...functional, ...multiple, ...doubles, -branches.length, ...branches] };
  });
  scores.sort((a, b) => lexCompare(a.score, b.score));
  return scores.filter(item => lexCompare(item.score, scores[0].score) === 0).map(item => item.path);
}

export function normalizeFormula(formula) {
  const plain = formula.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, char => String("₀₁₂₃₄₅₆₇₈₉".indexOf(char)));
  const counts = Object.fromEntries([...plain.matchAll(/([A-Z][a-z]?)(\d*)/g)].map(([, element, n]) => [element, Number(n || 1)]));
  return ["C", "H", ...Object.keys(counts).filter(key => !["C", "H"].includes(key)).sort()]
    .filter(key => counts[key]).map(key => key + (counts[key] === 1 ? "" : counts[key])).join("");
}
