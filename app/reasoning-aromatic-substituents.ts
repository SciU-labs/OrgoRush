import type { AppLanguage } from "./i18n.ts";
import { uiText } from "./i18n.ts";
import { translateSpanishIupacForDisplay } from "./iupac-name-normalization.ts";
import type { FunctionalReasoningAnalysis } from "./reasoning-functional-groups.ts";
import type { GeneratedMolecule } from "./name-to-molecule.ts";

type AromaticReasoningMolecule = {
  rings?: readonly { kind: string; atomIds: readonly number[] }[];
  bonds: readonly Readonly<GeneratedMolecule["bonds"][number]>[];
};

/** Use the chosen chain and the engine's ring atom provenance, never name substrings. */
export function aromaticFunctionalChainReasoning(
  molecule: AromaticReasoningMolecule,
  analysis: FunctionalReasoningAnalysis,
  language: AppLanguage,
) {
  if (analysis.family !== "acyclic" || !analysis.primaryFunctionalGroup || !analysis.mainChain.length) return;
  const primary = analysis.functionalGroups.find((group) => group.kind === analysis.primaryFunctionalGroup);
  if (!primary || !analysis.mainChain.includes(primary.carbonId)) return;
  const phenyl = analysis.substituents.filter((substituent) => !substituent.complex
    && substituent.name === "fenil" && substituent.atomIds?.length === 6
    && molecule.rings?.some((ring) => ring.kind === "aromatic" && ring.atomIds.length === 6
      && ring.atomIds.every((id) => substituent.atomIds!.includes(id))
      && ring.atomIds.every((id) => !analysis.mainChain.includes(id)))
    && molecule.bonds.some(([a, b, order]) => (order ?? 1) === 1
      && (a === analysis.mainChain[substituent.locant - 1] && substituent.atomIds!.includes(b)
        || b === analysis.mainChain[substituent.locant - 1] && substituent.atomIds!.includes(a))));
  const methylphenyl = analysis.substituents.find((substituent) => substituent.aryl
    && substituent.atomIds?.length === 7 && substituent.aryl.atomIds.every((id) => substituent.atomIds!.includes(id)));
  if (!phenyl.length && !methylphenyl) return;
  const count = analysis.mainChain.length;
  const group = uiText(language, primary.label ?? "Grupo funcional principal").toLocaleLowerCase(language);
  const parent = language === "en" ? translateSpanishIupacForDisplay(analysis.chainName) : analysis.chainName;
  // –NH2 is specific to a primary amine; secondary/tertiary amines keep their
  // existing amino-group wording rather than acquiring an incorrect motif.
  const nitrogen = primary.atomIds?.find((id) => id !== primary.carbonId);
  const primaryAmine = primary.kind === "amine" && nitrogen !== undefined
    && molecule.bonds.filter(([a, b]) => a === nitrogen || b === nitrogen).length === 1;
  if (methylphenyl?.aryl) {
    const aryl = methylphenyl.aryl;
    const arylName = language === "en" ? `${aryl.methyl.locant}-methylphenyl` : `${aryl.methyl.locant}-metilfenil`;
    return language === "en" ? {
      parent: `The parent is the ${count}-carbon chain containing the principal ${group} function; its base name is ${parent}. The aromatic ring and its methyl carbon belong to the substituted aryl group.`,
      substituent: `The ring attachment to chain C${methylphenyl.locant} is ring C1. Its methyl is at ring C${aryl.methyl.locant}, giving “${arylName}”. Ring locants are independent of the alcohol-chain numbering. The aryl fragment contains all six ring carbons and its methyl carbon.`,
      function: "",
    } : {
      parent: `El padre es la cadena de ${count} carbonos que contiene la función principal ${group}; su nombre base es ${parent}. El anillo aromático y el carbono de su metilo pertenecen al grupo arilo sustituido.`,
      substituent: `El carbono de unión del anillo a C${methylphenyl.locant} de la cadena es C1 del anillo. Su metilo está en C${aryl.methyl.locant} del anillo y aporta «${arylName}». Los localizadores del anillo son independientes de la numeración de la cadena del alcohol. El fragmento arilo contiene los seis carbonos del anillo y el carbono de su metilo.`,
      function: "",
    };
  }
  return language === "en" ? {
    parent: `The parent is the ${count}-carbon chain containing the principal ${group} function; its base name is ${parent}. The six benzene-ring carbons belong to the phenyl substituent.`,
    substituent: "Replacing one hydrogen of a benzene ring with its bond to the parent gives the aryl substituent “phenyl”. Its ring atoms are separate from the functional parent chain.",
    function: primaryAmine ? "The principal amino group is –NH₂, attached to the parent chain." : "",
  } : {
    parent: `El padre es la cadena de ${count} ${count === 1 ? "carbono" : "carbonos"} que contiene la función principal ${group}; su nombre base es ${parent}. Los seis carbonos del anillo bencénico pertenecen al sustituyente fenil.`,
    substituent: "Al sustituir un hidrógeno de un anillo bencénico por su enlace con el padre, se obtiene el sustituyente arilo «fenil». Sus átomos de anillo son independientes de la cadena padre funcional.",
    function: primaryAmine ? "El grupo amino principal es –NH₂, unido a la cadena padre." : "",
  };
}
