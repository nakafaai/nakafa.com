import { chanceAt } from "@repo/design-system/components/three/field/noise";

/** How many numbers hold one mote's traits: its size, phase, pace and tint. */
const TRAITS = 4;

/**
 * Scatters `count` motes through a ball of radius 1, evenly by volume and
 * never nearer its middle than `hollow`, the same on every device. Each mote
 * gets its place and four traits from 0 to 1: its size, mostly small with a
 * few large; the phase its drift starts at; its pace; and its tint. Stars,
 * drifting solutes, plankton and dust are all drawn from one scatter.
 *
 * @param count - How many motes to scatter
 * @param seed - Which scatter: another seed gives another, unrelated one
 * @param hollow - The radius around the middle that stays empty, from 0 to 1
 */
export function scatterMotes(count: number, seed: number, hollow: number) {
  const places = new Float32Array(count * 3);
  const traits = new Float32Array(count * TRAITS);
  const core = hollow ** 3;
  for (let mote = 0; mote < count; mote += 1) {
    const height = 2 * chanceAt(mote, 1, seed) - 1;
    const turn = 2 * Math.PI * chanceAt(mote, 2, seed);
    const radius = Math.cbrt(core + (1 - core) * chanceAt(mote, 3, seed));
    const ring = radius * Math.sqrt(1 - height * height);
    places.set(
      [ring * Math.cos(turn), radius * height, ring * Math.sin(turn)],
      mote * 3
    );
    traits.set(
      [
        chanceAt(mote, 4, seed) ** 3,
        chanceAt(mote, 5, seed),
        chanceAt(mote, 6, seed),
        chanceAt(mote, 7, seed),
      ],
      mote * TRAITS
    );
  }
  return { places, traits };
}
