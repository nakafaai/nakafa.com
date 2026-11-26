import { describe, expect, it } from "@effect/vitest";
import { evaluateCrossProduct } from "@repo/design-system/components/contents/mathematics/cross/model";

describe("vector 3D cross product model", () => {
  it("obeys |u x v| = |u||v|sin(theta) and anti-commutativity when order flips", () => {
    const up = evaluateCrossProduct("uCrossV", 90);
    const down = evaluateCrossProduct("vCrossU", 90);
    const parallel = evaluateCrossProduct("uCrossV", 0);

    expect(up.area).toBe(3);
    expect(up.signedNormalY).toBe(3);
    expect(down.signedNormalY).toBe(-3);
    expect(parallel.area).toBe(0);
  });
});
