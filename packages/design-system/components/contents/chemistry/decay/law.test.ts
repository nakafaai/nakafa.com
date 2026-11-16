import { describe, expect, it } from "@effect/vitest";
import {
  CARBON_HALF_LIFE,
  decayTimes,
  expectedSurvivors,
  scatterSites,
  survivors,
} from "@repo/design-system/components/contents/chemistry/decay/law";
import { Array as Arr } from "effect";

describe("radioactive decay", () => {
  it("leaves half the nuclei after one half-life and a quarter after two", () => {
    const times = decayTimes(400, CARBON_HALF_LIFE);

    expect(survivors(times, 0)).toBe(400);
    expect(
      Math.abs(survivors(times, CARBON_HALF_LIFE) - 200)
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(survivors(times, 2 * CARBON_HALF_LIFE) - 100)
    ).toBeLessThanOrEqual(2);
  });

  it("expects N0 (1/2)^(t / T) survivors", () => {
    expect(expectedSurvivors(400, CARBON_HALF_LIFE, CARBON_HALF_LIFE)).toBe(
      200
    );
    expect(expectedSurvivors(400, 3 * CARBON_HALF_LIFE, CARBON_HALF_LIFE)).toBe(
      50
    );
  });

  it("deals the times out to every site once, neighbours far apart", () => {
    const sites = scatterSites(400);

    expect(Arr.dedupe(sites)).toHaveLength(400);
    expect(Math.abs((sites[1] ?? 0) - (sites[0] ?? 0))).toBeGreaterThan(20);
  });
});
