import { describe, expect, it } from "@effect/vitest";
import {
  capillaryRiseMeters,
  ETHANOL_SPECIFIC_HEAT,
  makeWater,
  PROPERTIES,
  temperatureRise,
  visualColumnHeight,
  WATER_SPECIFIC_HEAT,
  waterLattice,
} from "@repo/design-system/components/contents/biology/water/bonds";

describe("capillaryRiseMeters", () => {
  it("computes Jurin's law capillary height and rises higher in narrower tubes", () => {
    const narrow = capillaryRiseMeters(25);
    const wide = capillaryRiseMeters(100);
    expect(narrow).toBeCloseTo(0.5937, 3);
    expect(narrow).toBeGreaterThan(wide * 3.9);
  });
});

describe("temperatureRise", () => {
  it("warms ethanol more than water for equal heat and mass", () => {
    const waterDelta = temperatureRise(2092, 50, WATER_SPECIFIC_HEAT);
    const ethanolDelta = temperatureRise(2092, 50, ETHANOL_SPECIFIC_HEAT);
    expect(waterDelta).toBeCloseTo(10, 1);
    expect(ethanolDelta).toBeCloseTo(17.6, 1);
    expect(ethanolDelta).toBeGreaterThan(waterDelta);
  });
});

describe("makeWater and visualColumnHeight", () => {
  it("places both hydrogens at 0.095 from oxygen and maps radius to visual height", () => {
    const m = makeWater(0, 0, 0, 0);
    expect(Math.hypot(m.h1[0], m.h1[1])).toBeCloseTo(0.095, 5);
    expect(Math.hypot(m.h2[0], m.h2[1])).toBeCloseTo(0.095, 5);
    expect(visualColumnHeight(20, 20, 100)).toBeCloseTo(1, 5);
    expect(visualColumnHeight(100, 20, 100)).toBeCloseTo(0.32, 5);
    expect(visualColumnHeight(50, 50, 50)).toBeCloseTo(1, 5);
  });
});

describe("waterLattice", () => {
  it("builds molecules for every property mode", () => {
    for (const property of PROPERTIES) {
      expect(waterLattice(property, 0.8).length).toBeGreaterThanOrEqual(6);
    }
  });
});
