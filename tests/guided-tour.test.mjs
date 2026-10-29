import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GUIDED_TOUR_STEP_COUNT,
  isTourCarbonPair,
  GUIDED_TOUR_STORAGE_KEY,
  INITIAL_GUIDED_TOUR_STATE,
  guidedTourCopy,
  guidedTourControls,
  guidedTourIsSuspendedByOverlay,
  guidedTourReducer,
  guidedTourScrollDelta,
  guidedTourTargetForStep,
  placeGuidedTourCard,
  readGuidedTourDecision,
  writeGuidedTourDecision,
} from "../app/guided-tour-state.ts";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function initialize(decision = null) {
  return guidedTourReducer(INITIAL_GUIDED_TOUR_STATE, { type: "initialize", decision });
}

test("first visit, dismissal, completion and reopening persist", () => {
  const storage = new MemoryStorage();
  let state = initialize(readGuidedTourDecision(storage));
  assert.equal(state.open, true);
  assert.equal(GUIDED_TOUR_STEP_COUNT, 5);
  state = guidedTourReducer(state, { type: "dismiss" });
  assert.equal(state.completion, "skipped");
  writeGuidedTourDecision(storage, state.completion);
  assert.equal(initialize(readGuidedTourDecision(storage)).open, false);
  state = guidedTourReducer(state, { type: "open" });
  assert.equal(state.step, 0);
  for (let i = 0; i < 5; i++) state = guidedTourReducer(state, { type: "next" });
  assert.equal(state.completion, "completed");
  writeGuidedTourDecision(storage, state.completion);
  assert.equal(initialize(readGuidedTourDecision(storage)).open, false);
});

test("only valid molecular milestones advance the interactive steps", () => {
  const ethane = { atoms: [{id: 1, element: "C"}, {id: 2, element: "C"}], bonds: [[1, 2, 1]] };
  const ethene = { ...ethane, bonds: [[1, 2, 2]] };
  assert.equal(isTourCarbonPair(ethane, 1), true);
  assert.equal(isTourCarbonPair(ethene, 2), true);
  assert.equal(isTourCarbonPair(ethene, 1), false);
  assert.equal(isTourCarbonPair({...ethane, atoms: [ethane.atoms[0], {id: 2, element: "O"}]}, 1), false);
  assert.equal(isTourCarbonPair({...ethane, bonds: [[1, 3, 1]]}, 1), false);
  let state = initialize();
  assert.equal(guidedTourReducer(state, { type: "bond-order-changed" }), state);
  state = guidedTourReducer(state, { type: "carbon-added" });
  assert.equal(state.step, 1);
  state = guidedTourReducer(state, { type: "bond-order-changed" });
  assert.equal(state.step, 2);
  state = guidedTourReducer(state, { type: "next" });
  assert.equal(guidedTourReducer(state, { type: "reasoning-opened" }).step, 3);
  state = guidedTourReducer(state, { type: "reasoning-fragment-activated" });
  assert.equal(state.step, 4);
  assert.equal(guidedTourReducer(state, { type: "previous" }).step, 3);
});

test("copy and controls are localized and reflect available reasoning", () => {
  assert.match(guidedTourCopy("en", 0, {isPristineInitialMolecule: true, carbonPhase: "add"}).description, /carbon/);
  assert.match(guidedTourCopy("es", 2, {isEthene: true}).title, /eteno/);
  assert.match(guidedTourCopy("en", 3, {hasInteractiveName: true, reasoningOpen: true}).description, /fragment/);
  assert.doesNotMatch(guidedTourCopy("en", 3, {hasInteractiveName: false}).description, /fragment/);
  assert.equal(guidedTourControls("en").progress(2), "Step 3 of 5");
  assert.equal(guidedTourControls("es").finish, "Empezar a explorar");
  assert.equal(guidedTourTargetForStep(0, "add"), "add-carbon");
  assert.equal(guidedTourTargetForStep(1), "bond-controls");
});

test("reopened tour explains unavailable edits in both languages", () => {
  for (const language of ["en", "es"]) {
    const saturated = guidedTourCopy(language, 0, { carbonPhase: "add", hasCarbon: true, canAddCarbon: false });
    const noBond = guidedTourCopy(language, 1, { isEthane: false, hasEditableBond: false });
    assert.match(saturated.description, language === "en" ? /cannot accept/ : /no puede aceptar/);
    assert.match(noBond.description, language === "en" ? /No carbon–carbon bond/ : /No hay un enlace/);
  }
});

test("context cards stay beside their target and inside the viewport above the fixed name dock", () => {
  const desktopAnchor = { top: 230, right: 410, bottom: 290, left: 350 };
  const desktop = placeGuidedTourCard({
    anchor: desktopAnchor,
    card: { width: 360, height: 220 },
    viewport: { width: 1366, height: 720 },
    preferHorizontal: true,
  });
  assert.equal(desktop.side, "right");
  assert.ok(desktop.left >= desktopAnchor.right);
  assert.ok(desktop.left + 360 <= 1354);
  assert.ok(desktop.top >= 12 && desktop.top + 220 <= 650);

  const mobileAnchor = { top: 780, right: 270, bottom: 810, left: 120 };
  const mobile = placeGuidedTourCard({
    anchor: mobileAnchor,
    card: { width: 360, height: 190 },
    viewport: { width: 390, height: 844 },
    dockHeight: 58,
  });
  assert.equal(mobile.side, "above");
  assert.ok(mobile.left >= 12 && mobile.left + 360 <= 378);
  assert.ok(mobile.top + 190 <= mobileAnchor.top - 10);
  assert.ok(mobile.top >= 12);
});

test("guided scrolling leaves visible targets alone and brings off-screen targets into the usable viewport", () => {
  assert.equal(guidedTourScrollDelta({ anchor: { top: 100, bottom: 200 }, viewportHeight: 720 }), 0);
  assert.ok(guidedTourScrollDelta({ anchor: { top: 600, bottom: 700 }, viewportHeight: 720 }) > 0);
  assert.ok(guidedTourScrollDelta({ anchor: { top: -40, bottom: 60 }, viewportHeight: 720 }) < 0);
  assert.equal(guidedTourScrollDelta({ anchor: { top: 422, bottom: 475 }, viewportHeight: 844, targetTop: 422 }), 0);
  assert.equal(guidedTourScrollDelta({ anchor: { top: 531, bottom: 584 }, viewportHeight: 844, targetTop: 422 }), 109);
});

test("the guide is suspended while another modal or the expanded canvas is active", () => {
  const closed = { historyOpen: false, settingsOpen: false, exportOpen: false, canvasExpanded: false };
  assert.equal(guidedTourIsSuspendedByOverlay(closed), false);
  for (const key of Object.keys(closed)) {
    assert.equal(guidedTourIsSuspendedByOverlay({ ...closed, [key]: true }), true, key);
  }
});

test("blocked storage does not crash first-visit or dismissal behavior", () => {
  const blockedStorage = {
    getItem() { throw new Error("storage unavailable"); },
    setItem() { throw new Error("storage unavailable"); },
  };
  let state = guidedTourReducer(INITIAL_GUIDED_TOUR_STATE, {
    type: "initialize",
    decision: readGuidedTourDecision(blockedStorage),
  });
  assert.equal(state.open, true);
  state = guidedTourReducer(state, { type: "dismiss" });
  assert.equal(state.open, false);
  assert.equal(state.completion, "skipped");
  assert.equal(writeGuidedTourDecision(blockedStorage, state.completion), false);
});

test("guide navigation is independent of the current molecule, undo stack and history", () => {
  const workspace = {
    molecule: { atoms: [{ id: 4, element: "C" }, { id: 7, element: "O" }], bonds: [[4, 7, 2]] },
    undo: [{ atoms: [{ id: 1, element: "C" }], bonds: [] }],
    history: [{ id: "entry-1", name: "ethanal" }],
  };
  const before = structuredClone(workspace);
  let state = initialize();
  state = guidedTourReducer(state, { type: "next" });
  state = guidedTourReducer(state, { type: "open" });
  state = guidedTourReducer(state, { type: "dismiss" });
  assert.deepEqual(workspace, before);
  assert.equal(state.open, false);
});
