import { chanceAt } from "@repo/design-system/components/three/field/noise";

/**
 * The tint of starlight for a star's place between the hottest stars, at 0,
 * and the coolest, at 1, as linear red, green and blue: blue-white, then
 * white, the Sun's pale yellow, and the orange of a cool giant.
 */
function tintOf(cool: number) {
  return [
    Math.min(1, 0.62 + 0.9 * cool),
    0.74 + 0.82 * cool - 0.8 * cool * cool,
    1 - 0.48 * (Math.max(0, cool - 0.35) / 0.65) ** 1.3,
  ] as const;
}

/** The share of stars that crowd toward the plane of the galaxy. */
const BAND_SHARE = 0.55;

/** How thin the band of the galaxy is, as a share of the way to its poles. */
const BAND_WIDTH = 0.16;

/** How far the plane of the galaxy leans from the scene's level, in radians. */
const BAND_TILT = 1.05;

/**
 * The stars of a night sky seen from space, as the arrays a cloud of points
 * draws from: where each star stands on a sphere of radius 1, its tint, and
 * its size. Most stars are faint and a few are bright, as in a real sky, and
 * more than half crowd toward one tilted band, the galaxy seen edge on. The
 * same count and seed always answer the same sky.
 *
 * @param count - How many stars the sky holds
 * @param seed - Which sky it is
 */
export function starField(count: number, seed: number) {
  const places = new Float32Array(count * 3);
  const tints = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const lean = Math.cos(BAND_TILT);
  const rise = Math.sin(BAND_TILT);
  for (let star = 0; star < count; star += 1) {
    const banded = chanceAt(star, 0, seed) < BAND_SHARE;
    const spread = 2 * chanceAt(star, 1, seed) - 1;
    const height = banded ? spread ** 3 * BAND_WIDTH * 4 : spread;
    const level = Math.sqrt(1 - height * height);
    const around = 2 * Math.PI * chanceAt(star, 2, seed);
    const x = Math.cos(around) * level;
    const z = Math.sin(around) * level;
    places[star * 3] = x;
    places[star * 3 + 1] = height * lean - z * rise;
    places[star * 3 + 2] = height * rise + z * lean;

    const bright = chanceAt(star, 3, seed) ** 7;
    const [red, green, blue] = tintOf(chanceAt(star, 4, seed));
    const glow = 0.35 + 0.65 * bright;
    tints[star * 3] = red * glow;
    tints[star * 3 + 1] = green * glow;
    tints[star * 3 + 2] = blue * glow;
    sizes[star] = 0.7 + 2.6 * bright;
  }
  return { places, sizes, tints };
}
