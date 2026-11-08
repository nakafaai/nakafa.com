import { type PondAnimal, WATER_BELOW } from "@/lib/island/pieces";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";

/** The height of a pond's surface in world units. */
const SURFACE = -WATER_BELOW / VOXELS_PER_CELL;

/** Seconds a fish takes to cross its pond and come back. */
const FISH_LAP = 9;
/** Seconds a duck takes to paddle once round its pond. */
const DUCK_LAP = 18;
/** Seconds between Nina's peeks, and how long each lasts. */
const NINA_CYCLE = 14;
const NINA_PEEK = 4;

/** Goes from 0 to 1 and back over one unit of `t`. */
function pingPong(t: number) {
  const unit = t - Math.floor(t);
  return unit < 0.5 ? unit * 2 : 2 - unit * 2;
}

/**
 * Where an animal is at a moment, in world units, the way it is heading, and
 * whether it shows: a fish crosses its pond under the surface and back, a duck
 * paddles round it, and Nina rises out of the middle for a few seconds now and
 * then and sinks again.
 */
export function swimAt(animal: PondAnimal, time: number) {
  const [x0, z0] = animal.area.from;
  const [x1, z1] = animal.area.to;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (animal.animal === "fish") {
    const lap = time / FISH_LAP + animal.phase;
    const forward = lap - Math.floor(lap) < 0.5;
    return {
      dx: forward ? 1 : -1,
      dz: 0,
      visible: true,
      x: x0 + (x1 - x0) * pingPong(lap),
      y: SURFACE - animal.depth,
      z: cz + ((z1 - z0) / 2) * 0.6 * Math.sin(time * 0.7 + animal.phase * 6),
    };
  }
  if (animal.animal === "duck") {
    const angle = (time / DUCK_LAP + animal.phase) * Math.PI * 2;
    return {
      dx: -Math.sin(angle),
      dz: Math.cos(angle),
      visible: true,
      x: cx + ((x1 - x0) / 2) * 0.7 * Math.cos(angle),
      y: SURFACE,
      z: cz + ((z1 - z0) / 2) * 0.7 * Math.sin(angle),
    };
  }
  const cycle = (time + animal.phase * NINA_CYCLE) % NINA_CYCLE;
  const rise = Math.min(1, cycle / 0.6, Math.max(0, (NINA_PEEK - cycle) / 0.6));
  return {
    dx: 1,
    dz: 0,
    visible: cycle < NINA_PEEK,
    x: cx,
    y: SURFACE - 0.3 + rise * 0.3 + Math.sin(time * 3) * 0.02,
    z: cz,
  };
}
