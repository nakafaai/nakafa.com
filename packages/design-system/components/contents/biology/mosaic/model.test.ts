import { describe, expect, it } from "@effect/vitest";
import { evaluateMembraneFluidity } from "@repo/design-system/components/contents/biology/mosaic/model";

describe("fluid mosaic membrane model", () => {
  it("increases bilayer fluidity and lateral motion with temperature", () => {
    const cold = evaluateMembraneFluidity(5);
    const warm = evaluateMembraneFluidity(37);
    const hot = evaluateMembraneFluidity(55);

    expect(warm.fluidityPercent).toBeGreaterThan(cold.fluidityPercent);
    expect(hot.lateralWaveSpeed).toBeGreaterThan(warm.lateralWaveSpeed);
    expect(hot.lateralWaveAmplitude).toBeGreaterThan(cold.lateralWaveAmplitude);
  });
});
