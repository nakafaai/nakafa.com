import { Vector3 } from "three";

const DEFAULT_CURVE_DIVISIONS = 64;

/**
 * Smooth full circles without making every graph primitive expensive.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
export const GRAPH_FULL_CIRCLE_SEGMENTS = 96;

/**
 * Smooth small educational angle arcs while keeping point counts predictable.
 *
 * @see https://threejs.org/docs/pages/Curve.html#getPoints
 */
export const GRAPH_ANGLE_ARC_SEGMENTS = 48;

/**
 * Keeps small point markers round enough at high DPR without heavy meshes.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
export const GRAPH_POINT_SEGMENTS = 16;

/**
 * Keeps arrowheads visibly round without doubling geometry cost.
 *
 * @see https://threejs.org/docs/pages/ConeGeometry.html
 */
export const GRAPH_ARROW_SEGMENTS = 24;

/**
 * Caps generated boundary guide density for inequality surfaces.
 *
 * @see https://threejs.org/docs/pages/Line2.html
 */
export const GRAPH_BOUNDARY_SEGMENTS = 96;

/**
 * Samples sparse curves smoothly and keeps dense content near its source detail.
 *
 * `Curve.getPoints(divisions)` returns `divisions + 1` points, so dense
 * content should not be doubled unless a caller explicitly asks for it.
 *
 * @see https://threejs.org/docs/pages/Curve.html#getPoints
 */
export function getCurveDivisions(
  pointCount: number,
  requestedDivisions?: number
) {
  if (requestedDivisions !== undefined) {
    return Math.max(1, requestedDivisions);
  }

  if (pointCount < 2) {
    return 0;
  }

  return Math.max(DEFAULT_CURVE_DIVISIONS, pointCount - 1);
}

/**
 * Creates XY-plane arc points with shared graph quality defaults.
 *
 * @see https://threejs.org/docs/pages/Vector3.html
 */
export function createArcPoints(
  radius: number,
  radians: number,
  segments: number
) {
  const safeSegments = Math.max(1, segments);

  return Array.from({ length: safeSegments + 1 }, (_, index) => {
    const angle = (index / safeSegments) * radians;
    return new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });
}
