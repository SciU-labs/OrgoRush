import type { GeneratedMolecule } from "./name-to-molecule.ts";

export type SteroidFamilyEvidence = "gonane" | "estrane" | "androstane" | "pregnane";
export type SteroidDecisionKind = "parent-recognition" | "conventional-numbering" | "side-chain-recognition"
  | "unsaturation" | "principal-functional-group" | "subordinate-functional-group"
  | "functional-multiplicity" | "stereochemical-orientation" | "name-assembly";
export type SteroidFunctionEvidence = {
  kind: "ketone" | "hydroxyl";
  locant: number;
  atomIds: number[];
  bondIds: [number, number][];
};
export type SteroidDecision = {
  id: string;
  kind: SteroidDecisionKind;
  evidence: { atomIds: number[]; bondIds: [number, number][]; locants: number[] };
  rule: string;
  result: string;
  explanation: { en: string; es: string };
  why?: { en: string; es: string };
  nameFragments: string[];
  dependsOn: string[];
  verification: "verified";
};
export type SteroidPedagogicalEvidence = {
  verification: "complete-graph-isomorphism";
  family: SteroidFamilyEvidence;
  graph: GeneratedMolecule;
  locants: Record<string, number>;
  rings: { id: string; atomIds: number[]; bondIds: [number, number][] }[];
  fusions: { id: string; atomIds: number[]; bondIds: [number, number][] }[];
  angularMethyls: { C18: number; C19?: number };
  sideChain?: { atomIds: number[]; bondIds: [number, number][] };
  unsaturations: { locant: number; atomIds: number[]; bondIds: [number, number][] }[];
  functions: SteroidFunctionEvidence[];
  stereo: { atomIds: number[]; bondIds: [number, number][]; reference: string; descriptors: string[] };
  betaOrientation?: { locant: number; atomId: number; bondId: [number, number]; referenceLabel: string };
  name: string;
  commonName: { en: string; es: string };
};

const edge = (a: number, b: number): [number, number] => a < b ? [a, b] : [b, a];
const familyLabel = (family: SteroidFamilyEvidence, language: "en" | "es") => ({
  gonane: language === "en" ? "gonane" : "gonano",
  estrane: language === "en" ? "estrane" : "estrano",
  androstane: language === "en" ? "androstane" : "androstano",
  pregnane: language === "en" ? "pregnane" : "pregnano",
}[family]);

/** Converts already verified structural facts into bounded, bilingual rules.
 * Missing evidence omits a decision; this function never establishes FULL. */
export function deriveSteroidPedagogicalDecisions(evidence: SteroidPedagogicalEvidence): SteroidDecision[] {
  if (evidence.verification !== "complete-graph-isomorphism") return [];
  const graphIds = new Set(evidence.graph.atoms.map(atom => atom.id));
  const validAtoms = (ids: number[]) => ids.length > 0 && ids.every(id => graphIds.has(id));
  const validBonds = (bonds: [number, number][]) => bonds.every(([a, b]) => graphIds.has(a) && graphIds.has(b)
    && evidence.graph.bonds.some(([x, y]) => (x === a && y === b) || (x === b && y === a)));
  const add = (decision: Omit<SteroidDecision, "verification">) => ({ ...decision, verification: "verified" as const });
  const core = Array.from({ length: 17 }, (_, index) => evidence.locants[String(index + 1)]).filter((id): id is number => id !== undefined);
  const decisions: SteroidDecision[] = [];
  const rings = evidence.rings.filter(ring => validAtoms(ring.atomIds) && validBonds(ring.bondIds));
  const fusions = evidence.fusions.filter(fusion => validAtoms(fusion.atomIds) && validBonds(fusion.bondIds));
  if (core.length === 17 && rings.length === 4 && fusions.length === 3) {
    const carbonCount = evidence.graph.atoms.filter(atom => (atom.element ?? "C") === "C").length;
    const methyls = [evidence.angularMethyls.C18, evidence.angularMethyls.C19].filter((id): id is number => id !== undefined);
    const skeletonText = evidence.family === "androstane" && evidence.locants["18"] && evidence.locants["19"]
      ? "The four fused rings have the 6–6–6–5 pattern, and the C1–C17 core contains 17 carbons: together these identify the gonane skeleton, without angular methyls at C10 or C13. The angular methyl C18 at C13 gives the 18-carbon estrane pattern; adding C19 at C10 identifies the 19-carbon androstane skeleton, whose stem is androst-. The ring pattern alone would not distinguish these steroid skeletons."
      : evidence.family === "pregnane"
      ? `The 17-carbon 6–6–6–5 core has angular methyls at C13/C18 and C10/C19, plus the verified C17 side chain; together they define the 21-carbon pregnane framework.`
      : `The 17-carbon 6–6–6–5 core and its mapped external groups identify the ${familyLabel(evidence.family, "en")} framework; ring sizes alone do not determine the family.`;
    const skeletonTextEs = evidence.family === "androstane" && evidence.locants["18"] && evidence.locants["19"]
      ? "Los cuatro anillos fusionados siguen el patrón 6–6–6–5 y el núcleo C1–C17 contiene 17 carbonos: en conjunto corresponden al esqueleto del gonano, sin metilos angulares en C10 ni C13. El metilo angular C18 en C13 da el patrón de 18 carbonos del estrano; al añadir C19 en C10 se identifica el esqueleto de 19 carbonos del androstano, del que procede el tema androst-. El patrón de anillos por sí solo no distingue estos esqueletos esteroideos."
      : evidence.family === "pregnane"
      ? "El núcleo 6–6–6–5 de 17 carbonos tiene metilos angulares C18/C13 y C19/C10 y la cadena lateral verificada en C17; en conjunto definen el esqueleto de 21 carbonos del pregnano."
      : `El núcleo 6–6–6–5 de 17 carbonos y sus grupos externos mapeados identifican el esqueleto de ${familyLabel(evidence.family, "es")}; el tamaño de los anillos por sí solo no determina la familia.`;
    decisions.push(add({ id: "steroid.parent", kind: "parent-recognition",
      evidence: { atomIds: [...core, ...methyls, ...(evidence.sideChain?.atomIds ?? []), ...rings.flatMap(r => r.atomIds)],
        bondIds: [...rings.flatMap(r => r.bondIds), ...fusions.flatMap(f => f.bondIds), ...(evidence.sideChain?.bondIds ?? [])], locants: [1, 17, 18, ...(evidence.angularMethyls.C19 ? [19] : []), ...(evidence.family === "pregnane" ? [20, 21] : [])] },
      rule: "steroid-skeleton-family", result: familyLabel(evidence.family, "en"), explanation: { en: skeletonText, es: skeletonTextEs },
      nameFragments: [evidence.name], dependsOn: [] }));
  }
  const numbered = Object.entries(evidence.locants).filter(([, id]) => graphIds.has(id)).map(([locant, id]) => [Number(locant), id] as const);
  if (numbered.length >= 17) decisions.push(add({ id: "steroid.numbering", kind: "conventional-numbering",
    evidence: { atomIds: numbered.map(([, id]) => id), bondIds: [], locants: numbered.map(([locant]) => locant) },
    rule: "conventional-steroid-numbering", result: `C1–C${numbered.length}`,
    explanation: { en: evidence.family === "androstane" && hydroxylAt(17, evidence.functions)
      ? "Steroids use a conventional numbering of the skeleton: C1–C17 form the core, C18 is the methyl attached to C13, and C19 is the methyl attached to C10. The hydroxyl is at C17 because its oxygen is bonded to the atom mapped to C17; functional groups do not renumber this skeleton."
      : evidence.sideChain ? "Conventional steroid locants are assigned by graph connectivity. C20 and C21 follow the C17 side chain; neither atom order nor drawing coordinates determine their numbers."
      : `The four fused rings fix C1–C17. C18 is the methyl attached to C13.${evidence.angularMethyls.C19 !== undefined ? " The methyl attached to C10 is C19." : ""}`,
      es: evidence.family === "androstane" && hydroxylAt(17, evidence.functions)
        ? "Los esteroides usan una numeración convencional del esqueleto: C1–C17 forman el núcleo, C18 es el metilo unido a C13 y C19 el unido a C10. El hidroxilo está en C17 porque su oxígeno se enlaza al átomo asignado a C17; los grupos funcionales no renumeran este esqueleto."
        : evidence.sideChain ? "Los localizadores esteroideos convencionales se asignan según la conectividad del grafo. C20 y C21 siguen la cadena unida a C17; ni el orden de los átomos ni las coordenadas del dibujo determinan sus números."
        : `Los cuatro anillos fusionados fijan C1–C17. C18 es el metilo unido a C13.${evidence.angularMethyls.C19 !== undefined ? " El metilo unido a C10 es C19." : ""}` },
    nameFragments: [evidence.name], dependsOn: ["steroid.parent"] }));
  if (evidence.family === "pregnane" && evidence.sideChain && validAtoms(evidence.sideChain.atomIds) && validBonds(evidence.sideChain.bondIds))
    decisions.push(add({ id: "steroid.side-chain", kind: "side-chain-recognition",
      evidence: { atomIds: evidence.sideChain.atomIds, bondIds: evidence.sideChain.bondIds, locants: [17, 20, 21] },
      rule: "pregnane-c17-side-chain", result: "C20–C21 side chain", explanation: {
        en: "The two-carbon chain is attached to mapped C17 and is part of the pregnane parent framework; its atoms are assigned C20 then C21 from the attachment point.",
        es: "La cadena de dos carbonos se une al C17 mapeado y forma parte del esqueleto parental pregnano; sus átomos reciben C20 y después C21 desde el punto de unión." },
      nameFragments: [evidence.name], dependsOn: ["steroid.numbering"] }));
  const unsaturations = evidence.unsaturations.filter(item => validAtoms(item.atomIds) && validBonds(item.bondIds));
  for (const unsaturation of unsaturations) decisions.push(add({ id: `steroid.unsaturation.${unsaturation.locant}`, kind: "unsaturation",
    evidence: { atomIds: unsaturation.atomIds, bondIds: unsaturation.bondIds, locants: [unsaturation.locant, unsaturation.locant + 1] },
    rule: "lowest-locant-end-of-double-bond", result: String(unsaturation.locant),
    explanation: { en: evidence.family === "androstane" && unsaturation.locant === 4
      ? "The double bond joins C4 and C5. Its locant is 4, the lower-numbered end of the bond, so the unsaturation is written -4-en- in androst-4-en-. C5 is trigonal here and has no tetrahedral 5α/5β descriptor."
      : evidence.family === "pregnane" && unsaturation.locant === 4
      ? "The verified double bond joins C4 and C5, so 4 is its locant: the lower-numbered endpoint. In this validated pregnane name, that feature appears as -4-ene- before the functional-group locants; C5 is trigonal and is not assigned a tetrahedral α/β descriptor."
      : `The double bond joins C${unsaturation.locant} and C${unsaturation.locant + 1}; its locant is the lower-numbered end.`,
      es: evidence.family === "androstane" && unsaturation.locant === 4
        ? "El doble enlace une C4 y C5. Su localizador es 4, el extremo de menor número, por lo que la insaturación se expresa como -4-en- en androst-4-en-. En esta estructura C5 es trigonal y no lleva descriptor tetraédrico 5α/5β."
        : evidence.family === "pregnane" && unsaturation.locant === 4
        ? "El doble enlace verificado une C4 y C5, por lo que su localizador es 4: el extremo con menor número. En este nombre pregnano validado, esa característica aparece como -4-eno- antes de los localizadores funcionales; C5 es trigonal y no recibe un descriptor tetraédrico α/β."
        : `El doble enlace une C${unsaturation.locant} y C${unsaturation.locant + 1}; su localizador es el extremo con el número menor.` },
    nameFragments: [evidence.name], dependsOn: ["steroid.numbering"] }));
  const functions = evidence.functions.filter(item => item.locant > 0 && validAtoms(item.atomIds) && validBonds(item.bondIds));
  const ketones = functions.filter(item => item.kind === "ketone"), hydroxyls = functions.filter(item => item.kind === "hydroxyl");
  if (ketones.length) decisions.push(add({ id: "steroid.principal-function", kind: "principal-functional-group",
    evidence: { atomIds: ketones.flatMap(item => item.atomIds), bondIds: ketones.flatMap(item => item.bondIds), locants: ketones.map(item => item.locant) },
    rule: "steroid-ketone-suffix", result: ketones.length > 1 ? "dione" : "one",
    explanation: { en: ketones.length === 1 && hydroxylAt(17, evidence.functions) && ketones[0]!.locant === 3
      ? "C3 bears a ketone (C=O), and C17 bears a hydroxyl (–OH). For this combination of steroid functions, the ketone takes the suffix -3-one and the alcohol is named with the prefix 17-hydroxy-. The C4=C5 unsaturation is indicated separately by -4-en-; it does not displace the ketone suffix."
      : ketones.length > 1
      ? `Ketones occur at C${ketones.map(item => item.locant).join(" and C")}; the multiplicative suffix di- records two ketone groups as -${ketones.map(item => item.locant).join(",")}-dione.`
      : `The ketone at C${ketones[0]!.locant} supplies the suffix -${ketones[0]!.locant}-one.`,
      es: ketones.length === 1 && hydroxylAt(17, evidence.functions) && ketones[0]!.locant === 3
        ? "C3 lleva una cetona (C=O) y C17 un hidroxilo (–OH). En esta combinación de funciones esteroideas, la cetona aporta el sufijo -3-ona y el alcohol se nombra con el prefijo 17-hidroxi-. La insaturación C4=C5 se indica aparte con -4-en-; no desplaza el sufijo de cetona."
        : ketones.length > 1
        ? `Hay cetonas en C${ketones.map(item => item.locant).join(" y C")}; el prefijo multiplicativo di- expresa las dos funciones como -${ketones.map(item => item.locant).join(",")}-diona.`
        : `La cetona de C${ketones[0]!.locant} aporta el sufijo -${ketones[0]!.locant}-ona.` },
    nameFragments: [evidence.name], dependsOn: ["steroid.numbering"] }));
  if (hydroxyls.length) decisions.push(add({ id: "steroid.hydroxyls", kind: ketones.length ? "subordinate-functional-group" : "principal-functional-group",
    evidence: { atomIds: hydroxyls.flatMap(item => item.atomIds), bondIds: hydroxyls.flatMap(item => item.bondIds), locants: hydroxyls.map(item => item.locant) },
    rule: ketones.length ? "hydroxyl-prefix-when-ketone-suffix-selected" : "alcohol-suffix-multiplicity",
    result: ketones.length ? "hydroxy prefix" : hydroxyls.length > 1 ? "diol" : "ol",
    explanation: { en: ketones.length ? `The hydroxyl group${hydroxyls.length > 1 ? "s" : ""} at ${hydroxyls.map(item => `C${item.locant}`).join(" and ")} is cited with hydroxy- because the ketone suffix has higher priority in this supported combination.`
      : `The ${hydroxyls.length > 1 ? "two hydroxyl groups use the multiplicative suffix diol" : `hydroxyl at C${hydroxyls[0]!.locant} supplies the alcohol suffix`}.`,
      es: ketones.length ? `El grupo${hydroxyls.length > 1 ? "s" : ""} hidroxilo en ${hydroxyls.map(item => `C${item.locant}`).join(" y ")} se cita con el prefijo hidroxi- porque, en esta combinación soportada, la cetona tiene prioridad para el sufijo.`
      : hydroxyls.length > 1 ? "Los dos grupos hidroxilo se expresan mediante el sufijo multiplicativo diol." : `El hidroxilo de C${hydroxyls[0]!.locant} aporta el sufijo de alcohol.` },
    nameFragments: [evidence.name], dependsOn: ["steroid.numbering", ...(ketones.length ? ["steroid.principal-function"] : [])] }));
  if (evidence.stereo.descriptors.length && validAtoms(evidence.stereo.atomIds)) decisions.push(add({ id: "steroid.stereochemistry", kind: "stereochemical-orientation",
    evidence: { atomIds: [...evidence.stereo.atomIds, ...(evidence.betaOrientation ? [evidence.betaOrientation.atomId] : [])],
      bondIds: [...evidence.stereo.bondIds, ...(evidence.betaOrientation ? [evidence.betaOrientation.bondId] : [])],
      locants: evidence.betaOrientation ? [evidence.betaOrientation.locant] : [] },
    rule: "audited-global-steroid-reference", result: evidence.stereo.reference,
    explanation: { en: evidence.betaOrientation?.locant === 17
      ? `In the conventional steroid projection, β is the face assigned to groups above the reference plane and α to the opposite face. The graph's C17 tetrahedral configuration matches the independently audited ${evidence.betaOrientation.referenceLabel} reference (${evidence.stereo.descriptors.join(", ")}); that reference places the C17 substituent on the β face. This is not inferred from a rotated 2D drawing or equated with R/S.`
      : `The mapped stereogenic atoms match the complete audited reference (${evidence.stereo.descriptors.join(", ")}). Reference-based α/β notation is not inferred from the 2D drawing or equated universally with R/S.`,
      es: evidence.betaOrientation?.locant === 17
        ? `En la proyección esteroidea convencional, β designa la cara situada sobre el plano de referencia y α la cara opuesta. La configuración tetraédrica C17 del grafo coincide con la referencia auditada independiente de ${evidence.betaOrientation.referenceLabel} (${evidence.stereo.descriptors.join(", ")}); esa referencia sitúa el sustituyente de C17 en la cara β. No se deduce de un dibujo 2D rotado ni se equipara con R/S.`
        : `Los átomos estereogénicos mapeados coinciden con la referencia auditada completa (${evidence.stereo.descriptors.join(", ")}). La notación α/β basada en la referencia no se infiere del dibujo 2D ni se equipara universalmente con R/S.` },
    nameFragments: [evidence.name], dependsOn: ["steroid.parent", "steroid.numbering"] }));
  decisions.push(add({ id: "steroid.name-assembly", kind: "name-assembly",
    evidence: { atomIds: [], bondIds: [], locants: [] }, rule: "validated-name-grammar", result: evidence.name,
    explanation: { en: evidence.family === "androstane" && hydroxylAt(17, evidence.functions)
      ? `Assemble the validated hydroxyl prefix, androstane stem, unsaturation, and ketone suffix in that order. The common name is ${evidence.commonName.en}.`
      : evidence.family === "pregnane" && ketones.length > 1
      ? `The validated spelling combines the pregnane stem, the mapped C${unsaturations.map(item => item.locant).join(",")} unsaturation, and the ketone suffix at C${ketones.map(item => item.locant).join(" and C")}. The two ketones therefore appear as the multiplicative dione ending, yielding “${evidence.name}”. The independently verified common name is ${evidence.commonName.en}; it is not being parsed as a literal source for this systematic form.`
      : `The displayed semisystematic name is assembled by the validated steroid grammar. The common name is ${evidence.commonName.en}; this does not assert that the semisystematic form is a 2013 PIN.`,
      es: evidence.family === "androstane" && hydroxylAt(17, evidence.functions)
        ? `Se ensamblan, en ese orden, el prefijo hidroxilo, el tema androstano, la insaturación y el sufijo de cetona. El nombre común es ${evidence.commonName.es}.`
        : evidence.family === "pregnane" && ketones.length > 1
        ? `La forma validada combina el tema pregnano, la insaturación mapeada en C${unsaturations.map(item => item.locant).join(",")} y el sufijo de cetona en C${ketones.map(item => item.locant).join(" y C")}. Por eso las dos cetonas aparecen con la terminación multiplicativa diona y se obtiene «${evidence.name}». El nombre común verificado de forma independiente es ${evidence.commonName.es}; no se presenta como fuente literal de esta forma sistemática.`
        : `El nombre semisistemático mostrado se ensambla con la gramática esteroidea validada. El nombre común es ${evidence.commonName.es}; esto no afirma que la forma semisistemática sea un PIN de 2013.` },
    nameFragments: [evidence.name], dependsOn: decisions.map(item => item.id) }));
  return decisions.map(item => ({ ...item, why: steroidDecisionRationale(item, evidence) }));
}

function hydroxylAt(locant: number, functions: SteroidFunctionEvidence[]) {
  return functions.some(item => item.kind === "hydroxyl" && item.locant === locant);
}

function steroidDecisionRationale(decision: SteroidDecision, evidence: SteroidPedagogicalEvidence) {
  switch (decision.kind) {
    case "parent-recognition": return { en: "The steroid family is determined from the mapped 17-carbon fused core, angular-methyl positions, and any verified C17 side chain; ring count alone is not sufficient.",
      es: "La familia esteroidea se determina a partir del núcleo fusionado mapeado de 17 carbonos, las posiciones de los metilos angulares y, si existe, la cadena C17 verificada; el número de anillos por sí solo no basta." };
    case "conventional-numbering": return { en: "The locants follow the conventional steroid map matched to graph connectivity. Atom ordering and canvas coordinates do not assign locants.",
      es: "Los localizadores siguen el mapa esteroideo convencional ajustado a la conectividad del grafo. El orden de los átomos y las coordenadas del canvas no asignan localizadores." };
    case "side-chain-recognition": return { en: "The chain begins at the carbon attached to mapped C17; the next carbon is numbered from that attachment and its carbonyl does not move the parent numbering origin.",
      es: "La cadena empieza en el carbono unido al C17 mapeado; el siguiente carbono se numera desde ese punto de unión y su carbonilo no desplaza el origen de numeración del padre." };
    case "unsaturation": return { en: "A double-bond locant identifies the lower-numbered endpoint. An sp² carbon in the double bond is not assigned a tetrahedral configuration.",
      es: "El localizador de un doble enlace identifica su extremo con menor número. Un carbono sp² del doble enlace no recibe configuración tetraédrica." };
    case "principal-functional-group": return { en: decision.result === "dione"
      ? "The multiplier counts two distinct carbonyl groups at the mapped locants; both remain part of the same suffix family."
      : "The suffix follows the verified characteristic group and its locants; only supported functional-group priority rules are applied.",
      es: decision.result === "dione"
        ? "El multiplicador cuenta dos grupos carbonilo distintos en los localizadores mapeados; ambos pertenecen a la misma familia de sufijo."
        : "El sufijo sigue al grupo característico verificado y sus localizadores; solo se aplican reglas de prioridad funcional con soporte.", };
    case "subordinate-functional-group": return { en: "A group named as a prefix remains at its mapped locant while the higher-priority suffix determines the parent ending.",
      es: "El grupo citado como prefijo conserva su localizador mapeado mientras el sufijo de mayor prioridad determina la terminación del padre." };
    case "stereochemical-orientation": return { en: "The comparison uses all specified centers against a complete reference. Steroid α/β face labels are not inferred from the drawing and are not universal synonyms for CIP R/S.",
      es: "La comparación usa todos los centros especificados frente a una referencia completa. Las etiquetas esteroideas α/β no se infieren del dibujo ni son sinónimos universales de R/S CIP." };
    case "name-assembly": return { en: `The complete spelling comes from the verified name grammar for ${familyLabel(evidence.family,"en")}; the semisystematic form is not automatically described as a PIN.`,
      es: `La forma completa procede de la gramática verificada para ${familyLabel(evidence.family,"es")}; el nombre semisistemático no se presenta automáticamente como un PIN.` };
    case "functional-multiplicity": return { en: "The multiplicative prefix counts separate groups, not a longer connected chain.", es: "El prefijo multiplicativo cuenta grupos separados, no una cadena conectada más larga." };
  }
}
