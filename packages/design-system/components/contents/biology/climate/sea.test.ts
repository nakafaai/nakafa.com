// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  floodedCount,
  floodLevel,
  outlookOf,
  RECORD_YEARS,
  recordRise,
  retreatOf,
  VILLAGE,
  waveAtShore,
} from "@repo/design-system/components/contents/biology/climate/sea";

describe("the observed record", () => {
  it("rises about 0.20 m from 1901 to 2018, faster each period", () => {
    expect(recordRise(RECORD_YEARS.first)).toBe(0);
    expect(recordRise(1971)).toBeCloseTo(0.091);
    expect(recordRise(RECORD_YEARS.last)).toBeCloseTo(0.2019, 3);
    expect(recordRise(1850)).toBe(0);
    expect(recordRise(2050)).toBeCloseTo(recordRise(2018));
  });
});

describe("the 2100 pathways", () => {
  it("raises the sea more under higher emissions", () => {
    expect(outlookOf("ssp126").rise).toBe(0.44);
    expect(outlookOf("ssp585").rise).toBeGreaterThan(outlookOf("ssp245").rise);
    expect(outlookOf("ssp585").warming).toBe(4.4);
  });
});

describe("the village", () => {
  it("moves the shoreline 50 m inland for each metre of rise on its slope", () => {
    expect(retreatOf(0.5, VILLAGE.slope)).toBeCloseTo(25);
  });

  it("halves the waves across 100 m of mangroves", () => {
    expect(waveAtShore(1, 0)).toBe(1);
    expect(waveAtShore(1, 100)).toBeCloseTo(0.5);
    expect(waveAtShore(1, -5)).toBe(1);
  });

  it("floods the low houses unless a wall is higher than the water", () => {
    const level = floodLevel(0.5, 0.5, 0.25);
    expect(level).toBe(1.25);
    expect(floodedCount(level, VILLAGE.floors, 0)).toBe(4);
    expect(floodedCount(level, VILLAGE.floors, VILLAGE.wall)).toBe(0);
    expect(floodedCount(2.1, VILLAGE.floors, VILLAGE.wall)).toBe(7);
  });
});
