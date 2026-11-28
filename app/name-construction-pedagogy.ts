import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { PedagogicalDecision } from "./pedagogical-decision-model.ts";
import type { PedagogicalNameInventory } from "./pedagogical-name-inventory.ts";
import { nameComponentBinding } from "./pedagogical-name-inventory.ts";

/** Surface stem rules are bounded by the already reconciled parent profile. */
export function parentStemDecision(inventory: PedagogicalNameInventory, parentDecisionId: string): PedagogicalDecision | null {
  const stem = inventory.components.find(c=>c.aspect==="stem"), form = inventory.parentForm;
  if (!stem || !form || inventory.limitations.length || stem.evidence !== "available") return null;
  const suffix=inventory.components.find(c=>c.role==="suffix")?.text;
  if (!suffix) return null;
  return {id:"name.parent-stem",kind:"parent-stem",family:"validated-parent-form",
    rule:form.mode,evidenceSource:"reconciled parent profile and exact stem interval",
    atomIds:stem.atomIds,bondIds:stem.bondIds,locants:[],numberingScope:stem.numberingScope,
    result:stem.text,nameFragments:[],componentBindings:[nameComponentBinding(stem)],dependsOn:[parentDecisionId],verification:"verified",
    explanation:form.mode === "suffix-elision" ? {
      en:`The retained parent is ${form.en}. In this suffix construction its parent ending gives way to -${suffix}, leaving the written stem ${stem.text}-. The functional locant goes between that stem and -${suffix}.`,
      es:`El padre retenido es ${form.es}. En esta construcción con sufijo, la terminación del padre da paso a -${suffix} y queda el tema escrito ${stem.text}-. El localizador funcional se coloca entre ese tema y -${suffix}.`,
    } : {
      en:`The saturated parent ${form.en} supplies the stem ${stem.text}-. The verified ene unit replaces the saturated -ane ending. The characteristic suffix then follows its own locants.`,
      es:`El padre saturado ${form.es} aporta el tema ${stem.text}-. La unidad eno verificada sustituye la terminación saturada -ano. A continuación se sitúa el sufijo característico con sus propios localizadores.`,
    }};
}

/** Assemble enclosing prefixes before their suffix-bearing parent, preserving
 * each branch's internal scope. This consumes existing parent/child mappings. */
export function scopedNameAssemblyDecision(derivation: ValidatedNameDerivation, inventory: PedagogicalNameInventory,
  graph: GeneratedMolecule): PedagogicalDecision | null {
  const assembly=inventory.components.find(c=>c.aspect==="scope");
  const parent=derivation.components.find(c=>c.id==="parent");
  const branches=derivation.components.filter(c=>c.role==="substituent" && c.parentId==="parent").sort((a,b)=>a.start-b.start);
  const nested=branches.flatMap(branch=>derivation.components.filter(c=>c.parentId===branch.id && typeof c.locant==="number")
    .map(child=>({branch,child})));
  if (!parent || !assembly || inventory.limitations.length || !nested.length
    || inventory.name!==derivation.name || inventory.sourceName!==derivation.name
    || !derivation.components.some(c=>c.role==="suffix")) return null;
  const insideEn=nested.map(({branch,child})=>`Inside “${branch.text}”, locant ${child.locant} places “${child.text}” within that branch.`).join(" ");
  const insideEs=nested.map(({branch,child})=>`Dentro de «${branch.text}», el localizador ${child.locant} sitúa «${child.text}» en esa rama.`).join(" ");
  const order=[...branches,parent].sort((a,b)=>a.start-b.start).map(c=>c.text).join(" + ");
  return {id:"name.scoped-assembly",kind:"scope-composition",family:"mapped-components",rule:"enclosing-prefixes-and-suffix-bearing-parent",
    evidenceSource:"reconciled component hierarchy, attachment map and literal intervals",
    atomIds:graph.atoms.map(a=>a.id),bondIds:graph.bonds.map(([a,b])=>[a,b]),locants:[],result:inventory.name,
    nameFragments:[],componentBindings:[nameComponentBinding(assembly)],dependsOn:[],verification:"verified",
    explanation:{
      en:`The suffix-bearing parent is “${parent.text}”. Each enclosing branch is cited as one prefix at the parent level. ${insideEn} The outer written units assemble in the order ${order}.`,
      es:`La estructura que lleva el sufijo es «${parent.text}». Cada rama envolvente se cita como un único prefijo en el nivel del padre. ${insideEs} Las unidades externas se ensamblan en el orden ${order}.`,
    }};
}
