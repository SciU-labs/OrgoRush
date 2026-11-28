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

/** Explain whole-name composition only after every expected semantic unit has
 * its own exact, visible, verified decision. Coverage still enforces the same
 * dependencies independently, so this assertion cannot fill a missing unit. */
export function completeNameAssemblyDecision(derivation: ValidatedNameDerivation, inventory: PedagogicalNameInventory,
  graph: GeneratedMolecule, decisions: readonly PedagogicalDecision[], steps: readonly {explanation:string;advancedExplanation?:string;decisionIds?:string[]}[]): PedagogicalDecision | null {
  const assembly=inventory.components.find(c=>c.aspect==="assembly");
  const parent=derivation.components.find(c=>c.id==="parent");
  const suffix=derivation.components.find(c=>c.role==="suffix");
  if(!assembly || !parent || !suffix || inventory.limitations.length || inventory.name!==derivation.name
    || inventory.sourceName!==derivation.name || assembly.text!==derivation.name) return null;
  const explainedUnits=inventory.components.filter(c=>c.aspect!=="assembly");
  if(!explainedUnits.length || explainedUnits.some(component=>component.evidence!=="available")) return null;
  const used:PedagogicalDecision[]=[];
  for(const component of explainedUnits){
    const decision=decisions.find(candidate=>candidate.verification==="verified" && candidate.kind!=="name-assembly"
      && candidate.componentBindings?.some(binding=>binding.id===component.id && binding.start===component.start
        && binding.end===component.end && binding.aspect===component.aspect && binding.numberingScope===component.numberingScope)
      && steps.some(step=>(step.explanation.trim()||step.advancedExplanation?.trim()) && (step.decisionIds??[]).includes(candidate.id)));
    if(!decision) return null;
    used.push(decision);
  }
  const branches=derivation.components.filter(c=>c.role==="substituent" && c.parentId==="parent").sort((a,b)=>a.start-b.start);
  const order=[...branches.map(c=>c.text),parent.text].join(" → ");
  const nested=branches.flatMap(branch=>derivation.components.filter(c=>c.parentId===branch.id && typeof c.locant==="number")
    .map(child=>({branch,child})));
  const nestedEn=nested.map(({branch,child})=>`Within “${branch.text}”, locant ${child.locant} places “${child.text}” in that branch’s own scope.`).join(" ");
  const nestedEs=nested.map(({branch,child})=>`Dentro de «${branch.text}», el localizador ${child.locant} coloca «${child.text}» en el ámbito de esa rama.`).join(" ");
  const delimiters=inventory.syntax.some(token=>/[()[\]{}]/.test(token.text));
  const delimiterEn=delimiters?"The written brackets and parentheses preserve the recorded nested boundaries. ":"";
  const delimiterEs=delimiters?"Los corchetes y paréntesis escritos conservan los límites anidados registrados. ":"";
  return {id:"name.complete-assembly",kind:"name-assembly",family:"verified-name-composition",rule:"compose-only-fully-explained-mapped-components",
    evidenceSource:"exact component intervals, visible verified decisions, reconciled parent-child hierarchy and recorded syntax",
    atomIds:graph.atoms.map(atom=>atom.id),bondIds:graph.bonds.map(([a,b])=>[a,b]),locants:[],numberingScope:"parent",result:inventory.name,
    nameFragments:[],componentBindings:[nameComponentBinding(assembly)],dependsOn:[...new Set(used.map(decision=>decision.id))],verification:"verified",
    explanation:{en:`The parent-level parts occupy the validated written order ${order}; the functional ending ${suffix.text} stays with the suffix-bearing parent ${parent.text}. ${nestedEn} ${delimiterEn}Together, these already explained intervals form the exact active name “${inventory.name}”.`,
      es:`Las partes del nivel del padre ocupan el orden escrito validado ${order}; la terminación funcional ${suffix.text} permanece con el padre que lleva el sufijo, ${parent.text}. ${nestedEs} ${delimiterEs}En conjunto, estos intervalos ya explicados forman exactamente el nombre activo «${inventory.name}».`}};
}
