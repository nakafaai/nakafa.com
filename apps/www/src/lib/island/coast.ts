import { SPAN } from "@repo/backend/confect/island/world";
import { skylineOf } from "@/lib/island/ground";
import { KIND, LOOK } from "@/lib/island/look";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

/** How many steps of the coast map make a block: its distances are kept in sixteenths, the art pixel's own size, up to sixteen blocks. */
export const COAST_STEPS = 16;

/** The farthest the coast map tells, in blocks; water farther from land reads as this far. */
const FARTHEST = 255 / COAST_STEPS;

/** The cost of a step to a column beside, and to one across a corner, in blocks. */
const STEPS = { corner: Math.SQRT2, side: 1 } as const;

/** Whether a column stands as land: its top is no liquid and stands at or above the water's face. */
function landOf(cells: Cells, skyline: Int8Array, index: number) {
  const top = skyline[index];
  if (top < 0) {
    return false;
  }
  const block = blockAt(cells, index % SPAN, top, Math.floor(index / SPAN));
  return LOOK.kinds[block] !== KIND.liquid && top + 1 >= SEA_LEVEL;
}

/**
 * How far every column lies from the nearest land, in blocks (ADR 0047, D51):
 * two sweeps of the world, each column taking the least of its neighbours'
 * distances plus the step to it, from the top left and back from the bottom
 * right, so the distance runs round corners as it does in open water.
 */
function distancesOf(land: Uint8Array) {
  const far = new Float32Array(SPAN * SPAN);
  for (let index = 0; index < SPAN * SPAN; index += 1) {
    far[index] = land[index] === 1 ? 0 : FARTHEST;
  }
  const relax = (
    x: number,
    z: number,
    dx: number,
    dz: number,
    cost: number
  ) => {
    const [nx, nz] = [x + dx, z + dz];
    if (nx < 0 || nx >= SPAN || nz < 0 || nz >= SPAN) {
      return;
    }
    const here = z * SPAN + x;
    far[here] = Math.min(far[here], far[nz * SPAN + nx] + cost);
  };
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      relax(x, z, -1, 0, STEPS.side);
      relax(x, z, 0, -1, STEPS.side);
      relax(x, z, -1, -1, STEPS.corner);
      relax(x, z, 1, -1, STEPS.corner);
    }
  }
  for (let z = SPAN - 1; z >= 0; z -= 1) {
    for (let x = SPAN - 1; x >= 0; x -= 1) {
      relax(x, z, 1, 0, STEPS.side);
      relax(x, z, 0, 1, STEPS.side);
      relax(x, z, 1, 1, STEPS.corner);
      relax(x, z, -1, 1, STEPS.corner);
    }
  }
  return far;
}

/**
 * Which water columns lie still (D51): every water column that no path of
 * water leads from to the world's edge, as a pond or a lake does. The open
 * sea reaches the edge, so it rolls and breaks; still water mirrors its banks.
 */
function stillOf(land: Uint8Array) {
  const open = new Uint8Array(SPAN * SPAN);
  // Each column enters the queue once, so a queue as long as the world holds every one.
  const queue = new Int32Array(SPAN * SPAN);
  let length = 0;
  const reach = (x: number, z: number) => {
    const index = z * SPAN + x;
    const inside = x >= 0 && x < SPAN && z >= 0 && z < SPAN;
    if (inside && land[index] === 0 && open[index] === 0) {
      open[index] = 1;
      queue[length] = index;
      length += 1;
    }
  };
  for (let step = 0; step < SPAN; step += 1) {
    reach(step, 0);
    reach(step, SPAN - 1);
    reach(0, step);
    reach(SPAN - 1, step);
  }
  for (let read = 0; read < length; read += 1) {
    const [x, z] = [queue[read] % SPAN, Math.floor(queue[read] / SPAN)];
    reach(x + 1, z);
    reach(x - 1, z);
    reach(x, z + 1);
    reach(x, z - 1);
  }
  return open;
}

/**
 * The coast map the water pass reads (ADR 0047, D51), two numbers a column:
 * how far it lies from the nearest land in sixteenths of a block, so waves
 * roll in toward the shore in bands that follow it, and 255 where its water
 * lies still and mirrors its banks, 0 where it is land or the open sea.
 */
export function coastOf(cells: Cells) {
  const skyline = skylineOf(cells);
  const land = new Uint8Array(SPAN * SPAN);
  for (let index = 0; index < SPAN * SPAN; index += 1) {
    land[index] = landOf(cells, skyline, index) ? 1 : 0;
  }
  const far = distancesOf(land);
  const open = stillOf(land);
  const coast = new Uint8Array(SPAN * SPAN * 2);
  for (let index = 0; index < SPAN * SPAN; index += 1) {
    coast[index * 2] = Math.min(255, Math.round(far[index] * COAST_STEPS));
    coast[index * 2 + 1] = land[index] === 0 && open[index] === 0 ? 255 : 0;
  }
  return coast;
}
