import type { GeneratedMolecule } from "./name-to-molecule.ts";
import { type NameComponent, type ValidatedCompositionalEvidence } from "./compositional-name-model.ts";
import type { ValidatedNameDerivation } from "./validated-name-derivation.ts";
import type { NameBuildResult } from "./name-to-molecule.ts";
import { moleculeFromSmiles } from "./openchemlib-adapter.ts";
import { inspectTestosteroneGraph, TESTOSTERONE_REFERENCE_SMILES } from "./testosterone-stereo-structure.ts";

export type TestosteroneNameForm="common"|"semisystematic";
export type ParsedTestosteroneName={language:"en"|"es";form:TestosteroneNameForm;normalized:string;canonicalName:string};

export const TESTOSTERONE_NAMES={
  en:"17β-hydroxyandrost-4-en-3-one",
  es:"17β-hidroxiandrost-4-en-3-ona",
  commonEn:"testosterone",
  commonEs:"testosterona",
} as const;

export function parseTestosteroneName(input:string):ParsedTestosteroneName|null{
  const source=input.trim().normalize("NFC"),compact=source.replace(/\s+/g,"").toLocaleLowerCase("en");
  if(compact==="testosterone")return {language:"en",form:"common",normalized:source,canonicalName:TESTOSTERONE_NAMES.en};
  if(compact==="testosterona")return {language:"es",form:"common",normalized:source,canonicalName:TESTOSTERONE_NAMES.es};
  if(compact===TESTOSTERONE_NAMES.en.toLocaleLowerCase("en"))return {language:"en",form:"semisystematic",normalized:source,canonicalName:TESTOSTERONE_NAMES.en};
  if(compact===TESTOSTERONE_NAMES.es.toLocaleLowerCase("es"))return {language:"es",form:"semisystematic",normalized:source,canonicalName:TESTOSTERONE_NAMES.es};
  return null;
}

export function buildTestosteroneMoleculeFromName(input:string):NameBuildResult|null{
  const parsed=parseTestosteroneName(input);if(!parsed)return null;
  const imported=moleculeFromSmiles(TESTOSTERONE_REFERENCE_SMILES);
  if(!imported.ok)return {ok:false,error:imported.error,inputFamily:"fused-testosterone-stereo"};
  if(!inspectTestosteroneGraph(imported.molecule))return {ok:false,
    error:"La referencia esteroidea no conservó la conectividad y la estereoquímica auditadas.",inputFamily:"fused-testosterone-stereo"};
  return {ok:true,molecule:imported.molecule,normalizedInput:parsed.normalized,enabledAliases:[],inputFamily:"fused-testosterone-stereo"};
}

const edge=(a:number,b:number):[number,number]=>a<b?[a,b]:[b,a];
function component(id:string,role:NameComponent["role"],text:string,ids:number[],bonds:[number,number][],numbering:[number,number][],name:string):NameComponent{
  return {id,role,text,start:0,end:name.length,atomIds:ids,bondIds:bonds,numbering,explanation:"",explanationEs:""};
}

function makeDerivation(actual:GeneratedMolecule,parsed:ParsedTestosteroneName):ValidatedNameDerivation|null{
  const graphEvidence=inspectTestosteroneGraph(actual);if(!graphEvidence)return null;
  const {system,locants,carbonylOxygenId,hydroxylOxygenId,c4C5Bond,c3OxoBond,c17HydroxyBond}=graphEvidence;
  const name=parsed.canonicalName,allCarbonIds=actual.atoms.filter(atom=>(atom.element??"C")==="C").map(atom=>atom.id);
  const carbonBonds=actual.bonds.filter(([a,b])=>allCarbonIds.includes(a)&&allCarbonIds.includes(b)).map(([a,b])=>edge(a,b));
  const components:NameComponent[]=[
    {...component("testosterone-parent","parent",name,allCarbonIds,carbonBonds,
      allCarbonIds.map(id=>[id,Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])] as [number,number]),name),
      explanation:"The graph is the androstane 6–6–6–5 stereoparent with conventional C1–C19 numbering and both angular methyls.",
      explanationEs:"El grafo es el estereoparent androstano 6–6–6–5, con numeración convencional C1–C19 y ambos metilos angulares."},
    ...(["A","B","C","D"] as const).map(letter=>{
      const positions=letter==="A"?[1,2,3,4,5,10]:letter==="B"?[5,6,7,8,9,10]:letter==="C"?[8,9,11,12,13,14]:[13,14,15,16,17];
      const ids=system.ringsByLabel[letter];
      return {...component(`testosterone-ring-${letter}`,"parent","",ids,
        actual.bonds.filter(([a,b])=>ids.includes(a)&&ids.includes(b)).map(([a,b])=>edge(a,b)),
        ids.map(id=>[id,Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])] as [number,number]),name),
        label:`ring ${letter}`,labelEs:`anillo ${letter}`,
        explanation:`Ring ${letter} is identified by its shared edges and steroid locants ${positions.map(n=>`C${n}`).join(", ")}.`,
        explanationEs:`El anillo ${letter} se identifica por sus enlaces compartidos y los localizadores esteroideos ${positions.map(n=>`C${n}`).join(", ")}.`};
    }),
    ...(["AB","BC","CD"] as const).map(label=>{
      const pair=system.junctions[label],pairLocants=label==="AB"?[5,10]:label==="BC"?[8,9]:[13,14];
      return {...component(`testosterone-fusion-${label.toLowerCase()}`,"prefix","",[...pair],[edge(...pair)],
        pair.map(id=>[id,Number(Object.entries(locants).find(([,mapped])=>mapped===id)?.[0])] as [number,number]),name),
        label:`fusion C${pairLocants[0]}–C${pairLocants[1]}`,labelEs:`unión C${pairLocants[0]}–C${pairLocants[1]}`,
        explanation:`The A/B, B/C and C/D junctions remain shared bonds; this control selects only the C${pairLocants[0]}–C${pairLocants[1]} fusion edge.`,
        explanationEs:`Las uniones A/B, B/C y C/D conservan sus enlaces compartidos; este control selecciona solo la fusión C${pairLocants[0]}–C${pairLocants[1]}.`};
    }),
    ...Array.from({length:19},(_,index)=>{
      const locant=index+1,id=locants[String(locant)]!;
      return {...component(`testosterone-locant-${locant}`,"prefix",`C${locant}`,[id],[],[[id,locant]],name),
        label:`steroid C${locant}`,labelEs:`C${locant} esteroideo`,
        explanation:`This graph atom is steroid locant C${locant}.`,explanationEs:`Este átomo del grafo corresponde al localizador esteroideo C${locant}.`};
    }),
    {...component("testosterone-c18","substituent","C18",[locants["18"]!],[edge(locants["13"]!,locants["18"]!)],[[locants["18"]!,18]],name),
      label:"angular methyl C18",labelEs:"metilo angular C18",explanation:"C18 is the terminal angular methyl directly attached to C13.",
      explanationEs:"C18 es el metilo angular terminal unido directamente a C13."},
    {...component("testosterone-c19","substituent","C19",[locants["19"]!],[edge(locants["10"]!,locants["19"]!)],[[locants["19"]!,19]],name),
      label:"angular methyl C19",labelEs:"metilo angular C19",explanation:"C19 is the terminal angular methyl directly attached to C10.",
      explanationEs:"C19 es el metilo angular terminal unido directamente a C10."},
    {...component("testosterone-unsaturation-4","unsaturation",parsed.language==="en"?"4-en":"4-en",[locants["4"]!,locants["5"]!],[c4C5Bond],
      [[locants["4"]!,4],[locants["5"]!,5]],name),label:"C4=C5",labelEs:"C4=C5",
      explanation:"The only carbon–carbon double bond is between C4 and C5, so the parent stem is androst-4-en-.",
      explanationEs:"El único doble enlace carbono–carbono se encuentra entre C4 y C5; por eso el tema parental es androst-4-en-."},
    {...component("testosterone-carbonyl-3","suffix",parsed.language==="en"?"3-one":"3-ona",[locants["3"]!,carbonylOxygenId],[c3OxoBond],[[locants["3"]!,3]],name),
      label:"C3 ketone",labelEs:"cetona C3",explanation:"C3 is bonded to its oxygen by a double bond, establishing the ketone suffix -3-one/-3-ona.",
      explanationEs:"C3 está unido a su oxígeno mediante un doble enlace; esto establece el sufijo de cetona -3-one/-3-ona."},
    {...component("testosterone-hydroxy-17","prefix",parsed.language==="en"?"17β-hydroxy":"17β-hidroxi",[locants["17"]!,hydroxylOxygenId],[c17HydroxyBond],[[locants["17"]!,17]],name),
      label:"17β-hydroxyl",labelEs:"hidroxilo 17β",explanation:"C17 bears a single-bonded hydroxyl group on the β face in the audited steroid reference.",
      explanationEs:"C17 lleva un grupo hidroxilo unido por enlace sencillo en la cara β según la referencia esteroidea auditada."},
    {...component("testosterone-17beta","prefix","17β",[locants["17"]!],[],[[locants["17"]!,17]],name),
      label:"C17 β configuration",labelEs:"configuración β de C17",explanation:"The C17 configuration matches testosterone (17β), not its C17 epimer epitestosterone (17α).",
      explanationEs:"La configuración de C17 coincide con testosterona (17β), no con su epímero C17, epitestosterona (17α)."},
    {...component("testosterone-global-stereo","prefix","",Object.entries(locants).filter(([locant])=>["8","9","10","13","14","17"].includes(locant)).map(([,id])=>id),[],
      Object.entries(locants).filter(([locant])=>["8","9","10","13","14","17"].includes(locant)).map(([locant,id])=>[id,Number(locant)]),name),
      label:"global steroid stereochemistry",labelEs:"estereoquímica esteroidea global",
      explanation:"All six required tetrahedral centres match the testosterone reference globally. C5 is trigonal at C4=C5 and has no tetrahedral descriptor.",
      explanationEs:"Los seis centros tetraédricos requeridos coinciden globalmente con la referencia de testosterona. C5 es trigonal en C4=C5 y no lleva descriptor tetraédrico."},
    ...(parsed.form==="common"?[{...component("testosterone-common-name","prefix",parsed.normalized,[],[],[],name),
      label:parsed.language==="en"?"common name testosterone":"nombre común testosterona",
      labelEs:parsed.language==="en"?"nombre común testosterona":"nombre común testosterona",
      explanation:"The common name is accepted only after the complete graph and stereochemistry match the audited testosterone structure.",
      explanationEs:"El nombre común se acepta solo después de verificar el grafo completo y la estereoquímica frente a la estructura auditada de testosterona."}]:[]),
  ];

  const evidence:ValidatedCompositionalEvidence={source:"active-name",profile:"current",language:parsed.language,
    construction:"fused-testosterone-stereo",
    rules:[
      {id:"steroid-semisystematic-parent",source:"IUPAC-IUBMB Nomenclature of Steroids (1989), 3S-1.1, 3S-1.3, 3S-2.5; steroid numbering, implied configuration and steroid -ene form"},
      {id:"steroid-suffix-priority",source:"IUPAC-IUBMB Nomenclature of Steroids (1989), 3S-4.4(b) Note 2; a ketone suffix takes precedence over hydroxyl prefix"},
      {id:"androstane-17beta-reference",source:"PubChem CID 6013 and ChEBI CHEBI:17347; formula C19H28O2 and independent isomeric structure references"},
      {id:"not-pin",source:"The name is treated as a supported semisystematic steroid name/common-name equivalence, not asserted to be a 2013 PIN"},
    ],parentSelection:"steroid-core",numbering:{scope:"parent",priorities:["steroid numbering mapped from the four-ring graph; C18 at C13 and C19 at C10"],
      selected:Object.entries(locants).map(([locant,id])=>[id,Number(locant)]),reflected:[],comparison:0},
    stereo:"specified-tetrahedral",reconstructedGraph:actual,atomMapping:actual.atoms.map(atom=>[atom.id,atom.id]),equivalence:"complete-graph-isomorphism"};
  return {status:"FULL",name,preferred:false,principalGroup:"ketone",components,parentAtomIds:allCarbonIds,evidence};
}

export function reconcileTestosteroneName(actual:GeneratedMolecule,name:string):ValidatedNameDerivation|null{
  const parsed=parseTestosteroneName(name);return parsed?makeDerivation(actual,parsed):null;
}
