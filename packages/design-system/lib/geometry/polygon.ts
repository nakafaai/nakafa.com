import type { CoordinatePoint } from "@repo/design-system/components/three/frame";
import { ShapeUtils, Vector2 } from "three";

/** Triangulates a validated simple planar polygon, including concave outlines. */
export function triangulatePolygon(vertices: readonly CoordinatePoint[]) {
  const normal = { x: 0, y: 0, z: 0 };
  for (const [index, point] of vertices.entries()) {
    const next = vertices[(index + 1) % vertices.length];
    normal.x += (point.y - next.y) * (point.z + next.z);
    normal.y += (point.z - next.z) * (point.x + next.x);
    normal.z += (point.x - next.x) * (point.y + next.y);
  }
  const x = Math.abs(normal.x);
  const y = Math.abs(normal.y);
  const z = Math.abs(normal.z);
  const contour = vertices.map((point) => {
    if (x >= y && x >= z) {
      return new Vector2(point.y, point.z);
    }
    if (y >= z) {
      return new Vector2(point.x, point.z);
    }
    return new Vector2(point.x, point.y);
  });
  return ShapeUtils.triangulateShape(contour, []).flat();
}
