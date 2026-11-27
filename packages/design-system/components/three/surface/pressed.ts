import {
  cellsAt,
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { held } from "@repo/design-system/components/three/surface/tile";

/** Cork: pressed granules with dark walls and open pits. */
export function corkAt(x: number, y: number) {
  const grains = cellsAt(x, y, 26, 26, 173);
  const wall = held(1 - (grains.second - grains.nearest) * 5);
  const pit = grains.owner < 0.22 ? held(1 - grains.nearest * 2.6) : 0;
  return {
    height:
      0.75 - 0.3 * wall - 0.6 * pit + 0.1 * fractalAt(x, y, 96, 96, 179, 1),
    shade: 0.55 + 0.45 * grains.owner - 0.35 * wall - 0.3 * pit,
  };
}

/** Felt: matted fibres lying every way, with no weave. */
export function feltAt(x: number, y: number) {
  const fibre = Math.max(
    ridgedAt(x, y, 40, 14, 181, 3),
    ridgedAt(x, y, 14, 40, 191, 3)
  );
  return {
    height: 0.2 + 0.55 * fibre + 0.25 * fractalAt(x, y, 128, 128, 193, 1),
    shade: 0.5 + 0.3 * fibre + 0.2 * fractalAt(x, y, 6, 6, 197, 3),
  };
}

/** Foam: expanded beads pressed together, creased where they meet. */
export function foamAt(x: number, y: number) {
  const beads = cellsAt(x, y, 20, 20, 199);
  const body = held((beads.second - beads.nearest) * 3);
  return { height: 0.15 + 0.85 * body ** 0.4, shade: 0.72 + 0.28 * body };
}

/** Paper: a felt of fibres with a fine tooth and a cloudy formation. */
export function paperAt(x: number, y: number) {
  const fibres = ridgedAt(x, y, 48, 20, 223, 2);
  const cloud = fractalAt(x, y, 12, 12, 227, 3);
  return {
    height:
      0.3 +
      0.3 * cloud +
      0.25 * fractalAt(x, y, 128, 128, 229, 1) +
      0.15 * fibres,
    shade: 0.7 + 0.2 * cloud + 0.1 * fibres,
  };
}
