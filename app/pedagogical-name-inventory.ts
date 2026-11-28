import type { GeneratedMolecule } from "./name-to-molecule.ts";
import type { NameComponent, ValidatedNameDerivation } from "./validated-name-derivation.ts";

export type ExpectedNameComponent = {
  id: string;
  role: string;
  aspect: "identity" | "locants" | "multiplicity" | "stem" | "scope" | "assembly";
  text: string;
  start: number;
  end: number;
  numberingScope: string;
  locants: (number | string)[];
  dependsOn: string[];
  atomIds: number[];
  bondIds: [number, number][];
  evidence: "available" | "insufficient";
};
export type PedagogicalNameInventory = {
  name: string;
  sourceName: string;
  components: ExpectedNameComponent[];
  syntax: {start: number; end: number; text: string}[];
  limitations: string[];
  parentForm?: {en: string; es: string; mode: "suffix-elision" | "unsaturated-stem"};
};
export type NameComponentBinding = Pick<ExpectedNameComponent, "id" | "start" | "end" | "numberingScope" | "aspect">;

export function nameComponentBinding(component: ExpectedNameComponent): NameComponentBinding {
  const {id, start, end, numberingScope, aspect} = component;
  return {id, start, end, numberingScope, aspect};
}

/** Inventory is built from the reconciler's components, before and independently
 * of pedagogical decisions. It never translates or searches for a fragment. */
export function buildPedagogicalNameInventory(derivation: ValidatedNameDerivation, graph: GeneratedMolecule,
  name = derivation.name): PedagogicalNameInventory {
  const inventory: PedagogicalNameInventory = {name, sourceName: derivation.name, components: [], syntax: [], limitations: []};
  if (Object.values(derivation.evidence?.steroidPedagogy?.commonName ?? {}).includes(name)) {
    inventory.components.push({id:"retained-identity",role:"retained-name",aspect:"identity",text:name,start:0,end:name.length,
      numberingScope:"parent",locants:[],dependsOn:[],atomIds:graph.atoms.map(a=>a.id),
      bondIds:graph.bonds.map(([a,b])=>[a,b]),evidence:"available"});
    return inventory;
  }
  if (name !== derivation.name) {
    inventory.limitations.push("active-name-has-no-verified-component-offsets");
    return inventory;
  }
  const atoms = new Set(graph.atoms.map(a => a.id));
  const hasBond = (a: number, b: number) => graph.bonds.some(([x,y]) => a === x && b === y || a === y && b === x);
  const add = (component: ExpectedNameComponent) => {
    if (!component.text || !Number.isInteger(component.start) || !Number.isInteger(component.end)
      || component.start < 0 || component.end <= component.start || component.end > name.length
      || name.slice(component.start, component.end) !== component.text) {
      inventory.limitations.push("invalid-component-interval:" + component.id);
      return;
    }
    const validEvidence = component.atomIds.length > 0 && component.atomIds.every(id => atoms.has(id))
      && component.bondIds.every(([a,b]) => hasBond(a,b));
    inventory.components.push({...component, evidence: validEvidence ? component.evidence : "insufficient"});
  };
  const steroid = derivation.evidence?.steroidPedagogy;
  // The existing steroid reconciler supplies identity, functions and locants.
  // This bounded surface form describes its already-validated stem/ene/oxo
  // spelling. Other forms keep an explicit unsupported-inventory limitation.
  if (steroid) {
    const match = /^([a-z]+)-(\d+)-(ene|eno)-(\d+(?:,\d+)*)-(dione|diona)$/.exec(name);
    if (!match) {
      inventory.limitations.push("steroid-surface-components-unavailable");
      return inventory;
    }
    const rootEnd = match[1]!.length, alkeneStart = rootEnd + 1;
    const eneStart = alkeneStart + match[2]!.length + 1;
    const oxoStart = eneStart + match[3]!.length + 1, suffixStart = oxoStart + match[4]!.length + 1;
    const parent = derivation.components.find(c => c.id === "parent")!;
    const functions = steroid.functions.filter(f => f.kind === "ketone");
    const carbonylAtoms = functions.flatMap(f => f.atomIds), carbonylBonds = functions.flatMap(f => f.bondIds);
    const base = {numberingScope: "parent", dependsOn: [] as string[], evidence: "available" as const};
    add({...base,id:"parent",role:"parent",aspect:"identity",text:match[1]!,start:0,end:rootEnd,
      locants:[],atomIds:parent.atomIds,bondIds:parent.bondIds});
    const alkene = steroid.unsaturations.find(u => u.locant === Number(match[2]));
    add({...base,id:"steroid.ene-locants",role:"locant",aspect:"locants",text:match[2]!,start:alkeneStart,end:eneStart-1,
      locants:[Number(match[2])],atomIds:alkene?.atomIds ?? [],bondIds:alkene?.bondIds ?? []});
    add({...base,id:"steroid.ene",role:"unsaturation",aspect:"identity",text:match[3]!,start:eneStart,end:oxoStart-1,
      locants:[Number(match[2])],atomIds:alkene?.atomIds ?? [],bondIds:alkene?.bondIds ?? []});
    const written = match[4]!.split(",").map(Number);
    const verified = written.length === functions.length && written.every(n => functions.some(f => f.locant === n));
    add({...base,id:"steroid.oxo-locants",role:"locant",aspect:"locants",text:match[4]!,start:oxoStart,end:suffixStart-1,
      dependsOn:["steroid.oxo"],locants:written,atomIds:verified ? carbonylAtoms : [],bondIds:carbonylBonds});
    add({...base,id:"steroid.oxo",role:"suffix",aspect:"identity",text:match[5]!,start:suffixStart,end:name.length,
      locants:written,atomIds:verified ? carbonylAtoms : [],bondIds:carbonylBonds});
    add({...base,id:"steroid.oxo-multiplier",role:"multiplier",aspect:"multiplicity",text:"di",start:suffixStart,end:suffixStart+2,
      dependsOn:["steroid.oxo"],locants:written,atomIds:verified && functions.length === 2 ? carbonylAtoms : [],bondIds:carbonylBonds});
    inventory.parentForm = {en:steroid.family,es:{gonane:"gonano",estrane:"estrano",androstane:"androstano",pregnane:"pregnano"}[steroid.family],
      mode:"unsaturated-stem"};
  } else {
    for (const component of derivation.components) {
      if (derivation.parentSystem === "purine" && component.role === "parent" && component.id !== "parent") continue;
      const scope = component.numberingScope ?? (component.locant === "N" && component.numbering.some(([,n])=>typeof n==="number")
        ? component.id : component.parentId && component.parentId !== "parent" ? component.parentId : "parent");
      let start = component.start, end = component.end, text = component.text;
      const written = (component.writtenLocants ?? []).filter(w => w.start >= start && w.end <= end);
      // Ring/chain parent components sometimes enclose their written suffix.
      // Their own declared locant span bounds the stem without a name search.
      if (component.role === "parent" && written.length) {
        const first = Math.min(...written.map(w => w.start));
        if (first > start && name[first-1] === "-" && /^[a-záéíóúñ]+$/i.test(name.slice(start,first-1))) {
          end = first-1;
          text = name.slice(start,end);
        }
      }
      add({id:component.id,role:component.role,aspect:"identity",text,start,end,numberingScope:scope,
        locants:component.numbering.map(([,n]) => n),dependsOn:component.parentId ? [component.parentId] : [],
        atomIds:component.atomIds,bondIds:component.bondIds,evidence:"available"});
      if (component.locant === "N" && name.slice(component.start-3,component.start) === "N-(") {
        const nitrogen = graph.atoms.find(a=>a.element === "N" && component.bondIds.some(([aId,bId])=>
          a.id === aId && component.atomIds.includes(bId) || a.id === bId && component.atomIds.includes(aId)));
        add({id:component.id+".attachment-locant",role:"locant",aspect:"locants",text:"N",
          start:component.start-3,end:component.start-2,numberingScope:"parent",locants:["N"],dependsOn:[component.id],
          atomIds:nitrogen ? [nitrogen.id] : [],bondIds:[],evidence:"available"});
      }
      for (const [index, locant] of written.entries()) {
        add({id:component.id+".written."+index,role:"locant",aspect:"locants",text:name.slice(locant.start,locant.end),
          start:locant.start,end:locant.end,numberingScope:component.role === "parent" ? scope : component.id,locants:[locant.locant],dependsOn:[component.id],
          atomIds:[locant.atomId],bondIds:[],evidence:"available"});
      }
      addComponentModifiers(component, scope, add);
      const multiplier = [undefined,undefined,"di","tri","tetra"][component.atomIds.length];
      if (multiplier && component.role === "prefix" && component.atomIds.every(id=>
        ["F","Cl","Br","I"].includes(graph.atoms.find(a=>a.id===id)?.element ?? ""))
        && component.text.startsWith(multiplier)) {
        add({id:component.id+".multiplier",role:"multiplier",aspect:"multiplicity",text:multiplier,
          start:component.start,end:component.start+multiplier.length,numberingScope:scope,locants:[],dependsOn:[component.id],
          atomIds:component.atomIds,bondIds:component.bondIds,evidence:"available"});
      }
    }
    if (derivation.evidence?.construction === "fused-naphthalene"
      && inventory.components.some(c=>c.id==="parent" && /^(naphthalen|naftalen)$/.test(c.text)))
      inventory.parentForm = {en:"naphthalene",es:"naftaleno",mode:"suffix-elision"};
  }
  const parent = inventory.components.find(c=>c.id==="parent");
  if (parent && inventory.parentForm) add({...parent,id:"parent.stem",role:"parent-stem",aspect:"stem",dependsOn:["parent"]});
  if (inventory.components.some(c=>c.aspect==="locants" && c.numberingScope!=="parent")) {
    add({id:"name.scopes",role:"scope-composition",aspect:"scope",text:name,start:0,end:name.length,
      numberingScope:"parent",locants:[],dependsOn:[],atomIds:graph.atoms.map(a=>a.id),
      bondIds:graph.bonds.map(([a,b])=>[a,b]),evidence:"available"});
  }
  if (inventory.components.length > 1) add({id:"name.assembly",role:"assembly",aspect:"assembly",text:name,start:0,end:name.length,
    numberingScope:"parent",locants:[],dependsOn:inventory.components.map(c=>c.id),atomIds:graph.atoms.map(a=>a.id),
    bondIds:graph.bonds.map(([a,b])=>[a,b]),evidence:"available"});
  const covered = new Set(inventory.components.filter(c=>c.aspect!=="assembly" && c.aspect!=="scope").flatMap(c => Array.from({length:c.end-c.start},(_,i)=>c.start+i)));
  for (const match of name.matchAll(/[\s,\-()[\]{}]+|[^\s,\-()[\]{}]+/g)) {
    const start = match.index!;
    if (/^[\s,\-()[\]{}]+$/.test(match[0])) inventory.syntax.push({start,end:start+match[0].length,text:match[0]});
    else if ([...match[0]].some((_,i) => !covered.has(start+i))) inventory.limitations.push("unmapped-name-range:"+start+":"+(start+match[0].length));
  }
  if (!inventory.components.length) inventory.limitations.push("no-trustworthy-name-components");
  return inventory;
}

function addComponentModifiers(component: NameComponent, scope: string, add: (component: ExpectedNameComponent) => void) {
  const prefix = /^(N(?:,N)*|\d+(?:,\d+)*)-/.exec(component.text);
  if (!prefix) return;
  const positions = prefix[1]!.startsWith("N") ? [...prefix[1]!.matchAll(/N/g)].map(()=>"N")
    : prefix[1]!.split(",").map(Number);
  const base = {numberingScope:scope,dependsOn:[component.id],atomIds:component.numbering.filter(([,n])=>positions.some(p=>String(p)===String(n))).map(([id])=>id),
    bondIds:[] as [number,number][],evidence:"available" as const};
  add({...base,id:component.id+".locants",role:"locant",aspect:"locants",text:prefix[1]!,
    start:component.start,end:component.start+prefix[1]!.length,locants:positions});
  const multiplier = [undefined,undefined,"di","tri","tetra"][positions.length];
  const offset = component.start+prefix[0].length;
  if (multiplier && component.text.slice(prefix[0].length,prefix[0].length+multiplier.length) === multiplier)
    add({...base,id:component.id+".multiplier",role:"multiplier",aspect:"multiplicity",text:multiplier,
      start:offset,end:offset+multiplier.length,locants:positions,atomIds:component.atomIds,bondIds:component.bondIds});
}
