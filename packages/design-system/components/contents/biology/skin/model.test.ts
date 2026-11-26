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

  it("responds continuously to ambient temperature changes within each condition", () => {
    const coolNormal = evaluateSkin("normal", 12);
    const warmNormal = evaluateSkin("normal", 36);
    expect(warmNormal.arterioleScale).toBeGreaterThan(
      coolNormal.arterioleScale
    );
    expect(warmNormal.hairAngleRad).toBeGreaterThan(coolNormal.hairAngleRad);
    expect(coolNormal.sweatActive).toBe(false);
    expect(warmNormal.sweatActive).toBe(true);
    expect(warmNormal.sweatIntensity).toBeGreaterThan(0);

    const mildHot = evaluateSkin("hot", 26);
    const extremeHot = evaluateSkin("hot", 42);
    expect(extremeHot.arterioleScale).toBeGreaterThan(mildHot.arterioleScale);
    expect(extremeHot.sweatIntensity).toBeGreaterThan(mildHot.sweatIntensity);
  });
});
