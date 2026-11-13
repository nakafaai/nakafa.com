import { describe, expect, it } from "@effect/vitest";
import {
  CAPACITY,
  dailyEnergy,
  HOME_LOAD,
  hoursOver,
  peakLoad,
  villageLoad,
} from "@repo/design-system/components/contents/physics/renewable-energy/grid/load";

describe("village load curve", () => {
  it("covers every hour of the day", () => {
    expect(HOME_LOAD).toHaveLength(24);
    expect(villageLoad("spread")).toHaveLength(24);
  });

  it("uses the same 330 kWh a day whichever way the cooking is scheduled", () => {
    expect(dailyEnergy("together")).toBeCloseTo(330, 9);
    expect(dailyEnergy("spread")).toBeCloseTo(330, 9);
  });

  it("peaks at 65 kW when every home cooks at 18:00, over the 50 kW grid for one hour", () => {
    expect(peakLoad("together")).toBeCloseTo(65, 9);
    expect(peakLoad("together")).toBeGreaterThan(CAPACITY);
    expect(hoursOver("together")).toBe(1);
  });

  it("stays at 35 kW when the cooking is spread from 16:00 to 20:00", () => {
    expect(peakLoad("spread")).toBeCloseTo(35, 9);
    expect(hoursOver("spread")).toBe(0);
    expect(villageLoad("spread")[16]).toBeCloseTo(20, 9);
  });
});
