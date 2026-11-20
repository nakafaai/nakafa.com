// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { MarbleGroup } from "@repo/design-system/components/contents/mathematics/marble/draw";
import {
  countOf,
  drawTrials,
  eventChance,
  jarOf,
  reduced,
  runningHits,
  totalOf,
} from "@repo/design-system/components/contents/mathematics/marble/draw";
import { Array as Arr } from "effect";

/** The lesson's jar: five red marbles and three blue ones. */
const JAR: readonly MarbleGroup[] = [
  { color: "red", count: 5 },
  { color: "blue", count: 3 },
];

describe("drawing two marbles", () => {
  it("counts the jar by colour and in all", () => {
    expect(countOf(JAR, "red")).toBe(5);
    expect(countOf(JAR, "green")).toBe(0);
    expect(totalOf(JAR)).toBe(8);
    expect(jarOf(JAR)).toEqual([
      "red",
      "red",
      "red",
      "red",
      "red",
      "blue",
      "blue",
      "blue",
    ]);
  });

  it("writes a fraction in lowest terms and keeps zero as 0/1", () => {
    expect(reduced({ denominator: 56, numerator: 20 })).toEqual({
      denominator: 14,
      numerator: 5,
    });
    expect(reduced({ denominator: 64, numerator: 0 })).toEqual({
      denominator: 1,
      numerator: 0,
    });
  });

  it("multiplies 5/8 by 4/7 for red then red without replacement", () => {
    expect(eventChance(JAR, { first: "red", second: "red" }, "keep")).toEqual({
      both: { denominator: 14, numerator: 5 },
      first: { denominator: 8, numerator: 5 },
      second: { denominator: 7, numerator: 4 },
    });
  });

  it("keeps the second draw at 3/7 when the colours differ, and at 5/8 with replacement", () => {
    expect(
      eventChance(JAR, { first: "red", second: "blue" }, "keep").second
    ).toEqual({ denominator: 7, numerator: 3 });
    expect(
      eventChance(JAR, { first: "red", second: "red" }, "replace")
    ).toEqual({
      both: { denominator: 64, numerator: 25 },
      first: { denominator: 8, numerator: 5 },
      second: { denominator: 8, numerator: 5 },
    });
  });

  it("gives zero when the jar has no marble of a colour left for the second draw", () => {
    const single: readonly MarbleGroup[] = [
      { color: "red", count: 1 },
      { color: "blue", count: 2 },
    ];
    expect(
      eventChance(single, { first: "red", second: "red" }, "keep").both
    ).toEqual({ denominator: 1, numerator: 0 });
  });

  it("never draws the same marble twice without replacement", () => {
    const trials = drawTrials(8, "keep", 5000, 11);
    expect(Arr.every(trials, (trial) => trial.first !== trial.second)).toBe(
      true
    );
    expect(
      Arr.every(
        trials,
        (trial) =>
          trial.first >= 0 &&
          trial.first < 8 &&
          trial.second >= 0 &&
          trial.second < 8
      )
    ).toBe(true);
  });

  it("settles near 5/14 without replacement and near 25/64 with it", () => {
    const jar = jarOf(JAR);
    const event = { first: "red", second: "red" } as const;
    const kept = runningHits(drawTrials(8, "keep", 20_000, 3), jar, event);
    const replaced = runningHits(
      drawTrials(8, "replace", 20_000, 3),
      jar,
      event
    );
    expect(Arr.getUnsafe(kept, 19_999) / 20_000).toBeCloseTo(5 / 14, 1);
    expect(Arr.getUnsafe(replaced, 19_999) / 20_000).toBeCloseTo(25 / 64, 1);
  });

  it("counts hits trial by trial", () => {
    const jar = jarOf(JAR);
    expect(
      runningHits(
        [
          { first: 0, second: 1 },
          { first: 0, second: 7 },
          { first: 6, second: 2 },
        ],
        jar,
        { first: "red", second: "red" }
      )
    ).toEqual([1, 1, 1]);
  });
});
