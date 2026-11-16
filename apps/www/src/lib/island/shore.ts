import { AIR, idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { isleGround, islesOf } from "@/lib/island/isles";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

/**
 * The square of sea the shore map covers (ADR 0047, D28): its side in cells,
 * and the world coordinate it starts at. The learner's island lies in its
 * middle and every isle of the ring inside it.
 */
export const SHORE_SIDE = 256;
export const SHORE_FROM = SPAN / 2 - SHORE_SIDE / 2;

/**
 * How far out from land the map measures, in cells: the shallows, the surf
 * and the waves that roll in toward the coast all lie within it, and open sea
 * lies past it.
 */
export const SHORE_REACH = 16;

const WATER = idOf("water");

/** The layer whose top is the water's surface: land is whatever fills it. */
const SURFACE = SEA_LEVEL - 1;

/** Squared distances larger than any the map holds, for a column with no land on it. */
const FAR = SHORE_SIDE * SHORE_SIDE * 4;

/**
 * The squared distance of every cell of one line to the nearest marked cell
 * of that line's input, in place (Felzenszwalb and Huttenlocher's lower
 * envelope of parabolas): one pass of the exact distance transform.
 */
function transformLine(line: Float64Array) {
  const count = line.length;
  const out = new Float64Array(count);
  const hulls = new Int32Array(count);
  const bounds = new Float64Array(count + 1);
  /** Where the parabola of `at` overtakes the parabola of `from`. */
  const crossing = (at: number, from: number) =>
    (line[at] + at * at - (line[from] + from * from)) / (2 * at - 2 * from);
  let top = 0;
  bounds[0] = Number.NEGATIVE_INFINITY;
  bounds[1] = Number.POSITIVE_INFINITY;
  for (let at = 1; at < count; at += 1) {
    let cross = crossing(at, hulls[top]);
    while (cross <= bounds[top]) {
      top -= 1;
      cross = crossing(at, hulls[top]);
    }
    top += 1;
    hulls[top] = at;
    bounds[top] = cross;
    bounds[top + 1] = Number.POSITIVE_INFINITY;
  }
  let hull = 0;
  for (let at = 0; at < count; at += 1) {
    while (bounds[hull + 1] < at) {
      hull += 1;
    }
    const from = hulls[hull];
    out[at] = (at - from) * (at - from) + line[from];
  }
  line.set(out);
}

/**
 * The squared distance field before its transform: 0 on every column of land
 * the map covers, far everywhere else. Land is a column that fills the layer
 * under the water's surface: the learner's own blocks, and with `ring` the
 * isles of the seed's archipelago.
 */
function landOf(cells: Cells, seed: number, ring: boolean) {
  const squared = new Float64Array(SHORE_SIDE * SHORE_SIDE).fill(FAR);
  const mark = (x: number, z: number) => {
    squared[(z - SHORE_FROM) * SHORE_SIDE + (x - SHORE_FROM)] = 0;
  };
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      const block = blockAt(cells, x, SURFACE, z);
      if (block !== AIR && block !== WATER) {
        mark(x, z);
      }
    }
  }
  for (const isle of ring ? islesOf(seed) : []) {
    const reach = Math.ceil(isle.radius * 1.2);
    for (const [dx, dz] of Arr.cartesian(
      Arr.range(-reach, reach),
      Arr.range(-reach, reach)
    )) {
      const x = Math.floor(isle.x) + dx;
      const z = Math.floor(isle.z) + dz;
      if (
        Option.exists(
          isleGround(isle, seed, x, z),
          (ground) => ground.top >= SURFACE
        )
      ) {
        mark(x, z);
      }
    }
  }
  return squared;
}

/**
 * The shore map of a world (ADR 0047, D34): for every column of the covered
 * sea, how far the nearest land is, from 0 on land to 255 at `SHORE_REACH`
 * cells and beyond, one byte a column, row by row along z. It is an exact
 * Euclidean distance, transformed down each column and then along each row,
 * so the shallows, the surf and the waves follow every bay of whatever the
 * learner builds or digs, lakes included.
 */
export function shoreOf(cells: Cells, seed: number, ring: boolean) {
  const squared = landOf(cells, seed, ring);
  const line = new Float64Array(SHORE_SIDE);
  for (let column = 0; column < SHORE_SIDE; column += 1) {
    for (let row = 0; row < SHORE_SIDE; row += 1) {
      line[row] = squared[row * SHORE_SIDE + column];
    }
    transformLine(line);
    for (let row = 0; row < SHORE_SIDE; row += 1) {
      squared[row * SHORE_SIDE + column] = line[row];
    }
  }
  const map = new Uint8Array(SHORE_SIDE * SHORE_SIDE);
  for (let row = 0; row < SHORE_SIDE; row += 1) {
    const start = row * SHORE_SIDE;
    line.set(squared.subarray(start, start + SHORE_SIDE));
    transformLine(line);
    for (let column = 0; column < SHORE_SIDE; column += 1) {
      const reach = Math.min(1, Math.sqrt(line[column]) / SHORE_REACH);
      map[start + column] = Math.round(reach * 255);
    }
  }
  return map;
}
