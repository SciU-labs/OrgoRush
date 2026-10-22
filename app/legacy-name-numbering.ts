import type { LegacyEnglishNameModel } from "./legacy-english-nomenclature.ts";

/** A-2.3/C-16.31: a component has no external multiplicative prefix yet.
 * Internal multipliers of a complex radical therefore remain in its key. */
export function historicalPrefixKey(component: string) {
  return component.toLowerCase().replace(/^(?:sec|tert)-?/, "")
    .replace(/[\d,()\-]/g, "");
}
export function compareHistoricalLocants(a: readonly number[], b: readonly number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? Infinity) - (b[i] ?? Infinity);
    if (difference) return difference;
  }
  return 0;
}
const priority: Record<string, number> = { carboxylicAcid: 100, sulfonicAcid: 90, ester: 80,
  amide: 75, nitrile: 70, aldehyde: 60, ketone: 50, alcohol: 40, amine: 30 };

/** Enumerates the dihedral symmetries of the *ordered parent cycle*.
 * Atom identities move with their attached groups; digits are never swapped
 * in a rendered name. Fixed retained/polycyclic numbering is deliberately excluded. */
export function numberLegacyBenzene(model: LegacyEnglishNameModel, term: (name: string) => string) {
  if (model.parent.kind !== "aromatic" || model.parent.carbonCount !== 6
    || model.parent.atomIds.length !== 6 || model.parent.fallbackName
    || model.doubleBondLocants.length || model.tripleBondLocants.length
    || model.stereochemicalPrefix) return model;
  const principal = [...model.functionalGroups].filter(g => priority[g.kind])
    .sort((a, b) => priority[b.kind] - priority[a.kind])[0]?.kind;
  // Already-canonical bare/monosubstituted parents have no alphabetic tie.
  // Avoid enumerating twelve identical choices in repeated exercise calls.
  if(!principal&&(!model.substituents.length
    ||model.substituents.length===1&&model.substituents[0].locant===1))return model;
  if(!model.substituents.length&&model.functionalGroups.length===1
    &&model.functionalGroups[0].locant===1)return model;
  const candidates: LegacyEnglishNameModel[] = [];
  for (const direction of [1, -1]) for (let start = 0; start < 6; start++) {
    const indices = Array.from({ length: 6 }, (_, i) => (start + direction * i + 12) % 6);
    const locant = (old: number) => indices.indexOf(old - 1) + 1;
    candidates.push({ ...model, parent: { ...model.parent, atomIds: indices.map(i => model.parent.atomIds[i]) },
      functionalGroups: model.functionalGroups.map(g => ({ ...g, locant: locant(g.locant) })),
      substituents: model.substituents.map(s => ({ ...s, locant: locant(s.locant) })) });
  }
  const principalLocants = (m: LegacyEnglishNameModel) => m.functionalGroups
    .filter(g => g.kind === principal).map(g => g.locant).sort((a,b) => a-b);
  const prefixLocants = (m: LegacyEnglishNameModel) => m.substituents.map(s => s.locant).sort((a,b) => a-b);
  const keys = [...new Set(model.substituents.map(s => historicalPrefixKey(term(s.systematicName))))].sort();
  const cited = (m: LegacyEnglishNameModel, key: string) => m.substituents
    .filter(s => historicalPrefixKey(term(s.systematicName)) === key).map(s => s.locant).sort((a,b) => a-b);
  return candidates.sort((a,b) => compareHistoricalLocants(principalLocants(a), principalLocants(b))
    || compareHistoricalLocants(prefixLocants(a), prefixLocants(b))
    || keys.reduce((comparison, key) => comparison || compareHistoricalLocants(cited(a,key), cited(b,key)), 0))[0];
}
