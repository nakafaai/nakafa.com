import { chanceAt } from "@repo/design-system/components/three/field/noise";

/**
 * A water molecule's atoms in angstrom, the oxygen at the origin: O-H bonds
 * of 0.9572 angstrom at 104.52 degrees (Benedict, Gailar and Plyler 1956).
 */
export const WATER = [
  ["O", 0, 0, 0],
  ["H", 0.757, 0.586, 0],
  ["H", -0.757, 0.586, 0],
] as const;

/**
 * Where `count` solvent molecules rest, as x, y and z for each: scattered
 * evenly through the shell between `inner` and `outer` from the middle, the
 * same on every device, so the subject at the middle stays clear.
 */
export function homesOf(count: number, inner: number, outer: number) {
  const homes = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const height = chanceAt(index, 1, 7) * 2 - 1;
    const around = chanceAt(index, 2, 7) * Math.PI * 2;
    const flat = Math.sqrt(1 - height * height);
    const reach = Math.cbrt(
      inner ** 3 + chanceAt(index, 3, 7) * (outer ** 3 - inner ** 3)
    );
    homes[index * 3] = Math.cos(around) * flat * reach;
    homes[index * 3 + 1] = height * reach;
    homes[index * 3 + 2] = Math.sin(around) * flat * reach;
  }
  return homes;
}

/**
 * Moves every molecule to where its thermal wander has taken it at `time`
 * seconds, at most `stride` from its home on each axis: a slow, never
 * repeating drift, each molecule on its own path. It writes into `places`
 * and allocates nothing, so a scene can call it every frame.
 */
export function wanderInto(
  places: Float32Array,
  homes: Float32Array,
  time: number,
  stride: number
) {
  for (let slot = 0; slot < homes.length; slot += 1) {
    const phase = chanceAt(slot, 4, 11) * Math.PI * 2;
    const pace = 0.35 + chanceAt(slot, 5, 11) * 0.4;
    places[slot] =
      Number(homes[slot]) +
      stride *
        (0.62 * Math.sin(time * pace + phase) +
          0.38 * Math.sin(time * pace * 2.618 + phase * 1.7));
  }
}
