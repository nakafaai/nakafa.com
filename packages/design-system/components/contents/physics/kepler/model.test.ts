import { describe, expect, it } from "@effect/vitest";
import { evaluateKepler } from "@repo/design-system/components/contents/physics/kepler/model";

describe("kepler orbit period model", () => {
  it("preserves T^2 / r^3 = 1 across every solar-system body and comet", () => {
    for (const body of [
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "comet",
    ] as const) {
      const reading = evaluateKepler(body, 0.2);
      expect(reading.keplerRatio).toBeCloseTo(1, 6);
      expect(reading.aphelionAu).toBeGreaterThan(reading.perihelionAu);
    }
  });

  it("increases perihelion-to-aphelion speed ratio as eccentricity grows", () => {
    const circle = evaluateKepler("earth", -0.2);
    const eccentric = evaluateKepler("comet", 0.95);

    expect(circle.speedRatio).toBeCloseTo(1, 6);
    expect(eccentric.speedRatio).toBeCloseTo(1.85 / 0.15, 4);
  });
});
