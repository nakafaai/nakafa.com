import { describe, expect, it } from "@effect/vitest";
import { evaluateAreaBetweenCurves } from "@repo/design-system/components/contents/mathematics/enclose/model";

describe("area between curves model", () => {
  it("accumulates positive enclosed area as upper bound grows across all pairs", () => {
    const low = evaluateAreaBetweenCurves("lineAndParabola", 0.5);
    const high = evaluateAreaBetweenCurves("lineAndParabola", 1.8);
    const parab = evaluateAreaBetweenCurves("twoParabolas", 1.6);
    const trig = evaluateAreaBetweenCurves("sineAndCosine", 1.5);

    expect(high.enclosedArea).toBeGreaterThan(low.enclosedArea);
    expect(parab.enclosedArea).toBeGreaterThan(0);
    expect(trig.gapAtBound).toBeGreaterThan(0);
  });
});
