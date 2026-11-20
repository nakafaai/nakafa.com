import type { Placed } from "@repo/backend/confect/island/chunk";
import { Array as Arr, MutableHashMap, Option } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import type { Chunk } from "@/lib/island/land/chunk";
import { indexOf, keyOf, POINTS } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { chunkOver, landOf } from "@/lib/island/land/ground";
import type { Dweller } from "@/lib/island/life";

/** How high a plain's ground stands, in blocks above the world's floor. */
export const GROUND = 12;

/** Where each cover is kept among the four bytes of a lattice point. */
const COVERS = { forest: 3, meadow: 2, path: 0, sand: 1 } as const;

/** One chunk of flat dry grass far from any water. */
function plainChunk(cx: number, cz: number): Chunk {
  return {
    cx,
    cz,
    elevations: new Float32Array(POINTS).fill(5),
    flows: new Int8Array(POINTS * 2),
    heights: new Float32Array(POINTS).fill(GROUND),
    kinds: new Uint8Array(POINTS * 4),
    surfaces: new Float32Array(POINTS),
    wets: new Float32Array(POINTS).fill(-9),
  };
}

/**
 * A land for tests to shape: flat dry grass `GROUND` blocks high in every
 * chunk within `reach` chunks of the origin, with no water, no sand and no
 * wood, so a test reads only what it carved into it.
 */
export function plainOf(reach: number): Land {
  const land = landOf(1);
  for (const cx of Arr.range(-reach, reach)) {
    for (const cz of Arr.range(-reach, reach)) {
      MutableHashMap.set(land.chunks, keyOf(cx, cz), plainChunk(cx, cz));
    }
  }
  return land;
}

/** Sets the ground's height at one lattice point of a plain. */
export function raise(land: Land, i: number, j: number, height: number) {
  chunkOver(land, i, j).heights[indexOf(i, j)] = height;
}

/** Floods one lattice point of a plain: the bed sinks `depth` blocks under the plain's face, where the water stands, as a lake or as the sea under the continent's shore. */
export function flood(
  land: Land,
  i: number,
  j: number,
  depth: number,
  water: "lake" | "sea"
) {
  const chunk = chunkOver(land, i, j);
  const index = indexOf(i, j);
  chunk.heights[index] = GROUND - depth;
  chunk.surfaces[index] = GROUND;
  chunk.elevations[index] = water === "sea" ? -3 : 5;
}

/** Covers one lattice point of a plain with a path, sand, a meadow or a forest's floor. */
export function cover(
  land: Land,
  i: number,
  j: number,
  kind: keyof typeof COVERS
) {
  chunkOver(land, i, j).kinds[indexOf(i, j) * 4 + COVERS[kind]] = 255;
}

/** A plain with every wild plant cleared from every chunk within `reach` chunks of the origin, so only what a test sets down stands on it. */
export function bareOf(reach: number) {
  const land = plainOf(reach);
  for (const cx of Arr.range(-reach, reach)) {
    for (const cz of Arr.range(-reach, reach)) {
      MutableHashMap.set(
        land.clears,
        keyOf(cx, cz),
        new Uint8Array(POINTS).fill(1)
      );
    }
  }
  return land;
}

/** Changes every lattice point of a square of a plain, from `from` up to but not `to` along both ways. */
function each(
  from: readonly [number, number],
  to: readonly [number, number],
  change: (i: number, j: number) => void
) {
  for (const i of Arr.range(from[0], to[0] - 1)) {
    for (const j of Arr.range(from[1], to[1] - 1)) {
      change(i, j);
    }
  }
}

/** Floods a square of a plain `depth` blocks deep, as a lake or as the sea. */
export function floodAll(
  land: Land,
  from: readonly [number, number],
  to: readonly [number, number],
  depth: number,
  water: "lake" | "sea"
) {
  each(from, to, (i, j) => flood(land, i, j, depth, water));
}

/** Covers a square of a plain with sand, a meadow or a forest's floor. */
export function coverAll(
  land: Land,
  from: readonly [number, number],
  to: readonly [number, number],
  kind: keyof typeof COVERS
) {
  each(from, to, (i, j) => cover(land, i, j, kind));
}

/** Sets things down in one chunk, each at a place of the chunk's own half-block grid given in blocks from its corner. */
export function setThings(
  land: Land,
  chunk: readonly [number, number],
  things: readonly (readonly [
    (typeof Placed.Type)["kind"],
    number,
    number,
    number,
  ])[]
) {
  MutableHashMap.set(
    land.things,
    keyOf(chunk[0], chunk[1]),
    Arr.map(things, ([kind, x, z, turn]) => ({
      at: z * 2 * 64 + x * 2,
      kind,
      turn,
    }))
  );
}

/** The index of a species of the catalogue by its key. */
export function speciesOf(key: (typeof SPECIES)[number]["key"]) {
  return Option.getOrThrow(
    Arr.findFirstIndex(SPECIES, (species) => species.key === key)
  );
}

/** An animal of a cell standing at a place with nowhere to go, for a test to change. */
export function dwellerAt(
  kind: Dweller["kind"],
  x: number,
  z: number
): Dweller {
  return {
    cell: 0,
    ground: "dry",
    hx: x,
    hz: z,
    kind,
    pack: 0,
    pet: 0,
    rest: 0,
    seed: 7,
    steps: 0,
    tx: x,
    tz: z,
    x,
    z,
  };
}
