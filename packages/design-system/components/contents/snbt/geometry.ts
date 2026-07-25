const DEFAULT_ARC_SEGMENTS = 20;

/** Three-dimensional point used by SNBT line and arc visuals. */
export interface GraphPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Returns the exact midpoint between two SNBT graph points. */
export function getMidpoint(firstPoint: GraphPoint, secondPoint: GraphPoint) {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
    z: (firstPoint.z + secondPoint.z) / 2,
  };
}

/**
 * Samples one XY-plane arc around a three-dimensional center.
 *
 * Angles use radians because each caller derives them through `Math.atan2`.
 * Every sampled point preserves the center's z coordinate.
 */
export function getArcPoints(
  center: GraphPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments = DEFAULT_ARC_SEGMENTS
) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const progress = index / segments;
    const angle = startAngle + progress * (endAngle - startAngle);

    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      z: center.z,
    };
  });
}
