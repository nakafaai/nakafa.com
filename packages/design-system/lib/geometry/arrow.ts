import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr, Option } from "effect";

type ArrowPosition = "both" | "end" | "start";

function distance(from: Point3, to: Point3) {
  return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
}

/** Caps one arrowhead to its visible terminal segment so shortening cannot reverse it. */
export function resolveArrowSize(
  points: readonly Point3[],
  requestedSize: number,
  position: ArrowPosition
) {
  const start = points[0];
  const next = points[1];
  const previous = Arr.get(points, points.length - 2);
  const end = Arr.last(points);
  if (
    !(start && next && Option.isSome(previous) && Option.isSome(end)) ||
    requestedSize <= 0
  ) {
    return 0;
  }

  const terminalLengths = Arr.appendAll(
    position === "start" || position === "both" ? [distance(start, next)] : [],
    position === "end" || position === "both"
      ? [distance(previous.value, end.value)]
      : []
  );
  const shortest = Math.min(...terminalLengths);
  if (!(Number.isFinite(shortest) && shortest > 0)) {
    return 0;
  }

  const divisor = position === "both" && points.length === 2 ? 3 : 2;
  return Math.min(requestedSize, shortest / divisor);
}
