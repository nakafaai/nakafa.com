import { AIR, idOf } from "@repo/backend/confect/island/blocks";
import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import type { Cells } from "@/lib/island/world";
import { blockAt } from "@/lib/island/world";

const BRICK = idOf("brick");
const ROOFS = [idOf("roof"), idOf("slate")];

/** The four sides of a cell, as steps along x and z, each on the cell's own layer and the one under it. */
const BESIDE = Arr.flatMap(
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const,
  ([dx, dz]) =>
    [
      [dx, 0, dz],
      [dx, -1, dz],
    ] as const
);

/** Whether a roof block stands beside a cell, on its own layer or the one under it. */
function besideRoof(cells: Cells, x: number, y: number, z: number) {
  return Arr.some(BESIDE, ([dx, dy, dz]) =>
    Arr.contains(ROOFS, blockAt(cells, x + dx, y + dy, z + dz))
  );
}

/** Whether a cell is the top of a chimney: a brick open to the sky, and a roof beside one of the three bricks under its top. */
function isChimneyTop(cells: Cells, x: number, y: number, z: number) {
  return (
    blockAt(cells, x, y, z) === BRICK &&
    blockAt(cells, x, y + 1, z) === AIR &&
    Arr.some(
      [0, 1, 2],
      (down) =>
        blockAt(cells, x, y - down, z) === BRICK &&
        besideRoof(cells, x, y - down, z)
    )
  );
}

/**
 * Where smoke rises from (ADR 0047, D33): the top of every chimney, a brick
 * block open to the sky that stands up out of a roof. The village's cottages
 * have one each, and a chimney the learner builds the same way smokes too.
 * Each top is the point over the middle of the brick, three numbers a chimney.
 */
export function chimneysOf(cells: Cells) {
  return Float32Array.from(
    Arr.flatMap(Arr.range(0, SPAN * SPAN - 1), (column) => {
      const x = column % SPAN;
      const z = Math.floor(column / SPAN);
      const tops: readonly number[] = Arr.filter(
        Arr.range(1, HEIGHT - 2),
        (y: number) => isChimneyTop(cells, x, y, z)
      );
      return Arr.flatMap(tops, (y) => [x + 0.5, y + 1, z + 0.5]);
    })
  );
}
