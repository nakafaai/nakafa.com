// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  largestCount,
  placeDigits,
} from "@repo/design-system/components/contents/mathematics/bundle/digits";
import { STICK } from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  along,
  boxAt,
  boxesAt,
  bundleAt,
  bundleTied,
  FLIGHT,
  flightProgress,
  planRun,
  roundIndexAt,
  stickAt,
  tiedBundlesAt,
  trayAt,
  traysAt,
} from "@repo/design-system/components/contents/mathematics/bundle/staging";
import { Array as Arr, Option } from "effect";

/** Counts and bases whose final desks the tests read, as many as the base allows. */
const CASES = [
  [237, 5],
  [300, 8],
  [300, 7],
  [127, 4],
  [7, 8],
  [40, 9],
  [15, 2],
] as const;

describe("bundle staging", () => {
  it("acts out one round for every division whose dividend reaches the base", () => {
    const run = planRun(237, 5);
    expect(Arr.map(run.rounds, (round) => round.step.dividend)).toEqual([
      237, 47, 9,
    ]);
    expect(run.length).toBe(4);
    for (const [before, after] of Arr.zip(
      run.rounds,
      Arr.drop(run.rounds, 1)
    )) {
      expect(after.start).toBe(before.end);
    }
    expect(Option.some(run.duration)).toEqual(
      Option.map(Arr.last(run.rounds), (round) => round.end)
    );
    expect(planRun(40, 9).rounds).toHaveLength(1);
    expect(planRun(7, 8).rounds).toHaveLength(1);
  });

  it("names the round under way", () => {
    const run = planRun(237, 5);
    expect(Option.isNone(roundIndexAt(run, 0))).toBe(true);
    const second = Arr.getUnsafe(run.rounds, 1);
    expect(roundIndexAt(run, second.start + 0.1)).toEqual(Option.some(1));
  });

  it("eases a flight from rest to rest and lifts it on an arc", () => {
    expect(flightProgress(0, 1)).toBe(0);
    expect(flightProgress(1 + FLIGHT / 2, 1)).toBeCloseTo(0.5);
    expect(flightProgress(9, 1)).toBe(1);
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 1, y: 0, z: -1 };
    expect(along(from, to, 0)).toEqual(from);
    expect(along(from, to, 1).x).toBeCloseTo(1);
    expect(along(from, to, 0.5).y).toBeGreaterThan(0);
  });

  it("starts with every stick in the heap, turned as it fell", () => {
    const run = planRun(237, 5);
    for (const stick of Arr.range(0, run.count - 1)) {
      const { at, heap, straight } = stickAt(run, stick, 0);
      expect(straight).toBe(0);
      expect(at.x).toBeCloseTo(heap.x);
      expect(at.z).toBeCloseTo(heap.z);
    }
  });

  it("brings the boxes and the tray only when their round starts", () => {
    const run = planRun(237, 5);
    const [, boxing, traying] = run.rounds;
    expect(Option.isNone(boxAt(run, 0, (boxing?.start ?? 0) - 0.1))).toBe(true);
    expect(Option.isSome(boxAt(run, 0, (boxing?.start ?? 0) + 0.1))).toBe(true);
    expect(Option.isNone(trayAt(run, 0, (traying?.start ?? 0) - 0.1))).toBe(
      true
    );
    expect(Option.isSome(trayAt(run, 0, run.duration))).toBe(true);
    expect(Option.isNone(trayAt(planRun(30, 5), 0, 99))).toBe(true);
    expect(boxesAt(planRun(40, 9), 99)).toEqual([]);
    expect(boxesAt(run, run.duration)).toHaveLength(9);
    expect(traysAt(run, run.duration)).toHaveLength(1);
    expect(traysAt(run, 0)).toEqual([]);
    const resting = boxAt(run, 8, (boxing?.start ?? 0) + 0.7);
    expect(Option.isSome(resting)).toBe(true);
    expect(boxAt(run, 8, run.duration)).not.toEqual(resting);
  });

  it("ties each bundle as its last stick lands, one after another", () => {
    const run = planRun(237, 5);
    expect(bundleTied(run, 1)).toBeGreaterThan(bundleTied(run, 0));
    const before = bundleAt(run, 46, 0);
    const [, boxing] = run.rounds;
    expect(bundleAt(run, 46, (boxing?.start ?? 0) + 0.01)).toEqual(before);
    expect(bundleAt(run, 46, run.duration)).not.toEqual(before);
    expect(bundleAt(run, 0, run.duration)).toEqual(bundleAt(run, 0, 0));
    expect(tiedBundlesAt(run, 0)).toEqual([]);
    expect(tiedBundlesAt(run, run.duration)).toHaveLength(47);
  });

  it("ends with the sticks of each place in that place's zone", () => {
    for (const [count, base] of CASES) {
      const shown = Math.min(count, largestCount(base));
      const final = planRun(shown, base);
      const digits = placeDigits(shown, base);
      for (const place of Arr.range(0, final.length - 1)) {
        const zone = Arr.getUnsafe(final.zones, place);
        const reach =
          (zone.columns * zone.size.length) / 2 + zone.columns * 0.007;
        const inZone = Arr.filter(Arr.range(0, final.count - 1), (stick) => {
          const { at } = stickAt(final, stick, final.duration);
          return Math.abs(at.x - zone.x) < reach;
        });
        expect(inZone.length).toBe((digits[place] ?? 0) * base ** place);
      }
    }
  });

  it("ends with every box, bundle and loose stick that stays lying flat on the desk", () => {
    for (const [count, base] of CASES) {
      const shown = Math.min(count, largestCount(base));
      const final = planRun(shown, base);
      const [singles = 0, bundles = 0, boxes = 0] = placeDigits(shown, base);
      const flat = (y: number) => expect(y).toBeCloseTo(0);
      const first = (amount: number) => Arr.take(Arr.range(0, base), amount);
      for (const box of first(boxes)) {
        flat(Option.getOrThrow(boxAt(final, box, final.duration)).y);
      }
      for (const bundle of first(bundles)) {
        flat(bundleAt(final, bundle, final.duration).y);
      }
      for (const stick of first(singles)) {
        flat(stickAt(final, stick, final.duration).at.y - STICK.thickness / 2);
      }
    }
  });

  it("never lets two sticks overlap once they are bundled", () => {
    const overlapping = Arr.flatMap(Arr.range(2, 9), (base) => {
      const run = planRun(largestCount(base), base);
      const ends = Arr.map(
        Arr.range(0, run.count - 1),
        (stick) => stickAt(run, stick, run.duration).at
      );
      return Arr.flatMap(ends, (a, first) =>
        Arr.filter(
          Arr.drop(ends, first + 1),
          (b) =>
            Math.abs(a.x - b.x) < STICK.length - 1e-9 &&
            Math.abs(a.y - b.y) < STICK.thickness - 1e-9 &&
            Math.abs(a.z - b.z) < STICK.width - 1e-9
        )
      );
    });
    expect(overlapping).toEqual([]);
  });
});
