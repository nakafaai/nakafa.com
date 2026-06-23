import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import { readExpectedPlaneExpression } from "@repo/math/schema/coordinate/equation";
import { describe, expect, it } from "vitest";

describe("coordinate plane equation coefficients", () => {
  it("rejects point-normal offsets that round away nonzero products", () => {
    expect(
      readExpectedPlaneExpression(point("1e20", "1", "0"), point("1", "1", "0"))
    ).toBeUndefined();
  });
});

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({ x: scalar(x), y: scalar(y), z: scalar(z) });
}

function scalar(expression: string) {
  return ExactScalar.make({ expression, latex: expression });
}
