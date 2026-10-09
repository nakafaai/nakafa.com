import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr } from "effect";
import { ShapeUtils, Vector2 } from "three";

/** Triangulates a validated simple planar polygon, including concave outlines. */
export function triangulatePolygon(vertices: readonly Point3[]) {
  const normal = { x: 0, y: 0, z: 0 };
  Arr.forEach(vertices, (point, index) => {
    const next = vertices[(index + 1) % vertices.length];
    normal.x += (point.y - next.y) * (point.z + next.z);
    normal.y += (point.z - next.z) * (point.x + next.x);
    normal.z += (point.x - next.x) * (point.y + next.y);
  });
  const x = Math.abs(normal.x);
  const y = Math.abs(normal.y);
  const z = Math.abs(normal.z);
  const contour = Arr.map(vertices, (point) => {
    if (x >= y && x >= z) {
      return new Vector2(point.y, point.z);
    }
    if (y >= z) {
      return new Vector2(point.x, point.z);
    }
    return new Vector2(point.x, point.y);
  });
  return Arr.flatten(ShapeUtils.triangulateShape(contour, []));
}
