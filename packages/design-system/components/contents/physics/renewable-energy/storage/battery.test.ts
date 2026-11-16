import { describe, expect, it } from "@effect/vitest";
import {
  demand,
  demandEnergy,
  solarEnergy,
  solarPower,
  storageDay,
} from "@repo/design-system/components/contents/physics/renewable-energy/storage/battery";

describe("solar health post with a battery", () => {
  it("collects about 22.9 kWh a day from a 3 kWp roof", () => {
    expect(solarPower(12)).toBeCloseTo(3, 9);
    expect(solarPower(3)).toBe(0);
    expect(solarEnergy()).toBeCloseTo((3 * 12 * 2) / Math.PI, 1);
  });

  it("uses 13.6 kWh a day, most of the evening load after sunset", () => {
    expect(demand(19)).toBeCloseTo(1.4, 9);
    expect(demand(23)).toBeCloseTo(0.4, 9);
    expect(demandEnergy()).toBeCloseTo(13.6, 6);
  });

  it("runs short in the night with a 5 kWh battery", () => {
    const day = storageDay(5);
    expect(day.unmet).toBeGreaterThan(3);
    expect(Math.min(...day.charges)).toBe(0);
  });

  it("gets through the night with a 10 kWh or 15 kWh battery", () => {
    expect(storageDay(10).unmet).toBeCloseTo(0, 6);
    expect(storageDay(15).unmet).toBeCloseTo(0, 6);
    expect(Math.max(...storageDay(15).charges)).toBeLessThanOrEqual(15);
  });
});
