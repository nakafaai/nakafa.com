import { describe, expect, it } from "@effect/vitest";
import { evaluateEpsilonDelta } from "@repo/design-system/components/contents/mathematics/epsilon/model";

describe("epsilon-delta band model", () => {
  it("computes tighter delta bounds for steeper functions and smaller epsilons", () => {
    const hole = evaluateEpsilonDelta("removableHole", 0.4);
    const quad = evaluateEpsilonDelta("quadraticSmooth", 0.4);
    const steep = evaluateEpsilonDelta("steepLinear", 0.4);
    const tight = evaluateEpsilonDelta("removableHole", 0.1);

    expect(steep.delta).toBeLessThan(hole.delta);
    expect(quad.delta).toBeLessThan(hole.delta);
    expect(tight.delta).toBeLessThan(hole.delta);
  });
});
