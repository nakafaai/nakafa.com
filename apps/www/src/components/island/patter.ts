/** Drops a second in the loop: a steady rain on a roof. */
const DROPS = 600;

/** How long one drop rings on a tile, in seconds. */
const RING = 0.004;

/**
 * Two seconds of rain on a roof (ADR 0047, D42): sparse clicks, each a drop
 * that strikes at its own loudness and dies in a few milliseconds, from a
 * fixed seed so every learner hears the same rain.
 */
function dropsOf(audio: AudioContext) {
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  const ring = Math.floor(audio.sampleRate * RING);
  let seed = 11;
  const next = () => {
    seed = (seed * 48_271) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
  for (let drop = 0; drop < DROPS * 2; drop += 1) {
    const at = Math.floor(next() * samples.length);
    const loud = 0.3 + 0.7 * next();
    for (let sample = 0; sample < ring; sample += 1) {
      const fade = Math.exp((-sample / ring) * 5);
      samples[(at + sample) % samples.length] += loud * fade * (next() * 2 - 1);
    }
  }
  return buffer;
}

/**
 * The patter of rain on the village's roofs: a loop of drops through a band
 * where tiles ring, silent until the sound raises it with the share of the
 * island under a roof. The rain's own hiss stays for the grass and crowns.
 */
export function createPatter(audio: AudioContext, out: AudioNode) {
  const source = audio.createBufferSource();
  source.buffer = dropsOf(audio);
  source.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2800;
  filter.Q.value = 0.9;
  const gain = audio.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(out);
  source.start();
  return (loud: number) =>
    gain.gain.setTargetAtTime(loud, audio.currentTime, 0.8);
}
