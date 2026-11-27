import { Array as Arr, Schema } from "effect";

/**
 * One shell of a Bohr model as it is drawn: the radius of its orbit, how
 * many electrons ride it, the angle its first electron starts at, and how
 * fast they go round, in radians a second.
 */
const OrbitSchema = Schema.Struct({
  electrons: Schema.Finite,
  pace: Schema.Finite,
  radius: Schema.Finite,
  start: Schema.Finite,
});
export type Orbit = typeof OrbitSchema.Type;

/** How fast the innermost shell's electrons go round, in radians a second. */
const PACE = 1.15;

/** Each shell starts this many radians on from the one inside it, so electrons of neighbouring shells never line up. */
const STAGGER = 0.66;

/** The angle the innermost shell's first electron starts at, clear of the labels a model sets along its x axis. */
const LEAD = 0.4;

/** How many points draw the fading trail behind each electron, and how many seconds lie between two of them. */
export const TRAIL = 7;
const TRAIL_STEP = 0.045;

/**
 * The orbits of a Bohr model whose shells hold `counts` electrons, from the
 * K shell outward: the first orbit at `inner` and each next one `gap`
 * farther out, an even ladder as a Bohr diagram draws it (true Bohr radii
 * grow with n squared and would leave the inner shells too small to read).
 * An electron's speed falls with 1 / n as Bohr's does, so each shell turns
 * more slowly than the one inside it.
 */
export function orbitsOf(
  counts: readonly number[],
  inner: number,
  gap: number
): readonly Orbit[] {
  return Arr.map(counts, (electrons, index) => {
    const radius = inner + gap * index;
    return {
      electrons: Math.max(0, Math.floor(electrons)),
      pace: (PACE * inner) / (radius * (index + 1)),
      radius,
      start: LEAD + index * STAGGER,
    };
  });
}

/** How many electrons the orbits hold together. */
export function electronsOf(orbits: readonly Orbit[]) {
  return Arr.reduce(orbits, 0, (sum, orbit) => sum + orbit.electrons);
}

/**
 * Writes where every electron and the trail behind it stand at `time`
 * seconds into `places`, as x, y and z for each point: the electrons of a
 * shell evenly spaced round its orbit in the plane y = 0, and after each
 * electron the `TRAIL - 1` places it passed just before. `places` must hold
 * `electronsOf(orbits) * TRAIL * 3` numbers. Nothing is allocated, so a
 * scene can call it every frame.
 */
export function electronsInto(
  places: Float32Array,
  orbits: readonly Orbit[],
  time: number
) {
  let slot = 0;
  for (const orbit of orbits) {
    for (let electron = 0; electron < orbit.electrons; electron += 1) {
      const home = orbit.start + (electron / orbit.electrons) * Math.PI * 2;
      for (let lag = 0; lag < TRAIL; lag += 1) {
        const angle = home + (time - lag * TRAIL_STEP) * orbit.pace;
        places[slot] = Math.cos(angle) * orbit.radius;
        places[slot + 1] = 0;
        places[slot + 2] = -Math.sin(angle) * orbit.radius;
        slot += 3;
      }
    }
  }
}

/**
 * How bright each point `electronsInto` writes is, from 0 to 1, as one
 * number per point: 1 for an electron itself, fading to nothing along its
 * trail.
 */
export function fadesOf(orbits: readonly Orbit[]) {
  const fades = new Float32Array(electronsOf(orbits) * TRAIL);
  for (let point = 0; point < fades.length; point += 1) {
    fades[point] = (1 - (point % TRAIL) / TRAIL) ** 2;
  }
  return fades;
}
