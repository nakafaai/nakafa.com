// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  QUADRATIC_POINTS,
  quadratic,
} from "@/components/marketing/about/lesson/quadratic";

describe("the quadratic lesson", () => {
  it("crosses the axis at the roots 1 and 3 that the lesson names", () => {
    expect(QUADRATIC_POINTS.left.x).toBe(1);
    expect(QUADRATIC_POINTS.right.x).toBe(3);
    expect(quadratic(QUADRATIC_POINTS.left.x)).toBe(0);
    expect(quadratic(QUADRATIC_POINTS.right.x)).toBe(0);
  });

  it("puts the vertex halfway between the roots, on the curve", () => {
    expect(QUADRATIC_POINTS.vertex.x).toBe(2);
    expect(QUADRATIC_POINTS.vertex.y).toBe(-1);
    expect(quadratic(QUADRATIC_POINTS.vertex.x)).toBe(
      QUADRATIC_POINTS.vertex.y
    );
  });
});
