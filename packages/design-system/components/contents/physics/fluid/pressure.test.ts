import { describe, expect, it } from "@effect/vitest";
import {
  floatIn,
  hydraulicJack,
  manometer,
  venturi,
} from "@repo/design-system/components/contents/physics/fluid/pressure";

describe("hydraulicJack", () => {
  it("lifts 750 kg and rises 0.40 cm when 150 N pushes the small piston down 20 cm", () => {
    const jack = hydraulicJack({
      force: 150,
      large: 0.1,
      small: 0.002,
      stroke: 20,
    });
    expect(jack.pressure).toBeCloseTo(75_000, 6);
    expect(jack.lifted).toBeCloseTo(7500, 6);
    expect(jack.mass).toBeCloseTo(750, 6);
    expect(jack.rise).toBeCloseTo(0.4, 9);
  });
});

describe("floatIn", () => {
  it("floats a 500 cm3 block with 375 cm3 under oil of density 0.80", () => {
    const oil = floatIn(500, 300, 0.8);
    expect(oil.under).toBeCloseTo(375, 9);
    expect(oil.above).toBeCloseTo(125, 9);
    expect(oil.floats).toBe(true);
  });

  it("sinks the block in a liquid too light to hold it up", () => {
    const light = floatIn(500, 300, 0.5);
    expect(light.under).toBe(500);
    expect(light.floats).toBe(false);
  });
});

describe("venturi", () => {
  it("runs four times faster through half the diameter, with a lower column above it", () => {
    const flow = venturi(4, 2, 0.5);
    expect(flow.faster).toBeCloseTo(2, 9);
    expect(flow.drop).toBeCloseTo(0.1875, 9);
  });
});

describe("manometer", () => {
  it("reads a gas at 78 cm Hg from a water level 27.2 cm lower on the gas side", () => {
    const reading = manometer(27.2, { liquid: 1, reference: 13.6 }, 76);
    expect(reading.excess).toBeCloseTo(2, 9);
    expect(reading.gas).toBeCloseTo(78, 9);
  });
});
