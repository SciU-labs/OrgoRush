import type { AppLanguage } from "./i18n.ts";
import type { PedagogicalDecision } from "./pedagogical-decision-model.ts";
import type { PedagogicalNameInventory } from "./pedagogical-name-inventory.ts";
import { nameComponentBinding } from "./pedagogical-name-inventory.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { PriorityReasoningStep } from "./reasoning-derivation-adapter.ts";

/** Lift existing visible component explanations into explicit provenance.
 * A numeric control alone supplies no identity explanation. */
export function presentedComponentDecisions(derivation: ValidatedNameDerivation, inventory: PedagogicalNameInventory,
  steps: PriorityReasoningStep[], language: AppLanguage, graph?: import("./name-to-molecule.ts").GeneratedMolecule): PedagogicalDecision[] {
  const decisions: PedagogicalDecision[] = [];
  const numberingTitle = language === "en" ? "Numbering" : "Numeración";
  for (const component of derivation.components) {
    const step = steps.find(s=>s.componentIds.includes(component.id) && !s.alphabeticalOrder && s.title !== numberingTitle);
    if (!step?.explanation.trim()) continue;
    const entry = inventory.components.find(c=>c.id===component.id && c.aspect==="identity");
    const id = "component."+component.id;
    decisions.push({id,kind:component.role === "parent" ? "parent-selection"
      : component.role === "suffix" ? "functional-priority" : "substituent-recognition",
      family:"mapped-components",rule:"presented-reconciled-component",evidenceSource:"reconciled component and visible semantic step",
      atomIds:component.atomIds,bondIds:component.bondIds,locants:component.numbering.map(([,n])=>n),
      numberingScope:entry?.numberingScope ?? "parent",result:component.text,
      explanation:{en:language==="en"?step.explanation:"",es:language==="es"?step.explanation:""},
      nameFragments:[],componentBindings:entry?[nameComponentBinding(entry)]:[],dependsOn:[],verification:"verified"});
    (step.decisionIds ??= []).push(id);
  }
  // Heteroatom locants are justified from both the functional nitrogen and
  // each verified N–substituent bond. The nitrogen is not borrowed from an
  // unrelated heterocycle or inferred from the written letter alone.
  const nGroups = derivation.components.filter(c=>c.locant==="N" && c.role==="substituent" && (c.parentId ?? "parent")==="parent");
  const suffix = derivation.components.find(c=>c.role==="suffix");
  const parent = derivation.components.find(c=>c.id==="parent");
  const graphNitrogen = graph && suffix && parent ? suffix.atomIds.find(id=>graph.atoms.find(atom=>atom.id===id)?.element==="N"
    && !parent.numbering.some(([mapped])=>mapped===id)) : undefined;
  if (nGroups.length && graphNitrogen !== undefined && inventory.components.some(c=>c.id==="suffix")) {
    const expected = nGroups.flatMap(group=>inventory.components.filter(c=>(c.id===group.id+".locants" || c.id===group.id+".attachment-locant")
      && c.numberingScope==="parent" && c.locants.length>0 && c.locants.every(locant=>locant==="N")));
    const substituentAtoms = [...new Set(nGroups.flatMap(group=>group.atomIds.filter(id=>id!==graphNitrogen)))];
    const bonds = nGroups.flatMap(group=>group.attachmentBonds ?? group.bondIds);
    const validBonds = bonds.filter(([a,b])=>a===graphNitrogen && substituentAtoms.includes(b)
      || b===graphNitrogen && substituentAtoms.includes(a));
    const expectedAttachments=expected.reduce((total,c)=>total+c.locants.length,0);
    if (expected.length && expectedAttachments>0 && validBonds.length===expectedAttachments) {
      const id="heteroatom.locants."+nGroups.map(c=>c.id).join("+");
      const heteroatom=derivation.principalGroup==="amide"?"amide nitrogen":"amine nitrogen";
      const decision: PedagogicalDecision = {id,kind:"attachment-locants",family:"verified-amine-n-substitution",
        rule:"N-locant-identifies-substituent-bonded-to-functional-amine-nitrogen",
        evidenceSource:"reconciled amine suffix nitrogen, unnumbered parent boundary and mapped N–substituent bonds",
        atomIds:[graphNitrogen,...substituentAtoms],bondIds:validBonds,locants:expected.flatMap(c=>c.locants),numberingScope:"parent",
        result:expected.map(c=>c.text).join(","),nameFragments:[],componentBindings:expected.map(nameComponentBinding),
        dependsOn:["component.suffix",...nGroups.map(c=>"component."+c.id)],verification:"verified",
        explanation:{en:`${nGroups.map(c=>c.text.replace(/^N(?:,N)*-/,"")).join(" and ")} is directly bonded to the ${heteroatom}. The mapped N–substituent bond identifies that atom as the suffix-bearing ${derivation.principalGroup}; it has no numeric locant in the parent map, so the name uses ${expected.map(c=>c.text).join(" and ")} instead of a carbon locant.`,
          es:`${nGroups.map(c=>c.text.replace(/^N(?:,N)*-/,"")).join(" y ")} se une directamente al nitrógeno de la función ${derivation.principalGroup}. El enlace N–sustituyente mapeado identifica el heteroátomo funcional; no tiene localizador numérico en el mapa del padre, por eso se utiliza ${expected.map(c=>c.text).join(" y ")} en lugar de un localizador de carbono.`}};
      decisions.push(decision);
      const target=steps.find(s=>s.componentIds.some(c=>nGroups.some(g=>g.id===c)) && s.title!==numberingTitle);
      if(target){(target.decisionIds??=[]).push(id);target.advancedExplanation=[target.advancedExplanation,decision.explanation[language]].filter(Boolean).join(" ");}
    }
  }
  // Count a halogen multiplier only when distinct halogen atoms share one
  // verified carbon attachment. This covers internal halo prefixes such as
  // trifluoromethyl without treating a text prefix as structural evidence.
  const multiplierCounts: Record<string,number>={di:2,tri:3,tetra:4};
  for (const expected of inventory.components.filter(c=>c.aspect==="multiplicity" && c.id.endsWith(".multiplier"))) {
    const count=multiplierCounts[expected.text];
    const parent=expected.id.replace(/\.multiplier$/, "");
    const nGroup=derivation.components.find(c=>c.id===parent && c.locant==="N" && c.role==="substituent"
      && (c.parentId??"parent")==="parent");
    const nSuffix=derivation.components.find(c=>c.role==="suffix");
    const suffixNitrogens=graph&&nSuffix?nSuffix.atomIds.filter(atomId=>graph.atoms.find(atom=>atom.id===atomId)?.element==="N"
      && !derivation.components.find(c=>c.id==="parent")?.numbering.some(([mapped])=>mapped===atomId)):[];
    if(graph && nGroup && nSuffix && expected.numberingScope==="parent" && expected.locants.length===count
      && expected.locants.every(locant=>locant==="N") && expected.atomIds.length>=count) {
      const branchAtoms=new Set(expected.atomIds);
      const bonds=nGroup.attachmentBonds??nGroup.bondIds;
      const centers=[...new Set(bonds.flatMap(([a,b])=>branchAtoms.has(a)&&!branchAtoms.has(b)?[b]
        :branchAtoms.has(b)&&!branchAtoms.has(a)?[a]:[]))];
      const nitrogen=centers.length===1?suffixNitrogens.find(id=>id===centers[0]):undefined;
      const attachments=bonds.filter(([a,b])=>a===nitrogen&&branchAtoms.has(b)||b===nitrogen&&branchAtoms.has(a));
      const roots=attachments.map(([a,b])=>a===nitrogen?b:a);
      const remaining=new Set(branchAtoms),groups:number[][]=[];
      while(remaining.size){const seed=remaining.values().next().value as number;remaining.delete(seed);const group=[seed],queue=[seed];
        while(queue.length){const current=queue.pop()!;for(const [a,b] of graph.bonds){const next=a===current?b:b===current?a:undefined;
          if(next!==undefined&&remaining.has(next)){remaining.delete(next);group.push(next);queue.push(next);}}}groups.push(group);}
      const target=steps.find(s=>s.componentIds.includes(parent)&&s.title!==numberingTitle);
      const rootText=/^N(?:,N)*-(?:(?:di|tri|tetra))?(.+)$/.exec(nGroup.text)?.[1]??"substituent";
      if(nitrogen!==undefined && roots.length===count && new Set(roots).size===count && groups.length===count
        && roots.every(root=>groups.filter(group=>group.includes(root)).length===1)
        && attachments.every(([a,b])=>graph.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a)) && target?.explanation.trim()) {
        const id="component-multiplier."+parent;
        const decision:PedagogicalDecision={id,kind:"functional-multiplicity",family:"verified-nitrogen-substituent-multiplicity",
          rule:"multiplier-counts-distinct-branches-attached-to-functional-nitrogen",
          evidenceSource:"exact multiplier interval, repeated N locants, distinct branch components and verified C–N bonds",
          atomIds:[nitrogen,...expected.atomIds],bondIds:attachments,locants:expected.locants,numberingScope:"parent",result:expected.text,
          nameFragments:[],componentBindings:[nameComponentBinding(expected)],dependsOn:["component."+parent],verification:"verified",
          explanation:{en:`The multiplier ${expected.text}- counts ${count} distinct ${rootText} branches. Each branch has its own C–N bond to the suffix-bearing amine nitrogen, so the repeated N locants refer to separate attachments at that nitrogen rather than numbered parent carbons.`,
            es:`El multiplicador ${expected.text}- cuenta ${count} ramas distintas de ${rootText}. Cada rama tiene su propio enlace C–N con el nitrógeno de la función amina; los localizadores N repetidos señalan uniones distintas a ese nitrógeno, no carbonos numerados del padre.`}};
        decisions.push(decision);(target.decisionIds??=[]).push(id);
        target.advancedExplanation=[target.advancedExplanation,decision.explanation[language]].filter(Boolean).join(" ");
        continue;
      }
    }
    if(!graph || !count || expected.atomIds.length!==count || new Set(expected.atomIds).size!==count || expected.bondIds.length!==count) continue;
    const elements=expected.atomIds.map(id=>graph.atoms.find(atom=>atom.id===id)?.element);
    if(!elements.length || elements.some(element=>!element || !["F","Cl","Br","I"].includes(element) || element!==elements[0])) continue;
    const centers=graph.atoms.filter(atom=>atom.element==="C" && expected.atomIds.every(halogen=>
      expected.bondIds.some(([a,b])=>a===atom.id&&b===halogen||b===atom.id&&a===halogen)));
    if(centers.length!==1 || expected.bondIds.some(([a,b])=>!expected.atomIds.some(halogen=>
      a===centers[0]!.id&&b===halogen||b===centers[0]!.id&&a===halogen)
      || !graph.bonds.some(([x,y])=>x===a&&y===b||x===b&&y===a))) continue;
    const step=steps.find(s=>s.componentIds.includes(expected.id.replace(/\.multiplier$/, "")) && s.title!==numberingTitle);
    if(!step?.explanation.trim()) continue;
    const id="component-multiplier."+parent;
    const elementsText=elements[0]==="F"?{en:"fluorine",es:"flúor"}:elements[0]==="Cl"?{en:"chlorine",es:"cloro"}
      :elements[0]==="Br"?{en:"bromine",es:"bromo"}:{en:"iodine",es:"yodo"};
    const internal=expected.numberingScope!=="parent";
    const scopeLabel=inventory.components.find(c=>c.id===expected.numberingScope)?.text??expected.numberingScope;
    const decision:PedagogicalDecision={id,kind:"functional-multiplicity",family:"verified-shared-center-halogen-multiplier",
      rule:"multiplier-counts-distinct-halogen-atoms-on-one-carbon",evidenceSource:"exact multiplier interval, distinct mapped halogen atoms and their shared carbon bonds",
      atomIds:[...expected.atomIds,centers[0]!.id],bondIds:expected.bondIds,locants:expected.locants,numberingScope:expected.numberingScope,
      result:expected.text,nameFragments:[],componentBindings:[nameComponentBinding(expected)],dependsOn:["component."+parent],verification:"verified",
      explanation:{en:`The prefix ${expected.text}- corresponds to ${count} distinct ${elementsText.en} atoms, each bonded to the same carbon. ${internal?`This count belongs inside the ${scopeLabel} group; it does not mean ${count} separate groups on the parent.`:`The multiplier counts these separate halogen attachments.`}`,
        es:`El prefijo ${expected.text}- corresponde a ${count} átomos distintos de ${elementsText.es}, cada uno enlazado al mismo carbono. ${internal?`Este recuento pertenece al interior del grupo ${scopeLabel}; no significa que haya ${count} grupos separados en el padre.`:`El multiplicador cuenta estas uniones halogenadas distintas.`}`}};
    decisions.push(decision);
    (step.decisionIds??=[]).push(id);
    step.advancedExplanation=[step.advancedExplanation,decision.explanation[language]].filter(Boolean).join(" ");
  }
  const step = steps.find(s=>s.title === numberingTitle);
  if (step?.target && step.explanation.trim()) {
    const id = "component.parent-numbering";
    const entries = inventory.components.filter(c=>c.aspect==="locants" && c.numberingScope==="parent");
    decisions.push({id,kind:"conventional-numbering",family:"mapped-components",rule:"presented-parent-locant-map",
      evidenceSource:"reconciled parent map and visible numbering step",atomIds:[...step.target.atomIds],
      bondIds:step.target.bondIds.map(([a,b])=>[a,b]),
      locants:step.target.locants.map(([,n])=>n),numberingScope:"parent",result:"parent locants",
      explanation:{en:language==="en"?step.explanation:"",es:language==="es"?step.explanation:""},
      nameFragments:[],componentBindings:entries.map(nameComponentBinding),dependsOn:[],verification:"verified"});
    (step.decisionIds ??= []).push(id);
  }
  return decisions;
}
