// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  evaluateSaturation,
  productsAt,
  saturationCurve,
} from "@repo/design-system/components/contents/biology/saturation/model";

describe("enzyme saturation lab model", () => {
  it("transitions smoothly from substrate-limited to enzyme-limited saturation", () => {
    const empty = evaluateSaturation(10, 0, 2);
    expect(empty.busySites).toBe(0);
    expect(empty.rate).toBe(0);
    expect(empty.limiting).toBe("substrate");

    const low = evaluateSaturation(10, 15, 2);
    expect(low.limiting).toBe("substrate");
    expect(low.rate).toBeGreaterThan(0);

    const saturated = evaluateSaturation(10, 200, 2);
    expect(saturated.limiting).toBe("enzyme");
    expect(saturated.busySites).toBeGreaterThan(8);
    expect(saturated.rate).toBeLessThanOrEqual(20);
  });

  it("samples a monotonic saturation curve and caps products at substrate count", () => {
    const curve = saturationCurve(10, 200, 2, 10);
    expect(curve).toHaveLength(11);
    expect(curve[0].rate).toBe(0);
    expect(curve[10].rate).toBeGreaterThan(curve[2].rate);
    expect(saturationCurve(10, 200, 2)).toHaveLength(41);

    expect(productsAt(15, 2, 50)).toBe(30);
    expect(productsAt(15, 10, 50)).toBe(50);
  });
});
