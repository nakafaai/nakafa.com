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

/** How many cells out from land the surf and the shallows reach. */
const REACH = 3;

const WATER = idOf("water");

/** The layer whose top is the water's surface: land is whatever fills it. */
const SURFACE = SEA_LEVEL - 1;

/**
 * Marks one column of the map as land and spreads its nearness over the water
 * round it. Every piece of land lies deeper inside the map than the surf
 * reaches, so each stamp stays inside it.
 */
function stamp(map: Uint8Array, column: number, row: number) {
  for (let dz = -REACH; dz <= REACH; dz += 1) {
    for (let dx = -REACH; dx <= REACH; dx += 1) {
      const x = column + dx;
      const z = row + dz;
      const near = Math.round(
        255 * Math.max(0, 1 - Math.hypot(dx, dz) / (REACH + 1))
      );
      const index = z * SHORE_SIDE + x;
      map[index] = Math.max(Number(map[index]), near);
    }
  }
}

/**
 * The shore map of a world: for every column of the covered sea, how near land
 * is, from 255 on land to 0 in open water, one byte a column, row by row along
 * z. Land is a column that fills the layer under the water's surface: the
 * learner's own blocks, and with `ring` the isles of the seed's archipelago.
 * The water draws its surf and its shallows from it, so they follow whatever
 * the learner builds or digs.
 */
export function shoreOf(cells: Cells, seed: number, ring: boolean) {
  const map = new Uint8Array(SHORE_SIDE * SHORE_SIDE);
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      const block = blockAt(cells, x, SURFACE, z);
      if (block !== AIR && block !== WATER) {
        stamp(map, x - SHORE_FROM, z - SHORE_FROM);
      }
    }
  }
  for (const isle of ring ? islesOf(seed) : []) {
    const reach = Math.ceil(isle.radius * 1.2);
    for (const dz of Arr.range(-reach, reach)) {
      for (const dx of Arr.range(-reach, reach)) {
        const x = Math.floor(isle.x) + dx;
        const z = Math.floor(isle.z) + dz;
        const dry = Option.exists(
          isleGround(isle, seed, x, z),
          (ground) => ground.top >= SURFACE
        );
        if (dry) {
          stamp(map, x - SHORE_FROM, z - SHORE_FROM);
        }
      }
    }
  }
  return map;
}
