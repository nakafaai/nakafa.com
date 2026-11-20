import { Option } from "effect";
import { flowOf, pointOf } from "@/lib/island/land/relief";

/** A chunk is this many lattice points on a side, one block apart (ADR 0050, W1). */
export const CHUNK = 32;

/** How many lattice points one chunk holds. */
export const POINTS = CHUNK * CHUNK;

/** How many steps of a stored lift make one block: a learner moves the ground by eighths (ADR 0050, W3). */
export const LIFT_STEPS = 8;

/** The chunks either way of the origin a key can name. */
const HALF = 32_768;
const SIDE = HALF * 2;

/**
 * The surfaces a learner paints over the land (ADR 0050, W2): none where the
 * land keeps its own, grass that takes a painted surface back, a path, sand,
 * a flower meadow, and a pond dug into the ground.
 */
export const PAINT = {
  grass: 1,
  meadow: 4,
  none: 0,
  path: 2,
  pond: 5,
  sand: 3,
} as const;

/** How far a pond's bed lies under the ground it was dug in, and its water under the bank, in blocks. */
const POND = { bed: 0.75, face: 0.12 } as const;

/** The key of the chunk at these chunk coordinates, either of which may be negative. */
export function keyOf(cx: number, cz: number) {
  return (cx + HALF) * SIDE + (cz + HALF);
}

/** The chunk coordinates a key names. */
export function placeOf(key: number) {
  return [Math.floor(key / SIDE) - HALF, (key % SIDE) - HALF] as const;
}

/** The place inside its chunk of the lattice point at these world coordinates. */
export function indexOf(i: number, j: number) {
  const across = ((i % CHUNK) + CHUNK) % CHUNK;
  const deep = ((j % CHUNK) + CHUNK) % CHUNK;
  return deep * CHUNK + across;
}

/** A share from 0 to 1 as a byte. */
function byteOf(share: number) {
  return Math.round(Math.min(1, Math.max(0, share)) * 255);
}

/**
 * Lays a painted surface over one lattice point of a chunk. A pond lowers the
 * ground and fills it to just under the bank, unless water already stands
 * there; any other surface replaces the ground's own.
 */
export function paintOver(
  chunk: Pick<Chunk, "heights" | "kinds" | "surfaces">,
  index: number,
  paint: number
) {
  if (paint === PAINT.pond) {
    if (chunk.surfaces[index] < chunk.heights[index]) {
      chunk.surfaces[index] = chunk.heights[index] - POND.face;
      chunk.heights[index] -= POND.bed;
    }
    return;
  }
  chunk.kinds[index * 4] = paint === PAINT.path ? 255 : 0;
  chunk.kinds[index * 4 + 1] = paint === PAINT.sand ? 255 : 0;
  chunk.kinds[index * 4 + 2] = paint === PAINT.meadow ? 255 : 0;
}

/**
 * One chunk of the land (ADR 0050, W1 and W3): what the seed grows at each of
 * its lattice points, with the learner's lifts and paints laid over it. For
 * every point it holds the ground's height and the water's face, in blocks;
 * four bytes of what covers it (a path, sand, a meadow, and how wooded and
 * moist it is); the continent's elevation; how wet it is; and which way a
 * river runs there, as two signed bytes.
 */
export function chunkOf(
  seed: number,
  cx: number,
  cz: number,
  lifts: Option.Option<Int8Array>,
  paints: Option.Option<Uint8Array>
) {
  const chunk = {
    cx,
    cz,
    elevations: new Float32Array(POINTS),
    flows: new Int8Array(POINTS * 2),
    heights: new Float32Array(POINTS),
    kinds: new Uint8Array(POINTS * 4),
    surfaces: new Float32Array(POINTS),
    wets: new Float32Array(POINTS),
  };
  for (let index = 0; index < POINTS; index += 1) {
    const x = cx * CHUNK + (index % CHUNK);
    const z = cz * CHUNK + Math.floor(index / CHUNK);
    const point = pointOf(seed, x, z);
    const flow = flowOf(seed, x, z, point.wet);
    chunk.heights[index] = point.height;
    chunk.surfaces[index] = point.surface;
    chunk.elevations[index] = point.elevation;
    chunk.wets[index] = point.wet;
    chunk.kinds[index * 4 + 1] = byteOf(point.sand);
    chunk.kinds[index * 4 + 2] = byteOf(point.meadow);
    chunk.kinds[index * 4 + 3] = byteOf(
      point.forest * 0.6 + (point.moist - 0.35) * 1.3
    );
    chunk.flows[index * 2] = Math.round(flow[0] * 127);
    chunk.flows[index * 2 + 1] = Math.round(flow[1] * 127);
  }
  if (Option.isSome(lifts)) {
    for (let index = 0; index < POINTS; index += 1) {
      chunk.heights[index] += lifts.value[index] / LIFT_STEPS;
    }
  }
  if (Option.isSome(paints)) {
    for (let index = 0; index < POINTS; index += 1) {
      if (paints.value[index] !== PAINT.none) {
        paintOver(chunk, index, paints.value[index]);
      }
    }
  }
  return chunk;
}
export type Chunk = ReturnType<typeof chunkOf>;
