import { Thing } from "@repo/backend/confect/island/things";
import { Schema } from "effect";

/** The lattice points along one side of a chunk (ADR 0050, W1). */
const SIDE = 32;

/** The lattice points of one chunk: point `i` along x and `j` along z sits at `j * 32 + i`. */
export const POINTS = SIDE * SIDE;

/** The places of a chunk's half-block grid, 64 by 64: `row * 64 + column`. */
const PLACES = 4 * POINTS;

/** The most things one chunk holds. */
export const MAX_THINGS = 192;

/** The most chunk rows one world holds. */
export const MAX_CHUNKS = 4096;

/** The chunks along one side of a region, the square one index range reads. */
const REGION_SIDE = 8;

/** The chunk rows one region holds at most. */
export const REGION_CHUNKS = REGION_SIDE * REGION_SIDE;

/** How far the chunks reach from the origin, either way. */
const FAR = 4096;

/** A chunk's place along x or z, counted in chunks from the origin. */
export const Across = Schema.Int.check(
  Schema.isBetween({ maximum: FAR - 1, minimum: -FAR })
);

/** A region's place along x or z: the chunk's, divided by 8 and rounded down. */
export const Region = Schema.Int.check(
  Schema.isBetween({
    maximum: FAR / REGION_SIDE - 1,
    minimum: -FAR / REGION_SIDE,
  })
);

/** The region a chunk lies in, along one axis. */
export function regionOf(across: number) {
  return Math.floor(across / REGION_SIDE);
}

/** One number for a chunk's two coordinates, so a map holds each chunk once. */
export function chunkKeyOf(cx: number, cz: number) {
  return (cx + FAR) * (2 * FAR) + (cz + FAR);
}

/**
 * Bytes stored and sent as they are, which the browser reads straight into a
 * typed array. A buffer of any other length is refused.
 */
const packed = (bytes: number) =>
  Schema.instanceOf(ArrayBuffer).check(
    Schema.makeFilter((buffer) =>
      buffer.byteLength === bytes
        ? undefined
        : `A chunk packs exactly ${bytes} bytes here.`
    )
  );

/** How far each point was moved, one signed byte a point: eighths of a block, 0 for untouched. */
const Lifts = packed(POINTS);

/** The surface each point was painted, one byte a point: 0 none, 1 grass, 2 path, 3 sand, 4 meadow, 5 pond. */
const Paints = packed(POINTS);

/** The wild plants cleared, one bit a point: point `p` is bit `p % 8` of byte `floor(p / 8)`. */
const Clears = packed(POINTS / 8);

/** One thing set down: its place on the chunk's half-block grid, its kind, and its quarter turns. */
export const Placed = Schema.Struct({
  at: Schema.Int.check(Schema.isBetween({ maximum: PLACES - 1, minimum: 0 })),
  kind: Thing,
  turn: Schema.Int.check(Schema.isBetween({ maximum: 3, minimum: 0 })),
});

/**
 * What a learner changed in one chunk of their land (ADR 0050, W3): the points
 * they moved, painted and cleared, and the things they set down, at most one
 * at each place.
 */
export const Chunk = Schema.Struct({
  clears: Clears,
  lifts: Lifts,
  paints: Paints,
  things: Schema.Array(Placed).check(Schema.isMaxLength(MAX_THINGS)),
});
export type Chunk = typeof Chunk.Type;

/** A chunk nobody changed, which no row stores. */
export function bareChunk(): Chunk {
  return {
    clears: new ArrayBuffer(POINTS / 8),
    lifts: new ArrayBuffer(POINTS),
    paints: new ArrayBuffer(POINTS),
    things: [],
  };
}

/** Whether every byte of a packed buffer is 0. */
function isBlank(buffer: ArrayBuffer) {
  return new Uint8Array(buffer).every((byte) => byte === 0);
}

/** Whether a chunk holds no change at all, so its row can go. */
export function isBare(chunk: Chunk) {
  return (
    chunk.things.length === 0 &&
    isBlank(chunk.lifts) &&
    isBlank(chunk.paints) &&
    isBlank(chunk.clears)
  );
}
