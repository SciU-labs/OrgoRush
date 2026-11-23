import { blueBookRule, type CompositionalFamilyGraph, type NameComponent } from "./compositional-name-model.ts";
import { retainedFusedParentTemplate, nameRetainedFused1979 } from "./iupac1979-retained-fused.ts";

type Language = "en" | "es";
type ParentId = "anthracene" | "phenanthrene";
type Prefix = { locants: number[]; en: "methyl" | "bromo" | "chloro"; es: "metil" | "bromo" | "cloro"; start: number; end: number };
const parents: Record<ParentId, { en: string; es: string; stemEn: string; stemEs: string }> = {
  anthracene: { en: "anthracene", es: "antraceno", stemEn: "anthracen", stemEs: "antracen" },
  phenanthrene: { en: "phenanthrene", es: "fenantreno", stemEn: "phenanthren", stemEs: "fenantren" },
};

function planarFusedLayout(template: NonNullable<ReturnType<typeof retainedFusedParentTemplate>>) {
  const points = template.locants.map(() => ({ x: 0, y: 0 }));
  const placed = new Set<number>();
  const hex = Array.from({ length: 6 }, (_, index) => ({ x: Math.cos(index * Math.PI / 3), y: Math.sin(index * Math.PI / 3) }));
  const first = template.rings[0]!;
  first.forEach((atom, index) => { points[atom] = hex[index]!; placed.add(atom); });
  const centroid = (ring: number[]) => ring.reduce((sum, atom) => ({ x: sum.x + points[atom]!.x / ring.length, y: sum.y + points[atom]!.y / ring.length }), { x: 0, y: 0 });
  const edgeExists = (a: number, b: number) => template.graph.bonds.some(([left, right]) => left === a && right === b || left === b && right === a);
  while (placed.size < template.locants.length) {
    let progress = false;
    for (const ring of template.rings) {
      if (ring.every(atom => placed.has(atom))) continue;
      const neighbor = template.rings.find(other => other !== ring && other.every(atom => placed.has(atom))
        && ring.filter(atom => other.includes(atom)).length === 2
        && edgeExists(...ring.filter(atom => other.includes(atom)) as [number, number]));
      if (!neighbor) continue;
      const shared = ring.filter(atom => neighbor.includes(atom));
      const priorCenter = centroid(neighbor);
      let chosen: { center: { x: number; y: number }; coordinates: { x: number; y: number }[] } | undefined;
      for (let index = 0; index < ring.length && !chosen; index++) {
        const next = (index + 1) % ring.length;
        if (!shared.includes(ring[index]!) || !shared.includes(ring[next]!)) continue;
        const a = ring[index]!, b = ring[next]!, targetA = points[a]!, targetB = points[b]!;
        const tx = targetB.x - targetA.x, ty = targetB.y - targetA.y;
        const targetSide = Math.sign(tx * (priorCenter.y - targetA.y) - ty * (priorCenter.x - targetA.x));
        for (const direction of [1, -1]) {
          for (let local = 0; local < 6; local++) {
            const pa = hex[local]!, pb = hex[(local + direction + 6) % 6]!;
            const localAngle = Math.atan2(pb.y - pa.y, pb.x - pa.x), targetAngle = Math.atan2(ty, tx);
            const angle = targetAngle - localAngle, cos = Math.cos(angle), sin = Math.sin(angle);
            const transform = (point: { x: number; y: number }) => ({
              x: targetA.x + cos * (point.x - pa.x) - sin * (point.y - pa.y),
              y: targetA.y + sin * (point.x - pa.x) + cos * (point.y - pa.y),
            });
            const transformed = ring.map((_, offset) => transform(hex[(local + direction * (offset - index) + 6 * 2) % 6]!));
            const center = transform({ x: 0, y: 0 });
            const candidateSide = Math.sign(tx * (center.y - targetA.y) - ty * (center.x - targetA.x));
            if (candidateSide === -targetSide) { chosen = { center, coordinates: transformed }; break; }
          }
          if (chosen) break;
        }
      }
      if (!chosen) continue;
      ring.forEach((atom, index) => { if (!placed.has(atom)) { points[atom] = chosen!.coordinates[index]!; placed.add(atom); } });
      progress = true;
    }
    if (!progress) return null;
  }
  return points;
}

function parsePrefixes(source: string, language: Language): Prefix[] | null {
  const entries: Prefix[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const match = /^(\d+(?:,\d+)*-)(?:(di|tri))?(methyl|metil|bromo|chloro|cloro)/.exec(source.slice(cursor));
    if (!match) return null;
    const locants = match[1]!.slice(0, -1).split(",").map(Number);
    const word = match[3]!;
    const en = word === "metil" ? "methyl" : word === "cloro" ? "chloro" : word as Prefix["en"];
    const es = en === "methyl" ? "metil" : en === "chloro" ? "cloro" : en;
    const count = match[2] === "di" ? 2 : match[2] === "tri" ? 3 : 1;
    if (locants.length !== count || new Set(locants).size !== locants.length
      || locants.some((n, i) => n < 1 || n > 10 || i > 0 && n <= locants[i - 1]!)) return null;
    entries.push({ locants, en, es, start: cursor, end: cursor + match[0].length });
    cursor += match[0].length;
    if (cursor < source.length) { if (source[cursor] !== "-") return null; cursor++; }
  }
  if (entries.length > 2 || entries.some((item, i) => i > 0 && item.start <= entries[i - 1]!.start)) return null;
  if (entries.some(item => item.locants.length > 1 && item.en !== "methyl")) return null;
  if (entries.flatMap(item => item.locants).length > 2 || new Set(entries.flatMap(item => item.locants)).size !== entries.flatMap(item => item.locants).length) return null;
  const key = (item: Prefix) => item.en;
  if (entries.some((item, i) => i > 0 && key(entries[i - 1]!).localeCompare(key(item), language) > 0)) return null;
  return entries;
}

/** Current-profile construction for the two audited all-carbon aromatic
 * tricycles. The parent graph and its fixed numbering come from the retained
 * fused-parent registry; complete graph reconciliation remains mandatory. */
export function parseFusedTricyclicArene(name: string): CompositionalFamilyGraph | null {
  const normalized = name.trim().toLocaleLowerCase("en");
  const language: Language = /antraceno|antracen-|fenantreno|fenantren-/.test(normalized) ? "es" : "en";
  const parentId: ParentId | null = /anthracene|anthracen-|antraceno|antracen-/.test(normalized) ? "anthracene"
    : /phenanthrene|phenanthren-|fenantreno|fenantren-/.test(normalized) ? "phenanthrene" : null;
  if (!parentId) return null;
  const parent = parents[parentId], template = retainedFusedParentTemplate(parentId)!;
  const coreLayout = planarFusedLayout(template);
  if (!coreLayout) return null;
  const parentPattern = language === "en"
    ? parentId === "anthracene" ? /anthracen(?:e|-(\d+)-ol)$/ : /phenanthren(?:e|-(\d+)-ol)$/
    : parentId === "anthracene" ? /antracen(?:o|-(\d+)-ol)$/ : /fenantren(?:o|-(\d+)-ol)$/;
  const parentMatch = parentPattern.exec(normalized);
  if (!parentMatch) return null;
  const parentStart = normalized.length - parentMatch[0].length;
  let prefixSource = normalized.slice(0, parentStart);
  if (prefixSource.endsWith("-")) prefixSource = prefixSource.slice(0, -1);
  const prefixes = prefixSource ? parsePrefixes(prefixSource, language) : [];
  if (!prefixes) return null;
  const hydroxyLocant = parentMatch[1] ? Number(parentMatch[1]) : undefined;
  if (hydroxyLocant !== undefined && (hydroxyLocant < 1 || hydroxyLocant > 10)) return null;
  if (hydroxyLocant !== undefined && prefixes.some(prefix => prefix.locants.includes(hydroxyLocant))) return null;

  const graph: CompositionalFamilyGraph["graph"] = { atoms: [], bonds: [], rings: [] };
  const atom = (element: NonNullable<CompositionalFamilyGraph["graph"]["atoms"][number]["element"]>, anchorId?: number) => {
    const id = graph.atoms.length + 1;
    const center=coreLayout.reduce((sum,point)=>({x:sum.x+point.x/coreLayout.length,y:sum.y+point.y/coreLayout.length}),{x:0,y:0});
    const anchor=anchorId?graph.atoms[anchorId-1]!:undefined;
    let x=0,y=0;
    if(anchor){
      let dx=anchor.x-center.x,dy=anchor.y-center.y,magnitude=Math.hypot(dx,dy);
      if(magnitude<0.2){const neighbors=graph.bonds.filter(([a,b])=>a===anchorId||b===anchorId).map(([a,b])=>graph.atoms[(a===anchorId?b:a)-1]!);
        dx=anchor.x-neighbors.reduce((sum,item)=>sum+item.x/neighbors.length,0);dy=anchor.y-neighbors.reduce((sum,item)=>sum+item.y/neighbors.length,0);magnitude=Math.hypot(dx,dy);}
      if(magnitude){x=anchor.x+dx/magnitude;y=anchor.y+dy/magnitude;}
    }else{x=id*0.3;y=-1;}
    graph.atoms.push({ id, element, x, y });
    return id;
  };
  const parentIds = template.graph.atoms.map((item,index)=>{
    const id=atom("C");Object.assign(graph.atoms[id-1]!,coreLayout[index]!);return id;
  });
  for (const [a, b, order] of template.graph.bonds) graph.bonds.push([parentIds[a]!, parentIds[b]!, order as 1 | 2 | 3]);
  graph.rings = template.rings.map((ring, i) => ({ id: i + 1, kind: "aromatic", atomIds: ring.map(id => parentIds[id]!) }));
  const idByLocant = new Map(template.locants.map((locant, index) => [locant, parentIds[index]!]));
  const components: NameComponent[] = [];
  const addComponent = (component: NameComponent) => components.push(component);
  const allCoreBonds = graph.bonds.map(([a, b]) => [a, b] as [number, number]);
  const parentText = normalized.slice(parentStart);
  const suffixLocants = hydroxyLocant === undefined ? [] : [hydroxyLocant];
  const selectedLocants = [...suffixLocants, ...prefixes.flatMap(item => item.locants)];
  addComponent({ id: "parent", role: "parent", text: parentText, start: parentStart, end: normalized.length,
    atomIds: parentIds, bondIds: allCoreBonds, numbering: parentIds.map((id, i) => [id, template.locants[i]!] as [number, number | string]),
    explanation: parentId === "anthracene"
      ? "Anthracene is the retained linear tricyclic parent: the three six-membered aromatic rings form one continuous edge-fused framework. Its traditional peripheral numbering is retained."
      : "Phenanthrene is the retained angular tricyclic parent: the three six-membered aromatic rings form one continuous edge-fused framework with a bend in the fused arrangement. Its traditional peripheral numbering is retained.",
    explanationEs: parentId === "anthracene"
      ? "El antraceno es el padre tricíclico lineal retenido: los tres anillos aromáticos de seis miembros forman un único esqueleto continuo fusionado por enlaces. Se conserva su numeración periférica tradicional."
      : "El fenantreno es el padre tricíclico angular retenido: los tres anillos aromáticos de seis miembros forman un único esqueleto continuo fusionado por enlaces, con una disposición acodada. Se conserva su numeración periférica tradicional.",
    numberingScope: "parent" });

  for (let i = 0; i < graph.rings!.length; i++) {
    const ring = graph.rings![i]!;
    addComponent({ id: `fused-ring:${i + 1}`, role: "parent", text: parentText, start: parentStart, end: normalized.length,
      atomIds: ring.atomIds, bondIds: graph.bonds.filter(([a, b]) => ring.atomIds.includes(a) && ring.atomIds.includes(b)).map(([a, b]) => [a, b]),
      label: `Six-membered ring ${i + 1}`, labelEs: `Anillo de seis miembros ${i + 1}`,
      numbering: ring.atomIds.map(id => [id, template.locants[parentIds.indexOf(id)]!] as [number, number | string]),
      explanation: `Six-membered aromatic ring ${i + 1} is part of the fused parent; shared atoms and the common edge are represented only once in the molecular graph.`,
      explanationEs: `El anillo aromático de seis miembros ${i + 1} pertenece al padre fusionado; los átomos y el enlace compartidos aparecen una sola vez en el grafo molecular.`, numberingScope: "parent" });
  }
  const fusionEdges = new Set<string>();
  for (let i = 0; i < graph.rings!.length; i++) for (let j = i + 1; j < graph.rings!.length; j++) {
    const shared = graph.rings![i]!.atomIds.filter(id => graph.rings![j]!.atomIds.includes(id));
    if (shared.length === 2) {
      const edge = graph.bonds.find(([a, b]) => shared.includes(a) && shared.includes(b));
      if (edge) fusionEdges.add(`${Math.min(edge[0], edge[1])}:${Math.max(edge[0], edge[1])}`);
    }
  }
  addComponent({ id: "fusion-bonds", role: "parent", text: parentText, start: parentStart, end: normalized.length,
    atomIds: [...new Set([...fusionEdges].flatMap(edge => edge.split(":").map(Number)))],
    bondIds: [...fusionEdges].map(edge => edge.split(":").map(Number) as [number, number]), numbering: [],
    label: "Shared fusion bonds", labelEs: "Enlaces de fusión compartidos",
    explanation: "Each fusion bond joins two six-membered rings and is shared by them; it is not duplicated in the parent skeleton.",
    explanationEs: "Cada enlace de fusión une dos anillos de seis miembros y es compartido por ambos; no se duplica en el esqueleto padre." });
  const fusionAtomIds = template.locants.flatMap((locant, i) => /[a-z]/i.test(locant) ? [parentIds[i]!] : []);
  addComponent({ id: "fusion-atoms", role: "parent", text: parentText, start: parentStart, end: normalized.length,
    atomIds: fusionAtomIds, bondIds: [], numbering: fusionAtomIds.map(id => [id, template.locants[parentIds.indexOf(id)]!] as [number, number | string]),
    label: "Fusion atoms", labelEs: "Átomos de fusión",
    explanation: "Lettered locants identify fusion atoms in the traditional numbering; those atoms remain part of the shared fused framework.",
    explanationEs: "Los localizadores con letra identifican átomos de fusión en la numeración tradicional; esos átomos siguen formando parte del esqueleto compartido." });

  for (const [prefixIndex, prefix] of prefixes.entries()) {
    const token = normalized.slice(prefix.start, prefix.end);
    const branchIds: number[] = [];
    for (const locant of prefix.locants) {
      const anchor = idByLocant.get(String(locant));
      if (!anchor) return null;
      const element = prefix.en === "bromo" ? "Br" : prefix.en === "chloro" ? "Cl" : "C";
      const branch = atom(element,anchor);
      branchIds.push(branch);
      graph.bonds.push([anchor, branch, 1]);
      addComponent({ id: `substituent:${prefix.en}:${locant}`, role: "substituent", text: token,
        start: prefix.start, end: prefix.end, parentId: "parent", locant, atomIds: [branch], bondIds: [[anchor, branch]],
        numbering: [[anchor, locant]], explanation: `${prefix.en} is attached to parent atom ${locant}; the locant belongs to the retained fused parent.`,
        explanationEs: `${prefix.es} está unido al átomo ${locant} del padre; el localizador pertenece al padre fusionado.`, numberingScope: "parent" });
    }
    addComponent({ id: `prefix-group:${prefixIndex}`, role: "prefix", text: token, start: prefix.start, end: prefix.end,
      atomIds: branchIds, bondIds: graph.bonds.filter(([a, b]) => branchIds.includes(a) && branchIds.includes(b)).map(([a, b]) => [a, b]),
      numbering: prefix.locants.map(locant => [idByLocant.get(String(locant))!, locant]),
      explanation: `${prefix.locants.length > 1 ? "The multiplier counts distinct substituent groups" : "The prefix identifies a substituent"} at parent locant${prefix.locants.length > 1 ? "s" : ""} ${prefix.locants.join(", ")}.`,
      explanationEs: `${prefix.locants.length > 1 ? "El multiplicador cuenta grupos sustituyentes distintos" : "El prefijo identifica un sustituyente"} en los localizadores ${prefix.locants.join(" y ")}.`,
      parentId: "parent", numberingScope: "parent", citationKey: prefix.en });
  }
  if (hydroxyLocant !== undefined) {
    const anchor = idByLocant.get(String(hydroxyLocant))!, oxygen = atom("O",anchor);
    graph.bonds.push([anchor, oxygen, 1]);
    const suffixStart = normalized.lastIndexOf("ol");
    addComponent({ id: "hydroxy-suffix", role: "suffix", text: "ol", start: suffixStart, end: suffixStart + 2,
      atomIds: [anchor, oxygen], bondIds: [[anchor, oxygen]], parentId: "parent", locant: hydroxyLocant,
      numbering: [[anchor, hydroxyLocant]], explanation: `The hydroxy group at parent locant ${hydroxyLocant} is expressed by the alcohol suffix.`,
      explanationEs: `El grupo hidroxi del localizador ${hydroxyLocant} del padre se expresa mediante el sufijo de alcohol.`, numberingScope: "parent" });
  }

  const canonicalName = nameRetainedFused1979({ atoms: graph.atoms, bonds: graph.bonds });
  if (canonicalName.status !== "SUPPORTED" || canonicalName.parentId !== parentId
    || canonicalName[language === "en" ? "nameEn" : "nameEs"] !== normalized) return null;

  return { graph, components, parent: parentIds, group: hydroxyLocant === undefined ? "none" : "alcohol", allowEquivalentNumbering: true,
    evidence: { source: "active-name", profile: "current", language, construction: "fused-tricyclic-arene", parentSelection: "aromatic-parent",
      rules: [blueBookRule("P-25.3.3", "P2"), blueBookRule("P-25.3.3.1", "P2"), blueBookRule("P-14.4", "P1"), blueBookRule("A-21.1(12–13); A-22.5", "P4")],
      numbering: { scope: "parent", priorities: ["traditional-retained-fused-numbering", "principal-suffix-locants", "prefix-locants"], selected: selectedLocants.map(locant => [locant]), reflected: [], comparison: 0 },
      stereo: "unspecified-only" } };
}
