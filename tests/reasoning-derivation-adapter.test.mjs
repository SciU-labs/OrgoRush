import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveStructuralComponents } from "../app/structural-derivation.ts";
import { buildStructuralPriorityReasoning, buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { presentValidatedSystematicName, reconcileSystematicName, validatedNameTargets } from "../app/validated-name-derivation.ts";
import { reasoningFragmentId } from "../app/reasoning-visual-targets.ts";

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
      const expected = id === "parent" && derivation.principalGroup === "amide"
        ? { atomIds: [...new Set([...validatedNameTargets(derivation).parent.atomIds, ...validatedNameTargets(derivation).suffix.atomIds])],
            bondIds: [...new Map([...validatedNameTargets(derivation).parent.bondIds, ...validatedNameTargets(derivation).suffix.bondIds]
              .map(([a,b]) => [`${Math.min(a,b)}:${Math.max(a,b)}`, [a,b]])).values()] }
        : validatedNameTargets(derivation)[id];
      assert.deepEqual(target.atomIds, expected.atomIds);
      assert.deepEqual(target.bondIds, expected.bondIds);
    }
    const numbering = model.steps.find(step => step.title === "Numeración");
    const localizerButtons = [numbering.fragments, ...(numbering.fragments?.additionalFragments ?? [])];
    assert.ok(localizerButtons.some(fragment => fragment?.kind === "numbering"), `${fixture.name}: locant controls exist`);
  }
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
      assert.equal(presentValidatedSystematicName(derivation, "es").name, "ácido 2-[4-(2-metilpropil)fenil]propanoico");
      assert.equal(presentValidatedSystematicName(derivation, "en").name, fixture.name);
    }
  }
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
