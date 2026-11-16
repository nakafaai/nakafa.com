import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import { skylineOf } from "@/lib/island/mesh";
import { unitOf } from "@/lib/island/noise";
import type { Cells } from "@/lib/island/world";
import { blockAt } from "@/lib/island/world";

const GRASS = idOf("grass");

/** The share of open grass that a firefly calls home: about one column in forty. */
const SHARE = 0.025;

/**
 * Where the fireflies hover after dusk (ADR 0047, D36): over open grass,
 * nowhere under a roof or a crown, one column in forty picked by the seed so
 * the same meadow keeps the same fireflies. Each home is the point over the
 * middle of the grass, three numbers a firefly.
 */
export function firefliesOf(cells: Cells, seed: number) {
  const skyline = skylineOf(cells);
  return Float32Array.from(
    Arr.flatMap(Arr.range(0, SPAN * SPAN - 1), (column) => {
      const x = column % SPAN;
      const z = Math.floor(column / SPAN);
      const top = skyline[column];
      const meadow =
        top >= 0 &&
        blockAt(cells, x, top, z) === GRASS &&
        unitOf(seed + 53, x, 0, z) < SHARE;
      return meadow ? [x + 0.5, top + 1, z + 0.5] : [];
    })
  );
}
