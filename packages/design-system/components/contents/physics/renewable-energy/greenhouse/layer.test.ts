import { describe, expect, it } from "@effect/vitest";
import {
  ABSORBED_SUNLIGHT,
  BARE_TEMPERATURE,
  backRadiation,
  outgoingInfrared,
  surfaceEmission,
  surfaceTemperature,
} from "@repo/design-system/components/contents/physics/renewable-energy/greenhouse/layer";

describe("one-layer greenhouse", () => {
  it("absorbs about 238 W/m² of sunlight, enough for a bare 255 K planet", () => {
    expect(ABSORBED_SUNLIGHT).toBeCloseTo(238.175, 3);
    expect(BARE_TEMPERATURE).toBeCloseTo(254.6, 1);
    expect(surfaceTemperature(0)).toBeCloseTo(BARE_TEMPERATURE, 9);
  });

  it("warms the surface to about 288 K when the layer absorbs 78% of the infrared", () => {
    expect(surfaceTemperature(0.78)).toBeCloseTo(288.1, 1);
  });

  it("balances the surface: sunlight plus back radiation equals what it emits", () => {
    for (const absorptance of [0.2, 0.5, 0.78, 0.95]) {
      expect(ABSORBED_SUNLIGHT + backRadiation(absorptance)).toBeCloseTo(
        surfaceEmission(absorptance),
        9
      );
    }
  });

  it("still sends the absorbed sunlight back to space at any absorptance", () => {
    for (const absorptance of [0, 0.4, 0.9]) {
      expect(outgoingInfrared(absorptance)).toBeCloseTo(ABSORBED_SUNLIGHT, 9);
    }
  });
});
