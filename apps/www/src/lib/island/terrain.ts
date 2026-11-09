import { Array as Arr, Schema } from "effect";
import { paletteIndex, type Ramp } from "@/lib/island/palette";
import { cellOf, emptyGrid, noise, type VoxelGrid } from "@/lib/island/voxel";

/** Voxels along one edge of a cell (ADR 0042, D15). */
export const VOXELS_PER_CELL = 8;

/** How deep the island's body reaches below its grass, in voxels. */
export const BODY_DEPTH = 22;

/** The voxels at the bottom of the body that are rock. */
const ROCK_BAND = 6;

/** A pond's hole in the body: its cells (east, south, width, depth) and how deep it reaches, in voxels. */
const Basin = Schema.Struct({
  cells: Schema.Tuple([Schema.Int, Schema.Int, Schema.Int, Schema.Int]),
  depth: Schema.Int,
});
type Basin = typeof Basin.Type;

/** Picks one of three tones from a roll: the low tone below `low`, the high one above `high`. */
function toneOf(
  roll: number,
  low: number,
  high: number,
  tones: readonly [number, number, number]
) {
  if (roll < low) {
    return tones[0];
  }
  return roll > high ? tones[2] : tones[1];
}

/** The palette value of one tone of a ramp, as a grid stores it. */
function paint(ramp: Ramp, tone: number) {
  return paletteIndex(ramp, Math.min(3, Math.max(0, tone))) + 1;
}

/** Whether a voxel column lies on the island's outer faces. */
function onEdge(grid: VoxelGrid, x: number, z: number) {
  return x === 0 || z === 0 || x === grid.width - 1 || z === grid.depth - 1;
}

/**
 * The colour of a voxel of the body: grass at the top, falling a few voxels
 * down the outer faces in a wavy lip; soil in soft bands, with pebbles on the
 * faces a visitor sees; rock along the bottom.
 */
function bodyValue(
  grid: VoxelGrid,
  x: number,
  y: number,
  z: number,
  seed: number
) {
  const top = grid.height - 1;
  const lip = 1 + Math.floor(noise(x, 0, z, seed + 3) * 3);
  if (y === top || (onEdge(grid, x, z) && y > top - lip)) {
    const speckle = noise(x, y, z, seed);
    return paint("grass", toneOf(speckle, 0.18, 0.84, [1, 2, 3]));
  }
  const wave = Math.floor(
    noise(Math.floor(x / 3), 0, Math.floor(z / 3), seed + 5) * 2
  );
  if (y < ROCK_BAND + wave) {
    return paint("stone", 1 + Math.floor(noise(x, y, z, seed + 9) * 2));
  }
  const pebble = noise(
    Math.floor(x / 2),
    Math.floor(y / 2),
    Math.floor(z / 2),
    seed + 11
  );
  if (onEdge(grid, x, z) && pebble > 0.93) {
    return paint("stone", pebble > 0.97 ? 3 : 2);
  }
  const band = Math.floor((y + wave) / 4) % 2;
  const grain = noise(x, y, z, seed + 13) < 0.12 ? -1 : 0;
  return paint("soil", 1 + band + grain);
}

/** A pond floor voxel: mostly sand, now and then a stone. */
function bedValue(roll: number) {
  return roll > 0.88 ? paint("stone", 2) : paint("sand", roll < 0.3 ? 1 : 2);
}

/** Empties a pond's hole and lines its floor with sand and a few stones. */
function carveBasin(grid: VoxelGrid, basin: Basin, seed: number) {
  const [cx, cz, cw, cd] = basin.cells;
  const top = grid.height - 1;
  const floor = top - basin.depth;
  for (let z = cz * VOXELS_PER_CELL; z < (cz + cd) * VOXELS_PER_CELL; z += 1) {
    for (
      let x = cx * VOXELS_PER_CELL;
      x < (cx + cw) * VOXELS_PER_CELL;
      x += 1
    ) {
      for (let y = floor + 1; y <= top; y += 1) {
        grid.cells[cellOf(grid, x, y, z)] = 0;
      }
      grid.cells[cellOf(grid, x, floor, z)] = bedValue(
        noise(x, floor, z, seed + 17)
      );
    }
  }
}

/**
 * The island's body for its size: a cube cut from the ground, grass on top,
 * soil and rock below, with the holes of its ponds (ADR 0042, D16). It is drawn
 * from the size and a seed, never stored, so an island that grows a level gets
 * a wider body with the same texture where it already stood.
 */
export function drawTerrain(
  size: number,
  seed: number,
  basins: readonly Basin[]
) {
  const side = size * VOXELS_PER_CELL;
  const grid = emptyGrid(side, BODY_DEPTH, side);
  for (let y = 0; y < BODY_DEPTH; y += 1) {
    for (let z = 0; z < side; z += 1) {
      for (let x = 0; x < side; x += 1) {
        grid.cells[cellOf(grid, x, y, z)] = bodyValue(grid, x, y, z, seed);
      }
    }
  }
  Arr.forEach(basins, (basin) => carveBasin(grid, basin, seed));
  return grid;
}
