import type { Spot } from "@repo/design-system/components/contents/mathematics/network/layout";
import { segmentDistance } from "@repo/design-system/components/contents/mathematics/network/layout";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";

/**
 * The land of the relief map the network is pinned to: rolling hills that
 * rise between the roads and lie flat along every road and round every town,
 * so the cords of the roads run level through the valleys, as a surveyor
 * routes them. The same network always raises the same hills.
 */

/** How high the tallest hill may stand over the valley floor, in metres. */
export const PEAK = 0.03;

/** How far from a road or a town the land stays flat, and where it reaches its full height, in metres. */
const VALLEY = { floor: 0.022, rim: 0.12 } as const;

/** How many patches of broad and of fine hills cross a metre of the board. */
const HILLS = { broad: 7, fine: 19 } as const;

/** How many patches the noise holds before it repeats, far more than a board is wide. */
const PERIOD = 64;

/** A road as the two places it joins. */
export type Segment = readonly [from: Spot, to: Spot];

/** A smooth step from 0 at `from` to 1 at `to`. */
function ramp(from: number, to: number, value: number) {
  const share = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return share * share * (3 - 2 * share);
}

/**
 * How high the land stands at `point`, in metres from 0 on the valley floor
 * to `PEAK`: the hills' own height, lowered to nothing along every road of
 * `segments` and round every town of `spots`.
 */
export function reliefAt(
  point: Spot,
  spots: readonly Spot[],
  segments: readonly Segment[]
) {
  const nearest = Math.min(
    Number.POSITIVE_INFINITY,
    ...Arr.map(spots, (spot) => Math.hypot(spot.x - point.x, spot.z - point.z)),
    ...Arr.map(segments, ([from, to]) => segmentDistance(point, from, to))
  );
  const broad = valueNoise(
    (point.x + 4) * HILLS.broad,
    (point.z + 4) * HILLS.broad,
    PERIOD
  );
  const fine = valueNoise(
    (point.x + 4) * HILLS.fine,
    (point.z + 4) * HILLS.fine,
    PERIOD
  );
  const hills = 0.25 + 0.55 * broad + 0.2 * fine;
  return PEAK * hills * ramp(VALLEY.floor, VALLEY.rim, nearest);
}
