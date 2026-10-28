export type SoundEvent = "atom" | "bond" | "modify" | "remove" | "correct" | "incorrect" | "invalid";
export const SOUND_STORAGE_KEY = "orgorush-sound-effects";

export function readSoundEnabled(storage?: Pick<Storage, "getItem">): boolean {
  try { return storage?.getItem(SOUND_STORAGE_KEY) !== "off"; } catch { return true; }
}
export function writeSoundEnabled(enabled: boolean, storage?: Pick<Storage, "setItem">): void {
  try { storage?.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off"); } catch { /* Preference remains active in this session. */ }
}

const tones: Record<SoundEvent, readonly [number, number, number][]> = {
  atom: [[540, 0, 0.075]], bond: [[720, 0, 0.065]], modify: [[620, 0, 0.085]],
  remove: [[330, 0, 0.09]], invalid: [[300, 0, 0.055]], incorrect: [[280, 0, 0.13]],
  correct: [[520, 0, 0.10], [660, 0.09, 0.12]],
};
let enabled = true;
let preferenceVersion = 0;
let context: AudioContext | undefined;
const active = new Set<OscillatorNode>();
export function setSoundEnabled(value: boolean): void {
  enabled = value;
  preferenceVersion++;
  if (!value) {
    for (const oscillator of active) { try { oscillator.stop(); } catch { /* Already stopped. */ } }
    active.clear();
  }
}
export function playSound(event: SoundEvent): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    const Audio = window.AudioContext;
    if (!Audio) return;
    context ??= new Audio();
    if (context.state === "closed") { context = undefined; return; }
    if (context.state !== "running") {
      // Resume is requested synchronously within the user's gesture; blocked contexts remain silent.
      const version = preferenceVersion;
      void context.resume().then(() => { if (enabled && version === preferenceVersion && context?.state === "running") playSound(event); }).catch(() => {});
      return;
    }
    const ctx = context;
    for (const [frequency, offset, duration] of tones[event]) {
      if (active.size >= 6) break;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(event === "invalid" ? 0.025 : 0.045, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      active.add(oscillator);
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + duration);
    }
  } catch { /* Audio is optional and can be unavailable or blocked. */ }
}
