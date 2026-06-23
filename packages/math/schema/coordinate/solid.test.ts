import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import { findSolidPrimitiveIssue } from "@repo/math/schema/coordinate/solid";
import { describe, expect, it } from "vitest";

describe("coordinate solid primitive validation", () => {
  it("validates scalar geometry for sphere and cuboid primitives", () => {
    const cases = [
      {
        expected:
          "Coordinate primitive sphere-symbolic sphere radius must use a sortable numeric value.",
        primitive: sphere("sphere-symbolic", "r"),
      },
      {
        expected:
          "Coordinate primitive sphere-negative sphere radius must be positive.",
        primitive: sphere("sphere-negative", "-1"),
      },
      {
        expected:
          "Coordinate primitive cuboid-symbolic cuboid x-axis must use sortable numeric bounds.",
        primitive: cuboid(
          "cuboid-symbolic",
          point("0", "0", "0"),
          point("right", "1", "1")
        ),
      },
      {
        expected:
          "Coordinate primitive cuboid-inverted cuboid y-axis must be increasing.",
        primitive: cuboid(
          "cuboid-inverted",
          point("0", "1", "0"),
          point("1", "0", "1")
        ),
      },
    ];

    for (const testCase of cases) {
      expect(findSolidPrimitiveIssue(testCase.primitive)).toBe(
        testCase.expected
      );
    }
  });

  it("accepts valid bounded solid primitives", () => {
    expect(
      findSolidPrimitiveIssue(sphere("sphere-valid", "1"))
    ).toBeUndefined();
  });
});

function sphere(id: string, radius: string): CoordinatePrimitive {
  return {
    center: point("0", "0", "0"),
    id,
    kind: "sphere",
    radius: scalar(radius),
  };
}

function cuboid(
  id: string,
  min: ExactPoint3,
  max: ExactPoint3
): CoordinatePrimitive {
  return { id, kind: "cuboid", max, min };
}

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({ x: scalar(x), y: scalar(y), z: scalar(z) });
}

function scalar(expression: string) {
  return ExactScalar.make({ expression, latex: expression });
}
