import { Array as Arr, Schema } from "effect";

/** One point of a drawn line, right and up, in scene units. */
export const LinePointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type StillPoint = typeof LinePointSchema.Type;

/** How far a point may stand from the line drawn without it, as a share of the still's larger side. */
export const THIN_TOLERANCE = 0.001;

/** The distance of a point from the line through two others, or from the first when they meet. */
function offset(
  [x, y]: StillPoint,
  [ax, ay]: StillPoint,
  [bx, by]: StillPoint
) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  return length === 0
    ? Math.hypot(x - ax, y - ay)
    : Math.abs(dy * x - dx * y + bx * ay - by * ax) / length;
}

/**
 * Keeps the points of a line that its shape needs (Ramer, Douglas and Peucker): a point closer than `tolerance` to the
 * line drawn without it goes. A sampled curve keeps hundreds of points where the scene wants them smooth, while the
 * still is drawn once at the card's size, where a straight run needs only its two ends.
 */
export function thinLine(
  points: readonly StillPoint[],
  tolerance: number
): readonly StillPoint[] {
  if (points.length < 3 || !Arr.isReadonlyArrayNonEmpty(points)) {
    return points;
  }
  const first = Arr.headNonEmpty(points);
  const last = Arr.lastNonEmpty(points);
  const far = Arr.reduce(
    Arr.dropRight(
      Arr.drop(
        Arr.map(points, (point, index) => ({ index, point })),
        1
      ),
      1
    ),
    { distance: -1, index: 0 },
    (best, { index, point }) => {
      const distance = offset(point, first, last);
      return distance > best.distance ? { distance, index } : best;
    }
  );
  if (far.distance <= tolerance) {
    return [first, last];
  }
  return [
    ...thinLine(Arr.take(points, far.index + 1), tolerance),
    ...Arr.drop(thinLine(Arr.drop(points, far.index), tolerance), 1),
  ];
}
