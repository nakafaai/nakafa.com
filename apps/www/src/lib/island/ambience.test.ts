// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order, Record as Rec } from "effect";
import { Bed, bedsOf, rustles } from "@/lib/island/ambience";
import type { Weather } from "@/lib/island/sky";
import type { Surround } from "@/lib/island/surround";

/** Open grass far from everything. */
const OPEN: Surround = {
  fall: 0,
  fire: 0,
  forest: 0,
  fresh: 0,
  meadow: 0,
  river: 0,
  sea: 0,
};

/** The beds at an hour under a weather, about a place, with no gust and no roof unless said. */
function beds(
  hour: number,
  weather: Weather,
  surround: Partial<Surround> = {},
  rest: { readonly gust?: number; readonly roof?: number } = {}
) {
  return bedsOf({
    gust: rest.gust ?? 0,
    hour,
    roof: rest.roof ?? 0,
    surround: { ...OPEN, ...surround },
    weather,
  });
}

describe("island/ambience", () => {
  it("names every bed and keeps each one quiet: none ever plays at full scale", () => {
    const loudest = beds(
      7,
      "storm",
      { fall: 1, fire: 1, forest: 1, fresh: 1, meadow: 1, river: 1, sea: 1 },
      { gust: 9, roof: 1 }
    );
    expect(Arr.sort(Rec.keys(loudest), Order.String)).toEqual([
      ...Bed.literals,
    ]);
    for (const loud of Rec.values(loudest)) {
      expect(loud).toBeLessThanOrEqual(0.9);
      expect(loud).toBeGreaterThanOrEqual(0);
    }
  });

  it("sings birds by day, most in a wood, less by the surf, and not at night or in the rain", () => {
    const wood = beds(7, "clear", { forest: 1 }).birds;
    expect(wood).toBeCloseTo(0.45, 6);
    expect(beds(7, "clear", { meadow: 1 }).birds).toBeLessThan(wood);
    expect(beds(7, "clear").birds).toBeLessThan(
      beds(7, "clear", { meadow: 1 }).birds
    );
    expect(beds(7, "clear", { forest: 1, sea: 1 }).birds).toBeCloseTo(
      wood / 2,
      6
    );
    expect(beds(23, "clear", { forest: 1 }).birds).toBe(0);
    expect(beds(7, "rain", { forest: 1 }).birds).toBe(0);
  });

  it("gives the night to its insects, thinner under rain and silent under snow, and frogs to fresh water at night and in the rain", () => {
    const night = beds(23, "clear", { meadow: 1 }).night;
    expect(night).toBeCloseTo(0.3, 6);
    expect(beds(23, "clear").night).toBeCloseTo(0.15, 6);
    expect(beds(23, "storm", { meadow: 1 }).night).toBeCloseTo(0.12, 6);
    expect(beds(23, "snow", { meadow: 1 }).night).toBe(0);
    expect(beds(12, "clear", { meadow: 1 }).night).toBe(0);
    expect(beds(23, "clear", { fresh: 1 }).frogs).toBeCloseTo(0.35, 6);
    expect(beds(12, "clear", { fresh: 1 }).frogs).toBe(0);
    expect(beds(12, "rain", { fresh: 1 }).frogs).toBeCloseTo(0.35 * 0.7, 6);
    expect(beds(23, "clear").frogs).toBe(0);
    expect(beds(23, "snow", { fresh: 1 }).frogs).toBe(0);
  });

  it("plays each water and a fire as loud as it is near", () => {
    const near = beds(12, "clear", { fall: 1, fire: 0.5, river: 0.5, sea: 1 });
    expect(near.sea).toBeCloseTo(0.55, 6);
    expect(near.river).toBeCloseTo(0.25, 6);
    expect(near.fall).toBeCloseTo(0.8, 6);
    expect(near.fire).toBeCloseTo(0.35, 6);
    const far = beds(12, "clear");
    expect([far.sea, far.river, far.fall, far.fire]).toEqual([0, 0, 0, 0]);
  });

  it("rains by the weather, harder in a storm, on the roofs only where roofs stand, and not at all in snow", () => {
    expect(beds(12, "clear").rain).toBe(0);
    expect(beds(12, "snow").rain).toBe(0);
    expect(beds(12, "rain").rain).toBeCloseTo(0.63, 6);
    expect(beds(12, "storm").rain).toBeCloseTo(0.9, 6);
    expect(beds(12, "storm").roof).toBe(0);
    expect(beds(12, "storm", {}, { roof: 0.5 }).roof).toBeCloseTo(0.3, 6);
    expect(beds(12, "clear", {}, { roof: 1 }).roof).toBe(0);
  });

  it("rustles a wood's leaves under a strong gust, sooner in a storm, and never on open ground", () => {
    expect(rustles(1.2, "clear", 1)).toBe(true);
    expect(rustles(0.3, "clear", 1)).toBe(false);
    expect(rustles(0.3, "storm", 1)).toBe(true);
    expect(rustles(1.2, "storm", 0)).toBe(false);
  });

  it("keeps a breath of wind always, more in a storm, and rises with a gust", () => {
    const calm = beds(12, "clear").wind;
    expect(calm).toBeGreaterThan(0.04);
    expect(calm).toBeLessThan(0.1);
    expect(beds(12, "storm").wind).toBeGreaterThan(calm * 2);
    expect(beds(12, "clear", {}, { gust: 1.2 }).wind).toBeGreaterThan(calm * 3);
  });
});
