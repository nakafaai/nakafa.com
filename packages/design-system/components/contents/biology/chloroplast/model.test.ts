import { describe, expect, it } from "@effect/vitest";
import { evaluateChloroplast } from "@repo/design-system/components/contents/biology/chloroplast/model";

describe("chloroplast stage model", () => {
  it("identifies light, CO2, temperature, and balanced limiting regimes", () => {
    const lightLimited = evaluateChloroplast({
      co2: 80,
      co2Max: 100,
      co2Min: 0,
      light: 10,
      lightMax: 100,
      lightMin: 0,
      temperature: 26,
      temperatureMax: 45,
      temperatureMin: 5,
    });
    expect(lightLimited.limitingFactor).toBe("light");
    expect(lightLimited.gasState).toBe("netUptake");

    const co2Limited = evaluateChloroplast({
      co2: 15,
      co2Max: 100,
      co2Min: 0,
      light: 90,
      lightMax: 100,
      lightMin: 0,
      temperature: 28,
      temperatureMax: 45,
      temperatureMin: 5,
    });
    expect(co2Limited.limitingFactor).toBe("co2");

    const tempLimited = evaluateChloroplast({
      co2: 90,
      co2Max: 100,
      co2Min: 0,
      light: 90,
      lightMax: 100,
      lightMin: 0,
      temperature: 5,
      temperatureMax: 45,
      temperatureMin: 5,
    });
    expect(tempLimited.limitingFactor).toBe("temperature");

    const balanced = evaluateChloroplast({
      co2: 90,
      co2Max: 100,
      co2Min: 0,
      light: 90,
      lightMax: 100,
      lightMin: 0,
      temperature: 30,
      temperatureMax: 45,
      temperatureMin: 5,
    });
    expect(balanced.limitingFactor).toBe("balanced");
    expect(balanced.gasState).toBe("netRelease");
  });

  it("reaches compensation when photosynthesis matches respiration", () => {
    const comp = evaluateChloroplast({
      co2: 85,
      co2Max: 100,
      co2Min: 0,
      light: 30,
      lightMax: 100,
      lightMin: 0,
      temperature: 28,
      temperatureMax: 45,
      temperatureMin: 5,
    });
    expect(comp.gasState).toBe("compensation");
  });
});
