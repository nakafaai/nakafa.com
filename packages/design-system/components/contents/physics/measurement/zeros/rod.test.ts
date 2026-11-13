import { describe, expect, it } from "@effect/vitest";
import {
  ROD_LENGTH,
  rodReading,
} from "@repo/design-system/components/contents/physics/measurement/zeros/rod";

describe("rod read with three instruments", () => {
  it("adds one measured zero with each finer instrument", () => {
    expect(rodReading("tape", "cm")).toEqual({
      decimals: 0,
      figures: 2,
      measuredZeros: 0,
      placeZeros: 0,
      value: 31,
    });
    expect(rodReading("ruler", "cm")).toEqual({
      decimals: 1,
      figures: 3,
      measuredZeros: 1,
      placeZeros: 0,
      value: 31,
    });
    expect(rodReading("caliper", "cm")).toEqual({
      decimals: 2,
      figures: 4,
      measuredZeros: 2,
      placeZeros: 0,
      value: 31,
    });
  });

  it("keeps the figures in metres while a zero in front only places the point", () => {
    const reading = rodReading("ruler", "m");
    expect(reading.value).toBeCloseTo(0.31, 12);
    expect(reading.decimals).toBe(3);
    expect(reading.figures).toBe(3);
    expect(reading.placeZeros).toBe(1);
  });

  it("writes a tape reading in millimetres with a zero nobody measured", () => {
    expect(rodReading("tape", "mm")).toEqual({
      decimals: 0,
      figures: 2,
      measuredZeros: 0,
      placeZeros: 1,
      value: 310,
    });
    expect(rodReading("caliper", "mm")).toEqual({
      decimals: 1,
      figures: 4,
      measuredZeros: 2,
      placeZeros: 0,
      value: 310,
    });
  });

  it("reads a rod a hair longer than 31 cm", () => {
    expect(ROD_LENGTH - 31).toBeLessThan(0.005);
  });
});
