import {
  readNumberScalar,
  readPointAxisNumber,
} from "@repo/math/artifact/scalar";
import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";
import { describe, expect, it } from "vitest";

describe("artifact scalar conversion", () => {
  it("normalizes negative zero and keeps derived decimals sortable", () => {
    expect(readNumberScalar(-0).expression).toBe("0");

    const scalar = readNumberScalar(Math.PI / 2);

    expect(scalar.expression).toBe("1.5707963267949");
    expect(readSortableExactScalar(scalar)).toBeCloseTo(Math.PI / 2);
  });

  it("falls back to the schema scalar parser when point decimals are absent", () => {
    const point = ExactPoint3.make({
      x: ExactScalar.make({ expression: "1/2", latex: "\\frac{1}{2}" }),
      y: readNumberScalar(0),
      z: readNumberScalar(0),
    });

    expect(readPointAxisNumber(point, "x")).toBe(0.5);

    const invalidPoint = ExactPoint3.make({
      x: ExactScalar.make({ expression: "left", latex: "left" }),
      y: readNumberScalar(0),
      z: readNumberScalar(0),
    });
    expect(readPointAxisNumber(invalidPoint, "x")).toBeNaN();
  });
});
