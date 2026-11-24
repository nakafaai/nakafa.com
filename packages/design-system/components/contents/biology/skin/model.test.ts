import { describe, expect, it } from "@effect/vitest";
import { evaluateSkin } from "@repo/design-system/components/contents/biology/skin/model";

describe("thermoregulation skin model", () => {
  it("dilates arterioles, flattens hair, and activates sweat in hot conditions", () => {
    const cold = evaluateSkin("cold", 6);
    const normal = evaluateSkin("normal", 24);
    const hot = evaluateSkin("hot", 38);

    expect(cold.arterioleScale).toBeLessThan(normal.arterioleScale);
    expect(hot.arterioleScale).toBeGreaterThan(normal.arterioleScale);
    expect(cold.hairAngleRad).toBeLessThan(hot.hairAngleRad);
    expect(cold.sweatActive).toBe(false);
    expect(hot.sweatActive).toBe(true);
    expect(hot.heatLossPercent).toBeGreaterThan(cold.heatLossPercent);
  });
});
