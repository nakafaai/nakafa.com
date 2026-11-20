// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { CAST } from "@/lib/island/fauna/cast";
import { flightBodies, flightsOf, skyAt } from "@/lib/island/fauna/flights";
import { CELL, surveyOf } from "@/lib/island/fauna/habitat";
import { modelKey } from "@/lib/island/models/kinds";
import {
  coverAll,
  floodAll,
  GROUND,
  plainOf,
  speciesOf,
} from "@/lib/island/test.world";

const DICE = { day: 20_000, gx: 0, gz: 0, seed: 1 };

/** A bird on a loop of ten blocks about a place, with a crown to come down to. */
const BIRD = {
  _tag: "sky",
  height: GROUND + 12,
  index: speciesOf("eagle"),
  perch: [40, GROUND + 8, 44],
  phase: 0,
  radius: 10,
  x: 30,
  z: 30,
} as const;

describe("island/fauna/flights", () => {
  it("flies a bird its loop, glides it down onto its perch, sits it, and raises it back where it left the loop", () => {
    const flying = skyAt(BIRD, 10);
    expect(flying.flying).toBe(true);
    expect(Math.hypot(flying.x - 30, flying.z - 30)).toBeCloseTo(10, 6);
    expect(Math.abs(flying.y - (GROUND + 12))).toBeLessThanOrEqual(0.3);
    const gliding = skyAt(BIRD, 27.5);
    expect(gliding.flying).toBe(true);
    expect(gliding.y).toBeLessThan(flying.y);
    expect(gliding.y).toBeGreaterThan(GROUND + 8);
    const sitting = skyAt(BIRD, 31);
    expect(sitting).toMatchObject({
      flying: false,
      x: 40,
      y: GROUND + 8,
      z: 44,
    });
    expect(skyAt(BIRD, 33.9).flying).toBe(false);
    const rising = skyAt(BIRD, 35);
    expect(rising.flying).toBe(true);
    expect(rising.y).toBeGreaterThan(GROUND + 8);
    // It comes back onto its loop where it came down from it.
    const [left, back] = [skyAt(BIRD, 25.999), skyAt(BIRD, 36.001)];
    expect(Math.hypot(left.x - back.x, left.z - back.z)).toBeLessThan(0.05);
    // Each bird keeps its round at a moment of its own.
    expect(skyAt({ ...BIRD, phase: 2 }, 31).flying).toBe(true);
  });

  it("draws a bird on the wing while it flies and folded while it sits, and a visitor of the flowers on its small loop", () => {
    const moth = {
      _tag: "bloom",
      height: GROUND + 1,
      index: speciesOf("monarch"),
      phase: 1,
      radius: 2,
      x: 5,
      z: 5,
    } as const;
    const flying = flightBodies([BIRD, moth], 10);
    expect(Arr.map(flying, ([model]) => modelKey(model))).toEqual([
      `flyer-${BIRD.index}`,
      `species-${moth.index}`,
    ]);
    expect(modelKey(flightBodies([BIRD], 31)[0][0])).toBe(
      `species-${BIRD.index}`
    );
    const [x, y, z] = flying[1][1];
    expect(Math.hypot(x - 5, z - 5)).toBeCloseTo(2, 5);
    expect(Math.abs(y - (GROUND + 1))).toBeLessThanOrEqual(0.3001);
    expect(flightBodies([moth], 11)[0][1][0]).not.toBe(x);
  });

  it("circles two birds of the day over a cell with land enough, each with a crown or the ground to come down to", () => {
    const land = plainOf(2);
    const survey = surveyOf(land, 0, 0);
    const birds = flightsOf(land, survey, DICE, []);
    expect(birds).toHaveLength(2);
    for (const bird of birds) {
      expect(bird._tag).toBe("sky");
      expect(Arr.contains(CAST.sky, bird.index)).toBe(true);
      expect(bird.height).toBeGreaterThanOrEqual(GROUND + 10);
      expect(bird.height).toBeLessThan(GROUND + 14);
      expect(bird.radius).toBeGreaterThanOrEqual(8);
      expect(bird.radius).toBeLessThan(18);
      // With no tree in the cell it comes down to the ground under its loop's middle.
      expect(bird._tag === "sky" && bird.perch).toEqual([
        bird.x,
        GROUND,
        bird.z,
      ]);
    }
    const crowns = [
      [10, GROUND + 8, 10],
      [50, GROUND + 9, 50],
    ] as const;
    const perched = flightsOf(land, survey, DICE, crowns);
    for (const bird of perched) {
      expect(crowns).toContainEqual(bird._tag === "sky" && bird.perch);
    }
    expect(flightsOf(land, survey, DICE, [])).toEqual(birds);
    const days = Arr.map(Arr.range(0, 30), (day) =>
      Arr.map(
        flightsOf(land, survey, { ...DICE, day }, []),
        (bird) => bird.index
      )
    );
    expect(Arr.dedupe(Arr.flatten(days)).length).toBeGreaterThan(6);
  });

  it("sends perchers and raptors over a wooded cell, visitors over a meadow's flowers, and nobody over the sea", () => {
    const wood = plainOf(2);
    coverAll(wood, [0, 0], [CELL, CELL], "forest");
    const birds = flightsOf(wood, surveyOf(wood, 0, 0), DICE, []);
    expect(birds).toHaveLength(2);
    expect(
      Arr.every(birds, (bird) => Arr.contains(CAST.perchers, bird.index))
    ).toBe(true);
    const meadow = plainOf(2);
    coverAll(meadow, [0, 0], [CELL, CELL], "meadow");
    const visitors = Arr.filter(
      flightsOf(meadow, surveyOf(meadow, 0, 0), DICE, []),
      (flight) => flight._tag === "bloom"
    );
    expect(visitors).toHaveLength(3);
    for (const visitor of visitors) {
      expect(Arr.contains(CAST.bloom, visitor.index)).toBe(true);
      expect(visitor.height).toBeGreaterThan(GROUND + 0.8);
      expect(visitor.height).toBeLessThan(GROUND + 1.8);
      expect(visitor.radius).toBeLessThan(2.8);
    }
    const sea = plainOf(2);
    floodAll(sea, [0, 0], [CELL, CELL], 6, "sea");
    expect(flightsOf(sea, surveyOf(sea, 0, 0), DICE, [])).toEqual([]);
  });
});
