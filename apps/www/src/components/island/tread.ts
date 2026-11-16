import type { Footing } from "@/lib/island/steps";

/**
 * How each footing sounds (ADR 0047, D40): a short burst of noise through one
 * filter, a second grain for gravel's crunch, and a tone under it where the
 * ground answers with one, the thud of soil, the hollow of a board, the click
 * of stone. Quiet under the ambience, because the fox trots about seven steps
 * a second.
 */
const SOUNDS = {
  grass: {
    filter: "bandpass",
    frequency: 1100,
    grains: 1,
    length: 0.07,
    loud: 0.045,
    q: 0.8,
    tone: { from: 0, length: 0, loud: 0, to: 0 },
  },
  sand: {
    filter: "bandpass",
    frequency: 2600,
    grains: 1,
    length: 0.11,
    loud: 0.03,
    q: 0.6,
    tone: { from: 0, length: 0, loud: 0, to: 0 },
  },
  soil: {
    filter: "lowpass",
    frequency: 600,
    grains: 1,
    length: 0.06,
    loud: 0.05,
    q: 0.7,
    tone: { from: 120, length: 0.05, loud: 0.03, to: 80 },
  },
  gravel: {
    filter: "bandpass",
    frequency: 2000,
    grains: 2,
    length: 0.05,
    loud: 0.045,
    q: 1.2,
    tone: { from: 0, length: 0, loud: 0, to: 0 },
  },
  wood: {
    filter: "bandpass",
    frequency: 900,
    grains: 1,
    length: 0.04,
    loud: 0.025,
    q: 2,
    tone: { from: 240, length: 0.07, loud: 0.05, to: 170 },
  },
  stone: {
    filter: "highpass",
    frequency: 2400,
    grains: 1,
    length: 0.03,
    loud: 0.03,
    q: 0.7,
    tone: { from: 1100, length: 0.03, loud: 0.015, to: 900 },
  },
} as const satisfies Record<Footing, unknown>;

/**
 * The fox's footsteps in Web Audio: each call plays one step on a footing.
 * Steps fall left and right in turn, and each one shifts its pitch a little
 * by its place in the run, so a long walk never repeats one sound.
 */
export function createTread(
  audio: AudioContext,
  noise: AudioBuffer,
  out: AudioNode
) {
  let foot = 0;
  return (footing: Footing) => {
    const sound = SOUNDS[footing];
    const now = audio.currentTime;
    foot += 1;
    const vary = 1 + (((foot * 37) % 9) - 4) * 0.025;
    const pan = audio.createStereoPanner();
    pan.pan.value = foot % 2 === 0 ? -0.18 : 0.18;
    pan.connect(out);
    for (let grain = 0; grain < sound.grains; grain += 1) {
      const at = now + grain * 0.028;
      const source = audio.createBufferSource();
      source.buffer = noise;
      const filter = audio.createBiquadFilter();
      filter.type = sound.filter;
      filter.frequency.value = sound.frequency * vary * (1 + grain * 0.25);
      filter.Q.value = sound.q;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(sound.loud, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + sound.length);
      source.connect(filter).connect(gain).connect(pan);
      source.start(at, (foot * 0.137 + grain * 0.41) % 1.8);
      source.stop(at + sound.length + 0.02);
    }
    if (sound.tone.loud > 0) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.type = footing === "wood" ? "triangle" : "sine";
      tone.frequency.setValueAtTime(sound.tone.from * vary, now);
      tone.frequency.exponentialRampToValueAtTime(
        sound.tone.to * vary,
        now + sound.tone.length
      );
      gain.gain.setValueAtTime(sound.tone.loud, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.tone.length);
      tone.connect(gain).connect(pan);
      tone.start(now);
      tone.stop(now + sound.tone.length + 0.02);
    }
  };
}
