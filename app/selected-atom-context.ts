import type { AppLanguage } from "./i18n.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";

export type SelectedAtomContext = { heading: string; explanation: string };

/** Describes only a graph-verified benzoic-acid carbonyl outside the numbered ring. */
export function selectedAromaticCarboxylCarbonContext(input: {
  molecule: GeneratedMolecule;
  derivation: ValidatedNameDerivation | null | undefined;
  selectedAtomId: number | null;
  language: AppLanguage;
  visualNumbering: ReadonlyMap<number, number | string>;
}): SelectedAtomContext | null {
  const { molecule, derivation, selectedAtomId, language, visualNumbering } = input;
  if (selectedAtomId === null || derivation?.status !== "FULL" || derivation.principalGroup !== "carboxylicAcid") return null;
  const parent = derivation.components.find(component => component.id === "parent" && component.role === "parent");
  const suffix = derivation.components.find(component => component.id === "suffix" && component.role === "suffix");
  if (!parent || !suffix || !molecule.rings?.length) return null;

  const parentAtoms = new Set(parent.atomIds), suffixAtoms = new Set(suffix.atomIds);
  const atoms = new Map(molecule.atoms.map(atom => [atom.id, atom]));
  const aromaticRings = molecule.rings.filter(ring => ring.kind === "aromatic" && ring.atomIds.length === 6
    && new Set(ring.atomIds).size === 6
    && ring.atomIds.every(id => parentAtoms.has(id) && (atoms.get(id)?.element ?? "C") === "C"));
  if (aromaticRings.length !== 1) return null;
  const ringIds = new Set(aromaticRings[0].atomIds);
  const explicitC1=parent.numbering.find(([id,locant])=>locant===1&&ringIds.has(id))?.[0];
  if (explicitC1===undefined || visualNumbering.get(explicitC1)!==1) return null;

  const ringEdges = molecule.bonds.filter(([a,b]) => ringIds.has(a) && ringIds.has(b));
  const ringDegree = new Map<number,number>([...ringIds].map(id => [id,0]));
  for (const [a,b] of ringEdges) {
    ringDegree.set(a,(ringDegree.get(a) ?? 0)+1);
    ringDegree.set(b,(ringDegree.get(b) ?? 0)+1);
  }
  if (ringEdges.length !== 6 || [...ringDegree.values()].some(degree => degree !== 2)) return null;
  const connected = new Set<number>(), pending = [explicitC1];
  while (pending.length) {
    const id=pending.pop()!;
    if (connected.has(id)) continue;
    connected.add(id);
    for (const [a,b] of ringEdges) {
      if (a===id && !connected.has(b)) pending.push(b);
      if (b===id && !connected.has(a)) pending.push(a);
    }
  }
  // An unsubstituted benzoic-acid ring can have only explicit C1 evidence;
  // do not invent the remaining labels just to explain its outside carbonyl.
  if (connected.size !== 6) return null;

  const neighbors = new Map<number, Array<{ id: number; order: number }>>();
  for (const [a,b,order = 1] of molecule.bonds) {
    neighbors.set(a, [...(neighbors.get(a) ?? []), { id: b, order }]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), { id: a, order }]);
  }
  const carboxylCarbons = parent.atomIds.filter(id => suffixAtoms.has(id)
    && !ringIds.has(id) && atoms.get(id)?.element === "C")
    .filter(id => {
      const bonded = neighbors.get(id) ?? [];
      const oxygens = bonded.filter(neighbor => suffixAtoms.has(neighbor.id) && atoms.get(neighbor.id)?.element === "O");
      const ringAttachments = bonded.filter(neighbor => ringIds.has(neighbor.id));
      return bonded.length === 3 && oxygens.length === 2
        && oxygens.filter(neighbor => neighbor.order === 2).length === 1
        && oxygens.filter(neighbor => neighbor.order === 1).length === 1
        && ringAttachments.length === 1;
    });
  if (carboxylCarbons.length !== 1 || carboxylCarbons[0] !== selectedAtomId) return null;

  return language === "en"
    ? { heading: "Carboxyl carbon:", explanation: "belongs to the principal functional group (–COOH), but is not part of the aromatic ring's C1–C6 numbering." }
    : { heading: "Carbono carboxílico:", explanation: "forma parte del grupo funcional principal (–COOH), pero no de la numeración C1–C6 del anillo aromático." };
}
