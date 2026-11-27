import { describe, expect, it } from "@effect/vitest";
import { fitShadow } from "@repo/design-system/components/three/sky/shadow";

describe("fitShadow", () => {
  it("stands the light outside the lab and closes its box around the reach", () => {
    const shadow = fitShadow(5, 2048);

    expect(shadow.distance).toBeCloseTo(12, 9);
    expect(shadow.near).toBeCloseTo(2, 9);
    expect(shadow.far).toBeCloseTo(22, 9);
  });

  it("pushes a surface off its own shadow by the size of a texel on the ground", () => {
    const small = fitShadow(5, 2048);
    const large = fitShadow(40, 2048);

    expect(small.normalBias).toBeCloseTo((1.6 * 10) / 2048, 9);
    expect(large.normalBias).toBeCloseTo(8 * small.normalBias, 9);
    expect(large.bias).toBe(small.bias);
  });

  it("blurs the edge by the same part of the lab on a small map, never under a texel", () => {
    expect(fitShadow(5, 2048).radius).toBe(2.2);
    expect(fitShadow(5, 1024).radius).toBeCloseTo(1.1264, 4);
    expect(fitShadow(5, 512).radius).toBe(1);
  });
});
