// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { paceOf, wander } from "@/lib/island/life";
import { dwellerAt, flood, plainOf, speciesOf } from "@/lib/island/test.world";

/** A step of a quarter second with nothing in the way, about a home at the origin. */
const STEP = {
  blocked: () => false,
  dt: 0.25,
  home: [0, 0],
  others: [],
  pace: 1,
  spread: 3,
} as const;

describe("island/life", () => {
  it("walks a large species at a stroll and a small one slowly, and each of the world's own at its pace", () => {
    expect(paceOf(speciesOf("giraffe"))).toBe(1.6);
    expect(paceOf(speciesOf("mouse"))).toBeCloseTo(0.52, 6);
    expect(paceOf("fox")).toBe(3.2);
    expect(paceOf("hen")).toBeLessThan(paceOf("rabbit"));
  });

  it("rests, then walks toward its goal at its pace", () => {
    const land = plainOf(1);
    const resting = { ...dwellerAt("hen", 0, 0), rest: 0.4, tx: 4 };
    expect(wander(land, resting, STEP).rest).toBeCloseTo(0.15, 6);
    expect(wander(land, { ...resting, rest: 0.1 }, STEP).rest).toBe(0);
    const walked = wander(land, { ...resting, rest: 0 }, STEP);
    expect([walked.x, walked.z]).toEqual([0.25, 0]);
    expect(walked.steps).toBe(0);
  });

  it("stops at water, at what stands in its way and at another body, and picks a new way", () => {
    const land = plainOf(1);
    flood(land, 1, 0, 1, "lake");
    const hen = { ...dwellerAt("hen", 0.4, 0), tx: 4 };
    const stopped = wander(land, hen, STEP);
    expect(stopped).toMatchObject({
      rest: 0.6,
      steps: 1,
      tx: 0.4,
      tz: 0,
      x: 0.4,
    });
    const away = { ...dwellerAt("hen", 0, 8), tx: 4, tz: 8 };
    expect(
      wander(land, away, { ...STEP, blocked: (x) => x > 0.2 })
    ).toMatchObject({ rest: 0.6, x: 0 });
    const other = dwellerAt("hen", 0.5, 8);
    expect(wander(land, away, { ...STEP, others: [away, other] }).x).toBe(0);
    // A step that moves it away from a body it already touches is allowed, so two bodies never lock together.
    const leaving = { ...away, tx: -4 };
    expect(wander(land, leaving, { ...STEP, others: [other] }).x).toBe(-0.25);
  });

  it("at its goal picks the next one about its home from its own dice, where it fits, and rests a moment first", () => {
    const land = plainOf(1);
    const there = { ...dwellerAt("hen", 2, 2), tx: 2.1 };
    const next = wander(land, there, STEP);
    expect([next.x, next.z]).toEqual([2.1, 2]);
    expect(next.steps).toBe(1);
    expect(next.rest).toBeGreaterThanOrEqual(0.5);
    expect(next.rest).toBeLessThan(3);
    expect(Math.abs(next.tx)).toBeLessThanOrEqual(3);
    expect(Math.abs(next.tz)).toBeLessThanOrEqual(3);
    expect([next.tx, next.tz]).not.toEqual([2.1, 2]);
    expect(wander(land, there, STEP)).toEqual(next);
    expect(wander(land, { ...there, seed: 8 }, STEP).tx).not.toBe(next.tx);
    // A goal that does not suit it leaves it where it is, to roll again.
    const held = wander(land, there, { ...STEP, blocked: () => true });
    expect([held.tx, held.tz, held.steps]).toEqual([2.1, 2, 1]);
  });
});
