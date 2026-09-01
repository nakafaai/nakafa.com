export type ArrowPosition = "both" | "end" | "start";

interface ArrowPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function distance(from: ArrowPoint, to: ArrowPoint) {
  return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
}

/** Caps one arrowhead to its visible terminal segment so shortening cannot reverse it. */
export function resolveArrowSize(
  points: readonly ArrowPoint[],
  requestedSize: number,
  position: ArrowPosition
) {
  const start = points[0];
  const next = points[1];
  const previous = points.at(-2);
  const end = points.at(-1);
  if (!(start && next && previous && end) || requestedSize <= 0) {
    return 0;
  }

  const terminalLengths: number[] = [];
  if (position === "start" || position === "both") {
    terminalLengths.push(distance(start, next));
  }
  if (position === "end" || position === "both") {
    terminalLengths.push(distance(previous, end));
  }
  const shortest = Math.min(...terminalLengths);
  if (!(Number.isFinite(shortest) && shortest > 0)) {
    return 0;
  }

  const divisor = position === "both" && points.length === 2 ? 3 : 2;
  return Math.min(requestedSize, shortest / divisor);
}
