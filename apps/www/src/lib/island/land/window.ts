import { CHUNK, LIFT_STEPS } from "@/lib/island/land/chunk";
import { liftOf } from "@/lib/island/land/edits";
import type { Land } from "@/lib/island/land/ground";
import { chunkAt } from "@/lib/island/land/ground";
import { pointOf } from "@/lib/island/land/relief";

/** The side of the window of land the painter holds around the camera, in lattice points (ADR 0050, W10). */
export const WINDOW = 256;

/** The window moves in steps of this many blocks, so a pan refills it once in a while and not every frame. */
const SNAP = 16;

/** How far from the window's middle the window hands the land over to the horizon, in blocks along the farther axis. */
export const SEAM = WINDOW / 2 - 8;

/** The blocks between two lattice points of the horizon, which holds as many points as the window and so reaches this many times as far. */
export const HORIZON_STEP = 8;

/** The horizon moves in steps of this many blocks. */
const HORIZON_SNAP = 64;

/**
 * The window of the land the painter draws (ADR 0050, W10): for every lattice
 * point around its origin, four numbers of the ground (its height, the
 * water's face, and which way a river runs there) and four bytes of what
 * covers it (a path, sand, a meadow, and how wooded it is). The painter reads
 * both as textures, so a change to the land shows as soon as the window is
 * filled again.
 */
export function windowOf() {
  return {
    fields: new Float32Array(WINDOW * WINDOW * 4),
    kinds: new Uint8Array(WINDOW * WINDOW * 4),
  };
}
export type Window = ReturnType<typeof windowOf>;

/** A share from 0 to 1 as a byte. */
function shareByte(share: number) {
  return Math.round(Math.min(1, Math.max(0, share)) * 255);
}

/** The origin of the window that holds a place: the place, held to the window's steps. */
export function originOf(x: number, z: number) {
  return [Math.round(x / SNAP) * SNAP, Math.round(z / SNAP) * SNAP] as const;
}

/**
 * Fills the window with the land around an origin: the lattice points from
 * half a window before it to half a window after it, read chunk by chunk.
 */
export function fillWindow(
  land: Land,
  window: Window,
  origin: readonly [number, number]
) {
  const fromX = origin[0] - WINDOW / 2;
  const fromZ = origin[1] - WINDOW / 2;
  const lastX = Math.floor((fromX + WINDOW - 1) / CHUNK);
  const lastZ = Math.floor((fromZ + WINDOW - 1) / CHUNK);
  for (let cz = Math.floor(fromZ / CHUNK); cz <= lastZ; cz += 1) {
    for (let cx = Math.floor(fromX / CHUNK); cx <= lastX; cx += 1) {
      const chunk = chunkAt(land, cx, cz);
      const startJ = Math.max(0, fromZ - cz * CHUNK);
      const endJ = Math.min(CHUNK, fromZ + WINDOW - cz * CHUNK);
      const startI = Math.max(0, fromX - cx * CHUNK);
      const endI = Math.min(CHUNK, fromX + WINDOW - cx * CHUNK);
      for (let j = startJ; j < endJ; j += 1) {
        const row = (cz * CHUNK + j - fromZ) * WINDOW + cx * CHUNK - fromX;
        for (let i = startI; i < endI; i += 1) {
          const from = j * CHUNK + i;
          const to = (row + i) * 4;
          window.fields[to] = chunk.heights[from];
          window.fields[to + 1] = chunk.surfaces[from];
          window.fields[to + 2] = chunk.flows[from * 2] / 127;
          window.fields[to + 3] = chunk.flows[from * 2 + 1] / 127;
          window.kinds[to] = chunk.kinds[from * 4];
          window.kinds[to + 1] = chunk.kinds[from * 4 + 1];
          window.kinds[to + 2] = chunk.kinds[from * 4 + 2];
          window.kinds[to + 3] = chunk.kinds[from * 4 + 3];
        }
      }
    }
  }
}

/** The origin of the horizon that holds a place: the place, held to the horizon's steps. */
export function horizonOf(x: number, z: number) {
  return [
    Math.round(x / HORIZON_SNAP) * HORIZON_SNAP,
    Math.round(z / HORIZON_SNAP) * HORIZON_SNAP,
  ] as const;
}

/**
 * Fills rows of the horizon with the land about an origin (ADR 0050, W10):
 * the lattice points `HORIZON_STEP` blocks apart from half a horizon before
 * it to half a horizon after it, read from the seed with the learner's lifts
 * laid over them, so a hill they raised still stands when seen from afar. A
 * horizon is a quarter of a million blocks of land, so the painter fills it a
 * few rows a frame, from `from` up to but not including `to`.
 */
export function fillHorizon(
  land: Land,
  horizon: Window,
  origin: readonly [number, number],
  from: number,
  to: number
) {
  for (let row = from; row < to; row += 1) {
    const z = origin[1] + (row - WINDOW / 2) * HORIZON_STEP;
    for (let column = 0; column < WINDOW; column += 1) {
      const x = origin[0] + (column - WINDOW / 2) * HORIZON_STEP;
      const point = pointOf(land.seed, x, z);
      const at = (row * WINDOW + column) * 4;
      horizon.fields[at] = point.height + liftOf(land, x, z) / LIFT_STEPS;
      horizon.fields[at + 1] = point.surface;
      horizon.fields[at + 2] = 0;
      horizon.fields[at + 3] = 0;
      horizon.kinds[at] = 0;
      horizon.kinds[at + 1] = shareByte(point.sand);
      horizon.kinds[at + 2] = shareByte(point.meadow);
      horizon.kinds[at + 3] = shareByte(
        point.forest * 0.6 + (point.moist - 0.35) * 1.3
      );
    }
  }
}
