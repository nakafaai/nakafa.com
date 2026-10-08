import { describe, expect, it } from "@effect/vitest";
import { triangulatePolygon } from "@repo/design-system/lib/geometry/polygon";
import { Array as Arr } from "effect";
import { Euler, Vector3 } from "three";

const outline = [
  [0, 0],
  [3, 0],
  [3, 1],
  [1, 1],
  [1, 3],
  [0, 3],
];
describe("planar polygon triangulation", () => {
  it.each([
    { rotation: [0, 0, 0], reverse: false },
    { rotation: [0, 0, 0], reverse: true },
    { rotation: [Math.PI / 2, 0, 0], reverse: false },
    { rotation: [0, Math.PI / 2, 0], reverse: true },
    { rotation: [0.7, 0.4, 1.2], reverse: false },
  ])(
    "preserves a concave region under winding and spatial rotation: $rotation, $reverse",
    ({ rotation, reverse }) => {
      const order = reverse ? Arr.reverse(outline) : outline;
      const points = Arr.map(order, ([x, y]) =>
        new Vector3(x, y, 0).applyEuler(
          new Euler(rotation[0], rotation[1], rotation[2])
        )
      );
      const indices = triangulatePolygon(points);
      expect(indices).toHaveLength((points.length - 2) * 3);
      let area = 0;
      for (let index = 0; index < indices.length; index += 3) {
        const a = points[indices[index]];
        const b = points[indices[index + 1]];
        const c = points[indices[index + 2]];
        const triangleArea =
          b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
        expect(triangleArea).toBeGreaterThan(0);
        area += triangleArea;
        const original = [
          order[indices[index]],
          order[indices[index + 1]],
          order[indices[index + 2]],
        ];
        const centerX = Arr.reduce(original, 0, (sum, [x]) => sum + x) / 3;
        const centerY = Arr.reduce(original, 0, (sum, [, y]) => sum + y) / 3;
        expect(centerX <= 1 || centerY <= 1).toBe(true);
      }
      expect(area).toBeCloseTo(5, 12);
    }
  );
});
