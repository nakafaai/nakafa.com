import { describe, expect, it } from "@effect/vitest";
import { evaluateSlopeField } from "@repo/design-system/components/contents/mathematics/slope/model";

describe("derivative slope field model", () => {
  it("classifies increasing, decreasing, and stationary probe points across curves", () => {
    const dec = evaluateSlopeField("cubicWave", 0);
    const inc = evaluateSlopeField("cubicWave", 1.8);
    const stat = evaluateSlopeField("quarticWell", 0);
    const sine = evaluateSlopeField("dampedSine", 0);

    expect(dec.direction).toBe("decreasing");
    expect(inc.direction).toBe("increasing");
    expect(stat.direction).toBe("stationary");
    expect(sine.derivative).toBeGreaterThan(0);
  });
});
