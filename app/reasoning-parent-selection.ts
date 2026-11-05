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
    const ringCarbonCount = `${analysis.mainChain.length} ${analysis.mainChain.length === 1 ? "carbon" : "carbons"}`;
    const rule = externalRingFunction.kind === "carboxylicAcid" ? "P-65.1.2.2.2" : "P-66.6.1.1.3";
    return language === "en"
      ? `The selected parent is the ${analysis.mainChain.length}-carbon ring (${localizedParentName}). The carbon of ${externalRingFunction.kind === "carboxylicAcid" ? "–COOH" : "–CHO"} remains outside the ring and is attached at C${locant}; Blue Book ${rule} covers the cyclic-parent ${externalRingFunction.kind === "carboxylicAcid" ? "carboxylic acid" : "aldehyde"} form. The ring locant and the external functional carbon are distinct.`
      : `El padre seleccionado es el anillo de ${ringCarbonCount} (${localizedParentName}). El carbono del grupo ${externalRingFunction.kind === "carboxylicAcid" ? "–COOH" : "–CHO"} queda fuera del anillo y se une por C${locant}; Blue Book ${rule} corresponde a la forma cíclica con ${externalRingFunction.kind === "carboxylicAcid" ? "ácido carboxílico" : "aldehído"}. El localizador del anillo y el carbono funcional externo son distintos.`;
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
      ? `The selected parent is the ${analysis.mainChain.length}-carbon acyclic chain (${localizedParentName}), a chain containing the principal ${groupLabel} function. The principal ${groupLabel} group occurs on this chain, while the attached ring is a separate substituent; under Blue Book P-59.2.1.2, a compound whose principal group occurs only in a chain is named as an acyclic compound and the cyclic component is cited as a substituent. The ring does not compete with the chain by carbon count.`
      : `El padre seleccionado es la cadena de ${chainCarbonCount} (${localizedParentName}), que contiene el grupo principal (${groupLabel}) en esa cadena. La función principal ${groupLabel} está en la cadena y el anillo enlazado forma un sustituyente separado; según Blue Book P-59.2.1.2, si el grupo principal aparece solo en una cadena, el compuesto se nombra como acíclico y el componente cíclico se cita como sustituyente. El anillo no compite con la cadena por cantidad de carbonos.`;
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
    const ringCarbonCount = `${selectedAromaticRing.atomIds.length} ${selectedAromaticRing.atomIds.length === 1 ? "carbon" : "carbons"}`;
    return language === "en"
      ? `The selected aromatic parent ring contains ${ringCarbonCount} (${localizedParentName}).${attachedCarbonFragment ? ` The attached carbon fragment is cited as a substituent. ${ringAndChainAreSameClass ? "The ring and chain candidates have the same heteroatom class and neither bears a principal characteristic group." : ""} Blue Book P-44.1.2.2 and P-52.2.8 address parent selection and preferred IUPAC name status; this structural analysis confirms the displayed parent but does not establish that it is the PIN or compare every admissible parent.` : " No attached carbon substituent is included in this parent comparison."}`
      : `Se selecciona como padre el anillo aromático de ${selectedAromaticRing.atomIds.length} ${selectedAromaticRing.atomIds.length === 1 ? "carbono" : "carbonos"} (${localizedParentName}).${attachedCarbonFragment ? ` El fragmento carbonado unido se cita como sustituyente. ${ringAndChainAreSameClass ? "Los candidatos de anillo y cadena pertenecen a la misma clase de heteroátomos y ninguno contiene un grupo característico principal." : ""} Blue Book P-44.1.2.2 y P-52.2.8 tratan la selección del padre y la condición de nombre IUPAC preferido; este análisis estructural confirma el padre mostrado, pero no demuestra que sea el PIN ni compara todos los padres admisibles.` : " No se incluye aquí un sustituyente carbonado unido para comparar con el padre."}`;
  }

  return;
}
