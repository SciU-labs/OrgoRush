import type { PedagogicalDecision } from "./pedagogical-decision-model.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedNameDerivation } from "./validated-name-derivation.ts";

/** The family has already chosen and oriented the parent. Join its locants to
 * the independently mapped group bonds. Internal branch locants never enter
 * this map. Adjacent parent atoms explain how to find the site on the graph. */
export function numberedAttachmentDecisions(input: {
  graph: GeneratedMolecule; derivation: ValidatedNameDerivation; parent: NameComponent;
  components: readonly NameComponent[]; family: string; numberingDecisionId: string;
  writtenFragment?: string;
}): PedagogicalDecision[] {
  const { graph, parent, derivation, family } = input;
  if (derivation.status !== "FULL") return [];
  const atoms = new Map(graph.atoms.map(atom => [atom.id, atom]));
  const locants = new Map(parent.numbering);
  const parentAtoms = new Set(parent.atomIds);
  if (locants.size !== parentAtoms.size || [...parentAtoms].some(id => !locants.has(id) || !atoms.has(id))
    || new Set([...locants.values()].map(String)).size !== locants.size) return [];
  const label = (id: number) => (atoms.get(id)!.element ?? "C") + String(locants.get(id));
  const decisions = new Map<string, PedagogicalDecision>();
  for (const group of input.components) {
    for (const [a, b] of group.bondIds) {
      if (parentAtoms.has(a) === parentAtoms.has(b)) continue;
      const [site, external] = parentAtoms.has(a) ? [a, b] : [b, a];
      const pos = locants.get(site)!;
      if (!atoms.has(external) || !group.atomIds.includes(external)
        || !group.numbering.some(([id, n]) => id === site && String(n) === String(pos))) continue;
      const bond = graph.bonds.find(([x, y]) => x === site && y === external || y === site && x === external);
      if (!bond) continue;
      const neighbors = graph.bonds.flatMap(([x, y]) => x === site && parentAtoms.has(y) ? [y] : y === site && parentAtoms.has(x) ? [x] : [])
        .sort((x, y) => String(locants.get(x)).localeCompare(String(locants.get(y)), "en", { numeric: true }));
      if (!neighbors.length) continue;
      const fragment = input.writtenFragment ?? (derivation.name.slice(group.start, group.end) === group.text ? group.text : "");
      const edge = site + ":" + external;
      if (decisions.has(edge)) {
        const decision = decisions.get(edge)!;
        if (fragment && !decision.nameFragments.includes(fragment)) decision.nameFragments.push(fragment);
        continue;
      }
      const siteLabel = label(site);
      const link = siteLabel + (bond[2] === 2 ? "=" : bond[2] === 3 ? "≡" : "–") + (atoms.get(external)!.element ?? "C");
      const adjacent = neighbors.map(label);
      decisions.set(edge, {
        id: `${family}.attachment.${siteLabel}.${group.id}`, kind: "attachment-locants", family,
        rule: "locant-of-numbered-parent-end-of-attachment", evidenceSource: "reconciled parent numbering and mapped component bond",
        atomIds: [site, external, ...neighbors], bondIds: [[site, external], ...neighbors.map(id => [site, id] as [number, number])],
        locants: [pos], result: link,
        explanation: {
          en: `The ${link} bond places the group at ${pos}. On the parent, ${siteLabel} is bonded to ${new Intl.ListFormat("en").format(adjacent)}.`,
          es: `El enlace ${link} sitúa el grupo en ${pos}. En el padre, ${siteLabel} está unido a ${new Intl.ListFormat("es").format(adjacent)}.`,
        },
        nameFragments: fragment ? [fragment] : [], dependsOn: [input.numberingDecisionId], verification: "verified",
      });
    }
  }
  return [...decisions.values()].sort((a, b) => String(a.locants[0]).localeCompare(String(b.locants[0]), "en", { numeric: true }));
}

/** Relate a written locant in an aryl branch to its own ring and to the
 * separately mapped parent attachment. No choice of ring orientation here. */
export function nestedAromaticAttachmentDecisions(graph: GeneratedMolecule, derivation: ValidatedNameDerivation) {
  const results: { componentId: string; decision: PedagogicalDecision }[] = [];
  const parent = derivation.components.find(c => c.id === "parent");
  if (derivation.status !== "FULL" || !parent) return results;
  const numberedParent = new Map(parent.numbering);
  const amide = derivation.principalGroup === "amide" && derivation.components.find(c => c.role === "suffix");
  for (const child of derivation.components) {
    if (!child.parentId || typeof child.locant !== "number") continue;
    const owner = derivation.components.find(c => c.id === child.parentId && c.role === "substituent" && c.parentId === parent.id);
    if (!owner || owner.locant === undefined) continue;
    const ring = graph.rings?.filter(r => r.kind === "aromatic" && r.atomIds.length === 6 && r.atomIds.every(id => owner.atomIds.includes(id)));
    if (ring?.length !== 1) continue;
    const ids = new Set(ring[0]!.atomIds);
    const internal = owner.writtenLocants?.find(w => w.locant === child.locant && ids.has(w.atomId))?.atomId
      ?? owner.numbering.find(([id,n]) => n === child.locant && ids.has(id))?.[0];
    if (internal === undefined) continue;
    const innerBond = child.bondIds.find(([a,b]) => a === internal && child.atomIds.includes(b) && !ids.has(b)
      || b === internal && child.atomIds.includes(a) && !ids.has(a));
    if (!innerBond) continue;
    const outerAtom = owner.locant === "N" && amide
      ? graph.atoms.find(a => a.element === "N" && amide.atomIds.includes(a.id))?.id
      : parent.numbering.find(([,n]) => n === owner.locant)?.[0];
    if (outerAtom === undefined) continue;
    const outerBond = (owner.attachmentBonds ?? owner.bondIds).find(([a,b]) =>
      a === outerAtom && owner.atomIds.includes(b) || b === outerAtom && owner.atomIds.includes(a));
    if (!outerBond) continue;
    const link = outerBond[0] === outerAtom ? outerBond[1] : outerBond[0];
    const bridge = ids.has(link) ? undefined : owner.bondIds.find(([a,b]) => a === link && ids.has(b) || b === link && ids.has(a));
    if (!ids.has(link) && !bridge) continue;
    const bonds = [outerBond, ...bridge ? [bridge] : [], innerBond];
    if (bonds.some(([a,b]) => !graph.bonds.some(([x,y]) => a===x && b===y || a===y && b===x))) continue;
    const outer = owner.locant === "N" ? "N" : "C" + numberedParent.get(outerAtom);
    const groupText = derivation.name.slice(child.start, child.end);
    if (!groupText || groupText !== child.text) continue;
    const bracket = owner.text.includes("[") && owner.text.includes("]");
    const parens = derivation.name[owner.start-1] === "(" && derivation.name[owner.end] === ")";
    const enclosure = bracket ? ["square brackets", "corchetes"] : parens ? ["parentheses", "paréntesis"] : null;
    const path = bridge ? `${outer}–${graph.atoms.find(a=>a.id===link)?.element ?? "C"}–C1` : `${outer}–C1`;
    results.push({componentId: child.id, decision: {
      id: `branch.${owner.id}.${child.id}.attachment`, family: "aryl-substituent", kind: "attachment-locants",
      rule: "locants-of-enclosing-aromatic-substituent", evidenceSource: "reconciled nested components, aromatic cycle and attachment bonds",
      numberingScope: owner.id, locants: [child.locant], atomIds: [...new Set(bonds.flat())], bondIds: bonds,
      result: path, nameFragments: [groupText, owner.text], dependsOn: [], verification: "verified",
      explanation: {
        en: `Follow ${path} from the parent to position 1 of the branch ring. The locant ${child.locant} in “${owner.text}” places “${groupText}” on that ring.${enclosure ? ` The ${enclosure[0]} enclose the substituted branch attached at ${outer}.` : ""}`,
        es: `Sigue ${path} desde el padre hasta la posición 1 del anillo de la rama. El localizador ${child.locant} en «${owner.text}» sitúa «${groupText}» en ese anillo.${enclosure ? ` Los ${enclosure[1]} delimitan la rama sustituida unida a ${outer}.` : ""}`,
      },
    }});
  }
  return results;
}
