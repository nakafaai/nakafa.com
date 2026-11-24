import { describe, expect, it } from "@effect/vitest";
import {
  evaluateCollision,
  sampleBoltzmann,
} from "@repo/design-system/components/contents/chemistry/collision/model";

describe("collision theory energy model", () => {
  it("raises collision frequency and effective rate with higher temperature, concentration, and finer surface area", () => {
    const lumpCold = evaluateCollision(290, 0.5, "lump");
    const granulesMid = evaluateCollision(320, 1.0, "granules");
    const powderHot = evaluateCollision(360, 1.5, "powder");

    expect(granulesMid.collisionFrequency).toBeGreaterThan(
      lumpCold.collisionFrequency
    );
    expect(powderHot.effectiveRate).toBeGreaterThan(granulesMid.effectiveRate);
    expect(powderHot.effectiveFraction).toBeGreaterThan(
      lumpCold.effectiveFraction
    );
  });

  it("samples normalized Maxwell-Boltzmann curves with default and minimum step bounds", () => {
    expect(sampleBoltzmann(300)).toHaveLength(37);
    expect(sampleBoltzmann(380, 4)).toHaveLength(9);
  });
});
