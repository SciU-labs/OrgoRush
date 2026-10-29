import type { FunctionalReasoningAnalysis } from "./reasoning-functional-groups";
import type { ReasoningNameEvidence, ReasoningNameFragment } from "./reasoning-name-fragments";

export type ReasoningVisualGraph = {
  atoms: readonly { id: number; element?: string }[];
  bonds: readonly (readonly [number, number, ...unknown[]])[];
};
export type ReasoningVisualTarget = {
  stepNumber: string;
  /** Absent for a numbered-step selection; identifies one prominent fragment. */
  fragmentId?: string;
  atomIds: readonly number[];
  bondIds: readonly (readonly [number, number])[];
  locants: readonly (readonly [number, number | string])[];
};
type VisualStep = {
  number: string;
  nameRole?: ReasoningNameEvidence["kind"];
  unsaturationContributions?: readonly ReasoningNameEvidence[];
  numberingComparison?: {
    criterion: "principal-function";
    selectedLocants: readonly number[];
    comparison: -1 | 0 | 1;
  };
};
const bondKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

export function reasoningFragmentId(stepNumber: string, fragment: ReasoningNameEvidence) {
  return JSON.stringify([stepNumber, fragment.kind, fragment.start ?? null, fragment.text, fragment.semanticId ?? null]);
}

type VisualInput = {
  molecule: ReasoningVisualGraph;
  analysis: FunctionalReasoningAnalysis & { retainedFused?: { status: string; locants?: ReadonlyMap<number, number | string> } };
  steps: readonly VisualStep[];
  fragments: Readonly<Record<string, ReasoningNameFragment>>;
  displayedName?: string;
  enabled: boolean;
};

function isWrittenFragment(part: ReasoningNameEvidence, name?: string) {
  if (!name || !part.text) return false;
  const start = part.start ?? name.indexOf(part.text);
  return start >= 0 && name.slice(start, start + part.text.length) === part.text
    && (part.start !== undefined || name.lastIndexOf(part.text) === start);
}

/** Project the active naming analysis and its evidence. This does no chemical analysis. */
function resolveVisualTargets({ molecule, analysis, steps, fragments, displayedName, enabled }: VisualInput,
  fragmentOnly = false): Record<string, ReasoningVisualTarget> {
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
    if (step.nameRole === "parent") {
      addRegion(fragmentOnly && fragment?.atomIds ? fragment.atomIds : analysis.mainChain);
    } else if (step.nameRole === "numbering") {
      const selected = step.numberingComparison?.selectedLocants ?? [];
      const labels = new Set(selected.map(String));
      // Selected principal-function locants are one contribution, not a gate on
      // other accepted fragments. Reverse-orientation locants are never read.
      for (const part of evidence) {
        if (part.kind !== "numbering") continue;
        if (part.atomIds?.length) {
          for (const id of part.atomIds) {
            const locant = numbering.get(id);
            if (locant === undefined || !atomIds.has(id) || !parent.has(id)) valid = false;
            else labels.add(String(locant));
          }
        } else if (part.locant !== undefined) labels.add(String(part.locant));
        else if (displayedName) {
          const written = isWrittenFragment(part, displayedName);
          // Parse only the complete verified locant fragment, never explanatory prose.
          const values = part.text.split(",");
          if (written && values.every(value => [...numbering.values()].some(locant => String(locant) === value))) {
            for (const value of values) labels.add(value);
          }
        }
      }
      for (const label of labels) {
        const matches = [...numbering].filter(([id, locant]) => String(locant) === label && parent.has(id)
          && molecule.atoms.some(atom => atom.id === id && (atom.element ?? "C") === "C"));
        if (matches.length !== 1) valid = false;
        else addAtoms([matches[0][0]]);
      }
    } else if (step.nameRole === "substituent") {
      // The existing step describes this analyzed set, including each real attachment.
      for (const substituent of fragmentOnly ? [] : analysis.substituents) {
        if (!substituent.atomIds?.length) { valid = false; continue; }
        addRegion(substituent.atomIds, true);
      }
      // Some supported N-substituents live in functional provenance rather than
      // analysis.substituents. Their existing evidence includes the nitrogen.
      for (const part of evidence.filter(part => part.kind === "substituent")) {
        if (part.atomIds?.length && (!fragmentOnly || !part.contributions?.length)) {
          addRegion(part.atomIds);
          if (fragmentOnly) for (const substituent of analysis.substituents) {
            if (substituent.atomIds?.length && substituent.atomIds.every(id => part.atomIds!.includes(id))) {
              addRegion(substituent.atomIds, true);
            }
          }
        }
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

/** Existing step API, backed by the same projector as fragment selections. */
export function buildReasoningVisualTargets(input: VisualInput) {
  return buildReasoningVisualReferences(input).steps;
}

/** Project literal, typed evidence into the existing atom/bond highlight contract.
 * Only dedicated verified locant fragments use the accepted numbering map;
 * numbers in explanations, descriptors and substituent names are never parsed. */
export function buildReasoningVisualReferences(input: VisualInput): {
  steps: Record<string, ReasoningVisualTarget>;
  fragments: Record<string, ReasoningVisualTarget>;
} {
  const steps = resolveVisualTargets(input);
  const fragments: Record<string, ReasoningVisualTarget> = {};
  if (!input.enabled) return { steps, fragments };
  const allEvidence = Object.values(input.fragments).flatMap(part => [part, ...(part.additionalFragments ?? [])]);
  for (const step of input.steps) {
    const evidence = input.fragments[step.number];
    if (!step.nameRole || !evidence) continue;
    const numberedFragments: ReasoningVisualTarget[] = [];
    for (const part of [evidence, ...(evidence.additionalFragments ?? [])]) {
      if (!isWrittenFragment(part, input.displayedName)) continue;
      let projected: ReasoningNameEvidence = part;
      if (step.nameRole === "numbering" && part.kind !== "numbering") {
        // Older numbering cards contain a whole unsaturation morpheme. Borrow
        // its typed bond provenance to identify parent locants, not its digits.
        if (part.kind !== "unsaturation") continue;
        const start = part.start ?? input.displayedName!.indexOf(part.text);
        const matching = allEvidence.filter(item => item.kind === "unsaturation" && item.locant !== undefined
          && item.atomIds?.length && isWrittenFragment(item, input.displayedName)
          && (item.start ?? input.displayedName!.indexOf(item.text)) >= start
          && (item.start ?? input.displayedName!.indexOf(item.text)) + item.text.length <= start + part.text.length);
        const ids = matching.flatMap(item => [...input.analysis.numberedAtoms]
          .filter(([, locant]) => locant === item.locant).map(([id]) => id));
        if (!ids.length) continue;
        projected = { ...part, kind: "numbering", atomIds: ids, bondIds: undefined, contributions: undefined };
      }
      const projectedTarget = resolveVisualTargets({ ...input,
        steps: [{ ...step, nameRole: step.nameRole === "numbering" ? "numbering" : part.kind,
          numberingComparison: undefined, unsaturationContributions: undefined }],
        fragments: { [step.number]: { ...projected, additionalFragments: undefined } },
      }, true)[step.number];
      // A single broad fragment can name the same analyzed region as its step
      // (older substituent cards). Never use this fallback for stale explicit
      // references, multiple distinct fragments, or granular numbering.
      const sharedStepTarget = step.nameRole !== "numbering" && part.kind === step.nameRole
        && !part.atomIds && !part.bondIds && !part.contributions?.length
        && [evidence, ...(evidence.additionalFragments ?? [])].filter(item => item.kind === part.kind).length === 1
        ? steps[step.number] : undefined;
      const target = projectedTarget ?? sharedStepTarget;
      if (!target) continue;
      const fragmentId = reasoningFragmentId(step.number, part);
      fragments[fragmentId] = { ...target, fragmentId };
      if (step.nameRole === "numbering") numberedFragments.push(target);
    }
    if (step.nameRole === "numbering" && numberedFragments.length
      && (!step.numberingComparison?.selectedLocants.length || steps[step.number])) {
      // The section button is exactly the union of accepted fragment targets.
      const atomIds = [...new Set(numberedFragments.flatMap(target => [...target.atomIds]))];
      steps[step.number] = { stepNumber: step.number, atomIds, bondIds: [],
        locants: [...new Map(numberedFragments.flatMap(target => [...target.locants]))] };
    }
  }
  return { steps, fragments };
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
