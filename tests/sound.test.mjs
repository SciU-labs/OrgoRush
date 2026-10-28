import test from "node:test";
import assert from "node:assert/strict";
import { readSoundEnabled, writeSoundEnabled, setSoundEnabled, playSound, SOUND_STORAGE_KEY } from "../app/sound.ts";

test("sound preference defaults on and persists on and off", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(readSoundEnabled(storage), true);
  writeSoundEnabled(false, storage);
  assert.equal(values.get(SOUND_STORAGE_KEY), "off");
  assert.equal(readSoundEnabled(storage), false);
  writeSoundEnabled(true, storage);
  assert.equal(readSoundEnabled(storage), true);
  assert.equal(readSoundEnabled({ getItem() { throw Error(); } }), true);
});

test("audio is optional, bounded, and disabled immediately", () => {
  let contexts = 0, starts = 0, stops = 0;
  const param = { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
  class MockAudio {
    constructor() { contexts++; this.state = "running"; this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { frequency: param, connect() {}, disconnect() {}, start() { starts++; }, stop() { stops++; } }; }
    createGain() { return { gain: param, connect() {}, disconnect() {} }; }
  }
  globalThis.window = {};
  assert.doesNotThrow(() => playSound("atom"));
  window.AudioContext = MockAudio;
  setSoundEnabled(false); playSound("atom"); assert.equal(contexts, 0);
  setSoundEnabled(true); playSound("atom"); playSound("bond"); playSound("modify");
  playSound("remove"); playSound("correct"); playSound("invalid");
  assert.equal(contexts, 1); assert.equal(starts, 6);
  setSoundEnabled(false); assert.equal(stops, 12);
  playSound("incorrect"); assert.equal(starts, 6);
  setSoundEnabled(true); playSound("incorrect"); assert.equal(starts, 7);
  delete globalThis.window;
});

test("a blocked audio context is harmless", async () => {
  const fresh = await import("../app/sound.ts?blocked");
  globalThis.window = { AudioContext: class { state = "suspended"; resume() { return Promise.reject(Error("blocked")); } } };
  assert.doesNotThrow(() => fresh.playSound("atom"));
  await new Promise(resolve => setTimeout(resolve, 0));
  delete globalThis.window;
});
