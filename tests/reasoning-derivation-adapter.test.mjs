import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveStructuralComponents } from "../app/structural-derivation.ts";
import { buildStructuralPriorityReasoning, buildValidatedPriorityReasoning, shouldShowStructuralPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { presentValidatedSystematicName, reconcileSystematicName, validatedNameTargets } from "../app/validated-name-derivation.ts";
import { reasoningFragmentId } from "../app/reasoning-visual-targets.ts";
import { buildValidatedVisualNumbering } from "../app/visual-numbering.ts";
import { resolveDerivationConsistency } from "../app/derivation-consistency.ts";

const imported = smiles => {
  const result = moleculeFromSmiles(smiles);
  assert.equal(result.ok, true, result.error);
  return result.molecule;
};
let server, page;
before(async () => {
  server = await createServer({ configFile: false, logLevel: "error", appType: "custom",
    plugins: [react()], server: { middlewareMode: true, hmr: false, ws: false } });
  page = await server.ssrLoadModule("/app/page.tsx");
});
after(async () => { await server?.close(); });

const fullCases = [
  { name: "N-(4-hydroxyphenyl)acetamide", smiles: "CC(=O)Nc1ccc(O)cc1", ids: ["suffix", "parent", "aryl", "aryl-prefix"] },
  { name: "2-[4-(2-methylpropyl)phenyl]propanoic acid", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", ids: ["suffix", "parent", "aryl", "aryl-prefix"] },
  { name: "2-(acetyloxy)benzoic acid", smiles: "CC(=O)Oc1ccccc1C(=O)O", ids: ["suffix", "parent", "acyloxy"] },
  { name: "N-(3-hydroxy-4-methylphenyl)acetamide", smiles: "CC(=O)Nc1cc(O)c(C)cc1", ids: ["suffix", "parent", "aryl", "aryl-prefix-3", "aryl-prefix-4"] },
];
const sortedIds = ids => [...ids].sort((a, b) => a - b);
const edgeKey = ([a, b]) => sortedIds([a, b]).join(":");
const sortedEdges = edges => edges.map(edgeKey).sort();
const fragmentsOf = step => step.fragments ? [step.fragments, ...(step.fragments.additionalFragments ?? [])] : [];

test("FULL derivations become concise priority steps with independently selectable graph regions", () => {
  for (const fixture of fullCases) {
    const graph = imported(fixture.smiles), derivation = reconcileSystematicName(graph, fixture.name);
    assert.equal(derivation?.status, "FULL", fixture.name);
    const model = buildValidatedPriorityReasoning({ derivation, graph, language: "es" });
    assert.deepEqual(model.steps.map(step => step.number), model.steps.map((_, index) => String(index + 1).padStart(2, "0")));
    assert.equal(model.steps[0].title, "Grupo funcional principal");
    assert.ok(model.steps.some(step => step.title === "Estructura principal"));
    assert.ok(model.steps.some(step => step.title === "Numeración"));
    assert.ok(model.steps.some(step => step.title === "Sustituyentes y localizadores"));
    assert.ok(model.steps.every(step => step.explanation.length < 260), `${fixture.name}: concise step text`);
    const controls = model.steps.flatMap(step => [step.fragments, ...(step.fragments?.additionalFragments ?? [])])
      .filter(fragment => fragment?.semanticId);
    for (const id of fixture.ids) {
      const component = derivation.components.find(item => item.id === id);
      assert.ok(component, `${fixture.name}: ${id} exists`);
      const control = controls.find(fragment => fragment.semanticId === id);
      assert.ok(control, `${fixture.name}: ${id} has one selectable component control`);
      const step = model.steps.find(item => [item.fragments, ...(item.fragments?.additionalFragments ?? [])]
        .some(fragment => fragment?.semanticId === id));
      const target = step.fragmentTargets[reasoningFragmentId(step.number, control)];
      const targets = validatedNameTargets(derivation);
      const includesSuffix = id === "parent" && (derivation.principalGroup === "amide" || fixture.ids.includes("acyloxy"));
      const atomIds = includesSuffix ? [...new Set([...targets.parent.atomIds, ...targets.suffix.atomIds])] : targets[id].atomIds;
      const bondIds = includesSuffix ? [...new Set([...sortedEdges(targets.parent.bondIds), ...sortedEdges(targets.suffix.bondIds)])].sort()
        : sortedEdges(targets[id].bondIds);
      assert.deepEqual(sortedIds(target.atomIds), sortedIds(atomIds));
      assert.deepEqual(sortedEdges(target.bondIds), bondIds);
    }
    const numbering = model.steps.find(step => step.title === "Numeración");
    const localizerButtons = [numbering.fragments, ...(numbering.fragments?.additionalFragments ?? [])];
    assert.ok(localizerButtons.some(fragment => fragment?.kind === "numbering"), `${fixture.name}: locant controls exist`);
  }
});

test("both FULL acetyloxy names give exact localized controls for the two distinct carbonyls and every other region", () => {
  const englishNames = ["2-acetyloxybenzoic acid", "2-(acetyloxy)benzoic acid"];
  const spanishName = "ácido 2-(acetiloxi)benzoico";
  for (const smiles of [fullCases[2].smiles, "O=C(O)c1ccccc1OC(C)=O", "CC(=O)OC1=CC=CC=C1C(O)=O"]) {
    const graph = imported(smiles);
    const ring = graph.rings.find(item => item.kind === "aromatic").atomIds;
    const element = id => graph.atoms.find(atom => atom.id === id)?.element ?? "C";
    const adjacent = id => graph.bonds.flatMap(([a, b, order = 1]) => a === id ? [[b, order]] : b === id ? [[a, order]] : []);
    const [c1, c2] = ["C", "O"].map(symbol => ring.find(id => adjacent(id)
      .some(([other]) => !ring.includes(other) && element(other) === symbol)));
    const acid = adjacent(c1).find(([id]) => !ring.includes(id))[0];
    const acidOxygens = adjacent(acid).filter(([id]) => element(id) === "O").map(([id]) => id);
    const linker = adjacent(c2).find(([id]) => element(id) === "O")[0];
    const acyl = adjacent(linker).find(([id]) => id !== c2)[0];
    const oxo = adjacent(acyl).find(([, order]) => order === 2)[0];
    const methyl = adjacent(acyl).find(([id]) => element(id) === "C")[0];
    const internal = ids => graph.bonds.filter(([a, b]) => ids.includes(a) && ids.includes(b));
    const main = [...ring, acid, ...acidOxygens], carboxyl = [acid, ...acidOxygens];
    const expected = [
      ["Ácido benzoico", "Benzoic acid", main, internal(main)],
      ["Grupo carboxilo", "Carboxyl group", carboxyl, internal(carboxyl)],
      ["Anillo aromático", "Aromatic ring", ring, internal(ring)],
      ["1", "1", [c1], [], [[c1, 1]]],
      ["2", "2", [c2], [], [[c2, 2]]],
      ["Grupo acetiloxi", "acetyloxy group", [linker, acyl, oxo, methyl], [[c2, linker], [linker, acyl], [acyl, oxo], [acyl, methyl]]],
      ["Oxígeno de unión", "Linking oxygen", [linker], []],
      ["Fragmento acetilo", "Acetyl fragment", [acyl, oxo, methyl], [[acyl, oxo], [acyl, methyl]]],
      ["Carbonilo del acetilo", "Acetyl carbonyl", [acyl, oxo], [[acyl, oxo]]],
      ["Metilo del acetilo", "Acetyl methyl", [methyl], []],
    ];
    const remap = new Map(graph.atoms.map(({ id }, index) => [id, (graph.atoms.length - index) * 23 + 500]));
    const permuted = {
      atoms: [...graph.atoms].reverse().map(atom => ({ ...atom, id: remap.get(atom.id) })),
      bonds: [...graph.bonds].reverse().map(([a, b, order]) => [remap.get(b), remap.get(a), order]),
    };
    assert.equal(main.length, 9);
    assert.equal(internal(ring).length, 6);
    assert.ok(!carboxyl.includes(acyl) && !carboxyl.includes(oxo));

    for (const name of englishNames) for (const language of ["es", "en"]) {
      const derivation = reconcileSystematicName(graph, name);
      assert.equal(derivation?.status, "FULL");
      assert.equal(presentValidatedSystematicName(derivation, language).name, language === "es" ? spanishName : name);
      const consistency = resolveDerivationConsistency({ molecule: graph, activeProfile: "current", language,
        activeName: language === "es" ? spanishName : name, currentSourceName: name });
      assert.equal(consistency.derivation?.name, name, "display localization preserves the FULL source name");
      const numbering = buildValidatedVisualNumbering(graph, derivation);
      assert.equal(numbering.get(c1), 1);
      assert.equal(numbering.get(c2), 2);
      assert.equal(numbering.has(acid), false);

      for (const [molecule, mapId] of [[graph, id => id], [permuted, id => remap.get(id)]]) {
        const proof = reconcileSystematicName(molecule, name);
        assert.equal(proof?.status, "FULL");
        const { steps } = buildValidatedPriorityReasoning({ derivation: proof, graph: molecule, language });
        const controls = new Map();
        for (const step of steps) {
          const targets = [];
          if (step.target) targets.push(step.target);
          for (const fragment of fragmentsOf(step)) {
            const target = step.fragmentTargets[reasoningFragmentId(step.number, fragment)];
            assert.ok(target, fragment.text);
            assert.ok(!controls.has(fragment.text), fragment.text);
            targets.push(target);
            controls.set(fragment.text, target);
          }
          const signatures = targets.map(target => JSON.stringify([sortedIds(target.atomIds), sortedEdges(target.bondIds)]));
          assert.equal(new Set(signatures).size, signatures.length, `no duplicate regions in ${step.title}`);
        }
        assert.equal(controls.size, expected.length);
        for (const [es, en, atomIds, bondIds, locants = []] of expected) {
          const text = language === "es" ? es : en, target = controls.get(text);
          assert.ok(target, text);
          assert.deepEqual(sortedIds(target.atomIds), sortedIds(atomIds.map(mapId)), text);
          assert.deepEqual(sortedEdges(target.bondIds), sortedEdges(bondIds.map(edge => edge.map(mapId))), text);
          assert.deepEqual(target.locants, locants.map(([id, locant]) => [mapId(id), locant]), text);
        }
        assert.match(steps[3].explanation, language === "es" ? /C2.*éster.*ácido carboxílico/ : /C2.*ester.*carboxylic acid/);
      }
    }
  }
});

test("FULL acyloxy reasoning handles a longer acyl group and requires compatible graph evidence", () => {
  const name = "3-propanoyloxybenzoic acid";
  const graph = imported("CCC(=O)Oc1cccc(C(=O)O)c1");
  const derivation = reconcileSystematicName(graph, name);
  assert.equal(derivation?.status, "FULL");
  const model = buildValidatedPriorityReasoning({ derivation, graph, language: "es" });
  const acyl = model.steps.flatMap(fragmentsOf);
  assert.equal(acyl.find(fragment => fragment.text === "Grupo propanoiloxi").atomIds.length, 5);
  assert.equal(acyl.find(fragment => fragment.text === "Fragmento acilo").atomIds.length, 4);
  assert.equal(acyl.find(fragment => fragment.text === "Carbonilo del acilo").bondIds.length, 1);
  assert.ok(!acyl.some(fragment => fragment.semanticId === "name:acetyl-methyl"));
  assert.ok(model.steps[3].explanation.includes("C3"));

  const carbonyl = acyl.find(fragment => fragment.text === "Carbonilo del acilo").bondIds[0];
  const edited = { ...graph, bonds: graph.bonds.map(bond => edgeKey(bond) === edgeKey(carbonyl) ? [bond[0], bond[1], 1] : bond) };
  assert.equal(reconcileSystematicName(edited, name), null);
  const stale = buildValidatedPriorityReasoning({ derivation, graph: edited, language: "es" });
  assert.ok(!stale.steps.flatMap(fragmentsOf).some(fragment => fragment.semanticId === "name:acyl-carbonyl"));

  const aspirin = imported(fullCases[2].smiles), unverifiedName = "3-acetyloxybenzoic acid";
  assert.equal(reconcileSystematicName(aspirin, unverifiedName), null);
  const partial = deriveStructuralComponents(aspirin, unverifiedName);
  assert.equal(partial.status, "PARTIAL");
  const structural = buildStructuralPriorityReasoning({ derivation: partial, language: "es" });
  assert.ok(!structural.steps.flatMap(fragmentsOf).some(fragment =>
    fragment.semanticId === "acyloxy" || fragment.semanticId?.startsWith("name:")));
});

test("N-(4-hydroxyphenyl)acetamide name fragments highlight their exact FULL graph regions", () => {
  const smiles = "CC(=O)Nc1ccc(O)cc1", graph = imported(smiles), name = fullCases[0].name;
  const derivation = reconcileSystematicName(graph, name), model = buildValidatedPriorityReasoning({ derivation, graph, language: "es" });
  const controls = model.steps.flatMap(step => [step.fragments, ...(step.fragments?.additionalFragments ?? [])].map(fragment => ({ step, fragment })));
  const targetFor = semanticId => {
    const { step, fragment } = controls.find(item => item.fragment?.semanticId === semanticId) ?? {};
    assert.ok(step && fragment, `${semanticId} control exists`);
    return step.fragmentTargets[reasoningFragmentId(step.number, fragment)];
  };
  const componentTargets = validatedNameTargets(derivation), bonds = graph.bonds.map(([a,b]) => `${Math.min(a,b)}:${Math.max(a,b)}`);
  const acetamide = targetFor("parent");
  const acylAtoms = [...new Set([...componentTargets.parent.atomIds, ...componentTargets.suffix.atomIds])];
  assert.deepEqual([...acetamide.atomIds].sort((a,b)=>a-b), acylAtoms.sort((a,b)=>a-b));
  assert.ok(acetamide.atomIds.some(id => graph.atoms.find(atom=>atom.id===id)?.element === "N"));
  const n = acetamide.atomIds.find(id => graph.atoms.find(atom=>atom.id===id)?.element === "N");
  const nControl = targetFor("name:N");
  const ringC1 = derivation.components.find(item=>item.id==="aryl").numbering.find(([,value])=>value===1)[0];
  assert.deepEqual([...nControl.atomIds].sort((a,b)=>a-b), [n, ringC1].sort((a,b)=>a-b));
  assert.equal(nControl.bondIds.length, 1);
  const phenyl = targetFor("name:phenyl"), ring = derivation.components.find(item=>item.id==="aryl").atomIds
    .filter(id => (graph.atoms.find(atom=>atom.id===id)?.element ?? "C") === "C");
  assert.deepEqual([...phenyl.atomIds].sort((a,b)=>a-b), [...ring].sort((a,b)=>a-b));
  assert.equal(phenyl.bondIds.length, 6);
  const locant4 = targetFor("name:phenyl-locant-4");
  assert.deepEqual(locant4.atomIds, [derivation.components.find(item=>item.id==="aryl").numbering.find(([,value])=>value===4)[0]]);
  const hydroxy = targetFor("name:hydroxy");
  assert.equal(hydroxy.atomIds.length, 1);
  assert.equal(graph.atoms.find(atom=>atom.id===hydroxy.atomIds[0]).element, "O");
  assert.equal(hydroxy.bondIds.length, 1);
  const complete = targetFor("name:4-hydroxyphenyl");
  assert.ok(componentTargets.aryl.atomIds.every(id => complete.atomIds.includes(id)));
  assert.ok(complete.bondIds.some(([a,b])=>`${Math.min(a,b)}:${Math.max(a,b)}`===`${Math.min(n,complete.atomIds.find(id=>id!==n))}:${Math.max(n,complete.atomIds.find(id=>id!==n))}`));
  assert.ok(complete.bondIds.every(([a,b])=>bonds.includes(`${Math.min(a,b)}:${Math.max(a,b)}`)));

  const ids = new Map(graph.atoms.map(atom=>[atom.id,atom.id*23+900]));
  const permuted = { atoms: graph.atoms.map(atom=>({...atom,id:ids.get(atom.id)})).reverse(),
    bonds: graph.bonds.map(([a,b,o])=>[ids.get(b),ids.get(a),o]).reverse() };
  const remappedDerivation = reconcileSystematicName(permuted,name);
  const remapped = buildValidatedPriorityReasoning({ derivation: remappedDerivation, graph: permuted, language: "es" });
  for (const semanticId of ["parent","name:N","name:phenyl","name:phenyl-locant-4","name:hydroxy","name:4-hydroxyphenyl"]) {
    const original = targetFor(semanticId), nextControls = remapped.steps.flatMap(step=>[step.fragments,...(step.fragments?.additionalFragments??[])].map(fragment=>({step,fragment})));
    const found = nextControls.find(item=>item.fragment?.semanticId===semanticId);
    const next = found.step.fragmentTargets[reasoningFragmentId(found.step.number,found.fragment)];
    assert.deepEqual([...next.atomIds].sort((a,b)=>a-b), original.atomIds.map(id=>ids.get(id)).sort((a,b)=>a-b), semanticId);
  }
});

test("FULL phenyl acid fragments have independent parent, ring and rooted alkyl targets in ES/EN", () => {
  const name="2-[4-(2-methylpropyl)phenyl]propanoic acid", graph=imported("CC(C)Cc1ccc(cc1)C(C)C(=O)O");
  const derivation=reconcileSystematicName(graph,name); assert.equal(derivation?.status,"FULL");
  const aryl=derivation.components.find(c=>c.id==="aryl"), alkyl=derivation.components.find(c=>c.id==="aryl-prefix");
  const ringIds=aryl.atomIds.filter(id=>(graph.atoms.find(a=>a.id===id)?.element??"C")==="C"&&!alkyl.atomIds.includes(id));
  const ringEdges=graph.bonds.filter(([a,b])=>ringIds.includes(a)&&ringIds.includes(b)).map(([a,b])=>[a,b]);
  const parentC2=derivation.components.find(c=>c.id==="parent").numbering.find(([,n])=>n===2)[0];
  const ringC1=aryl.numbering.find(([,n])=>n===1)[0], ringC4=aryl.numbering.find(([,n])=>n===4)[0];
  const junction=graph.bonds.find(([a,b])=>alkyl.atomIds.includes(a)!==alkyl.atomIds.includes(b));
  const targetsByLanguage=[];
  for(const language of ["es","en"]){
    const model=buildValidatedPriorityReasoning({derivation,graph,language});
    const entries=model.steps.flatMap(step=>[step.fragments,...(step.fragments?.additionalFragments??[])].map(fragment=>({step,fragment})));
    const get=semanticId=>{const item=entries.find(entry=>entry.fragment?.semanticId===semanticId);assert.ok(item,semanticId);return item.step.fragmentTargets[reasoningFragmentId(item.step.number,item.fragment)];};
    const acid=get("name:parent-acid"); assert.deepEqual([...acid.atomIds].sort((a,b)=>a-b),[...new Set([...derivation.components.find(c=>c.id==="parent").atomIds,...derivation.components.find(c=>c.id==="suffix").atomIds])].sort((a,b)=>a-b));
    assert.equal(acid.atomIds.length,5); assert.equal(acid.bondIds.length,4);
    const parentLocant=get("name:parent-locant-2"); assert.deepEqual([...parentLocant.atomIds].sort((a,b)=>a-b),[parentC2,ringC1].sort((a,b)=>a-b));
    assert.equal(parentLocant.bondIds.length,1);
    const phenyl=get("name:phenyl"); assert.deepEqual([...phenyl.atomIds].sort((a,b)=>a-b),[...ringIds].sort((a,b)=>a-b)); assert.deepEqual([...phenyl.bondIds].map(([a,b])=>[Math.min(a,b),Math.max(a,b)]).sort(),ringEdges.map(([a,b])=>[Math.min(a,b),Math.max(a,b)]).sort());
    const ring4=get("name:phenyl-locant-4"); assert.deepEqual(ring4.atomIds,[ringC4]); assert.ok(ring4.bondIds.some(([a,b])=>a===junction[0]&&b===junction[1]||a===junction[1]&&b===junction[0]));
    const alkylTarget=get("name:2-methylpropyl"); assert.deepEqual([...alkylTarget.atomIds].sort((a,b)=>a-b),[...alkyl.atomIds].sort((a,b)=>a-b));
    assert.equal(alkylTarget.atomIds.length,4); assert.equal(alkylTarget.bondIds.length,4); assert.ok(alkylTarget.locants.some(([id,locant])=>locant===2&&alkyl.atomIds.includes(id)));
    targetsByLanguage.push([acid,parentLocant,phenyl,ring4,alkylTarget]);
  }
  assert.deepEqual(targetsByLanguage[0].map(t=>[...t.atomIds].sort((a,b)=>a-b)),targetsByLanguage[1].map(t=>[...t.atomIds].sort((a,b)=>a-b)));
  const idMap=new Map(graph.atoms.map(a=>[a.id,a.id*41+1000]));
  const permuted={atoms:graph.atoms.map(a=>({...a,id:idMap.get(a.id)})).reverse(),bonds:graph.bonds.map(([a,b,o])=>[idMap.get(b),idMap.get(a),o]).reverse()};
  const remappedDerivation=reconcileSystematicName(permuted,name), remapped=buildValidatedPriorityReasoning({derivation:remappedDerivation,graph:permuted,language:"es"});
  const entries=remapped.steps.flatMap(step=>[step.fragments,...(step.fragments?.additionalFragments??[])].map(fragment=>({step,fragment})));
  for(const [index,key] of ["name:parent-acid","name:parent-locant-2","name:phenyl","name:phenyl-locant-4","name:2-methylpropyl"].entries()){
    const original=targetsByLanguage[0][index], item=entries.find(entry=>entry.fragment?.semanticId===key), next=item.step.fragmentTargets[reasoningFragmentId(item.step.number,item.fragment)];
    assert.deepEqual([...next.atomIds].sort((a,b)=>a-b),original.atomIds.map(id=>idMap.get(id)).sort((a,b)=>a-b),key);
  }
});

test("all ibuprofen and paracetamol controls name and target the region they describe", () => {
  const cases = [
    { name: "2-[4-(2-methylpropyl)phenyl]propanoic acid", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
      expectedLabels: { aryl: "4-(2-metilpropil)fenilo", "name:phenyl": "fenilo", "name:2-methylpropyl": "2-metilpropilo" } },
    { name: "N-(4-hydroxyphenyl)acetamide", smiles: "CC(=O)Nc1ccc(O)cc1",
      expectedLabels: { aryl: "4-hidroxifenilo", "name:phenyl": "fenilo", "name:hydroxy": "hidroxi", "name:4-hydroxyphenyl": "4-hidroxifenilo" } },
  ];
  for (const fixture of cases) {
    const graph = imported(fixture.smiles), derivation = reconcileSystematicName(graph, fixture.name);
    const model = buildValidatedPriorityReasoning({ derivation, graph, language: "es" });
    const entries = model.steps.flatMap(step => [step.fragments, ...(step.fragments?.additionalFragments ?? [])]
      .filter(Boolean).map(fragment => ({ step, fragment })));
    const bySemanticId = new Map(entries.map(entry => [entry.fragment.semanticId, entry]));
    for (const [semanticId, label] of Object.entries(fixture.expectedLabels)) {
      const matchingEntries = entries.filter(entry => entry.fragment.semanticId === semanticId);
      assert.ok(matchingEntries.length, `${fixture.name}: ${semanticId} is visible`);
      for (const entry of matchingEntries) {
        assert.equal(entry.fragment.text, label, `${fixture.name}: ${semanticId} label`);
        const target = entry.step.fragmentTargets[reasoningFragmentId(entry.step.number, entry.fragment)];
        assert.deepEqual([...target.atomIds].sort((a,b) => a-b), [...entry.fragment.atomIds].sort((a,b) => a-b),
          `${fixture.name}: ${semanticId} atom destination`);
        assert.deepEqual(target.bondIds.map(([a,b]) => [Math.min(a,b),Math.max(a,b)]).sort(),
          entry.fragment.bondIds.map(([a,b]) => [Math.min(a,b),Math.max(a,b)]).sort(),
          `${fixture.name}: ${semanticId} bond destination`);
      }
    }
    for (const { step, fragment } of entries) {
      const target = step.fragmentTargets[reasoningFragmentId(step.number, fragment)];
      assert.ok(target, `${fixture.name}: visible ${fragment.semanticId} has a target`);
      assert.ok(target.atomIds.every(id => graph.atoms.some(atom => atom.id === id)), `${fixture.name}: ${fragment.semanticId} atoms exist`);
      assert.ok(target.bondIds.every(([a,b]) => graph.bonds.some(([x,y]) => Math.min(a,b) === Math.min(x,y) && Math.max(a,b) === Math.max(x,y))),
        `${fixture.name}: ${fragment.semanticId} bonds exist`);
    }
    const arylTarget = bySemanticId.get("aryl").step.fragmentTargets[reasoningFragmentId(bySemanticId.get("aryl").step.number, bySemanticId.get("aryl").fragment)];
    assert.deepEqual(arylTarget.atomIds, validatedNameTargets(derivation).aryl.atomIds, `${fixture.name}: complete aryl target`);
    if (fixture.name.startsWith("2-")) {
      const alkyl = bySemanticId.get("name:2-methylpropyl");
      const target = alkyl.step.fragmentTargets[reasoningFragmentId(alkyl.step.number, alkyl.fragment)];
      assert.equal(target.atomIds.length, 4, "ibuprofen alkyl control selects its four carbons");
      assert.match(alkyl.fragment.text, /2-metilpropilo/, "the internal substituent locant survives localization");
      assert.doesNotMatch(entries.map(entry => entry.fragment.text).join(" "), /methyl|phenyl|hydroxy|propyl/i,
        "Spanish Ibuprofen controls contain no untranslated chemical terms");
      const numbering = model.steps.find(step => step.title === "Numeración");
      const locators = [numbering.fragments, ...(numbering.fragments?.additionalFragments ?? [])].filter(Boolean);
      assert.ok(locators.every(fragment => fragment.kind === "numbering"), "numbering shows locants, not whole structures");
      for (const [system, expected] of [["Cadena del ácido propanoico", [1,2,3]], ["Anillo fenilo", [1,4]], ["Sustituyente 2-metilpropilo", [1,2,3]]]) {
        const values = locators.filter(fragment => fragment.label.startsWith(system)).map(fragment => Number(fragment.text));
        assert.deepEqual(values, expected, `${system} keeps its own numbering system without duplicate controls`);
      }
      assert.ok(!model.steps.some(step => step.title === "Orden alfabético"), "nested alkyl is not counted as a peer substituent");
    } else {
      const ring = bySemanticId.get("name:phenyl"), target = ring.step.fragmentTargets[reasoningFragmentId(ring.step.number, ring.fragment)];
      assert.equal(target.atomIds.length, 6, "paracetamol phenyl control selects only the ring");
      assert.equal(target.bondIds.length, 6, "paracetamol phenyl control selects only internal ring bonds");
    }
    const english = buildValidatedPriorityReasoning({ derivation, graph, language: "en" });
    const englishControls = english.steps.flatMap(step => [step.fragments, ...(step.fragments?.additionalFragments ?? [])]).filter(Boolean);
    assert.ok(englishControls.some(fragment => fragment.semanticId === "aryl"
      && fragment.text === (fixture.name.startsWith("2-") ? "4-(2-methylpropyl)phenyl" : "4-hydroxyphenyl")),
    `${fixture.name}: the English complete-aryl label is preserved`);
    if (fixture.name.startsWith("2-")) {
      const englishNumbering = english.steps.find(step => step.title === "Numbering");
      const englishLocators = [englishNumbering.fragments, ...(englishNumbering.fragments?.additionalFragments ?? [])].filter(Boolean);
      assert.ok(englishLocators.some(fragment => fragment.label === "Propanoic acid chain C2"));
      assert.ok(englishLocators.some(fragment => fragment.label === "Phenyl ring C4"));
      assert.ok(englishLocators.some(fragment => fragment.label === "2-methylpropyl substituent C2"));
      assert.equal(presentValidatedSystematicName(derivation, "es").name, "ácido 2-[4-(2-metilpropil)fenil]propanoico");
      assert.equal(presentValidatedSystematicName(derivation, "en").name, fixture.name);
    }
  }
});

test("alphabetical comparison remains for independent substituents on a shared parent", () => {
  const graph = imported("CC(=O)Nc1cc(O)c(C)cc1");
  const derivation = reconcileSystematicName(graph, "N-(3-hydroxy-4-methylphenyl)acetamide");
  const model = buildValidatedPriorityReasoning({ derivation, graph, language: "es",
    alphabeticalOrder: { paragraphs: ["Hidroxi y metilo se ordenan alfabéticamente."], fragment: "hidroxi → metilo", groups: [] } });
  assert.ok(model.steps.some(step => step.title === "Orden alfabético"));
});

test("FULL evidence suppresses PARTIAL even when an external source keeps reasoning unsupported", () => {
  assert.equal(shouldShowStructuralPriorityReasoning({ hasValidatedDerivation: true, reasoningUnsupported: true, structuralStatus: "PARTIAL" }), false);
  assert.equal(shouldShowStructuralPriorityReasoning({ hasValidatedDerivation: false, reasoningUnsupported: true, structuralStatus: "PARTIAL" }), true);
  assert.equal(shouldShowStructuralPriorityReasoning({ hasValidatedDerivation: false, reasoningUnsupported: false, structuralStatus: "PARTIAL" }), false);
});

test("Spanish fragment controls expose component IDs and preserve their verified target", () => {
  const fragment = { text: "Fenilo", label: "Seleccionar fenilo", kind: "substituent", semanticId: "aryl" };
  const id = reasoningFragmentId("04", fragment);
  const target = { stepNumber: "04", fragmentId: id, atomIds: [1, 2, 3], bondIds: [[1, 2]], locants: [[1, 1]] };
  const markup = renderToStaticMarkup(page.ReasoningNameFragmentView({ fragment, stepNumber: "04", language: "es",
    visualTargets: { [id]: target }, onActivateTarget() {} }));
  assert.match(markup, /data-name-fragment="aryl"/);
  assert.match(markup, /aria-label="Fenilo: Seleccionar fenilo\. Resaltar en la molécula durante dos segundos"/);
});

test("non-FULL structures retain a unique candidate carbon path and clickable attached fragments without name locants", () => {
  const graph = imported("CCCCCCCC(=O)Nc1ccc(O)cc1"), sourceName = "external-source-label";
  assert.equal(reconcileSystematicName(graph, sourceName), null);
  const structural = deriveStructuralComponents(graph, sourceName);
  assert.equal(structural.status, "PARTIAL");
  const backbone = structural.components.find(component => component.kind === "candidate carbon skeleton");
  const attached = structural.components.find(component => component.kind === "connected fragment");
  assert.equal(backbone.atomIds.length, 8);
  assert.ok(attached?.bondIds.some(([a, b]) => backbone.atomIds.includes(a) !== backbone.atomIds.includes(b)));
  assert.deepEqual(backbone.numbering, undefined, "a structural candidate receives no IUPAC locants");
  assert.match(backbone.evidenceEs, /solo un candidato estructural/);
  const priorities = buildStructuralPriorityReasoning({ derivation: structural, language: "es" });
  assert.ok(priorities.steps.findIndex(step => step.componentKind === "candidate carbon skeleton")
    > priorities.steps.findIndex(step => step.componentKind === "amide"));
  for (const step of priorities.steps) {
    assert.ok(step.target?.atomIds.length);
    assert.ok(step.fragments);
    assert.ok(!step.target.locants.length || step.componentKind === "carbohydrate backbone");
  }

  const idMap = new Map(graph.atoms.map(atom => [atom.id, atom.id * 31 + 400]));
  const permuted = { atoms: graph.atoms.map(atom => ({ ...atom, id: idMap.get(atom.id) })).reverse(),
    bonds: graph.bonds.map(([a, b, order, stereo]) => [idMap.get(b), idMap.get(a), order, stereo]).reverse() };
  const remapped = deriveStructuralComponents(permuted, sourceName);
  const remappedBackbone = remapped.components.find(component => component.kind === "candidate carbon skeleton");
  assert.equal(remappedBackbone.atomIds.length, backbone.atomIds.length);
  assert.deepEqual([...remappedBackbone.atomIds].sort((a, b) => a - b), [...backbone.atomIds].map(id => idMap.get(id)).sort((a, b) => a - b));
});

test("TNT remains on the original local priority path when no FULL production applies", () => {
  const graph = imported("CC1=C(C=C(C=C1[N+](=O)[O-])[N+](=O)[O-])[N+](=O)[O-]"), analysis = page.analyzeMolecule(graph);
  assert.equal(reconcileSystematicName(graph, analysis.name), null);
  const steps = page.buildIupacReasoningSteps(graph, analysis);
  assert.ok(steps.some(step => /nitro/i.test(step.explanation)));
  assert.ok(steps.some(step => step.nameRole === "numbering"));
  assert.ok(steps.some(step => step.alphabeticalOrder));
  assert.equal(analysis.name, "2-metil-1,3,5-trinitrobenceno");
});
