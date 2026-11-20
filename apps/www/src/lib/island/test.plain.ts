import { Array as Arr, MutableHashMap } from "effect";
import type { Chunk } from "@/lib/island/land/chunk";
import { indexOf, keyOf, POINTS } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { chunkOver, landOf } from "@/lib/island/land/ground";

/** How high a plain's ground stands, in blocks above the world's floor. */
export const PLAIN = 12;

/** How high water stands wherever a plain is dug under it: a tenth of a block under the turf, as beside a real bank, so a flooded place has a shore a walker can wade into. */
export const FACE = PLAIN - 0.1;

/** Where each cover is kept among the four bytes of a lattice point. */
const COVERS = { forest: 3, meadow: 2, path: 0, sand: 1 } as const;

/** One chunk of flat dry grass. */
function plainChunk(cx: number, cz: number): Chunk {
  return {
    cx,
    cz,
    elevations: new Float32Array(POINTS).fill(5),
    flows: new Int8Array(POINTS * 2),
    heights: new Float32Array(POINTS).fill(PLAIN),
    kinds: new Uint8Array(POINTS * 4),
    surfaces: new Float32Array(POINTS).fill(FACE),
    wets: new Float32Array(POINTS).fill(-9),
  };
}

/**
 * A land for tests to shape: flat dry grass `PLAIN` blocks high in every
 * chunk within `reach` chunks of the origin, with no river, no sand and no
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

/**
 * Floods one lattice point of a plain: its bed sinks `depth` blocks under the
 * water's face. A river flows along +x, the sea lies under the continent's
 * shore, and a lake is neither.
 */
export function flood(
  land: Land,
  i: number,
  j: number,
  depth: number,
  water: "lake" | "river" | "sea" = "lake"
) {
  const chunk = chunkOver(land, i, j);
  const index = indexOf(i, j);
  chunk.heights[index] = FACE - depth;
  chunk.flows[index * 2] = water === "river" ? 127 : 0;
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
