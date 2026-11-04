import type { AppLanguage } from "./i18n.ts";

type ParentSelectionAnalysis = {
  family: string;
  mainChain: readonly number[];
  chainName: string;
  primaryFunctionalGroup?: string;
  functionalGroups: readonly { kind: string; carbonId: number }[];
  numberedAtoms: ReadonlyMap<number, number>;
};

type ParentSelectionMolecule = {
  atoms: readonly { id: number; element?: string }[];
  rings?: readonly { kind: string; atomIds: readonly number[] }[];
  bonds: readonly (readonly [number, number, number?])[];
};

/** Explain supported ring/chain parent choices from the molecular graph and
 * the already validated nomenclature analysis; this helper never selects a parent. */
export function parentStructureSelectionReasoning(
  molecule: ParentSelectionMolecule,
  analysis: ParentSelectionAnalysis,
  language: AppLanguage,
  localizedParentName = analysis.chainName,
) {
  const parent = new Set(analysis.mainChain);
  if (!parent.size) return;
  const suffixGroups = analysis.primaryFunctionalGroup
    ? analysis.functionalGroups.filter((group) => group.kind === analysis.primaryFunctionalGroup)
    : [];
  const principalIsOnParent = suffixGroups.length > 0
    && suffixGroups.every((group) => parent.has(group.carbonId));
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
    return language === "en"
      ? `The selected parent is the ${analysis.mainChain.length}-carbon ring (${localizedParentName}). The carbon of ${externalRingFunction.kind === "carboxylicAcid" ? "–COOH" : "–CHO"} remains outside the ring and is attached at C${locant}; Blue Book P-59.2.1.8 names this with the ring parent and the ${externalRingFunction.kind === "carboxylicAcid" ? "carboxylic acid" : "carbaldehyde"} suffix. The ring locant and the external functional carbon are distinct.`
      : `El padre seleccionado es el anillo de ${analysis.mainChain.length} carbonos (${localizedParentName}). El carbono del grupo ${externalRingFunction.kind === "carboxylicAcid" ? "–COOH" : "–CHO"} queda fuera del anillo y se une por C${locant}; Blue Book P-59.2.1.8 nombra este caso con el anillo como padre y el sufijo ${externalRingFunction.kind === "carboxylicAcid" ? "carboxílico" : "carbaldehído"}. El localizador del anillo y el carbono funcional externo son distintos.`;
  }
  const outsideRings = (molecule.rings ?? []).filter((ring) =>
    ring.atomIds.length >= 3 && ring.atomIds.every((id) => !parent.has(id)));
  const attachedRing = outsideRings.some((ring) => molecule.bonds.some(([a, b, order]) =>
    (order ?? 1) === 1 && (parent.has(a) && ring.atomIds.includes(b)
      || parent.has(b) && ring.atomIds.includes(a))));

  if (analysis.family === "acyclic" && principalIsOnParent && attachedRing) {
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
      ? `The selected parent is the ${analysis.mainChain.length}-carbon acyclic chain (${localizedParentName}). The principal ${groupLabel} group occurs on this chain, while the attached ring is a separate substituent; under Blue Book P-59.2.1.2, a compound whose principal group occurs only in a chain is named as an acyclic compound and the cyclic component is cited as a substituent. The ring does not compete with the chain by carbon count.`
      : `El padre seleccionado es la cadena acíclica de ${analysis.mainChain.length} carbonos (${localizedParentName}). El grupo principal (${groupLabel}) está en esa cadena y el anillo enlazado forma un sustituyente separado; según Blue Book P-59.2.1.2, si el grupo principal aparece solo en una cadena, el compuesto se nombra como acíclico y el componente cíclico se cita como sustituyente. El anillo no compite con la cadena por cantidad de carbonos.`;
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
    const ringPreferenceApplies = Boolean(attachedCarbonFragment && sameHeteroatomClass);
    return language === "en"
      ? `The selected parent is the aromatic ring (${localizedParentName}).${ringPreferenceApplies ? " The attached carbon fragment is cited as a substituent. Both parent candidates are in the same heteroatom class and have zero principal characteristic groups; Blue Book P-52.2.8 therefore selects the ring for a preferred IUPAC name." : attachedCarbonFragment ? " The attached carbon fragment is cited as a substituent. The validated analysis selects the aromatic ring, but these structural checks do not establish the specific ring-versus-chain criterion." : " No attached carbon substituent changes this parent selection."}`
      : `El padre seleccionado es el anillo aromático (${localizedParentName}).${ringPreferenceApplies ? " El fragmento carbonado unido se cita como sustituyente. Ambos candidatos a padre pertenecen a la misma clase de heteroátomos y tienen cero grupos característicos principales; por eso Blue Book P-52.2.8 selecciona el anillo para el nombre IUPAC preferido." : attachedCarbonFragment ? " El fragmento carbonado unido se cita como sustituyente. El análisis validado selecciona el anillo aromático, pero estas comprobaciones estructurales no establecen el criterio específico de selección entre anillo y cadena." : " No hay un sustituyente carbonado unido que cambie esta selección del padre."}`;
  }

  return;
}
