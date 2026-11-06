import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import { moleculeFromSmiles } from "../app/openchemlib-adapter.ts";
import { deriveStructuralComponents } from "../app/structural-derivation.ts";
import { buildStructuralPriorityReasoning, buildValidatedPriorityReasoning } from "../app/reasoning-derivation-adapter.ts";
import { reconcileSystematicName, validatedNameTargets } from "../app/validated-name-derivation.ts";
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
      const expected = validatedNameTargets(derivation)[id];
      assert.deepEqual(target.atomIds, expected.atomIds);
      assert.deepEqual(target.bondIds, expected.bondIds);
    }
    const numbering = model.steps.find(step => step.title === "Numeración");
    const localizerButtons = [numbering.fragments, ...(numbering.fragments?.additionalFragments ?? [])];
    assert.ok(localizerButtons.some(fragment => fragment?.kind === "numbering"), `${fixture.name}: locant controls exist`);
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
