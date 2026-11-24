import { describe, expect, it } from "@effect/vitest";
import { evaluateAuxinBend } from "@repo/design-system/components/contents/biology/auxin/model";

describe("auxin agar-block bend model", () => {
  it("increases bending angle and cell elongation proportionally with auxin level", () => {
    const zero = evaluateAuxinBend(0);
    const high = evaluateAuxinBend(80);

    expect(zero.bendDegrees).toBe(0);
    expect(zero.elongationPercent).toBe(100);
    expect(high.bendDegrees).toBeGreaterThan(35);
    expect(high.elongationPercent).toBeGreaterThan(140);
  });
});
