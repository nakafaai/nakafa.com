import {
  BOARD,
  HALF,
  LAND,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";

/**
 * The moulded land of the road diorama, in the road's own frame: flat along
 * the road and its verges, rising into rolling hills behind it and into low
 * banks in front, and falling back to the baseboard at every edge of the
 * diorama. The same place always has the same height.
 */

/** How high the tallest hill may stand behind the road, and the tallest bank in front, in metres. */
export const PEAK = { back: 0.1, front: 0.012 } as const;

/** How far from the road's strip the hills reach their height, and how far from an edge they fall away, in metres. */
const RISE = 0.16;
const EDGE = 0.045;

/** How many patches of broad and of fine hills cross a metre of land. */
const HILLS = { broad: 6, fine: 17 } as const;

/** How many patches the noise holds before it repeats, far more than the diorama is long. */
const PERIOD = 64;

/** A smooth step from 0 at `from` to 1 at `to`. */
function ramp(from: number, to: number, value: number) {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
}

/** How high the land stands over the road's strip at `x` across and `z` along, in metres. */
export function landAt(x: number, z: number) {
  const away = Math.abs(x) - BOARD.width / 2;
  const inside = Math.min(x + LAND.back, LAND.front - x, HALF - Math.abs(z));
  const broad = valueNoise(
    (x + 4) * HILLS.broad,
    (z + 4) * HILLS.broad,
    PERIOD
  );
  const fine = valueNoise((x + 4) * HILLS.fine, (z + 4) * HILLS.fine, PERIOD);
  const hills = 0.3 + 0.5 * broad + 0.2 * fine;
  const peak = x < 0 ? PEAK.back : PEAK.front;
  return peak * hills * ramp(0, RISE, away) * ramp(0, EDGE, inside);
}
