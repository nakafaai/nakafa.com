// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  judgePress,
  keepTrial,
  summarizeTrials,
  TRIAL_LIMIT,
  WAIT_MAX,
  WAIT_MIN,
  waitFrom,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/reflex";
import { Array as Arr, Option } from "effect";

describe("reaction test", () => {
  it("waits an unpredictable time between the limits", () => {
    expect(waitFrom(0)).toBe(WAIT_MIN);
    expect(waitFrom(0.5)).toBe((WAIT_MIN + WAIT_MAX) / 2);
  });

  it("measures from the frame that first showed the lights", () => {
    expect(judgePress(Option.some(10), 10.31)).toEqual({
      _tag: "reaction",
      seconds: expect.closeTo(0.31, 9),
    });
  });

  it("calls a press before or right after the lights early", () => {
    expect(judgePress(Option.none(), 3)).toEqual({ _tag: "early" });
    expect(judgePress(Option.some(3), 3.05)).toEqual({ _tag: "early" });
  });

  it("keeps the newest trials and summarizes them", () => {
    const trials = Arr.reduce(
      [0.5, 0.4, 0.3, 0.35, 0.45, 0.25],
      Arr.empty<number>(),
      keepTrial
    );
    expect(trials).toHaveLength(TRIAL_LIMIT);
    expect(trials[0]).toBe(0.4);
    const summary = Option.getOrThrow(summarizeTrials(trials));
    expect(summary.best).toBe(0.25);
    expect(summary.mean).toBeCloseTo((0.4 + 0.3 + 0.35 + 0.45 + 0.25) / 5, 12);
    expect(summarizeTrials([])).toEqual(Option.none());
  });
});
