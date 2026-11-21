import type { AppLanguage } from "./i18n.ts";

type ParentSelectionAnalysis = {
  family: string;
  mainChain: readonly number[];
  chainName: string;
  primaryFunctionalGroup?: string;
  functionalGroups: readonly { id?: string; kind: string; carbonId: number; carbonIds?: readonly number[]; atomIds?: readonly number[]; heteroAtomId?: number }[];
  numberedAtoms: ReadonlyMap<number, number>;
  parentSelectionTrace?: {
    profile: "blue-book-2013" | "iupac-1979-legacy";
    evaluatedCandidateCount: number;
    candidates: readonly {
      atomIds: readonly number[];
      bondIds: readonly (readonly [number, number])[];
      selected: boolean;
      decisiveCriterion?: string;
      ruleReference?: string;
    }[];
  };
};

type ParentSelectionMolecule = {
  atoms: readonly { id: number; element?: string; charge?: number }[];
  rings?: readonly { kind: string; atomIds: readonly number[] }[];
  bonds: readonly (readonly [number, number, number?])[];
};

export type ParentSelectionCandidateEvidence = {
  id: string;
  label: string;
  status: "candidate" | "selected-by-rule" | "selected-by-engine" | "evaluated-alternative"
    | "name-reconciled" | "structural-region" | "not-compared";
  atomIds: readonly number[];
  bondIds: readonly (readonly [number, number])[];
  decisiveCriterion?: string;
  ruleReference?: string;
  regionKind?: "acyclic-chain" | "carbocyclic-ring" | "aromatic-ring" | "heterocycle" | "ring-system";
  principalGroupCount?: number;
  principalGroupCountStatus?: "known" | "unknown" | "not-applicable";
  principalGroupIds?: readonly string[];
  evidenceKind?: "parent" | "principal-groups" | "amine-function" | "nitrogen-atom" | "nitrogen-attachment" | "n-substituent";
  nomenclaturalAdmissibility?: "analysis-selected" | "candidate-unverified";
  currentAnalysisParent?: boolean;
};

export type ParentSelectionEvidence = {
  level: "structural" | "selection-traced" | "rule-supported" | "name-reconciled";
  reconciliation: "unverified" | "verified";
  explanation: string;
  rule?: string;
  candidates: readonly ParentSelectionCandidateEvidence[];
  evaluatedCandidateCount?: number;
  comparisonScope?: string;
  principalGroupComparison?: {
    groupKind: string;
    groupLabel: string;
    chainCount: number;
    ringCount: number;
    winner: "chain" | "ring";
    rule: string;
    sameOccurrenceIds: readonly string[];
    pinPreferenceApplied: false;
  };
  amineParentSelection?: {
    nitrogenAtomId: number;
    nitrogenDegree: 2 | 3;
    outcome: "acyclic-parent" | "cyclic-parent" | "unresolved";
    comparedRegions: number;
    rule?: string;
  };
};

const structuralId = (role: string, atomIds: readonly number[]) =>
  `parent-selection:${role}:${[...atomIds].sort((a, b) => a - b).join(",")}`;

function regionBonds(molecule: ParentSelectionMolecule, atomIds: readonly number[]) {
  const region = new Set(atomIds);
  return molecule.bonds.filter(([a, b]) => region.has(a) && region.has(b))
    .map(([a, b]) => [a, b] as const);
}

function candidate(molecule: ParentSelectionMolecule, role: string, label: string,
  status: ParentSelectionCandidateEvidence["status"], atomIds: readonly number[]): ParentSelectionCandidateEvidence {
  return { id: structuralId(role, atomIds), label, status, atomIds: [...atomIds], bondIds: regionBonds(molecule, atomIds) };
}

type ParentRegion = {
  atomIds: number[];
  kind: "acyclic-chain" | "carbocyclic-ring" | "aromatic-ring" | "heterocycle" | "ring-system";
  current: boolean;
};

const suffixGroupKinds = new Set(["carboxylicAcid", "ester", "amide", "nitrile", "aldehyde", "ketone", "alcohol", "amine"]);

function occurrenceId(group: ParentSelectionAnalysis["functionalGroups"][number]) {
  return group.id ?? `${group.kind}:${[...(group.atomIds ?? [group.carbonId])].sort((a, b) => a - b).join(",")}`;
}

function simpleIndependentRings(molecule: ParentSelectionMolecule, analysis: ParentSelectionAnalysis): ParentRegion[] {
  const rings = molecule.rings ?? [];
  const ringRegions = rings.filter(ring => ring.atomIds.length >= 3 && ring.atomIds.length <= 20
    && !rings.some(other => other !== ring && other.atomIds.some(id => ring.atomIds.includes(id))));
  return ringRegions.flatMap(ring => {
    const ids = new Set(ring.atomIds);
    const edges = molecule.bonds.filter(([a, b]) => ids.has(a) && ids.has(b));
    const degreeTwo = ring.atomIds.every(id => edges.filter(([a, b]) => a === id || b === id).length === 2);
    if (!degreeTwo || edges.length !== ring.atomIds.length) return [];
    const atomIds = [...new Set(ring.atomIds)].sort((a, b) => a - b);
    const heterocyclic = atomIds.some(id => (molecule.atoms.find(atom => atom.id === id)?.element ?? "C") !== "C");
    return [{ atomIds,
      kind: heterocyclic ? "heterocycle" as const
        : ring.kind === "aromatic" ? "aromatic-ring" as const : "carbocyclic-ring" as const,
      current: atomIds.length === analysis.mainChain.length && atomIds.every(id => analysis.mainChain.includes(id)) }];
  });
}

/** Enumerates bounded carbon-tree paths only; cyclic/fused graph regions are not
 * recast as chains. Atom-set signatures collapse a path and its reverse. */
function simpleAcyclicCarbonPaths(molecule: ParentSelectionMolecule, analysis: ParentSelectionAnalysis,
  ringRegions: readonly ParentRegion[]): number[][] {
  const cyclicIds = new Set((molecule.rings ?? []).flatMap(ring => ring.atomIds));
  const carbonIds = molecule.atoms.filter(atom => (atom.element ?? "C") === "C" && !cyclicIds.has(atom.id)).map(atom => atom.id);
  const carbonSet = new Set(carbonIds), adjacency = new Map(carbonIds.map(id => [id, [] as number[]]));
  for (const [a, b] of molecule.bonds) if (carbonSet.has(a) && carbonSet.has(b)) {
    adjacency.get(a)!.push(b); adjacency.get(b)!.push(a);
  }
  const groups = analysis.functionalGroups.filter(group => group.kind === analysis.primaryFunctionalGroup);
  const paths: number[][] = [];
  const signatures = new Set<string>();
  let visitedNodes = 0;
  for (const start of carbonIds) {
    if (adjacency.get(start)!.length > 2) continue;
    const component = new Set([start]), queue = [start];
    while (queue.length && component.size <= 48) {
      const id = queue.shift()!;
      for (const next of adjacency.get(id) ?? []) if (!component.has(next)) { component.add(next); queue.push(next); }
    }
    if (component.size > 48 || [...component].some(id => (adjacency.get(id) ?? []).filter(next => component.has(next)).length > 2)) continue;
    const edges = molecule.bonds.filter(([a, b]) => component.has(a) && component.has(b));
    if (edges.length !== component.size - 1) continue;
    const leaves = [...component].filter(id => (adjacency.get(id) ?? []).filter(next => component.has(next)).length <= 1);
    for (let left = 0; left < leaves.length; left++) for (let right = left; right < leaves.length; right++) {
      const source = leaves[left], target = leaves[right];
      const parent = new Map<number, number | undefined>([[source, undefined]]), pending = [source];
      while (pending.length && !parent.has(target)) {
        const id = pending.shift()!;
        for (const next of adjacency.get(id) ?? []) if (component.has(next) && !parent.has(next)) {
          parent.set(next, id); pending.push(next);
        }
      }
      if (!parent.has(target)) continue;
      const path: number[] = []; let at: number | undefined = target;
      while (at !== undefined) { path.push(at); at = parent.get(at); }
      const ids = path.reverse();
      if (ids.length < 2 && !groups.some(group => group.kind !== "carboxylicAcid" && group.kind !== "aldehyde"
        && (group.carbonIds?.length ? group.carbonIds : [group.carbonId]).includes(ids[0]))) continue;
      if (!groups.some(group => ids.some(id => (group.carbonIds?.length ? group.carbonIds : [group.carbonId]).includes(id)))) continue;
      const signature = [...ids].sort((a, b) => a - b).join(",");
      if (signatures.has(signature)) continue;
      signatures.add(signature); paths.push(ids);
      if (++visitedNodes >= 160) return paths;
    }
  }
  const current = [...analysis.mainChain];
  if (current.length && current.every(id => carbonSet.has(id))) {
    const signature = [...current].sort((a, b) => a - b).join(",");
    if (!signatures.has(signature)) paths.unshift(current);
  }
  return paths.slice(0, 32);
}

function groupOccursOnRegion(molecule: ParentSelectionMolecule, group: ParentSelectionAnalysis["functionalGroups"][number],
  region: ParentRegion) {
  const ids = new Set(region.atomIds);
  const groupCarbons = group.carbonIds?.length ? group.carbonIds : [group.carbonId];
  if (groupCarbons.some(id => ids.has(id))) return true;
  // Carboxylic acid and aldehyde suffixes can be expressed by a cyclic parent
  // even though the functional carbon is exocyclic (carboxylic acid/carbaldehyde).
  if ((group.kind === "carboxylicAcid" || group.kind === "aldehyde")
    && region.kind !== "acyclic-chain" && !ids.has(group.carbonId)) {
    return molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
      && (a === group.carbonId && ids.has(b) || b === group.carbonId && ids.has(a)));
  }
  return false;
}

function principalGroupCount(molecule: ParentSelectionMolecule, analysis: ParentSelectionAnalysis, region: ParentRegion) {
  if (!analysis.primaryFunctionalGroup || !suffixGroupKinds.has(analysis.primaryFunctionalGroup)) return undefined;
  const groups = analysis.functionalGroups.filter(group => group.kind === analysis.primaryFunctionalGroup);
  if (!groups.length) return undefined;
  return [...new Set(groups.filter(group => groupOccursOnRegion(molecule, group, region)).map(occurrenceId))];
}

function primaryGroupLabel(kind: string, language: AppLanguage) {
  const labels: Record<string, [string, string]> = {
    carboxylicAcid: ["carboxylic acid", "ácido carboxílico"], ester: ["ester", "éster"],
    amide: ["amide", "amida"], nitrile: ["nitrile", "nitrilo"], aldehyde: ["aldehyde", "aldehído"],
    ketone: ["ketone", "cetona"], alcohol: ["hydroxyl", "hidroxilo"], amine: ["amine", "amina"],
  };
  return labels[kind]?.[language === "en" ? 0 : 1] ?? kind;
}

function comparePrimaryGroupsAcrossChainAndRing(molecule: ParentSelectionMolecule, analysis: ParentSelectionAnalysis,
  language: AppLanguage, profile: "blue-book-2013" | "iupac-1979-legacy"): ParentSelectionEvidence | undefined {
  if (profile !== "blue-book-2013" || !analysis.primaryFunctionalGroup
    || !suffixGroupKinds.has(analysis.primaryFunctionalGroup)) return;
  const rings = simpleIndependentRings(molecule, analysis);
  if (!rings.length) return;
  const paths = simpleAcyclicCarbonPaths(molecule, analysis, rings);
  if (!paths.length) return;
  const chains: ParentRegion[] = paths.map(atomIds => ({ atomIds, kind: "acyclic-chain", current:
    atomIds.length === analysis.mainChain.length && atomIds.every(id => analysis.mainChain.includes(id)) }));
  const groupKind = analysis.primaryFunctionalGroup;
  const chainCounts = chains.map(region => ({ region, occurrences: principalGroupCount(molecule, analysis, region) }));
  const ringCounts = rings.map(region => ({ region, occurrences: principalGroupCount(molecule, analysis, region) }));
  if (chainCounts.some(item => item.occurrences === undefined) || ringCounts.some(item => item.occurrences === undefined)) return;
  const maxChain = Math.max(0, ...chainCounts.map(item => item.occurrences!.length));
  const maxRing = Math.max(0, ...ringCounts.map(item => item.occurrences!.length));
  // This comparison is meaningful only if this principal group occurs in both
  // structural families. Exclusive-location cases retain their narrower rules.
  if (maxChain === 0 || maxRing === 0) return;
  const winningFamily = maxChain > maxRing ? "chain" : maxRing > maxChain ? "ring" : "ring";
  const rule = maxChain === maxRing ? "P-44.1.1; P-59.2.1.6" : "P-44.1.1; P-59.2.1.6";
  const label = primaryGroupLabel(groupKind, language);
  const relation = maxChain === maxRing
    ? language === "en" ? `Both candidate families express ${maxChain} occurrence${maxChain === 1 ? "" : "s"} of the principal ${label} group. The count criterion is tied; P-59.2.1.6 selects a ring or ring system as parent for nomenclature. P-59.2.1.7 is PIN-specific and is not applied here because this analysis has not established PIN status.`
      : `Ambas familias candidatas expresan ${maxChain} ocurrencia${maxChain === 1 ? "" : "s"} del grupo principal (${label}). El criterio de cantidad queda empatado; P-59.2.1.6 selecciona un anillo o sistema de anillos como padre para la nomenclatura. P-59.2.1.7 es específico de PIN y no se aplica aquí porque este análisis no ha establecido que se trate de un PIN.`
    : winningFamily === "chain"
      ? language === "en" ? `The acyclic-chain candidates express up to ${maxChain} occurrence${maxChain === 1 ? "" : "s"} of the principal ${label} group, versus ${maxRing} on any simple ring candidate. The greater count favors the chain under P-44.1.1 and P-59.2.1.6.`
        : `Las cadenas acíclicas candidatas expresan hasta ${maxChain} ocurrencia${maxChain === 1 ? "" : "s"} del grupo principal (${label}), frente a ${maxRing} en cualquier anillo simple candidato. La mayor cantidad favorece a la cadena según P-44.1.1 y P-59.2.1.6.`
      : language === "en" ? `The simple-ring candidates express up to ${maxRing} occurrence${maxRing === 1 ? "" : "s"} of the principal ${label} group, versus ${maxChain} on any acyclic-chain candidate. The greater count favors the ring under P-44.1.1 and P-59.2.1.6.`
        : `Los anillos simples candidatos expresan hasta ${maxRing} ocurrencia${maxRing === 1 ? "" : "s"} del grupo principal (${label}), frente a ${maxChain} en cualquier cadena acíclica candidata. La mayor cantidad favorece al anillo según P-44.1.1 y P-59.2.1.6.`;
  const winningCount = winningFamily === "chain" ? maxChain : maxRing;
  const winners = winningFamily === "chain" ? chainCounts.filter(item => item.occurrences!.length === winningCount)
    : ringCounts.filter(item => item.occurrences!.length === winningCount);
  const losers = winningFamily === "chain" ? ringCounts : chainCounts;
  const entries: ParentSelectionCandidateEvidence[] = [];
  const occurrenceTargets = new Map<string, ParentSelectionAnalysis["functionalGroups"][number]>();
  [...chainCounts, ...ringCounts].forEach(item => item.occurrences?.forEach(id => {
    const found = analysis.functionalGroups.find(group => occurrenceId(group) === id);
    if (found) occurrenceTargets.set(id, found);
  }));
  for (const [family, collection] of [[winningFamily, winners] as const,
    [winningFamily === "chain" ? "ring" : "chain", losers] as const]) {
    for (const [index, item] of collection.entries()) {
      const ids = item.region.atomIds;
      const current = item.region.current;
      const status: ParentSelectionCandidateEvidence["status"] = family !== winningFamily
        ? "evaluated-alternative" : winners.length === 1 ? "selected-by-rule" : "candidate";
      const typeLabel = item.region.kind === "acyclic-chain"
        ? language === "en" ? `Acyclic chain candidate (${ids.length} carbon${ids.length === 1 ? "" : "s"})` : `Cadena acíclica candidata (${ids.length} ${ids.length === 1 ? "carbono" : "carbonos"})`
        : language === "en" ? "Simple cyclic ring candidate" : "Anillo cíclico simple candidato";
      entries.push({ ...candidate(molecule, `compared-${family}-${index + 1}`, typeLabel, status, ids),
        regionKind: item.region.kind, principalGroupCount: item.occurrences!.length,
        principalGroupCountStatus: "known", principalGroupIds: item.occurrences!,
        nomenclaturalAdmissibility: current ? "analysis-selected" : "candidate-unverified",
        currentAnalysisParent: current,
        ...(family === winningFamily ? { decisiveCriterion: "maximum principal-group suffix occurrences", ruleReference: rule } : {}) });
    }
  }
  const currentRegion = [...chainCounts, ...ringCounts].find(item => item.region.current);
  if (currentRegion && !entries.some(item => item.atomIds.length === currentRegion.region.atomIds.length
    && item.atomIds.every(id => currentRegion.region.atomIds.includes(id)))) {
    const count = currentRegion.occurrences!.length;
    entries.push({ ...candidate(molecule, "current-analysis-parent",
      language === "en" ? "Parent selected by the current analysis (within-family criteria not shown)"
        : "Padre elegido por el análisis actual (criterios de la misma familia no mostrados)",
      "selected-by-engine", currentRegion.region.atomIds),
      regionKind: currentRegion.region.kind, principalGroupCount: count, principalGroupCountStatus: "known",
      principalGroupIds: currentRegion.occurrences!, nomenclaturalAdmissibility: "analysis-selected",
      currentAnalysisParent: true });
  }
  // Expose the exact functional occurrences counted on each side. A secondary
  // amine may be associated with two candidate regions, but retains one identity.
  for (const [index, [id, group]] of [...occurrenceTargets.entries()].entries()) {
    const groupAtomIds = [...new Set(group.atomIds ?? [group.carbonId])];
    const ringAttachments = (group.kind === "carboxylicAcid" || group.kind === "aldehyde")
      ? ringCounts.filter(item => item.occurrences?.includes(id)).flatMap(item => item.region.atomIds.flatMap(ringAtomId =>
        molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
          && (a === group.carbonId && b === ringAtomId || b === group.carbonId && a === ringAtomId))
          ? [{ ringAtomId, bond: [group.carbonId, ringAtomId] as const }] : []))
      : [];
    const targetAtomIds = [...new Set([...groupAtomIds, ...ringAttachments.map(item => item.ringAtomId)])];
    const attachmentBonds = molecule.bonds.filter(([a, b]) => groupAtomIds.includes(a) && groupAtomIds.includes(b)
      || ringAttachments.some(item => item.bond[0] === a && item.bond[1] === b
        || item.bond[0] === b && item.bond[1] === a)).map(([a, b]) => [a, b] as const);
    entries.push({
      id: `parent-selection:principal-group:${id}`,
      label: language === "en" ? `Principal ${label} occurrence ${index + 1}` : `Ocurrencia del grupo principal (${label}) ${index + 1}`,
      status: "structural-region", evidenceKind: "principal-groups",
      atomIds: targetAtomIds, bondIds: attachmentBonds,
      principalGroupCount: 1, principalGroupCountStatus: "known", principalGroupIds: [id],
      nomenclaturalAdmissibility: "candidate-unverified",
    });
  }
  const currentMatchesRule = winners.some(item => item.region.current);
  const winnerOccurrenceIds = new Set(winners.flatMap(item => item.occurrences ?? []));
  const alternativeOccurrenceIds = new Set(losers.flatMap(item => item.occurrences ?? []));
  const sharedOccurrences = [...winnerOccurrenceIds].filter(id => alternativeOccurrenceIds.has(id));
  const explanation = `${relation} ${currentMatchesRule
    ? language === "en" ? "The current analyzed parent belongs to the winning family; this comparison still does not reconcile the complete active name."
      : "El padre del análisis actual pertenece a la familia favorecida; esta comparación no concilia el nombre activo completo."
    : language === "en" ? "The current analysis does not select this winning candidate family, so the comparison is exposed as rule evidence without changing the analyzed name or claiming reconciliation."
      : "El análisis actual no selecciona esta familia candidata favorecida; la comparación se muestra como evidencia de regla, sin cambiar el nombre analizado ni afirmar que esté conciliado."}`;
  return {
    level: "rule-supported", reconciliation: "unverified", explanation, rule,
    candidates: entries.slice(0, 20), evaluatedCandidateCount: chainCounts.length + ringCounts.length,
    comparisonScope: "principal-group-bearing simple acyclic paths versus independent simple ring candidates; within-family selection not evaluated",
    principalGroupComparison: { groupKind, groupLabel: label, chainCount: maxChain, ringCount: maxRing,
      winner: winningFamily, rule, sameOccurrenceIds: sharedOccurrences, pinPreferenceApplied: false },
  };
}

type AmineParentRegion = {
  atomIds: number[];
  kind: ParentRegion["kind"];
  rootCarbonIds: number[];
  multipleBondCount: number;
  doubleBondCount: number;
};

function compareSecondaryOrTertiaryAmineParents(molecule: ParentSelectionMolecule, analysis: ParentSelectionAnalysis,
  language: AppLanguage, profile: "blue-book-2013" | "iupac-1979-legacy"): ParentSelectionEvidence | undefined {
  if (profile !== "blue-book-2013" || analysis.primaryFunctionalGroup !== "amine") return;
  const amines = analysis.functionalGroups.filter(group => group.kind === "amine");
  // Multi-amine parent selection uses P-62.2.4 and is outside this selector.
  if (amines.length !== 1) return;
  const group = amines[0];
  const nitrogenId = group.heteroAtomId ?? group.atomIds?.find(id => molecule.atoms.find(atom => atom.id === id)?.element === "N");
  const nitrogen = molecule.atoms.find(atom => atom.id === nitrogenId && atom.element === "N");
  const roots = [...new Set(group.carbonIds?.length ? group.carbonIds : [group.carbonId])];
  if (!nitrogen || (nitrogen.charge ?? 0) !== 0 || (roots.length !== 2 && roots.length !== 3)) return;
  const nBonds = molecule.bonds.filter(([a, b]) => a === nitrogen.id || b === nitrogen.id);
  const nCarbonNeighbors = nBonds.filter(([a, b, order]) => (order ?? 1) === 1
    && roots.includes(a === nitrogen.id ? b : a)).map(([a, b]) => a === nitrogen.id ? b : a);
  const allOtherNNeighbors = nBonds.map(([a, b]) => a === nitrogen.id ? b : a);
  if (new Set(nCarbonNeighbors).size !== roots.length || allOtherNNeighbors.length !== roots.length
    || roots.some(id => !nCarbonNeighbors.includes(id))) return;
  const degree = roots.length as 2 | 3;
  const rings = simpleIndependentRings(molecule, analysis);
  if (rings.some(ring => ring.atomIds.includes(nitrogen.id))) return; // amine N belongs to a ring parent itself.
  const cyclicAtoms = new Set((molecule.rings ?? []).flatMap(ring => ring.atomIds));
  const cyclicRoots = roots.filter(id => cyclicAtoms.has(id));
  const unresolvedRingRoot = cyclicRoots.some(id => !rings.some(ring => ring.atomIds.includes(id)));
  const paths = simpleAcyclicCarbonPaths(molecule, analysis, rings);
  const regions: AmineParentRegion[] = [];
  const rootRegionCount = new Map<number, number>();
  for (const root of roots) {
    const ringRegion = rings.find(ring => ring.atomIds.includes(root));
    if (ringRegion) {
      regions.push({ atomIds: ringRegion.atomIds, kind: ringRegion.kind, rootCarbonIds: [root], multipleBondCount: 0, doubleBondCount: 0 });
      rootRegionCount.set(root, 1);
      continue;
    }
    if (cyclicAtoms.has(root)) continue;
    const possible = paths.filter(path => path.includes(root));
    if (!possible.length) continue;
    const maxLength = Math.max(...possible.map(path => path.length));
    const bestPaths = possible.filter(path => path.length === maxLength);
    for (const atomIds of bestPaths) {
      const atomSet = new Set(atomIds);
      const internal = molecule.bonds.filter(([a, b]) => atomSet.has(a) && atomSet.has(b));
      regions.push({ atomIds: [...atomIds], kind: "acyclic-chain", rootCarbonIds: [root],
        multipleBondCount: internal.filter(([, , order]) => (order ?? 1) > 1).length,
        doubleBondCount: internal.filter(([, , order]) => (order ?? 1) === 2).length });
    }
    rootRegionCount.set(root, bestPaths.length);
  }
  const uniqueRegions = new Map<string, AmineParentRegion>();
  for (const region of regions) {
    const key = `${region.kind}:${[...region.atomIds].sort((a, b) => a - b).join(",")}`;
    const existing = uniqueRegions.get(key);
    if (existing) existing.rootCarbonIds.push(...region.rootCarbonIds);
    else uniqueRegions.set(key, { ...region, rootCarbonIds: [...region.rootCarbonIds] });
  }
  const candidates = [...uniqueRegions.values()];
  const incompleteRoots = unresolvedRingRoot || roots.some(root => !rootRegionCount.has(root))
    || candidates.some(region => region.rootCarbonIds.length !== 1);
  const ringCandidates = candidates.filter(region => region.kind !== "acyclic-chain");
  const chainCandidates = candidates.filter(region => region.kind === "acyclic-chain");
  let winners: AmineParentRegion[] = [];
  let winnerKind: "acyclic-parent" | "cyclic-parent" | "unresolved" = "unresolved";
  let decisiveRule: string | undefined;
  let decisionReason: string;

  if (!incompleteRoots && ringCandidates.length === 1 && chainCandidates.length > 0) {
    winners = [ringCandidates[0]];
    winnerKind = "cyclic-parent";
    decisiveRule = "P-62.2.2.2";
    decisionReason = language === "en"
      ? "A cyclic system is directly bonded to the amine nitrogen, alongside one or more acyclic N-bound candidates. P-62.2.2.2 prefers the ring or ring system when this parent-hydride choice is available; rings connected only through a carbon substituent are not included."
      : "Un sistema cíclico está enlazado directamente al nitrógeno de la amina, junto con uno o más candidatos acíclicos unidos a N. P-62.2.2.2 prefiere el anillo o sistema de anillos cuando existe esta elección de padre hidruro; no se incluyen anillos conectados solo a través de un sustituyente carbonado.";
  } else if (!incompleteRoots && ringCandidates.length > 1) {
    decisionReason = language === "en"
      ? "More than one ring system is directly bonded to the amine nitrogen. P-62.2.2.2 points to the senior ring system, but the ring-to-ring comparison under P-44.2 is not established here. The candidates remain unresolved."
      : "Más de un sistema cíclico está enlazado directamente al nitrógeno de la amina. P-62.2.2.2 remite al sistema cíclico de mayor prioridad, pero aquí no se establece la comparación entre anillos de P-44.2. Los candidatos quedan sin resolver.";
  } else if (!incompleteRoots && chainCandidates.length >= 2) {
    const heteroCounts = chainCandidates.map(() => 0); // These enumerated candidates are carbon-only skeleton paths.
    const maxHetero = Math.max(...heteroCounts);
    const afterHetero = chainCandidates.filter((_, index) => heteroCounts[index] === maxHetero);
    const maxAtoms = Math.max(...afterHetero.map(region => region.atomIds.length));
    let surviving = afterHetero.filter(region => region.atomIds.length === maxAtoms);
    if (surviving.length === 1) {
      winners = surviving;
      winnerKind = "acyclic-parent";
      decisiveRule = "P-44.3.2";
      decisionReason = language === "en"
        ? `The acyclic candidates contain the same number (zero) of skeletal heteroatoms under P-44.3.1. The selected N-bound chain has ${maxAtoms} skeletal carbon atoms, more than the other direct N-bound candidate(s); P-44.3.2 is decisive. The N–C bond and remaining N-substituent are shown separately.`
        : `Las cadenas acíclicas candidatas tienen la misma cantidad (cero) de heteroátomos esqueléticos según P-44.3.1. La cadena unida directamente a N contiene ${maxAtoms} átomos de carbono esqueléticos, más que los otros candidatos unidos a N; P-44.3.2 es decisiva. El enlace N–C y el sustituyente restante sobre N se muestran por separado.`;
    } else {
      const maxMultiple = Math.max(...surviving.map(region => region.multipleBondCount));
      surviving = surviving.filter(region => region.multipleBondCount === maxMultiple);
      if (surviving.length === 1) {
        winners = surviving;
        winnerKind = "acyclic-parent";
        decisiveRule = "P-44.4.1.1";
        decisionReason = language === "en"
          ? `The N-bound candidates tie in skeletal atoms after P-44.3.1 and P-44.3.2. P-44.3.3 also ties because the carbon-only paths contain no acyclic heteroatom. P-44.4.1.1 selects the candidate with ${maxMultiple} multiple bond(s).`
          : `Los candidatos unidos a N empatan en átomos esqueléticos tras P-44.3.1 y P-44.3.2. P-44.3.3 también queda empatada porque los caminos carbonados no contienen heteroátomos acíclicos. P-44.4.1.1 selecciona el candidato con ${maxMultiple} enlace(s) múltiple(s).`;
      } else {
        const maxDouble = Math.max(...surviving.map(region => region.doubleBondCount));
        surviving = surviving.filter(region => region.doubleBondCount === maxDouble);
        if (surviving.length === 1) {
          winners = surviving;
          winnerKind = "acyclic-parent";
          decisiveRule = "P-44.4.1.2";
          decisionReason = language === "en"
            ? `The candidates tie in skeletal atoms and number of multiple bonds. P-44.4.1.2 selects the chain with ${maxDouble} double bond(s).`
            : `Los candidatos empatan en átomos esqueléticos y cantidad de enlaces múltiples. P-44.4.1.2 selecciona la cadena con ${maxDouble} enlace(s) doble(s).`;
        } else {
          decisionReason = language === "en"
            ? "The direct N-bound acyclic candidates tie in the implemented P-44.3 and P-44.4 criteria. Later criteria require locant, stereochemical or skeletal evidence not available in this trace; no candidate is selected arbitrarily."
            : "Los candidatos acíclicos unidos directamente a N empatan en los criterios implementados de P-44.3 y P-44.4. Los criterios posteriores requieren localizadores o evidencia estereoquímica/esquelética que esta traza no contiene; no se elige un candidato arbitrariamente.";
        }
      }
    }
  } else {
    decisionReason = language === "en"
      ? "The nitrogen is attached to multiple carbon regions, but at least one candidate cannot be represented as a verified simple acyclic carbon path or independent ring. Parent admissibility or topology remains unresolved."
      : "El nitrógeno está unido a varias regiones carbonadas, pero al menos un candidato no puede representarse como camino carbonado acíclico simple o anillo independiente verificado. La admisibilidad parental o la topología quedan sin resolver.";
  }

  const resolved = winners.length === 1;
  const items: ParentSelectionCandidateEvidence[] = candidates.map((region, index) => {
    const winner = resolved && region === winners[0];
    const selectedCarbonCount = region.atomIds.filter(id => molecule.atoms.find(atom => atom.id === id)?.element === "C").length;
    const singleParentChain = region.kind === "acyclic-chain";
    const nSubstituentName = selectedCarbonCount === 1 ? language === "en" ? "methyl" : "metil"
      : selectedCarbonCount === 2 ? language === "en" ? "ethyl" : "etil" : undefined;
    const label = winner
      ? language === "en" ? `${singleParentChain ? "Selected amine-parent chain candidate" : "Selected ring candidate"} (${selectedCarbonCount} carbon${selectedCarbonCount === 1 ? "" : "s"})`
        : `${singleParentChain ? "Cadena candidata a padre de amina seleccionada" : "Candidato cíclico seleccionado"} (${selectedCarbonCount} ${selectedCarbonCount === 1 ? "carbono" : "carbonos"})`
      : language === "en" ? `${nSubstituentName ? `N-${nSubstituentName} fragment` : "N-bound carbon region"} · evaluated alternative (${selectedCarbonCount} carbon${selectedCarbonCount === 1 ? "" : "s"})`
        : `${nSubstituentName ? `Fragmento N-${nSubstituentName}` : "Región carbonada unida a N"} · alternativa evaluada (${selectedCarbonCount} ${selectedCarbonCount === 1 ? "carbono" : "carbonos"})`;
    return { ...candidate(molecule, winner ? "amine-parent-winner" : `amine-n-substituent-${index + 1}`,
      label, winner ? "selected-by-rule" : resolved ? "evaluated-alternative" : "candidate", region.atomIds),
      regionKind: region.kind, evidenceKind: winner ? "parent" : "n-substituent",
      ...(winner ? { nomenclaturalAdmissibility: "candidate-unverified" as const } : {}),
      currentAnalysisParent: region.atomIds.length === analysis.mainChain.length
        && region.atomIds.every(id => analysis.mainChain.includes(id)),
      ...(decisiveRule && winner ? { decisiveCriterion: decisionReason, ruleReference: decisiveRule } : {}) };
  });
  for (const [index, ring] of rings.entries()) {
    if (items.some(item => item.atomIds.length === ring.atomIds.length && item.atomIds.every(id => ring.atomIds.includes(id)))) continue;
    items.push({ ...candidate(molecule, `amine-indirect-ring-${index + 1}`,
      language === "en" ? `${ring.kind === "aromatic-ring" ? "Aromatic ring" : "Ring system"} not directly bonded to the amine nitrogen`
        : `${ring.kind === "aromatic-ring" ? "Anillo aromático" : "Sistema cíclico"} no unido directamente al nitrógeno de la amina`,
      "not-compared", ring.atomIds), regionKind: ring.kind });
  }

  const groupAtomIds = [...new Set([nitrogen.id, ...roots])];
  const amineBonds = nBonds.map(([a, b]) => [a, b] as const);
  items.push({ id: `parent-selection:amine:${occurrenceId(group)}`,
    label: language === "en" ? `Principal ${degree === 2 ? "secondary" : "tertiary"} amine function (one occurrence)`
      : `Función amina ${degree === 2 ? "secundaria" : "terciaria"} principal (una ocurrencia)`,
    status: "structural-region", evidenceKind: "amine-function", atomIds: groupAtomIds, bondIds: amineBonds,
    principalGroupCount: 1, principalGroupCountStatus: "known", principalGroupIds: [occurrenceId(group)] });
  items.push({ id: `parent-selection:nitrogen:${nitrogen.id}`,
    label: language === "en" ? "Amine nitrogen atom" : "Átomo de nitrógeno de la amina",
    status: "structural-region", evidenceKind: "nitrogen-atom", atomIds: [nitrogen.id], bondIds: [] });
  for (const [index, root] of roots.entries()) {
    const link = nBonds.find(([a, b]) => a === nitrogen.id && b === root || b === nitrogen.id && a === root);
    if (!link) continue;
    items.push({ id: `parent-selection:nitrogen-link:${nitrogen.id}:${root}`,
      label: language === "en" ? `N–C attachment to candidate ${index + 1}` : `Enlace N–C al candidato ${index + 1}`,
      status: "structural-region", evidenceKind: "nitrogen-attachment", atomIds: [nitrogen.id, root],
      bondIds: [[link[0], link[1]]] });
  }
  const amineLabel = language === "en" ? `${degree === 2 ? "secondary" : "tertiary"} amine` : `amina ${degree === 2 ? "secundaria" : "terciaria"}`;
  const currentWinner = resolved && winners[0].atomIds.length === analysis.mainChain.length
    && winners[0].atomIds.every(id => analysis.mainChain.includes(id));
  const explanation = `${language === "en"
    ? `The graph shows one ${amineLabel} nitrogen bonded directly to ${degree} carbon regions${degree === 2 ? " and bearing one implicit hydrogen" : ""}; this is one functional-group occurrence, not ${degree} amines. `
    : `El grafo muestra un nitrógeno de ${amineLabel} unido directamente a ${degree} regiones carbonadas${degree === 2 ? " y con un hidrógeno implícito" : ""}; es una sola ocurrencia funcional, no ${degree} aminas. `}${decisionReason} ${currentWinner
      ? language === "en" ? "The analyzed parent matches this candidate family, but the full active name remains unreconciled."
        : "El padre del análisis coincide con esta familia candidata, pero el nombre activo completo sigue sin conciliarse."
      : language === "en" ? "This graph-based parent comparison does not change or fully reconcile the active generated name."
        : "Esta comparación parental basada en el grafo no modifica ni concilia por completo el nombre generado activo."}`;
  return { level: resolved ? "rule-supported" : "selection-traced", reconciliation: "unverified", explanation,
    ...(decisiveRule ? { rule: decisiveRule } : {}), candidates: items.slice(0, 20),
    evaluatedCandidateCount: candidates.length,
    comparisonScope: "direct N-bound carbon regions only; no traversal through nitrogen; acyclic carbon paths and independent simple rings",
    amineParentSelection: { nitrogenAtomId: nitrogen.id, nitrogenDegree: degree, outcome: winnerKind,
      comparedRegions: candidates.length, ...(decisiveRule ? { rule: decisiveRule } : {}) } };
}

/** Structural context for mixed ring/chain cases whose admissible-parent
 * comparison is not available from the current selector. It never ranks these regions. */
function unresolvedMixedRegions(molecule: ParentSelectionMolecule, analysis: ParentSelectionAnalysis,
  parentIds: readonly number[], language: AppLanguage): ParentSelectionCandidateEvidence[] {
  const result: ParentSelectionCandidateEvidence[] = [];
  const parent = new Set(parentIds);
  const ringAtoms = new Set((molecule.rings ?? []).flatMap(ring => ring.atomIds));
  const seen = new Set<string>();
  (molecule.rings ?? []).filter(ring => ring.atomIds.length >= 3 && !ring.atomIds.every(id => parent.has(id)))
    .slice(0, 4).forEach((ring, index) => result.push({
      ...candidate(molecule, `unresolved-ring-${index + 1}`,
        language === "en" ? `${ring.kind === "aromatic" ? "Aromatic ring" : "Cyclic system"} (not compared)`
          : `${ring.kind === "aromatic" ? "Anillo aromático" : "Sistema cíclico"} (sin comparar)`,
        "not-compared", ring.atomIds),
      regionKind: ring.kind === "aromatic" ? "aromatic-ring" : "ring-system",
    }));

  if (analysis.primaryFunctionalGroup && suffixGroupKinds.has(analysis.primaryFunctionalGroup)) {
    const groups = analysis.functionalGroups.filter(group => group.kind === analysis.primaryFunctionalGroup);
    const unique = new Map(groups.map(group => [occurrenceId(group), group]));
    for (const [index, [id, group]] of [...unique.entries()].entries()) {
      const ids = [...new Set(group.atomIds ?? [group.carbonId])];
      result.push({ id: `parent-selection:principal-group:${id}`,
        label: language === "en" ? `Principal ${primaryGroupLabel(group.kind, language)} occurrence ${index + 1}`
          : `Ocurrencia del grupo principal (${primaryGroupLabel(group.kind, language)}) ${index + 1}`,
        status: "structural-region", evidenceKind: "principal-groups", atomIds: ids,
        bondIds: molecule.bonds.filter(([a, b]) => ids.includes(a) && ids.includes(b)).map(([a, b]) => [a, b]),
        principalGroupCount: 1, principalGroupCountStatus: "known", principalGroupIds: [id],
        nomenclaturalAdmissibility: "candidate-unverified" });
    }
  }

  if (analysis.primaryFunctionalGroup === "amine") {
    const seeds = analysis.functionalGroups.filter(group => group.kind === "amine")
      .flatMap(group => group.carbonIds?.length ? group.carbonIds : [group.carbonId])
      .filter(id => !parent.has(id) && !ringAtoms.has(id));
    const carbonIds = new Set(molecule.atoms.filter(atom => (atom.element ?? "C") === "C" && !ringAtoms.has(atom.id)).map(atom => atom.id));
    const adjacency = new Map<number, number[]>();
    for (const [a, b, order] of molecule.bonds) {
      if ((order ?? 1) !== 1 || !carbonIds.has(a) || !carbonIds.has(b)) continue;
      adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
      adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
    }
    for (const seed of seeds) {
      const component = new Set<number>([seed]);
      const queue = [seed];
      while (queue.length && component.size <= 24) {
        const current = queue.shift()!;
        for (const next of adjacency.get(current) ?? []) if (!component.has(next)) {
          component.add(next);
          queue.push(next);
        }
      }
      const atomIds = [...component].sort((a, b) => a - b);
      if (atomIds.some(id => parent.has(id)) || seen.has(atomIds.join(","))) continue;
      seen.add(atomIds.join(","));
      result.push({
        ...candidate(molecule, `amine-linked-carbon-region-${result.length + 1}`,
          language === "en" ? `Amine-linked carbon region (${atomIds.length} carbon${atomIds.length === 1 ? "" : "s"}; not compared)`
            : `Región carbonada unida a la amina (${atomIds.length} ${atomIds.length === 1 ? "carbono" : "carbonos"}; sin comparar)`,
          "not-compared", atomIds),
        regionKind: "acyclic-chain",
        principalGroupCount: 1,
      });
      if (result.length >= 8) break;
    }
  }
  return result.slice(0, 8);
}

/** Level D: expose only a parent region already mapped by a FULL derivation to
 * the exact active name. This proves correspondence, not why alternatives lost. */
export function reconciledParentSelectionEvidence(input: {
  molecule: ParentSelectionMolecule;
  parentAtomIds: readonly number[];
  derivationName: string;
  activeName?: string;
  language: AppLanguage;
}): ParentSelectionEvidence | undefined {
  const { molecule, parentAtomIds, derivationName, activeName, language } = input;
  if (!parentAtomIds.length || activeName !== derivationName
    || parentAtomIds.some(id => !molecule.atoms.some(atom => atom.id === id))) return;
  const parent = candidate(molecule, "reconciled", language === "en" ? "Parent mapped to the reconciled name" : "Padre asignado al nombre conciliado",
    "name-reconciled", parentAtomIds);
  return { level: "name-reconciled", reconciliation: "verified",
    explanation: language === "en"
      ? "The FULL derivation maps this parent component to the active name. It does not expose a comparison against every admissible parent candidate."
      : "La derivación FULL asigna este componente padre al nombre activo. No expone una comparación con todos los candidatos admisibles a padre.",
    candidates: [parent] };
}

/** Returns only selection evidence already justified by the current analysis.
 * Structural regions without a supported comparison stay explicitly unresolved. */
export function parentStructureSelectionEvidence(
  molecule: ParentSelectionMolecule,
  analysis: ParentSelectionAnalysis,
  language: AppLanguage,
  localizedParentName = analysis.chainName,
  profile: "blue-book-2013" | "iupac-1979-legacy" = "blue-book-2013",
): ParentSelectionEvidence | undefined {
  const explanation = profile === "blue-book-2013"
    ? parentStructureSelectionReasoning(molecule, analysis, language, localizedParentName, profile)
    : undefined;
  const amineEvidence = compareSecondaryOrTertiaryAmineParents(molecule, analysis, language, profile);
  if (amineEvidence) return amineEvidence;
  const parentIds = [...analysis.mainChain];
  if (!parentIds.length) return;
  const mixedGroupComparison = comparePrimaryGroupsAcrossChainAndRing(molecule, analysis, language, profile);
  if (mixedGroupComparison) return mixedGroupComparison;
  if (analysis.parentSelectionTrace && analysis.parentSelectionTrace.profile === profile) {
    const trace = analysis.parentSelectionTrace;
    const candidates: ParentSelectionCandidateEvidence[] = trace.candidates.map((item, index) => ({
      id: structuralId(item.selected ? "engine-selected" : `engine-alternative-${index + 1}`, item.atomIds),
      label: language === "en"
        ? `${item.selected ? "Selected" : "Compared alternative"} ${item.atomIds.length}-carbon acyclic path${item.decisiveCriterion ? ` · ${item.decisiveCriterion}${item.ruleReference ? ` (${item.ruleReference})` : ""}` : ""}`
        : `${item.selected ? "Seleccionado" : "Alternativa comparada"}: camino acíclico de ${item.atomIds.length} carbonos${item.decisiveCriterion ? ` · ${item.decisiveCriterion}${item.ruleReference ? ` (${item.ruleReference})` : ""}` : ""}`,
      status: item.selected ? "selected-by-engine" : "evaluated-alternative",
      atomIds: item.atomIds,
      bondIds: item.bondIds,
      ...(item.decisiveCriterion ? { decisiveCriterion: item.decisiveCriterion } : {}),
      ...(item.ruleReference ? { ruleReference: item.ruleReference } : {}),
    }));
    const ruleExplanation = explanation;
    if (ruleExplanation && analysis.family === "acyclic") {
      const parent = new Set(parentIds);
      const attachedRings = (molecule.rings ?? []).filter(ring => ring.atomIds.length >= 3
        && ring.atomIds.every(id => !parent.has(id))
        && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
          && (parent.has(a) && ring.atomIds.includes(b) || parent.has(b) && ring.atomIds.includes(a))));
      attachedRings.forEach((ring, index) => candidates.push(candidate(molecule, `attached-region-${index + 1}`,
        language === "en" ? `Attached ${ring.kind} region (not an acyclic-chain candidate)`
          : `Región ${ring.kind === "aromatic" ? "aromática" : "cíclica"} unida (no es candidata de cadena acíclica)`,
        "structural-region", ring.atomIds)));
    }
    return { level: ruleExplanation ? "rule-supported" : "selection-traced", reconciliation: "unverified",
      explanation: ruleExplanation ?? (language === "en"
        ? `The existing ${trace.profile === "blue-book-2013" ? "2013" : "1979"} acyclic-chain selector compared ${trace.evaluatedCandidateCount} enumerated carbon paths. This trace covers that selector's path set only; cyclic and other parent families were not compared.`
        : `El selector existente de cadenas acíclicas (${trace.profile === "blue-book-2013" ? "2013" : "1979"}) comparó ${trace.evaluatedCandidateCount} caminos carbonados enumerados. La traza cubre solo los caminos de ese selector; no comparó padres cíclicos ni otras familias.`),
      ...(ruleExplanation ? { rule: analysis.family === "acyclic" ? "P-59.2.1.2" : undefined } : {}),
      evaluatedCandidateCount: trace.evaluatedCandidateCount,
      comparisonScope: trace.profile === "blue-book-2013" ? "enumerated acyclic carbon paths" : "enumerated acyclic carbon paths under IUPAC 1979",
      candidates };
  }
  const selected = candidate(molecule, "selected", explanation
    ? language === "en" ? "Selected parent" : "Padre seleccionado"
    : language === "en" ? "Parent candidate from the current analysis" : "Candidato a padre del análisis actual",
    explanation ? "selected-by-rule" : "candidate", parentIds);
  if (analysis.family === "cycloalkane") selected.regionKind = "carbocyclic-ring";
  else if (analysis.family === "aromatic") selected.regionKind = "aromatic-ring";
  else if (analysis.family === "acyclic") selected.regionKind = "acyclic-chain";
  if (analysis.primaryFunctionalGroup) {
    const groups = analysis.functionalGroups.filter(group => group.kind === analysis.primaryFunctionalGroup);
    selected.principalGroupCountStatus = groups.length ? "known" : "unknown";
    if (groups.length) selected.principalGroupCount = groups.filter(group => {
      const ids = group.carbonIds?.length ? group.carbonIds : [group.carbonId];
      return ids.every(id => parentIds.includes(id))
        || analysis.family === "cycloalkane" && (group.kind === "carboxylicAcid" || group.kind === "aldehyde")
          && !ids.some(id => parentIds.includes(id))
          && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
            && (ids.includes(a) && parentIds.includes(b) || ids.includes(b) && parentIds.includes(a)));
    }).length;
  }
  if (!explanation) return { level: "structural", reconciliation: "unverified",
    explanation: language === "en"
      ? "The current analysis identifies a parent-shaped region, but no supported rule comparison is available for this case. Other rings and amine-linked carbon regions are exposed only as structural candidates; their nomenclatural admissibility and cross-family ranking have not been evaluated."
      : "El análisis actual identifica una región con forma de padre, pero no hay una comparación de reglas respaldada para este caso. Los otros anillos y las regiones carbonadas unidas a la amina se muestran solo como candidatos estructurales; no se evaluaron su admisibilidad nomenclatural ni su prioridad entre familias.",
    candidates: [selected, ...unresolvedMixedRegions(molecule, analysis, parentIds, language)] };

  const candidates = [selected];
  if (analysis.family === "acyclic") {
    const parent = new Set(parentIds);
    const outsideRings = (molecule.rings ?? []).filter(ring => ring.atomIds.length >= 3
      && ring.atomIds.every(id => !parent.has(id))
      && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
        && (parent.has(a) && ring.atomIds.includes(b) || parent.has(b) && ring.atomIds.includes(a))));
    outsideRings.forEach((ring, index) => candidates.push(candidate(molecule, `ring-${index + 1}`,
      language === "en" ? `Attached ${ring.kind} region` : `Región ${ring.kind === "aromatic" ? "aromática" : "cíclica"} unida`,
      "structural-region", ring.atomIds)));
    return { level: "rule-supported", reconciliation: "unverified", explanation, rule: "P-59.2.1.2", candidates };
  }
  if (analysis.family === "aromatic") {
    const parent = new Set(parentIds);
    (molecule.rings ?? []).filter(ring => ring.atomIds.length >= 3 && ring.kind === "aromatic"
      && !ring.atomIds.every(id => parent.has(id))
      && ring.atomIds.some(id => molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
        && (a === id && parent.has(b) || b === id && parent.has(a)))))
      .forEach((ring, index) => candidates.push(candidate(molecule, `attached-ring-${index + 1}`,
        language === "en" ? "Attached carbon region (not compared as an admissible parent)" : "Región carbonada unida (sin comparación como padre admisible)",
        "not-compared", ring.atomIds)));
    return { level: "rule-supported", reconciliation: "unverified", explanation,
      rule: "P-44.1.2.2; P-52.2.8", candidates };
  }
  if (analysis.family === "cycloalkane" && explanation.includes("P-59.2.1.4")) {
    const parent = new Set(parentIds);
    const attachedCarbonIds = molecule.bonds.flatMap(([a, b, order]) => {
      if ((order ?? 1) !== 1) return [];
      const outside = parent.has(a) && !parent.has(b) ? b : parent.has(b) && !parent.has(a) ? a : undefined;
      return outside !== undefined && molecule.atoms.find(atom => atom.id === outside)?.element === "C" ? [outside] : [];
    });
    const contextIds = [...new Set(attachedCarbonIds)];
    if (contextIds.length) candidates.push(candidate(molecule, "attached-carbon-context",
      language === "en" ? "Attached acyclic carbon region (structural context)" : "Región carbonada acíclica unida (contexto estructural)",
      "structural-region", contextIds));
    return { level: "rule-supported", reconciliation: "unverified", explanation,
      rule: "P-59.2.1.4", candidates };
  }
  return { level: "rule-supported", reconciliation: "unverified", explanation,
    rule: analysis.family === "cycloalkane"
      ? explanation.includes("P-65.1.2.2.2") || explanation.includes("P-66.6.1.1.3")
        ? explanation.match(/P-6[56]\.\d(?:\.\d)*/)?.[0]
        : undefined
      : undefined, candidates };
}

/** Explain supported ring/chain parent choices from the molecular graph and
 * the already validated nomenclature analysis; this helper never selects a parent. */
export function parentStructureSelectionReasoning(
  molecule: ParentSelectionMolecule,
  analysis: ParentSelectionAnalysis,
  language: AppLanguage,
  localizedParentName = analysis.chainName,
  profile: "blue-book-2013" | "iupac-1979-legacy" = "blue-book-2013",
) {
  if (profile !== "blue-book-2013") return;
  const parent = new Set(analysis.mainChain);
  if (!parent.size) return;
  const suffixGroups = analysis.primaryFunctionalGroup
    ? analysis.functionalGroups.filter((group) => group.kind === analysis.primaryFunctionalGroup)
    : [];
  const principalIsOnParent = suffixGroups.length > 0
    && suffixGroups.every((group) => (group.carbonIds?.length ? group.carbonIds : [group.carbonId])
      .every((id) => parent.has(id)));
  const externalRingFunction = analysis.family === "cycloalkane"
    ? analysis.functionalGroups.find((group) => group.kind === analysis.primaryFunctionalGroup
      && (group.kind === "carboxylicAcid" || group.kind === "aldehyde")
      && !parent.has(group.carbonId)
      && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
        && (a === group.carbonId && parent.has(b) || b === group.carbonId && parent.has(a))))
    : undefined;
  if (externalRingFunction) {
    const attachment = molecule.bonds.find(([a, b, order]) => (order ?? 1) === 1
      && (a === externalRingFunction.carbonId && parent.has(b) || b === externalRingFunction.carbonId && parent.has(a)));
    const ringAtom = attachment?.[0] === externalRingFunction.carbonId ? attachment[1] : attachment?.[0];
    const locant = ringAtom === undefined ? undefined : analysis.numberedAtoms.get(ringAtom);
    if (locant === undefined) return;
    const ringCarbonCount = `${analysis.mainChain.length} ${analysis.mainChain.length === 1 ? "carbono" : "carbonos"}`;
    return language === "en"
      ? `The ${analysis.mainChain.length}-carbon ring is the parent (${localizedParentName}). The ${externalRingFunction.kind === "carboxylicAcid" ? "carboxyl" : "aldehyde"} carbon lies outside the ring and attaches at ring C${locant}.`
      : `El anillo de ${ringCarbonCount} es la estructura principal (${localizedParentName}). El carbono del grupo ${externalRingFunction.kind === "carboxylicAcid" ? "carboxilo" : "aldehído"} queda fuera del anillo y se une en C${locant}.`;
  }
  const outsideRings = (molecule.rings ?? []).filter((ring) =>
    ring.atomIds.length >= 3 && ring.atomIds.every((id) => !parent.has(id)));
  const attachedRing = outsideRings.some((ring) => molecule.bonds.some(([a, b, order]) =>
    (order ?? 1) === 1 && (parent.has(a) && ring.atomIds.includes(b)
      || parent.has(b) && ring.atomIds.includes(a))));

  if (analysis.family === "acyclic" && principalIsOnParent && attachedRing) {
    const chainCarbonCount = `${analysis.mainChain.length} ${analysis.mainChain.length === 1 ? "carbono" : "carbonos"}`;
    const groupLabel = analysis.primaryFunctionalGroup === "carboxylicAcid"
      ? language === "en" ? "carboxylic acid" : "ácido carboxílico"
      : analysis.primaryFunctionalGroup === "ketone"
        ? language === "en" ? "ketone" : "cetona"
        : analysis.primaryFunctionalGroup === "alcohol"
          ? language === "en" ? "alcohol" : "alcohol"
          : analysis.primaryFunctionalGroup === "amine"
            ? language === "en" ? "amine" : "amina"
            : analysis.primaryFunctionalGroup === "amide"
              ? language === "en" ? "amide" : "amida"
              : analysis.primaryFunctionalGroup === "ester"
                ? language === "en" ? "ester" : "éster"
              : analysis.primaryFunctionalGroup === "nitrile"
                ? language === "en" ? "nitrile" : "nitrilo"
                : analysis.primaryFunctionalGroup === "aldehyde"
                  ? language === "en" ? "aldehyde" : "aldehído"
                  : language === "en" ? "principal characteristic" : "característico principal";
    return language === "en"
      ? `The ${analysis.mainChain.length}-carbon chain (${localizedParentName}) contains the principal ${groupLabel}, so it forms the parent. The attached ring is named as a substituent.`
      : `La cadena de ${chainCarbonCount} (${localizedParentName}) contiene el grupo principal (${groupLabel}) y forma la estructura principal. El anillo unido se nombra como sustituyente.`;
  }

  // The principal characteristic group occurs only in the cyclic system.
  const principalOnlyOnParent = suffixGroups.length > 0 && suffixGroups.every((group) => {
    const groupCarbons = group.carbonIds?.length ? group.carbonIds : [group.carbonId];
    return groupCarbons.every((id) => parent.has(id));
  });
  if (analysis.family === "cycloalkane" && principalOnlyOnParent) {
    const selectedRing = (molecule.rings ?? []).find((ring) => ring.atomIds.length >= 3
      && ring.atomIds.every((id) => parent.has(id)));
    if (selectedRing) {
      const ringIds = new Set(selectedRing.atomIds);
      const attachedCarbonIds = molecule.bonds.flatMap(([a, b, order]) => {
        if ((order ?? 1) !== 1) return [];
        const outside = ringIds.has(a) && !ringIds.has(b) ? b : ringIds.has(b) && !ringIds.has(a) ? a : undefined;
        return outside !== undefined && molecule.atoms.find((atom) => atom.id === outside)?.element === "C" ? [outside] : [];
      });
      if (attachedCarbonIds.length) {
        const ringCarbonCount = selectedRing.atomIds.filter(id =>
          (molecule.atoms.find(atom => atom.id === id)?.element ?? "C") === "C").length;
        const groupLabel = analysis.primaryFunctionalGroup === "alcohol"
          ? language === "en" ? "alcohol" : "alcohol"
          : analysis.primaryFunctionalGroup === "amine"
            ? language === "en" ? "amine" : "amina"
            : language === "en" ? "principal characteristic" : "característico principal";
        return language === "en"
          ? `The ${ringCarbonCount}-carbon ring contains the principal ${groupLabel}, so the ring forms the parent. Its attached carbon chain is named as a substituent.`
          : `El anillo de ${ringCarbonCount} carbonos contiene el grupo principal (${groupLabel}) y forma la estructura principal. La cadena unida se nombra como sustituyente.`;
      }
    }
  }

  if (analysis.family === "aromatic" && !suffixGroups.length) {
    const selectedAromaticRing = (molecule.rings ?? []).find((ring) => ring.kind === "aromatic"
      && ring.atomIds.length > 0 && ring.atomIds.every((id) => parent.has(id)));
    const attachedCarbonFragment = selectedAromaticRing && molecule.bonds.some(([a, b, order]) => {
      if ((order ?? 1) !== 1) return false;
      const outsideId = selectedAromaticRing.atomIds.includes(a) ? b
        : selectedAromaticRing.atomIds.includes(b) ? a : undefined;
      return outsideId !== undefined && !parent.has(outsideId)
        && molecule.atoms.find((atom) => atom.id === outsideId)?.element === "C";
    });
    if (!selectedAromaticRing) return;
    const sameHeteroatomClass = molecule.atoms.every((atom) => parent.has(atom.id) || atom.element === "C");
    const ringAndChainAreSameClass = Boolean(attachedCarbonFragment && sameHeteroatomClass);
    const carbonCount = selectedAromaticRing.atomIds.filter(id => (molecule.atoms.find(atom => atom.id === id)?.element ?? "C") === "C").length;
    const size = selectedAromaticRing.atomIds.length;
    const ringDescriptionEn = carbonCount === size
      ? `${size} ${size === 1 ? "carbon" : "carbons"}`
      : `${size} atoms, including ${carbonCount} ${carbonCount === 1 ? "carbon" : "carbons"}`;
    const ringDescriptionEs = carbonCount === size
      ? `${size} ${size === 1 ? "carbono" : "carbonos"}`
      : `${size} átomos, de ellos ${carbonCount} ${carbonCount === 1 ? "carbono" : "carbonos"}`;
    return language === "en"
      ? `The aromatic ring of ${ringDescriptionEn} (${localizedParentName}) is the parent.${attachedCarbonFragment ? " The attached carbon chain is named as a substituent." : ""}${ringAndChainAreSameClass ? " No suffix-bearing group changes this choice." : ""}`
      : `El anillo aromático de ${ringDescriptionEs} (${localizedParentName}) es la estructura principal.${attachedCarbonFragment ? " La cadena de carbonos unida se nombra como sustituyente." : ""}${ringAndChainAreSameClass ? " Ningún grupo expresado mediante sufijo modifica esta elección." : ""}`;
  }

  return;
}
