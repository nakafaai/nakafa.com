import { chanceAt } from "@repo/design-system/components/three/field/noise";

/** How many waves of swelling a lump carries, each finer and fainter than the last. */
const WAVES = 4;

/**
 * How far the surface of an organic lump stands from its middle in the
 * direction (x, y, z), as a share of its radius: 1 on a sphere, swelling and
 * dipping by up to `depth` in slow waves and finer ones, so no organelle,
 * protein or cell is a perfect ball. The same seed always gives the same lump.
 */
export function lumpAt(
  x: number,
  y: number,
  z: number,
  seed: number,
  depth: number
) {
  let swell = 0;
  let weight = 0;
  for (let wave = 0; wave < WAVES; wave += 1) {
    const pitch = 1.6 * 1.9 ** wave;
    const share = 0.55 ** wave;
    const turn = chanceAt(wave, 1, seed) * Math.PI * 2;
    const lean = chanceAt(wave, 2, seed) * Math.PI * 2;
    const roll = chanceAt(wave, 3, seed) * Math.PI * 2;
    swell +=
      share *
      Math.sin(x * pitch + turn + Math.sin(y * pitch + lean)) *
      Math.cos(z * pitch + roll + Math.sin(x * pitch * 0.7 + turn));
    weight += share;
  }
  return 1 + (depth * swell) / weight;
}
