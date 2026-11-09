/**
 * Deterministic noise for the island's terrain and textures: the same seed and
 * the same cell always give the same value, on the server and in every browser,
 * so a world never needs to be stored to look the same everywhere.
 */

/** The prime the hash works modulo: every product below stays an exact integer in a double. */
const MODULUS = 2_147_483_647;

/** A number brought into [0, MODULUS). */
function wrap(value: number) {
  return ((value % MODULUS) + MODULUS) % MODULUS;
}

/** One step of the Park and Miller generator, which scatters neighbouring values far apart. */
function mix(value: number) {
  return (value * 48_271) % MODULUS;
}

/**
 * A hash of a seed and up to three integer coordinates, in [0, MODULUS). It
 * uses only exact integer arithmetic on doubles, so every browser and the
 * server compute the same value.
 */
export function hashOf(seed: number, x: number, y = 0, z = 0) {
  let hash = mix(mix(wrap(seed + 40_503)));
  hash = mix(mix(wrap(hash + x * 92_821 + 1)));
  hash = mix(mix(wrap(hash + y * 68_917 + 2)));
  hash = mix(mix(wrap(hash + z * 39_119 + 3)));
  return mix(hash);
}

/** A value in [0, 1) for a seed and a cell. */
export function unitOf(seed: number, x: number, y = 0, z = 0) {
  return hashOf(seed, x, y, z) / MODULUS;
}

/** The smooth step between 0 and 1 that value noise blends with. */
function fade(t: number) {
  return t * t * (3 - 2 * t);
}

/**
 * Smooth value noise in [0, 1) over a plane: corner values every `scale` cells,
 * blended between them, so neighbouring cells change gently.
 */
export function smoothOf(seed: number, x: number, z: number, scale: number) {
  const gx = Math.floor(x / scale);
  const gz = Math.floor(z / scale);
  const tx = fade(x / scale - gx);
  const tz = fade(z / scale - gz);
  const a = unitOf(seed, gx, 0, gz);
  const b = unitOf(seed, gx + 1, 0, gz);
  const c = unitOf(seed, gx, 0, gz + 1);
  const d = unitOf(seed, gx + 1, 0, gz + 1);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

/** The seed of a learner's island, from the text that names it. */
export function seedOf(text: string) {
  let hash = 7;
  for (let index = 0; index < text.length; index += 1) {
    hash = mix(wrap(hash * 31 + text.charCodeAt(index)));
  }
  return hash;
}
