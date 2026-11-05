import type { AppLanguage } from "./i18n.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { DerivationConsistencyStatus } from "./derivation-consistency.ts";
import type { ValidatedNameDerivation, NameComponent } from "./validated-name-derivation.ts";

export type VerifiedStructuralExplanation = {
  id: string;
  text: string;
  atomIds: number[];
  bondIds: [number, number][];
  locants: [number, number | string][];
};

const bondKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;

/** Explains only structural facts already present in a compatible FULL proof.
 * It never chooses a parent or infers chemical identity from a name string. */
export function verifiedStructuralReasoning(input: {
  molecule: GeneratedMolecule;
  derivation: ValidatedNameDerivation | null | undefined;
  consistency: DerivationConsistencyStatus;
  activeProfile: "current" | "legacy";
  language: AppLanguage;
}): VerifiedStructuralExplanation[] {
  const { molecule, derivation, consistency, language } = input;
  if (consistency !== "verified" || !derivation) return [];

  const components = derivation.components;
  const componentById = new Map(components.map(component => [component.id, component]));
  const parent = componentById.get("parent");
  if (!parent) return [];
  const suffix = componentById.get("suffix");
  const graphAtomIds = new Set(molecule.atoms.map(atom => atom.id));
  const graphEdges = new Map(molecule.bonds.map(([a, b]) => [bondKey(a, b), [a, b] as [number, number]]));
  const mainComponents = [parent, ...(suffix ? [suffix] : [])];
  const mainAtoms = new Set(mainComponents.flatMap(component => component.atomIds).filter(id => graphAtomIds.has(id)));
  const mainBonds = new Map<string, [number, number]>();
  for (const component of mainComponents) for (const [a, b] of component.bondIds) {
    const edge = graphEdges.get(bondKey(a, b));
    if (edge) mainBonds.set(bondKey(a, b), edge);
  }
  const parentNumbering = new Map<number, number | string>(parent.numbering);
  const explanations: VerifiedStructuralExplanation[] = [];
  const explanation = (id: string, text: string, atomIds: Iterable<number>, bondIds: Iterable<[number, number]>, locants: [number, number | string][] = []) => {
    const selectedBonds = new Map<string, [number, number]>();
    for (const [a, b] of bondIds) {
      const edge = graphEdges.get(bondKey(a, b));
      if (edge) selectedBonds.set(bondKey(a, b), edge);
    }
    const selectedAtoms = new Set([...atomIds].filter(id => graphAtomIds.has(id)));
    for (const [a, b] of selectedBonds.values()) { selectedAtoms.add(a); selectedAtoms.add(b); }
    if (!selectedAtoms.size && !selectedBonds.size) return;
    explanations.push({ id, text, atomIds: [...selectedAtoms], bondIds: [...selectedBonds.values()], locants });
  };

  const roots = components.filter(component => component.role === "substituent"
    && (!component.parentId || component.parentId === "parent"));
  const subtree = (root: NameComponent) => components.filter(component => {
    let current: NameComponent | undefined = component;
    const seen = new Set<string>();
    while (current) {
      if (current.id === root.id) return true;
      if (!current.parentId || seen.has(current.id)) return false;
      seen.add(current.id);
      current = componentById.get(current.parentId);
    }
    return false;
  });
  const rootData = roots.map(root => {
    const nested = subtree(root);
    const atoms = new Set(nested.flatMap(component => component.atomIds).filter(id => graphAtomIds.has(id)));
    const bonds = new Map<string, [number, number]>();
    for (const component of nested) for (const [a, b] of component.bondIds) {
      const edge = graphEdges.get(bondKey(a, b));
      if (edge) bonds.set(bondKey(a, b), edge);
    }
    const rings = (molecule.rings ?? []).filter(ring => ring.atomIds.length >= 3 && ring.atomIds.every(id => atoms.has(id)));
    const attachments = [...bonds.values()].filter(([a, b]) => mainAtoms.has(a) !== mainAtoms.has(b));
    return { root, nested, atoms, bonds, rings, attachments };
  });

  const atomById = new Map(molecule.atoms.map(atom => [atom.id, atom]));
  const carbonylCarbons = (scope: ReadonlySet<number>, carboxylicAcid: boolean) => [...scope].filter(id => {
    if (atomById.get(id)?.element !== "C") return false;
    const adjacent = molecule.bonds.filter(([a, b]) => a === id || b === id).map(([a, b, order]) => {
      const other = a === id ? b : a;
      return { atom: atomById.get(other), order: order ?? 1 };
    });
    const hasOxo = adjacent.some(edge => edge.atom?.element === "O" && edge.order === 2);
    const hasHydroxyO = adjacent.some(edge => edge.atom?.element === "O" && edge.order === 1);
    return hasOxo && (!carboxylicAcid || hasHydroxyO);
  });
  const carboxylCenters = carbonylCarbons(new Set(molecule.atoms.map(atom => atom.id)), true);
  const suffixCenters = suffix ? carbonylCarbons(new Set(suffix.atomIds), derivation.principalGroup === "carboxylicAcid") : [];
  const cyclicParent = (molecule.rings ?? []).find(ring => ring.atomIds.length >= 3 && ring.atomIds.every(id => mainAtoms.has(id)));
  const ringParent = Boolean(cyclicParent || derivation.parentSystem);
  const principalGroup = derivation.principalGroup;
  const groupName = (kind: ValidatedNameDerivation["principalGroup"]) => language === "en"
    ? ({ carboxylicAcid: "carboxylic acid", amide: "amide", ester: "ester", aldehyde: "aldehyde", ketone: "ketone", alcohol: "alcohol", heterocycle: "heterocyclic function" } as const)[kind]
    : ({ carboxylicAcid: "ácido carboxílico", amide: "amida", ester: "éster", aldehyde: "aldehído", ketone: "cetona", alcohol: "alcohol", heterocycle: "función heterocíclica" } as const)[kind];
  const allMainAtoms = [...mainAtoms];
  const parentAtomsText = parent.text;
  const mainAtomIds = allMainAtoms;
  const mainBondIds = [...mainBonds.values()];

  let parentText: string;
  if (!ringParent) {
    const cyclicSubstituent = rootData.find(data => data.rings.length > 0 && data.attachments.length > 0);
    const acidOnMain = principalGroup === "carboxylicAcid" && carboxylCenters.length === 1
      && mainAtoms.has(carboxylCenters[0]) && !cyclicParent;
    if (acidOnMain && cyclicSubstituent) {
      parentText = language === "en"
        ? `The validated parent is the acyclic structure “${parentAtomsText}”; the principal carboxylic acid occurs once in this parent. The attached ring is a separate substituent. Blue Book P-59.2.1.2 applies when the principal group occurs only in the chain; the FULL components place that group in the parent and the ring outside it.`
        : `El padre validado es la estructura acíclica «${parentAtomsText}»; el ácido carboxílico principal aparece una vez en este padre. El anillo unido es un sustituyente separado. Blue Book P-59.2.1.2 se aplica cuando la función principal aparece solo en la cadena; los componentes FULL sitúan esa función en el padre y el anillo fuera de él.`;
    } else {
      parentText = language === "en"
        ? `The validated parent component is the acyclic structure “${parentAtomsText}” and contains the principal ${groupName(principalGroup)}. The FULL proof establishes this parent for the active name; the available components do not establish a comparison with every alternative parent.`
        : `El componente padre validado es la estructura acíclica «${parentAtomsText}» y contiene la función principal (${groupName(principalGroup)}). La prueba FULL establece este padre para el nombre activo; los componentes disponibles no demuestran una comparación con todos los padres alternativos.`;
    }
  } else {
    const externalAcidCenter = principalGroup === "carboxylicAcid"
      ? suffixCenters.find(id => !cyclicParent?.atomIds.includes(id)
        && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
          && (a === id && cyclicParent?.atomIds.includes(b) || b === id && cyclicParent?.atomIds.includes(a))))
      : undefined;
    const externalAldehydeCenter = principalGroup === "aldehyde"
      ? suffixCenters.find(id => !cyclicParent?.atomIds.includes(id)
        && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
          && (a === id && cyclicParent?.atomIds.includes(b) || b === id && cyclicParent?.atomIds.includes(a))))
      : undefined;
    const externalCenter = externalAcidCenter ?? externalAldehydeCenter;
    const attachment = externalCenter === undefined ? undefined : molecule.bonds.find(([a, b, order]) => (order ?? 1) === 1
      && (a === externalCenter && cyclicParent?.atomIds.includes(b) || b === externalCenter && cyclicParent?.atomIds.includes(a)));
    const ringAtom = attachment ? (attachment[0] === externalCenter ? attachment[1] : attachment[0]) : undefined;
    const ringLocant = ringAtom === undefined ? undefined : parentNumbering.get(ringAtom);
    const retainedBenzoicParent = derivation.principalGroup === "carboxylicAcid"
      && cyclicParent?.kind === "aromatic" && cyclicParent.atomIds.length === 6
      && parent.text === "benzoic acid";
    const retainedBenzaldehydeParent = derivation.principalGroup === "aldehyde"
      && cyclicParent?.kind === "aromatic" && cyclicParent.atomIds.length === 6
      && parent.text === "benzaldehyde";
    if (externalCenter !== undefined && ringLocant !== undefined && principalGroup === "carboxylicAcid" && cyclicParent?.kind === "cycloalkane") {
      parentText = language === "en"
        ? `The validated parent is the cyclic structure “${parentAtomsText}”. The carbon of the attached –COOH group is exocyclic and is not a ring locant; it attaches at ring C${ringLocant}. Blue Book P-65.1.2.2.2 gives the cyclic-parent carboxylic-acid form.`
        : `El padre validado es la estructura cíclica «${parentAtomsText}». El carbono del grupo –COOH unido queda fuera del anillo y no es un localizador del anillo; el grupo se une por C${ringLocant}. Blue Book P-65.1.2.2.2 establece la forma de ácido carboxílico con padre cíclico.`;
    } else if (externalCenter !== undefined && ringLocant !== undefined && principalGroup === "aldehyde") {
      parentText = !retainedBenzaldehydeParent ? language === "en"
        ? `The validated parent is the cyclic structure “${parentAtomsText}”. The carbon of the attached –CHO group remains outside ring numbering and attaches at ring C${ringLocant}; Blue Book P-66.6.1.1.3 covers this cyclic aldehyde form.`
        : `El padre validado es la estructura cíclica «${parentAtomsText}». El carbono del grupo –CHO unido queda fuera de la numeración del anillo y se conecta en C${ringLocant}; Blue Book P-66.6.1.1.3 corresponde a esta forma de aldehído cíclico.`
        : language === "en"
          ? `The FULL name retains benzaldehyde as the cyclic parent. The aldehyde carbon remains outside the ring and is not assigned a ring locant; it is attached at C${ringLocant}.`
          : `El nombre FULL conserva benzaldehído como padre cíclico. El carbono del aldehído queda fuera del anillo y no recibe un localizador anular; el grupo se une por C${ringLocant}.`;
    } else if (retainedBenzoicParent && externalCenter !== undefined && ringLocant !== undefined) {
      parentText = language === "en"
        ? `The FULL name retains the validated benzoic-acid parent “${parentAtomsText}”. The carboxyl carbon is outside the aromatic ring and is not assigned a ring locant; ring C${ringLocant} bears the carboxyl group. The carbonyl in the independent substituent component is distinct from the principal carboxyl carbonyl.`
        : `El nombre FULL conserva el padre validado de ácido benzoico «${parentAtomsText}». El carbono carboxílico queda fuera del anillo aromático y no recibe un localizador del anillo; el carboxilo se une por C${ringLocant}. El carbonilo del componente sustituyente pertenece a ese fragmento y es distinto del carbonilo carboxílico principal.`;
    } else {
      parentText = language === "en"
        ? `The validated parent component “${parentAtomsText}” contains the cyclic parent structure and the principal ${groupName(principalGroup)}. The FULL proof establishes this parent for the active name; it does not by itself demonstrate comparisons with every alternative parent.`
        : `El componente padre validado «${parentAtomsText}» contiene la estructura cíclica principal y la función (${groupName(principalGroup)}). La prueba FULL establece este padre para el nombre activo, pero no demuestra por sí sola comparaciones con todos los padres alternativos.`;
    }
  }
  explanation("full-parent-selection", parentText, mainAtomIds, mainBondIds, parent.numbering);

  for (const data of rootData) {
    if (data.attachments.length !== 1) continue;
    const [attachmentA, attachmentB] = data.attachments[0];
    const mainEndpoint = mainAtoms.has(attachmentA) ? attachmentA : attachmentB;
    const substituentEndpoint = mainAtoms.has(attachmentA) ? attachmentB : attachmentA;
    const parentLocant = atomById.get(mainEndpoint)?.element === "N" ? "N" : parentNumbering.get(mainEndpoint);
    const attachedThroughNitrogen = derivation.principalGroup === "amide" && atomById.get(mainEndpoint)?.element === "N";
    const linkerElement = atomById.get(substituentEndpoint)?.element;
    const nested = data.nested.filter(component => component.id !== data.root.id && component.role === "prefix");
    const nestedText = nested.map(component => {
      const ringLocant = component.locant;
      return language === "en"
        ? `nested “${component.text}” at ring ${ringLocant === undefined ? "position shown in its component" : `C${ringLocant}`}`
        : `«${component.text}» subordinado en ${ringLocant === undefined ? "la posición indicada por su componente" : `C${ringLocant} del anillo`}`;
    });
    const attachmentText = parentLocant === undefined ? "the validated attachment point"
      : linkerElement && linkerElement !== "C" ? `${linkerElement} at parent locant ${parentLocant}` : `parent locant ${parentLocant}`;
    const attachmentTextEs = parentLocant === undefined ? "el punto de unión validado"
      : linkerElement && linkerElement !== "C" ? `${linkerElement} en el localizador ${parentLocant} del padre` : `el localizador ${parentLocant} del padre`;
    const text = language === "en"
      ? `Substituent “${data.root.text}” ${attachedThroughNitrogen ? "attaches through amide N" : `attaches at ${attachmentText}`}${data.rings.length ? "; its own ring numbering starts at its attachment atom" : ""}${nestedText.length ? `; it contains ${nestedText.join(" and ")}, whose locants belong to the substituent, not the parent. Blue Book P-59.2.1.8 addresses substituted substituents` : ""}.`
      : `El sustituyente «${data.root.text}» ${attachedThroughNitrogen ? "se une por el N amídico" : `se une en ${attachmentTextEs}`}${data.rings.length ? "; su numeración anular propia comienza en el átomo de unión" : ""}${nestedText.length ? `; contiene ${nestedText.join(" y ")}, cuyos localizadores pertenecen al sustituyente y no al padre. Blue Book P-59.2.1.8 trata los sustituyentes que a su vez están sustituidos` : ""}.`;
    if (attachedThroughNitrogen) {
      const sentence = language === "en"
        ? `Here the amide nitrogen is part of the parent; the N-locant marks substitution on nitrogen rather than direct attachment to an acetamide carbon. Blue Book P-66.1.1.3.1.1 covers this N-substitution.`
        : `En este caso, el nitrógeno amídico forma parte del padre; el localizador N indica sustitución sobre el nitrógeno y no unión directa a un carbono de la acetamida. Blue Book P-66.1.1.3.1.1 cubre esta sustitución en N.`;
      explanation("full-amide-n-substitution", `${sentence} ${text}`, data.atoms, data.bonds.values(), data.root.numbering);
    } else {
      explanation(`full-substituent-${data.root.id}`, text, data.atoms, data.bonds.values(), data.root.numbering);
    }
  }

  return explanations;
}
