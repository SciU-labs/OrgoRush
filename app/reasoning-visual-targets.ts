import type { FunctionalReasoningAnalysis } from "./reasoning-functional-groups";
import type { ReasoningNameEvidence, ReasoningNameFragment } from "./reasoning-name-fragments";

export type ReasoningVisualGraph = {
  atoms: readonly { id: number }[];
  bonds: readonly (readonly [number, number, ...unknown[]])[];
};
export type ReasoningVisualTarget = {
  stepNumber: string;
  atomIds: readonly number[];
  bondIds: readonly (readonly [number, number])[];
  locants: readonly (readonly [number, number | string])[];
};
type VisualStep = {
  number: string;
  nameRole?: ReasoningNameEvidence["kind"];
  unsaturationContributions?: readonly ReasoningNameEvidence[];
};
const bondKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

/** Project the active naming analysis and its evidence. This does no chemical analysis. */
export function buildReasoningVisualTargets({ molecule, analysis, steps, fragments, enabled }: {
  molecule: ReasoningVisualGraph;
  analysis: FunctionalReasoningAnalysis & { retainedFused?: { status: string; locants?: ReadonlyMap<number, number | string> } };
  steps: readonly VisualStep[];
  fragments: Readonly<Record<string, ReasoningNameFragment>>;
  enabled: boolean;
}): Record<string, ReasoningVisualTarget> {
  const targets: Record<string, ReasoningVisualTarget> = {};
  if (!enabled) return targets;
  const atomIds = new Set(molecule.atoms.map(atom => atom.id));
  const bonds = new Map(molecule.bonds.map(([a, b]) => [bondKey(a, b), [a, b] as const]));
  const parent = new Set(analysis.mainChain);
  const numbering = analysis.retainedFused?.status === "SUPPORTED"
    ? analysis.retainedFused.locants ?? analysis.numberedAtoms : analysis.numberedAtoms;
  for (const step of steps) {
    if (!step.nameRole) continue;
    const atoms = new Set<number>();
    const selectedBonds = new Map<string, readonly [number, number]>();
    let valid = true;
    const addAtoms = (ids: readonly number[]) => {
      for (const id of ids) { if (!atomIds.has(id)) valid = false; atoms.add(id); }
    };
    const addBond = (a: number, b: number) => {
      if (!bonds.has(bondKey(a, b))) valid = false;
      addAtoms([a, b]); selectedBonds.set(bondKey(a, b), [a, b]);
    };
    const addRegion = (ids: readonly number[], includeAttachment = false) => {
      addAtoms(ids);
      const region = new Set(ids);
      for (const [a, b] of molecule.bonds) {
        if (region.has(a) && region.has(b)
          || includeAttachment && (region.has(a) && !parent.has(a) && parent.has(b)
            || region.has(b) && !parent.has(b) && parent.has(a))) addBond(a, b);
      }
    };
    const fragment = fragments[step.number];
    const evidence = fragment ? [fragment, ...(fragment.additionalFragments ?? [])] : [];
    if (step.nameRole === "parent" || step.nameRole === "numbering") {
      addRegion(analysis.mainChain);
    } else if (step.nameRole === "substituent") {
      // The existing step describes this analyzed set, including each real attachment.
      for (const substituent of analysis.substituents) {
        if (!substituent.atomIds?.length) { valid = false; continue; }
        addRegion(substituent.atomIds, true);
      }
      // Some supported N-substituents live in functional provenance rather than
      // analysis.substituents. Their existing evidence includes the nitrogen.
      for (const part of evidence.filter(part => part.kind === "substituent")) {
        if (part.atomIds?.length) addRegion(part.atomIds);
        for (const contribution of part.contributions ?? []) addRegion(contribution.atomIds);
        for (const [a, b] of part.bondIds ?? []) addBond(a, b);
      }
    } else {
      for (const part of [...evidence, ...(step.unsaturationContributions ?? [])]) {
        if (part.kind !== step.nameRole) continue;
        if (part.contributions?.length) {
          for (const contribution of part.contributions) addRegion(contribution.atomIds);
        } else if (part.atomIds?.length) {
          // Multiple-bond and stereochemical evidence already identifies exact edges.
          if (part.bondIds?.length) addAtoms(part.atomIds);
          else addRegion(part.atomIds);
        }
        for (const [a, b] of part.bondIds ?? []) {
          addBond(a, b);
          if (part.bondType) {
            const actual = molecule.bonds.find(([x, y]) => bondKey(x, y) === bondKey(a, b));
            if ((actual?.[2] ?? 1) !== (part.bondType === "double" ? 2 : 3)) valid = false;
          }
        }
      }
    }
    const locants = step.nameRole === "numbering"
      ? [...numbering].filter(([id]) => atoms.has(id)) : [];
    if (step.nameRole === "numbering" && locants.length !== atoms.size) valid = false;
    // Reject incomplete/stale evidence as a whole, never silently highlight another region.
    if (valid && atoms.size) targets[step.number] = {
      stepNumber: step.number, atomIds: [...atoms], bondIds: [...selectedBonds.values()], locants,
    };
  }
  return targets;
}

export const REASONING_VISUAL_DURATION_MS = 2000;

/** One timer shared by all step buttons; the most recent activation owns its expiry. */
export function createReasoningVisualController(onChange: (target: ReasoningVisualTarget | null) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const dispose = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  return {
    activate(target: ReasoningVisualTarget) {
      dispose();
      onChange(target);
      timer = setTimeout(() => { timer = null; onChange(null); }, REASONING_VISUAL_DURATION_MS);
    },
    clear() { dispose(); onChange(null); },
    dispose,
  };
}
