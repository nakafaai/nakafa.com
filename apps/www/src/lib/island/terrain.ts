import { idOf } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import type { Edit } from "@repo/backend/confect/island/world";
import { SPAN } from "@repo/backend/confect/island/world";
import { WILD_PLANTS } from "@/lib/island/flora/plants";
import { smoothOf, unitOf } from "@/lib/island/noise";
import { layVillage, VILLAGE } from "@/lib/island/village";
import {
  blockAt,
  type Cells,
  cellOf,
  emptyCells,
  SEA_LEVEL,
} from "@/lib/island/world";

const GRASS = idOf("grass");
const DIRT = idOf("dirt");
const SAND = idOf("sand");
const STONE = idOf("stone");
const WATER = idOf("water");
const LOG = idOf("log");
const LEAVES = idOf("leaves");
const FLOWERS = idOf("flowers");

/** The middle of the world, where every island is centered. */
const MIDDLE = SPAN / 2;

/** The flat ground around the middle: the village and a ring of open meadow to build on, so no hill climbs under a house. */
const MEADOW = VILLAGE + 6;

/**
 * The column at (x, z): the top cell of its ground and whether that ground is
 * land above the water. The island is a rounded patch whose edge wobbles with
 * noise; the sea floor slopes down away from it.
 */
export function columnOf(seed: number, size: number, x: number, z: number) {
  const distance = Math.hypot(x + 0.5 - MIDDLE, z + 0.5 - MIDDLE);
  const radius = size / 2 - 1.5;
  const edge = radius * (0.8 + 0.28 * smoothOf(seed, x, z, 5));
  if (distance < edge) {
    const inland = Math.min(1, (edge - distance) / 4);
    const hills = smoothOf(seed + 1, x, z, 7) * 2 * inland;
    const flat = distance < MEADOW ? 0 : hills;
    return { land: true, top: SEA_LEVEL + Math.floor(flat) };
  }
  const depth = Math.min(5, 1 + Math.floor((distance - edge) / 2));
  return { land: false, top: SEA_LEVEL - depth };
}

/** Fills one column: stone, then dirt under grass on land, or sand under water at sea. */
function fillColumn(
  cells: Cells,
  x: number,
  z: number,
  column: ReturnType<typeof columnOf>,
  shore: boolean
) {
  for (let y = 0; y <= column.top; y += 1) {
    const below = column.top - y;
    const surface = column.land && !shore ? GRASS : SAND;
    const ground = below === 0 ? surface : DIRT;
    cells[cellOf(x, y, z)] = below > 2 ? STONE : ground;
  }
  for (let y = column.top + 1; y < SEA_LEVEL; y += 1) {
    cells[cellOf(x, y, z)] = WATER;
  }
}

/** Grows a tree whose trunk stands on (x, top, z): a log trunk and a round crown of leaves. */
function growTree(
  cells: Cells,
  seed: number,
  x: number,
  top: number,
  z: number
) {
  // Ground stands at most three cells above the sea, so a crown stays far below the sky.
  const trunk = 4 + ((x + z) % 2);
  for (let y = top + 1; y <= top + trunk; y += 1) {
    cells[cellOf(x, y, z)] = LOG;
  }
  const crown = top + trunk;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const reach = dx * dx + dz * dz + dy * dy * 1.6;
        const ragged = unitOf(seed + 6, x + dx, crown + dy, z + dz) < 0.25;
        if (reach > 5.2 || (reach > 3.5 && ragged)) {
          continue;
        }
        if (blockAt(cells, x + dx, crown + dy, z + dz) === 0) {
          cells[cellOf(x + dx, crown + dy, z + dz)] = LEAVES;
        }
      }
    }
  }
}

/**
 * Lays the ground of every column, and answers the top of each column of grass
 * that a tree or a flower may stand on (-1 for sand and sea).
 */
function layGround(cells: Cells, seed: number, size: number) {
  const meadows = new Int8Array(SPAN * SPAN);
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      const column = columnOf(seed, size, x, z);
      const shore =
        column.land && column.top === SEA_LEVEL && isShore(seed, size, x, z);
      fillColumn(cells, x, z, column, shore);
      meadows[z * SPAN + x] = column.land && !shore ? column.top : -1;
    }
  }
  return meadows;
}

/** Grows a tree or a flower on one column of grass, or nothing, as its seeded roll says. */
function plantAt(
  cells: Cells,
  meadows: Int8Array,
  seed: number,
  x: number,
  z: number
) {
  const top = meadows[z * SPAN + x];
  const away = Math.hypot(x + 0.5 - MIDDLE, z + 0.5 - MIDDLE) > VILLAGE + 4;
  if (top < 0 || !away) {
    return;
  }
  const roll = unitOf(seed + 4, x, 0, z);
  if (roll < 0.022 && isClearForTree(meadows, cells, x, top, z)) {
    growTree(cells, seed, x, top, z);
  } else if (roll > 0.9 && blockAt(cells, x, top + 1, z) === 0) {
    // Most meadow blooms are wild species; a few stay the plain flowers block.
    const pick = unitOf(seed + 8, x, 1, z);
    cells[cellOf(x, top + 1, z)] =
      pick < 0.2
        ? FLOWERS
        : idOf(PLANT_KEYS[WILD_PLANTS[Math.floor(pick * WILD_PLANTS.length)]]);
  }
}

/**
 * The generated world of an island with this seed and footprint side: ground,
 * shore, sea, the village in its middle, and trees and flowers around it
 * (ADR 0047, D3 and D10). It is never stored; the
 * learner's edits are laid over it.
 */
export function terrainOf(seed: number, size: number) {
  const cells = emptyCells();
  const meadows = layGround(cells, seed, size);
  layVillage(cells);
  for (let z = 2; z < SPAN - 2; z += 1) {
    for (let x = 2; x < SPAN - 2; x += 1) {
      plantAt(cells, meadows, seed, x, z);
    }
  }
  return cells;
}

/** Whether land at (x, z) touches the sea within two cells, where the grass gives way to sand. */
function isShore(seed: number, size: number, x: number, z: number) {
  for (let dz = -2; dz <= 2; dz += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (!columnOf(seed, size, x + dx, z + dz).land) {
        return true;
      }
    }
  }
  return false;
}

/** Whether a tree has room: land under its trunk and its neighbours, and no other crown in the way. */
function isClearForTree(
  columns: Int8Array,
  cells: Cells,
  x: number,
  top: number,
  z: number
) {
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (columns[(z + dz) * SPAN + x + dx] < 0) {
        return false;
      }
    }
  }
  for (let dz = -2; dz <= 2; dz += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (blockAt(cells, x + dx, top + 4, z + dz) !== 0) {
        return false;
      }
    }
  }
  return true;
}

/** A learner's world: the terrain their seed and footprint grow, with every cell they changed laid over it. */
export function worldOf(seed: number, size: number, edits: readonly Edit[]) {
  const cells = terrainOf(seed, size);
  for (const edit of edits) {
    cells[cellOf(edit.x, edit.y, edit.z)] = edit.block;
  }
  return cells;
}
