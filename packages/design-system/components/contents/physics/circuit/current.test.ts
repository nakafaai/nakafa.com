import { describe, expect, it } from "@effect/vitest";
import {
  bulbNetwork,
  cellFromReadings,
  drive,
  heaterOnSupply,
  parallel,
  wireRatios,
} from "@repo/design-system/components/contents/physics/circuit/current";

describe("cellFromReadings", () => {
  it("finds an e.m.f. of 3.0 V and an internal resistance of 1.0 ohm from two readings", () => {
    const cell = cellFromReadings(
      { resistance: 5, voltage: 2.5 },
      { resistance: 2, voltage: 2 }
    );
    expect(cell.emf).toBeCloseTo(3, 9);
    expect(cell.internal).toBeCloseTo(1, 9);
    expect(drive(cell, 1).current).toBeCloseTo(1.5, 9);
    expect(drive(cell, 1).voltage).toBeCloseTo(1.5, 9);
  });
});

describe("bulbNetwork", () => {
  it("shares 6.0 V as 3.0 V and 3.0 V while all bulbs work", () => {
    const { bulbs, current } = bulbNetwork(6, 4, [
      { broken: false, resistance: 6 },
      { broken: false, resistance: 12 },
    ]);
    expect(current).toBeCloseTo(0.75, 9);
    expect(bulbs[0]?.power).toBeCloseTo(2.25, 9);
    expect(bulbs[1]?.power).toBeCloseTo(1.5, 9);
    expect(parallel([6, 12])).toBeCloseTo(4, 9);
  });

  it("dims the series bulb and brightens the one left in parallel once the other breaks", () => {
    const { bulbs } = bulbNetwork(6, 4, [
      { broken: false, resistance: 6 },
      { broken: true, resistance: 12 },
    ]);
    expect(bulbs[0]?.voltage).toBeCloseTo(2.4, 9);
    expect(bulbs[0]?.power).toBeCloseTo(1.44, 9);
    expect(bulbs[1]?.power).toBeCloseTo(2.16, 9);
    expect(bulbs[2]?.power).toBe(0);
  });

  it("stops every current when the whole parallel group is broken", () => {
    const { bulbs, current } = bulbNetwork(6, 4, [
      { broken: true, resistance: 6 },
    ]);
    expect(current).toBe(0);
    expect(bulbs[1]?.voltage).toBe(6);
  });
});

describe("heaterOnSupply", () => {
  it("draws a quarter of its rated 1000 W on half the voltage, 0.50 kWh in 2.0 hours", () => {
    const heater = heaterOnSupply({ power: 1000, voltage: 240 }, 120, 2);
    expect(heater.resistance).toBeCloseTo(57.6, 9);
    expect(heater.power).toBeCloseTo(250, 9);
    expect(heater.energy).toBeCloseTo(0.5, 9);
  });
});

describe("wireRatios", () => {
  it("halves the resistance and doubles the power of a wire twice as long and twice as thick", () => {
    expect(wireRatios(2, 2)).toEqual({ area: 4, power: 2, resistance: 0.5 });
  });
});
